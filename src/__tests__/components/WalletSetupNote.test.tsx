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
  it('renders an inline alert and retries without becoming a dialog', () => {
    const retry = vi.fn();
    vi.mocked(useWalletSetup).mockReturnValue({ failed: true, retry });
    renderWithLocale(<WalletSetupNote />);
    expect(screen.getByRole('alert').textContent).toBe(
      'Your wallet could not be set up yet. Try again',
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
