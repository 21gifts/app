'use client';

import { useRouter } from 'next/navigation';
import { useState, type ReactElement } from 'react';
import { ContactScreen } from '@/components/ContactScreen';
import { fetchConversations, postContact } from '@/lib/api';
import { CONTACT_MESSAGE_MAX_LENGTH } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Client loader for in-app contact on `/contact`.
 *
 * Reads the session from the auth store and owns composer draft/post state.
 * After a successful send, opens the official 21.gifts thread in the inbox
 * (`/messages?c=`) and keeps Send disabled until unmount. A failed post
 * clears `posting` so Send can retry. Renders nothing when there is no session.
 *
 * @returns The contact screen, or `null` without a session.
 */
export function ContactLoader(): ReactElement | null {
  const session = useAuthStore((state) => state.session);
  const router = useRouter();
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [formError, setFormError] = useState<'empty' | 'tooLong' | 'request' | null>(null);

  if (session === null) {
    return null;
  }

  const onPost = (): void => {
    const trimmed = draft.trim();
    if (trimmed === '') {
      setFormError('empty');
      return;
    }
    if (trimmed.length > CONTACT_MESSAGE_MAX_LENGTH) {
      setFormError('tooLong');
      return;
    }
    setPosting(true);
    setFormError(null);
    void (async () => {
      try {
        await postContact(session, trimmed);
        setDraft('');
        let href = '/messages';
        try {
          const threads = await fetchConversations(session);
          const official = threads.find((row) => row.name === '21.gifts');
          if (official !== undefined) {
            href = `/messages?c=${encodeURIComponent(official.id)}`;
          }
        } catch {
          // Inbox list is the fallback when the thread cannot be resolved.
        }
        router.push(href);
      } catch {
        setFormError('request');
        setPosting(false);
      }
    })();
  };

  return (
    <ContactScreen
      posting={posting}
      draft={draft}
      onDraftChange={(value) => {
        setDraft(value);
        setFormError(null);
      }}
      onPost={onPost}
      formError={formError}
    />
  );
}
