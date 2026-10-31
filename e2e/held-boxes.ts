import type { Page } from '@playwright/test';
import { heldShareBoxKey, sealHeldShare } from '../src/lib/held-share-box';
import { mnemonicFromPrfFirst } from '../src/lib/prf-mnemonic';

/** One box as `GET /me/held-shares` lists it. */
export interface E2eHeldBox {
  /** Box id (32 lower-case hex digits). */
  id: string;
  /** The sealed share, base64url. */
  ciphertext: string;
  /** When it was last written. */
  updatedAt: string;
}

/**
 * The 12 words the fake passkey of `installFakeWebAuthn` gives: its PRF output
 * is 32 bytes of 7.
 *
 * @returns The words.
 */
export function fakePasskeyWords(): Promise<string> {
  return mnemonicFromPrfFirst(new Uint8Array(32).fill(7));
}

/** Previous 12 words of a holder, whose boxes do not open with the fake passkey. */
export const PREVIOUS_WORDS =
  'legal winner thank year wave sausage worth useful legal winner thank yellow';

/**
 * Seals a share code as the holder's app would.
 *
 * @param holderAccountId - The holder's account id.
 * @param id - The box id.
 * @param code - The share code.
 * @param words - Words whose key seals it; the fake passkey's words by default.
 * @returns The box.
 */
export async function sealedBox(
  holderAccountId: string,
  id: string,
  code: string,
  words?: string,
): Promise<E2eHeldBox> {
  const key = await heldShareBoxKey(words ?? (await fakePasskeyWords()));
  return {
    id,
    ciphertext: await sealHeldShare(key, holderAccountId, id, code),
    updatedAt: '2026-01-07T12:00:00.000Z',
  };
}

/** What the routed `/me/held-shares` of one page keeps and answers. */
export interface HeldSharesRoute {
  /** The boxes, oldest first. */
  boxes: E2eHeldBox[];
  /**
   * Status every PUT answers with. 201 or 200 store the box as the api does:
   * 201 for a new box, 200 for a replaced one, 400 for a bad id or box, and
   * 409 once the account keeps 50 boxes.
   */
  putStatus: number;
  /** Status every DELETE answers with; 204 removes the box. */
  deleteStatus: number;
  /** Status GET answers with; 200 lists the boxes. */
  getStatus: number;
}

/** Most boxes one account keeps, as the api allows. */
const HELD_SHARES_MAX = 50;

/**
 * Whether a PUT body is a box the api accepts: a version 1 box of 29 to 1024
 * bytes, base64url.
 *
 * @param ciphertext - The body's `ciphertext`.
 * @returns `true` when the api would store it.
 */
function isBox(ciphertext: unknown): boolean {
  if (typeof ciphertext !== 'string' || !/^[A-Za-z0-9_-]+$/.test(ciphertext)) {
    return false;
  }
  const bytes = Buffer.from(ciphertext, 'base64url');
  return bytes.length >= 29 && bytes.length <= 1024 && bytes[0] === 1;
}

/**
 * Answers the page's `/me/held-shares` calls from memory, as the api does for
 * one account.
 *
 * @param page - Page under test.
 * @param boxes - Boxes the account keeps at the start.
 * @returns The live state, to read or change during the test.
 */
export async function routeHeldShares(
  page: Page,
  boxes: readonly E2eHeldBox[] = [],
): Promise<HeldSharesRoute> {
  const state: HeldSharesRoute = {
    boxes: [...boxes],
    putStatus: 201,
    deleteStatus: 204,
    getStatus: 200,
  };
  await page.route(/\/me\/held-shares(\/[^/?]+)?$/, async (route) => {
    const request = route.request();
    const id = new URL(request.url()).pathname.split('/')[3];
    if (request.method() === 'GET') {
      await route.fulfill({
        status: state.getStatus,
        contentType: 'application/json',
        body: JSON.stringify(
          state.getStatus === 200 ? { boxes: state.boxes } : { error: 'Unavailable' },
        ),
      });
      return;
    }
    if (request.method() === 'PUT' && id !== undefined) {
      if (state.putStatus !== 200 && state.putStatus !== 201) {
        await route.fulfill({
          status: state.putStatus,
          contentType: 'application/json',
          body: '{}',
        });
        return;
      }
      const { ciphertext } = request.postDataJSON() as { ciphertext?: unknown };
      if (!/^[0-9a-f]{32}$/.test(id) || !isBox(ciphertext)) {
        await route.fulfill({ status: 400, contentType: 'application/json', body: '{}' });
        return;
      }
      const replaced = state.boxes.some((kept) => kept.id === id);
      if (!replaced && state.boxes.length >= HELD_SHARES_MAX) {
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Too many held shares' }),
        });
        return;
      }
      const box = { id, ciphertext: ciphertext as string, updatedAt: '2026-01-07T12:00:00.000Z' };
      state.boxes = replaced
        ? state.boxes.map((kept) => (kept.id === id ? box : kept))
        : [...state.boxes, box];
      await route.fulfill({
        status: replaced ? 200 : 201,
        contentType: 'application/json',
        body: '{}',
      });
      return;
    }
    if (request.method() === 'DELETE' && id !== undefined) {
      if (state.deleteStatus === 204) {
        state.boxes = state.boxes.filter((box) => box.id !== id);
        await route.fulfill({ status: 204 });
        return;
      }
      await route.fulfill({ status: state.deleteStatus, body: '{}' });
      return;
    }
    await route.fallback();
  });
  return state;
}
