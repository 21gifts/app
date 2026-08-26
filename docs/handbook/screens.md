# Screens

## Screen: /

- **URL:** `/` — public marketing landing (no auth gate).
- **What the user sees:** Dark 21.gifts header with a language switcher, headline about peer-to-peer Bitcoin gifts, How it works (login and Wallet of Satoshi address) / Why / FAQ, CTAs **Ask for help** (`/login`) and **Send help** (`/donate`).
- **Actions:** Read the pitch, change language, open login or donate, jump to in-page sections, open Stats, open Legal & Privacy, open the Handbook.
- **Calls:** `Home` (`src/app/(marketing)/page.tsx`) inside `MarketingLayout`, `LanguageSwitcher`.

### Variant: default

Desktop/wide layout: section nav is visible in the header (How it works, Why, FAQ, Stats, Handbook, Log in). No hamburger.

![21.gifts home](images/root.png)

### Variant: mobile-nav

Narrow viewport: header shows the Menu button. Open it to reveal the same links stacked. Tapping a link closes the menu.

![21.gifts home mobile nav](images/root-mobile-nav.png)

## Screen: /legal

- **URL:** `/legal` — imprint and privacy. `/legal.html` permanently redirects here.
- **What the user sees:** Dark 21.gifts header with a language switcher, Legal Notice (Switzerland, info@21.gifts) and Privacy Policy (no analytics; no cookies unless the visitor chooses a language — then a `locale` cookie; session in localStorage; Cloudflare TLS; login on this origin). Legal body copy stays English.
- **Actions:** Change language. Read the legal body. Header **Log in** goes to `/login`.
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
- **What the user sees:** Light language switcher top-right on the page (not the marketing header). Idle **Log in**. Error is terminal until **Try again**. After success the visitor is sent to `/setup/name`, `/setup/address`, or `/welcome`.
- **Actions:** Change language. Log in (existing login, or create one when the browser has none).
- **Calls:** `LoginCard`, `OnboardingGate`, `usePasskeyLogin`, `useAuthStore`, `LanguageSwitcher`.

### Variant: idle

Logged out. Heading **Sign in to 21.gifts**, one **Log in** button.

![21.gifts login idle](images/login.png)

### Variant: starting

Transient after a login click, before the ceremony finishes: spinner and **Preparing your login…**.

![21.gifts login starting](images/login-starting.png)

### Variant: error

Login begin or finish failed. Copy **Something went wrong. Please try again.** and **Try again**.

![21.gifts login error](images/login-error.png)

## Screen: /setup/name

- **URL:** `/setup/name` — first screen after login.
- **What the user sees:** Light language switcher top-right. **Log out** top-left in the page chrome (not on the card). Heading **Your name**, name form. No Wallet of Satoshi form.
- **Actions:** Save a name, log out, change language. After save, the visitor is sent to `/setup/address`.
- **Calls:** `NameSetup`, `NameForm`, `LogoutButton`, `OnboardingGate`, `LanguageSwitcher`.

### Variant: default

Signed in, no name yet. **Your name**, **Save name**. **Log out** top-left in the chrome, not on the card.

![21.gifts name setup](images/setup-name.png)

## Screen: /setup/address

- **URL:** `/setup/address` — second screen after login.
- **What the user sees:** Light language switcher top-right. **Log out** top-left in the page chrome (not on the address card). Heading **Your Wallet of Satoshi address**, greeting **Hi, {name}**, address form. No name form.
- **Actions:** Link an address, log out, change language. After save, the visitor is sent to `/welcome`.
- **Calls:** `AddressSetup`, `LightningAddressForm`, `LogoutButton`, `OnboardingGate`, `LanguageSwitcher`.

### Variant: default

Signed in with a name and no address. **Your Wallet of Satoshi address**, **Link address**. **Log out** top-left in the chrome, not on the address card.

![21.gifts address setup](images/setup-address.png)

## Screen: /welcome

- **URL:** `/welcome` — third screen after login, when name and address are both saved.
- **What the user sees:** Light language switcher top-right. **Log out** top-left in the page chrome (not on the card). Gift icon, **Welcome, {name}**, ready copy, **Send a gift**. No name or address form.
- **Actions:** Open `/donate`, log out, change language.
- **Calls:** `WelcomeScreen`, `LogoutButton`, `OnboardingGate`, `LanguageSwitcher`.

### Variant: default

Gift icon, **Welcome, Ada**, **Send a gift**. **Log out** top-left in the chrome, not on the card.

![21.gifts welcome](images/welcome.png)

## Screen: /donate

- **URL:** `/donate` — guest Bitcoin gift. No login required.
- **What the user sees:** Light language switcher top-right on the page (not the marketing header). Page heading **Send a gift**, form heading **Send Bitcoin**, Wallet of Satoshi address field, sat amount (no comment), **Continue**, then a QR and **Open Wallet of Satoshi** — or a validation/range error on the form.
- **Actions:** Change language. Enter a Wallet of Satoshi address and amount, continue, pay with Wallet of Satoshi.
- **Calls:** `DonateForm`, `resolveLightningAddress`, `requestDonateInvoice`, `satsToMsat`, `QrCode`, `isAndroidUserAgent`, `walletOfSatoshiHref`, `walletOfSatoshiIntentHref`, `LanguageSwitcher`.

### Variant: form

Empty/idle form, submit enabled.

![21.gifts donate form](images/donate.png)

### Variant: busy

Payment request in flight: spinner on **Continue**, extra **Cancel** button.

![21.gifts donate busy](images/donate-busy.png)

### Variant: validation-error

Submit with a blank address (or invalid amount). An alert explains what to fix; no payment QR yet.

![21.gifts donate validation error](images/donate-validation-error.png)

### Variant: invoice

Successful create: **Pay N sats to address**, Bitcoin payment QR, **Open Wallet of Satoshi**.

![21.gifts donate invoice](images/donate-invoice.png)

### Variant: invoice-android

Same payment card, but **Open Wallet of Satoshi** is an Android Intent that pins package `com.livingroomofsatoshi.wallet`. The pixels match the desktop invoice variant.

![21.gifts donate invoice Android](images/donate-invoice-android.png)

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
