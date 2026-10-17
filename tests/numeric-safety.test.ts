import assert from "node:assert/strict";
import test from "node:test";

import { calculateCurrencyExposure } from "../src/exposure.js";
import { valueCurrencyExposure } from "../src/portfolio.js";
import { calculatePositionSize, pipValuePerStandardLot } from "../src/risk.js";

test("rejects overflow in converted pip value instead of returning Infinity", () => {
  assert.throws(
    () => pipValuePerStandardLot({
      symbol: "USDJPY",
      accountCurrency: "USD",
      quoteToAccountRate: Number.MAX_VALUE,
      contractSize: Number.MAX_VALUE,
    }),
    /pipValuePerStandardLot must be a positive finite number/,
  );
});

test("rejects overflow in raw risk-based position size", () => {
  assert.throws(
    () => calculatePositionSize({
      symbol: "EURUSD",
      accountCurrency: "USD",
      balance: Number.MAX_VALUE,
      riskPercent: 1,
      stopPips: Number.MIN_VALUE,
    }),
    /raw lot size is not a finite non-negative number/,
  );
});

test("rejects lot-step increments too fine for safe integer precision", () => {
  assert.throws(
    () => calculatePositionSize({
      symbol: "EURUSD",
      accountCurrency: "USD",
      balance: 10_000,
      riskPercent: 1,
      stopPips: 20,
      lotStep: 1e-20,
      minLot: 1e-20,
    }),
    /lot-step quotient exceeds safe numeric precision/,
  );
});

test("rejects non-finite derived position exposure", () => {
  assert.throws(
    () => calculateCurrencyExposure([
      { symbol: "EURUSD", side: "long", lots: 1, contractSize: 1e308, price: 2 },
    ]),
    /exposure exceeds finite numeric range/,
  );
});

test("rejects aggregate exposure overflow across individually finite positions", () => {
  assert.throws(
    () => calculateCurrencyExposure([
      { symbol: "EURUSD", side: "long", lots: 1, contractSize: 1e308, price: 1 },
      { symbol: "EURUSD", side: "long", lots: 1, contractSize: 1e308, price: 1 },
    ]),
    /aggregate EUR exposure is not finite/,
  );
});

test("rejects non-finite account-currency conversion", () => {
  assert.throws(
    () => valueCurrencyExposure({
      positionCount: 1,
      exposures: [{ currency: "EUR", units: Number.MAX_VALUE }],
    }, "USD", { EUR: 2 }),
    /converted exposure for EUR is not finite/,
  );
});

test("rejects aggregate gross converted notional overflow", () => {
  assert.throws(
    () => valueCurrencyExposure({
      positionCount: 2,
      exposures: [
        { currency: "EUR", units: 1e308 },
        { currency: "GBP", units: 1e308 },
      ],
    }, "USD", { EUR: 1, GBP: 1 }),
    /aggregate account-currency exposure is not finite/,
  );
});

test("ordinary position sizing remains within the modeled risk budget", () => {
  for (const balance of [100, 1_000, 5_000, 10_000, 43_000]) {
    for (const riskPercent of [0.1, 0.5, 1, 2]) {
      for (const stopPips of [5, 10, 20, 33, 100]) {
        const result = calculatePositionSize({
          symbol: "EURUSD",
          accountCurrency: "USD",
          balance,
          riskPercent,
          stopPips,
        });
        assert.ok(Number.isFinite(result.lots));
        assert.ok(Number.isFinite(result.riskAtRoundedLots));
        assert.ok(result.riskAtRoundedLots <= result.riskAmount + 1e-8,
          `risk overrun for ${balance}/${riskPercent}/${stopPips}`);
      }
    }
  }
});
