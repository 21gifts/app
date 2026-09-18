# Screens

Every variant below is captured in all four Linux Chromium combos (desktop/mobile × light/dark). Markdown images are the desktop-light shot. The other combo PNGs are visual-test baselines only.

**Role hierarchy.** Roles are ordered founder > moderator > verified > basis. A higher role can always do and see everything a lower role can; there are no exceptions. Wherever this handbook names a role for a screen, tool or control it means that role **or higher**. The app checks this with `roleAtLeast` (`src/lib/roles.ts`); an equality test on the viewer's role is a defect.

## Screen: /

- **URL:** `/` — public marketing landing (no auth gate).
- **What the user sees:** Dark 21.gifts header with a language switcher (wordmark `/` when unsigned, `/welcome` when a session is hydrated), headline about peer-to-peer Bitcoin gifts, How it works (login and Wallet of Satoshi address) / Why / Donate to this project (Wallet of Satoshi address `21gifts@walletofsatoshi.com` to run 21.gifts itself, distinct from `/donate`) / FAQ, CTAs **Ask for help** (`/login`) and **Send help** (`/donate`). **Install app** appears in the header and after Send help only for iPhone Safari/Chrome/Firefox/Edge (not standalone, not in-app) or when Chromium fires `beforeinstallprompt`; idle visual snapshots stay without it because the control renders `null` until after mount detection.
- **Actions:** Read the pitch, change language, open login, open Send help, optionally install the app (Chromium prompt or iPhone three-step Share sheet), jump to in-page sections, open About, open Stats, open Legal & Privacy, open the Handbook.
- **Calls:** `Home` (`src/app/(marketing)/page.tsx`) inside `MarketingLayout`, `LanguageSwitcher`, `PwaInstall`.

### Variant: default

Desktop/wide layout: section nav is visible in the header (How it works, Why, FAQ, About, Stats, Handbook, Log in). No hamburger.

![21.gifts home](images/root.png)

### Variant: mobile-nav

Captured at desktop and mobile. On mobile the header shows the Menu button; open it to reveal the same links stacked (tapping a link closes the menu). On desktop this is the landing without the hamburger.

![21.gifts home mobile nav](images/root-mobile-nav.png)

### Variant: language-open

Open the language switcher in the marketing header. Custom listbox (rounded panel, endonym rows with a check on the current locale) — not OS chrome.

![21.gifts home language](images/root-language.png)

## Screen: /legal

- **URL:** `/legal` — imprint and privacy. `/legal.html` permanently redirects here.
- **What the user sees:** Dark 21.gifts header with a language switcher (wordmark `/` when unsigned, `/welcome` when a session is hydrated), Legal Notice (Switzerland) and Privacy Policy (no analytics; no cookies unless the visitor chooses a language — then a `locale` cookie — or a light/dark appearance — then a `theme` cookie; System appearance clears `theme`; or a number-format style — then a `numberFormat` cookie, absent = Swiss `10'000.23`; session in localStorage; Cloudflare TLS; login on this origin). There is **no published email**; contact is in-app only via `/contact` after login. Legal body copy stays English.
- **Actions:** Change language. Read the legal body. Open **Open the app** (`/contact`). Header **Log in** goes to `/login`.
- **Calls:** `LegalPage` inside `MarketingLayout`, `LanguageSwitcher`.

### Variant: default

The only state: imprint plus privacy, marketing chrome.

![21.gifts legal](images/legal.png)

## Screen: /about

- **Purpose:** Public foundation of the house — three convictions and Matthew 10:8.
- **URL:** `/about` — public marketing page (no auth gate).
- **What the user sees:** Dark 21.gifts header with a language switcher (wordmark `/` when unsigned, `/welcome` when a session is hydrated), kicker **About**, heading **Three convictions**, a short lead, the Matthew 10:8 verse, then three numbered convictions (Giving is a duty with 1 John 3:18; Direct, with no middleman; Bitcoin is the most effective money) and **Open the living room** (`/welcome`). Visitor copy comes from the catalog.
- **Actions:** Change language. Read the convictions. Open **Open the living room** (`/welcome`). Header **Log in** goes to `/login`.
- **Calls:** `AboutPage` inside `MarketingLayout`, `LanguageSwitcher`, `ButtonLink`.

### Variant: default

The only state: three convictions, verse, and forum CTA, marketing chrome.

![21.gifts about](images/about.png)

## Screen: /stats/[day]

- **URL:** `/stats/YYYY-MM-DD` — public list of outbound gifts that UTC day. Invalid dates 404.
- **What the user sees:** Dark 21.gifts header (wordmark `/` when unsigned, `/welcome` when a session is hydrated), **All stats** back to `/stats`, heading **Gifts on {day}**, a **UTC day** date input, then either the gift table (Time, Recipient, ₿, selected fiat code) with a FiatPicker **only when unsigned**, empty copy **No gifts recorded on this day.**, **Loading…**, or **Try again**. Signed-in visitors still see preferred-fiat amounts and cannot change the code here. Summary `{n} gift(s) · ₿ · formatFiatDisplay(total, preferred fiat, numberFormat)`. Stats body copy stays English.
- **Actions:** Pick another UTC day in the date input (navigates to `/stats/{next}`). When unsigned, pick CHF | EUR | USD | PHP on FiatPicker (writes cookie `fiat`). Open **All stats**. Change language. Number format is a signed-in `/profile` settings row next to theme, not Menu chrome, and not on this public header. Header **Log in** goes to `/login`.
- **Calls:** `GiftDayPage`, `DayLoader`, `GiftDayTable`, `FiatPicker`, `fetchGiftDay` (`GET /gifts?day=`).
- **Auth:** None.

### Variant: default

Loaded day with at least one gift row (recipient **alice**).

![21.gifts gifts on a day](images/stats-day.png)

### Variant: empty

No gifts that UTC day. Copy **No gifts recorded on this day.**

![21.gifts empty day](images/stats-day-empty.png)

### Variant: loading

Waiting on `GET /gifts`. Copy **Loading…**

![21.gifts day loading](images/stats-day-loading.png)

### Variant: error

Fetch failed. Button **Try again**.

![21.gifts day error](images/stats-day-error.png)

## Screen: /stats

- **URL:** `/stats` — public gift totals (no auth gate).
- **What the user sees:** Dark 21.gifts header with a language switcher (wordmark `/` when unsigned, `/welcome` when a session is hydrated), heading **Gifts**. Four KPI cards (total spent as BIP-177 **₿** plus the selected fiat, gifts, people, period), a FiatPicker (CHF | EUR | USD | PHP) above the cards **only when unsigned**, then diagrams: **Total spend over time** (one cumulative chart; days with spend are markers on the series, not a wrapping date list), **By person** and **By month**. Each diagram has a `SegmentedControl tone="gift" shell="dark"` ₿ | selected fiat control that defaults to ₿; over time switches the series, person and month rescale bar size while labels stay both units. Signed-in visitors still display and scale with the preferred code and cannot change it here. Empty database copy: **No gifts recorded yet.** Stats body copy stays English.
- **Actions:** Change language. Read the charts. Open a spend day (`/stats/{YYYY-MM-DD}`) from **Total spend over time** by clicking a day with spend. When unsigned, pick CHF | EUR | USD | PHP on FiatPicker (writes cookie `fiat`). Switch **Total spend over time** / **By person** / **By month** between ₿ and the selected fiat. Header **Stats** stays on this page; **Log in** goes to `/login`.
- **Calls:** `StatsPage`, `StatsLoader`, `StatsDashboard`, `FiatPicker`, `fetchGiftStats` (same-origin `GET /gifts/stats`), `LanguageSwitcher`.

### Variant: default

Loaded stats with one cumulative over-time chart visible. Scale defaults to ₿.

![21.gifts stats](images/stats.png)

### Variant: usd-scale

Inverted ranking fixture (June tall in ₿ / short in USD, July the reverse). Scale switched to USD on **Total spend over time**, **By person**, and **By month**.

![21.gifts stats USD scale](images/stats-usd-scale.png)

### Variant: empty

Zero gifts. KPI zeros and **No gifts recorded yet.**

![21.gifts stats empty](images/stats-empty.png)

### Variant: loading

Waiting on `GET /gifts/stats`. Copy **Loading…**

![21.gifts stats loading](images/stats-loading.png)

### Variant: error

Fetch failed. Copy **Could not load gift stats. Please try again.** and **Try again**.

![21.gifts stats error](images/stats-error.png)

## Screen: /trust-chain

- **URL:** `/trust-chain` — signed-in Trust Chain. Same onboarding gate as `/welcome` (`OnboardingGate screen="welcome"`). JSON is `/trust/graph` (Next.js forbids `route.ts` beside this page). Any logged-in completed account may view (not staff-only).
- **What the user sees:** Fill `AppShell` (`align="start"`) with back (`ProfileChromeLeft`) + wordmark → `/welcome` top-left and one **Menu** top-right; open it for **Home**, Profile, **Living room rules**, **Trust Chain**, **Notifications**, **Messages**, **Contact**, optional **Install app**, and **Log out**. Heading **Trust Chain**, a short lead that says to click a person to load everyone linked to them and drag a person to move them, then a chain that starts with the founder. Clicking a person loads one hop of stored links (never the whole thousand-person graph at once). One next person sits to the right; several people hanging off one person (everyone a moderator verified) stack top to bottom. Dragging a person moves that block; already-placed people keep their spot when a hop arrives. Below the diagram, three short explanations: **Verified**, **Moderator**, and **Founder**. Empty copy: **No one is on the Trust Chain yet.** Loading copy: **Loading…**. Error copy plus **Try again**.
- **Actions:** Click a person to load who they met or appointed. Drag a person to rearrange. Modifier-click a person to open the member card (`/members/{id}`). Back to the forum. Open **Menu** for **Home**, Profile, **Living room rules**, **Trust Chain**, **Notifications**, **Messages**, **Contact**, optional **Install app**, or **Log out**.
- **Calls:** `AppShell`, `ProfileChromeLeft`, `TrustChainPage`, `TrustChainLoader`, `TrustChainScreen`, `TrustChainDiagram`, `layoutTrustChain`, `mergeTrustChain`, `fetchTrustChain` (same-origin `GET /trust/graph` and `GET /trust/graph?around=`), `SignedInChrome`, `OnboardingGate`.
- **Auth:** Bearer session; `OnboardingGate screen="welcome"`.

### Variant: default

Founder seed **Cyrill** only. Lead tells the visitor to click a person to load everyone linked to them.

![21.gifts Trust Chain](images/trust-chain.png)

### Variant: expanded

Click **Cyrill**, then **Severin**. The chain grows left to right: Cyrill appointed Severin, who verified Ada and Bob.

![21.gifts Trust Chain expanded](images/trust-chain-expanded.png)

### Variant: empty

Zero nodes. Copy **No one is on the Trust Chain yet.**

![21.gifts Trust Chain empty](images/trust-chain-empty.png)

### Variant: loading

Waiting on `GET /trust/graph`. Copy **Loading…**

![21.gifts Trust Chain loading](images/trust-chain-loading.png)

### Variant: error

Fetch failed. Copy **Could not load the Trust Chain. Please try again.** and **Try again**.

![21.gifts Trust Chain error](images/trust-chain-error.png)

### Variant: hop-error

Founder seed is on screen. Clicking that person fails the hop fetch. The diagram stays; the same error copy and **Try again** sit above it. Retry re-fetches that hop without re-fetching founder seeds; the banner stays gone only if the hop succeeds.

![21.gifts Trust Chain hop error](images/trust-chain-hop-error.png)

## Screen: /login

- **URL:** `/login` — login only.
- **What the user sees:** Fill `AppShell` with `HomeWordmark` top-left (`/` when unsigned, `/welcome` when a session is hydrated); light language switcher top-right (not the marketing header). Idle **Log in**. In Telegram or another in-app browser, an escape card (**Open this page in your browser**) with **Open in browser** and **Copy link** instead of **Log in**. Error is terminal until **Try again**. After success the visitor is sent to `/setup/name`, `/setup/address`, `/setup/rules`, or `/welcome`.
- **Actions:** Change language. Log in (existing login, or create one when the browser has none). In an in-app browser: open the page in the system browser or copy the link.
- **Calls:** `AppShell`, `HomeWordmark`, `LoginCard`, `OnboardingGate`, `usePasskeyLogin`, `useAuthStore`, `LanguageSwitcher`, `isInAppBrowser`, `openInSystemBrowser`.

### Variant: idle

Logged out. Heading **Log in with your device**, one **Log in** button.

![21.gifts login idle](images/login.png)

