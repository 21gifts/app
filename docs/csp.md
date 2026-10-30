# Content-Security-Policy

Every page and route response the middleware matches carries a
Content-Security-Policy (the `/map` redirect does not). The
middleware (`src/middleware.ts`) builds it per request with a fresh nonce
(`buildCsp` in `src/lib/csp.ts`); the sources live in `CSP_SOURCES` in the
same file. This page lists every source and why the app needs it.
`src/__tests__/lib/csp.test.ts` fails when a source in `CSP_SOURCES` has no
row here.

## Mode

| `CSP_MODE`      | Header sent                           |
| --------------- | ------------------------------------- |
| unset (default) | `Content-Security-Policy-Report-Only` |
| `enforce`       | `Content-Security-Policy`             |
| any other value | `Content-Security-Policy-Report-Only` |

`CSP_MODE` is a runtime variable of the container (not a `NEXT_PUBLIC_*`
build placeholder). The middleware reads it on every request, so one image
switches from report-only to enforced by setting `CSP_MODE=enforce` and
recreating the container. Unset needs no deployment change.

## Reports

The policy names `report-uri /monitoring/csp` and `report-to csp`; the
response header `Reporting-Endpoints: csp="/monitoring/csp"` defines the
`csp` group. Chromium sends Reporting API batches (`report-to`); Firefox and
Safari post the legacy body (`report-uri`).

`POST /monitoring/csp` (`forwardCspReport` in `src/lib/sentry.ts`) forwards
each violation to the security endpoint of the `NEXT_PUBLIC_SENTRY_DSN`
project. The existing envelope tunnel `/monitoring` is not used: a violation
report is not an envelope. Each report is reduced before it leaves the app:

| Field                 | Sent as                                                                                                                       |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `document-uri`        | origin and first path segment if it is a route of `src/app` (`https://21.gifts/view`), else origin and `/`; no key, id, query |
| `blocked-uri`         | http(s) origin; else the lowercase word before `:` (`inline`, `eval`, `wasm-eval`, `data`, `blob`, `wss`); else empty         |
| `effective-directive` | as sent                                                                                                                       |
| `violated-directive`  | directive name only (the rest is the policy with its nonce); else the effective directive                                     |
| `disposition`         | `report` or `enforce`; else dropped                                                                                           |
| `source-file`         | origin only                                                                                                                   |
| line, column, status  | whole numbers only                                                                                                            |
| everything else       | dropped: script sample, referrer, policy text, query strings, fragments                                                       |

The reduced report then goes through the same privacy scrubber as every
error event (`scrubValue`), so an address, invoice, or key spelled inside a
kept origin is replaced by `[Filtered]`. The visitor's IP address, cookies,
and headers are not forwarded. Without a DSN the route answers 404 and
nothing is sent.

## Nonce and inline code

- **Scripts:** no `'unsafe-inline'` and no `'unsafe-eval'`. Next.js puts the
  request's nonce on its own scripts (it reads it from the policy the
  middleware sets on the request). The root layout puts it on its three
  inline bootstrap scripts (app height, theme, Sunday rest). The JSON-LD block
  is data, not script, and needs none. `'strict-dynamic'` lets those
  nonce'd scripts load the next chunks, the wallet SDK, and the map scripts:
  the Google map script and, on `/`, the MapLibre script of the public shop
  map (`https://unpkg.com/maplibre-gl@<version>/dist/maplibre-gl.js`), which
  `HomeShops` inserts with the page's nonce copied from the page's own scripts.
- **Styles:** `'unsafe-inline'` is needed. React renders `style` attributes on
  the server, and the map script inserts `<style>` elements.

## Sources

How each source was found: **run** means seen in the local Playwright run
(below); **code** means read from this repository; **SDK** means taken from the wallet SDK's mainnet configuration and
code, because the SDK does not connect without a real Breez API key;
**vendor** means taken from Google's documented requirements for the Maps
JavaScript API, because the local run had no valid map key.

