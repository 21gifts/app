# Screens

## Screen: /

- **URL:** `/` — public marketing landing (no auth gate).
- **What the user sees:** Dark 21.gifts header with a language switcher, headline about peer-to-peer Bitcoin gifts, How it works (login and Wallet of Satoshi address) / Why / FAQ, CTAs **Ask for help** (`/login`) and **Send help** (`/donate`).
- **Actions:** Read the pitch, change language, open login, open Send help, jump to in-page sections, open Stats, open Legal & Privacy, open the Handbook.
- **Calls:** `Home` (`src/app/(marketing)/page.tsx`) inside `MarketingLayout`, `LanguageSwitcher`.

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
- **What the user sees:** Dark 21.gifts header with a language switcher, Legal Notice (Switzerland) and Privacy Policy (no analytics; no cookies unless the visitor chooses a language — then a `locale` cookie; session in localStorage; Cloudflare TLS; login on this origin). There is **no published email**; contact is in-app only via `/contact` after login. Legal body copy stays English.
- **Actions:** Change language. Read the legal body. Open **Open the app** (`/contact`). Header **Log in** goes to `/login`.
- **Calls:** `LegalPage` inside `MarketingLayout`, `LanguageSwitcher`.

### Variant: default

The only state: imprint plus privacy, marketing chrome.

![21.gifts legal](images/legal.png)

## Screen: /stats/[day]

- **URL:** `/stats/YYYY-MM-DD` — public list of outbound gifts that UTC day. Invalid dates 404.
- **What the user sees:** Dark 21.gifts header, **All stats** back to `/stats`, heading **Gifts on {day}**, a **UTC day** date input, then either the gift table (Time, Recipient, Sats, BTC, USD), empty copy **No gifts recorded on this day.**, **Loading…**, or **Try again**. Stats body copy stays English.
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
- **What the user sees:** Dark 21.gifts header with a language switcher, heading **Gifts**, four KPI cards (total spent in **BTC** and **USD** with a sats caption, gifts, people, period), then diagrams: **Total spend over time** (one cumulative chart; days with spend are markers on the series, not a wrapping date list), **By person** and **By month**. Each diagram has a BTC/USD control that defaults to BTC; over time switches the series, person and month rescale bar size while labels stay both units. Empty database copy: **No gifts recorded yet.** Stats body copy stays English.
- **Actions:** Change language. Read the charts. Open a spend day (`/stats/{YYYY-MM-DD}`) from **Total spend over time** by clicking a day with spend. Switch **Total spend over time** / **By person** / **By month** between BTC and USD. Header **Stats** stays on this page; **Log in** goes to `/login`.
- **Calls:** `StatsPage`, `StatsLoader`, `StatsDashboard`, `fetchGiftStats` (same-origin `GET /gifts/stats`), `LanguageSwitcher`.

### Variant: default

Loaded stats with one cumulative over-time chart visible. Scale defaults to BTC.

![21.gifts stats](images/stats.png)

### Variant: usd-scale

Inverted ranking fixture (June tall in BTC / short in USD, July the reverse). Scale switched to USD on **Total spend over time**, **By person**, and **By month**.

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
- **What the user sees:** Light language switcher top-right on the page (not the marketing header). Idle **Log in**. In Telegram or another in-app browser, an escape card (**Open this page in your browser**) with **Open in browser** and **Copy link** instead of **Log in**. Error is terminal until **Try again**. After success the visitor is sent to `/setup/name`, `/setup/address`, `/setup/rules`, or `/welcome`.
- **Actions:** Change language. Log in (existing login, or create one when the browser has none). In an in-app browser: open the page in the system browser or copy the link.
- **Calls:** `LoginCard`, `OnboardingGate`, `usePasskeyLogin`, `useAuthStore`, `LanguageSwitcher`, `isInAppBrowser`, `openInSystemBrowser`.

### Variant: idle

Logged out. Heading **Sign in to 21.gifts**, one **Log in** button.

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
- **What the user sees:** Light language switcher top-right (not marketing header). Heading **Send help**, short lead about picking a forum message then sending Bitcoin, CTA **Open the forum** (`/welcome`). No address/amount form. No QR.
- **Actions:** Change language. Open the forum. Unsigned visitors hitting `/welcome` are sent to `/login` by OnboardingGate.
- **Calls:** `DonatePage`, `LanguageSwitcher`.

