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

vi.mock('@/lib/forum-photo', () => ({
  prepareForumPhoto: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  fetchConversations: vi.fn(),
  fetchConversation: vi.fn(),
  fetchModeratorGroup: vi.fn(),
  postConversationInvoice: vi.fn(),
  markConversationRead: vi.fn(),
  postConversationMessage: vi.fn(),
  fetchConversationMessagePhoto: vi.fn(),
  fetchGiftStats: vi.fn().mockResolvedValue({ spendOverTime: [] }),
  CONVERSATION_LIVE_POLL_MS: 5_000,
}));
vi.mock('@/lib/app-badge', () => ({
  bumpUnreadAppBadgeEpoch: vi.fn(),
  refreshUnreadAppBadge: vi.fn(),
  setUnreadAppBadge: vi.fn(),
}));

import {
  fetchConversation,
  fetchConversationMessagePhoto,
  fetchConversations,
  fetchGiftStats,
  fetchModeratorGroup,
  postConversationInvoice,
  markConversationRead,
  postConversationMessage,
} from '@/lib/api';
import { bumpUnreadAppBadgeEpoch, refreshUnreadAppBadge } from '@/lib/app-badge';
import { prepareForumPhoto } from '@/lib/forum-photo';

const listMock = vi.mocked(fetchConversations);
const threadMock = vi.mocked(fetchConversation);
const groupMock = vi.mocked(fetchModeratorGroup);
const invoiceMock = vi.mocked(postConversationInvoice);
const markReadMock = vi.mocked(markConversationRead);
const postMock = vi.mocked(postConversationMessage);
const giftStatsMock = vi.mocked(fetchGiftStats);
const bumpMock = vi.mocked(bumpUnreadAppBadgeEpoch);
const refreshMock = vi.mocked(refreshUnreadAppBadge);
const photoMock = vi.mocked(fetchConversationMessagePhoto);
const prepareMock = vi.mocked(prepareForumPhoto);

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
  aboutMeHasPhoto: false,
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
  unreadMessageCount: 0,
  unread: false,
};

const OLDER: Conversation = {
  id: 'conv-2',
  kind: 'member_member',
  name: 'Bob',
  lastText: 'Older',
  lastAt: '2026-08-27T12:00:00.000Z',
  lastFromMe: false,
  lastSats: 0,
  unreadMessageCount: 0,
  unread: false,
};

const MESSAGE: ConversationMessage = {
  id: 'm1',
  name: 'Ada',
  text: 'Hello',
  createdAt: '2026-08-28T12:00:00.000Z',
  fromMe: false,
  sats: 0,
  hasPhoto: false,
  photoCount: 0,
};

type ConversationPage = Awaited<ReturnType<typeof fetchConversation>>;

function conversationPage(
  messages: ConversationMessage[],
  nextCursor: string | null = null,
): ConversationPage {
  return { messages, nextCursor };
}

