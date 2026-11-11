/** Longest error name a report keeps. */
const IDENTIFIER_MAX_LENGTH = 64;

/** An error name: a class name ending in `Error` or `Exception` (`TypeError`, `DOMException`). */
const ERROR_NAME = /^(?:[A-Z][A-Za-z0-9]*)?(?:Error|Exception)$/;

/** An error's own numeric code: a whole number of up to six digits (a `DOMException`'s). */
const NUMERIC_CODE = /^\d{1,6}$/;

/**
 * The upper-case constants an error's own `code` may be reported as: network
 * error codes and the legacy `DOMException` constant names. A list, not a
 * shape, so a key or a name written in capitals is never sent.
 */
const KNOWN_CODES: ReadonlySet<string> = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ECONNABORTED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ENETUNREACH',
  'ERR_NETWORK',
  'ABORT_ERR',
  'TIMEOUT_ERR',
  'NETWORK_ERR',
  'QUOTA_EXCEEDED_ERR',
  'INVALID_STATE_ERR',
  'NOT_SUPPORTED_ERR',
  'SECURITY_ERR',
]);

/**
 * The error kinds the wallet SDK writes at the start of a message
 * (`Network error: …` → `network`), lower case joined by `_`. A list, not a
 * shape, so other text before ` error:` (a name, a word of a phrase) is never
 * sent.
 */
const SDK_KINDS: ReadonlySet<string> = new Set([
  'address',
  'authentication',
  'body',
  'builder',
  'chain_service',
  'configuration',
  'connect',
  'connection',
  'decode',
  'decryption',
  'encryption',
  'execution',
  'generic',
  'generic_signer',
  'instant_claim_transient',
  'json',
  'key_derivation',
  'lnurl',
  'mnemonic',
  'network',
  'operator_pool',
  'other',
  'parse',
  'passkey',
  'received',
  'redirect',
  'request',
  'script',
  'service',
  'service_connectivity',
  'signer',
  'signing',
  'spark_primitives',
  'status',
  'storage',
  'sweep_signer',
  'system_time',
  'taproot_sighash',
  'timeout',
  'token_output_service',
  'transfer_got_leaf_spending',
  'transport',
  'tree_service',
  'underlying_implementation',
  'unexpected',
  'validation',
  'wallet',
  'withdrawal_got_leaf_spending',
]);

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
 * `Service connectivity error: …` → `service_connectivity`), when it is one
 * of {@link SDK_KINDS}.
 *
 * @param message - The error's message.
 * @returns The kind, or `null`.
 */
function sdkKind(message: string): string | null {
  const end = message.slice(0, SDK_KIND_MAX_LENGTH + SDK_KIND_END.length).indexOf(SDK_KIND_END);
  if (end <= 0) {
    return null;
  }
  const text = message.slice(0, end);
  if (!SDK_KIND_TEXT.test(text)) {
    return null;
  }
  const kind = text.toLowerCase().replace(/ /g, '_');
  return SDK_KINDS.has(kind) ? kind : null;
}

/**
 * The error's own `code` when it may be reported: a whole number of up to six
 * digits, or one of {@link KNOWN_CODES}.
 *
 * @param code - The error's `code`.
 * @returns The code as a string, or `null`.
 */
function ownCode(code: unknown): string | null {
  const text = typeof code === 'number' ? String(code) : code;
  if (typeof text !== 'string') {
    return null;
  }
  return NUMERIC_CODE.test(text) || KNOWN_CODES.has(text) ? text : null;
}

/**
 * An error name that may be reported: a class name ending in `Error` or
 * `Exception` ({@link ERROR_NAME}) of at most {@link IDENTIFIER_MAX_LENGTH}
 * characters.
 *
 * @param value - Candidate name.
 * @returns The name, or `null` when it may not be reported.
 */
function errorNameOf(value: unknown): string | null {
  return typeof value === 'string' &&
    value.length <= IDENTIFIER_MAX_LENGTH &&
    ERROR_NAME.test(value)
    ? value
    : null;
}

/** What a report may say about a thrown value. */
export interface ErrorCause {
  /**
   * Error name (`TypeError`, `RuntimeError`, …), the type of a thrown value
   * that is not an object (`string`), or `unknown`.
   */
  errorName: string;
  /**
   * The error's own `code` (a number, or a known constant), or the SDK's
   * error kind at the start of its message; `null` when neither.
   */
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
 * digits, or one of {@link KNOWN_CODES}) or the SDK's error kind at the start
 * of its message when it is one of {@link SDK_KINDS} (`Network error: …` →
 * `network`). The cause kind comes from
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
      errorNameOf(name) ??
      errorNameOf((error as { constructor?: { name?: unknown } }).constructor?.name) ??
      'unknown';
    const text = typeof message === 'string' ? message : null;
    const errorCode = ownCode(code) ?? (text === null ? null : sdkKind(text));
    const ownName = typeof name === 'string' ? name : null;
    return { errorName, errorCode, causeKind: causeKindOf(ownName, errorCode, text) };
  } catch {
    // An unreadable rejection never breaks the report.
    return { errorName: 'unknown', errorCode: null, causeKind: 'unknown' };
  }
}
