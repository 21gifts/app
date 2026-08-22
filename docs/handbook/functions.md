# Functions

## Function: DonateForm

- **Purpose:** Renders the guest donate form (Lightning Address and sat amount only; no comment) and, after success, the invoice QR.
- **Inputs:** Form state: address and whole-sat amount.
- **Returns / side effects:** React element. Side effects: HTTP to the api then GET the payee LNURL-pay callback.
- **Used by:** Screen `/donate`.

## Function: DonatePage

- **Purpose:** Next.js page for `/donate`.
- **Inputs:** None.
- **Returns / side effects:** The donate screen wrapped in the root layout.
- **Used by:** Route `/donate`.

## Function: GET

- **Purpose:** App-router handler for `GET /healthz` (liveness).
- **Inputs:** None.
- **Returns / side effects:** `Response` JSON `{ status: 'ok' }` with HTTP 200.
- **Used by:** Container probes, e2e smoke.

## Function: Home

- **Purpose:** Next.js page for `/`. Placeholder landing: wordmark, pitch, Coming soon, Donate and Log in links. No session UI.
- **Inputs:** None.
- **Returns / side effects:** The home screen element.
- **Used by:** Route `/`.

## Function: LightningAddressForm

- **Purpose:** Logged-in form to claim, verify, or unlink `name@21.gifts`.
- **Inputs:** Reads `useAuthStore`. User input: address string, verification confirm.
- **Returns / side effects:** React element or `null` when logged out.
- **Used by:** `LoginCard` signed-in view on screen `/login` (not on `/`).

## Function: LoginCard

- **Purpose:** LNURL-auth UI: hydrate session, start challenge, QR, WoS deep link, copy, poll, expiry, then signed-in view with `LightningAddressForm`.
- **Inputs:** Uses `useLnurlLogin` and `useAuthStore`. Rehydrates via `loadSession` + `fetchMe`.
- **Returns / side effects:** React element covering idle/waiting/expired/error/signed-in. Does not navigate away from `/login`.
- **Used by:** Screen `/login`.

## Function: LoginPage

- **Purpose:** Next.js page for `/login`.
- **Inputs:** None.
- **Returns / side effects:** Renders `LoginCard`.
- **Used by:** Route `/login`.

## Function: QrCode

- **Purpose:** SVG QR for a string (LNURL or bolt11).
- **Inputs:** `value` (required), optional `label`.
- **Returns / side effects:** React element.
- **Used by:** `LoginCard` and `DonateForm`.

## Function: RootLayout

- **Purpose:** Root HTML shell: `lang=en`, fonts, global CSS, metadata (title, icons, Open Graph, Twitter).
- **Inputs:** `children` React nodes.
- **Returns / side effects:** The document wrapper for every route.
- **Used by:** All screens.

## Function: clearSession

- **Purpose:** Removes the bearer token from `localStorage`.
- **Inputs:** None.
- **Returns / side effects:** void. No-op during SSR (`window` undefined).
- **Used by:** `useAuthStore.clearAuth`.

## Function: confirmLightningAddressVerification

- **Purpose:** POST `/me/lightning-address/verification/confirm` with the nonce after the 1-sat invoice is paid.
- **Inputs:** `sessionToken`, `nonce`.
- **Returns / side effects:** Updated `Account`, or throws on 4xx/5xx.
- **Used by:** `LightningAddressForm`.

## Function: fetchMe

- **Purpose:** GET `/me` with the bearer session.
- **Inputs:** `sessionToken`.
- **Returns / side effects:** `Account` or `null` on 401.
- **Used by:** `LoginCard` session hydration.

## Function: formatMsatAsSats

- **Purpose:** Formats millisatoshis as a sat string for the donate UI.
- **Inputs:** `msat` number.
- **Returns / side effects:** Decimal string in sats.
- **Used by:** `DonateForm` amount-range error (`minSendable`–`maxSendable`).

## Function: getApiUrl

- **Purpose:** Reads `NEXT_PUBLIC_API_URL` via the typed config accessor.
- **Inputs:** None.
- **Returns / side effects:** Origin string. Throws if unset/empty (entrypoint must substitute).
- **Used by:** Every `src/lib/api.ts` call.

## Function: isAndroidUserAgent

- **Purpose:** Detects Android so the WoS CTA can use an Intent URL.
- **Inputs:** `userAgent` string.
- **Returns / side effects:** `true` iff `/Android/i` matches.
- **Used by:** `LoginCard` QrView.

