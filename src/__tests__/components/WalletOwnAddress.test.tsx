import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WalletOwnAddress } from '@/components/WalletOwnAddress';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/components/QrCode', () => ({
  QrCode: ({ value, label }: { value: string; label: string }) => (
    <div role="img" aria-label={label} data-value={value} />
  ),
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'clipboard');
});

describe('WalletOwnAddress', () => {
  it('shows the own address and QR without changing WalletPay when copy is omitted', async () => {
    renderWithLocale(<WalletOwnAddress username="ada" />);
    expect(await screen.findByText('ada@21.gifts')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Open CryptoPay QR code' })).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('copies the address, shows Copied, and resets after two seconds', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    renderWithLocale(<WalletOwnAddress username="ada" copy />);
    await act(async () => undefined);
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await act(async () => undefined);
    expect(writeText).toHaveBeenCalledWith('ada@21.gifts');
    expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
  });

  it('keeps Copy when clipboard access fails', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    renderWithLocale(<WalletOwnAddress username="ada" copy />);
    const button = await screen.findByRole('button', { name: 'Copy' });
    fireEvent.click(button);
    await act(async () => undefined);
    expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
  });

  it('renders nothing for a username that cannot produce an address', async () => {
    const { container } = renderWithLocale(<WalletOwnAddress username="  " copy />);
    await act(async () => undefined);
    expect(container.innerHTML).toBe('');
  });
});
