# Functions

## Function: GET

- **Purpose:** Shared export name for App Router GET handlers. Healthz uses `export function GET`; same-origin api proxies re-export unique functions as `GET` (including `/forum/messages`, `/messages/[id]/photo`, `/messages/[id]/[file]`, `/view-key/[viewKey]`, and `/push/vapid-public`). HTML `/messages` is the inbox page, not a GET proxy.
- **Inputs:** Incoming `Request` on proxy routes (plus async `params` on dynamic photo, file, and view-key); none on healthz.
- **Returns / side effects:** `Response`. Healthz is `{ status: 'ok' }` 200; proxies return the upstream api response (JSON or raw photo/video bytes).
- **Used by:** Container probes, browser/wallet same-origin calls. `GET /.well-known/nostr.json` proxies NIP-05.

## Function: OPTIONS

- **Purpose:** CORS preflight for `/.well-known/nostr.json`.
- **Inputs:** none.
- **Returns / side effects:** 204 with `Access-Control-Allow-Origin: *`.
- **Used by:** Damus NIP-05 fetch.

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

- **Purpose:** Multipart `POST /forum/messages` with `video` + optional `poster`.
- **Inputs:** session token, `{ text, video, poster? }`.
- **Returns / side effects:** `ForumMessage`.
- **Used by:** `ForumLoader` submit.

## Function: forumVideoSrc

- **Purpose:** Build the same-origin forum video path for a message from its MIME type so playback uses `.mp4`, `.webm`, or `.mov` correctly.
- **Inputs:** `messageId` string and optional `contentType` (`video/mp4` | `video/webm` | `video/quicktime` | null | undefined).
- **Returns / side effects:** `/messages/{id}/video.mp4` | `.webm` | `.mov` (defaults to `.mp4` when type is missing or unknown). No I/O.
- **Used by:** `ForumBoard` playback `src` when no local preview URL is set.

## Function: HandbookCopyLink

- **Purpose:** Client button beside a handbook heading, chapter, screen heading, or figure-card permalink. Copies `origin + pathname + #id` to the clipboard, sets `location.hash`, and flashes a check icon for 1.2s (textarea `execCommand` fallback).
- **Inputs:** `targetId` (DOM id without `#`) and `label` (interpolated into `handbook.copyLink` via `useTranslations` as `{ label }`).
- **Visible UI:** Idle `Link2` icon; copied `Check` icon. No visible "Copy link" or "Copied" text (`title` and `aria-label` keep the accessible name).
- **Returns / side effects:** A `<button type="button">`. Clipboard write; hash update. No network.
- **Used by:** `HandbookPage` (page title), `HandbookMarkdown` (every heading), `HandbookFigure`, and `HandbookSectionHeading`.

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

- **Purpose:** Renders gift KPIs (`formatBitcoin(totalSats)` + USD, no sats caption) and SVG diagrams (cumulative spend over time, by person, by month), plus loading/error/empty states. **Total spend over time** links each non-zero UTC day on the chart (not as a wrapping text list) to `/stats/{day}`. Each of **Total spend over time**, **By person**, and **By month** uses `SegmentedControl tone="gift" shell="dark"` for ₿ | USD (default ₿). Over time shows one cumulative series. Person and month rescale bar size while labels stay both units.
- **Inputs:** `stats`, `error`, `loading`, `onRetry`.
- **Returns / side effects:** React element. No network.
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

- **Purpose:** Client loader for `/stats/[day]`. Fetches `GET /gifts?day=`, date input navigates, retry on error.
- **Inputs:** `day` UTC `YYYY-MM-DD`.
- **Returns / side effects:** React element. Calls `fetchGiftDay`.
- **Used by:** `GiftDayPage`.

## Function: GiftDayTable

- **Purpose:** Table of individual gifts on one UTC day (Time, Recipient, ₿, USD), or empty copy.
- **Inputs:** `day: GiftDay`.
- **Returns / side effects:** React element. No network.
- **Used by:** `DayLoader`.

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

- **Purpose:** Next.js page for `/`. Marketing landing: pitch, how it works, why, FAQ, CTAs to `/login` (**Ask for help**) and `/donate` (**Send help**), plus `PwaInstall` (`tone="dark"` `placement="hero"`) after Send help, all via `translate` for the negotiated locale.
- **Inputs:** None. Calls `getRequestLocale()`.
- **Returns / side effects:** The home screen element.
- **Used by:** Route `/`.

## Function: LanguageSwitcher

- **Purpose:** Custom language listbox (not a native `<select>`) that persists the visitor's override in a `locale` cookie and refreshes the App Router tree.
- **Inputs:** `tone` (`dark` for marketing chrome, `light` for login, donate, and rules) and optional `embedded` when shown inside the signed-in Menu dropdown. Reads current locale via `useTranslations`.
- **Returns / side effects:** Standalone combobox + absolute popover listbox, or an embedded Menu-row disclosure (collapsed by default: Globe + Language + chevron; expands in flow under the trigger with endonym rows). Endonym option labels (English/Deutsch/Español/Filipino). On a new locale writes `locale=<code>; Path=/; Max-Age=31536000; SameSite=Lax` and `; Secure` on HTTPS, then `router.refresh()`. Same-locale click is a no-op (no cookie write, no refresh). Never set on first visit.
- **Used by:** `MarketingHeader` (always visible), `/login`, `/donate`, `/rules`, and the signed-in Menu in `SignedInChrome`.

## Function: NameForm

- **Purpose:** Logged-in form to set or edit a display name. Onboarding (`variant="onboarding"`): field at the top, **Continue** and labeled **Skip** at the bottom. Profile / overlay: icon-only actions (no Skip). Optional `onSaved` after a successful save.
- **Inputs:** Reads `useAuthStore`. User input: name string. Visitor-facing copy via `useTranslations`. Empty and request failures are typed keys so they re-render after a locale change.
- **Returns / side effects:** React element or `null` when logged out. POST `/me/name` on save; POST `/me/setup/skip` on Skip. Merges `name`, `setup`, and `missing`.
- **Used by:** `NameSetup` on `/setup/name`, `ProfileScreen` on `/profile`, and `RequirementsOverlay`.

## Function: LightningAddressForm

- **Purpose:** Logged-in form to link, edit, or unlink a Wallet of Satoshi address. Onboarding (`variant="onboarding"`): field at the top, **Continue** and labeled **Skip** at the bottom. Profile: icon-only actions (no Skip).
- **Inputs:** Reads `useAuthStore`. User input: address string. Visitor-facing copy via `useTranslations`. Empty, not-found, request, and `notZap` failures are typed keys (`la.errorEmpty`, `la.errorNotFound`, `la.errorRequest`, `la.errorNotZap`) so they re-render after a locale change. After `notZap`, Continue/Save stays disabled while the trimmed draft equals the blocked address; changing the draft clears the alert and re-enables; restoring the blocked address re-locks. Inline alerts (`empty` / `notFound` / `request` / `notZap`) are not separate screen variants.
- **Returns / side effects:** React element or `null` when logged out. POST `/me/lightning-address` on save; POST `/me/setup/skip` on Skip. Merges address fields plus `setup` and `missing`.
- **Used by:** `AddressSetup` on `/setup/address` and `ProfileScreen` on `/profile`.

## Function: LocaleProvider

- **Purpose:** Client context provider that exposes the negotiated locale and a bound `t` helper to visitor-facing components.
- **Inputs:** `locale`, `messages` for that locale, and `children`.
- **Returns / side effects:** React provider element. No network; does not write cookies.
- **Used by:** `RootLayout` wraps every page; consumed via `useTranslations` (see that function).

## Function: InAppBrowserView

- **Purpose:** Shared escape UI when a passkey ceremony cannot run inside Telegram or another in-app browser: heading **Open this page in your browser**, body copy, optional iOS hint, **Open in browser**, and **Copy link**.
- **Inputs:** None. Uses `useTranslations`, `openInSystemBrowser`, and `origin + pathname` as the URL to open or copy (so on `/view/<key>` the invite URL is used).
- **Returns / side effects:** Fragment with the escape controls. No WebAuthn. Clipboard via `execCommand('copy')` fallback then `navigator.clipboard`.
- **Used by:** `LoginCard` (in-app / unsupported branch) and `ViewProfileClaim` (same branch under the public view card).

## Function: LoginCard

- **Purpose:** Login UI: one **Log in** button (existing login, or create when the browser has none), preparing, error, or an in-app browser escape card via `InAppBrowserView` (**Open in browser** + **Copy link**, no passkey ceremony). After success, `OnboardingGate` leaves `/login`.
- **Inputs:** Uses `usePasskeyLogin`, `useAuthStore`, `isInAppBrowser`, and `InAppBrowserView`.
- **Returns / side effects:** React element covering idle/starting/error/in-app. A signed-in account shows the preparing spinner until redirect. Detects in-app browsers after mount; never starts WebAuthn from the in-app card.
- **Used by:** Screen `/login`.

