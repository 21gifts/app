/**
 * The error names a report may carry: the built-in JavaScript and
 * WebAssembly error classes, `DOMException` and its names, the bundler's
 * `ChunkLoadError`, and the app's own error classes. A list, not a shape, so
 * a name set by code to anything else (a key, a user name) is never sent.
 */
export const ERROR_NAMES: readonly string[] = Object.freeze([
  'Error',
  'TypeError',
  'RangeError',
  'SyntaxError',
  'ReferenceError',
  'EvalError',
  'URIError',
  'AggregateError',
  'InternalError',
  'CompileError',
  'LinkError',
  'RuntimeError',
  'DOMException',
  'AbortError',
  'TimeoutError',
  'NetworkError',
  'QuotaExceededError',
  'InvalidStateError',
  'NotFoundError',
  'NotSupportedError',
  'NotAllowedError',
  'NotReadableError',
  'SecurityError',
  'UnknownError',
  'DataError',
  'DataCloneError',
  'ConstraintError',
  'EncodingError',
  'InvalidAccessError',
  'OperationError',
  'ReadOnlyError',
  'TransactionInactiveError',
  'VersionError',
  'ChunkLoadError',
  'AppOutdatedError',
  'CannotReceiveError',
  'EventsRefusedError',
  'LnurlRelayError',
  'LoginsClosedError',
  'LookupSignError',
  'MissingRequirementsError',
  'NoteDeletedError',
  'PostFeeRequiredError',
  'PublicForumUnauthorizedError',
  'RecoveryError',
  'RecoveryPendingError',
  'UnknownCredentialError',
  'WalletRequiredError',
  'WrongAccountError',
]);

/** Largest numeric code a report keeps (six digits, as a `DOMException`'s). */
export const MAX_NUMERIC_CODE = 999_999;

/**
 * The upper-case constants an error's own `code` may be reported as: network
 * error codes and the legacy `DOMException` constant names. A list, not a
 * shape, so a key or a name written in capitals is never sent.
 */
