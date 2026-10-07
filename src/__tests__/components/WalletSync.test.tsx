import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WalletSync } from '@/components/WalletSync';
import { listenForWalletPhrase } from '@/lib/wallet/wallet-service';
import { listenForWalletSetup } from '@/lib/wallet/wallet-setup';

vi.mock('@/lib/wallet/wallet-service', () => ({
  listenForWalletPhrase: vi.fn(),
}));

vi.mock('@/lib/wallet/wallet-setup', () => ({
  listenForWalletSetup: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
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
});
