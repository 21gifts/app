import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InboxLoader } from '@/components/InboxLoader';
import type { Account, Conversation, ConversationMessage } from '@/lib/api-types';
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
  postConversationMessage: vi.fn(),
}));

import { fetchConversation, fetchConversations, postConversationMessage } from '@/lib/api';

const listMock = vi.mocked(fetchConversations);
const threadMock = vi.mocked(fetchConversation);
const postMock = vi.mocked(postConversationMessage);

const account: Account = {
  id: 'acc_1',
  linkingKey: '02abcdef',
  role: 'basis',
  name: 'Ada',
  lightningAddress: 'alice@walletofsatoshi.com',
  lightningAddressVerified: false,
  forumLawsDismissed: false,
  createdAt: 1_700_000_000,
  rulesAgreedAt: 1_700_000_001,
  viewKey: 'a'.repeat(64),
};

const THREAD: Conversation = {
  id: 'conv-1',
  name: '21.gifts',
  lastText: 'Hello',
  lastAt: '2026-08-28T12:00:00.000Z',
};

const MESSAGE: ConversationMessage = {
  id: 'm1',
  name: 'Ada',
  text: 'Hello',
  createdAt: '2026-08-28T12:00:00.000Z',
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
    listMock.mockResolvedValue([THREAD]);
    renderWithLocale(<InboxLoader />);
    expect(await screen.findByText('21.gifts')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /21\.gifts/ }));
    expect(push).toHaveBeenCalledWith('/messages?c=conv-1');
  });

  it('shows empty copy', async () => {
    listMock.mockResolvedValue([]);
    renderWithLocale(<InboxLoader />);
    expect(await screen.findByText('No private messages yet.')).toBeTruthy();
  });

  it('shows a list error and retries', async () => {
    listMock.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce([THREAD]);
    renderWithLocale(<InboxLoader />);
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('21.gifts')).toBeTruthy();
  });

  it('opens a thread from ?c= and posts a reply', async () => {
    searchParams.set('c', 'conv-1');
    const older: Conversation = {
      id: 'conv-2',
      name: 'Bob',
      lastText: 'Older',
      lastAt: '2026-08-27T12:00:00.000Z',
    };
    listMock.mockResolvedValue([THREAD, older]);
    threadMock.mockResolvedValue([MESSAGE]);
    postMock.mockResolvedValue({
      id: 'm2',
      name: 'Ada',
      text: 'Follow up',
      createdAt: '2026-08-28T13:00:00.000Z',
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
});
