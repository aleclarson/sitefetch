# Sitefetch concepts

Sitefetch crawls one or more starting URLs, extracts readable HTML content as Markdown, and returns pages keyed by pathname. It is designed for preparing website content for LLM prompts, retrieval pipelines, and audits.

## Crawl lifecycle

1. Each starting URL is fetched, even when it would otherwise fail `match` or `exclude` filters.
2. HTML pages are parsed and same-host links are discovered. Fragment identifiers are removed before queuing links.
3. Redirects are followed only when they stay on the same host, except `www.` and non-`www.` variants are treated as equivalent.
4. Pages are converted to Markdown with `readdown`.
5. Pages with identical Markdown output are deduplicated.

Non-HTML responses, failed requests, and unreadable pages are skipped with warnings instead of aborting the whole crawl.

## URL scope

A crawl stays on the host of each starting URL. When multiple starting URLs are provided, each URL starts its own same-host crawl and all results are merged into one output map.

Results are keyed by URL pathname, not by full URL. This means pages with the same pathname on different starting hosts can collide. Prefer separate `fetchSite` calls when you need to preserve same-path pages from multiple hosts independently.

## Filtering and traversal

Use `match` to choose which pathnames should be included in the result. Use `exclude` to omit pathnames. Both options use micromatch patterns against `URL.pathname` values such as `/docs/guide`.

By default, pages that do not pass the filters are not fetched, so their links cannot be discovered. Set `follow: true` when non-matching pages should be used as stepping stones to discover matching descendants.

The starting URL is always fetched, regardless of `match` or `exclude`.

## Limits and concurrency

`concurrency` controls the maximum number of simultaneous requests. The default is `3`.

`limit` caps the number of pages added to the result. Passing `0` disables link-following entirely, so only the explicitly provided starting URLs are fetched.

## Content selection

By default, Sitefetch passes the whole cleaned document to `readdown`. Use `contentSelector` when a site has a stable content container, for example `main` or `.docs-content`.

`contentSelector` can also be a function that receives `{ pathname }`, which is useful when different sections of a site use different layouts.
