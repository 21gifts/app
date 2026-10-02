# Contributing to 21.gifts app

[REVIEW.md](REVIEW.md) is binding for every change and for every review of a change. Read it and this file at the base revision of the pull request. A pull request that changes either file does not replace that base text for the rest of its diff. The review does not change files.

This repository carries only frontend-specific code and docs. Protocol-level
documentation (concept, architecture, decisions) lives in
[`21gifts/api`](https://github.com/21gifts/api) —
[`CONCEPT.md`](https://github.com/21gifts/api/blob/develop/CONCEPT.md).

## Quick start

```bash
git clone https://github.com/21gifts/app.git
cd app
npm install
npm run dev    # → http://localhost:3000
```

## Prerequisites

| Tool    | Version                | Purpose                       |
| ------- | ---------------------- | ----------------------------- |
| Node.js | ≥ 22                   | Runtime for all tooling       |
| npm     | ≥ 10 (ships with Node) | Package manager (npm ci / CI) |

## Scripts

| Script                         | Purpose                                                                                                                                       |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                  | Dev server with hot reload on :3000                                                                                                           |
| `npm run build`                | Production build (standalone output)                                                                                                          |
| `npm run start`                | Serve the production build on :3000                                                                                                           |
| `npm run typecheck`            | `tsc --noEmit`                                                                                                                                |
| `npm run lint`                 | `next lint` + Prettier check + `scripts/check-scrollports.mjs` + `scripts/check-one-back.mjs`                                                 |
| `npm run lint:fix`             | Auto-fix lint findings + Prettier write                                                                                                       |
| `npm run format`               | Prettier write                                                                                                                                |
| `npm test`                     | Vitest unit tests, single run                                                                                                                 |
| `npm run test:watch`           | Vitest in watch mode                                                                                                                          |
| `npm run test:coverage`        | Vitest with the 100% coverage gate                                                                                                            |
| `npm run e2e`                  | Playwright all projects (behavior + four visual combos) against mock api (:3001) + standalone (:3000)                                         |
| `npm run e2e:behavior`         | Playwright chromium project only (behavioral specs; ignores `visual.spec.ts`)                                                                 |
| `npm run e2e:visual`           | Playwright `e2e/visual.spec.ts` (pass `--project=<combo>` to run one visual combo)                                                            |
| `npm run e2e:update-snapshots` | Rewrite Linux Chromium visual baselines                                                                                                       |
| `npm run e2e:check`            | Fail if a screen lacks `page.goto`, a variant lacks its e2e needle, an endpoint lacks `request.<verb>`, or an export lacks `Function: <Name>` |
| `npm run handbook:images`      | Copy Playwright Linux visual baselines into `public/handbook-images/`                                                                         |
| `npm run screenshot:check`     | Fail if a screen or variant lacks a Playwright PNG, an unexpected PNG is present, or a variant has no shot in `e2e/visual.spec.ts`            |
| `npm run handbook:check`       | Fail if any screen, variant, export, or HTTP endpoint lacks a handbook section                                                                |

## Project structure

```
app/
├── src/
│   ├── middleware.ts            # /map redirects to /shops#map and keeps the query string
│   ├── app/
│   │   ├── layout.tsx           # Root layout: negotiated html lang, metadata, globals.css
│   │   ├── (marketing)/         # Dark landing `/`, `/about`, `/legal`, `/handbook`, `/handbook/{screens,functions,endpoints}`, `/stats`
│   │   ├── rules/
│   │   │   └── page.tsx         # GET /rules — public living-room rules
│   │   ├── setup/
│   │   │   ├── name/page.tsx    # GET /setup/name — first onboarding step
│   │   │   ├── username/page.tsx # GET /setup/username — unique @21.gifts handle
│   │   │   └── rules/page.tsx   # GET /setup/rules — agree to living-room rules
│   │   ├── me/
│   │   │   ├── route.ts         # GET /me same-origin proxy
│   │   │   ├── name/route.ts    # POST /me/name
│   │   │   ├── username/route.ts # POST /me/username
│   │   │   ├── location/route.ts # POST /me/location
│   │   │   ├── about/route.ts   # PUT /me/about
│   │   │   ├── about/photo/route.ts  # GET /me/about/photo same-origin proxy
│   │   │   ├── setup/skip/route.ts  # POST /me/setup/skip
│   │   │   ├── rules-agreement/route.ts  # POST /me/rules-agreement
│   │   │   ├── push-subscriptions/route.ts  # POST/DELETE /me/push-subscriptions
│   │   │   ├── forum-laws-dismissed/route.ts  # POST /me/forum-laws-dismissed
│   │   │   ├── notification-level/route.ts  # POST /me/notification-level
│   │   │   ├── wallet-backup-seen/route.ts  # POST /me/wallet-backup-seen
│   │   │   ├── wallet/route.ts  # PUT /me/wallet (claim the in-app wallet key)
│   │   │   └── activity/route.ts  # GET /me/activity → api GET /me/activity
│   │   ├── push/
│   │   │   └── vapid-public/route.ts  # GET /push/vapid-public same-origin proxy
│   │   ├── lnurlpay/[pubkey]/
│   │   │   ├── route.ts         # POST in-app wallet address registration → api
│   │   │   ├── recover/route.ts # POST in-app wallet address lookup → api
│   │   │   └── metadata/route.ts # GET payer notes on received payments → api
│   │   ├── lnurlp/[username]/invoice/route.ts  # GET payment request for a verified in-app wallet → api, CORS *
│   │   ├── verify/[paymentHash]/route.ts       # GET payment settled check → api, CORS *
│   │   ├── contact/

│   │   │   ├── page.tsx         # GET /contact — signed-in in-app contact
│   │   │   └── submit/
│   │   │       └── route.ts     # POST /contact/submit → api POST /contact
│   │   ├── shops/
│   │   │   └── page.tsx         # GET /shops — signed-in shop listings (forum notes tagged #21GiftsShop)
│   │   ├── maps/
│   │   │   └── key/route.ts     # GET /maps/key — browser map key or null
│   │   ├── lnurl/
│   │   │   ├── pay-request/route.ts  # POST /lnurl/pay-request — outside address pay request
│   │   │   └── invoice/route.ts      # POST /lnurl/invoice — outside address invoice
│   │   ├── gifts/
│   │   │   ├── route.ts         # GET /gifts same-origin proxy
│   │   │   └── stats/
│   │   │       └── route.ts     # GET /gifts/stats same-origin proxy
│   │   ├── .well-known/
│   │   │   ├── nostr.json/route.ts  # GET/OPTIONS /.well-known/nostr.json NIP-05 CORS *
│   │   │   └── lnurlp/[username]/route.ts  # GET/OPTIONS /.well-known/lnurlp/:username LUD-16 CORS *
│   │   ├── messages/
│   │   │   ├── page.tsx         # GET /messages — signed-in PN inbox
│   │   │   ├── compose-target/route.ts  # GET /messages/compose-target platform fee note
│   │   │   └── [id]/
│   │   │       ├── page.tsx     # GET /messages/[id] — public forum note; per-note Open Graph
│   │   │       ├── invoice/route.ts  # POST /messages/:id/invoice payable-reply pay sheet
│   │   │       ├── photo/
│   │   │       │   ├── route.ts         # GET /messages/[id]/photo same-origin proxy
│   │   │       │   └── [file]/route.ts  # GET /messages/[id]/photo/{n}.jpg extra stills
│   │   │       └── [file]/route.ts      # GET /messages/[id]/video.mp4|.webm|.mov same-origin proxy
│   │   ├── public-messages/
│   │   │   └── [id]/route.ts    # GET /public-messages/:id → api GET /messages/:id
│   │   ├── translate/route.ts    # re-exports proxyTranslateAvailableGet / proxyTranslateNotePost (api GET /translate + POST /messages/:id/translate)
│   │   ├── conversations/
│   │   │   ├── route.ts         # GET/POST /conversations same-origin proxy
│   │   │   ├── moderator-group/route.ts  # GET /conversations/moderator-group
│   │   │   └── [id]/
│   │   │       ├── route.ts     # GET/POST /conversations/[id]
│   │   │       ├── invoice/route.ts  # POST /conversations/:id/invoice
│   │   │       ├── messages/[messageId]/photo/route.ts # GET conversation photo 0
│   │   │       ├── messages/[messageId]/photo/[file]/route.ts # GET extra stills 1–9
│   │   │       ├── read/route.ts # POST /conversations/[id]/read
│   │   │       └── messages/[messageId]/translate/route.ts # POST conversation translate
│   │   ├── forum/
│   │   │   ├── messages/
│   │   │   │   ├── route.ts     # GET/POST /forum/messages same-origin proxy
│   │   │   │   ├── places/route.ts  # GET /forum/messages/places
│   │   │   │   └── [id]/replies/route.ts  # GET /forum/messages/[id]/replies
│   │   │   └── members/
│   │   │       └── [accountId]/
│   │   │           ├── route.ts  # GET /forum/members/:id → api GET /members/:id
│   │   │           └── activity/route.ts  # GET /forum/members/:id/activity → api GET /members/:id/activity
│   │   ├── trust/
│   │   │   ├── graph/route.ts              # GET /trust/graph → api GET /trust-chain
│   │   │   ├── proposals/route.ts          # GET /trust/proposals
│   │   │   ├── verify/route.ts             # POST /trust/verify
│   │   │   ├── propose-moderator/route.ts  # POST /trust/propose-moderator
│   │   │   ├── confirm-moderator/route.ts  # POST /trust/confirm-moderator
│   │   │   ├── reject-moderator/route.ts   # POST /trust/reject-moderator
│   │   │   └── appoint-moderator/route.ts  # POST /trust/appoint-moderator
│   │   ├── funding/
│   │   │   ├── apply/route.ts                    # POST /funding/apply
│   │   │   ├── applications/route.ts             # GET /funding/applications
│   │   │   ├── applications/[accountId]/route.ts # GET /funding/applications/:id
│   │   │   ├── trial/route.ts                    # POST /funding/trial
│   │   │   ├── admit/route.ts                    # POST /funding/admit
│   │   │   └── reject/route.ts                   # POST /funding/reject
│   │   ├── login/
│   │   │   └── page.tsx         # GET /login — login + signed-in form
│   │   ├── donate/
│   │   │   └── page.tsx         # GET /donate — Send help explainer, CTA to /welcome
│   │   ├── profile/
│   │   │   ├── page.tsx         # GET /profile — signed-in name + location + notification level + optional this-device On/Off pill
│   │   │   └── apply/page.tsx   # GET /profile/apply — redirect to /grants/apply
│   │   ├── grants/
│   │   │   ├── page.tsx         # GET /grants — grant status and the staff queue link
│   │   │   ├── apply/page.tsx   # GET /grants/apply — paused applications screen
│   │   │   └── applications/
│   │   │       ├── page.tsx     # GET /grants/applications — grant queue
│   │   │       └── [accountId]/page.tsx # GET /grants/applications/:id — principles, then truth
│   │   ├── wallet/
│   │   │   └── page.tsx         # GET /wallet — optional balance and send blocks, receive address, payments list while the wallet is ready, Add/Show recovery phrase
│   │   ├── auth/passkey/replace/
│   │   │   ├── begin/route.ts   # POST /auth/passkey/replace/begin
│   │   │   └── finish/route.ts  # POST /auth/passkey/replace/finish
│   │   ├── auth/passkey/seed/
│   │   │   ├── begin/route.ts   # POST /auth/passkey/seed/begin
│   │   │   └── finish/route.ts  # POST /auth/passkey/seed/finish
│   │   ├── members/
│   │   │   └── [accountId]/page.tsx  # GET /members/:id — signed-in member profile
│   │   ├── moderate/
│   │   │   ├── page.tsx              # GET /moderate — signed-in moderation hub
│   │   │   ├── hidden/page.tsx       # GET /moderate/hidden — hidden notes
│   │   │   ├── proposals/page.tsx    # GET /moderate/proposals — confirm/reject queue
│   │   │   ├── applications/page.tsx # GET /moderate/applications — redirect to /grants/applications
│   │   │   ├── applications/[accountId]/page.tsx # GET /moderate/applications/:id — redirect to /grants/applications/:id
│   │   │   ├── group/page.tsx        # GET /moderate/group — closed staff room
│   │   │   └── handbook/page.tsx     # GET /moderate/handbook — staff handbook
│   │   ├── trust-chain/
│   │   │   ├── page.tsx              # GET /trust-chain — signed-in Trust Chain
│   │   │   └── trust-chain-loader.tsx
│   │   ├── manifest.ts          # Web App Manifest (MetadataRoute.Manifest default export)
│   │   ├── view/

│   │   │   └── [viewKey]/page.tsx  # GET /view/:viewKey — public read-only profile
│   │   ├── view-key/
│   │   │   └── [viewKey]/
│   │   │       ├── route.ts  # GET /view-key/:viewKey → api GET /view/:viewKey
│   │   │       ├── activity/route.ts  # GET /view-key/:viewKey/activity → api GET /view/:viewKey/activity
│   │   │       └── about/photo/route.ts  # GET /view-key/:viewKey/about/photo → api GET /view/:viewKey/about/photo
│   │   ├── globals.css          # Tailwind entry — the only CSS file
│   │   └── healthz/
│   │       └── route.ts         # GET /healthz — container liveness probe
│   ├── components/
│   │   ├── HandbookCopyLink.tsx # Copy absolute #id URL beside handbook headings
│   │   ├── HandbookIntro.tsx    # Localized handbook title/intro/nav chrome
│   │   ├── LanguageSwitcher.tsx # Cookie locale override + refresh
│   │   ├── LanguagePreferenceSwitcher.tsx # Profile locale SegmentedControl (endonyms)
│   │   ├── NumberFormatSwitcher.tsx # Cookie numberFormat override (ch/us/de)
│   │   ├── FiatPicker.tsx       # CHF|EUR|USD|PHP control (profile settings; unsigned chart/stats/day)
│   │   ├── FiatPreferenceSwitcher.tsx # Profile cookie fiat override (CHF|EUR|USD|PHP)
│   │   ├── LocaleProvider.tsx   # Client catalog + useTranslations
│   │   ├── NumberFormatProvider.tsx # Client number-format context + cookie write
│   │   ├── FiatPreferenceProvider.tsx # Client preferred-fiat context + cookie write
│   │   ├── NoteTranslate.tsx    # Icon-only Translate control (Languages; footer row, else under the body)
│   │   ├── TranslatableNoteBody.tsx # Exclusive original XOR translated note body
│   │   ├── LinkedText.tsx       # Autolink http(s) in note bodies; internal Link, external warning
│   │   ├── ExternalLinkWarning.tsx # Confirm overlay before leaving 21.gifts
│   │   ├── ShopStickerOverlay.tsx # Member-profile shop sticker preview, second language, PDF/PNG/JPG/SVG download
│   │   ├── AccountActivityChart.tsx # Compact Given/Received SVG from account activity series
│   │   ├── AboutMeSection.tsx   # About me heading + text or empty prompt; owner edit + copy-link
│   │   ├── ProfileScreen.tsx    # Signed-in profile card (totals + About me + name/location + 21.gifts address + notification level + optional this-device On/Off + language + theme + fiat + number format)
│   │   ├── WalletScreen.tsx     # Wires useWallet + useWalletPhrase + useWalletSend into WalletScreenView (balance, send, receive, payments list while ready, recovery entry)
│   │   ├── WalletScreenView.tsx # Wallet card and the visible one-step Back
│   │   ├── WalletBalance.tsx    # /wallet balance block (locked / connecting / ready / error)
│   │   ├── WalletHistory.tsx    # /wallet payments card (newest first, paged on scroll)
│   │   ├── WalletSetupNotice.tsx # Blocking one-time wallet setup dialog (AppShell)
│   │   ├── WalletSync.tsx       # Root-mounted listenForWalletPhrase effect (renders nothing)
│   │   ├── WalletPay.tsx        # In-app wallet pay slot of the gift pay sheets (fallback: QR + Wallet of Satoshi)
│   │   ├── WalletSend.tsx       # /wallet send block (paste, amount, confirm, sent)
│   │   ├── TrustChainDiagram.tsx # SVG Trust Chain graph (click hop, drag, stacked neighbors)
│   │   ├── TrustChainScreen.tsx  # Signed-in /trust-chain body
│   │   ├── ModerateScreen.tsx    # Signed-in /moderate hub (Hidden notes + Open proposals + moderator staff room + Handbook)
│   │   ├── GrantsScreen.tsx      # Signed-in /grants (grant card + staff queue link)
│   │   ├── HiddenNotesScreen.tsx # Signed-in /moderate/hidden list
│   │   ├── ProposalsScreen.tsx   # Signed-in /moderate/proposals confirm/reject queue
│   │   ├── FundingApplicationsScreen.tsx # Signed-in /grants/applications grant queue
│   │   ├── FundingApplicationDetailScreen.tsx # Signed-in /grants/applications/:id principles, then truth
│   │   ├── FundingStatusCard.tsx # Grant status on /grants
│   │   ├── ModeratorGroupScreen.tsx # Signed-in /moderate/group closed staff room
│   │   ├── ModerateHandbookScreen.tsx # Signed-in /moderate/handbook staff chapters
│   │   ├── MemberTrustActions.tsx # Staff verify / propose / confirm / appoint on a member card
│   │   ├── LocationForm.tsx     # Profile free-text location row (pencil / clear)
│   │   ├── PushToggle.tsx       # All/Active/Mentions pill plus optional This-device On/Off pill
│   │   ├── InAppBrowserView.tsx # Shared in-app escape card (Open in browser + Copy link)
│   │   ├── ViewProfileClaim.tsx # Public view Activate banner or in-app escape under the card
│   │   ├── ViewProfileLoader.tsx # Public view fetch states + GET /view-key/:viewKey/activity
│   │   ├── ViewProfileScreen.tsx # Public read-only profile card (chart + About me + name/location/address, copy-link)
│   │   ├── MemberProfileLoader.tsx # Signed-in member fetch states + GET /forum/members/:id/activity
│   │   ├── MemberProfileScreen.tsx # Member identity card + About me + location + activity feeds
│   │   ├── UsernameSetup.tsx    # Onboarding unique @21.gifts username (no Skip)
│   │   ├── UsernameForm.tsx     # Username field + Continue (setup + overlay)
│   │   ├── RequirementsOverlay.tsx # Add name or username, agree to rules, or explain the missing wallet before retrying a post
│   │   ├── StatsDashboard.tsx   # Gift KPI cards and SVG diagrams
│   │   ├── GiftDayTable.tsx     # Per-day gift rows
│   │   ├── ForumBoard.tsx       # Public forum list + dismissible laws hint + Active/All/Most popular + Send-a-post/Ask-for-money pill + Post messenger + payable-reply pay sheet + expand/replies + copy-link + author profile links
│   │   ├── MentionTextarea.tsx  # Forum composer @ suggestions (post, reply, ask text)
│   │   ├── ForumAskWizard.tsx   # Ask-for-money steps amount → photos → text → preview Post
│   │   ├── ForumGoalBar.tsx     # Top-level ask progress (Ask ₿ + fiat, orange/green overflow)
│   │   ├── ForumPhotoGallery.tsx # Horizontal snap row (data-scroll-x, 88% peek, chip, dots)
│   │   ├── ForumLoader.tsx      # Fetch/post/photo/video/feed-mode/pay/laws-dismiss/expand-replies/Ask-wizard/requirements-overlay state for /welcome and /shops
│   │   ├── ShopsScreen.tsx      # Signed-in /shops body (heading, Post/Map/Table pill, Card surface false)
│   │   ├── ShopsViewSwitch.tsx  # Post / Map / Table pill on /shops
│   │   ├── ShopTable.tsx        # Shop name, place, and operator table
│   │   ├── PlaceField.tsx       # Optional place pin on the top-level forum composer
│   │   ├── PlacesMapScreen.tsx  # Place list embedded on the shops map tab
│   │   ├── HandbookImageViewer.tsx # handbook chapter/screen/variant gallery (viewport/theme switches)
│   │   ├── InboxLoader.tsx      # fetch/open/`?c=`/photo pick/post/fetch/revoke/open-thread showAttach state for `/messages` inbox
│   │   ├── InboxScreen.tsx      # signed-in conversation list + thread composer
│   │   ├── PublicMessageLoader.tsx # public forum note on `/messages/[id]`; signed-in uses PublicMessageThread, unsigned remains read-only
│   │   ├── PublicMessageThread.tsx # signed-in permalink ForumBoard (composerHidden, auto-expand, copy/Gift-on-payable-reply/reply/delete)
│   │   ├── RulesDocument.tsx    # Living-room rules body from catalog keys
│   │   ├── RulesSetup.tsx       # Onboarding agree control for /setup/rules
│   │   ├── ContactScreen.tsx    # In-app contact heading + composer
│   │   ├── ContactLoader.tsx    # Post + requirements-overlay state for /contact
│   │   ├── AppShell.tsx         # fill/flow page shell driven by --app-height
│   │   ├── AppHeightSync.tsx    # Client mount that syncs --app-height after hydration
│   │   ├── ScrollSurfaceGuard.tsx # Clips every scrollport except the active one
│   │   └── ui/
│   │       ├── Button.tsx       # Shared button primitive
│   │       ├── ButtonLink.tsx   # Shared pill link
│   │       ├── Card.tsx         # Shared card chrome
│   │       ├── Field.tsx        # Shared labeled field
│   │       ├── IconButton.tsx   # Shared icon button
│   │       ├── PageChrome.tsx   # Flow-mode wrapper around AppShell
│   │       ├── SegmentedControl.tsx # Mutually exclusive option group
│   │       ├── Scrollport.tsx   # The one layout scrollport
│   │       ├── Wordmark.tsx     # Text wordmark 21.gifts
│   │       └── index.ts         # Barrel export for ui primitives
│   ├── hooks/
│   │   ├── useAccountTotals.ts  # Profile given/received totals
│   │   ├── useHydrateSession.ts # Restore session from cookie
│   │   ├── useLatestRateDay.ts  # Latest fiat rate day
│   │   ├── usePasskeyLogin.ts   # Register / authenticate / claim
│   │   ├── useUnreadCount.ts    # Menu badge unread
│   │   ├── useWallet.ts         # /wallet balance status, unlock, and retry
│   │   ├── useWalletHistory.ts  # /wallet payment pages, reloaded on every wallet sync
│   │   ├── useWalletSetup.ts    # One-time wallet setup dialog view and actions
│   │   ├── useWalletPay.ts      # In-app pay path of one invoice (unlock, fee, send, 60 s wait)
│   │   ├── useWalletPhrase.ts   # In-tab PRF recovery phrase
│   │   └── useWalletSend.ts     # /wallet send flow steps
│   ├── lib/
│   │   ├── config.ts            # Typed NEXT_PUBLIC_* accessors (required ones throw on missing; optional ones return null)
│   │   ├── locale.ts            # Supported locales + Accept-Language negotiation
│   │   ├── number-format.ts         # ch/us/de grouping + formatGroupedNumber
│   │   ├── request-locale.ts    # Cookie/Accept-Language for the current request
│   │   ├── request-number-format.ts # Cookie numberFormat for the current request
│   │   ├── request-fiat.ts      # Cookie fiat for the current request
│   │   ├── messages.ts          # en/de/es/fil catalogs
│   │   ├── mention-caret.ts     # Active @ token under the forum composer caret
│   │   ├── mention-search.ts    # GET /forum/mentions username suggestions
│   │   ├── onboarding.ts        # nextOnboardingPath from account.setup + UI helpers
│   │   ├── prf-mnemonic.ts      # WebAuthn PRF → BIP-39 English 12 words
│   │   ├── tab-phrase.ts        # In-tab recovery phrase RAM + SESSION_PHRASE_EVENT (never localStorage)
│   │   ├── wallet/              # In-app Bitcoin wallet (SDK load, connect, phrase remember/unlock, pay, parse)
│   │   │   ├── wallet-sdk.ts    # Dynamic Breez SDK load + narrow WalletSdk surface
│   │   │   ├── wallet-service.ts # connect / refresh / disconnect + phrase-event listener + register / list payments + payFromWallet / parseWalletInput
│   │   │   ├── wallet-setup.ts  # One-time setup: passkey → connect → claim → register → refresh
│   │   │   ├── wallet-phrase.ts # rememberPhraseFromPrf, unlockWalletPhrase, canUnlockWallet
│   │   │   └── lnurl-relay.ts   # lnurlRelayTarget: outside address or LNURL goes through the api
│   │   ├── gifts-address.ts     # Public username@21.gifts display handle
│   │   ├── shop-sticker.ts      # Shop-sticker SVG/PDF/PNG/JPG from the member pay QR; ?lang=Kikamba (no PDF library)
│   │   ├── shop-sticker-artwork.ts # Generated fixed sticker artwork (outlined paths); do not edit by hand
│   │   ├── missing-requirements.ts # MissingRequirementsError + 409 body parse
│   │   ├── rules-chapters.ts    # Ordered living-room rules chapter ids
│   │   ├── translate.ts         # Lookup + `{name}` interpolation (throws if missing)
│   │   ├── note-language.ts     # Small deterministic forum-note language detector
│   │   ├── note-translate.ts    # Browser translation availability cache + POST helper
│   │   ├── note-links.ts        # splitNoteLinks + isInternalAppUrl for note bodies
│   │   ├── payment-link.ts      # Generic lightning: link + smartphone detection (public pay link)
│   │   ├── project-donate.ts    # Donation address: platform account username @ app host
│   │   ├── utc-day.ts           # UTC YYYY-MM-DD calendar check
│   │   ├── account-activity.ts  # Align given/received series for the profile chart
│   │   ├── forum-time.ts        # local display timestamps for forum rows
│   │   ├── forum-feed.ts        # Client-side Active/All/Most popular forum filter and unpaid new-count
│   │   ├── forum-goal.ts        # parseForumAskAmount and forumGoalPercent for top-level Asks
│   │   ├── forum-shop.ts        # #21GiftsShop token helpers (isShopNote, stripShopHashtag, ensureShopHashtag)
│   │   ├── forum-unpaid-seen.ts # Last No gifts yet visit stamp in localStorage
│   │   ├── forum-photo.ts       # Client resize/JPEG encode for forum photos
│   │   ├── forum-video.ts       # Client size/MIME check + poster capture for forum videos
│   │   ├── handbook-topics.ts   # handbook image topic catalog + combo URLs
│   │   ├── screen-variant-catalog.json # screen-variant ids/labels/visual stems
│   │   ├── trust-chain.ts       # mergeTrustChain + layoutTrustChain (stack, no invented edges)
│   │   ├── app-height.ts        # --app-height bootstrap IIFE (server-safe; no hooks)
│   │   ├── scroll-surface.ts    # Which scrollport is active, and clipping of the rest
│   │   └── push.ts              # Web Push subscribe helpers (VAPID bytes, SW register, enable/disable)
│   ├── types/

│   │   └── env.d.ts             # Ambient ProcessEnv typings
│   └── __tests__/               # Mirror tree; one *.test.ts(x) per source file
│       ├── app/
│       │   ├── layout.test.tsx
│       │   ├── page.test.tsx
│       │   └── healthz/route.test.ts
│       └── lib/config.test.ts
├── docs/
│   ├── ui.md                    # Visual design system (tokens, type, chrome, control grammar)
│   └── handbook/                # Mandatory: every screen + exported function + endpoint
│       ├── README.md
│       ├── screens.md
│       ├── functions.md
│       ├── endpoints.md
│       └── images/              # Markdown still references images/<file>.png; PNGs are not committed
├── scripts/
│   ├── check-handbook.mjs       # CI gate: missing heading (screen, function, or endpoint) → exit 1
│   ├── check-scrollports.mjs    # CI gate: a second layout scrollport → exit 1; detector self-test first
│   ├── check-one-back.mjs       # CI gate: a second back control → exit 1
│   ├── screen-variants.mjs      # Distinct UI states of screenshot-gated screens (e2e needles + visual args)
│   ├── build-shop-sticker-artwork.mjs # Regenerate src/lib/shop-sticker-artwork.ts (fonts → outlines)
│   ├── sync-handbook-images.mjs # Copy visual baselines → public/handbook-images/ (prebuild/predev)
│   ├── check-e2e.mjs            # CI gate: missing screen goto, variant needle, endpoint request, or Function: title → exit 1
│   └── check-screenshots.mjs    # CI gate: missing or unexpected PNG, or variant with no visual.spec.ts shot → exit 1
├── e2e/
│   ├── smoke.spec.ts            # Playwright smoke tests (outside vitest scope)
│   ├── rules.spec.ts            # /rules living-room laws + CTAs
│   ├── contact.spec.ts          # /contact composer, validation, success
│   ├── login.spec.ts            # /login single Log in button + signed-in forms
│   ├── wallet.spec.ts           # /wallet recovery-phrase, balance, and send Function titles
│   ├── wallet-pay.spec.ts       # In-app wallet pay slot on the gift pay sheet (pins, fallback)
│   ├── wallet-setup.spec.ts     # Wallet setup dialog, payments list, username freeze, address proxies
│   ├── donate.spec.ts           # /donate Send help explainer + home CTA
│   ├── i18n.spec.ts             # Accept-Language + locale cookie switcher
│   ├── functions.spec.ts        # Playwright Function: <Name> tests through Next
│   ├── messages.spec.ts         # Inbox HTML /messages vs public /messages/[id]
│   ├── proposals.spec.ts        # /moderate/proposals staff confirm/reject queue
│   ├── applications.spec.ts     # /grants grant card, queue, and review; old paths redirect
│   ├── proxy.spec.ts            # Same-origin api proxy round-trips against the stub
│   ├── view.spec.ts             # /view/[viewKey] public profile
│   ├── mock-api.mjs             # Local 21.gifts api protocol stub for proxies
│   ├── visual.spec.ts           # Linux Chromium screenshot baselines (single source for handbook images)
│   └── visual.spec.ts-snapshots/
├── public/                      # Static assets served from /
│   ├── sw.js                    # Push-only service worker (no asset/offline cache; short-lived push-open path)
│   └── handbook-images/         # Built from visual baselines (gitignored *.png; keep .gitkeep)
├── next.config.ts               # output: 'standalone'
├── vitest.config.ts             # 100% coverage threshold
├── playwright.config.ts         # chromium; mock api :3001 + standalone :3000
├── eslint.config.mjs            # Flat config (next/core-web-vitals + next/typescript)
├── Dockerfile                   # Multi-stage build + entrypoint.sh env substitution
├── entrypoint.sh
├── README.md
├── CONTRIBUTING.md
├── REVIEW.md                 # PR review checklist
├── SECURITY.md
└── LICENSE
```

## Git workflow

### Branches

| Branch    | Purpose                            | Deploy target |
| --------- | ---------------------------------- | ------------- |
| `develop` | Default branch, active development | DEV           |
| `staging` | Experimental testing               | staging       |
| `main`    | Production releases                | PRD           |

- Push to `develop` via **feature branch + PR**
- `main` is protected — updates flow via an auto-generated Release PR (`develop → main`)
- **Hard requirement:** `staging` is the environment for experimental testing. It publishes `21gifts/app:staging`. A change that is good there is released to `develop` first (`Release: staging -> develop`). `main` receives changes only from `develop` (`Release: develop -> main`). `staging` is never released directly to `main`. An open release pull request is left unchanged. The staging release is not opened when the three-dot diff against `develop` has no file changes.
- Feature pull requests always target `develop`, not `staging` and not `main`. Developers rebase `staging` onto `develop` regularly, because those pull requests land on `develop` and do not update `staging`.
- Never force-push, never amend published commits, except publishing a rebase of `staging` onto `develop` with `git push --force-with-lease` to `staging` only.

### Commit messages

English, concise, describe _what_ changed.

```
# Good
Add /healthz route handler
Wire payable-reply invoice sheet
Fix wordmark scaling on small screens

# Bad
fix
WIP
update stuff
```

## Code style

### TypeScript

- **Strict mode**, including `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`
- **Explicit return types on exported functions** (enforced by ESLint)
- **No `any`** — use `unknown` and narrow
- **No `console.log`** in committed code — `console.warn` / `console.error` only, for legitimate operator-facing output
- **Named exports** — default exports only where Next.js requires them (`layout.tsx`, `page.tsx`, config files)
- **Path alias `@/`** points at `src/` (configured in `tsconfig.json` and `vitest.config.ts`)
- Every `NEXT_PUBLIC_*` variable is read through `src/lib/config.ts` — never
  `process.env` directly in components. Required accessors throw on missing
  values; explicitly optional ones (`getE2eNow`, `getBreezApiKey`,
  `getPlatformUsername`) return `null`. No silent fallbacks.
- **Viewer permission checks use `roleAtLeast`** (`src/lib/roles.ts`), never an equality test on the viewer's role — a higher role must always do and see everything a lower role can. The one named exception is `canEditDailyPayoutRoster` in `src/lib/roles.ts`, because initiator and moderator share rank 2, so a rank check cannot exclude moderators. It is true only for initiator and founder. No further equality checks.

### Styling

- **Tailwind CSS only.** No CSS files beyond `src/app/globals.css`, no CSS
  modules, no styled-components, no inline `style` attributes. The only
  exception is a `style` attribute that sets viewport-measured `top`,
  `bottom`, `left`, and `width` on a `fixed` overlay. Those four numbers
  are the clamped box; `top-full` and `bottom-full` do not compute them.
- Utility classes live directly on the JSX elements.
- Visual language (shells, tokens, type, chrome, control grammar) lives in
  `docs/ui.md`. New or migrated surfaces compose those parts. Raw
  `rounded-full bg-app-btn` (or `bg-neutral-900`) outside primitives on a
  new or migrated surface is an undeclared deviation.

### One scroll surface (hard requirement)

Each page has exactly one scrollable surface. `html` and `body` are
`overflow: clip` and `height: var(--app-height)`. `--app-height` is the
visible viewport (`visualViewport.height`, otherwise `innerHeight`), never
taller. The only element that may scroll is the innermost bound
`[data-scrollport]`. Among siblings, that is the most recently bound one.
It carries `data-scroll-active`. Every other port stays clipped and carries
`data-scroll-locked`. Absence of that lock is not permission to scroll.
`ScrollSurfaceGuard` watches the document and forces any other `auto`,
`scroll`, or `overlay` overflow — class, stylesheet, or script — to clip.
Textareas grow with their text instead of scrolling. Native inputs and
selects are left alone. Clipping (`overflow: hidden` or `clip`) is not a
scrollport. Components still must not set a scrolling overflow.
A photo row may scroll sideways on `[data-scroll-x]`. That row is
`overflow-x: auto` and `overflow-y: clip`, so it is not a second page
scroll. `scripts/check-scrollports.mjs` fails CI on scrolling utilities,
arbitrary values, and assignments, and on any stylesheet scrolling overflow
except `overflow-x: clip` and `overflow-y: auto` on `[data-scrollport][data-scroll-active]` and that
one sideways row. It rejects its own detector if that check goes blind. The document lock is
`!important`. AppShell `<main>` stays free of `overflow-hidden` so the
menu hosts on the frame are not clipped. `--app-offset-top` is
`visualViewport.offsetTop` (else 0) and positions `body`
(`position: fixed; top: var(--app-offset-top); height: var(--app-height)`).
The offset is never added into the height. The document lock stops the page from
scrolling under the frame.

A box stays inside the window. Only a slide inside `[data-scroll-x]` may extend past the left or
right edge, and that row's own box stays inside. A box whose top or bottom leaves the window by more than one pixel fails the same check, except content inside `[data-scrollport]`, which may sit past the top or bottom unless it is position:fixed; a position:fixed box is still reported. Do not size a panel with `vw` or `w-screen`: that
width is the phone, which is wider than the padded column, and that is what shifts a page.
`scripts/check-scrollports.mjs` fails lint on those widths. Every visual screenshot runs
`pageFrameProblems` first, and the Visual job fails when a box sticks out or the page can scroll
sideways.

### Components

- **App Router, server components by default.** Add `'use client'` only when
  the component actually needs state, effects, or browser APIs — and keep the
  client boundary as deep in the tree as possible.
- One component per file; co-locate route-specific components under their
  route segment.

### TSDoc

Every exported symbol carries a TSDoc block with a one-line summary plus
`@param` / `@returns` / `@throws` where applicable. `eslint-plugin-tsdoc`
flags malformed comments across `src/`.

### i18n catalogs (hard requirement)

Visitor-facing UI copy lives in `src/lib/messages.ts` as four catalogs:
English (`en`), German (`de`), Spanish (`es`), and Filipino (`fil`). **Every
catalog key must exist in all four locales** with a string that is non-empty
after trim. Adding
or renaming a key in one catalog without the others is rejected.

`MessageKey` is derived from the English catalog; `de` / `es` / `fil` use
`satisfies Messages`, so `npm run typecheck` fails on a missing key.
`src/__tests__/lib/messages.test.ts` asserts the key sets are identical and
every value is non-empty after trim; `npm test` / `npm run test:coverage`
(and CI) fail the PR when they diverge or a value is empty/whitespace.
`translate` (and `t` from `useTranslations`) throws if a key is absent at
runtime — no silent English fallback.

New or changed visitor-facing copy goes through a catalog key in the **same
PR**. Hard-coded UI strings are an undeclared deviation. Exceptions (do not
catalogize): legal body copy (English), handbook markdown bodies for Functions
and Endpoints, handbook chapter-navigation labels (English), product tokens such as `GitHub`, language-switcher endonym labels (`English` /
`Deutsch` / `Español` / `Filipino`), stats body copy (English), and
document/social metadata (`title`, `description`, Open Graph alt text —
English).

Screen-card descriptions are not part of that exception. English stays in
`docs/handbook/screens.md`. German, Spanish, and Filipino for those cards live
in `src/lib/screen-variant-descriptions-locale.json`, keyed by catalog id.
Route and variant labels stay identifiers. A missing translation throws; it
does not fall back to English. When `screens.md` has no description for an id,
every locale shows the catalog label.

### Icon controls (hard requirement)

The labeled vs icon-only table in `docs/ui.md` (control grammar) is the
**binding** rule. New work follows that table, not “everything new is an icon”.

| Labeled (`Button` / `ButtonLink` / inline `Link`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Icon-only (`IconButton`, required `aria-label`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Consent (**I agree to these rules**), **Continue**, **Skip** (onboarding name), Ask-preview labeled **Post**, **Log in**, **Log in with existing account**, **Open a new account**, **Log out**, **Try again**, **Unlock wallet**, pay-sheet **Pay from wallet**, wallet send **Continue**, **Send**, and **Done**, **Set up wallet**, **Activate**, pay-link **Pay** (`forum.payOpenWallet` / aria `forum.payOpenWalletAria` “Pay with a Bitcoin wallet app”; a `Button` that sets `location.href` to a generic `lightning:` link, not a `ButtonLink`), pay-slot **Try again** (`wallet.payRetry`), sentence-length empty-state CTA (**Write your About me**), wide-image confirm (**Use this crop**), **Message** (member profile DM CTA), member profile **Shop sticker** and the sticker overlay's **Download**, sentence-length links (**Open the forum**, **Open the app** (inline `text-accent` `Link` on `/legal`, not `ButtonLink`), **Ask for help**, **Send help**), marketing-shell primary, donate **Open the forum** | Actions **inside** a card: edit, delete, attach, send/post (forum Post-path + contact + inbox composers), copy, dismiss, **react** (Reply icon, `forum.react` “React”) on posts, **pay** (Gift icon, `forum.pay` “Send Bitcoin”) on payable replies, **translate** (Languages icon in the footer icon row, `forum.translate`), Menu **row** icons (the Menu _trigger_ stays labeled). The one top-left back arrow (profile, rules-setup, and an ask-wizard step) stays icon-only. Pay-sheet dismiss is `X` with `forum.payClose` (“Close”), not a back arrow. The wallet send step Close is the same `X` with `wallet.sendCancel` (“Cancel”). |

Content translation **Translate** is icon-only (`IconButton` + Languages, `aria-label` = `forum.translate`). Signed forum cards (`ForumBoard`) place it in the footer icon row with react / pay / copy. Surfaces without that row — unsigned public cards, About me, inbox, funding, and hidden notes — stack the control under the body. **Show original** / **Show translation** stay the same Languages icon. The accessible name is the only label; no visible text.

Tests locate icon **buttons** with `getByRole('button', { name })` against
the catalog `aria-label` and assert `queryByText` for the visible catalog
string is `null`. Icon **links** use `getByRole('link', { name })`.
The Profile menu row is the label only. It shows no given or received amounts.

A **new** control that is labeled when the table says icon-only (or
icon-only when the table says labeled) is an undeclared deviation.

The signed-in **Menu** trigger stays labeled (icon plus visible Menu word).
**Log out**, **Continue**, **I agree to these rules**,
**Activate**, **Try again**, pay-sheet **Pay**, and sentence-length
links stay labeled. Shop wizard **Add a shop**, step **Next**, summary
**Post**, and **Save changes** stay labeled in that same column. The photo
step's Close (X) is icon-only, accessible name Cancel, the same dismiss as
pay-sheet Close, and it is not a second back arrow.

Reviewers follow `REVIEW.md` and `docs/ui.md`.

### One back (hard requirement)

Every screen in the app has exactly one back control. It is the top-left arrow beside the wordmark, including marketing pages, login, donate, the pay link, the public profile, setup name and username, an unsigned public note, and the 404 page. A second back arrow, back link, or back button anywhere else — in the card, footer, wizard, sheet, 404 body, or any other region — is absolutely forbidden. That arrow returns to the in-app view this tab showed immediately before the current one. It does not jump to a fixed parent and it does not leave the site. If this tab has no earlier in-app view, the arrow opens the forum (`/welcome`). `/welcome` itself omits the arrow only when this tab has no earlier view, because that fallback would be the current page; an ask-wizard step still uses that same slot. The wordmark is not that control. A dismiss that stays on the same view is a close icon (`X`), not a back arrow. A handbook lightbox control that shows the previous image stays on the same view and is not a back control. An in-page step (wallet recovery words, wallet Advanced functions, a later rules-setup chapter, an ask-wizard step) is the previously displayed view: the same top-left arrow performs that step and is not joined by a second arrow. A new back control anywhere but that top-left arrow is an undeclared deviation. `npm run lint` runs `scripts/check-one-back.mjs`.

### Staff actions (hard requirement)

A stack of labeled moderator or founder actions on a member card is not shown as loose buttons. One closed disclosure (`staff.functions`, English "Moderator functions") uses the same `details` / `summary` as wallet **Advanced functions**, not a full-width button, and reveals only the actions that viewer may take on that person. Founder-only actions such as appoint use the same disclosure. Delete on a note stays the icon in the footer icon row. Routes under `/moderate` are the opened workspace and do not wrap their own tools again. The Menu **Moderation** row stays. The staff inbox origin filter stays. Role pills are not actions. A new labeled staff-action stack on a member card that renders before this disclosure is opened is an undeclared deviation. The closed row and the screen after that control is pressed are separate screenshot states. Reviewers follow `docs/ui.md` principle **Staff action stacks stay closed.**

### Amount entry (hard requirement)

Every control where a person types an amount uses `AmountEntry`: the gift `SegmentedControl` (₿ and the member's fiat code) and the other unit directly under the field. Bitcoin entry shows the preferred fiat. Fiat entry shows the bitcoin equivalent. The last unit a signed-in member chooses is `account.amountUnit` (`btc` or `fiat`, default `btc`) and is the default on every amount field. A signed-out pay link still shows the switch, starts at ₿, and does not store the choice. The submitted amount is always whole sats. A new amount field without the switch or the counter is an undeclared deviation. The daily payout roster on `/grants/payments/amounts` is not one of these fields: each amount is the USD figure spend stores and pays, so those inputs stay `Field` and the saved body stays `amountUsd`. Fiat mode is its own screenshot state. In the inbox composer the message, attach, and send stay on one row. The amount is the next row: the switch beside the input, the other unit under that input, and no visible label (the input keeps the accessible name).

### Shown amounts (hard requirement)

Every place that shows a bitcoin amount also shows that amount in the visitor's default fiat.

Signed in, the code is the currency stored for that person. `useFiatPreference` is that code: a profile choice they already stored wins. Signed out, there is no profile currency, so the code is the one implied by the UI language (`defaultFiatForLocale`: German CHF, English USD, Spanish EUR, Filipino PHP).

The figure is the fiat string stored on that payment when the payment recorded one. A missing or null stored field uses the latest gift-day rate (`useLatestRateDay`). A missing or unusable rate is the only reason the fiat line is absent. A payment screen does not treat the amount as ready while that rate is still loading, and its visual baseline includes the fiat line. Omitting the fiat next to a shown bitcoin amount is an undeclared deviation. Reviewers follow `REVIEW.md`.

### Payment QR vs wallet links (hard requirement)

The in-app wallet is the only wallet. A member's only address is
`<username>@<app host>`. No screen names, links to, or opens another wallet
app on a member's behalf, and members cannot link an external address.

A smartphone shows the same payment QR as a desktop for the profile,
member, public view, and point of sale. The Shop sticker is
shown wherever that profile QR is shown.

A specific invoice is different. Member pay sheets — the forum post pay
sheet (`ForumBoard`, including the composer pay slot for the posting fee and
today's repayment), the reply pay page (`ForumReplyPayPage`), and the inbox
pay sheet (`InboxScreen`) — pay from the member's in-app wallet only
(`WalletPay`: the `sparkInvoice` when the api issued one, otherwise the
payment request). A locked wallet is opened with one passkey prompt. They
never mount the invoice `QrCode` and never show a button to another wallet
app, on any user agent. Without a usable wallet they say so; there is no
fallback.

The public pay link (`PayLinkScreen`, used by people without an account,
the open till and **Continue**) hands its invoice to the visitor's own
Bitcoin wallet app with a generic `lightning:` link (`lightningHref`) on
**Pay**. Desktop and iPad also show that invoice QR. A smartphone does not
mount it.

Detect smartphones with `isSmartphoneUserAgent` on `navigator.userAgent`
(iPhone, iPod, or Android **with** `Mobile`). Do **not** use viewport
width: a narrow MacBook window is still a desktop. iPad is not a
smartphone.

The address QR shown when the wallet balance is too low is the member's own
profile QR and follows the profile rule.

Mounting an invoice QR on a member pay sheet, mounting the public pay-link
invoice QR on a smartphone UA, or adding a link or button to a named wallet
app is an undeclared deviation and is rejected. Hiding a profile, member,
public view, or point of sale QR on a smartphone UA is also rejected.
Reviewers follow `REVIEW.md`.

### Handbook (hard requirement)

The handbook under `docs/handbook/` **must exist**. Every UI screen, every
exported function/class in `src/`, and every HTTP endpoint **must** have a
complete section:

- Screens: `## Screen: /path` (one per `src/app/**/page.tsx`, plus `/404` from `not-found.tsx`)
- Screen variants: `### Variant: id` (one per **distinct UI state** of every
  screenshot-gated screen; the list in `scripts/screen-variants.mjs` is the
  source of truth. Omitting a gated state from the list is an undeclared
  deviation. `HANDBOOK_DOC_ROUTES` keep `## Screen:` prose and e2e `page.goto`
  only — no `### Variant:`, no goldens, not in `SCREEN_VARIANTS`) The `profile.chartError` chart-slot exception under Screenshot baselines is not a separate variant.
- Functions: `## Function: name` (one per `export function`,
  `export default function`, exported callable const, or `export class`)
- Endpoints: `## Endpoint: METHOD /path` (one per `src/app/**/route.ts` HTTP export)

A section is complete only if it has at least three `- **…**` bullets (Purpose,
Inputs, Returns or Actions, Used by) and enough prose to describe the behaviour.
`npm run handbook:check` (and CI) **fails the PR** when a heading is missing
(including an Endpoint heading), or a section is a stub. Adding a screen,
export, or HTTP endpoint without updating the handbook in the **same PR** is an
undeclared deviation and is rejected.

### Tests

- One `*.test.ts(x)` per source file, under `src/__tests__/` mirroring the source tree
- Every function exercised in at least one test
- Coverage gate: 100% lines, branches, functions, statements on the activated surface
  (see `vitest.config.ts`). Unreachable defensive code can be exempted with a
  `v8 ignore` annotation that names a concrete reason — never to silence the gate.
- Playwright tests live in `e2e/` and run against the mock api on :3001 plus
  the production standalone server on :3000 (`npm run e2e` builds and starts both).

### E2E (hard requirement)

Every UI screen **must** have at least one Playwright test that `page.goto`s that
path and asserts a user-visible outcome. Every entry in
`scripts/screen-variants.mjs` **must** have its `needle` string in `e2e/` (the
assertion for that state). Every HTTP endpoint discovered from
`src/app/**/route.ts` **must** have at least one Playwright
`request.get|post|put|patch|delete` of that path. Every exported function/class
**must** have a Playwright test whose title contains `Function: <Name>` and that
exercises that export through the running Next server (UI or `request`), not
only a handbook screenshot. `npm run e2e:check` scans Playwright spec files under `e2e/`
and **fails the PR** if a screen has no matching `goto`, a variant has no
`needle`, an endpoint has no matching `request.<verb>` call, or a function has
no `test('Function: <Name> …')` title. Adding a `page.tsx`, `route.ts`, or other `src/` export without an e2e
spec (`page.goto` / `request.<verb>` / `Function: <Name>`) in the **same PR**
is an undeclared deviation and is rejected. CI runs `e2e:check` in the Check
job, behavioral specs in the parallel E2E (behavior) job (`chromium` project),
and pixel compare in four parallel visual combo jobs.

### Screenshot baselines (hard requirement)

There is **one** source for screen images: Playwright Linux Chromium baselines
under `e2e/visual.spec.ts-snapshots/`.

Every public UI screen (`src/app/**/page.tsx`, plus `/404`) **must** have a
`toHaveScreenshot('screen-…png')` (via `shotScreen`) in `e2e/visual.spec.ts`,
**except** the handbook doc routes in `HANDBOOK_DOC_ROUTES`
(`/handbook`, `/handbook/screens`, `/handbook/functions`, `/handbook/endpoints`).
Those are documentation pages, not product screens, and are not screenshot-gated.
`/handbook/screens` _shows_ product-screen goldens and is not itself a golden.
They still need `## Screen:` prose and e2e `page.goto`. They are **not** listed
in `SCREEN_VARIANTS`.
Visual specs run in four projects (`desktop-light`, `desktop-dark`,
`mobile-light`, `mobile-dark`) so each shot is stored as
`${arg}-${combo}-linux.png`. Handbook Markdown keeps `images/<name>.png`
references for product screens; those bytes are filled into
`public/handbook-images/` by `npm run handbook:images` / `prebuild` / `predev`
from the desktop-light baseline. Do not commit PNGs under
`docs/handbook/images/` or `public/handbook-images/`.

Every **distinct UI state** of every screenshot-gated screen (not
`HANDBOOK_DOC_ROUTES`) **must** be listed in `scripts/screen-variants.mjs`.
Omitting a gated state from that list is an undeclared deviation and is
rejected. Pressing a button, or any other control, that changes what is on
screen is its own distinct UI state. The baseline taken before the press does
not cover the result. That includes opening a disclosure, a menu, or a list, a
confirm or cancel step, an expanded row, and any control whose press reveals,
hides, or replaces visible content. Each of those results needs a handbook
variant, an e2e needle, a `shotScreen` call, and a Playwright Linux baseline
for every combo in `BASELINE_COMBOS`, in the same PR. Shipping only the idle
or closed shot is an undeclared deviation and is rejected.

`profile.chartError` on `/profile`, `/members/[accountId]`, and `/view/[viewKey]` is the same chart slot as `profile.chartEmpty`: one sentence, no new control, and no layout change. It is not its own screenshot variant. The default variant prose may name it. Unit tests cover the sentence, the alert role, and that in-flight and successful empty stay `profile.chartEmpty`. Other error states, including `/stats` `error`, stay their own variants. This exception does not cover a button press or any other control.

An icon-only status mark is a control when pressing it reveals or hides the
sentence that names it. That pressed result is its own distinct UI state. The
resting icon shot does not cover it. The same PR must add the handbook variant,
the e2e needle, the `shotScreen` call, and a Playwright Linux baseline for
every combo in `BASELINE_COMBOS`. Shipping the icon without that pressed
baseline is an undeclared deviation and is rejected.

`/setup/rules` is one screen with **one state per
living-room rules chapter** (`RULES_CHAPTER_IDS` in `src/lib/rules-chapters.ts`);
each chapter is a variant. Viewport and theme are combo shots of those
variants, not a substitute for a missing chapter.

Every listed variant **must** have, in the **same PR**:

- a handbook `### Variant: id` with `![…](images/<image>)`
- its `needle` string in `e2e/`
- `shotScreen` / `toHaveScreenshot('<visual>')` in `e2e/visual.spec.ts`
- a Playwright Linux baseline for **each** combo in `BASELINE_COMBOS`:
  `${visual}-${combo.id}-linux.png`

Default screen shots use the `screen-…` args; extra states use `state-…` args.
Every variant needs all four `BASELINE_COMBOS`.

Adding a screen or UI state without updating the baselines in the **same PR**
is rejected. `npm run screenshot:check` (and CI) fails when a PNG is missing or
a variant has no matching shot in `e2e/visual.spec.ts`. It also fails when an
unexpected PNG sits under `e2e/visual.spec.ts-snapshots/` (not a screen or
`SCREEN_VARIANTS` combo). Exported functions need a handbook
`## Function: <Name>` section and an e2e `Function: <Name>` needle, not a
screenshot of that markdown.
`screenshot:check` still runs in the Check job. CI also runs the four visual
combo projects as parallel jobs on every PR (each with a 10-minute budget) so
pixel compare remains a gate.

A PR's snapshot diff must contain only screens whose intended appearance
changed. Do not commit a baseline whose pixels moved only as an incidental
side-effect of a shared-component tweak that was not meant to restyle that
screen.

Baselines are **Linux Chromium** (same as CI). They are skipped on macOS so
`npm run e2e` still runs the behavioral specs. FullPage shots unstick
`header.sticky` so Playwright does not paint the marketing header into every
stitch. Regenerate on Linux (`--platform linux/amd64` is required so regen
matches CI linux/amd64 Chromium):

```bash
docker run --rm --platform linux/amd64 -v "$PWD":/work -w /work \
  mcr.microsoft.com/playwright:v1.61.1-noble \
  bash -lc 'npm ci && npm run e2e:update-snapshots'
```

### Before every push (the same checks CI runs)

```bash
npm run typecheck
npm run lint
npm run handbook:check
npm run e2e:check
npm run screenshot:check
npm run test:coverage
npm run build
npm run e2e
```

CI will fail on the same conditions; catching them locally is faster.

### A38

This repository requires A38 according to the canonical A38 standard in
[DFXswiss/agent](https://github.com/DFXswiss/agent/blob/59e31ebd11ab587897dc8e5b2a6f21e489f35f3d/docs/a38.md)
at commit `59e31ebd11ab587897dc8e5b2a6f21e489f35f3d`. Repo job selection:
`.github/a38.json`. Target-branch applicability and fork workflow approval:
`.github/pr-guard.json`. `dfx pr guard` is
[wired in](https://github.com/DFXswiss/agent/blob/59e31ebd11ab587897dc8e5b2a6f21e489f35f3d/docs/a38-guard.md#how-fork-github-actions-are-meant-to-work).

This is a **public** repository. GitHub-hosted runners execute the heavy suite
(typecheck, handbook completeness, e2e completeness, screenshot baselines,
Vitest with the coverage gate, the production build, Playwright behavior, and
the four visual jobs). A38 does not replace those GitHub checks. The author
report only covers the light local job in `.github/a38.json` (`npm run lint`
on Node 22). Do not run Vitest, the production build, or Playwright locally
for A38.

Draft pull requests run the GitHub CI jobs. GitHub holds fork runs from
external contributors as `action_required`. Ready does not start CI. After a
fresh A38 enforce pass on the current head, `dfx pr guard` approves those
waiting initial runs, then sets Ready when the required GitHub jobs are green
and the PR is mergeable. The merger does not click Approve and run workflows.
Do not ask a maintainer to approve workflow runs. Post the light A38 report
on the current head. Every new head needs a new report. Authors with write
access to `21gifts/app` do not need a report.

## Docker

The app ships as a Next.js standalone server on `node:22-alpine`:

```bash
docker build -t 21gifts/app:dev .
docker run -p 3000:3000 -e NEXT_PUBLIC_API_URL=https://dev-api.21.gifts 21gifts/app:dev
```

**One image, multiple environments**: `next build` inlines `NEXT_PUBLIC_*`
values into the bundles, so the image is built with literal placeholders
(`__NEXT_PUBLIC_API_URL__`) and `entrypoint.sh` substitutes the runtime
values at container start. The container refuses to start if a referenced
variable is unset or empty.

| Variable              | DEV                        | STAGING                        | PRD                    |
| --------------------- | -------------------------- | ------------------------------ | ---------------------- |
| `NEXT_PUBLIC_API_URL` | `https://dev-api.21.gifts` | `https://staging-api.21.gifts` | `https://api.21.gifts` |

`NEXT_PUBLIC_API_URL` is the **upstream api**. The browser calls same-origin
paths (`/auth/passkey/…`, `/me`, …) which the App Router proxies to that URL.

`APP_VERSION` is a Docker **build-arg** (default `dev`), passed by the deploy
workflows as `github.run_number`. It is inlined at `next build` as
`NEXT_PUBLIC_APP_VERSION` and shown in the signed-in Menu via `getAppVersion()`.
It is not substituted at container start and is not an `entrypoint.sh`
placeholder. Local and Playwright builds without the arg show `dev`.

`NEXT_PUBLIC_BREEZ_API_KEY` is a second Docker **build-arg** (no default),
passed only by the staging deploy (see [Breez SDK Spark](#breez-sdk-spark)).
It is inlined at `next build`, is not an `entrypoint.sh` placeholder, and an
unset or empty value still builds.

`PLATFORM_USERNAME` is a Docker **build-arg** (default empty), inlined at
`next build` as `NEXT_PUBLIC_PLATFORM_USERNAME` and read through
`getPlatformUsername()`. It is the username of the 21.gifts platform account;
the landing page shows that account's wallet address `<username>@<host>` for
donations to the project. Empty hides the donation section. Playwright builds
set it to `21gifts`. No deploy workflow passes it yet.

## CI / CD

| Workflow               | Trigger                                                           | Action                                                                                                                                                                                                                    |
| ---------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ci.yaml`              | PR (including drafts); `workflow_dispatch`                        | Lint (`npm run lint` on Node 22) + Check (typecheck, handbook, e2e-check, screenshots, test (100% coverage), build on Node 22) + E2E (behavior) + four visual combo jobs; **10 minutes each**; Playwright `v1.61.1-noble` |
| `deploy-dev.yaml`      | push to `develop`                                                 | Docker build → push `21gifts/app:beta` → notify → wait for deploy                                                                                                                                                         |
| `deploy-staging.yaml`  | push to `staging`                                                 | Docker build (`NEXT_PUBLIC_BREEZ_API_KEY` from `BREEZ_API_KEY_STAGING`) → push `21gifts/app:staging` → notify → wait for deploy                                                                                           |
| `deploy-prd.yaml`      | push to `main`                                                    | Docker build → push `21gifts/app:latest` → notify → wait for deploy                                                                                                                                                       |
| `auto-release-pr.yaml` | push to `develop` or `staging`                                    | Open a missing release only (`staging → develop`, and `develop → main`). Leave an open release unchanged. Skip `staging → develop` when that diff has no file changes.                                                    |
| `a38-guard.yml`        | `pull_request_target`; PR comments; schedule; `workflow_dispatch` | `dfx pr guard` verifies the A38 report, releases held fork runs of `ci.yaml`, and sets ready; never checks out the PR code                                                                                                |

Images target `linux/arm64`.

Deploy workflows require these GitHub Actions secrets:

| Secret            | Purpose                                             |
| ----------------- | --------------------------------------------------- |
| `DOCKER_USERNAME` | Docker Hub username for image push                  |
| `DOCKER_PASSWORD` | Docker Hub token for image push                     |
| `DISPATCH_TOKEN`  | PAT to dispatch `image-published` and read that run |
| `DISPATCH_REPO`   | Target `owner/repo` that receives `image-published` |

If `DISPATCH_TOKEN` or `DISPATCH_REPO` is missing, deploy fails loud (the image
may already be on Hub). After `image-published`, the job waits for the
infrastructure run whose title is `image-published 21gifts/app:<tag> <sha>`
and fails if that run does not succeed. The wait is what makes a failed DEV deploy visible on the develop→main PR. A failed staging deploy fails that staging workflow, not the release pull request.

## Breez SDK Spark

The app reads the key as `NEXT_PUBLIC_BREEZ_API_KEY` through `getBreezApiKey()`.
It is inlined at `next build`. Unset or empty disables the in-app wallet. It
is the only wallet, so members then cannot pay from the app: the pay sheets say
that the wallet is not available here. Local use:
`NEXT_PUBLIC_BREEZ_API_KEY=<key> npm run dev`. Playwright and CI builds leave
it unset. No deploy workflow passes it yet, so neither deployment has the
wallet enabled.

This repository stores three GitHub Actions secrets for the Breez SDK (Spark).
`deploy-staging.yaml` passes `BREEZ_API_KEY_STAGING` as the Docker build-arg
`NEXT_PUBLIC_BREEZ_API_KEY`, which `next build` bakes into the app; unset or
empty still builds. The DEV and PRD deploys do not read their secrets. A later
workflow can read them as `secrets.BREEZ_API_KEY_PRD` and
`secrets.BREEZ_API_KEY_DEV`. GitHub does not show the values again, and
the values are not in git.

| Secret                  | Use                                                            |
| ----------------------- | -------------------------------------------------------------- |
| `BREEZ_API_KEY_PRD`     | Breez SDK API key for production (`https://api.21.gifts`)      |
| `BREEZ_API_KEY_DEV`     | Breez SDK API key for development (`https://dev-api.21.gifts`) |
| `BREEZ_API_KEY_STAGING` | Breez SDK API key for staging (`https://staging-api.21.gifts`) |

```yaml
env:
  BREEZ_API_KEY: ${{ secrets.BREEZ_API_KEY_DEV }}
```

Pass `BREEZ_API_KEY` to the SDK as `apiKey`. Use `BREEZ_API_KEY_PRD` only for
production and `BREEZ_API_KEY_STAGING` only for staging. The same three secret
names are set on [`21gifts/api`](https://github.com/21gifts/api).

## Related repos

- [`21gifts/api`](https://github.com/21gifts/api) — Backend service + canonical project docs
