# Tool reference

open-aeo registers seven tools with Claude. They appear automatically in Claude Desktop after restarting. You invoke them by describing what you want in plain language.

## aeo_check

Runs a single live citation check against Perplexity and returns whether your domain or brand appeared in the response.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | yes | The exact question to ask Perplexity, e.g. `"best note taking apps for students"` |
| `targetDomain` | string | yes | Domain to check for, e.g. `"notion.so"` |
| `brandName` | string | no | Brand name to match in Perplexity's answer text in addition to the domain URL check |

The output contains a `cited` boolean, a `position` number or null, a `competitorUrls` array, and a timestamp. Position is the index in Perplexity's citations array, starting at 0. It is null when the brand name appears in the answer text but the domain does not appear as a numbered citation — both cases produce `cited: true`. The result is saved to `~/.open-aeo/history.json` automatically.

```
Use aeo_check with query "best CRM for startups" and targetDomain "hubspot.com" and brandName "HubSpot"
```

## aeo_report

Runs multiple citation checks in sequence and returns a summary with per-query results.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `targets` | array of `TargetConfig` | yes | Each element is an object with `query`, `targetDomain`, and optional `brandName` |

Checks run sequentially with a 2-second delay between requests to avoid Perplexity rate limits. If one check fails, the batch continues and records the failure in the output. The output contains a results array and a summary with total, cited, and not-cited counts.

```
Run an aeo_report for these targets:
[
  { "query": "best project management tool", "targetDomain": "linear.app", "brandName": "Linear" },
  { "query": "issue tracker for developers", "targetDomain": "linear.app", "brandName": "Linear" },
  { "query": "agile sprint planning software", "targetDomain": "linear.app" }
]
```

## aeo_history

Retrieves past citation check results from local storage.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | no | Filter by exact query text (case-insensitive) |
| `domain` | string | no | Filter by target domain (partial match, case-insensitive) |

The output is a list of past `AeoCheckResult` objects sorted by timestamp descending. Omitting both parameters returns all stored results. The query filter is an exact match — it returns only results for that specific query string, not queries that contain the term.

```
Show me aeo_history filtered by domain "linear.app"
```

## aeo_gap_report

Takes a list of queries where competitors are outperforming you and validates each gap live against Perplexity. Returns a prioritised report of confirmed gaps, emerging gaps, and gaps that have already closed.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `gaps` | array of `GapTarget` | yes | Each element requires `query`, `targetDomain`, `competitorDomains` (array), and `source` (`"peec"` or `"manual"`). Optional fields: `brandName`, `peecOpportunityScore` (0–1), `peecTopicName` |
| `delayMs` | number | no | Milliseconds between API calls. Default 2000, max 10000. Increase if hitting rate limits. |

This tool is designed to work alongside the Peec AI MCP server. The typical workflow is to pull gap data from Peec, feed it into this tool as `source: "peec"`, and let open-aeo confirm which gaps are live right now versus already closed. Manual gaps work the same way with `source: "manual"`.

```
Run aeo_gap_report with these gaps:
[
  {
    "query": "best note taking app for students",
    "targetDomain": "notion.so",
    "brandName": "Notion",
    "competitorDomains": ["obsidian.md", "evernote.com"],
    "peecOpportunityScore": 0.82,
    "source": "peec"
  }
]
```

## aeo_gap_history

Retrieves historical gap analysis results and shows which gaps have closed, worsened, or persisted over time.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `domain` | string | no | Filter by your target domain. Omit to return results for all domains. |

The output groups results by query and shows the most recent status of each gap. Gaps are marked `[!!]` for confirmed (both Peec and live validation agree), `[!]` for live-confirmed only, `[~]` for Peec-confirmed only, and `[ok]` for gaps that have closed.

```
Show me aeo_gap_history for domain "notion.so"
```

## aeo_analyse

Fetches a single URL and extracts structural page signals to explain why that page is being cited.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `competitorUrl` | string | yes | Full URL of the page to analyse, e.g. `"https://zapier.com/blog/best-note-taking-apps/"` |
| `query` | string | yes | The query this page was cited for |
| `targetDomain` | string | yes | Your domain |
| `citationPosition` | number | yes | 0-based position at which this URL appears in the citation list |

The output is a `PageSignals` object with word count, heading count, FAQ detection, schema markup types, comparison table detection, first paragraph, meta description, and last-modified date presence. The page is fetched directly via HTTP, not through Perplexity. The tool analyses page structure, not content quality. Results are saved to `~/.open-aeo/competitor-history.json`.

```
Use aeo_analyse on "https://zapier.com/blog/free-project-management-software/"
for query "best project management tool for software teams" and targetDomain "linear.app"
with citationPosition 0
```

## aeo_recommend

Runs a fresh citation check, fetches the competitor pages that appeared instead of you, analyses their signals, and returns a prioritised list of content and schema tasks.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | yes | The search query to check and analyse |
| `targetDomain` | string | yes | Your domain |
| `brandName` | string | no | Brand name for text matching |
| `maxCompetitors` | number | no | Number of competitor pages to fetch and analyse. Default 3, max 5. |

The output is a `RecommendationReport` containing your citation status, a `CompetitorAnalysis` array, and a prioritised task list. Tasks are ranked high, medium, or low based on how many competitor pages share each signal. One Perplexity API call plus up to `maxCompetitors` HTTP fetches run sequentially. Total runtime for a 3-competitor check is typically 15–30 seconds.

```
Run aeo_recommend for query "best project management tool for software teams"
and targetDomain "linear.app" with brandName "Linear" and maxCompetitors 3
```
