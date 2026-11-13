import { fetchMe } from '@/lib/api';
import type { Account } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';

/** The newest owner refresh started in this tab. */
let latestRefresh = 0;

/**
 * Copies fields that only the owner `GET /me` response supplies onto an
 * account that was changed locally while the request was in flight.
 *
 * @param current - The newest locally stored account.
 * @param owner - The owner account returned by `GET /me`.
 * @returns The local account with owner-only fields refreshed.
 */
function mergeOwnerFields(current: Account, owner: Account): Account {
  const merged: Account = {
    ...current,
    walletViewerPublicKey: owner.walletViewerPublicKey,
    grantPayoutToday: owner.grantPayoutToday,
  };
  if (current.funding === null || current.funding === undefined) {
    return merged;
  }
  return {
    ...merged,
    funding: {
      ...current.funding,
      payoutToday: owner.funding?.payoutToday,
      shopPaymentDue: owner.funding?.shopPaymentDue,
    },
  };
}

/**
 * Refreshes a sparse signed-in account from `GET /me` without blocking its
 * caller. A session change, an invalidated caller, or a newer overlapping
 * refresh drops the answer. Local account changes made after the request
 * started keep every locally writable field and receive only owner-only
 * viewer and payout fields from the answer.
 *
 * @param sessionToken - The session whose owner account should be loaded.
 * @param isCurrent - Optional component/flow lifetime check.
 */
export function refreshOwnerAccount(
  sessionToken: string,
  isCurrent: () => boolean = () => true,
): void {
  const accountAtStart = useAuthStore.getState().account;
  const refresh = ++latestRefresh;
  void fetchMe(sessionToken).then(
    (owner) => {
      const auth = useAuthStore.getState();
      if (
        owner === null ||
        !isCurrent() ||
        auth.session !== sessionToken ||
        latestRefresh !== refresh
      ) {
        return;
      }
      if (auth.account === accountAtStart) {
        auth.setAccount(owner);
        return;
      }
      if (auth.account !== null) {
        auth.setAccount(mergeOwnerFields(auth.account, owner));
      }
    },
    () => undefined,
  );
}
