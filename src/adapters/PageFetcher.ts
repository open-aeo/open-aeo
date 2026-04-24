import { PageSignals } from "../core/types.js";

const MAX_BODY_BYTES = 2 * 1024 * 1024;

export class PageFetcher {
  private timeoutMs: number;
  private userAgent: string;

  constructor(timeoutMs = 8000) {
    this.timeoutMs = timeoutMs;
    this.userAgent =
      "Mozilla/5.0 (compatible; OpenAEO/1.0; +https://github.com/open-aeo/open-aeo)";
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  async fetch(url: string): Promise<PageSignals> {
    const fetchedAt = new Date().toISOString();

    // Validate URL before doing anything else
    try {
      new URL(url);
    } catch {
      return this.emptySignals(url, fetchedAt, `Invalid URL: ${url}`);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": this.userAgent,
          Accept: "text/html,application/xhtml+xml",
        },
      });

      if (!response.ok) {
        return this.emptySignals(url, fetchedAt, `HTTP ${response.status}`);
      }

      // Read body and truncate at 2 MB to avoid memory issues
      const bodyText = await response.text();
      const encoder = new TextEncoder();
      const encoded = encoder.encode(bodyText);
      const html =
        encoded.length > MAX_BODY_BYTES
          ? new TextDecoder().decode(encoded.subarray(0, MAX_BODY_BYTES))
          : bodyText;

      const pageHostname = new URL(url).hostname;
      const schemaTypes = this.extractSchemaTypes(html);

