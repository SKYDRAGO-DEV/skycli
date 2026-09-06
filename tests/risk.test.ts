import assert from "node:assert/strict";
import test from "node:test";

import {
  calculatePositionSize,
  calculateRiskReward,
  parseFxSymbol,
  pipSize,
  pipValuePerStandardLot,
  pipsBetween,
  resolveQuoteToAccountRate,
} from "../src/risk.js";

test("parses normalized and delimited FX symbols", () => {
  assert.deepEqual(parseFxSymbol("eurusd"), { base: "EUR", quote: "USD" });
  assert.deepEqual(parseFxSymbol("USD/JPY"), { base: "USD", quote: "JPY" });
  assert.deepEqual(parseFxSymbol("GBP-USD"), { base: "GBP", quote: "USD" });
});

test("rejects invalid symbols", () => {
  assert.throws(() => parseFxSymbol("EUR_USD"), /Invalid FX symbol/);
  assert.throws(() => parseFxSymbol("BTCUSD1"), /Invalid FX symbol/);
});

test("uses standard and JPY pip sizes", () => {
  assert.equal(pipSize("EURUSD"), 0.0001);
  assert.equal(pipSize("USDJPY"), 0.01);
});

test("calculates USD-quoted pip value without conversion", () => {
  assert.equal(
    pipValuePerStandardLot({ symbol: "EURUSD", accountCurrency: "USD" }),
    10,
  );
});

test("requires explicit conversion when quote and account currencies differ", () => {
  assert.throws(
    () => pipValuePerStandardLot({ symbol: "USDJPY", accountCurrency: "USD" }),
    /quoteToAccountRate is required/,
  );
});

test("calculates converted JPY pip value", () => {
  const value = pipValuePerStandardLot({
    symbol: "USDJPY",
    accountCurrency: "USD",
    quoteToAccountRate: 1 / 150,
  });
  assert.ok(Math.abs(value - 6.6666666667) < 1e-8);
});

test("rejects inconsistent conversion when quote equals account currency", () => {
  assert.throws(
    () => resolveQuoteToAccountRate("EURUSD", "USD", 0.99),
    /must be 1/,
  );
});

test("sizes EURUSD position from account risk", () => {
  const result = calculatePositionSize({
    symbol: "EURUSD",
    accountCurrency: "USD",
    balance: 10_000,
    riskPercent: 1,
    stopPips: 20,
  });

  assert.equal(result.riskAmount, 100);
  assert.equal(result.pipValuePerStandardLot, 10);
  assert.equal(result.rawLots, 0.5);
  assert.equal(result.lots, 0.5);
  assert.equal(result.riskAtRoundedLots, 100);
});

test("rounds lot size down to avoid exceeding configured risk", () => {
  const result = calculatePositionSize({
    symbol: "EURUSD",
    accountCurrency: "USD",
    balance: 10_000,
    riskPercent: 1,
    stopPips: 33,
    lotStep: 0.01,
  });

  assert.ok(result.rawLots > 0.30);
  assert.equal(result.lots, 0.30);
  assert.ok(result.riskAtRoundedLots <= result.riskAmount);
});

test("returns zero lots when risk budget is below minimum tradable lot", () => {
  const result = calculatePositionSize({
    symbol: "EURUSD",
    accountCurrency: "USD",
    balance: 100,
    riskPercent: 0.1,
    stopPips: 100,
    minLot: 0.01,
  });

  assert.equal(result.lots, 0);
  assert.equal(result.riskAtRoundedLots, 0);
});

test("calculates pip distance for standard and JPY pairs", () => {
  assert.ok(Math.abs(pipsBetween("EURUSD", 1.1, 1.105) - 50) < 1e-9);
  assert.ok(Math.abs(pipsBetween("USDJPY", 150, 150.5) - 50) < 1e-9);
});

test("calculates long risk/reward", () => {
  const result = calculateRiskReward("EURUSD", 1.1, 1.095, 1.11);
  assert.equal(result.direction, "long");
  assert.ok(Math.abs(result.riskPips - 50) < 1e-9);
  assert.ok(Math.abs(result.rewardPips - 100) < 1e-9);
  assert.ok(Math.abs(result.rewardRisk - 2) < 1e-9);
});

test("calculates short risk/reward", () => {
  const result = calculateRiskReward("EURUSD", 1.1, 1.105, 1.09);
  assert.equal(result.direction, "short");
  assert.ok(Math.abs(result.rewardRisk - 2) < 1e-9);
});

test("rejects directionally inconsistent targets", () => {
  assert.throws(
    () => calculateRiskReward("EURUSD", 1.1, 1.095, 1.099),
    /long setup requires target > entry/,
  );
  assert.throws(
    () => calculateRiskReward("EURUSD", 1.1, 1.105, 1.101),
    /short setup requires target < entry/,
  );
});
