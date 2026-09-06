#!/usr/bin/env node

import {
  calculateCurrencyExposure,
  parseExposurePositions,
} from "./exposure.js";
import {
  calculateAccountRiskBudget,
  parseExposureConversionRates,
  valueCurrencyExposure,
} from "./portfolio.js";
import {
  calculatePositionSize,
  calculateRiskReward,
  parseFxSymbol,
  pipValuePerStandardLot,
  resolveQuoteToAccountRate,
} from "./risk.js";

type FlagValue = string | true;
type FlagMap = Map<string, FlagValue>;

function parseFlags(args: string[]): FlagMap {
  const flags = new Map<string, FlagValue>();

  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (!token?.startsWith("--")) {
      throw new Error(`Unexpected argument: ${token ?? ""}`);
    }

    const key = token.slice(2);
    if (key === "json") {
      flags.set(key, true);
      continue;
    }

    const value = args[i + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }

    flags.set(key, value);
    i += 1;
  }

  return flags;
}

function requiredString(flags: FlagMap, key: string): string {
  const value = flags.get(key);
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`--${key} is required`);
  }
  return value;
}

function requiredNumber(flags: FlagMap, key: string): number {
  const raw = requiredString(flags, key);
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`--${key} must be a finite number`);
  }
  return value;
}

function optionalNumber(flags: FlagMap, key: string): number | undefined {
  const value = flags.get(key);
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error(`--${key} requires a numeric value`);
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`--${key} must be a finite number`);
  }
  return parsed;
}

function parseJsonFlag(flags: FlagMap, key: string): unknown {
  const raw = requiredString(flags, key);
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new Error(`--${key} must contain valid JSON`);
  }
}

function hasJson(flags: FlagMap): boolean {
  return flags.get("json") === true;
}

function printHelp(): void {
  console.log(`FX Risk CLI\n\nDeterministic FX position sizing, pip-value, risk/reward, currency exposure, exposure valuation, and account-level risk-budget calculations.\n\nCommands:\n  size            Calculate risk-based position size\n  pip-value       Calculate pip value in account currency\n  rr              Calculate risk/reward for an FX setup\n  exposure        Aggregate native-currency exposure across FX positions\n  exposure-value  Convert aggregated exposure into explicit account-currency notional equivalents\n  risk-budget     Gate new trade risk using drawdown and aggregate open-risk limits\n\nExamples:\n  fx-risk size --symbol EURUSD --account-currency USD --balance 10000 --risk-percent 1 --stop-pips 20\n\n  fx-risk pip-value --symbol USDJPY --account-currency USD --lots 1 --quote-to-account-rate 0.00667\n\n  fx-risk rr --symbol EURUSD --entry 1.1000 --stop 1.0950 --target 1.1100\n\n  fx-risk exposure --positions-json '[{"symbol":"EURUSD","side":"long","lots":1,"price":1.10}]'\n\n  fx-risk exposure-value --account-currency USD --positions-json '[{"symbol":"EURUSD","side":"long","lots":1,"price":1.10}]' --conversion-rates-json '{"EUR":1.10}'\n\n  fx-risk risk-budget --equity 10000 --peak-equity 10500 --base-risk-percent 1 --max-drawdown-percent 10 --open-risk 150 --max-open-risk-percent 3\n\nUse --json on any command for machine-readable output.\n\nConversion rule:\n  When account currency differs from the pair's quote currency,\n  --quote-to-account-rate is required and means:\n  1 unit of quote currency = N units of account currency.\n\nExposure rule:\n  exposure reports native currency units only. A long BASE/QUOTE position\n  is long base units and short quote units at the supplied position price.\n\nExposure valuation rule:\n  exposure-value requires direct user-supplied conversion factors for every\n  non-account currency exposure: 1 unit of currency = N account-currency units.\n  The result is a converted notional equivalent, not VaR, expected loss, or P&L.\n\nRisk-budget rule:\n  risk-budget uses current equity, peak equity, configured drawdown limit,\n  existing modeled open risk, and maximum open-risk percentage to determine\n  whether requested per-trade risk is allowed, reduced, or blocked.\n`);
}

function runSize(flags: FlagMap): void {
  const quoteToAccountRate = optionalNumber(flags, "quote-to-account-rate");
  const contractSize = optionalNumber(flags, "contract-size");
  const lotStep = optionalNumber(flags, "lot-step");
  const minLot = optionalNumber(flags, "min-lot");

  const result = calculatePositionSize({
    symbol: requiredString(flags, "symbol"),
    accountCurrency: requiredString(flags, "account-currency"),
    balance: requiredNumber(flags, "balance"),
    riskPercent: requiredNumber(flags, "risk-percent"),
    stopPips: requiredNumber(flags, "stop-pips"),
    ...(quoteToAccountRate !== undefined ? { quoteToAccountRate } : {}),
    ...(contractSize !== undefined ? { contractSize } : {}),
    ...(lotStep !== undefined ? { lotStep } : {}),
    ...(minLot !== undefined ? { minLot } : {}),
  });

  if (hasJson(flags)) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`Symbol: ${result.symbol}`);
  console.log(`Account currency: ${result.accountCurrency}`);
  console.log(`Risk amount: ${result.riskAmount.toFixed(2)} ${result.accountCurrency}`);
  console.log(`Stop distance: ${result.stopPips.toFixed(2)} pips`);
  console.log(`Pip value / standard lot: ${result.pipValuePerStandardLot.toFixed(4)} ${result.accountCurrency}`);
  console.log(`Raw size: ${result.rawLots.toFixed(6)} lots`);
  console.log(`Rounded size: ${result.lots.toFixed(4)} lots`);
  console.log(`Risk at rounded size: ${result.riskAtRoundedLots.toFixed(2)} ${result.accountCurrency}`);
}

