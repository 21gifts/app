import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContactLoader } from '@/components/ContactLoader';
import type { Account, ContactMessage } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: (): { push: typeof push } => ({ push }),
}));

vi.mock('@/lib/api', () => ({
  postContact: vi.fn(),
  fetchConversations: vi.fn(),
}));

import { fetchConversations, postContact } from '@/lib/api';

const postMock = vi.mocked(postContact);
const conversationsMock = vi.mocked(fetchConversations);

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

beforeEach(() => {
  vi.clearAllMocks();
  push.mockReset();
  useAuthStore.setState({ session: 'sess', account });
});

afterEach(() => {
  cleanup();
  postMock.mockReset();
});

describe('ContactLoader', () => {
  it('renders nothing when there is no session', () => {
    useAuthStore.setState({ session: null, account });
    const { container } = renderWithLocale(<ContactLoader />);
    expect(container.firstChild).toBeNull();
  });

  it('shows the composer when signed in', () => {
    renderWithLocale(<ContactLoader />);
    expect(screen.getByRole('heading', { name: 'Contact' })).toBeTruthy();
    expect(screen.getByLabelText('Your message')).toBeTruthy();
  });

  it('does not post when the draft is empty or whitespace', () => {
    renderWithLocale(<ContactLoader />);
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(screen.getByRole('alert').textContent).toBe('Enter a message');
    expect(postMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(screen.getByRole('alert').textContent).toBe('Enter a message');
    expect(postMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Hi' } });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('does not post when the trimmed draft is longer than 500 characters', () => {
    renderWithLocale(<ContactLoader />);
    fireEvent.change(screen.getByLabelText('Your message'), {
      target: { value: `${'a'.repeat(501)}` },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(screen.getByRole('alert').textContent).toBe('Keep it to 500 characters');
    expect(postMock).not.toHaveBeenCalled();
  });

  it('posts a trimmed message and opens the official thread', async () => {
    const created: ContactMessage = {
      id: 'c1',
      name: 'Ada',
      text: 'Hello',
      createdAt: '2026-08-28T14:00:00.000Z',
    };
    postMock.mockResolvedValue(created);
    conversationsMock.mockResolvedValue([
      {
        id: 'conv-21',
        name: '21.gifts',
        lastText: 'Hello',
        lastAt: '2026-08-28T14:00:00.000Z',
      },
    ]);
    renderWithLocale(<ContactLoader />);

    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: '  Hello  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/messages?c=conv-21');
    });
    expect(postMock).toHaveBeenCalledWith('sess', 'Hello');
  });

  it('opens the inbox list when no 21.gifts thread is present', async () => {
    postMock.mockResolvedValue({
      id: 'c1',
      name: 'Ada',
      text: 'Hi',
      createdAt: '2026-08-28T14:00:00.000Z',
    });
    conversationsMock.mockResolvedValue([
      {
        id: 'conv-bob',
        name: 'Bob',
        lastText: 'Hi',
        lastAt: '2026-08-28T14:00:00.000Z',
      },
    ]);
    renderWithLocale(<ContactLoader />);
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Hi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/messages');
    });
  });

  it('opens /messages when the conversation list cannot be loaded', async () => {
    postMock.mockResolvedValue({
      id: 'c1',
      name: 'Ada',
      text: 'Hi',
      createdAt: '2026-08-28T14:00:00.000Z',
    });
    conversationsMock.mockRejectedValue(new Error('boom'));
    renderWithLocale(<ContactLoader />);
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Hi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/messages');
    });
  });

  it('shows a post error when posting fails', async () => {
    postMock.mockRejectedValue(new Error('boom'));
    renderWithLocale(<ContactLoader />);

    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Hi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe('Could not send your message');
    expect((screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('disables Send and shows a spinner while posting', async () => {
    let resolvePost!: (value: ContactMessage) => void;
    const pending = new Promise<ContactMessage>((resolve) => {
      resolvePost = resolve;
    });
    postMock.mockReturnValue(pending);
    renderWithLocale(<ContactLoader />);

    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Hi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    const button = screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.querySelector('.animate-spin')).toBeTruthy();

    conversationsMock.mockResolvedValue([]);
    resolvePost({
      id: 'c1',
      name: 'Ada',
      text: 'Hi',
      createdAt: '2026-08-28T14:00:00.000Z',
    });
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/messages');
    });
  });
});
