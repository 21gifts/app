/**
 * Allowlisted client diagnostic. Secrets, PRF output, and the recovery
 * phrase are never fields of this object.
 */
export interface DiagnosticReport {
  event: string;
  name?: string | undefined;
  message?: string | undefined;
  prfPresent?: boolean | undefined;
  challengeId?: string | undefined;
  accountId?: string | undefined;
  stage?: 'register' | 'authenticate' | 'seed' | 'login' | 'unhandled' | undefined;
  status?: number | undefined;
  path?: string | undefined;
}

const EVENT_RE = /^client\.[a-z0-9.]{1,60}$/;
const NAME_RE = /^[A-Za-z]{1,40}$/;
const MESSAGE_RE = /^[A-Za-z0-9._: -]{1,120}$/;
const CHALLENGE_ID_RE = /^[0-9a-f]{64}$/;
const ACCOUNT_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PATH_RE = /^\/[A-Za-z0-9/_-]{0,120}$/;
const HEX_RUN_RE = /[0-9a-f]{32,}/;
const STAGES = new Set(['register', 'authenticate', 'seed', 'login', 'unhandled']);

type DiagnosticBody = Record<string, string | number | boolean>;

function cleanedReport(report: DiagnosticReport): DiagnosticBody | undefined {
  if (!EVENT_RE.test(report.event)) {
    return undefined;
  }
  const body: DiagnosticBody = { event: report.event };
  if (report.name !== undefined && NAME_RE.test(report.name)) {
    body['name'] = report.name;
  }
  if (report.message !== undefined && MESSAGE_RE.test(report.message)) {
    body['message'] = report.message;
  }
  if (typeof report.prfPresent === 'boolean') {
    body['prfPresent'] = report.prfPresent;
  }
  if (report.challengeId !== undefined && CHALLENGE_ID_RE.test(report.challengeId)) {
    body['challengeId'] = report.challengeId;
  }
  if (report.accountId !== undefined && ACCOUNT_ID_RE.test(report.accountId)) {
    body['accountId'] = report.accountId;
  }
  if (report.stage !== undefined && STAGES.has(report.stage)) {
    body['stage'] = report.stage;
  }
  if (
    report.status !== undefined &&
    Number.isInteger(report.status) &&
    report.status >= 100 &&
    report.status <= 599
  ) {
    body['status'] = report.status;
  }
  if (report.path !== undefined && PATH_RE.test(report.path) && !HEX_RUN_RE.test(report.path)) {
    body['path'] = report.path;
  }
  return body;
}

/**
 * POST one allowlisted diagnostic. Drops fields that fail the pattern
 * instead of cutting them. Never throws. The caller does not await it.
 *
 * @param report - Event name plus optional scalars. Unsafe text is omitted.
 * @returns void
 */
export function reportDiagnostic(report: DiagnosticReport): void {
  const body = cleanedReport(report);
  if (body === undefined) {
    return;
  }
  void fetch('/diagnostics', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => undefined);
}
