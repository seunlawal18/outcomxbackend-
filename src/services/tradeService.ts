import db, { SQL_NOW } from '../db/client';
import { DbMarket, DbTrade, DbUser, ApiTrade, toApiTrade } from '../types';
import { shiftProbabilities, syncOutcomePools } from './marketService';
import { getMinStake } from './authService';
import { insertPriceSnapshot, getLatestPrice } from './marketHistoryService';
import { insertLedgerEntry } from './ledgerService';
import { emitter, SettledTradeResult } from '../events';

// ─── Place a trade ────────────────────────────────────────────────────────────

export async function placeTrade(
  userId: number,
  marketId: number,
  option: string,
  amount: number,
): Promise<{
  trade: ApiTrade;
  newBalance: number;
  updatedProbabilities: Record<string, number>;
}> {
  const { resultTrade, resultBalance, resultProbabilities, resultVolume } = await db.transaction(async (tx) => {

    // 1. Re-read market inside transaction (prevents race conditions)
    const market = await tx
      .prepare<DbMarket>('SELECT * FROM markets WHERE id = ?')
      .get(marketId);

    if (!market) {
      throw Object.assign(new Error('Market not found'), { statusCode: 404 });
    }
    if (market.status !== 'open') {
      throw Object.assign(
        new Error(`Market is ${market.status} and not accepting trades`),
        { statusCode: 400 },
      );
    }

    // 2. Check expiry — computed from the market row already fetched above
    // (was a separate round-trip query; the expires_at value is identical
    // either way, so comparing it client-side against Date.now() saves a
    // full network hop to Neon on every single trade for a difference of,
    // at most, a few ms of clock skew).
    const expiresAtMs = new Date(market.expires_at.replace(' ', 'T') + 'Z').getTime();
    if (expiresAtMs <= Date.now()) {
      await tx.prepare(`UPDATE markets SET status = 'closed' WHERE id = ?`).run(marketId);
      throw Object.assign(new Error('Market has expired'), { statusCode: 400 });
    }

    // 3. Re-read user balance inside transaction
    const user = await tx
      .prepare<DbUser>('SELECT * FROM users WHERE id = ?')
      .get(userId);

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

    // 5. Validate minimum stake
    const minStake = getMinStake();
    if (amount < minStake) {
      throw Object.assign(
        new Error(`Minimum stake is $${minStake}`),
        { statusCode: 400 },
      );
    }

    // 6. Recalculate probabilities
    // For MULTI_YESNO: the compound option "Team A:Yes" / "Team A:No" is
    // split into the base outcome + side. A Yes trade backs the outcome
    // (probability rises); a No trade bets against it (probability falls).
    const isMultiYesNoTrade = market.type === 'MULTI_YESNO';
    const colonIdx     = option.lastIndexOf(':');
    const probOption   = isMultiYesNoTrade ? option.slice(0, colonIdx) : option;
    const side         = isMultiYesNoTrade ? option.slice(colonIdx + 1) : null;
    const direction    = side === 'No' ? -1 as const : 1 as const;
    const currentProbs = JSON.parse(market.probabilities) as Record<string, number>;
    const updatedProbs = shiftProbabilities(currentProbs, probOption, amount, direction);

    // 6b. Calculate locked payout at trade time (fixed-odds model)
    // Based on the probability of the SIDE being traded before this trade
    // shifts it — for "X:No" that's the complement (100 - P(X)), matching
    // the price the trade panel quotes. Floor of 5% prevents extreme payouts.
    const outcomeProb   = currentProbs[probOption] ?? 50;
    const sideProb      = side === 'No' ? 100 - outcomeProb : outcomeProb;
    const probability   = sideProb / 100;
    const safeProbability = Math.max(probability, 0.05);
    const lockedPayout  = Math.round((amount * (1 / safeProbability)) * 100) / 100;

    // 7. Insert trade with locked_payout — RETURNING the full row so step 12
    // doesn't need a separate SELECT to read it back.
    const insertedTrade = (await tx.prepare<DbTrade>(`
      INSERT INTO trades (user_id, market_id, market_title, option, amount, status, locked_payout)
      VALUES (?, ?, ?, ?, ?, 'active', ?)
      RETURNING *
    `).get(userId, marketId, market.title, option, amount, lockedPayout))!;

    // 8. Deduct balance — RETURNING the new balance directly instead of a
    // separate SELECT afterward (was two round-trips, now one).
    const balanceAfterStake = (await tx
      .prepare<{ balance: number }>(`UPDATE users SET balance = balance - ? WHERE id = ? RETURNING balance`)
      .get(amount, userId))!.balance;
    await insertLedgerEntry(tx, {
      userId, type: 'trade_stake', amount: -amount, balanceAfter: balanceAfterStake,
      marketId, tradeId: insertedTrade.id,
    });

    // 9. Update market volume + probabilities — RETURNING the fresh absolute
    // volume so trade:placed can carry a value clients can just set (not a
    // delta they'd have to add themselves and risk double-applying if this
    // client already updated it optimistically from its own REST response).
    const newVolume = (await tx.prepare<{ volume: number }>(`
      UPDATE markets
      SET volume = volume + ?, probabilities = ?
      WHERE id = ?
      RETURNING volume
    `).get(amount, JSON.stringify(updatedProbs), marketId))!.volume;

    // 10. Sync market_outcomes pool amounts + probability decimals
    // For MULTI_YESNO: pool is tracked per base label (e.g. "Chelsea"), not per compound option
    const outcomeLabel = market.type === 'MULTI_YESNO'
      ? option.slice(0, option.lastIndexOf(':'))
      : option;
    await syncOutcomePools(tx, marketId, outcomeLabel, amount, updatedProbs);

    // 11. Insert price history snapshot (atomic with the trade)
    await insertPriceSnapshot(tx, marketId, options, updatedProbs, amount);

    // 12. Already have everything needed from steps 7-8 — no read-back queries.
    return {
      resultTrade:         toApiTrade(insertedTrade),
      resultBalance:       balanceAfterStake,
      resultProbabilities: updatedProbs,
      resultVolume:        newVolume,
    };
  });

  // Fire event AFTER transaction commits — WS clients only get confirmed data
  const latestPrice = await getLatestPrice(resultTrade.marketId);
  emitter.tradePlaced({
    marketId:             resultTrade.marketId,
    updatedProbabilities: resultProbabilities,
    latestPrice:          latestPrice!,
    tradeVolume:          amount,
    newVolume:            resultVolume,
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

// MULTI_YESNO outcomes don't have to be mutually exclusive from the admin's
// point of view — a voided/no-contest match resolves every outcome No, and
// nothing stops an admin from marking more than one Yes if the outcomes
// genuinely aren't exclusive. Each outcome's Yes/No is set independently;
// the fixed-odds payout loop below doesn't care how many (if any) winning
// outcomes there are, so no special-casing is needed there.
export type OutcomeResults = Record<string, 'Yes' | 'No'>;

export async function settleMarket(
  marketId: number,
  result: string | OutcomeResults,
  resolvedByAdminId?: number,
): Promise<{
  settledCount: number;
  totalPool: number;
  platformFee: number;
  prizePool: number;
  resultLabel: string;
}> {
  const { settledCount, totalPool, platformFee, prizePool, resultLabel, settledTrades, marketTitle } = await db.transaction(async (tx) => {

    const market = await tx
      .prepare<DbMarket>('SELECT * FROM markets WHERE id = ?')
      .get(marketId);

    if (!market) {
      throw Object.assign(new Error('Market not found'), { statusCode: 404 });
    }
    if (market.status === 'settled') {
      throw Object.assign(new Error('Market is already settled'), { statusCode: 400 });
    }

    const options      = JSON.parse(market.options) as string[];
    const isMultiYesNo = market.type === 'MULTI_YESNO';

    // ── Validate result against actual options ──────────────────────────────
    // MULTI_YESNO: result is a per-outcome Yes/No map, one entry per option —
    // every outcome must be explicitly decided, no partial/derived state.
    // All other types: result must exactly match one of the stored options.
    let outcomeResults: OutcomeResults | null = null;
    if (isMultiYesNo) {
      if (typeof result === 'string') {
        throw Object.assign(
          new Error('MULTI_YESNO markets require a Yes/No result for every outcome'),
          { statusCode: 400 },
        );
      }
      const missing = options.filter(opt => result[opt] !== 'Yes' && result[opt] !== 'No');
      if (missing.length > 0) {
        throw Object.assign(
          new Error(`Missing or invalid Yes/No result for: ${missing.join(', ')}`),
          { statusCode: 400 },
        );
      }
      outcomeResults = result;
    } else {
      if (typeof result !== 'string' || !options.includes(result)) {
        throw Object.assign(
          new Error(`Invalid result "${result}". Valid options: ${options.join(', ')}`),
          { statusCode: 400 },
        );
      }
    }

    // Load all active trades
    const activeTrades = await tx
      .prepare<DbTrade>(`SELECT * FROM trades WHERE market_id = ? AND status = 'active'`)
      .all(marketId);

    // ── Determine winning logic based on market type ───────────────────────
    // MULTI_YESNO: trades stored as "Chelsea:Yes" / "Chelsea:No" — a trade
    // wins when its side matches that outcome's independently-set result.
    // All other types: trade option must exactly equal result.
    const isWinner = (tradeOption: string): boolean => {
      if (outcomeResults) {
        const colonIdx = tradeOption.lastIndexOf(':');
        const tradeOutcome = tradeOption.slice(0, colonIdx);
        const tradeSide    = tradeOption.slice(colonIdx + 1);
        return outcomeResults[tradeOutcome] === tradeSide;
      }
      return tradeOption === result;
    };

    // ── Pool totals ────────────────────────────────────────────────────────
    const totalPool = activeTrades.reduce((s, t) => s + t.amount, 0);

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
    const settledTrades: SettledTradeResult[] = [];

    for (const trade of activeTrades) {
      if (winningTrades.find(w => w.id === trade.id)) {
        const rawPayout   = trade.locked_payout ?? trade.amount;
        const finalPayout = Math.round(rawPayout * payoutRatio * 100) / 100;

        await tx.prepare(`UPDATE trades SET status = 'won', payout_amount = ?, settled_at = ${SQL_NOW} WHERE id = ?`)
          .run(finalPayout, trade.id);
        await tx.prepare(`UPDATE users SET balance = balance + ? WHERE id = ?`)
          .run(finalPayout, trade.user_id);
        const balanceAfterPayout = (await tx.prepare<{ balance: number }>('SELECT balance FROM users WHERE id = ?').get(trade.user_id))!.balance;
        await insertLedgerEntry(tx, {
          userId: trade.user_id, type: 'trade_payout', amount: finalPayout, balanceAfter: balanceAfterPayout,
          marketId, tradeId: trade.id,
        });

        totalPaidOut += finalPayout;
        settledTrades.push({ userId: trade.user_id, tradeId: trade.id, status: 'won', payoutAmount: finalPayout });
      } else {
        await tx.prepare(`UPDATE trades SET status = 'lost', payout_amount = 0, settled_at = ${SQL_NOW} WHERE id = ?`)
          .run(trade.id);
        settledTrades.push({ userId: trade.user_id, tradeId: trade.id, status: 'lost', payoutAmount: 0 });
      }
    }

    // ── Platform income ────────────────────────────────────────────────────
    // Platform keeps everything not paid to winners.
    // Guaranteed minimum = 3% of total pool.
    const platformIncome = totalPool - totalPaidOut;
    const platformFee = Math.max(
      Math.round(totalPool * PLATFORM_FEE_RATE * 100) / 100,
      platformIncome > 0 ? Math.round(platformIncome * 100) / 100 : 0,
    );
    const prizePool = Math.round(totalPaidOut * 100) / 100;

    // ── Persist per-outcome results + a human-readable summary ─────────────
    // markets.result stays a plain display string everywhere downstream
    // (MarketCard, TradePanel, MarketHeader) already expect that — for
    // MULTI_YESNO it's the comma-joined list of outcomes that resolved Yes
    // (or "No winner" if none did, e.g. a voided match).
    let resultLabel: string;
    if (outcomeResults) {
      const valuesSql = options.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2}::text)`).join(', ');
      const params: unknown[] = [];
      options.forEach(opt => params.push(opt, outcomeResults![opt]));
      params.push(marketId);
      await tx.prepare(`
        UPDATE market_outcomes AS mo
        SET result = v.result
        FROM (VALUES ${valuesSql}) AS v(label, result)
        WHERE mo.market_id = $${options.length * 2 + 1} AND mo.label = v.label
      `).run(...params);

      const winners = options.filter(opt => outcomeResults![opt] === 'Yes');
      resultLabel = winners.length > 0 ? winners.join(', ') : 'No winner';
    } else {
      resultLabel = result as string;
    }

    // resolved_by stays null for auto-resolved (live-price) markets — only
    // set when an admin actually made the call, which is the case worth
    // auditing. See priceTickService.ts, which calls settleMarket() without
    // this argument for trend-based auto-resolution.
    await tx.prepare(`
      UPDATE markets
      SET status = 'settled', result = ?, platform_fee = ?, prize_pool = ?, resolved_by = ?
      WHERE id = ?
    `).run(resultLabel, platformFee, prizePool, resolvedByAdminId ?? null, marketId);

    return { settledCount: activeTrades.length, totalPool, platformFee, prizePool, resultLabel, settledTrades, marketTitle: market.title };
  });

  emitter.marketSettled({
    marketId,
    marketTitle,
    result: resultLabel,
    settledCount,
    trades: settledTrades,
    timestamp: new Date().toISOString(),
  });

  return { settledCount, totalPool, platformFee, prizePool, resultLabel };
}
