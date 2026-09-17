import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const cliPath = fileURLToPath(new URL("../src/index.js", import.meta.url));

function runCli(...args: string[]) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    encoding: "utf8",
  });
}

test("executes a valid size command in JSON mode", () => {
  const result = runCli(
    "size",
    "--symbol",
    "EURUSD",
    "--account-currency",
    "USD",
    "--balance",
    "10000",
    "--risk-percent",
    "1",
    "--stop-pips",
    "20",
    "--json",
  );

  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout) as { symbol: string; lots: number };
  assert.equal(output.symbol, "EURUSD");
  assert.equal(output.lots, 0.5);
});

test("rejects misspelled optional flags instead of silently using defaults", () => {
  const result = runCli(
    "size",
    "--symbol",
    "EURUSD",
    "--account-currency",
    "USD",
    "--balance",
    "10000",
    "--risk-percent",
    "1",
    "--stop-pips",
    "20",
    "--lot-stpe",
    "0.1",
  );

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unknown option for size: --lot-stpe/);
});

test("rejects duplicate options", () => {
  const result = runCli(
    "rr",
    "--symbol",
    "EURUSD",
    "--entry",
    "1.1000",
    "--entry",
    "1.1001",
    "--stop",
    "1.0950",
    "--target",
    "1.1100",
  );

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Duplicate option: --entry/);
});

test("normalizes account-currency whitespace in pip-value output", () => {
  const result = runCli(
    "pip-value",
    "--symbol",
    "EURUSD",
    "--account-currency",
    " usd ",
    "--json",
  );

  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout) as { accountCurrency: string };
  assert.equal(output.accountCurrency, "USD");
});
