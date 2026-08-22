# 21.gifts app handbook

This handbook is **mandatory**. Every exported function and every UI screen in
this repository must have a section here. CI (`npm run handbook:check`) fails
the PR if a heading is missing or the section is a stub.

- Screens: `## Screen: /path`
- Functions: `## Function: name`

Do not merge a PR that adds a screen or export without updating this handbook
in the same PR. Undeclared gaps are rejected, not discussed.

See [screens.md](screens.md) and [functions.md](functions.md).
