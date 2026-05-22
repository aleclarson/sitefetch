import { fetchSite, serializePages } from "@alloc/sitefetch"

const pages = await fetchSite("https://example.com", {
  concurrency: 5,
  match: ["/docs/**"],
  follow: true,
  contentSelector: "main",
  limit: 25,
})

console.log(serializePages(pages, "text"))
