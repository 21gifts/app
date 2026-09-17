import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PublicMessageThread } from '@/components/PublicMessageThread';
import {
  agreeToRules,
  deleteMessage,
  fetchGiftStats,
  fetchMessagePhoto,
  fetchPublicMessage,
  fetchReplies,
  postMessage,
  postMessageInvoice,
  setLightningAddress,
  setName,
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
  aboutMeHasPhoto: false,
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
  photoCount: 0,
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

const payableNested: ForumMessage = {
  ...giftReply,
  payable: true,
  sats: 0,
  text: 'A payable reply',
};

function submitComposer(amount?: string): void {
  const form = screen.getByLabelText('Your reaction').closest('form');
  if (form === null) {
    throw new Error('reply form missing');
  }
  if (amount !== undefined) {
    fireEvent.change(replyAmountInput(), { target: { value: amount } });
  }
  fireEvent.submit(form);
}

async function openNestedPaySheet(): Promise<HTMLElement> {
  const card = (await waitFor(() => {
    const el = document.querySelector(`[data-reply-id="${REPLY_ID}"]`);
    expect(el).not.toBeNull();
    return el as HTMLElement;
  })) as HTMLElement;
  fireEvent.click(within(card).getByRole('button', { name: 'Send Bitcoin' }));
  return card;
}

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
  props: Partial<{
    root: ForumMessage;
    highlightId: string | null;
    onRootDeleted: () => void;
  }> = {},
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
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('PublicMessageThread', () => {
  it('auto-expands the root and loads Bearer replies', async () => {
    signIn();
    renderThread();
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Write a reaction')).toBeTruthy();
    });
    expect(fetchReplies).toHaveBeenCalledWith('sess', MESSAGE_ID);
    expect(screen.queryByRole('button', { name: 'Send Bitcoin' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Copy link to this note' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Send a private message' })).toBeNull();
  });

  it('keeps a long original body full on the signed-in permalink', async () => {
    const text = `${'a'.repeat(280)} TAILWORD`;
    signIn();
    renderThread({ root: { ...root, text } });
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Write a reaction')).toBeTruthy();
    });
    expect(screen.getByText(/TAILWORD/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
  });

  it('invoices 21 sats when the pay amount is left empty', async () => {
    signIn();
    renderThread();
    await screen.findByPlaceholderText('Write a reaction');
    submitComposer();
    await waitFor(() => {
      expect(postMessageInvoice).toHaveBeenCalledWith('sess', MESSAGE_ID, 21);
    });
  });

  it('requests a pay invoice for a typed amount', async () => {
    signIn();
    renderThread();
    await screen.findByPlaceholderText('Write a reaction');
    submitComposer('21');
    await waitFor(() => {
      expect(postMessageInvoice).toHaveBeenCalledWith('sess', MESSAGE_ID, 21);
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Pay with Wallet of Satoshi' })).toBeTruthy();
    });
  });

  it('rejects a non-numeric pay amount', async () => {
    vi.mocked(fetchReplies).mockResolvedValue([payableNested]);
    signIn();
    renderThread();
    await screen.findByPlaceholderText('Write a reaction');
    await openNestedPaySheet();
    fireEvent.change(payAmountInput(), { target: { value: 'nope' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(postMessageInvoice).not.toHaveBeenCalled();
    expect(screen.getByText('Enter a whole number greater than zero')).toBeTruthy();
  });

  it('rejects a zero pay amount', async () => {
    vi.mocked(fetchReplies).mockResolvedValue([payableNested]);
    signIn();
    renderThread();
    await screen.findByPlaceholderText('Write a reaction');
    await openNestedPaySheet();
    fireEvent.change(payAmountInput(), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(postMessageInvoice).not.toHaveBeenCalled();
    expect(screen.getByText('Enter a whole number greater than zero')).toBeTruthy();
  });

  it('rejects an overflowing Gift amount', async () => {
    vi.mocked(fetchReplies).mockResolvedValue([payableNested]);
    signIn();
    renderThread();
    await screen.findByPlaceholderText('Write a reaction');
    await openNestedPaySheet();
    fireEvent.change(payAmountInput(), { target: { value: '9007199254740993' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(postMessageInvoice).not.toHaveBeenCalled();
    expect(screen.getByText('Enter a whole number greater than zero')).toBeTruthy();
  });

  it('shows a pay error when the invoice request fails', async () => {
    vi.mocked(postMessageInvoice).mockRejectedValue(new Error('nope'));
    vi.mocked(fetchReplies).mockResolvedValue([payableNested]);
    signIn();
    renderThread();
    await screen.findByPlaceholderText('Write a reaction');
    await openNestedPaySheet();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
    });
  });

  it('maps a pay rate-limit onto the pay error', async () => {
    vi.mocked(postMessageInvoice).mockRejectedValue(new Error('Too many payments'));
    vi.mocked(fetchReplies).mockResolvedValue([payableNested]);
    signIn();
    renderThread();
    await screen.findByPlaceholderText('Write a reaction');
    await openNestedPaySheet();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/too many/i);
    });
  });

  it("maps an author's-wallet pay failure onto the pay error", async () => {
    vi.mocked(postMessageInvoice).mockRejectedValue(
      new Error("The author's wallet cannot receive this Bitcoin payment"),
    );
    vi.mocked(fetchReplies).mockResolvedValue([payableNested]);
    signIn();
    renderThread();
    await screen.findByPlaceholderText('Write a reaction');
    await openNestedPaySheet();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/wallet cannot receive/i);
    });
  });

  it('invoices from Gift on a nested reply', async () => {
    vi.mocked(fetchReplies).mockResolvedValue([payableNested]);
    signIn();
    renderThread();
    await screen.findByPlaceholderText('Write a reaction');
    await openNestedPaySheet();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => {
      expect(postMessageInvoice).toHaveBeenCalledWith('sess', REPLY_ID, 21);
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Pay with Wallet of Satoshi' })).toBeTruthy();
    });
  });

  it('polls the nested reply sats after Gift, not the parent', async () => {
    const otherReply: ForumMessage = {
      ...giftReply,
      id: '33333333-3333-4333-8333-333333333333',
      text: 'Another reply',
      sats: 3,
      payable: false,
    };
    vi.mocked(fetchReplies).mockResolvedValue([payableNested, otherReply]);
    vi.mocked(fetchPublicMessage).mockResolvedValue({ ...payableNested, sats: 21 });
    signIn();
    renderThread();
    await screen.findByPlaceholderText('Write a reaction');
    await openNestedPaySheet();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => {
      expect(fetchPublicMessage).toHaveBeenCalledWith(
        REPLY_ID,
        expect.objectContaining({ sinceSats: 0 }),
      );
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Pay with Wallet of Satoshi' })).toBeNull();
    });
    const replyCard = document.querySelector(`[data-reply-id="${REPLY_ID}"]`) as HTMLElement;
    expect(within(replyCard).getByText('₿21')).toBeTruthy();
    expect(screen.getByText('Hello from Carol')).toBeTruthy();
  });

  it('maps a pay missing-requirements miss onto the pay error', async () => {
    vi.mocked(postMessageInvoice).mockRejectedValue(new MissingRequirementsError([]));
    vi.mocked(fetchReplies).mockResolvedValue([payableNested]);
    signIn();
    renderThread();
    await screen.findByPlaceholderText('Write a reaction');
    await openNestedPaySheet();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
    });
  });

  it('cancels an open pay sheet', async () => {
    vi.mocked(fetchReplies).mockResolvedValue([payableNested]);
    signIn();
    renderThread();
    await screen.findByPlaceholderText('Write a reaction');
    await openNestedPaySheet();
    expect(payAmountInput()).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getAllByLabelText('Amount')).toHaveLength(1);
    expect(replyAmountInput().id).toBe('forum-reply-amount');
  });

  it('opens the overlay when pay is missing a Lightning Address', async () => {
    signIn({ lightningAddress: null, missing: ['lightning-address'] });
    renderThread();
    await screen.findByPlaceholderText('Write a reaction');
    submitComposer();
    expect(
      await screen.findByRole('dialog', { name: 'Add your Wallet of Satoshi address' }),
    ).toBeTruthy();
    expect(postMessageInvoice).not.toHaveBeenCalled();
  });

  it('opens the overlay when Gift Continue is missing a Lightning Address', async () => {
    vi.mocked(fetchReplies).mockResolvedValue([payableNested]);
    signIn({ lightningAddress: null, missing: ['lightning-address'] });
    renderThread();
    await screen.findByPlaceholderText('Write a reaction');
    await openNestedPaySheet();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(
      await screen.findByRole('dialog', { name: 'Add your Wallet of Satoshi address' }),
    ).toBeTruthy();
    expect(postMessageInvoice).not.toHaveBeenCalled();
  });

  it('keeps the board when the account snapshot is cleared', async () => {
    signIn();
    renderThread();
    await screen.findByPlaceholderText('Write a reaction');
    useAuthStore.setState({ session: 'sess', account: null });
    await waitFor(() => {
      expect(screen.getByText('Hello from Carol')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Your reaction'), { target: { value: 'thanks' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    await waitFor(() => {
      expect(postMessageInvoice).toHaveBeenCalledWith('sess', MESSAGE_ID, 1, 'thanks');
    });
  });

  it('marks replies as failed when the post-pay refetch throws', async () => {
    vi.mocked(fetchReplies).mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('offline'));
    vi.mocked(fetchPublicMessage).mockResolvedValue({ ...root, sats: 42 });
    signIn();
    renderThread();
    await screen.findByPlaceholderText('Write a reaction');
    submitComposer();
    await waitFor(() => {
      expect(fetchPublicMessage).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByText('Could not load reactions. Please try again.')).toBeTruthy();
    });
  });

  it('retries the pay poll after a failed fetch then closes when sats increase', async () => {
    vi.useFakeTimers();
    vi.mocked(fetchPublicMessage).mockRejectedValueOnce(new Error('poll failed'));
    vi.mocked(fetchPublicMessage).mockResolvedValueOnce({ ...root, sats: 42 });
    signIn();
    renderThread();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    submitComposer();
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByRole('button', { name: 'Pay with Wallet of Satoshi' })).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(screen.queryByRole('button', { name: 'Pay with Wallet of Satoshi' })).toBeNull();
  });

  it('keeps the current note when a pay poll returns a different id', async () => {
    vi.mocked(fetchPublicMessage).mockResolvedValue({
      ...root,
      id: 'other-id',
      sats: 42,
      text: 'someone else',
    });
    signIn();
    renderThread();
    await screen.findByPlaceholderText('Write a reaction');
    submitComposer();
    await waitFor(() => {
      expect(fetchPublicMessage).toHaveBeenCalled();
    });
    expect(screen.getByText('Hello from Carol')).toBeTruthy();
    expect(screen.queryByText('someone else')).toBeNull();
  });

  it('keeps the higher replyCount when a pay poll returns a smaller count', async () => {
    vi.mocked(fetchPublicMessage).mockResolvedValue({ ...root, sats: 42, replyCount: 0 });
    signIn();
    renderThread({ root: { ...root, replyCount: 5 } });
    await screen.findByPlaceholderText('Write a reaction');
    submitComposer();
    await waitFor(() => {
      expect(fetchPublicMessage).toHaveBeenCalled();
    });
  });

  it('polls the parent after a composer invoice', async () => {
    vi.mocked(fetchPublicMessage).mockResolvedValue({ ...root, sats: 42 });
    vi.mocked(postMessageInvoice).mockResolvedValue({ pr: 'lnbc1', amountSats: 21 });
    signIn();
    renderThread();
    await screen.findByPlaceholderText('Write a reaction');
    submitComposer();
    await waitFor(() => {
      expect(fetchPublicMessage).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Pay with Wallet of Satoshi' })).toBeNull();
    });
  });

  it('invoices 1 sat when an unpaid reply is rejected', async () => {
    vi.mocked(postMessage).mockRejectedValue(new Error('A reply needs a Bitcoin payment'));
    signIn({ id: 'acc_carol' });
    renderThread();
    await screen.findByPlaceholderText('Write a reaction');
    fireEvent.change(screen.getByLabelText('Your reaction'), { target: { value: 'thanks' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    await waitFor(() => {
      expect(postMessageInvoice).toHaveBeenCalledWith('sess', MESSAGE_ID, 1, 'thanks');
    });
  });

  it('lets a verified member reply without paying', async () => {
    signIn({ role: 'verified' });
    renderThread();
    await screen.findByPlaceholderText('Write a reaction');
    fireEvent.change(screen.getByLabelText('Your reaction'), { target: { value: 'reply' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    await waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith('sess', { text: 'reply', inReplyTo: MESSAGE_ID });
    });
    expect(postMessageInvoice).not.toHaveBeenCalled();
  });

  it('lets a founder reply without paying', async () => {
    signIn({ role: 'founder' });
    renderThread();
    await screen.findByPlaceholderText('Write a reaction');
    fireEvent.change(screen.getByLabelText('Your reaction'), { target: { value: 'reply' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    await waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith('sess', { text: 'reply', inReplyTo: MESSAGE_ID });
    });
    expect(postMessageInvoice).not.toHaveBeenCalled();
  });

  it('invoices 1 sat when a non-exempt member replies with text and an empty amount', async () => {
    signIn();
    renderThread();
    await screen.findByPlaceholderText('Write a reaction');
    fireEvent.change(screen.getByLabelText('Your reaction'), { target: { value: 'thanks' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    await waitFor(() => {
      expect(postMessageInvoice).toHaveBeenCalledWith('sess', MESSAGE_ID, 1, 'thanks');
    });
  });

  it('tries an unpaid reply when the public note omits accountId', async () => {
    signIn();
    renderThread({ root: { ...root, accountId: undefined } });
    await screen.findByPlaceholderText('Write a reaction');
    fireEvent.change(screen.getByLabelText('Your reaction'), { target: { value: 'thanks' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    await waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith('sess', { text: 'thanks', inReplyTo: MESSAGE_ID });
    });
    expect(postMessageInvoice).not.toHaveBeenCalled();
  });

  it('invoices 1 sat when an unpaid reply on a note without accountId is 403', async () => {
    signIn();
    vi.mocked(postMessage).mockRejectedValue(new Error('A reply needs a Bitcoin payment'));
    vi.mocked(postMessageInvoice).mockResolvedValue({ pr: 'lnbc1', amountSats: 1 });
    renderThread({ root: { ...root, accountId: undefined } });
    await screen.findByPlaceholderText('Write a reaction');
    fireEvent.change(screen.getByLabelText('Your reaction'), { target: { value: 'thanks' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    await waitFor(() => {
      expect(postMessageInvoice).toHaveBeenCalledWith('sess', MESSAGE_ID, 1, 'thanks');
    });
  });

  it('invoices a gift-only reply when text and amount are empty', async () => {
    signIn({ role: 'founder' });
    renderThread();
    await screen.findByPlaceholderText('Write a reaction');
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    await waitFor(() => {
      expect(postMessageInvoice).toHaveBeenCalledWith('sess', MESSAGE_ID, 21);
    });
  });

  it('invoices the typed reply amount', async () => {
    signIn();
    renderThread();
    await screen.findByPlaceholderText('Write a reaction');
    fireEvent.change(screen.getByLabelText('Your reaction'), { target: { value: 'thanks' } });
    fireEvent.change(replyAmountInput(), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    await waitFor(() => {
      expect(postMessageInvoice).toHaveBeenCalledWith('sess', MESSAGE_ID, 5, 'thanks');
    });
  });

  it('sends 1 sat when the reply amount is 0', async () => {
    signIn();
    renderThread();
    await screen.findByPlaceholderText('Write a reaction');
    fireEvent.change(screen.getByLabelText('Your reaction'), { target: { value: 'thanks' } });
    fireEvent.change(replyAmountInput(), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    await waitFor(() => {
      expect(postMessageInvoice).toHaveBeenCalledWith('sess', MESSAGE_ID, 1, 'thanks');
    });
  });

  it('rejects an overflowing reply amount', async () => {
    signIn();
    renderThread();
    await screen.findByPlaceholderText('Write a reaction');
    fireEvent.change(screen.getByLabelText('Your reaction'), { target: { value: 'thanks' } });
    fireEvent.change(replyAmountInput(), { target: { value: '999999999999999999999' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    expect(postMessageInvoice).not.toHaveBeenCalled();
    expect(postMessage).not.toHaveBeenCalled();
  });

  it('keeps ₿-only when gift stats fail', async () => {
    vi.mocked(fetchGiftStats).mockRejectedValue(new Error('offline'));
    signIn();
    renderThread();
    await screen.findByPlaceholderText('Write a reaction');
    expect(screen.getByText('₿21')).toBeTruthy();
  });

  it('rejects a non-numeric reply amount', async () => {
    signIn();
    renderThread();
    await screen.findByPlaceholderText('Write a reaction');
    fireEvent.change(screen.getByLabelText('Your reaction'), { target: { value: 'thanks' } });
    fireEvent.change(replyAmountInput(), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    expect(postMessageInvoice).not.toHaveBeenCalled();
    expect(postMessage).not.toHaveBeenCalled();
  });

  it('does not post a reply longer than the forum limit', async () => {
    signIn({ role: 'founder' });
    renderThread();
    await screen.findByPlaceholderText('Write a reaction');
    fireEvent.change(screen.getByLabelText('Your reaction'), {
      target: { value: 'x'.repeat(FORUM_MESSAGE_MAX_LENGTH + 1) },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    expect(postMessage).not.toHaveBeenCalled();
  });

  it('opens the overlay when a reply is missing a Lightning Address', async () => {
    signIn({ lightningAddress: null, missing: ['lightning-address'] });
    renderThread();
    await screen.findByPlaceholderText('Write a reaction');
    fireEvent.change(screen.getByLabelText('Your reaction'), { target: { value: 'thanks' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    expect(
      await screen.findByRole('dialog', { name: 'Add your Wallet of Satoshi address' }),
    ).toBeTruthy();
  });

  it('maps a staff reply rate-limit onto the reply error', async () => {
    signIn({ role: 'founder' });
    vi.mocked(postMessage).mockRejectedValue(new Error('Too many messages'));
    renderThread();
    await screen.findByPlaceholderText('Write a reaction');
    fireEvent.change(screen.getByLabelText('Your reaction'), { target: { value: 'reply' } });
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
    await screen.findByPlaceholderText('Write a reaction');
    fireEvent.change(screen.getByLabelText('Your reaction'), { target: { value: 'reply' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    await waitFor(() => {
      expect(postMessageInvoice).toHaveBeenCalledWith('sess', MESSAGE_ID, 1, 'reply');
    });
  });

  it('advances from rules to name when the overlay still has a gap', async () => {
    signIn({
      role: 'founder',
      name: null,
      rulesAgreedAt: null,
      missing: ['rules', 'name'],
    });
    vi.mocked(agreeToRules).mockResolvedValue({
      ...account,
      role: 'founder',
      name: null,
      rulesAgreedAt: 2,
      missing: ['name'],
      setup: 'name',
    });
    renderThread();
    await screen.findByPlaceholderText('Write a reaction');
    fireEvent.change(screen.getByLabelText('Your reaction'), { target: { value: 'reply' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    expect(screen.getByRole('dialog', { name: /rules/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'I agree to these rules' }));
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Add your name' })).toBeTruthy();
    });
    expect(postMessage).not.toHaveBeenCalled();
  });

  it('retries an unpaid staff reply after a missing_requirements overlay is satisfied', async () => {
    signIn({ role: 'founder' });
    vi.mocked(agreeToRules).mockResolvedValue({
      ...account,
      role: 'founder',
      rulesAgreedAt: 2,
      missing: [],
      setup: null,
    });
    vi.mocked(postMessage).mockRejectedValueOnce(new MissingRequirementsError(['rules']));
    vi.mocked(postMessage).mockResolvedValueOnce({
      ...root,
      id: '44444444-4444-4444-8444-444444444444',
      name: 'Ada',
      text: 'reply',
      parentId: MESSAGE_ID,
      sats: 0,
      payable: false,
    });
    renderThread();
    await screen.findByPlaceholderText('Write a reaction');
    fireEvent.change(screen.getByLabelText('Your reaction'), { target: { value: 'reply' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    expect(
      await screen.findByRole('dialog', { name: 'Agree to the living room rules' }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'I agree to these rules' }));
    await waitFor(() => {
      expect(postMessage).toHaveBeenCalledTimes(2);
    });
  });

  it('retries an unpaid reply after the lightning-address overlay is satisfied', async () => {
    signIn({ role: 'founder', lightningAddress: null, missing: ['lightning-address'] });
    vi.mocked(setLightningAddress).mockResolvedValue({
      ...account,
      role: 'founder',
      lightningAddress: 'alice@walletofsatoshi.com',
      missing: [],
      setup: null,
    });
    renderThread();
    await screen.findByPlaceholderText('Write a reaction');
    fireEvent.change(screen.getByLabelText('Your reaction'), { target: { value: 'reply' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    expect(
      await screen.findByRole('dialog', { name: 'Add your Wallet of Satoshi address' }),
    ).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Wallet of Satoshi address'), {
      target: { value: 'alice@walletofsatoshi.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Link address' }));
    await waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith('sess', { text: 'reply', inReplyTo: MESSAGE_ID });
    });
  });

  it('shows a request error when an unpaid overlay retry is still missing requirements', async () => {
    signIn({ role: 'founder' });
    vi.mocked(agreeToRules).mockResolvedValue({
      ...account,
      role: 'founder',
      rulesAgreedAt: 2,
      missing: [],
      setup: null,
    });
    vi.mocked(postMessage).mockRejectedValue(new MissingRequirementsError(['rules']));
    renderThread();
    await screen.findByPlaceholderText('Write a reaction');
    fireEvent.change(screen.getByLabelText('Your reaction'), { target: { value: 'reply' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    expect(
      await screen.findByRole('dialog', { name: 'Agree to the living room rules' }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'I agree to these rules' }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
    });
  });

  it('retries a paid reply after a missing_requirements overlay is satisfied', async () => {
    vi.mocked(postMessageInvoice)
      .mockRejectedValueOnce(new MissingRequirementsError(['name']))
      .mockResolvedValueOnce({ pr: 'lnbc1', amountSats: 1 });
    vi.mocked(setName).mockResolvedValue({
      ...account,
      name: 'Ada',
      missing: [],
      setup: null,
    });
    signIn({ name: null, missing: [] });
    renderThread();
    await screen.findByPlaceholderText('Write a reaction');
    fireEvent.change(screen.getByLabelText('Your reaction'), { target: { value: 'thanks' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    expect(await screen.findByRole('dialog', { name: 'Add your name' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ada' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }));
    await waitFor(() => {
      expect(postMessageInvoice).toHaveBeenCalledTimes(2);
    });
  });

  it('shows a request error when a paid overlay retry is still missing requirements', async () => {
    vi.mocked(postMessageInvoice).mockRejectedValue(new MissingRequirementsError(['name']));
    vi.mocked(setName).mockResolvedValue({
      ...account,
      name: 'Ada',
      missing: [],
      setup: null,
    });
    signIn({ name: null, missing: [] });
    renderThread();
    await screen.findByPlaceholderText('Write a reaction');
    fireEvent.change(screen.getByLabelText('Your reaction'), { target: { value: 'thanks' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    expect(await screen.findByRole('dialog', { name: 'Add your name' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ada' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
    });
  });

  it('retries pay after the lightning-address overlay is satisfied', async () => {
    vi.mocked(fetchReplies).mockResolvedValue([payableNested]);
    signIn({ lightningAddress: null, missing: ['lightning-address'] });
    vi.mocked(setLightningAddress).mockResolvedValue({
      ...account,
      lightningAddress: 'alice@walletofsatoshi.com',
      missing: [],
      setup: null,
    });
    renderThread();
    await screen.findByPlaceholderText('Write a reaction');
    await openNestedPaySheet();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(
      await screen.findByRole('dialog', { name: 'Add your Wallet of Satoshi address' }),
    ).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Wallet of Satoshi address'), {
      target: { value: 'alice@walletofsatoshi.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Link address' }));
    await waitFor(() => {
      expect(postMessageInvoice).toHaveBeenCalled();
    });
  });

  it('retries pay after a missing_requirements overlay is satisfied', async () => {
    vi.mocked(fetchReplies).mockResolvedValue([payableNested]);
    vi.mocked(postMessageInvoice)
      .mockRejectedValueOnce(new MissingRequirementsError(['rules']))
      .mockResolvedValueOnce({ pr: 'lnbc1', amountSats: 21 });
    vi.mocked(agreeToRules).mockResolvedValue({
      ...account,
      rulesAgreedAt: 2,
      missing: [],
      setup: null,
    });
    signIn();
    renderThread();
    await screen.findByPlaceholderText('Write a reaction');
    await openNestedPaySheet();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(
      await screen.findByRole('dialog', { name: 'Agree to the living room rules' }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'I agree to these rules' }));
    await waitFor(() => {
      expect(postMessageInvoice).toHaveBeenCalledTimes(2);
    });
  });

  it('shows a pay error when an overlay retry is still missing requirements', async () => {
    vi.mocked(fetchReplies).mockResolvedValue([payableNested]);
    vi.mocked(postMessageInvoice).mockRejectedValue(new MissingRequirementsError(['rules']));
    vi.mocked(agreeToRules).mockResolvedValue({
      ...account,
      rulesAgreedAt: 2,
      missing: [],
      setup: null,
    });
    signIn();
    renderThread();
    await screen.findByPlaceholderText('Write a reaction');
    await openNestedPaySheet();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(
      await screen.findByRole('dialog', { name: 'Agree to the living room rules' }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'I agree to these rules' }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
    });
  });

  it('opens the overlay when an unpaid staff reply returns missing_requirements', async () => {
    signIn({ role: 'founder' });
    vi.mocked(postMessage).mockRejectedValue(new MissingRequirementsError(['name']));
    renderThread();
    await screen.findByPlaceholderText('Write a reaction');
    fireEvent.change(screen.getByLabelText('Your reaction'), { target: { value: 'reply' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    expect(await screen.findByRole('dialog', { name: 'Add your name' })).toBeTruthy();
  });

  it('shows a request error when a reply fails', async () => {
    signIn({ role: 'founder' });
    vi.mocked(postMessage).mockRejectedValue(new Error('offline'));
    renderThread();
    await screen.findByPlaceholderText('Write a reaction');
    fireEvent.change(screen.getByLabelText('Your reaction'), { target: { value: 'reply' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
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
    await screen.findByPlaceholderText('Write a reaction');
    fireEvent.click(screen.getByRole('button', { name: 'Delete post' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm deletion' }));
    await waitFor(() => {
      expect(deleteMessage).toHaveBeenCalledWith('sess', MESSAGE_ID);
    });
    expect(onRootDeleted).toHaveBeenCalled();
  });

  it('clears nested Gift when the paid reply is deleted', async () => {
    vi.mocked(fetchReplies).mockResolvedValue([payableNested]);
    signIn({ role: 'moderator' });
    renderThread();
    await screen.findByPlaceholderText('Write a reaction');
    await openNestedPaySheet();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Pay with Wallet of Satoshi' })).toBeTruthy();
    });
    const replyCard = document.querySelector(`[data-reply-id="${REPLY_ID}"]`) as HTMLElement;
    fireEvent.click(within(replyCard).getByRole('button', { name: 'Delete reaction' }));
    fireEvent.click(within(replyCard).getByRole('button', { name: 'Confirm deletion' }));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Pay with Wallet of Satoshi' })).toBeNull();
    });
  });

  it('clears nested Gift when the thread collapses', async () => {
    vi.mocked(fetchReplies).mockResolvedValue([payableNested]);
    signIn();
    renderThread();
    await screen.findByPlaceholderText('Write a reaction');
    await openNestedPaySheet();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Pay with Wallet of Satoshi' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Hide reactions' }));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Pay with Wallet of Satoshi' })).toBeNull();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Write a reaction')).toBeTruthy();
    });
    expect(screen.queryByRole('button', { name: 'Pay with Wallet of Satoshi' })).toBeNull();
  });

  it('drops a nested reply after a staff delete', async () => {
    vi.mocked(fetchReplies).mockResolvedValue([giftReply]);
    signIn({ role: 'moderator' });
    renderThread();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Delete reaction' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Delete reaction' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm deletion' }));
    await waitFor(() => {
      expect(deleteMessage).toHaveBeenCalledWith('sess', REPLY_ID);
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Delete reaction' })).toBeNull();
    });
  });

  it('collapses and re-expands the thread', async () => {
    signIn();
    renderThread();
    await screen.findByPlaceholderText('Write a reaction');
    fireEvent.click(screen.getByRole('button', { name: 'Hide reactions' }));
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Write a reaction')).toBeNull();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Write a reaction')).toBeTruthy();
    });
    expect(fetchReplies).toHaveBeenCalledTimes(2);
  });

  it('keeps the replies error when retry fails', async () => {
    vi.mocked(fetchReplies).mockRejectedValue(new Error('offline'));
    signIn();
    renderThread();
    await waitFor(() => {
      expect(screen.getByText('Could not load reactions. Please try again.')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(fetchReplies).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByText('Could not load reactions. Please try again.')).toBeTruthy();
  });

  it('shows a replies error and retries', async () => {
    vi.mocked(fetchReplies).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([]);
    signIn();
    renderThread();
    await waitFor(() => {
      expect(screen.getByText('Could not load reactions. Please try again.')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Write a reaction')).toBeTruthy();
    });
  });

  it('treats omitted photoCount as zero when the root has no photo', async () => {
    signIn();
    renderThread({
      root: { ...root, hasPhoto: false, photoCount: undefined as unknown as number },
    });
    expect(screen.getByText('Hello from Carol')).toBeTruthy();
    expect(fetchMessagePhoto).not.toHaveBeenCalled();
  });

  it('falls back to hasPhoto when photoCount is omitted', async () => {
    vi.mocked(fetchMessagePhoto).mockResolvedValue(new Blob(['x'], { type: 'image/jpeg' }));
    signIn();
    renderThread({
      root: { ...root, hasPhoto: true, text: '', photoCount: undefined as unknown as number },
    });
    await waitFor(() => {
      expect(fetchMessagePhoto).toHaveBeenCalledWith('sess', MESSAGE_ID, 0);
    });
    await waitFor(() => {
      expect(screen.getByAltText('Photo from Carol')).toBeTruthy();
    });
  });

  it('does not fetch a photo for a no-photo reply when photoCount is omitted', async () => {
    vi.mocked(fetchMessagePhoto).mockResolvedValue(new Blob(['x'], { type: 'image/jpeg' }));
    vi.mocked(fetchReplies).mockResolvedValue([
      {
        ...giftReply,
        hasPhoto: false,
        photoCount: undefined as unknown as number,
      },
    ]);
    signIn();
    renderThread({ root: { ...root, hasPhoto: true, photoCount: 1 } });
    await waitFor(() => {
      expect(fetchMessagePhoto).toHaveBeenCalledWith('sess', MESSAGE_ID, 0);
    });
    await waitFor(() => {
      expect(screen.getByAltText('Photo from Carol')).toBeTruthy();
    });
    await waitFor(() => {
      expect(screen.getByText('Pater Severin')).toBeTruthy();
    });
    useAuthStore.setState({ session: 'sess-2', account });
    await waitFor(() => {
      expect(fetchMessagePhoto).toHaveBeenCalledTimes(1);
    });
    expect(fetchMessagePhoto).not.toHaveBeenCalledWith('sess', REPLY_ID, 0);
    expect(fetchMessagePhoto).not.toHaveBeenCalledWith('sess-2', REPLY_ID, 0);
  });

  it('loads a photo blob URL when the root has a photo', async () => {
    vi.mocked(fetchMessagePhoto).mockResolvedValue(new Blob(['x'], { type: 'image/jpeg' }));
    signIn();
    renderThread({ root: { ...root, hasPhoto: true, photoCount: 1 } });
    await waitFor(() => {
      expect(fetchMessagePhoto).toHaveBeenCalledWith('sess', MESSAGE_ID, 0);
    });
    await waitFor(() => {
      expect(screen.getByAltText('Photo from Carol')).toBeTruthy();
    });
  });

  it('does not refetch a photo when the session token changes', async () => {
    vi.mocked(fetchMessagePhoto).mockResolvedValue(new Blob(['x'], { type: 'image/jpeg' }));
    signIn();
    renderThread({ root: { ...root, hasPhoto: true, photoCount: 1 } });
    await waitFor(() => {
      expect(screen.getByAltText('Photo from Carol')).toBeTruthy();
    });
    useAuthStore.setState({ session: 'sess-2', account });
    await waitFor(() => {
      expect(fetchMessagePhoto).toHaveBeenCalledTimes(1);
    });
  });

  it('leaves the row text-only when the photo cannot load', async () => {
    vi.mocked(fetchMessagePhoto).mockRejectedValue(new Error('offline'));
    signIn();
    renderThread({ root: { ...root, hasPhoto: true, photoCount: 1 } });
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
      expect(screen.getByText('Could not load reactions. Please try again.')).toBeTruthy();
    });
  });

  it('ignores a second Gift Continue while the invoice is in flight', async () => {
    let resolveInvoice: ((value: { pr: string; amountSats: number }) => void) | undefined;
    vi.mocked(postMessageInvoice).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveInvoice = resolve;
        }),
    );
    vi.mocked(fetchReplies).mockResolvedValue([payableNested]);
    signIn();
    renderThread();
    await screen.findByPlaceholderText('Write a reaction');
    await openNestedPaySheet();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(postMessageInvoice).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveInvoice?.({ pr: 'lnbc1', amountSats: 21 });
    });
  });

  it('maps an over-long invoice comment onto the reply length error', async () => {
    signIn();
    vi.mocked(postMessageInvoice).mockRejectedValue(new Error('Text must be 1–500 characters'));
    renderThread();
    await screen.findByPlaceholderText('Write a reaction');
    fireEvent.change(screen.getByLabelText('Your reaction'), { target: { value: 'thanks' } });
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
    await screen.findByPlaceholderText('Write a reaction');
    fireEvent.change(screen.getByLabelText('Your reaction'), { target: { value: 'reply' } });
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

  it('dismisses the requirements overlay', async () => {
    signIn({ lightningAddress: null, missing: ['lightning-address'] });
    renderThread();
    await screen.findByPlaceholderText('Write a reaction');
    submitComposer();
    expect(
      await screen.findByRole('dialog', { name: 'Add your Wallet of Satoshi address' }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('opens the overlay when pay invoice returns missing_requirements', async () => {
    vi.mocked(postMessageInvoice).mockRejectedValue(
      new MissingRequirementsError(['lightning-address']),
    );
    vi.mocked(fetchReplies).mockResolvedValue([payableNested]);
    signIn();
    renderThread();
    await screen.findByPlaceholderText('Write a reaction');
    await openNestedPaySheet();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(
      await screen.findByRole('dialog', { name: 'Add your Wallet of Satoshi address' }),
    ).toBeTruthy();
  });

  it('opens the overlay when a paid reply returns missing_requirements', async () => {
    vi.mocked(postMessageInvoice).mockRejectedValue(new MissingRequirementsError(['name']));
    signIn();
    renderThread();
    await screen.findByPlaceholderText('Write a reaction');
    fireEvent.change(screen.getByLabelText('Your reaction'), { target: { value: 'thanks' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    expect(await screen.findByRole('dialog', { name: 'Add your name' })).toBeTruthy();
  });

  it('shows a request error when a paid reply fails', async () => {
    vi.mocked(postMessageInvoice).mockRejectedValue(new Error('offline'));
    signIn();
    renderThread();
    await screen.findByPlaceholderText('Write a reaction');
    fireEvent.change(screen.getByLabelText('Your reaction'), { target: { value: 'thanks' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
    });
  });

  it('maps a paid-reply rate-limit onto the reply error', async () => {
    vi.mocked(postMessageInvoice).mockRejectedValue(new Error('Too many payments'));
    signIn();
    renderThread();
    await screen.findByPlaceholderText('Write a reaction');
    fireEvent.change(screen.getByLabelText('Your reaction'), { target: { value: 'thanks' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/too many/i);
    });
  });

  it('ignores collapse while a reply is posting', async () => {
    signIn({ role: 'founder' });
    let resolvePost!: (value: ForumMessage) => void;
    vi.mocked(postMessage).mockReturnValue(
      new Promise((resolve) => {
        resolvePost = resolve;
      }),
    );
    renderThread();
    await screen.findByPlaceholderText('Write a reaction');
    fireEvent.change(screen.getByLabelText('Your reaction'), { target: { value: 'reply' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hide reactions' }));
    expect(screen.getByPlaceholderText('Write a reaction')).toBeTruthy();
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

  it('shows a replies error when re-expand fetch fails', async () => {
    vi.mocked(fetchReplies).mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('offline'));
    signIn();
    renderThread();
    await screen.findByPlaceholderText('Write a reaction');
    fireEvent.click(screen.getByRole('button', { name: 'Hide reactions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    await waitFor(() => {
      expect(screen.getByText('Could not load reactions. Please try again.')).toBeTruthy();
    });
  });

  it('loads a photo after the first fetch fails', async () => {
    vi.mocked(fetchMessagePhoto)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(new Blob(['x'], { type: 'image/jpeg' }));
    signIn();
    renderThread({ root: { ...root, hasPhoto: true, photoCount: 1 } });
    await waitFor(() => {
      expect(screen.getByAltText('Photo from Carol')).toBeTruthy();
    });
  });

  it('keeps a later gift sheet when an earlier pay poll confirms', async () => {
    vi.mocked(fetchPublicMessage).mockResolvedValue({ ...root, sats: 42 });
    signIn();
    renderThread();
    await screen.findByPlaceholderText('Write a reaction');
    submitComposer();
    await waitFor(() => {
      expect(fetchPublicMessage).toHaveBeenCalled();
    });
  });

  it('drops a late pay invoice after Back', async () => {
    let resolveInvoice!: (value: { pr: string; amountSats: number }) => void;
    vi.mocked(postMessageInvoice).mockReturnValue(
      new Promise((resolve) => {
        resolveInvoice = resolve;
      }),
    );
    vi.mocked(fetchReplies).mockResolvedValue([payableNested]);
    signIn();
    renderThread();
    await screen.findByPlaceholderText('Write a reaction');
    await openNestedPaySheet();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    await act(async () => {
      resolveInvoice({ pr: 'lnbc1', amountSats: 21 });
    });
    expect(screen.queryByRole('button', { name: 'Pay with Wallet of Satoshi' })).toBeNull();
  });
});
