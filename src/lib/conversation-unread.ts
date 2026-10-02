import type { Conversation } from '@/lib/api-types';

/**
 * Count unread incoming messages, with a one-message fallback for older APIs.
 * @param conversation - The conversation summary.
 * @returns Zero for a read conversation, otherwise its unread message count.
 */
export function conversationUnreadCount(conversation: Conversation): number {
  return conversation.unread ? Math.max(1, conversation.unreadMessageCount) : 0;
}
