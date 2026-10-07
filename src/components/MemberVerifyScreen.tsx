'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { SundayWritingGate } from '@/components/SundayWritingGate';
import { Button, Card } from '@/components/ui';
import { fetchMember, postTrustVerify } from '@/lib/api';
import type { MemberProfile } from '@/lib/api-types';
import { roleAtLeast } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth-store';

const ACCOUNT_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Stored-name check for `/members/[accountId]/verify`.
 *
 * Renders nothing without a session. An id that is not a UUID, or a viewer
 * below moderator, does not fetch. Confirm posts `postTrustVerify` with the
 * untrimmed stored name and then opens the member card. Chrome back does not
 * post. The card has no back control.
 *
 * @param props - Dynamic route `accountId`.
 * @returns The verify card, or `null` without a session.
 */
export function MemberVerifyScreen({ accountId }: { accountId: string }): ReactElement | null {
  const { t } = useTranslations();
  const router = useRouter();
  const session = useAuthStore((state) => state.session);
  const account = useAuthStore((state) => state.account);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<'loading' | 'missing' | 'error' | 'ready'>('loading');
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const moderatorViewer = roleAtLeast(account === null ? null : account.role, 'moderator');

  useEffect(() => {
    if (session === null) {
      return;
    }
    if (!ACCOUNT_ID_RE.test(accountId)) {
      return;
    }
    if (!moderatorViewer) {
      return;
    }
    let cancelled = false;
    setStatus('loading');
    setProfile(null);
    const token = session;
    void (async () => {
      try {
        const next = await fetchMember(token, accountId);
        if (cancelled) {
          return;
        }
        if (next === null) {
          setProfile(null);
          setStatus('missing');
          return;
        }
        setProfile(next);
        setStatus('ready');
      } catch {
        if (cancelled) {
          return;
        }
        setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accountId, attempt, moderatorViewer, session]);

  if (session === null) {
    return null;
  }

  const heading = (
    <h1 className="text-center text-2xl font-semibold tracking-tight text-app-fg sm:text-3xl">
      {t('trustChain.action.verify')}
    </h1>
  );

  const frame = (body: ReactNode): ReactElement => (
    <div data-testid="state-members-verify">
      <Card maxWidth="xl" surface={false}>
        {heading}
        {body}
      </Card>
    </div>
  );

  const muted = (testId: string, copy: string): ReactElement => (
    <p className="text-center text-sm text-app-muted" data-testid={testId}>
      {copy}
    </p>
  );

  if (!ACCOUNT_ID_RE.test(accountId)) {
    return frame(muted('state-members-verify-missing', t('view.missing')));
  }

  if (!moderatorViewer) {
    return frame(muted('state-members-verify-forbidden', t('trustChain.verifyName.forbidden')));
  }

  if (status === 'loading') {
    return frame(muted('state-members-verify-loading', t('forum.loading')));
  }

  if (status === 'error') {
    return frame(
      <>
        <p
          role="alert"
          className="text-center text-sm text-app-danger"
          data-testid="state-members-verify-error"
        >
          {t('view.error')}
        </p>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setAttempt((n) => n + 1);
          }}
        >
          {t('view.retry')}
        </Button>
      </>,
    );
  }

  if (status === 'missing' || profile === null) {
    return frame(muted('state-members-verify-missing', t('view.missing')));
  }

  const cannotVerify =
    account === null ||
    !roleAtLeast(account.role, 'moderator') ||
    profile.id === account.id ||
    profile.role !== 'basis';
  if (cannotVerify) {
    return frame(muted('state-members-verify-forbidden', t('trustChain.verifyName.forbidden')));
  }

  const storedName = profile.name;
  const identifyingName =
    typeof storedName === 'string' && storedName.trim() !== '' ? storedName : null;
  if (identifyingName === null) {
    return frame(muted('state-members-verify-unnamed', t('trustChain.verifyName.missing')));
  }

  const token = session;
  const subjectId = profile.id;

  return frame(
    <div
      className="flex w-full flex-col items-stretch gap-3"
      data-testid="state-members-verify-name"
    >
      <p className="text-center text-sm text-app-fg">{t('trustChain.verifyName.question')}</p>
      <p className="text-center text-sm font-medium text-app-fg">{identifyingName}</p>
      {failed ? (
        <p
          role="alert"
          className="text-center text-sm text-app-danger"
          data-testid="state-members-verify-failed"
        >
          {t('trustChain.actionFailed')}
        </p>
      ) : null}
      <SundayWritingGate>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => {
            /* v8 ignore next 3 — the confirm button is disabled while busy */
            if (busy) {
              return;
            }
            setBusy(true);
            setFailed(false);
            void (async () => {
              try {
                await postTrustVerify(token, subjectId, identifyingName);
                router.push(`/members/${subjectId}`);
              } catch {
                setFailed(true);
              } finally {
                setBusy(false);
              }
            })();
          }}
        >
          {t('trustChain.verifyName.confirm')}
        </Button>
      </SundayWritingGate>
    </div>,
  );
}
