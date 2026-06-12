/**
 * OUTCOMX Event Bus
 *
 * Lightweight in-process event emitter used to decouple the trade engine
 * from the transport layer. When WebSocket support is added, the WS server
 * simply subscribes to these events and broadcasts to connected clients.
 *
 * Current events:
 *   'trade:placed'   — fired after every successful trade
 *   'market:settled' — fired after a market is resolved
 *   'market:closed'  — fired when a market expires / is toggled closed
 *
 * Usage (future WebSocket server):
 *   import { emitter } from './events';
 *   emitter.on('trade:placed', (payload) => {
 *     wss.clients.forEach(client => client.send(JSON.stringify(payload)));
 *   });
 */

import { EventEmitter } from 'events';
import { ApiPricePoint } from './types';

export interface TradePlacedEvent {
  marketId:             number;
  updatedProbabilities: Record<string, number>;
  latestPrice:          ApiPricePoint;
  tradeVolume:          number;
  timestamp:            string;
}

export interface MarketSettledEvent {
  marketId:     number;
  result:       string;
  settledCount: number;
  timestamp:    string;
}

export interface MarketClosedEvent {
  marketId:  number;
  reason:    'expired' | 'manual';
  timestamp: string;
}

class OutcomxEmitter extends EventEmitter {
  tradePlaced(payload: TradePlacedEvent): void {
    this.emit('trade:placed', payload);
  }

  marketSettled(payload: MarketSettledEvent): void {
    this.emit('market:settled', payload);
  }

  marketClosed(payload: MarketClosedEvent): void {
    this.emit('market:closed', payload);
  }
}

// Singleton — import this anywhere in the app
export const emitter = new OutcomxEmitter();

// Increase max listeners to avoid Node.js warnings when many WS clients attach
emitter.setMaxListeners(100);
