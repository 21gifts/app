# Functions

## Function: PosPage

- **Purpose:** App Router page for `/pos`. Wraps `PosScreen` in `AppShell` and `OnboardingGate screen="profile"`.
- **Inputs:** None.
- **Returns / side effects:** The page element. No direct I/O.
- **Used by:** Route `/pos`.

## Function: PosScreen

- **Purpose:** Signed-in till. Loads `GET /pos/charge`, shows the public address and the same Open CryptoPay QR as the profile card, including on a smartphone, and either an amount form or the open charge (countdown, including 0:00, amount, and Cancel) until the server returns no charge. A slower refresh cannot replace a newer create or cancel. History lists recent rows. No paid status.
- **Inputs:** None. Reads the auth store session and account.
- **Returns / side effects:** React element. Calls `fetchPosState`, `createPosCharge`, and `cancelPosCharge`.
- **Used by:** `/pos`.

## Function: fetchPosState

- **Purpose:** `GET /pos/charge` for the signed-in till.
- **Inputs:** Bearer `sessionToken`.
- **Returns / side effects:** `{ charge, history }`. Throws when the response is not OK.
- **Used by:** `PosScreen`.

## Function: createPosCharge

- **Purpose:** `POST /pos/charge` with `{ amountSats }`.
- **Inputs:** Bearer `sessionToken` and a whole sat amount.
- **Returns / side effects:** The created charge. Throws with the API error string.
- **Used by:** `PosScreen`.

## Function: cancelPosCharge

- **Purpose:** `DELETE /pos/charge`.
- **Inputs:** Bearer `sessionToken`.
- **Returns / side effects:** Resolves when the open charge is cancelled. Throws otherwise.
- **Used by:** `PosScreen`.

## Function: proxyPosGet

- **Purpose:** Same-origin proxy of api `GET /pos`.
- **Inputs:** Incoming `Request`.
- **Returns / side effects:** Upstream response.
- **Used by:** `GET /pos/charge`.

## Function: proxyPosPost

- **Purpose:** Same-origin proxy of api `POST /pos`.
- **Inputs:** Incoming `Request`.
- **Returns / side effects:** Upstream response.
- **Used by:** `POST /pos/charge`.

## Function: proxyPosDelete

- **Purpose:** Same-origin proxy of api `DELETE /pos`.
- **Inputs:** Incoming `Request`.
- **Returns / side effects:** Upstream response.
- **Used by:** `DELETE /pos/charge`.

## Function: GET

- **Purpose:** Shared export name for App Router GET handlers. Healthz and `/maps/key` use `export function GET` (`/maps/key` is always 200 `{ key: string | null }`); same-origin api proxies re-export unique functions as `GET` (including `/forum/messages`, `/forum/messages/places` which re-exports `proxyMessagesPlacesGet`, `/forum/messages/hidden` which re-exports `proxyMessagesHiddenGet`, `/forum/notifications` which re-exports `proxyNotificationsGet`, `/messages/[id]/photo`, `/messages/[id]/photo/[file]` (`{1-9}.{jpg|jpeg|png|webp}`, proxy always requests `{n}.jpg` from the api), `/conversations/[id]/messages/[messageId]/photo`, `/conversations/[id]/messages/[messageId]/photo/[file]` (`{1-9}.{jpg|jpeg|png|webp}`, proxy always requests `{n}.jpg` from the api), `/messages/[id]/[file]`, `/view-key/[viewKey]`, `/push/vapid-public`, `/trust/graph`, `/trust/proposals` which re-exports `proxyTrustProposalsGet`, `/funding/applications` which re-exports `proxyFundingApplicationsGet`, and `/funding/applications/[accountId]` which calls `proxyFundingApplicationGet`). `/translate` re-exports `proxyTranslateAvailableGet` (api GET `/translate`). HTML `/messages` is the inbox page, not a GET proxy. HTML `/notifications` is the notifications page, not a GET proxy. HTML `/moderate` is the moderation hub, not a GET proxy. HTML `/moderate/hidden` is the hidden-notes page, not a GET proxy. HTML `/moderate/proposals` is the confirm/reject queue, not a GET proxy. HTML `/moderate/applications` is the grant-application queue, not a GET proxy. HTML `/moderate/applications/[accountId]` is the grant-application review, not a GET proxy. HTML `/moderate/group` is the closed staff-room page, not a GET proxy. The signed-in HTML page `/trust-chain` is `TrustChainPage`, not this GET. `GET /l/[code]` redirects an 8-hex short code or calls `notFound()`. `GET /links/[code]` re-exports `proxyShortLinkGet`. HTML `/pos` is the till page, not a GET proxy; `GET /pos/charge` re-exports `proxyPosGet`.
- **Inputs:** Incoming `Request` on proxy routes (plus async `params` on dynamic photo, `/messages/[id]/photo/[file]` (`id` + `file` matching `{1-9}.{jpg|jpeg|png|webp}`; proxy always requests `{n}.jpg` from the api), `/conversations/[id]/messages/[messageId]/photo` (`id` + `messageId`), `/conversations/[id]/messages/[messageId]/photo/[file]` (`id` + `messageId` + `file` matching `{1-9}.{jpg|jpeg|png|webp}`; proxy always requests `{n}.jpg` from the api), file, and view-key); none on healthz or `/maps/key`; `/translate` takes the incoming `Request`.
- **Returns / side effects:** `Response`. Healthz is `{ status: 'ok' }` 200; `/maps/key` is always 200 `{ key: string | null }`; `/translate` is 200 `{ available: boolean }` or 502; proxies return the upstream api response (JSON or raw photo/video bytes).
- **Used by:** Container probes, browser/wallet same-origin calls, and `fetchTranslateAvailable` via `GET /translate`. `GET /.well-known/nostr.json` proxies NIP-05. `GET /.well-known/lnurlp/[username]` proxies LUD-16.

## Function: OPTIONS

- **Purpose:** CORS preflight for `/.well-known/nostr.json` and `/.well-known/lnurlp/[username]`.
- **Inputs:** none.
- **Returns / side effects:** 204 with `Access-Control-Allow-Origin: *`.
- **Used by:** Damus NIP-05 fetch and LUD-16 payRequest preflight.

## Function: isForumVideoFile

- **Purpose:** True when a picker file is MP4, WebM, QuickTime, or MPEG-4 video (type `video/mp4` / `video/webm` / `video/quicktime` / `video/x-m4v`, or `.mp4`/`.webm`/`.mov`/`.m4v` name).
- **Inputs:** `File`.
- **Returns / side effects:** boolean.
- **Used by:** `ForumLoader` attach control.

## Function: prepareForumVideo

- **Purpose:** Size-check (32 MiB) and capture a first-frame JPEG poster when the browser can decode the clip. If capture fails (iPhone HEVC / Dolby Vision), still return ok with a fallback JPEG poster.
- **Inputs:** `File`.
- **Returns / side effects:** `{ ok: true, video }` with `file`, JPEG `poster`, and `previewUrl`; or `{ ok: false, error: 'unsupported' | 'tooLarge' }`. Errors are only type/name (`unsupported`) and oversize (`tooLarge`) — a failed poster capture is not an error.
- **Used by:** `ForumLoader`.

## Function: postMessageVideo

- **Purpose:** Multipart `POST /forum/messages` with `video` + optional `poster`, optional `goalCurrency` and `goalAmount` (trimmed draft, comma stays; omitted from the form when either is missing, and on replies), and optional `placeLat` / `placeLng` / `placeLabel` (only when a pin is set; replies must not send them). Not `goalSats`.
- **Inputs:** session token, `{ text, video, poster?, goalCurrency?, goalAmount?, place? }`.
- **Returns / side effects:** `ForumMessage`.
- **Used by:** `ForumLoader` submit.

## Function: forumVideoSrc

- **Purpose:** Build the same-origin forum video path for a message from its MIME type so playback uses `.mp4`, `.webm`, or `.mov` correctly.
- **Inputs:** `messageId` string and optional `contentType` (`video/mp4` | `video/webm` | `video/quicktime` | null | undefined).
- **Returns / side effects:** `/messages/{id}/video.mp4` | `.webm` | `.mov` (defaults to `.mp4` when type is missing or unknown). No I/O.
- **Used by:** `ForumBoard` playback `src` when no local preview URL is set.

## Function: HandbookCopyLink

- **Purpose:** Client button beside a handbook heading, chapter, screen heading, or figure-card permalink. Copies `origin + pathname + #id` to the clipboard, sets `location.hash`, and flashes a check icon for 1.2s (textarea `execCommand` fallback).
- **Inputs:** `targetId` (DOM id without `#`) and `label` (interpolated into `handbook.copyLink` via `useTranslations` as `{ label }`). Optional `tone` (`'app' | 'dark'`, default `'dark'`). Copied Check uses `text-accent` when dark and `text-app-fg` when `app`.
- **Visible UI:** Idle `Link2` icon; copied `Check` icon. No visible "Copy link" or "Copied" text (`title` and `aria-label` keep the accessible name).
- **Returns / side effects:** A `<button type="button">`. Clipboard write; hash update. No network.
- **Used by:** `HandbookPage` (page title), `HandbookMarkdown` (every heading), `HandbookFigure`, `HandbookSectionHeading`, and `ModerateHandbookScreen`.

## Function: HandbookMarkdown

- **Purpose:** Render parsed handbook markdown as Tailwind-styled headings, paragraphs, lists, links, and images. Every heading has a sibling `HandbookCopyLink`. A paragraph whose only inline is an image becomes a `HandbookFigure` (thumbnail, lightbox, deep link) instead of `<p><img>`.
- **Inputs:** `markdown` string and `idPrefix` for heading ids.
- **Returns / side effects:** React fragment. No network.
- **Used by:** `HandbookFunctionsPage` and `HandbookEndpointsPage`.

## Function: HandbookIntro

- **Purpose:** Server-presentational chrome for the `/handbook` title, intro sentence, and section-nav `aria-label` (already-translated copy).
- **Inputs:** `title`, `introBefore`, `introAfter`, `navAria` (already-translated strings), `headingAction` (node beside the h1, e.g. copy-link), and `children` (the section links).
- **Returns / side effects:** Heading, intro with the api-handbook GitHub link, and a nav whose accessible name comes from `navAria`. No network.
- **Used by:** `HandbookPage`, `HandbookScreensPage`, `HandbookFunctionsPage`, `HandbookEndpointsPage`.

## Function: HandbookPage

- **Purpose:** Async Next.js hub for `/handbook`. Resolves locale via `getRequestLocale` and links to `/handbook/screens`, `/handbook/functions`, and `/handbook/endpoints` without dumping those markdown files. Title copy-link uses `handbook.title`; intro chrome via already-translated props on `HandbookIntro`.
- **Inputs:** None (calls `getRequestLocale()`).
- **Returns / side effects:** The handbook hub inside `MarketingLayout`.
- **Used by:** Route `/handbook`.

## Function: StatsLoader

- **Purpose:** Client loader for `/stats`. Fetches gift totals on mount and retry, ignores stale responses after unmount, and renders `StatsDashboard`.
- **Inputs:** None.
- **Returns / side effects:** React element. Calls `fetchGiftStats`.
- **Used by:** `StatsPage`.

## Function: StatsDashboard

- **Purpose:** Renders gift KPIs (`formatBitcoin(totalSats)` plus `formatFiatDisplay` of the preferred fiat from `useFiatPreference`; a null fiat total is `—`, not `CHF 0`) and SVG diagrams (cumulative spend over time, by person, by month), plus loading/error/empty states. FiatPicker (CHF | EUR | USD | PHP) above the KPI cards **only when unsigned** (`useHydrateSession().ready && session === null`). Signed-in visitors still display and scale with the preferred code and cannot change it here. **Total spend over time** links each non-zero UTC day on the chart (not as a wrapping text list) to `/stats/{day}`. Each of **Total spend over time**, **By person**, and **By month** uses `SegmentedControl tone="gift" shell="dark"` for ₿ | {preferred FiatCode} via BarScale `'btc' | 'fiat'` (default ₿). Over time shows one cumulative series. Person and month rescale bar size while labels stay both units. Footnote is the USD daily-close sentence, or `{code} is USD at each gift's UTC-day close, converted with that day's ECB rate.` for CHF/EUR/PHP.
- **Inputs:** `stats`, `error`, `loading`, `onRetry`.
- **Returns / side effects:** React element. Reads `useFiatPreference`. No network.
- **Used by:** `StatsLoader`.

## Function: StatsPage

- **Purpose:** Next.js page for `/stats`. Renders `StatsLoader`.
- **Inputs:** None.
- **Returns / side effects:** The statistics screen inside `MarketingLayout`. Renders `StatsLoader`.
- **Used by:** Route `/stats`.

## Function: GiftDayPage

- **Purpose:** Next.js page for `/stats/[day]`. Invalid UTC days call `notFound()`. Valid days render `DayLoader`.
- **Inputs:** `params` Promise `{ day }`.
- **Returns / side effects:** The day screen inside `MarketingLayout`.
- **Used by:** Route `/stats/[day]`.

## Function: DayLoader

- **Purpose:** Client loader for `/stats/[day]`. Fetches `GET /gifts?day=`, date input navigates, retry on error. FiatPicker on the loaded table **only when unsigned** (`useHydrateSession().ready && session === null`). The summary line is `{n} gift(s) · ₿ · formatFiatDisplay(total, selected fiat, numberFormat)`.
- **Inputs:** `day` UTC `YYYY-MM-DD`.
- **Returns / side effects:** React element. Calls `fetchGiftDay`. Reads `useFiatPreference` and `useNumberFormat` and passes both into `GiftDayTable`.
- **Used by:** `GiftDayPage`.

## Function: GiftDayTable

- **Purpose:** Table of individual gifts on one UTC day (Time, Recipient, ₿, {FiatCode}), or empty copy **No gifts recorded on this day.**
- **Inputs:** `day: GiftDay`, `fiat: FiatCode`, and required `numberFormat` (`ch` / `us` / `de`) for ₿ and fiat cells.
- **Returns / side effects:** React element. Fourth column header is the selected code; cells use `formatBitcoin` and `formatFiatDisplay` with `numberFormat`. No network.
- **Used by:** `DayLoader`.

## Function: FiatPicker

- **Purpose:** Four-way CHF | EUR | USD | PHP control, no ₿. Optional `shell` default `'dark'` AND optional `tone` default `'gift'` (unsigned chart, stats, day). Profile settings (`FiatPreferenceSwitcher`) pass `tone="neutral"`. Required `ariaLabel` (Profile and the unsigned activity chart pass catalog `profile.fiatCurrency`). Chart scale stays a separate ₿ | selected fiat control. Unsigned chart / stats / day mounts mean `useHydrateSession().ready && session === null`, not merely a null session. Forum, the public thread (`PublicMessageLoader`), and the pay sheet do not mount it.
- **Inputs:** `value` (`FiatCode`) and `onChange`; optional `shell` (`'app' | 'dark'`, default `'dark'`); optional `tone` (`'gift' | 'neutral'`, default `'gift'`); required `ariaLabel`.
- **Returns / side effects:** React element. No network.
- **Used by:** `FiatPreferenceSwitcher` (always, signed-in profile); `AccountActivityChart`, `StatsDashboard`, `DayLoader` when unsigned.

## Function: fetchGiftDay

- **Purpose:** GET `/gifts?day=` and parse the per-day gift list payload.
- **Inputs:** UTC `day` string.
- **Returns / side effects:** `GiftDay`. Throws visitor copy on non-OK or invalid JSON.
- **Used by:** `DayLoader`.

## Function: isUtcDay

- **Purpose:** Validate a UTC calendar day string `YYYY-MM-DD`.
- **Inputs:** Candidate `day`.
- **Returns / side effects:** `true` only for a real calendar date. No I/O.
- **Used by:** `GiftDayPage`, `DayLoader`.

## Function: proxyGiftsGet

- **Purpose:** Same-origin proxy helper for api `GET /gifts` (forwards `day`).
- **Inputs:** Incoming `Request`.
- **Returns / side effects:** Upstream `Response`.
- **Used by:** Route GET `/gifts`.

## Function: Home

- **Purpose:** Next.js page for `/`. Marketing landing: pitch, how it works, why, project donate (`#project`, address `21gifts@walletofsatoshi.com` for running 21.gifts itself — distinct from `/donate` forum gifts), FAQ, CTAs to `/login` (**Ask for help**) and `/donate` (**Send help**), plus `PwaInstall` (`tone="dark"` `placement="hero"`) after Send help, all via `translate` for the negotiated locale.
- **Inputs:** None. Calls `getRequestLocale()`.
- **Returns / side effects:** The home screen element.
- **Used by:** Route `/`.

## Function: LanguageSwitcher

- **Purpose:** Custom language listbox (not a native `<select>`) that persists the visitor's override in a `locale` cookie and refreshes the App Router tree. Public / unsigned chrome only (Globe pill + absolute popover). Signed-in language lives on Profile.
- **Inputs:** `tone` (`dark` for marketing chrome, `light` for login, donate, unsigned `/rules`, unsigned `/messages/[id]`, and `/view/[viewKey]`). Reads current locale via `useTranslations` and an optional session token from storage. No `embedded` prop.
- **Returns / side effects:** Combobox + absolute popover listbox with endonym labels. A same-locale click is a no-op. With a session token, a new locale first calls `bumpLocaleGeneration()`, then `setAccountLocale(token, next, false)`; failure, a stale generation, or a response for a different account writes no cookie and does not refresh, while success merges only `locale` onto the current same-id account before writing the cookie and refreshing. Without a token it does not bump or POST and writes `locale=<code>; Path=/; Max-Age=31536000; SameSite=Lax` plus `; Secure` on HTTPS before `router.refresh()`, as before. Never set on first visit.
- **Used by:** `MarketingHeader` (always visible), `/login`, `/donate`, unsigned `/rules`, unsigned `/messages/[id]`, `/view/[viewKey]`.

## Function: LanguagePreferenceSwitcher

- **Purpose:** Profile identity-card settings section: uppercase `language.label` kicker and `SegmentedControl tone="neutral"` (default one-row `rounded-full` track, same as ThemeSwitcher) for English / Deutsch / Español / Filipino. Always visible on the signed-in Profile card. Not page chrome, not a Menu disclosure.
- **Inputs:** None. Reads current locale via `useTranslations` and an optional session token from storage. Catalog keys `language.label`, `aria.language`. Option labels are native endonyms (not catalogized).
- **Returns / side effects:** Settings row matching `PushToggle` chrome. A same-locale click is a no-op. With a session token, a new locale first calls `bumpLocaleGeneration()`, then `setAccountLocale(token, next, false)`; failure, a stale generation, or a response for a different account writes no cookie and does not refresh, while success merges only `locale` onto the current same-id account before writing the cookie and refreshing. Without a token it does not bump or POST and writes the locale cookie, including `Secure` on HTTPS, then refreshes as before.
- **Used by:** `ProfileScreen`.

## Function: NumberFormatSwitcher

- **Purpose:** Profile identity-card settings section: uppercase `numberFormat.label` kicker and `SegmentedControl tone="neutral"` for the three sample labels (`10'000.23` / `10,000.23` / `23.000,33`). Always visible on the signed-in Profile card. Not page chrome, not a Menu disclosure.
- **Inputs:** None. Reads `numberFormat` / `setNumberFormat` from `useNumberFormat`. Catalog keys `numberFormat.label`, `aria.numberFormat`. Option labels are samples from `formatGroupedNumber`.
- **Returns / side effects:** Settings row matching `PushToggle` chrome. Pressing an option calls `setNumberFormat` (cookie write via `NumberFormatProvider`).
- **Used by:** `ProfileScreen`.

## Function: NameForm

- **Purpose:** Logged-in form to set or edit a display name. Onboarding (`variant="onboarding"`): field at the top, **Continue** and labeled **Skip** at the bottom. Profile / overlay: icon-only actions (no Skip). Optional `onSaved` after a successful save.
- **Inputs:** Reads `useAuthStore`. User input: name string. Visitor-facing copy via `useTranslations`. Empty and request failures are typed keys so they re-render after a locale change.
- **Returns / side effects:** React element or `null` when logged out. POST `/me/name` on save; POST `/me/setup/skip` on Skip. Merges `name`, `setup`, and `missing`.
- **Used by:** `NameSetup` on `/setup/name`, `ProfileScreen` on `/profile`, and `RequirementsOverlay`.

## Function: LocationForm

- **Purpose:** Logged-in profile row to set, edit, or clear a free-text location. Icon-only actions (pencil / check / X / trash). Empty after trim is a valid save and clears. Not an onboarding step and has no Skip.
- **Inputs:** Reads `useAuthStore`. Optional `startEditing` opens the field on mount. User input: location string. Visitor-facing copy via `useTranslations` (`location.*`). Request failures use `location.errorRequest`.
- **Returns / side effects:** React element or `null` when logged out. POST `/me/location` on save or clear. Merges only `location` so a concurrent name or address write is not overwritten.
- **Used by:** `ProfileScreen` on `/profile`, `FundingApplyScreen` on `/profile/apply`.

## Function: LightningAddressForm

- **Purpose:** Logged-in form to link, edit, or unlink a Wallet of Satoshi address. Onboarding (`variant="onboarding"`): field at the top, **Continue** and labeled **Skip** at the bottom. Profile / overlay: icon-only actions (no Skip). Optional `onSaved` after a successful address save (not Skip or unlink).
- **Inputs:** Reads `useAuthStore`. User input: address string. Visitor-facing copy via `useTranslations`. Empty, not-found, request, and `notZap` failures are typed keys (`la.errorEmpty`, `la.errorNotFound`, `la.errorRequest`, `la.errorNotZap`) so they re-render after a locale change. After `notZap`, Continue/Save stays disabled while the trimmed draft equals the blocked address; changing the draft clears the alert and re-enables; restoring the blocked address re-locks. Inline alerts (`empty` / `notFound` / `request` / `notZap`) are not separate screen variants.
- **Returns / side effects:** React element or `null` when logged out. POST `/me/lightning-address` on save; POST `/me/setup/skip` on Skip. Merges address fields plus `setup` and `missing`.
- **Used by:** `AddressSetup` on `/setup/address`, `ProfileScreen` on `/profile`, and `RequirementsOverlay`.

## Function: LocaleProvider

- **Purpose:** Client context provider that exposes the negotiated locale and a bound `t` helper to visitor-facing components.
- **Inputs:** `locale`, `messages` for that locale, and `children`.
- **Returns / side effects:** React provider element. No network; does not write cookies.
- **Used by:** `RootLayout` wraps every page; consumed via `useTranslations` (see that function).

## Function: NumberFormatProvider

- **Purpose:** Client context provider that exposes the negotiated number-format style and a setter that writes the `numberFormat` cookie. Nest is `LocaleProvider` → `NumberFormatProvider initial={numberFormat}` → `FiatPreferenceProvider initial={fiat}` → `ThemeProvider`.
- **Inputs:** `initial` (`NumberFormatStyle` from `getRequestNumberFormat`) and `children`.
- **Returns / side effects:** React provider element. `setNumberFormat` writes `numberFormat=<id>; Path=/; Max-Age=31536000; SameSite=Lax` and `; Secure` on HTTPS. Same-id is a no-op when the cookie is already `ch`/`us`/`de`; selecting `ch` while the cookie is absent still writes so the choice persists.
- **Used by:** `RootLayout` wraps every page; consumed via `useNumberFormat` (see that function).

## Function: FiatPreferenceProvider

- **Purpose:** Client context provider that exposes the preferred fiat and a setter that writes the `fiat` cookie. Nest is `LocaleProvider` → `NumberFormatProvider` → `FiatPreferenceProvider initial={fiat}` → `ThemeProvider`.
- **Inputs:** `initial` (`FiatCode` from `getRequestFiat`) and `children`.
- **Returns / side effects:** React provider element. Syncs in-memory code to `initial` when that prop changes and no valid cookie is set (locale default after `router.refresh()` with no cookie). A valid `fiat` cookie wins over a stale `initial`. `setFiat` does not rewrite the cookie when it already equals `next`; in-memory state still syncs to `next` if it is stale. Otherwise writes `fiat=<code>; Path=/; Max-Age=31536000; SameSite=Lax` and `; Secure` on HTTPS.
- **Used by:** `RootLayout` wraps every page; consumed via `useFiatPreference`.

## Function: useFiatPreference

- **Purpose:** Reads preferred `FiatCode` and `setFiat` from {@link FiatPreferenceProvider}.
- **Inputs:** None (context).
- **Returns / side effects:** `{ fiat, setFiat }`. Throws outside the provider.
- **Used by:** `FiatPreferenceSwitcher`, `AccountActivityChart`, `ForumBoard`, `PublicMessageLoader`, `StatsDashboard`, `DayLoader`.

## Function: FiatPreferenceSwitcher

- **Purpose:** Profile identity-card settings row: uppercase `profile.fiatCurrency` kicker plus `FiatPicker` `shell="app"` `tone="neutral"` (same chrome as ThemeSwitcher / NumberFormatSwitcher / LanguagePreferenceSwitcher; selected is `bg-app-btn`, not orange). The **only** signed-in control that writes the `fiat` cookie. Unsigned chart / stats / day FiatPickers still write that cookie and keep default `tone="gift"`.
- **Inputs:** None. Uses `useFiatPreference`, `useTranslations`, and an optional session token from storage.
- **Returns / side effects:** A same-fiat choice is a no-op. With a session token, a new choice first calls `bumpFiatGeneration()`, then `setAccountFiat(token, next, false)`; failure, a stale generation, or a response for a different account does not call `setAccount` or `setFiat`, while success merges only `fiat` onto the current same-id account before `setFiat`. Without a token it does not bump or POST and only calls `setFiat`. Unsigned `FiatPicker` instances remain cookie-only.
- **Used by:** `ProfileScreen`.

## Function: AccountPreferenceSync

- **Purpose:** Reconciles nullable signed-in account locale and fiat preferences with the screen and supported preference cookies once per account id.
- **Inputs:** Hydrated auth `session` and `account`, screen locale, fiat context, preference generations, and the router.
- **Returns / side effects:** Returns `null`; fills explicit `null` values with `onlyIfUnset=true` only when the generation captured before hydration still matches, mirrors a stored fiat into its cookie even when the visible code already matches, merges only that one field onto the current account, stops when the session is gone, ignores missing keys, and discards a stale response without replacing the other preference.
- **Used by:** `RootLayout` inside `FiatPreferenceProvider`.

## Function: bumpLocaleGeneration

- **Purpose:** Marks a newer explicit locale choice so older asynchronous locale work cannot overwrite it.
- **Inputs:** None.
- **Returns / side effects:** Increments and returns the module-local locale generation counter.
- **Used by:** Language controls before an authenticated locale POST.

## Function: localeGeneration

- **Purpose:** Reads the current locale generation for stale-response guards.
- **Inputs:** None.
- **Returns / side effects:** Returns the module-local counter without changing it.
- **Used by:** Language controls and `AccountPreferenceSync`.

## Function: bumpFiatGeneration

- **Purpose:** Marks a newer explicit fiat choice so older asynchronous fiat work cannot overwrite it.
- **Inputs:** None.
- **Returns / side effects:** Increments and returns the module-local fiat generation counter.
- **Used by:** `FiatPreferenceSwitcher` before an authenticated fiat POST.

## Function: fiatGeneration

- **Purpose:** Reads the current fiat generation for stale-response guards.
- **Inputs:** None.
- **Returns / side effects:** Returns the module-local counter without changing it.
- **Used by:** `FiatPreferenceSwitcher` and `AccountPreferenceSync`.

## Function: parseFiatCode

- **Purpose:** Accept a raw cookie/option string if it is exactly one of `CHF|EUR|USD|PHP`; otherwise return `fallback`.
- **Inputs:** `value` (optional string) and `fallback` (`FiatCode`).
- **Returns / side effects:** A `FiatCode`. No side effects.
- **Used by:** `getRequestFiat`, `FiatPreferenceProvider`.

## Function: getRequestFiat

- **Purpose:** Cookie `fiat` if valid; otherwise `defaultFiatForLocale(locale)`. Never writes.
- **Inputs:** Request `locale`.
- **Returns / side effects:** `FiatCode` for this request.
- **Used by:** `RootLayout`.

## Function: InAppBrowserView

- **Purpose:** Shared escape UI when a passkey ceremony cannot run inside Telegram or another in-app browser: heading **Open this page in your browser**, body copy, optional iOS hint, **Open in browser**, and **Copy link**.
- **Inputs:** None. Uses `useTranslations`, `openInSystemBrowser`, and `origin + pathname` as the URL to open or copy (so on `/view/<key>` the invite URL is used).
- **Returns / side effects:** Fragment with the escape controls. No WebAuthn. Clipboard via `execCommand('copy')` fallback then `navigator.clipboard`.
- **Used by:** `LoginCard` (in-app / unsupported branch) and `ViewProfileClaim` (same branch under the public view card).

## Function: LoginCard

- **Purpose:** Login UI: one **Log in** button (authenticate-first), an account-choice card after browser `NotAllowedError` (**Log in with existing account** / **Open a new account**), preparing, error, or an in-app browser escape card via `InAppBrowserView` (**Open in browser** + **Copy link**, no passkey ceremony). After success, `OnboardingGate` leaves `/login`. A new account is created only after **Open a new account** and a completed create ceremony. Error uses `login.error` plus **Try again**, except a wrong-account 403 (`wrongAccount` or passkey error equal to that api string) which uses `login.wrongAccount` with the same layout. **Try again** on that hint calls `clearWrongAccount` then `passkey.login` (never `retry`, so it cannot create another account). Generic errors still call `passkey.retry`.
- **Inputs:** Uses `usePasskeyLogin`, `useAuthStore`, `isInAppBrowser`, and `InAppBrowserView`.
- **Returns / side effects:** React element covering idle/choice/starting/error/wrong-account/in-app. A signed-in account shows the preparing spinner until redirect. Detects in-app browsers after mount; never starts WebAuthn from the in-app card.
- **Used by:** Screen `/login`.

## Function: LoginPage

- **Purpose:** Next.js page for `/login`. The visible heading lives in `LoginCard` (`login.heading`).
- **Inputs:** None.
- **Returns / side effects:** `AppShell` with `HomeWordmark` top-left (`/` unsigned, `/welcome` when a session is hydrated) and `LanguageSwitcher` top-right, wrapping `OnboardingGate` around `LoginCard`. Signed-in visitors are sent to `/setup/name`, `/setup/username`, `/setup/address`, `/setup/rules`, or `/welcome`. The recovery phrase is not part of that path.
- **Used by:** Route `/login`.

## Function: DonatePage

- **Purpose:** Next.js page for `/donate`. Guest-visible Send help explainer: pick a forum message, then send Bitcoin; CTA to `/welcome`. No address/amount form and no QR.
- **Inputs:** None. Calls `getRequestLocale()` for localized copy.
- **Returns / side effects:** `AppShell` with `HomeWordmark` top-left (`/` unsigned, `/welcome` when a session is hydrated) and `LanguageSwitcher` top-right; heading, lead, **Open the forum** `ButtonLink`. No OnboardingGate.
- **Used by:**
  - **Route `/donate`**
  - **Home CTA `home.ctaSend`**
  - **LanguageSwitcher on `/donate`**

## Function: AddressSetup

- **Purpose:** Second post-login screen: Wallet of Satoshi address form after the name is saved. No `LogoutButton`.
- **Inputs:** Reads `account.name` from `useAuthStore` for the greeting.
- **Returns / side effects:** Heading **Your Wallet of Satoshi address** at the top and `LightningAddressForm` (`variant="onboarding"`) with **Continue** at the bottom of the screen. No `LogoutButton`.
- **Used by:** Screen `/setup/address`.

## Function: AddressSetupPage

- **Purpose:** Next.js page for `/setup/address`.
- **Inputs:** None.
- **Returns / side effects:** `AppShell` with `Wordmark` top-left, `SignedInChrome` top-right, and `OnboardingGate` around `AddressSetup`.
- **Used by:** Route `/setup/address`.

## Function: RulesSetup

- **Purpose:** Third post-login screen: one living-room rules chapter at a time. Intermediate **Continue** clicks only advance the chapter. The last **I agree to these rules** POSTs and merges `rulesAgreedAt`, `setup`, and `missing` into the auth-store account.
- **Inputs:** `chapters` — ordered server-rendered `RulesDocument` elements (one per `RULES_CHAPTER_IDS` id).
- **Returns / side effects:** Heading, prompt, progress, current chapter, error alert, full-width **Continue** until the last chapter, then **I agree to these rules**, Wordmark top-left plus icon-only chapter back after the first chapter. Continue and Back also reset the fill inner scroller to the top. POSTs `/me/rules-agreement` via `agreeToRules` only on the last chapter. Renders `null` without a session or when `chapters` is empty.
- **Used by:** Screen `/setup/rules`.

## Function: RulesSetupPage

- **Purpose:** Next.js page for `/setup/rules`.
- **Inputs:** None. Calls `getRequestLocale()` / `getCatalog` for the rules body.
- **Returns / side effects:** Fill `AppShell` (`align="start"`) with `SignedInChrome` top-right and `OnboardingGate` around `RulesSetup` (`RULES_CHAPTER_IDS` mapped to `RulesDocument` chapters, `showNav={false}`, `chapter={id}`). Wordmark and chapter-back stay in `RulesSetup` via `AppShellTopLeft` because back is chapter state, not a page-level back.
- **Used by:** Route `/setup/rules`.

## Function: LogoutButton

- **Purpose:** Matching icon+text log-out inside the signed-in Menu dropdown (not a free top-right action); clears the session and returns the visitor to `/login`.
- **Inputs:** `useAuthStore.clearAuth`, `usePasskeyLogin.cancel`, `useRouter`, `disablePush`.
- **Returns / side effects:** Full-width Menu-row icon+text button (same row chrome as Home / Profile / Contact). Best-effort `disablePush` (unsubscribe) while the session token is still valid, then clears the session and `router.replace('/login')`; a `disablePush` failure does not block log out.
- **Used by:** `SignedInChrome` Menu dropdown.

## Function: NameSetup

- **Purpose:** Display-name form when `account.setup === 'name'`.
- **Inputs:** None besides `NameForm` store reads.
- **Returns / side effects:** Heading **Your name** at the top and `NameForm` (`variant="onboarding"`) with **Continue** at the bottom of the screen. No `LogoutButton`.
- **Used by:** Screen `/setup/name`.

## Function: UsernameForm

- **Purpose:** Username field and **Continue**. Posts `POST /me/username`. Cannot skip.
- **Inputs:** Auth store session; optional `onSaved`.
- **Returns / side effects:** Taken/invalid/request stay on the form. Success updates the store and calls `onSaved`.
- **Used by:** `UsernameSetup`, `RequirementsOverlay`.

## Function: UsernameSetup

- **Purpose:** Post-login screen to choose the unique `@21.gifts` username. Cannot skip.
- **Inputs:** Auth store session; `UsernameForm`.
- **Returns / side effects:** Heading **Your 21.gifts name**, hint, field, **Continue**. Posts `POST /me/username`. Taken/invalid stay on the form.
- **Used by:** Screen `/setup/username`.

## Function: UsernameSetupPage

- **Purpose:** Next.js page for `/setup/username`.
- **Inputs:** None.
- **Returns / side effects:** `AppShell` with `Wordmark` top-left, `SignedInChrome` top-right, and `OnboardingGate` around `UsernameSetup`.
- **Used by:** Route `/setup/username`.

## Function: NameSetupPage

- **Purpose:** Next.js page for `/setup/name`.
- **Inputs:** None.
- **Returns / side effects:** `AppShell` with `Wordmark` top-left, `SignedInChrome` top-right, and `OnboardingGate` around `NameSetup`.
- **Used by:** Route `/setup/name`.

## Function: openInSystemBrowser

- **Purpose:** Best-effort handoff from an in-app WebView to the system browser so the visitor can complete a passkey login or invite claim in Safari or Chrome.
- **Inputs:** Absolute `https` login `url`, and optional `SystemBrowserHost` (`win`; defaults to `globalThis.window`). Missing window is a no-op.
- **Returns / side effects:** On Android, sets `location.href` to a Chrome Intent URL with an encoded fallback. Else if `Telegram.WebApp.openLink` is a function, calls it. Else on iOS Telegram (JS bridges or UA `Telegram`), sets `location.href` to `x-safari-` + `url`. Otherwise calls `host.open(url, '_blank', 'noopener,noreferrer')`. No network of its own.
- **Used by:** `InAppBrowserView` **Open in browser** (via `LoginCard` and `ViewProfileClaim`), the `/login` and `/view/[viewKey]` in-app e2e flows, and handbook coverage for those in-app variants.

## Function: OnboardingGate

- **Purpose:** Hydrates the session and sends the visitor to the matching post-login screen (or keeps a complete account on `/profile`, `/wallet`, and `/members/[accountId]`).
- **Inputs:** `screen` (`login` / `wallet` / `name` / `username` / `address` / `rules` / `welcome` / `profile`) and `children`. Members use `screen="profile"`. `/wallet` uses `screen="wallet"`.
- **Returns / side effects:** Children on the correct screen, otherwise a spinner. Follows `nextOnboardingPath`. The recovery phrase is not a setup step and does not replace the opened page; `nextOnboardingPath` never returns `/wallet`. `/wallet` itself stays on screen when `setup` is `'wallet'` or the next step is `/welcome`. Profile and members stay only when the next step is `/welcome`. Name, username, address, and rules still redirect when that is the next step. Other `router.replace` targets are `/login`, `/setup/name`, `/setup/username`, `/setup/address`, `/setup/rules`, or `/welcome` (`nextOnboardingPath` never returns `/profile`).
- **Used by:** Screens `/login`, `/wallet`, `/setup/name`, `/setup/username`, `/setup/address`, `/setup/rules`, `/welcome`, `/profile`, `/pos`, `/members/[accountId]`, `/contact`, `/messages`, `/notifications`, `/moderate`, `/moderate/hidden`, `/moderate/proposals`, `/moderate/applications`, `/moderate/applications/[accountId]`, `/trust-chain`, `/shops`.

## Function: SignedInChrome

- **Purpose:** Top-right signed-in chrome: one **Menu** control; open it for icon+label dropdown rows (Home `/welcome` lucide `Home` `nav.home` — when the path is already `/welcome`, Home `preventDefault`s and dispatches `FORUM_HOME_EVENT` instead of a no-op navigation; **Shops** (`/shops`, lucide `Store`, `nav.shops`); **Map** (`/map`, lucide `Map`, `nav.map`); **Point of sale** (`/pos`, lucide `Banknote`, `pos.nav`); User Profile with same-line given/received `ArrowUpRight`/`ArrowDownLeft` amounts only when that side is non-zero; **Wallet** (`/wallet`); ScrollText Living room rules `/rules`; **Trust Chain**; **Moderation** (`/moderate`, lucide `Shield`, `nav.moderate`) only when `roleAtLeast(account?.role, 'moderator')` — `aria-label` `nav.moderateUnread` with `{ count }` when `moderationUnreadCount` > 0 (staff-room unread plus open-proposal count) else `nav.moderate`; visible `nav.moderate` plus `ml-auto` tabular-nums count when > 0; **Notifications** (`/notifications`, lucide `Bell`, `nav.notifications`, unread count `ml-auto` only when `unreadCount` > 0, `aria-label` `nav.notificationsUnread` then); Messages `/messages` (`nav.inbox`, unread count `ml-auto` only when inbox unread > 0, `aria-label` `nav.inboxUnread` then); MessageCircle Contact `/contact`; optional Download **Install app** via `PwaInstall` `placement="menu"` when install is offered; LogOut log out; then a quiet Version line (`app.version`, `getAppVersion()`)). On mount with a session, calls `resyncPushSubscription`. Clicking Notifications asks for OS permission via `enablePush` when it is not already granted and Service Worker plus `PushManager` exist (otherwise resync, which no-ops without those APIs). When `account.setup` is null and `account.hasPosted` is false, also mounts `IntroduceYourselfOverlay` (Close dismisses this mount only; **Write an introduction** calls `requestForumCompose` so a remount after `router.push('/welcome')` stays hidden).
- **Inputs:** Session `account` and `session` from `useAuthStore` (introduce overlay gate and push resync). Composes `useAccountTotals`, `useUnreadCount(open)` (default write-badge: writes the home-screen badge), `PwaInstall` (`placement="menu"`, closes Menu via `onMenuAction`), and `LogoutButton` inside the Menu dropdown.
- **Returns / side effects:** Relative **Menu** button (`aria-expanded`, `aria-controls`) in the AppShell page-frame header (`[data-app-chrome]`). The panel is an in-tree `absolute` sibling of the Menu button (not a body portal). `PwaInstall` stays mounted via the `hidden` class when closed. When open, icon+label rows: **Home** (`/welcome`, lucide `Home`, `nav.home`), **Shops** (`/shops`, lucide `Store`, `nav.shops`), **Map** (`/map`, lucide `Map`, `nav.map`), **Point of sale** (`/pos`, lucide `Banknote`, `pos.nav`), Profile link (`/profile`) with same-line given/received amounts only when that side is non-zero (`aria-label`/`title` from `profile.given` / `profile.received`; both-zero omits the totals cluster; loading still `forum.loading`), **Wallet** (`/wallet`, lucide `Wallet`, `wallet.title`), **Living room rules** (`/rules`), **Trust Chain** (`/trust-chain`), **Moderation** (`/moderate`, lucide `Shield`, `nav.moderate`) only when `roleAtLeast(account?.role, 'moderator')` — `aria-label` `nav.moderateUnread` with `{ count }` when `moderationUnreadCount` > 0 (staff-room unread plus open-proposal count) else `nav.moderate`; visible `nav.moderate` plus `ml-auto` tabular-nums count when > 0, **Notifications** (`/notifications`, lucide `Bell`, `nav.notifications`, unread count on the right when greater than zero), **Messages** (`/messages`, `nav.inbox`, inbox unread count on the right when greater than zero), **Contact** (`/contact`), optional **Install app**, and log out, then a quiet Version line (`app.version`, `getAppVersion()`). Escape always closes Menu and restores focus to Menu. Local `useState` dismissed flag for `IntroduceYourselfOverlay` (initialized from `consumeSkipIntroduceOverlay`); does not write `forumLawsDismissed` or any account field.
- **Used by:** `NameSetupPage`, `UsernameSetupPage`, `AddressSetupPage`, `RulesSetupPage`, `WelcomePage`, `ShopsPage`, `MapPage`, `PosPage`, `ProfilePage`, `WalletPage`, `MemberProfilePage`, `ContactPage`, `MessagesPage`, `NotificationsPage`, `ModeratePage`, `HiddenNotesPage`, `ProposalsPage`, `FundingApplicationsPage`, `FundingApplicationDetailPage`, `TrustChainPage`, `RulesPageChrome`, `PublicMessageChrome`.

## Function: ProfilePage

- **Purpose:** Next.js page for `/profile`.
- **Inputs:** None.
- **Returns / side effects:** `AppShell` with `ProfileChromeLeft` top-left, `SignedInChrome` top-right, and `OnboardingGate` around `ProfileScreen`.
- **Used by:** Route `/profile`.

## Function: ProfileChromeLeft

- **Purpose:** Shared signed-in top-left chrome: icon-only back (44px link, ArrowLeft) plus `Wordmark` to `/welcome`. Optional `backHref` (default `/welcome`), `backLabelKey` (`profile.back` | `inbox.back` | `moderate.heading` | `nav.back`, default `profile.back`), and `onBackClick`. An unmodified click runs `onBackClick` and does not follow `backHref`. Modified clicks still follow `backHref`. Wallet's handler hides the words, closes Advanced functions, goes back, or opens the forum.
- **Inputs:** Optional `backHref`, `backLabelKey`, and `onBackClick`; catalog via `useTranslations`.
- **Returns / side effects:** A link (`aria-label` from `backLabelKey`) and a wordmark link to `/welcome`. `onBackClick` runs on an unmodified primary click. No network.
- **Used by:** `ProfilePage`, `WalletChromeLeft`, `WalletScreenView` (the visible `/wallet` Back, via `AppShellTopLeft`), `ShopsPage`, `MemberProfilePage` (`/members/[accountId]`), `ContactPage`, `MessagesPage` (via `MessagesChromeLeft`), `MessagesChromeLeft`, `NotificationsPage`, `ModeratePage`, `HiddenNotesPage`, `ProposalsPage`, `FundingApplicationsPage`, `FundingApplicationDetailPage`, `ModeratorGroupPage` (`backHref="/moderate"`, `moderate.heading`), `TrustChainPage`, `RulesPageChrome`, `PublicMessageChrome`. `WalletPage` mounts `WalletChromeLeft` as page `topLeft`; the card's registration wins while Wallet is shown.

## Function: resetWalletReturn

- **Purpose:** Clear the `/wallet` return path so back falls back to the forum (`/welcome`) when this tab has not opened another page.
- **Inputs:** None.
- **Returns / side effects:** `void`. Drops the shared tab slot and `sessionStorage` key `21gifts.walletReturn`. Does not touch `localStorage`.
- **Used by:** Wallet return tests, `RememberWalletReturn` tests, `WalletChromeLeft` tests (`afterEach`).

## Function: rememberWalletReturn

- **Purpose:** Remember a safe in-app path (not Wallet itself) as the `/wallet` back target. Rejects protocol-relative URLs, `..`, whitespace, `#`, overlong paths, and `/wallet` itself without clobbering a previous good path.
- **Inputs:** `path` string (pathname, optionally with a query string).
- **Returns / side effects:** `void`. Writes a `globalThis` slot and `sessionStorage` (`21gifts.walletReturn`) so every copy of the module in this tab sees the same path. No `localStorage`. No-op during SSR.
- **Used by:** `RememberWalletReturn`.

## Function: walletBackHref

- **Purpose:** Read the remembered in-app path for `/wallet` back, or `/welcome` when this tab has not opened another page.
- **Inputs:** None (reads the shared tab slot, which loads `sessionStorage` the first time).
- **Returns / side effects:** The remembered path string, or `WALLET_BACK_FALLBACK` (`/welcome`). No network.
- **Used by:** `WalletChromeLeft`.

## Function: RememberWalletReturn

- **Purpose:** Client recorder mounted in the root layout. On each pathname/search change, calls `rememberWalletReturn` with the current in-app path so `/wallet` can later link back there.
- **Inputs:** `usePathname` and `useSearchParams`. Non-empty query is appended as `?…`.
- **Returns / side effects:** `null`. Calls `rememberWalletReturn` during render and again from an effect, so the path is stored before Wallet reads it.
- **Used by:** `RootLayout` (inside `ThemeProvider`, wrapped in `Suspense`).

## Function: WalletChromeLeft

- **Purpose:** Client `/wallet` chrome that renders `ProfileChromeLeft`. The server render links back to `/welcome`. Before paint, back uses the path this tab remembered. Forum fallback uses `profile.back`; any other path uses `nav.back`. Wordmark stays `/welcome`.
- **Inputs:** `walletBackHref()` from the shared tab slot, read in `useLayoutEffect`; catalog via `ProfileChromeLeft`.
- **Returns / side effects:** `ProfileChromeLeft`. A plain click is `history.back()`, or `/welcome` when the tab has no previous page. Modified clicks follow the remembered href. The card's Back replaces this one while Wallet is shown.
- **Used by:** `WalletPage`.

## Function: MessagesChromeLeft

- **Purpose:** Client `/messages` chrome that reads `?c=` and renders `ProfileChromeLeft`. List (missing or empty `c`): default forum back. Non-empty `c`: `backHref="/messages"` and `backLabelKey="inbox.back"`.
- **Inputs:** `useSearchParams`.
- **Returns / side effects:** `ProfileChromeLeft`. No network.
- **Used by:** `MessagesPage`.

## Function: ProfileScreen

- **Purpose:** Signed-in profile: single `max-w-sm` identity card with a compact Given/Received activity chart, About me (`AboutMeSection` owner: empty prompt + **Write your About me**, or filled text and/or photo + edit; Languages **Translate** on the filled read-only text when `aboutMessageId` is set; the editor is not translatable; copy-profile-link on the card — never a forum post), name, location, then the same public facts as `/members/:id` (`MemberProfileScreen` `factsOnly`: role pill, funding-program icon (pressing it reveals that one sentence; on this screen the pressed result is `funding-program-open`), `username@21.gifts`, pay QR, Shop sticker, Posts/Reactions counts, and the activity feed), then Wallet of Satoshi address forms, then `FundingStatusCard` (verification / 21 gifts grant), then `PushToggle` (Notifications pills: All/Active/Mentions always; This device On/Off when Push APIs are ready), a language settings row (`LanguagePreferenceSwitcher`) after push and before theme, a theme settings row (`ThemeSwitcher`), a fiat settings row (`FiatPreferenceSwitcher`), and a number-format settings row (`NumberFormatSwitcher`) last. Never shows `forum.loading` on the card. Menu icon+amount totals stay in `SignedInChrome`. Back + wordmark live in `ProfileChromeLeft`.
- **Inputs:** `useAccountTotals` for both `receiveOverTime` and `donateOverTime`; pass both to `AccountActivityChart`; `AboutMeSection` (`putAboutMe` text plus optional photo, `fetchAboutMePhoto` when `aboutMeHasPhoto`, `name={account.name}`); `NameForm`, `LocationForm`, and `LightningAddressForm` for edits; `fetchMember(session, account.id)` then `MemberProfileScreen` with `factsOnly` for the public gifts facts; `FundingStatusCard`; `PushToggle`; `LanguagePreferenceSwitcher`; `ThemeSwitcher`; `FiatPreferenceSwitcher`; `NumberFormatSwitcher`; catalog via `useTranslations`.
- **Returns / side effects:** Heading **Profile**, compact chart (empty: `profile.chartEmpty` with no chart FiatPicker, no SVG / no ₿|fiat scale; populated: legend + ₿ | selected fiat + SVG). The only FiatPicker on the card is `FiatPreferenceSwitcher`. About me, name form, location form, then the public member facts (role pill, funding-program icon (pressing it reveals that one sentence; on this screen the pressed result is `funding-program-open`), `username@21.gifts`, QR, Shop sticker, post/reaction counts, and the on-demand feed), then the Wallet of Satoshi address form, then `FundingStatusCard`, then `PushToggle` (Notifications pills), Language (English / Deutsch / Español / Filipino), Theme (System / Light / Dark), Fiat currency (CHF|EUR|USD|PHP), and Number format (`10'000.23` / `10,000.23` / `23.000,33`) as the last settings row — all inside one identity card (no second panel). A failed `fetchMember` shows `forum.error` and **Try again** and leaves the editors up. `MissingRequirementsError` replaces to `/setup/rules`. No Message button and no staff actions. Back + wordmark live in `ProfileChromeLeft`.
- **Used by:** `ProfilePage`.

## Function: AboutMeSection

- **Purpose:** Profile-card About me block: heading plus filled text and/or photo, or the owner empty prompt (`profile.about.empty` **Tell others who you are.** and labeled **Write your About me**). Filled means trimmed `aboutMe` is a real bio (not the display name) **or** `hasPhoto` is true. Owner mode can edit (write / pencil, save, cancel) via `onSave`, attach a JPEG/PNG/WebP with ImagePlus (`prepareForumPhoto`, no video), preview, and remove. Optional icon-only copy-profile-link (`profile.copyLink` **Copy link to this profile**) when `profileUrl` is set; the URL is never shown as visible text. Public mode with no filled text, no photo, and no copy URL renders `null`. A filled read-only body uses `TranslatableNoteBody` when `messageId` is a non-empty string; otherwise `LinkedText`. The editor is not translatable.
- **Inputs:** `aboutMe` (`string | null`), `mode` (`owner` | `public`), optional `name` (`string | null`) for the filled comparison (`(name ?? '').trim()`; blank name applies only the trimmed-non-empty check), optional `hasPhoto`, optional `loadPhoto` (`() => Promise<Blob>`), optional `profileUrl`, optional `messageId` (stored About me note id; omitted or blank keeps `LinkedText`), optional `onSave(text, photo?)` (`photo` omitted keeps, `null` clears, object sets), optional `startEditing` to open the owner editor on mount.
- **Returns / side effects:** React element or `null`. Clipboard write for copy. Calls `onSave` on owner save. Loads a blob URL when `hasPhoto` and `loadPhoto` are set; revokes it on unmount.
- **Used by:** `ProfileScreen` (owner, `name={account.name}`), `MemberProfileScreen` (public, `name={profile.name}`), `ViewProfileScreen` (public, `name={profile.name}`), `FundingApplyScreen` on `/profile/apply`.

## Function: PushToggle

- **Purpose:** Profile identity-card Notifications section: uppercase heading `profile.push.heading`, a `SegmentedControl tone="neutral"` All / Active / Mentions (`profile.push.level.all` / `active` / `mentions`, group `profile.push.level.label`) whenever a session exists (including while Push APIs are still being inspected), a muted hint (`profile.push.level.hint`), and a second On / Off `SegmentedControl` (`profile.push.on` / `off`, group `aria.push` **This device**) only when `serviceWorker` / `PushManager` are ready. No Bell / IconButton / trailing slot. Changing the level POSTs `/me/notification-level` via `postNotificationLevel` and merges `notificationLevel` into the current store account when the session still matches; a second change while the POST is in flight is ignored; failure keeps the previous value and shows `profile.push.level.error`. The device pill calls `enablePush` / `disablePush`; same-value or busy is a no-op. Renders nothing without a session. On iPhone Safari outside standalone, shows `profile.push.installHint` under the device pill.
- **Inputs:** Session and account from `useAuthStore`; catalog via `useTranslations`; `postNotificationLevel` / `accountNotificationLevel` / `setAccount`; `enablePush` / `disablePush` / `isIosSafari` / `isStandaloneDisplay`.
- **Returns / side effects:** Heading, All/Active/Mentions control (always when a session exists), muted hint, and (when Push APIs are ready) a This-device On/Off `SegmentedControl`. Level change calls `postNotificationLevel` then merges `notificationLevel`; On calls `enablePush` when not subscribed, Off calls `disablePush` when subscribed; may show `profile.push.unavailable` on push failure or `profile.push.level.error` on level failure.
- **Used by:** `ProfileScreen`.

## Function: useUnreadCount

- **Purpose:** Load signed-in unread **notification**, **inbox**, **staff-room**, and **open-proposal** counts in parallel (`GET /forum/notifications` + `GET /conversations`, plus `GET /conversations/moderator-group` and `GET /trust/proposals` when `roleAtLeast(account?.role, 'moderator')`). `refreshKey` retriggers the fetches (Menu open). Does not mark notifications or conversations read.
- **Inputs:** `refreshKey` boolean; optional `options?: { writeBadge?: boolean }` (omit the object to default). Default writes the home-screen badge. `writeBadge: false` fetches and returns the four counts but does not call `setUnreadAppBadge` (including the logout / session-null `0` write).
- **Returns / side effects:** `{ unreadCount, inboxUnreadCount, moderationUnreadCount, proposalCount }`. `unreadCount` is the notifications unread count. `inboxUnreadCount` is the number of conversation rows with `unread: true`. `proposalCount` is the open-proposal list length. `moderationUnreadCount` is staff-room unread (`0` or `1`) plus `proposalCount`, for the Menu Moderation row. Hub Open proposals uses `proposalCount` alone. When badge writes are enabled (the default), the home-screen badge is notification unread + inbox unread + staff-room unread (`0` or `1`) — open-proposal count is **not** added (proposal rows already sit in notification unread) — written once all started fetches settle. A role below moderator skips the staff-room and proposals fetches and contributes `0`. A thrown staff-room or proposals fetch contributes `0` without failing the other sides. Either of the other sides failing contributes `0` to the sum; the other sides still write. Epoch skip applies to that sum write. No session → all four counts `0`; badge `0` only when writes are enabled and `loadSession() === null` (real logout). A hydrating store (`session` null, token still in storage) does not clear the badge. A cancelled fetch updates neither React state nor the badge.
- **Used by:** `SignedInChrome` (default write), `ModerateScreen` (`writeBadge: false`).

## Function: setUnreadAppBadge

- **Purpose:** Set or clear the installed PWA home-screen unread badge via the Badging API (`navigator.setAppBadge` / `navigator.clearAppBadge`). When `count > 0` and `setAppBadge` exists, sets that number; otherwise clears when `clearAppBadge` exists. Missing APIs are a no-op. Rejections are swallowed so unsupported or denied badge writes never throw into the UI.
- **Inputs:** `count` (number) — notification unread plus inbox unread plus staff-room unread (`0` or `1`). Positive values request a badge; `0` (and any non-positive) request a clear.
- **Returns / side effects:** `void`. Fire-and-forget promises; does not await. No network.
- **Used by:** `useUnreadCount`, `NotificationsLoader`, `refreshUnreadAppBadge`, `useAuthStore.clearAuth`.

## Function: bumpUnreadAppBadgeEpoch

- **Purpose:** Increment the home-screen badge epoch so in-flight unread fetches do not overwrite a mark-all-read clear, and after inbox mark-read so they do not overwrite the remaining sum.
- **Inputs:** None.
- **Returns / side effects:** The new epoch number.
- **Used by:** `NotificationsLoader`, `InboxLoader`, `ModeratorGroupScreen`, `useAuthStore.clearAuth`.

## Function: unreadAppBadgeEpoch

- **Purpose:** Read the current home-screen badge epoch. Capture before an async unread fetch; skip `setUnreadAppBadge` if it changed.
- **Inputs:** None.
- **Returns / side effects:** Current epoch number. No network.
- **Used by:** `useUnreadCount`, `NotificationsLoader`, `refreshUnreadAppBadge`.

## Function: refreshUnreadAppBadge

- **Purpose:** Refresh the installed PWA home-screen badge to notification unread plus inbox unread plus staff-room unread (`0` or `1`). Signature `refreshUnreadAppBadge(sessionToken, inboxUnreadOverride?, moderationUnreadOverride?)`. Fetches `GET /forum/notifications` and, unless an inbox override is passed, `GET /conversations`. When the moderation override is omitted, fetch `GET /conversations/moderator-group` only when `roleAtLeast(account?.role, 'moderator')` (`unread` true → `1`, else `0`; throw/404 → `0`); a role below moderator contributes `0` without starting the request. When the moderation override is set, skip that fetch. Any side failing contributes 0. Captures the badge epoch at start; skips the write if the epoch changed or `loadSession()` is not still `sessionToken`. Never rejects.
- **Inputs:** `sessionToken` (string). Optional `inboxUnreadOverride` (number) — when set, skip the conversations fetch and use that inbox unread count (e.g. the local list after mark-read). Optional `moderationUnreadOverride` (number) — when set, skip the staff-room fetch and use that count (`0` or `1`). When the moderation override is omitted, skip the staff-room fetch unless the signed-in auth-store account is at least moderator.
- **Returns / side effects:** `Promise<void>`. Calls `setUnreadAppBadge` with the sum only when the epoch is unchanged and `loadSession() === sessionToken`. Fire-and-forget safe.
- **Used by:** `InboxLoader` after a successful thread load and mark-read (inbox override only; fetches staff-room only when the account is at least moderator). `ModeratorGroupScreen` after opening the room (moderation override `0`).

## Function: vapidPublicKeyToBytes

- **Purpose:** Decode a VAPID application server public key (url-safe base64) to bytes for `pushManager.subscribe`.
- **Inputs:** Url-safe base64 public key string.
- **Returns / side effects:** `Uint8Array`. No network.
- **Used by:** `enablePush`.

## Function: registerPushWorker

- **Purpose:** Register the push-only service worker at `/sw.js` (scope `/`) and wait until ready.
- **Inputs:** None (uses `navigator.serviceWorker`).
- **Returns / side effects:** `ServiceWorkerRegistration`.
- **Used by:** `enablePush`, `disablePush`, `resyncPushSubscription`.

## Function: push service worker

- **Purpose:** Push-only service worker at `/sw.js`. On `push`, shows a notification (`registration.showNotification`) and, when `navigator.setAppBadge` (or `registration.setAppBadge` as fallback) exists, sets the home-screen badge: floor `payload.unreadCount` first, use it when that integer is greater than 0, otherwise `1`. `setAppBadge` rejections are swallowed so `waitUntil` still follows `showNotification`. Missing `setAppBadge` still shows the notification. No cache or offline strategy.
- **Inputs:** Push `event` with optional JSON payload (`title`, `body`, `url`, `tag`, `unreadCount`).
- **Returns / side effects:** `event.waitUntil` of `showNotification` plus optional `setAppBadge` via `Promise.all`. Install skips waiting; activate claims clients; notification click focuses or opens the payload URL.
- **Used by:** Browser Web Push runtime (registered by `registerPushWorker`).

## Function: isStandaloneDisplay

- **Purpose:** Detect installed / standalone display mode (`display-mode: standalone` or iOS `navigator.standalone`).
- **Inputs:** None (reads `window` / `navigator`).
- **Returns / side effects:** `boolean`. No network.
- **Used by:** `PushToggle`, `shouldOfferIosInstall`, `PwaInstall`.

## Function: isIosSafari

- **Purpose:** Detect iPhone/iPod stock Safari (Safari in UA, not CriOS/FxiOS).
- **Inputs:** None (reads `navigator.userAgent`).
- **Returns / side effects:** `boolean`. No network.
- **Used by:** `PushToggle` only.

## Function: shouldOfferIosInstall

- **Purpose:** True when an iPhone/iPod browser whose UA contains Safari (stock Safari, Chrome CriOS, Firefox FxiOS, Edge EdgiOS) is not standalone and not an in-app browser — the condition for the iOS Home Screen install sheet.
- **Inputs:** None. Reads `navigator.userAgent` plus `isStandaloneDisplay` and `isInAppBrowser`. Does not call `isIosSafari`.
- **Returns / side effects:** `boolean`. No network.
- **Used by:** `PwaInstall`.

## Function: PwaInstall

- **Purpose:** Client install control for the PWA. First paint is `null` (no layout slot). After mount, hidden when standalone or in-app. On iPhone Home Screen browsers (Safari, Chrome, Firefox, Edge) (`shouldOfferIosInstall`) shows a labeled control that opens a three-step `role="dialog"` sheet (Share → Add to Home Screen → if Open as Web App is shown, leave it on). On Chromium, listens for `beforeinstallprompt` (`preventDefault`, store event), shows the control, and on click calls `event.prompt()` then drops the event (hides) regardless of accepted/dismissed; `appinstalled` also hides. Placements: `header` (compact secondary), `hero` (secondary md), `menu` (SignedInChrome Download + label row).
- **Inputs:** `placement` (`header` | `hero` | `menu`); optional `tone` (`app` | `dark`, default `app`); optional `onMenuAction` (menu row closes the Menu after click). Catalog via `useTranslations`.
- **Returns / side effects:** Install button and optional iOS sheet, or `null`. No new dependencies; Tailwind only.
- **Used by:** `MarketingHeader` (`tone="dark"` `placement="header"`), `Home` hero (`tone="dark"` `placement="hero"`), `SignedInChrome` Menu (`placement="menu"`).

## Function: enablePush

- **Purpose:** Register the worker, fetch the VAPID key, request notification permission, subscribe, and POST the subscription to the api. Shares a serial queue with `resyncPushSubscription` and `disablePush`; a later disable no-ops a queued enable.
- **Inputs:** `sessionToken`.
- **Returns / side effects:** `void`. Throws `Notification permission denied` or `Push is not configured` (and other api errors).
- **Used by:** `PushToggle`, `SignedInChrome`.

## Function: resyncPushSubscription

- **Purpose:** When `Notification.permission` is already `granted` and a local `pushManager` subscription exists, POST that endpoint to the api. Does not call `requestPermission` or `subscribe()`. Opt-out (no local subscription) is a no-op. POST failure leaves the local subscription in place. Shares a serial queue with `enablePush` and `disablePush`; a later disable no-ops a queued resync so it cannot POST after DELETE.
- **Inputs:** `sessionToken`.
- **Returns / side effects:** `void`. No-op when permission is not `granted`, Push APIs are missing, or `getSubscription()` is null. Throws api errors from `postPushSubscription` without unsubscribing.
- **Used by:** `SignedInChrome` (mount and Notifications click when permission is already granted).

## Function: disablePush

- **Purpose:** When a local push subscription exists, DELETE its endpoint on the api then `unsubscribe()` locally. Bumps a generation so in-flight enable/resync cannot POST after this opt-out, and waits for the shared serial queue so DELETE is the last server mutation.
- **Inputs:** `sessionToken`.
- **Returns / side effects:** `void`. No-op when there is no subscription. Local `unsubscribe()` still runs if the api DELETE fails.
- **Used by:** `PushToggle` and `LogoutButton`.

## Function: fetchVapidPublicKey

- **Purpose:** GET `/push/vapid-public` with the bearer session and return the VAPID public key string.
- **Inputs:** `sessionToken`.
- **Returns / side effects:** `string`. Throws `Push is not configured` on 503; other non-2xx throw with status.
- **Used by:** `enablePush`.

## Function: postPushSubscription

- **Purpose:** POST `/me/push-subscriptions` with bearer + `{ endpoint, keys }` and validate the response.
- **Inputs:** `sessionToken`, subscription endpoint + p256dh/auth keys.
- **Returns / side effects:** `void`. Throws `Push is not configured` on 503; 400 uses api error when present.
- **Used by:** `enablePush`, `resyncPushSubscription`.

## Function: deletePushSubscription

- **Purpose:** DELETE `/me/push-subscriptions` with bearer + `{ endpoint }`.
- **Inputs:** `sessionToken`, `endpoint`.
- **Returns / side effects:** `void`. 404 is success (already gone). Throws `Push is not configured` on 503.
- **Used by:** `disablePush`.

## Function: proxyPushVapidPublicGet

- **Purpose:** Bearer proxy GET `/push/vapid-public` to the 21.gifts api.
- **Inputs:** Incoming `Request` with Bearer session.
- **Returns / side effects:** Upstream `Response` via `proxyApiRequest`.
- **Used by:** Route GET `/push/vapid-public`.

## Function: proxyMePushSubscriptionsPost

- **Purpose:** Bearer proxy POST `/me/push-subscriptions` to the 21.gifts api.
- **Inputs:** Incoming `Request` with Bearer session and JSON body.
- **Returns / side effects:** Upstream `Response` via `proxyApiRequest`.
- **Used by:** Route POST `/me/push-subscriptions`.

## Function: proxyMePushSubscriptionsDelete

- **Purpose:** Bearer proxy DELETE `/me/push-subscriptions` to the 21.gifts api.
- **Inputs:** Incoming `Request` with Bearer session and JSON body.
- **Returns / side effects:** Upstream `Response` via `proxyApiRequest`.
- **Used by:** Route DELETE `/me/push-subscriptions`.

## Function: manifest

- **Purpose:** Next.js `MetadataRoute.Manifest` for installable 21.gifts (`/manifest.webmanifest`).
- **Inputs:** None.
- **Returns / side effects:** Manifest with name/short_name `21.gifts`, start_url `/welcome`, display `standalone`, theme/background colors, apple-touch-icon at 180×180, plus `icon-192.png` and `icon-512.png`.
- **Used by:** App Router manifest route.

## Function: AccountActivityChart

- **Purpose:** Compact dual-line cumulative SVG of Given and Received. FiatPicker **only when unsigned** (`useHydrateSession().ready && session === null`; public view). Signed-in mounts (`ProfileScreen`, `MemberProfileScreen`, signed-in `/view`) omit it. Code from `useFiatPreference`. Empty/all-zero sats: unsigned shows picker plus `profile.chartEmpty` `role="status"`; signed-in empty is `profile.chartEmpty` alone (no SVG, no ₿|{fiat} scale). Populated: unsigned shows picker, then legend + `SegmentedControl tone="gift"` options ₿ | selected FiatCode (`profile.chartScale`), then SVG; signed-in populated starts at legend + ₿|{code} scale. Scale state is `ActivityScale` `'sat' | 'fiat'`. Ticks: sat `formatBitcoin`; fiat `formatFiatTick` (USD may use `formatUsdTick`); em dash when every source cumulative for the selected non-USD code is `null`. Wrapper `role="group"` uses `profile.chartTitle` as `aria-label`. No title heading; page heading is **Profile**. Given is `donatedOverTime` from account activity (no longer a hardcoded zero series).
- **Inputs:** `received` (`AccountActivity.receivedOverTime`); optional `donated` (default `[]`) from `AccountActivity.donatedOverTime`.
- **Returns / side effects:** When unsigned, FiatPicker, then when the series is empty or all zeros: `profile.chartEmpty` (`role="status"`) — no legend, ₿|{fiat} scale, or SVG. Signed-in empty is `profile.chartEmpty` alone. Otherwise one chrome row (legend left, ₿ | selected FiatCode right) and SVG. Client state for scale; unsigned picker writes the `fiat` cookie. No network.
- **Used by:** `ProfileScreen`, `ViewProfileScreen`, `MemberProfileScreen`.

## Function: Button

- **Purpose:** Labeled app button with primary (filled), secondary (bordered), or accent fill. Optional `tone` `app` (default) or `dark` for marketing-ink shells (same class split as `ButtonLink`). Size `sm` / `md` / `lg` (`lg` is full width). All sizes `min-h-11`.
- **Inputs:** Native button props plus optional `variant` (default `primary`), optional `size` (default `md`), optional `tone` (default `app`), optional leading `icon`, and `children` label. Default `type="button"`.
- **Returns / side effects:** A `<button>` element. No network. Used across login, forum retry, public note retry, PWA install on dark shells, and forms.
- **Used by:** `PublicMessageLoader`, `LightningAddressForm`, `ForumBoard`, `PwaInstall`, setup and contact screens.

## Function: ButtonLink

- **Purpose:** Labeled pill link matching `Button` anatomy (`primary` / `secondary` / `accent`, `sm` / `md` / `lg`, `tone` `app` or `dark`).
- **Inputs:** `href`, optional `variant` / `size` / `tone` / `icon` / `className`, `children` label.
- **Returns / side effects:** A Next.js `<Link>` for path hrefs, or a native `<a>` for protocol hrefs (`https:`). No network. Used on marketing CTAs, donate **Open the forum**, 404 **Back home**, and rules nav.
- **Used by:** `Home`, `MarketingHeader`, `DonatePage`, `NotFound`, `RulesDocument`.

## Function: SegmentedControl

- **Purpose:** Mutually exclusive option group with `tone` `gift` (compact ₿|USD cells, optional `shell` `app`/`dark`) or `neutral` (full-width pills for staff inbox and profile notifications). Gift hit target is `min-h-11 min-w-11` on mobile and desktop. `shell` is ignored for `neutral`. Neutral `role="group"` is the pill; the forum composer Post/Ask `!grid grid-cols-2 !rounded-2xl` still lays out those option buttons via `className` on the group. The four forum view filters are `ForumModeSelect`, not this control. No `trailing` slot.
- **Inputs:** `value`, `options` (`value` + `label`, optional `badge` / `badgeAriaLabel`; chip omitted when `badge` is missing or ≤ 0), `onChange`, `ariaLabel`, `tone`, optional `shell` (default `app`, gift only), optional `className` (on the group).
- **Returns / side effects:** A `role="group"` track of `type="button"` options with `aria-pressed`. Neutral is that group as the pill (`className` lands there, including the composer Post/Ask `!grid grid-cols-2 !rounded-2xl`). No network.
- **Used by:** `ForumBoard` (`tone="neutral"`), `PushToggle` (`tone="neutral"`, twice: level + device), `AccountActivityChart` (`tone="gift"`), `StatsDashboard` (`tone="gift" shell="dark"`).

## Function: ForumModeSelect

- **Purpose:** Closed combobox for the living-room forum view (Active, No gifts yet, All, Most popular). The trigger shows the selected label and a chevron. A positive unpaid badge is also shown as a count chip on the closed trigger. Opening the trigger shows a listbox of option rows; the selected row has a check. Choosing a row calls onChange and closes the list. Shops does not mount it. Post/Ask stays a SegmentedControl.
- **Inputs:** `value`; `options` (`value`, `label`, optional `badge`, optional `badgeAriaLabel`); `onChange(value)`; `ariaLabel` (catalog `forum.modeLabel`).
- **Returns:** A relative wrapper with the combobox button and, only while open, the listbox.

## Function: IconButton

- **Purpose:** Icon-only control with a required `aria-label`, variant (`primary` / `secondary` / `ghost`), size (`sm` / `md` / `lg`), and optional `tone` `app` (default) or `dark` for marketing-ink shells (ghost+dark is paper hover and `focus-visible:outline-paper`). `sm` is 24px paint with a 44px `::before` hit slop; `md` is 44px; `lg` is 48px.
- **Inputs:** Native button props; `aria-label` is required for accessible naming. Default `variant="secondary"`, `size="md"`, `tone="app"`, `type="button"`.
- **Returns / side effects:** A `<button>` wrapping the icon child. No network. Used for attach/post/pay/copy/dismiss controls on the forum board and the handbook copy-link on marketing ink.
- **Used by:** `ForumBoard`, `LightningAddressForm`, `InboxScreen`, `HandbookImageViewer`, `HandbookLightbox`, `ContactScreen`, `NameForm`, `RulesSetup`, `HandbookCopyLink`.

## Function: Card

- **Purpose:** Primary app content panel using semantic card tokens (`bg-app-card`, border, shadow) with optional max-width (`sm` / `md` / `xl`). `surface` default `true` draws that nested visual panel. `surface={false}` is a width + flex + gap column for page body inside the AppShell frame (no radius, border, bg, shadow, or `p-8`). Card never hosts page chrome.
- **Inputs:** `children`, optional `className`, optional `maxWidth` (default `sm`), optional `surface` (default `true`; `false` omits panel classes).
- **Returns / side effects:** A `<section>` wrapper. No network. Nested panel for public notes and overlays; page-body columns (`LoginCard`, profile, welcome, inbox) use `surface={false}`.
- **Used by:** `PublicMessageLoader`, `LoginCard`, profile and setup screens.

## Function: AmountEntry

- **Purpose:** Every typed amount. Gift `SegmentedControl` (₿ and the member's fiat code) plus the other unit under the field. Bitcoin shows the preferred fiat. Fiat shows `formatBitcoin`. The input box, its placeholder, and where the digits start do not change when the unit changes. A numeric placeholder is not rewritten. The switch and the counter do change. A signed-in toggle POSTs `/me/amount-unit` and writes `account.amountUnit`. No session keeps the choice on the control and starts at ₿. A locked invoice shows the sat amount and disables the switch. `layout="composer"` (inbox) puts the switch beside the input. `layout="inline"` (forum reply) puts the amount before the switch on one line. Both keep the label for assistive tech only and put the counter under the input.
- **Inputs:** `label`, `value`, `onValueChange`, `rateDay`, optional `id`, `disabled`, `placeholder`, `className`, `lockedSats`, `onUnitChange`, `layout` (`field` default, `composer`, or `inline`).
- **Returns / side effects:** A labeled input, the switch, and a counter line when an amount is defined. Signed-in toggle calls `setAmountUnit`. No other network.
- **Used by:** `ForumAskWizard`, `ForumBoard` pay sheet and reply, `InboxScreen`, `PayLinkScreen`, `PosScreen`.

## Function: Field

- **Purpose:** Labeled text input or textarea using shared app field tokens; id is generated from the label when omitted.
- **Inputs:** `label`, optional `id` / `className`, `multiline` (textarea when true), plus native input or textarea attributes.
- **Returns / side effects:** A `<label>` wrapping an `<input>` or `<textarea>`. No network.
- **Used by:** Labeled text primitive. Amount fields use `AmountEntry` instead.

## Function: APP_HEIGHT_BOOTSTRAP_SCRIPT

- **Purpose:** Blocking bootstrap IIFE string injected as a raw head script before paint. Sets `--app-height` to `max(visualViewport.height + offsetTop, innerHeight)` (fallback `innerHeight`) so first paint matches the layout canvas. It does not follow `visualViewport.height` alone. Scale guard: skips the write when `visualViewport.scale` is present and not ≈ 1, keeping the last unzoomed height (or the CSS `100dvh` fallback).
- **Inputs:** None (constant string).
- **Returns / side effects:** Non-empty IIFE source mentioning `visualViewport`, `Math.max`, and `--app-height`.
- **Used by:** `RootLayout` `<head>` script.

## Function: AppHeightViewport

- **Purpose:** Minimal visual-viewport fields (`height`, optional `offsetTop`, optional `scale`) used to resolve `--app-height` without depending on the DOM `VisualViewport` type in tests.
- **Inputs:** `height` in CSS pixels; optional `offsetTop` (keyboard scroll); optional `scale` (omit when unknown — do not pass `undefined`).
- **Returns / side effects:** A structural type only — no runtime value. Callers pass `{ height }` or `{ height, offsetTop, scale }` into `resolveAppHeight`.
- **Used by:** `resolveAppHeight`; `useAppHeight` (live `window.visualViewport`).

## Function: resolveAppHeight

- **Purpose:** Chooses the pixel value for `--app-height`. The result is `max(innerHeight, visualViewport.height + offsetTop)` so a stuck-short visual viewport cannot leave a white gap under the rounded page frame, including while the software keyboard is open. It does not shrink to `visualViewport.height` alone when a text field is focused. Pinch-zoom skip: returns `null` (caller must not write) when `scale` is present and not ≈ 1 (`|scale - 1| > 0.01`). Null/undefined visualViewport falls back to `innerHeight`.
- **Inputs:** `innerHeight` (`window.innerHeight`); `visualViewport` (`window.visualViewport` or a stub; null/undefined allowed; `offsetTop` optional, treated as 0).
- **Returns / side effects:** Rounded CSS-pixel height, or `null` to skip the write. No DOM writes of its own.
- **Used by:** `useAppHeight` (`AppHeightSync`); bootstrap IIFE inlines the same max path.

## Function: useAppHeight

- **Purpose:** After hydration, keeps the CSS custom property `--app-height` in sync so `AppShell` fill/flow layouts track the layout canvas. Uses `max(innerHeight, visualViewport.height + offsetTop)` via `resolveAppHeight`. Does not shrink to `visualViewport.height` alone when a text field is focused. Scale guard: does not update `--app-height` when `visualViewport.scale` is present and not ≈ 1, so pinch/auto-zoom keeps the last unzoomed height.
- **Inputs:** None (reads `window.visualViewport` / `innerHeight` inside a `useEffect`).
- **Returns / side effects:** `void`. Sets `--app-height` on `document.documentElement` and registers window resize/orientationchange, document focusin/focusout, and visualViewport resize/scroll listeners; cleans them up on unmount.
- **Used by:**
  - **`AppHeightSync`** (same file; root layout mount)
  - **Every hydrated app page** (via that mount)
  - **Fill/flow `AppShell` layouts** that consume `--app-height`

## Function: AppHeightSync

- **Purpose:** Client-only root mount that calls `useAppHeight` so `--app-height` stays live after the blocking bootstrap script runs in `<head>`.
- **Inputs:** None.
- **Returns / side effects:** Renders `null`; side effect is the hook. Mounted as the first child of `<body>` in `RootLayout`.
- **Used by:**
  - **`RootLayout`** (`src/app/layout.tsx`)
  - **All app and marketing routes** under that layout
  - **`useAppHeight` consumers** that rely on a single shared mount

## Function: AppShell

- **Purpose:** App page shell driven by `--app-height`. Always draws one `rounded-3xl` page frame. `fill` and `flow` share that geometry: locked height, frame `grow shrink basis-0 self-stretch` (not `flex-1`), frame-header chrome row, inner `overflow-y-auto` scroller, footer host. Prefer this over Tailwind viewport-height utilities on app routes. Chrome (wordmark + Menu / language) is the frame’s first row (`[data-app-chrome]`). `<main>` has no `overflow-hidden`, so the in-tree Menu panel is not clipped. Card never hosts page chrome. Never `justify-center` on `<main>` or the overflow scroller. The center wrapper sets `justify-content: center` and then `safe center`, so content that fits stays centered, and where `safe` is supported a thread taller than the frame starts at the top and remains scrollable.
- **Inputs:** `children`, required `mode` (`fill` | `flow`; both values render the same frame), optional `topLeft` / `topRight`, optional `className`, optional `align` (`start` | `center`).
- **Returns / side effects:** A `<main>` layout with a rounded page frame, chrome row, header/footer portals, and inner scroller. `useAppShellScroller` reads that scroller from context. No network.
- **Used by:**
  - **Fill and flow app routes** (`LoginPage`, `DonatePage`, setup, contact, inbox, notifications, public note, `ProfilePage`, `WalletPage`, `ShopsPage`, `ViewProfilePage`, `MemberProfilePage`)
  - **`PageChrome`** (still `mode="flow"`; AppShell draws the unified frame — welcome and public rules)
  - **`AppShellHeader` / `AppShellFooter` / `AppShellTopLeft`** slot registrars
  - **`useAppShellScroller`** (`ForumBoard` pull-to-refresh, `ForumLoader` atTop / scroll-to-top, `InboxScreen` open-thread pin to bottom / one-shot list reset to top)

## Function: useAppShellScroller

- **Purpose:** Returns the AppShell inner `overflow-y-auto` scroller element, or `null` outside AppShell.
- **Inputs:** None (reads AppShell context).
- **Returns / side effects:** `HTMLElement | null`. No network.
- **Used by:** `ForumBoard` (pull-to-refresh pageScrollTop), `ForumLoader` (atTop / scroll-to-top), `InboxScreen` (open-thread pin to bottom / one-shot list reset to top), AppShell unit tests.

## Function: AppShellHeader

- **Purpose:** Registers flex-none header content into the nearest `AppShell` page frame (DOM portal into the shell `<header>` host). Without an `AppShell` ancestor, renders children inline.
- **Inputs:** `children` (typically an onboarding `h1`).
- **Returns / side effects:** Portal into the shell header host when present; otherwise the children. Layout only.
- **Used by:**
  - **`NameSetup`**
  - **`AddressSetup`**
  - **`RulesSetup`**

## Function: AppShellFooter

- **Purpose:** Registers flex-none footer content (CTAs) into the nearest `AppShell` page frame (DOM portal into the shell `<footer>` host; `pb-8` on that host). Without an `AppShell` ancestor, renders children inline.
- **Inputs:** `children` (typically Continue / Skip / Agree buttons).
- **Returns / side effects:** Portal into the shell footer host when present; otherwise the children. Layout only.
- **Used by:**
  - **`NameForm`** (onboarding)
  - **`LightningAddressForm`** (onboarding)
  - **`RulesSetup`**

## Function: AppShellTopLeft

- **Purpose:** Registers top-left chrome into the nearest `AppShell` via DOM portal; child registration wins over the page `topLeft` prop. The host is the frame chrome row (`[data-app-chrome]`), not a Card. Without an `AppShell` ancestor, renders children inline.
- **Inputs:** `children` (back control + wordmark, etc.).
- **Returns / side effects:** Portal into the shell top-left host when present; otherwise the children. Layout only.
- **Used by:**
  - **`RulesSetup`** (chapter back + wordmark)
  - **`WalletScreenView`** (Wallet Back and wordmark; wins over the page `topLeft`)
  - **`AppShell` unit tests** (child portal wins over the page `topLeft` prop)

## Function: PageChrome

- **Purpose:** Wrapper around `AppShell` (still `mode="flow"`) with optional top-left (wordmark) and top-right (menu / language) slots. Chrome is the page-frame header, not page-absolute. Prefer `AppShell` directly on app routes.
- **Inputs:** `children`, optional `topLeft`, optional `topRight`, optional `className` on the outer `<main>`.
- **Returns / side effects:** Layout only (`AppShell mode="flow"`; AppShell draws the unified frame). No network.
- **Used by:** Flow app routes (`WelcomePage`, `RulesPage`) plus unit tests and the `ui` barrel. Fill routes use `AppShell` directly.

## Function: Wordmark

- **Purpose:** Text brand mark `21.gifts` (header 17px/700, footer 15px/700). Link when `href` is set; otherwise a `<span>` (marketing footer).
- **Inputs:** optional `href`, optional `tone` (`app` / `dark`), optional `size` (`header` / `footer`, default `header`), optional `className`, optional `onClick` forwarded to the link only.
- **Returns / side effects:** A Next.js `<Link>` or `<span>`. No network.
- **Used by:** `HomeWordmark`, `ForumHomeWordmark`, `MarketingFooter`, `ProfileChromeLeft`, `RulesSetup`, setup name/address pages, unsigned `PublicMessageChrome` / `RulesPageChrome`, and `AppShell` top-left.

## Function: ForumHomeWordmark

- **Purpose:** Welcome-page wordmark: linked `21.gifts` to `/welcome` that `preventDefault`s and dispatches `FORUM_HOME_EVENT` so `ForumLoader` can scroll to top and apply new notes without a full reload.
- **Inputs:** None. Uses `Wordmark` and `FORUM_HOME_EVENT`.
- **Returns / side effects:** A client wordmark link. Dispatch only; no fetch of its own.
- **Used by:** `WelcomePage`.

## Function: HomeWordmark

- **Purpose:** Session-aware header wordmark: linked `21.gifts` to `/welcome` when `useHydrateSession` is ready and `useAuthStore` has a session, otherwise `/`. Real navigation (no `preventDefault`, unlike `ForumHomeWordmark`).
- **Inputs:** Optional `tone`, `size`, `className`, `onClick` forwarded to `Wordmark` when set. Uses `useHydrateSession` and `useAuthStore`.
- **Returns / side effects:** A client `Wordmark` link. Hydrates the session; no other network of its own.
- **Used by:** `MarketingHeader`, `LoginPage`, `DonatePage`, `ViewProfilePage`.

## Function: PublicMessageChrome

- **Purpose:** Client chrome wrapper for public `/messages/[id]`: when a session is hydrated (`ready && session !== null`), mounts signed-in shell (`ProfileChromeLeft` + `SignedInChrome`); otherwise keeps unsigned chrome (`Wordmark` → `/`, light `LanguageSwitcher`).
- **Inputs:** `children` (thread body from `PublicMessagePage` — `PublicMessageLoader`). Uses `useHydrateSession` and `useAuthStore` for `session`.
- **Returns / side effects:** Fill `AppShell` (`align="center"`) with the matching top-left / top-right slots around `children`. No network beyond session hydration.
- **Used by:** `PublicMessagePage`.

## Function: PublicMessagePage

- **Purpose:** Next.js page for `/messages/[id]` — public HTML note by UUID. Unsigned visitors see a read-only thread. Signed-in React on the root note, copy, reply, and Gift on a payable nested reply run through `PublicMessageLoader` → `PublicMessageThread`. No `OnboardingGate`, top-level composer, or envelope. Wrapped in `PublicMessageChrome` (signed-in or unsigned chrome depending on hydrated session).
- **Inputs:** Dynamic route params (`id`).
- **Returns / side effects:** `PublicMessageLoader` inside `PublicMessageChrome` (chrome is no longer always unsigned Wordmark + LanguageSwitcher). Also exports `generateMetadata` for per-note Open Graph / Twitter tags.
- **Used by:** Route `/messages/[id]`.

## Function: generateMetadata

- **Purpose:** Next.js App Router metadata for `/messages/[id]`. Loads the public note via `loadPublicMessageForOg` and maps it through `publicMessageOgMetadata` so crawlers see the author, text, and photo without running JS. Missing or failed fetches inherit the root layout preview.
- **Inputs:** `{ params: Promise<{ id: string }> }` from the dynamic route.
- **Returns / side effects:** `Promise<Metadata>` — per-note Open Graph / Twitter tags when the note is found, or `{}` so the site-wide layout preview is inherited. Does not render the visible page.
- **Used by:** Route `/messages/[id]` (`PublicMessagePage`).

## Function: loadPublicMessageForOg

- **Purpose:** Server fetch of api `GET /messages/:id` for Open Graph. Invalid UUIDs skip the network. Timeouts, non-OK responses, JSON/schema failures, and thrown errors (`getApiUrl`, network, abort) all return `null` and never throw.
- **Inputs:** `id` string from the route (forum message UUID).
- **Returns / side effects:** `ForumMessage` or `null`. Uses `cache: 'no-store'`, `Accept: application/json`, and `AbortSignal.timeout(2500)`.
- **Used by:** `generateMetadata` on `/messages/[id]`.

## Function: publicMessageOgMetadata

- **Purpose:** Maps a loaded public note (or `null`) to Next.js `Metadata`. Found notes use the author name as title and never the marketing layout description, even when `text` is empty. Photo notes set `og:image` to `/messages/{id}/photo`; others keep `/og.png`. A note with any `via` value (written without a 21.gifts account) gets fully generic metadata instead: title `External author on 21.gifts`, description `A reply from someone outside 21.gifts who sent bitcoin to a post.`, and always the default `/og.png` image — nothing from the note's `name`, `text` or photo reaches a link preview. Both strings are plain English constants, not from the catalog.
- **Inputs:** Route `id` and `note` (`ForumMessage | null`).
- **Returns / side effects:** `{}` when `note` is `null`. For a note with a `via` value the generic External title, description and default image described above. Otherwise title, description (trimmed text or `` `${name} on 21.gifts` ``, truncated above 300 code units with `…`), Open Graph (`type: website`, `url` `https://21.gifts/l/` plus the first 8 hex of a UUID id (otherwise `https://21.gifts/messages/{id}`), `siteName` 21.gifts), and Twitter `summary_large_image`.
- **Used by:** `generateMetadata` on `/messages/[id]`.

## Function: PublicMessageLoader

- **Purpose:** Client loader for the public thread page: validates UUID, waits for hydrate `ready`, then fetches. Staff (`roleAtLeast(account.role, 'moderator')` + session) use `fetchForumMessage(session, routeId)` and `fetchReplies(session, root.id)` so a soft-hidden row can load; others use `fetchPublicMessage(routeId)` / `fetchPublicReplies`. If `parentId` is set, fetches that parent (`null` → missing) then replies of the parent. Ready only with root + replies (empty replies → parent only). Replies throw → error + **Try again** (whole chain). Until hydrate `ready`, only `forum.loading` (no fetch, no cards). After ready, when the loaded root or the highlighted reply has `deletedAt` / `deletedBy`, a `role="status"` `forum.hiddenNotice` line sits above the thread (permalink target). Unsigned visitors (no session or no account) keep the `PublicThreadCard` stack (no pay/copy): vertical stack parent `Card` then reply Cards with `pl-4`. Gift-only replies (empty text, sats > 0): sats line via `formatBitcoin` plus optional preferred-fiat `·` `formatFiatDisplay` of the amount stored when the payment was made (a stored string as-is, `null` or a missing field on a passed `stored` object is Bitcoin only), no empty `<p>`. When the route id is a reply, that unsigned reply card (or wrapper) has `data-permalink-target="true"` and `ring-1 ring-app-fg`. Photo/video per unsigned card via `fetchPublicMessagePhoto`. Unsigned gallery is `ForumPhotoGallery` (earlier stills 88% peek, last still full width, `current/total` chip, dots); `data-photo-index` keeps the original still index when an earlier extra still fails to load. **Translate** (Languages icon) under unsigned note and reply bodies via `NoteTranslate` when the language differs from the UI locale. A `via === 'nostr'` reply or note shows a non-interactive **External** `<span>` badge next to the name (no hint state on this card) and renders its body as plain text (`TranslatableNoteBody` `plain`) instead of `ForumQuotedBody`. Each unsigned card is ₿ plus optional preferred-fiat `·` `formatFiatDisplay` of the amount stored when the payment was made (`useFiatPreference`; cookie, otherwise locale default); otherwise ₿-only, no ` · —`. `fetchGiftStats` / `latestRateDay` feed the pay sheet and an unpaid invoice preview. A posted goal bar does not use that rate. A top-level unsigned note with a positive `goalSats` also shows `ForumGoalBar`. When `ready && session && account` and the root is loaded, mounts `PublicMessageThread` instead of the unsigned cards, passing `seedReply` as the highlighted hidden reply (omit the prop when none). Auth CTA once below either stack from `useHydrateSession` (**Log in** or **Back to the forum**).
- **Inputs:** `id` string from the route. Also reads `session` and `account` from the auth store and hydrate `ready`.
- **Returns / side effects:** States loading / missing / error (with **Try again**) / ready unsigned stack or signed-in `PublicMessageThread`. Malformed UUID → missing without an api call. Photo blob URLs revoked on unmount or id change. Inline `<video>` keeps the clip aspect ratio (`max-h-80 max-w-full`, no full-width black canvas). A failed `<video>` `error` event hides the player and falls back to the photo when present. `NoteTranslate` on unsigned note and reply bodies (GET `/translate` on mount, POST on **Translate**). Unsigned stack has no pay, composer, copy, or FiatPicker. Hydrate-not-ready is only `forum.loading` (no unsigned cards). A hydrate drop after a note is loaded keeps the cards and shows `forum.loading` in the footer.
- **Used by:** `PublicMessagePage`.

## Function: PublicMessageThread

- **Purpose:** Signed-in permalink thread: one root on `ForumBoard` with `composerHidden` and `truncate={false}` so the original body stays full, auto-expand via `fetchReplies`, and the same React, copy, reply, overlay, photo, and poll behavior as `/welcome`. React (`forum.react`, lucide Reply) on the root note; on every nested reply Gift when payable, copy (`forum.copyReplyLink`, the reply's own origin `/l/<8 hex>`, first group of that reply id) always, and trash for staff. Staff `onDeleted` on the root calls `onRootDeleted` (loader → missing); a nested reply is dropped from the list. Passes `permalinkTargetId` so only a matching nested reply is ringed. Owns `payHost` and passes it to ForumBoard: a compose-fee reply invoices 1 sat to 21.gifts on the composer slot (`payHost: composer`, `payMessageId` = compose-target note); extra gifts and Gift-open stay on the card (`payHost: card`).
- **Inputs:** `{ root, highlightId, seedReply?, onRootDeleted }` as in `src/components/PublicMessageThread.tsx`: `root` is `ForumMessage`, `highlightId` is `string | null` (route id when it is a reply UUID), `seedReply` is the opened hidden reply when the route id is a hidden child, `onRootDeleted` is `() => void`. Session and account from the auth store.
- **Returns / side effects:** React tree. Auto-expands the root so **Write a reaction** is available. After Bearer `fetchReplies` of the root, merge `seedReply` into the list when it is missing so the signed-in board still shows the hidden permalink target. Passes `permalinkTargetId={highlightId}`. No top-level composer or feed filters. Owns `payHost` and passes it to ForumBoard: a compose-fee reply invoices 1 sat to 21.gifts on the composer slot (`payHost: composer`, `payMessageId` = compose-target note); extra gifts and Gift-open stay on the card (`payHost: card`).

- **Used by:** `PublicMessageLoader`.

## Function: ViewProfilePage

- **Purpose:** Next.js page for `/view/[viewKey]` — public read-only profile by view key. No `OnboardingGate`, no `SignedInChrome`.
- **Inputs:** Dynamic route params (`viewKey`).
- **Returns / side effects:** Exports `metadata.referrer = 'no-referrer'`. `AppShell` with `HomeWordmark` top-left (`/` unsigned, `/welcome` when a session is hydrated) and light `LanguageSwitcher` top-right; body is `ViewProfileLoader`.
- **Used by:** Route `/view/[viewKey]`.

## Function: ViewProfileLoader

- **Purpose:** Client loader for the public view page: validates the key, fetches the public profile, then `fetchViewActivity` even if the Lightning Address is blank. Does not use `useAuthStore`.
- **Inputs:** `viewKey` string from the route.
- **Returns / side effects:** States loading / missing / error (with **Try again**) / ready card. In **ready**, renders `ViewProfileScreen` plus `ViewProfileClaim` under the card (passes `viewKey` and `hasPasskey` from the fetched profile). Malformed keys (not 64 lowercase hex) → missing without an api call. After `fetchViewProfile`, always calls `fetchViewActivity` (even when address is blank) and maps both series onto the card. Activity failure still shows the card with empty series. Chart never swapped for `forum.loading`.
- **Used by:** `ViewProfilePage`.

## Function: ViewProfileScreen

- **Purpose:** Presentational read-only identity card matching signed-in profile chrome: heading Profile, `AccountActivityChart`, About me inside the card (not a forum post; public `AboutMeSection` with `name={profile.name}` shows filled text and/or photo, or omits the heading when neither; Languages **Translate** when `aboutMessageId` is set), name, location, and public `username@21.gifts` rows (labels `name.heading` / `location.heading` / `profile.giftsHeading`) without edit or Message actions. Unset location shows `location.unset`. Missing username shows `view.noGiftsAddress`. Copy-profile-link on the card (`profile.copyLink`). When a username is set, a centered `QrCode` (label `profile.giftsQr`) under the address encodes `openCryptoPayQrValue` (`https://<domain>/pl/?lightning=` plus the uppercase LNURL of `https://<domain>/.well-known/lnurlp/<local>`), including on a smartphone. A missing username shows no QR.
- **Inputs:** `{ profile, viewKey, received, donated }` — `received` is `AccountActivity['receivedOverTime']`; optional `donated` is `AccountActivity['donatedOverTime']`. `viewKey` builds the copy URL `/view/<viewKey>`. `profile` includes `aboutMe`, `aboutMeHasPhoto`, and `location`. Public `AboutMeSection` `hasPhoto` from `aboutMeHasPhoto` with `loadPhoto` (`fetchViewAboutMePhoto`).
- **Returns / side effects:** No menu, logout, back, edit forms, or Message. Copy-profile-link on the card; URL/key never shown as visible text. Language switcher lives on the page, not in this card.
- **Used by:** `ViewProfileLoader`.

## Function: ViewProfileClaim

- **Purpose:** Public passkey claim control under the `/view/[viewKey]` card. Unclaimed invites (`hasPasskey` false) bind a passkey to the existing profile (name + Wallet of Satoshi already set), including when another 21.gifts session is already signed in.
- **Inputs:** `viewKey` (64 lowercase hex) and `hasPasskey` from the public profile. Uses `usePasskeyLogin`, `useAuthStore`, `useRouter`, `isInAppBrowser`, and `InAppBrowserView`.
- **Returns / side effects:** Waits for `useHydrateSession` `ready`. Claimed (`hasPasskey` true) → `null` (even in Telegram, even if signed in). In-app on mount or `unsupported` → same card chrome as login wrapping `InAppBrowserView` (no yellow **Activate**). Else in a real browser: yellow banner with `view.activationRequired` and **Activate** (`view.activate`) even when `account !== null`; click sets a claim-attempted flag, `cancel` + `clearAuth` when a session exists, then `register(viewKey)` (stays on the view page). Success → `router.replace(nextOnboardingPath(account))` only when that claim was attempted (pre-existing sessions do not redirect on mount). 409 → `view.alreadyClaimed` plus Fingerprint that calls `authenticate()`; after that attempt the yellow **Activate** banner does not return (successful login hides the control; a dismissed prompt keeps the already-claimed copy). Other errors / starting stay visible even with a session → `view.claimError` + **Try again** (`view.retry`) or spinner.
- **Used by:** `ViewProfileLoader` (ready state only).

## Function: fetchViewProfile

- **Purpose:** Fetches a public read-only profile by view key via the same-origin proxy.
- **Inputs:** `viewKey` string.
- **Returns / side effects:** Validated `ViewProfile`, or `null` on 404. Throws on other non-2xx or a body that fails `viewProfileSchema`. Hits `/view-key/${encodeURIComponent(viewKey)}`.
- **Used by:** `ViewProfileLoader`.

## Function: proxyViewGet

- **Purpose:** Same-origin proxy of api `GET /view/:viewKey` (public; no auth).
- **Inputs:** Incoming `Request` and `viewKey` path segment.
- **Returns / side effects:** Proxied upstream `Response` for `/view/${encodeURIComponent(viewKey)}`.
- **Used by:** App Router `GET` on `/view-key/[viewKey]`.

## Function: alignActivitySeries

- **Purpose:** Align receive and donate cumulative account-activity series onto one sorted UTC-day axis for the profile chart.
- **Inputs:** `received` (`AccountActivity.receivedOverTime`) and `donated` (`AccountActivity.donatedOverTime`).
- **Returns / side effects:** `ActivityPoint[]`. Empty+empty → `[]`. Empty donated → zero Given on each received day. Non-empty both → day union with step-hold carry-forward. Also aligns CHF/EUR/PHP cumulatives (`null` string → `0`); missing series side stays at the carried value (0 until first point).
- **Used by:** `AccountActivityChart`.

## Function: activityValue

- **Purpose:** Read one cumulative chart value from an aligned activity point.
- **Inputs:** `point`, `series` (`donated` | `received`), `scale` (`sat` | `fiat`); when `'fiat'`, `fiat` (`FiatCode`) selects `cumulative*Usd|*Chf|*Eur|*Php`. `'sat'` ignores `fiat`.
- **Returns / side effects:** Number used to place the polyline.
- **Used by:** `AccountActivityChart`, `activityMaxY`.

## Function: activityMaxY

- **Purpose:** Y-axis max for the dual-line chart: max of both series at the active scale, or `1` when empty/all zeros.
- **Inputs:** `points`, `scale` (`sat` | `fiat`), optional `fiat` (`FiatCode`) — same as `activityValue`.
- **Returns / side effects:** Positive number for SVG scale.
- **Used by:** `AccountActivityChart`.

## Function: useAccountTotals

- **Purpose:** Session-based GET `/me/activity` via `fetchAccountActivity`; returns given/received sats plus `donateOverTime` and `receiveOverTime`. Fetches even with a blank Lightning Address and does not call `fetchGiftStats`.
- **Inputs:** Reads `session` and `account.lightningAddress` from `useAuthStore`; calls `fetchAccountActivity` whenever a session exists.
- **Returns / side effects:** `{ donatedSats, receivedSats, donateOverTime, receiveOverTime, loading }`. On each fetch start (including session or Lightning Address change) totals and series reset to zeros/empty; `AccountActivityChart` then shows `profile.chartEmpty` (no SVG) when the series is empty. Drops stale responses when the session or address changes mid-flight; errors resolve to zeros and an empty series.
- **Used by:** `SignedInChrome`, `ProfileScreen`.

## Function: WelcomePage

- **Purpose:** Next.js page for `/welcome`.
- **Inputs:** None.
- **Returns / side effects:** Flow `PageChrome` (`AppShell` wrapper) with `ForumHomeWordmark` top-left, `SignedInChrome` top-right, and `OnboardingGate` around `WelcomeScreen`.
- **Used by:** Route `/welcome`.

## Function: WelcomeScreen

- **Purpose:** Fourth post-login screen after name, address, and living-room rules agreement are saved. Embeds `ForumLoader` (forum list + composer) below the heading. Page column is `max-w-xl` (`Card surface={false}`) so the AppShell frame is the only page-level `rounded-3xl`.
- **Inputs:** Reads `account.name` from `useAuthStore`.
- **Returns / side effects:** Gift icon with an integrated Bitcoin symbol, **Welcome, {name}**, forum board. No name or address form. No donate CTA. No `LogoutButton` in the page column.
- **Used by:** Screen `/welcome`.

## Function: forumTextPreview

- **Purpose:** Collapse a public forum note or reply body to a 280-character UTF-16 `.length` preview (`FORUM_TEXT_PREVIEW_LIMIT`) for the feed/profile timeline analog. Word/line boundary cut when the last space or newline in the slice sits at index `>= floor(limit * 0.8)`; trailing spaces/tabs trimmed; no ellipsis in the helper. If the hard cut splits an http(s) URL (no whitespace across the boundary), that incomplete trailing URL is dropped from the preview so `LinkedText` cannot autolink a shorter href.
- **Inputs:** `text` — full body; optional `limit` (default 280).
- **Returns / side effects:** `{ preview, truncated }`. Does not append `…`. No network.
- **Used by:** `ForumNoteText`.

## Function: ForumNoteText

- **Purpose:** Client paragraph for remaining note/reply text on the feed and profile (via `ForumQuotedBody` / `QuotedForumNote` when `truncate` is true) and for translated bodies. Empty text returns null. Bodies autolink http(s) URLs via `LinkedText`. Optional `plain` forwards plain rendering to `LinkedText` on both the full and truncated (**Show more**) path. Bodies longer than 280 characters render a collapsed preview, `…`, and inline **Show more** (`forum.showMore`, app inline link). Expand in place; no Show less. Click and keydown `stopPropagation` so the parent card `role="button"` does not toggle replies. On `/messages/[id]`, the original body is `LinkedText` (`ForumQuotedBody` with `truncate={false}`); translations still render through this component.
- **Inputs:** `ForumNoteTextProps` — `text`, `className`, optional `plain`.
- **Returns / side effects:** `LinkedText` (`<p>` plus optional overlay), or `null` when `text === ''`. Local React expand state only.
- **Used by:** `ForumQuotedBody` / `QuotedForumNote` (remaining text and nested quoted note bodies when `truncate` is true) and `TranslatableNoteBody` (translated body).

## Function: readJpegTakenAt

- **Purpose:** Read a JPEG APP1 Exif capture time before the canvas re-encode strips it. Does not read GPS.
- **Inputs:** JPEG file bytes.
- **Returns / side effects:** `YYYY-MM-DDTHH:MM:SS` plus the matching offset when the file has one, or null. Prefers DateTimeOriginal, then DateTimeDigitized, then IFD0 DateTime. No I/O.
- **Used by:** `prepareForumPhoto`.

## Function: ForumPhotoGallery

- **Purpose:** Horizontal snap gallery for a note with `photoCount > 1`. Earlier stills are 88% slides (`min-w-[88%] shrink-0 snap-start`, `gap-3`) so the next photo peeks; the last still is `w-full min-w-full` so it can sit flush at snap-start. A `current/total` chip (`forum.galleryPosition`) sits on the visible still. Dots under the scroller (`gap-5`, `IconButton` `sm` ghost, `forum.galleryDot`) jump to a still. Empty `photos` returns `null`. Single still has the chip and no dots. The capture time is stored, not shown.
- **Inputs:** `photos` (`{ index, url }[]`), `alt`, optional `className` (ForumBoard passes `mt-2`), optional `onPhotoClick` (ForumBoard `stopCardToggle`).
- **Returns / side effects:** React element. Local scroll index only. No network. Blob `<img>` URLs from the parent.
- **Used by:** `ForumBoard`, `PublicThreadCard` in `PublicMessageLoader`.

## Function: ForumAskWizard

Four-step Ask composer on `/welcome`: amount (step 1 starts with the One-time / Daily pill), photos, text, then a preview card that shows the same pill and `ForumGoalBar` at 0 collected versus the ask. The heading and **{step} of 4** share one row (step on the right). The labeled **Post** on step 4 is the only Ask submit.

- **Purpose:** Walk **Ask for money** so Continue on the amount step still requires a local 1..10_000_000-sat parse. The amount step and the preview each start with a One-time / Daily `SegmentedControl` (`tone="neutral"`, two columns, `rounded-2xl`). The photo and text steps do not show it. Default is once. One-time / Daily is not posted. The post itself sends `goalCurrency` and `goalAmount`. A fiat-draft preview shows the typed amount plus local Bitcoin and no third currency; a Bitcoin-draft preview shows Bitcoin plus the last gift-day rate.
- **Inputs:** `step` / `onStepChange`, `askDraft` / `onAskDraftChange`, `draft` / `onDraftChange`, `posting`, `photoDrafts`, `videoDraft`, `onPickFiles`, `onRemovePhoto`, `onClearPhoto`, `authorName`, `onPost`, optional `rateDay` (Bitcoin-draft preview counterpart of the typed ask), optional `composerMaxLength` (default 500), optional `askCadence` (`'once'` | `'daily'`, default once) and `onAskCadenceChange`.
- **Returns / side effects:** React tree. The One-time / Daily pill is on step 1 and step 4. Continue on step 1 stays disabled until the parsed sats are 1..10_000_000. Continue on step 2 goes to step 3 with photos optional. Step 4 **Post** stays disabled without text, photo, or video, then calls `onPost`. No network.
- **Used by:** `ForumBoard` when `composeIntent` is `ask`.

## Function: parseForumAskAmount

- **Purpose:** Parse the Ask amount draft into a whole-sat goal.
- **Inputs:** `raw` string.
- **Returns / side effects:** Integer 1..10_000_000, or `null` when empty, non-digits, 0, or above the max.
- **Used by:** `ForumAskWizard`, `ForumLoader`.

## Function: ForumGoalBar

SVG progress bar for a top-level forum note. One SVG: orange fill in user units 0–100; overflow past 100% continues in green (`app-success`) from `x=100` at most another 100 units (visual max 200%). The `{percent}%` label is a sibling, so it stays readable, and is uncapped (110, 250, …). Above the track, the posted line is the Ask label, then defined fiat only when `goalCurrency` is USD/CHF/EUR/PHP, then `formatBitcoin(goalSats)`, then the frozen viewer snapshot only when that currency differs and the string is present, joined with `·`. Legacy (`goalSats`, no `goalCurrency`) is Bitcoin only, no live rate. A BTC definition is Bitcoin plus the snapshot when the string is there. Renders nothing when `goalSats` is missing or `<= 0`. Lengths use SVG `width` / `x` / `viewBox` attributes, not React `style`.

- **Purpose:** Show collected-versus-goal progress on a top-level note that has a positive `goalSats`. BTC and legacy use `forumGoalPercent(sats, goalSats)`; a fiat Ask uses `forumFiatGoalPercent` of the payment snapshot (`null` collected is 0%, not sats). Orange through 100%, green overflow, uncapped label. `rateDay` is only for the Bitcoin preview.
- **Inputs:** `sats` (collected), `goalSats` (whole-sat counterpart), optional `goalCurrency` / `goalAmount` / goal snapshots / payment snapshots, optional `rateDay` (Bitcoin-preview counterpart only). Non-positive or non-finite `goalSats` yields `null`.
- **Returns / side effects:** The bar element with `forum.askAmountLabel` and the posted line above, or `null`. Uses `forum.goalPercent` and `forum.goalBarAria`. No network.
- **Used by:** `ForumBoard` (top-level notes only), `PublicMessageLoader`, and `ForumAskWizard` (preview at 0 collected).

## Function: forumGoalPercent

Integer percent for a forum goal label. Uncapped (110, 250, …). Uses `Math.floor((sats * 100) / goalSats)` when `goalSats` is a positive finite number. Returns 0 when the goal is missing, not finite, or `<= 0`. Negative or non-finite collected sats count as 0 so the label never goes negative. Unchanged sats path for BTC and legacy; fiat Asks use `forumFiatGoalPercent`.

- **Purpose:** Compute the uncapped whole-percent label for `ForumGoalBar` on BTC and legacy Asks. Fiat Asks use `forumFiatGoalPercent`.
- **Inputs:** `sats` (collected) and `goalSats` (whole-sat goal).
- **Returns / side effects:** Floored percent number. No I/O.
- **Used by:** `ForumGoalBar`.

## Function: forumFiatGoalPercent

Integer percent of a fiat Ask from decimal strings. Uncapped. Scales collected and goalAmount to 8 decimal places with BigInt and floors the quotient. Does not use sats and does not use the goal snapshots.

- **Purpose:** Percent label for a fiat-defined Ask in the definition currency.
- **Inputs:** `collected` (payment snapshot `amountUsd` / `amountChf` / `amountEur` / `amountPhp`, two-decimal string or null) and `goalAmount` (defined amount string).
- **Returns / side effects:** Floored percent. Null, missing, or non-two-decimal collected is 0. Unusable or zero goal is 0. No I/O.
- **Used by:** `ForumGoalBar`.

## Function: formatDefinedGoalAmount

Defined Ask amount for the goal line. Prefix `$` for USD, otherwise `CODE `. At most two fraction digits pad to two (`200` → `PHP 200.00`). More than two keep every digit (`10.125` → `PHP 10.125`). One comma is the decimal mark. Grouping uses the visitor number format. Not the two-decimal snapshot formatter.

- **Purpose:** Show `goalAmount` exactly, not the two-decimal snapshot of the same currency.
- **Inputs:** `amount` string, fiat `code`, number-format `style`.
- **Returns / side effects:** Prefixed string, or `''` when the amount cannot be shown. No I/O.
- **Used by:** `ForumGoalBar`.

## Function: revealReplyForm

- **Purpose:** Keeps a forum reply form fully inside the AppShell scroller. When the form's bottom edge is below the scroller, adds that overflow plus 12px to `scrollTop`. A missing scroller or form, and a form that already fits, leave the scroll position unchanged.
- **Inputs:** The shell scroller (`HTMLElement` or null) and the reply `<form>` (or null).
- **Returns / side effects:** Void. Mutates `scrollTop` only when the form hangs past the scroller. No network.
- **Used by:** `ForumBoard` after an expanded reply composer is laid out.

## Function: ForumBoard

- **Purpose:** Presentational public forum: each post card body without the action row is the expand/collapse control (`forum.expand` / `forum.collapse`, `role="button"` wrapping header, media, and body text, not an `IconButton`; the footer ₿ amount button and the reply-count button (when shown) also call `onToggleExpand`; React on every top-level note (`forum.react`, lucide Reply; expands the reply composer; omitted when `deletedAt` is set), **Translate** (Languages icon, `controlSlotId` on `TranslatableNoteBody` in this row), a copy-link `IconButton` on every note and every reply, optional Gift on a payable reply, and optional delete sit outside that control as sibling `IconButton`s that `stopPropagation`; Gift/Delete/reply composer also omit when `deletedAt` is set). Optional dismissible living-room laws hint box (X control; two laws plus links to `/rules` and `/contact`) when `lawsVisible`, Active/No gifts yet/All/Most popular `ForumModeSelect` (closed dropdown; selected label and chevron on the trigger; unpaid count chip on the closed trigger when `unpaidNewCount` > 0 and unpaid is not selected), list of posts (name, optional Founder / Moderator / Initiator / Verified role pill on notes **and replies** when `role` is one of those four (`basis` has no pill), top-level shop notes show a `#Shop` link to `/shops` and hide `#21GiftsShop`, timestamp, optional inline photo from blob URLs (single still when `photoCount` ≤ 1; horizontal snap gallery (`ForumPhotoGallery`) when `photoCount > 1` — earlier stills 88% so the next still peeks, last still full width, `current/total` chip, dots of loaded blob URLs keyed `${id}:${index}`) then caption text below the photo, a link to `/map?pin=<id>` (the label, or coordinates when the label is null) on a top-level note that has a place, optional inline `<video>` playback for notes with video (player keeps the clip aspect ratio with `max-h-80 max-w-full`, no full-width black canvas), remaining body text through `ForumQuotedBody` / `ForumNoteText` (280-character preview plus `forum.showMore` on the feed; signed-in `/messages/[id]` passes `truncate={false}` so the original stays full), **Translate** (Languages icon) / Show original / Show translation in the footer icon row via `TranslatableNoteBody` (`controlSlotId`), which portals `NoteTranslate` with `placement="row"` when the board has that row, a reply or note with `via === 'nostr'` (a Nostr zapper with no 21.gifts account) renders an **External** button in place of a role pill, sharing the same per-message hint toggle state as the role pill's hint, and renders its body via `TranslatableNoteBody` `plain` (no quoted-note unfurl, URLs stay visible text) instead of `ForumQuotedBody`, ₿ amount plus optional preferred-fiat `·` `formatFiatDisplay` of the amount stored when the payment was made (a stored string as-is; `null` or a missing field on a passed payment is ₿-only with no em dash and no live rate) with a Gift pay icon only when the card is a payable reply (`parentId` set); the card's copy control is labelled `forum.copyReplyLink` when the card is a reply and `forum.copyLink` otherwise, and always copies the card's own origin `/l/<8 hex>` (first UUID group) when that id is a UUID, otherwise origin `/messages/<id>`) or empty/loading/error, messenger-style composer (**Send a post** / **Ask for money** pill; Post is **Add a photo or video** ImagePlus, then **Add a place** (MapPin, `PlaceField`) when `onPlaceDraftChange` is set, left of the textarea, **Post** Send icon to the right; Ask is `ForumAskWizard` (the amount step and the preview open with the One-time / Daily pill; the photo and text steps do not); when `allowAsk` is false the Post/Ask pill and wizard are omitted and only the post composer shows), optional photo draft preview (**Selected photo**) when `photoDrafts.length === 1` with **Remove photo** X, composer gallery when `photoDrafts.length > 1` (`ul` of **Selected photo** alts + per-index **Remove photo**), optional video draft preview with **Remove video** X — icon-only, catalog `aria-label`s, `maxLength` from optional `composerMaxLength` (default 8000)), in-card reply composer (amount row first: `AmountEntry` `layout="inline"` `id="forum-reply-amount"` with the bitcoin/fiat switch on that same line, then one text line and Post aligned beside it), and a pay sheet on a payable reply or, when `payHost` is `composer`, on the top-level composer: amount form with a live equivalent in the preferred fiat only when the conversion is non-null (no picker; after mint the equivalent uses the invoice amount, not an empty draft's 21-sat default), then every user-agent amount CTA is **Continue** (`forum.payContinue`) and only requests the invoice; after mint every user-agent shows the same invoice card (confirm sentence, wallet `Button` that sets `window.location.href` to the Android Intent or `walletofsatoshi:`); the card mounts `QrCode` only when the user-agent is not a smartphone (`isSmartphoneUserAgent`, not viewport); wallet `Button` uses `forum.payOpenWallet` / aria `forum.payOpenWalletAria` (no custom-scheme `<a>`); top-left back control cancels. Gift-only replies show **send ₿…** (`forum.giftReply`) plus the same optional preferred-fiat `·` as notes; a reply with text and sats shows both. Clicking a role pill toggles a short explanation under that card header (one open at a time). Selector stays visible in every board state unless `modeSelector` is false or `composerHidden` is true. When `modeSelector` is false the list is every loaded row (mode all), including zero-sat basis notes; an empty loaded list still uses `emptyKey`, not `forum.emptyPaid`. Uses optional `emptyKey` (`forum.empty` default, `shops.empty` on shops) when the loaded list is empty, `forum.emptyPaid` when Active or Most popular hide every loaded row (Most popular remains paid-only; Active also keeps unpaid moderator notes and top-level notes with `goalSats` > 0), and `forum.emptyUnpaid` for No gifts yet when that filter hides all loaded rows. Props `messages` are newest-first (API window); Active, No gifts yet, and All keep that order (newest at the top). Most popular stays sats-descending. The composer sits under the mode selector / filters, above the newest-first list; replies remain oldest-first. When `onRefresh` is passed, pull-to-refresh from the top of the AppShell inner scroller (`useAppShellScroller`) calls it; while `refreshing` (or a pull that reached the arm threshold) a visually hidden (`sr-only`) `role="status"` with `forum.refreshing` is mounted for assistive tech only — idle markup has no status node so welcome screenshots stay unchanged. When `newPostsAvailable` is true, a labeled primary `Button` (`forum.newPosts`, decorative lucide `ArrowUp`) is `sticky top-2` in the scroller; the node is omitted when the flag is false. When `moderatorAppointedAvailable` is true, a labeled primary `Button` (`forum.moderatorAppointed`, size `sm` with `shadow-lg`, decorative lucide `ArrowUp`) in the same visual language as New posts is `sticky top-2` when it is the only pill and calls `onShowModeratorAppointed`; the node is omitted when the flag is falsy. When both this and `newPostsAvailable` are true, the appointment pill stays `sticky top-2` and New posts is `sticky top-14`. Listens for `FORUM_COMPOSE_EVENT` / `requestForumCompose`: focuses and `scrollIntoView`s the new-post textarea and consumes pending compose only when that textarea exists (`composerHidden` boards keep the flag). `/messages/<uuid>` and `http(s)://<host>/l/<8 hex>` HTTP(S) URLs in a body unfurl into a nested post and the URL is removed from the visible text once that note loads.
- **Inputs:** `ForumBoardProps` — `messages`, `error` (boolean load-failure flag), `loading`, optional `refreshing` / `onRefresh` (omit `onRefresh` to disable pull-to-refresh), optional `newPostsAvailable` / `onShowNewPosts` (pill omitted when the flag is falsy), optional `moderatorAppointedAvailable` / `onShowModeratorAppointed` (pill omitted when the flag is falsy), `posting`, `draft`, `onDraftChange`, `askDraft` / `onAskDraftChange`, optional `allowAsk` (default true; false omits the Post/Ask pill and the wizard) / optional `composeIntent` / `onComposeIntentChange` / `askStep` / `onAskStepChange` / `askCadence` (`'once'` | `'daily'`, default once) / `onAskCadenceChange` / `authorName`, `onPost`, `onRetry`, `formError` (`empty` / `tooLong` / `ask` / `request` / `rateLimit` / `unsupported` / `tooLarge` / `tooMany`; `ForumFormError = 'empty' | 'tooLong' | 'ask' | 'request' | 'rateLimit' | 'unsupported' | 'tooLarge' | 'tooMany' | null`), controlled `mode` / `onModeChange`, optional `modeSelector` (default true), optional `nearEndRef` (callback ref on the visible note about eight rows from the end so `ForumLoader` can prefetch the next page), optional `unpaidNewCount` (default 0), required `lawsVisible` / `onDismissLaws`, `photoDrafts` (`ForumPhotoPayload[]`), `placeDraft` (`ForumPlacePin | null`), optional `onPlaceDraftChange` (omit it and the place control is absent, so replies have none), `videoDraft`, `onPickFiles(files: File[])`, `onRemovePhoto(index: number)`, `onClearPhoto`, `photoUrls`, `videoUrls`, optional `composerHidden` (hides the new-post composer; the textarea is absent so compose-pending is not consumed), optional `composerMaxLength` (default `FORUM_MESSAGE_MAX_LENGTH`; shops pass 7986 so the `#21GiftsShop` suffix fits), optional `emptyKey` (`forum.empty` default, `shops.empty` on shops), plus pay sheet props (`payMessageId`, optional `payHost` (`composer` keeps the sheet on the top-level composer; `card` binds to the matching parent or reply; omit/`null` infers from the list), `payDraft`, `payBusy`, `payError` (`amount` / `request` / `rateLimit` / `authorWallet`), `payInvoice`, `payWaiting`, optional `rateDay` (`FiatRateDay | null`; omit/`null` leaves unsent previews ₿-only; a stored string stays visible), `onPayOpen`, `onPayDraftChange`, `onPaySubmit`, `onPayCancel`), expand/replies (`expandedId`, `onToggleExpand`, `replies`, `repliesLoading`, `repliesError`, `onRetryReplies`, reply composer with optional `replyAmountDraft` / `onReplyAmountDraftChange`, `replyFormError` including `amount` for a non-numeric or overflowing paid-reply sats field), and optional `onDeleted` (moderator `DeletePostControl` on the parent footer and on nested replies with `kind="reply"`), optional `permalinkTargetId` (nested reply ring only: `data-permalink-target="true"` and `ring-1 ring-app-fg`; parent notes are not ringed), and optional `truncate` (default true; `PublicMessageThread` passes false). Gift-only replies (`text === ''` and `sats > 0`) render `forum.giftReply` with `formatBitcoin` plus the same optional preferred-fiat `·` `formatFiatDisplay` suffix as notes (₿-only when the stored field is null or missing, no em dash and no live rate); text plus a gift shows that formatted amount under the text. The video-draft X still calls `onClearPhoto`; each photo-draft X calls `onRemovePhoto(index)`.
- **Returns / side effects:** React tree. Copy-link always copies origin `/l/<8 hex>` (first UUID group) when the id is a UUID, otherwise origin `/messages/{id}` — a note copies its own id, a reply copies its own id (no parent resolution). Filters via `visibleForumMessages`. Load error copy is `forum.error` via `t()`, never `Error.message`. Formats timestamps via `formatForumTime`. Hides empty text paragraphs; never points `<img src>` at `/messages/.../photo` without a blob URL. Inline feed `<video>` keeps the clip aspect ratio (`max-h-80 max-w-full`, no full-width black canvas). A failed `<video>` `error` event hides that player (photo fallback when a blob URL exists). Clicking a role pill toggles a short explanation under that card header (one open at a time). Dismiss control calls `onDismissLaws` only; persistence is owned by `ForumLoader`. ForumBoard itself does not fetch; nested `NoteTranslate` GETs `/translate` on mount and POSTs on **Translate**. No mode state of its own. After `onPaySubmit` resolves to an invoice, ForumBoard does not `window.location.assign`; every user-agent shows the same invoice card; the wallet `Button` sets `window.location.href` to the Android Intent or `walletofsatoshi:`; `QrCode` is mounted only when the user-agent is not a smartphone. A `FORUM_COMPOSE_EVENT` focuses the new-post composer when it is mounted; a `composerHidden` board leaves pending compose set for a later visible board.
- **Used by:** `ForumLoader`, `MemberProfileScreen`, `PublicMessageThread`.

## Function: ContactLoader

- **Purpose:** Client loader for in-app contact on `/contact`. Session from `useAuthStore`; returns null without a session. Posts via `postContact`. On success fetches conversations and navigates to `/messages` or `/messages?c=` for the official 21.gifts thread. No local success-hide of the form. Uses `nextContactRequirement` so missing name/rules open `RequirementsOverlay` (no Skip); Lightning Address is not required for contact.
- **Inputs:** None (reads session from the auth store).
- **Returns / side effects:** React element wrapping `ContactScreen`, or `null`. Owns draft/posting/formError. Empty or whitespace drafts set `empty`; trimmed text longer than 8000 characters sets `tooLong` and does not call `postContact`. After a successful post, `fetchConversations` then `router.push` to the inbox and `posting` stays true until unmount. A failed post sets `request` and clears `posting` so Send can retry.
- **Used by:** Screen `/contact`.

## Function: ContactPage

- **Purpose:** Next.js page for `/contact`.
- **Inputs:** None.
- **Returns / side effects:** `AppShell` with `ProfileChromeLeft` top-left, `SignedInChrome` top-right, and `OnboardingGate` around `ContactLoader`.
- **Used by:** Route `/contact`.

## Function: ContactScreen

- **Purpose:** Presentational in-app contact: heading **Contact**, lead, link to living-room rules, and a messenger-style composer (textarea with icon-only Send `IconButton`, catalog `aria-label` `contact.send`, `maxLength` 8000). Success is owned by `ContactLoader` (navigate to the inbox thread), not a local success copy.
- **Inputs:** `ContactScreenProps` — `posting`, `draft`, `onDraftChange`, `onPost`, `formError` (`empty` / `tooLong` / `request`).
- **Returns / side effects:** React element. No network.
- **Used by:** `ContactLoader`.

## Function: MapPage

- **Purpose:** Next.js page for `/map`. Flow `AppShell` (`align="start"`) with `ProfileChromeLeft` + `SignedInChrome`, `OnboardingGate` `screen="welcome"`, and `PlacesMapScreen`. No `route.ts` beside the page.
- **Inputs:** None.
- **Returns / side effects:** The map screen.
- **Used by:** Route `/map`.

## Function: PlacesMapScreen

- **Purpose:** Presentational map card: heading **Map**, then every live forum pin from `fetchPlaces`. Without a Google key the pins are links. With a key the same pins are also markers.
- **Inputs:** Catalog via `useTranslations`. Session from `useAuthStore`. Optional `?pin=` id.
- **Returns / side effects:** `Card maxWidth="xl"` `surface={false}`. Fetches places and `/maps/key`.
- **Used by:** `MapPage`.

## Function: fetchPlaces

- **Purpose:** Load every live top-level forum pin for the signed-in session.
- **Inputs:** `sessionToken` bearer.
- **Returns / side effects:** `ForumPlaceRow[]` from `GET /forum/messages/places`. Throws the visitor-facing load error on a non-2xx status, a network failure, or a body that fails the schema.
- **Used by:** `PlacesMapScreen`.

## Function: proxyMessagesPlacesGet

- **Purpose:** Same-origin Bearer proxy of api `GET /messages/places`.
- **Inputs:** Incoming request.
- **Returns / side effects:** The upstream response. No session of its own.
- **Used by:** `GET /forum/messages/places`.

## Function: PlaceField

- **Purpose:** Optional place control on the top-level forum composer. Opens a map when `/maps/key` returns a key. Confirm stores `{ lat, lng, label }`. No key shows the unavailable sentence and does not confirm a pin.
- **Inputs:** `place`, `disabled`, `onChange`.
- **Returns / side effects:** Attach button, preview, and panel. Fetches `/maps/key` when opened.
- **Used by:** `ForumBoard` (top-level composer only).

## Function: ShopsPage

- **Purpose:** Next.js page for `/shops`. Flow `AppShell` (`align="start"`) with `ProfileChromeLeft` + `SignedInChrome`, `OnboardingGate` `screen="welcome"`, and `ShopsScreen`. No `route.ts` beside the page.
- **Inputs:** None.
- **Returns / side effects:** The shops screen.
- **Used by:** Route `/shops`.

## Function: ShopsScreen

- **Purpose:** Presentational shops card: heading **Shops**, lead `shops.lead`, then `ForumLoader` `feed="shops"`.
- **Inputs:** Catalog via `useTranslations`.
- **Returns / side effects:** `Card maxWidth="xl"` `surface={false}` wrapping the shops forum. No network of its own.
- **Used by:** `ShopsPage`.

## Function: isShopNote

- **Purpose:** True when `text` contains a `#21GiftsShop` token (case-insensitive; next character not `[A-Za-z0-9_]`).
- **Inputs:** `text: string`.
- **Returns / side effects:** boolean. No network.
- **Used by:** `ForumLoader`, `ForumBoard`, `ensureShopHashtag`.

## Function: stripShopHashtag

- **Purpose:** Remove `#21GiftsShop` tokens from display text and collapse leftover blank lines.
- **Inputs:** `text: string`.
- **Returns / side effects:** Display string (empty if only the hashtag was present). No network.
- **Used by:** `ForumBoard`.

## Function: ensureShopHashtag

- **Purpose:** Append `\n\n#21GiftsShop` when missing; empty/whitespace becomes `#21GiftsShop`; already-tagged text is unchanged.
- **Inputs:** `text: string`.
- **Returns / side effects:** Text to POST when the author is unpaid-write exempt, otherwise the compose-fee invoice comment. No network.
- **Used by:** `ForumLoader` (shops compose).

## Function: RulesDocument

- **Purpose:** Presentational living-room rules body from catalog keys: lead with the **The test** callout, three rule cards (`rules.lawKicker` with `{n}`, title, body, optional test callout), welcome / allowed / better-not / forbidden lists rendered as bordered cards with lucide glyphs (`Check` `text-app-fg`, `Check` muted, `Minus`, `X` `text-app-danger`), the **Our house** closing block (`rules.houseBody` + `rules.houseClosing`), and optional CTAs to `/contact` and `/welcome`.
- **Inputs:** `messages` catalog for the request locale; optional `showNav` (default `true`); optional `chapter` (`RulesChapterId`). When `chapter` is set, only that chapter is rendered and the public nav is omitted (`showNav` ignored). When `showNav` is `false` and `chapter` is omitted, the public Contact / forum nav is omitted.
- **Returns / side effects:** React element. Server component — uses `translate`, not `useTranslations`. No network.
- **Used by:** `RulesPage`, `RulesSetupPage`.

## Function: RulesPageChrome

- **Purpose:** Client chrome wrapper for public `/rules`: when a session is hydrated (`ready && session !== null`), mounts signed-in shell (`ProfileChromeLeft` + `SignedInChrome`); otherwise keeps marketing-like unsigned chrome (`Wordmark` → `/`, `LanguageSwitcher`).
- **Inputs:** `children` (heading + `RulesDocument` from `RulesPage`). Uses `useHydrateSession` and `useAuthStore` for `session`.
- **Returns / side effects:** `PageChrome` with the matching top-left / top-right slots around `children`. No network beyond session hydration.
- **Used by:** `RulesPage`.

## Function: RulesPage

- **Purpose:** Next.js page for `/rules` with localized heading and living-room rules document, wrapped in `RulesPageChrome` (signed-in or unsigned chrome depending on hydrated session).
- **Inputs:** None. Calls `getRequestLocale()` for the page title and document catalog.
- **Returns / side effects:** Heading + `RulesDocument` inside `RulesPageChrome` (chrome is no longer always unsigned Wordmark + Language).
- **Used by:** Route `/rules`.

## Function: ForumLoader

- **Purpose:** Client loader for the public forum on `/welcome` and `/shops` with `feed="shops"` (filter `#21GiftsShop`, hide laws, append hashtag on compose, `emptyKey` `shops.empty`). Session and account from `useAuthStore`; returns null without a session. Living-room default remains Active (first paint `{ mode: 'active', limit: 20 }`, no hashtag). Shops always requests `mode: 'all'` with `hashtag: '21GiftsShop'` and does not mount the mode selector, the Post/Ask pill, or `ForumAskWizard` (`allowAsk: false`), and does not apply active/unpaid/popular. A mode switch resets the loaded pages and refetches page 1 of the new mode without blanking the current list. An `IntersectionObserver` sentinel about eight notes from the visible end prefetches the next page when `nextCursor` is present. An empty shops page shows `shops.empty` immediately. The 30-second visible-tab poll, `visibilitychange`, persisted `pageshow`, and pull-to-refresh fetch page 1 only, without a cursor; applying page 1 does not replace already-loaded older pages. Fetches via `fetchMessages`, loads photos via `fetchMessagePhoto` into blob URLs (effect keyed on `photoIdsKey` so payable-poll list refreshes do not cancel in-flight photo fetches), loads `rateDay` via the shared `useLatestRateDay()` hook on mount (failure leaves `rateDay` null), posts via `fetchComposeTarget` then `postMessageInvoice` (1 sat to 21.gifts, `payHost: composer`) for anyone below verified, otherwise `postMessage` with a `photos` array so `postMessage` dual-sends `{ photo, photos }` (non-empty `photos` wins; max 10) or `postMessageVideo` (multipart clip); composer submit is ignored while a note POST is in flight (sync `notePostInFlightRef`, not only the `posting` prop); prepares picks via `prepareForumPhoto` / `isForumVideoFile` / `prepareForumVideo`; owns `photoDrafts` (plural, not `photoDraft`), `placeDraft`, and `videoDraft` / `videoUrls`; `onPickFiles` appends stills and sets `formError` `tooMany` when the selected `File` list (not successful prepares) would exceed 10, preparing only the first `remaining` slots; video xor stills; video-only posts are allowed. Pay invoices via `postMessageInvoice` (optional `text` when the reply composer pays) and waits on `fetchPublicMessage` with `sinceSats` while the pay sheet is open (no attempt cap; aborts in-flight wait on Back / clear); after a paid reply's `sats` increase, merges that row into loaded `replies`/`messages` (no thread refetch). Owns Active/No gifts yet/All/Most popular feed mode (default Active) and the No gifts yet last-visit stamp (`21gifts.forum-unpaid-seen`): hydrates it on mount, stamps on entering unpaid and while unpaid as the list refreshes, and passes `unpaidNewCount` to `ForumBoard` (0 while unpaid is selected or messages are still null). After a successful living-room post with `created.sats === 0`, switches mode to All so the author sees the note, except a positive `goalSats` Ask stays on Active (and switches from Most popular to Active, because popular is paid-only). If All is already selected, loaded pages and `nextCursor` stay. Shops already lists with `mode: 'all'` and does not switch. The sheet clears when the pay target is no longer in the visible parent list and not in loaded `replies` (mode change, collapse, or delete), not when Active merely hides the parent note. Also polls `GET /forum/messages` until the merged list is payable (8 attempts, 2s; local extras kept until GET echoes), cancelled-flag fetch like `StatsLoader`. Silently re-fetches on `visibilitychange` (hidden→visible), on `pageshow` when `persisted` is true, on a `FORUM_LIST_POLL_MS` visible-tab interval, on `FORUM_HOME_EVENT` (wordmark / Menu Home while already on `/welcome`), and when the board pull-to-refresh calls `onRefresh` — shared load path with mount/retry; silent refresh does not flip the board to the loading copy when a list already exists, keeps the list when a silent refresh fails, and does not auto-scroll the newest note when a newer note arrives from refresh. When not at top (`shellScrollTop(scroller) < 8` is at-top; `window.scrollY` is only the no-shell fallback) and `hasUnseenForumPosts` is true, the fetch is held and `ForumBoard` shows **New posts**; at the top the list is applied. With a session, fetches `GET /forum/notifications` via existing `fetchNotifications` (cancelled-flag fetch like other ForumLoader loads) and, when an unread `moderator_appointed` row exists (`readAt === null`), drives the ForumBoard pill (`moderatorAppointedAvailable` / `onShowModeratorAppointed`); click marks that row read via `markNotificationRead` and clears the flag, staying on `/welcome` without auto-scroll; a fetch error leaves the banner hidden; a mark-read failure leaves the banner (does not crash). The payable poll updates sats/payable on already-listed ids only and does not insert unseen ids. Owns the living-room laws hint visibility from `account.forumLawsDismissed` and persists dismiss via `dismissForumLaws` (optimistic; applies the response or restores the previous flag only when the session token is unchanged and an account is still present). Owns expand/replies (`fetchReplies`, retry, moderator nested-reply hide via `onDeleted` / `deleteMessage` without removing the parent, reply composer: empty reply text and an empty amount invoices 21 sats even for verified; unpaid `postMessage` with `inReplyTo` only when there is text and the amount is empty, and only for verified; below verified invoices 1 sat to 21.gifts via the compose-target note (`payHost: composer`); expand is ignored while a reply posts). After a failed media POST following compose-pay, the pay sheet is cleared (`payWaiting` / `payInvoice` / `payMessageId` / `payHost`) so a later compose invoices 21.gifts again. Uses `nextPostRequirement` so a missing name, username, Lightning Address, or rules agreement opens `RequirementsOverlay` (no Skip) before a post or reply retries. After a successful top-level post or reply, sets `hasPosted: true` on the session account when the session token is unchanged and an account is still present (no persist-flag / Skip-forever POST).
- **Inputs:** Optional `feed` (`'living-room'` default, `'shops'`). Reads session and account from the auth store.
- **Returns / side effects:** React element wrapping `ForumBoard`, or `null`. Owns draft/`askDraft`/`composeIntent`/`askStep`/`askCadence`/`placeDraft`/photoDrafts/videoDraft/photoUrls/videoUrls/posting/formError/feedMode/loaded-pages/`nextCursor`/pay/expand/replies/`refreshing`/`rateDay` state, the No gifts yet last-visit stamp, and retry attempts. `askCadence` defaults to once and returns to once after the visitor's own compose is paid (`postAfterPay` or `switchToAll` in the pay poll) and in `applyCreatedNote`. A gift or a reply does not clear it. Empty text without photos and without a video sets `empty`; trimmed text longer than 8000 characters sets `tooLong` and does not call `postMessage` / `postMessageVideo`. Photo-only and video-only posts are allowed. Empty reply text with an empty amount invoices 21 sats (pay-sheet default) and does not set `empty`, including when the parent omits `accountId`. A non-exempt reply with text and an empty amount still invoices 1 sat instead of setting `amount`. `0` is billed as 1 sat. Non-digits and overflowing amounts still set `amount` (`forum.errorReplyPayment`). When the parent omits `accountId`, an unpaid `postMessage` is attempted only for a reply that has text and an empty amount, and a payment 403 starts a 1-sat invoice. Fetch failure sets the error flag without clearing an already-posted list; the board still shows **Try again**. A failed silent refresh with an existing list does not set the error flag. A late GET merges locally posted rows that the response does not yet contain; a POST whose id is already in the list is not prepended again. An empty or whitespace-only pay amount requests 21 sats and does not fill `payDraft`. Invoice 400 author's-wallet copy maps to `authorWallet`; other invoice failures stay `request`; rate limit stays `rateLimit`. Revokes photo and video blob URLs on unmount. May POST `/me/forum-laws-dismissed`. After a successful top-level post or reply, writes `hasPosted: true` on the session account only when the session token is unchanged and an account is still present (no persist-flag POST). Passes `lawsVisible` / `onDismissLaws`, `mode` / `onModeChange`, `nearEndRef`, `unpaidNewCount`, `refreshing` / `onRefresh`, `newPostsAvailable` / `onShowNewPosts`, `moderatorAppointedAvailable` / `onShowModeratorAppointed`, and `rateDay` to `ForumBoard`. Stamps last visit on unpaid; mode is not persisted. Does not pass `Error.message` to the board.
- **Used by:** `WelcomeScreen`, `ShopsScreen`.

## Function: hasDisplayName

- **Purpose:** True when the account has a non-null display name that is non-empty after trim.
- **Inputs:** `account`.
- **Returns / side effects:** Boolean. No side effects.
- **Used by:** `nextOnboardingPath`, `NameForm`.

## Function: hasLightningAddress

- **Purpose:** True when the account has a non-null Wallet of Satoshi address that is non-empty after trim.
- **Inputs:** `account`.
- **Returns / side effects:** Boolean. No side effects.
- **Used by:** `nextOnboardingPath`, `LightningAddressForm`.

## Function: hasAgreedToRules

- **Purpose:** True when the account has a non-null `rulesAgreedAt` timestamp (epoch ms of first living-room rules agreement).
- **Inputs:** `account`.
- **Returns / side effects:** Boolean. No side effects.
- **Used by:** UI that still checks agreement state (overlays, payable); wizard order uses `account.setup` only.

## Function: nextOnboardingPath

- **Purpose:** Picks `/setup/name`, `/setup/username`, `/setup/address`, `/setup/rules`, or `/welcome` from `account.setup`. `setup === 'wallet'` maps to name, username, lightning-address, rules, or `/welcome` from the other fields; it does not map to `/wallet`. Other values stay a 1:1 map (skips advance `setup` without clearing `missing`). Username still cannot be skipped.
- **Inputs:** `account` with required `setup` and `missing`.
- **Returns / side effects:** Path string. No side effects.
- **Used by:** `OnboardingGate`.

## Function: skipSetup

- **Purpose:** Skips the current onboarding name or Lightning Address step without filling the field.
- **Inputs:** Bearer session and `step` (`name` | `lightning-address`).
- **Returns / side effects:** Updated `Account` from `POST /me/setup/skip`; callers merge `setup` and `missing` into the auth store.
- **Used by:** `NameForm` and `LightningAddressForm` onboarding Skip buttons.

## Function: fetchMember

- **Purpose:** Loads a signed-in member profile by account id.
- **Inputs:** Bearer session and `accountId`.
- **Returns / side effects:** Validated `MemberProfile`, including `postCount` and `replyCount`, or `null` on 401/404. Throws `MissingRequirementsError` on 409. Hits `/forum/members/:id`.
- **Used by:** `MemberProfileLoader`.

## Function: fetchMemberPosts

- **Purpose:** Loads a member's top-level forum posts with `GET /forum/members/:id/posts`.
- **Inputs:** Bearer session and `accountId`.
- **Returns / side effects:** Parses `forumListSchema` and returns the messages newest-first, capped by the api at 200. A 401/404 uses the same visitor-facing message-list failure as `fetchMessages`; a 409 `missing_requirements` throws `MissingRequirementsError` as in `fetchMember` / `fetchMessages`.
- **Used by:** `MemberProfileScreen`.

## Function: fetchMemberReplies

- **Purpose:** Loads a member's forum replies with `GET /forum/members/:id/replies`.
- **Inputs:** Bearer session and `accountId`.
- **Returns / side effects:** Parses `forumListSchema` and returns the messages newest-first, capped by the api at 200; reply messages may be payable when the author has a published event and a Lightning Address, and may include `parentId`. A 401/404 uses the same visitor-facing message-list failure as `fetchMessages`; a 409 `missing_requirements` throws `MissingRequirementsError` as in `fetchMember` / `fetchMessages`.
- **Used by:** `MemberProfileScreen`.

## Function: parseMissingRequirements

- **Purpose:** Parses a 409 `{ error: 'missing_requirements', missing: [...] }` body.
- **Inputs:** Unknown JSON body.
- **Returns / side effects:** `MissingRequirementsError` or `null`.
- **Used by:** `fetchMessages`, `postMessage`, `postMessageVideo`, `postContact`, `fetchMember`, `fetchMemberPosts`, `fetchMemberReplies`.

## Function: MissingRequirementsError

- **Purpose:** Typed error for api 409 missing name/rules (or lightning-address) requirements.
- **Inputs:** `missing` array from the api body.
- **Returns / side effects:** Error instance with `missing` field; not shown as a generic toast.
- **Used by:** Forum and contact loaders (open `RequirementsOverlay`) and member fetch.

## Function: WrongAccountError

- **Purpose:** Typed error for api 403 when the visitor signed in with an account whose session is refused.
- **Inputs:** None; message is the exact api English string.
- **Returns / side effects:** Error instance named `WrongAccountError`. Callers clear the session and show `login.wrongAccount`.
- **Used by:** `fetchMe`, `finishPasskeyAuthentication`, `finishPasskeyRegistration`, `useHydrateSession`, `usePasskeyLogin`.

## Function: isWrongAccountError

- **Purpose:** Detects a wrong-account rejection (`WrongAccountError` or an `Error` whose message is exactly `WRONG_ACCOUNT_ERROR`).
- **Inputs:** `error` unknown.
- **Returns / side effects:** `true` for that instance or exact message; `false` otherwise.
- **Used by:** `useHydrateSession`, `usePasskeyLogin`.

## Function: nextPostRequirement

- **Purpose:** Picks the next field to collect before a forum post (`rules`, then `name`, then `username`, then `lightning-address`).
- **Inputs:** `missing` array from the account or a 409 body.
- **Returns / side effects:** `'rules'`, `'name'`, `'username'`, `'lightning-address'`, or `null`. No side effects.
- **Used by:** `ForumLoader`, `MemberProfileScreen`, `RequirementsOverlay` flow.

## Function: nextContactRequirement

- **Purpose:** Picks the next field to collect before a contact send (`rules` before `name` before `username`). Lightning-address gaps return `null` — contact does not require a Wallet of Satoshi address.
- **Inputs:** `missing` array from the account or a 409 body.
- **Returns / side effects:** `'rules'`, `'name'`, `'username'`, or `null`. No side effects.
- **Used by:** `ContactLoader`, `RequirementsOverlay` flow.

## Function: RequirementsOverlay

- **Purpose:** Modal to add a missing name (`NameForm` profile), username (`UsernameForm`), Wallet of Satoshi address (`LightningAddressForm` profile), or agree to rules before retrying a post. No Skip.
- **Inputs:** `requirement` (`name` | `username` | `rules` | `lightning-address`), `onDismiss`, `onSatisfied`.
- **Returns / side effects:** Dialog UI; merges account fields on success then calls `onSatisfied`. Title/`aria-label` from `requirements.nameTitle`, `requirements.usernameTitle`, `requirements.rulesTitle`, or `requirements.addressTitle`.
- **Used by:** `ForumLoader`, `ContactLoader`, `MemberProfileScreen`.

## Function: IntroduceYourselfOverlay

- **Purpose:** Modal that tells a signed-in member whose onboarding is complete (`setup === null`) and who has not posted (`hasPosted === false`) to introduce themselves in the forum. Close (X) dismisses this mount only. Primary CTA **Write an introduction** is a `Button` that dismisses, focuses the welcome composer (`requestForumCompose` / `FORUM_COMPOSE_EVENT`), and `router.push('/welcome')` only when the path is not already `/welcome`. No Skip-forever. Hidden when `hasPosted` is true or omitted (older api) and while `setup` is not null.
- **Inputs:** `onDismiss`.
- **Returns / side effects:** Dialog UI (`role="dialog"` `aria-modal="true"`, fixed inset card `z-50`). Title/`aria-label` from `introduce.title`; body `introduce.body`; CTA `introduce.cta` as catalog `Button` `type="button"` `size="lg"`; close `introduce.close`. Does not write `forumLawsDismissed` or any account field.
- **Used by:** `SignedInChrome`.

## Function: MemberProfileLoader

- **Purpose:** Client loader for `/members/[accountId]`: UUID check, `fetchMember`, then `fetchMemberActivity` even if the Lightning Address is blank. It does not prefetch post/reply feeds; `postCount` and `replyCount` arrive with the profile JSON.
- **Inputs:** Route `accountId`; session from auth store.
- **Returns / side effects:** Loading / missing (`view.missing`) / error+retry / `MemberProfileScreen`. `fetchMember` 409 `missing_requirements` → `/setup/rules`. `fetchMemberActivity` 409 `missing_requirements` → `/setup/rules`. Any other activity error keeps the card with empty given and received series.
- **Used by:** `MemberProfilePage`.

## Function: MemberProfileScreen

- **Purpose:** Signed-in member identity card (chart from given and received activity, About me inside the card not as a forum post (**Translate**, Languages icon, when `profileMessage.id` is set), name, location, public `username@21.gifts` (`profile.giftsHeading`), role pill, optional funding-program icon-only button (pressing it reveals that one sentence; that result is the separate screenshot state `funding-program-open`) when `fundingReviewedAt` is a number, copy-profile-link, and post/reaction count toggles) plus stacked `ForumBoard` activity feeds loaded on demand. Location is read-only (`location.unset` when empty). Public `AboutMeSection` (`name={profile.name}`) shows filled text and/or photo, or omits the heading when neither. A labeled Message `Button` (`profile.message`) with a decorative Mail icon sits on the card when another member has a `profileMessage` — not on a post. Staff Trust Chain actions sit behind the closed **Moderator functions** disclosure when the viewer is a moderator and the subject is someone else. Clicking a count opens its feed below the card; clicking it again collapses it. There is no separately pinned profile-note `ForumBoard`; the posts feed lists that note when present. A feed shorter than its profile count gets a muted `profile.activityLatest` truncation line. Posts show React and do not show Send Bitcoin; a payable reply card in the replies feed shows Gift. Nested Gift Continue looks up sats on the visible feed only (reactions-feed cards when activity is replies; expanded-thread replies otherwise). Collapsing or switching Posts/Reactions cancels a Gift whose target is in the expanded thread or the reactions feed; a parent composer invoice stays. Expanding a reply with `parentId` navigates to `/messages/{parentId}`. Verified members may `POST /messages` unpaid only when there is text and the amount is empty; empty text and an empty amount invoices 21 sats even for verified; everyone else invoices ≥ 1 sat with optional text; typed `0` is always billed as 1 sat even for exempt. When a note omits `accountId`, a text reply with an empty amount tries unpaid `POST /messages`; a payment 403 starts a 1-sat compose invoice to 21.gifts on the composer slot (`payHost: composer`, `payMessageId` = compose-target note). Extra gifts and Gift-open stay on the card (`payHost: card`). Loads visible inline photos for posts and replies feeds via `fetchMessagePhoto` blob URLs, same as the home forum top-level cards, retrying a transient fetch once, leaving the row text-only after a second failure, and revoking object URLs on unmount. Blob URLs may also be fetched for expanded thread replies, but ForumBoard does not paint photos on nested replies. Loads `GET /gifts/stats` into `rateDay` via `latestRateDay` (failure leaves `null`) and passes it to every `ForumBoard` so unsent previews can use the latest rate; feed ₿ amounts show optional preferred-fiat `·` from the amount stored when the payment was made (a stored string as-is, `null` or a missing field on a passed `stored` object is Bitcoin only) (no FiatPicker on the chart or the feed; member profiles are always signed-in). Uses `nextPostRequirement` so a missing name, username, Wallet of Satoshi address, or rules agreement opens `RequirementsOverlay` (no Skip) before a reply retries. When a username is set, a centered `QrCode` (label `profile.giftsQr`) under the address encodes `openCryptoPayQrValue` (`https://<domain>/pl/?lightning=` plus the uppercase LNURL of `https://<domain>/.well-known/lnurlp/<local>`), including on a smartphone. A missing username shows no QR. When a username is set, a labeled **Shop sticker** `Button` under the QR opens `ShopStickerOverlay` with the same `openCryptoPayQrValue` and the public handle, including on a smartphone; Close and Escape unmount it.
- **Inputs:** `MemberProfile` (includes `aboutMe`, `aboutMeHasPhoto`, and `location`) plus received and donated series; optional `factsOnly` (default false); session/account from the auth store. Public `AboutMeSection` `hasPhoto` from `aboutMeHasPhoto` / `profileMessage.hasPhoto` with `loadPhoto` (`fetchMessagePhoto`).
- **Returns / side effects:** React tree with About me, copy-profile-link, optional Message, staff Trust Chain actions, and a read-only location row on the card; lazily fetches the selected member posts or replies; fetches `GET /gifts/stats` into `rateDay`; fetches photos for displayed `hasPhoto` cards into blob URLs via `fetchMessagePhoto` and revokes them on unmount; may `POST` invoice/conversation/replies and navigate to `/messages?c=` or a reply's `/messages/{parentId}`. `factsOnly` returns only the role pill, the funding-program icon, the gifts address, QR, Shop sticker, count buttons, the activity feed, and `RequirementsOverlay` — no heading, chart, About me, name, location, Message, or staff block. `ProfileScreen` uses that mode so the owner sees the same public facts.
- **Used by:** `MemberProfileLoader`, `ProfileScreen` (`factsOnly`).

## Function: MemberProfilePage

- **Purpose:** Route `/members/[accountId]` with profile onboarding gate and signed-in chrome.
- **Inputs:** Dynamic `accountId`.
- **Returns / side effects:** `AppShell` with `ProfileChromeLeft` top-left, `SignedInChrome` top-right, and `OnboardingGate` around `MemberProfileLoader`.
- **Used by:** App Router.

## Function: proxyMeSetupSkipPost

- **Purpose:** Proxies `POST /me/setup/skip` to the api.
- **Inputs:** App Router request (Bearer + `{ step }`).
- **Returns / side effects:** Upstream response.
- **Used by:** `/me/setup/skip` route.

## Function: proxyMembersGet

- **Purpose:** Proxies `GET /members/:accountId` to the api.
- **Inputs:** App Router request and `accountId`.
- **Returns / side effects:** Upstream response via `/members/${encodeURIComponent(accountId)}`.
- **Used by:** `/forum/members/[accountId]` route.

## Function: proxyMembersPostsGet

- **Purpose:** Proxies `GET /members/:accountId/posts` to the api.
- **Inputs:** App Router request and `accountId`.
- **Returns / side effects:** Upstream response via `/members/${encodeURIComponent(accountId)}/posts`.
- **Used by:** `/forum/members/[accountId]/posts` route.

## Function: proxyMembersRepliesGet

- **Purpose:** Proxies `GET /members/:accountId/replies` to the api.
- **Inputs:** App Router request and `accountId`.
- **Returns / side effects:** Upstream response via `/members/${encodeURIComponent(accountId)}/replies`.
- **Used by:** `/forum/members/[accountId]/replies` route.

## Function: useHydrateSession

- **Purpose:** Rehydrates a persisted session token into the auth store.
- **Inputs:** Reads `loadSession` and calls `fetchMe`.
- **Returns / side effects:** `{ ready }`. Sets or clears auth. `WrongAccountError` from `fetchMe` calls `clearAuth` and `setWrongAccount(true)` then `ready` so the stale token is not left. Generic `/me` failures log and do not set the flag. `ready` is false until storage/`/me` has settled so setup screens do not bounce to `/login`. Unmount invalidates in-flight work.
- **Used by:** `OnboardingGate`.

## Function: QrCode

- **Purpose:** SVG QR for a string (LNURL or bolt11). Optional `logo` centers that image at 48px and sets error correction `H`; profile cards pass `profileQrLogo`, the inlined apple-touch icon.
- **Inputs:** `value` (required) and `label` (required accessible name, already translated). Optional `logo`.
- **Returns / side effects:** React element.
- **Used by:** `ForumBoard` only when the UA is not a smartphone. `InboxScreen`, `PayLinkScreen`, `PosScreen`, `MemberProfileScreen`, and `ViewProfileScreen` also on a smartphone when the value exists.

## Function: RootLayout

- **Purpose:** Root HTML shell: negotiated `lang` (`en`/`de`/`es`/`fil`), global CSS, English metadata (title, icons, Open Graph, Twitter), blocking `APP_HEIGHT_BOOTSTRAP_SCRIPT` then `THEME_BOOTSTRAP_SCRIPT` in `<head>`, `suppressHydrationWarning` on `<html>`, token body classes (`bg-app-bg text-app-fg`), `AppHeightSync`, `LocaleProvider` with the request catalog, `NumberFormatProvider` with `initial` from `getRequestNumberFormat()`, `FiatPreferenceProvider` with `initial` from `getRequestFiat()`, and `ThemeProvider`. `AccountPreferenceSync` is inside `FiatPreferenceProvider` beside `RememberWalletReturn`. Nest is Locale → NumberFormat → FiatPreference → Theme.
- **Inputs:** `children` React nodes. Calls `getRequestLocale()` for `html lang` and messages, `getRequestNumberFormat()` for the number-format provider, and `getRequestFiat(locale)` for the fiat provider.
- **Returns / side effects:** The document wrapper for every route.
- **Used by:** All screens.

## Function: clearSession

- **Purpose:** Removes the bearer token from `localStorage`.
- **Inputs:** None.
- **Returns / side effects:** void. No-op during SSR (`window` undefined).
- **Used by:** `useAuthStore.clearAuth`.

## Function: fetchTrustChain

- **Purpose:** GET `/trust/graph` (same-origin proxy of api `GET /trust-chain`) with Bearer and parse the Trust Chain graph. Optional `around` loads one hop (`?around=`).
- **Inputs:** Bearer `sessionToken`, optional `around` account id.
- **Returns / side effects:** `TrustChain`. Throws visitor copy when the api is down, the body is invalid, or the response is 401/403.
- **Used by:** `TrustChainLoader`.

## Function: postTrustVerify

- **Purpose:** POST `/trust/verify` with `{ accountId }` so a moderator verifies a basis member.
- **Inputs:** Bearer `sessionToken`, subject `accountId`.
- **Returns / side effects:** `{ id, name, role }`. Throws visitor copy on any failure.
- **Used by:** `MemberTrustActions`.

## Function: postTrustPropose

- **Purpose:** POST `/trust/propose-moderator` with `{ accountId }`.
- **Inputs:** Bearer `sessionToken`, subject `accountId`.
- **Returns / side effects:** `{ id, name, role }`. Throws visitor copy on any failure.
- **Used by:** `MemberTrustActions`.

## Function: postTrustConfirm

- **Purpose:** POST `/trust/confirm-moderator` with `{ accountId }` (caller must not be the proposer).
- **Inputs:** Bearer `sessionToken`, subject `accountId`.
- **Returns / side effects:** `{ id, name, role }`. Throws visitor copy on any failure.
- **Used by:** `MemberTrustActions`, `ProposalsScreen`.

## Function: postTrustReject

- **Purpose:** POST `/trust/reject-moderator` with `{ accountId }`.
- **Inputs:** Bearer `sessionToken`, subject `accountId`.
- **Returns / side effects:** `{ id, name, role }`. Throws visitor copy on any failure.
- **Used by:** `ProposalsScreen`.

## Function: postTrustAppoint

- **Purpose:** POST `/trust/appoint-moderator` with `{ accountId }` (founder only).
- **Inputs:** Bearer `sessionToken`, subject `accountId`.
- **Returns / side effects:** `{ id, name, role }`. Throws visitor copy on any failure.
- **Used by:** `MemberTrustActions`.

## Function: fetchTrustProposals

- **Purpose:** GET `/trust/proposals` (same-origin Bearer proxy of api `GET /trust/proposals`) and parse `moderatorProposalsResponseSchema.proposals`. Next.js forbids a `route.ts` beside `/moderate/proposals`, so the proxy lives at this path.
- **Inputs:** Bearer `sessionToken`.
- **Returns / side effects:** Open-proposal array. Throws visitor copy `Could not load moderator proposals. Please try again.` on 401/403/503, other non-2xx, network failure, or a body that fails the schema.
- **Used by:** `ProposalsScreen`, `useUnreadCount`.

## Function: postFundingApply

- **Purpose:** POST `/funding/apply` (Bearer) and parse `{ funding }` via `fundingApplyResponseSchema`. Role `basis` is 403. 400 `About me is required` / `About me photo is required` / `Location is required` are rethrown; other failures use visitor copy `Could not submit your application. Please try again.`
- **Inputs:** Bearer `sessionToken`.
- **Returns / side effects:** Updated `OwnerFunding`. Throws the 400 api string, or visitor copy on 401/403/409/503, other non-2xx, network failure, or a body that fails the schema.
- **Used by:** `FundingApplyScreen`.

## Function: fetchFundingApplications

- **Purpose:** GET `/funding/applications` (same-origin Bearer proxy of api `GET /funding/applications`) and parse `fundingApplicationsResponseSchema.applications`. Next.js forbids a `route.ts` beside `/moderate/applications`, so the proxy lives at this path.
- **Inputs:** Bearer `sessionToken`.
- **Returns / side effects:** Open-application array. Throws visitor copy `Could not load grant applications. Please try again.` on 401/403/503, other non-2xx, network failure, or a body that fails the schema.
- **Used by:** `FundingApplicationsScreen`.

## Function: fetchFundingApplication

- **Purpose:** GET `/funding/applications/:accountId` (Bearer) and parse `fundingApplicationDetailSchema`.
- **Inputs:** Bearer `sessionToken`, subject `accountId`.
- **Returns / side effects:** Account, grant, and living-room posts. Throws visitor copy `Could not load this application. Please try again.` on 401/403/404/503, other non-2xx, network failure, or a body that fails the schema.
- **Used by:** `FundingApplicationDetailScreen`.

## Function: postFundingAdmit

- **Purpose:** POST `/funding/admit` with `{ accountId }` (staff). Target pending or trial.
- **Inputs:** Bearer `sessionToken`, subject `accountId`.
- **Returns / side effects:** `FundingDecisionResult`. Throws visitor copy `Could not update this member. Please try again.` on any failure.
- **Used by:** `FundingApplicationDetailScreen`.

## Function: postFundingReject

- **Purpose:** POST `/funding/reject` with `{ accountId }` (staff). The subject may re-apply.
- **Inputs:** Bearer `sessionToken`, subject `accountId`.
- **Returns / side effects:** `FundingDecisionResult`. Throws visitor copy `Could not update this member. Please try again.` on any failure.
- **Used by:** `FundingApplicationDetailScreen`.

## Function: mergeTrustChain

- **Purpose:** Merge a newly loaded neighborhood into the already visible Trust Chain without duplicating nodes or edges.
- **Inputs:** `current` graph, `incoming` hop from `GET /trust-chain?around=`.
- **Returns / side effects:** Combined `{ nodes, edges }`. No I/O.
- **Used by:** `TrustChainLoader`.

## Function: layoutTrustChain

- **Purpose:** Positions Trust Chain nodes without a graph library. Roots sit in one row. A person with a single next person sits to their right. Several people hanging off one person stack top to bottom (`TRUST_NODE_VGAP`) by role (founder, then the moderator stack rank (initiator shares that rank), then verified; same-rank siblings keep edge order), not side by side and not as a pyramid of levels.
- **Inputs:** `TrustChain` `{ nodes, edges }`.
- **Returns / side effects:** `{ nodes, edges, width, height }` with pixel positions. Empty input is zero size.
- **Used by:** `TrustChainDiagram`.

## Function: TrustChainDiagram

- **Purpose:** SVG diagram of the laid-out Trust Chain (name, role, unlabeled arrow). One next person sits to the right; several hanging off one person stack top to bottom. Drag a person to move them. A plain click loads one hop around that person; modifier-click keeps the `/members/{id}` link.
- **Inputs:** `chain: TrustChain`, optional `expandingId`, optional `onExpand`.
- **Returns / side effects:** SVG with `data-testid="trust-node-{id}"`. Empty chain is not rendered by the parent screen.
- **Used by:** `TrustChainScreen`.

## Function: TrustChainScreen

- **Purpose:** Localized `/trust-chain` body: title, lead, loading/error/empty/diagram, and Verified / Moderator / Initiator / Founder copy. A hop-load error with nodes already on screen keeps the diagram and shows the catalog error plus **Try again** above it. App theme tokens (`app-fg` / `app-muted`), not marketing display type.
- **Inputs:** `chain`, `error`, `loading`, optional `expandingId`, `onExpand`, `onRetry`.
- **Returns / side effects:** Signed-in screen element.
- **Used by:** `TrustChainLoader`.

## Function: TrustChainLoader

- **Purpose:** Client loader for signed-in `/trust-chain`: founder seeds first, then one hop per click, merged into the visible graph. A failed hop keeps the chain. Retry with nodes already on screen re-fetches that `?around=` hop (does not re-fetch seeds); the banner stays gone only if the hop succeeds. Does not fetch when the session is null.
- **Inputs:** Session from the auth store.
- **Returns / side effects:** Loading, error+retry, empty, diagram, or diagram-plus-hop-error states, or `null` without a session.
- **Used by:** `TrustChainPage`.

## Function: TrustChainPage

- **Purpose:** Signed-in page at `/trust-chain`. Any logged-in completed account may view (not staff-only).
- **Inputs:** none.
- **Returns / side effects:** Fill `AppShell` (`align="start"`) with `ProfileChromeLeft` top-left, `SignedInChrome` top-right, and `OnboardingGate screen="welcome"` around `TrustChainLoader`. Graph HTTP is under `/trust/graph` (no `route.ts` beside this page).
- **Used by:** App Router `src/app/trust-chain/page.tsx`.

## Function: StaffFunctions

- **Purpose:** Closed disclosure for moderator and founder actions on a member card. The summary is `staff.functions`. Same `details` / `summary` as wallet **Advanced functions**. Children mount only while it is open.
- **Inputs:** `children`.
- **Returns / side effects:** `data-testid="staff-functions"`. `open` while expanded. Clicking the summary toggles. Clicks do not propagate.
- **Used by:** `MemberTrustActions`.

## Function: MemberTrustActions

- **Purpose:** Staff-only Verify / Propose / Confirm / Appoint controls on another member's identity card. The controls are children of the closed `StaffFunctions` disclosure; they are not painted until it is opened.
- **Inputs:** `profile`, optional `onUpdated`. Hidden unless the signed-in account is a moderator and not the subject.
- **Returns / side effects:** POST then re-fetch member; `data-testid="state-members-staff-verify"` when shown. The action buttons mount only after the disclosure is opened.
- **Used by:** `MemberProfileScreen`.

## Function: fetchPostStats

- **Purpose:** GET `/messages/stats` and parse the public post totals. Notes and replies are one count.
- **Inputs:** None.
- **Returns / side effects:** `PostStats`. Throws visitor copy when the api is down or the body is invalid.
- **Used by:** `StatsLoader`.

## Function: fetchGiftStats

- **Purpose:** GET `/gifts/stats` (optionally `?recipient=`) and parse the public gift totals payload.
- **Inputs:** Optional `recipient` handle; appended as a query param when non-empty after trim (URL-encoded).
- **Returns / side effects:** `GiftStats`. Throws visitor copy when the api is down or the body is invalid.
- **Used by:** `StatsLoader`, `useLatestRateDay`, `PublicMessageLoader`, `MemberProfileScreen`, `ModerateScreen`.

## Function: fetchAccountActivity

- **Purpose:** GET `/me/activity` with Bearer and parse `accountActivitySchema` (given + received, house gifts + forum zaps).
- **Inputs:** `sessionToken`.
- **Returns / side effects:** `AccountActivity`. Throws visitor copy `Could not load gift stats. Please try again.` on non-2xx, network, or schema failure.
- **Used by:** `useAccountTotals`.

## Function: fetchMemberActivity

- **Purpose:** GET `/forum/members/:id/activity` with Bearer and parse activity for a member card.
- **Inputs:** `sessionToken`, `accountId`.
- **Returns / side effects:** `AccountActivity`. 409 `missing_requirements` → `MissingRequirementsError`. Other non-2xx / schema → visitor copy.
- **Used by:** `MemberProfileLoader`.

## Function: fetchViewActivity

- **Purpose:** GET `/view-key/:viewKey/activity` with no auth and parse public activity.
- **Inputs:** `viewKey` (64 hex).
- **Returns / side effects:** `AccountActivity`. Throws visitor copy on failure; the loader catches and shows empty series.
- **Used by:** `ViewProfileLoader`.

## Function: fetchMe

- **Purpose:** GET `/me` with the bearer session.
- **Inputs:** `sessionToken`.
- **Returns / side effects:** `Account` or `null` on 401. Throws `WrongAccountError` on 403 with the duplicate-account api string. Other non-2xx throw the generic fetch-account error.
- **Used by:** `useHydrateSession`.

## Function: fetchMessages

- **Purpose:** GET `/forum/messages` with the bearer session, parse `forumListSchema`, and return the newest-first feed page as `{ messages, nextCursor }` (including defaulted `replyCount`).
- **Inputs:** `sessionToken`; optional `{ mode, limit, cursor, hashtag }`. Always sends `limit` (default 20), sends `mode` when supplied, sends `hashtag` when non-empty, and omits a null or empty cursor and an empty/`''` hashtag.
- **Returns / side effects:** `ForumFeedPage` with `nextCursor: null` when the response omits it. Throws visitor copy (`Could not load messages. Please try again.`) on failure.
- **Used by:** `ForumLoader`.

## Function: fetchPublicMessage

- **Purpose:** GET `/public-messages/:id` without a session, parse `forumMessageSchema`, and return one public forum note for the HTML note page. Optional `sinceSats` appends `?sinceSats=` so the api can wait until the note has more sats (pay poll).
- **Inputs:** Forum message `id` (UUID string). Optional `opts` with `sinceSats` (finite integer ≥ 0; omitted / NaN / Infinity / negatives / non-integers skip the query) and `signal` (`AbortSignal` passed to `fetch` when provided).
- **Returns / side effects:** `ForumMessage`, or `null` on 404 or abort (`AbortError` / already-aborted signal). Throws visitor copy (`Could not load messages. Please try again.`) on other non-ok, network, or zod failures.
- **Used by:** `PublicMessageLoader`, `ForumLoader`.

## Function: fetchShortLink

- **Purpose:** GET `/links/<code>` without a session. An invalid code, a non-OK response (400, 404, 409, or anything else), and an unexpected body return `null`. Network and JSON failures return `null` and do not throw.
- **Inputs:** `code` string. Only `^[0-9a-f]{8}$` (case-insensitive) is fetched; other strings return `null` without a request.
- **Returns / side effects:** `{ kind: 'message' | 'member', id }` with `id` lowercased, or `null`.
- **Used by:** `ForumQuotedBody`.

## Function: fetchForumMessage

- **Purpose:** GET `/forum/messages/:id` with a bearer session, parse `forumMessageSchema`, and return one forum note. Staff sessions receive soft-hidden rows (`deletedAt` / `deletedBy`); others get 404.
- **Inputs:** `sessionToken` and forum message `id` (UUID string).
- **Returns / side effects:** `ForumMessage`, or `null` on 404. Throws visitor copy (`Could not load messages. Please try again.`) on other non-ok, network, or zod failures.
- **Used by:** `PublicMessageLoader`.

## Function: fetchPublicReplies

- **Purpose:** GET `/public-messages/:id/replies` without a session. After HTTP OK, require `{ messages: array }`, `safeParse` each item with `forumMessageSchema`, skip invalid items, and return the survivors oldest-first.
- **Inputs:** Parent forum message `id`.
- **Returns / side effects:** `ForumMessage[]` (empty if none survive or HTTP 200 `{ messages: [] }`). Throws visitor copy (`Could not load messages. Please try again.`) on HTTP 404 (not empty), other non-ok, network, non-JSON, or a body that is not `{ messages: array }`.
- **Used by:** `PublicMessageLoader`.

## Function: fetchPublicMessagePhoto

- **Purpose:** GET `/messages/:id/photo` without Authorization (index 0 and ≤0, legacy) or GET `/messages/:id/photo/{index}.jpg` (indices 1–9) and return raw image bytes as a `Blob` for `URL.createObjectURL` on the public note page. No Authorization. Throws visitor copy on failure.
- **Inputs:** Forum message `id`, optional zero-based `index` (default 0).
- **Returns / side effects:** `Blob`. Index 0 (and ≤0) uses the legacy photo route; indices 1–9 request `{index}.jpg`. Throws visitor copy (`Could not load messages. Please try again.`) on non-ok, empty body, or network failure — does not leak status codes.
- **Used by:** `PublicMessageLoader`.

## Function: fetchReplies

- **Purpose:** GET `/forum/messages/:id/replies` with the bearer session. After HTTP OK, require `{ messages: array }`, `safeParse` each item with `forumMessageSchema`, skip invalid items, and return the survivors oldest-first.
- **Inputs:** `sessionToken`, parent message `id`.
- **Returns / side effects:** `ForumMessage[]` (empty if none survive). Throws visitor copy (`Could not load messages. Please try again.`) when the api is unavailable, the body is not JSON, or the body is not `{ messages: array }`. Damus authors may omit `role` (schema defaults to `basis`). An optional `via: 'nostr'` field is accepted (present only on replies from a Nostr user with no 21.gifts account).
- **Used by:** `ForumLoader`.

## Function: fetchMessagePhoto

- **Purpose:** GET `/messages/:id/photo` (index 0) or `/messages/:id/photo/{index}.jpg` (indices 1–9) with the bearer session and return the raw image bytes as a `Blob` for `URL.createObjectURL` rendering.
- **Inputs:** `sessionToken`, message `id`, optional zero-based `index` (default 0).
- **Returns / side effects:** `Blob`. Throws visitor copy (`Could not load messages. Please try again.`) on non-ok, empty body, or network failure — does not leak status codes.
- **Used by:** `ForumLoader`, `MemberProfileScreen`.

## Function: postMessage

- **Purpose:** POST `/forum/messages` with bearer + `{ text, photo?, photos?, inReplyTo?, goalCurrency?, goalAmount?, place? }`, parse `forumMessageSchema`, and return the created message or reply (text and/or up to ten photos). Non-empty `photos` dual-sends `photo` as the first still plus `photos`. A non-blank string `takenAt` on a still is included; a blank or missing time is omitted. Optional `goalCurrency` and `goalAmount` go together on a top-level note, never as `goalSats`; omitted on replies and when either is missing. `goalSats` remains a field of the read note. Optional `place` is `{ lat, lng, label }` on a top-level note; omitted when unset. Replies must not send it.
- **Inputs:** `sessionToken`, `input` with `text`, optional `{ contentType, data, takenAt? }` photo, optional `photos` array (max 10), optional `inReplyTo` parent id (thread composer only), optional `goalCurrency` and `goalAmount` (together, never `goalSats`), and optional `place` (`ForumPlacePin`, top-level only).
- **Returns / side effects:** `ForumMessage`. Omits `inReplyTo`, `goalCurrency`/`goalAmount`, and `place` from the JSON body when absent; omits both Ask fields on replies even if passed. On 400 or 429 uses the api error string when present; otherwise throws `Could not post your message`. On 403 uses the api error string when present; otherwise throws `A reply needs a Bitcoin payment`.
- **Used by:** `ForumLoader`, `MemberProfileScreen`.

## Function: postContact

- **Purpose:** POST `/contact/submit` with bearer + `{ text }`, parse `contactSchema`, and return the created message.
- **Inputs:** `sessionToken`, `text`.
- **Returns / side effects:** `ContactMessage`. On 400 uses the api error string when present; otherwise throws `Could not send your message`.
- **Used by:** `ContactLoader`.

## Function: isForumPhotoFile

- **Purpose:** True when a browser `File` has mime type JPEG, PNG, or WebP for the forum attach control.
- **Inputs:** `file` from `<input type="file">`.
- **Returns / side effects:** Boolean. No side effects.
- **Used by:** `prepareForumPhoto`.

## Function: prepareForumPhoto

- **Purpose:** Client-side resize/JPEG-encode a picked forum photo (max edge 1280, quality 0.8, max 1 MiB) into raw base64 plus a preview data URL. JPEG files also keep `takenAt` from Exif before the canvas encode; PNG and WebP set `takenAt` null.
- **Inputs:** `file` accepted by `isForumPhotoFile`.
- **Returns / side effects:** `{ ok: true, photo }` (`photo.takenAt` is a civil string or null) or `{ ok: false, error: 'unsupported' | 'tooLarge' }`. Revokes temporary object URLs it creates.
- **Used by:** `ForumLoader`, `AboutMeSection`, `InboxLoader`, `ModeratorGroupScreen`.

## Function: parseNumberFormat

- **Purpose:** Returns `value` if it is exactly one of `NUMBER_FORMATS` (`ch` / `us` / `de`); otherwise Swiss `ch`. Case-sensitive; `'CH'` and `'de-CH'` are invalid and fall back to the default.
- **Inputs:** Raw cookie or option `value` string, or `undefined` when absent.
- **Returns / side effects:** A supported `NumberFormatStyle`. Missing or unknown values become `DEFAULT_NUMBER_FORMAT` (`ch`). Never writes a cookie.
- **Used by:** `getRequestNumberFormat` (server cookie) and any caller that must coerce a raw `numberFormat` string.

## Function: separatorsFor

- **Purpose:** Returns the grouping and decimal characters for one `NumberFormatStyle` without `Intl.NumberFormat`. Swiss uses `'` + `.`, US uses `,` + `.`, German uses `.` + `,`.
- **Inputs:** `style` (`ch` / `us` / `de`).
- **Returns / side effects:** `{ grouping, decimal }` for that style. Exhaustive switch over `NumberFormatStyle`.
- **Used by:** `formatGroupedNumber` and `formatUsdTick` (under-10 values swap the decimal separator).

## Function: formatGroupedNumber

- **Purpose:** Groups the integer part of `value` in threes from the right and emits `fractionDigits` decimal digits using `separatorsFor`. Non-finite values are treated as 0. Rounding uses `Math.round` at `fractionDigits`.
- **Inputs:** `value` number, `style` `NumberFormatStyle`, `fractionDigits` (0 omits the decimal part).
- **Returns / side effects:** Grouped numeric string without a currency or ₿ prefix (for example `1'500` or `10'000.23`). Negative values keep a leading minus.
- **Used by:** `formatBitcoin`, `formatUsdDisplay`, `formatUsdTick`, `NumberFormatSwitcher` sample labels, `DayLoader`, `GiftDayTable`, and `StatsDashboard`.

## Function: formatBitcoin

- **Purpose:** Formats a whole-sat amount as BIP-177 ₿-only display (leading ₿, grouping from `style`, no fraction, no “sats” unit).
- **Inputs:** `sats` non-negative number (API `sats` / `totalSats`; chart mid-ticks may be fractional and are rounded); optional `style` `NumberFormatStyle` (default `ch`). No locale argument.
- **Returns / side effects:** Display string such as `₿1'500` or `₿0`.
- **Used by:** `ForumBoard`, `SignedInChrome`, `AccountActivityChart`, `StatsDashboard`, `GiftDayTable`, `DayLoader`.

## Function: formatForumTime

- **Purpose:** Formats a forum message timestamp as medium date + short time in the runtime local timezone via `Intl.DateTimeFormat`, or returns the original ISO string when the instant is invalid.
- **Inputs:** `iso` string, `locale` BCP 47 tag.
- **Returns / side effects:** Display string. Uses the runtime default timezone (visitor system timezone), not UTC.
- **Used by:** `ForumBoard`, `InboxScreen`, `ModerateScreen`, `NotificationsScreen`, `PublicMessageLoader`, `FundingApplicationDetailScreen`, `formatForumTimeFromMs`.

## Function: formatForumTimeFromMs

- **Purpose:** Formats an epoch-ms timestamp the same way as `formatForumTime` (medium date + short time in the runtime local timezone), or `String(ms)` when the instant is invalid.
- **Inputs:** `ms` epoch milliseconds, `locale` BCP 47 tag.
- **Returns / side effects:** Display string. Delegates to `formatForumTime` after `toISOString`.
- **Used by:** `FundingStatusCard`, `FundingApplicationsScreen`, `FundingApplicationDetailScreen`, `MemberProfileScreen`.

## Function: shortResourceUrl

- **Purpose:** Build the absolute URL handed to a person for a note, a reply, or a member profile. A UUID becomes `origin` + `/l/` + the first 8 hex characters, lowercased. Any other id keeps `origin` plus the long path (`/messages/<id>` or `/members/<id>`).
- **Inputs:** `origin` without a trailing slash, resource `id`, and `longPath` used when `id` is not a UUID.
- **Returns / side effects:** Absolute URL string. No I/O.
- **Used by:** `copyMessageLink` in `ForumBoard`, the member profile copy control, and `publicMessageOgMetadata`.

## Function: shortLinkPath

- **Purpose:** Map a `GET /links/:code` JSON body to the long app path. `kind: "message"` becomes `/messages/<uuid>` and `kind: "member"` becomes `/members/<uuid>`, with the id lowercased. Anything else, including a non-UUID id, is `null`.
- **Inputs:** Parsed JSON `body` (`unknown`).
- **Returns / side effects:** Path string or `null`. No I/O.
- **Used by:** `fetchShortLink` and the `GET /l/[code]` redirect route.

## Function: splitForumMessageQuotes

- **Purpose:** Parse HTTP(S) `/messages/<uuid>` URLs from a forum body. Returns lowercased unique first-seen ids and displayText with resolved URLs removed (all URLs when resolvedIds omitted). Does not linkify other URLs.
- **Inputs:** `text` string, optional `resolvedIds` ReadonlySet<string>.
- **Returns / side effects:** `{ displayText, ids }`. No I/O.
- **Used by:** `ForumQuotedBody`.

## Function: splitShortLinks

- **Purpose:** Parse HTTP(S) `/l/<8 hex>` URLs from a forum body using the same host and punctuation rules as `splitForumMessageQuotes`. Codes are lowercased, unique, and first-seen. When `resolvedCodes` is omitted, every matched short link is stripped. When it is passed, only those codes are stripped (case-insensitive). `/messages/<uuid>` URLs are left untouched.
- **Inputs:** `text` string, optional `resolvedCodes` ReadonlySet<string>.
- **Returns / side effects:** `{ displayText, codes }`. No I/O.
- **Used by:** `ForumQuotedBody`.

## Function: ForumQuotedBody

- **Purpose:** Remaining body text plus nested post cards for resolved `/messages/<uuid>` URLs and for `http(s)://<host>/l/<8 hex>` codes that `fetchShortLink` resolves to a shown message (a member, a null lookup, the containing id, and a failed load stay in the text). Fills from knownNotes first; otherwise fetchPublicMessage (catch, never throw). 404/null leaves the URL, which `LinkedText` then autolinks as an internal `/messages/<uuid>` path. Nested card is an outer frame: header (name, role span pill, timestamp) and optional photo blob are a permalink link (`forum.quotedNote`, or `forum.quotedNoteExternal` when the quoted note has `via === 'nostr'`); caption sits beside that link (`TranslatableNoteBody` when `translate` is true, `plain` only when `via === 'nostr'`; when `translate` is false, `ForumNoteText` when truncate, else `LinkedText`; no nested unfurl); ₿ amount is a second permalink link without that aria-label. `TranslatableNoteBody` on stripped display text only (a successful translation replaces that original after the same quote/short-link strip; optional `formatTranslated` runs after that strip). Feed remaining text and nested captions go through `ForumNoteText` (280-character Show more, bodies autolinked) until replaced. Permalink passes `truncate={false}` so the original stays full (`LinkedText`). Callers skip this component for `via === 'nostr'` rows (plain text and the **External** badge are handled by the caller). A nested card whose quoted note has `via === 'nostr'` shows the non-interactive **External** span in the role-pill slot (such notes carry no tagged role). Nested nostr captions use `TranslatableNoteBody` `plain` only when `translate` is true (a URL in a quoted external reply is never a link). When `translate` is false, nested cards use `ForumNoteText` / `LinkedText` and never `TranslatableNoteBody`.
- **Inputs:** text, knownNotes, excludeId, rateDay, fiat, optional truncate (default true), optional className (default `whitespace-pre-wrap text-sm text-app-fg`; `text-app-btn-fg` selects NoteTranslate `tone="onButton"` (via `TranslatableNoteBody`)), optional `translate` (default true; `false` renders remaining text and nested quoted cards — including `via === 'nostr'` — through `ForumNoteText` / `LinkedText` without `TranslatableNoteBody`; forwarded to nested `QuotedForumNote`), optional `conversationId` (when set, the remainder translates as that conversation message; nested cards stay forum notes), optional `formatTranslated` (applied only to the visible remainder translation, after the quote/short-link strip), optional `controlSlotId` (forwarded to `TranslatableNoteBody` for the footer icon row), optional onActivate.
- **Returns / side effects:** React element or null when text==='' and no resolved quotes. Unknown quote ids load via `fetchPublicMessage` (catch, never throw).
- **Used by:** `ForumBoard`, `PublicMessageLoader`, `InboxScreen`.

## Function: splitNoteLinks

- **Purpose:** Split a note body into plain-text runs and http(s) URLs. Trailing prose punctuation is not part of the URL. `javascript:` / `data:` and scheme-less text are not links. Each URL is classified internal vs external. Internal `path` collapses extra leading slashes so `https://21.gifts//…` stays a same-origin `/…` href, not protocol-relative.
- **Inputs:** `text` string, optional `currentOrigin` (page origin; that hostname is also internal).
- **Returns / side effects:** `NoteLinkSegment[]` covering `text` in order. No I/O.
- **Used by:** `LinkedText`.

## Function: isInternalAppUrl

- **Purpose:** True when an absolute http(s) URL is an in-app 21.gifts page (`21.gifts`, `www.21.gifts`, or the current origin hostname). `api.21.gifts` and other subdomains are external. Userinfo does not change the hostname check.
- **Inputs:** `href` string, optional `currentOrigin`.
- **Returns / side effects:** Boolean. No I/O.
- **Used by:** `splitNoteLinks`.

## Function: LinkedText

- **Purpose:** Render a note/About-me/inbox body with clickable http(s) URLs. Internal URLs are Next.js `Link`s to `pathname+search+hash` (no warning). External URLs are `<a href>` that `preventDefault` on a primary click and open `ExternalLinkWarning`. Click and Enter/Space `stopPropagation` so a forum card does not toggle; Enter/Space on an external URL opens the warning. Optional `suffix` sits in the same `<p>` after the runs (Show more). Optional `plain` (default false) renders `text` as a single span with no autolinking (no `<a>` / `Link`, no `ExternalLinkWarning`), used for Nostr-zapper (`via: 'nostr'`) rows.
- **Inputs:** `text`, `className` for the wrapping `<p>`, optional `linkClassName` (default underline, inherit colour), optional `currentOrigin`, optional `suffix`, optional `plain` (default false).
- **Returns / side effects:** Fragment: `<p>` plus optional overlay. Confirm on `https:` calls `openInSystemBrowser`; other http uses `window.open`.
- **Used by:** `ForumNoteText`, `ForumQuotedBody` (when `truncate` is false), `AboutMeSection`.

## Function: ExternalLinkWarning

- **Purpose:** Confirm overlay before leaving 21.gifts for an external http(s) URL. Same overlay chrome as `IntroduceYourselfOverlay` (`bg-app-overlay`, `Card maxWidth="sm"`, icon-only Close, labeled **Open link**). The destination URL is shown as user content, not a catalog string. No Skip.
- **Inputs:** `url`, `onCancel`, `onConfirm`.
- **Returns / side effects:** Dialog. Close/`onCancel` does not open the URL. **Open link** calls `onConfirm`. Dialog click and keydown `stopPropagation` so a parent forum card does not toggle.
- **Used by:** `LinkedText`.

## Function: ShopStickerOverlay

- **Purpose:** Shop-sticker overlay on a member profile. Same overlay chrome as `ExternalLinkWarning` (`role="dialog"`, `bg-app-overlay`, icon-only **Close**) with `Card maxWidth="xl"`: title **Shop sticker**, lead **Print it for a shop window. The QR code pays {handle}.**, a preview `<img>` of `buildShopStickerSvg` (alt **Shop sticker preview for {handle}**), a neutral `SegmentedControl` **File format** PDF | PNG | JPG | SVG (PDF first), and a labeled **Download**.
- **Inputs:** `qrValue` (the profile's `openCryptoPayQrValue`), `handle` (`giftsLightningAddress`), `onClose`.
- **Returns / side effects:** Dialog. **Download** disables itself while `shopStickerBlob` runs, then saves the blob through a temporary `<a download>` named by `shopStickerFileName` and revokes the object URL a second later; a failure shows `role="alert"` **Could not create the file. Please try again.** until the next try. Focus moves into the dialog on open and returns to the element that opened it on close. Close and Escape call `onClose`: the dialog's own keydown handles Escape from inside it, and a `document` listener (removed on unmount) closes only on Escape from outside the dialog, so one key press never closes twice even with the app root on `document`. Dialog click and keydown `stopPropagation`.
- **Used by:** `MemberProfileScreen` — only where the profile shows its QR (username set), including on a smartphone.

## Function: visibleForumMessages

- **Purpose:** Client-side filter and sort of the already-loaded forum thread for the Active / No gifts yet / All / Most popular selector. Does not call the api; ranking is among the messages the loader already holds.
- **Inputs:** `messages` (newest-first list from the api / loader merge) and `mode` (`active` | `unpaid` | `all` | `popular`).
- **Returns / side effects:** A new array. `all` keeps input order including unpaid (`sats === 0`) notes. `active` keeps paid notes (`sats > 0`), unpaid notes whose `role` is at least `moderator`, and top-level asks with a positive `goalSats`, newest-first. `popular` keeps only paid notes, ordered by sats descending, then `createdAt` descending, then `id` descending. Never mutates the input array.
- **Used by:** `ForumBoard`, `ForumLoader`.

The No gifts yet mode keeps only loaded messages with exactly zero sats, including notes without a wallet, preserving input order. The board displays them newest first (same as Active/All). Active remains the default.

## Function: hasUnseenForumPosts

- **Purpose:** True when a fetched forum list contains at least one message id that the currently loaded list does not. `null` current is not unseen so the first load applies instead of showing **New posts**. A loaded empty list (`[]`) with new ids is unseen.
- **Inputs:** `current` (`ForumMessage[]` or `null`) and `fetched` (newest-first GET payload).
- **Returns / side effects:** Boolean. Compares ids only; sat changes on existing ids are not unseen.
- **Used by:** `ForumLoader`.

## Function: unpaidNewCount

- **Purpose:** Counts loaded zero-sat notes created after the visitor last opened No gifts yet. Pure: no I/O and does not mutate `messages`. A missing or invalid `seenAt` is a first visit and returns `0` even when unpaid notes exist.
- **Inputs:** `messages` (newest-first list from the api / loader merge) and `seenAt` (ISO last-visit stamp, or `null` when never opened).
- **Returns / side effects:** How many currently loaded unpaid notes are strictly newer than `seenAt`. No network.
- **Used by:** `ForumLoader`.

## Function: requestForumCompose

- **Purpose:** Ask the welcome new-post composer to take focus and skip `IntroduceYourselfOverlay` on the next SignedInChrome mount. Used by **Write an introduction**.
- **Inputs:** none.
- **Returns / side effects:** Sets skip-introduce-once and pending-compose module flags that survive Next.js client navigations until consumed. When `window` exists, dispatches `FORUM_COMPOSE_EVENT` (`21gifts:forum-compose`).
- **Used by:** `IntroduceYourselfOverlay`.

## Function: consumePendingForumCompose

- **Purpose:** One-shot read of the pending-compose flag from `requestForumCompose`.
- **Inputs:** none.
- **Returns / side effects:** `true` when compose focus is still pending, then clears the flag. `false` on a second call. `ForumBoard` consumes only after the new-post textarea is present; a `composerHidden` board does not clear the flag.
- **Used by:** `ForumBoard`.

## Function: consumeSkipIntroduceOverlay

- **Purpose:** One-shot read of the skip-introduce-once flag from `requestForumCompose` so a remount after `router.push('/welcome')` does not show the overlay again.
- **Inputs:** none.
- **Returns / side effects:** `true` when this mount should start with the overlay dismissed, then clears the flag. Close (X) does not set the flag.
- **Used by:** `SignedInChrome`.

## Function: formatFiatDisplay

- **Purpose:** Formats an API fiat amount string for stats display using the visitor grouping style. `null` becomes `—` (U+2014). USD uses a dollar symbol; CHF/EUR/PHP prefix the code (`CHF 1'425.00`).
- **Inputs:** `amount` (`string | null`), `code` (`FiatCode`), and optional `style` `NumberFormatStyle` (default `ch`).
- **Returns / side effects:** Display string such as `$1'425.00` / `CHF 1'425.00`. No `Intl.NumberFormat`. No network.
- **Used by:** `StatsDashboard`, `GiftDayTable`, `DayLoader`.

## Function: formatFiatTick

- **Purpose:** Formats a parsed fiat chart-axis value with grouping and a currency prefix. USD matches `formatUsdTick`; other codes are `CHF 0` / `CHF 1.43` / `CHF 1'425`.
- **Inputs:** `amount` number (layout scale only), `code` (`FiatCode`), and optional `style` `NumberFormatStyle` (default `ch`).
- **Returns / side effects:** Axis label. Values under 10 keep trimmed decimals and use the style decimal separator. Does not itself map a null series to `—` — `StatsDashboard` does that when every selected cumulative is `null`. `AccountActivityChart` maps all-null CHF/EUR/PHP to `—` itself.
- **Used by:** `StatsDashboard` over-time fiat scale, `AccountActivityChart` (profile fiat scale).

## Function: defaultFiatForLocale

- **Purpose:** Picks the locale default for preferred fiat when the `fiat` cookie is absent: `de` → CHF, `fil` → PHP, `es` → EUR, `en` → USD.
- **Inputs:** `locale` (`Locale`).
- **Returns / side effects:** A `FiatCode`. No network.
- **Used by:** `getRequestFiat`.

## Function: formatUsdDisplay

- **Purpose:** Formats an API USD amount string (`"1425.00"`) as grouped currency (wrapper around `formatFiatDisplay(..., 'USD', style)`).
- **Inputs:** `usd` string from `GET /gifts/stats`; optional `style` `NumberFormatStyle` (default `ch`).
- **Returns / side effects:** Dollar string such as `$1'425.00`.
- **Used by:** `StatsDashboard` KPI when USD is selected.

## Function: formatUsdTick

- **Purpose:** Formats a parsed USD chart-axis value as a grouped dollar label.
- **Inputs:** `usd` number (layout scale only); optional `style` `NumberFormatStyle` (default `ch`).
- **Returns / side effects:** Label such as `$1'425`. Values under 10 keep trimmed decimals and use the style decimal separator (`.` for `ch`/`us`, `,` for `de`).
- **Used by:** `AccountActivityChart` when USD is selected. Stats over-time uses `formatFiatTick`.

## Function: latestRateDay

- **Purpose:** Picks the last `spendOverTime` day with `sats > 0` so forum notes can scale sats into fiat from gift-day totals.
- **Inputs:** Oldest-first series of `{ sats, usd, chf, eur, php }`.
- **Returns / side effects:** That day, or `null` when every day is empty.
- **Used by:** `useLatestRateDay`, `PublicMessageLoader`, `MemberProfileScreen`.

## Function: useLatestRateDay

- **Purpose:** Latest gift-day totals for preferred-fiat conversion. Fetches `GET /gifts/stats`
  once on mount via `fetchGiftStats` and resolves `latestRateDay` of `spendOverTime`; a failed
  fetch or no day with a usable rate yet resolves `null`. Drops the response after unmount.
- **Inputs:** Optional `enabled` (default true). When false, the fetch is skipped and the value stays `null`.
- **Returns / side effects:** `FiatRateDay | null`. Calls `fetchGiftStats` once per mount while enabled.
- **Used by:** `ForumLoader`, `InboxLoader`, `ModeratorGroupScreen`, `PayLinkScreen`, `PosScreen`.

## Function: shownFiatForSats

- **Purpose:** The four fiat amounts shown for a sat amount the visitor is about to pay, using the same gift day as the preview.
- **Inputs:** Whole `sats` and `rateDay` (`FiatRateDay | null`).
- **Returns / side effects:** `{ amountUsd, amountChf, amountEur, amountPhp }`, each a two-decimal string or `null`. No I/O.
- **Used by:** `ForumLoader`, `InboxLoader`, `MemberProfileScreen`, `PublicMessageThread`.

## Function: satsToFiatAmount

- **Purpose:** Scales whole sats into a two-decimal fiat string using one gift day's totals (`Math.round` on cents).
- **Inputs:** `sats`, `day` (`FiatRateDay | null`), `code` (`FiatCode`).
- **Returns / side effects:** `"0.02"`-style string, or `null` when the day or that fiat is missing or the gift-day total is `"0.00"` (not a usable rate).
- **Used by:** `ForumBoard`, `preferredFiatSuffix`, `InboxScreen`.

## Function: preferredFiatSuffix

- **Purpose:** Preferred-fiat suffix next to a ₿ amount (`·` plus the visitor's fiat), shared
  by the forum, public thread, and inbox/moderator-group threads. Settled payments use the
  fiat stored when that payment was made. A passed `stored` object never falls back to the
  live rate: `null` or a missing viewer field is Bitcoin only. Omitting `stored` (pay sheet,
  unpaid invoice) may use the last gift-day rate. `null` (₿-only) also when `stored` is
  omitted/`undefined` and `rateDay` is `null` or the conversion is unusable.
- **Inputs:** Whole sats, latest `FiatRateDay` or `null`, visitor `FiatCode`, number-format
  style, optional `stored` `{ amountUsd?, amountChf?, amountEur?, amountPhp? }` (`string | null`).
  A present string is formatted as-is (`rateDay` ignored). A present `null` or a missing field
  on a passed `stored` object is ₿-only. Omitting `stored` may use the last gift-day rate.
- **Returns / side effects:** `ReactElement | null`. No side effects.
- **Used by:** `ForumBoard`, `InboxScreen`, `QuotedForumNote`, `PublicMessageLoader`.

## Function: ThemeProvider

- **Purpose:** Client provider that reads the `theme` cookie and OS `prefers-color-scheme`, exposes preference / resolved theme, and keeps `html.dark` in sync after hydration (does not wipe the bootstrap class on the first paint).
- **Inputs:** React `children`.
- **Returns / side effects:** Context value with `preference`, `resolved`, `setPreference`. Writing `light`/`dark` sets the cookie (`Path=/`, `Max-Age=31536000`, `SameSite=Lax`, `Secure` on https); `system` deletes it. Listens to `matchMedia` while preference is `system`.
- **Used by:** `RootLayout` (wraps the app), `ThemeSwitcher`, `useTheme`.

## Function: ThemeSwitcher

- **Purpose:** Profile identity-card settings section: uppercase `theme.label` kicker and `SegmentedControl tone="neutral"` for System / Light / Dark. Always visible on the signed-in Profile card. Not page chrome, not a Menu disclosure.
- **Inputs:** None. Reads `preference` / `setPreference` from `useTheme`. Catalog keys `theme.label`, `theme.system`, `theme.light`, `theme.dark`, `aria.theme`.
- **Returns / side effects:** Settings row matching `PushToggle` chrome. Pressing an option calls `setPreference` (cookie write via `ThemeProvider`).
- **Used by:** `ProfileScreen`.

## Function: useTheme

- **Purpose:** Reads theme preference and setters from the nearest `ThemeProvider`.
- **Inputs:** None (React context).
- **Returns / side effects:** `ThemeContextValue`. Throws when used outside `ThemeProvider`.
- **Used by:** `ThemeSwitcher` and any client chrome that needs the resolved theme.

## Function: parseThemePreference

- **Purpose:** Parses a cookie / stored theme preference.
- **Inputs:** Raw cookie value, or `undefined` when missing.
- **Returns / side effects:** `'light'` / `'dark'` when valid; otherwise `'system'`.
- **Used by:** `ThemeProvider`, `THEME_BOOTSTRAP_SCRIPT` (inline equivalent).

## Function: resolveTheme

- **Purpose:** Resolves a preference against the OS color-scheme media query.
- **Inputs:** `preference` (`system` | `light` | `dark`), `prefersDark` boolean.
- **Returns / side effects:** Concrete `'light'` or `'dark'`.
- **Used by:** `ThemeProvider`.

## Function: THEME_BOOTSTRAP_SCRIPT

- **Purpose:** Blocking bootstrap IIFE string injected as a raw head script before paint. Reads the theme cookie and `matchMedia('(prefers-color-scheme: dark)')`, toggles `html.dark`, and has no dependencies.
- **Inputs:** None (constant string).
- **Returns / side effects:** Non-empty IIFE source mentioning `theme=` and `classList`.
- **Used by:** `RootLayout` `<head>` script.

## Function: THEME_COOKIE

- **Purpose:** Cookie name for a persisted theme override (`light` | `dark`). Absent means system.
- **Inputs:** None (constant `'theme'`).
- **Returns / side effects:** Cookie key string.
- **Used by:** `ThemeProvider`, theme tests.

## Function: getApiUrl

- **Purpose:** Reads `NEXT_PUBLIC_API_URL` via the typed config accessor.
- **Inputs:** None.
- **Returns / side effects:** Origin string. Throws if unset/empty (entrypoint must substitute).
- **Used by:** `proxyApiRequest` (server-side upstream origin).

## Function: getAppVersion

- **Purpose:** Typed accessor for the baked Menu version (`NEXT_PUBLIC_APP_VERSION`).
- **Inputs:** None.
- **Returns / side effects:** Decimal deploy run number string, or `dev`. Throws if unset/empty. Does not go through `entrypoint.sh`. Does not truncate.
- **Used by:** `SignedInChrome`.

## Function: getCatalog

- **Purpose:** Return the message catalog for a supported UI locale without indexed-access gaps.
- **Inputs:** `locale` (`en` / `de` / `es` / `fil`).
- **Returns / side effects:** The `Messages` object for that locale. Exhaustive switch over `Locale`.
- **Used by:** `RootLayout`, `Home`, `/login`, `NotFound`, `MarketingFooter`, `HandbookPage`, `RulesPage`, `RulesSetupPage`, and the `renderWithLocale` test helper.

## Function: getRequestLocale

- **Purpose:** Resolve the UI locale for the current request without writing cookies.
- **Inputs:** Reads the `locale` cookie and the `Accept-Language` header via `next/headers` (both async in Next 15).
- **Returns / side effects:** A supported locale (`en`/`de`/`es`/`fil`). Valid cookie wins; invalid/missing cookie falls through to `parseAcceptLanguage`; unmatched → `en`.
- **Used by:** `RootLayout`, `Home`, `/login`, `NotFound`, `MarketingFooter`, `HandbookPage`, `RulesPage`, and `RulesSetupPage`. Lives in `src/lib/request-locale.ts` so client components can import locale constants without `next/headers`.

## Function: getRequestNumberFormat

- **Purpose:** Resolve the visitor number-format style for the current request without writing cookies. Cookie `numberFormat` wins when it is `ch`/`us`/`de`; otherwise Swiss `ch`.
- **Inputs:** Reads the `numberFormat` cookie via `next/headers` (async in Next 15).
- **Returns / side effects:** A `NumberFormatStyle`. Invalid or missing cookie → `ch`. Lives in `src/lib/request-number-format.ts` so client components can import `NUMBER_FORMATS` from `@/lib/number-format` without pulling `next/headers` into the browser bundle.
- **Used by:** `RootLayout` (passes `initial` into `NumberFormatProvider`).

## Function: isAndroidUserAgent

- **Purpose:** Detects Android so the WoS CTA can use an Intent URL.
- **Inputs:** `userAgent` string.
- **Returns / side effects:** `true` iff `/Android/i` matches.
- **Used by:** `ForumBoard`.

## Function: isSmartphoneUserAgent

- **Purpose:** Detects a smartphone so the pay sheet can hide the payment QR. True for iPhone, iPod, and Android with `Mobile`; false for iPad, Android tablet (no `Mobile`), and desktop. Viewport width is irrelevant.
- **Inputs:** `userAgent` string (`navigator.userAgent`).
- **Returns / side effects:** `true` iff the UA is a smartphone. No side effects.
- **Used by:** `ForumBoard` to hide the payment QR.

## Function: isInAppBrowser

- **Purpose:** Detects Telegram and other in-app WebViews where a WebAuthn passkey ceremony cannot complete, so `/login` and `/view/[viewKey]` can show an escape card instead of starting WebAuthn.
- **Inputs:** Optional `InAppBrowserHost` (`win`); defaults to `globalThis.window` when present. Missing window (SSR) is treated as not in-app.
- **Returns / side effects:** `true` when a Telegram JS bridge is present (`TelegramWebviewProxy`, `TelegramWebview`, or `Telegram.WebApp`) or the UA matches a known in-app token list; otherwise `false`. No network and no DOM writes.
- **Used by:** `LoginCard` and `ViewProfileClaim` (choose the in-app escape card after mount), `usePasskeyLogin` (safety net: `NotAllowedError` during authenticate → `unsupported`, no register fallback), `shouldOfferIosInstall` / `PwaInstall` (hide install when in-app), and the `/login` / `/view/[viewKey]` in-app handbook / e2e variants.

## Function: loadHandbookDocuments

- **Purpose:** Read the four app handbook markdown files from disk (README, screens, functions, endpoints).
- **Inputs:** Optional `rootDir`; defaults to `<cwd>/docs/handbook`.
- **Returns / side effects:** `HandbookDocument[]` in that order. Throws when the directory or a required file is missing.
- **Used by:** `HandbookScreensPage`, `HandbookFunctionsPage`, `HandbookEndpointsPage`.

## Function: loadSession

- **Purpose:** Reads the bearer token from `localStorage`.
- **Inputs:** None.
- **Returns / side effects:** Token string or `null`. SSR-safe.
- **Used by:** `useHydrateSession` on mount, `useUnreadCount`, `refreshUnreadAppBadge`, `NotificationsLoader`.

## Function: loadUnpaidSeenAt

- **Purpose:** Reads the persisted No gifts yet last-visit timestamp from `localStorage` key `21gifts.forum-unpaid-seen`.
- **Inputs:** None.
- **Returns / side effects:** The stored ISO string, or `null` when none is stored, the value is empty/whitespace/`Date.parse` is not finite, storage access throws, or when running on the server (no `window`). SSR-safe.
- **Used by:** `ForumLoader` on mount.

## Function: parseAcceptLanguage

- **Purpose:** Negotiate a supported UI locale from an RFC 7231 `Accept-Language` header.
- **Inputs:** Raw header string (may be empty). Splits on commas. A missing `q` defaults to 1. A bare `q`, empty/invalid qvalue, or duplicate `q` discards that language-range. Maps primary subtags (`en`/`de`/`es`/`fil`, and `tl`→`fil`).
- **Returns / side effects:** Among valid mapped ranges with `q > 0`, highest `q`, then earlier header position, then `LOCALES` order. No positive assignment → `en`. Pure function — no I/O.
- **Used by:** `getRequestLocale` when no valid `locale` cookie is present.

## Function: parseHandbookMarkdown

- **Purpose:** Parse handbook markdown into headings, paragraphs, and lists with inline code, strong, links, and images.
- **Inputs:** `markdown` string and `idPrefix` for ids and in-page hashes.
- **Returns / side effects:** `HandbookBlock[]`. Drops unsafe hrefs (`..`, unknown schemes).
- **Used by:** `HandbookMarkdown`.

## Function: parseSupportedLocale

- **Purpose:** Accept a string only when it is exactly one of `en` / `de` / `es` / `fil`.
- **Inputs:** Raw cookie or option value, or `undefined`.
- **Returns / side effects:** That locale, or `null`. Pure function — no I/O.
- **Used by:** `getRequestLocale` (cookie).

## Function: resolveLightningAddress

- **Purpose:** GET `/lightning-address?address=` on the 21.gifts api.
- **Inputs:** `address`.
- **Returns / side effects:** Resolved LNURL-pay metadata (callback, min/max).
- **Used by:** Unit tests and any remaining LUD-16 resolve.

## Function: saveSession

- **Purpose:** Writes the bearer token to `localStorage`.
- **Inputs:** `token` string.
- **Returns / side effects:** void. SSR no-op.
- **Used by:** `useAuthStore.setAuth`.

## Function: saveUnpaidSeenAt

- **Purpose:** Persists the No gifts yet last-visit timestamp, overwriting any previous value.
- **Inputs:** `iso` ISO timestamp to store (`new Date().toISOString()`).
- **Returns / side effects:** void. SSR no-op. A throwing storage write is also a no-op.
- **Used by:** `ForumLoader` when entering unpaid and while unpaid as the list refreshes.

## Function: setName

- **Purpose:** POST `/me/name`.
- **Inputs:** `sessionToken`, `name`.
- **Returns / side effects:** Updated `Account`.
- **Used by:** `NameForm`.

## Function: setLocation

- **Purpose:** POST `/me/location` with JSON `{ location }`. Empty string is a valid clear.
- **Inputs:** `sessionToken`, `location` (may be empty).
- **Returns / side effects:** Updated `Account`. Throws the api error string on 400 when present, otherwise `'Could not save your location'`.
- **Used by:** `LocationForm`.

## Function: putAboutMe

- **Purpose:** PUT `/me/about` with bearer + `{ text, photo? }` and return the updated account. `photo` omitted keeps a stored image; `null` clears it; `{ contentType, data }` replaces it (same JPEG payload as a forum post).
- **Inputs:** `sessionToken`, `text`, optional `photo` (`{ contentType, data } | null`).
- **Returns / side effects:** Updated `Account` including `aboutMe` and `aboutMeHasPhoto`. Throws `MissingRequirementsError` on 409 `missing_requirements`; `'Could not save. Please try again.'` on other non-2xx. A 2xx body that fails `accountSchema` throws the schema error.
- **Used by:** `ProfileScreen`.

## Function: fetchAboutMePhoto

- **Purpose:** GET `/me/about/photo` with the bearer session and return the raw image bytes as a `Blob` for `URL.createObjectURL` rendering.
- **Inputs:** `sessionToken`.
- **Returns / side effects:** `Blob`. Throws visitor copy (`Could not load. Please try again.`) on non-ok, empty body, or network failure — does not leak status codes.
- **Used by:** `ProfileScreen` via `AboutMeSection` `loadPhoto`.

## Function: fetchViewAboutMePhoto

- **Purpose:** GET `/view-key/:viewKey/about/photo` without Authorization and return the raw image bytes as a `Blob`.
- **Inputs:** `viewKey` (64 lowercase hex). Encoded in the path.
- **Returns / side effects:** `Blob`. Throws visitor copy (`Could not load. Please try again.`) on non-ok, empty body, or network failure.
- **Used by:** `ViewProfileScreen` via `AboutMeSection` `loadPhoto`.

## Function: dismissForumLaws

- **Purpose:** POST `/me/forum-laws-dismissed` to permanently dismiss the welcome-forum living-room laws hint.
- **Inputs:** `sessionToken`.
- **Returns / side effects:** Updated `Account` with `forumLawsDismissed: true`. No request body.
- **Used by:** `ForumLoader`.

## Function: postNotificationLevel

- **Purpose:** POST `/me/notification-level` with JSON `{ level }` (`all` | `active` | `mentions`) and Bearer session.
- **Inputs:** `session` (bearer token), `level` (`NotificationLevel`).
- **Returns / side effects:** Updated `Account`. Throws `'Could not save notification level.'` on a non-ok response; a 2xx body that fails `accountSchema` throws the schema error.
- **Used by:** `PushToggle`.

## Function: accountNotificationLevel

- **Purpose:** Read `account.notificationLevel ?? 'all'` so omitted API fields still mean All.
- **Inputs:** Parsed `Account` (the field may be missing).
- **Returns / side effects:** `'all'`, `'active'`, or `'mentions'`. No network.
- **Used by:** `PushToggle`.

## Function: agreeToRules

- **Purpose:** POST `/me/rules-agreement` with Bearer and no JSON body.
- **Inputs:** `sessionToken`.
- **Returns / side effects:** Updated `Account` with `rulesAgreedAt` set. Throws `'Could not save your agreement'` on a non-ok response.
- **Used by:** `RulesSetup`.

## Function: setUsername

- **Purpose:** POST `/me/username` with the unique LUD-16 local-part.
- **Inputs:** `sessionToken`, `username`.
- **Returns / side effects:** Updated `Account`. Throws `'username-taken'` on 409, `'username-invalid'` on 400, `'username-request'` on other failures.
- **Used by:** `UsernameForm`.

## Function: giftsLightningAddress

- **Purpose:** Build the public `username@21.gifts` address shown on profiles. Loopback hosts fall back to `21.gifts`.
- **Inputs:** `username` (nullable), optional `hostname`.
- **Returns / side effects:** `local@domain` or `null`. No I/O.
- **Used by:** `MemberProfileScreen`, `ViewProfileScreen`, `openCryptoPayQrValue`.

## Function: encodeLnurl

- **Purpose:** BIP-173 bech32-encode a cleartext URL with HRP `lnurl` and return it uppercase, for an Open CryptoPay `lightning` query parameter.
- **Inputs:** `url` string.
- **Returns / side effects:** Uppercase `LNURL1…`. No I/O.
- **Used by:** `openCryptoPayQrValue`.

## Function: openCryptoPayQrValue

- **Purpose:** Build the Open CryptoPay QR payload for a profile handle. Null when `giftsLightningAddress` is null.
- **Inputs:** `username` (nullable), optional `hostname`.
- **Returns / side effects:** `https://<domain>/pl/?lightning=<LNURL>` or `null`. No I/O. The browser page for that URL is `/pl`.
- **Used by:** `MemberProfileScreen`, `ViewProfileScreen`, `ShopStickerOverlay` (sticker QR payload).

## Function: buildShopStickerSvg

- **Purpose:** Printable shop-window sticker for one member as a standalone SVG document. The fixed artwork (orange band with the Bitcoin mark, **ACCEPTED HERE** / **TINATANGGAP DITO**, the English and Filipino scan text, the sari-sari shop with the 21.gifts sign) comes from `src/lib/shop-sticker-artwork.ts`, which `scripts/build-shop-sticker-artwork.mjs` generates with every glyph converted to an outline. Only three colours: orange `#F99602`, black, white.
- **Inputs:** `qrValue` — the member's `openCryptoPayQrValue`.
- **Returns / side effects:** SVG markup, `width="134.4mm"`, `viewBox="0 0 1500 918"`. The QR is error correction H in byte mode, at least version 10 (57 modules; shorter payloads are padded up so the 4-module quiet zone to the band holds), with an odd-sized centre (13 of 57 modules, 15 of 61, …) cleared for the orange Open CryptoPay mark. No I/O.
- **Used by:** `ShopStickerOverlay` (preview `<img>` data URL), `shopStickerBlob` (SVG, PNG, JPG).

## Function: buildShopStickerPdf

- **Purpose:** The same sticker as a one-page vector PDF for print, without a PDF library: the artwork paths (absolute M, L, C, Z) become PDF path operators, the QR modules become rectangles.
- **Inputs:** `qrValue` — the member's `openCryptoPayQrValue`.
- **Returns / side effects:** PDF 1.4 bytes (`Uint8Array`), MediaBox 134.4 × 82.25 mm, no fonts, no images, exact xref offsets. No I/O.
- **Used by:** `shopStickerBlob` (format `pdf`).

## Function: shopStickerBlob

- **Purpose:** The shop-sticker file in the format the visitor picked.
- **Inputs:** `qrValue`, `format` — one of `SHOP_STICKER_FORMATS` (`pdf`, `png`, `jpg`, `svg`).
- **Returns / side effects:** `Promise<Blob>`: `application/pdf` from `buildShopStickerPdf`; `image/svg+xml` from `buildShopStickerSvg`; PNG / JPEG drawn from that SVG on a 3000 × 1836 canvas over white (JPEG quality 0.95). Rejects when the browser cannot load the SVG image, has no 2D canvas, or cannot encode it. The object URL used for the SVG image is always revoked. Nothing is sent to the api.
- **Used by:** `ShopStickerOverlay` (**Download**).

## Function: shopStickerFileName

- **Purpose:** Download name for a member's sticker.
- **Inputs:** `handle` (`username@domain` or a bare username), `format`.
- **Returns / side effects:** `21gifts-shop-sticker-<username>.<format>`; the username is lowercased and reduced to `a-z 0-9 . _ -` (`member` when nothing is left). No I/O.
- **Used by:** `ShopStickerOverlay`.

## Function: decodeLnurl

- **Purpose:** BIP-173 bech32-decode an `lnurl` string back to its cleartext URL. Not bech32m.
- **Inputs:** `value` string, either uniform case.
- **Returns / side effects:** The URL, or `null` when the value is empty, mixed-case, the wrong HRP, or a bad checksum. No I/O.
- **Used by:** `payLinkUsername`.

## Function: payLinkUsername

- **Purpose:** Read the username from an Open CryptoPay `lightning` query when it points at this site's `/.well-known/lnurlp/` path.
- **Inputs:** `lightning` LNURL string, `pageHost` (port and a leading `www.` are ignored; loopback and raw IPs expect `21.gifts`).
- **Returns / side effects:** The decoded username, or `null`. Does not call the network.
- **Used by:** `PayLinkScreen`.

## Function: PayLinkScreen

- **Purpose:** Public payment card: the person's name, an exact satoshi amount, and one BOLT11 invoice.
- **Inputs:** `lightning` query string.
- **Returns / side effects:** Renders the welcome glyph and, after `GET /pay/:username`, the name and amount form. **Create invoice** posts the amount. Desktop and smartphone then show the invoice QR and **Pay**. A new `lightning` value clears the previous person, including an invoice that is still being created. No forum and no auth gate.
- **Used by:** `PayLinkPage`.

## Function: PayLinkPage

- **Purpose:** `/pl` server page. Reads the `lightning` query and renders `PayLinkScreen`.
- **Inputs:** `searchParams` promise with an optional `lightning` string or array.
- **Returns / side effects:** The payment screen. Does not 404 when the query is missing.
- **Used by:** The App Router at `/pl`.

## Function: setLightningAddress

- **Purpose:** POST `/me/lightning-address`.
- **Inputs:** `sessionToken`, `address`.
- **Returns / side effects:** Updated `Account`. HTTP 400 whose body is `LIGHTNING_ADDRESS_NOT_ZAP_ERROR` is thrown unchanged; any other 400 is rewritten to a visitor-facing save error. Other non-ok statuses throw `'Could not save your Wallet of Satoshi address'`.
- **Used by:** `LightningAddressForm`.

## Function: translate

- **Purpose:** Look up a catalog key and replace `{name}` placeholders from `vars`.
- **Inputs:** `catalog` (`Messages`), `key` (`MessageKey`), optional `vars` map of string/number values.
- **Returns / side effects:** Interpolated string. Throws on a missing key or missing `{name}` — no silent English fallback.
- **Used by:** Server pages (`Home`, login headings, `NotFound`, `MarketingFooter`, `HandbookPage`) and the `t` helper from `LocaleProvider` / `useTranslations`.

## Function: unlinkLightningAddress

- **Purpose:** DELETE `/me/lightning-address`.
- **Inputs:** `sessionToken`.
- **Returns / side effects:** Updated `Account` with address cleared.
- **Used by:** `LightningAddressForm`.

## Function: uppercaseLnurl

- **Purpose:** Uppercases a bech32 LNURL or BOLT11 payment request.
- **Inputs:** `lnurl` string.
- **Returns / side effects:** Uppercase string.
- **Used by:** `walletOfSatoshiHref` and `walletOfSatoshiIntentHref` (`ForumBoard`).

## Function: useAuthStore

- **Purpose:** Zustand store for `session` + `account` plus `wrongAccount`. Hydration is explicit (no module-init `localStorage`).
- **Inputs:** Hook. Methods `setAuth`, `setAccount`, `clearAuth`, `setWrongAccount`, `clearWrongAccount`.
- **Returns / side effects:** Auth state object. `clearAuth` clears storage, then `bumpUnreadAppBadgeEpoch()` then `setUnreadAppBadge(0)`, then drops `session` and `account`. It does not reset `wrongAccount`.
- **Used by:** `LoginCard`, `OnboardingGate`, `NameSetup`, `AddressSetup`, `RulesSetup`, `WelcomeScreen`, `LogoutButton`, `useHydrateSession`, `usePasskeyLogin`, `NameForm`, `LightningAddressForm`.

## Function: useTranslations

- **Purpose:** Client hook returning `{ locale, t }` from the nearest `LocaleProvider`.
- **Inputs:** None (React context).
- **Returns / side effects:** Active locale and a `t(key, vars?)` bound to that catalog. Throws if used outside `LocaleProvider`.
- **Used by:** `MarketingHeader`, `LanguageSwitcher`, `LoginCard`, `LightningAddressForm`, `ForumBoard`, `NameForm`, `HandbookCopyLink`, `NameSetup`, `AddressSetup`, `RulesSetup`, `WelcomeScreen`, `LogoutButton`.

## Function: useNumberFormat

- **Purpose:** Client hook returning `{ numberFormat, setNumberFormat }` from the nearest `NumberFormatProvider`. Call sites that format counts or money take this hook's style, not UI locale.
- **Inputs:** None (React context).
- **Returns / side effects:** Active `NumberFormatStyle` and a setter that writes the `numberFormat` cookie. Throws `useNumberFormat must be used within NumberFormatProvider` when used outside the provider.
- **Used by:** `NumberFormatSwitcher`, `ForumBoard`, `StatsDashboard`, `DayLoader`, `AccountActivityChart`, `SignedInChrome`, `PublicMessageLoader`.

## Function: walletOfSatoshiHref

- **Purpose:** iOS/desktop WoS deep link.
- **Inputs:** Bech32 LNURL or BOLT11 payment request.
- **Returns / side effects:** `walletofsatoshi:lightning:` + uppercase payload.
- **Used by:** `ForumBoard` when not Android.

## Function: walletOfSatoshiIntentHref

- **Purpose:** Android Chrome Intent pinning the WoS package.
- **Inputs:** Bech32 LNURL or BOLT11 payment request.
- **Returns / side effects:** `intent:lightning:…#Intent;scheme=walletofsatoshi;package=com.livingroomofsatoshi.wallet;…;end`.
- **Used by:** `ForumBoard` on Android.

## Function: DELETE

- **Purpose:** Shared App Router DELETE export name. `/me/lightning-address` re-exports `proxyMeLightningAddressDelete`; `/me/push-subscriptions` re-exports `proxyMePushSubscriptionsDelete`; `/forum/messages/[id]` re-exports `proxyMessagesDelete`; `/pos/charge` re-exports `proxyPosDelete`.
- **Inputs:** Incoming `Request`. For `/forum/messages/[id]`, also async route `params` with the message id.
- **Returns / side effects:** Upstream api `Response`.
- **Used by:** Same-origin `unlinkLightningAddress`, `deletePushSubscription` / `disablePush`, and same-origin forum moderation delete (`deleteMessage`).

## Function: AboutPage

- **Purpose:** Next.js page for `/about`. Three convictions, Matthew 10:8, 1 John 3:18, and a CTA into `/welcome`.
- **Inputs:** None. Calls `getRequestLocale()` and reads copy from the catalog via `translate`.
- **Returns / side effects:** The about screen with a link to `/welcome`.
- **Used by:** Route `/about`.

## Function: LegalPage

- **Purpose:** Next.js page for `/legal` (imprint and privacy). No published email — contact is in-app via `/contact`.
- **Inputs:** None.
- **Returns / side effects:** The legal screen with links to `/contact`.
- **Used by:** Route `/legal`.

## Function: MarketingFooter

- **Purpose:** Footer for marketing pages: wordmark, localized section links including About, legal, living-room rules, GitHub, and a quiet Matthew 10:8 verse.
- **Inputs:** None. Resolves locale via `getRequestLocale` and reads copy from the catalog via `translate`.
- **Returns / side effects:** Footer element.
- **Used by:** `MarketingLayout`, `NotFound`.

## Function: MarketingHeader

- **Purpose:** Sticky marketing header with `HomeWordmark` (`tone="dark"`; `/` unsigned, `/welcome` when a session is hydrated), section nav (How / Happyland / Why / FAQ / About / Stats / Handbook, accent **Log in**, optional `PwaInstall` `tone="dark"` `placement="header"`), always-visible `LanguageSwitcher` (`tone="dark"`), and a mobile menu toggle. Happyland links to the existing `/#happyland` photo essay from any marketing page. ThemeSwitcher and NumberFormatSwitcher are marketing-forbidden.
- **Inputs:** None. Internal open state. Reads copy via `useTranslations`.
- **Returns / side effects:** Header element; toggles nav on small screens. `LanguageSwitcher` stays visible when the hamburger is closed. Install control stays `null` until after mount when an offer applies.
- **Used by:** `MarketingLayout`, `NotFound` (no extra props).

## Function: MarketingLayout

- **Purpose:** Async dark full-page shell for `/`, `/about`, `/legal`, `/handbook`, and `/stats`.
- **Inputs:** `children`. Awaits `MarketingFooter()` (does not render it as a JSX child).
- **Returns / side effects:** Wrapper div with header, page, and awaited footer.
- **Used by:** Marketing route group.

## Function: NotFound

- **Purpose:** Async app-wide 404 screen with marketing chrome and a localized link home.
- **Inputs:** None. Calls `getRequestLocale()` for body/back-link copy; awaits `MarketingFooter()`.
- **Returns / side effects:** 404 element with `MarketingHeader` and awaited footer (not rendered as JSX child).
- **Used by:** Next.js `not-found.tsx`.

## Function: POST

- **Purpose:** Shared App Router POST export name. `/me/name` re-exports `proxyMeNamePost`; `/me/location` re-exports `proxyMeLocationPost`; `/me/forum-laws-dismissed` re-exports `proxyMeForumLawsDismissedPost`; `/me/notification-level` re-exports `proxyMeNotificationLevelPost`; `/me/rules-agreement` re-exports `proxyMeRulesAgreementPost`; `/me/lightning-address` re-exports `proxyMeLightningAddressPost`; `/me/push-subscriptions` re-exports `proxyMePushSubscriptionsPost`; `/me/wallet-backup-seen` re-exports `proxyMeWalletBackupSeenPost`; `/auth/passkey/{register,authenticate,replace,seed}/{begin,finish}` re-export the eight passkey proxy POSTs; `/forum/messages` re-exports `proxyMessagesPost`; `/messages/[id]/invoice` re-exports `proxyMessagesInvoicePost`; `/conversations` re-exports `proxyConversationsPost`; `/conversations/[id]` re-exports `proxyConversationPost`; `/conversations/[id]/invoice` re-exports `proxyConversationInvoicePost`; `/conversations/[id]/read` re-exports `proxyConversationReadPost`; `/forum/notifications/read-all` re-exports `proxyNotificationsReadAllPost`; `/forum/notifications/[id]/read` re-exports `proxyNotificationReadPost`; `/contact/submit` re-exports `proxyContactPost`; `/translate` re-exports `proxyTranslateNotePost` with JSON `{ messageId, target }`; `/conversations/[id]/messages/[messageId]/translate` re-exports `proxyTranslateConversationMessagePost` with JSON `{ target }`; `/trust/verify` re-exports `proxyTrustVerifyPost`; `/trust/propose-moderator` re-exports `proxyTrustProposeModeratorPost`; `/trust/confirm-moderator` re-exports `proxyTrustConfirmModeratorPost`; `/trust/reject-moderator` re-exports `proxyTrustRejectModeratorPost`; `/trust/appoint-moderator` re-exports `proxyTrustAppointModeratorPost`; `/funding/apply` re-exports `proxyFundingApplyPost`; `/funding/trial` re-exports `proxyFundingTrialPost`; `/funding/admit` re-exports `proxyFundingAdmitPost`; `/funding/reject` re-exports `proxyFundingRejectPost`. `/pos/charge` re-exports `proxyPosPost`. HTML `/pos` is the till page, not a POST proxy. HTML `/messages` is the inbox page, not a POST proxy.
- **Inputs:** Incoming `Request`.
- **Returns / side effects:** Upstream api `Response` on api proxies; `/translate` returns `{ translatedText, cached }` or 400/404/503/502 from the 21.gifts api.
- **Used by:** Same-origin name save, location save (`POST /me/location`), forum laws dismiss, notification-level save (`POST /me/notification-level`), living-room rules agreement (`POST /me/rules-agreement`), address link, Web Push subscribe (`POST /me/push-subscriptions`), recovery-phrase backup-seen (`POST /me/wallet-backup-seen`), passkey begin/finish (register, authenticate, replace, and seed), forum message create (`POST /forum/messages`), payable-reply invoice (`POST /messages/[id]/invoice`), inbox open (`POST /conversations`) and reply (`POST /conversations/[id]`), inbox invoice (`POST /conversations/[id]/invoice`), mark-one conversation (`POST /conversations/[id]/read`), mark-all notifications (`POST /forum/notifications/read-all`) and mark-one (`POST /forum/notifications/[id]/read`), in-app contact (`POST /contact/submit`), `translateNote` via `POST /translate`, `translateConversationMessage` via `POST /conversations/[id]/messages/[messageId]/translate`, staff Trust Chain actions (`POST /trust/verify`, `POST /trust/propose-moderator`, `POST /trust/confirm-moderator`, `POST /trust/reject-moderator`, `POST /trust/appoint-moderator`), grant apply (`POST /funding/apply`), and staff funding decisions (`POST /funding/trial`, `POST /funding/admit`, `POST /funding/reject`).

## Function: PUT

- **Purpose:** Shared App Router PUT export name. `/me/about` re-exports `proxyMeAboutPut`.
- **Inputs:** Incoming `Request` with Bearer session and JSON `{ text }`.
- **Returns / side effects:** Upstream api `Response`.
- **Used by:** Same-origin About me save (`PUT /me/about` / `putAboutMe`).

## Function: proxyApiRequest

- **Purpose:** Forwards an App Router request to `getApiUrl()` + path. Copies query, authorization / content-type / content-length / user-agent / origin / range headers. Multipart POST/PUT/PATCH/DELETE bodies stream with `duplex: 'half'` when `request.body` is non-null and `Content-Length` is not `0`; JSON and other bodies are buffered (`arrayBuffer`) so Node fetch does not throw. Empty POSTs omit body and duplex. Copies content-type / content-length / content-range / accept-ranges / cache-control / content-disposition from the upstream response.
- **Inputs:** `request`, `apiPath` beginning with `/`.
- **Returns / side effects:** Upstream `Response` (status + selected headers + streamed body), or 502 JSON if fetch throws.
- **Used by:** All same-origin api proxy route handlers.

## Function: proxyTrustChainGet

- **Purpose:** Same-origin Bearer proxy helper for api `GET /trust-chain`. Forwards the incoming Authorization header.
- **Inputs:** Incoming `Request` (Bearer session).
- **Returns / side effects:** Upstream `Response` via `proxyApiRequest`.
- **Used by:** Route GET `/trust/graph`.

## Function: proxyTrustProposalsGet

- **Purpose:** Same-origin Bearer proxy helper for api `GET /trust/proposals`. Forwards the incoming Authorization header.
- **Inputs:** Incoming `Request` (Bearer session).
- **Returns / side effects:** Upstream `Response` via `proxyApiRequest`.
- **Used by:** Route GET `/trust/proposals`.

## Function: proxyFundingApplyPost

- **Purpose:** Same-origin Bearer proxy helper for api `POST /funding/apply`.
- **Inputs:** Incoming `Request` (Bearer session).
- **Returns / side effects:** Upstream `Response` via `proxyApiRequest`.
- **Used by:** Route POST `/funding/apply`.

## Function: proxyFundingApplicationsGet

- **Purpose:** Same-origin Bearer proxy helper for api `GET /funding/applications`. Forwards the incoming Authorization header.
- **Inputs:** Incoming `Request` (Bearer session).
- **Returns / side effects:** Upstream `Response` via `proxyApiRequest`.
- **Used by:** Route GET `/funding/applications`.

## Function: proxyFundingApplicationGet

- **Purpose:** Same-origin Bearer proxy helper for api `GET /funding/applications/:accountId`.
- **Inputs:** Incoming `Request` (Bearer session) and `accountId`.
- **Returns / side effects:** Upstream `Response` via `proxyApiRequest` (id encoded).
- **Used by:** Route GET `/funding/applications/[accountId]`.

## Function: proxyFundingTrialPost

- **Purpose:** Same-origin Bearer proxy helper for api `POST /funding/trial`.
- **Inputs:** Incoming `Request` (JSON `{ accountId }`).
- **Returns / side effects:** Upstream `Response`.
- **Used by:** Route POST `/funding/trial`.

## Function: proxyFundingAdmitPost

- **Purpose:** Same-origin Bearer proxy helper for api `POST /funding/admit`.
- **Inputs:** Incoming `Request` (JSON `{ accountId }`).
- **Returns / side effects:** Upstream `Response`.
- **Used by:** Route POST `/funding/admit`.

## Function: proxyFundingRejectPost

- **Purpose:** Same-origin Bearer proxy helper for api `POST /funding/reject`.
- **Inputs:** Incoming `Request` (JSON `{ accountId }`).
- **Returns / side effects:** Upstream `Response`.
- **Used by:** Route POST `/funding/reject`.

## Function: proxyTrustVerifyPost

- **Purpose:** Same-origin Bearer proxy helper for api `POST /trust/verify`.
- **Inputs:** Incoming `Request` (JSON `{ accountId }`).
- **Returns / side effects:** Upstream `Response`.
- **Used by:** Route POST `/trust/verify`.

## Function: proxyTrustProposeModeratorPost

- **Purpose:** Same-origin Bearer proxy helper for api `POST /trust/propose-moderator`.
- **Inputs:** Incoming `Request` (JSON `{ accountId }`).
- **Returns / side effects:** Upstream `Response`.
- **Used by:** Route POST `/trust/propose-moderator`.

## Function: proxyTrustConfirmModeratorPost

- **Purpose:** Same-origin Bearer proxy helper for api `POST /trust/confirm-moderator`.
- **Inputs:** Incoming `Request` (JSON `{ accountId }`).
- **Returns / side effects:** Upstream `Response`.
- **Used by:** Route POST `/trust/confirm-moderator`.

## Function: proxyTrustRejectModeratorPost

- **Purpose:** Same-origin Bearer proxy helper for api `POST /trust/reject-moderator`.
- **Inputs:** Incoming `Request` (JSON `{ accountId }`).
- **Returns / side effects:** Upstream `Response`.
- **Used by:** Route POST `/trust/reject-moderator`.

## Function: proxyTrustAppointModeratorPost

- **Purpose:** Same-origin Bearer proxy helper for api `POST /trust/appoint-moderator`.
- **Inputs:** Incoming `Request` (JSON `{ accountId }`).
- **Returns / side effects:** Upstream `Response`.
- **Used by:** Route POST `/trust/appoint-moderator`.

## Function: proxyMessagesStatsGet

- **Purpose:** Same-origin proxy helper for api `GET /messages/stats`.
- **Inputs:** Incoming `Request`.
- **Returns / side effects:** Upstream `Response` via `proxyApiRequest`.
- **Used by:** Route GET `/messages/stats`.

## Function: proxyGiftsStatsGet

- **Purpose:** Same-origin proxy helper for api `GET /gifts/stats` (forwards `recipient` query).
- **Inputs:** Incoming `Request` (optional `recipient` search param).
- **Returns / side effects:** Upstream `Response` via `proxyApiRequest`.
- **Used by:** Route GET `/gifts/stats`.

## Function: proxyMeActivityGet

- **Purpose:** Same-origin proxy helper for api `GET /me/activity`.
- **Inputs:** Incoming `Request` (Bearer).
- **Returns / side effects:** Upstream `Response` via `proxyApiRequest`.
- **Used by:** Route GET `/me/activity`.

## Function: proxyMembersActivityGet

- **Purpose:** Same-origin proxy helper for api `GET /members/:accountId/activity`.
- **Inputs:** Incoming `Request` (Bearer) and `accountId`.
- **Returns / side effects:** Upstream `Response` via `proxyApiRequest`.
- **Used by:** Route GET `/forum/members/[accountId]/activity`.

## Function: proxyViewActivityGet

- **Purpose:** Same-origin proxy helper for api `GET /view/:viewKey/activity` (public).
- **Inputs:** Incoming `Request` and `viewKey`.
- **Returns / side effects:** Upstream `Response` via `proxyApiRequest`.
- **Used by:** Route GET `/view-key/[viewKey]/activity`.

## Function: proxyLightningAddressGet

- **Purpose:** Proxies GET `/lightning-address`.
- **Inputs:** `Request` with `address` query.
- **Returns / side effects:** Upstream `Response`.
- **Used by:** Route GET `/lightning-address`.

## Function: proxyMeNamePost

- **Purpose:** Proxies POST `/me/name`.
- **Inputs:** `Request` with JSON body.
- **Returns / side effects:** Upstream `Response`.
- **Used by:** Route POST `/me/name`.

## Function: proxyMeUsernamePost

- **Purpose:** Proxies POST `/me/username`.
- **Inputs:** `Request` with JSON body.
- **Returns / side effects:** Upstream `Response`.
- **Used by:** Route POST `/me/username`.

## Function: proxyMeLocationPost

- **Purpose:** Proxies POST `/me/location`.
- **Inputs:** `Request` with JSON `{ location }` and Bearer session.
- **Returns / side effects:** Upstream `Response`.
- **Used by:** Route POST `/me/location`.

## Function: proxyMeAboutPut

- **Purpose:** Same-origin Bearer proxy of api `PUT /me/about`.
- **Inputs:** Incoming `Request` with Bearer session and JSON `{ text, photo? }`.
- **Returns / side effects:** Upstream `Response` via `proxyApiRequest`.
- **Used by:** App Router `PUT` on `/me/about`.

## Function: proxyMeAboutPhotoGet

- **Purpose:** Same-origin Bearer proxy of api `GET /me/about/photo` (raw profile-note photo bytes).
- **Inputs:** Incoming `Request` with Bearer session.
- **Returns / side effects:** Upstream `Response` via `proxyApiRequest` to `/me/about/photo`.
- **Used by:** App Router `GET` on `/me/about/photo`.

## Function: proxyViewAboutPhotoGet

- **Purpose:** Same-origin public proxy of api `GET /view/:viewKey/about/photo` (raw profile-note photo bytes). Browser path is `/view-key/:viewKey/about/photo`; upstream is `/view/:viewKey/about/photo`.
- **Inputs:** Incoming `Request`, plus `viewKey` from the App Router segment.
- **Returns / side effects:** Upstream `Response` via `proxyApiRequest`.
- **Used by:** App Router `GET` on `/view-key/[viewKey]/about/photo`.

## Function: proxyMeForumLawsDismissedPost

- **Purpose:** Proxies POST `/me/forum-laws-dismissed`.
- **Inputs:** `Request` with Bearer session (no body).
- **Returns / side effects:** Upstream `Response`.
- **Used by:** Route POST `/me/forum-laws-dismissed`.

## Function: proxyMeNotificationLevelPost

- **Purpose:** Same-origin Bearer proxy of api POST `/me/notification-level` with JSON `{ level }`.
- **Inputs:** Incoming `Request` with Bearer session and JSON `{ level }`.
- **Returns / side effects:** Upstream `Response` via `proxyApiRequest`.
- **Used by:** Route POST `/me/notification-level`.

## Function: proxyMeRulesAgreementPost

- **Purpose:** Proxies POST `/me/rules-agreement`.
- **Inputs:** Incoming `Request` with Bearer session (no JSON body required by the client).
- **Returns / side effects:** Upstream `Response` via `proxyApiRequest`.
- **Used by:** Route POST `/me/rules-agreement`.

## Function: proxyMeGet

- **Purpose:** Proxies GET `/me`.
- **Inputs:** `Request` with Bearer token.
- **Returns / side effects:** Upstream `Response`.
- **Used by:** Route GET `/me`.

## Function: proxyMessagesGet

- **Purpose:** Bearer proxy GET `/messages` to the 21.gifts api (public forum list). App route is GET `/forum/messages`.
- **Inputs:** Incoming `Request` with Bearer session.
- **Returns / side effects:** Upstream `Response` via `proxyApiRequest`.
- **Used by:** Route GET `/forum/messages`.

## Function: proxyMessagesHiddenGet

- **Purpose:** Same-origin Bearer proxy of api GET `/messages/hidden` (hidden living-room notes for moderators). App route is GET `/forum/messages/hidden`.
- **Inputs:** Incoming `Request` with Bearer session.
- **Returns / side effects:** Upstream `Response` via `proxyApiRequest`.
- **Used by:** `src/app/forum/messages/hidden/route.ts`.

## Function: proxyMessagesPost

- **Purpose:** Bearer proxy POST `/messages` to the 21.gifts api (create a public forum message or reply). App route is POST `/forum/messages`.
- **Inputs:** Incoming `Request` with Bearer session and JSON body.
- **Returns / side effects:** Upstream `Response` via `proxyApiRequest`.
- **Used by:** Route POST `/forum/messages`.

## Function: proxyMessagesRepliesGet

- **Purpose:** Bearer proxy GET `/messages/:id/replies` to the 21.gifts api (oldest-first replies). App route is GET `/forum/messages/[id]/replies`.
- **Inputs:** Incoming `Request` with Bearer session, plus parent message `id` from the App Router segment.
- **Returns / side effects:** Upstream `Response` via `proxyApiRequest`.
- **Used by:** Route GET `/forum/messages/[id]/replies`.

## Function: proxyPublicMessageGet

- **Purpose:** Public proxy GET `/messages/:id` to the 21.gifts api (one note as JSON, no auth). App path is `/public-messages/[id]` so `/messages/[id]` can serve HTML.
- **Inputs:** Incoming `Request`, plus message `id` from the App Router segment.
- **Returns / side effects:** Upstream `Response` via `proxyApiRequest`.
- **Used by:** Route GET `/public-messages/[id]`.

## Function: proxyShortLinkGet

- **Purpose:** Public proxy GET `/links/:code` to the 21.gifts api (JSON `{ kind, id }`, no auth). App path is `/links/[code]`. Forwards the code with `encodeURIComponent`. The visitor-facing redirect is `/l/[code]`, not this JSON route.
- **Inputs:** Incoming `Request`, plus short-link `code` from the App Router segment.
- **Returns / side effects:** Upstream `Response` via `proxyApiRequest` (status and JSON body, or 502 when the api is unreachable).
- **Used by:** Route GET `/links/[code]`, which `fetchShortLink` calls.

## Function: proxyPublicMessageRepliesGet

- **Purpose:** Public proxy GET `/messages/:id/replies` to the 21.gifts api (oldest-first live replies, no auth). App path is `/public-messages/[id]/replies` so `/messages/[id]` can serve HTML.
- **Inputs:** Incoming `Request`, plus parent message `id` from the App Router segment.
- **Returns / side effects:** Upstream `Response` via `proxyApiRequest`.
- **Used by:** Route GET `/public-messages/[id]/replies`.

## Function: proxyContactPost

- **Purpose:** Bearer proxy POST `/contact` to the 21.gifts api (create an in-app contact message). Same-origin path is `/contact/submit` so it does not collide with the `/contact` page.
- **Inputs:** Incoming `Request` with Bearer session and JSON body.
- **Returns / side effects:** Upstream `Response` via `proxyApiRequest`.
- **Used by:** Route POST `/contact/submit`.

## Function: proxyMessagesPhotoGet

- **Purpose:** Same-origin proxy GET `/messages/:id/photo` or `/messages/:id/photo/{file}` to the 21.gifts api (raw forum photo bytes). Public; no bearer required (api photo is public; proxy forwards Authorization if present but does not require it). Runtime `getApiUrl()` via `proxyApiRequest` (not next.config rewrites).
- **Inputs:** Incoming `Request`, message `id` from the App Router segment, and optional indexed `file` such as `1.jpg`.
- **Returns / side effects:** Upstream `Response` via `proxyApiRequest`.
- **Used by:** Route GET `/messages/[id]/photo` and GET `/messages/[id]/photo/[file]`.

## Function: proxyMessagesVideoGet

- **Purpose:** Same-origin proxy GET `/messages/:id/video.{mp4,webm,mov}` to the 21.gifts api (raw forum video bytes). Public; no bearer required. Runtime `getApiUrl()` via `proxyApiRequest` (not next.config rewrites).
- **Inputs:** Incoming `Request`, message `id` from the route, and `ext` `'mp4' | 'webm' | 'mov'`.
- **Returns / side effects:** Upstream `Response` via `proxyApiRequest`.
- **Used by:** Route GET `/messages/[id]/[file]` when `file` is `video.mp4` | `video.webm` | `video.mov`.

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

## Function: base64UrlToBytes

- **Purpose:** Decode a base64url string to bytes for WebAuthn options.
- **Inputs:** Base64url string (padding optional).
- **Returns / side effects:** `Uint8Array`. No network.
- **Used by:** `creationOptionsFromJSON`, `requestOptionsFromJSON`.

## Function: bytesToBase64Url

- **Purpose:** Encode bytes as unpadded base64url for WebAuthn JSON.
- **Inputs:** `Uint8Array`.
- **Returns / side effects:** Base64url string. No network.
- **Used by:** `credentialToJSON`.

## Function: creationOptionsFromJSON

- **Purpose:** Turn api creation-options JSON into `navigator.credentials.create` input, including `excludeCredentials` when present and client `extensions` (PRF `eval.first` as base64url) via `applyClientExtensions`.
- **Inputs:** Record from `POST /auth/passkey/register/begin` or `POST /auth/passkey/seed/begin`.
- **Returns / side effects:** `PublicKeyCredentialCreationOptions`. Uses native parse when present. Throws if a descriptor list is present but not an array, or is non-empty but has no valid `public-key` entries (invalid type or id is skipped; all skipped → TypeError), including before native parse.
- **Used by:** `usePasskeyLogin.register`, `useWalletPhrase.activate`.

## Function: credentialToJSON

- **Purpose:** Serialise a `PublicKeyCredential` for the api finish body. Drops `clientExtensionResults.prf` so PRF bytes never leave the tab.
- **Inputs:** Browser credential from create/get.
- **Returns / side effects:** JSON record without `prf` results. Uses native `toJSON` when present, then strips `prf`.
- **Used by:** `usePasskeyLogin`, `useWalletPhrase`.

## Function: finishPasskeyAuthentication

- **Purpose:** POST `/auth/passkey/authenticate/finish` and parse the session.
- **Inputs:** `challengeId` and credential JSON.
- **Returns / side effects:** `{ token, account }`. Throws `WrongAccountError` on 403 with the duplicate-account api string. Other non-2xx stay status fallbacks.
- **Used by:** `usePasskeyLogin.authenticate`.

## Function: finishPasskeyRegistration

- **Purpose:** POST `/auth/passkey/register/finish` and parse the session.
- **Inputs:** `challengeId` and credential JSON.
- **Returns / side effects:** `{ token, account }` with `linkingKey` null. Throws `WrongAccountError` on 403 with the duplicate-account api string. Other non-2xx stay status fallbacks.
- **Used by:** `usePasskeyLogin.register`.

## Function: proxyAuthPasskeyAuthenticateBeginPost

- **Purpose:** Proxies POST `/auth/passkey/authenticate/begin`.
- **Inputs:** Incoming `Request`.
- **Returns / side effects:** Upstream `Response`.
- **Used by:** Route POST `/auth/passkey/authenticate/begin`.

## Function: proxyAuthPasskeyAuthenticateFinishPost

- **Purpose:** Proxies POST `/auth/passkey/authenticate/finish`.
- **Inputs:** Incoming `Request` with JSON body.
- **Returns / side effects:** Upstream `Response`.
- **Used by:** Route POST `/auth/passkey/authenticate/finish`.

## Function: proxyAuthPasskeyRegisterBeginPost

- **Purpose:** Proxies POST `/auth/passkey/register/begin`.
- **Inputs:** Incoming `Request`.
- **Returns / side effects:** Upstream `Response`.
- **Used by:** Route POST `/auth/passkey/register/begin`.

## Function: proxyAuthPasskeyRegisterFinishPost

- **Purpose:** Proxies POST `/auth/passkey/register/finish`.
- **Inputs:** Incoming `Request` with JSON body.
- **Returns / side effects:** Upstream `Response`.
- **Used by:** Route POST `/auth/passkey/register/finish`.

## Function: requestOptionsFromJSON

- **Purpose:** Turn api request-options JSON into `navigator.credentials.get` input. Empty `allowCredentials` is omitted (discoverable credentials). When discoverable, sets `hints: ['client-device']`. Copies client `extensions` (PRF `eval.first` as base64url) via `applyClientExtensions`.
- **Inputs:** Record from `POST /auth/passkey/authenticate/begin`.
- **Returns / side effects:** `PublicKeyCredentialRequestOptions`. Uses native parse when present. Throws if a descriptor list is present but not an array, or is non-empty but has no valid `public-key` entries (invalid type or id is skipped; all skipped → TypeError), including before native parse.
- **Used by:** `usePasskeyLogin.authenticate`.

## Function: startPasskeyAuthentication

- **Purpose:** POST `/auth/passkey/authenticate/begin` and parse options.
- **Inputs:** None.
- **Returns / side effects:** `{ challengeId, options }`. Throws on non-2xx.
- **Used by:** `usePasskeyLogin.authenticate`.

## Function: startPasskeyReplace

- **Purpose:** POST `/auth/passkey/replace/begin` with Bearer. The client helper is removed. Replace routes and proxies remain so an old client can still reach the API; the API rejects replace. Nothing in the app calls this for the phrase.
- **Inputs:** Session token.
- **Returns / side effects:** `{ challengeId, options }`. Throws on non-2xx.
- **Used by:** None. The client helper is removed.

## Function: finishPasskeyReplace

- **Purpose:** POST `/auth/passkey/replace/finish` with Bearer. Does not mint a session. The client helper is removed. Replace routes and proxies remain so an old client can still reach the API; the API rejects replace. Nothing in the app calls this for the phrase.
- **Inputs:** Session token, challenge id, credential JSON.
- **Returns / side effects:** Owner `Account` from `{ account }`. Throws on non-2xx.
- **Used by:** None. The client helper is removed.

## Function: startPasskeySeed

- **Purpose:** POST `/auth/passkey/seed/begin` with Bearer and an empty body.
- **Inputs:** Session token.
- **Returns / side effects:** `{ challengeId, options }`. Throws on non-2xx, including 409.
- **Used by:** `useWalletPhrase.activate`.

## Function: finishPasskeySeed

- **Purpose:** POST `/auth/passkey/seed/finish` with Bearer and `{ challengeId, credential }`.
- **Inputs:** Session token, challenge id, credential JSON.
- **Returns / side effects:** 200 is the owner account JSON itself (`accountSchema`, not `{ account }`, no new token), including `passkeyCredentialId`. Throws on non-2xx.
- **Used by:** `useWalletPhrase.activate`.

## Function: postWalletBackupSeen

- **Purpose:** POST `/me/wallet-backup-seen` with Bearer.
- **Inputs:** Session token.
- **Returns / side effects:** Owner `Account`. Throws on non-2xx.
- **Used by:** The helper remains. `useWalletPhrase` does not call it.

## Function: proxyAuthPasskeyReplaceBeginPost

- **Purpose:** Proxies POST `/auth/passkey/replace/begin`.
- **Inputs:** Incoming `Request` with Bearer.
- **Returns / side effects:** Upstream `Response`.
- **Used by:** Route POST `/auth/passkey/replace/begin`.

## Function: proxyAuthPasskeyReplaceFinishPost

- **Purpose:** Proxies POST `/auth/passkey/replace/finish`.
- **Inputs:** Incoming `Request` with Bearer and JSON body.
- **Returns / side effects:** Upstream `Response`.
- **Used by:** Route POST `/auth/passkey/replace/finish`.

## Function: proxyAuthPasskeySeedBeginPost

- **Purpose:** Proxies POST `/auth/passkey/seed/begin`.
- **Inputs:** Incoming `Request` with Bearer.
- **Returns / side effects:** Upstream `Response`.
- **Used by:** Route POST `/auth/passkey/seed/begin`.

## Function: proxyAuthPasskeySeedFinishPost

- **Purpose:** Proxies POST `/auth/passkey/seed/finish`.
- **Inputs:** Incoming `Request` with Bearer and JSON body.
- **Returns / side effects:** Upstream `Response`.
- **Used by:** Route POST `/auth/passkey/seed/finish`.

## Function: proxyMeWalletBackupSeenPost

- **Purpose:** Proxies POST `/me/wallet-backup-seen`.
- **Inputs:** Incoming `Request` with Bearer.
- **Returns / side effects:** Upstream `Response`.
- **Used by:** Route POST `/me/wallet-backup-seen`.

## Function: prfEvalFirstSalt

- **Purpose:** SHA-256 of UTF-8 `21gifts-nostr-v1`.
- **Inputs:** None.
- **Returns / side effects:** 32-byte `Uint8Array`.
- **Used by:** `obtainPrfFirst`, `obtainPrfFirstFromGet`, `usePasskeyLogin.register`, `useWalletPhrase.activate`.

## Function: readPrfFirst

- **Purpose:** Read `prf.results.first` from a credential.
- **Inputs:** `PublicKeyCredential`.
- **Returns / side effects:** Bytes or `undefined`.
- **Used by:** `obtainPrfFirst`, `obtainPrfFirstFromGet`.

## Function: mnemonicFromPrfFirst

- **Purpose:** HKDF-SHA-256 then BIP-39 English 12 words.
- **Inputs:** PRF eval.first bytes.
- **Returns / side effects:** Space-separated mnemonic. Never sent to the api.
- **Used by:** `useWalletPhrase`.

## Function: obtainPrfFirst

- **Purpose:** Prefer create() PRF; else get() with allowCredentials and eval.first salt.
- **Inputs:** The new `PublicKeyCredential`.
- **Returns / side effects:** Bytes or `null`.
- **Used by:** `usePasskeyLogin.register`, `useWalletPhrase.activate`.

## Function: obtainPrfFirstFromGet

- **Purpose:** get() with PRF eval.first bound to this account's current credential (`allowCredentials`) to re-derive the phrase.
- **Inputs:** Current credential id bytes (WebAuthn `rawId`).
- **Returns / side effects:** Bytes or `null`. Does not contact the api. Does not pick a leftover credential after replace.
- **Used by:** `useWalletPhrase.showPhrase`.

## Function: classifyWebAuthnError

- **Purpose:** Map WebAuthn failures to timeout / cancel / generic.
- **Inputs:** Unknown rejection.
- **Returns / side effects:** Discriminant string.
- **Used by:** `useWalletPhrase`.

## Function: rememberSessionPhrase

- **Purpose:** Store 12 words in tab RAM.
- **Inputs:** Mnemonic string.
- **Returns / side effects:** Module-level variable. Never localStorage.
- **Used by:** Tests; re-exported from `useWalletPhrase`. Not called from register or wallet add. Implemented in `tab-phrase`.

## Function: peekSessionPhrase

- **Purpose:** Read tab-RAM mnemonic.
- **Inputs:** None.
- **Returns / side effects:** String or `null`.
- **Used by:** `useWalletPhrase`. Implemented in `tab-phrase`.

## Function: clearSessionPhrase

- **Purpose:** Drop tab-RAM mnemonic.
- **Inputs:** None.
- **Returns / side effects:** Clears the module variable.
- **Used by:** `useWalletPhrase.hidePhrase`, `clearAuth`, `login`, `authenticate`. Implemented in `tab-phrase`.

## Function: resetWalletCeremonyLock

- **Purpose:** Drop the tab-wide wallet WebAuthn lock so a later ceremony can start.
- **Inputs:** None.
- **Returns / side effects:** Sets the module lock to idle. Tests call this between cases; production uses `finally` on activate / showPhrase.
- **Used by:** `useWalletPhrase` tests.

## Function: useWalletPhrase

- **Purpose:** Add or show the recovery phrase for `/wallet`. There is no confirm view, no auto-reveal, and no Continue on the words.
- **Inputs:** Auth store session and account.
- **Returns / side effects:** View `'activate' | 'reveal' | 'phrase'`, status, error, words, `activate`, `showPhrase`, `hidePhrase`, `retry`. `'activate'` only without a non-empty `passkeyCredentialId` (**Add recovery phrase**: `startPasskeySeed`, `credentials.create` with PRF, `obtainPrfFirst`, no finish when that is null, otherwise `finishPasskeySeed`, store the account, 12 words only in component state). `'reveal'` when the id is set: `showPhrase` runs `obtainPrfFirstFromGet` of that id, no create, no seed/begin. `walletBackupSeenAt` is not read. `rememberSessionPhrase` is not called. No Confirm, no Continue.
- **Used by:** `WalletScreen`.

## Function: WalletScreenView

- **Purpose:** Wallet card, and the header Back for that page. The visible Back is this `ProfileChromeLeft` via `AppShellTopLeft`, not the page `WalletChromeLeft`.
- **Inputs:** `UseWalletPhraseResult`.
- **Returns / side effects:** Card with **Add recovery phrase**, the 12-word grid and only-backup line (no Continue), or **Show recovery phrase** (`variant="secondary"`) under closed **Advanced functions** (open shows the button). Header Back takes one step: hide the words, close **Advanced functions**, `history.back()`, or open `/welcome` when the tab has no previous page. Error shows a reason, a hint, and **Try again**.
- **Used by:** `WalletScreen`.

## Function: WalletScreen

- **Purpose:** Signed-in wallet page body.
- **Inputs:** None.
- **Returns / side effects:** Renders `WalletScreenView` with `useWalletPhrase()`. No auto-reveal.
- **Used by:** `WalletPage`.

## Function: WalletPage

- **Purpose:** Next.js page for `/wallet`.
- **Inputs:** None.
- **Returns / side effects:** AppShell + OnboardingGate + WalletScreen.
- **Used by:** Route `/wallet`.

## Function: startPasskeyRegistration

- **Purpose:** POST `/auth/passkey/register/begin` and parse options.
- **Inputs:** Optional `viewKey` string. When set (non-empty), POSTs JSON `{ viewKey }` with `Content-Type: application/json`; otherwise POSTs with no body and no Content-Type.
- **Returns / side effects:** `{ challengeId, options }`. On `!ok`, throws the api `{ error }` string when present, otherwise a status fallback.
- **Used by:** `usePasskeyLogin.register`.

## Function: usePasskeyLogin

- **Purpose:** Client hook for passkey login. `login` authenticates with an existing passkey. When authenticate returns `NotAllowedError` and `isInAppBrowser()` is false, status becomes `choice` and registration is not started. When authenticate returns `NotAllowedError` while `isInAppBrowser()` is true, status becomes `unsupported` and register is not started. From `choice`, `authenticate` never falls through to register; `register()` (no view key) starts create. After a choice was offered, user cancel (`NotAllowedError` or `AbortError`) on those ceremonies returns to `choice`; direct `authenticate` / `register(viewKey)` from `ViewProfileClaim` never sets that flag, so cancel returns to `idle`. On iOS/iPadOS WebKit (including iPadOS desktop-site: Macintosh UA, MacIntel, maxTouchPoints > 1), `credentials.get` / `credentials.create` omit AbortSignal. `cancel` aborts an in-flight WebAuthn prompt and clears the choice flag. `register(viewKey?)` forwards an optional view key for public profile claim; `retry` after `register(viewKey)` resends the same key. `login` never sends a view key. Finish `WrongAccountError` clears the session, sets `wrongAccount`, status `error` with that message, and does not fall through to discoverable registration. `register` requires WebAuthn PRF on create; missing PRF aborts with `wallet.prfUnsupported` and does not finish. The words are discarded. `login` / `authenticate` call `clearSessionPhrase`.
- **Inputs:** None (reads `useAuthStore`; calls `isInAppBrowser` on authenticate `NotAllowedError`).
- **Returns / side effects:** `{ status, login, register, authenticate, retry, cancel, error }` with `status` in `idle | starting | error | unsupported | choice`. `error` is the last `Error.message` when `status === 'error'`, else `null`. `retry` repeats `login` when the visitor used the single button. After a choice button, `retry` repeats that ceremony. Calls WebAuthn and the api. Unmount still aborts the controller and clears the choice flag.
- **Used by:** `OnboardingGate`, `LoginCard`, `LogoutButton`, and `ViewProfileClaim`.

## Function: fetchComposeTarget

- **Purpose:** GET `/messages/compose-target` so a basis account can invoice 1 sat to 21.gifts (the platform profile note) before posting or replying.
- **Inputs:** session token.
- **Returns / side effects:** `{ messageId, sats }` of the payable platform profile note, or throws collapsed copy.
- **Used by:** `ForumLoader`, `PublicMessageThread`, `MemberProfileScreen`.

## Function: postMessageInvoice

- **Purpose:** POST `/messages/:id/invoice` with `{ sats }`, `{ sats, text }` when the visitor attached a reply comment, and `amountUsd`, `amountChf`, `amountEur`, `amountPhp` when a preview rate is on screen. Empty `text` is omitted. A missing preview omits those four fields.
- **Inputs:** session token, message id, sats, optional text, optional shown `amountUsd`, `amountChf`, `amountEur`, and `amountPhp` (each a two-decimal string or null). The amounts are read when the request is sent, not when an earlier requirements step started.
- **Returns / side effects:** `{ pr, amountSats }` or throws collapsed copy. 409 `missing_requirements` throws `MissingRequirementsError`.
- **Used by:** `ForumLoader`, `MemberProfileScreen`, `PublicMessageThread`.

## Function: proxyMessagesComposeTargetGet

- **Purpose:** Same-origin proxy for `GET /messages/compose-target`.
- **Inputs:** App Router `Request`.
- **Returns / side effects:** Forwards to the api.
- **Used by:** `src/app/messages/compose-target/route.ts`.

## Function: proxyMessagesInvoicePost

- **Purpose:** Same-origin proxy for `POST /messages/:id/invoice`.
- **Inputs:** App Router `Request`.
- **Returns / side effects:** Forwards to the api.
- **Used by:** `src/app/messages/[id]/invoice/route.ts`.

## Function: MessagesPage

- **Purpose:** Next.js page for `/messages` (signed-in PN inbox).
- **Inputs:** None.
- **Returns / side effects:** Fill `AppShell` (`align="center"`) with `MessagesChromeLeft` in `Suspense` top-left (fallback `ProfileChromeLeft`), `SignedInChrome` top-right, and `OnboardingGate` around `InboxLoader`. Conversation HTTP is under `/conversations`.
- **Used by:** Route `/messages`.

## Function: InboxLoader

- **Purpose:** Client loader for `/messages`. Session and account from `useAuthStore`; returns null without a session. Fetches the unpaged `GET /conversations` list, opens `?c=` via `onOpen` `router.push`, and posts replies. An open thread sets `showAttach` true: JPEG/PNG/WebP stills (cap 10) via `prepareForumPhoto`; photo-only send allowed. Send is disabled while `posting || preparing`. Thread stills load with `fetchConversationMessagePhoto`. Blob URLs are revoked on unmount, on thread switch, and on session loss; drafts and preparing drop on those same events (`pickGeneration`). The invoice path stays text/sats only and clears still drafts. The list has no attach. The first paint of an open thread calls `fetchConversation(session, openId)` without a cursor for the newest 20-message page. An `IntersectionObserver` on `InboxScreen`'s `nearStartRef` (the eighth grouped bubble from the start, or the first when fewer than eight render) fetches a set `nextCursor` and prepends unique older messages. The cursor load does not blank the thread; while stuck to the bottom, InboxScreen keeps the newest in view. Returning to the list is the chrome link (no `onBack` handler). Moderators get `showFilter` true; members see the unfiltered inbound list. `?c=` opens only after the inbox list loaded. For a moderator an unlisted `?c=` first resolves `fetchModeratorGroup` once per id (neutral **Loading…**, not the list, while it runs); when that id matches, the thread never opens and `fetchConversation` is not called. A listed `moderator_group` row never opens either. Other roles, and a failed lookup, fall through to `fetchConversation`; the api rejects accounts that may not read the thread. Also calls `useLatestRateDay()` and passes `rateDay` to `InboxScreen`. While a private thread is open and the tab is visible, the newest page is fetched every 5 seconds and unseen messages are appended; a hidden tab does not poll, and a failed poll keeps the thread.
- **Inputs:** None (reads session and account from the auth store; `useSearchParams`).
- **Returns / side effects:** React element or `null` without a session. Calls `fetchConversations`, `fetchConversation`, `fetchModeratorGroup` (`roleAtLeast(role, 'moderator')`, unlisted `?c=` only), `prepareForumPhoto`, `fetchConversationMessagePhoto`, `postConversationMessage`, `postConversationInvoice`. After a successful thread fetch, local `unread: false` and `unreadMessageCount: 0`, then fire-and-forget `markConversationRead`, `bumpUnreadAppBadgeEpoch` and `refreshUnreadAppBadge` (remaining inbox from the local list; a thread only opens after the list loaded, so there is no second conversations fetch). After a successful paid-gift poll or `postConversationMessage`, the matching list row is also `unread: false` and `unreadMessageCount: 0` (including when the first thread fetch failed). When that poll fills a thread whose first `fetchConversation` failed (`messages === null`), it also clears `messagesError` and takes `nextCursor` from the poll page so older history can still prefetch. Must not fail the thread view.
- **Used by:** `MessagesPage`.

## Function: groupThreadGifts

- **Purpose:** Pure grouping helper for an inbox/moderator-group thread. A message whose
  `giftFor` equals a DIFFERENT message's id present in the same list is removed from the top
  level and appended to that parent's `gifts`, in original list order; a `giftFor` that is
  unknown, self-referencing, or names a message that is itself a gift leaves the message as an
  ordinary top-level entry with empty `gifts`, so no message is ever dropped. Order of top-level messages is preserved regardless of where a gift appears in the
  input array.
- **Inputs:** Oldest-first `ConversationMessage[]`.
- **Returns / side effects:** `ThreadGiftGroup[]` (`{ message, gifts }` per top-level message).
  No side effects.
- **Used by:** `InboxScreen`.

## Function: InboxScreen

- **Purpose:** Presentational inbox: incoming threads as a conversation list, or one open thread with a 8000-character composer and sats amount field (`showAmount` false hides the field; the staff room has no gifts). The message, attach, and send share one row; the amount is the next row (`AmountEntry` `layout="composer"`), indented to the message when attach is shown. Without an amount the photo and send stay vertically centered on the message. `showAttach` (default false for callers that omit it) adds the ImagePlus control, still previews, and photo-only send; InboxLoader open threads and ModeratorGroupScreen pass true. Non-empty bodies go through `ForumQuotedBody` so a pasted `https://21.gifts/messages/<uuid>` unfurls as a nested quoted-note card, using the same `rateDay` (a stored string as-is; `null` or a missing field on a passed `stored` object is ₿-only; omitting `stored` uses the latest gift-day rate). `photoUrls` (`${messageId}:${index}`) render attached stills. When `showFilter` is true (moderator), the list is filtered by the origin control (Direct / Contact / Damus; default Direct). Rows with `kind` `moderator_group` are never listed; the closed staff room lives on `/moderate/group`. Members (`showFilter` false) see inbound rows except `moderator_group` and no control. Each list row and the open-thread header show an origin label from `conversation.kind` (Contact / Direct / Damus / Moderators chat group). Unread inbound rows use `font-semibold` names, `text-app-fg` last text, a visible tabular-nums lining-nums unread-message count right of the name when the derived count is greater than zero (`row.unreadMessageCount`, or 1 when `unread` is true and the count is 0), and `aria-label` `inbox.threadUnread` with `{name}` and `{count}`. The word Unread is not visible text. Read inbound last text is a muted preview. When `lastFromMe` is true and `lastText` is non-empty, the list preview is `inbox.sentPreview` (`You: {text}`) in a filled chip; gift-only last messages (`lastSats > 0`, empty `lastText`) show the formatted amount and have no Translate control. When `lastMessageId` is a non-empty string and `lastText` is non-empty, a Languages **Translate** control (`NoteTranslate`, conversation source) sits outside the row button and can replace the preview text, including inside `inbox.sentPreview`. Thread remainders go through `ForumQuotedBody` with `conversationId` (`translateConversationMessage`); nested forum quotes stay on `translateNote`. Thread incoming messages are full-width muted note cards; `fromMe` messages render as filled `app-btn` bubbles on the right labelled `inbox.you`. Gift-only bubbles use `forum.giftReply`; text+sats shows the amount under the body. An open invoice shows the Lightning pay sheet. Open-thread heading is counterpart name + origin caption (no `onBack`, no in-card back). Heading and incoming author names with `accountId` are `inbox.authorProfile` buttons to `/members/:id`; `fromMe` stays `inbox.you` text; Damus/missing id stays plain text. A staff viewer sees another staff reply as an incoming muted card with that person's `name` (profile link when `accountId` is set). `fromMe` / `inbox.you` only when this session is the actor. Settled thread sats amounts (gift-only bubble, text+sats line, and nested gift line) show a preferred-fiat suffix via `preferredFiatSuffix` from the amount stored when the payment was made, else ₿-only. Unpaid invoice previews still use optional `rateDay` (latest gift-day totals). A message whose `giftFor` points at another message renders via `groupThreadGifts` as a nested `role="note"` line inside the parent's `<li>` (name, ₿ amount, fiat suffix, time; not shown as its own top-level row) instead of a separate bubble. When supplied, `nearStartRef` attaches to the eighth grouped bubble from the start, or the first bubble when fewer than eight render. An open thread (`openId` set, messages loaded) scrolls the AppShell scroller to the bottom so the newest (oldest-first) messages and composer are in view. While stuck to the bottom (within 80px), prepends and stills keep the newest in view; scrolling up unsticks and prepends compensate scrollTop. A newest-id change re-sticks. Inside AppShell the pin waits for that scroller and does not fall back to `window` while the node is missing (`window` only outside AppShell); the pin runs again when an invoice pay sheet opens; list view does not pin to the bottom; leaving a thread scrolls the list to the top once.
- **Inputs:** List/thread/composer state from `InboxLoader` or `ModeratorGroupScreen`.
- **Returns / side effects:** React element. InboxScreen itself does not fetch; `ForumQuotedBody` may call `fetchPublicMessage` for pasted `/messages/<uuid>` URLs.
- **Used by:** `InboxLoader`, `ModeratorGroupScreen`.

## Function: fetchConversations

- **Purpose:** GET `/conversations` with Bearer and parse `{ conversations, unreadCount }`. Missing `unread` defaults false; missing `unreadCount` defaults 0; missing `unreadMessageCount` defaults 0. The api returns incoming threads, plus the member's own 21.gifts contact thread when it has a message. GET `/conversations` never lists the `moderator_group` thread, even for moderators. Each row includes required `kind`: `member_member` | `member_platform` | `member_damus` | `moderator_group`, required `lastFromMe` (true when the last message was sent by this session as the actor, not when another staff member sent as the platform), required `lastSats`, optional `accountId` (counterpart), `unread`, and `unreadMessageCount` (inbound unread messages). Envelope `unreadCount` is unread thread count.
- **Inputs:** Session token.
- **Returns / side effects:** Conversation list, or throws visitor copy.
- **Used by:** `InboxLoader`, `ContactLoader`, `useUnreadCount`, `NotificationsLoader`, `refreshUnreadAppBadge`.

## Function: fetchConversation

- **Purpose:** GET `/conversations/:id` with Bearer, always sending `limit=20`, plus optional `cursor` and `sinceMessageId`. Parses `{ messages, nextCursor? }`. Each message includes required `fromMe` (true iff this session is the actor) and `sats`, plus `hasPhoto` / `photoCount` (client default 0 when omitted). For a staff viewer, incoming `name` and optional `accountId` are the actor when the api sends them. The newest page is returned first and messages inside each page are oldest-first; `nextCursor` is supplied only for a full page.
- **Inputs:** Session token, conversation id, optional `{ sinceMessageId, cursor, signal }`.
- **Returns / side effects:** `{ messages, nextCursor }`, normalizing an omitted `nextCursor` to `null`, or throws visitor copy.
- **Used by:** `InboxLoader`, `ModeratorGroupScreen`.

## Function: postConversationMessage

- **Purpose:** POST `/conversations/:id` with `{ text }` and, when `photos` is non-empty, `{ photo, photos }` (first still duplicated as `photo`, at most 10 JPEG/PNG/WebP stills). Empty text is allowed when photos are present (Moderators group and `/messages` Direct/Contact/Damus). Staff replies on official threads still send as the platform account on the api, but the created message's `fromMe`, `name`, and `accountId` follow the actor.
- **Inputs:** Session token, conversation id, text, optional photos array.
- **Returns / side effects:** Created message, or throws api/visitor copy.
- **Used by:** `InboxLoader`, `ModeratorGroupScreen`.

## Function: fetchConversationMessagePhoto

- **Purpose:** GET `/conversations/:id/messages/:messageId/photo` (index 0) or `/photo/{n}.jpg` (indices 1–9) with Bearer. Callers use a blob URL, not a bare `<img src>`. Empty body throws.
- **Inputs:** Session token, conversation id, message id, optional zero-based index (default 0).
- **Returns / side effects:** Photo `Blob`, or throws visitor copy (`Could not load messages. Please try again.`).
- **Used by:** `InboxLoader`, `ModeratorGroupScreen`.

## Function: proxyConversationMessagePhotoGet

- **Purpose:** Same-origin Bearer proxy of api GET `/conversations/:id/messages/:messageId/photo` or `/photo/:file`.
- **Inputs:** Incoming App Router `Request`, conversation id, message id, optional file (`1.jpg`–`9.jpg`).
- **Returns / side effects:** Upstream image response.
- **Used by:** `GET` on `/conversations/[id]/messages/[messageId]/photo` and `/photo/[file]`.

## Function: postConversationInvoice

- **Purpose:** POST `/conversations/:id/invoice` with `{ sats }`, `{ sats, text }`, and `amountUsd`, `amountChf`, `amountEur`, `amountPhp` when a preview rate is on screen. Empty `text` is omitted. A missing preview omits those four fields.
- **Inputs:** Session token, conversation id, sats, optional text, optional shown `amountUsd`, `amountChf`, `amountEur`, and `amountPhp` (each a two-decimal string or null).
- **Returns / side effects:** `{ pr, amountSats, messageId }`, or throws api/visitor copy.
- **Used by:** `InboxLoader`.

## Function: openConversation

- **Purpose:** POST `/conversations` with `{ forumMessageId }`.
- **Inputs:** Session token and forum note/reply id.
- **Returns / side effects:** Conversation row, or throws on 400/404/other.
- **Used by:** `MemberProfileScreen` Message (`profile.message`).

## Function: markConversationRead

- **Purpose:** POST `/conversations/:id/read` with Bearer. Non-ok throws; success may ignore body.
- **Inputs:** Session token and conversation id (encoded in the path).
- **Returns / side effects:** void, or throws visitor copy.
- **Used by:** `InboxLoader` after a successful thread fetch (fire-and-forget; failures are ignored). `ModeratorGroupScreen` after a successful group+thread load (fire-and-forget; failures are ignored).

## Function: proxyConversationsGet

- **Purpose:** Same-origin proxy for api GET `/conversations`.
- **Inputs:** App Router `Request`.
- **Returns / side effects:** Forwards to the api.
- **Used by:** `src/app/conversations/route.ts`.

## Function: proxyConversationsPost

- **Purpose:** Same-origin proxy for api POST `/conversations`.
- **Inputs:** App Router `Request`.
- **Returns / side effects:** Forwards to the api.
- **Used by:** `src/app/conversations/route.ts`.

## Function: proxyModeratorGroupGet

- **Purpose:** Same-origin Bearer proxy for api GET `/conversations/moderator-group` (singleton closed staff room as `{ conversation }`).
- **Inputs:** App Router `Request`.
- **Returns / side effects:** Forwards to the api path `/conversations/moderator-group`.
- **Used by:** `src/app/conversations/moderator-group/route.ts`.

## Function: proxyConversationGet

- **Purpose:** Same-origin proxy for api GET `/conversations/:id`.
- **Inputs:** App Router `Request` and conversation id.
- **Returns / side effects:** Forwards to the api.
- **Used by:** `src/app/conversations/[id]/route.ts`.

## Function: proxyConversationPost

- **Purpose:** Same-origin proxy for api POST `/conversations/:id`.
- **Inputs:** App Router `Request` and conversation id.
- **Returns / side effects:** Forwards to the api.
- **Used by:** `src/app/conversations/[id]/route.ts`.

## Function: proxyConversationInvoicePost

- **Purpose:** Same-origin proxy for api POST `/conversations/:id/invoice`.
- **Inputs:** App Router `Request` and conversation id.
- **Returns / side effects:** Forwards to the api.
- **Used by:** `src/app/conversations/[id]/invoice/route.ts`.

## Function: proxyConversationReadPost

- **Purpose:** Same-origin proxy for api POST `/conversations/:id/read`. App route is POST `/conversations/[id]/read`.
- **Inputs:** App Router `Request` and conversation id.
- **Returns / side effects:** Forwards to the api (id encoded).
- **Used by:** `src/app/conversations/[id]/read/route.ts`.

## Function: NotificationsPage

- **Purpose:** Next.js page for `/notifications` (signed-in notifications for living-room posts, replies, payments, moderator appointment, and moderator proposal).
- **Inputs:** None.
- **Returns / side effects:** Fill `AppShell` (`align="center"`) with `ProfileChromeLeft` top-left, `SignedInChrome` top-right, and `OnboardingGate screen="welcome"` around `NotificationsLoader`. Notification HTTP is under `/forum/notifications` (no `route.ts` beside this page).
- **Used by:** Route `/notifications`.

## Function: NotificationsLoader

- **Purpose:** Client loader for `/notifications`. Fetches `GET /forum/notifications` (posts, replies, payments, moderator appointment, and moderator proposal). After a successful list fetch, `bumpUnreadAppBadgeEpoch` then set the badge to remaining inbox unread plus staff-room unread (`0` or `1`; notifications treated as 0; visiting `/notifications` does not force badge 0 when inbox or staff-room unread remains). Repeats after `markAllNotificationsRead` if the session is unchanged. Fetches conversations (`fetchConversations`) and, when `roleAtLeast(account?.role, 'moderator')`, the staff room (`fetchModeratorGroup`) for those counts; below moderator, remaining badge is inbox unread only (staff-room contributes 0, no request). A side that fails contributes 0. Opening a `moderator_proposal` row goes to `/moderate/proposals` without `markNotificationRead`. Opening a `moderator_appointed` row waits for `markNotificationRead` then goes to `/welcome` (still navigates if that POST fails; skips navigation if the session changed); any other row goes to `/messages/{parentId}` without waiting.
- **Inputs:** None (session from the auth store).
- **Returns / side effects:** React element or `null` without a session. No composer. After a non-cancelled successful list fetch, marks all read fire-and-forget, then `bumpUnreadAppBadgeEpoch` and sets the home-screen badge to remaining inbox unread plus staff-room unread (`0` or `1`; notifications treated as 0). Repeats after `markAllNotificationsRead` if the session is unchanged. Fetches conversations (`fetchConversations`) and, when `roleAtLeast(account?.role, 'moderator')`, the staff room (`fetchModeratorGroup`) for those counts; below moderator, remaining badge is inbox unread only (staff-room contributes 0, no request). A side that fails contributes 0. Does not clear remaining inbox or staff-room unread on error, cancel, or missing session.
- **Used by:** `NotificationsPage`.

## Function: NotificationsScreen

- **Purpose:** Presentational notifications list of living-room posts, replies, payments, moderator appointment, and moderator proposal (actor `{name} posted` / `{name} replied` / `{name} sent bitcoin` / `{name} proposed a moderator`; `moderator_appointed` title uses `notifications.moderatorAppointed` with no `{name}` placeholder; post text or **Photo**, except a `forum_post` whose `text` equals `name` omits the body (profile-note leftover); reply text or **Photo reaction**, zap amount as stored, moderator appointment or proposal body only when `text` is non-empty — empty `text` omits the body line and does not use `notifications.photoPost` / `photoOnly`; **Translate** (Languages icon) sits under `forum_post` and `forum_reply` user text only, not under zap amounts, appointment, or proposal subjects; time; unread semibold). `onOpen` receives the row object. No composer, no thread view, and no filter.
- **Inputs:** List state from `NotificationsLoader` (`notifications`, `error`, `loading`, `onRetry`, `onOpen`).
- **Returns / side effects:** React element. No network.
- **Used by:** `NotificationsLoader`.

## Function: fetchNotifications

- **Purpose:** GET `/forum/notifications` with Bearer and parse `{ notifications, unreadCount }`.
- **Inputs:** Session token.
- **Returns / side effects:** `{ notifications, unreadCount }`, or throws visitor copy `Could not load notifications. Please try again.`
- **Used by:** `NotificationsLoader`, `useUnreadCount`, `refreshUnreadAppBadge`, `ForumLoader` (welcome appointment banner).

## Function: markNotificationRead

- **Purpose:** POST `/forum/notifications/:id/read` with Bearer and parse one notification.
- **Inputs:** Session token and notification id (encoded in the path).
- **Returns / side effects:** Updated notification, or throws visitor copy.
- **Used by:** `NotificationsLoader` on row click; `ForumLoader` when the welcome appointment pill is clicked.

## Function: markAllNotificationsRead

- **Purpose:** POST `/forum/notifications/read-all` with Bearer. Non-ok throws; success may ignore body.
- **Inputs:** Session token.
- **Returns / side effects:** void.
- **Used by:** `NotificationsLoader` fire-and-forget after a successful list fetch.

## Function: proxyNotificationsGet

- **Purpose:** Same-origin proxy for api GET `/notifications`. App route is GET `/forum/notifications`.
- **Inputs:** App Router `Request`.
- **Returns / side effects:** Forwards to the api.
- **Used by:** `src/app/forum/notifications/route.ts`.

## Function: proxyNotificationsReadAllPost

- **Purpose:** Same-origin proxy for api POST `/notifications/read-all`. App route is POST `/forum/notifications/read-all`.
- **Inputs:** App Router `Request`.
- **Returns / side effects:** Forwards to the api.
- **Used by:** `src/app/forum/notifications/read-all/route.ts`.

## Function: proxyNotificationReadPost

- **Purpose:** Same-origin proxy for api POST `/notifications/:id/read`. App route is POST `/forum/notifications/[id]/read`.
- **Inputs:** App Router `Request` and notification id.
- **Returns / side effects:** Forwards to the api (id encoded).
- **Used by:** `src/app/forum/notifications/[id]/read/route.ts`.

## Function: ModeratePage

- **Purpose:** Next.js page for `/moderate` (signed-in moderation hub for moderators). HTML `/moderate` is the hub, not a GET proxy. Fill `AppShell` (`align="center"`) with `ProfileChromeLeft` top-left, `SignedInChrome` top-right, and `OnboardingGate screen="welcome"` around `ModerateScreen`. Hidden HTTP lives under `/forum/messages/hidden`; proposal HTTP under `/trust/proposals`; grant-application HTTP under `/funding/applications` (no `route.ts` beside this page); the hub itself does not fetch.
- **Inputs:** None.
- **Returns / side effects:** The moderation hub inside fill AppShell.
- **Used by:** Route `/moderate`.

## Function: roleRank

- **Purpose:** Numeric rank of a role from an explicit rank map (not `ROLE_ORDER.indexOf`), for use by `roleAtLeast`.
- **Inputs:** `role` — one of `'basis' | 'verified' | 'moderator' | 'initiator' | 'founder'`.
- **Returns / side effects:** Integer 0 through 3 (basis 0, verified 1, moderator 2, initiator 2, founder 3). Not `ROLE_ORDER`'s index (initiator is not 3, founder is not 4). Pure, no side effects.
- **Used by:** `roleAtLeast`.

## Function: roleAtLeast

- **Purpose:** Product-rule primitive for every viewer permission/visibility check: true when `role` meets or exceeds `min` by numeric rank. An equal rank meets the minimum. A missing account (`null`/`undefined` role) is never at least any role.
- **Inputs:** `role` — live account role, or `null`/`undefined` when the account snapshot is absent; `min` — inclusive minimum role.
- **Returns / side effects:** Boolean. Pure, no side effects; delegates to `roleRank`.
- **Used by:** `ModerateScreen`, `ModeratorGroupScreen`, `InboxLoader`, `HiddenNotesScreen`, `ProposalsScreen`, `FundingApplicationsScreen`, `FundingApplicationDetailScreen`, `FundingStatusCard`, `DeletePostControl`, `ForumLoader`, `MemberProfileScreen`, `MemberTrustActions`, `SignedInChrome`, `useUnreadCount`, `isReplyPaymentExempt`.

## Function: isReplyPaymentExempt

- **Purpose:** True when the signed-in account may reply without paying: anyone at least verified is exempt. Basis, including the parent note's author, is not exempt.
- **Inputs:** `account` — `{ id, role }` or `null` when the account snapshot is missing; `parentAccountId` — the parent note's `accountId` if the api sent one (a missing id is not treated as exempt).
- **Returns / side effects:** Boolean. Pure, no side effects; delegates to `roleAtLeast`.
- **Used by:** `ForumLoader`, `MemberProfileScreen`, `PublicMessageThread`.

## Function: ModerateScreen

- **Purpose:** Client moderation hub of staff tools. Staff (`roleAtLeast(..., 'moderator')`) see the daily payout-goal widget (yesterday versus 100 people, each person counted once, with the 100-a-day label and the yesterday count on one line; tap expands explanation plus a 30-UTC-day count chart), a labeled **Hidden notes** `ButtonLink` (`variant="secondary"` `size="lg"`) → `/moderate/hidden`, a labeled **Open proposals** `ButtonLink` (`variant="secondary"` `size="lg"`) → `/moderate/proposals` that shows `proposalCount` plus `moderate.proposals.unread` when greater than zero, a labeled **Open applications** `ButtonLink` (`variant="secondary"` `size="lg"`) → `/moderate/applications`, a **Moderators chat group** `ButtonLink` → `/moderate/group` that shows the staff-room unread count plus `moderate.groupUnread` when unread, and a labeled **Handbook** `ButtonLink` (`variant="secondary"` `size="lg"`) → `/moderate/handbook`. Non-staff signed-in visitors see the heading plus forbidden copy and no tools list. Does not fetch hidden notes, proposals, applications, or the group thread itself; unread for Open proposals and Moderators chat group comes from `useUnreadCount`. Renders `null` without a session. No un-hide control.
- **Inputs:** Session and account from `useAuthStore`; catalog via `useTranslations`; `useUnreadCount(true, { writeBadge: false })` for Open proposals `proposalCount` and Moderators chat group staff-room unread (network for those counts; does not write the home-screen badge).
- **Returns / side effects:** React element or `null` without a session. Staff fetch `GET /gifts/stats` for the goal widget; others see forbidden copy and do not fetch. Does not fetch hidden notes, proposals, applications, or the group thread itself.
- **Used by:** `ModeratePage`.

## Function: ModerateHandbookPage

- **Purpose:** Next.js page for `/moderate/handbook` (signed-in staff handbook). HTML `/moderate/handbook` is the handbook page, not a GET proxy. Fill `AppShell` (`align="center"`) with `ProfileChromeLeft` top-left, `SignedInChrome` top-right, and `OnboardingGate screen="welcome"` around `ModerateHandbookScreen`. Hub is `/moderate`.
- **Inputs:** None.
- **Returns / side effects:** The handbook screen inside fill AppShell.
- **Used by:** Route `/moderate/handbook`.

## Function: ModerateHandbookScreen

- **Purpose:** Client staff handbook of how 21.gifts works. Staff (`roleAtLeast(..., 'moderator')`) see TOC **Chapters** and three chapters **21.gifts login** (`#login`), **Verified** (`#verified`), **Official funding program** (`#funding`), each with a permalink and `HandbookCopyLink` `tone="app"`. Non-staff signed-in visitors see the heading plus forbidden copy and no chapters. Renders `null` without a session. In-card icon back to `/moderate`. No fetch. On mount and hashchange, scrolls the matching chapter into view when the hash is `#login`, `#verified`, or `#funding`.
- **Inputs:** Session and account from `useAuthStore`; catalog via `useTranslations`.
- **Returns / side effects:** React element or `null` without a session. No network.
- **Used by:** `ModerateHandbookPage`.

## Function: HiddenNotesPage

- **Purpose:** Next.js page for `/moderate/hidden` (signed-in hidden-notes list for moderators). HTML `/moderate/hidden` is the hidden-notes page, not a GET proxy. Fill `AppShell` (`align="center"`) with `ProfileChromeLeft` top-left, `SignedInChrome` top-right, and `OnboardingGate screen="welcome"` around `HiddenNotesScreen`. Hidden HTTP is under `/forum/messages/hidden` (no `route.ts` beside this page).
- **Inputs:** None.
- **Returns / side effects:** The hidden-notes screen inside fill AppShell.
- **Used by:** Route `/moderate/hidden`.

## Function: HiddenNotesScreen

- **Purpose:** Client list of hidden living-room notes. Staff (moderator) fetch `listHiddenMessages` and show the lead copy plus the newest-hidden-first list (a non-interactive **External** badge next to the name when the row has a `via` value) (or empty / loading / try-again). The name and time of each row are a `Link` to `/messages/:id`. The note text sits outside that link in `TranslatableNoteBody` (Languages **Translate** when the text differs from the UI locale). Non-staff signed-in visitors see the heading plus forbidden copy and do not fetch. Renders `null` without a session. In-card icon back to `/moderate`. No un-hide control.

- **Inputs:** Session and account from `useAuthStore`; catalog via `useTranslations`.
- **Returns / side effects:** React element or `null` without a session. Fetches `GET /forum/messages/hidden` only when the role is at least moderator.
- **Used by:** `HiddenNotesPage`.

## Function: ProposalsPage

- **Purpose:** Next.js page for `/moderate/proposals` (signed-in staff confirm/reject queue). HTML `/moderate/proposals` is the queue, not a GET proxy. Fill `AppShell` (`align="center"`) with `ProfileChromeLeft` top-left, `SignedInChrome` top-right, and `OnboardingGate screen="welcome"` around `ProposalsScreen`. Proposal HTTP lives under `/trust/proposals` because Next.js forbids a `route.ts` beside this page. Hub is `/moderate`.
- **Inputs:** None.
- **Returns / side effects:** The open-proposals screen inside fill AppShell.
- **Used by:** Route `/moderate/proposals`.

## Function: ProposalsScreen

- **Purpose:** Client confirm/reject queue of open moderator proposals. Staff (moderator) fetch `fetchTrustProposals` and show subject name, **Proposed by {name}**, time, **Reject** on every open row (`postTrustReject`, including a self-proposal), and **Confirm as moderator** (`postTrustConfirm`) or **Waiting for another moderator to confirm.** when `proposedBy.id === account.id`. Non-staff signed-in visitors see the heading plus forbidden copy and do not fetch. Renders `null` without a session. In-card icon back to `/moderate`. A failed confirm or reject shows `trustChain.actionFailed`.
- **Inputs:** Session and account from `useAuthStore`; catalog via `useTranslations`.
- **Returns / side effects:** React element or `null` without a session. Fetches `GET /trust/proposals` only when the role is at least moderator. Confirm posts `POST /trust/confirm-moderator`; reject posts `POST /trust/reject-moderator`. While either POST is in flight, Confirm and Reject are disabled and Loader2 sits on the pressed action.
- **Used by:** `ProposalsPage`.

## Function: FundingApplicationsPage

- **Purpose:** Next.js page for `/moderate/applications` (signed-in staff grant-application queue). HTML `/moderate/applications` is the queue, not a GET proxy. Fill `AppShell` (`align="center"`) with `ProfileChromeLeft` top-left, `SignedInChrome` top-right, and `OnboardingGate screen="welcome"` around `FundingApplicationsScreen`. Application HTTP lives under `/funding/applications` because Next.js forbids a `route.ts` beside this page. Hub is `/moderate`.
- **Inputs:** None.
- **Returns / side effects:** The open-applications screen inside fill AppShell.
- **Used by:** Route `/moderate/applications`.

## Function: FundingApplicationsScreen

- **Purpose:** Client queue of open 21 gifts grant applications. Staff (founder or moderator) fetch `fetchFundingApplications` and show applicant name (link `/moderate/applications/{id}`), applied time, empty / Loading… / error+Try again. Non-staff signed-in visitors see the heading plus forbidden copy and do not fetch. Renders `null` without a session. In-card icon back to `/moderate`.
- **Inputs:** Session and account from `useAuthStore`; catalog via `useTranslations`.
- **Returns / side effects:** React element or `null` without a session. Fetches `GET /funding/applications` only when the role is founder or moderator.
- **Used by:** `FundingApplicationsPage`.

## Function: FundingApplicationDetailPage

- **Purpose:** Next.js page for `/moderate/applications/[accountId]` (signed-in staff grant-application review). HTML page, not a GET proxy. Fill `AppShell` (`align="center"`) with `ProfileChromeLeft` top-left, `SignedInChrome` top-right, and `OnboardingGate screen="welcome"` around `FundingApplicationDetailScreen`. Application HTTP lives under `/funding/applications/:accountId`.
- **Inputs:** Dynamic `accountId`.
- **Returns / side effects:** The application-detail screen inside fill AppShell.
- **Used by:** Route `/moderate/applications/[accountId]`.

## Function: FundingApplicationDetailScreen

- **Purpose:** Client staff review of one grant application. Staff fetch `fetchFundingApplication` and walk four steps: principles 1–3 against living-room posts (no replies; post text uses `TranslatableNoteBody`, the applicant name stays plain) with **Requirement met** / **Requirement not met**, then whether the posts are true with **Yes** / **No**. **Requirement met** advances; **Requirement not met** or **No** posts `postFundingReject`; **Yes** on the last step posts `postFundingAdmit`. A failed decision shows `trustChain.actionFailed`. Non-staff signed-in visitors see the heading plus forbidden copy and do not fetch. Renders `null` without a session. In-card icon back to `/moderate/applications`. While a POST is in flight, visible decide buttons are disabled and show the Loader2 spinner.
- **Inputs:** `accountId`; session and account from `useAuthStore`; catalog via `useTranslations`.
- **Returns / side effects:** React element or `null` without a session. Fetches `GET /funding/applications/:accountId` only when the role is founder or moderator. Decide buttons only when `grant.status` is `pending` or `trial`. Successful Admit / Reject leaves the buttons disabled and navigates to `/moderate/applications`.
- **Used by:** `FundingApplicationDetailPage`.

## Function: FundingStatusCard

- **Purpose:** Owner profile grant section after the Lightning Address form. `basis` sees not-verified copy and how in-person verification works (no apply). Verified and above see funding status from `account.funding` (missing or `null` treated as `none`): grace copy that daily gifts continue until 25 September 2026, an **About** link to `/about`, and **Apply for the 21 gifts grant** as a `ButtonLink` to `/profile/apply` for `none`/`rejected` (no denial sentence and no conviction titles); pending; one-day trial; or admitted with **Takes part in the 21.gifts funding program** (since {date} when `admittedAt` is a number).
- **Inputs:** Session and account from `useAuthStore`; catalog via `useTranslations`.
- **Returns / side effects:** React element or `null` without a session or account. Apply is a link; it does not POST.
- **Used by:** `ProfileScreen`.

## Function: FundingApplyPage

- **Purpose:** Next.js page for `/profile/apply`. Fill `AppShell` with `ProfileChromeLeft`, `SignedInChrome`, and `OnboardingGate screen="profile"` around `FundingApplyScreen`.
- **Inputs:** None.
- **Returns / side effects:** The apply walk inside fill AppShell.
- **Used by:** Route `/profile/apply`.

## Function: FundingApplyScreen

- **Purpose:** Guided grant apply. Missing About me, photo, or location are the next calm steps (not errors). Then the same four principle/truth questions as staff review against `fetchMemberPosts` (post text uses `TranslatableNoteBody` with `messageId` = `row.id`; the name, location, and About me editor have no Translate control). **Yes** on the last step posts `postFundingApply` and goes to `/profile`. **Requirement not met** / **No** does not apply.
- **Inputs:** Session and account from `useAuthStore`; catalog via `useTranslations`.
- **Returns / side effects:** React element or `null` without a session.
- **Used by:** `FundingApplyPage`.

## Function: aboutMeFilled

- **Purpose:** True when About me is a real bio (not empty or the display-name auto note).
- **Inputs:** `aboutMe`, `name`.
- **Returns / side effects:** boolean.
- **Used by:** `nextFillStep`, `FundingApplyScreen`.

## Function: locationFilled

- **Purpose:** True when location is a non-empty trimmed string.
- **Inputs:** `location`.
- **Returns / side effects:** boolean.
- **Used by:** `nextFillStep`, `FundingApplyScreen`.

## Function: nextFillStep

- **Purpose:** First missing apply fill step: about, photo, then location, or `null` when all three are present.
- **Inputs:** Owner `Account`.
- **Returns / side effects:** `'about' | 'photo' | 'location' | null`.
- **Used by:** `FundingApplyScreen`.

## Function: ModeratorGroupPage

- **Purpose:** Next.js page for `/moderate/group` (signed-in closed moderator group thread). HTML `/moderate/group` is the group page, not a GET proxy. Fill `AppShell` (`align="center"`) with `ProfileChromeLeft` top-left (`backHref="/moderate"`, `backLabelKey="moderate.heading"` — the only back control), `SignedInChrome` top-right, and `OnboardingGate screen="welcome"` around `ModeratorGroupScreen`. Group HTTP lives under `/conversations/moderator-group` (no `route.ts` beside this page).
- **Inputs:** None.
- **Returns / side effects:** The moderator group screen inside fill AppShell.
- **Used by:** Route `/moderate/group`.

## Function: ModeratorGroupScreen

- **Purpose:** Client closed staff-room thread. Moderators (`roleAtLeast(role, 'moderator')`) fetch `fetchModeratorGroup` then the newest 20-message page with `fetchConversation(session, group.id)` and reuse `InboxScreen` as the open thread (`showFilter` false; `showAmount` false; `showAttach` true; no in-card back; row `name` replaced by the catalog `moderate.groupLabel` so the heading is always **Moderators chat group**). An `IntersectionObserver` on `InboxScreen`'s `nearStartRef` (the eighth grouped bubble from the start, or the first when fewer than eight render) fetches a set `nextCursor` and prepends unique older messages. The cursor load does not blank the thread; while stuck to the bottom, InboxScreen keeps the newest in view. JPEG/PNG/WebP stills (cap 10) via `prepareForumPhoto`; photo-only send allowed. Send is disabled while a pick is still preparing (`posting || preparing`). Thread stills load with `fetchConversationMessagePhoto`. Losing staff while mounted bumps `pickGeneration`, clears drafts/preparing, and revokes blob URLs (same cleanup as unmount); replacing the thread also revokes URLs for stills that are no longer on the message list. Also calls `useLatestRateDay()` and passes `rateDay` to `InboxScreen`. After a successful group+thread load: `markConversationRead`, `bumpUnreadAppBadgeEpoch`, `refreshUnreadAppBadge(session, undefined, 0)` (staff-room unread 0; inbox still fetched). Other signed-in visitors see heading **Moderators chat group** plus `moderate.groupForbidden` and do not fetch. Renders `null` without a session. Back to `/moderate` is the page chrome (`ProfileChromeLeft` `backHref="/moderate"`), never in the card. While the staff room is open and the tab is visible, the newest page is fetched every 5 seconds and unseen messages are appended; a hidden tab does not poll, and a failed poll keeps the thread.
- **Inputs:** Session and account from `useAuthStore`; catalog via `useTranslations`.
- **Returns / side effects:** React element or `null` without a session. Fetches `GET /conversations/moderator-group` then `GET /conversations/:id?limit=20` (optional `cursor` for older pages) only when the role is at least moderator. After a successful group+thread load: `markConversationRead`, `bumpUnreadAppBadgeEpoch`, `refreshUnreadAppBadge(session, undefined, 0)` (staff-room unread 0; inbox still fetched). Posts `{ text, photo?, photos? }` and GETs conversation photos. Losing staff (or unmount) revokes blob URLs and invalidates an in-flight pick.
- **Used by:** `ModeratorGroupPage`.

## Function: fetchModeratorGroup

- **Purpose:** GET `/conversations/moderator-group` with Bearer and parse `{ conversation }` via `conversationResponseSchema`. Returns the singleton closed staff-room row (`kind` `moderator_group`).
- **Inputs:** Session token.
- **Returns / side effects:** Conversation row, or throws visitor copy.
- **Used by:** `ModeratorGroupScreen`, `InboxLoader` (`/messages` unlisted `?c=` guard for a moderator), `useUnreadCount` (staff unread), `refreshUnreadAppBadge` (when `moderationUnreadOverride` is omitted and `roleAtLeast(account?.role, 'moderator')`), and `NotificationsLoader` (remaining badge after mark-all-read, staff only).

## Function: listHiddenMessages

- **Purpose:** GET `/forum/messages/hidden` with Bearer and parse `hiddenListSchema.messages`. HTTP 401/403 throw `Failed to list hidden notes: status`; other failures visitor copy `Could not load hidden notes. Please try again.`
- **Inputs:** Session token.
- **Returns / side effects:** Hidden-note array, or throws.
- **Used by:** `HiddenNotesScreen`.

## Function: HandbookScreensPage

- **Purpose:** Next.js page for `/handbook/screens`. Loads screen-variant topics (with English descriptions from `screens.md` via `parseScreenVariantDescriptions`) and renders the compact-card `HandbookImageViewer`.
- **Inputs:** None.
- **Returns / side effects:** The screens handbook screen inside `MarketingLayout`.
- **Used by:** Route `/handbook/screens`.

## Function: HandbookFunctionsPage

- **Purpose:** Next.js page for `/handbook/functions`. Functions markdown only (id prefix `functions`).
- **Inputs:** None.
- **Returns / side effects:** The functions handbook screen.
- **Used by:** Route `/handbook/functions`.

## Function: HandbookEndpointsPage

- **Purpose:** Next.js page for `/handbook/endpoints`. Markdown only; no image switches.
- **Inputs:** None.
- **Returns / side effects:** The endpoints handbook screen.
- **Used by:** Route `/handbook/endpoints`.

## Function: HandbookImageViewer

- **Purpose:** Nested handbook screens for the **selected** combo only (`makeCombo(viewport, theme)`): three-level contents (chapter → screen → variant) and compact `HandbookFigure` cards. Left/Right arrows (and lightbox chevrons) step through every visible variant in a shared lightbox. A topic missing that combo is omitted. Global Desktop/Mobile and Light/Dark switches use the union of remaining topics and appear only when both sides exist.
- **Inputs:** `topics` (`HandbookTopic[]` with required `description`).
- **Returns / side effects:** React element or `null` when no topic has combos. Empty visible list still shows switches when remaining is non-empty. No network.
- **Used by:** `HandbookScreensPage`.

## Function: HandbookOutline

- **Purpose:** Sticky three-level table of contents: chapter (first path segment), screen route, variant id. Links to `#chapter-…`, `#screen-…`, and the figure hash.
- **Inputs:** `chapters` (`HandbookOutlineChapter[]`), `title` (already translated Contents label).
- **Returns / side effects:** Nav labeled **Contents**, or `null` when empty. No network.
- **Used by:** `HandbookImageViewer`.

## Function: HandbookSectionHeading

- **Purpose:** Chapter (`h2`) or screen (`h3`) permalink heading with `HandbookCopyLink`.
- **Inputs:** `level` (2 or 3), `id`, `label`.
- **Returns / side effects:** Heading row. No network.
- **Used by:** `HandbookImageViewer`.

## Function: buildHandbookOutline

- **Purpose:** Group topics into chapter → screen → variant, preserving catalog order. Skips empty `combos`. Chapter is `screenChapter` (first path segment; `/` stays `/`).
- **Inputs:** `topics` (`HandbookTopic[]`).
- **Returns / side effects:** `HandbookOutlineChapter[]`. No network.
- **Used by:** `HandbookImageViewer`.

## Function: nextOutlineIndex

- **Purpose:** Next slide index for Left/Right gallery stepping. Closed gallery (`current === null`): Right → 0, Left → last. Wraps. Empty list stays 0.
- **Inputs:** `length`, `current` (`number | null`), `direction` (`1` or `-1`).
- **Returns / side effects:** Index. No network.
- **Used by:** `HandbookImageViewer`.

## Function: topicPath

- **Purpose:** Route half of a catalog topic id. An empty slice (`:variant`) is `/`.
- **Inputs:** Catalog topic id.
- **Returns / side effects:** Path string (`/` when the slice is empty). No network.
- **Used by:** `buildHandbookOutline`.

## Function: topicVariant

- **Purpose:** Variant half of a catalog topic id.
- **Inputs:** Catalog topic id.
- **Returns / side effects:** Variant string, or empty. No network.
- **Used by:** `buildHandbookOutline`.

## Function: screenChapter

- **Purpose:** Chapter key for a screen path (`/setup/rules` → `/setup`; `/` → `/`).
- **Inputs:** Screen route.
- **Returns / side effects:** Chapter label. No network.
- **Used by:** `buildHandbookOutline`.

## Function: pathAnchor

- **Purpose:** Hyphenated hash fragment for a screen path (`/` → `root`, `/setup/rules` → `setup-rules`). Dynamic segments like `[accountId]` become `accountId`.
- **Inputs:** Route string.
- **Returns / side effects:** Anchor string. No network.
- **Used by:** `topicAnchor`, `buildHandbookOutline`.

## Function: HandbookFigure

- **Purpose:** Compact handbook image card: permalink label + `HandbookCopyLink`, ~220px preview button that opens `HandbookLightbox` unless `onOpen` is set, and a written description. Scrolls into view when `location.hash` matches `#id`.
- **Inputs:** `id`, `label`, `description`, `src`, `alt`, optional `onOpen` (when set, the preview delegates and skips the local lightbox).
- **Visible UI:** Label link, copy-link icon, thumbnail image inside an aria-labeled open button (no visible open-image catalog string), description paragraph, optional lightbox.
- **Returns / side effects:** An `<article>` with `id`. Hash scroll on mount/`hashchange`. No network.
- **Used by:** `HandbookImageViewer` and `HandbookMarkdown` (image-only paragraphs).

## Function: HandbookLightbox

- **Purpose:** Full-size handbook image overlay on marketing tokens (`bg-ink`, `border-paper/10`, `bg-app-overlay` scrim, ghost `IconButton` + `X`). Close via X, backdrop click, or Escape. Optional previous/next chevrons when `onPrevious`/`onNext` are set. Focuses the close control on open. Not a native `<dialog>`.
- **Inputs:** `open`, `src`, `alt`, `onClose`, optional `onPrevious`, optional `onNext`.
- **Returns / side effects:** `role="dialog"` overlay when `open`, otherwise `null`. Document keydown while open. No network.
- **Used by:** `HandbookFigure`, `HandbookImageViewer`.

## Function: topicAnchor

- **Purpose:** Stable DOM/hash id from a catalog topic id (`${route}:${variant}`). Path `/` → `root`; other paths drop the leading `/` and replace remaining `/` with `-`; variant is the segment after the last `:`.
- **Inputs:** Catalog topic id string (`/:default`, `/welcome:pay-qr`, `/handbook/screens:dark`, …).
- **Returns / side effects:** Anchor string (`root-default`, `welcome-pay-qr`, `handbook-screens-dark`, …). No network.
- **Used by:** `buildHandbookOutline`.

## Function: parseScreenVariantDescriptions

- **Purpose:** Parse `docs/handbook/screens.md` into a map of catalog topic id → English description. Under each `## Screen:` / `### Variant:`, collect paragraphs (excluding image-only lines), unwrap `**bold**` and `` `code` ``, join with a blank line; skip empty strings.
- **Inputs:** Raw screens handbook markdown string.
- **Returns / side effects:** `ReadonlyMap<string, string>` keyed as `<path>:<variantId>`. No network.
- **Used by:** `HandbookScreensPage` (`loadScreenTopics`).

## Function: topicImageSrc

- **Purpose:** Public URL for one topic combo PNG under `/handbook-images/`.
- **Inputs:** Topic and combo id.
- **Returns / side effects:** Path string. No network.
- **Used by:** `HandbookImageViewer`.

## Function: comboViewport

- **Purpose:** Viewport half of a combo id.
- **Inputs:** Combo id.
- **Returns / side effects:** `'desktop'` or `'mobile'`.
- **Used by:** `HandbookImageViewer`.

## Function: comboTheme

- **Purpose:** Theme half of a combo id.
- **Inputs:** Combo id.
- **Returns / side effects:** `'light'` or `'dark'`.
- **Used by:** `HandbookImageViewer`.

## Function: makeCombo

- **Purpose:** Build a combo id from viewport and theme.
- **Inputs:** Viewport and theme.
- **Returns / side effects:** Combo id.
- **Used by:** `HandbookImageViewer`.

## Function: defaultCombo

- **Purpose:** First combo to show (`desktop-light` when present, else the first listed, else `null`).
- **Inputs:** Combo id list.
- **Returns / side effects:** Combo id or `null`.
- **Used by:** `HandbookImageViewer`.

## Function: DeletePostControl

- **Purpose:** Inline moderator post or nested-reply deletion with confirmation, pending and error states.
- **Inputs:** messageId, onDeleted, optional kind (`'post'` default, `'reply'` for nested replies); reads the current account and Bearer session.
- **Returns / side effects:** Hidden for other roles; idle trash sits in the note footer icon row (parent) or the nested reply action row (`kind="reply"`); confirming wraps to the next line via `basis-full w-full`. Idle/confirm/error copy is `forum.delete*` for posts and `forum.deleteReply*` for replies. Calls deleteMessage on explicit confirmation, then onDeleted. Error keeps the post or reply and permits retry.
- **Used by:** `ForumBoard` on the parent footer and on nested reply cards.

## Function: deleteMessage

- **Purpose:** Send a moderator hide request for a forum message (top-level note or nested reply).
- **Inputs:** sessionToken and messageId.
- **Returns / side effects:** DELETE `/forum/messages/:id`; resolves on 204 or already-missing 404, throws on other statuses or network errors. Hide/omit semantics: the API keeps the row with `deleted_at` and omits it from GET.
- **Used by:** `DeletePostControl`.

## Function: proxyForumMessageGet

- **Purpose:** Forward an authenticated GET `/messages/:id` for the app path `/forum/messages/:id`. Staff sessions receive soft-hidden rows.
- **Inputs:** Incoming Request (Bearer) and `messageId`.
- **Returns / side effects:** Proxied GET `/messages/:id` with encoded id and authorization.
- **Used by:** App Router `GET` on `/forum/messages/[id]`.

## Function: proxyMessagesDelete

- **Purpose:** Forward a moderation DELETE to the API.
- **Inputs:** Incoming Request and messageId.
- **Returns / side effects:** Proxied DELETE `/messages/:id`, with encoded id, authorization and upstream status. Upstream 204 hides the row (`deleted_at`); the row stays and is omitted from GET.
- **Used by:** App Router `DELETE` on `/forum/messages/[id]`.

## Function: detectNoteLanguage

- **Purpose:** Detect the language of a forum note after stripping URLs and bolt11 invoices. Scores `en` / `de` / `es` / `fil` stopwords (with extra weight for German umlauts and Spanish `ñ¿¡`).
- **Inputs:** Raw note `text` string.
- **Returns / side effects:** `en`/`de`/`es`/`fil` when one UI locale wins, `other` when the text is long enough but not those four, or `null` when empty or fewer than 12 Unicode letters or digits after stripping URLs and invoices. No I/O.
- **Used by:** `shouldOfferNoteTranslate`.

## Function: shouldOfferNoteTranslate

- **Purpose:** Decide whether to offer **Translate** for this note in the active UI locale.
- **Inputs:** Raw note `text` and the active UI `locale`.
- **Returns / side effects:** `false` when detection is `null` or equals `locale`; `true` for `other` or a different UI locale. No I/O.
- **Used by:** `NoteTranslate`.

## Function: fetchTranslateAvailable

- **Purpose:** Query same-origin GET `/translate` and cache the shared promise. Failures and non-`{ available: true }` bodies resolve to `false`.
- **Inputs:** None.
- **Returns / side effects:** `Promise<boolean>`. One in-flight GET is reused for the module lifetime. Does not throw.
- **Used by:** `NoteTranslate` on mount.

## Function: translateNote

- **Purpose:** POST `{ messageId, target }` to same-origin `/translate` (api cache-first DeepL) and return the translated body.
- **Inputs:** `translateNote(messageId, target, session?)` — forum message UUID, the active UI `target` locale, and optional session Bearer. A non-empty string is sent as `Authorization: Bearer …` (hidden staff permalink). Omitted, null, or empty leaves the request unsigned so public notes still work.
- **Returns / side effects:** The `translatedText` string. Throws when the route is non-2xx or `translatedText` is missing, not a string, or empty after trim.
- **Used by:** `NoteTranslate` on **Translate**.

## Function: proxyTranslateAvailableGet

- **Purpose:** Same-origin GET `/translate` → api GET `/translate`.
- **Inputs:** Incoming `Request`.
- **Returns / side effects:** Upstream `{ available }`, or 502.
- **Used by:** App Router GET `/translate`.

## Function: proxyTranslateNotePost

- **Purpose:** Same-origin POST `/translate` `{ messageId, target }` → api `POST /messages/:id/translate`.
- **Inputs:** Incoming `Request` with JSON `{ messageId, target }`.
- **Returns / side effects:** `{ translatedText, cached }` or 400/404/503/502 from the 21.gifts api.
- **Used by:** App Router POST `/translate`.

## Function: proxyTranslateConversationMessagePost

- **Purpose:** Same-origin POST `{ target }` to api `POST /conversations/:id/messages/:messageId/translate`.
- **Inputs:** Incoming `Request`, `conversationId`, and `messageId` from the route segments.
- **Returns / side effects:** `{ translatedText, cached }` or 400 when the body is not JSON or `target` is not a string. Otherwise the upstream response.
- **Used by:** App Router POST `/conversations/[id]/messages/[messageId]/translate`.

## Function: translateConversationMessage

- **Purpose:** POST `{ target }` to the same-origin conversation translate route and return the stored-message translation.
- **Inputs:** `conversationId`, `messageId`, UI `target` locale, and the bearer `session`. An empty session omits Authorization.
- **Returns / side effects:** `{ translatedText, cached }`. Throws when the route is non-2xx or `translatedText` is missing, not a string, or blank.
- **Used by:** `NoteTranslate` when `source.kind` is `conversation`.

## Function: NoteTranslate

- **Purpose:** Control-only client: **Translate** (Languages `IconButton`, `aria-label` `forum.translate`), **Show original**, **Show translation**, error, and spinner. Does not render `ForumNoteText` or the translated body — exclusive original XOR translation lives in `TranslatableNoteBody`, or in the parent that owns `showingTranslation` (inbox list preview and notification rows). Offers the control when the note language differs from the active UI locale and GET `/translate` reports available. Identity is `source + messageId + text + locale` (not `text + locale` alone). **Translate** sits in the card footer icon row with react / pay / copy when `placement` is `row` (ForumBoard supplies a `controlSlotId` to `TranslatableNoteBody`, which portals this control there); otherwise under the body (unsigned cards, inbox, notifications, About me, funding, hidden notes). Failure shows **Could not translate this note. Please try again.** and keeps Translate.
- **Inputs:** Required `messageId` (stored forum or conversation message id) and `text` (raw prose body). Optional `source` (default `{ kind: 'message' }`, or `{ kind: 'conversation', conversationId }`). Optional `tone` (`default` | `onButton`, for `bg-app-btn` bubbles). Optional `placement` (`block` under the body, default; `row` uses `display: contents` so the icon sits in a parent footer flex row). Parent-owned `showingTranslation` (true while the translated body is on screen). `onTranslated` after a successful POST. `onToggleShowing` for **Show original** / **Show translation**. No `plain`, `bodyClassName`, or `onShowingTranslation`.
- **Returns / side effects:** The control, or `null` when the text is blank, translation is unavailable, or `shouldOfferNoteTranslate` is false. Calls `fetchTranslateAvailable` on mount and, on click, `translateNote` for a forum message or `translateConversationMessage` for a conversation message. A change of `source`, `messageId`, `text`, or UI locale resets status and invalidates in-flight requests (`identity = source + messageId + text + locale`). Stops click/keydown so forum expand does not fire. `onButton` paints the control with `text-app-btn-fg`. Does not mount the note body.
- **Used by:** `TranslatableNoteBody`, the inbox list preview in `InboxScreen`, and post/reply rows in `NotificationsScreen`.

## Function: TranslatableNoteBody

- **Purpose:** Exclusive original XOR translated body in the same React commit (not a parent `useEffect` after paint). Idle and error keep the original. **Show original** restores the original and hides the translation. Identity is `source + messageId + text + locale`. Holds `translatedText` and `showingTranslation`; a successful POST sets both so the original unmounts in that commit.
- **Inputs:** Required `messageId` (stored forum or conversation message id) and `text`. Optional `source` (default forum message, or `{ kind: 'conversation', conversationId }`). Optional `plain`. Optional `truncate` (default true; applies only to the original body — `ForumNoteText` vs `LinkedText`). A visible translation always goes through `ForumNoteText` (Show more). Optional `className` (default `whitespace-pre-wrap text-sm text-app-fg`; `text-app-btn-fg` selects NoteTranslate `tone="onButton"`). Optional `formatTranslated` (applied only to the visible translation, not the original; not part of the identity key). Optional `controlSlotId` (when set, portals `NoteTranslate` with `placement="row"` into that element; if the node is missing, the control is omitted rather than stacked).
- **Returns / side effects:** Original or translated paragraph plus the translate control, or `null` when `text` is empty. Mounts `NoteTranslate` under the body, or portals it into `controlSlotId` when that node exists. Visible body is original XOR translation in the same commit. Idle/error keep original; **Show original** restores original and hides translation.
- **Used by:** `ForumBoard` (notes and replies, including `via === 'nostr'`), `PublicMessageLoader`, `ForumQuotedBody`, `QuotedForumNote` (any caption when `translate` is true; `plain` only when `via === 'nostr'`), `AboutMeSection`, `HiddenNotesScreen`, `FundingApplyScreen`, and `FundingApplicationDetailScreen`.

## Function: HappylandSection

- **Purpose:** Presents Father Severin's account of Happyland after How it works on the public homepage.
- **Input:** Receives the marketing page locale and reads all paragraphs, headings and image descriptions from the shared English, German, Spanish or Filipino catalog.
- **Output:** Renders an accessible section with eight full-proportion photographs in a lead image, alternating text and image groups, and a portrait row that stacks on small screens.

## Function: HappylandPhoto

- **Purpose:** Keeps each Happyland photograph and its localized caption together in a semantic figure.
- **Input:** Receives approved image metadata, the active message catalog and optional layout classes.
- **Output:** Renders a directly served WebP with intrinsic dimensions, descriptive alternative text and a visible caption. Eager loading keeps the photographs visible in the embedded local preview.

## Function: fiatDraftForSats

- **Purpose:** Fiat typing draft for an exact sat amount. Two decimals when they round-trip through `fiatToSats`, otherwise more fraction digits so toggling back returns the same sats. Null when no digit count does.
- **Inputs:** Whole `sats`, gift `day` or null, fiat `code`.
- **Returns / side effects:** A plain dot-decimal string, or null when the day or that currency cannot be used. No I/O.
- **Used by:** `AmountEntry`, `ForumLoader`.

## Function: fiatToSats

- **Purpose:** Inverse of `satsToFiatAmount` on the same gift-day totals. A positive amount that rounds to 0 becomes 1 sat.
- **Inputs:** Fiat `amount`, gift `day` or null, fiat `code`.
- **Returns / side effects:** Whole sats, or null when the day or that currency is missing or zero. No I/O.
- **Used by:** `parseAmountDraft`.

## Function: parseAmountDraft

- **Purpose:** Reads a bitcoin or fiat typing draft into whole sats. Blank is empty. Fiat allows a dot or comma and at most eight fraction digits, so a unit toggle can round-trip.
- **Inputs:** `unit` (`btc` or `fiat`), raw `draft`, gift `day` or null, fiat `code`.
- **Returns / side effects:** `{ kind: 'empty' }`, `{ kind: 'invalid' }`, or `{ kind: 'sats', sats }`. No I/O.
- **Used by:** `AmountEntry`, `replySatsFromDraft`, `paySatsFromDraft`, `parseForumAskAmountInUnit`, `PayLinkScreen`, `PosScreen`.

## Function: replySatsFromDraft

- **Purpose:** Reply and inbox amount. Blank stays empty. Zero is billed as 1 sat.
- **Inputs:** Raw `draft`, typing `unit`, gift `day` or null, fiat `code`.
- **Returns / side effects:** Whole sats, `empty`, or `invalid`. No I/O.
- **Used by:** `ForumLoader`, `MemberProfileScreen`, `PublicMessageThread`, `InboxLoader`.

## Function: paySatsFromDraft

- **Purpose:** Pay-sheet amount. A blank field is 21 sats in either typing unit. Zero or a bad draft is invalid.
- **Inputs:** Raw `draft`, typing `unit`, gift `day` or null, fiat `code`.
- **Returns / side effects:** Whole sats, or `invalid`. No I/O.
- **Used by:** `ForumLoader`, `MemberProfileScreen`, `PublicMessageThread`.

## Function: parseForumAskAmountInUnit

- **Purpose:** Ask amount in the active typing unit. Bitcoin uses `parseForumAskAmount`. Fiat converts, then the same 1..10_000_000 range.
- **Inputs:** Raw draft, `unit`, gift day or null, fiat code.
- **Returns / side effects:** Whole sats in range, or null. No I/O.
- **Used by:** `ForumAskWizard`, `ForumLoader`.

## Function: setAmountUnit

- **Purpose:** POST `/me/amount-unit` with JSON `{ unit }` (`btc` or `fiat`) and the bearer session.
- **Inputs:** Session token and `unit`.
- **Returns / side effects:** Parsed owner `Account`. Throws when the response is not ok or fails `accountSchema`.
- **Used by:** `AmountEntry`.

## Function: setAccountLocale

- **Purpose:** POSTs an account language preference to same-origin `/me/locale`.
- **Inputs:** Bearer session token, locale code, and `onlyIfUnset` boolean.
- **Returns / side effects:** Sends JSON `{ locale, onlyIfUnset }`, returns the parsed owner `Account`, and throws on an invalid or failed response.
- **Used by:** Language controls and `AccountPreferenceSync`.

## Function: setAccountFiat

- **Purpose:** POSTs an account fiat preference to same-origin `/me/fiat`.
- **Inputs:** Bearer session token, `CHF|EUR|USD|PHP`, and `onlyIfUnset` boolean.
- **Returns / side effects:** Sends JSON `{ fiat, onlyIfUnset }`, returns the parsed owner `Account`, and throws on an invalid or failed response.
- **Used by:** `FiatPreferenceSwitcher` and `AccountPreferenceSync`.

## Function: proxyMeAmountUnitPost

- **Purpose:** Same-origin Bearer proxy of api POST `/me/amount-unit` with JSON `{ unit }`.
- **Inputs:** Incoming `Request` with Bearer session and JSON `{ unit }`.
- **Returns / side effects:** Upstream `Response` via `proxyApiRequest`.
- **Used by:** Route POST `/me/amount-unit`.

## Function: proxyMeLocalePost

- **Purpose:** Same-origin Bearer proxy of api POST `/me/locale`.
- **Inputs:** Incoming `Request` with JSON `{ locale, onlyIfUnset }`.
- **Returns / side effects:** Returns the owner-account upstream response; `onlyIfUnset=true` preserves a stored locale.
- **Used by:** Route POST `/me/locale`.

## Function: proxyMeFiatPost

- **Purpose:** Same-origin Bearer proxy of api POST `/me/fiat`.
- **Inputs:** Incoming `Request` with JSON `{ fiat, onlyIfUnset }`.
- **Returns / side effects:** Returns the owner-account upstream response; `onlyIfUnset=true` preserves a stored fiat value.
- **Used by:** Route POST `/me/fiat`.
