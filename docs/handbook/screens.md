# Screens

Every variant below is captured in the four Linux Chromium combos (desktop/mobile × light/dark), except UI that cannot exist: the header hamburger (mobile only), the payment QR (desktop only), and the smartphone pay sheet (mobile only). Markdown images are the desktop-light shot, or the first allowed combo when desktop-light does not apply. The other combo PNGs are visual-test baselines only.

## Screen: /

- **URL:** `/` — public marketing landing (no auth gate).
- **What the user sees:** Dark 21.gifts header with a language switcher, headline about peer-to-peer Bitcoin gifts, How it works (login and Wallet of Satoshi address) / Why / FAQ, CTAs **Ask for help** (`/login`) and **Send help** (`/donate`). **Install app** appears in the header and after Send help only for iPhone Safari/Chrome/Firefox/Edge (not standalone, not in-app) or when Chromium fires `beforeinstallprompt`; idle visual snapshots stay without it because the control renders `null` until after mount detection.
- **Actions:** Read the pitch, change language, open login, open Send help, optionally install the app (Chromium prompt or iPhone three-step Share sheet), jump to in-page sections, open Stats, open Legal & Privacy, open the Handbook.
- **Calls:** `Home` (`src/app/(marketing)/page.tsx`) inside `MarketingLayout`, `LanguageSwitcher`, `PwaInstall`.

### Variant: default

Desktop/wide layout: section nav is visible in the header (How it works, Why, FAQ, Stats, Handbook, Log in). No hamburger.

![21.gifts home](images/root.png)

### Variant: mobile-nav

Narrow viewport: header shows the Menu button. Open it to reveal the same links stacked. Tapping a link closes the menu.

![21.gifts home mobile nav](images/root-mobile-nav.png)

### Variant: language-open

Open the language switcher in the marketing header. Custom listbox (rounded panel, endonym rows with a check on the current locale) — not OS chrome.

![21.gifts home language](images/root-language.png)

## Screen: /legal

- **URL:** `/legal` — imprint and privacy. `/legal.html` permanently redirects here.
- **What the user sees:** Dark 21.gifts header with a language switcher, Legal Notice (Switzerland) and Privacy Policy (no analytics; no cookies unless the visitor chooses a language — then a `locale` cookie — or a light/dark appearance — then a `theme` cookie; System appearance clears `theme`; session in localStorage; Cloudflare TLS; login on this origin). There is **no published email**; contact is in-app only via `/contact` after login. Legal body copy stays English.
- **Actions:** Change language. Read the legal body. Open **Open the app** (`/contact`). Header **Log in** goes to `/login`.
- **Calls:** `LegalPage` inside `MarketingLayout`, `LanguageSwitcher`.

### Variant: default

The only state: imprint plus privacy, marketing chrome.

![21.gifts legal](images/legal.png)

## Screen: /stats/[day]

- **URL:** `/stats/YYYY-MM-DD` — public list of outbound gifts that UTC day. Invalid dates 404.
- **What the user sees:** Dark 21.gifts header, **All stats** back to `/stats`, heading **Gifts on {day}**, a **UTC day** date input, then either the gift table (Time, Recipient, ₿, USD), empty copy **No gifts recorded on this day.**, **Loading…**, or **Try again**. Stats body copy stays English.
- **Actions:** Pick another UTC day in the date input (navigates to `/stats/{next}`). Open **All stats**. Change language. Header **Log in** goes to `/login`.
- **Calls:** `GiftDayPage`, `DayLoader`, `GiftDayTable`, `fetchGiftDay` (`GET /gifts?day=`).
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
- **What the user sees:** Dark 21.gifts header with a language switcher, heading **Gifts**, four KPI cards (total spent as BIP-177 **₿** plus **USD**, gifts, people, period), then diagrams: **Total spend over time** (one cumulative chart; days with spend are markers on the series, not a wrapping date list), **By person** and **By month**. Each diagram has a `SegmentedControl tone="gift" shell="dark"` ₿/USD control that defaults to ₿; over time switches the series, person and month rescale bar size while labels stay both units. Empty database copy: **No gifts recorded yet.** Stats body copy stays English.
- **Actions:** Change language. Read the charts. Open a spend day (`/stats/{YYYY-MM-DD}`) from **Total spend over time** by clicking a day with spend. Switch **Total spend over time** / **By person** / **By month** between ₿ and USD. Header **Stats** stays on this page; **Log in** goes to `/login`.
- **Calls:** `StatsPage`, `StatsLoader`, `StatsDashboard`, `fetchGiftStats` (same-origin `GET /gifts/stats`), `LanguageSwitcher`.

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