### Variant: starting

Transient after a login click, before the ceremony finishes: spinner and **Preparing your login…**.

![21.gifts login starting](images/login-starting.png)

### Variant: error

Login begin or finish failed. Copy **Something went wrong. Please try again.** and **Try again**.

![21.gifts login error](images/login-error.png)

### Variant: in-app

Telegram or another in-app WebView detected. Heading **Open this page in your browser**; no **Log in** button; **Open in browser** and **Copy link** instead.

![21.gifts login in-app](images/login-in-app.png)

### Variant: language-open

Open the light language switcher top-right. Custom listbox with endonym rows (English / Deutsch / Español / Filipino) — not a native OS select.

![21.gifts login language](images/login-language.png)

## Screen: /donate

- **URL:** `/donate` — public, no auth gate.
- **What the user sees:** Fill `AppShell` with `HomeWordmark` top-left (`/` when unsigned, `/welcome` when a session is hydrated); light language switcher top-right (not marketing header). Heading **Send help**, short lead about opening **Show reactions** then sending Bitcoin on a payable reaction, CTA **Open the forum** (`/welcome`). No address/amount form. No QR.
- **Actions:** Change language. Open the forum. Unsigned visitors hitting `/welcome` are sent to `/login` by OnboardingGate.
- **Calls:** `AppShell`, `HomeWordmark`, `DonatePage`, `ButtonLink`, `LanguageSwitcher`.

### Variant: default

Heading **Send help**, explainer lead, **Open the forum**.

![21.gifts donate](images/donate.png)

## Screen: /setup/name

- **URL:** `/setup/name` — first screen after login (`account.setup === 'name'`).
- **What the user sees:** Fill `AppShell` with Wordmark top-left and one **Menu** top-right; open it for **Home**, Profile, **Living room rules**, **Trust Chain**, **Notifications**, **Messages**, **Contact**, optional **Install app**, and **Log out**. Heading **Your name**, name form with **Continue** and labeled **Skip**. No Wallet of Satoshi form.
- **Actions:** Enter a name and **Continue**, or **Skip** (`POST /me/setup/skip`); open **Menu** for **Home**, Profile, **Living room rules**, **Trust Chain**, **Notifications**, **Messages**, **Contact**, optional **Install app**, or **Log out**. After save or skip, the visitor is sent to the next `account.setup` path (usually `/setup/address`).
- **Calls:** `AppShell`, `Wordmark`, `NameSetup`, `NameForm`, `SignedInChrome`, `OnboardingGate`, `skipSetup`.

### Variant: default

Signed in, no name yet. **Your name** and the name field at the top, **Continue** and labeled **Skip** pinned at the bottom of the screen. One **Menu** top-right; open it for **Home**, Profile, **Living room rules**, **Trust Chain**, **Notifications**, **Messages**, **Contact**, optional **Install app**, and **Log out**.
![21.gifts name setup](images/setup-name.png)

## Screen: /setup/address

- **URL:** `/setup/address` — second screen after login (`account.setup === 'address'`; name may already be saved or skipped).
- **What the user sees:** Fill `AppShell` with Wordmark top-left and one **Menu** top-right; open it for **Home**, Profile, **Living room rules**, **Trust Chain**, **Notifications**, **Messages**, **Contact**, optional **Install app**, and **Log out**. Heading **Your Wallet of Satoshi address**, greeting **Hi, {name}**, address form with **Continue** and labeled **Skip**. No name form.
- **Actions:** Enter an address and **Continue**, or **Skip** (`POST /me/setup/skip`); open **Menu** for **Home**, Profile, **Living room rules**, **Trust Chain**, **Notifications**, **Messages**, **Contact**, optional **Install app**, or **Log out**. After save or skip, the visitor is sent to the next `account.setup` path (usually `/setup/rules`).
- **Calls:** `AppShell`, `Wordmark`, `AddressSetup`, `LightningAddressForm`, `SignedInChrome`, `OnboardingGate`, `skipSetup`.

### Variant: default

Signed in with a name (or a skipped name) and no address. **Your Wallet of Satoshi address** and the address field at the top, **Continue** and labeled **Skip** pinned at the bottom of the screen. One **Menu** top-right; open it for **Home**, Profile, **Living room rules**, **Trust Chain**, **Notifications**, **Messages**, **Contact**, optional **Install app**, and **Log out**.
![21.gifts address setup](images/setup-address.png)

## Screen: /setup/rules

- **URL:** `/setup/rules` — third screen after login, when living-room rules are not yet agreed (`account.setup === 'rules'`). Name and address may already be saved or skipped; rules cannot be skipped.
- **What the user sees:** Fill `AppShell` with one **Menu** top-right; open it for **Home**, Profile, **Living room rules**, **Trust Chain**, **Notifications**, **Messages**, **Contact**, optional **Install app**, and **Log out**. Wordmark top-left (with icon-only chapter back after the first chapter). Heading **Living room rules**, prompt to read this chapter, progress (`1 of 9` on the first chapter), one rules chapter at a time (lead first) without the public Contact / forum nav, and a full-width **Continue** button. The last chapter shows **I agree to these rules** instead of **Continue**.
- **Actions:** Read the current chapter and **Continue** to advance; icon-only back after the first chapter. Changing chapter (Continue or Back) scrolls the fill inner scroller back to the top. The last **I agree to these rules** POSTs agreement, then the visitor is sent to `/welcome`. Open **Menu** for **Home**, Profile, **Living room rules**, **Trust Chain**, **Notifications**, **Messages**, **Contact**, optional **Install app**, or **Log out**.
- **Calls:** `AppShell`, `Wordmark`, `RulesSetup`, `RulesDocument`, `SignedInChrome`, `OnboardingGate`, `agreeToRules` (`POST /me/rules-agreement`) on the last chapter only.

### Variant: default

Signed in with a name and address and `rulesAgreedAt` still null. First chapter (lead paragraph plus the accent-bordered **The test** callout) and **Continue** visible.

![21.gifts rules setup](images/setup-rules.png)

### Variant: law1

After one Continue: rule card with kicker **Rule 1**, heading **Only free donations**, body, and **The test** callout. Icon-only back is visible.

![21.gifts rules setup law 1](images/setup-rules-law1.png)

### Variant: law2

Rule card **Rule 2** / **Donors come first** with body and **The test** callout.

![21.gifts rules setup law 2](images/setup-rules-law2.png)

### Variant: law3

Rule card **Rule 3** / **Contact stays in the app** with body (no test callout).

![21.gifts rules setup law 3](images/setup-rules-law3.png)

### Variant: wanted

Heading **Welcome**, muted lead, and the welcome list (app-fg check glyphs, not accent).

![21.gifts rules setup wanted](images/setup-rules-wanted.png)

### Variant: allowed

Heading **Allowed**, muted lead, and the allowed list (muted check glyphs).

![21.gifts rules setup allowed](images/setup-rules-allowed.png)

### Variant: ratherNot

Heading **Better not**, muted lead, and the better-not list (minus glyphs).

![21.gifts rules setup rather not](images/setup-rules-rather-not.png)

### Variant: forbidden

Heading **Forbidden**, muted lead, and the three forbidden groups (red cross glyphs).

![21.gifts rules setup forbidden](images/setup-rules-forbidden.png)

### Variant: house

Last chapter: muted **Our house** block (body plus emphasised closing paragraph) and **I agree to these rules**. That click POSTs agreement.

![21.gifts rules setup house](images/setup-rules-house.png)

### Variant: error

Last-chapter POST failed. Alert **Could not save your agreement**.

![21.gifts rules setup error](images/setup-rules-error.png)

### Variant: busy

Last-chapter POST in flight. Agree disabled with a spinner; **Our house** still visible.

![21.gifts rules setup busy](images/setup-rules-busy.png)

## Screen: /welcome

- **URL:** `/welcome` — fourth screen after login, when `account.setup` is null (name and address may be saved or skipped; living-room rules agreement is required).
- **What the user sees:** Flow `AppShell` with Wordmark top-left (`ForumHomeWordmark`) and one **Menu** top-right; open it for **Home**, Profile, **Living room rules**, **Trust Chain**, **Notifications**, **Messages**, **Contact**, optional **Install app**, and **Log out**, then a quiet **Version {sha}** line (`app.version`). Gift icon with an integrated Bitcoin symbol, **Welcome, {name}**, dismissible living-room laws hint box with an X when not yet dismissed on the account (two laws plus links to **Living room rules** `/rules` and **Contact** `/contact`; after dismiss the box is gone and the flag persists on the account), then a four-way `SegmentedControl tone="neutral"` (**Active** / **No gifts yet** / **All** / **Most popular**). **No gifts yet** shows a count of loaded zero-sat notes created after the last time that filter was opened; omitted when the count is 0 or the filter is selected. Default is **Active** (paid notes plus unpaid founder/moderator notes, newest-first feed: newest at the top). **All** shows every note newest-first. **Most popular** ranks paid notes by sats (highest first). Below the selector: clickable author name (when `accountId` is set) that opens `/members/:id`, optional Founder / Moderator / Verified pill when the api `role` is one of those three (`basis` has no pill), timestamp, optional inline photo then caption text below the photo, optional inline `<video>` playback for notes with video (player follows the clip aspect — portrait stays portrait); note and reply bodies longer than 280 characters show a collapsed preview, an ellipsis, and inline **Show more** (`forum.showMore`), expanding in place with no Show less, while permalink `/messages/[id]` stays full text. Cards also show ₿ amount always, plus optional preferred-fiat `·` only when the conversion is non-null, else ₿-only with no em dash (no FiatPicker), replyCount text, React (`forum.react`, lucide Reply) on every top-level note, copy-link control (**Copy link to this note** → origin `/messages/<uuid>`), and expand/collapse on the card body (**Show reactions** / **Hide reactions**; the footer ₿ amount and the reaction-count text also expand; React expands a collapsed card and does not collapse an expanded one; Gift on a payable reply / role / copy / delete do not; the card body remains the unique **Show reactions** / **Hide reactions** name). Expanded cards show the replies list (founder/moderator trash is also on nested replies) plus an in-card reply composer (**Write a reaction** and an **Amount** sats field; empty reply text and an empty amount invoices 21 sats (pay-sheet default); a reply with text and an empty amount is unpaid for the parent author, a moderator, the founder, or a verified member, otherwise 1 sat; an amount of 0 is billed as 1 sat); reply authors show the same Founder / Moderator / Verified pills (`basis` has none). Pay control / Send Bitcoin only on a payable reply (open **Show reactions**, then Gift on that reply — never on the post); composer under the filters (`SegmentedControl`) above the list with **Add a photo or video** (ImagePlus) left of the textarea, **Post** (Send icon) to the right, optional photo draft preview with **Remove photo** (X icon), and optional video draft preview with **Remove video** (X icon) — icon-only action controls, catalog `aria-label`s, no visible button text. A missing name, Lightning Address, or rules agreement opens `RequirementsOverlay` (no Skip) before a post or reply retries. No always-visible refresh control; there is no visible refresh chrome — while refreshing or pull-armed only a visually hidden (`sr-only`) `role="status"` (`forum.refreshing`) is mounted, and idle markup has no status node. When the visitor is scrolled down and a silent refresh found new ids, a labeled **New posts** pill appears over the feed; it is absent from idle screenshots. When an unread `moderator_appointed` notification exists, a labeled **You are a moderator** pill uses the same chrome (`fixed` under the header); if both pills show, appointment stays at `top-14` and **New posts** moves to `top-28`. Clicking the appointment pill marks that row read and stays on `/welcome`; it is omitted when the flag is falsy and absent from idle screenshots. While the tab is visible the list also silent-refetches every 30 seconds (`FORUM_LIST_POLL_MS`); hidden tabs do not poll. Clicking a role pill toggles a short explanation under that card header. Paying a payable reply opens a sheet with a top-left back control and a **Pay** button that includes the Wallet of Satoshi icon. On a computer the sheet also shows a QR; on a smartphone there is no QR. No name or address form. No guest donate CTA. Signed-in chrome may show `IntroduceYourselfOverlay` when `setup` is null and `hasPosted` is false. Labeled **Translate** / Show original / Show translation sit under the note and reply bodies via `NoteTranslate` when the language differs from the UI locale (not in the footer icon row).
- **Actions:** Dismiss the living-room laws hint (permanent), post a text and/or photo or video message, attach/remove a photo or video draft, expand a note to load replies and post a reply, open an author profile at `/members/:id`, copy a note link to `/messages/<uuid>`, click a role pill for its explanation, pay a payable reply in-app, switch the forum view (Active / No gifts yet / All / Most popular), pull down from the top to refresh the forum list, click **You are a moderator** to mark that appointment read and hide the pill, click **New posts** or the wordmark / Menu **Home** (already on `/welcome`) to scroll to top and apply new notes, leave the forum in view for 30 seconds so a visible-tab poll can pick up new ids, return to the web app to refresh the list when it becomes visible again, complete a `RequirementsOverlay` for a missing name, Lightning Address, or rules agreement, open the rules or contact pages, retry a failed load; open **Menu** for **Home**, Profile, **Living room rules**, **Trust Chain**, **Notifications**, **Messages**, **Contact**, optional **Install app**, or **Log out**, then a quiet **Version {sha}** line (`app.version`); dismiss `IntroduceYourselfOverlay` for this mount (Close) or **Write an introduction** (dismisses, focuses the welcome composer via `requestForumCompose` / `FORUM_COMPOSE_EVENT`; `router.push('/welcome')` only when the path is not already `/welcome`).
- **Calls:** `PageChrome`, `AppShell`, `ForumHomeWordmark`, `WelcomeScreen`, `ForumLoader`, `ForumBoard`, `RequirementsOverlay`, `SegmentedControl`, `SignedInChrome`, `IntroduceYourselfOverlay`, `OnboardingGate`, `prepareForumPhoto`, `prepareForumVideo`, `fetchMessagePhoto`, `forumVideoSrc`, `fetchReplies`, `visibleForumMessages`, `hasUnseenForumPosts`, `unpaidNewCount`, `fetchGiftStats`, `latestRateDay`, `satsToFiatAmount`, `fetchNotifications`, `markNotificationRead`.