## Function: LoginPage

- **Purpose:** Next.js page for `/login`. The visible heading lives in `LoginCard` (`login.heading`).
- **Inputs:** None.
- **Returns / side effects:** `AppShell` with `Wordmark` top-left and `ThemeSwitcher` plus `LanguageSwitcher` top-right, wrapping `OnboardingGate` around `LoginCard`. Signed-in visitors are sent to `/setup/name`, `/setup/address`, `/setup/rules`, or `/welcome`.
- **Used by:** Route `/login`.

## Function: DonatePage

- **Purpose:** Next.js page for `/donate`. Guest-visible Send help explainer: pick a forum message, then send Bitcoin; CTA to `/welcome`. No address/amount form and no QR.
- **Inputs:** None. Calls `getRequestLocale()` for localized copy.
- **Returns / side effects:** `AppShell` with `Wordmark` top-left and `ThemeSwitcher` plus `LanguageSwitcher` top-right; heading, lead, **Open the forum** `ButtonLink`. No OnboardingGate.
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
- **Returns / side effects:** Full-width Menu-row icon+text button (same row chrome as Language). Best-effort `disablePush` (unsubscribe) while the session token is still valid, then clears the session and `router.replace('/login')`; a `disablePush` failure does not block log out.
- **Used by:** `SignedInChrome` Menu dropdown.

## Function: NameSetup

- **Purpose:** First post-login screen: display name form.
- **Inputs:** None besides `NameForm` store reads.
- **Returns / side effects:** Heading **Your name** at the top and `NameForm` (`variant="onboarding"`) with **Continue** at the bottom of the screen. No `LogoutButton`.
- **Used by:** Screen `/setup/name`.

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

- **Purpose:** Hydrates the session and sends the visitor to the matching post-login screen (or keeps a complete account on `/profile` and `/members/[accountId]`).
- **Inputs:** `screen` (`login` / `name` / `address` / `rules` / `welcome` / `profile`) and `children`. Members use `screen="profile"`.
- **Returns / side effects:** Children on the correct screen, otherwise a spinner. `router.replace` to `/login`, `/setup/name`, `/setup/address`, `/setup/rules`, or `/welcome` (`nextOnboardingPath` never returns `/profile`). Profile and members still require `next === '/welcome'`.
- **Used by:** Screens `/login`, `/setup/name`, `/setup/address`, `/setup/rules`, `/welcome`, `/profile`, `/members/[accountId]`, `/contact`, `/messages`.

## Function: SignedInChrome

- **Purpose:** Top-right signed-in chrome: one **Menu** control; open it for icon+label dropdown rows (User Profile with same-line given/received `ArrowUpRight`/`ArrowDownLeft` amounts; ScrollText Living room rules `/rules`; Inbox `/messages`; MessageCircle Contact `/contact`; optional Download **Install app** via `PwaInstall` `placement="menu"` when install is offered; Globe Language; embedded ThemeSwitcher System / Light / Dark next to Language; LogOut log out).
- **Inputs:** None. Composes `useAccountTotals`, `PwaInstall` (`placement="menu"`, closes Menu via `onMenuAction`), `LanguageSwitcher` (`tone="light"`, `embedded`), `ThemeSwitcher` (`embedded`; app tokens, not a hardcoded marketing `tone="dark"`), and `LogoutButton` inside the Menu dropdown.
- **Returns / side effects:** Relative **Menu** button (`aria-expanded`, `aria-controls`) for an `AppShell` / absolute parent slot; when open, a disclosure panel of icon+label rows: Profile link (`/profile`) with same-line given/received totals (`aria-label`/`title` from `profile.given` / `profile.received`), **Living room rules** (`/rules`), **Messages** (`/messages`, `nav.inbox`), **Contact** (`/contact`), optional **Install app**, embedded Language disclosure (collapsed until clicked), embedded ThemeSwitcher (System / Light / Dark; collapsed until clicked), and log out. Escape closes Menu and restores focus to Menu unless a nested listbox (language or theme) is expanded.
- **Used by:** `NameSetupPage`, `AddressSetupPage`, `RulesSetupPage`, `WelcomePage`, `ProfilePage`, `ContactPage`, `MessagesPage`.

## Function: ProfilePage

- **Purpose:** Next.js page for `/profile`.
- **Inputs:** None.
- **Returns / side effects:** `AppShell` with `ProfileChromeLeft` top-left, `SignedInChrome` top-right, and `OnboardingGate` around `ProfileScreen`.
- **Used by:** Route `/profile`.

## Function: ProfileChromeLeft

- **Purpose:** `/profile` top-left chrome: icon-only forum back (44px link, ArrowLeft) plus `Wordmark` to `/welcome`.
- **Inputs:** Catalog `profile.back` via `useTranslations`.
- **Returns / side effects:** A link (`aria-label` from `profile.back`) and a wordmark link. No network.
- **Used by:** `ProfilePage` (`AppShell` `topLeft`).

## Function: ProfileScreen

- **Purpose:** Signed-in profile: single `max-w-sm` identity card with a compact Given/Received activity chart, name and Wallet of Satoshi address forms, an icon-only Web Push bell (`PushToggle`), and an icon-only view-key copy (the key and URL are not displayed). Never shows `forum.loading` on the card. Menu icon+amount totals stay in `SignedInChrome`. Back + wordmark live in `ProfileChromeLeft`.
- **Inputs:** `useAccountTotals` for `receiveOverTime`; `NameForm` and `LightningAddressForm` for edits; `PushToggle`; `AccountActivityChart`; `account.viewKey` from `useAuthStore`; catalog via `useTranslations`.
- **Returns / side effects:** Heading **Profile**, compact chart (empty: `profile.chartEmpty` with no SVG/toggle; otherwise legend + ₿ | USD + SVG), name form, address form, push bell under the address form, and icon-only view-key copy (hidden when account is null; key/URL not displayed) — all inside one identity card (no second panel). Back + wordmark live in `ProfileChromeLeft`.
- **Used by:** `ProfilePage`.

## Function: PushToggle

- **Purpose:** Icon-only Bell control to enable or disable Web Push for the signed-in member. Renders nothing without a session or when `serviceWorker` / `PushManager` are missing. On iPhone Safari outside standalone, shows `profile.push.installHint` above the button.
- **Inputs:** Session from `useAuthStore`; catalog via `useTranslations`; `enablePush` / `disablePush` / `isIosSafari` / `isStandaloneDisplay`.
- **Returns / side effects:** Icon-only button named from `profile.push.enable` or `profile.push.disable` (`aria-pressed` when subscribed). User gesture calls enable/disable; may show `profile.push.unavailable` on failure.
- **Used by:** `ProfileScreen`.

## Function: vapidPublicKeyToBytes

- **Purpose:** Decode a VAPID application server public key (url-safe base64) to bytes for `pushManager.subscribe`.
- **Inputs:** Url-safe base64 public key string.
- **Returns / side effects:** `Uint8Array`. No network.
- **Used by:** `enablePush`.

## Function: registerPushWorker

- **Purpose:** Register the push-only service worker at `/sw.js` (scope `/`) and wait until ready.
- **Inputs:** None (uses `navigator.serviceWorker`).
- **Returns / side effects:** `ServiceWorkerRegistration`.
- **Used by:** `enablePush`, `disablePush`.

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

- **Purpose:** Register the worker, fetch the VAPID key, request notification permission, subscribe, and POST the subscription to the api.
- **Inputs:** `sessionToken`.
- **Returns / side effects:** `void`. Throws `Notification permission denied` or `Push is not configured` (and other api errors).
- **Used by:** `PushToggle`.

## Function: disablePush

- **Purpose:** When a local push subscription exists, DELETE its endpoint on the api then `unsubscribe()` locally.
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
- **Used by:** `enablePush`.

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

- **Purpose:** Compact dual-line cumulative SVG of Given and Received with a ₿ | USD `SegmentedControl tone="gift"` (catalog `profile.scaleSat` = `₿`) and a visible legend (no title heading; page heading is **Profile**). Wrapper `role="group"` uses `profile.chartTitle` as `aria-label`. When the series is empty or all zeros, the SVG and toggle are omitted and `profile.chartEmpty` is shown (`role="status"`). v1 Given defaults to zeros on the received days.
- **Inputs:** `received` (`GiftStats.spendOverTime`); optional `donated` (default `[]`).
- **Returns / side effects:** When the series is empty or all zeros, only `profile.chartEmpty` (`role="status"`) — no legend, toggle, or SVG. Otherwise one chrome row (legend left, ₿ | USD right) and SVG. Client state for scale only. No network.
- **Used by:** `ProfileScreen`, `ViewProfileScreen`.

## Function: Button

