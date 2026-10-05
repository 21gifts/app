import type { Breadcrumb, ErrorEvent } from '@sentry/nextjs';
import { getAppVersion, getSentryDsn, getSentryEnvironment } from '@/lib/config';

/**
 * Error reporting (Sentry): init options, the privacy scrubber, and the
 * same-origin tunnel.
 *
 * Everything comes from the environment (`getSentryDsn`,
 * `getSentryEnvironment`, `getAppVersion`). Without a valid DSN,
 * {@link sentryOptions} returns `null`, the init files never call `init`, and
 * {@link forwardSentryEnvelope} answers 404. Errors only: no tracing,
 * sessions, replay, profiling, or feedback.
 */

/** Same-origin path the browser posts its error envelopes to. */
export const SENTRY_TUNNEL_PATH = '/monitoring';

/** Largest envelope the tunnel forwards (errors only, no attachments). */
const MAX_ENVELOPE_BYTES = 1024 * 1024;

/** Replacement for every removed value. */
const FILTERED = '[Filtered]';

/** Deepest nesting the scrubber walks. Anything deeper is replaced. */
const MAX_DEPTH = 12;

/** Default integrations that send more than errors, or more than we allow. */
const DROPPED_INTEGRATIONS = new Set([
  'BrowserSession',
  'BrowserTracing',
  'ProcessSession',
  'LocalVariables',
  'Console',
  'CaptureConsole',
  'ConsoleLogs',
]);

/** Keys whose value is always removed, compared lower-case and exactly. */
const SENSITIVE_KEYS = new Set(['pr', 'words', '21gifts.session']);

/** Key fragments whose value is always removed, compared lower-case. */
const SENSITIVE_KEY_PARTS = [
  'mnemonic',
  'phrase',
  'seed',
  'prf',
  'token',
  'secret',
  'invoice',
  'password',
  'authorization',
  'cookie',
];

/** Request headers kept on an event. Everything else is dropped. */
const ALLOWED_HEADERS = new Set(['user-agent', 'referer']);

/** Breadcrumb categories of network requests. */
const REQUEST_CATEGORIES = new Set(['fetch', 'xhr', 'http']);

/** Valid BIP-39 phrase lengths. */
const PHRASE_LENGTHS = new Set([12, 15, 18, 21, 24]);

/** One word of 3 to 8 letters (the BIP-39 English word shape, any case). */
const WORD = /^[a-z]{3,8}$/i;

