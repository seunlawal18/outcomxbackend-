import db, { SQL_NOW, TxDb } from './client';

const NOW_DEFAULT = `(${SQL_NOW})`;

async function columnsOf(tx: TxDb, table: string): Promise<string[]> {
  const rows = await tx.prepare<{ name: string }>(
    `SELECT column_name as name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = ?`,
  ).all(table);
  return rows.map(c => c.name);
}

export async function applySchema(): Promise<void> {
  await db.transaction(async (tx) => {

    // citext gives case-insensitive TEXT columns at the type level, so
    // email/username/address stay case-insensitive-unique and every
    // existing `WHERE email = ?` comparison keeps working with no query
    // changes — the Postgres equivalent of SQLite's COLLATE NOCASE.
    await tx.exec(`CREATE EXTENSION IF NOT EXISTS citext`);

    // ── Users ──────────────────────────────────────────────────────────────
    await tx.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id            SERIAL PRIMARY KEY,
        email         CITEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name          TEXT NOT NULL,
        username      CITEXT UNIQUE NOT NULL,
        region        TEXT NOT NULL DEFAULT 'nigeria',
        balance       REAL NOT NULL DEFAULT 0,
        is_admin      INTEGER NOT NULL DEFAULT 0,
        is_demo       INTEGER NOT NULL DEFAULT 0,
        bio           TEXT NOT NULL DEFAULT '',
        avatar        TEXT NOT NULL DEFAULT '',
        joined_at     TEXT NOT NULL DEFAULT ${NOW_DEFAULT},
        created_at    TEXT NOT NULL DEFAULT ${NOW_DEFAULT}
      )
    `);

    // ── Markets ────────────────────────────────────────────────────────────
    // options       — JSON array of outcome labels (any strings, no hardcoding)
    // probabilities — JSON object { label: pct } summing to 100
    // resolution_source — optional URL or description of how market resolves
    // banner        — optional banner image URL (wider than square image)
    // platform_fee  — 3% fee deducted from total pool at settlement (null until settled)
    // prize_pool    — 97% of total pool distributed to winners (null until settled)
    // price_asset_id     — CoinGecko coin id (e.g. "bitcoin") — presence marks
    //                      this as a live-price market (UP_DOWN type only)
    // price_asset_symbol — display symbol (e.g. "BTC")
    // opening_price      — real asset price captured at market creation,
    //                      compared against price at expiry for auto-resolution
    await tx.exec(`
      CREATE TABLE IF NOT EXISTS markets (
        id                  SERIAL PRIMARY KEY,
        title               TEXT NOT NULL,
        category            TEXT NOT NULL,
        type                TEXT NOT NULL,
        options             TEXT NOT NULL,
        status              TEXT NOT NULL DEFAULT 'open',
        result              TEXT,
        volume              REAL NOT NULL DEFAULT 0,
        probabilities       TEXT NOT NULL,
        duration            TEXT NOT NULL,
        expires_at          TEXT NOT NULL,
        image               TEXT,
        banner              TEXT,
        resolution_source   TEXT,
        platform_fee        REAL,
        prize_pool          REAL,
        trending            INTEGER NOT NULL DEFAULT 0,
        price_asset_id      TEXT,
        price_asset_symbol  TEXT,
        opening_price       REAL,
        created_at          TEXT NOT NULL DEFAULT ${NOW_DEFAULT},
        resolved_by         INTEGER REFERENCES users(id)
      )
    `);

    // ── Market outcomes ────────────────────────────────────────────────────
    // One row per outcome per market.
    // probability  — decimal 0.00–1.00 (e.g. 0.55 = 55%)
    // pool_amount  — total amount staked on this outcome (updated on every trade)
    // created_at   — auto-set on insert
    await tx.exec(`
      CREATE TABLE IF NOT EXISTS market_outcomes (
        id           SERIAL PRIMARY KEY,
        market_id    INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
        label        TEXT NOT NULL,
        probability  REAL NOT NULL DEFAULT 0.5,
        pool_amount  REAL NOT NULL DEFAULT 0,
        result       TEXT,
        created_at   TEXT NOT NULL DEFAULT ${NOW_DEFAULT}
      )
    `);

    // ── Trades ─────────────────────────────────────────────────────────────
    await tx.exec(`
      CREATE TABLE IF NOT EXISTS trades (
        id            SERIAL PRIMARY KEY,
        user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        market_id     INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
        market_title  TEXT NOT NULL,
        option        TEXT NOT NULL,
        amount        REAL NOT NULL,
        status        TEXT NOT NULL DEFAULT 'active',
        timestamp     TEXT NOT NULL DEFAULT ${NOW_DEFAULT}
      )
    `);

    // ── Token blacklist ────────────────────────────────────────────────────
    await tx.exec(`
      CREATE TABLE IF NOT EXISTS token_blacklist (
        token      TEXT PRIMARY KEY,
        expires_at TEXT NOT NULL
      )
    `);

    // ── Market price history ───────────────────────────────────────────────
    // One row per trade event, plus periodic heartbeat snapshots and — for
    // live-price markets — periodic real asset-price ticks.
    // probabilities — full JSON snapshot of all outcome probabilities
    // yes_price / no_price — convenience decimals for binary markets
    //   derived from the FIRST and SECOND options respectively (not hardcoded)
    // asset_price — real external asset price (USD) at this moment, only
    //   set for markets with markets.price_asset_id configured
    await tx.exec(`
      CREATE TABLE IF NOT EXISTS market_price_history (
        id            SERIAL PRIMARY KEY,
        market_id     INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
        probabilities TEXT    NOT NULL,
        yes_price     REAL,
        no_price      REAL,
        trade_volume  REAL    NOT NULL DEFAULT 0,
        asset_price   REAL,
        recorded_at   TEXT    NOT NULL DEFAULT ${NOW_DEFAULT}
      )
    `);

    // ── Wallets ────────────────────────────────────────────────────────────
    // One row per linked wallet. A user can have multiple (future multi-chain
    // support) but today wallet auth creates exactly one, marked is_primary.
    await tx.exec(`
      CREATE TABLE IF NOT EXISTS wallets (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        chain      TEXT NOT NULL DEFAULT 'evm',
        address    CITEXT NOT NULL UNIQUE,
        is_primary INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT ${NOW_DEFAULT}
      )
    `);
    await tx.exec(`
      CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id)
    `);

    // ── Deposit addresses ─────────────────────────────────────────────────────
    // One derived Polygon address per user, generated from TREASURY_XPUB
    // (see depositService.ts) — derivation_index = user_id, so the address
    // is watch-only-derivable from the public xpub alone, no private key
    // ever touches this server.
    await tx.exec(`
      CREATE TABLE IF NOT EXISTS deposit_addresses (
        id               SERIAL PRIMARY KEY,
        user_id          INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        address          CITEXT NOT NULL UNIQUE,
        derivation_index INTEGER NOT NULL UNIQUE,
        chain            TEXT NOT NULL DEFAULT 'polygon',
        created_at       TEXT NOT NULL DEFAULT ${NOW_DEFAULT}
      )
    `);

    // ── Withdrawal requests ───────────────────────────────────────────────────
    // The balance is debited the moment a request is created (see
    // withdrawalService.ts) — status tracks the request's lifecycle, not
    // whether the user's internal balance reflects it yet, which it always
    // does immediately. tx_hash is filled in once an admin marks the payout
    // as actually sent (completeWithdrawal). resolved_by tracks which admin
    // took the approve/reject/complete action — an audit trail, since more
    // than one admin account can exist and real money moves on this action.
    await tx.exec(`
      CREATE TABLE IF NOT EXISTS withdrawal_requests (
        id                   SERIAL PRIMARY KEY,
        user_id              INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount               REAL NOT NULL,
        destination_address  CITEXT NOT NULL,
        chain                TEXT NOT NULL DEFAULT 'polygon',
        status               TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected | completed
        admin_note           TEXT,
        tx_hash              TEXT,
        created_at           TEXT NOT NULL DEFAULT ${NOW_DEFAULT},
        resolved_at          TEXT,
        resolved_by          INTEGER REFERENCES users(id)
      )
    `);
    await tx.exec(`
      CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON withdrawal_requests(status)
    `);
    await tx.exec(`
      CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user_id ON withdrawal_requests(user_id)
    `);

    // ── Wallet sign-in nonces ────────────────────────────────────────────────
    // One-time challenges for the connect-wallet handshake. Issued by
    // POST /api/auth/wallet/nonce, consumed by POST /api/auth/wallet/verify.
    await tx.exec(`
      CREATE TABLE IF NOT EXISTS wallet_nonces (
        id         SERIAL PRIMARY KEY,
        address    CITEXT NOT NULL,
        nonce      TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        used       INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT ${NOW_DEFAULT}
      )
    `);
    await tx.exec(`
      CREATE INDEX IF NOT EXISTS idx_wallet_nonces_address ON wallet_nonces(address)
    `);

    // ── Ledger entries ───────────────────────────────────────────────────────
    // Append-only audit trail: one row per balance movement. balance_after
    // lets any entry be inspected in isolation without replaying history.
    // amount is signed — positive credits the user, negative debits them.
    // idempotency_key is unused today; reserved for Milestone 5 (crypto
    // deposits), where a webhook firing twice must not double-credit.
    await tx.exec(`
      CREATE TABLE IF NOT EXISTS ledger_entries (
        id               SERIAL PRIMARY KEY,
        user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type             TEXT    NOT NULL,
        amount           REAL    NOT NULL,
        balance_after    REAL    NOT NULL,
        market_id        INTEGER REFERENCES markets(id) ON DELETE SET NULL,
        trade_id         INTEGER REFERENCES trades(id) ON DELETE SET NULL,
        idempotency_key  TEXT    UNIQUE,
        note             TEXT,
        created_at       TEXT    NOT NULL DEFAULT ${NOW_DEFAULT}
      )
    `);
    await tx.exec(`
      CREATE INDEX IF NOT EXISTS idx_ledger_user_id ON ledger_entries(user_id)
    `);

    // One-time backfill: give every existing user with a nonzero balance a
    // starting entry, so sum(ledger_entries.amount) == users.balance holds
    // from this point forward without fabricating pre-ledger trade history.
    const ledgerCount = await tx.prepare<{ c: string }>('SELECT COUNT(*) as c FROM ledger_entries').get();
    if (Number(ledgerCount?.c ?? 0) === 0) {
      const usersWithBalance = await tx.prepare<{ id: number; balance: number }>(
        'SELECT id, balance FROM users WHERE balance != 0',
      ).all();
      for (const u of usersWithBalance) {
        await tx.prepare(`
          INSERT INTO ledger_entries (user_id, type, amount, balance_after, note)
          VALUES (?, 'balance_carryforward', ?, ?, 'Balance recorded before ledger tracking began')
        `).run(u.id, u.balance, u.balance);
      }
    }

    // ── Email verifications ────────────────────────────────────────────────
    // Stores 6-digit OTP codes for email verification.
    // expires_at — 15 minutes from creation
    // used       — 1 after the code has been consumed
    await tx.exec(`
      CREATE TABLE IF NOT EXISTS email_verifications (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        code       TEXT    NOT NULL,
        expires_at TEXT    NOT NULL,
        used       INTEGER NOT NULL DEFAULT 0,
        created_at TEXT    NOT NULL DEFAULT ${NOW_DEFAULT}
      )
    `);
    await tx.exec(`
      CREATE INDEX IF NOT EXISTS idx_ev_user_id ON email_verifications(user_id)
    `);

    // ── Hero slides ───────────────────────────────────────────────────────────
    // Standalone promotional slides for the homepage carousel — not linked
    // to any market. Mixed with featured markets in GET /api/slides.
    await tx.exec(`
      CREATE TABLE IF NOT EXISTS hero_slides (
        id            SERIAL PRIMARY KEY,
        title         TEXT NOT NULL,
        subtitle      TEXT,
        tag           TEXT,
        cta_label     TEXT,
        cta_href      TEXT,
        banner_image  TEXT,
        accent_color  TEXT NOT NULL DEFAULT '#6c63ff',
        gradient      TEXT,
        slide_order   INT NOT NULL DEFAULT 0,
        active        BOOLEAN NOT NULL DEFAULT true,
        created_at    TEXT NOT NULL DEFAULT ${NOW_DEFAULT}
      )
    `);

    // ── Promo slides ──────────────────────────────────────────────────────────
    // Canonical promotional slides table with spec-aligned column names.
    // hero_slides is kept for backward compat but promo_slides is the
    // primary table used by all routes going forward.
    await tx.exec(`
      CREATE TABLE IF NOT EXISTS promo_slides (
        id            SERIAL PRIMARY KEY,
        slide_order   INT NOT NULL DEFAULT 0,
        tag           TEXT,
        headline      TEXT,
        subheadline   TEXT,
        cta_text      TEXT,
        cta_href      TEXT,
        banner_image  TEXT,
        accent_color  TEXT NOT NULL DEFAULT '#6c63ff',
        active        BOOLEAN NOT NULL DEFAULT true,
        created_at    TEXT NOT NULL DEFAULT ${NOW_DEFAULT}
      )
    `);
    const marketCols = await columnsOf(tx, 'markets');
    if (!marketCols.includes('banner'))             await tx.exec(`ALTER TABLE markets ADD COLUMN banner TEXT`);
    if (!marketCols.includes('resolution_source'))   await tx.exec(`ALTER TABLE markets ADD COLUMN resolution_source TEXT`);
    if (!marketCols.includes('platform_fee'))        await tx.exec(`ALTER TABLE markets ADD COLUMN platform_fee REAL`);
    if (!marketCols.includes('prize_pool'))           await tx.exec(`ALTER TABLE markets ADD COLUMN prize_pool REAL`);
    if (!marketCols.includes('price_asset_id'))       await tx.exec(`ALTER TABLE markets ADD COLUMN price_asset_id TEXT`);
    if (!marketCols.includes('price_asset_symbol'))   await tx.exec(`ALTER TABLE markets ADD COLUMN price_asset_symbol TEXT`);
    if (!marketCols.includes('opening_price'))        await tx.exec(`ALTER TABLE markets ADD COLUMN opening_price REAL`);
    if (!marketCols.includes('resolved_by'))          await tx.exec(`ALTER TABLE markets ADD COLUMN resolved_by INTEGER REFERENCES users(id)`);
    if (!marketCols.includes('featured'))             await tx.exec(`ALTER TABLE markets ADD COLUMN featured BOOLEAN NOT NULL DEFAULT false`);
    if (!marketCols.includes('featured_order'))       await tx.exec(`ALTER TABLE markets ADD COLUMN featured_order INT NOT NULL DEFAULT 0`);
    if (!marketCols.includes('hero_tag'))             await tx.exec(`ALTER TABLE markets ADD COLUMN hero_tag TEXT`);
    if (!marketCols.includes('hero_sub'))             await tx.exec(`ALTER TABLE markets ADD COLUMN hero_sub TEXT`);
    if (!marketCols.includes('hero_accent'))          await tx.exec(`ALTER TABLE markets ADD COLUMN hero_accent TEXT`);
    if (!marketCols.includes('hero_banner'))          await tx.exec(`ALTER TABLE markets ADD COLUMN hero_banner TEXT`);
    if (!marketCols.includes('hero_href'))            await tx.exec(`ALTER TABLE markets ADD COLUMN hero_href TEXT`);

    const withdrawalCols = await columnsOf(tx, 'withdrawal_requests');
    if (!withdrawalCols.includes('resolved_by')) await tx.exec(`ALTER TABLE withdrawal_requests ADD COLUMN resolved_by INTEGER REFERENCES users(id)`);

    const marketOutcomeCols = await columnsOf(tx, 'market_outcomes');
    if (!marketOutcomeCols.includes('result')) await tx.exec(`ALTER TABLE market_outcomes ADD COLUMN result TEXT`);

    const priceHistoryCols = await columnsOf(tx, 'market_price_history');
    if (!priceHistoryCols.includes('asset_price')) await tx.exec(`ALTER TABLE market_price_history ADD COLUMN asset_price REAL`);

    const tradeCols = await columnsOf(tx, 'trades');
    if (!tradeCols.includes('payout_amount'))  await tx.exec(`ALTER TABLE trades ADD COLUMN payout_amount REAL`);
    if (!tradeCols.includes('locked_payout'))  await tx.exec(`ALTER TABLE trades ADD COLUMN locked_payout REAL`);
    if (!tradeCols.includes('settled_at'))     await tx.exec(`ALTER TABLE trades ADD COLUMN settled_at TEXT`);

    const userCols = await columnsOf(tx, 'users');
    if (!userCols.includes('is_verified')) await tx.exec(`ALTER TABLE users ADD COLUMN is_verified INTEGER NOT NULL DEFAULT 0`);

    // ── Indexes ────────────────────────────────────────────────────────────
    await tx.exec(`
      CREATE INDEX IF NOT EXISTS idx_trades_user_id        ON trades(user_id);
      CREATE INDEX IF NOT EXISTS idx_trades_market_id      ON trades(market_id);
      CREATE INDEX IF NOT EXISTS idx_markets_status        ON markets(status);
      CREATE INDEX IF NOT EXISTS idx_markets_category      ON markets(category);
      CREATE INDEX IF NOT EXISTS idx_outcomes_market_id    ON market_outcomes(market_id);
      CREATE INDEX IF NOT EXISTS idx_price_history_market  ON market_price_history(market_id);
      CREATE INDEX IF NOT EXISTS idx_price_history_time    ON market_price_history(market_id, recorded_at);
    `);

  });

  console.log('✓ Schema applied');
}
