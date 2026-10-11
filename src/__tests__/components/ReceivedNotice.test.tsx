import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReceivedNotice } from '@/components/ReceivedNotice';
import { useIncomingPayment } from '@/hooks/useIncomingPayment';
import { useSpotRate } from '@/hooks/useSpotRate';
import type { FiatRateDay } from '@/lib/stats-money';
import type { WalletPayment } from '@/lib/wallet/wallet-sdk';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/hooks/useSpotRate', () => ({ useSpotRate: vi.fn() }));
vi.mock('@/hooks/useIncomingPayment', () => ({ useIncomingPayment: vi.fn() }));

const RATE_DAY: FiatRateDay = {
  sats: 100_000_000,
  usd: '100000.00',
  chf: '80000.00',
  eur: '90000.00',
  php: '5600000.00',
};

function payment(info: WalletPayment['info'] = {}): WalletPayment {
  return {
    id: 'p1',
    direction: 'received',
    amountSats: 500,
    feesSats: 0,
    timestamp: 1,
    status: 'completed',
    method: 'lightning',
    senderComment: null,
    info,
  };
}

const dismiss = vi.fn();

beforeEach(() => {
  dismiss.mockReset();
  vi.mocked(useSpotRate).mockReset().mockReturnValue(RATE_DAY);
  vi.mocked(useIncomingPayment).mockReset().mockReturnValue({ payment: null, dismiss });
});

afterEach(cleanup);

describe('ReceivedNotice', () => {
  it('renders nothing without a payment and asks for no rate', () => {
    const { container } = renderWithLocale(<ReceivedNotice />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
    expect(useSpotRate).toHaveBeenCalledWith(false);
    expect(useIncomingPayment).toHaveBeenCalledWith(6000);
  });

  it('shows the amount, the fiat, and the sender the payment list names, as a link to /wallet', () => {
    vi.mocked(useIncomingPayment).mockReturnValue({
      payment: payment({ lnAddress: 'bruno@21.gifts' }),
      dismiss,
    });
    renderWithLocale(<ReceivedNotice />);
    const status = screen.getByRole('status');
    expect(status.className).toContain('max-w-sm');
    expect(status.className).toContain('border-app-success/40');
    expect(screen.getByText('You received ₿500')).toBeTruthy();
    expect(screen.getByText('$0.50 · from bruno@21.gifts')).toBeTruthy();
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('/wallet');
    fireEvent.click(link);
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it('shows only the fiat without a known sender, and closes on X', () => {
    vi.mocked(useIncomingPayment).mockReturnValue({ payment: payment(), dismiss });
    renderWithLocale(<ReceivedNotice />);
    expect(screen.getByText('$0.50')).toBeTruthy();
    expect(screen.queryByText(/from/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Close')).toBeNull();
  });

  it('shows the sender alone without a rate, and no second line without either', () => {
    vi.mocked(useSpotRate).mockReturnValue(null);
    vi.mocked(useIncomingPayment).mockReturnValue({
      payment: payment({ lnAddress: 'bruno@21.gifts' }),
      dismiss,
    });
    renderWithLocale(<ReceivedNotice />);
    expect(screen.getByText('from bruno@21.gifts')).toBeTruthy();
    cleanup();
    vi.mocked(useIncomingPayment).mockReturnValue({ payment: payment(), dismiss });
    renderWithLocale(<ReceivedNotice />);
    const link = screen.getByRole('link');
    expect(link.querySelectorAll('p')).toHaveLength(1);
  });
});
