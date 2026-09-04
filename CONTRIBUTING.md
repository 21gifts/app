# Contributing to 21.gifts app

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
| Node.js | ≥ 20 (CI runs 22)      | Runtime for all tooling       |
| npm     | ≥ 10 (ships with Node) | Package manager (npm ci / CI) |

## Scripts

| Script                         | Purpose                                                                                                                                       |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                  | Dev server with hot reload on :3000                                                                                                           |
| `npm run build`                | Production build (standalone output)                                                                                                          |
| `npm run start`                | Serve the production build on :3000                                                                                                           |
| `npm run typecheck`            | `tsc --noEmit`                                                                                                                                |
| `npm run lint`                 | `next lint` + Prettier check                                                                                                                  |
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
│   ├── app/
│   │   ├── layout.tsx           # Root layout: negotiated html lang, metadata, globals.css
│   │   ├── (marketing)/         # Dark landing `/`, `/legal`, `/handbook`, `/handbook/{screens,functions,endpoints}`, `/stats`
│   │   ├── rules/
│   │   │   └── page.tsx         # GET /rules — public living-room rules
│   │   ├── setup/
│   │   │   ├── name/page.tsx    # GET /setup/name — first onboarding step
│   │   │   ├── address/page.tsx # GET /setup/address — second onboarding step
│   │   │   └── rules/page.tsx   # GET /setup/rules — agree to living-room rules
│   │   ├── me/
│   │   │   ├── route.ts         # GET /me same-origin proxy
│   │   │   ├── name/route.ts    # POST /me/name
│   │   │   ├── setup/skip/route.ts  # POST /me/setup/skip
│   │   │   ├── rules-agreement/route.ts  # POST /me/rules-agreement
│   │   │   ├── lightning-address/route.ts  # POST/DELETE /me/lightning-address
│   │   │   ├── push-subscriptions/route.ts  # POST/DELETE /me/push-subscriptions
│   │   │   └── forum-laws-dismissed/route.ts  # POST /me/forum-laws-dismissed
│   │   ├── push/
│   │   │   └── vapid-public/route.ts  # GET /push/vapid-public same-origin proxy
│   │   ├── contact/

│   │   │   ├── page.tsx         # GET /contact — signed-in in-app contact
│   │   │   └── submit/
│   │   │       └── route.ts     # POST /contact/submit → api POST /contact
│   │   ├── gifts/
│   │   │   ├── route.ts         # GET /gifts same-origin proxy
│   │   │   └── stats/
│   │   │       └── route.ts     # GET /gifts/stats same-origin proxy
│   │   ├── .well-known/
│   │   │   └── nostr.json/route.ts  # GET/OPTIONS /.well-known/nostr.json NIP-05 CORS *
│   │   ├── messages/
│   │   │   ├── page.tsx         # GET /messages — signed-in PN inbox
│   │   │   └── [id]/
│   │   │       ├── page.tsx     # GET /messages/[id] — public forum note
│   │   │       ├── invoice/route.ts  # POST /messages/:id/invoice pay-on-note
│   │   │       ├── photo/route.ts    # GET /messages/[id]/photo same-origin proxy
│   │   │       └── [file]/route.ts   # GET /messages/[id]/video.mp4|.webm|.mov same-origin proxy
│   │   ├── public-messages/
│   │   │   └── [id]/route.ts    # GET /public-messages/:id → api GET /messages/:id
│   │   ├── conversations/
│   │   │   ├── route.ts         # GET/POST /conversations same-origin proxy
│   │   │   └── [id]/route.ts    # GET/POST /conversations/[id]
│   │   ├── forum/
│   │   │   ├── messages/
│   │   │   │   ├── route.ts     # GET/POST /forum/messages same-origin proxy
│   │   │   │   └── [id]/replies/route.ts  # GET /forum/messages/[id]/replies
│   │   │   └── members/
│   │   │       └── [accountId]/route.ts  # GET /forum/members/:id → api GET /members/:id
│   │   ├── login/
│   │   │   └── page.tsx         # GET /login — login + signed-in form
│   │   ├── donate/
│   │   │   └── page.tsx         # GET /donate — Send help explainer, CTA to /welcome
│   │   ├── profile/
│   │   │   └── page.tsx         # GET /profile — signed-in name + address + push bell + icon-only view-key copy
│   │   ├── members/
│   │   │   └── [accountId]/page.tsx  # GET /members/:id — signed-in member profile
│   │   ├── manifest.ts          # Web App Manifest (MetadataRoute.Manifest default export)
│   │   ├── view/

