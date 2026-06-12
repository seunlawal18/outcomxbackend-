import db from '../db/client';
import { DbMarket, DbTrade, DbUser, ApiTrade, toApiTrade } from '../types';
import { shiftProbabilities, syncOutcomePools } from './marketService';
import { getMinStake } from './authService';
import { insertPriceSnapshot, getLatestPrice } from './marketHistoryService';
import { emitter } from '../events';

// ─── Place a trade ────────────────────────────────────────────────────────────

export function placeTrade(
  userId: number,
  marketId: number,
  option: string,
  amount: number,
): {
  trade: ApiTrade;
  newBalance: number;
  updatedProbabilities: Record<string, number>;
} {
  let resultTrade!: ApiTrade;
  let resultBalance!: number;
  let resultProbabilities!: Record<string, number>;

  db.transaction(() => {

    // 1. Re-read market inside transaction (prevents race conditions)
    const market = db
      .prepare('SELECT * FROM markets WHERE id = ?')
      .get(marketId) as DbMarket | undefined;

    if (!market) {
      throw Object.assign(new Error('Market not found'), { statusCode: 404 });
    }
    if (market.status !== 'open') {
      throw Object.assign(
        new Error(`Market is ${market.status} and not accepting trades`),
        { statusCode: 400 },
      );
    }

    // 2. Check expiry atomically
    const expired = db
      .prepare(`SELECT 1 as e FROM markets WHERE id = ? AND expires_at <= datetime('now')`)
      .get(marketId) as { e: number } | undefined;

    if (expired) {
      db.prepare(`UPDATE markets SET status = 'closed' WHERE id = ?`).run(marketId);
      throw Object.assign(new Error('Market has expired'), { statusCode: 400 });
    }

    // 3. Re-read user balance inside transaction
    const user = db
      .prepare('SELECT * FROM users WHERE id = ?')
      .get(userId) as DbUser | undefined;

    if (!user) {
      throw Object.assign(new Error('User not found'), { statusCode: 404 });
    }
    if (amount > user.balance) {
      throw Object.assign(new Error('Insufficient balance'), { statusCode: 400 });
    }

    // 4. Validate option
    // For MULTI_YESNO: options stored as base labels ["Chelsea","Draw","Man United"]
    // Trades use compound format "Chelsea:Yes" or "Chelsea:No"
    // Validate that the base outcome exists in market.options and suffix is :Yes or :No
    const options = JSON.parse(market.options) as string[];

    let isValidOption: boolean;
    if (market.type === 'MULTI_YESNO') {
      const colonIdx = option.lastIndexOf(':');
      const outcome  = colonIdx !== -1 ? option.slice(0, colonIdx)  : '';
      const side     = colonIdx !== -1 ? option.slice(colonIdx + 1) : '';
      isValidOption  = options.includes(outcome) && (side === 'Yes' || side === 'No');
    } else {
      isValidOption = options.includes(option);
    }

    if (!isValidOption) {
      const hint = market.type === 'MULTI_YESNO'
        ? ` For MULTI_YESNO use format "Outcome:Yes" or "Outcome:No". Valid outcomes: ${options.join(', ')}`
        : ` Valid options: ${options.join(', ')}`;
      throw Object.assign(
        new Error(`Invalid option "${option}".${hint}`),
        { statusCode: 400 },
      );
    }

    // 5. Validate minimum stake for user's region
    const minStake = getMinStake(user.region);
    if (amount < minStake) {
      throw Object.assign(
        new Error(`Minimum stake for your region is ${minStake}`),
        { statusCode: 400 },
      );
    }

    // 6. Recalculate probabilities
    // For MULTI_YESNO: shift based on team name only, not "Team A:Yes"
    const probOption   = market.type === 'MULTI_YESNO' ? option.split(':')[0] : option;
    const currentProbs = JSON.parse(market.probabilities) as Record<string, number>;
    const updatedProbs = shiftProbabilities(currentProbs, probOption, amount);

    // 6b. Calculate locked payout at trade time (fixed-odds model)
    // Based on current probability before this trade shifts it.
    // Minimum probability floor of 5% prevents extreme payouts.
    const probs         = currentProbs;
    const probKey       = probOption;
    const probability   = (probs[probKey] ?? 50) / 100;
    const safeProbability = Math.max(probability, 0.05);
    const lockedPayout  = Math.round((amount * (1 / safeProbability)) * 100) / 100;

    // 7. Insert trade with locked_payout
    const insertResult = db.prepare(`
      INSERT INTO trades (user_id, market_id, market_title, option, amount, status, locked_payout)
      VALUES (?, ?, ?, ?, ?, 'active', ?)
    `).run(userId, marketId, market.title, option, amount, lockedPayout);

    // 8. Deduct balance
    db.prepare(`UPDATE users SET balance = balance - ? WHERE id = ?`).run(amount, userId);

    // 9. Update market volume + probabilities
    db.prepare(`
      UPDATE markets
      SET volume = volume + ?, probabilities = ?
      WHERE id = ?
    `).run(amount, JSON.stringify(updatedProbs), marketId);

    // 10. Sync market_outcomes pool amounts + probability decimals
    // For MULTI_YESNO: pool is tracked per base label (e.g. "Chelsea"), not per compound option
    const outcomeLabel = market.type === 'MULTI_YESNO'
      ? option.slice(0, option.lastIndexOf(':'))
      : option;
    syncOutcomePools(marketId, outcomeLabel, amount, updatedProbs);

    // 11. Insert price history snapshot (atomic with the trade)
    insertPriceSnapshot(marketId, options, updatedProbs, amount);

    // 12. Read back results
    const insertedTrade = db
      .prepare('SELECT * FROM trades WHERE id = ?')
      .get(insertResult.lastInsertRowid) as DbTrade;

    const updatedUser = db
      .prepare('SELECT balance FROM users WHERE id = ?')
      .get(userId) as { balance: number };

    resultTrade         = toApiTrade(insertedTrade);
    resultBalance       = updatedUser.balance;
    resultProbabilities = updatedProbs;

  })();

  // Fire event AFTER transaction commits — WS clients only get confirmed data
  const latestPrice = getLatestPrice(resultTrade.marketId);
  emitter.tradePlaced({
    marketId:             resultTrade.marketId,
    updatedProbabilities: resultProbabilities,
    latestPrice:          latestPrice!,
    tradeVolume:          amount,
    timestamp:            resultTrade.timestamp,
  });

  return {
    trade:                resultTrade,
    newBalance:           resultBalance,
    updatedProbabilities: resultProbabilities,
  };
}

