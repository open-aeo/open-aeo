# Getting started

You need three things before you can run open-aeo: Node.js 20 or higher, a Perplexity API key (https://www.perplexity.ai/api-platform), and Claude Desktop or Claude Code (https://claude.ai/download).

## Installation

There are two ways to install open-aeo. The npx method is recommended — it takes one command and requires no manual config editing.

---

### Option 1 — npx (recommended)

Run this in your terminal:

```bash
npx -y open-aeo install
```

The installer will:
1. Prompt for your Perplexity API key
2. Ask which client to configure — Claude Code, Claude Desktop, or both
3. Write the configuration automatically

Restart Claude when it completes.

To verify Claude Code picked it up:

```bash
claude mcp list
```

You should see `open-aeo` in the list.

---

### Option 2 — manual (git clone)

Use this if you want to modify the source or run a local build. Requires pnpm >= 9.

```bash
git clone https://github.com/open-aeo/open-aeo.git
cd open-aeo
pnpm install && pnpm run build
```

Then open your Claude Desktop configuration file and add:

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

Replace `/absolute/path/to/open-aeo` with the actual path where you cloned the repo. On macOS this is typically `/Users/yourname/open-aeo`. Restart Claude Desktop when done.

---

## Verify the connection

Start a new conversation in Claude and ask:

```
What MCP tools do you have available?
```

Claude will list all connected tools. You should see `aeo_check`, `aeo_report`, `aeo_history`, `aeo_analyse`, `aeo_recommend`, `aeo_gap_report`, and `aeo_gap_history`.

You can also check **Settings → Developer** in Claude Desktop to confirm the server shows as connected.

---

## First check

Try this in a new conversation:

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

"Cited: NO" means neither `linear.app` appeared in Perplexity's citations nor did the text "Linear" appear in its answer. If the domain or brand name had appeared, the result would be "Cited: YES" with a position number.

The competitor URLs are the pages Perplexity used as sources — not competing brand homepages. Third-party roundup articles and comparison posts appear more often than brand homepages because Perplexity treats them as reliable aggregators. A URL appearing here means Perplexity trusted that page as a source.

---

## Storage

Results are saved automatically to `~/.open-aeo/history.json` on every check. The file is a plain JSON array and can be opened in any text editor or piped into `jq`. The directory is created on first write if it does not exist.
