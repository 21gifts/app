Do not commit PNGs here. Handbook Markdown still uses `images/<file>.png`
for product-screen variants; the bytes come from Playwright Linux baselines
via `npm run handbook:images`. Handbook doc pages (`/handbook`,
`/handbook/screens`, `/handbook/functions`, `/handbook/endpoints`) have no
goldens: they are documentation, not product screens. `/handbook/screens`
shows those product goldens and is not itself a golden.
