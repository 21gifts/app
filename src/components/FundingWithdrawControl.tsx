'use client';

import { useRef, useState, type ReactElement } from 'react';
import { InlineConfirm } from '@/components/InlineConfirm';
import { useTranslations } from '@/components/LocaleProvider';
import { fetchMe, postFundingWithdraw } from '@/lib/api';
import { discardOwnerRefreshes, refreshOwnerAccount } from '@/lib/owner-account-refresh';
import { useAuthStore } from '@/stores/auth-store';

/** Props for {@link FundingWithdrawControl}. */
export interface FundingWithdrawControlProps {
  /** The member's own grant status: an open application, a trial, or an admitted place. */
  status: 'pending' | 'trial' | 'admitted';
}

/**
 * Quiet way out of the 21 gifts grant under the owner's status text on
 * `/grants`.
 *
 * Idle, it is a small underlined text button: **Withdraw my application**
 * for `pending`, **Leave the grant** for `trial` and `admitted`. Pressing it
 * opens {@link InlineConfirm} with the question and what the action changes;
 * nothing is sent before the confirm action. While {@link postFundingWithdraw}
 * runs, both actions are disabled and the confirm action spins; a second tap
 * sends no second request. On success the account's funding is replaced by the
 * answer (status `none`), so the card shows the apply state again and every
 * reader of `account.funding` follows at once. The answer carries no
 * `payoutToday`, so an owner refresh still in flight from opening `/grants` is
 * dropped ({@link discardOwnerRefreshes}) and {@link refreshOwnerAccount} then
 * loads today's payout reason from `GET /me` without blocking the card. On 409
 * the account is loaded again ({@link fetchMe}), older owner refreshes are
 * dropped the same way, and the current state is shown without an error. On
 * 401 the session is cleared, as when `/me` answers 401. Any other failure
 * shows the inline error and keeps the question open for another try or
 * **Cancel**.
 *
 * @param props - The member's current grant status.
 * @returns The idle action or the open confirm step.
 */
export function FundingWithdrawControl({ status }: FundingWithdrawControlProps): ReactElement {
  const { t } = useTranslations();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const inFlight = useRef(false);
  const application = status === 'pending';
  const actionLabel = t(application ? 'funding.withdraw.application' : 'funding.withdraw.leave');

  const withdraw = async (): Promise<void> => {
    const session = useAuthStore.getState().session;
    if (inFlight.current || session === null) {
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setFailed(false);
    try {
      const funding = await postFundingWithdraw(session);
      const current = useAuthStore.getState();
      if (current.session !== session || current.account === null) {
        return;
      }
      current.setAccount({ ...current.account, funding });
      discardOwnerRefreshes();
      refreshOwnerAccount(session);
      setConfirming(false);
    } catch (err) {
      if (useAuthStore.getState().session !== session) {
        return;
      }
      const reason = err instanceof Error ? err.message : '';
      if (reason === 'Unauthorized') {
        useAuthStore.getState().clearAuth();
        return;
      }
      if (reason === 'Conflict' && (await reloadAccount(session))) {
        setConfirming(false);
        return;
      }
      setFailed(true);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  if (confirming) {
    return (
      <InlineConfirm
        label={t(application ? 'funding.withdraw.applicationTitle' : 'funding.withdraw.leaveTitle')}
        description={t(
          application ? 'funding.withdraw.applicationBody' : 'funding.withdraw.leaveBody',
        )}
        confirmLabel={actionLabel}
        cancelLabel={t('funding.withdraw.cancel')}
        busy={busy}
        error={
          failed
            ? t(application ? 'funding.withdraw.applicationError' : 'funding.withdraw.leaveError')
            : null
        }
        onConfirm={() => {
          void withdraw();
        }}
        onCancel={() => {
          setConfirming(false);
          setFailed(false);
        }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setConfirming(true);
      }}
      className="min-h-11 self-center text-sm text-app-muted underline underline-offset-2 hover:text-app-fg"
    >
      {actionLabel}
    </button>
  );
}

/**
 * Loads the account again after the api refused a withdrawal as outdated,
 * then drops older owner refreshes so none of them copies an older payout onto
 * it.
 *
 * @param session - The session the withdrawal was sent with.
 * @returns `true` when the current account (or the sign-out on 401) is in the
 * store, `false` when the reload failed.
 */
async function reloadAccount(session: string): Promise<boolean> {
  try {
    const account = await fetchMe(session);
    const current = useAuthStore.getState();
    if (current.session !== session) {
      return true;
    }
    if (account === null) {
      current.clearAuth();
      return true;
    }
    current.setAccount(account);
    discardOwnerRefreshes();
    return true;
  } catch {
    return false;
  }
}
