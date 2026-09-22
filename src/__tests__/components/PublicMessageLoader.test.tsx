import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PublicMessageLoader } from '@/components/PublicMessageLoader';
import type { ForumMessage, GiftStats } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const MESSAGE_ID = '11111111-1111-4111-8111-111111111111';

const push = vi.fn();

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('next/navigation', () => ({
  useRouter: (): { push: typeof push; replace: typeof push } => ({
    push,
    replace: push,
  }),
}));

vi.mock('@/hooks/useHydrateSession', () => ({
  useHydrateSession: vi.fn((): { ready: boolean } => ({ ready: true })),
}));

vi.mock('@/lib/api', () => ({
  fetchForumMessage: vi.fn(),
  fetchPublicMessage: vi.fn(),
  fetchPublicMessagePhoto: vi.fn(),
  fetchPublicReplies: vi.fn(),
  fetchGiftStats: vi.fn().mockResolvedValue({ spendOverTime: [] }),
  fetchReplies: vi.fn(),
  fetchMessagePhoto: vi.fn(),
  postMessage: vi.fn(),
  postMessageInvoice: vi.fn(),
  openConversation: vi.fn(),
  deleteMessage: vi.fn(),
  agreeToRules: vi.fn(),
  setName: vi.fn(),
  setLightningAddress: vi.fn(),
}));

import { useHydrateSession } from '@/hooks/useHydrateSession';
import {
  deleteMessage,
  fetchForumMessage,
  fetchGiftStats,
  fetchPublicMessage,
  fetchPublicMessagePhoto,
  fetchPublicReplies,
  fetchReplies,
} from '@/lib/api';
import { formatForumTime } from '@/lib/forum-time';

const fetchMessage = vi.mocked(fetchPublicMessage);
const fetchMessageBearer = vi.mocked(fetchForumMessage);
const fetchPhoto = vi.mocked(fetchPublicMessagePhoto);
const fetchRepliesPublic = vi.mocked(fetchPublicReplies);
const fetchRepliesBearer = vi.mocked(fetchReplies);
const fetchGiftStatsMock = vi.mocked(fetchGiftStats);
const deleteMessageMock = vi.mocked(deleteMessage);
const hydrate = vi.mocked(useHydrateSession);

const EMPTY_STATS: GiftStats = {
  totalSats: 0,
  totalBtc: '0.00000000',
  totalUsd: '0.00',
  totalChf: '0.00',
  totalEur: '0.00',
  totalPhp: '0.00',
  giftCount: 0,
  recipientCount: 0,
  firstPaidAt: null,
  lastPaidAt: null,
  spendOverTime: [],
  byRecipient: [],
  byMonth: [],
  fx: {
    quote: 'BTC-USD',
    dayBasis: 'utc',
    source: 'coinbase-exchange-daily-close',
    quotes: [{ code: 'USD', pair: 'BTC-USD', source: 'coinbase-exchange-daily-close' }],
  },
};

const sample: ForumMessage = {
  id: MESSAGE_ID,
  name: 'Ada',
  text: 'Hello from Ada',
  createdAt: '2026-08-28T12:00:00.000Z',
  sats: 21,
  payable: false,
  hasPhoto: false,
  photoCount: 0,
  hasVideo: false,
  videoContentType: null,
  role: 'basis',
  replyCount: 0,
};

beforeEach(() => {
  useAuthStore.setState({ session: null, account: null });
  hydrate.mockReturnValue({ ready: true });
  fetchRepliesPublic.mockResolvedValue([]);
  fetchRepliesBearer.mockResolvedValue([]);
  fetchGiftStatsMock.mockResolvedValue(EMPTY_STATS);
  deleteMessageMock.mockResolvedValue(undefined);
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
  fetchMessageBearer.mockReset();
  fetchPhoto.mockReset();
  fetchRepliesPublic.mockReset();
  fetchRepliesBearer.mockReset();
  deleteMessageMock.mockReset();
  vi.restoreAllMocks();
});