│   │   │   └── [viewKey]/page.tsx  # GET /view/:viewKey — public read-only profile
│   │   ├── view-key/
│   │   │   └── [viewKey]/route.ts  # GET /view-key/:viewKey → api GET /view/:viewKey
│   │   ├── globals.css          # Tailwind entry — the only CSS file
│   │   └── healthz/
│   │       └── route.ts         # GET /healthz — container liveness probe
│   ├── components/
│   │   ├── HandbookCopyLink.tsx # Copy absolute #id URL beside handbook headings
│   │   ├── HandbookIntro.tsx    # Localized handbook title/intro/nav chrome
│   │   ├── LanguageSwitcher.tsx # Cookie locale override + refresh
│   │   ├── LocaleProvider.tsx   # Client catalog + useTranslations
│   │   ├── ProfileScreen.tsx    # Signed-in profile card (totals + name/address + push bell + icon-only view-key copy)
│   │   ├── PushToggle.tsx       # Icon-only Bell Web Push enable/disable on profile
│   │   ├── ViewKeyCopy.tsx      # Copy absolute /view/<viewKey> URL on profile
│   │   ├── InAppBrowserView.tsx # Shared in-app escape card (Open in browser + Copy link)
│   │   ├── ViewProfileClaim.tsx # Public view Activate banner or in-app escape under the card
│   │   ├── ViewProfileLoader.tsx # Public view fetch states + filtered spendOverTime
│   │   ├── ViewProfileScreen.tsx # Public read-only profile card (chart + name/address, no actions)
│   │   ├── MemberProfileLoader.tsx # Signed-in member fetch states + filtered spendOverTime
│   │   ├── MemberProfileScreen.tsx # Member identity card + optional profile note
│   │   ├── RequirementsOverlay.tsx # Add name or agree to rules before retrying a post
│   │   ├── StatsDashboard.tsx   # Gift KPI cards and SVG diagrams
│   │   ├── GiftDayTable.tsx     # Per-day gift rows
│   │   ├── ForumBoard.tsx       # Public forum list + dismissible laws hint + Active/All/Most popular + text/photo/video icon composer + pay-on-note + expand/replies + copy-link + PM + author profile links
│   │   ├── ForumLoader.tsx      # Fetch/post/photo/video/feed-mode/pay/laws-dismiss/expand-replies/PM/requirements-overlay state for /welcome forum
│   │   ├── HandbookImageViewer.tsx # handbook stacked baselines (viewport/theme switches)
│   │   ├── InboxLoader.tsx      # fetch/open/`?c=` state for `/messages` inbox
│   │   ├── InboxScreen.tsx      # signed-in conversation list + thread composer
│   │   ├── PublicMessageLoader.tsx # read-only public forum note on `/messages/[id]`
│   │   ├── RulesDocument.tsx    # Living-room rules body from catalog keys
│   │   ├── RulesSetup.tsx       # Onboarding agree control for /setup/rules
│   │   ├── ContactScreen.tsx    # In-app contact heading + composer
│   │   ├── ContactLoader.tsx    # Post + requirements-overlay state for /contact
│   │   ├── AppShell.tsx         # fill/flow page shell driven by --app-height
│   │   ├── AppHeightSync.tsx    # Client mount that syncs --app-height after hydration
│   │   └── ui/
│   │       ├── Button.tsx       # Shared button primitive
│   │       ├── ButtonLink.tsx   # Shared pill link
│   │       ├── Card.tsx         # Shared card chrome
│   │       ├── Field.tsx        # Shared labeled field
│   │       ├── IconButton.tsx   # Shared icon button
│   │       ├── PageChrome.tsx   # Flow-mode wrapper around AppShell
│   │       ├── SegmentedControl.tsx # Mutually exclusive option group
│   │       ├── Wordmark.tsx     # Text wordmark 21.gifts
│   │       └── index.ts         # Barrel export for ui primitives
│   ├── lib/
│   │   ├── config.ts            # Typed NEXT_PUBLIC_* accessors (throw on missing)
│   │   ├── locale.ts            # Supported locales + Accept-Language negotiation
│   │   ├── request-locale.ts    # Cookie/Accept-Language for the current request
│   │   ├── messages.ts          # en/de/es/fil catalogs
│   │   ├── onboarding.ts        # nextOnboardingPath from account.setup + UI helpers
│   │   ├── missing-requirements.ts # MissingRequirementsError + 409 body parse
│   │   ├── rules-chapters.ts    # Ordered living-room rules chapter ids
│   │   ├── translate.ts         # Lookup + `{name}` interpolation (throws if missing)
│   │   ├── wos-deep-link.ts     # Wallet of Satoshi lightning:/intent hrefs + smartphone detection
│   │   ├── utc-day.ts           # UTC YYYY-MM-DD calendar check
│   │   ├── forum-time.ts        # UTC display timestamps for forum rows
│   │   ├── forum-feed.ts        # Client-side Active/All/Most popular forum filter
│   │   ├── forum-photo.ts       # Client resize/JPEG encode for forum photos
│   │   ├── forum-video.ts       # Client size/MIME check + poster capture for forum videos
│   │   ├── handbook-topics.ts   # handbook image topic catalog + combo URLs
│   │   ├── screen-variant-catalog.json # screen-variant ids/labels/visual stems
│   │   ├── app-height.ts        # --app-height bootstrap IIFE (server-safe; no hooks)
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
│   ├── ui.md                    # Visual design system (target: tokens, type, chrome, control grammar)
│   └── handbook/                # Mandatory: every screen + exported function + endpoint
│       ├── README.md
│       ├── screens.md
│       ├── functions.md
│       ├── endpoints.md
│       └── images/              # Markdown still references images/<file>.png; PNGs are not committed
├── scripts/
│   ├── check-handbook.mjs       # CI gate: missing heading (screen, function, or endpoint) → exit 1
│   ├── screen-variants.mjs      # Every distinct UI state of every screen (handbook + e2e needles + visual args)
│   ├── sync-handbook-images.mjs # Copy visual baselines → public/handbook-images/ (prebuild/predev)
│   ├── check-e2e.mjs            # CI gate: missing screen goto, variant needle, endpoint request, or Function: title → exit 1
│   └── check-screenshots.mjs    # CI gate: missing or unexpected PNG, or variant with no visual.spec.ts shot → exit 1
├── e2e/
│   ├── smoke.spec.ts            # Playwright smoke tests (outside vitest scope)
│   ├── rules.spec.ts            # /rules living-room laws + CTAs
│   ├── contact.spec.ts          # /contact composer, validation, success
│   ├── login.spec.ts            # /login single Log in button + signed-in forms
│   ├── donate.spec.ts           # /donate Send help explainer + home CTA
│   ├── i18n.spec.ts             # Accept-Language + locale cookie switcher
│   ├── functions.spec.ts        # Playwright Function: <Name> tests through Next
│   ├── messages.spec.ts         # Inbox HTML /messages vs public /messages/[id]
│   ├── proxy.spec.ts            # Same-origin api proxy round-trips against the stub
│   ├── view.spec.ts             # /view/[viewKey] public profile + profile view-key copy
│   ├── mock-api.mjs             # Local 21.gifts api protocol stub for proxies
│   ├── visual.spec.ts           # Linux Chromium screenshot baselines (single source for handbook images)
│   └── visual.spec.ts-snapshots/
├── public/                      # Static assets served from /
│   ├── sw.js                    # Push-only service worker (no cache/offline in v1)
│   └── handbook-images/         # Built from visual baselines (gitignored *.png; keep .gitkeep)
├── next.config.ts               # output: 'standalone'
├── vitest.config.ts             # 100% coverage threshold
├── playwright.config.ts         # chromium; mock api :3001 + standalone :3000
├── eslint.config.mjs            # Flat config (next/core-web-vitals + next/typescript)
├── Dockerfile                   # Multi-stage build + entrypoint.sh env substitution
├── entrypoint.sh
├── README.md
├── CONTRIBUTING.md
├── Review.md                 # PR review checklist
├── SECURITY.md
└── LICENSE
```

## Git workflow

### Branches

| Branch    | Purpose                            | Deploy target |
| --------- | ---------------------------------- | ------------- |
| `develop` | Default branch, active development | DEV           |
| `main`    | Production releases                | PRD           |

- Push to `develop` via **feature branch + PR**
- `main` is protected — updates flow via an auto-generated Release PR (`develop → main`)
- Never force-push, never amend published commits

### Commit messages

English, concise, describe _what_ changed.

```
# Good
Add /healthz route handler
Wire pay-on-note invoice sheet
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
  `process.env` directly in components. Accessors throw on missing values; no
  silent fallbacks.

