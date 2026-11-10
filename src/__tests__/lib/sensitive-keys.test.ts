import { describe, expect, it } from 'vitest';
import { SENSITIVE_KEYS, SENSITIVE_KEY_PARTS } from '@/lib/sensitive-keys';

describe('sensitive keys', () => {
  it('names the exact keys whose value is always removed', () => {
    expect([...SENSITIVE_KEYS]).toEqual(['pr', 'words', '21gifts.session']);
  });

  it('names the key fragments of every secret the wallet and the session hold', () => {
    for (const part of ['mnemonic', 'phrase', 'seed', 'prf', 'token', 'secret', 'password']) {
      expect(SENSITIVE_KEY_PARTS).toContain(part);
    }
  });

  it('holds only lower-case entries, as both lists are compared lower-case', () => {
    for (const entry of [...SENSITIVE_KEYS, ...SENSITIVE_KEY_PARTS]) {
      expect(entry).toBe(entry.toLowerCase());
    }
  });
});
