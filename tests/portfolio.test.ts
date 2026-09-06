import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateAccountRiskBudget,
  parseExposureConversionRates,
  valueCurrencyExposure,
} from "../src/portfolio.js";

const exposure = {
  positionCount: 1,
  exposures: [
    { currency: "EUR", units: 100_000 },
    { currency: "USD", units: -110_000 },
  ],
};

test("values native exposure in account currency with explicit rates", () => {
  const result = valueCurrencyExposure(exposure, "USD", { EUR: 1.1 });

  assert.deepEqual(result, {
    accountCurrency: "USD",
    positionCount: 1,
    exposures: [
      { currency: "EUR", units: 100_000, accountRate: 1.1, accountValue: 110_000 },
      { currency: "USD", units: -110_000, accountRate: 1, accountValue: -110_000 },
    ],
    grossAbsoluteAccountValue: 220_000,
    netAccountValue: 0,
  });
});

test("requires a conversion rate for each non-account currency exposure", () => {
  assert.throws(
    () => valueCurrencyExposure(exposure, "USD", {}),
    /missing conversion rate for EUR/,
  );
});

test("requires account currency conversion rate to equal one when supplied", () => {
  assert.throws(
    () => valueCurrencyExposure(exposure, "USD", { EUR: 1.1, USD: 0.99 }),
    /must equal 1/,
  );
});

test("parses and validates exposure conversion-rate JSON", () => {
  assert.deepEqual(parseExposureConversionRates({ eur: 1.1, JPY: 0.0067 }), {
    EUR: 1.1,
    JPY: 0.0067,
  });

  assert.throws(() => parseExposureConversionRates([]), /JSON object/);
  assert.throws(() => parseExposureConversionRates({ EUR: 0 }), /positive finite/);
  assert.throws(() => parseExposureConversionRates({ EURO: 1.1 }), /three-letter/);
});

test("allows the requested risk when drawdown and open-risk headroom are sufficient", () => {
  const result = calculateAccountRiskBudget({
    equity: 10_000,
    peakEquity: 10_500,
    baseRiskPercent: 1,
    maxDrawdownPercent: 10,
    openRiskAmount: 150,
    maxOpenRiskPercent: 3,
  });

  assert.equal(result.status, "allowed");
  assert.equal(result.requestedRiskAmount, 100);
  assert.equal(result.allowedRiskAmount, 100);
  assert.equal(result.drawdownAmount, 500);
  assert.equal(result.maxOpenRiskAmount, 300);
  assert.equal(result.remainingOpenRiskAmount, 150);
  assert.deepEqual(result.constraints, []);
});

test("reduces new risk when aggregate open-risk headroom is smaller than requested risk", () => {
  const result = calculateAccountRiskBudget({
    equity: 10_000,
    peakEquity: 10_500,
    baseRiskPercent: 1,
    maxDrawdownPercent: 10,
    openRiskAmount: 260,
    maxOpenRiskPercent: 3,
  });

  assert.equal(result.status, "reduced");
  assert.equal(result.requestedRiskAmount, 100);
  assert.equal(result.remainingOpenRiskAmount, 40);
  assert.equal(result.allowedRiskAmount, 40);
  assert.deepEqual(result.constraints, [
    "requested risk reduced by aggregate open-risk limit",
  ]);
});

test("blocks new risk after the configured drawdown floor is reached", () => {
  const result = calculateAccountRiskBudget({
    equity: 9_000,
    peakEquity: 10_000,
    baseRiskPercent: 1,
    maxDrawdownPercent: 10,
    openRiskAmount: 0,
    maxOpenRiskPercent: 3,
  });

  assert.equal(result.status, "blocked");
  assert.equal(result.drawdownPercent, 10);
  assert.equal(result.drawdownHeadroomAmount, 0);
  assert.equal(result.allowedRiskAmount, 0);
  assert.deepEqual(result.constraints, ["maximum drawdown limit reached"]);
});

test("rejects inconsistent account state and invalid risk limits", () => {
  assert.throws(
    () =>
      calculateAccountRiskBudget({
        equity: 11_000,
        peakEquity: 10_000,
        baseRiskPercent: 1,
        maxDrawdownPercent: 10,
        openRiskAmount: 0,
        maxOpenRiskPercent: 3,
      }),
    /peak equity/,
  );

  assert.throws(
    () =>
      calculateAccountRiskBudget({
        equity: 10_000,
        peakEquity: 10_000,
        baseRiskPercent: 1,
        maxDrawdownPercent: 100,
        openRiskAmount: 0,
        maxOpenRiskPercent: 3,
      }),
    /less than 100/,
  );
});