- **Purpose:** Labeled app button with primary (filled), secondary (bordered), or accent fill. Optional `tone` `app` (default) or `dark` for marketing-ink shells (same class split as `ButtonLink`). Size `sm` / `md` / `lg` (`lg` is full width). All sizes `min-h-11`.
- **Inputs:** Native button props plus optional `variant` (default `primary`), optional `size` (default `md`), optional `tone` (default `app`), optional leading `icon`, and `children` label. Default `type="button"`.
- **Returns / side effects:** A `<button>` element. No network. Used across login, forum retry, public note retry, PWA install on dark shells, and forms.
- **Used by:** `PublicMessageLoader`, `LightningAddressForm`, `ForumBoard`, `PwaInstall`, setup and contact screens.

## Function: ButtonLink

- **Purpose:** Labeled pill link matching `Button` anatomy (`primary` / `secondary` / `accent`, `sm` / `md` / `lg`, `tone` `app` or `dark`).
- **Inputs:** `href`, optional `variant` / `size` / `tone` / `icon` / `className`, `children` label.
- **Returns / side effects:** A Next.js `<Link>` for path hrefs, or a native `<a>` for protocol hrefs (`walletofsatoshi:`, `https:`). No network. Used on marketing CTAs, donate **Open the forum**, 404 **Back home**, rules nav, and the forum pay-sheet wallet link.
- **Used by:** `Home`, `MarketingHeader`, `DonatePage`, `NotFound`, `RulesDocument`, `ForumBoard`.

## Function: SegmentedControl

- **Purpose:** Mutually exclusive option group with `tone` `gift` (compact ₿|USD cells, optional `shell` `app`/`dark`) or `neutral` (full-width forum pills). Gift hit target is `min-h-11 min-w-11` on mobile and desktop. `shell` is ignored for `neutral`.
- **Inputs:** `value`, `options` (`value` + `label`), `onChange`, `ariaLabel`, `tone`, optional `shell` (default `app`, gift only), optional `className`.
- **Returns / side effects:** A `role="group"` track of `type="button"` options with `aria-pressed`. No network.
- **Used by:** `ForumBoard` (`tone="neutral"`), `AccountActivityChart` (`tone="gift"`), `StatsDashboard` (`tone="gift" shell="dark"`).

## Function: IconButton

- **Purpose:** Icon-only control with a required `aria-label`, variant (`primary` / `secondary` / `ghost`), and size (`sm` / `md` / `lg`). `sm` is 24px paint with a 44px `::before` hit slop; `md` is 44px; `lg` is 48px.
- **Inputs:** Native button props; `aria-label` is required for accessible naming. Default `variant="secondary"`, `size="md"`, `type="button"`.
- **Returns / side effects:** A `<button>` wrapping the icon child. No network. Used for attach/post/pay/copy/dismiss controls on the forum board.
- **Used by:** `ForumBoard`, `LightningAddressForm`, `InboxScreen`, `HandbookImageViewer`, `HandbookLightbox`, `ContactScreen`, `NameForm`, `RulesSetup`.

## Function: Card

- **Purpose:** Primary app content panel using semantic card tokens (`bg-app-card`, border, shadow) with optional max-width (`sm` / `md` / `xl`).
- **Inputs:** `children`, optional `className`, optional `maxWidth` (default `sm`).
- **Returns / side effects:** A `<section>` wrapper. No network. Shared shell for login, public note, and profile-style panels.
- **Used by:** `PublicMessageLoader`, `LoginCard`, profile and setup screens.

## Function: Field

- **Purpose:** Labeled text input or textarea using shared app field tokens; id is generated from the label when omitted.
- **Inputs:** `label`, optional `id` / `className`, `multiline` (textarea when true), plus native input or textarea attributes.
- **Returns / side effects:** A `<label>` wrapping an `<input>` or `<textarea>`. No network.
- **Used by:** `ForumBoard`.

## Function: APP_HEIGHT_BOOTSTRAP_SCRIPT

- **Purpose:** Blocking bootstrap IIFE string injected as a raw head script before paint. Sets `--app-height` from `visualViewport.height` (fallback `innerHeight`) so first paint matches the visible viewport.
- **Inputs:** None (constant string).
- **Returns / side effects:** Non-empty IIFE source mentioning `visualViewport` and `--app-height`.
- **Used by:** `RootLayout` `<head>` script.

## Function: useAppHeight

- **Purpose:** After hydration, keeps the CSS custom property `--app-height` in sync with the visible viewport (`visualViewport.height`, fallback `innerHeight`) so `AppShell` fill/flow layouts track mobile browser chrome and keyboard overlap.
- **Inputs:** None (reads `window.visualViewport` / `innerHeight` inside a `useEffect`).
- **Returns / side effects:** `void`. Sets `--app-height` on `document.documentElement` and registers resize/scroll/orientation listeners; cleans them up on unmount.
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

- **Purpose:** App page shell driven by `--app-height`: `fill` locks height with header / scroll / footer slots; `flow` uses min-height and document scroll. Prefer this over Tailwind viewport-height utilities on app routes.
- **Inputs:** `children`, required `mode` (`fill` | `flow`), optional `topLeft` / `topRight`, optional `className`, optional `align` (`start` | `center`, fill only).
- **Returns / side effects:** A `<main>` layout with absolute chrome slots and optional header/footer portals. No network.
- **Used by:**
  - **Fill app routes** (`LoginPage`, `DonatePage`, setup, profile, contact, view, members, inbox, public note)
  - **`PageChrome`** (flow-mode wrapper used by welcome and public rules)
  - **`AppShellHeader` / `AppShellFooter` / `AppShellTopLeft`** slot registrars

## Function: AppShellHeader

- **Purpose:** Registers flex-none header content into the nearest `AppShell` fill layout (DOM portal into the shell `<header>` host). Without an `AppShell` ancestor, renders children inline.
- **Inputs:** `children` (typically an onboarding `h1`).
- **Returns / side effects:** Portal into the shell header host when present; otherwise the children. Layout only.
- **Used by:**
  - **`NameSetup`**
  - **`AddressSetup`**
  - **`RulesSetup`**

## Function: AppShellFooter

- **Purpose:** Registers flex-none footer content (CTAs) into the nearest `AppShell` fill layout (DOM portal into the shell `<footer>` host; `pb-8` on that host). Without an `AppShell` ancestor, renders children inline.
- **Inputs:** `children` (typically Continue / Skip / Agree buttons).
- **Returns / side effects:** Portal into the shell footer host when present; otherwise the children. Layout only.
- **Used by:**
  - **`NameForm`** (onboarding)
  - **`LightningAddressForm`** (onboarding)
  - **`RulesSetup`**

## Function: AppShellTopLeft

- **Purpose:** Registers absolute top-left chrome into the nearest `AppShell` via DOM portal; child registration wins over the page `topLeft` prop. Without an `AppShell` ancestor, renders children inline.
- **Inputs:** `children` (back control + wordmark, etc.).
- **Returns / side effects:** Portal into the shell top-left host when present; otherwise the children. Layout only.
- **Used by:**
  - **`RulesSetup`** (chapter back + wordmark)
  - **`AppShell` unit tests** (child portal wins over the page `topLeft` prop)

## Function: PageChrome

- **Purpose:** Flow-mode wrapper around `AppShell` with optional absolute top-left (wordmark) and top-right (menu / language / theme) slots. Prefer `AppShell` directly on app routes.
- **Inputs:** `children`, optional `topLeft`, optional `topRight`, optional `className` on the outer `<main>`.
- **Returns / side effects:** Layout only (`AppShell mode="flow"`). No network.
- **Used by:** Flow app routes (`WelcomePage`, `RulesPage`) plus unit tests and the `ui` barrel. Fill routes use `AppShell` directly.

## Function: Wordmark

- **Purpose:** Text brand mark `21.gifts` (header 17px/700, footer 15px/700). Link when `href` is set; otherwise a `<span>` (marketing footer).
- **Inputs:** optional `href`, optional `tone` (`app` / `dark`), optional `size` (`header` / `footer`, default `header`), optional `className`.
- **Returns / side effects:** A Next.js `<Link>` or `<span>`. No network.
- **Used by:** `MarketingHeader`, `MarketingFooter`, `ProfileChromeLeft`, `RulesSetup`, setup name/address pages, and `AppShell` top-left.

## Function: PublicMessagePage

- **Purpose:** Next.js page for `/messages/[id]` — public read-only HTML note by UUID. No `OnboardingGate`, no pay, no composer.
- **Inputs:** Dynamic route params (`id`).
- **Returns / side effects:** Fill `AppShell` (`align="center"`) with Wordmark top-left and ThemeSwitcher + light `LanguageSwitcher` top-right; body is `PublicMessageLoader`.
- **Used by:** Route `/messages/[id]`.

## Function: PublicMessageLoader

