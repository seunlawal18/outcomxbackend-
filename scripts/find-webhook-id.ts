// One-time utility: lists every webhook on the Alchemy account and prints
// their ids — the dashboard UI doesn't show the id directly, and it's
// needed for ALCHEMY_WEBHOOK_ID so the server can auto-register new
// deposit addresses (see addAddressToWebhook in alchemyClient.ts).
//
//   npx tsx scripts/find-webhook-id.ts
//
// Requires ALCHEMY_AUTH_TOKEN to already be set in .env (Dashboard → Notify
// → "View Auth Token" — this is an account-level token, separate from the
// per-app ALCHEMY_API_KEY used for JSON-RPC calls).
import { listWebhooks } from '../src/services/alchemyClient';

listWebhooks().then((webhooks) => {
  if (webhooks.length === 0) {
    console.log('No webhooks found on this account.');
    return;
  }
  console.log(`\nFound ${webhooks.length} webhook(s):\n`);
  for (const w of webhooks) {
    console.log(`  id:      ${w.id}`);
    console.log(`  network: ${w.network}`);
    console.log(`  type:    ${w.webhook_type}`);
    console.log(`  url:     ${w.webhook_url}`);
    console.log(`  active:  ${w.is_active}`);
    console.log('');
  }
  console.log('Copy the id of the MATIC_MAINNET / Address Activity webhook into ALCHEMY_WEBHOOK_ID.\n');
}).catch((err) => {
  console.error('Failed to list webhooks:', err.message);
  process.exit(1);
});