### Variant: default

Gift icon with an integrated Bitcoin symbol, **Welcome, Ada**, with the dismissible laws hint box and rules/contact links, **Active** selected. Paid notes newest-first (Ada ₿5 then Carol ₿21); Bob's unpaid note is not visible. Composer with attach + Send icons. React (`forum.react`) on every top-level note. Posts do not show Send Bitcoin; Gift appears on a payable reply after **Show reactions**. Founder / Moderator / Verified pills beside the name when `role` is one of those three; `basis` has no pill (Carol is `verified`, Ada is `moderator`; Bob is `basis` and hidden on Active). One **Menu** top-right; open it for **Home**, Profile, **Living room rules**, **Trust Chain**, **Notifications**, **Messages**, **Contact**, optional **Install app**, and **Log out**.

![21.gifts welcome](images/welcome.png)

### Variant: moderation

A founder or moderator sees an icon-only Delete post control in the note footer icon row with copy; confirming wraps to the next line. Other roles do not see it. The server independently checks the live role.

![21.gifts moderation](images/welcome-moderation.png)

### Variant: delete-confirm

Delete post opens an inline confirmation: Delete this post and its reactions from 21.gifts? Confirm deletion (check) and Cancel deletion (X) are icon-only controls. Cancel sends no request.

![21.gifts delete-confirm](images/welcome-delete-confirm.png)

### Variant: deleting

While DELETE is pending, confirmation and cancellation are disabled and a spinner replaces the check. Successful deletion removes the post; stale refresh payloads cannot restore it in this session.

![21.gifts deleting](images/welcome-deleting.png)

### Variant: delete-error

A failed deletion keeps the post and confirmation visible with an error and retry. Already missing posts (404) are removed from the local view.

![21.gifts delete-error](images/welcome-delete-error.png)

### Variant: reply-moderation

A founder or moderator who expands a note sees an icon-only Delete reaction control on each nested reply. Ordinary members do not. Parent still has Delete post.
![21.gifts reply-moderation](images/welcome-reply-moderation.png)

### Variant: reply-delete-confirm

Delete reaction opens inline confirmation: Delete this reaction from 21.gifts? Confirm deletion (check) and Cancel deletion (X) are icon-only. Cancel sends no request. The parent post stays.

![21.gifts reply-delete-confirm](images/welcome-reply-delete-confirm.png)

### Variant: reply-deleting

While DELETE of the reply is pending, confirmation and cancellation on that reply are disabled and a spinner replaces the check.

![21.gifts reply-deleting](images/welcome-reply-deleting.png)

### Variant: reply-delete-error

A failed reply deletion keeps the reply and confirmation visible with `Could not delete the reaction. Please try again.` and retry.

![21.gifts reply-delete-error](images/welcome-reply-delete-error.png)

### Variant: all

Click **All** — Bob's unpaid note (`Does anyone have spare sats this week?`) is visible with Ada and Carol; list order newest-first (Ada, Carol, Bob).

![21.gifts welcome all](images/welcome-all.png)

### Variant: unpaid

Click **No gifts yet** (German: **Noch ohne Geschenk**) — only loaded notes with exactly zero sats appear. Bob is visible; paid Ada and Carol are hidden. This includes notes without a receiving wallet. The four filters use a two-column grid for readable labels on mobile. Active remains the default.

![21.gifts welcome without gifts](images/welcome-unpaid.png)

### Variant: unpaid-new-count

Active selected; last-visit stamp older than Bob's unpaid note; **No gifts yet** shows the count chip `1`.

![21.gifts welcome unpaid new count](images/welcome-unpaid-new-count.png)

### Variant: empty-unpaid

No zero-sat notes remain in the loaded list. **Every loaded message has already received Bitcoin.** appears; the filters and composer remain available. An entirely empty forum still uses the general empty state.

![21.gifts welcome no remaining zero-sat notes](images/welcome-empty-unpaid.png)

### Variant: popular

Click **Most popular** — paid notes ordered by sats (Carol ₿21, then Ada ₿5). Unpaid Bob is hidden.

![21.gifts welcome popular](images/welcome-popular.png)

### Variant: empty-paid

Copy **No message has received Bitcoin yet.** Active selected, unpaid notes hidden, composer visible.

![21.gifts welcome empty paid](images/welcome-empty-paid.png)

### Variant: empty

Empty copy **No messages yet — be the first to write one.** plus composer (attach + textarea + Post).

![21.gifts welcome empty](images/welcome-empty.png)

### Variant: loading

Loading copy **Loading…** while the messages fetch is in flight.

![21.gifts welcome loading](images/welcome-loading.png)

### Variant: error

Load error **Could not load messages. Please try again.** plus **Try again**.

![21.gifts welcome error](images/welcome-error.png)

### Variant: validation-error

Click **Post** with an empty composer and no photo or video → **Enter a message or add a photo or video**. The composer caps at 500 characters (same as `POST /forum/messages`); over-length drafts show **Keep it to 500 characters** and are not sent.

![21.gifts welcome validation error](images/welcome-validation-error.png)

### Variant: expanded

On **All**, click **Show reactions** on a note — the note's ₿ amount and the reaction-count text also expand — card expands (`aria-expanded`), replies list loads via `fetchReplies`, and the in-card reply composer shows **Write a reaction** plus an **Amount** sats field. Gift-only replies render as **send ₿…** plus the same optional preferred-fiat `·` as notes (₿-only when conversion is null); a reply with text and a gift shows both. Reply authors show the same Founder / Moderator / Verified pills as notes (`basis` has none); clicking a pill toggles the same short explanation. Empty reply text and an empty amount invoices 21 sats (pay-sheet default) and opens the pay sheet; a reply with text and an empty amount is unpaid for the parent author, a moderator, the founder, or a verified member, otherwise 1 sat; an amount of 0 is billed as 1 sat.
![21.gifts welcome expanded](images/welcome-expanded.png)

### Variant: expanded-gifts

On **All**, expand Ada's note. The thread shows a gift-only reply (**send ₿21**) and a text reply with the gift amount under the body. The in-card composer still has **Write a reaction** and **Amount**.

![21.gifts welcome expanded gifts](images/welcome-expanded-gifts.png)

### Variant: expanded-visitor

On **All**, expand Ada's note. The thread shows two replies from **Robin**, who has no 21.gifts account: a gift-only reply (**send ₿69**) and a text reply containing `https://example.com/hello`. Each author line shows a **Visitor** button next to the name (same slot as a role pill); clicking it opens a short hint that the person wrote from another app, not from a 21.gifts account, and is shown because they sent bitcoin to a post. The URL is visible as plain text — not a clickable link, no autolink, no quoted-note embed.

![21.gifts welcome expanded visitor](images/welcome-expanded-visitor.png)

### Variant: quoted-note

Signed-in founder Cyrill, living-room laws dismissed, Active. Only Riana Rosello's paid 21-sat verified note is in the list; the card is expanded. Cyrill's reply shows `just for information:` and a nested technical-note post (photo, caption starting **A Quick Technical Note**, Founder pill, ₿43). The raw `https://21.gifts/messages/d8cd22dd-d5c4-46a8-82ed-38b4d2f551ec` URL is not visible.

![21.gifts welcome quoted note](images/welcome-quoted-note.png)

### Variant: copy

Click **Copy link to this note** — control sets `data-copied` after writing `origin/messages/<uuid>` to the clipboard.

![21.gifts welcome copy](images/welcome-copy.png)

### Variant: translate

Signed-in `/welcome` with one paid German note. **Translate** is visible under the body (not in the footer icon row). English notes on other fixtures still hide it.

![21.gifts welcome translate](images/welcome-translate.png)

### Variant: translate-loading

Same German note after clicking **Translate** while POST `/translate` hangs. The control is busy (`aria-busy`) with a spinner.

![21.gifts welcome translate loading](images/welcome-translate-loading.png)

### Variant: translate-done

Same German note after a successful translation. Translated body plus **Show original**.

![21.gifts welcome translate done](images/welcome-translate-done.png)

### Variant: translate-hidden

After **Show original**: translated body hidden, control reads **Show translation**.

![21.gifts welcome translate hidden](images/welcome-translate-hidden.png)

### Variant: translate-error

Same German note after POST /translate fails. Alert **Could not translate this note. Please try again.** and the Translate control remains.

![21.gifts welcome translate error](images/welcome-translate-error.png)

### Variant: note-truncated

Signed-in `/welcome` with one paid note whose body is longer than 280 characters. Collapsed preview, ellipsis, and **Show more** are visible; the distinctive tail is hidden.

![21.gifts welcome note truncated](images/welcome-note-truncated.png)

### Variant: new-posts

Visitor is scrolled down the forum list. A silent refresh found a newer note id. Labeled **New posts** pill is visible; the new note text is not yet in the list.

![21.gifts welcome new posts](images/welcome-new-posts.png)

### Variant: moderator-appointed

Signed-in member with an unread `moderator_appointed` notification. Labeled **You are a moderator** pill is visible under the header. Idle screenshots omit the pill. When **New posts** is also shown, this pill stays at `top-14` and **New posts** moves to `top-28` (not a separate variant).

![21.gifts welcome moderator appointed](images/welcome-moderator-appointed.png)

### Variant: photo

On **All** (unpaid photo-only notes are hidden on Active): photo-only forum row from Ada with inline image (**Photo from Ada**) and the attach control visible in the composer.

![21.gifts welcome photo](images/welcome-photo.png)

### Variant: photos

On **All**: photo-only forum row from Ada with two stills (**Photo from Ada** twice, `photoCount: 2`) and the attach control visible in the composer.

![21.gifts welcome photos](images/welcome-photos.png)

### Variant: photo-and-text

After a successful post of caption **Hello with this photo.** plus a JPEG: the row shows **Photo from Ada**, then that text below the photo; the composer is empty again (attach + textarea + Post).

![21.gifts welcome photo and text](images/welcome-photo-and-text.png)

### Variant: photos-and-text

On **All**: forum row from Ada with two stills (**Photo from Ada**) and caption **Hello with these photos.** below the photos; the composer is empty (attach + textarea + Post).

![21.gifts welcome photos and text](images/welcome-photos-and-text.png)

### Variant: composer-text

Typed caption **Caption before attaching a photo.** in the composer; no preview yet; attach + Post idle.

![21.gifts welcome composer text](images/welcome-composer-text.png)

### Variant: composer-photo

JPEG preview (**Selected photo**) and **Remove photo**; textarea empty.

![21.gifts welcome composer photo](images/welcome-composer-photo.png)

### Variant: composer-photos

Two JPEG previews (**Selected photo**) and per-index **Remove photo**; textarea empty.

![21.gifts welcome composer photos](images/welcome-composer-photos.png)

### Variant: composer-photo-and-text

Preview plus caption **Caption with selected photo.**, ready to Post.

![21.gifts welcome composer photo and text](images/welcome-composer-photo-and-text.png)

### Variant: composer-photos-and-text

Two JPEG previews plus caption **Caption with selected photos.**, ready to Post.

