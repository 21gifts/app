import { describe, expect, it } from 'vitest';
import { splitForumMessageQuotes, splitShortLinks } from '@/lib/forum-quote';

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

  it('keeps trailing prose punctuation after a query string', () => {
    expect(splitForumMessageQuotes(`see https://21.gifts/messages/${ID_A}?utm=1). today`)).toEqual({
      displayText: 'see ). today',
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

const CODE_A = 'd8cd22dd';
const CODE_B = '77e0510d';

describe('splitShortLinks', () => {
  it('returns the original text and no codes when nothing matches', () => {
    expect(splitShortLinks('just a note')).toEqual({ displayText: 'just a note', codes: [] });
    const messageUrl = `see https://21.gifts/messages/${ID_A} please`;
    expect(splitShortLinks(messageUrl)).toEqual({ displayText: messageUrl, codes: [] });
  });

  it('matches http and https hosts including localhost and www', () => {
    expect(splitShortLinks(`see https://21.gifts/l/${CODE_A} please`)).toEqual({
      displayText: 'see please',
      codes: [CODE_A],
    });
    expect(splitShortLinks(`see http://www.21.gifts/l/${CODE_A} please`)).toEqual({
      displayText: 'see please',
      codes: [CODE_A],
    });
    expect(splitShortLinks(`see http://localhost:3000/l/${CODE_A} please`)).toEqual({
      displayText: 'see please',
      codes: [CODE_A],
    });
  });

  it('accepts a trailing slash and keeps prose punctuation', () => {
    expect(splitShortLinks(`https://21.gifts/l/${CODE_A}/`)).toEqual({
      displayText: '',
      codes: [CODE_A],
    });
    expect(splitShortLinks(`see https://21.gifts/l/${CODE_A}.`)).toEqual({
      displayText: 'see .',
      codes: [CODE_A],
    });
    expect(splitShortLinks(`see https://21.gifts/l/${CODE_A}/.`)).toEqual({
      displayText: 'see .',
      codes: [CODE_A],
    });
  });

  it('does not match extra path, glued characters, or a full uuid', () => {
    const extra = `https://21.gifts/l/${CODE_A}/extra`;
    expect(splitShortLinks(extra)).toEqual({ displayText: extra, codes: [] });
    const glued = `https://21.gifts/l/${CODE_A}foo`;
    expect(splitShortLinks(glued)).toEqual({ displayText: glued, codes: [] });
    const full = `https://21.gifts/l/${ID_A}`;
    expect(splitShortLinks(full)).toEqual({ displayText: full, codes: [] });
    const short = 'see https://21.gifts/l/d70c476 today';
    expect(splitShortLinks(short)).toEqual({ displayText: short, codes: [] });
  });

  it('consumes query and hash and keeps trailing punctuation', () => {
    expect(splitShortLinks(`keep https://21.gifts/l/${CODE_A}?utm=1#top today`)).toEqual({
      displayText: 'keep today',
      codes: [CODE_A],
    });
    expect(splitShortLinks(`see https://21.gifts/l/${CODE_A}?utm=1). today`)).toEqual({
      displayText: 'see ). today',
      codes: [CODE_A],
    });
    expect(splitShortLinks(`see https://21.gifts/l/${CODE_A}#top today`)).toEqual({
      displayText: 'see today',
      codes: [CODE_A],
    });
  });

  it('lowercases codes and keeps first-seen unique order', () => {
    const text = [
      `https://21.gifts/l/${CODE_A.toUpperCase()}`,
      `then https://21.gifts/l/${CODE_B}`,
      `and https://21.gifts/l/${CODE_A}`,
    ].join(' ');
    expect(splitShortLinks(text)).toEqual({
      displayText: 'then and',
      codes: [CODE_A, CODE_B],
    });
  });

  it('strips only resolved codes when a set is provided', () => {
    const text = `intro https://21.gifts/l/${CODE_A} mid https://21.gifts/l/${CODE_B} end`;
    expect(splitShortLinks(text, new Set([CODE_A]))).toEqual({
      displayText: `intro mid https://21.gifts/l/${CODE_B} end`,
      codes: [CODE_A, CODE_B],
    });
    expect(splitShortLinks(text, new Set([CODE_A.toUpperCase()]))).toEqual({
      displayText: `intro mid https://21.gifts/l/${CODE_B} end`,
      codes: [CODE_A, CODE_B],
    });
    expect(splitShortLinks(text, new Set())).toEqual({
      displayText: text,
      codes: [CODE_A, CODE_B],
    });
  });

  it('collapses horizontal whitespace and preserves other lines', () => {
    expect(splitShortLinks(`just for information: https://21.gifts/l/${CODE_A}`)).toEqual({
      displayText: 'just for information:',
      codes: [CODE_A],
    });
    expect(splitShortLinks(`alpha   https://21.gifts/l/${CODE_A}   omega`)).toEqual({
      displayText: 'alpha omega',
      codes: [CODE_A],
    });
    expect(splitShortLinks(`hello\nhttps://21.gifts/l/${CODE_A}\nworld`)).toEqual({
      displayText: 'hello\n\nworld',
      codes: [CODE_A],
    });
    expect(splitShortLinks(`keep  double\nhttps://21.gifts/l/${CODE_A}`)).toEqual({
      displayText: 'keep  double',
      codes: [CODE_A],
    });
  });

  it('leaves short links alone in splitForumMessageQuotes', () => {
    const text = `see https://21.gifts/l/${CODE_A} please`;
    expect(splitForumMessageQuotes(text)).toEqual({ displayText: text, ids: [] });
  });
});
