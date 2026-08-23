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

| Script                         | Purpose                                                                  |
| ------------------------------ | ------------------------------------------------------------------------ |
| `npm run dev`                  | Dev server with hot reload on :3000                                      |
| `npm run build`                | Production build (standalone output)                                     |
| `npm run start`                | Serve the production build on :3000                                      |
| `npm run typecheck`            | `tsc --noEmit`                                                           |
| `npm run lint`                 | `next lint` + Prettier check                                             |
| `npm run lint:fix`             | Auto-fix lint findings + Prettier write                                  |
| `npm run format`               | Prettier write                                                           |
| `npm test`                     | Vitest unit tests, single run                                            |
| `npm run test:watch`           | Vitest in watch mode                                                     |
| `npm run test:coverage`        | Vitest with the 100% coverage gate                                       |
| `npm run e2e`                  | Playwright tests against the production build                            |
| `npm run e2e:update-snapshots` | Rewrite Linux Chromium visual baselines                                  |
| `npm run e2e:check`            | Fail if a screen lacks `page.goto` or an endpoint lacks `request.<verb>` |
| `npm run screenshot:check`     | Fail if a screen or export lacks a Playwright PNG baseline               |
| `npm run handbook:check`       | Fail if any screen, export, or HTTP endpoint lacks a handbook section    |

## Project structure

```
app/
├── src/
│   ├── app/
│   │   ├── layout.tsx           # Root layout: <html lang="en">, metadata, globals.css
│   │   ├── (marketing)/         # Dark landing `/`, `/legal`, `/handbook`
│   │   ├── donate/
│   │   │   └── page.tsx         # GET /donate — guest LNURL-pay gift
│   │   ├── login/
│   │   │   └── page.tsx         # GET /login — LNURL-auth + signed-in form
│   │   ├── globals.css          # Tailwind entry — the only CSS file
│   │   └── healthz/
│   │       └── route.ts         # GET /healthz — container liveness probe
│   ├── components/
│   │   └── DonateForm.tsx       # Guest donate form (QR + lightning: invoice)
│   ├── lib/
│   │   ├── config.ts            # Typed NEXT_PUBLIC_* accessors (throw on missing)
│   │   └── lnurl-pay.ts         # Browser LNURL-pay invoice fetch
│   ├── types/
│   │   └── env.d.ts             # Ambient ProcessEnv typings
│   └── __tests__/               # Mirror tree; one *.test.ts(x) per source file
│       ├── app/
│       │   ├── layout.test.tsx
│       │   ├── page.test.tsx
│       │   └── healthz/route.test.ts
│       └── lib/config.test.ts
├── docs/handbook/               # Mandatory: every screen + exported function + endpoint
│   ├── README.md
│   ├── screens.md
│   ├── functions.md
│   ├── endpoints.md
│   └── images/                  # Screen PNGs (copied to public/handbook-images/)
├── scripts/
│   ├── check-handbook.mjs       # CI gate: missing heading (screen, function, or endpoint) → exit 1
│   ├── check-e2e.mjs            # CI gate: missing screen page.goto or endpoint request → exit 1
│   └── check-screenshots.mjs    # CI gate: missing screen/function Playwright PNG baseline → exit 1
├── e2e/
│   ├── smoke.spec.ts            # Playwright smoke tests (outside vitest scope)
│   ├── donate.spec.ts           # /donate form heading + submit button
│   ├── login.spec.ts            # /login WoS QR, lightning URI, copy LNURL
│   ├── visual.spec.ts           # Linux Chromium screenshot baselines
│   └── visual.spec.ts-snapshots/
├── public/                      # Static assets served from /
├── next.config.ts               # output: 'standalone'
├── vitest.config.ts             # 100% coverage threshold
├── playwright.config.ts         # chromium only, boots the production build
├── eslint.config.mjs            # Flat config (next/core-web-vitals + next/typescript)
├── Dockerfile                   # Multi-stage build + entrypoint.sh env substitution
├── entrypoint.sh
├── README.md
├── CONTRIBUTING.md
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
Wire donate button to LNURL-pay flow
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

### Handbook (hard requirement)

The handbook under `docs/handbook/` **must exist**. Every UI screen, every
exported function/class in `src/`, and every HTTP endpoint **must** have a
complete section:

- Screens: `## Screen: /path` (one per `src/app/**/page.tsx`)
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
- Playwright tests live in `e2e/` and run against the production build
  (`npm run e2e` builds and starts the server itself).

### E2E (hard requirement)

Every UI screen **must** have at least one Playwright test that `page.goto`s that
path and asserts a user-visible outcome. Every HTTP endpoint discovered from
`src/app/**/route.ts` **must** have at least one Playwright
`request.get|post|put|patch|delete` of that path. `npm run e2e:check` **fails
the PR** if a screen has no matching `goto` or an endpoint has no matching
`request.<verb>` call. Adding a `page.tsx` or `route.ts` without an e2e spec in
the **same PR** is an undeclared deviation and is rejected. CI runs `e2e:check`
then `e2e`.

### Screenshot baselines (hard requirement)

Every UI screen **must** have:

- a Playwright `toHaveScreenshot('screen-…png')` in `e2e/visual.spec.ts`
- a handbook image `docs/handbook/images/<name>.png` referenced from that
  screen's handbook section, copied to `public/handbook-images/`

Every exported function **must** have a Playwright baseline
`function-<Name>.png` (the handbook section on `/handbook`, clipped). Adding a
screen or export without updating the baselines in the **same PR** is rejected.
`npm run screenshot:check` (and CI) fails when a PNG is missing.

Baselines are **Linux Chromium** (same as CI). They are skipped on macOS so
`npm run e2e` still runs the behavioral specs. Regenerate on Linux:

```bash
docker run --rm -v "$PWD":/work -w /work \
  -e UPDATE_HANDBOOK_IMAGES=1 \
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
paths (`/auth/lnurl`, `/me`, …) which the App Router proxies to that URL.

## CI / CD

| Workflow               | Trigger           | Action                                                                                                                            |
| ---------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `ci.yaml`              | PR                | Typecheck + lint + handbook + e2e-check + screenshots + test (100% coverage) + build + e2e (Playwright `v1.61.1-noble` container) |
| `deploy-dev.yaml`      | push to `develop` | Docker build → push `21gifts/app:beta` → notify infrastructure                                                                    |
| `deploy-prd.yaml`      | push to `main`    | Docker build → push `21gifts/app:latest` → notify infrastructure                                                                  |
| `auto-release-pr.yaml` | push to `develop` | Auto-create Release PR (`develop → main`)                                                                                         |

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
