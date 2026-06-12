# OUTCOMX Backend — Complete Technical Specification

**Version:** 1.0  
**Stack:** Node.js 20+, Express, TypeScript (strict), SQLite (better-sqlite3), JWT, bcrypt, Zod, Resend  
**Server:** `http://localhost:4000`  
**Start:** `npm run dev` from `outcomx-backend/`

---

## 1. Database Schema

### 1.1 `users`

```sql
CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT UNIQUE NOT NULL COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  username      TEXT UNIQUE NOT NULL COLLATE NOCASE,
  region        TEXT NOT NULL DEFAULT 'nigeria',
  balance       REAL NOT NULL DEFAULT 50000,
  is_admin      INTEGER NOT NULL DEFAULT 0,
  is_demo       INTEGER NOT NULL DEFAULT 0,
  is_verified   INTEGER NOT NULL DEFAULT 0,
  bio           TEXT NOT NULL DEFAULT '',
  avatar        TEXT NOT NULL DEFAULT '',
  joined_at     TEXT NOT NULL DEFAULT (datetime('now')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 1.2 `markets`

```sql
CREATE TABLE markets (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  title             TEXT NOT NULL,
  category          TEXT NOT NULL,
  type              TEXT NOT NULL,          -- YES_NO | UP_DOWN | MULTI | MULTI_YESNO
  options           TEXT NOT NULL,          -- JSON array of base labels ["Yes","No"] or ["Chelsea","Draw"]
  status            TEXT NOT NULL DEFAULT 'open',  -- open | closed | settled
  result            TEXT,                   -- winning outcome label (set at settlement)
  volume            REAL NOT NULL DEFAULT 0,
  probabilities     TEXT NOT NULL,          -- JSON object { label: pct } summing to 100
  duration          TEXT NOT NULL,          -- 5min | 15min | 1hour | 4hours | daily | weekly | monthly | yearly
  expires_at        TEXT NOT NULL,
  image             TEXT,
  banner            TEXT,
  resolution_source TEXT,
  platform_fee      REAL,                  -- 3% of total pool, set at settlement
  prize_pool        REAL,                  -- total paid to winners, set at settlement
  trending          INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 1.3 `market_outcomes`

```sql
CREATE TABLE market_outcomes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  market_id   INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,        -- base label e.g. "Chelsea" (never compound)
  probability REAL NOT NULL DEFAULT 0.5,  -- decimal 0.00–1.00
  pool_amount REAL NOT NULL DEFAULT 0,    -- total staked on this outcome
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 1.4 `trades`

```sql
CREATE TABLE trades (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  market_id     INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  market_title  TEXT NOT NULL,
  option        TEXT NOT NULL,        -- For MULTI_YESNO: "Chelsea:Yes" or "Chelsea:No"
                                      -- For all others: exact option label e.g. "Yes"
  amount        REAL NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active',  -- active | won | lost
  payout_amount REAL,                -- set at settlement: amount paid to winner (0 for loser)
  locked_payout REAL,                -- fixed-odds payout locked at trade time
  timestamp     TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 1.5 `market_price_history`

```sql
CREATE TABLE market_price_history (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  market_id     INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  probabilities TEXT NOT NULL,    -- full JSON snapshot of all outcome probabilities
  yes_price     REAL,             -- first-option decimal price (0.00–1.00)
  no_price      REAL,             -- second-option decimal price (0.00–1.00)
  trade_volume  REAL NOT NULL DEFAULT 0,
  recorded_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**Note:** `yes_price` / `no_price` are derived from the FIRST and SECOND options in the array — no hardcoded "Yes"/"No" key assumptions.

### 1.6 `email_verifications`

```sql
CREATE TABLE email_verifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code       TEXT NOT NULL,       -- 6-digit OTP
  expires_at TEXT NOT NULL,       -- 15 minutes from creation
  used       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 1.7 `token_blacklist`

```sql
CREATE TABLE token_blacklist (
  token      TEXT PRIMARY KEY,
  expires_at TEXT NOT NULL
);
```

### 1.8 PostgreSQL migration path

Change `prisma/schema.prisma`:
```
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```
Set `DATABASE_URL=postgresql://user:password@host:5432/outcomx`

---

## 2. Regional Starting Balances & Minimum Stakes

| Region | Starting Balance | Min Stake |
|--------|-----------------|-----------|
| nigeria | 50,000 | 1,500 |
| ghana | 1,000 | 15 |
| kenya | 10,000 | 130 |
| uk | 500 | 0.79 |
| usa | 500 | 0.99 |
| europe | 500 | 0.92 |
| southafrica | 5,000 | 18 |
| other | 500 | 0.99 |

---

## 3. Authentication

### JWT
- Secret: `JWT_SECRET` (min 32 chars, from `.env`)
- Expires: `JWT_EXPIRES_IN=7d`
- Payload: `{ sub: userId, isAdmin: boolean }`
- Sent as: `Authorization: Bearer <token>`
- Stored by frontend: `outcomx_token` (user), `outcomx_admin_token` (admin) in localStorage

### Token blacklist
Every token is checked against `token_blacklist` on every authenticated request. Logout inserts the token. Expired blacklist entries are cleaned up on every blacklist insert.

### Admin auth
`requireAdmin` middleware re-queries `is_admin` from DB on every admin request. Never trusts the JWT payload for admin status.

---

## 4. API Endpoints

### 4.1 Auth — `/api/auth`

Rate limit: 200 req/15min in dev, 20 req/15min in prod (only on POST /login, /register, /logout)

#### `POST /api/auth/register`
```json
// Request
{ "email": "user@example.com", "password": "Test1234", "name": "First Last", "region": "nigeria" }

// Response 201
{ "success": true, "data": { "token": "...", "user": { ...ApiUser } } }
```
Rules:
- Password: min 8 chars, 1 uppercase, 1 number
- Name: min 2 words
- Email: unique (case-insensitive)
- Username auto-generated from email prefix
- Balance set from regional starting balance
- Verification email sent (non-blocking — registration succeeds even if email fails)

#### `POST /api/auth/login`
```json
// Request
{ "email": "admin@outcomx.com", "password": "admin123" }

// Response 200
{ "success": true, "data": { "token": "...", "user": { ...ApiUser } } }
```

#### `POST /api/auth/logout`
Requires Bearer token. Blacklists the token.
```json
// Response 200
{ "success": true }
```

#### `GET /api/auth/me`
Requires Bearer token. Returns fresh user from DB (not from token).
```json
// Response 200
{ "success": true, "data": { ...ApiUser } }
```

#### `PATCH /api/auth/profile`
Requires Bearer token.
```json
// Request (all fields optional)
{ "name": "...", "username": "...", "bio": "...", "avatar": "https://...", "region": "uk" }

// Response 200
{ "success": true, "data": { ...ApiUser } }
```
If region changes, balance is reset to new region's starting balance.

#### `POST /api/auth/verify-email`
Requires Bearer token.
```json
// Request
{ "code": "123456" }

// Response 200
{ "success": true, "data": { ...ApiUser } }
// Errors: 400 "Invalid or expired code"
```

#### `POST /api/auth/resend-verification`
Requires Bearer token.
```json
// Response 200
{ "success": true }
// Errors: 400 "Email already verified"
```

### ApiUser shape
```typescript
{
  id: number
  email: string
  name: string
  username: string
  region: string
  balance: number
  isAdmin: boolean
  isDemo: boolean
  isVerified: boolean
  bio: string
  avatar: string
  joinedAt: string
}
```

---

### 4.2 Markets — `/api/markets`

All public (no auth required).

#### `GET /api/markets`
Default: returns only `status = 'open'` markets.  
With `?status=settled` — returns settled. With `?status=closed` — returns closed.

Query params: `category`, `duration`, `status`, `search`, `trending=true`, `new=true`

```json
// Response 200
{ "success": true, "data": [ ...ApiMarket ] }
```

#### `GET /api/markets/:id`
```json
// Response 200
{ "success": true, "data": { ...ApiMarket } }
// Errors: 404
```

#### `GET /api/markets/:id/history`
Query param: `?limit=200` (max 1000)
```json
// Response 200
{ "success": true, "data": [
  {
    "probabilities": { "Yes": 60, "No": 40 },
    "yesPrice": 0.60,
    "noPrice": 0.40,
    "tradeVolume": 5000,
    "recordedAt": "2026-06-11T12:00:00"
  }
] }
```
One row inserted per trade. `yesPrice` = first-option decimal, `noPrice` = second-option decimal.

#### `GET /api/markets/:id/trades`
Query param: `?limit=20` (max 100). Returns anonymised recent trades.
```json
// Response 200
{ "success": true, "data": [
  { "id": 1, "option": "Yes", "amount": 5000, "status": "active", "timestamp": "...", "trader": "joh***" }
] }
```

### ApiMarket shape
```typescript
{
  id: number
  title: string
  category: string
  type: string                    // YES_NO | UP_DOWN | MULTI | MULTI_YESNO
  options: string[]               // base labels — NEVER compound for MULTI_YESNO
  status: string                  // open | closed | settled
  result: string | null
  volume: number
  probabilities: Record<string, number>   // { label: pct } summing to 100
  duration: string
  expiresAt: string
  image: string | null
  banner: string | null
  resolutionSource: string | null
  platformFee: number | null      // null until settled
  prizePool: number | null        // null until settled
  trending: boolean
  createdAt: string
  outcomes?: ApiMarketOutcome[]
}

// ApiMarketOutcome
{
  id: number
  marketId: number
  label: string
  probability: number             // decimal 0.00–1.00
  poolAmount: number
  createdAt: string
}
```

---

### 4.3 Trades — `/api/trades`

All require Bearer token.

#### `POST /api/trades`
```json
// Request
{ "marketId": 42, "option": "Yes", "amount": 5000 }
// For MULTI_YESNO: option = "Chelsea:Yes" or "Chelsea:No"

// Response 201
{ "success": true, "data": {
  "trade": { ...ApiTrade },
  "newBalance": 45000,
  "updatedProbabilities": { "Yes": 62, "No": 38 }
} }
```

#### `GET /api/trades/my`
```json
// Response 200
{ "success": true, "data": [ ...ApiTrade ] }
```

### ApiTrade shape
```typescript
{
  id: number
  marketId: number
  marketTitle: string
  option: string              // For MULTI_YESNO: "Chelsea:Yes" or "Chelsea:No"
  amount: number
  status: string              // active | won | lost
  payoutAmount: number | null // set at settlement
  lockedPayout?: number | null // fixed-odds payout locked at trade time
  timestamp: string
}
```

---

### 4.4 Wallet — `/api/wallet`

All require Bearer token.

#### `GET /api/wallet/balance`
```json
// Response 200
{ "success": true, "data": { "balance": 47500, "region": "nigeria" } }
```

#### `POST /api/wallet/deposit`
```json
// Request
{ "amount": 10000 }

// Response 200
{ "success": true, "data": { "balance": 57500 } }
// Errors: 400 if amount < minStake or > startingBalance * 200
```

---

### 4.5 Admin — `/api/admin`

All require `requireAuth + requireAdmin`. Admin status re-queried from DB on every request.

#### `GET /api/admin/stats`
```json
// Response 200
{ "success": true, "data": {
  "totalMarkets": 15, "openMarkets": 10, "closedMarkets": 2, "settledMarkets": 3,
  "totalTrades": 87, "activeTrades": 34, "totalVolume": 1250000,
  "totalUsers": 42, "activeTraders": 18
} }
```

#### `GET /api/admin/income`
```json
// Response 200
{ "success": true, "data": {
  "totalIncome": 37500,
  "settledMarkets": 3,
  "recentSettlements": [
    { "id": 42, "title": "...", "platformFee": 600, "prizePool": 19400, "volume": 20000, "result": "Yes", "createdAt": "..." }
  ]
} }
```

#### `GET /api/admin/markets`
Query params: `search`, `status`, `category`. Returns all markets (all statuses).

#### `POST /api/admin/markets`
```json
// Request
{
  "title": "Will BTC hit $200k by end of 2026?",
  "category": "crypto",
  "type": "YES_NO",
  "options": ["Yes", "No"],
  "duration": "monthly",
  "probabilities": { "Yes": 65, "No": 35 },   // optional — equal split if omitted
  "image": "https://...",                       // optional
  "banner": "https://...",                      // optional
  "resolution_source": "Binance BTC/USDT"       // optional, snake_case in request body
}

// Response 201
{ "success": true, "data": { ...ApiMarket } }
```

Supported types: `YES_NO`, `UP_DOWN`, `MULTI`, `MULTI_YESNO`  
Supported categories: `sports`, `crypto`, `politics`, `finance`, `esports`, `entertainment`, `economy`  
Supported durations: `5min`, `15min`, `1hour`, `4hours`, `daily`, `weekly`, `monthly`, `yearly`

**MULTI_YESNO note:** Admin submits base labels e.g. `["Chelsea","Draw","Man United"]`. These are stored as-is. The `:Yes`/`:No` suffix is ONLY used in `trades.option` when a user places a trade.

#### `PATCH /api/admin/markets/:id`
```json
// Request (all optional)
{ "title": "...", "category": "...", "image": "...", "banner": "...", "resolution_source": "...", "status": "open|closed" }

// Response 200
{ "success": true, "data": { ...ApiMarket } }
```

#### `DELETE /api/admin/markets/:id`
Deletes any market regardless of status. FK cascade removes trades, outcomes, price history.
```json
// Response 200
{ "success": true }
// Errors: 404 if not found
```

#### `PATCH /api/admin/markets/:id/toggle`
Toggles `open` ↔ `closed`. Cannot toggle a `settled` market.
```json
// Response 200
{ "success": true, "data": { ...ApiMarket } }
```

#### `PATCH /api/admin/resolve/:id`
```json
// Request
{ "result": "Yes" }
// For MULTI_YESNO: result is the BASE label e.g. "Chelsea" (not "Chelsea:Yes")

// Response 200
{ "success": true, "data": {
  "market": { ...ApiMarket },
  "settledTrades": 3,
  "settlement": {
    "totalPool": 20000,
    "platformFee": 600,
    "platformFeeRate": 0.03,
    "prizePool": 19400,
    "winningOutcome": "Yes"
  }
} }
```

#### `GET /api/admin/users`
```json
// Response 200
{ "success": true, "data": [ ...ApiUser ] }  // password_hash never included
```

#### `GET /api/admin/users/stats`
```json
// Response 200
{ "success": true, "data": { "totalUsers": 42, "activeTraders": 18, "totalTrades": 87, "activeTrades": 34 } }
```

---

### 4.6 Health — `/api/health`
```json
// Response 200
{ "success": true, "data": { "status": "ok", "environment": "development", "timestamp": "..." } }
```

---

## 5. Probability Recalculation (per trade)

**Algorithm (Polymarket-style):**

```
shift = min(floor(amount / 5000), 3)   // max 3 percentage points per trade
if shift === 0: return unchanged

updated[option] = min(99, current[option] + shift)
otherKeys = all keys except option
for each other key:
  share = current[key] / sum(otherKeys)
  updated[key] = max(1, round(current[key] - shift * share))

// Normalise to exactly 100
total = sum(all updated values)
if total ≠ 100: updated[option] += (100 - total)
```

**For MULTI_YESNO:** probability shift uses the BASE label (`option.split(':')[0]`), not the compound option. The probabilities object is keyed by base labels.

---

## 6. Fixed-Odds Settlement Model

### 6.1 Locked payout (set at trade time)

```
probKey = MULTI_YESNO ? option.split(':')[0] : option
probability = currentProbs[probKey] / 100
safeProbability = max(probability, 0.05)   // 5% floor = max 20× stake
lockedPayout = amount * (1 / safeProbability)
```

Stored in `trades.locked_payout` at INSERT time (before probabilities shift).

### 6.2 Settlement calculation

```
totalPool = sum(all active trade amounts)

winningTrades = activeTrades where:
  - YES_NO / MULTI / UP_DOWN: trade.option === result
  - MULTI_YESNO: trade.option === result + ":Yes"  (e.g. "Chelsea:Yes" when result = "Chelsea")

totalLockedPayouts = sum(winningTrades.locked_payout)

payoutRatio = totalLockedPayouts > totalPool
  ? (totalPool * 0.97) / totalLockedPayouts   // cap to protect platform
  : 1                                          // normal: pay full locked odds

for each winning trade:
  finalPayout = trade.locked_payout * payoutRatio
  credit user balance += finalPayout
  set trade.status = 'won', trade.payout_amount = finalPayout

for each losing trade:
  set trade.status = 'lost', trade.payout_amount = 0

totalPaidOut = sum(finalPayouts)
platformIncome = totalPool - totalPaidOut
platformFee = max(totalPool * 0.03, platformIncome)  // guaranteed min 3%
prizePool = totalPaidOut

UPDATE market SET status='settled', result=result, platform_fee=platformFee, prize_pool=prizePool
```

---

## 7. MULTI_YESNO Trade Encoding

| Layer | Format | Example |
|-------|--------|---------|
| `markets.options` (DB) | Base labels | `["Chelsea","Draw","Man United"]` |
| `markets.probabilities` (DB) | Base labels | `{"Chelsea":55,"Draw":25,"Man United":20}` |
| `market_outcomes.label` (DB) | Base labels | `"Chelsea"` |
| `trades.option` (DB) | Compound | `"Chelsea:Yes"` or `"Chelsea:No"` |
| Trade request body | Compound | `{ "option": "Chelsea:Yes" }` |
| Settlement result | Base label | `{ "result": "Chelsea" }` |

**Validation on trade placement:**
```
colonIdx = option.lastIndexOf(':')
outcome = option.slice(0, colonIdx)
side = option.slice(colonIdx + 1)
isValid = market.options.includes(outcome) && (side === 'Yes' || side === 'No')
```

---

## 8. Price History Recording

One row inserted per trade (atomically inside the trade transaction):

```
yes_price = probToPrice(probabilities[options[0]])   // first option
no_price  = probToPrice(probabilities[options[1]])   // second option
trade_volume = trade amount
recorded_at = auto (datetime('now'))
```

`probToPrice(pct) = round((pct / 100) * 100) / 100`  — e.g. 55% → 0.55

One opening snapshot (volume=0) is seeded when a market is created.

---

## 9. CORS Configuration

```typescript
cors({
  origin: ['http://localhost:3000'],   // from ALLOWED_ORIGINS in .env
  credentials: true,
  allowedHeaders: ['Authorization', 'Content-Type'],
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
})
```

Preflight `OPTIONS` requests return `204` with all headers.

---

## 10. Seed Accounts

| Email | Password | Role | Balance |
|-------|----------|------|---------|
| `demo@outcomx.com` | `demo123` | `is_demo=1` | 50,000 |
| `admin@outcomx.com` | `admin123` | `is_admin=1` | 0 |

---

## 11. HTTP Status Codes

| Code | When |
|------|------|
| 200 | GET, PATCH, DELETE success |
| 201 | POST success (register, create market, place trade) |
| 400 | Validation error, business rule violation |
| 401 | Missing/invalid/expired/blacklisted token |
| 403 | Valid token but not admin |
| 404 | Resource not found |
| 409 | Duplicate email or username |
| 429 | Rate limit exceeded |
| 500 | Unhandled server error |

All error responses: `{ "success": false, "error": "human readable message" }`  
All success responses: `{ "success": true, "data": <payload> }`

---

## 12. Business Rules

1. **Password never returned** — `password_hash` never appears in any API response
2. **Admin always re-verified** — `is_admin` re-read from DB on every `/api/admin/*` request
3. **Token blacklist** — every logout blacklists the JWT; checked on every authenticated request
4. **Market auto-close** — `expires_at <= now` markets are set to `closed` on every `GET /api/markets` call
5. **Balance atomicity** — balance deduction and trade insert happen in a single SQLite transaction
6. **Probability atomicity** — probability update, market_outcomes sync, and price history snapshot happen in the same transaction as the trade
7. **No fee on placement** — platform fee is ONLY deducted at settlement, never on trade placement
8. **Settled markets** — once settled, cannot be settled again (400). Can be deleted by admin.
9. **MULTI_YESNO options** — base labels stored in markets table, compound format ONLY in trades table
10. **Registration non-blocking** — if email send fails, registration still returns 201
11. **JWT 7 days** — tokens valid for 7 days; frontend stores separately for user (`outcomx_token`) and admin (`outcomx_admin_token`)
