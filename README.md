# FX Risk CLI

A deterministic TypeScript command-line utility for **Forex position sizing, pip-value conversion, risk/reward analysis, currency exposure, account-currency exposure valuation, and drawdown-aware risk budgeting**.

The project is intentionally transparent: it performs calculations from user-supplied inputs and does **not** connect to brokers, fetch live rates, place trades, estimate strategy profitability, or manufacture portfolio-risk statistics.

## Status

**v0.3.0 — functional research / pre-trade risk tooling**

Current scope:

- Risk-based position sizing
- Standard and JPY-pair pip sizing
- Pip-value calculation in account currency
- Explicit quote-currency → account-currency conversion
- Configurable contract size, lot step, and minimum lot
- Long/short risk-reward validation
- Multi-position native-currency exposure aggregation
- Explicit account-currency exposure valuation
- Gross and net converted notional calculations
- Drawdown-aware account risk budgeting
- Aggregate modeled open-risk limits
- Allowed / reduced / blocked risk states
- Human-readable and JSON output
- Strict TypeScript compilation
- Automated financial-calculation tests
- CI across Node.js 20 and 22
- Production-dependency audit

## Why this exists

Risk calculations are simple enough to appear trivial and important enough that silent assumptions are dangerous.

This utility makes assumptions explicit. When an account currency differs from an FX pair's quote currency, pip-value calculations require a supplied conversion rate rather than pretending the currencies are equivalent. Native currency exposure is kept separate from account-currency valuation. Converted notional is kept separate from VaR, expected loss, P&L, margin, or liquidation risk. Drawdown controls are calculated from explicit account state rather than hidden brokerage assumptions.

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

### Native-currency exposure

For a position at supplied price `P`:

```text
base units = lots × contract size
quote units = base units × P
```

A **long** `BASE/QUOTE` position contributes `+base units` and `-quote units`; a **short** position contributes the inverse. Exposures are aggregated by currency across positions.

### Account-currency exposure valuation

For each non-account currency exposure:

```text
account value
= native currency units × explicit conversion rate
```

where the user supplies:

```text
1 unit of exposure currency
= N units of account currency
```

The CLI then reports:

```text
gross absolute converted notional
= sum(abs(converted currency exposures))

net converted notional
= sum(converted currency exposures)
```

These are **notional equivalents only**. They are not VaR, expected loss, P&L, margin usage, liquidation risk, or a covariance-adjusted portfolio-risk estimate.

### Drawdown-aware risk budget

The account risk gate uses current equity, peak equity, requested per-trade risk, maximum drawdown, current modeled open risk, and maximum aggregate open risk.

```text
drawdown amount
= peak equity - current equity

drawdown %
= drawdown amount / peak equity × 100

drawdown floor equity
= peak equity × (1 - max drawdown % / 100)

drawdown headroom
= max(current equity - drawdown floor equity, 0)

requested new risk
= current equity × base risk % / 100

max aggregate open risk
= current equity × max open risk % / 100

remaining open-risk capacity
= max(max aggregate open risk - existing modeled open risk, 0)

allowed new risk
= min(requested new risk, drawdown headroom, remaining open-risk capacity)
```

The result is classified as:

- **allowed** — full requested risk fits all configured limits
- **reduced** — some risk is available, but less than requested
- **blocked** — no new modeled risk is available under the configured limits

This is a deterministic policy gate, not a probability-of-loss model.

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

```bash
fx-risk size \
  --symbol EURUSD \
  --account-currency USD \
  --balance 10000 \
  --risk-percent 1 \
  --stop-pips 20
```

For a USD account trading EURUSD, quote currency and account currency are both USD, so no conversion rate is required.

### Cross-currency pip conversion

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

### Native currency exposure

```bash
fx-risk exposure \
  --positions-json '[{"symbol":"EURUSD","side":"long","lots":1,"price":1.10},{"symbol":"GBPUSD","side":"short","lots":0.25,"price":1.30}]'
```

Example position model:

```text
Long 1.00 lot EURUSD @ 1.1000
= +100,000 EUR
= -110,000 USD
```

### Account-currency exposure valuation

```bash
fx-risk exposure-value \
  --account-currency USD \
  --positions-json '[{"symbol":"EURUSD","side":"long","lots":1,"price":1.10}]' \
  --conversion-rates-json '{"EUR":1.10}'
```

A direct conversion factor is required for every non-account currency that appears in the aggregated exposure. The account currency itself is valued at `1` and must not be supplied with any other rate.

### Drawdown-aware risk budget

```bash
fx-risk risk-budget \
  --equity 10000 \
  --peak-equity 10500 \
  --base-risk-percent 1 \
  --max-drawdown-percent 10 \
  --open-risk 150 \
  --max-open-risk-percent 3
```

The command reports current drawdown, drawdown headroom, requested new risk, existing modeled open risk, remaining open-risk capacity, allowed new risk, status, and any active constraints.

### JSON output

Append `--json` to any command for machine-readable output.

## Commands

