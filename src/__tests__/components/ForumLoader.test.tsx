import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ForumLoader } from '@/components/ForumLoader';
import type { Account, ForumMessage } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/lib/api', () => ({
  fetchMessages: vi.fn(),
  postMessage: vi.fn(),
  postMessageInvoice: vi.fn(),
}));

import { fetchMessages, postMessage, postMessageInvoice } from '@/lib/api';

const fetchMock = vi.mocked(fetchMessages);
const postMock = vi.mocked(postMessage);
const invoiceMock = vi.mocked(postMessageInvoice);

const account: Account = {
  id: 'acc_1',
  linkingKey: '02abcdef',
  role: 'basis',
  name: 'Ada',
  lightningAddress: 'alice@walletofsatoshi.com',
  lightningAddressVerified: false,
  createdAt: 1_700_000_000,
};

const SAMPLE: ForumMessage = {
  id: 'm1',
  name: 'Ada',
  text: 'Hello from Ada',
  createdAt: '2026-08-28T12:00:00.000Z',
  sats: 0,
  payable: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ session: 'sess', account });
});

afterEach(() => {
  cleanup();
  fetchMock.mockReset();
  postMock.mockReset();
  invoiceMock.mockReset();
});

describe('ForumLoader', () => {
  it('renders nothing when there is no session', () => {
    useAuthStore.setState({ session: null, account });
    const { container } = renderWithLocale(<ForumLoader />);
    expect(container.firstChild).toBeNull();
  });

  it('shows empty copy when fetch resolves to an empty list', async () => {
    fetchMock.mockResolvedValue([]);
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet. Be the first to write.')).toBeTruthy();
    });
  });

  it('shows a fetched message with sats', async () => {
    fetchMock.mockResolvedValue([SAMPLE]);
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('Ada')).toBeTruthy();
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
      expect(screen.getByText('0 sats')).toBeTruthy();
    });
  });

  it('shows a fetch error and retries', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Could not load messages. Please try again.'));
    fetchMock.mockResolvedValueOnce([]);
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(screen.getByText('No messages yet. Be the first to write.')).toBeTruthy();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('uses the fallback error copy for a non-Error rejection', async () => {
    fetchMock.mockRejectedValueOnce('nope');
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('Could not load messages. Please try again.')).toBeTruthy();
    });
  });

  it('does not render a raw Error.message as the load error', async () => {
    fetchMock.mockRejectedValueOnce(new Error('SECRET internals'));
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('Could not load messages. Please try again.')).toBeTruthy();
    });
    expect(screen.queryByText('SECRET internals')).toBeNull();
  });

  it('localizes a fetch error', async () => {
    fetchMock.mockRejectedValueOnce(new Error('SECRET internals'));
    renderWithLocale(<ForumLoader />, 'de');
    await waitFor(() => {
      expect(
        screen.getByText('Nachrichten konnten nicht geladen werden. Bitte erneut versuchen.'),
      ).toBeTruthy();
    });
    expect(screen.queryByText('SECRET internals')).toBeNull();
  });

  it('ignores a stale fetch after unmount', async () => {
    let resolveStale: ((value: ForumMessage[]) => void) | undefined;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveStale = resolve;
        }),
    );
    const view = renderWithLocale(<ForumLoader />);
    view.unmount();
    resolveStale?.([]);
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalled();
  });

  it('ignores a stale rejection after unmount', async () => {
    let rejectStale: ((reason: Error) => void) | undefined;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectStale = reject;
        }),
    );
    const view = renderWithLocale(<ForumLoader />);
    view.unmount();
    rejectStale?.(new Error('gone'));
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalled();
  });

  it('does not post when the draft is empty or whitespace', async () => {
    fetchMock.mockResolvedValue([]);
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet. Be the first to write.')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    expect(screen.getByRole('alert').textContent).toBe('Enter a message');
    expect(postMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    expect(screen.getByRole('alert').textContent).toBe('Enter a message');
    expect(postMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Hi' } });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('does not post when the trimmed draft is longer than 500 characters', async () => {
    fetchMock.mockResolvedValue([]);
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet. Be the first to write.')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('Your message'), {
      target: { value: `${'a'.repeat(501)}` },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    expect(screen.getByRole('alert').textContent).toBe('Keep it to 500 characters');
    expect(postMock).not.toHaveBeenCalled();
  });

  it('prepends a post when the list has not loaded yet', async () => {
    fetchMock.mockReturnValue(new Promise(() => undefined));
    const created: ForumMessage = {
      id: 'm-early',
      name: 'Ada',
      text: 'Early',
      createdAt: '2026-08-28T14:00:00.000Z',
      sats: 0,
      payable: false,
    };
    postMock.mockResolvedValue(created);
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('Loading…')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Early' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    await waitFor(() => {
      expect(screen.getByText('Early')).toBeTruthy();
    });
  });

  it('keeps an early post when the in-flight fetch later resolves', async () => {
    let resolveFetch: ((value: ForumMessage[]) => void) | undefined;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
    );
    const created: ForumMessage = {
      id: 'm-early',
      name: 'Ada',
      text: 'Early',
      createdAt: '2026-08-28T14:00:00.000Z',
      sats: 0,
      payable: false,
    };
    const fromServer: ForumMessage = {
      id: 'm1',
      name: 'Bob',
      text: 'Hello from Ada',
      createdAt: '2026-08-28T12:00:00.000Z',
      sats: 0,
      payable: true,
    };
    postMock.mockResolvedValue(created);
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('Loading…')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Early' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    await waitFor(() => {
      expect(screen.getByText('Early')).toBeTruthy();
    });
    await act(async () => {
      resolveFetch?.([fromServer]);
    });
    await waitFor(() => {
      expect(screen.getByText('Early')).toBeTruthy();
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });
  });

  it('keeps an early post when the in-flight fetch later rejects', async () => {
    let rejectFetch: ((reason: Error) => void) | undefined;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectFetch = reject;
        }),
    );
    const created: ForumMessage = {
      id: 'm-early',
      name: 'Ada',
      text: 'Early',
      createdAt: '2026-08-28T14:00:00.000Z',
      sats: 0,
      payable: false,
    };
    postMock.mockResolvedValue(created);
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('Loading…')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Early' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    await waitFor(() => {
      expect(screen.getByText('Early')).toBeTruthy();
    });
    await act(async () => {
      rejectFetch?.(new Error('gone'));
    });
    await waitFor(() => {
      expect(screen.getByText('Early')).toBeTruthy();
      expect(screen.getByText('Could not load messages. Please try again.')).toBeTruthy();
    });
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('does not duplicate a post already present from fetch', async () => {
    const created: ForumMessage = {
      id: 'm1',
      name: 'Ada',
      text: 'Hello from Ada',
      createdAt: '2026-08-28T12:00:00.000Z',
      sats: 0,
      payable: true,
    };
    fetchMock.mockResolvedValue([created]);
    postMock.mockResolvedValue(created);
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Your message'), {
      target: { value: 'Hello from Ada' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    await waitFor(() => {
      expect(postMock).toHaveBeenCalled();
    });
    expect(screen.getAllByText('Hello from Ada')).toHaveLength(1);
  });

  it('posts a trimmed message, prepends it, and clears the draft', async () => {
    fetchMock.mockResolvedValue([]);
    const created: ForumMessage = {
      id: 'm2',
      name: 'Ada',
      text: 'Hello',
      createdAt: '2026-08-28T14:00:00.000Z',
      sats: 0,
      payable: false,
    };
    postMock.mockResolvedValue(created);
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet. Be the first to write.')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: '  Hello  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));

    await waitFor(() => {
      expect(screen.getByText('Hello')).toBeTruthy();
    });
    expect(postMock).toHaveBeenCalledWith('sess', 'Hello');
    expect((screen.getByLabelText('Your message') as HTMLTextAreaElement).value).toBe('');
  });

  it('shows a post error when posting fails', async () => {
    fetchMock.mockResolvedValue([]);
    postMock.mockRejectedValue(new Error('boom'));
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet. Be the first to write.')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Hi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe('Could not post your message');
  });

  it('shows rate-limit copy when posting is rate limited', async () => {
    fetchMock.mockResolvedValue([]);
    postMock.mockRejectedValue(new Error('Too many messages'));
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet. Be the first to write.')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Hi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe(
      'Too many messages. Please wait a moment and try again.',
    );
  });

  it('disables Post and shows a spinner while posting', async () => {
    fetchMock.mockResolvedValue([]);
    let resolvePost!: (value: ForumMessage) => void;
    const pending = new Promise<ForumMessage>((resolve) => {
      resolvePost = resolve;
    });
    postMock.mockReturnValue(pending);
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet. Be the first to write.')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Hi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));

    const button = screen.getByRole('button', { name: 'Post' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.querySelector('.animate-spin')).toBeTruthy();

    await act(async () => {
      resolvePost({
        id: 'm3',
        name: 'Ada',
        text: 'Hi',
        createdAt: '2026-08-28T15:00:00.000Z',
        sats: 0,
        payable: false,
      });
    });

    await waitFor(() => {
      expect((screen.getByRole('button', { name: 'Post' }) as HTMLButtonElement).disabled).toBe(
        false,
      );
    });
  });

  it('requests an invoice and shows the QR', async () => {
    fetchMock.mockResolvedValue([SAMPLE]);
    invoiceMock.mockResolvedValue({ pr: 'lnbc21n1example', amountSats: 21 });
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Send Bitcoin' }));
    fireEvent.change(screen.getByLabelText('Amount (sats)'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => {
      expect(invoiceMock).toHaveBeenCalledWith('sess', 'm1', 21);
      expect(screen.getByRole('img', { name: 'Bitcoin payment QR code' })).toBeTruthy();
      expect(screen.getByText('Pay 21 sats')).toBeTruthy();
    });
  });

  it('rejects a non-positive pay amount before calling the api', async () => {
    fetchMock.mockResolvedValue([SAMPLE]);
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Send Bitcoin' }));
    fireEvent.change(screen.getByLabelText('Amount (sats)'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('alert').textContent).toBe(
      'Enter a whole number of sats greater than zero',
    );
    expect(invoiceMock).not.toHaveBeenCalled();
  });

  it('shows pay request error when invoice fails', async () => {
    fetchMock.mockResolvedValue([SAMPLE]);
    invoiceMock.mockRejectedValue(new Error('Could not start the Bitcoin payment'));
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Send Bitcoin' }));
    fireEvent.change(screen.getByLabelText('Amount (sats)'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe('Could not start the Bitcoin payment');
  });

  it('shows pay rate-limit copy when invoice is rate limited', async () => {
    fetchMock.mockResolvedValue([SAMPLE]);
    invoiceMock.mockRejectedValue(new Error('Too many payments'));
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Send Bitcoin' }));
    fireEvent.change(screen.getByLabelText('Amount (sats)'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe(
      'Too many payments. Please wait a moment and try again.',
    );
  });

  it('drops a late invoice after cancel', async () => {
    fetchMock.mockResolvedValue([SAMPLE]);
    let resolveInvoice: ((value: { pr: string; amountSats: number }) => void) | undefined;
    invoiceMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveInvoice = resolve;
        }),
    );
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send Bitcoin' }));
    fireEvent.change(screen.getByLabelText('Amount (sats)'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await act(async () => {
      resolveInvoice?.({ pr: 'lnbc21n1example', amountSats: 21 });
    });
    expect(screen.queryByRole('img', { name: 'Bitcoin payment QR code' })).toBeNull();
  });

  it('drops a late invoice error after cancel', async () => {
    fetchMock.mockResolvedValue([SAMPLE]);
    let rejectInvoice: ((reason: Error) => void) | undefined;
    invoiceMock.mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectInvoice = reject;
        }),
    );
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send Bitcoin' }));
    fireEvent.change(screen.getByLabelText('Amount (sats)'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await act(async () => {
      rejectInvoice?.(new Error('gone'));
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('ignores pay submit when the note is not payable', async () => {
    fetchMock.mockResolvedValue([{ ...SAMPLE, payable: false }]);
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send Bitcoin' }));
    const amount = screen.queryByLabelText('Amount (sats)');
    if (amount !== null) {
      fireEvent.change(amount, { target: { value: '21' } });
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    }
    expect(invoiceMock).not.toHaveBeenCalled();
  });

  it('does not request a second invoice while one is in flight', async () => {
    fetchMock.mockResolvedValue([SAMPLE]);
    invoiceMock.mockReturnValue(new Promise(() => undefined));
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send Bitcoin' }));
    fireEvent.change(screen.getByLabelText('Amount (sats)'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(invoiceMock).toHaveBeenCalledTimes(1);
  });
});
