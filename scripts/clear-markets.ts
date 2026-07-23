// One-off: wipe all markets (cascades to trades, market_outcomes,
// market_price_history; nulls ledger_entries.market_id/trade_id via
// ON DELETE SET NULL). Users/wallets/balances untouched.
import db from '../src/db/client';

async function run(maxAttempts = 10, delayMs = 3000): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await db.prepare('DELETE FROM markets').run();
      console.log(`✓ Deleted ${result.changes} market(s).`);
      process.exit(0);
    } catch (err) {
      console.error(`Attempt ${attempt}/${maxAttempts} failed: ${(err as Error).message}`);
      if (attempt === maxAttempts) throw err;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

run().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
