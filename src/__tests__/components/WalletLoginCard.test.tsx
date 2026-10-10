import { act, cleanup, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WalletLoginCard } from '@/components/WalletLoginCard';
import type { Account } from '@/lib/api-types';
import { finishWalletOpen, type WalletOpenOutcome } from '@/lib/wallet/wallet-open';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/components/LoginCard', () => ({
  LoginCard: ({ heldProblem }: { heldProblem?: 'noPrf' | 'failed' | null }) => (
    <>
      <p>login card</p>
      {heldProblem === undefined || heldProblem === null ? null : (
        <p role="alert">
          {heldProblem === 'noPrf'
            ? 'This phone or browser cannot hold a 21.gifts wallet.'
            : 'Something went wrong. Please try again.'}
        </p>
      )}
    </>
  ),
}));
vi.mock('@/lib/wallet/wallet-open', () => ({ finishWalletOpen: vi.fn() }));

const account = { id: 'account' } as Account;
const ORIGINAL_E2E_NOW = process.env.NEXT_PUBLIC_E2E_NOW;

function deferredOutcome(): {
  promise: Promise<WalletOpenOutcome>;
  resolve: (outcome: WalletOpenOutcome) => void;
} {
  let resolve: (outcome: WalletOpenOutcome) => void = () => undefined;
  const promise = new Promise<WalletOpenOutcome>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(() => {
  window.history.replaceState({}, '', '/wallet');
  delete process.env.NEXT_PUBLIC_E2E_NOW;
  useAuthStore.setState({ session: null, account: null, lockedSession: null });
  vi.mocked(finishWalletOpen).mockReset().mockResolvedValue('open');
});

afterEach(() => {
  cleanup();
  if (ORIGINAL_E2E_NOW === undefined) delete process.env.NEXT_PUBLIC_E2E_NOW;
  else process.env.NEXT_PUBLIC_E2E_NOW = ORIGINAL_E2E_NOW;
});

describe('WalletLoginCard', () => {
  it('shows the login card without opening a wallet while there is no session', () => {
    renderWithLocale(<WalletLoginCard />);
    expect(screen.getByText('login card')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(finishWalletOpen).not.toHaveBeenCalled();
  });

  it('adds no Log out under the card of a held-back session', () => {
    useAuthStore.setState({ session: null, account: null, lockedSession: 'stored' });
    renderWithLocale(<WalletLoginCard />);
    expect(screen.getByText('login card')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('keeps an opened session active', async () => {
    renderWithLocale(<WalletLoginCard />);
    act(() => useAuthStore.setState({ session: 'token', account }));
    await waitFor(() => expect(finishWalletOpen).toHaveBeenCalledTimes(1));
    await act(async () => undefined);
    expect(useAuthStore.getState().session).toBe('token');
    expect(useAuthStore.getState().lockedSession).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it.each([
    ['noPrf', 'This phone or browser cannot hold a 21.gifts wallet.'],
    ['failed', 'Something went wrong. Please try again.'],
  ] as const)('locks the session and shows the %s alert', async (outcome, message) => {
    vi.mocked(finishWalletOpen).mockResolvedValue(outcome);
    useAuthStore.setState({ session: 'token', account });
    renderWithLocale(<WalletLoginCard />);
    expect((await screen.findByRole('alert')).textContent).toContain(message);
    expect(useAuthStore.getState()).toMatchObject({
      session: null,
      account: null,
      lockedSession: 'token',
    });
  });

  it('locks a cancelled session with the retry message', async () => {
    vi.mocked(finishWalletOpen).mockResolvedValue('cancelled');
    useAuthStore.setState({ session: 'token', account });
    renderWithLocale(<WalletLoginCard />);
    await waitFor(() => expect(useAuthStore.getState().lockedSession).toBe('token'));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Something went wrong. Please try again.',
    );
  });

  it('shows the alert on a card that mounts after the open failed for that session', async () => {
    const pending = deferredOutcome();
    vi.mocked(finishWalletOpen).mockReturnValue(pending.promise);
    useAuthStore.setState({ session: 'tok-remount-late', account, lockedSession: null });
    const first = renderWithLocale(<WalletLoginCard />);
    first.unmount();
    await act(async () => pending.resolve('noPrf'));
    renderWithLocale(<WalletLoginCard />);
    expect(screen.getByRole('alert').textContent).toContain('cannot hold a 21.gifts wallet');
  });

  it('shows the alert on a second card for the same session after the first one held it back', async () => {
    const pending = deferredOutcome();
    vi.mocked(finishWalletOpen).mockReturnValue(pending.promise);
    useAuthStore.setState({ session: 'tok-remount-early', account, lockedSession: null });
    const first = renderWithLocale(<WalletLoginCard />);
    first.unmount();
    renderWithLocale(<WalletLoginCard />);
    await act(async () => pending.resolve('failed'));
    expect(useAuthStore.getState().lockedSession).toBe('tok-remount-early');
    expect((await screen.findByRole('alert')).textContent).toContain('Something went wrong');
  });

  it('still holds the session back when the open fails after unmount', async () => {
    const pending = deferredOutcome();
    vi.mocked(finishWalletOpen).mockReturnValue(pending.promise);
    useAuthStore.setState({ session: 'token', account, lockedSession: null });
    const { unmount } = renderWithLocale(<WalletLoginCard />);
    unmount();
    await act(async () => pending.resolve('failed'));
    expect(useAuthStore.getState()).toMatchObject({
      session: null,
      account: null,
      lockedSession: 'token',
    });
  });

  it('ignores an outcome belonging to a replaced session', async () => {
    const pending = deferredOutcome();
    vi.mocked(finishWalletOpen).mockReturnValue(pending.promise);
    useAuthStore.setState({ session: 'token', account });
    renderWithLocale(<WalletLoginCard />);
    const actual = useAuthStore.getState();
    const getState = vi.spyOn(useAuthStore, 'getState').mockReturnValue({
      ...actual,
      session: 'new-token',
    });
    await act(async () => pending.resolve('failed'));
    getState.mockRestore();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(useAuthStore.getState().session).toBe('token');
  });

  it.each([
    ['balance-locked-prf-unsupported', 'This phone or browser cannot hold a 21.gifts wallet.'],
    ['balance-locked-error', 'Something went wrong. Please try again.'],
  ] as const)('pins %s in a Playwright build', (visual, message) => {
    process.env.NEXT_PUBLIC_E2E_NOW = '2026-01-07T12:00:00.000Z';
    window.history.replaceState({}, '', `/wallet?visual=${visual}`);
    renderWithLocale(<WalletLoginCard />);
    expect(screen.getByRole('alert').textContent).toContain(message);
  });

  it.each(['balance-locked-prf-unsupported', 'balance-locked-error'])(
    'ignores %s in a production build',
    (visual) => {
      window.history.replaceState({}, '', `/wallet?visual=${visual}`);
      renderWithLocale(<WalletLoginCard />);
      expect(screen.queryByRole('alert')).toBeNull();
    },
  );
});
