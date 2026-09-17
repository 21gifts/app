import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ForumMessage } from '@/lib/api-types';
import {
  DEFAULT_FORUM_FEED_MODE,
  FORUM_COMPOSE_EVENT,
  FORUM_FEED_MODES,
  consumePendingForumCompose,
  consumeSkipIntroduceOverlay,
  hasUnseenForumPosts,
  unpaidNewCount,
  requestForumCompose,
  visibleForumMessages,
} from '@/lib/forum-feed';

const ADA: ForumMessage = {
  id: 'm3',
  name: 'Ada',
  text: 'Thank you both — that helps.',
  createdAt: '2026-08-28T12:00:00.000Z',
  sats: 5,
  payable: true,
  hasPhoto: false,
  photoCount: 0,
  hasVideo: false,
  videoContentType: null,
  role: 'basis',
  replyCount: 0,
};

const CAROL: ForumMessage = {
  id: 'm2',
  name: 'Carol',
  text: 'I can send a small gift tomorrow.',
  createdAt: '2026-08-28T11:00:00.000Z',
  sats: 21,
  payable: true,
  hasPhoto: false,
  photoCount: 0,
  hasVideo: false,
  videoContentType: null,
  role: 'basis',
  replyCount: 0,
};

const BOB: ForumMessage = {
  id: 'm1',
  name: 'Bob',
  text: 'Does anyone have spare sats this week?',
  createdAt: '2026-08-28T10:00:00.000Z',
  sats: 0,
  payable: true,
  hasPhoto: false,
  photoCount: 0,
  hasVideo: false,
  videoContentType: null,
  role: 'basis',
  replyCount: 0,
};

const UNPAID_FOUNDER: ForumMessage = {
  id: 'm-founder',
  name: 'Eve',
  text: 'Founder unpaid note.',
  createdAt: '2026-08-28T13:00:00.000Z',
  sats: 0,
  payable: true,
  hasPhoto: false,
  photoCount: 0,
  hasVideo: false,
  videoContentType: null,
  role: 'founder',
  replyCount: 0,
};

const UNPAID_MODERATOR: ForumMessage = {
  id: 'm-mod',
  name: 'Dan',
  text: 'Moderator unpaid note.',
  createdAt: '2026-08-28T09:00:00.000Z',
  sats: 0,
  payable: true,
  hasPhoto: false,
  photoCount: 0,
  hasVideo: false,
  videoContentType: null,
  role: 'moderator',
  replyCount: 0,
};

const UNPAID_VERIFIED: ForumMessage = {
  id: 'm-ver',
  name: 'Fay',
  text: 'Verified unpaid note.',
  createdAt: '2026-08-28T12:30:00.000Z',
  sats: 0,
  payable: true,
  hasPhoto: false,
  photoCount: 0,
  hasVideo: false,
  videoContentType: null,
  role: 'verified',
  replyCount: 0,
};

const TIE_NEWER: ForumMessage = {
  id: 'tie-z',
  name: 'Ann',
  text: 'Newer tie',
  createdAt: '2026-08-28T14:00:00.000Z',
  sats: 10,
  payable: true,
  hasPhoto: false,
  photoCount: 0,
  hasVideo: false,
  videoContentType: null,
  role: 'basis',
  replyCount: 0,
};

const TIE_OLDER: ForumMessage = {
  id: 'tie-b',
  name: 'Ben',
  text: 'Older tie',
  createdAt: '2026-08-28T13:00:00.000Z',
  sats: 10,
  payable: true,
  hasPhoto: false,
  photoCount: 0,
  hasVideo: false,
  videoContentType: null,
  role: 'basis',
  replyCount: 0,
};

const TIE_SAME_TIME_LOW_ID: ForumMessage = {
  id: 'tie-c',
  name: 'Cal',
  text: 'Same time, lower id',
  createdAt: '2026-08-28T14:00:00.000Z',
  sats: 10,
  payable: true,
  hasPhoto: false,
  photoCount: 0,
  hasVideo: false,
  videoContentType: null,
  role: 'basis',
  replyCount: 0,
};

afterEach(() => {
  consumePendingForumCompose();
  consumeSkipIntroduceOverlay();
});

