# open-aeo

An open-source AEO (Answer Engine Optimization) citation monitor built as an MCP server.
Track whether your domain is cited by AI answer engines like Perplexity — directly inside Claude Desktop.

## What it does

- **`aeo_check`** — live citation check for a single query
- **`aeo_report`** — batch check across multiple queries
- **`aeo_history`** — view historical citation data over time
- **`aeo_gap_report`** — validate Peec gap data live against Perplexity
- **`aeo_gap_history`** — track gap trends over time

## Gap Fighter (Peec Integration)

open-aeo integrates with [Peec AI](https://peec.ai)'s MCP server to close the
loop between historical AI visibility data and live citation checking.

**The workflow:**
1. Use Peec MCP in Claude to find queries where competitors beat you
   (`get_domain_report` with `gap` filter >= 2)
2. Feed those queries into open-aeo's `aeo_gap_report` tool
3. open-aeo runs each query live against Perplexity and confirms which gaps
   are real right now vs. which you've already closed
4. Claude synthesises both into a prioritised content brief

**New tools:**
- **`aeo_gap_report`** — batch gap analysis: validates Peec gap data live,
  produces prioritised recommendations sorted by opportunity score
- **`aeo_gap_history`** — tracks gap trends over time so you can see which
  gaps are closing week-over-week

**Example workflow prompt for Claude Desktop (with both MCPs connected):**

```
I want a full AEO gap report for acemate.ai.

Step 1: Use Peec MCP to call get_domain_report with a gap filter >= 2 for
the last 30 days. Extract all queries where I'm absent but competitors appear.
Include the competitor domains and opportunity scores.

Step 2: Feed those queries into open-aeo's aeo_gap_report tool. Set
source: "peec" and include the competitor domains and opportunity scores
from Step 1.

Step 3: From the gap report, write me a content brief for the top 3
confirmed gaps. For each one: suggest a page type (listicle, how-to,
comparison), a title, the key points to cover, and which competitor URL
to analyse for structure.
```

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

Restart Claude Desktop. To verify, start a new conversation and ask: *"What MCP tools do you have available?"* — Claude will list all connected tools. You can also check Settings → Developer to confirm the server shows as connected.

**For the Gap Fighter workflow**, you need both open-aeo and Peec connected:
- open-aeo: add it to `claude_desktop_config.json` as shown above
- Peec: go to **Settings → Connectors** in Claude Desktop, search for **Peec AI**, and install it — Claude Desktop handles OAuth automatically. Do not add Peec to the JSON config file; it will be rejected.

## Usage

Ask Claude:
- *"Check if acemate.ai is cited for 'best note taking apps'"*
- *"Run an AEO report for these 5 queries"*
- *"Show me my citation history for last week"*
- *"Run a gap report for acemate.ai using Peec data from the last 30 days"*
- *"Which of my gaps from last month have I closed?"*

## Architecture

```
src/
  index.ts
  core/
    types.ts            shared types (TargetConfig, AeoCheckResult, GapTarget,
                        GapAnalysisResult, GapReportSummary)
    citationParser.ts   pure citation detection logic
    gapAnalyser.ts      gap analysis engine (analyseGap, runGapReport, formatGapReport)
  ports/
    IAnswerEngine.ts    interface: search()
    IStorage.ts         interface: save(), getHistory(), saveGapResult(), getGapHistory()
  adapters/
    PerplexityApi.ts    implements IAnswerEngine
    JSONStorage.ts      implements IStorage (stores to ~/.open-aeo/)
  mcp/
    tools.ts            all tool handler functions
    server.ts           MCP server, tool registration
```

Built with the [port/adapter pattern](https://en.wikipedia.org/wiki/Hexagonal_architecture_(software)) —
swapping Perplexity for another engine requires changing one file.

## Tools reference

| Tool | Description |
|------|-------------|
| `aeo_check` | Live citation check for a single query |
| `aeo_report` | Batch citation check across multiple queries |
| `aeo_history` | View historical citation data, filterable by query and domain |
| `aeo_gap_report` | Gap analysis: validates Peec gaps live, returns prioritised recommendations |
| `aeo_gap_history` | Historical gap trends — track which gaps are closing over time |

## Data storage

All data is stored locally at `~/.open-aeo/`. No cloud, no telemetry.

- `~/.open-aeo/history.json` — citation check history
- `~/.open-aeo/gap-history.json` — gap analysis history

Override the storage location with `OPEN_AEO_STORE_PATH` (must be an absolute path).

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT
