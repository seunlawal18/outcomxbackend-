-- ─── OUTCOMX Migration — Full Schema ─────────────────────────────────────────
-- Compatible with SQLite (dev) and PostgreSQL (production)

CREATE TABLE IF NOT EXISTS "users" (
    "id"            INTEGER  NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email"         TEXT     NOT NULL UNIQUE COLLATE NOCASE,
    "password_hash" TEXT     NOT NULL,
    "name"          TEXT     NOT NULL,
    "username"      TEXT     NOT NULL UNIQUE COLLATE NOCASE,
    "region"        TEXT     NOT NULL DEFAULT 'nigeria',
    "balance"       REAL     NOT NULL DEFAULT 50000,
    "is_admin"      INTEGER  NOT NULL DEFAULT 0,
    "is_demo"       INTEGER  NOT NULL DEFAULT 0,
    "bio"           TEXT     NOT NULL DEFAULT '',
    "avatar"        TEXT     NOT NULL DEFAULT '',
    "joined_at"     TEXT     NOT NULL DEFAULT (datetime('now')),
    "created_at"    TEXT     NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS "markets" (
    "id"               INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title"            TEXT    NOT NULL,
    "category"         TEXT    NOT NULL,
    "type"             TEXT    NOT NULL,
    "options"          TEXT    NOT NULL,
    "status"           TEXT    NOT NULL DEFAULT 'open',
    "result"           TEXT,
    "volume"           REAL    NOT NULL DEFAULT 0,
    "probabilities"    TEXT    NOT NULL,
    "duration"         TEXT    NOT NULL,
    "expires_at"       TEXT    NOT NULL,
    "image"            TEXT,
    "banner"           TEXT,
    "resolution_source" TEXT,
    "platform_fee"     REAL,
    "prize_pool"       REAL,
    "trending"         INTEGER NOT NULL DEFAULT 0,
    "created_at"       TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- market_outcomes: one row per outcome per market
-- probability: decimal 0.00–1.00 (updated after every trade)
-- pool_amount: total staked on this outcome
CREATE TABLE IF NOT EXISTS "market_outcomes" (
    "id"          INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "market_id"   INTEGER NOT NULL REFERENCES "markets"("id") ON DELETE CASCADE,
    "label"       TEXT    NOT NULL,
    "probability" REAL    NOT NULL DEFAULT 0.5,
    "pool_amount" REAL    NOT NULL DEFAULT 0,
    "created_at"  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS "trades" (
    "id"            INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id"       INTEGER NOT NULL REFERENCES "users"("id")    ON DELETE CASCADE,
    "market_id"     INTEGER NOT NULL REFERENCES "markets"("id")  ON DELETE CASCADE,
    "market_title"  TEXT    NOT NULL,
    "option"        TEXT    NOT NULL,
    "amount"        REAL    NOT NULL,
    "status"        TEXT    NOT NULL DEFAULT 'active',
    "payout_amount" REAL,
    "timestamp"     TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS "token_blacklist" (
    "token"      TEXT NOT NULL PRIMARY KEY,
    "expires_at" TEXT NOT NULL
);

-- market_price_history: one row per trade event
-- yes_price = first-option decimal, no_price = second-option decimal
-- No hardcoded "Yes"/"No" key assumptions
CREATE TABLE IF NOT EXISTS "market_price_history" (
    "id"            INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "market_id"     INTEGER NOT NULL REFERENCES "markets"("id") ON DELETE CASCADE,
    "probabilities" TEXT    NOT NULL,
    "yes_price"     REAL,
    "no_price"      REAL,
    "trade_volume"  REAL    NOT NULL DEFAULT 0,
    "recorded_at"   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_trades_user_id"       ON "trades"("user_id");
CREATE INDEX IF NOT EXISTS "idx_trades_market_id"     ON "trades"("market_id");
CREATE INDEX IF NOT EXISTS "idx_markets_status"       ON "markets"("status");
CREATE INDEX IF NOT EXISTS "idx_markets_category"     ON "markets"("category");
CREATE INDEX IF NOT EXISTS "idx_outcomes_market_id"   ON "market_outcomes"("market_id");
CREATE INDEX IF NOT EXISTS "idx_price_history_market" ON "market_price_history"("market_id");
CREATE INDEX IF NOT EXISTS "idx_price_history_time"   ON "market_price_history"("market_id", "recorded_at");
