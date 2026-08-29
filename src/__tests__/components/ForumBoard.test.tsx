import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ForumBoard, type ForumBoardProps } from '@/components/ForumBoard';
import { FORUM_MESSAGE_MAX_LENGTH, type ForumMessage } from '@/lib/api-types';
import { formatForumTime } from '@/lib/forum-time';
import { renderWithLocale } from '@/__tests__/render-with-locale';

afterEach(cleanup);

const SAMPLE: ForumMessage = {
  id: 'm1',
  name: 'Ada',
  text: 'Hello from Ada',
  createdAt: '2026-08-28T12:00:00.000Z',
  sats: 0,
  payable: true,
};

const MULTILINE: ForumMessage = {
  id: 'm2',
  name: 'Bob',
  text: 'Line one\nLine two',
  createdAt: '2026-08-28T13:00:00.000Z',
  sats: 21,
  payable: false,
};

const idlePay: Pick<
  ForumBoardProps,
  | 'payMessageId'
  | 'payDraft'
  | 'payBusy'
  | 'payError'
  | 'payInvoice'
  | 'payWaiting'
  | 'onPayOpen'
  | 'onPayDraftChange'
  | 'onPaySubmit'
  | 'onPayCancel'
> = {
  payMessageId: null,
  payDraft: '',
  payBusy: false,
  payError: null,
  payInvoice: null,
  payWaiting: false,
  onPayOpen: () => undefined,
  onPayDraftChange: () => undefined,
  onPaySubmit: () => undefined,
  onPayCancel: () => undefined,
};

