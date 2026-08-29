import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ForumLoader } from '@/components/ForumLoader';
import type { Account, ForumMessage } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/lib/api', () => ({
  fetchMessages: vi.fn(),
  postMessage: vi.fn(),
  postMessageInvoice: vi.fn(),
  dismissForumLaws: vi.fn(),
  fetchMessagePhoto: vi.fn(),
}));

vi.mock('@/lib/forum-photo', () => ({
  prepareForumPhoto: vi.fn(),
}));

import {
  dismissForumLaws,
  fetchMessagePhoto,
  fetchMessages,
  postMessage,
  postMessageInvoice,
} from '@/lib/api';
import { prepareForumPhoto } from '@/lib/forum-photo';

const fetchMock = vi.mocked(fetchMessages);
const postMock = vi.mocked(postMessage);
const invoiceMock = vi.mocked(postMessageInvoice);
const dismissLawsMock = vi.mocked(dismissForumLaws);
const photoMock = vi.mocked(fetchMessagePhoto);
const prepareMock = vi.mocked(prepareForumPhoto);

const account: Account = {
  id: 'acc_1',
  linkingKey: '02abcdef',
  role: 'basis',
  name: 'Ada',
  lightningAddress: 'alice@walletofsatoshi.com',
  lightningAddressVerified: false,
  forumLawsDismissed: false,
  createdAt: 1_700_000_000,
};

const SAMPLE: ForumMessage = {
  id: 'm1',
  name: 'Ada',
  text: 'Hello from Ada',
  createdAt: '2026-08-28T12:00:00.000Z',
  sats: 0,
  payable: true,
  hasPhoto: false,
};

const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;

async function revealAll(): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name: 'All' }));
}

