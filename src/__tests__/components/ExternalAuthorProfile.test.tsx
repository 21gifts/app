import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithLocale } from '@/__tests__/render-with-locale';
import type { ForumMessage } from '@/lib/api-types';

const push = vi.fn();
const refresh = vi.fn();

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    onClick,
    ...rest
  }: {
    href: string;
    children: ReactNode;
    onClick?: (event: { stopPropagation: () => void }) => void;
  }) => (
    <a href={href} onClick={onClick} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('next/navigation', () => ({
  useRouter: (): { push: typeof push; replace: typeof push; refresh: typeof refresh } => ({
    push,
    replace: push,
    refresh,
  }),
  usePathname: (): string => '/',
  useSearchParams: (): URLSearchParams => new URLSearchParams(),
}));

vi.mock('@/lib/api', () => ({
  fetchExternalAuthorProfile: vi.fn(),
  fetchExternalAuthorPosts: vi.fn(),
  fetchExternalAuthorReplies: vi.fn(),
  fetchGiftStats: vi.fn(),
  fetchFxSpot: vi
    .fn()
    .mockResolvedValue({ asOf: '2026-10-07T00:00:00.000Z', source: 'test', rates: {} }),
  fetchPublicMessage: vi.fn(),
  fetchPublicMessagePhoto: vi.fn(),
  fetchForumMessage: vi.fn(),
  fetchShortLink: vi.fn(),
  setMessagePlace: vi.fn(),
  setMessageShopAccount: vi.fn(),
  deleteMessage: vi.fn(),
}));

import {
  fetchExternalAuthorPosts,
  fetchExternalAuthorProfile,
  fetchExternalAuthorReplies,
  fetchGiftStats,
  fetchFxSpot,
} from '@/lib/api';
import { ExternalAuthorProfile } from '@/components/ExternalAuthorProfile';

const fetchProfile = vi.mocked(fetchExternalAuthorProfile);
const fetchPosts = vi.mocked(fetchExternalAuthorPosts);
const fetchReplies = vi.mocked(fetchExternalAuthorReplies);
const fetchStats = vi.mocked(fetchGiftStats);

const FEED_NOTE: ForumMessage = {
  id: 'note-1',
  name: 'Robin',
  text: 'Hello from Robin',
  createdAt: '2026-08-28T12:00:00.000Z',
  sats: 0,
  payable: false,
  hasPhoto: false,
  hasVideo: false,
  videoContentType: null,
  role: 'basis',
  replyCount: 0,
  photoCount: 0,
};

const COUNT_BUTTON = /^\d+ posts?$/;
const REACTION_BUTTON = /^\d+ reactions?$/;

const HINT =
  'Wrote from another app, not from a 21.gifts account. Shown here because this person sent bitcoin to a post.';

beforeEach(() => {
  vi.mocked(fetchFxSpot)
    .mockReset()
    .mockResolvedValue({ asOf: '2026-10-07T00:00:00.000Z', source: 'test', rates: {} });
  fetchStats.mockResolvedValue({ spendOverTime: [] } as never);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  push.mockClear();
  fetchPosts.mockReset();
  fetchReplies.mockReset();
  fetchStats.mockReset();
});

describe('ExternalAuthorProfile', () => {
  it('shows the fallback name until the profile loads, then the profile fields', async () => {
    let resolveProfile!: (value: Awaited<ReturnType<typeof fetchProfile>>) => void;
    fetchProfile.mockReturnValue(
      new Promise((resolve) => {
        resolveProfile = resolve;
      }),
    );
    renderWithLocale(<ExternalAuthorProfile messageId="m1" fallbackName="Ada" />);
    expect(screen.getByRole('heading', { name: 'Profile' })).toBeTruthy();
    expect(screen.getByText('Ada')).toBeTruthy();
    expect(screen.getByText('External')).toBeTruthy();
    expect(screen.queryByText(HINT)).toBeNull();
    expect(screen.queryByText('Verified Nostr address')).toBeNull();
    expect(screen.queryByText('Payment address on their profile')).toBeNull();
    expect(screen.queryByText('Nostr key')).toBeNull();
    resolveProfile({
      name: 'Robin',
      npub: 'npub1example',
      nip05: 'ada@nostr.example',
      lud16: 'pay@ln.example',
    });
    await waitFor(() => {
      expect(screen.getByText('Robin')).toBeTruthy();
    });
    expect(screen.getByRole('heading', { name: 'Profile' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Ada' })).toBeNull();
    expect(screen.getByText('External')).toBeTruthy();
    expect(screen.getByText('Verified Nostr address')).toBeTruthy();
    expect(screen.getByText('Payment address on their profile')).toBeTruthy();
    expect(screen.getByText('Nostr key')).toBeTruthy();
    expect(screen.getByText('ada@nostr.example')).toBeTruthy();
    expect(screen.getByText('pay@ln.example')).toBeTruthy();
    expect(screen.getByText('npub1example')).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
    expect(document.querySelector('img')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
  });

  it('hides the payment address when lud16 matches nip05 case-insensitively', async () => {
    fetchProfile.mockResolvedValue({
      name: 'Robin',
      npub: 'npub1example',
      nip05: 'ada@nostr.example',
      lud16: 'Ada@Nostr.example',
    });
    renderWithLocale(<ExternalAuthorProfile messageId="m1" fallbackName="Ada" />);
    await waitFor(() => {
      expect(screen.getByText('Verified Nostr address')).toBeTruthy();
    });
    expect(screen.getByText('ada@nostr.example')).toBeTruthy();
    expect(screen.getByText('Nostr key')).toBeTruthy();
    expect(screen.getByText('npub1example')).toBeTruthy();
    expect(screen.queryByText('Payment address on their profile')).toBeNull();
  });

  it('hides verified and payment addresses that are only whitespace', async () => {
    fetchProfile.mockResolvedValue({
      name: 'Robin',
      npub: 'npub1example',
      nip05: '   ',
      lud16: '\t',
    });
    renderWithLocale(<ExternalAuthorProfile messageId="m1" fallbackName="Ada" />);
    await waitFor(() => {
      expect(screen.getByText('Robin')).toBeTruthy();
    });
    expect(screen.getByText('Nostr key')).toBeTruthy();
    expect(screen.getByText('npub1example')).toBeTruthy();
    expect(screen.queryByText('Verified Nostr address')).toBeNull();
    expect(screen.queryByText('Payment address on their profile')).toBeNull();
  });

  it('shows a trimmed address and hides a payment address that matches only after trim', async () => {
    fetchProfile.mockResolvedValue({
      name: 'Robin',
      npub: 'npub1example',
      nip05: '  ada@nostr.example  ',
      lud16: ' Ada@Nostr.example ',
    });
    renderWithLocale(<ExternalAuthorProfile messageId="m1" fallbackName="Ada" />);
    await waitFor(() => {
      expect(screen.getByText('Verified Nostr address')).toBeTruthy();
    });
    expect(screen.getByText('Verified Nostr address').nextElementSibling?.textContent).toBe(
      'ada@nostr.example',
    );
    expect(screen.queryByText('Payment address on their profile')).toBeNull();
  });

  it('keeps the fallback name when the fetch returns null', async () => {
    fetchProfile.mockResolvedValue(null);
    renderWithLocale(<ExternalAuthorProfile messageId="m1" fallbackName="Ada" />);
    await waitFor(() => {
      expect(fetchProfile).toHaveBeenCalledWith('m1');
    });
    expect(screen.getByRole('heading', { name: 'Profile' })).toBeTruthy();
    expect(screen.getByText('Ada')).toBeTruthy();
    expect(screen.getByText('External')).toBeTruthy();
    expect(screen.queryByText('Verified Nostr address')).toBeNull();
    expect(screen.queryByText('Payment address on their profile')).toBeNull();
    expect(screen.queryByText('Nostr key')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows Unnamed when the fallback is empty and the fetch returns null', async () => {
    fetchProfile.mockResolvedValue(null);
    renderWithLocale(<ExternalAuthorProfile messageId="m1" fallbackName="" />);
    await waitFor(() => {
      expect(fetchProfile).toHaveBeenCalledWith('m1');
    });
    expect(screen.getByText('Unnamed')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Profile' })).toBeTruthy();
    expect(screen.getByText('External')).toBeTruthy();
  });

  it('copies the npub and changes the Copy label to Copied', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    fetchProfile.mockResolvedValue({
      name: 'Robin',
      npub: 'npub1example',
    });
    renderWithLocale(<ExternalAuthorProfile messageId="m1" fallbackName="Ada" />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
    });
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(writeText).toHaveBeenCalledWith('npub1example');
    expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Copied' }));
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      vi.advanceTimersByTime(1200);
    });
    expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
  });

  it('clears the copy timer when the card unmounts', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    fetchProfile.mockResolvedValue({
      name: 'Robin',
      npub: 'npub1example',
    });
    const view = renderWithLocale(<ExternalAuthorProfile messageId="m1" fallbackName="Ada" />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
    });
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy();
    view.unmount();
    await act(async () => {
      vi.advanceTimersByTime(1200);
    });
  });

  it('does not flash Copied when the card unmounts before the clipboard answers', async () => {
    let resolveWrite!: () => void;
    let rejectWrite!: (error: Error) => void;
    const writeText = vi.fn(
      () =>
        new Promise<void>((resolve, reject) => {
          resolveWrite = resolve;
          rejectWrite = reject;
        }),
    );
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const exec = vi.fn<(commandId: string) => boolean>().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      writable: true,
      value: exec,
    });
    fetchProfile.mockResolvedValue({
      name: 'Robin',
      npub: 'npub1example',
    });
    const view = renderWithLocale(<ExternalAuthorProfile messageId="m1" fallbackName="Ada" />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    view.unmount();
    await act(async () => {
      resolveWrite();
      await Promise.resolve();
    });
    expect(exec).not.toHaveBeenCalled();

    const again = renderWithLocale(<ExternalAuthorProfile messageId="m1" fallbackName="Ada" />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    again.unmount();
    await act(async () => {
      rejectWrite(new Error('denied'));
      await Promise.resolve();
    });
    expect(exec).not.toHaveBeenCalled();
  });

  it('does not flash Copied when the note changes before the clipboard answers', async () => {
    let resolveWrite!: () => void;
    let rejectWrite!: (error: Error) => void;
    const writeText = vi.fn(
      () =>
        new Promise<void>((resolve, reject) => {
          resolveWrite = resolve;
          rejectWrite = reject;
        }),
    );
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const exec = vi.fn<(commandId: string) => boolean>().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      writable: true,
      value: exec,
    });
    fetchProfile.mockImplementation((id: string) => {
      if (id === 'm1') {
        return Promise.resolve({ name: 'Robin', npub: 'npub1example' });
      }
      if (id === 'm2') {
        return Promise.resolve({ name: 'Bea', npub: 'npub1other' });
      }
      return new Promise(() => undefined);
    });
    const view = renderWithLocale(<ExternalAuthorProfile messageId="m1" fallbackName="Ada" />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    view.rerender(<ExternalAuthorProfile messageId="m2" fallbackName="Ada" />);
    await waitFor(() => {
      expect(screen.getByText('Bea')).toBeTruthy();
    });
    await act(async () => {
      resolveWrite();
      await Promise.resolve();
    });
    expect(screen.queryByRole('button', { name: 'Copied' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    view.rerender(<ExternalAuthorProfile messageId="m3" fallbackName="Ada" />);
    await act(async () => {
      rejectWrite(new Error('denied'));
      await Promise.resolve();
    });
    expect(exec).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Copied' })).toBeNull();
  });

  it('clears the copy timer when the note changes', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    fetchProfile.mockImplementation((id: string) =>
      Promise.resolve({
        name: id === 'm1' ? 'Robin' : 'Bea',
        npub: id === 'm1' ? 'npub1example' : 'npub1other',
      }),
    );
    const view = renderWithLocale(<ExternalAuthorProfile messageId="m1" fallbackName="Ada" />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
    });
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy();
    await act(async () => {
      view.rerender(<ExternalAuthorProfile messageId="m2" fallbackName="Ada" />);
      await Promise.resolve();
    });
    expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
    await act(async () => {
      vi.advanceTimersByTime(1200);
    });
    expect(screen.queryByRole('button', { name: 'Copied' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
  });

  it('copies through the textarea fallback when the clipboard rejects', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const exec = vi.fn<(commandId: string) => boolean>().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      writable: true,
      value: exec,
    });
    fetchProfile.mockResolvedValue({
      name: 'Robin',
      npub: 'npub1example',
    });
    renderWithLocale(<ExternalAuthorProfile messageId="m1" fallbackName="Ada" />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(() => {
      expect(exec).toHaveBeenCalledWith('copy');
      expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy();
    });
  });

  it('keeps Copy when the textarea fallback throws', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const exec = vi.fn<(commandId: string) => boolean>().mockImplementation(() => {
      throw new Error('copy failed');
    });
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      writable: true,
      value: exec,
    });
    fetchProfile.mockResolvedValue({
      name: 'Robin',
      npub: 'npub1example',
    });
    renderWithLocale(<ExternalAuthorProfile messageId="m1" fallbackName="Ada" />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(() => {
      expect(exec).toHaveBeenCalledWith('copy');
    });
    expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Copied' })).toBeNull();
  });

  it('ignores a profile that arrives after the card unmounts', async () => {
    let resolveProfile!: (value: Awaited<ReturnType<typeof fetchProfile>>) => void;
    const pending = new Promise<Awaited<ReturnType<typeof fetchProfile>>>((resolve) => {
      resolveProfile = resolve;
    });
    fetchProfile.mockReturnValue(pending);
    const view = renderWithLocale(<ExternalAuthorProfile messageId="m1" fallbackName="Ada" />);
    view.unmount();
    await act(async () => {
      resolveProfile({ name: 'Robin', npub: 'npub1example' });
      await pending;
    });
    expect(screen.queryByRole('heading', { name: 'Robin' })).toBeNull();
    expect(screen.queryByText('Robin')).toBeNull();
  });

  it('hides count buttons and the feed when the profile JSON has no counts', async () => {
    fetchProfile.mockResolvedValue({
      name: 'Robin',
      npub: 'npub1example',
    });
    renderWithLocale(<ExternalAuthorProfile messageId="m1" fallbackName="Ada" />);
    await waitFor(() => {
      expect(screen.getByText('npub1example')).toBeTruthy();
    });
    expect(screen.queryByRole('button', { name: COUNT_BUTTON })).toBeNull();
    expect(screen.queryByRole('button', { name: REACTION_BUTTON })).toBeNull();
    expect(screen.queryByText(FEED_NOTE.text)).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('hides count buttons when only postCount is present', async () => {
    fetchProfile.mockResolvedValue({
      name: 'Robin',
      npub: 'npub1example',
      postCount: 2,
    });
    renderWithLocale(<ExternalAuthorProfile messageId="m1" fallbackName="Ada" />);
    await waitFor(() => {
      expect(screen.getByText('npub1example')).toBeTruthy();
    });
    expect(screen.queryByRole('button', { name: COUNT_BUTTON })).toBeNull();
    expect(screen.queryByRole('button', { name: REACTION_BUTTON })).toBeNull();
  });

  it('shows 2 posts and 0 reactions without opening the feed', async () => {
    fetchProfile.mockResolvedValue({
      name: 'Robin',
      npub: 'npub1example',
      postCount: 2,
      replyCount: 0,
    });
    renderWithLocale(<ExternalAuthorProfile messageId="m1" fallbackName="Ada" />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '2 posts' })).toBeTruthy();
    });
    expect(screen.getByRole('button', { name: '0 reactions', pressed: false })).toBeTruthy();
    expect(screen.getByRole('button', { name: '2 posts' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
    expect(screen.queryByText(FEED_NOTE.text)).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('loads posts, marks the button pressed, and shows the truncated status line', async () => {
    fetchProfile.mockResolvedValue({
      name: 'Robin',
      npub: 'npub1example',
      postCount: 2,
      replyCount: 0,
    });
    fetchPosts.mockResolvedValue([FEED_NOTE]);
    renderWithLocale(<ExternalAuthorProfile messageId="m1" fallbackName="Ada" />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '2 posts' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: '2 posts' }));
    await waitFor(() => {
      expect(screen.getByText(FEED_NOTE.text)).toBeTruthy();
    });
    expect(fetchPosts).toHaveBeenCalledWith('m1');
    expect(screen.getByRole('button', { name: '2 posts' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(screen.getByRole('status').textContent).toBe('Showing the latest 1 of 2.');
    expect(screen.queryByRole('button', { name: 'React' })).toBeNull();
  });

  it('omits the truncated status line when the loaded list is not shorter than the count', async () => {
    fetchProfile.mockResolvedValue({
      name: 'Robin',
      npub: 'npub1example',
      postCount: 1,
      replyCount: 0,
    });
    fetchPosts.mockResolvedValue([FEED_NOTE]);
    fetchReplies.mockResolvedValue([]);
    renderWithLocale(<ExternalAuthorProfile messageId="m1" fallbackName="Ada" />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '1 post' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: '1 post' }));
    await waitFor(() => {
      expect(screen.getByText(FEED_NOTE.text)).toBeTruthy();
    });
    expect(screen.queryByRole('status')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '0 reactions', pressed: false }));
    await waitFor(() => {
      expect(fetchReplies).toHaveBeenCalledWith('m1');
    });
    expect(screen.queryByText(FEED_NOTE.text)).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('closes the posts feed without refetching when the pressed button is clicked again', async () => {
    fetchProfile.mockResolvedValue({
      name: 'Robin',
      npub: 'npub1example',
      postCount: 2,
      replyCount: 0,
    });
    fetchPosts.mockResolvedValue([FEED_NOTE]);
    renderWithLocale(<ExternalAuthorProfile messageId="m1" fallbackName="Ada" />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '2 posts' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: '2 posts' }));
    await waitFor(() => {
      expect(screen.getByText(FEED_NOTE.text)).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: '2 posts' }));
    expect(screen.queryByText(FEED_NOTE.text)).toBeNull();
    expect(fetchPosts).toHaveBeenCalledTimes(1);
  });

  it('reopens a loaded posts feed without calling the fetcher again', async () => {
    fetchProfile.mockResolvedValue({
      name: 'Robin',
      npub: 'npub1example',
      postCount: 2,
      replyCount: 0,
    });
    fetchPosts.mockResolvedValue([FEED_NOTE]);
    renderWithLocale(<ExternalAuthorProfile messageId="m1" fallbackName="Ada" />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '2 posts' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: '2 posts' }));
    await waitFor(() => {
      expect(screen.getByText(FEED_NOTE.text)).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: '2 posts' }));
    expect(screen.queryByText(FEED_NOTE.text)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '2 posts' }));
    expect(screen.getByText(FEED_NOTE.text)).toBeTruthy();
    expect(fetchPosts).toHaveBeenCalledTimes(1);
  });

  it('keeps one in-flight posts load when the panel is closed and opened again', async () => {
    fetchProfile.mockResolvedValue({
      name: 'Robin',
      npub: 'npub1example',
      postCount: 2,
      replyCount: 0,
    });
    let resolvePosts!: (value: ForumMessage[]) => void;
    fetchPosts.mockReturnValue(
      new Promise((resolve) => {
        resolvePosts = resolve;
      }),
    );
    renderWithLocale(<ExternalAuthorProfile messageId="m1" fallbackName="Ada" />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '2 posts' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: '2 posts' }));
    expect(screen.getByText('Loading…')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '2 posts' }));
    expect(screen.queryByText('Loading…')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '2 posts' }));
    expect(screen.getByText('Loading…')).toBeTruthy();
    expect(fetchPosts).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolvePosts([FEED_NOTE]);
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(screen.getByText(FEED_NOTE.text)).toBeTruthy();
    });
  });

  it('reopens a loaded replies feed without calling the fetcher again', async () => {
    fetchProfile.mockResolvedValue({
      name: 'Robin',
      npub: 'npub1example',
      postCount: 1,
      replyCount: 1,
    });
    fetchReplies.mockResolvedValue([
      {
        ...FEED_NOTE,
        id: 'reply-1',
        text: 'A reply from Robin',
        parentId: 'parent-1',
      },
    ]);
    renderWithLocale(<ExternalAuthorProfile messageId="m1" fallbackName="Ada" />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '1 reaction' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: '1 reaction' }));
    await waitFor(() => {
      expect(screen.getByText('A reply from Robin')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: '1 reaction' }));
    expect(screen.queryByText('A reply from Robin')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '1 reaction' }));
    expect(screen.getByText('A reply from Robin')).toBeTruthy();
    expect(fetchReplies).toHaveBeenCalledTimes(1);
  });

  it('keeps one in-flight replies load when the panel is closed and opened again', async () => {
    fetchProfile.mockResolvedValue({
      name: 'Robin',
      npub: 'npub1example',
      postCount: 1,
      replyCount: 1,
    });
    let resolveReplies!: (value: ForumMessage[]) => void;
    fetchReplies.mockReturnValue(
      new Promise((resolve) => {
        resolveReplies = resolve;
      }),
    );
    renderWithLocale(<ExternalAuthorProfile messageId="m1" fallbackName="Ada" />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '1 reaction' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: '1 reaction' }));
    expect(screen.getByText('Loading…')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '1 reaction' }));
    expect(screen.queryByText('Loading…')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '1 reaction' }));
    expect(screen.getByText('Loading…')).toBeTruthy();
    expect(fetchReplies).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveReplies([
        {
          ...FEED_NOTE,
          id: 'reply-1',
          text: 'A reply from Robin',
          parentId: 'parent-1',
        },
      ]);
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(screen.getByText('A reply from Robin')).toBeTruthy();
    });
  });

  it('shows the truncated status line for a shorter replies list', async () => {
    fetchProfile.mockResolvedValue({
      name: 'Robin',
      npub: 'npub1example',
      postCount: 1,
      replyCount: 2,
    });
    fetchReplies.mockResolvedValue([
      {
        ...FEED_NOTE,
        id: 'reply-1',
        text: 'A reply from Robin',
        parentId: 'parent-1',
      },
    ]);
    renderWithLocale(<ExternalAuthorProfile messageId="m1" fallbackName="Ada" />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '2 reactions' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: '2 reactions' }));
    await waitFor(() => {
      expect(screen.getByText('A reply from Robin')).toBeTruthy();
    });
    expect(screen.getByRole('status').textContent).toBe('Showing the latest 1 of 2.');
  });

  it('opens a reply with a parentId to that parent on expand', async () => {
    fetchProfile.mockResolvedValue({
      name: 'Robin',
      npub: 'npub1example',
      postCount: 1,
      replyCount: 1,
    });
    fetchReplies.mockResolvedValue([
      {
        ...FEED_NOTE,
        id: 'reply-1',
        text: 'A reply from Robin',
        parentId: 'parent-1',
      },
    ]);
    renderWithLocale(<ExternalAuthorProfile messageId="m1" fallbackName="Ada" />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '1 reaction' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: '1 reaction' }));
    await waitFor(() => {
      expect(screen.getByText('A reply from Robin')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    expect(push).toHaveBeenCalledWith('/messages/parent-1');
  });

  it('does not navigate when a reply has no parentId', async () => {
    fetchProfile.mockResolvedValue({
      name: 'Robin',
      npub: 'npub1example',
      postCount: 1,
      replyCount: 1,
    });
    fetchReplies.mockResolvedValue([
      {
        ...FEED_NOTE,
        id: 'reply-1',
        text: 'A reply from Robin',
      },
    ]);
    renderWithLocale(<ExternalAuthorProfile messageId="m1" fallbackName="Ada" />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '1 reaction' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: '1 reaction' }));
    await waitFor(() => {
      expect(screen.getByText('A reply from Robin')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    expect(push).not.toHaveBeenCalled();
  });

  it('does not navigate when a reply parentId is only whitespace', async () => {
    fetchProfile.mockResolvedValue({
      name: 'Robin',
      npub: 'npub1example',
      postCount: 1,
      replyCount: 1,
    });
    fetchReplies.mockResolvedValue([
      {
        ...FEED_NOTE,
        id: 'reply-1',
        text: 'A reply from Robin',
        parentId: '   ',
      },
    ]);
    renderWithLocale(<ExternalAuthorProfile messageId="m1" fallbackName="Ada" />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '1 reaction' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: '1 reaction' }));
    await waitFor(() => {
      expect(screen.getByText('A reply from Robin')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    expect(push).not.toHaveBeenCalled();
  });

  it('opens a post expand control to that note', async () => {
    vi.mocked(fetchFxSpot).mockResolvedValue({
      asOf: '2026-10-07T00:00:00.000Z',
      source: 'test',
      rates: { USD: '100000.00', CHF: '80000.00', EUR: '90000.00', PHP: '5600000.00' },
    });
    fetchProfile.mockResolvedValue({
      name: 'Robin',
      npub: 'npub1example',
      postCount: 1,
      replyCount: 0,
    });
    fetchPosts.mockResolvedValue([FEED_NOTE]);
    renderWithLocale(<ExternalAuthorProfile messageId="m1" fallbackName="Ada" />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '1 post' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: '1 post' }));
    await waitFor(() => {
      expect(screen.getByText(FEED_NOTE.text)).toBeTruthy();
    });
    await waitFor(() => {
      expect(screen.getByText('$0.00')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    expect(push).toHaveBeenCalledWith('/messages/note-1');
  });

  it('retries a failed feed from Try again and from opening the panel again', async () => {
    fetchProfile.mockResolvedValue({
      name: 'Robin',
      npub: 'npub1example',
      postCount: 1,
      replyCount: 0,
    });
    fetchPosts
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce([FEED_NOTE]);
    renderWithLocale(<ExternalAuthorProfile messageId="m1" fallbackName="Ada" />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '1 post' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: '1 post' }));
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe(
        'Could not load messages. Please try again.',
      );
    });
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '1 post' }));
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '1 post' }));
    await waitFor(() => {
      expect(fetchPosts).toHaveBeenCalledTimes(2);
      expect(screen.getByRole('alert')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(screen.getByText(FEED_NOTE.text)).toBeTruthy();
    });
    expect(fetchPosts).toHaveBeenCalledTimes(3);
  });

  it('clears an open feed on messageId change and ignores a stale posts response', async () => {
    let resolveM2!: (value: {
      name: string;
      npub: string;
      postCount: number;
      replyCount: number;
    }) => void;
    fetchProfile.mockImplementation((id: string) => {
      if (id === 'm1') {
        return Promise.resolve({
          name: 'Robin',
          npub: 'npub1example',
          postCount: 1,
          replyCount: 0,
        });
      }
      return new Promise((resolve) => {
        resolveM2 = resolve;
      });
    });
    let resolvePosts!: (value: ForumMessage[]) => void;
    const postedIds: string[] = [];
    fetchPosts.mockImplementation((id: string) => {
      postedIds.push(id);
      if (id === 'm1') {
        return new Promise((resolve) => {
          resolvePosts = resolve;
        });
      }
      return new Promise(() => undefined);
    });
    const view = renderWithLocale(<ExternalAuthorProfile messageId="m1" fallbackName="Ada" />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '1 post' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: '1 post' }));
    expect(screen.getByText('Loading…')).toBeTruthy();
    view.rerender(<ExternalAuthorProfile messageId="m2" fallbackName="Ada" />);
    expect(screen.queryByText(FEED_NOTE.text)).toBeNull();
    expect(screen.queryByText('Loading…')).toBeNull();
    expect(screen.queryByText('npub1example')).toBeNull();
    expect(screen.queryByRole('button', { name: '1 post' })).toBeNull();
    expect(screen.getByText('Ada')).toBeTruthy();
    await act(async () => {
      resolveM2({ name: 'Bea', npub: 'npub1other', postCount: 1, replyCount: 0 });
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '1 post' })).toBeTruthy();
    });
    await act(async () => {
      resolvePosts([FEED_NOTE]);
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole('button', { name: '1 post' }));
    await waitFor(() => {
      expect(screen.getByText('Loading…')).toBeTruthy();
    });
    expect(screen.queryByText(FEED_NOTE.text)).toBeNull();
    expect(postedIds).toContain('m2');
  });

  it('ignores a stale replies response after the note changes', async () => {
    let resolveM2!: (value: {
      name: string;
      npub: string;
      postCount: number;
      replyCount: number;
    }) => void;
    fetchProfile.mockImplementation((id: string) => {
      if (id === 'm1') {
        return Promise.resolve({
          name: 'Robin',
          npub: 'npub1example',
          postCount: 0,
          replyCount: 1,
        });
      }
      return new Promise((resolve) => {
        resolveM2 = resolve;
      });
    });
    let resolveReplies!: (value: ForumMessage[]) => void;
    const repliedIds: string[] = [];
    fetchReplies.mockImplementation((id: string) => {
      repliedIds.push(id);
      if (id === 'm1') {
        return new Promise((resolve) => {
          resolveReplies = resolve;
        });
      }
      return new Promise(() => undefined);
    });
    const view = renderWithLocale(<ExternalAuthorProfile messageId="m1" fallbackName="Ada" />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '1 reaction' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: '1 reaction' }));
    expect(screen.getByText('Loading…')).toBeTruthy();
    view.rerender(<ExternalAuthorProfile messageId="m2" fallbackName="Ada" />);
    await act(async () => {
      resolveM2({ name: 'Bea', npub: 'npub1other', postCount: 0, replyCount: 1 });
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '1 reaction' })).toBeTruthy();
    });
    await act(async () => {
      resolveReplies([FEED_NOTE]);
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole('button', { name: '1 reaction' }));
    await waitFor(() => {
      expect(screen.getByText('Loading…')).toBeTruthy();
    });
    expect(screen.queryByText(FEED_NOTE.text)).toBeNull();
    expect(repliedIds).toContain('m2');
  });

  it('ignores a profile response from the previous note', async () => {
    let resolveM1!: (value: Awaited<ReturnType<typeof fetchProfile>>) => void;
    fetchProfile.mockImplementation((id: string) => {
      if (id === 'm1') {
        return new Promise((resolve) => {
          resolveM1 = resolve;
        });
      }
      return new Promise(() => undefined);
    });
    const view = renderWithLocale(<ExternalAuthorProfile messageId="m1" fallbackName="Ada" />);
    await waitFor(() => {
      expect(fetchProfile).toHaveBeenCalledWith('m1');
    });
    view.rerender(<ExternalAuthorProfile messageId="m2" fallbackName="Bea" />);
    expect(screen.getByText('Bea')).toBeTruthy();
    expect(screen.queryByText('Robin')).toBeNull();
    await act(async () => {
      resolveM1({ name: 'Robin', npub: 'npub1example' });
      await Promise.resolve();
    });
    expect(screen.queryByText('Robin')).toBeNull();
    expect(screen.queryByText('npub1example')).toBeNull();
    expect(screen.getByText('Bea')).toBeTruthy();
    expect(fetchProfile).toHaveBeenCalledWith('m2');
  });
});
