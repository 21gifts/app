import { startSpan, type Breadcrumb, type ErrorEvent, type Event } from '@sentry/nextjs';
import {
  getAppVersion,
  getSentryDsn,
  getSentryEnvironment,
  getSentryTracesSampleRate,
} from '@/lib/config';

/**
 * Error reporting (Sentry): init options, the privacy scrubber, the wallet
 * span helper, and the same-origin tunnel.
 *
 * Everything comes from the environment (`getSentryDsn`,
 * `getSentryEnvironment`, `getSentryTracesSampleRate`, `getAppVersion`).
 * Without a valid DSN, {@link sentryOptions} returns `null`, the init files
 * never call `init`, {@link traceWallet} only runs its work, and
 * {@link forwardSentryEnvelope} answers 404. Errors, plus sampled performance
 * traces from the browser; the server sends errors only. No sessions, replay,
 * profiling, logs, or feedback.
 */

/** Same-origin path the browser posts its envelopes to. */
export const SENTRY_TUNNEL_PATH = '/monitoring';

/**
 * Largest envelope the tunnel forwards: one error or one transaction, no
 * attachments. The Sentry server accepts no larger event either.
 */
const MAX_ENVELOPE_BYTES = 1024 * 1024;

/**
 * Span data keys that describe page elements (web vitals: the LCP element and
 * its image URL, the CLS sources). Their DOM text can hold a member's name.
 */
const ELEMENT_DATA_KEY = /^(?:browser\.web_vital\.)?(?:lcp\.(?:element|url|id)|cls\.source\.\d+)$/;

