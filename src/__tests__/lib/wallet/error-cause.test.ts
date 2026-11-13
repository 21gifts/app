import { describe, expect, it } from 'vitest';
import {
  CAUSE_KINDS,
  ERROR_NAMES,
  KNOWN_CODES,
  MAX_NUMERIC_CODE,
  SDK_KINDS,
  errorCause,
  type CauseRule,
} from '@/lib/wallet/error-cause';
import { KEY_MATERIAL, expectNoKeyMaterial } from '@/__tests__/lib/wallet/key-material';

/**
 * An error with the given name and message, as a subclass would set it.
 *
 * @param name - Error name.
 * @param message - Error message.
 * @returns The error.
 */
function named(name: string, message: string): Error {
  return Object.assign(new Error(message), { name });
}

describe('errorCause', () => {
  it.each([
    ['wasm_out_of_memory', named('RangeError', 'WebAssembly.instantiate(): out of memory')],
    ['wasm_out_of_memory', named('RangeError', 'WebAssembly.Memory(): out of memory')],
    ['wasm_out_of_memory', named('RangeError', 'out of memory')],
    ['wasm_out_of_memory', named('Error', 'Out of memory')],
    ['wasm_unreachable', named('RuntimeError', 'unreachable')],
    ['wasm_unreachable', named('RuntimeError', 'unreachable executed')],
    ['wasm_unreachable', named('RuntimeError', 'Unreachable code should not be executed')],
    ['wasm_unreachable', 'RuntimeError: unreachable'],
    ['wasm_runtime', named('RuntimeError', 'memory access out of bounds')],
    ['chunk_load_failed', named('ChunkLoadError', 'Loading chunk 12 failed.')],
    [
      'chunk_load_failed',
      new TypeError(
        'Failed to fetch dynamically imported module: https://21.gifts/_next/static/chunks/app.js',
      ),
    ],
    ['chunk_load_failed', new TypeError('error loading dynamically imported module: /x.js')],
    ['chunk_load_failed', new TypeError('Importing a module script failed.')],
    ['fetch_failed', new TypeError('Failed to fetch')],
    ['fetch_failed', new TypeError('NetworkError when attempting to fetch resource.')],
    ['fetch_failed', new TypeError('Load failed')],
    ['storage_quota', new DOMException('The quota has been exceeded.', 'QuotaExceededError')],
    ['storage_quota', named('Error', 'The quota has been exceeded.')],
    ['sdk_network', new Error('Network error: request timed out')],
    ['sdk_service_connectivity', new Error('Service connectivity error: 503')],
    ['sdk_storage', new Error('Storage error: database closed')],
    ['timeout', new DOMException('The operation timed out.', 'TimeoutError')],
    ['aborted', new DOMException('The operation was aborted.', 'AbortError')],
  ] as const)('reads %s from a known harmless failure', (kind, error) => {
    expect(errorCause(error).causeKind).toBe(kind);
  });

  it.each([
    ['an SDK error of another kind', new Error('Generic error: something broke')],
    ['a near miss of a known message', new TypeError('Failed to fetch!')],
    ['a known message with more after it', new TypeError('Failed to fetch https://x/?k=1')],
    ['a message that only ends like out of memory', new Error('lnbc1: out of memory')],
    ['the first unreachable message under Error', named('Error', 'unreachable')],
    ['the second unreachable message under Error', named('Error', 'unreachable executed')],
    [
      'the third unreachable message under Error',
      named('Error', 'Unreachable code should not be executed'),
    ],
    ['the first unreachable message under TypeError', new TypeError('unreachable')],
    ['the second unreachable message under TypeError', new TypeError('unreachable executed')],
    [
      'the third unreachable message under TypeError',
      new TypeError('Unreachable code should not be executed'),
    ],
    [
      'a WebAssembly message that does not end like out of memory',
      named('RangeError', 'WebAssembly.instantiate(): compilation failed'),
    ],
    ['a thrown string', 'something else'],
    ['an Error without a message', new Error()],
  ])('reads unknown from %s', (_label, error) => {
    expect(errorCause(error).causeKind).toBe('unknown');
  });

  it.each([
    ['a boolean', true],
    ['a bigint', 10n],
    ['a symbol', Symbol('secret')],
    ['a function', (): void => undefined],
    ['an object without a name', { message: 'Network error: x' }],
  ])('reports only unknown as the name of %s', (_label, value) => {
    expect(errorCause(value).errorName).toBe('unknown');
  });

  it('reads unknown from a thrown value that is neither an object nor a string', () => {
    expect(errorCause(42)).toEqual({ errorName: 'number', errorCode: null, causeKind: 'unknown' });
    expect(errorCause(null)).toEqual({
      errorName: 'unknown',
      errorCode: null,
      causeKind: 'unknown',
    });
    expect(errorCause(undefined)).toEqual({
      errorName: 'unknown',
      errorCode: null,
      causeKind: 'unknown',
    });
  });

  it('never returns any part of the message, also when the message carries every secret', () => {
    const secrets = KEY_MATERIAL.map(([, secret]) => secret).join(' ');
    for (const error of [
      new Error(`Network error: ${secrets}`),
      new Error(`Generic error: ${secrets}`),
      new TypeError(`Failed to fetch ${secrets}`),
      `RuntimeError: unreachable ${secrets}`,
      Object.assign(new Error(secrets), { name: 'RuntimeError', config: { apiKey: secrets } }),
    ]) {
      const cause = errorCause(error);
      expectNoKeyMaterial(JSON.stringify(cause));
      expect(Object.keys(cause).sort()).toEqual(['causeKind', 'errorCode', 'errorName']);
    }
  });

  it('returns exactly the expected result for each error that carries every secret', () => {
    const secrets = KEY_MATERIAL.map(([, secret]) => secret).join(' ');
    const cases: ReadonlyArray<readonly [unknown, object]> = [
      [
        new Error(`Network error: ${secrets}`),
        { errorName: 'Error', errorCode: 'network', causeKind: 'sdk_network' },
      ],
      [
        new Error(`Generic error: ${secrets}`),
        { errorName: 'Error', errorCode: 'generic', causeKind: 'unknown' },
      ],
      [
        new TypeError(`Failed to fetch ${secrets}`),
        { errorName: 'TypeError', errorCode: null, causeKind: 'unknown' },
      ],
      [
        `RuntimeError: unreachable ${secrets}`,
        { errorName: 'string', errorCode: null, causeKind: 'unknown' },
      ],
      [
        Object.assign(new Error(secrets), { name: 'RuntimeError', config: { apiKey: secrets } }),
        { errorName: 'RuntimeError', errorCode: null, causeKind: 'wasm_runtime' },
      ],
      [
        Object.assign(new Error('x'), { name: secrets, code: secrets }),
        { errorName: 'Error', errorCode: null, causeKind: 'unknown' },
      ],
    ];
    for (const [error, expected] of cases) {
      expect(errorCause(error)).toStrictEqual(expected);
    }
  });

  it('reports the type string for a thrown string', () => {
    expect(errorCause('something else')).toStrictEqual({
      errorName: 'string',
      errorCode: null,
      causeKind: 'unknown',
    });
  });

  it('pins the full name and code lists', () => {
    expect(ERROR_NAMES).toStrictEqual([
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
    expect(KNOWN_CODES).toStrictEqual([
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
    expect(SDK_KINDS).toStrictEqual([
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
    expect(MAX_NUMERIC_CODE).toBe(999_999);
  });

  it.each(ERROR_NAMES)('reports the listed name %s', (name) => {
    expect(errorCause(named(name, 'x')).errorName).toBe(name);
  });

  it.each(KNOWN_CODES)('reports the listed own code %s', (code) => {
    expect(errorCause(Object.assign(new Error('x'), { code })).errorCode).toBe(code);
  });

  it.each(SDK_KINDS)('reports the listed SDK kind %s from its message', (kind) => {
    const words = kind.split('_').join(' ');
    const message = `${words.charAt(0).toUpperCase()}${words.slice(1)} error: x`;
    expect(errorCause(new Error(message)).errorCode).toBe(kind);
  });

  it.each([
    [0, '0'],
    [22, '22'],
    [999_999, '999999'],
    ['999999', '999999'],
    ['000022', '22'],
    ['007', '7'],
    [1_000_000, null],
    ['1000000', null],
    [-1, null],
    [1.5, null],
    ['', null],
    ['12a', null],
  ] as const)('reads the numeric code %j as %j', (code, expected) => {
    expect(errorCause(Object.assign(new Error('x'), { code })).errorCode).toBe(expected);
  });

  /**
   * A thrown value that matches one row of the table: its name, its message,
   * and, for a code row, a message that starts with that SDK kind.
   *
   * @param rule - The row.
   * @returns The error.
   */
  function matching(rule: CauseRule): Error {
    let message = rule.message ?? 'x';
    if (rule.messageStart !== undefined || rule.messageEnd !== undefined) {
      message = `${rule.messageStart ?? ''}middle${rule.messageEnd ?? ''}`;
    }
    if (rule.code !== undefined) {
      const words = rule.code.split('_').join(' ');
      message = `${words.charAt(0).toUpperCase()}${words.slice(1)} error: x`;
    }
    return named(rule.name ?? 'Error', message);
  }

  it('has no row that sets a code together with a message field', () => {
    // A code row's code comes from the start of the message, so `matching`
    // builds its message from the code; no row may need both.
    for (const rule of CAUSE_KINDS) {
      const messageFields = [rule.message, rule.messageStart, rule.messageEnd];
      expect(rule.code === undefined || messageFields.every((field) => field === undefined)).toBe(
        true,
      );
    }
  });

  it.each(CAUSE_KINDS.map((rule, row) => [row, rule] as const))(
    'matches row %i and misses it when any field it sets is changed',
    (_row, rule) => {
      const base = matching(rule);
      expect(errorCause(base).causeKind).toBe(rule.kind);
      const changed: Error[] = [];
      if (rule.name !== undefined) {
        changed.push(named('SyntaxError', base.message));
      }
      if (rule.code !== undefined) {
        changed.push(named(base.name, 'Generic error: x'));
      }
      if (rule.message !== undefined) {
        changed.push(named(base.name, `${base.message}!`));
        changed.push(named(base.name, `!${base.message}`));
      }
      if (rule.messageStart !== undefined) {
        changed.push(named(base.name, `!${base.message}`));
      }
      if (rule.messageEnd !== undefined) {
        changed.push(named(base.name, `${base.message}!`));
      }
      expect(changed.length).toBeGreaterThan(0);
      for (const error of changed) {
        expect(errorCause(error).causeKind, `${error.name}: ${error.message}`).not.toBe(rule.kind);
      }
    },
  );

  it('keeps a thrower that patches built-ins mid-read to the lists', () => {
    const saved = {
      has: Set.prototype.has,
      test: RegExp.prototype.test,
      find: Array.prototype.find,
      includes: Array.prototype.includes,
      startsWith: String.prototype.startsWith,
      endsWith: String.prototype.endsWith,
    };
    let reads = 0;
    const error = {
      get name(): string {
        reads += 1;
        Set.prototype.has = (): boolean => true;
        RegExp.prototype.test = (): boolean => true;
        Array.prototype.find = (): unknown => ({ kind: 'caller_kind' });
        Array.prototype.includes = (): boolean => true;
        String.prototype.startsWith = (): boolean => true;
        String.prototype.endsWith = (): boolean => true;
        return 'caller_name';
      },
      code: 'caller_code',
      message: 'caller message: out of memory',
    };
    try {
      expect(errorCause(error)).toStrictEqual({
        errorName: 'unknown',
        errorCode: null,
        causeKind: 'unknown',
      });
      // The getter ran, once, so the built-ins were replaced before matching.
      expect(reads).toBe(1);
      expect(Object.isFrozen(CAUSE_KINDS)).toBe(true);
      expect(CAUSE_KINDS.every((rule) => Object.isFrozen(rule))).toBe(true);
      expect(Object.isFrozen(ERROR_NAMES)).toBe(true);
      expect(Object.isFrozen(KNOWN_CODES)).toBe(true);
      expect(Object.isFrozen(SDK_KINDS)).toBe(true);
    } finally {
      Set.prototype.has = saved.has;
      RegExp.prototype.test = saved.test;
      Array.prototype.find = saved.find;
      Array.prototype.includes = saved.includes;
      String.prototype.startsWith = saved.startsWith;
      String.prototype.endsWith = saved.endsWith;
    }
  });

  it('only ever returns a cause kind from the table or unknown', () => {
    const kinds = new Set<string>([...CAUSE_KINDS.map((rule) => rule.kind), 'unknown']);
    for (const error of [
      new Error('Network error: x'),
      new Error('x'),
      'x',
      { name: 'RuntimeError' },
      { code: 'storage' },
    ]) {
      expect(kinds.has(errorCause(error).causeKind)).toBe(true);
    }
  });

  it('reports only class-shaped names and constant-shaped or SDK-kind codes', () => {
    expect(errorCause({ name: 'alice', code: 'account_alice', message: 'x' })).toEqual({
      errorName: 'unknown',
      errorCode: null,
      causeKind: 'unknown',
    });
    const chunk = Object.assign(new Error('x'), { name: 'ChunkLoadError', code: 'ECONNRESET' });
    expect(errorCause(chunk)).toEqual({
      errorName: 'ChunkLoadError',
      errorCode: 'ECONNRESET',
      causeKind: 'chunk_load_failed',
    });
    const dom = { name: 'QuotaExceededError', code: 22, message: 'x' };
    expect(errorCause(dom)).toEqual({
      errorName: 'QuotaExceededError',
      errorCode: '22',
      causeKind: 'storage_quota',
    });
  });

  it('turns a several-word SDK kind into one code', () => {
    expect(errorCause(new Error('Service connectivity error: down')).errorCode).toBe(
      'service_connectivity',
    );
  });

  it.each([
    ['made of more than four words', 'add age aim air all ant arm art ask and error: fail'],
    ['longer than 41 characters', `${'a'.repeat(42)} error: fail`],
    ['with a character other than a letter or space', 'Net2work error: fail'],
    ['at the very start', ' error: fail'],
    ['that is a name', 'Alice Smith error: fail'],
    ['that is recovery words', 'Legal winner thank error: fail'],
  ])('reports no code for an SDK kind %s', (_label, message) => {
    const cause = errorCause(new Error(message));
    expect(cause.errorCode).toBeNull();
    expect(cause.causeKind).toBe('unknown');
  });

  it.each([
    ['an upper-case hex key', 'E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855'],
    ['an upper-case constant not on the list', 'ACCOUNT_ALICE'],
    ['recovery words in capitals', 'LEGAL_WINNER_THANK'],
    ['a number of more than six digits', 1_234_567],
  ])('reports no code for an own code that is %s', (_label, code) => {
    expect(errorCause(Object.assign(new Error('x'), { code })).errorCode).toBeNull();
  });

  it('reports a listed own code and the listed SDK kinds the wallet tests rely on', () => {
    expect(
      errorCause(Object.assign(new Error('x'), { code: 'QUOTA_EXCEEDED_ERR' })).errorCode,
    ).toBe('QUOTA_EXCEEDED_ERR');
    for (const [message, kind] of [
      ['Chain service error: x', 'chain_service'],
      ['Network error: x', 'network'],
      ['Generic error: x', 'generic'],
      ['Storage error: x', 'storage'],
      ['Service connectivity error: x', 'service_connectivity'],
    ]) {
      expect(errorCause(new Error(message)).errorCode).toBe(kind);
    }
    expect(errorCause(new Error('Withdrawal got leaf spending error: x')).errorCode).toBe(
      'withdrawal_got_leaf_spending',
    );
  });

  it('reports a subclass name such as RuntimeError and TypeError', () => {
    class RuntimeError extends Error {}
    Object.defineProperty(RuntimeError.prototype, 'name', { value: 'RuntimeError' });
    expect(errorCause(new RuntimeError('unreachable'))).toEqual({
      errorName: 'RuntimeError',
      errorCode: null,
      causeKind: 'wasm_unreachable',
    });
    expect(errorCause(new TypeError('Failed to fetch')).errorName).toBe('TypeError');
  });

  it('prefers an own string code to the SDK kind', () => {
    const error = Object.assign(new Error('Network error: x'), { code: 'ETIMEDOUT' });
    expect(errorCause(error)).toMatchObject({ errorCode: 'ETIMEDOUT', causeKind: 'unknown' });
  });

  it('falls back to a listed constructor name when the name is not a string', () => {
    class LnurlRelayError extends Error {}
    const error = new LnurlRelayError('boom');
    Object.defineProperty(error, 'name', { value: 42, configurable: true });
    expect(errorCause(error).errorName).toBe('LnurlRelayError');
    Object.defineProperty(error, 'name', { value: { nested: true } });
    expect(errorCause(error).errorName).toBe('LnurlRelayError');
    class SdkError extends Error {}
    const other = new SdkError('boom');
    Object.defineProperty(other, 'name', { value: 42 });
    expect(errorCause(other).errorName).toBe('unknown');
  });

  it.each([
    ['a class-shaped name that is not on the list', 'AliceError'],
    [
      'a key that ends like an error name',
      'A5HpHagT65TZzG1PH3CSu63k8DbpvD8s5ip4nEB3kEsreAnchuDfError',
    ],
    ['an exception name that is not on the list', 'WalletPhraseException'],
  ])('never reports %s, only the constructor name Error', (_label, name) => {
    const cause = errorCause(named(name, 'x'));
    expect(cause.errorName).toBe('Error');
    expect(JSON.stringify(cause)).not.toContain(name);
  });

  it.each([
    ['a hex key', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
    ['recovery words', 'abandon_ability_able'],
    ['a name with spaces', 'Bad Name'],
    ['a name longer than 64 characters', `E${'r'.repeat(64)}Error`],
    ['an empty name', ''],
  ])('reports unknown for %s as the name and leaves no code', (_label, name) => {
    const error = Object.create(null) as Record<string, unknown>;
    error['name'] = name;
    error['code'] = name;
    error['message'] = 'boom';
    expect(errorCause(error)).toEqual({
      errorName: 'unknown',
      errorCode: null,
      causeKind: 'unknown',
    });
  });

  it('reports no fractional code and ignores a message that is not a string', () => {
    const error = { name: 'Error', code: 1.5, message: 7 };
    expect(errorCause(error)).toEqual({
      errorName: 'Error',
      errorCode: null,
      causeKind: 'unknown',
    });
  });

  it.each([-1, 1e21])('reports no code for the number %s', (code) => {
    // Neither the number nor the constructor name `Object` is an error name.
    expect(errorCause({ name: code, code, message: 'x' })).toEqual({
      errorName: 'unknown',
      errorCode: null,
      causeKind: 'unknown',
    });
  });

  it('reports only unknown for an error that cannot be read', () => {
    const error = {
      get name(): string {
        throw new Error('getter');
      },
    };
    expect(errorCause(error)).toEqual({
      errorName: 'unknown',
      errorCode: null,
      causeKind: 'unknown',
    });
  });
});
