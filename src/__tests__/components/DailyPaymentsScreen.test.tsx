import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DailyPaymentAmountsScreen,
  DailyPaymentCommentScreen,
  DailyPaymentModeratorsScreen,
} from '@/components/DailyPaymentsScreen';
import type { Account, DailyRoster } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('@/lib/api', () => ({
  fetchDailyRoster: vi.fn(),
  saveDailyRosterComment: vi.fn(),
  saveDailyRosterPayments: vi.fn(),
  addDailyRosterRecipient: vi.fn(),
  updateDailyRosterRecipient: vi.fn(),
  deleteDailyRosterRecipient: vi.fn(),
  saveDailyRosterModeratorPayments: vi.fn(),
  addDailyRosterModerator: vi.fn(),
  updateDailyRosterModerator: vi.fn(),
  deleteDailyRosterModerator: vi.fn(),
}));

vi.mock('@/lib/mention-search', () => ({
  searchMentionAccounts: vi.fn(),
}));

import {
  addDailyRosterModerator,
  addDailyRosterRecipient,
  deleteDailyRosterModerator,
  deleteDailyRosterRecipient,
  fetchDailyRoster,
  saveDailyRosterComment,
  saveDailyRosterModeratorPayments,
  saveDailyRosterPayments,
  updateDailyRosterModerator,
  updateDailyRosterRecipient,
} from '@/lib/api';
import { searchMentionAccounts } from '@/lib/mention-search';

const fetchMock = vi.mocked(fetchDailyRoster);
const commentMock = vi.mocked(saveDailyRosterComment);
const paymentsMock = vi.mocked(saveDailyRosterPayments);
const addMock = vi.mocked(addDailyRosterRecipient);
const updateMock = vi.mocked(updateDailyRosterRecipient);
const deleteMock = vi.mocked(deleteDailyRosterRecipient);
const modPaymentsMock = vi.mocked(saveDailyRosterModeratorPayments);
const modAddMock = vi.mocked(addDailyRosterModerator);
const modUpdateMock = vi.mocked(updateDailyRosterModerator);
const modDeleteMock = vi.mocked(deleteDailyRosterModerator);
const searchMock = vi.mocked(searchMentionAccounts);

type PersonHit = { id: string; username: string; name: string };

const ADA_PERSON: PersonHit = { id: 'acc_ada', username: 'ada', name: 'Ada' };

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
    { address: 'ada@walletofsatoshi.com', amountUsd: 1, accountId: 'acc_ada', name: 'Ada' },
    { address: 'bob@example.com', amountUsd: 0.3, accountId: null, name: null },
  ],
  moderatorPaymentsEnabled: true,
  moderators: [
    { address: 'ada@walletofsatoshi.com', amountUsd: 1, accountId: 'acc_ada', name: 'Ada' },
    { address: 'bob@example.com', amountUsd: 0.3, accountId: null, name: null },
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
  modPaymentsMock.mockResolvedValue({ ...ROSTER, moderatorPaymentsEnabled: false });
  modAddMock.mockResolvedValue(ROSTER);
  modUpdateMock.mockResolvedValue(ROSTER);
  modDeleteMock.mockResolvedValue(ROSTER);
  searchMock.mockResolvedValue([ADA_PERSON]);
  useAuthStore.setState({ session: 'sess', account });
});

afterEach(cleanup);

async function renderComment(): Promise<void> {
  renderWithLocale(<DailyPaymentCommentScreen />);
  expect(await screen.findByRole('button', { name: 'Edit comment' })).toBeTruthy();
}

async function renderAmounts(): Promise<void> {
  renderWithLocale(<DailyPaymentAmountsScreen />);
  expect(await screen.findByRole('button', { name: 'Edit Ada' })).toBeTruthy();
}

async function renderModerators(): Promise<void> {
  renderWithLocale(<DailyPaymentModeratorsScreen />);
  expect(await screen.findByRole('button', { name: 'Edit Ada' })).toBeTruthy();
}

/** A save disables every control until the mocked request resolves. */
async function settleAmounts(): Promise<void> {
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Edit Ada' }).hasAttribute('disabled')).toBe(false);
  });
}

async function settleModerators(): Promise<void> {
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Edit Ada' }).hasAttribute('disabled')).toBe(false);
  });
}