### Styling

- **Tailwind CSS only.** No CSS files beyond `src/app/globals.css`, no CSS
  modules, no styled-components, no inline `style` attributes.
- Utility classes live directly on the JSX elements.
- Visual language (shells, tokens, type, chrome, control grammar) lives in
  `docs/ui.md`. New or migrated surfaces compose those parts. Raw
  `rounded-full bg-app-btn` (or `bg-neutral-900`) outside primitives on a
  new or migrated surface is an undeclared deviation.

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
catalogize): legal body copy (English), handbook markdown bodies and handbook
chapter-navigation labels (English), product tokens such as
`Wallet of Satoshi` / `GitHub`, language-switcher endonym labels (`English` /
`Deutsch` / `Español` / `Filipino`), stats body copy (English), and
document/social metadata (`title`, `description`, Open Graph alt text —
English).

### Icon controls (hard requirement)

The labeled vs icon-only table in `docs/ui.md` (control grammar) is the
**target**. New work follows that table, not “everything new is an icon”.

| Labeled (`Button` / `ButtonLink`)                                                                                                                                                                                                                                                                                                               | Icon-only (`IconButton`, required `aria-label`)                                                                                                                                                                                             |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Consent (**I agree to these rules**), **Continue**, **Skip** (onboarding name/address only), **Log in**, **Log out**, **Try again**, **Activate**, sentence-length links (**Open Wallet of Satoshi**, **Open the forum**, **Open the app**, **Back home**, **Ask for help**, **Send help**), marketing-shell primary, donate **Open the forum** | Actions **inside** a card: edit, delete, attach, send/post (forum + contact + inbox composers), copy, dismiss, **pay**, push bell, profile back, rules-setup back, inbox thread back, Menu **row** icons (the Menu _trigger_ stays labeled) |

