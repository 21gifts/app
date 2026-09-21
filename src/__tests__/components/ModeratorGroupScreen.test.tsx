import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ModeratorGroupScreen } from '@/components/ModeratorGroupScreen';
import type { Account, Conversation, ConversationMessage } from '@/lib/api-types';
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

beforeEach(() => {
  vi.clearAllMocks();
  push.mockClear();
  push.mockReset();
  groupMock.mockResolvedValue(GROUP);
  threadMock.mockResolvedValue([MESSAGE]);
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

afterEach(cleanup);

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
      threadMock.mockResolvedValue([MESSAGE]);
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
    threadMock.mockResolvedValue([MESSAGE]);
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
    let resolveThread: ((value: ConversationMessage[]) => void) | undefined;
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
      resolveThread?.([MESSAGE]);
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
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'a'.repeat(501) } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(screen.getByRole('alert').textContent).toBe('Keep it to 500 characters');
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

  it('shows a fiat suffix on a sats message when gift stats resolve', async () => {
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
    threadMock.mockResolvedValue([{ ...MESSAGE, sats: 21 }]);
    renderWithLocale(<ModeratorGroupScreen />);
    expect(await screen.findByText('Hello mods')).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByText('$0.02')).toBeTruthy();
    });
    expect(screen.getByText('₿21')).toBeTruthy();
  });

  it('survives a failing stats fetch', async () => {
    giftStatsMock.mockRejectedValueOnce(new Error('stats down'));
    threadMock.mockResolvedValue([{ ...MESSAGE, sats: 21 }]);
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
    threadMock.mockResolvedValue([
      {
        ...MESSAGE,
        id: 'm-legacy',
        text: '',
        hasPhoto: true,
        photoCount: 0,
      },
    ]);
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
    threadMock.mockResolvedValue([
      {
        ...MESSAGE,
        id: 'm-pic',
        text: '',
        hasPhoto: true,
        photoCount: 1,
      },
    ]);
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
    threadMock.mockResolvedValue([
      {
        ...MESSAGE,
        id: 'm-pic',
        text: '',
        hasPhoto: true,
        photoCount: 1,
      },
    ]);
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

  it('skips a still when the photo fetch fails and loads the next', async () => {
    threadMock.mockResolvedValue([
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
    ]);
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
