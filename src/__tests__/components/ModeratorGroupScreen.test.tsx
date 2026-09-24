import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ModeratorGroupScreen } from '@/components/ModeratorGroupScreen';
import {
  CONTACT_MESSAGE_MAX_LENGTH,
  type Account,
  type Conversation,
  type ConversationMessage,
} from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const push = vi.fn();

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('next/navigation', () => ({
  useRouter: (): { push: typeof push; replace: typeof push } => ({ push, replace: push }),
}));

vi.mock('@/lib/forum-photo', () => ({
  prepareForumPhoto: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  fetchModeratorGroup: vi.fn(),
  fetchConversation: vi.fn(),
  postConversationMessage: vi.fn(),
  markConversationRead: vi.fn(),
  fetchGiftStats: vi.fn().mockResolvedValue({ spendOverTime: [] }),
  fetchConversationMessagePhoto: vi.fn(),
  CONVERSATION_LIVE_POLL_MS: 5_000,
}));
vi.mock('@/lib/app-badge', () => ({
  bumpUnreadAppBadgeEpoch: vi.fn(),
  refreshUnreadAppBadge: vi.fn(),
}));

import {
  fetchConversation,
  fetchConversationMessagePhoto,
  fetchGiftStats,
  fetchModeratorGroup,
  markConversationRead,
  postConversationMessage,
} from '@/lib/api';
import { bumpUnreadAppBadgeEpoch, refreshUnreadAppBadge } from '@/lib/app-badge';
import { prepareForumPhoto } from '@/lib/forum-photo';

const groupMock = vi.mocked(fetchModeratorGroup);
const threadMock = vi.mocked(fetchConversation);
const postMock = vi.mocked(postConversationMessage);
const markReadMock = vi.mocked(markConversationRead);
const giftStatsMock = vi.mocked(fetchGiftStats);
const bumpMock = vi.mocked(bumpUnreadAppBadgeEpoch);
const refreshMock = vi.mocked(refreshUnreadAppBadge);
const photoMock = vi.mocked(fetchConversationMessagePhoto);
const prepareMock = vi.mocked(prepareForumPhoto);