      return {
        url,
        fetchedAt,
        fetchError: null,
        wordCount: this.extractWordCount(html),
        hasFaqSection: this.hasFaqSection(html),
        hasFaqSchema: this.hasFaqSchema(schemaTypes),
        hasComparisonTable: this.hasComparisonTable(html),
        hasDirectAnswer: this.hasDirectAnswer(html),
        hasHowToSchema: this.hasHowToSchema(schemaTypes),
        hasArticleSchema: this.hasArticleSchema(schemaTypes),
        headingCount: this.extractHeadingCount(html),
        internalLinkCount: this.extractInternalLinkCount(html, pageHostname),
        externalLinkCount: this.extractExternalLinkCount(html, pageHostname),
        hasLastModifiedDate: this.hasLastModifiedDate(html, schemaTypes),
        metaDescription: this.extractMetaDescription(html),
        pageTitle: this.extractPageTitle(html),
        firstParagraph: this.extractFirstParagraph(html),
        schemaTypes,
      };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return this.emptySignals(
          url,
          fetchedAt,
          `Request timed out after ${this.timeoutMs}ms`,
        );
      }
      const message = error instanceof Error ? error.message : String(error);
      return this.emptySignals(url, fetchedAt, message);
    } finally {
      clearTimeout(timer);
    }
  }

  // ---------------------------------------------------------------------------
  // Error helper
  // ---------------------------------------------------------------------------

  private emptySignals(
    url: string,
    fetchedAt: string,
    fetchError: string,
  ): PageSignals {
    return {
      url,
      fetchedAt,
      fetchError,
      wordCount: null,
      hasFaqSection: false,
      hasFaqSchema: false,
      hasComparisonTable: false,
      hasDirectAnswer: false,
      hasHowToSchema: false,
      hasArticleSchema: false,
      headingCount: null,
      internalLinkCount: null,
      externalLinkCount: null,
      hasLastModifiedDate: false,
      metaDescription: null,
      pageTitle: null,
      firstParagraph: null,
      schemaTypes: [],
    };
  }

  // ---------------------------------------------------------------------------
  // Text extraction
  // ---------------------------------------------------------------------------

  private extractPageTitle(html: string): string | null {
    const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
    if (!match) return null;
    const text = match[1].replace(/<[^>]*>/g, "").trim();
    return text || null;
  }

  private extractMetaDescription(html: string): string | null {
    const match =
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*?)["']/i.exec(
        html,
      ) ??
      /<meta[^>]+content=["']([^"']*?)["'][^>]+name=["']description["']/i.exec(
        html,
      );
    if (!match) return null;
    return match[1].trim() || null;
  }

  private extractFirstParagraph(html: string): string | null {
    const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
    let match: RegExpExecArray | null;
    while ((match = pRegex.exec(html)) !== null) {
      const text = match[1].replace(/<[^>]*>/g, "").trim();
      if (text.length >= 20) {
        return text.slice(0, 300);
      }
    }
    return null;
  }

  private extractWordCount(html: string): number {
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]*>/g, " ");
    const tokens = text.split(/\s+/).filter((t) => t.length > 0);
    return tokens.length;
  }

  private extractHeadingCount(html: string): number {
    const matches = html.match(/<h[1-3][\s>]/gi);
    return matches ? matches.length : 0;
  }

  private extractInternalLinkCount(
    html: string,
    pageHostname: string,
  ): number {
    const hrefRegex = /href=["']([^"']*?)["']/gi;
    let match: RegExpExecArray | null;
    let count = 0;
    while ((match = hrefRegex.exec(html)) !== null) {
      const href = match[1];
      if (href.startsWith("/") || href.includes(pageHostname)) {
        count++;
      }
    }
    return count;
  }

  private extractExternalLinkCount(
    html: string,
    pageHostname: string,
  ): number {
    const hrefRegex = /href=["']([^"']*?)["']/gi;
    let match: RegExpExecArray | null;
    let count = 0;
    while ((match = hrefRegex.exec(html)) !== null) {
      const href = match[1];
      if (href.startsWith("http") && !href.includes(pageHostname)) {
        count++;
      }
    }
    return count;
  }

  // ---------------------------------------------------------------------------
  // Schema extraction
  // ---------------------------------------------------------------------------

  private extractSchemaTypes(html: string): string[] {
    const ldJsonRegex =
      /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    const types = new Set<string>();
    let match: RegExpExecArray | null;
    while ((match = ldJsonRegex.exec(html)) !== null) {
      try {
        const parsed = JSON.parse(match[1]) as unknown;
        if (parsed !== null && typeof parsed === "object") {
          const obj = parsed as Record<string, unknown>;
          const type = obj["@type"];
          if (Array.isArray(type)) {
            for (const t of type) {
              if (typeof t === "string") types.add(t);
            }
          } else if (typeof type === "string") {
            types.add(type);
          }
        }
      } catch {
        // silently skip malformed ld+json blocks
      }
    }
    return [...types];
  }

  private hasFaqSchema(schemaTypes: string[]): boolean {
    return schemaTypes.includes("FAQPage");
  }

  private hasHowToSchema(schemaTypes: string[]): boolean {
    return schemaTypes.includes("HowTo");
  }

  private hasArticleSchema(schemaTypes: string[]): boolean {
    return (
      schemaTypes.includes("Article") || schemaTypes.includes("BlogPosting")
    );
  }

  // ---------------------------------------------------------------------------
  // Structural signal detection
  // ---------------------------------------------------------------------------

  private hasFaqSection(html: string): boolean {
    const lower = html.toLowerCase();
    if (
      lower.includes('id="faq"') ||
      lower.includes("id='faq'") ||
      lower.includes('class="faq"') ||
      lower.includes("class='faq'") ||
      lower.includes('id="frequently-asked-questions"') ||
      lower.includes("id='frequently-asked-questions'") ||
      lower.includes('class="frequently-asked-questions"') ||
      lower.includes("class='frequently-asked-questions'")
    ) {
      return true;
    }
    return /<h2[^>]*>[^<]*(?:faq|frequently asked questions)[^<]*<\/h2>/i.test(
      html,
    );
  }

  private hasComparisonTable(html: string): boolean {
    const lower = html.toLowerCase();
    let tableStart = lower.indexOf("<table");
    while (tableStart !== -1) {
      const tableEnd = lower.indexOf("</table>", tableStart);
      if (tableEnd === -1) break;
      const tableContent = lower.slice(tableStart, tableEnd);
      const trStart = tableContent.indexOf("<tr");
      if (trStart !== -1) {
        const trEnd = tableContent.indexOf("</tr>", trStart);
        const firstRow =
          trEnd !== -1
            ? tableContent.slice(trStart, trEnd)
            : tableContent.slice(trStart);
        const thCount = (firstRow.match(/<th[\s>]/g) ?? []).length;
        const tdCount = (firstRow.match(/<td[\s>]/g) ?? []).length;
        if (thCount + tdCount >= 3) return true;
      }
      tableStart = lower.indexOf("<table", tableEnd);
    }
    return false;
  }

  private hasDirectAnswer(html: string): boolean {
    const para = this.extractFirstParagraph(html);
    if (!para) return false;
    // Split by period; fragments before the last ended with a period
    const fragments = para.split(".");
    for (let i = 0; i < fragments.length - 1; i++) {
      const sentence = fragments[i].trim();
      if (!sentence) continue;
      const startsWithArticle = /^(the|a|an)\s/i.test(sentence);
      const containsDefiner =
        /\b(is|are|means|refers to|defined as)\b/i.test(sentence);
      if (startsWithArticle || containsDefiner) return true;
    }
    return false;
  }

  private hasLastModifiedDate(
    html: string,
    schemaTypes: string[],
  ): boolean {
    if (html.includes("dateModified")) return true;
    if (/<time[^>]+datetime=/i.test(html)) return true;
    const lower = html.toLowerCase();
    if (
      lower.includes("last updated") ||
      lower.includes("last modified") ||
      lower.includes("updated on") ||
      lower.includes("published on")
    ) {
      return true;
    }
    // Article and NewsArticle schemas are structurally expected to carry
    // publication/modification dates; treat their presence as a date signal
    return schemaTypes.some(
      (t) => t === "Article" || t === "NewsArticle" || t === "BlogPosting",
    );
  }
}
