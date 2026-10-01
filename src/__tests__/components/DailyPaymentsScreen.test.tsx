import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DailyPaymentsScreen } from '@/components/DailyPaymentsScreen';
import type { Account, DailyRoster } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/lib/api', () => ({
  fetchDailyRoster: vi.fn(),
  saveDailyRosterComment: vi.fn(),
  saveDailyRosterPayments: vi.fn(),
  addDailyRosterRecipient: vi.fn(),
  updateDailyRosterRecipient: vi.fn(),
  deleteDailyRosterRecipient: vi.fn(),
}));

import {
  addDailyRosterRecipient,
  deleteDailyRosterRecipient,
  fetchDailyRoster,
  saveDailyRosterComment,
  saveDailyRosterPayments,
  updateDailyRosterRecipient,
} from '@/lib/api';

const fetchMock = vi.mocked(fetchDailyRoster);
const commentMock = vi.mocked(saveDailyRosterComment);
const paymentsMock = vi.mocked(saveDailyRosterPayments);
const addMock = vi.mocked(addDailyRosterRecipient);
const updateMock = vi.mocked(updateDailyRosterRecipient);
const deleteMock = vi.mocked(deleteDailyRosterRecipient);

const account: Account = {
  id: 'acc_1',
  linkingKey: '02abcdef',
  role: 'founder',
  name: 'Ada',
  location: null,
  lightningAddress: 'alice@walletofsatoshi.com',
  lightningAddressVerified: false,
  forumLawsDismissed: false,
  createdAt: 1_700_000_000,
  rulesAgreedAt: 1_700_000_001,
  viewKey: 'a'.repeat(64),
  aboutMe: null,
  aboutMeHasPhoto: false,
  setup: null,
  missing: [],
  funding: {
    status: 'none',
    trialUtcDate: null,
    admittedAt: null,
    reviewedByName: null,
  },
};

const ROSTER: DailyRoster = {
  comment: 'Daily gift',
  paymentsEnabled: true,
  recipients: [
    { address: 'Ada@WalletOfSatoshi.com', amountUsd: 1 },
    { address: 'bob@example.com', amountUsd: 0.1 },
    { address: 'nolocal', amountUsd: 0.2 },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockResolvedValue(ROSTER);
  commentMock.mockResolvedValue(ROSTER);
  paymentsMock.mockResolvedValue({ ...ROSTER, paymentsEnabled: false });
  addMock.mockResolvedValue(ROSTER);
  updateMock.mockResolvedValue(ROSTER);
  deleteMock.mockResolvedValue(ROSTER);
  useAuthStore.setState({ session: 'sess', account });
});

afterEach(cleanup);

async function renderLoaded(): Promise<void> {
  renderWithLocale(<DailyPaymentsScreen />);
  expect(await screen.findByRole('button', { name: 'Save' })).toBeTruthy();
}

/** A save disables every control until the mocked request resolves. */
async function settleSave(): Promise<void> {
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Save' }).hasAttribute('disabled')).toBe(false);
  });
}

