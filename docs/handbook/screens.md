# Screens

## Screen: /

- **URL:** `/` — public marketing landing (no auth gate).
- **What the user sees:** Dark 21.gifts header with an always-visible language switcher, headline about peer-to-peer Lightning gifts, How it works (LNURL-auth + Lightning Address) / Why / FAQ, CTAs **Ask for help** (`/login`) and **Send help** (`/donate`). Copy follows `Accept-Language` or a `locale` cookie after the visitor picks a language.
- **Actions:** Read the pitch, change language, open login or donate, jump to in-page sections, open Legal & Privacy, open the Handbook.
- **Calls:** `Home` (`src/app/(marketing)/page.tsx`) inside `MarketingLayout`; chrome uses `LanguageSwitcher`.

### Variant: default

Desktop/wide layout: section nav is visible in the header (How it works, Why, FAQ, Handbook, Log in) plus the language select. No hamburger.

![21.gifts home](images/root.png)

### Variant: mobile-nav

Narrow viewport: header shows the Menu button. Open it to reveal the same links stacked. Tapping a link closes the menu.

![21.gifts home mobile nav](images/root-mobile-nav.png)

## Screen: /legal

- **URL:** `/legal` — imprint and privacy. `/legal.html` permanently redirects here.
- **What the user sees:** Legal Notice (Switzerland, info@21.gifts) and Privacy Policy (no analytics; `locale` cookie only after a language choice; session in localStorage; Cloudflare TLS; LNURL-auth on this origin). Body stays English; marketing chrome follows locale.
- **Actions:** Read-only. Header **Log in** goes to `/login`. Language switcher in the header.
- **Calls:** `LegalPage`.

### Variant: default

The only state: imprint plus privacy, marketing chrome.

![21.gifts legal](images/legal.png)

## Screen: /login

- **URL:** `/login` — LNURL-auth challenge.
- **What the user sees:** Top-right language switcher (`tone="light"`), idle start button, then QR and **Open Wallet of Satoshi**, or signed-in account. Error and expiry are terminal until **Try again**. There is no generic `lightning:` link and no copy-LNURL control.
- **Actions:** Change language, scan the QR or tap WoS (`walletofsatoshi:lightning:LNURL1…` / Android Intent). When signed in, link/unlink a Lightning Address and log out. No client redirect to `/`.
- **Calls:** `LoginCard`, `LightningAddressForm`, `LanguageSwitcher`, `useLnurlLogin`, `startLnurlAuth`, `pollSession`, `walletOfSatoshiHref`, `walletOfSatoshiIntentHref`, `uppercaseLnurl`, `QrCode`, `useAuthStore`.

### Variant: idle

Logged out, no challenge yet. Heading **Sign in to 21.gifts**, button **Log in with your Lightning wallet**.

![21.gifts login idle](images/login.png)

### Variant: starting

Transient after the start click, before `/auth/lnurl` returns: spinner and **Preparing your login…**.

![21.gifts login starting](images/login-starting.png)

### Variant: qr

Challenge pending on desktop/iOS. QR of the uppercase LNURL and **Open Wallet of Satoshi** (`walletofsatoshi:lightning:`). No generic `lightning:` link and no copy control.

![21.gifts login QR](images/login-qr.png)

### Variant: qr-android

Same QR card, but **Open Wallet of Satoshi** is an Android Intent that pins package `com.livingroomofsatoshi.wallet`.

![21.gifts login QR Android](images/login-qr-android.png)

### Variant: expired

Poll returned `expired` or `used`. Copy **Login expired** and **Try again** (calls `start()`).

![21.gifts login expired](images/login-expired.png)

### Variant: error

Challenge start or a later request failed. Copy **Something went wrong. Please try again.** and **Try again**.

![21.gifts login error](images/login-error.png)

### Variant: signed-in

Session present, no Lightning Address yet. **Signed in**, role, shortened linking key, link form, **Log out**.

![21.gifts login signed in](images/login-signed-in.png)

### Variant: signed-in-linked

Signed in with an address on the account. Shows the address plus **Edit** / **Unlink** (no verification UI).

![21.gifts login signed in linked](images/login-signed-in-linked.png)

## Screen: /donate

- **URL:** `/donate` — guest LNURL-pay gift. No login required.
- **What the user sees:** Top-right language switcher (`tone="light"`), heading **Send a gift**, Lightning Address field, sat amount (no comment), **Create invoice**, then a QR and `lightning:` invoice link — or a validation/range error on the form.
- **Actions:** Change language, enter a LUD-16 address and amount, create an invoice, pay from any Lightning wallet.
- **Calls:** `DonateForm`, `LanguageSwitcher`, `resolveLightningAddress`, `requestDonateInvoice`, `satsToMsat`, `QrCode`.

### Variant: form

Empty/idle form, submit enabled.

![21.gifts donate form](images/donate.png)

### Variant: busy

Invoice request in flight: spinner on **Create invoice**, extra **Cancel** button.

![21.gifts donate busy](images/donate-busy.png)

### Variant: validation-error

Submit with a blank address (or invalid amount). An alert explains what to fix; no invoice yet.

![21.gifts donate validation error](images/donate-validation-error.png)

### Variant: invoice

Successful create: **Pay N sats to address**, invoice QR, **Open in wallet** (`lightning:`).

![21.gifts donate invoice](images/donate-invoice.png)

## Screen: /handbook

- **URL:** `/handbook` — public app handbook (no auth gate).
- **What the user sees:** Localized heading **Handbook** and intro chrome, language switcher in the marketing header, intro with a link to the api handbook on GitHub (`21gifts/api`), in-page nav (Overview / Screens / Functions / Endpoints), then the four `docs/handbook/` markdown files rendered as HTML (English bodies).
- **Actions:** Change language, read the docs, jump via the section nav, follow the api handbook link, follow in-page markdown links.
- **Calls:** `HandbookPage`, `loadHandbookDocuments`, `HandbookMarkdown` (`parseHandbookMarkdown`).

### Variant: default

The only state: aggregated markdown plus screenshots.

![21.gifts handbook](images/handbook.png)

## Screen: /404

- **URL:** any unknown path (App Router `not-found.tsx`). There is no `page.tsx` for `/404`; Playwright uses `page.goto('/404')` which hits this screen.
- **What the user sees:** Marketing chrome (including language switcher), heading **404**, localized “does not exist” copy, and **Back home**.
- **Actions:** Change language, go home, or use header/footer links.
- **Calls:** `NotFound`, `MarketingHeader`, `MarketingFooter`.

### Variant: default

The only state.

![21.gifts not found](images/not-found.png)
