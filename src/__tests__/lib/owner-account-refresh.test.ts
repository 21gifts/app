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

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(error: unknown): void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function settleAnswers(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

it('never lets an older answer overwrite a newer applied answer', async () => {
  const first = deferred<Account | null>();
  const second = deferred<Account | null>();
  vi.mocked(fetchMe).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

  refreshOwnerAccount('sess');
  refreshOwnerAccount('sess');
  second.resolve({
    ...account,
    name: 'Stale server name',
    walletViewerPublicKey: `03${'b'.repeat(64)}`,
  });
  await settleAnswers();
  first.resolve({ ...account, walletViewerPublicKey: `02${'c'.repeat(64)}` });
  await settleAnswers();

  expect(useAuthStore.getState().account).toMatchObject({
    name: 'Ada',
    walletViewerPublicKey: `03${'b'.repeat(64)}`,
  });
});

it('applies an older answer while a newer refresh that later fails is pending', async () => {
  const first = deferred<Account | null>();
  const second = deferred<Account | null>();
  vi.mocked(fetchMe).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

  refreshOwnerAccount('sess');
  refreshOwnerAccount('sess');
  first.resolve({ ...account, walletViewerPublicKey: `02${'c'.repeat(64)}` });
  await settleAnswers();
  second.reject(new Error('newer refresh failed'));
  await settleAnswers();

  expect(useAuthStore.getState().account?.walletViewerPublicKey).toBe(`02${'c'.repeat(64)}`);
});

it('applies an older answer while a newer refresh that later returns null is pending', async () => {
  const first = deferred<Account | null>();
  const second = deferred<Account | null>();
  vi.mocked(fetchMe).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

  refreshOwnerAccount('sess');
  refreshOwnerAccount('sess');
  first.resolve({ ...account, walletViewerPublicKey: `02${'c'.repeat(64)}` });
  await settleAnswers();
  second.resolve(null);
  await settleAnswers();

  expect(useAuthStore.getState().account?.walletViewerPublicKey).toBe(`02${'c'.repeat(64)}`);
});

it('applies an older answer when a newer caller later ignores its answer', async () => {
  const first = deferred<Account | null>();
  const second = deferred<Account | null>();
  let secondCurrent = true;
  vi.mocked(fetchMe).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

  refreshOwnerAccount('sess');
  refreshOwnerAccount('sess', () => secondCurrent);
  first.resolve({ ...account, walletViewerPublicKey: `02${'c'.repeat(64)}` });
  await settleAnswers();
  secondCurrent = false;
  second.resolve({ ...account, walletViewerPublicKey: `03${'b'.repeat(64)}` });
  await settleAnswers();

  expect(useAuthStore.getState().account?.walletViewerPublicKey).toBe(`02${'c'.repeat(64)}`);
});

it('keeps stored funding and copies only its owner-only fields when both accounts have it', async () => {
  const owner = deferred<Account | null>();
  vi.mocked(fetchMe).mockReturnValueOnce(owner.promise);

  refreshOwnerAccount('sess');
  useAuthStore.getState().setAccount({
    ...account,
    name: 'Grace',
    setup: 'rules',
    funding: {
      status: 'trial',
      trialUtcDate: '2026-11-13',
      admittedAt: null,
      reviewedByName: 'Lin',
      dailyPayoutStoppedNotice: true,
    },
  });
  owner.resolve({
    ...account,
    name: 'Stale server name',
    setup: null,
    walletViewerPublicKey: `02${'c'.repeat(64)}`,
    grantPayoutToday: { state: 'due', reason: null },
    funding: {
      status: 'none',
      trialUtcDate: null,
      admittedAt: null,
      reviewedByName: null,
      dailyPayoutStoppedNotice: false,
      payoutToday: { state: 'paid', reason: null },
      shopPaymentDue: true,
    },
  });
  await settleAnswers();

  expect(useAuthStore.getState().account).toMatchObject({
    name: 'Grace',
    setup: 'rules',
    walletViewerPublicKey: `02${'c'.repeat(64)}`,
    grantPayoutToday: { state: 'due', reason: null },
    funding: {
      status: 'trial',
      trialUtcDate: '2026-11-13',
      admittedAt: null,
      reviewedByName: 'Lin',
      dailyPayoutStoppedNotice: true,
      payoutToday: { state: 'paid', reason: null },
      shopPaymentDue: true,
    },
  });
});

it('drops an answer after the session changes', async () => {
  const owner = deferred<Account | null>();
  vi.mocked(fetchMe).mockReturnValueOnce(owner.promise);

  refreshOwnerAccount('sess');
  useAuthStore.setState({ session: 'next-session', account: { ...account, name: 'Grace' } });
  owner.resolve({ ...account, walletViewerPublicKey: `02${'c'.repeat(64)}` });
  await settleAnswers();

  expect(useAuthStore.getState().account?.name).toBe('Grace');
  expect(useAuthStore.getState().account?.walletViewerPublicKey).toBeUndefined();
});

it.each([null, undefined])(
  "takes the answer's whole funding object when stored funding is %s",
  async (funding) => {
    const owner = deferred<Account | null>();
    vi.mocked(fetchMe).mockReturnValueOnce(owner.promise);

    refreshOwnerAccount('sess');
    useAuthStore.getState().setAccount({ ...account, name: 'Grace', funding });
    owner.resolve({
      ...account,
      walletViewerPublicKey: `02${'c'.repeat(64)}`,
      grantPayoutToday: { state: 'paid', reason: null },
      funding: {
        status: 'admitted',
        trialUtcDate: null,
        admittedAt: 1_700_000_002,
        reviewedByName: 'Lin',
        dailyPayoutStoppedNotice: true,
        payoutToday: { state: 'paid', reason: null },
        shopPaymentDue: false,
      },
    });
    await settleAnswers();

    expect(useAuthStore.getState().account).toMatchObject({
      name: 'Grace',
      walletViewerPublicKey: `02${'c'.repeat(64)}`,
      grantPayoutToday: { state: 'paid', reason: null },
      funding: {
        status: 'admitted',
        trialUtcDate: null,
        admittedAt: 1_700_000_002,
        reviewedByName: 'Lin',
        dailyPayoutStoppedNotice: true,
        payoutToday: { state: 'paid', reason: null },
        shopPaymentDue: false,
      },
    });
  },
);

it("leaves stored funding unchanged when the answer's funding is null", async () => {
  const owner = deferred<Account | null>();
  vi.mocked(fetchMe).mockReturnValueOnce(owner.promise);

  refreshOwnerAccount('sess');
  useAuthStore.getState().setAccount({
    ...account,
    funding: {
      status: 'trial',
      trialUtcDate: '2026-11-13',
      admittedAt: null,
      reviewedByName: 'Lin',
      dailyPayoutStoppedNotice: true,
      payoutToday: { state: 'due', reason: null },
      shopPaymentDue: false,
    },
  });
  owner.resolve({
    ...account,
    walletViewerPublicKey: `02${'c'.repeat(64)}`,
    funding: null,
  });
  await settleAnswers();

  expect(useAuthStore.getState().account).toMatchObject({
    walletViewerPublicKey: `02${'c'.repeat(64)}`,
    funding: {
      status: 'trial',
      trialUtcDate: '2026-11-13',
      admittedAt: null,
      reviewedByName: 'Lin',
      dailyPayoutStoppedNotice: true,
      payoutToday: { state: 'due', reason: null },
      shopPaymentDue: false,
    },
  });
});
