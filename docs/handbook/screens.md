# Screens

## Screen: /

- **URL:** `/` — landing after login; unauthenticated visitors are sent to `/login`.
- **What the user sees:** Wordmark `21.gifts`, a short gift pitch, and (when logged in) the Lightning Address form to claim `name@21.gifts`.
- **Actions:** Log in (if needed), link or unlink a Lightning Address, start and confirm the 1-sat verification payment.
- **Calls:** `LoginCard` is not on this route; `LightningAddressForm` uses `fetchMe`, `setLightningAddress`, `unlinkLightningAddress`, `startLightningAddressVerification`, `confirmLightningAddressVerification`, `useAuthStore`.

## Screen: /login

- **URL:** `/login` — LNURL-auth challenge.
- **What the user sees:** QR of the uppercase LNURL, primary **Open Wallet of Satoshi**, secondary **Open default Lightning wallet**, **Copy login code**, and expiry/error states.
- **Actions:** Scan the QR, tap WoS (`walletofsatoshi:lightning:LNURL1…` / Android Intent), tap generic `lightning:`, or copy the LNURL. The page polls `/auth/session` until authenticated then stores the session and routes home.
- **Calls:** `LoginCard`, `useLnurlLogin`, `startLnurlAuth`, `pollSession`, `walletOfSatoshiHref`, `walletOfSatoshiIntentHref`, `uppercaseLnurl`, `QrCode`, `useAuthStore`.

## Screen: /donate

- **URL:** `/donate` — guest LNURL-pay gift. No login required.
- **What the user sees:** Heading **Send a gift**, Lightning Address field, sat amount, optional comment, **Create invoice**, then a QR and `lightning:` invoice link.
- **Actions:** Enter a LUD-16 address and amount, create an invoice, pay from any Lightning wallet.
- **Calls:** `DonateForm`, `resolveLightningAddress`, `requestDonateInvoice`, `satsToMsat`, `formatMsatAsSats`, `QrCode`.
