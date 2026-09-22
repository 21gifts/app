import { describe, expect, it } from 'vitest';
import { shortLinkPath, shortResourceUrl } from '@/lib/short-link';

const MEMBER_ID = 'd70c4763-3033-43da-817a-2c7de9938f27';
const NOTE_ID = '77e0510d-03a8-4063-8716-75d61178e7f1';
const NOTE_ID_UPPER = '77E0510D-03A8-4063-8716-75D61178E7F1';

describe('shortResourceUrl', () => {
  it('uses the first lowercased uuid group', () => {
    expect(shortResourceUrl('https://21.gifts', MEMBER_ID, `/members/${MEMBER_ID}`)).toBe(
      'https://21.gifts/l/d70c4763',
    );
    expect(shortResourceUrl('https://21.gifts', NOTE_ID, `/messages/${NOTE_ID}`)).toBe(
      'https://21.gifts/l/77e0510d',
    );
    expect(
      shortResourceUrl('http://localhost:3000', NOTE_ID_UPPER, `/messages/${NOTE_ID_UPPER}`),
    ).toBe('http://localhost:3000/l/77e0510d');
  });

  it('keeps the long path when the id is not a uuid', () => {
    expect(shortResourceUrl('https://21.gifts', 'm1', '/messages/m1')).toBe(
      'https://21.gifts/messages/m1',
    );
    expect(shortResourceUrl('https://21.gifts', '77e0510d', '/messages/77e0510d')).toBe(
      'https://21.gifts/messages/77e0510d',
    );
    expect(shortResourceUrl('https://21.gifts', '', '/messages/')).toBe(
      'https://21.gifts/messages/',
    );
  });
});

describe('shortLinkPath', () => {
  it('returns null for a non-object body', () => {
    expect(shortLinkPath(null)).toBeNull();
    expect(shortLinkPath(undefined)).toBeNull();
    expect(shortLinkPath('message')).toBeNull();
    expect(shortLinkPath(1)).toBeNull();
  });

  it('returns null when kind or id is missing or not a uuid', () => {
    expect(shortLinkPath({})).toBeNull();
    expect(shortLinkPath({ kind: 'message' })).toBeNull();
    expect(shortLinkPath({ id: NOTE_ID })).toBeNull();
    expect(shortLinkPath([])).toBeNull();
    expect(shortLinkPath({ kind: 'note', id: NOTE_ID })).toBeNull();
    expect(shortLinkPath({ kind: 'message', id: 1 })).toBeNull();
    expect(shortLinkPath({ kind: 'message', id: '77e0510d' })).toBeNull();
    expect(shortLinkPath({ kind: 'member', id: 'not-a-uuid' })).toBeNull();
  });

  it('lowercases a message or member uuid', () => {
    expect(shortLinkPath({ kind: 'message', id: NOTE_ID_UPPER, extra: true })).toBe(
      `/messages/${NOTE_ID}`,
    );
    expect(shortLinkPath({ kind: 'member', id: MEMBER_ID })).toBe(`/members/${MEMBER_ID}`);
  });
});
