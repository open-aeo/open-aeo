import { describe, it, expect } from "vitest";
import { parseAeoResponse } from "../src/core/citationParser.js";
import { TargetConfig, EngineResponse } from "../src/core/types.js";

describe("citationParser", () => {
  const mockConfig: TargetConfig = {
    query: "best ai note taking apps",
    targetDomain: "notion.so",
    brandName: "Notion",
  };

  it("passed if brand is mentioned in text, even if domain is not in citations", () => {
    const mockResponse: EngineResponse = {
      answerText:
        "Many users prefer Notion for its versatility, though links below point to reviews.",
      citations: [
        "https://techcrunch.com/review-of-productivity-tools",
        "https://medium.com/top-10-apps",
      ],
    };

    const result = parseAeoResponse(mockConfig, mockResponse);

    expect(result.cited).toBe(true);
    expect(result.position).toBe(null);
    expect(result.targetDomain).toBe("notion.so");
  });

  it("should handle case-insensitive brand matching", () => {
    const mockResponse: EngineResponse = {
      answerText: "users often mention NOTION as a leader.",
      citations: [],
    };

    const result = parseAeoResponse(mockConfig, mockResponse);
    expect(result.cited).toBe(true);
  });

  it("should return cited: false if neither domain nor brand name is found", () => {
    const mockResponse: EngineResponse = {
      answerText: "Microsoft OneNote and Evernote are classic choices.",
      citations: ["https://onenote.com", "https://evernote.com"],
    };

    const result = parseAeoResponse(mockConfig, mockResponse);
    expect(result.cited).toBe(false);
  });

  it("matches the target domain on a subdomain, not as a loose substring", () => {
    const config: TargetConfig = {
      query: "best pm tool",
      targetDomain: "linear.app",
    };
    const response: EngineResponse = {
      answerText: "See below.",
      citations: [
        "https://linear.app.spam.com/fake", // must NOT count as the target
        "https://docs.linear.app/guide", // subdomain — must count
      ],
    };

    const result = parseAeoResponse(config, response);
    expect(result.cited).toBe(true);
    expect(result.position).toBe(1); // the real subdomain, not the spam host
    expect(result.competitorUrls).toEqual(["https://linear.app.spam.com/fake"]);
  });

  it("does not treat a brand embedded in another word as a mention", () => {
    const response: EngineResponse = {
      answerText: "Some developers structure their work linearly.",
      citations: [],
    };
    const result = parseAeoResponse(
      { query: "q", targetDomain: "linear.app", brandName: "Linear" },
      response,
    );
    expect(result.cited).toBe(false);
  });

  it("de-duplicates competitor URLs that differ only by tracking params", () => {
    const response: EngineResponse = {
      answerText: "See below.",
      citations: [
        "https://asana.com/pm?utm_source=openai",
        "https://www.asana.com/pm/",
        "https://trello.com",
      ],
    };
    const result = parseAeoResponse(
      { query: "q", targetDomain: "notion.so" },
      response,
    );
    expect(result.competitorUrls).toEqual([
      "https://asana.com/pm?utm_source=openai",
      "https://trello.com",
    ]);
  });
});
