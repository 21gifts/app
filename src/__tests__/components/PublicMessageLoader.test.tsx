import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PublicMessageLoader } from '@/components/PublicMessageLoader';
import type { ForumMessage } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const MESSAGE_ID = '11111111-1111-4111-8111-111111111111';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/hooks/useHydrateSession', () => ({
  useHydrateSession: vi.fn((): { ready: boolean } => ({ ready: true })),
}));

vi.mock('@/lib/api', () => ({
  fetchPublicMessage: vi.fn(),
  fetchPublicMessagePhoto: vi.fn(),
  fetchPublicReplies: vi.fn(),
  fetchGiftStats: vi.fn().mockResolvedValue({ spendOverTime: [] }),
}));

import { useHydrateSession } from '@/hooks/useHydrateSession';
import { fetchPublicMessage, fetchPublicMessagePhoto, fetchPublicReplies } from '@/lib/api';

const fetchMessage = vi.mocked(fetchPublicMessage);
const fetchPhoto = vi.mocked(fetchPublicMessagePhoto);
const fetchRepliesPublic = vi.mocked(fetchPublicReplies);
const hydrate = vi.mocked(useHydrateSession);

const sample: ForumMessage = {
  id: MESSAGE_ID,
  name: 'Ada',
  text: 'Hello from Ada',
  createdAt: '2026-08-28T12:00:00.000Z',
  sats: 21,
  payable: false,
  hasPhoto: false,
  hasVideo: false,
  videoContentType: null,
  role: 'basis',
  replyCount: 0,
};

beforeEach(() => {
  useAuthStore.setState({ session: null, account: null });
  hydrate.mockReturnValue({ ready: true });
  fetchRepliesPublic.mockResolvedValue([]);
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: () => 'blob:public',
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    writable: true,
    value: () => undefined,
  });
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:public');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  fetchMessage.mockReset();
  fetchPhoto.mockReset();
  fetchRepliesPublic.mockReset();
  vi.restoreAllMocks();
});

