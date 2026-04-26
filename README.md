# open-aeo

An open-source AEO (Answer Engine Optimization) citation monitor built as an MCP server.
Track whether your domain is cited by AI answer engines like Perplexity — directly inside Claude Desktop.

## What it does

- **`aeo_check`** — live citation check for a single query
- **`aeo_report`** — batch check across multiple queries
- **`aeo_history`** — view historical citation data over time
- **`aeo_analyse`** — fetch and analyse a competitor page that beat you
- **`aeo_recommend`** — citation check plus prioritised content recommendations

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

Replace `/absolute/path/to/open-aeo` in the config below with the actual path where you cloned the repository. On macOS this is typically `/Users/yourname/open-aeo`. On Windows use double backslashes or forward slashes.

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

Restart Claude Desktop. To verify, start a new conversation and ask: *"What MCP tools do you have available?"* — Claude will list all connected tools. You can also check Settings → Developer to confirm the server shows as connected.

## Usage

Ask Claude:
- *"Check if linear.app is cited for 'best project management tool for software teams'"*
- *"Run an AEO report for these 5 queries"*
- *"Show me my citation history for last week"*
- *"Analyse this competitor page that keeps beating me"*
- *"What should I do to get cited for this query?"*

## Tools

| Tool | Description |
|------|-------------|
| `aeo_check` | Run a live citation check for one query. Returns whether your domain or brand was cited, its position, and which competitors appeared instead. |
| `aeo_report` | Batch citation check across multiple queries. Returns a summary and per-query results. Adds a 2-second delay between requests to avoid rate limits. |
| `aeo_history` | Retrieve past citation check results from local storage. Filterable by query and domain. |
| `aeo_analyse` | Fetch and analyse a specific competitor URL. Returns a structural breakdown of the page — FAQ sections, schema markup, content depth, freshness signals — so you understand why it was cited. |
| `aeo_recommend` | Run a fresh citation check for a query, then automatically fetch and analyse the competitor pages that appeared instead of you. Returns a prioritised list of specific content and schema tasks to improve your citation chances. |

## Architecture

The codebase follows a port/adapter pattern. Interfaces define the contract;
implementations can be swapped without changing any tool logic.

```
src/
  index.ts                   entry point, reads env vars, starts the MCP server
  core/
    types.ts                 all shared interfaces
    citationParser.ts        detects citations in engine responses
    contentAnalyser.ts       fetches competitor pages, generates recommendation tasks
  ports/
    IAnswerEngine.ts         interface for answer engine adapters
    IStorage.ts              interface for storage adapters
  adapters/
    PerplexityApi.ts         answer engine: Perplexity via sonar model
    JSONStorage.ts           storage: writes to ~/.open-aeo/
    PageFetcher.ts           fetches competitor URLs, extracts page signals
  mcp/
    tools.ts                 tool handler functions
    server.ts                MCP server, tool registration
```

## Data storage

All data is stored locally at `~/.open-aeo/`. No cloud, no telemetry.

- `~/.open-aeo/history.json` — citation check history
- `~/.open-aeo/competitor-history.json` — competitor page analysis history

Override the storage location with `OPEN_AEO_STORE_PATH` (must be an absolute path).

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PERPLEXITY_API_KEY` | Yes | Your Perplexity API key. Get one at https://www.perplexity.ai/api-platform |
| `OPEN_AEO_STORE_PATH` | No | Custom absolute path for history.json. Defaults to `~/.open-aeo/history.json` |

## Documentation

Full documentation is in the [`docs/`](docs/) folder, including tool reference, how citation detection works, storage reference, and study data with evidence charts.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT
