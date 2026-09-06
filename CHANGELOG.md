# Changelog

All notable changes to **FX Risk CLI** are documented here.

The project follows semantic versioning where practical. Until a stable `1.0.0` interface is published, minor releases may include breaking CLI changes when they materially improve correctness or model clarity.

## [0.3.0] - 2026-09-06

### Added

- Explicit account-currency valuation of aggregated FX currency exposure.
- Direct per-currency conversion-rate inputs with validation and no live-rate assumptions.
- Gross absolute converted notional and net converted notional outputs.
- Drawdown-aware account risk-budget calculation.
- Aggregate open-risk limits and remaining risk-capacity calculation.
- `allowed`, `reduced`, and `blocked` pre-trade risk-budget states.
- CLI `exposure-value` and `risk-budget` commands.
- Automated tests for conversion requirements, account-currency consistency, risk-cap reductions, drawdown blocking, and invalid account state.

### Model boundary

Converted exposure values are **notional equivalents**, not VaR, CVaR, expected loss, P&L, margin, or liquidation risk. The risk-budget model is a deterministic control layer based on user-supplied equity, peak equity, configured drawdown limits, and modeled open-risk amounts; it does not estimate probability of loss or broker margin requirements.

## [0.2.0] - 2026-09-06

### Added

- Native-currency exposure aggregation across multiple FX positions.
- Explicit long/short base-versus-quote notional accounting.
- Runtime validation for JSON position inputs.
- Custom per-position contract-size support.
- CLI `exposure` command with human-readable and JSON output.
- Automated tests for long, short, aggregated, custom-contract and invalid-input exposure cases.

### Model boundary

Exposure is reported in **native currency units**. This release does not convert the aggregated exposures into account-currency market value, VaR, expected loss, or live portfolio risk because doing so requires additional market/conversion data and explicit modeling assumptions.

## [0.1.0] - 2026-09-06

### Added

- Deterministic FX position sizing from account balance, risk percentage, and stop distance.
- Standard and JPY quote-currency pip-size handling.
- Pip-value calculation with explicit quote-currency to account-currency conversion.
- Configurable contract size, lot step, and minimum lot.
- Risk-safe lot rounding that rounds down rather than increasing modeled risk.
- Direction-aware long/short risk-to-reward calculation.
- Human-readable and JSON CLI output.
- Strict TypeScript compilation and automated calculation tests.
- CI verification on Node.js 20 and 22.
- Production-dependency audit in CI.
- Security policy and explicit trading/research disclaimer.

### Scope limitations

This release does not include broker connectivity, live prices, order execution, leverage/margin modeling, commissions, spread/slippage, swaps, or broker-specific symbol metadata.
