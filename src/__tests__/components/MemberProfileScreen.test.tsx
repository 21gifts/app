import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemberProfileScreen } from '@/components/MemberProfileScreen';
import {
  agreeToRules,
  fetchGiftStats,
  fetchMemberPosts,
  fetchMemberReplies,
  fetchMessagePhoto,
  fetchPublicMessage,
  fetchReplies,
  openConversation,
  postMessage,
  postMessageInvoice,
  setLightningAddress,
  setName,
} from '@/lib/api';
import {
  FORUM_MESSAGE_MAX_LENGTH,
  type Account,
  type ForumMessage,
  type MemberProfile,
} from '@/lib/api-types';
import { MissingRequirementsError } from '@/lib/missing-requirements';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: (): { push: typeof push; replace: typeof push } => ({
    push,
    replace: push,
  }),
}));

vi.mock('@/lib/api', () => ({
  fetchMessages: vi.fn(),
  postMessage: vi.fn(),
  postMessageVideo: vi.fn(),
  postMessageInvoice: vi.fn(),
  fetchPublicMessage: vi.fn(),
  dismissForumLaws: vi.fn(),
  fetchMessagePhoto: vi.fn(),
  fetchMemberPosts: vi.fn(),
  fetchMemberReplies: vi.fn(),
  fetchReplies: vi.fn(),
  openConversation: vi.fn(),
  agreeToRules: vi.fn(),
  setName: vi.fn(),
  setLocation: vi.fn(),
  setLightningAddress: vi.fn(),
  skipSetup: vi.fn(),
  fetchMember: vi.fn(),
  postTrustVerify: vi.fn(),
  postTrustPropose: vi.fn(),
  postTrustConfirm: vi.fn(),
  postTrustAppoint: vi.fn(),
  fetchGiftStats: vi.fn().mockResolvedValue({ spendOverTime: [] }),
}));

const photoMock = vi.mocked(fetchMessagePhoto);
const NULL_TRUST = {
  verifiedBy: null,
  proposedBy: null,
  confirmedBy: null,
  appointedBy: null,
};
const originalClipboard = navigator.clipboard;

/** Stub `navigator.clipboard.writeText`. */
function stubClipboard(writeText: () => Promise<void>): ReturnType<typeof vi.fn> {
  const fn = vi.fn(writeText);
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    writable: true,
    value: { writeText: fn },
  });
  return fn;
}

const profile: MemberProfile = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Carol',
  location: null,
  role: 'verified',
  lightningAddress: 'carol@walletofsatoshi.com',
  createdAt: '2026-01-15T12:00:00.000Z',
  aboutMe: null,
  profileMessage: null,
  postCount: 0,
  replyCount: 0,
  trust: NULL_TRUST,
};

const note = {
  id: '33333333-3333-4333-8333-333333333333',
  accountId: profile.id,
  name: 'Carol',
  text: 'Hello from my profile note.',
  createdAt: '2026-08-01T10:00:00.000Z',
  sats: 21,
  payable: true,
  hasPhoto: false,
  hasVideo: false,
  videoContentType: null,
  role: 'verified' as const,
  replyCount: 0,
};

const profileWithNote: MemberProfile = {
  ...profile,
  profileMessage: note,
  postCount: 1,
};

const secondPost = {
  ...note,
  id: '44444444-4444-4444-8444-444444444444',
  text: 'Second post from Carol.',
  createdAt: '2026-08-02T10:00:00.000Z',
  sats: 0,
};

const stalePinReply = {
  ...note,
  id: '77777777-7777-4777-8777-777777777777',
  text: 'Stale pin thread reply.',
  sats: 0,
  payable: false,
};

const liveSecondReply = {
  ...secondPost,
  id: '88888888-8888-4888-8888-888888888888',
  text: 'Live second-post reply.',
  sats: 0,
  payable: false,
};

const activityReply = {
  ...note,
  id: '66666666-6666-4666-8666-666666666666',
  text: 'A reply from Carol.',
  createdAt: '2026-08-03T10:00:00.000Z',
  sats: 0,
  payable: false,
  parentId: '55555555-5555-4555-8555-555555555555',
};

const account: Account = {
  id: '11111111-1111-4111-8111-111111111111',
  linkingKey: null,
  role: 'basis',
  name: 'Ada',
  location: null,
  lightningAddress: 'alice@walletofsatoshi.com',
  lightningAddressVerified: false,
  forumLawsDismissed: true,
  createdAt: 1,
  rulesAgreedAt: 1,
  viewKey: 'a'.repeat(64),
  aboutMe: null,
  setup: null,
  missing: [],
};

const originalUserAgent = navigator.userAgent;

async function openPostsShowingNote(feedNote: ForumMessage = note): Promise<void> {
  vi.mocked(fetchMemberPosts).mockResolvedValue([feedNote]);
  const postsButton = screen.getByRole('button', { name: /posts/ });
  if (postsButton.getAttribute('aria-pressed') !== 'true') {
    fireEvent.click(postsButton);
  }
  await screen.findByText(feedNote.text);
}

async function openPostsShowingPhotoNote(): Promise<void> {
  vi.mocked(fetchMemberPosts).mockResolvedValue([{ ...note, hasPhoto: true }]);
  const postsButton = screen.getByRole('button', { name: /posts/ });
  if (postsButton.getAttribute('aria-pressed') !== 'true') {
    fireEvent.click(postsButton);
  }
  await screen.findByText('Hello from my profile note.');
}