- **Purpose:** Client loader for the public note page: validates UUID, fetches via `fetchPublicMessage` / `fetchPublicMessagePhoto`, shows missing/error/retry/loading, and a Log in or Back to the forum link from `useHydrateSession`.
- **Inputs:** `id` string from the route.
- **Returns / side effects:** States loading / missing / error (with **Try again**) / ready `Card`. Malformed UUID → missing without an api call. Photo blob URLs revoked on unmount or id change. Inline `<video>` keeps the clip aspect ratio (`max-h-80 max-w-full`, no full-width black canvas). A failed `<video>` `error` event hides the player and falls back to the photo when present. No pay or composer.
- **Used by:** `PublicMessagePage`.

## Function: ViewProfilePage

- **Purpose:** Next.js page for `/view/[viewKey]` — public read-only profile by view key. No `OnboardingGate`, no `SignedInChrome`.
- **Inputs:** Dynamic route params (`viewKey`).
- **Returns / side effects:** Exports `metadata.referrer = 'no-referrer'`. `AppShell` with `Wordmark` → `/` top-left and `ThemeSwitcher` plus light `LanguageSwitcher` top-right; body is `ViewProfileLoader`.
- **Used by:** Route `/view/[viewKey]`.

## Function: ViewProfileLoader

- **Purpose:** Client loader for the public view page: validates the key, fetches the public profile, then (if address set) filtered gift stats for `spendOverTime`. Does not use `useAuthStore`.
- **Inputs:** `viewKey` string from the route.
- **Returns / side effects:** States loading / missing / error (with **Try again**) / ready card. In **ready**, renders `ViewProfileScreen` plus `ViewProfileClaim` under the card (passes `viewKey` and `hasPasskey` from the fetched profile). Malformed keys (not 64 lowercase hex) → missing without an api call. After profile: if address blank → `received=[]` and no `fetchGiftStats`; else `fetchGiftStats(recipientHandleFromAddress(address))` and `received = stats.spendOverTime`. Stats failure still shows the card with empty series. Chart never swapped for `forum.loading`.
- **Used by:** `ViewProfilePage`.

## Function: ViewProfileScreen

- **Purpose:** Presentational read-only identity card matching signed-in profile chrome: heading Profile, `AccountActivityChart`, name and address rows (labels `name.heading` / `la.heading`) without action buttons.
- **Inputs:** `{ profile, received }` (`GiftStats['spendOverTime']`).
- **Returns / side effects:** No menu, logout, back, ViewKeyCopy, or edit forms. Language switcher lives on the page, not in this card.
- **Used by:** `ViewProfileLoader`.

## Function: ViewProfileClaim

- **Purpose:** Public passkey claim control under the `/view/[viewKey]` card. Unclaimed invites (`hasPasskey` false) bind a passkey to the existing profile (name + Wallet of Satoshi already set), including when another 21.gifts session is already signed in.
- **Inputs:** `viewKey` (64 lowercase hex) and `hasPasskey` from the public profile. Uses `usePasskeyLogin`, `useAuthStore`, `useRouter`, `isInAppBrowser`, and `InAppBrowserView`.
- **Returns / side effects:** Waits for `useHydrateSession` `ready`. Claimed (`hasPasskey` true) → `null` (even in Telegram, even if signed in). In-app on mount or `unsupported` → same card chrome as login wrapping `InAppBrowserView` (no yellow **Activate**). Else in a real browser: yellow banner with `view.activationRequired` and **Activate** (`view.activate`) even when `account !== null`; click sets a claim-attempted flag, `cancel` + `clearAuth` when a session exists, then `register(viewKey)` (stays on the view page). Success → `router.replace(nextOnboardingPath(account))` only when that claim was attempted (pre-existing sessions do not redirect on mount). 409 → `view.alreadyClaimed` plus Fingerprint that calls `authenticate()`; after that attempt the yellow **Activate** banner does not return (successful login hides the control; a dismissed prompt keeps the already-claimed copy). Other errors / starting stay visible even with a session → `view.claimError` + **Try again** (`view.retry`) or spinner.
- **Used by:** `ViewProfileLoader` (ready state only).

## Function: ViewKeyCopy

- **Purpose:** Icon-only copy control for the signed-in profile view-key link (`origin + /view/ + viewKey`); the URL and key are not rendered next to it. Clipboard API with textarea/`execCommand` fallback; flashes a check icon for ~1200ms.
- **Inputs:** `viewKey` (64 lowercase hex).
- **Returns / side effects:** Button named from `profile.viewKeyCopy`; `data-copied="true"` while flashed. Does not log the key. Follows semantic app tokens (same as signed-in profile chrome), not hardcoded light-only neutrals.
- **Used by:** `ProfileScreen`.

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

## Function: accountTotals

- **Purpose:** Derives given/received sat totals for the signed-in account from public gift stats.
- **Inputs:** `GiftStats` and the Lightning Address (or null).
- **Returns / side effects:** `{ donatedSats, receivedSats }` — given is always `0` in v1; received matches the address handle against `byRecipient` case-insensitively.
- **Used by:** `useAccountTotals`.

## Function: alignActivitySeries

- **Purpose:** Align receive and donate cumulative `spendOverTime` series onto one sorted UTC-day axis for the profile chart.
- **Inputs:** `received` and `donated` arrays from `GiftStats.spendOverTime`.
- **Returns / side effects:** `ActivityPoint[]`. Empty+empty → `[]`. Empty donated → zero Given on each received day. Non-empty both → day union with step-hold carry-forward.
- **Used by:** `AccountActivityChart`.

## Function: activityValue

- **Purpose:** Read one cumulative chart value from an aligned activity point.
- **Inputs:** `point`, `series` (`donated` | `received`), `scale` (`sat` | `usd`).
- **Returns / side effects:** Number used to place the polyline.
- **Used by:** `AccountActivityChart`, `activityMaxY`.

## Function: activityMaxY

- **Purpose:** Y-axis max for the dual-line chart: max of both series at the active scale, or `1` when empty/all zeros.
- **Inputs:** `points`, `scale`.
- **Returns / side effects:** Positive number for SVG scale.
- **Used by:** `AccountActivityChart`.

## Function: recipientHandleFromAddress

- **Purpose:** Local-part of a Lightning Address (before the first `@`).
- **Inputs:** Full address or bare handle string.
- **Returns / side effects:** The handle before `@` when `indexOf('@') > 0`, otherwise the whole string.
- **Used by:** `accountTotals`, `useAccountTotals`, `ViewProfileLoader`.

## Function: useAccountTotals

- **Purpose:** Fetches gift stats filtered by the signed-in Lightning Address handle and derives given/received sats plus the receive time series.
- **Inputs:** Reads `account.lightningAddress` from `useAuthStore`; calls `fetchGiftStats(handle)` and `accountTotals`. Skips the fetch when the address is null/blank.
- **Returns / side effects:** `{ donatedSats, receivedSats, receiveOverTime, loading }`. On each fetch start (including address change) totals and series reset to zeros/empty; `AccountActivityChart` then shows `profile.chartEmpty` (no SVG) when the series is empty. Drops stale responses when the address changes mid-flight; errors resolve to zeros and an empty series.
- **Used by:** `SignedInChrome`, `ProfileScreen`.

## Function: WelcomePage

- **Purpose:** Next.js page for `/welcome`.
- **Inputs:** None.
- **Returns / side effects:** Flow `PageChrome` (`AppShell` wrapper) with `Wordmark` top-left, `SignedInChrome` top-right, and `OnboardingGate` around `WelcomeScreen`.
- **Used by:** Route `/welcome`.

## Function: WelcomeScreen

- **Purpose:** Fourth post-login screen after name, address, and living-room rules agreement are saved. Embeds `ForumLoader` (forum list + composer) below the heading; card is `max-w-xl`.
- **Inputs:** Reads `account.name` from `useAuthStore`.
- **Returns / side effects:** Gift icon, **Welcome, {name}**, forum board. No name or address form. No donate CTA. No `LogoutButton` on the card.
- **Used by:** Screen `/welcome`.

## Function: ForumBoard

