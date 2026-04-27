# Frequently asked questions

## Why should I care about AI citations at all?

AI search engines — Perplexity, ChatGPT Search, Gemini, Claude — are increasingly where people get direct answers instead of a list of links. When someone asks "what's the best project management tool for engineers", they get a paragraph with a recommendation, not ten blue links to click through. If your brand or domain is not in that paragraph or its sources, you are invisible to that user regardless of your Google ranking.

Traditional SEO tells you where you rank on page one. It does not tell you whether AI cites you. That gap is what open-aeo is designed to surface.

---

## Why only Perplexity? What about ChatGPT and Gemini?

Perplexity came first because its API returns a clean, structured `citations` array, making reliable detection straightforward. ChatGPT Search and Gemini Grounding have different API shapes that require different parsing logic.

Multi-engine support is the next planned milestone. The codebase uses a port/adapter pattern — adding a new engine means implementing one interface, not rewriting the tool. Perplexity-only is the current scope, not the intended ceiling.

---

## How accurate is the citation detection?

The detection itself is precise: the tool checks whether your domain appears in Perplexity's citations array and whether your brand name appears in the answer text. Those checks do not produce false negatives.

The limitation is that AI search is non-deterministic. The same query run twice can return different citations. A single result is a snapshot, not a verdict. Running checks across multiple queries and over time gives a much more reliable signal — which is what `aeo_report`, `aeo_gap_report`, and `aeo_history` are designed for.

---

## Does API output match what real users see?

Directionally yes, exactly no. Perplexity's API uses the same underlying model as the web product, but the web UI applies additional ranking and formatting that the raw API does not. Treat API results as a reliable proxy, not a pixel-perfect mirror of what a user sees.

---

## Does this replace SEO tools like Ahrefs or Semrush?

No. They solve different problems. SEO tools tell you where you rank in Google. open-aeo tells you whether AI cites you when someone asks a question your product should answer. Both matter as long as both Google and AI search send traffic.

---

## How much does it cost to run?

Perplexity charges roughly $5 per 1,000 API requests on the sonar model. A single `aeo_check` is one request. An `aeo_report` across 20 queries costs around $0.10. Running a daily report across 50 queries costs around $75 per year.

---

## Is my data sent anywhere?

No. All results are stored locally at `~/.open-aeo/`. There is no telemetry, no cloud sync, and no account required beyond the Perplexity API key.
