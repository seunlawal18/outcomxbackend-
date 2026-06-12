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
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000').split(','),
  dbPath:         process.env.DB_PATH ?? './outcomx.db',
  bcryptRounds:   parseInt(process.env.BCRYPT_ROUNDS ?? '12', 10),
  isDevelopment:  (process.env.NODE_ENV ?? 'development') === 'development',
  isProduction:   process.env.NODE_ENV === 'production',

  // Email — Resend
  resendApiKey: process.env.RESEND_API_KEY ?? '',
  fromEmail:    process.env.FROM_EMAIL    ?? 'onboarding@resend.dev',
  appName:      process.env.APP_NAME      ?? 'OUTCOMX',
} as const;

export default config;
