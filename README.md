# open-aeo

An open-source AEO (Answer Engine Optimization) citation monitor built as an MCP server.
Track whether your domain is cited by AI answer engines like Perplexity — directly inside Claude Desktop.

## What it does

- **`aeo_check`** — live citation check for a single query
- **`aeo_report`** — batch check across multiple queries  
- **`aeo_history`** — view historical citation data over time

## Why

Enterprise tools like Profound and Conductor solve this problem for large teams at enterprise pricing.
open-aeo is the self-hosted, open alternative — runs locally, costs cents per report, no subscription.

## Prerequisites

- Node.js >= 20
- pnpm >= 9
- A [Perplexity API key](https://www.perplexity.ai/api-platform) (~$5/1K requests)
- [Claude Desktop](https://claude.ai/download)

## Installation
```bash
git clone https://github.com/open-aeo/open-aeo.git
cd open-aeo
pnpm install
pnpm run build
```

## Claude Desktop setup

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "open-aeo": {
      "command": "node",
      "args": ["/absolute/path/to/open-aeo/dist/index.js"],
      "env": {
        "PERPLEXITY_API_KEY": "your-key-here"
      }
    }
  }
}
```

Restart Claude Desktop. The three tools will appear automatically.

## Usage

Ask Claude:
- *"Check if notion.so is cited for 'best note taking apps'"*
- *"Run an AEO report for these 5 queries"*
- *"Show me my citation history for last week"*

## Architecture
```
src/
  index.ts              entry point
  core/
    types.ts            shared types
    citationParser.ts   pure citation detection logic
  ports/
    IAnswerEngine.ts    interface: search()
    IStorage.ts         interface: save(), getHistory()
  adapters/
    PerplexityApi.ts    implements IAnswerEngine
    JsonStorage.ts      implements IStorage
  mcp/
    tools.ts            tool handler functions
    server.ts           MCP server, tool registration
```

Built with the [port/adapter pattern](https://en.wikipedia.org/wiki/Hexagonal_architecture_(software)) —
swapping Perplexity for another engine requires changing one file.

## Data storage

All data is stored locally at `~/.open-aeo/history.json`. No cloud, no telemetry.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT
