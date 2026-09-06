#!/usr/bin/env node

import {
  calculateCurrencyExposure,
  parseExposurePositions,
} from "./exposure.js";
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

function hasJson(flags: FlagMap): boolean {
  return flags.get("json") === true;
}

function printHelp(): void {
  console.log(`FX Risk CLI\n\nDeterministic FX position sizing, pip-value, risk/reward and native-currency exposure calculations.\n\nCommands:\n  size       Calculate risk-based position size\n  pip-value  Calculate pip value in account currency\n  rr         Calculate risk/reward for an FX setup\n  exposure   Aggregate native-currency exposure across FX positions\n\nExamples:\n  fx-risk size --symbol EURUSD --account-currency USD --balance 10000 --risk-percent 1 --stop-pips 20\n\n  fx-risk pip-value --symbol USDJPY --account-currency USD --lots 1 --quote-to-account-rate 0.00667\n\n  fx-risk rr --symbol EURUSD --entry 1.1000 --stop 1.0950 --target 1.1100\n\n  fx-risk exposure --positions-json '[{"symbol":"EURUSD","side":"long","lots":1,"price":1.10}]'\n\nUse --json on any command for machine-readable output.\n\nConversion rule:\n  When account currency differs from the pair's quote currency,\n  --quote-to-account-rate is required and means:\n  1 unit of quote currency = N units of account currency.\n\nExposure rule:\n  exposure reports native currency units only. A long BASE/QUOTE position\n  is long base units and short quote units at the supplied position price.\n`);
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
  const raw = requiredString(flags, "positions-json");
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("--positions-json must contain valid JSON");
  }

  const positions = parseExposurePositions(parsed);
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
