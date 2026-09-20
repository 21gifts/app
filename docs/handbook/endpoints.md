# HTTP endpoints (Next.js route handlers)

## Endpoint: GET /.well-known/nostr.json

- **Purpose:** Proxies NIP-05 `nostr.json` from the api onto the site apex. CORS `*`.
- **Errors:** Upstream 502/503.
- **Used by:** Damus verification.
- **Auth:** none.

## Endpoint: GET /.well-known/lnurlp/[username]

- **Purpose:** Proxies LUD-16 payRequest from the api onto the site apex so wallets can pay `username@21.gifts`. CORS `*`. Settlement stays on the linked Wallet of Satoshi callback.
- **Errors:** Upstream 404/502.
- **Used by:** Lightning wallets.
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
- **Used by:** `fetchGiftStats` on `/stats`, `/welcome`, `/messages/[id]`, `/members/[accountId]`, and the staff payout-goal widget on `/moderate`.
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

## Endpoint: POST /me/notification-level

- **Purpose:** Same-origin Bearer proxy of api POST `/me/notification-level`. JSON body `{ level: "all"|"active"|"mentions" }` returns the owner Account.
- **Errors:** Upstream 401, 400 invalid level, or 502 if the api is unreachable.
- **Used by:** `postNotificationLevel`.
- **Auth:** Bearer.

## Endpoint: POST /me/rules-agreement

- **Purpose:** Same-origin proxy to record living-room rules agreement on the signed-in account (`rulesAgreedAt`).
- **Errors:** Upstream 401, or 502 if the api is unreachable.
- **Used by:** `agreeToRules`.
- **Auth:** Bearer.

## Endpoint: GET /me

- **Purpose:** Same-origin proxy of the signed-in account, including optional `funding` (`null` for `basis`).
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

- **Purpose:** Same-origin Bearer proxy of api GET `/messages` (public forum list, newest-first), forwarding optional `mode`, `limit`, and `cursor` query parameters. App path is `/forum/messages` so `/messages/[id]` can serve HTML. The welcome client always sends `limit=20`; the JSON body may include opaque `nextCursor` (omitted at end of feed).
- **Errors:** Upstream 401, or 502 if the api is unreachable.
- **Used by:** `fetchMessages`.
- **Auth:** Bearer.

## Endpoint: GET /forum/messages/hidden

- **Purpose:** Same-origin Bearer proxy of api GET `/messages/hidden` (hidden living-room notes for moderators). App path is `/forum/messages/hidden` so HTML `/moderate/hidden` can serve the page.
- **Errors:** Upstream 401/403, or 502 if the api is unreachable.
- **Used by:** `listHiddenMessages` via `HiddenNotesScreen` on `/moderate/hidden`.
- **Auth:** Bearer; moderator role on the api.

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

- **Purpose:** Same-origin Bearer proxy of api GET `/conversations/:id` (oldest-first messages). Each message has required `fromMe` (true iff this session is the actor) and `sats`, and optional `accountId` (sender). For a staff viewer, incoming `name` and optional `accountId` are the actor. Members still see platform identity (`21.gifts`) on official replies. Optional query `sinceMessageId` is forwarded for gift pay-sheet polling.
- **Errors:** Upstream 401/404/503, or 502 if the api is unreachable.
- **Used by:** `fetchConversation` on `/messages?c=` and on `/moderate/group`.
- **Auth:** Bearer.

## Endpoint: POST /conversations/[id]

- **Purpose:** Same-origin Bearer proxy of api POST `/conversations/:id` with `{ text }` (1–500 characters). Staff replies on official threads still send as the platform account on the api, but JSON `fromMe`, `name`, and `accountId` follow the actor. The created message has required `fromMe` and optional `accountId` (sender).
- **Errors:** Upstream 400/401/404/503, or 502 if the api is unreachable.
- **Used by:** `postConversationMessage` in the inbox composer and in `ModeratorGroupScreen`.
- **Auth:** Bearer.

## Endpoint: POST /conversations/[id]/invoice

- **Purpose:** Same-origin Bearer proxy of api POST `/conversations/:id/invoice` with `{ sats, text? }`. Success `{ pr, amountSats, messageId }` for the inbox pay sheet.
- **Errors:** Upstream 400/401/404/429/503, or 502 if the api is unreachable.
- **Used by:** `postConversationInvoice` in the inbox composer.
- **Auth:** Bearer.

## Endpoint: POST /conversations/[id]/read

