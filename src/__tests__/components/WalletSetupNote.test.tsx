import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WalletSetupNote } from '@/components/WalletSetupNote';
import { useWalletSetup } from '@/hooks/useWalletSetup';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/hooks/useWalletSetup', () => ({
  useWalletSetup: vi.fn(),
}));

afterEach(cleanup);

describe('WalletSetupNote', () => {
  it('renders the alert sentence and a Try again button, without a dialog', () => {
    const retry = vi.fn();
    vi.mocked(useWalletSetup).mockReturnValue({ failed: true, retry });
    renderWithLocale(<WalletSetupNote />);
    expect(screen.getByRole('alert').textContent).toBe('Your wallet could not be set up yet.');
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
