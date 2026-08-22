# Screens

## Screen: /

- **URL:** `/` — public landing placeholder (no auth gate).
- **What the user sees:** Gift icon, wordmark `21.gifts`, one-line pitch, “Coming soon”, links **Donate** (`/donate`) and **Log in** (`/login`).
- **Actions:** Navigate to donate or login. There is no Lightning Address form on this route.
- **Calls:** `Home` only (`src/app/page.tsx`). Auth UI lives on `/login`.

## Screen: /login

- **URL:** `/login` — LNURL-auth challenge.
- **What the user sees:** Idle: page heading **Log in to 21.gifts**, card heading **Sign in to 21.gifts**, and button **Log in with your Lightning wallet**. After start: QR of the uppercase LNURL, primary **Open Wallet of Satoshi**, secondary **Open default Lightning wallet**, **Copy login code**, plus expiry/error/signed-in states.
- **Actions:** Scan the QR, tap WoS (`walletofsatoshi:lightning:LNURL1…` / Android Intent), tap generic `lightning:`, or copy the LNURL. The page polls `/auth/session` until authenticated, then stays on `/login` and shows the signed-in card (role, linking key, Lightning Address form, log out). There is no client redirect to `/`.
- **Calls:** `LoginCard` (includes `LightningAddressForm` when signed in), `useLnurlLogin`, `startLnurlAuth`, `pollSession`, `walletOfSatoshiHref`, `walletOfSatoshiIntentHref`, `uppercaseLnurl`, `QrCode`, `useAuthStore`.

## Screen: /donate

- **URL:** `/donate` — guest LNURL-pay gift. No login required.
- **What the user sees:** Heading **Send a gift**, Lightning Address field, sat amount (no comment field), **Create invoice**, then a QR and `lightning:` invoice link.
- **Actions:** Enter a LUD-16 address and amount, create an invoice, pay from any Lightning wallet.
- **Calls:** `DonateForm`, `resolveLightningAddress`, `requestDonateInvoice`, `satsToMsat`, `formatMsatAsSats`, `QrCode`.