- **Purpose:** Same-origin Bearer proxy of api POST `/conversations/:id/read` (mark one conversation read).
- **Errors:** Upstream 401/404/503, or 502 if the api is unreachable.
- **Used by:** `markConversationRead` from `InboxLoader` after a successful thread fetch.
- **Auth:** Bearer.

## Endpoint: GET /forum/notifications

- **Purpose:** Same-origin Bearer proxy of api GET `/notifications` (posts, replies, payments, and moderator appointment for the session). App path is `/forum/notifications` so HTML `/notifications` can serve the page.
- **Errors:** Upstream 401/503, or 502 if the api is unreachable.
- **Used by:** `fetchNotifications` via `NotificationsLoader` on `/notifications`, via `useUnreadCount` in `SignedInChrome`, via `ForumLoader` on `/welcome`, and via `refreshUnreadAppBadge` (from `InboxLoader` after mark-read).
- **Auth:** Bearer.

## Endpoint: POST /forum/notifications/read-all

- **Purpose:** Same-origin Bearer proxy of api POST `/notifications/read-all` (mark every notification read).
- **Errors:** Upstream 401/503, or 502 if the api is unreachable.
- **Used by:** `markAllNotificationsRead` from `NotificationsLoader`.
- **Auth:** Bearer.

## Endpoint: POST /forum/notifications/[id]/read

- **Purpose:** Same-origin Bearer proxy of api POST `/notifications/:id/read` (mark one notification read).
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
- **Used by:** `fetchTrustProposals` via `ProposalsScreen` on `/moderate/proposals`. `ModerateScreen` on `/moderate` does not call this GET. Confirm uses existing `POST /trust/confirm-moderator` (`postTrustConfirm`), not appoint.
- **Auth:** Bearer session; the api requires a moderator. The app does not fetch this list for other signed-in roles (forbidden copy, no request).

## Endpoint: POST /trust/verify

- **Purpose:** Same-origin Bearer proxy of api `POST /trust/verify` with `{ accountId }`.
- **Errors:** Upstream 400/401/403/404/409/503, or 502 if the api is unreachable.
- **Used by:** `postTrustVerify` in `MemberTrustActions`.
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

## Endpoint: POST /trust/appoint-moderator

- **Purpose:** Same-origin Bearer proxy of api `POST /trust/appoint-moderator` with `{ accountId }`.
- **Errors:** Upstream 400/401/403/404/409/503, or 502 if the api is unreachable.
- **Used by:** `postTrustAppoint` in `MemberTrustActions`.
- **Auth:** Bearer (founder).

## Endpoint: POST /funding/apply

- **Purpose:** Same-origin Bearer proxy of api `POST /funding/apply`. Role `basis` is 403. Effective `none` or `rejected` becomes pending.
- **Errors:** Upstream 401/403/409/503, or 502 if the api is unreachable.
- **Used by:** `postFundingApply` via `FundingStatusCard` on `/profile`.
- **Auth:** Bearer session; the api requires a role other than `basis`.

## Endpoint: GET /funding/applications

- **Purpose:** Same-origin Bearer proxy of api `GET /funding/applications` (open grant applications for moderators). Lives under `/funding/applications` because Next.js forbids a `route.ts` beside the HTML page at `/moderate/applications`.
- **Errors:** Upstream 401 without a Bearer session, 403 when the account is not founder or moderator, 503 when the api is unavailable, or 502 JSON if this proxy cannot reach the api origin.
- **Used by:** `fetchFundingApplications` via `FundingApplicationsScreen` on `/moderate/applications`. `ModerateScreen` on `/moderate` does not call this GET.
- **Auth:** Bearer session; the api requires founder or moderator. The app does not fetch this list for other signed-in roles (forbidden copy, no request).

## Endpoint: GET /funding/applications/[accountId]

- **Purpose:** Same-origin Bearer proxy of api `GET /funding/applications/:accountId` (staff review payload: account, grant, living-room posts).
- **Errors:** Upstream 401/403/404/503, or 502 if the api is unreachable.
- **Used by:** `fetchFundingApplication` via `FundingApplicationDetailScreen` on `/moderate/applications/[accountId]`.
- **Auth:** Bearer session; the api requires founder or moderator.

## Endpoint: POST /funding/trial

- **Purpose:** Same-origin Bearer proxy of api `POST /funding/trial` with `{ accountId }`. Target must be effective pending.
- **Errors:** Upstream 400/401/403/404/409/503, or 502 if the api is unreachable.
- **Used by:** `postFundingTrial` in `FundingApplicationDetailScreen`.
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
