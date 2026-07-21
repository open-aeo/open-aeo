import { describe, it, expect } from "vitest";
import {
  extractHost,
  urlMatchesDomain,
  canonicalizeUrl,
  dedupeUrls,
  mentionsBrand,
} from "../src/core/urlMatch.js";

describe("extractHost", () => {
  it("lower-cases and strips www", () => {
    expect(extractHost("https://WWW.Notion.so/product")).toBe("notion.so");
  });

  it("parses URLs with no scheme", () => {
    expect(extractHost("notion.so/path")).toBe("notion.so");
  });

  it("keeps subdomains other than www", () => {
    expect(extractHost("https://docs.notion.so")).toBe("docs.notion.so");
  });

  it("returns null for junk", () => {
    expect(extractHost("")).toBe(null);
    expect(extractHost("   ")).toBe(null);
    expect(extractHost("not a url")).toBe(null);
  });
});

describe("urlMatchesDomain", () => {
  it("matches exact host and www variants", () => {
    expect(urlMatchesDomain("https://notion.so/x", "notion.so")).toBe(true);
    expect(urlMatchesDomain("https://www.notion.so", "notion.so")).toBe(true);
  });

  it("matches subdomains of the target", () => {
    expect(
      urlMatchesDomain("https://developers.notion.so/api", "notion.so"),
    ).toBe(true);
  });

  it("normalizes the target domain itself", () => {
    expect(
      urlMatchesDomain("https://linear.app", "https://www.linear.app/"),
    ).toBe(true);
  });

  it("does NOT match a domain embedded in a different host (the key bug)", () => {
    expect(urlMatchesDomain("https://linear.app.spam.com", "linear.app")).toBe(
      false,
    );
    expect(urlMatchesDomain("https://mynotion.so", "notion.so")).toBe(false);
    expect(urlMatchesDomain("https://notlinear.app", "linear.app")).toBe(false);
  });

  it("ignores path and query when matching", () => {
    expect(
      urlMatchesDomain("https://notion.so/blog?ref=x#frag", "notion.so"),
    ).toBe(true);
  });
});

describe("canonicalizeUrl", () => {
  it("strips utm and other tracking params", () => {
    expect(
      canonicalizeUrl("https://a.com/page?utm_source=openai&id=5&gclid=abc"),
    ).toBe("a.com/page?id=5");
  });

  it("drops www, trailing slash, and fragment", () => {
    expect(canonicalizeUrl("https://www.a.com/page/#section")).toBe(
      "a.com/page",
    );
  });

  it("treats tracking-only URLs from different engines as the same page", () => {
    const fromOpenai = canonicalizeUrl("https://a.com/page?utm_source=openai");
    const plain = canonicalizeUrl("https://www.a.com/page/");
    expect(fromOpenai).toBe(plain);
  });

  it("falls back to the trimmed input when unparseable", () => {
    expect(canonicalizeUrl("  not a url  ")).toBe("not a url");
  });
});

describe("dedupeUrls", () => {
  it("removes canonical duplicates, keeping the first original string", () => {
    const urls = [
      "https://a.com/page?utm_source=openai",
      "https://www.a.com/page/",
      "https://b.com",
    ];
    expect(dedupeUrls(urls)).toEqual([
      "https://a.com/page?utm_source=openai",
      "https://b.com",
    ]);
  });
});

describe("mentionsBrand", () => {
  it("matches on a word boundary, case-insensitively", () => {
    expect(mentionsBrand("We recommend Linear for teams.", "Linear")).toBe(
      true,
    );
    expect(mentionsBrand("users love NOTION", "Notion")).toBe(true);
  });

  it("does NOT match the brand inside another word", () => {
    expect(mentionsBrand("developers work linearly", "Linear")).toBe(false);
    expect(mentionsBrand("this is nonlinear", "Linear")).toBe(false);
  });

  it("handles brands with regex-significant characters", () => {
    expect(mentionsBrand("I use Node.js daily", "Node.js")).toBe(true);
    expect(mentionsBrand("written in C++ here", "C++")).toBe(true);
  });

  it("returns false for an empty brand", () => {
    expect(mentionsBrand("anything", "")).toBe(false);
    expect(mentionsBrand("anything", "   ")).toBe(false);
  });
});