## Screen: /login

- **URL:** `/login` — login only.
- **What the user sees:** Fill `AppShell` with Wordmark top-left; light language switcher and theme switcher top-right (not the marketing header). Idle **Log in**. In Telegram or another in-app browser, an escape card (**Open this page in your browser**) with **Open in browser** and **Copy link** instead of **Log in**. Error is terminal until **Try again**. After success the visitor is sent to `/setup/name`, `/setup/address`, `/setup/rules`, or `/welcome`.
- **Actions:** Change language or theme. Log in (existing login, or create one when the browser has none). In an in-app browser: open the page in the system browser or copy the link.
- **Calls:** `AppShell`, `Wordmark`, `LoginCard`, `OnboardingGate`, `usePasskeyLogin`, `useAuthStore`, `LanguageSwitcher`, `ThemeSwitcher`, `isInAppBrowser`, `openInSystemBrowser`.

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

### Variant: theme-open

Open the theme switcher top-right. Custom listbox with System / Light / Dark — not a native OS select.

![21.gifts login theme](images/login-theme.png)

## Screen: /donate

- **URL:** `/donate` — public, no auth gate.
- **What the user sees:** Fill `AppShell` with Wordmark top-left; light language switcher and theme switcher top-right (not marketing header). Heading **Send help**, short lead about picking a forum message then sending Bitcoin, CTA **Open the forum** (`/welcome`). No address/amount form. No QR.
- **Actions:** Change language or theme. Open the forum. Unsigned visitors hitting `/welcome` are sent to `/login` by OnboardingGate.
- **Calls:** `AppShell`, `Wordmark`, `DonatePage`, `ButtonLink`, `LanguageSwitcher`, `ThemeSwitcher`.

### Variant: default

Heading **Send help**, explainer lead, **Open the forum**.

![21.gifts donate](images/donate.png)

## Screen: /setup/name

- **URL:** `/setup/name` — first screen after login (`account.setup === 'name'`).
- **What the user sees:** Fill `AppShell` with Wordmark top-left and one **Menu** top-right; open it for Profile, **Living room rules**, **Messages**, **Contact**, optional **Install app**, language, theme (System / Light / Dark), and **Log out**. Heading **Your name**, name form with **Continue** and labeled **Skip**. No Wallet of Satoshi form.
- **Actions:** Enter a name and **Continue**, or **Skip** (`POST /me/setup/skip`); open **Menu** for Profile, **Living room rules**, **Messages**, **Contact**, optional **Install app**, language, theme (System / Light / Dark), or **Log out**. After save or skip, the visitor is sent to the next `account.setup` path (usually `/setup/address`).
- **Calls:** `AppShell`, `Wordmark`, `NameSetup`, `NameForm`, `SignedInChrome`, `OnboardingGate`, `skipSetup`.

### Variant: default

Signed in, no name yet. **Your name** and the name field at the top, **Continue** and labeled **Skip** pinned at the bottom of the screen. One **Menu** top-right; open it for Profile, **Living room rules**, **Messages**, **Contact**, optional **Install app**, language, theme (System / Light / Dark), and **Log out**.

![21.gifts name setup](images/setup-name.png)

## Screen: /setup/address

- **URL:** `/setup/address` — second screen after login (`account.setup === 'address'`; name may already be saved or skipped).
- **What the user sees:** Fill `AppShell` with Wordmark top-left and one **Menu** top-right; open it for Profile, **Living room rules**, **Messages**, **Contact**, optional **Install app**, language, theme (System / Light / Dark), and **Log out**. Heading **Your Wallet of Satoshi address**, greeting **Hi, {name}**, address form with **Continue** and labeled **Skip**. No name form.
- **Actions:** Enter an address and **Continue**, or **Skip** (`POST /me/setup/skip`); open **Menu** for Profile, **Living room rules**, **Messages**, **Contact**, optional **Install app**, language, theme (System / Light / Dark), or **Log out**. After save or skip, the visitor is sent to the next `account.setup` path (usually `/setup/rules`).
- **Calls:** `AppShell`, `Wordmark`, `AddressSetup`, `LightningAddressForm`, `SignedInChrome`, `OnboardingGate`, `skipSetup`.

