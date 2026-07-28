import dotenv from 'dotenv';
dotenv.config();

const jwtSecret = process.env.JWT_SECRET ?? '';
if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error(
    'JWT_SECRET must be set and at least 32 characters long. ' +
    'Current length: ' + jwtSecret.length,
  );
}

const config = {
  port:           parseInt(process.env.PORT ?? '4000', 10),
  nodeEnv:        process.env.NODE_ENV ?? 'development',
  jwtSecret,
  jwtExpiresIn:   process.env.JWT_EXPIRES_IN ?? '24h',
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000,http://localhost:3002').split(','),
  dbPath:         process.env.DB_PATH ?? './outcomx.db',
  databaseUrl:    process.env.DATABASE_URL ?? '',
  bcryptRounds:   parseInt(process.env.BCRYPT_ROUNDS ?? '12', 10),
  isDevelopment:  (process.env.NODE_ENV ?? 'development') === 'development',
  isProduction:   process.env.NODE_ENV === 'production',

  // Email — Resend
  resendApiKey: process.env.RESEND_API_KEY ?? '',
  fromEmail:    process.env.FROM_EMAIL    ?? 'onboarding@resend.dev',
  appName:      process.env.APP_NAME      ?? 'OUTCOMX',

  // Crypto deposits — soft-optional like resendApiKey above: an empty value
  // here shouldn't crash the whole server (existing trading/markets don't
  // depend on it), just disable the deposit-address feature until set.
  // depositService throws a clear error if a deposit-address request comes
  // in while these are unset, rather than failing silently.
  alchemyApiKey: process.env.ALCHEMY_API_KEY ?? '',
  treasuryXpub:  process.env.TREASURY_XPUB   ?? '',
  // Per-webhook signing key, shown once when the webhook is created in
  // Alchemy's dashboard — verifies incoming POSTs are genuinely from
  // Alchemy, not someone else hitting our public endpoint to fake a deposit.
  alchemyWebhookSigningKey: process.env.ALCHEMY_WEBHOOK_SIGNING_KEY ?? '',
  // Account-level Notify API credentials — separate from alchemyApiKey
  // above (which only makes JSON-RPC calls). These let the server register
  // each new deposit address with the webhook automatically instead of
  // requiring a manual dashboard edit per user. Soft-optional like the
  // rest of this block: unset just means new addresses fall back to being
  // picked up by reconcileDeposits() instead of getting instant pushes.
  alchemyAuthToken: process.env.ALCHEMY_AUTH_TOKEN ?? '',
  alchemyWebhookId: process.env.ALCHEMY_WEBHOOK_ID ?? '',
} as const;

export default config;