- **Purpose:** Presentational public forum: each post card body is the expand/collapse control (`forum.expand` / `forum.collapse`, `role="button"` on the card, not an `IconButton`; copy-link and PM are separate `IconButton`s that `stopPropagation`). Optional dismissible living-room laws hint box (X control; two laws plus links to `/rules` and `/contact`) when `lawsVisible`, Active/All/Most popular `SegmentedControl tone="neutral"`, list of posts (name, optional Founder / Moderator / Verified role pill when `role` is one of those three (`basis` has no pill), timestamp, optional inline photo from blob URLs then caption text below the photo, optional inline `<video>` playback for notes with video (player keeps the clip aspect ratio with `max-h-80 max-w-full`, no full-width black canvas), ₿ amount with a Gift pay icon when the note is payable) or empty/loading/error, messenger-style composer (**Add a photo or video** ImagePlus left of the textarea, **Post** Send icon to the right, optional photo draft preview with **Remove photo** X, optional video draft preview with **Remove video** X — icon-only, catalog `aria-label`s, `maxLength` 500), and pay-on-note sheet: desktop QR + Pay button with Wallet of Satoshi icon; smartphone Wallet of Satoshi deep link only (`isSmartphoneUserAgent`, no QR); top-left back control cancels. Clicking a role pill toggles a short explanation under that card header (one open at a time). Selector stays visible in every board state. Uses `forum.empty` when the loaded list is empty and `forum.emptyPaid` when loaded rows exist but the selected mode hides them all. Props `messages` are newest-first (API window); Active and All reverse the filtered list so oldest is at the top and newest at the bottom above the composer. Most popular keeps sats-descending order. Messenger-group thread, not a social feed. When `onRefresh` is passed, pull-to-refresh from the top of the page calls it; while `refreshing` (or a pull that reached the arm threshold) a visually hidden (`sr-only`) `role="status"` with `forum.refreshing` is mounted for assistive tech only — idle markup has no status node so welcome screenshots stay unchanged.
- **Inputs:** `ForumBoardProps` — `messages`, `error` (boolean load-failure flag), `loading`, optional `refreshing` / `onRefresh` (omit `onRefresh` to disable pull-to-refresh), `posting`, `draft`, `onDraftChange`, `onPost`, `onRetry`, `formError` (`empty` / `tooLong` / `request` / `rateLimit` / `unsupported` / `tooLarge`), controlled `mode` / `onModeChange`, required `lawsVisible` / `onDismissLaws`, `photoDraft`, `videoDraft`, `onPickPhoto`, `onClearPhoto`, `photoUrls`, `videoUrls`, plus pay sheet props (`payMessageId`, `payDraft`, `payBusy`, `payError` (`amount` / `request` / `rateLimit` / `authorWallet`), `payInvoice`, `payWaiting`, `onPayOpen`, `onPayDraftChange`, `onPaySubmit`, `onPayCancel`), expand/replies (`expandedId`, `onToggleExpand`, `replies`, `repliesLoading`, `repliesError`, `onRetryReplies`, reply composer), and PM (`ownName`, `ownAccountId`, `onPm`, `pmBusyId`). PM is hidden when `message.accountId` matches `ownAccountId`; otherwise the display name is the fallback. The video-draft X still calls `onClearPhoto` (same handler as the photo-draft X).
- **Returns / side effects:** React tree. Filters via `visibleForumMessages`. Load error copy is `forum.error` via `t()`, never `Error.message`. Formats timestamps via `formatForumTime`. Hides empty text paragraphs; never points `<img src>` at `/messages/.../photo` without a blob URL. Inline feed `<video>` keeps the clip aspect ratio (`max-h-80 max-w-full`, no full-width black canvas). A failed `<video>` `error` event hides that player (photo fallback when a blob URL exists). Clicking a role pill toggles a short explanation under that card header (one open at a time). Scrolls the composer into view when the newest message id is set or changes, except while `refreshing` is true (silent refresh must not jump to the composer). Dismiss control calls `onDismissLaws` only; persistence is owned by `ForumLoader`. No fetch. No mode state of its own.
- **Used by:** `ForumLoader`.

## Function: ContactLoader

- **Purpose:** Client loader for in-app contact on `/contact`. Session from `useAuthStore`; returns null without a session. Posts via `postContact`. On success fetches conversations and navigates to `/messages` or `/messages?c=` for the official 21.gifts thread. No local success-hide of the form.
- **Inputs:** None (reads session from the auth store).
- **Returns / side effects:** React element wrapping `ContactScreen`, or `null`. Owns draft/posting/formError. Empty or whitespace drafts set `empty`; trimmed text longer than 500 characters sets `tooLong` and does not call `postContact`. After a successful post, `fetchConversations` then `router.push` to the inbox and `posting` stays true until unmount. A failed post sets `request` and clears `posting` so Send can retry.
- **Used by:** Screen `/contact`.

## Function: ContactPage

- **Purpose:** Next.js page for `/contact`.
- **Inputs:** None.
- **Returns / side effects:** `AppShell` with `Wordmark` top-left, `SignedInChrome` top-right, and `OnboardingGate` around `ContactLoader`.
- **Used by:** Route `/contact`.

## Function: ContactScreen

- **Purpose:** Presentational in-app contact: heading **Contact**, lead, link to living-room rules, and a messenger-style composer (textarea with icon-only Send `IconButton`, catalog `aria-label` `contact.send`, `maxLength` 500). Success is owned by `ContactLoader` (navigate to the inbox thread), not a local success copy.
- **Inputs:** `ContactScreenProps` — `posting`, `draft`, `onDraftChange`, `onPost`, `formError` (`empty` / `tooLong` / `request`).
- **Returns / side effects:** React element. No network.
- **Used by:** `ContactLoader`.

## Function: RulesDocument

- **Purpose:** Presentational living-room rules body from catalog keys: lead with the **The test** callout, three rule cards (`rules.lawKicker` with `{n}`, title, body, optional test callout), welcome / allowed / better-not / forbidden lists rendered as bordered cards with lucide glyphs (`Check` `text-app-fg`, `Check` muted, `Minus`, `X` `text-app-danger`), the **Our house** closing block (`rules.houseBody` + `rules.houseClosing`), and optional CTAs to `/contact` and `/welcome`.
- **Inputs:** `messages` catalog for the request locale; optional `showNav` (default `true`); optional `chapter` (`RulesChapterId`). When `chapter` is set, only that chapter is rendered and the public nav is omitted (`showNav` ignored). When `showNav` is `false` and `chapter` is omitted, the public Contact / forum nav is omitted.
- **Returns / side effects:** React element. Server component — uses `translate`, not `useTranslations`. No network.
- **Used by:** `RulesPage`, `RulesSetupPage`.

## Function: RulesPage

- **Purpose:** Next.js page for `/rules` with localized heading, theme switcher, and language switcher.
- **Inputs:** None. Calls `getRequestLocale()` for the page title and document catalog.
- **Returns / side effects:** Flow `PageChrome` (`AppShell` wrapper) with `Wordmark` top-left and `ThemeSwitcher` plus `LanguageSwitcher` top-right around the living-room rules document.
- **Used by:** Route `/rules`.

## Function: ForumLoader

- **Purpose:** Client loader for the public forum on `/welcome`. Session and account from `useAuthStore`; returns null without a session. Fetches via `fetchMessages`, loads photos via `fetchMessagePhoto` into blob URLs (effect keyed on `photoIdsKey` so payable-poll list refreshes do not cancel in-flight photo fetches), posts via `postMessage` (text and/or photo) or `postMessageVideo` (multipart clip), prepares picks via `prepareForumPhoto` / `isForumVideoFile` / `prepareForumVideo`, and owns `videoDraft` / `videoUrls` alongside photo drafts; video-only posts are allowed. Pay invoices via `postMessageInvoice` and polls sats after pay; owns Active/All/Most popular feed mode (default Active). After a successful post with `created.sats === 0`, switches mode to All so the author sees the note. Switching to a mode that hides the open pay note clears the pay sheet (same reset as Cancel). Also polls `GET /forum/messages` until the merged list is payable (8 attempts, 2s; local extras kept until GET echoes), cancelled-flag fetch like `StatsLoader`. Silently re-fetches on `visibilitychange` (hidden→visible), on `pageshow` when `persisted` is true, and when the board pull-to-refresh calls `onRefresh` — shared load path with mount/retry; silent refresh does not flip the board to the loading copy when a list already exists, keeps the list when a silent refresh fails, and does not auto-scroll the composer when a newer note arrives from refresh. Owns the living-room laws hint visibility from `account.forumLawsDismissed` and persists dismiss via `dismissForumLaws` (optimistic; applies the response or restores the previous flag only when the session token is unchanged and an account is still present). Owns expand/replies (`fetchReplies`, retry, reply composer via `postMessage` with `inReplyTo`; expand is ignored while a reply posts) and PM (`openConversation` then `/messages?c=`).
- **Inputs:** None (reads session and account from the auth store).
- **Returns / side effects:** React element wrapping `ForumBoard`, or `null`. Owns draft/photoDraft/videoDraft/photoUrls/videoUrls/posting/formError/feedMode/pay/expand/replies/PM/`refreshing` state and retry attempts. Empty text without a photo and without a video sets `empty`; trimmed text longer than 500 characters sets `tooLong` and does not call `postMessage` / `postMessageVideo`. Photo-only and video-only posts are allowed. Fetch failure sets the error flag without clearing an already-posted list; the board still shows **Try again**. A failed silent refresh with an existing list does not set the error flag. A late GET merges locally posted rows that the response does not yet contain; a POST whose id is already in the list is not prepended again. Invoice 400 author's-wallet copy maps to `authorWallet`; other invoice failures stay `request`; rate limit stays `rateLimit`. Revokes photo and video blob URLs on unmount. May POST `/me/forum-laws-dismissed`. Passes `lawsVisible` / `onDismissLaws`, `mode` / `onModeChange`, and `refreshing` / `onRefresh` to `ForumBoard`. Mode is not persisted. Does not pass `Error.message` to the board.
- **Used by:** `WelcomeScreen`.

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

