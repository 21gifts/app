import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GrantGoalsScreen } from '@/components/GrantGoalsScreen';
import type { Account, GrantContinuation } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/lib/api', () => ({
  fetchGrantContinuation: vi.fn(),
}));

import { fetchGrantContinuation } from '@/lib/api';

const fetchMock = vi.mocked(fetchGrantContinuation);

const account: Account = {
  id: 'acc_1',
  linkingKey: '02abcdef',
  role: 'basis',
  name: 'Ada',
  location: null,
  lightningAddress: null,
  lightningAddressVerified: false,
  forumLawsDismissed: false,
  createdAt: 1_700_000_000,
  rulesAgreedAt: 1_700_000_001,
  viewKey: 'a'.repeat(64),
  aboutMe: null,
  aboutMeHasPhoto: false,
  setup: null,
  missing: [],
};

function goal(qualifyingShops: number): GrantContinuation {
  const start = Date.parse('2026-03-09T00:00:00.000Z');
  return {
    qualifyingShops,
    days: Array.from({ length: 7 }, (_, i) => ({
      day: new Date(start + i * 86_400_000).toISOString().slice(0, 10),
      shopCount: i === 6 ? 1 : 0,
    })),
  };
}

afterEach(cleanup);

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(goal(0));
});

describe('GrantGoalsScreen', () => {
  it('renders nothing without a session and does not fetch', () => {
    useAuthStore.setState({ session: null, account });
    const { container } = renderWithLocale(<GrantGoalsScreen />);
    expect(container.firstChild).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('explains the ten-shop continuation goal and the transaction', async () => {
    useAuthStore.setState({ session: 'sess', account });
    renderWithLocale(<GrantGoalsScreen />);
    expect(screen.getByRole('heading', { name: 'Goals' })).toBeTruthy();
    expect(
      screen.getByText('The grant program continues when we reach 10 active shops.'),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'A shop is active when it has at least one transaction on 5 of the last 7 days.',
      ),
    ).toBeTruthy();
    expect(screen.getByText(/https:\/\/21\.gifts\/pos/)).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByText('0 shops meet this')).toBeTruthy();
    });
    expect(fetchMock).toHaveBeenCalledWith('sess');
  });

  it('shows how many shops meet the last seven days', async () => {
    fetchMock.mockResolvedValue(goal(2));
    useAuthStore.setState({ session: 'sess', account });
    renderWithLocale(<GrantGoalsScreen />);
    await waitFor(() => {
      expect(screen.getByText('2 shops meet this')).toBeTruthy();
    });
    expect(screen.getByRole('img', { name: 'Shops per UTC day' })).toBeTruthy();
    expect(screen.getByText('Lighter bar = today, still open.')).toBeTruthy();
  });

  it('shows an error and retries', async () => {
    fetchMock.mockRejectedValue(new Error('down'));
    useAuthStore.setState({ session: 'sess', account });
    renderWithLocale(<GrantGoalsScreen />);
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe(
        'Could not load the shop goal. Please try again.',
      );
    });
    fetchMock.mockResolvedValue(goal(1));
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(screen.getByText('1 shop meets this')).toBeTruthy();
    });
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('ignores a result that arrives after the screen unmounts', async () => {
    let resolveGoal: (value: GrantContinuation) => void = () => undefined;
    fetchMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveGoal = resolve;
        }),
    );
    useAuthStore.setState({ session: 'sess', account });
    const view = renderWithLocale(<GrantGoalsScreen />);
    view.unmount();
    await act(async () => {
      resolveGoal(goal(1));
    });
    expect(fetchMock).toHaveBeenCalledWith('sess');
  });

  it('ignores a failure that arrives after the screen unmounts', async () => {
    let rejectGoal: (error: Error) => void = () => undefined;
    fetchMock.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectGoal = reject;
        }),
    );
    useAuthStore.setState({ session: 'sess', account });
    const view = renderWithLocale(<GrantGoalsScreen />);
    view.unmount();
    await act(async () => {
      rejectGoal(new Error('down'));
    });
    expect(fetchMock).toHaveBeenCalledWith('sess');
  });
});
