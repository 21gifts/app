'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, type ReactElement } from 'react';
import { ContactScreen } from '@/components/ContactScreen';
import { RequirementsOverlay } from '@/components/RequirementsOverlay';
import { fetchConversations, postContact } from '@/lib/api';
import { CONTACT_MESSAGE_MAX_LENGTH } from '@/lib/api-types';
import {
  MissingRequirementsError,
  nextPostRequirement,
  type MissingRequirement,
} from '@/lib/missing-requirements';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Client loader for in-app contact on `/contact`.
 *
 * Reads the session from the auth store and owns composer draft/post state.
 * After a successful send, opens the official 21.gifts thread in the inbox
 * (`/messages?c=`) and keeps Send disabled until unmount. A failed post
 * clears `posting` so Send can retry. Missing name/rules open
 * {@link RequirementsOverlay} and retry the same send after the field is
 * added. Renders nothing when there is no session.
 *
 * @returns The contact screen, or `null` without a session.
 */
export function ContactLoader(): ReactElement | null {
  const session = useAuthStore((state) => state.session);
  const account = useAuthStore((state) => state.account);
  const router = useRouter();
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [formError, setFormError] = useState<'empty' | 'tooLong' | 'request' | null>(null);
  const [overlayRequirement, setOverlayRequirement] = useState<'name' | 'rules' | null>(null);
  const pendingPostRef = useRef<(() => Promise<void>) | null>(null);

  if (session === null) {
    return null;
  }

  const openOverlayForMissing = (missing: readonly MissingRequirement[]): boolean => {
    const next = nextPostRequirement(missing);
    if (next === null) {
      return false;
    }
    setOverlayRequirement(next);
    return true;
  };

  const finishContactSuccess = async (): Promise<void> => {
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
  };

  const runContactPost = async (trimmed: string, isRetry: boolean): Promise<void> => {
    setPosting(true);
    setFormError(null);
    try {
      await postContact(session, trimmed);
      pendingPostRef.current = null;
      await finishContactSuccess();
    } catch (err) {
      if (err instanceof MissingRequirementsError) {
        if (!isRetry && openOverlayForMissing(err.missing)) {
          pendingPostRef.current = () => runContactPost(trimmed, true);
          setPosting(false);
          return;
        }
        setPosting(false);
        return;
      }
      setFormError('request');
      setPosting(false);
    }
  };

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
    const missing = account?.missing ?? [];
    if (openOverlayForMissing(missing)) {
      pendingPostRef.current = () => runContactPost(trimmed, true);
      return;
    }
    void runContactPost(trimmed, false);
  };

  const onOverlaySatisfied = (): void => {
    const current = useAuthStore.getState().account;
    const still = nextPostRequirement(current?.missing ?? []);
    if (still !== null) {
      setOverlayRequirement(still);
      return;
    }
    setOverlayRequirement(null);
    const pending = pendingPostRef.current;
    /* v8 ignore next 3 -- overlay cannot satisfy without a queued send */
    if (pending === null) {
      return;
    }
    void pending();
  };

  return (
    <>
      {overlayRequirement !== null ? (
        <RequirementsOverlay
          requirement={overlayRequirement}
          onDismiss={() => {
            setOverlayRequirement(null);
            pendingPostRef.current = null;
          }}
          onSatisfied={onOverlaySatisfied}
        />
      ) : null}
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
    </>
  );
}
