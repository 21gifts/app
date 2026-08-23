# Functions

## Function: DonateForm

- **Purpose:** Renders the guest donate form (Wallet of Satoshi address and sat amount only; no comment) and, after success, the Bitcoin payment QR.
- **Inputs:** Form state: address and whole-sat amount.
- **Returns / side effects:** React element. Side effects: HTTP to the api then GET the payee LNURL-pay callback.
- **Used by:** Screen `/donate`.

## Function: DonatePage

- **Purpose:** Next.js page for `/donate`.
- **Inputs:** None.
- **Returns / side effects:** The donate screen wrapped in the root layout.
- **Used by:** Route `/donate`.

## Function: GET

- **Purpose:** Shared export name for App Router GET handlers. Healthz uses `export function GET`; same-origin api proxies re-export unique functions as `GET`.
- **Inputs:** Incoming `Request` on proxy routes; none on healthz.
- **Returns / side effects:** `Response`. Healthz is `{ status: 'ok' }` 200; proxies return the upstream api response.
- **Used by:** Container probes, browser/wallet same-origin calls.

## Function: HandbookCopyLink

- **Purpose:** Client button beside a handbook heading or chapter. Copies `origin + pathname + #id` to the clipboard, sets `location.hash`, and flashes a check icon for 1.2s (textarea `execCommand` fallback).
- **Inputs:** `targetId` (DOM id without `#`) and `label` (aria-label `Copy link to ${label}`).
- **Visible UI:** Idle `Link2` icon; copied `Check` icon. No visible "Copy link" or "Copied" text (`title` and `aria-label` keep the accessible name).
- **Returns / side effects:** A `<button type="button">`. Clipboard write; hash update. No network.
- **Used by:** `HandbookPage` (page title and chapter nav) and `HandbookMarkdown` (every heading).

## Function: HandbookMarkdown

- **Purpose:** Render parsed handbook markdown as Tailwind-styled headings, paragraphs, lists, links, and images. Every heading has a sibling `HandbookCopyLink`.
- **Inputs:** `markdown` string and `idPrefix` for heading ids.
- **Returns / side effects:** React fragment. No network.
- **Used by:** `HandbookPage` for each handbook document.

## Function: HandbookPage

- **Purpose:** Next.js page for `/handbook`. Loads the four app handbook files and renders them with a link to the api handbook. Copy-link on the page title and each chapter nav item.
- **Inputs:** None (reads `docs/handbook/` from disk at build time).
- **Returns / side effects:** The handbook screen inside `MarketingLayout`.
- **Used by:** Route `/handbook`.

## Function: Home

- **Purpose:** Next.js page for `/`. Marketing landing: pitch, how it works, why, FAQ, CTAs to `/login` and `/donate`.
- **Inputs:** None.
- **Returns / side effects:** The home screen element.
- **Used by:** Route `/`.

## Function: LightningAddressForm

- **Purpose:** Logged-in form to link, edit, or unlink a Wallet of Satoshi address.
- **Inputs:** Reads `useAuthStore`. User input: address string.
- **Returns / side effects:** React element or `null` when logged out.
- **Used by:** `LoginCard` signed-in view on screen `/login` (not on `/`).

## Function: LoginCard

- **Purpose:** Wallet of Satoshi login UI: hydrate session, start challenge, QR, Wallet of Satoshi deep link, poll, expiry, then signed-in view with `LightningAddressForm`.
- **Inputs:** Uses `useLnurlLogin` and `useAuthStore`. Rehydrates via `loadSession` + `fetchMe`.
- **Returns / side effects:** React element covering idle/waiting/expired/error/signed-in. Does not navigate away from `/login`.
- **Used by:** Screen `/login`.

## Function: LoginPage

- **Purpose:** Next.js page for `/login`.
- **Inputs:** None.
- **Returns / side effects:** Renders `LoginCard`.
- **Used by:** Route `/login`.

## Function: QrCode

- **Purpose:** SVG QR for a string (LNURL or bolt11).
- **Inputs:** `value` (required), optional `label`.
- **Returns / side effects:** React element.
- **Used by:** `LoginCard` and `DonateForm`.

## Function: RootLayout

- **Purpose:** Root HTML shell: `lang=en`, global CSS, metadata (title, icons, Open Graph, Twitter).
- **Inputs:** `children` React nodes.
- **Returns / side effects:** The document wrapper for every route.
- **Used by:** All screens.

## Function: clearSession

- **Purpose:** Removes the bearer token from `localStorage`.
- **Inputs:** None.
- **Returns / side effects:** void. No-op during SSR (`window` undefined).
- **Used by:** `useAuthStore.clearAuth` and `LoginCard` when session hydration gets 401.

## Function: fetchMe

- **Purpose:** GET `/me` with the bearer session.
- **Inputs:** `sessionToken`.
- **Returns / side effects:** `Account` or `null` on 401.
- **Used by:** `LoginCard` session hydration.

## Function: formatMsatAsSats

