import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WalletSync } from '@/components/WalletSync';
import { listenForWalletPhrase } from '@/lib/wallet/wallet-service';

vi.mock('@/lib/wallet/wallet-service', () => ({
  listenForWalletPhrase: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('WalletSync', () => {
  it('subscribes once, renders nothing, and unsubscribes on unmount', () => {
    const unsubscribe = vi.fn();
    vi.mocked(listenForWalletPhrase).mockReturnValue(unsubscribe);
    const { container, unmount } = render(<WalletSync />);
    expect(listenForWalletPhrase).toHaveBeenCalledTimes(1);
    expect(container.firstChild).toBeNull();
    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
