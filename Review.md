# Reviewing 21.gifts app PRs

Read `CONTRIBUTING.md` first. Reject the PR when any item below fails.

## i18n catalogs

Every visitor-facing UI string that is not a documented exception must be
present in **all** locale catalogs (`en`, `de`, `es`, `fil`) in
`src/lib/messages.ts`.

- New or changed copy uses a catalog key in the same PR — no hard-coded UI
  strings (except the documented exceptions in `CONTRIBUTING.md`: legal body
  copy (English), handbook markdown bodies and handbook chapter-navigation
  labels (English), product tokens, switcher endonyms, stats body copy
  (English), document/social metadata (English)).
- The four catalogs have the **same key set** (`npm run typecheck` fails on a
  missing key). Every value is non-empty after trim
  (`src/__tests__/lib/messages.test.ts` fails otherwise). Both must pass.
- Do not approve a PR that adds a key to English (or any one locale) without
  the matching keys in the other three.

## Completeness gates

These must be green on the PR. A missing or red gate is rejected:

- `npm run typecheck`
- `npm run lint`
- `npm run handbook:check`
- `npm run e2e:check`
- `npm run screenshot:check`
- `npm run test:coverage`
- `npm run build`
- `npm run e2e` (Linux Chromium for visual baselines)

## Other CONTRIBUTING rules

Named exports, explicit return types, no `any`, no `console.log`, Tailwind
only, server components by default, TSDoc on exports, handbook / e2e /
screenshot sections in the same PR as the new screen or export.
