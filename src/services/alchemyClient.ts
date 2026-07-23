// ─── Alchemy JSON-RPC client ────────────────────────────────────────────────
//
// Thin wrapper — one API key works across networks, only the URL subdomain
// changes. ALCHEMY_NETWORK controls which one we talk to (defaults to the
// Amoy testnet, matching where deposit testing currently happens; switch to
// 'polygon-mainnet' when going live).

import config from '../config';

const ALCHEMY_NETWORK = process.env.ALCHEMY_NETWORK ?? 'polygon-amoy';

function alchemyUrl(): string {
  return `https://${ALCHEMY_NETWORK}.g.alchemy.com/v2/${config.alchemyApiKey}`;
}

async function alchemyRpc<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch(alchemyUrl(), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: 1, jsonrpc: '2.0', method, params }),
  });
  const json = await res.json() as { result?: T; error?: { message: string } };
  if (json.error) throw new Error(`Alchemy RPC error (${method}): ${json.error.message}`);
  return json.result as T;
}

export interface AssetTransfer {
  hash: string;
  asset: string | null;
  value: number | null;
  rawContract: { address: string | null; decimal: string | null };
}

// Incoming ERC20 transfers to a single address, filtered to a known set of
// token contracts. One call per address — fine at current scale (a handful
// of deposit addresses); worth batching differently if this ever needs to
// watch thousands of addresses per poll.
export async function getIncomingTokenTransfers(
  toAddress: string,
  contractAddresses: string[],
): Promise<AssetTransfer[]> {
  if (contractAddresses.length === 0) return [];
  const result = await alchemyRpc<{ transfers: AssetTransfer[] }>('alchemy_getAssetTransfers', [{
    toAddress,
    category: ['erc20'],
    contractAddresses,
    excludeZeroValue: true,
    withMetadata: false,
  }]);
  return result.transfers ?? [];
}

// Maps our config's polygon network name to the label Alchemy's Address
// Activity webhook payloads use for `event.network` — keeps the
// reconciliation job's contract lookups consistent with the webhook path.
export function alchemyNetworkLabel(): string {
  return ALCHEMY_NETWORK === 'polygon-mainnet' ? 'MATIC_MAINNET' : 'MATIC_AMOY';
}

// How many blocks have confirmed a transaction — 0 if not yet mined. Used
// to gate crediting a deposit until it's reorg-safe (see MIN_CONFIRMATIONS
// in depositService.ts): neither the webhook nor the reconciliation poller
// trust their own timing, both independently ask the chain.
export async function getConfirmations(txHash: string): Promise<number> {
  const [receipt, currentBlockHex] = await Promise.all([
    alchemyRpc<{ blockNumber: string | null } | null>('eth_getTransactionReceipt', [txHash]),
    alchemyRpc<string>('eth_blockNumber', []),
  ]);
  if (!receipt?.blockNumber) return 0; // not yet mined
  const txBlock = parseInt(receipt.blockNumber, 16);
  const currentBlock = parseInt(currentBlockHex, 16);
  return currentBlock - txBlock + 1;
}

// ─── Webhook address management (Notify API) ──────────────────────────────
// A completely separate Alchemy API from the JSON-RPC calls above — this
// one manages *which addresses a webhook is subscribed to*, authenticated
// with an account-level Auth Token rather than the per-app API key.
const NOTIFY_BASE_URL = 'https://dashboard.alchemy.com/api';

interface AlchemyWebhook {
  id: string;
  network: string;
  webhook_type: string;
  webhook_url: string;
  is_active: boolean;
}

// Lists every webhook on the account — used one-off (see
// scripts/find-webhook-id.ts) to find the id of a webhook created by hand
// in the dashboard, since the dashboard UI doesn't show it directly.
export async function listWebhooks(): Promise<AlchemyWebhook[]> {
  const res = await fetch(`${NOTIFY_BASE_URL}/team-webhooks`, {
    headers: { 'X-Alchemy-Token': config.alchemyAuthToken },
  });
  if (!res.ok) throw new Error(`Alchemy list-webhooks failed (${res.status}): ${await res.text()}`);
  const json = await res.json() as { data: AlchemyWebhook[] };
  return json.data ?? [];
}

// Adds one address to an existing Address Activity webhook's watch list.
// Fire-and-forget from the caller's perspective (see depositService.ts) —
// if this fails or isn't configured, reconcileDeposits() still finds the
// deposit on its own within 60s, just without the instant push.
export async function addAddressToWebhook(address: string): Promise<void> {
  if (!config.alchemyAuthToken || !config.alchemyWebhookId) return;
  const res = await fetch(`${NOTIFY_BASE_URL}/update-webhook-addresses`, {
    method: 'PATCH',
    headers: {
      'X-Alchemy-Token': config.alchemyAuthToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      webhook_id: config.alchemyWebhookId,
      addresses_to_add: [address],
      addresses_to_remove: [],
    }),
  });
  if (!res.ok) throw new Error(`Alchemy add-webhook-address failed (${res.status}): ${await res.text()}`);
}
