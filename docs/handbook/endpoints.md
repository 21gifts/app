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
- **Used by:** `fetchGiftStats` on `/stats`, `/welcome`, `/messages/[id]`, and `/members/[accountId]`.
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

## Endpoint: POST /me/location

- **Purpose:** Same-origin proxy to set, replace, or clear the free-text profile location (`{ location }`; empty string clears).
- **Errors:** Upstream 400 (`Location must be at most 80 characters`), 401, or 502 if the api is unreachable.
- **Used by:** `setLocation` / `LocationForm`.
- **Auth:** Bearer.

## Endpoint: PUT /me/about

- **Purpose:** Same-origin proxy of api `PUT /me/about` (set or replace the signed-in About me note).
- **Errors:** Upstream 400/401/409, or 502 if the api is unreachable.
- **Used by:** `putAboutMe`.
- **Auth:** Bearer.

## Endpoint: POST /me/setup/skip

- **Purpose:** Same-origin proxy to skip the name or Lightning Address onboarding step (`{ step }`).
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

## Endpoint: GET /me/activity

- **Purpose:** Same-origin Bearer proxy of api `GET /me/activity` for given and received sat totals plus both cumulative day series (house gifts and forum zaps).
- **Errors:** Upstream 401, 503 `{ error: "Gift stats are unavailable" }`, or 502 if the api is unreachable.
- **Used by:** `fetchAccountActivity` via `useAccountTotals` on `/profile` and the signed-in menu.
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

- **Purpose:** Same-origin Bearer proxy of api GET `/messages` (public forum list, newest-first). App path is `/forum/messages` so `/messages/[id]` can serve HTML.
- **Errors:** Upstream 401, or 502 if the api is unreachable.
- **Used by:** `fetchMessages`.
- **Auth:** Bearer.

## Endpoint: GET /forum/messages/hidden

- **Purpose:** Same-origin Bearer proxy of api GET `/messages/hidden` (hidden living-room notes for founders and moderators). App path is `/forum/messages/hidden` so HTML `/moderate` can serve the page.
- **Errors:** Upstream 401/403, or 502 if the api is unreachable.
- **Used by:** `listHiddenMessages` via `ModerateScreen` on `/moderate`.
- **Auth:** Bearer; staff role (founder|moderator) on the api.

## Endpoint: POST /forum/messages

- **Purpose:** Same-origin Bearer proxy of api POST `/messages` (create a public forum message or reply with optional photo).
- **Errors:** Upstream 401/400/403/429, or 502 if the api is unreachable. 403 is an unpaid-reply rejection (`A reply needs a Bitcoin payment`, or the api error string).
- **Used by:** `postMessage`.
- **Auth:** Bearer.

## Endpoint: GET /forum/messages/[id]/replies

- **Purpose:** Same-origin Bearer proxy of api GET `/messages/:id/replies` (oldest-first replies for one note).
- **Errors:** Upstream 401/404, or 502 if the api is unreachable.
- **Used by:** `fetchReplies`.
- **Auth:** Bearer.

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

## Endpoint: POST /messages/[id]/invoice

- **Purpose:** Same-origin Bearer proxy of api POST `/messages/:id/invoice` (pay a forum note; optional `text` is the zap comment and is omitted when empty).
- **Errors:** Upstream 401/400/404/409/429/503, or 502 if the api is unreachable. 409 `missing_requirements` is a setup overlay, not a pay-sheet error.
- **Used by:** `postMessageInvoice`.
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
- **Used by:** `fetchVapidPublicKey` via `enablePush` on `/profile` and via `enablePush` from the SignedInChrome Notifications click.
- **Auth:** Bearer.

## Endpoint: POST /me/push-subscriptions

- **Purpose:** Same-origin Bearer proxy of api POST `/me/push-subscriptions` (register a browser push subscription: `{ endpoint, keys: { p256dh, auth } }`).
- **Errors:** Upstream 400 `{ error: "Invalid subscription" }`, 401, 503 `{ error: "Push is not configured" }`, or 502 if the api is unreachable.
- **Used by:** `postPushSubscription` via `enablePush` on `/profile`, via `enablePush` from the SignedInChrome Notifications click, and via `resyncPushSubscription` in `SignedInChrome`.
- **Auth:** Bearer.

## Endpoint: GET /conversations

