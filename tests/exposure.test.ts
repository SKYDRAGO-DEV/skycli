import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateCurrencyExposure,
  parseExposurePositions,
} from "../src/exposure.js";

test("calculates native currency exposure for a long EURUSD position", () => {
  const result = calculateCurrencyExposure([
    { symbol: "EURUSD", side: "long", lots: 1, price: 1.1 },
  ]);

  assert.equal(result.positionCount, 1);
  assert.deepEqual(result.exposures, [
    { currency: "EUR", units: 100_000 },
    { currency: "USD", units: -110_000 },
  ]);
});

test("calculates native currency exposure for a short USDJPY position", () => {
  const result = calculateCurrencyExposure([
    { symbol: "USDJPY", side: "short", lots: 0.5, price: 150 },
  ]);

  assert.deepEqual(result.exposures, [
    { currency: "JPY", units: 7_500_000 },
    { currency: "USD", units: -50_000 },
  ]);
});

test("aggregates exposure across multiple positions", () => {
  const result = calculateCurrencyExposure([
    { symbol: "EURUSD", side: "long", lots: 1, price: 1.1 },
    { symbol: "EURUSD", side: "short", lots: 0.5, price: 1.2 },
    { symbol: "GBPUSD", side: "long", lots: 0.25, price: 1.3 },
  ]);

  assert.deepEqual(result.exposures, [
    { currency: "EUR", units: 50_000 },
    { currency: "GBP", units: 25_000 },
    { currency: "USD", units: -82_500 },
  ]);
});

test("supports custom contract sizes", () => {
  const result = calculateCurrencyExposure([
    { symbol: "EURUSD", side: "long", lots: 2, price: 1.1, contractSize: 10_000 },
  ]);

  assert.deepEqual(result.exposures, [
    { currency: "EUR", units: 20_000 },
    { currency: "USD", units: -22_000 },
  ]);
});

test("parses and validates JSON position objects", () => {
  const positions = parseExposurePositions([
    { symbol: "EUR/USD", side: "long", lots: 0.2, price: 1.08 },
  ]);

  assert.deepEqual(positions, [
    { symbol: "EUR/USD", side: "long", lots: 0.2, price: 1.08 },
  ]);
});

test("rejects empty or invalid exposure inputs", () => {
  assert.throws(() => parseExposurePositions([]), /non-empty JSON array/);
  assert.throws(
    () => parseExposurePositions([{ symbol: "EURUSD", side: "buy", lots: 1, price: 1.1 }]),
    /side must be "long" or "short"/,
  );
  assert.throws(
    () => parseExposurePositions([{ symbol: "EURUSD", side: "long", lots: 0, price: 1.1 }]),
    /lots must be a positive finite number/,
  );
  assert.throws(
    () => calculateCurrencyExposure([]),
    /at least one FX position/,
  );
});
