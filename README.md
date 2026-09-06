# FX Risk CLI

A deterministic TypeScript command-line utility for **Forex position sizing, pip-value conversion, and risk/reward analysis**.

The project is intentionally narrow: it performs transparent calculations from user-supplied inputs and does **not** connect to brokers, fetch live rates, place trades, or claim strategy profitability.

## Status

**v0.1.0 — functional research/tooling utility**

Current scope:

- Risk-based position sizing
- Standard and JPY-pair pip sizing
- Pip-value calculation in account currency
- Explicit quote-currency → account-currency conversion
- Configurable contract size, lot step, and minimum lot
- Long/short risk-reward validation
- Human-readable and JSON output
- Strict TypeScript compilation
- Automated calculation tests
- CI across Node.js 20 and 22

## Why this exists

Risk calculations are simple enough to appear trivial and important enough that silent assumptions are dangerous.

This utility makes those assumptions explicit. In particular, when the account currency differs from the FX pair's quote currency, the CLI requires a conversion rate rather than silently pretending the currencies are equivalent.

## Calculation model

For a conventional FX pair `BASE/QUOTE`:

```text
pip size = 0.0001
pip size = 0.01 when QUOTE = JPY
```

For a standard lot:

```text
pip value in quote currency
= pip size × contract size
```

Converted to account currency:

```text
pip value in account currency
= pip value in quote currency × quoteToAccountRate
```

where:

```text
1 unit of quote currency
= quoteToAccountRate units of account currency
```

Risk-based position size:

```text
risk amount
= account balance × risk percent / 100

raw lots
= risk amount / (stop pips × pip value per standard lot)
```

The final lot size is **rounded down** to the configured lot step so rounding does not increase the modeled risk budget.

## Installation

Requirements:

- Node.js 20+
- npm

```bash
npm install
npm run build
```

Run directly:

```bash
node dist/src/index.js --help
```

For a local command:

```bash
npm link
fx-risk --help
```

## Usage

### Position sizing

For a USD account trading EURUSD, quote currency and account currency are both USD, so no conversion rate is required:

```bash
fx-risk size \
  --symbol EURUSD \
  --account-currency USD \
  --balance 10000 \
  --risk-percent 1 \
  --stop-pips 20
```

Expected model:

```text
Risk amount: 100 USD
Pip value / standard lot: 10 USD
Raw position size: 0.50 lots
Rounded position size: 0.50 lots
```

### Cross-currency conversion

For a USD account trading USDJPY, pip value is naturally denominated in JPY. Supply the JPY→USD conversion explicitly:

```bash
fx-risk pip-value \
  --symbol USDJPY \
  --account-currency USD \
  --lots 1 \
  --quote-to-account-rate 0.00667
```

`0.00667` is only an illustrative input. The CLI does not fetch or validate live market rates.

### Risk / reward

```bash
fx-risk rr \
  --symbol EURUSD \
  --entry 1.1000 \
  --stop 1.0950 \
  --target 1.1100
```

The tool infers direction from entry/stop placement and rejects a target on the wrong side of entry.

### JSON output

Append `--json` to any command:

```bash
fx-risk size \
  --symbol EURUSD \
  --account-currency USD \
  --balance 10000 \
  --risk-percent 1 \
  --stop-pips 20 \
  --json
```

## Commands

| Command | Purpose |
| --- | --- |
| `size` | Calculate a risk-based lot size |
| `pip-value` | Calculate pip value in account currency |
| `rr` | Calculate directional risk/reward |

### `size` inputs

| Flag | Required | Meaning |
| --- | ---: | --- |
| `--symbol` | yes | FX symbol such as `EURUSD` or `USD/JPY` |
| `--account-currency` | yes | Three-letter account currency |
| `--balance` | yes | Account balance |
| `--risk-percent` | yes | Percentage of balance allocated to modeled trade risk |
| `--stop-pips` | yes | Stop distance in pips |
| `--quote-to-account-rate` | conditional | Required when quote currency differs from account currency |
| `--contract-size` | no | Units per standard lot; default `100000` |
| `--lot-step` | no | Tradable lot increment; default `0.01` |
| `--min-lot` | no | Minimum tradable lot; default `0.01` |
| `--json` | no | Machine-readable output |

## Architecture

```text
CLI input
   ↓
validation / symbol normalization
   ↓
pip-size + currency-conversion model
   ↓
risk / pip-value / R:R calculation
   ↓
lot-step risk-safe rounding
   ↓
human or JSON output
```

The calculation engine lives in `src/risk.ts` and is independent of terminal presentation in `src/index.ts`.

## Testing

```bash
npm run typecheck
npm test
```

Tests cover:

- Symbol parsing
- Standard and JPY pip sizes
- USD-quoted pip values
- Cross-currency conversion requirements
- Converted JPY pip values
- Position sizing
- Risk-safe lot-step rounding
- Minimum-lot behavior
- Pip-distance calculations
- Long/short R:R calculations
- Invalid directional setups

## Assumptions and limitations

This project deliberately does **not** model every broker or execution detail.

Current limitations:

- No live FX-rate retrieval
- No broker API or MetaTrader integration
- No leverage or margin calculation
- No commission model
- No spread/slippage model
- No swap/financing calculation
- No symbol-specific broker contract metadata
- No CFD, metals, crypto, index, or futures contract model

Broker specifications can differ. Contract size, minimum lot, lot step, tick size, and conversion logic should be validated against the intended trading venue before use.

## Engineering principles

- Deterministic calculations
- Explicit currency-conversion assumptions
- Risk-safe rounding
- Strict input validation
- Testable domain logic separated from CLI output
- No broker credentials or external secrets
- No manufactured trading or performance claims

## Roadmap

Potential next increments, only when implemented and tested:

- Currency-exposure aggregation
- Multi-position portfolio risk
- Margin/leverage modeling
- Broker symbol-specification adapters
- Spread/slippage-aware pre-trade estimates
- MT5 integration behind a separate adapter boundary

## Disclaimer

This software is provided for research and educational purposes only and does not constitute financial or investment advice. Trading involves substantial risk. Calculations are simplified models and must be independently validated against broker specifications and live execution conditions before any real-money use.
