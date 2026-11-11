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

  it.each(['%2c', '%2C', '%0a', '%5f', '%2d', '%2e', '\\n', '\\t', '&nbsp;', '&amp;'])(
    'replaces recovery words joined by the escaped separator %j',
    (separator) => {
      const phrase = LEAK_MNEMONIC.split(' ').join(separator);
      expect(sanitizeErrorMessage(`bad ${phrase} here`)).toBe('bad [words] here');
    },
  );

  it('replaces recovery words with invisible characters inside or in fullwidth letters', () => {
    expect(sanitizeErrorMessage('bad le\u200Bgal win\u00ADner th\uFEFFank year')).toBe(
      'bad [words]',
    );
    expect(sanitizeErrorMessage('bad ｌｅｇａｌ ｗｉｎｎｅｒ ＴＨＡＮＫ here')).toBe(
      'bad [words] here',
    );
    expect(sanitizeErrorMessage('bad abandon\u200Bability\u2060able here')).toBe(
      'bad [words] here',
    );
    expect(sanitizeErrorMessage('x\u200Babandon\u200Bability\u200Bable\u200By')).toBe(
      'x\u200B[words]\u200By',
    );
    expect(sanitizeErrorMessage('ab\u200Bandon\u200Bability\u200Bable here')).toBe('[words] here');
    expect(sanitizeErrorMessage('x\u200Bab\u200Ban\u200Bdon\u200Babi\u200Blity\u200Bable')).toBe(
      'x\u200B[words]',
    );
    expect(sanitizeErrorMessage('qq\u200Bzz\u200Babandon x')).toBe('qq\u200Bzz\u200Babandon x');
    expect(sanitizeErrorMessage('abandon\u200Bability\u200Bab\u200Bandon x')).toBe('[words] x');
    expect(sanitizeErrorMessage('qqqqq\u200Bzzzzz\u200Babandon ability x')).toBe(
      'qqqqq\u200Bzzzzz\u200Babandon ability x',
    );
    expect(sanitizeErrorMessage('\u200B\u200Babandon\u200Bability\u200Bable')).toBe(
      '\u200B\u200B[words]',
    );
    expect(sanitizeErrorMessage('100%25 done, see &lt;x&gt; and C:\\temp')).toBe(
      '100%25 done, see &lt;x&gt; and C:\\temp',
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

  it('reads hostile messages in linear time', () => {
    // A ratio, not a fixed time: CI runners vary several-fold in speed, but a
    // quadratic step still grows about 16-fold when its input grows 4-fold.
    const hostile: ReadonlyArray<readonly [string, string, string]> = [
      ['letters', 'a', ''],
      ['dotted letters', 'x.', ''],
      ['a long name before @', 'b', '@'],
      ['URLs', 'http://a,', ''],
      ['paths', '(/a', ''],
      ['paths after =', '=/a', ''],
      ['colons', 'a:', ''],
      ['accents before @', "é'", '@'],
      ['recovery words', 'add add add x ', ''],
      ['JWT starts', 'eyJ-', ''],
      ['quotes', '"a', ''],
      ['escaped quotes', '\\"', ''],
      ['ampersands', '&a', ''],
      ['percent signs', '%2', ''],
      ['zero-width spaces', '\u200B', ''],
      ['split words', 'ab\u200B', ''],
      ['query marks', 'x/?', ''],
      ['query values', '/x?a= ', ''],
      ['spaces', ' ', 'x'],
      ['labels with open brackets', 'token: [', ''],
      ['labels with spaces', 'seed   ', ''],
      ['labels with closed quotes', 'token: "a" ', ''],
      ['labels with closed brackets', 'seed=[1] ', ''],
      ['labels with placeholders', 'token: [token] ', ''],
      ['labels on lines', 'token: a\n', ''],
      ['typed names on lines', 'prf: A \n', ''],
      ['escaped quotes in brackets', 'token: ["a\\', ''],
      ['label words', 'PRF\u00A0', ':'],
    ];
    const message = (unit: string, end: string, length: number): string =>
      unit.repeat(Math.ceil(length / unit.length)) + end;
    // Each timing is a batch of runs that takes at least BATCH_MS, far above
    // the timer's resolution, so no floor is needed. Small and large batches
    // alternate, so both see the same load, and each keeps its fastest of five.
    const BATCH_MS = 5;
    const batch = (run: (text: string) => unknown, text: string, runs: number): number => {
      const started = performance.now();
      for (let left = runs; left > 0; left -= 1) {
        run(text);
      }
      return performance.now() - started;
    };
    const growth = (run: (text: string) => unknown, small: string, large: string): number => {
      run(large);
      let runs = 1;
      while (batch(run, small, runs) < BATCH_MS) {
        runs *= 2;
      }
      let bestSmall = Number.POSITIVE_INFINITY;
      let bestLarge = Number.POSITIVE_INFINITY;
      for (let round = 0; round < 5; round += 1) {
        bestSmall = Math.min(bestSmall, batch(run, small, runs));
        bestLarge = Math.min(bestLarge, batch(run, large, runs));
      }
      return bestLarge / bestSmall;
    };
    for (const [name, unit, end] of hostile) {
      const ratio = growth(
        sanitizeErrorMessage,
        message(unit, end, 25_000),
        message(unit, end, 100_000),
      );
      expect(ratio, name).toBeLessThan(8);
    }
    // Control: the same measurement of a quadratic step stays above the bound.
    const quadratic = (text: string): number => {
      let found = 0;
      for (let at = 0; at < text.length; at += 1) {
        found += text.lastIndexOf('b', at);
      }
      return found;
    };
    expect(growth(quadratic, 'a'.repeat(1_000), 'a'.repeat(4_000))).toBeGreaterThan(8);
    // Backstop: about 1 MB of all patterns together stays far below 10 s.
    const all = hostile.map(([, unit, end]) => message(unit, end, 40_000)).join(' ');
    const started = performance.now();
    sanitizeErrorMessage(all);
    expect(performance.now() - started).toBeLessThan(10_000);
  }, 120_000);

  it('replaces the whole name of an address in any script', () => {
    expect(sanitizeErrorMessage('Failed to send to andré@example.com')).toBe(
      'Failed to send to [addr]',
    );
    expect(sanitizeErrorMessage("to maximilian.o'brien@example.com now")).toBe('to [addr] now');
    expect(sanitizeErrorMessage('in node_modules/@breeztech/x')).toBe(
      'in node_modules/@breeztech/x',
    );
  });

  it('replaces a query value that goes on after a space or a line break', () => {
    const cases: ReadonlyArray<readonly [string, string]> = [
      [
        'GET https://api.example.com/v1/checkout? apiKey=sk_live_51abc failed',
        'GET https://api.example.com/v1/checkout?[q] [q] failed',
      ],
      ['request failed /x?apiKey= 0af56e12dead x', 'request failed /x?[q] [q] x'],
      [
        'https://api.example.com/oauth/callback?\ncode=Zq8xLm2Vb9Kp&\nstate=xyz done',
        'https://api.example.com/oauth/callback?[q]\n[q]\n[q] done',
      ],
      ['/x?a=1& b= c d', '/x?[q] [q] [q] d'],
    ];
    for (const [message, sent] of cases) {
      expect(sanitizeErrorMessage(message)).toBe(sent);
      expect(sanitizeErrorMessage(sent)).toBe(sent);
    }
    expect(sanitizeErrorMessage('what? and = sign')).toBe('what? and = sign');
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

  it('cuts at a word, so a second run neither replaces a cut word nor sees a cut placeholder', () => {
    const words = `${'z'.repeat(176)} abandon ability abilityx`;
    const once = sanitizeErrorMessage(words);
    expect(once).toBe(`${'z'.repeat(176)} abandon ability`);
    expect(sanitizeErrorMessage(once)).toBe(once);
    const hex = sanitizeErrorMessage(`${'z'.repeat(195)} 0123456789abcdef`);
    expect(hex).toBe('z'.repeat(195));
    const oneWord = sanitizeErrorMessage(`${'z'.repeat(150)}(${'y'.repeat(30)}[${'x'.repeat(40)}`);
    expect(oneWord).toBe(`${'z'.repeat(150)}(`);
    expect(sanitizeErrorMessage(oneWord)).toBe(oneWord);
  });

  it('changes nothing on a second run for random messages near the length limit', () => {
    const parts = [
      'abandon',
      'ability',
      'able',
      'x',
      'zz',
      '0123456789abcdef',
      'lnbc1qqqqqq',
      'a@b.c',
      '/p?k=v',
      '?',
      '=',
      '&',
      ':',
      '"',
      '\\',
      '%2c',
      '\u200B',
      'token=',
      'api_key:',
      '[hex]',
      '(',
      ')',
      '.',
      '-',
      '_',
      'Ab1',
      'eyJ',
      'https://h.example/',
      ' ',
      ' ',
      ' ',
      '\n',
    ];
    let seed = 7;
    const next = (): number => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return seed;
    };
    for (let round = 0; round < 3_000; round += 1) {
      let message = '';
      const length = 150 + (next() % 120);
      while (message.length < length) {
        message += parts[next() % parts.length];
      }
      const once = sanitizeErrorMessage(message);
      expect(once.length).toBeLessThanOrEqual(ERROR_MESSAGE_MAX_LENGTH);
      expect(sanitizeErrorMessage(once), JSON.stringify(message)).toBe(once);
    }
  });

  it.each([
    ['api_key=gggggggggggggggggggggggggggggggggggggggg', 'api_key=[token]'],
    ['failed with token: abc', 'failed with token: [token]'],
    ['{"secret": "two words", "n": 1}', '{"secret": [token], "n": 1}'],
    ['username=alice next', 'username=[token]'],
    ['username=alice next\nsecond line', 'username=[token]\nsecond line'],
    ['PRF output: 7,7,7,7', 'PRF output: [token]'],
    ['seed: 1, 2, 3; ok', 'seed: [token]'],
    ['PRF output: Uint8Array(4) [17, 34, 51, 68] done', 'PRF output: [token]'],
    ['PRF output: Uint8Array [17, 34, 51, 68]', 'PRF output: [token]'],
    ['PRF output: Uint8Array(4)  \t [17, 34, 51, 68]', 'PRF output: [token]'],
    ['prf: Uint8Array(4) [\n  17, 34,\n  51, 68\n]\nnext', 'prf: [token]\nnext'],
    ['prf: Uint8Array\n[\n  17, 34\n]\nnext', 'prf: [token]\nnext'],
    ['{"prf": [\n  17,\n  34\n], "n": 1}', '{"prf": [token], "n": 1}'],
    ['seed=[17, 34] x', 'seed=[token] x'],
    ['token: ["ab]cdefghijkl", 1] x', 'token: [token] x'],
    ['token: [unclosed 17, 34\nnext line', 'token: [token]\nnext line'],
    [`token: [${'17, 34, '.repeat(200)}99`, 'token: [token]'],
    [`secret: "${'ab cd ef '.repeat(40)}" tail`, 'secret: [token] tail'],
    [`secret: '${'ab cd ef '.repeat(40)}\nnext`, 'secret: [token]\nnext'],
    ['secret: "a\\"b c" tail', 'secret: [token] tail'],
    ['PRF    = 17, 34, 51, 68', 'PRF    = [token]'],
    ['PRF\toutput: 17, 34', 'PRF\toutput: [token]'],
    ['PRF  output: 17, 34', 'PRF  output: [token]'],
    ['PRF\u00A0output: 17, 34', 'PRF\u00A0output: [token]'],
    ['PRF\u3000output: 17, 34', 'PRF\u3000output: [token]'],
    ['prf_output=17, 34', 'prf_output=[token]'],
    ['prfOutput=17, 34', 'prfOutput=[token]'],
    ['P\u200BRF output: 17, 34', 'P\u200BRF output: [token]'],
    ['ＰＲＦ output: 17, 34', 'ＰＲＦ output: [token]'],
    ['the derived PRF output: 17, 34', 'the derived PRF output: [token]'],
    ['token\t:\n  abc def', 'token\t:\n  [token]'],
    ['bad password = hunter2;', 'bad password = [token]'],
    ['Authorization:Bearer xyz', 'Authorization:[token]'],
    ['x-api-key= qwerty end', 'x-api-key= [token]'],
    ['user: [addr]', 'user: [addr]'],
    ['user: [addr], bob', 'user: [token]'],
    ['token: [hex], bob', 'token: [token]'],
    ['token: [token] (retry)', 'token: [token] (retry)'],
    ['bad pr: abc def', 'bad pr: [token]'],
    ['prf: Uint8Array(4) [17, 34\nnext', 'prf: [token]\nnext'],
    ['words = alpha beta', 'words = [token]'],
    ['print: abc', 'print: abc'],
  ])('replaces the whole value after a secret-naming label in %j', (message, sent) => {
    expect(sanitizeErrorMessage(message)).toBe(sent);
    expect(sanitizeErrorMessage(sent)).toBe(sent);
  });

  it('keeps a base64 key padding and a comparison from reading as a label', () => {
    expect(sanitizeErrorMessage('key abc== x')).toBe('key abc== x');
    expect(sanitizeErrorMessage('if key == 1')).toBe('if key == 1');
  });

  it('replaces every value after random secret labels, spellings, and value shapes', () => {
    let seed = 11;
    const next = (below: number): number => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return Math.floor(seed / 65_536) % below;
    };
    const pick = <T>(items: readonly T[]): T => items[next(items.length)] as T;
    const labels: ReadonlyArray<readonly string[]> = [
      ['PRF', 'output'],
      ['prf'],
      ['api', 'key'],
      ['x', 'api', 'key'],
      ['session', 'token'],
      ['Auth'],
      ['password'],
      ['seed', 'phrase'],
      ['recovery', 'mnemonic'],
      ['user', 'name'],
      ['client', 'secret'],
      ['the', 'PRF', 'output'],
    ];
    const joins = [' ', '  ', '\t', ' \t ', '\u00A0', '\u2003', '\u3000', '_', '-', '', '\u200B'];
    const cases = [
      (word: string): string => word,
      (word: string): string => word.toUpperCase(),
      (word: string): string => word.toLowerCase(),
      (word: string): string => word.charAt(0).toUpperCase() + word.slice(1),
    ];
    const separators = [':', ' : ', '=', ' =\t', ':\n  ', '": ', "'=", '\u00A0:\u00A0'];
    const before = ['', 'connect failed: ', '{"', 'x ', 'Error (wallet) '];
    const digits = '0123456789';
    const letters = 'QWXZqwxz';
    const piece = (length: number): string =>
      Array.from({ length }, () => pick([...digits, ...letters])).join('');
    const bytes = (count: number, join: string): string =>
      Array.from({ length: count }, () => String(next(256))).join(join);
    const shapes: ReadonlyArray<(secret: string) => readonly [string, string]> = [
      (secret) => [secret, '\nnext line'],
      (secret) => [`${secret} ${piece(12)} ${piece(12)}`, '\nnext line'],
      (secret) => [`"${secret} ${piece(250)}"`, ' tail'],
      (secret) => [`'${secret} \\' ${piece(30)}'`, ' tail'],
      (secret) => [`\`${secret}\``, ' tail'],
      (secret) => [`"${secret} unclosed`, '\nnext line'],
      (secret) => [`[${bytes(32, ', ')}, "${secret}"]`, ' tail'],
      (secret) => [`{"a": [1, 2], "b": "${secret}"}`, ' tail'],
      (secret) => [`Uint8Array(32) [${bytes(32, ', ')}, ${secret}]`, ''],
      (secret) => [`Uint8Array [${bytes(32, ', ')}, ${secret}]`, ''],
      (secret) => [`Uint8Array(32)  \t[\n  ${bytes(16, ', ')},\n  ${secret}\n]`, '\nnext line'],
      (secret) => [`[\n  ${bytes(16, ',\n  ')},\n  "${secret}"\n]`, '\nnext line'],
      (secret) => [`[${bytes(32, ', ')} ${secret}`, '\nnext line'],
      (secret) => [`${bytes(32, ',')},${secret}`, '\nnext line'],
    ];
    for (let round = 0; round < 2_000; round += 1) {
      const words = pick(labels);
      const join = pick(joins);
      const label = words.map(pick(cases)).join(join);
      const secret = piece(24);
      const [value, after] = pick(shapes)(secret);
      const message = `${pick(before)}${label}${pick(separators)}${value}${after}`;
      const once = sanitizeErrorMessage(message);
      const shown = JSON.stringify(message);
      for (let at = 0; at + 10 <= value.length; at += 1) {
        const window = value.slice(at, at + 10);
        if (!message.replace(value, '').includes(window)) {
          expect(once.includes(window), `${shown} kept ${JSON.stringify(window)}`).toBe(false);
        }
      }
      expect(sanitizeErrorMessage(once), shown).toBe(once);
    }
  });

  it('cuts the result to 200 characters after the replacements', () => {
    const hex = 'ab'.repeat(200);
    expect(sanitizeErrorMessage(`x ${hex}`)).toBe('x [hex]');
    const long = 'Failed to fetch '.repeat(30);
    const cut = sanitizeErrorMessage(long);
    expect(cut.length).toBeLessThanOrEqual(ERROR_MESSAGE_MAX_LENGTH);
    expect(cut).toBe('Failed to fetch '.repeat(12) + 'Failed');
  });
});

describe('errorCause', () => {
  it('reports only class-shaped names and constant-shaped or SDK-kind codes', () => {
    expect(errorCause({ name: 'alice', code: 'account_alice', message: 'x' })).toEqual({
      errorName: 'unknown',
      errorCode: null,
      errorMessage: 'x',
    });
    const chunk = Object.assign(new Error('x'), { name: 'ChunkLoadError', code: 'ERR_CHUNK_LOAD' });
    expect(errorCause(chunk)).toMatchObject({
      errorName: 'ChunkLoadError',
      errorCode: 'ERR_CHUNK_LOAD',
    });
    const dom = { name: 'QuotaExceededError', code: 22, message: 'x' };
    expect(errorCause(dom)).toMatchObject({ errorName: 'QuotaExceededError', errorCode: '22' });
  });

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

  it('reports no code when the SDK kind is made of recovery words', () => {
    const cause = errorCause(new Error('add age aim air all ant arm art ask and error: fail'));
    expect(cause.errorCode).toBeNull();
    expect(JSON.stringify(cause)).not.toMatch(/aim|air|arm|art|ask/);
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
    expect(errorCause(error).errorName).toBe('SdkError');
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

  it('reports no fractional code and ignores a message that is not a string', () => {
    const error = { name: 'Error', code: 1.5, message: 7 };
    expect(errorCause(error)).toEqual({ errorName: 'Error', errorCode: null, errorMessage: null });
  });

  it.each([-1, 1e21])('reports no code for the number %s', (code) => {
    // Neither the number nor the constructor name `Object` is an error name.
    expect(errorCause({ name: code, code, message: 'x' })).toEqual({
      errorName: 'unknown',
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
