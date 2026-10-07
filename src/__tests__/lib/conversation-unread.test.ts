import { expect, it } from 'vitest';
import { conversationUnreadCount } from '@/lib/conversation-unread';
import type { Conversation } from '@/lib/api-types';

it('counts incoming messages, clears read summaries and supports older API summaries', () => {
  const row: Conversation = {
    id: 'c',
    kind: 'member_member',
    name: 'Bob',
    lastText: 'Hi',
    lastAt: '2026-09-01T00:00:00.000Z',
    lastFromMe: false,
    lastSats: 0,
    unread: true,
    unreadMessageCount: 7,
  };
  expect(conversationUnreadCount(row)).toBe(7);
  expect(conversationUnreadCount({ ...row, unread: false })).toBe(0);
  expect(conversationUnreadCount({ ...row, unreadMessageCount: 0 })).toBe(1);
});
