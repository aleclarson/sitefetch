---
name: sitefetch
description: Crawl same-host websites from the CLI and convert readable HTML pages to Markdown or JSON for LLM context.
---

# Sitefetch CLI

Use `sitefetch` to crawl same-host HTML pages and convert readable content to Markdown for LLM context, audits, or downstream processing.

## Invocation

```bash
sitefetch <url...> [options]
# or one-off:
bunx @alloc/sitefetch <url...> [options]
npx @alloc/sitefetch <url...> [options]
pnpx @alloc/sitefetch <url...> [options]
```

Prefer `-o <file>` for agent workflows; crawls can produce large stdout.

## Common commands

```bash
# Crawl a site and save text output.
sitefetch https://example.com -o site.txt

# Save JSON output. A .json outfile selects JSON automatically.
sitefetch https://example.com -o site.json

# Fetch only explicit URLs; do not crawl discovered links.
sitefetch https://example.com/a https://example.com/b --limit 0 -o pages.txt

# Crawl several starting URLs and merge results.
sitefetch https://example.com https://other.com -o out.txt

# Speed up a small/trusted site.
sitefetch https://example.com --concurrency 10 -o site.txt
```

## Options quick reference

- `-o, --outfile <path>`: write output. `.json` => JSON array; anything else => text `<page>` blocks. Default: stdout.
- `--concurrency <n>`: parallel request limit. Default: `3`.
- `--retry-delay <ms>`: wait before retrying HTTP `429`. Default: `30000`.
- `-m, --match <pattern>`: include only matching pathnames. Repeatable.
- `-e, --exclude <pattern>`: skip matching pathnames. Repeatable.
- `-f, --follow`: traverse non-included pages to discover included pages.
- `--content-selector <selector>`: convert only the selected element, e.g. `main`, `.content`, `article`.
- `--limit <n>`: max result pages. `0` means fetch only explicit URLs.
- `--silent`: suppress logs.

## Filtering model

`--match` and `--exclude` use micromatch patterns against `URL.pathname` only, e.g. `/docs/intro`, not the full URL.

```bash
# Include docs/blog paths.
sitefetch https://vite.dev -m "/guide/**" -m "/blog/**" -o vite.txt

# Exclude noisy sections.
sitefetch https://vite.dev -e "/blog/**" -e "/releases/**" -o vite.txt

# Important for docs sites: allow homepage/section pages to lead to matches.
sitefetch https://vite.dev -m "/guide/**" --follow -o vite-guide.txt
```

Without `--follow`, pages that fail filters are not traversed, so their links are not discovered. The starting URL is always fetched regardless of filters.

## Scope and output

- Crawl scope is same-host per starting URL.
- `www.` ↔ non-`www.` redirects are allowed; other cross-host redirects are skipped.
- Only HTML responses are converted.
- Failed requests, non-HTML pages, unreadable pages, and duplicate Markdown output are skipped with warnings.
- Text output: repeated `<page><title>...<url>...<content>...</content></page>` blocks.
- JSON output: array of `{ "title", "url", "content" }` objects.

## Agent heuristics

- Start with `--limit 5` or `--limit 10` when exploring unknown sites.
- Use `--content-selector main` or `--content-selector article` if output includes nav/sidebar/footer noise.
- Use `--match` + `--follow` for documentation sections reached through a homepage or sidebar.
- Use `--silent` in scripts when logs would pollute captured stdout.
- Prefer JSON when another tool will parse the result; prefer text for direct LLM context.
