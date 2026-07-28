// 1. Load dotenv first — before any other imports that read process.env
import dotenv from 'dotenv';
dotenv.config();

// 2. Validate config (throws if JWT_SECRET missing or < 32 chars)
import config from './config';

// 3. Connect Postgres
import db from './db/client';

// 4. Apply schema
import { applySchema } from './db/schema';

// 5. Run seed
import { runSeed } from './db/seed';
import { createMarketHistorySnapshot } from './services/marketHistoryService';
import { runPriceTick } from './services/priceTickService';
import { reconcileDeposits } from './services/depositService';

// 6. Express app + middleware
import http from 'http';
import express, { Request, Response } from 'express';
// Patches Express's router so rejected promises in async route handlers and
// middleware reach errorHandler via next(err) — without this, Express 4
// lets an async rejection crash the whole process instead of returning a
// 500. Matters much more now than under SQLite: a transient Postgres
// network hiccup is a real, if rare, occurrence a local file never had.
import 'express-async-errors';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

// 7. Routes
import authRouter    from './routes/auth';
import marketsRouter from './routes/markets';
import tradesRouter  from './routes/trades';
import walletRouter  from './routes/wallet';
import adminRouter   from './routes/admin/index';
import webhooksRouter from './routes/webhooks';
import slidesRouter  from './routes/slides';

// 8. Error handler (must be last)
import { errorHandler } from './middleware/errorHandler';

// 9. Real-time gateway
import { initSocket } from './socket';

// This machine's network path to Neon has been observed flapping on a
// scale of single-digit seconds (connects, then drops, repeatedly) rather
// than being cleanly up or down — a fixed number of retries with a fixed
// delay give the best chance of landing in one of those open windows,
// instead of crashing the whole process on whichever moment happened to
// be bad.
async function connectWithRetry(maxAttempts = 40, delayMs = 3000): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await applySchema();
      await runSeed();
      return;
    } catch (err) {
      const message = (err as Error).message;
      console.error(`✗ Startup DB attempt ${attempt}/${maxAttempts} failed: ${message}`);
      if (attempt === maxAttempts) throw err;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

async function bootstrap(): Promise<void> {
  // Apply schema, then seed (no-op if data already exists)
  await connectWithRetry();

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
  // The `verify` callback stashes the raw bytes on the request — needed by
  // the Alchemy webhook route, which HMACs the raw body, not the
  // re-serialized JSON (those can differ in whitespace/key order and would
  // break signature verification).
  app.use(express.json({
    limit: '10mb',
    verify: (req, _res, buf) => { (req as Request & { rawBody?: Buffer }).rawBody = buf; },
  }));
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
  app.use('/api/webhooks', webhooksRouter);
  app.use('/api/slides',       slidesRouter);
  app.use('/api/hero-slides',  slidesRouter); // alias � frontend calls this

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

  // ── Heartbeat snapshots ──────────────────────────────────────────────────
  // Keeps quiet markets' price history populated with real (flat) data
  // points even when no trades occur, so charts never need fabricated data.
  const SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
  setInterval(() => { createMarketHistorySnapshot().catch(err => console.error('Snapshot failed:', err)); }, SNAPSHOT_INTERVAL_MS);

  // ── Live price ticks ──────────────────────────────────────────────────────
  // Records real asset prices for live-price markets and auto-resolves them
  // at expiry. One batched CoinGecko call per tick regardless of how many
  // live-price markets are open — see priceFeedService.ts.
  const PRICE_TICK_INTERVAL_MS = 15 * 1000; // 15 seconds
  setInterval(() => { runPriceTick().catch(err => console.error('Price tick failed:', err)); }, PRICE_TICK_INTERVAL_MS);

  // ── Crypto deposit reconciliation ──────────────────────────────────────────
  // Safety net for the Alchemy webhook — polls the chain directly for any
  // deposit that never arrived via webhook. No-ops instantly if deposits
  // aren't configured (empty ALCHEMY_API_KEY).
  const DEPOSIT_RECONCILE_INTERVAL_MS = 60 * 1000; // 60 seconds
  setInterval(() => { reconcileDeposits().catch(err => console.error('Deposit reconciliation failed:', err)); }, DEPOSIT_RECONCILE_INTERVAL_MS);

  // ── Start server ──────────────────────────────────────────────────────────
  // Plain http.Server instead of app.listen() directly — Socket.IO attaches
  // to the underlying server, not to the Express app.
  const server = http.createServer(app);
  initSocket(server);

  server.listen(config.port, () => {
    console.log(`✓ OUTCOMX API running → http://localhost:${config.port}`);
    console.log(`✓ Environment: ${config.nodeEnv}`);
    console.log(`✓ Market history heartbeat: every ${SNAPSHOT_INTERVAL_MS / 60000}min`);
    console.log(`✓ Live price tick: every ${PRICE_TICK_INTERVAL_MS / 1000}s`);
    console.log(`✓ Deposit reconciliation: every ${DEPOSIT_RECONCILE_INTERVAL_MS / 1000}s`);
    console.log(`✓ Real-time gateway: Socket.IO attached`);
  });
}

bootstrap().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
