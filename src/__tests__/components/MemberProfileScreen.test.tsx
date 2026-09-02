import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemberProfileScreen } from '@/components/MemberProfileScreen';
import {
  agreeToRules,
  fetchReplies,
  openConversation,
  postMessage,
  postMessageInvoice,
  setName,
} from '@/lib/api';
import { FORUM_MESSAGE_MAX_LENGTH, type Account, type MemberProfile } from '@/lib/api-types';
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
  dismissForumLaws: vi.fn(),
  fetchMessagePhoto: vi.fn(),
  fetchReplies: vi.fn(),
  openConversation: vi.fn(),
  agreeToRules: vi.fn(),
  setName: vi.fn(),
  skipSetup: vi.fn(),
}));

const profile: MemberProfile = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Carol',
  role: 'verified',
  lightningAddress: 'carol@walletofsatoshi.com',
  createdAt: '2026-01-15T12:00:00.000Z',
  profileMessage: null,
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

const account: Account = {
  id: '11111111-1111-4111-8111-111111111111',
  linkingKey: null,
  role: 'basis',
  name: 'Ada',
  lightningAddress: 'alice@walletofsatoshi.com',
  lightningAddressVerified: false,
  forumLawsDismissed: true,
  createdAt: 1,
  rulesAgreedAt: 1,
  viewKey: 'a'.repeat(64),
  setup: null,
  missing: [],
};

async function expandNote(): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name: 'Show replies' }));
  await waitFor(() => {
    expect(screen.getByLabelText('Your reply')).toBeTruthy();
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  push.mockClear();
  vi.mocked(fetchReplies).mockResolvedValue([]);
  vi.mocked(openConversation).mockResolvedValue({
    id: 'conv-1',
    name: 'Carol',
    lastText: '',
    lastAt: '2026-01-01T00:00:00.000Z',
  });
  vi.mocked(postMessageInvoice).mockResolvedValue({ pr: 'lnbc1', amountSats: 21 });
  vi.mocked(postMessage).mockResolvedValue({
    ...note,
    id: '44444444-4444-4444-8444-444444444444',
    text: 'reply',
  });
  useAuthStore.setState({
    session: 'sess',
    account,
  });
});

afterEach(async () => {
  await act(async () => {
    await Promise.resolve();
  });
  cleanup();
});

