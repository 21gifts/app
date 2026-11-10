import { describe, expect, it } from 'vitest';
import { SENSITIVE_KEYS, SENSITIVE_KEY_PARTS } from '@/lib/sensitive-keys';

describe('sensitive keys', () => {
  it('names the exact keys whose value is always removed', () => {
    expect([...SENSITIVE_KEYS]).toEqual(['pr', 'words', '21gifts.session']);
  });

  it('names every key fragment whose value is always removed', () => {
    expect(SENSITIVE_KEY_PARTS).toEqual([
      'mnemonic',
      'phrase',
      'seed',
      'share',
      'slip39',
      'prf',
      'token',
      'secret',
      'invoice',
      'password',
      'authorization',
      'cookie',
      'query',
      'fragment',
    ]);
  });

  it('holds only lower-case entries, as both lists are compared lower-case', () => {
    for (const entry of [...SENSITIVE_KEYS, ...SENSITIVE_KEY_PARTS]) {
      expect(entry).toBe(entry.toLowerCase());
    }
  });
});
