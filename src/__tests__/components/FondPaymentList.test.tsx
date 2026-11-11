import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FondPaymentList } from '@/components/FondPaymentList';
import type { FondPaymentList as FondPaymentPage } from '@/lib/api-types';
import type { FiatRateDay } from '@/lib/stats-money';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const spot = vi.hoisted(() => ({ value: null as FiatRateDay | null }));

vi.mock('@/hooks/useSpotRate', () => ({
  useSpotRate: (): FiatRateDay | null => spot.value,
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, fetchFondPayments: vi.fn() };
});

import { fetchFondPayments } from '@/lib/api';

const PAYMENTS: FondPaymentPage = {
  payments: [
    {
      id: 'payment-private',
      direction: 'in',
      amountSats: 21_000,
      feeSats: 0,
      paidAt: '2026-11-11T13:31:01.000Z',
      counterparty: null,
    },
    {
      id: 'payment-member',
      direction: 'out',
      amountSats: 5_000,
      feeSats: 21,
      paidAt: '2026-11-10T09:00:00.000Z',
      counterparty: { accountId: 'acc-alice', username: 'alice', name: 'Alice' },
    },
    {
      id: 'payment-handle',
      direction: 'in',
      amountSats: 1_000,
      feeSats: 0,
      paidAt: '2026-11-09T09:00:00.000Z',
      counterparty: { accountId: 'acc-bob', username: 'bob', name: '' },
    },
  ],
  next: null,
};

afterEach(() => {
  cleanup();
  vi.mocked(fetchFondPayments).mockReset();
  spot.value = null;
});