describe('PublicMessageLoader', () => {
  it('treats a malformed id as missing without calling the api', () => {
    renderWithLocale(<PublicMessageLoader id="not-a-uuid" />);
    expect(screen.getByText('This profile could not be found.')).toBeTruthy();
    expect(fetchMessage).not.toHaveBeenCalled();
  });

  it('shows missing when fetchPublicMessage returns null', async () => {
    fetchMessage.mockResolvedValue(null);
    renderWithLocale(<PublicMessageLoader id={MESSAGE_ID} />);
    await waitFor(() => {
      expect(screen.getByText('This profile could not be found.')).toBeTruthy();
    });
    expect(fetchMessage).toHaveBeenCalledWith(MESSAGE_ID);
  });

  it('shows an error and retries', async () => {
    fetchMessage.mockRejectedValueOnce(new Error('boom'));
    fetchMessage.mockResolvedValueOnce(sample);
    renderWithLocale(<PublicMessageLoader id={MESSAGE_ID} />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    });
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toBe('Could not load this profile. Please try again.');
    expect(alert.className).toContain('text-app-danger');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });
    expect(fetchMessage).toHaveBeenCalledTimes(2);
  });

  it('renders the note card and a Log in link when logged out', async () => {
    fetchMessage.mockResolvedValue(sample);
    renderWithLocale(<PublicMessageLoader id={MESSAGE_ID} />);
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });
    expect(screen.getByText('Ada')).toBeTruthy();
    expect(screen.getByText('₿21')).toBeTruthy();
    const login = screen.getByRole('link', { name: 'Log in' });
    expect(login.getAttribute('href')).toBe('/login');
  });

  it('renders Back to the forum when signed in', async () => {
    useAuthStore.setState({
      session: 'sess',
      account: {
        id: 'acc_1',
        linkingKey: null,
        role: 'basis',
        name: 'Ada',
        location: null,
        lightningAddress: 'alice@walletofsatoshi.com',
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1,
        viewKey: 'a'.repeat(64),
        setup: null,
        missing: [],
      },
    });
    fetchMessage.mockResolvedValue(sample);
    renderWithLocale(<PublicMessageLoader id={MESSAGE_ID} />);
    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Back to the forum' })).toBeTruthy();
    });
    const back = screen.getByRole('link', { name: 'Back to the forum' });
    expect(back.getAttribute('href')).toBe('/welcome');
  });

  it('shows Loading… while session hydrate is not ready', async () => {
    hydrate.mockReturnValue({ ready: false });
    fetchMessage.mockResolvedValue(sample);
    renderWithLocale(<PublicMessageLoader id={MESSAGE_ID} />);
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });
    expect(screen.getAllByText('Loading…').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByRole('link', { name: 'Log in' })).toBeNull();
  });

  it('shows Loading… while the message is fetching', () => {
    fetchMessage.mockImplementation(() => new Promise(() => undefined));
    renderWithLocale(<PublicMessageLoader id={MESSAGE_ID} />);
    expect(screen.getByText('Loading…')).toBeTruthy();
  });

  it('loads a photo blob URL when hasPhoto is true', async () => {
    fetchMessage.mockResolvedValue({ ...sample, hasPhoto: true, text: '' });
    fetchPhoto.mockResolvedValue(new Blob([new Uint8Array([1])], { type: 'image/jpeg' }));
    renderWithLocale(<PublicMessageLoader id={MESSAGE_ID} />);
    await waitFor(() => {
      expect(screen.getByAltText('Photo from Ada')).toBeTruthy();
    });
    expect(fetchPhoto).toHaveBeenCalledWith(MESSAGE_ID);
    expect(screen.getByAltText('Photo from Ada').getAttribute('src')).toBe('blob:public');
    expect(screen.getByAltText('Photo from Ada').className).toContain('rounded-xl');
    expect(screen.getByAltText('Photo from Ada').className).not.toContain('rounded-2xl');
  });

  it('renders a video when hasVideo is true', async () => {
    fetchMessage.mockResolvedValue({
      ...sample,
      hasVideo: true,
      videoContentType: 'video/webm',
      text: '',
    });
    renderWithLocale(<PublicMessageLoader id={MESSAGE_ID} />);
    await waitFor(() => {
      expect(document.querySelector('video')).toBeTruthy();
    });
    const video = document.querySelector('video');
    expect(video?.getAttribute('src')).toBe(`/messages/${MESSAGE_ID}/video.webm`);
    expect(video?.hasAttribute('controls')).toBe(true);
    const tokens = (video?.getAttribute('class') ?? '').split(/\s+/);
    expect(tokens).toEqual(
      expect.arrayContaining([
        'h-auto',
        'w-auto',
        'max-h-80',
        'max-w-full',
        'rounded-xl',
        'object-contain',
      ]),
    );
    expect(tokens).not.toContain('rounded-2xl');
    expect(tokens).not.toContain('w-full');
    expect(tokens).not.toContain('bg-black');
    expect(screen.queryByAltText('Photo from Ada')).toBeNull();
  });

  it('hides the video and shows the photo when playback fails', async () => {
    fetchMessage.mockResolvedValue({
      ...sample,
      hasVideo: true,
      hasPhoto: true,
      videoContentType: 'video/mp4',
      text: '',
    });
    fetchPhoto.mockResolvedValue(new Blob([new Uint8Array([1])], { type: 'image/jpeg' }));
    renderWithLocale(<PublicMessageLoader id={MESSAGE_ID} />);
    await waitFor(() => {
      expect(document.querySelector('video')).toBeTruthy();
    });
    fireEvent.error(document.querySelector('video')!);
    await waitFor(() => {
      expect(document.querySelector('video')).toBeNull();
    });
    expect(screen.getByAltText('Photo from Ada')).toBeTruthy();
  });

  it('ignores a stale message resolve after unmount', async () => {
    let resolveMessage: ((value: ForumMessage | null) => void) | undefined;
    fetchMessage.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveMessage = resolve;
        }),
    );
    const view = renderWithLocale(<PublicMessageLoader id={MESSAGE_ID} />);
    view.unmount();
    resolveMessage?.(sample);
    await Promise.resolve();
    expect(fetchMessage).toHaveBeenCalled();
  });

  it('ignores a stale message reject after unmount', async () => {
    let rejectMessage: ((reason: Error) => void) | undefined;
    fetchMessage.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectMessage = reject;
        }),
    );
    const view = renderWithLocale(<PublicMessageLoader id={MESSAGE_ID} />);
    view.unmount();
    rejectMessage?.(new Error('gone'));
    await Promise.resolve();
    expect(fetchMessage).toHaveBeenCalled();
  });

  it('ignores a stale parent resolve after unmount', async () => {
    const parentId = '22222222-2222-4222-8222-222222222222';
    const reply: ForumMessage = { ...sample, parentId };
    const parent: ForumMessage = { ...sample, id: parentId, text: 'Parent note' };
    fetchMessage.mockImplementationOnce(async () => reply);
    let resolveParent: ((value: ForumMessage | null) => void) | undefined;
    fetchMessage.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveParent = resolve;
        }),
    );
    const view = renderWithLocale(<PublicMessageLoader id={MESSAGE_ID} />);
    await waitFor(() => {
      expect(fetchMessage).toHaveBeenCalledTimes(2);
    });
    view.unmount();
    resolveParent?.(parent);
    await Promise.resolve();
    expect(fetchRepliesPublic).not.toHaveBeenCalled();
  });

  it('ignores a stale replies resolve after unmount', async () => {
    fetchMessage.mockResolvedValue(sample);
    let resolveReplies: ((value: ForumMessage[]) => void) | undefined;
    fetchRepliesPublic.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveReplies = resolve;
        }),
    );
    const view = renderWithLocale(<PublicMessageLoader id={MESSAGE_ID} />);
    await waitFor(() => {
      expect(fetchRepliesPublic).toHaveBeenCalled();
    });
    view.unmount();
    resolveReplies?.([]);
    await Promise.resolve();
    expect(fetchRepliesPublic).toHaveBeenCalled();
  });

  it('ignores a stale photo resolve after unmount', async () => {
    fetchMessage.mockResolvedValue({ ...sample, hasPhoto: true });
    let resolvePhoto: ((value: Blob) => void) | undefined;
    fetchPhoto.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePhoto = resolve;
        }),
    );
    const view = renderWithLocale(<PublicMessageLoader id={MESSAGE_ID} />);
    await waitFor(() => {
      expect(fetchPhoto).toHaveBeenCalled();
    });
    view.unmount();
    resolvePhoto?.(new Blob([new Uint8Array([1])]));
    await Promise.resolve();
  });

  it('clears the photo when the photo fetch fails', async () => {
    fetchMessage.mockResolvedValue({ ...sample, hasPhoto: true });
    fetchPhoto.mockRejectedValue(new Error('photo down'));
    renderWithLocale(<PublicMessageLoader id={MESSAGE_ID} />);
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });
    await waitFor(() => {
      expect(fetchPhoto).toHaveBeenCalled();
    });
    expect(screen.queryByAltText('Photo from Ada')).toBeNull();
  });

  it('renders a parent and two replies without a permalink ring', async () => {
    const first: ForumMessage = {
      ...sample,
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Bob',
      text: 'First reply',
      sats: 0,
    };
    const second: ForumMessage = {
      ...sample,
      id: '33333333-3333-4333-8333-333333333333',
      name: 'Carol',
      text: 'Second reply',
      sats: 0,
    };
    fetchMessage.mockResolvedValue(sample);
    fetchRepliesPublic.mockResolvedValue([first, second]);
    renderWithLocale(<PublicMessageLoader id={MESSAGE_ID} />);
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });
    expect(screen.getByText('First reply')).toBeTruthy();
    expect(screen.getByText('Second reply')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();
    expect(screen.getByText('Carol')).toBeTruthy();
    expect(document.querySelector('[data-permalink-target="true"]')).toBeNull();
    expect(fetchRepliesPublic).toHaveBeenCalledWith(MESSAGE_ID);
  });

  it('loads the parent thread from a reply id and rings the opened reply', async () => {
    const replyId = '22222222-2222-4222-8222-222222222222';
    const reply: ForumMessage = {
      ...sample,
      id: replyId,
      parentId: MESSAGE_ID,
      name: 'Pater Severin',
      text: '',
      sats: 3000,
    };
    fetchMessage.mockImplementation(async (messageId: string) => {
      if (messageId === replyId) {
        return reply;
      }
      if (messageId === MESSAGE_ID) {
        return sample;
      }
      return null;
    });
    fetchRepliesPublic.mockResolvedValue([reply]);
    renderWithLocale(<PublicMessageLoader id={replyId} />);
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });
    expect(screen.getByText('Pater Severin')).toBeTruthy();
    expect(fetchMessage).toHaveBeenNthCalledWith(1, replyId);
    expect(fetchMessage).toHaveBeenNthCalledWith(2, MESSAGE_ID);
    expect(fetchRepliesPublic).toHaveBeenCalledWith(MESSAGE_ID);
    const target = document.querySelector('[data-permalink-target="true"]');
    expect(target).toBeTruthy();
    const ringNode =
      target instanceof HTMLElement && target.className.includes('ring-1')
        ? target
        : target?.querySelector('section');
    expect(ringNode?.className).toContain('ring-1');
    expect(ringNode?.className).toContain('ring-app-fg');
  });

  it('shows missing when the reply parent fetch returns null', async () => {
    const replyId = '22222222-2222-4222-8222-222222222222';
    fetchMessage.mockImplementation(async (messageId: string) => {
      if (messageId === replyId) {
        return {
          ...sample,
          id: replyId,
          parentId: MESSAGE_ID,
          name: 'Pater Severin',
          text: '',
          sats: 3000,
        };
      }
      return null;
    });
    renderWithLocale(<PublicMessageLoader id={replyId} />);
    await waitFor(() => {
      expect(screen.getByText('This profile could not be found.')).toBeTruthy();
    });
    expect(fetchRepliesPublic).not.toHaveBeenCalled();
  });

  it('shows an error when replies fail and retries the whole chain', async () => {
    fetchMessage.mockResolvedValue(sample);
    fetchRepliesPublic.mockRejectedValueOnce(new Error('fail')).mockResolvedValueOnce([]);
    renderWithLocale(<PublicMessageLoader id={MESSAGE_ID} />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    });
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toBe('Could not load this profile. Please try again.');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });
    expect(fetchRepliesPublic).toHaveBeenCalledTimes(2);
    expect(fetchMessage).toHaveBeenCalledTimes(2);
  });
});
