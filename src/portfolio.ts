import type { CurrencyExposureResult } from "./exposure.js";

export interface ExposureConversionRates {
  [currency: string]: number;
}

export interface ValuedCurrencyExposure {
  currency: string;
  units: number;
  accountRate: number;
  accountValue: number;
}

export interface ExposureValuationResult {
  accountCurrency: string;
  positionCount: number;
  exposures: ValuedCurrencyExposure[];
  grossAbsoluteAccountValue: number;
  netAccountValue: number;
}

export type RiskBudgetStatus = "allowed" | "reduced" | "blocked";

export interface AccountRiskBudgetInput {
  equity: number;
  peakEquity: number;
  baseRiskPercent: number;
  maxDrawdownPercent: number;
  openRiskAmount: number;
  maxOpenRiskPercent: number;
}

export interface AccountRiskBudgetResult {
  equity: number;
  peakEquity: number;
  drawdownAmount: number;
  drawdownPercent: number;
  drawdownFloorEquity: number;
  drawdownHeadroomAmount: number;
  requestedRiskAmount: number;
  openRiskAmount: number;
  maxOpenRiskAmount: number;
  remainingOpenRiskAmount: number;
  allowedRiskAmount: number;
  status: RiskBudgetStatus;
  constraints: string[];
}

function assertPositiveFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive finite number`);
  }
}

function assertNonNegativeFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a non-negative finite number`);
  }
}

function normalizeCurrency(value: string, name: string): string {
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new Error(`${name} must be a three-letter currency code`);
  }
  return normalized;
}

function normalizeNumericBoundary(value: number): number {
  if (Math.abs(value) < 1e-10) {
    return 0;
  }
  return Number(value.toFixed(10));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseExposureConversionRates(value: unknown): ExposureConversionRates {
  if (!isRecord(value)) {
    throw new Error("conversion rates must be a JSON object keyed by currency code");
  }

  const rates: ExposureConversionRates = {};

  for (const [rawCurrency, rawRate] of Object.entries(value)) {
    const currency = normalizeCurrency(rawCurrency, "conversion-rate currency");
    if (typeof rawRate !== "number") {
      throw new Error(`conversion rate for ${currency} must be a number`);
    }
    assertPositiveFinite(rawRate, `conversion rate for ${currency}`);
    rates[currency] = rawRate;
  }

  return rates;
}

export function valueCurrencyExposure(
  exposure: CurrencyExposureResult,
  accountCurrencyInput: string,
  conversionRates: ExposureConversionRates,
): ExposureValuationResult {
  const accountCurrency = normalizeCurrency(accountCurrencyInput, "account currency");

  if (Object.prototype.hasOwnProperty.call(conversionRates, accountCurrency)) {
    const suppliedAccountRate = conversionRates[accountCurrency];
    if (suppliedAccountRate !== 1) {
      throw new Error(`conversion rate for account currency ${accountCurrency} must equal 1`);
    }
  }

  let grossAbsoluteAccountValue = 0;
  let netAccountValue = 0;

  const valuedExposures = exposure.exposures.map((item) => {
    const currency = normalizeCurrency(item.currency, "exposure currency");
    const accountRate =
      currency === accountCurrency ? 1 : conversionRates[currency];

    if (accountRate === undefined) {
      throw new Error(
        `missing conversion rate for ${currency}: provide units of ${accountCurrency} per 1 ${currency}`,
      );
    }
    assertPositiveFinite(accountRate, `conversion rate for ${currency}`);

    const accountValue = normalizeNumericBoundary(item.units * accountRate);
    grossAbsoluteAccountValue += Math.abs(accountValue);
    netAccountValue += accountValue;

    return {
      currency,
      units: item.units,
      accountRate,
      accountValue,
    };
  });

  return {
    accountCurrency,
    positionCount: exposure.positionCount,
    exposures: valuedExposures,
    grossAbsoluteAccountValue: normalizeNumericBoundary(grossAbsoluteAccountValue),
    netAccountValue: normalizeNumericBoundary(netAccountValue),
  };
}

export function calculateAccountRiskBudget(
  input: AccountRiskBudgetInput,
): AccountRiskBudgetResult {
  assertPositiveFinite(input.equity, "equity");
  assertPositiveFinite(input.peakEquity, "peak equity");
  assertPositiveFinite(input.baseRiskPercent, "base risk percent");
  assertPositiveFinite(input.maxDrawdownPercent, "max drawdown percent");
  assertNonNegativeFinite(input.openRiskAmount, "open risk amount");
  assertPositiveFinite(input.maxOpenRiskPercent, "max open risk percent");

  if (input.peakEquity < input.equity) {
    throw new Error("peak equity must be greater than or equal to current equity");
  }
  if (input.maxDrawdownPercent >= 100) {
    throw new Error("max drawdown percent must be less than 100");
  }
  if (input.baseRiskPercent >= 100) {
    throw new Error("base risk percent must be less than 100");
  }
  if (input.maxOpenRiskPercent >= 100) {
    throw new Error("max open risk percent must be less than 100");
  }

  const drawdownAmount = input.peakEquity - input.equity;
  const drawdownPercent = (drawdownAmount / input.peakEquity) * 100;
  const drawdownFloorEquity = input.peakEquity * (1 - input.maxDrawdownPercent / 100);
  const drawdownHeadroomAmount = Math.max(input.equity - drawdownFloorEquity, 0);

  const requestedRiskAmount = input.equity * (input.baseRiskPercent / 100);
  const maxOpenRiskAmount = input.equity * (input.maxOpenRiskPercent / 100);
  const remainingOpenRiskAmount = Math.max(maxOpenRiskAmount - input.openRiskAmount, 0);

  const allowedRiskAmount = Math.max(
    Math.min(requestedRiskAmount, remainingOpenRiskAmount, drawdownHeadroomAmount),
    0,
  );

  const constraints: string[] = [];
  const epsilon = 1e-10;

  if (drawdownHeadroomAmount <= epsilon) {
    constraints.push("maximum drawdown limit reached");
  } else if (drawdownHeadroomAmount + epsilon < requestedRiskAmount) {
    constraints.push("requested risk reduced by remaining drawdown headroom");
  }

  if (remainingOpenRiskAmount <= epsilon) {
    constraints.push("maximum aggregate open-risk limit reached");
  } else if (remainingOpenRiskAmount + epsilon < requestedRiskAmount) {
    constraints.push("requested risk reduced by aggregate open-risk limit");
  }

  let status: RiskBudgetStatus = "allowed";
  if (allowedRiskAmount <= epsilon) {
    status = "blocked";
  } else if (allowedRiskAmount + epsilon < requestedRiskAmount) {
    status = "reduced";
  }

  return {
    equity: input.equity,
    peakEquity: input.peakEquity,
    drawdownAmount: normalizeNumericBoundary(drawdownAmount),
    drawdownPercent: normalizeNumericBoundary(drawdownPercent),
    drawdownFloorEquity: normalizeNumericBoundary(drawdownFloorEquity),
    drawdownHeadroomAmount: normalizeNumericBoundary(drawdownHeadroomAmount),
    requestedRiskAmount: normalizeNumericBoundary(requestedRiskAmount),
    openRiskAmount: normalizeNumericBoundary(input.openRiskAmount),
    maxOpenRiskAmount: normalizeNumericBoundary(maxOpenRiskAmount),
    remainingOpenRiskAmount: normalizeNumericBoundary(remainingOpenRiskAmount),
    allowedRiskAmount: normalizeNumericBoundary(allowedRiskAmount),
    status,
    constraints,
  };
}
