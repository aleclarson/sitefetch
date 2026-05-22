import { createHash } from "node:crypto"
import Queue from "p-queue"
import { readdown } from "readdown"
import c from "picocolors"
import { logger } from "./logger.ts"
import { parseHTML } from "linkedom"
import { matchPath } from "./utils.ts"
import type { Options, FetchSiteResult } from "./types.ts"

export type { Options, Page, FetchSiteResult } from "./types.ts"

/**
 * Crawl one or more starting URLs and return extracted Markdown pages.
 *
 * Each starting URL is fetched within its own host boundary. Results from all
 * starting URLs are merged into a single map keyed by pathname. Failed requests,
 * non-HTML responses, unreadable pages, and duplicate Markdown output are
 * skipped instead of rejecting the whole crawl.
 */
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
  #contentHashes: Set<string> = new Set()
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
    let lastError: Response | undefined

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const res = await (this.options.fetch || fetch)(url, init)

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
      referer?: string
    }
  ) {
    const { host, pathname } = new URL(url)

    if (this.#fetched.has(pathname) || this.#limitReached()) {
      return
    }

    this.#fetched.add(pathname)

    const isExcluded =
      !options.skipExclude &&
      this.options.exclude &&
      matchPath(pathname, this.options.exclude)

    if (isExcluded && !this.options.follow) {
      return
    }

    const isMatched =
      options.skipMatch ||
      !this.options.match ||
      matchPath(pathname, this.options.match)

    // return if not matched and we don't want to follow links on this page
    if (!isMatched && !this.options.follow) {
      return
    }

    logger.info(`Fetching ${c.green(url)}`)

    let res: Response
    try {
      res = await this.#fetchWithRetry(url, {
        headers: {
          "user-agent": "Sitefetch (https://github.com/egoist/sitefetch)",
        },
      })
    } catch (err) {
      let msg = `Failed to fetch ${url}: ${err instanceof Error ? err.message : String(err)}`
      if (options.referer) {
        msg += `\n  (discovered from ${options.referer})`
      }
      logger.warn(msg)
      return
    }

    if (!res.ok) {
      let msg = `Failed to fetch ${url}: ${res.statusText}`
      if (res.status === 404 && options.referer) {
        msg += `\n  (discovered from ${options.referer})`
      }
      logger.warn(msg)
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

    const { document } = parseHTML(await res.text())
    document
      .querySelectorAll("script,style,link,img,video")
      .forEach((el) => el.remove())

    document.querySelectorAll("a").forEach((el) => {
      const href = el.getAttribute("href")

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
      for (const extraUrl of extraUrls) {
        this.#queue.add(() =>
          this.#fetchPage(extraUrl, { skipMatch: false, skipExclude: false, referer: url })
        )
      }
    }

    if (isExcluded || !isMatched) {
      return
    }

    const pageTitle = document.querySelector("title")?.textContent ?? ""
    const contentSelector = this.#getContentSelector(pathname)
    const html = contentSelector
      ? document.querySelector(contentSelector)?.outerHTML
      : document.toString()

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

    const contentHash = createHash("md5")
      .update(result.markdown)
      .digest("hex")

    if (this.#contentHashes.has(contentHash)) {
      return
    }

    this.#contentHashes.add(contentHash)

    this.#pages.set(pathname, {
      title: result.metadata.title || pageTitle,
      url,
      content: result.markdown,
    })
  }
}

/**
 * Serialize fetched pages for files, stdout, or prompt input.
 *
 * The `text` format wraps each page in a simple XML-like `<page>` block. The
 * `json` format returns an array of page objects in insertion order.
 */
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
