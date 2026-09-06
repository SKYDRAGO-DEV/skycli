# Changelog

All notable changes to **FX Risk CLI** are documented here.

The project follows semantic versioning where practical. Until a stable `1.0.0` interface is published, minor releases may include breaking CLI changes when they materially improve correctness or model clarity.

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