/** First absolute http(s) origin in a text, such as a span description. */
const ABSOLUTE_ORIGIN = /\bhttps?:\/\/[^\s/?#"'<>]+/i;

/** Envelope item types the tunnel forwards: errors and transactions. */
const FORWARDED_ITEM_TYPES = new Set(['event', 'transaction']);

/** Share of browser traces sent when `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` is unset or invalid. */
const DEFAULT_TRACES_SAMPLE_RATE = 0.1;

/** Replacement for every removed value. */
const FILTERED = '[Filtered]';

/** Deepest nesting the scrubber walks. Anything deeper is replaced. */
const MAX_DEPTH = 12;

/** Default integrations that send more than errors, or more than we allow. */
const DROPPED_INTEGRATIONS = new Set([
  'BrowserSession',
  'ProcessSession',
  'LocalVariablesAsync',
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
  'query',
  'fragment',
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
  // Base-chain (bech32) addresses; longer than a 32-digit trace id.
  [/\b(?:bc|tb|bcrt)1[02-9ac-hj-np-z]{36,87}\b/gi, FILTERED],
  // Keys, hashes, preimages, view keys: 64 or more hex digits.
  [/\b[0-9a-f]{64,}\b/gi, FILTERED],
  // Bearer tokens.
  [/\bBearer\s+[^\s"',;]+/gi, `Bearer ${FILTERED}`],
  // The stored session token written next to its storage key.
  [/(21gifts\.session["'\s:=]+)[^\s"',;]+/g, `$1${FILTERED}`],
  // Query string and fragment of absolute URLs and paths.
  [/((?:\b[a-z][a-z0-9+.-]*:\/\/|\/)[^\s?#"'<>]*)[?#][^\s"'<>]*/gi, '$1'],
];

/**
 * Fixed names of the wallet steps that get their own trace span. A name never
 * carries member data.
 */
export type WalletSpanName =
  | 'wallet.sdk.load'
  | 'wallet.connect'
  | 'wallet.sync.first'
  | 'wallet.balance'
  | 'wallet.prepare'
  | 'wallet.send'
  | 'wallet.address.register'
  | 'wallet.passkey';

/**
 * The only attributes a wallet span carries: fixed words, never an amount,
 * invoice, address, key, phrase, PRF output, or token.
 */
export type WalletSpanAttributes = {
  /** How a payment travels. */
  route?: 'spark' | 'lightning' | 'onchain';
  /** Which passkey prompt opened the wallet. */
  prompt?: 'login' | 'unlock';
};

/** A transaction event, as `beforeSendTransaction` receives it. */
type TransactionEvent = Event & { type: 'transaction' };

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
  tracesSampleRate: number;
  tracesSampler: () => number;
  traceLifecycle: 'static';
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
  beforeSendTransaction: (event: TransactionEvent) => TransactionEvent;
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

/** Request block of an error or transaction event. */
type EventRequest = NonNullable<ErrorEvent['request']>;

/**
 * Request block of an event reduced to method, URL path, and two headers.
 * Cookies, body, query string, and env are dropped.
 *
 * @param request - The event request block.
 * @returns The reduced block.
 */
function scrubRequest(request: EventRequest): EventRequest {
  const reduced: EventRequest = {};
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
 * Event filter for errors and transactions: user and request details are
 * reduced, stack frame variables are removed, breadcrumbs are filtered again,
 * and every remaining string is scrubbed. In a transaction that covers its
 * name, span descriptions, and span data, so URLs there lose their query
 * string and fragment.
 *
 * @param event - Error or transaction event about to be sent.
 * @returns The scrubbed event.
 */
function scrubEvent<T extends ErrorEvent | TransactionEvent>(event: T): T {
  const copy: T = { ...event };
  delete copy.user;
  // The SDK reads only these two after this filter; the rest are live SDK objects.
  if (copy.sdkProcessingMetadata !== undefined) {
    const { dynamicSamplingContext, spanCountBeforeProcessing } = copy.sdkProcessingMetadata;
    copy.sdkProcessingMetadata = {
      ...(dynamicSamplingContext === undefined ? {} : { dynamicSamplingContext }),
      ...(spanCountBeforeProcessing === undefined ? {} : { spanCountBeforeProcessing }),
    };
  }
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
  return scrubValue(copy, 0) as T;
}

/** One span of a transaction event. */
type TransactionSpan = NonNullable<TransactionEvent['spans']>[number];

/**
 * Origin of a URL, or `null` when it is not an absolute URL.
 *
 * @param url - URL text.
 * @returns `scheme://host[:port]`, or `null`.
 */
function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * Whether a span reaches a host other than the page's own: a request or
 * resource on another origin, such as a receiver's Lightning address server
 * the wallet asks, whose path can name that receiver or an address.
 *
 * @param span - Span of a transaction.
 * @param pageOrigin - Origin of the page, or `null` when unknown.
 * @returns `true` when the span names another origin, or any absolute URL
 * while the page origin is unknown.
 */
function isForeignSpan(span: TransactionSpan, pageOrigin: string | null): boolean {
  const data = span.data;
  // Resource spans flag the origin (`url.same_origin` is the older name).
  if (data['http.request.same_origin'] === false || data['url.same_origin'] === false) {
    return true;
  }
  return [data['url.full'], data['http.url'], data['url'], span.description].some((value) => {
    const match = typeof value === 'string' ? ABSOLUTE_ORIGIN.exec(value) : null;
    return match !== null && (pageOrigin === null || originOf(match[0]) !== pageOrigin);
  });
}

/**
 * Span data without the element descriptors of web vitals.
 *
 * @param data - Span or trace data.
 * @returns A copy without those keys.
 */
function withoutElements<D extends Record<string, unknown>>(data: D): D {
  return Object.fromEntries(
    Object.entries(data).filter(([key]) => !ELEMENT_DATA_KEY.test(key)),
  ) as D;
}

/**
 * Transaction filter: the event filter, after spans that reach another origin,
 * web-vital element descriptors, and breadcrumbs are removed. A transaction
 * needs none of them to show where time goes, and click breadcrumbs carry
 * control labels such as the digits of a typed amount.
 *
 * @param event - Transaction event about to be sent.
 * @returns The scrubbed transaction.
 */
function scrubTransaction(event: TransactionEvent): TransactionEvent {
  const copy: TransactionEvent = { ...event };
  delete copy.breadcrumbs;
  const pageOrigin = originOf(copy.request?.url ?? '');
  if (copy.spans !== undefined) {
    copy.spans = copy.spans
      .filter((span) => !isForeignSpan(span, pageOrigin))
      .map((span) => ({ ...span, data: withoutElements(span.data) }));
  }
  const trace = copy.contexts?.trace;
  if (trace?.data !== undefined) {
    copy.contexts = { ...copy.contexts, trace: { ...trace, data: withoutElements(trace.data) } };
  }
  return scrubEvent(copy);
}

/**
 * Init options for one runtime, or `null` when error reporting is off.
 *
 * Off when `NEXT_PUBLIC_SENTRY_DSN` is unset, empty, or not a DSN. The browser
 * posts through {@link SENTRY_TUNNEL_PATH}; the server and edge runtimes send
 * directly. Release is the app version. The browser sends the share
 * `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` (default 0.1) of its page loads,
 * navigations, and wallet steps as transactions; the server sends none. No
 * request carries trace headers.
 *
 * @param runtime - `browser`, or `server` for the Node.js and edge runtimes.
 * @returns Options for `Sentry.init`, or `null`.
 */
export function sentryOptions(runtime: 'browser' | 'server'): SentryInitOptions | null {
  const dsn = getSentryDsn();
  if (parseSentryDsn(dsn) === null) {
    return null;
  }
  const tracesSampleRate =
    runtime === 'browser' ? (getSentryTracesSampleRate() ?? DEFAULT_TRACES_SAMPLE_RATE) : 0;
  const options: SentryInitOptions = {
    dsn: dsn as string,
    release: getAppVersion(),
    tracesSampleRate,
    // The page's trace meta tags come from the server, which samples nothing.
    // The rate alone decides, so a page load does not inherit that "no".
    tracesSampler: () => tracesSampleRate,
    // Whole transactions, so `beforeSendTransaction` sees every span before it is sent.
    traceLifecycle: 'static',
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
    beforeSendTransaction: scrubTransaction,
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
 * Time one wallet step as its own trace span (its own transaction, in the
 * page's trace), so a slow step on a phone shows up without stretching the
 * page load around it. The name and attributes are fixed words only. Without
 * error reporting, or when the trace is not sampled, it only runs `work`. A
 * rejection marks the span as failed and is passed on unchanged.
 *
 * @param name - Which wallet step this is.
 * @param work - The step.
 * @param attributes - Fixed words that tell routes or prompts apart.
 * @returns What `work` resolves to.
 * @throws What `work` rejects with.
 */
export function traceWallet<T>(
  name: WalletSpanName,
  work: () => Promise<T>,
  attributes: WalletSpanAttributes = {},
): Promise<T> {
  return startSpan({ name, op: 'wallet', attributes, parentSpan: null }, work);
}

/**
 * Types of the items after an envelope's header line. An item header with a
 * `length` is followed by that many payload bytes; otherwise the payload ends
 * at the next newline.
 *
 * @param envelope - Raw envelope bytes.
 * @returns The item types in order, or `null` when an item header is broken.
 */
function envelopeItemTypes(envelope: Uint8Array): string[] | null {
  const types: string[] = [];
  const headerEnd = envelope.indexOf(0x0a);
  let offset = headerEnd < 0 ? envelope.length : headerEnd + 1;
  while (offset < envelope.length) {
    const lineEnd = envelope.indexOf(0x0a, offset);
    const end = lineEnd < 0 ? envelope.length : lineEnd;
    const line = envelope.subarray(offset, end);
    offset = end + 1;
    if (line.length === 0) {
      continue;
    }
    let header: unknown;
    try {
      header = JSON.parse(new TextDecoder().decode(line));
    } catch {
      return null;
    }
    const { type, length } = (header ?? {}) as { type?: unknown; length?: unknown };
    if (typeof type !== 'string') {
      return null;
    }
    types.push(type);
    if (typeof length === 'number') {
      if (!Number.isInteger(length) || length < 0 || offset + length > envelope.length) {
        return null;
      }
      offset += length + 1;
    } else {
      const payloadEnd = envelope.indexOf(0x0a, offset);
      offset = payloadEnd < 0 ? envelope.length : payloadEnd + 1;
    }
  }
  return types;
}

/**
 * Whether the tunnel may forward an envelope: at least one item, and only
 * errors and transactions.
 *
 * @param envelope - Raw envelope bytes.
 * @returns `true` when every item is an error or a transaction.
 */
function forwardsItems(envelope: Uint8Array): boolean {
  const types = envelopeItemTypes(envelope);
  return (
    types !== null && types.length > 0 && types.every((type) => FORWARDED_ITEM_TYPES.has(type))
  );
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
 * Read a request body, stopping as soon as it grows past the size limit.
 *
 * @param request - Incoming request.
 * @returns The body bytes, or `null` when it is larger than
 * {@link MAX_ENVELOPE_BYTES}.
 */
async function readCappedBody(request: Request): Promise<Uint8Array<ArrayBuffer> | null> {
  if (request.body === null) {
    return new Uint8Array();
  }
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    size += value.byteLength;
    if (size > MAX_ENVELOPE_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

/**
 * `POST /monitoring`: forward one browser envelope to the configured Sentry
 * project, so reports are not lost to content blockers.
 *
 * Forwards only when the envelope header names the configured DSN's host and
 * project and every item is an error or a transaction; nothing else can be
 * relayed. The visitor's IP address, cookies, and headers are not passed on.
 *
 * @param request - Incoming envelope POST.
 * @returns 404 when error reporting is off, 413 when larger than 1 MiB (by
 * `Content-Length`, or while reading, before the whole body is buffered), 400 when the
 * envelope names another DSN, has no item, or has an item that is neither an
 * error nor a transaction, 502 when the Sentry server cannot be reached,
 * otherwise the upstream status with an empty body.
 */
export async function forwardSentryEnvelope(request: Request): Promise<Response> {
  const target = parseSentryDsn(getSentryDsn());
  if (target === null) {
    return new Response(null, { status: 404 });
  }
  if (Number(request.headers.get('content-length')) > MAX_ENVELOPE_BYTES) {
    return new Response(null, { status: 413 });
  }
  const body = await readCappedBody(request);
  if (body === null) {
    return new Response(null, { status: 413 });
  }
  const named = envelopeDsn(body);
  if (
    named === null ||
    named.host !== target.host ||
    named.projectId !== target.projectId ||
    !forwardsItems(body)
  ) {
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
