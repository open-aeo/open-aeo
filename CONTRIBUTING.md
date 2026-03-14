# Contributing to open-aeo

## Getting started
```bash
git clone https://github.com/open-aeo/open-aeo.git
cd open-aeo
pnpm install
```

## Development
```bash
pnpm run build     # compile TypeScript
pnpm run lint      # run ESLint
pnpm run test      # run Vitest
```

## Adding a new answer engine

1. Create `src/adapters/YourEngineApi.ts` implementing `IAnswerEngine`
2. Add it to `src/mcp/server.ts` constructor
3. Add tests in `src/adapters/YourEngineApi.test.ts`

The port/adapter pattern means no other files need to change.

## Submitting a PR

- One feature or fix per PR
- All CI checks must pass (lint + test + build)
- Update the README if behaviour changes

## Reporting bugs

Open an issue with the error log format in `.github/ISSUE_TEMPLATE/bug_report.md`.
```