beforeEach(() => {
  vi.clearAllMocks();
  push.mockReset();
  searchParams.delete('c');
  markReadMock.mockResolvedValue(undefined);
  refreshMock.mockResolvedValue(undefined);
  groupMock.mockResolvedValue({
    id: 'conv-mods',
    kind: 'moderator_group',
    name: 'Moderators',
    lastText: '',
    lastAt: '2026-08-28T15:00:00.000Z',
    lastFromMe: false,
    lastSats: 0,
    unreadMessageCount: 0,
    unread: false,
  });
  giftStatsMock.mockReset();
  giftStatsMock.mockResolvedValue({ spendOverTime: [] } as never);
  photoMock.mockResolvedValue(new Blob(['jpeg'], { type: 'image/jpeg' }));
  prepareMock.mockResolvedValue({
    ok: true,
    photo: { contentType: 'image/jpeg', data: 'abc', previewUrl: 'data:image/jpeg;base64,abc' },
  });
  useAuthStore.setState({ session: 'sess', account });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

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
    threadMock.mockResolvedValue(conversationPage([MESSAGE]));
    const view = renderWithLocale(<InboxLoader />);
    expect(await screen.findByRole('heading', { name: '21.gifts' })).toBeTruthy();
    searchParams.set('c', 'conv-2');
    view.rerender(<InboxLoader />);
    expect(await screen.findByRole('heading', { name: 'Bob' })).toBeTruthy();
  });

  it('opens a thread from ?c= and posts a reply', async () => {
    searchParams.set('c', 'conv-1');
    listMock.mockResolvedValue([THREAD, OLDER]);
    threadMock.mockResolvedValue(conversationPage([MESSAGE]));
    postMock.mockResolvedValue({
      id: 'm2',
      name: 'Ada',
      text: 'Follow up',
      createdAt: '2026-08-28T13:00:00.000Z',
      fromMe: true,
      sats: 0,
      hasPhoto: false,
      photoCount: 0,
    });
    renderWithLocale(<InboxLoader />);
    expect(await screen.findByRole('heading', { name: '21.gifts' })).toBeTruthy();
    expect(await screen.findByText('Hello')).toBeTruthy();
    await waitFor(() => {
      expect(markReadMock).toHaveBeenCalledWith('sess', 'conv-1');
    });
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: '  Follow up  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('sess', 'conv-1', 'Follow up');
      expect(screen.getByText('Follow up')).toBeTruthy();
      expect(screen.getByText('You')).toBeTruthy();
      expect(document.querySelector('[data-from-me="true"]')).toBeTruthy();
    });
    expect(invoiceMock).not.toHaveBeenCalled();
  });

  it('mints an amount invoice, clears posting before polling, and applies the paid row', async () => {
    searchParams.set('c', 'conv-1');
    listMock.mockResolvedValue([{ ...THREAD, unread: true, unreadMessageCount: 2 }, OLDER]);
    let resolvePoll: ((value: ConversationPage) => void) | undefined;
    threadMock.mockResolvedValueOnce(conversationPage([MESSAGE])).mockImplementationOnce(
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
      hasPhoto: false,
      photoCount: 0,
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
      resolvePoll?.(conversationPage([MESSAGE, gift]));
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
    const row = screen.getByRole('button', { name: /21\.gifts/ });
    expect(row.getAttribute('aria-label')).toBeNull();
    expect(screen.queryByRole('button', { name: '21.gifts, 2 unread' })).toBeNull();
  });

  it('clears unread on the list row after a paid gift when the thread fetch had failed', async () => {
    searchParams.set('c', 'conv-1');
    listMock.mockResolvedValue([{ ...THREAD, unread: true, unreadMessageCount: 2 }]);
    threadMock.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(
      conversationPage([
        {
          id: 'gift-1',
          name: 'Ada',
          text: '',
          createdAt: '2026-08-28T14:00:00.000Z',
          fromMe: true,
          sats: 21,
          hasPhoto: false,
          photoCount: 0,
        },
      ]),
    );
    invoiceMock.mockResolvedValue({ pr: 'lnbc21n1test', amountSats: 21, messageId: 'gift-1' });
    const view = renderWithLocale(<InboxLoader />);
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => {
      expect(invoiceMock).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.queryByText('Pay ₿21')).toBeNull();
    });
    searchParams.delete('c');
    view.rerender(<InboxLoader />);
    const row = await screen.findByRole('button', { name: /21\.gifts/ });
    expect(row.getAttribute('aria-label')).toBeNull();
    expect(screen.queryByRole('button', { name: '21.gifts, 2 unread' })).toBeNull();
  });

  it('does not mint a second invoice while the paid-row poll is live', async () => {
    searchParams.set('c', 'conv-1');
    listMock.mockResolvedValue([THREAD, OLDER]);
    threadMock
      .mockResolvedValueOnce(conversationPage([MESSAGE]))
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
    threadMock.mockResolvedValue(conversationPage([MESSAGE]));
    invoiceMock.mockImplementation(() => new Promise(() => undefined));
    renderWithLocale(<InboxLoader />);
    expect(await screen.findByLabelText('Amount')).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Send' }).hasAttribute('disabled')).toBe(false);
    });
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
      hasPhoto: false,
      photoCount: 0,
    };
    threadMock
      .mockResolvedValueOnce(conversationPage([MESSAGE]))
      .mockResolvedValueOnce(conversationPage([MESSAGE, gift]));
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

  it('opens a thread when the opened id is not in the conversation list', async () => {
    searchParams.set('c', 'missing');
    listMock.mockResolvedValue([THREAD]);
    threadMock.mockResolvedValue(conversationPage([MESSAGE]));
    renderWithLocale(<InboxLoader />);
    expect(await screen.findByLabelText('Your message')).toBeTruthy();
    await waitFor(() => {
      expect(threadMock).toHaveBeenCalledWith('sess', 'missing');
    });
  });

  it('validates empty and too-long drafts', async () => {
    searchParams.set('c', 'conv-1');
    listMock.mockResolvedValue([THREAD]);
    threadMock.mockResolvedValue(conversationPage([MESSAGE]));
    renderWithLocale(<InboxLoader />);
    expect(await screen.findByLabelText('Your message')).toBeTruthy();
    expect(await screen.findByText('Hello')).toBeTruthy();
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
    threadMock.mockResolvedValue(conversationPage([MESSAGE]));
    renderWithLocale(<InboxLoader />);
    expect(await screen.findByLabelText('Amount')).toBeTruthy();
    expect(await screen.findByText('Hello')).toBeTruthy();
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
    threadMock.mockResolvedValue(conversationPage([MESSAGE]));
    invoiceMock.mockRejectedValue(new Error(message));
    renderWithLocale(<InboxLoader />);
    expect(await screen.findByLabelText('Amount')).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Send' }).hasAttribute('disabled')).toBe(false);
    });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText(expected)).toBeTruthy();
  });

  it('aborts the paid-row poll when the pay sheet is cancelled', async () => {
    searchParams.set('c', 'conv-1');
    listMock.mockResolvedValue([THREAD]);
    threadMock
      .mockResolvedValueOnce(conversationPage([MESSAGE]))
      .mockImplementationOnce((_session, _id, opts) => {
        return new Promise((_, reject) => {
          opts?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        });
      });
    invoiceMock.mockResolvedValue({ pr: 'lnbc21n1test', amountSats: 21, messageId: 'gift-1' });
    renderWithLocale(<InboxLoader />);
    expect(await screen.findByLabelText('Amount')).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Send' }).hasAttribute('disabled')).toBe(false);
    });
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
    threadMock
      .mockResolvedValueOnce(conversationPage([MESSAGE]))
      .mockRejectedValueOnce(new Error('boom'));
    invoiceMock.mockResolvedValue({ pr: 'lnbc21n1test', amountSats: 21, messageId: 'gift-1' });
    renderWithLocale(<InboxLoader />);
    expect(await screen.findByLabelText('Amount')).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Send' }).hasAttribute('disabled')).toBe(false);
    });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText('Could not send your message')).toBeTruthy();
    expect(screen.queryByText('Pay ₿21')).toBeNull();
  });

  it('aborts and resets invoice state when ?c= changes', async () => {
    searchParams.set('c', 'conv-1');
    listMock.mockResolvedValue([THREAD, OLDER]);
    threadMock
      .mockResolvedValueOnce(conversationPage([MESSAGE]))
      .mockImplementationOnce(() => new Promise(() => undefined));
    invoiceMock.mockResolvedValue({ pr: 'lnbc21n1test', amountSats: 21, messageId: 'gift-1' });
    const view = renderWithLocale(<InboxLoader />);
    expect(await screen.findByLabelText('Amount')).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Send' }).hasAttribute('disabled')).toBe(false);
    });
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
    threadMock.mockResolvedValue(conversationPage([MESSAGE]));
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
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Send' }).hasAttribute('disabled')).toBe(false);
    });
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
    let resolvePoll: ((value: ConversationPage) => void) | undefined;
    threadMock.mockResolvedValueOnce(conversationPage([MESSAGE])).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePoll = resolve;
        }),
    );
    invoiceMock.mockResolvedValue({ pr: 'lnbc21n1test', amountSats: 21, messageId: 'gift-1' });
    const view = renderWithLocale(<InboxLoader />);
    expect(await screen.findByLabelText('Amount')).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Send' }).hasAttribute('disabled')).toBe(false);
    });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText('Pay ₿21')).toBeTruthy();
    searchParams.set('c', 'conv-2');
    view.rerender(<InboxLoader />);
    await act(async () => {
      resolvePoll?.(
        conversationPage([
          MESSAGE,
          {
            id: 'gift-1',
            name: 'Ada',
            text: 'late',
            createdAt: '2026-08-28T14:00:00.000Z',
            fromMe: true,
            sats: 21,
            hasPhoto: false,
            photoCount: 0,
          },
        ]),
      );
    });
    expect(screen.queryByText('late')).toBeNull();
  });

  it('shows a post error', async () => {
    searchParams.set('c', 'conv-1');
    listMock.mockResolvedValue([THREAD]);
    threadMock.mockResolvedValue(conversationPage([MESSAGE]));
    postMock.mockRejectedValue(new Error('boom'));
    renderWithLocale(<InboxLoader />);
    expect(await screen.findByLabelText('Your message')).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Send' }).hasAttribute('disabled')).toBe(false);
    });
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Hi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe('Could not send your message');
  });

  it('retries a failed thread fetch', async () => {
    searchParams.set('c', 'conv-1');
    listMock.mockResolvedValue([THREAD]);
    threadMock
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(conversationPage([MESSAGE]));
    renderWithLocale(<InboxLoader />);
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Hello')).toBeTruthy();
  });

  it('clears stale messages immediately when opening another conversation', async () => {
    searchParams.set('c', 'conv-1');
    listMock.mockResolvedValue([THREAD, OLDER]);
    threadMock.mockImplementation((_session: string, id: string) => {
      if (id === 'conv-2') {
        return new Promise(() => undefined);
      }
      return Promise.resolve(conversationPage([MESSAGE]));
    });
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
    threadMock.mockImplementation((_session: string, id: string) => {
      if (id === 'conv-2') {
        return new Promise(() => undefined);
      }
      return Promise.resolve(conversationPage([MESSAGE]));
    });
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
        hasPhoto: false,
        photoCount: 0,
      });
    });
    expect(screen.queryByText('Follow up')).toBeNull();
    expect(screen.queryByText('Hello')).toBeNull();
  });

  it('does not apply a post error after switching conversations', async () => {
    searchParams.set('c', 'conv-1');
    listMock.mockResolvedValue([THREAD, OLDER]);
    threadMock.mockImplementation((_session: string, id: string) => {
      if (id === 'conv-2') {
        return new Promise(() => undefined);
      }
      return Promise.resolve(conversationPage([MESSAGE]));
    });
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

  it('still renders the thread when markConversationRead fails', async () => {
    searchParams.set('c', 'conv-1');
    listMock.mockResolvedValue([{ ...THREAD, unread: true }]);
    threadMock.mockResolvedValue(conversationPage([MESSAGE]));
    markReadMock.mockRejectedValue(new Error('boom'));
    renderWithLocale(<InboxLoader />);
    expect(await screen.findByText('Hello')).toBeTruthy();
    await waitFor(() => {
      expect(markReadMock).toHaveBeenCalledWith('sess', 'conv-1');
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('clears unread on the list row after opening a thread', async () => {
    searchParams.set('c', 'conv-1');
    listMock.mockResolvedValue([{ ...THREAD, unread: true, unreadMessageCount: 2 }]);
    threadMock.mockResolvedValue(conversationPage([MESSAGE]));
    const view = renderWithLocale(<InboxLoader />);
    expect(await screen.findByText('Hello')).toBeTruthy();
    await waitFor(() => {
      expect(markReadMock).toHaveBeenCalledWith('sess', 'conv-1');
    });
    await waitFor(() => {
      expect(bumpMock).toHaveBeenCalled();
      expect(refreshMock).toHaveBeenCalled();
    });
    searchParams.delete('c');
    view.rerender(<InboxLoader />);
    const row = await screen.findByRole('button', { name: /21\.gifts/ });
    expect(row.getAttribute('aria-label')).toBeNull();
    expect(screen.queryByRole('button', { name: '21.gifts, 2 unread' })).toBeNull();
  });

  it('passes remaining inbox unread after opening one of two unread threads', async () => {
    listMock.mockResolvedValue([
      { ...THREAD, unread: true },
      { ...OLDER, unread: true },
    ]);
    threadMock.mockResolvedValue(conversationPage([MESSAGE]));
    const view = renderWithLocale(<InboxLoader />);
    expect(await screen.findByText('21.gifts')).toBeTruthy();
    searchParams.set('c', 'conv-1');
    view.rerender(<InboxLoader />);
    expect(await screen.findByText('Hello')).toBeTruthy();
    await waitFor(() => {
      expect(refreshMock).toHaveBeenCalledWith('sess', 1);
    });
    expect(bumpMock).toHaveBeenCalled();
  });

  it('passes remaining inbox unread 0 when only the opened row was unread', async () => {
    listMock.mockResolvedValue([{ ...THREAD, unread: true }, OLDER]);
    threadMock.mockResolvedValue(conversationPage([MESSAGE]));
    const view = renderWithLocale(<InboxLoader />);
    expect(await screen.findByText('21.gifts')).toBeTruthy();
    searchParams.set('c', 'conv-1');
    view.rerender(<InboxLoader />);
    expect(await screen.findByText('Hello')).toBeTruthy();
    await waitFor(() => {
      expect(refreshMock).toHaveBeenCalledWith('sess', 0);
    });
  });

  it('still renders the thread when refreshUnreadAppBadge rejects', async () => {
    searchParams.set('c', 'conv-1');
    listMock.mockResolvedValue([THREAD]);
    threadMock.mockResolvedValue(conversationPage([MESSAGE]));
    refreshMock.mockRejectedValue(new Error('boom'));
    renderWithLocale(<InboxLoader />);
    expect(await screen.findByText('Hello')).toBeTruthy();
    await waitFor(() => {
      expect(refreshMock).toHaveBeenCalled();
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('does not fetch a moderator_group thread from ?c=', async () => {
    searchParams.set('c', 'group-id');
    listMock.mockResolvedValue([
      OLDER,
      THREAD,
      {
        id: 'group-id',
        kind: 'moderator_group',
        name: 'Staff room',
        lastText: 'Hello mods',
        lastAt: '2026-08-28T15:00:00.000Z',
        lastFromMe: false,
        lastSats: 0,
        unreadMessageCount: 0,
        unread: false,
      },
    ]);
    renderWithLocale(<InboxLoader />);
    expect(await screen.findByText('Bob')).toBeTruthy();
    await act(async () => {
      await Promise.resolve();
    });
    expect(threadMock).not.toHaveBeenCalled();
    expect(screen.queryByText('Staff room')).toBeNull();
    expect(screen.queryByText('Hello mods')).toBeNull();
  });

  it.each(['founder', 'moderator'] as const)(
    'opens an unlisted PM for a %s after the staff-room id differs',
    async (role) => {
      useAuthStore.setState({
        session: 'sess',
        account: { ...account, role },
      });
      searchParams.set('c', 'missing');
      listMock.mockResolvedValue([THREAD]);
      threadMock.mockResolvedValue(conversationPage([MESSAGE]));
      renderWithLocale(<InboxLoader />);
      expect(await screen.findByLabelText('Your message')).toBeTruthy();
      expect(groupMock).toHaveBeenCalledWith('sess');
      await waitFor(() => {
        expect(threadMock).toHaveBeenCalledWith('sess', 'missing');
      });
    },
  );

  it.each(['founder', 'moderator'] as const)(
    'shows neutral loading, not the list, while the staff-room lookup runs as %s',
    async (role) => {
      useAuthStore.setState({
        session: 'sess',
        account: { ...account, role },
      });
      searchParams.set('c', 'missing');
      listMock.mockResolvedValue([OLDER]);
      threadMock.mockResolvedValue(conversationPage([MESSAGE]));
      let resolveGroup!: (value: Conversation) => void;
      groupMock.mockImplementation(
        () =>
          new Promise<Conversation>((resolve) => {
            resolveGroup = resolve;
          }),
      );
      renderWithLocale(<InboxLoader />);
      await waitFor(() => {
        expect(groupMock).toHaveBeenCalledTimes(1);
      });
      expect(screen.getByText('Loading…')).toBeTruthy();
      expect(screen.queryByRole('list', { name: 'Conversations' })).toBeNull();
      expect(threadMock).not.toHaveBeenCalled();
      await act(async () => {
        resolveGroup({ ...THREAD, id: 'conv-mods', kind: 'moderator_group', name: 'Moderators' });
      });
      expect(await screen.findByText('Hello')).toBeTruthy();
      expect(groupMock).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['founder', 'moderator'] as const)(
    'opens an unlisted PM when the staff-room fetch fails as %s',
    async (role) => {
      useAuthStore.setState({
        session: 'sess',
        account: { ...account, role },
      });
      searchParams.set('c', 'missing');
      listMock.mockResolvedValue([THREAD]);
      threadMock.mockResolvedValue(conversationPage([MESSAGE]));
      groupMock.mockRejectedValue(new Error('boom'));
      renderWithLocale(<InboxLoader />);
      expect(await screen.findByLabelText('Your message')).toBeTruthy();
      await waitFor(() => {
        expect(threadMock).toHaveBeenCalledWith('sess', 'missing');
      });
    },
  );

  it.each(['founder', 'moderator'] as const)(
    'does not open an unlisted staff-room id for a %s',
    async (role) => {
      useAuthStore.setState({
        session: 'sess',
        account: { ...account, role },
      });
      searchParams.set('c', 'conv-mods');
      listMock.mockResolvedValue([THREAD]);
      threadMock.mockResolvedValue(conversationPage([MESSAGE]));
      renderWithLocale(<InboxLoader />);
      expect(await screen.findByRole('heading', { name: 'Messages' })).toBeTruthy();
      await waitFor(() => {
        expect(groupMock).toHaveBeenCalledWith('sess');
      });
      expect(threadMock).not.toHaveBeenCalled();
      expect(screen.queryByLabelText('Your message')).toBeNull();
    },
  );

  it('shows a fiat suffix on a sats message when gift stats resolve', async () => {
    searchParams.set('c', 'conv-1');
    listMock.mockResolvedValue([THREAD]);
    threadMock.mockResolvedValue(conversationPage([{ ...MESSAGE, sats: 21 }]));
    giftStatsMock.mockResolvedValue({
      spendOverTime: [
        {
          sats: 100_000_000,
          usd: '100000.00',
          chf: '80000.00',
          eur: '90000.00',
          php: '5600000.00',
        },
      ],
    } as never);
    renderWithLocale(<InboxLoader />);
    expect(await screen.findByText('Hello')).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByText('$0.02')).toBeTruthy();
    });
    expect(screen.getByText('₿21')).toBeTruthy();
  });

  it('survives a failing stats fetch', async () => {
    searchParams.set('c', 'conv-1');
    listMock.mockResolvedValue([THREAD]);
    threadMock.mockResolvedValue(conversationPage([{ ...MESSAGE, sats: 21 }]));
    giftStatsMock.mockRejectedValueOnce(new Error('stats down'));
    renderWithLocale(<InboxLoader />);
    expect(await screen.findByText('Hello')).toBeTruthy();
    expect(await screen.findByText('₿21')).toBeTruthy();
    await waitFor(() => {
      expect(giftStatsMock).toHaveBeenCalled();
    });
    expect(screen.queryByText('$0.02')).toBeNull();
  });

  it('shows the photo attach control on an open thread and keeps Amount', async () => {
    searchParams.set('c', 'conv-1');
    listMock.mockResolvedValue([THREAD]);
    threadMock.mockResolvedValue(conversationPage([MESSAGE]));
    renderWithLocale(<InboxLoader />);
    expect(await screen.findByRole('button', { name: 'Add a photo' })).toBeTruthy();
    expect(screen.getByLabelText('Amount')).toBeTruthy();
    expect(screen.queryByText('Add a photo')).toBeNull();
  });

  it('hides attach on the conversation list', async () => {
    listMock.mockResolvedValue([THREAD]);
    renderWithLocale(<InboxLoader />);
    expect(await screen.findByText('21.gifts')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add a photo' })).toBeNull();
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });

  it('posts a photo-only message after remove and re-pick', async () => {
    searchParams.set('c', 'conv-1');
    listMock.mockResolvedValue([THREAD]);
    threadMock.mockResolvedValue(conversationPage([MESSAGE]));
    postMock.mockResolvedValue({
      id: 'm-photo',
      name: 'Ada',
      text: '',
      createdAt: '2026-08-28T16:00:00.000Z',
      fromMe: true,
      sats: 0,
      hasPhoto: true,
      photoCount: 1,
    });
    renderWithLocale(<InboxLoader />);
    expect(await screen.findByLabelText('Your message')).toBeTruthy();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'p.jpg', { type: 'image/jpeg' });
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });
    expect(await screen.findByAltText('Selected photo')).toBeTruthy();
    expect(screen.queryByText('Remove photo')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Remove photo' }));
    expect(screen.queryByText('Add a photo')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add a photo' }));
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });
    expect(await screen.findByAltText('Selected photo')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('sess', 'conv-1', '', [
        { contentType: 'image/jpeg', data: 'abc' },
      ]);
    });
    expect(invoiceMock).not.toHaveBeenCalled();
    expect(await screen.findByAltText('Photo from Ada')).toBeTruthy();
  });

  it('sets tooMany when more than 10 stills are chosen', async () => {
    searchParams.set('c', 'conv-1');
    listMock.mockResolvedValue([THREAD]);
    threadMock.mockResolvedValue(conversationPage([MESSAGE]));
    renderWithLocale(<InboxLoader />);
    expect(await screen.findByLabelText('Your message')).toBeTruthy();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const files = Array.from(
      { length: 11 },
      (_, i) => new File([new Uint8Array([0xff, 0xd8, 0xff])], `p${i}.jpg`, { type: 'image/jpeg' }),
    );
    await act(async () => {
      fireEvent.change(input, { target: { files } });
    });
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe('You can add up to 10 photos');
  });

  it('sets tooLarge when prepareForumPhoto returns tooLarge', async () => {
    searchParams.set('c', 'conv-1');
    listMock.mockResolvedValue([THREAD]);
    threadMock.mockResolvedValue(conversationPage([MESSAGE]));
    prepareMock.mockResolvedValueOnce({ ok: false, error: 'tooLarge' });
    renderWithLocale(<InboxLoader />);
    expect(await screen.findByLabelText('Your message')).toBeTruthy();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'p.jpg', { type: 'image/jpeg' });
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe('Keep photos under 1 MB');
  });

  it('sets unsupported when prepareForumPhoto rejects', async () => {
    searchParams.set('c', 'conv-1');
    listMock.mockResolvedValue([THREAD]);
    threadMock.mockResolvedValue(conversationPage([MESSAGE]));
    prepareMock.mockRejectedValueOnce(new Error('decode'));
    renderWithLocale(<InboxLoader />);
    expect(await screen.findByLabelText('Your message')).toBeTruthy();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'p.jpg', { type: 'image/jpeg' });
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe('Use a JPEG, PNG, or WebP photo');
  });

  it('disables send while a still is still being prepared', async () => {
    searchParams.set('c', 'conv-1');
    listMock.mockResolvedValue([THREAD]);
    threadMock.mockResolvedValue(conversationPage([MESSAGE]));
    let resolvePrepare:
      | ((value: {
          ok: true;
          photo: { contentType: 'image/jpeg'; data: string; previewUrl: string };
        }) => void)
      | undefined;
    prepareMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePrepare = resolve;
        }),
    );
    renderWithLocale(<InboxLoader />);
    expect(await screen.findByLabelText('Your message')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Hi' } });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'p.jpg', { type: 'image/jpeg' });
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });
    expect((screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => {
      resolvePrepare?.({
        ok: true,
        photo: { contentType: 'image/jpeg', data: 'abc', previewUrl: 'data:image/jpeg;base64,abc' },
      });
      await Promise.resolve();
    });
    expect((screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('loads a stored photo blob for a hasPhoto row', async () => {
    searchParams.set('c', 'conv-1');
    listMock.mockResolvedValue([THREAD]);
    threadMock.mockResolvedValue(
      conversationPage([
        {
          ...MESSAGE,
          id: 'm-pic',
          text: '',
          hasPhoto: true,
          photoCount: 1,
        },
      ]),
    );
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: () => 'blob:inbox-photo',
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: () => undefined,
    });
    renderWithLocale(<InboxLoader />);
    expect(await screen.findByAltText('Photo from Ada')).toBeTruthy();
    expect(photoMock).toHaveBeenCalledWith('sess', 'conv-1', 'm-pic', 0);
  });

  it('loads a stored photo when hasPhoto is true and photoCount is 0', async () => {
    searchParams.set('c', 'conv-1');
    listMock.mockResolvedValue([THREAD]);
    threadMock.mockResolvedValue(
      conversationPage([
        {
          ...MESSAGE,
          id: 'm-legacy',
          text: '',
          hasPhoto: true,
          photoCount: 0,
        },
      ]),
    );
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: () => 'blob:inbox-legacy',
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: () => undefined,
    });
    renderWithLocale(<InboxLoader />);
    expect(await screen.findByAltText('Photo from Ada')).toBeTruthy();
    expect(photoMock).toHaveBeenCalledWith('sess', 'conv-1', 'm-legacy', 0);
  });

  it('skips a still when the photo fetch fails and loads the next', async () => {
    searchParams.set('c', 'conv-1');
    listMock.mockResolvedValue([THREAD]);
    threadMock.mockResolvedValue(
      conversationPage([
        {
          ...MESSAGE,
          id: 'm-fail',
          text: '',
          hasPhoto: true,
          photoCount: 1,
        },
        {
          ...MESSAGE,
          id: 'm-ok',
          name: 'Bob',
          text: '',
          hasPhoto: true,
          photoCount: 1,
        },
      ]),
    );
    photoMock
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(new Blob(['jpeg'], { type: 'image/jpeg' }));
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: () => 'blob:inbox-next',
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: () => undefined,
    });
    renderWithLocale(<InboxLoader />);
    expect(await screen.findByAltText('Photo from Bob')).toBeTruthy();
    expect(screen.queryByAltText('Photo from Ada')).toBeNull();
    expect(photoMock).toHaveBeenCalledWith('sess', 'conv-1', 'm-fail', 0);
    expect(photoMock).toHaveBeenCalledWith('sess', 'conv-1', 'm-ok', 0);
  });

  it('revokes loaded photo blobs on unmount', async () => {
    searchParams.set('c', 'conv-1');
    listMock.mockResolvedValue([THREAD]);
    threadMock.mockResolvedValue(
      conversationPage([
        {
          ...MESSAGE,
          id: 'm-pic',
          text: '',
          hasPhoto: true,
          photoCount: 1,
        },
      ]),
    );
    const revoke = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: () => 'blob:inbox-photo',
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revoke,
    });
    const view = renderWithLocale(<InboxLoader />);
    expect(await screen.findByAltText('Photo from Ada')).toBeTruthy();
    view.unmount();
    expect(revoke).toHaveBeenCalledWith('blob:inbox-photo');
  });

  it('revokes photo blobs when the session is lost while mounted', async () => {
    searchParams.set('c', 'conv-1');
    listMock.mockResolvedValue([THREAD]);
    threadMock.mockResolvedValue(
      conversationPage([
        {
          ...MESSAGE,
          id: 'm-pic',
          text: '',
          hasPhoto: true,
          photoCount: 1,
        },
      ]),
    );
    const revoke = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: () => 'blob:inbox-photo',
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revoke,
    });
    renderWithLocale(<InboxLoader />);
    expect(await screen.findByAltText('Photo from Ada')).toBeTruthy();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'p.jpg', { type: 'image/jpeg' });
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });
    expect(await screen.findByAltText('Selected photo')).toBeTruthy();
    act(() => {
      useAuthStore.setState({ session: null, account });
    });
    expect(revoke).toHaveBeenCalledWith('blob:inbox-photo');
    expect(screen.queryByAltText('Selected photo')).toBeNull();
    act(() => {
      useAuthStore.setState({ session: 'sess', account });
    });
    expect(await screen.findByAltText('Photo from Ada')).toBeTruthy();
    expect(screen.queryByAltText('Selected photo')).toBeNull();
  });

  it('clears drafts on thread switch and drops a hung prepare', async () => {
    searchParams.set('c', 'conv-1');
    listMock.mockResolvedValue([THREAD, OLDER]);
    threadMock.mockResolvedValue(conversationPage([MESSAGE]));
    let resolvePrepare:
      | ((value: {
          ok: true;
          photo: { contentType: 'image/jpeg'; data: string; previewUrl: string };
        }) => void)
      | undefined;
    prepareMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePrepare = resolve;
        }),
    );
    const view = renderWithLocale(<InboxLoader />);
    expect(await screen.findByLabelText('Your message')).toBeTruthy();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'p.jpg', { type: 'image/jpeg' });
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });
    searchParams.set('c', 'conv-2');
    view.rerender(<InboxLoader />);
    expect(await screen.findByRole('heading', { name: 'Bob' })).toBeTruthy();
    await act(async () => {
      resolvePrepare?.({
        ok: true,
        photo: { contentType: 'image/jpeg', data: 'abc', previewUrl: 'data:image/jpeg;base64,abc' },
      });
      await Promise.resolve();
    });
    expect(screen.queryByAltText('Selected photo')).toBeNull();
    const nextInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(nextInput, { target: { files: [file] } });
    });
    expect(await screen.findByAltText('Selected photo')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('does not clear preparing of a newer pick when an older prepare finishes', async () => {
    searchParams.set('c', 'conv-1');
    listMock.mockResolvedValue([THREAD]);
    threadMock.mockResolvedValue(conversationPage([MESSAGE]));
    let resolveFirst:
      | ((value: {
          ok: true;
          photo: { contentType: 'image/jpeg'; data: string; previewUrl: string };
        }) => void)
      | undefined;
    let resolveSecond:
      | ((value: {
          ok: true;
          photo: { contentType: 'image/jpeg'; data: string; previewUrl: string };
        }) => void)
      | undefined;
    prepareMock
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecond = resolve;
          }),
      );
    renderWithLocale(<InboxLoader />);
    expect(await screen.findByLabelText('Your message')).toBeTruthy();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'p.jpg', { type: 'image/jpeg' });
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });
    expect((screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => {
      resolveFirst?.({
        ok: true,
        photo: { contentType: 'image/jpeg', data: 'abc', previewUrl: 'data:image/jpeg;base64,abc' },
      });
      await Promise.resolve();
    });
    expect((screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => {
      resolveSecond?.({
        ok: true,
        photo: { contentType: 'image/jpeg', data: 'abc', previewUrl: 'data:image/jpeg;base64,abc' },
      });
      await Promise.resolve();
    });
    expect(await screen.findByAltText('Selected photo')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('ignores a pick during the pay sheet and does not leave send disabled after pay', async () => {
    searchParams.set('c', 'conv-1');
    listMock.mockResolvedValue([THREAD]);
    let resolvePoll: ((value: ConversationPage) => void) | undefined;
    threadMock.mockResolvedValueOnce(conversationPage([MESSAGE])).mockImplementationOnce(
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
      hasPhoto: false,
      photoCount: 0,
    };
    renderWithLocale(<InboxLoader />);
    expect(await screen.findByText('Hello')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'For you' } });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => {
      expect(invoiceMock).toHaveBeenCalledWith('sess', 'conv-1', 21, 'For you');
      expect(screen.getByText('Pay ₿21')).toBeTruthy();
    });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'p.jpg', { type: 'image/jpeg' });
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });
    expect(prepareMock).not.toHaveBeenCalled();
    await act(async () => {
      resolvePoll?.(conversationPage([MESSAGE, gift]));
    });
    await waitFor(() => {
      expect(screen.getByText('For you')).toBeTruthy();
      expect(screen.queryByText('Pay ₿21')).toBeNull();
    });
    expect(screen.queryByAltText('Selected photo')).toBeNull();
    expect((screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('mints an amount invoice without attaching selected photos and clears drafts after pay', async () => {
    searchParams.set('c', 'conv-1');
    listMock.mockResolvedValue([THREAD, OLDER]);
    let resolvePoll: ((value: ConversationPage) => void) | undefined;
    threadMock.mockResolvedValueOnce(conversationPage([MESSAGE])).mockImplementationOnce(
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
      hasPhoto: false,
      photoCount: 0,
    };
    renderWithLocale(<InboxLoader />);
    expect(await screen.findByText('Hello')).toBeTruthy();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'p.jpg', { type: 'image/jpeg' });
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });
    expect(await screen.findByAltText('Selected photo')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: '  For you  ' } });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => {
      expect(invoiceMock).toHaveBeenCalledWith('sess', 'conv-1', 21, 'For you');
      expect(screen.getByText('Pay ₿21')).toBeTruthy();
    });
    expect(postMock).not.toHaveBeenCalled();
    await act(async () => {
      resolvePoll?.(conversationPage([MESSAGE, gift]));
    });
    await waitFor(() => {
      expect(screen.getByText('For you')).toBeTruthy();
      expect(screen.queryByText('Pay ₿21')).toBeNull();
      expect(screen.queryByAltText('Selected photo')).toBeNull();
    });
    expect(postMock).not.toHaveBeenCalled();
  });

  it('revokes loaded photo blobs when the open thread id changes', async () => {
    searchParams.set('c', 'conv-1');
    listMock.mockResolvedValue([THREAD, OLDER]);
    threadMock.mockImplementation((_session: string, id: string) => {
      if (id === 'conv-2') {
        return Promise.resolve(conversationPage([MESSAGE]));
      }
      return Promise.resolve(
        conversationPage([
          {
            ...MESSAGE,
            id: 'm-pic',
            text: '',
            hasPhoto: true,
            photoCount: 1,
          },
        ]),
      );
    });
    const revoke = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: () => 'blob:inbox-photo',
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revoke,
    });
    const view = renderWithLocale(<InboxLoader />);
    expect(await screen.findByAltText('Photo from Ada')).toBeTruthy();
    searchParams.set('c', 'conv-2');
    view.rerender(<InboxLoader />);
    expect(revoke).toHaveBeenCalledWith('blob:inbox-photo');
    expect(await screen.findByRole('heading', { name: 'Bob' })).toBeTruthy();
  });

  it('revokes photo blobs that are no longer on the thread', async () => {
    searchParams.set('c', 'conv-1');
    listMock.mockResolvedValue([THREAD]);
    threadMock.mockResolvedValueOnce(
      conversationPage([
        {
          ...MESSAGE,
          id: 'm-pic',
          text: '',
          hasPhoto: true,
          photoCount: 1,
        },
      ]),
    );
    const revoke = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: () => 'blob:inbox-photo',
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revoke,
    });
    renderWithLocale(<InboxLoader />);
    expect(await screen.findByAltText('Photo from Ada')).toBeTruthy();
    threadMock.mockResolvedValueOnce(conversationPage([MESSAGE]));
    act(() => {
      useAuthStore.setState({ session: 'sess-2', account });
    });
    await waitFor(() => {
      expect(revoke).toHaveBeenCalledWith('blob:inbox-photo');
    });
    expect(await screen.findByText('Hello')).toBeTruthy();
    expect(screen.queryByAltText('Photo from Ada')).toBeNull();
  });

  it('does not fetch photos when session is null', () => {
    useAuthStore.setState({ session: null, account });
    searchParams.set('c', 'conv-1');
    listMock.mockResolvedValue([THREAD]);
    threadMock.mockResolvedValue(
      conversationPage([
        {
          ...MESSAGE,
          hasPhoto: true,
          photoCount: 1,
        },
      ]),
    );
    const { container } = renderWithLocale(<InboxLoader />);
    expect(container.firstChild).toBeNull();
    expect(photoMock).not.toHaveBeenCalled();
  });

  it('keeps empty validation and 3-arg text post without photos', async () => {
    searchParams.set('c', 'conv-1');
    listMock.mockResolvedValue([THREAD]);
    threadMock.mockResolvedValue(conversationPage([MESSAGE]));
    postMock.mockResolvedValue({
      id: 'm2',
      name: 'Ada',
      text: 'Follow up',
      createdAt: '2026-08-28T13:00:00.000Z',
      fromMe: true,
      sats: 0,
      hasPhoto: false,
      photoCount: 0,
    });
    renderWithLocale(<InboxLoader />);
    expect(await screen.findByLabelText('Your message')).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Send' }).hasAttribute('disabled')).toBe(false);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(screen.getByRole('alert').textContent).toBe('Enter a message');
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Follow up' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('sess', 'conv-1', 'Follow up');
    });
    expect(postMock.mock.calls[0]?.length).toBe(3);
  });

  function setVisibility(state: DocumentVisibilityState): void {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => state,
    });
  }

  it('appends unseen messages on the visible-tab interval', async () => {
    searchParams.set('c', 'conv-1');
    listMock.mockResolvedValue([THREAD, { ...OLDER, unread: true }]);
    const olderNew: ConversationMessage = {
      ...MESSAGE,
      id: 'm2',
      text: 'Older new',
      createdAt: '2026-08-28T12:30:00.000Z',
    };
    const newer: ConversationMessage = {
      ...MESSAGE,
      id: 'm3',
      text: 'Newer arrival',
      createdAt: '2026-08-28T13:00:00.000Z',
    };
    threadMock
      .mockResolvedValueOnce(conversationPage([MESSAGE]))
      .mockResolvedValue(conversationPage([MESSAGE, olderNew, newer]));
    vi.useFakeTimers({ toFake: ['setInterval'] });
    renderWithLocale(<InboxLoader />);
    expect(await screen.findByText('Hello')).toBeTruthy();
    await waitFor(() => {
      expect(markReadMock).toHaveBeenCalledTimes(1);
    });
    const callsBefore = threadMock.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(await screen.findByText('Newer arrival')).toBeTruthy();
    expect(screen.getByText('Older new')).toBeTruthy();
    expect(
      screen
        .getByText('Older new')
        .compareDocumentPosition(screen.getByText('Newer arrival')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getAllByText('Hello')).toHaveLength(1);
    expect(markReadMock).toHaveBeenCalledTimes(2);
    expect(threadMock.mock.calls.length).toBe(callsBefore + 1);
    expect(threadMock.mock.calls.at(-1)?.[2]).toBeUndefined();
    expect(refreshMock).toHaveBeenCalledWith('sess', 1);
  });

  it('does not mark read again when the poll page has no new id', async () => {
    searchParams.set('c', 'conv-1');
    listMock.mockResolvedValue([THREAD]);
    threadMock.mockResolvedValue(conversationPage([MESSAGE]));
    vi.useFakeTimers({ toFake: ['setInterval'] });
    renderWithLocale(<InboxLoader />);
    expect(await screen.findByText('Hello')).toBeTruthy();
    await waitFor(() => {
      expect(markReadMock).toHaveBeenCalledTimes(1);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(markReadMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Hello')).toBeTruthy();
  });

  it('does not poll a hidden tab and pulls once when it becomes visible', async () => {
    searchParams.set('c', 'conv-1');
    listMock.mockResolvedValue([THREAD]);
    const newer: ConversationMessage = {
      ...MESSAGE,
      id: 'm2',
      text: 'Seen on return',
      createdAt: '2026-08-28T13:00:00.000Z',
    };
    threadMock
      .mockResolvedValueOnce(conversationPage([MESSAGE]))
      .mockResolvedValue(conversationPage([MESSAGE, newer]));
    vi.useFakeTimers({ toFake: ['setInterval'] });
    try {
      renderWithLocale(<InboxLoader />);
      expect(await screen.findByText('Hello')).toBeTruthy();
      const callsBefore = threadMock.mock.calls.length;
      setVisibility('hidden');
      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
        await vi.advanceTimersByTimeAsync(5_000);
      });
      expect(threadMock.mock.calls.length).toBe(callsBefore);
      expect(screen.queryByText('Seen on return')).toBeNull();
      setVisibility('visible');
      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
      expect(await screen.findByText('Seen on return')).toBeTruthy();
      expect(threadMock.mock.calls.length).toBe(callsBefore + 1);
    } finally {
      setVisibility('visible');
    }
  });

  it('keeps the thread when a live poll fails', async () => {
    searchParams.set('c', 'conv-1');
    listMock.mockResolvedValue([THREAD]);
    threadMock
      .mockResolvedValueOnce(conversationPage([MESSAGE]))
      .mockRejectedValueOnce(new Error('boom'));
    vi.useFakeTimers({ toFake: ['setInterval'] });
    renderWithLocale(<InboxLoader />);
    expect(await screen.findByText('Hello')).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(screen.getByText('Hello')).toBeTruthy();
    expect(screen.queryByText('Could not load messages. Please try again.')).toBeNull();
  });

  it('ignores a live poll that resolves after unmount', async () => {
    searchParams.set('c', 'conv-1');
    listMock.mockResolvedValue([THREAD]);
    let release: ((page: ConversationPage) => void) | undefined;
    threadMock.mockResolvedValueOnce(conversationPage([MESSAGE])).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    vi.useFakeTimers({ toFake: ['setInterval'] });
    const view = renderWithLocale(<InboxLoader />);
    expect(await screen.findByText('Hello')).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    view.unmount();
    await act(async () => {
      release?.(
        conversationPage([
          MESSAGE,
          {
            ...MESSAGE,
            id: 'm-late',
            text: 'Too late',
            createdAt: '2026-08-28T13:00:00.000Z',
          },
        ]),
      );
    });
    expect(screen.queryByText('Too late')).toBeNull();
  });

  it('skips a second pull while one live poll is in flight', async () => {
    searchParams.set('c', 'conv-1');
    listMock.mockResolvedValue([THREAD]);
    let release: ((page: ConversationPage) => void) | undefined;
    const newer: ConversationMessage = {
      ...MESSAGE,
      id: 'm2',
      text: 'After the wait',
      createdAt: '2026-08-28T13:00:00.000Z',
    };
    threadMock.mockResolvedValueOnce(conversationPage([MESSAGE])).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    vi.useFakeTimers({ toFake: ['setInterval'] });
    renderWithLocale(<InboxLoader />);
    expect(await screen.findByText('Hello')).toBeTruthy();
    const callsBefore = threadMock.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(threadMock.mock.calls.length).toBe(callsBefore + 1);
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(threadMock.mock.calls.length).toBe(callsBefore + 1);
    await act(async () => {
      release?.(conversationPage([MESSAGE, newer]));
    });
    expect(await screen.findByText('After the wait')).toBeTruthy();
  });

  it('does not append a posted id the live poll already showed', async () => {
    searchParams.set('c', 'conv-1');
    listMock.mockResolvedValue([THREAD]);
    const created: ConversationMessage = {
      id: 'm2',
      name: 'Ada',
      text: 'Follow up',
      createdAt: '2026-08-28T13:00:00.000Z',
      fromMe: true,
      sats: 0,
      hasPhoto: false,
      photoCount: 0,
    };
    threadMock
      .mockResolvedValueOnce(conversationPage([MESSAGE]))
      .mockResolvedValue(conversationPage([MESSAGE, created]));
    postMock.mockResolvedValue(created);
    vi.useFakeTimers({ toFake: ['setInterval'] });
    renderWithLocale(<InboxLoader />);
    expect(await screen.findByText('Hello')).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(await screen.findByText('Follow up')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Follow up' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('sess', 'conv-1', 'Follow up');
    });
    expect(screen.getAllByText('Follow up')).toHaveLength(1);
  });
});