### Variant: default

Signed in with a name (or a skipped name) and no address. **Your Wallet of Satoshi address** and the address field at the top, **Continue** and labeled **Skip** pinned at the bottom of the screen. One **Menu** top-right; open it for Profile, **Living room rules**, **Messages**, **Contact**, optional **Install app**, language, theme (System / Light / Dark), and **Log out**.

![21.gifts address setup](images/setup-address.png)

## Screen: /setup/rules

- **URL:** `/setup/rules` — third screen after login, when living-room rules are not yet agreed (`account.setup === 'rules'`). Name and address may already be saved or skipped; rules cannot be skipped.
- **What the user sees:** Fill `AppShell` with one **Menu** top-right; open it for Profile, **Living room rules**, **Messages**, **Contact**, optional **Install app**, language, theme (System / Light / Dark), and **Log out**. Wordmark top-left (with icon-only chapter back after the first chapter). Heading **Living room rules**, prompt to read this chapter, progress (`1 of 9` on the first chapter), one rules chapter at a time (lead first) without the public Contact / forum nav, and a full-width **Continue** button. The last chapter shows **I agree to these rules** instead of **Continue**.
- **Actions:** Read the current chapter and **Continue** to advance; icon-only back after the first chapter. The last **I agree to these rules** POSTs agreement, then the visitor is sent to `/welcome`. Open **Menu** for Profile, **Living room rules**, **Messages**, **Contact**, optional **Install app**, language, theme (System / Light / Dark), or **Log out**.
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
- **What the user sees:** Flow `AppShell` with Wordmark top-left and one **Menu** top-right; open it for Profile, **Living room rules**, **Messages**, **Contact**, optional **Install app**, language, theme (System / Light / Dark), and **Log out**. Gift icon, **Welcome, {name}**, dismissible living-room laws hint box with an X when not yet dismissed on the account (two laws plus links to **Living room rules** `/rules` and **Contact** `/contact`; after dismiss the box is gone and the flag persists on the account), then a three-way `SegmentedControl tone="neutral"` (**Active** / **All** / **Most popular**). Default is **Active** (paid notes, messenger order: oldest top, newest above the composer). **All** shows every note in that messenger order. **Most popular** ranks paid notes by sats (highest first). Below the selector: clickable author name (when `accountId` is set) that opens `/members/:id`, optional Founder / Moderator / Verified pill when the api `role` is one of those three (`basis` has no pill), timestamp, optional inline photo then caption text below the photo, optional inline `<video>` playback for notes with video (player follows the clip aspect — portrait stays portrait), ₿ amount always, replyCount text, copy-link control (**Copy link to this note** → origin `/messages/<uuid>`), and expand/collapse on the card body (**Show replies** / **Hide replies**; pay / role / copy do not expand). Expanded cards show the replies list plus an in-card reply composer (**Write a reply**). Pay control / Send Bitcoin only when the note is payable; board-bottom composer with **Add a photo or video** (ImagePlus) left of the textarea, **Post** (Send icon) to the right, optional photo draft preview with **Remove photo** (X icon), and optional video draft preview with **Remove video** (X icon) — icon-only action controls, catalog `aria-label`s, no visible button text. A missing name or rules agreement opens `RequirementsOverlay` (no Skip) before a post or reply retries. No always-visible refresh control; there is no visible refresh chrome — while refreshing or pull-armed only a visually hidden (`sr-only`) `role="status"` (`forum.refreshing`) is mounted, and idle markup has no status node. Clicking a role pill toggles a short explanation under that card header. Paying a note opens a sheet with a top-left back control and a **Pay** button that includes the Wallet of Satoshi icon. On a computer the sheet also shows a QR; on a smartphone there is no QR. No name or address form. No guest donate CTA.
- **Actions:** Dismiss the living-room laws hint (permanent), post a text and/or photo or video message, attach/remove a photo or video draft, expand a note to load replies and post a reply, open an author profile at `/members/:id`, copy a note link to `/messages/<uuid>`, click a role pill for its explanation, pay a payable note in-app, switch the forum view (Active / All / Most popular), pull down from the top to refresh the forum list, return to the web app to refresh the list when it becomes visible again, complete a `RequirementsOverlay` for a missing name or rules agreement, open the rules or contact pages, retry a failed load; open **Menu** for Profile, **Living room rules**, **Messages**, **Contact**, optional **Install app**, language, theme (System / Light / Dark), or **Log out**.
- **Calls:** `PageChrome`, `AppShell`, `Wordmark`, `WelcomeScreen`, `ForumLoader`, `ForumBoard`, `RequirementsOverlay`, `SegmentedControl`, `SignedInChrome`, `OnboardingGate`, `prepareForumPhoto`, `prepareForumVideo`, `fetchMessagePhoto`, `forumVideoSrc`, `fetchReplies`, `visibleForumMessages`.