export const KNOWN_CODES: readonly string[] = Object.freeze([
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
export const SDK_KINDS: readonly string[] = Object.freeze([
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
  readonly kind: Exclude<CauseKind, 'unknown'>;
  readonly name?: string;
  readonly code?: string;
  readonly message?: string;
  readonly messageStart?: string;
  readonly messageEnd?: string;
}

/**
 * The known harmless failures, in order; the first row that matches gives the
 * cause kind. Matching compares whole strings, a start, or an end only, so each
 * message is read in linear time and nothing is searched with a pattern. The
 * table and each row are frozen.
 */
export const CAUSE_KINDS: readonly CauseRule[] = Object.freeze(
  (
    [
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
    ] as CauseRule[]
  ).map((rule) => Object.freeze(rule)),
);

/*
 * Everything a match uses is taken here, when the module loads, so nothing an
 * error's getters or its thrower change later (a built-in prototype method, a
 * row of the table) decides what is reported: the lists and the table are
 * frozen, they are searched with indexed loops and `===`, and the two string
 * checks are bound to the built-in methods as they are now.
 */
const startsWith: (text: string, start: string) => boolean = Function.prototype.call.bind(
  String.prototype.startsWith,
) as (text: string, start: string) => boolean;
const endsWith: (text: string, end: string) => boolean = Function.prototype.call.bind(
  String.prototype.endsWith,
) as (text: string, end: string) => boolean;
const isInteger = Number.isInteger;

/** Writes one character from its code, to write a numeric code digit by digit. */
const fromCharCode = String.fromCharCode;

/** Character code of the digit `0`. */
const DIGIT_ZERO = 48;

/**
 * The start of a message that names each of {@link SDK_KINDS}, as the SDK
 * writes it (`network` → `Network error:`), built once when the module loads.
 */
const SDK_KIND_STARTS: readonly (readonly [string, string])[] = Object.freeze(
  SDK_KINDS.map((kind) => {
    const words = kind.split('_').join(' ');
    return Object.freeze([
      `${words.charAt(0).toUpperCase()}${words.slice(1)} error:`,
      kind,
    ] as const);
  }),
);

/**
 * Whether a list holds a value, by an indexed loop and `===`.
 *
 * @param list - A frozen list of this module.
 * @param value - The value.
 * @returns Whether the list holds it.
 */
function listed(list: readonly string[], value: string): boolean {
  for (let at = 0; at < list.length; at += 1) {
    if (list[at] === value) {
      return true;
    }
  }
  return false;
}

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
    (rule.messageStart === undefined ||
      (message !== null && startsWith(message, rule.messageStart))) &&
    (rule.messageEnd === undefined || (message !== null && endsWith(message, rule.messageEnd)))
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
  for (let at = 0; at < CAUSE_KINDS.length; at += 1) {
    const rule = CAUSE_KINDS[at];
    if (rule !== undefined && matches(rule, name, code, message)) {
      return rule.kind;
    }
  }
  return 'unknown';
}

/**
 * The SDK's error kind at the start of its message, when the message starts
 * with one of {@link SDK_KIND_STARTS} (`Network error: …` → `network`,
 * `Service connectivity error: …` → `service_connectivity`).
 *
 * @param message - The error's message.
 * @returns The kind, or `null`.
 */
function sdkKind(message: string): string | null {
  for (let at = 0; at < SDK_KIND_STARTS.length; at += 1) {
    const entry = SDK_KIND_STARTS[at];
    if (entry !== undefined && startsWith(message, entry[0])) {
      return entry[1];
    }
  }
  return null;
}

/**
 * A whole number from 0 to {@link MAX_NUMERIC_CODE} written in digits, with
 * arithmetic and the character codes of the digits only.
 *
 * @param code - The number.
 * @returns Its digits, or `null` when it is not such a number.
 */
function numericCode(code: number): string | null {
  if (!isInteger(code) || code < 0 || code > MAX_NUMERIC_CODE) {
    return null;
  }
  let rest = code;
  let text = '';
  do {
    text = `${fromCharCode(DIGIT_ZERO + (rest % 10))}${text}`;
    rest = (rest - (rest % 10)) / 10;
  } while (rest > 0);
  return text;
}

/**
 * Whether a string is one to six digits, checked character by character.
 *
 * @param text - The string.
 * @returns Whether it is.
 */
function isDigits(text: string): boolean {
  if (text.length < 1 || text.length > 6) {
    return false;
  }
  for (let at = 0; at < text.length; at += 1) {
    const char = text[at];
    if (char === undefined || char < '0' || char > '9') {
      return false;
    }
  }
  return true;
}

/**
 * The error's own `code` when it may be reported: a whole number from 0 to
 * {@link MAX_NUMERIC_CODE} (also written as one to six digits), or one of
 * {@link KNOWN_CODES}.
 *
 * @param code - The error's `code`.
 * @returns The code as a string, or `null`.
 */
function ownCode(code: unknown): string | null {
  if (typeof code === 'number') {
    return numericCode(code);
  }
  if (typeof code !== 'string') {
    return null;
  }
  return isDigits(code) || listed(KNOWN_CODES, code) ? code : null;
}

/**
 * An error name that may be reported: one of {@link ERROR_NAMES}.
 *
 * @param value - Candidate name.
 * @returns The name, or `null` when it may not be reported.
 */
function errorNameOf(value: unknown): string | null {
  return typeof value === 'string' && listed(ERROR_NAMES, value) ? value : null;
}

/** What a report may say about a thrown value. */
export interface ErrorCause {
  /**
   * Error name from {@link ERROR_NAMES} (`TypeError`, `RuntimeError`, …),
   * `string` or `number` for a thrown string or number, or `unknown`.
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
 * constructor's name) when it is one of {@link ERROR_NAMES}, otherwise
 * `unknown`; a thrown string or number reports its type (`string`,
 * `number`), and any other thrown value that is not an object `unknown`. The
 * code is the error's own `code` (a whole number from 0 to 999999, or one of
 * {@link KNOWN_CODES}) or the SDK's error kind at the start of its message
 * when it is one of {@link SDK_KINDS} (`Network error: …` → `network`). The
 * cause kind comes from {@link CAUSE_KINDS}, matched on the device against the
 * error's own name, code, and message (or a thrown string); only the
 * identifier is returned. The error's `name`, `message`, `code`, and
 * `constructor` are each read once, before anything is compared, and every
 * comparison uses only what this module took when it loaded. A value that
 * cannot be read (a throwing getter) reports `unknown` and nothing else.
 *
 * @param error - What was thrown, or rejected with.
 * @returns The cause; the code is `null` when there is none that may be reported.
 */
export function errorCause(error: unknown): ErrorCause {
  if (typeof error === 'string') {
    return { errorName: 'string', errorCode: null, causeKind: causeKindOf(null, null, error) };
  }
  if (typeof error !== 'object' || error === null) {
    // Only a thrown number reports its type; anything else here is `unknown`.
    return {
      errorName: typeof error === 'number' ? 'number' : 'unknown',
      errorCode: null,
      causeKind: 'unknown',
    };
  }
  try {
    const read = error as {
      name?: unknown;
      message?: unknown;
      code?: unknown;
      constructor?: { name?: unknown };
    };
    const name = read.name;
    const message = read.message;
    const code = read.code;
    const constructorName = read.constructor?.name;
    const text = typeof message === 'string' ? message : null;
    const errorName = errorNameOf(name) ?? errorNameOf(constructorName) ?? 'unknown';
    const errorCode = ownCode(code) ?? (text === null ? null : sdkKind(text));
    const ownName = typeof name === 'string' ? name : null;
    return { errorName, errorCode, causeKind: causeKindOf(ownName, errorCode, text) };
  } catch {
    // An unreadable rejection never breaks the report.
    return { errorName: 'unknown', errorCode: null, causeKind: 'unknown' };
  }
}
