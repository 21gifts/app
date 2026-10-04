# HTTP endpoints (Next.js route handlers)

## Endpoint: GET /.well-known/nostr.json

- **Purpose:** Proxies NIP-05 `nostr.json` from the api onto the site apex. CORS `*`.
- **Errors:** Upstream 502/503.
- **Used by:** Damus verification.
- **Auth:** none.

## Endpoint: GET /.well-known/lnurlp/[username]

- **Purpose:** Proxies LUD-16 payRequest from the api onto the site apex so wallets can pay `username@21.gifts`. CORS `*`. Once the member's in-app wallet is verified the api answers with the callback `GET /lnurlp/[username]/invoice`, so payments to that address settle in the member's own in-app wallet.
- **Errors:** Upstream 404/502.
- **Used by:** Lightning wallets.
- **Auth:** none.

## Endpoint: GET /pay/[username]

- **Purpose:** Proxies the public pay-link card (`name`, `username`, `minSats`, `maxSats`, and `charge`, the shop's pending charge or `null`) from the api.
- **Errors:** Upstream 404 when the person cannot be paid, 502 when the payee's wallet cannot be resolved.
- **Used by:** `PayLinkScreen`, `fetchShopChargeInvoice`.
- **Auth:** none.

## Endpoint: POST /pay/[username]/invoice

- **Purpose:** Proxies one exact-amount BOLT11 mint. Body `{ amountSats }`. Response `{ pr, amountSats, sparkInvoice }`. `sparkInvoice` is a Spark invoice for the shop's pending charge when `amountSats` is that charge's amount and the api issues Spark invoices, otherwise `null`.
- **Errors:** Upstream 400 for a bad amount, 404 when the person cannot be paid, 502 when the invoice cannot be created.
- **Used by:** `PayLinkScreen` after **Continue**; `fetchShopChargeInvoice` for the in-app wallet.
- **Auth:** none.

## Endpoint: OPTIONS /.well-known/lnurlp/[username]

- **Purpose:** CORS preflight for LUD-16.
- **Errors:** none.
- **Used by:** Browsers and wallets.
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

## Endpoint: POST /diagnostics

- **Purpose:** Same-origin proxy of api `POST /diagnostics`. Body is an allowlisted client event. The api stores it and returns 204.
- **Errors:** Upstream 400 for a bad body, 429 when the caller is over the limit, 500 when the log cannot be written, or 502 if the api is unreachable.
- **Used by:** `reportDiagnostic`.
- **Auth:** Public. No session.

## Endpoint: POST /auth/passkey/register/begin

- **Purpose:** Same-origin proxy of api `POST /auth/passkey/register/begin`. A new account posts JSON `{ name }`. `{ viewKey }` (64 hex) claims an existing public profile and sends no `name`. The empty body remains the old unnamed path; the new-account path of this app does not use it.
- **Errors:** Upstream status (including 404 / 409 with `{ error }`), or 502 if the api is unreachable.
- **Used by:** `startPasskeyRegistration`.
- **Auth:** Public.

## Endpoint: POST /auth/passkey/register/finish

- **Purpose:** Same-origin proxy of api `POST /auth/passkey/register/finish`.
- **Errors:** Upstream status, or 502 if the api is unreachable.
- **Used by:** `finishPasskeyRegistration`.
- **Auth:** Public.

## Endpoint: POST /auth/passkey/replace/begin

- **Purpose:** Same-origin proxy of api `POST /auth/passkey/replace/begin`.
- **Errors:** Upstream 401/400, or 502 if the api is unreachable.
- **Used by:** `proxyAuthPasskeyReplaceBeginPost`.
- **Auth:** Bearer.

## Endpoint: POST /auth/passkey/replace/finish

- **Purpose:** Same-origin proxy of api `POST /auth/passkey/replace/finish`.
- **Errors:** Upstream 401/400, or 502 if the api is unreachable.
- **Used by:** `proxyAuthPasskeyReplaceFinishPost`.
- **Auth:** Bearer.

## Endpoint: POST /auth/passkey/seed/begin

- **Purpose:** Same-origin proxy of api `POST /auth/passkey/seed/begin`. Bearer session, empty body. Adds a recovery-phrase passkey without replacing the login passkey.
- **Errors:** Upstream 401, 409 `{ error }` when the account already has a seed, other non-2xx, or 502 if the api is unreachable.
- **Used by:** `startPasskeySeed`.
- **Auth:** Bearer.

## Endpoint: POST /auth/passkey/seed/finish

- **Purpose:** Same-origin proxy of api `POST /auth/passkey/seed/finish`. Bearer plus JSON `{ challengeId, credential }`. 200 is the owner account, or that account under one `account` key. `account` only holds when it is the only top-level field; a further field is not an account. `finishPasskeySeed` reads either shape. Includes `passkeyCredentialId` of the new seed passkey. No new token. Not the login call.
- **Errors:** Upstream 401, 409 `{ error }` when the account already has a seed, 400, or 502 if the api is unreachable.
- **Used by:** `finishPasskeySeed`.
- **Auth:** Bearer.

## Endpoint: GET /gifts

- **Purpose:** Same-origin proxy of api `GET /gifts?day=YYYY-MM-DD` (individual outbound gifts that UTC day).
- **Errors:** Upstream 400/503, or 502 if the api is unreachable.
- **Used by:** `fetchGiftDay` on `/stats/[day]`.
- **Auth:** Public.

## Endpoint: GET /messages/stats

- **Purpose:** Same-origin proxy of api `GET /messages/stats` (living notes and replies counted together, by UTC day).
- **Auth:** Public.
- **Inputs:** None.
- **Outputs:** `{ postCount, postsOverTime }` from the api.
- **Errors:** Forwards the upstream status.
- **Used by:** `StatsLoader` on `/stats`.

## Endpoint: GET /gifts/stats

- **Purpose:** Same-origin proxy of api `GET /gifts/stats` (aggregated outbound gift totals; optional `recipient` query forwarded).
- **Errors:** Upstream 503, or 502 if the api is unreachable.
- **Used by:** `fetchGiftStats` on `/stats`, `/welcome`, `/messages/[id]`, `/members/[accountId]`, and the people-count chart on `/statistics` (every visitor, including signed-out, no goal).
- **Auth:** Public.

## Endpoint: GET /habits

- **Purpose:** Same-origin proxy of api `GET /habits` (public habit list, review week, and comments). Forwards `Authorization` when the browser sent it, so the owner can receive internal notes.
- **Errors:** The proxy forwards the upstream status, or 502 if the api is unreachable.
- **Used by:** `fetchMemberHabits` on `/habit-tracker`.
- **Auth:** Public. A bearer is optional and is forwarded, not added.

## Endpoint: POST /habits

- **Purpose:** Same-origin proxy of api `POST /habits` (add, edit, archive, log, comment, delete a comment, or request a Lightning invoice). Forwards `Authorization` and `Time-Zone`. Does not pay the invoice.
- **Errors:** The proxy forwards the upstream status. Expected upstream errors include 401 without a bearer, 400 for a bad body, 403 `{ error: 'SUNDAY_REST' }` when a comment, a comment deletion, or an invoice request falls on the device's local Sunday, 409 when the period is closed or no wallet can be invoiced, or 502 if the api is unreachable. A missing, blank, or invalid time zone does not refuse a comment, a comment deletion, or an invoice request. Add, edit, log, and archive do not rest on Sunday.
- **Used by:** `postMemberHabit` on `/habit-tracker`.
- **Auth:** Bearer. The client sends `Authorization`; this proxy does not add it.

## Endpoint: GET /shops/activity

- **Purpose:** Same-origin proxy of api `GET /shops/activity` (shop-use counts, 30 UTC days).
- **Errors:** The proxy forwards the upstream status. Expected upstream errors are 503 when shop activity is unavailable, or 502 if this proxy cannot reach the api.
- **Used by:** `fetchShopActivity` on `/statistics`.
- **Auth:** No bearer. StatisticsScreen calls it for every visitor.

## Endpoint: GET /funding/goal

- **Purpose:** Same-origin proxy of api `GET /funding/goal` (7 UTC days of shop till-charge counts, plus how many shops had a charge on 5 of those days). Not the public 30-day shop series.
- **Errors:** The proxy forwards the upstream status. Expected upstream errors are 401 without a bearer session and 503 when the goal is unavailable, or 502 if this proxy cannot reach the api.
- **Used by:** `fetchGrantContinuation` on `/grants/goals`.
- **Auth:** Bearer. The client sends `Authorization`; this proxy does not add it.

## Endpoint: POST /me/name

- **Purpose:** Same-origin proxy to set or replace the display name.
- **Errors:** Upstream 400, or 502 if the api is unreachable.
- **Used by:** `setName`.
- **Auth:** Bearer.

## Endpoint: POST /me/username

- **Purpose:** Same-origin proxy to set the unique `@21.gifts` username (LUD-16 / NIP-05 local-part).
- **Errors:** Upstream 400/409, or 502 if the api is unreachable.
- **Used by:** `setUsername`.
- **Auth:** Bearer.

## Endpoint: POST /me/location

- **Purpose:** Same-origin proxy to set, replace, or clear the free-text profile location (`{ location }`; empty string clears).
- **Errors:** Upstream 400 (`Location must be at most 80 characters`), 401, or 502 if the api is unreachable.
- **Used by:** `setLocation` / `LocationForm`.
- **Auth:** Bearer.

## Endpoint: PUT /me/about

- **Purpose:** Same-origin proxy of api `PUT /me/about` (set or replace the signed-in About me note). JSON `{ text, photo? }`: `photo` omitted keeps a stored image, `null` clears it, `{ contentType, data }` sets a JPEG/PNG/WebP like a forum post.
- **Errors:** Upstream 400/401/409, or 502 if the api is unreachable.
- **Used by:** `putAboutMe`.
- **Auth:** Bearer.

## Endpoint: GET /pictures/me

- **Purpose:** Same-origin Bearer proxy of api `GET /pictures/me` (raw bytes of the signed-in profile photo). Not the wide image and not the About me note photo.
- **Errors:** Upstream 401/404, or 502 if the api is unreachable.
- **Used by:** `fetchProfilePhoto`.
- **Auth:** Bearer.

## Endpoint: PUT /pictures/me

- **Purpose:** Same-origin Bearer proxy of api `PUT /pictures/me`. Body `{ photo }` sets the profile photo or `null` clears it. Does not change the wide image or the About me note.
- **Errors:** Upstream 400/401, or 502 if the api is unreachable.
- **Used by:** `putProfilePhoto`.
- **Auth:** Bearer.

## Endpoint: GET /banners/me

- **Purpose:** Same-origin Bearer proxy of api `GET /banners/me` (raw bytes of the signed-in wide profile image). Not the About me photo.
- **Errors:** Upstream 401/404, or 502 if the api is unreachable.
- **Used by:** `fetchWideBanner`.
- **Auth:** Bearer.

## Endpoint: PUT /banners/me

- **Purpose:** Same-origin Bearer proxy of api `PUT /banners/me`. Body `{ photo }` sets a wide image or `null` clears it. Does not change the About me photo.
- **Errors:** Upstream 400/401, or 502 if the api is unreachable.
- **Used by:** `putWideBanner`.
- **Auth:** Bearer.

## Endpoint: GET /me/about/photo

- **Purpose:** Same-origin Bearer proxy of api `GET /me/about/photo` (raw JPEG/PNG/WebP bytes for the signed-in About me note). Always render via blob URLs — not bare `<img src>`.
- **Errors:** Upstream 401/404, or 502 if the api is unreachable.
- **Used by:** `fetchAboutMePhoto`.
- **Auth:** Bearer.

## Endpoint: GET /view-key/[viewKey]/about/photo

- **Purpose:** Same-origin public proxy of api `GET /view/:viewKey/about/photo` (raw JPEG/PNG/WebP bytes for the view-key About me note). Always render via blob URLs — not bare `<img src>`.
- **Errors:** Upstream 404, or 502 if the api is unreachable.
- **Used by:** `fetchViewAboutMePhoto`.
- **Auth:** none.

## Endpoint: POST /me/wallet-backup-seen

- **Purpose:** Same-origin proxy of api `POST /me/wallet-backup-seen`. Records that the recovery phrase was shown.
- **Errors:** Upstream 401, or 502 if the api is unreachable.
- **Used by:** `postWalletBackupSeen`.
- **Auth:** Bearer.

## Endpoint: PUT /me/wallet

- **Purpose:** Same-origin proxy of api `PUT /me/wallet`. Claims the in-app wallet's identity public key for the account. Write-once after the wallet is verified.
- **Errors:** Upstream 400, 401, 404 (feature off), 409 (wallet already verified), or 502 if the api is unreachable.
- **Used by:** `putWallet`.
- **Auth:** Bearer.

## Endpoint: POST /lnurlpay/[pubkey]

- **Purpose:** Same-origin proxy of api `POST /lnurlpay/:pubkey`. The in-app wallet registers the account's username as its address on the app's own host; success marks the wallet verified.
- **Errors:** Upstream 404 (feature off or not the account's own username and key), 409, other 4xx from the address server, 503, or 502 if the api is unreachable.
- **Used by:** The in-app wallet (`registerWalletAddress`).
- **Auth:** Signed by the wallet (`X-Breez-Signature`, `X-Breez-Timestamp` forwarded).

## Endpoint: POST /lnurlpay/[pubkey]/recover

- **Purpose:** Same-origin proxy of api `POST /lnurlpay/:pubkey/recover`. The in-app wallet looks up the address it registered.
- **Errors:** Upstream 404 or 503, or 502 if the api is unreachable.
- **Used by:** The in-app wallet.
- **Auth:** Signed by the wallet.

## Endpoint: GET /lnurlpay/[pubkey]/metadata

- **Purpose:** Same-origin proxy of api `GET /lnurlpay/:pubkey/metadata`. The in-app wallet reads the notes payers left on received payments.
- **Errors:** Upstream 404 or 503, or 502 if the api is unreachable.
- **Used by:** The in-app wallet.
- **Auth:** Signed by the wallet.

## Endpoint: GET /lnurlp/[username]/invoice

- **Purpose:** Same-origin proxy of api `GET /lnurlp/:username/invoice`. A payer's wallet asks for a payment request to a member's verified in-app wallet. CORS `*`.
- **Errors:** Upstream 404 or 503, or 502 if the api is unreachable.
- **Used by:** Payers' wallets, after `GET /.well-known/lnurlp/[username]`.
- **Auth:** none.

## Endpoint: GET /verify/[paymentHash]

- **Purpose:** Same-origin proxy of api `GET /verify/:paymentHash`. A payer's wallet checks whether a payment to a member's in-app wallet settled. CORS `*`.
- **Errors:** Upstream 404 or 503, or 502 if the api is unreachable.
- **Used by:** Payers' wallets.
- **Auth:** none.

## Endpoint: POST /me/passkey-renew/report

- **Purpose:** Same-origin proxy of api `POST /me/passkey-renew/report`. Stores a browser ceremony failure or cancel. The body is the six safe fields plus optional public authenticator facts and browser capability names.
- **Errors:** Upstream 401 or 400, or 502 if the api is unreachable.
- **Used by:** `postPasskeyRenewReport`.
- **Auth:** Bearer.

## Endpoint: POST /me/passkey-renew/ack

- **Purpose:** Same-origin proxy of api `POST /me/passkey-renew/ack`. Acknowledges the failure notice so it is not shown again.
- **Errors:** Upstream 401, or 502 if the api is unreachable.
- **Used by:** `postPasskeyRenewAck`.
- **Auth:** Bearer.

## Endpoint: POST /me/setup/skip

- **Purpose:** Same-origin proxy to skip the name onboarding step (`{ step: 'name' }`). Rules and username cannot be skipped.
- **Errors:** Upstream 400/401, or 502 if the api is unreachable.
- **Used by:** `skipSetup`.
- **Auth:** Bearer.

## Endpoint: GET /forum/members/[accountId]

- **Purpose:** Same-origin proxy of api `GET /members/:accountId` for signed-in member profiles.
- **Errors:** Upstream 401/404/409 `missing_requirements`, or 502 if the api is unreachable.
- **Used by:** `fetchMember` via `MemberProfileLoader`.
- **Auth:** Bearer.

## Endpoint: GET /forum/members/[accountId]/activity

- **Purpose:** Same-origin Bearer proxy of api `GET /members/:accountId/activity` for a member's given and received series.
- **Errors:** Upstream 401/404/409 `missing_requirements`, 503 `{ error: "Gift stats are unavailable" }`, or 502 if the api is unreachable.
- **Used by:** `fetchMemberActivity` via `MemberProfileLoader`.
- **Auth:** Bearer.

## Endpoint: GET /forum/members/[accountId]/posts

- **Purpose:** Same-origin proxy of api `GET /members/:accountId/posts` for a signed-in member's top-level forum posts.
- **Errors:** Upstream 401/404/409 `missing_requirements`, or 502 if the api is unreachable.
- **Used by:** `fetchMemberPosts` via `MemberProfileScreen`.
- **Auth:** Bearer.

## Endpoint: GET /forum/members/[accountId]/replies

- **Purpose:** Same-origin proxy of api `GET /members/:accountId/replies` for a signed-in member's forum replies.
- **Errors:** Upstream 401/404/409 `missing_requirements`, or 502 if the api is unreachable.
- **Used by:** `fetchMemberReplies` via `MemberProfileScreen`.
- **Auth:** Bearer.

## Endpoint: POST /me/forum-laws-dismissed

- **Purpose:** Same-origin proxy to permanently dismiss the welcome-forum living-room laws hint (`forumLawsDismissed: true` on the account).
- **Errors:** Upstream 401, or 502 if the api is unreachable.
- **Used by:** `dismissForumLaws`.
- **Auth:** Bearer.

## Endpoint: POST /me/notification-level

- **Purpose:** Same-origin Bearer proxy of api POST `/me/notification-level`. JSON body `{ level: "all"|"active"|"mentions" }` returns the owner Account.
- **Errors:** Upstream 401, 400 invalid level, or 502 if the api is unreachable.
- **Used by:** `postNotificationLevel`.
- **Auth:** Bearer.

## Endpoint: POST /me/amount-unit

- **Purpose:** Same-origin Bearer proxy of api POST `/me/amount-unit`. JSON body `{ unit: "btc"|"fiat" }` returns the owner Account. The same unit again is still 200.
- **Errors:** Upstream 401, 400 invalid unit, or 502 if the api is unreachable.
- **Used by:** `setAmountUnit`.
- **Auth:** Bearer.

## Endpoint: POST /me/locale

- **Purpose:** Same-origin Bearer proxy of api POST `/me/locale`. JSON body `{ locale, onlyIfUnset }` returns the owner Account. `onlyIfUnset: true` does not overwrite a stored locale.
- **Errors:** 401 when the bearer is missing or blank, before the proxy. Upstream 401, 400 invalid body, or 502 if the api is unreachable.
- **Used by:** `setAccountLocale`.
- **Auth:** Bearer; Owner-Account.

## Endpoint: POST /me/fiat

- **Purpose:** Same-origin Bearer proxy of api POST `/me/fiat`. JSON body `{ fiat, onlyIfUnset }` returns the owner Account. `onlyIfUnset: true` does not overwrite a stored fiat value.
- **Errors:** 401 when the bearer is missing or blank, before the proxy. Upstream 401, 400 invalid body, or 502 if the api is unreachable.
- **Used by:** `setAccountFiat`.
- **Auth:** Bearer; Owner-Account.

## Endpoint: POST /me/rules-agreement

- **Purpose:** Same-origin proxy to record living-room rules agreement on the signed-in account (`rulesAgreedAt`).
- **Errors:** Upstream 401, or 502 if the api is unreachable.
- **Used by:** `agreeToRules`.
- **Auth:** Bearer.

## Endpoint: GET /pos/charge

- **Purpose:** Same-origin proxy of api `GET /pos`. Returns `charge` (the pending charge, or one paid within the last minute, else `null`) and `history` (including paid rows). Each charge has `status` `pending`, `paid`, `cancelled`, or `expired`, and `paidAt` (ISO string or `null`). The till asks it every three seconds while a charge is open and for one minute after it ran out.
- **Errors:** Upstream 401, or 502 if the api is unreachable.
- **Used by:** `fetchPosState` (`PosTill`, `PosAmount`).
- **Auth:** Bearer.

## Endpoint: POST /pos/charge

- **Purpose:** Same-origin proxy of api `POST /pos` with `{ amountSats }`.
- **Errors:** Upstream 400, 401, 409, 502.
- **Used by:** `createPosCharge`.
- **Auth:** Bearer.

## Endpoint: DELETE /pos/charge

- **Purpose:** Same-origin proxy of api `DELETE /pos`. Cancels the open charge.
- **Errors:** Upstream 401, 404, or 502 if the api is unreachable.
- **Used by:** `cancelPosCharge`.
- **Auth:** Bearer.

## Endpoint: GET /me

- **Purpose:** Same-origin proxy of the signed-in account, including optional `funding` (`null` for `basis`).
- **Errors:** Upstream 401, or 502 if the api is unreachable.
- **Used by:** `fetchMe`.
- **Auth:** Bearer.

## Endpoint: GET /me/activity

- **Purpose:** Same-origin Bearer proxy of api `GET /me/activity` for given and received sat totals plus both cumulative day series (house gifts and forum zaps).
- **Errors:** Upstream 401, 503 `{ error: "Gift stats are unavailable" }`, or 502 if the api is unreachable.
- **Used by:** `fetchAccountActivity` via `useAccountTotals` on `/profile`.
- **Auth:** Bearer.

## Endpoint: GET /view-key/[viewKey]

- **Purpose:** Same-origin public proxy of api `GET /view/:viewKey`.
- **Errors:** Upstream 404 `{ error: "Not found" }`, or 502 if the api is unreachable.
- **Used by:** `fetchViewProfile`.
- **Auth:** Public.

## Endpoint: GET /view-key/[viewKey]/activity

- **Purpose:** Same-origin public proxy of api `GET /view/:viewKey/activity` for the public profile given and received series.
- **Errors:** Upstream 404, 503 `{ error: "Gift stats are unavailable" }`, or 502 if the api is unreachable.
- **Used by:** `fetchViewActivity` via `ViewProfileLoader`.
- **Auth:** Public.

## Endpoint: GET /forum/messages

- **Purpose:** Same-origin Bearer proxy of api GET `/messages` (public forum list, newest-first), forwarding optional `mode`, `limit`, and `cursor` query parameters. App path is `/forum/messages` so `/messages/[id]` can serve HTML. The welcome client always sends `limit=20`; the JSON body may include opaque `nextCursor` (omitted at end of feed).
- **Errors:** Upstream 401, or 502 if the api is unreachable.
- **Used by:** `fetchMessages`.
- **Auth:** Bearer.

## Endpoint: GET /forum/messages/places

- **Purpose:** Same-origin Bearer proxy of api GET `/messages/places` (live top-level notes that have a pin).
- **Errors:** Upstream 401, or 502 if the api is unreachable.
- **Used by:** `fetchPlaces`.
- **Auth:** Bearer.

## Endpoint: GET /maps/key

- **Purpose:** Returns `{ key }` for the browser map, or `{ key: null }` when `GOOGLE_MAPS_API_KEY` is unset or blank. An empty value does not fail container boot. The key is not logged.
- **Errors:** None. Always 200.
- **Used by:** `PlaceField`, `PlacesMapScreen`.
- **Auth:** None.

## Endpoint: GET /forum/messages/hidden

- **Purpose:** Same-origin Bearer proxy of api GET `/messages/hidden` (hidden living-room notes for moderators). App path is `/forum/messages/hidden` so HTML `/moderate/hidden` can serve the page.
- **Errors:** Upstream 401/403, or 502 if the api is unreachable.
- **Used by:** `listHiddenMessages` via `HiddenNotesScreen` on `/moderate/hidden`.
- **Auth:** Bearer; moderator role on the api.

## Endpoint: POST /forum/messages

- **Purpose:** Same-origin Bearer proxy of api POST `/messages` (create a public forum message or reply with optional photo, optional place pin, and optional Ask fields). JSON and multipart send `goalCurrency` and `goalAmount`; `goalSats` remains a field of the read note. Optional JSON or multipart `goalCurrency` and `goalAmount` (top-level notes only) are the ask; omitted on replies and when unset. A place pin is likewise top-level only.
- **Errors:** Upstream 401/400/403/429, or 502 if the api is unreachable. 403 is an unpaid-reply rejection (`A reply needs a Bitcoin payment`, or the api error string).
- **Used by:** `postMessage`.
- **Auth:** Bearer.

## Endpoint: GET /forum/messages/[id]/replies

- **Purpose:** Same-origin Bearer proxy of api GET `/messages/:id/replies` (oldest-first replies for one note).
- **Errors:** Upstream 401/404, or 502 if the api is unreachable.
- **Used by:** `fetchReplies`.
- **Auth:** Bearer.

## Endpoint: GET /public-messages/[id]/external-profile

- **Purpose:** Same-origin public proxy of api GET `/messages/:id/external-profile` (name, npub, and optional nip05 and lud16, no Bearer). Optional `postCount` and `replyCount` are nonnegative integers; absent still parses.
- **Errors:** Upstream 404 `{ error: "Not found" }`, upstream 503, or 502 if the api is unreachable.
- **Used by:** `fetchExternalAuthorProfile`.
- **Auth:** Public.

## Endpoint: GET /public-messages/[id]/external-posts

- **Purpose:** Same-origin public proxy of api GET `/messages/:id/external-posts`, body `{ messages }` for that external author, no Bearer.
- **Errors:** Upstream failure, or 502 if the api is unreachable.
- **Used by:** `fetchExternalAuthorPosts`.
- **Auth:** Public.

## Endpoint: GET /public-messages/[id]/external-replies

- **Purpose:** Same-origin public proxy of api GET `/messages/:id/external-replies`, body `{ messages }` for that external author, no Bearer.
- **Errors:** Upstream failure, or 502 if the api is unreachable.
- **Used by:** `fetchExternalAuthorReplies`.
- **Auth:** Public.

## Endpoint: GET /public-messages/[id]

- **Purpose:** Same-origin public proxy of api GET `/messages/:id` (one note as JSON, no Bearer). The HTML public note is `/messages/[id]`.
- **Errors:** Upstream 404 `{ error: "Not found" }`, or 502 if the api is unreachable.
- **Used by:** `fetchPublicMessage`.
- **Auth:** Public.

## Endpoint: GET /public-messages/[id]/replies

- **Purpose:** Same-origin public proxy of api GET `/messages/:id/replies` (oldest-first live replies, no Bearer). The HTML public thread is `/messages/[id]`.
- **Errors:** Upstream 404 `{ error: "Not found" }`, or 502 if the api is unreachable.
- **Used by:** `fetchPublicReplies`.
- **Auth:** Public.

## Endpoint: GET /messages/compose-target

- **Purpose:** Same-origin Bearer proxy of api GET `/messages/compose-target`. Returns `{ messageId, sats }` for the official platform profile note so a basis account can invoice 1 sat to 21.gifts before posting or replying.
- **Errors:** Upstream 401/409/400/503, or 502 if the api is unreachable.
- **Used by:** `fetchComposeTarget`.
- **Auth:** Bearer.

## Endpoint: GET /links/[code]

- **Purpose:** Same-origin public proxy of api GET `/links/:code`. JSON body is `{ "kind": "message" | "member", "id": "<uuid>" }`. No Bearer. The HTML redirect visitors open is `/l/[code]`; this path is JSON only.
- **Errors:** Upstream 400 `{ "error": "invalid_code" }`, 404 `{ "error": "not_found" }`, 409 `{ "error": "ambiguous" }`, or 502 if the api is unreachable.
- **Used by:** `fetchShortLink`.
- **Auth:** Public.

## Endpoint: GET /l/[code]

- **Purpose:** Resolve an 8-hex short code (case-insensitive) and redirect to `/messages/<uuid>` or `/members/<uuid>`. The code is the first UUID group, lowercased. Invalid codes do not call the api. There is no page under `/l/` — unknown codes use the existing not-found page.
- **Errors:** 404 via `notFound()` when the code is not 8 hex, the lookup fails or is not OK, the body is not JSON, or the body is not a message or member UUID. Success is a redirect, not JSON.
- **Used by:** Shared note, reply, and member profile links copied from the forum and member card.
- **Auth:** Public.

## Endpoint: GET /messages/[id]/repayment

- **Purpose:** Same-origin proxy of api GET `/messages/:id/repayment`. Public ledger of givers and each bitcoin repayment.
- **Errors:** Upstream 404/503, or 502 if the api is unreachable.
- **Used by:** `getRepayment`.
- **Auth:** Public.

## Endpoint: POST /messages/[id]/repayment

- **Purpose:** Same-origin Bearer proxy of api POST `/messages/:id/repayment`. The author pays the next giver their share of the next due day. Success `{ pr, amountSats, sparkInvoice? }`; `sparkInvoice` is the request the in-app wallet pays instead of `pr`, or `null`, and may be absent.
- **Errors:** Upstream 401/400/404/409/429/503, or 502 if the api is unreachable.
- **Used by:** `postRepaymentInvoice`.
- **Auth:** Bearer.

## Endpoint: POST /messages/[id]/invoice

- **Purpose:** Same-origin Bearer proxy of api POST `/messages/:id/invoice` (pay a forum note; optional `text` is the zap comment and is omitted when empty). Success `{ pr, amountSats, sparkInvoice? }`; `sparkInvoice` is the request the in-app wallet pays instead of `pr`, or `null`, and may be absent.
- **Errors:** Upstream 401/400/404/409/429/503, or 502 if the api is unreachable. 409 `missing_requirements` is a setup overlay, not a pay-sheet error.
- **Used by:** `postMessageInvoice`.
- **Auth:** Bearer.

## Endpoint: POST /lnurl/pay-request

- **Purpose:** Same-origin Bearer proxy of api POST `/lnurl/pay-request`. Body `{ target }` (`user@domain` or a bech32 LNURL on another host). 200 `{ target, minSendableMsat, maxSendableMsat, commentAllowed, description, domain }`.
- **Errors:** Upstream 400 `Not a payable address` (malformed, not https, not a pay request, or on this app's own host), 404 `Address not found`, 502 `Address could not be reached`, 401 without a session; 502 `Upstream api unreachable` when the api is unreachable.
- **Used by:** `postLnurlPayRequest`.
- **Auth:** Bearer.

## Endpoint: POST /lnurl/invoice

- **Purpose:** Same-origin Bearer proxy of api POST `/lnurl/invoice`. Body `{ target, amountMsat, comment? }`. The api resolves the target again, never takes a callback URL from the client, and checks amount, comment, invoice amount, and description hash. 200 `{ pr }`.
- **Errors:** The errors of `POST /lnurl/pay-request`, plus 400 `Amount out of range` and 400 `Comment too long`.
- **Used by:** `postLnurlInvoice`.
- **Auth:** Bearer.

## Endpoint: POST /contact/submit

- **Purpose:** Same-origin Bearer proxy of api POST `/contact` (create an in-app contact message to 21.gifts). Nested under `/contact/submit` because the UI page already owns `/contact`.
- **Errors:** Upstream 401/400, or 502 if the api is unreachable.
- **Used by:** `postContact`.
- **Auth:** Bearer.

## Endpoint: GET /messages/[id]/photo

- **Purpose:** Same-origin proxy of api GET `/messages/:id/photo` (raw JPEG/PNG/WebP bytes for one forum message). Signed-in clients send Authorization (`fetchMessagePhoto`); the public note page fetches without Bearer (`fetchPublicMessagePhoto`). Always render via blob URLs — not bare `<img src>`.
- **Errors:** Upstream 401/404, or 502 if the api is unreachable.
- **Used by:** `fetchMessagePhoto`, `fetchPublicMessagePhoto`.
- **Auth:** Optional Bearer (api photo is public; forum board still sends Bearer).

## Endpoint: GET /messages/[id]/photo/[file]

- **Purpose:** Same-origin proxy of api extra stills at GET `/messages/:id/photo/{1-9}.jpg`. App Router `file` must match `{1-9}.{jpg|jpeg|png|webp}`; other names 404 without proxying. The proxy always requests `{n}.jpg` from the api (same bytes as `.jpeg`/`.png`/`.webp` aliases).
- **Errors:** Route 404 for unknown `file`; upstream 404/502 when the extra still is missing or unreachable.
- **Used by:** `fetchMessagePhoto` / `fetchPublicMessagePhoto` with index 1–9.
- **Auth:** Optional Bearer.

## Endpoint: GET /messages/[id]/[file]

- **Purpose:** App Router GET that proxies `video.mp4` / `video.webm` / `video.mov` to the 21.gifts api at runtime via `getApiUrl()` (not next.config rewrites). Other `file` values return 404 without proxying. Public; missing files 404 from the api.
- **Errors:** Route 404 for unknown `file`; upstream 404/502 for known video names when missing or unreachable.
- **Used by:** Feed `<video src>` via `forumVideoSrc`.
- **Auth:** None required.

## Endpoint: GET /push/vapid-public

- **Purpose:** Same-origin Bearer proxy of api GET `/push/vapid-public` (VAPID application server public key for Web Push subscribe).
- **Errors:** Upstream 401, 503 `{ error: "Push is not configured" }`, or 502 if the api is unreachable.
- **Used by:** `fetchVapidPublicKey` via `enablePush` on `/profile` and via `enablePush` from the SignedInChrome Notifications click.
- **Auth:** Bearer.

## Endpoint: POST /me/push-subscriptions

- **Purpose:** Same-origin Bearer proxy of api POST `/me/push-subscriptions` (register a browser push subscription: `{ endpoint, keys: { p256dh, auth } }`).
- **Errors:** Upstream 400 `{ error: "Invalid subscription" }`, 401, 503 `{ error: "Push is not configured" }`, or 502 if the api is unreachable.
- **Used by:** `postPushSubscription` via `enablePush` on `/profile`, via `enablePush` from the SignedInChrome Notifications click, and via `resyncPushSubscription` in `SignedInChrome`.
- **Auth:** Bearer.

## Endpoint: GET /conversations

- **Purpose:** Same-origin Bearer proxy of api GET `/conversations` (incoming threads, plus the member's own 21.gifts contact thread when it has a message; empty and outbound-only member/Damus threads are omitted). GET `/conversations` never lists the `moderator_group` thread, even for moderators. Each item has required `kind`: `member_member` | `member_platform` | `member_damus` | `moderator_group`, required `lastFromMe`, required `lastSats`, `unread` (default false), `unreadMessageCount` (default 0, inbound unread messages), optional `accountId` (counterpart), and the envelope includes `unreadCount` (default 0, unread thread count).
- **Errors:** Upstream 401/503, or 502 if the api is unreachable.
- **Used by:** `fetchConversations` on `/messages`, `useUnreadCount`, `NotificationsLoader`, `refreshUnreadAppBadge`.
- **Auth:** Bearer.

## Endpoint: GET /conversations/moderator-group

- **Purpose:** Same-origin Bearer proxy of api GET `/conversations/moderator-group` (singleton closed staff room as `{ conversation }`, same item fields as GET `/conversations` including `unread` and `unreadMessageCount`).
- **Errors:** Upstream 401/403/404, or 502 if the api is unreachable.
- **Used by:** `fetchModeratorGroup` via `ModeratorGroupScreen` on `/moderate/group` and via `InboxLoader` on `/messages` (unlisted `?c=` guard for a moderator).
- **Auth:** Bearer; moderator on the api.

## Endpoint: POST /conversations

- **Purpose:** Same-origin Bearer proxy of api POST `/conversations` with `{ forumMessageId }` to open or return the thread with that note's author. Response is the same conversation list-row shape, including required `kind`, required `lastFromMe`, and optional `accountId` (counterpart).
- **Errors:** Upstream 400 (self), 404 (unknown note), 401/503, or 502 if the api is unreachable.
- **Used by:** `openConversation` from the member-profile Message button.
- **Auth:** Bearer.

## Endpoint: GET /conversations/[id]

- **Purpose:** Same-origin Bearer proxy of api GET `/conversations/:id?limit=&cursor=`. The client always sends `limit=20`; optional `cursor` requests the next older page and optional `sinceMessageId` long-polls. Body `{ messages, nextCursor? }` (oldest-first within the page). Each message has required `fromMe` (true iff this session is the actor) and `sats`, `hasPhoto` / `photoCount` (client defaults omitted fields to false / 0), and optional `accountId` (sender). For a staff viewer, incoming `name` and optional `accountId` are the actor. Members still see platform identity (`21.gifts`) on official replies. Optional query `sinceMessageId` is forwarded for gift pay-sheet polling.
- **Errors:** Upstream 401/404/503, or 502 if the api is unreachable.
- **Used by:** `fetchConversation` on `/messages?c=` and on `/moderate/group`.
- **Auth:** Bearer.

## Endpoint: POST /conversations/[id]

- **Purpose:** Same-origin Bearer proxy of api POST `/conversations/:id` with `{ text }` (1–8000 characters) and optional `{ photo, photos }` (JPEG/PNG/WebP, at most 10). Empty text is allowed when at least one photo is present (Moderators group and `/messages` Direct/Contact/Damus). Staff replies on official threads still send as the platform account on the api, but JSON `fromMe`, `name`, and `accountId` follow the actor. The created message has required `fromMe`, `hasPhoto`, `photoCount`, and optional `accountId` (sender).
- **Errors:** Upstream 400/401/404/503, or 502 if the api is unreachable.
- **Used by:** `postConversationMessage` in the inbox composer and in `ModeratorGroupScreen`.
- **Auth:** Bearer.

## Endpoint: GET /conversations/[id]/messages/[messageId]/photo

- **Purpose:** Same-origin Bearer proxy of api GET `/conversations/:id/messages/:messageId/photo` (still 0). Conversation stills (inbox Direct/Contact/Damus and the staff room) are private; 401 without a session.
- **Errors:** Upstream 401/404/503, or 502 if the api is unreachable.
- **Used by:** `fetchConversationMessagePhoto` from `InboxLoader` and `ModeratorGroupScreen`.
- **Auth:** Bearer.

## Endpoint: GET /conversations/[id]/messages/[messageId]/photo/[file]

- **Purpose:** Same-origin Bearer proxy of api GET `/conversations/:id/messages/:messageId/photo/:file`. Filename must match `{1-9}.{jpg|jpeg|png|webp}`; otherwise 404 without calling the api. The proxy always requests `{n}.jpg` from the api.
- **Errors:** 404 for an unsupported filename; upstream 401/404/503, or 502 if the api is unreachable.
- **Used by:** `fetchConversationMessagePhoto` for indices 1–9 from `InboxLoader` and `ModeratorGroupScreen`.
- **Auth:** Bearer.

## Endpoint: POST /conversations/[id]/invoice

- **Purpose:** Same-origin Bearer proxy of api POST `/conversations/:id/invoice` with `{ sats, text? }`. Success `{ pr, amountSats, messageId, sparkInvoice? }` for the inbox pay sheet; `sparkInvoice` is the request the in-app wallet pays instead of `pr`, or `null`, and may be absent.
- **Errors:** Upstream 400/401/404/429/503, or 502 if the api is unreachable.
- **Used by:** `postConversationInvoice` in the inbox composer.
- **Auth:** Bearer.

## Endpoint: POST /conversations/[id]/read

- **Purpose:** Same-origin Bearer proxy of api POST `/conversations/:id/read` (mark one conversation read).
- **Errors:** Upstream 401/404/503, or 502 if the api is unreachable.
- **Used by:** `markConversationRead` from `InboxLoader` after a successful thread fetch.
- **Auth:** Bearer.

## Endpoint: GET /forum/mentions

- **Purpose:** Same-origin Bearer proxy of api GET `/mentions`. Optional `q` is the username prefix. An empty query is the first page of handles. The forum composer uses it while `@` is being typed. The Person field on `/grants/payments/amounts` uses the same search and opens that first page when the field is exactly `@`.
- **Errors:** Upstream 401/400/409, or 502 if the api is unreachable.
- **Used by:** `searchMentionAccounts` from `MentionTextarea` on the post, reply, ask-for-money, shop, inbox, and moderator-room composers, from `ShopAccountControl`, and from `DailyPaymentAmountsScreen` for the Person field on `/grants/payments/amounts`.
- **Auth:** Bearer.

## Endpoint: GET /forum/notifications

- **Purpose:** Same-origin Bearer proxy of api GET `/notifications` (posts, replies, payments, moderator appointment, and moderator proposal for the session). App path is `/forum/notifications` so HTML `/notifications` can serve the page.
- **Errors:** Upstream 401/503, or 502 if the api is unreachable.
- **Used by:** `fetchNotifications` via `NotificationsLoader` on `/notifications`, via `useUnreadCount` in `SignedInChrome`, via `ForumLoader` on `/welcome`, and via `refreshUnreadAppBadge` (from `InboxLoader` after mark-read).
- **Auth:** Bearer.

## Endpoint: POST /forum/notifications/read-all

- **Purpose:** Same-origin Bearer proxy of api POST `/notifications/read-all` (mark every notification read). Optional JSON `{ endpoint }` when this browser has a push subscription; endpoint only when the current push endpoint is a non-empty string.
- **Errors:** Upstream 401/503, or 502 if the api is unreachable.
- **Used by:** `markAllNotificationsRead` from `NotificationsLoader`.
- **Auth:** Bearer.

## Endpoint: POST /forum/notifications/read-by-message

- **Purpose:** Same-origin Bearer proxy of api POST `/notifications/read-by-message` (mark notifications for one forum message read). JSON `{ messageId, endpoint? }`; endpoint only when the current push endpoint is a non-empty string.
- **Errors:** Upstream 401/503, or 502 if the api is unreachable.
- **Used by:** `markNotificationsReadForMessage` from `ForumLoader` (note becomes expanded), `NoteTranslate` (Translate requested with a session), `PublicMessageLoader` (signed-in message page ready), `MemberProfileScreen` (profile note becomes expanded), and `PublicMessageThread` (thread note becomes expanded).
- **Auth:** Bearer.

## Endpoint: POST /forum/notifications/read-visible

- **Purpose:** Same-origin Bearer proxy of api POST `/notifications/read-visible`, which stamps only `forum_post`, `forum_reply`, and `forum_mention` whose reply id is that message. JSON `{ messageId, endpoint? }`; endpoint only when the current push endpoint is a non-empty string.
- **Errors:** Upstream 401/503, or 502 if the api is unreachable.
- **Used by:** `markVisibleForumNoteRead` from `ForumLoader` when the note card is fully inside the scrollport.
- **Auth:** Bearer.

## Endpoint: POST /forum/notifications/[id]/read

- **Purpose:** Same-origin Bearer proxy of api POST `/notifications/:id/read` (mark one notification read). Optional JSON `{ endpoint }` when this browser has a push subscription; endpoint only when the current push endpoint is a non-empty string.
- **Errors:** Upstream 401/404/503, or 502 if the api is unreachable.
- **Used by:** `markNotificationRead` from `NotificationsLoader` on row click and from `ForumLoader` on the welcome appointment pill.
- **Auth:** Bearer.

## Endpoint: DELETE /me/push-subscriptions

- **Purpose:** Same-origin Bearer proxy of api DELETE `/me/push-subscriptions` (remove a browser push subscription by `{ endpoint }`).
- **Errors:** Upstream 400, 401, 404, 503 `{ error: "Push is not configured" }`, or 502 if the api is unreachable.
- **Used by:** `deletePushSubscription` via `disablePush` on `/profile`.
- **Auth:** Bearer.

## Endpoint: GET /trust/graph

- **Purpose:** Same-origin Bearer proxy of api `GET /trust-chain` (nodes and stored edges). Lives at `/trust/graph` so it does not collide with the signed-in HTML page `/trust-chain`.
- **Errors:** Upstream 401, 403, 503, or 502 if the api is unreachable.
- **Used by:** `fetchTrustChain` on signed-in `/trust-chain` (forwards `?around=`).
- **Auth:** Bearer.

## Endpoint: GET /trust/proposals

- **Purpose:** Same-origin Bearer proxy of api `GET /trust/proposals` (open moderator proposals for moderators). Lives under `/trust/proposals` because Next.js forbids a `route.ts` beside the HTML page at `/moderate/proposals`.
- **Errors:** Upstream 401 without a Bearer session, 403 when the account is not a moderator, 503 when the api is unavailable, or 502 JSON if this proxy cannot reach the api origin.
- **Used by:** `fetchTrustProposals` via `ProposalsScreen` on `/moderate/proposals` and via `useUnreadCount` (signed-in Menu and `ModerateScreen` Open-proposals count). Confirm uses existing `POST /trust/confirm-moderator` (`postTrustConfirm`), not appoint.
- **Auth:** Bearer session; the api requires a moderator. The app does not fetch this list for other signed-in roles (forbidden copy, no request).

## Endpoint: POST /trust/verify

- **Purpose:** Same-origin Bearer proxy of api `POST /trust/verify` with `{ accountId, confirmedName }`. The proxy forwards the JSON body unchanged.
- **Errors:** Upstream 400/401/403/404/409/503, or 502 if the api is unreachable.
- **Used by:** `postTrustVerify` in `MemberVerifyScreen`.
- **Auth:** Bearer (moderator).

## Endpoint: POST /trust/propose-moderator

- **Purpose:** Same-origin Bearer proxy of api `POST /trust/propose-moderator` with `{ accountId }`.
- **Errors:** Upstream 400/401/403/404/409/503, or 502 if the api is unreachable.
- **Used by:** `postTrustPropose` in `MemberTrustActions`.
- **Auth:** Bearer (moderator).

## Endpoint: POST /trust/confirm-moderator

- **Purpose:** Same-origin Bearer proxy of api `POST /trust/confirm-moderator` with `{ accountId }`.
- **Errors:** Upstream 400/401/403/404/409/503, or 502 if the api is unreachable.
- **Used by:** `postTrustConfirm` in `MemberTrustActions` and `ProposalsScreen`.
- **Auth:** Bearer (moderator, not the proposer).

## Endpoint: POST /trust/reject-moderator

- **Purpose:** Same-origin Bearer proxy of api `POST /trust/reject-moderator` with `{ accountId }`.
- **Errors:** Upstream 400/401/403/404/409/503, or 502 if the api is unreachable.
- **Used by:** `postTrustReject` in `ProposalsScreen`.
- **Auth:** Bearer (moderator; the original proposer may reject).

## Endpoint: POST /trust/appoint-moderator

- **Purpose:** Same-origin Bearer proxy of api `POST /trust/appoint-moderator` with `{ accountId }`.
- **Errors:** Upstream 400/401/403/404/409/503, or 502 if the api is unreachable.
- **Used by:** `postTrustAppoint` in `MemberTrustActions`.
- **Auth:** Bearer (founder).

## Endpoint: POST /funding/apply

- **Purpose:** Same-origin Bearer proxy of api `POST /funding/apply`. While applications are paused the api returns 403 `{ error: 'Applications are paused' }` for a caller whose username is not `joey-rosima`, `vincent`, or `jewel-bacolbas`. Role `basis` is 403 Forbidden, including those three usernames, and does not write a grant. The paused screen does not call this route. The apply walk calls it when `grantApplicationsPaused` is false, and, while paused, only for a verified account named one of those three with status `none` or `rejected`.
- **Errors:** While applications are paused for everyone else: upstream 401/403, or 502 if the api is unreachable. When the apply walk is open: also upstream 400, 409, and 503, matching `postFundingApply`.
- **Used by:** `postFundingApply`. `FundingApplyScreen` calls it when the apply walk is open: a verified account with status `none` or `rejected`, and while paused only when that account is named `joey-rosima`, `vincent`, or `jewel-bacolbas`. A basis account does not call it.
- **Auth:** Bearer session; the api requires a role other than `basis`.

## Endpoint: GET /funding/payout-days

- **Purpose:** Same-origin Bearer proxy of api `GET /funding/payout-days` (seven-day grant payout matrix for moderators). Lives under `/funding/payout-days` because Next.js forbids a `route.ts` beside the HTML page at `/moderate/payouts`.
- **Errors:** Upstream 401 without a Bearer session, 403 when the account is not founder or moderator, 503 when the api is unavailable, or 502 JSON if this proxy cannot reach the api origin.
- **Used by:** `fetchFundingPayoutDays` via `FundingPayoutsScreen` on `/moderate/payouts`.
- **Auth:** Bearer session; the api requires founder or moderator. The app does not fetch this list for other signed-in roles (forbidden copy, no request).

## Endpoint: GET /funding/applications

- **Purpose:** Same-origin Bearer proxy of api `GET /funding/applications` (open grant applications for moderators). Lives under `/funding/applications` because Next.js forbids a `route.ts` beside the HTML page at `/grants/applications` (`/moderate/applications` redirects there).
- **Errors:** Upstream 401 without a Bearer session, 403 when the account is not founder or moderator, 503 when the api is unavailable, or 502 JSON if this proxy cannot reach the api origin.
- **Used by:** `fetchFundingApplications` via `FundingApplicationsScreen` on `/grants/applications`. `ModerateScreen` on `/moderate` does not call this GET.
- **Auth:** Bearer session; the api requires founder or moderator. The app does not fetch this list for other signed-in roles (forbidden copy, no request).

## Endpoint: GET /funding/daily-roster

- **Purpose:** Same-origin Bearer proxy of api `GET /funding/daily-roster` (daily payout comment, payments switch, `defaultAmountUsd`, and recipient rows). Lives under `/funding/daily-roster` because Next.js forbids a `route.ts` beside the HTML pages at `/grants/payments/comment` and `/grants/payments/amounts`.
- **Errors:** Upstream 401 without a Bearer session, 403 when the account is not an initiator or founder, 503 when the api is unavailable, or 502 JSON if this proxy cannot reach the api origin.
- **Used by:** `fetchDailyRoster` via `DailyPaymentCommentScreen` on `/grants/payments/comment` and `DailyPaymentAmountsScreen` on `/grants/payments/amounts`.
- **Auth:** Bearer session. The api allows an initiator or founder only. The app does not fetch this roster for other signed-in roles (forbidden copy, no request).

## Endpoint: POST /funding/daily-roster/comment

- **Purpose:** Same-origin Bearer proxy of api `POST /funding/daily-roster/comment` with `{ comment }`.
- **Errors:** Upstream 400 `Invalid comment`, 401, 403, 503, or 502 if the api is unreachable.
- **Used by:** `saveDailyRosterComment` in `DailyPaymentCommentScreen`.
- **Auth:** Bearer session. The api allows an initiator or founder only.

## Endpoint: POST /funding/daily-roster/payments

- **Purpose:** Same-origin Bearer proxy of api `POST /funding/daily-roster/payments` with `{ enabled }` (boolean). Sets the daily payments switch only.
- **Errors:** Upstream 400 `Invalid payments switch`, 401, 403, 503, or 502 if the api is unreachable.
- **Used by:** `saveDailyRosterPayments` in `DailyPaymentAmountsScreen`.
- **Auth:** Bearer session. The api allows an initiator or founder only.

## Endpoint: POST /funding/daily-roster/recipients

- **Purpose:** Same-origin Bearer proxy of api `POST /funding/daily-roster/recipients` with `{ accountId, amountUsd }`. Appends one daily recipient for that person.
- **Errors:** Upstream 400 `Invalid person or amount`, `Unknown person`, `Person has no Lightning address`, or `Address already listed`, 401, 403, 503, or 502 if the api is unreachable.
- **Used by:** `addDailyRosterRecipient` in `DailyPaymentAmountsScreen`.
- **Auth:** Bearer session. The api allows an initiator or founder only.

## Endpoint: POST /funding/daily-roster/recipients/update

- **Purpose:** Same-origin Bearer proxy of api `POST /funding/daily-roster/recipients/update` with `{ address, amountUsd }`. Changes one daily amount.
- **Errors:** Upstream 400 `Unknown address` or `Invalid address or amount`, 401, 403, 503, or 502 if the api is unreachable.
- **Used by:** `updateDailyRosterRecipient` in `DailyPaymentAmountsScreen`.
- **Auth:** Bearer session. The api allows an initiator or founder only.

## Endpoint: POST /funding/daily-roster/recipients/delete

- **Purpose:** Same-origin Bearer proxy of api `POST /funding/daily-roster/recipients/delete` with `{ address }`. Removes one daily recipient.
- **Errors:** Upstream 400 `Unknown address`, 401, 403, 503, or 502 if the api is unreachable.
- **Used by:** `deleteDailyRosterRecipient` in `DailyPaymentAmountsScreen`.
- **Auth:** Bearer session. The api allows an initiator or founder only.

## Endpoint: GET /funding/applications/[accountId]

- **Purpose:** Same-origin Bearer proxy of api `GET /funding/applications/:accountId` (staff review payload: account, grant, living-room posts).
- **Errors:** Upstream 401/403/404/503, or 502 if the api is unreachable.
- **Used by:** `fetchFundingApplication` via `FundingApplicationDetailScreen` on `/grants/applications/[accountId]`.
- **Auth:** Bearer session; the api requires founder or moderator.

## Endpoint: POST /funding/trial

- **Purpose:** Same-origin Bearer proxy of api `POST /funding/trial` with `{ accountId }`. Target must be effective pending.
- **Errors:** Upstream 400/401/403/404/409/503, or 502 if the api is unreachable.
- **Used by:** `proxyFundingTrialPost` (API still exposes trial; the staff UI no longer calls it).
- **Auth:** Bearer (founder or moderator).

## Endpoint: POST /funding/admit

- **Purpose:** Same-origin Bearer proxy of api `POST /funding/admit` with `{ accountId }`. Target pending or trial.
- **Errors:** Upstream 400/401/403/404/409/503, or 502 if the api is unreachable.
- **Used by:** `postFundingAdmit` in `FundingApplicationDetailScreen`.
- **Auth:** Bearer (founder or moderator).

## Endpoint: POST /funding/reject

- **Purpose:** Same-origin Bearer proxy of api `POST /funding/reject` with `{ accountId }`. The subject may re-apply.
- **Errors:** Upstream 400/401/403/404/409/503, or 502 if the api is unreachable.
- **Used by:** `postFundingReject` in `FundingApplicationDetailScreen`.
- **Auth:** Bearer (founder or moderator).

## Endpoint: GET /forum/messages/[id]

- **Purpose:** Same-origin Bearer proxy of api GET `/messages/:id`. App path is `/forum/messages/[id]` so HTML `/messages/[id]` can stay the page. Staff (founder/moderator) receive a soft-hidden row with `deletedAt` / `deletedBy`; unsigned/non-staff hidden ids stay 404.
- **Errors:** Upstream 401/403/404, or 502 if the api is unreachable.
- **Used by:** `fetchForumMessage` via `PublicMessageLoader` on `/messages/[id]`.
- **Auth:** Bearer; staff hide-stamps only when the api role is founder or moderator.

## Endpoint: DELETE /forum/messages/[id]

- **Purpose:** Same-origin moderation proxy to DELETE /messages/:id.
- **Auth:** Forwards Bearer authorization; the API requires live moderator role.
- **Returns:** Upstream 204, 401, 403, 404 or 503; proxy failures return 502.
- **Side effects:** Deletes the post, direct replies and stored media on 21.gifts. Does not refund gifts or erase external Nostr relay copies.

## Endpoint: PATCH /forum/messages/[id]/place

- **Purpose:** Same-origin moderation proxy to PATCH /messages/:id/place with JSON `{ place }` (a pin, or `null` to clear).
- **Auth:** Forwards Bearer authorization; the API requires live moderator role.
- **Returns:** Upstream 200 public message JSON, with `place` omitted when cleared.
- **Errors:** 401/403/404/400/503 with `{ "error": string }`; unreachable api is 502.

## Endpoint: PATCH /forum/messages/[id]/photos

- **Purpose:** Same-origin moderation proxy to PATCH /messages/:id/photos with JSON `{ photos }`. An empty list clears stills. A video on the note stays, and this write does not add an edit-history row.
- **Auth:** Forwards Bearer authorization; the API requires live moderator role.
- **Returns:** Upstream 200 public message JSON.
- **Errors:** 401/403/404/400/503 with `{ "error": string }`; unreachable api is 502. Sunday in the device zone is refused by the API.

## Endpoint: PATCH /forum/messages/[id]/text

- **Purpose:** Same-origin moderation proxy to PATCH /messages/:id/text with JSON `{ text }`. The API keeps `#21GiftsShop` on the stored body and records the change.
- **Auth:** Forwards Bearer authorization; the API requires live moderator role.
- **Returns:** Upstream 200 public message JSON.
- **Errors:** 401/403/404/400/503 with `{ "error": string }`; unreachable api is 502. Sunday in the device zone is refused by the API.

## Endpoint: GET /forum/messages/[id]/edits

- **Purpose:** Same-origin moderation proxy to GET /messages/:id/edits. Returns who changed the shop note text, place, or account, and when.
- **Auth:** Forwards Bearer authorization; the API requires live moderator role.
- **Returns:** Upstream 200 `{ edits }` newest first. An empty list is `{ edits: [] }`.
- **Errors:** 401/403/404/503 with `{ "error": string }`; unreachable api is 502. This read is not a Sunday write.

## Endpoint: PATCH /forum/messages/[id]/shop-account

- **Purpose:** Same-origin moderation proxy to PATCH /messages/:id/shop-account with JSON `{ username }` (a handle, or `null` to clear).
- **Auth:** Forwards Bearer authorization; the API requires live moderator role.
- **Returns:** Upstream 200 public message JSON, with `shopAccount` omitted when cleared; otherwise `{ id, username, name }`.
- **Errors:** 404 `{ "error": "No account with that username" }` when the handle is unknown; other failures match the place patch (401/403/400/503, or 502 when unreachable).

## Endpoint: GET /translate

- **Purpose:** Same-origin proxy of api `GET /translate`. `{ available: boolean }` is true when the api has `TRANSLATE_URL` and `TRANSLATE_API_KEY`. Always 200 from the api.
- **Errors:** 502 when the api is unreachable.
- **Used by:** `fetchTranslateAvailable` in `NoteTranslate`.
- **Auth:** Public.

## Endpoint: POST /translate

- **Purpose:** Same-origin proxy of api `POST /messages/:id/translate`. Body `{ messageId, target }`. The api looks up `message_translation` before DeepL and returns `{ translatedText, cached }`.
- **Errors:** 400 invalid body, 404 unknown/hidden note, 503 not configured, 502 upstream.
- **Used by:** `translateNote` from `NoteTranslate`.
- **Auth:** Public for a live note (Bearer forwarded for a hidden staff permalink).

## Endpoint: POST /conversations/[id]/messages/[messageId]/translate

- **Purpose:** Same-origin proxy of api `POST /conversations/:id/messages/:messageId/translate`. Body `{ target }`. The api translates the stored conversation message and returns `{ translatedText, cached }`.
- **Errors:** 400 invalid body, 401 without a session, 404 when the thread or message is missing, 503 not configured, 502 upstream.
- **Used by:** `translateConversationMessage` from `NoteTranslate` on inbox and moderator-room prose.
- **Auth:** Forwards Bearer authorization. The api requires a participant session.
