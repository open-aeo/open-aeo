# Storage reference

All data is stored locally. Nothing leaves your machine.

## File locations

By default, three files are written to `~/.open-aeo/`:

- `~/.open-aeo/history.json` — citation check results from `aeo_check` and `aeo_report`
- `~/.open-aeo/gap-history.json` — gap analysis results from `aeo_gap_report`
- `~/.open-aeo/competitor-history.json` — page analysis results from `aeo_analyse` and `aeo_recommend`

If the `OPEN_AEO_STORE_PATH` environment variable is set to an absolute path, `history.json` is written to that path and the other two files are written to the same directory. The value must be an absolute path; a relative path causes the server to throw an error on startup.

## File format

All three files are JSON arrays. Each new result is appended to the appropriate array on write. Writes are serialised through a queue so concurrent tool calls do not corrupt the file.

The `AeoCheckResult` interface stored in `history.json`:

```typescript
{
  query: string;
  targetDomain: string;
  cited: boolean;
  position: number | null;   // 0-based index in citations array, null if not in citations
  competitorUrls: string[];  // citation URLs that did not match targetDomain
  timestamp: string;         // ISO 8601
}
```

The `GapAnalysisResult` interface stored in `gap-history.json` includes the original `GapTarget` input, a nested `AeoCheckResult` from the live validation check, gap classification booleans (`confirmedGap`, `peecConfirmed`, `liveConfirmed`), the top competitor domain found in the live check, and a recommendation string.

The `CompetitorAnalysis` interface stored in `competitor-history.json`:

```typescript
{
  query: string;
  targetDomain: string;
  competitorUrl: string;
  competitorDomain: string;
  citationPosition: number;
  signals: PageSignals;      // see src/core/types.ts for the full definition
  analysedAt: string;        // ISO 8601
}
```

`PageSignals` is a large object containing word count, heading count, FAQ and schema flags, link counts, meta description, page title, and first paragraph. The full definition is in `src/core/types.ts`.

## Backup, reset, and corruption

To back up your data, copy the file to a new location. To reset, delete the file — the tool recreates it on the next write. If a file contains invalid JSON, the tool logs a warning to stderr and treats it as empty. The corrupted file is left in place; it is not overwritten until a new result is written.

## Size

Each `AeoCheckResult` entry is roughly 400–600 bytes depending on the number of competitor URLs. 10,000 citation checks produce approximately 5MB of data. There is no automatic rotation or cleanup; the file grows indefinitely until you delete it.