async function pickPerson(query = '@ada', optionName = '@ada'): Promise<void> {
  fireEvent.change(screen.getByRole('textbox', { name: 'Person' }), {
    target: { value: query },
  });
  fireEvent.click(await screen.findByRole('option', { name: optionName }));
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
    ready: 'Edit Ada',
  },
  {
    Screen: DailyPaymentModeratorsScreen,
    heading: 'Moderator payments',
    ready: 'Edit Ada',
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
    expect(screen.queryByText('Comment')).toBeNull();
    expect(screen.queryByText('Edit comment')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Ada' })).toBeNull();
    expect(screen.queryByText('Unnamed')).toBeNull();
    expect(screen.queryByText('ada@w...')).toBeNull();
    expect(screen.queryByText('ada@walletofsatoshi.com')).toBeNull();
    expect(screen.queryByText('bob@example.com')).toBeNull();
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
    expect(screen.getByRole('link', { name: 'Ada' }).getAttribute('href')).toBe('/members/acc_ada');
    expect(screen.getByText('Unnamed')).toBeTruthy();
    expect(screen.queryByText('ada@w...')).toBeNull();
    expect(screen.queryByText('ada@walletofsatoshi.com')).toBeNull();
    expect(screen.queryByText('bob@example.com')).toBeNull();
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
    expect(screen.queryByText('Edit Ada')).toBeNull();
    expect(screen.getByRole('button', { name: 'Edit Ada' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete Ada' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit Unnamed' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete Unnamed' })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Person' })).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: 'Address' })).toBeNull();
    expect(searchMock).not.toHaveBeenCalled();
  });

  it('does not render a Lightning address, including a non-Wallet of Satoshi address', async () => {
    fetchMock.mockResolvedValueOnce({
      comment: 'Daily gift',
      paymentsEnabled: true,
      moderatorPaymentsEnabled: true,
      defaultAmountUsd: 4,
      moderators: [],
      recipients: [
        {
          address: 'ada@notwalletofsatoshi.com',
          amountUsd: 1,
          accountId: 'acc_ada',
          name: 'Ada',
        },
        {
          address: 'ada@walletofsatoshi.com.evil',
          amountUsd: 2,
          accountId: null,
          name: null,
        },
      ],
    });
    renderWithLocale(<DailyPaymentAmountsScreen />);
    expect(await screen.findByRole('link', { name: 'Ada' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ada' }).getAttribute('href')).toBe('/members/acc_ada');
    expect(screen.getByText('Unnamed')).toBeTruthy();
    expect(screen.queryByText('ada@notwalletofsatoshi.com')).toBeNull();
    expect(screen.queryByText('ada@walletofsatoshi.com.evil')).toBeNull();
    expect(screen.queryByText('ada@w...')).toBeNull();
    expect(screen.queryByText('ada@walletofsatoshi.com')).toBeNull();
    expect(screen.getByRole('button', { name: 'Edit Ada' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit Unnamed' })).toBeTruthy();
  });

  it('saves the comment and shows a mapped, unknown, or non-error failure', async () => {
    await renderComment();
    fireEvent.click(screen.getByRole('button', { name: 'Edit comment' }));
    expect(screen.queryByText('Save')).toBeNull();
    expect(screen.queryByText('Cancel')).toBeNull();
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
      'That person is already listed.',
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
    await pickPerson();
    const usd = screen.getByRole('textbox', { name: 'USD' });
    fireEvent.change(usd, { target: { value: 'abc' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(addMock).not.toHaveBeenCalled();
    fireEvent.change(usd, { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.change(usd, { target: { value: '0.0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByRole('alert').textContent).toBe('The amount is not valid.');
    fireEvent.change(usd, { target: { value: ' 1.5 ' } });
    addMock.mockResolvedValueOnce({
      ...ROSTER,
      recipients: [
        { address: 'ada@example.com', amountUsd: 1.5, accountId: 'acc_ada', name: 'Ada' },
      ],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(addMock).toHaveBeenCalledWith('sess', 'acc_ada', 1.5);
    expect(await screen.findByRole('textbox', { name: 'Person' })).toHaveProperty('value', '');
  });

  it('refuses add with a valid amount and no selected person', async () => {
    fetchMock.mockResolvedValue({ ...ROSTER, recipients: [] });
    renderWithLocale(<DailyPaymentAmountsScreen />);
    expect(await screen.findByText('No recipients')).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: 'USD' }), {
      target: { value: '1.5' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(addMock).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toBe('Choose a person.');
  });

  it('keeps an open amount editor open when a recipient is added', async () => {
    await renderAmounts();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Ada' }));
    const amount = screen.getByRole('textbox', { name: 'USD Ada' });
    fireEvent.change(amount, { target: { value: '4.25' } });
    await pickPerson();
    fireEvent.change(screen.getByRole('textbox', { name: /^USD$/ }), {
      target: { value: '1' },
    });
    addMock.mockResolvedValueOnce({
      ...ROSTER,
      recipients: [
        ...ROSTER.recipients,
        { address: 'ada@example.com', amountUsd: 1, accountId: 'acc_ada', name: 'Ada' },
      ],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(addMock).toHaveBeenCalledWith('sess', 'acc_ada', 1);
    expect(await screen.findByRole('textbox', { name: 'USD Ada' })).toHaveProperty('value', '4.25');
  });

  it('updates and deletes a recipient', async () => {
    await renderAmounts();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Ada' }));
    expect(screen.queryByText('Save')).toBeNull();
    expect(screen.queryByText('Cancel')).toBeNull();
    const amount = screen.getByRole('textbox', { name: 'USD Ada' });
    fireEvent.change(amount, { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(updateMock).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toBe('The amount is not valid.');
    fireEvent.change(amount, { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(updateMock).toHaveBeenCalledWith('sess', 'ada@walletofsatoshi.com', 2);
    await settleAmounts();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Unnamed' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Edit Ada' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Edit Ada' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'USD Ada' }), {
      target: { value: '9' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(updateMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox', { name: 'USD Ada' })).toBeNull();
    expect(screen.getByText('$1.00')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit Ada' })).toBeTruthy();
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

  it('does not search on focus of an empty person field or on invalid text', async () => {
    fetchMock.mockResolvedValue({ ...ROSTER, recipients: [] });
    renderWithLocale(<DailyPaymentAmountsScreen />);
    expect(await screen.findByText('No recipients')).toBeTruthy();
    const person = screen.getByRole('textbox', { name: 'Person' });
    fireEvent.focus(person);
    fireEvent.change(person, { target: { value: '   ' } });
    fireEvent.change(person, { target: { value: 'ada' } });
    fireEvent.change(person, { target: { value: 'ada@example.com' } });
    fireEvent.change(person, { target: { value: 'ada bob' } });
    fireEvent.change(person, { target: { value: '@ada bob' } });
    fireEvent.change(person, { target: { value: '@ada!' } });
    expect(searchMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('option')).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Address' })).toBeNull();
    fireEvent.change(person, { target: { value: '@' } });
    expect(searchMock).toHaveBeenCalledWith('sess', '');
    expect(await screen.findByRole('option', { name: '@ada' })).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: 'Address' })).toBeNull();
  });

  it('searches a leading @ prefix and lists @username plus the muted name', async () => {
    fetchMock.mockResolvedValue({ ...ROSTER, recipients: [] });
    renderWithLocale(<DailyPaymentAmountsScreen />);
    expect(await screen.findByText('No recipients')).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: 'Person' }), {
      target: { value: '@Ada' },
    });
    const option = await screen.findByRole('option', { name: '@ada' });
    expect(searchMock).toHaveBeenCalledWith('sess', 'ada');
    expect(option.querySelector('.font-medium')?.textContent).toBe('@ada');
    expect(option.querySelector('.text-app-muted')?.textContent).toBe('Ada');
    expect(screen.queryByRole('textbox', { name: 'Address' })).toBeNull();
  });

  it('omits the display name when it matches the username', async () => {
    searchMock.mockResolvedValue([{ id: 'acc_ada', username: 'ada', name: 'ada' }]);
    fetchMock.mockResolvedValue({ ...ROSTER, recipients: [] });
    renderWithLocale(<DailyPaymentAmountsScreen />);
    expect(await screen.findByText('No recipients')).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: 'Person' }), {
      target: { value: '@ada' },
    });
    const option = await screen.findByRole('option', { name: '@ada' });
    expect(option.querySelectorAll('span')).toHaveLength(1);
    expect(option.querySelector('.text-app-muted')).toBeNull();
  });

  it('shows the whole page with no local cap of eight', async () => {
    searchMock.mockResolvedValue(
      Array.from({ length: 9 }, (_, index) => ({
        id: `acc_${String(index)}`,
        username: `u${String(index)}`,
        name: `Name${String(index)}`,
      })),
    );
    fetchMock.mockResolvedValue({ ...ROSTER, recipients: [] });
    renderWithLocale(<DailyPaymentAmountsScreen />);
    expect(await screen.findByText('No recipients')).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: 'Person' }), {
      target: { value: '@u' },
    });
    expect(await screen.findByRole('option', { name: '@u0' })).toBeTruthy();
    expect(screen.getAllByRole('option')).toHaveLength(9);
  });

  it('keeps the list open on pick, fills @username, and adds by account id', async () => {
    fetchMock.mockResolvedValue({ ...ROSTER, recipients: [] });
    renderWithLocale(<DailyPaymentAmountsScreen />);
    expect(await screen.findByText('No recipients')).toBeTruthy();
    await pickPerson();
    const person = screen.getByRole('textbox', { name: 'Person' });
    expect(person).toHaveProperty('value', '@ada');
    const option = screen.getByRole('option', { name: '@ada' });
    expect(option.getAttribute('aria-selected')).toBe('true');
    fireEvent.change(person, { target: { value: '@ada' } });
    expect(screen.getByRole('option', { name: '@ada' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.change(screen.getByRole('textbox', { name: 'USD' }), {
      target: { value: '1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(addMock).toHaveBeenCalledWith('sess', 'acc_ada', 1);
  });

  it('chooses the person on mouse down', async () => {
    fetchMock.mockResolvedValue({ ...ROSTER, recipients: [] });
    renderWithLocale(<DailyPaymentAmountsScreen />);
    expect(await screen.findByText('No recipients')).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: 'Person' }), {
      target: { value: '@' },
    });
    const option = await screen.findByRole('option', { name: '@ada' });
    fireEvent.mouseDown(option);
    expect(screen.getByRole('textbox', { name: 'Person' })).toHaveProperty('value', '@ada');
    expect(screen.getByRole('option', { name: '@ada' }).getAttribute('aria-selected')).toBe('true');
  });

  it('clears the selection on another edit and searches again', async () => {
    fetchMock.mockResolvedValue({ ...ROSTER, recipients: [] });
    renderWithLocale(<DailyPaymentAmountsScreen />);
    expect(await screen.findByText('No recipients')).toBeTruthy();
    await pickPerson();
    fireEvent.change(screen.getByRole('textbox', { name: 'Person' }), {
      target: { value: '@ad' },
    });
    expect(await screen.findByRole('option', { name: '@ada' })).toBeTruthy();
    expect(searchMock).toHaveBeenCalledWith('sess', 'ad');
    expect(screen.getByRole('option', { name: '@ada' }).getAttribute('aria-selected')).toBe(
      'false',
    );
  });

  it('shows no rows and no address field when search throws', async () => {
    searchMock.mockRejectedValueOnce(new Error('offline'));
    fetchMock.mockResolvedValue({ ...ROSTER, recipients: [] });
    renderWithLocale(<DailyPaymentAmountsScreen />);
    expect(await screen.findByText('No recipients')).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: 'Person' }), {
      target: { value: '@ada' },
    });
    await waitFor(() => {
      expect(searchMock).toHaveBeenCalledWith('sess', 'ada');
    });
    expect(screen.queryByRole('option')).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Address' })).toBeNull();
  });

  it('sets no person rows when an empty @ search rejects', async () => {
    searchMock.mockRejectedValueOnce(new Error('offline'));
    fetchMock.mockResolvedValue({ ...ROSTER, recipients: [] });
    renderWithLocale(<DailyPaymentAmountsScreen />);
    expect(await screen.findByText('No recipients')).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: 'Person' }), {
      target: { value: '@' },
    });
    await waitFor(() => {
      expect(searchMock).toHaveBeenCalledWith('sess', '');
    });
    expect(screen.queryByRole('option')).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Address' })).toBeNull();
  });

  it('filters the first page while a prefix search is in flight', async () => {
    let resolvePrefix: (value: PersonHit[]) => void = () => undefined;
    searchMock.mockImplementation((_session, requested) => {
      if (requested === '') {
        return Promise.resolve([
          { id: 'acc_ada', username: 'ada', name: 'Ada' },
          { id: 'acc_bob', username: 'bob', name: 'Bob' },
        ]);
      }
      return new Promise((resolve) => {
        resolvePrefix = resolve;
      });
    });
    fetchMock.mockResolvedValue({ ...ROSTER, recipients: [] });
    renderWithLocale(<DailyPaymentAmountsScreen />);
    expect(await screen.findByText('No recipients')).toBeTruthy();
    const person = screen.getByRole('textbox', { name: 'Person' });
    fireEvent.change(person, { target: { value: '@' } });
    expect(await screen.findByRole('option', { name: '@ada' })).toBeTruthy();
    expect(screen.getByRole('option', { name: '@bob' })).toBeTruthy();
    fireEvent.change(person, { target: { value: '@ad' } });
    expect(screen.getByRole('option', { name: '@ada' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: '@bob' })).toBeNull();
    await waitFor(() => {
      expect(searchMock).toHaveBeenCalledWith('sess', 'ad');
    });
    await act(async () => {
      resolvePrefix([{ id: 'acc_ada2', username: 'ada2', name: 'Ada Two' }]);
      await Promise.resolve();
    });
    expect(screen.getByRole('option', { name: '@ada2' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: '@ada' })).toBeNull();
    expect(screen.getAllByRole('option')).toHaveLength(1);
  });

  it('ignores a slower person search after a newer query', async () => {
    let resolveOlder: (value: PersonHit[]) => void = () => undefined;
    let resolveNewer: (value: PersonHit[]) => void = () => undefined;
    searchMock
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOlder = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveNewer = resolve;
          }),
      );
    fetchMock.mockResolvedValue({ ...ROSTER, recipients: [] });
    renderWithLocale(<DailyPaymentAmountsScreen />);
    expect(await screen.findByText('No recipients')).toBeTruthy();
    const person = screen.getByRole('textbox', { name: 'Person' });
    fireEvent.change(person, { target: { value: '@ad' } });
    await waitFor(() => {
      expect(searchMock).toHaveBeenCalledTimes(1);
    });
    fireEvent.change(person, { target: { value: '@ada' } });
    await waitFor(() => {
      expect(searchMock).toHaveBeenCalledTimes(2);
    });
    await act(async () => {
      resolveNewer([ADA_PERSON]);
      await Promise.resolve();
    });
    expect(await screen.findByRole('option', { name: '@ada' })).toBeTruthy();
    await act(async () => {
      resolveOlder([{ id: 'acc_other', username: 'other', name: 'Other' }]);
      await Promise.resolve();
    });
    expect(screen.getByRole('option', { name: '@ada' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: '@other' })).toBeNull();
  });

  it('keeps newer person rows when an older search fails', async () => {
    let rejectOlder: (reason: Error) => void = () => undefined;
    let resolveNewer: (value: PersonHit[]) => void = () => undefined;
    searchMock
      .mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            rejectOlder = reject;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveNewer = resolve;
          }),
      );
    fetchMock.mockResolvedValue({ ...ROSTER, recipients: [] });
    renderWithLocale(<DailyPaymentAmountsScreen />);
    expect(await screen.findByText('No recipients')).toBeTruthy();
    const person = screen.getByRole('textbox', { name: 'Person' });
    fireEvent.change(person, { target: { value: '@ad' } });
    await waitFor(() => {
      expect(searchMock).toHaveBeenCalledTimes(1);
    });
    fireEvent.change(person, { target: { value: '@ada' } });
    await waitFor(() => {
      expect(searchMock).toHaveBeenCalledTimes(2);
    });
    await act(async () => {
      resolveNewer([ADA_PERSON]);
      await Promise.resolve();
    });
    expect(await screen.findByRole('option', { name: '@ada' })).toBeTruthy();
    await act(async () => {
      rejectOlder(new Error('late'));
      await Promise.resolve();
    });
    expect(screen.getByRole('option', { name: '@ada' })).toBeTruthy();
  });

  it('ignores a stale person search resolve after unmount', async () => {
    let resolveSearch: (value: PersonHit[]) => void = () => undefined;
    searchMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSearch = resolve;
        }),
    );
    fetchMock.mockResolvedValue({ ...ROSTER, recipients: [] });
    const view = renderWithLocale(<DailyPaymentAmountsScreen />);
    expect(await screen.findByText('No recipients')).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: 'Person' }), {
      target: { value: '@ada' },
    });
    await waitFor(() => {
      expect(searchMock).toHaveBeenCalled();
    });
    view.unmount();
    await act(async () => {
      resolveSearch([ADA_PERSON]);
      await Promise.resolve();
    });
    expect(screen.queryByRole('option')).toBeNull();
  });

  it('ignores a stale person search reject after unmount', async () => {
    let rejectSearch: (reason: Error) => void = () => undefined;
    searchMock.mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectSearch = reject;
        }),
    );
    fetchMock.mockResolvedValue({ ...ROSTER, recipients: [] });
    const view = renderWithLocale(<DailyPaymentAmountsScreen />);
    expect(await screen.findByText('No recipients')).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: 'Person' }), {
      target: { value: '@ada' },
    });
    await waitFor(() => {
      expect(searchMock).toHaveBeenCalled();
    });
    view.unmount();
    await act(async () => {
      rejectSearch(new Error('offline'));
      await Promise.resolve();
    });
    expect(screen.queryByRole('option')).toBeNull();
  });

  it('shows mapped add errors for a person', async () => {
    fetchMock.mockResolvedValue({ ...ROSTER, recipients: [] });
    renderWithLocale(<DailyPaymentAmountsScreen />);
    expect(await screen.findByText('No recipients')).toBeTruthy();
    await pickPerson();
    fireEvent.change(screen.getByRole('textbox', { name: 'USD' }), {
      target: { value: '1' },
    });
    addMock.mockRejectedValueOnce(new Error('funding.daily.noLightning'));
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'This person has no Wallet of Satoshi address.',
    );
    addMock.mockRejectedValueOnce(new Error('funding.daily.unknownPerson'));
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'That person was not found.',
    );
    addMock.mockRejectedValueOnce(new Error('funding.daily.invalidPerson'));
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Choose a person and a valid amount.',
    );
  });

  it('hides the person suggestion list when it has no rows', async () => {
    await renderAmounts();
    const list = document.getElementById('daily-person-add-list');
    expect(list).toBeTruthy();
    expect(list?.className).toContain('hidden');
    expect(list?.className).toBe('hidden');
    fireEvent.change(screen.getByRole('textbox', { name: 'Person' }), {
      target: { value: '@' },
    });
    expect(await screen.findByRole('option', { name: '@ada' })).toBeTruthy();
    expect(list?.className).not.toContain('hidden');
    expect(list?.className).toBe(
      'flex w-full flex-col rounded-xl border border-app-border bg-app-card p-2',
    );
  });

  it('moderators: shows the amounts without the comment', async () => {
    await renderModerators();
    expect(screen.getByRole('heading', { name: 'Moderator payments' })).toBeTruthy();
    expect(screen.queryByText('Daily gift')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit comment' })).toBeNull();
    expect(screen.getByText('$1.00')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ada' }).getAttribute('href')).toBe('/members/acc_ada');
    expect(screen.getByText('Unnamed')).toBeTruthy();
    expect(screen.queryByText('ada@w...')).toBeNull();
    expect(screen.queryByText('ada@walletofsatoshi.com')).toBeNull();
    expect(screen.queryByText('bob@example.com')).toBeNull();
    expect(screen.getByText('$1.30')).toBeTruthy();
    expect(screen.queryByText(/Everyone in the grant program receives/)).toBeNull();
    expect(screen.getByText('Moderators')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'On' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByText('Save')).toBeNull();
    expect(screen.queryByText('Update')).toBeNull();
    expect(screen.queryByText('Delete')).toBeNull();
    expect(screen.queryByText('Edit Ada')).toBeNull();
    expect(screen.getByRole('button', { name: 'Edit Ada' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete Ada' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit Unnamed' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete Unnamed' })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Person' })).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: 'Address' })).toBeNull();
    expect(searchMock).not.toHaveBeenCalled();
  });
  it('moderators: does not render a Lightning address, including a non-Wallet of Satoshi address', async () => {
    fetchMock.mockResolvedValueOnce({
      comment: 'Daily gift',
      paymentsEnabled: true,
      moderatorPaymentsEnabled: true,
      defaultAmountUsd: 4,
      recipients: [],
      moderators: [
        {
          address: 'ada@notwalletofsatoshi.com',
          amountUsd: 1,
          accountId: 'acc_ada',
          name: 'Ada',
        },
        {
          address: 'ada@walletofsatoshi.com.evil',
          amountUsd: 2,
          accountId: null,
          name: null,
        },
      ],
    });
    renderWithLocale(<DailyPaymentModeratorsScreen />);
    expect(await screen.findByRole('link', { name: 'Ada' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ada' }).getAttribute('href')).toBe('/members/acc_ada');
    expect(screen.getByText('Unnamed')).toBeTruthy();
    expect(screen.queryByText('ada@notwalletofsatoshi.com')).toBeNull();
    expect(screen.queryByText('ada@walletofsatoshi.com.evil')).toBeNull();
    expect(screen.queryByText('ada@w...')).toBeNull();
    expect(screen.queryByText('ada@walletofsatoshi.com')).toBeNull();
    expect(screen.getByRole('button', { name: 'Edit Ada' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit Unnamed' })).toBeTruthy();
  });
  it('moderators: turns payments off and on', async () => {
    await renderModerators();
    fireEvent.click(screen.getByRole('button', { name: 'On' }));
    expect(modPaymentsMock).toHaveBeenCalledWith('sess', true);
    await settleModerators();
    fireEvent.click(screen.getByRole('button', { name: 'Off' }));
    expect(modPaymentsMock).toHaveBeenCalledWith('sess', false);
    expect((await screen.findByRole('button', { name: 'Off' })).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });
  it('moderators: refuses a bad amount and adds a recipient', async () => {
    fetchMock.mockResolvedValue({ ...ROSTER, moderators: [] });
    renderWithLocale(<DailyPaymentModeratorsScreen />);
    expect(await screen.findByText('No moderators')).toBeTruthy();
    expect(screen.getByText('No moderators')).toBeTruthy();
    await pickPerson();
    const usd = screen.getByRole('textbox', { name: 'USD' });
    fireEvent.change(usd, { target: { value: 'abc' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(modAddMock).not.toHaveBeenCalled();
    fireEvent.change(usd, { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.change(usd, { target: { value: '0.0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByRole('alert').textContent).toBe('The amount is not valid.');
    fireEvent.change(usd, { target: { value: ' 1.5 ' } });
    modAddMock.mockResolvedValueOnce({
      ...ROSTER,
      moderators: [
        { address: 'ada@example.com', amountUsd: 1.5, accountId: 'acc_ada', name: 'Ada' },
      ],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(modAddMock).toHaveBeenCalledWith('sess', 'acc_ada', 1.5);
    expect(await screen.findByRole('textbox', { name: 'Person' })).toHaveProperty('value', '');
  });
  it('moderators: refuses add with a valid amount and no selected person', async () => {
    fetchMock.mockResolvedValue({ ...ROSTER, moderators: [] });
    renderWithLocale(<DailyPaymentModeratorsScreen />);
    expect(await screen.findByText('No moderators')).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: 'USD' }), {
      target: { value: '1.5' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(modAddMock).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toBe('Choose a person.');
  });
  it('moderators: keeps an open amount editor open when a recipient is added', async () => {
    await renderModerators();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Ada' }));
    const amount = screen.getByRole('textbox', { name: 'USD Ada' });
    fireEvent.change(amount, { target: { value: '4.25' } });
    await pickPerson();
    fireEvent.change(screen.getByRole('textbox', { name: /^USD$/ }), {
      target: { value: '1' },
    });
    modAddMock.mockResolvedValueOnce({
      ...ROSTER,
      moderators: [
        ...ROSTER.moderators,
        { address: 'ada@example.com', amountUsd: 1, accountId: 'acc_ada', name: 'Ada' },
      ],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(modAddMock).toHaveBeenCalledWith('sess', 'acc_ada', 1);
    expect(await screen.findByRole('textbox', { name: 'USD Ada' })).toHaveProperty('value', '4.25');
  });
  it('moderators: updates and deletes a recipient', async () => {
    await renderModerators();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Ada' }));
    expect(screen.queryByText('Save')).toBeNull();
    expect(screen.queryByText('Cancel')).toBeNull();
    const amount = screen.getByRole('textbox', { name: 'USD Ada' });
    fireEvent.change(amount, { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(modUpdateMock).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toBe('The amount is not valid.');
    fireEvent.change(amount, { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(modUpdateMock).toHaveBeenCalledWith('sess', 'ada@walletofsatoshi.com', 2);
    await settleModerators();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Unnamed' }));
    expect(modDeleteMock).toHaveBeenCalledWith('sess', 'bob@example.com');
  });
  it('moderators: disables Add while an amount save is in flight', async () => {
    await renderModerators();
    let resolveSave: (value: DailyRoster) => void = () => undefined;
    modUpdateMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSave = resolve;
        }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit Ada' }));
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
  it('moderators: cancels an amount edit without saving', async () => {
    await renderModerators();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Ada' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'USD Ada' }), {
      target: { value: '9' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(modUpdateMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox', { name: 'USD Ada' })).toBeNull();
    expect(screen.getByText('$1.00')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit Ada' })).toBeTruthy();
  });
  it('moderators: does not search on focus of an empty person field or on invalid text', async () => {
    fetchMock.mockResolvedValue({ ...ROSTER, moderators: [] });
    renderWithLocale(<DailyPaymentModeratorsScreen />);
    expect(await screen.findByText('No moderators')).toBeTruthy();
    const person = screen.getByRole('textbox', { name: 'Person' });
    fireEvent.focus(person);
    fireEvent.change(person, { target: { value: '   ' } });
    fireEvent.change(person, { target: { value: 'ada' } });
    fireEvent.change(person, { target: { value: 'ada@example.com' } });
    fireEvent.change(person, { target: { value: 'ada bob' } });
    fireEvent.change(person, { target: { value: '@ada bob' } });
    fireEvent.change(person, { target: { value: '@ada!' } });
    expect(searchMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('option')).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Address' })).toBeNull();
    fireEvent.change(person, { target: { value: '@' } });
    expect(searchMock).toHaveBeenCalledWith('sess', '');
    expect(await screen.findByRole('option', { name: '@ada' })).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: 'Address' })).toBeNull();
  });
  it('moderators: searches a leading @ prefix and lists @username plus the muted name', async () => {
    fetchMock.mockResolvedValue({ ...ROSTER, moderators: [] });
    renderWithLocale(<DailyPaymentModeratorsScreen />);
    expect(await screen.findByText('No moderators')).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: 'Person' }), {
      target: { value: '@Ada' },
    });
    const option = await screen.findByRole('option', { name: '@ada' });
    expect(searchMock).toHaveBeenCalledWith('sess', 'ada');
    expect(option.querySelector('.font-medium')?.textContent).toBe('@ada');
    expect(option.querySelector('.text-app-muted')?.textContent).toBe('Ada');
    expect(screen.queryByRole('textbox', { name: 'Address' })).toBeNull();
  });
  it('moderators: omits the display name when it matches the username', async () => {
    searchMock.mockResolvedValue([{ id: 'acc_ada', username: 'ada', name: 'ada' }]);
    fetchMock.mockResolvedValue({ ...ROSTER, moderators: [] });
    renderWithLocale(<DailyPaymentModeratorsScreen />);
    expect(await screen.findByText('No moderators')).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: 'Person' }), {
      target: { value: '@ada' },
    });
    const option = await screen.findByRole('option', { name: '@ada' });
    expect(option.querySelectorAll('span')).toHaveLength(1);
    expect(option.querySelector('.text-app-muted')).toBeNull();
  });
  it('moderators: shows the whole page with no local cap of eight', async () => {
    searchMock.mockResolvedValue(
      Array.from({ length: 9 }, (_, index) => ({
        id: `acc_${String(index)}`,
        username: `u${String(index)}`,
        name: `Name${String(index)}`,
      })),
    );
    fetchMock.mockResolvedValue({ ...ROSTER, moderators: [] });
    renderWithLocale(<DailyPaymentModeratorsScreen />);
    expect(await screen.findByText('No moderators')).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: 'Person' }), {
      target: { value: '@u' },
    });
    expect(await screen.findByRole('option', { name: '@u0' })).toBeTruthy();
    expect(screen.getAllByRole('option')).toHaveLength(9);
  });
  it('moderators: keeps the list open on pick, fills @username, and adds by account id', async () => {
    fetchMock.mockResolvedValue({ ...ROSTER, moderators: [] });
    renderWithLocale(<DailyPaymentModeratorsScreen />);
    expect(await screen.findByText('No moderators')).toBeTruthy();
    await pickPerson();
    const person = screen.getByRole('textbox', { name: 'Person' });
    expect(person).toHaveProperty('value', '@ada');
    const option = screen.getByRole('option', { name: '@ada' });
    expect(option.getAttribute('aria-selected')).toBe('true');
    fireEvent.change(person, { target: { value: '@ada' } });
    expect(screen.getByRole('option', { name: '@ada' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.change(screen.getByRole('textbox', { name: 'USD' }), {
      target: { value: '1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(modAddMock).toHaveBeenCalledWith('sess', 'acc_ada', 1);
  });
  it('moderators: chooses the person on mouse down', async () => {
    fetchMock.mockResolvedValue({ ...ROSTER, moderators: [] });
    renderWithLocale(<DailyPaymentModeratorsScreen />);
    expect(await screen.findByText('No moderators')).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: 'Person' }), {
      target: { value: '@' },
    });
    const option = await screen.findByRole('option', { name: '@ada' });
    fireEvent.mouseDown(option);
    expect(screen.getByRole('textbox', { name: 'Person' })).toHaveProperty('value', '@ada');
    expect(screen.getByRole('option', { name: '@ada' }).getAttribute('aria-selected')).toBe('true');
  });
  it('moderators: clears the selection on another edit and searches again', async () => {
    fetchMock.mockResolvedValue({ ...ROSTER, moderators: [] });
    renderWithLocale(<DailyPaymentModeratorsScreen />);
    expect(await screen.findByText('No moderators')).toBeTruthy();
    await pickPerson();
    fireEvent.change(screen.getByRole('textbox', { name: 'Person' }), {
      target: { value: '@ad' },
    });
    expect(await screen.findByRole('option', { name: '@ada' })).toBeTruthy();
    expect(searchMock).toHaveBeenCalledWith('sess', 'ad');
    expect(screen.getByRole('option', { name: '@ada' }).getAttribute('aria-selected')).toBe(
      'false',
    );
  });
  it('moderators: shows no rows and no address field when search throws', async () => {
    searchMock.mockRejectedValueOnce(new Error('offline'));
    fetchMock.mockResolvedValue({ ...ROSTER, moderators: [] });
    renderWithLocale(<DailyPaymentModeratorsScreen />);
    expect(await screen.findByText('No moderators')).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: 'Person' }), {
      target: { value: '@ada' },
    });
    await waitFor(() => {
      expect(searchMock).toHaveBeenCalledWith('sess', 'ada');
    });
    expect(screen.queryByRole('option')).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Address' })).toBeNull();
  });
  it('moderators: sets no person rows when an empty @ search rejects', async () => {
    searchMock.mockRejectedValueOnce(new Error('offline'));
    fetchMock.mockResolvedValue({ ...ROSTER, moderators: [] });
    renderWithLocale(<DailyPaymentModeratorsScreen />);
    expect(await screen.findByText('No moderators')).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: 'Person' }), {
      target: { value: '@' },
    });
    await waitFor(() => {
      expect(searchMock).toHaveBeenCalledWith('sess', '');
    });
    expect(screen.queryByRole('option')).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Address' })).toBeNull();
  });
  it('moderators: filters the first page while a prefix search is in flight', async () => {
    let resolvePrefix: (value: PersonHit[]) => void = () => undefined;
    searchMock.mockImplementation((_session, requested) => {
      if (requested === '') {
        return Promise.resolve([
          { id: 'acc_ada', username: 'ada', name: 'Ada' },
          { id: 'acc_bob', username: 'bob', name: 'Bob' },
        ]);
      }
      return new Promise((resolve) => {
        resolvePrefix = resolve;
      });
    });
    fetchMock.mockResolvedValue({ ...ROSTER, moderators: [] });
    renderWithLocale(<DailyPaymentModeratorsScreen />);
    expect(await screen.findByText('No moderators')).toBeTruthy();
    const person = screen.getByRole('textbox', { name: 'Person' });
    fireEvent.change(person, { target: { value: '@' } });
    expect(await screen.findByRole('option', { name: '@ada' })).toBeTruthy();
    expect(screen.getByRole('option', { name: '@bob' })).toBeTruthy();
    fireEvent.change(person, { target: { value: '@ad' } });
    expect(screen.getByRole('option', { name: '@ada' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: '@bob' })).toBeNull();
    await waitFor(() => {
      expect(searchMock).toHaveBeenCalledWith('sess', 'ad');
    });
    await act(async () => {
      resolvePrefix([{ id: 'acc_ada2', username: 'ada2', name: 'Ada Two' }]);
      await Promise.resolve();
    });
    expect(screen.getByRole('option', { name: '@ada2' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: '@ada' })).toBeNull();
    expect(screen.getAllByRole('option')).toHaveLength(1);
  });
  it('moderators: ignores a slower person search after a newer query', async () => {
    let resolveOlder: (value: PersonHit[]) => void = () => undefined;
    let resolveNewer: (value: PersonHit[]) => void = () => undefined;
    searchMock
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOlder = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveNewer = resolve;
          }),
      );
    fetchMock.mockResolvedValue({ ...ROSTER, moderators: [] });
    renderWithLocale(<DailyPaymentModeratorsScreen />);
    expect(await screen.findByText('No moderators')).toBeTruthy();
    const person = screen.getByRole('textbox', { name: 'Person' });
    fireEvent.change(person, { target: { value: '@ad' } });
    await waitFor(() => {
      expect(searchMock).toHaveBeenCalledTimes(1);
    });
    fireEvent.change(person, { target: { value: '@ada' } });
    await waitFor(() => {
      expect(searchMock).toHaveBeenCalledTimes(2);
    });
    await act(async () => {
      resolveNewer([ADA_PERSON]);
      await Promise.resolve();
    });
    expect(await screen.findByRole('option', { name: '@ada' })).toBeTruthy();
    await act(async () => {
      resolveOlder([{ id: 'acc_other', username: 'other', name: 'Other' }]);
      await Promise.resolve();
    });
    expect(screen.getByRole('option', { name: '@ada' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: '@other' })).toBeNull();
  });
  it('moderators: keeps newer person rows when an older search fails', async () => {
    let rejectOlder: (reason: Error) => void = () => undefined;
    let resolveNewer: (value: PersonHit[]) => void = () => undefined;
    searchMock
      .mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            rejectOlder = reject;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveNewer = resolve;
          }),
      );
    fetchMock.mockResolvedValue({ ...ROSTER, moderators: [] });
    renderWithLocale(<DailyPaymentModeratorsScreen />);
    expect(await screen.findByText('No moderators')).toBeTruthy();
    const person = screen.getByRole('textbox', { name: 'Person' });
    fireEvent.change(person, { target: { value: '@ad' } });
    await waitFor(() => {
      expect(searchMock).toHaveBeenCalledTimes(1);
    });
    fireEvent.change(person, { target: { value: '@ada' } });
    await waitFor(() => {
      expect(searchMock).toHaveBeenCalledTimes(2);
    });
    await act(async () => {
      resolveNewer([ADA_PERSON]);
      await Promise.resolve();
    });
    expect(await screen.findByRole('option', { name: '@ada' })).toBeTruthy();
    await act(async () => {
      rejectOlder(new Error('late'));
      await Promise.resolve();
    });
    expect(screen.getByRole('option', { name: '@ada' })).toBeTruthy();
  });
  it('moderators: ignores a stale person search resolve after unmount', async () => {
    let resolveSearch: (value: PersonHit[]) => void = () => undefined;
    searchMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSearch = resolve;
        }),
    );
    fetchMock.mockResolvedValue({ ...ROSTER, moderators: [] });
    const view = renderWithLocale(<DailyPaymentModeratorsScreen />);
    expect(await screen.findByText('No moderators')).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: 'Person' }), {
      target: { value: '@ada' },
    });
    await waitFor(() => {
      expect(searchMock).toHaveBeenCalled();
    });
    view.unmount();
    await act(async () => {
      resolveSearch([ADA_PERSON]);
      await Promise.resolve();
    });
    expect(screen.queryByRole('option')).toBeNull();
  });
  it('moderators: ignores a stale person search reject after unmount', async () => {
    let rejectSearch: (reason: Error) => void = () => undefined;
    searchMock.mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectSearch = reject;
        }),
    );
    fetchMock.mockResolvedValue({ ...ROSTER, moderators: [] });
    const view = renderWithLocale(<DailyPaymentModeratorsScreen />);
    expect(await screen.findByText('No moderators')).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: 'Person' }), {
      target: { value: '@ada' },
    });
    await waitFor(() => {
      expect(searchMock).toHaveBeenCalled();
    });
    view.unmount();
    await act(async () => {
      rejectSearch(new Error('offline'));
      await Promise.resolve();
    });
    expect(screen.queryByRole('option')).toBeNull();
  });
  it('moderators: shows mapped add errors for a person', async () => {
    fetchMock.mockResolvedValue({ ...ROSTER, moderators: [] });
    renderWithLocale(<DailyPaymentModeratorsScreen />);
    expect(await screen.findByText('No moderators')).toBeTruthy();
    await pickPerson();
    fireEvent.change(screen.getByRole('textbox', { name: 'USD' }), {
      target: { value: '1' },
    });
    modAddMock.mockRejectedValueOnce(new Error('funding.daily.noLightning'));
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'This person has no Wallet of Satoshi address.',
    );
    modAddMock.mockRejectedValueOnce(new Error('funding.daily.unknownPerson'));
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'That person was not found.',
    );
    modAddMock.mockRejectedValueOnce(new Error('funding.daily.invalidPerson'));
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Choose a person and a valid amount.',
    );
  });
  it('moderators: hides the person suggestion list when it has no rows', async () => {
    await renderModerators();
    const list = document.getElementById('moderator-person-add-list');
    expect(list).toBeTruthy();
    expect(list?.className).toContain('hidden');
    expect(list?.className).toBe('hidden');
    fireEvent.change(screen.getByRole('textbox', { name: 'Person' }), {
      target: { value: '@' },
    });
    expect(await screen.findByRole('option', { name: '@ada' })).toBeTruthy();
    expect(list?.className).not.toContain('hidden');
    expect(list?.className).toBe(
      'flex w-full flex-col rounded-xl border border-app-border bg-app-card p-2',
    );
  });
});