function runPipValue(flags: FlagMap): void {
  const symbol = requiredString(flags, "symbol");
  const accountCurrency = requiredString(flags, "account-currency");
  const lots = optionalNumber(flags, "lots") ?? 1;
  const quoteToAccountRate = optionalNumber(flags, "quote-to-account-rate");
  const contractSize = optionalNumber(flags, "contract-size");

  if (!Number.isFinite(lots) || lots <= 0) {
    throw new Error("--lots must be a positive finite number");
  }

  const perLot = pipValuePerStandardLot({
    symbol,
    accountCurrency,
    ...(quoteToAccountRate !== undefined ? { quoteToAccountRate } : {}),
    ...(contractSize !== undefined ? { contractSize } : {}),
  });
  const conversionRate = resolveQuoteToAccountRate(symbol, accountCurrency, quoteToAccountRate);
  const normalized = parseFxSymbol(symbol);
  const result = {
    symbol: `${normalized.base}${normalized.quote}`,
    accountCurrency: accountCurrency.toUpperCase(),
    lots,
    quoteToAccountRate: conversionRate,
    pipValuePerStandardLot: perLot,
    pipValue: perLot * lots,
  };

  if (hasJson(flags)) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`Symbol: ${result.symbol}`);
  console.log(`Lots: ${result.lots}`);
  console.log(`Pip value: ${result.pipValue.toFixed(4)} ${result.accountCurrency}`);
}

function runRiskReward(flags: FlagMap): void {
  const result = calculateRiskReward(
    requiredString(flags, "symbol"),
    requiredNumber(flags, "entry"),
    requiredNumber(flags, "stop"),
    requiredNumber(flags, "target"),
  );

  if (hasJson(flags)) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`Symbol: ${result.symbol}`);
  console.log(`Direction: ${result.direction}`);
  console.log(`Risk: ${result.riskPips.toFixed(2)} pips`);
  console.log(`Reward: ${result.rewardPips.toFixed(2)} pips`);
  console.log(`Reward/Risk: ${result.rewardRisk.toFixed(3)}`);
}

function runExposure(flags: FlagMap): void {
  const positions = parseExposurePositions(parseJsonFlag(flags, "positions-json"));
  const result = calculateCurrencyExposure(positions);

  if (hasJson(flags)) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`Positions: ${result.positionCount}`);
  for (const exposure of result.exposures) {
    const sign = exposure.units > 0 ? "+" : "";
    console.log(`${exposure.currency}: ${sign}${exposure.units.toFixed(2)} units`);
  }
}

function runExposureValue(flags: FlagMap): void {
  const positions = parseExposurePositions(parseJsonFlag(flags, "positions-json"));
  const exposure = calculateCurrencyExposure(positions);
  const rates = parseExposureConversionRates(parseJsonFlag(flags, "conversion-rates-json"));
  const result = valueCurrencyExposure(
    exposure,
    requiredString(flags, "account-currency"),
    rates,
  );

  if (hasJson(flags)) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`Positions: ${result.positionCount}`);
  console.log(`Account currency: ${result.accountCurrency}`);
  for (const item of result.exposures) {
    const sign = item.accountValue > 0 ? "+" : "";
    console.log(
      `${item.currency}: ${item.units.toFixed(2)} units × ${item.accountRate} = ${sign}${item.accountValue.toFixed(2)} ${result.accountCurrency}`,
    );
  }
  console.log(
    `Gross absolute converted notional: ${result.grossAbsoluteAccountValue.toFixed(2)} ${result.accountCurrency}`,
  );
  console.log(`Net converted notional: ${result.netAccountValue.toFixed(2)} ${result.accountCurrency}`);
}

function runRiskBudget(flags: FlagMap): void {
  const result = calculateAccountRiskBudget({
    equity: requiredNumber(flags, "equity"),
    peakEquity: requiredNumber(flags, "peak-equity"),
    baseRiskPercent: requiredNumber(flags, "base-risk-percent"),
    maxDrawdownPercent: requiredNumber(flags, "max-drawdown-percent"),
    openRiskAmount: optionalNumber(flags, "open-risk") ?? 0,
    maxOpenRiskPercent: requiredNumber(flags, "max-open-risk-percent"),
  });

  if (hasJson(flags)) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`Status: ${result.status.toUpperCase()}`);
  console.log(`Equity: ${result.equity.toFixed(2)}`);
  console.log(`Peak equity: ${result.peakEquity.toFixed(2)}`);
  console.log(`Current drawdown: ${result.drawdownPercent.toFixed(3)}%`);
  console.log(`Drawdown headroom: ${result.drawdownHeadroomAmount.toFixed(2)}`);
  console.log(`Requested new risk: ${result.requestedRiskAmount.toFixed(2)}`);
  console.log(`Existing modeled open risk: ${result.openRiskAmount.toFixed(2)}`);
  console.log(`Remaining open-risk capacity: ${result.remainingOpenRiskAmount.toFixed(2)}`);
  console.log(`Allowed new risk: ${result.allowedRiskAmount.toFixed(2)}`);
  if (result.constraints.length > 0) {
    console.log(`Constraints: ${result.constraints.join("; ")}`);
  }
}

function main(): void {
  const [command, ...rest] = process.argv.slice(2);

  if (command === undefined || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  const flags = parseFlags(rest);

  switch (command) {
    case "size":
      runSize(flags);
      break;
    case "pip-value":
      runPipValue(flags);
      break;
    case "rr":
      runRiskReward(flags);
      break;
    case "exposure":
      runExposure(flags);
      break;
    case "exposure-value":
      runExposureValue(flags);
      break;
    case "risk-budget":
      runRiskBudget(flags);
      break;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`fx-risk: ${message}`);
  process.exitCode = 1;
}