### Variant: default

The only state. Heading **Send help**, explainer lead, **Open the forum**.

![21.gifts donate](images/donate.png)

## Screen: /setup/name

- **URL:** `/setup/name` — first screen after login.
- **What the user sees:** One **Menu** top-right; open it for Profile, **Living room rules**, **Contact**, language, and **Log out**. Heading **Your name**, name form. No Wallet of Satoshi form.
- **Actions:** Enter a name and **Continue**; open **Menu** for Profile, **Living room rules**, **Contact**, language, or **Log out**. After save, the visitor is sent to `/setup/address`.
- **Calls:** `NameSetup`, `NameForm`, `SignedInChrome`, `OnboardingGate`.

### Variant: default

Signed in, no name yet. **Your name** and the name field at the top, **Continue** pinned at the bottom of the screen. One **Menu** top-right; open it for Profile, **Living room rules**, **Contact**, language, and **Log out**.

![21.gifts name setup](images/setup-name.png)

## Screen: /setup/address

- **URL:** `/setup/address` — second screen after login.
- **What the user sees:** One **Menu** top-right; open it for Profile, **Living room rules**, **Contact**, language, and **Log out**. Heading **Your Wallet of Satoshi address**, greeting **Hi, {name}**, address form. No name form.
- **Actions:** Enter an address and **Continue**; open **Menu** for Profile, **Living room rules**, **Contact**, language, or **Log out**. After save, the visitor is sent to `/setup/rules`.
- **Calls:** `AddressSetup`, `LightningAddressForm`, `SignedInChrome`, `OnboardingGate`.

### Variant: default

Signed in with a name and no address. **Your Wallet of Satoshi address** and the address field at the top, **Continue** pinned at the bottom of the screen. One **Menu** top-right; open it for Profile, **Living room rules**, **Contact**, language, and **Log out**.

![21.gifts address setup](images/setup-address.png)

## Screen: /setup/rules

- **URL:** `/setup/rules` — third screen after login, when name and address are saved but living-room rules are not yet agreed.
- **What the user sees:** One **Menu** top-right; open it for Profile, **Living room rules**, **Contact**, language, and **Log out**. Heading **Living room rules**, prompt to read and agree, the full rules body without the public Contact / forum nav, and a full-width **I agree to these rules** button.
- **Actions:** Read the rules and **I agree to these rules**; open **Menu** for Profile, **Living room rules**, **Contact**, language, or **Log out**. After agreement, the visitor is sent to `/welcome`.
- **Calls:** `RulesSetup`, `RulesDocument`, `SignedInChrome`, `OnboardingGate`, `agreeToRules` (`POST /me/rules-agreement`).

### Variant: default

Signed in with a name and address and `rulesAgreedAt` still null. Rules body and **I agree to these rules** visible.

![21.gifts rules setup](images/setup-rules.png)

### Variant: mobile

Narrow viewport (375×812). The rules body wraps; **I agree to these rules** stays full-width after the document.

![21.gifts rules setup mobile](images/setup-rules-mobile.png)

## Screen: /welcome

