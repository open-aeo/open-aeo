import { describe, it, expect } from "vitest";
import { parseQueryList } from "../src/core/promptGenerator.js";

describe("parseQueryList", () => {
  it("parses a JSON array", () => {
    const text = `Here you go: ["best pm tool", "linear vs jira"]`;
    expect(parseQueryList(text, 10)).toEqual([
      "best pm tool",
      "linear vs jira",
    ]);
  });

  it("falls back to line parsing, stripping bullets and numbering", () => {
    const text = `1. best pm tool\n2) linear vs jira\n- best issue tracker`;
    expect(parseQueryList(text, 10)).toEqual([
      "best pm tool",
      "linear vs jira",
      "best issue tracker",
    ]);
  });

  it("de-duplicates case-insensitively", () => {
    const text = `["best pm tool", "Best PM Tool", "linear vs jira"]`;
    expect(parseQueryList(text, 10)).toEqual([
      "best pm tool",
      "linear vs jira",
    ]);
  });

  it("caps to the limit", () => {
    const text = `["a", "b", "c", "d"]`;
    expect(parseQueryList(text, 2)).toEqual(["a", "b"]);
  });

  it("drops blank lines and surrounding quotes", () => {
    const text = `\n"best pm tool"\n\n   \n'linear vs jira'\n`;
    expect(parseQueryList(text, 10)).toEqual([
      "best pm tool",
      "linear vs jira",
    ]);
  });

  it("returns an empty list for empty input", () => {
    expect(parseQueryList("", 10)).toEqual([]);
  });
});
