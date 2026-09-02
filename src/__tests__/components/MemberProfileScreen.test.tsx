import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemberProfileScreen } from '@/components/MemberProfileScreen';
import { fetchReplies, openConversation, postMessage, postMessageInvoice } from '@/lib/api';
import type { MemberProfile } from '@/lib/api-types';
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
  fetchReplies: vi.fn(),
  openConversation: vi.fn(),
  postMessage: vi.fn(),
  postMessageInvoice: vi.fn(),
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

beforeEach(() => {
  push.mockClear();
  vi.clearAllMocks();
  vi.mocked(fetchReplies).mockResolvedValue([]);
  vi.mocked(openConversation).mockResolvedValue({
    id: 'conv-1',
    name: 'Carol',
    lastText: '',
    lastAt: '2026-01-01T00:00:00.000Z',
  });
  vi.mocked(postMessageInvoice).mockResolvedValue({ pr: 'lnbc1', amountSats: 21 });
  useAuthStore.setState({
    session: 'sess',
    account: {
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
    },
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
        id: profile.id,
        linkingKey: null,
        role: 'verified',
        name: 'Carol',
        lightningAddress: 'carol@walletofsatoshi.com',
        lightningAddressVerified: false,
        forumLawsDismissed: true,
        createdAt: 1,
        rulesAgreedAt: 1,
        viewKey: 'a'.repeat(64),
        setup: null,
        missing: [],
      },
    });
    renderWithLocale(
      <MemberProfileScreen profile={{ ...profile, profileMessage: note }} received={[]} />,
    );
    expect(screen.queryByRole('button', { name: 'Send a private message' })).toBeNull();
  });

  it('opens a conversation from the profile note', async () => {
    vi.mocked(openConversation).mockResolvedValue({
      id: 'conv-1',
      name: 'Carol',
      lastText: '',
      lastAt: '2026-01-01T00:00:00.000Z',
    });
    renderWithLocale(
      <MemberProfileScreen profile={{ ...profile, profileMessage: note }} received={[]} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Send a private message' }));
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/messages?c=conv-1');
    });
  });

  it('requests a pay invoice from the profile note', async () => {
    vi.mocked(postMessageInvoice).mockResolvedValue({ pr: 'lnbc1', amountSats: 21 });
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
    vi.mocked(fetchReplies).mockResolvedValue([]);
    renderWithLocale(
      <MemberProfileScreen profile={{ ...profile, profileMessage: note }} received={[]} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Show replies' }));
    await waitFor(() => {
      expect(fetchReplies).toHaveBeenCalledWith('sess', note.id);
    });
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

  it('collapses an expanded profile note', async () => {
    vi.mocked(fetchReplies).mockResolvedValue([]);
    renderWithLocale(
      <MemberProfileScreen profile={{ ...profile, profileMessage: note }} received={[]} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Show replies' }));
    await waitFor(() => {
      expect(fetchReplies).toHaveBeenCalled();
    });
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
    vi.mocked(fetchReplies).mockResolvedValue([]);
    vi.mocked(postMessage).mockResolvedValue({
      ...note,
      id: '44444444-4444-4444-8444-444444444444',
      text: 'reply',
    });
    renderWithLocale(
      <MemberProfileScreen profile={{ ...profile, profileMessage: note }} received={[]} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Show replies' }));
    await waitFor(() => {
      expect(fetchReplies).toHaveBeenCalled();
    });
    fireEvent.change(screen.getByLabelText('Your reply'), { target: { value: 'reply' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    await waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith('sess', { text: 'reply', inReplyTo: note.id });
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
});
