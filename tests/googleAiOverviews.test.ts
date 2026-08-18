import { describe, it, expect } from "vitest";
import {
  extractAiOverview,
  GoogleAiOverviews,
  type DataForSeoPayload,
} from "../src/adapters/GoogleAiOverviews.js";

// Wraps SERP items in DataForSEO's task/result envelope. Only the fields the
// extractor reads are populated, keeping each case focused on the shape under
// test rather than reconstructing a full SERP payload.
function payload(items: unknown[], statusCode = 20000): DataForSeoPayload {
  return {
    tasks: [{ status_code: statusCode, result: [{ items }] }],
  } as DataForSeoPayload;
}

describe("extractAiOverview", () => {
  it("pulls the answer text and reference URLs in order", () => {
    const result = extractAiOverview(
      payload([
        { type: "organic", title: "not the overview" },
        {
          type: "ai_overview",
          markdown: "Linear is popular with engineering teams.",
          references: [
            { url: "https://linear.app/docs" },
            { url: "https://news.ycombinator.com/item?id=1" },
          ],
        },
      ]),
    );

    expect(result.answerText).toBe("Linear is popular with engineering teams.");
    expect(result.citations).toEqual([
      "https://linear.app/docs",
      "https://news.ycombinator.com/item?id=1",
    ]);
  });

  it("collects references from nested expanded elements", () => {
    const result = extractAiOverview(
      payload([
        {
          type: "ai_overview",
          markdown: "Top level.",
          references: [{ url: "https://a.com" }],
          items: [
            {
              type: "ai_overview_element",
              markdown: "Expanded detail.",
              references: [{ url: "https://b.com" }],
            },
          ],
        },
      ]),
    );

    expect(result.answerText).toBe("Top level.\n\nExpanded detail.");
    expect(result.citations).toEqual(["https://a.com", "https://b.com"]);
  });

  it("de-duplicates repeated URLs, keeping first occurrence", () => {
    const result = extractAiOverview(
      payload([
        {
          type: "ai_overview",
          references: [
            { url: "https://a.com" },
            { url: "https://b.com" },
            { url: "https://a.com" },
          ],
        },
      ]),
    );

    expect(result.citations).toEqual(["https://a.com", "https://b.com"]);
  });

  it("falls back to text when markdown is absent", () => {
    const result = extractAiOverview(
      payload([{ type: "ai_overview", text: "Plain text answer." }]),
    );

    expect(result.answerText).toBe("Plain text answer.");
  });

  it("ignores references that carry no url", () => {
    const result = extractAiOverview(
      payload([
        {
          type: "ai_overview",
          references: [{ source: "Wikipedia" }, { url: "https://a.com" }],
        },
      ]),
    );

    expect(result.citations).toEqual(["https://a.com"]);
  });

  // Google does not render an AI Overview for every query. That is a real
  // answer of "you were not shown", not a failure, so it must not throw.
  it("returns an empty response when the SERP has no ai_overview block", () => {
    const result = extractAiOverview(
      payload([{ type: "organic", title: "a normal result" }]),
    );

    expect(result).toEqual({ answerText: "", citations: [] });
  });

  it("returns an empty response when the task carries no result", () => {
    expect(
      extractAiOverview({ tasks: [{ status_code: 20000, result: null }] }),
    ).toEqual({ answerText: "", citations: [] });
  });

  // DataForSEO reports task-level failures in the body with HTTP 200, so the
  // status code has to be read rather than trusting the transport.
  it("throws on a task-level error code", () => {
    expect(() => extractAiOverview(payload([], 40401))).toThrow(
      /DataForSEO task failed \(40401\)/,
    );
  });
});

describe("GoogleAiOverviews", () => {
  it("rejects credentials that are not a login:password pair", () => {
    expect(() => new GoogleAiOverviews("just-a-token")).toThrow(
      /login:password/,
    );
  });

  it("accepts a login:password pair", () => {
    const engine = new GoogleAiOverviews("user@example.com:secret");
    expect(engine.name).toBe("google-ai-overviews");
    expect(engine.model).toBe("ai-overviews");
  });
});
