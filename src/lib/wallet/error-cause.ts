/** Longest error name or code a report keeps. */
const IDENTIFIER_MAX_LENGTH = 64;

/** An error name: a class name ending in `Error` or `Exception` (`TypeError`, `DOMException`). */
const ERROR_NAME = /^(?:[A-Z][A-Za-z0-9]*)?(?:Error|Exception)$/;

/** An error's own code: a whole number or an upper-case constant (`ERR_CHUNK_LOAD`). */
const OWN_CODE = /^(?:\d{1,6}|[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*)$/;

/** The SDK's error kind: one to four lower-case words joined by `_` (`service_connectivity`). */
const SDK_KIND = /^[a-z]+(?:_[a-z]+){0,3}$/;

/** What ends the SDK's error kind at the start of its message (`Network error: …`). */
const SDK_KIND_END = ' error:';

/** Most characters of the SDK's error kind, before {@link SDK_KIND_END}. */
const SDK_KIND_MAX_LENGTH = 41;

/** Letters and spaces, the only characters of the SDK's error kind as written. */
const SDK_KIND_TEXT = /^[A-Za-z][A-Za-z ]*$/;

/**
 * Known harmless causes of a wallet that did not open. Only the identifier is
 * ever sent, never the text it was matched against; anything else is
 * `unknown`.
 */
export type CauseKind =
  | 'wasm_out_of_memory'
  | 'wasm_unreachable'
  | 'wasm_runtime'
  | 'chunk_load_failed'
  | 'fetch_failed'
  | 'storage_quota'
  | 'sdk_network'
  | 'sdk_service_connectivity'
  | 'sdk_storage'
  | 'timeout'
  | 'aborted'
  | 'unknown';

/**
 * One row of {@link CAUSE_KINDS}: every field it sets must match. `name` and
 * `code` are compared exactly with the error's own name and its code (the
 * error's `code`, or the SDK's error kind); `message` exactly with its
 * message, `messageStart` and `messageEnd` with the message's start and end.
 */
export interface CauseRule {
  kind: Exclude<CauseKind, 'unknown'>;
  name?: string;
  code?: string;
  message?: string;
  messageStart?: string;
  messageEnd?: string;
}

/**
 * The known harmless failures, in order; the first row that matches gives the
 * cause kind. Matching compares whole strings, a start, or an end only, so each
 * message is read in linear time and nothing is searched with a pattern.
 */
export const CAUSE_KINDS: readonly CauseRule[] = [
  { kind: 'wasm_out_of_memory', messageStart: 'WebAssembly.', messageEnd: ': out of memory' },
  { kind: 'wasm_out_of_memory', message: 'out of memory' },
  { kind: 'wasm_out_of_memory', message: 'Out of memory' },
  { kind: 'wasm_unreachable', name: 'RuntimeError', message: 'unreachable' },
  { kind: 'wasm_unreachable', name: 'RuntimeError', message: 'unreachable executed' },
  {
    kind: 'wasm_unreachable',
    name: 'RuntimeError',
    message: 'Unreachable code should not be executed',
  },
  { kind: 'wasm_unreachable', message: 'RuntimeError: unreachable' },
  { kind: 'wasm_runtime', name: 'RuntimeError' },
  { kind: 'chunk_load_failed', name: 'ChunkLoadError' },
  { kind: 'chunk_load_failed', messageStart: 'Failed to fetch dynamically imported module' },
  { kind: 'chunk_load_failed', messageStart: 'error loading dynamically imported module' },
  { kind: 'chunk_load_failed', message: 'Importing a module script failed.' },
  { kind: 'fetch_failed', message: 'Failed to fetch' },
  { kind: 'fetch_failed', message: 'NetworkError when attempting to fetch resource.' },
  { kind: 'fetch_failed', message: 'Load failed' },
  { kind: 'storage_quota', name: 'QuotaExceededError' },
  { kind: 'storage_quota', message: 'The quota has been exceeded.' },
  { kind: 'sdk_network', code: 'network' },
  { kind: 'sdk_service_connectivity', code: 'service_connectivity' },
  { kind: 'sdk_storage', code: 'storage' },
  { kind: 'timeout', name: 'TimeoutError' },
  { kind: 'aborted', name: 'AbortError' },
];

/**
 * Whether a rule of {@link CAUSE_KINDS} matches: each field it sets equals,
 * starts, or ends the error's own value.
 *
 * @param rule - The rule.
 * @param name - The error's own name, or `null`.
 * @param code - The error's code, or `null`.
 * @param message - The error's message, or `null`.
 * @returns Whether every field the rule sets matches.
 */
function matches(
  rule: CauseRule,
  name: string | null,
  code: string | null,
  message: string | null,
): boolean {
  return (
    (rule.name === undefined || rule.name === name) &&
    (rule.code === undefined || rule.code === code) &&
    (rule.message === undefined || rule.message === message) &&
    (rule.messageStart === undefined || message?.startsWith(rule.messageStart) === true) &&
    (rule.messageEnd === undefined || message?.endsWith(rule.messageEnd) === true)
  );
}

/**
 * The cause kind of an error: the first row of {@link CAUSE_KINDS} that
 * matches its name, code, and message, which are read here and never sent;
 * `unknown` when none does.
 *
 * @param name - The error's own name, or `null`.
 * @param code - The error's code, or `null`.
 * @param message - The error's message, or `null`.
 * @returns The cause kind.
 */
function causeKindOf(name: string | null, code: string | null, message: string | null): CauseKind {
  return CAUSE_KINDS.find((rule) => matches(rule, name, code, message))?.kind ?? 'unknown';
}

/**
 * The SDK's error kind at the start of its message: the letters and spaces
 * before the first ` error:` within its first {@link SDK_KIND_MAX_LENGTH}
 * characters, in lower case joined by `_` (`Network error: …` → `network`,
 * `Service connectivity error: …` → `service_connectivity`).
 *
 * @param message - The error's message.
 * @returns The kind, or `null`.
 */
function sdkKind(message: string): string | null {
  const end = message.slice(0, SDK_KIND_MAX_LENGTH + SDK_KIND_END.length).indexOf(SDK_KIND_END);
  if (end <= 0) {
    return null;
  }
  const kind = message.slice(0, end);
  return SDK_KIND_TEXT.test(kind) ? kind.toLowerCase().replace(/ /g, '_') : null;
}

/**
 * An error name or code that may be reported: a string, or a number written
 * out, of the given shape and at most {@link IDENTIFIER_MAX_LENGTH} characters.
 *
 * @param value - Candidate name or code.
 * @param shape - The shape it must have.
 * @returns The value as a string, or `null` when it may not be reported.
 */
function identifier(value: unknown, shape: RegExp): string | null {
  const text = typeof value === 'number' ? String(value) : value;
  if (typeof text !== 'string' || text.length > IDENTIFIER_MAX_LENGTH || !shape.test(text)) {
    return null;
  }
  return text;
}

/** What a report may say about a thrown value. */
export interface ErrorCause {
  /**
   * Error name (`TypeError`, `RuntimeError`, …), the type of a thrown value
   * that is not an object (`string`), or `unknown`.
   */
  errorName: string;
  /** The error's own `code`, or the SDK's error kind at the start of its message; `null` when neither. */
  errorCode: string | null;
  /** The known harmless cause the error matches ({@link CAUSE_KINDS}), or `unknown`. */
  causeKind: CauseKind;
}

/**
 * Name, code, and cause kind of a thrown value, never the value itself and
 * never any part of its message. The name is the error's `name` (or its
 * constructor's name) when it is a class name ending in `Error` or
 * `Exception`, otherwise `unknown`; a thrown string or number reports its
 * type. The code is the error's own `code` (a whole number of up to six
 * digits, or an upper-case constant) or the SDK's error kind at the start of
 * its message (`Network error: …` → `network`). The cause kind comes from
 * {@link CAUSE_KINDS}, matched on the device against the error's own name,
 * code, and message (or a thrown string); only the identifier is returned. A
 * value that cannot be read (a throwing getter) reports `unknown` and nothing
 * else.
 *
 * @param error - What was thrown, or rejected with.
 * @returns The cause; the code is `null` when there is none that may be reported.
 */
export function errorCause(error: unknown): ErrorCause {
  if (typeof error === 'string') {
    return { errorName: 'string', errorCode: null, causeKind: causeKindOf(null, null, error) };
  }
  if (typeof error !== 'object' || error === null) {
    return {
      errorName: error === null || error === undefined ? 'unknown' : typeof error,
      errorCode: null,
      causeKind: 'unknown',
    };
  }
  try {
    const { name, message, code } = error as { name?: unknown; message?: unknown; code?: unknown };
    const errorName =
      identifier(name, ERROR_NAME) ??
      identifier((error as { constructor?: { name?: unknown } }).constructor?.name, ERROR_NAME) ??
      'unknown';
    const text = typeof message === 'string' ? message : null;
    const kind = text === null ? null : sdkKind(text);
    const errorCode = identifier(code, OWN_CODE) ?? identifier(kind, SDK_KIND);
    const ownName = typeof name === 'string' ? name : null;
    return { errorName, errorCode, causeKind: causeKindOf(ownName, errorCode, text) };
  } catch {
    // An unreadable rejection never breaks the report.
    return { errorName: 'unknown', errorCode: null, causeKind: 'unknown' };
  }
}