- **Purpose:** Same-origin Bearer proxy of api GET `/conversations` (incoming threads, plus the member's own 21.gifts contact thread when it has a message; empty and outbound-only member/Damus threads are omitted). Each item has required `kind`: `member_member` | `member_platform` | `member_damus`, required `lastFromMe`, and optional `accountId` (counterpart).
- **Errors:** Upstream 401/503, or 502 if the api is unreachable.
- **Used by:** `fetchConversations` on `/messages`.
- **Auth:** Bearer.

## Endpoint: POST /conversations

- **Purpose:** Same-origin Bearer proxy of api POST `/conversations` with `{ forumMessageId }` to open or return the thread with that note's author. Response is the same conversation list-row shape, including required `kind`, required `lastFromMe`, and optional `accountId` (counterpart).
- **Errors:** Upstream 400 (self), 404 (unknown note), 401/503, or 502 if the api is unreachable.
- **Used by:** `openConversation` from the forum PM control.
- **Auth:** Bearer.

## Endpoint: GET /conversations/[id]

- **Purpose:** Same-origin Bearer proxy of api GET `/conversations/:id` (oldest-first messages). Each message has required `fromMe` and optional `accountId` (sender).
- **Errors:** Upstream 401/404/503, or 502 if the api is unreachable.
- **Used by:** `fetchConversation` on `/messages?c=`.
- **Auth:** Bearer.

## Endpoint: POST /conversations/[id]

- **Purpose:** Same-origin Bearer proxy of api POST `/conversations/:id` with `{ text }` (1–500 characters). Staff replies on official threads send as the platform account. The created message has required `fromMe` and optional `accountId` (sender).
- **Errors:** Upstream 400/401/404/503, or 502 if the api is unreachable.
- **Used by:** `postConversationMessage` in the inbox composer.
- **Auth:** Bearer.

## Endpoint: GET /forum/notifications

- **Purpose:** Same-origin Bearer proxy of api GET `/notifications` (posts, replies, and payments for the session). App path is `/forum/notifications` so HTML `/notifications` can serve the page.
- **Errors:** Upstream 401/503, or 502 if the api is unreachable.
- **Used by:** `fetchNotifications` via `NotificationsLoader` on `/notifications` and via `useUnreadCount` in `SignedInChrome`.
- **Auth:** Bearer.

## Endpoint: POST /forum/notifications/read-all

- **Purpose:** Same-origin Bearer proxy of api POST `/notifications/read-all` (mark every notification read).
- **Errors:** Upstream 401/503, or 502 if the api is unreachable.
- **Used by:** `markAllNotificationsRead` from `NotificationsLoader`.
- **Auth:** Bearer.

## Endpoint: POST /forum/notifications/[id]/read

- **Purpose:** Same-origin Bearer proxy of api POST `/notifications/:id/read` (mark one notification read).
- **Errors:** Upstream 401/404/503, or 502 if the api is unreachable.
- **Used by:** `markNotificationRead` from `NotificationsLoader` on row click.
- **Auth:** Bearer.

## Endpoint: DELETE /me/push-subscriptions

- **Purpose:** Same-origin Bearer proxy of api DELETE `/me/push-subscriptions` (remove a browser push subscription by `{ endpoint }`).
- **Errors:** Upstream 400, 401, 404, 503 `{ error: "Push is not configured" }`, or 502 if the api is unreachable.
- **Used by:** `deletePushSubscription` via `disablePush` on `/profile`.
- **Auth:** Bearer.

## Endpoint: GET /trust/graph

- **Purpose:** Same-origin proxy of api `GET /trust-chain` (public nodes and stored edges). Lives at `/trust/graph` so it does not collide with the marketing page `/trust-chain`.
- **Errors:** Upstream 503, or 502 if the api is unreachable.
- **Used by:** `fetchTrustChain` on `/trust-chain` (forwards `?around=`).
- **Auth:** none.

## Endpoint: POST /trust/verify

- **Purpose:** Same-origin Bearer proxy of api `POST /trust/verify` with `{ accountId }`.
- **Errors:** Upstream 400/401/403/404/409/503, or 502 if the api is unreachable.
- **Used by:** `postTrustVerify` in `MemberTrustActions`.
- **Auth:** Bearer (founder or moderator).

## Endpoint: POST /trust/propose-moderator

- **Purpose:** Same-origin Bearer proxy of api `POST /trust/propose-moderator` with `{ accountId }`.
- **Errors:** Upstream 400/401/403/404/409/503, or 502 if the api is unreachable.
- **Used by:** `postTrustPropose` in `MemberTrustActions`.
- **Auth:** Bearer (founder or moderator).

## Endpoint: POST /trust/confirm-moderator

- **Purpose:** Same-origin Bearer proxy of api `POST /trust/confirm-moderator` with `{ accountId }`.
- **Errors:** Upstream 400/401/403/404/409/503, or 502 if the api is unreachable.
- **Used by:** `postTrustConfirm` in `MemberTrustActions`.
- **Auth:** Bearer (founder or moderator, not the proposer).

## Endpoint: POST /trust/appoint-moderator

- **Purpose:** Same-origin Bearer proxy of api `POST /trust/appoint-moderator` with `{ accountId }`.
- **Errors:** Upstream 400/401/403/404/409/503, or 502 if the api is unreachable.
- **Used by:** `postTrustAppoint` in `MemberTrustActions`.
- **Auth:** Bearer (founder).

## Endpoint: DELETE /forum/messages/[id]

- **Purpose:** Same-origin moderation proxy to DELETE /messages/:id.
- **Auth:** Forwards Bearer authorization; the API requires live founder or moderator role.
- **Returns:** Upstream 204, 401, 403, 404 or 503; proxy failures return 502.
- **Side effects:** Deletes the post, direct replies and stored media on 21.gifts. Does not refund gifts or erase external Nostr relay copies.

## Endpoint: GET /translate

- **Purpose:** `{ available: boolean }` from `TRANSLATE_URL` (no upstream call). Always 200.
- **Errors:** none (invalid URL treated as unavailable).
- **Used by:** `fetchTranslateAvailable` in `NoteTranslate`.
- **Auth:** Public.

## Endpoint: POST /translate

- **Purpose:** `{ text, target }` → LibreTranslate-compatible upstream; returns `{ translatedText }`. `fil` maps to `tl`. Max 500 chars. 15s timeout. Does not forward Authorization.
- **Errors:** 400 invalid body, 503 not configured, 502 upstream.
- **Used by:** `translateNote` from `NoteTranslate`.
- **Auth:** Public.