| Directive         | Source                             | Needed for                                                                                                                                                           | Found by  |
| ----------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| `default-src`     | `'self'`                           | Fallback for every directive not listed                                                                                                                              | —         |
| `script-src`      | `'self'`                           | Fallback for browsers without `'strict-dynamic'` (ignored by those that support it)                                                                                  | —         |
| `script-src`      | `'strict-dynamic'`                 | Next.js chunks, the wallet SDK module, the Google map script, and the MapLibre script from `unpkg.com` (inserted with the page nonce), all loaded by nonce'd scripts | run       |
| `script-src`      | `'wasm-unsafe-eval'`               | Compiling the wallet SDK's WebAssembly module (`WebAssembly.instantiateStreaming`)                                                                                   | run, SDK  |
| `style-src`       | `'self'`                           | The app's CSS files (Tailwind, `next/font`)                                                                                                                          | run       |
| `style-src`       | `'unsafe-inline'`                  | Server-rendered `style` attributes; `<style>` elements the map script inserts                                                                                        | run       |
| `style-src`       | `https://fonts.googleapis.com`     | Font stylesheet the map script loads for its labels                                                                                                                  | vendor    |
| `style-src`       | `https://unpkg.com`                | MapLibre stylesheet of the public shop map on `/` (`maplibre-gl.css`, pinned version)                                                                                | run, code |
| `img-src`         | `'self'`                           | Icons, handbook images, every member photo, and the photos of a public shop page (same-origin proxies)                                                               | run       |
| `img-src`         | `data:`                            | QR codes (profile, till, pay link, wallet) and other images the app draws itself                                                                                     | run       |
| `img-src`         | `blob:`                            | Photos held in the browser as object URLs: the menu's account photo, previews before upload                                                                          | run       |
| `img-src`         | `https://*.googleapis.com`         | Map tiles and static map images                                                                                                                                      | run       |
| `img-src`         | `https://*.gstatic.com`            | Map markers, cursors, and controls                                                                                                                                   | run       |
| `img-src`         | `https://*.ggpht.com`              | Map place photos                                                                                                                                                     | vendor    |
| `img-src`         | `https://api.opencryptopay.io`     | Shop cover photos in the public shop map popup on `/` (production map API)                                                                                           | run, code |
| `img-src`         | `https://dev-api.opencryptopay.io` | Shop cover photos in the public shop map popup on `/` (DEV map API)                                                                                                  | run, code |
| `font-src`        | `'self'`                           | The Outfit font, served by `next/font` from the app                                                                                                                  | run       |
| `font-src`        | `https://fonts.gstatic.com`        | Font files of the map labels                                                                                                                                         | vendor    |
| `media-src`       | `'self'`                           | Forum videos (same-origin proxy)                                                                                                                                     | run       |
| `media-src`       | `blob:`                            | Videos held in the browser as object URLs, such as a preview before upload                                                                                           | run       |
| `connect-src`     | `'self'`                           | Every api call (same-origin proxy), the error-report tunnel, and the report route                                                                                    | run       |
| `connect-src`     | `https:`                           | Wallet SDK and maps (see the next table); any receiver's Lightning-address server, which is not a fixed host                                                         | run, SDK  |
| `connect-src`     | `wss://nr1.breez.technology`       | Wallet SDK: Nostr relay                                                                                                                                              | SDK       |
| `connect-src`     | `wss://relay.damus.io`             | Wallet SDK: Nostr relay                                                                                                                                              | SDK       |
| `connect-src`     | `wss://relaypag.es`                | Wallet SDK: Nostr relay                                                                                                                                              | SDK       |
| `worker-src`      | `'self'`                           | The push service worker `/sw.js`                                                                                                                                     | code      |
| `worker-src`      | `blob:`                            | The map's vector renderer                                                                                                                                            | vendor    |
| `manifest-src`    | `'self'`                           | The web app manifest                                                                                                                                                 | code      |
| `frame-src`       | `'none'`                           | The app embeds no frame                                                                                                                                              | run, code |
| `object-src`      | `'none'`                           | No plugins                                                                                                                                                           | —         |
| `base-uri`        | `'none'`                           | No `<base>` element; an injected one cannot redirect relative URLs                                                                                                   | —         |
| `form-action`     | `'self'`                           | Forms post only to the app                                                                                                                                           | —         |
| `frame-ancestors` | `'none'`                           | No other site may frame the app                                                                                                                                      | —         |

### Hosts behind `connect-src https:`

`https:` is in the policy because paying a Lightning address or LNURL makes
the wallet SDK ask the receiver's own server from the browser
(`https://<domain>/.well-known/lnurlp/<name>`), and that domain can be any.
A fixed list would block those payments once the policy is enforced. Script
injection is still blocked by the nonce; `connect-src` no longer limits
where a script could send data. The hosts the app is known to reach:

| Host                                      | Needed for                                               | Found by |
| ----------------------------------------- | -------------------------------------------------------- | -------- |
| `https://nd1.breez.technology`            | Wallet SDK: Breez API key exchange                       | run      |
| `https://datasync.breez.technology:442`   | Wallet SDK: wallet data sync between devices             | run      |
| `https://0.spark.lightspark.com`          | Wallet SDK: Spark signing operator                       | SDK      |
| `https://spark-operator.breez.technology` | Wallet SDK: Spark signing operator                       | SDK      |
| `https://2.spark.flashnet.xyz`            | Wallet SDK: Spark signing operator                       | SDK      |
| `https://api.lightspark.com`              | Wallet SDK: Spark service provider (Lightning, on-chain) | SDK      |
| `https://bsw1.breez.technology`           | Wallet SDK: Breez services                               | SDK      |
| `https://mempool.space`                   | Wallet SDK: chain data for on-chain sends                | SDK      |
| `https://cloudflare-dns.com`              | Wallet SDK: DNS lookup of `₿name@domain` addresses       | SDK      |
| `https://<receiver domain>`               | Wallet SDK: the receiver's Lightning-address server      | SDK      |
| `https://maps.googleapis.com`             | Map script: map data and its load check                  | run      |
| `https://tiles.openfreemap.org`           | Public shop map on `/`: MapLibre style, tiles, and fonts | code     |
| `https://api.opencryptopay.io`            | Public shop map on `/`: shop places and their filters    | code     |
| `https://dev-api.opencryptopay.io`        | Public shop map on `/` outside 21.gifts: the same data   | code     |

## How the list was built

1. Code: every external URL, `<script>`, worker, frame, font, and media
   element under `src/`, and the wallet SDK package
   (`@breeztech/breez-sdk-spark`): its mainnet configuration
   (`defaultConfig('mainnet')`) and the hosts and WebSocket URLs in its code.
2. Run: a production build with a policy of `'self'` plus the nonce only,
   report-only, reports sent through `/monitoring/csp` to a local stand-in
   for the Sentry server. The Playwright behavior suite
   (`npm run e2e:behavior`) ran over it, and a second Playwright pass recorded every
   request origin and every `securitypolicyviolation` event on the main
   screens signed in and signed out, plus the shops map with the real Maps
   script. Every report became a row above.
3. Wallet: the SDK's web build ran in Chromium with a new, empty wallet. It
   compiled its WebAssembly module and reached `nd1.breez.technology` and
   `datasync.breez.technology:442`, then stopped at the API key check. The
   remaining wallet hosts are from step 1.

Before `CSP_MODE=enforce`, check the reports in Sentry for sources this list
missed, in particular from the wallet (SDK rows) and the map with a valid key
(vendor rows).
