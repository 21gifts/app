import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OpenLoansScreen } from '@/app/loans/OpenLoansScreen';
import { useSpotRate } from '@/hooks/useSpotRate';
import { fetchOpenLoans, type OpenLoan } from '@/lib/open-loans';
import type { FiatRateDay } from '@/lib/stats-money';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/lib/open-loans', () => ({
  fetchOpenLoans: vi.fn(),
}));

vi.mock('@/hooks/useSpotRate', () => ({
  useSpotRate: vi.fn(),
}));

const RATE: FiatRateDay = {
  sats: 100_000_000,
  usd: '100000.00',
  chf: '80000.00',
  eur: '90000.00',
  php: '5600000.00',
};

const ada: OpenLoan = {
  messageId: 'loan-ada',
  accountId: 'acc_ada',
  name: 'Ada',
  currency: 'CHF',
  outstanding: '12.50',
  overdue: true,
};

const ben: OpenLoan = {
  messageId: 'loan-ben',
  accountId: 'acc/ben',
  name: 'Ben',
  currency: 'BTC',
  outstanding: 1500,
  overdue: false,
};

const cara: OpenLoan = {
  messageId: 'loan-cara',
  accountId: 'acc_cara',
  name: 'Cara',
  currency: 'USD',
  outstanding: '10.00',
  overdue: true,
};

beforeEach(() => {
  vi.mocked(useSpotRate).mockReturnValue(RATE);
});

afterEach(() => {
  cleanup();
  vi.mocked(fetchOpenLoans).mockReset();
  vi.mocked(useSpotRate).mockReset();
});

function overdueCell(row: HTMLElement): HTMLElement {
  const cell = [...row.querySelectorAll('td')].at(2);
  if (cell === undefined) {
    throw new Error('missing overdue cell');
  }
  return cell;
}

describe('OpenLoansScreen', () => {
  it('lists api order, loan currency, spot beside bitcoin, and an overdue mark', async () => {
    vi.mocked(fetchOpenLoans).mockResolvedValue([ada, ben, cara]);
    renderWithLocale(<OpenLoansScreen />);
    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Ben' })).toBeTruthy();
    });
    expect(screen.getByRole('heading', { name: 'Open loans' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Borrower' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Outstanding' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Overdue' })).toBeTruthy();
    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Ada',
      'Ben',
      'Cara',
    ]);
    expect(screen.getByRole('link', { name: 'Ada' }).getAttribute('href')).toBe(
      '/members/acc_ada',
    );
    expect(screen.getByRole('link', { name: 'Ben' }).getAttribute('href')).toBe(
      '/members/acc%2Fben',
    );
    expect(screen.getByText('CHF 12.50')).toBeTruthy();
    expect(screen.getByText('$10.00')).toBeTruthy();
    expect(screen.getByText("₿1'500 · $1.50")).toBeTruthy();

    const adaRow = screen.getByRole('link', { name: 'Ada' }).closest('tr');
    const benRow = screen.getByRole('link', { name: 'Ben' }).closest('tr');
    if (adaRow === null || benRow === null) {
      throw new Error('missing loan row');
    }
    expect(adaRow.className).toContain('bg-app-danger/10');
    expect(adaRow.getAttribute('data-overdue')).toBe('true');
    expect(overdueCell(adaRow).textContent).toBe('Yes');
    expect(overdueCell(adaRow).className).toContain('text-app-danger');
    expect(benRow.className).not.toContain('bg-app-danger');
    expect(benRow.getAttribute('data-overdue')).toBe('false');
    expect(overdueCell(benRow).textContent).toBe('No');
    expect(overdueCell(benRow).className).not.toContain('text-app-danger');
  });

  it('keeps a fiat loan in its currency and prices bitcoin in the visitor fiat', async () => {
    vi.mocked(fetchOpenLoans).mockResolvedValue([ada, ben]);
    renderWithLocale(<OpenLoansScreen />, 'en', 'ch', 'CHF');
    await waitFor(() => {
      expect(screen.getByText("₿1'500 · CHF 1.20")).toBeTruthy();
    });
    expect(screen.getByText('CHF 12.50')).toBeTruthy();
    expect(screen.queryByText(/\$/)).toBeNull();
  });

  it('shows bitcoin alone when the spot rate is missing', async () => {
    vi.mocked(useSpotRate).mockReturnValue(null);
    vi.mocked(fetchOpenLoans).mockResolvedValue([ada, ben]);
    renderWithLocale(<OpenLoansScreen />);
    await waitFor(() => {
      expect(screen.getByText("₿1'500")).toBeTruthy();
    });
    expect(screen.queryByText(/\$/)).toBeNull();
    expect(screen.getByText('CHF 12.50')).toBeTruthy();
  });

  it('shows the empty state when the api returns no loans', async () => {
    vi.mocked(fetchOpenLoans).mockResolvedValue([]);
    renderWithLocale(<OpenLoansScreen />);
    await waitFor(() => {
      expect(screen.getByText('No open loans.')).toBeTruthy();
    });
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('shows the loading sentence while the list is still in flight', () => {
    vi.mocked(fetchOpenLoans).mockImplementation(() => new Promise<OpenLoan[]>(() => undefined));
    renderWithLocale(<OpenLoansScreen />);
    expect(screen.getByRole('heading', { name: 'Open loans' })).toBeTruthy();
    expect(screen.getByText('Loading open loans…')).toBeTruthy();
  });

  it('shows the error and loads again from Try again', async () => {
    vi.mocked(fetchOpenLoans)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce([ada]);
    renderWithLocale(<OpenLoansScreen />);
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe(
        'Could not load open loans. Please try again.',
      );
    });
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Ada' })).toBeTruthy();
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('drops a list that arrives after the screen is gone', async () => {
    let resolveLoans: (rows: OpenLoan[]) => void = () => undefined;
    vi.mocked(fetchOpenLoans).mockImplementation(
      () =>
        new Promise<OpenLoan[]>((resolve) => {
          resolveLoans = resolve;
        }),
    );
    const view = renderWithLocale(<OpenLoansScreen />);
    expect(screen.getByText('Loading open loans…')).toBeTruthy();
    view.unmount();
    await act(async () => {
      resolveLoans([ben]);
    });
  });

  it('drops a failure that arrives after the screen is gone', async () => {
    let rejectLoans: (error: Error) => void = () => undefined;
    vi.mocked(fetchOpenLoans).mockImplementation(
      () =>
        new Promise<OpenLoan[]>((_resolve, reject) => {
          rejectLoans = reject;
        }),
    );
    const view = renderWithLocale(<OpenLoansScreen />);
    view.unmount();
    await act(async () => {
      rejectLoans(new Error('late'));
    });
  });
});
