import Queue from "p-queue"
import { readdown } from "readdown"
import c from "picocolors"
import { logger } from "./logger.ts"
import { load } from "cheerio"
import { matchPath } from "./utils.ts"
import type { Options, FetchSiteResult } from "./types.ts"

export async function fetchSite(
  url: string | string[],
  options: Options
): Promise<FetchSiteResult> {
  const fetcher = new Fetcher(options)

  return fetcher.fetchSite(Array.isArray(url) ? url : [url])
}

class Fetcher {
  #pages: FetchSiteResult = new Map()
  #fetched: Set<string> = new Set()
  #queue: Queue

  constructor(public options: Options) {
    const concurrency = options.concurrency || 3
    this.#queue = new Queue({ concurrency })
  }

  async #fetchWithRetry(
    url: string,
    init: RequestInit,
    maxRetries = 3
  ): Promise<Response> {
    const retryDelay = this.options.retryDelay ?? 30000
    let lastError: Error | Response | undefined

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      let res: Response
      try {
        res = await (this.options.fetch || fetch)(url, init)
      } catch (error) {
        throw new Error(`Failed to fetch ${url}: ${error instanceof Error ? error.message : String(error)}`, { cause: error })
      }

      if (res.status !== 429) {
        return res
      }

      lastError = res
      const isLastAttempt = attempt === maxRetries - 1

      if (!isLastAttempt) {
        logger.warn(
          `Rate limited on ${url}, waiting ${retryDelay / 1000}s before retry (${
            attempt + 1
          }/${maxRetries})...`
        )
        await new Promise((r) => setTimeout(r, retryDelay))
      }
    }

    return lastError!
  }

  #limitReached() {
    return (
      this.options.limit != null &&
      this.options.limit > 0 &&
      this.#pages.size >= this.options.limit
    )
  }

  #getContentSelector(pathname: string) {
    if (typeof this.options.contentSelector === "function")
      return this.options.contentSelector({ pathname })

    return this.options.contentSelector
  }

  async fetchSite(urls: string[]) {
    logger.info(
      `Started fetching ${urls.map((u) => c.green(u)).join(", ")} with a concurrency of ${
        this.#queue.concurrency
      }`
    )

    await Promise.all(
      urls.map((url) =>
        this.#fetchPage(url, {
          skipMatch: true,
          skipExclude: true,
        })
      )
    )

    await this.#queue.onIdle()

    return this.#pages
  }

  async #fetchPage(
    url: string,
    options: {
      skipMatch?: boolean
      skipExclude?: boolean
    }
  ) {
    const { host, pathname } = new URL(url)

    if (this.#fetched.has(pathname) || this.#limitReached()) {
      return
    }

    this.#fetched.add(pathname)

    // return if not matched
    // we don't need to extract content for this page
    if (
      !options.skipMatch &&
      this.options.match &&
      !matchPath(pathname, this.options.match)
    ) {
      return
    }

    // return if excluded
    if (
      !options.skipExclude &&
      this.options.exclude &&
      matchPath(pathname, this.options.exclude)
    ) {
      return
    }

    logger.info(`Fetching ${c.green(url)}`)

    const res = await this.#fetchWithRetry(url, {
      headers: {
        "user-agent": "Sitefetch (https://github.com/egoist/sitefetch)",
      },
    })

    if (!res.ok) {
      logger.warn(`Failed to fetch ${url}: ${res.statusText}`)
      return
    }

    if (this.#limitReached()) {
      return
    }

    const contentType = res.headers.get("content-type")

    if (!contentType?.includes("text/html")) {
      logger.warn(`Not a HTML page: ${url}`)
      return
    }

    const resUrl = new URL(res.url)

    // redirected to other site, ignore
    if (resUrl.host !== host) {
      if (
        (resUrl.host === "www." + host) ||
        ("www." + resUrl.host === host)
      ) {
        // tolerate www vs non-www
      } else {
        logger.warn(`Redirected from ${host} to ${resUrl.host}`)
        return
      }
    }
    const extraUrls: string[] = []

    const $ = load(await res.text())
    $("script,style,link,img,video").remove()

    $("a").each((_, el) => {
      const href = $(el).attr("href")

      if (!href) {
        return
      }

      try {
        const thisUrl = new URL(href, url)
        thisUrl.hash = ""
        if (thisUrl.host !== host && thisUrl.host !== resUrl.host) {
          return
        }

        extraUrls.push(thisUrl.href)
      } catch {
        logger.warn(`Failed to parse URL: ${href}`)
      }
    })

    if (extraUrls.length > 0 && this.options.limit !== 0) {
      for (const url of extraUrls) {
        this.#queue.add(() =>
          this.#fetchPage(url, { skipMatch: false, skipExclude: false })
        )
      }
    }

    const pageTitle = $("title").text()
    const contentSelector = this.#getContentSelector(pathname)
    const html = contentSelector
      ? $(contentSelector).prop("outerHTML")
      : $.html()

    if (!html) {
      logger.warn(`No readable content on ${pathname}`)
      return
    }

    const result = readdown(html, {
      url,
      includeHeader: false,
      raw: !!contentSelector,
    })

    if (!result.markdown.trim()) {
      return
    }

    this.#pages.set(pathname, {
      title: result.metadata.title || pageTitle,
      url,
      content: result.markdown,
    })
  }
}

export function serializePages(
  pages: FetchSiteResult,
  format: "json" | "text"
): string {
  if (format === "json") {
    return JSON.stringify([...pages.values()])
  }

  return [...pages.values()]
    .map((page) =>
      `<page>
  <title>${page.title}</title>
  <url>${page.url}</url>
  <content>${page.content}</content>
</page>`.trim()
    )
    .join("\n\n")
}
