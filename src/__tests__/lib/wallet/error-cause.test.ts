import { describe, expect, it } from 'vitest';
import {
  ERROR_MESSAGE_MAX_LENGTH,
  errorCause,
  sanitizeErrorMessage,
} from '@/lib/wallet/error-cause';
import {
  KEY_MATERIAL,
  LEAK_MNEMONIC,
  expectNoKeyMaterial,
} from '@/__tests__/lib/wallet/key-material';

describe('sanitizeErrorMessage', () => {
  it.each(KEY_MATERIAL)('removes %s', (_label, secret, placeholder) => {
    const out = sanitizeErrorMessage(`connect failed: ${secret} (retry)`);
    expectNoKeyMaterial(out);
    expect(out).toContain(placeholder);
    expect(out.startsWith('connect failed: ')).toBe(true);
    expect(out.endsWith(' (retry)')).toBe(true);
  });

  it('removes every secret of one message holding all of them', () => {
    const out = sanitizeErrorMessage(KEY_MATERIAL.map(([, secret]) => secret).join(' | '));
    expectNoKeyMaterial(out);
  });

  it.each([
    'WebAssembly.instantiate(): out of memory',
    'Failed to fetch',
    'QuotaExceededError',
    'The quota has been exceeded.',
    'Network error: request timed out',
    'Failed to fetch dynamically imported module: https://21.gifts/_next/static/chunks/app.js',
    'RuntimeError: unreachable',
  ])('keeps the harmless message %j readable', (message) => {
    expect(sanitizeErrorMessage(message)).toBe(message);
  });

  it('replaces recovery-word runs of three or more in any case and with any separator', () => {
    expect(sanitizeErrorMessage('bad ABANDON,ability-Able here')).toBe('bad [words] here');
    expect(sanitizeErrorMessage('bad: abandon\n ability/able 7 about.')).toBe('bad: [words].');
    expect(sanitizeErrorMessage('a b c abandon ability x able about above')).toBe(
      'a b c abandon ability x [words]',
    );
  });

  it('keeps two recovery words in a row', () => {
    expect(sanitizeErrorMessage('wallet access denied')).toBe('wallet access denied');
  });

  it('replaces 16 hex digits but keeps 15', () => {
    expect(sanitizeErrorMessage('id 0123456789abcdef')).toBe('id [hex]');
    expect(sanitizeErrorMessage('id 0123456789abcde')).toBe('id 0123456789abcde');
  });

  it('replaces long tokens with a digit and keeps long words without one', () => {
    expect(sanitizeErrorMessage('key Zm9vYmFyYmF6cXV4cXV1eDEyMw==')).toBe('key [token]');
    expect(sanitizeErrorMessage('in breez_sdk_spark_wasm_bg_module')).toBe(
      'in breez_sdk_spark_wasm_bg_module',
    );
  });

  it.each([
    ['key_demo_abcdef12345.abcdefghijklmnopqrstu1', '[hex]'],
    ['fingerprint:ab:cd:ef:01:23:45:67:89', '[hex]'],
    ['x-ab:cd:ef:01:23:45:67:89', '[hex]'],
    ['x0123456789-abcdef', '[hex]'],
    ['0123456789/abcdef', '[hex]'],
    ['token.xyzDefgh12/abc7890xy', '[token]'],
    ['key_demo.9xq27pmWbV/nTrLsK4dJh8cY', '[token]'],
    ['lnbc-10u1p2k3m4n', '[token]'],
    ['spark1-abcdefghij', '[token]'],
    ['xprv-9s21ZrQH14', '[token]'],
    ['bc1qar0srrr7xfkvy5l643/lydnw9re59gt', '[token]'],
    ['abcdefghij123456789-', '[token]'],
    ['abcdefghijklmnopqrstu1.sfx12345678', '[token]'],
    ['bc1qar0srrr7xfkvy5l643lydnw9re-59gtzzwf5mdq', '[token]'],
    ['bc1qar0srrr7xfkvy5l643lydnw9re_59gtzzwf5mdq', '[token]'],
    ['0123456789.abcdef', '[hex]'],
    ['0123456789_abcdef', '[hex]'],
    ['id_token_eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJlLXRhaWw', '[token]'],
  ])('replaces the whole split key %s', (key, placeholder) => {
    expect(sanitizeErrorMessage(`k ${key} x`)).toBe(`k ${placeholder} x`);
  });

  it('reads a bracketed recovery word as a word', () => {
    expect(sanitizeErrorMessage('[abandon] [ability] [able] [about]')).toBe('[[words]]');
  });

  it('keeps a base64 key with a slash whole and a sentence stop after it', () => {
    expect(sanitizeErrorMessage('key AbC1/defghijklmnopqrstuvwxyz0123/xYz9q. Next')).toBe(
      'key [token]. Next',
    );
  });

  it('replaces a dotted key with a digit and every part of a JWE', () => {
    expect(sanitizeErrorMessage('key key_demo.9xQ27PmWbVnTrLs1 bad')).toBe('key [token] bad');
    expect(sanitizeErrorMessage('key key_demo.9xq27pmwbvntrls bad')).toBe('key [token] bad');
    expect(sanitizeErrorMessage('key KEY_DEMO.9XQ27PMWBVNTRLS bad')).toBe('key [token] bad');
    expect(
      sanitizeErrorMessage(
        'jwe eyJhbGciOiJSU0EtT0FFUCJ9.OKOawDo13gRp2ojaHV7LFpZcgV7T6DVZKTyKOMTYUmKoTCVJRgckCL9kiMT03JGeipsEdY3mx_etLbbWSrFr05kLzcSr4qKAq7YN7e9jwQRb23nfa6c9d-StnImGyFDbSv04uVuxIp5Zms1gNxKKK2Da14B8S4rzVRltdYwam_lDp5XnZAYpQdb76FdIKLaVmqgfwX7XWRxv2322i-vDxRfqNzo_tETKzpVLzfiwQyeyPGLBIO56YJ7eObdv0je81860ppamavo35UgoRdbYaBcoh9QcfylQr66oc6vFWXRcZ_ZT2LawVCWTIy3brGPi6UklfCpIMfIjf7iGdXKHzg.48V1_ALb6US04U3b.5eym8TW_c8SuK0ltJ3rpYIzOeDQz7TALvtu6UG9oMo4vpzs9tX_EFShS8iB7j6jiSdiwkIr3ajwQzaBtQD_A.XFBoMYUZodetZdvTiFvSkQ end',
      ),
    ).toBe('jwe [token] end');
    expect(sanitizeErrorMessage('see 21.gifts/static/WebAssembly.instantiate')).toBe(
      'see 21.gifts/static/WebAssembly.instantiate',
    );
    expect(sanitizeErrorMessage('at https://21.gifts/u/key_demo_9xQ27PmWbVnTrLsK4dJh8cY/x')).toBe(
      'at https://21.gifts/u/[token]/x',
    );
  });

  it('replaces a 40-character mixed-case token without a digit', () => {
    expect(sanitizeErrorMessage('key AbCdEfGhIjKlMnOpQrStUvWxYzAbCdEfGhIjKlMn end')).toBe(
      'key [token] end',
    );
    expect(sanitizeErrorMessage('MaxDepositClaimFeeExceeded')).toBe('MaxDepositClaimFeeExceeded');
  });

  it('replaces a URL with a user name and password as a whole', () => {
    expect(sanitizeErrorMessage('GET https://alice:hunter2@h.example/x failed')).toBe(
      'GET [addr] failed',
    );
  });

  it.each([
    'abandon.ability.able@xyzzyhost1.com',
    'user@my_verylonghost.com',
    '"alice.smith"@example.com',
    'alice.smith@[192.0.2.1]',
    'alice.smith(work)@example.com',
    'user[tag]@example.com',
    '<maximilian.o@example.com>',
    '(user/@mail.com)',
    'user/@192.168.1.1',
    'user/@mail.com/x',
    'https://user:password/@host.com',
    'alice.smith＠example.com',
    'alice.smith﹫example.com',
    '"verylongname here"@example.com',
    '"zzzzzzzzzz last"%40host.com',
    '"a\\"bcdefghijk c"@host',
    `"${'z'.repeat(64)} z"@host.example`,
    'https://x.example/u/alice.smith%40example.com',
  ])('replaces the whole address %s', (address) => {
    expect(sanitizeErrorMessage(`to ${address} failed`)).toBe('to [addr] failed');
  });

  it('cuts a query of four or more characters even without a path or an =', () => {
    expect(sanitizeErrorMessage('example.com?secretvalue1 x')).toBe('example.com?[q] x');
    expect(sanitizeErrorMessage('example.com#abcdefghijkl')).toBe('example.com?[q]');
    expect(sanitizeErrorMessage('example.com？token=abcdefghijkl')).toBe('example.com?[q]');
    expect(sanitizeErrorMessage('example.com＃abcdefghijkl')).toBe('example.com?[q]');
    expect(sanitizeErrorMessage('x%3Fsecretvalue y')).toBe('x?[q] y');
    expect(sanitizeErrorMessage('x%23secretvalue')).toBe('x?[q]');
    expect(sanitizeErrorMessage("https://x.com/cb?code=abc'defghijklmnop")).toBe(
      'https://x.com/cb?[q]',
    );
  });

  it('replaces keys before recovery words, so no part of a key stays', () => {
    expect(sanitizeErrorMessage('bc1qqqqqq1abandon2ability3able')).toBe('[token]');
    expect(sanitizeErrorMessage('0123456789ab1add2fee3dad')).toBe('[hex]');
    expect(sanitizeErrorMessage('[token] [token] [token]')).toBe('[token] [token] [token]');
  });

  it('replaces the query string of a path', () => {
    expect(sanitizeErrorMessage('POST /api/x?apiKey=key_demo_abc failed')).toBe(
      'POST /api/x?[q] failed',
    );
    expect(sanitizeErrorMessage('(/a/b#frag)')).toBe('(/a/b?[q]');
    expect(sanitizeErrorMessage('what? and/or #1')).toBe('what? and/or #1');
    expect(sanitizeErrorMessage('GET api.example.com/v1/auth?k=AbCd1234EfGh5678 x')).toBe(
      'GET api.example.com/v1/auth?[q] x',
    );
    expect(sanitizeErrorMessage('GET:/x?t=abc ./y#z')).toBe('GET:/x?[q] ./y?[q]');
  });

  it('reads a very long message without a digit in linear time', () => {
    const long = `${'a'.repeat(100_000)} ${'x.'.repeat(50_000)} ${'b'.repeat(100_000)}@ ${'http://a,'.repeat(12_000)} ${'(/a'.repeat(30_000)} ${'=/a'.repeat(30_000)} ${'a:'.repeat(50_000)} ${"é'".repeat(50_000)}@ ${'add add add x '.repeat(70_000)} ${'eyJ-'.repeat(250_000)} ${'"a'.repeat(100_000)} ${'\\"'.repeat(250_000)}`;
    const started = performance.now();
    sanitizeErrorMessage(long);
    expect(performance.now() - started).toBeLessThan(1_000);
  });

  it('replaces the whole name of an address in any script', () => {
    expect(sanitizeErrorMessage('Failed to send to andré@example.com')).toBe(
      'Failed to send to [addr]',
    );
    expect(sanitizeErrorMessage("to maximilian.o'brien@example.com now")).toBe('to [addr] now');
    expect(sanitizeErrorMessage('in node_modules/@breeztech/x')).toBe(
      'in node_modules/@breeztech/x',
    );
  });

  it('replaces a query that has no path before it', () => {
    expect(sanitizeErrorMessage('Cannot GET callback?code=Zq8xLm2Vb9Kp')).toBe(
      'Cannot GET callback?[q]',
    );
    expect(sanitizeErrorMessage('api.example.com?next=/home&token=Zq8xLm2Vb9Kp')).toBe(
      'api.example.com?[q]',
    );
  });

  it('replaces hex in groups joined by colons or hyphens', () => {
    expect(sanitizeErrorMessage('fp ab:cd:ef:01:23:45:67:89:ab:cd:ef:01:23:45:67:89 x')).toBe(
      'fp [hex] x',
    );
    expect(sanitizeErrorMessage('id 0123abcd-0123abcd end')).toBe('id [hex] end');
    expect(sanitizeErrorMessage('id 123e4567-e89b-12d3-a456-426614174000')).toBe('id [hex]');
    expect(sanitizeErrorMessage('add-a-fee ab:cd')).toBe('add-a-fee ab:cd');
    expect(sanitizeErrorMessage('fp 01:23:45:67:89:00:11:22: bad')).toBe('fp [hex]: bad');
    expect(sanitizeErrorMessage('fp 01-23-45-67-89-00-11-22-')).toBe('fp [hex]-');
    expect(sanitizeErrorMessage('k 0123456789abcdef-0123-4567-89ab: x')).toBe('k [hex]: x');
  });

  it('replaces the whole run around 16 hex digits', () => {
    expect(sanitizeErrorMessage('k 0123456789abcdefXYZ12345678 x')).toBe('k [hex] x');
    expect(sanitizeErrorMessage('k XYZ0123456789abcdef x')).toBe('k [hex] x');
  });

  it('replaces name@host addresses without a top-level domain', () => {
    expect(sanitizeErrorMessage('pay alice@localhost failed')).toBe('pay [addr] failed');
  });

  it('keeps the URL path and replaces its query and fragment', () => {
    expect(sanitizeErrorMessage('GET https://h.example/v1/x?a=1&b=2 failed')).toBe(
      'GET https://h.example/v1/x?[q] failed',
    );
    expect(sanitizeErrorMessage('open https://h.example/p#secret')).toBe(
      'open https://h.example/p?[q]',
    );
  });

  it('changes nothing on a second run, so the error report can run it again', () => {
    const inputs = [
      ...KEY_MATERIAL.map(([, secret]) => `x ${secret} y`),
      '[addr] x?[q] [hex] [token] [words]',
      'sdk_load connect first_sync deadline visible hidden none TypeError network',
    ];
    for (const input of inputs) {
      const once = sanitizeErrorMessage(input);
      expect(sanitizeErrorMessage(once)).toBe(once);
    }
  });

  it('cuts the result to 200 characters after the replacements', () => {
    const hex = 'ab'.repeat(200);
    expect(sanitizeErrorMessage(`x ${hex}`)).toBe('x [hex]');
    const long = 'Failed to fetch '.repeat(30);
    expect(sanitizeErrorMessage(long)).toHaveLength(ERROR_MESSAGE_MAX_LENGTH);
    expect(sanitizeErrorMessage(long)).toBe(long.slice(0, ERROR_MESSAGE_MAX_LENGTH));
  });
});

