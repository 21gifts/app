import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ForumBoard, type ForumBoardProps } from '@/components/ForumBoard';
import { FORUM_MESSAGE_MAX_LENGTH, type ForumMessage } from '@/lib/api-types';
import type { ForumFeedMode } from '@/lib/forum-feed';
import type { ForumPhotoPayload } from '@/lib/forum-photo';
import { formatForumTime } from '@/lib/forum-time';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
const originalUserAgent = navigator.userAgent;

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  Object.defineProperty(navigator, 'userAgent', {
    configurable: true,
    value: originalUserAgent,
  });
});

const SAMPLE: ForumMessage = {
  id: 'm1',
  name: 'Ada',
  text: 'Hello from Ada',
  createdAt: '2026-08-28T12:00:00.000Z',
  sats: 0,
  payable: true,
  hasPhoto: false,
  role: 'basis',
};

const MULTILINE: ForumMessage = {
  id: 'm2',
  name: 'Bob',
  text: 'Line one\nLine two',
  createdAt: '2026-08-28T13:00:00.000Z',
  sats: 21,
  payable: false,
  hasPhoto: false,
  role: 'basis',
};

const FIVE_SATS: ForumMessage = {
  id: 'm5',
  name: 'Ada',
  text: 'Five sats note',
  createdAt: '2026-08-28T14:00:00.000Z',
  sats: 5,
  payable: true,
  hasPhoto: false,
  role: 'basis',
};

const PHOTO: ForumPhotoPayload = {
  contentType: 'image/jpeg',
  data: 'abc',
  previewUrl: 'data:image/jpeg;base64,abc',
};

const idleProps: Pick<
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
  | 'lawsVisible'
  | 'onDismissLaws'
  | 'photoDraft'
  | 'onPickPhoto'
  | 'onClearPhoto'
  | 'photoUrls'
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
  lawsVisible: true,
  onDismissLaws: () => undefined,
  photoDraft: null,
  onPickPhoto: () => undefined,
  onClearPhoto: () => undefined,
  photoUrls: {},
};

function modeProps(
  mode: ForumFeedMode = 'all',
  onModeChange: (next: ForumFeedMode) => void = () => undefined,
): Pick<ForumBoardProps, 'mode' | 'onModeChange'> {
  return { mode, onModeChange };
}

