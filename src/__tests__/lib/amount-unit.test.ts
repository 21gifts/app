import { afterEach, describe, expect, it, vi } from 'vitest';
import { saveAmountUnit } from '@/lib/amount-unit';
import { setAmountUnit } from '@/lib/api';
import type { Account, AmountUnit } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';

vi.mock('@/lib/api', () => ({
  setAmountUnit: vi.fn(),
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

/** A save answer the test settles by hand. */
function deferred(): {
  promise: Promise<Account>;
  resolve: (unit: AmountUnit | undefined) => void;
  reject: () => void;
} {
  let resolve: (unit: AmountUnit | undefined) => void = () => undefined;
  let reject: () => void = () => undefined;
  const promise = new Promise<Account>((ok, fail) => {
    resolve = (unit) => {
      ok(unit === undefined ? { ...account } : { ...account, amountUnit: unit });
    };
    reject = () => {
      fail(new Error('Could not save amount unit.'));
    };
  });
  return { promise, resolve, reject };
}

function storedUnit(): AmountUnit | undefined {
  return useAuthStore.getState().account?.amountUnit;
}

afterEach(() => {
  vi.mocked(setAmountUnit).mockReset();
  useAuthStore.setState({ session: null, account: null });
});

describe('saveAmountUnit', () => {
  it('shows the choice at once and keeps the unit the server stored', async () => {
    useAuthStore.setState({ session: 's1', account });
    const answer = deferred();
    vi.mocked(setAmountUnit).mockReturnValue(answer.promise);
    const saving = saveAmountUnit('s1', account, 'fiat');
    expect(storedUnit()).toBe('fiat');
    expect(setAmountUnit).toHaveBeenCalledWith('s1', 'fiat');
    answer.resolve('fiat');
    await saving;
    expect(storedUnit()).toBe('fiat');
  });

  it('uses the chosen unit when the answer omits one', async () => {
    useAuthStore.setState({ session: 's2', account });
    vi.mocked(setAmountUnit).mockResolvedValue({ ...account });
    await saveAmountUnit('s2', account, 'fiat');
    expect(storedUnit()).toBe('fiat');
  });

  it('rolls back to the stored unit and reports it after a failed save', async () => {
    useAuthStore.setState({ session: 's3', account: { ...account, amountUnit: 'btc' } });
    vi.mocked(setAmountUnit).mockRejectedValue(new Error('down'));
    const onRollback = vi.fn();
    await saveAmountUnit('s3', { ...account, amountUnit: 'btc' }, 'fiat', onRollback);
    expect(storedUnit()).toBe('btc');
    expect(onRollback).toHaveBeenCalledWith('btc');
  });

  it('starts from bitcoin when the account has no unit and rolls back without a callback', async () => {
    useAuthStore.setState({ session: 's4', account });
    vi.mocked(setAmountUnit).mockRejectedValue(new Error('down'));
    await saveAmountUnit('s4', account, 'fiat');
    expect(storedUnit()).toBe('btc');
  });

  it('starts a new burst from the stored unit once the previous save in the session settled', async () => {
    useAuthStore.setState({ session: 's12', account: { ...account, amountUnit: 'btc' } });
    vi.mocked(setAmountUnit).mockResolvedValueOnce({ ...account, amountUnit: 'fiat' });
    await saveAmountUnit('s12', { ...account, amountUnit: 'btc' }, 'fiat');
    expect(storedUnit()).toBe('fiat');
    vi.mocked(setAmountUnit).mockRejectedValueOnce(new Error('down'));
    const onRollback = vi.fn();
    await saveAmountUnit('s12', { ...account, amountUnit: 'fiat' }, 'btc', onRollback);
    expect(onRollback).toHaveBeenCalledWith('fiat');
    expect(storedUnit()).toBe('fiat');
  });

  it('lets a later choice win over a slower earlier answer', async () => {
    useAuthStore.setState({ session: 's5', account });
    const first = deferred();
    const second = deferred();
    vi.mocked(setAmountUnit).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const one = saveAmountUnit('s5', account, 'fiat');
    const two = saveAmountUnit('s5', { ...account, amountUnit: 'fiat' }, 'btc');
    second.resolve('btc');
    await two;
    first.resolve('fiat');
    await one;
    expect(storedUnit()).toBe('btc');
  });

  it('keeps an earlier success when the later save fails', async () => {
    useAuthStore.setState({ session: 's6', account });
    const first = deferred();
    const second = deferred();
    vi.mocked(setAmountUnit).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const onRollback = vi.fn();
    const one = saveAmountUnit('s6', account, 'fiat', onRollback);
    const two = saveAmountUnit('s6', { ...account, amountUnit: 'fiat' }, 'btc', onRollback);
    first.resolve('fiat');
    await one;
    expect(storedUnit()).toBe('btc');
    second.reject();
    await two;
    expect(storedUnit()).toBe('fiat');
    expect(onRollback).toHaveBeenCalledTimes(1);
    expect(onRollback).toHaveBeenCalledWith('fiat');
  });

  it('ignores a failure of a save that is no longer the latest', async () => {
    useAuthStore.setState({ session: 's7', account });
    const first = deferred();
    const second = deferred();
    vi.mocked(setAmountUnit).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const onRollback = vi.fn();
    const one = saveAmountUnit('s7', account, 'fiat', onRollback);
    const two = saveAmountUnit('s7', { ...account, amountUnit: 'fiat' }, 'btc', onRollback);
    first.reject();
    await one;
    expect(onRollback).not.toHaveBeenCalled();
    second.resolve('btc');
    await two;
    expect(storedUnit()).toBe('btc');
  });

  it('leaves another session alone when an answer arrives late', async () => {
    useAuthStore.setState({ session: 's8', account });
    const ok = deferred();
    const failed = deferred();
    vi.mocked(setAmountUnit).mockReturnValueOnce(ok.promise);
    const saving = saveAmountUnit('s8', account, 'fiat');
    useAuthStore.setState({ session: 'other', account: { ...account, amountUnit: 'btc' } });
    ok.resolve('fiat');
    await saving;
    expect(storedUnit()).toBe('btc');

    useAuthStore.setState({ session: 's9', account });
    vi.mocked(setAmountUnit).mockReturnValueOnce(failed.promise);
    const onRollback = vi.fn();
    const failing = saveAmountUnit('s9', account, 'fiat', onRollback);
    useAuthStore.setState({ session: 'other', account: { ...account, amountUnit: 'btc' } });
    failed.reject();
    await failing;
    expect(storedUnit()).toBe('btc');
    expect(onRollback).not.toHaveBeenCalled();
  });

  it('writes nothing when the account is gone by the time the answer arrives', async () => {
    useAuthStore.setState({ session: 's10', account });
    const ok = deferred();
    vi.mocked(setAmountUnit).mockReturnValueOnce(ok.promise);
    const saving = saveAmountUnit('s10', account, 'fiat');
    useAuthStore.setState({ account: null });
    ok.resolve('fiat');
    await saving;
    expect(useAuthStore.getState().account).toBeNull();

    useAuthStore.setState({ session: 's11', account });
    vi.mocked(setAmountUnit).mockRejectedValueOnce(new Error('down'));
    const onRollback = vi.fn();
    const failing = saveAmountUnit('s11', account, 'fiat', onRollback);
    useAuthStore.setState({ account: null });
    await failing;
    expect(useAuthStore.getState().account).toBeNull();
    expect(onRollback).toHaveBeenCalledWith('btc');
  });
});
