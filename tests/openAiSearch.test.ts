import { describe, it, expect } from "vitest";
import type { Response as OpenAIResponse } from "openai/resources/responses/responses";
import { extractCitations } from "../src/adapters/OpenAiSearch.js";

// Build a minimal Responses-API-shaped object for the extractor. Only the
// fields the extractor reads are populated; the cast keeps the test focused
// without reconstructing the full SDK type.
function responseWithAnnotations(
  annotations: Array<{ type: string; url?: string }>,
): OpenAIResponse {
  return {
    output: [
      {
        type: "message",
        content: [{ type: "output_text", text: "answer", annotations }],
      },
    ],
  } as unknown as OpenAIResponse;
}

describe("OpenAiSearch.extractCitations", () => {
  it("pulls url_citation URLs in order", () => {
    const response = responseWithAnnotations([
      { type: "url_citation", url: "https://a.com/x" },
      { type: "url_citation", url: "https://b.com/y" },
    ]);

    expect(extractCitations(response)).toEqual([
      "https://a.com/x",
      "https://b.com/y",
    ]);
  });

  it("de-duplicates repeated URLs, keeping first occurrence", () => {
    const response = responseWithAnnotations([
      { type: "url_citation", url: "https://a.com/x" },
      { type: "url_citation", url: "https://a.com/x" },
      { type: "url_citation", url: "https://b.com/y" },
    ]);

    expect(extractCitations(response)).toEqual([
      "https://a.com/x",
      "https://b.com/y",
    ]);
  });

  it("ignores non-url_citation annotations", () => {
    const response = responseWithAnnotations([
      { type: "file_citation" },
      { type: "url_citation", url: "https://a.com/x" },
    ]);

    expect(extractCitations(response)).toEqual(["https://a.com/x"]);
  });

  it("returns an empty array when there is no output", () => {
    expect(extractCitations({} as unknown as OpenAIResponse)).toEqual([]);
  });

  it("skips output items that are not messages", () => {
    const response = {
      output: [
        { type: "web_search_call" },
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: "answer",
              annotations: [{ type: "url_citation", url: "https://a.com/x" }],
            },
          ],
        },
      ],
    } as unknown as OpenAIResponse;

    expect(extractCitations(response)).toEqual(["https://a.com/x"]);
  });
});
