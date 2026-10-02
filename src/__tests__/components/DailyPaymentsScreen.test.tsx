import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DailyPaymentAmountsScreen,
  DailyPaymentCommentScreen,
} from '@/components/DailyPaymentsScreen';
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
  defaultAmountUsd: 4,
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

async function renderComment(): Promise<void> {
  renderWithLocale(<DailyPaymentCommentScreen />);
  expect(await screen.findByRole('button', { name: 'Edit comment' })).toBeTruthy();
}

async function renderAmounts(): Promise<void> {
  renderWithLocale(<DailyPaymentAmountsScreen />);
  expect(await screen.findByRole('button', { name: 'Edit Ada@w...' })).toBeTruthy();
}

/** A save disables every control until the mocked request resolves. */
async function settleAmounts(): Promise<void> {
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Edit Ada@w...' }).hasAttribute('disabled')).toBe(
      false,
    );
  });
}

const pages = [
  {
    Screen: DailyPaymentCommentScreen,
    heading: 'Daily payment text',
    ready: 'Edit comment',
  },
  {
    Screen: DailyPaymentAmountsScreen,
    heading: 'Daily payment amounts',
    ready: 'Edit Ada@w...',
  },
] as const;

describe('daily payment subpages', () => {
  it.each(pages)('renders nothing without a session and does not fetch', ({ Screen }) => {
    useAuthStore.setState({ session: null, account });
    const { container } = renderWithLocale(<Screen />);
    expect(container.firstChild).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(pages)('shows the refusal when the account snapshot is missing', ({ Screen }) => {
    useAuthStore.setState({ session: 'sess', account: null });
    renderWithLocale(<Screen />);
    expect(screen.getByText('You cannot change daily payments.')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(pages)('shows the refusal and does not fetch for a moderator', ({ Screen, heading }) => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'moderator' } });
    renderWithLocale(<Screen />);
    expect(screen.getByRole('heading', { name: heading })).toBeTruthy();
    expect(screen.getByText('You cannot change daily payments.')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(pages)('shows loading copy while the roster is in flight', ({ Screen }) => {
    fetchMock.mockImplementation(() => new Promise(() => undefined));
    renderWithLocale(<Screen />);
    expect(screen.getByText('Loading…')).toBeTruthy();
  });

  it.each(pages)('shows an error and retries', async ({ Screen, ready }) => {
    fetchMock.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(ROSTER);
    renderWithLocale(<Screen />);
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Could not load daily payments. Please try again.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('button', { name: ready })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each(pages)('shows the catalog refusal when fetch is Forbidden', async ({ Screen, ready }) => {
    fetchMock.mockRejectedValueOnce(new Error('funding.daily.forbidden'));
    renderWithLocale(<Screen />);
    expect(await screen.findByText('You cannot change daily payments.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    expect(screen.queryByRole('button', { name: ready })).toBeNull();
  });

  it.each(pages)('ignores a stale resolve after unmount', async ({ Screen, ready }) => {
    let resolveList: ((value: DailyRoster) => void) | undefined;
    fetchMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveList = resolve;
        }),
    );
    const view = renderWithLocale(<Screen />);
    view.unmount();
    await act(async () => {
      resolveList?.(ROSTER);
      await Promise.resolve();
    });
    expect(screen.queryByRole('button', { name: ready })).toBeNull();
  });

  it.each(pages)('ignores a stale reject after unmount', async ({ Screen }) => {
    let rejectList: ((reason: Error) => void) | undefined;
    fetchMock.mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectList = reject;
        }),
    );
    const view = renderWithLocale(<Screen />);
    view.unmount();
    await act(async () => {
      rejectList?.(new Error('boom'));
      await Promise.resolve();
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows the comment without the amounts', async () => {
    await renderComment();
    expect(screen.getByRole('heading', { name: 'Daily payment text' })).toBeTruthy();
    expect(screen.getByText('Daily gift')).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: 'Comment' })).toBeNull();
    expect(screen.queryByText('Ada@w...')).toBeNull();
    expect(screen.queryByRole('button', { name: 'On' })).toBeNull();
    expect(screen.queryByText('Save')).toBeNull();
    expect(screen.getByRole('button', { name: 'Edit comment' })).toBeTruthy();
  });

  it('shows the amounts without the comment', async () => {
    await renderAmounts();
    expect(screen.getByRole('heading', { name: 'Daily payment amounts' })).toBeTruthy();
    expect(screen.queryByText('Daily gift')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit comment' })).toBeNull();
    expect(screen.getByText('$1.00')).toBeTruthy();
    expect(screen.getByText('Ada@w...')).toBeTruthy();
    expect(screen.getByText('bob@example.com')).toBeTruthy();
    expect(screen.getByText('nolocal')).toBeTruthy();
    expect(screen.getByText('$1.30')).toBeTruthy();
    expect(
      screen.getByText(
        'Everyone in the grant program receives $4.00 by default. This page is only for entering a different amount by hand for someone who is eligible, and someone who should receive the default does not need to be on this list.',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'On' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByText('Save')).toBeNull();
    expect(screen.queryByText('Update')).toBeNull();
    expect(screen.queryByText('Delete')).toBeNull();
    expect(screen.getByRole('button', { name: 'Edit Ada@w...' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete Ada@w...' })).toBeTruthy();
  });

  it('renders lookalike Wallet of Satoshi domains in full', async () => {
    fetchMock.mockResolvedValueOnce({
      comment: 'Daily gift',
      paymentsEnabled: true,
      defaultAmountUsd: 4,
      recipients: [
        { address: 'ada@notwalletofsatoshi.com', amountUsd: 1 },
        { address: 'ada@walletofsatoshi.com.evil', amountUsd: 2 },
      ],
    });
    renderWithLocale(<DailyPaymentAmountsScreen />);
    expect(await screen.findByText('ada@notwalletofsatoshi.com')).toBeTruthy();
    expect(screen.getByText('ada@walletofsatoshi.com.evil')).toBeTruthy();
    expect(screen.queryByText('ada@w...')).toBeNull();
    expect(screen.getByRole('button', { name: 'Edit ada@notwalletofsatoshi.com' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit ada@walletofsatoshi.com.evil' })).toBeTruthy();
  });

  it('saves the comment and shows a mapped, unknown, or non-error failure', async () => {
    await renderComment();
    fireEvent.click(screen.getByRole('button', { name: 'Edit comment' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Comment' }), {
      target: { value: 'Hello' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Daily gift')).toBeTruthy();
    expect(commentMock).toHaveBeenCalledWith('sess', 'Hello');
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Edit comment' }));
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
    await renderAmounts();
    fireEvent.click(screen.getByRole('button', { name: 'On' }));
    expect(paymentsMock).toHaveBeenCalledWith('sess', true);
    await settleAmounts();
    fireEvent.click(screen.getByRole('button', { name: 'Off' }));
    expect(paymentsMock).toHaveBeenCalledWith('sess', false);
    expect((await screen.findByRole('button', { name: 'Off' })).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('refuses a bad amount and adds a recipient', async () => {
    fetchMock.mockResolvedValue({ ...ROSTER, recipients: [] });
    renderWithLocale(<DailyPaymentAmountsScreen />);
    expect(await screen.findByText('No recipients')).toBeTruthy();
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

  it('keeps an open amount editor open when a recipient is added', async () => {
    await renderAmounts();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Ada@w...' }));
    const amount = screen.getByRole('textbox', { name: 'USD Ada@w...' });
    fireEvent.change(amount, { target: { value: '4.25' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Address' }), {
      target: { value: 'new@example.com' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'USD', exact: true }), {
      target: { value: '1' },
    });
    addMock.mockResolvedValueOnce({
      ...ROSTER,
      recipients: [...ROSTER.recipients, { address: 'new@example.com', amountUsd: 1 }],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(addMock).toHaveBeenCalledWith('sess', 'new@example.com', 1);
    expect(await screen.findByRole('textbox', { name: 'USD Ada@w...' })).toHaveProperty(
      'value',
      '4.25',
    );
  });

  it('updates and deletes a recipient', async () => {
    await renderAmounts();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Ada@w...' }));
    const amount = screen.getByRole('textbox', { name: 'USD Ada@w...' });
    fireEvent.change(amount, { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(updateMock).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toBe('The address or the amount is not valid.');
    fireEvent.change(amount, { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(updateMock).toHaveBeenCalledWith('sess', 'Ada@WalletOfSatoshi.com', 2);
    await settleAmounts();
    fireEvent.click(screen.getByRole('button', { name: 'Delete bob@example.com' }));
    expect(deleteMock).toHaveBeenCalledWith('sess', 'bob@example.com');
  });

  it('disables the editor while a save is in flight', async () => {
    await renderComment();
    let resolveSave: (value: DailyRoster) => void = () => undefined;
    commentMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSave = resolve;
        }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit comment' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('button', { name: 'Save' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Cancel' }).hasAttribute('disabled')).toBe(true);
    expect(screen.queryByRole('button', { name: 'Add' })).toBeNull();
    await act(async () => {
      resolveSave(ROSTER);
      await Promise.resolve();
    });
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Edit comment' }).hasAttribute('disabled')).toBe(
      false,
    );
  });

  it('disables Add while an amount save is in flight', async () => {
    await renderAmounts();
    let resolveSave: (value: DailyRoster) => void = () => undefined;
    updateMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSave = resolve;
        }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit Ada@w...' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('button', { name: 'Add' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Save' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'On' }).hasAttribute('disabled')).toBe(true);
    await act(async () => {
      resolveSave(ROSTER);
      await Promise.resolve();
    });
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Add' }).hasAttribute('disabled')).toBe(false);
  });

  it('cancels an amount edit without saving', async () => {
    await renderAmounts();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Ada@w...' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'USD Ada@w...' }), {
      target: { value: '9' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(updateMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox', { name: 'USD Ada@w...' })).toBeNull();
    expect(screen.getByText('$1.00')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit Ada@w...' })).toBeTruthy();
  });

  it('cancels a comment edit without saving', async () => {
    await renderComment();
    fireEvent.click(screen.getByRole('button', { name: 'Edit comment' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Comment' }), {
      target: { value: 'Hello' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(commentMock).not.toHaveBeenCalled();
    expect(screen.getByText('Daily gift')).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: 'Comment' })).toBeNull();
  });

  it('shows an empty comment in muted type', async () => {
    fetchMock.mockResolvedValueOnce({ ...ROSTER, comment: '   ' });
    renderWithLocale(<DailyPaymentCommentScreen />);
    const empty = await screen.findByText('Not set');
    expect(empty.className).toContain('text-app-muted');
    expect(screen.queryByText('Daily gift')).toBeNull();
    expect(screen.getByRole('button', { name: 'Edit comment' })).toBeTruthy();
  });

  it('shows the load error when fetch rejects with a non-error', async () => {
    fetchMock.mockRejectedValueOnce('boom');
    renderWithLocale(<DailyPaymentCommentScreen />);
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Could not load daily payments. Please try again.',
    );
    expect(screen.queryByText('You cannot change daily payments.')).toBeNull();
  });
});
