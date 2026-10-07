import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WALLET_REPORT_INTERVAL_MS, WalletSync } from '@/components/WalletSync';
import { reportWallet } from '@/lib/wallet/wallet-report';
import { listenForWalletPhrase, refreshWallet } from '@/lib/wallet/wallet-service';
import { listenForWalletSetup } from '@/lib/wallet/wallet-setup';
import { useWalletStore } from '@/stores/wallet-store';

vi.mock('@/lib/wallet/wallet-service', () => ({
  listenForWalletPhrase: vi.fn(),
  refreshWallet: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/lib/wallet/wallet-setup', () => ({
  listenForWalletSetup: vi.fn(),
}));

vi.mock('@/lib/wallet/wallet-report', () => ({
  reportWallet: vi.fn(() => Promise.resolve()),
}));

beforeEach(() => {
  vi.mocked(listenForWalletPhrase).mockReturnValue(() => undefined);
  vi.mocked(listenForWalletSetup).mockReturnValue(() => undefined);
  useWalletStore.setState({ status: 'locked', balanceSats: null, identityPubkey: null });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('WalletSync', () => {
  it('subscribes once, renders nothing, and unsubscribes on unmount', () => {
    const stopPhrase = vi.fn();
    const stopSetup = vi.fn();
    vi.mocked(listenForWalletPhrase).mockReturnValue(stopPhrase);
    vi.mocked(listenForWalletSetup).mockReturnValue(stopSetup);
    const { container, unmount } = render(<WalletSync />);
    expect(listenForWalletPhrase).toHaveBeenCalledTimes(1);
    expect(listenForWalletSetup).toHaveBeenCalledTimes(1);
    expect(vi.mocked(listenForWalletPhrase).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(listenForWalletSetup).mock.invocationCallOrder[0] ?? 0,
    );
    expect(container.firstChild).toBeNull();
    unmount();
    expect(stopSetup).toHaveBeenCalledTimes(1);
    expect(stopPhrase).toHaveBeenCalledTimes(1);
    expect(stopSetup.mock.invocationCallOrder[0]).toBeLessThan(
      stopPhrase.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('reports after every successful wallet read', () => {
    render(<WalletSync />);
    act(() => {
      useWalletStore.getState().setConnecting();
    });
    expect(reportWallet).not.toHaveBeenCalled();
    act(() => {
      useWalletStore.getState().setReady(1_000, 'id');
    });
    expect(reportWallet).toHaveBeenCalledTimes(1);
    act(() => {
      useWalletStore.getState().setReady(2_000, 'id');
    });
    expect(reportWallet).toHaveBeenCalledTimes(2);
    act(() => {
      useWalletStore.getState().setError();
    });
    expect(reportWallet).toHaveBeenCalledTimes(2);
  });

  it('reads the synced balance on the interval only while the wallet is open', () => {
    vi.useFakeTimers();
    const { unmount } = render(<WalletSync />);
    act(() => {
      vi.advanceTimersByTime(WALLET_REPORT_INTERVAL_MS);
    });
    expect(refreshWallet).not.toHaveBeenCalled();
    act(() => {
      useWalletStore.getState().setReady(1, 'id');
    });
    act(() => {
      vi.advanceTimersByTime(WALLET_REPORT_INTERVAL_MS);
    });
    expect(refreshWallet).toHaveBeenCalledWith({ ensureSynced: true, ignoreFailure: true });
    unmount();
    act(() => {
      vi.advanceTimersByTime(WALLET_REPORT_INTERVAL_MS);
    });
    expect(refreshWallet).toHaveBeenCalledTimes(1);
  });
});
