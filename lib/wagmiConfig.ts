import { http, createConfig } from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";
import { injected, coinbaseWallet, walletConnect } from "wagmi/connectors";

// Set after creating a free project at https://cloud.reown.com — required
// only for the WalletConnect (QR code) connector. MetaMask and Coinbase
// Wallet work without it.
export const WALLETCONNECT_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

// Sepolia is listed alongside mainnet so real wallets (MetaMask, Coinbase,
// Phantom) can connect on a free testnet while we test the sign-in flow —
// no mainnet chain has been committed to yet for real deposits (Milestone 5).
export const wagmiConfig = createConfig({
  chains: [mainnet, sepolia],
  connectors: [
    injected({ target: "metaMask" }),
    coinbaseWallet({ appName: "OutcomX" }),
    // Phantom's EVM provider (window.phantom.ethereum) — separate from its
    // Solana provider (window.solana). This only covers EVM chains; full
    // Solana support (SIWS, a separate wallets.chain row type) is a later,
    // bigger milestone.
    injected({ target: "phantom" }),
    ...(WALLETCONNECT_PROJECT_ID
      ? [walletConnect({ projectId: WALLETCONNECT_PROJECT_ID, showQrModal: true })]
      : []),
  ],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
  },
});
