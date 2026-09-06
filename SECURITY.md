# Security Policy

## Scope

FX Risk CLI is a local calculation utility. It does not require broker credentials, API keys, trading-account identifiers, or network access for its current feature set.

## Sensitive information

Do not commit or submit issues containing:

- Broker credentials
- API keys or access tokens
- Trading-account numbers
- Private execution logs
- `.env` files containing secrets
- Personally identifiable financial information

If a future adapter requires credentials, secrets must be supplied through an external secret-management mechanism or environment variables and must never be embedded in source code.

## Reporting a vulnerability

If you identify a vulnerability that could expose sensitive information or materially corrupt risk calculations, report it privately to the repository owner rather than publishing exploit details in a public issue.

## Calculation integrity

Incorrect risk calculations are treated as security-relevant defects because they can cause unintended financial exposure. Changes to pip value, currency conversion, position sizing, or rounding logic should include tests covering the affected behavior.
