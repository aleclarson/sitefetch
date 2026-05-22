# @alloc/sitefetch

Fetch a website, convert readable HTML pages to Markdown, and save the result for LLM prompts or downstream processing.

## Install

Run once:

```bash
bunx @alloc/sitefetch https://example.com
npx @alloc/sitefetch https://example.com
pnpx @alloc/sitefetch https://example.com
```

Or install globally:

```bash
bun i -g @alloc/sitefetch
npm i -g @alloc/sitefetch
pnpm i -g @alloc/sitefetch
```

## CLI quick start

```bash
sitefetch https://egoist.dev -o site.txt
```

Use a `.json` extension to write JSON instead of the default text format:

```bash
sitefetch https://egoist.dev -o site.json
```

## Common CLI options

```bash
# Crawl with more parallel requests.
sitefetch https://egoist.dev -o site.txt --concurrency 10

# Crawl multiple starting URLs and merge the results.
sitefetch https://example.com https://other.com -o out.txt

# Include only matching pathnames. Patterns use micromatch.
sitefetch https://vite.dev -m "/blog/**" -m "/guide/**"

# Follow links on non-matching pages so they can lead to matching pages.
sitefetch https://vite.dev -m "/guide/**" --follow

# Exclude matching pathnames. The starting URL is still fetched.
sitefetch https://vite.dev -e "/blog/**" -e "/releases/**"

# Fetch at most 20 result pages.
sitefetch https://vite.dev --limit 20

# Disable link-following and fetch only the explicit URLs.
sitefetch https://vite.dev/guide https://vite.dev/api --limit 0

# Extract content from a stable page container.
sitefetch https://vite.dev --content-selector ".content"
```

Run `sitefetch --help` for the full CLI reference.

## JavaScript API

```ts
import { fetchSite, serializePages } from "@alloc/sitefetch"

const pages = await fetchSite("https://egoist.dev", {
  concurrency: 5,
  match: ["/blog/**"],
  follow: true,
  contentSelector: "main",
  limit: 25,
})

console.log(serializePages(pages, "text"))
```

Multiple starting URLs are supported:

```ts
const pages = await fetchSite(["https://example.com", "https://other.com"], {
  concurrency: 3,
})
```

The API returns `Map<string, Page>`, keyed by URL pathname. Public types are exported from the package:

```ts
import type { FetchSiteResult, Options, Page } from "@alloc/sitefetch"
```

## Documentation map

- [Concepts and crawler behavior](./docs/context.md) explains URL scope, filtering, traversal, limits, and content selection.
- [Runnable API example](./examples/api.mjs) shows the package import path and preferred options.
- Public TSDoc in [`src/types.ts`](./src/types.ts) and [`src/index.ts`](./src/index.ts) owns the exact API behavior.
- [`CHANGELOG.md`](./CHANGELOG.md) lists consumer-visible release notes.

## License

MIT