## Function: loadSession

- **Purpose:** Reads the bearer token from `localStorage`.
- **Inputs:** None.
- **Returns / side effects:** Token string or `null`. SSR-safe.
- **Used by:** `LoginCard` on mount.

## Function: pollSession

- **Purpose:** GET `/auth/session` with `X-Poll-Token`.
- **Inputs:** `pollToken`.
- **Returns / side effects:** `SessionResult` (`pending` / `authenticated` / `expired` / `used`).
- **Used by:** `useLnurlLogin`.

## Function: requestDonateInvoice

- **Purpose:** GET an LNURL-pay callback with `amount` millisatoshis and return the bolt11 string.
- **Inputs:** `{ callback, amountMsat, fetchImpl? }`. Address resolve happens first via `resolveLightningAddress`.
- **Returns / side effects:** bolt11 `string`, or throws.
- **Used by:** `DonateForm`.

## Function: resolveLightningAddress

- **Purpose:** GET `/lightning-address?address=` on the 21.gifts api.
- **Inputs:** `address`.
- **Returns / side effects:** Resolved LNURL-pay metadata (callback, min/max).
- **Used by:** `DonateForm` before paying.

## Function: satsToMsat

- **Purpose:** Converts whole sats to millisatoshis.
- **Inputs:** `sats` number.
- **Returns / side effects:** `sats * 1000`.
- **Used by:** `DonateForm` (converts sats before calling `requestDonateInvoice`).

## Function: saveSession

- **Purpose:** Writes the bearer token to `localStorage`.
- **Inputs:** `token` string.
- **Returns / side effects:** void. SSR no-op.
- **Used by:** `useAuthStore.setAuth`.

## Function: setLightningAddress

- **Purpose:** POST `/me/lightning-address`.
- **Inputs:** `sessionToken`, `address`.
- **Returns / side effects:** Updated `Account`.
- **Used by:** `LightningAddressForm`.

## Function: startLightningAddressVerification

- **Purpose:** POST `/me/lightning-address/verification` — api pays ~1 sat to the linked address. The nonce is **not** in the JSON; the user reads it from the wallet payment comment.
- **Inputs:** `sessionToken`.
- **Returns / side effects:** `{ status: 'sent', expiresInSeconds, sats }`.
- **Used by:** `LightningAddressForm`.

## Function: startLnurlAuth

- **Purpose:** GET `/auth/lnurl` — creates k1 + LNURL + poll token.
- **Inputs:** None.
- **Returns / side effects:** `StartChallenge`.
- **Used by:** `useLnurlLogin`.

## Function: unlinkLightningAddress

- **Purpose:** DELETE `/me/lightning-address`.
- **Inputs:** `sessionToken`.
- **Returns / side effects:** Updated `Account` with address cleared.
- **Used by:** `LightningAddressForm`.

## Function: uppercaseLnurl

- **Purpose:** Uppercases a bech32 LNURL (LUD-01).
- **Inputs:** `lnurl` string.
- **Returns / side effects:** Uppercase string.
- **Used by:** QR value, `lightning:` href, WoS hrefs.

## Function: useAuthStore

- **Purpose:** Zustand store for `session` + `account`. Hydration is explicit (no module-init `localStorage`).
- **Inputs:** Hook. Methods `setAuth`, `setAccount`, `clearAuth`.
- **Returns / side effects:** Auth state object.
- **Used by:** `LoginCard`, `useLnurlLogin`, `LightningAddressForm` on `/login` (not `/`).

## Function: useLnurlLogin

- **Purpose:** Hook: start LNURL-auth, poll until authenticated or expired, expose status/error/lnurl/start.
- **Inputs:** None.
- **Returns / side effects:** `UseLnurlLogin` status machine.
- **Used by:** `LoginCard`.

## Function: walletOfSatoshiHref

- **Purpose:** iOS/desktop WoS deep link.
- **Inputs:** `lnurl`.
- **Returns / side effects:** `walletofsatoshi:lightning:` + uppercase LNURL.
- **Used by:** `LoginCard` primary CTA when not Android.

## Function: walletOfSatoshiIntentHref

- **Purpose:** Android Chrome Intent pinning the WoS package.
- **Inputs:** `lnurl`.
- **Returns / side effects:** `intent:lightning:LNURL…#Intent;scheme=walletofsatoshi;package=com.livingroomofsatoshi.wallet;…;end`.
- **Used by:** `LoginCard` primary CTA on Android.