![21.gifts welcome composer photos and text](images/welcome-composer-photos-and-text.png)

### Variant: composer-video

MP4 preview in the composer and **Remove video**; textarea empty.

![21.gifts welcome composer video](images/welcome-composer-video.png)

### Variant: composer-video-and-text

Video preview plus caption **Caption with selected video.**, ready to Post.

![21.gifts welcome composer video and text](images/welcome-composer-video-and-text.png)

### Variant: composer-text-after-remove

After **Remove photo**, caption **Caption kept after removing photo.** remains; preview gone.

![21.gifts welcome composer text after remove](images/welcome-composer-text-after-remove.png)

### Variant: preparing-photo

Attach in flight (Post disabled + spinner, no preview yet). Native file picker is OS chrome and is not a variant.

![21.gifts welcome preparing photo](images/welcome-preparing-photo.png)

### Variant: preparing-photo-and-text

Same spinner, caption **Caption while the photo is preparing.** already in the textarea.

![21.gifts welcome preparing photo and text](images/welcome-preparing-photo-and-text.png)

### Variant: posting-photo-and-text

Post in flight: spinner on **Post**, composer disabled, preview and caption **Caption while the post is in flight.** still shown.

![21.gifts welcome posting photo and text](images/welcome-posting-photo-and-text.png)

### Variant: photo-loading

Forum row for Ada with caption **Caption waiting for the photo to load.** and `hasPhoto`, image bytes not yet loaded so no `<img>`. A failed photo fetch looks the same (text-only row) — not a separate variant.

![21.gifts welcome photo loading](images/welcome-photo-loading.png)

### Variant: error-unsupported

Attach a GIF → **Use a JPEG, PNG, or WebP photo, or an MP4, WebM, or MOV video**.

![21.gifts welcome error unsupported](images/welcome-error-unsupported.png)

### Variant: error-unsupported-with-text

Same alert with caption **Caption with an unsupported photo.** still in the composer.

![21.gifts welcome error unsupported with text](images/welcome-error-unsupported-with-text.png)

### Variant: error-too-large

Encoded JPEG over 1 MB → **Keep photos under 1 MB and videos under 32 MB**.

![21.gifts welcome error too large](images/welcome-error-too-large.png)

### Variant: error-too-many

Eleven files → **You can add up to 10 photos**.

![21.gifts welcome error too many](images/welcome-error-too-many.png)

### Variant: error-too-large-with-text

Same alert with caption **Caption with a photo that is too large.** still in the composer.

![21.gifts welcome error too large with text](images/welcome-error-too-large-with-text.png)

### Variant: error-too-many-with-text

Same 11-file tooMany alert with caption **Caption with too many photos.** still in the composer.

![21.gifts welcome error too many with text](images/welcome-error-too-many-with-text.png)

### Variant: error-request-photo-and-text

POST fails after caption+JPEG → **Could not post your message**; preview and caption remain.

![21.gifts welcome error request photo and text](images/welcome-error-request-photo-and-text.png)

### Variant: menu-open

Open **Menu** top-right → Menu includes **Home** first (Home, Profile, Living room rules, Trust Chain, Notifications, Messages, Contact, optional Install, Log out, then a quiet **Version {sha}** line (`app.version`)). Profile is one line (User + Profile; ₿ totals on the right only when a side is non-zero). Notifications shows an unread count on the right only when `unreadCount` > 0 (Ada’s default shot is 0, so no count). Messages shows a count on the right only when inbox unread > 0; Ada’s default shots are 0 so no number. Ada’s default welcome-menu shot has zeros, so no ₿ totals on the right. Living room rules and Contact each have an icon, optional **Install app** when an install offer exists, Log out, then a quiet **Version {sha}** line (`app.version`). Language, theme, and number format live on `/profile`, not in this Menu. With both totals zero, the Profile link’s accessible name is Profile; otherwise it includes only the visible non-zero indicator labels. Other accessible names are unchanged. No English / Deutsch / Español / Filipino option rows. No native language select.
![21.gifts welcome menu](images/welcome-menu.png)

### Variant: menu-unread

Open **Menu** with `unreadCount` 3 stubbed on `GET /forum/notifications` → Notifications shows **3** on the right (`nav.notificationsUnread`, accessible name Notifications, 3 unread). Messages shows a count on the right only when inbox unread > 0; Ada’s default inbox unread is 0 so no number. Other Menu rows match `menu-open` (Ada’s totals still zero). The installed PWA home-screen badge is the sum of notification unread and inbox unread. The Menu still splits the two counts (Notifications vs Messages).

![21.gifts welcome menu unread](images/welcome-menu-unread.png)

### Variant: menu-inbox-unread

Open **Menu** with two unread inbox rows stubbed on `GET /conversations` → Messages shows **2** on the right (`nav.inboxUnread`, accessible name Messages, 2 unread). Notifications stay at count 0. Other Menu rows match `menu-open`.

![21.gifts welcome menu inbox unread](images/welcome-menu-inbox-unread.png)

### Variant: pay-amount

Payable reply after **Show reactions**, Gift opened, amount filled, not submitted. Amount CTA is **Pay** (`forum.payNow`) on iPhone/iPod and **Continue** (`forum.payContinue`) on desktop. Live equivalent in the preferred fiat (no picker). No error, no payment QR, no wallet **Pay** button yet. The post itself does not show Send Bitcoin.

![21.gifts welcome pay amount](images/welcome-pay-amount.png)

### Variant: pay-qr

Payable reply, Gift amount submitted. Captured at desktop and mobile. On desktop the invoice card shows the Bitcoin payment QR, a top-left back control, and a **Pay** button with the Wallet of Satoshi icon. On a smartphone the amount form stays: disabled minted amount, the same **Pay** button, **Waiting for payment…** under it, back control, no QR. The preferred-fiat line is on **pay-amount** (rate stub); these invoice-step shots use the empty stats mock and stay ₿-only.

![21.gifts welcome pay QR](images/welcome-pay-qr.png)

### Variant: pay-smartphone

Same pay sheet captured at desktop and mobile. On a smartphone user-agent: the amount form stays after mint (disabled minted amount, **Pay** button with the Wallet of Satoshi icon, **Waiting for payment…** under it, back control, no QR). The preferred-fiat line is on **pay-amount** (rate stub); these invoice-step shots use the empty stats mock and stay ₿-only. On desktop this scenario shows the QR invoice card.

![21.gifts welcome pay smartphone](images/welcome-pay-smartphone.png)

### Variant: pay-author-wallet

Payable reply, Gift amount submitted, but the author's wallet cannot mint a zap invoice. The pay sheet stays on the amount form and shows **The author's wallet cannot receive this Bitcoin payment**. Amount CTA is **Pay** (`forum.payNow`) on iPhone/iPod and **Continue** (`forum.payContinue`) otherwise. No payment QR and no invoice-step **Pay with Wallet of Satoshi** button.

![21.gifts welcome pay author wallet](images/welcome-pay-author-wallet.png)

### Variant: role-hint

Carol's **Verified** tag clicked; the explanation under that card header is visible (**A moderator has met this person in real life and confirmed they are real.**). Bob stays without a pill; Ada still shows **Moderator**.

![21.gifts welcome role hint](images/welcome-role-hint.png)

### Variant: overlay-address

Named member with living-room rules agreed and no Wallet of Satoshi address. Composer filled, **Post** clicked. `RequirementsOverlay` dialog **Add your Wallet of Satoshi address** with the profile Lightning Address field (`LightningAddressForm variant=profile`). No **Skip**. Close (X) is present.

![21.gifts welcome overlay address](images/welcome-overlay-address.png)

### Variant: overlay-introduce

Named member with living-room rules agreed, a Wallet of Satoshi address, and `hasPosted` false. After login on `/welcome`, `IntroduceYourselfOverlay` dialog **Introduce yourself** with body copy and **Write an introduction**. Close (X) is icon-only.

- **Actions:** Close dismisses this mount only. **Write an introduction** (`Button` `type="button"` `size="lg"`) dismisses the overlay, focuses the welcome composer (`requestForumCompose` / `FORUM_COMPOSE_EVENT`), and `router.push('/welcome')` only when the path is not already `/welcome`.

![21.gifts welcome overlay introduce](images/welcome-overlay-introduce.png)

### Variant: overlay-external-link

Named member with living-room rules dismissed and a paid forum note whose body is `New:` plus `https://example.com/phish`. Clicking that URL opens `ExternalLinkWarning` dialog **Open external link?** with the catalog body, the destination URL as `break-all` text, labeled **Open link**, and icon-only Close. Internal 21.gifts URLs on the same board do not open this overlay.

- **Actions:** Close dismisses without opening. **Open link** (`Button` `type="button"` `size="lg"`) confirms and hands the https URL to `openInSystemBrowser`.

![21.gifts welcome overlay external link](images/welcome-overlay-external-link.png)

## Screen: /rules

- **URL:** `/rules` — public living-room rules. App chrome (semantic tokens; not the dark marketing shell). No auth gate to view; chrome depends on hydrated session.
- **What the user sees:** Page heading **Living room rules**, then the lead paragraph with the accent-bordered **The test** callout, three rule cards (kicker **Rule n**, title, body, and a **The test** callout on rules 1 and 2), the Welcome / Allowed / Better not / Forbidden lists as bordered cards with check / minus / cross glyphs (Forbidden has three subheads), the muted **Our house** closing block, and CTAs **Contact 21.gifts** (`/contact`) and **Back to the forum** (`/welcome`). Unsigned (no session): Wordmark → `/`, LanguageSwitcher. Hydrated session: `ProfileChromeLeft` (back + wordmark → `/welcome`) + `SignedInChrome` (Menu with **Home** first). Signed-in chrome may show `IntroduceYourselfOverlay` when `setup` is null and `hasPosted` is false.
- **Actions:** Change language (unsigned), or open **Menu** / back to the forum (signed-in). Read the rules. Open contact or the forum. Dismiss `IntroduceYourselfOverlay` for this mount (Close) or **Write an introduction** (dismisses, focuses the welcome composer via `requestForumCompose` / `FORUM_COMPOSE_EVENT`; `router.push('/welcome')` only when the path is not already `/welcome`).
- **Calls:** `RulesPageChrome`, `PageChrome`, `AppShell`, `Wordmark`, `ProfileChromeLeft`, `SignedInChrome`, `IntroduceYourselfOverlay`, `RulesPage`, `RulesDocument`, `LanguageSwitcher`.
- **Auth:** None required to view; chrome depends on hydrated session.

### Variant: default

Full rules body with rule card **Only free donations** visible.

![21.gifts living room rules](images/rules.png)

### Variant: signed-in

Hydrated Ada session: icon-only back + wordmark → `/welcome`, **Menu** top-right (**Home** first). Rule card **Only free donations** still visible.

![21.gifts living room rules signed in](images/rules-signed-in.png)

## Screen: /contact

- **URL:** `/contact` — signed-in in-app contact (the only way to reach 21.gifts). Same onboarding gate as `/welcome` (`account.setup` null; name and address may be skipped; living-room rules agreement required).
- **What the user sees:** Fill `AppShell` with back (`ProfileChromeLeft`) + wordmark → `/welcome` top-left and one **Menu** top-right; open it for **Home**, Profile, **Living room rules**, **Trust Chain**, **Notifications**, **Messages**, **Contact**, optional **Install app**, and **Log out**. Heading **Contact**, lead **Write to 21.gifts here — there is no email address. This is the only way to reach us.**, link to **Living room rules**, composer textarea with an icon-only **Send** control (`contact.send` catalog `aria-label`, no visible Send text). A missing name or rules agreement opens `RequirementsOverlay` (no Skip) before the send retries. Lightning Address is not required for contact. A successful send opens the official 21.gifts thread in `/messages`. Signed-in chrome may show `IntroduceYourselfOverlay` when `setup` is null and `hasPosted` is false.
- **Actions:** Send a message, complete a `RequirementsOverlay` for a missing name or rules agreement, open the rules; back to the forum; open **Menu** for **Home**, Profile, **Living room rules**, **Trust Chain**, **Notifications**, **Messages**, **Contact**, optional **Install app**, or **Log out**; dismiss `IntroduceYourselfOverlay` for this mount or follow **Write an introduction** to `/welcome`.
- **Calls:** `AppShell`, `ProfileChromeLeft`, `ContactPage`, `ContactLoader`, `ContactScreen`, `RequirementsOverlay`, `SignedInChrome`, `IntroduceYourselfOverlay`, `OnboardingGate`, `postContact` (`POST /contact/submit`), `fetchConversations`.
- **Auth:** Bearer session; `OnboardingGate screen="welcome"`.

