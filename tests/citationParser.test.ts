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
});
