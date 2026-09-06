import { parseFxSymbol } from "./risk.js";

export type FxPositionSide = "long" | "short";

export interface FxExposurePosition {
  symbol: string;
  side: FxPositionSide;
  lots: number;
  price: number;
  contractSize?: number;
}

export interface CurrencyExposure {
  currency: string;
  units: number;
}

export interface CurrencyExposureResult {
  positionCount: number;
  exposures: CurrencyExposure[];
}

const DEFAULT_CONTRACT_SIZE = 100_000;

function assertPositiveFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive finite number`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseExposurePositions(value: unknown): FxExposurePosition[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("positions must be a non-empty JSON array");
  }

  return value.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new Error(`positions[${index}] must be an object`);
    }

    const symbol = entry.symbol;
    const side = entry.side;
    const lots = entry.lots;
    const price = entry.price;
    const contractSize = entry.contractSize;

    if (typeof symbol !== "string") {
      throw new Error(`positions[${index}].symbol must be a string`);
    }
    parseFxSymbol(symbol);

    if (side !== "long" && side !== "short") {
      throw new Error(`positions[${index}].side must be "long" or "short"`);
    }

    if (typeof lots !== "number") {
      throw new Error(`positions[${index}].lots must be a number`);
    }
    assertPositiveFinite(lots, `positions[${index}].lots`);

    if (typeof price !== "number") {
      throw new Error(`positions[${index}].price must be a number`);
    }
    assertPositiveFinite(price, `positions[${index}].price`);

    if (contractSize !== undefined) {
      if (typeof contractSize !== "number") {
        throw new Error(`positions[${index}].contractSize must be a number`);
      }
      assertPositiveFinite(contractSize, `positions[${index}].contractSize`);
    }

    return {
      symbol,
      side,
      lots,
      price,
      ...(contractSize !== undefined ? { contractSize } : {}),
    };
  });
}

function addExposure(exposures: Map<string, number>, currency: string, units: number): void {
  exposures.set(currency, (exposures.get(currency) ?? 0) + units);
}

export function calculateCurrencyExposure(
  positions: readonly FxExposurePosition[],
): CurrencyExposureResult {
  if (positions.length === 0) {
    throw new Error("positions must contain at least one FX position");
  }

  const totals = new Map<string, number>();

  positions.forEach((position, index) => {
    const { base, quote } = parseFxSymbol(position.symbol);
    assertPositiveFinite(position.lots, `positions[${index}].lots`);
    assertPositiveFinite(position.price, `positions[${index}].price`);

    if (position.side !== "long" && position.side !== "short") {
      throw new Error(`positions[${index}].side must be "long" or "short"`);
    }

    const contractSize = position.contractSize ?? DEFAULT_CONTRACT_SIZE;
    assertPositiveFinite(contractSize, `positions[${index}].contractSize`);

    const baseUnits = position.lots * contractSize;
    const quoteUnits = baseUnits * position.price;
    const sign = position.side === "long" ? 1 : -1;

    addExposure(totals, base, sign * baseUnits);
    addExposure(totals, quote, -sign * quoteUnits);
  });

  const exposures = [...totals.entries()]
    .map(([currency, units]) => ({
      currency,
      units: Math.abs(units) < 1e-10 ? 0 : units,
    }))
    .sort((a, b) => a.currency.localeCompare(b.currency));

  return {
    positionCount: positions.length,
    exposures,
  };
}
