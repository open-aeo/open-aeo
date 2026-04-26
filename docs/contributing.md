# Contributing

## Development setup

```bash
git clone https://github.com/open-aeo/open-aeo.git
cd open-aeo
pnpm install
```

Run tests with `pnpm run test`, the linter with `pnpm run lint`, and build with `pnpm run build`. The build output goes to `dist/`.

## Architecture

The codebase follows a port/adapter pattern. `IAnswerEngine` in `src/ports/IAnswerEngine.ts` and `IStorage` in `src/ports/IStorage.ts` are the ports — they define the contracts without specifying implementation. `PerplexityApi` and `JsonStorage` are the adapters that implement those contracts. All tool handler functions in `src/mcp/tools.ts` depend only on the port interfaces, so you can swap an adapter without touching any tool logic.

To add support for a new answer engine — say, Bing Copilot or Gemini — implement `IAnswerEngine` and pass the new adapter to `AeoMcpServer` in `src/index.ts`. No tool code needs to change.

## Adding new tools

Tool handler functions go in `src/mcp/tools.ts`. Tool registration — the schema and the wiring to the handler — goes in `src/mcp/server.ts` inside `setupHandlers()`. New shared types go in `src/core/types.ts`. Follow the existing pattern: define the input schema with zod in `server.ts`, call the handler function from `tools.ts`, and return `{ content: [{ type: "text", text: ... }] }`.

## Pull request requirements

Describe what problem the change solves, not just what it does. Add or modify tests for any changed behaviour. Confirm that `pnpm run build` and `pnpm run test` both pass before submitting.
