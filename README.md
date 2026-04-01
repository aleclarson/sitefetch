# @alloc/sitefetch

Fetch an entire site and save it as a text file (to be used with AI models).

![image](https://github.com/user-attachments/assets/e6877428-0e1c-444a-b7af-2fb21ded8814)

## Install

One-off usage (choose one of the followings):

```bash
bunx @alloc/sitefetch
npx @alloc/sitefetch
pnpx @alloc/sitefetch
```

Install globally (choose one of the followings):

```bash
bun i -g @alloc/sitefetch
npm i -g @alloc/sitefetch
pnpm i -g @alloc/sitefetch
```

## Usage

```bash
sitefetch https://egoist.dev -o site.txt

# or better concurrency
sitefetch https://egoist.dev -o site.txt --concurrency 10
```

### Multiple starting URLs

Pass multiple URLs as positional arguments to crawl more than one site at once:

```bash
sitefetch https://example.com https://other.com -o out.txt
```

Each URL is crawled independently within its own host and the results are merged into a single output.

### Match specific pages

Use the `-m, --match` flag to specify the pages you want to fetch:

```bash
sitefetch https://vite.dev -m "/blog/**" -m "/guide/**"
```

The match pattern is tested against the pathname of target pages, powered by micromatch. Check out all the supported [matching features](https://github.com/micromatch/micromatch#matching-features).

### Exclude pages

Use the `-e, --exclude` flag to skip pages whose pathname matches a pattern:

```bash
sitefetch https://vite.dev -e "/blog/**" -e "/releases/**"
```

Multiple patterns can be passed. The starting URL is never excluded regardless of the patterns provided.

### Limit crawled pages

Use `--limit` to cap the number of pages fetched. Pass `0` to disable link-following entirely — only the explicitly provided URLs will be fetched:

```bash
# fetch at most 20 pages
sitefetch https://vite.dev --limit 20

# fetch only the given URLs, no link crawling
sitefetch https://vite.dev/guide/introduction https://vite.dev/guide/getting-started --limit 0
```

### Content selector

We use [mozilla/readability](https://github.com/mozilla/readability) to extract readable content from the web page, but on some pages it might return irrelevant contents, in this case you can specify a CSS selector so we know where to find the readable content:

```bash
sitefetch https://vite.dev --content-selector ".content"
```

## Plug

If you like this, please check out my LLM chat app: https://chatwise.app

## API

```ts
import { fetchSite } from "@alloc/sitefetch"

await fetchSite("https://egoist.dev", {
  //...options
})

// multiple starting URLs
await fetchSite(["https://example.com", "https://other.com"], {
  //...options
})
```

Check out options in [types.ts](./src/types.ts).

## License

MIT.
