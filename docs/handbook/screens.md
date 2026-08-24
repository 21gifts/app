# Screens

## Screen: /

- **URL:** `/` — public marketing landing (no auth gate).
- **What the user sees:** Dark 21.gifts header with a language switcher, headline about peer-to-peer Bitcoin gifts, How it works (passkey login and Wallet of Satoshi address) / Why / FAQ, CTAs **Ask for help** (`/login`) and **Send help** (`/donate`).
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
- **What the user sees:** Dark 21.gifts header with a language switcher, Legal Notice (Switzerland, info@21.gifts) and Privacy Policy (no analytics; no cookies unless the visitor chooses a language — then a `locale` cookie; session in localStorage; Cloudflare TLS; passkey login on this origin). Legal body copy stays English.
- **Actions:** Change language. Read the legal body. Header **Log in** goes to `/login`.
- **Calls:** `LegalPage` inside `MarketingLayout`, `LanguageSwitcher`.

### Variant: default

The only state: imprint plus privacy, marketing chrome.

![21.gifts legal](images/legal.png)

## Screen: /stats

- **URL:** `/stats` — public gift totals (no auth gate).
- **What the user sees:** Dark 21.gifts header with a language switcher, heading **Gifts**, four KPI cards (total spent in **BTC** and **USD** with a sats caption, gifts, people, period), then diagrams: **Total spend over time** (one cumulative chart), **By person** and **By month**. Each diagram has a BTC/USD control that defaults to BTC; over time switches the series, person and month rescale bar size while labels stay both units. Empty database copy: **No gifts recorded yet.** Stats body copy stays English.
- **Actions:** Change language. Read the charts. Switch **Total spend over time** / **By person** / **By month** between BTC and USD. Header **Stats** stays on this page; **Log in** goes to `/login`.
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

- **URL:** `/login` — passkey only.
- **What the user sees:** Light language switcher top-right on the page (not the marketing header). Idle **Create a passkey** / **Continue with passkey**, or signed-in account. Error is terminal until **Try again**.
- **Actions:** Change language. Create or continue with a passkey. When signed in, set a display name, link/unlink a Wallet of Satoshi address, and log out. No client redirect to `/`.
- **Calls:** `LoginCard`, `NameForm`, `LightningAddressForm`, `usePasskeyLogin`, `useAuthStore`, `LanguageSwitcher`.

### Variant: idle

Logged out. Heading **Sign in to 21.gifts**, **Create a passkey**, **Continue with passkey**.

![21.gifts login idle](images/login.png)

### Variant: starting

Transient after a passkey click, before the ceremony finishes: spinner and **Preparing your login…**.

![21.gifts login starting](images/login-starting.png)

### Variant: error

Passkey begin or finish failed. Copy **Something went wrong. Please try again.** and **Try again**.

![21.gifts login error](images/login-error.png)

### Variant: signed-in

Session present, no name and no Wallet of Satoshi address yet. **Signed in**, role, name form, address form, **Log out**.

![21.gifts login signed in](images/login-signed-in.png)

### Variant: signed-in-named

Signed in with a display name set. Shows the name plus **Edit**, and the empty address form.

![21.gifts login signed in named](images/login-signed-in-named.png)

### Variant: signed-in-linked

Signed in with an address on the account. Name form (set or **Edit**) plus the address with **Edit** / **Unlink** (no verification UI).

![21.gifts login signed in linked](images/login-signed-in-linked.png)

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
