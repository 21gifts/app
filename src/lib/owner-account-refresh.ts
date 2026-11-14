import { fetchMe } from '@/lib/api';
import type { Account } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';

/** Sequence number of the newest owner refresh started in this tab. */
let latestRefresh = 0;

/** Sequence number of the newest owner refresh answer stored in this tab. */
let lastAppliedRefresh = 0;

/**
 * Copies fields that only the owner `GET /me` response supplies onto an
 * account currently stored when the answer arrives.
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
  if (owner.funding === null || owner.funding === undefined) {
    return merged;
  }
  if (current.funding === null || current.funding === undefined) {
    return { ...merged, funding: owner.funding };
  }
  return {
    ...merged,
    funding: {
      ...current.funding,
      payoutToday: owner.funding.payoutToday,
      shopPaymentDue: owner.funding.shopPaymentDue,
    },
  };
}

/**
 * Refreshes a sparse signed-in account from `GET /me` without blocking its
 * caller. A session change, a missing stored account, or a newer applied
 * answer drops the answer. Every applied answer merges only owner-only viewer
 * and payout fields into the account currently in the store. A missing local
 * funding object takes the answer's whole funding object; when both exist,
 * only `payoutToday` and `shopPaymentDue` are copied; a null or missing answer
 * funding object leaves the local one unchanged. All locally writable fields
 * therefore survive requests that overlap local changes.
 *
 * @param sessionToken - The session whose owner account should be loaded.
 */
export function refreshOwnerAccount(sessionToken: string): void {
  const refresh = ++latestRefresh;
  void fetchMe(sessionToken).then(
    (owner) => {
      const auth = useAuthStore.getState();
      if (
        owner === null ||
        auth.session !== sessionToken ||
        refresh < lastAppliedRefresh ||
        auth.account === null
      ) {
        return;
      }
      lastAppliedRefresh = refresh;
      auth.setAccount(mergeOwnerFields(auth.account, owner));
    },
    () => undefined,
  );
}

/**
 * Drops every owner refresh still in flight, after the caller stored a newer
 * owner payout itself (a funding answer or a whole account from `GET /me`).
 * Without it, a `GET /me` started earlier, for example when `/grants` opened,
 * could still copy its older `payoutToday` and `shopPaymentDue` onto that
 * newer funding. A refresh started after this call applies as usual.
 */
export function discardOwnerRefreshes(): void {
  latestRefresh += 1;
  lastAppliedRefresh = latestRefresh;
}
