import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from '@/components/AppShell';
import { LocaleProvider } from '@/components/LocaleProvider';
import { ThemeProvider } from '@/components/ThemeProvider';
import { ForumBoard, revealReplyForm, type ForumBoardProps } from '@/components/ForumBoard';
import { FORUM_MESSAGE_MAX_LENGTH, type ForumMessage } from '@/lib/api-types';
import { getCatalog } from '@/lib/messages';
import {
  FORUM_COMPOSE_EVENT,
  consumePendingForumCompose,
  consumeSkipIntroduceOverlay,
  requestForumCompose,
  type ForumFeedMode,
} from '@/lib/forum-feed';
import type { ForumPhotoPayload } from '@/lib/forum-photo';
import { formatForumTime } from '@/lib/forum-time';
import type { ForumVideoPayload } from '@/lib/forum-video';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';
import { walletOfSatoshiHref } from '@/lib/wos-deep-link';

const push = vi.fn();

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    onClick,
    ...rest
  }: {
    href: string;
    children: ReactNode;
    onClick?: (event: { stopPropagation: () => void }) => void;
  }) => (
    <a href={href} onClick={onClick} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock('next/navigation', () => ({
  useRouter: (): { push: typeof push; replace: typeof push } => ({ push, replace: push }),
}));
vi.mock('@/lib/api', () => ({
  fetchPublicMessage: vi.fn().mockResolvedValue(null),
  fetchPublicMessagePhoto: vi.fn().mockRejectedValue(new Error('no photo')),
  setMessagePlace: vi.fn(),
}));

import { fetchPublicMessage } from '@/lib/api';

const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
const originalUserAgent = navigator.userAgent;
const locationAssign = vi.fn();
const locationStub = { assign: locationAssign, href: 'http://localhost/' };

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)';
const ANDROID_MOBILE_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

beforeEach(() => {
  push.mockClear();
  consumePendingForumCompose();
  consumeSkipIntroduceOverlay();
  HTMLElement.prototype.scrollIntoView = vi.fn();
  locationAssign.mockReset();
  locationStub.href = 'http://localhost/';
  vi.stubGlobal('location', locationStub);
});

afterEach(() => {
  cleanup();
  useAuthStore.getState().clearAuth();
  HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  Object.defineProperty(navigator, 'userAgent', {
    configurable: true,
    value: originalUserAgent,
  });
  vi.unstubAllGlobals();
});

const SAMPLE: ForumMessage = {
  id: 'm1',
  name: 'Ada',
  text: 'Hello from Ada',
  createdAt: '2026-08-28T12:00:00.000Z',
  sats: 0,
  payable: true,
  hasPhoto: false,
  photoCount: 0,
  hasVideo: false,
  videoContentType: null,
  role: 'basis',
  replyCount: 0,
};

const MULTILINE: ForumMessage = {
  id: 'm2',
  name: 'Bob',
  text: 'Line one\nLine two',
  createdAt: '2026-08-28T13:00:00.000Z',
  sats: 21,
  payable: false,
  hasPhoto: false,
  photoCount: 0,
  hasVideo: false,
  videoContentType: null,
  role: 'basis',
  replyCount: 0,
};

const FIVE_SATS: ForumMessage = {
  id: 'm5',
  name: 'Ada',
  text: 'Five sats note',
  createdAt: '2026-08-28T14:00:00.000Z',
  sats: 5,
  payable: true,
  hasPhoto: false,
  photoCount: 0,
  hasVideo: false,
  videoContentType: null,
  role: 'basis',
  replyCount: 0,
};

const PHOTO: ForumPhotoPayload = {
  contentType: 'image/jpeg',
  data: 'abc',
  previewUrl: 'data:image/jpeg;base64,abc',
};

const PHOTO2: ForumPhotoPayload = {
  contentType: 'image/jpeg',
  data: 'def',
  previewUrl: 'data:image/jpeg;base64,def',
};

const VIDEO: ForumVideoPayload = {
  file: new File([], 'c.mp4'),
  poster: new Blob(),
  previewUrl: 'blob:v',
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
  | 'photoDrafts'
  | 'onPickFiles'
  | 'onRemovePhoto'
  | 'onClearPhoto'
  | 'photoUrls'
  | 'videoUrls'
  | 'expandedId'
  | 'onToggleExpand'
  | 'replies'
  | 'repliesLoading'
  | 'repliesError'
  | 'onRetryReplies'
  | 'replyDraft'
  | 'onReplyDraftChange'
  | 'onReplyPost'
  | 'replyPosting'
  | 'replyFormError'
  | 'askDraft'
  | 'onAskDraftChange'
  | 'onPlaceDraftChange'
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
  photoDrafts: [],
  onPickFiles: () => undefined,
  onRemovePhoto: () => undefined,
  onClearPhoto: () => undefined,
  photoUrls: {},
  videoUrls: {},
  expandedId: null,
  onToggleExpand: () => undefined,
  replies: null,
  repliesLoading: false,
  repliesError: false,
  onRetryReplies: () => undefined,
  replyDraft: '',
  onReplyDraftChange: () => undefined,
  onReplyPost: () => undefined,
  replyPosting: false,
  replyFormError: null,
  askDraft: '',
  onAskDraftChange: () => undefined,
  onPlaceDraftChange: () => undefined,
};

function modeProps(
  mode: ForumFeedMode = 'all',
  onModeChange: (next: ForumFeedMode) => void = () => undefined,
): Pick<ForumBoardProps, 'mode' | 'onModeChange'> {
  return { mode, onModeChange };
}

