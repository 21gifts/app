import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InboxLoader } from '@/components/InboxLoader';
import { LocaleProvider } from '@/components/LocaleProvider';
import { ThemeProvider } from '@/components/ThemeProvider';
import type { Account, Conversation, ConversationMessage } from '@/lib/api-types';
import { getCatalog } from '@/lib/messages';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const push = vi.fn();
const searchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: (): { push: typeof push } => ({ push }),
  useSearchParams: (): URLSearchParams => searchParams,
}));

vi.mock('@/lib/api', () => ({
  fetchConversations: vi.fn(),
  fetchConversation: vi.fn(),
  postConversationInvoice: vi.fn(),
  postConversationMessage: vi.fn(),
}));

import {
  fetchConversation,
  fetchConversations,
  postConversationInvoice,
  postConversationMessage,
} from '@/lib/api';

const listMock = vi.mocked(fetchConversations);
const threadMock = vi.mocked(fetchConversation);
const invoiceMock = vi.mocked(postConversationInvoice);
const postMock = vi.mocked(postConversationMessage);

const account: Account = {
  id: 'acc_1',
  linkingKey: '02abcdef',
  role: 'basis',
  name: 'Ada',
  location: null,
  lightningAddress: 'alice@walletofsatoshi.com',
  lightningAddressVerified: false,
  forumLawsDismissed: false,
  createdAt: 1_700_000_000,
  rulesAgreedAt: 1_700_000_001,
  viewKey: 'a'.repeat(64),
  aboutMe: null,
  setup: null,
  missing: [],
};

const THREAD: Conversation = {
  id: 'conv-1',
  kind: 'member_platform',
  name: '21.gifts',
  lastText: 'Hello',
  lastAt: '2026-08-28T12:00:00.000Z',
  lastFromMe: false,
  lastSats: 0,
};

const OLDER: Conversation = {
  id: 'conv-2',
  kind: 'member_member',
  name: 'Bob',
  lastText: 'Older',
  lastAt: '2026-08-27T12:00:00.000Z',
  lastFromMe: false,
  lastSats: 0,
};

const MESSAGE: ConversationMessage = {
  id: 'm1',
  name: 'Ada',
  text: 'Hello',
  createdAt: '2026-08-28T12:00:00.000Z',
  fromMe: false,
  sats: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  push.mockReset();
  searchParams.delete('c');
  useAuthStore.setState({ session: 'sess', account });
});

afterEach(cleanup);

