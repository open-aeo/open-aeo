# AEO Gap Fighter — Peec MCP Challenge Submission

**Category:** Competitive Analysis + Content Optimization
**Tools used:** Peec MCP + open-aeo MCP + Claude Desktop
**Time to set up:** ~10 minutes
**Repeatability:** Run weekly in a single Claude conversation

## What this workflow does

Marketers using Peec can see where competitors are outranking them in AI search, but Peec data has an inherent ~24h delay. A gap that Peec flags may already be fixed — or a new gap may have emerged that Peec hasn't caught yet. Acting on stale data wastes content budget.

This workflow chains Peec's historical gap filter (which surfaces queries where 2+ competitors appear but you don't) with open-aeo's live Perplexity citation check. Every gap Peec identifies gets validated in real-time. The output is a content brief sorted by opportunity score — confirmed gaps at the top, closing gaps flagged for monitoring, emergent gaps caught before they become entrenched.

## Setup (one-time, ~10 minutes)

### 1. Install open-aeo

```bash
git clone https://github.com/open-aeo/open-aeo.git
cd open-aeo
pnpm install && pnpm run build
```

Get a Perplexity API key at https://www.perplexity.ai/api-platform (~$5/1,000 requests)

### 2. Connect both MCPs in Claude Desktop

**open-aeo** — add manually to `~/Library/Application Support/Claude/claude_desktop_config.json`
(on Windows: `%APPDATA%/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "open-aeo": {
      "command": "node",
      "args": ["/absolute/path/to/open-aeo/dist/index.js"],
      "env": { "PERPLEXITY_API_KEY": "your-pplx-key-here" }
    }
  }
}
```

**Peec** — Claude Desktop uses its built-in Connector system for Peec (not the JSON config file). Go to **Settings → Connectors**, search for **Peec AI**, and install it. OAuth is handled automatically.

Restart Claude Desktop. To verify both are connected, start a new conversation and ask: *"What MCP tools do you have available?"* — Claude will list all tools from both servers. You can also check Settings → Developer to confirm the open-aeo server shows as connected.

## The Weekly Workflow

Copy and paste this entire prompt into Claude Desktop once a week. Replace the placeholders with your actual domain and brand name.

```
I want a full AEO Gap Fighter report for [YOUR-DOMAIN.COM].

STEP 1 — Peec: Find my gaps
Use the Peec MCP to run get_domain_report for my project with:
- Date range: last 30 days
- gap filter: operator gte, value 2 (queries where I am absent but 2+ competitors appear)
- dimensions: ["prompt_id"] to see which specific queries I am losing
Also run get_brand_report to get my overall visibility score for context.
Extract: the losing queries, competitor domains per query, and opportunity scores.
Sort by opportunity_score descending and take the top 10.

STEP 2 — open-aeo: Validate gaps are live right now
Feed those top 10 queries into the aeo_gap_report tool with these fields per item:
- query: the query text from Step 1
- targetDomain: [YOUR-DOMAIN.COM]
- brandName: [YOUR BRAND NAME]
- competitorDomains: the competitor domains from Step 1 for that query
- peecOpportunityScore: the opportunity score from Step 1
- source: "peec"

STEP 3 — Content briefs for confirmed gaps
From the aeo_gap_report output, take every CONFIRMED GAP (shown with [!!])
sorted by opportunity score. For the top 3, write a content brief:
1. Recommended page type: comparison, how-to, listicle, or FAQ
2. Suggested page title optimised for the exact query
3. Five key points to cover, informed by what the winning competitor page contains
4. Two or three internal links to suggest from my existing content
5. Effort estimate: Low (update existing page) / Medium (new post) / High (new page + assets)

STEP 4 — Track progress
Call aeo_gap_history for [YOUR-DOMAIN.COM] to show trend vs last week.
Flag any gaps that have closed since last run ([~]) and any new
gaps that emerged this week ([!]).

Return the complete output as a single markdown document I can paste into Notion.
```

## Why this workflow wins

- Peec surfaces the gap. open-aeo confirms it is still real right now. Acting on confirmed-only gaps focuses content budget on genuine opportunities.
- Most submissions produce dashboards or summaries. This produces an actionable brief with specific page titles, content angles, and effort estimates. The full workflow runs in one Claude conversation in under 5 minutes and outputs a Notion-ready document with zero manual formatting.
- Running this every Monday morning builds a trend database in `~/.open-aeo/gap-history.json`. A gap appearing for 3 consecutive weeks is a high-priority content investment. A gap that closes after publishing confirms the strategy is working.

## Example output

Below is a realistic example for a fictional SaaS brand **Flowdesk** (`flowdesk.co`) competing against Notion and Asana.

---

```
=========================================
AEO GAP REPORT -- flowdesk.co
Generated: 4/24/2026, 9:14:03 AM
=========================================

SUMMARY
Total gaps analysed:  6
[!!] Confirmed gaps:  3  (both Peec + live)
[!]  Emerging gaps:   1  (live only)
[~]  Closing gaps:    1  (Peec gap, now cited live)
[ok] Already cited:   1

-----------------------------------------
[!!] CONFIRMED GAPS (act on these first)
-----------------------------------------

1. "best tool for async team updates"
   Top competitor: https://notion.so/blog/async-work-guide
   Opportunity score: 0.91
   -> [!!] CONFIRMED GAP: You are not cited for "best tool for async team updates".
      https://notion.so/blog/async-work-guide is winning. Action: Create or update
      content targeting this query. Focus on async-team-updates-specific structured
      content (FAQ, how-to, or comparison page). Opportunity score: 0.91.

   CONTENT BRIEF
   Page type:   How-to / comparison hybrid
   Title:       "Async Team Updates in 2026: How Flowdesk Beats the Notion Inbox"
   Key points:
     1. Define async updates vs. real-time messaging — why async wins for distributed teams
     2. How Flowdesk's update threads differ from Notion's database-driven approach
     3. Side-by-side: notification control, threading, search, and mobile UX
     4. Template: the 5-minute Monday async standup format
     5. Integrations: Slack, Linear, and GitHub — how Flowdesk ties updates to work
   Internal links: /features/threads, /customers/remote-teams
   Effort: Medium (new post, ~1,200 words + comparison table)

2. "project management tool for small teams"
   Top competitor: https://asana.com/resources/project-management-small-business
   Opportunity score: 0.78
   -> [!!] CONFIRMED GAP: You are not cited for "project management tool for small teams".
      https://asana.com/resources/project-management-small-business is winning.
      Opportunity score: 0.78.

3. "notion alternative for startups"
   Top competitor: https://asana.com/go/notion-alternative
   Opportunity score: 0.65
   -> [!!] CONFIRMED GAP: You are not cited for "notion alternative for startups".
      Opportunity score: 0.65.

-----------------------------------------
[!] EMERGING GAPS (live only)
-----------------------------------------

1. "team wiki software 2026"
   Top competitor: https://notion.so/product/wiki
   -> [!] EMERGING GAP: Live check shows you are not cited for "team wiki software 2026"
      on Perplexity. This may be a newly emerged gap not yet in Peec data.
      Monitor and consider refreshing relevant content.

-----------------------------------------
[~] CLOSING GAPS (Peec gap, now cited live)
-----------------------------------------

1. "kanban board for remote teams"
   -> [~] CLOSING GAP: Peec data shows you previously lost "kanban board for remote teams",
      but you are now cited live on Perplexity. Monitor for consistency across other
      AI engines. No immediate action needed.

-----------------------------------------
[ok] ALREADY CITED
-----------------------------------------

1. "flowdesk pricing"
```

Full report: 6 queries analysed in 4 min 12 sec

---

## Repeatability

Running this every Monday morning builds a trend database in `~/.open-aeo/gap-history.json`. The `aeo_gap_history` tool reads this to show direction over time. A gap appearing for 3 consecutive weeks is a high-priority content investment. A gap that closes after publishing confirms the strategy is working. The workflow requires no dashboards, no exports, and no manual spreadsheet tracking.
