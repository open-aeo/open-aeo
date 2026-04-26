# How content analysis works

When you call `aeo_analyse` or `aeo_recommend`, the tool fetches the target URL using Node.js's native `fetch`. The request includes an 8-second timeout and a `User-Agent` header identifying the tool as `OpenAEO/1.0`. If the response body exceeds 2MB, it is truncated at that boundary before any analysis begins. A non-2xx HTTP status, a timeout, or an invalid URL each produce a `fetchError` string in the signals object with all other fields set to null or false.

Signal extraction runs on the raw HTML string using string operations and regular expressions, without parsing the HTML into a DOM tree. The signals being extracted are structurally simple — element presence, attribute values, text patterns — so a parser would add dependency weight without improving accuracy for these specific checks. For deeper structural analysis or reliable DOM traversal, a parser would be the right approach.

**Word count** is calculated by stripping `<script>` and `<style>` tag contents first, then stripping all remaining HTML tags, then splitting the resulting text on whitespace and counting non-empty tokens. This avoids counting JavaScript and CSS source as words, but it also includes navigation text, footer text, and other non-article content in the count.

**Heading count** counts `<h1>`, `<h2>`, and `<h3>` elements. `<h4>` through `<h6>` are not counted.

**FAQ section detection** looks for elements with an `id` or `class` attribute equal to `faq` or `frequently-asked-questions`, and for `<h2>` elements whose text contains "FAQ" or "Frequently Asked Questions". Either match sets `hasFaqSection` to true.

**FAQ schema detection** looks for `application/ld+json` script blocks and parses their `@type` field. A `@type` of `FAQPage` sets `hasFaqSchema` to true.

**Comparison table detection** looks for HTML `<table>` elements where the first row contains three or more `<th>` or `<td>` cells combined. This is a rough heuristic. It catches common comparison grids but does not distinguish data tables from layout tables, and it will miss tables where the header row uses CSS rather than `<th>` elements.

**Direct answer detection** examines the first `<p>` element with at least 20 characters of text. It splits that paragraph into sentences and checks each sentence for a structure that suggests a definitional or declarative answer: a sentence starting with "the", "a", or "an", or a sentence containing the words "is", "are", "means", "refers to", or "defined as". This is a pattern match, not semantic analysis.

**Article and HowTo schema detection** reads `@type` from `application/ld+json` blocks. `Article` or `BlogPosting` sets `hasArticleSchema` to true. `HowTo` sets `hasHowToSchema` to true.

**Last modified date detection** triggers on any of: a `dateModified` field in any ld+json block, a `<time>` element with a `datetime` attribute, the visible text strings "last updated", "last modified", "updated on", or "published on" anywhere in the page, or the presence of `Article`, `NewsArticle`, or `BlogPosting` schema types (which are structurally expected to carry publication dates).

These signals are correlates, not causes. Pages with FAQ schema are cited more often in AI responses than pages without it. Adding FAQ schema to a thin or poorly written page will not guarantee citation. The signals describe what cited pages tend to have in common; they do not describe what makes a page worth citing in the first place.