Tests locate icon **buttons** with `getByRole('button', { name })` against
the catalog `aria-label` and assert `queryByText` for the visible catalog
string is `null`. Icon **links** use `getByRole('link', { name })`.
Non-interactive indicators (given/received arrows) use `aria-label` on the
glyph, not a button role.

A **new** control that is labeled when the table says icon-only (or
icon-only when the table says labeled) is an undeclared deviation.

The signed-in **Menu** trigger stays labeled (icon plus visible Menu word).
**Log out**, **Continue**, **I agree to these rules**,
**Activate**, **Try again**, and sentence-length links stay
labeled.

Reviewers follow `Review.md` and `docs/ui.md`.

### Payment QR vs deep links (hard requirement)

Desktop computers (MacBook and other non-phone devices) show a Bitcoin
payment QR **and** the Wallet of Satoshi deep-link CTA. The QR exists so
a different device can scan it.

Smartphones must **never** render a payment QR. On a phone the pay sheet
uses Wallet of Satoshi deep links only (`walletofsatoshi:` on iOS,
Android Intent on Android). A QR on the same screen the visitor would
need to scan it with is forbidden.

Detect smartphones with `isSmartphoneUserAgent` on `navigator.userAgent`
(iPhone, iPod, or Android **with** `Mobile`). Do **not** use viewport
width: a narrow MacBook window is still a desktop and still shows the QR.
iPad is not a smartphone.

`ForumBoard` is the current pay sheet. Any new pay UI follows the same
split. Mounting `QrCode` (or any payment QR) on a smartphone UA is an
undeclared deviation and is rejected. Reviewers follow `Review.md`.

### Handbook (hard requirement)

The handbook under `docs/handbook/` **must exist**. Every UI screen, every
exported function/class in `src/`, and every HTTP endpoint **must** have a
complete section:

