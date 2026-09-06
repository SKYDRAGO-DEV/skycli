# Contributing

Contributions to **FX Risk CLI** should improve correctness, transparency, testability, or model coverage without hiding trading assumptions.

## Engineering standard

Before opening a pull request:

1. Keep financial calculations deterministic and side-effect free where possible.
2. Make every currency-conversion assumption explicit.
3. Do not add live-broker connectivity, credentials, or external secrets directly into calculation modules.
4. Add or update tests for every behavioral change.
5. Keep CLI presentation separate from domain logic.
6. Reject invalid or ambiguous input rather than silently guessing.
7. Do not include fabricated trading results, profitability claims, broker screenshots, account data, or performance metrics.
8. Document any new execution or market assumption in the README.

## Local verification

```bash
npm install --ignore-scripts
npm run typecheck
npm test
npm audit --omit=dev --audit-level=high
```

## Pull requests

A useful pull request should include:

- the problem being solved;
- the financial or engineering assumption involved;
- the implementation approach;
- tests covering normal and edge cases;
- any documentation changes required by the new behavior.

Keep changes focused. Large feature additions should preserve a clear boundary between market data, calculation logic, broker/execution adapters, and presentation.

## Security

Do not submit credentials, broker account identifiers, API keys, tokens, private endpoints, or sensitive trading information. Follow `SECURITY.md` for vulnerability reporting guidance.

## Trading disclaimer

Contributions must not imply guaranteed profitability or equivalence between modeled/backtested behavior and live execution. This repository is for research and educational tooling, not financial advice.