### Variant: default

Idle composer with lead and rules link.

![21.gifts contact](images/contact.png)

### Variant: validation-error

Click **Send** with an empty composer → **Enter a message**.

![21.gifts contact validation error](images/contact-validation-error.png)

### Variant: success

After a successful send the app navigates to `/messages?c=` and shows the official **21.gifts** thread (the message body, not a dead-end thank-you sentence).

![21.gifts contact success](images/contact-success.png)

## Screen: /members/[accountId]

- **Purpose:** Signed-in member identity card (chart, About me inside the card — not a forum post, name, location, Lightning Address, role pill, copy-profile-link, and clickable post/reply counts from `postCount` / `replyCount`) with on-demand activity feeds below the card. Location is read-only. Own profiles use this route too (forum author names navigate here, not `/profile`). When the viewer is founder or moderator and the subject is someone else, staff Trust Chain actions appear on the card (Verify, Propose, Confirm, or Appoint; already-on-chain is a link). About me is not a `ForumBoard` post; labeled **Translate** sits on feed note/reply bodies via `NoteTranslate` when the language differs from the UI locale (not on About me). The in-card reply composer includes an **Amount** sats field; empty text and an empty amount invoices 21 sats; a reply with text and an empty amount is unpaid for the parent author, a moderator, the founder, or a verified member, otherwise 1 sat; an amount of 0 is billed as 1 sat. Visible inline photos on the posts feed and replies feed (the stacked activity list) load via `fetchMessagePhoto` blob URLs, same as the home forum top-level cards. Blob URLs may also be fetched for expanded thread replies, but ForumBoard does not paint photos on nested replies. A missing name, Lightning Address, or rules agreement on a reply opens `RequirementsOverlay` (no Skip). Signed-in chrome may show `IntroduceYourselfOverlay` when `setup` is null and `hasPosted` is false.
- **Inputs:** Bearer session; `accountId` UUID; `GET /forum/members/:id` for the profile and activity counts; `GET /forum/members/:id/activity` even if the Lightning Address is blank; `GET /gifts/stats` for `latestRateDay` on feed notes (display-only preferred fiat, no FiatPicker on the chart or the feed — member profiles are always signed-in); on-demand `GET /forum/members/:id/posts` or `GET /forum/members/:id/replies` for the selected feed.
- **Actions:** Open **Menu** for **Home**, Profile, **Living room rules**, **Trust Chain**, **Notifications**, **Messages**, **Contact**, optional **Install app**, or **Log out**, then a quiet **Version {sha}** line (`app.version`); icon-only back to the forum; expand role hint; copy the profile link (`profile.copyLink` **Copy link to this profile**); Message on the card when another member has a `profileMessage`; translate a foreign-language feed note or reply (**Translate** / Show original / Show translation); click **N posts** or **N reactions** to open that `ForumBoard` feed below the card, or click the pressed count again to collapse it. Posts show React and do not show Send Bitcoin; a payable reply card in the replies feed shows Gift. Expanding a reply with a `parentId` navigates to `/messages/{parentId}`. Replies from the parent author, moderator, founder, or verified may post unpaid. When a listed feed is shorter than its count, a muted `profile.activityLatest` truncation line shows the displayed and total counts. Inline photos load via `fetchMessagePhoto` blob URLs, same as the forum. Complete a `RequirementsOverlay` for a missing name, Lightning Address, or rules agreement before a reply; dismiss `IntroduceYourselfOverlay` for this mount (Close) or **Write an introduction** (dismisses, focuses the welcome composer via `requestForumCompose` / `FORUM_COMPOSE_EVENT`; `router.push('/welcome')` only when the path is not already `/welcome`). Staff viewing another member can Verify, Propose, Confirm, or Appoint; already-on-chain is a link. No edit controls.
- **Used by:** Route `/members/[accountId]` (`MemberProfilePage` / `MemberProfileLoader` / `MemberProfileScreen`).
- **Auth:** Bearer; `OnboardingGate screen="profile"`.

### Variant: default

Member identity card with About me inside the card when `aboutMe` is set; read-only location; Message on the card when another member has a `profileMessage`. Not a forum post.

![21.gifts member profile](images/members.png)

### Variant: posts-open

Identity card with counts; posts button pressed; post card 'Second post from Carol.' in the feed.

![21.gifts member posts open](images/members-posts-open.png)

### Variant: posts-open-photo

Identity card; posts pressed; profile note hidden; the listed post has `hasPhoto` and shows the inline photo (`Photo from Carol`) above the text, same ForumBoard paint as `/welcome` `photo`.

![21.gifts member posts open with photo](images/members-posts-open-photo.png)

### Variant: posts-open-photos

Identity card; posts pressed; profile note hidden; the listed post has `hasPhoto` and `photoCount: 2` and shows two stills (`Photo from Carol`) above the text, same ForumBoard paint as `/welcome` `photos`.

![21.gifts member posts open with photos](images/members-posts-open-photos.png)

### Variant: replies-open

Identity card; replies pressed; no pinned profile-note card; reply card 'A reply from Carol.'

![21.gifts member replies open](images/members-replies-open.png)

### Variant: posts-loading

Identity card; posts count pressed; feed shows Loading…; no pinned profile-note card.

![21.gifts member posts loading](images/members-posts-loading.png)

### Variant: replies-loading

Identity card; replies count pressed; feed shows Loading…; no pinned profile-note card.

![21.gifts member replies loading](images/members-replies-loading.png)

### Variant: posts-error

Identity card; posts count pressed; feed error `Could not load messages. Please try again.` and Try again; no pinned profile-note card.

![21.gifts member posts error](images/members-posts-error.png)

### Variant: replies-error

Identity card; replies count pressed; feed error and Try again; no pinned profile-note card.

![21.gifts member replies error](images/members-replies-error.png)

### Variant: posts-truncated

Identity card; posts count 3 pressed; one listed post; muted `Showing the latest 1 of 3.`; no pinned profile-note card.

![21.gifts member posts truncated](images/members-posts-truncated.png)

### Variant: replies-truncated

Identity card; replies count 3 pressed; one listed reply; muted `Showing the latest 1 of 3.`; no pinned profile-note card.

![21.gifts member replies truncated](images/members-replies-truncated.png)

### Variant: note-null

Member identity card only (`profileMessage: null`, `aboutMe` null); copy-profile-link still on the card; no About me heading; no forum card.

![21.gifts member profile without note](images/members-note-null.png)

### Variant: missing

Malformed or unknown id → **This profile could not be found.**

![21.gifts member profile missing](images/members-missing.png)

### Variant: error

Failed fetch → error copy and **Try again**.

![21.gifts member profile error](images/members-error.png)

### Variant: own

Signed-in visitor viewing their own `/members/:id` card.

![21.gifts member profile own](images/members-own.png)

### Variant: overlay-address

Named visitor with living-room rules agreed and no Wallet of Satoshi address. Posts feed open, listed note expanded, reply filled with the **Amount** field visible, **Post** clicked. `RequirementsOverlay` dialog **Add your Wallet of Satoshi address** with the profile Lightning Address field. No **Skip**. Close (X) is present.

![21.gifts member overlay address](images/members-overlay-address.png)

### Variant: translate

Signed-in `/members/:id` with a German post in the posts feed. **Translate** is visible under the body (not in the footer icon row).

![21.gifts member translate](images/members-translate.png)

### Variant: translate-loading

Same German post after clicking **Translate** while POST `/translate` hangs. The control is busy (`aria-busy`) with a spinner.

![21.gifts member translate loading](images/members-translate-loading.png)

### Variant: translate-done

Same German post after a successful translation. Translated body plus **Show original**.

![21.gifts member translate done](images/members-translate-done.png)

### Variant: translate-hidden

After **Show original**: translated body hidden, control reads **Show translation**.

![21.gifts member translate hidden](images/members-translate-hidden.png)

### Variant: translate-error

Same German post after POST /translate fails. Alert **Could not translate this note. Please try again.** and the Translate control remains.

![21.gifts member translate error](images/members-translate-error.png)

### Variant: staff-verify

Signed-in **moderator** viewing another member who is **basis**. Staff card with **Verify** (`data-testid="state-members-staff-verify"`).

![21.gifts member staff verify](images/members-staff-verify.png)

## Screen: /profile

- **Purpose:** Signed-in profile after onboarding: compact dual-line Given/Received activity chart (no chart FiatPicker; populated ₿ | selected fiat `SegmentedControl tone="gift"`) inside the identity card, About me inside the same card (not a forum post; owner empty prompt + **Write your About me** when `aboutMe` is null and `aboutMeHasPhoto` is false; filled text and/or photo otherwise, with attach, preview, and remove in the editor), copy-profile-link on the card, edit name, location (Ort), and Wallet of Satoshi address, choose a three-stage notification level (All / Active / Mentions `SegmentedControl tone="neutral"`) plus the existing icon-only Web Push bell (incoming pushes always show an OS banner, including when a 21.gifts tab is focused), choose language (uppercase kicker, one-row `SegmentedControl tone="neutral"` same as Theme, endonyms English / Deutsch / Español / Filipino), then appearance (System / Light / Dark), then preferred fiat (`FiatPreferenceSwitcher`, the only signed-in FiatPicker, same pill chrome as Theme, not the compact orange gift picker), then number format (`NumberFormatSwitcher`, uppercase kicker, `SegmentedControl tone="neutral"`, samples `10'000.23` / `10,000.23` / `23.000,33`) as the last identity-card settings row, return to the forum via an icon-only back control. Menu starts with **Home**; given/received totals only when that side is non-zero. Signed-in chrome may show `IntroduceYourselfOverlay` when `setup` is null and `hasPosted` is false.
- **Inputs:** Session account (name + location + Lightning Address + `viewKey` + `aboutMe` + `aboutMeHasPhoto` + living-room rules agreement + optional `notificationLevel`) via `OnboardingGate` / `useAuthStore`; Given + Received from `GET /me/activity` via `useAccountTotals` / `fetchAccountActivity`. Fetch even with a blank Lightning Address. About me save is `PUT /me/about` (`putAboutMe`). Location save is `POST /me/location` (`setLocation`). Notification level save is `POST /me/notification-level` (`postNotificationLevel`).
- **Actions:** Open **Menu** for **Home**, Profile (current), **Living room rules**, **Trust Chain**, **Notifications**, **Messages**, **Contact**, optional **Install app**, or **Log out** (best-effort Web Push unsubscribe while the session is still valid), then a quiet **Version {sha}** line (`app.version`); icon-only back (top-left) to the forum; write or edit About me; copy the profile link (`profile.copyLink` **Copy link to this profile** → origin `/view/<viewKey>`, URL/key not shown); save name; save or clear location; link or change address; choose All / Active / Mentions on the Notifications `SegmentedControl tone="neutral"` under the address form plus the existing icon-only Web Push bell (visible On/Off value; icon-only Bell `IconButton` — off outlined BellOff secondary, on filled Bell primary; aria from `profile.push.enable` / `profile.push.disable`); choose language on the Language settings row after notifications (`LanguagePreferenceSwitcher`, uppercase kicker, one-row `SegmentedControl tone="neutral"` same as Theme, endonyms English / Deutsch / Español / Filipino); choose System / Light / Dark (`ThemeSwitcher`, `SegmentedControl tone="neutral"`); choose preferred fiat on the Fiat currency settings row (`FiatPreferenceSwitcher`, same pill chrome as Theme, not the compact orange gift picker — the only signed-in control that writes the `fiat` cookie); choose number format on the last identity-card settings row (`NumberFormatSwitcher`, uppercase kicker, `SegmentedControl tone="neutral"`, samples `10'000.23` / `10,000.23` / `23.000,33`); when the series has data, toggle the activity chart between ₿ and the selected fiat. On iPhone Safari outside standalone, a short install hint (`profile.push.installHint`) appears above the value row; dismiss `IntroduceYourselfOverlay` for this mount (Close) or **Write an introduction** (dismisses, focuses the welcome composer via `requestForumCompose` / `FORUM_COMPOSE_EVENT`; `router.push('/welcome')` only when the path is not already `/welcome`).
- **Used by:** Route `/profile` (`ProfilePage`).

### Variant: default