async function expandNote(feedNote: ForumMessage = note): Promise<void> {
  await openPostsShowingNote(feedNote);
  fireEvent.click(screen.getByRole('button', { name: 'Show replies' }));
  await waitFor(() => {
    expect(screen.getByLabelText('Your reply')).toBeTruthy();
    expect((screen.getByLabelText('Your reply') as HTMLTextAreaElement).disabled).toBe(false);
    expect((screen.getByRole('button', { name: 'Post' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });
}

function expandCard(text: string): HTMLLIElement {
  const row = screen.getByText(text).closest('li');
  expect(row).toBeTruthy();
  const expand = row?.querySelector<HTMLButtonElement>('[aria-label="Show replies"]');
  expect(expand).toBeTruthy();
  fireEvent.click(expand as HTMLButtonElement);
  return row as HTMLLIElement;
}

async function renderTwoPostFeed(): Promise<void> {
  vi.mocked(fetchMemberPosts).mockResolvedValue([secondPost, note]);
  renderWithLocale(
    <MemberProfileScreen
      profile={{ ...profileWithNote, postCount: 2 }}
      received={[]}
      donated={[]}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: '2 posts' }));
  await screen.findByText('Second post from Carol.');
}

function fillPaidReply(text: string, amount = '1'): void {
  fireEvent.change(screen.getByLabelText('Your reply'), { target: { value: text } });
  fireEvent.change(screen.getByLabelText('Amount'), { target: { value: amount } });
}

beforeEach(() => {
  vi.clearAllMocks();
  push.mockClear();
  vi.mocked(fetchMemberPosts).mockResolvedValue([]);
  vi.mocked(fetchMemberReplies).mockResolvedValue([]);
  vi.mocked(fetchReplies).mockResolvedValue([]);
  vi.mocked(openConversation).mockResolvedValue({
    id: 'conv-1',
    kind: 'member_member',
    name: 'Carol',
    lastText: '',
    lastAt: '2026-01-01T00:00:00.000Z',
    lastFromMe: false,
  });
  vi.mocked(postMessageInvoice).mockResolvedValue({ pr: 'lnbc1', amountSats: 21 });
  vi.mocked(fetchPublicMessage).mockResolvedValue(null);
  vi.mocked(postMessage).mockResolvedValue({
    ...note,
    id: '44444444-4444-4444-8444-444444444444',
    text: 'reply',
  });
  useAuthStore.setState({
    session: 'sess',
    account,
  });
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

afterEach(async () => {
  vi.useRealTimers();
  await act(async () => {
    await Promise.resolve();
  });
  cleanup();
  Object.defineProperty(navigator, 'userAgent', {
    configurable: true,
    value: originalUserAgent,
  });
  Object.assign(navigator, { clipboard: originalClipboard });
});

describe('MemberProfileScreen', () => {
  it('keeps member notes ₿-only when gift stats fail', async () => {
    vi.mocked(fetchGiftStats).mockRejectedValueOnce(new Error('stats down'));
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('Hello from my profile note.')).toBeTruthy();
    });
    expect(screen.queryByText('—')).toBeNull();
  });

  it('shows name, address, chart empty state, and role pill', () => {
    renderWithLocale(<MemberProfileScreen profile={profile} received={[]} donated={[]} />);
    expect(screen.getByRole('heading', { name: 'Profile' }).className).toContain('sm:text-3xl');
    expect(screen.getByText('Carol')).toBeTruthy();
    expect(screen.getByText('carol@walletofsatoshi.com')).toBeTruthy();
    expect(screen.getByText('No gifts yet.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Verified' })).toBeTruthy();
  });

  it('shows a read-only location row without edit controls', () => {
    renderWithLocale(<MemberProfileScreen profile={profile} received={[]} donated={[]} />);
    expect(screen.getByText('Location')).toBeTruthy();
    expect(screen.getByText('Not set')).toBeTruthy();
    cleanup();
    renderWithLocale(
      <MemberProfileScreen profile={{ ...profile, location: 'Zug' }} received={[]} donated={[]} />,
    );
    expect(screen.getByText('Zug')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Edit location' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Clear location' })).toBeNull();
  });

  it('toggles the role hint', () => {
    renderWithLocale(<MemberProfileScreen profile={profile} received={[]} donated={[]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Verified' }));
    expect(screen.getByText(/confirmed they are real/i)).toBeTruthy();
  });

  it('shows clickable post and reply counts, including the empty 0/0 state', () => {
    renderWithLocale(<MemberProfileScreen profile={profile} received={[]} donated={[]} />);
    const posts = screen.getByRole('button', { name: '0 posts' });
    const replies = screen.getByRole('button', { name: '0 replies' });
    expect(posts.getAttribute('aria-pressed')).toBe('false');
    expect(replies.getAttribute('aria-pressed')).toBe('false');
    expect(posts.className).not.toContain('px-3 py-1');
    expect(replies.className).not.toContain('px-3 py-1');
  });

  it('opens and collapses the posts feed without a pinned forum bio', async () => {
    vi.mocked(fetchMemberPosts).mockResolvedValue([secondPost]);
    renderWithLocale(<MemberProfileScreen profile={profileWithNote} received={[]} donated={[]} />);

    expect(screen.queryByText('Hello from my profile note.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '1 posts' }));
    expect(await screen.findByText('Second post from Carol.')).toBeTruthy();
    expect(fetchMemberPosts).toHaveBeenCalledWith('sess', profile.id);

    fireEvent.click(screen.getByRole('button', { name: '1 posts' }));
    expect(screen.queryByText('Second post from Carol.')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '1 posts' }));
    expect(await screen.findByText('Second post from Carol.')).toBeTruthy();
    expect(fetchMemberPosts).toHaveBeenCalledTimes(1);
  });

  it('does not refetch posts when reopening an in-flight feed', async () => {
    let resolvePosts!: (value: (typeof secondPost)[]) => void;
    vi.mocked(fetchMemberPosts).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePosts = resolve;
        }),
    );
    renderWithLocale(<MemberProfileScreen profile={profileWithNote} received={[]} donated={[]} />);
    fireEvent.click(screen.getByRole('button', { name: '1 posts' }));
    await waitFor(() => {
      expect(fetchMemberPosts).toHaveBeenCalledTimes(1);
    });
    fireEvent.click(screen.getByRole('button', { name: '1 posts' }));
    fireEvent.click(screen.getByRole('button', { name: '1 posts' }));
    expect(fetchMemberPosts).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolvePosts([secondPost]);
    });
  });

  it('opens the replies feed without a pinned forum bio', async () => {
    vi.mocked(fetchMemberReplies).mockResolvedValue([activityReply]);
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profileWithNote, replyCount: 1 }}
        received={[]}
        donated={[]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '1 replies' }));
    expect(await screen.findByText('A reply from Carol.')).toBeTruthy();
    expect(screen.queryByText('Hello from my profile note.')).toBeNull();
    expect(fetchMemberReplies).toHaveBeenCalledWith('sess', profile.id);

    fireEvent.click(screen.getByRole('button', { name: '1 replies' }));
    fireEvent.click(screen.getByRole('button', { name: '1 replies' }));
    expect(await screen.findByText('A reply from Carol.')).toBeTruthy();
    expect(fetchMemberReplies).toHaveBeenCalledTimes(1);
  });

  it('does not refetch replies when reopening an in-flight feed', async () => {
    let resolveReplies!: (value: (typeof activityReply)[]) => void;
    vi.mocked(fetchMemberReplies).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveReplies = resolve;
        }),
    );
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profileWithNote, replyCount: 1 }}
        received={[]}
        donated={[]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '1 replies' }));
    await waitFor(() => {
      expect(fetchMemberReplies).toHaveBeenCalledTimes(1);
    });
    fireEvent.click(screen.getByRole('button', { name: '1 replies' }));
    fireEvent.click(screen.getByRole('button', { name: '1 replies' }));
    expect(fetchMemberReplies).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveReplies([activityReply]);
    });
  });

  it('shows when the posts feed is truncated', async () => {
    vi.mocked(fetchMemberPosts).mockResolvedValue([secondPost]);
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profileWithNote, postCount: 3 }}
        received={[]}
        donated={[]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '3 posts' }));
    expect(await screen.findByText('Second post from Carol.')).toBeTruthy();
    expect(screen.getByText('Showing the latest 1 of 3.')).toBeTruthy();
  });

  it('opens the parent note when a reply activity card is expanded', async () => {
    vi.mocked(fetchMemberReplies).mockResolvedValue([activityReply]);
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profileWithNote, replyCount: 1 }}
        received={[]}
        donated={[]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '1 replies' }));
    const replyText = await screen.findByText('A reply from Carol.');
    const replyRow = replyText.closest('li');
    const expand = replyRow?.querySelector<HTMLButtonElement>('[aria-label="Show replies"]');
    expect(expand).toBeTruthy();
    fireEvent.click(expand as HTMLButtonElement);
    expect(push).toHaveBeenCalledWith('/messages/55555555-5555-4555-8555-555555555555');
  });

  it('shows an activity error when the session is missing', async () => {
    useAuthStore.setState({ session: null, account });
    renderWithLocale(<MemberProfileScreen profile={profileWithNote} received={[]} donated={[]} />);
    fireEvent.click(screen.getByRole('button', { name: '1 posts' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Could not load messages. Please try again.');
    expect(alert.className).toContain('text-app-danger');
    expect(fetchMemberPosts).not.toHaveBeenCalled();
  });

  it('sends a missing-requirements feed load to rules setup', async () => {
    vi.mocked(fetchMemberPosts).mockRejectedValueOnce(new MissingRequirementsError(['rules']));
    renderWithLocale(<MemberProfileScreen profile={profileWithNote} received={[]} donated={[]} />);
    fireEvent.click(screen.getByRole('button', { name: '1 posts' }));
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/setup/rules');
    });
  });

  it('shows an activity error and retries the selected feed', async () => {
    vi.mocked(fetchMemberPosts)
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce([secondPost]);
    renderWithLocale(<MemberProfileScreen profile={profileWithNote} received={[]} donated={[]} />);
    fireEvent.click(screen.getByRole('button', { name: '1 posts' }));
    expect(await screen.findByText('Could not load messages. Please try again.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Second post from Carol.')).toBeTruthy();
    expect(fetchMemberPosts).toHaveBeenCalledTimes(2);
  });

  it('does not apply a stale posts feed error onto a newer success', async () => {
    vi.mocked(fetchMemberPosts).mockRejectedValueOnce(new Error('fail'));
    renderWithLocale(<MemberProfileScreen profile={profileWithNote} received={[]} donated={[]} />);
    fireEvent.click(screen.getByRole('button', { name: '1 posts' }));
    expect(await screen.findByText('Could not load messages. Please try again.')).toBeTruthy();
    const retry = screen.getByRole('button', { name: 'Try again' });
    let rejectOlder!: (reason: Error) => void;
    let resolveNewer!: (value: (typeof secondPost)[]) => void;
    let overlapping = 0;
    vi.mocked(fetchMemberPosts).mockImplementation(() => {
      overlapping += 1;
      if (overlapping === 1) {
        const older = new Promise<(typeof secondPost)[]>((_resolve, reject) => {
          rejectOlder = reject;
        });
        retry.click();
        return older;
      }
      return new Promise((resolve) => {
        resolveNewer = resolve;
      });
    });
    fireEvent.click(retry);
    fireEvent.click(retry);
    await waitFor(() => {
      expect(overlapping).toBe(2);
    });
    await act(async () => {
      resolveNewer([secondPost]);
    });
    expect(screen.getByText('Second post from Carol.')).toBeTruthy();
    await act(async () => {
      rejectOlder(new Error('fail'));
    });
    expect(screen.getByText('Second post from Carol.')).toBeTruthy();
    expect(screen.queryByText('Could not load messages. Please try again.')).toBeNull();
  });

  it('does not apply a stale posts feed onto a newer success', async () => {
    vi.mocked(fetchMemberPosts).mockRejectedValueOnce(new Error('fail'));
    renderWithLocale(<MemberProfileScreen profile={profileWithNote} received={[]} donated={[]} />);
    fireEvent.click(screen.getByRole('button', { name: '1 posts' }));
    expect(await screen.findByText('Could not load messages. Please try again.')).toBeTruthy();
    const retry = screen.getByRole('button', { name: 'Try again' });
    let resolveOlder!: (value: (typeof secondPost)[]) => void;
    let resolveNewer!: (value: (typeof secondPost)[]) => void;
    let overlapping = 0;
    vi.mocked(fetchMemberPosts).mockImplementation(() => {
      overlapping += 1;
      if (overlapping === 1) {
        const older = new Promise<(typeof secondPost)[]>((resolve) => {
          resolveOlder = resolve;
        });
        retry.click();
        return older;
      }
      return new Promise((resolve) => {
        resolveNewer = resolve;
      });
    });
    fireEvent.click(retry);
    fireEvent.click(retry);
    await waitFor(() => {
      expect(overlapping).toBe(2);
    });
    await act(async () => {
      resolveNewer([secondPost]);
    });
    expect(screen.getByText('Second post from Carol.')).toBeTruthy();
    await act(async () => {
      resolveOlder([note]);
    });
    expect(screen.getByText('Second post from Carol.')).toBeTruthy();
    expect(screen.queryByText('Hello from my profile note.')).toBeNull();
  });

  it('shows About me text when aboutMe is set', async () => {
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, aboutMe: 'Hello from Carol.' }}
        received={[]}
        donated={[]}
      />,
    );
    expect(screen.getByText('About me')).toBeTruthy();
    expect(screen.getByText('Hello from Carol.')).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Copy link to this profile' })).toBeTruthy();
    });
  });

  it('omits the About me heading when aboutMe is null', async () => {
    renderWithLocale(<MemberProfileScreen profile={profile} received={[]} donated={[]} />);
    expect(screen.queryByText('About me')).toBeNull();
    expect(screen.queryByText('Tell others who you are.')).toBeNull();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Copy link to this profile' })).toBeTruthy();
    });
  });

  it('copies the member profile URL without showing it', async () => {
    const writeText = stubClipboard(() => Promise.resolve());
    renderWithLocale(<MemberProfileScreen profile={profile} received={[]} donated={[]} />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Copy link to this profile' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Copy link to this profile' }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/members/${profile.id}`);
    });
    expect(screen.queryByText(`${window.location.origin}/members/${profile.id}`)).toBeNull();
    expect(screen.queryByText(`/members/${profile.id}`)).toBeNull();
  });

  it('shows Message for another member with a profileMessage', () => {
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    expect(screen.getByRole('button', { name: 'Message' })).toBeTruthy();
    expect(screen.queryByText('Message')).toBeNull();
    expect(screen.queryByText('Hello from my profile note.')).toBeNull();
  });

  it('hides Message on the viewer own profile', () => {
    useAuthStore.setState({
      session: 'sess',
      account: {
        ...account,
        id: profile.id,
        role: 'verified',
        name: 'Carol',
        lightningAddress: 'carol@walletofsatoshi.com',
      },
    });
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Message' })).toBeNull();
  });

  it('opens a conversation from Message and navigates to the inbox', async () => {
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Message' }));
    await waitFor(() => {
      expect(openConversation).toHaveBeenCalledWith('sess', note.id);
    });
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/messages?c=conv-1');
    });
  });

  it('spins the Message control while openConversation is in flight', async () => {
    let resolveConversation!: (value: Awaited<ReturnType<typeof openConversation>>) => void;
    vi.mocked(openConversation).mockReturnValue(
      new Promise((resolve) => {
        resolveConversation = resolve;
      }),
    );
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Message' }));
    const button = screen.getByRole('button', { name: 'Message' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.querySelector('.animate-spin')).toBeTruthy();
    await act(async () => {
      resolveConversation({
        id: 'conv-1',
        kind: 'member_member',
        name: 'Carol',
        lastText: '',
        lastAt: '2026-01-01T00:00:00.000Z',
        lastFromMe: false,
      });
    });
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/messages?c=conv-1');
    });
  });

  it('requests a pay invoice from the profile note', async () => {
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    await openPostsShowingNote();
    fireEvent.click(screen.getByRole('button', { name: 'Send Bitcoin' }));
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => {
      expect(postMessageInvoice).toHaveBeenCalledWith('sess', note.id, 21);
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Pay with Wallet of Satoshi' })).toBeTruthy();
    });
  });

  it('invoices 21 sats when the member pay amount is left empty', async () => {
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Send Bitcoin' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => {
      expect(postMessageInvoice).toHaveBeenCalledWith('sess', note.id, 21);
    });
  });

  it('requests the invoice on iPhone Pay without assigning the wallet href', async () => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    });
    const assign = vi.fn();
    vi.stubGlobal('location', { assign });
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    await openPostsShowingNote();
    fireEvent.click(screen.getByRole('button', { name: 'Send Bitcoin' }));
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pay' }));
    await waitFor(() => {
      expect(postMessageInvoice).toHaveBeenCalledWith('sess', note.id, 21);
    });
    expect(assign).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Pay with Wallet of Satoshi' })).toBeTruthy();
    });
    vi.unstubAllGlobals();
  });

  it('does not assign Wallet of Satoshi after cancelling an in-flight iPhone pay', async () => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    });
    const assign = vi.fn();
    vi.stubGlobal('location', { assign });
    let resolveInvoice!: (value: { pr: string; amountSats: number }) => void;
    vi.mocked(postMessageInvoice).mockReturnValue(
      new Promise((resolve) => {
        resolveInvoice = resolve;
      }),
    );
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    await openPostsShowingNote();
    fireEvent.click(screen.getByRole('button', { name: 'Send Bitcoin' }));
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pay' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    await act(async () => {
      resolveInvoice({ pr: 'lnbc1', amountSats: 21 });
    });
    expect(assign).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Pay with Wallet of Satoshi' })).toBeNull();
    vi.unstubAllGlobals();
  });

  it('does not show a pay error after cancelling an in-flight iPhone pay that fails', async () => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    });
    const assign = vi.fn();
    vi.stubGlobal('location', { assign });
    let rejectInvoice!: (reason: Error) => void;
    vi.mocked(postMessageInvoice).mockReturnValue(
      new Promise((_, reject) => {
        rejectInvoice = reject;
      }),
    );
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    await openPostsShowingNote();
    fireEvent.click(screen.getByRole('button', { name: 'Send Bitcoin' }));
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pay' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    await act(async () => {
      rejectInvoice(new Error('fail'));
    });
    expect(assign).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();
    vi.unstubAllGlobals();
  });

  it('does not assign Wallet of Satoshi after unmounting during an in-flight iPhone pay', async () => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    });
    const assign = vi.fn();
    vi.stubGlobal('location', { assign });
    let resolveInvoice!: (value: { pr: string; amountSats: number }) => void;
    vi.mocked(postMessageInvoice).mockReturnValue(
      new Promise((resolve) => {
        resolveInvoice = resolve;
      }),
    );
    const { unmount } = renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    await openPostsShowingNote();
    fireEvent.click(screen.getByRole('button', { name: 'Send Bitcoin' }));
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pay' }));
    unmount();
    await act(async () => {
      resolveInvoice({ pr: 'lnbc1', amountSats: 21 });
    });
    expect(assign).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('loads replies when the profile note is expanded', async () => {
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    await expandNote();
    expect(fetchReplies).toHaveBeenCalledWith('sess', note.id);
  });

  it('rejects a non-numeric pay amount', async () => {
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    await openPostsShowingNote();
    fireEvent.click(screen.getByRole('button', { name: 'Send Bitcoin' }));
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(postMessageInvoice).not.toHaveBeenCalled();
  });

  it('shows a pay error when the invoice request fails', async () => {
    vi.mocked(postMessageInvoice).mockRejectedValue(new Error('fail'));
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    await openPostsShowingNote();
    fireEvent.click(screen.getByRole('button', { name: 'Send Bitcoin' }));
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => {
      expect(screen.getByText(/could not start the bitcoin payment/i)).toBeTruthy();
    });
  });

  it('retries replies after a failed expand', async () => {
    vi.mocked(fetchReplies).mockRejectedValueOnce(new Error('fail')).mockResolvedValueOnce([]);
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    await openPostsShowingNote();
    fireEvent.click(screen.getByRole('button', { name: 'Show replies' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(fetchReplies).toHaveBeenCalledTimes(2);
    });
  });

  it('shows a replies error when retry fails', async () => {
    vi.mocked(fetchReplies).mockRejectedValue(new Error('fail'));
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    await openPostsShowingNote();
    fireEvent.click(screen.getByRole('button', { name: 'Show replies' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(fetchReplies).toHaveBeenCalledTimes(2);
      expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    });
  });

  it('collapses an expanded profile note', async () => {
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    await expandNote();
    fireEvent.click(screen.getByRole('button', { name: 'Hide replies' }));
    expect(screen.queryByLabelText('Your reply')).toBeNull();
  });

  it('cancels an open pay sheet', async () => {
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    await openPostsShowingNote();
    fireEvent.click(screen.getByRole('button', { name: 'Send Bitcoin' }));
    expect(screen.getByLabelText('Amount')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.queryByLabelText('Amount')).toBeNull();
  });

  it('posts a reply on the expanded profile note', async () => {
    renderWithLocale(
      <MemberProfileScreen profile={{ ...profile, profileMessage: note }} received={[]} />,
    );
    await expandNote();
    fillPaidReply('reply', '21');
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    await waitFor(() => {
      expect(postMessageInvoice).toHaveBeenCalledWith('sess', note.id, 21, 'reply');
    });
    expect(postMessage).not.toHaveBeenCalled();
  });

  it('unlocks the composer and marks hasPosted after a paid reply poll', async () => {
    vi.mocked(fetchPublicMessage).mockResolvedValue({ ...note, sats: 42, replyCount: 1 });
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    await expandNote();
    fillPaidReply('reply', '21');
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    await waitFor(() => {
      expect(fetchPublicMessage).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(useAuthStore.getState().account?.hasPosted).toBe(true);
    });
    expect(screen.queryByText('Pay ₿21')).toBeNull();
    await waitFor(() => {
      expect(fetchReplies).toHaveBeenCalledTimes(2);
    });
    expect((screen.getByLabelText('Your reply') as HTMLTextAreaElement).disabled).toBe(false);
  });

  it('does not mark hasPosted on a swapped session after a paid poll', async () => {
    let resolvePoll!: (value: typeof note) => void;
    vi.mocked(fetchPublicMessage).mockReturnValue(
      new Promise((resolve) => {
        resolvePoll = resolve;
      }),
    );
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    await openPostsShowingNote();
    fireEvent.click(screen.getByRole('button', { name: 'Send Bitcoin' }));
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => {
      expect(postMessageInvoice).toHaveBeenCalled();
    });
    useAuthStore.setState({ session: 'other', account: { ...account, id: 'other-acc' } });
    await act(async () => {
      resolvePoll({ ...note, sats: 42 });
    });
    expect(useAuthStore.getState().account?.hasPosted).toBeUndefined();
  });

  it('refetches expanded replies after a paid poll when the account snapshot is missing', async () => {
    let resolvePoll!: (value: typeof note) => void;
    vi.mocked(fetchPublicMessage).mockReturnValue(
      new Promise((resolve) => {
        resolvePoll = resolve;
      }),
    );
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    await expandNote();
    const replyLoads = vi.mocked(fetchReplies).mock.calls.length;
    fillPaidReply('reply', '21');
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    await waitFor(() => {
      expect(postMessageInvoice).toHaveBeenCalled();
    });
    useAuthStore.setState({ session: 'sess', account: null });
    await act(async () => {
      resolvePoll({ ...note, sats: 42, replyCount: 1 });
    });
    await waitFor(() => {
      expect(vi.mocked(fetchReplies).mock.calls.length).toBeGreaterThan(replyLoads);
    });
    expect(useAuthStore.getState().account).toBeNull();
  });

  it('shows a replies error when refetch after pay fails', async () => {
    vi.mocked(fetchPublicMessage).mockResolvedValue({ ...note, sats: 42, replyCount: 1 });
    vi.mocked(fetchReplies).mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('fail'));
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    await expandNote();
    fillPaidReply('reply', '21');
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    });
  });

  it('polls the parent after paying a profile note from the gift button', async () => {
    vi.mocked(fetchPublicMessage).mockResolvedValue({ ...note, sats: 42 });
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    await openPostsShowingNote();
    fireEvent.click(screen.getByRole('button', { name: 'Send Bitcoin' }));
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => {
      expect(fetchPublicMessage).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.queryByText('Pay ₿21')).toBeNull();
    });
  });

  it('polls a posts-feed note after pay', async () => {
    vi.mocked(fetchPublicMessage).mockResolvedValue({ ...secondPost, sats: 21 });
    await renderTwoPostFeed();
    const row = screen.getByText('Second post from Carol.').closest('li');
    const pay = row?.querySelector<HTMLButtonElement>('[aria-label="Send Bitcoin"]');
    expect(pay).toBeTruthy();
    fireEvent.click(pay as HTMLButtonElement);
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => {
      expect(fetchPublicMessage).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.queryByText('Pay ₿21')).toBeNull();
    });
  });

  it('stops polling when the pay sheet is closed after a fetch error', async () => {
    let rejectPoll!: (reason: Error) => void;
    vi.mocked(fetchPublicMessage).mockReturnValueOnce(
      new Promise((_, reject) => {
        rejectPoll = reject;
      }),
    );
    vi.mocked(fetchPublicMessage).mockResolvedValue({ ...note, sats: 42 });
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    await openPostsShowingNote();
    fireEvent.click(screen.getByRole('button', { name: 'Send Bitcoin' }));
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => {
      expect(fetchPublicMessage).toHaveBeenCalled();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    await act(async () => {
      rejectPoll(new Error('poll failed'));
    });
    expect(screen.queryByText('Pay ₿21')).toBeNull();
    expect(fetchPublicMessage).toHaveBeenCalledTimes(1);
  });

  it('drops a late pay invoice after Back', async () => {
    let resolveInvoice!: (value: { pr: string; amountSats: number }) => void;
    vi.mocked(postMessageInvoice).mockReturnValue(
      new Promise((resolve) => {
        resolveInvoice = resolve;
      }),
    );
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    await openPostsShowingNote();
    fireEvent.click(screen.getByRole('button', { name: 'Send Bitcoin' }));
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    await act(async () => {
      resolveInvoice({ pr: 'lnbc1', amountSats: 21 });
    });
    expect(screen.queryByRole('img', { name: 'Bitcoin payment QR code' })).toBeNull();
    expect(fetchPublicMessage).not.toHaveBeenCalled();
  });

  it('drops a late pay invoice error after Back', async () => {
    let rejectInvoice!: (reason: Error) => void;
    vi.mocked(postMessageInvoice).mockReturnValue(
      new Promise((_, reject) => {
        rejectInvoice = reject;
      }),
    );
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    await openPostsShowingNote();
    fireEvent.click(screen.getByRole('button', { name: 'Send Bitcoin' }));
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    await act(async () => {
      rejectInvoice(new Error('gone'));
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('keeps a later gift sheet when an earlier pay poll confirms', async () => {
    let resolveA!: (value: typeof secondPost) => void;
    vi.mocked(fetchPublicMessage).mockImplementation((id) => {
      if (id === secondPost.id) {
        return new Promise((resolve) => {
          resolveA = resolve;
        });
      }
      return Promise.resolve({ ...note, sats: note.sats + 21 });
    });
    await renderTwoPostFeed();
    const rowA = screen.getByText('Second post from Carol.').closest('li');
    const payA = rowA?.querySelector<HTMLButtonElement>('[aria-label="Send Bitcoin"]');
    expect(payA).toBeTruthy();
    fireEvent.click(payA as HTMLButtonElement);
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => {
      expect(screen.getByRole('img', { name: 'Bitcoin payment QR code' })).toBeTruthy();
    });
    const rowB = screen.getByText('Hello from my profile note.').closest('li');
    const payB = rowB?.querySelector<HTMLButtonElement>('[aria-label="Send Bitcoin"]');
    expect(payB).toBeTruthy();
    fireEvent.click(payB as HTMLButtonElement);
    expect(screen.getByLabelText('Amount')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '7' } });
    await act(async () => {
      resolveA({ ...secondPost, sats: 21 });
      await Promise.resolve();
    });
    expect(screen.getByLabelText('Amount')).toBeTruthy();
    expect((screen.getByLabelText('Amount') as HTMLInputElement).value).toBe('7');
    expect(screen.queryByRole('img', { name: 'Bitcoin payment QR code' })).toBeNull();
  });

  it('drops a late paid-reply invoice after Gift is opened', async () => {
    let resolveInvoice!: (value: { pr: string; amountSats: number }) => void;
    vi.mocked(postMessageInvoice).mockReturnValue(
      new Promise((resolve) => {
        resolveInvoice = resolve;
      }),
    );
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    await expandNote();
    fillPaidReply('reply', '21');
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send Bitcoin' }));
    await act(async () => {
      resolveInvoice({ pr: 'lnbc1', amountSats: 21 });
    });
    expect(screen.queryByRole('img', { name: 'Bitcoin payment QR code' })).toBeNull();
    expect(fetchPublicMessage).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
  });

  it('drops a late paid-reply invoice error after Gift is opened', async () => {
    let rejectInvoice!: (reason: Error) => void;
    vi.mocked(postMessageInvoice).mockReturnValue(
      new Promise((_, reject) => {
        rejectInvoice = reject;
      }),
    );
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    await expandNote();
    fillPaidReply('reply', '21');
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send Bitcoin' }));
    await act(async () => {
      rejectInvoice(new Error('fail'));
    });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
  });

  it('does not bump another post reply count when posting on a posts-feed card', async () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'founder' } });
    vi.mocked(postMessage).mockResolvedValue({
      ...secondPost,
      id: '99999999-9999-4999-8999-999999999999',
      text: 'reply',
      payable: false,
    });
    await renderTwoPostFeed();
    const secondRow = expandCard('Second post from Carol.');
    await waitFor(() => {
      expect(screen.getByLabelText('Your reply')).toBeTruthy();
      expect((screen.getByLabelText('Your reply') as HTMLTextAreaElement).disabled).toBe(false);
      expect((screen.getByRole('button', { name: 'Post' }) as HTMLButtonElement).disabled).toBe(
        false,
      );
    });
    fireEvent.change(screen.getByLabelText('Your reply'), { target: { value: 'reply' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    await waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith('sess', {
        text: 'reply',
        inReplyTo: secondPost.id,
      });
    });
    expect(secondRow.textContent).toMatch(/1 replies/);
    fireEvent.click(screen.getByRole('button', { name: '2 posts' }));
    expect(screen.queryByText('Hello from my profile note.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '2 posts' }));
    expect(await screen.findByText('Hello from my profile note.')).toBeTruthy();
    const pinRow = screen.getByText('Hello from my profile note.').closest('li');
    expect(pinRow?.textContent).toMatch(/0 replies/);
    expect(screen.getByRole('button', { name: '0 replies' })).toBeTruthy();
  });

  it('does not apply a stale expand onto a newer thread', async () => {
    let resolveNoteReplies!: (value: Array<typeof note>) => void;
    vi.mocked(fetchReplies).mockImplementation((_session, messageId) => {
      if (messageId === note.id) {
        return new Promise((resolve) => {
          resolveNoteReplies = resolve;
        });
      }
      return Promise.resolve([liveSecondReply]);
    });
    await renderTwoPostFeed();
    expandCard('Hello from my profile note.');
    await waitFor(() => {
      expect(fetchReplies).toHaveBeenCalledWith('sess', note.id);
    });
    expandCard('Second post from Carol.');
    expect(await screen.findByText('Live second-post reply.')).toBeTruthy();
    await act(async () => {
      resolveNoteReplies([stalePinReply]);
    });
    expect(screen.getByText('Live second-post reply.')).toBeTruthy();
    expect(screen.queryByText('Stale pin thread reply.')).toBeNull();
  });

  it('does not apply a stale expand error onto a newer thread', async () => {
    let rejectNoteReplies!: (reason: Error) => void;
    vi.mocked(fetchReplies).mockImplementation((_session, messageId) => {
      if (messageId === note.id) {
        return new Promise((_resolve, reject) => {
          rejectNoteReplies = reject;
        });
      }
      return Promise.resolve([liveSecondReply]);
    });
    await renderTwoPostFeed();
    expandCard('Hello from my profile note.');
    await waitFor(() => {
      expect(fetchReplies).toHaveBeenCalledWith('sess', note.id);
    });
    expandCard('Second post from Carol.');
    expect(await screen.findByText('Live second-post reply.')).toBeTruthy();
    await act(async () => {
      rejectNoteReplies(new Error('fail'));
    });
    expect(screen.getByText('Live second-post reply.')).toBeTruthy();
    expect(screen.queryByText('Could not load replies. Please try again.')).toBeNull();
  });

  it('does not apply a stale expand onto the same thread after collapse and re-expand', async () => {
    let resolveFirstExpand!: (value: Array<typeof note>) => void;
    vi.mocked(fetchReplies)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirstExpand = resolve;
          }),
      )
      .mockResolvedValue([liveSecondReply]);
    await renderTwoPostFeed();
    expandCard('Hello from my profile note.');
    await waitFor(() => {
      expect(fetchReplies).toHaveBeenCalledWith('sess', note.id);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Hide replies' }));
    expandCard('Hello from my profile note.');
    expect(await screen.findByText('Live second-post reply.')).toBeTruthy();
    await act(async () => {
      resolveFirstExpand([stalePinReply]);
    });
    expect(screen.getByText('Live second-post reply.')).toBeTruthy();
    expect(screen.queryByText('Stale pin thread reply.')).toBeNull();
  });

  it('does not apply a stale replies retry onto a newer thread', async () => {
    let resolveNoteRetry!: (value: Array<typeof note>) => void;
    vi.mocked(fetchReplies)
      .mockRejectedValueOnce(new Error('fail'))
      .mockImplementation((_session, messageId) => {
        if (messageId === note.id) {
          return new Promise((resolve) => {
            resolveNoteRetry = resolve;
          });
        }
        return Promise.resolve([liveSecondReply]);
      });
    await renderTwoPostFeed();
    expandCard('Hello from my profile note.');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(fetchReplies).toHaveBeenCalledTimes(2);
    });
    expandCard('Second post from Carol.');
    expect(await screen.findByText('Live second-post reply.')).toBeTruthy();
    await act(async () => {
      resolveNoteRetry([stalePinReply]);
    });
    expect(screen.getByText('Live second-post reply.')).toBeTruthy();
    expect(screen.queryByText('Stale pin thread reply.')).toBeNull();
  });

  it('does not apply a stale replies retry error onto a newer thread', async () => {
    let rejectNoteRetry!: (reason: Error) => void;
    vi.mocked(fetchReplies)
      .mockRejectedValueOnce(new Error('fail'))
      .mockImplementation((_session, messageId) => {
        if (messageId === note.id) {
          return new Promise((_resolve, reject) => {
            rejectNoteRetry = reject;
          });
        }
        return Promise.resolve([liveSecondReply]);
      });
    await renderTwoPostFeed();
    expandCard('Hello from my profile note.');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(fetchReplies).toHaveBeenCalledTimes(2);
    });
    expandCard('Second post from Carol.');
    expect(await screen.findByText('Live second-post reply.')).toBeTruthy();
    await act(async () => {
      rejectNoteRetry(new Error('fail'));
    });
    expect(screen.getByText('Live second-post reply.')).toBeTruthy();
    expect(screen.queryByText('Could not load replies. Please try again.')).toBeNull();
  });

  it('does not apply a stale replies retry onto the same thread after collapse and re-expand', async () => {
    let resolveNoteRetry!: (value: Array<typeof note>) => void;
    vi.mocked(fetchReplies)
      .mockRejectedValueOnce(new Error('fail'))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveNoteRetry = resolve;
          }),
      )
      .mockResolvedValue([liveSecondReply]);
    await renderTwoPostFeed();
    expandCard('Hello from my profile note.');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(fetchReplies).toHaveBeenCalledTimes(2);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Hide replies' }));
    expandCard('Hello from my profile note.');
    expect(await screen.findByText('Live second-post reply.')).toBeTruthy();
    await act(async () => {
      resolveNoteRetry([stalePinReply]);
    });
    expect(screen.getByText('Live second-post reply.')).toBeTruthy();
    expect(screen.queryByText('Stale pin thread reply.')).toBeNull();
  });

  it('does not append an in-flight reply POST into a different expanded thread', async () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'founder' } });
    let resolvePost!: (value: typeof note) => void;
    vi.mocked(postMessage).mockReturnValue(
      new Promise((resolve) => {
        resolvePost = resolve;
      }),
    );
    await renderTwoPostFeed();
    expandCard('Hello from my profile note.');
    await waitFor(() => {
      expect(screen.getByLabelText('Your reply')).toBeTruthy();
      expect((screen.getByLabelText('Your reply') as HTMLTextAreaElement).disabled).toBe(false);
      expect((screen.getByRole('button', { name: 'Post' }) as HTMLButtonElement).disabled).toBe(
        false,
      );
    });
    fireEvent.change(screen.getByLabelText('Your reply'), {
      target: { value: 'In-flight first-thread reply.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    expandCard('Second post from Carol.');
    const secondRow = screen.getByText('Second post from Carol.').closest('li');
    expect(secondRow).toBeTruthy();
    if (secondRow !== null && secondRow.querySelector('[aria-label="Hide replies"]') !== null) {
      await waitFor(() => {
        const composer = secondRow.querySelector<HTMLTextAreaElement>('[aria-label="Your reply"]');
        expect(composer).toBeTruthy();
        expect(composer?.disabled).toBe(false);
      });
    }
    await act(async () => {
      resolvePost({
        ...note,
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        text: 'In-flight first-thread reply.',
        sats: 0,
        payable: false,
      });
    });
    expect(screen.getByText('Second post from Carol.').closest('li')?.textContent).not.toMatch(
      /In-flight first-thread reply\./,
    );
  });

  it('still lists an in-flight reply when the same parent is expanded', async () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'founder' } });
    let resolvePost!: (value: typeof note) => void;
    vi.mocked(postMessage).mockReturnValue(
      new Promise((resolve) => {
        resolvePost = resolve;
      }),
    );
    await renderTwoPostFeed();
    const firstRow = expandCard('Hello from my profile note.');
    await waitFor(() => {
      expect(screen.getByLabelText('Your reply')).toBeTruthy();
      expect((screen.getByLabelText('Your reply') as HTMLTextAreaElement).disabled).toBe(false);
      expect((screen.getByRole('button', { name: 'Post' }) as HTMLButtonElement).disabled).toBe(
        false,
      );
    });
    fireEvent.change(screen.getByLabelText('Your reply'), {
      target: { value: 'In-flight same-parent reply.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    const hide = firstRow.querySelector<HTMLButtonElement>('[aria-label="Hide replies"]');
    if (hide !== null) {
      fireEvent.click(hide);
    }
    if (firstRow.querySelector('[aria-label="Show replies"]') !== null) {
      expandCard('Hello from my profile note.');
      await waitFor(() => {
        expect(screen.getByLabelText('Your reply')).toBeTruthy();
        expect((screen.getByLabelText('Your reply') as HTMLTextAreaElement).disabled).toBe(false);
      });
    }
    await act(async () => {
      resolvePost({
        ...note,
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        text: 'In-flight same-parent reply.',
        sats: 0,
        payable: false,
      });
    });
    if (firstRow.querySelector('[aria-label="Hide replies"]') !== null) {
      expect(screen.getByText('In-flight same-parent reply.')).toBeTruthy();
    }
  });

  it('does not post a reply after the session is cleared', async () => {
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    await expandNote();
    useAuthStore.setState({ session: null, account });
    fireEvent.change(screen.getByLabelText('Your reply'), { target: { value: 'reply' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    expect(postMessage).not.toHaveBeenCalled();
  });

  it('ignores a second reply submit while posting', async () => {
    let resolveInvoice!: (value: { pr: string; amountSats: number }) => void;
    vi.mocked(postMessageInvoice).mockReturnValue(
      new Promise((resolve) => {
        resolveInvoice = resolve;
      }),
    );
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    await expandNote();
    fillPaidReply('reply', '1');
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    expect(postMessageInvoice).toHaveBeenCalledTimes(1);
    resolveInvoice({ pr: 'lnbc1', amountSats: 1 });
    await waitFor(() => {
      expect(postMessageInvoice).toHaveBeenCalledTimes(1);
    });
  });

  it('does not post a reply longer than the forum limit', async () => {
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    await expandNote();
    fireEvent.change(screen.getByLabelText('Your reply'), {
      target: { value: 'a'.repeat(FORUM_MESSAGE_MAX_LENGTH + 1) },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    expect(screen.getByRole('alert').textContent).toMatch(/500 characters/i);
    expect(postMessage).not.toHaveBeenCalled();
  });

  it('shows a request error when a reply fails', async () => {
    vi.mocked(postMessageInvoice).mockRejectedValue(new Error('fail'));
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    await expandNote();
    fillPaidReply('reply', '1');
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
    });
  });

  it('requires a sat amount to reply on someone else’s note', async () => {
    vi.mocked(postMessageInvoice).mockResolvedValue({ pr: 'lnbc1', amountSats: 1 });
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    await expandNote();
    fireEvent.change(screen.getByLabelText('Your reply'), { target: { value: 'reply' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    await waitFor(() => {
      expect(postMessageInvoice).toHaveBeenCalledWith('sess', note.id, 1, 'reply');
    });
    expect(postMessage).not.toHaveBeenCalled();
  });

  it('still requires a sat when someone else’s note omits accountId', async () => {
    const noteWithoutAccount = { ...note, accountId: undefined };
    vi.mocked(postMessageInvoice).mockResolvedValue({ pr: 'lnbc1', amountSats: 1 });
    renderWithLocale(
      <MemberProfileScreen profile={{ ...profile, postCount: 1 }} received={[]} donated={[]} />,
    );
    await expandNote(noteWithoutAccount);
    fireEvent.change(screen.getByLabelText('Your reply'), { target: { value: 'reply' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    await waitFor(() => {
      expect(postMessageInvoice).toHaveBeenCalledWith('sess', note.id, 1, 'reply');
    });
    expect(postMessage).not.toHaveBeenCalled();
  });

  it('lets the profile owner reply unpaid when the note omits accountId', async () => {
    const noteWithoutAccount = { ...note, accountId: undefined };
    vi.mocked(postMessage).mockResolvedValue({
      ...noteWithoutAccount,
      id: 'r-own',
      text: 'own',
      sats: 0,
      payable: false,
    });
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, id: account.id, postCount: 1 }}
        received={[]}
        donated={[]}
      />,
    );
    await expandNote(noteWithoutAccount);
    fireEvent.change(screen.getByLabelText('Your reply'), { target: { value: 'own' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    await waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith('sess', {
        text: 'own',
        inReplyTo: note.id,
      });
    });
    expect(postMessageInvoice).not.toHaveBeenCalled();
  });

  it('rejects a non-numeric reply amount', async () => {
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    await expandNote();
    fillPaidReply('reply', 'abc');
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    expect(screen.getByRole('alert').textContent).toBe('Send at least ₿1 with your reply');
    expect(postMessageInvoice).not.toHaveBeenCalled();
  });

  it('sends 1 sat when the reply amount is 0', async () => {
    vi.mocked(postMessageInvoice).mockResolvedValue({ pr: 'lnbc1', amountSats: 1 });
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    await expandNote();
    fillPaidReply('reply', '0');
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    await waitFor(() => {
      expect(postMessageInvoice).toHaveBeenCalledWith('sess', note.id, 1, 'reply');
    });
  });

  it('rejects an overflowing reply amount', async () => {
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    await expandNote();
    fillPaidReply('reply', '9007199254740992');
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    expect(screen.getByRole('alert').textContent).toBe('Send at least ₿1 with your reply');
    expect(postMessageInvoice).not.toHaveBeenCalled();
  });

  it('invoices a gift-only reply from the composer', async () => {
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    await expandNote();
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    await waitFor(() => {
      expect(postMessageInvoice).toHaveBeenCalledWith('sess', note.id, 21);
    });
    expect(postMessage).not.toHaveBeenCalled();
  });

  it('invoices a gift-only reply when text and amount are empty', async () => {
    vi.mocked(postMessageInvoice).mockResolvedValue({ pr: 'lnbc21n1example', amountSats: 21 });
    renderWithLocale(
      <MemberProfileScreen profile={{ ...profile, profileMessage: note }} received={[]} />,
    );
    await expandNote();
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    await waitFor(() => {
      expect(postMessageInvoice).toHaveBeenCalledWith('sess', note.id, 21);
    });
    expect(postMessage).not.toHaveBeenCalled();
  });

  it('invoices a gift-only reply when text and amount are empty as a founder', async () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'founder' } });
    vi.mocked(postMessageInvoice).mockResolvedValue({ pr: 'lnbc21n1example', amountSats: 21 });
    renderWithLocale(
      <MemberProfileScreen profile={{ ...profile, profileMessage: note }} received={[]} />,
    );
    await expandNote();
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    await waitFor(() => {
      expect(postMessageInvoice).toHaveBeenCalledWith('sess', note.id, 21);
    });
    expect(postMessage).not.toHaveBeenCalled();
  });

  it('retries an unpaid staff reply after a missing_requirements overlay is satisfied', async () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'founder' } });
    vi.mocked(agreeToRules).mockResolvedValue({
      ...account,
      role: 'founder',
      rulesAgreedAt: 2,
      missing: [],
      setup: null,
    });
    vi.mocked(postMessage).mockRejectedValueOnce(new MissingRequirementsError(['rules']));
    vi.mocked(postMessage).mockResolvedValueOnce({
      ...note,
      id: '44444444-4444-4444-8444-444444444444',
      text: 'reply',
    });
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    await expandNote();
    fireEvent.change(screen.getByLabelText('Your reply'), { target: { value: 'reply' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    expect(
      await screen.findByRole('dialog', { name: 'Agree to the living room rules' }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'I agree to these rules' }));
    await waitFor(() => {
      expect(postMessage).toHaveBeenCalledTimes(2);
    });
  });

  it('opens the overlay when an unpaid staff reply returns missing_requirements', async () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'founder' } });
    vi.mocked(postMessage).mockRejectedValue(new MissingRequirementsError(['name']));
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    await expandNote();
    fireEvent.change(screen.getByLabelText('Your reply'), { target: { value: 'reply' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    expect(await screen.findByRole('dialog', { name: 'Add your name' })).toBeTruthy();
  });

  it('does not reopen the overlay when a retried unpaid staff reply is still missing requirements', async () => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, role: 'founder', name: null, missing: ['name'] },
    });
    vi.mocked(setName).mockResolvedValue({
      ...account,
      role: 'founder',
      name: 'Ada',
      missing: [],
      setup: null,
    });
    vi.mocked(postMessage).mockRejectedValue(new MissingRequirementsError(['name']));
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    await expandNote();
    fireEvent.change(screen.getByLabelText('Your reply'), { target: { value: 'reply' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ada' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }));
    await waitFor(() => {
      expect(postMessage).toHaveBeenCalled();
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe('Could not post your message');
    });
  });

  it('maps a reply invoice rate-limit onto the reply error', async () => {
    vi.mocked(postMessageInvoice).mockRejectedValue(new Error('Too many payments'));
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    await expandNote();
    fillPaidReply('reply', '1');
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/too many/i);
    });
  });

  it('maps an over-long invoice comment onto the reply length error', async () => {
    vi.mocked(postMessageInvoice).mockRejectedValue(new Error('Text must be 1–500 characters'));
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    await expandNote();
    fillPaidReply('reply', '1');
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/500 characters/i);
    });
  });

  it('shows a request error when an unpaid staff reply fails', async () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'founder' } });
    vi.mocked(postMessage).mockRejectedValue(new Error('fail'));
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    await expandNote();
    fireEvent.change(screen.getByLabelText('Your reply'), { target: { value: 'reply' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe('Could not post your message');
    });
  });

  it('maps a staff reply rate-limit onto the reply error', async () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'founder' } });
    vi.mocked(postMessage).mockRejectedValue(new Error('Too many messages'));
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    await expandNote();
    fireEvent.change(screen.getByLabelText('Your reply'), { target: { value: 'reply' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/too many/i);
    });
  });

  it('starts a 1-sat invoice when an unpaid reply on a feed post is 403', async () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'founder' } });
    vi.mocked(fetchReplies).mockResolvedValue([]);
    vi.mocked(postMessage).mockRejectedValue(new Error('A reply needs a Bitcoin payment'));
    vi.mocked(postMessageInvoice).mockResolvedValue({ pr: 'lnbc1', amountSats: 1 });
    await renderTwoPostFeed();
    expandCard('Second post from Carol.');
    await waitFor(() => {
      expect(screen.getByLabelText('Your reply')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Your reply'), { target: { value: 'reply' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    await waitFor(() => {
      expect(postMessageInvoice).toHaveBeenCalledWith('sess', secondPost.id, 1, 'reply');
    });
  });

  it('starts a 1-sat invoice when an unpaid reply is 403', async () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'founder' } });
    vi.mocked(postMessage).mockRejectedValue(new Error('A reply needs a Bitcoin payment'));
    vi.mocked(postMessageInvoice).mockResolvedValue({ pr: 'lnbc1', amountSats: 1 });
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    await expandNote();
    fireEvent.change(screen.getByLabelText('Your reply'), { target: { value: 'reply' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    await waitFor(() => {
      expect(postMessageInvoice).toHaveBeenCalledWith('sess', note.id, 1, 'reply');
    });
  });

  it('lets a founder reply without paying', async () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'founder' } });
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    await expandNote();
    fireEvent.change(screen.getByLabelText('Your reply'), { target: { value: 'reply' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    await waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith('sess', { text: 'reply', inReplyTo: note.id });
    });
    expect(postMessageInvoice).not.toHaveBeenCalled();
  });

  it('sets hasPosted after an unpaid founder reply', async () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'founder' } });
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    await expandNote();
    fireEvent.change(screen.getByLabelText('Your reply'), { target: { value: 'reply' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    await waitFor(() => {
      expect(useAuthStore.getState().account?.hasPosted).toBe(true);
    });
  });

  it('does not mark hasPosted when the session changes during an unpaid founder reply', async () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'founder' } });
    let resolvePost!: (value: typeof note) => void;
    vi.mocked(postMessage).mockReturnValue(
      new Promise((resolve) => {
        resolvePost = resolve;
      }),
    );
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    await expandNote();
    fireEvent.change(screen.getByLabelText('Your reply'), { target: { value: 'reply' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    useAuthStore.setState({ session: 'other', account: { ...account, role: 'founder' } });
    await act(async () => {
      resolvePost({
        ...note,
        id: '44444444-4444-4444-8444-444444444444',
        text: 'reply',
        payable: false,
      });
    });
    expect(useAuthStore.getState().account?.hasPosted).toBeUndefined();
  });

  it('does not mark hasPosted when the account vanishes during an unpaid founder reply', async () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'founder' } });
    let resolvePost!: (value: typeof note) => void;
    vi.mocked(postMessage).mockReturnValue(
      new Promise((resolve) => {
        resolvePost = resolve;
      }),
    );
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    await expandNote();
    fireEvent.change(screen.getByLabelText('Your reply'), { target: { value: 'reply' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    useAuthStore.setState({ session: 'sess', account: null });
    await act(async () => {
      resolvePost({
        ...note,
        id: '44444444-4444-4444-8444-444444444444',
        text: 'reply',
        payable: false,
      });
    });
    expect(useAuthStore.getState().account).toBeNull();
  });

  it('opens the requirements overlay when a reply is missing a name', async () => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, name: null, missing: ['name'] },
    });
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    await expandNote();
    fireEvent.change(screen.getByLabelText('Your reply'), { target: { value: 'reply' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    expect(screen.getByRole('dialog', { name: 'Add your name' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull();
    expect(postMessage).not.toHaveBeenCalled();
  });

  it('opens the requirements overlay when a reply is missing a lightning-address', async () => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, lightningAddress: null, missing: ['lightning-address'] },
    });
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    await expandNote();
    fireEvent.change(screen.getByLabelText('Your reply'), { target: { value: 'reply' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    expect(screen.getByRole('dialog', { name: 'Add your Wallet of Satoshi address' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull();
    expect(postMessage).not.toHaveBeenCalled();
  });

  it('retries the reply after the lightning-address overlay is satisfied', async () => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, lightningAddress: null, missing: ['lightning-address'] },
    });
    vi.mocked(setLightningAddress).mockResolvedValue({
      ...account,
      lightningAddress: 'alice@walletofsatoshi.com',
      missing: [],
      setup: null,
    });
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    await expandNote();
    fillPaidReply('reply', '1');
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    fireEvent.change(screen.getByLabelText('Wallet of Satoshi address'), {
      target: { value: 'alice@walletofsatoshi.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Link address' }));
    await waitFor(() => {
      expect(postMessageInvoice).toHaveBeenCalledWith('sess', note.id, 1, 'reply');
    });
  });

  it('dismisses the reply overlay without posting', async () => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, name: null, missing: ['name'] },
    });
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    await expandNote();
    fireEvent.change(screen.getByLabelText('Your reply'), { target: { value: 'reply' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(postMessage).not.toHaveBeenCalled();
  });

  it('opens the overlay when a reply returns missing_requirements', async () => {
    vi.mocked(postMessageInvoice).mockRejectedValue(new MissingRequirementsError(['name']));
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    await expandNote();
    fillPaidReply('reply', '1');
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    expect(await screen.findByRole('dialog', { name: 'Add your name' })).toBeTruthy();
  });

  it('retries the reply after the name overlay is satisfied', async () => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, name: null, missing: ['name'] },
    });
    vi.mocked(setName).mockResolvedValue({
      ...account,
      name: 'Ada',
      missing: [],
      setup: null,
    });
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    await expandNote();
    fillPaidReply('reply', '1');
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ada' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }));
    await waitFor(() => {
      expect(postMessageInvoice).toHaveBeenCalledWith('sess', note.id, 1, 'reply');
    });
  });

  it('advances from rules to name when the overlay still has a gap', async () => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, name: null, rulesAgreedAt: null, missing: ['rules', 'name'] },
    });
    vi.mocked(agreeToRules).mockResolvedValue({
      ...account,
      name: null,
      rulesAgreedAt: 2,
      missing: ['name'],
      setup: 'name',
    });
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    await expandNote();
    fireEvent.change(screen.getByLabelText('Your reply'), { target: { value: 'reply' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    expect(screen.getByRole('dialog', { name: /rules/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'I agree to these rules' }));
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Add your name' })).toBeTruthy();
    });
    expect(postMessage).not.toHaveBeenCalled();
  });

  it('retries the reply after a missing_requirements overlay is satisfied', async () => {
    vi.mocked(agreeToRules).mockResolvedValue({
      ...account,
      rulesAgreedAt: 2,
      missing: [],
      setup: null,
    });
    vi.mocked(postMessageInvoice).mockRejectedValueOnce(new MissingRequirementsError(['rules']));
    vi.mocked(postMessageInvoice).mockResolvedValueOnce({ pr: 'lnbc1', amountSats: 1 });
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    await expandNote();
    fillPaidReply('reply', '1');
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    expect(
      await screen.findByRole('dialog', { name: 'Agree to the living room rules' }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'I agree to these rules' }));
    await waitFor(() => {
      expect(postMessageInvoice).toHaveBeenCalledTimes(2);
    });
  });

  it('does not reopen the overlay when a retried reply is still missing requirements', async () => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, name: null, missing: ['name'] },
    });
    vi.mocked(setName).mockResolvedValue({
      ...account,
      name: 'Ada',
      missing: [],
      setup: null,
    });
    vi.mocked(postMessageInvoice).mockRejectedValue(new MissingRequirementsError(['name']));
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    await expandNote();
    fillPaidReply('reply', '1');
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ada' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }));
    await waitFor(() => {
      expect(postMessageInvoice).toHaveBeenCalled();
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe('Could not post your message');
    });
  });

  it('opens the overlay when a gift continue is missing a name', async () => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, name: null, missing: ['name'] },
    });
    vi.mocked(setName).mockResolvedValue({
      ...account,
      name: 'Ada',
      missing: [],
      setup: null,
    });
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    await openPostsShowingNote();
    fireEvent.click(screen.getByRole('button', { name: 'Send Bitcoin' }));
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('dialog', { name: 'Add your name' })).toBeTruthy();
    expect(postMessageInvoice).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ada' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }));
    await waitFor(() => {
      expect(postMessageInvoice).toHaveBeenCalledWith('sess', note.id, 21);
    });
  });

  it('opens the overlay when a gift continue returns missing_requirements', async () => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, name: null, missing: [] },
    });
    vi.mocked(postMessageInvoice).mockRejectedValueOnce(new MissingRequirementsError(['name']));
    vi.mocked(postMessageInvoice).mockResolvedValueOnce({ pr: 'lnbc1', amountSats: 21 });
    vi.mocked(setName).mockResolvedValue({
      ...account,
      name: 'Ada',
      missing: [],
      setup: null,
    });
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    await openPostsShowingNote();
    fireEvent.click(screen.getByRole('button', { name: 'Send Bitcoin' }));
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('dialog', { name: 'Add your name' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ada' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }));
    await waitFor(() => {
      expect(postMessageInvoice).toHaveBeenCalledTimes(2);
    });
  });

  it('does not reopen the overlay when a retried gift continue is still missing requirements', async () => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, name: null, missing: ['name'] },
    });
    vi.mocked(setName).mockResolvedValue({
      ...account,
      name: 'Ada',
      missing: [],
      setup: null,
    });
    vi.mocked(postMessageInvoice).mockRejectedValue(new MissingRequirementsError(['name']));
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    await openPostsShowingNote();
    fireEvent.click(screen.getByRole('button', { name: 'Send Bitcoin' }));
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ada' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }));
    await waitFor(() => {
      expect(postMessageInvoice).toHaveBeenCalled();
      expect(screen.getByRole('alert').textContent).toBe('Could not start the Bitcoin payment');
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows a replies error when expanding without a session', async () => {
    useAuthStore.setState({ session: null, account });
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note, postCount: 1 }}
        received={[]}
        donated={[]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '1 posts' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(fetchMemberPosts).not.toHaveBeenCalled();
  });

  it('does not show a pay control on the card without opening a feed', () => {
    useAuthStore.setState({ session: null, account });
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Send Bitcoin' })).toBeNull();
    expect(postMessageInvoice).not.toHaveBeenCalled();
  });

  it('rejects a zero pay amount', async () => {
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    await openPostsShowingNote();
    fireEvent.click(screen.getByRole('button', { name: 'Send Bitcoin' }));
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(postMessageInvoice).not.toHaveBeenCalled();
  });

  it('hides Message without a session', () => {
    useAuthStore.setState({ session: null, account });
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Message' })).toBeNull();
    expect(openConversation).not.toHaveBeenCalled();
  });

  it('opens a conversation from a posts-feed card', async () => {
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note, postCount: 1 }}
        received={[]}
        donated={[]}
      />,
    );
    await openPostsShowingNote();
    fireEvent.click(screen.getByRole('button', { name: 'Send a private message' }));
    await waitFor(() => {
      expect(openConversation).toHaveBeenCalledWith('sess', note.id);
    });
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/messages?c=conv-1');
    });
  });

  it('clears the posts-feed PM busy state when opening a conversation fails', async () => {
    vi.mocked(openConversation).mockRejectedValue(new Error('fail'));
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note, postCount: 1 }}
        received={[]}
        donated={[]}
      />,
    );
    await openPostsShowingNote();
    fireEvent.click(screen.getByRole('button', { name: 'Send a private message' }));
    await waitFor(() => {
      expect(openConversation).toHaveBeenCalledTimes(1);
    });
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send a private message' }));
    await waitFor(() => {
      expect(openConversation).toHaveBeenCalledTimes(2);
    });
  });

  it('ignores a second posts-feed PM click while a request is in flight', async () => {
    let resolveThread!: (value: {
      id: string;
      kind: 'member_member' | 'member_platform' | 'member_damus';
      name: string;
      lastText: string;
      lastAt: string;
      lastFromMe: boolean;
    }) => void;
    vi.mocked(openConversation).mockReturnValue(
      new Promise((resolve) => {
        resolveThread = resolve;
      }),
    );
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note, postCount: 1 }}
        received={[]}
        donated={[]}
      />,
    );
    await openPostsShowingNote();
    fireEvent.click(screen.getByRole('button', { name: 'Send a private message' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send a private message' }));
    expect(openConversation).toHaveBeenCalledTimes(1);
    resolveThread({
      id: 'conv-1',
      kind: 'member_member',
      name: 'Carol',
      lastText: '',
      lastAt: '2026-01-01T00:00:00.000Z',
      lastFromMe: false,
    });
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/messages?c=conv-1');
    });
  });

  it('does not retry replies after the session disappears', async () => {
    vi.mocked(fetchReplies).mockRejectedValueOnce(new Error('fail'));
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note, postCount: 1 }}
        received={[]}
        donated={[]}
      />,
    );
    await openPostsShowingNote();
    fireEvent.click(screen.getByRole('button', { name: 'Show replies' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    });
    await act(async () => {
      useAuthStore.setState({ session: null, account });
    });
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(fetchReplies).toHaveBeenCalledTimes(1);
  });

  it('shows a replies error when expanding after the session disappears', async () => {
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note, postCount: 1 }}
        received={[]}
        donated={[]}
      />,
    );
    await openPostsShowingNote();
    await act(async () => {
      useAuthStore.setState({ session: null, account });
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show replies' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    });
    expect(fetchReplies).not.toHaveBeenCalled();
  });

  it('does not open a feed conversation after the session disappears', async () => {
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note, postCount: 1 }}
        received={[]}
        donated={[]}
      />,
    );
    await openPostsShowingNote();
    await act(async () => {
      useAuthStore.setState({ session: null, account });
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send a private message' }));
    expect(openConversation).not.toHaveBeenCalled();
  });

  it('clears the Message busy state when opening a conversation fails', async () => {
    vi.mocked(openConversation).mockRejectedValue(new Error('fail'));
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Message' }));
    await waitFor(() => {
      expect(openConversation).toHaveBeenCalledTimes(1);
    });
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Message' }));
    await waitFor(() => {
      expect(openConversation).toHaveBeenCalledTimes(2);
    });
  });

  it('ignores a second Message click while a request is in flight', async () => {
    let resolveThread!: (value: {
      id: string;
      kind: 'member_member' | 'member_platform' | 'member_damus';
      name: string;
      lastText: string;
      lastAt: string;
      lastFromMe: boolean;
    }) => void;
    vi.mocked(openConversation).mockReturnValue(
      new Promise((resolve) => {
        resolveThread = resolve;
      }),
    );
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    await openPostsShowingNote();
    fireEvent.click(screen.getByRole('button', { name: 'Message' }));
    fireEvent.click(screen.getByRole('button', { name: 'Message' }));
    expect(openConversation).toHaveBeenCalledTimes(1);
    resolveThread({
      id: 'conv-1',
      kind: 'member_member',
      name: 'Carol',
      lastText: '',
      lastAt: '2026-01-01T00:00:00.000Z',
      lastFromMe: false,
    });
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/messages?c=conv-1');
    });
  });

  it('does not navigate to the thread when the session changes mid-message', async () => {
    let resolveThread!: (value: {
      id: string;
      kind: 'member_member' | 'member_platform' | 'member_damus';
      name: string;
      lastText: string;
      lastAt: string;
      lastFromMe: boolean;
    }) => void;
    vi.mocked(openConversation).mockReturnValue(
      new Promise((resolve) => {
        resolveThread = resolve;
      }),
    );
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Message' }));
    act(() => {
      useAuthStore.setState({ session: 'other' });
    });
    resolveThread({
      id: 'conv-1',
      kind: 'member_member',
      name: 'Carol',
      lastText: '',
      lastAt: '2026-01-01T00:00:00.000Z',
      lastFromMe: false,
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(push).not.toHaveBeenCalled();
  });

  it('ignores a second pay submit while an invoice is in flight', async () => {
    let resolveInvoice!: (value: { pr: string; amountSats: number }) => void;
    vi.mocked(postMessageInvoice).mockReturnValue(
      new Promise((resolve) => {
        resolveInvoice = resolve;
      }),
    );
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    await openPostsShowingNote();
    fireEvent.click(screen.getByRole('button', { name: 'Send Bitcoin' }));
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(postMessageInvoice).toHaveBeenCalledTimes(1);
    resolveInvoice({ pr: 'lnbc1', amountSats: 21 });
    await waitFor(() => {
      expect(postMessageInvoice).toHaveBeenCalledTimes(1);
    });
  });

  it('shows Verify for a moderator viewing a basis member', () => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, role: 'moderator' },
    });
    renderWithLocale(<MemberProfileScreen profile={{ ...profile, role: 'basis' }} received={[]} />);
    expect(screen.getByRole('button', { name: 'Verify' })).toBeTruthy();
    expect(screen.getByTestId('state-members-staff-verify')).toBeTruthy();
  });

  it('does not show Verify for a basis viewer', () => {
    renderWithLocale(<MemberProfileScreen profile={{ ...profile, role: 'basis' }} received={[]} />);
    expect(screen.queryByRole('button', { name: 'Verify' })).toBeNull();
    expect(screen.queryByTestId('state-members-staff-verify')).toBeNull();
  });

  it('shows unnamed and no-address copy when fields are null', () => {
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, name: null, lightningAddress: null, role: 'basis' }}
        received={[]}
        donated={[]}
      />,
    );
    expect(screen.getByText('Unnamed')).toBeTruthy();
    expect(screen.getByText('No Wallet of Satoshi address')).toBeTruthy();
  });

  it('treats a blank Lightning Address as missing', () => {
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, lightningAddress: '   ' }}
        received={[]}
        donated={[]}
      />,
    );
    expect(screen.getByText('No Wallet of Satoshi address')).toBeTruthy();
  });

  it('posts a reply when the account snapshot is missing', async () => {
    useAuthStore.setState({ session: 'sess', account: null });
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: note }}
        received={[]}
        donated={[]}
      />,
    );
    await expandNote();
    fillPaidReply('reply', '1');
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    await waitFor(() => {
      expect(postMessageInvoice).toHaveBeenCalledWith('sess', note.id, 1, 'reply');
    });
    expect(postMessage).not.toHaveBeenCalled();
  });

  it('loads a photo blob URL for hasPhoto posts and revokes on unmount', async () => {
    vi.mocked(fetchMemberPosts).mockResolvedValue([{ ...secondPost, hasPhoto: true }]);
    const view = renderWithLocale(<MemberProfileScreen profile={profileWithNote} received={[]} />);
    fireEvent.click(screen.getByRole('button', { name: '1 posts' }));
    await waitFor(() => {
      expect(photoMock).toHaveBeenCalledWith('sess', secondPost.id);
    });
    await waitFor(() => {
      expect(screen.getByAltText('Photo from Carol').getAttribute('src')).toBe('blob:mock');
    });
    view.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock');
  });

  it('loads a photo blob URL for a listed profile note', async () => {
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: { ...note, hasPhoto: true }, postCount: 1 }}
        received={[]}
        donated={[]}
      />,
    );
    await openPostsShowingPhotoNote();
    await waitFor(() => {
      expect(photoMock).toHaveBeenCalledWith('sess', note.id);
    });
    await waitFor(() => {
      expect(screen.getByAltText('Photo from Carol').getAttribute('src')).toBe('blob:mock');
    });
  });

  it('loads a photo blob URL for hasPhoto replies', async () => {
    vi.mocked(fetchMemberReplies).mockResolvedValue([{ ...activityReply, hasPhoto: true }]);
    renderWithLocale(
      <MemberProfileScreen profile={{ ...profileWithNote, replyCount: 1 }} received={[]} />,
    );
    fireEvent.click(screen.getByRole('button', { name: '1 replies' }));
    await waitFor(() => {
      expect(photoMock).toHaveBeenCalledWith('sess', activityReply.id);
    });
    await waitFor(() => {
      expect(screen.getByAltText('Photo from Carol').getAttribute('src')).toBe('blob:mock');
    });
  });

  it('loads a photo blob URL for an expanded thread reply', async () => {
    vi.mocked(fetchReplies).mockResolvedValue([{ ...stalePinReply, hasPhoto: true }]);
    renderWithLocale(
      <MemberProfileScreen profile={{ ...profile, profileMessage: note }} received={[]} />,
    );
    await expandNote();
    await waitFor(() => {
      expect(photoMock).toHaveBeenCalledWith('sess', stalePinReply.id);
    });
    expect(screen.queryByAltText('Photo from Carol')).toBeNull();
  });

  it('retries a transient photo fetch failure once for a visible note', async () => {
    photoMock.mockRejectedValueOnce(new Error('transient'));
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: { ...note, hasPhoto: true }, postCount: 1 }}
        received={[]}
        donated={[]}
      />,
    );
    await openPostsShowingPhotoNote();
    await waitFor(() => {
      expect(screen.getByAltText('Photo from Carol').getAttribute('src')).toBe('blob:mock');
    });
    expect(photoMock).toHaveBeenCalledTimes(2);
  });

  it('ignores a failed photo fetch', async () => {
    photoMock.mockRejectedValue(new Error('gone'));
    renderWithLocale(
      <MemberProfileScreen
        profile={{
          ...profile,
          profileMessage: { ...note, hasPhoto: true, text: 'Hello from my profile note.' },
          postCount: 1,
        }}
        received={[]}
        donated={[]}
      />,
    );
    await openPostsShowingPhotoNote();
    await waitFor(() => {
      expect(photoMock).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByText('Hello from my profile note.')).toBeTruthy();
    expect(screen.queryByAltText('Photo from Carol')).toBeNull();
  });

  it('ignores a stale photo fetch after unmount', async () => {
    let resolvePhoto: ((value: Blob) => void) | undefined;
    photoMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePhoto = resolve;
        }),
    );
    const view = renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: { ...note, hasPhoto: true }, postCount: 1 }}
        received={[]}
        donated={[]}
      />,
    );
    await openPostsShowingPhotoNote();
    await waitFor(() => {
      expect(photoMock).toHaveBeenCalled();
    });
    view.unmount();
    resolvePhoto?.(new Blob([new Uint8Array([1])], { type: 'image/jpeg' }));
    await Promise.resolve();
  });

  it('revokes a photo blob if unmount happens during createObjectURL', async () => {
    let resolvePhoto: ((value: Blob) => void) | undefined;
    photoMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePhoto = resolve;
        }),
    );
    const view = renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: { ...note, hasPhoto: true }, postCount: 1 }}
        received={[]}
        donated={[]}
      />,
    );
    await openPostsShowingPhotoNote();
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

  it('does not refetch a photo already in photoUrls when reopening posts', async () => {
    vi.mocked(fetchMemberPosts).mockResolvedValue([{ ...secondPost, hasPhoto: true }]);
    renderWithLocale(<MemberProfileScreen profile={profileWithNote} received={[]} />);
    fireEvent.click(screen.getByRole('button', { name: '1 posts' }));
    await waitFor(() => {
      expect(photoMock).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(screen.getByAltText('Photo from Carol').getAttribute('src')).toBe('blob:mock');
    });
    fireEvent.click(screen.getByRole('button', { name: '1 posts' }));
    fireEvent.click(screen.getByRole('button', { name: '1 posts' }));
    expect(photoMock).toHaveBeenCalledTimes(1);
  });

  it('does not fetch photos for hasPhoto false posts', async () => {
    vi.mocked(fetchMemberPosts).mockResolvedValue([secondPost]);
    renderWithLocale(<MemberProfileScreen profile={profileWithNote} received={[]} />);
    fireEvent.click(screen.getByRole('button', { name: '1 posts' }));
    expect(await screen.findByText('Second post from Carol.')).toBeTruthy();
    expect(photoMock).not.toHaveBeenCalled();
  });

  it('does not continue a photo retry after unmount', async () => {
    let rejectRetry: ((reason: Error) => void) | undefined;
    photoMock.mockRejectedValueOnce(new Error('transient')).mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectRetry = reject;
        }),
    );
    const view = renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, profileMessage: { ...note, hasPhoto: true }, postCount: 1 }}
        received={[]}
        donated={[]}
      />,
    );
    await openPostsShowingPhotoNote();
    await waitFor(() => {
      expect(photoMock).toHaveBeenCalledTimes(2);
    });
    view.unmount();
    rejectRetry?.(new Error('gone'));
    await Promise.resolve();
  });

  it('does not fetch the next photo after unmount when the current fetch fails', async () => {
    let rejectFirst: ((reason: Error) => void) | undefined;
    vi.mocked(fetchMemberPosts).mockResolvedValue([
      { ...secondPost, hasPhoto: true },
      { ...note, hasPhoto: true },
    ]);
    photoMock.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectFirst = reject;
        }),
    );
    const view = renderWithLocale(
      <MemberProfileScreen profile={{ ...profileWithNote, postCount: 2 }} received={[]} />,
    );
    fireEvent.click(screen.getByRole('button', { name: '2 posts' }));
    await waitFor(() => {
      expect(photoMock).toHaveBeenCalledTimes(1);
    });
    view.unmount();
    rejectFirst?.(new Error('gone'));
    await Promise.resolve();
    expect(photoMock).toHaveBeenCalledTimes(1);
  });
});
