'use client';

import { useState, type ReactElement } from 'react';
import { ContactScreen } from '@/components/ContactScreen';
import { postContact } from '@/lib/api';
import { CONTACT_MESSAGE_MAX_LENGTH } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Client loader for in-app contact on `/contact`.
 *
 * Reads the session from the auth store and owns composer draft/post/success
 * state. Renders nothing when there is no session. No inbox list — only the
 * composer and a one-shot success state.
 *
 * @returns The contact screen, or `null` without a session.
 */
export function ContactLoader(): ReactElement | null {
  const session = useAuthStore((state) => state.session);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [success, setSuccess] = useState(false);
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
        setSuccess(true);
      } catch {
        setFormError('request');
      } finally {
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
      success={success}
    />
  );
}
