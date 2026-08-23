# 21.gifts app handbook

This handbook is **mandatory**. Every exported function, every UI screen, and
every HTTP endpoint in this repository must have a section here. CI
(`npm run handbook:check`) fails the PR if a heading is missing or the section
is a stub.

- Screens: `## Screen: /path`
- Functions: `## Function: name`
- Endpoints: `## Endpoint: METHOD /path`

Do not merge a PR that adds a screen, export, or endpoint without updating this
handbook in the same PR. Undeclared gaps are rejected, not discussed.

Every screen also needs a committed screenshot under `docs/handbook/images/`
(and `public/handbook-images/`) plus a Playwright baseline. Every exported
function needs a Playwright baseline. `npm run screenshot:check` fails the PR
when either is missing.

See [screens.md](screens.md), [functions.md](functions.md), and
[endpoints.md](endpoints.md).