describe('errorCause', () => {
  it('reports the name, the SDK kind, and the sanitized message of an Error', () => {
    const cause = errorCause(new Error(`Storage error: ${LEAK_MNEMONIC}`));
    expect(cause).toEqual({
      errorName: 'Error',
      errorCode: 'storage',
      errorMessage: 'Storage [words]',
    });
  });

  it('takes recovery words next to the phrase into the replaced run', () => {
    // `network` and `error` are BIP-39 words themselves (`storage` is not).
    expect(errorCause(new Error(`Network error: ${LEAK_MNEMONIC}`))).toEqual({
      errorName: 'Error',
      errorCode: 'network',
      errorMessage: '[words]',
    });
  });

  it('turns a several-word SDK kind into one code', () => {
    expect(errorCause(new Error('Service connectivity error: down')).errorCode).toBe(
      'service_connectivity',
    );
  });

  it('reports a subclass name such as RuntimeError and TypeError', () => {
    class RuntimeError extends Error {}
    Object.defineProperty(RuntimeError.prototype, 'name', { value: 'RuntimeError' });
    expect(errorCause(new RuntimeError('unreachable'))).toEqual({
      errorName: 'RuntimeError',
      errorCode: null,
      errorMessage: 'unreachable',
    });
    expect(errorCause(new TypeError('Failed to fetch')).errorName).toBe('TypeError');
  });

  it('reports the name of a DOMException and its numeric code', () => {
    const error = new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    expect(errorCause(error)).toEqual({
      errorName: 'QuotaExceededError',
      errorCode: '22',
      errorMessage: 'The quota has been exceeded.',
    });
  });

  it('prefers an own string code to the SDK kind', () => {
    const error = Object.assign(new Error('Generic error: x'), { code: 'ERR_CHUNK_LOAD' });
    expect(errorCause(error).errorCode).toBe('ERR_CHUNK_LOAD');
  });

  it('falls back to the constructor name when the name is not a string', () => {
    class SdkError extends Error {}
    const error = new SdkError('boom');
    Object.defineProperty(error, 'name', { value: 42, configurable: true });
    expect(errorCause(error).errorName).toBe('42');
    Object.defineProperty(error, 'name', { value: { nested: true } });
    expect(errorCause(error).errorName).toBe('SdkError');
  });

  it.each([
    ['a hex key', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
    ['recovery words', 'abandon_ability_able'],
    ['a name with spaces', 'Bad Name'],
    ['a name longer than 64 characters', `E${'r'.repeat(64)}`],
    ['an empty name', ''],
  ])('reports unknown for %s as the name and leaves no code', (_label, name) => {
    const error = Object.create(null) as Record<string, unknown>;
    error['name'] = name;
    error['code'] = name;
    error['message'] = 'boom';
    expect(errorCause(error)).toEqual({
      errorName: 'unknown',
      errorCode: null,
      errorMessage: 'boom',
    });
  });

  it('reports a fractional code as written and ignores a message that is not a string', () => {
    const error = { name: 'Error', code: 1.5, message: 7 };
    expect(errorCause(error)).toEqual({ errorName: 'Error', errorCode: '1.5', errorMessage: null });
  });

  it.each([-1, 1e21])('reports no code for the number %s', (code) => {
    // The number is not a name either, so the constructor names it.
    expect(errorCause({ name: code, code, message: 'x' })).toEqual({
      errorName: 'Object',
      errorCode: null,
      errorMessage: 'x',
    });
  });

  it('sanitizes a thrown string and reports the type of other primitives', () => {
    expect(errorCause('lnbc1500n1pj9xyzexample1234567890')).toEqual({
      errorName: 'string',
      errorCode: null,
      errorMessage: '[token]',
    });
    expect(errorCause(42)).toEqual({ errorName: 'number', errorCode: null, errorMessage: null });
    expect(errorCause(null).errorName).toBe('unknown');
    expect(errorCause(undefined).errorName).toBe('unknown');
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
      errorMessage: null,
    });
  });
});
