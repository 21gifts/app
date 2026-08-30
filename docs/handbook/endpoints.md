# HTTP endpoints (Next.js route handlers)

## Endpoint: GET /.well-known/nostr.json

- **Purpose:** Proxies NIP-05 `nostr.json` from the api onto the site apex. CORS `*`.
- **Errors:** Upstream 502/503.
- **Used by:** Damus verification.
- **Auth:** none.

## Endpoint: OPTIONS /.well-known/nostr.json

- **Purpose:** CORS preflight for NIP-05.
- **Errors:** none.
- **Used by:** Browsers.
- **Auth:** none.

## Endpoint: GET /healthz

- **Purpose:** Liveness JSON `{ status: 'ok' }` from `src/app/healthz/route.ts`.
- **Errors:** None if the process is up (always 200).
- **Used by:** Container probes and Playwright smoke.
- **Auth:** Public.

## Endpoint: POST /auth/passkey/authenticate/begin

- **Purpose:** Same-origin proxy of api `POST /auth/passkey/authenticate/begin`.
- **Errors:** Upstream status, or 502 if the api is unreachable.
- **Used by:** `startPasskeyAuthentication`.
- **Auth:** Public.

## Endpoint: POST /auth/passkey/authenticate/finish

- **Purpose:** Same-origin proxy of api `POST /auth/passkey/authenticate/finish`.
- **Errors:** Upstream status, or 502 if the api is unreachable.
- **Used by:** `finishPasskeyAuthentication`.
- **Auth:** Public.

## Endpoint: POST /auth/passkey/register/begin

- **Purpose:** Same-origin proxy of api `POST /auth/passkey/register/begin`. Optional JSON body `{ viewKey }` (64 hex) claims an existing public profile; omit the body for a new registration.
- **Errors:** Upstream status (including 404 / 409 with `{ error }`), or 502 if the api is unreachable.
- **Used by:** `startPasskeyRegistration`.
- **Auth:** Public.

## Endpoint: POST /auth/passkey/register/finish

- **Purpose:** Same-origin proxy of api `POST /auth/passkey/register/finish`.
- **Errors:** Upstream status, or 502 if the api is unreachable.
- **Used by:** `finishPasskeyRegistration`.
- **Auth:** Public.

## Endpoint: GET /gifts

- **Purpose:** Same-origin proxy of api `GET /gifts?day=YYYY-MM-DD` (individual outbound gifts that UTC day).
- **Errors:** Upstream 400/503, or 502 if the api is unreachable.
- **Used by:** `fetchGiftDay` on `/stats/[day]`.
- **Auth:** Public.

## Endpoint: GET /gifts/stats

- **Purpose:** Same-origin proxy of api `GET /gifts/stats` (aggregated outbound gift totals; optional `recipient` query forwarded).
- **Errors:** Upstream 503, or 502 if the api is unreachable.
- **Used by:** `fetchGiftStats` on `/stats` and `/profile`.
- **Auth:** Public.

## Endpoint: GET /lightning-address

- **Purpose:** Same-origin proxy of public LUD-16 resolve.
- **Errors:** Upstream 400/502, or 502 if the api is unreachable.
- **Used by:** `resolveLightningAddress` (LUD-16 helper).
- **Auth:** Public.

## Endpoint: POST /me/name

- **Purpose:** Same-origin proxy to set or replace the display name.
- **Errors:** Upstream 400, or 502 if the api is unreachable.
- **Used by:** `setName`.
- **Auth:** Bearer.

## Endpoint: POST /me/forum-laws-dismissed

- **Purpose:** Same-origin proxy to permanently dismiss the welcome-forum living-room laws hint (`forumLawsDismissed: true` on the account).
- **Errors:** Upstream 401, or 502 if the api is unreachable.
- **Used by:** `dismissForumLaws`.
- **Auth:** Bearer.

## Endpoint: POST /me/rules-agreement

- **Purpose:** Same-origin proxy to record living-room rules agreement on the signed-in account (`rulesAgreedAt`).
- **Errors:** Upstream 401, or 502 if the api is unreachable.
- **Used by:** `agreeToRules`.
- **Auth:** Bearer.

## Endpoint: GET /me

- **Purpose:** Same-origin proxy of the signed-in account.
- **Errors:** Upstream 401, or 502 if the api is unreachable.
- **Used by:** `fetchMe`.
- **Auth:** Bearer.

## Endpoint: GET /view-key/[viewKey]

