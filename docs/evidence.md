# Study data and evidence

This page documents the 105-check study that informed open-aeo's signal detection and recommendation logic. All numbers here come from that study, not from estimates.

## Study scope

20 queries across 4 categories. 5 brands per query, each checked once against Perplexity using the `sonar` model. 105 total checks (some queries ran twice in batch mode).

| Category | Queries | Brands checked |
|----------|---------|----------------|
| AI coding assistants | 5 | Cursor, GitHub Copilot, Codeium, Tabnine, and others |
| Deployment platforms | 5 | Vercel, Netlify, Fly.io, Render, and others |
| Databases | 5 | Supabase, Firebase, Neon, PlanetScale, and others |
| Project tracking | 5 | Linear, Plane, Shortcut, and others |

Overall citation rate across all 105 checks: **43%**. Third-party sources accounted for **86%** of all cited URLs — meaning brand-owned pages were only 14% of what Perplexity actually cited. GitHub Copilot reached **100% citation rate** across all queries it was tested on. Three queries produced zero citations for any brand.

YouTube appeared **60 times** across all competitor URL arrays — the most of any single domain. It ranked in the top 3 competitor domains in every category.

---

## Competitor page signal analysis

10 cases where a brand was absent from Perplexity's citations, with the page signals of the competitor that displaced it.

**[Open interactive chart →](competitor-signal-analysis.html)**

| # | Brand missing | Query | Competitor that won | Words | H-tags | FAQ | FAQ schema | Article schema | Comp table | Updated |
|---|--------------|-------|-------------------|-------|--------|-----|------------|----------------|------------|---------|
| 1 | Cursor | best AI tool for code review | blog.logrocket.com | 2,450 | 38 | ✗ | ✗ | ✗ | ✓ | ✓ |
| 2 | Fly.io | best platform for deploying Docker containers | digitalocean.com | 1,457 | 23 | ✓ | ✗ | ✗ | ✗ | ✗ |
| 3 | Linear | best project mgmt tool for software teams | paymoapp.com | 17,893 | 63 | ✗ | ✗ | ✗ | ✗ | ✓ |
| 4 | Supabase | best database for building a SaaS product | acecloud.ai | 3,944 | 17 | ✓ | ✗ | ✓ | ✓ | ✓ |
| 5 | Firebase | best database for a Next.js app | dev.to | 1,263 | 15 | ✗ | ✗ | ✓ | ✗ | ✓ |
| 6 | Render | cheapest way to host a full stack web app | dev.to/wasp | 3,568 | 14 | ✗ | ✗ | ✓ | ✗ | ✓ |
| 7 | Codeium | best AI coding assistant for VS Code | secondtalent.com | 4,415 | 80 | ✓ | ✓ | ✓ | ✗ | ✓ |
| 8 | Tabnine | Cursor vs GitHub Copilot which is better | builder.io | 2,679 | 53 | ✗ | ✗ | ✓ | ✗ | ✓ |
| 9 | Neon | best database for a Next.js app | dev.to | 1,263 | 15 | ✗ | ✗ | ✓ | ✗ | ✓ |
| 10 | Plane | best project mgmt tool for software teams | paymoapp.com | 17,893 | 63 | ✗ | ✗ | ✗ | ✗ | ✓ |

Key findings from this set:

paymoapp.com's 17,893-word roundup displaced both Linear and Plane with no schema markup at all — pure content mass won. secondtalent.com is the highest-signal page in the set (FAQ section + FAQPage schema + Article schema + 80 headings + freshness signal) and dominated the VS Code query across all competing brands. Fly.io and Neon both lost to pages under 1,500 words with no schema — the lowest bar in the entire set, making these the quickest wins to capture. Only 1 of these 10 competitor pages (secondtalent.com) uses FAQPage schema; it is also the strongest performer.

---

## Competitor domain frequency by category

Which domains appeared most often across all competitor citation arrays, broken down by query category.

**[Open bar chart (static, 4-panel) →](competitor-domain-frequency.html)**
**[Open bar chart (interactive tabs, with raw data) →](competitor-domain-frequency-interactive.html)**

### AI coding (5 queries · 25 checks)

| Rank | Domain | Appearances |
|------|--------|------------|
| 1 | blog.logrocket.com | 4 |
| 2 | builder.io | 3 |
| 3 | secondtalent.com | 3 |
| 4 | marcolenzo.eu | 1 |
| 5 | pensero.ai | 1 |
| 6 | youtube.com | 1 |

blog.logrocket.com locked out all 4 non-GitHub brands on the code review query alone.

### Deployment (5 queries · 25 checks)

| Rank | Domain | Appearances |
|------|--------|------------|
| 1 | digitalocean.com | 4 |
| 2 | netlify.com/guides | 3 |
| 3 | vercel.com/kb | 3 |
| 4 | dev.to (ethanleetech) | 2 |
| 5 | dev.to/wasp | 2 |
| 6 | xda-developers.com | 1 |

digitalocean.com appeared for 4 of 5 brands on the Docker query. When the full raw URL set is counted across all deployment queries, dev.to accumulates 15+ appearances across multiple author slugs — the platform, not individual authors, is the actual competitor.

### Databases (5 queries · 25 checks)

| Rank | Domain | Appearances |
|------|--------|------------|
| 1 | acecloud.ai | 5 |
| 2 | dev.to (ethanleetech) | 3 |
| 3 | koyeb.com | 3 |
| 4 | cockroachlabs.com | 3 |
| 5 | jakeprins.com | 3 |

acecloud.ai locked out all 5 brands on the SaaS database query. jakeprins.com, a single-author blog, outranked all database brands on the Supabase vs Firebase query. koyeb.com accumulated 8 appearances across free-tier and serverless queries despite not being a primary database product.

### Project tracking (5 queries · 25 checks — extended to 50 in batch mode)

| Rank | Domain | Appearances |
|------|--------|------------|
| 1 | paymoapp.com | 8 |
| 2 | landbase.com | 4 |
| 3 | youtube.com | 3 |
| 4 | larksuite.com | 2 |
| 5 | openproject.org | 1 |
| 6 | shortcut.com | 1 |
| 7 | dev.to/parizad | 1 |

paymoapp.com appeared 8 times — one mega-roundup article blocking 4 brands across 2 query runs. In the full raw URL set (50 records), monday.com appears 17 times as a competitor domain, making it the most-present brand not in the tracked set.

---

## What these signals predict

The table below shows how often each signal appeared on competitor pages in the 10-case set, and what aeo_recommend looks for when generating tasks.

| Signal | Appearances (of 10) | Task priority when found |
|--------|---------------------|--------------------------|
| Last modified date | 8 | low |
| Article schema | 6 | medium |
| FAQ section | 3 | high |
| Comparison table | 3 | medium |
| FAQ schema | 1 | high |
| HowTo schema | 0 | medium (if found elsewhere) |

The freshness signal (last modified date) is the most common because Article and BlogPosting schema types trigger it — any page with Article schema is counted as having a freshness signal, even if no explicit date is visible. Article schema was present on 6 of 10 pages. FAQ schema appeared on only 1 page, yet that page (secondtalent.com) was the strongest competitor in the set. This is why FAQPage schema generates a high-priority task: low adoption across competitors plus strong correlation with the best-performing page.