### Variant: default

Gift icon, **Welcome, Ada**, with the dismissible laws hint box and rules/contact links, **Active** selected. Paid notes in messenger order (Carol ₿21 then Ada ₿5); Bob's unpaid note is not visible. Composer with attach + Send icons. Pay control / Send Bitcoin only when the note is payable. Founder / Moderator / Verified pills beside the name when `role` is one of those three; `basis` has no pill (Carol is `verified`, Ada is `moderator`; Bob is `basis` and hidden on Active). One **Menu** top-right; open it for Profile, **Living room rules**, **Messages**, **Contact**, optional **Install app**, language, theme (System / Light / Dark), and **Log out**.

![21.gifts welcome](images/welcome.png)

### Variant: all

Click **All** — Bob's unpaid note (`Does anyone have spare sats this week?`) is visible with Ada and Carol.

![21.gifts welcome all](images/welcome-all.png)

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

On **All**, click **Show replies** on a note — card expands (`aria-expanded`), replies list loads via `fetchReplies`, and the in-card reply composer shows **Write a reply**.

![21.gifts welcome expanded](images/welcome-expanded.png)

### Variant: copy

Click **Copy link to this note** — control sets `data-copied` after writing `origin/messages/<uuid>` to the clipboard.

![21.gifts welcome copy](images/welcome-copy.png)

### Variant: pm

**Send a private message** control on another person's note (not on own notes). Does not expand the card.

![21.gifts welcome pm](images/welcome-pm.png)

### Variant: photo

On **All** (unpaid photo-only notes are hidden on Active): photo-only forum row from Ada with inline image (**Photo from Ada**) and the attach control visible in the composer.

![21.gifts welcome photo](images/welcome-photo.png)

### Variant: photo-and-text

After a successful post of caption **Hello with this photo.** plus a JPEG: the row shows **Photo from Ada**, then that text below the photo; the composer is empty again (attach + textarea + Post).

![21.gifts welcome photo and text](images/welcome-photo-and-text.png)

### Variant: composer-text

Typed caption **Caption before attaching a photo.** in the composer; no preview yet; attach + Post idle.

![21.gifts welcome composer text](images/welcome-composer-text.png)

### Variant: composer-photo

JPEG preview (**Selected photo**) and **Remove photo**; textarea empty.

![21.gifts welcome composer photo](images/welcome-composer-photo.png)

### Variant: composer-photo-and-text

Preview plus caption **Caption with selected photo.**, ready to Post.

![21.gifts welcome composer photo and text](images/welcome-composer-photo-and-text.png)

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

### Variant: error-too-large-with-text

Same alert with caption **Caption with a photo that is too large.** still in the composer.

![21.gifts welcome error too large with text](images/welcome-error-too-large-with-text.png)

### Variant: error-request-photo-and-text

POST fails after caption+JPEG → **Could not post your message**; preview and caption remain.

![21.gifts welcome error request photo and text](images/welcome-error-request-photo-and-text.png)

### Variant: menu-open

Open **Menu** top-right only (do not click Language or Theme) → Profile is one line (User icon + Profile + ₿ totals on the right), Living room rules and Contact each have an icon, optional **Install app** when an install offer exists, Language (Globe + label + chevron), Theme (System / Light / Dark) next to Language, Log out. Accessible names unchanged except Theme is now a row. No English / Deutsch / Español / Filipino option rows. No System / Light / Dark option rows. No native language select.

