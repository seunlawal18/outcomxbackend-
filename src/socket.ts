// ─── OUTCOMX Real-Time Gateway ─────────────────────────────────────────────
//
// Subscribes to the existing in-process event bus (events.ts) and forwards
// each event over Socket.IO, replacing what used to be 3s/5s/30s frontend
// polling loops. Market-level events (trades, settlement summaries, closes,
// price ticks) carry no user-identifying data, so they're broadcast to every
// connected client — the frontend filters by marketId itself, which is
// simpler than server-side room management at this traffic volume.
//
// The one event that DOES carry user-identifying data is a settlement's
// per-trade results (who won/lost and how much) — that's never broadcast.
// Each affected user gets their own result pushed to a private room they
// join by presenting their JWT at connect time.

import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import config from './config';
import { emitter } from './events';
import { verifyAuthToken } from './middleware/auth';

export function initSocket(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: config.allowedOrigins,
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    // Optional — anonymous connections are fine for public market data.
    // Only the private per-user trade:settled push requires this.
    const token = socket.handshake.auth?.token as string | undefined;
    if (token) {
      verifyAuthToken(token)
        .then((user) => {
          if (user) socket.join(`user:${user.id}`);
        })
        .catch(() => {
          // Invalid/expired token — leave the socket in the anonymous state
          // rather than disconnecting; the user simply won't get private
          // settlement pushes until they reconnect with a fresh token.
        });
    }
  });

  emitter.on('trade:placed', (payload) => {
    io.emit('trade:placed', payload);
  });

  emitter.on('market:closed', (payload) => {
    io.emit('market:closed', payload);
  });

  emitter.on('price:tick', (payload) => {
    io.emit('price:tick', payload);
  });

  emitter.on('withdrawal:updated', (payload) => {
    io.to(`user:${payload.userId}`).emit('withdrawal:updated', payload);
  });

  emitter.on('market:settled', (payload) => {
    // Public summary — no per-trade user data.
    io.emit('market:settled', {
      marketId:     payload.marketId,
      marketTitle:  payload.marketTitle,
      result:       payload.result,
      settledCount: payload.settledCount,
      timestamp:    payload.timestamp,
    });

    // Private per-user results — targeted, never broadcast.
    for (const trade of payload.trades) {
      io.to(`user:${trade.userId}`).emit('trade:settled', {
        tradeId:      trade.tradeId,
        marketId:     payload.marketId,
        marketTitle:  payload.marketTitle,
        status:       trade.status,
        payoutAmount: trade.payoutAmount,
      });
    }
  });

  return io;
}