- **URL:** `/welcome` — fourth screen after login, when name, address, and living-room rules agreement are all saved.
- **What the user sees:** One **Menu** top-right; open it for Profile, **Living room rules**, **Contact**, language, and **Log out**. Gift icon, **Welcome, {name}**, public forum heading, dismissible living-room laws hint box with an X when not yet dismissed on the account (two laws plus links to **Living room rules** `/rules` and **Contact** `/contact`; after dismiss the box is gone and the flag persists on the account), then a three-way selector (**Active** / **All** / **Most popular**). Default is **Active** (paid notes, messenger order: oldest top, newest above the composer). **All** shows every note in that messenger order. **Most popular** ranks paid notes by sats (highest first). Below the selector: message name, optional Founder / Moderator / Verified pill when the api `role` is one of those three (`basis` has no pill), timestamp, optional inline photo then caption text below the photo, sat total always; pay control / Send Bitcoin only when the note is payable; composer with **Add a photo** (ImagePlus) left of the textarea, **Post** (Send icon) to the right, and optional photo preview with **Remove photo** (X icon) — icon-only action controls, catalog `aria-label`s, no visible button text. Clicking a role pill toggles a short explanation under that card header. Paying a note opens a sheet with a top-left back control and a **Pay** button that includes the Wallet of Satoshi icon. On a computer the sheet also shows a QR; on a smartphone there is no QR. No name or address form. No guest donate CTA.
- **Actions:** Dismiss the living-room laws hint (permanent), post a text and/or photo message, attach/remove a photo draft, click a role pill for its explanation, pay a payable note in-app, switch the forum view (Active / All / Most popular), open the rules or contact pages, retry a failed load; open **Menu** for Profile, **Living room rules**, **Contact**, language, or **Log out**.
- **Calls:** `WelcomeScreen`, `ForumLoader`, `ForumBoard`, `SignedInChrome`, `OnboardingGate`, `prepareForumPhoto`, `fetchMessagePhoto`, `visibleForumMessages`.

### Variant: default

Gift icon, **Welcome, Ada**, public **Forum** with the dismissible laws hint box and rules/contact links, **Active** selected. Paid notes in messenger order (Carol 21 sats then Ada 5 sats); Bob's unpaid note is not visible. Composer with attach + Send icons. Pay control / Send Bitcoin only when the note is payable. Founder / Moderator / Verified pills beside the name when `role` is one of those three; `basis` has no pill (Carol is `verified`, Ada is `moderator`; Bob is `basis` and hidden on Active). One **Menu** top-right; open it for Profile, **Living room rules**, **Contact**, language, and **Log out**.

![21.gifts welcome](images/welcome.png)

### Variant: all

Click **All** — Bob's unpaid note (`Does anyone have spare sats this week?`) is visible with Ada and Carol.

![21.gifts welcome all](images/welcome-all.png)

### Variant: popular

Click **Most popular** — paid notes ordered by sats (Carol 21, then Ada 5). Unpaid Bob is hidden.

![21.gifts welcome popular](images/welcome-popular.png)

### Variant: empty-paid

Copy **No messages with sats yet.** Active selected, unpaid notes hidden, composer visible.

![21.gifts welcome empty paid](images/welcome-empty-paid.png)

### Variant: empty

Empty copy **No messages yet. Be the first to write.** plus composer (attach + textarea + Post).

![21.gifts welcome empty](images/welcome-empty.png)

### Variant: loading

Loading copy **Loading…** while the messages fetch is in flight.

![21.gifts welcome loading](images/welcome-loading.png)

### Variant: error

Load error **Could not load messages. Please try again.** plus **Try again**.

![21.gifts welcome error](images/welcome-error.png)

### Variant: validation-error

Click **Post** with an empty composer and no photo → **Enter a message or add a photo**. The composer caps at 500 characters (same as `POST /messages`); over-length drafts show **Keep it to 500 characters** and are not sent.

![21.gifts welcome validation error](images/welcome-validation-error.png)

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

Attach a GIF → **Use a JPEG, PNG, or WebP photo**.

![21.gifts welcome error unsupported](images/welcome-error-unsupported.png)

### Variant: error-unsupported-with-text

Same alert with caption **Caption with an unsupported photo.** still in the composer.

![21.gifts welcome error unsupported with text](images/welcome-error-unsupported-with-text.png)

### Variant: error-too-large

Encoded JPEG over 1 MB → **Keep the photo under 1 MB**.

![21.gifts welcome error too large](images/welcome-error-too-large.png)

### Variant: error-too-large-with-text

Same alert with caption **Caption with a photo that is too large.** still in the composer.

![21.gifts welcome error too large with text](images/welcome-error-too-large-with-text.png)

### Variant: error-request-photo-and-text

POST fails after caption+JPEG → **Could not post your message**; preview and caption remain.

![21.gifts welcome error request photo and text](images/welcome-error-request-photo-and-text.png)

### Variant: menu-open

