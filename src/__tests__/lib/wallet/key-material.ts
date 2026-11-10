import { expect } from 'vitest';

/** Real-looking recovery phrase (a BIP-39 test vector). */
export const LEAK_MNEMONIC =
  'legal winner thank year wave sausage worth useful legal winner thank yellow';

/** Value of the `apiKey` query parameter in {@link KEY_MATERIAL}. */
const API_KEY_VALUE = 'MIIBfzCCATGgAwIBAgIHPeVmbKG3KTAFBgMrZXAw';

/**
 * Key material an error message could carry: label, the text as it appears
 * in the message, the placeholder the sanitizer leaves, and the secret part
 * that must never be sent.
 */
export const KEY_MATERIAL: ReadonlyArray<readonly [string, string, string, string]> = [
  ['a 12-word recovery phrase', LEAK_MNEMONIC, '[words]', LEAK_MNEMONIC],
  [
    'a 64-hex key',
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    '[hex]',
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  ],
  [
    'a 66-hex compressed public key',
    '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
    '[hex]',
    '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
  ],
  [
    'a BOLT11 invoice',
    'lnbc2500u1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdq5xysxxatsyp3k7enxv4jsxqzpuaztrnwngzn3kdzw5hydlzf03qdgm2hdq27cqv3agm2awhz5se903vruatfhq77w3ls4evs3ch9zw97j25emudupq63nyw24cg27h2rspfj9srp',
    '[token]',
    'lnbc2500u1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdq5xysxxatsyp3k7enxv4jsxqzpuaztrnwngzn3kdzw5hydlzf03qdgm2hdq27cqv3agm2awhz5se903vruatfhq77w3ls4evs3ch9zw97j25emudupq63nyw24cg27h2rspfj9srp',
  ],
  [
    'a Spark address',
    'spark1pgssyuuuhnrrdjswal5c3s3rafw9w3y5dd4cjy3duxlf7hjzkp0rqx6dj6mrhu',
    '[token]',
    'spark1pgssyuuuhnrrdjswal5c3s3rafw9w3y5dd4cjy3duxlf7hjzkp0rqx6dj6mrhu',
  ],
  [
    'an extended private key',
    'xprv9s21ZrQH143K3QTDL4LXw2F7HEK3wJUD2nW2nRk4stbPy6cq3jPPqjiChkVvvNKmPGJxWUtg6LnF5kejMRNNU3TGtRBeJgk33yuGBxrMPHi',
    '[token]',
    'xprv9s21ZrQH143K3QTDL4LXw2F7HEK3wJUD2nW2nRk4stbPy6cq3jPPqjiChkVvvNKmPGJxWUtg6LnF5kejMRNNU3TGtRBeJgk33yuGBxrMPHi',
  ],
  [
    'a JSON web token',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
    '[token]',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
  ],
  ['an e-mail address', 'user@21.gifts', '[addr]', 'user@21.gifts'],
  [
    'an API key in a URL query',
    `https://api.example.com/v1/connect?apiKey=${API_KEY_VALUE}&network=mainnet`,
    'https://api.example.com/v1/connect?[q]',
    `apiKey=${API_KEY_VALUE}`,
  ],
];

/** Shortest piece of a secret that must not appear anywhere in a report. */
const WINDOW = 10;

/**
 * Asserts that no secret of {@link KEY_MATERIAL}, and no piece of
 * {@link WINDOW} characters of one, appears in `sent`.
 *
 * @param sent - Everything that was sent, as text.
 */
export function expectNoKeyMaterial(sent: string): void {
  for (const [label, , , secret] of KEY_MATERIAL) {
    for (let at = 0; at + WINDOW <= secret.length; at += 1) {
      const piece = secret.slice(at, at + WINDOW);
      expect(sent.includes(piece), `${label}: "${piece}" was sent`).toBe(false);
    }
  }
}