beforeEach(() => {
  vi.clearAllMocks();
  HTMLElement.prototype.scrollIntoView = vi.fn();
  useAuthStore.setState({ session: 'sess', account });
  photoMock.mockResolvedValue(new Blob([new Uint8Array([1])], { type: 'image/jpeg' }));
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: () => 'blob:mock',
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    writable: true,
    value: () => undefined,
  });
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  fetchMock.mockReset();
  postMock.mockReset();
  invoiceMock.mockReset();
  dismissLawsMock.mockReset();
  photoMock.mockReset();
  prepareMock.mockReset();
  vi.restoreAllMocks();
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

  it('shows the living-room laws hint when forumLawsDismissed is false', async () => {
    fetchMock.mockResolvedValue([]);
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(
        screen.getByText('This is a donation platform. Only free gifts — never pay for a promise.'),
      ).toBeTruthy();
    });
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeTruthy();
  });

  it('hides the living-room laws hint when forumLawsDismissed is true', async () => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, forumLawsDismissed: true },
    });
    fetchMock.mockResolvedValue([]);
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet. Be the first to write.')).toBeTruthy();
    });
    expect(
      screen.queryByText('This is a donation platform. Only free gifts — never pay for a promise.'),
    ).toBeNull();
    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull();
  });

  it('dismisses the laws hint and persists via dismissForumLaws', async () => {
    fetchMock.mockResolvedValue([]);
    dismissLawsMock.mockResolvedValue({ ...account, forumLawsDismissed: true });
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Dismiss' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    await waitFor(() => {
      expect(
        screen.queryByText(
          'This is a donation platform. Only free gifts — never pay for a promise.',
        ),
      ).toBeNull();
    });
    expect(dismissLawsMock).toHaveBeenCalledWith('sess');
    expect(useAuthStore.getState().account?.forumLawsDismissed).toBe(true);
  });

  it('restores the laws hint when dismissForumLaws rejects', async () => {
    fetchMock.mockResolvedValue([]);
    dismissLawsMock.mockRejectedValue(new Error('Could not dismiss the living-room hint'));
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Dismiss' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    await waitFor(() => {
      expect(dismissLawsMock).toHaveBeenCalledWith('sess');
    });
    await waitFor(() => {
      expect(
        screen.getByText('This is a donation platform. Only free gifts — never pay for a promise.'),
      ).toBeTruthy();
    });
    expect(useAuthStore.getState().account?.forumLawsDismissed).toBe(false);
  });

  it('does not restore an account when logout happens during dismiss', async () => {
    fetchMock.mockResolvedValue([]);
    let resolveDismiss: ((value: Account) => void) | undefined;
    dismissLawsMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveDismiss = resolve;
        }),
    );
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Dismiss' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    useAuthStore.getState().clearAuth();
    resolveDismiss?.({ ...account, forumLawsDismissed: true });
    await act(async () => {
      await Promise.resolve();
    });
    expect(useAuthStore.getState().session).toBeNull();
    expect(useAuthStore.getState().account).toBeNull();
  });

  it('does not restore an account when logout happens during a failed dismiss', async () => {
    fetchMock.mockResolvedValue([]);
    let rejectDismiss: ((reason: Error) => void) | undefined;
    dismissLawsMock.mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectDismiss = reject;
        }),
    );
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Dismiss' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    useAuthStore.getState().clearAuth();
    rejectDismiss?.(new Error('Could not dismiss the living-room hint'));
    await act(async () => {
      await Promise.resolve();
    });
    expect(useAuthStore.getState().session).toBeNull();
    expect(useAuthStore.getState().account).toBeNull();
  });

  it('shows a fetched message with sats', async () => {
    fetchMock.mockResolvedValue([SAMPLE]);
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages with sats yet.')).toBeTruthy();
    });
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Ada')).toBeTruthy();
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
      expect(screen.getByText('0 sats')).toBeTruthy();
    });
  });

  it('loads a photo blob URL for hasPhoto messages and revokes on unmount', async () => {
    fetchMock.mockResolvedValue([
      {
        id: 'm-photo',
        name: 'Ada',
        text: '',
        createdAt: '2026-08-28T12:00:00.000Z',
        sats: 0,
        payable: false,
        hasPhoto: true,
      },
    ]);
    const view = renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(photoMock).toHaveBeenCalledWith('sess', 'm-photo');
    });
    await revealAll();
    await waitFor(() => {
      expect(screen.getByAltText('Photo from Ada').getAttribute('src')).toBe('blob:mock');
    });
    view.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock');
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

  it('does not post when the draft is empty or whitespace without a photo', async () => {
    fetchMock.mockResolvedValue([]);
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet. Be the first to write.')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    expect(screen.getByRole('alert').textContent).toBe('Enter a message or add a photo');
    expect(postMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    expect(screen.getByRole('alert').textContent).toBe('Enter a message or add a photo');
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

  it('sets formError when prepareForumPhoto rejects the file', async () => {
    fetchMock.mockResolvedValue([]);
    prepareMock.mockResolvedValue({ ok: false, error: 'unsupported' });
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet. Be the first to write.')).toBeTruthy();
    });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File([], 'a.gif', { type: 'image/gif' })] },
    });
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe('Use a JPEG, PNG, or WebP photo');
    });
  });

  it('sets unsupported when prepareForumPhoto throws', async () => {
    fetchMock.mockResolvedValue([]);
    prepareMock.mockRejectedValueOnce(new Error('Could not decode image'));
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet. Be the first to write.')).toBeTruthy();
    });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File([new Uint8Array([1])], 'a.jpg', { type: 'image/jpeg' })] },
    });
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe('Use a JPEG, PNG, or WebP photo');
    });
  });

  it('ignores a stale prepare after a newer pick starts', async () => {
    fetchMock.mockResolvedValue([]);
    let resolveFirst: ((value: Awaited<ReturnType<typeof prepareForumPhoto>>) => void) | undefined;
    prepareMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    );
    prepareMock.mockResolvedValueOnce({
      ok: true,
      photo: {
        contentType: 'image/jpeg',
        data: 'second',
        previewUrl: 'data:image/jpeg;base64,second',
      },
    });
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet. Be the first to write.')).toBeTruthy();
    });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File([new Uint8Array([1])], 'a.jpg', { type: 'image/jpeg' })] },
    });
    fireEvent.change(input, {
      target: { files: [new File([new Uint8Array([2])], 'b.jpg', { type: 'image/jpeg' })] },
    });
    await waitFor(() => {
      expect((screen.getByAltText('Selected photo') as HTMLImageElement).src).toContain('second');
    });
    resolveFirst?.({
      ok: true,
      photo: {
        contentType: 'image/jpeg',
        data: 'first',
        previewUrl: 'data:image/jpeg;base64,first',
      },
    });
    await Promise.resolve();
    expect((screen.getByAltText('Selected photo') as HTMLImageElement).src).toContain('second');
  });

  it('ignores a stale prepare rejection after a newer pick starts', async () => {
    fetchMock.mockResolvedValue([]);
    let rejectFirst: ((reason: Error) => void) | undefined;
    prepareMock.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectFirst = reject;
        }),
    );
    prepareMock.mockResolvedValueOnce({
      ok: true,
      photo: {
        contentType: 'image/jpeg',
        data: 'second',
        previewUrl: 'data:image/jpeg;base64,second',
      },
    });
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet. Be the first to write.')).toBeTruthy();
    });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File([new Uint8Array([1])], 'a.jpg', { type: 'image/jpeg' })] },
    });
    fireEvent.change(input, {
      target: { files: [new File([new Uint8Array([2])], 'b.jpg', { type: 'image/jpeg' })] },
    });
    await waitFor(() => {
      expect((screen.getByAltText('Selected photo') as HTMLImageElement).src).toContain('second');
    });
    rejectFirst?.(new Error('Could not decode image'));
    await Promise.resolve();
    expect(screen.queryByRole('alert')).toBeNull();
    expect((screen.getByAltText('Selected photo') as HTMLImageElement).src).toContain('second');
  });

  it('ignores a stale prepare after unmount', async () => {
    fetchMock.mockResolvedValue([]);
    let resolvePrep:
      | ((value: Awaited<ReturnType<typeof prepareForumPhoto>>) => void)
      | undefined;
    prepareMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePrep = resolve;
        }),
    );
    const view = renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet. Be the first to write.')).toBeTruthy();
    });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File([new Uint8Array([1])], 'a.jpg', { type: 'image/jpeg' })] },
    });
    await waitFor(() => {
      expect(prepareMock).toHaveBeenCalled();
    });
    view.unmount();
    resolvePrep?.({
      ok: true,
      photo: {
        contentType: 'image/jpeg',
        data: 'late',
        previewUrl: 'data:image/jpeg;base64,late',
      },
    });
    await Promise.resolve();
  });

  it('sets tooLarge and clears a photo draft', async () => {
    fetchMock.mockResolvedValue([]);
    prepareMock
      .mockResolvedValueOnce({
        ok: true,
        photo: {
          contentType: 'image/jpeg',
          data: 'abc',
          previewUrl: 'data:image/jpeg;base64,abc',
        },
      })
      .mockResolvedValueOnce({ ok: false, error: 'tooLarge' });
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet. Be the first to write.')).toBeTruthy();
    });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File([new Uint8Array([1])], 'a.jpg', { type: 'image/jpeg' })] },
    });
    await waitFor(() => {
      expect(screen.getByAltText('Selected photo')).toBeTruthy();
    });
    fireEvent.change(input, {
      target: { files: [new File([new Uint8Array([1])], 'big.jpg', { type: 'image/jpeg' })] },
    });
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe('Keep the photo under 1 MB');
    });
    expect(screen.queryByAltText('Selected photo')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    expect(postMock).not.toHaveBeenCalled();
  });

  it('clears a photo draft when Remove photo is clicked', async () => {
    fetchMock.mockResolvedValue([]);
    prepareMock.mockResolvedValueOnce({
      ok: true,
      photo: {
        contentType: 'image/jpeg',
        data: 'abc',
        previewUrl: 'data:image/jpeg;base64,abc',
      },
    });
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet. Be the first to write.')).toBeTruthy();
    });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File([new Uint8Array([1])], 'a.jpg', { type: 'image/jpeg' })] },
    });
    await waitFor(() => {
      expect(screen.getByAltText('Selected photo')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Remove photo' }));
    expect(screen.queryByAltText('Selected photo')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    expect(postMock).not.toHaveBeenCalled();
  });

  it('clears a prior photo draft when a replacement throws', async () => {
    fetchMock.mockResolvedValue([]);
    prepareMock
      .mockResolvedValueOnce({
        ok: true,
        photo: {
          contentType: 'image/jpeg',
          data: 'abc',
          previewUrl: 'data:image/jpeg;base64,abc',
        },
      })
      .mockRejectedValueOnce(new Error('Could not decode image'));
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet. Be the first to write.')).toBeTruthy();
    });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File([new Uint8Array([1])], 'a.jpg', { type: 'image/jpeg' })] },
    });
    await waitFor(() => {
      expect(screen.getByAltText('Selected photo')).toBeTruthy();
    });
    fireEvent.change(input, {
      target: { files: [new File([new Uint8Array([1])], 'b.jpg', { type: 'image/jpeg' })] },
    });
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe('Use a JPEG, PNG, or WebP photo');
    });
    expect(screen.queryByAltText('Selected photo')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    expect(postMock).not.toHaveBeenCalled();
  });

  it('ignores a failed photo fetch', async () => {
    fetchMock.mockResolvedValue([
      {
        id: 'm-photo',
        name: 'Ada',
        text: 'Hi',
        createdAt: '2026-08-28T12:00:00.000Z',
        sats: 0,
        payable: false,
        hasPhoto: true,
      },
    ]);
    photoMock.mockRejectedValueOnce(new Error('gone'));
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages with sats yet.')).toBeTruthy();
    });
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hi')).toBeTruthy();
    });
    expect(screen.queryByAltText('Photo from Ada')).toBeNull();
  });

  it('ignores a stale photo fetch after unmount', async () => {
    let resolvePhoto: ((value: Blob) => void) | undefined;
    fetchMock.mockResolvedValue([
      {
        id: 'm-photo',
        name: 'Ada',
        text: '',
        createdAt: '2026-08-28T12:00:00.000Z',
        sats: 0,
        payable: false,
        hasPhoto: true,
      },
    ]);
    photoMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePhoto = resolve;
        }),
    );
    const view = renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(photoMock).toHaveBeenCalled();
    });
    view.unmount();
    resolvePhoto?.(new Blob([new Uint8Array([1])], { type: 'image/jpeg' }));
    await Promise.resolve();
  });

  it('does not fetch the next photo after unmount when the current fetch fails', async () => {
    let rejectFirst: ((reason: Error) => void) | undefined;
    fetchMock.mockResolvedValue([
      {
        id: 'm1',
        name: 'Ada',
        text: '',
        createdAt: '2026-08-28T12:00:00.000Z',
        hasPhoto: true,
      },
      {
        id: 'm2',
        name: 'Ada',
        text: '',
        createdAt: '2026-08-28T12:01:00.000Z',
        hasPhoto: true,
      },
    ]);
    photoMock.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectFirst = reject;
        }),
    );
    const view = renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(photoMock).toHaveBeenCalledTimes(1);
    });
    view.unmount();
    rejectFirst?.(new Error('gone'));
    await Promise.resolve();
    expect(photoMock).toHaveBeenCalledTimes(1);
  });

  it('revokes a photo blob if unmount happens during createObjectURL', async () => {
    let resolvePhoto: ((value: Blob) => void) | undefined;
    fetchMock.mockResolvedValue([
      {
        id: 'm-photo',
        name: 'Ada',
        text: '',
        createdAt: '2026-08-28T12:00:00.000Z',
        hasPhoto: true,
      },
    ]);
    photoMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePhoto = resolve;
        }),
    );
    const view = renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(photoMock).toHaveBeenCalled();
    });
    const revoke = vi.mocked(URL.revokeObjectURL);
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      view.unmount();
      return 'blob:late';
    });
    resolvePhoto?.(new Blob([new Uint8Array([1])], { type: 'image/jpeg' }));
    await Promise.resolve();
    expect(revoke).toHaveBeenCalledWith('blob:late');
  });

  it('posts a photo-only message and shows the preview immediately', async () => {
    fetchMock.mockResolvedValue([]);
    prepareMock.mockResolvedValue({
      ok: true,
      photo: {
        contentType: 'image/jpeg',
        data: 'abc',
        previewUrl: 'data:image/jpeg;base64,abc',
      },
    });
    const created: ForumMessage = {
      id: 'm-photo',
      name: 'Ada',
      text: '',
      createdAt: '2026-08-28T14:00:00.000Z',
      sats: 0,
      payable: false,
      hasPhoto: true,
    };
    postMock.mockResolvedValue(created);
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet. Be the first to write.')).toBeTruthy();
    });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File([new Uint8Array([1])], 'a.jpg', { type: 'image/jpeg' })] },
    });
    await waitFor(() => {
      expect(screen.getByAltText('Selected photo')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('sess', {
        text: '',
        photo: { contentType: 'image/jpeg', data: 'abc' },
      });
      expect(screen.getByAltText('Photo from Ada').getAttribute('src')).toBe(
        'data:image/jpeg;base64,abc',
      );
      expect(screen.getByRole('button', { name: 'All' }).getAttribute('aria-pressed')).toBe(
        'true',
      );
    });
  });

  it('switches to All after posting an unpaid note', async () => {
    fetchMock.mockResolvedValue([]);
    const created: ForumMessage = {
      id: 'm-unpaid',
      name: 'Ada',
      text: 'Unpaid note',
      createdAt: '2026-08-28T14:00:00.000Z',
      sats: 0,
      payable: false,
      hasPhoto: false,
    };
    postMock.mockResolvedValue(created);
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet. Be the first to write.')).toBeTruthy();
    });
    expect(screen.getByRole('button', { name: 'Active' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Unpaid note' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    await waitFor(() => {
      expect(screen.getByText('Unpaid note')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'All' }).getAttribute('aria-pressed')).toBe(
        'true',
      );
    });
  });

  it('does not cancel an in-flight photo fetch when payable poll refreshes the list', async () => {
    vi.useFakeTimers();
    let resolvePhoto: ((value: Blob) => void) | undefined;
    const withPhoto: ForumMessage = {
      id: 'm-photo',
      name: 'Ada',
      text: 'Hi',
      createdAt: '2026-08-28T12:00:00.000Z',
      sats: 5,
      payable: false,
      hasPhoto: true,
    };
    const refreshed: ForumMessage = { ...withPhoto, payable: true };
    fetchMock.mockResolvedValueOnce([withPhoto]);
    photoMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePhoto = resolve;
        }),
    );
    fetchMock.mockResolvedValueOnce([refreshed]);
    renderWithLocale(<ForumLoader />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(photoMock).toHaveBeenCalledWith('sess', 'm-photo');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await act(async () => {
      resolvePhoto?.(new Blob([new Uint8Array([1])], { type: 'image/jpeg' }));
      await Promise.resolve();
    });
    expect(screen.getByAltText('Photo from Ada').getAttribute('src')).toBe('blob:mock');
  });

  it('does not replace an existing photo blob with the composer preview', async () => {
    const created: ForumMessage = {
      id: 'm-photo',
      name: 'Ada',
      text: '',
      createdAt: '2026-08-28T14:00:00.000Z',
      sats: 5,
      payable: false,
      hasPhoto: true,
    };
    fetchMock.mockResolvedValue([created]);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:existing');
    prepareMock.mockResolvedValue({
      ok: true,
      photo: {
        contentType: 'image/jpeg',
        data: 'abc',
        previewUrl: 'data:image/jpeg;base64,abc',
      },
    });
    postMock.mockResolvedValue(created);
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByAltText('Photo from Ada').getAttribute('src')).toBe('blob:existing');
    });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File([new Uint8Array([1])], 'a.jpg', { type: 'image/jpeg' })] },
    });
    await waitFor(() => {
      expect(screen.getByAltText('Selected photo')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    await waitFor(() => {
      expect(postMock).toHaveBeenCalled();
    });
    expect(screen.getByAltText('Photo from Ada').getAttribute('src')).toBe('blob:existing');
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
      hasPhoto: false,
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
      hasPhoto: false,
    };
    const fromServer: ForumMessage = {
      id: 'm1',
      name: 'Bob',
      text: 'Hello from Ada',
      createdAt: '2026-08-28T12:00:00.000Z',
      sats: 0,
      payable: true,
      hasPhoto: false,
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
      hasPhoto: false,
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
      hasPhoto: false,
    };
    fetchMock.mockResolvedValue([created]);
    postMock.mockResolvedValue(created);
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages with sats yet.')).toBeTruthy();
    });
    await revealAll();
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

  it('posts a trimmed message, shows it as the newest row at the bottom, and clears the draft', async () => {
    fetchMock.mockResolvedValue([]);
    const created: ForumMessage = {
      id: 'm2',
      name: 'Ada',
      text: 'Hello',
      createdAt: '2026-08-28T14:00:00.000Z',
      sats: 0,
      payable: false,
      hasPhoto: false,
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
    expect(postMock).toHaveBeenCalledWith('sess', { text: 'Hello' });
    expect((screen.getByLabelText('Your message') as HTMLTextAreaElement).value).toBe('');
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(1);
    expect(items[0]!.textContent).toContain('Hello');
  });

  it('keeps an existing note above a newly posted note in the list', async () => {
    fetchMock.mockResolvedValue([SAMPLE]);
    const created: ForumMessage = {
      id: 'm2',
      name: 'Ada',
      text: 'New note',
      createdAt: '2026-08-28T14:00:00.000Z',
      sats: 0,
      payable: false,
      hasPhoto: false,
    };
    postMock.mockResolvedValue(created);
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages with sats yet.')).toBeTruthy();
    });
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'New note' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));

    await waitFor(() => {
      expect(screen.getByText('New note')).toBeTruthy();
    });
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]!.textContent).toContain('Hello from Ada');
    expect(items[1]!.textContent).toContain('New note');
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
        hasPhoto: false,
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
      expect(screen.getByText('No messages with sats yet.')).toBeTruthy();
    });
    await revealAll();
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
    expect(
      (screen.getByRole('button', { name: 'Send Bitcoin' }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it('rejects a non-positive pay amount before calling the api', async () => {
    fetchMock.mockResolvedValue([SAMPLE]);
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages with sats yet.')).toBeTruthy();
    });
    await revealAll();
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
      expect(screen.getByText('No messages with sats yet.')).toBeTruthy();
    });
    await revealAll();
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
      expect(screen.getByText('No messages with sats yet.')).toBeTruthy();
    });
    await revealAll();
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
      expect(screen.getByText('No messages with sats yet.')).toBeTruthy();
    });
    await revealAll();
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

  it('clears an in-flight pay sheet when Active hides the note', async () => {
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
      expect(screen.getByText('No messages with sats yet.')).toBeTruthy();
    });
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send Bitcoin' }));
    fireEvent.change(screen.getByLabelText('Amount (sats)'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Active' }));
    expect(screen.getByText('No messages with sats yet.')).toBeTruthy();
    expect(screen.queryByLabelText('Amount (sats)')).toBeNull();
    expect(screen.queryByRole('img', { name: 'Bitcoin payment QR code' })).toBeNull();
    expect(invoiceMock).toHaveBeenCalledTimes(1);
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
      expect(screen.getByText('No messages with sats yet.')).toBeTruthy();
    });
    await revealAll();
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

  it('omits Send Bitcoin while a loaded note is not payable', async () => {
    fetchMock.mockResolvedValue([{ ...SAMPLE, payable: false }]);
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages with sats yet.')).toBeTruthy();
    });
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });
    expect(screen.queryByRole('button', { name: 'Send Bitcoin' })).toBeNull();
    expect(invoiceMock).not.toHaveBeenCalled();
  });

  it('enables Send Bitcoin after payable poll upgrades an unsigned post', async () => {
    vi.useFakeTimers();
    const unsigned: ForumMessage = {
      id: 'm2',
      name: 'Ada',
      text: 'Hello',
      createdAt: '2026-08-28T14:00:00.000Z',
      sats: 0,
      payable: false,
      hasPhoto: false,
    };
    const signed: ForumMessage = { ...unsigned, payable: true };
    fetchMock.mockResolvedValueOnce([]);
    postMock.mockResolvedValue(unsigned);
    fetchMock.mockResolvedValueOnce([signed]);

    renderWithLocale(<ForumLoader />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText('No messages yet. Be the first to write.')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText('Hello')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Send Bitcoin' })).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(screen.getByRole('button', { name: 'Send Bitcoin' })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps polling when the first payable poll GET returns empty before the note is echoed', async () => {
    vi.useFakeTimers();
    const unsigned: ForumMessage = {
      id: 'm2',
      name: 'Ada',
      text: 'Hello',
      createdAt: '2026-08-28T14:00:00.000Z',
      sats: 0,
      payable: false,
      hasPhoto: false,
    };
    const signed: ForumMessage = { ...unsigned, payable: true };
    fetchMock.mockResolvedValueOnce([]);
    postMock.mockResolvedValue(unsigned);
    fetchMock.mockResolvedValueOnce([]);
    fetchMock.mockResolvedValueOnce([signed]);

    renderWithLocale(<ForumLoader />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText('No messages yet. Be the first to write.')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText('Hello')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Send Bitcoin' })).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(screen.getByText('Hello')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Send Bitcoin' })).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(screen.getByRole('button', { name: 'Send Bitcoin' })).toBeTruthy();
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('stops the payable poll once every listed row is payable', async () => {
    vi.useFakeTimers();
    const unsigned: ForumMessage = { ...SAMPLE, payable: false };
    const signed: ForumMessage = { ...SAMPLE, payable: true };
    fetchMock.mockResolvedValueOnce([unsigned]);
    fetchMock.mockResolvedValueOnce([signed]);

    renderWithLocale(<ForumLoader />);
    await act(async () => {
      await Promise.resolve();
    });
    await revealAll();
    expect(screen.getByText('Hello from Ada')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Send Bitcoin' })).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(screen.getByRole('button', { name: 'Send Bitcoin' })).toBeTruthy();
    const callsAfterFirstPoll = fetchMock.mock.calls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000 * 8);
    });
    expect(fetchMock.mock.calls.length).toBe(callsAfterFirstPoll);
  });

  it('keeps the board when a payable poll fetch fails', async () => {
    vi.useFakeTimers();
    const unsigned: ForumMessage = {
      id: 'm2',
      name: 'Ada',
      text: 'Hello',
      createdAt: '2026-08-28T14:00:00.000Z',
      sats: 0,
      payable: false,
      hasPhoto: false,
    };
    const signed: ForumMessage = { ...unsigned, payable: true };
    fetchMock.mockResolvedValueOnce([]);
    postMock.mockResolvedValue(unsigned);
    fetchMock.mockRejectedValueOnce(new Error('poll failed'));
    fetchMock.mockResolvedValueOnce([signed]);

    renderWithLocale(<ForumLoader />);
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText('Hello')).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(screen.getByText('Hello')).toBeTruthy();
    expect(screen.queryByText('Could not load messages. Please try again.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Send Bitcoin' })).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(screen.getByRole('button', { name: 'Send Bitcoin' })).toBeTruthy();
    expect(screen.queryByText('Could not load messages. Please try again.')).toBeNull();
  });

  it('aborts the payable poll after unmount before the delayed fetch', async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValueOnce([{ ...SAMPLE, payable: false }]);

    renderWithLocale(<ForumLoader />);
    await act(async () => {
      await Promise.resolve();
    });
    await revealAll();
    expect(screen.getByText('Hello from Ada')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Send Bitcoin' })).toBeNull();

    cleanup();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('ignores a payable poll fetch that resolves after unmount', async () => {
    vi.useFakeTimers();
    let resolvePoll: ((value: ForumMessage[]) => void) | undefined;
    fetchMock.mockResolvedValueOnce([{ ...SAMPLE, payable: false }]);
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePoll = resolve;
        }),
    );

    renderWithLocale(<ForumLoader />);
    await act(async () => {
      await Promise.resolve();
    });
    await revealAll();
    expect(screen.getByText('Hello from Ada')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Send Bitcoin' })).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    cleanup();

    await act(async () => {
      resolvePoll?.([{ ...SAMPLE, payable: true }]);
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not request a second invoice while one is in flight', async () => {
    fetchMock.mockResolvedValue([SAMPLE]);
    invoiceMock.mockReturnValue(new Promise(() => undefined));
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages with sats yet.')).toBeTruthy();
    });
    await revealAll();
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
