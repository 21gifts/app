# Functions

## Function: PosPage

- **Purpose:** App Router page for `/pos`. Wraps `PosScreen` in `AppShell` and `OnboardingGate screen="profile"`.
- **Inputs:** None.
- **Returns / side effects:** The page element. No direct I/O.
- **Used by:** Route `/pos`.

## Function: PosAmountPage

- **Purpose:** App Router page for `/pos/amount`. Wraps `PosAmount` in `AppShell` and `OnboardingGate screen="profile"`. The top-left arrow returns to the previous in-app view in this tab, or `/welcome` when this tab has none. It does not jump to `/pos`.
- **Inputs:** None.
- **Returns / side effects:** The page element. No direct I/O.
- **Used by:** Route `/pos/amount`.

## Function: PosScreen

- **Purpose:** Signed-in QR page on `/pos`. Renders `PosTill`.
- **Inputs:** None.
- **Returns / side effects:** The till card.
- **Used by:** `/pos`.

## Function: PosAmount

- **Purpose:** Amount-only card on `/pos/amount`. Keypad and **Create payment**. No QR and no address. A failed till load shows the alert and **Try again**. A created charge, an already open (pending) charge, or a member who cannot charge returns to `/pos`; a paid charge does not.
- **Inputs:** None. Reads the auth store.
- **Returns / side effects:** React element. Calls `createPosCharge`. On success, `router.replace('/pos')`. A `WalletRequiredError` (api `code` `wallet_required`) shows **Set up your wallet first.**, a `CannotReceiveError` (api `code` `cannot_receive`) shows **Your wallet cannot receive this payment right now. Please try again later.**; the other refusals keep their own catalog lines.
- **Used by:** `PosAmountPage`.

## Function: PosTill

- **Purpose:** The QR card on `/pos` only. Centered truncated 21.gifts address, the same Open CryptoPay QR as the profile card including on a smartphone, content-width **Set an amount** linking to `/pos/amount` when no charge is open, otherwise the open charge (countdown, including 0:00, sat amount, default fiat when a spot rate exists, and Cancel) until the server returns no charge. While that charge is open, and for one minute after it ran out (the api still marks a payment confirmed after the end as paid, and shows a paid charge for one minute), it asks `fetchPosState` every three seconds, also after the refresh at expiry returned no charge; a failed poll is dropped and the next one tries again. Cancel stops asking. A charge the api returns as `paid` shows **Paid ✓** (`role="status"`), the sat amount, default fiat when a spot rate exists, and **New payment** linking to `/pos/amount`, without Cancel, countdown, or **Set an amount**; the poll stops. A slower refresh cannot replace a newer create or cancel, and an older till read that answers late cannot replace a newer one (such as a paid charge). No keypad on this card. The wallet does not mount this card. Without a username it shows **Set a username first.** linking to `/profile`. With a username but no verified in-app wallet (`sparkWalletVerified` not true) it shows **Set up your wallet first.** linking to `/wallet`, and **Set an amount** stays hidden; charging needs both a username and a verified wallet.
- **Inputs:** None. Reads the auth store.
- **Returns / side effects:** React element. Calls `fetchPosState` and `cancelPosCharge`. Once the till has loaded, renders `PosHistory` under the card's other content with the `history` of the latest till answer, so the list changes with every answer the till applies: the poll that sees the charge paid, the reload after Cancel, and the refresh at expiry.
- **Used by:** `PosScreen`.

## Function: PosHistory

- **Purpose:** Past till charges under the `/pos` QR and charge, newest first, as the api returns them. Heading **History**. Each row: the status (**Paid ✓** with the local time it was paid, in green; **Paid ✓** alone when the api sent no valid `paidAt`; **Expired**; or **Cancelled**), the amount in bitcoin with the default fiat from the current spot rate, and the date and time the charge was created. The open charge is shown above the list and is left out of it. Any other `pending` row is shown as **Expired**, because the api has at most one open charge and returns it as `charge`. With no past charge: **No payments yet.** The api returns at most its newest 20 charges; the list shows what it returns and has no paging.
- **Inputs:** `history` (`PosCharge[]` from `GET /pos/charge`), `openChargeId` (the charge shown as open above, or `null`), `rateDay` (current spot rate, or `null`; without it each row is bitcoin only).
- **Returns / side effects:** A section named **History**. No I/O.
- **Used by:** `PosTill`.

## Function: resetPosTillWriteForTests

- **Purpose:** Drop the module-level till write so a later test does not wait on a request the previous test left hanging.
- **Inputs:** None.
- **Returns / side effects:** Sets the in-flight write to null. Production clears that write when the request settles.
- **Used by:** `PosScreen` tests.

## Function: fetchPosState

- **Purpose:** `GET /pos/charge` for the signed-in till.
- **Inputs:** Bearer `sessionToken`.
- **Returns / side effects:** `{ charge, history }`. A charge is `pending`, `paid`, `cancelled`, or `expired`, with `paidAt` (ISO string, or `null`; `null` also when the api does not send it). `charge` is the pending charge, or one paid within the last minute. Throws when the response is not OK.
- **Used by:** `PosTill`, `PosAmount`.

## Function: createPosCharge

- **Purpose:** `POST /pos/charge` with `{ amountSats }`.
- **Inputs:** Bearer `sessionToken` and a whole sat amount.
- **Returns / side effects:** The created charge. Throws `WalletRequiredError` or `CannotReceiveError` on a 400 whose `code` is `wallet_required` or `cannot_receive` (via `throwIfWalletAnswer`), recognised by the body's `code` only; otherwise throws with the API error string or a status fallback.
- **Used by:** `PosAmount`.

## Function: cancelPosCharge

- **Purpose:** `DELETE /pos/charge`.
- **Inputs:** Bearer `sessionToken`.
- **Returns / side effects:** Resolves when the open charge is cancelled. Throws otherwise.
- **Used by:** `PosTill`.

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

- **Purpose:** Shared export name for App Router GET handlers. Healthz and `/maps/key` use `export function GET` (`/maps/key` is always 200 `{ key: string | null }`); same-origin api proxies re-export unique functions as `GET` (including `/forum/messages`, `/forum/messages/places` which re-exports `proxyMessagesPlacesGet`, `/forum/messages/hidden` which re-exports `proxyMessagesHiddenGet`, `/forum/notifications` which re-exports `proxyNotificationsGet`, `/messages/[id]/photo`, `/messages/[id]/photo/[file]` (`{1-9}.{jpg|jpeg|png|webp}`, proxy always requests `{n}.jpg` from the api), `/conversations/[id]/messages/[messageId]/photo`, `/conversations/[id]/messages/[messageId]/photo/[file]` (`{1-9}.{jpg|jpeg|png|webp}`, proxy always requests `{n}.jpg` from the api), `/messages/[id]/[file]`, `/messages/[id]/repayment` which re-exports `proxyMessagesRepaymentGet`, `/view-key/[viewKey]`, `/push/vapid-public`, `/trust/graph`, `/trust/proposals` which re-exports `proxyTrustProposalsGet`, `/funding/applications` which re-exports `proxyFundingApplicationsGet`, `/funding/daily-roster` which re-exports `proxyFundingDailyRosterGet`, and `/funding/applications/[accountId]` which calls `proxyFundingApplicationGet`). `/translate` re-exports `proxyTranslateAvailableGet` (api GET `/translate`). HTML `/messages` is the inbox page, not a GET proxy. HTML `/notifications` is the notifications page, not a GET proxy. HTML `/moderate` is the moderation hub, not a GET proxy. HTML `/moderate/hidden` is the hidden-notes page, not a GET proxy. HTML `/moderate/proposals` is the confirm/reject queue, not a GET proxy. HTML `/moderate/applications` is the grant-application queue, not a GET proxy. HTML `/grants/payments/comment` and `/grants/payments/amounts` are the daily payment pages, not GET proxies. HTML `/moderate/applications/[accountId]` is the grant-application review, not a GET proxy. HTML `/moderate/group` is the closed staff-room page, not a GET proxy. The signed-in HTML page `/trust-chain` is `TrustChainPage`, not this GET. `GET /l/[code]` redirects an 8-hex short code or calls `notFound()`. `GET /links/[code]` re-exports `proxyShortLinkGet`. HTML `/pos` is the till page, not a GET proxy; `GET /pos/charge` re-exports `proxyPosGet`. `/forum/messages/[id]/edits` re-exports `proxyMessagesEditsGet`.
- **Inputs:** Incoming `Request` on proxy routes (plus async `params` on dynamic photo, `/messages/[id]/photo/[file]` (`id` + `file` matching `{1-9}.{jpg|jpeg|png|webp}`; proxy always requests `{n}.jpg` from the api), `/conversations/[id]/messages/[messageId]/photo` (`id` + `messageId`), `/conversations/[id]/messages/[messageId]/photo/[file]` (`id` + `messageId` + `file` matching `{1-9}.{jpg|jpeg|png|webp}`; proxy always requests `{n}.jpg` from the api), file, and view-key); none on healthz or `/maps/key`; `/translate` takes the incoming `Request`.
- **Returns / side effects:** `Response`. Healthz is `{ status: 'ok' }` 200; `/maps/key` is always 200 `{ key: string | null }`; `/translate` is 200 `{ available: boolean }` or 502; proxies return the upstream api response (JSON or raw photo/video bytes).
- **Used by:** Container probes, browser/wallet same-origin calls, and `fetchTranslateAvailable` via `GET /translate`. `GET /.well-known/nostr.json` proxies NIP-05. `GET /.well-known/lnurlp/[username]` proxies LUD-16. `GET /lnurlpay/[pubkey]/metadata` (async `pubkey`) calls `proxyLnurlpayMetadataGet` for the in-app wallet; `GET /lnurlp/[username]/invoice` (async `username`, query unchanged) and `GET /verify/[paymentHash]` (async `paymentHash`) call `proxyLnurlpInvoiceGet` and `proxyVerifyGet` for payers' wallets and answer with `Access-Control-Allow-Origin: *`.

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

- **Purpose:** Multipart `POST /forum/messages` with `video` + optional `poster`, optional `goalCurrency` and `goalAmount` (trimmed draft, comma stays; omitted from the form when either is missing, and on replies), optional `placeLat` / `placeLng` / `placeLabel` (only when a pin is set; replies must not send them), and optional `shopUsername` (leading `@` stripped; omitted when blank). Not `goalSats`.
- **Inputs:** session token, `{ text, video, poster?, goalCurrency?, goalAmount?, place?, shopUsername? }`.
- **Returns / side effects:** `ForumMessage`. On 400, 404, or 429 uses the api error string when present; otherwise throws `Could not post your message`. On 403 (the post needs a Bitcoin payment) throws `PostFeeRequiredError` with `Could not post your message`.
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

- **Purpose:** Render parsed handbook markdown as Tailwind-styled headings, paragraphs, lists, links, and images. A link to an in-app path (`/…`, not `//…`) is a client-side `next/link`; a hash or another site stays a plain anchor. Every heading has a sibling `HandbookCopyLink`. A paragraph whose only inline is an image becomes a `HandbookFigure` (thumbnail, lightbox, deep link) instead of `<p><img>`.
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

- **Purpose:** Renders gift KPIs (`formatBitcoin(totalSats)` plus `formatFiatDisplay` of the preferred fiat from `useFiatPreference`; a null fiat total is `—`, not `CHF 0`) and SVG diagrams (cumulative spend over time, by person, by month), plus loading/error/empty states. FiatPicker (CHF | EUR | USD | PHP) above the KPI cards **only when unsigned** (`useHydrateSession().ready && session === null`). Signed-in visitors still display and scale with the preferred code and cannot change it here. **Total spend over time** links each non-zero UTC day on the chart (not as a wrapping text list) to `/stats/{day}` with a client-side `next/link` (no prefetch). Each of **Total spend over time**, **By person**, and **By month** uses `SegmentedControl tone="gift" shell="dark"` for ₿ | {preferred FiatCode} via BarScale `'btc' | 'fiat'` (default ₿). Over time shows one cumulative series. Person and month rescale bar size while labels stay both units. Footnote is the USD daily-close sentence, or `{code} is USD at each gift's UTC-day close, converted with that day's ECB rate.` for CHF/EUR/PHP.
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

- **Purpose:** Next.js page for `/`. Marketing landing: pitch, how it works, why, project donate (`#project`, only when the build names the platform account: `projectDonateAddress` gives `<platform username>@<request host>`, the platform account's own in-app wallet address, shown as a generic `lightning:` link from `lightningHref`, for running 21.gifts itself — distinct from `/donate` forum gifts; without a platform username the section is left out), FAQ, CTAs to `/login` (**Ask for help**) and `/donate` (**Send help**), plus `PwaInstall` (`tone="dark"` `placement="hero"`) after Send help, all via `translate` for the negotiated locale.
- **Inputs:** None. Calls `getRequestLocale()` and reads the request host (`x-forwarded-host` first, then `host`, without a port); only `21.gifts` and its subdomains are taken from the request, any other or missing host yields `21.gifts`, so a forged header cannot change the donation address.
- **Returns / side effects:** The home screen element. Step 2 of how it works shows the example address `you@21.gifts`.
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
- **Returns / side effects:** React element or `null` when logged out. POST `/me/location` on save or clear. Merges only `location` so a concurrent name write is not overwritten.
- **Used by:** `ProfileScreen` on `/profile`. `FundingApplyScreen` renders it in the apply walk, which is shown while applications are paused only for a verified account named `joey-rosima`, `vincent`, or `jewel-bacolbas` with status `none` or `rejected`, and, when the switch is off, for a verified account with status `none` or `rejected`.

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
- **Used by:** `FiatPreferenceSwitcher`, `AccountActivityChart`, `ForumBoard`, `PublicMessageLoader`, `StatsDashboard`, `DayLoader`, `WalletBalance`, `WalletPay`, `WalletSend`.

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

- **Purpose:** Login UI: an idle card with primary **Log in** (authenticate-first), the muted line `login.newHere` (**New to 21.gifts?**), and secondary **Open a new account** (opens the name form without a passkey prompt), an account-choice card after browser `NotAllowedError` (**Log in with existing account** / **Open a new account**), an unknown-passkey card after authenticate finish `Unknown credential` (heading `login.unknownHeading`, muted `login.unknownBody`, **Open a new account** and secondary **Try again** that calls `passkey.login`; dismissing the Try again login prompt stays on this card and does not open the account-choice card), preparing, error, or an in-app browser escape card via `InAppBrowserView` (**Open in browser** + **Copy link**, no passkey ceremony). After success, `OnboardingGate` leaves `/login`. **Open a new account** opens the name form. Passkey and account exist only after a valid name is submitted and the create ceremony is finished. Error uses `login.error` plus **Try again**, except a wrong-account 403 (`wrongAccount` or passkey error equal to that api string) which uses `login.wrongAccount` with the same layout. **Try again** on that hint calls `clearWrongAccount` then `passkey.login` (never `retry`, so it cannot create another account). Generic errors still call `passkey.retry`. When a new account's passkey gives no PRF output (`passkey.error` is `wallet.prfUnsupported`), the alert is `wallet.prfUnsupported` (**This phone or browser cannot hold a 21.gifts wallet. Please use an up-to-date phone or browser that supports passkeys.**) instead of `login.error`; **Try again** still calls `passkey.retry`. A dismissed prompt, a network error, or any other failure keeps its own copy. When the mounted user agent is iOS below 18, Start, Choice, and Unknown show a muted `login.iosVersion` line (installed version and minimum iOS 18). When the mounted user agent is Android below 9, Start, Choice, and Unknown show a muted `login.androidVersion` line (installed version and minimum Android 9). iOS is chosen when both would match. The alert is that same sentence when `passkey.error` is `login.iosVersion` or `login.androidVersion`, and the muted line is then hidden. Other errors keep their own copy and still show the muted line. The line is absent until after mount. Desktop pictures omit it. Phone pictures include it, because those baselines use an iPhone user agent below iOS 18.
- **Inputs:** Uses `usePasskeyLogin`, `useAuthStore`, `isInAppBrowser`, `iosPasskeyBlock`, `androidPasskeyBlock`, and `InAppBrowserView`.
- **Returns / side effects:** React element covering idle/choice/unknown/name/starting/error/wrong-account/in-app. A signed-in account shows the preparing spinner until redirect. Detects in-app browsers after mount; never starts WebAuthn from the in-app card.
- **Used by:** Screen `/login`.

## Function: LoginPage

- **Purpose:** Next.js page for `/login`. The visible heading lives in `LoginCard` (`login.heading`).
- **Inputs:** None.
- **Returns / side effects:** `AppShell` with `ProfileChromeLeft` (wordmark `HomeWordmark`: `/` unsigned, `/welcome` when a session is hydrated) and `LanguageSwitcher` top-right, wrapping `OnboardingGate` around `LoginCard`. The arrow returns to the previous in-app view, or `/welcome` when this tab has none. Signed-in visitors are sent to `/setup/name`, `/setup/username`, `/setup/rules`, or `/welcome`. The recovery phrase is not part of that path.
- **Used by:** Route `/login`.

## Function: DonatePage

- **Purpose:** Next.js page for `/donate`. Guest-visible Send help explainer: pick a forum message, then send Bitcoin; CTA to `/welcome`. No address/amount form and no QR.
- **Inputs:** None. Calls `getRequestLocale()` for localized copy.
- **Returns / side effects:** `AppShell` with `ProfileChromeLeft` (wordmark `HomeWordmark`: `/` unsigned, `/welcome` when a session is hydrated) and `LanguageSwitcher` top-right; heading, lead, **Open the forum** `ButtonLink`. The arrow returns to the previous in-app view, or `/welcome` when this tab has none. No OnboardingGate.
- **Used by:**
  - **Route `/donate`**
  - **Home CTA `home.ctaSend`**
  - **LanguageSwitcher on `/donate`**

## Function: RulesSetup

- **Purpose:** Third post-login screen: one living-room rules chapter at a time. Intermediate **Continue** clicks only advance the chapter. The last **I agree to these rules** POSTs and merges `rulesAgreedAt`, `setup`, and `missing` into the auth-store account.
- **Inputs:** `chapters` — ordered server-rendered `RulesDocument` elements (one per `RULES_CHAPTER_IDS` id).
- **Returns / side effects:** Heading, prompt, progress, current chapter, error alert, full-width **Continue** until the last chapter, then **I agree to these rules** with the line **By continuing you accept the Terms of Use.** above it (`setup.termsBefore`, a `next/link` to `/terms` labelled `nav.terms`, `setup.termsAfter`; no checkbox). Clicking that link keeps the chapter index in module memory of this tab, and the next mount reopens it once (clamped to the chapters given), so the arrow back from `/terms` lands on the same chapter. Wordmark is a non-link span. Chapter 0 shows one arrow that returns to the previous in-app view in this tab, or `/welcome` when this tab has none, through `goToPreviousView` with the client-side router (no document load). Later chapters replace that arrow with the previous-chapter arrow. One arrow. Continue and Back also reset the fill inner scroller to the top. POSTs `/me/rules-agreement` via `agreeToRules` only on the last chapter. Renders `null` without a session or when `chapters` is empty.
- **Used by:** Screen `/setup/rules`.

## Function: RulesSetupPage

- **Purpose:** Next.js page for `/setup/rules`.
- **Inputs:** None. Calls `getRequestLocale()` / `getCatalog` for the rules body.
- **Returns / side effects:** Fill `AppShell` (`align="start"`) with `SignedInChrome` top-right and `OnboardingGate` around `RulesSetup` (`RULES_CHAPTER_IDS` mapped to `RulesDocument` chapters, `showNav={false}`, `chapter={id}`). `RulesSetup` portals the one top-left arrow: chapter 0 returns to the previous in-app view, or `/welcome` when this tab has none; later chapters reuse that slot for the previous chapter.
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

- **Purpose:** Username field and **Continue**. Posts `POST /me/username`. Cannot skip. Once the account's wallet is verified (`sparkWalletVerified`), the field shows the current username, field and **Continue** are disabled, and one line says the username can no longer be changed because the wallet address uses it.
- **Inputs:** Auth store session; optional `onSaved`.
- **Returns / side effects:** Taken/invalid/request stay on the form. Success updates the store and calls `onSaved`.
- **Used by:** `UsernameSetup`, `RequirementsOverlay`.

## Function: UsernameSetup

- **Purpose:** Post-login screen to choose the unique `@21.gifts` username. Cannot skip. The address hint is left out once the account's in-app wallet is verified (`sparkWalletVerified`).
- **Inputs:** Auth store session; `UsernameForm`.
- **Returns / side effects:** Heading **Your 21.gifts name**, hint (left out once the wallet is verified), field, **Continue**. Posts `POST /me/username`. Taken/invalid stay on the form.
- **Used by:** Screen `/setup/username`.

## Function: UsernameSetupPage

- **Purpose:** Next.js page for `/setup/username`.
- **Inputs:** None.
- **Returns / side effects:** `AppShell` with `ProfileChromeLeft` top-left (non-link `Wordmark` span) and `SignedInChrome` top-right, and `OnboardingGate` around `UsernameSetup`. The arrow returns to the previous in-app view, or `/welcome` when this tab has none.
- **Used by:** Route `/setup/username`.

## Function: NameSetupPage

- **Purpose:** Next.js page for `/setup/name`.
- **Inputs:** None.
- **Returns / side effects:** `AppShell` with `ProfileChromeLeft` top-left (non-link `Wordmark` span) and `SignedInChrome` top-right, and `OnboardingGate` around `NameSetup`. The arrow returns to the previous in-app view, or `/welcome` when this tab has none.
- **Used by:** Route `/setup/name`.

## Function: openInSystemBrowser

- **Purpose:** Best-effort handoff from an in-app WebView to the system browser so the visitor can complete a passkey login or invite claim in Safari or Chrome.
- **Inputs:** Absolute `https` login `url`, and optional `SystemBrowserHost` (`win`; defaults to `globalThis.window`). Missing window is a no-op.
- **Returns / side effects:** On Android, sets `location.href` to a Chrome Intent URL with an encoded fallback. Else if `Telegram.WebApp.openLink` is a function, calls it. Else on iOS Telegram (JS bridges or UA `Telegram`), sets `location.href` to `x-safari-` + `url`. Otherwise calls `host.open(url, '_blank', 'noopener,noreferrer')`. No network of its own.
- **Used by:** `InAppBrowserView` **Open in browser** (via `LoginCard` and `ViewProfileClaim`), the `/login` and `/view/[viewKey]` in-app e2e flows, and handbook coverage for those in-app variants.

## Function: OnboardingGate

- **Purpose:** Hydrates the session and sends the visitor to the matching post-login screen (or keeps a complete account on `/profile`, `/wallet`, and `/members/[accountId]`).
- **Inputs:** `screen` (`login` / `wallet` / `name` / `username` / `rules` / `welcome` / `profile`), `children`, and optional `allowGuest`. Members use `screen="profile"`. `/wallet` uses `screen="wallet"`. `/welcome` passes `allowGuest`.
- **Returns / side effects:** Children on the correct screen, otherwise a spinner. Follows `nextOnboardingPath`. The recovery phrase is not a setup step and does not replace the opened page; `nextOnboardingPath` never returns `/wallet`. `/wallet` itself stays on screen when `setup` is `'wallet'` or the next step is `/welcome`. `allowGuest` on `/welcome` renders the children with no session instead of `/login`. Profile and members stay only when the next step is `/welcome`. Name, username, and rules still redirect when that is the next step. There is no address step. Other `router.replace` targets are `/login`, `/setup/name`, `/setup/username`, `/setup/rules`, or `/welcome` (`nextOnboardingPath` never returns `/profile`).
- **Used by:** Screens `/login`, `/wallet`, `/setup/name`, `/setup/username`, `/setup/rules`, `/welcome`, `/profile`, `/pos`, `/members/[accountId]`, `/contact`, `/messages`, `/notifications`, `/moderate`, `/moderate/hidden`, `/moderate/proposals`, `/grants`, `/grants/apply`, `/grants/applications`, `/grants/applications/[accountId]`, `/trust-chain`, `/shops`, `/statistics`.

## Function: SignedInChrome

- **Purpose:** Top-right signed-in chrome: one **Menu** control. Open, the panel starts with `MenuAccountHeader` (photo, name, @username, balance, Received / Given / Posts) and a divider, then icon+label dropdown rows (Home `/welcome` lucide `Home` `nav.home` first — an unmodified primary click first clears this tab's in-app view stack with `resetViewHistory`, then the link opens `/welcome` client-side (no document load, so the unlocked wallet stays); when the path is already `/welcome`, Home `preventDefault`s, records the current `/welcome` path as the only view with `recordCurrentView`, and dispatches `FORUM_HOME_EVENT` instead of a no-op navigation; a modified click (Cmd, Ctrl, Shift, Alt, or another button) leaves the stack alone. The browser's own history is not touched; then **Balance** (`/wallet`, lucide `Wallet`, `wallet.balanceHeading`); **Shops** (`/shops`, lucide `Store`, `nav.shops`); **Point of sale** (`/pos`, lucide `Banknote`, `pos.nav`); User Profile (`/profile`, lucide `User`, `profile.title`) with no given or received amounts; **Grants** (`/grants`, lucide `HandCoins`, `nav.grants`) for every signed-in member; **Settings** (`/settings`, lucide `Settings`, `nav.settings`); ScrollText Living room rules `/rules`; **Habit-Tracker** (`/habit-tracker`, lucide `ListChecks`, `nav.habitTracker`); **Trust Chain**; **Statistics** (`/statistics`, lucide `BarChart3`, `nav.statistics`) for every signed-in account, immediately after Trust Chain, with no unread count; **Moderation** (`/moderate`, lucide `Shield`, `nav.moderate`) only when `roleAtLeast(account?.role, 'moderator')` — `aria-label` `nav.moderateUnread` with `{ count }` when `moderationUnreadCount` > 0 (staff-room unread plus open-proposal count) else `nav.moderate`; visible `nav.moderate` plus `ml-auto` tabular-nums count when > 0; **Notifications** (`/notifications`, lucide `Bell`, `nav.notifications`, unread count `ml-auto` only when `unreadCount` > 0, `aria-label` `nav.notificationsUnread` then); Messages `/messages` (`nav.inbox`, unread count `ml-auto` only when inbox unread > 0, `aria-label` `nav.inboxUnread` then); MessageCircle Contact `/contact`; optional Download **Install app** via `PwaInstall` `placement="menu"` when install is offered; LogOut log out; then a quiet Version line (`app.version`, `getAppVersion()`)). On mount with a session, calls `resyncPushSubscription`. Clicking Notifications asks for OS permission via `enablePush` when it is not already granted and Service Worker plus `PushManager` exist (otherwise resync, which no-ops without those APIs). On the forum home (`/welcome`) only, when `account.setup` is null and `account.hasPosted` is false, also mounts `IntroduceYourselfOverlay`; it never covers `/wallet`, `/wallet/*`, `/pos*`, `/profile*`, `/messages*`, the setup flow, or any other screen (Close dismisses this mount only; **Write an introduction** calls `requestForumCompose`, so the next mount starts with the dialog dismissed).
- **Inputs:** Session `account` and `session` from `useAuthStore` and the path from `usePathname` (introduce overlay gate: path `/welcome` only; push resync; Home on `/welcome`). Home clears the view stack through `resetViewHistory` and `recordCurrentView`. Composes `useUnreadCount(open)` (default write-badge: writes the home-screen badge), `PwaInstall` (`placement="menu"`, closes Menu via `onMenuAction`), and `LogoutButton` inside the Menu dropdown.
- **Returns / side effects:** A `flex items-center` row with the relative **Menu** button (`aria-expanded`, `aria-controls`) in the AppShell page-frame header (`[data-app-chrome]`). The panel stays mounted. Wide (frame content box at least 576px; until `frameWidth` is measured, `matchMedia('(max-width: 36rem)')`, and a missing `matchMedia` counts as wide): it portals to the trigger parent as `absolute right-0 z-50 mt-2 w-72` (18rem, not a percentage, because a percentage would resolve against the trigger). When that wide panel's bottom would pass the window, the same panel uses `mt-0`, `px-2 py-0`, and the version line uses `py-0`. Rows stay `min-h-11`. If that compact panel still passes the window and a non-negative lift keeps the bottom inside, it is a `fixed` overlay. Its `style` sets the measured `top`, `left`, and `width` so the bottom sits on the window and the top is never less than 0. That `left` is the trigger parent's right edge minus the panel width, so a horizontal move of the frame does not keep the last inline left. It does not scroll, and it does not shorten a row. When that lift would still leave the bottom outside, the wide menu uses the same sheet as a narrow frame (`w-full`, `html[data-menu-sheet='1']`, scrolling only inside its own border) and does not use a negative top. The Menu button is `relative z-[60]` only while that fixed overlay is up, so a click on Menu still closes it when the panel covers the button, and a dialog in the same header still covers Menu. A window resize or a later change in the panel's own size measures again. The panel returns to `mt-2` and `p-2` only when the compact box still has 48px of room under the window, so the two layouts do not alternate. The scrim `#signed-in-menu-scrim` portals to `[data-menu-scrim-host]` inside `[data-app-frame]` as `absolute inset-0 z-40 rounded-3xl` (the radius is set on the scrim; the host is `display: contents`, so `inherit` would be 0). Narrow (content box under 576px): it portals to `[data-menu-sheet-host]` (`px-5`, the same horizontal inset as `[data-scroll-page]`) inside the one scrollport as `w-full` and stays in that host while closed (`hidden`), reads the scrollport `scrollTop` before it sets `html[data-menu-sheet='1']` (which hides `[data-scroll-page]`), sets that scroll position to 0, and writes the saved position back after the page is shown again. While `html[data-menu-sheet='1']` is set, the host is `height: 100%` with `padding-bottom: 1.25rem` and the panel `max-height: 100%`, so the open sheet ends above the shell footer (Receive / Send or a page CTA) instead of running under it. While open as a sheet (narrow, or that tall wide fallback) the panel carries `data-scrollport` and is bound with `bindScrollport` in a layout effect, so it is the active scrollport and its last row (the Version line) scrolls into view while the page port is locked; closing releases it with `releaseScrollport` and clears its `data-scroll-active` / `data-scroll-locked` marks, and the page port is active again. The panel is not wrapped in `Scrollport`, which would bind for as long as the panel is mounted. Not a body portal. `PwaInstall` stays mounted via the `hidden` class when closed. When open: `MenuAccountHeader` (mounted with the panel, also while closed, so its data loads when the chrome mounts; `tight` follows the compact wide layout; following its balance link closes the Menu) and an `aria-hidden` `border-t` divider when the account is loaded or a stored session is still being checked (`loadSession`; signed out, neither shows), so the header holds its place in a Menu opened right after a page load, then icon+label rows: **Home** (`/welcome`, lucide `Home`, `nav.home`) first, **Balance** (`/wallet`, lucide `Wallet`, `wallet.balanceHeading`), **Shops** (`/shops`, lucide `Store`, `nav.shops`), **Point of sale** (`/pos`, lucide `Banknote`, `pos.nav`), Profile link (`/profile`, lucide `User`, `profile.title`) with no given or received amounts, **Grants** (`/grants`, lucide `HandCoins`, `nav.grants`) for every signed-in member, **Settings** (`/settings`, lucide `Settings`, `nav.settings`), **Living room rules** (`/rules`), **Habit-Tracker** (`/habit-tracker`, lucide `ListChecks`, `nav.habitTracker`), **Trust Chain** (`/trust-chain`), **Statistics** (`/statistics`, lucide `BarChart3`, `nav.statistics`) for every signed-in account, immediately after Trust Chain, with no unread count, **Moderation** (`/moderate`, lucide `Shield`, `nav.moderate`) only when `roleAtLeast(account?.role, 'moderator')` — `aria-label` `nav.moderateUnread` with `{ count }` when `moderationUnreadCount` > 0 (staff-room unread plus open-proposal count) else `nav.moderate`; visible `nav.moderate` plus `ml-auto` tabular-nums count when > 0, **Notifications** (`/notifications`, lucide `Bell`, `nav.notifications`, unread count on the right when greater than zero), **Messages** (`/messages`, `nav.inbox`, inbox unread count on the right when greater than zero), **Contact** (`/contact`), optional **Install app**, and log out, then a quiet Version line (`app.version`, `getAppVersion()`). Escape always closes Menu and restores focus to Menu. Local `useState` dismissed flag for `IntroduceYourselfOverlay` (initialized from `consumeSkipIntroduceOverlay`); does not write `forumLawsDismissed` or any account field.
- **Used by:** `NameSetupPage`, `UsernameSetupPage`, `RulesSetupPage`, `WelcomePage`, `ShopsPage`, `PosPage`, `ProfilePage`, `GrantsPage`, `FundingApplyPage`, `WalletPage`, `SettingsPage`, `MemberProfilePage`, `ContactPage`, `MessagesPage`, `NotificationsPage`, `ModeratePage`, `HiddenNotesPage`, `ProposalsPage`, `FundingApplicationsPage`, `FundingApplicationDetailPage`, `TrustChainPage`, `StatisticsPage`, `HabitTrackerPage`, `RulesPageChrome`, `PublicMessageChrome`.

## Function: MenuAccountHeader

- **Purpose:** The card at the top of the signed-in Menu. First row: the profile photo (`h-10 w-10` round, `profile.about.portraitAlt`) or, without one, the first letter of the name (else of the username) in a round `bg-app-border` badge; the display name (`text-sm` semibold) and `@username` (`text-xs` muted), both truncated; and in the right corner the wallet balance small: the `formatBitcoin` amount (`text-base` semibold) over the default-fiat amount (`text-xs` muted, empty only without a usable rate), right-aligned and never wrapping, as a `next/link` to `/wallet` that closes the Menu. While the wallet connects (or is ready without a balance) the corner holds two skeleton bars of the same size (`role="status"`, accessible name `wallet.connecting`); locked, error, or no wallet show nothing there. Second row: a three-column `dl` **Received** (`profile.legendReceived`), **Given** (`profile.legendGiven`), and **Posts** (`nav.posts`). Received and Given show the ₿ total with the default fiat on a small line under it (current spot rate). Every line keeps its final height from the first render: skeleton bars (`animate-pulse`, still under reduced motion) while loading, the values once loaded, and `–` for a value that could not be read, so nothing below moves. Compact (`tight`) adds `mt-2`, because the compact wide panel has no top padding.
- **Inputs:** `onNavigate` (closes the Menu), `tight`, and `open` (whether the Menu is open). Reads `session` and `account` from `useAuthStore`, the stored session (`loadSession`), `useWallet`, `useSpotRate`, `useNumberFormat`, and `useFiatPreference`.
- **Returns / side effects:** The card while the Menu is open (skeleton lines while its numbers load), or `null` while the Menu is closed or when signed out (no session in the store and none stored, `loadSession`); it still starts loading while closed. Until the account is loaded (right after a page load, while the stored session is still being checked), the open card already has its final size: a round `h-10 w-10` skeleton for the photo, skeleton bars in the `h-5` name line and the `h-4` `@username` line (the same heights the name and username lines keep once loaded), and the stats row's skeletons, so the Menu rows under it do not move when the account arrives. On mount with a session it loads, in parallel, `GET /pictures/me` (`fetchProfilePhoto`; a non-image answer counts as no photo, shown through an object URL), `GET /me/activity` (`fetchAccountActivity`, given and received totals), and `GET /forum/members/:id` (`fetchMember`, `postCount`). A complete load is kept for the session in module memory (a later mount on the next screen shows it at once and asks nothing); two mounts at once share one load; when the activity or the member read failed, the next mount asks again. A newer session's load revokes the previous photo URL. A load that settles after unmount is dropped. Nothing waits for these reads.
- **Used by:** `SignedInChrome`.

## Function: ProfilePage

- **Purpose:** Next.js page for `/profile`.
- **Inputs:** None.
- **Returns / side effects:** `AppShell` with `ProfileChromeLeft` top-left, `SignedInChrome` top-right, and `OnboardingGate` around `ProfileScreen`.
- **Used by:** Route `/profile`.

## Function: ProfileChromeLeft

- **Purpose:** Shared top-left chrome: one icon-only arrow (44px, ArrowLeft) plus a wordmark. The arrow returns to the previous in-app view in this tab, or `/welcome` when this tab has none. One arrow. The wordmark is not that control. An ask-wizard or shop-wizard override replaces the history link with a button. The arrow is a `next/link`: it opens that view with the client-side router, never with a document load, so tab memory such as the unlocked wallet stays. Optional `onBackClick` runs on an unmodified click and returns `true` when it took an in-page step (wallet hides the words, closes a send step, or returns from Send or Receive to the wallet home); `false` lets the arrow leave. Optional `wordmark` replaces the default wordmark. Optional `wordmarkHref` defaults to `/welcome` and is ignored when `wordmark` is set. `tone="dark"` is the ink marketing header. `hideHistoryArrow` omits the history arrow whatever this tab's view stack holds (`/welcome`); a wizard override still shows.
- **Inputs:** Optional `onBackClick` (`() => boolean`), `wordmark`, `wordmarkHref`, `tone`, and `hideHistoryArrow`; catalog via `useTranslations`; previous path via `previousViewPath`.
- **Returns / side effects:** A link (`profile.back` when this tab has no earlier view, otherwise `nav.back`), the override button, or no arrow when `hideHistoryArrow` is set and no override is armed, plus the wordmark. The first client render matches SSR (`/welcome`, `profile.back`) unless `hideHistoryArrow` hides that arrow. An unmodified primary click calls `onBackClick` first; when it returns `true` the link does not follow its href. Otherwise the click marks the href with `markBackNavigation` and the link opens it client-side. Modified clicks follow the href. No network.
- **Used by:** `ProfilePage`, `WelcomePage`, `MarketingHeader`, `LoginPage`, `DonatePage`, `PayLinkScreen`, `ViewProfilePage`, `NameSetupPage`, `UsernameSetupPage`, `WalletChromeLeft`, `WalletScreenView` (the visible `/wallet` Back, via `AppShellTopLeft`), `ShopsPage`, `GrantsPage`, `FundingApplyPage`, `MemberProfilePage` (`/members/[accountId]`), `ContactPage`, `MessagesPage` (via `MessagesChromeLeft`), `MessagesChromeLeft`, `NotificationsPage`, `ModeratePage`, `HiddenNotesPage`, `ProposalsPage`, `FundingApplicationsPage`, `FundingApplicationDetailPage`, `ModeratorGroupPage`, `TrustChainPage`, `RulesPageChrome`, `PublicMessageChrome`. `WalletPage` mounts `WalletChromeLeft` as page `topLeft`; the card's registration wins while Wallet is shown.

## Function: resetWalletReturn

- **Purpose:** Clear the stored `/wallet` return path. The top-left arrow does not read this slot. It returns to the previous in-app view in this tab, or `/welcome` when this tab has none.
- **Inputs:** None.
- **Returns / side effects:** `void`. Drops the shared tab slot and `sessionStorage` key `21gifts.walletReturn`. Does not touch `localStorage`.
- **Used by:** Wallet return tests, `RememberWalletReturn` tests, `WalletChromeLeft` tests (`afterEach`).

## Function: rememberWalletReturn

- **Purpose:** Remember a safe in-app path (not Wallet itself) as the `/wallet` back target. Rejects protocol-relative URLs, `..`, whitespace, `#`, overlong paths, and `/wallet` itself without clobbering a previous good path.
- **Inputs:** `path` string (pathname, optionally with a query string).
- **Returns / side effects:** `void`. Writes a `globalThis` slot and `sessionStorage` (`21gifts.walletReturn`) so every copy of the module in this tab sees the same path. No `localStorage`. No-op during SSR.
- **Used by:** `RememberWalletReturn`.

## Function: walletBackHref

- **Purpose:** Read the path `rememberWalletReturn` stored, or `/welcome` when this tab has not stored one. The visible top-left arrow does not use this value. That arrow uses the in-app view stack.
- **Inputs:** None (reads the shared tab slot, which loads `sessionStorage` the first time).
- **Returns / side effects:** The stored path string, or `WALLET_BACK_FALLBACK` (`/welcome`). No network. The chrome arrow does not read this value.
- **Used by:** Unit tests of the wallet-return slot. Not the chrome arrow.

## Function: RememberWalletReturn

- **Purpose:** Client recorder mounted in the root layout. On each pathname/search change, calls `rememberWalletReturn` with the current in-app path. The top-left arrow does not read this slot.
- **Inputs:** `usePathname` and `useSearchParams`. Non-empty query is appended as `?…`.
- **Returns / side effects:** `null`. Calls `rememberWalletReturn` during render and again from an effect. No network.
- **Used by:** `RootLayout` (inside `ThemeProvider`, wrapped in `Suspense`).

## Function: PushOpenListener

- **Purpose:** Listens for `21gifts-push-open` from the service worker and calls `router.push` only for a same-origin path, so an already open installed phone page can follow the notification URL. On mount, when the page becomes visible, and when it returns from the back-forward cache, it also opens a path the worker stored in the `21gifts-push-open` cache (at most 60 seconds old) in case a frozen page missed the message. A query may contain `://`. The page answers the worker; if that answer does not arrive and the window cannot navigate, the worker opens the href. Each click has its own id, and only that id is dropped after the page follows it.
- **Inputs:** `MessageEvent` on `navigator.serviceWorker`, plus a JSON `{ url, at, id }` cache record at `/push-open/{id}`. Accepts only `data.type === '21gifts-push-open'` with a string `data.url` that starts with `/`, contains no `\`, and parses as this origin. A query or hash may contain `://`. Drops a missing, stale, future, or unsafe cache record. A click id that is no longer the stored id is left in place.
- **Returns / side effects:** `null`. Navigates with `router.push` when the path is a same-origin in-app URL; ignores anything else. No network.
- **Used by:** `RootLayout` (inside `ThemeProvider`, after `AccountPreferenceSync`).

## Function: WalletChromeLeft

- **Purpose:** Page `/wallet` chrome. Renders `ProfileChromeLeft` only. The arrow returns to the previous in-app view in this tab, or `/welcome` when this tab has none. One arrow. The wordmark is not that control.
- **Inputs:** None. The previous path comes from the view stack inside `ProfileChromeLeft`.
- **Returns / side effects:** `ProfileChromeLeft`. The card's Back replaces this one while Wallet is shown. No network.
- **Used by:** `WalletPage`.

## Function: MessagesChromeLeft

- **Purpose:** Client `/messages` chrome. Always renders `ProfileChromeLeft`. It does not read `?c=` and it does not send every open thread to `/messages`. The view stack does: a thread opened from the list returns to the list; a thread opened from somewhere else returns there.
- **Inputs:** None.
- **Returns / side effects:** `ProfileChromeLeft`. The arrow returns to the previous in-app view in this tab, or `/welcome` when this tab has none. One arrow. The wordmark is not that control. No network.
- **Used by:** `MessagesPage`.

## Function: previousViewPath

- **Purpose:** Read the in-app path this tab showed immediately before the current view. The top-left arrow uses it. The wordmark is not that control.
- **Inputs:** None. Reads the tab slot. When the slot is missing, reads `21gifts.viewHistory` and restores it. An empty store stays missing.
- **Returns / side effects:** The previous path, or `null` on the server and when this tab has no earlier in-app view. No network.
- **Used by:** `ProfileChromeLeft`, `RulesSetup`.

## Function: goToPreviousView

- **Purpose:** Leave for the previous in-app view in this tab, or open `/welcome` when this tab has none. Does not jump to a fixed parent, does not leave the site, and does not load a new document, so tab memory such as the unlocked wallet stays.
- **Inputs:** `push`, the client-side navigation (`useRouter().push`). Reads `previousViewPath`.
- **Returns / side effects:** Marks the target with `markBackNavigation`, then `push` of the previous path, or `push('/welcome')` when this tab has none. Does not call `history.back()` (a browser back step can leave the site when the current entry replaced an outside referrer) and does not pop the stack before the router arrives, so a second click pushes the same path. The record that arrives there steps the cursor back. No network.
- **Used by:** `RulesSetup` (the chapter 0 arrow).

## Function: markBackNavigation

- **Purpose:** Mark the path the top-left arrow is opening, so the view stack steps back instead of growing when that view records.
- **Inputs:** The in-app path the arrow opens: the previous view, or `/welcome`.
- **Returns / side effects:** Keeps the mark in module memory for a client-side navigation and in `sessionStorage` (`21gifts.viewHistoryBack`) for a router that falls back to a document load. A record of the view being left (a re-render before the router arrives) keeps the mark. The record that arrives at the marked path steps the cursor back to it, or makes it the only view when there was no earlier one. A record of any other path drops the mark and pushes. `resetViewHistory` drops it. No network.
- **Used by:** `ProfileChromeLeft`, `goToPreviousView`.

## Function: recordCurrentView

- **Purpose:** Record the current in-app path on this tab's view stack, or restore a stamped index on browser back and forward. A router `pushState` is a push, even when `history.length` does not grow. A URL-changing `replaceState` replaces the current entry once this document is anchored, so a replaced screen is not a previous view. The first path of a new document, and any path after a client-side navigation, is a push, unless it is the arrow's one-shot target (`markBackNavigation`), which steps the cursor back. Unsafe paths are ignored. A real return to an earlier path is a new entry, not a collapse. The stack caps at 50 once a push is committed. A push that is not yet committed does not drop the oldest view; a later replace collapses that push first. A dropped entry keeps its absolute stamp, so browser back still finds it.
- **Inputs:** A pathname, optionally with a query string. Optional `stampHistory` defaults to true. False updates the stack and does not write `giftsView`, so the history entry being left keeps its stamp.
- **Returns / side effects:** Updates the module slot and `sessionStorage` (`stack` and `cursor`, plus `base` after a capped drop). When `stampHistory` is true, stamps `giftsView` with `history.replaceState` without pushing a history entry. A stored stack that contains an unsafe path is ignored. A thrown storage write leaves the slot intact. No network.
- **Used by:** `ViewHistoryRoot`; `SignedInChrome` (Menu **Home** pressed on `/welcome`, plain click, records that path as the only view).

## Function: resetViewHistory

- **Purpose:** Clear this tab's in-app view stack so the top-left arrow opens `/welcome` until another view is recorded. The signed-in Menu's **Home** calls it, so the first screen opened from the forum home returns to `/welcome`, as on a fresh tab.
- **Inputs:** None.
- **Returns / side effects:** Deletes the module slot, drops a pending arrow target (module copy and `21gifts.viewHistoryBack`), and removes `21gifts.viewHistory` from `sessionStorage`. No network.
- **Used by:** `SignedInChrome` (Menu **Home**, plain click); unit tests that isolate the view stack.

## Function: ViewHistoryRoot

- **Purpose:** Record the current pathname and search on the in-app view stack and provide the chrome back override. The top-left arrow returns to the previous in-app view in this tab, or `/welcome` when this tab has none. One arrow. The wordmark is not that control.
- **Inputs:** `children` — the page tree.
- **Returns / side effects:** `ChromeBackProvider` around `children`. A location recorder writes the stack during render without stamping history, and stamps `giftsView` from a layout effect after the router commits the history entry. A pathname the location has not reached yet is not recorded, so a query is not stored as its own hop. A replace committed after that render collapses the provisional push, so a replaced screen is not a previous view. Search comes from `window.location.search` when it matches the pathname, so a full navigation is stored before the load event. A suspended search recorder re-renders on a query-only change, including a cleared query, and records the live location — the same string as the location recorder, and only once that location has reached the pathname. No network.
- **Used by:** `RootLayout`, inside `ThemeProvider`, beside `RememberWalletReturn`.

## Function: useChromeBack

- **Purpose:** Read and set the top-left arrow override for an in-page step such as the ask wizard, the shop wizard, or a wallet Receive or Send view over `/welcome` (label `nav.back`). Without a provider, the override is null and the setter is a no-op, so a wizard render does not throw.
- **Inputs:** None. Reads `ChromeBackProvider` context when it is present.
- **Returns / side effects:** `{ override, setOverride }`. Does not navigate by itself. No network.
- **Used by:** `ProfileChromeLeft`, `ForumAskWizard`, `ShopAddWizard`, `WelcomeScreen`, the welcome top-left chrome.

## Function: ChromeBackProvider

- **Purpose:** Hold the top-left back overrides, one slot per caller. The chrome arrow runs the latest in-page step instead of the view history; an override marked `over` (a wallet view laid over `/welcome`) beats every page step, even one that registers again after it. Pay-sheet dismiss stays Close (`X`), not this control.
- **Inputs:** `children`.
- **Returns / side effects:** Context provider. Each caller has its own slot. The arrow shows the last set override. Clearing or unmounting a caller restores the previous. No network.
- **Used by:** `ViewHistoryRoot`.

## Function: ProfileScreen

- **Purpose:** Signed-in profile: single `max-w-sm` identity card with a resting header (round profile photo from `GET /pictures/me` and wide image from `GET /banners/me` when that slot is stored; a missing one is the button **Add a profile photo** or **Add a wide image**; choosing a wide image opens a 5:2 cropper in place of **Add a wide image** (**Add a profile photo** stays; **Use this crop** stores the framed JPEG; the X (**Cancel crop**) stores nothing; saving the profile photo, including from About me, reloads the header and leaves that open crop in place; a failed or empty reload clears that header picture, and the Add button stays hidden until the reload settles); neither is the About me photo), a compact Given/Received activity chart, About me (`AboutMeSection` owner: empty prompt + **Write your About me**, or filled text and/or photo + edit; Languages **Translate** on the filled read-only text when `aboutMessageId` is set; the editor is not translatable; copy-profile-link on the card — never a forum post), name, location, then the same public facts as `/members/:id` (`MemberProfileScreen` `factsOnly`: role pill, funding-program icon (pressing it reveals that one sentence; on this screen the pressed result is `funding-program-press`), `username@21.gifts`, pay QR, Shop sticker, Posts/Reactions counts, and the activity feed), then `PushToggle` (Notifications pills: All/Active/Mentions always; This device On/Off when Push APIs are ready), a language settings row (`LanguagePreferenceSwitcher`) after push and before theme, a theme settings row (`ThemeSwitcher`), a fiat settings row (`FiatPreferenceSwitcher`), and a number-format settings row (`NumberFormatSwitcher`) last. Never shows `forum.loading` on the card. The signed-in menu Profile row shows no amounts. Back + wordmark live in `ProfileChromeLeft`.
- **Inputs:** `useAccountTotals` for both `receiveOverTime` and `donateOverTime` (also returns `failed`); pass both to `AccountActivityChart`; `AboutMeSection` (`putAboutMe` text plus optional photo, `fetchAboutMePhoto` when `aboutMeHasPhoto`, `fetchProfilePhoto`, `fetchWideBanner`, `name={account.name}`); `NameForm` and `LocationForm` for edits (there is no address form; the member's only address is `username@21.gifts`, which settles in their in-app wallet); `fetchMember(session, account.id)` then `MemberProfileScreen` with `factsOnly` for the public gifts facts; `PushToggle`; `LanguagePreferenceSwitcher`; `ThemeSwitcher`; `FiatPreferenceSwitcher`; `NumberFormatSwitcher`; catalog via `useTranslations`.
- **Returns / side effects:** When a profile photo or wide image is stored, that header is above the heading (wide image `aspect-[5/2]`, round photo overlapping its lower edge when both exist). Heading **Profile**, compact chart (empty: `profile.chartEmpty` with no chart FiatPicker, no SVG / no ₿|fiat scale; a thrown activity load shows `profile.chartError` (`role="alert"`) instead of `profile.chartEmpty`; in-flight stays `profile.chartEmpty`; never **Loading…**; populated: legend + ₿ | selected fiat + SVG). The only FiatPicker on the card is `FiatPreferenceSwitcher`. About me, name form, location form, then the public member facts (role pill, funding-program icon (pressing it reveals that one sentence; on this screen the pressed result is `funding-program-press`), `username@21.gifts`, QR, Shop sticker, post/reaction counts, and the on-demand feed), then `PushToggle` (Notifications pills), Language (English / Deutsch / Español / Filipino), Theme (System / Light / Dark), Fiat currency (CHF|EUR|USD|PHP), and Number format (`10'000.23` / `10,000.23` / `23.000,33`) as the last settings row — all inside one identity card (no second panel). A failed `fetchMember` shows `forum.error` and **Try again** and leaves the editors up. `MissingRequirementsError` replaces to `/setup/rules`. No Message button and no staff actions. Back + wordmark live in `ProfileChromeLeft`.
- **Used by:** `ProfilePage`.

## Function: AboutMeSection

- **Purpose:** Profile-card About me block: heading plus filled text and/or photo (the note photo shows the whole picture (`object-contain`, `max-h-80`) and is not cropped, not the profile photo or the wide image), or the owner empty prompt (`profile.about.empty` **Tell others who you are.** and labeled **Write your About me**). Filled means trimmed `aboutMe` is a real bio (not the display name) **or** `hasPhoto` is true. Owner mode can edit (write / pencil, save, cancel) via `onSave`. The editor has three separate attaches, each its own ImagePlus and remove: the About me photo (JPEG/PNG/WebP via `prepareForumPhoto`, no video), the round profile photo, and the wide image. Each previews on its own. Choosing a wide image opens a 5:2 cropper above its preview; **Use this crop** stores that JPEG and the X (**Cancel crop**) stores nothing. Closing the editor, or a successful save, drops an unsaved crop. A whole portrait is not stored as the wide image. Optional icon-only copy-profile-link (`profile.copyLink` **Copy link to this profile**) when `profileUrl` is set; the URL is never shown as visible text. Public mode with no filled text, no photo, and no copy URL renders `null`. A filled read-only body uses `TranslatableNoteBody` when `messageId` is a non-empty string; otherwise `LinkedText`. The editor is not translatable.
- **Inputs:** `aboutMe` (`string | null`), `mode` (`owner` | `public`), optional `name` (`string | null`) for the filled comparison (`(name ?? '').trim()`; blank name applies only the trimmed-non-empty check), optional `hasPhoto`, optional `loadPhoto` (`() => Promise<Blob>`), optional `profileUrl`, optional `messageId` (stored About me note id; omitted or blank keeps `LinkedText`), optional `onSave(text, photo?)` (`photo` omitted keeps, `null` clears, object sets), optional `loadPicture` / `onSavePicture` for the round profile photo and optional `loadBanner` / `onSaveBanner` for the wide image (neither is the About me note photo; a non-image blob stays empty), optional `startEditing` to open the owner editor on mount.
- **Returns / side effects:** React element or `null`. Clipboard write for copy. Calls `onSave` on owner save, `onSavePicture` when the profile photo changes, and `onSaveBanner` when the wide image changes. Loads a blob URL when `hasPhoto` and `loadPhoto` are set and revokes it on unmount. Loads and revokes the profile-photo and wide-image blob URLs the same way when `loadPicture` or `loadBanner` is set.
- **Used by:** `ProfileScreen` (owner, `name={account.name}`), `MemberProfileScreen` (public, `name={profile.name}`), `ViewProfileScreen` (public, `name={profile.name}`), and `FundingApplyScreen` (apply walk, shown while applications are paused only for a verified account named `joey-rosima`, `vincent`, or `jewel-bacolbas` with status `none` or `rejected`, and, when the switch is off, for a verified account with status `none` or `rejected`).

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

## Function: pushTagForNotification

- **Purpose:** Collapse tag for one in-app notification, matching the api: `forum_post:<parentId>`, `forum_reply:<replyId>`, `forum_mention:<replyId>`, `zap:<replyId>`, `moderator_appointed:<parentId>`. Any other type, including `moderator_proposal`, is null.
- **Inputs:** `type`, `parentId`, and `replyId`.
- **Returns / side effects:** Tag string or `null`. No network.
- **Used by:** `NotificationsLoader` before it closes the local banner for a row that is not a proposal, and `ForumLoader` after the welcome appointment pill's `markNotificationRead` succeeds.

## Function: currentPushEndpoint

- **Purpose:** Read this browser's Web Push subscription endpoint so a mark-read request can ask the api to skip this device. Calls `getRegistration()` and does not wait on `ready`.
- **Inputs:** None. Uses `navigator.serviceWorker` when it exists.
- **Returns / side effects:** The endpoint string, or `undefined` when Push APIs are missing, the lookup rejects, or the endpoint is empty. Never throws.
- **Used by:** `markNotificationRead`, `markAllNotificationsRead`, `markNotificationsReadForMessage`, and `markVisibleForumNoteRead`.

## Function: closeLocalPushNotifications

- **Purpose:** Close shown Web Push notifications whose tag is in the list, so a note already read on this device does not stay on screen. Calls `getRegistration()` and does not wait on `ready`.
- **Inputs:** Tag strings. An empty list is a no-op.
- **Returns / side effects:** Nothing. Missing `serviceWorker` or `getNotifications` is a no-op. Never throws.
- **Used by:** `markAllNotificationsRead`, `markNotificationsReadForMessage`, `markVisibleForumNoteRead`, `NotificationsLoader` when a row is opened, and `ForumLoader` after the welcome appointment pill's `markNotificationRead` succeeds.

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

- **Purpose:** Push-only service worker at `/sw.js`. A payload whose `type` is `dismiss` closes the named tags, shows and closes a silent `dismiss-ack`, sets the badge to `max(0, floor(unreadCount))` including 0, and returns before the Sunday check. On the device's local Sunday, a push whose `type` is not exactly `conversation` does not stay on screen and does not change the badge: it calls `showNotification` with tag `sunday-quiet` and closes that note in the same `waitUntil`, so the browser does not invent its own banner. Every other push, including a private message, shows a notification (`registration.showNotification`) and, when `navigator.setAppBadge` (or `registration.setAppBadge` as fallback) exists, sets the home-screen badge: floor `payload.unreadCount` first, use it when that integer is greater than 0, otherwise `1`. `setAppBadge` rejections are swallowed so `waitUntil` still follows `showNotification`. Missing `setAppBadge` still shows the notification. A thrown weekday lookup does not pause notifications. No asset or offline cache. A notification click stores a short-lived `21gifts-push-open` entry so a reloaded page can still open the path when `postMessage` was missed.
- **Inputs:** Push `event` with optional JSON payload (`type`, `title`, `body`, `url`, `tag`, `tags`, `unreadCount`).
- **Returns / side effects:** When `type` is `dismiss`, closes the named tags, shows and closes a silent `dismiss-ack`, sets the badge to `max(0, floor(unreadCount))` when `unreadCount` is finite, and returns before the Sunday check. On a non-conversation Sunday push, `event.waitUntil` shows and closes `sunday-quiet`. Otherwise `event.waitUntil` of `showNotification` plus optional `setAppBadge` via `Promise.all`. Install skips waiting; activate claims clients. Notification click closes the note, stores the in-app path in the `21gifts-push-open` cache, then the focused same-origin window (or the first one, if none is focused) is focused and, after that, receives `{ type: '21gifts-push-open', url }` (pathname + search + hash). A page that answers within 500 ms opened the path with its client-side router and is not navigated again, so its document and the unlocked wallet in tab memory stay. A page that does not answer is navigated with `navigate` when that function exists and the URL differs (rejection or null still focuses), otherwise `clients.openWindow` opens the href. No window: `clients.openWindow` on the same-origin href. Empty, invalid, or foreign `data.url` becomes `/welcome`.
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

## Function: iosPasskeyBlock

- **Purpose:** Read an iPhone, iPad, or iPod user agent and decide whether a new account can finish. iOS 18 is the first version with the extra key this sign-in needs. Older iOS returns the installed version and the minimum. Other browsers, iOS 18 or newer, and an iOS user agent with no version token return null.
- **Inputs:** `userAgent` string (`navigator.userAgent`).
- **Returns / side effects:** `{ installed, required }` where `required` is `18` and `installed` is `major.minor` or `major.minor.patch`, or null. No network and no DOM writes.
- **Used by:** `LoginCard` (muted line after mount) and `usePasskeyLogin` (a new account that cannot finish fails with `login.iosVersion` and is not stored).

## Function: iosInstalledVersion

- **Purpose:** Read the installed iOS version from an iPhone, iPad, or iPod user agent, including iOS 18 and newer. `iosPasskeyBlock` still returns null on those newer versions.
- **Inputs:** `userAgent` string.
- **Returns / side effects:** Installed string (`major.minor` or `major.minor.patch`), or null when the token is missing or the browser is not iOS. No network.
- **Used by:** `usePasskeyLogin`, which puts that version at the front of a failed login or register diagnostic.

## Function: androidPasskeyBlock

- **Purpose:** Android below 9 cannot finish a new-account passkey. Android 9 is the first version whose passkeys can carry the extra key. Older Android returns the installed version and the minimum. Android 9 and newer, other browsers, and an Android user agent with no version token return null.
- **Inputs:** `userAgent` string.
- **Returns / side effects:** `{ installed, required }` where `required` is `9` and `installed` is major, major.minor, or major.minor.patch, or null. No network.
- **Used by:** `LoginCard` (muted line after mount) and `usePasskeyLogin` (a new account that cannot finish fails with `login.androidVersion` and is not stored).

## Function: androidInstalledVersion

- **Purpose:** Read the installed Android version, including Android 9 and newer. `androidPasskeyBlock` still returns null on those newer versions.
- **Inputs:** `userAgent` string.
- **Returns / side effects:** Installed string, or null when the token is missing. No network.
- **Used by:** `usePasskeyLogin`, which puts that version at the front of a failed login or register diagnostic.

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

- **Purpose:** Compact dual-line cumulative SVG of Given and Received. FiatPicker **only when unsigned** (`useHydrateSession().ready && session === null`; public view). Signed-in mounts (`ProfileScreen`, `MemberProfileScreen`, signed-in `/view`) omit it. Code from `useFiatPreference`. Empty/all-zero sats: unsigned shows picker plus `profile.chartEmpty` `role="status"`; signed-in empty is `profile.chartEmpty` alone (no SVG, no ₿|{fiat} scale). Empty/all-zero sats and `failed` show `profile.chartError` (`role="alert"`, `text-app-danger`) instead of `profile.chartEmpty`; unsigned FiatPicker stays above. In-flight and successful empty stay `profile.chartEmpty`, never **Loading…**. Null `usd`/`cumulativeUsd` with positive cumulative sats still draws the satoshi chart (legend + scale + SVG). Populated: unsigned shows picker, then legend + `SegmentedControl tone="gift"` options ₿ | selected FiatCode (`profile.chartScale`), then SVG; signed-in populated starts at legend + ₿|{code} scale. Scale state is `ActivityScale` `'sat' | 'fiat'`. Ticks: sat `formatBitcoin`; fiat `formatFiatTick` (USD may use `formatUsdTick`); USD scale uses an em dash when any raw `cumulativeUsd` is `null`; em dash when every source cumulative for the selected non-USD code is `null`. Wrapper `role="group"` uses `profile.chartTitle` as `aria-label`. No title heading; page heading is **Profile**. Given is `donatedOverTime` from account activity (no longer a hardcoded zero series).
- **Inputs:** `received` (`AccountActivity.receivedOverTime`); optional `donated` (default `[]`) from `AccountActivity.donatedOverTime`; optional `failed` (default false).
- **Returns / side effects:** When unsigned, FiatPicker, then when the series is empty or all zeros: `profile.chartEmpty` (`role="status"`) — no legend, ₿|{fiat} scale, or SVG — or `profile.chartError` (`role="alert"`, `text-app-danger`) when `failed`. Signed-in empty is `profile.chartEmpty` alone (or `profile.chartError` when `failed`). In-flight and successful empty stay `profile.chartEmpty`, never **Loading…**. Null `usd`/`cumulativeUsd` with positive cumulative sats still draws the satoshi chart. Otherwise one chrome row (legend left, ₿ | selected FiatCode right) and SVG. Client state for scale; unsigned picker writes the `fiat` cookie. No network.
- **Used by:** `ProfileScreen`, `ViewProfileScreen`, `MemberProfileScreen`.

## Function: Button

- **Purpose:** Labeled app button with primary (filled), secondary (bordered), accent fill, or `overlay` (a dark translucent pill, `bg-black/55 text-white backdrop-blur-md`, for controls over a camera picture; the same on both tones). Optional `tone` `app` (default) or `dark` for marketing-ink shells (same class split as `ButtonLink`). Size `sm` / `md` / `lg` (`lg` is full width). All sizes `min-h-11`.
- **Inputs:** Native button props plus optional `variant` (default `primary`), optional `size` (default `md`), optional `tone` (default `app`), optional leading `icon`, optional `ref` (the rendered `<button>`, to move focus to it), and `children` label. Default `type="button"`.
- **Returns / side effects:** A `<button>` element. No network. Used across login, forum retry, public note retry, PWA install on dark shells, and forms.
- **Used by:** `PublicMessageLoader`, `ForumBoard`, `PwaInstall`, `WalletBalance`, `WalletPay`, `WalletSend`, setup and contact screens.

## Function: ButtonLink

- **Purpose:** Labeled pill link matching `Button` anatomy (`primary` / `secondary` / `accent`, `sm` / `md` / `lg`, `tone` `app` or `dark`). `size="chrome"` is the compact page-chrome pill (`min-h-11 gap-1 px-1.5 py-1 text-xs`, from `sm` `gap-1.5 px-3 text-sm`); the other sizes keep `gap-2 text-sm`.
- **Inputs:** `href`, optional `variant` / `size` (`chrome` / `sm` / `md` / `lg`) / `tone` / `icon` / `className` / `aria-label`, `children` label.
- **Returns / side effects:** A Next.js `<Link>` for path hrefs, or a native `<a>` for protocol hrefs (`https:`). No network. Used on marketing CTAs, donate **Open the forum**, and rules nav. The 404 page does not use it.
- **Used by:** `Home`, `MarketingHeader`, `DonatePage`, `RulesDocument`.

## Function: SegmentedControl

- **Purpose:** Mutually exclusive option group with `tone` `gift` (compact ₿|USD cells, optional `shell` `app`/`dark`) or `neutral` (full-width pills for staff inbox and profile notifications). Gift hit target is `min-h-11 min-w-11` on mobile and desktop. `shell` is ignored for `neutral`. Neutral `role="group"` is the pill; the forum composer Post/Ask `!grid grid-cols-2 !rounded-2xl` still lays out those option buttons via `className` on the group. The four forum view filters are `ForumModeSelect`, not this control. No `trailing` slot.
- **Inputs:** `value`, `options` (`value` + `label`, optional `badge` / `badgeAriaLabel`; chip omitted when `badge` is missing or ≤ 0; optional `disabled`), `onChange`, `ariaLabel`, `tone`, optional `shell` (default `app`, gift only), optional `className` (on the group).
- **Returns / side effects:** A `role="group"` track of `type="button"` options with `aria-pressed`. A disabled option renders a native `disabled` button, dimmed with `disabled:opacity-50` in both tones, and pressing it does nothing. Neutral is that group as the pill (`className` lands there, including the composer Post/Ask `!grid grid-cols-2 !rounded-2xl`). No network.
- **Used by:** `ForumBoard` (`tone="neutral"`), `PushToggle` (`tone="neutral"`, twice: level + device), `AccountActivityChart` (`tone="gift"`), `StatsDashboard` (`tone="gift" shell="dark"`), `AmountEntry` (`tone="gift"`, the fiat option disabled without an exchange rate).

## Function: ForumModeSelect

- **Purpose:** Closed combobox for the living-room forum view (Active, No gifts yet, All, Most popular). The trigger shows the selected label and a chevron. A positive unpaid badge is also shown as a count chip on the closed trigger. Opening the trigger shows a listbox of option rows; the selected row has a check. Choosing a row calls onChange and closes the list. Shops does not mount it. Post/Ask stays a SegmentedControl.
- **Inputs:** `value`; `options` (`value`, `label`, optional `badge`, optional `badgeAriaLabel`); `onChange(value)`; `ariaLabel` (catalog `forum.modeLabel`).
- **Returns:** A relative wrapper with the combobox button and, only while open, the listbox.

## Function: IconButton

- **Purpose:** Icon-only control with a required `aria-label`, variant (`primary` / `secondary` / `ghost`), size (`sm` / `md` / `lg`), and optional `tone` `app` (default) or `dark` for marketing-ink shells (ghost+dark is paper hover and `focus-visible:outline-paper`). `sm` is 24px paint with a 44px `::before` hit slop; `md` is 44px; `lg` is 48px.
- **Inputs:** Native button props; `aria-label` is required for accessible naming. Default `variant="secondary"`, `size="md"`, `tone="app"`, `type="button"`.
- **Returns / side effects:** A `<button>` wrapping the icon child. No network. Used for attach/post/pay/copy/dismiss controls on the forum board and the handbook copy-link on marketing ink.
- **Used by:** `ForumBoard`, `InboxScreen`, `HandbookImageViewer`, `HandbookLightbox`, `ContactScreen`, `NameForm`, `RulesSetup`, `HandbookCopyLink`, `WalletSend`.

## Function: Card

- **Purpose:** Primary app content panel using semantic card tokens (`bg-app-card`, border, shadow) with optional max-width (`sm` / `md` / `xl`). `surface` default `true` draws that nested visual panel. `surface={false}` is a width + flex + gap column for page body inside the AppShell frame (no radius, border, bg, shadow, or `p-8`). Card never hosts page chrome.
- **Inputs:** `children`, optional `className`, optional `maxWidth` (default `sm`), optional `surface` (default `true`; `false` omits panel classes).
- **Returns / side effects:** A `<section>` wrapper. No network. Nested panel for public notes and overlays; page-body columns (`LoginCard`, profile, welcome, inbox) use `surface={false}`.
- **Used by:** `PublicMessageLoader`, `LoginCard`, profile and setup screens.

## Function: AmountEntry

- **Purpose:** Every typed amount. Gift `SegmentedControl` (₿ and the member's fiat code) plus the other unit under the field. `keypad` (the `/pos/amount` page only) replaces the input with a non-focusable amount and an always-visible 3-column keypad. The page heading is already **Amount**, so the keypad does not repeat it; the amount keeps that name for assistive tech. Bitcoin offers no decimal key and ignores a typed decimal. Fiat shows the number-format decimal and keeps two fraction digits. A key scales down and darkens while it is held. When the amount changes and the device can vibrate, and reduced motion is off, it vibrates for 10 ms. Other screens keep the input. Switching the keypad to fiat rewrites the draft with the number-format decimal. Bitcoin shows the preferred fiat. Fiat shows `formatBitcoin`. The input box, its placeholder, and where the digits start do not change when the unit changes. A numeric placeholder is not rewritten. The switch and the counter do change. A signed-in toggle POSTs `/me/amount-unit` and writes `account.amountUnit`. No session keeps the choice on the control and starts at ₿. `rateDay` is the current spot rate (`useSpotRate`). While the preferred fiat has no usable rate, that fiat is a disabled option on the switch (₿ stays), the field shows ₿ even when `account.amountUnit` is `fiat`, and the line under the field reads **No exchange rate yet** (`amount.noRate`) where the fiat would be, typed or not, so typing does not move the layout. When the rate arrives the field follows `account.amountUnit` again. Once a price is loaded the hook keeps it, so a fiat draft does not lose its rate. Only a later answer that prices other currencies but not this one can take it away; then the draft is kept in fiat and the line under it reads **No exchange rate yet**, and the point of sale answers **This amount cannot be converted to bitcoin. Enter it in ₿.** instead of a whole-number error. Pressing ₿ on a fiat draft that cannot be converted switches to an empty ₿ field. A locked invoice shows the sat amount and disables the switch. `layout="composer"` (inbox) puts the switch beside the input. `layout="inline"` (forum reply) puts the amount before the switch on one line. Both keep the label for assistive tech only and put the counter under the input.
- **Inputs:** `label`, `value`, `onValueChange`, `rateDay` (current spot rate or `null`), optional `id`, `disabled`, `placeholder`, `className`, `lockedSats`, `onUnitChange`, `layout` (`field` default, `composer`, or `inline`), optional `keypad` (default false; the `/pos/amount` page only).
- **Returns / side effects:** A labeled input, or with `keypad` a non-focusable amount plus the keypad and no input. The keypad does not show the label again. The switch and a counter line when an amount is defined. Signed-in toggle calls `setAmountUnit`. No other network.
- **Used by:** `ForumAskWizard`, `ForumBoard` pay sheet and reply, `InboxScreen`, `PayLinkScreen`, `PosAmount`, `WalletSend`.

## Function: Field

- **Purpose:** Labeled text input or textarea using shared app field tokens; id is generated from the label when omitted.
- **Inputs:** `label`, optional `id` / `className`, `multiline` (textarea when true), plus native input or textarea attributes.
- **Returns / side effects:** A `<label>` wrapping an `<input>` or `<textarea>`. No network.
- **Used by:** Labeled text primitive. Amount fields use `AmountEntry` instead.

## Function: APP_HEIGHT_BOOTSTRAP_SCRIPT

- **Purpose:** Blocking bootstrap IIFE string injected as a raw head script before paint. Sets `--app-height` to the visible viewport (`visualViewport.height`, else `innerHeight`) and writes `visualViewport.offsetTop` to `--app-offset-top`. The offset is never added into the height and the script does not take `max` with `innerHeight`. A taller frame would be a second scroll. Scale guard: skips both writes when `visualViewport.scale` is present and not ≈ 1.
- **Inputs:** None (constant string).
- **Returns / side effects:** Non-empty IIFE source mentioning `visualViewport`, `--app-height`, and `--app-offset-top`. It does not mention `Math.max` and it does not add the offset into the height.
- **Used by:** `RootLayout` `<head>` script.

## Function: AppHeightViewport

- **Purpose:** Minimal visual-viewport fields (`height`, optional `offsetTop`, optional `scale`) used to resolve `--app-height` and `--app-offset-top` without depending on the DOM `VisualViewport` type in tests. `offsetTop` positions the body and is not part of the height.
- **Inputs:** `height` in CSS pixels; optional `offsetTop`; optional `scale` (omit when unknown — do not pass `undefined`).
- **Returns / side effects:** A structural type only — no runtime value. Callers pass `{ height }` or `{ height, offsetTop, scale }` into `resolveAppHeight` and `resolveAppOffsetTop`.
- **Used by:** `resolveAppHeight`, `resolveAppOffsetTop`; `useAppHeight` (live `window.visualViewport`).

## Function: resolveAppHeight

- **Purpose:** Chooses the pixel value for `--app-height`. The result is `visualViewport.height` (else `innerHeight`). `offsetTop` is not added. A frame taller than the visible viewport would scroll the document under the one scrollport. Pinch-zoom skip: returns `null` (caller must not write) when `scale` is present and not ≈ 1 (`|scale - 1| > 0.01`). Null/undefined visualViewport falls back to `innerHeight`.
- **Inputs:** `innerHeight` (`window.innerHeight`); `visualViewport` (`window.visualViewport` or a stub; null/undefined allowed; `offsetTop` optional and not added into the result).
- **Returns / side effects:** Rounded CSS-pixel height, or `null` to skip the write. No DOM writes of its own.
- **Used by:** `useAppHeight` (`AppHeightSync`); bootstrap IIFE inlines the same visible-height path.

## Function: resolveAppOffsetTop

- **Purpose:** Chooses the pixel value for `--app-offset-top`, which positions the fixed `body` on the visual viewport. The value is rounded `visualViewport.offsetTop`, or 0 when the viewport or the offset is missing. It is never added into `--app-height`. Pinch-zoom returns `null` so the caller skips both writes.
- **Inputs:** `visualViewport` (`AppHeightViewport` or null/undefined). `scale` present and not ≈ 1 (`|scale - 1| > 0.01`) skips the write.
- **Returns / side effects:** Rounded CSS-pixel offset, 0 when there is no viewport, or `null` while pinch-zoomed. No DOM writes of its own.
- **Used by:** `useAppHeight` (`AppHeightSync`); the bootstrap IIFE writes the same offset before paint.

## Function: useAppHeight

- **Purpose:** After hydration, keeps `--app-height` equal to `visualViewport.height` (else `innerHeight`) and `--app-offset-top` equal to the visual-viewport offset so the fixed body sits in the visible area. The offset is never added into the height. Pinch-zoom skips both writes. Viewport resize and scroll reveal the focused field; focus does the same on the next animation frame.
- **Inputs:** None (reads `window.visualViewport` / `innerHeight` inside a `useEffect`).
- **Returns / side effects:** `void`. Sets `--app-height` and `--app-offset-top` on `document.documentElement`. Registers window resize/orientationchange, document focusin/focusout, and visualViewport resize/scroll listeners; cleans them up on unmount. Reveals the focused input, textarea, or select inside the active scrollport.
- **Used by:**
  - **`AppHeightSync`** (same file; root layout mount)
  - **Every hydrated app page** (via that mount)
  - **Fill/flow `AppShell` layouts** that consume `--app-height`

## Function: AppHeightSync

- **Purpose:** Client-only root mount that calls `useAppHeight` so `--app-height` stays the visible viewport height and `--app-offset-top` keeps the fixed body on that viewport after the blocking bootstrap script runs in `<head>`. The offset is never added into the height.
- **Inputs:** None.
- **Returns / side effects:** Renders `null`; side effect is the hook. Mounted as the first child of `<body>` in `RootLayout`.
- **Used by:**
  - **`RootLayout`** (`src/app/layout.tsx`)
  - **All app and marketing routes** under that layout
  - **`useAppHeight` consumers** that rely on a single shared mount

## Function: AppShell

- **Purpose:** App page shell driven by `--app-height`. Always draws one `rounded-3xl` page frame. `fill` and `flow` share that geometry: locked height, frame `grow shrink basis-0 self-stretch` (not `flex-1`), frame-header chrome row, one `[data-scrollport]` (`Scrollport`), footer host. The document does not scroll. Prefer this over Tailwind viewport-height utilities on app routes. Chrome (wordmark + Menu / language) is the frame’s first row (`[data-app-chrome]`, `px-5 pt-4 pb-1`). `<main>` has no `overflow-hidden`. The frame (`[data-app-frame]`) publishes its content-box width as `frameWidth`. `[data-menu-scrim-host]` sits on the frame. `[data-menu-sheet-host]` (`px-5`, the same horizontal inset as the page) and `[data-scroll-page]` (`px-5 py-4`) sit inside the one scrollport; the header slot is `px-5` and the footer host `px-5 pb-5`. Card never hosts page chrome. Never `justify-center` on `<main>` or the scrollport. The center wrapper sets `justify-content: center` and then `safe center`, so content that fits stays centered, and where `safe` is supported a thread taller than the frame starts at the top and remains scrollable inside that one scrollport.
- **Inputs:** `children`, required `mode` (`fill` | `flow`; both values render the same frame), optional `topLeft` / `topRight`, optional `className`, optional `align` (`start` | `center`). The `<main>` inset is `px-3 py-2`, below 360px `px-2`, and the chrome row `px-5`, below 360px `px-3`, so the signed-in header fits at 320px.
- **Returns / side effects:** A `<main>` layout with a rounded page frame, chrome row, header/footer portals, and inner scroller. `useAppShellScroller` reads that scroller from context. No network. Mounts `PasskeyRenewNotice` while `walletRequired === false`, and `WalletSetupNotice` while `needsWalletSetup(account)` holds or a `walletSetupPin` is set for a signed-in visitor.
- **Used by:**
  - **Fill and flow app routes** (`LoginPage`, `DonatePage`, setup, contact, inbox, notifications, public note, `ProfilePage`, `WalletPage`, `ShopsPage`, `ViewProfilePage`, `MemberProfilePage`)
  - **`PageChrome`** (still `mode="flow"`; AppShell draws the unified frame — welcome and public rules)
  - **`AppShellHeader` / `AppShellFooter` / `AppShellTopLeft`** slot registrars
  - **`useAppShellScroller`** (`ForumBoard` pull-to-refresh, `ForumLoader` atTop / scroll-to-top, `InboxScreen` open-thread pin to bottom / one-shot list reset to top)

## Function: Scrollport

- **Purpose:** The only layout scrollport. Renders `[data-scrollport]`. Overflow is the `globals.css` rule, not a Tailwind utility: clip until `data-scroll-active`, then the active port scrolls vertically only (`overflow-x: clip` and `overflow-y: auto`). The innermost bound port scrolls. Among siblings, the most recently bound one scrolls and gets `data-scroll-active`. Every other port gets `data-scroll-locked`. `html` and `body` stay `overflow: clip`.
- **Inputs:** `children`, optional `className`, optional `scrollRef`, optional `onClick`.
- **Returns / side effects:** A `div`. Binds on mount and releases on unmount. No network.
- **Used by:** `AppShell`, marketing layout, `NotFound`, `HandbookLightbox`.

## Function: bindScrollport

- **Purpose:** Push a scrollport onto the active stack and resync. Binding the same element twice does not stack it twice. The innermost bound port may scroll; among those, the most recently bound. That port gets `data-scroll-active`.
- **Inputs:** The mounted scrollport element.
- **Returns / side effects:** Sets `data-scroll-active` on the port that may scroll and `data-scroll-locked` on the others, and clips stray scrolling elements. No network.
- **Used by:** `Scrollport` on mount.

## Function: releaseScrollport

- **Purpose:** Remove a scrollport from the active stack and resync. The innermost remaining port scrolls; among siblings, the most recently bound. Releasing an element that is not on the stack does nothing.
- **Inputs:** The unmounted scrollport element.
- **Returns / side effects:** Sets `data-scroll-active` on the port that may scroll and `data-scroll-locked` on the others, and clips stray scrolling elements. No network.
- **Used by:** `Scrollport` on unmount.

## Function: syncScrollSurfaces

- **Purpose:** Leave exactly one scrollport unlocked. Every other element whose computed overflow can scroll (`auto`, `scroll`, or legacy `overlay`, on either axis) is forced to clip. Textareas grow to their text instead. Inputs and selects are left to the browser.
- **Inputs:** None. Reads the active stack and `document.body`.
- **Returns / side effects:** Sets `data-scroll-active` on the one port that may scroll and `data-scroll-locked` on the others, and may set inline overflow or textarea height. No network.
- **Used by:** `bindScrollport`, `releaseScrollport`, and `ScrollSurfaceGuard`.

## Function: ScrollSurfaceGuard

- **Purpose:** Root watcher. On mount, and whenever class, style, or children change, it runs `syncScrollSurfaces` so a scrolling overflow added later cannot become a second surface. Typing in a textarea resyncs immediately so the field grows instead of scrolling.
- **Inputs:** None.
- **Returns / side effects:** Renders `null`. Observes `document.body` and listens for `input`. Disconnects on unmount. No network.
- **Used by:** `RootLayout`, mounted once for every page.

## Function: useAppShellScroller

- **Purpose:** Returns the AppShell inner `[data-scrollport]` element, or `null` outside AppShell.
- **Inputs:** None (reads AppShell context).
- **Returns / side effects:** `HTMLElement | null`. No network.
- **Used by:** `ForumBoard` (pull-to-refresh pageScrollTop), `ForumLoader` (atTop / scroll-to-top), `InboxScreen` (open-thread pin to bottom / one-shot list reset to top), AppShell unit tests.

## Function: AppShellHeader

- **Purpose:** Registers flex-none header content into the nearest `AppShell` page frame (DOM portal into the shell `<header>` host). Without an `AppShell` ancestor, renders children inline.
- **Inputs:** `children` (typically an onboarding `h1`).
- **Returns / side effects:** Portal into the shell header host when present; otherwise the children. Layout only.
- **Used by:**
  - **`NameSetup`**
  - **`RulesSetup`**

## Function: AppShellFooter

- **Purpose:** Registers flex-none footer content (CTAs) into the nearest `AppShell` page frame (DOM portal into the shell `<footer>` host; `px-5 pb-5` on that host). Without an `AppShell` ancestor, renders children inline.
- **Inputs:** `children` (typically Continue / Skip / Agree buttons).
- **Returns / side effects:** Portal into the shell footer host when present; otherwise the children. Layout only.
- **Used by:**
  - **`NameForm`** (onboarding)
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
- **Used by:** `HomeWordmark`, `ForumHomeWordmark`, `MarketingFooter`, `ProfileChromeLeft`, `RulesSetup`, setup name/username pages, and `RulesPageChrome`.

## Function: ForumHomeWordmark

- **Purpose:** Welcome-page wordmark: linked `21.gifts` to `/welcome` that `preventDefault`s and dispatches `FORUM_HOME_EVENT` so `ForumLoader` can scroll to top and apply new notes without a full reload.
- **Inputs:** None. Uses `Wordmark` and `FORUM_HOME_EVENT`.
- **Returns / side effects:** A client wordmark link. Dispatch only; no fetch of its own.
- **Used by:** `WelcomePage`.

## Function: HomeWordmark

- **Purpose:** Session-aware header wordmark: linked `21.gifts` to `/welcome` when `useHydrateSession` is ready and `useAuthStore` has a session, otherwise `/`. Real navigation (no `preventDefault`, unlike `ForumHomeWordmark`).
- **Inputs:** Optional `tone`, `size`, `className`, `onClick` forwarded to `Wordmark` when set. Uses `useHydrateSession` and `useAuthStore`.
- **Returns / side effects:** A client `Wordmark` link. Hydrates the session; no other network of its own.
- **Used by:** `MarketingHeader`, `LoginPage`, `DonatePage`, `ViewProfilePage`, `PayLinkScreen`.

## Function: PublicMessageChrome

- **Purpose:** Client chrome wrapper for public `/messages/[id]`, `/messages/[id]/author`, and `/messages/[id]/repayment-list`: when a session is hydrated (`ready && session !== null`), mounts signed-in shell (`ProfileChromeLeft` + `SignedInChrome`); otherwise `ProfileChromeLeft` with wordmark href `/` and light `LanguageSwitcher`. The arrow returns to the previous in-app view, or `/welcome` when this tab has none.
- **Inputs:** `children` (page body: `PublicMessageLoader` from `PublicMessagePage`, `ExternalAuthorProfile` from `ExternalAuthorPage`, or `CreditLedger` from `RepaymentListPage`). Uses `useHydrateSession` and `useAuthStore` for `session`.
- **Returns / side effects:** Fill `AppShell` (`align="center"`) with the matching top-left / top-right slots around `children`. No network beyond session hydration.
- **Used by:** `PublicMessagePage`, `ExternalAuthorPage`, `RepaymentListPage`.

## Function: PublicMessagePage

- **Purpose:** Next.js page for `/messages/[id]` — public HTML note by UUID. Unsigned visitors see a read-only thread. Signed-in React on the root note, copy, reply, and Gift on a payable nested reply run through `PublicMessageLoader` → `PublicMessageThread`. No `OnboardingGate`, top-level composer, or envelope. Wrapped in `PublicMessageChrome` (signed-in or unsigned chrome depending on hydrated session).
- **Inputs:** Dynamic route params (`id`).
- **Returns / side effects:** `PublicMessageLoader` inside `PublicMessageChrome` (chrome is no longer always unsigned Wordmark + LanguageSwitcher). Also exports `generateMetadata` for per-note Open Graph / Twitter tags. Unsigned chrome is `ProfileChromeLeft` with wordmark href `/`, not a bare wordmark.
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

- **Purpose:** Client loader for the public thread page: validates UUID, waits for hydrate `ready`, then fetches. Staff (`roleAtLeast(account.role, 'moderator')` + session) use `fetchForumMessage(session, routeId)` and `fetchReplies(session, root.id)` so a soft-hidden row can load; others use `fetchPublicMessage(routeId)` / `fetchPublicReplies`. If `parentId` is set, fetches that parent (`null` → missing) then replies of the parent. Ready only with root + replies (empty replies → parent only). Replies throw → error + **Try again** (whole chain). Until hydrate `ready`, only `forum.loading` (no fetch, no cards). After ready, when the loaded root or the highlighted reply has `deletedAt` / `deletedBy`, a `role="status"` `forum.hiddenNotice` line sits above the thread (permalink target). Unsigned visitors (no session or no account) keep the `PublicThreadCard` stack (no pay/copy): vertical stack parent `Card` then reply Cards with `pl-4`. Gift-only replies (empty text, sats > 0): sats line via `formatBitcoin` plus optional preferred-fiat `·` `formatFiatDisplay` of the amount stored when the payment was made (a stored string as-is, a null or missing field on a passed `stored` object uses the spot rate), no empty `<p>`. When the route id is a reply, that unsigned reply card (or wrapper) has `data-permalink-target="true"` and `ring-1 ring-app-fg`. Photo/video per unsigned card via `fetchPublicMessagePhoto`. Unsigned gallery is `ForumPhotoGallery` (horizontal snap row, `data-scroll-x`, 88% peek, `current/total` chip, dots); `data-photo-index` keeps the original still index when an earlier extra still fails to load. **Translate** (Languages icon) under unsigned note and reply bodies via `NoteTranslate` when the language differs from the UI locale. A `via === 'nostr'` reply or note shows a non-interactive **External** `<span>` badge next to the name (no hint state on this card) and renders its body as plain text (`TranslatableNoteBody` `plain`) instead of `ForumQuotedBody`. Each unsigned card is ₿ plus optional preferred-fiat `·` `formatFiatDisplay` of the amount stored when the payment was made (`useFiatPreference`; cookie, otherwise locale default); otherwise the spot rate. On an unsigned reply with `receivedSats` greater than zero, that card uses `ReplyDirectionAmounts` instead of the single amount: sent and received stay separate lines and are not added. A top-level card keeps one amount, the collected total. `useSpotRate` feeds the pay sheet and an unpaid invoice preview. A posted goal bar uses the stored visitor snapshot when that string exists, otherwise this spot rate. A top-level unsigned note with a positive `goalSats` also shows `ForumGoalBar`, and the same **Loan**, **Donation**, or **#Shop** tag as the forum beside the name. When `ready && session && account` and the root is loaded, mounts `PublicMessageThread` instead of the unsigned cards, passing `seedReply` as the highlighted hidden reply (omit the prop when none). Auth CTA once below either stack from `useHydrateSession` is **Log in** when unsigned. Signed-in visitors have no text back link under the thread. The top-left arrow returns to the previous in-app view in this tab, or `/welcome` when this tab has none.
- **Inputs:** `id` string from the route. Also reads `session` and `account` from the auth store and hydrate `ready`.
- **Returns / side effects:** States loading / missing / error (with **Try again**) / ready unsigned stack or signed-in `PublicMessageThread`. Malformed UUID → missing without an api call. Photo blob URLs revoked on unmount or id change. Inline `<video>` keeps the clip aspect ratio (`max-h-80 max-w-full`, no full-width black canvas). A failed `<video>` `error` event hides the player and falls back to the photo when present. `NoteTranslate` on unsigned note and reply bodies (GET `/translate` on mount, POST on **Translate**). Unsigned stack has no pay, composer, copy, or FiatPicker. Hydrate-not-ready is only `forum.loading` (no unsigned cards). A hydrate drop after a note is loaded keeps the cards and shows `forum.loading` in the footer. A login whose wallet is still opening (`useWalletOpen`) counts as signed out here: the public fetch is used and no notification is marked read until the wallet is open.
- **Used by:** `PublicMessagePage`.

## Function: PublicMessageThread

- **Purpose:** Signed-in permalink thread: one root on `ForumBoard` with `composerHidden` and `truncate={false}` so the original body stays full, auto-expand via `fetchReplies`, and the same React, copy, reply, overlay, photo, and poll behavior as `/welcome`. React (`forum.react`, lucide Reply) on the root note; on every nested reply Gift when payable, copy (`forum.copyReplyLink`, the reply's own origin `/l/<8 hex>`, first group of that reply id) always, and trash for staff. Staff `onDeleted` on the root calls `onRootDeleted` (loader → missing); a nested reply is dropped from the list. Passes `permalinkTargetId` so only a matching nested reply is ringed. Owns `payHost` and passes it to ForumBoard: a compose-fee reply invoices 1 sat to 21.gifts on the composer slot (`payHost: composer`, `payMessageId` = compose-target note); extra gifts and Gift-open stay on the card (`payHost: card`).
- **Inputs:** `{ root, highlightId, seedReply?, onRootDeleted }` as in `src/components/PublicMessageThread.tsx`: `root` is `ForumMessage`, `highlightId` is `string | null` (route id when it is a reply UUID), `seedReply` is the opened hidden reply when the route id is a hidden child, `onRootDeleted` is `() => void`. Session and account from the auth store.
- **Returns / side effects:** React tree. Auto-expands the root so **Write a reaction** is available. After Bearer `fetchReplies` of the root, merge `seedReply` into the list when it is missing so the signed-in board still shows the hidden permalink target. Passes `permalinkTargetId={highlightId}`. No top-level composer or feed filters. Owns `payHost` and passes it to ForumBoard: a compose-fee reply invoices 1 sat to 21.gifts on the composer slot (`payHost: composer`, `payMessageId` = compose-target note); extra gifts and Gift-open stay on the card (`payHost: card`). A `WalletRequiredError` (api `code` `wallet_required`) on a gift, a paid reply, or a posting fee opens the `RequirementsOverlay` `wallet` step. Pay invoices keep the api's `sparkInvoice` so the wallet pays it before the payment request.

- **Used by:** `PublicMessageLoader`.

## Function: ViewProfilePage

- **Purpose:** Next.js page for `/view/[viewKey]` — public read-only profile by view key. No `OnboardingGate`, no `SignedInChrome`.
- **Inputs:** Dynamic route params (`viewKey`).
- **Returns / side effects:** Exports `metadata.referrer = 'no-referrer'`. `AppShell` with `ProfileChromeLeft` (wordmark `HomeWordmark`: `/` unsigned, `/welcome` when a session is hydrated) and light `LanguageSwitcher` top-right; body is `ViewProfileLoader`. The arrow returns to the previous in-app view, or `/welcome` when this tab has none. The card itself has no back control.
- **Used by:** Route `/view/[viewKey]`.

## Function: ViewProfileLoader

- **Purpose:** Client loader for the public view page: validates the key, fetches the public profile, then `fetchViewActivity` even when the profile has no wallet yet. Does not use `useAuthStore`.
- **Inputs:** `viewKey` string from the route.
- **Returns / side effects:** States loading / missing / error (with **Try again**) / ready card. In **ready**, renders `ViewProfileScreen` plus `ViewProfileClaim` under the card (passes `viewKey` and `hasPasskey` from the fetched profile). Malformed keys (not 64 lowercase hex) → missing without an api call. After `fetchViewProfile`, always calls `fetchViewActivity` (even when the profile has no wallet yet) and maps both series onto the card. Activity failure still shows the card; the chart shows `profile.chartError`, not `profile.chartEmpty`. Successful empty series stays `profile.chartEmpty`. Chart never swapped for `forum.loading`.
- **Used by:** `ViewProfilePage`.

## Function: ViewProfileScreen

- **Purpose:** Presentational read-only identity card matching signed-in profile chrome: heading Profile, `AccountActivityChart`, About me inside the card (not a forum post; public `AboutMeSection` with `name={profile.name}` shows filled text and/or photo, or omits the heading when neither; Languages **Translate** when `aboutMessageId` is set), name, location, and public `username@21.gifts` rows (labels `name.heading` / `location.heading` / `profile.giftsHeading`) without edit or Message actions. Unset location shows `location.unset`. Missing username shows `view.noGiftsAddress`. Copy-profile-link on the card (`profile.copyLink`). When a username is set, a centered `QrCode` (label `profile.giftsQr`) under the address encodes `openCryptoPayQrValue` (`https://<domain>/pl/?lightning=` plus the uppercase LNURL of `https://<domain>/.well-known/lnurlp/<local>`), including on a smartphone. A missing username shows no QR.
- **Inputs:** `{ profile, viewKey, received, donated }` — `received` is `AccountActivity['receivedOverTime']`; optional `donated` is `AccountActivity['donatedOverTime']`; optional `activityFailed` (default false), passed to the chart as `failed`. `viewKey` builds the copy URL `/view/<viewKey>`. `profile` includes `aboutMe`, `aboutMeHasPhoto`, and `location`. Public `AboutMeSection` `hasPhoto` from `aboutMeHasPhoto` with `loadPhoto` (`fetchViewAboutMePhoto`).
- **Returns / side effects:** No menu, logout, back, edit forms, or Message. Copy-profile-link on the card; URL/key never shown as visible text. Language switcher lives on the page, not in this card. When `activityFailed` is true and the series is empty, `profile.chartError`.
- **Used by:** `ViewProfileLoader`.

## Function: ViewProfileClaim

- **Purpose:** Public passkey claim control under the `/view/[viewKey]` card. Unclaimed invites (`hasPasskey` false) bind a passkey to the existing profile (name already set), including when another 21.gifts session is already signed in.
- **Inputs:** `viewKey` (64 lowercase hex) and `hasPasskey` from the public profile. Uses `usePasskeyLogin`, `useAuthStore`, `useRouter`, `isInAppBrowser`, and `InAppBrowserView`.
- **Returns / side effects:** Waits for `useHydrateSession` `ready`. Claimed (`hasPasskey` true) → `null` (even in Telegram, even if signed in). In-app on mount or `unsupported` → same card chrome as login wrapping `InAppBrowserView` (no yellow **Activate**). Else in a real browser: yellow banner with `view.activationRequired` and **Activate** (`view.activate`) even when `account !== null`; click sets a claim-attempted flag, `cancel` + `clearAuth` when a session exists, then `register(viewKey)` (stays on the view page). Success → `router.replace(nextOnboardingPath(account))` only when that claim was attempted (pre-existing sessions do not redirect on mount). 409 → `view.alreadyClaimed` plus Fingerprint that calls `authenticate()`; after that attempt the yellow **Activate** banner does not return (successful login hides the control; a dismissed prompt keeps the already-claimed copy). Status `unknown` shows `view.claimError` and **Try again** calls `authenticate()`, never `register`, and never the login unknown card. Other errors / starting stay visible even with a session → `view.claimError` + **Try again** (`view.retry`) or spinner. When **Activate** fails because the new passkey gives no PRF output (`passkey.error` is `wallet.prfUnsupported`), the alert is `wallet.prfUnsupported` (**This phone or browser cannot hold a 21.gifts wallet. Please use an up-to-date phone or browser that supports passkeys.**) instead of `view.claimError`. After **Log in instead**, the spinner shows while that login runs (also over a held-back session), then the login opens the wallet like any other: `WalletLoginCard` stands in place until the wallet is open, and stays while the session is held back after it could not be (with the no-PRF or error alert); once open it renders nothing, as before. A stored session held back on a passive visit is not affected.
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

- **Purpose:** Session-based GET `/me/activity` via `fetchAccountActivity`; returns given/received sats plus `donateOverTime` and `receiveOverTime`. Fetches even before the in-app wallet is verified (forum gifts do not need it) and does not call `fetchGiftStats`.
- **Inputs:** Reads `session` and whether `account.sparkWalletVerified` is true from `useAuthStore`; calls `fetchAccountActivity` whenever a session exists. Refetches when the session changes or the wallet becomes verified, so gifts to the newly set up wallet appear without a full reload.
- **Returns / side effects:** `{ donatedSats, receivedSats, donateOverTime, receiveOverTime, loading, failed }`. Fetch start: `failed` false, series empty, chart shows `profile.chartEmpty`. Success: `failed` false and series from the payload. Thrown fetch: `failed` true, zeros, empty series, chart `profile.chartError`. Session null: `failed` false, no fetch. On each fetch start (including a session or wallet-verification change) totals and series reset to zeros/empty and `failed` is false; `AccountActivityChart` then shows `profile.chartEmpty` (no SVG) while in flight. Drops stale or cancelled responses when the session or wallet verification changes mid-flight and does not apply them.
- **Used by:** `ProfileScreen`.

## Function: WelcomePage

- **Purpose:** Next.js page for `/welcome`.
- **Inputs:** None.
- **Returns / side effects:** Flow `PageChrome` (`AppShell` wrapper) with `ProfileChromeLeft` `hideHistoryArrow` and `ForumHomeWordmark` top-left, `WelcomeTopRight` (the member menu when a session exists, otherwise a link to `/login`), and `OnboardingGate` `screen="welcome"` `allowGuest` around `WelcomeScreen`. The history arrow is never shown, whatever this tab's view stack holds. An ask-wizard step uses that same slot.
- **Used by:** Route `/welcome`.

## Function: WelcomeScreen

- **Purpose:** Living-room screen. With a session it is the post-login screen after name, username, and living-room rules agreement are saved. Without a session it is the public active list. Embeds `ForumLoader` below the heading. Page column is `max-w-xl` (`Card surface={false}`) so the AppShell frame is the only page-level `rounded-3xl`.
- **Inputs:** Reads `session` and `account` from `useAuthStore`; composes `useWallet`, `useWalletSend`, and `useWalletPanel`.
- **Returns / side effects:** Gift icon with an integrated Bitcoin symbol. Heading **Welcome, {name}** when the account has a name, otherwise **Welcome**. Forum board. A session gets the composer. `ForumLoader` sets `readOnly` when there is no session. `WelcomePage` shows **Log in** in the chrome. No name or address form. No donate CTA. No `LogoutButton` in the page column. A signed-in member whose wallet is configured (`useWallet` not `disabled`) also gets `WalletFooterActions` (**Receive** left, **Send** right) in the shell footer, fixed while the feed scrolls; Send is enabled while the wallet is ready or locked (locked: the existing unlock runs first, then Send opens). Either opens a full-screen view (`WalletPanelView`) over `/welcome` from `useWalletPanel` (in-page state, not a route): the welcome column stays mounted but `hidden`, the footer buttons are not rendered, the view starts at the top, and closing it restores the feed's scroll position. The open view sets the top-left arrow through `useChromeBack` (`nav.back`, the slot an ask-wizard step uses): in Send it closes the manual-entry sheet or an open send step first (held while a send is in flight), then returns to the feed. The wordmark and the Menu's **Home** (`FORUM_HOME_EVENT`) close the view and return to the top of the feed. Signed-out visitors and members without a configured wallet see the column alone. In a Playwright build a `?visual=send-…` pin opens the Send view on mount.
- **Used by:** Screen `/welcome`.

## Function: forumTextPreview

- **Purpose:** Collapse a public forum note or reply body to a 280-character UTF-16 `.length` collapsed preview (`FORUM_TEXT_PREVIEW_LIMIT`) for the feed/profile timeline analog. Show more / `truncated: true` only when `text.length` is greater than twice that (560, `FORUM_TEXT_FULL_LIMIT`). A body of 560 characters or fewer is returned unchanged. Word/line boundary cut when the last space or newline in the slice sits at index `>= floor(limit * 0.8)`; trailing spaces/tabs trimmed; no ellipsis in the helper. If the hard cut splits an http(s) URL (no whitespace across the boundary), that incomplete trailing URL is dropped from the preview so `LinkedText` cannot autolink a shorter href.
- **Inputs:** `text` — full body; optional `limit` is this collapsed preview length (default 280); the full-body ceiling is `limit * 2`.
- **Returns / side effects:** `{ preview, truncated }`. Does not append `…`. No network.
- **Used by:** `ForumNoteText`.

## Function: ForumNoteText

- **Purpose:** Client paragraph for remaining note/reply text on the feed and profile (via `ForumQuotedBody` / `QuotedForumNote` when `truncate` is true). Empty text returns null. Bodies autolink http(s) URLs via `LinkedText`. Optional `plain` forwards plain rendering to `LinkedText` on both the full and truncated (**Show more**) path. Bodies longer than 560 characters (twice the 280-character preview) render a collapsed preview of 280 characters, `…`, and inline **Show more** (`forum.showMore`, app inline link) for callers that do not pass `forceExpanded`. Optional `forceExpanded` renders the full body and omits Show more. Expand in place; no Show less. Click and keydown `stopPropagation` so the parent card `role="button"` does not toggle replies. On `/messages/[id]`, the original body is `LinkedText` (`ForumQuotedBody` with `truncate={false}`).
- **Inputs:** `ForumNoteTextProps` — `text`, `className`, optional `plain`, optional `forceExpanded` (default false).
- **Returns / side effects:** `LinkedText` (`<p>` plus optional overlay), or `null` when `text === ''`. Local React expand state only.
- **Used by:** `ForumQuotedBody` / `QuotedForumNote` (remaining text and nested quoted note bodies when `truncate` is true) and `TranslatableNoteBody` (original body only when `truncate` is true, not the translation).

## Function: readJpegTakenAt

- **Purpose:** Read a JPEG APP1 Exif capture time before the canvas re-encode strips it. Does not read GPS.
- **Inputs:** JPEG file bytes.
- **Returns / side effects:** `YYYY-MM-DDTHH:MM:SS` plus the matching offset when the file has one, or null. Prefers DateTimeOriginal, then DateTimeDigitized, then IFD0 DateTime. No I/O.
- **Used by:** `prepareForumPhoto`.

## Function: ForumPhotoGallery

- **Purpose:** Horizontal snap row for a note with `photoCount > 1`. Earlier slides are 88% wide so the next still peeks; the last slide is full width. The row is `data-scroll-x` (sideways only, vertical axis clipped) and is not a second page scroll. A `current/total` chip (`forum.galleryPosition`) sits on the visible still. Dots (`gap-5`, `IconButton` `sm` ghost, `forum.galleryDot`) scroll that row. Empty `photos` returns `null`. Single still has the chip and no dots. The capture time is stored, not shown.
- **Inputs:** `photos` (`{ index, url }[]`), `alt`, optional `className` (ForumBoard passes `mt-2`), optional `onPhotoClick` (ForumBoard `stopCardToggle`).
- **Returns / side effects:** React element. Local scroll index only. No network. Blob `<img>` URLs from the parent.
- **Used by:** `ForumBoard`, `PublicThreadCard` in `PublicMessageLoader`.

## Function: ShopAddWizard

Guided shop submission on `/shops`. Closed state is only **Add a shop**. The open steps are photos, a map place, text, an optional 21.gifts username, then a summary. **Post** on the summary is the only submit. The add photo step shows **Next** only. Edit mode shows an icon-only Close (X) on that step only. Its accessible name is Cancel, and there is no visible Cancel word. It closes the editor. From the place step on, the top-left arrow returns to the previous step. The card has no **Back** button. Photos, place, text, and the username can each be left empty; an empty summary still follows the forum rule that a note needs text or media.

- **Purpose:** Replace the living-room composer on the shops feed. The shop tag is added when the note is sent, not typed in the text step. That text step lists people as soon as `@` is typed, the same way a post does. The summary shows the photo count (stills plus a video), the place name or coordinates, the text, and `@username`, or **None** when that part was skipped.
- **Inputs:** `posting`, `draft` / `onDraftChange`, `photoDrafts`, `videoDraft`, `onPickFiles`, `onRemovePhoto`, `onClearPhoto`, `place` / `onPlaceChange`, `username` / `onUsernameChange`, `onSubmit`, optional `onCancel` (edit mode only), `resetToken` (closes the wizard after a successful send), `maxLength`. Optional `mode` (`create` default, or `edit`), `submitLabel`, `keptMedia`, `onRemoveKept`, and `imagesOnly`.
- **Returns / side effects:** React tree. No network. File selection calls `onPickFiles`. The summary button calls `onSubmit` (**Post**, or `submitLabel` such as **Save changes**). In edit mode, the icon-only Close (X) on the photo step calls `onCancel`. Its accessible name is Cancel, and there is no visible Cancel word. From the place step on, the top-left arrow returns to the previous step and is disabled while `posting` is true. The card does not draw **Back**.
- **Used by:** `ForumBoard` when `shopComposer` is set, and `ShopNoteEditControl` in edit mode.

## Function: ForumAskWizard

Ask composer on `/welcome`. A donation is four steps and the counter reads **{step} of 4**. A credit is nine steps and the counter reads **{step} of 9**. Step 1 starts with the One-time / Daily pill and a Donation / Credit pill under it. Photos and text follow the credit confirmations. The preview shows the same pills and `ForumGoalBar` at 0 collected versus the ask. The heading and the step counter share one row (step on the right). The labeled **Post** on the preview is the only Ask submit. Switching to **Credit** on the preview returns to step 1. A shown bitcoin amount on the plan also shows the visitor's fiat when a rate exists.

- **Purpose:** Walk **Ask for money** so Continue on the amount step still requires a local 1..10_000_000-sat parse. The amount step and the preview each start with a One-time / Daily `SegmentedControl` (`tone="neutral"`, two columns, `rounded-2xl`). A Donation / Credit pill sits under One-time / Daily, same classes, Donation pressed by default. The photo and text steps do not show either pill. Default cadence is once. One-time / Daily is not posted. The post itself sends `goalCurrency` and `goalAmount`. Only Credit is posted as `goalRepayable` true, together with `goalTermDays`. A donation stays on the four steps. A credit, after the amount, explains that the debt is fixed in the selected currency (bitcoin uses a shorter sentence, with no conversion, and warns that a rising bitcoin price can hurt the author because they bear the full price movement; a fiat credit says payments stay bitcoin and are only priced in that currency at the rate of each payment, not exchanged, and that the author receives bitcoin and bears the full price risk if the price falls before they spend it), then offers 30 days, 1 year, 2 years, or a custom whole number of days from 1 to 3650, then states that repayment is daily and starts the day after the credit is paid in full, and shows the daily amount. The next screen repeats the amount, the currency sentence, the term, the daily rule, and the daily amount. Its button confirms the author wants the credit. The screen after that states the daily plan, and its button confirms the author can repay that plan. There is no checkbox. Photos are step 7 of 9, the message is step 8 of 9, and the preview is step 9 of 9 with **Credit** pressed, a **Loan** tag beside the author, and the daily plan. **Post** is the only submit. The credit counter reads n of 9. The daily amount is the total split across the days, and any remainder is added to the last day. A fiat-draft preview shows the typed amount plus local Bitcoin and no third currency; a Bitcoin-draft preview shows Bitcoin plus the current spot rate.
- **Inputs:** `step` / `onStepChange`, `askDraft` / `onAskDraftChange`, `draft` / `onDraftChange`, `posting`, `photoDrafts`, `videoDraft`, `onPickFiles`, `onRemovePhoto`, `onClearPhoto`, `authorName`, `onPost`, optional `rateDay` (Bitcoin-draft preview counterpart of the typed ask), optional `composerMaxLength` (default `FORUM_MESSAGE_MAX_LENGTH`, 8000), optional `askCadence` (`'once'` | `'daily'`, default once) and `onAskCadenceChange`, optional `askObligation` (`'donation'` | `'credit'`, default donation) and `onAskObligationChange`.
- **Returns / side effects:** React tree. The One-time / Daily pill and the Donation / Credit pill are on step 1 and step 4. Continue on step 1 stays disabled until the parsed sats are 1..10_000_000. Continue on step 2 goes to step 3 with photos optional. Step 4 **Post** stays disabled without text, photo, or video, then calls `onPost`. No network.
- **Used by:** `ForumBoard` when `composeIntent` is `ask`.

## Function: parseForumAskAmount

- **Purpose:** Parse the Ask amount draft into a whole-sat goal.
- **Inputs:** `raw` string.
- **Returns / side effects:** Integer 1..10_000_000, or `null` when empty, non-digits, 0, or above the max.
- **Used by:** `ForumAskWizard`, `ForumLoader`.

## Function: parseCreditTermDays

- **Purpose:** Days a credit is repaid over. Presets are 30, 365, and 730. Custom is a typed whole number.
- **Inputs:** Preset `30` | `365` | `730` | `'custom'`, and the raw custom field.
- **Returns / side effects:** Day count from 1 to 3650, or `null` when custom is empty, not digits, or out of range. No I/O.
- **Used by:** `ForumAskWizard`.

## Function: creditSmallestUnits

- **Purpose:** Smallest units of a typed credit. Bitcoin is whole sats. Fiat is cents.
- **Inputs:** Amount draft and whether that draft is bitcoin.
- **Returns / side effects:** Non-negative bigint, or `null` when the draft is not that shape. No I/O.
- **Used by:** `ForumAskWizard`, `ForumGoalBar`.

## Function: splitCreditPlan

- **Purpose:** Split a credit into equal daily units. Any remainder is added to the last day so the days sum to the debt.
- **Inputs:** Total sats or cents, and a day count from 1 to 3650.
- **Returns / side effects:** `{ perDay, last, days, remainder }`, or `null` when the day count is outside that range. No I/O.
- **Used by:** `ForumAskWizard`, `ForumGoalBar`.

## Function: ForumGoalBar

SVG progress bar for a top-level forum note. One SVG: orange fill in user units 0–100; overflow past 100% continues in green (`app-success`) from `x=100` at most another 100 units (visual max 200%). The `{percent}%` label is a sibling, so it stays readable, and is uncapped (110, 250, …). Above the track, the posted line is never one currency when a visitor figure exists. Ask label, then the defined fiat when `goalCurrency` is USD/CHF/EUR/PHP, then `formatBitcoin(goalSats)`, then the visitor's default fiat unless the ask was defined in that same fiat. That visitor figure is the frozen snapshot when the string is present, otherwise the spot rate when one is loaded. If neither exists, the line stays bitcoin. Joined with `·`. A legacy ask (`goalSats`, no `goalCurrency`) is bitcoin plus the visitor's fiat when that figure exists. Renders nothing when `goalSats` is missing or `<= 0`. Lengths use SVG `width` / `x` / `viewBox` attributes, not React `style`.

- **Purpose:** Show collected-versus-goal progress on a top-level note that has a positive `goalSats`. BTC and legacy use `forumGoalPercent(sats, goalSats)`; a fiat Ask uses `forumFiatGoalPercent` of the payment snapshot (`null` collected is 0%, not sats). Orange through 100%, green overflow, uncapped label. The amount line pairs currencies when a visitor figure exists: defined fiat plus bitcoin when the ask is in the visitor's fiat; otherwise bitcoin plus the visitor's fiat (snapshot, or the spot rate when the snapshot is missing and a rate is loaded). If neither a snapshot string nor a loaded rate exists, a bitcoin ask stays bitcoin. A third fiat is shown only when the definition currency is a different fiat. A repayable ask shows a **Loan** tag beside the author. Any other ask shows a **Donation** tag. Pressing the tag explains it. The bar does not repeat that sentence. A shop note keeps the **#Shop** link.
- **Inputs:** `sats` (collected), `goalSats` (whole-sat counterpart), optional `goalCurrency` / `goalAmount` / goal snapshots / payment snapshots, optional `rateDay`, optional `preview`, optional `goalRepayable`, optional `goalTermDays`, optional `messageId` (posted credit; omitted in the wizard), optional `ledgerCollapsed` (feed and profile show a **Repayment list** link to `/messages/<id>/repayment-list` and do not mount `CreditLedger`; the open note leaves it false and renders `CreditLedger` with `list="summary"`). Non-positive or non-finite `goalSats` yields `null`.
- **Returns / side effects:** The bar, or `null`. A posted credit with `messageId` and `ledgerCollapsed` false loads the public ledger (`CreditLedger` summary), which fetches `GET /messages/:id/repayment`. When `ledgerCollapsed` is true the bar shows only the **Repayment list** link and does not fetch. No other network.
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

Defined Ask amount for the goal line. Prefix `$` for USD and `₱` for PHP, otherwise `CODE `. At most two fraction digits pad to two (`200` → `₱200.00`). More than two keep every digit (`10.125` → `₱10.125`). One comma is the decimal mark. Grouping uses the visitor number format. Not the two-decimal snapshot formatter.

- **Purpose:** Show `goalAmount` exactly, not the two-decimal snapshot of the same currency.
- **Inputs:** `amount` string, fiat `code`, number-format `style`.
- **Returns / side effects:** Prefixed string, or `''` when the amount cannot be shown. No I/O.
- **Used by:** `ForumGoalBar`.

## Function: RepaymentPlanChart

- **Purpose:** Draw the repayment plan. Each day is a bar for the amount due that day. A line starts at the whole debt and falls to zero on the last day. The horizontal axis is the first day and the last day. When the credit is fully given those labels are the UTC dates. Before that they are day numbers. The words **Per day** and **Still owed** name the bar and the line.
- **Inputs:** `amounts` (one positive number per day, same unit), `from`, `to`, and `totalText` (the whole debt, already formatted).
- **Returns / side effects:** A figure, or `null` when every amount is missing. No network.
- **Used by:** `CreditLedger`, `ForumAskWizard` plan and confirmation.

## Function: revealInScrollport

- **Purpose:** Keeps a focused field or reply form inside the one active scrollport. A target taller than the scroller minus 24px is aligned to the scroller bottom minus 12px. Otherwise only a bottom or top overflow is corrected by that same 12px margin. It never calls `scrollIntoView` and it never scrolls the document.
- **Inputs:** The active scrollport element and the target element (input, textarea, select, or reply form).
- **Returns / side effects:** Void. Mutates that scrollport's `scrollTop` only. No network and no `window` scroll.
- **Used by:** `revealReplyForm`, `ForumBoard` composer and reply focus, `useAppHeight` after a viewport change.

## Function: revealReplyForm

- **Purpose:** Keeps a forum reply form inside the AppShell scroller by delegating to `revealInScrollport` after the null guards. That helper also corrects a top overflow and a target taller than the scroller. A missing scroller or form leaves the scroll position unchanged.
- **Inputs:** The shell scroller (`HTMLElement` or null) and the reply `<form>` (or null).
- **Returns / side effects:** Void. Mutates that scrollport's `scrollTop` only when both arguments are present. No network. No `scrollIntoView`.
- **Used by:** `ForumBoard` after an expanded reply composer is laid out, and only when no pay sheet is open.

## Function: revealPaySheet

- **Purpose:** Pulls an open pay sheet back into the AppShell scroller only when a jump has placed its top above the shell. A sheet that starts below the fold is left alone, so the note above it stays on screen. The reply composer is not pinned while a sheet is open.
- **Inputs:** The shell scroller (`HTMLElement` or null) and the pay sheet element (or null).
- **Returns / side effects:** Void. When the sheet top is above the shell, subtracts that gap from `scrollTop`. A sheet that starts below the fold, a missing scroller or sheet, and a top that is already inside leave the scroll position unchanged. No network.
- **Used by:** `ForumBoard` while a pay sheet is mounted, including when that sheet or the reply form changes size.

## Function: ForumVideo

- **Purpose:** Playable note video. No native controls; one play button while paused; a click on the playing video pauses it; the fullscreen button sits in an absolutely positioned wrapper because the small icon button stays relative; the frame is `mx-auto w-fit` so the picture stays centered and both controls sit on it. The fullscreen button calls `requestFullscreen` on that frame, or `webkitEnterFullscreen` when that API is missing. Composer and ask previews do not use it.
- **Inputs:** Native video attributes except controls, controlsList, and playsInline.
- **Returns / side effects:** The video, play button, and fullscreen button. No network.
- **Used by:** `ForumBoard` feed video, `PublicMessageLoader` public note video.

## Function: ForumBoard

- **Purpose:** Presentational public forum: each post card body without the action row is the expand/collapse control (`forum.expand` / `forum.collapse`, `role="button"` wrapping header, media, and body text, not an `IconButton`; the footer ₿ amount button and the reply-count button (when shown) also call `onToggleExpand`; React on every top-level note (`forum.react`, lucide Reply; expands the reply composer; omitted when `deletedAt` is set), **Pay today's repayment** for the signed-in author of a top-level repayable note when `sats >= goalSats` and the note is not deleted (disabled while `payBusy` or while `payInvoice.messageId` is this note; a `repayNotice` error renders `role="alert"` (`rateLimit`, `authorWallet`, or `request`)), **Translate** (Languages icon, `controlSlotId` on `TranslatableNoteBody` in this row), a copy-link `IconButton` on every note and every reply, optional Gift on a payable reply, and optional delete sit outside that control as sibling `IconButton`s that `stopPropagation`; when `shopNoteEdit` is set, the shop pencil sits in that right-hand footer after copy and before the place control, and the reply count stays in the left group; when `shopPlaceEdit` is set, a compact place control (**Add a place** or **Edit place**) sits in that footer after the pencil and before the account control; when `shopAccountEdit` is set, a compact account control (**Add an account** or **Edit account**) sits after the place control; Gift/Delete/reply composer also omit when `deletedAt` is set). Optional dismissible living-room laws hint box (X control; two laws plus links to `/rules` and `/contact`) when `lawsVisible`, Active/No gifts yet/All/Most popular `ForumModeSelect` (closed dropdown; selected label and chevron on the trigger; unpaid count chip on the closed trigger when `unpaidNewCount` > 0 and unpaid is not selected), list of posts (name, the author row uses `MessageKindTags` (Loan and Donation buttons that show a sentence, `#Shop` stays a link), optional Founder / Moderator / Initiator / Verified role pill on notes **and replies** when `role` is one of those four (`basis` has no pill), top-level shop notes show a `#Shop` link to `/shops` and hide `#21GiftsShop`, timestamp, optional inline photo from blob URLs (single still when `photoCount` ≤ 1; a horizontal snap row (`ForumPhotoGallery`, `data-scroll-x`, 88% peek) when `photoCount > 1` — sideways only, `current/total` chip, dots of loaded blob URLs keyed `${id}:${index}`) then caption text below the photo, a link to `/shops?pin=<id>#map` (the label, or coordinates when the label is null) on a top-level note that has a place, an `@username` link to `/members/{id}` on a top-level note that has a shop account, optional inline `<video>` playback for notes with video (player keeps the clip aspect ratio with `max-h-80 max-w-full`, no full-width black canvas), remaining body text through `ForumQuotedBody` / `ForumNoteText` (280-character preview plus `forum.showMore` only when the body is longer than 560 on the feed; signed-in `/messages/[id]` passes `truncate={false}` so the original stays full), **Translate** (Languages icon) / Show original / Show translation in the footer icon row via `TranslatableNoteBody` (`controlSlotId`), which portals `NoteTranslate` with `placement="row"` when the board has that row, a reply or note with `via === 'nostr'` (a Nostr zapper with no 21.gifts account) renders an **External** button in place of a role pill, sharing the same per-message hint toggle state as the role pill's hint, and renders its body via `TranslatableNoteBody` `plain` (no quoted-note unfurl, URLs stay visible text) instead of `ForumQuotedBody`, ₿ amount plus optional preferred-fiat `·` `formatFiatDisplay` of the amount stored when the payment was made (a stored string as-is; a null or missing field on a passed payment uses the spot rate) with a Gift pay icon only when the card is a payable reply (`parentId` set); the card's copy control is labelled `forum.copyReplyLink` when the card is a reply and `forum.copyLink` otherwise, and always copies the card's own origin `/l/<8 hex>` (first UUID group) when that id is a UUID, otherwise origin `/messages/<id>`) or empty/loading/error, messenger-style composer (**Send a post** / **Ask for money** pill; Post is **Add a photo or video** ImagePlus, then **Add a place** (MapPin, `PlaceField`) when `onPlaceDraftChange` is set, left of the textarea, **Post** Send icon to the right; Ask is `ForumAskWizard` (the amount step and the preview open with the One-time / Daily pill; the photo and text steps do not); when `allowAsk` is false the Post/Ask pill and Ask wizard are omitted; `shopComposer` shows `ShopAddWizard` instead of the post composer), optional photo draft preview (**Selected photo**) when `photoDrafts.length === 1` with **Remove photo** X, composer gallery when `photoDrafts.length > 1` (`ul` of **Selected photo** alts + per-index **Remove photo**), optional video draft preview with **Remove video** X — icon-only, catalog `aria-label`s, `maxLength` from optional `composerMaxLength` (default 8000)), in-card reply composer (amount row first: `AmountEntry` `layout="inline"` `id="forum-reply-amount"` with the bitcoin/fiat switch on that same line, then one text line and Post aligned beside it), and a pay sheet on a payable reply or, when `payHost` is `composer`, on the top-level composer: amount form with a live equivalent in the preferred fiat only when the conversion is non-null (no picker; after mint the equivalent uses the invoice amount, not an empty draft's 21-sat default), then every user-agent amount CTA is **Continue** (`forum.payContinue`) and only requests the invoice; after mint every user-agent shows the same invoice card (confirm sentence and the `WalletPay` pay slot; no invoice QR and no button that hands the payment to another wallet app); Close (`X`) dismisses the sheet and stays on the page. That control is not Back. Gift-only replies show **send ₿…** (`forum.giftReply`) plus the same optional preferred-fiat `·` as notes; a reply with text and sats shows that formatted amount under the text. When `receivedSats` is greater than zero, `forum.receivedOnReply` is a separate line and is not added to `sats`. A text reply that has both uses `forum.sentOnReply` for the sent line, and the two lines share a left rule. Clicking a role pill toggles a short explanation under that card header (one open at a time). Selector stays visible in every board state unless `modeSelector` is false or `composerHidden` is true. When `modeSelector` is false the list is every loaded row (mode all), including zero-sat basis notes; an empty loaded list still uses `emptyKey`, not `forum.emptyPaid`. Uses optional `emptyKey` (`forum.empty` default, `shops.empty` on shops) when the loaded list is empty, `forum.emptyPaid` when Active or Most popular hide every loaded row (Most popular remains paid-only; Active also keeps unpaid moderator notes; a top-level note with `goalSats` > 0 and zero sats is not Active), and `forum.emptyUnpaid` for No gifts yet when that filter hides all loaded rows. Props `messages` are newest-first (API window); Active, No gifts yet, and All keep that order (newest at the top). Most popular stays sats-descending. The composer sits under the mode selector / filters, above the newest-first list; replies remain oldest-first. When `onRefresh` is passed, pull-to-refresh from the top of the AppShell inner scroller (`useAppShellScroller`) calls it; while `refreshing` (or a pull that reached the arm threshold) a visually hidden (`sr-only`) `role="status"` with `forum.refreshing` is mounted for assistive tech only — idle markup has no status node so welcome screenshots stay unchanged. When `newPostsAvailable` is true, a labeled primary `Button` (`forum.newPosts`, decorative lucide `ArrowUp`) is `sticky top-2` in the scroller; the node is omitted when the flag is false. When `moderatorAppointedAvailable` is true, a labeled primary `Button` (`forum.moderatorAppointed`, size `sm` with `shadow-lg`, decorative lucide `ArrowUp`) in the same visual language as New posts is `sticky top-2` when it is the only pill and calls `onShowModeratorAppointed`; the node is omitted when the flag is falsy. When both this and `newPostsAvailable` are true, the appointment pill stays `sticky top-2` and New posts is `sticky top-14`. Listens for `FORUM_COMPOSE_EVENT` / `requestForumCompose`: focuses the new-post textarea with `preventScroll` and then `revealInScrollport` when the shell scroller exists and consumes pending compose only when that textarea exists (`composerHidden` boards keep the flag). `/messages/<uuid>` and `http(s)://<host>/l/<8 hex>` HTTP(S) URLs in a body unfurl into a nested post and the URL is removed from the visible text once that note loads. The invoice card's pay control (forum pay sheet, composer pay slot, and today's repayment) is `WalletPay`, which pays from the member's in-app wallet (`sparkInvoice` when the api issued one, otherwise `pr`); it is the only way to pay there.
- **Inputs:** `ForumBoardProps` — `messages`, optional `readOnly` (signed-out living room: no composer, pay, delete, or @mention links; an author name with a non-empty `accountId` is still the profile button, including when `readOnly` is true; Enter or Space on that button opens the profile and does not toggle the card, because the card key handler ignores a descendant target; the mode selector stays), `error` (boolean load-failure flag), `loading`, optional `refreshing` / `onRefresh` (omit `onRefresh` to disable pull-to-refresh), optional `newPostsAvailable` / `onShowNewPosts` (pill omitted when the flag is falsy), optional `moderatorAppointedAvailable` / `onShowModeratorAppointed` (pill omitted when the flag is falsy), `posting`, `draft`, `onDraftChange`, `askDraft` / `onAskDraftChange`, optional `allowAsk` (default true; false omits the Post/Ask pill and the wizard) / optional `composeIntent` / `onComposeIntentChange` / `askStep` / `onAskStepChange` / `askCadence` (`'once'` | `'daily'`, default once) / `onAskCadenceChange` / `authorName`, `onPost`, `onRetry`, `formError` (`empty` / `tooLong` / `ask` / `request` / `rateLimit` / `unsupported` / `tooLarge` / `tooMany`; `ForumFormError = 'empty' | 'tooLong' | 'ask' | 'request' | 'rateLimit' | 'unsupported' | 'tooLarge' | 'tooMany' | null`), controlled `mode` / `onModeChange`, optional `modeSelector` (default true), optional `nearEndRef` (callback ref on the visible note about eight rows from the end so `ForumLoader` can prefetch the next page; when the loaded list is empty it sits on the empty-feed line instead, so a page whose notes were all dropped by the list schema still leads on to the next page), optional `unpaidNewCount` (default 0), required `lawsVisible` / `onDismissLaws`, `photoDrafts` (`ForumPhotoPayload[]`), `placeDraft` (`ForumPlacePin | null`), optional `onPlaceDraftChange` (omit it and the place control is absent, so replies have none), `videoDraft`, `onPickFiles(files: File[])`, `onRemovePhoto(index: number)`, `onClearPhoto`, `photoUrls`, `videoUrls`, optional `composerHidden` (hides the new-post composer; the textarea is absent so compose-pending is not consumed), optional `composerMaxLength` (default `FORUM_MESSAGE_MAX_LENGTH`; shops pass 7986 so the `#21GiftsShop` suffix fits), optional `emptyKey` (`forum.empty` default, `shops.empty` on shops), plus pay sheet props (`payMessageId`, optional `payHost` (`composer` keeps the sheet on the top-level composer; `card` binds to the matching parent or reply; omit/`null` infers from the list), `payDraft`, `payBusy`, `payError` (`amount` / `request` / `rateLimit` / `authorWallet` / `deleted`), `payInvoice`, optional `replyPayPreview` (`string | null`, default `null`; when set with a matching card invoice, `ForumReplyPayPage` replaces the reply composer), `payWaiting`, optional `rateDay` (`FiatRateDay | null`; omit or `null` leaves unsent previews bitcoin-only because no rate is loaded; a present `rateDay` is the spot rate when no stored string exists; a stored string stays visible), `onPayOpen`, optional `viewerAccountId`, optional `onRepay`, optional `repayNotice` (`rateLimit` / `authorWallet` / `request` as `role="alert"` on that card), `onPayDraftChange`, `onPaySubmit`, `onPayCancel`), expand/replies (`expandedId`, `onToggleExpand`, `replies`, `repliesLoading`, `repliesError`, `onRetryReplies`, reply composer with optional `replyAmountDraft` / `onReplyAmountDraftChange`, `replyFormError` including `amount` for a non-numeric or overflowing paid-reply sats field, `deleted` when that note is missing or was deleted, and `authorWallet` (`forum.payErrorAuthorWallet`) when the author's wallet cannot take a paid reply), optional `shopComposer` (shops; `ShopAddWizard` instead of the post composer), `shopUsername` / `onShopUsernameChange` / `shopResetToken`, optional `shopNoteEdit` / `onShopNoteUpdated` (moderator pencil on a top-level shop note), optional `shopPlaceEdit` (true on shops; the footer place control is absent when omitted) and `onShopPlaceUpdated` (applies a saved or cleared pin to that row), optional `shopAccountEdit` (true on shops; the footer account control is absent when omitted) and `onShopAccountUpdated` (applies a saved or cleared shop account to that row), and optional `onDeleted` (moderator `DeletePostControl` on the parent footer and on nested replies with `kind="reply"`), optional `permalinkTargetId` (nested reply ring only: `data-permalink-target="true"` and `ring-1 ring-app-fg`; parent notes are not ringed), and optional `truncate` (default true; `PublicMessageThread` passes false). Gift-only replies (`text === ''` and `sats > 0`) render `forum.giftReply` with `formatBitcoin` plus the same optional preferred-fiat `·` `formatFiatDisplay` suffix as notes (the spot rate when the stored field is null or missing); text plus a gift shows that formatted amount under the text. `receivedSats` greater than zero adds `forum.receivedOnReply` with the received fiat fields, not a sum. A text reply with both amounts labels the sent line `forum.sentOnReply`. The video-draft X still calls `onClearPhoto`; each photo-draft X calls `onRemovePhoto(index)`.
- **Returns / side effects:** React tree. Copy-link always copies origin `/l/<8 hex>` (first UUID group) when the id is a UUID, otherwise origin `/messages/{id}` — a note copies its own id, a reply copies its own id (no parent resolution). Filters via `visibleForumMessages`. Load error copy is `forum.error` via `t()`, never `Error.message`. Formats timestamps via `formatForumTime`. Hides empty text paragraphs; never points `<img src>` at `/messages/.../photo` without a blob URL. Feed video is `ForumVideo` (no native controls; one play button while paused; one fullscreen button on the picture). Inline feed `<video>` keeps the clip aspect ratio (`max-h-80 max-w-full`, no full-width black canvas). A failed `<video>` `error` event hides that player (photo fallback when a blob URL exists). Clicking a role pill toggles a short explanation under that card header (one open at a time). Dismiss control calls `onDismissLaws` only; persistence is owned by `ForumLoader`. ForumBoard itself does not fetch; nested `NoteTranslate` GETs `/translate` on mount and POSTs on **Translate**. No mode state of its own. After `onPaySubmit` resolves to an invoice, ForumBoard does not `window.location.assign`; every user-agent shows the same invoice card, whose pay slot is `WalletPay` (the in-app wallet only); the card mounts no `QrCode`. A `FORUM_COMPOSE_EVENT` focuses the new-post composer when it is mounted; a `composerHidden` board leaves pending compose set for a later visible board. While a pay sheet is open, `revealPaySheet` runs instead of `revealReplyForm`. The scroll position from before the sheet opened is restored, so inserting the sheet does not scroll the note away, and a sheet that starts below the fold is not pulled to the top. The reply composer on that note is disabled while its invoice card is open and no reaction preview is set. A paid reaction replaces the reply composer with ForumReplyPayPage and the typed sentence is the preview. Gift-on-reply and composer-hosted sheets stay ForumPaySheet. The close control sits in an absolutely positioned wrapper at the sheet's top left, because the small icon button itself stays `relative`.
- **Used by:** `ForumLoader`, `MemberProfileScreen`, `PublicMessageThread`.

Optional `firstPostFree` (default false) adds the muted line `forum.firstPostFree` (**Your first post is free.**) under the message composer row, below Post. It is plain text, not a control, and only the message composer shows it; the Ask wizard and Add a shop do not.

## Function: ReplyDirectionAmounts

- **Purpose:** Money on a reply. What the author sent and what later arrived stay two lines and are never added. A gift-only reply (`text === ''` and `sats > 0`) is `forum.giftReply`. A reply with text and sats, and no later receipt, is the bare formatted amount under the body. When `receivedSats` is greater than zero, that receipt is `forum.receivedOnReply` on its own line. A text reply that also sent sats labels that line `forum.sentOnReply`, and the two lines share a left rule. Zero or a missing receipt draws no received line. Nothing to show returns null.
- **Inputs:** `text`, `sats`, optional `receivedSats`, `rateDay`, `fiat`, `numberFormat`, optional `sent` fiat fields for `sats`, optional `received` fiat fields for `receivedSats`.
- **Returns / side effects:** React element, or null when both amounts are absent. No network. Bitcoin via `formatBitcoin`. Fiat via `preferredFiatSuffix` (stored string, otherwise the gift-day rate).
- **Used by:** `ForumBoard` on every nested reply, and `PublicThreadCard` in `PublicMessageLoader` when the unsigned card is a reply with `receivedSats` greater than zero.

## Function: ForumPaySheet

- **Purpose:** The amount form and invoice card already used for a payable forum reply. A habit comment uses this same sheet: Amount, Continue, then the confirmation and the in-app wallet pay slot (`WalletPay`). It does not show the raw invoice or an invoice QR. Close stays on the page.
- **Inputs:** `messageId`, the pay draft, busy, error, invoice, waiting flag, draft and unit callbacks, submit, cancel, the gift-day rate, optional `ratePending` (default false; Continue does not submit while it is true), and a click handler so the sheet does not toggle the card under it.
- **Returns / side effects:** The in-card sheet (`data-pay-sheet`). Continue calls `onPaySubmit` only when it is not busy and `ratePending` is false. After mint the card mounts `WalletPay` with the invoice's `sparkInvoice`, `pr`, and `amountSats`. No network of its own.
- **Used by:** `ForumBoard` and `HabitComments`.

## Function: ForumReplyPayPage

- **Purpose:** Replaces the reply composer after a paid reaction is sent: it is a component in that same slot, not a new URL, and shows only a read-only preview of the submitted reply, the **Pay ₿…** amount line with the preferred-fiat suffix, the `WalletPay` pay slot, which pays from the member's in-app wallet (`sparkInvoice` when the api issued one, otherwise `pr`), and **Waiting for payment…** while polling. It shows no invoice QR.
- **Inputs:** `preview` (raw submitted text; a trimmed-empty string omits the paragraph), `amountSats`, `pr`, optional `sparkInvoice`, `payWaiting`, `rateDay`, `onCancel`.
- **Returns / side effects:** React element with `data-reply-pay-page` and `data-pay-sheet`. Close (`X`) calls `onCancel` and stays on this view. It is not the top-left back arrow. There is no button that hands the payment to another wallet app. An empty trimmed preview omits the paragraph. The preview paragraph uses `pl-12` so the close control, including its hit slop, does not cover the first glyphs.
- **Used by:** `ForumBoard`.

## Function: ContactLoader

- **Purpose:** Client loader for in-app contact on `/contact`. Session from `useAuthStore`; returns null without a session. Posts via `postContact`. On success fetches conversations and navigates to `/messages` or `/messages?c=` for the official 21.gifts thread. No local success-hide of the form. Uses `nextContactRequirement` so missing name/rules open `RequirementsOverlay` (no Skip); a wallet is not required for contact.
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

## Function: middleware

- **Purpose:** Send an old `/map` address to the shops map. There is no map page.
- **Inputs:** The incoming request whose path is `/map`.
- **Returns / side effects:** Redirect to `/shops#map`. A query string such as `?pin=` is kept (`/shops?pin=#map`).
- **Used by:** Route `/map`.

## Function: PlacesMapScreen

- **Purpose:** Presentational map card: heading **Map**, then every live forum pin from `fetchPlaces`. Without a Google key the pins are links. With a key the same pins are also markers. A 21.gifts author name links to `/members/:accountId`; an external name stays text. Pin rows link with `next/link`, so opening a member or a note keeps the document. A moderator sees the shop pencil on a pin with `shop: true`; it loads that note and opens the same steps as editing a shop post. A failed load shows `forum.editShopNoteLoadFailed`, not the save-failure sentence. `embedded` returns that body without the heading or card. A long pin name or label wraps inside the row. With a key, one pin, or a `?pin=` that matches a pin, centers that pin at zoom 14. Several pins and no matching `?pin=` frame every pin (`fitBounds`, padding 32). A fitted zoom above 14 is set back to 14.
- **Inputs:** Optional `embedded` (default false). Catalog via `useTranslations`. Session from `useAuthStore`. Optional `?pin=` id.
- **Returns / side effects:** `Card maxWidth="xl"` `surface={false}`, or only the body when `embedded`. Fetches places and `/maps/key`.
- **Used by:** `ShopsScreen`.

## Function: fetchPlaces

- **Purpose:** Load every live top-level forum pin for the signed-in session.
- **Inputs:** `sessionToken` bearer.
- **Returns / side effects:** `ForumPlaceRow[]` from `GET /forum/messages/places`. A row may include `shop: true` when the note is a shop. Throws the visitor-facing load error on a non-2xx status, a network failure, or a body that fails the schema.
- **Used by:** `PlacesMapScreen`.

## Function: proxyMessagesPlacesGet

- **Purpose:** Same-origin Bearer proxy of api `GET /messages/places`.
- **Inputs:** Incoming request.
- **Returns / side effects:** The upstream response. No session of its own.
- **Used by:** `GET /forum/messages/places`.

## Function: PlaceField

- **Purpose:** Optional place control on the top-level forum composer, and the compact editor a moderator uses on a shop note. Opens a map when `/maps/key` returns a key. Confirm stores `{ lat, lng, label }`. No key shows the unavailable sentence and does not confirm a pin. On the device's local Sunday neither the preview nor the map panel is rendered; the pin stays inside the Sunday writing gate. Otherwise, once the frame box is measured, the preview and the map panel are fixed to the window and kept inside the app frame, and are not sized from the viewport (`vw`). Until that box is measured they sit under the pin as an absolute anchor. The map shrinks so the confirm control stays inside the window, and the page still has one scroller.
- **Inputs:** `place`, `disabled`, `onChange`. Optional `buttonSize` (`lg` default, or `sm`), `buttonVariant` (`secondary` default, or `ghost`), `showPreview` (default true), `ariaLabel` (default **Add a place**), and `onCommit`. Without `onCommit`, Done and Remove call `onChange` and close. With `onCommit`, those buttons wait; a rejection keeps the panel open and shows the save error; a success closes without calling `onChange`. When preview is hidden and a pin is already set, Remove stays inside the open panel, including when the map is unavailable.
- **Returns / side effects:** Attach button, optional preview, and panel. Fetches `/maps/key` when opened.
- **Used by:** `ForumBoard` (top-level composer) and `ShopPlaceControl`.

## Function: fitBoxInFrame

- **Purpose:** Places one popover inside the app frame. The width is the preferred width when it fits, otherwise the room between the insets. The left edge stays on the anchor unless that would cross an inset. Vertically it opens downward when that side has at least 280px and at least as much room as above, otherwise upward, otherwise from the top inset across the whole frame height. It returns null when the frame has no positive room or the preferred width is not positive.
- **Inputs:** Frame left, right, top, and bottom, anchor left, top, and bottom, gap, preferred width, inset, and viewport height, all in pixels.
- **Returns / side effects:** `{ left, width, maxHeight, top, bottom }` with exactly one of top or bottom set, or null. No DOM writes and no network.
- **Used by:** `PlaceField` for the place preview and the map panel.

## Function: pageFrameProblems

- **Purpose:** Reads the live document and lists sideways scroll of the document, sideways scroll of the active page scroller, and boxes whose border box leaves the window by more than one pixel on the left, right, top, or bottom. Content inside `[data-scrollport]` may sit past the top or bottom of the window unless it is position:fixed. A position:fixed box is still reported. A box inside `[data-scroll-x]` is ignored for the horizontal check unless it is position:fixed and its border box already crosses the left or right edge of the window. The sideways row itself is not ignored.
- **Inputs:** None. Uses the open document, `window.innerWidth`, and `window.innerHeight`.
- **Returns / side effects:** A string array. Empty means the page stays in the window. No DOM writes and no network.
- **Used by:** `shotScreen` in `e2e/visual.spec.ts`, before every screenshot, and the behavior test `Function: pageFrameProblems`.

## Function: ShopPlaceControl

- **Purpose:** Moderator-only place editor on a listed shop note. Hidden on replies, hidden notes, non-shop text, unsigned sessions, and ranks below moderator.
- **Inputs:** `message` (top-level shop note) and `onUpdated` (message id plus the saved pin, or `null` when cleared).
- **Returns / side effects:** Compact `PlaceField` (`showPreview` false, small ghost **Add a place** / **Edit place**). `onCommit` calls `setMessagePlace`; a failed save keeps the panel open and shows `forum.placeSaveFailed`.
- **Used by:** `ForumBoard` when `shopPlaceEdit` and `onShopPlaceUpdated` are set (`ForumLoader` `feed="shops"`).

## Function: ShopNoteEditControl

- **Purpose:** Moderator-only pencil on a listed shop note. Opens the same five steps as adding a shop, already filled in, plus the edit history. Hidden on replies, hidden notes, non-shop text, unsigned sessions, and ranks below moderator.
- **Inputs:** `message` (top-level shop note), `onUpdated` (the saved note), optional `existingPhotos`, optional `existingVideoUrl`, and optional `startOpen`.
- **Returns / side effects:** Small ghost pencil (**Edit shop note**). The summary button is **Save changes**. It writes only the text, place, account, or stills that changed. A video stays. Already-shown stills are copied onto addresses this editor owns before the steps open, so a partial save can revoke the feed addresses without blanking the open editor. A failed copy opens the steps with `forum.editShopNoteFailed` and no stills, and does not revoke the feed addresses. Stills are not replaced unless every current still loaded. A failed save keeps the panel open and shows `forum.editShopNoteFailed`. History rows show who, when, and the field (text, place, or account). A failed history load shows `forum.editHistoryFailed`.
- **Used by:** `ForumBoard` when `shopNoteEdit` and `onShopNoteUpdated` are set (`ForumLoader` for a moderator on every feed), `ShopTable`, and `PlacesMapScreen` for a pin with `shop: true`.

## Function: ShopAccountControl

- **Purpose:** Moderator-only shop-account editor on a listed shop note. Hidden on replies, hidden notes, non-shop text, unsigned sessions, and ranks below moderator.
- **Inputs:** `message` (top-level shop note) and `onUpdated` (message id plus the saved `{ id, username, name }`, or `null` when cleared).
- **Returns / side effects:** Small ghost **Add an account** / **Edit account** (User icon). The open field starts at `@`, or `@username` when an account is already attached, and the same People list as a forum post is visible immediately. Choosing a row fills `@username`. A space or any other non-username hides the list. The panel is fixed to the window so the page does not scroll sideways. A typed prefix immediately drops usernames that do not start with it. It shows at most eight people and does not scroll on its own. Rows drop until the box fits under the app chrome, and the list hides rather than covering that chrome. **Save account** strips one leading `@`. Optional **Remove account**. Empty or unknown username shows `forum.shopAccountMissing` and keeps the panel open; other failures show `forum.shopAccountSaveFailed`. Success calls `setMessageShopAccount` then `onUpdated` and closes.
- **Used by:** `ForumBoard` when `shopAccountEdit` and `onShopAccountUpdated` are set (`ForumLoader` `feed="shops"`).

## Function: ShopsPage

- **Purpose:** Next.js page for `/shops`. Flow `AppShell` (`align="start"`) with `ProfileChromeLeft` + `SignedInChrome`, `OnboardingGate` `screen="welcome"`, and `ShopsScreen`. No `route.ts` beside the page.
- **Inputs:** None.
- **Returns / side effects:** The shops screen.
- **Used by:** Route `/shops`.

## Function: ShopsScreen

- **Purpose:** Presentational shops card: heading **Shops**, lead `shops.lead`, a **Post** / **Map** / **Table** pill, then the selected body. **Post** is `ForumLoader` `feed="shops"`. **Map** is `PlacesMapScreen` `embedded`. **Table** is `ShopTable`. A plain click on a link to a view of this same page (a place in the post list or the table opens `/shops?pin=…#map`) selects that view once the click is dispatched (no or an unknown hash is Post, as on load, so the top-left arrow back to `/shops` shows the posts), because the client-side push fires no `hashchange`. The push keeps the entry the link was clicked from, so browser Back (`popstate`) returns to that view. Links with a `target` or `download` are left alone.
- **Inputs:** Catalog via `useTranslations`. The view stays unset until the hash is read. `/shops#map` and `/shops#table` open that view; `/shops#post`, a missing hash, or an unknown hash open Post. Choosing an option writes the same hash. Post clears it.
- **Returns / side effects:** `Card maxWidth="xl"` `surface={false}`. The post list, map, and table mount only after the hash is read. The map and table fetch only after their option is selected.
- **Used by:** `ShopsPage`.

## Function: ShopsViewSwitch

- **Purpose:** Neutral `SegmentedControl` labelled **Shop view** that switches the shops page between post, map, and table.
- **Inputs:** `value` (`post`, `map`, or `table`) and `onChange`.
- **Returns / side effects:** A `SegmentedControl` `tone="neutral"`. The pressed option uses the app button fill. No network.
- **Used by:** `ShopsScreen`.

## Function: ShopTable

- **Purpose:** Table of shop notes with name, place, and operator. A moderator sees the same shop pencil on each row. Place and operator are client-side links (`next/link`), so opening them keeps the document.
- **Inputs:** Session from `useAuthStore`. Catalog via `useTranslations`.
- **Returns / side effects:** Loads `GET /messages?hashtag=21GiftsShop&mode=all`. Name is the first note line. Place links to `/shops?pin={id}#map` (label, or coordinates; `ShopsScreen` then shows its map on the same page). Operator links to `/members/{id}` as `@username`. A missing place or operator is an em dash (shops.missing). **Show more** loads the next page. If a page has no shop rows and another page exists, **Show more** stays and the empty sentence does not. If that page fails, the rows already shown stay, with the forum error and **Try again**, which reloads the same page. A failed first page replaces the table with that error. A missing-requirements response opens `/setup/rules` instead. Null without a session.
- **Used by:** `ShopsScreen`.

## Function: MessageKindTags

- **Purpose:** Author row for a note, plus one tag per kind. **Loan** and **Donation** are buttons. Pressing one shows its explanation and pressing it again hides it. **#Shop** stays a link to `/shops`.
- **Inputs:** `kinds` from `noteKinds`. `children` is the author name and any role tag.
- **Returns / side effects:** The row and, when a loan or donation tag is open, a `role="status"` sentence. No network.
- **Used by:** `ForumBoard`, the public note page, and the `ForumAskWizard` preview.

## Function: noteKinds

- **Purpose:** Which tags a note shows. A reply has none. A repayable ask is a loan. Any other positive ask is a donation. A `#21GiftsShop` token adds shop.
- **Inputs:** `parentId`, `text`, optional `goalSats`, optional `goalRepayable`.
- **Returns / side effects:** `loan`, `donation`, and `shop` in that order, or an empty list. No network.
- **Used by:** `ForumBoard`, `ForumAskWizard`.

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

- **Purpose:** Presentational living-room rules body from catalog keys: lead with the **The test** callout, three rule cards (`rules.lawKicker` with `{n}`, title, body, optional test callout), welcome / allowed / better-not / forbidden lists rendered as bordered cards with lucide glyphs (`Check` `text-app-fg`, `Check` muted, `Minus`, `X` `text-app-danger`), the **Our house** closing block (`rules.houseBody` + `rules.houseClosing`), and an optional Contact CTA to `/contact`. There is no forum back CTA in the document.
- **Inputs:** `messages` catalog for the request locale; optional `showNav` (default `true`); optional `chapter` (`RulesChapterId`). When `chapter` is set, only that chapter is rendered and the public nav is omitted (`showNav` ignored). When `showNav` is `false` and `chapter` is omitted, the public Contact nav is omitted.
- **Returns / side effects:** React element. Server component — uses `translate`, not `useTranslations`. No network.
- **Used by:** `RulesPage`, `RulesSetupPage`.

## Function: RulesPageChrome

- **Purpose:** Client chrome wrapper for public `/rules`: when a session is hydrated (`ready && session !== null`), mounts signed-in shell (`ProfileChromeLeft` + `SignedInChrome`); otherwise mounts `ProfileChromeLeft` with wordmark href `/` plus `LanguageSwitcher`. The arrow returns to the previous in-app view, or `/welcome` when this tab has none.
- **Inputs:** `children` (heading + `RulesDocument` from `RulesPage`). Uses `useHydrateSession` and `useAuthStore` for `session`.
- **Returns / side effects:** `PageChrome` with the matching top-left / top-right slots around `children`. No network beyond session hydration.
- **Used by:** `RulesPage`.

## Function: RulesPage

- **Purpose:** Next.js page for `/rules` with localized heading and living-room rules document, wrapped in `RulesPageChrome` (signed-in or unsigned chrome depending on hydrated session).
- **Inputs:** None. Calls `getRequestLocale()` for the page title and document catalog.
- **Returns / side effects:** Heading + `RulesDocument` inside `RulesPageChrome` (chrome is no longer always unsigned Wordmark + Language).
- **Used by:** Route `/rules`.

## Function: ForumLoader

- **Purpose:** Client loader for the public forum on `/welcome` and `/shops` with `feed="shops"` (filter `#21GiftsShop`, hide laws, append hashtag on compose, `emptyKey` `shops.empty`, pass `shopPlaceEdit` and `onShopPlaceUpdated` so a moderator can set, replace, or clear the pin on an existing shop note, and `shopAccountEdit` and `onShopAccountUpdated` so a moderator can set, replace, or clear the shop account). Session and account from `useAuthStore`; shops return null without a session, and the living room loads the public active page instead. The laws hint stays hidden without a session. Living-room default remains Active (first paint `{ mode: 'active', limit: 20 }`, no hashtag). Shops always requests `mode: 'all'` with `hashtag: '21GiftsShop'` and does not mount the mode selector, the Post/Ask pill, or `ForumAskWizard` (`allowAsk: false`); it mounts `ShopAddWizard` through `shopComposer` and does not apply active/unpaid/popular. A moderator session passes `shopNoteEdit` on every feed, not only shops. A mode switch resets the loaded pages and refetches page 1 of the new mode without blanking the current list. An `IntersectionObserver` sentinel about eight notes from the visible end prefetches the next page when `nextCursor` is present; when a page kept no note (every row failed the note schema), the sentinel is the empty-feed line, so the next page still loads. An empty shops page shows `shops.empty` immediately. The 30-second visible-tab poll, `visibilitychange`, persisted `pageshow`, and pull-to-refresh fetch page 1 only, without a cursor; applying page 1 does not replace already-loaded older pages. Fetches via `fetchMessages`, loads photos via `fetchMessagePhoto` into blob URLs (effect keyed on `photoIdsKey` so payable-poll list refreshes do not cancel in-flight photo fetches), loads `rateDay` via the shared `useSpotRate()` hook on mount (failure leaves `rateDay` null), posts via `fetchComposeTarget` then `postMessageInvoice` (1 sat to 21.gifts, `payHost: composer`) for anyone below verified, otherwise `postMessage` with a `photos` array so `postMessage` dual-sends `{ photo, photos }` (non-empty `photos` wins; max 10) or `postMessageVideo` (multipart clip); composer submit is ignored while a note POST is in flight (sync `notePostInFlightRef`, not only the `posting` prop); prepares picks via `prepareForumPhoto` / `isForumVideoFile` / `prepareForumVideo`; owns `photoDrafts` (plural, not `photoDraft`), `placeDraft`, and `videoDraft` / `videoUrls`; `onPickFiles` appends stills and sets `formError` `tooMany` when the selected `File` list (not successful prepares) would exceed 10, preparing only the first `remaining` slots; video xor stills; video-only posts are allowed. Pay invoices via `postMessageInvoice` (optional `text` when the reply composer pays) and waits on `fetchPublicMessage` while the pay sheet is open (no attempt cap; aborts in-flight wait on Close / clear). A top-level note passes `sinceSats` and closes when `sats` rises. An existing reply passes `sinceReceivedSats` and closes when `receivedSats` rises. After that rise, the row is merged into loaded `replies`/`messages` (no thread refetch). A text-only posting fee (a top-level post or a reply) closes the pay sheet once the compose-target note's `sats` rose and a new own row with that exact text is listed; when the own rows could not be read before the payment, any own row with that text counts, so one failed request cannot leave the sheet on **Waiting for payment…** (the member profile and the signed-in public note do the same for a reply). Today's repayment uses `postRepaymentInvoice` (`POST /messages/:id/repayment`) and `repayNotice`; success opens the invoice card on the note; failure sets `repayNotice` with `rateLimit` / `authorWallet` / `request`; the alert sits on the card. Owns Active/No gifts yet/All/Most popular feed mode (default Active) and the No gifts yet last-visit stamp (`21gifts.forum-unpaid-seen`): hydrates it on mount, stamps on entering unpaid and while unpaid as the list refreshes, and passes `unpaidNewCount` to `ForumBoard` (0 while unpaid is selected or messages are still null). After a successful living-room post with `created.sats === 0`, switches mode to All so the author sees the note, including a positive `goalSats` Ask, because Active and Most popular hide a note that has not received sats. If All is already selected, loaded pages and `nextCursor` stay. Shops already lists with `mode: 'all'` and does not switch. The sheet clears when the pay target is no longer in the visible parent list and not in loaded `replies` (mode change, collapse, or delete), not when Active merely hides the parent note. Also polls `GET /forum/messages` until the merged list is payable (8 attempts, 2s; local extras kept until GET echoes), cancelled-flag fetch like `StatsLoader`. Silently re-fetches on `visibilitychange` (hidden→visible), on `pageshow` when `persisted` is true, on a `FORUM_LIST_POLL_MS` visible-tab interval, on `FORUM_HOME_EVENT` (wordmark / Menu Home while already on `/welcome`), and when the board pull-to-refresh calls `onRefresh` — shared load path with mount/retry; silent refresh does not flip the board to the loading copy when a list already exists, keeps the list when a silent refresh fails, and does not auto-scroll the newest note when a newer note arrives from refresh. When not at top (`shellScrollTop(scroller) < 8` is at-top; `window.scrollY` is only the no-shell fallback) and `hasUnseenForumPosts` is true, the fetch is held and `ForumBoard` shows **New posts**; at the top the list is applied. With a session, fetches `GET /forum/notifications` via existing `fetchNotifications` (cancelled-flag fetch like other ForumLoader loads) and, when an unread `moderator_appointed` row exists (`readAt === null`), drives the ForumBoard pill (`moderatorAppointedAvailable` / `onShowModeratorAppointed`); click marks that row read via `markNotificationRead` and clears the flag, staying on `/welcome` without auto-scroll; a fetch error leaves the banner hidden; a mark-read failure leaves the banner (does not crash). The payable poll updates sats, payable, and the four payment snapshots (`amountUsd`, `amountChf`, `amountEur`, `amountPhp`) on already-listed ids only and does not insert unseen ids. Owns the living-room laws hint visibility from `account.forumLawsDismissed` and persists dismiss via `dismissForumLaws` (optimistic; applies the response or restores the previous flag only when the session token is unchanged and an account is still present). Owns expand/replies (`fetchReplies`, retry, moderator nested-reply hide via `onDeleted` / `deleteMessage` without removing the parent, reply composer: empty reply text and an empty amount invoices 21 sats even for verified; unpaid `postMessage` with `inReplyTo` only when there is text and the amount is empty, and only for verified; below verified invoices 1 sat to 21.gifts via the compose-target note (`payHost: composer`); expand is ignored while a reply posts). A signed-in note card fully inside the shell scrollport calls `markVisibleForumNoteRead`; expanding still calls `markNotificationsReadForMessage`. After a failed media POST following compose-pay, the pay sheet is cleared (`payWaiting` / `payInvoice` / `payMessageId` / `payHost`) so a later compose invoices 21.gifts again. Uses `nextPostRequirement` so a missing name, username, wallet (api `lightning-address`), or rules agreement opens `RequirementsOverlay` (no Skip) before a post or reply retries. After a successful top-level post or reply, sets `hasPosted: true` on the session account when the session token is unchanged and an account is still present (no persist-flag / Skip-forever POST).
- **Inputs:** Optional `feed` (`'living-room'` default, `'shops'`). Reads session and account from the auth store.
- **Returns / side effects:** React element wrapping `ForumBoard`, or `null`. Owns draft/`askDraft`/`composeIntent`/`askStep`/`askCadence`/`placeDraft`/photoDrafts/videoDraft/photoUrls/videoUrls/posting/formError/feedMode/loaded-pages/`nextCursor`/pay/expand/replies/`refreshing`/`rateDay` state, the No gifts yet last-visit stamp, and retry attempts. `askCadence` defaults to once and returns to once after the visitor's own compose is paid (`postAfterPay` or `switchToAll` in the pay poll) and in `applyCreatedNote`. A gift or a reply does not clear it. Empty text without photos and without a video sets `empty`; trimmed text longer than 8000 characters sets `tooLong` and does not call `postMessage` / `postMessageVideo`. Photo-only and video-only posts are allowed. Empty reply text with an empty amount invoices 21 sats (pay-sheet default) and does not set `empty`, including when the parent omits `accountId`. A non-exempt reply with text and an empty amount still invoices 1 sat instead of setting `amount`. `0` is billed as 1 sat. Non-digits and overflowing amounts still set `amount` (`forum.errorReplyPayment`). When the parent omits `accountId`, an unpaid `postMessage` is attempted only for a reply that has text and an empty amount, and a payment 403 starts a 1-sat invoice. Fetch failure sets the error flag without clearing an already-posted list; the board still shows **Try again**. A failed silent refresh with an existing list does not set the error flag. A late GET merges locally posted rows that the response does not yet contain; a POST whose id is already in the list is not prepended again. An empty or whitespace-only pay amount requests 21 sats and does not fill `payDraft`. A `CannotReceiveError` (api `code` `cannot_receive`) on a gift, a paid reply, or today's repayment maps to `authorWallet`; on a posting fee (the 1 sat to 21.gifts before a note or a reaction) it stays `request`; a `WalletRequiredError` (api `code` `wallet_required`) on a gift, a paid reply, a posting fee, or today's repayment opens the `RequirementsOverlay` `wallet` step; a missing or deleted note (`NoteDeletedError`, HTTP 404) maps to `deleted` on the pay sheet and on a paid reply; a 404 on the platform compose-target invoice stays `request`; other invoice failures stay `request`; rate limit stays `rateLimit`. Revokes photo and video blob URLs on unmount. May POST `/me/forum-laws-dismissed`. After a successful top-level post or reply, writes `hasPosted: true` on the session account only when the session token is unchanged and an account is still present (no persist-flag POST). On shops, passes `shopComposer` so the board mounts `ShopAddWizard`, `shopPlaceEdit` / `onShopPlaceUpdated` so a saved or cleared pin updates that row, and `shopAccountEdit` / `onShopAccountUpdated` so a saved or cleared shop account updates that row. For a moderator on every feed, including the living room, passes `shopNoteEdit` / `onShopNoteUpdated`. Passes `lawsVisible` / `onDismissLaws`, `mode` / `onModeChange`, `nearEndRef`, `unpaidNewCount`, `refreshing` / `onRefresh`, `newPostsAvailable` / `onShowNewPosts`, `moderatorAppointedAvailable` / `onShowModeratorAppointed`, and `rateDay` to `ForumBoard`. Stamps last visit on unpaid; mode is not persisted. Does not pass `Error.message` to the board. A paid reaction replaces the reply composer with ForumReplyPayPage and the typed sentence is the preview; the draft and amount stay until payment is observed, then both clear together with the preview; Close clears the preview and leaves the draft and amount in the composer. Gift-on-reply and composer-hosted sheets stay as they are.
- **Used by:** `WelcomeScreen`, `ShopsScreen`.

First post free: while the signed-in member is below verified and has no missing requirements, the loader calls `fetchComposeTarget` once (again when the session, role, or missing list changes) and passes `firstPostFree` to `ForumBoard` for the hint; a failed call shows no hint. On Post below verified (and without a paid fee waiting), it calls `fetchComposeTarget` again, and that answer also decides the hint; an older mount answer that arrives later is ignored. When that answer has `firstPostFree`, it creates the note directly with `postMessage` or `postMessageVideo` (text, photos, video, place, shop account, and Ask goal as a paid post would carry): no invoice and no pay sheet. The created note is shown exactly as after a paid post (`applyCreatedNote`: All when the note has no gifts and is not an Ask, cleared composer, `hasPosted: true`), and the hint goes away. When the api refuses that create with `PostFeeRequiredError`, the hint goes away and the same Post continues into the normal 1-sat posting fee. Any other error keeps its usual handling.

## Function: hasDisplayName

- **Purpose:** True when the account has a non-null display name that is non-empty after trim.
- **Inputs:** `account`.
- **Returns / side effects:** Boolean. No side effects.
- **Used by:** `nextOnboardingPath`, `NameForm`.

## Function: hasAgreedToRules

- **Purpose:** True when the account has a non-null `rulesAgreedAt` timestamp (epoch ms of first living-room rules agreement).
- **Inputs:** `account`.
- **Returns / side effects:** Boolean. No side effects.
- **Used by:** UI that still checks agreement state (overlays, payable); wizard order uses `account.setup` only.

## Function: nextOnboardingPath

- **Purpose:** Picks `/setup/name`, `/setup/username`, `/setup/rules`, or `/welcome` from `account.setup`. `setup === 'wallet'` maps to name, username, rules, or `/welcome` from the other fields; it does not map to `/wallet`. There is no address step: a member receives on their own in-app wallet, which the one-time wallet setup dialog sets up, and the api's `setup === 'lightning-address'` (which follows the name step, filled or skipped) resolves to username, rules, or `/welcome` without checking the name again. Other values stay a 1:1 map (skips advance `setup` without clearing `missing`). Username still cannot be skipped.
- **Inputs:** `account` with required `setup` and `missing`.
- **Returns / side effects:** Path string. No side effects.
- **Used by:** `OnboardingGate`.

## Function: skipSetup

- **Purpose:** Skips the current onboarding name step without filling the field. Rules and username cannot be skipped.
- **Inputs:** Bearer session and `step` (`name` only).
- **Returns / side effects:** Updated `Account` from `POST /me/setup/skip`; callers merge `setup` and `missing` into the auth store.
- **Used by:** The `NameForm` onboarding Skip button.

## Function: fetchMember

- **Purpose:** Loads a signed-in member profile by account id.
- **Inputs:** Bearer session and `accountId`.
- **Returns / side effects:** Validated `MemberProfile`, including `postCount` and `replyCount`, or `null` on 401/404. Throws `MissingRequirementsError` on 409. Hits `/forum/members/:id`. A `profileMessage` that fails `forumMessageSchema` (an About me saved empty: no text, no media, 0 sats) reads as `null`, so the profile renders with the About me empty state instead of failing; the drop is counted in one `console.warn` without content.
- **Used by:** `MemberProfileLoader`.

## Function: fetchMemberPosts

- **Purpose:** Loads a member's top-level forum posts with `GET /forum/members/:id/posts`.
- **Inputs:** Bearer session and `accountId`.
- **Returns / side effects:** Parses `forumListSchema` and returns the messages newest-first, capped by the api at 200. Rows are parsed one by one (`forumMessageRowsSchema`): a note that fails `forumMessageSchema`, such as an empty About me note (no text, no media, 0 sats), is dropped and counted in one `console.warn` without its content, and the other rows still render; only an invalid envelope fails the list. A 401/404 uses the same visitor-facing message-list failure as `fetchMessages`; a 409 `missing_requirements` throws `MissingRequirementsError` as in `fetchMember` / `fetchMessages`.
- **Used by:** `MemberProfileScreen`.

## Function: fetchMemberReplies

- **Purpose:** Loads a member's forum replies with `GET /forum/members/:id/replies`.
- **Inputs:** Bearer session and `accountId`.
- **Returns / side effects:** Parses `forumListSchema` and returns the messages newest-first, capped by the api at 200; reply messages may be payable when the author has a published event and can receive, and may include `parentId`. Rows are parsed one by one (`forumMessageRowsSchema`): a note that fails `forumMessageSchema`, such as an empty About me note (no text, no media, 0 sats), is dropped and counted in one `console.warn` without its content, and the other rows still render; only an invalid envelope fails the list. A 401/404 uses the same visitor-facing message-list failure as `fetchMessages`; a 409 `missing_requirements` throws `MissingRequirementsError` as in `fetchMember` / `fetchMessages`.
- **Used by:** `MemberProfileScreen`.

## Function: parseMissingRequirements

- **Purpose:** Parses a 409 `{ error: 'missing_requirements', missing: [...] }` body.
- **Inputs:** Unknown JSON body.
- **Returns / side effects:** `MissingRequirementsError` or `null`.
- **Used by:** `fetchMessages`, `postMessage`, `postMessageVideo`, `postContact`, `fetchMember`, `fetchMemberPosts`, `fetchMemberReplies`.

## Function: MissingRequirementsError

- **Purpose:** Typed error for api 409 missing name/rules/username requirements, or the api's `lightning-address` key, which means the member cannot receive yet (the `wallet` step of `nextPostRequirement`).
- **Inputs:** `missing` array from the api body.
- **Returns / side effects:** Error instance with `missing` field; not shown as a generic toast.
- **Used by:** Forum and contact loaders (open `RequirementsOverlay`) and member fetch.

## Function: WrongAccountError

- **Purpose:** Typed error for api 403 when the visitor signed in with an account whose session is refused.
- **Inputs:** None; message is the exact api English string.
- **Returns / side effects:** Error instance named `WrongAccountError`. Callers clear the session and show `login.wrongAccount`.
- **Used by:** `fetchMe`, `finishPasskeyAuthentication`, `finishPasskeyRegistration`, `useHydrateSession`, `usePasskeyLogin`.

## Function: NoteDeletedError

- **Purpose:** Typed error when a forum reply or a payment invoice gets HTTP 404 because that note is missing or was deleted.
- **Inputs:** None. The message is exactly `This note was deleted`.
- **Returns / side effects:** Error instance named `NoteDeletedError`. Reply and pay-sheet callers show `forum.errorNoteDeleted` instead of the generic send error. A 404 on the platform compose-target invoice stays the generic request error.
- **Used by:** `postMessage`, `postMessageInvoice`, `ForumLoader`, `PublicMessageThread`, `MemberProfileScreen`.

## Function: WalletRequiredError

- **Purpose:** Typed error for the api's HTTP 400 answer with `code` `wallet_required` (`WALLET_REQUIRED_CODE`): the action needs the signed-in member's own in-app wallet to be set up first. Recognised by the body's `code`, never by status or text; screens show catalog copy.
- **Inputs:** None. The message is `wallet_required`.
- **Returns / side effects:** Error instance named `WalletRequiredError`. On `/pos/amount` it shows **Set up your wallet first.**. On a forum, member, or public-note gift, paid reply, or posting fee, or on today's repayment, it opens the `RequirementsOverlay` `wallet` step; in the inbox it shows the alert link **Set up your wallet first.** to `/wallet`.
- **Used by:** `throwIfWalletAnswer` (so `postMessageInvoice`, `postRepaymentInvoice`, `postConversationInvoice`, and `createPosCharge`), `PosAmount`, `ForumLoader`, `MemberProfileScreen`, `PublicMessageThread`, `InboxLoader`.

## Function: CannotReceiveError

- **Purpose:** Typed error for the api's HTTP 400 answer with `code` `cannot_receive` (`CANNOT_RECEIVE_CODE`): the receiving wallet cannot take this payment. Recognised by the body's `code`, never by status or text; screens show catalog copy.
- **Inputs:** None. The message is `cannot_receive`.
- **Returns / side effects:** Error instance named `CannotReceiveError`. Forum, member, public-note, and inbox pay sheets and the paid-reply composers map it to `authorWallet`; `/pos/amount` shows **Your wallet cannot receive this payment right now. Please try again later.**
- **Used by:** `throwIfWalletAnswer`, `ForumLoader`, `MemberProfileScreen`, `PublicMessageThread`, `InboxLoader`, `PosAmount`.

## Function: throwIfWalletAnswer

- **Purpose:** Turns the api's wallet answers into typed errors before any other status handling. On HTTP 400 it reads a clone of the JSON body: `code` `wallet_required` (`WALLET_REQUIRED_CODE`) throws `WalletRequiredError`, `code` `cannot_receive` (`CANNOT_RECEIVE_CODE`) throws `CannotReceiveError`. Status alone and the `error` text are never used to decide. Any other status, body, or code passes through, and the caller can still read the body.
- **Inputs:** The raw fetch `Response`.
- **Returns / side effects:** A promise that resolves when the response is not a wallet answer; rejects with the typed error otherwise.
- **Used by:** `postMessageInvoice`, `postRepaymentInvoice`, `postConversationInvoice`, `createPosCharge`.

## Function: isWrongAccountError

- **Purpose:** Detects a wrong-account rejection (`WrongAccountError` or an `Error` whose message is exactly `WRONG_ACCOUNT_ERROR`).
- **Inputs:** `error` unknown.
- **Returns / side effects:** `true` for that instance or exact message; `false` otherwise.
- **Used by:** `useHydrateSession`, `usePasskeyLogin`.

## Function: UnknownCredentialError

- **Purpose:** Typed error for api 400 when authenticate finish rejects a credential the server does not store (`Unknown credential`).
- **Inputs:** None; message is the exact api English string.
- **Returns / side effects:** Error instance named `UnknownCredentialError`. `usePasskeyLogin` may signal the credential unknown and sets status `unknown`. `LoginCard` shows the unknown login card. `ViewProfileClaim` shows `view.claimError` and **Try again** calls `authenticate()`, never `register`.
- **Used by:** `finishPasskeyAuthentication`, `usePasskeyLogin`.

## Function: isUnknownCredentialError

- **Purpose:** Detects an unknown-credential rejection (`UnknownCredentialError` or an `Error` whose message is exactly `UNKNOWN_CREDENTIAL_ERROR`).
- **Inputs:** `error` unknown.
- **Returns / side effects:** `true` for that instance or exact message; `false` otherwise.
- **Used by:** `usePasskeyLogin`.

## Function: nextPostRequirement

- **Purpose:** Picks the next overlay step before a forum post (`rules`, then `name`, then `username`, then `wallet`). The api's `lightning-address` key means the member cannot receive yet and maps to the `wallet` step (the member's own in-app wallet). The api's `wallet` key is ignored; it is not a posting overlay field.
- **Inputs:** `missing` array from the account or a 409 body.
- **Returns / side effects:** `'rules'`, `'name'`, `'username'`, `'wallet'`, or `null`. No side effects.
- **Used by:** `ForumLoader`, `MemberProfileScreen`, `RequirementsOverlay` flow.

## Function: nextContactRequirement

- **Purpose:** Picks the next field to collect before a contact send (`rules` before `name` before `username`). A missing wallet (the api's `lightning-address` key) returns `null` — contact does not open an overlay for it.
- **Inputs:** `missing` array from the account or a 409 body.
- **Returns / side effects:** `'rules'`, `'name'`, `'username'`, or `null`. No side effects.
- **Used by:** `ContactLoader`, `RequirementsOverlay` flow.

## Function: RequirementsOverlay

- **Purpose:** Modal to add a missing name (`NameForm` profile), username (`UsernameForm`), or agree to rules before retrying a post. No Skip. The `wallet` step has the title **Your wallet is not set up** and explains **Gifts and posts need your own 21.gifts wallet, and it is not set up yet. Open your wallet to set it up.**, with a labeled `ButtonLink` **Open your wallet** (`requirements.walletOpen`) to `/wallet` and no form: setting the wallet up is the one-time wallet setup, not a field in this overlay.
- **Inputs:** `requirement` (`name` | `username` | `rules` | `wallet`), `onDismiss`, `onSatisfied`.
- **Returns / side effects:** Dialog UI; merges account fields on success then calls `onSatisfied`. Title/`aria-label` from `requirements.nameTitle`, `requirements.usernameTitle`, `requirements.rulesTitle`, or `requirements.walletTitle`. The `wallet` step shows `requirements.walletBody` and a labeled `ButtonLink` **Open your wallet** (`requirements.walletOpen`) to `/wallet`; it has no form.
- **Used by:** `ForumLoader`, `ContactLoader`, `MemberProfileScreen`, `PublicMessageThread`.

## Function: IntroduceYourselfOverlay

- **Purpose:** Modal on the forum home (`/welcome`) that tells a signed-in member whose onboarding is complete (`setup === null`) and who has not posted (`hasPosted === false`) to introduce themselves in the forum. `SignedInChrome` mounts it on `/welcome` only, so it never covers `/wallet`, `/wallet/*`, the point of sale, the profile, messages, or the setup flow. Close (X) dismisses this mount only. Primary CTA **Write an introduction** is a `Button` that dismisses and focuses the welcome composer (`requestForumCompose` / `FORUM_COMPOSE_EVENT`); it does not navigate. No Skip-forever. Hidden when `hasPosted` is true or omitted (older api) and while `setup` is not null.
- **Inputs:** `onDismiss`.
- **Returns / side effects:** Dialog UI (`role="dialog"` `aria-modal="true"`, fixed inset card `z-50`). Title/`aria-label` from `introduce.title`; body `introduce.body`; CTA `introduce.cta` as catalog `Button` `type="button"` `size="lg"`; close `introduce.close`. Does not write `forumLawsDismissed` or any account field.
- **Used by:** `SignedInChrome`.

## Function: MemberProfileLoader

- **Purpose:** Client loader for `/members/[accountId]`: UUID check, `fetchMember`, then `fetchMemberActivity` even when the member has no wallet yet. It does not prefetch post/reply feeds; `postCount` and `replyCount` arrive with the profile JSON.
- **Inputs:** Route `accountId`; session from auth store.
- **Returns / side effects:** Loading / missing (`view.missing`) / error+retry / `MemberProfileScreen`. `fetchMember` 409 `missing_requirements` → `/setup/rules`. `fetchMemberActivity` 409 `missing_requirements` → `/setup/rules`. Any other activity error (other than `MissingRequirementsError`) keeps the card and the chart shows `profile.chartError`. `MissingRequirementsError` still goes to `/setup/rules`.
- **Used by:** `MemberProfilePage`.

## Function: MemberProfileScreen

- **Purpose:** Signed-in member identity card (chart from given and received activity, About me inside the card not as a forum post (**Translate**, Languages icon, when `profileMessage.id` is set), name, location, public `username@21.gifts` (`profile.giftsHeading`), role pill, optional funding-program icon-only button (pressing it reveals that one sentence; that result is the separate screenshot state `funding-program-open`) when `fundingReviewedAt` is a number, copy-profile-link, and post/reaction count toggles) plus stacked `ForumBoard` activity feeds loaded on demand. Location is read-only (`location.unset` when empty). Public `AboutMeSection` (`name={profile.name}`) shows filled text and/or photo, or omits the heading when neither. A labeled Message `Button` (`profile.message`) with a decorative Mail icon sits on the card when another member has a `profileMessage` — not on a post. Staff Trust Chain actions sit behind the closed **Moderator functions** disclosure when the viewer is a moderator and the subject is someone else. Clicking a count opens its feed below the card; clicking it again collapses it. There is no separately pinned profile-note `ForumBoard`; the posts feed lists that note when present. A feed shorter than its profile count gets a muted `profile.activityLatest` truncation line. Posts show React and do not show Send Bitcoin; a payable reply card in the replies feed shows Gift. Nested Gift Continue looks up sats on the visible feed only (reactions-feed cards when activity is replies; expanded-thread replies otherwise). Collapsing or switching Posts/Reactions cancels a Gift whose target is in the expanded thread or the reactions feed; a parent composer invoice stays. Expanding a reply with `parentId` navigates to `/messages/{parentId}`. Verified members may `POST /messages` unpaid only when there is text and the amount is empty; empty text and an empty amount invoices 21 sats even for verified; everyone else invoices ≥ 1 sat with optional text; typed `0` is always billed as 1 sat even for exempt. When a note omits `accountId`, a text reply with an empty amount tries unpaid `POST /messages`; a payment 403 starts a 1-sat compose invoice to 21.gifts on the composer slot (`payHost: composer`, `payMessageId` = compose-target note). Extra gifts and Gift-open stay on the card (`payHost: card`). Loads visible inline photos for posts and replies feeds via `fetchMessagePhoto` blob URLs, same as the home forum top-level cards, retrying a transient fetch once, leaving the row text-only after a second failure, and revoking object URLs on unmount. Blob URLs may also be fetched for expanded thread replies, but ForumBoard does not paint photos on nested replies. Loads `rateDay` via `useSpotRate` (failure leaves `null`) and passes it to every `ForumBoard` so unsent previews can use the current spot rate; feed ₿ amounts show optional preferred-fiat `·` from the amount stored when the payment was made (a stored string as-is, a null or missing field on a passed `stored` object uses the spot rate) (no FiatPicker on the chart or the feed; member profiles are always signed-in). Uses `nextPostRequirement` so a missing name, username, wallet, or rules agreement opens `RequirementsOverlay` (no Skip) before a reply retries. When a username is set, a centered `QrCode` (label `profile.giftsQr`) under the address encodes `openCryptoPayQrValue` (`https://<domain>/pl/?lightning=` plus the uppercase LNURL of `https://<domain>/.well-known/lnurlp/<local>`), including on a smartphone. A missing username shows no QR. When a username is set, a labeled **Shop sticker** `Button` under the QR opens `ShopStickerOverlay` with the same `openCryptoPayQrValue` and the public handle, including on a smartphone; Close and Escape unmount it.
- **Inputs:** `MemberProfile` (includes `aboutMe`, `aboutMeHasPhoto`, and `location`) plus received and donated series; optional `factsOnly` (default false); optional `activityFailed` (default false), passed to the chart as `failed`; session/account from the auth store. Public `AboutMeSection` `hasPhoto` from `aboutMeHasPhoto` / `profileMessage.hasPhoto` with `loadPhoto` (`fetchMessagePhoto`).
- **Returns / side effects:** React tree with About me, copy-profile-link, optional Message, staff Trust Chain actions, and a read-only location row on the card; lazily fetches the selected member posts or replies; loads `GET /fx/spot` into `rateDay` via `useSpotRate`; fetches photos for displayed `hasPhoto` cards into blob URLs via `fetchMessagePhoto` and revokes them on unmount; may `POST` invoice/conversation/replies and navigate to `/messages?c=` or a reply's `/messages/{parentId}`. When `activityFailed` is true and the series is empty, `profile.chartError`. `factsOnly` still has no chart. `factsOnly` returns only the role pill, the funding-program icon, the gifts address, QR, Shop sticker, count buttons, the activity feed, and `RequirementsOverlay` — no heading, chart, About me, name, location, Message, or staff block. `ProfileScreen` uses that mode so the owner sees the same public facts. A `WalletRequiredError` (api `code` `wallet_required`) on a gift, a paid reply, or a posting fee opens the `RequirementsOverlay` `wallet` step. Pay invoices keep the api's `sparkInvoice` so the wallet pays it before the payment request.
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
- **Used by:** `PayLinkScreen` only when the UA is not a smartphone (a specific invoice). Member pay sheets (`ForumBoard`, `ForumReplyPayPage`, `InboxScreen`) show no invoice QR at all. `PosTill`, `MemberProfileScreen`, and `ViewProfileScreen` also on a smartphone when the value exists, and `WalletPay` for the member's own-address QR when the wallet balance is too low (also on a smartphone). `WalletScreenView` shows the member's own address QR in the `/wallet` Receive view, on every device.

## Function: QrScanner

- **Purpose:** Live camera QR reader for the wallet Send view (on `/wallet` and over `/welcome`). Asks once per mount for the camera, rear camera preferred (`facingMode: { ideal: 'environment' }`, no audio), and fills its positioned parent (`absolute inset-0`, black, `[container-type:size]`), which `WalletSend` makes the whole visible page port. The picture covers it (`object-cover`) under a centred viewfinder square of 68% of the smaller side (white border with corner marks, the rest dimmed; it does not take taps), and **Point the camera at a Bitcoin QR code** sits in large white type over the top of the picture on a `from-black/80` gradient. The viewfinder only shows where to aim: every frame is read whole. Reads about eight frames a second: with the browser's `BarcodeDetector` when it lists `qr_code` among its formats, otherwise with `jsqr` on a canvas copy at most 640 pixels on its long edge. A single frame that cannot be decoded is skipped and scanning continues. The first non-blank text stops every camera track and is reported. A blocked camera (`NotAllowedError`, `SecurityError`) shows **Camera access was blocked. Allow it in your browser settings, or paste the payment request.** in large white type on the black area, a third of the way down, so the floating buttons below stay where they are; no camera, any other failure of the camera request, a page without a secure context, a browser without media devices, or a QR decoder that cannot load (the camera is stopped then) shows **No camera found. Paste the payment request instead.** Both are `role="alert"`, and the hint line is hidden then. Unmounting stops the tracks and the frame loop, and a stream or frame result that arrives after unmount is stopped or dropped.
- **Inputs:** `onResult(text)`, called once with the first QR text, after the camera has stopped. The latest callback is used.
- **Returns / side effects:** A region named by the hint, holding the preview or the alert. Requests camera access; never stores or sends a frame.
- **Used by:** `WalletSend` (input step).

## Function: RootLayout

- **Purpose:** Root HTML shell: negotiated `lang` (`en`/`de`/`es`/`fil`), global CSS, English metadata (title, icons, Open Graph, Twitter), blocking `APP_HEIGHT_BOOTSTRAP_SCRIPT` then `THEME_BOOTSTRAP_SCRIPT` in `<head>`, `suppressHydrationWarning` on `<html>`, token body classes (`bg-app-bg text-app-fg`), `AppHeightSync`, `LocaleProvider` with the request catalog, `NumberFormatProvider` with `initial` from `getRequestNumberFormat()`, `FiatPreferenceProvider` with `initial` from `getRequestFiat()`, and `ThemeProvider`. `AccountPreferenceSync`, `PushOpenListener`, and `WalletSync` sit inside `ThemeProvider` beside `RememberWalletReturn`, and `ViewHistoryRoot` wraps the page children. The top-left arrow returns to the previous in-app view in this tab, or `/welcome` when this tab has none. Nest is Locale → NumberFormat → FiatPreference → Theme.
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

- **Purpose:** POST `/trust/verify` with `{ accountId, confirmedName }` so a moderator verifies a basis member.
- **Inputs:** Bearer `sessionToken`, subject `accountId`, `confirmedName`.
- **Returns / side effects:** `{ id, name, role }`. Throws visitor copy on any failure.
- **Used by:** `MemberVerifyScreen`.

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
- **Used by:** `FundingApplyScreen`. While applications are paused, a verified account named `joey-rosima`, `vincent`, or `jewel-bacolbas` with status `none` or `rejected` sees the walk and calls `postFundingApply`. The pause card, which does not call it, is only for a username outside those three whose status is not pending, trial, or admitted. A basis account on the open card sees **You are not verified yet.** and does not call it, including when the status is pending, trial, or admitted. A verified account with one of those statuses sees that copy and does not call it. When `grantApplicationsPaused` is false, the walk also calls it.

## Function: fetchFundingPayoutDays

- **Purpose:** GET `/funding/payout-days` (same-origin Bearer proxy of api `GET /funding/payout-days`) and parse `fundingPayoutDaysResponseSchema`. Next.js forbids a `route.ts` beside `/moderate/payouts`, so the proxy lives at this path. Seven UTC days, oldest first, and one row per person.
- **Inputs:** Bearer `sessionToken`.
- **Returns / side effects:** `{ days, rows }`. Throws visitor copy `Could not load the payout table. Please try again.` on 401/403/503, other non-2xx, network failure, or a body that fails the schema.
- **Used by:** `FundingPayoutsScreen`.

## Function: fetchFundingApplications

- **Purpose:** GET `/funding/applications` (same-origin Bearer proxy of api `GET /funding/applications`) and parse `fundingApplicationsResponseSchema.applications`. Next.js forbids a `route.ts` beside `/grants/applications`, so the proxy lives at this path.
- **Inputs:** Bearer `sessionToken`.
- **Returns / side effects:** Open-application array. Throws visitor copy `Could not load grant applications. Please try again.` on 401/403/503, other non-2xx, network failure, or a body that fails the schema.
- **Used by:** `FundingApplicationsScreen`.

## Function: fetchFundingApplication

- **Purpose:** GET `/funding/applications/:accountId` (Bearer) and parse `fundingApplicationDetailSchema`.
- **Inputs:** Bearer `sessionToken`, subject `accountId`.
- **Returns / side effects:** Account, grant, and living-room posts. Rows are parsed one by one (`forumMessageRowsSchema`): a note that fails `forumMessageSchema`, such as an empty About me note (no text, no media, 0 sats), is dropped and counted in one `console.warn` without its content, and the other rows still render; only an invalid envelope fails the detail. Throws visitor copy `Could not load this application. Please try again.` on 401/403/404/503, other non-2xx, network failure, or a body that fails the schema.
- **Used by:** `FundingApplicationDetailScreen`.

## Function: fetchDailyRoster

- **Purpose:** GET `/funding/daily-roster` (same-origin Bearer proxy of api `GET /funding/daily-roster`) and parse `dailyRosterSchema`. Next.js forbids a `route.ts` beside `/grants/payments/comment` and `/grants/payments/amounts`, so the proxy lives at this path. The body is `{ comment, paymentsEnabled, defaultAmountUsd, recipients }` with `{ address, amountUsd, accountId, name }` rows. `address` stays in the JSON and is not rendered. `defaultAmountUsd` is a finite number.
- **Inputs:** Bearer `session`.
- **Returns / side effects:** Parsed roster. Throws `funding.daily.forbidden` on api `Forbidden`. Throws visitor copy `Could not load daily payments. Please try again.` on 401, other 403, 503, other non-2xx, network failure, or a body that fails the schema.
- **Used by:** `DailyPaymentCommentScreen`, `DailyPaymentAmountsScreen`.

## Function: saveDailyRosterComment

- **Purpose:** POST `/funding/daily-roster/comment` with `{ comment }` and parse the returned roster.
- **Inputs:** Bearer `session`, comment text.
- **Returns / side effects:** Updated roster. Throws a `funding.daily.*` catalog key. Maps api `Invalid comment` to `funding.daily.invalidComment`. Any other failure is `funding.daily.saveError`.
- **Used by:** `DailyPaymentCommentScreen`.

## Function: saveDailyRosterPayments

- **Purpose:** POST `/funding/daily-roster/payments` with `{ enabled }` and parse the returned roster. `enabled` is a boolean.
- **Inputs:** Bearer `session`, `enabled`.
- **Returns / side effects:** Updated roster. Throws a `funding.daily.*` catalog key. Maps api `Invalid payments switch` to `funding.daily.invalidSwitch`. Any other failure is `funding.daily.saveError`.
- **Used by:** `DailyPaymentAmountsScreen`.

## Function: addDailyRosterRecipient

- **Purpose:** POST `/funding/daily-roster/recipients` with `{ accountId, amountUsd }` and parse the returned roster. `amountUsd` is a real number, not a numeric string.
- **Inputs:** Bearer `session`, account id, USD amount.
- **Returns / side effects:** Updated roster. Throws a `funding.daily.*` catalog key. Maps `Invalid person or amount`, `Unknown person`, `Person has no Lightning address`, and `Address already listed`. Any other failure is `funding.daily.saveError`.
- **Used by:** `DailyPaymentAmountsScreen`.

## Function: updateDailyRosterRecipient

- **Purpose:** POST `/funding/daily-roster/recipients/update` with `{ address, amountUsd }` and parse the returned roster.
- **Inputs:** Bearer `session`, stored address, new USD amount.
- **Returns / side effects:** Updated roster. Throws a `funding.daily.*` catalog key. Maps `Invalid address or amount` and `Unknown address`. Any other failure is `funding.daily.saveError`.
- **Used by:** `DailyPaymentAmountsScreen`.

## Function: deleteDailyRosterRecipient

- **Purpose:** POST `/funding/daily-roster/recipients/delete` with `{ address }` and parse the returned roster.
- **Inputs:** Bearer `session`, stored address.
- **Returns / side effects:** Updated roster. Throws a `funding.daily.*` catalog key. Maps `Unknown address`. Any other failure is `funding.daily.saveError`.
- **Used by:** `DailyPaymentAmountsScreen`.

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

- **Purpose:** SVG diagram of the laid-out Trust Chain (name, role, unlabeled arrow). One next person sits to the right; several hanging off one person stack top to bottom. Drag a person to move them. A plain click loads one hop around that person; modifier-click keeps the `/members/{id}` link. Each person is a client-side `next/link` (no prefetch), so without `onExpand` a plain click opens the member without a page load.
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

- **Purpose:** Closed disclosure for moderator and founder actions. On a member card the children are the verify, propose, confirm, and appoint controls. On `/statistics` the only child is the payout link, and `StatisticsScreen` mounts the disclosure only for a moderator when yesterday's person count is a number. The summary is `staff.functions`, a closed `details` / `summary` row. Children mount only while it is open.
- **Inputs:** `children`.
- **Returns / side effects:** `data-testid="staff-functions"`. `open` while expanded. Clicking the summary toggles. Clicks do not propagate.
- **Used by:** `MemberTrustActions`, `StatisticsScreen`.

## Function: MemberTrustActions

- **Purpose:** Staff-only Trust Chain controls on another member's identity card. **Verify** is a `ButtonLink` to `/members/[accountId]/verify` and does not post from this card. Propose, Confirm, and Appoint stay one-click buttons that post from the card. The controls are children of the closed `StaffFunctions` disclosure; they are not painted until it is opened.
- **Inputs:** `profile`, optional `onUpdated`. Hidden unless the signed-in account is a moderator and not the subject.
- **Returns / side effects:** Propose / Confirm / Appoint POST then re-fetch member; `data-testid="state-members-staff-verify"` when shown. The Verify link and the remaining action buttons mount only after the disclosure is opened.
- **Used by:** `MemberProfileScreen`.

## Function: MemberVerifyPage

- **Purpose:** Next.js page for `/members/[accountId]/verify`. Fill `AppShell` (`align="center"`) with `ProfileChromeLeft` top-left (the only back control: the arrow returns to the previous in-app view in this tab, or `/welcome` when this tab has none; the wordmark is not that control), `SignedInChrome` top-right, and `OnboardingGate screen="profile"` around `MemberVerifyScreen`. The card has no back control. There is no `route.ts` beside this page.
- **Inputs:** Dynamic `accountId`.
- **Returns / side effects:** The stored-name check inside fill AppShell. Member HTTP stays on the existing `fetchMember` client.
- **Used by:** Route `/members/[accountId]/verify`.

## Function: MemberVerifyScreen

- **Purpose:** Client stored-name check. Heading **Verify**. Renders `null` without a session and does not fetch. An id that is not a UUID shows **This profile could not be found.** and does not fetch. A viewer below moderator sees **You cannot verify this member.** and does not fetch. Otherwise `fetchMember` runs. A moderator who is not the subject, and a basis member with a stored name that is not only whitespace, sees that exact name as an underlined link to the member card, the question under it, then **Yes** and **No**. **Yes** is the only control that posts. **No** opens the member card and does not post. Both buttons are the only children of `SundayWritingGate`; Sunday hides both. There is no Cancel. Chrome back does not post.
- **Inputs:** Route `accountId`; session and account from `useAuthStore`; catalog via `useTranslations`.
- **Returns / side effects:** React element or `null` without a session. `postTrustVerify(session, profile.id, identifyingName)` only from **Yes**, with the untrimmed stored name, then `router.push` to `/members/${profile.id}`. **No** only `router.push` to `/members/${profile.id}` and does not post. A thrown write stays on this page with **Could not update this member. Please try again.**
- **Used by:** `MemberVerifyPage`.

## Function: fetchPostStats

- **Purpose:** GET `/messages/stats` and parse the public post totals. Notes and replies are one count.
- **Inputs:** None.
- **Returns / side effects:** `PostStats`. Throws visitor copy when the api is down or the body is invalid.
- **Used by:** `StatsLoader`.

## Function: fetchGiftStats

- **Purpose:** GET `/gifts/stats` (optionally `?recipient=`) and parse the public gift totals payload.
- **Inputs:** Optional `recipient` handle; appended as a query param when non-empty after trim (URL-encoded).
- **Returns / side effects:** `GiftStats`. Throws visitor copy when the api is down or the body is invalid.
- **Used by:** `StatsLoader` and `StatisticsScreen`. Live amounts use `fetchFxSpot`, not this.

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
- **Returns / side effects:** `AccountActivity`. Throws visitor copy on failure; the loader catches the error, keeps the card, and the chart shows `profile.chartError`.
- **Used by:** `ViewProfileLoader`.

## Function: fetchMe

- **Purpose:** GET `/me` with the bearer session.
- **Inputs:** `sessionToken`.
- **Returns / side effects:** `Account` or `null` on 401. Throws `WrongAccountError` on 403 with the duplicate-account api string. Other non-2xx throw the generic fetch-account error.
- **Used by:** `useHydrateSession`, `renewPasskey`.

## Function: fetchPublicForumMessages

- **Purpose:** `GET /forum/messages?mode=active` with no Authorization header. Same page size (20) and cursor as the signed-in feed. HTTP 401 throws `PublicForumUnauthorizedError`.
- **Inputs:** Optional `limit` and `cursor`.
- **Returns / side effects:** `{ messages, nextCursor }`. Rows are parsed one by one (`forumMessageRowsSchema`): a note that fails `forumMessageSchema`, such as an empty About me note (no text, no media, 0 sats), is dropped and counted in one `console.warn` without its content, and the other rows still render; only an invalid envelope fails the list. `nextCursor` is kept even when every row of a page was dropped; `ForumBoard` then puts the scroll sentinel on the empty-feed line so `ForumLoader` loads that next page.
- **Used by:** `ForumLoader` when the living room has no session.

## Function: PublicForumUnauthorizedError

- **Purpose:** Error for a 401 from the public active page. The first page shows the existing load error. A later page sends the visitor to `/login`.
- **Inputs:** None.
- **Returns / side effects:** An `Error` whose name is `PublicForumUnauthorizedError`.
- **Used by:** `fetchPublicForumMessages`, `ForumLoader`.

## Function: fetchMessages

- **Purpose:** GET `/forum/messages` with the bearer session, parse `forumListSchema`, and return the newest-first feed page as `{ messages, nextCursor }` (including defaulted `replyCount`).
- **Inputs:** `sessionToken`; optional `{ mode, limit, cursor, hashtag }`. Always sends `limit` (default 20), sends `mode` when supplied, sends `hashtag` when non-empty, and omits a null or empty cursor and an empty/`''` hashtag.
- **Returns / side effects:** `ForumFeedPage` with `nextCursor: null` when the response omits it. In every mode (Active, No gifts yet, All, Most popular, and the shops hashtag) rows are parsed one by one (`forumMessageRowsSchema`): a note that fails `forumMessageSchema`, such as an empty About me note (no text, no media, 0 sats), is dropped and counted in one `console.warn` without its content, and the other rows still render; only an invalid envelope fails the list. `nextCursor` is kept even when every row of a page was dropped; on the forum list `ForumBoard` then puts the scroll sentinel on the empty-feed line, so `ForumLoader` loads that next page, while the shops table keeps its own **Show more**. Throws visitor copy (`Could not load messages. Please try again.`) on a non-ok response, a network failure, or an invalid envelope (`messages` not an array, or an empty `nextCursor`).
- **Used by:** `ForumLoader`.

## Function: fetchExternalAuthorProfile

- **Purpose:** GET `/public-messages/:id/external-profile` with no Authorization and parse `externalAuthorProfileSchema`.
- **Inputs:** Forum message `id`.
- **Returns / side effects:** `{ name, npub, nip05?, lud16? }`, plus optional `postCount` and `replyCount`, or `null` on 404, any other non-OK response, network failure, JSON failure, or schema mismatch. Does not throw.
- **Used by:** `ExternalAuthorProfile`.

## Function: fetchExternalAuthorPosts

- **Purpose:** GET `/public-messages/:id/external-posts` with no Authorization. After HTTP OK, require `{ messages: array }`, parse the items with `forumMessageRowsSchema` (each item through `forumMessageSchema`; invalid items are skipped and counted in one `console.warn` without content).
- **Inputs:** Forum message `id`.
- **Returns / side effects:** `ForumMessage[]` (empty if none survive or the list is empty). Throws visitor copy (`Could not load messages. Please try again.`) on non-OK including 404, network, non-JSON, or a body that is not `{ messages: array }`. Does not throw `MissingRequirementsError`. No Bearer.
- **Used by:** `ExternalAuthorProfile`.

## Function: fetchExternalAuthorReplies

- **Purpose:** GET `/public-messages/:id/external-replies` with no Authorization. After HTTP OK, require `{ messages: array }`, parse the items with `forumMessageRowsSchema` (each item through `forumMessageSchema`; invalid items are skipped and counted in one `console.warn` without content).
- **Inputs:** Forum message `id`.
- **Returns / side effects:** `ForumMessage[]` (empty if none survive or the list is empty). Throws visitor copy (`Could not load messages. Please try again.`) on non-OK including 404, network, non-JSON, or a body that is not `{ messages: array }`. Does not throw `MissingRequirementsError`. No Bearer.
- **Used by:** `ExternalAuthorProfile`.

## Function: fetchPublicMessage

- **Purpose:** GET `/public-messages/:id` without a session, parse `forumMessageSchema`, and return one public forum note for the HTML note page. Optional `sinceSats` appends `?sinceSats=` so the api can wait until the note has more sats (pay poll on a top-level note). Optional `sinceReceivedSats` appends `?sinceReceivedSats=` so the api can wait until a reply has more received sats. A non-integer, NaN, Infinity, or negative value is omitted for either query. When both are valid, `sinceSats` comes first.
- **Inputs:** Forum message `id` (UUID string). Optional `opts` with `sinceSats` and `sinceReceivedSats` (each a finite integer ≥ 0; omitted / NaN / Infinity / negatives / non-integers skip that query) and `signal` (`AbortSignal` passed to `fetch` when provided).
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

- **Purpose:** GET `/public-messages/:id/replies` without a session. After HTTP OK, require `{ messages: array }`, parse the items with `forumMessageRowsSchema` (each item through `forumMessageSchema`; invalid items are skipped and counted in one `console.warn` without content), and return the survivors oldest-first.
- **Inputs:** Parent forum message `id`.
- **Returns / side effects:** `ForumMessage[]` (empty if none survive or HTTP 200 `{ messages: [] }`). Throws visitor copy (`Could not load messages. Please try again.`) on HTTP 404 (not empty), other non-ok, network, non-JSON, or a body that is not `{ messages: array }`.
- **Used by:** `PublicMessageLoader`.

## Function: fetchPublicMessagePhoto

- **Purpose:** GET `/messages/:id/photo` without Authorization (index 0 and ≤0, legacy) or GET `/messages/:id/photo/{index}.jpg` (indices 1–9) and return raw image bytes as a `Blob` for `URL.createObjectURL` on the public note page. No Authorization. Throws visitor copy on failure.
- **Inputs:** Forum message `id`, optional zero-based `index` (default 0).
- **Returns / side effects:** `Blob`. Index 0 (and ≤0) uses the legacy photo route; indices 1–9 request `{index}.jpg`. Throws visitor copy (`Could not load messages. Please try again.`) on non-ok, empty body, or network failure — does not leak status codes.
- **Used by:** `PublicMessageLoader`.

## Function: fetchReplies

- **Purpose:** GET `/forum/messages/:id/replies` with the bearer session. After HTTP OK, require `{ messages: array }`, parse the items with `forumMessageRowsSchema` (each item through `forumMessageSchema`; invalid items are skipped and counted in one `console.warn` without content), and return the survivors oldest-first.
- **Inputs:** `sessionToken`, parent message `id`.
- **Returns / side effects:** `ForumMessage[]` (empty if none survive). Throws visitor copy (`Could not load messages. Please try again.`) when the api is unavailable, the body is not JSON, or the body is not `{ messages: array }`. Damus authors may omit `role` (schema defaults to `basis`). An optional `via: 'nostr'` field is accepted (present only on replies from a Nostr user with no 21.gifts account).
- **Used by:** `ForumLoader`.

## Function: fetchMessagePhoto

- **Purpose:** GET `/messages/:id/photo` (index 0) or `/messages/:id/photo/{index}.jpg` (indices 1–9) with the bearer session and return the raw image bytes as a `Blob` for `URL.createObjectURL` rendering.
- **Inputs:** `sessionToken`, message `id`, optional zero-based `index` (default 0).
- **Returns / side effects:** `Blob`. Throws visitor copy (`Could not load messages. Please try again.`) on non-ok, empty body, or network failure — does not leak status codes.
- **Used by:** `ForumLoader`, `MemberProfileScreen`.

## Function: postMessage

- **Purpose:** POST `/forum/messages` with bearer + `{ text, photo?, photos?, inReplyTo?, goalCurrency?, goalAmount?, place?, shopUsername? }`, parse `forumMessageSchema`, and return the created message or reply (text and/or up to ten photos). Non-empty `photos` dual-sends `photo` as the first still plus `photos`. A non-blank string `takenAt` on a still is included; a blank or missing time is omitted. Optional `goalCurrency` and `goalAmount` go together on a top-level note, never as `goalSats`; omitted on replies and when either is missing. `goalSats` remains a field of the read note. Optional `place` is `{ lat, lng, label }` on a top-level note; omitted when unset. Replies must not send it. Optional `shopUsername` is sent only when the trimmed value without a leading `@` is non-blank.
- **Inputs:** `sessionToken`, `input` with `text`, optional `{ contentType, data, takenAt? }` photo, optional `photos` array (max 10), optional `inReplyTo` parent id (thread composer only), optional `goalCurrency` and `goalAmount` (together, never `goalSats`), optional `place` (`ForumPlacePin`, top-level only), and optional `shopUsername` (leading `@` stripped; omitted when blank).
- **Returns / side effects:** `ForumMessage`. Omits `inReplyTo`, `goalCurrency`/`goalAmount`, `place`, and `shopUsername` from the JSON body when absent; omits both Ask fields on replies even if passed. On 400 or 429 uses the api error string when present; otherwise throws `Could not post your message`. On 403 throws `PostFeeRequiredError` with the api error string when present, otherwise `A reply needs a Bitcoin payment`. On 404 whose api error is exactly `No account with that username` throws that string; any other 404 throws `NoteDeletedError`.
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
- **Returns / side effects:** `{ ok: true, photo }` (`photo.takenAt` is a civil string or null) or `{ ok: false, error: 'unsupported' | 'tooLarge' }`. Revokes temporary object URLs it creates. The wide profile image is not prepared here; `WideImageCropper` frames that JPEG.
- **Used by:** `ForumLoader`, `AboutMeSection`, `InboxLoader`, `ModeratorGroupScreen`, `ProfileScreen`.

## Function: initialBannerCrop

- **Purpose:** Largest 5:2 rectangle centered in a source image, used as the opening frame when a member picks a wide profile image.
- **Inputs:** `imageWidth` and `imageHeight` in source pixels.
- **Returns / side effects:** `{ x, y, width, height }`, or `null` when either dimension is not a finite number greater than 0. A panorama is full height. Every other shape, including a square and a 4:3, is full width. No network.
- **Used by:** `WideImageCropper`.

## Function: panBannerCrop

- **Purpose:** Move a 5:2 crop window by a source-pixel delta and keep it inside the image.
- **Inputs:** `imageWidth`, `imageHeight`, the current `crop`, and `dx` / `dy` in source pixels.
- **Returns / side effects:** A new crop with the same width and height. `x` and `y` are clamped to the image. No network.
- **Used by:** `WideImageCropper`, `zoomBannerCrop`.

## Function: zoomBannerCrop

- **Purpose:** Scale a 5:2 crop around its center. A factor greater than 1 zooms in by shrinking the window.
- **Inputs:** `imageWidth`, `imageHeight`, the current `crop`, and `factor`.
- **Returns / side effects:** The zoomed crop, or the same crop when the image has no fitting window. The window cannot grow past `initialBannerCrop` and cannot shrink below a height of 32, unless the fitting window is already shorter. Width stays height times 5/2. No network.
- **Used by:** `WideImageCropper`.

## Function: outputBannerSize

- **Purpose:** Encoded pixel size for a chosen wide-image crop. The result is what the profile API measures.
- **Inputs:** `cropWidth` in source pixels.
- **Returns / side effects:** `{ width, height }`. Width is `min(1280, max(640, round(cropWidth)))`. Height is `max(1, round(width * 2 / 5))`. No network.
- **Used by:** `encodeWideBanner`.

## Function: encodeWideBanner

- **Purpose:** Draw a 5:2 crop into a JPEG the wide-image API accepts.
- **Inputs:** `source` canvas image, `imageWidth`, `imageHeight`, and the `crop` window.
- **Returns / side effects:** `{ ok: true, photo }` with `contentType: 'image/jpeg'`, raw base64 `data`, and a `previewUrl` data URL. Quality tries 0.8, then 0.6, then 0.4. `{ ok: false, error: 'tooLarge' }` when the decoded JPEG is still over 1 MiB. `'unsupported'` when the crop is not finite and positive, the canvas has no 2d context, or `toDataURL` is not a JPEG. Does not throw for those failures.
- **Used by:** `WideImageCropper`.

## Function: WideImageCropper

- **Purpose:** In-app 5:2 frame for a picked wide profile image. The member drags, pinches, or scrolls the wheel, then confirms or cancels. A portrait, square, or 4:3 is framed here instead of rejected.
- **Inputs:** `file` (JPEG, PNG, or WebP), optional `busy`, `onConfirm` with `{ contentType: 'image/jpeg', data }`, `onCancel`, and `onError` (`'unsupported'` or `'tooLarge'`).
- **Returns / side effects:** The frame (`profile.about.bannerCropHint` **Drag the photo to choose the wide image**), labeled **Use this crop**, and an X IconButton whose accessible name is **Cancel crop** (no visible cancel sentence). Confirm calls `encodeWideBanner` and `onConfirm`. Cancel calls `onCancel` and uploads nothing. A file that cannot be decoded calls `onError('unsupported')`. No network by itself.
- **Used by:** `ProfileScreen` (empty wide-image slot; the cropper replaces **Add a wide image** and leaves **Add a profile photo**), `AboutMeSection` (editor, full width above the small wide-image preview).

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
- **Used by:** `ForumBoard`, `AccountActivityChart`, `StatsDashboard`, `GiftDayTable`, `DayLoader`, `WalletBalance`, `WalletPay`, `WalletSend`.

## Function: isLocalSunday

- **Purpose:** True when `nowMs` falls on Sunday in an IANA zone, or in the runtime zone when `timeZone` is omitted. An invalid zone returns false. Does not use one fixed zone for every visitor.
- **Inputs:** `nowMs` epoch milliseconds and optional `timeZone`.
- **Returns / side effects:** boolean. No I/O.
- **Used by:** tests. The painted Sunday flag comes from `SUNDAY_BOOTSTRAP_SCRIPT`, which uses the clock; only a Playwright build renders `meta[name=e2e-now]`, and only then does the script honour that meta or a sessionStorage `e2e-now` pin.

## Function: useLocalSunday

- **Purpose:** Reads `documentElement.dataset.localSunday` after the head script sets it. Server render, and the client before that flag, are false, so weekday tests keep their fields.
- **Inputs:** none.
- **Returns / side effects:** boolean. Subscribes to attribute changes on `documentElement`.
- **Used by:** `SundayWritingGate`, `ModeratorGroupScreen`, and `PlaceField`.

## Function: SundayWritingGate

- **Purpose:** On the device's local Sunday, replaces public write controls or a forum zap control with a sentence. Otherwise renders the children. The rules in `globals.css` hide the field before paint once `data-local-sunday="1"` is set. Weekday wrappers use `display: contents`.
- **Inputs:** `children`, and optional `notice` (`write` or `zap`).
- **Returns / side effects:** The sentence or the children. No network.
- **Used by:** forum composers, profile editors, grant and trust actions, and forum pay controls.

## Function: deviceTimeZoneHeader

- **Purpose:** Returns a `Time-Zone` header for the runtime IANA zone so the API can apply the same Sunday rule. Empty in Node (no `window`), when the zone is blank, or when `Intl` throws.
- **Inputs:** none.
- **Returns / side effects:** `{ 'Time-Zone': zone }` or `{}`. No I/O.
- **Used by:** public write and forum-invoice fetches in `api.ts`.

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

- **Purpose:** Remaining body text plus nested post cards for resolved `/messages/<uuid>` URLs and for `http(s)://<host>/l/<8 hex>` codes that `fetchShortLink` resolves to a shown message (a member, a null lookup, the containing id, and a failed load stay in the text). Fills from knownNotes first; otherwise fetchPublicMessage (catch, never throw). 404/null leaves the URL, which `LinkedText` then autolinks as an internal `/messages/<uuid>` path. Nested card is an outer frame with one empty stretched permalink (`absolute inset-0`, aria-label `forum.quotedNote`, or `forum.quotedNoteExternal` when the quoted note has `via === 'nostr'`) that covers the card, including the caption, timestamp, role pill, optional photo, and ₿ amount, and points at `/messages/<id>`. That permalink is not an ancestor of the caption, so Show more stays outside any anchor. Card content is `pointer-events-none` with `[&_*]:pointer-events-none`, `[&_a]:pointer-events-auto`, and `[&_button]:pointer-events-auto`, so a click on caption text, photo, timestamp, role pill, or amount hits the permalink, while the author profile link, Translate, Show more, and links inside the caption keep their own targets. When the quoted note has `via === 'nostr'`, the name is a link to `/messages/<id>/author`, not a dialog. `[&_[role=dialog]]:pointer-events-auto` and `[&_[role=dialog]_*]:pointer-events-auto` keep the external-link confirm dialog and everything inside it clickable, because that dialog is a descendant of the card and is not portaled. The photo `img` is `draggable={false}` and is not inside the permalink. Caption rendering is unchanged (`TranslatableNoteBody` when `translate` is true, `plain` only when `via === 'nostr'`; when `translate` is false, `ForumNoteText` when truncate, else `LinkedText`; no nested unfurl). `TranslatableNoteBody` on stripped display text only (a successful translation replaces that original after the same quote/short-link strip; optional `formatTranslated` runs after that strip). Feed remaining text and nested captions go through `ForumNoteText` (280-character preview, Show more only above 560, bodies autolinked) until replaced. Permalink passes `truncate={false}` so the original stays full (`LinkedText`). Callers skip this component for `via === 'nostr'` rows (plain text and the **External** badge are handled by the caller). A nested card whose quoted note has `via === 'nostr'` shows the non-interactive **External** span in the role-pill slot (such notes carry no tagged role). Nested nostr captions use `TranslatableNoteBody` `plain` only when `translate` is true (a URL in a quoted external reply is never a link). When `translate` is false, nested cards use `ForumNoteText` / `LinkedText` and never `TranslatableNoteBody`.
- **Inputs:** text, knownNotes, excludeId, rateDay, fiat, optional truncate (default true), optional className (default `whitespace-pre-wrap text-sm text-app-fg`; `text-app-btn-fg` selects NoteTranslate `tone="onButton"` (via `TranslatableNoteBody`)), optional `translate` (default true; `false` renders remaining text and nested quoted cards — including `via === 'nostr'` — through `ForumNoteText` / `LinkedText` without `TranslatableNoteBody`; forwarded to nested `QuotedForumNote`), optional `conversationId` (when set, the remainder translates as that conversation message; nested cards stay forum notes), optional `formatTranslated` (applied only to the visible remainder translation, after the quote/short-link strip), optional `controlSlotId` (forwarded to `TranslatableNoteBody` for the footer icon row), optional onActivate.
- **Returns / side effects:** React element or null when text==='' and no resolved quotes. Unknown quote ids load via `fetchForumMessage` when a session exists, otherwise `fetchPublicMessage` (catch, never throw). Optional `mentions` are passed only when the quoted author is already the member link. Each nested card has one stretched permalink to `/messages/<id>` covering the caption, photo, time, and amount; the author link, Translate, Show more, and links inside the caption stay outside that permalink.
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

- **Purpose:** Render a note/About-me/inbox body with clickable http(s) URLs. Internal URLs are Next.js `Link`s to `pathname+search+hash` (no warning). External URLs are `<a href>` that `preventDefault` on a primary click and open `ExternalLinkWarning`. Click and Enter/Space `stopPropagation` so a forum card does not toggle; Enter/Space on an external URL opens the warning. Optional `suffix` sits in the same `<p>` after the runs (Show more). Optional `mentions` turn a resolved `@username` into the member button (`forum.authorProfile`). A click opens `/members/<accountId>`. Optional `plain` (default false) renders `text` as a single span with no autolinking (no `<a>` / `Link`, no `ExternalLinkWarning`), used for Nostr-zapper (`via: 'nostr'`) rows.
- **Inputs:** `text`, `className` for the wrapping `<p>`, optional `linkClassName` (default underline, inherit colour), optional `currentOrigin`, optional `suffix`, optional `plain` (default false), optional `mentions` (`{ username, accountId }[]`).
- **Returns / side effects:** Fragment: `<p>` plus optional overlay. Confirm on `https:` calls `openInSystemBrowser`; other http uses `window.open`.
- **Used by:** `ForumNoteText`, `ForumQuotedBody` (when `truncate` is false), `AboutMeSection`.

## Function: ExternalAuthorProfile

- **Purpose:** Profile card for a forum author with no 21.gifts account. Same fields and hide rules as the member card: heading `profile.title`, name with the External span, optional checked Nostr address, payment address only when it differs ignoring case, and the npub with a centered secondary IconButton copy control. It is not a dialog. Rendered by `ExternalAuthorPage` inside `PublicMessageChrome`. No image, payment, or outbound link. Copy uses the clipboard, then a hidden textarea. When both `postCount` and `replyCount` are numbers, the same count buttons as a member open a read-only feed under the card (no pay, no composer, no react). If either count is absent, no buttons.
- **Inputs:** `messageId`, `fallbackName`. Empty `fallbackName` shows `view.unnamed` until a profile loads, and when the fetch returns null.
- **Returns / side effects:** The card. No `onClose`. Loading and a null fetch show the title, the fallback name (or Unnamed), and the External span, and omit the address sections. No overlay, portal, hint paragraph, or close control. Count buttons and the read-only feed render when both counts are numbers; a post click opens `/messages/{id}`; a reply click opens `/messages/{parentId}`; a shorter list shows `profile.activityLatest`; loading uses `forum.loading`; failure uses `forum.error` and `view.retry`.
- **Used by:** `ExternalAuthorPage`.

## Function: ExternalAuthorPage

- **Purpose:** Next.js page for `/messages/[id]/author` — the external author profile card for a forum note whose author has no 21.gifts account. Not a member page and not a dialog. Reads `params.id` and `searchParams.name` (a string or the first array entry, trimmed; blank becomes `''`). Renders `ExternalAuthorProfile` inside `PublicMessageChrome`. No `OnboardingGate`. The note id is not validated as a UUID.
- **Inputs:** Dynamic route params (`id`) and optional `name` query (`string` or `string[]`).
- **Returns / side effects:** `ExternalAuthorProfile` inside `PublicMessageChrome` (unsigned wordmark href `/` plus `LanguageSwitcher`, or signed-in `ProfileChromeLeft` plus `SignedInChrome`). No `generateMetadata`.
- **Used by:** Route `/messages/[id]/author`. `ForumBoard` (name click). `QuotedForumNote` (quoted name). `PublicMessageLoader` (`PublicThreadCard` name).

## Function: ExternalLinkWarning

- **Purpose:** Confirm overlay before leaving 21.gifts for an external http(s) URL. Same overlay chrome as `IntroduceYourselfOverlay` (`bg-app-overlay`, `Card maxWidth="sm"`, icon-only Close, labeled **Open link**). The destination URL is shown as user content, not a catalog string. No Skip.
- **Inputs:** `url`, `onCancel`, `onConfirm`.
- **Returns / side effects:** Dialog. Close/`onCancel` does not open the URL. **Open link** calls `onConfirm`. Dialog click and keydown `stopPropagation` so a parent forum card does not toggle.
- **Used by:** `LinkedText`.

## Function: ShopStickerOverlay

- **Purpose:** Shop-sticker overlay on a member profile. Same overlay chrome as `ExternalLinkWarning` (`role="dialog"`, `bg-app-overlay`, icon-only **Close**) with `Card maxWidth="xl"`: title **Shop sticker**, lead **Print it for a shop window. The QR code pays {handle}.**, a **Second language** combobox, a preview `<img>` of `buildShopStickerSvg` (alt **Shop sticker preview for {handle}**), a neutral `SegmentedControl` **File format** PDF | PNG | JPG | SVG (PDF first), and a labeled **Download**.
- **Inputs:** `qrValue` (the profile's `openCryptoPayQrValue`), `handle` (`giftsLightningAddress`), `onClose`. The text language is not a prop. `shopStickerLangInitial` sets the first selection from the visitor's UI language (`en` → English only, `de` → German, `es` → Spanish, `fil` → Filipino), unless the page `lang` query names a sticker language. The combobox then drives the preview and the download. Choosing a language does not write the URL. Options, in order: None (English only), Spanish, German, French, Filipino, Kikamba. The closed control stays in the card flow above the preview; the list opens downward over the preview.
- **Returns / side effects:** Dialog. **Download** disables itself while `shopStickerBlob` runs, then saves the blob through a temporary `<a download>` named by `shopStickerFileName` and revokes the object URL a second later; a failure shows `role="alert"` **Could not create the file. Please try again.** until the next try. Focus moves into the dialog on open and returns to the element that opened it on close. Close calls `onClose`. Escape closes the open language list first and leaves the dialog up; the next Escape calls `onClose`. The dialog's own keydown handles Escape from inside it, and a `document` listener (removed on unmount) closes only on Escape from outside the dialog, so one key press never closes twice even with the app root on `document`. Dialog click and keydown `stopPropagation`. A press outside the list closes the list only.
- **Used by:** `MemberProfileScreen` — only where the profile shows its QR (username set), including on a smartphone.

## Function: visibleForumMessages

- **Purpose:** Client-side filter and sort of the already-loaded forum thread for the Active / No gifts yet / All / Most popular selector. Does not call the api; ranking is among the messages the loader already holds.
- **Inputs:** `messages` (newest-first list from the api / loader merge) and `mode` (`active` | `unpaid` | `all` | `popular`).
- **Returns / side effects:** A new array. `all` keeps input order including unpaid (`sats === 0`) notes. `active` keeps paid notes (`sats > 0`) and unpaid notes whose `role` is at least `moderator`, newest-first. A zero-sat ask is not active. `popular` keeps only paid notes, ordered by sats descending, then `createdAt` descending, then `id` descending. Never mutates the input array.
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

- **Purpose:** Ask the welcome new-post composer to take focus and skip `IntroduceYourselfOverlay` on the next SignedInChrome mount (whatever screen that is). Used by **Write an introduction** on `/welcome`.
- **Inputs:** none.
- **Returns / side effects:** Sets skip-introduce-once and pending-compose module flags that survive Next.js client navigations until consumed. When `window` exists, dispatches `FORUM_COMPOSE_EVENT` (`21gifts:forum-compose`).
- **Used by:** `IntroduceYourselfOverlay`.

## Function: consumePendingForumCompose

- **Purpose:** One-shot read of the pending-compose flag from `requestForumCompose`.
- **Inputs:** none.
- **Returns / side effects:** `true` when compose focus is still pending, then clears the flag. `false` on a second call. `ForumBoard` consumes only after the new-post textarea is present; a `composerHidden` board does not clear the flag.
- **Used by:** `ForumBoard`.

## Function: consumeSkipIntroduceOverlay

- **Purpose:** One-shot read of the skip-introduce-once flag from `requestForumCompose`: the next `SignedInChrome` mount after **Write an introduction** starts with the overlay dismissed. That mount uses up the flag, so a later visit to `/welcome` asks again while the member still has not posted.
- **Inputs:** none.
- **Returns / side effects:** `true` when this mount should start with the overlay dismissed, then clears the flag. Close (X) does not set the flag.
- **Used by:** `SignedInChrome`.

## Function: fiatPrefix

- **Purpose:** Amount prefix for a fiat code. `$` and `₱` sit tight against the number, the same way `₿` does. CHF and EUR keep the code and a trailing space (`CHF `, `EUR `).
- **Inputs:** `code` (`FiatCode`: CHF, EUR, USD, or PHP).
- **Returns / side effects:** `'$'`, `'₱'`, `'CHF '`, or `'EUR '`. No grouping and no network.
- **Used by:** `formatFiatDisplay`, `formatFiatTick`, and `formatDefinedGoalAmount`.

## Function: formatFiatDisplay

- **Purpose:** Formats an API fiat amount string for stats display using the visitor grouping style. `null` becomes `—` (U+2014). USD uses `$` and PHP uses `₱`; CHF and EUR prefix the code (`CHF 1'425.00`).
- **Inputs:** `amount` (`string | null`), `code` (`FiatCode`), and optional `style` `NumberFormatStyle` (default `ch`).
- **Returns / side effects:** Display string such as `$1'425.00` / `CHF 1'425.00`. No `Intl.NumberFormat`. No network.
- **Used by:** `StatsDashboard`, `GiftDayTable`, `DayLoader`, `WalletSend`.

## Function: formatFiatTick

- **Purpose:** Formats a parsed fiat chart-axis value with grouping and a currency prefix. USD uses `$` (same as `formatUsdTick`) and PHP uses `₱`; CHF and EUR keep the code (`CHF 0` / `CHF 1.43` / `CHF 1'425`).
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

## Function: spotRateDay

- **Purpose:** Turns the `GET /fx/spot` prices of 1 BTC into the rate every live amount uses: 100'000'000 sats priced at each code the api priced. A code the api left out has no rate.
- **Inputs:** `rates` — `Partial<Record<FiatCode, string>>` from `fetchFxSpot`.
- **Returns / side effects:** `FiatRateDay` with `sats: 100000000` and `usd` / `chf` / `eur` / `php` set to that price or `null`, or `null` when no code has a usable price (missing, `"0"`, or not a number). No I/O.
- **Used by:** `useSpotRate`.

## Function: useSpotRateState

- **Purpose:** The current spot rate together with whether its first read has settled, for a payment screen that must not show an amount as ready while the rate is still loading (CONTRIBUTING "Shown amounts"). `useSpotRate` returns its `rateDay`. Fetches `GET /fx/spot` via `fetchFxSpot` on mount and every five minutes (`SPOT_REFRESH_MS`); an answer with a usable price replaces the rate, and an answer without any price or a failed request keeps the last one. A refresh does not start while the previous request is open. Never throws. Drops answers after unmount.
- **Inputs:** Optional `enabled` (default `true`); while false nothing is fetched, `rateDay` is `null`, and `loading` is `true`.
- **Returns / side effects:** `{ rateDay, loading }`: `rateDay` is `spotRateDay` of the latest usable answer (or `null`), and `loading` turns false once the first read settles, whatever its result. Calls `fetchFxSpot` on mount and on the refresh timer while enabled; clears the timer on unmount.
- **Used by:** `useSpotRate`, `WalletPaymentDetails`.

## Function: useSpotRate

- **Purpose:** The current price of 1 BTC for every amount that is entered or converted live: the amount field (₿ ↔ fiat), the point of sale, gift and reaction amounts, the wallet and payment fiat suffixes, and the fiat stored with a new payment. Fetches `GET /fx/spot` via `fetchFxSpot` on mount and again every five minutes (`SPOT_REFRESH_MS`) while mounted, and resolves `spotRateDay` of its rates. An answer with a usable price replaces the rate. An answer without any price (the api has no quote) and a failed request keep the last rate, as the api keeps its last good quote. A refresh does not start while the previous request is still open. Never throws into the caller. Drops answers after unmount. There is no fallback to a gift day: the statistics pages keep each day's own rate from `GET /gifts/stats`, and nothing else uses it.
- **Inputs:** Optional `enabled` (default true). When false, the fetch is skipped and the hook returns `null`, also after a rate was loaded.
- **Returns / side effects:** `FiatRateDay | null`. Calls `fetchFxSpot` on mount and on the refresh timer while enabled; clears the timer on unmount.
- **Used by:** `ForumLoader`, `InboxLoader`, `ModeratorGroupScreen`, `PayLinkScreen`, `PosTill`, `PosAmount`, `MenuAccountHeader`, `WalletBalance`, `WalletHistory`, `WalletSend`, `CreditLedger`, `ExternalAuthorProfile`, `MemberProfileScreen`, `PublicMessageLoader`, `PublicMessageThread`.

## Function: shownFiatForSats

- **Purpose:** The four fiat amounts shown for a sat amount the visitor is about to pay, using the same spot rate as the preview. They are stored with the new payment.
- **Inputs:** Whole `sats` and `rateDay` (`FiatRateDay | null`).
- **Returns / side effects:** `{ amountUsd, amountChf, amountEur, amountPhp }`, each a two-decimal string or `null`. No I/O.
- **Used by:** `ForumLoader`, `InboxLoader`, `MemberProfileScreen`, `PublicMessageThread`.

## Function: satsToFiatAmount

- **Purpose:** Scales whole sats into a two-decimal fiat string using one rate (`Math.round` on cents): the spot rate from `useSpotRate`, or one gift day's totals on the statistics pages.
- **Inputs:** `sats`, `day` (`FiatRateDay | null`), `code` (`FiatCode`).
- **Returns / side effects:** `"0.02"`-style string, or `null` when the day or that fiat is missing or that price is `"0.00"` (not a usable rate).
- **Used by:** `ForumBoard`, `preferredFiatSuffix`, `InboxScreen`, `WalletSend`.

## Function: preferredFiatSuffix

- **Purpose:** Preferred-fiat suffix next to a ₿ amount (`·` plus the visitor's default fiat), shared
  by the forum, public thread, and inbox/moderator-group threads. Bitcoin is not the visitor's
  default fiat, so the suffix is required whenever a figure exists. A stored string for that
  currency is shown as-is and is not recomputed. A null or missing field uses the current spot
  rate. Returns null only when there is no stored string and no usable rate. Unsent previews omit
  `stored` and use that same rate.
- **Inputs:** Whole sats, latest `FiatRateDay` or `null`, visitor `FiatCode`, number-format
  style, optional `stored` `{ amountUsd?, amountChf?, amountEur?, amountPhp? }` (`string | null`).
  A present string is formatted as-is (`rateDay` ignored). A present `null` or a missing field
  falls through to the spot rate.
- **Returns / side effects:** `ReactElement | null`. No side effects.
- **Used by:** `ForumBoard`, `InboxScreen`, `QuotedForumNote`, `PublicMessageLoader`, `WalletBalance`, `WalletPay`, `WalletSend`.

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

## Function: getE2eNow

- **Purpose:** Reads the optional Playwright clock `NEXT_PUBLIC_E2E_NOW`. Production leaves it unset.
- **Inputs:** None.
- **Returns / side effects:** The pinned instant, or `null` when unset or empty. Does not throw and does not invent a time. The head script then uses the device clock.
- **Used by:** `RootLayout` for the `e2e-now` meta tag; `useWallet`, `useWalletPay`, and `useWalletSend`, which honour their fixture pins only when it is set.

## Function: getBreezApiKey

- **Purpose:** Reads the optional `NEXT_PUBLIC_BREEZ_API_KEY`. Unset or empty disables the in-app wallet (no SDK import, no network call, no balance block).
- **Inputs:** None. Literal `process.env.NEXT_PUBLIC_BREEZ_API_KEY` access.
- **Returns / side effects:** The key string, or `null` when unset or `''`. Never throws.
- **Used by:** `useWalletStore`, `connectWallet`, `listenForWalletPhrase`, `rememberPhraseFromPrf`, `usePasskeyLogin`.

## Function: getPlatformUsername

- **Purpose:** Reads the optional `NEXT_PUBLIC_PLATFORM_USERNAME`, the username of the 21.gifts platform account, set per deployment. In the Docker image it is an optional `entrypoint.sh` placeholder: an unset value is substituted with an empty string and the container still starts. Donations to the project go to that account's in-app wallet address `<username>@<app host>`. Unset, empty, or blank means the landing page shows no donation address.
- **Inputs:** None. Literal `process.env.NEXT_PUBLIC_PLATFORM_USERNAME` access (dot access, so the build inlines the value). The blank check is a regular expression so the minifier cannot fold it against the placeholder.
- **Returns / side effects:** The trimmed username, or `null` when unset or blank. Never throws.
- **Used by:** `projectDonateAddress`.

## Function: getSentryDsn

- **Purpose:** Reads the optional error-reporting DSN `NEXT_PUBLIC_SENTRY_DSN`, set per deployment. An optional `entrypoint.sh` placeholder like `NEXT_PUBLIC_PLATFORM_USERNAME`. Unset, empty, or blank turns error reporting off.
- **Inputs:** None. Literal `process.env.NEXT_PUBLIC_SENTRY_DSN` access; regular-expression blank check, as in `getPlatformUsername`.
- **Returns / side effects:** The trimmed DSN, or `null` when unset or blank. Never throws.
- **Used by:** `sentryOptions`, `forwardSentryEnvelope`.

## Function: getSentryEnvironment

- **Purpose:** Reads the optional error-reporting environment name `NEXT_PUBLIC_SENTRY_ENVIRONMENT` (for example `staging`), set per deployment. An optional `entrypoint.sh` placeholder.
- **Inputs:** None. Literal `process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT` access; regular-expression blank check.
- **Returns / side effects:** The trimmed name, or `null` when unset or blank (reports then use the SDK default, `production`). Never throws.
- **Used by:** `sentryOptions`.

## Function: sentryOptions

- **Purpose:** Builds the error-reporting init options for the browser or the server and edge runtimes, or `null` when `NEXT_PUBLIC_SENTRY_DSN` is unset, empty, or not a DSN (then nothing starts and nothing is sent).
- **Inputs:** `'browser'` or `'server'`. Reads `getSentryDsn`, `getSentryEnvironment`, and `getAppVersion` (the release).
- **Returns / side effects:** Errors only: `tracesSampleRate: 0`, no trace headers, no sessions, replay, profiling, feedback, or client reports. No user info, IP address, cookies, bodies, query strings, or stack-frame variables (`dataCollection`). Drops the session, tracing, local-variable, and console integrations. Browser options post to the same-origin tunnel `/monitoring`. `beforeSend` and `beforeBreadcrumb` remove the user, reduce the request to method, path, User-Agent and Referer, and replace recovery-phrase-shaped word runs in any letter case, `lnbc`/`lntb`/`lnurl` strings, `spark1`/`sparkrt1` addresses, 64+ hex digits, raw byte arrays (typed arrays such as `Uint8Array`), bearer tokens, the stored session token, URL queries and fragments, and every value under keys such as `mnemonic`, `phrase`, `words`, `seed`, `token`, `secret`, `prf`, `invoice`, or `pr`. Console breadcrumbs are dropped; request breadcrumbs keep method, path, and status only.
- **Used by:** `register` (`src/instrumentation.ts`) and `src/instrumentation-client.ts`.

## Function: forwardSentryEnvelope

- **Purpose:** Same-origin error-report tunnel behind `POST /monitoring`, so content blockers do not drop reports. Forwards one browser envelope to the configured DSN's project.
- **Inputs:** Incoming `Request` whose body is an envelope; its header line must name the configured DSN's host and project.
- **Returns / side effects:** 404 while error reporting is off, 413 above 1 MiB, 400 for another host or project or a broken header, 502 when the Sentry server cannot be reached, otherwise the upstream status with an empty body. Does not pass on the visitor's IP address, cookies, or headers.
- **Used by:** Route POST `/monitoring`.

## Function: register

- **Purpose:** Next.js server start hook (`src/instrumentation.ts`) for the Node.js and edge runtimes. Starts error reporting with `sentryOptions('server')`.
- **Inputs:** None.
- **Returns / side effects:** Calls the SDK `init` when a DSN is set; otherwise does nothing (no reports, no network traffic).
- **Used by:** Next.js at server start.

## Function: onRequestError

- **Purpose:** Next.js hook in `src/instrumentation.ts` for errors thrown while rendering a page or handling a route on the server. It is the SDK's `captureRequestError`.
- **Inputs:** The error, the request (path, method, headers), and the route context, from Next.js.
- **Returns / side effects:** Reports the error when error reporting is on; the `sentryOptions` scrubber then keeps only method, path, User-Agent, and Referer of the request. A no-op while error reporting is off.
- **Used by:** Next.js on server request errors.

## Function: GlobalError

- **Purpose:** Last-resort error boundary (`src/app/global-error.tsx`) for render errors no other boundary catches, including errors in the root layout.
- **Inputs:** `error` — the caught error.
- **Returns / side effects:** Reports the error once (a no-op while error reporting is off) and renders its own `<html lang="en">` document with the Next.js error page, because it replaces the root layout.
- **Used by:** Next.js App Router.

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

## Function: isSmartphoneUserAgent

- **Purpose:** Detects a smartphone so the public pay link can hide its invoice QR (`src/lib/payment-link.ts`). True for iPhone, iPod, and Android with `Mobile`; false for iPad, Android tablet (no `Mobile`), and desktop. Viewport width is irrelevant.
- **Inputs:** `userAgent` string (`navigator.userAgent`).
- **Returns / side effects:** `true` iff the UA is a smartphone. No side effects.
- **Used by:** `PayLinkScreen` only, to hide its invoice QR on a smartphone. Member pay sheets show no invoice QR on any device and do not call it.

## Function: lightningHref

- **Purpose:** Builds the generic `lightning:` URI for a payment request or an address, so the device opens whichever Bitcoin wallet app handles that scheme. No particular wallet is named (`src/lib/payment-link.ts`).
- **Inputs:** `request` — a BOLT11 payment request or a `name@domain` address, as issued.
- **Returns / side effects:** `lightning:` plus the trimmed request, e.g. `lightning:lnbc21n1…` or `lightning:alice@21.gifts`. Pure; no casing change, no I/O.
- **Used by:** `PayLinkScreen` (**Pay** on an issued invoice) and the landing `Home` page (the project donate address link).

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
- **Inputs:** `sessionToken`, `name`, and optional `sundayWrite` (`enforce` default, or `setup` to omit `Time-Zone` during onboarding).
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
- **Inputs:** `sessionToken`, `username`, and optional `sundayWrite` (`enforce` default, or `setup` to omit `Time-Zone` during onboarding).
- **Returns / side effects:** Updated `Account`. Throws `'username-taken'` on 409, `'username-invalid'` on 400, `'username-request'` on other failures.
- **Used by:** `UsernameForm`.

## Function: giftsLightningAddress

- **Purpose:** Build the public `username@21.gifts` address shown on profiles. It is the member's only address: payments to it settle in the member's own in-app wallet, and wallets resolve it at `/.well-known/lnurlp/:username`. Loopback hosts fall back to `21.gifts`.
- **Inputs:** `username` (nullable), optional `hostname`.
- **Returns / side effects:** `local@domain` or `null`. No I/O.
- **Used by:** `MemberProfileScreen`, `ViewProfileScreen`, `openCryptoPayQrValue`, `projectDonateAddress`, `WalletPay`.

## Function: projectDonateAddress

- **Purpose:** Address for donations to the 21.gifts project: the platform account's own in-app wallet address, `<platform username>@<app host>`, built with `giftsLightningAddress` from `getPlatformUsername`.
- **Inputs:** `hostname` — the host the page was requested on (`21.gifts`, `dev.21.gifts`, `localhost`); loopback hosts fall back to `21.gifts` as in `giftsLightningAddress`.
- **Returns / side effects:** The address, or `null` when the build sets no platform username. No I/O.
- **Used by:** The landing `Home` page, which shows the `#project` donate section only when this is not `null`.

## Function: encodeLnurl

- **Purpose:** BIP-173 bech32-encode a cleartext URL with HRP `lnurl` and return it uppercase, for an Open CryptoPay `lightning` query parameter.
- **Inputs:** `url` string.
- **Returns / side effects:** Uppercase `LNURL1…`. No I/O.
- **Used by:** `openCryptoPayQrValue`.

## Function: openCryptoPayQrValue

- **Purpose:** Build the Open CryptoPay QR payload for a profile handle. Null when `giftsLightningAddress` is null.
- **Inputs:** `username` (nullable), optional `hostname`.
- **Returns / side effects:** `https://<domain>/pl/?lightning=<LNURL>` or `null`. No I/O. The browser page for that URL is `/pl`.
- **Used by:** `MemberProfileScreen`, `ViewProfileScreen`, `WalletPay`, `ShopStickerOverlay` (sticker QR payload).

## Function: buildShopStickerSvg

- **Purpose:** Printable shop-window sticker for one member as a standalone SVG document. The fixed artwork (orange band with the Bitcoin mark, **ACCEPTED HERE** / **TINATANGGAP DITO**, the English and Filipino scan text, the sari-sari shop with the 21.gifts sign) comes from `src/lib/shop-sticker-artwork.ts`, which `scripts/build-shop-sticker-artwork.mjs` generates with every glyph converted to an outline. Only three colours: orange `#F99602`, black, white.
- **Inputs:** `qrValue` — the member's `openCryptoPayQrValue`. Optional `lang` — default Filipino (English + Filipino artwork). `spanish`, `german`, `french`, and `kikamba` replace artwork indices 6–12. `english` replaces those indices with the English scan block only (no second headline).
- **Returns / side effects:** SVG markup, `width="134.4mm"`, `viewBox="0 0 1500 918"`. The QR is error correction H in byte mode, at least version 10 (57 modules; shorter payloads are padded up so the 4-module quiet zone to the band holds), with an odd-sized centre (13 of 57 modules, 15 of 61, …) cleared for the orange Open CryptoPay mark. No I/O.
- **Used by:** `ShopStickerOverlay` (preview `<img>` data URL), `shopStickerBlob` (SVG, PNG, JPG).

## Function: buildShopStickerPdf

- **Purpose:** The same sticker as a one-page vector PDF for print, without a PDF library: the artwork paths (absolute M, L, C, Z) become PDF path operators, the QR modules become rectangles.
- **Inputs:** `qrValue` — the member's `openCryptoPayQrValue`. Optional `lang` — same languages as `buildShopStickerSvg` (default Filipino).
- **Returns / side effects:** PDF 1.4 bytes (`Uint8Array`), MediaBox 134.4 × 82.25 mm, no fonts, no images, exact xref offsets. No I/O.
- **Used by:** `shopStickerBlob` (format `pdf`).

## Function: shopStickerBlob

- **Purpose:** The shop-sticker file in the format the visitor picked.
- **Inputs:** `qrValue`, `format` — one of `SHOP_STICKER_FORMATS` (`pdf`, `png`, `jpg`, `svg`). Optional `lang` — same languages as `buildShopStickerSvg` (default Filipino).
- **Returns / side effects:** `Promise<Blob>`: `application/pdf` from `buildShopStickerPdf`; `image/svg+xml` from `buildShopStickerSvg`; PNG / JPEG drawn from that SVG on a 3000 × 1836 canvas over white (JPEG quality 0.95). Rejects when the browser cannot load the SVG image, has no 2D canvas, or cannot encode it. The object URL used for the SVG image is always revoked. Nothing is sent to the api.
- **Used by:** `ShopStickerOverlay` (**Download**).

## Function: shopStickerFileName

- **Purpose:** Download name for a member's sticker.
- **Inputs:** `handle` (`username@domain` or a bare username), `format`. Optional `lang` — default Filipino, which keeps the historical unsuffixed name. `english`, `spanish`, `german`, `french`, and `kikamba` insert `-english`, `-spanish`, `-german`, `-french`, or `-kikamba` before the extension.
- **Returns / side effects:** `21gifts-shop-sticker-<username>[-language].<format>`. The username is lowercased and reduced to `a-z 0-9 . _ -` (`member` when nothing is left). No I/O.
- **Used by:** `ShopStickerOverlay`.

## Function: shopStickerLangFromQuery

- **Purpose:** Selects the printable shop-sticker text language from a `lang` query value.
- **Inputs:** `value` — raw `lang` query value, or null when the parameter is absent.
- **Returns / side effects:** Trimmed, case-insensitive. `kikamba`/`kam`; `filipino`/`fil`; Spanish `spanish`/`spanisch`/`es`/`espanol`/`español`; German `german`/`deutsch`/`de`; French `french`/`fr`/`francais`/`français`/`französisch`/`franzosisch`; English-only `english`/`en`/`none`/`keine`. Null, blank, and unknown stay `filipino`. That fallback is not the overlay default. No I/O.
- **Used by:** `shopStickerLangFromLocation`.

## Function: shopStickerLangFromLocation

- **Purpose:** Selects the printable shop-sticker text language from the current page URL.
- **Inputs:** None. Reads the current `lang` query via `shopStickerLangFromQuery`.
- **Returns / side effects:** The language from that query (`english`, `spanish`, `german`, `french`, `filipino`, or `kikamba`), or `filipino` when the query is missing, unknown, or `window` is missing. No I/O. A missing query returning `filipino` does not select the overlay; auto-open stays Kikamba-only.
- **Used by:** `MemberProfileScreen` (Kikamba still auto-opens the overlay).

## Function: shopStickerLangInitial

- **Purpose:** First sticker language for the overlay. A known `lang` query wins. Otherwise the visitor's UI language: English selects English only, Deutsch selects German, Español selects Spanish, Filipino selects Filipino. French and Kikamba are not UI languages.
- **Inputs:** `locale` — one of `en`, `de`, `es`, `fil`. When `window` exists, also reads the current `lang` query.
- **Returns / side effects:** A known alias (`kikamba`/`kam`, `fil`/`filipino`, Spanish, German, French, or English-only `en`/`none`/`keine`) wins over the UI language. A missing, blank, or unknown query, and a missing `window`, use the UI language (`en` → `english`, `de` → `german`, `es` → `spanish`, `fil` → `filipino`). An explicit Filipino query is not treated as missing. No I/O.
- **Used by:** `ShopStickerOverlay` (first selection only).

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

## Function: lnurlPayAddress

- **Purpose:** Name the receiver of an LNURL the way a pasted Lightning address is named. An LNURL whose URL is `https://<host>/.well-known/lnurlp/<name>` is the address `<name>@<host>` on any host.
- **Inputs:** `text` as pasted or scanned: a bech32 LNURL (an optional `lightning:` prefix is removed, surrounding space is trimmed) or an `https` `/pl/` link that carries one in its `lightning` query, as in a profile or point-of-sale QR. Only that LNURL names the address; the link's own host, port, and other query keys are not read. A link with another scheme or path gives `null`.
- **Returns / side effects:** `<name>@<host>` with the name as it stands in the URL, or `null` for other text and for an LNURL that is not https, has a port other than 443, a query, or user info, has another path, or has a name an address cannot carry (only letters, digits, `.`, `_`, `+`, `-`). Pure; does not call the network.
- **Used by:** `useWalletSend` (recipient of the amount and confirm steps, and the `send-confirm-fixed` pin).

## Function: PayLinkScreen

- **Purpose:** Public payment card: the person's name, an exact satoshi amount, and one BOLT11 invoice.
- **Inputs:** `lightning` query string.
- **Returns / side effects:** `PageChrome` with `ProfileChromeLeft` (wordmark `HomeWordmark`) and a light language switcher. The arrow returns to the previous in-app view, or `/welcome` when this tab has none. Renders the shop sticker's storefront for a real pay link, and the welcome glyph only when the link is not valid. After `GET /pay/:username`, shows the name and amount form, or that open till. **Continue** posts the amount and then shows the active payment (locked sats, the default fiat when the spot rate is usable, and **Pay**, no amount field). One `useSpotRate` call, made once the pay profile is loaded, feeds both the amount field and that fiat line, so creating the payment does not ask for the rate again. **Pay** (aria **Pay with a Bitcoin wallet app**) is the width of the invoice QR plate, centered, not the page column. With an issued invoice, **Pay** sets `window.location.href` to the generic `lightning:` link from `lightningHref`, so the device opens whichever Bitcoin wallet app handles that scheme; no particular wallet is named and there is no wallet icon. Before the invoice exists **Pay** is disabled, except after a failed create, when it requests the invoice again. Off a smartphone the invoice QR shows above **Pay**. A smartphone does not show it (`isSmartphoneUserAgent`, not viewport), before or after the payment is active. A new `lightning` value clears the previous person, including an invoice that is still being created. A positive fiat amount before the gift-day request settles says that currency's rate is still loading. After it settles with no usable day, the alert names that currency. No forum and no auth gate.
- **Used by:** `PayLinkPage`.

## Function: PayLinkPage

- **Purpose:** `/pl` server page. Reads the `lightning` query and renders `PayLinkScreen`.
- **Inputs:** `searchParams` promise with an optional `lightning` string or array.
- **Returns / side effects:** The payment screen. Does not 404 when the query is missing.
- **Used by:** The App Router at `/pl`.

## Function: translate

- **Purpose:** Look up a catalog key, expand `{count, plural, one {…} other {…}}` (one when `count` is 1, otherwise other; `#` in the chosen branch becomes that count), then replace `{name}` placeholders from `vars`.
- **Inputs:** `catalog` (`Messages`), `key` (`MessageKey`), optional `vars` map of string/number values. A plural header needs a finite `count`.
- **Returns / side effects:** Interpolated string. A broken plural header is left in place. Throws on a missing key, a plural header without a finite `count`, or a missing `{name}` — no silent English fallback.
- **Used by:** Server pages (`Home`, login headings, `NotFound`, `MarketingFooter`, `HandbookPage`) and the `t` helper from `LocaleProvider` / `useTranslations`.

## Function: useAuthStore

- **Purpose:** Zustand store for `session` + `account` plus `wrongAccount`. Hydration is explicit (no module-init `localStorage`).
- **Inputs:** Hook. Methods `setAuth`, `setAccount`, `clearAuth`, `setWrongAccount`, `clearWrongAccount`.
- **Returns / side effects:** Auth state object. `clearAuth` clears storage, then `bumpUnreadAppBadgeEpoch()` then `setUnreadAppBadge(0)`, then drops `session` and `account`. It clears the tab phrase, which disconnects the wallet. It does not reset `wrongAccount`.
- **Used by:** `LoginCard`, `OnboardingGate`, `NameSetup`, `RulesSetup`, `WelcomeScreen`, `LogoutButton`, `useHydrateSession`, `usePasskeyLogin`, `NameForm`, `useWallet`, `rememberPhraseFromPrf`, `unlockWalletPhrase`, `useWalletPay`, `useWalletSend`, `WalletPay`, `WalletSend`.

## Function: useTranslations

- **Purpose:** Client hook returning `{ locale, t }` from the nearest `LocaleProvider`.
- **Inputs:** None (React context).
- **Returns / side effects:** Active locale and a `t(key, vars?)` bound to that catalog. Throws if used outside `LocaleProvider`.
- **Used by:** `MarketingHeader`, `LanguageSwitcher`, `LoginCard`, `ForumBoard`, `NameForm`, `HandbookCopyLink`, `NameSetup`, `RulesSetup`, `WelcomeScreen`, `LogoutButton`, `WalletBalance`, `WalletPay`, `WalletSend`.

## Function: useNumberFormat

- **Purpose:** Client hook returning `{ numberFormat, setNumberFormat }` from the nearest `NumberFormatProvider`. Call sites that format counts or money take this hook's style, not UI locale.
- **Inputs:** None (React context).
- **Returns / side effects:** Active `NumberFormatStyle` and a setter that writes the `numberFormat` cookie. Throws `useNumberFormat must be used within NumberFormatProvider` when used outside the provider.
- **Used by:** `NumberFormatSwitcher`, `ForumBoard`, `StatsDashboard`, `DayLoader`, `AccountActivityChart`, `PublicMessageLoader`, `WalletBalance`, `WalletPay`, `WalletSend`.

## Function: DELETE

- **Purpose:** Shared App Router DELETE export name. `/me/push-subscriptions` re-exports `proxyMePushSubscriptionsDelete`; `/forum/messages/[id]` re-exports `proxyMessagesDelete`; `/pos/charge` re-exports `proxyPosDelete`.
- **Inputs:** Incoming `Request`. For `/forum/messages/[id]`, also async route `params` with the message id.
- **Returns / side effects:** Upstream api `Response`.
- **Used by:** Same-origin `deletePushSubscription` / `disablePush`, and same-origin forum moderation delete (`deleteMessage`).

## Function: PATCH

- **Purpose:** Shared App Router PATCH export name. `/forum/messages/[id]/place` re-exports `proxyMessagesPlacePatch`. `/forum/messages/[id]/shop-account` re-exports `proxyMessagesShopAccountPatch`. `/forum/messages/[id]/text` re-exports `proxyMessagesTextPatch`. `/forum/messages/[id]/photos` re-exports `proxyMessagesPhotosPatch`.
- **Inputs:** Incoming `Request`. For `/forum/messages/[id]/place`, `/forum/messages/[id]/shop-account`, `/forum/messages/[id]/text`, and `/forum/messages/[id]/photos`, also async route `params` with the message id.
- **Returns / side effects:** Upstream api `Response`.
- **Used by:** Same-origin forum staff place save (`setMessagePlace`), shop-account save (`setMessageShopAccount`), shop-note text save (`setMessageShopText`), and shop-note photo save (`setMessageShopPhotos`).

## Function: AboutPage

- **Purpose:** Next.js page for `/about`. Three convictions, Matthew 10:8, 1 John 3:18, and a CTA into `/welcome`.
- **Inputs:** None. Calls `getRequestLocale()` and reads copy from the catalog via `translate`.
- **Returns / side effects:** The about screen with a link to `/welcome`.
- **Used by:** Route `/about`.

## Function: LegalPage

- **Purpose:** Next.js page for `/legal` (imprint and privacy). No published email — contact is in-app via `/contact`. The Privacy Policy states what is true about the website (no advertising, no analytics scripts, the cookies it sets) and its **Wallet and payment data** paragraph points to the **Wallet and data** section of the Terms of Use instead of promising the opposite.
- **Inputs:** None.
- **Returns / side effects:** The legal screen with links to `/contact`, `/terms`, and `/terms#wallet-and-data`.
- **Used by:** Route `/legal`.

## Function: TermsPage

- **Purpose:** Next.js page for `/terms`: the Terms of Use with the **Wallet and data** section (anchor `#wallet-and-data`) and five numbered clauses, each with a short heading, plus the last-updated date 6 October 2026.
- **Inputs:** None. Calls `getRequestLocale()` and reads every string from the catalog via `translate` (`terms.title`, `terms.lastUpdated`, `terms.heading`, `terms.clause1Title`…`terms.clause5Title`, `terms.clause1`…`terms.clause5`), so the page renders in German, English, Spanish, or Filipino. English `title`/`description` metadata is the documented exception.
- **Returns / side effects:** The terms screen: an `h1`, the date line, an `h2`, and an ordered list of the five clauses. No links, no state.
- **Used by:** Route `/terms`; linked from `LegalPage`, `MarketingFooter`, and `RulesSetup` (last chapter).

## Function: MarketingFooter

- **Purpose:** Footer for marketing pages: wordmark, localized section links including About, legal, Terms of Use (`/terms`), living-room rules, GitHub, and a quiet Matthew 10:8 verse.
- **Inputs:** None. Resolves locale via `getRequestLocale` and reads copy from the catalog via `translate`.
- **Returns / side effects:** Footer element.
- **Used by:** `MarketingLayout`, `NotFound`.

## Function: MarketingHeader

- **Purpose:** Sticky marketing header with one top-left arrow (`ProfileChromeLeft` `tone="dark"`) beside `HomeWordmark` (`tone="dark"`; `/` unsigned, `/welcome` when a session is hydrated). The arrow returns to the previous in-app view, or `/welcome` when this tab has none. The wordmark is not that control. Section nav (How / Happyland / Why / FAQ / About / Stats / Handbook, accent **Log in**, optional `PwaInstall` `tone="dark"` `placement="header"`), always-visible `LanguageSwitcher` (`tone="dark"`), and a mobile menu toggle. Happyland links to the existing `/#happyland` photo essay from any marketing page. ThemeSwitcher and NumberFormatSwitcher are marketing-forbidden.
- **Inputs:** None. Internal open state. Reads copy via `useTranslations`.
- **Returns / side effects:** Header element; toggles nav on small screens. `LanguageSwitcher` stays visible when the hamburger is closed. Install control stays `null` until after mount when an offer applies.
- **Used by:** `MarketingLayout`, `NotFound` (no extra props).

## Function: MarketingLayout

- **Purpose:** Async dark full-page shell for `/`, `/about`, `/legal`, `/terms`, `/handbook`, and `/stats`.
- **Inputs:** `children`. Awaits `MarketingFooter()` (does not render it as a JSX child).
- **Returns / side effects:** Wrapper div with header, page, and awaited footer.
- **Used by:** Marketing route group.

## Function: NotFound

- **Purpose:** Async app-wide 404 screen with marketing chrome and localized body copy.
- **Inputs:** None. Calls `getRequestLocale()` for body copy; awaits `MarketingFooter()`.
- **Returns / side effects:** 404 element with `MarketingHeader` (the only back control is that header arrow) and awaited footer (not rendered as JSX child). No **Back home** button.
- **Used by:** Next.js `not-found.tsx`.

## Function: POST

- **Purpose:** Shared App Router POST export name. `/me/name` re-exports `proxyMeNamePost`; `/me/location` re-exports `proxyMeLocationPost`; `/me/forum-laws-dismissed` re-exports `proxyMeForumLawsDismissedPost`; `/me/notification-level` re-exports `proxyMeNotificationLevelPost`; `/me/rules-agreement` re-exports `proxyMeRulesAgreementPost`; `/me/push-subscriptions` re-exports `proxyMePushSubscriptionsPost`; `/me/wallet-backup-seen` re-exports `proxyMeWalletBackupSeenPost`; `/lnurlpay/[pubkey]` calls `proxyLnurlpayRegisterPost` and `/lnurlpay/[pubkey]/recover` calls `proxyLnurlpayRecoverPost` with the async `pubkey`; `/me/passkey-renew/report` re-exports `proxyMePasskeyRenewReportPost`; `/me/passkey-renew/ack` re-exports `proxyMePasskeyRenewAckPost`; `/auth/passkey/{register,authenticate,replace,seed}/{begin,finish}` re-export the eight passkey proxy POSTs; `/forum/messages` re-exports `proxyMessagesPost`; `/messages/[id]/invoice` re-exports `proxyMessagesInvoicePost`; `/messages/[id]/repayment` re-exports `proxyMessagesRepaymentPost`; `/conversations` re-exports `proxyConversationsPost`; `/conversations/[id]` re-exports `proxyConversationPost`; `/conversations/[id]/invoice` re-exports `proxyConversationInvoicePost`; `/conversations/[id]/read` re-exports `proxyConversationReadPost`; `/forum/notifications/read-all` re-exports `proxyNotificationsReadAllPost`; `/forum/notifications/read-by-message` re-exports `proxyNotificationsReadByMessagePost`; `/forum/notifications/read-visible` re-exports `proxyNotificationsReadVisiblePost`; `/forum/notifications/[id]/read` re-exports `proxyNotificationReadPost`; `/contact/submit` re-exports `proxyContactPost`; `/lnurl/pay-request` re-exports `proxyLnurlPayRequestPost`; `/lnurl/invoice` re-exports `proxyLnurlInvoicePost`; `/translate` re-exports `proxyTranslateNotePost` with JSON `{ messageId, target }`; `/conversations/[id]/messages/[messageId]/translate` re-exports `proxyTranslateConversationMessagePost` with JSON `{ target }`; `/trust/verify` re-exports `proxyTrustVerifyPost`; `/trust/propose-moderator` re-exports `proxyTrustProposeModeratorPost`; `/trust/confirm-moderator` re-exports `proxyTrustConfirmModeratorPost`; `/trust/reject-moderator` re-exports `proxyTrustRejectModeratorPost`; `/trust/appoint-moderator` re-exports `proxyTrustAppointModeratorPost`; `/funding/apply` re-exports `proxyFundingApplyPost`; `/funding/trial` re-exports `proxyFundingTrialPost`; `/funding/admit` re-exports `proxyFundingAdmitPost`; `/funding/reject` re-exports `proxyFundingRejectPost`; `/funding/daily-roster/comment` re-exports `proxyFundingDailyRosterCommentPost`; `/funding/daily-roster/payments` re-exports `proxyFundingDailyRosterPaymentsPost`; `/funding/daily-roster/recipients` re-exports `proxyFundingDailyRosterRecipientsPost`; `/funding/daily-roster/recipients/update` re-exports `proxyFundingDailyRosterRecipientsUpdatePost`; `/funding/daily-roster/recipients/delete` re-exports `proxyFundingDailyRosterRecipientsDeletePost`. `/pos/charge` re-exports `proxyPosPost`. HTML `/pos` is the till page, not a POST proxy. HTML `/messages` is the inbox page, not a POST proxy.
- **Inputs:** Incoming `Request`.
- **Returns / side effects:** Upstream api `Response` on api proxies; `/translate` returns `{ translatedText, cached }` or 400/404/503/502 from the 21.gifts api.
- **Used by:** Same-origin name save, location save (`POST /me/location`), forum laws dismiss, notification-level save (`POST /me/notification-level`), living-room rules agreement (`POST /me/rules-agreement`), Web Push subscribe (`POST /me/push-subscriptions`), recovery-phrase backup-seen (`POST /me/wallet-backup-seen`), renew report (`POST /me/passkey-renew/report`), renew acknowledgement (`POST /me/passkey-renew/ack`), passkey begin/finish (register, authenticate, replace, and seed), forum message create (`POST /forum/messages`), payable-reply invoice (`POST /messages/[id]/invoice`), today's repayment (`POST /messages/[id]/repayment`), inbox open (`POST /conversations`) and reply (`POST /conversations/[id]`), inbox invoice (`POST /conversations/[id]/invoice`), mark-one conversation (`POST /conversations/[id]/read`), mark-all notifications (`POST /forum/notifications/read-all`), mark-by-message (`POST /forum/notifications/read-by-message`), mark-visible (`POST /forum/notifications/read-visible`), and mark-one (`POST /forum/notifications/[id]/read`), in-app contact (`POST /contact/submit`), the outside-address pay request and invoice of the wallet send flow (`POST /lnurl/pay-request`, `POST /lnurl/invoice`), `translateNote` via `POST /translate`, `translateConversationMessage` via `POST /conversations/[id]/messages/[messageId]/translate`, staff Trust Chain actions (`POST /trust/verify`, `POST /trust/propose-moderator`, `POST /trust/confirm-moderator`, `POST /trust/reject-moderator`, `POST /trust/appoint-moderator`), grant apply (`POST /funding/apply`), staff funding decisions (`POST /funding/trial`, `POST /funding/admit`, `POST /funding/reject`), and daily-roster saves (`POST /funding/daily-roster/comment`, `POST /funding/daily-roster/payments`, `POST /funding/daily-roster/recipients`, `POST /funding/daily-roster/recipients/update`, `POST /funding/daily-roster/recipients/delete`). The in-app wallet's address registration (`POST /lnurlpay/[pubkey]`, async `pubkey`, `proxyLnurlpayRegisterPost`) and address lookup (`POST /lnurlpay/[pubkey]/recover`, `proxyLnurlpayRecoverPost`) forward its signed JSON body and signature headers.

## Function: PUT

- **Purpose:** Shared App Router PUT export name. `/me/about` re-exports `proxyMeAboutPut`; `/me/wallet` re-exports `proxyMeWalletPut`.
- **Inputs:** Incoming `Request` with Bearer session and JSON `{ text }` (`/me/about`) or `{ sparkPubkey }` (`/me/wallet`).
- **Returns / side effects:** Upstream api `Response`.
- **Used by:** Same-origin About me save (`PUT /me/about` / `putAboutMe`) and the wallet key claim (`PUT /me/wallet` / `putWallet`).

## Function: proxyApiRequest

- **Purpose:** Forwards an App Router request to `getApiUrl()` + path. Copies query, authorization / content-type / time-zone / content-length / user-agent / origin / range headers, and the in-app wallet's `x-breez-signature` / `x-breez-timestamp`. Multipart POST/PUT/PATCH/DELETE bodies stream with `duplex: 'half'` when `request.body` is non-null and `Content-Length` is not `0`; JSON and other bodies are buffered (`arrayBuffer`) so Node fetch does not throw. Empty POSTs omit body and duplex. Copies content-type / content-length / content-range / accept-ranges / cache-control / content-disposition from the upstream response.
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

## Function: proxyFundingPayoutDaysGet

- **Purpose:** Same-origin Bearer proxy helper for api `GET /funding/payout-days`. Forwards the incoming Authorization header.
- **Inputs:** Incoming `Request` (Bearer session).
- **Returns / side effects:** Upstream `Response` via `proxyApiRequest`.
- **Used by:** Route GET `/funding/payout-days`.

## Function: proxyFundingApplicationsGet

- **Purpose:** Same-origin Bearer proxy helper for api `GET /funding/applications`. Forwards the incoming Authorization header.
- **Inputs:** Incoming `Request` (Bearer session).
- **Returns / side effects:** Upstream `Response` via `proxyApiRequest`.
- **Used by:** Route GET `/funding/applications`.

## Function: proxyFundingDailyRosterGet

- **Purpose:** Same-origin Bearer proxy helper for api `GET /funding/daily-roster`. Forwards the incoming Authorization header.
- **Inputs:** Incoming `Request` (Bearer session).
- **Returns / side effects:** Upstream `Response` via `proxyApiRequest`.
- **Used by:** Route GET `/funding/daily-roster`.

## Function: proxyFundingDailyRosterCommentPost

- **Purpose:** Same-origin Bearer proxy helper for api `POST /funding/daily-roster/comment` with JSON `{ comment }`.
- **Inputs:** Incoming `Request` (Bearer session and JSON body).
- **Returns / side effects:** Upstream `Response` via `proxyApiRequest`.
- **Used by:** Route POST `/funding/daily-roster/comment`.

## Function: proxyFundingDailyRosterPaymentsPost

- **Purpose:** Same-origin Bearer proxy helper for api `POST /funding/daily-roster/payments` with JSON `{ enabled }`.
- **Inputs:** Incoming `Request` (Bearer session and JSON body).
- **Returns / side effects:** Upstream `Response` via `proxyApiRequest`.
- **Used by:** Route POST `/funding/daily-roster/payments`.

## Function: proxyFundingDailyRosterRecipientsPost

- **Purpose:** Same-origin Bearer proxy helper for api `POST /funding/daily-roster/recipients` with JSON `{ accountId, amountUsd }`.
- **Inputs:** Incoming `Request` (Bearer session and JSON body).
- **Returns / side effects:** Upstream `Response` via `proxyApiRequest`.
- **Used by:** Route POST `/funding/daily-roster/recipients`.

## Function: proxyFundingDailyRosterRecipientsUpdatePost

- **Purpose:** Same-origin Bearer proxy helper for api `POST /funding/daily-roster/recipients/update` with JSON `{ address, amountUsd }`.
- **Inputs:** Incoming `Request` (Bearer session and JSON body).
- **Returns / side effects:** Upstream `Response` via `proxyApiRequest`.
- **Used by:** Route POST `/funding/daily-roster/recipients/update`.

## Function: proxyFundingDailyRosterRecipientsDeletePost

- **Purpose:** Same-origin Bearer proxy helper for api `POST /funding/daily-roster/recipients/delete` with JSON `{ address }`.
- **Inputs:** Incoming `Request` (Bearer session and JSON body).
- **Returns / side effects:** Upstream `Response` via `proxyApiRequest`.
- **Used by:** Route POST `/funding/daily-roster/recipients/delete`.

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
- **Inputs:** Incoming `Request` (JSON `{ accountId, confirmedName }`).
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

## Function: putProfilePhoto

- **Purpose:** `PUT /pictures/me` with `{ photo }` for the signed-in account. `null` clears the profile photo. Does not change the wide image or the About me note.
- **Inputs:** Session token, JPEG payload or `null`.
- **Returns / side effects:** Resolves on 2xx. Throws the save error otherwise.
- **Used by:** `ProfileScreen` via `AboutMeSection` `onSavePicture`.

## Function: fetchProfilePhoto

- **Purpose:** `GET /pictures/me` bytes for the signed-in account.
- **Inputs:** Session token.
- **Returns / side effects:** Blob. Throws the load error on failure or an empty body.
- **Used by:** `ProfileScreen` (resting header `ProfileImages` and `AboutMeSection` `loadPicture`).

## Function: proxyProfilePhotoGet

- **Purpose:** Same-origin Bearer proxy of api `GET /pictures/me`.
- **Inputs:** Incoming `Request`.
- **Returns / side effects:** Upstream `Response`.
- **Used by:** App Router `GET` on `/pictures/me`.

## Function: proxyProfilePhotoPut

- **Purpose:** Same-origin Bearer proxy of api `PUT /pictures/me`.
- **Inputs:** Incoming `Request`.
- **Returns / side effects:** Upstream `Response`.
- **Used by:** App Router `PUT` on `/pictures/me`.

## Function: putWideBanner

- **Purpose:** `PUT /banners/me` with `{ photo }` for the signed-in account. `null` clears the wide image. Does not change the About me photo.
- **Inputs:** Session token, JPEG payload or `null`.
- **Returns / side effects:** Resolves on 2xx. Throws the save error otherwise.
- **Used by:** `ProfileScreen` via `AboutMeSection` `onSaveBanner`.

## Function: fetchWideBanner

- **Purpose:** `GET /banners/me` bytes for the signed-in account.
- **Inputs:** Session token.
- **Returns / side effects:** Blob. Throws the load error on failure or an empty body.
- **Used by:** `ProfileScreen` (resting header `ProfileImages` and `AboutMeSection` `loadBanner`).

## Function: proxyWideBannerGet

- **Purpose:** Same-origin Bearer proxy of api `GET /banners/me`.
- **Inputs:** Incoming `Request`.
- **Returns / side effects:** Upstream `Response`.
- **Used by:** App Router `GET` on `/banners/me`.

## Function: proxyWideBannerPut

- **Purpose:** Same-origin Bearer proxy of api `PUT /banners/me`.
- **Inputs:** Incoming `Request`.
- **Returns / side effects:** Upstream `Response`.
- **Used by:** App Router `PUT` on `/banners/me`.

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

## Function: proxyExternalAuthorProfileGet

- **Purpose:** Public proxy GET `/messages/:id/external-profile` to the 21.gifts api (no auth). App path is `/public-messages/[id]/external-profile`.
- **Inputs:** Incoming `Request`, plus message `id` from the App Router segment.
- **Returns / side effects:** Upstream `Response` via `proxyApiRequest`. Does not add a Bearer header.
- **Used by:** Route GET `/public-messages/[id]/external-profile`.

## Function: proxyExternalAuthorPostsGet

- **Purpose:** Public proxy GET `/messages/:id/external-posts` to the 21.gifts api (no auth). App path is `/public-messages/[id]/external-posts`. Returns the upstream response via `proxyApiRequest`. Does not add a Bearer header.
- **Inputs:** Incoming `Request`, plus message `id` from the App Router segment.
- **Returns / side effects:** Upstream `Response` via `proxyApiRequest`. Does not add a Bearer header.
- **Used by:** Route GET `/public-messages/[id]/external-posts`.

## Function: proxyExternalAuthorRepliesGet

- **Purpose:** Public proxy GET `/messages/:id/external-replies` to the 21.gifts api (no auth). App path is `/public-messages/[id]/external-replies`. Returns the upstream response via `proxyApiRequest`. Does not add a Bearer header.
- **Inputs:** Incoming `Request`, plus message `id` from the App Router segment.
- **Returns / side effects:** Upstream `Response` via `proxyApiRequest`. Does not add a Bearer header.
- **Used by:** Route GET `/public-messages/[id]/external-replies`.

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

## Function: proxyLnurlPayRequestPost

- **Purpose:** Bearer proxy POST `/lnurl/pay-request` to the 21.gifts api (pay request of a Lightning address or LNURL on another host).
- **Inputs:** Incoming `Request` with Bearer session and `{ target }` JSON.
- **Returns / side effects:** Upstream `Response` via `proxyApiRequest` (502 JSON when the api is unreachable).
- **Used by:** Route POST `/lnurl/pay-request`.

## Function: proxyLnurlInvoicePost

- **Purpose:** Bearer proxy POST `/lnurl/invoice` to the 21.gifts api (invoice from a Lightning address or LNURL on another host).
- **Inputs:** Incoming `Request` with Bearer session and `{ target, amountMsat, comment? }` JSON.
- **Returns / side effects:** Upstream `Response` via `proxyApiRequest` (502 JSON when the api is unreachable).
- **Used by:** Route POST `/lnurl/invoice`.

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

## Function: base64UrlToBytes

- **Purpose:** Decode a base64url string to bytes for WebAuthn options.
- **Inputs:** Base64url string (padding optional).
- **Returns / side effects:** `Uint8Array`. No network.
- **Used by:** `creationOptionsFromJSON`, `requestOptionsFromJSON`, `unlockWalletPhrase`.

## Function: bytesToBase64Url

- **Purpose:** Encode bytes as unpadded base64url for WebAuthn JSON.
- **Inputs:** `Uint8Array`.
- **Returns / side effects:** Base64url string. No network.
- **Used by:** `credentialToJSON`, `usePasskeyLogin` (login PRF salt check).

## Function: creationOptionsFromJSON

- **Purpose:** Turn api creation-options JSON into `navigator.credentials.create` input, including `excludeCredentials` when present and client `extensions` (PRF `eval.first` as base64url) via `applyClientExtensions`.
- **Inputs:** Record from `POST /auth/passkey/register/begin` or `POST /auth/passkey/seed/begin`.
- **Returns / side effects:** `PublicKeyCredentialCreationOptions`. Uses native parse when present. Throws if a descriptor list is present but not an array, or is non-empty but has no valid `public-key` entries (invalid type or id is skipped; all skipped → TypeError), including before native parse.
- **Used by:** `usePasskeyLogin.register`, `renewPasskey`.

## Function: credentialToJSON

- **Purpose:** Serialise a `PublicKeyCredential` for the api finish body. Drops `clientExtensionResults.prf` so PRF bytes never leave the tab.
- **Inputs:** Browser credential from create/get.
- **Returns / side effects:** JSON record without `prf` results. Uses native `toJSON` when present, then strips `prf`.
- **Used by:** `usePasskeyLogin`, `renewPasskey`.

## Function: finishPasskeyAuthentication

- **Purpose:** POST `/auth/passkey/authenticate/finish` and parse the session.
- **Inputs:** `challengeId` and credential JSON.
- **Returns / side effects:** `{ token, account }`. Throws `WrongAccountError` on 403 with the duplicate-account api string. A 400 body exactly `Unknown credential` throws `UnknownCredentialError`. Other non-2xx stay status fallbacks.
- **Used by:** `usePasskeyLogin.authenticate`.

## Function: finishPasskeyRegistration

- **Purpose:** POST `/auth/passkey/register/finish` and parse the session.
- **Inputs:** `challengeId` and credential JSON.
- **Returns / side effects:** `{ token, account }` with `linkingKey` null. Throws `WrongAccountError` on 403 with the duplicate-account api string. A 409 whose error is exactly `Username is already in use` throws `Error` with that string. Other non-2xx stay status fallbacks.
- **Used by:** `usePasskeyLogin.submitName` for a new account, and `usePasskeyLogin.register` only with a view key.

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

## Function: DiagnosticsListener

- **Purpose:** Subscribe to window `error` and `unhandledrejection` and forward the error name and message to the diagnostic log.
- **Inputs:** None. Reads `window.location.pathname` when the event fires, plus the event's `error` or `reason`.
- **Returns / side effects:** Renders null. Posts `client.unhandled` through `reportDiagnostic`. Removes both listeners on unmount.
- **Used by:** Root layout, mounted once for every page.

## Function: proxyDiagnosticsPost

- **Purpose:** Proxies POST `/diagnostics` so the browser can store an allowlisted client event.
- **Inputs:** Incoming `Request` with a JSON body.
- **Returns / side effects:** Upstream `Response` (204 when accepted). Does not read or log the body itself.
- **Used by:** Route POST `/diagnostics`.

## Function: reportDiagnostic

- **Purpose:** POST one allowlisted client diagnostic to `/diagnostics`. Drops fields that fail the pattern instead of shortening them.
- **Inputs:** Event name plus optional name, message, stage, status, path, challenge id, account id, and whether a PRF output was present.
- **Returns / side effects:** void. Fire-and-forget `fetch` with `keepalive`. Never throws. Never sends PRF bytes, the recovery phrase, or a session token.
- **Used by:** `DiagnosticsListener`, `usePasskeyLogin`, `renewPasskey`, and `useWalletPhrase`.

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
- **Used by:** `renewPasskey`.

## Function: finishPasskeySeed

- **Purpose:** POST `/auth/passkey/seed/finish` with Bearer and `{ challengeId, credential }`.
- **Inputs:** Session token, challenge id, credential JSON.
- **Returns / side effects:** The owner account (`accountSchema`), including `passkeyCredentialId`. A 200 body is that account, or the same account under one `account` key when the body has no top-level `id`. `account` only holds when it is the only top-level field; a further field is not an account. No new token. Login is a different call. Throws on non-2xx or a body that is not an account.
- **Used by:** `renewPasskey`.

## Function: postWalletBackupSeen

- **Purpose:** POST `/me/wallet-backup-seen` with Bearer.
- **Inputs:** Session token.
- **Returns / side effects:** Owner `Account`. Throws on non-2xx.
- **Used by:** The helper remains. `useWalletPhrase` does not call it.

## Function: passkeyRenewDebug

- **Purpose:** Read public authenticator facts from a created passkey. PRF bytes, the credential id, and the attestation object are not copied.
- **Inputs:** The browser credential, or null when create threw, and a known `prfPresent` boolean or null.
- **Returns / side effects:** Attachment, transports, AAGUID, PRF flags, extension names, the WebAuthn flags byte, the COSE algorithm, resident key, hmac-secret, and credProtect. Missing methods and throws become null. No I/O.
- **Used by:** `renewPasskey` before it reports a ceremony failure or cancel.

## Function: passkeyRenewDebugFields

- **Purpose:** Drop null debug fields so a report that learned nothing keeps the original six-field body. Zero and false stay.
- **Inputs:** Facts from `passkeyRenewDebug`, or null.
- **Returns / side effects:** A partial object of only the known facts. No I/O.
- **Used by:** `renewPasskey` when it builds the renew report.

## Function: passkeyRenewClientCapabilities

- **Purpose:** Read browser capability names that are strictly true, such as `prf` and `hybridTransport`. This describes the browser, not the passkey.
- **Inputs:** None. Calls `PublicKeyCredential.getClientCapabilities` when the browser has it.
- **Returns / side effects:** A sorted comma-separated list, capped at 24 names, or null. Objects, false, and odd keys are dropped. No I/O besides that browser call.
- **Used by:** `renewPasskey` on every stored failure or cancel, including when create itself threw.

## Function: postPasskeyRenewReport

- **Purpose:** POST `/me/passkey-renew/report` with Bearer, the six safe fields, and optional public authenticator facts.
- **Inputs:** Session token and `{ stage, outcome, errorName, errorCode, httpStatus, message }` plus, when known, `authenticatorAttachment`, `transports`, `aaguid`, `prfEnabled`, `prfPresent`, `extensions`, `authenticatorFlags`, `publicKeyAlgorithm`, `residentKey`, `hmacSecret`, `credProtect`, and `clientCapabilities`.
- **Returns / side effects:** Owner `Account`. Throws `Could not report passkey renew` on non-2xx. Never sends a phrase, PRF bytes, credential, challenge, or token in the body.
- **Used by:** `renewPasskey` for browser-only ceremony failures and cancels.

## Function: postPasskeyRenewAck

- **Purpose:** POST `/me/passkey-renew/ack` with Bearer.
- **Inputs:** Session token.
- **Returns / side effects:** Owner `Account`. Throws `Could not acknowledge passkey renew` on non-2xx.
- **Used by:** `PasskeyRenewNotice` OK button.

## Function: renewPasskey

- **Purpose:** Runs the seed-passkey ceremony for a member who has no seed yet.
- **Inputs:** Session token.
- **Returns / side effects:** `ok` with the account and in-memory PRF bytes, `cancelled`, `stored` when reload already shows a seed, or `failed` with a wallet error kind. `failed` includes the owner account when that account has an open renew failure. HTTP seed failures are not reported again. A stored failure or cancel also sends the public authenticator facts and the browser capability names. Posts allowlisted seed diagnostics and never sends PRF bytes, the phrase, or the session token. After a successful finish it starts `rememberPhraseFromPrf` and does not wait for it. Does not persist the phrase (tab memory only).
- **Used by:** `useWalletPhrase.activate` and `PasskeyRenewNotice`.

## Function: PasskeyRenewNotice

- **Purpose:** Guided blocking renew while `walletRequired` is false: explain, confirm, device passkey prompt, then a success or failure confirmation.
- **Inputs:** None. Reads the auth store and translations. `?visual=renew-passkey` and `?visual=renew-ok` force those steps for screenshots, only in a Playwright build (`getE2eNow()` set); a production build ignores them.
- **Returns / side effects:** No dismiss control on the explanation. **Continue** starts the ceremony. Cancelling the device prompt returns to the explanation and is not a logged failure. Success stores the account only after **OK**. A failed ceremony stores the returned account and stays on the failure step only when that account has an open failure and the session is unchanged, so a remount stays there. When that account has `passkeyRenewPrfUnsupported`, the failure step shows `wallet.prfUnsupported` (**This phone or browser cannot hold a 21.gifts wallet. Please use an up-to-date phone or browser that supports passkeys.**). An HTTP seed error that did not record a failure returns to the explanation. Failure **OK** stores the acknowledged account only while that same session is still current, then the dialog closes and does not start again. Null once success is confirmed, a failure was acknowledged, or `passkeyRenewClosed` is true.
- **Used by:** `AppShell` when `walletRequired === false` and `passkeyRenewClosed` is not true.

## Function: FundingPausedCopy

- **Purpose:** Paused-applications sentence plus the statistics anchor. Renders no button and does not read a shop count; the pause is unconditional until a later change removes it.
- **Inputs:** None. Uses translations.
- **Returns / side effects:** The paused paragraph and the `https://21.gifts/statistics` anchor.
- **Used by:** `FundingStatusCard` for `none`/`rejected`, `DailyPayoutStoppedNotice`, and `FundingApplyScreen`.

## Function: DailyPayoutStoppedNotice

- **Purpose:** Non-dismissible info banner for signed-in members whose owner funding JSON has `dailyPayoutStoppedNotice === true`. The title is **Daily payout stopped**. While `grantApplicationsPaused` is true, the body is `FundingPausedCopy` and Apply is not offered, except usernames `joey-rosima`, `vincent`, and `jewel-bacolbas`, of any role, who still see the stopped-daily sentence and an Apply link to `/grants/apply`. That link is not the apply walk. When that switch is false, the body is the stopped-daily sentence and an Apply link to `/grants/apply`.
- **Inputs:** None. Reads the auth store and translations.
- **Returns / side effects:** A `role="region"` banner, or `null` when the flag is missing, false, or funding is null. No close control, no localStorage, no extra API call. Apply is offered when applications are not paused, or when the signed-in username is `joey-rosima`, `vincent`, or `jewel-bacolbas`.
- **Used by:** `AppShell`.

## Function: proxyMePasskeyRenewReportPost

- **Purpose:** Proxies POST `/me/passkey-renew/report`.
- **Inputs:** Incoming `Request` with Bearer.
- **Returns / side effects:** Upstream `Response`.
- **Used by:** Route POST `/me/passkey-renew/report`.

## Function: proxyMePasskeyRenewAckPost

- **Purpose:** Proxies POST `/me/passkey-renew/ack`.
- **Inputs:** Incoming `Request` with Bearer.
- **Returns / side effects:** Upstream `Response`.
- **Used by:** Route POST `/me/passkey-renew/ack`.

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
- **Used by:** `obtainPrfFirst`, `obtainPrfFirstFromGet`, `usePasskeyLogin` (register, and the login PRF salt check), `renewPasskey`.

## Function: readPrfFirst

- **Purpose:** Read `prf.results.first` from a credential.
- **Inputs:** `PublicKeyCredential`.
- **Returns / side effects:** Bytes or `undefined`.
- **Used by:** `obtainPrfFirst`, `obtainPrfFirstFromGet`, `usePasskeyLogin` (login, when the wallet is configured).

## Function: mnemonicFromPrfFirst

- **Purpose:** HKDF-SHA-256 then BIP-39 English 12 words.
- **Inputs:** PRF eval.first bytes.
- **Returns / side effects:** Space-separated mnemonic. Never sent to the api.
- **Used by:** `useWalletPhrase`, `rememberPhraseFromPrf`.

## Function: obtainPrfFirst

- **Purpose:** Prefer create() PRF; else get() with allowCredentials and eval.first salt.
- **Inputs:** The new `PublicKeyCredential`.
- **Returns / side effects:** Bytes or `null`.
- **Used by:** `usePasskeyLogin.register`, `renewPasskey`.

## Function: obtainPrfFirstFromGet

- **Purpose:** get() with PRF eval.first bound to this account's current credential (`allowCredentials`) to re-derive the phrase.
- **Inputs:** Current credential id bytes (WebAuthn `rawId`).
- **Returns / side effects:** Bytes or `null`. Does not contact the api. Does not pick a leftover credential after replace.
- **Used by:** `useWalletPhrase.showPhrase`, `unlockWalletPhrase`.

## Function: classifyWebAuthnError

- **Purpose:** Map WebAuthn failures to timeout / cancel / generic.
- **Inputs:** Unknown rejection.
- **Returns / side effects:** Discriminant string.
- **Used by:** `useWalletPhrase`, `renewPasskey`, `unlockWalletPhrase`.

## Function: rememberSessionPhrase

- **Purpose:** Store 12 words in tab RAM.
- **Inputs:** Mnemonic string.
- **Returns / side effects:** Module-level variable. Never localStorage. Dispatches `SESSION_PHRASE_EVENT`, which connects the wallet when a key is configured.
- **Used by:** `rememberPhraseFromPrf`, which is its only production caller; tests; re-exported from `useWalletPhrase`. Implemented in `tab-phrase`.

## Function: peekSessionPhrase

- **Purpose:** Read tab-RAM mnemonic.
- **Inputs:** None.
- **Returns / side effects:** String or `null`.
- **Used by:** `connectWallet`, `listenForWalletPhrase`, `useWallet.retry`, `unlockWalletPhrase`, `useWalletPhrase.showPhrase`; re-exported from `useWalletPhrase`. Implemented in `tab-phrase`.

## Function: clearSessionPhrase

- **Purpose:** Drop tab-RAM mnemonic.
- **Inputs:** None.
- **Returns / side effects:** Clears the module variable. Dispatches `SESSION_PHRASE_EVENT`, which disconnects the wallet.
- **Used by:** `clearAuth`, `login`, `authenticate`. Implemented in `tab-phrase`.

## Function: sessionPhraseGeneration

- **Purpose:** Counter that changes whenever the tab phrase is remembered or cleared. Lets an asynchronous derivation detect that it was overtaken.
- **Inputs:** None.
- **Returns / side effects:** A number.
- **Used by:** `rememberPhraseFromPrf`. Implemented in `tab-phrase`.

## Function: resetWalletCeremonyLock

- **Purpose:** Drop the tab-wide wallet WebAuthn lock so a later ceremony can start.
- **Inputs:** None.
- **Returns / side effects:** Sets the module lock to idle. Tests call this between cases; production uses `finally` on activate / showPhrase.
- **Used by:** `useWalletPhrase` tests.

## Function: useWalletPhrase

- **Purpose:** Add or show the recovery phrase. `/wallet` does not render the words. `/wallet/phrase` does. There is no confirm view, no auto-reveal, and no Continue on the words.
- **Inputs:** Auth store session and account.
- **Returns / side effects:** View `'activate' | 'reveal' | 'phrase'`, status, error, words, `activate`, `showPhrase`, `hidePhrase`, `retry`. `'activate'` only without a non-empty `passkeyCredentialId` (**Add recovery phrase**: `renewPasskey`, then `mnemonicFromPrfFirst` on the in-memory PRF bytes, store the account, 12 words only in component state). `'reveal'` when the id is set: `showPhrase` shows the phrase already in tab memory (the unlocked wallet's, also after waiting for a login derivation still running) without a passkey prompt; otherwise it runs `obtainPrfFirstFromGet` of that id, no create, no seed/begin, and passes the same PRF bytes to `rememberPhraseFromPrf`, so that one prompt also unlocks the wallet. `walletBackupSeenAt` is not read. The hook itself does not call `rememberSessionPhrase`; `activate` reaches it through `renewPasskey` when the wallet is configured. `hidePhrase` hides the words and keeps the tab phrase, so the wallet stays unlocked. No Confirm, no Continue. A passkey without PRF output sets error `prfUnsupported`, shown as `wallet.prfUnsupported` (**This phone or browser cannot hold a 21.gifts wallet. Please use an up-to-date phone or browser that supports passkeys.**). `?visual=phrase` (fixture words `WALLET_VISUAL_FIXTURE_MNEMONIC`), `?visual=error`, `?visual=timeout`, and `?visual=prf-unsupported` pin a screenshot state only in a Playwright build (`getE2eNow()` set); a production build ignores them and never shows the fixture words.
- **Used by:** `WalletScreen`, `WalletPhraseScreen`.

## Function: WalletScreenView

- **Purpose:** Wallet views, and the header Back. The visible Back is this `ProfileChromeLeft` via `AppShellTopLeft`, not the page `WalletChromeLeft`. `surface="entry"` is `/wallet` with its home, Send, and Receive views. `surface="phrase"` is `/wallet/phrase`.
- **Inputs:** `UseWalletPhraseResult` plus optional `surface` (`entry` default, or `phrase`), optional `wallet` prop for the balance block, and optional `send` prop for the send flow.
- **Returns / side effects:** On `entry`, one of three views; the heading **Wallet** is screen-reader only in each. **Home:** the balance block from `WalletBalance` large in the centre (when the wallet prop is present and not `disabled`), then the `WalletHistory` payments card while the wallet is `ready`, and `WalletFooterActions` (**Receive** on the left, always enabled, and **Send** on the right, enabled while the wallet is `ready` or `locked` and a send prop is present). Nothing sits under them: the recovery phrase is reached from `/settings`. **Receive** and **Send** are `WalletPanelView` (`WalletReceive`, or `WalletSend` with `walletReady` and the manual-entry sheet), driven by `useWalletPanel`, the same hook as `/welcome`. Send while `locked` runs `wallet.unlock` and opens the Send view once the wallet is `ready`. The Send view is kept regardless of the chosen view while a send is in flight, its Sent line shows, or an input alert is up. When the wallet stops being `ready` the chosen Send view falls back to home (and stays there when it is ready again); when the Sent line closes (**Done** or Back), the view returns home. No word grid and no recovery error. On `phrase`, only the ceremony: **Add recovery phrase**, **Show recovery phrase**, the 12-word grid and only-backup line (no Continue), or an error with **Try again**. No QR and no balance block. Header Back on `entry`: in the Send view it first closes the manual-entry sheet, then asks `send.cancel()` to close an open step; when nothing closed and nothing is being read or sent, it clears the field (`send.setText('')`, which also clears an input alert) and returns home. In the Receive view it returns home. On home it returns to the previous in-app view in this tab, or opens `/welcome` when this tab has none. On `phrase` it hides the words, then does the same. It does not leave the site, and it does not open `/wallet` as a parent.
- **Used by:** `WalletScreen`, `WalletPhraseScreen`.

## Function: WalletScreen

- **Purpose:** Signed-in `/wallet` body: the balance and, while the wallet is ready, the payments list (`WalletHistory`), with **Receive** and **Send** below. The recovery entry is on `/settings` (`SettingsScreen`).
- **Inputs:** None.
- **Returns / side effects:** Renders `WalletScreenView` with `useWalletPhrase()`, the `wallet` prop from `useWallet()`, and the `send` prop from `useWalletSend()`. Does not render the 12 words.
- **Used by:** `WalletPage`.

## Function: useWalletStore

- **Purpose:** Zustand store for the in-app wallet: `status` (`disabled`, `locked`, `connecting`, `ready`, `error`), `balanceSats`, `identityPubkey`, and `syncCount` (advanced by every `setReady`, that is after connect and after each SDK sync; the payment list reloads when it changes).
- **Inputs:** Hook. Actions `setConnecting`, `setReady`, `setError`, `reset`.
- **Returns / side effects:** Wallet state object. Resting status is `disabled` without a key, else `locked`.
- **Used by:** The wallet service, `useWallet`, `useWalletHistory`, `useWalletPay`, and `useWalletSend`.

## Function: loadWalletSdk

- **Purpose:** The only module that imports `@breeztech/breez-sdk-spark` (its `/ssr` entry, dynamic import, `init()` first). Returns the narrow `WalletSdk` (`connect` → `getInfo`, `addEventListener`, `registerAddress`, `listPayments`, `getPayment` (one payment by id through the SDK's `getPayment({ paymentId })`, mapped with `toWalletPayment`; a `token` payment, whose amount is not in satoshis, rejects like an unknown id, as the Bitcoin-only list leaves it out), `parse`, `prepare`, `disconnect`); `getInfo` can request a synchronized read with `ensureSynced`. `registerAddress` registers only the given username (no availability check is exposed); `listPayments` asks for one page of Bitcoin payments newest first (`assetFilter` bitcoin, so token payments whose amounts are not satoshis are left out) and maps each row with `toWalletPayment`. `parse` maps the SDK's `parse` result to a `WalletTarget`: a payment request or address it pays from text (BOLT11, Spark address, Spark invoice; a BIP21 URI uses its first payable method, and its amount when that method has none, marked `amountFromUri` so it is passed to `prepare`; its recipient is the shortened request or address, never the issuer's description), an LNURL-pay receiver or Lightning address with its sat bounds (at least 1 sat; bounds that leave no whole sat make it `unsupported`) and comment limit, `onchain` for a Bitcoin mainnet address on the base chain (its `address`, the shortened `recipient`, and `amountSats` from a BIP21 URI that offers only that address, otherwise `null`; a BIP21 URI with a Lightning or Spark method uses that method instead), or `unsupported` (token invoices, a BIP21 URI that names an asset, a BOLT11 request for less than one whole sat, an address of a test network, and everything else). `prepare` calls `prepareSendPayment({ paymentRequest: { type: 'input', input } })` (with `amount` when the text has none; a base-chain address always gets one) or `prepareLnurlPay`, reads amount and fee, refuses a prepared payment that would send a token rather than Bitcoin, and returns `send`, which calls `sendPayment` (a BOLT11 request with `preferSpark: false`, so the Lightning fee shown is the fee paid) or `lnurlPay` with that prepare response. For a base-chain address (`SendPaymentMethod` `bitcoinAddress`) it reads the `feeQuote` into `onchain`: the fee of each speed (`fast`, `medium`, `slow`) is `userFeeSat` plus `l1BroadcastFeeSat`, and `expiresAtMs` is the quote's `expiresAt` (epoch seconds) in ms; `feeSats` is the medium fee, and `send(speed)` calls `sendPayment` with `{ type: 'bitcoinAddress', confirmationSpeed: speed }` (default `medium`). A rejected or still pending initialisation is reported by `walletNeedsReload`.
- **Inputs:** None.
- **Returns / side effects:** A `WalletSdk`. Uses `defaultConfig('mainnet')` with the api key, `lnurlDomain` set to the host passed by the service (the app's own host), and a fixed storage name. The SDK keeps wallet state in IndexedDB; the phrase is passed in memory only.
- **Used by:** The wallet service as the default loader.

## Function: connectWallet

- **Purpose:** Connects from the tab phrase with the app's own host (`window.location.host`) as the address domain. Does nothing without a key or a phrase, so the SDK never receives a domain while the wallet is not configured. The first balance read after connect uses `ensureSynced`, so a cached balance is not shown as final and the store stays `connecting` until that read finishes. The whole connect attempt (loading the wallet code, connecting, and the first synchronized read) is limited to 30 seconds; if it does not finish in time while the wallet is still connecting, the wallet shows the `error` state with **Try again**. A wallet that a `synced` refresh already showed as ready is left as it is. Store otherwise goes to `ready` or `error`. Subscribes to SDK events and refreshes on `synced`. The latest call wins and a superseded connection is closed.
- **Inputs:** Optional `WalletSdkLoader` (defaults to `loadWalletSdk`).
- **Returns / side effects:** void. Updates `useWalletStore`.
- **Used by:** `listenForWalletPhrase`, `useWallet.retry`.

## Function: refreshWallet

- **Purpose:** Reads `getInfo` (with `ensureSynced` when asked, so a payment that arrived without a wallet event is counted) and stores balance and identity key. The balance is never derived from payment events. When reads overlap only the latest one counts (this one or the synced read inside `payFromWallet`, which shares the read counter): it alone writes the store, and only a failed refresh that is still the latest closes the connection and sets `error`. The failure of a stale read is ignored.
- **Inputs:** Optional `{ ensureSynced?: boolean; ignoreFailure?: boolean }`; without them, a plain read whose failure while current closes the connection and sets `error`. With `ignoreFailure`, a failed read changes nothing and the wallet stays as it is.
- **Returns / side effects:** void. Updates `useWalletStore`.
- **Used by:** The `synced` listener that `connectWallet` registers, the `send` that `payFromWallet` returns, and `useWalletPay` (synced reads every 4 s while `insufficient` shows).

## Function: disconnectWallet

- **Purpose:** Closes the connection and resets the store (`locked`, or `disabled` without a key). Runs when the tab phrase is cleared, which includes logout. Disconnecting leaves the SDK's wallet data, including balance and payment history, in this browser's IndexedDB. It is not encrypted at rest and is removed only with the site's browser data.
- **Inputs:** None.
- **Returns / side effects:** void. Updates `useWalletStore`.
- **Used by:** `listenForWalletPhrase` when the phrase is cleared.

## Function: walletNeedsReload

- **Purpose:** True after the SDK's initialisation rejected in this page, or while it is still pending, for example after the connect deadline expired during it. The SDK caches its initialisation promise, so only a reload recovers. A failed import alone does not set it.
- **Inputs:** None.
- **Returns / side effects:** boolean.
- **Used by:** `useWallet.retry`. Implemented in `wallet-sdk`.

## Function: listenForWalletPhrase

- **Purpose:** Subscribes to the tab-phrase event; phrase present → connect, cleared → disconnect. Returns the unsubscribe. No listener at all without a key.
- **Inputs:** Optional `WalletSdkLoader` (defaults to `loadWalletSdk`).
- **Returns / side effects:** Unsubscribe function.
- **Used by:** `WalletSync`.

## Function: rememberPhraseFromPrf

- **Purpose:** Derives the phrase from PRF bytes a passkey response already carried and keeps it in tab memory. Only when the key is configured, the bytes are present, the account is `walletRequired`, the response's credential is the account's `passkeyCredentialId`, and the session is still the one that started it. Never throws, never sends the bytes or the phrase and never stores them persistently (tab memory only). A derivation overtaken by a later remember or clear (`sessionPhraseGeneration`) remembers nothing. While a derivation runs, `settlePhraseDerivations` waits for it.
- **Inputs:** `PhraseSource` (`prfFirst`, `credentialId`, `account`, `sessionToken`).
- **Returns / side effects:** `true` when the phrase was remembered, else `false`.
- **Used by:** `usePasskeyLogin` (login and registration, started before the new session is stored so a reaction to the session finds it running), `renewPasskey`, `unlockWalletPhrase`, `runWalletSetup`, `useWalletPhrase.showPhrase`.

## Function: settlePhraseDerivations

- **Purpose:** Waits until every phrase derivation running in this tab (`rememberPhraseFromPrf`) has finished. The login derives the phrase from its passkey response without waiting for it, so a caller that needs the phrase right after login waits here instead of asking for the passkey a second time.
- **Inputs:** None.
- **Returns / side effects:** Resolves once no derivation is running. Never rejects.
- **Used by:** `runWalletSetup`, `unlockWalletPhrase`, `useWalletPhrase.showPhrase`.

## Function: unlockWalletPhrase

- **Purpose:** On-demand unlock: `obtainPrfFirstFromGet` of the account's `passkeyCredentialId`, then `rememberPhraseFromPrf`. No api call. One ceremony per tab: a call while one is in progress, also from a remounted screen, joins it and gets the same result. No prompt when the phrase is already in tab memory: it first waits for a derivation the login started from its own prompt (`settlePhraseDerivations`), and returns `'unlocked'` when the phrase is then there.
- **Inputs:** None (reads the auth store).
- **Returns / side effects:** `'unlocked'`, `'cancelled'`, `'noPrf'` (the passkey answered without PRF output, so this phone or browser cannot hold the wallet), or `'failed'`.
- **Used by:** `useWallet.unlock`, `useWalletPay.unlock`.

## Function: canUnlockWallet

- **Purpose:** True when the account has `walletRequired === true` and a non-empty `passkeyCredentialId`.
- **Inputs:** `account` or `null`.
- **Returns / side effects:** Type predicate `account is Account & { passkeyCredentialId: string }`.
- **Used by:** `useWallet`, `useWalletPay`, `useWalletSend`, `rememberPhraseFromPrf`, `unlockWalletPhrase`.

## Function: useWallet

- **Purpose:** State the `/wallet` balance block shows plus `unlock` and `retry`. `disabled` for an unconfigured wallet or an account that cannot produce a phrase. Shows `connecting` during the passkey prompt; a failed unlock shows `error`; an unlock whose passkey gives no PRF output shows `error` with `prfUnsupported` true; a dismissed prompt returns to `locked`. `?visual=balance-locked|balance-connecting|balance-ready|balance-error|balance-prf-unsupported` (ready fixture `₿21'000`) and `?visual=history-empty|history-rows|history-error` (pinned as `ready` for the payment-list shots) pin a fixture state for screenshots only in a Playwright build (`getE2eNow()` set); while pinned, unlock and retry are inert. `retry` unlocks again without a tab phrase, reloads the page when `walletNeedsReload()` is true, and otherwise reconnects. `?visual=send-alert-locked` pins `locked`; every other `?visual=send-…` pin is `ready`, so **Send** is enabled on the home view; only the pinned busy, Sent, and alert steps keep the Send view open without pressing **Send**.
- **Inputs:** None (reads the auth store and `useWalletStore`).
- **Returns / side effects:** `{ status, balanceSats, unlock, retry, prfUnsupported }`.
- **Used by:** `WalletScreen`.

## Function: putWallet

- **Purpose:** Claims the in-app wallet's identity public key for the signed-in account (`PUT /me/wallet`, body `{ sparkPubkey }`). The api overwrites an unverified claim and refuses once the wallet is verified.
- **Inputs:** Session token, identity public key (66 lower-case hex).
- **Returns / side effects:** The updated `Account`. Throws `wallet-verified` on 409, `wallet-unavailable` on 404 (feature off), and `wallet-request` on any other failure or an invalid body.
- **Used by:** `runWalletSetup`.

## Function: proxyMeWalletPut

- **Purpose:** Proxies PUT `/me/wallet` to the api.
- **Inputs:** Incoming `Request` with Bearer and JSON `{ sparkPubkey }`.
- **Returns / side effects:** Upstream `Response`.
- **Used by:** Route PUT `/me/wallet`.

## Function: proxyLnurlpayRegisterPost

- **Purpose:** Proxies the in-app wallet's address registration (POST `/lnurlpay/:pubkey`) to the api, which accepts it only for the account's own username and claimed key and then marks the wallet verified.
- **Inputs:** Incoming `Request` (signed JSON body; the `X-Breez-Signature` and `X-Breez-Timestamp` headers are forwarded), path `pubkey`.
- **Returns / side effects:** Upstream `Response`.
- **Used by:** Route POST `/lnurlpay/[pubkey]`.

## Function: proxyLnurlpayRecoverPost

- **Purpose:** Proxies the in-app wallet's address lookup (POST `/lnurlpay/:pubkey/recover`) to the api.
- **Inputs:** Incoming `Request` (signed JSON body), path `pubkey`.
- **Returns / side effects:** Upstream `Response`.
- **Used by:** Route POST `/lnurlpay/[pubkey]/recover`.

## Function: proxyLnurlpayMetadataGet

- **Purpose:** Proxies the in-app wallet's read of payer notes on received payments (GET `/lnurlpay/:pubkey/metadata`, query unchanged) to the api.
- **Inputs:** Incoming `Request`, path `pubkey`.
- **Returns / side effects:** Upstream `Response`.
- **Used by:** Route GET `/lnurlpay/[pubkey]/metadata`.

## Function: proxyLnurlpInvoiceGet

- **Purpose:** Proxies a payer's request for a payment request to a member's in-app wallet (GET `/lnurlp/:username/invoice`, query unchanged) to the api. The pay request for a verified wallet points its callback here.
- **Inputs:** Incoming `Request`, path `username`.
- **Returns / side effects:** Upstream status and body with `Access-Control-Allow-Origin: *`.
- **Used by:** Route GET `/lnurlp/[username]/invoice`.

## Function: proxyVerifyGet

- **Purpose:** Proxies a payer's check whether a payment to a member's in-app wallet settled (GET `/verify/:paymentHash`) to the api.
- **Inputs:** Incoming `Request`, path `paymentHash`.
- **Returns / side effects:** Upstream status and body with `Access-Control-Allow-Origin: *`.
- **Used by:** Route GET `/verify/[paymentHash]`.

## Function: toWalletPayment

- **Purpose:** Maps one SDK payment to the `WalletPayment` the `/wallet` payment list and the `/wallet/payment` screen read (the screen shows only part of `info`; the invoice's node key is kept but not shown): `received` or `sent`, whole sats and whole-sat fees (the SDK amounts are `bigint`), epoch ms (the SDK time is seconds), status, method (`lightning`, `spark`, `deposit`, `withdraw`; `token` and anything else is `other`), the payer's note from the received-payment metadata, and `info`: the Lightning or Spark invoice and its description (a Spark description comes from `invoiceDetails`), payment hash and preimage, the invoice's node, the paid Lightning address and the comment sent with it, a zap request (NIP-57 kind 9734 JSON: the zapper's public key, the trimmed message, and the `e` tag of the zapped note), and an on-chain transaction id and output. A blank note, description, or comment counts as none; a zap request that is not valid JSON, not an object, not kind 9734, or has no public key is left out; an unknown status counts as completed.
- **Inputs:** An SDK payment (`id`, `paymentType`, `status`, `amount`, `timestamp`, optional `fees`, `method`, and `details`).
- **Returns / side effects:** `WalletPayment`. Pure.
- **Used by:** `loadWalletSdk` (`listPayments`).

## Function: ensureWalletConnected

- **Purpose:** Makes sure the wallet is open from the tab phrase and returns its identity public key. Reuses a ready connection and waits for one in flight; otherwise calls `connectWallet`.
- **Inputs:** Optional `WalletSdkLoader`.
- **Returns / side effects:** The identity public key. Throws `wallet-connect` without a key or a tab phrase, or when the connection fails.
- **Used by:** `runWalletSetup`.

## Function: registerWalletAddress

- **Purpose:** Registers the account's username as the address of the connected wallet. Only the account's own username is sent; the app never asks whether a name is free.
- **Inputs:** Username.
- **Returns / side effects:** Resolves once the registration was accepted. Throws `wallet-connect` without a connection, otherwise the SDK's error.
- **Used by:** `runWalletSetup`.

## Function: listWalletPayments

- **Purpose:** Lists the connected wallet's Bitcoin payments, newest first, one page at a time.
- **Inputs:** `{ offset, limit }`.
- **Returns / side effects:** `WalletPayment[]`. Throws `wallet-connect` without a connection, otherwise the SDK's error.
- **Used by:** `useWalletHistory`.

## Function: getWalletPayment

- **Purpose:** Reads one payment of the connected wallet by its SDK id, for the `/wallet/payment` screen.
- **Inputs:** `id`.
- **Returns / side effects:** The mapped `WalletPayment`. Rejects with `wallet-connect` while no wallet is connected, and with the SDK's error for an id the wallet does not know. No other network call than the SDK's.
- **Used by:** `useWalletPayment`.

## Function: needsWalletSetup

- **Purpose:** Whether the signed-in member must go through the one-time wallet setup: the wallet is configured (`getBreezApiKey`), the account requires a wallet and has its seed passkey (`canUnlockWallet`), has a username, and `sparkWalletVerified` is strictly `false`. Older api bodies without the field never qualify.
- **Inputs:** `Account` or `null`.
- **Returns / side effects:** Boolean (type guard). Pure.
- **Used by:** `AppShell`, `runWalletSetup`, `useWalletPay`, `useWalletSend`.

## Function: runWalletSetup

- **Purpose:** Runs the one-time wallet setup in a fixed order: one passkey prompt (`obtainPrfFirstFromGet`) only when the phrase is not in tab memory after any derivation still running from the login has finished (`settlePhraseDerivations`), then connect (`ensureWalletConnected`), claim (`putWallet` with the lower-cased identity key; the returned account is stored), register (`registerWalletAddress` with the username of the account the claim returned, so a rename in another tab is picked up), and refresh (`fetchMe`, then `setAccount`). A 409 on the claim means the wallet is already verified and skips straight to the refresh. The phrase never leaves tab memory.
- **Inputs:** `onStep` callback (`passkey`, `connecting`, `claiming`, `registering`, `refreshing`), optional `WalletSdkLoader`.
- **Returns / side effects:** `done` when the refreshed account is verified; `noPrf` when the passkey returns no PRF output; `cancelled` when the prompt is dismissed; `superseded` when the session changed meanwhile; otherwise `failed`. Never rejects. A call while a run for the same session is in progress returns that run's promise (its `onStep` is not called), so a remounted dialog cannot start a second run; a run left over from an earlier session is not joined. A failure after the session changed counts as `superseded`.
- **Used by:** `useWalletSetup`.

## Function: walletSetupInFlight

- **Purpose:** Whether a setup run for the current session is in progress in this tab. `runWalletSetup` keeps one shared run per session; a second call for that session joins it. `AppShell` mounts again on every page, so a dialog that remounts during a run uses this to show progress and join the run instead of starting a second one.
- **Inputs:** None.
- **Returns / side effects:** Boolean. No side effects.
- **Used by:** `useWalletSetup`.

## Function: useWalletSetup

- **Purpose:** View state for the setup dialog: `intro`, `progress`, `error`, or `noPrf`. Starts by itself when the phrase is already in tab memory, and joins a run still in flight after a remount (`walletSetupInFlight`, taken during the first render); otherwise waits for **Set up wallet**, and starts by itself when the phrase reaches tab memory (`SESSION_PHRASE_EVENT`) while the intro is shown so the passkey prompt follows a tap. A cancelled prompt or a changed session returns to the intro. `retry` reloads the page when the wallet's initialisation failed (`walletNeedsReload`), otherwise runs the setup again.
- **Inputs:** None.
- **Returns / side effects:** `{ view, start, retry }`. A pinned view (`walletSetupPin`) leaves both actions inert.
- **Used by:** `WalletSetupNotice`.

## Function: walletSetupPin

- **Purpose:** Screenshot pin for the setup dialog: `?visual=setup-intro|setup-progress|setup-error|setup-no-prf`, honoured only in a Playwright build (`getE2eNow()` set).
- **Inputs:** None (reads `window.location.search`).
- **Returns / side effects:** The pinned view, or `null`.
- **Used by:** `AppShell`, `useWalletSetup`.

## Function: WalletSetupNotice

- **Purpose:** Blocking one-time wallet setup dialog in the style of `PasskeyRenewNotice`. Intro: **Set up your wallet**, one sentence, **Set up wallet**. Progress: **Setting up your wallet…** with a spinner. Error: one plain sentence and **Try again**. No PRF: **No wallet on this phone or browser** (`walletSetup.noPrfTitle`) and `wallet.prfUnsupported` (**This phone or browser cannot hold a 21.gifts wallet. Please use an up-to-date phone or browser that supports passkeys.**).
- **Inputs:** None (reads `useWalletSetup`).
- **Returns / side effects:** The dialog. No dismiss control; **Log out** (turn off push for at most five seconds, clear the session, open `/login`) is the only way around it. Pressing **Log out** does not change the dialog; a second press while leaving is ignored.
- **Used by:** `AppShell` while `needsWalletSetup` holds or a setup pin is set.

## Function: useWalletHistory

- **Purpose:** The `/wallet` payment list: loads `WALLET_HISTORY_PAGE_LIMIT` (20) payments newest first once the wallet is ready, appends the next page on `loadMore` (skipping ids it already has), and reloads every loaded page whenever `useWalletStore.syncCount` changes, which happens after connect and after each SDK `synced` event, so the list does not depend on payment events. Only the latest load writes state. A failed later page stops paging quietly. `?visual=history-empty|history-rows|history-error` pins a fixture list only in a Playwright build; `history-rows` is `WALLET_PAYMENT_FIXTURES` mapped with `toWalletPayment` (ten synthetic payments covering a zap, Spark sends and receives, a Lightning-address send with a fee, a received note, a pending and a failed send, an on-chain deposit and withdrawal, netting to the ₿21'000 visual balance).
- **Inputs:** None.
- **Returns / side effects:** `{ status, payments, hasMore, loadMore, retry }`.
- **Used by:** `WalletHistory`.

## Function: WalletHistory

- **Purpose:** Payments card on the `/wallet` home under the balance card while the wallet is ready. Each row is a `next/link` to its `/wallet/payment` screen (`paymentHref`) with a chevron on the right: the received or sent icon; the title (`paymentTitle`: **Gift on your post** for a zap, the paid Lightning address, the description, **On-chain deposit** / **On-chain withdrawal**, else **Received** / **Sent**), truncated; the amount signed `+` or `−` (a failed one struck through and muted); under it the date and time, then **Pending** or **Failed** (failed in the danger colour) when not settled, and the default fiat on the right; and a third line with the message (`paymentMessage`: payer note, zap message, or the comment sent to a Lightning address), truncated. Empty: **No payments yet.** Error: one sentence and **Try again**; the error stays shown until the reload's result arrives. Nothing renders during the first load.
- **Inputs:** None (reads `useWalletHistory`, the current spot rate from `useSpotRate`, fiat and number format).
- **Returns / side effects:** The card, or `null`. The next page loads when the end of the list is in view (`IntersectionObserver`), checked again after every completed load and after an error and retry.
- **Used by:** `WalletScreenView`.

## Function: WalletBalance

- **Purpose:** The balance block on the `/wallet` home (locked, connecting, ready, error). Renders nothing when disabled. Requests the spot rate only in `ready`. The ready balance is a large Bitcoin figure. When the default fiat has a usable rate, the block is a button with the fiat amount in small type under the large figure; each tap swaps which of the two is large. Without a usable rate it is only the large Bitcoin figure, and nothing can be tapped.
- **Inputs:** `status`, `balanceSats`, `onUnlock`, `onRetry`, optional `prfUnsupported` (default false).
- **Returns / side effects:** In `error`, the alert is `wallet.balanceError`, or `wallet.prfUnsupported` (**This phone or browser cannot hold a 21.gifts wallet. Please use an up-to-date phone or browser that supports passkeys.**) when `prfUnsupported` is true, then **Try again**. A region named **Balance**, or `null` when disabled. Keeps which figure is large in component state (Bitcoin first on every mount).
- **Used by:** `WalletScreenView`.

## Function: payFromWallet

- **Purpose:** The wallet pay primitive. Prepares a payment on the current connection and returns amount and fee for confirmation; the returned `send` pays it once, gives up waiting after 30 s, and refreshes the balance while its connection is still the current one (a replaced connection reads its own synchronized balance). Nothing is retried. A send after the wallet was disconnected or replaced, or a second call of `send`, reports `failed` without paying. For a base-chain address the result carries `onchain` (`fees` per speed and `spendableFeeSats`, the balance minus the amount) and `send` takes the chosen speed. It never sends without a fresh quote: a speed whose fee is above `spendableFeeSats` is `insufficient`, and a quote within `WALLET_QUOTE_MARGIN_MS` (15 s) of its expiry is `expired`, both without calling the SDK.
- **Inputs:** `WalletPayRequest`: `{ type: 'input', input, amountSats? }` or `{ type: 'lnurl', request, amountSats, comment? }`.
- **Returns / side effects:** `confirm` (`amountSats`, `feeSats`, optional `onchain`, `send`), `insufficient` (the balance read before confirmation does not cover amount plus fee, for a base-chain address amount plus the lowest fee, with that fee as `feeSats`, or the SDK says so, without a fee), `belowMinimum` with `minSats` (the SDK refused the amount as below the smallest it sends to this address, `… below the minimum of N sats …`), `failed` (prepare or the balance read failed, or the connection changed during prepare or that read), or `unlock` (no connection). The synced balance read also updates `useWalletStore` while it is the latest read of the current connection; when a newer read already wrote the store, the check uses that newer balance, so it matches the balance shown; while a newer read is still pending, it uses its own read. `send` resolves to `paid`, `insufficient`, `failed` (an error or the 30 s limit), or `expired` (a base-chain quote that ran out, before the SDK or as its answer; nothing was sent). Never rejects.
- **Used by:** `useWalletPay` (gift pay sheets), `useWalletSend` (`/wallet`).

## Function: parseWalletInput

- **Purpose:** Reads a pasted payment request or address with the SDK's `parse` on the current connection.
- **Inputs:** Text as pasted; it is trimmed.
- **Returns / side effects:** `target` with the `WalletTarget`, `invalid` for blank or unreadable text, `unreachable` when text that names a receiver by `name@domain` or LNURL cannot be read (the receiver's server did not answer this browser; there is no relay), or `unlock` without a connection or when the connection changed while the text was read. Never rejects.
- **Used by:** `useWalletSend`.

## Function: useWalletPay

- **Purpose:** Runs the in-app wallet payment of one invoice of a gift pay sheet. The in-app wallet is the only way to pay; there is no other wallet to hand the payment to. The wallet pays `sparkInvoice` when the api issued one, otherwise the payment request `pr`. The view is `unavailable` when the wallet is not configured (`disabled`), the account cannot unlock one (`canUnlockWallet` false), or the one-time wallet setup is still due (`needsWalletSetup`). A locked wallet shows `unlock`: `unlock` opens it with one passkey prompt and prepares, then pays at once when the prepared fee is ₿0 (the same send as `pay`), or stops at `confirm` when the fee is higher; a balance too low shows `insufficient`. That one tap pays at most once, and never after the slot closed, the request or the amount changed, the wallet failed to open or left `ready`, or the prompt was cancelled or failed; a cancelled prompt returns to `unlock`. A wallet that is already open is unchanged: it prepares at once so the fee is known before **Send**, also when the fee is ₿0. After a send the view stays `paying` while the sheet's own long-poll waits; it closes the sheet on confirmation. If the sheet is still open 60 s after the send (a send that failed or timed out, or a repayment, whose screen refreshes its ledger but does not close the sheet), it shows `unconfirmed`. A failed prepare or a failed unlock shows `failed`, as does a prepared amount that differs from `amountSats` and a wallet in `error`. `retry` starts over after `failed`: it drops the prepared payment and, when the wallet is in `error`, reloads the page if the wallet needs a reload or otherwise opens the wallet again. When the wallet leaves `ready` before the send or while `insufficient` shows (opening again, locked, or failed), or the account can no longer pay from it then, the phase restarts and late results are dropped. After `insufficient`, a balance above the one held when that prepare or send started, or the lowest one seen since (or a first known balance), prepares again only when it also covers the amount and the known fee (the fee of that prepare or send, `0` when the SDK gave none), and then ends at `confirm`; the member taps once to pay, and a send is never retried on its own. While `insufficient` shows and the wallet is `ready`, it reads the synced balance (`refreshWallet({ ensureSynced: true, ignoreFailure: true })`) every 4 s (`WALLET_PAY_BALANCE_POLL_MS`), one read at a time; a failed read leaves the wallet and the view as they are and the next one tries again, so Bitcoin that arrives without a wallet event still ends that view; the reads stop when the view changes, the slot closes, or the wallet leaves `ready`, and never run under a pin. `missingSats` is the amount plus the known fee minus the balance while `insufficient` shows, or `null` when the balance is unknown or already covers it. A new request (`sparkInvoice`, or `pr` without one) or a new sheet amount starts over, and a send prepared for an earlier request or amount is never shown or paid; late results of the old one are dropped.
- **Inputs:** `sparkInvoice` (`string`, `null`, or `undefined`), `pr` (the payment request of the same invoice, paid when there is no `sparkInvoice`), and `amountSats` (the whole sats the sheet shows). Reads `useWalletStore` and the auth store.
- **Returns / side effects:** `{ view, feeSats, missingSats, unlock, pay, retry }`. `view` is `unavailable`, `unlock`, `preparing`, `confirm`, `paying`, `insufficient`, `failed`, `prfUnsupported` (the unlock's passkey gave no PRF output), or `unconfirmed`. `?visual=wallet-pay-unavailable|wallet-pay-unlock|wallet-pay-preparing|wallet-pay-confirm|wallet-pay-paying|wallet-pay-insufficient|wallet-pay-failed|wallet-pay-prf-unsupported|wallet-pay-unconfirmed` pins a view with a zero fee and the whole amount missing for screenshots, only in a Playwright build; actions (including `retry`) are inert while pinned.
- **Used by:** `WalletPay`.

## Function: WalletPay

- **Purpose:** Pay slot of the forum pay sheet, the reaction pay page, and the inbox pay sheet. The member pays from the in-app wallet only; the slot never shows an invoice QR or hands the payment to another wallet. `unavailable`: a status line **Your 21.gifts wallet is not available here, so this cannot be paid.** `failed`: the alert **Your wallet could not prepare this payment. Please try again.** and a secondary **Try again** that calls `retry`. `prfUnsupported`: the alert **This phone or browser cannot hold a 21.gifts wallet. Please use an up-to-date phone or browser that supports passkeys.** and the same secondary **Try again**. `unlock`: one labeled button **Unlock and pay {amount}** with the default fiat (`wallet.payUnlockAndPay`), which calls `unlock`; it pays at once when the fee is ₿0 and otherwise shows `confirm`. `preparing` and `paying`: spinner and a status line. `confirm`: **Fee {amount}** (the prepared fee) with the default fiat, then labeled **Send**, or **Pay {amount} and post** with the default fiat when `postsOnPay` is set (the posting fee of a new post or reply). `insufficient`: an alert that the wallet lacks Bitcoin, then **Still missing: {amount}** with the default fiat (`missingSats`; absent while the balance is unknown), then the member's 21.gifts address and its Open CryptoPay QR (the same as `/wallet`, so it is shown on a smartphone too; it shrinks to fit a narrow card and never grows past its usual size) to add funds; when the member's username gives no address, only the address and QR are left out. Once the balance covers the payment, the hook prepares again, so the address and QR go and the fee and pay button show. `unconfirmed`: the neutral not-confirmed-yet sentence.
- **Inputs:** `sparkInvoice`, `pr` (the payment request of the same invoice; the wallet pays it when there is no `sparkInvoice`), `amountSats` (the whole sats the sheet shows; the wallet pays only this amount), `rateDay`, optional `postsOnPay` (default `false`). There is no fallback prop.
- **Returns / side effects:** The slot. Never mounts the invoice QR; the only QR it shows is the member's own address QR in `insufficient`.
- **Used by:** `ForumBoard` (pay sheet, composer pay slot, repayment), `ForumReplyPayPage`, `InboxScreen`.

## Function: useWalletSend

- **Purpose:** Drives the `/wallet` send flow. Paste, then `parseWalletInput`. A 21.gifts shop on this app's own host (`ownShop`: its address, LNURL, or `/pl/?lightning=` link) is asked first for an open charge (`fetchShopChargeInvoice`); with a Spark invoice, `payFromWallet` prepares that invoice and the confirm step shows `<name>@<host>`, the charge amount, and the wallet's fee for it (₿0). No charge, no Spark invoice, a failed prepare, or a prepared amount other than the charge falls back to `parseWalletInput` below; a balance too low for the charge shows the `insufficient` alert. When that own-host member has no open charge (`none`), the amount step that follows marks the receiver as that member and names it `<name>@<host>` as `ownShop` writes it: **Continue** first asks `fetchMemberSparkInvoice` for a Spark invoice of exactly the amount entered, with the message trimmed and cut to the receiver's limit, and `payFromWallet` prepares it, so the confirm step shows **To <name>@<host>**, the amount, and **Fee ₿0**. No Spark invoice, a failed prepare, or a prepared amount other than the one entered pays the member over Lightning as below (fee as the wallet quotes it); a balance too low for the Spark invoice shows the `insufficient` alert. An open charge without a Spark invoice (`fallback`) and a failed charge payment do not ask the member again. Other own-host LNURLs (not an address) and addresses on another host never ask for a Spark invoice. A request with an amount is prepared at once. A request or address without an amount asks for an amount (1 sat upward); a Lightning address or LNURL receiver asks for an amount within its bounds and, when it takes one, a comment cut to its limit. A Lightning address or LNURL receiver whose whole-sat bounds are one amount (min equals max, also after rounding millisats) skips the amount step: that amount goes the same way as **Continue** in the amount step (`payFromWallet`, or `postLnurlInvoice` then `payFromWallet` for another host), without a comment, and Cancel on its confirm step returns to the input; an api refusal of that amount (`Amount out of range`, `Comment too long`, or any other) returns to the input with its alert (`failed` for those two), never to an amount step. The recipient of an LNURL for `/.well-known/lnurlp/<name>` (bech32, `lightning:`, or an `https` `/pl/?lightning=` link) is `<name>@<host>` (`lnurlPayAddress`); another LNURL keeps its domain. Confirm shows amount, fee, and recipient; **Send** pays once. A base-chain Bitcoin address (or a `bitcoin:` URI that offers only one) asks for an amount (1 sat upward); a URI amount is prepared at once. When the SDK refuses the amount as below its minimum, the amount step opens again with the amount alert naming that minimum, and later amounts below it are refused without asking the SDK again. Its confirm step carries `onchain`: the fee of each speed, the largest fee the balance covers, and the chosen `speed` (medium, or slow when the balance does not cover medium); `setSpeed` chooses another covered speed and `feeSats` follows it. **Send** sends with that speed. When the quote expired (`expired`), nothing is sent: the same payment is prepared again and the confirm step returns with the new quote, the same speed when the balance still covers it, and `renewed`; when the wallet can no longer send by then, the flow returns to the input. Unreadable text, a recognised request this wallet cannot pay yet, an unreachable receiver, a failed prepare or send, and a low balance return to the input with an alert. A text that is submitted while the wallet is not ready shows the `notReady` alert instead of nothing, and a read whose handler throws unexpectedly ends with the `unreadable` alert (a prepare that throws, with `failed`), so a pasted, typed, or scanned text never leaves the input step silent. A Lightning address or LNURL on another host (`lnurlRelayTarget`) skips `parseWalletInput`: `postLnurlPayRequest` gives the bounds (whole sats, at least 1) and comment length, `postLnurlInvoice` returns the invoice for the amount in millisats, and `payFromWallet` prepares that invoice; a prepared amount other than the one entered fails. `Not a payable address`, `Address not found`, and `Address could not be reached` return to the input with the `notPayable`, `notFound`, and `relayUnreachable` alerts; `Amount out of range` and `Comment too long` keep the amount step with the amount or comment alert; anything else, or no session, is `failed`; an answer that arrives once the wallet can no longer send is dropped. No send is retried on its own; only an expired fee quote is prepared again, before anything is sent. Cancel and the header Back close the amount, confirm, or sent step; while a confirm send is in flight, both keep the confirm step (the header Back still closes it while an expired quote is renewed, dropping the renewal). The flow acts only for an account that is not in the one-time wallet setup (`needsWalletSetup`). When the wallet leaves `ready` or the account leaves wallet mode, an open amount or confirm step and any read or prepare in flight are dropped and the flow returns to the input, including a read or prepare that settles once the wallet is no longer ready; a text that was still being read gets the `notReady` alert; a send in flight is kept.
- **Inputs:** None.
- **Returns / side effects:** `{ state, busy, sending, text, setText, comment, setComment, submitInput, submitAmount, setSpeed, confirm, cancel, abandon }`; `sending` is true only while a confirmed payment is being sent, so `busy` without it on the confirm step is the renewal of an expired quote. `abandon` leaves the flow on an empty input step without an alert and drops a read, prepare, or quote renewal in flight (a late answer changes nothing); it does nothing while a confirmed send is in flight or under a pin. `state.step` is `input` (with `error`), `amount`, `confirm`, or `sent` (with the amount and the recipient of the confirmed payment). `?visual=send-input|send-amount|send-amount-error|send-amount-request|send-amount-no-comment|send-amount-min|send-confirm|send-confirm-sending|send-confirm-fixed|send-confirm-shop|send-confirm-member|send-input-busy|send-amount-busy|send-sent|send-amount-onchain|send-amount-onchain-min|send-confirm-onchain|send-confirm-onchain-fast|send-confirm-onchain-slow|send-confirm-onchain-low|send-confirm-onchain-renewed|send-confirm-onchain-renewing|send-confirm-onchain-sending|send-unsupported|send-invalid|send-failed|send-alert-locked|send-insufficient|send-error|send-not-payable|send-not-found|send-relay-unreachable|send-not-ready|send-unreadable|send-comment-long` pins a fixture step (recipient `bob@example.com`, `₿2'100`, fee `₿0`; the request target is `sp1qexample…a9f2`; `send-confirm-fixed` is the confirm step of the point-of-sale QR of `shop@21.gifts`, named through `lnurlPayAddress`, for `₿7'000` with the Lightning fee `₿3`, and `send-confirm-shop` the same step paid with the shop's Spark invoice, fee `₿0`; `send-confirm-member` is the confirm step of `₿2'100` to the member `alice@21.gifts` without an open charge, paid with that member's Spark invoice, fee `₿0`; the base-chain pins use `bc1qar0srr…wf5mdq`, `₿50'000`, and the fees fast `₿2'840`, medium `₿1'420`, slow `₿710`: `send-amount-onchain` its amount step, `send-amount-onchain-min` that step with the SDK minimum `₿294`, `send-confirm-onchain` its confirm step on medium, `send-confirm-onchain-fast` on fast, `send-confirm-onchain-slow` on slow, `send-confirm-onchain-low` with a balance that covers at most a `₿2'000` fee, so fast is disabled, and `send-confirm-onchain-renewed` after an expired quote) for screenshots, only in a Playwright build; `send-confirm-sending` and `send-confirm-onchain-sending` also report a send in flight (`busy` and `sending`); `send-confirm-onchain-renewing` reports a quote being renewed (`busy` without `sending`); actions are inert while pinned (and under any `?visual=balance-…`, `?visual=history-…`, or other `?visual=send-…` value in a Playwright build), except that under `send-input-busy` and `send-amount-busy` **Continue** marks that step busy, and under an idle base-chain confirm pin `setSpeed` chooses a covered speed.
- **Used by:** `WalletScreen`, `WelcomeScreen`.

## Function: walletSendBounds

- **Purpose:** Smallest and largest amount a send target takes.
- **Inputs:** A target that needs an amount.
- **Returns / side effects:** `{ min, max }`: the receiver's bounds for an LNURL or an outside address read through the api; for a base-chain address the SDK minimum once a prepare named it, otherwise 1 sat, upward; otherwise 1 sat upward.
- **Used by:** `useWalletSend`, `WalletSend`.

## Function: ownShop

- **Purpose:** Finds the 21.gifts shop on this app's own host that a pasted or scanned text pays, so the `/wallet` send flow can ask it for an open charge: a Lightning address `<name>@<host>` (an optional `lightning:` prefix is removed), or an LNURL of `https://<host>/.well-known/lnurlp/<name>` (bech32, `lightning:`, or in an `https` `/pl/?lightning=` link, read through `lnurlPayAddress`). The own host is the one `lnurlRelayTarget` uses (`giftsLightningAddress` of this page; case, `www.`, and a trailing dot are ignored; a local boot counts as `21.gifts`).
- **Inputs:** `text` as pasted or scanned, `hostname` (`window.location.hostname`).
- **Returns / side effects:** `{ name, address }` with the lower-case name and `<name>@<own host>`, or `null` for an address or LNURL on another host and any other text. Pure.
- **Used by:** `useWalletSend`.

## Function: fetchShopChargeInvoice

- **Purpose:** Spark invoice for the open charge of a 21.gifts shop, so the in-app wallet pays that charge without a fee. `GET /pay/:username`; when its `charge` is pending (or carries no status) and has not run out, `POST /pay/:username/invoice` with `{ amountSats }` of that charge, then `GET /pay/:username` again. Since the api also issues a Spark invoice to a member without a charge, the invoice counts only while the same charge (same `id`, amount, and end) is still open on that second read.
- **Inputs:** The shop's `username`.
- **Returns / side effects:** `{ kind: 'invoice', amountSats, sparkInvoice }`; `{ kind: 'none' }` when no charge is open, also when it closed before the second read; `{ kind: 'fallback' }` when a read fails or is not the expected JSON, the invoice answer has no `sparkInvoice` (or names another amount), or another charge is open on the second read. Never rejects. The invoice request is `fetchMemberSparkInvoice` without a message.
- **Used by:** `useWalletSend`.

## Function: fetchMemberSparkInvoice

- **Purpose:** Spark invoice for exactly the amount a member typed in the `/wallet` send flow, to a 21.gifts member on this app's own host without an open charge, so the in-app wallet pays that member without a fee. `POST /pay/:username/invoice` with `{ amountSats }`, plus `comment` when the message is not empty.
- **Inputs:** The member's `username`, `amountSats` (whole sats), and `comment` (already trimmed and cut to the receiver's limit, or `''` for none).
- **Returns / side effects:** The `sparkInvoice` string, or `null` when the answer has none (the api issues no Spark invoice for that member), names another amount, is not OK, is not the expected JSON, or the request fails. Never rejects; the caller then pays over Lightning.
- **Used by:** `useWalletSend`, `fetchShopChargeInvoice`.

## Function: lnurlRelayTarget

- **Purpose:** Routing decision of the `/wallet` send flow. A Lightning address (`user@domain`) or a bech32 LNURL whose host is not this app's own host is read through the api (`POST /lnurl/pay-request`, `POST /lnurl/invoice`). The own host is the domain `giftsLightningAddress` uses for this page (a local boot counts as `21.gifts`); the comparison drops `www.` on both sides and ignores case and a trailing dot. Own-host addresses, payment requests, Spark targets, `₿` DNS payment addresses, and anything else stay with the wallet's `parse`.
- **Inputs:** `text` as pasted (trimmed; an optional `lightning:` prefix is removed), `hostname` (`window.location.hostname`).
- **Returns / side effects:** The address or LNURL to send as `target`, or `null` when the wallet reads the text. Pure.
- **Used by:** `useWalletSend`.

## Function: postLnurlPayRequest

- **Purpose:** Reads the pay request of a Lightning address or LNURL on another host through the api, because many LNURL servers send no CORS headers. Same-origin `POST /lnurl/pay-request` with `{ target }` and the Bearer session.
- **Inputs:** `sessionToken`, `target` (`user@domain` or a bech32 LNURL).
- **Returns / side effects:** `{ target, minSendableMsat, maxSendableMsat, commentAllowed, description, domain }` (`lnurlPayRequestSchema`). Throws `LnurlRelayError`: 400 `Not a payable address` is `notPayable`, 404 `Address not found` is `notFound`, 502 `Address could not be reached` is `unreachable`; any other status or text, a network error, or a body that fails the schema is `failed`.
- **Used by:** `useWalletSend`.

## Function: postLnurlInvoice

- **Purpose:** Asks the receiver of a Lightning address or LNURL on another host for an invoice through the api. Same-origin `POST /lnurl/invoice` with `{ target, amountMsat, comment? }` and the Bearer session. The api resolves the target again, checks amount and comment against the pay request, and checks that the invoice amount and description hash match before it answers.
- **Inputs:** `sessionToken`, `target` (from `postLnurlPayRequest`), `amountMsat`, optional `comment` (omitted when empty).
- **Returns / side effects:** `{ pr }` (`lnurlInvoiceSchema`), the BOLT11 invoice the wallet pays. Throws `LnurlRelayError` with the reasons of `postLnurlPayRequest`, plus 400 `Amount out of range` as `amount` and 400 `Comment too long` as `comment`.
- **Used by:** `useWalletSend`.

## Function: LnurlRelayError

- **Purpose:** Typed rejection of `postLnurlPayRequest` and `postLnurlInvoice`, so the send flow can choose its alert without reading English api text.
- **Inputs:** `reason`: `notPayable`, `notFound`, `unreachable`, `amount`, `comment`, or `failed`.
- **Returns / side effects:** Error named `LnurlRelayError` with a readonly `reason`. The api error text is matched only together with its status; an unknown pair is `failed`.
- **Used by:** `postLnurlPayRequest`, `postLnurlInvoice`, `useWalletSend`.

## Function: WalletSend

- **Purpose:** The Send view on `/wallet` and over `/welcome`, opened with **Send** (and kept while a send is in flight, its Sent line shows, or a send alert is up). A region named **Send Bitcoin**. The input step is a full-size camera: a black layer marked `data-port-fill` fills the visible page port edge to edge (absolute to the AppShell scrollport, which `globals.css` makes its containing block only while such a layer is in the page; bottom corners follow the frame), with `QrScanner` inside and the hint over the top of the picture; the **Send Bitcoin** label is not shown then. Two floating `Button variant="overlay"` pills (at least 48px, wrapping onto two rows at 320px) sit over the lower part of the camera: **Paste** (`wallet.sendPaste`, lucide `ClipboardPaste`) reads the clipboard (`navigator.clipboard.readText`; iOS shows its own Paste bubble) and takes the text exactly like a scan; a refused clipboard shows **Pasting was not allowed. Use Enter manually instead.** and an empty one **The clipboard is empty.** as a small `role="alert"` pill over the camera for four seconds, while the camera keeps running. **Enter manually** (`wallet.sendEnterManually`, lucide `Keyboard`) opens a bottom sheet over the camera (`rounded-t-2xl bg-app-card`) with a Close (`X`, **Cancel**) top-left, the focused field **Payment request or address**, any alert under it, and **Continue**; Close or the header Back returns to the camera. The first text the camera reads, or the pasted text, goes into the field through `send.setText`, and once the field holds it `send.submitInput` runs once, as **Continue** would. While the text is read a white spinner sits in the middle of the camera area and both pills are disabled. An input alert shows in large white type a third of the way down with an overlay **Try again** (`login.retry`) that clears it (`send.setText('')`) and starts the camera again; with the sheet open the alert sits under the field instead. The camera is mounted only while the input step is idle, shows no alert, and the sheet is closed, so a refused code is not read again at once. After a scan or paste the camera stays off until the submit moves on (busy, another step, or an alert) or the text changes, so one code is submitted once. While the wallet is not ready, an input step kept for its alert shows only the label and the alert, without the camera. The amount step uses `AmountEntry`; for a Lightning address or LNURL receiver (read by the wallet or, on another host, through the api) it adds the receiver's bounds and, when the receiver takes one, an optional **Message (optional)** field; when the receiver refused the message as too long, an alert says so. An amount outside the bounds, or none, shows an alert with them; without receiver bounds the alert asks for at least ₿1 with the default fiat (for a base-chain address, at least the SDK minimum once the SDK named it). The confirm step has no box: the amount large in the centre (the size of the home balance) with the default fiat small under it when a rate is loaded, **To …** small and cut short, and **Fee ₿…** small, with the default fiat only when the fee is above ₿0; in the `AppShellFooter` a large full-width **Send** (spinner and disabled while sending) and a small **Cancel** text button (`wallet.sendCancel`). A payment to a base-chain address keeps that layout and adds, between **To …** and the footer: when the quote was renewed, the alert **The fee offer expired, so nothing was sent. Check the new fee and press Send again.**; then **Fee ₿…** and **Total ₿…** (amount plus fee) in `text-base` semibold, each with the default fiat; then the group **Speed** with one full-width row per speed (**Fast**, **Medium**, **Slow**), each with its fee in ₿ and the default fiat on one line, the chosen row pressed (`aria-pressed`, accent border); a row whose fee the balance does not cover is disabled and says **Balance too low**, and every row is disabled while sending; then the muted line that this network fee is much higher than the fee of other payments. After sending: a large check icon, **Sent ₿…** large with the default fiat small under it, **To …** with the recipient of the confirmed payment, and a large full-width **Done** in the footer. The amount step has a Close (`X`, **Cancel**) that stays on this view. **Cancel** on the confirm step stays on this view too; while a confirm send is in flight (`sending`) it is disabled and the confirm step stays, but while an expired quote is renewed it stays enabled and closes the step. The sent step closes with **Done**.
- **Inputs:** `send` (`UseWalletSendResult`), optional `walletReady` (default `true`), `manualEntry` (whether the sheet is open), and `onManualEntry` (opens or closes it). Reads the spot rate itself.
- **Returns / side effects:** The region. A scan or paste clears the amount draft before it submits. Reads the clipboard only when **Paste** is pressed.
- **Used by:** `WalletPanelView`.

## Function: WalletReceive

- **Purpose:** The wallet Receive view, on `/wallet` and over `/welcome`: the label **Receive**, the member's Open CryptoPay QR (`profile.giftsQr`, `profileQrLogo`; the profile QR, shown on every user agent), the `profile.giftsHeading` label, the 21.gifts address (`font-mono`, truncated), a labeled secondary **Copy** that writes the address to the clipboard and says **Copied** with a check mark for two seconds, counted again from each copy (a missing or refusing clipboard leaves **Copy**), and **Set an amount** (`ButtonLink` to `/pos`). Without a username, **Set a username first.** links to `/profile`; signed out, only **Set an amount**.
- **Inputs:** None. Reads `account` from `useAuthStore` and the page host.
- **Returns / side effects:** The receive block. Writes to the clipboard only on **Copy**. No network.
- **Used by:** `WalletPanelView`.

## Function: WalletPanelView

- **Purpose:** The open wallet view as the page body: `WalletReceive` or `WalletSend`, each in a `Card surface={false}` with an `sr-only` **h1** **Wallet** (`wallet.title`, `tabIndex={-1}`) that takes the focus when the view opens, because the button that opened it is gone. The Send input step's camera fills the page port itself.
- **Inputs:** `panel` (`receive` | `send`), `send` (`UseWalletSendResult` or `undefined`), `walletReady`, `manualEntry`, and `onManualEntry`.
- **Returns / side effects:** The view's column, or `null` for Send without a send flow. No network.
- **Used by:** `WalletScreenView`, `WelcomeScreen`.

## Function: WalletFooterActions

- **Purpose:** The wallet's two large labeled buttons in the shell footer (`AppShellFooter`, outside the scrollport, so they stay while the page scrolls): **Receive** on the left (`wallet.receive`, lucide `ArrowDownRight`, pointing in) and **Send** on the right (`wallet.sendButton`, lucide `ArrowUpRight`), equal `Button size="lg"` (`min-h-14 text-base`) in a `max-w-sm` two-column grid with `pt-2`. Above them an `aria-hidden`, `pointer-events-none` 18px fade with a light blur (`-inset-x-5 bottom-full h-[18px] bg-gradient-to-t from-app-card to-transparent backdrop-blur-[1.5px]`, masked to fade out) lets the page end softly. Below 360px the icons hide and the side padding is `px-2`, so long translations fit at 320px.
- **Inputs:** `onReceive`, `onSend`, `sendDisabled`, and optional `focus` (`receive` | `send` | `null`): when the buttons come back after a view closed, that button takes the focus, or **Receive** when **Send** is disabled by then (the wallet stopped being ready while Send was open).
- **Returns / side effects:** The footer registration. No network.
- **Used by:** `WalletScreenView`, `WelcomeScreen`.

## Function: useWalletPanel

- **Purpose:** Which wallet view (Receive or Send) shows over a page, shared by `/wallet` and `/welcome`, with its Back steps. Send opens only while the wallet is ready; pressed while it is locked, it runs `wallet.unlock` and opens Send once the wallet is ready (an unlock that fails, or a dismissed prompt that returns to locked, opens nothing). The Send view stays while a send is in flight, its Sent line shows, or an input alert is up; leaving the Sent line returns to the page, and a chosen Send view closes when the wallet stops being ready. The manual-entry sheet closes whenever the send step changes or a view opens or closes. Opening a view keeps the page's scroll position and shows the view from the top (the shell scroller); closing it restores that position.
- **Inputs:** `{ send, wallet, openPinnedSend? }`: the send flow (or `undefined`), the `useWallet` result (or `undefined`), and whether a `?visual=send-…` pin opens Send on mount (`/welcome` only; read through `visualPin`, so only in a Playwright build).
- **Returns / side effects:** `{ shown, returnFocus, openReceive, openSend, sendDisabled, manualEntry, setManualEntry, stepBack, close }`. `returnFocus` names the view that just closed (for `WalletFooterActions` `focus`), `null` while a view is open. `sendDisabled` is true without a send flow or while the wallet is neither ready nor locked. `stepBack` closes the sheet, then an open send step (held while a send is in flight), then clears the text and returns to the page; it returns `false` when no view is open. `close` (the wordmark and the Menu's Home) calls `send.abandon()`, which drops a read, prepare, or quote renewal in flight and empties the field, and returns to the page at its top; it does nothing while a confirmed send is in flight. No network.
- **Used by:** `WalletScreenView`, `WelcomeScreen`.

## Function: visualPin

- **Purpose:** The one reader of the `?visual=` screenshot pin. Honoured only in a Playwright build (`getE2eNow()` set); every deployed build gets `null`.
- **Inputs:** None. Reads `window.location.search`.
- **Returns / side effects:** The pin name, or `null` (also during server rendering). No network.
- **Used by:** `useWallet`, `useWalletSend`, `useWalletPanel`, `useWalletPayment`, `paymentHref`.

## Function: paymentTitle

- **Purpose:** What a payment is called in the list and on its screen: **Gift on your post** for a zap (no Nostr jargon on screen), else the paid Lightning address, else the invoice description, else **On-chain deposit** / **On-chain withdrawal**, else **Received** / **Sent**.
- **Inputs:** A `WalletPayment`.
- **Returns / side effects:** `{ text }` (literal) or `{ key }` (catalog key to translate). Pure.
- **Used by:** `WalletHistory`, `WalletPaymentDetails`.

## Function: paymentMessage

- **Purpose:** The message that came with a payment: the payer's note, else a non-empty zap message, else the comment sent to a Lightning address.
- **Inputs:** A `WalletPayment`.
- **Returns / side effects:** The message, or `null`. Pure.
- **Used by:** `WalletHistory`, `WalletPaymentDetails`.

## Function: paymentHref

- **Purpose:** The address of a payment's screen, `/wallet/payment?id=<encoded id>`. Under the `?visual=history-rows` pin (read through `visualPin`, so only in a Playwright build) it adds `&visual=history-rows`, so the screen shows the same fixture payment.
- **Inputs:** `id`.
- **Returns / side effects:** The path. Pure apart from reading the pin.
- **Used by:** `WalletHistory`.

## Function: useWalletPayment

- **Purpose:** Loads one payment for `/wallet/payment`: once the wallet is ready it calls `getWalletPayment(id)`, and again whenever `useWalletStore.syncCount` changes, so a pending payment turns completed or failed in place. A missing id, a payment the wallet does not know (the SDK's not-found answer), or a token payment is `missing`; any other failed read is `error` with a `retry` that shows `loading` and reads again; a later read that fails keeps a payment already shown, and a wallet that stops being ready drops it back to `loading`; an answer after unmount is dropped. Under the `?visual=history-rows` pin (Playwright builds only) it shows the `WALLET_PAYMENT_FIXTURES` payment with that id (or `missing`), under `?visual=history-error` a failed read (`error`, whose `retry` does nothing), and reads nothing.
- **Inputs:** `id` from the address, or `null`.
- **Returns / side effects:** `{ status: 'loading' }`, `{ status: 'ready', payment }`, `{ status: 'missing' }`, or `{ status: 'error', retry }`.
- **Used by:** `WalletPaymentDetails`.

## Function: WalletPaymentDetails

- **Purpose:** The `/wallet/payment?id=…` screen (`useSearchParams`, so the page wraps it in `Suspense`). `Card surface={false}` with an `sr-only` **h1** **Payment**. Ready: a centred head with the direction icon in a round `bg-app-card-muted` badge, the title (`paymentTitle`), the amount large (`text-3xl` semibold) signed `+` / `−` (failed: struck through and muted), the default fiat under it (absent only without a usable rate), a status pill (**Completed** success, **Pending** notice, **Failed** danger) and, for a pending send, **Still on its way. The amount stays reserved until it arrives or comes back.**, for a failed send **Nothing left your wallet.**; then the message block (`paymentMessage`) when there is one; then a bordered summary list: **Date** (long date and short time in the UI language), **Type** (Instant payment for Lightning, Wallet transfer for Spark, On-chain deposit, On-chain withdrawal, Payment), **To** (paid Lightning address), **Description** (only when the title is not already the description), **Amount**, **Fee** (**Free** at ₿0; hidden for a fee-less receive and for a failed payment), **Total** (sends with a fee), and **Arrived on-chain** (a deposit with a claim fee); every ₿ figure there carries the default fiat. Then a **Details** section (`h2`) with a bordered list of technical values, each shortened to its first 10 and last 6 characters with an icon-only Copy (`IconButton` ghost, accessible name **Copy {label}**, a check mark and a polite **Copied** for two seconds; a refused clipboard keeps the icon): **Transaction** and **Output**, **Payment request** (the invoice), **Payment hash**, **Proof of payment** (preimage), and **Payment ID**. The zapper's key and the zapped note are not shown (`docs/ui.md`: no keys, npub, or zap jargon on screen). An on-chain payment also has **View on mempool.space**, which opens `https://mempool.space/tx/<txid>` only after `ExternalLinkWarning` is confirmed (`openInSystemBrowser`). Missing: `role="alert"` **This payment could not be found.** A read that failed otherwise: `role="alert"` **This payment could not be loaded. Please try again.** (danger) and **Try again**, which reads it again. Nothing shows while the payment or the rate (`useSpotRateState`) is still loading; a finished read without a usable rate shows the ₿ amounts without a fiat line. Whenever the wallet is not open (opened directly, or the wallet locks or fails while the screen is up), it shows the reused `WalletBalance` state instead of the payment (locked with **Unlock wallet**, opening, error with **Try again**, or the no-PRF sentence) and loads the payment once the wallet is ready; with no wallet here (`useWallet` `disabled`) it says the payment could not be found.
- **Inputs:** None (the `id` query parameter, `useWalletPayment`, `useSpotRateState`, `useWallet`, fiat and number format, the UI language).
- **Returns / side effects:** The screen. Writes to the clipboard only on Copy; leaves the site only after the warning.
- **Used by:** `WalletPaymentPage`.

## Function: WalletPaymentPage

- **Purpose:** Next.js page for `/wallet/payment`.
- **Inputs:** None.
- **Returns / side effects:** Fill `AppShell` with `WalletChromeLeft` top-left (the one arrow: the previous in-app view, the list when opened from it, or `/welcome` when this tab has none), `SignedInChrome` top-right, and `OnboardingGate screen="wallet"` around `Suspense` and `WalletPaymentDetails`.
- **Used by:** Screen `/wallet/payment`.

## Function: WalletSync

- **Purpose:** Root-mounted effect that runs `listenForWalletPhrase`. Renders nothing.
- **Inputs:** None.
- **Returns / side effects:** `null`. Subscribes while mounted.
- **Used by:** `RootLayout`.

## Function: WalletPhraseScreen

- **Purpose:** `/wallet/phrase` body. Recovery phrase or recovery error, with no receive QR.
- **Inputs:** None.
- **Returns / side effects:** Renders `WalletScreenView` `surface="phrase"` with `useWalletPhrase()`.
- **Used by:** `WalletPhrasePage`.

## Function: WalletPhrasePage

- **Purpose:** Next.js page for `/wallet/phrase`.
- **Inputs:** None.
- **Returns / side effects:** AppShell + OnboardingGate + `WalletPhraseScreen`.
- **Used by:** Route `/wallet/phrase`.

## Function: WalletPage

- **Purpose:** Next.js page for `/wallet`.
- **Inputs:** None.
- **Returns / side effects:** AppShell + OnboardingGate + WalletScreen: the wallet home with **Receive** and **Send** (Receive on the left). Recovery-phrase access is on `/settings`.
- **Used by:** Route `/wallet`.

## Function: startPasskeyRegistration

- **Purpose:** POST `/auth/passkey/register/begin` and parse options.
- **Inputs:** Optional `viewKey` string and optional `name` string. A non-empty `viewKey` POSTs JSON `{ viewKey }` with `Content-Type: application/json` and ignores `name`. Otherwise a non-empty `name` POSTs JSON `{ name }` with `Content-Type: application/json`. Otherwise POSTs with no body and no Content-Type.
- **Returns / side effects:** `{ challengeId, options }`. On `!ok`, throws the api `{ error }` string when present, otherwise a status fallback.
- **Used by:** `usePasskeyLogin.submitName` for a new account, and `usePasskeyLogin.register` only with a view key.

## Function: usePasskeyLogin

- **Purpose:** Client hook for passkey login. The api's authentication options already carry `extensions.prf.eval.first`, so the login prompt can return PRF output; the hook adds nothing to the request. Login PRF output is used only when that request's `prf.eval.first` equals the app's own `prfEvalFirstSalt`; a missing, unreadable, or different salt counts as absent. `login` authenticates with an existing passkey. When authenticate returns `NotAllowedError` and `isInAppBrowser()` is false, status becomes `choice` and registration is not started. When authenticate returns `NotAllowedError` while `isInAppBrowser()` is true, status becomes `unsupported` and register is not started. From `choice`, `authenticate` never falls through to register; `register()` (no view key) sets status `name` and starts neither `startPasskeyRegistration` nor `credentials.create`. `submitName` normalizes and, when valid, calls `startPasskeyRegistration(undefined, normalized)` then the existing create ceremony. `register(viewKey)` starts the claim immediately and does not show `name`. User cancel (`NotAllowedError` or `AbortError`) after a named create returns to `name`, not `choice`. After a choice was offered, user cancel (`NotAllowedError` or `AbortError`) on those ceremonies returns to `choice`; direct `authenticate` / `register(viewKey)` from `ViewProfileClaim` never sets that flag, so cancel returns to `idle`. Status `unknown` is authenticate finish `Unknown credential`: the hook calls `signalUnknownCredential` best-effort with the ceremony `rpId` and `credential.id` before showing it, and a later user-cancel returns to `unknown` while that flag is set. On iOS/iPadOS WebKit (including iPadOS desktop-site: Macintosh UA, MacIntel, maxTouchPoints > 1), `credentials.get` / `credentials.create` omit AbortSignal. `cancel` aborts an in-flight WebAuthn prompt and clears the choice flag. `register(viewKey?)` forwards an optional view key for public profile claim; `retry` after `register(viewKey)` resends the same key. `login` never sends a view key. Finish `WrongAccountError` clears the session, sets `wrongAccount`, status `error` with that message, and does not fall through to discoverable registration. `register` requires WebAuthn PRF on create; missing PRF aborts with `wallet.prfUnsupported` and does not finish. Registration and login now hand the PRF output they already hold to `rememberPhraseFromPrf` just before the session is stored with `setAuth` (no extra prompt; what is sent to the api is unchanged); with the wallet configured, a login reports `client.passkey.login.prf` with `prfPresent` as a boolean only; without PRF output nothing happens. `login` / `authenticate` call `clearSessionPhrase`. On iPhone, iPad, or iPod below iOS 18, a named create still does not finish the account. `NotAllowedError` or `AbortError` from create or from the extra-key read reports `client.passkey.register.ceremony` with `name`, `prfPresent: false`, the begin `challengeId`, `accountId` when `user.id` decodes as a UUID, and message `iOS <installed> below 18 at create` or `at prf`, then the browser text when it fits the diagnostic allowlist. A missing extra key reports `client.passkey.register.prf` with `prfPresent: false`, those same ids, and message `iOS <installed> below 18 at prf.absent`. Both throw `login.iosVersion` instead of a silent cancel or `wallet.prfUnsupported`. On Android below 9, a named create does not finish the account. `NotAllowedError` or `AbortError` from create or from the extra-key read reports `client.passkey.register.ceremony` with `name`, `prfPresent: false`, the begin `challengeId`, `accountId` when `user.id` decodes as a UUID, and message `Android <installed> below 9 at create` or `at prf`, then the browser text when it fits the diagnostic allowlist. A missing extra key reports `client.passkey.register.prf` with `prfPresent: false`, those same ids, and message `Android <installed> below 9 at prf.absent`. Both throw `login.androidVersion` instead of a silent cancel or `wallet.prfUnsupported`. Every failed login posts `client.passkey.login.fail` before the card changes, even when no account id exists: the browser `name`, the allowlisted `message` when that text fits, and the begin `challengeId` when it is 64 hex. That row is written when `credentials.get` throws, when the assertion is missing, and when an in-app browser stops the ceremony first (stage `login` or `authenticate`, message `in-app browser`). A dismissed register that is not an old-iOS or old-Android stop posts `client.passkey.register.fail` with those fields, and `accountId` only when `user.id` decodes as a UUID. A failed login row and a dismissed register that is not an old-iOS or old-Android stop prefix the allowlisted message with `iOS <installed>` or `Android <installed>` when the user agent parses (iOS preferred), including versions new enough to pass the gate. Desktop and a user agent with no version token stay unprefixed. A cancelled named create stays on `name`; claim and paths before the name stay `choice`, `idle`, or `unsupported`. Begin and finish failures keep their own rows and do not need an account id.
- **Inputs:** None (reads `useAuthStore`; calls `isInAppBrowser` on authenticate `NotAllowedError`, `iosPasskeyBlock` and `androidPasskeyBlock` on register, and `iosInstalledVersion` and `androidInstalledVersion` when a failed attempt is reported).
- **Returns / side effects:** `{ status, login, register, submitName, authenticate, retry, cancel, error, nameError }` with `status` in `idle | starting | error | unsupported | choice | unknown | name`. `error` is the last `Error.message` when `status === 'error'`, else `null`. `nameError` is `invalid`, `taken`, or `null` while `status === 'name'`, else `null`. After a named create, `retry` returns to the name form and does not start create again. `retry` after `register(viewKey)` sends the same key again. `retry` after `authenticate` repeats authenticate. The single login button repeats login. Calls WebAuthn and the api. Unmount still aborts the controller and clears the choice flag. A successful login or registration starts `rememberPhraseFromPrf` before `setAuth`, so a wallet unlock or setup that reacts to the new session waits for that derivation instead of asking for the passkey again.
- **Used by:** `OnboardingGate`, `LoginCard`, `LogoutButton`, and `ViewProfileClaim`.

## Function: fetchComposeTarget

- **Purpose:** GET `/messages/compose-target` so a basis account can invoice 1 sat to 21.gifts (the platform profile note) before posting or replying, and learn whether its next top-level post is its free first post.
- **Inputs:** session token.
- **Returns / side effects:** `{ messageId, sats, firstPostFree }` of the payable platform profile note, or throws collapsed copy. `firstPostFree` is true only when the api sends `true`; a missing or non-boolean field is false, so the fee flow stays the default.
- **Used by:** `ForumLoader` (on mount for the first-post hint, and on every post below verified), `PublicMessageThread`, `MemberProfileScreen`.

The api sets `firstPostFree` while the member has no live or hidden top-level note of their own other than their About me note. Replies and conversation messages do not count, and it never comes back once a first post exists.

## Function: PostFeeRequiredError

- **Purpose:** Typed error for the api's HTTP 403 on `POST /forum/messages`: a member below verified sent a post or reply that needs a Bitcoin payment first, including a free first post the api no longer allows (for example when a second first post won the race).
- **Inputs:** `message` — the visitor copy (`postMessage`: the api error string, otherwise `A reply needs a Bitcoin payment`; `postMessageVideo`: `Could not post your message`).
- **Returns / side effects:** Error instance named `PostFeeRequiredError` with that message, so screens that show the message read the same as before.
- **Used by:** `postMessage`, `postMessageVideo`, `ForumLoader` (falls back from the free first post to the 1-sat posting fee).

The class exists so the composer can tell a refused free first post from any other failure. Every other error from a free create keeps its normal handling (requirements overlay, wallet step, rate limit, or the request error).

## Function: getRepayment

- **Purpose:** GET `/messages/:id/repayment` with no session. The public ledger of who gave what and each bitcoin repayment.
- **Inputs:** Credit note id.
- **Returns / side effects:** The ledger, or null when the response is not ok or the body does not match.
- **Used by:** `CreditLedger`.

## Function: CreditLedger

- **Purpose:** Show the givers and the repayment plan under a posted credit. Nothing renders until the ledger loads, and a failed read stays blank. `list="summary"` (default) shows givers, the explanation, the chart, and a **Repayment list** link to `/messages/<id>/repayment-list`. `list="page"` shows givers, the explanation, the chart, and the day-group rows, and omits that link.
- **Inputs:** Credit note id. Optional `list`: `'summary'` | `'page'` (default `'summary'`).
- **Returns / side effects:** The Given and Paid back lists, or null. Day-group rows (Tag 1, person, amount, Geplant/Fällig) render only when `list="page"`. The chart uses day numbers (`dayIndex + 1`) until `fundedAt` is set or a day has no `dueOn`; once the credit is fully given it uses the UTC dates. A fiat chart sums only amounts in the ask currency. Fetches when the id changes. Until that read finishes, a previous note's ledger is not shown. While any row is `due`, refreshes every 4 seconds. A failed or null refresh leaves the list for the same note. A response after an id change or unmount is ignored. Names stay on one line. On a narrow screen the status sits under the amount; on a wide screen it sits beside it. The list scrolls with the page. The summary link is shown once the ledger has loaded, even when there are no rows.
- **Used by:** `ForumGoalBar` (`list="summary"`). `RepaymentListPage` (`list="page"`).

## Function: RepaymentListPage

- **Purpose:** Next.js page for `/messages/[id]/repayment-list` — the repayment list for one credit note: who gave, the chart, and every day's shares. The day rows render only here. The note, the forum, and a profile show a **Repayment list** link instead of those rows. Chrome is `PublicMessageChrome`. No `OnboardingGate`. No second back control. The note id is not validated as a UUID here.
- **Inputs:** Dynamic route params (`id`). Loads `GET /messages/:id/repayment` through `getRepayment` (via `CreditLedger`). No session is required to view. Chrome follows the hydrated session.
- **Returns / side effects:** `CreditLedger` with `list="page"` inside `PublicMessageChrome`. No `generateMetadata`.
- **Used by:** Route `/messages/[id]/repayment-list`. The **Repayment list** link on a collapsed `ForumGoalBar` and on `CreditLedger` summary.

## Function: proxyMessagesRepaymentGet

- **Purpose:** Same-origin proxy for `GET /messages/:id/repayment`.
- **Inputs:** App Router `Request` and the message id.
- **Returns / side effects:** Forwards to the api. No session is required.
- **Used by:** `src/app/messages/[id]/repayment/route.ts`.

## Function: postRepaymentInvoice

- **Purpose:** POST `/messages/:id/repayment` with no body. The author receives a BOLT11 for the next giver share. Sends the device `Time-Zone` so a local Sunday is refused.
- **Inputs:** session token and the credit note id.
- **Returns / side effects:** `{ pr, amountSats, sparkInvoice? }` or throws collapsed copy. `sparkInvoice` is optional and may be `null`, as on `postMessageInvoice`. 409 `missing_requirements` throws `MissingRequirementsError`. A 400 with `code` `wallet_required` throws `WalletRequiredError` and one with `cannot_receive` throws `CannotReceiveError` (via `throwIfWalletAnswer`).
- **Used by:** `ForumLoader`.

## Function: proxyMessagesRepaymentPost

- **Purpose:** Same-origin proxy for `POST /messages/:id/repayment`.
- **Inputs:** App Router `Request` and the message id.
- **Returns / side effects:** Forwards to the api.
- **Used by:** `src/app/messages/[id]/repayment/route.ts`.

## Function: postMessageInvoice

- **Purpose:** POST `/messages/:id/invoice` with `{ sats }`, `{ sats, text }` when the visitor attached a reply comment, and `amountUsd`, `amountChf`, `amountEur`, `amountPhp` when a preview rate is on screen. Empty `text` is omitted. A missing preview omits those four fields.
- **Inputs:** session token, message id, sats, optional text, optional shown `amountUsd`, `amountChf`, `amountEur`, and `amountPhp` (each a two-decimal string or null). The amounts are read when the request is sent, not when an earlier requirements step started.
- **Returns / side effects:** `{ pr, amountSats, sparkInvoice? }` or throws collapsed copy. `sparkInvoice` is the request the member's in-app wallet pays (a string or `null`); a body without it still parses, so the app works against an api that does not send it. 409 `missing_requirements` throws `MissingRequirementsError`. 404 throws `NoteDeletedError` instead of the collapsed payment copy. A 400 with `code` `wallet_required` throws `WalletRequiredError` (the member's own wallet is not set up yet) and one with `cannot_receive` throws `CannotReceiveError` (the receiving wallet cannot take this payment) (via `throwIfWalletAnswer`), recognised by the body's `code` only.
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

- **Purpose:** Client loader for `/messages`. Session and account from `useAuthStore`; returns null without a session. Fetches the unpaged `GET /conversations` list, opens `?c=` via `onOpen` `router.push`, and posts replies. An open thread sets `showAttach` true: JPEG/PNG/WebP stills (cap 10) via `prepareForumPhoto`; photo-only send allowed. Send is disabled while `posting || preparing`. Thread stills load with `fetchConversationMessagePhoto`. Blob URLs are revoked on unmount, on thread switch, and on session loss; drafts and preparing drop on those same events (`pickGeneration`). The invoice path stays text/sats only and clears still drafts. The list has no attach. The first paint of an open thread calls `fetchConversation(session, openId)` without a cursor for the newest 20-message page. An `IntersectionObserver` on `InboxScreen`'s `nearStartRef` (the eighth grouped bubble from the start, or the first when fewer than eight render) attaches only after the thread end is in view or the thread fits, uses the active page scrollport as its root when one is mounted, then fetches a set `nextCursor` and prepends unique older messages. The first screen is the newest message. The cursor load does not blank the thread; while stuck to the bottom, InboxScreen keeps the newest in view. Returning to the list is the chrome link (no `onBack` handler). Moderators get `showFilter` true; members see the unfiltered inbound list. `?c=` opens only after the inbox list loaded. For a moderator an unlisted `?c=` first resolves `fetchModeratorGroup` once per id (neutral **Loading…**, not the list, while it runs); when that id matches, the thread never opens and `fetchConversation` is not called. A listed `moderator_group` row never opens either. Other roles, and a failed lookup, fall through to `fetchConversation`; the api rejects accounts that may not read the thread. Also calls `useSpotRate()` and passes `rateDay` to `InboxScreen`. While a private thread is open and the tab is visible, the newest page is fetched every 5 seconds and unseen messages are appended; a hidden tab does not poll, and a failed poll keeps the thread.
- **Inputs:** None (reads session and account from the auth store; `useSearchParams`).
- **Returns / side effects:** React element or `null` without a session. Calls `fetchConversations`, `fetchConversation`, `fetchModeratorGroup` (`roleAtLeast(role, 'moderator')`, unlisted `?c=` only), `prepareForumPhoto`, `fetchConversationMessagePhoto`, `postConversationMessage`, `postConversationInvoice`. After a successful thread fetch, local `unread: false` and `unreadMessageCount: 0`, then fire-and-forget `markConversationRead`, `bumpUnreadAppBadgeEpoch` and `refreshUnreadAppBadge` (remaining inbox from the local list; a thread only opens after the list loaded, so there is no second conversations fetch). After a successful paid-gift poll or `postConversationMessage`, the matching list row is also `unread: false` and `unreadMessageCount: 0` (including when the first thread fetch failed). When that poll fills a thread whose first `fetchConversation` failed (`messages === null`), it also clears `messagesError` and takes `nextCursor` from the poll page so older history can still prefetch. Must not fail the thread view. A `WalletRequiredError` (api `code` `wallet_required`) from `postConversationInvoice` sets the form error `walletRequired`.
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

- **Purpose:** Presentational inbox: incoming threads as a conversation list, or one open thread with a 8000-character `MentionTextarea` and sats amount field (`showAmount` false hides the field; the staff room has no gifts). Typing `@` lists people. Choosing one inserts `@username `. The moderator room uses this same composer. The message, attach, and send share one row; the amount is the next row (`AmountEntry` `layout="composer"`), indented to the message when attach is shown. An open invoice hides that amount row; the pay sheet states the amount once, as bitcoin plus the default fiat from the current spot rate. Without an amount the photo and send stay vertically centered on the message. `showAttach` (default false for callers that omit it) adds the ImagePlus control, still previews, and photo-only send; InboxLoader open threads and ModeratorGroupScreen pass true. Non-empty bodies go through `ForumQuotedBody` so a pasted `https://21.gifts/messages/<uuid>` unfurls as a nested quoted-note card, using the same `rateDay` (a stored string as-is; a null or missing stored field uses the spot rate; omitting `stored` uses the current spot rate). A stored `mentions` list turns `@username` into a profile button for `/members/<accountId>`. That mark does not notify the person. `photoUrls` (`${messageId}:${index}`) render attached stills. When `showFilter` is true (moderator), the list is filtered by the origin control (Direct / Contact / Damus; default Direct). Rows with `kind` `moderator_group` are never listed; the closed staff room lives on `/moderate/group`. Members (`showFilter` false) see inbound rows except `moderator_group` and no control. Each list row and the open-thread header show an origin label from `conversation.kind` (Contact / Direct / Damus / Moderators chat group). Unread inbound rows use `font-semibold` names, `text-app-fg` last text, a visible tabular-nums lining-nums unread-message count right of the name when the derived count is greater than zero (`row.unreadMessageCount`, or 1 when `unread` is true and the count is 0), and `aria-label` `inbox.threadUnread` with `{name}` and `{count}`. The word Unread is not visible text. Read inbound last text is a muted preview. When `lastFromMe` is true and `lastText` is non-empty, the list preview is `inbox.sentPreview` (`You: {text}`) in a filled chip; gift-only last messages (`lastSats > 0`, empty `lastText`) show the formatted amount . The list does not offer Translate. Thread remainders go through `ForumQuotedBody` with `conversationId` (`translateConversationMessage`); nested forum quotes stay on `translateNote`. Thread incoming messages are full-width muted note cards; `fromMe` messages render as filled `app-btn` bubbles on the right labelled `inbox.you`. Gift-only bubbles use `forum.giftReply`; text+sats shows the amount under the body. An open invoice shows the Lightning pay sheet. Close (`X`) dismisses that sheet and stays on the thread. It is not the top-left back arrow. Open-thread heading is counterpart name + origin caption (no `onBack`, no in-card back). Heading and incoming author names with `accountId` are `inbox.authorProfile` buttons to `/members/:id`; `fromMe` stays `inbox.you` text; Damus/missing id stays plain text. A staff viewer sees another staff reply as an incoming muted card with that person's `name` (profile link when `accountId` is set). `fromMe` / `inbox.you` only when this session is the actor. Settled thread sats amounts (gift-only bubble, text+sats line, and nested gift line) show a preferred-fiat suffix via `preferredFiatSuffix`: a stored string as-is, a null or missing field uses the spot rate, and bitcoin alone only when neither a stored string nor a usable rate exists. Unpaid invoice previews use optional `rateDay` (the current spot rate). A message whose `giftFor` points at another message renders via `groupThreadGifts` as a nested `role="note"` line inside the parent's `<li>` (name, ₿ amount, fiat suffix, time; not shown as its own top-level row) instead of a separate bubble. When supplied, `nearStartRef` attaches to the eighth grouped bubble from the start, or the first bubble when fewer than eight render, only after the thread end is in view or the thread fits. A scroll event attaches it only when the end is already in view. Being within 80px of the bottom sticks the view but does not by itself attach older history. Landing again on the last pin offset sticks when that offset is within 80px of the bottom. An open thread (`openId` set, messages loaded) scrolls the page scrollport to the bottom so the first screen is the newest message and the composer. While stuck to the bottom (within 80px), prepends and stills keep the newest in view; scrolling up unsticks and prepends compensate scrollTop. A newest-id change re-sticks. Inside AppShell the pin waits for that scroller and does not fall back to `window` while the node is missing (`window` only outside AppShell); the pin runs again when an invoice pay sheet opens; list view does not pin to the bottom; leaving a thread scrolls the list to the top once. The pay sheet's pay control is `WalletPay`, which pays from the member's in-app wallet (`sparkInvoice` when the api issued one, otherwise `pr`); the sheet shows no invoice QR on any device.
- **Inputs:** List/thread/composer state from `InboxLoader` or `ModeratorGroupScreen`.
- **Returns / side effects:** React element. InboxScreen itself does not fetch; `ForumQuotedBody` may call `fetchPublicMessage` for pasted `/messages/<uuid>` URLs. Form error `walletRequired` renders `role="alert"` with the link **Set up your wallet first.** (`inbox.errorWalletRequired`) to `/wallet`.
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
- **Returns / side effects:** `{ pr, amountSats, messageId, sparkInvoice? }`, or throws api/visitor copy. `sparkInvoice` is optional and may be `null`, as on `postMessageInvoice`. A 400 with `code` `wallet_required` throws `WalletRequiredError` and one with `cannot_receive` throws `CannotReceiveError` (via `throwIfWalletAnswer`); `InboxLoader` maps `CannotReceiveError` to `authorWallet`.
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

- **Purpose:** Client loader for `/notifications`. Fetches `GET /forum/notifications` (posts, replies, payments, moderator appointment, and moderator proposal). After a successful list fetch, `bumpUnreadAppBadgeEpoch` then set the badge to remaining inbox unread plus staff-room unread (`0` or `1`; notifications treated as 0; visiting `/notifications` does not force badge 0 when inbox or staff-room unread remains). Repeats after `markAllNotificationsRead` if the session is unchanged. Fetches conversations (`fetchConversations`) and, when `roleAtLeast(account?.role, 'moderator')`, the staff room (`fetchModeratorGroup`) for those counts; below moderator, remaining badge is inbox unread only (staff-room contributes 0, no request). A side that fails contributes 0. Opening a `moderator_proposal` row goes to `/moderate/proposals` without `markNotificationRead`. Opening a `moderator_appointed` row waits for `markNotificationRead` then goes to `/welcome` (still navigates if that POST fails; skips navigation if the session changed). A `forum_reply` or `forum_mention` goes to `/messages/{replyId}` without waiting. A `forum_post` or `zap` goes to `/messages/{parentId}` without waiting. Ids are URI-encoded.
- **Inputs:** None (session from the auth store).
- **Returns / side effects:** React element or `null` without a session. No composer. After a non-cancelled successful list fetch, marks all read fire-and-forget, then `bumpUnreadAppBadgeEpoch` and sets the home-screen badge to remaining inbox unread plus staff-room unread (`0` or `1`; notifications treated as 0). Repeats after `markAllNotificationsRead` if the session is unchanged. Fetches conversations (`fetchConversations`) and, when `roleAtLeast(account?.role, 'moderator')`, the staff room (`fetchModeratorGroup`) for those counts; below moderator, remaining badge is inbox unread only (staff-room contributes 0, no request). A side that fails contributes 0. Does not clear remaining inbox or staff-room unread on error, cancel, or missing session. Every fetched row is rendered, including those with `readAt` set, in API order; read rows are not discarded.
- **Used by:** `NotificationsPage`.

## Function: NotificationsScreen

- **Purpose:** Presentational notifications list of living-room posts, replies, payments, moderator appointment, and moderator proposal (actor `{name} posted` / `{name} replied` / `{name} sent bitcoin` / `{name} proposed a moderator`; `moderator_appointed` title uses `notifications.moderatorAppointed` with no `{name}` placeholder; post text or **Photo**, except a `forum_post` whose `text` equals `name` omits the body (profile-note leftover); reply text or **Photo reaction**, zap amount as stored, moderator appointment or proposal body only when `text` is non-empty — empty `text` omits the body line and does not use `notifications.photoPost` / `photoOnly`; time; unread semibold). `onOpen` receives the row object. No composer, no thread view, and no filter. Unread rows (`readAt === null`) are a section above rows that already have `readAt`, each section keeping API order; an empty section is omitted.
- **Inputs:** List state from `NotificationsLoader` (`notifications`, `error`, `loading`, `onRetry`, `onOpen`).
- **Returns / side effects:** React element. No network.
- **Used by:** `NotificationsLoader`.

## Function: fetchNotifications

- **Purpose:** GET `/forum/notifications` with Bearer and parse `{ notifications, unreadCount }`.
- **Inputs:** Session token.
- **Returns / side effects:** `{ notifications, unreadCount }`, or throws visitor copy `Could not load notifications. Please try again.`
- **Used by:** `NotificationsLoader`, `useUnreadCount`, `refreshUnreadAppBadge`, `ForumLoader` (welcome appointment banner).

## Function: markNotificationRead

- **Purpose:** POST `/forum/notifications/:id/read` with Bearer and optional JSON `{ endpoint }` when this browser has a push subscription. `currentPushEndpoint()` is sent only when it is a non-empty string. Parses one notification.
- **Inputs:** Session token and notification id (encoded in the path).
- **Returns / side effects:** Updated notification, or throws visitor copy.
- **Used by:** `NotificationsLoader` on row click; `ForumLoader` when the welcome appointment pill is clicked.

## Function: markAllNotificationsRead

- **Purpose:** POST `/forum/notifications/read-all` with Bearer and optional JSON `{ endpoint }` when this browser has a push subscription. Non-ok throws. When the body has a `tags` array, those local notifications are closed. A body without `tags` closes nothing.
- **Inputs:** Session token.
- **Returns / side effects:** void.
- **Used by:** `NotificationsLoader` fire-and-forget after a successful list fetch.

## Function: markNotificationsReadForMessage

- **Purpose:** POST `/forum/notifications/read-by-message` with Bearer and JSON `{ messageId, endpoint? }`. `endpoint` is sent only when the current push endpoint is a non-empty string. Non-ok throws visitor copy `Could not mark notification as read`. On success, closes local notifications for string `tags`; a missing `tags` field is `[]`.
- **Inputs:** Session token and forum message id.
- **Returns / side effects:** `{ ok: true, tags: string[] }`.
- **Used by:** `ForumLoader` when a note becomes expanded, `NoteTranslate` when Translate is requested for a forum note while a session is present (not for a conversation message), `PublicMessageLoader` when a signed-in message page is ready, `MemberProfileScreen` when a profile note becomes expanded, and `PublicMessageThread` when a thread note becomes expanded.

## Function: markVisibleForumNoteRead

- **Purpose:** POST `/forum/notifications/read-visible` with Bearer and JSON `{ messageId, endpoint? }`. `endpoint` is sent only when the current push endpoint is a non-empty string. Non-ok throws visitor copy `Could not mark notification as read`. On success, closes local notifications for string `tags`; a missing `tags` field is `[]`.
- **Inputs:** Session token and forum message id.
- **Returns / side effects:** `{ ok: true, tags: string[] }`.
- **Used by:** `ForumLoader` when a signed-in note card is fully inside the AppShell scrollport.

## Function: isForumCardFullyVisible

- **Purpose:** True only when a forum note card sits fully inside the AppShell scrollport within `epsilonPx` (default 1). A zero-size card is false. A card taller than the root by more than `epsilonPx` is false. A card 2px past the root is false. A card exactly 1px past is true.
- **Inputs:** Card and root `DOMRectReadOnly` picks (`top`, `bottom`, `left`, `right`, `width`, `height`), and optional `epsilonPx` (default 1).
- **Returns / side effects:** Boolean. No side effects.
- **Used by:** `ForumLoader` when measuring `li[data-message-id]` inside the shell scroller.

## Function: activeMention

- **Purpose:** Find the `@username` token under a collapsed caret in a forum composer. A mark starts at `@` only when the previous character is not a username character, so an email address is not a mark. The query is the lowercase text between `@` and the caret. A bare `@` is a mark with an empty query.
- **Inputs:** Composer text and a caret index.
- **Returns / side effects:** `{ start, end, query }`, or `null` when the caret is outside a mark, the query is longer than 32 characters, or the query is not a username prefix.
- **Used by:** `MentionTextarea`.

## Function: remapClosedMentionStarts

- **Purpose:** Keep a dismissed `@` attached to that character across one edit. Indexes after the edit shift with the text. An `@` inside the replaced span is forgotten, so a different `@` that lands on the old index opens.
- **Inputs:** The previous composer value, the next value, the dismissed `@` indexes, and the caret in the next value, or nothing when the caret is unknown.
- **Returns / side effects:** The same set when no dismissed `@` moved, otherwise the shifted indexes.
- **Used by:** `MentionTextarea`.

## Function: MentionTextarea

- **Purpose:** Forum text field that lists people as soon as `@` is typed. The field stays mounted when the list opens. The first page is prefetched for the signed-in session. More letters narrow the list to usernames that start that way in the same update, even when a previous server page is still stored. Choosing a row inserts `@username ` and closes the list. A space already after the token stays a single space. A choice that would pass the length limit is not inserted. Keys during text composition stay with the input method. The caret sits after that space even when the text was already that handle. Escape or Tab, even while the first page is still loading, or a click outside the open list, keeps each such `@` closed until that character is gone, and a different `@` does not inherit the closure when text shifts. Choosing does not remember that `@` as closed. The list sits under the field, and above it only when this list would not fit underneath and there is more room above. No session, or a disabled field, is a plain textarea.
- **Inputs:** Controlled value, `onChange`, disabled, wrapper and textarea classes, accessible name, and optional placeholder, max length, rows, and textarea ref.
- **Returns / side effects:** The textarea. When a token is active and at least one person matches, a `People` listbox. Inserts the chosen handle through `onChange`.
- **Used by:** The post composer and reply composer in `ForumBoard`, the ask-for-money text step in `ForumAskWizard`, the shop text step in `ShopAddWizard`, and `InboxScreen` (inbox and the moderator room).

## Function: searchMentionAccounts

- **Purpose:** Load username suggestions for an `@` token. Calls same-origin GET `/forum/mentions`, adding `q` only when the prefix is non-empty.
- **Inputs:** Bearer session and a lowercase prefix (`""` for the first page).
- **Returns / side effects:** `{ id, username, name }[]`. Throws when the response is not 200 or the body is not that list.
- **Used by:** `MentionTextarea`, `ShopAccountControl`, and `DailyPaymentAmountsScreen`.

## Function: proxyForumMentionsGet

- **Purpose:** Same-origin proxy for api GET `/mentions`. App route is GET `/forum/mentions`. Forwards the query string.
- **Inputs:** App Router `Request`.
- **Returns / side effects:** Forwards to the api.
- **Used by:** `src/app/forum/mentions/route.ts`.

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

## Function: proxyNotificationsReadByMessagePost

- **Purpose:** Same-origin proxy for api POST `/notifications/read-by-message`. App route is POST `/forum/notifications/read-by-message`.
- **Inputs:** App Router `Request`.
- **Returns / side effects:** Forwards to the api.
- **Used by:** `src/app/forum/notifications/read-by-message/route.ts`.

## Function: proxyNotificationsReadVisiblePost

- **Purpose:** Same-origin proxy for api POST `/notifications/read-visible`. App route is POST `/forum/notifications/read-visible`.
- **Inputs:** App Router `Request`.
- **Returns / side effects:** Forwards to the api.
- **Used by:** `src/app/forum/notifications/read-visible/route.ts`.

## Function: proxyNotificationReadPost

- **Purpose:** Same-origin proxy for api POST `/notifications/:id/read`. App route is POST `/forum/notifications/[id]/read`.
- **Inputs:** App Router `Request` and notification id.
- **Returns / side effects:** Forwards to the api (id encoded).
- **Used by:** `src/app/forum/notifications/[id]/read/route.ts`.

## Function: StatisticsPage

- **Purpose:** Next.js page for `/statistics` (public measured people and shop charts, not a funding goal). Top-right is **Log in** without a session and `SignedInChrome` with one. `OnboardingGate screen="welcome"` `allowGuest`. HTML `/statistics` is the page, not a GET proxy. Fill `AppShell` (`align="center"`) with `ProfileChromeLeft` top-left and `OnboardingGate screen="welcome"` `allowGuest` around `StatisticsScreen`. No `route.ts` beside this page. Gift totals stay on public `/stats`.
- **Inputs:** None.
- **Returns / side effects:** The statistics screen inside fill AppShell.
- **Used by:** Route `/statistics`.

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

## Function: canEditDailyPayoutRoster

- **Purpose:** True only for `initiator` and `founder`. This is not `roleAtLeast`: initiator and moderator share rank 2, and the daily payout roster stays closed to moderators. `null` and `undefined` are false.
- **Inputs:** `role` — live account role, or `null`/`undefined` when the account snapshot is absent.
- **Returns / side effects:** Boolean. Pure, no side effects.
- **Used by:** `GrantsScreen`, `DailyPaymentCommentScreen`, `DailyPaymentAmountsScreen`.

## Function: isReplyPaymentExempt

- **Purpose:** True when the signed-in account may reply without paying: anyone at least verified is exempt. Basis, including the parent note's author, is not exempt.
- **Inputs:** `account` — `{ id, role }` or `null` when the account snapshot is missing; `parentAccountId` — the parent note's `accountId` if the api sent one (a missing id is not treated as exempt).
- **Returns / side effects:** Boolean. Pure, no side effects; delegates to `roleAtLeast`.
- **Used by:** `ForumLoader`, `MemberProfileScreen`, `PublicMessageThread`.

## Function: utcDayFromMs

- **Purpose:** UTC calendar day `YYYY-MM-DD` of an instant, taken from `toISOString` (the first ten characters of the ISO timestamp).
- **Inputs:** `ms` — epoch milliseconds of that instant.
- **Returns / side effects:** UTC day string. Pure; no I/O.
- **Used by:** `previousUtcDay`, `chartRows`, `StatisticsScreen`, `ModerateScreen`.

## Function: previousUtcDay

- **Purpose:** UTC calendar day immediately before `day`, so staff screens can name yesterday against the clock.
- **Inputs:** `day` — UTC `YYYY-MM-DD`.
- **Returns / side effects:** Previous UTC day string. Pure; no I/O. Delegates to `utcDayFromMs`.
- **Used by:** `StatisticsScreen` and `ModerateScreen` to pick yesterday.

## Function: countOnDay

- **Purpose:** Person count on `yesterday` from `officialCount`. First matching day wins.
- **Inputs:** `series` — `spendOverTime` oldest-first; `yesterday` — UTC day to look up.
- **Returns / side effects:** That day's `officialCount`, `0` when the day is missing, or `null` when any point omits `officialCount`. Pure; no I/O.
- **Used by:** `StatisticsScreen`.

## Function: chartRows

- **Purpose:** Last 30 UTC days ending on `today`, oldest first, with person counts from `officialCount`.
- **Inputs:** `series` — `spendOverTime` oldest-first; `today` — UTC day of the clock.
- **Returns / side effects:** Oldest-first `{ day, count }` rows. Last write wins when a day appears twice; a missing day is 0. Pure; no I/O.
- **Used by:** `StatisticsScreen`.

## Function: formatUtcDate

- **Purpose:** Formats a UTC calendar day as numeric day plus long month in `locale` for the yesterday sentence.
- **Inputs:** `day` — UTC `YYYY-MM-DD`; `locale` — active UI locale.
- **Returns / side effects:** Locale date string in the UTC zone. Pure; no I/O.
- **Used by:** `StatisticsScreen` in the yesterday sentence.

## Function: chartDayLabel

- **Purpose:** Axis tick label for a UTC day as numeric day and month in `locale`.
- **Inputs:** `day` — UTC `YYYY-MM-DD`; `locale` — active UI locale.
- **Returns / side effects:** Short numeric day-month label in the UTC zone. Pure; no I/O.
- **Used by:** `ShopActivityChart` and `PeopleCountChart` for the first, middle, and last axis labels.

## Function: fetchFxSpot

- **Purpose:** Loads the current price of 1 BTC in USD, CHF, EUR, and PHP from same-origin `GET /fx/spot` with no Authorization. The body is `{ asOf, source, rates }`; `rates` leaves out a code the api could not price. Without any quote the api answers `asOf` and `source` `null` and `rates` `{}`, which is "no rate".
- **Inputs:** None. `fetch('/fx/spot')` with no Authorization.
- **Returns / side effects:** `FxSpot` parsed by `fxSpotSchema` (each price a decimal string such as `"62345.12"`). Throws **Could not load the exchange rate. Please try again.** on a non-OK response, a network failure, or a body that fails the schema.
- **Used by:** `useSpotRate`.

## Function: proxyFxSpotGet

- **Purpose:** Same-origin proxy for api `GET /fx/spot`. App route is `export const GET = proxyFxSpotGet` on `/fx/spot`. No bearer is required. Forwards the incoming request unchanged.
- **Inputs:** App Router `Request`.
- **Returns / side effects:** Upstream response from `proxyApiRequest(request, '/fx/spot')`.
- **Used by:** `src/app/fx/spot/route.ts`.

## Function: fetchShopActivity

- **Purpose:** Loads public shop-use counts from same-origin `GET /shops/activity` with no Authorization. StatisticsScreen calls it with or without a session. The body must be 30 unique contiguous UTC days, oldest first; otherwise this throws and the shop panel shows its error state.
- **Inputs:** None. `fetch('/shops/activity')` with no Authorization.
- **Returns / side effects:** `ShopActivityDay[]` (`day`, `shopCount`). Network via `fetch`. Does not require the last day to be the browser's today.
- **Used by:** `StatisticsScreen` shop panel.

## Function: proxyShopActivityGet

- **Purpose:** Same-origin proxy for api `GET /shops/activity`. App route is `export const GET = proxyShopActivityGet` on `/shops/activity`. No bearer is required. Forwards the incoming request unchanged.
- **Inputs:** App Router `Request`.
- **Returns / side effects:** Upstream response from `proxyApiRequest(request, '/shops/activity')`.
- **Used by:** `src/app/shops/activity/route.ts`.

## Function: fetchGrantContinuation

- **Purpose:** Loads the signed-in grant goal from same-origin `GET /funding/goal` with `Authorization: Bearer`. GrantGoalsScreen calls it only when a session exists. The body must be 7 unique contiguous UTC days, oldest first, plus a nonnegative `qualifyingShops`; otherwise this throws and the goals page shows its error state. Does not call `fetchShopActivity`.
- **Inputs:** `sessionToken` — bearer session. `fetch('/funding/goal')` sends that token and does not invent one.
- **Returns / side effects:** `GrantContinuation` (`days`, `qualifyingShops`). Network via `fetch`. Does not require the last day to be the browser's today.
- **Used by:** `GrantGoalsScreen`.

## Function: proxyFundingGoalGet

- **Purpose:** Same-origin proxy for api `GET /funding/goal`. App route is `export const GET = proxyFundingGoalGet` on `/funding/goal`. Forwards the incoming Authorization header and does not add one. This is not the public shop-activity proxy.
- **Inputs:** App Router `Request`.
- **Returns / side effects:** Upstream response from `proxyApiRequest(request, '/funding/goal')`.
- **Used by:** `src/app/funding/goal/route.ts`.

## Function: ShopActivityChart

- **Purpose:** Draws the shop-count SVG (`role="img"`) for the UTC days it is given. Scale is the max count (at least 1). Ticks are 0, that scale, and the rounded midpoint when it differs. Today's bar is `fill-app-subtle`; other bars are `fill-app-accent`. Bars only when count > 0. `data-testid="shop-activity-chart-bar"`. No goal line.
- **Inputs:** `rows` (`{ day, count }[]`), `today` (UTC day drawn lighter), `locale`, and `ariaLabel`.
- **Returns / side effects:** SVG figure. No network.
- **Used by:** `StatisticsScreen` (30 days) and `GrantGoalsScreen` (the last 7 days).

## Function: PeopleCountChart

- **Purpose:** Draws the people-count SVG (`role="img"`) for 30 UTC days. Scale is the max count (at least 1). Ticks are 0, that scale, and the rounded midpoint when it differs. Today's bar is `fill-app-subtle`; other bars are `fill-app-accent`. Bars only when count > 0. `data-testid="people-count-chart-bar"`. No goal line.
- **Inputs:** `rows` (`{ day, count }[]`), `today` (UTC day drawn lighter), `locale`, and `ariaLabel`.
- **Returns / side effects:** SVG figure. No network.
- **Used by:** `StatisticsScreen`.

## Function: StatisticsScreen

- **Purpose:** Client chart of people counted once per UTC day, with a shop-activity panel under the people chart. A signed-out visitor fetches both feeds and sees both panels. Does not return `null`. Any visitor fetches both feeds and sees yesterday's person count, the measurement paragraph, and the 30-UTC-day people chart (no goal line), then the shop panel (one explainer and the 30-UTC-day shop-count chart). Each panel loads and fails on its own. The people panel is always open and there is no **Tap to close**. No forbidden card. When `roleAtLeast(..., 'moderator')` and yesterday's person count is a number (including 0; not loading and not the people error panel, including omitted `officialCount`), closed `StaffFunctions` sits after the people chart and before the shop panel; its only child is the payout `ButtonLink` (`href` `/moderate/payouts`, `variant` `secondary`, `size` `lg`, label `moderate.payouts.link`). Basis and verified never render `StaffFunctions`. A signed-out visitor never renders `StaffFunctions`.
- **Inputs:** Account from `useAuthStore`; catalog and locale via `useTranslations`.
- **Returns / side effects:** A React element. No session still fetches. Fetches `GET /gifts/stats` and also calls `fetchShopActivity`. Does not return `null`.
- **Used by:** `StatisticsPage`.

## Function: ModerateScreen

- **Purpose:** Client moderation hub of staff tools. Staff (`roleAtLeast(..., 'moderator')`) see a labeled **Goals** `ButtonLink` (`variant="secondary"` `size="lg"`) → `/grants/goals` (first tool), a labeled **Hidden notes** `ButtonLink` (`variant="secondary"` `size="lg"`) → `/moderate/hidden`, a labeled **Open proposals** `ButtonLink` (`variant="secondary"` `size="lg"`) → `/moderate/proposals` that shows `proposalCount` plus `moderate.proposals.unread` when greater than zero, a **Moderators chat group** `ButtonLink` → `/moderate/group` that shows the staff-room unread count plus `moderate.groupUnread` when unread, a labeled **Handbook** `ButtonLink` (`variant="secondary"` `size="lg"`) → `/moderate/handbook`, and a labeled **Show payout per person** `ButtonLink` (`variant="secondary"` `size="lg"`) → `/moderate/payouts` (last tool). There is no payout-goal widget. Non-staff signed-in visitors see the heading plus forbidden copy and no tools list. Does not fetch hidden notes, proposals, applications, gift stats, or the group thread itself; unread for Open proposals and Moderators chat group comes from `useUnreadCount`. Renders `null` without a session. No un-hide control.
- **Inputs:** Session and account from `useAuthStore`; catalog via `useTranslations`; `useUnreadCount(true, { writeBadge: false })` for Open proposals `proposalCount` and Moderators chat group staff-room unread (network for those counts; does not write the home-screen badge).
- **Returns / side effects:** React element or `null` without a session. Does not fetch `GET /gifts/stats`. Others see forbidden copy and do not fetch. Does not fetch hidden notes, proposals, applications, or the group thread itself.
- **Used by:** `ModeratePage`.

## Function: ModerateHandbookPage

- **Purpose:** Next.js page for `/moderate/handbook` (signed-in staff handbook). HTML `/moderate/handbook` is the handbook page, not a GET proxy. Fill `AppShell` (`align="center"`) with `ProfileChromeLeft` top-left (the only back control: the arrow returns to the previous in-app view in this tab, or `/welcome` when this tab has none; the wordmark is not that control), `SignedInChrome` top-right, and `OnboardingGate screen="welcome"` around `ModerateHandbookScreen`. Hub is `/moderate`.
- **Inputs:** None.
- **Returns / side effects:** The handbook screen inside fill AppShell.
- **Used by:** Route `/moderate/handbook`.

## Function: ModerateHandbookScreen

- **Purpose:** Client staff handbook of how 21.gifts works. Staff (`roleAtLeast(..., 'moderator')`) see TOC **Chapters** and three chapters **21.gifts login** (`#login`), **Verified** (`#verified`), **Official funding program** (`#funding`), each with a permalink and `HandbookCopyLink` `tone="app"`. Non-staff signed-in visitors see the heading plus forbidden copy and no chapters. Renders `null` without a session. The page chrome owns the back; this screen renders no back control. No fetch. On mount and hashchange, scrolls the matching chapter into view when the hash is `#login`, `#verified`, or `#funding`.
- **Inputs:** Session and account from `useAuthStore`; catalog via `useTranslations`.
- **Returns / side effects:** React element or `null` without a session. No network.
- **Used by:** `ModerateHandbookPage`.

## Function: HiddenNotesPage

- **Purpose:** Next.js page for `/moderate/hidden` (signed-in hidden-notes list for moderators). HTML `/moderate/hidden` is the hidden-notes page, not a GET proxy. Fill `AppShell` (`align="center"`) with `ProfileChromeLeft` top-left (the only back control: the arrow returns to the previous in-app view in this tab, or `/welcome` when this tab has none; the wordmark is not that control), `SignedInChrome` top-right, and `OnboardingGate screen="welcome"` around `HiddenNotesScreen`. Hidden HTTP is under `/forum/messages/hidden` (no `route.ts` beside this page).
- **Inputs:** None.
- **Returns / side effects:** The hidden-notes screen inside fill AppShell.
- **Used by:** Route `/moderate/hidden`.

## Function: HiddenNotesScreen

- **Purpose:** Client list of hidden living-room notes. Staff (moderator) fetch `listHiddenMessages` and show the lead copy plus the newest-hidden-first list (a non-interactive **External** badge next to the name when the row has a `via` value) (or empty / loading / try-again). A 21.gifts author name is a `Link` to `/members/:accountId`. The time is a `Link` to `/messages/:id`. An external name stays text inside the note link. The note text sits outside that link in `TranslatableNoteBody` (Languages **Translate** when the text differs from the UI locale). Non-staff signed-in visitors see the heading plus forbidden copy and do not fetch. Renders `null` without a session. The page chrome owns the back; this screen renders no back control. No un-hide control.

- **Inputs:** Session and account from `useAuthStore`; catalog via `useTranslations`.
- **Returns / side effects:** React element or `null` without a session. Fetches `GET /forum/messages/hidden` only when the role is at least moderator.
- **Used by:** `HiddenNotesPage`.

## Function: PayoutsPage

- **Purpose:** Next.js page for `/moderate/payouts` (signed-in staff payout-per-person table). HTML `/moderate/payouts` is the table, not a GET proxy. Fill `AppShell` (`align="center"`) with `ProfileChromeLeft` top-left (the only back control: the arrow returns to the previous in-app view in this tab, or `/welcome` when this tab has none; the wordmark is not that control), `SignedInChrome` top-right, and `OnboardingGate screen="welcome"` around `FundingPayoutsScreen`. JSON lives under `/funding/payout-days` because Next.js forbids a `route.ts` beside this page. Hub is `/moderate`.
- **Inputs:** None.
- **Returns / side effects:** The payout table inside fill AppShell.
- **Used by:** Route `/moderate/payouts`.

## Function: FundingPayoutsScreen

- **Purpose:** Client table of daily-grant payouts for seven UTC days. Staff (moderator) fetch `fetchFundingPayoutDays` and show a lead, a four-color legend, and name plus seven cells (black not entitled, white entitled but not collected, green payout received, amber welcome gift; split green/amber when both were paid the same day). Today is the rightmost column. A row with `accountId` links the name to `/members/{id}`. Empty, Loading…, and error plus Try again are separate. Non-staff signed-in visitors see the heading plus forbidden copy and do not fetch. Renders `null` without a session. The page chrome owns the back; this screen renders no back control. Moderator stipends are not in this table. Welcome gifts are in the table.
- **Inputs:** Session and account from `useAuthStore`; catalog via `useTranslations`.
- **Returns / side effects:** React element or `null` without a session. Fetches `GET /funding/payout-days` only when the role is at least moderator.
- **Used by:** `PayoutsPage`.

## Function: ProposalsPage

- **Purpose:** Next.js page for `/moderate/proposals` (signed-in staff confirm/reject queue). HTML `/moderate/proposals` is the queue, not a GET proxy. Fill `AppShell` (`align="center"`) with `ProfileChromeLeft` top-left (the only back control: the arrow returns to the previous in-app view in this tab, or `/welcome` when this tab has none; the wordmark is not that control), `SignedInChrome` top-right, and `OnboardingGate screen="welcome"` around `ProposalsScreen`. Proposal HTTP lives under `/trust/proposals` because Next.js forbids a `route.ts` beside this page. Hub is `/moderate`.
- **Inputs:** None.
- **Returns / side effects:** The open-proposals screen inside fill AppShell.
- **Used by:** Route `/moderate/proposals`.

## Function: ProposalsScreen

- **Purpose:** Client confirm/reject queue of open moderator proposals. Staff (moderator) fetch `fetchTrustProposals` and show subject name, **Proposed by {name}**, time, **Reject** on every open row (`postTrustReject`, including a self-proposal), and **Confirm as moderator** (`postTrustConfirm`) or **Waiting for another moderator to confirm.** when `proposedBy.id === account.id`. Non-staff signed-in visitors see the heading plus forbidden copy and do not fetch. Renders `null` without a session. The page chrome owns the back; this screen renders no back control. A failed confirm or reject shows `trustChain.actionFailed`.
- **Inputs:** Session and account from `useAuthStore`; catalog via `useTranslations`.
- **Returns / side effects:** React element or `null` without a session. Fetches `GET /trust/proposals` only when the role is at least moderator. Confirm posts `POST /trust/confirm-moderator`; reject posts `POST /trust/reject-moderator`. While either POST is in flight, Confirm and Reject are disabled and Loader2 sits on the pressed action.
- **Used by:** `ProposalsPage`.

## Function: FundingApplicationsPage

- **Purpose:** Next.js page for `/grants/applications` (signed-in staff grant-application queue). HTML `/grants/applications` is the queue, not a GET proxy. `/moderate/applications` redirects there. Fill `AppShell` (`align="center"`) with `ProfileChromeLeft` top-left (the only back control: the arrow returns to the previous in-app view in this tab, or `/welcome` when this tab has none; the wordmark is not that control), `SignedInChrome` top-right, and `OnboardingGate screen="welcome"` around `FundingApplicationsScreen`. Application HTTP lives under `/funding/applications` because Next.js forbids a `route.ts` beside this page.
- **Inputs:** None.
- **Returns / side effects:** The open-applications screen inside fill AppShell.
- **Used by:** Route `/grants/applications`. `/moderate/applications` redirects here.

## Function: FundingApplicationsScreen

- **Purpose:** Client queue of open 21 gifts grant applications. Staff (founder or moderator) fetch `fetchFundingApplications` and show applicant name (link `/grants/applications/{id}`), applied time, empty / Loading… / error+Try again. Non-staff signed-in visitors see the heading plus forbidden copy and do not fetch. Renders `null` without a session. The page chrome owns the back; this screen renders no back control.
- **Inputs:** Session and account from `useAuthStore`; catalog via `useTranslations`.
- **Returns / side effects:** React element or `null` without a session. Fetches `GET /funding/applications` only when the role is founder or moderator.
- **Used by:** `FundingApplicationsPage`.

## Function: FundingApplicationDetailPage

- **Purpose:** Next.js page for `/grants/applications/[accountId]` (signed-in staff grant-application review). HTML page, not a GET proxy. `/moderate/applications/[accountId]` redirects there. Fill `AppShell` (`align="center"`) with `ProfileChromeLeft` top-left (the only back control: the arrow returns to the previous in-app view in this tab, or `/welcome` when this tab has none; the wordmark is not that control), `SignedInChrome` top-right, and `OnboardingGate screen="welcome"` around `FundingApplicationDetailScreen`. Application HTTP lives under `/funding/applications/:accountId`.
- **Inputs:** Dynamic `accountId`.
- **Returns / side effects:** The application-detail screen inside fill AppShell.
- **Used by:** Route `/grants/applications/[accountId]`. The moderate path redirects here.

## Function: FundingApplicationDetailScreen

- **Purpose:** Client staff review of one grant application. Staff fetch `fetchFundingApplication` and answer two questions against living-room posts (no replies; post text uses `TranslatableNoteBody`, the applicant name stays plain; each post keeps its own time; there is no application time under the name). The first is `funding.review.question.staff`, with an About link to `/about`. **Yes** shows `funding.review.truth`. **Yes** there posts `postFundingAdmit`. **No** on either question posts `postFundingReject` while the grant is `pending` or `trial`. A failed decision shows `trustChain.actionFailed`. Non-staff signed-in visitors see the heading plus forbidden copy and do not fetch. Renders `null` without a session. The page chrome owns the back; this screen renders no back control. While a POST is in flight, visible decide buttons are disabled and show the Loader2 spinner.
- **Inputs:** `accountId`; session and account from `useAuthStore`; catalog via `useTranslations`.
- **Returns / side effects:** React element or `null` without a session. Fetches `GET /funding/applications/:accountId` only when the role is founder or moderator. Decide buttons only when `grant.status` is `pending` or `trial`. Successful Admit / Reject leaves the buttons disabled and navigates to `/grants/applications`.
- **Used by:** `FundingApplicationDetailPage`.

## Function: SettingsPage

- **Purpose:** Next.js page for `/settings`, the signed-in settings opened from the **Settings** Menu row.
- **Inputs:** None.
- **Returns / side effects:** Fill `AppShell` with `ProfileChromeLeft` and `SignedInChrome`, `OnboardingGate screen="profile"` (name, username, and rules agreement), then `SettingsScreen`.
- **Used by:** Route `/settings`.

## Function: SettingsScreen

- **Purpose:** Signed-in `/settings` body. Holds the recovery-phrase entry that used to sit under the wallet home buttons.
- **Inputs:** `session` and `account` from `useAuthStore`. Reads only `account.passkeyCredentialId`.
- **Returns / side effects:** `null` without a session or before the account has loaded. Otherwise a `Card surface={false}` with **h1** **Settings** (`settings.heading`) and a `section` labelled by its small uppercase heading **Wallet** (`wallet.title`). With a non-empty `passkeyCredentialId`: a secondary `ButtonLink size="lg"` **Recovery phrase** (`settings.recoveryPhrase`). Missing, null, or empty: the muted hint `wallet.addPhraseHint` and a primary `ButtonLink size="lg"` **Add recovery phrase** (`wallet.addPhrase`). Both open `/wallet/phrase` client-side, so its top-left arrow returns to `/settings`. No passkey prompt and no fetch on this page.
- **Used by:** `SettingsPage`.

## Function: GrantsPage

- **Purpose:** Next.js page for `/grants`. Fill `AppShell` with `ProfileChromeLeft`, `SignedInChrome`, and `OnboardingGate screen="profile"` around `GrantsScreen`.
- **Inputs:** None.
- **Returns / side effects:** The grants screen inside fill AppShell.
- **Used by:** Route `/grants`.

## Function: GrantsScreen

- **Purpose:** Signed-in grants page. Renders `FundingStatusCard` (verification / 21 gifts grant). When the account is non-null, a secondary large **Goals** `ButtonLink` (`funding.goals.link`) goes to `/grants/goals`, under the grant card and above the staff queue. A missing account shows no link. When `canEditDailyPayoutRoster` is true (initiator or founder only), two secondary large `ButtonLink`s, **Daily payment text** to `/grants/payments/comment` and **Daily payment amounts** to `/grants/payments/amounts`, do not fetch the roster. A moderator does not see those links. When `roleAtLeast(role, 'moderator')`, loads open applications. A count above zero is a secondary large `ButtonLink` to `/grants/applications` labeled **Open application (1)** when the count is one and **Open applications (2)** otherwise (`funding.applications.openCount`). A count of zero is the plain sentence **No open applications.**, not a link. Renders `null` without a session.
- **Inputs:** Session and account from `useAuthStore`; catalog via `useTranslations`.
- **Returns / side effects:** React element or `null` without a session. Fetches `GET /funding/applications` only when `roleAtLeast(role, 'moderator')`, which includes an initiator and a founder. Roles below moderator do not fetch. Loading and a failed load (error sentence plus **Try again**) do not show the applications link. The Goals link does not fetch; `/grants/goals` loads `GET /funding/goal`.
- **Used by:** `GrantsPage`.

## Function: GrantGoalsPage

- **Purpose:** Next.js page for `/grants/goals`. Fill `AppShell` with `ProfileChromeLeft`, `SignedInChrome`, and `OnboardingGate screen="profile"` around `GrantGoalsScreen`.
- **Inputs:** None.
- **Returns / side effects:** The goals screen inside fill AppShell.
- **Used by:** Route `/grants/goals`.

## Function: GrantGoalsScreen

- **Purpose:** Signed-in grant goal. Heading **Goals**, the sentence that the program continues at 10 active shops, the sentence that a shop is active with at least one transaction on 5 of the last 7 days, and the sentence that defines a transaction as a till payment created at https://21.gifts/pos (creating it counts, including later expiry or cancel). When the load succeeds, shows how many shops meet that rule, the label **Shops per UTC day**, `ShopActivityChart` for those 7 days, and the note that the lighter bar is today still open. Loading and error (error sentence plus **Try again**) keep the heading and those sentences. Renders `null` without a session and does not fetch then.
- **Inputs:** Session from `useAuthStore`; catalog and locale via `useTranslations`.
- **Returns / side effects:** React element or `null` without a session. Fetches `GET /funding/goal` through `fetchGrantContinuation` only when a session exists. Does not call `fetchShopActivity`.
- **Used by:** `GrantGoalsPage`.

## Function: DailyPaymentCommentPage

- **Purpose:** Next.js page for `/grants/payments/comment`. Fill `AppShell` (`align="center"`) with `ProfileChromeLeft` top-left (the only back control: the arrow returns to the previous in-app view in this tab, or `/welcome` when this tab has none; the wordmark is not that control), `SignedInChrome` top-right, and `OnboardingGate screen="welcome"` around `DailyPaymentCommentScreen`. Amounts are a separate page. Roster HTTP lives under `/funding/daily-roster` because Next.js forbids a `route.ts` beside this page.
- **Inputs:** None.
- **Returns / side effects:** The daily-payment comment screen inside fill AppShell.
- **Used by:** Route `/grants/payments/comment`.

## Function: DailyPaymentCommentScreen

- **Purpose:** Client editor for the daily payout comment only. An initiator or founder fetches `fetchDailyRoster` and may save the comment. The comment is text until an icon-only pencil (`funding.daily.editComment`) opens it. The check (`funding.daily.save`) stores it and the X (`funding.daily.cancel`) restores the stored comment. An empty comment shows `funding.daily.commentEmpty`. Words Save, Cancel, and Edit are not visible labels. A save in flight replaces the check with a spinner. This screen does not show the default-amount sentence, the payments switch, recipients, or Add. Everyone else who is signed in sees the heading plus `funding.daily.forbidden` and does not fetch. Renders `null` without a session. The page chrome owns the back; this screen renders no back control. A failed load shows `funding.daily.error` and **Try again**.
- **Inputs:** Session and account from `useAuthStore`; catalog via `useTranslations`.
- **Returns / side effects:** React element or `null` without a session. Fetches `GET /funding/daily-roster` only when `canEditDailyPayoutRoster` is true. The comment save goes to `POST /funding/daily-roster/comment`. A save failure shows a `funding.daily.*` catalog sentence and leaves the field open.
- **Used by:** `DailyPaymentCommentPage`.

## Function: DailyPaymentAmountsPage

- **Purpose:** Next.js page for `/grants/payments/amounts`. Fill `AppShell` (`align="center"`) with `ProfileChromeLeft` top-left (the only back control: the arrow returns to the previous in-app view in this tab, or `/welcome` when this tab has none; the wordmark is not that control), `SignedInChrome` top-right, and `OnboardingGate screen="welcome"` around `DailyPaymentAmountsScreen`. The comment is a separate page. Roster HTTP lives under `/funding/daily-roster` because Next.js forbids a `route.ts` beside this page.
- **Inputs:** None.
- **Returns / side effects:** The daily-payment amounts screen inside fill AppShell.
- **Used by:** Route `/grants/payments/amounts`.

## Function: DailyPaymentAmountsScreen

- **Purpose:** Client editor for daily payout amounts only. An initiator or founder fetches `fetchDailyRoster` and may turn payments on or off and add, update, or delete a recipient. The loaded editor shows `funding.daily.defaultNote` with `{amount}` from `roster.defaultAmountUsd` via `formatUsdDisplay`. A row shows the display name, or Unnamed when the name is null or blank. When accountId is set the name is a link to `/members/{accountId}`. On a recipient row the formatted USD amount, the pencil (`funding.daily.edit` plus that label), and the trash share one line. The pencil opens a `Field`; the check saves and the X cancels. Amounts are the stored USD figure (`Field`, not `AmountEntry`). The total uses `formatUsdDisplay` and the visitor grouping style. The add field is Person. Typing `@` opens the first page of people from the same search as a forum mention. Further letters keep only usernames that start that way. Choosing one fills `@username`, keeps that person selected while the field equals that token, and leaves the list open. Add posts accountId. No address is rendered. The comment is not on this screen. Everyone else who is signed in sees the heading plus `funding.daily.forbidden` and does not fetch. Renders `null` without a session. The page chrome owns the back; this screen renders no back control. A failed load shows `funding.daily.error` and **Try again**.
- **Inputs:** Session and account from `useAuthStore`; catalog via `useTranslations`; grouping via `useNumberFormat`.
- **Returns / side effects:** React element or `null` without a session. Fetches `GET /funding/daily-roster` only when `canEditDailyPayoutRoster` is true. Saves go to the payments, add, update, and delete daily-roster POSTs. A save failure shows a `funding.daily.*` catalog sentence.
- **Used by:** `DailyPaymentAmountsPage`.

## Function: FundingStatusCard

- **Purpose:** Owner grant section on `/grants`, not on the profile. The title is one `h1` **21 gifts grant** at the app page ramp, with no hairline above it. `basis` sees not-verified copy and how in-person verification works (no apply), including when the username is `joey-rosima`, `vincent`, or `jewel-bacolbas`. Verified and above see funding status from `account.funding` (missing or `null` treated as `none`): while `grantApplicationsPaused` is true, `FundingPausedCopy` for `none`/`rejected` (no Apply, no About link) except usernames `joey-rosima`, `vincent`, and `jewel-bacolbas`, who still see the daily-gift sentence, About link, and Apply link to `/grants/apply`; when that switch is false, the daily-gift sentence, About link, and Apply link to `/grants/apply`. Then pending, one-day trial, or admitted with **Takes part in the 21.gifts funding program** (since {date} when `admittedAt` is a number). Pending, trial, and admitted stay as they are for every username.
- **Inputs:** Session and account from `useAuthStore`; catalog via `useTranslations`.
- **Returns / side effects:** React element or `null` without a session or account. `none`/`rejected` do not offer Apply while applications are paused, except a verified account named `joey-rosima`, `vincent`, or `jewel-bacolbas`.
- **Used by:** `GrantsScreen`.

## Function: FundingApplyPage

- **Purpose:** Next.js page for `/grants/apply`. Fill `AppShell` with `ProfileChromeLeft` top-left (the only back control: the arrow returns to the previous in-app view in this tab, or `/welcome` when this tab has none; the wordmark is not that control), `SignedInChrome` top-right, and `OnboardingGate screen="profile"` around `FundingApplyScreen`. `/profile/apply` redirects to this path.
- **Inputs:** None.
- **Returns / side effects:** `FundingApplyScreen` inside fill AppShell. While applications are paused, the username is not `joey-rosima`, `vincent`, or `jewel-bacolbas`, and the status is not pending, trial, or admitted: the paused card. A verified account with one of those names and status `none` or `rejected`: the apply walk. Pending, trial, and admitted: that copy for every verified username. A basis account named one of those three, and a basis account whose status is pending, trial, or admitted: **You are not verified yet.** Any other basis account sees the paused card.
- **Used by:** Route `/grants/apply`.

## Function: FundingApplyScreen

- **Purpose:** Signed-in grant apply screen. While `grantApplicationsPaused` is true, `grantApplicationStillOpen` is false, and funding status is not pending, trial, or admitted, heading **21 gifts grant** and `FundingPausedCopy` only: no About-me steps, no questions, no POST. A missing account still shows that paused card. Pending, trial, and admitted keep their copy for every verified username. Usernames `joey-rosima`, `vincent`, and `jewel-bacolbas` with status `none` or `rejected` open the existing apply card: a verified account fills About me, photo, and location, then two yes/no questions; a basis account sees **You are not verified yet.** and does not post. When that switch is false, every signed-in account opens that same card. The page chrome owns the back; this screen renders no back control.
- **Inputs:** Session and account from `useAuthStore` (the account is read before choosing the pause card or the walk). Uses translations.
- **Returns / side effects:** The paused card while applications are paused, the username is not one of those three, and the status is not pending, trial, or admitted. Otherwise the apply card. On that card a verified account with status none or rejected on the roster sees the walk, and a verified account with status pending, trial, or admitted sees that status. A basis account on that card sees **You are not verified yet.**, including when the status is pending, trial, or admitted. Without a session the screen is `null` when the walk is open. Yes on the truth question posts `postFundingApply` only when the walk is open and the account is verified.
- **Used by:** `FundingApplyPage`.

## Function: grantApplicationsPaused

- **Purpose:** Switch for new grant applications. Returns true while they are paused. The apply walk and the apply API stay in the code. This switch stays true for everyone; `grantApplicationStillOpen` is the username exception in the three screens.
- **Inputs:** None.
- **Returns / side effects:** `true`.
- **Used by:** `FundingApplyScreen`, `FundingStatusCard`, `DailyPayoutStoppedNotice`.

## Function: grantApplicationStillOpen

- **Purpose:** Whether this signed-in username skips the pause card while applications are paused. Exact, case-sensitive match against `joey-rosima`, `vincent`, and `jewel-bacolbas`. It does not by itself open the apply walk: a basis account on the open card still sees **You are not verified yet.** Null, omitted, empty, and every other username (including `Vincent`) do not skip the card.
- **Inputs:** `username` string, null, or undefined.
- **Returns / side effects:** `true` only for those three strings.
- **Used by:** `FundingApplyScreen`, `FundingStatusCard`, `DailyPayoutStoppedNotice`.

## Function: aboutMeFilled

- **Purpose:** True when About me is a real bio (not empty or the display-name auto note). Used by the apply walk. That walk is shown while applications are paused only for a verified account named `joey-rosima`, `vincent`, or `jewel-bacolbas` with status `none` or `rejected`, and, when the switch is off, for a verified account with status `none` or `rejected`.
- **Inputs:** `aboutMe`, `name`.
- **Returns / side effects:** boolean.
- **Used by:** `nextFillStep`, `FundingApplyScreen`.

## Function: locationFilled

- **Purpose:** True when location is a non-empty trimmed string. Used by the apply walk. That walk is shown while applications are paused only for a verified account named `joey-rosima`, `vincent`, or `jewel-bacolbas` with status `none` or `rejected`, and, when the switch is off, for a verified account with status `none` or `rejected`.
- **Inputs:** `location`.
- **Returns / side effects:** boolean.
- **Used by:** `nextFillStep`, `FundingApplyScreen`.

## Function: nextFillStep

- **Purpose:** First missing apply fill step: about, photo, then location, or `null` when all three are present. Used by the apply walk. That walk is shown while applications are paused only for a verified account named `joey-rosima`, `vincent`, or `jewel-bacolbas` with status `none` or `rejected`, and, when the switch is off, for a verified account with status `none` or `rejected`.
- **Inputs:** Owner `Account`.
- **Returns / side effects:** `'about' | 'photo' | 'location' | null`.
- **Used by:** `FundingApplyScreen`.

## Function: ModeratorGroupPage

- **Purpose:** Next.js page for `/moderate/group` (signed-in closed moderator group thread). HTML `/moderate/group` is the group page, not a GET proxy. Fill `AppShell` (`align="center"`) with `ProfileChromeLeft` top-left (the only back control: the arrow returns to the previous in-app view in this tab, or `/welcome` when this tab has none; the wordmark is not that control), `SignedInChrome` top-right, and `OnboardingGate screen="welcome"` around `ModeratorGroupScreen`. Group HTTP lives under `/conversations/moderator-group` (no `route.ts` beside this page).
- **Inputs:** None.
- **Returns / side effects:** The moderator group screen inside fill AppShell.
- **Used by:** Route `/moderate/group`.

## Function: ModeratorGroupScreen

- **Purpose:** Client closed staff-room thread. Moderators (`roleAtLeast(role, 'moderator')`) fetch `fetchModeratorGroup` then the newest 20-message page with `fetchConversation(session, group.id)` and reuse `InboxScreen` as the open thread (`showFilter` false; `showAmount` false; `showAttach` true; no in-card back; row `name` replaced by the catalog `moderate.groupLabel` so the heading is always **Moderators chat group**). An `IntersectionObserver` on `InboxScreen`'s `nearStartRef` (the eighth grouped bubble from the start, or the first when fewer than eight render) attaches only after the thread end is in view or the thread fits, uses the active page scrollport as its root when one is mounted, then fetches a set `nextCursor` and prepends unique older messages. The first screen is the newest message. The cursor load does not blank the thread; while stuck to the bottom, InboxScreen keeps the newest in view. JPEG/PNG/WebP stills (cap 10) via `prepareForumPhoto`; photo-only send allowed. Send is disabled while a pick is still preparing (`posting || preparing`). Thread stills load with `fetchConversationMessagePhoto`. Losing staff while mounted bumps `pickGeneration`, clears drafts/preparing, and revokes blob URLs (same cleanup as unmount); replacing the thread also revokes URLs for stills that are no longer on the message list. Also calls `useSpotRate()` and passes `rateDay` to `InboxScreen`. After a successful group+thread load: `markConversationRead`, `bumpUnreadAppBadgeEpoch`, `refreshUnreadAppBadge(session, undefined, 0)` (staff-room unread 0; inbox still fetched). Other signed-in visitors see heading **Moderators chat group** plus `moderate.groupForbidden` and do not fetch. Renders `null` without a session. The top-left arrow returns to the previous in-app view in this tab, or `/welcome` when this tab has none. One arrow. The wordmark is not that control. There is no in-card back. While the staff room is open and the tab is visible, the newest page is fetched every 5 seconds and unseen messages are appended; a hidden tab does not poll, and a failed poll keeps the thread.
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

- **Purpose:** Next.js page for `/handbook/screens`. Loads screen-variant topics and renders the compact-card `HandbookImageViewer`. English card text comes from `screens.md`. German, Spanish, and Filipino come from the screen-card locale file for the request locale.
- **Inputs:** Request locale from `getRequestLocale` (cookie `locale`, otherwise `Accept-Language`).
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

- **Purpose:** Full-size handbook image overlay on marketing tokens (`bg-ink`, `border-paper/10`, `bg-app-overlay` scrim, ghost `IconButton` + `X`). Close via X, backdrop click, or Escape. Optional previous/next chevrons when `onPrevious`/`onNext` are set: `ChevronLeft` shows the previous image (`handbook.previousImage`) and `ChevronRight` the next image. Those chevrons stay in the overlay and are not the page-back arrow. Focuses the close control on open. Not a native `<dialog>`.
- **Inputs:** `open`, `src`, `alt`, `onClose`, optional `onPrevious`, optional `onNext`.
- **Returns / side effects:** `role="dialog"` overlay when `open`, otherwise `null`. Document keydown while open. No network.
- **Used by:** `HandbookFigure`, `HandbookImageViewer`.

## Function: topicAnchor

- **Purpose:** Stable DOM/hash id from a catalog topic id (`${route}:${variant}`). Path `/` → `root`; other paths drop the leading `/` and replace remaining `/` with `-`; variant is the segment after the last `:`.
- **Inputs:** Catalog topic id string (`/:default`, `/welcome:wallet-pay-unavailable`, `/handbook/screens:dark`, …).
- **Returns / side effects:** Anchor string (`root-default`, `welcome-wallet-pay-unavailable`, `handbook-screens-dark`, …). No network.
- **Used by:** `buildHandbookOutline`.

## Function: parseScreenVariantDescriptions

- **Purpose:** Parse `docs/handbook/screens.md` into a map of catalog topic id → English description. Under each `## Screen:` / `### Variant:`, collect paragraphs (excluding image-only lines), unwrap `**bold**` and `` `code` ``, join with a blank line; skip empty strings.
- **Inputs:** Raw screens handbook markdown string.
- **Returns / side effects:** `ReadonlyMap<string, string>` keyed as `<path>:<variantId>`. No network.
- **Used by:** `HandbookScreensPage` (`loadScreenTopics`) and the screen-description tests.

## Function: screenVariantDescription

- **Purpose:** Screen-card description for one catalog id in the request locale. English is the paragraph from `docs/handbook/screens.md`. German, Spanish, and Filipino come from the screen-card locale file. A missing or blank English paragraph shows the catalog label in every locale.
- **Inputs:** Locale (`en`, `de`, `es`, or `fil`), catalog id (`<path>:<variant>`), the English paragraph when present, and the catalog label.
- **Returns / side effects:** Locale text, unchanged English, or the catalog label. Throws when `de`, `es`, or `fil` has no non-blank text for that id. No network. No English fallback.
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
- **Returns / side effects:** Hidden for other roles; idle trash sits in the note footer icon row (parent) or the nested reply action row (`kind="reply"`); confirming wraps to the next line via `basis-full w-full` and renders `InlineConfirm`. Idle/confirm/error copy is `forum.delete*` for posts and `forum.deleteReply*` for replies. Calls deleteMessage on explicit confirmation, then onDeleted. Error keeps the post or reply and permits retry.
- **Used by:** `ForumBoard` on the parent footer and on nested reply cards.

## Function: InlineConfirm

- **Purpose:** Bordered confirm or cancel group shared by post delete, habit archive, and habit comment delete. Callers keep their own idle button. This is only the open question.
- **Inputs:** `label` (the question and the group's accessible name), `confirmLabel`, `cancelLabel`, `onConfirm`, `onCancel`, optional `busy`, and optional `error`.
- **Returns / side effects:** A `role="group"` with the question, an optional alert, a check (a spinner while `busy`), and an X. Both actions are disabled while `busy`. It sends no request of its own.
- **Used by:** `DeletePostControl`, `MemberHabits`, and `HabitComments`.

## Function: deleteMessage

- **Purpose:** Send a moderator hide request for a forum message (top-level note or nested reply).
- **Inputs:** sessionToken and messageId.
- **Returns / side effects:** DELETE `/forum/messages/:id`; resolves on 204 or already-missing 404, throws on other statuses or network errors. Hide/omit semantics: the API keeps the row with `deleted_at` and omits it from GET.
- **Used by:** `DeletePostControl`.

## Function: setMessagePlace

- **Purpose:** Set or clear the place pin on a forum message for a moderator session.
- **Inputs:** sessionToken, messageId, and `place` (`ForumPlacePin`, or `null` to clear).
- **Returns / side effects:** PATCH `/forum/messages/:id/place` with JSON `{ place }`. Resolves to the public message JSON (`place` omitted when cleared). Throws `Could not save place` on a non-2xx status.
- **Used by:** `ShopPlaceControl`.

## Function: setMessageShopPhotos

- **Purpose:** Replace the stills on a shop note for a moderator session. An empty list clears stills. A video on the note stays.
- **Inputs:** sessionToken, messageId, and `photos` (`{ contentType, data, takenAt? }[]`, at most 10).
- **Returns / side effects:** PATCH `/forum/messages/:id/photos` with JSON `{ photos }`. A blank `takenAt` is omitted. Resolves to the public message JSON. Throws `Could not save shop note` on a non-2xx status.
- **Used by:** `ShopNoteEditControl`.

## Function: setMessageShopText

- **Purpose:** Replace the text of a shop note for a moderator session. The API keeps the shop tag.
- **Inputs:** sessionToken, messageId, and `text` (the visible draft; the shop tag may be omitted).
- **Returns / side effects:** PATCH `/forum/messages/:id/text` with JSON `{ text }`. Resolves to the public message JSON. Throws `Could not save shop note` on a non-2xx status.
- **Used by:** `ShopNoteEditControl`.

## Function: fetchShopNoteEdits

- **Purpose:** Load the staff edit history of one shop note, newest first.
- **Inputs:** sessionToken and messageId.
- **Returns / side effects:** GET `/forum/messages/:id/edits`. Resolves to the `edits` array (text, place, or shop account, with actor id, name, and role). Throws `Could not load edit history` on a non-2xx status.
- **Used by:** `ShopNoteEditControl` when the pencil panel opens.

## Function: setMessageShopAccount

- **Purpose:** Set or clear the shop account on a forum message for a moderator session.
- **Inputs:** sessionToken, messageId, and `username` (string, or `null` to clear).
- **Returns / side effects:** PATCH `/forum/messages/:id/shop-account` with JSON `{ username }`. Resolves to the public message JSON (`shopAccount` omitted when cleared). Throws `No account with that username` on 404, otherwise `Could not save account`.
- **Used by:** `ShopAccountControl`.

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

## Function: proxyMessagesPlacePatch

- **Purpose:** Forward a moderator's PATCH of a message place pin to the API.
- **Inputs:** Incoming Request (Bearer JSON `{ place }`) and messageId.
- **Returns / side effects:** Proxied PATCH `/messages/:id/place`, with encoded id, authorization and upstream status. 200 is the public message JSON; a cleared pin omits `place`.
- **Used by:** App Router `PATCH` on `/forum/messages/[id]/place`.

## Function: proxyMessagesPhotosPatch

- **Purpose:** Forward a moderator's PATCH of shop-note stills to the API.
- **Inputs:** Incoming Request (Bearer JSON `{ photos }`) and messageId.
- **Returns / side effects:** Proxied PATCH `/messages/:id/photos`, with encoded id, authorization and upstream status. 200 is the public message JSON.
- **Used by:** App Router `PATCH` on `/forum/messages/[id]/photos`.

## Function: proxyMessagesTextPatch

- **Purpose:** Forward a moderator's PATCH of a shop-note body to the API.
- **Inputs:** Incoming Request (Bearer JSON `{ text }`) and messageId.
- **Returns / side effects:** Proxied PATCH `/messages/:id/text`, with encoded id, authorization and upstream status. 200 is the public message JSON. The shop tag stays on the stored text.
- **Used by:** App Router `PATCH` on `/forum/messages/[id]/text`.

## Function: proxyMessagesEditsGet

- **Purpose:** Forward a moderator's GET of shop-note edit history to the API.
- **Inputs:** Incoming Request (Bearer) and messageId.
- **Returns / side effects:** Proxied GET `/messages/:id/edits`, with encoded id, authorization and upstream status. 200 is `{ edits }` newest first.
- **Used by:** App Router `GET` on `/forum/messages/[id]/edits`.

## Function: proxyMessagesShopAccountPatch

- **Purpose:** Forward a moderator's PATCH of a message shop account to the API.
- **Inputs:** Incoming Request (Bearer JSON `{ username }`) and messageId.
- **Returns / side effects:** Proxied PATCH `/messages/:id/shop-account`, with encoded id, authorization and upstream status. 200 is the public message JSON; a cleared account omits `shopAccount`.
- **Used by:** App Router `PATCH` on `/forum/messages/[id]/shop-account`.

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

- **Purpose:** Control-only client: **Translate**, **Show original**, and **Show translation** are the same Languages `IconButton` (`aria-label` `forum.translate`, `forum.translateShowOriginal`, or `forum.translateShowTranslation`; no visible label). The error and the spinner stay. Does not render `ForumNoteText` or the translated body — exclusive original XOR translation lives in `TranslatableNoteBody`. Offers the control when the note language differs from the active UI locale and GET `/translate` reports available. Identity is `source + messageId + text + locale` (not `text + locale` alone). **Translate** sits in the card footer icon row with react / pay / copy when `placement` is `row` (ForumBoard supplies a `controlSlotId` to `TranslatableNoteBody`, which portals this control there); otherwise under the body (unsigned cards, inbox, About me, funding, hidden notes). Failure shows **Could not translate this note. Please try again.** and keeps Translate.
- **Inputs:** Required `messageId` (stored forum or conversation message id) and `text` (raw prose body). Optional `source` (default `{ kind: 'message' }`, or `{ kind: 'conversation', conversationId }`). Optional `tone` (`default` | `onButton`, for `bg-app-btn` bubbles). Optional `placement` (`block` under the body, default; `row` uses `display: contents` so the icon sits in a parent footer flex row). Parent-owned `showingTranslation` (true while the translated body is on screen). `onTranslated` after a successful POST. Optional `onTranslateRequest`, called synchronously when Translate is clicked, before the request, and not from **Show original** / **Show translation**. `onToggleShowing` for **Show original** / **Show translation**. No `plain`, `bodyClassName`, or `onShowingTranslation`.
- **Returns / side effects:** The control, or `null` when the text is blank, translation is unavailable, or `shouldOfferNoteTranslate` is false. Calls `fetchTranslateAvailable` on mount and, on click, `translateNote` for a forum message or `translateConversationMessage` for a conversation message. A change of `source`, `messageId`, `text`, or UI locale resets status and invalidates in-flight requests (`identity = source + messageId + text + locale`). Stops click/keydown so forum expand does not fire. `onButton` paints the control with `text-app-btn-fg`. Does not mount the note body.
- **Used by:** `TranslatableNoteBody`.

## Function: TranslatableNoteBody

- **Purpose:** Exclusive original XOR translated body in the same React commit (not a parent `useEffect` after paint). Clicking **Translate** marks the note read-in-full so **Show more** is gone immediately (while loading, on error, and after **Show original**). A visible translation is the full text. Idle and error keep the original. **Show original** restores the original and hides the translation. Identity is `source + messageId + text + locale`. Holds `translatedText` and `showingTranslation`; a successful POST sets both so the original unmounts in that commit.
- **Inputs:** Required `messageId` (stored forum or conversation message id) and `text`. Optional `source` (default forum message, or `{ kind: 'conversation', conversationId }`). Optional `plain`. Optional `truncate` (default true; applies only to the original body — `ForumNoteText` vs `LinkedText`). A visible translation is always the full text via `LinkedText` (no Show more), including past 280 characters. Clicking Translate sets an internal read-full flag so a truncated original expands on that click and stays expanded when Show original restores it. A new identity clears that flag. Optional `className` (default `whitespace-pre-wrap text-sm text-app-fg`; `text-app-btn-fg` selects NoteTranslate `tone="onButton"`). Optional `formatTranslated` (applied only to the visible translation, not the original; not part of the identity key). Optional `controlSlotId` (when set, portals `NoteTranslate` with `placement="row"` into that element; if the node is missing, the control is omitted rather than stacked).
- **Returns / side effects:** Original or translated paragraph plus the translate control, or `null` when `text` is empty. Mounts `NoteTranslate` under the body, or portals it into `controlSlotId` when that node exists. Visible body is original XOR translation in the same commit. Idle/error keep original; **Show original** restores original and hides translation.
- **Used by:** `ForumBoard` (notes and replies, including `via === 'nostr'`), `PublicMessageLoader`, `ForumQuotedBody`, `QuotedForumNote` (any caption when `translate` is true; `plain` only when `via === 'nostr'`), `AboutMeSection`, `HiddenNotesScreen`, `FundingApplicationDetailScreen`, and `FundingApplyScreen` (apply walk, shown while applications are paused only for a verified account named `joey-rosima`, `vincent`, or `jewel-bacolbas` with status `none` or `rejected`, and, when the switch is off, for a verified account with status `none` or `rejected`).

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

- **Purpose:** Inverse of `satsToFiatAmount` on the same rate. A positive amount that rounds to 0 becomes 1 sat.
- **Inputs:** Fiat `amount`, gift `day` or null, fiat `code`.
- **Returns / side effects:** Whole sats, or null when the day or that currency is missing or zero. No I/O.
- **Used by:** `parseAmountDraft`.

## Function: parseAmountDraft

- **Purpose:** Reads a bitcoin or fiat typing draft into whole sats. Blank is empty. Fiat allows a dot or comma and at most eight fraction digits, so a unit toggle can round-trip. A positive fiat amount whose gift-day total for that currency is missing, not finite, or zero is `no-rate`. A well-formed amount on a usable total that does not become a safe sat count is `invalid`, not `no-rate`.
- **Inputs:** `unit` (`btc` or `fiat`), raw `draft`, gift `day` or null, fiat `code`.
- **Returns / side effects:** `{ kind: 'empty' }`, `{ kind: 'invalid' }`, `{ kind: 'no-rate' }`, or `{ kind: 'sats', sats }`. No I/O.
- **Used by:** `AmountEntry`, `replySatsFromDraft`, `paySatsFromDraft`, `parseForumAskAmountInUnit`, `PayLinkScreen`, `PosAmount`, `WalletSend`.

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
- **Inputs:** Raw draft, `unit`, rate or null, fiat code.
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

## Function: HabitTrackerPage

- **Purpose:** Next.js server page for `/habit-tracker` (public habit tracker). It does not read the auth store. Top-right is `HabitTrackerTopRight`. `OnboardingGate screen="welcome"` `allowGuest`. HTML `/habit-tracker` is the page, not a GET proxy. Fill `AppShell` (`align="center"`) with `ProfileChromeLeft` top-left around `MemberHabits`.
- **Inputs:** None.
- **Returns / side effects:** The habit-tracker screen inside fill AppShell.
- **Used by:** Route `/habit-tracker`.

## Function: HabitTrackerTopRight

- **Purpose:** Client boundary for the `/habit-tracker` header. **Log in** without a session and `SignedInChrome` with one. The page stays a server component.
- **Inputs:** None. Reads the auth store session.
- **Returns / side effects:** The top-right control. No request.
- **Used by:** `HabitTrackerPage`.

## Function: MemberHabits

- **Purpose:** Loads `GET /habits` and writes `POST /habits`. Renders every member's public habits, periods, and comments on the same note card as a living-room note. Internal notes render only for the owner. The owner rates every returned period of an open habit on a neutral `SegmentedControl` and posts that period's key. An archived habit keeps its rows, comments, and gift, and has no rating pill, pencil, or archive control. The owner opens edit with the pencil and archives from the card while the habit is open. Any signed-in account can comment. Comments render in `HabitComments`. Comment and delete use `SundayWritingGate` and send `Time-Zone`. Add sends `Time-Zone` and does not use that gate. Edit, log, and archive do not. A gift on someone else's comment uses the same Gift control, `ForumPaySheet`, amount rules, and Sunday zap pause as a forum reply, and sends `Time-Zone`. Continue stays disabled until `useLatestRateDayState` has settled. The sheet does not show the raw invoice. A failed reload keeps a list that was already shown and puts the error above it. The open edit stays; a rating or a comment does not discard it. A successful edit or archive closes that habit's edit and does not close a different habit's open draft. The same action is not posted again while that reload is still failing. When a later reload settles, including one that Try again started, a rating, edit, archive, comment, deletion, or the same add can be sent again. An add is not posted again while its request or the reload that confirms it is still unresolved. Try again also closes an edit or archive whose save had already reached the server when that Try again load started. A rating or a comment does not. The archive confirmation stays open until a reload releases an archive that had already reached the server when that reload started. It stays open when that post fails or that reload fails. A reload releases only actions that had already reached the server when that reload started. A second submit does not send that same body while the first request is still waiting, including after another session's list has settled. When that request finishes after the session changed, it does not reload the list and it does not mark the body as posted for the new session. When that request fails after the session changed, or the reload it started fails after the session changed, the new session does not show that error. A request is ignored when the visit changed, including when the same account comes back: it does not reload the list, it does not mark the body as posted, and it does not show an error. A gift request that finishes after the session changed does not show its invoice or its error, and the sheet closes. A session change closes an open edit, an archive confirmation, and a comment-deletion confirmation, clears the new-habit draft and unsent comments before paint, and does not show the previous account's draft or private notes. The same gift body is not posted again while that request is still waiting. A failed request can be sent again. Try again reloads that list and does not send the action again. A different session may send it. A list load already started by a session change or Try again is not replaced by that save. A reload that a save started is not replaced by another save. The full-screen error is only when nothing has loaded. Does not log invoices, addresses, notes, or comment text.
- **Inputs:** None. Reads the auth store session and account.
- **Returns / side effects:** The habit-tracker body. Posts add, edit, archive, log, comment, deleteComment, and invoice actions.
- **Used by:** `HabitTrackerPage`.

## Function: HabitComments

- **Purpose:** Public comments on one habit. An empty list says there are no comments yet. A signed-out visitor uses the header **Log in** and gets no second sign-in link. A signed-in account gets **Write a comment** and **Post** inside `SundayWritingGate`. Delete is the same inline confirm as a forum note and only when the account is at least initiator, also inside that gate, and sends `Time-Zone`. **Send Bitcoin** on someone else's comment uses `ForumPaySheet` inside the zap gate and sends `Time-Zone`. Archived habits keep this block.
- **Inputs:** The habit, the viewer account and session, the comment draft, and the pay-sheet state owned by `MemberHabits`.
- **Returns / side effects:** The comment block. Posts nothing itself; `MemberHabits` posts comment, deleteComment, and invoice.
- **Used by:** `MemberHabits`.

## Function: fetchMemberHabits

- **Purpose:** Load the public habit tracker from same-origin `GET /habits`.
- **Inputs:** `sessionToken` — bearer token, or `null` when signed out. A blank string sends no `Authorization` header.
- **Returns / side effects:** The parsed habit list. Throws `'Could not load the habit tracker. Please try again.'` when the response is not OK or the body fails the schema.
- **Used by:** `MemberHabits`.

## Function: postMemberHabit

- **Purpose:** Post a habit-tracker action to same-origin `POST /habits`.
- **Inputs:** `sessionToken` — bearer token; `body` — JSON action; `timeZone` — when true, also sends the device `Time-Zone` header.
- **Returns / side effects:** The JSON body when the response is OK. Throws the api `error` string when that field is a string, otherwise `'Could not save the habit tracker. Please try again.'`.
- **Used by:** `MemberHabits`.