describe('MemberProfileScreen', () => {
  it('shows name, address, chart empty state, and role pill', () => {
    renderWithLocale(<MemberProfileScreen profile={profile} received={[]} />);
    expect(screen.getByRole('heading', { name: 'Profile' })).toBeTruthy();
    expect(screen.getByText('Carol')).toBeTruthy();
    expect(screen.getByText('carol@walletofsatoshi.com')).toBeTruthy();
    expect(screen.getByText('No gifts yet.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Verified' })).toBeTruthy();
  });

  it('toggles the role hint', () => {
    renderWithLocale(<MemberProfileScreen profile={profile} received={[]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Verified' }));
    expect(screen.getByText(/confirmed they are real/i)).toBeTruthy();
  });

  it('renders a profile note when present', () => {
    renderWithLocale(
      <MemberProfileScreen profile={{ ...profile, profileMessage: note }} received={[]} />,
    );
    expect(screen.getByText('Hello from my profile note.')).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: 'Your message' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Send a private message' })).toBeTruthy();
  });

  it('hides PM on the viewer own profile note', () => {
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
      <MemberProfileScreen profile={{ ...profile, profileMessage: note }} received={[]} />,
    );
    expect(screen.queryByRole('button', { name: 'Send a private message' })).toBeNull();
  });

  it('opens a conversation from the profile note', async () => {
    renderWithLocale(
      <MemberProfileScreen profile={{ ...profile, profileMessage: note }} received={[]} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Send a private message' }));
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/messages?c=conv-1');
    });
  });

  it('requests a pay invoice from the profile note', async () => {
    renderWithLocale(
      <MemberProfileScreen profile={{ ...profile, profileMessage: note }} received={[]} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Send Bitcoin' }));
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => {
      expect(postMessageInvoice).toHaveBeenCalledWith('sess', note.id, 21);
    });
  });

  it('loads replies when the profile note is expanded', async () => {
    renderWithLocale(
      <MemberProfileScreen profile={{ ...profile, profileMessage: note }} received={[]} />,
    );
    await expandNote();
    expect(fetchReplies).toHaveBeenCalledWith('sess', note.id);
  });

  it('rejects a non-numeric pay amount', () => {
    renderWithLocale(
      <MemberProfileScreen profile={{ ...profile, profileMessage: note }} received={[]} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Send Bitcoin' }));
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(postMessageInvoice).not.toHaveBeenCalled();
  });

  it('shows a pay error when the invoice request fails', async () => {
    vi.mocked(postMessageInvoice).mockRejectedValue(new Error('fail'));
    renderWithLocale(
      <MemberProfileScreen profile={{ ...profile, profileMessage: note }} received={[]} />,
    );
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
      <MemberProfileScreen profile={{ ...profile, profileMessage: note }} received={[]} />,
    );
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
      <MemberProfileScreen profile={{ ...profile, profileMessage: note }} received={[]} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Show replies' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(fetchReplies).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('collapses an expanded profile note', async () => {
    renderWithLocale(
      <MemberProfileScreen profile={{ ...profile, profileMessage: note }} received={[]} />,
    );
    await expandNote();
    fireEvent.click(screen.getByRole('button', { name: 'Hide replies' }));
    expect(screen.queryByLabelText('Your reply')).toBeNull();
  });

  it('cancels an open pay sheet', () => {
    renderWithLocale(
      <MemberProfileScreen profile={{ ...profile, profileMessage: note }} received={[]} />,
    );
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
    fireEvent.change(screen.getByLabelText('Your reply'), { target: { value: 'reply' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    await waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith('sess', { text: 'reply', inReplyTo: note.id });
    });
    expect(screen.getByText('1 replies')).toBeTruthy();
  });

  it('does not post a reply after the session is cleared', async () => {
    renderWithLocale(
      <MemberProfileScreen profile={{ ...profile, profileMessage: note }} received={[]} />,
    );
    await expandNote();
    useAuthStore.setState({ session: null, account });
    fireEvent.change(screen.getByLabelText('Your reply'), { target: { value: 'reply' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    expect(postMessage).not.toHaveBeenCalled();
  });

  it('ignores a second reply submit while posting', async () => {
    let resolvePost!: (value: typeof note) => void;
    vi.mocked(postMessage).mockReturnValue(
      new Promise((resolve) => {
        resolvePost = resolve;
      }),
    );
    renderWithLocale(
      <MemberProfileScreen profile={{ ...profile, profileMessage: note }} received={[]} />,
    );
    await expandNote();
    fireEvent.change(screen.getByLabelText('Your reply'), { target: { value: 'reply' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    expect(postMessage).toHaveBeenCalledTimes(1);
    resolvePost({
      ...note,
      id: '44444444-4444-4444-8444-444444444444',
      text: 'reply',
    });
    await waitFor(() => {
      expect(postMessage).toHaveBeenCalledTimes(1);
    });
  });

  it('does not post an empty reply', async () => {
    renderWithLocale(
      <MemberProfileScreen profile={{ ...profile, profileMessage: note }} received={[]} />,
    );
    await expandNote();
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    expect(screen.getByRole('alert').textContent).toBe('Enter a message or add a photo or video');
    expect(postMessage).not.toHaveBeenCalled();
  });

  it('does not post a reply longer than the forum limit', async () => {
    renderWithLocale(
      <MemberProfileScreen profile={{ ...profile, profileMessage: note }} received={[]} />,
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
    vi.mocked(postMessage).mockRejectedValue(new Error('fail'));
    renderWithLocale(
      <MemberProfileScreen profile={{ ...profile, profileMessage: note }} received={[]} />,
    );
    await expandNote();
    fireEvent.change(screen.getByLabelText('Your reply'), { target: { value: 'reply' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
    });
  });

  it('opens the requirements overlay when a reply is missing a name', async () => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, name: null, missing: ['name'] },
    });
    renderWithLocale(
      <MemberProfileScreen profile={{ ...profile, profileMessage: note }} received={[]} />,
    );
    await expandNote();
    fireEvent.change(screen.getByLabelText('Your reply'), { target: { value: 'reply' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    expect(screen.getByRole('dialog', { name: 'Add your name' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull();
    expect(postMessage).not.toHaveBeenCalled();
  });

  it('dismisses the reply overlay without posting', async () => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, name: null, missing: ['name'] },
    });
    renderWithLocale(
      <MemberProfileScreen profile={{ ...profile, profileMessage: note }} received={[]} />,
    );
    await expandNote();
    fireEvent.change(screen.getByLabelText('Your reply'), { target: { value: 'reply' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(postMessage).not.toHaveBeenCalled();
  });

  it('opens the overlay when a reply returns missing_requirements', async () => {
    vi.mocked(postMessage).mockRejectedValue(new MissingRequirementsError(['name']));
    renderWithLocale(
      <MemberProfileScreen profile={{ ...profile, profileMessage: note }} received={[]} />,
    );
    await expandNote();
    fireEvent.change(screen.getByLabelText('Your reply'), { target: { value: 'reply' } });
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
      <MemberProfileScreen profile={{ ...profile, profileMessage: note }} received={[]} />,
    );
    await expandNote();
    fireEvent.change(screen.getByLabelText('Your reply'), { target: { value: 'reply' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ada' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }));
    await waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith('sess', { text: 'reply', inReplyTo: note.id });
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
      <MemberProfileScreen profile={{ ...profile, profileMessage: note }} received={[]} />,
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
    vi.mocked(postMessage).mockRejectedValueOnce(new MissingRequirementsError(['rules']));
    vi.mocked(postMessage).mockResolvedValueOnce({
      ...note,
      id: '44444444-4444-4444-8444-444444444444',
      text: 'reply',
    });
    renderWithLocale(
      <MemberProfileScreen profile={{ ...profile, profileMessage: note }} received={[]} />,
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
    vi.mocked(postMessage).mockRejectedValue(new MissingRequirementsError(['name']));
    renderWithLocale(
      <MemberProfileScreen profile={{ ...profile, profileMessage: note }} received={[]} />,
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
    expect(screen.getByRole('alert').textContent).toBe('Could not post your message');
  });

  it('shows a replies error when expanding without a session', async () => {
    useAuthStore.setState({ session: null, account });
    renderWithLocale(
      <MemberProfileScreen profile={{ ...profile, profileMessage: note }} received={[]} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Show replies' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(fetchReplies).not.toHaveBeenCalled();
  });

  it('does not request an invoice without a session', () => {
    useAuthStore.setState({ session: null, account });
    renderWithLocale(
      <MemberProfileScreen profile={{ ...profile, profileMessage: note }} received={[]} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Send Bitcoin' }));
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(postMessageInvoice).not.toHaveBeenCalled();
  });

  it('rejects a zero pay amount', () => {
    renderWithLocale(
      <MemberProfileScreen profile={{ ...profile, profileMessage: note }} received={[]} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Send Bitcoin' }));
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(postMessageInvoice).not.toHaveBeenCalled();
  });

  it('does not open a conversation without a session', () => {
    useAuthStore.setState({ session: null, account });
    renderWithLocale(
      <MemberProfileScreen profile={{ ...profile, profileMessage: note }} received={[]} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Send a private message' }));
    expect(openConversation).not.toHaveBeenCalled();
  });

  it('clears the PM busy state when opening a conversation fails', async () => {
    vi.mocked(openConversation).mockRejectedValue(new Error('fail'));
    renderWithLocale(
      <MemberProfileScreen profile={{ ...profile, profileMessage: note }} received={[]} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Send a private message' }));
    await waitFor(() => {
      expect(openConversation).toHaveBeenCalled();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send a private message' }));
    await waitFor(() => {
      expect(openConversation).toHaveBeenCalledTimes(2);
    });
  });

  it('ignores a second PM click while a request is in flight', async () => {
    let resolveThread!: (value: {
      id: string;
      name: string;
      lastText: string;
      lastAt: string;
    }) => void;
    vi.mocked(openConversation).mockReturnValue(
      new Promise((resolve) => {
        resolveThread = resolve;
      }),
    );
    renderWithLocale(
      <MemberProfileScreen profile={{ ...profile, profileMessage: note }} received={[]} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Send a private message' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send a private message' }));
    expect(openConversation).toHaveBeenCalledTimes(1);
    resolveThread({
      id: 'conv-1',
      name: 'Carol',
      lastText: '',
      lastAt: '2026-01-01T00:00:00.000Z',
    });
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/messages?c=conv-1');
    });
  });

  it('ignores a second pay submit while an invoice is in flight', async () => {
    let resolveInvoice!: (value: { pr: string; amountSats: number }) => void;
    vi.mocked(postMessageInvoice).mockReturnValue(
      new Promise((resolve) => {
        resolveInvoice = resolve;
      }),
    );
    renderWithLocale(
      <MemberProfileScreen profile={{ ...profile, profileMessage: note }} received={[]} />,
    );
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

  it('shows unnamed and no-address copy when fields are null', () => {
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, name: null, lightningAddress: null, role: 'basis' }}
        received={[]}
      />,
    );
    expect(screen.getByText('Unnamed')).toBeTruthy();
    expect(screen.getByText('No Wallet of Satoshi address')).toBeTruthy();
  });

  it('treats a blank Lightning Address as missing', () => {
    renderWithLocale(
      <MemberProfileScreen profile={{ ...profile, lightningAddress: '   ' }} received={[]} />,
    );
    expect(screen.getByText('No Wallet of Satoshi address')).toBeTruthy();
  });

  it('posts a reply when the account snapshot is missing', async () => {
    useAuthStore.setState({ session: 'sess', account: null });
    renderWithLocale(
      <MemberProfileScreen profile={{ ...profile, profileMessage: note }} received={[]} />,
    );
    await expandNote();
    fireEvent.change(screen.getByLabelText('Your reply'), { target: { value: 'reply' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    await waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith('sess', { text: 'reply', inReplyTo: note.id });
    });
  });
});