![21.gifts welcome menu](images/welcome-menu.png)

### Variant: menu-language-open

After **Menu**, click **Language** → the four endonym rows (English / Deutsch / Español / Filipino) expand in flow under the Language trigger with a check on the current locale. The Menu grows; this is not an absolute popover.

![21.gifts welcome menu language](images/welcome-menu-language.png)

### Variant: menu-theme-open

After **Menu**, click **Theme** → System / Light / Dark expand in flow under the Theme trigger with a check on the current preference. The Menu grows; this is not an absolute popover.

![21.gifts welcome menu theme](images/welcome-menu-theme.png)

### Variant: pay-qr

Payable note, amount submitted. On a computer the pay sheet shows the Bitcoin payment QR, a top-left back control, and a **Pay** button with the Wallet of Satoshi icon.

![21.gifts welcome pay QR](images/welcome-pay-qr.png)

### Variant: pay-smartphone

Same pay sheet on a smartphone user-agent: **Pay** button with the Wallet of Satoshi icon only, no QR, plus the top-left back control.

![21.gifts welcome pay smartphone](images/welcome-pay-smartphone.png)

### Variant: pay-author-wallet

Payable note, amount submitted, but the author's wallet cannot mint a zap invoice. The pay sheet stays on the amount form and shows **The author's wallet cannot receive this Bitcoin payment**. No QR and no Pay button.

![21.gifts welcome pay author wallet](images/welcome-pay-author-wallet.png)

### Variant: role-hint

Carol's **Verified** tag clicked; the explanation under that card header is visible (**A moderator has met this person in real life and confirmed they are real.**). Bob stays without a pill; Ada still shows **Moderator**.

![21.gifts welcome role hint](images/welcome-role-hint.png)

## Screen: /rules

- **URL:** `/rules` — public living-room rules. App chrome (semantic tokens; not the dark marketing shell). No auth gate.
- **What the user sees:** Flow `AppShell` with Wordmark top-left; light language switcher and theme switcher top-right. Page heading **Living room rules**, then the lead paragraph with the accent-bordered **The test** callout, three rule cards (kicker **Rule n**, title, body, and a **The test** callout on rules 1 and 2), the Welcome / Allowed / Better not / Forbidden lists as bordered cards with check / minus / cross glyphs (Forbidden has three subheads), the muted **Our house** closing block, and CTAs **Contact 21.gifts** (`/contact`) and **Back to the forum** (`/welcome`).
- **Actions:** Change language or theme. Read the rules. Open contact or the forum.
- **Calls:** `PageChrome`, `AppShell`, `Wordmark`, `RulesPage`, `RulesDocument`, `LanguageSwitcher`, `ThemeSwitcher`.
- **Auth:** None.

### Variant: default

Full rules body with rule card **Only free donations** visible.

![21.gifts living room rules](images/rules.png)

## Screen: /contact

- **URL:** `/contact` — signed-in in-app contact (the only way to reach 21.gifts). Same onboarding gate as `/welcome` (`account.setup` null; name and address may be skipped; living-room rules agreement required).
- **What the user sees:** Fill `AppShell` with Wordmark top-left and one **Menu** top-right; open it for Profile, **Living room rules**, **Messages**, **Contact**, optional **Install app**, language, theme (System / Light / Dark), and **Log out**. Heading **Contact**, lead **Write to 21.gifts here — there is no email address. This is the only way to reach us.**, link to **Living room rules**, composer textarea with an icon-only **Send** control (`contact.send` catalog `aria-label`, no visible Send text). A missing name or rules agreement opens `RequirementsOverlay` (no Skip) before the send retries. A successful send opens the official 21.gifts thread in `/messages`.
- **Actions:** Send a message, complete a `RequirementsOverlay` for a missing name or rules agreement, open the rules; open **Menu** for Profile, **Living room rules**, **Messages**, **Contact**, optional **Install app**, language, theme (System / Light / Dark), or **Log out**.
- **Calls:** `AppShell`, `Wordmark`, `ContactPage`, `ContactLoader`, `ContactScreen`, `RequirementsOverlay`, `SignedInChrome`, `OnboardingGate`, `postContact` (`POST /contact/submit`), `fetchConversations`.
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

