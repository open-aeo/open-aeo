// Turns a domain or topic into a candidate list of queries to check. The hardest
// part of using an AEO tool is knowing WHAT to check; this removes the blank page.

export interface IQueryGenerator {
  // Generate up to `count` candidate queries for a domain or topic.
  generate(input: string, count: number): Promise<string[]>;
}

// Extract a clean query list from an LLM's free-form response. Prefers a JSON
// array; falls back to line parsing (stripping bullets and numbering). Trims,
// drops blanks, de-duplicates case-insensitively, and caps to `limit`. Kept pure
// and exported so it is unit-testable without any network call.
export function parseQueryList(text: string, limit: number): string[] {
  const candidates = extractCandidates(text);

  const seen = new Set<string>();
  const queries: string[] = [];
  for (const raw of candidates) {
    const cleaned = cleanLine(raw);
    if (cleaned === "") continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    queries.push(cleaned);
    if (queries.length >= limit) break;
  }
  return queries;
}

function extractCandidates(text: string): string[] {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start !== -1 && end > start) {
    try {
      const parsed = JSON.parse(text.slice(start, end + 1));
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item));
      }
    } catch {
      // fall through to line parsing
    }
  }
  return text.split("\n");
}

function cleanLine(line: string): string {
  return line
    .trim()
    .replace(/^[-*•\d.)\]\s"']+/, "") // leading bullets, numbering, quotes
    .replace(/["']+$/, "") // trailing quotes
    .replace(/,\s*$/, "") // trailing comma from a JSON-ish line
    .trim();
}
