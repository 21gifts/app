import { fetchMe } from '@/lib/api';
import type { Account } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';

/** The newest owner refresh started in this tab. */
let latestRefresh = 0;

/** The newest owner refresh whose answer was stored in this tab. */
let lastAppliedRefresh = 0;

type RefreshRound = {
  sessionToken: string;
  isCurrent: () => boolean;
};

/** Owner refreshes whose answers have not settled yet. */
const pendingRefreshes = new Map<number, RefreshRound>();

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
 * caller. A session change, an invalidated caller, a newer applied answer, or
 * a newer overlapping refresh whose caller is still current drops the answer.
 * Local account changes made after the request started keep every locally
 * writable field and receive only owner-only viewer and payout fields from
 * the answer.
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
  pendingRefreshes.set(refresh, { sessionToken, isCurrent });
  void fetchMe(sessionToken).then(
    (owner) => {
      pendingRefreshes.delete(refresh);
      const auth = useAuthStore.getState();
      if (
        owner === null ||
        !isCurrent() ||
        auth.session !== sessionToken ||
        refresh < lastAppliedRefresh ||
        [...pendingRefreshes.entries()].some(
          ([candidate, round]) =>
            candidate > refresh && round.sessionToken === auth.session && round.isCurrent(),
        )
      ) {
        return;
      }
      if (auth.account === accountAtStart) {
        lastAppliedRefresh = refresh;
        auth.setAccount(owner);
        return;
      }
      if (auth.account !== null) {
        lastAppliedRefresh = refresh;
        auth.setAccount(mergeOwnerFields(auth.account, owner));
      }
    },
    () => {
      pendingRefreshes.delete(refresh);
    },
  );
}
