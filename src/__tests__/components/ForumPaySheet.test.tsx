import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ForumPaySheet, type ForumPayError } from '@/components/ForumPaySheet';
import { renderWithLocale } from '@/__tests__/render-with-locale';
import type { FiatRateDay } from '@/lib/stats-money';

const DAY: FiatRateDay = {
  sats: 100_000_000,
  usd: '100000.00',
  chf: '80000.00',
  eur: '90000.00',
  php: '5600000.00',
};

function sheet(
  error: ForumPayError,
  invoice: boolean,
  extra?: { payBusy?: boolean; ratePending?: boolean },
): {
  onPaySubmit: ReturnType<typeof vi.fn>;
  onPayCancel: ReturnType<typeof vi.fn>;
  onPayDraftChange: ReturnType<typeof vi.fn>;
} {
  const onPaySubmit = vi.fn(() => undefined);
  const onPayCancel = vi.fn();
  const onPayDraftChange = vi.fn();
  renderWithLocale(
    <ForumPaySheet
      messageId="c-1"
      payDraft="21"
      payBusy={extra?.payBusy ?? false}
      payError={error}
      payInvoice={invoice ? { messageId: 'c-1', pr: 'lnbc1', amountSats: 21 } : null}
      payWaiting={false}
      onPayDraftChange={onPayDraftChange}
      onPayUnitChange={vi.fn()}
      onPaySubmit={onPaySubmit}
      onPayCancel={onPayCancel}
      rateDay={DAY}
      {...(extra?.ratePending === undefined ? {} : { ratePending: extra.ratePending })}
      onInteract={vi.fn()}
    />,
  );
  return { onPaySubmit, onPayCancel, onPayDraftChange };
}

describe('ForumPaySheet', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows the amount form and submits the draft', () => {
    const { onPaySubmit, onPayCancel } = sheet(null, false);
    expect(screen.getByLabelText('Amount')).toBeTruthy();
    expect(screen.getByText('$0.02')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onPaySubmit).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onPayCancel).toHaveBeenCalledTimes(1);
  });

  it('shows the habit amount sentence, not the forum amount sentence', () => {
    sheet('habitAmount', false);
    expect(screen.getByRole('alert').textContent).toBe(
      'Expected a JSON body with an integer "amountSats"',
    );
    expect(screen.queryByText('Enter a whole number greater than zero')).toBeNull();
  });

  it('does not submit while busy or while the rate is still loading', () => {
    const busy = sheet(null, false, { payBusy: true });
    const busyButton = screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement;
    expect(busyButton.disabled).toBe(true);
    fireEvent.submit(busyButton.closest('form') as HTMLFormElement);
    expect(busy.onPaySubmit).not.toHaveBeenCalled();
    cleanup();

    const pending = sheet(null, false, { ratePending: true });
    const pendingButton = screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement;
    expect(pendingButton.disabled).toBe(true);
    fireEvent.submit(pendingButton.closest('form') as HTMLFormElement);
    expect(pending.onPaySubmit).not.toHaveBeenCalled();
  });

  it('shows the invoice card with the fiat line', () => {
    const { onPayCancel } = sheet(null, true);
    expect(screen.getByText(/Pay ₿21/)).toBeTruthy();
    expect(screen.getByText('$0.02')).toBeTruthy();
    expect(
      screen.getByText('Your 21.gifts wallet is not available here, so this cannot be paid.'),
    ).toBeTruthy();
    expect(screen.queryByRole('img', { name: 'Bitcoin payment QR code' })).toBeNull();
    expect(screen.queryByLabelText('Amount')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onPayCancel).toHaveBeenCalledTimes(1);
  });
});