const account: Account = {
  id: 'acc_1',
  linkingKey: '02abcdef',
  role: 'moderator',
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

const GROUP: Conversation = {
  id: 'conv-mod',
  kind: 'moderator_group',
  name: 'Staff room',
  lastText: 'Hello mods',
  lastAt: '2026-08-28T15:00:00.000Z',
  lastFromMe: false,
  lastSats: 0,
  unreadMessageCount: 0,
  unread: false,
};

const MESSAGE: ConversationMessage = {
  id: 'm1',
  name: 'Ada',
  text: 'Hello mods',
  createdAt: '2026-08-28T15:00:00.000Z',
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
  push.mockClear();
  push.mockReset();
  groupMock.mockResolvedValue(GROUP);
  threadMock.mockResolvedValue(conversationPage([MESSAGE]));
  markReadMock.mockResolvedValue(undefined);
  refreshMock.mockResolvedValue(undefined);
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

describe('ModeratorGroupScreen', () => {
  it('renders nothing when there is no session', () => {
    useAuthStore.setState({ session: null, account });
    const { container } = renderWithLocale(<ModeratorGroupScreen />);
    expect(container.firstChild).toBeNull();
    expect(groupMock).not.toHaveBeenCalled();
    expect(threadMock).not.toHaveBeenCalled();
  });

  it.each(['basis', 'verified'] as const)(
    'shows forbidden copy for a %s account and does not fetch',
    (role) => {
      useAuthStore.setState({ session: 'sess', account: { ...account, role } });
      renderWithLocale(<ModeratorGroupScreen />);
      expect(screen.getByRole('heading', { name: 'Moderators chat group' })).toBeTruthy();
      expect(screen.getByText('This room is for moderators.')).toBeTruthy();
      expect(screen.queryByRole('link', { name: 'Moderation' })).toBeNull();
      expect(screen.queryByRole('list', { name: 'Conversations' })).toBeNull();
      expect(screen.queryByLabelText('Your message')).toBeNull();
      expect(groupMock).not.toHaveBeenCalled();
      expect(threadMock).not.toHaveBeenCalled();
      expect(markReadMock).not.toHaveBeenCalled();
    },
  );

  it('shows forbidden copy when the account is missing', () => {
    useAuthStore.setState({ session: 'sess', account: null });
    renderWithLocale(<ModeratorGroupScreen />);
    expect(screen.getByText('This room is for moderators.')).toBeTruthy();
    expect(groupMock).not.toHaveBeenCalled();
  });

  it.each(['founder', 'moderator'] as const)(
    'shows loading then the group thread as %s',
    async (role) => {
      useAuthStore.setState({ session: 'sess', account: { ...account, role } });
      let resolveGroup: ((value: Conversation) => void) | undefined;
      groupMock.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveGroup = resolve;
          }),
      );
      threadMock.mockResolvedValue(conversationPage([MESSAGE]));
      renderWithLocale(<ModeratorGroupScreen />);
      expect(screen.getByRole('heading', { name: 'Moderators chat group' })).toBeTruthy();
      expect(screen.getByText('Loading…')).toBeTruthy();
      await act(async () => {
        resolveGroup?.(GROUP);
        await Promise.resolve();
      });
      expect(await screen.findByText('Hello mods')).toBeTruthy();
      expect(groupMock).toHaveBeenCalledWith('sess');
      expect(threadMock).toHaveBeenCalledWith('sess', GROUP.id);
      await waitFor(() => {
        expect(markReadMock).toHaveBeenCalledWith('sess', GROUP.id);
      });
      expect(bumpMock).toHaveBeenCalled();
      expect(refreshMock).toHaveBeenCalledWith('sess', undefined, 0);
      expect(screen.getByRole('heading', { name: 'Moderators chat group' })).toBeTruthy();
      expect(screen.queryByText('Staff room')).toBeNull();
      expect(screen.getByLabelText('Your message')).toBeTruthy();
      expect(screen.queryByLabelText('Amount')).toBeNull();
    },
  );

  it('shows an error and retries', async () => {
    groupMock.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(GROUP);
    threadMock.mockResolvedValue(conversationPage([MESSAGE]));
    renderWithLocale(<ModeratorGroupScreen />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Could not load the staff room. Please try again.');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Hello mods')).toBeTruthy();
    expect(groupMock).toHaveBeenCalledTimes(2);
  });

  it('ignores a stale group resolve after unmount', async () => {
    let resolveGroup: ((value: Conversation) => void) | undefined;
    groupMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveGroup = resolve;
        }),
    );
    const view = renderWithLocale(<ModeratorGroupScreen />);
    view.unmount();
    await act(async () => {
      resolveGroup?.(GROUP);
      await Promise.resolve();
    });
    expect(screen.queryByText('Hello mods')).toBeNull();
  });

  it('does not apply a late resolve after the session is cleared', async () => {
    let resolveGroup: ((value: Conversation) => void) | undefined;
    groupMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveGroup = resolve;
        }),
    );
    renderWithLocale(<ModeratorGroupScreen />);
    expect(screen.getByText('Loading…')).toBeTruthy();
    useAuthStore.setState({ session: null, account: null });
    await waitFor(() => {
      expect(screen.queryByText('Loading…')).toBeNull();
    });
    await act(async () => {
      resolveGroup?.(GROUP);
      await Promise.resolve();
    });
    expect(screen.queryByText('Hello mods')).toBeNull();
  });

  it('ignores a stale thread resolve after unmount', async () => {
    groupMock.mockResolvedValue(GROUP);
    let resolveThread: ((value: ConversationPage) => void) | undefined;
    threadMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveThread = resolve;
        }),
    );
    const view = renderWithLocale(<ModeratorGroupScreen />);
    await waitFor(() => {
      expect(threadMock).toHaveBeenCalled();
    });
    view.unmount();
    await act(async () => {
      resolveThread?.(conversationPage([MESSAGE]));
      await Promise.resolve();
    });
    expect(screen.queryByText('Hello mods')).toBeNull();
  });

  it('ignores a stale thread reject after unmount', async () => {
    groupMock.mockResolvedValue(GROUP);
    let rejectThread: ((reason: Error) => void) | undefined;
    threadMock.mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectThread = reject;
        }),
    );
    const view = renderWithLocale(<ModeratorGroupScreen />);
    await waitFor(() => {
      expect(threadMock).toHaveBeenCalled();
    });
    view.unmount();
    await act(async () => {
      rejectThread?.(new Error('boom'));
      await Promise.resolve();
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('has no in-card back on the open thread', async () => {
    renderWithLocale(<ModeratorGroupScreen />);
    expect(await screen.findByText('Hello mods')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Moderation' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'All conversations' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Moderation' })).toBeNull();
  });

  it('validates empty and too-long drafts then posts', async () => {
    postMock.mockResolvedValue({
      id: 'm2',
      name: 'Ada',
      text: 'Follow up',
      createdAt: '2026-08-28T16:00:00.000Z',
      fromMe: true,
      sats: 0,
      hasPhoto: false,
      photoCount: 0,
    });
    renderWithLocale(<ModeratorGroupScreen />);
    expect(await screen.findByLabelText('Your message')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(screen.getByRole('alert').textContent).toBe('Enter a message');
    fireEvent.change(screen.getByLabelText('Your message'), {
      target: { value: 'a'.repeat(CONTACT_MESSAGE_MAX_LENGTH + 1) },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(screen.getByRole('alert').textContent).toBe('Keep it to 8000 characters');
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Follow up' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText('Follow up')).toBeTruthy();
    expect(postMock).toHaveBeenCalledWith('sess', 'conv-mod', 'Follow up');
  });

  it('still renders the thread when markConversationRead fails', async () => {
    markReadMock.mockRejectedValue(new Error('boom'));
    renderWithLocale(<ModeratorGroupScreen />);
    expect(await screen.findByText('Hello mods')).toBeTruthy();
    await waitFor(() => {
      expect(markReadMock).toHaveBeenCalledWith('sess', GROUP.id);
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('still renders the thread when refreshUnreadAppBadge rejects', async () => {
    refreshMock.mockRejectedValue(new Error('boom'));
    renderWithLocale(<ModeratorGroupScreen />);
    expect(await screen.findByText('Hello mods')).toBeTruthy();
    await waitFor(() => {
      expect(refreshMock).toHaveBeenCalledWith('sess', undefined, 0);
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('does not mark read on a group fetch error', async () => {
    groupMock.mockRejectedValue(new Error('boom'));
    renderWithLocale(<ModeratorGroupScreen />);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(markReadMock).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it('shows a send error when post fails', async () => {
    postMock.mockRejectedValue(new Error('boom'));
    renderWithLocale(<ModeratorGroupScreen />);
    expect(await screen.findByLabelText('Your message')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Hi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe('Could not send your message');
  });

  it('shows the viewer fiat on a sats message that stored no fiat', async () => {
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
    threadMock.mockResolvedValue(conversationPage([{ ...MESSAGE, sats: 21 }]));
    renderWithLocale(<ModeratorGroupScreen />);
    expect(await screen.findByText('Hello mods')).toBeTruthy();
    expect(await screen.findByText('₿21')).toBeTruthy();
    expect(await screen.findByText('$0.02')).toBeTruthy();
  });

  it('survives a failing stats fetch', async () => {
    giftStatsMock.mockRejectedValueOnce(new Error('stats down'));
    threadMock.mockResolvedValue(conversationPage([{ ...MESSAGE, sats: 21 }]));
    renderWithLocale(<ModeratorGroupScreen />);
    expect(await screen.findByText('Hello mods')).toBeTruthy();
    expect(await screen.findByText('₿21')).toBeTruthy();
    await waitFor(() => {
      expect(giftStatsMock).toHaveBeenCalled();
    });
    expect(screen.queryByText('$0.02')).toBeNull();
  });

  it('shows the photo attach control', async () => {
    renderWithLocale(<ModeratorGroupScreen />);
    expect(await screen.findByRole('button', { name: 'Add a photo' })).toBeTruthy();
    expect(screen.queryByText('Add a photo')).toBeNull();
  });

  it('disables send while a still is still being prepared', async () => {
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
    renderWithLocale(<ModeratorGroupScreen />);
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

  it('posts a photo-only message', async () => {
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
    renderWithLocale(<ModeratorGroupScreen />);
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
      expect(postMock).toHaveBeenCalledWith('sess', 'conv-mod', '', [
        { contentType: 'image/jpeg', data: 'abc' },
      ]);
    });
    expect(await screen.findByAltText('Photo from Ada')).toBeTruthy();
  });

  it('sends a capture time and drops a blank one', async () => {
    prepareMock
      .mockResolvedValueOnce({
        ok: true,
        photo: {
          contentType: 'image/jpeg',
          data: 'aaa',
          previewUrl: 'data:image/jpeg;base64,aaa',
          takenAt: '2026-09-22T11:40:00+08:00',
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        photo: {
          contentType: 'image/jpeg',
          data: 'bbb',
          previewUrl: 'data:image/jpeg;base64,bbb',
          takenAt: '',
        },
      });
    postMock.mockResolvedValue({
      id: 'm-photo',
      name: 'Ada',
      text: '',
      createdAt: '2026-08-28T16:00:00.000Z',
      fromMe: true,
      sats: 0,
      hasPhoto: true,
      photoCount: 2,
    });
    renderWithLocale(<ModeratorGroupScreen />);
    expect(await screen.findByLabelText('Your message')).toBeTruthy();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const files = [
      new File([new Uint8Array([0xff, 0xd8, 0xff])], 'a.jpg', { type: 'image/jpeg' }),
      new File([new Uint8Array([0xff, 0xd8, 0xff])], 'b.jpg', { type: 'image/jpeg' }),
    ];
    await act(async () => {
      fireEvent.change(input, { target: { files } });
    });
    expect(await screen.findAllByAltText('Selected photo')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('sess', 'conv-mod', '', [
        { contentType: 'image/jpeg', data: 'aaa', takenAt: '2026-09-22T11:40:00+08:00' },
        { contentType: 'image/jpeg', data: 'bbb' },
      ]);
    });
  });

  it('sets tooMany when more than 10 stills are chosen', async () => {
    renderWithLocale(<ModeratorGroupScreen />);
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
    prepareMock.mockResolvedValueOnce({ ok: false, error: 'tooLarge' });
    renderWithLocale(<ModeratorGroupScreen />);
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
    prepareMock.mockRejectedValueOnce(new Error('decode'));
    renderWithLocale(<ModeratorGroupScreen />);
    expect(await screen.findByLabelText('Your message')).toBeTruthy();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'p.jpg', { type: 'image/jpeg' });
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe('Use a JPEG, PNG, or WebP photo');
  });

  it('loads a stored photo when hasPhoto is true and photoCount is 0', async () => {
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
      value: () => 'blob:group-legacy',
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: () => undefined,
    });
    renderWithLocale(<ModeratorGroupScreen />);
    expect(await screen.findByAltText('Photo from Ada')).toBeTruthy();
    expect(photoMock).toHaveBeenCalledWith('sess', 'conv-mod', 'm-legacy', 0);
  });

  it('loads a stored photo blob for a hasPhoto row', async () => {
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
      value: () => 'blob:group-photo',
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: () => undefined,
    });
    renderWithLocale(<ModeratorGroupScreen />);
    expect(await screen.findByAltText('Photo from Ada')).toBeTruthy();
    expect(photoMock).toHaveBeenCalledWith('sess', 'conv-mod', 'm-pic', 0);
  });

  it('does not apply a photo blob after the account is no longer staff', async () => {
    let resolvePhoto: ((blob: Blob) => void) | undefined;
    photoMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePhoto = resolve;
        }),
    );
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
      value: () => 'blob:group-photo',
    });
    renderWithLocale(<ModeratorGroupScreen />);
    await waitFor(() => {
      expect(photoMock).toHaveBeenCalled();
    });
    act(() => {
      useAuthStore.setState({ session: 'sess', account: { ...account, role: 'basis' } });
    });
    await act(async () => {
      resolvePhoto?.(new Blob(['jpeg'], { type: 'image/jpeg' }));
      await Promise.resolve();
    });
    expect(screen.queryByAltText('Photo from Ada')).toBeNull();
    expect(screen.getByText('This room is for moderators.')).toBeTruthy();
  });

  it('revokes loaded photo blobs and drops drafts when the account is no longer staff', async () => {
    const revoke = vi.fn();
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
      value: () => 'blob:group-photo',
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revoke,
    });
    renderWithLocale(<ModeratorGroupScreen />);
    expect(await screen.findByAltText('Photo from Ada')).toBeTruthy();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'p.jpg', { type: 'image/jpeg' });
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });
    expect(await screen.findByAltText('Selected photo')).toBeTruthy();
    act(() => {
      useAuthStore.setState({ session: 'sess', account: { ...account, role: 'basis' } });
    });
    expect(screen.getByText('This room is for moderators.')).toBeTruthy();
    expect(revoke).toHaveBeenCalledWith('blob:group-photo');
    expect(screen.queryByAltText('Selected photo')).toBeNull();
    expect(screen.queryByLabelText('Your message')).toBeNull();
  });

  it('revokes photo blobs that are no longer on the thread', async () => {
    const revoke = vi.fn();
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
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: () => 'blob:group-photo',
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revoke,
    });
    renderWithLocale(<ModeratorGroupScreen />);
    expect(await screen.findByAltText('Photo from Ada')).toBeTruthy();
    threadMock.mockResolvedValueOnce(conversationPage([MESSAGE]));
    act(() => {
      useAuthStore.setState({ session: 'sess-2', account });
    });
    await waitFor(() => {
      expect(revoke).toHaveBeenCalledWith('blob:group-photo');
    });
    expect(await screen.findByText('Hello mods')).toBeTruthy();
    expect(screen.queryByAltText('Photo from Ada')).toBeNull();
  });

  it('skips a still when the photo fetch fails and loads the next', async () => {
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
      value: () => 'blob:group-next',
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: () => undefined,
    });
    renderWithLocale(<ModeratorGroupScreen />);
    expect(await screen.findByAltText('Photo from Bob')).toBeTruthy();
    expect(screen.queryByAltText('Photo from Ada')).toBeNull();
    expect(photoMock).toHaveBeenCalledWith('sess', 'conv-mod', 'm-fail', 0);
    expect(photoMock).toHaveBeenCalledWith('sess', 'conv-mod', 'm-ok', 0);
  });
});