describe('ForumBoard', () => {
  it('shows the heading, mode selector, attach/send icons, and composer', () => {
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
        {...idleProps}
        {...modeProps('active')}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Forum' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Forum view' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Active' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(screen.queryByText('Everyone can read and write.')).toBeNull();
    expect(
      screen.getByText('This is a donation platform. Only free gifts — never pay for a promise.'),
    ).toBeTruthy();
    expect(screen.getByText('Donors are scarce. No begging, no drama, no pressure.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Living room rules' }).getAttribute('href')).toBe(
      '/rules',
    );
    expect(screen.getByRole('link', { name: 'Contact' }).getAttribute('href')).toBe('/contact');
    expect(screen.getByRole('button', { name: 'Add a photo' })).toBeTruthy();
    expect(screen.queryByText('Add a photo')).toBeNull();
    expect(screen.getByLabelText('Your message')).toBeTruthy();
    expect(screen.getByPlaceholderText('Write a message')).toBeTruthy();
    const field = screen.getByLabelText('Your message');
    const button = screen.getByRole('button', { name: 'Post' });
    expect(button).toBeTruthy();
    expect(button.textContent?.trim()).toBe('');
    expect(screen.getByLabelText('Add a photo').textContent?.trim()).toBe('');
    expect(field.nextElementSibling).toBe(button);
    expect(field.previousElementSibling?.previousElementSibling).toBe(
      screen.getByLabelText('Add a photo'),
    );
    expect(field.getAttribute('maxLength')).toBe(String(FORUM_MESSAGE_MAX_LENGTH));
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeTruthy();
  });

  it('calls onDismissLaws when the Dismiss button is clicked', () => {
    const onDismissLaws = vi.fn();
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
        {...idleProps}
        {...modeProps()}
        onDismissLaws={onDismissLaws}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismissLaws).toHaveBeenCalledTimes(1);
  });

  it('hides the laws hint when lawsVisible is false', () => {
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
        {...idleProps}
        {...modeProps()}
        lawsVisible={false}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Forum' })).toBeTruthy();
    expect(
      screen.queryByText('This is a donation platform. Only free gifts — never pay for a promise.'),
    ).toBeNull();
    expect(screen.queryByRole('link', { name: 'Living room rules' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull();
  });

  it('keeps the mode selector visible while loading', () => {
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
        {...idleProps}
        {...modeProps('active')}
      />,
    );
    expect(screen.getByRole('group', { name: 'Forum view' })).toBeTruthy();
    expect(screen.getByText('Loading…')).toBeTruthy();
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
        {...idleProps}
        {...modeProps('active')}
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
        {...idleProps}
        {...modeProps('active')}
      />,
    );
    expect(screen.getByText('Loading…')).toBeTruthy();
  });

  it('shows an error and retries with the selector still present', () => {
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
        {...idleProps}
        {...modeProps('active')}
      />,
    );
    expect(screen.getByRole('group', { name: 'Forum view' })).toBeTruthy();
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
        {...idleProps}
        {...modeProps('all')}
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
        {...idleProps}
        {...modeProps('active')}
      />,
      'de',
    );
    expect(
      screen.getByText('Nachrichten konnten nicht geladen werden. Bitte erneut versuchen.'),
    ).toBeTruthy();
  });

  it('shows the empty copy, not emptyPaid, when the loaded list is empty', () => {
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
        {...idleProps}
        {...modeProps('active')}
      />,
    );
    expect(screen.getByText('No messages yet. Be the first to write.')).toBeTruthy();
    expect(screen.queryByText('No messages with sats yet.')).toBeNull();
    expect(screen.getByRole('group', { name: 'Forum view' })).toBeTruthy();
  });

  it('hides a zero-sat SAMPLE on Active and shows MULTILINE', () => {
    renderWithLocale(
      <ForumBoard
        messages={[MULTILINE, SAMPLE]}
        error={false}
        loading={false}
        posting={false}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        onRetry={() => undefined}
        formError={null}
        {...idleProps}
        {...modeProps('active')}
      />,
    );
    expect(screen.queryByText('Hello from Ada')).toBeNull();
    expect(
      screen.getByText((content) => content.includes('Line one') && content.includes('Line two')),
    ).toBeTruthy();
  });

  it('shows emptyPaid when Active hides every loaded row', () => {
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
        {...idleProps}
        {...modeProps('active')}
      />,
    );
    expect(screen.getByText('No messages with sats yet.')).toBeTruthy();
    expect(screen.queryByText('No messages yet. Be the first to write.')).toBeNull();
  });

  it('lists both messages on All including zero-sat SAMPLE', () => {
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
        {...idleProps}
        {...modeProps('all')}
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

  it('renders newest-first props as chronological listitems (oldest top, newest bottom)', () => {
    renderWithLocale(
      <ForumBoard
        messages={[MULTILINE, SAMPLE]}
        error={false}
        loading={false}
        posting={false}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        onRetry={() => undefined}
        formError={null}
        {...idleProps}
        {...modeProps('all')}
      />,
    );

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]!.textContent).toContain('Ada');
    expect(items[0]!.textContent).toContain('Hello from Ada');
    expect(items[1]!.textContent).toContain('Bob');
    expect(items[1]!.textContent).toContain('Line one');
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({
      block: 'end',
      behavior: 'auto',
    });
  });

  it('orders popular by sats descending when input is newest-first', () => {
    renderWithLocale(
      <ForumBoard
        messages={[FIVE_SATS, MULTILINE]}
        error={false}
        loading={false}
        posting={false}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        onRetry={() => undefined}
        formError={null}
        {...idleProps}
        {...modeProps('popular')}
      />,
    );
    const items = screen.getAllByRole('listitem');
    expect(items[0]?.textContent).toContain('Line one');
    expect(items[0]?.textContent).toContain('21 sats');
    expect(items[1]?.textContent).toContain('Five sats note');
    expect(items[1]?.textContent).toContain('5 sats');
  });

  it('does not scroll the composer when messages are empty', () => {
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
        {...idleProps}
        {...modeProps('active')}
      />,
    );

    expect(HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled();
  });

  it('localizes mode buttons in German', () => {
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
        {...idleProps}
        {...modeProps('active')}
      />,
      'de',
    );
    expect(screen.getByRole('button', { name: 'Aktiv' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Alle' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Beliebteste' })).toBeTruthy();
  });

  it('calls onModeChange when All is clicked', () => {
    const onModeChange = vi.fn();
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
        {...idleProps}
        mode="active"
        onModeChange={onModeChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(onModeChange).toHaveBeenCalledWith('all');
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
        {...idleProps}
        {...modeProps('active')}
      />,
    );
    expect(screen.getByText('1 sat')).toBeTruthy();
  });

  it('renders an inline photo and hides an empty text paragraph', () => {
    renderWithLocale(
      <ForumBoard
        messages={[
          {
            id: 'm-photo',
            name: 'Ada',
            text: '',
            createdAt: '2026-08-28T12:00:00.000Z',
            sats: 0,
            payable: false,
            hasPhoto: true,
            role: 'basis',
          },
        ]}
        error={false}
        loading={false}
        posting={false}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        onRetry={() => undefined}
        formError={null}
        {...idleProps}
        photoUrls={{ 'm-photo': 'blob:photo' }}
        {...modeProps('all')}
      />,
    );
    expect(document.querySelector('p.whitespace-pre-wrap')).toBeNull();
    expect(screen.getByAltText('Photo from Ada').getAttribute('src')).toBe('blob:photo');
    expect(screen.getByRole('listitem').getAttribute('data-message-id')).toBe('m-photo');
  });

  it('renders caption text below the photo', () => {
    renderWithLocale(
      <ForumBoard
        messages={[
          {
            id: 'm-photo',
            name: 'Ada',
            text: 'Caption under the photo',
            createdAt: '2026-08-28T12:00:00.000Z',
            sats: 0,
            payable: false,
            hasPhoto: true,
            role: 'basis',
          },
        ]}
        error={false}
        loading={false}
        posting={false}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        onRetry={() => undefined}
        formError={null}
        {...idleProps}
        photoUrls={{ 'm-photo': 'blob:photo' }}
        {...modeProps('all')}
      />,
    );
    const img = screen.getByAltText('Photo from Ada');
    const caption = screen.getByText('Caption under the photo');
    expect(img.compareDocumentPosition(caption) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders text and an inline photo together', () => {
    renderWithLocale(
      <ForumBoard
        messages={[
          {
            id: 'm-both',
            name: 'Ada',
            text: 'Hello from Ada',
            createdAt: '2026-08-28T12:00:00.000Z',
            sats: 0,
            payable: false,
            hasPhoto: true,
            role: 'basis',
          },
        ]}
        error={false}
        loading={false}
        posting={false}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        onRetry={() => undefined}
        formError={null}
        {...idleProps}
        photoUrls={{ 'm-both': 'blob:photo' }}
        {...modeProps('all')}
      />,
    );
    const row = screen.getByRole('listitem');
    expect(row.getAttribute('data-message-id')).toBe('m-both');
    const photo = screen.getByAltText('Photo from Ada');
    const caption = screen.getByText('Hello from Ada');
    expect(photo.getAttribute('src')).toBe('blob:photo');
    expect(photo.compareDocumentPosition(caption) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('omits Send Bitcoin when payable is false', () => {
    const onPayOpen = vi.fn();
    renderWithLocale(
      <ForumBoard
        messages={[MULTILINE]}
        error={false}
        loading={false}
        posting={false}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        onRetry={() => undefined}
        formError={null}
        {...idleProps}
        onPayOpen={onPayOpen}
        {...modeProps('all')}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Send Bitcoin' })).toBeNull();
    expect(onPayOpen).not.toHaveBeenCalled();
  });

  it('opens pay when Send Bitcoin is clicked on a payable note', () => {
    const onPayOpen = vi.fn();
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
        {...idleProps}
        onPayOpen={onPayOpen}
        {...modeProps('all')}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Send Bitcoin' }));
    expect(onPayOpen).toHaveBeenCalledWith('m1');
  });

  it('shows a photo draft preview and clear control', () => {
    const onClearPhoto = vi.fn();
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
        {...idleProps}
        photoDraft={PHOTO}
        onClearPhoto={onClearPhoto}
        {...modeProps('active')}
      />,
    );
    expect(screen.getByAltText('Selected photo')).toBeTruthy();
    const remove = screen.getByRole('button', { name: 'Remove photo' });
    expect(remove.textContent?.trim()).toBe('');
    fireEvent.click(remove);
    expect(onClearPhoto).toHaveBeenCalledTimes(1);
  });

  it('calls onPickPhoto when a file is chosen', () => {
    const onPickPhoto = vi.fn();
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
        {...idleProps}
        onPickPhoto={onPickPhoto}
        {...modeProps('active')}
      />,
    );
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = vi.spyOn(input, 'click').mockImplementation(() => undefined);
    fireEvent.click(screen.getByLabelText('Add a photo'));
    expect(clickSpy).toHaveBeenCalled();
    const file = new File([new Uint8Array([1])], 'a.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(onPickPhoto).toHaveBeenCalledWith(file);
    fireEvent.change(input, { target: { files: [] } });
    expect(onPickPhoto).toHaveBeenCalledTimes(1);
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
        {...idleProps}
        payMessageId="m1"
        payDraft="21"
        onPayDraftChange={onPayDraftChange}
        onPaySubmit={onPaySubmit}
        onPayCancel={onPayCancel}
        {...modeProps('all')}
      />,
    );
    expect(screen.getByLabelText('Amount (sats)')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Amount (sats)'), { target: { value: '42' } });
    expect(onPayDraftChange).toHaveBeenCalledWith('42');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onPaySubmit).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.queryByText('Back')).toBeNull();
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
        {...idleProps}
        payMessageId="m1"
        payError="amount"
        {...modeProps('all')}
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
        {...idleProps}
        payMessageId="m1"
        payError="request"
        {...modeProps('all')}
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
        {...idleProps}
        payMessageId="m1"
        payError="rateLimit"
        {...modeProps('all')}
      />,
    );
    expect(screen.getByRole('alert').textContent).toBe(
      'Too many payments. Please wait a moment and try again.',
    );
  });

  it('shows the invoice QR and wallet link', async () => {
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
        {...idleProps}
        payMessageId="m1"
        payInvoice={{ messageId: 'm1', pr: 'lnbc21n1example', amountSats: 21 }}
        payWaiting={true}
        onPayCancel={onPayCancel}
        {...modeProps('all')}
      />,
    );
    expect(screen.getByText('Pay 21 sats')).toBeTruthy();
    expect(await screen.findByRole('img', { name: 'Bitcoin payment QR code' })).toBeTruthy();
    const walletLink = screen.getByRole('link', { name: 'Pay with Wallet of Satoshi' });
    expect(walletLink.textContent).toContain('Pay');
    expect(walletLink.querySelector('img[src="/wos-icon.png"]')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
    expect(screen.queryByText('Back')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onPayCancel).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Waiting for payment…')).toBeTruthy();
  });

  it('hides the invoice QR on iPhone and keeps the wallet link', async () => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    });
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
        {...idleProps}
        payMessageId="m1"
        payInvoice={{ messageId: 'm1', pr: 'lnbc21n1example', amountSats: 21 }}
        {...modeProps('all')}
      />,
    );
    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Pay with Wallet of Satoshi' })).toBeTruthy();
    });
    expect(screen.queryByRole('img', { name: 'Bitcoin payment QR code' })).toBeNull();
  });

  it('hides the invoice QR on Android Mobile and uses an Intent href', async () => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value:
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    });
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
        {...idleProps}
        payMessageId="m1"
        payInvoice={{ messageId: 'm1', pr: 'lnbc21n1example', amountSats: 21 }}
        {...modeProps('all')}
      />,
    );
    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Pay with Wallet of Satoshi' })).toBeTruthy();
    });
    expect(screen.queryByRole('img', { name: 'Bitcoin payment QR code' })).toBeNull();
    expect(
      screen.getByRole('link', { name: 'Pay with Wallet of Satoshi' }).getAttribute('href'),
    ).toMatch(/^intent:lightning:/);
  });

  it('shows German invoice sheet labels', () => {
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
        {...idleProps}
        payMessageId="m1"
        payInvoice={{ messageId: 'm1', pr: 'lnbc21n1example', amountSats: 21 }}
        {...modeProps('all')}
      />,
      'de',
    );
    expect(screen.getByRole('button', { name: 'Zurück' })).toBeTruthy();
    expect(screen.queryByText('Zurück')).toBeNull();
    const walletLink = screen.getByRole('link', { name: 'Mit Wallet of Satoshi zahlen' });
    expect(walletLink.textContent).toContain('Zahlen');
    expect(walletLink.textContent).not.toContain('Pay');
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
        {...idleProps}
        {...modeProps('active')}
      />,
    );
    expect(screen.getByRole('alert').textContent).toBe('Enter a message or add a photo');
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
        {...idleProps}
        {...modeProps('active')}
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
        {...idleProps}
        {...modeProps('active')}
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
        {...idleProps}
        {...modeProps('active')}
      />,
    );
    expect(screen.getByRole('alert').textContent).toBe(
      'Too many messages. Please wait a moment and try again.',
    );
  });

  it('shows formError unsupported alert', () => {
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
        formError="unsupported"
        {...idleProps}
        {...modeProps('active')}
      />,
    );
    expect(screen.getByRole('alert').textContent).toBe('Use a JPEG, PNG, or WebP photo');
  });

  it('shows formError tooLarge alert', () => {
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
        formError="tooLarge"
        {...idleProps}
        {...modeProps('active')}
      />,
    );
    expect(screen.getByRole('alert').textContent).toBe('Keep the photo under 1 MB');
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
        {...idleProps}
        {...modeProps('active')}
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
        {...idleProps}
        {...modeProps('active')}
      />,
    );
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Hi' } });
    expect(onDraftChange).toHaveBeenCalledWith('Hi');
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    expect(onPost).toHaveBeenCalledTimes(1);
  });

  it('does not show a role tag for basis', () => {
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
        {...idleProps}
        {...modeProps('all')}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Founder' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Moderator' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Verified' })).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows Founder, Moderator, and Verified tags for those roles', () => {
    renderWithLocale(
      <ForumBoard
        messages={[
          { ...SAMPLE, id: 'm-founder', role: 'founder' },
          { ...SAMPLE, id: 'm-mod', name: 'Bob', role: 'moderator' },
          { ...SAMPLE, id: 'm-ver', name: 'Carol', role: 'verified' },
        ]}
        error={false}
        loading={false}
        posting={false}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        onRetry={() => undefined}
        formError={null}
        {...idleProps}
        {...modeProps('all')}
      />,
    );
    expect(screen.getByRole('button', { name: 'Founder' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Moderator' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Verified' })).toBeTruthy();
  });

  it('opens a role hint on click and closes it when the same tag is clicked again', () => {
    renderWithLocale(
      <ForumBoard
        messages={[{ ...SAMPLE, role: 'verified' }]}
        error={false}
        loading={false}
        posting={false}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        onRetry={() => undefined}
        formError={null}
        {...idleProps}
        {...modeProps('all')}
      />,
    );
    const tag = screen.getByRole('button', { name: 'Verified' });
    expect(tag.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(tag);
    expect(tag.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('status').textContent).toBe(
      'A moderator met this person in real life and confirmed they are a real human.',
    );
    fireEvent.click(tag);
    expect(tag.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('switches the open role hint when another tag is clicked', () => {
    renderWithLocale(
      <ForumBoard
        messages={[
          { ...SAMPLE, id: 'm-ver', role: 'verified' },
          { ...SAMPLE, id: 'm-mod', name: 'Bob', role: 'moderator' },
        ]}
        error={false}
        loading={false}
        posting={false}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        onRetry={() => undefined}
        formError={null}
        {...idleProps}
        {...modeProps('all')}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Verified' }));
    expect(screen.getByRole('status').textContent).toBe(
      'A moderator met this person in real life and confirmed they are a real human.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Moderator' }));
    expect(screen.getByRole('status').textContent).toBe(
      'This person helps keep the living room in order.',
    );
    expect(screen.getByRole('button', { name: 'Verified' }).getAttribute('aria-expanded')).toBe(
      'false',
    );
    expect(screen.getByRole('button', { name: 'Moderator' }).getAttribute('aria-expanded')).toBe(
      'true',
    );
  });

  it('localizes the Founder tag label', () => {
    renderWithLocale(
      <ForumBoard
        messages={[{ ...SAMPLE, role: 'founder' }]}
        error={false}
        loading={false}
        posting={false}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        onRetry={() => undefined}
        formError={null}
        {...idleProps}
        {...modeProps('all')}
      />,
      'de',
    );
    expect(screen.getByRole('button', { name: 'Gründer' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Gründer' }));
    expect(screen.getByRole('status').textContent).toBe('Diese Person hat 21.gifts gegründet.');
  });
});