- **Purpose:** Same-origin public proxy of api `GET /view/:viewKey`.
- **Errors:** Upstream 404 `{ error: "Not found" }`, or 502 if the api is unreachable.
- **Used by:** `fetchViewProfile`.
- **Auth:** Public.

## Endpoint: GET /messages

- **Purpose:** Same-origin Bearer proxy of api GET `/messages` (public forum list, newest-first).
- **Errors:** Upstream 401, or 502 if the api is unreachable.
- **Used by:** `fetchMessages`.
- **Auth:** Bearer.

## Endpoint: POST /messages

- **Purpose:** Same-origin Bearer proxy of api POST `/messages` (create a public forum message with optional photo).
- **Errors:** Upstream 401/400/429, or 502 if the api is unreachable.
- **Used by:** `postMessage`.
- **Auth:** Bearer.

## Endpoint: POST /messages/[id]/invoice

- **Purpose:** Same-origin Bearer proxy of api POST `/messages/:id/invoice` (pay a forum note).
- **Errors:** Upstream 401/400/404/429/503, or 502 if the api is unreachable.
- **Used by:** `postMessageInvoice`.
- **Auth:** Bearer.

## Endpoint: POST /contact/submit

- **Purpose:** Same-origin Bearer proxy of api POST `/contact` (create an in-app contact message to 21.gifts). Nested under `/contact/submit` because the UI page already owns `/contact`.
- **Errors:** Upstream 401/400, or 502 if the api is unreachable.
- **Used by:** `postContact`.
- **Auth:** Bearer.

## Endpoint: GET /messages/[id]/photo

- **Purpose:** Same-origin Bearer proxy of api GET `/messages/:id/photo` (raw JPEG/PNG/WebP bytes for one forum message). Clients fetch with Authorization and render via blob URLs — not bare `<img src>`.
- **Errors:** Upstream 401/404, or 502 if the api is unreachable.
- **Used by:** `fetchMessagePhoto`.
- **Auth:** Bearer.

## Endpoint: GET /messages/[id]/[file]

- **Purpose:** App Router GET that proxies `video.mp4` / `video.webm` / `video.mov` to the 21.gifts api at runtime via `getApiUrl()` (not next.config rewrites). Other `file` values return 404 without proxying. Public; missing files 404 from the api.
- **Errors:** Route 404 for unknown `file`; upstream 404/502 for known video names when missing or unreachable.
- **Used by:** Feed `<video src>` via `forumVideoSrc`.
- **Auth:** None required.

## Endpoint: POST /me/lightning-address

- **Purpose:** Same-origin proxy to link or replace a Wallet of Satoshi address.
- **Errors:** Upstream 400, or 502 if the api is unreachable.
- **Used by:** `setLightningAddress`.
- **Auth:** Bearer.

## Endpoint: DELETE /me/lightning-address

- **Purpose:** Same-origin proxy to unlink a Wallet of Satoshi address.
- **Errors:** Upstream status, or 502 if the api is unreachable.
- **Used by:** `unlinkLightningAddress`.
- **Auth:** Bearer.

## Endpoint: GET /push/vapid-public

- **Purpose:** Same-origin Bearer proxy of api GET `/push/vapid-public` (VAPID application server public key for Web Push subscribe).
- **Errors:** Upstream 401, 503 `{ error: "Push is not configured" }`, or 502 if the api is unreachable.
- **Used by:** `fetchVapidPublicKey` via `enablePush` on `/profile`.
- **Auth:** Bearer.

## Endpoint: POST /me/push-subscriptions

- **Purpose:** Same-origin Bearer proxy of api POST `/me/push-subscriptions` (register a browser push subscription: `{ endpoint, keys: { p256dh, auth } }`).
- **Errors:** Upstream 400 `{ error: "Invalid subscription" }`, 401, 503 `{ error: "Push is not configured" }`, or 502 if the api is unreachable.
- **Used by:** `postPushSubscription` via `enablePush` on `/profile`.
- **Auth:** Bearer.

## Endpoint: DELETE /me/push-subscriptions

- **Purpose:** Same-origin Bearer proxy of api DELETE `/me/push-subscriptions` (remove a browser push subscription by `{ endpoint }`).
- **Errors:** Upstream 400, 401, 404, 503 `{ error: "Push is not configured" }`, or 502 if the api is unreachable.
- **Used by:** `deletePushSubscription` via `disablePush` on `/profile`.
- **Auth:** Bearer.
