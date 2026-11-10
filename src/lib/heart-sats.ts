import { setHeartSats } from '@/lib/api';
import { accountHeartSats, type Account } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';

/** Largest heart amount the api accepts. */
export const MAX_HEART_SATS = 10_000_000;

let heartSatsRequest = 0;
let heartSatsRequestOpen = false;
let confirmedRequest = 0;
let savedHeartSats = 1;
let heartSatsRequestSession: string | null = null;

/**
 * Starts one account-wide heart-amount save.
 *
 * @param current - Amount already stored before this submit.
 * @param sessionToken - Session that owns this save.
 * @returns Id of this save. Higher ids happened later.
 */
function beginHeartSatsRequest(current: number, sessionToken: string): number {
  if (heartSatsRequestSession !== sessionToken) {
    heartSatsRequestSession = sessionToken;
    heartSatsRequestOpen = false;
    savedHeartSats = current;
  } else if (!heartSatsRequestOpen) {
    savedHeartSats = current;
  }
  heartSatsRequestOpen = true;
  heartSatsRequest += 1;
  return heartSatsRequest;
}

/**
 * Whether this save is still the latest one.
 *
 * @param request - Id from {@link beginHeartSatsRequest}.
 * @returns True when no newer save has started.
 */
function isLatestHeartSatsRequest(request: number): boolean {
  return request === heartSatsRequest;
}

/**
 * Marks the latest save finished so the next submit starts a new burst.
 *
 * @param request - Id from {@link beginHeartSatsRequest}.
 */
function finishHeartSatsRequest(request: number): void {
  if (request === heartSatsRequest) {
    heartSatsRequestOpen = false;
  }
}

/**
 * Records a successful save. A newer success replaces an older one. An answer
 * that arrives while a later save is still open is recorded for the rollback,
 * but the store keeps the later choice until that save settles.
 *
 * @param request - Id from {@link beginHeartSatsRequest}.
 * @param chosen - Amount the server stored.
 * @returns Whether this answer was newer, and whether the store should show it.
 */
function confirmHeartSatsRequest(
  request: number,
  chosen: number,
): { recorded: boolean; apply: boolean } {
  if (request <= confirmedRequest) {
    return { recorded: false, apply: false };
  }
  confirmedRequest = request;
  savedHeartSats = chosen;
  const apply = request === heartSatsRequest || !heartSatsRequestOpen;
  finishHeartSatsRequest(request);
  return { recorded: true, apply };
}

/**
 * Stores the member's heart amount (`account.heartSats`) through
 * `POST /me/heart-sats`. The store account shows `next` at once. A confirmed
 * save writes the stored amount back; a failed latest save rolls the account
 * back to the last amount the server stored and reports it. Saves from every
 * caller share one order, so a slower answer never overwrites a later
 * choice, and a save from an earlier session never touches the current one.
 *
 * @param session - Session that owns this save.
 * @param account - Store account before this choice.
 * @param next - Whole sats from 1 through {@link MAX_HEART_SATS}.
 * @returns Resolves true when the server stored the amount, false when the
 *   latest save failed.
 */
export async function saveHeartSats(
  session: string,
  account: Account,
  next: number,
): Promise<boolean> {
  const request = beginHeartSatsRequest(accountHeartSats(account), session);
  useAuthStore.getState().setAccount({ ...account, heartSats: next });
  try {
    const updated = await setHeartSats(session, next);
    if (useAuthStore.getState().session !== session) {
      finishHeartSatsRequest(request);
      return false;
    }
    const chosen = accountHeartSats(updated);
    const confirmation = confirmHeartSatsRequest(request, chosen);
    if (!confirmation.recorded) {
      return false;
    }
    if (!confirmation.apply) {
      return true;
    }
    const current = useAuthStore.getState().account;
    if (current === null) {
      return false;
    }
    useAuthStore.getState().setAccount({ ...current, heartSats: savedHeartSats });
    return true;
  } catch {
    if (useAuthStore.getState().session !== session) {
      finishHeartSatsRequest(request);
      return false;
    }
    if (!isLatestHeartSatsRequest(request)) {
      return false;
    }
    const rollback = savedHeartSats;
    finishHeartSatsRequest(request);
    const current = useAuthStore.getState().account;
    if (current !== null) {
      useAuthStore.getState().setAccount({ ...current, heartSats: rollback });
    }
    return false;
  }
}