describe('moderator conversation thread pages', () => {
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
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('prepends older unique messages from the next cursor page', async () => {
    const older = {
      ...MESSAGE,
      id: 'm-old',
      text: 'Older message',
      createdAt: '2026-08-27T15:00:00.000Z',
    };
    threadMock
      .mockResolvedValueOnce(conversationPage([MESSAGE], 'cur_2'))
      .mockResolvedValueOnce(conversationPage([older, MESSAGE]));
    const { container } = renderWithLocale(<ModeratorGroupScreen />);
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
    expect(threadMock).toHaveBeenCalledWith('sess', GROUP.id, { cursor: 'cur_2' });
    expect(container.querySelectorAll('[data-message-id="m1"]')).toHaveLength(1);
    const ids = [...container.querySelectorAll('[data-message-id]')].map((node) =>
      node.getAttribute('data-message-id'),
    );
    expect(ids).toEqual(['m-old', 'm1']);
  });

  it('does not create an observer or fetch a cursor page without a next cursor', async () => {
    threadMock.mockResolvedValue(conversationPage([MESSAGE]));
    renderWithLocale(<ModeratorGroupScreen />);
    expect(await screen.findByText('Hello mods')).toBeTruthy();
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
    renderWithLocale(<ModeratorGroupScreen />);
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
    renderWithLocale(<ModeratorGroupScreen />);
    await waitFor(() => {
      expect(FakeIntersectionObserver.instances[0]?.observed).toHaveLength(1);
    });
    act(() => {
      FakeIntersectionObserver.instances[0]?.trigger();
    });
    await waitFor(() => {
      expect(threadMock).toHaveBeenCalledWith('sess', GROUP.id, { cursor: 'cur_2' });
    });
    expect(screen.getByText('Hello mods')).toBeTruthy();
    expect(screen.queryByText('Could not load the staff room. Please try again.')).toBeNull();
  });

  function setVisibility(state: DocumentVisibilityState): void {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => state,
    });
  }

  it('appends unseen staff-room messages on the visible-tab interval', async () => {
    const olderNew: ConversationMessage = {
      ...MESSAGE,
      id: 'm2',
      text: 'Older staff',
      createdAt: '2026-08-28T15:30:00.000Z',
    };
    const newer: ConversationMessage = {
      ...MESSAGE,
      id: 'm3',
      text: 'Newer staff',
      createdAt: '2026-08-28T16:00:00.000Z',
    };
    threadMock
      .mockResolvedValueOnce(conversationPage([MESSAGE]))
      .mockResolvedValue(conversationPage([MESSAGE, olderNew, newer]));
    vi.useFakeTimers({ toFake: ['setInterval'] });
    renderWithLocale(<ModeratorGroupScreen />);
    expect(await screen.findByText('Hello mods')).toBeTruthy();
    await waitFor(() => {
      expect(markReadMock).toHaveBeenCalledTimes(1);
    });
    const callsBefore = threadMock.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(await screen.findByText('Newer staff')).toBeTruthy();
    expect(
      screen.getByText('Older staff').compareDocumentPosition(screen.getByText('Newer staff')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(markReadMock).toHaveBeenCalledTimes(2);
    expect(refreshMock).toHaveBeenCalledWith('sess', undefined, 0);
    expect(threadMock.mock.calls.length).toBe(callsBefore + 1);
    expect(threadMock.mock.calls.at(-1)?.[2]).toBeUndefined();
  });

  it('does not mark the staff room read again when the poll has no new id', async () => {
    threadMock.mockResolvedValue(conversationPage([MESSAGE]));
    vi.useFakeTimers({ toFake: ['setInterval'] });
    renderWithLocale(<ModeratorGroupScreen />);
    expect(await screen.findByText('Hello mods')).toBeTruthy();
    await waitFor(() => {
      expect(markReadMock).toHaveBeenCalledTimes(1);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(markReadMock).toHaveBeenCalledTimes(1);
  });

  it('does not poll a hidden staff room and pulls once when it becomes visible', async () => {
    const newer: ConversationMessage = {
      ...MESSAGE,
      id: 'm2',
      text: 'Back in the room',
      createdAt: '2026-08-28T16:00:00.000Z',
    };
    threadMock
      .mockResolvedValueOnce(conversationPage([MESSAGE]))
      .mockResolvedValue(conversationPage([MESSAGE, newer]));
    vi.useFakeTimers({ toFake: ['setInterval'] });
    try {
      renderWithLocale(<ModeratorGroupScreen />);
      expect(await screen.findByText('Hello mods')).toBeTruthy();
      const callsBefore = threadMock.mock.calls.length;
      setVisibility('hidden');
      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
        await vi.advanceTimersByTimeAsync(5_000);
      });
      expect(threadMock.mock.calls.length).toBe(callsBefore);
      setVisibility('visible');
      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
      expect(await screen.findByText('Back in the room')).toBeTruthy();
      expect(markReadMock).toHaveBeenCalledTimes(2);
    } finally {
      setVisibility('visible');
    }
  });

  it('keeps the staff room when a live poll fails', async () => {
    threadMock
      .mockResolvedValueOnce(conversationPage([MESSAGE]))
      .mockRejectedValueOnce(new Error('boom'));
    vi.useFakeTimers({ toFake: ['setInterval'] });
    renderWithLocale(<ModeratorGroupScreen />);
    expect(await screen.findByText('Hello mods')).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(screen.getByText('Hello mods')).toBeTruthy();
    expect(screen.queryByText('Could not load the staff room. Please try again.')).toBeNull();
  });

  it('ignores a staff-room poll that resolves after unmount', async () => {
    let release: ((page: ConversationPage) => void) | undefined;
    threadMock.mockResolvedValueOnce(conversationPage([MESSAGE])).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    vi.useFakeTimers({ toFake: ['setInterval'] });
    const view = renderWithLocale(<ModeratorGroupScreen />);
    expect(await screen.findByText('Hello mods')).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    view.unmount();
    await act(async () => {
      release?.(
        conversationPage([
          MESSAGE,
          { ...MESSAGE, id: 'm-late', text: 'Too late', createdAt: '2026-08-28T16:00:00.000Z' },
        ]),
      );
    });
    expect(screen.queryByText('Too late')).toBeNull();
  });

  it('skips a second staff-room pull while one poll is in flight', async () => {
    let release: ((page: ConversationPage) => void) | undefined;
    threadMock.mockResolvedValueOnce(conversationPage([MESSAGE])).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    vi.useFakeTimers({ toFake: ['setInterval'] });
    renderWithLocale(<ModeratorGroupScreen />);
    expect(await screen.findByText('Hello mods')).toBeTruthy();
    const callsBefore = threadMock.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(threadMock.mock.calls.length).toBe(callsBefore + 1);
    await act(async () => {
      release?.(
        conversationPage([
          MESSAGE,
          { ...MESSAGE, id: 'm2', text: 'After the wait', createdAt: '2026-08-28T16:00:00.000Z' },
        ]),
      );
    });
    expect(await screen.findByText('After the wait')).toBeTruthy();
  });

  it('does not append a posted id the staff-room poll already showed', async () => {
    const created: ConversationMessage = {
      id: 'm2',
      name: 'Ada',
      text: 'Follow up',
      createdAt: '2026-08-28T16:00:00.000Z',
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
    renderWithLocale(<ModeratorGroupScreen />);
    expect(await screen.findByText('Hello mods')).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(await screen.findByText('Follow up')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Follow up' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => {
      expect(postMock).toHaveBeenCalled();
    });
    expect(screen.getAllByText('Follow up')).toHaveLength(1);
  });

  it('places an older polled staff message before a newer local send', async () => {
    const sent: ConversationMessage = {
      id: 'm-sent',
      name: 'Ada',
      text: 'Just sent',
      createdAt: '2026-08-28T16:30:00.000Z',
      fromMe: true,
      sats: 0,
      hasPhoto: false,
      photoCount: 0,
    };
    const older: ConversationMessage = {
      ...MESSAGE,
      id: 'm-old',
      text: 'Arrived earlier',
      createdAt: '2026-08-28T15:30:00.000Z',
    };
    threadMock
      .mockResolvedValueOnce(conversationPage([MESSAGE]))
      .mockResolvedValue(conversationPage([MESSAGE, older, sent]));
    postMock.mockResolvedValue(sent);
    vi.useFakeTimers({ toFake: ['setInterval'] });
    renderWithLocale(<ModeratorGroupScreen />);
    expect(await screen.findByText('Hello mods')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Just sent' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText('Just sent')).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(await screen.findByText('Arrived earlier')).toBeTruthy();
    const earlier = screen.getByText('Arrived earlier');
    const sentText = screen.getByText('Just sent');
    expect(
      earlier.compareDocumentPosition(sentText) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
