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

Every screen **variant** also needs a committed screenshot under
`docs/handbook/images/` (and `public/handbook-images/`). Default screens plus
every exported function need a Playwright Linux baseline.
`npm run screenshot:check` fails the PR when either is missing. The variant
list lives in `scripts/screen-variants.mjs`.

See [screens.md](screens.md), [functions.md](functions.md), and
[endpoints.md](endpoints.md).
