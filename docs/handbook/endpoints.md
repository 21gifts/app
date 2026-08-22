# HTTP endpoints (Next.js route handlers)

## Endpoint: GET /healthz

- **Purpose:** Liveness JSON `{ status: 'ok' }` from `src/app/healthz/route.ts`.
- **Errors:** None if the process is up (always 200).
- **Used by:** Container probes and Playwright smoke.
- **Auth:** Public.
