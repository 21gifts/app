# Functions

## Function: DonateForm

- **Purpose:** Renders the guest donate form (Wallet of Satoshi address and sat amount only; no comment) and, after success, the Bitcoin payment QR. All visitor-facing copy goes through `useTranslations`.
- **Inputs:** Form state: address and whole-sat amount.
- **Returns / side effects:** React element. Side effects: HTTP to the api then GET the payee LNURL-pay callback.
- **Used by:** Screen `/donate`.

## Function: DonatePage

- **Purpose:** Next.js page for `/donate` with localized heading and a light language switcher.
- **Inputs:** None. Calls `getRequestLocale()` for the page title.
- **Returns / side effects:** The donate screen wrapped in the root layout; switcher top-right.
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

## Function: HandbookIntro

- **Purpose:** Client island for the `/handbook` title and intro sentence so the page can stay `force-static`.
- **Inputs:** Locale via `useTranslations`.
- **Returns / side effects:** Heading, intro with the api-handbook GitHub link. No network.
- **Used by:** `HandbookPage`.

## Function: HandbookPage

- **Purpose:** Next.js page for `/handbook`. Loads the four app handbook files at build time (`force-static`) and renders them with a link to the api handbook. Title and intro chrome are localized via `HandbookIntro`; copy-link on the page title and each chapter nav item; markdown bodies stay English.
- **Inputs:** None (reads `docs/handbook/` from disk at build).
- **Returns / side effects:** The handbook screen inside `MarketingLayout`.
- **Used by:** Route `/handbook`.

## Function: Home

- **Purpose:** Next.js page for `/`. Marketing landing: pitch, how it works, why, FAQ, CTAs to `/login` and `/donate`, all via `translate` for the negotiated locale.
- **Inputs:** None. Calls `getRequestLocale()`.
- **Returns / side effects:** The home screen element.
- **Used by:** Route `/`.

## Function: LanguageSwitcher

- **Purpose:** Native language `<select>` that persists the visitor's override in a `locale` cookie and refreshes the App Router tree.
- **Inputs:** `tone` (`dark` for marketing chrome, `light` for login/donate). Reads current locale via `useTranslations`.
- **Returns / side effects:** Select with native option labels (English/Deutsch/Español/Filipino). On change writes `locale=<code>; Path=/; Max-Age=31536000; SameSite=Lax` then `router.refresh()`. Never set on first visit.
- **Used by:** `MarketingHeader` (always visible), `/login`, and `/donate`.

## Function: LightningAddressForm

- **Purpose:** Logged-in form to link, edit, or unlink a Wallet of Satoshi address.
- **Inputs:** Reads `useAuthStore`. User input: address string.
- **Returns / side effects:** React element or `null` when logged out.
- **Used by:** `LoginCard` signed-in view on screen `/login` (not on `/`).

## Function: LocaleProvider

- **Purpose:** Client context provider that exposes the negotiated locale and a bound `t` helper to visitor-facing components.
- **Inputs:** `locale`, `messages` for that locale, and `children`.
- **Returns / side effects:** React provider element. No network; does not write cookies.
- **Used by:** `RootLayout` wraps every page; consumed via `useTranslations` by header, footer, login, donate, and the language switcher.

## Function: LoginCard

- **Purpose:** Wallet of Satoshi login UI: hydrate session, start challenge, QR, Wallet of Satoshi deep link, poll, expiry, then signed-in view with `LightningAddressForm`.
- **Inputs:** Uses `useLnurlLogin` and `useAuthStore`. Rehydrates via `loadSession` + `fetchMe`.
- **Returns / side effects:** React element covering idle/waiting/expired/error/signed-in. Does not navigate away from `/login`.
- **Used by:** Screen `/login`.

## Function: LoginPage

- **Purpose:** Next.js page for `/login` with localized heading and a light language switcher.
- **Inputs:** None. Calls `getRequestLocale()` for the page title.
- **Returns / side effects:** Renders `LoginCard` and `LanguageSwitcher` (top-right).
- **Used by:** Route `/login`.

## Function: QrCode

- **Purpose:** SVG QR for a string (LNURL or bolt11).
- **Inputs:** `value` (required), optional `label`.
- **Returns / side effects:** React element.
- **Used by:** `LoginCard` and `DonateForm`.

## Function: RootLayout

- **Purpose:** Root HTML shell: negotiated `lang` (`en`/`de`/`es`/`fil`), global CSS, English metadata (title, icons, Open Graph, Twitter), and `LocaleProvider` with the request catalog.
- **Inputs:** `children` React nodes. Calls `getRequestLocale()` for `html lang` and messages.
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

