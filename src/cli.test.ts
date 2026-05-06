import { afterEach, expect, test } from "bun:test"
import { createServer, type Server } from "node:http"
import type { AddressInfo } from "node:net"

let server: Server | undefined

afterEach(async () => {
  if (!server) {
    return
  }

  await new Promise<void>((resolve, reject) => {
    server!.close((err) => {
      if (err) {
        reject(err)
        return
      }

      resolve()
    })
  })
  server = undefined
})

async function startSite() {
  server = createServer((req, res) => {
    res.setHeader("content-type", "text/html; charset=utf-8")

    switch (req.url) {
      case "/":
        res.end(`<!doctype html>
          <html>
            <head><title>Home</title></head>
            <body>
              <a href="/docs/a">Docs</a>
              <a href="/blog/b">Blog</a>
              <a href="/other">Other</a>
            </body>
          </html>`)
        break
      case "/docs/a":
        res.end(`<!doctype html>
          <html>
            <head><title>Docs</title></head>
            <body><h1>Docs page</h1></body>
          </html>`)
        break
      case "/blog/b":
        res.end(`<!doctype html>
          <html>
            <head><title>Blog</title></head>
            <body><h1>Blog page</h1></body>
          </html>`)
        break
      case "/other":
        res.end(`<!doctype html>
          <html>
            <head><title>Other</title></head>
            <body><h1>Other page</h1></body>
          </html>`)
        break
      default:
        res.statusCode = 404
        res.end("Not found")
    }
  })

  await new Promise<void>((resolve) => {
    server!.listen(0, "127.0.0.1", resolve)
  })

  const { port } = server.address() as AddressInfo
  return `http://127.0.0.1:${port}`
}

test("CLI accepts multiple match options", async () => {
  const baseUrl = await startSite()
  const proc = Bun.spawn({
    cmd: [
      process.execPath,
      "src/cli.ts",
      baseUrl,
      "--match",
      "/docs/**",
      "--match",
      "/blog/**",
      "--silent",
    ],
    stdout: "pipe",
    stderr: "pipe",
  })

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])

  expect(stderr).toBe("")
  expect(exitCode).toBe(0)
  expect(stdout).toContain(`<url>${baseUrl}/docs/a</url>`)
  expect(stdout).toContain(`<url>${baseUrl}/blog/b</url>`)
  expect(stdout).not.toContain(`<url>${baseUrl}/other</url>`)
})