Heading **Profile**, then inside the single `max-w-sm` identity card: no chart FiatPicker. When the series is empty, `profile.chartEmpty` (`role="status"`, **No gifts yet.**) with no axis/SVG / no ₿|fiat scale; otherwise a compact Given/Received chart (legend left, ₿ | selected fiat `SegmentedControl tone="gift"` right; no chart title heading); About me with empty prompt **Tell others who you are.** and **Write your About me** when `aboutMe` is null (not a forum post); icon-only **Copy link to this profile**; name, location (**Location** / **Ort**, unset shows **Not set**), and Wallet of Satoshi address fields with icon actions to the right (pencil / check / X / trash), a Notifications section under the address form with a three-stage All / Active / Mentions `SegmentedControl tone="neutral"` plus the existing icon-only bell with visible On/Off (same `IconButton` circle as pencil/trash; off outlined BellOff secondary, on filled Bell primary), then a Language settings row (uppercase kicker and one-row `SegmentedControl tone="neutral"` same as Theme, English / Deutsch / Español / Filipino), then a Theme settings row (uppercase kicker and `SegmentedControl tone="neutral"` System / Light / Dark), then a Fiat currency settings row (`FiatPreferenceSwitcher`, the only FiatPicker on the card, same pill chrome as Theme, not the compact orange gift picker; CHF|EUR|USD|PHP), then a Number format settings row (uppercase kicker and `SegmentedControl tone="neutral"` samples `10'000.23` / `10,000.23` / `23.000,33`); no **View key** heading and no visible URL/key text. No second panel below the card. Icon-only back top-left next to the wordmark (returns to the forum); one **Menu** top-right (**Home** first; log out, then a quiet **Version {sha}** line (`app.version`); given/received totals only when that side is non-zero). Chart never swaps to **Loading…**.

![21.gifts profile](images/profile.png)

### Variant: fiat

Viewport after scrolling the identity-card **Fiat currency** row into view (CHF | EUR | USD | PHP). Default capture is full-page on document scroll; this variant is viewport-only after `scrollIntoViewIfNeeded`.

![21.gifts profile fiat](images/profile-fiat.png)

### Variant: receive

Filtered receive series with three UTC days (including a zero-gap day) and received total ₿1'500. Chart shows day ticks such as **2026-06-01**; Given stays flat at zero with a visible legend.

![21.gifts profile receive](images/profile-receive.png)

### Variant: usd-scale

Same receive stub as **receive**, with the fiat scale selected and USD pressed (`Given and received in USD`).

![21.gifts profile USD scale](images/profile-usd-scale.png)

### Variant: single-day

One receive day (₿21 on **2026-06-01**). Chart draws a horizontal single-point line.

![21.gifts profile single day](images/profile-single-day.png)

### Variant: large-usd

Two-day series with cumulative USD **1425.00**, scale switched to USD so the axis shows **$1'425** (Swiss default grouping).

![21.gifts profile large USD](images/profile-large-usd.png)

### Variant: given-received

Both series non-zero: received ₿1,500 over three UTC days and given ₿2,100 on **2026-06-02**. Chart shows Given and Received together. Needle `state-profile-given-received`.

![21.gifts profile given and received](images/profile-given-received.png)

### Variant: about-filled

Owner card with a real bio not equal to the display name. Seed GET /me with `name: 'Ada'`, `aboutMe: 'I build on Bitcoin'`, setup complete. Shows filled About me text plus the icon-only pencil (`Edit About me`), not the empty CTA (`Tell others who you are.` / **Write your About me**).

![21.gifts profile About me filled](images/profile-about-filled.png)

### Variant: about-photo

Owner card with bio and photo. Seed GET /me with `aboutMe: 'I build on Bitcoin'`, `aboutMeHasPhoto: true`. Stub GET `/me/about/photo` 200 JPEG. Shows the stored image (`About me photo`), the bio text, and the icon-only pencil (`Edit About me`), not the empty CTA.

![21.gifts profile About me photo](images/profile-about-photo.png)

### Variant: about-editing

Owner in the About me textarea editor. From the empty CTA, click **Write your About me** (empty→Write is enough). Needle: `getByRole('textbox', { name: 'About me' })` / **Save About me** icon button. Save/cancel are icon-only IconButtons (`getByRole` + catalog text is not visible). textarea uses `text-base`.

![21.gifts profile About me editing](images/profile-about-editing.png)

### Variant: about-save-error

Owner editor with `role="alert"` save error after stubbing PUT /me/about to 500, opening the editor from empty, and clicking Save. Copy **Could not save. Please try again.**

![21.gifts profile About me save error](images/profile-about-save-error.png)

### Variant: notification-level-error

Notifications section with `role="alert"` save error after stubbing POST /me/notification-level to 500 and clicking Active. Copy **Could not save notification level.**

![21.gifts profile notification level error](images/profile-notification-level-error.png)

### Variant: push-enable-error

Notifications section with `role="alert"` after clicking Enable notifications when Web Push is present but enable fails. Copy **Notifications are not available in this browser.**

![21.gifts profile push enable error](images/profile-push-enable-error.png)

## Screen: /messages

- **URL:** `/messages` — signed-in private-message inbox. Same onboarding gate as `/welcome`. Public notes stay at `/messages/[id]`.
- **What the user sees:** Fill `AppShell` (`align="center"`) with `MessagesChromeLeft` + wordmark → `/welcome` top-left and one **Menu** top-right; open it for **Home**, Profile, **Living room rules**, **Trust Chain**, **Notifications**, **Messages**, **Contact**, optional **Install app**, and **Log out**. List chrome back is **Back to the forum** → `/welcome`; open thread (`?c=` non-empty) chrome back is **All conversations** → `/messages`; wordmark always `/welcome`. Heading **Messages**. Members see the unfiltered inbound list (all origins) with no `SegmentedControl`. Founder/moderator see **Direct** | **Contact** | **Damus** (default **Direct**, one row) and a list of that origin only. Origin labels on rows stay for everyone. A `moderator_group` row is never listed; the closed staff room lives on `/moderate/group`. Member empty copy is **No private messages yet.** without the control; staff empty stays per-filter (**No private messages yet.** / **No contact messages yet.** / **No Damus messages yet.**) with the control visible. **Loading…** and **Try again** hide the control. Unread inbound rows are semibold with `text-app-fg` last text (`inbox.threadUnread`); read inbound last text is a muted left preview; outbound last text is a filled right chip (`You: {text}`); gift-only last messages show the formatted amount. Open a thread (`?c=`) for oldest-first messages and a 500-character composer plus sats amount field (no filter): incoming bubbles are full-width muted note cards, sent bubbles are filled `app-btn` on the right labelled **You**. Opening a thread POSTs `/conversations/:id/read` and refreshes the home-screen badge. The open-thread heading is only the counterpart name + origin caption (no in-card back); the origin label sits under it, not inside the h1. Signed-in chrome may show `IntroduceYourselfOverlay` when `setup` is null and `hasPosted` is false.
- **Actions:** Open a thread, send a reply, return via **All conversations** (chrome link), back to the forum. Open the counterpart (and incoming author) name to `/members/:id` when `accountId` is present. Open **Menu** for **Home**, Profile, **Living room rules**, **Trust Chain**, **Notifications**, **Messages**, **Contact**, optional **Install app**, or **Log out**. Member-profile Message and `/contact` send land here; dismiss `IntroduceYourselfOverlay` for this mount or follow **Write an introduction** to `/welcome`.
- **Calls:** `AppShell`, `MessagesChromeLeft`, `ProfileChromeLeft`, `MessagesPage`, `InboxLoader`, `InboxScreen`, `SignedInChrome`, `IntroduceYourselfOverlay`, `OnboardingGate`, `fetchConversations`, `fetchConversation`, `fetchModeratorGroup` (founder or moderator, unlisted `?c=` only), `postConversationMessage`, `postConversationInvoice`, `markConversationRead`, `refreshUnreadAppBadge`.
- **Auth:** Bearer session; `OnboardingGate screen="welcome"`.

### Variant: default

Member list. No chooser. All inbound origins: **Bob**, official **21.gifts**, and **npub1abc…xyz**.

![21.gifts inbox](images/messages.png)

### Variant: unread

Member list with an unread Direct row **Bob** (`inbox.threadUnread`, accessible name Bob, Unread): semibold name and `text-app-fg` last text. Other rows remain read/muted.

![21.gifts inbox unread](images/messages-unread.png)

### Variant: contact

Staff (moderator). Contact selected. List shows official **21.gifts**. Chooser present. No pinned Staff room / Moderators row.

![21.gifts inbox contact](images/messages-contact.png)

### Variant: damus

Staff (moderator). Damus selected. List shows **npub1abc…xyz**. Chooser present. No pinned Staff room / Moderators row.

![21.gifts inbox damus](images/messages-damus.png)

### Variant: sent-preview

Member. No chooser. Loaded list whose last text is the viewer's own send (**Bob**, `Hello team`). Preview **You: Hello team** as a compact filled chip on the right of the muted row, not muted body text.

![21.gifts inbox sent preview](images/messages-sent-preview.png)

### Variant: empty

Member. No threads. Copy **No private messages yet.** Chooser absent.

![21.gifts inbox empty](images/messages-empty.png)

### Variant: loading

Waiting on `GET /conversations`. Copy **Loading…** Chooser absent.

![21.gifts inbox loading](images/messages-loading.png)

### Variant: error

List fetch failed. Button **Try again**. Chooser absent.

![21.gifts inbox error](images/messages-error.png)

### Variant: thread

Open official thread. Heading **21.gifts** (a profile control when the api sent `accountId`), origin **Contact** under the heading, inbound **Hello team** as a full-width muted note card and a sent filled `app-btn` bubble on the right labelled **You**, composer visible with the labeled **Amount** field next to it. Chooser absent.

![21.gifts inbox thread](images/messages-thread.png)

### Variant: sent-sats

Member list. One conversation (**Bob**), gift-only last preview **₿21** (empty lastText, lastFromMe, lastSats 21). Chooser absent.

![21.gifts inbox sent sats](images/messages-sent-sats.png)

### Variant: thread-gift

Open official thread. fromMe gift-only bubble **send ₿21**. Labeled **Amount** field still visible next to the composer. Chooser absent.

![21.gifts inbox thread gift](images/messages-thread-gift.png)

### Variant: thread-text-sats

Open thread. Inbound **Hi** with amount **₿21** under the body. Composer and labeled **Amount** field visible.

![21.gifts inbox thread text sats](images/messages-thread-text-sats.png)

### Variant: thread-pay-qr

Open thread, Amount **21** submitted. Pay sheet open with **Pay with Wallet of Satoshi**. Captured at desktop and mobile (same variant, four combos). Desktop shows the Bitcoin payment QR plus the wallet **Pay** button; smartphone has the wallet **Pay** button and no QR. **Waiting for payment…** is acceptable while the pay poll hangs.

![21.gifts inbox thread pay QR](images/messages-thread-pay-qr.png)

## Screen: /notifications

- **URL:** `/notifications` — signed-in notifications for living-room posts, replies, payments, and moderator appointment. Same onboarding gate as `/welcome`. Public notes stay at `/messages/[id]`. JSON is `/forum/notifications` (Next.js forbids `route.ts` beside this page).
- **What the user sees:** Fill `AppShell` (`align="center"`) with back (`ProfileChromeLeft`) + wordmark → `/welcome` top-left and one **Menu** top-right; open it for **Home**, Profile, **Living room rules**, **Trust Chain**, **Notifications**, **Messages**, **Contact**, optional **Install app**, and **Log out**. Heading **Notifications**, a list of posts, replies, payments, and moderator appointment (actor `{name} posted` / `{name} replied` / `{name} sent bitcoin`, or **You are a moderator** without `{name}`; post or reply text or **Photo** / **Photo reaction**; zap amount as stored; appointment with empty text has no body line; time), empty copy **No notifications yet.**, **Loading…**, or **Try again**. Unread rows are semibold; read rows muted. No composer and no filter. Signed-in chrome may show `IntroduceYourselfOverlay` when `setup` is null and `hasPosted` is false. Visiting this screen / mark-all-read does not clear remaining inbox unread from the home-screen badge; the badge becomes remaining inbox unread (notifications 0).
- **Actions:** Click a `moderator_appointed` row to open `/welcome` (mark that notification read). Click any other row to open the public forum note `/messages/{parentId}` (mark that notification read). Back to the forum. Open **Menu** for **Home**, Profile, **Living room rules**, **Trust Chain**, **Notifications**, **Messages**, **Contact**, optional **Install app**, or **Log out**. Dismiss `IntroduceYourselfOverlay` for this mount or follow **Write an introduction** to `/welcome`. Visiting this screen / mark-all-read does not clear remaining inbox unread from the home-screen badge; the badge becomes remaining inbox unread (notifications 0).
- **Calls:** `AppShell`, `ProfileChromeLeft`, `NotificationsPage`, `NotificationsLoader`, `NotificationsScreen`, `SignedInChrome`, `IntroduceYourselfOverlay`, `OnboardingGate`, `fetchNotifications`, `fetchConversations`, `markNotificationRead`, `markAllNotificationsRead`.
- **Auth:** Bearer session; `OnboardingGate screen="welcome"`.

