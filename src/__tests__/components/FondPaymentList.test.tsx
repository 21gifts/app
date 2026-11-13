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

import { fetchFondPayments, FondPaymentsError } from '@/lib/api';

const PAYMENTS: FondPaymentPage = {
  payments: [
    {
      id: 'payment-private',
      direction: 'in',
      amountSats: 21_000,
      paidAt: '2026-11-11T13:31:01.000Z',
      storedFiat: null,
      counterparty: null,
    },
    {
      id: 'payment-member',
      direction: 'out',
      amountSats: 5_000,
      paidAt: '2026-11-10T09:00:00.000Z',
      storedFiat: { currency: 'USD', amount: '3.00' },
      counterparty: { accountId: 'acc-alice', username: 'alice', name: 'Alice' },
    },
    {
      id: 'payment-handle',
      direction: 'in',
      amountSats: 1_000,
      paidAt: '2026-11-09T09:00:00.000Z',
      storedFiat: null,
      counterparty: { accountId: 'acc-bob', username: 'bob', name: '' },
    },
  ],
  next: null,
};

afterEach(() => {
  cleanup();
  vi.mocked(fetchFondPayments).mockReset();
  spot.value = null;
  vi.unstubAllGlobals();
});

describe('FondPaymentList', () => {
  it('shows the loading sentence before the first page', () => {
    vi.mocked(fetchFondPayments).mockReturnValue(new Promise(() => undefined));
    renderWithLocale(<FondPaymentList username="tondo-fond" />);
    expect(screen.getByText('Loading…')).toBeTruthy();
  });

  it('lists incoming, outgoing, private, member, amount, and time details', async () => {
    spot.value = { sats: 100_000_000, usd: '100000', chf: null, eur: null, php: null };
    vi.mocked(fetchFondPayments).mockResolvedValue(PAYMENTS);
    renderWithLocale(<FondPaymentList username="tondo-fond" />);
    expect(await screen.findByRole('region', { name: 'Payments' })).toBeTruthy();
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(within(rows[0]!).getByText('Received')).toBeTruthy();
    expect(within(rows[1]!).getByText('Sent')).toBeTruthy();
    expect(within(rows[2]!).getByText('Received')).toBeTruthy();
    expect(screen.getByText('Private')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Alice' }).getAttribute('href')).toBe(
      '/members/acc-alice',
    );
    expect(screen.getByRole('link', { name: '@bob' }).getAttribute('href')).toBe(
      '/members/acc-bob',
    );
    expect(screen.getByText(/\+₿21'000/).textContent).toContain('$21.00');
    expect(screen.getAllByText(/2026/)).toHaveLength(3);
  });

  it('never shows a fee line', async () => {
    spot.value = { sats: 100_000_000, usd: '100000', chf: '80000', eur: null, php: null };
    vi.mocked(fetchFondPayments).mockResolvedValue({
      payments: [PAYMENTS.payments[1]!],
      next: null,
    });
    renderWithLocale(<FondPaymentList username="tondo-fond" />);
    const row = await screen.findByRole('listitem');
    expect(row.textContent).toContain("−₿5'000 · $3.00");
    expect(row.textContent).not.toMatch(/Fee|Gebühr/);
  });

  it.each([
    ['1', '$1'],
    ['2.5', '$2.5'],
    ['3.00', '$3.00'],
  ] as const)(
    'shows the stored USD amount %s as %s without using the spot',
    async (amount, expected) => {
      spot.value = { sats: 100_000_000, usd: '100000', chf: null, eur: null, php: null };
      vi.mocked(fetchFondPayments).mockResolvedValue({
        payments: [
          {
            ...PAYMENTS.payments[1]!,
            id: `stored-${amount}`,
            storedFiat: { currency: 'USD', amount },
          },
        ],
        next: null,
      });
      renderWithLocale(<FondPaymentList username="tondo-fond" />);
      const row = await screen.findByRole('listitem');
      expect(row.textContent).toContain(`−₿5'000 · ${expected}`);
      expect(row.textContent).not.toContain('· $5.00');
    },
  );

  it('uses the spot for a row without stored fiat', async () => {
    spot.value = { sats: 100_000_000, usd: '100000', chf: null, eur: null, php: null };
    vi.mocked(fetchFondPayments).mockResolvedValue({
      payments: [PAYMENTS.payments[0]!],
      next: null,
    });
    renderWithLocale(<FondPaymentList username="tondo-fond" />);
    const row = await screen.findByRole('listitem');
    expect(row.textContent).toContain("+₿21'000 · $21.00");
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

  it('keeps Show more when an empty page still has a cursor', async () => {
    vi.mocked(fetchFondPayments)
      .mockResolvedValueOnce({ payments: [], next: 'cursor-2' })
      .mockResolvedValueOnce({ payments: [PAYMENTS.payments[0]!], next: null });
    renderWithLocale(<FondPaymentList username="tondo-fond" />);
    expect(await screen.findByRole('button', { name: 'Show more' })).toBeTruthy();
    expect(screen.queryByText('No payments yet.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show more' }));
    expect(await screen.findByText('Private')).toBeTruthy();
    expect(screen.queryByText('No payments yet.')).toBeNull();
    expect(fetchFondPayments).toHaveBeenLastCalledWith('tondo-fond', 'cursor-2');
  });

  it('appends the next page and removes Show more at the end', async () => {
    vi.mocked(fetchFondPayments)
      .mockResolvedValueOnce({ payments: [PAYMENTS.payments[0]!], next: 'cursor-2' })
      .mockResolvedValueOnce({ payments: [PAYMENTS.payments[1]!], next: null });
    renderWithLocale(<FondPaymentList username="tondo-fond" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Show more' }));
    expect(await screen.findByText('Alice')).toBeTruthy();
    expect(screen.getByText('Private')).toBeTruthy();
    expect(fetchFondPayments).toHaveBeenLastCalledWith('tondo-fond', 'cursor-2');
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
  });

  it('disables Show more while the next page is in flight', async () => {
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
    const button = await screen.findByRole('button', { name: 'Show more' });
    fireEvent.click(button);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Show more' }).hasAttribute('disabled')).toBe(true);
    });
    resolvePage?.({ payments: [PAYMENTS.payments[1]!], next: null });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
    });
  });

  it('fires one next-page request when Show more is clicked twice', async () => {
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
    const button = await screen.findByRole('button', { name: 'Show more' });
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
    fireEvent.click(await screen.findByRole('button', { name: 'Show more' }));
    expect(await screen.findByText('Alice')).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getAllByText('Private')).toHaveLength(1);
  });

  it('drops a pending next page after the Fond handle changes and pages the new list', async () => {
    let resolveOldPage: ((page: FondPaymentPage | null) => void) | undefined;
    vi.mocked(fetchFondPayments)
      .mockResolvedValueOnce({ payments: [PAYMENTS.payments[0]!], next: 'old-cursor' })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOldPage = resolve;
          }),
      )
      .mockResolvedValueOnce({ payments: [PAYMENTS.payments[2]!], next: 'new-cursor' })
      .mockResolvedValueOnce({ payments: [PAYMENTS.payments[1]!], next: null });
    const view = renderWithLocale(<FondPaymentList username="old-fond" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Show more' }));
    view.rerender(<FondPaymentList username="new-fond" />);
    expect(await screen.findByText('@bob')).toBeTruthy();
    await act(async () => {
      resolveOldPage?.({ payments: [PAYMENTS.payments[0]!], next: null });
      await Promise.resolve();
    });
    expect(screen.queryByText('Private')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show more' }));
    expect(await screen.findByText('Alice')).toBeTruthy();
    expect(fetchFondPayments).toHaveBeenLastCalledWith('new-fond', 'new-cursor');
  });

  it('drops a pending next-page rejection after the Fond handle changes', async () => {
    let rejectOldPage: ((reason: Error) => void) | undefined;
    vi.mocked(fetchFondPayments)
      .mockResolvedValueOnce({ payments: [PAYMENTS.payments[0]!], next: 'old-cursor' })
      .mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            rejectOldPage = reject;
          }),
      )
      .mockResolvedValueOnce({ payments: [PAYMENTS.payments[2]!], next: null });
    const view = renderWithLocale(<FondPaymentList username="old-fond" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Show more' }));
    view.rerender(<FondPaymentList username="new-fond" />);
    expect(await screen.findByText('@bob')).toBeTruthy();
    await act(async () => {
      rejectOldPage?.(new Error('503'));
      await Promise.resolve();
    });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('ignores a stale first page after the Fond handle changes', async () => {
    let resolveOldPage: ((page: FondPaymentPage | null) => void) | undefined;
    vi.mocked(fetchFondPayments)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOldPage = resolve;
          }),
      )
      .mockResolvedValueOnce({ payments: [PAYMENTS.payments[2]!], next: null });
    const view = renderWithLocale(<FondPaymentList username="old-fond" />);
    view.rerender(<FondPaymentList username="new-fond" />);
    expect(await screen.findByText('@bob')).toBeTruthy();
    await act(async () => {
      resolveOldPage?.(PAYMENTS);
      await Promise.resolve();
    });
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.queryByText('Alice')).toBeNull();
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

  it.each([
    ['amount with a leading zero', { storedFiat: { currency: 'USD', amount: '03.00' } }],
    ['amount with three decimals', { storedFiat: { currency: 'USD', amount: '3.000' } }],
    ['currency', { storedFiat: { currency: 'CHF', amount: '3.00' } }],
    ['paidAt', { paidAt: '2026-11-11 13:31' }],
  ] as const)('shows the payments error for a malformed %s body', async (_field, override) => {
    const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
    vi.mocked(fetchFondPayments).mockImplementation(actual.fetchFondPayments);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            payments: [{ ...PAYMENTS.payments[0]!, ...override }],
            next: null,
          }),
      }),
    );
    renderWithLocale(<FondPaymentList username="tondo-fond" />);
    expect(
      await screen.findByText('Could not load the Fond payments. Please try again.'),
    ).toBeTruthy();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  it('keeps the list and retries a failed next page', async () => {
    vi.mocked(fetchFondPayments)
      .mockResolvedValueOnce({ payments: [PAYMENTS.payments[0]!], next: 'cursor-2' })
      .mockRejectedValueOnce(new FondPaymentsError(503))
      .mockResolvedValueOnce({ payments: [PAYMENTS.payments[1]!], next: null });
    renderWithLocale(<FondPaymentList username="tondo-fond" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Show more' }));
    expect(
      await screen.findByText('Could not load the Fond payments. Please try again.'),
    ).toBeTruthy();
    expect(screen.getByText('Private')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Alice')).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(fetchFondPayments).toHaveBeenLastCalledWith('tondo-fond', 'cursor-2');
  });

  it('drops the list and reloads the first page after an invalid cursor', async () => {
    let resolveReload: ((page: FondPaymentPage | null) => void) | undefined;
    vi.mocked(fetchFondPayments)
      .mockResolvedValueOnce({ payments: [PAYMENTS.payments[0]!], next: 'cursor-2' })
      .mockRejectedValueOnce(new FondPaymentsError(400))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveReload = resolve;
          }),
      );
    renderWithLocale(<FondPaymentList username="tondo-fond" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Show more' }));
    expect(await screen.findByText('Loading…')).toBeTruthy();
    expect(screen.queryByText('Private')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    expect(fetchFondPayments).toHaveBeenLastCalledWith('tondo-fond');
    resolveReload?.({ payments: [PAYMENTS.payments[1]!], next: null });
    expect(await screen.findByText('Alice')).toBeTruthy();
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
    fireEvent.click(await screen.findByRole('button', { name: 'Show more' }));
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
      expect(screen.getByRole('button', { name: 'Show more' }).hasAttribute('disabled')).toBe(true);
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
    fireEvent.click(await screen.findByRole('button', { name: 'Show more' }));
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
    fireEvent.click(await screen.findByRole('button', { name: 'Show more' }));
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
    fireEvent.click(await screen.findByRole('button', { name: 'Show more' }));
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
    fireEvent.click(await screen.findByRole('button', { name: 'Show more' }));
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
    expect(within(rows[0]!).getByText('Erhalten')).toBeTruthy();
    expect(within(rows[1]!).getByText('Gesendet')).toBeTruthy();
    expect(within(rows[2]!).getByText('Erhalten')).toBeTruthy();
    expect(screen.getByText('Privat')).toBeTruthy();
    expect(screen.getByText('Mehr anzeigen')).toBeTruthy();
  });
});