- **Purpose:** Formats millisatoshis as an English sat string (`1 sat` / `{n} sats`).
- **Inputs:** `msat` number.
- **Returns / side effects:** Decimal string in sats.
- **Used by:** Unit tests and shared LNURL-pay helpers. The donate UI formats amounts via catalog keys `donate.satOne` / `donate.sats` instead.

## Function: getApiUrl

- **Purpose:** Reads `NEXT_PUBLIC_API_URL` via the typed config accessor.
- **Inputs:** None.
- **Returns / side effects:** Origin string. Throws if unset/empty (entrypoint must substitute).
- **Used by:** `proxyApiRequest` (server-side upstream origin).

## Function: getCatalog

- **Purpose:** Return the message catalog for a supported UI locale without indexed-access gaps.
- **Inputs:** `locale` (`en` / `de` / `es` / `fil`).
- **Returns / side effects:** The `Messages` object for that locale. Exhaustive switch over `Locale`.
- **Used by:** `RootLayout`, marketing pages, `/login`, `/donate`, `NotFound`, and the `renderWithLocale` test helper.

## Function: getRequestLocale

- **Purpose:** Resolve the UI locale for the current request without writing cookies.
- **Inputs:** Reads the `locale` cookie and the `Accept-Language` header via `next/headers` (both async in Next 15).
- **Returns / side effects:** A supported locale (`en`/`de`/`es`/`fil`). Valid cookie wins; invalid/missing cookie falls through to `parseAcceptLanguage`; unmatched → `en`.
- **Used by:** `RootLayout`, marketing pages (`Home`, `HandbookPage`), `/login`, `/donate`, and `NotFound`. Lives in `src/lib/request-locale.ts` so client components can import locale constants without `next/headers`.

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

## Function: parseAcceptLanguage

- **Purpose:** Negotiate a supported UI locale from an RFC 7231 `Accept-Language` header.
- **Inputs:** Raw header string (may be empty). Splits on commas, reads `q=` (default 1), sorts by q then header order, maps primary subtags (`en`/`de`/`es`/`fil`, and `tl`→`fil`).
- **Returns / side effects:** First mapped locale, or `en` when empty/unmatched. Pure function — no I/O.
- **Used by:** `getRequestLocale` when no valid `locale` cookie is present.

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

## Function: translate

- **Purpose:** Look up a catalog key and replace `{name}` placeholders from `vars`.
- **Inputs:** `catalog` (`Messages`), `key` (`MessageKey`), optional `vars` map of string/number values.
- **Returns / side effects:** Interpolated string. Throws on a missing key or missing `{name}` — no silent English fallback.
- **Used by:** Server pages (`Home`, `HandbookPage`, login/donate headings, `NotFound`) and the `t` helper from `LocaleProvider` / `useTranslations`.

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

## Function: useTranslations

- **Purpose:** Client hook returning `{ locale, t }` from the nearest `LocaleProvider`.
- **Inputs:** None (React context).
- **Returns / side effects:** Active locale and a `t(key, vars?)` bound to that catalog. Throws if used outside `LocaleProvider`.
- **Used by:** `MarketingHeader`, `MarketingFooter`, `LanguageSwitcher`, `LoginCard`, `LightningAddressForm`, `DonateForm`.

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

- **Purpose:** Footer for marketing pages: wordmark, localized section links, legal, GitHub.
- **Inputs:** None. Reads copy via `useTranslations`.
- **Returns / side effects:** Footer element.
- **Used by:** `MarketingLayout`, `NotFound`.

## Function: MarketingHeader

- **Purpose:** Sticky marketing header with wordmark, section nav, always-visible `LanguageSwitcher` (`tone="dark"`), login CTA, and mobile menu.
- **Inputs:** None (internal open state). Reads copy via `useTranslations`.
- **Returns / side effects:** Header element; toggles nav on small screens. Language select stays visible when the hamburger is closed.
- **Used by:** `MarketingLayout`, `NotFound`.

## Function: MarketingLayout

- **Purpose:** Dark full-page shell for `/`, `/legal`, and `/handbook`.
- **Inputs:** `children`.
- **Returns / side effects:** Wrapper div with header, page, footer.
- **Used by:** Marketing route group.

## Function: NotFound

- **Purpose:** App-wide 404 screen with marketing chrome and a localized link home.
- **Inputs:** None. Calls `getRequestLocale()` for body/back-link copy.
- **Returns / side effects:** 404 element with `MarketingHeader` / `MarketingFooter`.
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