describe('forum-feed', () => {
  it('defaults to active and lists modes Active → No gifts yet → All → Most popular', () => {
    expect(DEFAULT_FORUM_FEED_MODE).toBe('active');
    expect(FORUM_FEED_MODES).toEqual(['active', 'unpaid', 'all', 'popular']);
  });

  it('detects a fetched message id missing from the loaded list', () => {
    expect(hasUnseenForumPosts([ADA], [CAROL, ADA])).toBe(true);
  });

  it('does not report unseen posts before the initial list', () => {
    expect(hasUnseenForumPosts(null, [ADA])).toBe(false);
  });

  it('treats a loaded empty list with a fetched id as unseen', () => {
    expect(hasUnseenForumPosts([], [ADA])).toBe(true);
  });

  it('compares ids rather than updated message values', () => {
    expect(hasUnseenForumPosts([ADA, CAROL], [{ ...ADA, sats: 42 }, CAROL])).toBe(false);
  });

  it('all preserves order including zero-sat rows', () => {
    const input = [ADA, CAROL, BOB];
    expect(visibleForumMessages(input, 'all')).toEqual([ADA, CAROL, BOB]);
  });

  it('active drops zero-sat rows and keeps relative order', () => {
    expect(visibleForumMessages([ADA, CAROL, BOB], 'active')).toEqual([ADA, CAROL]);
  });

  it('active keeps an unpaid founder note newest-first among kept rows', () => {
    expect(visibleForumMessages([UNPAID_FOUNDER, ADA, BOB], 'active')).toEqual([
      UNPAID_FOUNDER,
      ADA,
    ]);
  });

  it('active keeps an unpaid moderator note', () => {
    expect(visibleForumMessages([ADA, UNPAID_MODERATOR, BOB], 'active')).toEqual([
      ADA,
      UNPAID_MODERATOR,
    ]);
  });

  it('active drops an unpaid verified note', () => {
    expect(visibleForumMessages([ADA, UNPAID_VERIFIED, BOB], 'active')).toEqual([ADA]);
  });

  it('popular drops unpaid founder and moderator notes', () => {
    expect(
      visibleForumMessages([ADA, UNPAID_FOUNDER, CAROL, UNPAID_MODERATOR, BOB], 'popular'),
    ).toEqual([CAROL, ADA]);
  });

  it('unpaid keeps unpaid founder and moderator notes', () => {
    expect(visibleForumMessages([ADA, UNPAID_FOUNDER, UNPAID_MODERATOR, BOB], 'unpaid')).toEqual([
      UNPAID_FOUNDER,
      UNPAID_MODERATOR,
      BOB,
    ]);
  });

  it('active does not mutate input when keeping unpaid staff notes', () => {
    const input = Object.freeze([UNPAID_FOUNDER, ADA, UNPAID_VERIFIED, BOB, UNPAID_MODERATOR]);
    const snapshot = [...input];
    const active = visibleForumMessages(input, 'active');
    expect(input).toEqual(snapshot);
    expect(active).not.toBe(input);
    expect(active).toEqual([UNPAID_FOUNDER, ADA, UNPAID_MODERATOR]);
  });

  it('unpaid keeps only zero-sat rows in order, including notes without a wallet', () => {
    const other = { ...BOB, id: 'other', payable: false };
    const input = Object.freeze([ADA, BOB, CAROL, other]);
    expect(visibleForumMessages(input, 'unpaid')).toEqual([BOB, other]);
    expect(visibleForumMessages([ADA, CAROL], 'unpaid')).toEqual([]);
    expect(visibleForumMessages([], 'unpaid')).toEqual([]);
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

  it('unpaidNewCount is 0 when seenAt is null even with unpaid rows', () => {
    expect(unpaidNewCount([BOB], null)).toBe(0);
  });

  it('unpaidNewCount is 0 when seenAt is invalid', () => {
    expect(unpaidNewCount([BOB], 'not-a-date')).toBe(0);
  });

  it('unpaidNewCount counts unpaid notes created after seenAt', () => {
    expect(unpaidNewCount([BOB], '2026-01-01T00:00:00.000Z')).toBe(1);
  });

  it('unpaidNewCount is 0 when unpaid createdAt equals seenAt', () => {
    expect(unpaidNewCount([BOB], BOB.createdAt)).toBe(0);
  });

  it('unpaidNewCount is 0 when unpaid createdAt is before seenAt', () => {
    expect(unpaidNewCount([BOB], '2026-12-01T00:00:00.000Z')).toBe(0);
  });

  it('unpaidNewCount ignores paid notes created after seenAt', () => {
    expect(unpaidNewCount([ADA], '2026-01-01T00:00:00.000Z')).toBe(0);
  });

  it('unpaidNewCount is 0 for an empty list', () => {
    expect(unpaidNewCount([], '2026-01-01T00:00:00.000Z')).toBe(0);
  });

  it('unpaidNewCount counts only newer unpaid rows in a mixed list', () => {
    const newerUnpaid = { ...BOB, id: 'm-new', createdAt: '2026-08-29T10:00:00.000Z' };
    const olderUnpaid = { ...BOB, id: 'm-old', createdAt: '2025-01-01T00:00:00.000Z' };
    const invalidUnpaid = { ...BOB, id: 'm-bad', createdAt: 'not-a-date' };
    const input = Object.freeze([ADA, newerUnpaid, olderUnpaid, invalidUnpaid, BOB]);
    expect(unpaidNewCount(input, '2026-08-28T09:00:00.000Z')).toBe(2);
    expect(input).toEqual([ADA, newerUnpaid, olderUnpaid, invalidUnpaid, BOB]);
  });

  it('requestForumCompose dispatches FORUM_COMPOSE_EVENT and consume helpers return true then false', () => {
    const listener = vi.fn();
    window.addEventListener(FORUM_COMPOSE_EVENT, listener);
    requestForumCompose();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(consumePendingForumCompose()).toBe(true);
    expect(consumePendingForumCompose()).toBe(false);
    expect(consumeSkipIntroduceOverlay()).toBe(true);
    expect(consumeSkipIntroduceOverlay()).toBe(false);
    window.removeEventListener(FORUM_COMPOSE_EVENT, listener);
  });

  it('a second consume is false', () => {
    expect(consumePendingForumCompose()).toBe(false);
    expect(consumeSkipIntroduceOverlay()).toBe(false);
    requestForumCompose();
    expect(consumePendingForumCompose()).toBe(true);
    expect(consumePendingForumCompose()).toBe(false);
    expect(consumeSkipIntroduceOverlay()).toBe(true);
    expect(consumeSkipIntroduceOverlay()).toBe(false);
  });

  it('keeps skip independent of pending-compose', () => {
    requestForumCompose();
    expect(consumePendingForumCompose()).toBe(true);
    expect(consumeSkipIntroduceOverlay()).toBe(true);
  });
});