- **Purpose:** Picks `/setup/name`, `/setup/address`, `/setup/rules`, or `/welcome` from `account.setup` only (1:1 map; skips advance `setup` without clearing `missing`).
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
- **Returns / side effects:** Validated `MemberProfile`, or `null` on 401/404. Throws `MissingRequirementsError` on 409. Hits `/forum/members/:id`.
- **Used by:** `MemberProfileLoader`.

## Function: parseMissingRequirements

- **Purpose:** Parses a 409 `{ error: 'missing_requirements', missing: [...] }` body.
- **Inputs:** Unknown JSON body.
- **Returns / side effects:** `MissingRequirementsError` or `null`.
- **Used by:** `fetchMessages`, `postMessage`, `postMessageVideo`, `postContact`, `fetchMember`.

## Function: MissingRequirementsError

- **Purpose:** Typed error for api 409 missing name/rules (or lightning-address) requirements.
- **Inputs:** `missing` array from the api body.
- **Returns / side effects:** Error instance with `missing` field; not shown as a generic toast.
- **Used by:** Forum and contact loaders (open `RequirementsOverlay`) and member fetch.

## Function: nextPostRequirement

- **Purpose:** Picks the next field to collect before a forum or contact post (`rules` before `name`). Lightning-address-only gaps return `null`.
- **Inputs:** `missing` array from the account or a 409 body.
- **Returns / side effects:** `'rules'`, `'name'`, or `null`. No side effects.
- **Used by:** `ForumLoader`, `ContactLoader`, `RequirementsOverlay` flow.

## Function: RequirementsOverlay

- **Purpose:** Modal to add a missing name (`NameForm` profile) or agree to rules before retrying a post. No Skip.
- **Inputs:** `requirement` (`name` | `rules`), `onDismiss`, `onSatisfied`.
- **Returns / side effects:** Dialog UI; merges account fields on success then calls `onSatisfied`.
- **Used by:** `ForumLoader`, `ContactLoader`.

## Function: MemberProfileLoader

- **Purpose:** Client loader for `/members/[accountId]`: UUID check, `fetchMember`, optional gift stats for the chart.
- **Inputs:** Route `accountId`; session from auth store.
- **Returns / side effects:** Loading / missing (`view.missing`) / error+retry / `MemberProfileScreen`. 409 → `/setup/rules`.
- **Used by:** `MemberProfilePage`.

## Function: MemberProfileScreen

- **Purpose:** Signed-in member identity card (chart, name, Lightning Address, role pill) plus optional one-item `ForumBoard` when `profileMessage` is set (`composerHidden`). Pay, PM, and expand/replies use the signed-in session; PM is hidden on the viewer's own note.
- **Inputs:** `MemberProfile` and receive series; session/account from the auth store.
- **Returns / side effects:** React tree; may `POST` invoice/conversation/replies and navigate to `/messages?c=`.
- **Used by:** `MemberProfileLoader`.

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

## Function: useHydrateSession

- **Purpose:** Rehydrates a persisted session token into the auth store.
- **Inputs:** Reads `loadSession` and calls `fetchMe`.
- **Returns / side effects:** `{ ready }`. Sets or clears auth. `ready` is false until storage/`/me` has settled so setup screens do not bounce to `/login`. Unmount invalidates in-flight work.
- **Used by:** `OnboardingGate`.

## Function: QrCode

- **Purpose:** SVG QR for a string (LNURL or bolt11).
- **Inputs:** `value` (required) and `label` (required accessible name, already translated).
- **Returns / side effects:** React element.
- **Used by:** `ForumBoard` only when the UA is not a smartphone.

## Function: RootLayout

- **Purpose:** Root HTML shell: negotiated `lang` (`en`/`de`/`es`/`fil`), global CSS, English metadata (title, icons, Open Graph, Twitter), blocking `APP_HEIGHT_BOOTSTRAP_SCRIPT` then `THEME_BOOTSTRAP_SCRIPT` in `<head>`, `suppressHydrationWarning` on `<html>`, token body classes (`bg-app-bg text-app-fg`), `AppHeightSync`, `LocaleProvider` with the request catalog, and `ThemeProvider`.
- **Inputs:** `children` React nodes. Calls `getRequestLocale()` for `html lang` and messages.
- **Returns / side effects:** The document wrapper for every route.
- **Used by:** All screens.

## Function: clearSession

- **Purpose:** Removes the bearer token from `localStorage`.
- **Inputs:** None.
- **Returns / side effects:** void. No-op during SSR (`window` undefined).
- **Used by:** `useAuthStore.clearAuth`.

## Function: fetchGiftStats

- **Purpose:** GET `/gifts/stats` (optionally `?recipient=`) and parse the public gift totals payload.
- **Inputs:** Optional `recipient` handle; appended as a query param when non-empty after trim (URL-encoded).
- **Returns / side effects:** `GiftStats`. Throws visitor copy when the api is down or the body is invalid.
- **Used by:** `StatsLoader`, `useAccountTotals`, `ViewProfileLoader`.

## Function: fetchMe

- **Purpose:** GET `/me` with the bearer session.
- **Inputs:** `sessionToken`.
- **Returns / side effects:** `Account` or `null` on 401.
- **Used by:** `useHydrateSession`.

## Function: fetchMessages

- **Purpose:** GET `/forum/messages` with the bearer session, parse `forumListSchema`, and return the messages array newest-first (including defaulted `replyCount`).
- **Inputs:** `sessionToken`.
- **Returns / side effects:** `ForumMessage[]`. Throws visitor copy (`Could not load messages. Please try again.`) on failure.
- **Used by:** `ForumLoader`.

## Function: fetchPublicMessage

- **Purpose:** GET `/public-messages/:id` without a session, parse `forumMessageSchema`, and return one public forum note for the HTML note page.
- **Inputs:** Forum message `id` (UUID string).
- **Returns / side effects:** `ForumMessage`, or `null` on 404. Throws visitor copy (`Could not load messages. Please try again.`) on other non-ok, network, or zod failures.
- **Used by:** `PublicMessageLoader`.

## Function: fetchPublicMessagePhoto

- **Purpose:** GET `/messages/:id/photo` without Authorization and return raw image bytes as a `Blob` for `URL.createObjectURL` on the public note page.
- **Inputs:** Forum message `id`.
- **Returns / side effects:** `Blob`. Throws visitor copy (`Could not load messages. Please try again.`) on non-ok, empty body, or network failure — does not leak status codes.
- **Used by:** `PublicMessageLoader`.

## Function: fetchReplies

- **Purpose:** GET `/forum/messages/:id/replies` with the bearer session, parse `forumRepliesSchema` (`{ messages }`, same key as the list endpoint), and return oldest-first replies for one note.
- **Inputs:** `sessionToken`, parent message `id`.
- **Returns / side effects:** `ForumMessage[]`. Throws visitor copy (`Could not load messages. Please try again.`) on failure. Damus authors may omit `role` (schema defaults to `basis`).
- **Used by:** `ForumLoader`.

## Function: fetchMessagePhoto

- **Purpose:** GET `/messages/:id/photo` with the bearer session and return the raw image bytes as a `Blob` for `URL.createObjectURL` rendering.
- **Inputs:** `sessionToken`, message `id`.
- **Returns / side effects:** `Blob`. Throws visitor copy (`Could not load messages. Please try again.`) on non-ok, empty body, or network failure — does not leak status codes.
- **Used by:** `ForumLoader`.

## Function: postMessage

- **Purpose:** POST `/forum/messages` with bearer + `{ text, photo?, inReplyTo? }`, parse `forumMessageSchema`, and return the created message or reply (text and/or photo).
- **Inputs:** `sessionToken`, `input` with `text`, optional `{ contentType, data }` photo, and optional `inReplyTo` parent id (thread composer only).
- **Returns / side effects:** `ForumMessage`. Omits `inReplyTo` from the JSON body when absent. On 400 or 429 uses the api error string when present; otherwise throws `Could not post your message`.
- **Used by:** `ForumLoader`.

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

- **Purpose:** Client-side resize/JPEG-encode a picked forum photo (max edge 1280, quality 0.8, max 1 MiB) into raw base64 plus a preview data URL.
- **Inputs:** `file` accepted by `isForumPhotoFile`.
- **Returns / side effects:** `{ ok: true, photo }` or `{ ok: false, error: 'unsupported' | 'tooLarge' }`. Revokes temporary object URLs it creates.
- **Used by:** `ForumLoader`.

## Function: formatBitcoin

- **Purpose:** Formats a whole-sat amount as BIP-177 ₿-only display (leading ₿, locale grouping, no fraction, no “sats” unit).
- **Inputs:** `sats` non-negative number (API `sats` / `totalSats`; chart mid-ticks may be fractional and are rounded); optional `locale` BCP-47 tag (default `en-US`).
- **Returns / side effects:** Display string such as `₿1,500` or `₿0`.
- **Used by:** `ForumBoard`, `SignedInChrome`, `AccountActivityChart`, `StatsDashboard`, `GiftDayTable`, `DayLoader`.