- **Purpose:** Signed-in member identity card (chart, name, Lightning Address, role pill) and optional profile forum note. Own profiles use this route too (forum author names navigate here, not `/profile`). A missing name or rules agreement on a reply opens `RequirementsOverlay` (no Skip).
- **Inputs:** Bearer session; `accountId` UUID; `GET /forum/members/:id` plus optional `GET /gifts/stats?recipient=`.
- **Actions:** Open **Menu**; icon-only back to the forum; expand role hint; open author profile links on the note when present; complete a `RequirementsOverlay` for a missing name or rules agreement before a reply. No edit controls.
- **Used by:** Route `/members/[accountId]` (`MemberProfilePage` / `MemberProfileLoader` / `MemberProfileScreen`).
- **Auth:** Bearer; `OnboardingGate screen="profile"`.

### Variant: default

Member with a non-null `profileMessage` shown as a one-item forum card (`composerHidden`).

![21.gifts member profile](images/members.png)

### Variant: note-null

Member identity card only (`profileMessage: null`); no forum card under the identity section.

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

## Screen: /profile

- **Purpose:** Signed-in profile after onboarding: compact dual-line Given/Received activity chart (`SegmentedControl tone="gift"` for ₿ | USD) inside the identity card, edit name and Wallet of Satoshi address, enable or disable Web Push notifications via an icon-only bell (incoming pushes skip an OS banner when any window client is focused; background-only clients still show it), copy the public view-key link via an icon-only control, return to the forum via an icon-only back control. Menu still shows icon+amount totals.
- **Inputs:** Session account (name + Lightning Address + `viewKey` + living-room rules agreement) via `OnboardingGate` / `useAuthStore`; filtered gift stats via `useAccountTotals` (`GET /gifts/stats?recipient=`).
- **Actions:** Open **Menu** for Profile (current), **Living room rules**, **Messages**, **Contact**, optional **Install app**, language, theme (System / Light / Dark), or **Log out** (best-effort Web Push unsubscribe while the session is still valid); icon-only back (top-left) to the forum; save name; link or change address; toggle Web Push with the icon-only bell (aria from `profile.push.enable` / `profile.push.disable`); toggle the activity chart between ₿ and USD; copy the public view URL with the icon-only control (the 64-hex key and `/view/<key>` are not shown on screen). On iPhone Safari outside standalone, a short install hint (`profile.push.installHint`) appears above the bell.
- **Used by:** Route `/profile` (`ProfilePage`).

### Variant: default

Heading **Profile**, then inside the single `max-w-sm` identity card: when the series is empty, `profile.chartEmpty` (`role="status"`, **No gifts yet.**) with no axis/SVG/toggle; otherwise a compact Given/Received chart (legend left, ₿ | USD right; no chart title heading), name and Wallet of Satoshi address fields with icon actions to the right (pencil / check / X / trash), an icon-only notifications bell under the address form, then an icon-only copy control for the public view URL; no **View key** heading and no visible URL/key text. No second panel below the card. Icon-only back top-left next to the wordmark (returns to the forum); one **Menu** top-right (menu totals stay icons + amounts). Chart never swaps to **Loading…**.

![21.gifts profile](images/profile.png)

### Variant: receive

Filtered receive series with three UTC days (including a zero-gap day) and received total ₿1,500. Chart shows day ticks such as **2026-06-01**; Given stays flat at zero with a visible legend.

![21.gifts profile receive](images/profile-receive.png)

### Variant: usd-scale

Same receive stub as **receive**, with the chart scale switched to **USD** (`Given and received in USD`).

![21.gifts profile USD scale](images/profile-usd-scale.png)

### Variant: single-day

One receive day (₿21 on **2026-06-01**). Chart draws a horizontal single-point line.

![21.gifts profile single day](images/profile-single-day.png)

### Variant: large-usd

Two-day series with cumulative USD **1425.00**, scale switched to USD so the axis shows **$1,425**.

![21.gifts profile large USD](images/profile-large-usd.png)

## Screen: /messages

