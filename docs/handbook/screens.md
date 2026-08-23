# Screens

## Screen: /

- **URL:** `/` — public marketing landing (no auth gate).
- **What the user sees:** Dark 21.gifts header, headline about peer-to-peer Lightning gifts, How it works (LNURL-auth + Lightning Address) / Why / FAQ, CTAs **Ask for help** (`/login`) and **Send help** (`/donate`).
- **Actions:** Read the pitch, open login or donate, jump to in-page sections, open Legal & Privacy, open the Handbook.
- **Calls:** `Home` (`src/app/(marketing)/page.tsx`) inside `MarketingLayout`.

## Screen: /legal

- **URL:** `/legal` — imprint and privacy. `/legal.html` permanently redirects here.
- **What the user sees:** Legal Notice (Switzerland, info@21.gifts) and Privacy Policy (no cookies/analytics, session in localStorage, Cloudflare TLS, LNURL-auth on this origin).
- **Actions:** Read-only. Header **Log in** goes to `/login`.
- **Calls:** `LegalPage`.

## Screen: /login

- **URL:** `/login` — LNURL-auth challenge.
- **What the user sees:** Idle: page heading **Log in to 21.gifts**, card heading **Sign in to 21.gifts**, and button **Log in with your Lightning wallet**. After start: QR of the uppercase LNURL, primary **Open Wallet of Satoshi**, secondary **Open default Lightning wallet**, **Copy login code**, plus expiry/error/signed-in states.
- **Actions:** Scan the QR, tap WoS (`walletofsatoshi:lightning:LNURL1…` / Android Intent), tap generic `lightning:`, or copy the LNURL. The page polls `/auth/session` until authenticated, then stays on `/login` and shows the signed-in card (role, linking key, Lightning Address form to link/edit/unlink, log out). There is no client redirect to `/`. There is no address-verification UI.
- **Calls:** `LoginCard` (includes `LightningAddressForm` when signed in), `useLnurlLogin`, `startLnurlAuth`, `pollSession`, `walletOfSatoshiHref`, `walletOfSatoshiIntentHref`, `uppercaseLnurl`, `QrCode`, `useAuthStore`.

![21.gifts login](images/login.png)

## Screen: /donate

- **URL:** `/donate` — guest LNURL-pay gift. No login required.
- **What the user sees:** Heading **Send a gift**, Lightning Address field, sat amount (no comment field), **Create invoice**, then a QR and `lightning:` invoice link.
- **Actions:** Enter a LUD-16 address and amount, create an invoice, pay from any Lightning wallet.
- **Calls:** `DonateForm`, `resolveLightningAddress`, `requestDonateInvoice`, `satsToMsat`, `formatMsatAsSats`, `QrCode`.

![21.gifts donate](images/donate.png)

## Screen: /handbook

- **URL:** `/handbook` — public app handbook (no auth gate).
- **What the user sees:** Heading **Handbook**, a short intro with a link to the api handbook on GitHub (`21gifts/api`), in-page nav (Overview / Screens / Functions / Endpoints), then the four `docs/handbook/` markdown files rendered as HTML. Login and donate screenshots appear where the markdown references `images/*.png`.
- **Actions:** Read the docs, jump via the section nav, follow the api handbook link, follow in-page markdown links.
- **Calls:** `HandbookPage`, `loadHandbookDocuments`, `HandbookMarkdown` (`parseHandbookMarkdown`).
