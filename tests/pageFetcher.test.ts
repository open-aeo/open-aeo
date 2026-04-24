import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PageFetcher } from "../src/adapters/PageFetcher.js";
import { PageSignals } from "../src/core/types.js";

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PageFetcher.fetch — invalid URL", () => {
  it("returns fetchError for a non-URL string", async () => {
    const fetcher = new PageFetcher();
    const result: PageSignals = await fetcher.fetch("not-a-url");

    expect(result.fetchError).not.toBeNull();
    expect(result.fetchError!.startsWith("Invalid URL")).toBe(true);
    expect(result.url).toBe("not-a-url");
    expect(result.wordCount).toBeNull();
  });
});

describe("PageFetcher.fetch — HTTP errors", () => {
  it("returns fetchError when response status is 404", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => "",
    });

    const fetcher = new PageFetcher();
    const result = await fetcher.fetch("https://example.com/page");

    expect(result.fetchError).toBe("HTTP 404");
  });

  it("returns fetchError when response status is 500", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "",
    });

    const fetcher = new PageFetcher();
    const result = await fetcher.fetch("https://example.com/page");

    expect(result.fetchError).toBe("HTTP 500");
  });
});

describe("PageFetcher.fetch — signal extraction", () => {
  it("extracts page title", async () => {
    const html =
      "<html><head><title>Best CRM Software 2025</title></head>" +
      "<body><p>Hello world this is a test paragraph that is long enough.</p></body></html>";

    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => html });

    const fetcher = new PageFetcher();
    const result = await fetcher.fetch("https://example.com/page");

    expect(result.pageTitle).toBe("Best CRM Software 2025");
    expect(result.fetchError).toBeNull();
  });

  it("detects FAQ schema", async () => {
    const html =
      '<html><head>' +
      '<script type="application/ld+json">{"@type": "FAQPage", "mainEntity": []}</script>' +
      "</head><body><p>Some content here.</p></body></html>";

    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => html });

    const fetcher = new PageFetcher();
    const result = await fetcher.fetch("https://example.com/page");

    expect(result.hasFaqSchema).toBe(true);
    expect(result.schemaTypes).toContain("FAQPage");
  });

  it("detects comparison table with 3 or more columns", async () => {
    const html =
      "<html><body>" +
      "<table><tr><th>Feature</th><th>Plan A</th><th>Plan B</th></tr>" +
      "<tr><td>Price</td><td>$10</td><td>$20</td></tr></table>" +
      "</body></html>";

    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => html });

    const fetcher = new PageFetcher();
    const result = await fetcher.fetch("https://example.com/page");

    expect(result.hasComparisonTable).toBe(true);
  });

  it("returns false for table with fewer than 3 columns", async () => {
    const html =
      "<html><body>" +
      "<table><tr><th>Name</th><th>Value</th></tr></table>" +
      "</body></html>";

    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => html });

    const fetcher = new PageFetcher();
    const result = await fetcher.fetch("https://example.com/page");

    expect(result.hasComparisonTable).toBe(false);
  });

  it("counts headings correctly", async () => {
    const html =
      "<html><body>" +
      "<h1>Title</h1><h2>Section</h2><h2>Section 2</h2><h3>Sub</h3>" +
      "</body></html>";

    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => html });

    const fetcher = new PageFetcher();
    const result = await fetcher.fetch("https://example.com/page");

    expect(result.headingCount).toBe(4);
  });

  it("extracts word count excluding script and style content", async () => {
    const html =
      "<style>body { color: red; }</style>" +
      "<script>var x = 1;</script>" +
      "<p>Hello world foo bar</p>";

    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => html });

    const fetcher = new PageFetcher();
    const result = await fetcher.fetch("https://example.com/page");

    expect(result.wordCount).not.toBeNull();
    expect(result.wordCount!).toBeLessThan(10);
  });

  it("detects last modified date via time element", async () => {
    const html =
      '<article><time datetime="2025-01-15">January 15, 2025</time>' +
      "<p>Content here that is long enough to be a paragraph.</p></article>";

    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => html });

    const fetcher = new PageFetcher();
    const result = await fetcher.fetch("https://example.com/page");

    expect(result.hasLastModifiedDate).toBe(true);
  });

  it("detects last modified via text", async () => {
    const html =
      "<p>Last updated: January 2025</p>" +
      "<p>This is a longer paragraph with real content in it.</p>";

    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => html });

    const fetcher = new PageFetcher();
    const result = await fetcher.fetch("https://example.com/page");

    expect(result.hasLastModifiedDate).toBe(true);
  });

  it("returns empty schemaTypes for page with no ld+json", async () => {
    const html =
      "<html><head></head><body><p>Plain page content here that is long enough.</p></body></html>";

    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => html });

    const fetcher = new PageFetcher();
    const result = await fetcher.fetch("https://example.com/page");

    expect(result.schemaTypes).toEqual([]);
  });

  it("handles malformed ld+json without throwing", async () => {
    const html =
      '<script type="application/ld+json">{ this is not valid json }</script>';

    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => html });

    const fetcher = new PageFetcher();
    const result = await fetcher.fetch("https://example.com/page");

    expect(result.schemaTypes).toEqual([]);
  });
});