- **Purpose:** Formats millisatoshis as a sat string for the donate UI.
- **Inputs:** `msat` number.
- **Returns / side effects:** Decimal string in sats.
- **Used by:** `DonateForm` amount-range error (`minSendable`–`maxSendable`).

## Function: getApiUrl

- **Purpose:** Reads `NEXT_PUBLIC_API_URL` via the typed config accessor.
- **Inputs:** None.
- **Returns / side effects:** Origin string. Throws if unset/empty (entrypoint must substitute).
- **Used by:** `proxyApiRequest` (server-side upstream origin).

## Function: isAndroidUserAgent

- **Purpose:** Detects Android so the WoS CTA can use an Intent URL.
- **Inputs:** `userAgent` string.
- **Returns / side effects:** `true` iff `/Android/i` matches.
- **Used by:** `LoginCard` QrView and `DonateForm`.

## Function: loadHandbookDocuments

- **Purpose:** Read the four app handbook markdown files from disk (README, screens, functions, endpoints).
- **Inputs:** Optional `rootDir`; defaults to `<cwd>/docs/handbook`.
- **Returns / side effects:** `HandbookDocument[]` in that order. Throws when the directory or a required file is missing.
- **Used by:** `HandbookPage`.

## Function: loadSession

- **Purpose:** Reads the bearer token from `localStorage`.
- **Inputs:** None.
- **Returns / side effects:** Token string or `null`. SSR-safe.
- **Used by:** `LoginCard` on mount.

## Function: parseHandbookMarkdown

- **Purpose:** Parse handbook markdown into headings, paragraphs, and lists with inline code, strong, links, and images.
- **Inputs:** `markdown` string and `idPrefix` for ids and in-page hashes.
- **Returns / side effects:** `HandbookBlock[]`. Drops unsafe hrefs (`..`, unknown schemes).
- **Used by:** `HandbookMarkdown`.

## Function: pollSession

- **Purpose:** GET `/auth/session` with `X-Poll-Token`.
- **Inputs:** `pollToken`.
- **Returns / side effects:** `SessionResult` (`pending` / `authenticated` / `expired` / `used`).
- **Used by:** `useLnurlLogin`.

## Function: requestDonateInvoice

- **Purpose:** GET an LNURL-pay callback with `amount` millisatoshis and return the bolt11 string.
- **Inputs:** `{ callback, amountMsat, fetchImpl? }`. Does not resolve a Lightning Address.
- **Returns / side effects:** bolt11 `string`, or throws.
- **Used by:** `DonateForm`.

## Function: resolveLightningAddress

- **Purpose:** GET `/lightning-address?address=` on the 21.gifts api.
- **Inputs:** `address`.
- **Returns / side effects:** Resolved LNURL-pay metadata (callback, min/max).
- **Used by:** `DonateForm` before paying.

## Function: satsToMsat

- **Purpose:** Converts whole sats to millisatoshis.
- **Inputs:** `sats` number.
- **Returns / side effects:** `sats * 1000`.
- **Used by:** `DonateForm` (converts sats before calling `requestDonateInvoice`).

## Function: saveSession

- **Purpose:** Writes the bearer token to `localStorage`.
- **Inputs:** `token` string.
- **Returns / side effects:** void. SSR no-op.
- **Used by:** `useAuthStore.setAuth`.

## Function: setLightningAddress

- **Purpose:** POST `/me/lightning-address`.
- **Inputs:** `sessionToken`, `address`.
- **Returns / side effects:** Updated `Account`.
- **Used by:** `LightningAddressForm`.

## Function: startLnurlAuth

- **Purpose:** GET `/auth/lnurl` — creates k1 + LNURL + poll token.
- **Inputs:** None.
- **Returns / side effects:** `StartChallenge`.
- **Used by:** `useLnurlLogin`.

## Function: unlinkLightningAddress

- **Purpose:** DELETE `/me/lightning-address`.
- **Inputs:** `sessionToken`.
- **Returns / side effects:** Updated `Account` with address cleared.
- **Used by:** `LightningAddressForm`.

## Function: uppercaseLnurl

- **Purpose:** Uppercases a bech32 LNURL or BOLT11 payment request.
- **Inputs:** `lnurl` string.
- **Returns / side effects:** Uppercase string.
- **Used by:** QR value and Wallet of Satoshi hrefs (`LoginCard`, `DonateForm`).

## Function: useAuthStore

- **Purpose:** Zustand store for `session` + `account`. Hydration is explicit (no module-init `localStorage`).
- **Inputs:** Hook. Methods `setAuth`, `setAccount`, `clearAuth`.
- **Returns / side effects:** Auth state object.
- **Used by:** `LoginCard`, `useLnurlLogin`, `LightningAddressForm` on `/login` (not `/`).

## Function: useLnurlLogin

- **Purpose:** Hook: start LNURL-auth, poll until authenticated or expired. Returns `{ status, lnurl, start }` — there is no separate `error` field (errors are a `status` of `'error'`).
- **Inputs:** None.
- **Returns / side effects:** `UseLnurlLogin` status machine.
- **Used by:** `LoginCard`.

