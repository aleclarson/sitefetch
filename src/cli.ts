import path from "node:path"
import fs from "node:fs"
import { command, run, string, number, restPositionals, option, multioption, array, optional, flag } from "cmd-ts"
import { encode } from "gpt-tokenizer/model/gpt-4o"
import { fetchSite, serializePages } from "./index.ts"
import { logger } from "./logger.ts"
import { ensureArray, formatNumber } from "./utils.ts"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)

const cli = command({
  name: "sitefetch",
  description: "fetch a site",
  version: require("../package.json").version,
  examples: [
    { command: "sitefetch https://example.com -o example.txt", description: "Fetch a site and save to a text file" },
    { command: "sitefetch https://example.com -m '**/docs/**' -f", description: "Fetch only matching docs pages, following links on unmatched pages" },
    { command: "sitefetch https://example.com https://another-example.com -o output.txt", description: "Fetch multiple sites starting from different entry points" },
  ],
  args: {
    urls: restPositionals({
      type: string,
      displayName: "urls",
      description: "URLs to fetch",
    }),
    outfile: option({
      type: optional(string),
      long: "outfile",
      short: "o",
      description: "write the fetched site to a text file",
    }),
    concurrency: option({
      type: number,
      long: "concurrency",
      defaultValue: () => 3,
      description: "number of concurrent requests",
    }),
    retryDelay: option({
      type: number,
      long: "retry-delay",
      defaultValue: () => 30000,
      description: "delay in ms before retrying on rate limit",
    }),
    exclude: multioption({
      type: array(string),
      long: "exclude",
      short: "e",
      defaultValue: () => [],
      description: "exclude matching paths",
    }),
    match: option({
      type: optional(string),
      long: "match",
      short: "m",
      description: "only fetch matched pages",
    }),
    follow: flag({
      long: "follow",
      short: "f",
      description: "follow links on un-matched pages",
    }),
    contentSelector: option({
      type: optional(string),
      long: "content-selector",
      description: "the CSS selector to find content",
    }),
    limit: option({
      type: optional(number),
      long: "limit",
      description: "limit the result to this amount of pages",
    }),
    silent: flag({
      long: "silent",
      description: "do not print any logs",
    }),
  },
  handler: async (args) => {
    if (args.silent) {
      logger.setLevel("silent")
    }

    const pages = await fetchSite(args.urls, {
      concurrency: args.concurrency,
      retryDelay: args.retryDelay,
      match: args.match ? ensureArray(args.match) : undefined,
      exclude: args.exclude.length > 0 ? ensureArray(args.exclude) : undefined,
      follow: args.follow,
      contentSelector: args.contentSelector,
      limit: args.limit,
    })

    if (pages.size === 0) {
      logger.warn("No pages found")
      return
    }

    const pagesArr = [...pages.values()]

    const totalTokenCount = pagesArr.reduce(
      (acc, page) => acc + encode(page.content).length,
      0
    )

    logger.info(
      `Total token count for ${pages.size} pages: ${formatNumber(
        totalTokenCount
      )}`
    )

    if (args.outfile) {
      const output = serializePages(
        pages,
        args.outfile.endsWith(".json") ? "json" : "text"
      )
      fs.mkdirSync(path.dirname(args.outfile), { recursive: true })
      fs.writeFileSync(args.outfile, output, "utf8")
    } else {
      console.log(serializePages(pages, "text"))
    }
  },
})

run(cli, process.argv.slice(2))
