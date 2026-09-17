'use client';

import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { Button, Card } from '@/components/ui';
import { fetchTrustProposals, postTrustConfirm } from '@/lib/api';
import type { ModeratorProposal } from '@/lib/api-types';
import { formatForumTime } from '@/lib/forum-time';
import { useAuthStore } from '@/stores/auth-store';

/**
 * True when `role` may use the confirm queue.
 *
 * @param role - Account role, or `undefined` when the account is missing.
 * @returns Whether the visitor is a founder or moderator.
 */
function isStaffRole(role: string | undefined): boolean {
  return role === 'founder' || role === 'moderator';
}

/**
 * Display name for a proposal subject or proposer, or the unnamed fallback.
 *
 * @param name - Api display name, which may be null or empty.
 * @param unnamed - Localized unnamed copy.
 * @returns A non-empty label.
 */
function personLabel(name: string | null, unnamed: string): string {
  return name !== null && name !== '' ? name : unnamed;
}

/**
 * Signed-in staff confirm queue of open moderator proposals.
 *
 * Founders and moderators see one list: Confirm as moderator when they did not
 * propose; waiting copy when `proposedBy.id === account.id`. Other signed-in
 * visitors see a short forbidden message and no list. Fetches
 * {@link fetchTrustProposals} only and confirms with {@link postTrustConfirm}.
 * A failed confirm shows `trustChain.actionFailed`. Renders nothing without a
 * session. In-card back goes to the moderation hub.
 *
 * @returns The proposals card, forbidden copy, or `null` without a session.
 */
export function ProposalsScreen(): ReactElement | null {
  const { t, locale } = useTranslations();
  const session = useAuthStore((state) => state.session);
  const account = useAuthStore((state) => state.account);
  const staff = isStaffRole(account?.role);
  const [proposals, setProposals] = useState<ModeratorProposal[] | null>(null);
  const [proposalsError, setProposalsError] = useState(false);
  const [proposalsAttempt, setProposalsAttempt] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [confirmFailed, setConfirmFailed] = useState(false);

  useEffect(() => {
    if (session === null || !staff) {
      return;
    }
    let cancelled = false;
    setProposalsError(false);
    setConfirmFailed(false);
    void (async () => {
      try {
        const nextProposals = await fetchTrustProposals(session);
        if (cancelled) {
          return;
        }
        setProposals(nextProposals);
      } catch {
        if (cancelled) {
          return;
        }
        setProposals(null);
        setProposalsError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, staff, proposalsAttempt]);

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
          {t('moderate.proposals.heading')}
        </h1>
      </div>
    </div>
  );

  if (!staff) {
    return (
      <Card maxWidth="xl">
        {heading}
        <p className="text-center text-sm text-app-muted">{t('moderate.forbidden')}</p>
      </Card>
    );
  }

  const unnamed = t('moderate.unnamed');

  const confirmProposal = (subjectId: string): void => {
    /* v8 ignore next 3 — the action button is disabled while busy */
    if (confirming) {
      return;
    }
    setConfirming(true);
    setConfirmFailed(false);
    void (async () => {
      try {
        await postTrustConfirm(session, subjectId);
        setProposals((current) => {
          /* v8 ignore next 3 — confirm is only offered after a loaded list */
          if (current === null) {
            return current;
          }
          return current.filter((row) => row.subject.id !== subjectId);
        });
      } catch {
        setConfirmFailed(true);
      } finally {
        setConfirming(false);
      }
    })();
  };

  let body: ReactElement;
  if (proposalsError) {
    body = (
      <>
        <p role="alert" className="text-center text-sm text-app-danger">
          {t('moderate.proposals.error')}
        </p>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setProposalsAttempt((n) => n + 1);
          }}
        >
          {t('moderate.retry')}
        </Button>
      </>
    );
  } else if (proposals === null) {
    body = <p className="text-center text-sm text-app-muted">{t('moderate.loading')}</p>;
  } else {
    const open = proposals;
    body = (
      <>
        {confirmFailed ? (
          <p role="alert" className="text-center text-sm text-app-danger">
            {t('trustChain.actionFailed')}
          </p>
        ) : null}
        {open.length === 0 ? (
          <p className="text-center text-sm text-app-muted">{t('moderate.proposals.empty')}</p>
        ) : (
          <ul aria-label={t('moderate.proposals.listLabel')} className="flex w-full flex-col gap-3">
            {open.map((row) => {
              const selfProposed = row.proposedBy.id === account?.id;
              const subjectName = personLabel(row.subject.name, unnamed);
              return (
                <li key={row.subject.id}>
                  <div className="flex w-full flex-col items-start gap-1 rounded-2xl border border-app-border bg-app-card-muted px-4 py-3">
                    <span className="flex w-full items-baseline justify-between gap-2">
                      <Link
                        href={`/members/${row.subject.id}`}
                        className="text-sm font-medium text-app-fg underline underline-offset-2"
                      >
                        {subjectName}
                      </Link>
                      <time dateTime={row.createdAt} className="text-xs text-app-subtle">
                        {formatForumTime(row.createdAt, locale)}
                      </time>
                    </span>
                    <span className="text-sm text-app-muted">
                      {t('moderate.proposals.proposedBy', {
                        name: personLabel(row.proposedBy.name, unnamed),
                      })}
                    </span>
                    {selfProposed ? (
                      <p className="text-sm text-app-muted">{t('trustChain.waitingConfirm')}</p>
                    ) : (
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={confirming}
                        icon={
                          confirming ? (
                            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                          ) : undefined
                        }
                        onClick={() => {
                          confirmProposal(row.subject.id);
                        }}
                      >
                        {t('trustChain.action.confirm')}
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </>
    );
  }

  return (
    <Card maxWidth="xl">
      {heading}
      {body}
    </Card>
  );
}