### Variant: default

Loaded list with at least one unread forum reply (actor **Bob**, copy **Bob replied**).

![21.gifts notifications](images/notifications.png)

### Variant: empty

No notifications. Copy **No notifications yet.**

![21.gifts notifications empty](images/notifications-empty.png)

### Variant: loading

Waiting on `GET /forum/notifications`. Copy **Loading…**

![21.gifts notifications loading](images/notifications-loading.png)

### Variant: error

List fetch failed. Button **Try again**. Copy **Could not load notifications. Please try again.**

![21.gifts notifications error](images/notifications-error.png)

## Screen: /moderate

- **URL:** `/moderate` — signed-in moderation hub for founders and moderators. Same onboarding gate as `/welcome` (`OnboardingGate screen="welcome"`). HTML `/moderate` is the hub, not a GET proxy; this page does not fetch hidden notes or proposals. JSON for hidden notes lives under `/forum/messages/hidden`; JSON for open proposals lives under `/trust/proposals` (Next.js forbids `route.ts` beside this page).
- **What the user sees:** Fill `AppShell` (`align="center"`) with back (`ProfileChromeLeft`) + wordmark → `/welcome` top-left and one **Menu** top-right. Heading **Moderation**. Staff (founder or moderator) see hub lead **Tools for founders and moderators.**, the hide-tool lead, a labeled **Hidden notes** `ButtonLink` (`variant="secondary"` `size="lg"`) to `/moderate/hidden`, and a labeled **Open proposals** `ButtonLink` (`variant="secondary"` `size="lg"`) to `/moderate/proposals`. Founders and moderators also see **Moderators** `ButtonLink` → `/moderate/group` with lead **Closed staff room for founders and moderators.** Non-staff signed-in visitors see the heading plus **This page is for founders and moderators.** and no tools list. Menu row **Moderation** (`nav.moderate`, lucide `Shield`, `/moderate`) only for founder|moderator, after Trust Chain. Menu has no Open proposals row.
- **Actions:** Open **Hidden notes** to `/moderate/hidden`. Open **Open proposals** to `/moderate/proposals`. Founders and moderators also open **Moderators** to `/moderate/group`. Back to the forum. Open **Menu**. No list fetch and no un-hide control on this page. Hub does not fetch proposals.
- **Calls:** `AppShell`, `ProfileChromeLeft`, `ModeratePage`, `ModerateScreen`, `SignedInChrome`, `OnboardingGate`.
- **Auth:** Bearer session; `OnboardingGate screen="welcome"`. Hub tools only for `role` founder|moderator; others see forbidden copy and do not fetch.

### Variant: default

Staff (founder) hub with heading **Moderation**, hub lead **Tools for founders and moderators.**, hide-tool lead, labeled **Hidden notes** control → `/moderate/hidden`, labeled **Open proposals** control → `/moderate/proposals`, and **Moderators** control → `/moderate/group` with lead **Closed staff room for founders and moderators.**

![21.gifts moderation](images/moderate.png)

### Variant: forbidden

Signed-in basis account. Copy **This page is for founders and moderators.** No tools list.

![21.gifts moderation forbidden](images/moderate-forbidden.png)

## Screen: /moderate/hidden

- **URL:** `/moderate/hidden` — signed-in hidden-notes list for founders and moderators. Same onboarding gate as `/welcome` (`OnboardingGate screen="welcome"`). HTML `/moderate/hidden` is the hidden-notes page, not a GET proxy. JSON is `/forum/messages/hidden` (Next.js forbids `route.ts` beside this page).
- **What the user sees:** Fill `AppShell` (`align="center"`) with back (`ProfileChromeLeft`) + wordmark → `/welcome` top-left and one **Menu** top-right. In-card icon back to `/moderate`. Heading **Hidden notes**. Staff (founder or moderator) see the lead copy about a soft hide (the note and its untagged direct replies leave the living room; not a hard delete), then the hidden-note list newest-hidden first (author, a non-interactive **Visitor** badge next to the name when the row has a `via` value, text, **Hidden by {name}** / **Unnamed**, created and hidden times), empty copy **No hidden notes.**, **Loading…**, or **Try again**. Non-staff signed-in visitors see the heading plus **This page is for founders and moderators.** and no list. No un-hide control. No hidden photo/video fetch.
- **Actions:** In-card icon back to the hub `/moderate`. Back to the forum. Open **Menu**. Staff **Try again** on list error. No un-hide control on this page.
- **Calls:** `AppShell`, `ProfileChromeLeft`, `HiddenNotesPage`, `HiddenNotesScreen`, `SignedInChrome`, `OnboardingGate`, `listHiddenMessages`.
- **Auth:** Bearer session; `OnboardingGate screen="welcome"`. List only for `role` founder|moderator; others see forbidden copy and do not fetch.

### Variant: default

Staff (founder) loaded list with at least one hidden note (author **Bob**, text **Hidden note**, **Hidden by Ada**).

![21.gifts hidden notes](images/moderate-hidden.png)

### Variant: visitor

Staff (founder) loaded list with one hidden note written without a 21.gifts account (author **Robin**, text **Hidden visitor note**, the non-interactive **Visitor** badge next to the name, **Hidden by Ada**).

![21.gifts hidden notes visitor](images/moderate-hidden-visitor.png)

### Variant: forbidden

Signed-in basis account. Copy **This page is for founders and moderators.** No list.

![21.gifts hidden notes forbidden](images/moderate-hidden-forbidden.png)

### Variant: empty

Staff (founder) loaded list with zero hidden notes. Copy **No hidden notes.**

![21.gifts hidden notes empty](images/moderate-hidden-empty.png)

### Variant: loading

Staff (founder) waiting on `GET /forum/messages/hidden`. Copy **Loading…**

![21.gifts hidden notes loading](images/moderate-hidden-loading.png)

### Variant: error

Staff (founder) list fetch failed. Button **Try again**.

![21.gifts hidden notes error](images/moderate-hidden-error.png)

## Screen: /moderate/proposals

- **URL:** `/moderate/proposals` — signed-in staff confirm queue. Same onboarding gate as `/moderate`. JSON is `/trust/proposals`. Hub is `/moderate`.
- **What the user sees:** Fill `AppShell` (`align="center"`) with `ProfileChromeLeft` + **Menu**. In-card icon back to `/moderate`. Heading **Open proposals**. Staff rows: subject name (link `/members/{id}`), **Proposed by {name}**, time, **Confirm as moderator** or **Waiting for another moderator to confirm.** Empty / Loading… / error+Try again. Failed confirm: **Could not update this member. Please try again.** Non-staff: heading + forbidden copy, no list. Menu: **Moderation** only (no Open proposals row).
- **Actions:** In-card icon back to hub. Staff confirm / Try again. Open Menu. Back to the forum.
- **Calls:** `AppShell`, `ProfileChromeLeft`, `ProposalsPage`, `ProposalsScreen`, `SignedInChrome`, `OnboardingGate`, `fetchTrustProposals`, `postTrustConfirm`.
- **Auth:** Bearer; list only for founder|moderator.

### Variant: default

Staff (founder) loaded queue with at least one open proposal (subject **Rose**, **Proposed by Bob**, **Confirm as moderator**).

![21.gifts open proposals](images/moderate-proposals.png)

### Variant: forbidden

Signed-in basis account. Copy **This page is for founders and moderators.** No list.

![21.gifts open proposals forbidden](images/moderate-proposals-forbidden.png)

### Variant: empty

Staff (founder) loaded list with zero open proposals. Copy **No open proposals.**

![21.gifts open proposals empty](images/moderate-proposals-empty.png)

### Variant: loading

Staff (founder) waiting on `GET /trust/proposals`. Copy **Loading…**

![21.gifts open proposals loading](images/moderate-proposals-loading.png)

### Variant: error

Staff (founder) list fetch failed. Copy **Could not load open proposals. Please try again.** Button **Try again**.

![21.gifts open proposals error](images/moderate-proposals-error.png)

### Variant: waiting-confirm

Staff (founder) row they proposed themselves. Copy **Waiting for another moderator to confirm.** No Confirm button.

![21.gifts open proposals waiting confirm](images/moderate-proposals-waiting-confirm.png)

### Variant: confirm-error

Staff (founder) Confirm as moderator failed. Copy **Could not update this member. Please try again.**

![21.gifts open proposals confirm error](images/moderate-proposals-confirm-error.png)

### Variant: confirming

Staff (founder) Confirm as moderator POST in flight. Confirm disabled with a spinner; proposal row still visible.

![21.gifts open proposals confirming](images/moderate-proposals-confirming.png)

## Screen: /moderate/group

- **URL:** `/moderate/group` — signed-in closed moderator group thread. Same onboarding gate as `/welcome` (`OnboardingGate screen="welcome"`). HTML `/moderate/group` is the group page, not a GET proxy. JSON is `/conversations/moderator-group` (Next.js forbids `route.ts` beside this page).
- **What the user sees:** Fill `AppShell` (`align="center"`) with icon back **Moderation** → `/moderate` (`ProfileChromeLeft` `backHref="/moderate"`) + wordmark → `/welcome` top-left and one **Menu** top-right. No in-card back. Heading **Moderators**. Founders and moderators fetch the singleton group then the thread and reuse `InboxScreen` (no origin filter; no in-card back). The loaded heading is the catalog label **Moderators** (never the api row name); the composer is text only (no **Amount** field, no gifts). Other signed-in visitors see heading **Moderators** plus **This room is for founders and moderators.** and do not fetch. Loading **Loading…**. Error **Try again**. Empty thread: composer visible, no messages.
- **Actions:** Chrome icon back **Moderation** → `/moderate`; wordmark → `/welcome`. Open **Menu**. Founders and moderators send a reply and **Try again** on fetch error.
- **Calls:** `AppShell`, `ProfileChromeLeft`, `ModeratorGroupPage`, `ModeratorGroupScreen`, `InboxScreen`, `SignedInChrome`, `OnboardingGate`, `fetchModeratorGroup`, `fetchConversation`, `postConversationMessage`.
- **Auth:** Bearer session; `OnboardingGate screen="welcome"`. Thread only for `role` founder|moderator; others see forbidden copy and do not fetch.

### Variant: default

Founder or moderator. Loaded group thread with message **Hello mods**. Composer visible. No origin filter.

![21.gifts moderator group](images/moderate-group.png)

### Variant: forbidden

Signed-in non-staff visitor (verified or basis). Heading **Moderators**. Copy **This room is for founders and moderators.** No thread fetch.

![21.gifts moderator group forbidden](images/moderate-group-forbidden.png)

### Variant: empty

Founder or moderator. Group exists, zero messages. Composer **Your message** visible.

![21.gifts moderator group empty](images/moderate-group-empty.png)

### Variant: loading

Founder or moderator waiting on `GET /conversations/moderator-group`. Copy **Loading…**

![21.gifts moderator group loading](images/moderate-group-loading.png)

### Variant: error

Founder or moderator fetch failed. Button **Try again**.

![21.gifts moderator group error](images/moderate-group-error.png)

## Screen: /messages/[id]

- **Purpose:** Public HTML thread by forum message UUID. Unsigned visitors see a read-only thread. Signed-in (hydrated session and account): same per-note actions as `/welcome` (copy link, Gift on a payable nested reply, expand/replies + reply composer, staff delete, author link when `accountId`). Still no `OnboardingGate`, no top-level composer, no envelope, no FiatPicker, no feed filters. Auto-expand when signed in. Fill `AppShell` (`align="center"`) via `PublicMessageChrome`. No auth gate to view; chrome depends on hydrated session. Unsigned (no session): Wordmark → `/`, light LanguageSwitcher. Hydrated session: `ProfileChromeLeft` (back + wordmark → `/welcome`) + `SignedInChrome` (Menu with **Home** first). Amounts are `formatBitcoin` plus optional preferred-fiat `·` `formatFiatDisplay` when the conversion is non-null. Labeled **Translate** / Show original / Show translation sit under the note and reply bodies via `NoteTranslate` when the language differs from the UI locale (not in the footer icon row).
- **Inputs:** Dynamic route `id` (UUID). Note from same-origin `GET /public-messages/:id` (`fetchPublicMessage`). Replies from `GET /public-messages/:id/replies` (`fetchPublicReplies`) using the parent id. If the opened note has `parentId`, a second public GET loads that parent, then its replies. Opening a reply UUID shows the parent post and all live replies; opening a parent UUID shows that post and all live replies. Both URLs stay valid (no redirect). Signed-in also auto-expands via Bearer `GET /forum/messages/:id/replies`. Optional photo via `fetchPublicMessagePhoto` → blob URL. Invalid UUID → missing without a fetch. A replies 404 after a successful parent GET is an error, not empty. Server `generateMetadata` loads api `GET /messages/:id` (via `loadPublicMessageForOg`) and sets Open Graph / Twitter tags.
- **Actions:** Change language (unsigned), or open **Menu** / **Back to the forum** (signed-in). Unsigned **Log in** → `/login` (`login.submit`) below the thread. Signed-in **Back to the forum** → `/welcome` (`profile.back`) in chrome and below the thread, plus the per-note actions above (copy link, Gift on a payable nested reply, expand/replies + reply composer, staff delete, author link when `accountId`). On fetch error, **Try again**. States reuse `view.missing` / `view.error`+retry / `forum.loading`.
- **Used by:** Route `/messages/[id]` (`PublicMessagePage`). Shared links copied from the forum board.

