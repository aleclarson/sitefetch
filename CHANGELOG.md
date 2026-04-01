# Changelog

## 0.1.1

### Bug Fixes

- **`--limit 0`** now correctly restricts crawling to only the explicitly provided URLs. Previously, `0` was treated as "no limit" due to a falsy check, causing the flag to be ignored entirely.

## 0.1.0

### Features

- **Multiple starting URLs** — `fetchSite` and the CLI now accept more than one starting URL. Pass multiple positional arguments on the CLI (`sitefetch https://a.com https://b.com`) or pass an array to the JS API (`fetchSite(["https://a.com", "https://b.com"], options)`). Each URL is crawled independently within its own host.
- **Exclude patterns** — new `-e, --exclude <pattern>` CLI flag (and `exclude` API option) to skip pages whose pathname matches a micromatch pattern. Multiple patterns are supported.

### Bug Fixes

- The starting URL is no longer affected by `-e` / `--exclude` patterns.
- Exclude patterns now correctly apply to all crawled pages. Previously, the `skipExclude` flag was inadvertently inherited by every page discovered during a crawl, making `-e` a no-op.

### Breaking Changes

- Package renamed from `sitefetch` to `@alloc/sitefetch`.
