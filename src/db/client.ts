import { Pool, PoolClient } from 'pg';
import config from '../config';

// Reusable fragment producing the same "YYYY-MM-DD HH:MM:SS" UTC string
// SQLite's datetime('now') used to produce — every existing TEXT timestamp
// column, and every string-comparison/parseApiDate() call site downstream,
// keeps working unchanged against this format.
export const SQL_NOW = "to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')";

// SQLite's `datetime('now', '<offset>')` (e.g. '-48 hours', '+5 minutes')
// becomes NOW() +/- an INTERVAL. Pass the same offset text minus its sign;
// `sign` picks + or -.
export function sqlNowOffset(sign: '+' | '-', intervalParamIndex: number): string {
  return `to_char((NOW() AT TIME ZONE 'UTC') ${sign} $${intervalParamIndex}::interval, 'YYYY-MM-DD HH24:MI:SS')`;
}

interface RunResult {
  changes: number;
  lastInsertRowid?: number;
}

interface PreparedQuery<Row = unknown> {
  get(...params: unknown[]): Promise<Row | undefined>;
  all(...params: unknown[]): Promise<Row[]>;
  run(...params: unknown[]): Promise<RunResult>;
}

interface Queryable {
  query(sql: string, params?: unknown[]): Promise<{ rows: unknown[]; rowCount: number | null }>;
}

// Translates SQLite's positional `?` placeholders to Postgres's `$1, $2, ...`
// so the ~90 existing call sites' SQL text doesn't need per-query rewriting.
function toPgSql(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

// This machine's path to Neon has been observed flapping mid-session, not
// just at startup (already handled by connectWithRetry in index.ts) — a
// live request can hit a transient connect failure too. Retrying is only
// safe once we know the query never reached the server, which is exactly
// what a connect-stage failure (never got as far as sending SQL) tells us —
// true regardless of whether the query was a read or a write.
function isConnectionEstablishmentError(err: unknown): boolean {
  const e = err as { code?: string; errors?: unknown[] };
  if (e?.code && ['ETIMEDOUT', 'ECONNREFUSED', 'ENETUNREACH', 'ENOTFOUND', 'EHOSTUNREACH'].includes(e.code)) {
    return true;
  }
  // Node's happy-eyeballs connect wraps multiple per-address failures in an
  // AggregateError — retryable if every one of them is connect-stage.
  if (Array.isArray(e?.errors)) {
    return e.errors.every(isConnectionEstablishmentError);
  }
  return false;
}

// A connection that existed and then dropped mid-flight is ambiguous — the
// statement may already have reached (and committed on) the server before
// the response was lost. Safe to retry for reads (re-running a SELECT is
// harmless); NOT safe to retry for writes (could double-apply an
// INSERT/UPDATE), so this is only opted into by .get/.all below.
function isDroppedConnectionError(err: unknown): boolean {
  const message = (err as { message?: string })?.message ?? '';
  return message.includes('Connection terminated');
}

async function withRetry<T>(fn: () => Promise<T>, allowDroppedConnectionRetry: boolean): Promise<T> {
  const delaysMs = [300, 800];
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const retryable = isConnectionEstablishmentError(err)
        || (allowDroppedConnectionRetry && isDroppedConnectionError(err));
      if (!retryable || attempt >= delaysMs.length) throw err;
      await new Promise((r) => setTimeout(r, delaysMs[attempt]));
    }
  }
}

// Wraps either the shared pool (no transaction) or a single checked-out
// client (inside db.transaction()) behind the same .prepare(sql).get/.all/.run
// shape better-sqlite3 used — only `await` needs adding at call sites.
// `retryable` is only true for the top-level pool — queries inside an open
// transaction must fail fast and let the transaction's own ROLLBACK handle
// it, rather than silently retrying one statement mid-transaction.
function makeDb(queryable: Queryable, retryable: boolean) {
  function prepare<Row = unknown>(sql: string): PreparedQuery<Row> {
    const pgSql = toPgSql(sql);
    return {
      async get(...params: unknown[]) {
        const run = async () => {
          const res = await queryable.query(pgSql, params);
          return res.rows[0] as Row | undefined;
        };
        return retryable ? withRetry(run, true) : run();
      },
      async all(...params: unknown[]) {
        const run = async () => {
          const res = await queryable.query(pgSql, params);
          return res.rows as Row[];
        };
        return retryable ? withRetry(run, true) : run();
      },
      async run(...params: unknown[]) {
        const run = async () => {
          const res = await queryable.query(pgSql, params);
          const row = res.rows?.[0] as { id?: number } | undefined;
          return { changes: res.rowCount ?? 0, lastInsertRowid: row?.id };
        };
        // Writes: only the connect-stage-failure branch of withRetry can
        // ever fire here, since allowDroppedConnectionRetry is false.
        return retryable ? withRetry(run, false) : run();
      },
    };
  }

  async function exec(sql: string): Promise<void> {
    const run = () => queryable.query(sql).then(() => undefined);
    return retryable ? withRetry(run, false) : run();
  }

  return { prepare, exec };
}

if (!config.databaseUrl) {
  throw new Error('DATABASE_URL must be set (Postgres connection string).');
}

const pool = new Pool({
  connectionString: config.databaseUrl,
  // TCP keepalive stops idle connections from being silently dropped by a
  // NAT/firewall along the path to Neon — without it, the next query after
  // any idle gap has to renegotiate a fresh TLS handshake before it can even
  // run, which is the slow, occasionally-timing-out behavior seen this session.
  keepAlive: true,
  // Fail a bad connection attempt in 8s instead of hanging on the OS-default
  // timeout (which can run 20-30s+ on Windows) — turns a stuck request into
  // a fast, visible error instead of a long silent wait.
  connectionTimeoutMillis: 8000,
});

try {
  console.log(`✓ Database configured: Postgres (${new URL(config.databaseUrl).hostname})`);
} catch {
  console.log('✓ Database configured: Postgres');
}

const poolDb = makeDb(pool, true);

export type TxDb = ReturnType<typeof makeDb>;

// Runs fn on a single checked-out client wrapped in BEGIN/COMMIT/ROLLBACK —
// callers must use the `tx` passed in (not the outer `db`) for every query,
// otherwise queries would run on unrelated pool connections and not be atomic.
async function transaction<T>(fn: (tx: TxDb) => Promise<T>): Promise<T> {
  const client: PoolClient = await pool.connect();
  const tx = makeDb(client, false);
  try {
    await client.query('BEGIN');
    const result = await fn(tx);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

const db = {
  prepare: poolDb.prepare,
  exec: poolDb.exec,
  transaction,
};

export default db;