### Variant: default

Valid known UUID. Thread may be parent-only when replies are empty. Card with author name, timestamp, text (`Hello from Ada`), sats via `formatBitcoin` plus optional preferred-fiat `·` `formatFiatDisplay` when the conversion is non-null (otherwise ₿-only, no ` · —`), optional photo or clip-aspect `<video>`. Auth CTA below the card.

![21.gifts public message](images/messages-id.png)

### Variant: signed-in

Hydrated Ada session: icon-only back + wordmark → `/welcome`, **Menu** top-right (**Home** first). Thread card **Hello from Ada**, copy link, and **Write a reaction** (auto-expanded). Posts do not show Gift or an envelope.

![21.gifts public message signed in](images/messages-id-signed-in.png)

### Variant: missing

Unknown or malformed id. Copy **This profile could not be found.**

![21.gifts public message missing](images/messages-id-missing.png)

### Variant: loading

Waiting on the public message fetch. Copy **Loading…**

![21.gifts public message loading](images/messages-id-loading.png)

### Variant: error

Public message fetch failed. Copy **Could not load this profile. Please try again.** and **Try again**.

![21.gifts public message error](images/messages-id-error.png)

### Variant: translate

Public German note. Body is the German fixture; **Translate** is visible.

![21.gifts public message translate](images/messages-id-translate.png)

### Variant: translate-loading

After clicking **Translate** while POST `/translate` hangs. The control is busy.

![21.gifts public message translate loading](images/messages-id-translate-loading.png)

### Variant: translate-done

After successful translation: **Show original**.

![21.gifts public message translate done](images/messages-id-translate-done.png)

### Variant: translate-hidden

After **Show original**: control reads **Show translation**.

![21.gifts public message translate hidden](images/messages-id-translate-hidden.png)

### Variant: translate-error

After POST /translate 502: **Could not translate this note. Please try again.**

![21.gifts public message translate error](images/messages-id-translate-error.png)

### Variant: thread

Parent Ada “Hello from Ada” plus gift reply Pater Severin (empty text, sats 3000) showing `formatBitcoin` (`₿3'000`). Opened on the parent UUID.

![21.gifts public message thread](images/messages-id-thread.png)

### Variant: visitor-reply

Unsigned permalink card (`PublicThreadCard`). Parent Ada “Hello from Ada” plus two replies from **Robin**, who has no 21.gifts account: a gift-only reply (`₿69`) and a text reply containing `https://example.com/hello`. Each author line shows a non-interactive **Visitor** span next to the name (same slot as a role pill; not a button, no hint). The URL is visible as plain text — not a clickable link, no autolink, no quoted-note embed.

![21.gifts public message visitor reply](images/messages-id-visitor-reply.png)

### Variant: quoted-note

Public permalink of Riana Rosello's note. Cyrill's reply shows `just for information:` plus the same nested technical-note post (photo, caption, Founder, ₿43). Raw URL not visible.

![21.gifts public message quoted note](images/messages-id-quoted-note.png)

### Variant: reply

Same thread opened on the reply UUID. Parent + gift; permalink target ring (`data-permalink-target="true"`, `ring-1 ring-app-fg`) on the gift reply.

![21.gifts public message reply](images/messages-id-reply.png)

## Screen: /view/[viewKey]

- **Purpose:** Public read-only copy of the signed-in profile card (heading Profile, AccountActivityChart Given/Received with FiatPicker only while `useHydrateSession().ready && session === null`, CHF|EUR|USD|PHP, `shell="app"`; unsigned empty = picker + `profile.chartEmpty` with no SVG / no ₿|fiat scale; signed-in empty = `profile.chartEmpty` alone; populated ₿ | selected fiat; About me inside the identity card — not a forum post, with the photo when `aboutMeHasPhoto` — name + location + Wallet of Satoshi address fields) without edit/Message/back/menu/logout. Copy-profile-link on the card. Capability URL `/view/<64-hex>`; key/URL not shown as visible text. No `OnboardingGate` on this route.
- **Inputs:** Dynamic route `viewKey` (must be 64 lowercase hex). Profile from same-origin `GET /view-key/:viewKey` (`fetchViewProfile`); Given + Received from `GET /view-key/:viewKey/activity` (`fetchViewActivity`). Fetch even when address is blank; activity failure keeps the card with empty series. Identity still `GET /view-key/:viewKey`.
- **Actions:** Change language (`HomeWordmark` top-left: `/` when unsigned, `/welcome` when a session is hydrated; light language switcher top-right). Copy the profile link on the card (`profile.copyLink` **Copy link to this profile** → the current view URL). On profile fetch error, **Try again**. Unsigned empty series shows FiatPicker + `profile.chartEmpty`; signed-in empty is `profile.chartEmpty` alone. A filled series can switch scale between ₿ and the selected fiat. When unsigned, pick CHF|EUR|USD|PHP on the chart FiatPicker. When the card is ready and `hasPasskey` is false in a real browser: yellow banner under the card via `ViewProfileClaim` with **Action required, the account must be activated** and **Activate** — including when another 21.gifts account is already signed in. **Activate** clears that session (if any) then starts `register(viewKey)`. In Telegram or another in-app browser, the shared escape card (**Open this page in your browser**, **Open in browser**, **Copy link**) appears on mount instead of the banner. Hidden when the profile already has a passkey. After a successful claim → `/setup/rules`. No edit/Message/back/menu/logout on the card.
- **Used by:** Route `/view/[viewKey]` (`ViewProfilePage`).

### Variant: default

Valid known key. Heading **Profile**, FiatPicker only while unsigned; empty series shows FiatPicker + `profile.chartEmpty` when unsigned (**No gifts yet.**, no legend/SVG / no ₿|fiat scale; never **Loading…** on the chart) and `profile.chartEmpty` alone when signed in, About me inside the card when `aboutMe` is a string (not a forum post), icon-only **Copy link to this profile**, name, location, and Wallet of Satoshi address field labels, yellow **Action required, the account must be activated** / **Activate** banner under the card when unclaimed (even if signed in), no visible view-key URL/text, no back arrow.

![21.gifts public view profile](images/view-viewKey.png)

### Variant: about-filled

Valid known key with a filled About me (`aboutMe` is a real bio, not a name-copy). Same read-only card as default plus the About me heading and body text. Copy-profile-link remains. No edit.

![21.gifts public view about filled](images/view-about-filled.png)

### Variant: about-photo

Valid known key with About me text and photo (`aboutMe: 'I build on Bitcoin'`, `aboutMeHasPhoto: true`). Same read-only card as default plus the About me heading, bio, and photo (`About me photo`). Copy-profile-link remains. No edit.

![21.gifts public view about photo](images/view-about-photo.png)

### Variant: missing

Unknown or malformed key. Copy **This profile could not be found.**

![21.gifts public view missing](images/view-missing.png)

### Variant: loading

Waiting on the profile fetch. Copy **Loading…**

![21.gifts public view loading](images/view-loading.png)

### Variant: error

Profile fetch failed. Copy **Could not load this profile. Please try again.** and **Try again**.

![21.gifts public view error](images/view-error.png)

### Variant: claimed

Valid known key whose profile already has a passkey (`hasPasskey: true`). Same read-only card as default, no yellow activation banner, no **Activate** button.

![21.gifts public view claimed](images/view-claimed.png)

### Variant: in-app

Telegram or another in-app WebView detected on an unclaimed profile. Escape card under the profile (**Open this page in your browser**, **Open in browser**, **Copy link**); no yellow **Activate** banner.

![21.gifts public view in-app](images/view-in-app.png)

## Screen: /handbook

- **URL:** `/handbook` — public app handbook hub (no auth gate). Header **Handbook** stays here.
- **What the user sees:** Localized heading **Handbook** and intro chrome, language switcher in the marketing header (wordmark `/` when unsigned, `/welcome` when a session is hydrated), intro with a link to the api handbook on GitHub (`21gifts/api`), nav links to **Screens**, **Functions**, and **Endpoints**, plus a short lead for each part. Does not dump those three markdown files. After tapping the link icon on the Handbook heading, that button shows the check icon and `data-copied`.
- **Actions:** Change language, open a part, copy the hub heading URL, follow the api handbook link.
- **Calls:** `HandbookPage`, `HandbookIntro`, `HandbookCopyLink`, `LanguageSwitcher`.
- **Screenshots:** none. Documentation page, not a product screen.

## Screen: /handbook/screens

- **URL:** `/handbook/screens` — public screens handbook (no auth gate).
- **What the user sees:** Heading **Screens**, a three-level table of contents (chapter = first path segment, screen, variant), and nested compact cards (`HandbookFigure` via `HandbookImageViewer`) under global **Desktop** / **Mobile** and **Light** / **Dark** switches. Switches appear only when those baselines exist somewhere in the catalog. Each card has a ~220px preview, a written description of what the picture shows, a permalink label, and a copy-link. Clicking the preview opens the same PNG at full size in `HandbookLightbox` (close via X, backdrop, or Escape). Topics that lack the selected combo are omitted. No topic picker. Marketing header wordmark goes to `/` when unsigned and `/welcome` when a session is hydrated.
- **Actions:** Jump via the contents nav, switch viewport/theme when available (applies to every card), open a preview at full size, step through every visible variant with Left/Right arrows or lightbox chevrons, copy a chapter/screen/card deep link, follow a hash deep link, return to the hub.
- **Calls:** `HandbookScreensPage`, `HandbookImageViewer`, `HandbookOutline`, `HandbookSectionHeading`, `HandbookFigure`, `HandbookLightbox`, `HandbookIntro`, `HandbookCopyLink`, `buildHandbookOutline`, `nextOutlineIndex`, `topicAnchor`, `parseScreenVariantDescriptions`, `loadHandbookDocuments`.
- **Screenshots:** none. This page _shows_ product-screen goldens; it is not itself a golden.

## Screen: /handbook/functions

- **URL:** `/handbook/functions` — public functions handbook (no auth gate).
- **What the user sees:** Heading **Functions** and the functions markdown (`## Function: name`) only. No image switches. Marketing header wordmark goes to `/` when unsigned and `/welcome` when a session is hydrated.
- **Actions:** Read the markdown, return to the hub.
- **Calls:** `HandbookFunctionsPage`, `HandbookMarkdown`, `loadHandbookDocuments`.
- **Screenshots:** none.

## Screen: /handbook/endpoints

- **URL:** `/handbook/endpoints` — public endpoints handbook (no auth gate).
- **What the user sees:** Heading **Endpoints** and the endpoints markdown only. No image switches. Marketing header wordmark goes to `/` when unsigned and `/welcome` when a session is hydrated.
- **Actions:** Read the markdown, return to the hub.
- **Calls:** `HandbookEndpointsPage`, `HandbookMarkdown`, `loadHandbookDocuments`.
- **Screenshots:** none.

## Screen: /404

- **URL:** any unknown path (App Router `not-found.tsx`). There is no `page.tsx` for `/404`; Playwright uses `page.goto('/404')` which hits this screen.
- **What the user sees:** Marketing chrome with a language switcher (wordmark `/` when unsigned, `/welcome` when a session is hydrated), heading **404**, **This page does not exist.**, **Back home**.
- **Actions:** Change language, go home, or use header/footer links.
- **Calls:** `NotFound`, `MarketingHeader`, `MarketingFooter`, `LanguageSwitcher`.

### Variant: default

The only state.

![21.gifts not found](images/not-found.png)
