import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PublicMessageThread } from '@/components/PublicMessageThread';
import {
  deleteMessage,
  fetchGiftStats,
  fetchMessagePhoto,
  fetchPublicMessage,
  fetchReplies,
  openConversation,
  postMessage,
  postMessageInvoice,
} from '@/lib/api';
import { FORUM_MESSAGE_MAX_LENGTH, type Account, type ForumMessage } from '@/lib/api-types';
import { MissingRequirementsError } from '@/lib/missing-requirements';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const MESSAGE_ID = '11111111-1111-4111-8111-111111111111';
const REPLY_ID = '22222222-2222-4222-8222-222222222222';

const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: (): { push: typeof push; replace: typeof push } => ({
    push,
    replace: push,
  }),
}));

vi.mock('@/lib/api', () => ({
  postMessage: vi.fn(),
  postMessageInvoice: vi.fn(),
  fetchPublicMessage: vi.fn(),
  fetchMessagePhoto: vi.fn(),
  fetchReplies: vi.fn(),
  openConversation: vi.fn(),
  fetchGiftStats: vi.fn().mockResolvedValue({ spendOverTime: [] }),
  deleteMessage: vi.fn(),
  setLightningAddress: vi.fn(),
  setName: vi.fn(),
  agreeToRules: vi.fn(),
}));

