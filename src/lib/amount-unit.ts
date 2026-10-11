import { setAmountUnit } from '@/lib/api';
import type { Account, AmountUnit } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';

/** Shared across callers so a slower save cannot overwrite a later choice. */
let unitRequest = 0;
let unitRequestOpen = false;
let confirmedRequest = 0;
let savedUnit: AmountUnit = 'btc';
let unitRequestSession: string | null = null;

/**
 * Starts one account-wide amount-unit save.
 * A different session drops the previous burst so its unit cannot leak.
 *
 * @param current - Unit already stored before this click's optimistic update.
 * @param sessionToken - Session that owns this save.
 * @returns Id of this save. Higher ids happened later.
 */
function beginUnitRequest(current: AmountUnit, sessionToken: string): number {
  if (unitRequestSession !== sessionToken) {
    unitRequestSession = sessionToken;
    unitRequestOpen = false;
    savedUnit = current;
  } else if (!unitRequestOpen) {
    savedUnit = current;
  }
  unitRequestOpen = true;
  unitRequest += 1;
  return unitRequest;
}

/**
 * Whether this save is still the latest one.
 *
 * @param request - Id from {@link beginUnitRequest}.
 * @returns True when no newer save has started.
 */
function isLatestUnitRequest(request: number): boolean {
  return request === unitRequest;
}

/**
 * Marks the latest save finished so the next click starts a new burst.
 *
 * @param request - Id from {@link beginUnitRequest}.
 */
function finishUnitRequest(request: number): void {
  if (request === unitRequest) {
    unitRequestOpen = false;
  }
}

/**
 * Records a successful save. A newer success replaces an older one.
 * An older success still counts after a later failure, so the rollback
 * keeps the unit the server already stored.
 *
 * @param request - Id from {@link beginUnitRequest}.
 * @param chosen - Unit the server stored.
 * @returns True when the account should show `chosen` now.
 */
function confirmUnitRequest(request: number, chosen: AmountUnit): boolean {
  if (request <= confirmedRequest) {
    return false;
  }
  confirmedRequest = request;
  savedUnit = chosen;
  const apply = request === unitRequest || !unitRequestOpen;
  finishUnitRequest(request);
  return apply;
}

/**
 * Stores the member's default amount unit (`account.amountUnit`) through
 * `POST /me/amount-unit`. The store account shows `next` at once. A
 * confirmed save writes the stored unit back; a failed latest save rolls the
 * account back to the last unit the server stored and reports it. Saves from
 * every caller share one order, so a slower answer never overwrites a later
 * choice, and a save from an earlier session never touches the current one.
 *
 * @param session - Session that owns this save.
 * @param account - Store account before this choice.
 * @param next - Unit the member chose.
 * @param onRollback - Called with the restored unit after the latest save failed.
 * @returns Resolves once the save settled; never rejects.
 */
export async function saveAmountUnit(
  session: string,
  account: Account,
  next: AmountUnit,
  onRollback?: (rollback: AmountUnit) => void,
): Promise<void> {
  const request = beginUnitRequest(account.amountUnit ?? 'btc', session);
  useAuthStore.getState().setAccount({ ...account, amountUnit: next });
  try {
    const updated = await setAmountUnit(session, next);
    if (useAuthStore.getState().session !== session) {
      finishUnitRequest(request);
      return;
    }
    const chosen = updated.amountUnit ?? next;
    if (!confirmUnitRequest(request, chosen)) {
      return;
    }
    const current = useAuthStore.getState().account;
    if (current === null) {
      return;
    }
    useAuthStore.getState().setAccount({ ...current, amountUnit: savedUnit });
  } catch {
    if (useAuthStore.getState().session !== session) {
      finishUnitRequest(request);
      return;
    }
    if (!isLatestUnitRequest(request)) {
      return;
    }
    const rollback = savedUnit;
    finishUnitRequest(request);
    const current = useAuthStore.getState().account;
    if (current !== null) {
      useAuthStore.getState().setAccount({ ...current, amountUnit: rollback });
    }
    onRollback?.(rollback);
  }
}