- Screens: `## Screen: /path` (one per `src/app/**/page.tsx`, plus `/404` from `not-found.tsx`)
- Screen variants: `### Variant: id` (one per **distinct UI state** of that
  screen; the list in `scripts/screen-variants.mjs` is the source of truth.
  Omitting a state from the list is an undeclared deviation)
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
`toHaveScreenshot('screen-…png')` (via `shotScreen`) in `e2e/visual.spec.ts`.
Visual specs run in four projects (`desktop-light`, `desktop-dark`,
`mobile-light`, `mobile-dark`) so each shot is stored as
`${arg}-${combo}-linux.png`. Handbook Markdown keeps `images/<name>.png`
references; those bytes are filled into `public/handbook-images/` by
`npm run handbook:images` / `prebuild` / `predev` from the desktop-light
baseline when that combo is allowed for the variant, otherwise from the
variant’s first listed combo. Do not commit PNGs under
`docs/handbook/images/` or `public/handbook-images/`.

Every **distinct UI state** of every screen **must** be listed in
`scripts/screen-variants.mjs`. Omitting a state from that list is an undeclared
deviation and is rejected. `/setup/rules` is one screen with **one state per
living-room rules chapter** (`RULES_CHAPTER_IDS` in `src/lib/rules-chapters.ts`);
each chapter is a variant. Viewport and theme are combo shots of those
variants, not a substitute for a missing chapter.

Every listed variant **must** have, in the **same PR**:

- a handbook `### Variant: id` with `![…](images/<image>)`
- its `needle` string in `e2e/`
- `shotScreen` / `toHaveScreenshot('<visual>')` in `e2e/visual.spec.ts`
- a Playwright Linux baseline for **each** combo in `BASELINE_COMBOS` (or the
  variant’s `combos` list): `${visual}-${combo.id}-linux.png`

Default screen shots use the `screen-…` args; extra states use `state-…` args.
Restrict `combos` only when the UI cannot exist (hamburger nav on desktop,
payment QR on a smartphone, smartphone pay sheet on desktop).

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

| Variable              | DEV                        | PRD                    |
| --------------------- | -------------------------- | ---------------------- |
| `NEXT_PUBLIC_API_URL` | `https://dev-api.21.gifts` | `https://api.21.gifts` |

`NEXT_PUBLIC_API_URL` is the **upstream api**. The browser calls same-origin
paths (`/auth/passkey/…`, `/me`, …) which the App Router proxies to that URL.

## CI / CD

| Workflow               | Trigger                                    | Action                                                                                                                                                                                       |
| ---------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ci.yaml`              | PR (including drafts); `workflow_dispatch` | Check (typecheck, lint, handbook, e2e-check, screenshots, test (100% coverage), build on Node 22) + E2E (behavior) + four visual combo jobs; **10 minutes each**; Playwright `v1.61.1-noble` |
| `deploy-dev.yaml`      | push to `develop`                          | Docker build → push `21gifts/app:beta` → notify infrastructure                                                                                                                               |
| `deploy-prd.yaml`      | push to `main`                             | Docker build → push `21gifts/app:latest` → notify infrastructure                                                                                                                             |
| `auto-release-pr.yaml` | push to `develop`                          | Auto-create Release PR (`develop → main`)                                                                                                                                                    |

Images target `linux/arm64`.

Deploy workflows require these GitHub Actions secrets:

| Secret            | Purpose                                             |
| ----------------- | --------------------------------------------------- |
| `DOCKER_USERNAME` | Docker Hub username for image push                  |
| `DOCKER_PASSWORD` | Docker Hub token for image push                     |
| `DISPATCH_TOKEN`  | PAT used to fire `repository_dispatch` after push   |
| `DISPATCH_REPO`   | Target `owner/repo` that receives `image-published` |

If `DISPATCH_TOKEN` or `DISPATCH_REPO` is missing, notify warns and exits 0 —
the image is already on Hub; DFXServer `probe-published-images.yml` dispatches
`image-published` when the tag moves. Set the secrets for an immediate pull.

## Related repos

- [`21gifts/api`](https://github.com/21gifts/api) — Backend service + canonical project docs