Open **Menu** top-right only (do not click Language) → Profile is one line (User icon + Profile + sat totals on the right), Living room rules and Contact each have an icon, Language (Globe + label + chevron), Log out. Accessible names unchanged. No English / Deutsch / Español / Filipino option rows. No native language select.

![21.gifts welcome menu](images/welcome-menu.png)

### Variant: menu-language-open

After **Menu**, click **Language** → the four endonym rows (English / Deutsch / Español / Filipino) expand in flow under the Language trigger with a check on the current locale. The Menu grows; this is not an absolute popover.

![21.gifts welcome menu language](images/welcome-menu-language.png)

### Variant: pay-qr

Payable note, amount submitted. On a computer the pay sheet shows the Bitcoin payment QR, a top-left back control, and a **Pay** button with the Wallet of Satoshi icon.

![21.gifts welcome pay QR](images/welcome-pay-qr.png)

### Variant: pay-smartphone

Same pay sheet on a smartphone user-agent: **Pay** button with the Wallet of Satoshi icon only, no QR, plus the top-left back control.

![21.gifts welcome pay smartphone](images/welcome-pay-smartphone.png)

### Variant: role-hint

Carol's **Verified** tag clicked; the explanation under that card header is visible (**A moderator met this person in real life and confirmed they are a real human.**). Bob stays without a pill; Ada still shows **Moderator**.

![21.gifts welcome role hint](images/welcome-role-hint.png)

## Screen: /rules

- **URL:** `/rules` — public living-room rules. Light chrome (not the dark marketing shell). No auth gate.
- **What the user sees:** Light language switcher top-right. Page heading **Living room rules**, then lead, three laws (title + body + test where present), Wanted / Allowed / Rather not / Forbidden (three forbidden subheads + lists), House right, and CTAs **Contact 21.gifts** (`/contact`) and **Back to the forum** (`/welcome`).
- **Actions:** Change language. Read the rules. Open contact or the forum.
- **Calls:** `RulesPage`, `RulesDocument`, `LanguageSwitcher`.
- **Auth:** None.

### Variant: default

Full rules body with law **1. Only free donations** visible.

![21.gifts living room rules](images/rules.png)

## Screen: /contact

- **URL:** `/contact` — signed-in in-app contact (the only way to reach 21.gifts). Same onboarding gate as `/welcome` (name + address + living-room rules agreement required).
- **What the user sees:** One **Menu** top-right; open it for Profile, **Living room rules**, **Contact**, language, and **Log out**. Heading **Contact**, lead **Write to 21.gifts here. There is no email.**, link to **Living room rules**, composer textarea with **Send**. On success: success copy and the rules link; form hidden. No public inbox.
- **Actions:** Send a message, open the rules; open **Menu** for Profile, **Living room rules**, **Contact**, language, or **Log out**.
- **Calls:** `ContactPage`, `ContactLoader`, `ContactScreen`, `SignedInChrome`, `OnboardingGate`, `postContact` (`POST /contact/submit`).
- **Auth:** Bearer session; `OnboardingGate screen="welcome"`.

### Variant: default

Idle composer with lead and rules link.

![21.gifts contact](images/contact.png)

### Variant: validation-error

Click **Send** with an empty composer → **Enter a message**.

![21.gifts contact validation error](images/contact-validation-error.png)

### Variant: success

After a successful send: **Received. We read this in the app.** Form hidden; rules link remains.

![21.gifts contact success](images/contact-success.png)

## Screen: /profile

- **Purpose:** Signed-in profile after onboarding: compact dual-line Given/Received activity chart (Sat|USD) inside the identity card, edit name and Wallet of Satoshi address, copy the public view-key link via an icon-only control, return to the forum via an icon-only back control. Menu still shows icon+amount totals.
- **Inputs:** Session account (name + Lightning Address + `viewKey`) via `OnboardingGate` / `useAuthStore`; filtered gift stats via `useAccountTotals` (`GET /gifts/stats?recipient=`).
- **Actions:** Open **Menu** for Profile (current), **Living room rules**, **Contact**, language, or **Log out**; icon-only back (top-left) to the forum; save name; link or change address; toggle the activity chart between Sat and USD; copy the public view URL with the icon-only control (the 64-hex key and `/view/<key>` are not shown on screen).
- **Used by:** Route `/profile` (`ProfilePage`).