describe('ForumBoard', () => {
  it('passes stored marks on a note and on a reaction', () => {
    const marks = [{ username: 'bob', accountId: 'acc-bob' }];
    renderWithLocale(
      <ForumBoard
        messages={[
          {
            ...SAMPLE,
            accountId: 'acc-ada',
            mentions: marks,
            text: 'hi @bob',
          },
          {
            ...SAMPLE,
            id: 'm-nostr',
            via: 'nostr',
            accountId: 'acc-ada',
            mentions: marks,
            text: 'nostr @bob',
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
        expandedId="m1"
        replies={[
          {
            ...SAMPLE,
            id: 'r1',
            accountId: 'acc-bob',
            mentions: marks,
            text: 'reply @bob',
          },
          {
            ...SAMPLE,
            id: 'r2',
            via: 'nostr',
            accountId: 'acc-bob',
            mentions: marks,
            text: 'nostr reply @bob',
          },
        ]}
        {...modeProps('all')}
      />,
    );
    expect(screen.getAllByRole('button', { name: 'View profile' }).length).toBeGreaterThan(0);
    expect(document.body.textContent).toContain('nostr @bob');
    expect(document.body.textContent).toContain('nostr reply @bob');
  });

  it('collapses a long note behind Show more without toggling replies', () => {
    const onToggleExpand = vi.fn();
    const text = `${'a'.repeat(280)} TAILWORD`;
    renderWithLocale(
      <ForumBoard
        messages={[{ ...SAMPLE, text }]}
        error={false}
        loading={false}
        posting={false}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        onRetry={() => undefined}
        formError={null}
        {...idleProps}
        onToggleExpand={onToggleExpand}
        {...modeProps('all')}
      />,
    );
    const showMore = screen.getByRole('button', { name: 'Show more' });
    expect(showMore).toBeTruthy();
    expect(screen.queryByText(/TAILWORD/)).toBeNull();
    fireEvent.click(showMore);
    expect(onToggleExpand).not.toHaveBeenCalled();
    expect(screen.getByText(/TAILWORD/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
  });

  it('collapses a long reply behind Show more without toggling the parent', () => {
    const onToggleExpand = vi.fn();
    const text = `${'a'.repeat(280)} TAILWORD`;
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
        expandedId="m1"
        onToggleExpand={onToggleExpand}
        replies={[{ ...SAMPLE, id: 'r1', name: 'Bob', text, sats: 0, payable: false }]}
        {...modeProps('all')}
      />,
    );
    const showMore = screen.getByRole('button', { name: 'Show more' });
    expect(screen.queryByText(/TAILWORD/)).toBeNull();
    fireEvent.click(showMore);
    expect(onToggleExpand).not.toHaveBeenCalled();
    expect(screen.getByText(/TAILWORD/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
  });

  it('links a top-level note to the map and ignores a reply pin', () => {
    renderWithLocale(
      <ForumBoard
        messages={[
          { ...SAMPLE, place: { lat: 14.6, lng: 120.98, label: 'Happyland' } },
          { ...SAMPLE, id: 'm-coords', text: 'Coords', place: { lat: 1, lng: 2, label: null } },
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
        expandedId="m1"
        replies={[
          {
            ...SAMPLE,
            id: 'r1',
            parentId: 'm1',
            name: 'Bob',
            text: 'Reply',
            sats: 0,
            payable: false,
            place: { lat: 3, lng: 4, label: 'Stall' },
          },
          {
            ...SAMPLE,
            id: 'r2',
            parentId: 'm1',
            name: 'Cara',
            text: 'Reply two',
            sats: 0,
            payable: false,
            place: { lat: 5, lng: 6, label: null },
          },
        ]}
        {...modeProps('all')}
      />,
    );
    const labeled = screen.getByRole('link', { name: 'Happyland' });
    expect(labeled.getAttribute('href')).toBe('/map?pin=m1');
    fireEvent.click(labeled);
    expect(screen.getByRole('link', { name: '1.00000, 2.00000' }).getAttribute('href')).toBe(
      '/map?pin=m-coords',
    );
    expect(screen.queryByRole('link', { name: 'Stall' })).toBeNull();
    expect(screen.queryByRole('link', { name: '5.00000, 6.00000' })).toBeNull();
  });

  it('keeps a long note full when truncate is off', () => {
    const text = `${'a'.repeat(280)} TAILWORD`;
    renderWithLocale(
      <ForumBoard
        messages={[{ ...SAMPLE, text }]}
        error={false}
        loading={false}
        posting={false}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        onRetry={() => undefined}
        formError={null}
        {...idleProps}
        truncate={false}
        {...modeProps('all')}
      />,
    );
    expect(screen.getByText(/TAILWORD/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
  });

  it('keeps a long reply full when truncate is off', () => {
    const text = `${'a'.repeat(280)} TAILWORD`;
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
        expandedId="m1"
        replies={[{ ...SAMPLE, id: 'r1', name: 'Bob', text, sats: 0, payable: false }]}
        truncate={false}
        {...modeProps('all')}
      />,
    );
    expect(screen.getByText(/TAILWORD/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
  });

  it('mounts the New posts pill only while unseen posts are available', () => {
    const onShowNewPosts = vi.fn();
    const { rerender } = renderWithLocale(
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
    expect(screen.queryByText('New posts')).toBeNull();

    rerender(
      <LocaleProvider locale="en" messages={getCatalog('en')}>
        <ThemeProvider>
          <ForumBoard
            messages={[SAMPLE]}
            error={false}
            loading={false}
            newPostsAvailable
            onShowNewPosts={onShowNewPosts}
            posting={false}
            draft=""
            onDraftChange={() => undefined}
            onPost={() => undefined}
            onRetry={() => undefined}
            formError={null}
            {...idleProps}
            {...modeProps('all')}
          />
        </ThemeProvider>
      </LocaleProvider>,
    );
    const button = screen.getByRole('button', { name: 'New posts' });
    expect(button.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    fireEvent.click(button);
    expect(onShowNewPosts).toHaveBeenCalledTimes(1);
  });

  it('mounts the moderator-appointed pill only while the flag is true', () => {
    const onShowModeratorAppointed = vi.fn();
    const { rerender } = renderWithLocale(
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
    expect(screen.queryByRole('button', { name: 'You are a moderator' })).toBeNull();

    rerender(
      <LocaleProvider locale="en" messages={getCatalog('en')}>
        <ThemeProvider>
          <ForumBoard
            messages={[SAMPLE]}
            error={false}
            loading={false}
            moderatorAppointedAvailable
            onShowModeratorAppointed={onShowModeratorAppointed}
            posting={false}
            draft=""
            onDraftChange={() => undefined}
            onPost={() => undefined}
            onRetry={() => undefined}
            formError={null}
            {...idleProps}
            {...modeProps('all')}
          />
        </ThemeProvider>
      </LocaleProvider>,
    );
    const button = screen.getByRole('button', { name: 'You are a moderator' });
    fireEvent.click(button);
    expect(onShowModeratorAppointed).toHaveBeenCalledTimes(1);
  });

  it('stacks the moderator-appointed pill with New posts when both flags are true', () => {
    renderWithLocale(
      <ForumBoard
        messages={[SAMPLE]}
        error={false}
        loading={false}
        newPostsAvailable
        onShowNewPosts={() => undefined}
        moderatorAppointedAvailable
        onShowModeratorAppointed={() => undefined}
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
    expect(screen.getByRole('button', { name: 'You are a moderator' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'New posts' })).toBeTruthy();
  });

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
    expect(screen.getByRole('combobox', { name: 'Forum view' })).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Forum view' })).toBeNull();
    expect(screen.getByRole('combobox', { name: 'Forum view' }).textContent).toContain('Active');
    expect(screen.queryByText('Everyone can read and write.')).toBeNull();
    expect(
      screen.getByText(
        '21.gifts is a donation platform: gifts are free, and nobody pays for a promise.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('Donors are rare — no begging, no drama, no pressure.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Living room rules' }).getAttribute('href')).toBe(
      '/rules',
    );
    expect(screen.getByRole('link', { name: 'Contact' }).getAttribute('href')).toBe('/contact');
    expect(screen.getByRole('button', { name: 'Add a photo or video' })).toBeTruthy();
    expect(screen.queryByText('Add a photo or video')).toBeNull();
    expect(screen.getByLabelText('Your message')).toBeTruthy();
    expect(screen.getByPlaceholderText('Write a message')).toBeTruthy();
    const field = screen.getByLabelText('Your message');
    const button = screen.getByRole('button', { name: /^Post$/ });
    expect(button).toBeTruthy();
    expect(button.textContent?.trim()).toBe('');
    expect(screen.getByLabelText('Add a photo or video').textContent?.trim()).toBe('');
    expect(field.nextElementSibling).toBe(button);
    const photo = screen.getByLabelText('Add a photo or video');
    const place = screen.getByLabelText('Add a place');
    expect(screen.queryByText('Add a place')).toBeNull();
    expect(photo.compareDocumentPosition(place) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(place.compareDocumentPosition(field) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(field.getAttribute('maxLength')).toBe(String(FORUM_MESSAGE_MAX_LENGTH));
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeTruthy();
    expect(screen.queryByText('Dismiss')).toBeNull();
  });

  it('omits the place control when the board cannot store a pin', () => {
    const { onPlaceDraftChange, ...withoutPlace } = idleProps;
    expect(onPlaceDraftChange).toBeTypeOf('function');
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
        {...withoutPlace}
        {...modeProps('all')}
      />,
    );
    expect(screen.queryByLabelText('Add a place')).toBeNull();
  });

  it('sets the new-post textarea maxLength from composerMaxLength', () => {
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
        composerMaxLength={FORUM_MESSAGE_MAX_LENGTH - 14}
        {...idleProps}
        {...modeProps('active')}
      />,
    );
    expect(screen.getByLabelText('Your message').getAttribute('maxLength')).toBe(
      String(FORUM_MESSAGE_MAX_LENGTH - 14),
    );
  });

  it('hides the composer and mode control when composerHidden', () => {
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
        composerHidden
        {...idleProps}
        {...modeProps('active')}
      />,
    );
    expect(screen.queryByRole('combobox', { name: 'Forum view' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'All' })).toBeNull();
    expect(document.querySelector('form')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ask for money' })).toBeNull();
  });

  it('shows the Post/Ask pill when the composer is visible', () => {
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
    expect(screen.getByRole('button', { name: 'Send a post' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ask for money' })).toBeTruthy();
    expect(screen.queryByText('How much?')).toBeNull();
  });

  it('opens the Ask wizard from the pill', () => {
    const onComposeIntentChange = vi.fn();
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
        composeIntent="post"
        onComposeIntentChange={onComposeIntentChange}
        {...idleProps}
        {...modeProps('active')}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Ask for money' }));
    expect(onComposeIntentChange).toHaveBeenCalledWith('ask');
  });

  it('hides Ask for money when allowAsk is false', () => {
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
        allowAsk={false}
        composeIntent="ask"
        {...idleProps}
        {...modeProps('active')}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Ask for money' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Send a post' })).toBeNull();
    expect(screen.queryByText('How much?')).toBeNull();
    expect(document.querySelector('form')).not.toBeNull();
  });

  it('shows How much? when composeIntent is ask', () => {
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
        composeIntent="ask"
        askStep={1}
        {...idleProps}
        {...modeProps('active')}
      />,
    );
    expect(screen.getByText('How much?')).toBeTruthy();
    expect(screen.getByLabelText('Ask')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Daily' }));
  });

  it('hides the Ask field when composerHidden', () => {
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
        composerHidden
        {...idleProps}
        {...modeProps('active')}
      />,
    );
    expect(screen.queryByLabelText('Ask')).toBeNull();
  });

  it('omits the mode selector and lists a zero-sat basis note when modeSelector is false', () => {
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
        modeSelector={false}
      />,
    );
    expect(screen.getByText('Hello from Ada')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Post' })).toBeTruthy();
    expect(screen.getByLabelText('Your message')).toBeTruthy();
    expect(screen.queryByRole('combobox', { name: 'Forum view' })).toBeNull();
    expect(screen.queryByRole('group', { name: 'Forum view' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Active$/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^No gifts yet$/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^All$/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Most popular$/ })).toBeNull();
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
    expect(screen.getByRole('combobox', { name: 'Forum view' })).toBeTruthy();
    expect(
      screen.queryByText(
        '21.gifts is a donation platform: gifts are free, and nobody pays for a promise.',
      ),
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
    expect(screen.getByRole('combobox', { name: 'Forum view' })).toBeTruthy();
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
    expect(screen.getByRole('combobox', { name: 'Forum view' })).toBeTruthy();
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toBe('Could not load messages. Please try again.');
    expect(alert.className).toContain('text-app-danger');
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
      screen.getByText('Nachrichten konnten nicht geladen werden. Bitte versuchen Sie es erneut.'),
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
    expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    expect(screen.queryByText('No message has received Bitcoin yet.')).toBeNull();
    expect(screen.getByRole('combobox', { name: 'Forum view' })).toBeTruthy();
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

  it('shows unpaid moderator notes on Active and hides unpaid verified', () => {
    const unpaidFounder: ForumMessage = {
      ...SAMPLE,
      id: 'm-founder-unpaid',
      name: 'Eve',
      text: 'Unpaid founder welcome note',
      role: 'founder',
    };
    const unpaidModerator: ForumMessage = {
      ...SAMPLE,
      id: 'm-mod-unpaid',
      name: 'Dan',
      text: 'Unpaid moderator welcome note',
      role: 'moderator',
    };
    const unpaidVerified: ForumMessage = {
      ...SAMPLE,
      id: 'm-ver-unpaid',
      name: 'Fay',
      text: 'Unpaid verified welcome note',
      role: 'verified',
    };
    renderWithLocale(
      <ForumBoard
        messages={[unpaidFounder, unpaidModerator, unpaidVerified]}
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
    expect(screen.getByText('Unpaid founder welcome note')).toBeTruthy();
    expect(screen.getByText('Unpaid moderator welcome note')).toBeTruthy();
    expect(screen.queryByText('Unpaid verified welcome note')).toBeNull();
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
    expect(screen.getByText('No message has received Bitcoin yet.')).toBeTruthy();
    expect(screen.queryByText('No messages yet — be the first to write one.')).toBeNull();
  });

  it('shows the specific empty state when no zero-sat notes remain', () => {
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
        {...modeProps('unpaid')}
      />,
    );
    expect(screen.getByText('Every loaded message has already received Bitcoin.')).toBeTruthy();
    expect(screen.queryByText('No messages yet — be the first to write one.')).toBeNull();
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
    expect(screen.getByText('₿0')).toBeTruthy();
    expect(screen.getByText('₿21')).toBeTruthy();
    expect(screen.getByText('₿21').closest('button')?.className).toContain('font-medium');
    expect(screen.queryByText('$0.02')).toBeNull();
    expect(screen.getByText(formatForumTime(SAMPLE.createdAt, 'en'))).toBeTruthy();
    const preWrap = screen.getByText(
      (content) => content.includes('Line one') && content.includes('Line two'),
    );
    expect(preWrap.closest('p')?.className).toContain('whitespace-pre-wrap');
  });

  it('renders newest-first props with newest listitem at the top', () => {
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
    expect(items[0]!.textContent).toContain('Bob');
    expect(items[0]!.textContent).toContain('Line one');
    expect(items[1]!.textContent).toContain('Ada');
    expect(items[1]!.textContent).toContain('Hello from Ada');
    const composer = screen.getByLabelText('Your message');
    expect(composer.compareDocumentPosition(items[0]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('attaches nearEndRef to the eighth visible note from the end', () => {
    const messages = Array.from({ length: 10 }, (_, index) => ({
      ...SAMPLE,
      id: `m${index + 1}`,
      text: `Message ${index + 1}`,
    }));
    const nearEndRef = vi.fn((node: HTMLLIElement | null): void => {
      void node;
    });
    renderWithLocale(
      <ForumBoard
        messages={messages}
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
        nearEndRef={nearEndRef}
      />,
    );

    expect(nearEndRef).toHaveBeenCalledWith(document.querySelector('[data-message-id="m3"]'));
  });

  it('attaches nearEndRef to the first visible note when fewer than eight render', () => {
    const nearEndRef = vi.fn((node: HTMLLIElement | null): void => {
      void node;
    });
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
        nearEndRef={nearEndRef}
      />,
    );

    expect(nearEndRef).toHaveBeenCalledWith(document.querySelector('[data-message-id="m1"]'));
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
    expect(items[0]?.textContent).toContain('₿21');
    expect(items[1]?.textContent).toContain('Five sats note');
    expect(items[1]?.textContent).toContain('₿5');
  });

  it('does not scroll when messages are empty', () => {
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
    expect(screen.getByRole('combobox', { name: 'Forum-Ansicht' }).textContent).toContain('Aktiv');
    fireEvent.click(screen.getByRole('combobox', { name: 'Forum-Ansicht' }));
    expect(screen.getByRole('option', { name: 'Aktiv' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Alle' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Beliebteste' })).toBeTruthy();
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
    fireEvent.click(screen.getByRole('combobox', { name: 'Forum view' }));
    fireEvent.click(screen.getByRole('option', { name: 'All' }));
    expect(onModeChange).toHaveBeenCalledWith('all');
  });

  it('keeps No gifts yet unbadged by default', () => {
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
    expect(screen.getByRole('combobox', { name: 'Forum view' }).textContent).toContain('Active');
    expect(screen.getByRole('combobox', { name: 'Forum view' }).textContent).not.toMatch(/\d/);
    fireEvent.click(screen.getByRole('combobox', { name: 'Forum view' }));
    expect(screen.getByRole('option', { name: /^No gifts yet$/ })).toBeTruthy();
  });

  it('keeps No gifts yet unbadged when unpaidNewCount is 0', () => {
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
        unpaidNewCount={0}
      />,
    );
    expect(screen.getByRole('combobox', { name: 'Forum view' }).textContent).toContain('Active');
    expect(screen.getByRole('combobox', { name: 'Forum view' }).textContent).not.toMatch(/\d/);
    fireEvent.click(screen.getByRole('combobox', { name: 'Forum view' }));
    expect(screen.getByRole('option', { name: /^No gifts yet$/ })).toBeTruthy();
  });

  it('omits the unpaid chip when No gifts yet is selected', () => {
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
        {...modeProps('unpaid')}
        unpaidNewCount={3}
      />,
    );
    const trigger = screen.getByRole('combobox', { name: 'Forum view' });
    expect(trigger.textContent).toContain('No gifts yet');
    expect(trigger.textContent).not.toContain('3');
    fireEvent.click(trigger);
    const unpaid = screen.getByRole('option', { name: /^No gifts yet$/ });
    expect(unpaid.getAttribute('aria-selected')).toBe('true');
    expect(unpaid.textContent).not.toContain('3');
  });

  it('shows a No gifts yet chip when unpaidNewCount is 3 and Active is selected', () => {
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
        unpaidNewCount={3}
      />,
    );
    const trigger = screen.getByRole('combobox', { name: 'Forum view' });
    expect(trigger.textContent).toContain('Active');
    expect(trigger.textContent).toContain('3');
    expect(screen.getByText('3')).toBeTruthy();
    fireEvent.click(trigger);
    expect(screen.getByRole('option', { name: 'No gifts yet, 3 new' })).toBeTruthy();
  });

  it('localizes the unpaid new-count chip in German', () => {
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
        unpaidNewCount={3}
      />,
      'de',
    );
    expect(screen.getByRole('combobox', { name: 'Forum-Ansicht' }).textContent).toContain('3');
    fireEvent.click(screen.getByRole('combobox', { name: 'Forum-Ansicht' }));
    expect(screen.getByRole('option', { name: 'Noch ohne Geschenk, 3 neu' })).toBeTruthy();
  });

  it('shows ₿1 for a single sat total', () => {
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
    expect(screen.getByText('₿1')).toBeTruthy();
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
            photoCount: 1,
            hasVideo: false,
            videoContentType: null,
            role: 'basis',
            replyCount: 0,
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
        photoUrls={{ 'm-photo:0': 'blob:photo' }}
        {...modeProps('all')}
      />,
    );
    expect(document.querySelector('p.whitespace-pre-wrap')).toBeNull();
    expect(screen.getByAltText('Photo from Ada').getAttribute('src')).toBe('blob:photo');
    expect(screen.getByAltText('Photo from Ada').className.split(/\s+/)).toEqual(
      expect.arrayContaining([
        'block',
        'h-auto',
        'max-h-80',
        'w-full',
        'shrink-0',
        'rounded-xl',
        'object-contain',
      ]),
    );
    expect(screen.getByRole('listitem').getAttribute('data-message-id')).toBe('m-photo');
  });

  it('renders a horizontal snap gallery when photoCount is greater than one', () => {
    renderWithLocale(
      <ForumBoard
        messages={[
          {
            id: 'm-gallery',
            name: 'Ada',
            text: '',
            createdAt: '2026-08-28T12:00:00.000Z',
            sats: 0,
            payable: false,
            hasPhoto: true,
            photoCount: 2,
            hasVideo: false,
            videoContentType: null,
            role: 'basis',
            replyCount: 0,
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
        photoUrls={{ 'm-gallery:0': 'blob:g0', 'm-gallery:1': 'blob:g1' }}
        {...modeProps('all')}
      />,
    );
    const photos = screen.getAllByAltText('Photo from Ada');
    expect(photos).toHaveLength(2);
    expect(photos[0]?.getAttribute('data-photo-index')).toBe('0');
    expect(photos[1]?.getAttribute('data-photo-index')).toBe('1');
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

  it('renders omitted photoCount as a photo or as text depending on hasPhoto', () => {
    renderWithLocale(
      <ForumBoard
        messages={[
          {
            ...SAMPLE,
            id: 'm-omit-photo',
            hasPhoto: true,
            text: '',
            photoCount: undefined as unknown as number,
          },
          {
            ...SAMPLE,
            id: 'm-omit-none',
            hasPhoto: false,
            photoCount: undefined as unknown as number,
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
        photoUrls={{ 'm-omit-photo:0': 'blob:photo' }}
        {...modeProps('all')}
      />,
    );
    expect(screen.getByAltText('Photo from Ada').getAttribute('src')).toBe('blob:photo');
    expect(screen.getByText('Hello from Ada')).toBeTruthy();
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
            photoCount: 1,
            hasVideo: false,
            videoContentType: null,
            role: 'basis',
            replyCount: 0,
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
        photoUrls={{ 'm-photo:0': 'blob:photo' }}
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
            photoCount: 1,
            hasVideo: false,
            videoContentType: null,
            role: 'basis',
            replyCount: 0,
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
        photoUrls={{ 'm-both:0': 'blob:photo' }}
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

  it('opens pay when Send Bitcoin is clicked on a payable nested reply', () => {
    const onPayOpen = vi.fn();
    const onToggleExpand = vi.fn();
    const payableReply: ForumMessage = {
      id: 'r-pay',
      name: 'Bob',
      text: 'A payable reply',
      createdAt: '2026-08-28T12:30:00.000Z',
      sats: 0,
      payable: true,
      hasPhoto: false,
      photoCount: 0,
      hasVideo: false,
      videoContentType: null,
      role: 'basis',
      replyCount: 0,
    };
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
        expandedId="m1"
        replies={[payableReply]}
        onPayOpen={onPayOpen}
        onToggleExpand={onToggleExpand}
        {...modeProps('all')}
      />,
    );
    const replyCard = document.querySelector('[data-reply-id="r-pay"]') as HTMLElement;
    expect(replyCard).not.toBeNull();
    expect(screen.getAllByRole('button', { name: 'Send Bitcoin' })).toHaveLength(1);
    expect(within(replyCard).getByRole('button', { name: 'Send Bitcoin' })).toBeTruthy();
    expect(screen.queryByText('Send Bitcoin')).toBeNull();
    fireEvent.click(within(replyCard).getByRole('button', { name: 'Send Bitcoin' }));
    expect(onPayOpen).toHaveBeenCalledWith('r-pay');
    expect(onToggleExpand).not.toHaveBeenCalled();
    expect(screen.queryByText('Send Bitcoin')).toBeNull();
  });

  it('opens pay when Send Bitcoin is clicked on a payable reply card', () => {
    const onPayOpen = vi.fn();
    const onToggleExpand = vi.fn();
    renderWithLocale(
      <ForumBoard
        messages={[{ ...SAMPLE, parentId: 'p1' }]}
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
        onToggleExpand={onToggleExpand}
        {...modeProps('all')}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Send Bitcoin' }));
    expect(onPayOpen).toHaveBeenCalledWith('m1');
    expect(onToggleExpand).not.toHaveBeenCalled();
  });

  it('shows a photo draft preview and removes it by index', () => {
    const onRemovePhoto = vi.fn();
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
        photoDrafts={[PHOTO]}
        onRemovePhoto={onRemovePhoto}
        {...modeProps('active')}
      />,
    );
    expect(screen.getByAltText('Selected photo')).toBeTruthy();
    const remove = screen.getByRole('button', { name: 'Remove photo' });
    expect(remove.textContent?.trim()).toBe('');
    fireEvent.click(remove);
    expect(onRemovePhoto).toHaveBeenCalledWith(0);
  });

  it('renders every selected photo draft', () => {
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
        photoDrafts={[PHOTO, PHOTO2]}
        {...modeProps('active')}
      />,
    );
    const previews = screen.getAllByAltText('Selected photo');
    expect(previews).toHaveLength(2);
    expect(previews[0]?.getAttribute('src')).toBe(PHOTO.previewUrl);
    expect(previews[1]?.getAttribute('src')).toBe(PHOTO2.previewUrl);
  });

  it('removes a gallery photo draft by index', () => {
    const onRemovePhoto = vi.fn();
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
        photoDrafts={[PHOTO, PHOTO2]}
        onRemovePhoto={onRemovePhoto}
        {...modeProps('active')}
      />,
    );
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove photo' })[1]!);
    expect(onRemovePhoto).toHaveBeenCalledWith(1);
  });

  it('shows a video draft preview and clear control', () => {
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
        videoDraft={VIDEO}
        onClearPhoto={onClearPhoto}
        {...modeProps('active')}
      />,
    );
    const preview = document.querySelector('form video');
    expect(preview?.getAttribute('src')).toBe('blob:v');
    expect(screen.queryByRole('button', { name: 'Full screen' })).toBeNull();
    expect(preview?.hasAttribute('playsinline')).toBe(true);
    expect(preview?.getAttribute('preload')).toBe('metadata');
    const remove = screen.getByRole('button', { name: 'Remove video' });
    expect(remove.textContent?.trim()).toBe('');
    expect(screen.queryByText('Remove video')).toBeNull();
    fireEvent.click(remove);
    expect(onClearPhoto).toHaveBeenCalledTimes(1);
  });

  it('calls onPickFiles with every chosen file', () => {
    const onPickFiles = vi.fn();
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
        onPickFiles={onPickFiles}
        {...modeProps('active')}
      />,
    );
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input.hasAttribute('multiple')).toBe(true);
    const clickSpy = vi.spyOn(input, 'click').mockImplementation(() => undefined);
    fireEvent.click(screen.getByLabelText('Add a photo or video'));
    expect(clickSpy).toHaveBeenCalled();
    const first = new File([new Uint8Array([1])], 'a.jpg', { type: 'image/jpeg' });
    const second = new File([new Uint8Array([2])], 'b.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [first, second] } });
    expect(onPickFiles).toHaveBeenCalledWith([first, second]);
    fireEvent.change(input, { target: { files: [] } });
    expect(onPickFiles).toHaveBeenCalledTimes(1);
  });

  it('renders the amount sheet and submits pay', async () => {
    const onPaySubmit = vi.fn().mockResolvedValue({
      messageId: 'm1',
      pr: 'lnbc21n1example',
      amountSats: 21,
    });
    const onPayDraftChange = vi.fn();
    const onPayCancel = vi.fn();
    renderWithLocale(
      <ForumBoard
        messages={[{ ...SAMPLE, parentId: 'p1' }]}
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
    expect(screen.getByLabelText('Amount')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '42' } });
    expect(onPayDraftChange).toHaveBeenCalledWith('42');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onPaySubmit).toHaveBeenCalledTimes(1);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(locationAssign).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.queryByText('Back')).toBeNull();
    expect(onPayCancel).toHaveBeenCalledTimes(1);
  });

  it('shows a composer pay sheet when the invoice target is not a listed card', () => {
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
        {...modeProps('all')}
        payMessageId="fee-note"
        payInvoice={{ messageId: 'fee-note', pr: 'lnbc1', amountSats: 1 }}
        payWaiting
        replies={[{ ...SAMPLE, id: 'r1' }]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Pay with Wallet of Satoshi' }));
    expect(screen.getByRole('button', { name: 'Pay with Wallet of Satoshi' })).toBeTruthy();
  });

  it('shows a composer pay sheet when the fee note is hidden on Active', () => {
    renderWithLocale(
      <ForumBoard
        messages={[{ ...SAMPLE, id: 'fee-note', sats: 0 }]}
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
        payMessageId="fee-note"
        payInvoice={{ messageId: 'fee-note', pr: 'lnbc1', amountSats: 1 }}
        payWaiting
      />,
    );
    expect(screen.getByRole('button', { name: 'Pay with Wallet of Satoshi' })).toBeTruthy();
  });

  it('keeps the composer pay sheet when payHost is composer and the fee note is listed', () => {
    renderWithLocale(
      <ForumBoard
        messages={[{ ...SAMPLE, id: 'fee-note', sats: 1, name: '21.gifts' }]}
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
        payMessageId="fee-note"
        payHost="composer"
        payInvoice={{ messageId: 'fee-note', pr: 'lnbc1', amountSats: 1 }}
        payWaiting
      />,
    );
    expect(screen.getByRole('button', { name: 'Pay with Wallet of Satoshi' })).toBeTruthy();
    expect(document.querySelector('[data-message-id="fee-note"]')).not.toBeNull();
  });

  it('does not duplicate the composer pay sheet when the target is a loaded reply', () => {
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
        payMessageId="r1"
        payInvoice={{ messageId: 'r1', pr: 'lnbc1', amountSats: 1 }}
        payWaiting
        replies={[{ ...SAMPLE, id: 'r1', parentId: SAMPLE.id }]}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Pay with Wallet of Satoshi' })).toBeNull();
  });

  it('labels the iPhone amount CTA Continue in English and Weiter in German', () => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: IPHONE_UA,
    });
    const { unmount } = renderWithLocale(
      <ForumBoard
        messages={[{ ...SAMPLE, parentId: 'p1' }]}
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
        {...modeProps('all')}
      />,
    );
    expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Pay' })).toBeNull();
    unmount();
    renderWithLocale(
      <ForumBoard
        messages={[{ ...SAMPLE, parentId: 'p1' }]}
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
        {...modeProps('all')}
      />,
      'de',
    );
    expect(screen.getByRole('button', { name: 'Weiter' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Bezahlen' })).toBeNull();
  });

  it('does not assign the wallet href on iPhone after Continue', async () => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: IPHONE_UA,
    });
    const onPaySubmit = vi.fn().mockResolvedValue({
      messageId: 'm1',
      pr: 'lnbc21n1example',
      amountSats: 21,
    });
    renderWithLocale(
      <ForumBoard
        messages={[{ ...SAMPLE, parentId: 'p1' }]}
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
        onPaySubmit={onPaySubmit}
        {...modeProps('all')}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(onPaySubmit).toHaveBeenCalledTimes(1);
    expect(locationAssign).not.toHaveBeenCalled();
    expect(locationStub.href).toBe('http://localhost/');
  });

  it('shows a live CHF equivalent on the German pay sheet without a picker', () => {
    renderWithLocale(
      <ForumBoard
        messages={[{ ...SAMPLE, parentId: 'p1' }]}
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
        rateDay={{
          sats: 100_000_000,
          usd: '100000.00',
          chf: '80000.00',
          eur: '90000.00',
          php: '5600000.00',
        }}
        {...modeProps('all')}
      />,
      'de',
    );
    expect(screen.queryByRole('group', { name: 'Fiatwährung' })).toBeNull();
    expect(screen.getAllByText('CHF 0.02').length).toBeGreaterThan(0);
  });

  it('keeps Continue on Android Mobile and does not auto-open the wallet', async () => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: ANDROID_MOBILE_UA,
    });
    const onPaySubmit = vi.fn().mockResolvedValue({
      messageId: 'm1',
      pr: 'lnbc21n1example',
      amountSats: 21,
    });
    renderWithLocale(
      <ForumBoard
        messages={[{ ...SAMPLE, parentId: 'p1' }]}
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
        onPaySubmit={onPaySubmit}
        {...modeProps('all')}
      />,
    );
    expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Pay' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(onPaySubmit).toHaveBeenCalledTimes(1);
    expect(locationAssign).not.toHaveBeenCalled();
    expect(locationStub.href).toBe('http://localhost/');
  });

  it('keeps ₿-only when the preferred fiat has no rate on that gift day', () => {
    renderWithLocale(
      <ForumBoard
        messages={[FIVE_SATS]}
        error={false}
        loading={false}
        posting={false}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        onRetry={() => undefined}
        formError={null}
        {...idleProps}
        rateDay={{
          sats: 100_000_000,
          usd: '100000.00',
          chf: null,
          eur: '90000.00',
          php: '5600000.00',
        }}
        {...modeProps('all')}
      />,
      'de',
    );
    expect(screen.getByText('₿5')).toBeTruthy();
    expect(screen.queryByText('—')).toBeNull();
    expect(screen.queryByText(/CHF/)).toBeNull();
  });

  it('shows pay amount error', () => {
    renderWithLocale(
      <ForumBoard
        messages={[{ ...SAMPLE, parentId: 'p1' }]}
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
    expect(screen.getByRole('alert').textContent).toBe('Enter a whole number greater than zero');
  });

  it('shows pay request error', () => {
    renderWithLocale(
      <ForumBoard
        messages={[{ ...SAMPLE, parentId: 'p1' }]}
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
        messages={[{ ...SAMPLE, parentId: 'p1' }]}
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

  it('shows pay author-wallet error', () => {
    renderWithLocale(
      <ForumBoard
        messages={[{ ...SAMPLE, parentId: 'p1' }]}
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
        payError="authorWallet"
        {...modeProps('all')}
      />,
    );
    expect(screen.getByRole('alert').textContent).toBe(
      "The author's wallet cannot receive this Bitcoin payment",
    );
  });

  it('shows the invoice QR and wallet button', async () => {
    const onPayCancel = vi.fn();
    renderWithLocale(
      <ForumBoard
        messages={[{ ...SAMPLE, parentId: 'p1' }]}
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
    expect(screen.getByText('Pay ₿21')).toBeTruthy();
    expect(await screen.findByRole('img', { name: 'Bitcoin payment QR code' })).toBeTruthy();
    const walletButton = screen.getByRole('button', { name: 'Pay with Wallet of Satoshi' });
    expect(walletButton.textContent).toContain('Pay');
    expect(walletButton.querySelector('img[src="/wos-icon.png"]')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
    expect(screen.queryByText('Back')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onPayCancel).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Waiting for payment…')).toBeTruthy();
  });

  it('shows a fiat equivalent on the pay confirm line', async () => {
    renderWithLocale(
      <ForumBoard
        messages={[{ ...SAMPLE, parentId: 'p1' }]}
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
        rateDay={{
          sats: 100_000_000,
          usd: '100000.00',
          chf: '80000.00',
          eur: '90000.00',
          php: '5600000.00',
        }}
        {...modeProps('all')}
      />,
    );
    expect(screen.getByText(/Pay ₿21/)).toBeTruthy();
    expect(screen.getByText('$0.02')).toBeTruthy();
    expect(await screen.findByRole('img', { name: 'Bitcoin payment QR code' })).toBeTruthy();
  });

  it('hides the invoice QR on iPhone and keeps the wallet button', async () => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    });
    renderWithLocale(
      <ForumBoard
        messages={[{ ...SAMPLE, parentId: 'p1' }]}
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
      expect(screen.getByRole('button', { name: 'Pay with Wallet of Satoshi' })).toBeTruthy();
    });
    expect(screen.getByText('Pay ₿21')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy();
    expect(screen.queryByLabelText('Amount')).toBeNull();
    expect(screen.queryByRole('img', { name: 'Bitcoin payment QR code' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Pay with Wallet of Satoshi' }));
    expect(locationAssign).not.toHaveBeenCalled();
    expect(locationStub.href).toBe(walletOfSatoshiHref('lnbc21n1example'));
  });

  it('shows the invoice amount on iPhone when payDraft is empty', () => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: IPHONE_UA,
    });
    renderWithLocale(
      <ForumBoard
        messages={[{ ...SAMPLE, parentId: 'p1' }]}
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
        payDraft=""
        payInvoice={{ messageId: 'm1', pr: 'lnbc21n1example', amountSats: 42 }}
        rateDay={{
          sats: 100_000_000,
          usd: '100000.00',
          chf: '80000.00',
          eur: '90000.00',
          php: '5600000.00',
        }}
        {...modeProps('all')}
      />,
    );
    expect(screen.getByText(/Pay ₿42/)).toBeTruthy();
    expect(screen.getByText('$0.04')).toBeTruthy();
    expect(screen.queryByText('$0.02')).toBeNull();
    expect(screen.queryByLabelText('Amount')).toBeNull();
  });

  it('shows waiting copy on iPhone after the invoice is minted', () => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: IPHONE_UA,
    });
    renderWithLocale(
      <ForumBoard
        messages={[{ ...SAMPLE, parentId: 'p1' }]}
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
        {...modeProps('all')}
      />,
    );
    expect(screen.getByText('Waiting for payment…')).toBeTruthy();
    expect(screen.getByText('Pay ₿21')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Pay with Wallet of Satoshi' })).toBeTruthy();
    expect(screen.queryByLabelText('Amount')).toBeNull();
  });

  it('disables the amount field and Continue while pay is busy', () => {
    renderWithLocale(
      <ForumBoard
        messages={[{ ...SAMPLE, parentId: 'p1' }]}
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
        payBusy
        {...modeProps('all')}
      />,
    );
    expect((screen.getByLabelText('Amount') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('hides the invoice QR on Android Mobile and uses an Intent href', async () => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value:
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    });
    renderWithLocale(
      <ForumBoard
        messages={[{ ...SAMPLE, parentId: 'p1' }]}
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
      expect(screen.getByRole('button', { name: 'Pay with Wallet of Satoshi' })).toBeTruthy();
    });
    expect(screen.getByText('Pay ₿21')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy();
    expect(screen.queryByLabelText('Amount')).toBeNull();
    expect(screen.queryByRole('img', { name: 'Bitcoin payment QR code' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Pay with Wallet of Satoshi' }));
    expect(locationAssign).not.toHaveBeenCalled();
    expect(locationStub.href).toMatch(/^intent:lightning:/);
  });

  it('shows German invoice sheet labels', () => {
    renderWithLocale(
      <ForumBoard
        messages={[{ ...SAMPLE, parentId: 'p1' }]}
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
    const walletButton = screen.getByRole('button', { name: 'Mit Wallet of Satoshi zahlen' });
    expect(walletButton.textContent).toContain('Zahlen');
    expect(walletButton.textContent).not.toContain('Pay');
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
    expect(screen.getByRole('alert').textContent).toBe('Enter a message or add a photo or video');
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
    expect(screen.getByRole('alert').textContent).toBe('Keep it to 8000 characters');
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
    expect(screen.getByRole('alert').textContent).toBe(
      'Use a JPEG, PNG, or WebP photo, or an MP4, WebM, or MOV video',
    );
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
    expect(screen.getByRole('alert').textContent).toBe(
      'Keep photos under 1 MB and videos under 32 MB',
    );
  });

  it('shows formError tooMany alert', () => {
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
        formError="tooMany"
        {...idleProps}
        {...modeProps('active')}
      />,
    );
    expect(screen.getByRole('alert').textContent).toBe('You can add up to 10 photos');
  });

  it('shows formError ask alert', () => {
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
        formError="ask"
        {...idleProps}
        {...modeProps('active')}
      />,
    );
    expect(screen.getByRole('alert').textContent).toBe('Enter a whole number to ask for.');
  });

  it('renders ForumGoalBar 110% on a top-level note with a goal', () => {
    renderWithLocale(
      <ForumBoard
        messages={[{ ...SAMPLE, sats: 23100, goalSats: 21000 }]}
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
    expect(screen.getByText('Ask')).toBeTruthy();
    expect(screen.getByText("₿21'000")).toBeTruthy();
    expect(screen.getByText('110%')).toBeTruthy();
    expect(screen.queryByText('$21.00')).toBeNull();
  });

  it('does not render ForumGoalBar on a reply with goalSats', () => {
    renderWithLocale(
      <ForumBoard
        messages={[{ ...SAMPLE, parentId: 'm1', sats: 23100, goalSats: 21000 }]}
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
    expect(screen.queryByText('110%')).toBeNull();
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
    const button = screen.getByRole('button', { name: /^Post$/ }) as HTMLButtonElement;
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
    fireEvent.click(screen.getByRole('button', { name: /^Post$/ }));
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
          { ...SAMPLE, id: 'm-init', name: 'Ivy', role: 'initiator' },
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
    expect(screen.getByRole('button', { name: 'Initiator' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Verified' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Initiator' }));
    expect(screen.getByRole('status').textContent).toBe('This person was named an initiator.');
  });

  it('shows Founder, Moderator, and Verified tags on replies', () => {
    renderWithLocale(
      <ForumBoard
        messages={[{ ...SAMPLE, replyCount: 3 }]}
        error={false}
        loading={false}
        posting={false}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        onRetry={() => undefined}
        formError={null}
        {...idleProps}
        expandedId="m1"
        replies={[
          { ...SAMPLE, id: 'r-founder', name: 'Ada', role: 'founder', replyCount: 0 },
          { ...SAMPLE, id: 'r-mod', name: 'Bob', role: 'moderator', replyCount: 0 },
          { ...SAMPLE, id: 'r-ver', name: 'Carol', role: 'verified', replyCount: 0 },
        ]}
        {...modeProps('all')}
      />,
    );
    expect(screen.getByRole('button', { name: 'Founder' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Moderator' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Verified' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Founder' }));
    expect(screen.getByRole('status').textContent).toContain('founded 21.gifts');
    fireEvent.click(screen.getByRole('button', { name: 'Founder' }));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows a #Shop pill on a top-level shop note and hides the raw hashtag', () => {
    renderWithLocale(
      <ForumBoard
        messages={[{ ...SAMPLE, text: 'Cafe Luna\n\n#21GiftsShop' }]}
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
    const shopLink = screen.getByRole('link', { name: '#Shop' });
    expect(shopLink.getAttribute('href')).toBe('/shops');
    expect(screen.getByText('Cafe Luna')).toBeTruthy();
    expect(screen.queryByText('#21GiftsShop')).toBeNull();
  });

  it('does not show a #Shop pill on a living-room note', () => {
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
    expect(screen.queryByRole('link', { name: '#Shop' })).toBeNull();
  });

  it('does not call onToggleExpand when the #Shop pill is clicked', () => {
    const onToggleExpand = vi.fn();
    renderWithLocale(
      <ForumBoard
        messages={[{ ...SAMPLE, text: 'Cafe Luna\n\n#21GiftsShop' }]}
        error={false}
        loading={false}
        posting={false}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        onRetry={() => undefined}
        formError={null}
        {...idleProps}
        onToggleExpand={onToggleExpand}
        {...modeProps('all')}
      />,
    );
    fireEvent.click(screen.getByRole('link', { name: '#Shop' }));
    expect(onToggleExpand).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole('link', { name: '#Shop' }), { key: 'Enter' });
    expect(onToggleExpand).not.toHaveBeenCalled();
  });

  it('does not show a #Shop pill on a reply that contains the shop hashtag', () => {
    renderWithLocale(
      <ForumBoard
        messages={[{ ...SAMPLE, replyCount: 1 }]}
        error={false}
        loading={false}
        posting={false}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        onRetry={() => undefined}
        formError={null}
        {...idleProps}
        expandedId="m1"
        replies={[
          {
            ...SAMPLE,
            id: 'r-shop',
            parentId: 'm1',
            name: 'Bob',
            text: 'Cafe Luna\n\n#21GiftsShop',
            replyCount: 0,
          },
        ]}
        {...modeProps('all')}
      />,
    );
    expect(screen.queryByRole('link', { name: '#Shop' })).toBeNull();
  });

  it('shows the staff place control on a top-level note when shopPlaceEdit and onShopPlaceUpdated are set', () => {
    useAuthStore.setState({
      session: 'token',
      account: {
        id: 'acc_staff',
        linkingKey: '02abcdef',
        role: 'moderator',
        name: 'Mod',
        location: null,
        lightningAddress: 'mod@walletofsatoshi.com',
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1_700_000_000,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        setup: null,
        missing: [],
        aboutMe: null,
        aboutMeHasPhoto: false,
      },
    });
    renderWithLocale(
      <ForumBoard
        messages={[{ ...SAMPLE, text: 'Cafe Luna\n\n#21GiftsShop' }]}
        error={false}
        loading={false}
        posting={false}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        onRetry={() => undefined}
        formError={null}
        {...idleProps}
        shopPlaceEdit
        onShopPlaceUpdated={() => undefined}
        {...modeProps('all')}
      />,
    );
    const card = document.querySelector('[data-message-id="m1"]') as HTMLElement;
    expect(within(card).getByRole('button', { name: 'Add a place' })).toBeTruthy();
  });

  it('omits the staff place control on a nested reply even when shopPlaceEdit is on', () => {
    useAuthStore.setState({
      session: 'token',
      account: {
        id: 'acc_staff',
        linkingKey: '02abcdef',
        role: 'moderator',
        name: 'Mod',
        location: null,
        lightningAddress: 'mod@walletofsatoshi.com',
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1_700_000_000,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        setup: null,
        missing: [],
        aboutMe: null,
        aboutMeHasPhoto: false,
      },
    });
    renderWithLocale(
      <ForumBoard
        messages={[{ ...SAMPLE, text: 'Cafe Luna\n\n#21GiftsShop', replyCount: 1 }]}
        error={false}
        loading={false}
        posting={false}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        onRetry={() => undefined}
        formError={null}
        {...idleProps}
        shopPlaceEdit
        onShopPlaceUpdated={() => undefined}
        expandedId="m1"
        replies={[
          {
            ...SAMPLE,
            id: 'r-shop',
            parentId: 'm1',
            name: 'Bob',
            text: 'Cafe Luna\n\n#21GiftsShop',
            replyCount: 0,
          },
        ]}
        {...modeProps('all')}
      />,
    );
    const replyCard = document.querySelector('[data-reply-id="r-shop"]') as HTMLElement;
    expect(within(replyCard).queryByRole('button', { name: 'Add a place' })).toBeNull();
    expect(within(replyCard).queryByRole('button', { name: 'Edit place' })).toBeNull();
  });

  it('omits the staff place button when shopPlaceEdit or onShopPlaceUpdated is missing', () => {
    useAuthStore.setState({
      session: 'token',
      account: {
        id: 'acc_staff',
        linkingKey: '02abcdef',
        role: 'moderator',
        name: 'Mod',
        location: null,
        lightningAddress: 'mod@walletofsatoshi.com',
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1_700_000_000,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        setup: null,
        missing: [],
        aboutMe: null,
        aboutMeHasPhoto: false,
      },
    });
    const shop = { ...SAMPLE, text: 'Cafe Luna\n\n#21GiftsShop' };
    const view = renderWithLocale(
      <ForumBoard
        messages={[shop]}
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
    const card = (): HTMLElement => document.querySelector('[data-message-id="m1"]') as HTMLElement;
    expect(within(card()).queryByRole('button', { name: 'Add a place' })).toBeNull();
    view.rerender(
      <ForumBoard
        messages={[shop]}
        error={false}
        loading={false}
        posting={false}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        onRetry={() => undefined}
        formError={null}
        {...idleProps}
        shopPlaceEdit
        {...modeProps('all')}
      />,
    );
    expect(within(card()).queryByRole('button', { name: 'Add a place' })).toBeNull();
    view.rerender(
      <ForumBoard
        messages={[shop]}
        error={false}
        loading={false}
        posting={false}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        onRetry={() => undefined}
        formError={null}
        {...idleProps}
        onShopPlaceUpdated={() => undefined}
        {...modeProps('all')}
      />,
    );
    expect(within(card()).queryByRole('button', { name: 'Add a place' })).toBeNull();
  });

  it('shows shops.empty copy when emptyKey is shops.empty', () => {
    renderWithLocale(
      <ForumBoard
        messages={[]}
        emptyKey="shops.empty"
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
    expect(screen.getByText('No shops yet — add the first one.')).toBeTruthy();
  });

  it('shows forum.empty copy when emptyKey is omitted', () => {
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
    expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
  });

  it('unfurls a quoted public note in a reply and hides the raw URL', async () => {
    const rianaId = '444d655b-73a4-475a-b5fc-f7e36210e82e';
    const replyId = '322f9dea-4a76-5168-91b8-430432e5f90b';
    const quotedId = 'd8cd22dd-d5c4-46a8-82ed-38b4d2f551ec';
    const quotedUrl = `https://21.gifts/messages/${quotedId}`;
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
    vi.mocked(fetchPublicMessage).mockImplementation(async (id: string) => {
      if (id.toLowerCase() === 'd8cd22dd-d5c4-46a8-82ed-38b4d2f551ec') {
        return quoted;
      }
      return null;
    });
    renderWithLocale(
      <ForumBoard
        messages={[
          {
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
        expandedId={rianaId}
        replies={[
          {
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
          },
        ]}
        {...modeProps('all')}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText(/A Quick Technical Note/)).toBeTruthy();
    });
    expect(screen.getByText(/just for information:/)).toBeTruthy();
    expect(screen.queryByText(quotedUrl)).toBeNull();
    const quotedLink = document.querySelector(`a[href="/messages/${quotedId}"]`);
    expect(quotedLink?.getAttribute('href')).toBe(`/messages/${quotedId}`);
    fireEvent.click(quotedLink as HTMLAnchorElement);
  });

  it('stops card toggle when a quoted nested post on a top-level note is clicked', async () => {
    const quotedId = 'd8cd22dd-d5c4-46a8-82ed-38b4d2f551ec';
    const quotedUrl = `https://21.gifts/messages/${quotedId}`;
    vi.mocked(fetchPublicMessage).mockImplementation(async (id: string) => {
      if (id.toLowerCase() === quotedId) {
        return {
          id: quotedId,
          name: 'Cyrill',
          text: 'A Quick Technical Note',
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
      }
      return null;
    });
    renderWithLocale(
      <ForumBoard
        messages={[
          {
            ...SAMPLE,
            text: `just for information: ${quotedUrl}`,
            sats: 21,
            payable: true,
            role: 'founder',
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
        {...modeProps('all')}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('A Quick Technical Note')).toBeTruthy();
    });
    fireEvent.click(document.querySelector(`a[href="/messages/${quotedId}"]`) as HTMLAnchorElement);
  });

  it('stops card toggle when nested quoted caption is clicked', async () => {
    const quotedId = 'd8cd22dd-d5c4-46a8-82ed-38b4d2f551ec';
    const quotedUrl = `https://21.gifts/messages/${quotedId}`;
    const onToggleExpand = vi.fn();
    vi.mocked(fetchPublicMessage).mockImplementation(async (id: string) => {
      if (id.toLowerCase() === quotedId) {
        return {
          id: quotedId,
          name: 'Cyrill',
          text: 'A Quick Technical Note',
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
      }
      return null;
    });
    renderWithLocale(
      <ForumBoard
        messages={[
          {
            ...SAMPLE,
            text: `just for information: ${quotedUrl}`,
            sats: 21,
            payable: true,
            role: 'founder',
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
        onToggleExpand={onToggleExpand}
        {...modeProps('all')}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('A Quick Technical Note')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('A Quick Technical Note'));
    expect(onToggleExpand).not.toHaveBeenCalled();
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
      'A moderator has met this person in real life and confirmed they are real.',
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
      'A moderator has met this person in real life and confirmed they are real.',
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

  it('shows an External badge and hint on a top-level note', () => {
    renderWithLocale(
      <ForumBoard
        messages={[{ ...SAMPLE, via: 'nostr', payable: false }]}
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
    const tag = screen.getByRole('button', { name: 'External' });
    expect(tag.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('button', { name: 'View profile' })).toBeNull();
    expect(screen.getByText('Ada')).toBeTruthy();
    fireEvent.click(tag);
    expect(tag.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('status').textContent).toBe(
      'Wrote from another app, not from a 21.gifts account. Shown here because this person sent bitcoin to a post.',
    );
    fireEvent.click(tag);
    expect(tag.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('renders a via nostr shop note with the shop pill', () => {
    renderWithLocale(
      <ForumBoard
        messages={[{ ...SAMPLE, via: 'nostr', payable: false, text: 'Cafe Luna\n\n#21GiftsShop' }]}
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
    expect(screen.getByRole('button', { name: 'External' })).toBeTruthy();
    expect(screen.getByRole('link', { name: '#Shop' })).toBeTruthy();
  });

  it('renders a via note url as plain text and does not unfurl a quoted note', async () => {
    const quotedId = 'd8cd22dd-d5c4-46a8-82ed-38b4d2f551ec';
    const quotedUrl = `https://21.gifts/messages/${quotedId}`;
    vi.mocked(fetchPublicMessage).mockClear();
    renderWithLocale(
      <ForumBoard
        messages={[
          {
            ...SAMPLE,
            via: 'nostr',
            payable: false,
            text: `Greetings! https://example.com/hello ${quotedUrl}`,
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
        {...modeProps('all')}
      />,
    );
    expect(screen.getByText(`Greetings! https://example.com/hello ${quotedUrl}`)).toBeTruthy();
    expect(screen.queryByRole('link', { name: /example\.com/ })).toBeNull();
    expect(screen.queryByRole('link', { name: quotedUrl })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Open linked note from Cyrill' })).toBeNull();
    expect(fetchPublicMessage).not.toHaveBeenCalled();
  });

  it('keeps a long via note full when truncate is off', () => {
    const text = `${'a'.repeat(280)} https://example.com/hello`;
    renderWithLocale(
      <ForumBoard
        messages={[{ ...SAMPLE, via: 'nostr', payable: false, text }]}
        error={false}
        loading={false}
        posting={false}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        onRetry={() => undefined}
        formError={null}
        {...idleProps}
        truncate={false}
        {...modeProps('all')}
      />,
    );
    expect(screen.getByText(text)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
    expect(screen.queryByRole('link', { name: /example\.com/ })).toBeNull();
  });

  it('shows an External badge and hint on a reply and keeps a url as plain text', () => {
    const onToggleExpand = vi.fn();
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
        expandedId="m1"
        onToggleExpand={onToggleExpand}
        replies={[
          {
            ...SAMPLE,
            id: 'r-nostr-text',
            name: 'Robin',
            via: 'nostr',
            text: 'Greetings! https://example.com/hello',
            sats: 0,
            payable: false,
            replyCount: 0,
          },
        ]}
        {...modeProps('all')}
      />,
    );
    const tag = screen.getByRole('button', { name: 'External' });
    expect(screen.queryByRole('button', { name: 'View profile' })).toBeNull();
    expect(screen.getByText('Robin')).toBeTruthy();
    expect(screen.getByText('Greetings! https://example.com/hello')).toBeTruthy();
    expect(screen.queryByRole('link', { name: /example\.com/ })).toBeNull();
    fireEvent.click(tag);
    expect(onToggleExpand).not.toHaveBeenCalled();
    expect(screen.getByRole('status').textContent).toContain('Wrote from another app');
    fireEvent.click(tag);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('keeps a long via reply full when truncate is off', () => {
    const text = `${'a'.repeat(280)} https://example.com/hello`;
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
        expandedId="m1"
        replies={[
          {
            ...SAMPLE,
            id: 'r-nostr-long',
            name: 'Robin',
            via: 'nostr',
            text,
            sats: 0,
            payable: false,
            replyCount: 0,
          },
        ]}
        truncate={false}
        {...modeProps('all')}
      />,
    );
    expect(screen.getByText(text)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
    expect(screen.queryByRole('link', { name: /example\.com/ })).toBeNull();
  });

  it('keeps a via gift-only reply as send ₿ with a via badge', () => {
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
        expandedId="m1"
        replies={[
          {
            ...SAMPLE,
            id: 'r-nostr-gift',
            name: 'Robin',
            via: 'nostr',
            text: '',
            sats: 69,
            payable: false,
            replyCount: 0,
          },
        ]}
        {...modeProps('all')}
      />,
    );
    expect(screen.getByRole('button', { name: 'External' })).toBeTruthy();
    expect(screen.getByText('send ₿69')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Verified' })).toBeNull();
  });

  it('localizes the External badge', () => {
    renderWithLocale(
      <ForumBoard
        messages={[{ ...SAMPLE, via: 'nostr', payable: false }]}
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
    expect(screen.getByRole('button', { name: 'Extern' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Extern' }));
    expect(screen.getByRole('status').textContent).toContain('anderen App');
  });

  it('renders webm video from videoContentType', () => {
    renderWithLocale(
      <ForumBoard
        messages={[
          {
            ...SAMPLE,
            id: 'vid-webm',
            hasVideo: true,
            videoContentType: 'video/webm',
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
        {...modeProps('all')}
      />,
    );
    const video = document.querySelector('ul video');
    expect(video).toBeTruthy();
    expect(video?.getAttribute('src')).toBe('/messages/vid-webm/video.webm');
    expect(video?.hasAttribute('controls')).toBe(true);
    expect(video?.getAttribute('controlsList')).toContain('nofullscreen');
    expect(video?.hasAttribute('playsinline')).toBe(true);
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(video, 'requestFullscreen', {
      configurable: true,
      value: requestFullscreen,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Full screen' }));
    expect(requestFullscreen).toHaveBeenCalledTimes(1);
    const exitFullscreen = vi.fn().mockResolvedValue(undefined);
    document.exitFullscreen = exitFullscreen;
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => video,
    });
    act(() => {
      document.dispatchEvent(new Event('fullscreenchange'));
    });
    fireEvent.click(screen.getByRole('button', { name: 'Leave full screen' }));
    expect(exitFullscreen).toHaveBeenCalledTimes(1);
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => null,
    });
    act(() => {
      document.dispatchEvent(new Event('fullscreenchange'));
    });
    const webkitEnterFullscreen = vi.fn();
    Object.defineProperty(video, 'requestFullscreen', {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(video, 'webkitEnterFullscreen', {
      configurable: true,
      value: webkitEnterFullscreen,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Full screen' }));
    expect(webkitEnterFullscreen).toHaveBeenCalledTimes(1);
    Object.defineProperty(video, 'webkitEnterFullscreen', {
      configurable: true,
      value: undefined,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Full screen' }));
    expect(video?.getAttribute('preload')).toBe('metadata');
    const tokens = (video?.className ?? '').split(/\s+/);
    expect(tokens).toEqual(
      expect.arrayContaining([
        'mt-2',
        'mx-auto',
        'block',
        'h-auto',
        'w-auto',
        'max-h-80',
        'max-w-full',
        'rounded-xl',
        'object-contain',
        'shrink-0',
      ]),
    );
    expect(tokens).not.toContain('w-full');
    expect(tokens).not.toContain('bg-black');
  });

  it('hides a feed video when playback fails', () => {
    renderWithLocale(
      <ForumBoard
        messages={[
          {
            ...SAMPLE,
            id: 'vid-dead',
            hasVideo: true,
            videoContentType: 'video/mp4',
            text: 'clip',
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
        {...modeProps('all')}
      />,
    );
    const video = document.querySelector('ul video');
    expect(video).toBeTruthy();
    fireEvent.error(video!);
    expect(document.querySelector('ul video')).toBeNull();
    expect(screen.getByText('clip')).toBeTruthy();
  });

  it('renders quicktime video as .mov', () => {
    renderWithLocale(
      <ForumBoard
        messages={[
          {
            ...SAMPLE,
            id: 'vid-mov',
            hasVideo: true,
            videoContentType: 'video/quicktime',
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
        {...modeProps('all')}
      />,
    );
    expect(document.querySelector('video')?.getAttribute('src')).toBe(
      '/messages/vid-mov/video.mov',
    );
  });

  it('defaults missing videoContentType to .mp4', () => {
    renderWithLocale(
      <ForumBoard
        messages={[{ ...SAMPLE, id: 'vid-mp4', hasVideo: true, videoContentType: null }]}
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
    expect(document.querySelector('video')?.getAttribute('src')).toBe(
      '/messages/vid-mp4/video.mp4',
    );
  });

  it('prefers a local videoUrls preview over the rewrite path', () => {
    renderWithLocale(
      <ForumBoard
        messages={[
          {
            ...SAMPLE,
            id: 'vid-local',
            hasVideo: true,
            videoContentType: 'video/mp4',
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
        videoUrls={{ 'vid-local': 'blob:preview' }}
        {...modeProps('all')}
      />,
    );
    expect(document.querySelector('video')?.getAttribute('src')).toBe('blob:preview');
  });

  it('uses the photo URL as the video poster when both are present', () => {
    renderWithLocale(
      <ForumBoard
        messages={[
          {
            ...SAMPLE,
            id: 'vid-poster',
            hasPhoto: true,
            photoCount: 1,
            hasVideo: true,
            videoContentType: 'video/mp4',
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
        photoUrls={{ 'vid-poster:0': 'blob:poster' }}
        {...modeProps('all')}
      />,
    );
    expect(document.querySelector('video')?.getAttribute('poster')).toBe('blob:poster');
  });

  it('shows the replyCount text for zero and non-zero counts', () => {
    const { rerender } = renderWithLocale(
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
    expect(screen.getByText('0 reactions')).toBeTruthy();

    rerender(
      <LocaleProvider locale="en" messages={getCatalog('en')}>
        <ThemeProvider>
          <ForumBoard
            messages={[{ ...SAMPLE, replyCount: 2 }]}
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
          />
        </ThemeProvider>
      </LocaleProvider>,
    );
    expect(screen.getByText('2 reactions')).toBeTruthy();
  });

  it('omits the replyCount text on top-level cards that have a parentId', () => {
    renderWithLocale(
      <ForumBoard
        messages={[{ ...SAMPLE, id: 'reply-1', parentId: 'parent-1' }]}
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
    expect(screen.queryByText('0 reactions')).toBeNull();
  });

  it('keeps pay and copy outside the expand control', () => {
    const payableReply: ForumMessage = {
      id: 'r-pay',
      name: 'Bob',
      text: 'A payable reply',
      createdAt: '2026-08-28T12:30:00.000Z',
      sats: 0,
      payable: true,
      hasPhoto: false,
      photoCount: 0,
      hasVideo: false,
      videoContentType: null,
      role: 'basis',
      replyCount: 0,
    };
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
        expandedId="m1"
        replies={[payableReply]}
        {...modeProps('all')}
      />,
    );
    const replyCard = document.querySelector('[data-reply-id="r-pay"]') as HTMLElement;
    expect(replyCard).not.toBeNull();
    const gift = within(replyCard).getByRole('button', { name: 'Send Bitcoin' });
    expect(screen.getByRole('button', { name: 'Hide reactions' }).contains(gift)).toBe(false);
    expect(
      screen
        .getByRole('button', { name: 'Hide reactions' })
        .contains(screen.getByRole('button', { name: 'Copy link to this note' })),
    ).toBe(false);
  });

  it('expands via the ₿ amount and reply-count buttons', () => {
    const onToggleExpand = vi.fn();
    renderWithLocale(
      <ForumBoard
        messages={[{ ...SAMPLE, sats: 21, replyCount: 2 }]}
        error={false}
        loading={false}
        posting={false}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        onRetry={() => undefined}
        formError={null}
        {...idleProps}
        onToggleExpand={onToggleExpand}
        {...modeProps('all')}
      />,
    );
    expect(screen.getByRole('button', { name: 'Show reactions' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '₿21' }));
    expect(onToggleExpand).toHaveBeenCalledWith('m1');
    onToggleExpand.mockClear();
    fireEvent.click(screen.getByRole('button', { name: '2 reactions' }));
    expect(onToggleExpand).toHaveBeenCalledWith('m1');
    onToggleExpand.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Copy link to this note' }));
    expect(onToggleExpand).not.toHaveBeenCalled();
  });

  it('expands and collapses via the card aria-label, not pay/role/copy', () => {
    const onToggleExpand = vi.fn();
    const payableReply: ForumMessage = {
      id: 'r-pay',
      name: 'Bob',
      text: 'A payable reply',
      createdAt: '2026-08-28T12:30:00.000Z',
      sats: 0,
      payable: true,
      hasPhoto: false,
      photoCount: 0,
      hasVideo: false,
      videoContentType: null,
      role: 'basis',
      replyCount: 0,
    };
    const { rerender } = renderWithLocale(
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
        onToggleExpand={onToggleExpand}
        {...modeProps('all')}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    expect(onToggleExpand).toHaveBeenCalledWith('m1');
    onToggleExpand.mockClear();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Show reactions' }), { key: 'Enter' });
    expect(onToggleExpand).toHaveBeenCalledWith('m1');
    onToggleExpand.mockClear();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Show reactions' }), { key: ' ' });
    expect(onToggleExpand).toHaveBeenCalledWith('m1');
    onToggleExpand.mockClear();

    expect(screen.queryByRole('button', { name: 'Send Bitcoin' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Verified' }));
    expect(onToggleExpand).not.toHaveBeenCalled();

    expect(screen.queryByText('Copy link to this note')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Copy link to this note' }));
    expect(onToggleExpand).not.toHaveBeenCalled();

    rerender(
      <LocaleProvider locale="en" messages={getCatalog('en')}>
        <ThemeProvider>
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
            expandedId="m1"
            replies={[payableReply]}
            onToggleExpand={onToggleExpand}
            {...modeProps('all')}
          />
        </ThemeProvider>
      </LocaleProvider>,
    );
    onToggleExpand.mockClear();
    const replyCard = document.querySelector('[data-reply-id="r-pay"]') as HTMLElement;
    fireEvent.click(within(replyCard).getByRole('button', { name: 'Send Bitcoin' }));
    expect(onToggleExpand).not.toHaveBeenCalled();
  });

  it('does not expand when clicking the video or the photo', () => {
    const onToggleExpand = vi.fn();
    renderWithLocale(
      <ForumBoard
        messages={[
          {
            ...SAMPLE,
            id: 'vid-click',
            hasVideo: true,
            videoContentType: 'video/mp4',
          },
          {
            ...SAMPLE,
            id: 'img-click',
            name: 'Bob',
            text: '',
            hasPhoto: true,
            photoCount: 1,
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
        photoUrls={{ 'img-click:0': 'blob:photo' }}
        onToggleExpand={onToggleExpand}
        {...modeProps('all')}
      />,
    );
    fireEvent.click(document.querySelector('video') as HTMLVideoElement);
    expect(onToggleExpand).not.toHaveBeenCalled();
    fireEvent.click(screen.getByAltText('Photo from Bob'));
    expect(onToggleExpand).not.toHaveBeenCalled();
  });

  it('does not expand when clicking gallery chrome on a multi-still note', () => {
    const onToggleExpand = vi.fn();
    renderWithLocale(
      <ForumBoard
        messages={[
          {
            ...SAMPLE,
            id: 'm-gallery',
            name: 'Ada',
            text: '',
            hasPhoto: true,
            photoCount: 2,
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
        photoUrls={{ 'm-gallery:0': 'blob:g0', 'm-gallery:1': 'blob:g1' }}
        onToggleExpand={onToggleExpand}
        {...modeProps('all')}
      />,
    );
    fireEvent.click(screen.getAllByAltText('Photo from Ada')[0] as HTMLElement);
    const nextDot = screen.getByRole('button', { name: 'Photo 2 of 2' });
    fireEvent.click(nextDot);
    fireEvent.click(nextDot.parentElement as HTMLElement);
    fireEvent.keyDown(nextDot, { key: ' ' });
    fireEvent.keyDown(nextDot, { key: 'Enter' });
    expect(onToggleExpand).not.toHaveBeenCalled();
  });

  it("does not show Send a private message on other people's notes", () => {
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
        {...modeProps('all')}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Send a private message' })).toBeNull();
  });

  it('links author names with accountId to the member profile', () => {
    renderWithLocale(
      <ForumBoard
        messages={[{ ...SAMPLE, accountId: 'acc_other' }]}
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
    fireEvent.click(screen.getByRole('button', { name: 'View profile' }));
    expect(push).toHaveBeenCalledWith('/members/acc_other');
  });

  it('links reply author names with accountId to the member profile', () => {
    renderWithLocale(
      <ForumBoard
        messages={[{ ...SAMPLE, accountId: 'acc_note', replyCount: 1 }]}
        error={false}
        loading={false}
        posting={false}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        onRetry={() => undefined}
        formError={null}
        {...idleProps}
        expandedId="m1"
        replies={[{ ...SAMPLE, id: 'r1', name: 'Carol', accountId: 'acc_reply', replyCount: 0 }]}
        {...modeProps('all')}
      />,
    );
    fireEvent.click(screen.getAllByRole('button', { name: 'View profile' })[1]!);
    expect(push).toHaveBeenCalledWith('/members/acc_reply');
  });

  it('keeps Damus-only names as plain text', () => {
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
    expect(screen.queryByRole('button', { name: 'View profile' })).toBeNull();
    expect(screen.getByText('Ada')).toBeTruthy();
  });

  it('copies the public note URL and sets data-copied', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
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
        {...modeProps('all')}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Copy link to this note' }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/messages/m1`);
      expect(
        screen.getByRole('button', { name: 'Copy link to this note' }).getAttribute('data-copied'),
      ).toBe('true');
    });
  });

  it('copies a uuid note as an 8-hex short link', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const noteId = '77e0510d-03a8-4063-8716-75d61178e7f1';
    renderWithLocale(
      <ForumBoard
        messages={[{ ...SAMPLE, id: noteId }]}
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
    fireEvent.click(screen.getByRole('button', { name: 'Copy link to this note' }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/l/77e0510d`);
    });
  });

  it('labels the copy control of a reply shown as a feed card and copies its own permalink', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    renderWithLocale(
      <ForumBoard
        messages={[{ ...SAMPLE, id: 'r-feed', parentId: 'parent-1' }]}
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
    expect(screen.queryByRole('button', { name: 'Copy link to this note' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Copy link to this reply' }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/messages/r-feed`);
      expect(
        screen.getByRole('button', { name: 'Copy link to this reply' }).getAttribute('data-copied'),
      ).toBe('true');
    });
  });

  it("copies a reply's own permalink", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
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
        expandedId="m1"
        replies={[
          {
            id: 'r-own-link',
            name: 'Bob',
            text: 'A reply',
            createdAt: '2026-08-28T12:30:00.000Z',
            sats: 0,
            payable: false,
            hasPhoto: false,
            photoCount: 0,
            hasVideo: false,
            videoContentType: null,
            role: 'basis',
            replyCount: 0,
          },
        ]}
        {...modeProps('all')}
      />,
    );
    const replyCard = document.querySelector('[data-reply-id="r-own-link"]') as HTMLElement;
    fireEvent.click(within(replyCard).getByRole('button', { name: 'Copy link to this reply' }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/messages/r-own-link`);
      expect(
        within(replyCard)
          .getByRole('button', { name: 'Copy link to this reply' })
          .getAttribute('data-copied'),
      ).toBe('true');
    });
    expect(
      screen.getByRole('button', { name: 'Copy link to this note' }).getAttribute('data-copied'),
    ).toBeNull();
    expect(screen.queryByText('Copy link to this reply')).toBeNull();
  });

  it('falls back to execCommand for a reply permalink when the clipboard write rejects', async () => {
    const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const originalExecCommand = document.execCommand;
    const execCommand = vi.fn(() => true);
    Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
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
          expandedId="m1"
          replies={[
            {
              id: 'r-fallback',
              name: 'Bob',
              text: 'A reply',
              createdAt: '2026-08-28T12:30:00.000Z',
              sats: 0,
              payable: false,
              hasPhoto: false,
              photoCount: 0,
              hasVideo: false,
              videoContentType: null,
              role: 'basis',
              replyCount: 0,
            },
          ]}
          {...modeProps('all')}
        />,
      );
      const replyCard = document.querySelector('[data-reply-id="r-fallback"]') as HTMLElement;
      fireEvent.click(within(replyCard).getByRole('button', { name: 'Copy link to this reply' }));
      await waitFor(() => {
        expect(execCommand).toHaveBeenCalledWith('copy');
        expect(
          within(replyCard)
            .getByRole('button', { name: 'Copy link to this reply' })
            .getAttribute('data-copied'),
        ).toBe('true');
      });
      expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/messages/r-fallback`);
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
      Object.defineProperty(document, 'execCommand', {
        configurable: true,
        value: originalExecCommand,
      });
      if (originalClipboard === undefined) {
        Reflect.deleteProperty(navigator, 'clipboard');
      } else {
        Object.defineProperty(navigator, 'clipboard', originalClipboard);
      }
    }
  });

  it('leaves a reply copy control unmarked when both copy paths fail', async () => {
    const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const originalExecCommand = document.execCommand;
    const execCommand = vi.fn(() => false);
    Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
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
          expandedId="m1"
          replies={[
            {
              id: 'r-copy-fails',
              name: 'Bob',
              text: 'A reply',
              createdAt: '2026-08-28T12:30:00.000Z',
              sats: 0,
              payable: false,
              hasPhoto: false,
              photoCount: 0,
              hasVideo: false,
              videoContentType: null,
              role: 'basis',
              replyCount: 0,
            },
          ]}
          {...modeProps('all')}
        />,
      );
      const replyCard = document.querySelector('[data-reply-id="r-copy-fails"]') as HTMLElement;
      fireEvent.click(within(replyCard).getByRole('button', { name: 'Copy link to this reply' }));
      await waitFor(() => {
        expect(errorSpy).toHaveBeenCalledWith('Copy link failed');
      });
      expect(execCommand).toHaveBeenCalledWith('copy');
      expect(
        within(replyCard)
          .getByRole('button', { name: 'Copy link to this reply' })
          .getAttribute('data-copied'),
      ).toBeNull();
    } finally {
      errorSpy.mockRestore();
      Object.defineProperty(document, 'execCommand', {
        configurable: true,
        value: originalExecCommand,
      });
      if (originalClipboard === undefined) {
        Reflect.deleteProperty(navigator, 'clipboard');
      } else {
        Object.defineProperty(navigator, 'clipboard', originalClipboard);
      }
    }
  });

  it('shows the reply copy control alone with the mt-2 row class when not payable or deletable', () => {
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
        expandedId="m1"
        replies={[
          {
            id: 'r-plain',
            name: 'Bob',
            text: 'A reply',
            createdAt: '2026-08-28T12:30:00.000Z',
            sats: 0,
            payable: false,
            hasPhoto: false,
            photoCount: 0,
            hasVideo: false,
            videoContentType: null,
            role: 'basis',
            replyCount: 0,
          },
        ]}
        {...modeProps('all')}
      />,
    );
    const replyCard = document.querySelector('[data-reply-id="r-plain"]') as HTMLElement;
    const copyButton = within(replyCard).getByRole('button', { name: 'Copy link to this reply' });
    expect(within(replyCard).queryByRole('button', { name: 'Send Bitcoin' })).toBeNull();
    expect(within(replyCard).queryByRole('button', { name: 'Delete reaction' })).toBeNull();
    expect(within(replyCard).queryByRole('button', { name: 'Moderator functions' })).toBeNull();
    expect(within(replyCard).queryByTestId('staff-functions')).toBeNull();
    expect(copyButton.parentElement?.className).toBe('mt-2 flex flex-wrap items-center gap-5');
  });

  it('shows the flex row class when a payable reply also has the copy control', () => {
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
        expandedId="m1"
        replies={[
          {
            id: 'r-payable',
            name: 'Bob',
            text: 'A payable reply',
            createdAt: '2026-08-28T12:30:00.000Z',
            sats: 0,
            payable: true,
            hasPhoto: false,
            photoCount: 0,
            hasVideo: false,
            videoContentType: null,
            role: 'basis',
            replyCount: 0,
          },
        ]}
        {...modeProps('all')}
      />,
    );
    const replyCard = document.querySelector('[data-reply-id="r-payable"]') as HTMLElement;
    const copyButton = within(replyCard).getByRole('button', { name: 'Copy link to this reply' });
    expect(within(replyCard).getByRole('button', { name: 'Send Bitcoin' })).toBeTruthy();
    expect(copyButton.parentElement?.className).toBe('mt-2 flex flex-wrap items-center gap-5');
  });

  it('shows the flex row class when a deletable reply also has the copy control', () => {
    useAuthStore.setState({
      session: 'token',
      account: {
        id: 'acc_staff',
        linkingKey: '02abcdef',
        role: 'moderator',
        name: 'Mod',
        location: null,
        lightningAddress: 'mod@walletofsatoshi.com',
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1_700_000_000,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        setup: null,
        missing: [],
        aboutMe: null,
        aboutMeHasPhoto: false,
      },
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
        expandedId="m1"
        replies={[
          {
            id: 'r-deletable',
            name: 'Bob',
            text: 'A reply',
            createdAt: '2026-08-28T12:30:00.000Z',
            sats: 0,
            payable: false,
            hasPhoto: false,
            photoCount: 0,
            hasVideo: false,
            videoContentType: null,
            role: 'basis',
            replyCount: 0,
          },
        ]}
        onDeleted={() => undefined}
        {...modeProps('all')}
      />,
    );
    const replyCard = document.querySelector('[data-reply-id="r-deletable"]') as HTMLElement;
    const copyButton = within(replyCard).getByRole('button', { name: 'Copy link to this reply' });
    expect(within(replyCard).getByRole('button', { name: 'Delete reaction' })).toBeTruthy();
    expect(copyButton.parentElement?.className).toBe('mt-2 flex flex-wrap items-center gap-5');
  });

  it('keeps the flex row class for a viewer without the trash when the board was given onDeleted', () => {
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
        expandedId="m1"
        replies={[
          {
            id: 'r-no-trash',
            name: 'Bob',
            text: 'A reply',
            createdAt: '2026-08-28T12:30:00.000Z',
            sats: 0,
            payable: false,
            hasPhoto: false,
            photoCount: 0,
            hasVideo: false,
            videoContentType: null,
            role: 'basis',
            replyCount: 0,
          },
        ]}
        onDeleted={() => undefined}
        {...modeProps('all')}
      />,
    );
    const replyCard = document.querySelector('[data-reply-id="r-no-trash"]') as HTMLElement;
    const copyButton = within(replyCard).getByRole('button', { name: 'Copy link to this reply' });
    expect(within(replyCard).queryByRole('button', { name: 'Delete reaction' })).toBeNull();
    expect(within(replyCard).queryByTestId('staff-functions')).toBeNull();
    expect(copyButton.parentElement?.className).toBe('mt-2 flex flex-wrap items-center gap-5');
  });

  it('does not toggle the note card when clicking the reply copy control', () => {
    const onToggleExpand = vi.fn();
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
        expandedId="m1"
        onToggleExpand={onToggleExpand}
        replies={[
          {
            id: 'r-stop',
            name: 'Bob',
            text: 'A reply',
            createdAt: '2026-08-28T12:30:00.000Z',
            sats: 0,
            payable: false,
            hasPhoto: false,
            photoCount: 0,
            hasVideo: false,
            videoContentType: null,
            role: 'basis',
            replyCount: 0,
          },
        ]}
        {...modeProps('all')}
      />,
    );
    const replyCard = document.querySelector('[data-reply-id="r-stop"]') as HTMLElement;
    fireEvent.click(within(replyCard).getByRole('button', { name: 'Copy link to this reply' }));
    expect(onToggleExpand).not.toHaveBeenCalled();
  });

  it('shows the reply composer only when expanded', () => {
    const { rerender } = renderWithLocale(
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
    expect(screen.queryByPlaceholderText('Write a reaction')).toBeNull();

    rerender(
      <LocaleProvider locale="en" messages={getCatalog('en')}>
        <ThemeProvider>
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
            expandedId="m1"
            replies={[]}
            {...modeProps('all')}
          />
        </ThemeProvider>
      </LocaleProvider>,
    );
    expect(screen.getByPlaceholderText('Write a reaction')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Hide reactions' })).toBeTruthy();
  });

  it('retries reply loading from the error state', () => {
    const onRetryReplies = vi.fn();
    const onReplyDraftChange = vi.fn();
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
        expandedId="m1"
        replies={null}
        repliesLoading={false}
        repliesError={true}
        onRetryReplies={onRetryReplies}
        replyDraft="x"
        onReplyDraftChange={onReplyDraftChange}
        {...modeProps('all')}
      />,
    );
    expect(screen.getByRole('alert').className).toContain('text-app-danger');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetryReplies).toHaveBeenCalledTimes(1);
  });

  it('does not post a reply while the thread failed to load or is still empty', () => {
    const onReplyPost = vi.fn();
    const { rerender } = renderWithLocale(
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
        expandedId="m1"
        replies={null}
        repliesLoading={false}
        repliesError={true}
        onReplyPost={onReplyPost}
        {...modeProps('all')}
      />,
    );
    const form = screen.getByPlaceholderText('Write a reaction').closest('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form as HTMLFormElement);
    expect(onReplyPost).not.toHaveBeenCalled();

    rerender(
      <LocaleProvider locale="en" messages={getCatalog('en')}>
        <ThemeProvider>
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
            expandedId="m1"
            replies={null}
            repliesLoading={false}
            repliesError={false}
            onReplyPost={onReplyPost}
            {...modeProps('all')}
          />
        </ThemeProvider>
      </LocaleProvider>,
    );
    const pending = screen.getByPlaceholderText('Write a reaction').closest('form');
    expect(pending).not.toBeNull();
    fireEvent.submit(pending as HTMLFormElement);
    expect(onReplyPost).not.toHaveBeenCalled();

    rerender(
      <LocaleProvider locale="en" messages={getCatalog('en')}>
        <ThemeProvider>
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
            expandedId="m1"
            replies={[]}
            repliesLoading={true}
            repliesError={false}
            onReplyPost={onReplyPost}
            {...modeProps('all')}
          />
        </ThemeProvider>
      </LocaleProvider>,
    );
    const loading = screen.getByPlaceholderText('Write a reaction').closest('form');
    expect(loading).not.toBeNull();
    fireEvent.submit(loading as HTMLFormElement);
    expect(onReplyPost).not.toHaveBeenCalled();
  });

  it('spins the reply post button while posting and hides PM on own replies', () => {
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
        expandedId="m1"
        replies={[{ ...SAMPLE, id: 'r-own', name: 'Ada', text: '', sats: 0, payable: false }]}
        replyPosting={true}
        {...modeProps('all')}
      />,
    );
    expect(screen.getAllByRole('button', { name: 'Post' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Send a private message' })).toBeNull();
  });

  it("does not show Send a private message on other people's replies", () => {
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
        expandedId="m1"
        replies={[
          {
            id: 'r1',
            name: 'Bob',
            text: 'A reply',
            createdAt: '2026-08-28T12:30:00.000Z',
            sats: 0,
            payable: false,
            hasPhoto: false,
            photoCount: 0,
            hasVideo: false,
            videoContentType: null,
            role: 'basis',
            replyCount: 0,
          },
        ]}
        {...modeProps('all')}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Send a private message' })).toBeNull();
  });

  it('renders a gift-only reply as send plus the formatted amount', () => {
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
        expandedId="m1"
        replies={[
          {
            id: 'r-gift',
            name: 'Bob',
            text: '',
            createdAt: '2026-08-28T12:30:00.000Z',
            sats: 21000,
            payable: false,
            hasPhoto: false,
            photoCount: 0,
            hasVideo: false,
            videoContentType: null,
            role: 'basis',
            replyCount: 0,
          },
        ]}
        {...modeProps('all')}
      />,
    );
    expect(screen.getByText("send ₿21'000")).toBeTruthy();
  });

  it('shows stored fiat on a gift-only reply when the live rate differs', () => {
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
        expandedId="m1"
        rateDay={{
          sats: 100_000_000,
          usd: '100000.00',
          chf: '80000.00',
          eur: '90000.00',
          php: '5600000.00',
        }}
        replies={[
          {
            id: 'r-gift',
            name: 'Bob',
            text: '',
            createdAt: '2026-08-28T12:30:00.000Z',
            sats: 21,
            amountUsd: '5.00',
            payable: false,
            hasPhoto: false,
            photoCount: 0,
            hasVideo: false,
            videoContentType: null,
            role: 'basis',
            replyCount: 0,
          },
        ]}
        {...modeProps('all')}
      />,
    );
    expect(screen.getByText('send ₿21')).toBeTruthy();
    expect(screen.getByText('$5.00')).toBeTruthy();
    expect(screen.queryByText('$0.02')).toBeNull();
  });

  it('shows the live viewer fiat on a gift-only reply when no fiat was stored', () => {
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
        expandedId="m1"
        rateDay={{
          sats: 100_000_000,
          usd: '100000.00',
          chf: '80000.00',
          eur: '90000.00',
          php: '5600000.00',
        }}
        replies={[
          {
            id: 'r-gift',
            name: 'Bob',
            text: '',
            createdAt: '2026-08-28T12:30:00.000Z',
            sats: 21000,
            payable: false,
            hasPhoto: false,
            photoCount: 0,
            hasVideo: false,
            videoContentType: null,
            role: 'basis',
            replyCount: 0,
          },
        ]}
        {...modeProps('all')}
      />,
    );
    expect(screen.getByText("send ₿21'000")).toBeTruthy();
    expect(screen.getByText('$21.00')).toBeTruthy();
  });

  it('keeps a gift-only reply ₿-only when conversion is null', () => {
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
        expandedId="m1"
        rateDay={{
          sats: 100_000_000,
          usd: '100000.00',
          chf: null,
          eur: '90000.00',
          php: '5600000.00',
        }}
        replies={[
          {
            id: 'r-gift',
            name: 'Bob',
            text: '',
            createdAt: '2026-08-28T12:30:00.000Z',
            sats: 21000,
            payable: false,
            hasPhoto: false,
            photoCount: 0,
            hasVideo: false,
            videoContentType: null,
            role: 'basis',
            replyCount: 0,
          },
        ]}
        {...modeProps('all')}
      />,
      'de',
    );
    expect(screen.getByText("₿21'000 senden")).toBeTruthy();
    expect(screen.queryByText('—')).toBeNull();
    expect(screen.queryByText(/^CHF /)).toBeNull();
  });

  it('renders reply text with the gift amount underneath', () => {
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
        expandedId="m1"
        replies={[
          {
            id: 'r-both',
            name: 'Bob',
            text: 'Thanks',
            createdAt: '2026-08-28T12:30:00.000Z',
            sats: 21,
            payable: false,
            hasPhoto: false,
            photoCount: 0,
            hasVideo: false,
            videoContentType: null,
            role: 'basis',
            replyCount: 0,
          },
        ]}
        {...modeProps('all')}
      />,
    );
    expect(screen.getByText('Thanks')).toBeTruthy();
    expect(screen.getByText('₿21')).toBeTruthy();
  });

  it('shows the live viewer fiat on a text reply gift when no fiat was stored', () => {
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
        expandedId="m1"
        rateDay={{
          sats: 100_000_000,
          usd: '100000.00',
          chf: '80000.00',
          eur: '90000.00',
          php: '5600000.00',
        }}
        replies={[
          {
            id: 'r-both',
            name: 'Bob',
            text: 'Thanks',
            createdAt: '2026-08-28T12:30:00.000Z',
            sats: 21,
            payable: false,
            hasPhoto: false,
            photoCount: 0,
            hasVideo: false,
            videoContentType: null,
            role: 'basis',
            replyCount: 0,
          },
        ]}
        {...modeProps('all')}
      />,
    );
    expect(screen.getByText('Thanks')).toBeTruthy();
    expect(screen.getByText('₿21')).toBeTruthy();
    expect(screen.getByText('$0.02')).toBeTruthy();
  });

  it('forwards reply amount draft changes', () => {
    const onReplyAmountDraftChange = vi.fn();
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
        expandedId="m1"
        replies={[]}
        replyAmountDraft=""
        onReplyAmountDraftChange={onReplyAmountDraftChange}
        {...modeProps('all')}
      />,
    );
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
    expect(onReplyAmountDraftChange).toHaveBeenCalledWith('21');
  });

  it('shows replyFormError tooLong, request, and rateLimit when expanded', () => {
    const { rerender } = renderWithLocale(
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
        expandedId="m1"
        replies={[]}
        replyFormError="empty"
        {...modeProps('all')}
      />,
    );
    expect(screen.getByRole('alert').textContent).toBe('Enter a message or add a photo or video');

    rerender(
      <LocaleProvider locale="en" messages={getCatalog('en')}>
        <ThemeProvider>
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
            expandedId="m1"
            replies={[]}
            replyFormError="amount"
            {...modeProps('all')}
          />
        </ThemeProvider>
      </LocaleProvider>,
    );
    expect(screen.getByRole('alert').textContent).toBe('Send at least ₿1 with your reaction');

    rerender(
      <LocaleProvider locale="en" messages={getCatalog('en')}>
        <ThemeProvider>
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
            expandedId="m1"
            replies={[]}
            replyFormError="tooLong"
            {...modeProps('all')}
          />
        </ThemeProvider>
      </LocaleProvider>,
    );
    expect(screen.getByRole('alert').textContent).toBe('Keep it to 8000 characters');

    rerender(
      <LocaleProvider locale="en" messages={getCatalog('en')}>
        <ThemeProvider>
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
            expandedId="m1"
            replies={[]}
            replyFormError="request"
            {...modeProps('all')}
          />
        </ThemeProvider>
      </LocaleProvider>,
    );
    expect(screen.getByRole('alert').textContent).toBe('Could not post your message');

    rerender(
      <LocaleProvider locale="en" messages={getCatalog('en')}>
        <ThemeProvider>
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
            expandedId="m1"
            replies={[]}
            replyFormError="rateLimit"
            {...modeProps('all')}
          />
        </ThemeProvider>
      </LocaleProvider>,
    );
    expect(screen.getByRole('alert').textContent).toBe(
      'Too many messages. Please wait a moment and try again.',
    );
  });

  it('calls onRefresh after a pull of at least 56px at the top of the page', () => {
    const onRefresh = vi.fn();
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
    const { container } = renderWithLocale(
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
        onRefresh={onRefresh}
        {...idleProps}
        {...modeProps('all')}
      />,
    );
    const root = container.querySelector('.overscroll-y-contain');
    expect(root).toBeTruthy();
    fireEvent.touchStart(window, { touches: [{ clientY: 100 }] });
    fireEvent.touchMove(window, { touches: [{ clientY: 160 }] });
    fireEvent.touchEnd(window);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('reads pull-to-refresh scrollTop from the AppShell scroller', () => {
    const onRefresh = vi.fn();
    const { container } = renderWithLocale(
      <AppShell mode="fill">
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
          onRefresh={onRefresh}
          {...idleProps}
          {...modeProps('all')}
        />
      </AppShell>,
    );
    const scroller = container.querySelector('.overflow-y-auto');
    expect(scroller).toBeTruthy();
    if (scroller instanceof HTMLElement) {
      scroller.scrollTop = 0;
    }
    fireEvent.touchStart(window, { touches: [{ clientY: 100 }] });
    fireEvent.touchMove(window, { touches: [{ clientY: 160 }] });
    fireEvent.touchEnd(window);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('does not call onRefresh for a small pull under 56px', () => {
    const onRefresh = vi.fn();
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
    const { container } = renderWithLocale(
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
        onRefresh={onRefresh}
        {...idleProps}
        {...modeProps('all')}
      />,
    );
    const root = container.querySelector('.overscroll-y-contain');
    expect(root).toBeTruthy();
    fireEvent.touchStart(window, { touches: [{ clientY: 100 }] });
    fireEvent.touchMove(window, { touches: [{ clientY: 140 }] });
    fireEvent.touchEnd(window);
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('does not throw on a touch pull when onRefresh is omitted', () => {
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
    const { container } = renderWithLocale(
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
    const root = container.querySelector('.overscroll-y-contain');
    expect(root).toBeTruthy();
    expect(() => {
      fireEvent.touchStart(window, { touches: [{ clientY: 100 }] });
      fireEvent.touchMove(window, { touches: [{ clientY: 180 }] });
      fireEvent.touchEnd(window);
    }).not.toThrow();
  });

  it('shows a refreshing status only while refreshing is true', () => {
    const { rerender } = renderWithLocale(
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
    expect(screen.queryByRole('status', { name: 'Refreshing messages' })).toBeNull();

    rerender(
      <LocaleProvider locale="en" messages={getCatalog('en')}>
        <ThemeProvider>
          <ForumBoard
            messages={[SAMPLE]}
            error={false}
            loading={false}
            refreshing
            posting={false}
            draft=""
            onDraftChange={() => undefined}
            onPost={() => undefined}
            onRetry={() => undefined}
            formError={null}
            {...idleProps}
            {...modeProps('all')}
          />
        </ThemeProvider>
      </LocaleProvider>,
    );
    expect(screen.getByRole('status', { name: 'Refreshing messages' })).toBeTruthy();
  });

  it('skips newest-note scroll while refreshing when newestId changes', () => {
    const { rerender } = renderWithLocale(
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
    const scrollMock = HTMLElement.prototype.scrollIntoView as unknown as ReturnType<typeof vi.fn>;
    scrollMock.mockClear();

    rerender(
      <LocaleProvider locale="en" messages={getCatalog('en')}>
        <ThemeProvider>
          <ForumBoard
            messages={[MULTILINE, SAMPLE]}
            error={false}
            loading={false}
            refreshing
            posting={false}
            draft=""
            onDraftChange={() => undefined}
            onPost={() => undefined}
            onRetry={() => undefined}
            formError={null}
            {...idleProps}
            {...modeProps('all')}
          />
        </ThemeProvider>
      </LocaleProvider>,
    );
    expect(scrollMock).not.toHaveBeenCalled();
  });

  it('does not call onRefresh while refreshing is true', () => {
    const onRefresh = vi.fn();
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
    const { container } = renderWithLocale(
      <ForumBoard
        messages={[SAMPLE]}
        error={false}
        loading={false}
        refreshing
        posting={false}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        onRetry={() => undefined}
        formError={null}
        onRefresh={onRefresh}
        {...idleProps}
        {...modeProps('all')}
      />,
    );
    const root = container.querySelector('.overscroll-y-contain');
    expect(root).toBeTruthy();
    fireEvent.touchStart(window, { touches: [{ clientY: 100 }] });
    fireEvent.touchMove(window, { touches: [{ clientY: 180 }] });
    fireEvent.touchEnd(window);
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('marks the message list aria-busy while refreshing', () => {
    renderWithLocale(
      <ForumBoard
        messages={[SAMPLE]}
        error={false}
        loading={false}
        refreshing
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
    expect(screen.getByRole('list', { name: 'All messages' }).getAttribute('aria-busy')).toBe(
      'true',
    );
  });

  it('cancels an in-progress pull on touchcancel', () => {
    const onRefresh = vi.fn();
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
    const { container } = renderWithLocale(
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
        onRefresh={onRefresh}
        {...idleProps}
        {...modeProps('all')}
      />,
    );
    const root = container.querySelector('.overscroll-y-contain');
    expect(root).toBeTruthy();
    fireEvent.touchStart(window, { touches: [{ clientY: 100 }] });
    fireEvent.touchMove(window, { touches: [{ clientY: 180 }] });
    expect(screen.getByRole('status', { name: 'Refreshing messages' })).toBeTruthy();
    fireEvent.touchCancel(window);
    expect(screen.queryByRole('status', { name: 'Refreshing messages' })).toBeNull();
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('does not start a pull when the page is already scrolled', () => {
    const onRefresh = vi.fn();
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 20 });
    const { container } = renderWithLocale(
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
        onRefresh={onRefresh}
        {...idleProps}
        {...modeProps('all')}
      />,
    );
    const root = container.querySelector('.overscroll-y-contain');
    expect(root).toBeTruthy();
    fireEvent.touchStart(window, { touches: [{ clientY: 100 }] });
    fireEvent.touchMove(window, { touches: [{ clientY: 180 }] });
    fireEvent.touchEnd(window);
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('cancels an in-progress pull when the page scrolls during the gesture', () => {
    const onRefresh = vi.fn();
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
    const { container } = renderWithLocale(
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
        onRefresh={onRefresh}
        {...idleProps}
        {...modeProps('all')}
      />,
    );
    const root = container.querySelector('.overscroll-y-contain');
    expect(root).toBeTruthy();
    fireEvent.touchStart(window, { touches: [{ clientY: 100 }] });
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 20 });
    fireEvent.touchMove(window, { touches: [{ clientY: 180 }] });
    fireEvent.touchEnd(window);
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('ignores a touchstart with an empty TouchList', () => {
    const onRefresh = vi.fn();
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
    const { container } = renderWithLocale(
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
        onRefresh={onRefresh}
        {...idleProps}
        {...modeProps('all')}
      />,
    );
    const root = container.querySelector('.overscroll-y-contain');
    expect(root).toBeTruthy();
    fireEvent.touchStart(window, { touches: [] });
    fireEvent.touchMove(window, { touches: [{ clientY: 180 }] });
    fireEvent.touchEnd(window);
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('focuses the new-post composer on FORUM_COMPOSE_EVENT', () => {
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
    const textarea = screen.getByLabelText('Your message');
    const scrollMock = HTMLElement.prototype.scrollIntoView as unknown as ReturnType<typeof vi.fn>;
    scrollMock.mockClear();
    act(() => {
      window.dispatchEvent(new Event(FORUM_COMPOSE_EVENT));
    });
    expect(document.activeElement).toBe(textarea);
    expect(scrollMock).toHaveBeenCalledWith({ block: 'nearest' });
  });

  it('focuses the new-post composer on mount when compose is pending', () => {
    requestForumCompose();
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
    expect(document.activeElement).toBe(screen.getByLabelText('Your message'));
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
  });

  it('consumes pending compose when the composer is hidden', () => {
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
        composerHidden
        {...idleProps}
        {...modeProps('all')}
      />,
    );
    expect(() => {
      act(() => {
        requestForumCompose();
      });
    }).not.toThrow();
    expect(consumePendingForumCompose()).toBe(true);
  });

  it('focuses the new-post composer after a hidden board left compose pending', () => {
    const { unmount } = renderWithLocale(
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
        composerHidden
        {...idleProps}
        {...modeProps('all')}
      />,
    );
    act(() => {
      requestForumCompose();
    });
    unmount();
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
    expect(document.activeElement).toBe(screen.getByLabelText('Your message'));
  });

  it('renders an empty thread when expanded replies is not an array', () => {
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
        expandedId="m1"
        replies={{ messages: [] } as unknown as ForumMessage[]}
        {...modeProps('all')}
      />,
    );
    expect(screen.getByPlaceholderText('Write a reaction')).toBeTruthy();
    expect(document.querySelector('[data-reply-id]')).toBeNull();
  });

  it('shows an icon-only Delete reaction on nested replies when onDeleted is provided', () => {
    useAuthStore.setState({
      session: 'token',
      account: {
        id: 'acc_staff',
        linkingKey: '02abcdef',
        role: 'moderator',
        name: 'Mod',
        location: null,
        lightningAddress: 'mod@walletofsatoshi.com',
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1_700_000_000,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        setup: null,
        missing: [],
        aboutMe: null,
        aboutMeHasPhoto: false,
      },
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
        expandedId="m1"
        replies={[
          {
            id: 'r1',
            name: 'Bob',
            text: 'A reply',
            createdAt: '2026-08-28T12:30:00.000Z',
            sats: 0,
            payable: false,
            hasPhoto: false,
            photoCount: 0,
            hasVideo: false,
            videoContentType: null,
            role: 'basis',
            replyCount: 0,
          },
        ]}
        onDeleted={() => undefined}
        {...modeProps('all')}
      />,
    );
    const replyCard = document.querySelector('[data-reply-id="r1"]');
    expect(replyCard).not.toBeNull();
    expect(
      within(replyCard as HTMLElement).getByRole('button', { name: 'Delete reaction' }),
    ).toBeTruthy();
    expect(within(replyCard as HTMLElement).queryByText('Delete reaction')).toBeNull();
    expect(screen.getByRole('button', { name: 'Delete post' })).toBeTruthy();
    expect(screen.queryByText('Delete post')).toBeNull();
  });

  it('hides Delete reaction on nested replies when onDeleted is omitted', () => {
    useAuthStore.setState({
      session: 'token',
      account: {
        id: 'acc_staff',
        linkingKey: '02abcdef',
        role: 'moderator',
        name: 'Mod',
        location: null,
        lightningAddress: 'mod@walletofsatoshi.com',
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1_700_000_000,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        setup: null,
        missing: [],
        aboutMe: null,
        aboutMeHasPhoto: false,
      },
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
        expandedId="m1"
        replies={[
          {
            id: 'r1',
            name: 'Bob',
            text: 'A reply',
            createdAt: '2026-08-28T12:30:00.000Z',
            sats: 0,
            payable: false,
            hasPhoto: false,
            photoCount: 0,
            hasVideo: false,
            videoContentType: null,
            role: 'basis',
            replyCount: 0,
          },
        ]}
        {...modeProps('all')}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Delete reaction' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Moderator functions' })).toBeNull();
    expect(screen.queryByTestId('staff-functions')).toBeNull();
  });

  it('shows Delete reaction on own replies that have no PM', () => {
    useAuthStore.setState({
      session: 'token',
      account: {
        id: 'acc_staff',
        linkingKey: '02abcdef',
        role: 'founder',
        name: 'Ada',
        location: null,
        lightningAddress: 'ada@walletofsatoshi.com',
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1_700_000_000,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        setup: null,
        missing: [],
        aboutMe: null,
        aboutMeHasPhoto: false,
      },
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
        expandedId="m1"
        replies={[
          { ...SAMPLE, id: 'r-own', name: 'Ada', text: 'Own reply', sats: 0, payable: false },
        ]}
        onDeleted={() => undefined}
        {...modeProps('all')}
      />,
    );
    const replyCard = document.querySelector('[data-reply-id="r-own"]');
    expect(replyCard).not.toBeNull();
    expect(
      within(replyCard as HTMLElement).getByRole('button', { name: 'Delete reaction' }),
    ).toBeTruthy();
    expect(
      within(replyCard as HTMLElement).queryByRole('button', { name: 'Send a private message' }),
    ).toBeNull();
  });

  it('rings only the nested reply that matches permalinkTargetId', () => {
    renderWithLocale(
      <ForumBoard
        messages={[{ ...SAMPLE, replyCount: 2 }]}
        error={false}
        loading={false}
        posting={false}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        onRetry={() => undefined}
        formError={null}
        {...idleProps}
        expandedId="m1"
        permalinkTargetId="r1"
        replies={[
          { ...SAMPLE, id: 'r1', name: 'Bob', replyCount: 0 },
          { ...SAMPLE, id: 'r2', name: 'Carol', replyCount: 0 },
        ]}
        {...modeProps('all')}
      />,
    );
    const target = document.querySelector('[data-permalink-target="true"]');
    expect(target).toBe(document.querySelector('[data-reply-id="r1"]'));
    expect(target?.className).toContain('ring-1');
    expect(target?.className).toContain('ring-app-fg');
    expect(
      document.querySelector('[data-reply-id="r2"]')?.hasAttribute('data-permalink-target'),
    ).toBe(false);
    const parent = document.querySelector('[data-message-id="m1"]');
    expect(parent?.hasAttribute('data-permalink-target')).toBe(false);
    expect(parent?.className).not.toContain('ring-app-fg');
  });

  it('shows React on a top-level note and omits Gift', () => {
    const onToggleExpand = vi.fn();
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
        onToggleExpand={onToggleExpand}
        {...modeProps('all')}
      />,
    );
    expect(screen.getByRole('button', { name: /^React$/ })).toBeTruthy();
    expect(screen.queryByText('React')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Send Bitcoin' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^React$/ }));
    expect(onToggleExpand).toHaveBeenCalledWith('m1');
  });

  it('omits interaction controls and the reply composer on a hidden top-level note', () => {
    renderWithLocale(
      <ForumBoard
        messages={[{ ...SAMPLE, deletedAt: '2026-08-29T15:00:00.000Z', payable: true }]}
        error={false}
        loading={false}
        posting={false}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        onRetry={() => undefined}
        formError={null}
        {...idleProps}
        expandedId="m1"
        replies={[]}
        onDeleted={() => undefined}
        {...modeProps('all')}
      />,
    );
    expect(screen.queryByRole('button', { name: /^React$/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Send Bitcoin' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete post' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Moderator functions' })).toBeNull();
    expect(screen.queryByTestId('staff-functions')).toBeNull();
    expect(screen.queryByPlaceholderText('Write a reaction')).toBeNull();
    expect(screen.getByRole('button', { name: 'Copy link to this note' })).toBeTruthy();
    expect(screen.getByText('₿0')).toBeTruthy();
  });

  it('omits Gift on a hidden payable reply card', () => {
    renderWithLocale(
      <ForumBoard
        messages={[
          {
            ...SAMPLE,
            parentId: 'p1',
            payable: true,
            deletedAt: '2026-08-29T15:00:00.000Z',
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
        {...modeProps('all')}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Send Bitcoin' })).toBeNull();
  });

  it('omits Gift and Delete on a hidden nested reply', () => {
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
        expandedId="m1"
        replies={[
          {
            ...SAMPLE,
            id: 'r1',
            parentId: 'm1',
            payable: true,
            deletedAt: '2026-08-29T15:00:00.000Z',
          },
        ]}
        onDeleted={() => undefined}
        {...modeProps('all')}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Send Bitcoin' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete reaction' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Moderator functions' })).toBeNull();
    expect(screen.queryByTestId('staff-functions')).toBeNull();
  });

  it('focuses the reply composer when React is clicked on an expanded note', () => {
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
        expandedId="m1"
        replies={[]}
        repliesLoading={false}
        repliesError={false}
        {...modeProps('all')}
      />,
    );
    const composer = screen.getByLabelText('Your reaction');
    fireEvent.click(screen.getByRole('button', { name: /^React$/ }));
    expect(document.activeElement).toBe(composer);
  });

  it('omits React on a nested reply and keeps Gift when payable', () => {
    const onPayOpen = vi.fn();
    const payableReply: ForumMessage = {
      id: 'r-pay',
      name: 'Bob',
      text: 'A payable reply',
      createdAt: '2026-08-28T12:30:00.000Z',
      sats: 0,
      payable: true,
      hasPhoto: false,
      photoCount: 0,
      hasVideo: false,
      videoContentType: null,
      role: 'basis',
      replyCount: 0,
    };
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
        expandedId="m1"
        replies={[payableReply]}
        onPayOpen={onPayOpen}
        {...modeProps('all')}
      />,
    );
    const replyCard = document.querySelector('[data-reply-id="r-pay"]') as HTMLElement;
    expect(replyCard).not.toBeNull();
    expect(within(replyCard).queryByRole('button', { name: /^React$/ })).toBeNull();
    expect(within(replyCard).getByRole('button', { name: 'Send Bitcoin' })).toBeTruthy();
  });

  it('shows Gift on a payable reply and opens the pay sheet on that reply', () => {
    const onPayOpen = vi.fn();
    const onToggleExpand = vi.fn();
    const payableReply: ForumMessage = {
      id: 'r-pay',
      name: 'Bob',
      text: 'A payable reply',
      createdAt: '2026-08-28T12:30:00.000Z',
      sats: 0,
      payable: true,
      hasPhoto: false,
      photoCount: 0,
      hasVideo: false,
      videoContentType: null,
      role: 'basis',
      replyCount: 0,
    };
    const { rerender } = renderWithLocale(
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
        expandedId="m1"
        replies={[payableReply]}
        onPayOpen={onPayOpen}
        onToggleExpand={onToggleExpand}
        {...modeProps('all')}
      />,
    );
    const replyCard = document.querySelector('[data-reply-id="r-pay"]') as HTMLElement;
    expect(replyCard).not.toBeNull();
    expect(within(replyCard).queryByText('Send Bitcoin')).toBeNull();
    fireEvent.click(within(replyCard).getByRole('button', { name: 'Send Bitcoin' }));
    expect(onPayOpen).toHaveBeenCalledWith('r-pay');
    expect(onToggleExpand).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText('Write a reaction')).toBeTruthy();
    expect(within(replyCard).queryByPlaceholderText('Write a reaction')).toBeNull();
    expect(within(replyCard).queryByRole('button', { name: 'Post' })).toBeNull();

    rerender(
      <LocaleProvider locale="en" messages={getCatalog('en')}>
        <ThemeProvider>
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
            expandedId="m1"
            replies={[payableReply]}
            payMessageId="r-pay"
            payDraft="21"
            onPayOpen={onPayOpen}
            onToggleExpand={onToggleExpand}
            {...modeProps('all')}
          />
        </ThemeProvider>
      </LocaleProvider>,
    );
    const openCard = document.querySelector('[data-reply-id="r-pay"]') as HTMLElement;
    expect(within(openCard).getByLabelText('Amount')).toBeTruthy();
    expect(within(openCard).getByRole('button', { name: 'Continue' })).toBeTruthy();
    expect(screen.getByPlaceholderText('Write a reaction')).toBeTruthy();
  });

  it('omits Gift on an unpayable reply', () => {
    renderWithLocale(
      <ForumBoard
        messages={[{ ...SAMPLE, payable: false }]}
        error={false}
        loading={false}
        posting={false}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        onRetry={() => undefined}
        formError={null}
        {...idleProps}
        expandedId="m1"
        replies={[
          {
            id: 'r1',
            name: 'Bob',
            text: 'A reply',
            createdAt: '2026-08-28T12:30:00.000Z',
            sats: 0,
            payable: false,
            hasPhoto: false,
            photoCount: 0,
            hasVideo: false,
            videoContentType: null,
            role: 'basis',
            replyCount: 0,
          },
        ]}
        {...modeProps('all')}
      />,
    );
    const replyCard = document.querySelector('[data-reply-id="r1"]') as HTMLElement;
    expect(replyCard).not.toBeNull();
    expect(within(replyCard).queryByRole('button', { name: 'Send Bitcoin' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Send Bitcoin' })).toBeNull();
    expect(screen.getByPlaceholderText('Write a reaction')).toBeTruthy();
  });

  it('keeps Gift and Delete reply on a payable nested reply', () => {
    useAuthStore.setState({
      session: 'token',
      account: {
        id: 'acc_staff',
        linkingKey: '02abcdef',
        role: 'founder',
        name: 'Ada',
        location: null,
        lightningAddress: 'ada@walletofsatoshi.com',
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1_700_000_000,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        setup: null,
        missing: [],
        aboutMe: null,
        aboutMeHasPhoto: false,
      },
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
        expandedId="m1"
        replies={[
          {
            id: 'r-pay',
            name: 'Bob',
            text: 'A payable reply',
            createdAt: '2026-08-28T12:30:00.000Z',
            sats: 0,
            payable: true,
            hasPhoto: false,
            photoCount: 0,
            hasVideo: false,
            videoContentType: null,
            role: 'basis',
            replyCount: 0,
          },
        ]}
        onDeleted={() => undefined}
        {...modeProps('all')}
      />,
    );
    const replyCard = document.querySelector('[data-reply-id="r-pay"]') as HTMLElement;
    expect(replyCard).not.toBeNull();
    expect(within(replyCard).getByRole('button', { name: 'Send Bitcoin' })).toBeTruthy();
    expect(within(replyCard).getByRole('button', { name: 'Delete reaction' })).toBeTruthy();
    expect(within(replyCard).queryByText('Send Bitcoin')).toBeNull();
  });
});

describe('reply form size', () => {
  it('scrolls again when the open reply form changes size', () => {
    const observed: Element[] = [];
    let disconnected = false;
    class FakeResizeObserver {
      constructor(private readonly onResize: ResizeObserverCallback) {
        void this.onResize;
      }

      observe(target: Element): void {
        observed.push(target);
        this.onResize([], this as unknown as ResizeObserver);
      }

      disconnect(): void {
        disconnected = true;
      }

      unobserve(): void {}
    }
    const previous = globalThis.ResizeObserver;
    globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
    const view = renderWithLocale(
      <AppShell mode="fill">
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
          expandedId="m1"
          replies={[]}
          {...modeProps('all')}
        />
      </AppShell>,
    );
    expect(observed.some((node) => node instanceof HTMLFormElement)).toBe(true);
    view.unmount();
    expect(disconnected).toBe(true);
    globalThis.ResizeObserver = previous;
  });
});

describe('revealReplyForm', () => {
  function box(bottom: number): DOMRect {
    return {
      bottom,
      top: 0,
      left: 0,
      right: 0,
      width: 0,
      height: bottom,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    };
  }

  it('does nothing without a scroller or a form', () => {
    const form = document.createElement('form');
    const scroller = document.createElement('div');
    scroller.scrollTop = 4;
    revealReplyForm(null, form);
    revealReplyForm(scroller, null);
    expect(scroller.scrollTop).toBe(4);
  });

  it('scrolls only when the form hangs past the shell', () => {
    const scroller = document.createElement('div');
    const form = document.createElement('form');
    scroller.getBoundingClientRect = () => box(100);
    form.getBoundingClientRect = () => box(80);
    revealReplyForm(scroller, form);
    expect(scroller.scrollTop).toBe(0);
    form.getBoundingClientRect = () => box(140);
    revealReplyForm(scroller, form);
    expect(scroller.scrollTop).toBe(52);
  });
});