describe('DailyPaymentsScreen', () => {
  it('renders nothing without a session and does not fetch', () => {
    useAuthStore.setState({ session: null, account });
    const { container } = renderWithLocale(<DailyPaymentsScreen />);
    expect(container.firstChild).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows the refusal when the account snapshot is missing', () => {
    useAuthStore.setState({ session: 'sess', account: null });
    renderWithLocale(<DailyPaymentsScreen />);
    expect(screen.getByText('You cannot change daily payments.')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows the refusal and does not fetch for a moderator', () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'moderator' } });
    renderWithLocale(<DailyPaymentsScreen />);
    expect(screen.getByRole('heading', { name: 'Daily payments' })).toBeTruthy();
    expect(screen.getByText('You cannot change daily payments.')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows loading copy while the roster is in flight', () => {
    fetchMock.mockImplementation(() => new Promise(() => undefined));
    renderWithLocale(<DailyPaymentsScreen />);
    expect(screen.getByText('Loading…')).toBeTruthy();
  });

  it('shows an error and retries', async () => {
    fetchMock.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(ROSTER);
    renderWithLocale(<DailyPaymentsScreen />);
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Could not load daily payments. Please try again.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('button', { name: 'Save' })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('shows the catalog refusal when fetch is Forbidden', async () => {
    fetchMock.mockRejectedValueOnce(new Error('funding.daily.forbidden'));
    renderWithLocale(<DailyPaymentsScreen />);
    expect(await screen.findByText('You cannot change daily payments.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
  });

  it('ignores a stale resolve after unmount', async () => {
    let resolveList: ((value: DailyRoster) => void) | undefined;
    fetchMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveList = resolve;
        }),
    );
    const view = renderWithLocale(<DailyPaymentsScreen />);
    view.unmount();
    await act(async () => {
      resolveList?.(ROSTER);
      await Promise.resolve();
    });
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
  });

  it('ignores a stale reject after unmount', async () => {
    let rejectList: ((reason: Error) => void) | undefined;
    fetchMock.mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectList = reject;
        }),
    );
    const view = renderWithLocale(<DailyPaymentsScreen />);
    view.unmount();
    await act(async () => {
      rejectList?.(new Error('boom'));
      await Promise.resolve();
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows the comment, truncated addresses, and the total', async () => {
    await renderLoaded();
    expect(screen.getByRole('textbox', { name: 'Comment' })).toHaveProperty('value', 'Daily gift');
    expect(screen.getByText('Ada@w...')).toBeTruthy();
    expect(screen.getByText('bob@example.com')).toBeTruthy();
    expect(screen.getByText('nolocal')).toBeTruthy();
    expect(screen.getByText('$1.30')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'On' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByText('Update')).toBeNull();
    expect(screen.queryByText('Delete')).toBeNull();
    expect(screen.getByRole('button', { name: 'Update Ada@w...' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete Ada@w...' })).toBeTruthy();
  });

  it('renders lookalike Wallet of Satoshi domains in full', async () => {
    fetchMock.mockResolvedValueOnce({
      comment: 'Daily gift',
      paymentsEnabled: true,
      recipients: [
        { address: 'ada@notwalletofsatoshi.com', amountUsd: 1 },
        { address: 'ada@walletofsatoshi.com.evil', amountUsd: 2 },
      ],
    });
    await renderLoaded();
    expect(screen.getByText('ada@notwalletofsatoshi.com')).toBeTruthy();
    expect(screen.getByText('ada@walletofsatoshi.com.evil')).toBeTruthy();
    expect(screen.queryByText('ada@w...')).toBeNull();
  });

  it('saves the comment and shows a mapped, unknown, or non-error failure', async () => {
    await renderLoaded();
    fireEvent.change(screen.getByRole('textbox', { name: 'Comment' }), {
      target: { value: 'Hello' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByDisplayValue('Daily gift')).toBeTruthy();
    expect(commentMock).toHaveBeenCalledWith('sess', 'Hello');

    commentMock.mockRejectedValueOnce(new Error('funding.daily.duplicate'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'That address is already listed.',
    );

    commentMock.mockRejectedValueOnce(new Error('boom'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Could not save. Please try again.',
    );

    commentMock.mockRejectedValueOnce('nope');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Could not save. Please try again.',
    );
  });

  it('turns payments off and on', async () => {
    await renderLoaded();
    fireEvent.click(screen.getByRole('button', { name: 'On' }));
    expect(paymentsMock).toHaveBeenCalledWith('sess', true);
    await settleSave();
    fireEvent.click(screen.getByRole('button', { name: 'Off' }));
    expect(paymentsMock).toHaveBeenCalledWith('sess', false);
    expect((await screen.findByRole('button', { name: 'Off' })).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('refuses a bad amount and adds a recipient', async () => {
    fetchMock.mockResolvedValue({ ...ROSTER, recipients: [] });
    await renderLoaded();
    expect(screen.getByText('No recipients')).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: 'Address' }), {
      target: { value: 'new@example.com' },
    });
    const usd = screen.getByRole('textbox', { name: 'USD' });
    fireEvent.change(usd, { target: { value: 'abc' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(addMock).not.toHaveBeenCalled();
    fireEvent.change(usd, { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.change(usd, { target: { value: '0.0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByRole('alert').textContent).toBe('The address or the amount is not valid.');
    fireEvent.change(usd, { target: { value: ' 1.5 ' } });
    addMock.mockResolvedValueOnce({
      ...ROSTER,
      recipients: [{ address: 'new@example.com', amountUsd: 1.5 }],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(addMock).toHaveBeenCalledWith('sess', 'new@example.com', 1.5);
    expect(await screen.findByRole('textbox', { name: 'Address' })).toHaveProperty('value', '');
  });

  it('updates and deletes a recipient', async () => {
    await renderLoaded();
    const amount = screen.getByRole('textbox', { name: 'USD Ada@w...' });
    fireEvent.change(amount, { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update Ada@w...' }));
    expect(updateMock).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toBe('The address or the amount is not valid.');
    fireEvent.change(amount, { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update Ada@w...' }));
    expect(updateMock).toHaveBeenCalledWith('sess', 'Ada@WalletOfSatoshi.com', 2);
    await settleSave();
    fireEvent.click(screen.getByRole('button', { name: 'Delete bob@example.com' }));
    expect(deleteMock).toHaveBeenCalledWith('sess', 'bob@example.com');
  });

  it('disables the editor while a save is in flight', async () => {
    await renderLoaded();
    let resolveSave: (value: DailyRoster) => void = () => undefined;
    commentMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSave = resolve;
        }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('button', { name: 'Save' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Add' }).hasAttribute('disabled')).toBe(true);
    await act(async () => {
      resolveSave(ROSTER);
      await Promise.resolve();
    });
    expect(screen.getByRole('button', { name: 'Save' }).hasAttribute('disabled')).toBe(false);
  });
});