describe('ForumBoard', () => {
  it('shows the heading, composer, and Post button', () => {
    renderWithLocale(
      <ForumBoard
        messages={[]}
        error={false}
        loading={false}
        posting={false}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        onRetry={() => undefined}
        formError={null}
        {...idlePay}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Forum' })).toBeTruthy();
    expect(screen.queryByText('Everyone can read and write.')).toBeNull();
    expect(screen.getByLabelText('Your message')).toBeTruthy();
    expect(screen.getByPlaceholderText('Write a message')).toBeTruthy();
    const field = screen.getByLabelText('Your message');
    const button = screen.getByRole('button', { name: 'Post' });
    expect(button).toBeTruthy();
    expect(field.nextElementSibling).toBe(button);
    expect(field.getAttribute('maxLength')).toBe(String(FORUM_MESSAGE_MAX_LENGTH));
  });

  it('shows loading copy when loading and messages are null', () => {
    renderWithLocale(
      <ForumBoard
        messages={null}
        error={false}
        loading={true}
        posting={false}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        onRetry={() => undefined}
        formError={null}
        {...idlePay}
      />,
    );
    expect(screen.getByText('Loading…')).toBeTruthy();
  });

  it('shows a fallback loading line when nothing is loaded yet', () => {
    renderWithLocale(
      <ForumBoard
        messages={null}
        error={false}
        loading={false}
        posting={false}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        onRetry={() => undefined}
        formError={null}
        {...idlePay}
      />,
    );
    expect(screen.getByText('Loading…')).toBeTruthy();
  });

  it('shows an error and retries', () => {
    const onRetry = vi.fn();
    renderWithLocale(
      <ForumBoard
        messages={null}
        error={true}
        loading={false}
        posting={false}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        onRetry={onRetry}
        formError={null}
        {...idlePay}
      />,
    );
    expect(screen.getByText('Could not load messages. Please try again.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('keeps the list and still shows retry when a load error arrives later', () => {
    const onRetry = vi.fn();
    renderWithLocale(
      <ForumBoard
        messages={[SAMPLE]}
        error={true}
        loading={false}
        posting={false}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        onRetry={onRetry}
        formError={null}
        {...idlePay}
      />,
    );
    expect(screen.getByText('Hello from Ada')).toBeTruthy();
    expect(screen.getByText('Could not load messages. Please try again.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('localizes the load error', () => {
    renderWithLocale(
      <ForumBoard
        messages={null}
        error={true}
        loading={false}
        posting={false}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        onRetry={() => undefined}
        formError={null}
        {...idlePay}
      />,
      'de',
    );
    expect(
      screen.getByText('Nachrichten konnten nicht geladen werden. Bitte erneut versuchen.'),
    ).toBeTruthy();
  });

  it('shows the empty copy', () => {
    renderWithLocale(
      <ForumBoard
        messages={[]}
        error={false}
        loading={false}
        posting={false}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        onRetry={() => undefined}
        formError={null}
        {...idlePay}
      />,
    );
    expect(screen.getByText('No messages yet. Be the first to write.')).toBeTruthy();
  });

  it('lists messages with name, sats, formatted time, and pre-wrapped text', () => {
    renderWithLocale(
      <ForumBoard
        messages={[SAMPLE, MULTILINE]}
        error={false}
        loading={false}
        posting={false}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        onRetry={() => undefined}
        formError={null}
        {...idlePay}
      />,
    );
    const list = screen.getByRole('list', { name: 'All messages' });
    expect(list).toBeTruthy();
    expect(screen.getByText('Ada')).toBeTruthy();
    expect(screen.getByText('Hello from Ada')).toBeTruthy();
    expect(screen.getByText('0 sats')).toBeTruthy();
    expect(screen.getByText('21 sats')).toBeTruthy();
    expect(screen.getByText(formatForumTime(SAMPLE.createdAt, 'en'))).toBeTruthy();
    const preWrap = screen.getByText(
      (content) => content.includes('Line one') && content.includes('Line two'),
    );
    expect(preWrap.className).toContain('whitespace-pre-wrap');
  });

  it('shows 1 sat for a single sat total', () => {
    renderWithLocale(
      <ForumBoard
        messages={[{ ...SAMPLE, sats: 1 }]}
        error={false}
        loading={false}
        posting={false}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        onRetry={() => undefined}
        formError={null}
        {...idlePay}
      />,
    );
    expect(screen.getByText('1 sat')).toBeTruthy();
  });

  it('disables pay when payable is false and opens when payable', () => {
    const onPayOpen = vi.fn();
    renderWithLocale(
      <ForumBoard
        messages={[SAMPLE, MULTILINE]}
        error={false}
        loading={false}
        posting={false}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        onRetry={() => undefined}
        formError={null}
        {...idlePay}
        onPayOpen={onPayOpen}
      />,
    );
    expect(screen.queryByText('Send Bitcoin')).toBeNull();
    const buttons = screen.getAllByRole('button', { name: 'Send Bitcoin' });
    expect((buttons[0] as HTMLButtonElement).disabled).toBe(false);
    expect((buttons[1] as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(buttons[0]!);
    expect(onPayOpen).toHaveBeenCalledWith('m1');
  });

  it('renders the amount sheet and submits pay', () => {
    const onPaySubmit = vi.fn();
    const onPayDraftChange = vi.fn();
    const onPayCancel = vi.fn();
    renderWithLocale(
      <ForumBoard
        messages={[SAMPLE]}
        error={false}
        loading={false}
        posting={false}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        onRetry={() => undefined}
        formError={null}
        {...idlePay}
        payMessageId="m1"
        payDraft="21"
        onPayDraftChange={onPayDraftChange}
        onPaySubmit={onPaySubmit}
        onPayCancel={onPayCancel}
      />,
    );
    expect(screen.getByLabelText('Amount (sats)')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Amount (sats)'), { target: { value: '42' } });
    expect(onPayDraftChange).toHaveBeenCalledWith('42');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onPaySubmit).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onPayCancel).toHaveBeenCalledTimes(1);
  });

  it('shows pay amount error', () => {
    renderWithLocale(
      <ForumBoard
        messages={[SAMPLE]}
        error={false}
        loading={false}
        posting={false}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        onRetry={() => undefined}
        formError={null}
        {...idlePay}
        payMessageId="m1"
        payError="amount"
      />,
    );
    expect(screen.getByRole('alert').textContent).toBe(
      'Enter a whole number of sats greater than zero',
    );
  });

  it('shows pay request error', () => {
    renderWithLocale(
      <ForumBoard
        messages={[SAMPLE]}
        error={false}
        loading={false}
        posting={false}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        onRetry={() => undefined}
        formError={null}
        {...idlePay}
        payMessageId="m1"
        payError="request"
      />,
    );
    expect(screen.getByRole('alert').textContent).toBe('Could not start the Bitcoin payment');
  });

  it('shows pay rate-limit error', () => {
    renderWithLocale(
      <ForumBoard
        messages={[SAMPLE]}
        error={false}
        loading={false}
        posting={false}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        onRetry={() => undefined}
        formError={null}
        {...idlePay}
        payMessageId="m1"
        payError="rateLimit"
      />,
    );
    expect(screen.getByRole('alert').textContent).toBe(
      'Too many payments. Please wait a moment and try again.',
    );
  });

  it('shows the invoice QR and wallet link', () => {
    renderWithLocale(
      <ForumBoard
        messages={[SAMPLE]}
        error={false}
        loading={false}
        posting={false}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        onRetry={() => undefined}
        formError={null}
        {...idlePay}
        payMessageId="m1"
        payInvoice={{ messageId: 'm1', pr: 'lnbc21n1example', amountSats: 21 }}
        payWaiting={true}
      />,
    );
    expect(screen.getByText('Pay 21 sats')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Bitcoin payment QR code' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open Wallet of Satoshi' })).toBeTruthy();
    expect(screen.getByText('Waiting for payment…')).toBeTruthy();
  });

  it('shows formError empty alert', () => {
    renderWithLocale(
      <ForumBoard
        messages={[]}
        error={false}
        loading={false}
        posting={false}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        onRetry={() => undefined}
        formError="empty"
        {...idlePay}
      />,
    );
    expect(screen.getByRole('alert').textContent).toBe('Enter a message');
  });

  it('shows formError tooLong alert', () => {
    renderWithLocale(
      <ForumBoard
        messages={[]}
        error={false}
        loading={false}
        posting={false}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        onRetry={() => undefined}
        formError="tooLong"
        {...idlePay}
      />,
    );
    expect(screen.getByRole('alert').textContent).toBe('Keep it to 500 characters');
  });

  it('shows formError request alert', () => {
    renderWithLocale(
      <ForumBoard
        messages={[]}
        error={false}
        loading={false}
        posting={false}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        onRetry={() => undefined}
        formError="request"
        {...idlePay}
      />,
    );
    expect(screen.getByRole('alert').textContent).toBe('Could not post your message');
  });

  it('shows formError rateLimit alert', () => {
    renderWithLocale(
      <ForumBoard
        messages={[]}
        error={false}
        loading={false}
        posting={false}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        onRetry={() => undefined}
        formError="rateLimit"
        {...idlePay}
      />,
    );
    expect(screen.getByRole('alert').textContent).toBe(
      'Too many messages. Please wait a moment and try again.',
    );
  });

  it('disables submit and shows a spinner while posting', () => {
    renderWithLocale(
      <ForumBoard
        messages={[]}
        error={false}
        loading={false}
        posting={true}
        draft="Hi"
        onDraftChange={() => undefined}
        onPost={() => undefined}
        onRetry={() => undefined}
        formError={null}
        {...idlePay}
      />,
    );
    const button = screen.getByRole('button', { name: 'Post' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.querySelector('.animate-spin')).toBeTruthy();
  });

  it('calls onDraftChange when typing and onPost on submit', () => {
    const onDraftChange = vi.fn();
    const onPost = vi.fn();
    renderWithLocale(
      <ForumBoard
        messages={[]}
        error={false}
        loading={false}
        posting={false}
        draft=""
        onDraftChange={onDraftChange}
        onPost={onPost}
        onRetry={() => undefined}
        formError={null}
        {...idlePay}
      />,
    );
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Hi' } });
    expect(onDraftChange).toHaveBeenCalledWith('Hi');
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    expect(onPost).toHaveBeenCalledTimes(1);
  });
});
