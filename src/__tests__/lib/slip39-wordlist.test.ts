import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { SLIP39_WORDLIST } from '@/lib/slip39-wordlist';

/** SHA-256 of the pinned word list file (`wordlist.txt`, one word per line). */
const WORDLIST_SHA256 = 'bcc4555340332d169718aed8bf31dd9d5248cb7da6e5d355140ef4f1e601eec3';

describe('SLIP39_WORDLIST', () => {
  it('is the pinned list: 1024 sorted, unique words of 4 to 8 letters with unique prefixes', () => {
    expect(SLIP39_WORDLIST).toHaveLength(1024);
    expect(SLIP39_WORDLIST[0]).toBe('academic');
    expect(SLIP39_WORDLIST[1023]).toBe('zero');
    expect([...SLIP39_WORDLIST].sort()).toEqual(SLIP39_WORDLIST);
    expect(new Set(SLIP39_WORDLIST).size).toBe(1024);
    expect(new Set(SLIP39_WORDLIST.map((word) => word.slice(0, 4))).size).toBe(1024);
    expect(SLIP39_WORDLIST.every((word) => /^[a-z]{4,8}$/.test(word))).toBe(true);
    expect(
      createHash('sha256')
        .update(`${SLIP39_WORDLIST.join('\n')}\n`)
        .digest('hex'),
    ).toBe(WORDLIST_SHA256);
  });
});