## Function: formatForumTime

- **Purpose:** Formats a forum message timestamp as UTC medium date + short time via `Intl.DateTimeFormat`, or returns the original ISO string when the instant is invalid.
- **Inputs:** `iso` string, `locale` BCP 47 tag.
- **Returns / side effects:** Display string. Always uses `timeZone: 'UTC'` so screenshots are host-independent.
- **Used by:** `ForumBoard`.

## Function: visibleForumMessages

- **Purpose:** Client-side filter and sort of the already-loaded forum thread for the Active / All / Most popular selector. Does not call the api; ranking is among the messages the loader already holds.
- **Inputs:** `messages` (newest-first list from the api / loader merge) and `mode` (`active` | `all` | `popular`).
- **Returns / side effects:** A new array. `all` keeps input order including unpaid (`sats === 0`) notes. `active` keeps only paid notes (`sats > 0`) in newest-first order. `popular` keeps only paid notes, ordered by sats descending, then `createdAt` descending, then `id` descending. Never mutates the input array.
- **Used by:** `ForumBoard`, `ForumLoader`.

## Function: formatUsdDisplay

- **Purpose:** Formats an API USD amount string (`"1425.00"`) as en-US currency for the stats hero.
- **Inputs:** `usd` string from `GET /gifts/stats`.
- **Returns / side effects:** Locale currency string such as `$1,425.00`.
- **Used by:** `StatsDashboard`.

## Function: formatUsdTick

- **Purpose:** Formats a parsed USD chart-axis value as a grouped dollar label.
- **Inputs:** `usd` number (layout scale only).
- **Returns / side effects:** Label such as `$1,234`.
- **Used by:** `StatsDashboard` USD-over-time chart, `AccountActivityChart` USD scale.

## Function: ThemeProvider

- **Purpose:** Client provider that reads the `theme` cookie and OS `prefers-color-scheme`, exposes preference / resolved theme, and keeps `html.dark` in sync after hydration (does not wipe the bootstrap class on the first paint).
- **Inputs:** React `children`.
- **Returns / side effects:** Context value with `preference`, `resolved`, `setPreference`. Writing `light`/`dark` sets the cookie (`Path=/`, `Max-Age=31536000`, `SameSite=Lax`, `Secure` on https); `system` deletes it. Listens to `matchMedia` while preference is `system`.
- **Used by:** `RootLayout` (wraps the app), `ThemeSwitcher`, `useTheme`.

## Function: ThemeSwitcher

- **Purpose:** System / Light / Dark control using semantic app tokens. Standalone compact pill on unsigned app pages; `embedded` Menu-row disclosure beside language when signed in.
- **Inputs:** Optional `embedded` boolean.
- **Returns / side effects:** Listbox UI; selecting an option calls `setPreference`.
- **Used by:** `/login`, `/donate`, `/rules`, `SignedInChrome`.

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
- **Used by:** `useHydrateSession` on mount.

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

## Function: setName

- **Purpose:** POST `/me/name`.
- **Inputs:** `sessionToken`, `name`.
- **Returns / side effects:** Updated `Account`.
- **Used by:** `NameForm`.

## Function: dismissForumLaws

- **Purpose:** POST `/me/forum-laws-dismissed` to permanently dismiss the welcome-forum living-room laws hint.
- **Inputs:** `sessionToken`.
- **Returns / side effects:** Updated `Account` with `forumLawsDismissed: true`. No request body.
- **Used by:** `ForumLoader`.

## Function: agreeToRules

- **Purpose:** POST `/me/rules-agreement` with Bearer and no JSON body.
- **Inputs:** `sessionToken`.
- **Returns / side effects:** Updated `Account` with `rulesAgreedAt` set. Throws `'Could not save your agreement'` on a non-ok response.
- **Used by:** `RulesSetup`.

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

- **Purpose:** Zustand store for `session` + `account`. Hydration is explicit (no module-init `localStorage`).
- **Inputs:** Hook. Methods `setAuth`, `setAccount`, `clearAuth`.
- **Returns / side effects:** Auth state object.
- **Used by:** `LoginCard`, `OnboardingGate`, `NameSetup`, `AddressSetup`, `RulesSetup`, `WelcomeScreen`, `LogoutButton`, `useHydrateSession`, `usePasskeyLogin`, `NameForm`, `LightningAddressForm`.

## Function: useTranslations

- **Purpose:** Client hook returning `{ locale, t }` from the nearest `LocaleProvider`.
- **Inputs:** None (React context).
- **Returns / side effects:** Active locale and a `t(key, vars?)` bound to that catalog. Throws if used outside `LocaleProvider`.
- **Used by:** `MarketingHeader`, `LanguageSwitcher`, `LoginCard`, `LightningAddressForm`, `ForumBoard`, `NameForm`, `HandbookCopyLink`, `NameSetup`, `AddressSetup`, `RulesSetup`, `WelcomeScreen`, `LogoutButton`.

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

- **Purpose:** Shared App Router DELETE export name. `/me/lightning-address` re-exports `proxyMeLightningAddressDelete`; `/me/push-subscriptions` re-exports `proxyMePushSubscriptionsDelete`.
- **Inputs:** Incoming `Request`.
- **Returns / side effects:** Upstream api `Response`.
- **Used by:** Same-origin `unlinkLightningAddress` and `deletePushSubscription` / `disablePush`.

## Function: LegalPage

- **Purpose:** Next.js page for `/legal` (imprint and privacy). No published email — contact is in-app via `/contact`.
- **Inputs:** None.
- **Returns / side effects:** The legal screen with links to `/contact`.
- **Used by:** Route `/legal`.

## Function: MarketingFooter

- **Purpose:** Footer for marketing pages: wordmark, localized section links, legal, living-room rules, GitHub.
- **Inputs:** None. Resolves locale via `getRequestLocale` and reads copy from the catalog via `translate`.
- **Returns / side effects:** Footer element.
- **Used by:** `MarketingLayout`, `NotFound`.

## Function: MarketingHeader

- **Purpose:** Sticky marketing header with wordmark, section nav, optional `PwaInstall` (`tone="dark"` `placement="header"`) next to Log in (desktop and open mobile nav), always-visible `LanguageSwitcher` (`tone="dark"`), login CTA, and mobile menu.
- **Inputs:** None (internal open state). Reads copy via `useTranslations`.
- **Returns / side effects:** Header element; toggles nav on small screens. Language select stays visible when the hamburger is closed. Install control stays `null` until after mount when an offer applies.
- **Used by:** `MarketingLayout`, `NotFound`.

## Function: MarketingLayout

- **Purpose:** Async dark full-page shell for `/`, `/legal`, `/handbook`, and `/stats`.
- **Inputs:** `children`. Awaits `MarketingFooter()` (does not render it as a JSX child).
- **Returns / side effects:** Wrapper div with header, page, and awaited footer.
- **Used by:** Marketing route group.

## Function: NotFound

- **Purpose:** Async app-wide 404 screen with marketing chrome and a localized link home.
- **Inputs:** None. Calls `getRequestLocale()` for body/back-link copy; awaits `MarketingFooter()`.
- **Returns / side effects:** 404 element with `MarketingHeader` and awaited footer (not rendered as JSX child).
- **Used by:** Next.js `not-found.tsx`.

## Function: POST

- **Purpose:** Shared App Router POST export name. `/me/name` re-exports `proxyMeNamePost`; `/me/forum-laws-dismissed` re-exports `proxyMeForumLawsDismissedPost`; `/me/rules-agreement` re-exports `proxyMeRulesAgreementPost`; `/me/lightning-address` re-exports `proxyMeLightningAddressPost`; `/me/push-subscriptions` re-exports `proxyMePushSubscriptionsPost`; `/auth/passkey/{register,authenticate}/{begin,finish}` re-export the four passkey proxy POSTs; `/forum/messages` re-exports `proxyMessagesPost`; `/messages/[id]/invoice` re-exports `proxyMessagesInvoicePost`; `/conversations` re-exports `proxyConversationsPost`; `/conversations/[id]` re-exports `proxyConversationPost`; `/contact/submit` re-exports `proxyContactPost`. HTML `/messages` is the inbox page, not a POST proxy.
- **Inputs:** Incoming `Request`.
- **Returns / side effects:** Upstream api `Response`.
- **Used by:** Same-origin name save, forum laws dismiss, living-room rules agreement (`POST /me/rules-agreement`), address link, Web Push subscribe (`POST /me/push-subscriptions`), passkey begin/finish, forum message create (`POST /forum/messages`), pay-on-note (`POST /messages/[id]/invoice`), inbox open (`POST /conversations`) and reply (`POST /conversations/[id]`), and in-app contact (`POST /contact/submit`).

