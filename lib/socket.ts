// ── OUTCOMX Real-Time Client ────────────────────────────────────────────────
// One shared connection for the whole app, replacing the 30s/3s/5s polling
// loops that used to live in individual components. Public events (trades,
// settlements, closes, price ticks) are broadcast to every client and
// filtered by marketId in each listener; the private per-user
// "trade:settled" event only reaches this socket if connect() was called
// with a valid JWT, since the backend joins it to a user-specific room.

import { io, Socket } from "socket.io-client";
import { getToken } from "./api";

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket) return socket;

  socket = io(SOCKET_URL, {
    autoConnect: true,
    auth: (cb) => cb({ token: getToken() ?? undefined }),
  });

  return socket;
}

// Call after login/logout so the next reconnect carries the current auth
// state — socket.io re-runs the `auth` callback above on every reconnect,
// but an already-open connection needs an explicit kick to re-handshake.
export function reconnectSocketAuth(): void {
  if (!socket) return;
  socket.disconnect().connect();
}
