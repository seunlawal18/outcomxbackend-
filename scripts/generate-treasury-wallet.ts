// One-time, LOCAL-ONLY utility: generates a brand-new HD wallet dedicated to
// OutcomX's deposit-address derivation. Run this yourself, on your own
// machine.
//
//   npx tsx scripts/generate-treasury-wallet.ts
//
// The seed phrase this prints is the one piece that actually controls
// funds — write it on paper, store it offline, and never paste it
// anywhere, including back into a chat with Claude or anyone else. Only the
// xpub it also prints is meant to be shared; it can derive and watch
// addresses but cannot move money.
import { generateMnemonic, mnemonicToSeedSync } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { HDKey } from '@scure/bip32';
import { secp256k1 } from '@noble/curves/secp256k1';
import { publicKeyToAddress } from 'viem/utils';
import { bytesToHex } from 'viem';

// BIP44 path for EVM chains, stopping at the "account" level — everything
// past this point (the per-user index) is derived later from the xpub
// alone, no private key required.
const ACCOUNT_PATH = "m/44'/60'/0'";

function toEthAddress(node: HDKey): `0x${string}` {
  const uncompressed = secp256k1.ProjectivePoint.fromHex(node.publicKey!).toRawBytes(false);
  return publicKeyToAddress(bytesToHex(uncompressed));
}

const mnemonic = generateMnemonic(wordlist, 256); // 24 words
const seed     = mnemonicToSeedSync(mnemonic);
const account  = HDKey.fromMasterSeed(seed).derive(ACCOUNT_PATH);
const xpub     = account.publicExtendedKey;

// Sanity check — derive the first two deposit addresses exactly the way
// the server will later, from the xpub alone, to confirm it round-trips.
const fromXpub = HDKey.fromExtendedKey(xpub);
const addr0 = toEthAddress(fromXpub.deriveChild(0));
const addr1 = toEthAddress(fromXpub.deriveChild(1));

console.log('\n================ SECRET — write on paper, never digital, never shared ================');
console.log('Seed phrase:');
console.log(`\n  ${mnemonic}\n`);
console.log('========================================================================================\n');

console.log('================ SAFE TO SHARE — paste this back to Claude ================');
console.log('Derivation path:', ACCOUNT_PATH);
console.log('xpub:', xpub);
console.log('=============================================================================\n');

console.log('Sanity check — first two deposit addresses this xpub alone can derive:');
console.log('  user index 0:', addr0);
console.log('  user index 1:', addr1);
console.log('');