/** Value patterns, in order. Each match is replaced as given. */
const REDACTIONS: ReadonlyArray<readonly [RegExp, string]> = [
  // 12 or more BIP-39-shaped words in a row (space, comma, or quote separated).
  [/\b[a-z]{3,8}(?:[\s,"']+[a-z]{3,8}){11,}\b/gi, FILTERED],
  // BOLT11 invoices and LNURL strings.
  [/\b(?:lnbc|lntb|lnurl)[0-9a-z]{10,}/gi, FILTERED],
  // Spark addresses.
  [/\bspark(?:rt)?1[0-9a-z]{10,}/gi, FILTERED],
  // Keys, hashes, preimages, view keys: 64 or more hex digits.
  [/\b[0-9a-f]{64,}\b/gi, FILTERED],
  // Bearer tokens.
  [/\bBearer\s+[^\s"',;]+/gi, `Bearer ${FILTERED}`],
  // The stored session token written next to its storage key.
  [/(21gifts\.session["'\s:=]+)[^\s"',;]+/g, `$1${FILTERED}`],
  // Query string and fragment of absolute URLs and paths.
  [/((?:\b[a-z][a-z0-9+.-]*:\/\/|\/)[^\s?#"'<>]*)[?#][^\s"'<>]*/gi, '$1'],
];

/** The parts of a DSN the SDK and the tunnel need. */
interface SentryDsn {
  /** `host[:port]` of the Sentry server. */
  host: string;
  /** Numeric project id. */
  projectId: string;
  /** Envelope endpoint of that project. */
  envelopeUrl: string;
}

/** Init options shared by the browser, server, and edge runtimes. */
export interface SentryInitOptions {
  dsn: string;
  release: string;
  environment?: string;
  tunnel?: string;
  tracesSampleRate: 0;
  tracePropagationTargets: string[];
  sendClientReports: false;
  includeLocalVariables: false;
  maxBreadcrumbs: number;
  dataCollection: {
    userInfo: false;
    cookies: false;
    httpHeaders: { request: { allow: string[] }; response: false };
    httpBodies: [];
    urlQueryParams: false;
    graphQL: { document: false; variables: false };
    genAI: { inputs: false; outputs: false };
    databaseQueryData: false;
    queues: false;
    stackFrameVariables: false;
  };
  integrations: <T extends { name: string }>(defaults: T[]) => T[];
  beforeSend: (event: ErrorEvent) => ErrorEvent;
  beforeBreadcrumb: (breadcrumb: Breadcrumb) => Breadcrumb | null;
}

/**
 * Parse a DSN (`https://key@host[:port][/prefix]/projectId`).
 *
 * @param value - DSN text, or `null` when none is configured.
 * @returns Host, project id, and envelope URL, or `null` when not a DSN
 * (including an unsubstituted build placeholder).
 */
function parseSentryDsn(value: string | null): SentryDsn | null {
  if (value === null) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if ((url.protocol !== 'https:' && url.protocol !== 'http:') || url.username === '') {
    return null;
  }
  // An http(s) pathname always starts with `/`, so the last slash exists.
  const slash = url.pathname.lastIndexOf('/');
  const projectId = url.pathname.slice(slash + 1);
  if (!/^\d+$/.test(projectId)) {
    return null;
  }
  return {
    host: url.host,
    projectId,
    envelopeUrl: `${url.protocol}//${url.host}${url.pathname.slice(0, slash)}/api/${projectId}/envelope/`,
  };
}

/**
 * Whether the value under this key is always removed.
 *
 * @param key - Object key.
 * @returns `true` for secret-bearing keys.
 */
function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_KEYS.has(lower) || SENSITIVE_KEY_PARTS.some((part) => lower.includes(part));
}

/**
 * Apply every value pattern to one string.
 *
 * @param value - Any string from an event or breadcrumb.
 * @returns The string with secrets replaced and URL queries removed.
 */
function redactString(value: string): string {
  return REDACTIONS.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    value,
  );
}

/**
 * Whether an array looks like a recovery phrase split into words.
 *
 * @param items - Array to test.
 * @returns `true` for 12 to 24 words.
 */
function isWordList(items: unknown[]): boolean {
  return (
    PHRASE_LENGTHS.has(items.length) &&
    items.every((item) => typeof item === 'string' && WORD.test(item))
  );
}

/**
 * Deep copy of a value with secrets removed.
 *
 * @param value - Any JSON-like value.
 * @param depth - Current nesting depth.
 * @returns The scrubbed copy.
 */
function scrubValue(value: unknown, depth: number): unknown {
  if (typeof value === 'string') {
    return redactString(value);
  }
  if (typeof value !== 'object' || value === null) {
    return value;
  }
  // Raw bytes (keys, PRF output) are never readable data: drop them whole.
  if (depth >= MAX_DEPTH || ArrayBuffer.isView(value)) {
    return FILTERED;
  }
  if (Array.isArray(value)) {
    return isWordList(value) ? FILTERED : value.map((item) => scrubValue(item, depth + 1));
  }
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    out[key] = isSensitiveKey(key) ? FILTERED : scrubValue(item, depth + 1);
  }
  return out;
}

/**
 * Path of a URL, without origin, query, or fragment.
 *
 * @param url - Absolute or relative URL.
 * @returns The path with secrets replaced.
 */
function urlPath(url: string): string {
  return redactString(new URL(url, 'http://localhost').pathname);
}

/**
 * Network breadcrumb reduced to method, path, and status.
 *
 * @param breadcrumb - A `fetch`, `xhr`, or `http` breadcrumb.
 * @returns The reduced breadcrumb.
 */
function requestBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  const data = breadcrumb.data ?? {};
  const kept: Record<string, unknown> = {};
  if (typeof data['method'] === 'string') {
    kept['method'] = data['method'];
  }
  if (typeof data['url'] === 'string') {
    kept['url'] = urlPath(data['url']);
  }
  if (typeof data['status_code'] === 'number') {
    kept['status_code'] = data['status_code'];
  }
  const reduced: Breadcrumb = { data: kept };
  if (breadcrumb.type !== undefined) {
    reduced.type = breadcrumb.type;
  }
  if (breadcrumb.category !== undefined) {
    reduced.category = breadcrumb.category;
  }
  if (breadcrumb.level !== undefined) {
    reduced.level = breadcrumb.level;
  }
  if (breadcrumb.timestamp !== undefined) {
    reduced.timestamp = breadcrumb.timestamp;
  }
  return reduced;
}

/**
 * Breadcrumb filter: console crumbs are dropped, network crumbs keep method,
 * path, and status only, everything else is scrubbed.
 *
 * @param breadcrumb - Breadcrumb about to be recorded.
 * @returns The scrubbed breadcrumb, or `null` to drop it.
 */
function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  if (breadcrumb.category === 'console') {
    return null;
  }
  if (breadcrumb.category !== undefined && REQUEST_CATEGORIES.has(breadcrumb.category)) {
    return requestBreadcrumb(breadcrumb);
  }
  return scrubValue(breadcrumb, 0) as Breadcrumb;
}

/**
 * Request block of an event reduced to method, URL path, and two headers.
 * Cookies, body, query string, and env are dropped.
 *
 * @param request - The event request block.
 * @returns The reduced block.
 */
function scrubRequest(
  request: NonNullable<ErrorEvent['request']>,
): NonNullable<ErrorEvent['request']> {
  const reduced: NonNullable<ErrorEvent['request']> = {};
  if (request.method !== undefined) {
    reduced.method = request.method;
  }
  if (request.url !== undefined) {
    reduced.url = redactString(request.url);
  }
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(request.headers ?? {})) {
    if (ALLOWED_HEADERS.has(name.toLowerCase())) {
      headers[name] = redactString(value);
    }
  }
  reduced.headers = headers;
  return reduced;
}

/**
 * Event filter: user and request details are reduced, stack frame variables
 * are removed, breadcrumbs are filtered again, and every remaining string is
 * scrubbed.
 *
 * @param event - Error event about to be sent.
 * @returns The scrubbed event.
 */
function scrubEvent(event: ErrorEvent): ErrorEvent {
  const copy: ErrorEvent = { ...event };
  delete copy.user;
  if (copy.request !== undefined) {
    copy.request = scrubRequest(copy.request);
  }
  if (copy.breadcrumbs !== undefined) {
    copy.breadcrumbs = copy.breadcrumbs
      .map(scrubBreadcrumb)
      .filter((crumb): crumb is Breadcrumb => crumb !== null);
  }
  for (const exception of copy.exception?.values ?? []) {
    for (const frame of exception.stacktrace?.frames ?? []) {
      delete frame.vars;
    }
  }
  return scrubValue(copy, 0) as ErrorEvent;
}

/**
 * Init options for one runtime, or `null` when error reporting is off.
 *
 * Off when `NEXT_PUBLIC_SENTRY_DSN` is unset, empty, or not a DSN. The browser
 * posts through {@link SENTRY_TUNNEL_PATH}; the server and edge runtimes send
 * directly. Release is the app version.
 *
 * @param runtime - `browser`, or `server` for the Node.js and edge runtimes.
 * @returns Options for `Sentry.init`, or `null`.
 */
export function sentryOptions(runtime: 'browser' | 'server'): SentryInitOptions | null {
  const dsn = getSentryDsn();
  if (parseSentryDsn(dsn) === null) {
    return null;
  }
  const options: SentryInitOptions = {
    dsn: dsn as string,
    release: getAppVersion(),
    tracesSampleRate: 0,
    tracePropagationTargets: [],
    sendClientReports: false,
    includeLocalVariables: false,
    maxBreadcrumbs: 50,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: { request: { allow: [...ALLOWED_HEADERS] }, response: false },
      httpBodies: [],
      urlQueryParams: false,
      graphQL: { document: false, variables: false },
      genAI: { inputs: false, outputs: false },
      databaseQueryData: false,
      queues: false,
      stackFrameVariables: false,
    },
    integrations: (defaults) => defaults.filter((item) => !DROPPED_INTEGRATIONS.has(item.name)),
    beforeSend: scrubEvent,
    beforeBreadcrumb: scrubBreadcrumb,
  };
  const environment = getSentryEnvironment();
  if (environment !== null) {
    options.environment = environment;
  }
  if (runtime === 'browser') {
    options.tunnel = SENTRY_TUNNEL_PATH;
  }
  return options;
}

/**
 * DSN named in an envelope header (the first line of the envelope).
 *
 * @param envelope - Raw envelope bytes.
 * @returns The parsed DSN, or `null` when the header is missing or invalid.
 */
function envelopeDsn(envelope: Uint8Array): SentryDsn | null {
  const end = envelope.indexOf(0x0a);
  const header = new TextDecoder().decode(end < 0 ? envelope : envelope.subarray(0, end));
  try {
    const parsed: unknown = JSON.parse(header);
    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }
    const dsn = (parsed as { dsn?: unknown }).dsn;
    return typeof dsn === 'string' ? parseSentryDsn(dsn) : null;
  } catch {
    return null;
  }
}

/**
 * `POST /monitoring`: forward one browser envelope to the configured Sentry
 * project, so reports are not lost to content blockers.
 *
 * Forwards only when the envelope header names the configured DSN's host and
 * project; nothing else can be relayed. The visitor's IP address, cookies, and
 * headers are not passed on.
 *
 * @param request - Incoming envelope POST.
 * @returns 404 when error reporting is off, 413 when too large, 400 when the
 * envelope names another DSN, 502 when the Sentry server cannot be reached,
 * otherwise the upstream status with an empty body.
 */
export async function forwardSentryEnvelope(request: Request): Promise<Response> {
  const target = parseSentryDsn(getSentryDsn());
  if (target === null) {
    return new Response(null, { status: 404 });
  }
  const body = new Uint8Array(await request.arrayBuffer());
  if (body.byteLength > MAX_ENVELOPE_BYTES) {
    return new Response(null, { status: 413 });
  }
  const named = envelopeDsn(body);
  if (named === null || named.host !== target.host || named.projectId !== target.projectId) {
    return new Response(null, { status: 400 });
  }
  try {
    const upstream = await fetch(target.envelopeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-sentry-envelope' },
      body,
    });
    return new Response(null, { status: upstream.status });
  } catch {
    return new Response(null, { status: 502 });
  }
}