describe('PublicMessageLoader', () => {
  it('treats a malformed id as missing without calling the api', () => {
    renderWithLocale(<PublicMessageLoader id="not-a-uuid" />);
    expect(screen.getByText('This profile could not be found.')).toBeTruthy();
    expect(fetchMessage).not.toHaveBeenCalled();
    expect(fetchGiftStatsMock).not.toHaveBeenCalled();
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
    expect(screen.queryByRole('button', { name: 'Copy link to this note' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Send Bitcoin' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Send a private message' })).toBeNull();
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
        aboutMe: null,
        aboutMeHasPhoto: false,
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
    expect(screen.getByRole('button', { name: 'Copy link to this note' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Send a private message' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Send Bitcoin' })).toBeNull();
  });

  it('shows the goal bar on a top-level note past 100%', async () => {
    fetchMessage.mockResolvedValue({ ...sample, sats: 23100, goalSats: 21000 });
    renderWithLocale(<PublicMessageLoader id={MESSAGE_ID} />);
    await waitFor(() => {
      expect(screen.getByText('110%')).toBeTruthy();
    });
  });

  it('does not show the goal bar on a reply even when goalSats is set', async () => {
    fetchMessage.mockResolvedValue({ ...sample, text: 'Parent note' });
    fetchRepliesPublic.mockResolvedValue([
      {
        ...sample,
        id: '33333333-3333-4333-8333-333333333333',
        parentId: MESSAGE_ID,
        sats: 23100,
        goalSats: 21000,
        text: 'Reply gift',
      },
    ]);
    renderWithLocale(<PublicMessageLoader id={MESSAGE_ID} />);
    await waitFor(() => {
      expect(screen.getByText('Reply gift')).toBeTruthy();
    });
    expect(screen.queryByText('110%')).toBeNull();
  });

  it('shows Loading… without fetching while session hydrate is not ready', () => {
    hydrate.mockReturnValue({ ready: false });
    fetchMessage.mockResolvedValue(sample);
    renderWithLocale(<PublicMessageLoader id={MESSAGE_ID} />);
    expect(screen.getByText('Loading…')).toBeTruthy();
    expect(screen.queryByText('Hello from Ada')).toBeNull();
    expect(fetchMessageBearer).not.toHaveBeenCalled();
    expect(fetchMessage).not.toHaveBeenCalled();
    expect(screen.queryByRole('link', { name: 'Log in' })).toBeNull();
  });

  it('keeps the loaded note and shows footer loading when hydrate drops', async () => {
    fetchMessage.mockResolvedValue(sample);
    const view = renderWithLocale(<PublicMessageLoader id={MESSAGE_ID} />);
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });
    hydrate.mockReturnValue({ ready: false });
    view.rerender(<PublicMessageLoader id={MESSAGE_ID} />);
    expect(screen.getByText('Hello from Ada')).toBeTruthy();
    expect(screen.getByText('Loading…')).toBeTruthy();
  });

  it('shows a hidden note and notice to hydrated staff via bearer fetch', async () => {
    const deletedAt = '2026-08-29T15:00:00.000Z';
    const hidden: ForumMessage = {
      ...sample,
      deletedAt,
      deletedBy: { id: 'acc_mod', name: 'Marta', role: 'moderator' },
    };
    useAuthStore.setState({
      session: 'staff-session',
      account: {
        id: 'acc_1',
        linkingKey: null,
        role: 'moderator',
        name: 'Ada',
        location: null,
        lightningAddress: 'alice@walletofsatoshi.com',
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        aboutMeHasPhoto: false,
        setup: null,
        missing: [],
      },
    });
    fetchMessageBearer.mockResolvedValue(hidden);
    renderWithLocale(<PublicMessageLoader id={MESSAGE_ID} />);
    const notice = await screen.findByRole('status');
    expect(notice.textContent).toBe(
      `This note was hidden by Marta on ${formatForumTime(deletedAt, 'en')}.`,
    );
    expect(screen.getByText('Hello from Ada')).toBeTruthy();
    expect(screen.queryByText('This profile could not be found.')).toBeNull();
    expect(fetchMessageBearer).toHaveBeenCalledWith('staff-session', MESSAGE_ID);
    expect(fetchMessage).not.toHaveBeenCalled();
  });

  it('uses unnamed when the deleter has no name', async () => {
    const deletedAt = '2026-08-29T15:00:00.000Z';
    const hidden: ForumMessage = {
      ...sample,
      deletedAt,
      deletedBy: { id: 'acc_mod', name: null, role: 'moderator' },
    };
    useAuthStore.setState({
      session: 'staff-session',
      account: {
        id: 'acc_1',
        linkingKey: null,
        role: 'moderator',
        name: 'Ada',
        location: null,
        lightningAddress: 'alice@walletofsatoshi.com',
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        aboutMeHasPhoto: false,
        setup: null,
        missing: [],
      },
    });
    fetchMessageBearer.mockResolvedValue(hidden);
    renderWithLocale(<PublicMessageLoader id={MESSAGE_ID} />);
    const notice = await screen.findByRole('status');
    expect(notice.textContent).toBe(
      `This note was hidden by Unnamed on ${formatForumTime(deletedAt, 'en')}.`,
    );
  });

  it('shows the hide notice from a highlighted hidden reply under a live parent', async () => {
    const deletedAt = '2026-08-29T15:00:00.000Z';
    const parentId = '22222222-2222-4222-8222-222222222222';
    const replyId = MESSAGE_ID;
    const parent: ForumMessage = { ...sample, id: parentId, text: 'Parent note' };
    const hiddenReply: ForumMessage = {
      ...sample,
      id: replyId,
      parentId,
      text: 'Hidden reply',
      deletedAt,
      deletedBy: { id: 'acc_mod', name: 'Marta', role: 'moderator' },
    };
    useAuthStore.setState({
      session: 'staff-session',
      account: {
        id: 'acc_1',
        linkingKey: null,
        role: 'moderator',
        name: 'Ada',
        location: null,
        lightningAddress: 'alice@walletofsatoshi.com',
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        aboutMeHasPhoto: false,
        setup: null,
        missing: [],
      },
    });
    fetchMessageBearer.mockImplementation(async (session, id) => {
      expect(session).toBe('staff-session');
      if (id === replyId) {
        return hiddenReply;
      }
      if (id === parentId) {
        return parent;
      }
      return null;
    });
    fetchRepliesBearer.mockResolvedValue([hiddenReply]);
    renderWithLocale(<PublicMessageLoader id={replyId} />);
    const notice = await screen.findByRole('status');
    expect(notice.textContent).toBe(
      `This note was hidden by Marta on ${formatForumTime(deletedAt, 'en')}.`,
    );
    expect(screen.getByText('Parent note')).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByText('Hidden reply')).toBeTruthy();
    });
    expect(screen.queryByText('This profile could not be found.')).toBeNull();
  });

  it('merges a hidden permalink reply when staff replies omit it', async () => {
    const deletedAt = '2026-08-29T15:00:00.000Z';
    const parentId = '22222222-2222-4222-8222-222222222222';
    const replyId = MESSAGE_ID;
    const parent: ForumMessage = { ...sample, id: parentId, text: 'Parent note' };
    const hiddenReply: ForumMessage = {
      ...sample,
      id: replyId,
      parentId,
      text: 'Hidden reply',
      deletedAt,
      deletedBy: { id: 'acc_mod', name: 'Marta', role: 'moderator' },
    };
    useAuthStore.setState({
      session: 'staff-session',
      account: {
        id: 'acc_1',
        linkingKey: null,
        role: 'moderator',
        name: 'Ada',
        location: null,
        lightningAddress: 'alice@walletofsatoshi.com',
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        aboutMeHasPhoto: false,
        setup: null,
        missing: [],
      },
    });
    fetchMessageBearer.mockImplementation(async (_session, id) => {
      if (id === replyId) {
        return hiddenReply;
      }
      if (id === parentId) {
        return parent;
      }
      return null;
    });
    fetchRepliesBearer.mockResolvedValue([]);
    renderWithLocale(<PublicMessageLoader id={replyId} />);
    expect(await screen.findByRole('status')).toBeTruthy();
    expect(screen.getByText('Parent note')).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByText('Hidden reply')).toBeTruthy();
    });
  });

  it('shows Loading… while the message is fetching', () => {
    fetchMessage.mockImplementation(() => new Promise(() => undefined));
    renderWithLocale(<PublicMessageLoader id={MESSAGE_ID} />);
    expect(screen.getByText('Loading…')).toBeTruthy();
  });

  it('loads a photo blob URL when hasPhoto is true', async () => {
    fetchMessage.mockResolvedValue({ ...sample, hasPhoto: true, photoCount: 1, text: '' });
    fetchPhoto.mockResolvedValue(new Blob([new Uint8Array([1])], { type: 'image/jpeg' }));
    renderWithLocale(<PublicMessageLoader id={MESSAGE_ID} />);
    await waitFor(() => {
      expect(screen.getByAltText('Photo from Ada')).toBeTruthy();
    });
    expect(fetchPhoto).toHaveBeenCalledWith(MESSAGE_ID, 0);
    expect(screen.getByAltText('Photo from Ada').getAttribute('src')).toBe('blob:public');
    expect(screen.getByAltText('Photo from Ada').className).toContain('rounded-xl');
    expect(screen.getByAltText('Photo from Ada').className).not.toContain('rounded-2xl');
  });

  it('loads a photo blob URL when photoCount is omitted on a hasPhoto note', async () => {
    fetchMessage.mockResolvedValue({
      ...sample,
      hasPhoto: true,
      photoCount: undefined as unknown as number,
      text: '',
    });
    fetchPhoto.mockResolvedValue(new Blob([new Uint8Array([1])], { type: 'image/jpeg' }));
    renderWithLocale(<PublicMessageLoader id={MESSAGE_ID} />);
    await waitFor(() => {
      expect(screen.getByAltText('Photo from Ada')).toBeTruthy();
    });
    expect(fetchPhoto).toHaveBeenCalledWith(MESSAGE_ID, 0);
  });

  it('renders text without a photo when photoCount is omitted and hasPhoto is false', async () => {
    fetchMessage.mockResolvedValue({
      ...sample,
      hasPhoto: false,
      photoCount: undefined as unknown as number,
    });
    renderWithLocale(<PublicMessageLoader id={MESSAGE_ID} />);
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });
    expect(screen.queryByAltText('Photo from Ada')).toBeNull();
  });

  it('loads a photo gallery when photoCount is greater than one', async () => {
    fetchMessage.mockResolvedValue({ ...sample, hasPhoto: true, photoCount: 2, text: '' });
    fetchPhoto.mockResolvedValue(new Blob([new Uint8Array([1])], { type: 'image/jpeg' }));
    vi.spyOn(URL, 'createObjectURL')
      .mockReturnValueOnce('blob:public-0')
      .mockReturnValueOnce('blob:public-1');
    renderWithLocale(<PublicMessageLoader id={MESSAGE_ID} />);
    await waitFor(() => {
      expect(screen.getAllByAltText('Photo from Ada')).toHaveLength(2);
    });
    const photos = screen.getAllByAltText('Photo from Ada');
    expect(photos[0]?.getAttribute('data-photo-index')).toBe('0');
    expect(photos[1]?.getAttribute('data-photo-index')).toBe('1');
    expect(fetchPhoto).toHaveBeenNthCalledWith(1, MESSAGE_ID, 0);
    expect(fetchPhoto).toHaveBeenNthCalledWith(2, MESSAGE_ID, 1);
    const scroller = photos[0]?.parentElement?.parentElement;
    expect(scroller?.contains(photos[1] ?? null)).toBe(true);
    const scrollerTokens = (scroller?.className ?? '').split(/\s+/);
    expect(scrollerTokens).toEqual(
      expect.arrayContaining([
        'flex',
        'snap-x',
        'snap-mandatory',
        'gap-3',
        'overflow-x-auto',
        'overscroll-x-contain',
      ]),
    );
    expect(scrollerTokens).not.toContain('flex-col');
    const firstSlide = (photos[0]?.parentElement?.className ?? '').split(/\s+/);
    const lastSlide = (photos[1]?.parentElement?.className ?? '').split(/\s+/);
    expect(firstSlide).toEqual(
      expect.arrayContaining(['w-[88%]', 'min-w-[88%]', 'shrink-0', 'snap-start']),
    );
    expect(lastSlide).toEqual(
      expect.arrayContaining(['w-full', 'min-w-full', 'shrink-0', 'snap-start']),
    );
    expect(screen.getByText('1/2')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Photo 2 of 2' })).toBeTruthy();
    expect(screen.queryByText('Photo 1 of 2')).toBeNull();
    expect(screen.queryByText('Photo 2 of 2')).toBeNull();
  });

  it('keeps the original still index when an earlier extra still fails to load', async () => {
    fetchMessage.mockResolvedValue({ ...sample, hasPhoto: true, photoCount: 2, text: '' });
    fetchPhoto
      .mockRejectedValueOnce(new Error('gone'))
      .mockResolvedValueOnce(new Blob([new Uint8Array([1])], { type: 'image/jpeg' }));
    renderWithLocale(<PublicMessageLoader id={MESSAGE_ID} />);
    await waitFor(() => {
      expect(screen.getAllByAltText('Photo from Ada')).toHaveLength(1);
    });
    expect(screen.getByAltText('Photo from Ada').getAttribute('data-photo-index')).toBe('1');
    expect(fetchPhoto).toHaveBeenNthCalledWith(1, MESSAGE_ID, 0);
    expect(fetchPhoto).toHaveBeenNthCalledWith(2, MESSAGE_ID, 1);
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
      photoCount: 1,
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
    fetchMessage.mockResolvedValue({ ...sample, hasPhoto: true, photoCount: 1 });
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

  it('keeps ₿-only when gift stats fail', async () => {
    fetchGiftStatsMock.mockRejectedValue(new Error('stats down'));
    fetchMessage.mockResolvedValue(sample);
    renderWithLocale(<PublicMessageLoader id={MESSAGE_ID} />);
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });
    expect(screen.getByText('₿21')).toBeTruthy();
    expect(screen.queryByText('$0.02')).toBeNull();
  });

  it('shows stored fiat next to ₿ when the live rate differs', async () => {
    fetchGiftStatsMock.mockResolvedValue({
      ...EMPTY_STATS,
      spendOverTime: [
        {
          day: '2026-07-01',
          sats: 100_000_000,
          cumulativeSats: 100_000_000,
          btc: '1.00000000',
          cumulativeBtc: '1.00000000',
          usd: '100000.00',
          cumulativeUsd: '100000.00',
          chf: '80000.00',
          eur: '90000.00',
          php: '5600000.00',
          cumulativeChf: '80000.00',
          cumulativeEur: '90000.00',
          cumulativePhp: '5600000.00',
        },
      ],
    });
    fetchMessage.mockResolvedValue({ ...sample, amountUsd: '5.00' });
    renderWithLocale(<PublicMessageLoader id={MESSAGE_ID} />);
    await waitFor(() => {
      expect(screen.getByText('$5.00')).toBeTruthy();
    });
    expect(screen.getByText('₿21')).toBeTruthy();
    expect(screen.queryByText('$0.02')).toBeNull();
  });

  it('shows a locale-default fiat equivalent next to ₿', async () => {
    fetchGiftStatsMock.mockResolvedValue({
      ...EMPTY_STATS,
      spendOverTime: [
        {
          day: '2026-07-01',
          sats: 100_000_000,
          cumulativeSats: 100_000_000,
          btc: '1.00000000',
          cumulativeBtc: '1.00000000',
          usd: '100000.00',
          cumulativeUsd: '100000.00',
          chf: '80000.00',
          eur: '90000.00',
          php: '5600000.00',
          cumulativeChf: '80000.00',
          cumulativeEur: '90000.00',
          cumulativePhp: '5600000.00',
        },
      ],
    });
    fetchMessage.mockResolvedValue(sample);
    renderWithLocale(<PublicMessageLoader id={MESSAGE_ID} />);
    await waitFor(() => {
      expect(screen.getByText('$0.02')).toBeTruthy();
    });
    expect(screen.getByText('₿21')).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Fiat currency' })).toBeNull();
  });

  it('clears the photo when the photo fetch fails', async () => {
    fetchMessage.mockResolvedValue({ ...sample, hasPhoto: true, photoCount: 1 });
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

  it('shows copy and omits Gift and PM on a signed-in payable note from another author', async () => {
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
        aboutMe: null,
        aboutMeHasPhoto: false,
        setup: null,
        missing: [],
      },
    });
    fetchMessage.mockResolvedValue({
      ...sample,
      name: 'Carol',
      accountId: 'acc_carol',
      payable: true,
    });
    renderWithLocale(<PublicMessageLoader id={MESSAGE_ID} />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Copy link to this note' })).toBeTruthy();
    });
    expect(screen.queryByRole('button', { name: 'Send Bitcoin' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Send a private message' })).toBeNull();
  });

  it('auto-expands the signed-in thread so Write a reaction is ready', async () => {
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
        aboutMe: null,
        aboutMeHasPhoto: false,
        setup: null,
        missing: [],
      },
    });
    fetchMessage.mockResolvedValue(sample);
    renderWithLocale(<PublicMessageLoader id={MESSAGE_ID} />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Write a reaction')).toBeTruthy();
    });
    await waitFor(() => {
      expect(fetchRepliesBearer).toHaveBeenCalledWith('sess', MESSAGE_ID);
    });
  });

  it('rings the opened reply on a signed-in parent thread', async () => {
    const replyId = '22222222-2222-4222-8222-222222222222';
    const reply: ForumMessage = {
      ...sample,
      id: replyId,
      parentId: MESSAGE_ID,
      name: 'Pater Severin',
      text: '',
      sats: 3000,
    };
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
        aboutMe: null,
        aboutMeHasPhoto: false,
        setup: null,
        missing: [],
      },
    });
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
    fetchRepliesBearer.mockResolvedValue([reply]);
    renderWithLocale(<PublicMessageLoader id={replyId} />);
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });
    await waitFor(() => {
      expect(document.querySelector('[data-permalink-target="true"]')).toBeTruthy();
    });
    const target = document.querySelector('[data-permalink-target="true"]');
    expect(target?.getAttribute('data-reply-id')).toBe(replyId);
    expect(target?.className).toContain('ring-1');
    expect(target?.className).toContain('ring-app-fg');
  });

  it('shows missing after a staff delete of the signed-in root note', async () => {
    useAuthStore.setState({
      session: 'sess',
      account: {
        id: 'acc_1',
        linkingKey: null,
        role: 'founder',
        name: 'Ada',
        location: null,
        lightningAddress: 'alice@walletofsatoshi.com',
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        aboutMeHasPhoto: false,
        setup: null,
        missing: [],
      },
    });
    fetchMessageBearer.mockResolvedValue(sample);
    renderWithLocale(<PublicMessageLoader id={MESSAGE_ID} />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Delete post' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Delete post' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm deletion' }));
    await waitFor(() => {
      expect(screen.getByText('This profile could not be found.')).toBeTruthy();
    });
    expect(deleteMessageMock).toHaveBeenCalledWith('sess', MESSAGE_ID);
  });

  it('unfurls a quoted public note in a reply and hides the raw URL', async () => {
    const rianaId = '444d655b-73a4-475a-b5fc-f7e36210e82e';
    const replyId = '322f9dea-4a76-5168-91b8-430432e5f90b';
    const quotedId = 'd8cd22dd-d5c4-46a8-82ed-38b4d2f551ec';
    const quotedUrl = `https://21.gifts/messages/${quotedId}`;
    const parent: ForumMessage = {
      id: rianaId,
      name: 'Riana Rosello',
      text: 'Good morning everyone especially to our sponsor',
      createdAt: '2026-09-16T20:12:43.660Z',
      sats: 21,
      payable: true,
      hasPhoto: false,
      photoCount: 0,
      hasVideo: false,
      videoContentType: null,
      role: 'verified',
      replyCount: 1,
    };
    const quoted: ForumMessage = {
      id: quotedId,
      name: 'Cyrill',
      text: 'A Quick Technical Note\n\nThe system responsible for automatic payouts operates on the UTC 00:00 standard. This means a new day always begins at 00:00 UTC. For our friends in the Philippines, that is 08:00 PST.',
      createdAt: '2026-09-16T09:50:23.750Z',
      sats: 43,
      payable: true,
      hasPhoto: false,
      photoCount: 0,
      hasVideo: false,
      videoContentType: null,
      role: 'founder',
      replyCount: 0,
    };
    const reply: ForumMessage = {
      id: replyId,
      parentId: rianaId,
      name: 'Cyrill',
      text: `just for information: ${quotedUrl}`,
      createdAt: '2026-09-16T20:26:17.290Z',
      sats: 21,
      payable: false,
      hasPhoto: false,
      photoCount: 0,
      hasVideo: false,
      videoContentType: null,
      role: 'founder',
      replyCount: 0,
    };
    fetchMessage.mockImplementation(async (id: string) => {
      if (id === rianaId) {
        return parent;
      }
      if (id === quotedId) {
        return quoted;
      }
      if (id === replyId) {
        return reply;
      }
      return null;
    });
    fetchRepliesPublic.mockResolvedValue([reply]);
    renderWithLocale(<PublicMessageLoader id={rianaId} />);
    await waitFor(() => {
      expect(screen.getByText(/A Quick Technical Note/)).toBeTruthy();
    });
    expect(screen.getByText(/just for information:/)).toBeTruthy();
    expect(screen.queryByText(quotedUrl)).toBeNull();
  });

  it('marks an unsigned via reply with a non-interactive badge and plain url text', async () => {
    const reply: ForumMessage = {
      ...sample,
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Robin',
      via: 'nostr',
      text: 'Greetings! https://example.com/hello',
      sats: 0,
      payable: false,
    };
    fetchMessage.mockResolvedValue(sample);
    fetchRepliesPublic.mockResolvedValue([reply]);
    renderWithLocale(<PublicMessageLoader id={MESSAGE_ID} />);
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });
    expect(screen.getByText('External')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'External' })).toBeNull();
    expect(screen.getByText('Greetings! https://example.com/hello')).toBeTruthy();
    expect(screen.queryByRole('link', { name: /example\.com/ })).toBeNull();
  });

  it('marks an unsigned via gift reply with a badge and no body paragraph', async () => {
    const reply: ForumMessage = {
      ...sample,
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Robin',
      via: 'nostr',
      text: '',
      sats: 69,
      payable: false,
    };
    fetchMessage.mockResolvedValue(sample);
    fetchRepliesPublic.mockResolvedValue([reply]);
    renderWithLocale(<PublicMessageLoader id={MESSAGE_ID} />);
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });
    expect(screen.getByText('External')).toBeTruthy();
    expect(screen.getByText('₿69')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'External' })).toBeNull();
  });
});