describe('FondPaymentList', () => {
  it('shows the loading sentence before the first page', () => {
    vi.mocked(fetchFondPayments).mockReturnValue(new Promise(() => undefined));
    renderWithLocale(<FondPaymentList username="tondo-fond" />);
    expect(screen.getByText('Loading…')).toBeTruthy();
  });

  it('lists incoming, outgoing, private, member, and fee details', async () => {
    spot.value = { sats: 100_000_000, usd: '100000', chf: null, eur: null, php: null };
    vi.mocked(fetchFondPayments).mockResolvedValue(PAYMENTS);
    renderWithLocale(<FondPaymentList username="tondo-fond" />);
    expect(await screen.findByRole('region', { name: 'Payments' })).toBeTruthy();
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(within(rows[0]!).getByText('Incoming')).toBeTruthy();
    expect(within(rows[1]!).getByText('Outgoing')).toBeTruthy();
    expect(within(rows[2]!).getByText('Incoming')).toBeTruthy();
    expect(screen.getByText('Private')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Alice' }).getAttribute('href')).toBe(
      '/members/acc-alice',
    );
    expect(screen.getByRole('link', { name: '@bob' }).getAttribute('href')).toBe(
      '/members/acc-bob',
    );
    expect(screen.getByText(/\+₿21'000/).textContent).toContain('$21.00');
    const fee = screen.getByText('Fee ₿21', { exact: false });
    expect(fee.textContent).toContain('$0.02');
    expect(screen.getAllByText(/2026/)).toHaveLength(3);
  });

  it('hides an incoming zero fee but shows an outgoing zero fee as Free', async () => {
    vi.mocked(fetchFondPayments).mockResolvedValue({
      payments: [
        { ...PAYMENTS.payments[0]!, id: 'free-in', direction: 'in', feeSats: 0 },
        { ...PAYMENTS.payments[0]!, id: 'free-out', direction: 'out', feeSats: 0 },
      ],
      next: null,
    });
    renderWithLocale(<FondPaymentList username="tondo-fond" />);
    const rows = await screen.findAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]!).queryByText(/^Fee /)).toBeNull();
    expect(within(rows[1]!).getByText('Outgoing')).toBeTruthy();
    expect(within(rows[1]!).getByText('Fee Free').textContent).toBe('Fee Free');
  });

  it('falls back to @username when the member name is null', async () => {
    vi.mocked(fetchFondPayments).mockResolvedValue({
      payments: [
        {
          ...PAYMENTS.payments[0]!,
          counterparty: { accountId: 'acc-carol', username: 'carol', name: null },
        },
      ],
      next: null,
    });
    renderWithLocale(<FondPaymentList username="tondo-fond" />);
    expect(await screen.findByText('@carol')).toBeTruthy();
  });

  it('labels a member without name or username as Unnamed', async () => {
    vi.mocked(fetchFondPayments).mockResolvedValue({
      payments: [
        {
          ...PAYMENTS.payments[0]!,
          counterparty: { accountId: 'acc-dana', username: null, name: null },
        },
      ],
      next: null,
    });
    renderWithLocale(<FondPaymentList username="tondo-fond" />);
    const link = await screen.findByRole('link', { name: 'Unnamed' });
    expect(link.getAttribute('href')).toBe('/members/acc-dana');
  });

  it('shows the empty payments line', async () => {
    vi.mocked(fetchFondPayments).mockResolvedValue({ payments: [], next: null });
    renderWithLocale(<FondPaymentList username="tondo-fond" />);
    expect(await screen.findByText('No payments yet.')).toBeTruthy();
  });

  it('keeps Load more when an empty page still has a cursor', async () => {
    vi.mocked(fetchFondPayments)
      .mockResolvedValueOnce({ payments: [], next: 'cursor-2' })
      .mockResolvedValueOnce({ payments: [PAYMENTS.payments[0]!], next: null });
    renderWithLocale(<FondPaymentList username="tondo-fond" />);
    expect(await screen.findByRole('button', { name: 'Load more' })).toBeTruthy();
    expect(screen.queryByText('No payments yet.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(await screen.findByText('Private')).toBeTruthy();
    expect(screen.queryByText('No payments yet.')).toBeNull();
    expect(fetchFondPayments).toHaveBeenLastCalledWith('tondo-fond', 'cursor-2');
  });

  it('appends the next page and removes Load more at the end', async () => {
    vi.mocked(fetchFondPayments)
      .mockResolvedValueOnce({ payments: [PAYMENTS.payments[0]!], next: 'cursor-2' })
      .mockResolvedValueOnce({ payments: [PAYMENTS.payments[1]!], next: null });
    renderWithLocale(<FondPaymentList username="tondo-fond" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Load more' }));
    expect(await screen.findByText('Alice')).toBeTruthy();
    expect(screen.getByText('Private')).toBeTruthy();
    expect(fetchFondPayments).toHaveBeenLastCalledWith('tondo-fond', 'cursor-2');
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
  });

  it('disables Load more while the next page is in flight', async () => {
    let resolvePage: ((page: FondPaymentPage | null) => void) | undefined;
    vi.mocked(fetchFondPayments)
      .mockResolvedValueOnce({ payments: [PAYMENTS.payments[0]!], next: 'cursor-2' })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolvePage = resolve;
          }),
      );
    renderWithLocale(<FondPaymentList username="tondo-fond" />);
    const button = await screen.findByRole('button', { name: 'Load more' });
    fireEvent.click(button);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Load more' }).hasAttribute('disabled')).toBe(true);
    });
    resolvePage?.({ payments: [PAYMENTS.payments[1]!], next: null });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
    });
  });

  it('fires one next-page request when Load more is clicked twice', async () => {
    let resolvePage: ((page: FondPaymentPage | null) => void) | undefined;
    vi.mocked(fetchFondPayments)
      .mockResolvedValueOnce({ payments: [PAYMENTS.payments[0]!], next: 'cursor-2' })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolvePage = resolve;
          }),
      );
    renderWithLocale(<FondPaymentList username="tondo-fond" />);
    const button = await screen.findByRole('button', { name: 'Load more' });
    act(() => {
      button.click();
      button.click();
    });
    expect(fetchFondPayments).toHaveBeenCalledTimes(2);
    expect(fetchFondPayments).toHaveBeenLastCalledWith('tondo-fond', 'cursor-2');
    resolvePage?.({ payments: [PAYMENTS.payments[1]!], next: null });
    expect(await screen.findByText('Alice')).toBeTruthy();
  });

  it('does not append a next-page payment whose id is already listed', async () => {
    vi.mocked(fetchFondPayments)
      .mockResolvedValueOnce({ payments: [PAYMENTS.payments[0]!], next: 'cursor-2' })
      .mockResolvedValueOnce({
        payments: [PAYMENTS.payments[0]!, PAYMENTS.payments[1]!],
        next: null,
      });
    renderWithLocale(<FondPaymentList username="tondo-fond" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Load more' }));
    expect(await screen.findByText('Alice')).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getAllByText('Private')).toHaveLength(1);
  });

  it('shows the payments error with retry after the first load fails', async () => {
    vi.mocked(fetchFondPayments)
      .mockRejectedValueOnce(new Error('503'))
      .mockResolvedValueOnce(PAYMENTS);
    renderWithLocale(<FondPaymentList username="tondo-fond" />);
    expect(
      await screen.findByText('Could not load the Fond payments. Please try again.'),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Private')).toBeTruthy();
    expect(fetchFondPayments).toHaveBeenCalledTimes(2);
  });

  it('treats a null first page as an error', async () => {
    vi.mocked(fetchFondPayments).mockResolvedValue(null);
    renderWithLocale(<FondPaymentList username="tondo-fond" />);
    expect(
      await screen.findByText('Could not load the Fond payments. Please try again.'),
    ).toBeTruthy();
  });

  it('keeps the list and retries a failed next page', async () => {
    vi.mocked(fetchFondPayments)
      .mockResolvedValueOnce({ payments: [PAYMENTS.payments[0]!], next: 'cursor-2' })
      .mockRejectedValueOnce(new Error('503'))
      .mockResolvedValueOnce({ payments: [PAYMENTS.payments[1]!], next: null });
    renderWithLocale(<FondPaymentList username="tondo-fond" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Load more' }));
    expect(
      await screen.findByText('Could not load the Fond payments. Please try again.'),
    ).toBeTruthy();
    expect(screen.getByText('Private')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Alice')).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(fetchFondPayments).toHaveBeenLastCalledWith('tondo-fond', 'cursor-2');
  });

  it('appends a successful Try again page once', async () => {
    let resolvePage: ((page: FondPaymentPage | null) => void) | undefined;
    vi.mocked(fetchFondPayments)
      .mockResolvedValueOnce({ payments: [PAYMENTS.payments[0]!], next: 'cursor-2' })
      .mockRejectedValueOnce(new Error('503'))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolvePage = resolve;
          }),
      );
    renderWithLocale(<FondPaymentList username="tondo-fond" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Load more' }));
    expect(
      await screen.findByText('Could not load the Fond payments. Please try again.'),
    ).toBeTruthy();
    const retry = screen.getByRole('button', { name: 'Try again' });
    act(() => {
      retry.click();
      retry.click();
    });
    expect(fetchFondPayments).toHaveBeenCalledTimes(3);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Try again' }).hasAttribute('disabled')).toBe(true);
    });
    resolvePage?.({ payments: [PAYMENTS.payments[1]!], next: null });
    expect(await screen.findByText('Alice')).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });

  it('treats a null next-page answer as a retryable failure', async () => {
    vi.mocked(fetchFondPayments)
      .mockResolvedValueOnce({ payments: [PAYMENTS.payments[0]!], next: 'cursor-2' })
      .mockResolvedValueOnce(null);
    renderWithLocale(<FondPaymentList username="tondo-fond" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Load more' }));
    expect(
      await screen.findByText('Could not load the Fond payments. Please try again.'),
    ).toBeTruthy();
    expect(screen.getByText('Private')).toBeTruthy();
  });

  it('retries a null next-page answer after the user presses Try again', async () => {
    vi.mocked(fetchFondPayments)
      .mockResolvedValueOnce({ payments: [PAYMENTS.payments[0]!], next: 'cursor-2' })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ payments: [PAYMENTS.payments[1]!], next: null });
    renderWithLocale(<FondPaymentList username="tondo-fond" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Load more' }));
    expect(
      await screen.findByText('Could not load the Fond payments. Please try again.'),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Alice')).toBeTruthy();
    expect(fetchFondPayments).toHaveBeenLastCalledWith('tondo-fond', 'cursor-2');
  });

  it('ignores a stale first page after unmount', async () => {
    let resolvePage: ((page: FondPaymentPage | null) => void) | undefined;
    vi.mocked(fetchFondPayments).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePage = resolve;
        }),
    );
    const view = renderWithLocale(<FondPaymentList username="tondo-fond" />);
    view.unmount();
    resolvePage?.(PAYMENTS);
    await Promise.resolve();
    expect(resolvePage).toBeDefined();
  });

  it('ignores a stale first-page rejection after unmount', async () => {
    let rejectPage: ((reason: Error) => void) | undefined;
    vi.mocked(fetchFondPayments).mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectPage = reject;
        }),
    );
    const view = renderWithLocale(<FondPaymentList username="tondo-fet" />);
    view.unmount();
    rejectPage?.(new Error('503'));
    await Promise.resolve();
    expect(rejectPage).toBeDefined();
  });

  it('ignores a next-page response and rejection after unmount', async () => {
    let resolveNext: ((page: FondPaymentPage | null) => void) | undefined;
    vi.mocked(fetchFondPayments)
      .mockResolvedValueOnce({ payments: [PAYMENTS.payments[0]!], next: 'cursor-2' })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveNext = resolve;
          }),
      );
    const view = renderWithLocale(<FondPaymentList username="tondo-fond" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Load more' }));
    view.unmount();
    resolveNext?.({ payments: [PAYMENTS.payments[1]!], next: null });
    await Promise.resolve();
    expect(resolveNext).toBeDefined();
  });

  it('ignores a next-page rejection after unmount', async () => {
    let rejectNext: ((reason: Error) => void) | undefined;
    vi.mocked(fetchFondPayments)
      .mockResolvedValueOnce({ payments: [PAYMENTS.payments[0]!], next: 'cursor-2' })
      .mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            rejectNext = reject;
          }),
      );
    const view = renderWithLocale(<FondPaymentList username="tondo-fond" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Load more' }));
    view.unmount();
    rejectNext?.(new Error('503'));
    await Promise.resolve();
    expect(rejectNext).toBeDefined();
  });

  it('shows the German payment labels', async () => {
    vi.mocked(fetchFondPayments).mockResolvedValue({ ...PAYMENTS, next: 'cursor-2' });
    renderWithLocale(<FondPaymentList username="tondo-fond" />, 'de');
    expect(await screen.findByText('Zahlungen')).toBeTruthy();
    const rows = screen.getAllByRole('listitem');
    expect(within(rows[0]!).getByText('Eingang')).toBeTruthy();
    expect(within(rows[1]!).getByText('Ausgang')).toBeTruthy();
    expect(within(rows[2]!).getByText('Eingang')).toBeTruthy();
    expect(screen.getByText('Privat')).toBeTruthy();
    expect(screen.getByText('Mehr laden')).toBeTruthy();
  });
});