## Function: proxyApiRequest

- **Purpose:** Forwards an App Router request to `getApiUrl()` + path. Copies query, authorization / content-type / content-length / user-agent / origin / range headers, streams POST/PUT/PATCH/DELETE bodies with `duplex: 'half'`, and copies content-type / content-length / content-range / accept-ranges / cache-control / content-disposition from the upstream response.
- **Inputs:** `request`, `apiPath` beginning with `/`.
- **Returns / side effects:** Upstream `Response` (status + selected headers + streamed body), or 502 JSON if fetch throws.
- **Used by:** All same-origin api proxy route handlers.

## Function: proxyGiftsStatsGet

- **Purpose:** Same-origin proxy helper for api `GET /gifts/stats` (forwards `recipient` query).
- **Inputs:** Incoming `Request` (optional `recipient` search param).
- **Returns / side effects:** Upstream `Response` via `proxyApiRequest`.
- **Used by:** Route GET `/gifts/stats`.

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

## Function: proxyMeForumLawsDismissedPost

- **Purpose:** Proxies POST `/me/forum-laws-dismissed`.
- **Inputs:** `Request` with Bearer session (no body).
- **Returns / side effects:** Upstream `Response`.
- **Used by:** Route POST `/me/forum-laws-dismissed`.

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

## Function: proxyContactPost

- **Purpose:** Bearer proxy POST `/contact` to the 21.gifts api (create an in-app contact message). Same-origin path is `/contact/submit` so it does not collide with the `/contact` page.
- **Inputs:** Incoming `Request` with Bearer session and JSON body.
- **Returns / side effects:** Upstream `Response` via `proxyApiRequest`.
- **Used by:** Route POST `/contact/submit`.

## Function: proxyMessagesPhotoGet

- **Purpose:** Same-origin proxy GET `/messages/:id/photo` to the 21.gifts api (raw forum photo bytes). Public; no bearer required (api photo is public; proxy forwards Authorization if present but does not require it). Runtime `getApiUrl()` via `proxyApiRequest` (not next.config rewrites).
- **Inputs:** Incoming `Request`, plus message `id` from the App Router segment.
- **Returns / side effects:** Upstream `Response` via `proxyApiRequest`.
- **Used by:** Route GET `/messages/[id]/photo`.

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

- **Purpose:** Turn api creation-options JSON into `navigator.credentials.create` input, including `excludeCredentials` when present.
- **Inputs:** Record from `POST /auth/passkey/register/begin`.
- **Returns / side effects:** `PublicKeyCredentialCreationOptions`. Uses native parse when present. Throws if a descriptor list is present but not an array, or is non-empty but has no valid `public-key` entries (invalid type or id is skipped; all skipped → TypeError), including before native parse.
- **Used by:** `usePasskeyLogin.register`.

## Function: credentialToJSON

- **Purpose:** Serialise a `PublicKeyCredential` for the api finish body.
- **Inputs:** Browser credential from create/get.
- **Returns / side effects:** JSON record. Uses native `toJSON` when present.
- **Used by:** `usePasskeyLogin`.

## Function: finishPasskeyAuthentication

- **Purpose:** POST `/auth/passkey/authenticate/finish` and parse the session.
- **Inputs:** `challengeId` and credential JSON.
- **Returns / side effects:** `{ token, account }`. Throws on non-2xx.
- **Used by:** `usePasskeyLogin.authenticate`.

## Function: finishPasskeyRegistration

- **Purpose:** POST `/auth/passkey/register/finish` and parse the session.
- **Inputs:** `challengeId` and credential JSON.
- **Returns / side effects:** `{ token, account }` with `linkingKey` null. Throws on non-2xx.
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

- **Purpose:** Turn api request-options JSON into `navigator.credentials.get` input. Maps `allowCredentials` when present; otherwise discoverable `[]`.
- **Inputs:** Record from `POST /auth/passkey/authenticate/begin`.
- **Returns / side effects:** `PublicKeyCredentialRequestOptions`. Uses native parse when present. Throws if a descriptor list is present but not an array, or is non-empty but has no valid `public-key` entries (invalid type or id is skipped; all skipped → TypeError), including before native parse.
- **Used by:** `usePasskeyLogin.authenticate`.

## Function: startPasskeyAuthentication

- **Purpose:** POST `/auth/passkey/authenticate/begin` and parse options.
- **Inputs:** None.
- **Returns / side effects:** `{ challengeId, options }`. Throws on non-2xx.
- **Used by:** `usePasskeyLogin.authenticate`.

## Function: startPasskeyRegistration

- **Purpose:** POST `/auth/passkey/register/begin` and parse options.
- **Inputs:** Optional `viewKey` string. When set (non-empty), POSTs JSON `{ viewKey }` with `Content-Type: application/json`; otherwise POSTs with no body and no Content-Type.
- **Returns / side effects:** `{ challengeId, options }`. On `!ok`, throws the api `{ error }` string when present, otherwise a status fallback.
- **Used by:** `usePasskeyLogin.register`.

## Function: usePasskeyLogin

- **Purpose:** Client hook for passkey login. `login` uses an existing passkey; it creates one only when the browser reports no credential (`NotAllowedError`). When authenticate returns `NotAllowedError` while `isInAppBrowser()` is true, status becomes `unsupported` and register is not started. `cancel` aborts an in-flight WebAuthn prompt. `register(viewKey?)` forwards an optional view key for public profile claim; `retry` after `register(viewKey)` resends the same key. Login’s register fallback never sends a view key.
- **Inputs:** None (reads `useAuthStore`; calls `isInAppBrowser` on authenticate `NotAllowedError`).
- **Returns / side effects:** `{ status, login, register, authenticate, retry, cancel, error }` with `status` in `idle | starting | error | unsupported`. `error` is the last `Error.message` when `status === 'error'`, else `null`. `retry` repeats `login` when the visitor used the single button. Calls WebAuthn and the api. Unmount aborts an in-flight prompt.
- **Used by:** `OnboardingGate`, `LoginCard`, `LogoutButton`, and `ViewProfileClaim`.

## Function: postMessageInvoice

- **Purpose:** POST `/messages/:id/invoice` with `{ sats }`.
- **Inputs:** session token, message id, sats.
- **Returns / side effects:** `{ pr, amountSats }` or throws collapsed copy.
- **Used by:** `ForumLoader`.

## Function: proxyMessagesInvoicePost

- **Purpose:** Same-origin proxy for `POST /messages/:id/invoice`.
- **Inputs:** App Router `Request`.
- **Returns / side effects:** Forwards to the api.
- **Used by:** `src/app/messages/[id]/invoice/route.ts`.

## Function: MessagesPage

- **Purpose:** Next.js page for `/messages` (signed-in PN inbox).
- **Inputs:** None.
- **Returns / side effects:** Fill `AppShell` (`align="center"`) with `Wordmark` top-left, `SignedInChrome` top-right, and `OnboardingGate` around `InboxLoader`. Conversation HTTP is under `/conversations`.
- **Used by:** Route `/messages`.

## Function: InboxLoader

- **Purpose:** Client loader for `/messages`. Fetches `GET /conversations`, opens `?c=`, posts replies.
- **Inputs:** None (session from the auth store; `useSearchParams`).
- **Returns / side effects:** React element or `null` without a session. Calls `fetchConversations`, `fetchConversation`, `postConversationMessage`.
- **Used by:** `MessagesPage`.

## Function: InboxScreen

- **Purpose:** Presentational inbox: conversation list or one open thread with a 500-character composer.
- **Inputs:** List/thread/composer state from `InboxLoader`.
- **Returns / side effects:** React element. No network.
- **Used by:** `InboxLoader`.

## Function: fetchConversations

- **Purpose:** GET `/conversations` with Bearer and parse `{ conversations }`.
- **Inputs:** Session token.
- **Returns / side effects:** Conversation list, or throws visitor copy.
- **Used by:** `InboxLoader`, `ContactLoader`.

## Function: fetchConversation

- **Purpose:** GET `/conversations/:id` with Bearer and parse `{ messages }`.
- **Inputs:** Session token and conversation id.
- **Returns / side effects:** Oldest-first messages, or throws visitor copy.
- **Used by:** `InboxLoader`.

## Function: postConversationMessage

- **Purpose:** POST `/conversations/:id` with `{ text }`.
- **Inputs:** Session token, conversation id, text.
- **Returns / side effects:** Created message, or throws api/visitor copy.
- **Used by:** `InboxLoader`.

## Function: openConversation

- **Purpose:** POST `/conversations` with `{ forumMessageId }`.
- **Inputs:** Session token and forum note/reply id.
- **Returns / side effects:** Conversation row, or throws on 400/404/other.
- **Used by:** `ForumLoader` PM control.

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

- **Purpose:** Hyphenated hash fragment for a screen path (`/` → `root`, `/setup/rules` → `setup-rules`).
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
