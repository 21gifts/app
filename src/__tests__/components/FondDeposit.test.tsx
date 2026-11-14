import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FondDeposit } from '@/components/FondDeposit';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/components/QrCode', () => ({
  QrCode: ({ value, label }: { value: string; label: string }) => (
    <div role="img" aria-label={label} data-value={value} />
  ),
}));

const ADDRESS = 'bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  Reflect.deleteProperty(navigator, 'clipboard');
});

describe('FondDeposit', () => {
  it('opens on Lightning with the Fond address and its QR', async () => {
    renderWithLocale(<FondDeposit username="tondo-fond" onchainAddress={ADDRESS} />);
    expect(screen.getByRole('heading', { name: 'Top up this Fond' })).toBeTruthy();
    const group = screen.getByRole('group', { name: 'Deposit method' });
    expect(group).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Instant payment' }).getAttribute('aria-pressed'),
    ).toBe('true');
    expect(
      screen.getByRole('button', { name: 'On-chain deposit' }).getAttribute('aria-pressed'),
    ).toBe('false');
    expect(await screen.findByText('tondo-fond@21.gifts')).toBeTruthy();
    expect(screen.getByText('Scan the code or send to this address:')).toBeTruthy();
    expect(screen.queryByText('To add Bitcoin, send it to your address:')).toBeNull();
    expect(screen.getByRole('img', { name: 'Open CryptoPay QR code' })).toBeTruthy();
    expect(screen.queryByText(ADDRESS)).toBeNull();
  });

  it('switches to On-chain: BIP21 QR without an amount, the address, and the confirmations line', async () => {
    renderWithLocale(<FondDeposit username="tondo-fond" onchainAddress={ADDRESS} />);
    fireEvent.click(screen.getByRole('button', { name: 'On-chain deposit' }));
    expect(
      screen.getByRole('button', { name: 'On-chain deposit' }).getAttribute('aria-pressed'),
    ).toBe('true');
    const qr = screen.getByRole('img', { name: 'Bitcoin address QR code' });
    expect(qr.getAttribute('data-value')).toBe(`bitcoin:${ADDRESS}`);
    expect(screen.getByText(ADDRESS).className).toContain('break-all');
    expect(screen.getByText(ADDRESS).className).toContain('font-mono');
    expect(
      screen.getByText(
        'On-chain deposits need confirmations on the Bitcoin network, usually 3, before they show in the balance.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText('tondo-fond@21.gifts')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Instant payment' }));
    expect(await screen.findByText('tondo-fond@21.gifts')).toBeTruthy();
  });

  it('copies the bare on-chain address with the icon-only Copy control', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    renderWithLocale(<FondDeposit username="tondo-fond" onchainAddress={ADDRESS} />);
    fireEvent.click(screen.getByRole('button', { name: 'On-chain deposit' }));
    const copy = screen.getByRole('button', { name: 'Copy' });
    expect(screen.queryByText('Copy')).toBeNull();
    fireEvent.click(copy);
    await act(async () => undefined);
    expect(writeText).toHaveBeenCalledWith(ADDRESS);
    expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
  });

  it('shows Lightning without a selector while the address is null', async () => {
    renderWithLocale(<FondDeposit username="tondo-fond" onchainAddress={null} />);
    expect(screen.queryByRole('group', { name: 'Deposit method' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'On-chain deposit' })).toBeNull();
    expect(await screen.findByText('tondo-fond@21.gifts')).toBeTruthy();
  });

  it.each([
    ['free text', 'not an address'],
    ['a testnet address', 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx'],
    ['a payment URI', `bitcoin:${ADDRESS}?amount=1`],
  ])('renders no selector and never encodes %s', async (_label, value) => {
    renderWithLocale(<FondDeposit username="tondo-fond" onchainAddress={value} />);
    expect(screen.queryByRole('group', { name: 'Deposit method' })).toBeNull();
    expect(screen.queryByText(value)).toBeNull();
    expect(await screen.findByText('tondo-fond@21.gifts')).toBeTruthy();
    for (const img of screen.getAllByRole('img')) {
      expect(img.getAttribute('data-value')).not.toContain(value);
    }
  });
});