// ─── Settle a market ──────────────────────────────────────────────────────────
//
// Parimutuel payout model with 3% platform fee:
//   totalPool    = sum of all active stakes
//   platformFee  = totalPool * 0.03  (retained by platform)
//   prizePool    = totalPool * 0.97  (distributed to winners)
//   userPayout   = (userStake / totalWinningStake) * prizePool
//
// Works for any number of outcomes with any labels.

export const PLATFORM_FEE_RATE = 0.03; // 3%

export function settleMarket(
  marketId: number,
  result: string,
): {
  settledCount: number;
  totalPool: number;
  platformFee: number;
  prizePool: number;
} {
  let settledCount = 0;
  let totalPool    = 0;
  let platformFee  = 0;
  let prizePool    = 0;

  db.transaction(() => {

    const market = db
      .prepare('SELECT * FROM markets WHERE id = ?')
      .get(marketId) as DbMarket | undefined;

    if (!market) {
      throw Object.assign(new Error('Market not found'), { statusCode: 404 });
    }
    if (market.status === 'settled') {
      throw Object.assign(new Error('Market is already settled'), { statusCode: 400 });
    }

    // Validate result against actual options
    // For MULTI_YESNO: options are stored as base labels ["Chelsea","Draw","Man United"]
    // Admin resolves with a base label e.g. "Chelsea"
    // Winning trades are those where option = "Chelsea:Yes"
    // For all other types: result must exactly match one of the stored options
    const options      = JSON.parse(market.options) as string[];
    const isMultiYesNo = market.type === 'MULTI_YESNO';
    const resultIsValid = options.includes(result);

    if (!resultIsValid) {
      throw Object.assign(
        new Error(`Invalid result "${result}". Valid options: ${options.join(', ')}`),
        { statusCode: 400 },
      );
    }

    // Load all active trades
    const activeTrades = db
      .prepare(`SELECT * FROM trades WHERE market_id = ? AND status = 'active'`)
      .all(marketId) as DbTrade[];

    // ── Determine winning logic based on market type ───────────────────────
    // MULTI_YESNO: trades stored as "Chelsea:Yes" — win when result = "Chelsea" and side = "Yes"
    // All other types: trade option must exactly equal result
    const isWinner = (tradeOption: string): boolean => {
      if (isMultiYesNo) {
        const [tradeOutcome, tradeSide] = tradeOption.split(':');
        return tradeOutcome === result && tradeSide === 'Yes';
      }
      return tradeOption === result;
    };

    // ── Pool totals ────────────────────────────────────────────────────────
    totalPool = activeTrades.reduce((s, t) => s + t.amount, 0);

    // ── Determine winners ─────────────────────────────────────────────────
    const winningTrades = activeTrades.filter(t => isWinner(t.option));

    // ── Fixed-odds payout calculation ─────────────────────────────────────
    // Each winner gets their locked_payout (set at trade time based on odds).
    // If total locked payouts exceed the pool, scale down proportionally so
    // the platform never goes negative (capped to 97% of pool).
    const totalLockedPayouts = winningTrades.reduce(
      (s, t) => s + (t.locked_payout ?? t.amount),
      0,
    );

    const payoutRatio = totalLockedPayouts > totalPool
      ? (totalPool * 0.97) / totalLockedPayouts  // cap: protect platform
      : 1;                                         // normal: pay full locked odds

    // Settle the market record first
    let totalPaidOut = 0;

    for (const trade of activeTrades) {
      if (winningTrades.find(w => w.id === trade.id)) {
        const rawPayout   = trade.locked_payout ?? trade.amount;
        const finalPayout = Math.round(rawPayout * payoutRatio * 100) / 100;

        db.prepare(`UPDATE trades SET status = 'won', payout_amount = ? WHERE id = ?`)
          .run(finalPayout, trade.id);
        db.prepare(`UPDATE users SET balance = balance + ? WHERE id = ?`)
          .run(finalPayout, trade.user_id);

        totalPaidOut += finalPayout;
      } else {
        db.prepare(`UPDATE trades SET status = 'lost', payout_amount = 0 WHERE id = ?`)
          .run(trade.id);
      }
    }

    // ── Platform income ────────────────────────────────────────────────────
    // Platform keeps everything not paid to winners.
    // Guaranteed minimum = 3% of total pool.
    const platformIncome = totalPool - totalPaidOut;
    platformFee = Math.max(
      Math.round(totalPool * PLATFORM_FEE_RATE * 100) / 100,
      platformIncome > 0 ? Math.round(platformIncome * 100) / 100 : 0,
    );
    prizePool = Math.round(totalPaidOut * 100) / 100;

    db.prepare(`
      UPDATE markets
      SET status = 'settled', result = ?, platform_fee = ?, prize_pool = ?
      WHERE id = ?
    `).run(result, platformFee, prizePool, marketId);

    settledCount = activeTrades.length;

  })();

  emitter.marketSettled({
    marketId,
    result,
    settledCount,
    timestamp: new Date().toISOString(),
  });

  return { settledCount, totalPool, platformFee, prizePool };
}
