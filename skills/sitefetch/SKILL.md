# Sitefetch CLI

Use `sitefetch` when you need to crawl website pages and turn readable HTML into Markdown/text for LLM context, audits, or downstream processing.

## Command

```bash
sitefetch <url...> [options]
```

Run without installing with one of:

```bash
bunx @alloc/sitefetch <url...>
npx @alloc/sitefetch <url...>
pnpx @alloc/sitefetch <url...>
```

If installed globally, use:

```bash
sitefetch <url...>
```

## Core examples

```bash
# Print crawled pages to stdout in text format.
sitefetch https://example.com

# Save text output.
sitefetch https://example.com -o site.txt

# Save JSON output. The .json extension selects JSON format.
sitefetch https://example.com -o site.json

# Crawl multiple starting URLs and merge results.
sitefetch https://example.com https://other.com -o out.txt
```

## Options

- `-o, --outfile <path>`: write output to a file. Defaults to stdout. Files ending in `.json` use JSON; other paths use text.
- `--concurrency <number>`: maximum simultaneous requests. Default: `3`.
- `--retry-delay <ms>`: delay before retrying a `429` response. Default: `30000`.
- `-m, --match <pattern>`: include only pathnames matching a micromatch pattern. Repeat for multiple patterns.
- `-e, --exclude <pattern>`: exclude pathnames matching a micromatch pattern. Repeat for multiple patterns.
- `-f, --follow`: keep crawling links from pages that fail `--match` or `--exclude`, but do not include those pages in output.
- `--content-selector <selector>`: extract Markdown from a CSS-selected element instead of the whole cleaned document.
- `--limit <number>`: maximum result pages. Use `0` to disable link crawling and fetch only explicit URLs.
- `--silent`: suppress logs.

## Filtering rules

Patterns are matched against `URL.pathname`, e.g. `/docs/intro`, not the full URL.

```bash
# Include docs and blog pages.
sitefetch https://vite.dev -m "/guide/**" -m "/blog/**"

# Exclude release and blog pages.
sitefetch https://vite.dev -e "/releases/**" -e "/blog/**"
```

By default, non-matching or excluded pages are not fetched, so their links are not discovered. Add `--follow` when navigation/index pages are needed as stepping stones:

```bash
sitefetch https://vite.dev -m "/guide/**" --follow -o vite-guide.txt
```

The starting URL is always fetched even if it does not match filters or matches an exclude pattern.

## Scope and output behavior

- Crawling stays on the same host as each starting URL.
- `www.` and non-`www.` redirects are tolerated; redirects to other hosts are skipped.
- Only HTML pages are converted.
- Failed requests, non-HTML responses, unreadable pages, and duplicate Markdown pages are skipped with warnings.
- Text output contains repeated `<page>` blocks with `<title>`, `<url>`, and `<content>`.
- JSON output is an array of page objects: `{ "title", "url", "content" }`.

## Practical recipes

```bash
# Capture only two exact pages, no crawl.
sitefetch https://example.com/a https://example.com/b --limit 0 -o pages.txt

# Faster crawl for small/trusted sites.
sitefetch https://example.com --concurrency 10 -o site.txt

# Use a stable content container to avoid nav/sidebar noise.
sitefetch https://docs.example.com --content-selector main -o docs.txt

# Quiet command suitable for scripts.
sitefetch https://example.com --silent -o site.txt
```

## Agent guidance

Prefer writing to a file when output may be large. Use `--limit` for exploratory runs. Use `--content-selector` when output includes navigation, headers, footers, or sidebars. Use `--match` plus `--follow` for documentation sites where the homepage links to the desired section.
