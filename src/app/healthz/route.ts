/**
 * `GET /healthz` — liveness probe, mirroring the api's `/healthz` semantics.
 *
 * Consumers (the Docker HEALTHCHECK, container orchestrators, CI smoke tests)
 * treat HTTP 200 and `status === 'ok'` as the liveness signal; anything else
 * counts as unhealthy. Returns immediately with no I/O so probes can run
 * aggressively.
 */
export function GET(): Response {
  return Response.json({ status: 'ok' }, { status: 200 });
}