- **URL:** `/messages` — signed-in private-message inbox. Same onboarding gate as `/welcome`. Public notes stay at `/messages/[id]`.
- **What the user sees:** Fill `AppShell` (`align="center"`) with Wordmark top-left and one **Menu** top-right (includes **Messages**). Heading **Messages**, a conversation list (counterpart name, last text, time), empty copy **No private messages yet.**, **Loading…**, or **Try again**. Open a thread (`?c=`) for oldest-first messages and a 500-character composer. Founder/moderator also see official 21.gifts threads.
- **Actions:** Open a thread, send a reply, return via **All conversations**. Open **Menu**. Forum PM and `/contact` send land here.
- **Calls:** `AppShell`, `Wordmark`, `MessagesPage`, `InboxLoader`, `InboxScreen`, `SignedInChrome`, `OnboardingGate`, `fetchConversations`, `fetchConversation`, `postConversationMessage`.
- **Auth:** Bearer session; `OnboardingGate screen="welcome"`.

### Variant: default

Loaded list with at least one thread (counterpart **21.gifts**).

![21.gifts inbox](images/messages.png)

### Variant: empty

No threads. Copy **No private messages yet.**

![21.gifts inbox empty](images/messages-empty.png)

### Variant: loading

Waiting on `GET /conversations`. Copy **Loading…**

![21.gifts inbox loading](images/messages-loading.png)

### Variant: error

List fetch failed. Button **Try again**.

![21.gifts inbox error](images/messages-error.png)

### Variant: thread

Open official thread. Heading **21.gifts**, message body **Hello team**, composer visible.

![21.gifts inbox thread](images/messages-thread.png)

## Screen: /messages/[id]

- **Purpose:** Public read-only HTML note by forum message UUID. Fill `AppShell` (`align="center"`) Wordmark top-left; ThemeSwitcher and light language switcher top-right. No `OnboardingGate`, no pay sheet, no composer, no copy control on this page.
- **Inputs:** Dynamic route `id` (UUID). Message from same-origin `GET /public-messages/:id` (`fetchPublicMessage`). Optional photo via `fetchPublicMessagePhoto` → blob URL. Invalid UUID → missing without a fetch.
- **Actions:** Change language and theme. On fetch error, **Try again**. Logged-out **Log in** → `/login` (`login.submit`). Logged-in **Back to the forum** → `/welcome` (`profile.back`). States reuse `view.missing` / `view.error`+retry / `forum.loading`.
- **Used by:** Route `/messages/[id]` (`PublicMessagePage`). Shared links copied from the forum board.

### Variant: default

Valid known UUID. Card with author name, timestamp, text (`Hello from Ada`), sats via `formatBitcoin`, optional photo or clip-aspect `<video>`. Auth CTA below the card.

![21.gifts public message](images/messages-id.png)

### Variant: missing

Unknown or malformed id. Copy **This profile could not be found.**

![21.gifts public message missing](images/messages-id-missing.png)

### Variant: loading

Waiting on the public message fetch. Copy **Loading…**

![21.gifts public message loading](images/messages-id-loading.png)

### Variant: error

Public message fetch failed. Copy **Could not load this profile. Please try again.** and **Try again**.

![21.gifts public message error](images/messages-id-error.png)

## Screen: /view/[viewKey]

- **Purpose:** Public read-only copy of the signed-in profile card (heading Profile, AccountActivityChart Given/Received + ₿ | USD, name + Wallet of Satoshi address fields) without edit/copy/back/menu/logout. Capability URL `/view/<64-hex>`; key/URL not shown. No `OnboardingGate` on this route.
- **Inputs:** Dynamic route `viewKey` (must be 64 lowercase hex). Profile from same-origin `GET /view-key/:viewKey` (`fetchViewProfile`); receive series from public `fetchGiftStats(handle)` via `recipientHandleFromAddress` (`GET /gifts/stats?recipient=`). Blank address → empty series, no stats fetch. Stats error → card with empty series.
- **Actions:** Change language and theme (Wordmark top-left; ThemeSwitcher + light language switcher top-right). On profile fetch error, **Try again**. Empty series shows `profile.chartEmpty`; a filled series can toggle ₿ | USD. When the card is ready and `hasPasskey` is false in a real browser: yellow banner under the card via `ViewProfileClaim` with **Action required, the account must be activated** and **Activate** — including when another 21.gifts account is already signed in. **Activate** clears that session (if any) then starts `register(viewKey)`. In Telegram or another in-app browser, the shared escape card (**Open this page in your browser**, **Open in browser**, **Copy link**) appears on mount instead of the banner. Hidden when the profile already has a passkey. After a successful claim → `/setup/rules`. No edit/copy/back/menu/logout on the card.
- **Used by:** Route `/view/[viewKey]` (`ViewProfilePage`). Shared links copied from `/profile`.