### Variant: default

Heading **Profile**, then inside the single `max-w-sm` identity card: a compact reserved-height Given/Received chart (legend left, Sat|USD right; no chart title heading; axes only when empty), name and Wallet of Satoshi address fields with icon actions to the right (pencil / check / X / trash), then an icon-only copy control for the public view URL; no **View key** heading and no visible URL/key text. No second panel below the card. Icon-only back top-left (returns to the forum); one **Menu** top-right (menu totals stay icons + amounts). Chart never swaps to **Loading…**.

![21.gifts profile](images/profile.png)

### Variant: receive

Filtered receive series with three UTC days (including a zero-gap day) and received total 1500 sats. Chart shows day ticks such as **2026-06-01**; Given stays flat at zero with a visible legend.

![21.gifts profile receive](images/profile-receive.png)

### Variant: usd-scale

Same receive stub as **receive**, with the chart scale switched to **USD** (`Given and received in USD`).

![21.gifts profile USD scale](images/profile-usd-scale.png)

### Variant: single-day

One receive day (21 sats on **2026-06-01**). Chart draws a horizontal single-point line.

![21.gifts profile single day](images/profile-single-day.png)

### Variant: large-usd

Two-day series with cumulative USD **1425.00**, scale switched to USD so the axis shows **$1,425**.

![21.gifts profile large USD](images/profile-large-usd.png)

## Screen: /view/[viewKey]

- **Purpose:** Public read-only profile opened via the capability URL `/view/<64-hex>`. Shows name, Wallet of Satoshi address, and given/received sat totals. No session as that user; no edit forms, menu, or logout.
- **Inputs:** Dynamic route `viewKey` (must be 64 lowercase hex). Profile from same-origin `GET /view-key/:viewKey` (`fetchViewProfile`); totals from public `fetchGiftStats` + `accountTotals` for the viewed address.
- **Actions:** Change language (light switcher top-right). On fetch error, **Try again**. No write actions.
- **Used by:** Route `/view/[viewKey]` (`ViewProfilePage`). Shared links copied from `/profile`.

### Variant: default

Valid known key. Heading **Profile**, display name, Wallet of Satoshi address, and sat totals.

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

## Screen: /handbook

- **URL:** `/handbook` — public app handbook (no auth gate).
- **What the user sees:** Localized heading **Handbook** and intro chrome, language switcher in the marketing header, intro with a link to the api handbook on GitHub (`21gifts/api`), in-page nav (Overview / Screens / Functions / Endpoints) each with a link icon, then the four `docs/handbook/` markdown files rendered as HTML (English bodies). Every markdown heading has a sibling link icon.
- **Actions:** Change language, read the docs, jump via the section nav, copy a chapter or heading URL (click the link icon → check icon for 1.2s, hash updates), follow the api handbook link, follow in-page markdown links.
- **Calls:** `HandbookPage`, `HandbookIntro`, `HandbookCopyLink`, `loadHandbookDocuments`, `HandbookMarkdown` (`parseHandbookMarkdown`), `LanguageSwitcher`.

### Variant: default

Idle copy buttons: every heading and chapter shows the link icon.

![21.gifts handbook](images/handbook.png)

### Variant: copied

After tapping the link icon on a heading or chapter, that button shows the check icon and `data-copied`, and `location.hash` is that id. Other copy buttons stay idle link icons.

![21.gifts handbook copied](images/handbook-copied.png)

## Screen: /404

- **URL:** any unknown path (App Router `not-found.tsx`). There is no `page.tsx` for `/404`; Playwright uses `page.goto('/404')` which hits this screen.
- **What the user sees:** Marketing chrome with a language switcher, heading **404**, **This page does not exist.**, **Back home**.
- **Actions:** Change language, go home, or use header/footer links.
- **Calls:** `NotFound`, `MarketingHeader`, `MarketingFooter`, `LanguageSwitcher`.

### Variant: default

The only state.

![21.gifts not found](images/not-found.png)
