import { expect, test } from "bun:test"
import { fetchSite } from "./index.ts"
import { logger } from "./logger.ts"

logger.setLevel("silent")

function createResponse(body: string, url: string, status = 200): Response {
  const response = new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  })

  Object.defineProperty(response, "url", { value: url })

  return response
}

function createFetch(pages: Record<string, string>) {
  return async (url: string): Promise<Response> => {
    const page = pages[url]

    if (!page) {
      return createResponse("Not found", url, 404)
    }

    return createResponse(page, url)
  }
}

test("deduplicates pages with identical markdown output", async () => {
  const pages = await fetchSite("https://example.com/a", {
    fetch: createFetch({
      "https://example.com/a": `<!doctype html>
        <html>
          <head><title>First title</title></head>
          <body>
            <a href="/b">duplicate</a>
            <main><h1>Shared heading</h1><p>Shared copy.</p></main>
          </body>
        </html>`,
      "https://example.com/b": `<!doctype html>
        <html>
          <head><title>Second title</title></head>
          <body>
            <a href="/b">duplicate</a>
            <main><h1>Shared heading</h1><p>Shared copy.</p></main>
          </body>
        </html>`,
    }),
  })

  expect(pages.size).toBe(1)
})

test("keeps pages with distinct markdown output", async () => {
  const pages = await fetchSite("https://example.com/a", {
    fetch: createFetch({
      "https://example.com/a": `<!doctype html>
        <html>
          <head><title>First title</title></head>
          <body>
            <a href="/b">next</a>
            <main><h1>First heading</h1><p>First copy.</p></main>
          </body>
        </html>`,
      "https://example.com/b": `<!doctype html>
        <html>
          <head><title>Second title</title></head>
          <body>
            <a href="/b">next</a>
            <main><h1>Second heading</h1><p>Second copy.</p></main>
          </body>
        </html>`,
    }),
  })

  expect(pages.size).toBe(2)
})
