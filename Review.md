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
- The four catalogs have the **same key set**, and every value is non-empty
  after trim. `npm run typecheck` fails on a missing key.
  `src/__tests__/lib/messages.test.ts` fails on a divergent key set or an
  empty/whitespace value. Both must pass.
- Do not approve a PR that adds a key to English (or any one locale) without
  the matching keys in the other three.

## Payment QR vs deep links

Reject the PR when the forum-post pay sheet or the public pay-link
invoice mounts its invoice QR on a smartphone user-agent, or when a
profile, member, public view, point of sale, or inbox QR is hidden on a
smartphone. Detection is `isSmartphoneUserAgent`, not viewport width.
On those invoice screens the phone opens Wallet of Satoshi and shows no
QR. Everywhere else the phone matches the desktop. See CONTRIBUTING.md
“Payment QR vs deep links”.

## Completeness gates

These must be green on the PR. A missing or red gate is rejected:

- `npm run typecheck`
- `npm run lint`
- `npm run handbook:check`
- `npm run e2e:check`
- `npm run screenshot:check`
- `npm run test:coverage`
- `npm run build`
- `npm run e2e` locally (behavior + four visual combos). CI splits that
  into `E2E (behavior)` plus `Visual (desktop-light|desktop-dark|mobile-light|mobile-dark)`;
  all must be green.

## Other CONTRIBUTING rules

Named exports, explicit return types, no `any`, no `console.log`, Tailwind
only, server components by default, TSDoc on exports, handbook / e2e /
screenshot baselines for new screenshot-gated screens/variants in the same PR
(handbook doc routes: `## Screen:` prose and e2e `page.goto` only). New controls
follow the labeled vs icon-only table in `docs/ui.md` and CONTRIBUTING
**Icon controls**. A new control that ignores the table is rejected.
