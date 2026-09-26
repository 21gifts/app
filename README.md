# 21.gifts — app

Web frontend for [21.gifts](https://21.gifts) — marketing landing, about page,
legal page, handbook at `/handbook`, and the Bitcoin gift app on the public apex.

This repository carries only frontend-specific code and docs. The canonical
project documentation (concept, protocol, decisions) lives in
[`21gifts/api`](https://github.com/21gifts/api) —
[`CONCEPT.md`](https://github.com/21gifts/api/blob/develop/CONCEPT.md).

## Sunday rest (Asia/Manila)

Sunday 00:00 through Monday 00:00 is a single worldwide 24-hour rest period (UTC Saturday 16:00 through Sunday 16:00). Deploy the matching app, api and spend PRs together. The frontend includes the website and installed PWA; no separate native app code was found in these repositories.

The server rejects new application requests with 503, no-store and Retry-After. The technical `/healthz` liveness probe stays available to prevent restart loops during the planned pause. Static assets and the clock necessary to display/end the pause remain active.

No new background ticks or payouts start on Sunday. Work admitted before midnight may finish; an already submitted external payment cannot be cancelled. Payment reconciliation must remain durable. Already open obsolete app versions require a reload/update for the new message, but the API still rejects their requests.

This policy does not delete queued work or clear authentication. Normal processing resumes Monday; the existing payment eligibility/expiry rules still apply, so this does not promise catch-up payment for expired Sunday invoices.

Tests use an advancing clock preloaded only by Vitest and Playwright (`e2e/server-clock.mjs`). Normal scenarios start on a weekday; dedicated Sunday servers exercise the real HTTP gates. Production has no clock override.
