import { describe, expect, it } from 'vitest';
import type { ForumMessage } from '@/lib/api-types';
import { DEFAULT_FORUM_FEED_MODE, FORUM_FEED_MODES, visibleForumMessages } from '@/lib/forum-feed';

const ADA: ForumMessage = {
  id: 'm3',
  name: 'Ada',
  text: 'Thank you both — that helps.',
  createdAt: '2026-08-28T12:00:00.000Z',
  sats: 5,
  payable: true,
  hasPhoto: false,
  hasVideo: false,
  videoContentType: null,
  role: 'basis',
};

const CAROL: ForumMessage = {
  id: 'm2',
  name: 'Carol',
  text: 'I can send a small gift tomorrow.',
  createdAt: '2026-08-28T11:00:00.000Z',
  sats: 21,
  payable: true,
  hasPhoto: false,
  hasVideo: false,
  videoContentType: null,
  role: 'basis',
};

const BOB: ForumMessage = {
  id: 'm1',
  name: 'Bob',
  text: 'Does anyone have spare sats this week?',
  createdAt: '2026-08-28T10:00:00.000Z',
  sats: 0,
  payable: true,
  hasPhoto: false,
  hasVideo: false,
  videoContentType: null,
  role: 'basis',
};

const TIE_NEWER: ForumMessage = {
  id: 'tie-z',
  name: 'Ann',
  text: 'Newer tie',
  createdAt: '2026-08-28T14:00:00.000Z',
  sats: 10,
  payable: true,
  hasPhoto: false,
  hasVideo: false,
  videoContentType: null,
  role: 'basis',
};

const TIE_OLDER: ForumMessage = {
  id: 'tie-b',
  name: 'Ben',
  text: 'Older tie',
  createdAt: '2026-08-28T13:00:00.000Z',
  sats: 10,
  payable: true,
  hasPhoto: false,
  hasVideo: false,
  videoContentType: null,
  role: 'basis',
};

const TIE_SAME_TIME_LOW_ID: ForumMessage = {
  id: 'tie-c',
  name: 'Cal',
  text: 'Same time, lower id',
  createdAt: '2026-08-28T14:00:00.000Z',
  sats: 10,
  payable: true,
  hasPhoto: false,
  hasVideo: false,
  videoContentType: null,
  role: 'basis',
};

describe('forum-feed', () => {
  it('defaults to active and lists modes Active → All → Most popular', () => {
    expect(DEFAULT_FORUM_FEED_MODE).toBe('active');
    expect(FORUM_FEED_MODES).toEqual(['active', 'all', 'popular']);
  });

  it('all preserves order including zero-sat rows', () => {
    const input = [ADA, CAROL, BOB];
    expect(visibleForumMessages(input, 'all')).toEqual([ADA, CAROL, BOB]);
  });

  it('active drops zero-sat rows and keeps relative order', () => {
    expect(visibleForumMessages([ADA, CAROL, BOB], 'active')).toEqual([ADA, CAROL]);
  });

  it('popular drops zero-sat rows and sorts by sats descending', () => {
    expect(visibleForumMessages([ADA, CAROL, BOB], 'popular')).toEqual([CAROL, ADA]);
  });

  it('popular breaks equal sats by newer createdAt first', () => {
    expect(visibleForumMessages([TIE_OLDER, TIE_NEWER], 'popular')).toEqual([TIE_NEWER, TIE_OLDER]);
  });

  it('popular breaks equal sats and createdAt by higher id first', () => {
    expect(visibleForumMessages([TIE_SAME_TIME_LOW_ID, TIE_NEWER], 'popular')).toEqual([
      TIE_NEWER,
      TIE_SAME_TIME_LOW_ID,
    ]);
  });

  it('does not mutate the input array or its order', () => {
    const input = [ADA, CAROL, BOB];
    const snapshot = [...input];
    const active = visibleForumMessages(input, 'active');
    const popular = visibleForumMessages(input, 'popular');
    expect(input).toEqual(snapshot);
    expect(input).toBe(input);
    expect(active).not.toBe(input);
    expect(popular).not.toBe(input);
    expect(visibleForumMessages(input, 'all')).not.toBe(input);
  });
});
