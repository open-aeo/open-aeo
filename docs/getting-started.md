# Getting started

You need four things before you can run open-aeo: Node 20 or higher, a Perplexity API key (https://www.perplexity.ai/api-platform), pnpm (npm and yarn also work), and Claude Desktop (https://claude.ai/download).

## Installation

```bash
git clone https://github.com/open-aeo/open-aeo.git
cd open-aeo
pnpm install && pnpm run build
```

## Configuration

Add the following block to your Claude Desktop configuration file. On macOS the file is at `~/Library/Application Support/Claude/claude_desktop_config.json`. On Windows it is at `%APPDATA%\Claude\claude_desktop_config.json`.

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

Replace `/absolute/path/to/open-aeo` with the actual path where you cloned the repository. On macOS this is typically `/Users/yourname/open-aeo`.

## First check

Restart Claude Desktop, then type this into a new conversation:

```
Use aeo_check with query "best project management tool for software teams"
and targetDomain "linear.app" and brandName "Linear"
```

You should see output like this:

```
Citation check: "best project management tool for software teams"
Target: linear.app (Linear)
Cited: NO
Position: N/A
Competitor URLs found:
  https://zapier.com/blog/free-project-management-software/
  https://project-management.com/best-project-management-software-for-small-teams/
  https://www.atlassian.com/agile/project-management/issue-tracking-software
Checked at: 2026-04-25T09:24:06Z
```

"Cited: NO" means neither linear.app appeared in Perplexity's citations array nor did the text "Linear" appear in its answer. If the domain had appeared in any citation URL, or if the brand name had appeared in the answer text, the result would be "Cited: YES" with a position number.

The competitor URLs are the pages Perplexity used as sources when generating its answer — not competing brand homepages. Third-party roundup articles and comparison posts appear more often than brand homepages because Perplexity treats them as reliable aggregators of information. A URL appearing here means Perplexity trusted that page as a source, not that it recommends it as a product.

## Storage

Results are saved automatically to `~/.open-aeo/history.json` on every check. The file is a plain JSON array and can be opened in any text editor or piped into `jq`. The directory is created on first write if it does not already exist.