### Variant: default

Valid known key. Heading **Profile**, empty series shows `profile.chartEmpty` (**No gifts yet.**, no legend/SVG/toggle; never **Loading…** on the chart), name and Wallet of Satoshi address field labels, yellow **Action required, the account must be activated** / **Activate** banner under the card when unclaimed (even if signed in), no view-key copy, no back arrow.

![21.gifts public view profile](images/view-viewKey.png)

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
- **What the user sees:** Localized heading **Handbook** and intro chrome, language switcher in the marketing header, intro with a link to the api handbook on GitHub (`21gifts/api`), nav links to **Screens**, **Functions**, and **Endpoints**, plus a short lead for each part. Does not dump those three markdown files.
- **Actions:** Change language, open a part, copy the hub heading URL, follow the api handbook link.
- **Calls:** `HandbookPage`, `HandbookIntro`, `HandbookCopyLink`, `LanguageSwitcher`.

### Variant: default

Hub with heading **Handbook** and links to the three parts.

![21.gifts handbook](images/handbook.png)

### Variant: copied

After tapping the link icon on the Handbook heading, that button shows the check icon and `data-copied`.

![21.gifts handbook copied](images/handbook-copied.png)

## Screen: /handbook/screens

- **URL:** `/handbook/screens` — public screens handbook (no auth gate).
- **What the user sees:** Heading **Screens**, a one-topic baseline viewer (`HandbookImageViewer`) with a topic picker. **Desktop** / **Mobile** and **Light** / **Dark** switches appear only when those baselines exist for the selected topic. One image at a time.
- **Actions:** Pick a topic, switch viewport/theme when available, return to the hub.
- **Calls:** `HandbookScreensPage`, `HandbookImageViewer`, `HandbookIntro`, `HandbookCopyLink`.

### Variant: default

First topic, desktop-light image, **Desktop** and **Light** selected when those combos exist.

![21.gifts handbook screens](images/handbook-screens.png)

### Variant: mobile

**Mobile** selected on a topic that has both viewports.

![21.gifts handbook screens mobile](images/handbook-screens-mobile.png)

### Variant: dark

**Dark** selected on a topic that has both themes.

![21.gifts handbook screens dark](images/handbook-screens-dark.png)

## Screen: /handbook/functions

- **URL:** `/handbook/functions` — public functions handbook (no auth gate).
- **What the user sees:** Heading **Functions** and the functions markdown (`## Function: name`) only. No image switches.
- **Actions:** Read the markdown, return to the hub.
- **Calls:** `HandbookFunctionsPage`, `HandbookMarkdown`, `loadHandbookDocuments`.

### Variant: default

Markdown list of `## Function:` headings.

![21.gifts handbook functions](images/handbook-functions.png)

## Screen: /handbook/endpoints

- **URL:** `/handbook/endpoints` — public endpoints handbook (no auth gate).
- **What the user sees:** Heading **Endpoints** and the endpoints markdown only. No image switches.
- **Actions:** Read the markdown, return to the hub.
- **Calls:** `HandbookEndpointsPage`, `HandbookMarkdown`, `loadHandbookDocuments`.

### Variant: default

Markdown list of `## Endpoint:` headings.

![21.gifts handbook endpoints](images/handbook-endpoints.png)

## Screen: /404

- **URL:** any unknown path (App Router `not-found.tsx`). There is no `page.tsx` for `/404`; Playwright uses `page.goto('/404')` which hits this screen.
- **What the user sees:** Marketing chrome with a language switcher, heading **404**, **This page does not exist.**, **Back home**.
- **Actions:** Change language, go home, or use header/footer links.
- **Calls:** `NotFound`, `MarketingHeader`, `MarketingFooter`, `LanguageSwitcher`.

### Variant: default

The only state.

![21.gifts not found](images/not-found.png)
