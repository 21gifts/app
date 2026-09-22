import { describe, expect, it } from 'vitest';
import { forumGoalPercent, parseForumAskAmount } from '@/lib/forum-goal';

describe('forumGoalPercent', () => {
  it('returns 110 for 23100/21000', () => {
    expect(forumGoalPercent(23100, 21000)).toBe(110);
  });

  it('returns 0 for 0/21000', () => {
    expect(forumGoalPercent(0, 21000)).toBe(0);
  });

  it('returns 100 for 21000/21000', () => {
    expect(forumGoalPercent(21000, 21000)).toBe(100);
  });

  it('returns 50 for 10500/21000', () => {
    expect(forumGoalPercent(10500, 21000)).toBe(50);
  });

  it('floors 21001/21000 to 100', () => {
    expect(forumGoalPercent(21001, 21000)).toBe(100);
  });

  it('returns 0 when goalSats is 0 or negative', () => {
    expect(forumGoalPercent(21000, 0)).toBe(0);
    expect(forumGoalPercent(21000, -21000)).toBe(0);
  });

  it('is uncapped at 250 for 52500/21000', () => {
    expect(forumGoalPercent(52500, 21000)).toBe(250);
  });
});

describe('parseForumAskAmount', () => {
  it('parses 21000', () => {
    expect(parseForumAskAmount('21000')).toBe(21000);
  });

  it('returns null for empty, non-digits, 0, and over the max', () => {
    expect(parseForumAskAmount('')).toBeNull();
    expect(parseForumAskAmount('abc')).toBeNull();
    expect(parseForumAskAmount('0')).toBeNull();
    expect(parseForumAskAmount('10000001')).toBeNull();
  });
});
