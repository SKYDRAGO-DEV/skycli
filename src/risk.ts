export interface FxSymbol {
  base: string;
  quote: string;
}

export interface PipValueInput {
  symbol: string;
  accountCurrency: string;
  quoteToAccountRate?: number;
  contractSize?: number;
}

export interface PositionSizeInput extends PipValueInput {
  balance: number;
  riskPercent: number;
  stopPips: number;
  lotStep?: number;
  minLot?: number;
}

export interface PositionSizeResult {
  symbol: string;
  accountCurrency: string;
  riskAmount: number;
  stopPips: number;
  pipSize: number;
  quoteToAccountRate: number;
  pipValuePerStandardLot: number;
  rawLots: number;
  lots: number;
  riskAtRoundedLots: number;
}

export interface RiskRewardResult {
  symbol: string;
  direction: "long" | "short";
  riskPips: number;
  rewardPips: number;
  rewardRisk: number;
}

const DEFAULT_CONTRACT_SIZE = 100_000;
const DEFAULT_LOT_STEP = 0.01;
const DEFAULT_MIN_LOT = 0.01;

function assertPositiveFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive finite number`);
  }
}

function normalizeCurrency(currency: string): string {
  const value = currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(value)) {
    throw new Error(`Invalid currency code: ${currency}`);
  }
  return value;
}

export function parseFxSymbol(symbol: string): FxSymbol {
  const normalized = symbol.trim().toUpperCase().replace(/[\/-]/g, "");
  if (!/^[A-Z]{6}$/.test(normalized)) {
    throw new Error(`Invalid FX symbol: ${symbol}`);
  }

  return {
    base: normalized.slice(0, 3),
    quote: normalized.slice(3, 6),
  };
}

export function pipSize(symbol: string): number {
  const { quote } = parseFxSymbol(symbol);
  return quote === "JPY" ? 0.01 : 0.0001;
}

export function resolveQuoteToAccountRate(
  symbol: string,
  accountCurrency: string,
  quoteToAccountRate?: number,
): number {
  const { quote } = parseFxSymbol(symbol);
  const account = normalizeCurrency(accountCurrency);

  if (quote === account) {
    if (quoteToAccountRate !== undefined && Math.abs(quoteToAccountRate - 1) > 1e-12) {
      throw new Error(
        `quoteToAccountRate must be 1 when quote currency (${quote}) equals account currency (${account})`,
      );
    }
    return 1;
  }

  if (quoteToAccountRate === undefined) {
    throw new Error(
      `quoteToAccountRate is required because ${quote} must be converted to ${account}`,
    );
  }

  assertPositiveFinite(quoteToAccountRate, "quoteToAccountRate");
  return quoteToAccountRate;
}

export function pipValuePerStandardLot(input: PipValueInput): number {
  const contractSize = input.contractSize ?? DEFAULT_CONTRACT_SIZE;
  assertPositiveFinite(contractSize, "contractSize");

  const conversionRate = resolveQuoteToAccountRate(
    input.symbol,
    input.accountCurrency,
    input.quoteToAccountRate,
  );

  return pipSize(input.symbol) * contractSize * conversionRate;
}

function floorToStep(value: number, step: number): number {
  assertPositiveFinite(step, "lotStep");
  const increments = Math.floor((value + Number.EPSILON) / step);
  return Number((increments * step).toFixed(8));
}

export function calculatePositionSize(input: PositionSizeInput): PositionSizeResult {
  assertPositiveFinite(input.balance, "balance");
  assertPositiveFinite(input.riskPercent, "riskPercent");
  assertPositiveFinite(input.stopPips, "stopPips");

  if (input.riskPercent > 100) {
    throw new Error("riskPercent cannot exceed 100");
  }

  const lotStep = input.lotStep ?? DEFAULT_LOT_STEP;
  const minLot = input.minLot ?? DEFAULT_MIN_LOT;
  assertPositiveFinite(lotStep, "lotStep");
  assertPositiveFinite(minLot, "minLot");

  const { base, quote } = parseFxSymbol(input.symbol);
  const normalizedSymbol = `${base}${quote}`;
  const accountCurrency = normalizeCurrency(input.accountCurrency);
  const conversionRate = resolveQuoteToAccountRate(
    normalizedSymbol,
    accountCurrency,
    input.quoteToAccountRate,
  );
  const pipValue = pipValuePerStandardLot({
    symbol: normalizedSymbol,
    accountCurrency,
    ...(input.quoteToAccountRate !== undefined
      ? { quoteToAccountRate: input.quoteToAccountRate }
      : {}),
    ...(input.contractSize !== undefined ? { contractSize: input.contractSize } : {}),
  });

  const riskAmount = input.balance * (input.riskPercent / 100);
  const rawLots = riskAmount / (input.stopPips * pipValue);
  const steppedLots = floorToStep(rawLots, lotStep);
  const lots = steppedLots >= minLot ? steppedLots : 0;
  const riskAtRoundedLots = lots * input.stopPips * pipValue;

  return {
    symbol: normalizedSymbol,
    accountCurrency,
    riskAmount,
    stopPips: input.stopPips,
    pipSize: pipSize(normalizedSymbol),
    quoteToAccountRate: conversionRate,
    pipValuePerStandardLot: pipValue,
    rawLots,
    lots,
    riskAtRoundedLots,
  };
}

export function pipsBetween(symbol: string, priceA: number, priceB: number): number {
  assertPositiveFinite(priceA, "priceA");
  assertPositiveFinite(priceB, "priceB");
  return Math.abs(priceA - priceB) / pipSize(symbol);
}

export function calculateRiskReward(
  symbol: string,
  entry: number,
  stop: number,
  target: number,
): RiskRewardResult {
  assertPositiveFinite(entry, "entry");
  assertPositiveFinite(stop, "stop");
  assertPositiveFinite(target, "target");

  if (entry === stop) {
    throw new Error("entry and stop cannot be equal");
  }

  const direction: "long" | "short" = stop < entry ? "long" : "short";
  if (direction === "long" && target <= entry) {
    throw new Error("A long setup requires target > entry");
  }
  if (direction === "short" && target >= entry) {
    throw new Error("A short setup requires target < entry");
  }

  const riskPips = pipsBetween(symbol, entry, stop);
  const rewardPips = pipsBetween(symbol, entry, target);

  return {
    symbol: `${parseFxSymbol(symbol).base}${parseFxSymbol(symbol).quote}`,
    direction,
    riskPips,
    rewardPips,
    rewardRisk: rewardPips / riskPips,
  };
}