const account: Account = {
  id: 'acc_ada',
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

const root: ForumMessage = {
  id: MESSAGE_ID,
  accountId: 'acc_carol',
  name: 'Carol',
  text: 'Hello from Carol',
  createdAt: '2026-08-28T12:00:00.000Z',
  sats: 21,
  payable: true,
  hasPhoto: false,
  hasVideo: false,
  videoContentType: null,
  role: 'basis',
  replyCount: 0,
};

const giftReply: ForumMessage = {
  ...root,
  id: REPLY_ID,
  parentId: MESSAGE_ID,
  name: 'Pater Severin',
  accountId: 'acc_pater',
  text: '',
  sats: 3000,
  payable: false,
  replyCount: 0,
};

function signIn(next: Partial<Account> = {}): void {
  useAuthStore.setState({ session: 'sess', account: { ...account, ...next } });
}

function payAmountInput(): HTMLElement {
  const fields = screen.getAllByLabelText('Amount');
  const pay = fields.find((el) => el.id !== 'forum-reply-amount');
  if (pay === undefined) {
    throw new Error('pay amount field missing');
  }
  return pay;
}

function replyAmountInput(): HTMLElement {
  const field = document.getElementById('forum-reply-amount');
  if (field === null) {
    throw new Error('reply amount field missing');
  }
  return field;
}

function renderThread(
  props: Partial<{ root: ForumMessage; highlightId: string | null; onRootDeleted: () => void }> = {},
): ReturnType<typeof renderWithLocale> {
  return renderWithLocale(
    <PublicMessageThread
      root={props.root ?? root}
      highlightId={props.highlightId ?? null}
      onRootDeleted={props.onRootDeleted ?? vi.fn()}
    />,
  );
}

beforeEach(() => {
  useAuthStore.setState({ session: null, account: null });
  push.mockReset();
  vi.mocked(fetchReplies).mockResolvedValue([]);
  vi.mocked(fetchGiftStats).mockResolvedValue({ spendOverTime: [] } as never);
  vi.mocked(postMessageInvoice).mockResolvedValue({ pr: 'lnbc1', amountSats: 21 });
  vi.mocked(postMessage).mockResolvedValue({
    ...root,
    id: '99999999-9999-4999-8999-999999999999',
    name: 'Ada',
    accountId: account.id,
    text: 'reply',
    sats: 0,
    payable: false,
    parentId: MESSAGE_ID,
  });
  vi.mocked(deleteMessage).mockResolvedValue(undefined);
  vi.mocked(openConversation).mockResolvedValue({
    id: 'conv-1',
    kind: 'member_member',
    name: 'Carol',
    lastText: '',
    lastAt: '2026-01-01T00:00:00.000Z',
    lastFromMe: false,
  });
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: () => 'blob:thread',
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    writable: true,
    value: () => undefined,
  });
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:thread');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('PublicMessageThread', () => {
  it('auto-expands the root and loads Bearer replies', async () => {
    signIn();
    renderThread();
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Write a reply')).toBeTruthy();
    });
    expect(fetchReplies).toHaveBeenCalledWith('sess', MESSAGE_ID);
    expect(screen.getByRole('button', { name: 'Send Bitcoin' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy link to this note' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Send a private message' })).toBeTruthy();
  });

  it('invoices 21 sats when the pay amount is left empty', async () => {
    signIn();
    renderThread();
    await screen.findByPlaceholderText('Write a reply');
    fireEvent.click(screen.getByRole('button', { name: 'Send Bitcoin' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => {
      expect(postMessageInvoice).toHaveBeenCalledWith('sess', MESSAGE_ID, 21);
    });
  });

  it('requests a pay invoice for a typed amount', async () => {
    signIn();
    renderThread();
    await screen.findByPlaceholderText('Write a reply');
    fireEvent.click(screen.getByRole('button', { name: 'Send Bitcoin' }));
    fireEvent.change(payAmountInput(), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => {
      expect(postMessageInvoice).toHaveBeenCalledWith('sess', MESSAGE_ID, 21);
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Pay with Wallet of Satoshi' })).toBeTruthy();
    });
  });

  it('rejects a non-numeric pay amount', async () => {
    signIn();
    renderThread();
    await screen.findByPlaceholderText('Write a reply');
    fireEvent.click(screen.getByRole('button', { name: 'Send Bitcoin' }));
    fireEvent.change(payAmountInput(), { target: { value: 'nope' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(postMessageInvoice).not.toHaveBeenCalled();
    expect(screen.getByText('Enter a whole number greater than zero')).toBeTruthy();
  });

  it('rejects a zero pay amount', async () => {
    signIn();
    renderThread();
    await screen.findByPlaceholderText('Write a reply');
    fireEvent.click(screen.getByRole('button', { name: 'Send Bitcoin' }));
    fireEvent.change(payAmountInput(), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(postMessageInvoice).not.toHaveBeenCalled();
    expect(screen.getByText('Enter a whole number greater than zero')).toBeTruthy();
  });

  it('shows a pay error when the invoice request fails', async () => {
    vi.mocked(postMessageInvoice).mockRejectedValue(new Error('nope'));
    signIn();
    renderThread();
    await screen.findByPlaceholderText('Write a reply');
    fireEvent.click(screen.getByRole('button', { name: 'Send Bitcoin' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
    });
  });

  it('cancels an open pay sheet', async () => {
    signIn();
    renderThread();
    await screen.findByPlaceholderText('Write a reply');
    fireEvent.click(screen.getByRole('button', { name: 'Send Bitcoin' }));
    expect(payAmountInput()).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getAllByLabelText('Amount')).toHaveLength(1);
    expect(replyAmountInput().id).toBe('forum-reply-amount');
  });

  it('opens the overlay when pay is missing a Lightning Address', async () => {
    signIn({ lightningAddress: null, missing: ['lightning-address'] });
    renderThread();
    await screen.findByPlaceholderText('Write a reply');
    fireEvent.click(screen.getByRole('button', { name: 'Send Bitcoin' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(
      await screen.findByRole('dialog', { name: 'Add your Wallet of Satoshi address' }),
    ).toBeTruthy();
    expect(postMessageInvoice).not.toHaveBeenCalled();
  });

  it('polls the parent after paying from the gift button', async () => {
    vi.mocked(fetchPublicMessage).mockResolvedValue({ ...root, sats: 42 });
    vi.mocked(postMessageInvoice).mockResolvedValue({ pr: 'lnbc1', amountSats: 21 });
    signIn();
    renderThread();
    await screen.findByPlaceholderText('Write a reply');
    fireEvent.click(screen.getByRole('button', { name: 'Send Bitcoin' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => {
      expect(fetchPublicMessage).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Pay with Wallet of Satoshi' })).toBeNull();
    });
  });

  it('lets a verified member reply without paying', async () => {
    signIn({ role: 'verified' });
    renderThread();
    await screen.findByPlaceholderText('Write a reply');
    fireEvent.change(screen.getByLabelText('Your reply'), { target: { value: 'reply' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    await waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith('sess', { text: 'reply', inReplyTo: MESSAGE_ID });
    });
    expect(postMessageInvoice).not.toHaveBeenCalled();
  });

  it('lets a founder reply without paying', async () => {
    signIn({ role: 'founder' });
    renderThread();
    await screen.findByPlaceholderText('Write a reply');
    fireEvent.change(screen.getByLabelText('Your reply'), { target: { value: 'reply' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    await waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith('sess', { text: 'reply', inReplyTo: MESSAGE_ID });
    });
    expect(postMessageInvoice).not.toHaveBeenCalled();
  });

  it('invoices 1 sat when a non-exempt member replies with text and an empty amount', async () => {
    signIn();
    renderThread();
    await screen.findByPlaceholderText('Write a reply');
    fireEvent.change(screen.getByLabelText('Your reply'), { target: { value: 'thanks' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    await waitFor(() => {
      expect(postMessageInvoice).toHaveBeenCalledWith('sess', MESSAGE_ID, 1, 'thanks');
    });
  });

  it('invoices a gift-only reply when text and amount are empty', async () => {
    signIn({ role: 'founder' });
    renderThread();
    await screen.findByPlaceholderText('Write a reply');
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    await waitFor(() => {
      expect(postMessageInvoice).toHaveBeenCalledWith('sess', MESSAGE_ID, 21);
    });
  });

  it('sends 1 sat when the reply amount is 0', async () => {
    signIn();
    renderThread();
    await screen.findByPlaceholderText('Write a reply');
    fireEvent.change(screen.getByLabelText('Your reply'), { target: { value: 'thanks' } });
    fireEvent.change(replyAmountInput(), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    await waitFor(() => {
      expect(postMessageInvoice).toHaveBeenCalledWith('sess', MESSAGE_ID, 1, 'thanks');
    });
  });

  it('rejects a non-numeric reply amount', async () => {
    signIn();
    renderThread();
    await screen.findByPlaceholderText('Write a reply');
    fireEvent.change(screen.getByLabelText('Your reply'), { target: { value: 'thanks' } });
    fireEvent.change(replyAmountInput(), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    expect(postMessageInvoice).not.toHaveBeenCalled();
    expect(postMessage).not.toHaveBeenCalled();
  });

  it('does not post a reply longer than the forum limit', async () => {
    signIn({ role: 'founder' });
    renderThread();
    await screen.findByPlaceholderText('Write a reply');
    fireEvent.change(screen.getByLabelText('Your reply'), {
      target: { value: 'x'.repeat(FORUM_MESSAGE_MAX_LENGTH + 1) },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    expect(postMessage).not.toHaveBeenCalled();
  });

  it('opens the overlay when a reply is missing a Lightning Address', async () => {
    signIn({ lightningAddress: null, missing: ['lightning-address'] });
    renderThread();
    await screen.findByPlaceholderText('Write a reply');
    fireEvent.change(screen.getByLabelText('Your reply'), { target: { value: 'thanks' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    expect(
      await screen.findByRole('dialog', { name: 'Add your Wallet of Satoshi address' }),
    ).toBeTruthy();
  });

  it('maps a staff reply rate-limit onto the reply error', async () => {
    signIn({ role: 'founder' });
    vi.mocked(postMessage).mockRejectedValue(new Error('Too many messages'));
    renderThread();
    await screen.findByPlaceholderText('Write a reply');
    fireEvent.change(screen.getByLabelText('Your reply'), { target: { value: 'reply' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/too many/i);
    });
  });

  it('starts a 1-sat invoice when an unpaid reply is 403', async () => {
    signIn({ role: 'founder' });
    vi.mocked(postMessage).mockRejectedValue(new Error('A reply needs a Bitcoin payment'));
    vi.mocked(postMessageInvoice).mockResolvedValue({ pr: 'lnbc1', amountSats: 1 });
    renderThread();
    await screen.findByPlaceholderText('Write a reply');
    fireEvent.change(screen.getByLabelText('Your reply'), { target: { value: 'reply' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    await waitFor(() => {
      expect(postMessageInvoice).toHaveBeenCalledWith('sess', MESSAGE_ID, 1, 'reply');
    });
  });

  it('opens the overlay when an unpaid staff reply returns missing_requirements', async () => {
    signIn({ role: 'founder' });
    vi.mocked(postMessage).mockRejectedValue(new MissingRequirementsError(['name']));
    renderThread();
    await screen.findByPlaceholderText('Write a reply');
    fireEvent.change(screen.getByLabelText('Your reply'), { target: { value: 'reply' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    expect(await screen.findByRole('dialog', { name: 'Add your name' })).toBeTruthy();
  });

  it('shows a request error when a reply fails', async () => {
    signIn({ role: 'founder' });
    vi.mocked(postMessage).mockRejectedValue(new Error('offline'));
    renderThread();
    await screen.findByPlaceholderText('Write a reply');
    fireEvent.change(screen.getByLabelText('Your reply'), { target: { value: 'reply' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
    });
  });

  it('opens a private thread with the note author', async () => {
    signIn();
    renderThread();
    await screen.findByPlaceholderText('Write a reply');
    fireEvent.click(screen.getByRole('button', { name: 'Send a private message' }));
    await waitFor(() => {
      expect(openConversation).toHaveBeenCalledWith('sess', MESSAGE_ID);
    });
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/messages?c=conv-1');
    });
  });

  it('rings the highlighted reply after Bearer replies load', async () => {
    vi.mocked(fetchReplies).mockResolvedValue([giftReply]);
    signIn();
    renderThread({ highlightId: REPLY_ID });
    await waitFor(() => {
      expect(document.querySelector('[data-permalink-target="true"]')).toBeTruthy();
    });
    const target = document.querySelector('[data-permalink-target="true"]');
    expect(target?.getAttribute('data-reply-id')).toBe(REPLY_ID);
  });

  it('calls onRootDeleted after a staff delete of the root', async () => {
    const onRootDeleted = vi.fn();
    signIn({ role: 'moderator' });
    renderThread({ onRootDeleted });
    await screen.findByPlaceholderText('Write a reply');
    fireEvent.click(screen.getByRole('button', { name: 'Delete post' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm deletion' }));
    await waitFor(() => {
      expect(deleteMessage).toHaveBeenCalledWith('sess', MESSAGE_ID);
    });
    expect(onRootDeleted).toHaveBeenCalled();
  });

  it('drops a nested reply after a staff delete', async () => {
    vi.mocked(fetchReplies).mockResolvedValue([giftReply]);
    signIn({ role: 'moderator' });
    renderThread();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Delete reply' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Delete reply' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm deletion' }));
    await waitFor(() => {
      expect(deleteMessage).toHaveBeenCalledWith('sess', REPLY_ID);
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Delete reply' })).toBeNull();
    });
  });

  it('collapses and re-expands the thread', async () => {
    signIn();
    renderThread();
    await screen.findByPlaceholderText('Write a reply');
    fireEvent.click(screen.getByRole('button', { name: 'Hide replies' }));
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Write a reply')).toBeNull();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show replies' }));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Write a reply')).toBeTruthy();
    });
    expect(fetchReplies).toHaveBeenCalledTimes(2);
  });

  it('shows a replies error and retries', async () => {
    vi.mocked(fetchReplies).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([]);
    signIn();
    renderThread();
    await waitFor(() => {
      expect(screen.getByText('Could not load replies. Please try again.')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Write a reply')).toBeTruthy();
    });
  });

  it('loads a photo blob URL when the root has a photo', async () => {
    vi.mocked(fetchMessagePhoto).mockResolvedValue(new Blob(['x'], { type: 'image/jpeg' }));
    signIn();
    renderThread({ root: { ...root, hasPhoto: true } });
    await waitFor(() => {
      expect(fetchMessagePhoto).toHaveBeenCalledWith('sess', MESSAGE_ID);
    });
    await waitFor(() => {
      expect(screen.getByAltText('Photo from Carol')).toBeTruthy();
    });
  });

  it('leaves the row text-only when the photo cannot load', async () => {
    vi.mocked(fetchMessagePhoto).mockRejectedValue(new Error('offline'));
    signIn();
    renderThread({ root: { ...root, hasPhoto: true } });
    await waitFor(() => {
      expect(fetchMessagePhoto).toHaveBeenCalled();
    });
    expect(screen.queryByAltText('Photo from Carol')).toBeNull();
    expect(screen.getByText('Hello from Carol')).toBeTruthy();
  });

  it('shows a replies error when session is missing on mount', async () => {
    useAuthStore.setState({ session: null, account });
    renderThread();
    await waitFor(() => {
      expect(screen.getByText('Could not load replies. Please try again.')).toBeTruthy();
    });
  });

  it('maps an over-long invoice comment onto the reply length error', async () => {
    signIn();
    vi.mocked(postMessageInvoice).mockRejectedValue(new Error('Text must be 1–500 characters'));
    renderThread();
    await screen.findByPlaceholderText('Write a reply');
    fireEvent.change(screen.getByLabelText('Your reply'), { target: { value: 'thanks' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
    });
  });

  it('does not post a second reply while posting', async () => {
    signIn({ role: 'founder' });
    let resolvePost!: (value: ForumMessage) => void;
    vi.mocked(postMessage).mockReturnValue(
      new Promise((resolve) => {
        resolvePost = resolve;
      }),
    );
    renderThread();
    await screen.findByPlaceholderText('Write a reply');
    fireEvent.change(screen.getByLabelText('Your reply'), { target: { value: 'reply' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    expect(postMessage).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolvePost({
        ...root,
        id: '99999999-9999-4999-8999-999999999999',
        name: 'Ada',
        text: 'reply',
        parentId: MESSAGE_ID,
        sats: 0,
        payable: false,
      });
    });
  });
});