| Command | Purpose |
| --- | --- |
| `size` | Calculate a risk-based lot size |
| `pip-value` | Calculate pip value in account currency |
| `rr` | Calculate directional risk/reward |
| `exposure` | Aggregate native-currency exposure across positions |
| `exposure-value` | Convert native exposure into explicit account-currency notional equivalents |
| `risk-budget` | Gate new modeled risk using drawdown and aggregate open-risk limits |

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

### `exposure` position input

`--positions-json` accepts a non-empty JSON array. Each position contains:

| Field | Required | Meaning |
| --- | ---: | --- |
| `symbol` | yes | FX pair |
| `side` | yes | `long` or `short` |
| `lots` | yes | Positive lot quantity |
| `price` | yes | Positive position/reference price used for quote notional |
| `contractSize` | no | Units per lot; default `100000` |

### `exposure-value` inputs

| Flag | Required | Meaning |
| --- | ---: | --- |
| `--positions-json` | yes | Same validated FX position array used by `exposure` |
| `--account-currency` | yes | Currency used for converted notional reporting |
| `--conversion-rates-json` | yes | JSON object mapping each non-account exposure currency to account-currency units per 1 unit |
| `--json` | no | Machine-readable output |

### `risk-budget` inputs

| Flag | Required | Meaning |
| --- | ---: | --- |
| `--equity` | yes | Current account equity |
| `--peak-equity` | yes | Highest equity reference used for drawdown control; must be >= current equity |
| `--base-risk-percent` | yes | Requested new-trade risk as a percent of current equity |
| `--max-drawdown-percent` | yes | Configured equity drawdown ceiling |
| `--open-risk` | no | Existing modeled open risk in account-currency amount; default `0` |
| `--max-open-risk-percent` | yes | Maximum aggregate modeled open risk as a percent of current equity |
| `--json` | no | Machine-readable output |

## Architecture

```text
CLI input
   ↓
runtime validation / symbol normalization
   ↓
┌──────────────────────────────┬──────────────────────────────┐
│ Single-trade risk model      │ Native exposure model        │
│ pip / conversion / R:R / lot│ base + quote currency units  │
└──────────────────────────────┴──────────────────────────────┘
                  ↓
       ┌──────────────────────────────┐
       │ Portfolio control layer      │
       │ exposure valuation           │
       │ drawdown / open-risk budget  │
       └──────────────────────────────┘
                  ↓
          human or JSON output
```

- `src/risk.ts` — single-trade pip, conversion, sizing, and R:R logic
- `src/exposure.ts` — native multi-position currency exposure
- `src/portfolio.ts` — account-currency exposure valuation and account risk-budget controls
- `src/index.ts` — command-line parsing and presentation

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
- Long and short native-currency exposure
- Multi-position exposure aggregation
- Custom contract sizes
- Invalid exposure inputs
- Account-currency exposure valuation
- Missing conversion-rate rejection
- Account-currency rate consistency
- Conversion-rate JSON validation
- Fully allowed risk budgets
- Open-risk-constrained reduced budgets
- Drawdown-limit blocking
- Invalid account state and risk-limit rejection

## Assumptions and limitations

This project deliberately does **not** model every broker, market, portfolio, or execution detail.

Current limitations:

- No live FX-rate retrieval
- No broker API or MetaTrader integration
- No leverage or margin calculation
- No commission model
- No spread/slippage model
- No swap/financing calculation
- No symbol-specific broker contract metadata
- No covariance/correlation-adjusted portfolio risk
- No VaR/CVaR or probability-of-loss model
- No mark-to-market P&L engine
- No liquidation or margin-call modeling
- No CFD, metals, crypto, index, or futures contract model

Broker specifications can differ. Contract size, minimum lot, lot step, tick size, conversion logic, position-price conventions, and any account-risk limits should be validated against the intended venue and risk policy before use.

## Engineering principles

- Deterministic calculations
- Explicit currency-conversion assumptions
- Native exposure separated from valuation
- Notional valuation separated from probabilistic risk claims
- Drawdown/open-risk controls separated from broker margin logic
- Risk-safe rounding
- Strict input validation
- Testable domain logic separated from CLI output
- No broker credentials or external secrets
- No manufactured trading or performance claims

## Roadmap

Potential next increments, only when implemented and tested:

- Margin/leverage modeling using explicit broker specifications
- Spread/slippage-aware pre-trade estimates
- Broker symbol-specification adapters
- Portfolio concentration limits by currency
- Scenario/stress testing with explicit price shocks
- Historical risk analytics with documented data inputs
- MT5 integration behind a separate adapter boundary

## Project governance

- `CHANGELOG.md` — release history and model boundaries
- `CONTRIBUTING.md` — engineering and trading-claim standards
- `SECURITY.md` — vulnerability reporting and secret-handling guidance

## Disclaimer

This software is provided for research and educational purposes only and does not constitute financial or investment advice. Trading involves substantial risk. Calculations are simplified deterministic models and must be independently validated against broker specifications, account policy, and live execution conditions before any real-money use.
