# 21.gifts app handbook

This handbook is **mandatory**. Every exported function, every UI screen, and
every HTTP endpoint in this repository must have a section here. CI
(`npm run handbook:check`) fails the PR if a heading is missing or the section
is a stub.

- Screens: `## Screen: /path`
- Screen variants: `### Variant: id` under each screen (every distinct UI state)
- Functions: `## Function: name`
- Endpoints: `## Endpoint: METHOD /path`

Do not merge a PR that adds a screen, export, or endpoint without updating this
handbook in the same PR. Undeclared gaps are rejected, not discussed.

Every screen **variant** needs a Playwright Linux baseline under
`e2e/visual.spec.ts-snapshots/` (named from the variant’s `visual` field in
`scripts/screen-variants.mjs`). Markdown keeps `images/<file>.png` references;
those bytes are copied to `public/handbook-images/` by
`npm run handbook:images` / `prebuild` / `predev` from the baselines. Do not
commit PNGs under `docs/handbook/images/`. Default screens plus every exported
function also need a Playwright Linux baseline.
`npm run screenshot:check` fails the PR when a baseline is missing.

See [screens.md](screens.md), [functions.md](functions.md), and
[endpoints.md](endpoints.md).
