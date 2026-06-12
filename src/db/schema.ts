import db from './client';

export function applySchema(): void {
  db.transaction(() => {

    // ── Users ──────────────────────────────────────────────────────────────
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        email         TEXT UNIQUE NOT NULL COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        name          TEXT NOT NULL,
        username      TEXT UNIQUE NOT NULL COLLATE NOCASE,
        region        TEXT NOT NULL DEFAULT 'nigeria',
        balance       REAL NOT NULL DEFAULT 50000,
        is_admin      INTEGER NOT NULL DEFAULT 0,
        is_demo       INTEGER NOT NULL DEFAULT 0,
        bio           TEXT NOT NULL DEFAULT '',
        avatar        TEXT NOT NULL DEFAULT '',
        joined_at     TEXT NOT NULL DEFAULT (datetime('now')),
        created_at    TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // ── Markets ────────────────────────────────────────────────────────────
    // options       — JSON array of outcome labels (any strings, no hardcoding)
    // probabilities — JSON object { label: pct } summing to 100
    // resolution_source — optional URL or description of how market resolves
    // banner        — optional banner image URL (wider than square image)
    // platform_fee  — 3% fee deducted from total pool at settlement (null until settled)
    // prize_pool    — 97% of total pool distributed to winners (null until settled)
    db.exec(`
      CREATE TABLE IF NOT EXISTS markets (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        title             TEXT NOT NULL,
        category          TEXT NOT NULL,
        type              TEXT NOT NULL,
        options           TEXT NOT NULL,
        status            TEXT NOT NULL DEFAULT 'open',
        result            TEXT,
        volume            REAL NOT NULL DEFAULT 0,
        probabilities     TEXT NOT NULL,
        duration          TEXT NOT NULL,
        expires_at        TEXT NOT NULL,
        image             TEXT,
        banner            TEXT,
        resolution_source TEXT,
        platform_fee      REAL,
        prize_pool        REAL,
        trending          INTEGER NOT NULL DEFAULT 0,
        created_at        TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // ── Market outcomes ────────────────────────────────────────────────────
    // One row per outcome per market.
    // probability  — decimal 0.00–1.00 (e.g. 0.55 = 55%)
    // pool_amount  — total amount staked on this outcome (updated on every trade)
    // created_at   — auto-set on insert
    db.exec(`
      CREATE TABLE IF NOT EXISTS market_outcomes (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        market_id    INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
        label        TEXT NOT NULL,
        probability  REAL NOT NULL DEFAULT 0.5,
        pool_amount  REAL NOT NULL DEFAULT 0,
        created_at   TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // ── Trades ─────────────────────────────────────────────────────────────
    db.exec(`
      CREATE TABLE IF NOT EXISTS trades (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        market_id     INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
        market_title  TEXT NOT NULL,
        option        TEXT NOT NULL,
        amount        REAL NOT NULL,
        status        TEXT NOT NULL DEFAULT 'active',
        timestamp     TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // ── Token blacklist ────────────────────────────────────────────────────
    db.exec(`
      CREATE TABLE IF NOT EXISTS token_blacklist (
        token      TEXT PRIMARY KEY,
        expires_at TEXT NOT NULL
      )
    `);

    // ── Market price history ───────────────────────────────────────────────
    // One row per trade event.
    // probabilities — full JSON snapshot of all outcome probabilities
    // yes_price / no_price — convenience decimals for binary markets
    //   derived from the FIRST and SECOND options respectively (not hardcoded)
    db.exec(`
      CREATE TABLE IF NOT EXISTS market_price_history (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        market_id     INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
        probabilities TEXT    NOT NULL,
        yes_price     REAL,
        no_price      REAL,
        trade_volume  REAL    NOT NULL DEFAULT 0,
        recorded_at   TEXT    NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // ── Email verifications ────────────────────────────────────────────────
    // Stores 6-digit OTP codes for email verification.
    // expires_at — 15 minutes from creation
    // used       — 1 after the code has been consumed
    db.exec(`
      CREATE TABLE IF NOT EXISTS email_verifications (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        code       TEXT    NOT NULL,
        expires_at TEXT    NOT NULL,
        used       INTEGER NOT NULL DEFAULT 0,
        created_at TEXT    NOT NULL DEFAULT (datetime('now'))
      )
    `);
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_ev_user_id ON email_verifications(user_id)
    `);

    // ── Migrate existing tables — add new columns if they don't exist ──────
    const marketCols = (db.prepare('PRAGMA table_info(markets)').all() as { name: string }[]).map(c => c.name);
    if (!marketCols.includes('banner'))            db.exec(`ALTER TABLE markets ADD COLUMN banner TEXT`);
    if (!marketCols.includes('resolution_source')) db.exec(`ALTER TABLE markets ADD COLUMN resolution_source TEXT`);
    if (!marketCols.includes('platform_fee'))      db.exec(`ALTER TABLE markets ADD COLUMN platform_fee REAL`);
    if (!marketCols.includes('prize_pool'))        db.exec(`ALTER TABLE markets ADD COLUMN prize_pool REAL`);

    const tradeCols = (db.prepare('PRAGMA table_info(trades)').all() as { name: string }[]).map(c => c.name);
    if (!tradeCols.includes('payout_amount'))  db.exec(`ALTER TABLE trades ADD COLUMN payout_amount REAL`);
    if (!tradeCols.includes('locked_payout'))  db.exec(`ALTER TABLE trades ADD COLUMN locked_payout REAL`);

    const userCols = (db.prepare('PRAGMA table_info(users)').all() as { name: string }[]).map(c => c.name);
    if (!userCols.includes('is_verified')) db.exec(`ALTER TABLE users ADD COLUMN is_verified INTEGER NOT NULL DEFAULT 0`);

    // ── Indexes ────────────────────────────────────────────────────────────
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_trades_user_id        ON trades(user_id);
      CREATE INDEX IF NOT EXISTS idx_trades_market_id      ON trades(market_id);
      CREATE INDEX IF NOT EXISTS idx_markets_status        ON markets(status);
      CREATE INDEX IF NOT EXISTS idx_markets_category      ON markets(category);
      CREATE INDEX IF NOT EXISTS idx_outcomes_market_id    ON market_outcomes(market_id);
      CREATE INDEX IF NOT EXISTS idx_price_history_market  ON market_price_history(market_id);
      CREATE INDEX IF NOT EXISTS idx_price_history_time    ON market_price_history(market_id, recorded_at);
    `);

  })();

  console.log('✓ Schema applied');
}
