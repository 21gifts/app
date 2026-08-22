# HTTP endpoints (Next.js route handlers)

## Endpoint: GET /healthz

- **Purpose:** Liveness JSON `{ status: 'ok' }` from `src/app/healthz/route.ts`.
- **Errors:** None if the process is up (always 200).
- **Used by:** Container probes and Playwright smoke.
- **Auth:** Public.

## Endpoint: GET /auth/lnurl

- **Purpose:** Same-origin proxy of api `GET /auth/lnurl` (issue LNURL-auth challenge).
- **Errors:** Upstream status, or 502 if the api is unreachable.
- **Used by:** `startLnurlAuth` in the browser.
- **Auth:** Public.

## Endpoint: GET /auth/lnurl/callback

- **Purpose:** Same-origin proxy of the wallet-facing LUD-04 callback: forwards query string to the upstream api. The wallet `linkingKey` domain is whatever host the encoded callback uses (set on the api as `PUBLIC_BASE_URL`).
- **Errors:** Upstream LUD-04 JSON, or 502 if the api is unreachable.
- **Used by:** Lightning wallets after scanning the login QR.
- **Auth:** Public (wallet signature in query).

## Endpoint: GET /auth/session

- **Purpose:** Same-origin proxy of api session poll.
- **Errors:** Upstream status, or 502 if the api is unreachable.
- **Used by:** `pollSession`.
- **Auth:** `X-Poll-Token`.

## Endpoint: GET /lightning-address

- **Purpose:** Same-origin proxy of public LUD-16 resolve.
- **Errors:** Upstream 400/502, or 502 if the api is unreachable.
- **Used by:** `resolveLightningAddress` on `/donate`.
- **Auth:** Public.

## Endpoint: GET /me

- **Purpose:** Same-origin proxy of the signed-in account.
- **Errors:** Upstream 401, or 502 if the api is unreachable.
- **Used by:** `fetchMe`.
- **Auth:** Bearer.

## Endpoint: POST /me/lightning-address

- **Purpose:** Same-origin proxy to link or replace a Lightning Address.
- **Errors:** Upstream 400, or 502 if the api is unreachable.
- **Used by:** `setLightningAddress`.
- **Auth:** Bearer.

## Endpoint: DELETE /me/lightning-address

- **Purpose:** Same-origin proxy to unlink a Lightning Address.
- **Errors:** Upstream status, or 502 if the api is unreachable.
- **Used by:** `unlinkLightningAddress`.
- **Auth:** Bearer.

## Endpoint: POST /me/lightning-address/verification

- **Purpose:** Same-origin proxy to start address proof-of-control.
- **Errors:** Upstream 400/409/502/503, or 502 if the api is unreachable.
- **Used by:** `startLightningAddressVerification`.
- **Auth:** Bearer.

## Endpoint: POST /me/lightning-address/verification/confirm

- **Purpose:** Same-origin proxy to confirm the verification nonce.
- **Errors:** Upstream 400/409/502/503, or 502 if the api is unreachable.
- **Used by:** `confirmLightningAddressVerification`.
- **Auth:** Bearer.
