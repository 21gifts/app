import { beforeEach, expect, it, vi } from 'vitest';
import { fetchMe } from '@/lib/api';
import type { Account } from '@/lib/api-types';
import { refreshOwnerAccount } from '@/lib/owner-account-refresh';
import { useAuthStore } from '@/stores/auth-store';

vi.mock('@/lib/api', () => ({ fetchMe: vi.fn() }));

const account: Account = {
  id: 'acc_1',
  linkingKey: null,
  role: 'verified',
  name: 'Ada',
  location: null,
  lightningAddress: null,
  lightningAddressVerified: false,
  forumLawsDismissed: false,
  createdAt: 1_700_000_000,
  rulesAgreedAt: 1_700_000_001,
  viewKey: 'a'.repeat(64),
  aboutMe: null,
  aboutMeHasPhoto: false,
  setup: null,
  missing: [],
  funding: {
    status: 'none',
    trialUtcDate: null,
    admittedAt: null,
    reviewedByName: null,
  },
};

beforeEach(() => {
  vi.mocked(fetchMe).mockReset();
  useAuthStore.setState({ session: 'sess', account });
});

it('does not let an older overlapping owner refresh win', async () => {
  let resolveFirst!: (next: Account | null) => void;
  let resolveSecond!: (next: Account | null) => void;
  vi.mocked(fetchMe)
    .mockReturnValueOnce(
      new Promise<Account | null>((resolve) => {
        resolveFirst = resolve;
      }),
    )
    .mockReturnValueOnce(
      new Promise<Account | null>((resolve) => {
        resolveSecond = resolve;
      }),
    );

  refreshOwnerAccount('sess');
  refreshOwnerAccount('sess');
  resolveSecond({ ...account, walletViewerPublicKey: `03${'b'.repeat(64)}` });
  await Promise.resolve();
  await Promise.resolve();
  resolveFirst({ ...account, walletViewerPublicKey: `02${'c'.repeat(64)}` });
  await Promise.resolve();
  await Promise.resolve();

  expect(useAuthStore.getState().account?.walletViewerPublicKey).toBe(`03${'b'.repeat(64)}`);
});

it('does not apply an older answer while a newer refresh is still current', async () => {
  let resolveFirst!: (next: Account | null) => void;
  let resolveSecond!: (next: Account | null) => void;
  vi.mocked(fetchMe)
    .mockReturnValueOnce(
      new Promise<Account | null>((resolve) => {
        resolveFirst = resolve;
      }),
    )
    .mockReturnValueOnce(
      new Promise<Account | null>((resolve) => {
        resolveSecond = resolve;
      }),
    );

  refreshOwnerAccount('sess');
  refreshOwnerAccount('sess');
  resolveFirst({ ...account, walletViewerPublicKey: `02${'c'.repeat(64)}` });
  await Promise.resolve();
  await Promise.resolve();

  expect(useAuthStore.getState().account?.walletViewerPublicKey).toBeUndefined();

  resolveSecond({ ...account, walletViewerPublicKey: `03${'b'.repeat(64)}` });
  await Promise.resolve();
  await Promise.resolve();
  expect(useAuthStore.getState().account?.walletViewerPublicKey).toBe(`03${'b'.repeat(64)}`);
});

it('applies an older current answer when the newer refresh is no longer current', async () => {
  let resolveFirst!: (next: Account | null) => void;
  let resolveSecond!: (next: Account | null) => void;
  let secondCurrent = true;
  vi.mocked(fetchMe)
    .mockReturnValueOnce(
      new Promise<Account | null>((resolve) => {
        resolveFirst = resolve;
      }),
    )
    .mockReturnValueOnce(
      new Promise<Account | null>((resolve) => {
        resolveSecond = resolve;
      }),
    );

  refreshOwnerAccount('sess');
  refreshOwnerAccount('sess', () => secondCurrent);
  secondCurrent = false;
  resolveFirst({ ...account, walletViewerPublicKey: `02${'c'.repeat(64)}` });
  await Promise.resolve();
  await Promise.resolve();

  expect(useAuthStore.getState().account?.walletViewerPublicKey).toBe(`02${'c'.repeat(64)}`);

  resolveSecond({ ...account, walletViewerPublicKey: `03${'b'.repeat(64)}` });
  await Promise.resolve();
  await Promise.resolve();
});

it('does not let a newer refresh for another session suppress the current answer', async () => {
  let resolveCurrent!: (next: Account | null) => void;
  let resolveOther!: (next: Account | null) => void;
  vi.mocked(fetchMe)
    .mockReturnValueOnce(
      new Promise<Account | null>((resolve) => {
        resolveCurrent = resolve;
      }),
    )
    .mockReturnValueOnce(
      new Promise<Account | null>((resolve) => {
        resolveOther = resolve;
      }),
    );

  refreshOwnerAccount('sess');
  refreshOwnerAccount('other-session');
  resolveCurrent({ ...account, walletViewerPublicKey: `02${'c'.repeat(64)}` });
  await Promise.resolve();
  await Promise.resolve();

  expect(useAuthStore.getState().account?.walletViewerPublicKey).toBe(`02${'c'.repeat(64)}`);

  resolveOther({ ...account, walletViewerPublicKey: `03${'b'.repeat(64)}` });
  await Promise.resolve();
  await Promise.resolve();
});

it.each([null, undefined])(
  'keeps a locally removed funding object while merging owner fields (%s)',
  async (funding) => {
    let resolveOwner!: (next: Account | null) => void;
    vi.mocked(fetchMe).mockReturnValueOnce(
      new Promise<Account | null>((resolve) => {
        resolveOwner = resolve;
      }),
    );

    refreshOwnerAccount('sess');
    useAuthStore.getState().setAccount({ ...account, name: 'Grace', funding });
    resolveOwner({
      ...account,
      walletViewerPublicKey: `02${'c'.repeat(64)}`,
      grantPayoutToday: { state: 'paid', reason: null },
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(useAuthStore.getState().account).toMatchObject({
      name: 'Grace',
      funding,
      walletViewerPublicKey: `02${'c'.repeat(64)}`,
      grantPayoutToday: { state: 'paid', reason: null },
    });
  },
);
