// 1. Load dotenv first — before any other imports that read process.env
import dotenv from 'dotenv';
dotenv.config();

// 2. Validate config (throws if JWT_SECRET missing or < 32 chars)
import config from './config';

// 3. Connect SQLite
import db from './db/client';

// 4. Apply schema
import { applySchema } from './db/schema';
applySchema();

// 5. Run seed
import { runSeed } from './db/seed';

// 6. Express app + middleware
import express, { Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

// 7. Routes
import authRouter    from './routes/auth';
import marketsRouter from './routes/markets';
import tradesRouter  from './routes/trades';
import walletRouter  from './routes/wallet';
import adminRouter   from './routes/admin/index';

// 8. Error handler (must be last)
import { errorHandler } from './middleware/errorHandler';

async function bootstrap(): Promise<void> {
  // Run seed (no-op if data already exists)
  await runSeed();

  const app = express();

  // ── Security middleware ──────────────────────────────────────────────────
  app.use(helmet());

  app.use(
    cors({
      origin: config.allowedOrigins,
      credentials: true,
      allowedHeaders: ['Authorization', 'Content-Type'],
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    }),
  );

  // ── Body parsing ─────────────────────────────────────────────────────────
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // ── General rate limiter: 200 req/min per IP ─────────────────────────────
  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      max: 200,
      standardHeaders: true,
      legacyHeaders: false,
      message: { success: false, error: 'Too many requests, please slow down' },
    }),
  );

  // ── Routes ────────────────────────────────────────────────────────────────
  app.use('/api/auth',    authRouter);
  app.use('/api/markets', marketsRouter);
  app.use('/api/trades',  tradesRouter);
  app.use('/api/wallet',  walletRouter);
  app.use('/api/admin',   adminRouter);

  // ── Health check ──────────────────────────────────────────────────────────
  app.get('/api/health', (_req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      data: {
        status: 'ok',
        environment: config.nodeEnv,
        timestamp: new Date().toISOString(),
      },
    });
  });

  // ── Global error handler (must be last) ───────────────────────────────────
  app.use(errorHandler);

  // ── Start server ──────────────────────────────────────────────────────────
  app.listen(config.port, () => {
    console.log(`✓ OUTCOMX API running → http://localhost:${config.port}`);
    console.log(`✓ Environment: ${config.nodeEnv}`);
  });
}

bootstrap().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