## Function: walletOfSatoshiHref

- **Purpose:** iOS/desktop WoS deep link.
- **Inputs:** Bech32 LNURL or BOLT11 payment request.
- **Returns / side effects:** `walletofsatoshi:lightning:` + uppercase payload.
- **Used by:** `LoginCard` and `DonateForm` when not Android.

## Function: walletOfSatoshiIntentHref

- **Purpose:** Android Chrome Intent pinning the WoS package.
- **Inputs:** Bech32 LNURL or BOLT11 payment request.
- **Returns / side effects:** `intent:lightning:…#Intent;scheme=walletofsatoshi;package=com.livingroomofsatoshi.wallet;…;end`.
- **Used by:** `LoginCard` and `DonateForm` on Android.

## Function: DELETE

- **Purpose:** App Router DELETE export on `/me/lightning-address` (re-export of `proxyMeLightningAddressDelete`).
- **Inputs:** Incoming `Request`.
- **Returns / side effects:** Upstream api `Response`.
- **Used by:** Same-origin `unlinkLightningAddress`.

## Function: LegalPage

- **Purpose:** Next.js page for `/legal` (imprint and privacy).
- **Inputs:** None.
- **Returns / side effects:** The legal screen.
- **Used by:** Route `/legal`.

## Function: MarketingFooter

- **Purpose:** Footer for marketing pages: wordmark, section links, legal, GitHub.
- **Inputs:** None.
- **Returns / side effects:** Footer element.
- **Used by:** `MarketingLayout`, `NotFound`.

## Function: MarketingHeader

- **Purpose:** Sticky marketing header with wordmark, section nav, login CTA, mobile menu.
- **Inputs:** None (internal open state).
- **Returns / side effects:** Header element; toggles nav on small screens.
- **Used by:** `MarketingLayout`, `NotFound`.

## Function: MarketingLayout

- **Purpose:** Dark full-page shell for `/`, `/legal`, and `/handbook`.
- **Inputs:** `children`.
- **Returns / side effects:** Wrapper div with header, page, footer.
- **Used by:** Marketing route group.

## Function: NotFound

- **Purpose:** App-wide 404 screen with marketing chrome and a link home.
- **Inputs:** None.
- **Returns / side effects:** 404 element.
- **Used by:** Next.js `not-found.tsx`.

## Function: POST

- **Purpose:** App Router POST export on the lightning-address write route (re-export of `proxyMeLightningAddressPost`).
- **Inputs:** Incoming `Request`.
- **Returns / side effects:** Upstream api `Response`.
- **Used by:** Same-origin address link.

## Function: proxyApiRequest

- **Purpose:** Forwards an App Router request to `getApiUrl()` + path, copying query, body, and authorization / content-type / poll-token / user-agent headers.
- **Inputs:** `request`, `apiPath` beginning with `/`.
- **Returns / side effects:** Upstream `Response`, or 502 JSON if fetch throws.
- **Used by:** All same-origin api proxy route handlers.

## Function: proxyAuthLnurlCallbackGet

- **Purpose:** Proxies GET `/auth/lnurl/callback` (wallet LUD-04).
- **Inputs:** `Request` with k1/sig/key query.
- **Returns / side effects:** Upstream `Response`.
- **Used by:** Route GET `/auth/lnurl/callback`.

## Function: proxyAuthLnurlGet

- **Purpose:** Proxies GET `/auth/lnurl`.
- **Inputs:** `Request`.
- **Returns / side effects:** Upstream `Response`.
- **Used by:** Route GET `/auth/lnurl`.

## Function: proxyAuthSessionGet

- **Purpose:** Proxies GET `/auth/session`.
- **Inputs:** `Request` with `X-Poll-Token`.
- **Returns / side effects:** Upstream `Response`.
- **Used by:** Route GET `/auth/session`.

## Function: proxyLightningAddressGet

- **Purpose:** Proxies GET `/lightning-address`.
- **Inputs:** `Request` with `address` query.
- **Returns / side effects:** Upstream `Response`.
- **Used by:** Route GET `/lightning-address`.

## Function: proxyMeGet

- **Purpose:** Proxies GET `/me`.
- **Inputs:** `Request` with Bearer token.
- **Returns / side effects:** Upstream `Response`.
- **Used by:** Route GET `/me`.

## Function: proxyMeLightningAddressDelete

- **Purpose:** Proxies DELETE `/me/lightning-address`.
- **Inputs:** `Request`.
- **Returns / side effects:** Upstream `Response`.
- **Used by:** Route DELETE `/me/lightning-address`.

## Function: proxyMeLightningAddressPost

- **Purpose:** Proxies POST `/me/lightning-address`.
- **Inputs:** `Request` with JSON body.
- **Returns / side effects:** Upstream `Response`.
- **Used by:** Route POST `/me/lightning-address`.
