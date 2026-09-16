import { describe, expect, it } from 'vitest';
import { splitForumMessageQuotes } from '@/lib/forum-quote';

const ID_A = 'd8cd22dd-d5c4-46a8-82ed-38b4d2f551ec';
const ID_B = '444d655b-73a4-475a-b5fc-f7e36210e82e';
const ID_A_UPPER = 'D8CD22DD-D5C4-46A8-82ED-38B4D2F551EC';

describe('splitForumMessageQuotes', () => {
  it('returns the original text and no ids when nothing matches', () => {
    expect(splitForumMessageQuotes('just a note')).toEqual({
      displayText: 'just a note',
      ids: [],
    });
  });

  it('matches http and https hosts including localhost and www', () => {
    const httpsUrl = `see https://21.gifts/messages/${ID_A} please`;
    expect(splitForumMessageQuotes(httpsUrl)).toEqual({
      displayText: 'see please',
      ids: [ID_A],
    });
    const httpUrl = `see http://www.21.gifts/messages/${ID_A} please`;
    expect(splitForumMessageQuotes(httpUrl)).toEqual({
      displayText: 'see please',
      ids: [ID_A],
    });
    const localUrl = `see http://localhost:3000/messages/${ID_A} please`;
    expect(splitForumMessageQuotes(localUrl)).toEqual({
      displayText: 'see please',
      ids: [ID_A],
    });
  });

  it('accepts an optional trailing slash', () => {
    expect(splitForumMessageQuotes(`https://21.gifts/messages/${ID_A}/`)).toEqual({
      displayText: '',
      ids: [ID_A],
    });
  });

  it('does not treat extra path segments as a quote url', () => {
    const text = `https://21.gifts/messages/${ID_A}/extra`;
    expect(splitForumMessageQuotes(text)).toEqual({
      displayText: text,
      ids: [],
    });
  });

  it('does not match a uuid glued to extra characters', () => {
    const text = `https://21.gifts/messages/${ID_A}foo`;
    expect(splitForumMessageQuotes(text)).toEqual({
      displayText: text,
      ids: [],
    });
  });

  it('consumes query and hash until whitespace', () => {
    expect(
      splitForumMessageQuotes(`keep https://21.gifts/messages/${ID_A}?utm=1#top today`),
    ).toEqual({
      displayText: 'keep today',
      ids: [ID_A],
    });
  });

  it('keeps trailing prose punctuation after the uuid', () => {
    expect(splitForumMessageQuotes(`see https://21.gifts/messages/${ID_A}.`)).toEqual({
      displayText: 'see .',
      ids: [ID_A],
    });
    expect(splitForumMessageQuotes(`see https://21.gifts/messages/${ID_A}/.`)).toEqual({
      displayText: 'see .',
      ids: [ID_A],
    });
  });

  it('lowercases ids and keeps first-seen unique order', () => {
    const text = `https://21.gifts/messages/${ID_A_UPPER} then https://21.gifts/messages/${ID_B} and https://21.gifts/messages/${ID_A}`;
    expect(splitForumMessageQuotes(text)).toEqual({
      displayText: 'then and',
      ids: [ID_A, ID_B],
    });
  });

  it('strips only resolved ids when a set is provided', () => {
    const text = `intro https://21.gifts/messages/${ID_A} mid https://21.gifts/messages/${ID_B} end`;
    expect(splitForumMessageQuotes(text, new Set([ID_A]))).toEqual({
      displayText: `intro mid https://21.gifts/messages/${ID_B} end`,
      ids: [ID_A, ID_B],
    });
    expect(splitForumMessageQuotes(text, new Set([ID_A_UPPER]))).toEqual({
      displayText: `intro mid https://21.gifts/messages/${ID_B} end`,
      ids: [ID_A, ID_B],
    });
  });

  it('strips every matched url when resolvedIds is omitted', () => {
    const text = `https://21.gifts/messages/${ID_A} and https://21.gifts/messages/${ID_B}`;
    expect(splitForumMessageQuotes(text)).toEqual({
      displayText: 'and',
      ids: [ID_A, ID_B],
    });
  });

  it('collapses horizontal whitespace left by a removal', () => {
    expect(
      splitForumMessageQuotes(`just for information: https://21.gifts/messages/${ID_A}`),
    ).toEqual({
      displayText: 'just for information:',
      ids: [ID_A],
    });
    expect(splitForumMessageQuotes(`alpha   https://21.gifts/messages/${ID_A}   omega`)).toEqual({
      displayText: 'alpha omega',
      ids: [ID_A],
    });
  });

  it('preserves newlines around a stripped url', () => {
    const text = `hello\nhttps://21.gifts/messages/${ID_A}\nworld`;
    expect(splitForumMessageQuotes(text)).toEqual({
      displayText: 'hello\n\nworld',
      ids: [ID_A],
    });
  });

  it('does not collapse whitespace on lines that were not stripped', () => {
    const text = `keep  double\nhttps://21.gifts/messages/${ID_A}`;
    expect(splitForumMessageQuotes(text)).toEqual({
      displayText: 'keep  double',
      ids: [ID_A],
    });
  });

  it('returns an empty displayText for a url-only body', () => {
    expect(splitForumMessageQuotes(`https://21.gifts/messages/${ID_A}`)).toEqual({
      displayText: '',
      ids: [ID_A],
    });
  });

  it('leaves unresolved urls in the display text', () => {
    const text = `just for information: https://21.gifts/messages/${ID_A}`;
    expect(splitForumMessageQuotes(text, new Set())).toEqual({
      displayText: text,
      ids: [ID_A],
    });
  });

  it('ignores non-uuid message paths', () => {
    const text = 'see https://21.gifts/messages/not-a-uuid today';
    expect(splitForumMessageQuotes(text)).toEqual({
      displayText: text,
      ids: [],
    });
  });
});
