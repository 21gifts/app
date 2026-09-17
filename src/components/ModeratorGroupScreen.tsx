'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactElement } from 'react';
import { InboxScreen, type InboxFormError } from '@/components/InboxScreen';
import { useTranslations } from '@/components/LocaleProvider';
import { Button, Card } from '@/components/ui';
import { fetchConversation, fetchModeratorGroup, postConversationMessage } from '@/lib/api';
import {
  CONTACT_MESSAGE_MAX_LENGTH,
  type Conversation,
  type ConversationMessage,
} from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Signed-in closed moderator-group thread.
 *
 * Confirmed moderators fetch {@link fetchModeratorGroup} then
 * {@link fetchConversation} and reuse {@link InboxScreen} as the open thread.
 * Founders, other signed-in visitors, and a missing account see forbidden
 * copy and do not fetch. Renders nothing without a session. In-card back
 * goes to the moderation hub.
 *
 * @returns The group thread, forbidden copy, or `null` without a session.
 */
export function ModeratorGroupScreen(): ReactElement | null {
  const { t } = useTranslations();
  const session = useAuthStore((state) => state.session);
  const account = useAuthStore((state) => state.account);
  const router = useRouter();
  const isModerator = account?.role === 'moderator';
  const [group, setGroup] = useState<Conversation | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [messages, setMessages] = useState<ConversationMessage[] | null>(null);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [formError, setFormError] = useState<InboxFormError>(null);

  useEffect(() => {
    if (session === null || !isModerator) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    void (async () => {
      try {
        const nextGroup = await fetchModeratorGroup(session);
        if (cancelled) {
          return;
        }
        const nextMessages = await fetchConversation(session, nextGroup.id);
        if (cancelled) {
          return;
        }
        setGroup(nextGroup);
        setMessages(nextMessages);
      } catch {
        if (cancelled) {
          return;
        }
        setGroup(null);
        setMessages(null);
        setError(true);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, isModerator, attempt]);

  if (session === null) {
    return null;
  }

  const heading = (
    <div className="flex w-full items-center gap-2">
      <Link
        href="/moderate"
        aria-label={t('moderate.heading')}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full text-app-muted transition hover:bg-app-hover hover:text-app-fg"
      >
        <ArrowLeft aria-hidden="true" className="h-5 w-5" />
      </Link>
      <div className="min-w-0 flex-1">
        <h1 className="text-center text-2xl font-semibold tracking-tight text-app-fg sm:text-3xl">
          {t('moderate.groupLabel')}
        </h1>
      </div>
    </div>
  );

  if (!isModerator) {
    return (
      <Card maxWidth="xl">
        {heading}
        <p className="text-center text-sm text-app-muted">{t('moderate.forbidden')}</p>
      </Card>
    );
  }

  if (loading && group === null) {
    return (
      <Card maxWidth="xl">
        {heading}
        <p className="text-center text-sm text-app-muted">{t('moderate.loading')}</p>
      </Card>
    );
  }

  if (error && group === null) {
    return (
      <Card maxWidth="xl">
        {heading}
        <p role="alert" className="text-center text-sm text-app-danger">
          {t('moderate.groupError')}
        </p>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setAttempt((n) => n + 1);
          }}
        >
          {t('moderate.retry')}
        </Button>
      </Card>
    );
  }

  if (group === null || messages === null) {
    return (
      <Card maxWidth="xl">
        {heading}
        <p className="text-center text-sm text-app-muted">{t('moderate.loading')}</p>
      </Card>
    );
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
    const conversationId = group.id;
    setPosting(true);
    setFormError(null);
    void (async () => {
      try {
        const created = await postConversationMessage(session, conversationId, trimmed);
        setMessages((prev) => [...(prev ?? []), created]);
        setDraft('');
        setGroup({
          ...group,
          lastText: created.text,
          lastAt: created.createdAt,
          lastFromMe: true,
        });
      } catch {
        setFormError('request');
      } finally {
        setPosting(false);
      }
    })();
  };

  return (
    <InboxScreen
      conversations={[group]}
      error={false}
      loading={false}
      onRetry={() => undefined}
      openId={group.id}
      onOpen={() => undefined}
      onBack={() => {
        router.push('/moderate');
      }}
      messages={messages}
      messagesLoading={false}
      messagesError={false}
      onRetryMessages={() => undefined}
      draft={draft}
      onDraftChange={(value) => {
        setDraft(value);
        setFormError(null);
      }}
      onPost={onPost}
      posting={posting}
      formError={formError}
      showFilter={false}
      backLabel={t('moderate.heading')}
    />
  );
}