describe('InboxLoader', () => {
  it('renders nothing when there is no session', () => {
    useAuthStore.setState({ session: null, account });
    const { container } = renderWithLocale(<InboxLoader />);
    expect(container.firstChild).toBeNull();
  });

  it('loads the thread list', async () => {
    listMock.mockResolvedValue([THREAD, OLDER]);
    renderWithLocale(<InboxLoader />);
    expect(await screen.findByText('21.gifts')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Conversation type' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /21\.gifts/ }));
    expect(push).toHaveBeenCalledWith('/messages?c=conv-1');
  });

  it('shows empty copy', async () => {
    listMock.mockResolvedValue([]);
    renderWithLocale(<InboxLoader />);
    expect(await screen.findByText('No private messages yet.')).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Conversation type' })).toBeNull();
  });

  it('shows a list error and retries', async () => {
    listMock.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce([THREAD]);
    renderWithLocale(<InboxLoader />);
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('21.gifts')).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Conversation type' })).toBeNull();
  });

  it('shows the origin filter for a moderator', async () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'moderator' } });
    listMock.mockResolvedValue([THREAD]);
    renderWithLocale(<InboxLoader />);
    const group = await screen.findByRole('group', { name: 'Conversation type' });
    expect(group).toBeTruthy();
    expect(screen.queryByText('21.gifts')).toBeNull();
    fireEvent.click(within(group).getByRole('button', { name: 'Contact' }));
    expect(await screen.findByText('21.gifts')).toBeTruthy();
  });

  it('shows the origin filter for a founder', async () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'founder' } });
    listMock.mockResolvedValue([THREAD]);
    renderWithLocale(<InboxLoader />);
    expect(await screen.findByRole('group', { name: 'Conversation type' })).toBeTruthy();
    expect(screen.queryByText('21.gifts')).toBeNull();
  });

  it('hides the origin filter for a verified member', async () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'verified' } });
    listMock.mockResolvedValue([THREAD]);
    renderWithLocale(<InboxLoader />);
    expect(await screen.findByText('21.gifts')).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Conversation type' })).toBeNull();
  });

  it('clears thread state when ?c= changes', async () => {
    searchParams.set('c', 'conv-1');
    listMock.mockResolvedValue([THREAD, OLDER]);
    threadMock.mockResolvedValue([MESSAGE]);
    const view = renderWithLocale(<InboxLoader />);
    expect(await screen.findByRole('heading', { name: '21.gifts' })).toBeTruthy();
    searchParams.set('c', 'conv-2');
    view.rerender(<InboxLoader />);
    expect(await screen.findByRole('heading', { name: 'Bob' })).toBeTruthy();
  });

  it('opens a thread from ?c= and posts a reply', async () => {
    searchParams.set('c', 'conv-1');
    listMock.mockResolvedValue([THREAD, OLDER]);
    threadMock.mockResolvedValue([MESSAGE]);
    postMock.mockResolvedValue({
      id: 'm2',
      name: 'Ada',
      text: 'Follow up',
      createdAt: '2026-08-28T13:00:00.000Z',
      fromMe: true,
      sats: 0,
    });
    renderWithLocale(<InboxLoader />);
    expect(await screen.findByRole('heading', { name: '21.gifts' })).toBeTruthy();
    expect(await screen.findByText('Hello')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: '  Follow up  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('sess', 'conv-1', 'Follow up');
      expect(screen.getByText('Follow up')).toBeTruthy();
    });
    expect(screen.getByText('You')).toBeTruthy();
    expect(document.querySelector('[data-from-me="true"]')).toBeTruthy();
    expect(invoiceMock).not.toHaveBeenCalled();
  });

  it('mints an amount invoice, clears posting before polling, and applies the paid row', async () => {
    searchParams.set('c', 'conv-1');
    listMock.mockResolvedValue([THREAD, OLDER]);
    let resolvePoll: ((value: ConversationMessage[]) => void) | undefined;
    threadMock.mockResolvedValueOnce([MESSAGE]).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePoll = resolve;
        }),
    );
    invoiceMock.mockResolvedValue({ pr: 'lnbc21n1test', amountSats: 21, messageId: 'gift-1' });
    const gift: ConversationMessage = {
      id: 'gift-1',
      name: 'Ada',
      text: 'For you',
      createdAt: '2026-08-28T14:00:00.000Z',
      fromMe: true,
      sats: 21,
    };
    const view = renderWithLocale(<InboxLoader />);
    expect(await screen.findByText('Hello')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: '  For you  ' } });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => {
      expect(invoiceMock).toHaveBeenCalledWith('sess', 'conv-1', 21, 'For you');
      expect(screen.getByText('Pay ₿21')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Send' }).hasAttribute('disabled')).toBe(false);
    });
    const pollCall = threadMock.mock.calls[1];
    expect(pollCall?.[0]).toBe('sess');
    expect(pollCall?.[1]).toBe('conv-1');
    expect(pollCall?.[2]?.sinceMessageId).toBe('gift-1');
    expect(pollCall?.[2]?.signal).toBeInstanceOf(AbortSignal);
    await act(async () => {
      resolvePoll?.([MESSAGE, gift]);
    });
    await waitFor(() => {
      expect(screen.getByText('For you')).toBeTruthy();
      expect(screen.queryByText('Pay ₿21')).toBeNull();
      expect((screen.getByLabelText('Your message') as HTMLTextAreaElement).value).toBe('');
      expect((screen.getByLabelText('Amount') as HTMLInputElement).value).toBe('');
    });
    searchParams.delete('c');
    view.rerender(<InboxLoader />);
    expect(await screen.findByText('You: For you')).toBeTruthy();
  });

  it('does not mint a second invoice while the paid-row poll is live', async () => {
    searchParams.set('c', 'conv-1');
    listMock.mockResolvedValue([THREAD, OLDER]);
    threadMock
      .mockResolvedValueOnce([MESSAGE])
      .mockImplementationOnce(() => new Promise(() => undefined));
    invoiceMock.mockResolvedValue({ pr: 'lnbc21n1test', amountSats: 21, messageId: 'gift-1' });
    renderWithLocale(<InboxLoader />);
    expect(await screen.findByText('Hello')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: '  For you  ' } });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => {
      expect(invoiceMock).toHaveBeenCalledWith('sess', 'conv-1', 21, 'For you');
      expect(screen.getByText('Pay ₿21')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Send' }).hasAttribute('disabled')).toBe(false);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(invoiceMock).toHaveBeenCalledTimes(1);
  });

  it('does not mint a second invoice while a mint is in flight', async () => {
    searchParams.set('c', 'conv-1');
    listMock.mockResolvedValue([THREAD]);
    threadMock.mockResolvedValue([MESSAGE]);
    invoiceMock.mockImplementation(() => new Promise(() => undefined));
    renderWithLocale(<InboxLoader />);
    expect(await screen.findByLabelText('Amount')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => {
      expect(invoiceMock).toHaveBeenCalledTimes(1);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(invoiceMock).toHaveBeenCalledTimes(1);
  });

  it('mints an amount-only invoice and falls back to the last paid row', async () => {
    searchParams.set('c', 'conv-1');
    listMock.mockResolvedValue([THREAD]);
    const gift: ConversationMessage = {
      id: 'gift-2',
      name: 'Ada',
      text: '',
      createdAt: '2026-08-28T14:00:00.000Z',
      fromMe: true,
      sats: 1,
    };
    threadMock.mockResolvedValueOnce([MESSAGE]).mockResolvedValueOnce([MESSAGE, gift]);
    invoiceMock.mockResolvedValue({ pr: 'lnbc1n1test', amountSats: 1, messageId: 'missing' });
    renderWithLocale(<InboxLoader />);
    expect(await screen.findByText('Hello')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => {
      expect(invoiceMock).toHaveBeenCalledWith('sess', 'conv-1', 1, undefined);
      expect(screen.getByText('send ₿1')).toBeTruthy();
    });
  });

  it('posts when the opened id is not in the conversation list', async () => {
    searchParams.set('c', 'missing');
    let resolveList: ((value: Conversation[]) => void) | undefined;
    listMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveList = resolve;
        }),
    );
    threadMock.mockResolvedValue([MESSAGE]);
    postMock.mockResolvedValue({
      id: 'm2',
      name: 'Ada',
      text: 'Follow up',
      createdAt: '2026-08-28T13:00:00.000Z',
      fromMe: true,
      sats: 0,
    });
    renderWithLocale(<InboxLoader />);
    expect(await screen.findByText('Hello')).toBeTruthy();
    resolveList?.([THREAD]);
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Follow up' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('sess', 'missing', 'Follow up');
      expect(screen.getByText('Follow up')).toBeTruthy();
    });
  });

  it('validates empty and too-long drafts', async () => {
    searchParams.set('c', 'conv-1');
    listMock.mockResolvedValue([THREAD]);
    threadMock.mockResolvedValue([MESSAGE]);
    renderWithLocale(<InboxLoader />);
    expect(await screen.findByLabelText('Your message')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(screen.getByRole('alert').textContent).toBe('Enter a message');
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'a'.repeat(501) } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(screen.getByRole('alert').textContent).toBe('Keep it to 500 characters');
    expect(postMock).not.toHaveBeenCalled();
  });

  it('rejects invalid and unsafe amount drafts', async () => {
    searchParams.set('c', 'conv-1');
    listMock.mockResolvedValue([THREAD]);
    threadMock.mockResolvedValue([MESSAGE]);
    renderWithLocale(<InboxLoader />);
    expect(await screen.findByLabelText('Amount')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '1.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(screen.getByRole('alert').textContent).toBe('Enter a whole number greater than zero');
    fireEvent.change(screen.getByLabelText('Amount'), {
      target: { value: '999999999999999999999999' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(screen.getByRole('alert').textContent).toBe('Enter a whole number greater than zero');
    expect(invoiceMock).not.toHaveBeenCalled();
  });

  it.each([
    ['Too many payments', 'Too many payments. Please wait a moment and try again.'],
    [
      "Author's wallet cannot receive this Bitcoin payment",
      "The author's wallet cannot receive this Bitcoin payment",
    ],
    ['boom', 'Could not send your message'],
  ])('maps invoice mint error %s', async (message, expected) => {
    searchParams.set('c', 'conv-1');
    listMock.mockResolvedValue([THREAD]);
    threadMock.mockResolvedValue([MESSAGE]);
    invoiceMock.mockRejectedValue(new Error(message));
    renderWithLocale(<InboxLoader />);
    expect(await screen.findByLabelText('Amount')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText(expected)).toBeTruthy();
  });

  it('aborts the paid-row poll when the pay sheet is cancelled', async () => {
    searchParams.set('c', 'conv-1');
    listMock.mockResolvedValue([THREAD]);
    threadMock.mockResolvedValueOnce([MESSAGE]).mockImplementationOnce((_session, _id, opts) => {
      return new Promise((_, reject) => {
        opts?.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    });
    invoiceMock.mockResolvedValue({ pr: 'lnbc21n1test', amountSats: 21, messageId: 'gift-1' });
    renderWithLocale(<InboxLoader />);
    expect(await screen.findByLabelText('Amount')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText('Pay ₿21')).toBeTruthy();
    const signal = threadMock.mock.calls[1]?.[2]?.signal;
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(signal?.aborted).toBe(true);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText('Pay ₿21')).toBeNull();
  });

  it('shows a request error when the paid-row poll fails', async () => {
    searchParams.set('c', 'conv-1');
    listMock.mockResolvedValue([THREAD]);
    threadMock.mockResolvedValueOnce([MESSAGE]).mockRejectedValueOnce(new Error('boom'));
    invoiceMock.mockResolvedValue({ pr: 'lnbc21n1test', amountSats: 21, messageId: 'gift-1' });
    renderWithLocale(<InboxLoader />);
    expect(await screen.findByLabelText('Amount')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText('Could not send your message')).toBeTruthy();
    expect(screen.queryByText('Pay ₿21')).toBeNull();
  });

  it('aborts and resets invoice state when ?c= changes', async () => {
    searchParams.set('c', 'conv-1');
    listMock.mockResolvedValue([THREAD, OLDER]);
    threadMock
      .mockResolvedValueOnce([MESSAGE])
      .mockImplementationOnce(() => new Promise(() => undefined));
    invoiceMock.mockResolvedValue({ pr: 'lnbc21n1test', amountSats: 21, messageId: 'gift-1' });
    const view = renderWithLocale(<InboxLoader />);
    expect(await screen.findByLabelText('Amount')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText('Pay ₿21')).toBeTruthy();
    const signal = threadMock.mock.calls[1]?.[2]?.signal;
    threadMock.mockImplementationOnce(() => new Promise(() => undefined));
    searchParams.set('c', 'conv-2');
    view.rerender(<InboxLoader />);
    expect(signal?.aborted).toBe(true);
    expect(screen.queryByText('Pay ₿21')).toBeNull();
    expect((screen.getByLabelText('Amount') as HTMLInputElement).value).toBe('');
  });

  it('drops a late invoice mint after the open thread changes', async () => {
    searchParams.set('c', 'conv-1');
    listMock.mockResolvedValue([THREAD, OLDER]);
    threadMock.mockResolvedValue([MESSAGE]);
    let resolveMint:
      ((value: { pr: string; amountSats: number; messageId: string }) => void) | undefined;
    invoiceMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveMint = resolve;
        }),
    );
    const view = renderWithLocale(<InboxLoader />);
    expect(await screen.findByLabelText('Amount')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    searchParams.set('c', 'conv-2');
    view.rerender(<InboxLoader />);
    await act(async () => {
      resolveMint?.({ pr: 'lnbc21n1test', amountSats: 21, messageId: 'gift-late' });
    });
    expect(screen.queryByText('Pay ₿21')).toBeNull();
  });

  it('drops a late paid-row poll after the open thread changes', async () => {
    searchParams.set('c', 'conv-1');
    listMock.mockResolvedValue([THREAD, OLDER]);
    let resolvePoll: ((value: ConversationMessage[]) => void) | undefined;
    threadMock.mockResolvedValueOnce([MESSAGE]).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePoll = resolve;
        }),
    );
    invoiceMock.mockResolvedValue({ pr: 'lnbc21n1test', amountSats: 21, messageId: 'gift-1' });
    const view = renderWithLocale(<InboxLoader />);
    expect(await screen.findByLabelText('Amount')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText('Pay ₿21')).toBeTruthy();
    searchParams.set('c', 'conv-2');
    view.rerender(<InboxLoader />);
    await act(async () => {
      resolvePoll?.([
        MESSAGE,
        {
          id: 'gift-1',
          name: 'Ada',
          text: 'late',
          createdAt: '2026-08-28T14:00:00.000Z',
          fromMe: true,
          sats: 21,
        },
      ]);
    });
    expect(screen.queryByText('late')).toBeNull();
  });

  it('shows a post error', async () => {
    searchParams.set('c', 'conv-1');
    listMock.mockResolvedValue([THREAD]);
    threadMock.mockResolvedValue([MESSAGE]);
    postMock.mockRejectedValue(new Error('boom'));
    renderWithLocale(<InboxLoader />);
    expect(await screen.findByLabelText('Your message')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Hi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe('Could not send your message');
  });

  it('retries a failed thread fetch and goes back', async () => {
    searchParams.set('c', 'conv-1');
    listMock.mockResolvedValue([THREAD]);
    threadMock.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce([MESSAGE]);
    renderWithLocale(<InboxLoader />);
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Hello')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'All conversations' }));
    expect(push).toHaveBeenCalledWith('/messages');
  });

  it('clears stale messages immediately when opening another conversation', async () => {
    searchParams.set('c', 'conv-1');
    listMock.mockResolvedValue([THREAD, OLDER]);
    threadMock
      .mockResolvedValueOnce([MESSAGE])
      .mockImplementationOnce(() => new Promise(() => undefined));
    const view = renderWithLocale(<InboxLoader />);
    expect(await screen.findByText('Hello')).toBeTruthy();
    searchParams.set('c', 'conv-2');
    view.rerender(
      <LocaleProvider locale="en" messages={getCatalog('en')}>
        <ThemeProvider>
          <InboxLoader />
        </ThemeProvider>
      </LocaleProvider>,
    );
    expect(screen.queryByText('Hello')).toBeNull();
    expect(screen.getByText('Loading…')).toBeTruthy();
  });

  it('does not apply a posted message after switching conversations', async () => {
    searchParams.set('c', 'conv-1');
    listMock.mockResolvedValue([THREAD, OLDER]);
    threadMock
      .mockResolvedValueOnce([MESSAGE])
      .mockImplementationOnce(() => new Promise(() => undefined));
    let resolvePost: ((value: ConversationMessage) => void) | undefined;
    postMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePost = resolve;
        }),
    );
    const view = renderWithLocale(<InboxLoader />);
    expect(await screen.findByText('Hello')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Follow up' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('sess', 'conv-1', 'Follow up');
    });
    searchParams.set('c', 'conv-2');
    view.rerender(
      <LocaleProvider locale="en" messages={getCatalog('en')}>
        <ThemeProvider>
          <InboxLoader />
        </ThemeProvider>
      </LocaleProvider>,
    );
    expect(screen.queryByText('Hello')).toBeNull();
    await act(async () => {
      resolvePost?.({
        id: 'm2',
        name: 'Ada',
        text: 'Follow up',
        createdAt: '2026-08-28T13:00:00.000Z',
        fromMe: true,
        sats: 0,
      });
    });
    expect(screen.queryByText('Follow up')).toBeNull();
    expect(screen.queryByText('Hello')).toBeNull();
  });

  it('does not apply a post error after switching conversations', async () => {
    searchParams.set('c', 'conv-1');
    listMock.mockResolvedValue([THREAD, OLDER]);
    threadMock
      .mockResolvedValueOnce([MESSAGE])
      .mockImplementationOnce(() => new Promise(() => undefined));
    let rejectPost: ((reason: Error) => void) | undefined;
    postMock.mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectPost = reject;
        }),
    );
    const view = renderWithLocale(<InboxLoader />);
    expect(await screen.findByText('Hello')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Hi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => {
      expect(postMock).toHaveBeenCalled();
    });
    searchParams.set('c', 'conv-2');
    view.rerender(
      <LocaleProvider locale="en" messages={getCatalog('en')}>
        <ThemeProvider>
          <InboxLoader />
        </ThemeProvider>
      </LocaleProvider>,
    );
    await act(async () => {
      rejectPost?.(new Error('boom'));
    });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText('Hello')).toBeNull();
  });
});
