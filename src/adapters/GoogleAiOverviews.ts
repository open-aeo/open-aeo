import { IAnswerEngine } from "../ports/IAnswerEngine.js";
import { EngineName, EngineResponse } from "../core/types.js";

// Google AI Overviews, sourced through DataForSEO (BRG-139).
//
// Google publishes no citations API for AI Overviews, so the answer and its
// sources have to come from a SERP provider. DataForSEO's "live/advanced"
// endpoint returns the SERP as a list of typed items, one of which may be an
// `ai_overview` block carrying the rendered answer plus its references.
//
// Two shapes matter and both are handled below:
//   - references sitting directly on the ai_overview item
//   - references sitting on nested expanded elements, which is what comes back
//     when the overview is returned in its collapsed/expandable form
//
// An AI Overview is not shown for every query. When Google does not render one
// the SERP simply has no ai_overview item, which is a legitimate "no answer"
// rather than a failure, so it resolves to an empty response instead of
// throwing. A genuinely broken call (auth, quota, malformed payload) throws.

const ENDPOINT =
  "https://api.dataforseo.com/v3/serp/google/organic/live/advanced";

// DataForSEO's default market. US English is where AI Overviews rolled out
// first and is the widest corpus, which makes it the sane default for a
// visibility baseline.
const DEFAULT_LOCATION_CODE = 2840;
const DEFAULT_LANGUAGE_CODE = "en";

interface AiOverviewReference {
  url?: string;
  source?: string;
  domain?: string;
}

interface AiOverviewItem {
  type?: string;
  text?: string;
  markdown?: string;
  references?: AiOverviewReference[];
  items?: AiOverviewItem[];
}

interface DataForSeoResult {
  items?: AiOverviewItem[];
}

interface DataForSeoTask {
  status_code?: number;
  status_message?: string;
  result?: DataForSeoResult[] | null;
}

export interface DataForSeoPayload {
  status_code?: number;
  status_message?: string;
  tasks?: DataForSeoTask[];
}

// Walks an ai_overview item (and any nested expanded elements) collecting the
// rendered text and every referenced URL, in the order Google showed them.
function collectFromOverview(
  item: AiOverviewItem,
  text: string[],
  urls: string[],
): void {
  const body = item.markdown ?? item.text;
  if (body) text.push(body);

  for (const reference of item.references ?? []) {
    if (reference.url) urls.push(reference.url);
  }

  for (const nested of item.items ?? []) {
    collectFromOverview(nested, text, urls);
  }
}

// Pulls the AI Overview answer and its citations out of a DataForSEO payload.
// Exported so the parsing can be tested against recorded payloads without
// making a live, paid request.
export function extractAiOverview(payload: DataForSeoPayload): EngineResponse {
  const task = payload.tasks?.[0];

  // DataForSEO reports per-task failures in the body with a 200 on the wire,
  // so the status code has to be read rather than relying on response.ok.
  // 20000 is its success code.
  if (task && task.status_code !== undefined && task.status_code !== 20000) {
    throw new Error(
      `DataForSEO task failed (${task.status_code}): ${
        task.status_message ?? "no message"
      }`,
    );
  }

  const items = task?.result?.[0]?.items ?? [];
  const text: string[] = [];
  const urls: string[] = [];

  for (const item of items) {
    if (item.type === "ai_overview") collectFromOverview(item, text, urls);
  }

  // Same-URL references are common when one page backs several sentences;
  // a citation list is a set of sources, so keep first occurrence only.
  const citations = [...new Set(urls)];

  return { answerText: text.join("\n\n"), citations };
}

export class GoogleAiOverviews implements IAnswerEngine {
  readonly name: EngineName = "google-ai-overviews";
  readonly model = "ai-overviews";
  private readonly authHeader: string;

  // `credentials` is a DataForSEO "login:password" pair, stored as one string
  // because the key store holds a single secret per provider.
  constructor(credentials: string) {
    const trimmed = credentials.trim();
    if (!trimmed.includes(":")) {
      throw new Error(
        "DataForSEO credentials must be in 'login:password' form",
      );
    }
    this.authHeader = `Basic ${btoa(trimmed)}`;
  }

  async search(query: string): Promise<EngineResponse> {
    let response: Response;
    try {
      response = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: this.authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([
          {
            keyword: query,
            location_code: DEFAULT_LOCATION_CODE,
            language_code: DEFAULT_LANGUAGE_CODE,
            // Without this the SERP comes back without the AI Overview block.
            load_async_ai_overview: true,
          },
        ]),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Answer Engine API Error: ${message}`, { cause: error });
    }

    if (!response.ok) {
      throw new Error(
        `Answer Engine API Error: DataForSEO responded ${response.status}`,
      );
    }

    const payload = (await response.json()) as DataForSeoPayload;
    return extractAiOverview(payload);
  }
}
