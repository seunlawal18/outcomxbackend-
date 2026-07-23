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
  tradeVolume:          number; // this trade's stake — kept for logging/analytics
  newVolume:            number; // fresh absolute market volume — clients should just set this, not add tradeVolume themselves
  timestamp:            string;
}

export interface SettledTradeResult {
  userId:       number;
  tradeId:      number;
  status:       'won' | 'lost';
  payoutAmount: number;
}

export interface MarketSettledEvent {
  marketId:     number;
  marketTitle:  string;
  result:       string;
  settledCount: number;
  // Per-trade outcomes — lets the socket layer push a targeted
  // "your trade settled" notification to each affected user, instead of
  // clients polling their own trade list to notice a change.
  trades:       SettledTradeResult[];
  timestamp:    string;
}

export interface MarketClosedEvent {
  marketId:  number;
  reason:    'expired' | 'manual';
  timestamp: string;
}

export interface PriceTickEvent {
  marketId:    number;
  pricePoint:  ApiPricePoint;
}

export interface WithdrawalUpdatedEvent {
  userId:       number;
  withdrawalId: number;
  status:       'approved' | 'rejected' | 'completed';
  amount:       number;
  txHash?:      string | null;
  timestamp:    string;
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

  priceTick(payload: PriceTickEvent): void {
    this.emit('price:tick', payload);
  }

  withdrawalUpdated(payload: WithdrawalUpdatedEvent): void {
    this.emit('withdrawal:updated', payload);
  }
}

// Singleton — import this anywhere in the app
export const emitter = new OutcomxEmitter();

// Increase max listeners to avoid Node.js warnings when many WS clients attach
emitter.setMaxListeners(100);
