import { afterEach, describe, expect, it, vi } from 'vitest';
import { setHeartSats } from '@/lib/api';
import type { Account } from '@/lib/api-types';
import { saveHeartSats } from '@/lib/heart-sats';
import { useAuthStore } from '@/stores/auth-store';

vi.mock('@/lib/api', () => ({
  setHeartSats: vi.fn(),
}));

const account: Account = {
  id: 'acc_1',
  linkingKey: null,
  role: 'basis',
  name: 'Ada',
  username: 'ada',
  location: null,
  lightningAddress: null,
  lightningAddressVerified: false,
  forumLawsDismissed: false,
  createdAt: 1,
  rulesAgreedAt: 1,
  viewKey: 'a'.repeat(64),
  aboutMe: null,
  aboutMeHasPhoto: false,
  setup: null,
  missing: [],
};

function storedHeartSats(): number | undefined {
  return useAuthStore.getState().account?.heartSats;
}

/** A heart save answer the test settles by hand. */
function deferred(): {
  promise: Promise<Account>;
  resolve: (sats: number) => void;
  reject: () => void;
} {
  let resolve: (sats: number) => void = () => undefined;
  let reject: () => void = () => undefined;
  const promise = new Promise<Account>((ok, fail) => {
    resolve = (sats) => {
      ok({ ...account, heartSats: sats });
    };
    reject = () => {
      fail(new Error('Could not save heart amount.'));
    };
  });
  return { promise, resolve, reject };
}

afterEach(() => {
  vi.mocked(setHeartSats).mockReset();
  useAuthStore.setState({ session: null, account: null });
});

describe('saveHeartSats', () => {
  it('shows 21 at once and keeps the amount the server stored', async () => {
    useAuthStore.setState({ session: 's1', account });
    vi.mocked(setHeartSats).mockResolvedValue({ ...account, heartSats: 21 });
    await expect(saveHeartSats('s1', account, 21)).resolves.toBe(true);
    expect(storedHeartSats()).toBe(21);
    expect(setHeartSats).toHaveBeenCalledWith('s1', 21);
  });

  it('rolls back to 1 and reports false after a failed save', async () => {
    useAuthStore.setState({ session: 's2', account });
    vi.mocked(setHeartSats).mockRejectedValue(new Error('down'));
    await expect(saveHeartSats('s2', account, 21)).resolves.toBe(false);
    expect(storedHeartSats()).toBe(1);
  });

  it('leaves another session alone when an answer arrives late', async () => {
    useAuthStore.setState({ session: 's3', account });
    let resolve: ((value: Account) => void) | undefined;
    vi.mocked(setHeartSats).mockImplementation(
      () =>
        new Promise<Account>((ok) => {
          resolve = ok;
        }),
    );
    const saving = saveHeartSats('s3', account, 21);
    useAuthStore.setState({ session: 'other', account: { ...account, heartSats: 5 } });
    resolve?.({ ...account, heartSats: 21 });
    await expect(saving).resolves.toBe(false);
    expect(storedHeartSats()).toBe(5);
  });

  it('starts a new burst from 1 after the previous save settled', async () => {
    useAuthStore.setState({ session: 's4', account });
    vi.mocked(setHeartSats).mockResolvedValueOnce({ ...account, heartSats: 21 });
    await saveHeartSats('s4', account, 21);
    useAuthStore.setState({ account: { ...account, heartSats: 1 } });
    vi.mocked(setHeartSats).mockRejectedValueOnce(new Error('down'));
    await expect(saveHeartSats('s4', { ...account, heartSats: 1 }, 50)).resolves.toBe(false);
    expect(storedHeartSats()).toBe(1);
  });

  it('lets a later choice win over a slower earlier answer', async () => {
    useAuthStore.setState({ session: 's5', account });
    const first = deferred();
    const second = deferred();
    vi.mocked(setHeartSats).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const one = saveHeartSats('s5', account, 21);
    const two = saveHeartSats('s5', { ...account, heartSats: 21 }, 50);
    second.resolve(55);
    await expect(two).resolves.toBe(true);
    first.resolve(21);
    await expect(one).resolves.toBe(false);
    expect(storedHeartSats()).toBe(55);
  });

  it('keeps an earlier success when the later save fails', async () => {
    useAuthStore.setState({ session: 's6', account });
    const first = deferred();
    const second = deferred();
    vi.mocked(setHeartSats).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const one = saveHeartSats('s6', account, 21);
    const two = saveHeartSats('s6', { ...account, heartSats: 21 }, 50);
    first.resolve(21);
    await expect(one).resolves.toBe(true);
    expect(storedHeartSats()).toBe(50);
    second.reject();
    await expect(two).resolves.toBe(false);
    expect(storedHeartSats()).toBe(21);
  });

  it('ignores a failure of a save that is no longer the latest', async () => {
    useAuthStore.setState({ session: 's7', account });
    const first = deferred();
    const second = deferred();
    vi.mocked(setHeartSats).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const one = saveHeartSats('s7', account, 21);
    const two = saveHeartSats('s7', { ...account, heartSats: 21 }, 50);
    first.reject();
    await expect(one).resolves.toBe(false);
    expect(storedHeartSats()).toBe(50);
    second.resolve(50);
    await expect(two).resolves.toBe(true);
    expect(storedHeartSats()).toBe(50);
  });

  it('leaves another session alone when a failed answer arrives late', async () => {
    useAuthStore.setState({ session: 's8', account });
    const failed = deferred();
    vi.mocked(setHeartSats).mockReturnValueOnce(failed.promise);
    const saving = saveHeartSats('s8', account, 21);
    useAuthStore.setState({ session: 'other', account: { ...account, heartSats: 5 } });
    failed.reject();
    await expect(saving).resolves.toBe(false);
    expect(storedHeartSats()).toBe(5);
  });

  it('writes nothing when the account is gone by the time the answer arrives', async () => {
    useAuthStore.setState({ session: 's9', account });
    const ok = deferred();
    vi.mocked(setHeartSats).mockReturnValueOnce(ok.promise);
    const saving = saveHeartSats('s9', account, 21);
    useAuthStore.setState({ account: null });
    ok.resolve(21);
    await expect(saving).resolves.toBe(false);
    expect(useAuthStore.getState().account).toBeNull();

    useAuthStore.setState({ session: 's10', account });
    const failed = deferred();
    vi.mocked(setHeartSats).mockReturnValueOnce(failed.promise);
    const failing = saveHeartSats('s10', account, 21);
    useAuthStore.setState({ account: null });
    failed.reject();
    await expect(failing).resolves.toBe(false);
    expect(useAuthStore.getState().account).toBeNull();
  });
});
