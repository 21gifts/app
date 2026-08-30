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

vi.mock('@/lib/api', () => ({
  postContact: vi.fn(),
}));

import { postContact } from '@/lib/api';

const postMock = vi.mocked(postContact);

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

  it('posts a trimmed message, clears the draft, and shows success', async () => {
    const created: ContactMessage = {
      id: 'c1',
      name: 'Ada',
      text: 'Hello',
      createdAt: '2026-08-28T14:00:00.000Z',
    };
    postMock.mockResolvedValue(created);
    renderWithLocale(<ContactLoader />);

    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: '  Hello  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(
        screen.getByText('Received — thank you. We read every message here in the app.'),
      ).toBeTruthy();
    });
    expect(postMock).toHaveBeenCalledWith('sess', 'Hello');
    expect(screen.queryByLabelText('Your message')).toBeNull();
  });

  it('shows a post error when posting fails', async () => {
    postMock.mockRejectedValue(new Error('boom'));
    renderWithLocale(<ContactLoader />);

    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Hi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe('Could not send your message');
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

    resolvePost({
      id: 'c1',
      name: 'Ada',
      text: 'Hi',
      createdAt: '2026-08-28T14:00:00.000Z',
    });
    await waitFor(() => {
      expect(
        screen.getByText('Received — thank you. We read every message here in the app.'),
      ).toBeTruthy();
    });
  });
});
