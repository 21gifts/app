# Screens

## Screen: /

- **URL:** `/` — public marketing landing (no auth gate).
- **What the user sees:** Dark 21.gifts header, headline about peer-to-peer Bitcoin gifts, How it works (Wallet of Satoshi login and address) / Why / FAQ, CTAs **Ask for help** (`/login`) and **Send help** (`/donate`).
- **Actions:** Read the pitch, open login or donate, jump to in-page sections, open Legal & Privacy, open the Handbook.
- **Calls:** `Home` (`src/app/(marketing)/page.tsx`) inside `MarketingLayout`.

### Variant: default

Desktop/wide layout: section nav is visible in the header (How it works, Why, FAQ, Handbook, Log in). No hamburger.

![21.gifts home](images/root.png)

### Variant: mobile-nav

Narrow viewport: header shows the Menu button. Open it to reveal the same links stacked. Tapping a link closes the menu.

![21.gifts home mobile nav](images/root-mobile-nav.png)

## Screen: /legal

- **URL:** `/legal` — imprint and privacy. `/legal.html` permanently redirects here.
- **What the user sees:** Legal Notice (Switzerland, info@21.gifts) and Privacy Policy (no cookies/analytics, session in localStorage, Cloudflare TLS, Wallet of Satoshi login on this origin).
- **Actions:** Read-only. Header **Log in** goes to `/login`.
- **Calls:** `LegalPage`.

### Variant: default

The only state: imprint plus privacy, marketing chrome.

![21.gifts legal](images/legal.png)

## Screen: /login

- **URL:** `/login` — Wallet of Satoshi sign-in.
- **What the user sees:** Idle start button, then QR and **Open Wallet of Satoshi**, or signed-in account. Error and expiry are terminal until **Try again**. There is no generic wallet link and no copy control.
- **Actions:** Scan the QR or tap **Open Wallet of Satoshi**. When signed in, link/unlink a Wallet of Satoshi address and log out. No client redirect to `/`.
- **Calls:** `LoginCard`, `LightningAddressForm`, `useLnurlLogin`, `startLnurlAuth`, `pollSession`, `walletOfSatoshiHref`, `walletOfSatoshiIntentHref`, `uppercaseLnurl`, `QrCode`, `useAuthStore`.

### Variant: idle

Logged out, no challenge yet. Heading **Sign in to 21.gifts**, button **Log in with Wallet of Satoshi**.

![21.gifts login idle](images/login.png)

### Variant: starting

Transient after the start click, before `/auth/lnurl` returns: spinner and **Preparing your login…**.

![21.gifts login starting](images/login-starting.png)

### Variant: qr

Challenge pending on desktop/iOS. QR and **Open Wallet of Satoshi**. No generic wallet link and no copy control.

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

Session present, no Wallet of Satoshi address yet. **Signed in**, role, shortened linking key, link form, **Log out**.

![21.gifts login signed in](images/login-signed-in.png)

### Variant: signed-in-linked

Signed in with an address on the account. Shows the address plus **Edit** / **Unlink** (no verification UI).

![21.gifts login signed in linked](images/login-signed-in-linked.png)

## Screen: /donate

- **URL:** `/donate` — guest Bitcoin gift. No login required.
- **What the user sees:** Heading **Send a gift**, Wallet of Satoshi address field, sat amount (no comment), **Continue**, then a QR and **Open Wallet of Satoshi** — or a validation/range error on the form.
- **Actions:** Enter a Wallet of Satoshi address and amount, continue, pay with Wallet of Satoshi.
- **Calls:** `DonateForm`, `resolveLightningAddress`, `requestDonateInvoice`, `satsToMsat`, `formatMsatAsSats`, `QrCode`, `walletOfSatoshiHref`, `walletOfSatoshiIntentHref`.

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

## Screen: /handbook

- **URL:** `/handbook` — public app handbook (no auth gate).
- **What the user sees:** Heading **Handbook**, intro with a link to the api handbook on GitHub (`21gifts/api`), in-page nav (Overview / Screens / Functions / Endpoints) each with **Copy link**, then the four `docs/handbook/` markdown files rendered as HTML. Every markdown heading has a sibling **Copy link**.
- **Actions:** Read the docs, jump via the section nav, copy a chapter or heading URL (**Copy link** → **Copied** for 1.2s, hash updates), follow the api handbook link, follow in-page markdown links.
- **Calls:** `HandbookPage`, `HandbookCopyLink`, `loadHandbookDocuments`, `HandbookMarkdown` (`parseHandbookMarkdown`).

### Variant: default

Idle copy buttons: every heading and chapter shows **Copy link**.

![21.gifts handbook](images/handbook.png)

### Variant: copied

After tapping **Copy link** on a heading or chapter, that button reads **Copied** and `location.hash` is that id. Other copy buttons stay idle.

![21.gifts handbook copied](images/handbook-copied.png)

## Screen: /404

- **URL:** any unknown path (App Router `not-found.tsx`). There is no `page.tsx` for `/404`; Playwright uses `page.goto('/404')` which hits this screen.
- **What the user sees:** Marketing chrome, heading **404**, **This page does not exist.**, **Back home**.
- **Actions:** Go home, or use header/footer links.
- **Calls:** `NotFound`, `MarketingHeader`, `MarketingFooter`.

### Variant: default

The only state.

![21.gifts not found](images/not-found.png)
