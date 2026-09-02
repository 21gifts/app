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

Every screen **variant** needs Playwright Linux Chromium baselines for each
combo in `BASELINE_COMBOS` (desktop/mobile × light/dark), named
`${visual}-${combo.id}-linux.png`, except UI that cannot exist (header
hamburger on desktop, payment QR on a smartphone, smartphone pay sheet on
desktop). Exported **functions** need a `## Function:` section and an e2e
`Function:` needle, not a screenshot of that markdown. Markdown keeps
`images/<file>.png` references; those bytes are copied to
`public/handbook-images/` by `npm run handbook:images` / `prebuild` /
`predev` from the desktop-light baseline, or the variant’s first listed combo
when desktop-light is not allowed. Do not commit PNGs under
`docs/handbook/images/`.
`npm run screenshot:check` fails the PR when a baseline is missing.

See [screens.md](screens.md), [functions.md](functions.md), and
[endpoints.md](endpoints.md).
