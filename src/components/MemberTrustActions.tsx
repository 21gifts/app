'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { Button } from '@/components/ui';
import {
  fetchMember,
  postTrustAppoint,
  postTrustConfirm,
  postTrustPropose,
  postTrustVerify,
} from '@/lib/api';
import type { MemberProfile } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Runs one staff Trust Chain POST, then refreshes the member card.
 *
 * @param session - Bearer session.
 * @param accountId - Subject account id.
 * @param action - Verify / propose / confirm / appoint call.
 * @param onUpdated - Optional profile callback after a successful GET.
 * @param refresh - App Router refresh.
 */
async function runTrustAction(
  session: string,
  accountId: string,
  action: () => Promise<unknown>,
  onUpdated: ((next: MemberProfile) => void) | undefined,
  refresh: () => void,
): Promise<void> {
  await action();
  const next = await fetchMember(session, accountId);
  if (next !== null) {
    onUpdated?.(next);
  }
  refresh();
}

/**
 * Staff-only Trust Chain actions on another member's identity card.
 *
 * Hidden when signed out, when the viewer is not founder/moderator, or when
 * the subject is the viewer. Founders may verify and appoint; moderators
 * verify, propose, or confirm. Subjects already moderator or founder see a
 * link to the public chain instead of buttons.
 *
 * @param props - Subject profile and optional update callback.
 * @returns The action card, or `null` when the viewer cannot act.
 */
export function MemberTrustActions({
  profile,
  onUpdated,
}: {
  profile: MemberProfile;
  onUpdated?: (next: MemberProfile) => void;
}): ReactElement | null {
  const { t } = useTranslations();
  const router = useRouter();
  const session = useAuthStore((state) => state.session);
  const account = useAuthStore((state) => state.account);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  if (session === null || account === null) {
    return null;
  }
  if (account.role !== 'founder' && account.role !== 'moderator') {
    return null;
  }
  if (profile.id === account.id) {
    return null;
  }

  const alreadyOnChain = profile.role === 'moderator' || profile.role === 'founder';
  const showVerify = profile.role === 'basis';
  const showPropose = profile.role === 'verified' && profile.trust.proposedBy === null;
  const proposedBy = profile.trust.proposedBy;
  const showConfirm =
    profile.role === 'verified' && proposedBy !== null && proposedBy.id !== account.id;
  const showWaiting =
    profile.role === 'verified' && proposedBy !== null && proposedBy.id === account.id;
  const showAppoint =
    account.role === 'founder' && (profile.role === 'basis' || profile.role === 'verified');

  const run = (action: () => Promise<unknown>): void => {
    if (busy) {
      return;
    }
    setBusy(true);
    setFailed(false);
    void (async () => {
      try {
        await runTrustAction(session, profile.id, action, onUpdated, () => {
          router.refresh();
        });
      } catch {
        setFailed(true);
      } finally {
        setBusy(false);
      }
    })();
  };

  return (
    <div
      data-testid="state-members-staff-verify"
      className="flex w-full flex-col items-stretch gap-3 border-t border-app-border bg-app-card pt-6"
    >
      {failed ? (
        <p role="status" className="text-center text-sm text-app-muted">
          {t('trustChain.actionFailed')}
        </p>
      ) : null}
      {alreadyOnChain ? (
        <p className="text-center text-sm text-app-fg">
          <Link href="/trust-chain" className="underline">
            {t('trustChain.alreadyOnChain')}
          </Link>
        </p>
      ) : (
        <>
          {showVerify ? (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => {
                run(() => postTrustVerify(session, profile.id));
              }}
            >
              {t('trustChain.action.verify')}
            </Button>
          ) : null}
          {showPropose ? (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => {
                run(() => postTrustPropose(session, profile.id));
              }}
            >
              {t('trustChain.action.propose')}
            </Button>
          ) : null}
          {showConfirm ? (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => {
                run(() => postTrustConfirm(session, profile.id));
              }}
            >
              {t('trustChain.action.confirm')}
            </Button>
          ) : null}
          {showWaiting ? (
            <p className="text-center text-sm text-app-muted">{t('trustChain.waitingConfirm')}</p>
          ) : null}
          {showAppoint ? (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => {
                run(() => postTrustAppoint(session, profile.id));
              }}
            >
              {t('trustChain.action.appoint')}
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
}