describe('conversation thread pages', () => {
  class FakeIntersectionObserver {
    static instances: FakeIntersectionObserver[] = [];
    callback: IntersectionObserverCallback;
    observed: Element[] = [];

    constructor(cb: IntersectionObserverCallback) {
      this.callback = cb;
      FakeIntersectionObserver.instances.push(this);
    }

    observe(el: Element): void {
      this.observed.push(el);
    }

    unobserve(): void {}

    disconnect(): void {}

    trigger(isIntersecting = true): void {
      this.callback(
        this.observed.map((target) => ({ isIntersecting, target }) as IntersectionObserverEntry),
        this as unknown as IntersectionObserver,
      );
    }
  }

  beforeEach(() => {
    FakeIntersectionObserver.instances = [];
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
    searchParams.set('c', 'conv-1');
    listMock.mockResolvedValue([THREAD]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('prepends older unique messages from the next cursor page', async () => {
    const older = {
      ...MESSAGE,
      id: 'm-old',
      text: 'Older message',
      createdAt: '2026-08-27T12:00:00.000Z',
    };
    threadMock
      .mockResolvedValueOnce(conversationPage([MESSAGE], 'cur_2'))
      .mockResolvedValueOnce(conversationPage([older, MESSAGE]));
    const { container } = renderWithLocale(<InboxLoader />);
    await waitFor(() => {
      expect(FakeIntersectionObserver.instances[0]?.observed).toHaveLength(1);
    });

    act(() => {
      FakeIntersectionObserver.instances[0]?.trigger(false);
    });
    expect(threadMock).toHaveBeenCalledTimes(1);
    act(() => {
      FakeIntersectionObserver.instances[0]?.trigger();
    });

    expect(await screen.findByText('Older message')).toBeTruthy();
    expect(threadMock).toHaveBeenCalledWith('sess', 'conv-1', { cursor: 'cur_2' });
    expect(container.querySelectorAll('[data-message-id="m1"]')).toHaveLength(1);
    const ids = [...container.querySelectorAll('[data-message-id]')].map((node) =>
      node.getAttribute('data-message-id'),
    );
    expect(ids).toEqual(['m-old', 'm1']);
  });

  it('recovers nextCursor from a pay poll after the first thread fetch failed', async () => {
    const gift: ConversationMessage = {
      id: 'gift-1',
      name: 'Ada',
      text: '',
      createdAt: '2026-08-28T14:00:00.000Z',
      fromMe: true,
      sats: 21,
      hasPhoto: false,
      photoCount: 0,
    };
    const older = {
      ...MESSAGE,
      id: 'm-old',
      text: 'Older message',
      createdAt: '2026-08-27T12:00:00.000Z',
    };
    threadMock
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(conversationPage([gift], 'cur_2'))
      .mockResolvedValueOnce(conversationPage([older, gift]));
    invoiceMock.mockResolvedValue({ pr: 'lnbc21n1test', amountSats: 21, messageId: 'gift-1' });
    renderWithLocale(<InboxLoader />);
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => {
      expect(screen.queryByText('Pay ₿21')).toBeNull();
    });
    await waitFor(() => {
      expect(FakeIntersectionObserver.instances[0]?.observed).toHaveLength(1);
    });
    act(() => {
      FakeIntersectionObserver.instances[0]?.trigger();
    });
    expect(await screen.findByText('Older message')).toBeTruthy();
    expect(threadMock).toHaveBeenCalledWith('sess', 'conv-1', { cursor: 'cur_2' });
  });

  it('does not create an observer or fetch a cursor page without a next cursor', async () => {
    threadMock.mockResolvedValue(conversationPage([MESSAGE]));
    renderWithLocale(<InboxLoader />);
    expect(await screen.findByText('Hello')).toBeTruthy();
    expect(FakeIntersectionObserver.instances).toHaveLength(0);
    expect(threadMock).toHaveBeenCalledTimes(1);
  });

  it('does not start a second cursor fetch while the first is in flight', async () => {
    const older = { ...MESSAGE, id: 'm-old', text: 'Older message' };
    let resolvePageTwo: (page: ConversationPage) => void = () => undefined;
    threadMock.mockResolvedValueOnce(conversationPage([MESSAGE], 'cur_2')).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePageTwo = resolve;
        }),
    );
    renderWithLocale(<InboxLoader />);
    await waitFor(() => {
      expect(FakeIntersectionObserver.instances[0]?.observed).toHaveLength(1);
    });

    act(() => {
      FakeIntersectionObserver.instances[0]?.trigger();
      FakeIntersectionObserver.instances[0]?.trigger();
    });
    expect(threadMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      resolvePageTwo(conversationPage([older]));
    });
    expect(await screen.findByText('Older message')).toBeTruthy();
  });

  it('keeps the loaded first page when a cursor fetch rejects', async () => {
    threadMock
      .mockResolvedValueOnce(conversationPage([MESSAGE], 'cur_2'))
      .mockRejectedValueOnce(new Error('boom'));
    renderWithLocale(<InboxLoader />);
    await waitFor(() => {
      expect(FakeIntersectionObserver.instances[0]?.observed).toHaveLength(1);
    });
    act(() => {
      FakeIntersectionObserver.instances[0]?.trigger();
    });
    await waitFor(() => {
      expect(threadMock).toHaveBeenCalledWith('sess', 'conv-1', { cursor: 'cur_2' });
    });
    expect(screen.getByText('Hello')).toBeTruthy();
    expect(screen.queryByText('Could not load messages. Please try again.')).toBeNull();
  });
});
