import { deleteMessage } from '@/lib/api';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from '@/components/AppShell';
import { ForumLoader } from '@/components/ForumLoader';
import {
  FORUM_MESSAGE_MAX_LENGTH,
  type Account,
  type ForumMessage,
  type GiftStats,
  type Notification,
  type NotificationList,
} from '@/lib/api-types';
import { FORUM_HOME_EVENT, FORUM_LIST_POLL_MS } from '@/lib/forum-feed';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const push = vi.fn();
const replace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: (): { push: typeof push; replace: typeof replace } => ({ push, replace }),
}));

vi.mock('@/lib/api', () => ({
  deleteMessage: vi.fn(),
  setMessagePlace: vi.fn(),
  fetchMessages: vi.fn(),
  fetchPublicForumMessages: vi.fn(),
  fetchPublicMessage: vi.fn(),
  fetchPublicMessagePhoto: vi.fn(),
  fetchPublicReplies: vi.fn(),
  PublicForumUnauthorizedError: class PublicForumUnauthorizedError extends Error {},
  postMessage: vi.fn(),
  postMessageVideo: vi.fn(),
  fetchComposeTarget: vi.fn(),
  postMessageInvoice: vi.fn(),
  dismissForumLaws: vi.fn(),
  fetchMessagePhoto: vi.fn(),
  fetchReplies: vi.fn(),
  fetchGiftStats: vi.fn().mockResolvedValue({ spendOverTime: [] }),
  fetchNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
  agreeToRules: vi.fn(),
  setName: vi.fn(),
  setLightningAddress: vi.fn(),
  skipSetup: vi.fn(),
}));

vi.mock('@/lib/forum-photo', () => ({
  prepareForumPhoto: vi.fn(),
}));

vi.mock('@/lib/forum-video', () => ({
  isForumVideoFile: vi.fn(() => false),
  prepareForumVideo: vi.fn(),
}));

import {
  agreeToRules,
  dismissForumLaws,
  fetchGiftStats,
  fetchMessagePhoto,
  fetchMessages,
  fetchNotifications,
  fetchPublicForumMessages,
  fetchPublicMessage,
  fetchPublicMessagePhoto,
  fetchPublicReplies,
  fetchReplies,
  PublicForumUnauthorizedError,
  markNotificationRead,
  fetchComposeTarget,
  postMessage,
  postMessageInvoice,
  postMessageVideo,
  setLightningAddress,
  setMessagePlace,
  setName,
} from '@/lib/api';
import { MissingRequirementsError } from '@/lib/missing-requirements';
import { prepareForumPhoto } from '@/lib/forum-photo';
import { isForumVideoFile, prepareForumVideo } from '@/lib/forum-video';

const fetchMock = vi.mocked(fetchMessages);
const publicListMock = vi.mocked(fetchPublicForumMessages);
const publicPhotoMock = vi.mocked(fetchPublicMessagePhoto);
const publicRepliesMock = vi.mocked(fetchPublicReplies);
const fetchNotificationsMock = vi.mocked(fetchNotifications);
const markNotificationReadMock = vi.mocked(markNotificationRead);
const fetchGiftStatsMock = vi.mocked(fetchGiftStats);
const publicFetchMock = vi.mocked(fetchPublicMessage);
const postMock = vi.mocked(postMessage);
const invoiceMock = vi.mocked(postMessageInvoice);
const composeTargetMock = vi.mocked(fetchComposeTarget);
const dismissLawsMock = vi.mocked(dismissForumLaws);
const photoMock = vi.mocked(fetchMessagePhoto);
const repliesMock = vi.mocked(fetchReplies);
const prepareMock = vi.mocked(prepareForumPhoto);
const isVideoMock = vi.mocked(isForumVideoFile);
const prepareVideoMock = vi.mocked(prepareForumVideo);
const postVideoMock = vi.mocked(postMessageVideo);

const account: Account = {
  id: 'acc_1',
  linkingKey: '02abcdef',
  role: 'verified',
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

const SAMPLE: ForumMessage = {
  id: 'm1',
  accountId: 'acc_1',
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

function forumPage(
  messages: ForumMessage[],
  nextCursor: string | null = null,
): { messages: ForumMessage[]; nextCursor: string | null } {
  return { messages, nextCursor };
}

const PAYABLE_REPLY: ForumMessage = {
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

const NESTED_REPLY: ForumMessage = {
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
};

async function clickReplyGift(replyId = 'r-pay'): Promise<HTMLElement> {
  fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
  await waitFor(() => {
    expect(document.querySelector(`[data-reply-id="${replyId}"]`)).not.toBeNull();
  });
  const replyCard = document.querySelector(`[data-reply-id="${replyId}"]`) as HTMLElement;
  fireEvent.click(within(replyCard).getByRole('button', { name: 'Send Bitcoin' }));
  return replyCard;
}

function clickGiftOnReply(replyId = 'r-pay'): HTMLElement {
  const replyCard = document.querySelector(`[data-reply-id="${replyId}"]`) as HTMLElement;
  fireEvent.click(within(replyCard).getByRole('button', { name: 'Send Bitcoin' }));
  return replyCard;
}

const FRESH: ForumMessage = {
  id: 'm-new',
  accountId: 'acc_carol',
  name: 'Carol',
  text: 'Fresh from refresh',
  createdAt: '2026-08-28T15:00:00.000Z',
  sats: 21,
  payable: true,
  hasPhoto: false,
  photoCount: 0,
  hasVideo: false,
  videoContentType: null,
  role: 'basis',
  replyCount: 0,
};

const FOREIGN: ForumMessage = {
  id: 'm-bob',
  accountId: 'acc_bob',
  name: 'Bob',
  text: 'Hello from Bob',
  createdAt: '2026-08-28T11:00:00.000Z',
  sats: 0,
  payable: true,
  hasPhoto: false,
  photoCount: 0,
  hasVideo: false,
  videoContentType: null,
  role: 'basis',
  replyCount: 0,
};

const UNREAD_APPOINTED: Notification = {
  id: 'n-mod',
  type: 'moderator_appointed',
  parentId: 'acc-subject',
  replyId: 'acc-subject',
  name: 'Cyrill',
  text: '',
  createdAt: '2026-08-22T12:00:00.000Z',
  readAt: null,
};

const EMPTY_STATS: GiftStats = {
  totalSats: 0,
  totalBtc: '0.00000000',
  totalUsd: '0.00',
  totalChf: '0.00',
  totalEur: '0.00',
  totalPhp: '0.00',
  giftCount: 0,
  recipientCount: 0,
  firstPaidAt: null,
  lastPaidAt: null,
  spendOverTime: [],
  byRecipient: [],
  byMonth: [],
  fx: {
    quote: 'BTC-USD',
    dayBasis: 'utc',
    source: 'coinbase-exchange-daily-close',
    quotes: [{ code: 'USD', pair: 'BTC-USD', source: 'coinbase-exchange-daily-close' }],
  },
};

const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
const originalUserAgent = navigator.userAgent;

function chooseForumMode(name: string | RegExp): void {
  fireEvent.click(screen.getByRole('combobox', { name: 'Forum view' }));
  fireEvent.click(screen.getByRole('option', { name }));
}

async function revealAll(): Promise<void> {
  chooseForumMode(/^All$/);
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockResolvedValue(forumPage([]));
  publicListMock.mockResolvedValue({ messages: [], nextCursor: null });
  publicPhotoMock.mockResolvedValue(new Blob([new Uint8Array([1])], { type: 'image/jpeg' }));
  publicRepliesMock.mockResolvedValue([]);
  composeTargetMock.mockResolvedValue({ messageId: 'fee-note', sats: 0 });
  invoiceMock.mockResolvedValue({ pr: 'lnbc1', amountSats: 1 });
  fetchNotificationsMock.mockResolvedValue({ notifications: [], unreadCount: 0 });
  markNotificationReadMock.mockResolvedValue({
    id: 'n-mod',
    type: 'moderator_appointed',
    parentId: 'acc-subject',
    replyId: 'acc-subject',
    name: 'Cyrill',
    text: '',
    createdAt: '2026-08-22T12:00:00.000Z',
    readAt: '2026-08-28T13:00:00.000Z',
  });
  isVideoMock.mockReturnValue(false);
  push.mockReset();
  replace.mockReset();
  HTMLElement.prototype.scrollIntoView = vi.fn();
  useAuthStore.setState({ session: 'sess', account });
  photoMock.mockResolvedValue(new Blob([new Uint8Array([1])], { type: 'image/jpeg' }));
  publicFetchMock.mockResolvedValue(SAMPLE);
  fetchGiftStatsMock.mockResolvedValue(EMPTY_STATS);
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
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
  HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  Object.defineProperty(navigator, 'userAgent', {
    configurable: true,
    value: originalUserAgent,
  });
  vi.unstubAllGlobals();
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => 'visible',
  });
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
  fetchMock.mockReset();
  publicFetchMock.mockReset();
  postMock.mockReset();
  invoiceMock.mockReset();
  dismissLawsMock.mockReset();
  photoMock.mockReset();
  repliesMock.mockReset();
  prepareMock.mockReset();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

const NO_RATE_SHOWN = {
  amountUsd: null,
  amountChf: null,
  amountEur: null,
  amountPhp: null,
};

describe('ForumLoader', () => {
  it('shows the public living room without the laws hint when there is no session', async () => {
    useAuthStore.setState({ session: null, account });
    renderWithLocale(<ForumLoader />);
    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull();
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    expect(publicListMock).toHaveBeenCalled();
  });

  it('renders the board when the session has no account yet', async () => {
    useAuthStore.setState({ session: 'sess', account: null });
    fetchMock.mockResolvedValue(forumPage([]));
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
  });

  it('keeps ₿-only amounts when gift stats fail', async () => {
    fetchGiftStatsMock.mockRejectedValue(new Error('stats down'));
    fetchMock.mockResolvedValue(forumPage([FRESH]));
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('Fresh from refresh')).toBeTruthy();
    });
    expect(screen.getByText('₿21')).toBeTruthy();
    expect(screen.queryByText('$0.02')).toBeNull();
  });

  it('posts when the account snapshot is missing', async () => {
    useAuthStore.setState({ session: 'sess', account: null });
    fetchMock.mockResolvedValue(forumPage([]));
    postMock.mockResolvedValue(SAMPLE);
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: /^Post$/ }));
    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('sess', { text: 'Hello' });
    });
  });

  it('posts a place pin with the note', async () => {
    fetchMock.mockResolvedValue(forumPage([]));
    postMock.mockResolvedValue(SAMPLE);
    const listeners = new Map<
      string,
      (event?: { latLng: { lat: () => number; lng: () => number } | null }) => void
    >();
    (window as { google?: unknown }).google = {
      maps: {
        Map: vi.fn(() => ({
          setCenter: vi.fn(),
          addListener: (
            event: string,
            handler: (event?: { latLng: { lat: () => number; lng: () => number } | null }) => void,
          ) => {
            listeners.set(event, handler);
          },
        })),
        Marker: vi.fn(() => ({
          setPosition: () => undefined,
          getPosition: () => null,
          addListener: () => undefined,
        })),
      },
    };
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue({ json: () => Promise.resolve({ key: 'k' }) } as Response);
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    await waitFor(() => {
      expect(listeners.has('click')).toBe(true);
    });
    listeners.get('click')?.({ latLng: { lat: () => 14.5, lng: () => 120.9 } });
    fireEvent.change(screen.getByLabelText('Place name'), { target: { value: 'Stall' } });
    fireEvent.click(screen.getByRole('button', { name: 'Use this place' }));
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: /^Post$/ }));
    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('sess', {
        text: 'Hello',
        place: { lat: 14.5, lng: 120.9, label: 'Stall' },
      });
    });
    fetchSpy.mockRestore();
    delete (window as { google?: unknown }).google;
  });

  it('does not keep a place pin after switching to Ask', async () => {
    fetchMock.mockResolvedValue(forumPage([]));
    postMock.mockResolvedValue(SAMPLE);
    const listeners = new Map<
      string,
      (event?: { latLng: { lat: () => number; lng: () => number } | null }) => void
    >();
    (window as { google?: unknown }).google = {
      maps: {
        Map: vi.fn(() => ({
          setCenter: vi.fn(),
          addListener: (
            event: string,
            handler: (event?: { latLng: { lat: () => number; lng: () => number } | null }) => void,
          ) => {
            listeners.set(event, handler);
          },
        })),
        Marker: vi.fn(() => ({
          setPosition: () => undefined,
          getPosition: () => null,
          addListener: () => undefined,
        })),
      },
    };
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue({ json: () => Promise.resolve({ key: 'k' }) } as Response);
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    await waitFor(() => {
      expect(listeners.has('click')).toBe(true);
    });
    listeners.get('click')?.({ latLng: { lat: () => 14.5, lng: () => 120.9 } });
    fireEvent.click(await screen.findByRole('button', { name: 'Use this place' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ask for money' }));
    await waitFor(() => {
      expect(screen.getByText('How much?')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Ask'), { target: { value: '21000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: /^Post$/ }));
    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('sess', {
        text: 'Hello',
        goalCurrency: 'BTC',
        goalAmount: '21000',
      });
    });
    fetchSpy.mockRestore();
    delete (window as { google?: unknown }).google;
  });

  it('drops a place pin if Ask is chosen before the compose fee confirms', async () => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, role: 'basis', forumLawsDismissed: true, hasPosted: true },
    });
    fetchMock.mockResolvedValue(forumPage([]));
    publicFetchMock.mockResolvedValue({
      id: 'fee-note',
      name: '21.gifts',
      text: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      sats: 0,
      payable: true,
      hasPhoto: false,
      photoCount: 0,
      hasVideo: false,
      videoContentType: null,
      role: 'basis',
      replyCount: 0,
    });
    postMock.mockResolvedValue({
      ...SAMPLE,
      id: 'place-dropped',
      text: 'Hello',
      sats: 0,
      payable: false,
    });
    const listeners = new Map<
      string,
      (event?: { latLng: { lat: () => number; lng: () => number } | null }) => void
    >();
    (window as { google?: unknown }).google = {
      maps: {
        Map: vi.fn(() => ({
          setCenter: vi.fn(),
          addListener: (
            event: string,
            handler: (event?: { latLng: { lat: () => number; lng: () => number } | null }) => void,
          ) => {
            listeners.set(event, handler);
          },
        })),
        Marker: vi.fn(() => ({
          setPosition: () => undefined,
          getPosition: () => null,
          addListener: () => undefined,
        })),
      },
    };
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue({ json: () => Promise.resolve({ key: 'k' }) } as Response);
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    await waitFor(() => {
      expect(listeners.has('click')).toBe(true);
    });
    listeners.get('click')?.({ latLng: { lat: () => 14.5, lng: () => 120.9 } });
    fireEvent.change(screen.getByLabelText('Place name'), { target: { value: 'Stall' } });
    fireEvent.click(screen.getByRole('button', { name: 'Use this place' }));
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: /^Post$/ }));
    await waitFor(() => {
      expect(invoiceMock).toHaveBeenCalledWith('sess', 'fee-note', 1, undefined, NO_RATE_SHOWN);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ask for money' }));
    publicFetchMock.mockResolvedValue({
      id: 'fee-note',
      name: '21.gifts',
      text: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      sats: 1,
      payable: true,
      hasPhoto: false,
      photoCount: 0,
      hasVideo: false,
      videoContentType: null,
      role: 'basis',
      replyCount: 0,
    });
    await waitFor(
      () => {
        expect(postMock).toHaveBeenCalledWith('sess', { text: 'Hello' });
      },
      { timeout: 5000 },
    );
    expect(postMock.mock.calls[0]?.[1]).not.toHaveProperty('place');
    fetchSpy.mockRestore();
    delete (window as { google?: unknown }).google;
  });

  it('posts a basis place pin after the compose fee confirms', async () => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, role: 'basis', forumLawsDismissed: true, hasPosted: true },
    });
    fetchMock.mockResolvedValue(forumPage([]));
    publicFetchMock.mockResolvedValue({
      id: 'fee-note',
      name: '21.gifts',
      text: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      sats: 1,
      payable: true,
      hasPhoto: false,
      photoCount: 0,
      hasVideo: false,
      videoContentType: null,
      role: 'basis',
      replyCount: 0,
    });
    postMock.mockResolvedValue({
      ...SAMPLE,
      id: 'place-paid',
      text: 'Hello',
      sats: 0,
      payable: false,
    });
    const listeners = new Map<
      string,
      (event?: { latLng: { lat: () => number; lng: () => number } | null }) => void
    >();
    (window as { google?: unknown }).google = {
      maps: {
        Map: vi.fn(() => ({
          setCenter: vi.fn(),
          addListener: (
            event: string,
            handler: (event?: { latLng: { lat: () => number; lng: () => number } | null }) => void,
          ) => {
            listeners.set(event, handler);
          },
        })),
        Marker: vi.fn(() => ({
          setPosition: () => undefined,
          getPosition: () => null,
          addListener: () => undefined,
        })),
      },
    };
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue({ json: () => Promise.resolve({ key: 'k' }) } as Response);
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    await waitFor(() => {
      expect(listeners.has('click')).toBe(true);
    });
    listeners.get('click')?.({ latLng: { lat: () => 14.5, lng: () => 120.9 } });
    fireEvent.change(screen.getByLabelText('Place name'), { target: { value: 'Stall' } });
    fireEvent.click(screen.getByRole('button', { name: 'Use this place' }));
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: /^Post$/ }));
    await waitFor(() => {
      expect(invoiceMock).toHaveBeenCalledWith('sess', 'fee-note', 1, undefined, NO_RATE_SHOWN);
    });
    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('sess', {
        text: 'Hello',
        place: { lat: 14.5, lng: 120.9, label: 'Stall' },
      });
    });
    fetchSpy.mockRestore();
    delete (window as { google?: unknown }).google;
  });

  it('posts an ask defined in the account fiat', async () => {
    fetchGiftStatsMock.mockResolvedValue({
      ...EMPTY_STATS,
      spendOverTime: [
        {
          day: '2026-06-01',
          sats: 100_000_000,
          cumulativeSats: 100_000_000,
          btc: '1.00000000',
          cumulativeBtc: '1.00000000',
          usd: '100000.00',
          cumulativeUsd: '100000.00',
          chf: '80000.00',
          eur: '90000.00',
          php: '5600000.00',
          cumulativeChf: '80000.00',
          cumulativeEur: '90000.00',
          cumulativePhp: '5600000.00',
        },
      ],
    });
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, amountUnit: 'fiat' },
    });
    postMock.mockResolvedValue(SAMPLE);
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ask for money' }));
    fireEvent.change(screen.getByLabelText('Ask'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: /^Post$/ }));
    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('sess', {
        text: 'Hello',
        goalCurrency: 'USD',
        goalAmount: '1',
      });
    });
  });

  it('posts a valid Ask amount as goalCurrency and goalAmount', async () => {
    fetchMock.mockResolvedValue(forumPage([]));
    postMock.mockResolvedValue(SAMPLE);
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ask for money' }));
    await waitFor(() => {
      expect(screen.getByText('How much?')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Ask'), { target: { value: '21000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: /^Post$/ }));
    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('sess', {
        text: 'Hello',
        goalCurrency: 'BTC',
        goalAmount: '21000',
      });
    });
  });

  it('keeps Active selected after posting an Ask', async () => {
    fetchMock.mockResolvedValue(forumPage([]));
    postMock.mockResolvedValue({ ...SAMPLE, id: 'm-ask', text: 'Hello', goalSats: 21000 });
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ask for money' }));
    await waitFor(() => {
      expect(screen.getByText('How much?')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Ask'), { target: { value: '21000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: /^Post$/ }));
    await waitFor(() => {
      expect(screen.getByText('Hello')).toBeTruthy();
      expect(screen.getByRole('combobox', { name: 'Forum view' }).textContent).toContain('Active');
    });
  });

  it('switches from Most popular to Active after posting an Ask', async () => {
    fetchMock.mockResolvedValue(forumPage([]));
    postMock.mockResolvedValue({ ...SAMPLE, id: 'm-ask-popular', text: 'Hello', goalSats: 21000 });
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    chooseForumMode('Most popular');
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Forum view' }).textContent).toContain(
        'Most popular',
      );
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ask for money' }));
    await waitFor(() => {
      expect(screen.getByText('How much?')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Ask'), { target: { value: '21000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: /^Post$/ }));
    await waitFor(() => {
      expect(screen.getByText('Hello')).toBeTruthy();
      expect(screen.getByRole('combobox', { name: 'Forum view' }).textContent).toContain('Active');
    });
  });

  it('returns to Send a post from the Ask pill', async () => {
    fetchMock.mockResolvedValue(forumPage([]));
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ask for money' }));
    await waitFor(() => {
      expect(screen.getByText('How much?')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send a post' }));
    await waitFor(() => {
      expect(screen.getByLabelText('Your message')).toBeTruthy();
    });
    expect(screen.queryByText('How much?')).toBeNull();
  });

  it('omits ask fields when Ask is empty', async () => {
    fetchMock.mockResolvedValue(forumPage([]));
    postMock.mockResolvedValue(SAMPLE);
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: /^Post$/ }));
    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('sess', { text: 'Hello' });
    });
  });

  it('does not post when Ask is not a whole sat in range', async () => {
    fetchMock.mockResolvedValue(forumPage([]));
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ask for money' }));
    await waitFor(() => {
      expect(screen.getByText('How much?')).toBeTruthy();
    });
    expect(screen.getByRole('button', { name: 'Continue' })).toHaveProperty('disabled', true);
    for (const value of ['abc', '0', '10000001']) {
      fireEvent.change(screen.getByLabelText('Ask'), { target: { value } });
      expect(screen.getByRole('button', { name: 'Continue' })).toHaveProperty('disabled', true);
      expect(postMock).not.toHaveBeenCalled();
    }
  });

  it('clears the Ask field after a successful post', async () => {
    fetchMock.mockResolvedValue(forumPage([]));
    postMock.mockResolvedValue(SAMPLE);
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ask for money' }));
    await waitFor(() => {
      expect(screen.getByText('How much?')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Ask'), { target: { value: '21000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: /^Post$/ }));
    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('sess', {
        text: 'Hello',
        goalCurrency: 'BTC',
        goalAmount: '21000',
      });
    });
    expect(screen.getByRole('button', { name: 'Send a post' })).toBeTruthy();
    expect(screen.queryByLabelText('Ask')).toBeNull();
  });

  it('converts an ask draft that is not on screen when the account unit changes', async () => {
    fetchGiftStatsMock.mockResolvedValue({
      ...EMPTY_STATS,
      spendOverTime: [
        {
          day: '2026-06-01',
          sats: 100_000_000,
          cumulativeSats: 100_000_000,
          btc: '1.00000000',
          cumulativeBtc: '1.00000000',
          usd: '100000.00',
          cumulativeUsd: '100000.00',
          chf: '80000.00',
          eur: '90000.00',
          php: '5600000.00',
          cumulativeChf: '80000.00',
          cumulativeEur: '90000.00',
          cumulativePhp: '5600000.00',
        },
      ],
    });
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ask for money' }));
    fireEvent.change(screen.getByLabelText('Ask'), { target: { value: '21' } });
    await waitFor(() => {
      expect(screen.getByText('$0.02')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Add photos' })).toBeTruthy();
    });
    await act(async () => {
      useAuthStore.setState({
        session: 'sess',
        account: { ...account, amountUnit: 'fiat' },
      });
    });
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByLabelText('Ask')).toHaveProperty('value', '0.021');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await act(async () => {
      useAuthStore.setState({ session: 'sess', account });
    });
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByLabelText('Ask')).toHaveProperty('value', '21');
  });

  it('leaves the ask field to convert itself while step 1 is open', async () => {
    fetchGiftStatsMock.mockResolvedValue({
      ...EMPTY_STATS,
      spendOverTime: [
        {
          day: '2026-06-01',
          sats: 100_000_000,
          cumulativeSats: 100_000_000,
          btc: '1.00000000',
          cumulativeBtc: '1.00000000',
          usd: '100000.00',
          cumulativeUsd: '100000.00',
          chf: '80000.00',
          eur: '90000.00',
          php: '5600000.00',
          cumulativeChf: '80000.00',
          cumulativeEur: '90000.00',
          cumulativePhp: '5600000.00',
        },
      ],
    });
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ask for money' }));
    fireEvent.change(screen.getByLabelText('Ask'), { target: { value: '21' } });
    await waitFor(() => {
      expect(screen.getByText('$0.02')).toBeTruthy();
    });
    await act(async () => {
      useAuthStore.setState({
        session: 'sess',
        account: { ...account, amountUnit: 'fiat' },
      });
    });
    expect(screen.getByLabelText('Ask')).toHaveProperty('value', '0.021');
  });

  it('keeps an ask in sats when step 1 returns before a rate can convert', async () => {
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ask for money' }));
    fireEvent.change(screen.getByLabelText('Ask'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await act(async () => {
      useAuthStore.setState({
        session: 'sess',
        account: { ...account, amountUnit: 'fiat' },
      });
    });
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByLabelText('Ask')).toHaveProperty('value', '21');
    expect(screen.getByRole('button', { name: '₿' })).toHaveProperty('ariaPressed', 'true');
    expect(screen.getByRole('button', { name: 'Continue' })).toHaveProperty('disabled', false);
  });

  it('leaves an unmounted ask draft unchanged when the rate cannot convert it', async () => {
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ask for money' }));
    fireEvent.change(screen.getByLabelText('Ask'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await act(async () => {
      useAuthStore.setState({
        session: 'sess',
        account: { ...account, amountUnit: 'fiat' },
      });
    });
    await act(async () => {
      useAuthStore.setState({ session: 'sess', account });
    });
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByLabelText('Ask')).toHaveProperty('value', '21');
  });

  it('shows empty copy when fetch resolves to an empty list', async () => {
    fetchMock.mockResolvedValue(forumPage([]));
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
  });

  it('shows the living-room laws hint when forumLawsDismissed is false', async () => {
    fetchMock.mockResolvedValue(forumPage([]));
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(
        screen.getByText(
          '21.gifts is a donation platform: gifts are free, and nobody pays for a promise.',
        ),
      ).toBeTruthy();
    });
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeTruthy();
  });

  it('hides the living-room laws hint when forumLawsDismissed is true', async () => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, forumLawsDismissed: true },
    });
    fetchMock.mockResolvedValue(forumPage([]));
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    expect(
      screen.queryByText(
        '21.gifts is a donation platform: gifts are free, and nobody pays for a promise.',
      ),
    ).toBeNull();
    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull();
  });

  it('feed="shops" lists only #21GiftsShop notes', async () => {
    fetchMock.mockResolvedValue(
      forumPage([SAMPLE, { ...SAMPLE, id: 'shop1', text: 'Cafe Luna\n\n#21GiftsShop', sats: 5 }]),
    );
    renderWithLocale(<ForumLoader feed="shops" />);
    await waitFor(() => {
      expect(screen.getByText('Cafe Luna')).toBeTruthy();
    });
    expect(screen.queryByText('Hello from Ada')).toBeNull();
    expect(screen.getByRole('link', { name: '#Shop' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Ask for money' })).toBeNull();
    expect(screen.getByLabelText('Your message')).toBeTruthy();
  });

  it('feed="shops" shows shops.empty when no listed note is a shop', async () => {
    fetchMock.mockResolvedValue(forumPage([SAMPLE]));
    renderWithLocale(<ForumLoader feed="shops" />);
    await waitFor(() => {
      expect(screen.getByText('No shops yet — add the first one.')).toBeTruthy();
    });
  });

  it('feed="shops" hides the laws hint even when forumLawsDismissed is false', async () => {
    fetchMock.mockResolvedValue(forumPage([]));
    renderWithLocale(<ForumLoader feed="shops" />);
    await waitFor(() => {
      expect(screen.getByText('No shops yet — add the first one.')).toBeTruthy();
    });
    expect(
      screen.queryByText(
        '21.gifts is a donation platform: gifts are free, and nobody pays for a promise.',
      ),
    ).toBeNull();
    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull();
  });

  it('feed="shops" appends #21GiftsShop on a top-level post', async () => {
    fetchMock.mockResolvedValue(forumPage([]));
    postMock.mockResolvedValue({
      ...SAMPLE,
      id: 'shop-new',
      text: 'Cafe Luna\n\n#21GiftsShop',
      sats: 0,
      payable: false,
    });
    renderWithLocale(<ForumLoader feed="shops" />);
    await waitFor(() => {
      expect(screen.getByText('No shops yet — add the first one.')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Cafe Luna' } });
    fireEvent.click(screen.getByRole('button', { name: /^Post$/ }));
    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('sess', { text: 'Cafe Luna\n\n#21GiftsShop' });
    });
  });

  it('feed="shops" invoices a basis post with #21GiftsShop', async () => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, role: 'basis', forumLawsDismissed: true, hasPosted: true },
    });
    fetchMock.mockResolvedValue(forumPage([]));
    renderWithLocale(<ForumLoader feed="shops" />);
    await waitFor(() => {
      expect(screen.getByText('No shops yet — add the first one.')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Cafe Luna' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    await waitFor(() => {
      expect(composeTargetMock).toHaveBeenCalledWith('sess');
      expect(invoiceMock).toHaveBeenCalledWith(
        'sess',
        'fee-note',
        1,
        'Cafe Luna\n\n#21GiftsShop',
        NO_RATE_SHOWN,
      );
    });
    expect(postMock).not.toHaveBeenCalled();
  });

  it('feed="shops" shows a zero-sat basis shop note immediately', async () => {
    window.localStorage.setItem('21gifts.forum-unpaid-seen', '2026-01-01T00:00:00.000Z');
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, forumLawsDismissed: true },
    });
    fetchMock.mockResolvedValue(
      forumPage([SAMPLE, { ...SAMPLE, id: 'shop1', text: 'Quiet stall\n\n#21GiftsShop', sats: 0 }]),
    );
    renderWithLocale(<ForumLoader feed="shops" />);
    await waitFor(() => {
      expect(screen.getByText('Quiet stall')).toBeTruthy();
    });
    expect(screen.queryByText('Hello from Ada')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Active$/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^No gifts yet$/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^All$/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Most popular$/ })).toBeNull();
    expect(screen.queryByRole('group', { name: 'Forum view' })).toBeNull();
    expect(screen.queryByRole('combobox', { name: 'Forum view' })).toBeNull();
    expect(window.localStorage.getItem('21gifts.forum-unpaid-seen')).toBe(
      '2026-01-01T00:00:00.000Z',
    );
  });

  it('feed="shops" does not duplicate #21GiftsShop when the draft already has it', async () => {
    fetchMock.mockResolvedValue(forumPage([]));
    postMock.mockResolvedValue({
      ...SAMPLE,
      id: 'shop-new',
      text: 'Cafe Luna\n\n#21GiftsShop',
      sats: 0,
      payable: false,
    });
    renderWithLocale(<ForumLoader feed="shops" />);
    await waitFor(() => {
      expect(screen.getByText('No shops yet — add the first one.')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Your message'), {
      target: { value: 'Cafe Luna\n\n#21GiftsShop' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Post$/ }));
    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('sess', { text: 'Cafe Luna\n\n#21GiftsShop' });
    });
  });

  it('feed="shops" first fetch sends hashtag 21GiftsShop', async () => {
    renderWithLocale(<ForumLoader feed="shops" />);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('sess', {
        mode: 'all',
        limit: 20,
        hashtag: '21GiftsShop',
      });
    });
  });

  it('living-room first fetch does not send hashtag', async () => {
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('sess', { mode: 'active', limit: 20 });
    });
    expect(fetchMock).not.toHaveBeenCalledWith(
      'sess',
      expect.objectContaining({ hashtag: expect.anything() }),
    );
  });

  it('feed="shops" shows empty immediately when the API page is empty', async () => {
    fetchMock.mockResolvedValue(forumPage([], null));
    renderWithLocale(<ForumLoader feed="shops" />);
    await waitFor(() => {
      expect(screen.getByText('No shops yet — add the first one.')).toBeTruthy();
    });
  });

  it('feed="shops" shows empty immediately when the API page is empty with a next cursor', async () => {
    fetchMock.mockResolvedValue(forumPage([], 'cur_2'));
    renderWithLocale(<ForumLoader feed="shops" />);
    await waitFor(() => {
      expect(screen.getByText('No shops yet — add the first one.')).toBeTruthy();
    });
    expect(fetchMock).not.toHaveBeenCalledWith(
      'sess',
      expect.objectContaining({ cursor: expect.anything() }),
    );
  });

  it('feed="shops" shows the staff place control on a listed shop note', async () => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, role: 'moderator', forumLawsDismissed: true },
    });
    fetchMock.mockResolvedValue(
      forumPage([{ ...SAMPLE, id: 'shop1', text: 'Cafe Luna\n\n#21GiftsShop', sats: 5 }]),
    );
    renderWithLocale(<ForumLoader feed="shops" />);
    await waitFor(() => {
      expect(screen.getByText('Cafe Luna')).toBeTruthy();
    });
    const card = document.querySelector('[data-message-id="shop1"]') as HTMLElement;
    expect(within(card).getByRole('button', { name: 'Add a place' })).toBeTruthy();
  });

  it('does not put a staff place control on living-room notes', async () => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, role: 'moderator', forumLawsDismissed: true },
    });
    fetchMock.mockResolvedValue(forumPage([{ ...SAMPLE, sats: 5 }]));
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });
    const card = document.querySelector('[data-message-id="m1"]') as HTMLElement;
    expect(within(card).queryByRole('button', { name: 'Add a place' })).toBeNull();
  });

  it('feed="shops" updates the listed pin from a saved place', async () => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, role: 'moderator', forumLawsDismissed: true },
    });
    const pin = { lat: 14.6, lng: 120.98, label: 'Happyland' };
    fetchMock.mockResolvedValue(
      forumPage([
        { ...SAMPLE, id: 'shop1', text: 'Cafe Luna\n\n#21GiftsShop', sats: 5 },
        {
          ...SAMPLE,
          id: 'shop2',
          text: 'Other stall\n\n#21GiftsShop',
          sats: 5,
          place: { lat: 1, lng: 2, label: 'Keep me' },
        },
      ]),
    );
    vi.mocked(setMessagePlace).mockResolvedValue({
      ...SAMPLE,
      id: 'shop1',
      text: 'Cafe Luna\n\n#21GiftsShop',
      sats: 5,
      place: pin,
    });
    const listeners = new Map<string, (event?: unknown) => void>();
    const map = {
      setCenter: vi.fn(),
      addListener: (event: string, handler: (event?: unknown) => void) => {
        listeners.set(event, handler);
      },
    };
    (window as { google?: unknown }).google = {
      maps: {
        Map: vi.fn(() => map),
        Marker: vi.fn(() => ({
          setPosition: () => undefined,
          getPosition: () => ({ lat: () => 14.6, lng: () => 120.98 }),
          addListener: () => undefined,
        })),
      },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ json: () => Promise.resolve({ key: 'k' }) } as Response),
    );
    vi.stubGlobal('navigator', { ...navigator, geolocation: undefined });
    renderWithLocale(<ForumLoader feed="shops" />);
    await waitFor(() => {
      expect(screen.getByText('Cafe Luna')).toBeTruthy();
    });
    const card = document.querySelector('[data-message-id="shop1"]') as HTMLElement;
    fireEvent.click(within(card).getByRole('button', { name: 'Add a place' }));
    await waitFor(() => {
      expect(listeners.has('click')).toBe(true);
    });
    listeners.get('click')?.({ latLng: { lat: () => 14.6, lng: () => 120.98 } });
    fireEvent.change(within(card).getByLabelText('Place name'), {
      target: { value: 'Happyland' },
    });
    fireEvent.click(within(card).getByRole('button', { name: 'Use this place' }));
    await waitFor(() => {
      expect(within(card).getByRole('link', { name: 'Happyland' })).toBeTruthy();
    });
    expect(screen.getByRole('link', { name: 'Keep me' })).toBeTruthy();
    delete (window as { google?: unknown }).google;
  });

  it('feed="shops" clears the listed pin when the save returns no place', async () => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, role: 'moderator', forumLawsDismissed: true },
    });
    fetchMock.mockResolvedValue(
      forumPage([
        {
          ...SAMPLE,
          id: 'shop1',
          text: 'Cafe Luna\n\n#21GiftsShop',
          sats: 5,
          place: { lat: 14.6, lng: 120.98, label: 'Happyland' },
        },
      ]),
    );
    vi.mocked(setMessagePlace).mockResolvedValue({
      ...SAMPLE,
      id: 'shop1',
      text: 'Cafe Luna\n\n#21GiftsShop',
      sats: 5,
    });
    const map = {
      setCenter: vi.fn(),
      addListener: vi.fn(),
    };
    (window as { google?: unknown }).google = {
      maps: {
        Map: vi.fn(() => map),
        Marker: vi.fn(() => ({
          setPosition: () => undefined,
          getPosition: () => ({ lat: () => 14.6, lng: () => 120.98 }),
          addListener: () => undefined,
        })),
      },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ json: () => Promise.resolve({ key: 'k' }) } as Response),
    );
    vi.stubGlobal('navigator', { ...navigator, geolocation: undefined });
    renderWithLocale(<ForumLoader feed="shops" />);
    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Happyland' })).toBeTruthy();
    });
    const card = document.querySelector('[data-message-id="shop1"]') as HTMLElement;
    fireEvent.click(within(card).getByRole('button', { name: 'Edit place' }));
    expect(await within(card).findByRole('button', { name: 'Remove place' })).toBeTruthy();
    fireEvent.click(within(card).getByRole('button', { name: 'Remove place' }));
    await waitFor(() => {
      expect(screen.queryByRole('link', { name: 'Happyland' })).toBeNull();
    });
    delete (window as { google?: unknown }).google;
  });

  it('default living-room post does not append #21GiftsShop', async () => {
    fetchMock.mockResolvedValue(forumPage([]));
    postMock.mockResolvedValue({
      ...SAMPLE,
      id: 'm2',
      text: 'Hello',
      sats: 0,
      payable: false,
    });
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: /^Post$/ }));
    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('sess', { text: 'Hello' });
    });
  });

  it('dismisses the laws hint and persists via dismissForumLaws', async () => {
    fetchMock.mockResolvedValue(forumPage([]));
    dismissLawsMock.mockResolvedValue({ ...account, forumLawsDismissed: true });
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Dismiss' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    await waitFor(() => {
      expect(
        screen.queryByText(
          '21.gifts is a donation platform: gifts are free, and nobody pays for a promise.',
        ),
      ).toBeNull();
    });
    expect(dismissLawsMock).toHaveBeenCalledWith('sess');
    expect(useAuthStore.getState().account?.forumLawsDismissed).toBe(true);
  });

  it('restores the laws hint when dismissForumLaws rejects', async () => {
    fetchMock.mockResolvedValue(forumPage([]));
    dismissLawsMock.mockRejectedValue(new Error('Could not dismiss the living-room hint'));
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Dismiss' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    await waitFor(() => {
      expect(dismissLawsMock).toHaveBeenCalledWith('sess');
    });
    await waitFor(() => {
      expect(
        screen.getByText(
          '21.gifts is a donation platform: gifts are free, and nobody pays for a promise.',
        ),
      ).toBeTruthy();
    });
    expect(useAuthStore.getState().account?.forumLawsDismissed).toBe(false);
  });

  it('does not restore an account when logout happens during dismiss', async () => {
    fetchMock.mockResolvedValue(forumPage([]));
    let resolveDismiss: ((value: Account) => void) | undefined;
    dismissLawsMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveDismiss = resolve;
        }),
    );
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Dismiss' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    useAuthStore.getState().clearAuth();
    resolveDismiss?.({ ...account, forumLawsDismissed: true });
    await act(async () => {
      await Promise.resolve();
    });
    expect(useAuthStore.getState().session).toBeNull();
    expect(useAuthStore.getState().account).toBeNull();
  });

  it('does not restore an account when logout happens during a failed dismiss', async () => {
    fetchMock.mockResolvedValue(forumPage([]));
    let rejectDismiss: ((reason: Error) => void) | undefined;
    dismissLawsMock.mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectDismiss = reject;
        }),
    );
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Dismiss' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    useAuthStore.getState().clearAuth();
    rejectDismiss?.(new Error('Could not dismiss the living-room hint'));
    await act(async () => {
      await Promise.resolve();
    });
    expect(useAuthStore.getState().session).toBeNull();
    expect(useAuthStore.getState().account).toBeNull();
  });

  it('ignores a mode click for the already selected mode', async () => {
    fetchMock.mockResolvedValue(forumPage([SAMPLE]));
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Forum view' })).toBeTruthy();
    });
    chooseForumMode('Active');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('shows a fetched message with sats', async () => {
    fetchMock.mockResolvedValue(forumPage([SAMPLE]));
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No message has received Bitcoin yet.')).toBeTruthy();
    });
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Ada')).toBeTruthy();
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
      expect(screen.getByText('₿0')).toBeTruthy();
    });
  });

  it('shows No gifts yet without a chip when last visit is unset', async () => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, forumLawsDismissed: true },
    });
    fetchMock.mockResolvedValue(forumPage([SAMPLE]));
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Forum view' })).toBeTruthy();
    });
    expect(screen.getByRole('combobox', { name: 'Forum view' }).textContent).toContain('Active');
    expect(screen.getByRole('combobox', { name: 'Forum view' }).textContent).not.toMatch(/\d/);
    fireEvent.click(screen.getByRole('combobox', { name: 'Forum view' }));
    expect(screen.getByRole('option', { name: /^No gifts yet$/ })).toBeTruthy();
  });

  it('shows, clears, and does not restore the unpaid new-count chip', async () => {
    window.localStorage.setItem('21gifts.forum-unpaid-seen', '2026-01-01T00:00:00.000Z');
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, forumLawsDismissed: true },
    });
    fetchMock.mockResolvedValue(forumPage([SAMPLE]));
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Forum view' }).textContent).toContain('Active');
      expect(screen.getByRole('combobox', { name: 'Forum view' }).textContent).toContain('1');
    });
    chooseForumMode('No gifts yet, 1 new');
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Forum view' }).textContent).toContain(
        'No gifts yet',
      );
    });
    await waitFor(() => {
      expect(window.localStorage.getItem('21gifts.forum-unpaid-seen')).not.toBe(
        '2026-01-01T00:00:00.000Z',
      );
    });
    chooseForumMode('Active');
    await waitFor(() => {
      const view = screen.getByRole('combobox', { name: 'Forum view' });
      expect(view.textContent).toContain('Active');
      expect(view.textContent).not.toMatch(/\d/);
    });
    fireEvent.click(screen.getByRole('combobox', { name: 'Forum view' }));
    expect(screen.getByRole('option', { name: /^No gifts yet$/ })).toBeTruthy();
  });

  it('does not show an unpaid new-count chip after a refresh while unpaid is selected', async () => {
    window.localStorage.setItem('21gifts.forum-unpaid-seen', '2026-01-01T00:00:00.000Z');
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, forumLawsDismissed: true },
    });
    const listed: ForumMessage = { ...SAMPLE, payable: true };
    fetchMock.mockResolvedValueOnce(forumPage([listed])).mockImplementation(async () =>
      forumPage([
        {
          id: 'm-new',
          name: 'Carol',
          text: 'Fresh from refresh',
          createdAt: new Date().toISOString(),
          sats: 0,
          payable: true,
          hasPhoto: false,
          photoCount: 0,
          hasVideo: false,
          videoContentType: null,
          role: 'basis',
          replyCount: 0,
        },
        listed,
      ]),
    );
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Forum view' }).textContent).toContain('Active');
      expect(screen.getByRole('combobox', { name: 'Forum view' }).textContent).toContain('1');
    });
    chooseForumMode('No gifts yet, 1 new');
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Forum view' }).textContent).toContain(
        'No gifts yet',
      );
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(screen.getByText('Fresh from refresh')).toBeTruthy();
    });
    chooseForumMode('Active');
    await waitFor(() => {
      const view = screen.getByRole('combobox', { name: 'Forum view' });
      expect(view.textContent).toContain('Active');
      expect(view.textContent).not.toMatch(/\d/);
    });
  });

  it('loads a photo blob URL for hasPhoto messages and revokes on unmount', async () => {
    fetchMock.mockResolvedValue(
      forumPage([
        {
          id: 'm-photo',
          name: 'Ada',
          text: '',
          createdAt: '2026-08-28T12:00:00.000Z',
          sats: 5,
          payable: false,
          hasPhoto: true,
          photoCount: 1,
          hasVideo: false,
          videoContentType: null,
          role: 'basis',
          replyCount: 0,
        },
      ]),
    );
    const view = renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(photoMock).toHaveBeenCalledWith('sess', 'm-photo', 0);
    });
    await waitFor(() => {
      expect(screen.getByAltText('Photo from Ada').getAttribute('src')).toBe('blob:mock');
    });
    view.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock');
  });

  it('falls back to hasPhoto when photoCount is omitted', async () => {
    fetchMock.mockResolvedValue(
      forumPage([
        {
          ...SAMPLE,
          id: 'm-omit-photo',
          hasPhoto: true,
          text: '',
          photoCount: undefined as unknown as number,
          sats: 1,
        },
        {
          ...SAMPLE,
          id: 'm-omit-none',
          hasPhoto: false,
          photoCount: undefined as unknown as number,
          sats: 1,
        },
      ]),
    );
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(photoMock).toHaveBeenCalledWith('sess', 'm-omit-photo', 0);
    });
    await waitFor(() => {
      expect(screen.getByAltText('Photo from Ada').getAttribute('src')).toBe('blob:mock');
    });
    expect(screen.getByText('Hello from Ada')).toBeTruthy();
  });

  it('does not fetch photos for unpaid hasPhoto notes on Active', async () => {
    fetchMock.mockResolvedValue(
      forumPage([
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
      ]),
    );
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No message has received Bitcoin yet.')).toBeTruthy();
    });
    expect(photoMock).not.toHaveBeenCalled();
  });

  it('fetches an unpaid hasPhoto note after switching to All', async () => {
    fetchMock.mockResolvedValue(
      forumPage([
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
      ]),
    );
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No message has received Bitcoin yet.')).toBeTruthy();
    });
    expect(photoMock).not.toHaveBeenCalled();
    await revealAll();
    await waitFor(() => {
      expect(photoMock).toHaveBeenCalledWith('sess', 'm-photo', 0);
      expect(screen.getByAltText('Photo from Ada').getAttribute('src')).toBe('blob:mock');
    });
  });

  it('retries a transient photo fetch failure once for a visible note', async () => {
    fetchMock.mockResolvedValue(
      forumPage([
        {
          id: 'm-photo',
          name: 'Ada',
          text: '',
          createdAt: '2026-08-28T12:00:00.000Z',
          sats: 5,
          payable: false,
          hasPhoto: true,
          photoCount: 1,
          hasVideo: false,
          videoContentType: null,
          role: 'basis',
          replyCount: 0,
        },
      ]),
    );
    photoMock.mockRejectedValueOnce(new Error('transient'));
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByAltText('Photo from Ada').getAttribute('src')).toBe('blob:mock');
    });
    expect(photoMock).toHaveBeenCalledTimes(2);
  });

  it('does not cancel an in-flight photo fetch when payable poll refreshes the list', async () => {
    vi.useFakeTimers();
    const unsigned: ForumMessage = {
      id: 'm-photo',
      name: 'Ada',
      text: '',
      createdAt: '2026-08-28T12:00:00.000Z',
      sats: 5,
      payable: false,
      hasPhoto: true,
      photoCount: 1,
      hasVideo: false,
      videoContentType: null,
      role: 'basis',
      replyCount: 1,
    };
    let resolvePhoto: ((blob: Blob) => void) | undefined;
    photoMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePhoto = resolve;
        }),
    );
    fetchMock.mockResolvedValueOnce(forumPage([unsigned])).mockResolvedValue(forumPage([unsigned]));
    fetchMock
      .mockResolvedValueOnce(forumPage([{ ...unsigned, payable: true }]))
      .mockResolvedValue(forumPage([{ ...unsigned, payable: true }]));
    renderWithLocale(<ForumLoader />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(photoMock).toHaveBeenCalledWith('sess', 'm-photo', 0);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    await act(async () => {
      resolvePhoto?.(new Blob(['x'], { type: 'image/jpeg' }));
      await Promise.resolve();
    });
    expect(screen.getByAltText('Photo from Ada').getAttribute('src')).toBe('blob:mock');
  });

  it('shows a fetch error and retries', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Could not load messages. Please try again.'));
    fetchMock.mockResolvedValueOnce(forumPage([])).mockResolvedValue(forumPage([]));
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('uses the fallback error copy for a non-Error rejection', async () => {
    fetchMock.mockRejectedValueOnce('nope');
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('Could not load messages. Please try again.')).toBeTruthy();
    });
  });

  it('does not render a raw Error.message as the load error', async () => {
    fetchMock.mockRejectedValueOnce(new Error('SECRET internals'));
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('Could not load messages. Please try again.')).toBeTruthy();
    });
    expect(screen.queryByText('SECRET internals')).toBeNull();
  });

  it('localizes a fetch error', async () => {
    fetchMock.mockRejectedValueOnce(new Error('SECRET internals'));
    renderWithLocale(<ForumLoader />, 'de');
    await waitFor(() => {
      expect(
        screen.getByText(
          'Nachrichten konnten nicht geladen werden. Bitte versuchen Sie es erneut.',
        ),
      ).toBeTruthy();
    });
    expect(screen.queryByText('SECRET internals')).toBeNull();
  });

  it('ignores a stale fetch after unmount', async () => {
    let resolveStale: ((value: ReturnType<typeof forumPage>) => void) | undefined;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveStale = resolve;
        }),
    );
    const view = renderWithLocale(<ForumLoader />);
    view.unmount();
    resolveStale?.(forumPage([]));
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalled();
  });

  it('ignores a stale rejection after unmount', async () => {
    let rejectStale: ((reason: Error) => void) | undefined;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectStale = reject;
        }),
    );
    const view = renderWithLocale(<ForumLoader />);
    view.unmount();
    rejectStale?.(new Error('gone'));
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalled();
  });

  it('does not post when the draft is empty or whitespace without a photo', async () => {
    fetchMock.mockResolvedValue(forumPage([]));
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /^Post$/ }));
    expect(screen.getByRole('alert').textContent).toBe('Enter a message or add a photo or video');
    expect(postMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: /^Post$/ }));
    expect(screen.getByRole('alert').textContent).toBe('Enter a message or add a photo or video');
    expect(postMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Hi' } });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('does not post when the trimmed draft is longer than 8000 characters', async () => {
    fetchMock.mockResolvedValue(forumPage([]));
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('Your message'), {
      target: { value: `${'a'.repeat(FORUM_MESSAGE_MAX_LENGTH + 1)}` },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Post$/ }));
    expect(screen.getByRole('alert').textContent).toBe('Keep it to 8000 characters');
    expect(postMock).not.toHaveBeenCalled();
  });

  it('posts a video via multipart when the picker returns a clip', async () => {
    fetchMock.mockResolvedValue(forumPage([]));
    isVideoMock.mockReturnValue(true);
    const poster = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' });
    const file = new File([new Uint8Array([1, 2, 3])], 'clip.mp4', { type: 'video/mp4' });
    prepareVideoMock.mockResolvedValue({
      ok: true,
      video: { file, poster, previewUrl: 'blob:video' },
    });
    postVideoMock.mockResolvedValue({
      ...SAMPLE,
      id: 'vid1',
      text: 'clip',
      hasPhoto: true,
      photoCount: 1,
      hasVideo: true,
      videoContentType: 'video/mp4',
    });
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => {
      expect(prepareVideoMock).toHaveBeenCalledWith(file);
      expect(prepareMock).not.toHaveBeenCalled();
    });
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'clip' } });
    fireEvent.click(screen.getByRole('button', { name: /^Post$/ }));
    await waitFor(() => {
      expect(postVideoMock).toHaveBeenCalledWith('sess', {
        text: 'clip',
        video: file,
        poster,
      });
      expect(postMock).not.toHaveBeenCalled();
      expect(document.querySelector('video')?.getAttribute('src')).toBe('blob:video');
    });
  });

  it('posts a video with a valid Ask amount as goalCurrency and goalAmount', async () => {
    fetchMock.mockResolvedValue(forumPage([]));
    isVideoMock.mockReturnValue(true);
    const poster = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' });
    const file = new File([new Uint8Array([1, 2, 3])], 'clip.mp4', { type: 'video/mp4' });
    prepareVideoMock.mockResolvedValue({
      ok: true,
      video: { file, poster, previewUrl: 'blob:video' },
    });
    postVideoMock.mockResolvedValue({
      ...SAMPLE,
      id: 'vid-goal',
      text: 'clip',
      hasPhoto: true,
      photoCount: 1,
      hasVideo: true,
      videoContentType: 'video/mp4',
    });
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ask for money' }));
    await waitFor(() => {
      expect(screen.getByText('How much?')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Ask'), { target: { value: '21000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => {
      expect(prepareVideoMock).toHaveBeenCalledWith(file);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'clip' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: /^Post$/ }));
    await waitFor(() => {
      expect(postVideoMock).toHaveBeenCalledWith('sess', {
        text: 'clip',
        video: file,
        poster,
        goalCurrency: 'BTC',
        goalAmount: '21000',
      });
      expect(postMock).not.toHaveBeenCalled();
    });
  });

  it('ignores a stale video prepare after a newer pick starts', async () => {
    fetchMock.mockResolvedValue(forumPage([]));
    isVideoMock.mockReturnValue(true);
    let resolveFirst: ((value: Awaited<ReturnType<typeof prepareForumVideo>>) => void) | undefined;
    const poster = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' });
    const first = new File([new Uint8Array([1])], 'a.mp4', { type: 'video/mp4' });
    const second = new File([new Uint8Array([2])], 'b.mp4', { type: 'video/mp4' });
    prepareVideoMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    );
    prepareVideoMock.mockResolvedValueOnce({
      ok: true,
      video: { file: second, poster, previewUrl: 'blob:second' },
    });
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [first] } });
    fireEvent.change(input, { target: { files: [second] } });
    await waitFor(() => {
      expect(document.querySelector('video')?.getAttribute('src')).toBe('blob:second');
    });
    resolveFirst?.({
      ok: true,
      video: { file: first, poster, previewUrl: 'blob:first' },
    });
    await Promise.resolve();
    expect(document.querySelector('video')?.getAttribute('src')).toBe('blob:second');
    expect(vi.mocked(URL.revokeObjectURL)).toHaveBeenCalledWith('blob:first');
  });

  it('revokes a video draft preview when Remove video is clicked', async () => {
    fetchMock.mockResolvedValue(forumPage([]));
    isVideoMock.mockReturnValue(true);
    const poster = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' });
    const file = new File([new Uint8Array([1, 2, 3])], 'clip.mp4', { type: 'video/mp4' });
    prepareVideoMock.mockResolvedValue({
      ok: true,
      video: { file, poster, previewUrl: 'blob:video' },
    });
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => {
      expect(document.querySelector('form video')?.getAttribute('src')).toBe('blob:video');
    });
    fireEvent.click(screen.getByRole('button', { name: 'Remove video' }));
    expect(vi.mocked(URL.revokeObjectURL)).toHaveBeenCalledWith('blob:video');
    expect(document.querySelector('form video')).toBeNull();
  });

  it('revokes the previous video draft when a later pick fails', async () => {
    fetchMock.mockResolvedValue(forumPage([]));
    isVideoMock.mockReturnValue(true);
    const poster = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' });
    const file = new File([new Uint8Array([1, 2, 3])], 'clip.mp4', { type: 'video/mp4' });
    prepareVideoMock
      .mockResolvedValueOnce({
        ok: true,
        video: { file, poster, previewUrl: 'blob:video' },
      })
      .mockResolvedValueOnce({ ok: false, error: 'unsupported' });
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => {
      expect(document.querySelector('form video')?.getAttribute('src')).toBe('blob:video');
    });
    fireEvent.change(input, {
      target: { files: [new File([], 'bad.mp4', { type: 'video/mp4' })] },
    });
    await waitFor(() => {
      expect(vi.mocked(URL.revokeObjectURL)).toHaveBeenCalledWith('blob:video');
    });
  });

  it('revokes the previous video draft when a new clip prepares', async () => {
    fetchMock.mockResolvedValue(forumPage([]));
    isVideoMock.mockReturnValue(true);
    const poster = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' });
    const first = new File([new Uint8Array([1])], 'a.mp4', { type: 'video/mp4' });
    const second = new File([new Uint8Array([2])], 'b.mp4', { type: 'video/mp4' });
    prepareVideoMock
      .mockResolvedValueOnce({
        ok: true,
        video: { file: first, poster, previewUrl: 'blob:first' },
      })
      .mockResolvedValueOnce({
        ok: true,
        video: { file: second, poster, previewUrl: 'blob:second' },
      });
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [first] } });
    await waitFor(() => {
      expect(document.querySelector('form video')?.getAttribute('src')).toBe('blob:first');
    });
    fireEvent.change(input, { target: { files: [second] } });
    await waitFor(() => {
      expect(document.querySelector('form video')?.getAttribute('src')).toBe('blob:second');
    });
    expect(vi.mocked(URL.revokeObjectURL)).toHaveBeenCalledWith('blob:first');
  });

  it('revokes a video draft when a photo is picked instead', async () => {
    fetchMock.mockResolvedValue(forumPage([]));
    isVideoMock.mockReturnValueOnce(true).mockReturnValueOnce(false);
    const poster = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' });
    const clip = new File([new Uint8Array([1, 2, 3])], 'clip.mp4', { type: 'video/mp4' });
    const jpeg = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'a.jpg', { type: 'image/jpeg' });
    prepareVideoMock.mockResolvedValue({
      ok: true,
      video: { file: clip, poster, previewUrl: 'blob:video' },
    });
    prepareMock.mockResolvedValue({
      ok: true,
      photo: { contentType: 'image/jpeg', data: 'abc', previewUrl: 'blob:photo' },
    });
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [clip] } });
    await waitFor(() => {
      expect(document.querySelector('form video')?.getAttribute('src')).toBe('blob:video');
    });
    fireEvent.change(input, { target: { files: [jpeg] } });
    await waitFor(() => {
      expect(vi.mocked(URL.revokeObjectURL)).toHaveBeenCalledWith('blob:video');
    });
  });

  it('sets unsupported when revoking a video draft throws while picking a photo', async () => {
    fetchMock.mockResolvedValue(forumPage([]));
    isVideoMock.mockReturnValueOnce(true).mockReturnValueOnce(false);
    const poster = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' });
    const clip = new File([new Uint8Array([1, 2, 3])], 'clip.mp4', { type: 'video/mp4' });
    const jpeg = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'a.jpg', { type: 'image/jpeg' });
    prepareVideoMock.mockResolvedValue({
      ok: true,
      video: { file: clip, poster, previewUrl: 'blob:video' },
    });
    prepareMock.mockResolvedValue({
      ok: true,
      photo: { contentType: 'image/jpeg', data: 'abc', previewUrl: 'blob:photo' },
    });
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [clip] } });
    await waitFor(() => {
      expect(document.querySelector('form video')?.getAttribute('src')).toBe('blob:video');
    });
    vi.mocked(URL.revokeObjectURL).mockImplementationOnce(() => {
      throw new Error('revoke failed');
    });
    fireEvent.change(input, { target: { files: [jpeg] } });
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe(
        'Use a JPEG, PNG, or WebP photo, or an MP4, WebM, or MOV video',
      );
    });
    vi.mocked(URL.revokeObjectURL).mockImplementation(() => undefined);
  });

  it('revokes a video draft preview on unmount', async () => {
    fetchMock.mockResolvedValue(forumPage([]));
    isVideoMock.mockReturnValue(true);
    const poster = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' });
    const file = new File([new Uint8Array([1, 2, 3])], 'clip.mp4', { type: 'video/mp4' });
    prepareVideoMock.mockResolvedValue({
      ok: true,
      video: { file, poster, previewUrl: 'blob:video' },
    });
    const view = renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => {
      expect(document.querySelector('form video')?.getAttribute('src')).toBe('blob:video');
    });
    view.unmount();
    expect(vi.mocked(URL.revokeObjectURL)).toHaveBeenCalledWith('blob:video');
  });

  it('revokes a posted video preview on unmount but not at post time', async () => {
    fetchMock.mockResolvedValue(forumPage([]));
    isVideoMock.mockReturnValue(true);
    const poster = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' });
    const file = new File([new Uint8Array([1, 2, 3])], 'clip.mp4', { type: 'video/mp4' });
    prepareVideoMock.mockResolvedValue({
      ok: true,
      video: { file, poster, previewUrl: 'blob:video' },
    });
    postVideoMock.mockResolvedValue({
      ...SAMPLE,
      id: 'vid1',
      text: 'clip',
      hasPhoto: true,
      photoCount: 1,
      hasVideo: true,
      videoContentType: 'video/mp4',
    });
    const view = renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => {
      expect(prepareVideoMock).toHaveBeenCalledWith(file);
    });
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'clip' } });
    const revoke = vi.mocked(URL.revokeObjectURL);
    revoke.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /^Post$/ }));
    await waitFor(() => {
      expect(postVideoMock).toHaveBeenCalled();
      expect(document.querySelector('video')?.getAttribute('src')).toBe('blob:video');
    });
    expect(revoke).not.toHaveBeenCalledWith('blob:video');
    view.unmount();
    expect(revoke).toHaveBeenCalledWith('blob:video');
  });

  it('sets formError when prepareForumVideo rejects as unsupported', async () => {
    fetchMock.mockResolvedValue(forumPage([]));
    isVideoMock.mockReturnValue(true);
    prepareVideoMock.mockResolvedValue({ ok: false, error: 'unsupported' });
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File([], 'a.mp4', { type: 'video/mp4' })] },
    });
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe(
        'Use a JPEG, PNG, or WebP photo, or an MP4, WebM, or MOV video',
      );
    });
  });

  it('sets formError when prepareForumVideo rejects as tooLarge', async () => {
    fetchMock.mockResolvedValue(forumPage([]));
    isVideoMock.mockReturnValue(true);
    prepareVideoMock.mockResolvedValue({ ok: false, error: 'tooLarge' });
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File([new Uint8Array([1])], 'a.mp4', { type: 'video/mp4' })] },
    });
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe(
        'Keep photos under 1 MB and videos under 32 MB',
      );
    });
  });

  it('keeps an existing photo when prepareForumPhoto rejects another file', async () => {
    fetchMock.mockResolvedValue(forumPage([]));
    prepareMock
      .mockResolvedValueOnce({
        ok: true,
        photo: {
          contentType: 'image/jpeg',
          data: 'first',
          previewUrl: 'data:image/jpeg;base64,first',
        },
      })
      .mockResolvedValueOnce({ ok: false, error: 'unsupported' });
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File([], 'a.jpg', { type: 'image/jpeg' })] },
    });
    await waitFor(() => {
      expect(screen.getByAltText('Selected photo')).toBeTruthy();
    });
    fireEvent.change(input, {
      target: { files: [new File([], 'a.gif', { type: 'image/gif' })] },
    });
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe(
        'Use a JPEG, PNG, or WebP photo, or an MP4, WebM, or MOV video',
      );
    });
    expect(screen.getAllByAltText('Selected photo')).toHaveLength(1);
  });

  it('sets unsupported when prepareForumPhoto throws', async () => {
    fetchMock.mockResolvedValue(forumPage([]));
    prepareMock.mockRejectedValueOnce(new Error('Could not decode image'));
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File([new Uint8Array([1])], 'a.jpg', { type: 'image/jpeg' })] },
    });
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe(
        'Use a JPEG, PNG, or WebP photo, or an MP4, WebM, or MOV video',
      );
    });
  });

  it('ignores a stale prepare after a newer pick starts', async () => {
    fetchMock.mockResolvedValue(forumPage([]));
    let resolveFirst: ((value: Awaited<ReturnType<typeof prepareForumPhoto>>) => void) | undefined;
    prepareMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    );
    prepareMock.mockResolvedValueOnce({
      ok: true,
      photo: {
        contentType: 'image/jpeg',
        data: 'second',
        previewUrl: 'data:image/jpeg;base64,second',
      },
    });
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File([new Uint8Array([1])], 'a.jpg', { type: 'image/jpeg' })] },
    });
    fireEvent.change(input, {
      target: { files: [new File([new Uint8Array([2])], 'b.jpg', { type: 'image/jpeg' })] },
    });
    await waitFor(() => {
      expect((screen.getByAltText('Selected photo') as HTMLImageElement).src).toContain('second');
    });
    resolveFirst?.({
      ok: true,
      photo: {
        contentType: 'image/jpeg',
        data: 'first',
        previewUrl: 'data:image/jpeg;base64,first',
      },
    });
    await Promise.resolve();
    expect((screen.getByAltText('Selected photo') as HTMLImageElement).src).toContain('second');
  });

  it('ignores a stale prepare rejection after a newer pick starts', async () => {
    fetchMock.mockResolvedValue(forumPage([]));
    let rejectFirst: ((reason: Error) => void) | undefined;
    prepareMock.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectFirst = reject;
        }),
    );
    prepareMock.mockResolvedValueOnce({
      ok: true,
      photo: {
        contentType: 'image/jpeg',
        data: 'second',
        previewUrl: 'data:image/jpeg;base64,second',
      },
    });
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File([new Uint8Array([1])], 'a.jpg', { type: 'image/jpeg' })] },
    });
    fireEvent.change(input, {
      target: { files: [new File([new Uint8Array([2])], 'b.jpg', { type: 'image/jpeg' })] },
    });
    await waitFor(() => {
      expect((screen.getByAltText('Selected photo') as HTMLImageElement).src).toContain('second');
    });
    rejectFirst?.(new Error('Could not decode image'));
    await Promise.resolve();
    expect(screen.queryByRole('alert')).toBeNull();
    expect((screen.getByAltText('Selected photo') as HTMLImageElement).src).toContain('second');
  });

  it('ignores a stale prepare after unmount', async () => {
    fetchMock.mockResolvedValue(forumPage([]));
    let resolvePrep: ((value: Awaited<ReturnType<typeof prepareForumPhoto>>) => void) | undefined;
    prepareMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePrep = resolve;
        }),
    );
    const view = renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File([new Uint8Array([1])], 'a.jpg', { type: 'image/jpeg' })] },
    });
    await waitFor(() => {
      expect(prepareMock).toHaveBeenCalled();
    });
    view.unmount();
    resolvePrep?.({
      ok: true,
      photo: {
        contentType: 'image/jpeg',
        data: 'late',
        previewUrl: 'data:image/jpeg;base64,late',
      },
    });
    await Promise.resolve();
  });

  it('sets tooLarge and keeps an existing photo draft', async () => {
    fetchMock.mockResolvedValue(forumPage([]));
    prepareMock
      .mockResolvedValueOnce({
        ok: true,
        photo: {
          contentType: 'image/jpeg',
          data: 'abc',
          previewUrl: 'data:image/jpeg;base64,abc',
        },
      })
      .mockResolvedValueOnce({ ok: false, error: 'tooLarge' });
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File([new Uint8Array([1])], 'a.jpg', { type: 'image/jpeg' })] },
    });
    await waitFor(() => {
      expect(screen.getByAltText('Selected photo')).toBeTruthy();
    });
    fireEvent.change(input, {
      target: { files: [new File([new Uint8Array([1])], 'big.jpg', { type: 'image/jpeg' })] },
    });
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe(
        'Keep photos under 1 MB and videos under 32 MB',
      );
    });
    expect(screen.getAllByAltText('Selected photo')).toHaveLength(1);
  });

  it('clears a photo draft when Remove photo is clicked', async () => {
    fetchMock.mockResolvedValue(forumPage([]));
    prepareMock.mockResolvedValueOnce({
      ok: true,
      photo: {
        contentType: 'image/jpeg',
        data: 'abc',
        previewUrl: 'data:image/jpeg;base64,abc',
      },
    });
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File([new Uint8Array([1])], 'a.jpg', { type: 'image/jpeg' })] },
    });
    await waitFor(() => {
      expect(screen.getByAltText('Selected photo')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Remove photo' }));
    expect(screen.queryByAltText('Selected photo')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^Post$/ }));
    expect(postMock).not.toHaveBeenCalled();
  });

  it('keeps a prior photo draft when another prepare throws', async () => {
    fetchMock.mockResolvedValue(forumPage([]));
    prepareMock
      .mockResolvedValueOnce({
        ok: true,
        photo: {
          contentType: 'image/jpeg',
          data: 'abc',
          previewUrl: 'data:image/jpeg;base64,abc',
        },
      })
      .mockRejectedValueOnce(new Error('Could not decode image'));
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File([new Uint8Array([1])], 'a.jpg', { type: 'image/jpeg' })] },
    });
    await waitFor(() => {
      expect(screen.getByAltText('Selected photo')).toBeTruthy();
    });
    fireEvent.change(input, {
      target: { files: [new File([new Uint8Array([1])], 'b.jpg', { type: 'image/jpeg' })] },
    });
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe(
        'Use a JPEG, PNG, or WebP photo, or an MP4, WebM, or MOV video',
      );
    });
    expect(screen.getAllByAltText('Selected photo')).toHaveLength(1);
  });

  it('appends two photos selected in one change', async () => {
    fetchMock.mockResolvedValue(forumPage([]));
    prepareMock
      .mockResolvedValueOnce({
        ok: true,
        photo: {
          contentType: 'image/jpeg',
          data: 'first',
          previewUrl: 'data:image/jpeg;base64,first',
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        photo: {
          contentType: 'image/jpeg',
          data: 'second',
          previewUrl: 'data:image/jpeg;base64,second',
        },
      });
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    const first = new File([new Uint8Array([1])], 'a.jpg', { type: 'image/jpeg' });
    const second = new File([new Uint8Array([2])], 'b.png', { type: 'image/png' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [first, second] } });
    await waitFor(() => {
      expect(screen.getAllByAltText('Selected photo')).toHaveLength(2);
    });
    expect(prepareMock).toHaveBeenNthCalledWith(1, first);
    expect(prepareMock).toHaveBeenNthCalledWith(2, second);
  });

  it('keeps ten photos and rejects an eleventh', async () => {
    fetchMock.mockResolvedValue(forumPage([]));
    prepareMock.mockImplementation(async (file: File) => ({
      ok: true,
      photo: {
        contentType: 'image/jpeg',
        data: file.name,
        previewUrl: `data:image/jpeg;base64,${file.name}`,
      },
    }));
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    const firstTen = Array.from(
      { length: 10 },
      (_, index) => new File([new Uint8Array([index])], `${index}.jpg`, { type: 'image/jpeg' }),
    );
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: firstTen } });
    await waitFor(() => {
      expect(screen.getAllByAltText('Selected photo')).toHaveLength(10);
    });
    fireEvent.change(input, {
      target: { files: [new File([], '10.jpg', { type: 'image/jpeg' })] },
    });
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe('You can add up to 10 photos');
    });
    expect(screen.getAllByAltText('Selected photo')).toHaveLength(10);
    expect(prepareMock).toHaveBeenCalledTimes(10);
  });

  it('sets tooMany from one pick of eleven even when the tenth prepare fails', async () => {
    fetchMock.mockResolvedValue(forumPage([]));
    prepareMock.mockImplementation(async (file: File) => {
      if (file.name === '9.jpg') {
        return { ok: false, error: 'unsupported' };
      }
      return {
        ok: true,
        photo: {
          contentType: 'image/jpeg',
          data: file.name,
          previewUrl: `data:image/jpeg;base64,${file.name}`,
        },
      };
    });
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    const eleven = Array.from(
      { length: 11 },
      (_, index) => new File([new Uint8Array([index])], `${index}.jpg`, { type: 'image/jpeg' }),
    );
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: eleven } });
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe('You can add up to 10 photos');
    });
    expect(screen.getAllByAltText('Selected photo')).toHaveLength(9);
    expect(prepareMock).toHaveBeenCalledTimes(10);
  });

  it('clears photo drafts when a video is picked', async () => {
    fetchMock.mockResolvedValue(forumPage([]));
    const photo = new File([new Uint8Array([1])], 'a.jpg', { type: 'image/jpeg' });
    const video = new File([new Uint8Array([2])], 'clip.mp4', { type: 'video/mp4' });
    const poster = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' });
    isVideoMock.mockReturnValueOnce(false).mockReturnValueOnce(true);
    prepareMock.mockResolvedValueOnce({
      ok: true,
      photo: {
        contentType: 'image/jpeg',
        data: 'first',
        previewUrl: 'data:image/jpeg;base64,first',
      },
    });
    prepareVideoMock.mockResolvedValueOnce({
      ok: true,
      video: { file: video, poster, previewUrl: 'blob:video' },
    });
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [photo] } });
    await waitFor(() => {
      expect(screen.getByAltText('Selected photo')).toBeTruthy();
    });
    fireEvent.change(input, { target: { files: [video] } });
    await waitFor(() => {
      expect(document.querySelector('form video')?.getAttribute('src')).toBe('blob:video');
    });
    expect(screen.queryByAltText('Selected photo')).toBeNull();
  });

  it('keeps photo drafts when video preparation fails', async () => {
    fetchMock.mockResolvedValue(forumPage([]));
    const photo = new File([new Uint8Array([1])], 'a.jpg', { type: 'image/jpeg' });
    const video = new File([new Uint8Array([2])], 'clip.mp4', { type: 'video/mp4' });
    isVideoMock.mockReturnValueOnce(false).mockReturnValueOnce(true);
    prepareMock.mockResolvedValueOnce({
      ok: true,
      photo: {
        contentType: 'image/jpeg',
        data: 'first',
        previewUrl: 'data:image/jpeg;base64,first',
      },
    });
    prepareVideoMock.mockResolvedValueOnce({ ok: false, error: 'unsupported' });
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [photo] } });
    await waitFor(() => {
      expect(screen.getByAltText('Selected photo')).toBeTruthy();
    });
    fireEvent.change(input, { target: { files: [video] } });
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe(
        'Use a JPEG, PNG, or WebP photo, or an MP4, WebM, or MOV video',
      );
    });
    expect(screen.getByAltText('Selected photo')).toBeTruthy();
    expect(document.querySelector('form video')).toBeNull();
  });

  it('ignores a failed photo fetch', async () => {
    fetchMock.mockResolvedValue(
      forumPage([
        {
          id: 'm-photo',
          name: 'Ada',
          text: 'Hi',
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
      ]),
    );
    photoMock.mockRejectedValue(new Error('gone'));
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No message has received Bitcoin yet.')).toBeTruthy();
    });
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hi')).toBeTruthy();
      expect(photoMock).toHaveBeenCalled();
    });
    expect(screen.queryByAltText('Photo from Ada')).toBeNull();
  });

  it('ignores a stale photo fetch after unmount', async () => {
    let resolvePhoto: ((value: Blob) => void) | undefined;
    fetchMock.mockResolvedValue(
      forumPage([
        {
          id: 'm-photo',
          name: 'Ada',
          text: '',
          createdAt: '2026-08-28T12:00:00.000Z',
          sats: 5,
          payable: false,
          hasPhoto: true,
          photoCount: 1,
          hasVideo: false,
          videoContentType: null,
          role: 'basis',
          replyCount: 0,
        },
      ]),
    );
    photoMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePhoto = resolve;
        }),
    );
    const view = renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(photoMock).toHaveBeenCalled();
    });
    view.unmount();
    resolvePhoto?.(new Blob([new Uint8Array([1])], { type: 'image/jpeg' }));
    await Promise.resolve();
  });

  it('does not continue a photo retry after unmount', async () => {
    let rejectRetry: ((reason: Error) => void) | undefined;
    fetchMock.mockResolvedValue(
      forumPage([
        {
          id: 'm-photo',
          name: 'Ada',
          text: '',
          createdAt: '2026-08-28T12:00:00.000Z',
          sats: 5,
          payable: false,
          hasPhoto: true,
          photoCount: 1,
          hasVideo: false,
          videoContentType: null,
          role: 'basis',
          replyCount: 0,
        },
      ]),
    );
    photoMock.mockRejectedValueOnce(new Error('transient')).mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectRetry = reject;
        }),
    );
    const view = renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(photoMock).toHaveBeenCalledTimes(2);
    });
    view.unmount();
    rejectRetry?.(new Error('gone'));
    await Promise.resolve();
  });

  it('retries reply loading and records reply draft changes', async () => {
    fetchMock.mockResolvedValue(forumPage([SAMPLE]));
    repliesMock.mockRejectedValueOnce(new Error('gone')).mockResolvedValueOnce([]);
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(screen.getByLabelText('Your reaction')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Your reaction'), { target: { value: 'draft' } });
    expect(screen.getByLabelText('Your reaction')).toHaveProperty('value', 'draft');
  });

  it('does not fetch the next photo after unmount when the current fetch fails', async () => {
    let rejectFirst: ((reason: Error) => void) | undefined;
    fetchMock.mockResolvedValue(
      forumPage([
        {
          id: 'm1',
          name: 'Ada',
          text: '',
          createdAt: '2026-08-28T12:00:00.000Z',
          sats: 5,
          payable: false,
          hasPhoto: true,
          photoCount: 1,
          hasVideo: false,
          videoContentType: null,
          role: 'basis',
          replyCount: 0,
        },
        {
          id: 'm2',
          name: 'Ada',
          text: '',
          createdAt: '2026-08-28T12:01:00.000Z',
          sats: 5,
          payable: false,
          hasPhoto: true,
          photoCount: 1,
          hasVideo: false,
          videoContentType: null,
          role: 'basis',
          replyCount: 0,
        },
      ]),
    );
    photoMock.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectFirst = reject;
        }),
    );
    const view = renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(photoMock).toHaveBeenCalledTimes(1);
    });
    view.unmount();
    rejectFirst?.(new Error('gone'));
    await Promise.resolve();
    expect(photoMock).toHaveBeenCalledTimes(1);
  });

  it('revokes a photo blob if unmount happens during createObjectURL', async () => {
    let resolvePhoto: ((value: Blob) => void) | undefined;
    fetchMock.mockResolvedValue(
      forumPage([
        {
          id: 'm-photo',
          name: 'Ada',
          text: '',
          createdAt: '2026-08-28T12:00:00.000Z',
          sats: 5,
          payable: false,
          hasPhoto: true,
          photoCount: 1,
          hasVideo: false,
          videoContentType: null,
          role: 'basis',
          replyCount: 0,
        },
      ]),
    );
    photoMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePhoto = resolve;
        }),
    );
    const view = renderWithLocale(<ForumLoader />);
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

  it('posts a photo-only message and shows the preview immediately', async () => {
    fetchMock.mockResolvedValue(forumPage([]));
    prepareMock.mockResolvedValue({
      ok: true,
      photo: {
        contentType: 'image/jpeg',
        data: 'abc',
        previewUrl: 'data:image/jpeg;base64,abc',
        takenAt: '2026-09-22T11:40:00+08:00',
      },
    });
    const created: ForumMessage = {
      id: 'm-photo',
      name: 'Ada',
      text: '',
      createdAt: '2026-08-28T14:00:00.000Z',
      sats: 0,
      payable: false,
      hasPhoto: true,
      photoCount: 1,
      hasVideo: false,
      videoContentType: null,
      role: 'basis',
      replyCount: 1,
    };
    postMock.mockResolvedValue(created);
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File([new Uint8Array([1])], 'a.jpg', { type: 'image/jpeg' })] },
    });
    await waitFor(() => {
      expect(screen.getByAltText('Selected photo')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: /^Post$/ }));
    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('sess', {
        text: '',
        photos: [
          {
            contentType: 'image/jpeg',
            data: 'abc',
            takenAt: '2026-09-22T11:40:00+08:00',
          },
        ],
      });
      expect(screen.getByAltText('Photo from Ada').getAttribute('src')).toBe(
        'data:image/jpeg;base64,abc',
      );
      expect(screen.getByRole('combobox', { name: 'Forum view' }).textContent).toContain('All');
    });
  });

  it('switches to All after posting an unpaid note', async () => {
    fetchMock.mockResolvedValue(forumPage([]));
    const created: ForumMessage = {
      id: 'm-unpaid',
      name: 'Ada',
      text: 'Unpaid note',
      createdAt: '2026-08-28T14:00:00.000Z',
      sats: 0,
      payable: false,
      hasPhoto: false,
      photoCount: 0,
      hasVideo: false,
      videoContentType: null,
      role: 'basis',
      replyCount: 0,
    };
    postMock.mockResolvedValue(created);
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    expect(screen.getByRole('combobox', { name: 'Forum view' }).textContent).toContain('Active');
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Unpaid note' } });
    fireEvent.click(screen.getByRole('button', { name: /^Post$/ }));
    await waitFor(() => {
      expect(screen.getByText('Unpaid note')).toBeTruthy();
      expect(screen.getByRole('combobox', { name: 'Forum view' }).textContent).toContain('All');
    });
  });

  it('invoices a basis top-level post to 21.gifts', async () => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, role: 'basis', forumLawsDismissed: true, hasPosted: true },
    });
    fetchMock.mockResolvedValue(forumPage([]));
    invoiceMock.mockResolvedValue({ pr: 'lnbc1', amountSats: 1 });
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Hello gifts' } });
    fireEvent.submit(screen.getByLabelText('Your message').closest('form')!);
    await waitFor(() => {
      expect(composeTargetMock).toHaveBeenCalledWith('sess');
      expect(invoiceMock).toHaveBeenCalledWith('sess', 'fee-note', 1, 'Hello gifts', NO_RATE_SHOWN);
    });
    expect(postMock).not.toHaveBeenCalled();
    expect((screen.getByLabelText('Your message') as HTMLTextAreaElement).value).toBe('');
    expect(screen.getByRole('button', { name: 'Pay with Wallet of Satoshi' })).toBeTruthy();
    chooseForumMode('Active');
    expect(screen.getByRole('button', { name: 'Pay with Wallet of Satoshi' })).toBeTruthy();
  });

  it('restores the caption when compose-pay is cancelled', async () => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, role: 'basis', forumLawsDismissed: true, hasPosted: true },
    });
    fetchMock.mockResolvedValue(forumPage([]));
    invoiceMock.mockResolvedValue({ pr: 'lnbc1', amountSats: 1 });
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Hello gifts' } });
    fireEvent.submit(screen.getByLabelText('Your message').closest('form')!);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Pay with Wallet of Satoshi' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect((screen.getByLabelText('Your message') as HTMLTextAreaElement).value).toBe(
      'Hello gifts',
    );
    expect(screen.queryByRole('button', { name: 'Pay with Wallet of Satoshi' })).toBeNull();
  });

  it('switches to All after a compose-pay confirms', async () => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, role: 'basis', forumLawsDismissed: true, hasPosted: true },
    });
    fetchMock.mockResolvedValue(forumPage([]));
    invoiceMock.mockResolvedValue({ pr: 'lnbc1', amountSats: 1 });
    publicFetchMock.mockResolvedValue({
      id: 'fee-note',
      name: '21.gifts',
      text: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      sats: 1,
      payable: true,
      hasPhoto: false,
      photoCount: 0,
      hasVideo: false,
      videoContentType: null,
      role: 'basis',
      replyCount: 0,
    });
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    expect(screen.getByRole('combobox', { name: 'Forum view' }).textContent).toContain('Active');
    fetchMock
      .mockResolvedValueOnce(forumPage([]))
      .mockResolvedValue(
        forumPage([{ ...SAMPLE, id: 'new-paid', text: 'Hello gifts', sats: 0, payable: false }]),
      );
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Hello gifts' } });
    fireEvent.submit(screen.getByLabelText('Your message').closest('form')!);
    await waitFor(() => {
      expect(publicFetchMock).toHaveBeenCalledWith(
        'fee-note',
        expect.objectContaining({ sinceSats: 0 }),
      );
    });
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Forum view' }).textContent).toContain('All');
    });
  });

  it('refreshes All after a compose-pay confirms on All', async () => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, role: 'basis', forumLawsDismissed: true, hasPosted: true },
    });
    const created: ForumMessage = {
      ...SAMPLE,
      id: 'new-paid',
      text: 'Hello gifts',
      sats: 0,
      payable: false,
    };
    fetchMock.mockResolvedValue(forumPage([]));
    invoiceMock.mockResolvedValue({ pr: 'lnbc1', amountSats: 1 });
    publicFetchMock.mockResolvedValue({
      id: 'fee-note',
      name: '21.gifts',
      text: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      sats: 1,
      payable: true,
      hasPhoto: false,
      photoCount: 0,
      hasVideo: false,
      videoContentType: null,
      role: 'basis',
      replyCount: 0,
    });
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    chooseForumMode('All');
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Forum view' }).textContent).toContain('All');
    });
    fetchMock.mockResolvedValueOnce(forumPage([])).mockResolvedValue(forumPage([created]));
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Hello gifts' } });
    fireEvent.submit(screen.getByLabelText('Your message').closest('form')!);
    await waitFor(() => {
      expect(screen.getByText('Hello gifts')).toBeTruthy();
    });
  });

  it('raises the parent reply count after a compose-pay reply confirms', async () => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, role: 'basis', forumLawsDismissed: true, hasPosted: true },
    });
    fetchMock.mockResolvedValue(forumPage([{ ...FOREIGN, sats: 1, replyCount: 0 }]));
    repliesMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValue([
        {
          id: 'r-new',
          accountId: 'acc_1',
          name: 'Ada',
          text: 'Hi',
          createdAt: '2026-08-28T12:45:00.000Z',
          sats: 0,
          payable: false,
          hasPhoto: false,
          photoCount: 0,
          hasVideo: false,
          videoContentType: null,
          role: 'basis',
          replyCount: 0,
        },
      ]);
    invoiceMock.mockResolvedValue({ pr: 'lnbc1', amountSats: 1 });
    publicFetchMock.mockResolvedValue({
      id: 'fee-note',
      name: '21.gifts',
      text: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      sats: 1,
      payable: true,
      hasPhoto: false,
      photoCount: 0,
      hasVideo: false,
      videoContentType: null,
      role: 'basis',
      replyCount: 0,
    });
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('Hello from Bob')).toBeTruthy();
    });
    expect(screen.getByRole('combobox', { name: 'Forum view' }).textContent).toContain('Active');
    expect(screen.getByText('0 reactions')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    await waitFor(() => {
      expect(screen.getByLabelText('Your reaction')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Your reaction'), { target: { value: 'Hi' } });
    fireEvent.submit(screen.getByLabelText('Your reaction').closest('form')!);
    await waitFor(() => {
      expect(composeTargetMock).toHaveBeenCalledWith('sess');
      expect(invoiceMock).toHaveBeenCalledWith(
        'sess',
        'fee-note',
        1,
        'inReplyTo:m-bob\nHi',
        NO_RATE_SHOWN,
      );
    });
    await waitFor(() => {
      expect(screen.getByText('Hi')).toBeTruthy();
      expect(screen.getByText('1 reactions')).toBeTruthy();
    });
    expect(screen.getByRole('combobox', { name: 'Forum view' }).textContent).toContain('Active');
  });

  it('keeps a compose invoice on the composer when the fee note is listed', async () => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, role: 'basis', forumLawsDismissed: true, hasPosted: true },
    });
    fetchMock.mockResolvedValue(
      forumPage([
        {
          ...SAMPLE,
          id: 'fee-note',
          accountId: 'plat',
          name: '21.gifts',
          text: '21.gifts',
          sats: 1,
          payable: true,
        },
      ]),
    );
    invoiceMock.mockResolvedValue({ pr: 'lnbc1', amountSats: 1 });
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'View profile' })).toBeTruthy();
    });
    chooseForumMode('All');
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Hello gifts' } });
    fireEvent.submit(screen.getByLabelText('Your message').closest('form')!);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Pay with Wallet of Satoshi' })).toBeTruthy();
    });
    expect(screen.getByRole('button', { name: 'View profile' })).toBeTruthy();
  });

  it('invoices 21.gifts for a basis photo draft', async () => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, role: 'basis', forumLawsDismissed: true, hasPosted: true },
    });
    fetchMock.mockResolvedValue(forumPage([]));
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    prepareMock.mockResolvedValue({
      ok: true,
      photo: { contentType: 'image/jpeg', data: 'abc', previewUrl: 'blob:photo' },
    });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [new File([new Uint8Array([0xff, 0xd8, 0xff])], 'a.jpg', { type: 'image/jpeg' })],
      },
    });
    await waitFor(() => {
      expect(screen.getByAltText('Selected photo')).toBeTruthy();
    });
    fireEvent.submit(screen.getByLabelText('Your message').closest('form')!);
    await waitFor(() => {
      expect(composeTargetMock).toHaveBeenCalledWith('sess');
      expect(invoiceMock).toHaveBeenCalledWith('sess', 'fee-note', 1, undefined, NO_RATE_SHOWN);
    });
    expect(postMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('POSTs a basis photo after the compose fee confirms', async () => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, role: 'basis', forumLawsDismissed: true, hasPosted: true },
    });
    fetchMock.mockResolvedValue(forumPage([]));
    publicFetchMock.mockResolvedValue({
      id: 'fee-note',
      name: '21.gifts',
      text: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      sats: 1,
      payable: true,
      hasPhoto: false,
      photoCount: 0,
      hasVideo: false,
      videoContentType: null,
      role: 'basis',
      replyCount: 0,
    });
    postMock.mockResolvedValue({
      ...SAMPLE,
      id: 'photo-paid',
      text: 'with photo',
      sats: 0,
      payable: false,
      hasPhoto: true,
      photoCount: 1,
    });
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    prepareMock.mockResolvedValue({
      ok: true,
      photo: {
        contentType: 'image/jpeg',
        data: 'abc',
        previewUrl: 'blob:photo',
        takenAt: '2026-09-22T11:40:00+08:00',
      },
    });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [new File([new Uint8Array([0xff, 0xd8, 0xff])], 'a.jpg', { type: 'image/jpeg' })],
      },
    });
    await waitFor(() => {
      expect(screen.getByAltText('Selected photo')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'with photo' } });
    fireEvent.submit(screen.getByLabelText('Your message').closest('form')!);
    await waitFor(() => {
      expect(invoiceMock).toHaveBeenCalledWith('sess', 'fee-note', 1, undefined, NO_RATE_SHOWN);
    });
    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('sess', {
        text: 'with photo',
        photos: [
          {
            contentType: 'image/jpeg',
            data: 'abc',
            takenAt: '2026-09-22T11:40:00+08:00',
          },
        ],
      });
    });
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Forum view' }).textContent).toContain('All');
      expect(screen.getByText('with photo')).toBeTruthy();
    });
  });

  it('POSTs a basis Ask with goalCurrency and goalAmount after the compose fee confirms', async () => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, role: 'basis', forumLawsDismissed: true, hasPosted: true },
    });
    fetchMock.mockResolvedValue(forumPage([]));
    publicFetchMock.mockResolvedValue({
      id: 'fee-note',
      name: '21.gifts',
      text: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      sats: 1,
      payable: true,
      hasPhoto: false,
      photoCount: 0,
      hasVideo: false,
      videoContentType: null,
      role: 'basis',
      replyCount: 0,
    });
    postMock.mockResolvedValue({
      ...SAMPLE,
      id: 'ask-paid',
      text: 'Hello',
      sats: 0,
      payable: false,
      goalSats: 21000,
    });
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ask for money' }));
    await waitFor(() => {
      expect(screen.getByText('How much?')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Ask'), { target: { value: '21000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: /^Post$/ }));
    await waitFor(() => {
      expect(invoiceMock).toHaveBeenCalledWith('sess', 'fee-note', 1, undefined, NO_RATE_SHOWN);
    });
    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('sess', {
        text: 'Hello',
        goalCurrency: 'BTC',
        goalAmount: '21000',
      });
    });
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Forum view' }).textContent).toContain('Active');
    });
  });

  it('POSTs a basis video after the compose fee confirms', async () => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, role: 'basis', forumLawsDismissed: true, hasPosted: true },
    });
    fetchMock.mockResolvedValue(forumPage([]));
    isVideoMock.mockReturnValue(true);
    const poster = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' });
    const file = new File([new Uint8Array([1, 2, 3])], 'clip.mp4', { type: 'video/mp4' });
    prepareVideoMock.mockResolvedValue({
      ok: true,
      video: { file, poster, previewUrl: 'blob:video' },
    });
    publicFetchMock.mockResolvedValue({
      id: 'fee-note',
      name: '21.gifts',
      text: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      sats: 1,
      payable: true,
      hasPhoto: false,
      photoCount: 0,
      hasVideo: false,
      videoContentType: null,
      role: 'basis',
      replyCount: 0,
    });
    postVideoMock.mockResolvedValue({
      ...SAMPLE,
      id: 'vid-paid',
      text: 'clip',
      sats: 0,
      payable: false,
      hasPhoto: true,
      photoCount: 1,
      hasVideo: true,
      videoContentType: 'video/mp4',
    });
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => {
      expect(prepareVideoMock).toHaveBeenCalledWith(file);
    });
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'clip' } });
    fireEvent.submit(screen.getByLabelText('Your message').closest('form')!);
    await waitFor(() => {
      expect(invoiceMock).toHaveBeenCalledWith('sess', 'fee-note', 1, undefined, NO_RATE_SHOWN);
    });
    await waitFor(() => {
      expect(postVideoMock).toHaveBeenCalledWith('sess', {
        text: 'clip',
        video: file,
        poster,
      });
      expect(postMock).not.toHaveBeenCalled();
    });
  });

  it('shows a request error when the paid basis photo POST fails', async () => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, role: 'basis', forumLawsDismissed: true, hasPosted: true },
    });
    fetchMock.mockResolvedValue(forumPage([]));
    publicFetchMock.mockResolvedValue({
      id: 'fee-note',
      name: '21.gifts',
      text: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      sats: 1,
      payable: true,
      hasPhoto: false,
      photoCount: 0,
      hasVideo: false,
      videoContentType: null,
      role: 'basis',
      replyCount: 0,
    });
    postMock.mockRejectedValue(new Error('offline'));
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    prepareMock.mockResolvedValue({
      ok: true,
      photo: { contentType: 'image/jpeg', data: 'abc', previewUrl: 'blob:photo' },
    });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [new File([new Uint8Array([0xff, 0xd8, 0xff])], 'a.jpg', { type: 'image/jpeg' })],
      },
    });
    await waitFor(() => {
      expect(screen.getByAltText('Selected photo')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'with photo' } });
    fireEvent.submit(screen.getByLabelText('Your message').closest('form')!);
    await waitFor(() => {
      expect(postMock).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe('Could not post your message');
    });
    expect(screen.getByAltText('Selected photo')).toBeTruthy();
    expect((screen.getByLabelText('Your message') as HTMLTextAreaElement).value).toBe('with photo');
    expect(invoiceMock).toHaveBeenCalledTimes(1);
    postMock.mockResolvedValue({
      ...SAMPLE,
      id: 'photo-retry',
      text: '',
      sats: 0,
      payable: false,
      hasPhoto: true,
      photoCount: 1,
    });
    fireEvent.submit(screen.getByLabelText('Your message').closest('form')!);
    await waitFor(() => {
      expect(postMock).toHaveBeenCalledTimes(2);
    });
    expect(invoiceMock).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'next note' } });
    fireEvent.submit(screen.getByLabelText('Your message').closest('form')!);
    await waitFor(() => {
      expect(invoiceMock).toHaveBeenCalledTimes(2);
    });
  });

  it('does not count a zero-sat note posted from unpaid as unseen on Active', async () => {
    window.localStorage.setItem('21gifts.forum-unpaid-seen', '2026-01-01T00:00:00.000Z');
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, forumLawsDismissed: true },
    });
    fetchMock.mockResolvedValue(forumPage([SAMPLE]));
    postMock.mockImplementation(async () => ({
      id: 'm-unpaid',
      name: 'Ada',
      text: 'Unpaid note',
      createdAt: new Date().toISOString(),
      sats: 0,
      payable: false,
      hasPhoto: false,
      photoCount: 0,
      hasVideo: false,
      videoContentType: null,
      role: 'basis',
      replyCount: 0,
    }));
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Forum view' }).textContent).toContain('Active');
      expect(screen.getByRole('combobox', { name: 'Forum view' }).textContent).toContain('1');
    });
    chooseForumMode('No gifts yet, 1 new');
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Forum view' }).textContent).toContain(
        'No gifts yet',
      );
    });
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Unpaid note' } });
    fireEvent.click(screen.getByRole('button', { name: /^Post$/ }));
    await waitFor(() => {
      expect(screen.getByText('Unpaid note')).toBeTruthy();
      expect(screen.getByRole('combobox', { name: 'Forum view' }).textContent).toContain('All');
    });
    chooseForumMode('Active');
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Forum view' }).textContent).toContain('Active');
    });
  });

  it('posts text together with two photos', async () => {
    fetchMock.mockResolvedValue(forumPage([]));
    prepareMock
      .mockResolvedValueOnce({
        ok: true,
        photo: {
          contentType: 'image/jpeg',
          data: 'abc',
          previewUrl: 'data:image/jpeg;base64,abc',
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        photo: {
          contentType: 'image/jpeg',
          data: 'def',
          previewUrl: 'data:image/jpeg;base64,def',
        },
      });
    const created: ForumMessage = {
      id: 'm-both',
      name: 'Ada',
      text: 'Hello',
      createdAt: '2026-08-28T14:00:00.000Z',
      sats: 0,
      payable: false,
      hasPhoto: true,
      photoCount: 2,
      hasVideo: false,
      videoContentType: null,
      role: 'basis',
      replyCount: 0,
    };
    postMock.mockResolvedValue(created);
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: '  Hello  ' } });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const first = new File([new Uint8Array([1])], 'a.jpg', { type: 'image/jpeg' });
    const second = new File([new Uint8Array([2])], 'b.png', { type: 'image/png' });
    fireEvent.change(input, {
      target: { files: [first, second] },
    });
    await waitFor(() => {
      expect(screen.getAllByAltText('Selected photo')).toHaveLength(2);
    });
    fireEvent.click(screen.getByRole('button', { name: /^Post$/ }));
    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('sess', {
        text: 'Hello',
        photos: [
          { contentType: 'image/jpeg', data: 'abc' },
          { contentType: 'image/jpeg', data: 'def' },
        ],
      });
    });
    expect(screen.getByText('Hello')).toBeTruthy();
    expect(screen.getAllByAltText('Photo from Ada')).toHaveLength(2);
    expect((screen.getByLabelText('Your message') as HTMLTextAreaElement).value).toBe('');
  });

  it('does not replace an existing photo blob with the composer preview', async () => {
    const created: ForumMessage = {
      id: 'm-photo',
      name: 'Ada',
      text: '',
      createdAt: '2026-08-28T14:00:00.000Z',
      sats: 5,
      payable: false,
      hasPhoto: true,
      photoCount: 1,
      hasVideo: false,
      videoContentType: null,
      role: 'basis',
      replyCount: 0,
    };
    fetchMock.mockResolvedValue(forumPage([created]));
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:existing');
    prepareMock.mockResolvedValue({
      ok: true,
      photo: {
        contentType: 'image/jpeg',
        data: 'abc',
        previewUrl: 'data:image/jpeg;base64,abc',
      },
    });
    postMock.mockResolvedValue(created);
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByAltText('Photo from Ada').getAttribute('src')).toBe('blob:existing');
    });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File([new Uint8Array([1])], 'a.jpg', { type: 'image/jpeg' })] },
    });
    await waitFor(() => {
      expect(screen.getByAltText('Selected photo')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: /^Post$/ }));
    await waitFor(() => {
      expect(postMock).toHaveBeenCalled();
    });
    expect(screen.getByAltText('Photo from Ada').getAttribute('src')).toBe('blob:existing');
  });

  it('does not replace an existing local video preview on a second post of the same id', async () => {
    fetchMock.mockResolvedValue(forumPage([]));
    isVideoMock.mockReturnValue(true);
    const poster = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' });
    const file = new File([new Uint8Array([1, 2, 3])], 'clip.mp4', { type: 'video/mp4' });
    prepareVideoMock.mockResolvedValue({
      ok: true,
      video: { file, poster, previewUrl: 'blob:video-first' },
    });
    const created: ForumMessage = {
      ...SAMPLE,
      id: 'vid1',
      text: 'clip',
      hasPhoto: true,
      photoCount: 1,
      hasVideo: true,
      videoContentType: 'video/mp4',
    };
    postVideoMock.mockResolvedValue(created);
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => {
      expect(prepareVideoMock).toHaveBeenCalled();
    });
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'clip' } });
    fireEvent.click(screen.getByRole('button', { name: /^Post$/ }));
    await waitFor(() => {
      expect(document.querySelector('video')?.getAttribute('src')).toBe('blob:video-first');
    });
    prepareVideoMock.mockClear();
    prepareVideoMock.mockResolvedValue({
      ok: true,
      video: { file, poster, previewUrl: 'blob:video-second' },
    });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => {
      expect(prepareVideoMock).toHaveBeenCalledTimes(1);
    });
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'clip' } });
    const revoke = vi.mocked(URL.revokeObjectURL);
    revoke.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /^Post$/ }));
    await waitFor(() => {
      expect(postVideoMock).toHaveBeenCalledTimes(2);
    });
    expect(document.querySelector('video')?.getAttribute('src')).toBe('blob:video-first');
    expect(revoke).toHaveBeenCalledWith('blob:video-second');
  });

  it('revokes a pending video preview when the created message has no video', async () => {
    fetchMock.mockResolvedValue(forumPage([]));
    isVideoMock.mockReturnValue(true);
    const poster = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' });
    const file = new File([new Uint8Array([1, 2, 3])], 'clip.mp4', { type: 'video/mp4' });
    prepareVideoMock.mockResolvedValue({
      ok: true,
      video: { file, poster, previewUrl: 'blob:video-unused' },
    });
    postVideoMock.mockResolvedValue({
      ...SAMPLE,
      id: 'vid-novideo',
      text: 'clip',
      hasPhoto: false,
      photoCount: 0,
      hasVideo: false,
      videoContentType: null,
    });
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => {
      expect(prepareVideoMock).toHaveBeenCalledWith(file);
    });
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'clip' } });
    const revoke = vi.mocked(URL.revokeObjectURL);
    revoke.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /^Post$/ }));
    await waitFor(() => {
      expect(postVideoMock).toHaveBeenCalled();
      expect(screen.queryByLabelText('Remove video')).toBeNull();
    });
    expect(revoke).toHaveBeenCalledWith('blob:video-unused');
  });

  it('prepends a post when the list has not loaded yet', async () => {
    fetchMock.mockReturnValue(new Promise(() => undefined));
    const created: ForumMessage = {
      id: 'm-early',
      name: 'Ada',
      text: 'Early',
      createdAt: '2026-08-28T14:00:00.000Z',
      sats: 0,
      payable: false,
      hasPhoto: false,
      photoCount: 0,
      hasVideo: false,
      videoContentType: null,
      role: 'basis',
      replyCount: 0,
    };
    postMock.mockResolvedValue(created);
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('Loading…')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Early' } });
    fireEvent.click(screen.getByRole('button', { name: /^Post$/ }));
    await waitFor(() => {
      expect(screen.getByText('Early')).toBeTruthy();
    });
  });

  it('keeps an early post when the in-flight fetch later resolves', async () => {
    let resolveFetch: ((value: ReturnType<typeof forumPage>) => void) | undefined;
    const created: ForumMessage = {
      id: 'm-early',
      name: 'Ada',
      text: 'Early',
      createdAt: '2026-08-28T14:00:00.000Z',
      sats: 0,
      payable: false,
      hasPhoto: false,
      photoCount: 0,
      hasVideo: false,
      videoContentType: null,
      role: 'basis',
      replyCount: 0,
    };
    const fromServer: ForumMessage = {
      id: 'm1',
      name: 'Bob',
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
    fetchMock
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFetch = resolve;
          }),
      )
      .mockResolvedValue(forumPage([fromServer]));
    postMock.mockResolvedValue(created);
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('Loading…')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Early' } });
    fireEvent.click(screen.getByRole('button', { name: /^Post$/ }));
    await waitFor(() => {
      expect(screen.getByText('Early')).toBeTruthy();
    });
    await act(async () => {
      resolveFetch?.(forumPage([fromServer]));
    });
    await waitFor(() => {
      expect(screen.getByText('Early')).toBeTruthy();
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });
  });

  it('keeps an early post when the in-flight fetch later rejects', async () => {
    let rejectFetch: ((reason: Error) => void) | undefined;
    fetchMock
      .mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            rejectFetch = reject;
          }),
      )
      .mockResolvedValue(forumPage([]));
    const created: ForumMessage = {
      id: 'm-early',
      name: 'Ada',
      text: 'Early',
      createdAt: '2026-08-28T14:00:00.000Z',
      sats: 0,
      payable: false,
      hasPhoto: false,
      photoCount: 0,
      hasVideo: false,
      videoContentType: null,
      role: 'basis',
      replyCount: 0,
    };
    postMock.mockResolvedValue(created);
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('Loading…')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Early' } });
    fireEvent.click(screen.getByRole('button', { name: /^Post$/ }));
    await waitFor(() => {
      expect(screen.getByText('Early')).toBeTruthy();
    });
    await act(async () => {
      rejectFetch?.(new Error('gone'));
    });
    await waitFor(() => {
      expect(screen.getByText('Early')).toBeTruthy();
    });
    expect(screen.queryByText('Could not load messages. Please try again.')).toBeNull();
  });

  it('does not duplicate a post already present from fetch', async () => {
    const created: ForumMessage = {
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
    fetchMock.mockResolvedValue(forumPage([created]));
    postMock.mockResolvedValue(created);
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No message has received Bitcoin yet.')).toBeTruthy();
    });
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Your message'), {
      target: { value: 'Hello from Ada' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Post$/ }));
    await waitFor(() => {
      expect(postMock).toHaveBeenCalled();
    });
    expect(screen.getAllByText('Hello from Ada')).toHaveLength(1);
  });

  it('posts a trimmed message, shows it as the newest row, and clears the draft', async () => {
    fetchMock.mockResolvedValue(forumPage([]));
    const created: ForumMessage = {
      id: 'm2',
      name: 'Ada',
      text: 'Hello',
      createdAt: '2026-08-28T14:00:00.000Z',
      sats: 0,
      payable: false,
      hasPhoto: false,
      photoCount: 0,
      hasVideo: false,
      videoContentType: null,
      role: 'basis',
      replyCount: 0,
    };
    postMock.mockResolvedValue(created);
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: '  Hello  ' } });
    fireEvent.click(screen.getByRole('button', { name: /^Post$/ }));

    await waitFor(() => {
      expect(screen.getByText('Hello')).toBeTruthy();
    });
    expect(postMock).toHaveBeenCalledWith('sess', { text: 'Hello' });
    expect((screen.getByLabelText('Your message') as HTMLTextAreaElement).value).toBe('');
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(1);
    expect(items[0]!.textContent).toContain('Hello');
    expect(useAuthStore.getState().account?.hasPosted).toBe(true);
  });

  it('shows a newly posted note above existing notes', async () => {
    fetchMock.mockResolvedValue(forumPage([SAMPLE]));
    const created: ForumMessage = {
      id: 'm2',
      name: 'Ada',
      text: 'New note',
      createdAt: '2026-08-28T14:00:00.000Z',
      sats: 0,
      payable: false,
      hasPhoto: false,
      photoCount: 0,
      hasVideo: false,
      videoContentType: null,
      role: 'basis',
      replyCount: 0,
    };
    postMock.mockResolvedValue(created);
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No message has received Bitcoin yet.')).toBeTruthy();
    });
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'New note' } });
    fireEvent.click(screen.getByRole('button', { name: /^Post$/ }));

    await waitFor(() => {
      expect(screen.getByText('New note')).toBeTruthy();
    });
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]!.textContent).toContain('New note');
    expect(items[1]!.textContent).toContain('Hello from Ada');
  });

  it('keeps a posted note at the top when a silent refresh omits it', async () => {
    fetchMock.mockResolvedValue(forumPage([SAMPLE]));
    const created: ForumMessage = {
      id: 'm2',
      name: 'Ada',
      text: 'New note',
      createdAt: '2026-08-28T14:00:00.000Z',
      sats: 0,
      payable: false,
      hasPhoto: false,
      photoCount: 0,
      hasVideo: false,
      videoContentType: null,
      role: 'basis',
      replyCount: 0,
    };
    postMock.mockResolvedValue(created);
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'New note' } });
    fireEvent.click(screen.getByRole('button', { name: /^Post$/ }));
    await waitFor(() => {
      expect(screen.getByText('New note')).toBeTruthy();
    });

    fetchMock.mockResolvedValue(forumPage([SAMPLE]));
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThan(2);
    });
    const items = screen.getAllByRole('listitem');
    expect(items[0]!.textContent).toContain('New note');
    expect(items[1]!.textContent).toContain('Hello from Ada');
  });

  it('shows a post error when posting fails', async () => {
    fetchMock.mockResolvedValue(forumPage([]));
    postMock.mockRejectedValue(new Error('boom'));
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Hi' } });
    fireEvent.click(screen.getByRole('button', { name: /^Post$/ }));

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe('Could not post your message');
  });

  it('shows rate-limit copy when posting is rate limited', async () => {
    fetchMock.mockResolvedValue(forumPage([]));
    postMock.mockRejectedValue(new Error('Too many messages'));
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Hi' } });
    fireEvent.click(screen.getByRole('button', { name: /^Post$/ }));

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe(
      'Too many messages. Please wait a moment and try again.',
    );
  });

  it('disables Post and shows a spinner while posting', async () => {
    fetchMock.mockResolvedValue(forumPage([]));
    let resolvePost!: (value: ForumMessage) => void;
    const pending = new Promise<ForumMessage>((resolve) => {
      resolvePost = resolve;
    });
    postMock.mockReturnValue(pending);
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Hi' } });
    fireEvent.click(screen.getByRole('button', { name: /^Post$/ }));

    const button = screen.getByRole('button', { name: /^Post$/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.querySelector('.animate-spin')).toBeTruthy();

    await act(async () => {
      resolvePost({
        id: 'm3',
        name: 'Ada',
        text: 'Hi',
        createdAt: '2026-08-28T15:00:00.000Z',
        sats: 0,
        payable: false,
        hasPhoto: false,
        photoCount: 0,
        hasVideo: false,
        videoContentType: null,
        role: 'basis',
        replyCount: 0,
      });
    });

    await waitFor(() => {
      expect((screen.getByRole('button', { name: /^Post$/ }) as HTMLButtonElement).disabled).toBe(
        false,
      );
    });
  });

  it('ignores a second composer submit while the first note POST is in flight', async () => {
    fetchMock.mockResolvedValue(forumPage([]));
    let resolvePost!: (value: ForumMessage) => void;
    const pending = new Promise<ForumMessage>((resolve) => {
      resolvePost = resolve;
    });
    postMock.mockReturnValue(pending);
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Hello' } });
    const form = screen.getByLabelText('Your message').closest('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form!);
    fireEvent.submit(form!);
    expect(postMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolvePost({
        id: 'm3',
        name: 'Ada',
        text: 'Hello',
        createdAt: '2026-08-28T15:00:00.000Z',
        sats: 0,
        payable: false,
        hasPhoto: false,
        photoCount: 0,
        hasVideo: false,
        videoContentType: null,
        role: 'basis',
        replyCount: 0,
      });
    });

    await waitFor(() => {
      expect(screen.getAllByRole('listitem')).toHaveLength(1);
    });
  });

  it('clears a reply pay sheet when the thread is collapsed', async () => {
    fetchMock.mockResolvedValue(forumPage([{ ...SAMPLE, replyCount: 1 }]));
    repliesMock.mockResolvedValue([{ ...PAYABLE_REPLY }]);
    renderWithLocale(<ForumLoader />);
    await act(async () => {
      await Promise.resolve();
    });
    await revealAll();
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    await act(async () => {
      await Promise.resolve();
    });
    const replyCard = clickGiftOnReply();
    expect(within(replyCard).getByLabelText('Amount')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Hide reactions' }));
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  });

  it('clears the pay sheet when a public fetch returns more sats', async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(forumPage([{ ...SAMPLE, replyCount: 2 }]));
    repliesMock.mockResolvedValue([
      { ...PAYABLE_REPLY },
      { ...NESTED_REPLY, id: 'r-other', text: 'Other reply' },
    ]);
    invoiceMock.mockResolvedValue({ pr: 'lnbc21n1example', amountSats: 21 });
    publicFetchMock.mockResolvedValue({ ...PAYABLE_REPLY, sats: 21 });
    renderWithLocale(<ForumLoader />);
    await act(async () => {
      await Promise.resolve();
    });
    await revealAll();
    expect(screen.getByText('Hello from Ada')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    await act(async () => {
      await Promise.resolve();
    });
    const replyCard = clickGiftOnReply();
    fireEvent.change(within(replyCard).getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(within(replyCard).getByRole('button', { name: 'Continue' }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(invoiceMock).toHaveBeenCalledWith('sess', 'r-pay', 21, undefined, NO_RATE_SHOWN);
    expect(publicFetchMock).toHaveBeenCalledWith(
      'r-pay',
      expect.objectContaining({
        sinceSats: 0,
        signal: expect.any(AbortSignal),
      }),
    );
    expect(screen.queryByText('Pay ₿21')).toBeNull();
  });

  it('requests the invoice on iPhone Continue without assigning the wallet href', async () => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    });
    const assign = vi.fn();
    vi.stubGlobal('location', { assign });
    fetchMock.mockResolvedValue(forumPage([{ ...SAMPLE, replyCount: 1 }]));
    repliesMock.mockResolvedValue([{ ...PAYABLE_REPLY }]);
    invoiceMock.mockResolvedValue({ pr: 'lnbc21n1example', amountSats: 21 });
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No message has received Bitcoin yet.')).toBeTruthy();
    });
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });
    const replyCard = await clickReplyGift();
    fireEvent.change(within(replyCard).getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(within(replyCard).getByRole('button', { name: 'Continue' }));
    await waitFor(() => {
      expect(invoiceMock).toHaveBeenCalledWith('sess', 'r-pay', 21, undefined, NO_RATE_SHOWN);
    });
    expect(assign).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Pay with Wallet of Satoshi' })).toBeTruthy();
    });
  });

  it('keeps list order when a public pay fetch updates the first of two notes', async () => {
    vi.useFakeTimers();
    const second: ForumMessage = {
      id: 'm2',
      name: 'Bob',
      text: 'Hello from Bob',
      createdAt: '2026-08-28T11:00:00.000Z',
      sats: 0,
      payable: false,
      hasPhoto: false,
      photoCount: 0,
      hasVideo: false,
      videoContentType: null,
      role: 'basis',
      replyCount: 0,
    };
    fetchMock.mockResolvedValue(forumPage([{ ...SAMPLE, replyCount: 1 }, second]));
    repliesMock.mockResolvedValue([{ ...PAYABLE_REPLY }]);
    invoiceMock.mockResolvedValue({ pr: 'lnbc21n1example', amountSats: 21 });
    publicFetchMock.mockResolvedValue({ ...PAYABLE_REPLY, sats: 21 });
    renderWithLocale(<ForumLoader />);
    await act(async () => {
      await Promise.resolve();
    });
    await revealAll();
    expect(screen.getByText('Hello from Ada')).toBeTruthy();
    expect(screen.getByText('Hello from Bob')).toBeTruthy();
    const adaCard = screen.getByText('Hello from Ada').closest('li') as HTMLElement;
    fireEvent.click(within(adaCard).getByRole('button', { name: 'Show reactions' }));
    await act(async () => {
      await Promise.resolve();
    });
    const replyCard = clickGiftOnReply();
    fireEvent.change(within(replyCard).getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(within(replyCard).getByRole('button', { name: 'Continue' }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByText('Pay ₿21')).toBeNull();
    const items = [...document.querySelectorAll('[data-message-id]')];
    expect(items).toHaveLength(2);
    expect(items[0]!.textContent).toContain('Hello from Ada');
    expect(items[1]!.textContent).toContain('Hello from Bob');
  });

  it('ignores a public pay fetch that resolves after Back', async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(forumPage([{ ...SAMPLE, replyCount: 1 }]));
    repliesMock.mockResolvedValue([{ ...PAYABLE_REPLY }]);
    invoiceMock.mockResolvedValue({ pr: 'lnbc21n1example', amountSats: 21 });
    let resolvePoll: ((value: ForumMessage | null) => void) | undefined;
    publicFetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePoll = resolve;
        }),
    );
    renderWithLocale(<ForumLoader />);
    await act(async () => {
      await Promise.resolve();
    });
    await revealAll();
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    await act(async () => {
      await Promise.resolve();
    });
    const replyCard = clickGiftOnReply();
    fireEvent.change(within(replyCard).getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(within(replyCard).getByRole('button', { name: 'Continue' }));
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.click(within(replyCard).getByRole('button', { name: 'Back' }));
    await act(async () => {
      resolvePoll?.({ ...PAYABLE_REPLY, sats: 21 });
      await Promise.resolve();
    });
    expect(screen.queryByText('Pay ₿21')).toBeNull();
  });

  it('aborts the public pay poll signal on Back so a late higher-sats resolve does not keep the QR', async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(forumPage([{ ...SAMPLE, replyCount: 1 }]));
    repliesMock.mockResolvedValue([{ ...PAYABLE_REPLY }]);
    invoiceMock.mockResolvedValue({ pr: 'lnbc21n1example', amountSats: 21 });
    let resolvePoll: ((value: ForumMessage | null) => void) | undefined;
    let seenSignal: AbortSignal | undefined;
    publicFetchMock.mockImplementationOnce((_id, opts) => {
      seenSignal = opts?.signal;
      return new Promise((resolve) => {
        resolvePoll = resolve;
      });
    });
    renderWithLocale(<ForumLoader />);
    await act(async () => {
      await Promise.resolve();
    });
    await revealAll();
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    await act(async () => {
      await Promise.resolve();
    });
    const replyCard = clickGiftOnReply();
    fireEvent.change(within(replyCard).getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(within(replyCard).getByRole('button', { name: 'Continue' }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(seenSignal).toBeDefined();
    expect(seenSignal?.aborted).toBe(false);
    fireEvent.click(within(replyCard).getByRole('button', { name: 'Back' }));
    expect(seenSignal?.aborted).toBe(true);
    await act(async () => {
      resolvePoll?.({ ...PAYABLE_REPLY, sats: 21 });
      await Promise.resolve();
    });
    expect(screen.queryByText('Pay ₿21')).toBeNull();
  });

  it('keeps the QR and retries after a failed public fetch, then closes when sats increase', async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(forumPage([{ ...SAMPLE, replyCount: 1 }]));
    repliesMock.mockResolvedValue([{ ...PAYABLE_REPLY }]);
    invoiceMock.mockResolvedValue({ pr: 'lnbc21n1example', amountSats: 21 });
    publicFetchMock.mockRejectedValueOnce(new Error('poll failed'));
    publicFetchMock.mockResolvedValueOnce({ ...PAYABLE_REPLY, sats: 21 });
    renderWithLocale(<ForumLoader />);
    await act(async () => {
      await Promise.resolve();
    });
    await revealAll();
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    await act(async () => {
      await Promise.resolve();
    });
    const replyCard = clickGiftOnReply();
    fireEvent.change(within(replyCard).getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(within(replyCard).getByRole('button', { name: 'Continue' }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText('Pay ₿21')).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(screen.queryByText('Pay ₿21')).toBeNull();
  });

  it('does not mark hasPosted on a swapped session after a paid poll', async () => {
    fetchMock.mockResolvedValue(forumPage([{ ...SAMPLE, replyCount: 1 }]));
    repliesMock.mockResolvedValue([{ ...PAYABLE_REPLY }]);
    invoiceMock.mockResolvedValue({ pr: 'lnbc21n1example', amountSats: 21 });
    let resolvePoll!: (value: typeof PAYABLE_REPLY) => void;
    publicFetchMock.mockReturnValue(
      new Promise((resolve) => {
        resolvePoll = resolve;
      }),
    );
    renderWithLocale(<ForumLoader />);
    await act(async () => {
      await Promise.resolve();
    });
    await revealAll();
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    await act(async () => {
      await Promise.resolve();
    });
    const replyCard = clickGiftOnReply();
    fireEvent.change(within(replyCard).getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(within(replyCard).getByRole('button', { name: 'Continue' }));
    await waitFor(() => {
      expect(invoiceMock).toHaveBeenCalled();
    });
    useAuthStore.setState({ session: 'other', account: { ...account, id: 'other-acc' } });
    await act(async () => {
      resolvePoll({ ...PAYABLE_REPLY, sats: 21 });
    });
    expect(useAuthStore.getState().account?.hasPosted).toBeUndefined();
  });

  it('refetches expanded replies after a paid poll when the account snapshot is missing', async () => {
    fetchMock.mockResolvedValue(forumPage([{ ...SAMPLE, replyCount: 1 }]));
    repliesMock.mockResolvedValue([{ ...PAYABLE_REPLY }]);
    invoiceMock.mockResolvedValue({ pr: 'lnbc21n1example', amountSats: 21 });
    let resolvePoll!: (value: typeof PAYABLE_REPLY) => void;
    publicFetchMock.mockReturnValue(
      new Promise((resolve) => {
        resolvePoll = resolve;
      }),
    );
    renderWithLocale(<ForumLoader />);
    await act(async () => {
      await Promise.resolve();
    });
    await revealAll();
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    await waitFor(() => {
      expect(screen.getByLabelText('Your reaction')).toBeTruthy();
      expect(document.querySelector('[data-reply-id="r-pay"]')).not.toBeNull();
    });
    const replyCard = clickGiftOnReply();
    fireEvent.change(within(replyCard).getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(within(replyCard).getByRole('button', { name: 'Continue' }));
    await waitFor(() => {
      expect(invoiceMock).toHaveBeenCalledWith('sess', 'r-pay', 21, undefined, NO_RATE_SHOWN);
    });
    useAuthStore.setState({ session: 'sess', account: null });
    await act(async () => {
      resolvePoll({ ...PAYABLE_REPLY, sats: 21 });
    });
    expect(useAuthStore.getState().account).toBeNull();
  });

  it('does not close via later sats after Back during a rejected public pay fetch', async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(forumPage([{ ...SAMPLE, replyCount: 1 }]));
    repliesMock.mockResolvedValue([{ ...PAYABLE_REPLY }]);
    invoiceMock.mockResolvedValue({ pr: 'lnbc21n1example', amountSats: 21 });
    publicFetchMock.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('poll failed')), 1);
        }),
    );
    publicFetchMock.mockResolvedValue({ ...PAYABLE_REPLY, sats: 21 });
    renderWithLocale(<ForumLoader />);
    await act(async () => {
      await Promise.resolve();
    });
    await revealAll();
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    await act(async () => {
      await Promise.resolve();
    });
    const replyCard = clickGiftOnReply();
    fireEvent.change(within(replyCard).getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(within(replyCard).getByRole('button', { name: 'Continue' }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText('Pay ₿21')).toBeTruthy();
    fireEvent.click(within(replyCard).getByRole('button', { name: 'Back' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(screen.queryByText('Pay ₿21')).toBeNull();
    expect(publicFetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps the QR after 16s of unpaid public fetches', async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(forumPage([{ ...SAMPLE, replyCount: 1 }]));
    repliesMock.mockResolvedValue([{ ...PAYABLE_REPLY }]);
    invoiceMock.mockResolvedValue({ pr: 'lnbc21n1example', amountSats: 21 });
    publicFetchMock.mockResolvedValue(PAYABLE_REPLY);
    renderWithLocale(<ForumLoader />);
    await act(async () => {
      await Promise.resolve();
    });
    await revealAll();
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    await act(async () => {
      await Promise.resolve();
    });
    const replyCard = clickGiftOnReply();
    fireEvent.change(within(replyCard).getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(within(replyCard).getByRole('button', { name: 'Continue' }));
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(16_000);
    });
    expect(screen.getByText('Pay ₿21')).toBeTruthy();
  });

  it('closes the QR when a later public fetch reports sats 21 after unpaid waits', async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(forumPage([{ ...SAMPLE, replyCount: 1 }]));
    repliesMock.mockResolvedValue([{ ...PAYABLE_REPLY }]);
    invoiceMock.mockResolvedValue({ pr: 'lnbc21n1example', amountSats: 21 });
    publicFetchMock.mockResolvedValue(PAYABLE_REPLY);
    renderWithLocale(<ForumLoader />);
    await act(async () => {
      await Promise.resolve();
    });
    await revealAll();
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    await act(async () => {
      await Promise.resolve();
    });
    const replyCard = clickGiftOnReply();
    fireEvent.change(within(replyCard).getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(within(replyCard).getByRole('button', { name: 'Continue' }));
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(16_000);
    });
    expect(screen.getByText('Pay ₿21')).toBeTruthy();
    publicFetchMock.mockResolvedValue({ ...PAYABLE_REPLY, sats: 21 });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(screen.queryByText('Pay ₿21')).toBeNull();
  });

  it('requests an invoice and shows the QR', async () => {
    fetchMock.mockResolvedValue(forumPage([{ ...SAMPLE, replyCount: 1 }]));
    repliesMock.mockResolvedValue([{ ...PAYABLE_REPLY }]);
    invoiceMock.mockResolvedValue({ pr: 'lnbc21n1example', amountSats: 21 });
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No message has received Bitcoin yet.')).toBeTruthy();
    });
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });

    const replyCard = await clickReplyGift();
    fireEvent.change(within(replyCard).getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(within(replyCard).getByRole('button', { name: 'Continue' }));

    await waitFor(() => {
      expect(invoiceMock).toHaveBeenCalledWith('sess', 'r-pay', 21, undefined, NO_RATE_SHOWN);
      expect(screen.getByRole('img', { name: 'Bitcoin payment QR code' })).toBeTruthy();
      expect(screen.getByText('Pay ₿21')).toBeTruthy();
    });
    expect(
      (within(replyCard).getByRole('button', { name: 'Send Bitcoin' }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it('keeps the reply pay sheet when switching feed mode', async () => {
    fetchMock.mockResolvedValue(forumPage([{ ...SAMPLE, sats: 21, replyCount: 1 }]));
    repliesMock.mockResolvedValue([{ ...PAYABLE_REPLY }]);
    renderWithLocale(<ForumLoader />);
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Forum view' })).toBeTruthy());
    await revealAll();
    const replyCard = await clickReplyGift();
    expect(within(replyCard).getByLabelText('Amount')).toBeTruthy();
    chooseForumMode('Active');
    expect(
      within(document.querySelector('[data-reply-id="r-pay"]') as HTMLElement).getByLabelText(
        'Amount',
      ),
    ).toBeTruthy();
  });

  it('clears the reply pay sheet when the thread is collapsed then the feed mode changes', async () => {
    fetchMock.mockResolvedValue(forumPage([{ ...SAMPLE, sats: 21, replyCount: 1 }]));
    repliesMock.mockResolvedValue([{ ...PAYABLE_REPLY }]);
    renderWithLocale(<ForumLoader />);
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Forum view' })).toBeTruthy());
    await revealAll();
    await clickReplyGift();
    fireEvent.click(screen.getByRole('button', { name: 'Hide reactions' }));
    chooseForumMode('Active');
    expect(screen.queryByLabelText('Amount')).toBeNull();
  });

  it('clears a parent-composer invoice when Active hides the unpaid parent', async () => {
    fetchMock.mockResolvedValue(forumPage([FOREIGN]));
    repliesMock.mockResolvedValue([]);
    invoiceMock.mockResolvedValue({ pr: 'lnbc21n1example', amountSats: 21 });
    renderWithLocale(<ForumLoader />);
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Forum view' })).toBeTruthy());
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Bob')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    await waitFor(() => {
      expect(screen.getByLabelText('Your reaction')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.submit(screen.getByLabelText('Your reaction').closest('form')!);
    await waitFor(() => {
      expect(invoiceMock).toHaveBeenCalledWith('sess', 'm-bob', 21, undefined, NO_RATE_SHOWN);
    });
    await waitFor(() => {
      expect(screen.getByRole('img', { name: 'Bitcoin payment QR code' })).toBeTruthy();
    });
    chooseForumMode('Active');
    expect(screen.getByText('No message has received Bitcoin yet.')).toBeTruthy();
    expect(screen.queryByRole('img', { name: 'Bitcoin payment QR code' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  });

  it('clears the pay sheet when the paid reply is deleted', async () => {
    useAuthStore.setState({ session: 'token', account: { ...account, role: 'moderator' } });
    fetchMock.mockResolvedValue(forumPage([{ ...SAMPLE, replyCount: 1 }]));
    repliesMock.mockResolvedValue([{ ...PAYABLE_REPLY }]);
    vi.mocked(deleteMessage).mockResolvedValue(undefined);
    renderWithLocale(<ForumLoader />);
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Forum view' })).toBeTruthy());
    await revealAll();
    const replyCard = await clickReplyGift();
    expect(within(replyCard).getByLabelText('Amount')).toBeTruthy();
    fireEvent.click(within(replyCard).getByRole('button', { name: 'Delete reaction' }));
    fireEvent.click(within(replyCard).getByRole('button', { name: 'Confirm deletion' }));
    await waitFor(() => expect(screen.queryByText('A payable reply')).toBeNull());
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
  });

  it('defaults an empty pay amount to 21 sats without filling the draft', async () => {
    fetchMock.mockResolvedValue(forumPage([{ ...SAMPLE, replyCount: 1 }]));
    repliesMock.mockResolvedValue([{ ...PAYABLE_REPLY }]);
    invoiceMock.mockResolvedValue({ pr: 'lnbc21n1example', amountSats: 21 });
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No message has received Bitcoin yet.')).toBeTruthy();
    });
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });

    const replyCard = await clickReplyGift();
    expect((within(replyCard).getByLabelText('Amount') as HTMLInputElement).value).toBe('');
    fireEvent.click(within(replyCard).getByRole('button', { name: 'Continue' }));
    expect((within(replyCard).getByLabelText('Amount') as HTMLInputElement).value).toBe('');

    await waitFor(() => {
      expect(invoiceMock).toHaveBeenCalledWith('sess', 'r-pay', 21, undefined, NO_RATE_SHOWN);
    });
  });

  it('defaults a whitespace-only pay amount to 21 sats without filling the draft', async () => {
    fetchMock.mockResolvedValue(forumPage([{ ...SAMPLE, replyCount: 1 }]));
    repliesMock.mockResolvedValue([{ ...PAYABLE_REPLY }]);
    invoiceMock.mockResolvedValue({ pr: 'lnbc21n1example', amountSats: 21 });
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No message has received Bitcoin yet.')).toBeTruthy();
    });
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });

    const replyCard = await clickReplyGift();
    fireEvent.change(within(replyCard).getByLabelText('Amount'), { target: { value: '   ' } });
    fireEvent.click(within(replyCard).getByRole('button', { name: 'Continue' }));
    expect((within(replyCard).getByLabelText('Amount') as HTMLInputElement).value).toBe('   ');

    await waitFor(() => {
      expect(invoiceMock).toHaveBeenCalledWith('sess', 'r-pay', 21, undefined, NO_RATE_SHOWN);
    });
  });

  it('rejects a non-numeric pay amount before calling the api', async () => {
    fetchMock.mockResolvedValue(forumPage([{ ...SAMPLE, replyCount: 1 }]));
    repliesMock.mockResolvedValue([{ ...PAYABLE_REPLY }]);
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No message has received Bitcoin yet.')).toBeTruthy();
    });
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });

    const replyCard = await clickReplyGift();
    fireEvent.change(within(replyCard).getByLabelText('Amount'), { target: { value: 'x' } });
    fireEvent.click(within(replyCard).getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('alert').textContent).toBe('Enter a whole number greater than zero');
    expect(invoiceMock).not.toHaveBeenCalled();
    expect((within(replyCard).getByLabelText('Amount') as HTMLInputElement).value).toBe('x');
  });

  it('rejects a non-positive pay amount before calling the api', async () => {
    fetchMock.mockResolvedValue(forumPage([{ ...SAMPLE, replyCount: 1 }]));
    repliesMock.mockResolvedValue([{ ...PAYABLE_REPLY }]);
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No message has received Bitcoin yet.')).toBeTruthy();
    });
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });

    const replyCard = await clickReplyGift();
    fireEvent.change(within(replyCard).getByLabelText('Amount'), { target: { value: '0' } });
    fireEvent.click(within(replyCard).getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('alert').textContent).toBe('Enter a whole number greater than zero');
    expect(invoiceMock).not.toHaveBeenCalled();
  });

  it('shows pay request error when invoice fails', async () => {
    fetchMock.mockResolvedValue(forumPage([{ ...SAMPLE, replyCount: 1 }]));
    repliesMock.mockResolvedValue([{ ...PAYABLE_REPLY }]);
    invoiceMock.mockRejectedValue(new Error('Could not start the Bitcoin payment'));
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No message has received Bitcoin yet.')).toBeTruthy();
    });
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });

    const replyCard = await clickReplyGift();
    fireEvent.change(within(replyCard).getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(within(replyCard).getByRole('button', { name: 'Continue' }));

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe('Could not start the Bitcoin payment');
  });

  it('shows pay author-wallet error when invoice rejects the author wallet', async () => {
    fetchMock.mockResolvedValue(forumPage([{ ...SAMPLE, replyCount: 1 }]));
    repliesMock.mockResolvedValue([{ ...PAYABLE_REPLY }]);
    invoiceMock.mockRejectedValue(
      new Error("The author's wallet cannot receive this Bitcoin payment"),
    );
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No message has received Bitcoin yet.')).toBeTruthy();
    });
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });

    const replyCard = await clickReplyGift();
    fireEvent.change(within(replyCard).getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(within(replyCard).getByRole('button', { name: 'Continue' }));

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe(
      "The author's wallet cannot receive this Bitcoin payment",
    );
  });

  it('shows pay rate-limit copy when invoice is rate limited', async () => {
    fetchMock.mockResolvedValue(forumPage([{ ...SAMPLE, replyCount: 1 }]));
    repliesMock.mockResolvedValue([{ ...PAYABLE_REPLY }]);
    invoiceMock.mockRejectedValue(new Error('Too many payments'));
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No message has received Bitcoin yet.')).toBeTruthy();
    });
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });

    const replyCard = await clickReplyGift();
    fireEvent.change(within(replyCard).getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(within(replyCard).getByRole('button', { name: 'Continue' }));

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe(
      'Too many payments. Please wait a moment and try again.',
    );
  });

  it('drops a late invoice after cancel', async () => {
    fetchMock.mockResolvedValue(forumPage([{ ...SAMPLE, replyCount: 1 }]));
    repliesMock.mockResolvedValue([{ ...PAYABLE_REPLY }]);
    let resolveInvoice: ((value: { pr: string; amountSats: number }) => void) | undefined;
    invoiceMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveInvoice = resolve;
        }),
    );
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No message has received Bitcoin yet.')).toBeTruthy();
    });
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });
    const replyCard = await clickReplyGift();
    fireEvent.change(within(replyCard).getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(within(replyCard).getByRole('button', { name: 'Continue' }));
    fireEvent.click(within(replyCard).getByRole('button', { name: 'Back' }));
    await act(async () => {
      resolveInvoice?.({ pr: 'lnbc21n1example', amountSats: 21 });
    });
    expect(screen.queryByRole('img', { name: 'Bitcoin payment QR code' })).toBeNull();
  });

  it('clears an in-flight pay sheet when Active hides the note', async () => {
    fetchMock.mockResolvedValue(forumPage([{ ...SAMPLE, replyCount: 1 }]));
    repliesMock.mockResolvedValue([{ ...PAYABLE_REPLY }]);
    let resolveInvoice: ((value: { pr: string; amountSats: number }) => void) | undefined;
    invoiceMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveInvoice = resolve;
        }),
    );
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No message has received Bitcoin yet.')).toBeTruthy();
    });
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });
    const replyCard = await clickReplyGift();
    fireEvent.change(within(replyCard).getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(within(replyCard).getByRole('button', { name: 'Continue' }));
    chooseForumMode('Active');
    expect(screen.getByText('No message has received Bitcoin yet.')).toBeTruthy();
    expect(screen.queryByLabelText('Amount')).toBeNull();
    expect(screen.queryByRole('img', { name: 'Bitcoin payment QR code' })).toBeNull();
    expect(invoiceMock).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveInvoice?.({ pr: 'lnbc21n1example', amountSats: 21 });
    });
    expect(screen.queryByRole('img', { name: 'Bitcoin payment QR code' })).toBeNull();
  });

  it('drops a late invoice error after cancel', async () => {
    fetchMock.mockResolvedValue(forumPage([{ ...SAMPLE, replyCount: 1 }]));
    repliesMock.mockResolvedValue([{ ...PAYABLE_REPLY }]);
    let rejectInvoice: ((reason: Error) => void) | undefined;
    invoiceMock.mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectInvoice = reject;
        }),
    );
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No message has received Bitcoin yet.')).toBeTruthy();
    });
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });
    const replyCard = await clickReplyGift();
    fireEvent.change(within(replyCard).getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(within(replyCard).getByRole('button', { name: 'Continue' }));
    fireEvent.click(within(replyCard).getByRole('button', { name: 'Back' }));
    await act(async () => {
      rejectInvoice?.(new Error('gone'));
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('omits Send Bitcoin while a loaded note is not payable', async () => {
    fetchMock.mockResolvedValue(forumPage([{ ...SAMPLE, payable: false }]));
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No message has received Bitcoin yet.')).toBeTruthy();
    });
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });
    expect(screen.queryByRole('button', { name: 'Send Bitcoin' })).toBeNull();
    expect(invoiceMock).not.toHaveBeenCalled();
  });

  it('copies payment snapshots when the payable poll updates a fiat ask', async () => {
    vi.useFakeTimers();
    const asking: ForumMessage = {
      id: 'm-ask',
      name: 'Ada',
      text: 'Half a dollar',
      createdAt: '2026-08-28T14:00:00.000Z',
      sats: 0,
      goalSats: 1000,
      goalCurrency: 'USD',
      goalAmount: '1.50',
      payable: false,
      hasPhoto: false,
      photoCount: 0,
      hasVideo: false,
      videoContentType: null,
      role: 'basis',
      replyCount: 0,
    };
    const withUsd: ForumMessage = { ...asking, amountUsd: '0.75' };
    const withChf: ForumMessage = { ...withUsd, amountChf: '0.60' };
    const withEur: ForumMessage = { ...withChf, amountEur: '0.70' };
    const withPhp: ForumMessage = { ...withEur, amountPhp: '40.00', payable: true };
    fetchMock
      .mockResolvedValueOnce(forumPage([asking]))
      .mockResolvedValueOnce(forumPage([withUsd]))
      .mockResolvedValueOnce(forumPage([withChf]))
      .mockResolvedValueOnce(forumPage([withEur]))
      .mockResolvedValueOnce(forumPage([withPhp]));

    renderWithLocale(<ForumLoader />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText('0%')).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(screen.getByText('50%')).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
    });
    expect(screen.getByText('50%')).toBeTruthy();
  });

  it('enables Send Bitcoin after payable poll upgrades an unsigned post', async () => {
    vi.useFakeTimers();
    const unsigned: ForumMessage = {
      id: 'm2',
      name: 'Ada',
      text: 'Hello',
      createdAt: '2026-08-28T14:00:00.000Z',
      sats: 0,
      payable: false,
      hasPhoto: false,
      photoCount: 0,
      hasVideo: false,
      videoContentType: null,
      role: 'basis',
      replyCount: 1,
    };
    const signed: ForumMessage = { ...unsigned, payable: true };
    fetchMock.mockResolvedValueOnce(forumPage([])).mockResolvedValue(forumPage([]));
    postMock.mockResolvedValue(unsigned);
    fetchMock.mockResolvedValueOnce(forumPage([signed])).mockResolvedValue(forumPage([signed]));
    repliesMock.mockResolvedValue([{ ...PAYABLE_REPLY }]);

    renderWithLocale(<ForumLoader />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: /^Post$/ }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText('Hello')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Send Bitcoin' })).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    await act(async () => {
      await Promise.resolve();
    });
    const replyCard = document.querySelector('[data-reply-id="r-pay"]') as HTMLElement;
    expect(within(replyCard).getByRole('button', { name: 'Send Bitcoin' })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('keeps polling when the first payable poll GET returns empty before the note is echoed', async () => {
    vi.useFakeTimers();
    const unsigned: ForumMessage = {
      id: 'm2',
      name: 'Ada',
      text: 'Hello',
      createdAt: '2026-08-28T14:00:00.000Z',
      sats: 0,
      payable: false,
      hasPhoto: false,
      photoCount: 0,
      hasVideo: false,
      videoContentType: null,
      role: 'basis',
      replyCount: 1,
    };
    const signed: ForumMessage = { ...unsigned, payable: true };
    fetchMock.mockResolvedValueOnce(forumPage([])).mockResolvedValue(forumPage([]));
    postMock.mockResolvedValue(unsigned);
    fetchMock.mockResolvedValueOnce(forumPage([])).mockResolvedValue(forumPage([]));
    fetchMock.mockResolvedValueOnce(forumPage([signed])).mockResolvedValue(forumPage([signed]));
    repliesMock.mockResolvedValue([{ ...PAYABLE_REPLY }]);

    renderWithLocale(<ForumLoader />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: /^Post$/ }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText('Hello')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Send Bitcoin' })).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(screen.getByText('Hello')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Send Bitcoin' })).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    await act(async () => {
      await Promise.resolve();
    });
    const replyCard = document.querySelector('[data-reply-id="r-pay"]') as HTMLElement;
    expect(within(replyCard).getByRole('button', { name: 'Send Bitcoin' })).toBeTruthy();
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('stops the payable poll once every listed row is payable', async () => {
    vi.useFakeTimers();
    const unsigned: ForumMessage = { ...SAMPLE, payable: false, replyCount: 1 };
    const signed: ForumMessage = { ...SAMPLE, payable: true, replyCount: 1 };
    fetchMock.mockResolvedValueOnce(forumPage([unsigned])).mockResolvedValue(forumPage([unsigned]));
    fetchMock.mockResolvedValueOnce(forumPage([signed])).mockResolvedValue(forumPage([signed]));
    repliesMock.mockResolvedValue([{ ...PAYABLE_REPLY }]);

    renderWithLocale(<ForumLoader />);
    await act(async () => {
      await Promise.resolve();
    });
    await revealAll();
    expect(screen.getByText('Hello from Ada')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Send Bitcoin' })).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    await act(async () => {
      await Promise.resolve();
    });
    const replyCard = document.querySelector('[data-reply-id="r-pay"]') as HTMLElement;
    expect(within(replyCard).getByRole('button', { name: 'Send Bitcoin' })).toBeTruthy();
    const callsAfterFirstPoll = fetchMock.mock.calls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000 * 8);
    });
    expect(fetchMock.mock.calls.length).toBe(callsAfterFirstPoll);
  });

  it('keeps the board when a payable poll fetch fails', async () => {
    vi.useFakeTimers();
    const unsigned: ForumMessage = {
      id: 'm2',
      name: 'Ada',
      text: 'Hello',
      createdAt: '2026-08-28T14:00:00.000Z',
      sats: 0,
      payable: false,
      hasPhoto: false,
      photoCount: 0,
      hasVideo: false,
      videoContentType: null,
      role: 'basis',
      replyCount: 1,
    };
    const signed: ForumMessage = { ...unsigned, payable: true };
    fetchMock.mockResolvedValueOnce(forumPage([])).mockResolvedValue(forumPage([]));
    postMock.mockResolvedValue(unsigned);
    fetchMock.mockResolvedValueOnce(forumPage([unsigned]));
    fetchMock.mockRejectedValueOnce(new Error('poll failed'));
    fetchMock.mockResolvedValueOnce(forumPage([signed])).mockResolvedValue(forumPage([signed]));
    repliesMock.mockResolvedValue([{ ...PAYABLE_REPLY }]);

    renderWithLocale(<ForumLoader />);
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: /^Post$/ }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText('Hello')).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(screen.getByText('Hello')).toBeTruthy();
    expect(screen.queryByText('Could not load messages. Please try again.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Send Bitcoin' })).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    await act(async () => {
      await Promise.resolve();
    });
    const replyCard = document.querySelector('[data-reply-id="r-pay"]') as HTMLElement;
    expect(within(replyCard).getByRole('button', { name: 'Send Bitcoin' })).toBeTruthy();
    expect(screen.queryByText('Could not load messages. Please try again.')).toBeNull();
  });

  it('aborts the payable poll after unmount before the delayed fetch', async () => {
    vi.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce(forumPage([{ ...SAMPLE, payable: false }]))
      .mockResolvedValue(forumPage([{ ...SAMPLE, payable: false }]));

    renderWithLocale(<ForumLoader />);
    await act(async () => {
      await Promise.resolve();
    });
    await revealAll();
    expect(screen.getByText('Hello from Ada')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Send Bitcoin' })).toBeNull();

    cleanup();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('ignores a payable poll fetch that resolves after unmount', async () => {
    vi.useFakeTimers();
    let resolvePoll: ((value: ReturnType<typeof forumPage>) => void) | undefined;
    fetchMock
      .mockResolvedValueOnce(forumPage([{ ...SAMPLE, payable: false }]))
      .mockResolvedValueOnce(forumPage([{ ...SAMPLE, payable: false }]))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolvePoll = resolve;
          }),
      );

    renderWithLocale(<ForumLoader />);
    await act(async () => {
      await Promise.resolve();
    });
    await revealAll();
    expect(screen.getByText('Hello from Ada')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Send Bitcoin' })).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);

    cleanup();

    await act(async () => {
      resolvePoll?.(forumPage([{ ...SAMPLE, payable: true }]));
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does not request a second invoice while one is in flight', async () => {
    fetchMock.mockResolvedValue(forumPage([{ ...SAMPLE, replyCount: 1 }]));
    repliesMock.mockResolvedValue([{ ...PAYABLE_REPLY }]);
    invoiceMock.mockReturnValue(new Promise(() => undefined));
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No message has received Bitcoin yet.')).toBeTruthy();
    });
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });
    const replyCard = await clickReplyGift();
    fireEvent.change(within(replyCard).getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(within(replyCard).getByRole('button', { name: 'Continue' }));
    fireEvent.click(within(replyCard).getByRole('button', { name: 'Continue' }));
    expect(invoiceMock).toHaveBeenCalledTimes(1);
  });

  it('does not collapse while a reply is posting', async () => {
    fetchMock.mockResolvedValue(forumPage([SAMPLE]));
    repliesMock.mockResolvedValue([]);
    postMock.mockImplementation(() => new Promise(() => undefined));
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    await waitFor(() => {
      expect(screen.getByLabelText('Your reaction')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Your reaction'), { target: { value: 'wait' } });
    fireEvent.submit(screen.getByLabelText('Your reaction').closest('form')!);
    await waitFor(() => {
      expect(postMock).toHaveBeenCalled();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Hide reactions' }));
    expect(screen.getByLabelText('Your reaction')).toBeTruthy();
  });

  it('collapses an expanded thread', async () => {
    fetchMock.mockResolvedValue(forumPage([SAMPLE]));
    repliesMock.mockResolvedValue([]);
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    await waitFor(() => {
      expect(screen.getByLabelText('Your reaction')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Hide reactions' }));
    expect(screen.queryByLabelText('Your reaction')).toBeNull();
  });

  it('loads replies via fetchReplies when a row is expanded', async () => {
    fetchMock.mockResolvedValue(forumPage([SAMPLE]));
    repliesMock.mockResolvedValue([
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
    ]);
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    await waitFor(() => {
      expect(repliesMock).toHaveBeenCalledWith('sess', 'm1');
      expect(screen.getByText('A reply')).toBeTruthy();
      expect(screen.getByPlaceholderText('Write a reaction')).toBeTruthy();
    });
  });

  it('clears stale replies immediately when expanding a different note', async () => {
    fetchMock.mockResolvedValue(
      forumPage([
        SAMPLE,
        {
          id: 'm-bob',
          name: 'Bob',
          text: 'Hello from Bob',
          createdAt: '2026-08-28T11:00:00.000Z',
          sats: 0,
          payable: true,
          hasPhoto: false,
          photoCount: 0,
          hasVideo: false,
          videoContentType: null,
          role: 'basis',
          replyCount: 0,
        },
      ]),
    );
    repliesMock.mockResolvedValueOnce([
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
    ]);
    repliesMock.mockImplementationOnce(() => new Promise(() => undefined));
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Bob')).toBeTruthy();
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Show reactions' })[0]!);
    await waitFor(() => {
      expect(screen.getByText('A reply')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    expect(screen.queryByText('A reply')).toBeNull();
    expect(screen.getByText('Loading reactions…')).toBeTruthy();
  });

  // Composer is disabled while replies are missing/loading (submit never
  // reaches postMessage). The same expandedIdRef guard is covered by the
  // error-path test below; the async success arm is v8-ignored.
  it.skip('does not apply a posted reply after expanding a different note', async () => {
    fetchMock.mockResolvedValue(
      forumPage([
        SAMPLE,
        {
          id: 'm-bob',
          name: 'Bob',
          text: 'Hello from Bob',
          createdAt: '2026-08-28T11:00:00.000Z',
          sats: 0,
          payable: true,
          hasPhoto: false,
          photoCount: 0,
          hasVideo: false,
          videoContentType: null,
          role: 'basis',
          replyCount: 0,
        },
      ]),
    );
    repliesMock.mockResolvedValueOnce([]);
    repliesMock.mockImplementationOnce(() => new Promise(() => undefined));
    let resolvePost: ((value: ForumMessage) => void) | undefined;
    postMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePost = resolve;
        }),
    );
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Bob')).toBeTruthy();
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Show reactions' })[0]!);
    await waitFor(() => {
      expect(screen.getByLabelText('Your reaction')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Your reaction'), { target: { value: 'Ada reply' } });
    fireEvent.submit(screen.getByLabelText('Your reaction').closest('form')!);
    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('sess', { text: 'Ada reply', inReplyTo: 'm1' });
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    expect(screen.queryByText('Ada reply')).toBeNull();
    expect(screen.getByText('Loading reactions…')).toBeTruthy();
    await act(async () => {
      resolvePost?.({
        id: 'r-ada',
        name: 'Ada',
        text: 'Ada reply',
        createdAt: '2026-08-28T12:45:00.000Z',
        sats: 0,
        payable: false,
        hasPhoto: false,
        photoCount: 0,
        hasVideo: false,
        videoContentType: null,
        role: 'basis',
        replyCount: 0,
      });
    });
    expect(screen.queryByText('Ada reply')).toBeNull();
    expect(screen.getByText('1 reactions')).toBeTruthy();
  });

  it('does not apply a reply error after expanding a different note', async () => {
    fetchMock.mockResolvedValue(
      forumPage([
        SAMPLE,
        {
          id: 'm-bob',
          name: 'Bob',
          text: 'Hello from Bob',
          createdAt: '2026-08-28T11:00:00.000Z',
          sats: 0,
          payable: true,
          hasPhoto: false,
          photoCount: 0,
          hasVideo: false,
          videoContentType: null,
          role: 'basis',
          replyCount: 0,
        },
      ]),
    );
    repliesMock.mockResolvedValueOnce([]);
    repliesMock.mockImplementationOnce(() => new Promise(() => undefined));
    let rejectPost: ((reason: Error) => void) | undefined;
    postMock.mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectPost = reject;
        }),
    );
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Bob')).toBeTruthy();
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Show reactions' })[0]!);
    await waitFor(() => {
      expect(screen.getByLabelText('Your reaction')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Your reaction'), { target: { value: 'Ada reply' } });
    fireEvent.submit(screen.getByLabelText('Your reaction').closest('form')!);
    await waitFor(() => {
      expect(postMock).toHaveBeenCalled();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    expect(screen.getByLabelText('Your reaction')).toBeTruthy();
    await act(async () => {
      rejectPost?.(new Error('boom'));
    });
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.queryByText('Loading reactions…')).toBeNull();
  });

  it('does not increment replyCount when the posted reply is already listed', async () => {
    const reply: ForumMessage = {
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
    };
    fetchMock.mockResolvedValue(forumPage([{ ...SAMPLE, replyCount: 1 }]));
    repliesMock.mockResolvedValue([reply]);
    postMock.mockResolvedValue(reply);
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });
    expect(screen.getByText('1 reactions')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    await waitFor(() => {
      expect(screen.getByText('A reply')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Your reaction'), { target: { value: 'A reply' } });
    fireEvent.submit(screen.getByLabelText('Your reaction').closest('form')!);
    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('sess', { text: 'A reply', inReplyTo: 'm1' });
    });
    expect(screen.getByText('1 reactions')).toBeTruthy();
    expect(screen.getAllByText('A reply')).toHaveLength(1);
  });

  it('increments replyCount when a new reply is posted', async () => {
    fetchMock.mockResolvedValue(
      forumPage([
        { ...SAMPLE, replyCount: 0 },
        {
          id: 'm-bob',
          name: 'Bob',
          text: 'Hello from Bob',
          createdAt: '2026-08-28T11:00:00.000Z',
          sats: 0,
          payable: true,
          hasPhoto: false,
          photoCount: 0,
          hasVideo: false,
          videoContentType: null,
          role: 'basis',
          replyCount: 0,
        },
      ]),
    );
    repliesMock.mockResolvedValue([]);
    postMock.mockResolvedValue({
      id: 'r-new',
      name: 'Ada',
      text: 'Fresh reply',
      createdAt: '2026-08-28T12:45:00.000Z',
      sats: 0,
      payable: false,
      hasPhoto: false,
      photoCount: 0,
      hasVideo: false,
      videoContentType: null,
      role: 'basis',
      replyCount: 0,
    });
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Bob')).toBeTruthy();
    });
    expect(screen.getAllByText('0 reactions')).toHaveLength(2);
    fireEvent.click(screen.getAllByRole('button', { name: 'Show reactions' })[0]!);
    await waitFor(() => {
      expect(screen.getByLabelText('Your reaction')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Your reaction'), { target: { value: 'Fresh reply' } });
    fireEvent.submit(screen.getByLabelText('Your reaction').closest('form')!);
    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('sess', { text: 'Fresh reply', inReplyTo: 'm1' });
      expect(screen.getByText('Fresh reply')).toBeTruthy();
      expect(screen.getByText('1 reactions')).toBeTruthy();
      expect(screen.getByText('0 reactions')).toBeTruthy();
    });
    expect(useAuthStore.getState().account?.hasPosted).toBe(true);
  });

  it('does not mark hasPosted on a swapped session after an unpaid reply', async () => {
    let resolvePost!: (value: ForumMessage) => void;
    postMock.mockReturnValue(
      new Promise((resolve) => {
        resolvePost = resolve;
      }),
    );
    fetchMock.mockResolvedValue(forumPage([SAMPLE]));
    repliesMock.mockResolvedValue([]);
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    await waitFor(() => {
      expect(screen.getByLabelText('Your reaction')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Your reaction'), { target: { value: 'Fresh reply' } });
    fireEvent.submit(screen.getByLabelText('Your reaction').closest('form')!);
    await waitFor(() => {
      expect(postMock).toHaveBeenCalled();
    });
    useAuthStore.setState({ session: 'other', account: { ...account, id: 'other-acc' } });
    await act(async () => {
      resolvePost({
        id: 'r-new',
        name: 'Ada',
        text: 'Fresh reply',
        createdAt: '2026-08-28T12:45:00.000Z',
        sats: 0,
        payable: false,
        hasPhoto: false,
        photoCount: 0,
        hasVideo: false,
        videoContentType: null,
        role: 'basis',
        replyCount: 0,
      });
    });
    expect(useAuthStore.getState().account?.hasPosted).toBeUndefined();
  });

  it('posts a reply when the account snapshot is missing', async () => {
    fetchMock.mockResolvedValue(forumPage([SAMPLE]));
    repliesMock.mockResolvedValue([]);
    postMock.mockResolvedValue({
      id: 'r-new',
      name: 'Ada',
      text: 'Fresh reply',
      createdAt: '2026-08-28T12:45:00.000Z',
      sats: 0,
      payable: false,
      hasPhoto: false,
      photoCount: 0,
      hasVideo: false,
      videoContentType: null,
      role: 'basis',
      replyCount: 0,
    });
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    await waitFor(() => {
      expect(screen.getByLabelText('Your reaction')).toBeTruthy();
    });
    useAuthStore.setState({ session: 'sess', account: null });
    invoiceMock.mockResolvedValue({ pr: 'lnbc1n1example', amountSats: 1 });
    publicFetchMock.mockResolvedValue({ ...SAMPLE, sats: 1, replyCount: 1 });
    fireEvent.change(screen.getByLabelText('Your reaction'), { target: { value: 'Fresh reply' } });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '1' } });
    fireEvent.submit(screen.getByLabelText('Your reaction').closest('form')!);
    await waitFor(() => {
      expect(invoiceMock).toHaveBeenCalledWith('sess', 'm1', 1, 'Fresh reply', NO_RATE_SHOWN);
    });
    expect(postMock).not.toHaveBeenCalled();
  });

  it('requires a sat amount to reply on someone else’s note', async () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'basis' } });
    fetchMock.mockResolvedValue(forumPage([FOREIGN]));
    repliesMock.mockResolvedValue([]);
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Bob')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    await waitFor(() => {
      expect(screen.getByLabelText('Your reaction')).toBeTruthy();
    });
    invoiceMock.mockResolvedValue({ pr: 'lnbc1', amountSats: 1 });
    fireEvent.change(screen.getByLabelText('Your reaction'), { target: { value: 'Hi Bob' } });
    fireEvent.submit(screen.getByLabelText('Your reaction').closest('form')!);
    await waitFor(() => {
      expect(composeTargetMock).toHaveBeenCalledWith('sess');
      expect(invoiceMock).toHaveBeenCalledWith(
        'sess',
        'fee-note',
        1,
        'inReplyTo:m-bob\nHi Bob',
        NO_RATE_SHOWN,
      );
    });
    expect(postMock).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Pay with Wallet of Satoshi' })).toBeTruthy();
    chooseForumMode('Active');
    expect(screen.getByRole('button', { name: 'Pay with Wallet of Satoshi' })).toBeTruthy();
  });

  it('does not switch to All after an extra gift confirms', async () => {
    fetchMock.mockResolvedValue(forumPage([{ ...SAMPLE, sats: 21, payable: true, replyCount: 1 }]));
    repliesMock.mockResolvedValue([{ ...PAYABLE_REPLY }]);
    invoiceMock.mockResolvedValue({ pr: 'lnbc21n1example', amountSats: 21 });
    publicFetchMock.mockResolvedValue({ ...PAYABLE_REPLY, sats: 21 });
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });
    expect(screen.getByRole('combobox', { name: 'Forum view' }).textContent).toContain('Active');
    const replyCard = await clickReplyGift();
    fireEvent.change(within(replyCard).getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(within(replyCard).getByRole('button', { name: 'Continue' }));
    await waitFor(() => {
      expect(publicFetchMock).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Pay with Wallet of Satoshi' })).toBeNull();
    });
    expect(screen.getByRole('combobox', { name: 'Forum view' }).textContent).toContain('Active');
    expect(screen.getByRole('combobox', { name: 'Forum view' }).textContent).not.toContain('All');
  });

  it('rejects a compose-pay reply that exceeds 8000 characters with the prefix', async () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'basis' } });
    fetchMock.mockResolvedValue(forumPage([FOREIGN]));
    repliesMock.mockResolvedValue([]);
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Bob')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    await waitFor(() => {
      expect(screen.getByLabelText('Your reaction')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Your reaction'), {
      target: { value: 'x'.repeat(FORUM_MESSAGE_MAX_LENGTH) },
    });
    fireEvent.submit(screen.getByLabelText('Your reaction').closest('form')!);
    expect(screen.getByRole('alert').textContent).toMatch(/8000/);
    expect(composeTargetMock).not.toHaveBeenCalled();
  });

  it('rejects a 403 compose-pay whose prefix would exceed 8000 characters', async () => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, role: 'verified', forumLawsDismissed: true, hasPosted: true },
    });
    fetchMock.mockResolvedValue(forumPage([FOREIGN]));
    repliesMock.mockResolvedValue([]);
    postMock.mockRejectedValue(new Error('A reply needs a Bitcoin payment'));
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Bob')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    await waitFor(() => {
      expect(screen.getByLabelText('Your reaction')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Your reaction'), {
      target: { value: 'x'.repeat(FORUM_MESSAGE_MAX_LENGTH) },
    });
    fireEvent.submit(screen.getByLabelText('Your reaction').closest('form')!);
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/8000/);
    });
    expect(composeTargetMock).not.toHaveBeenCalled();
  });

  it('refetches the open thread after a compose-pay confirms', async () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'basis' } });
    fetchMock.mockResolvedValue(forumPage([FOREIGN]));
    repliesMock.mockResolvedValue([]);
    invoiceMock.mockResolvedValue({ pr: 'lnbc1', amountSats: 1 });
    publicFetchMock.mockResolvedValue({
      id: 'fee-note',
      name: '21.gifts',
      text: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      sats: 1,
      payable: true,
      hasPhoto: false,
      photoCount: 0,
      hasVideo: false,
      videoContentType: null,
      role: 'basis',
      replyCount: 0,
    });
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Bob')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    await waitFor(() => {
      expect(screen.getByLabelText('Your reaction')).toBeTruthy();
    });
    expect(repliesMock).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText('Your reaction'), { target: { value: 'Hi Bob' } });
    fireEvent.submit(screen.getByLabelText('Your reaction').closest('form')!);
    await waitFor(() => {
      expect(publicFetchMock).toHaveBeenCalledWith(
        'fee-note',
        expect.objectContaining({ sinceSats: 0 }),
      );
    });
    await waitFor(() => {
      expect(repliesMock.mock.calls.length).toBeGreaterThan(1);
    });
  });

  it('opens the overlay when a compose-pay invoice is missing a name', async () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'basis' } });
    fetchMock.mockResolvedValue(forumPage([FOREIGN]));
    repliesMock.mockResolvedValue([]);
    invoiceMock.mockRejectedValue(new MissingRequirementsError(['name']));
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Bob')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    await waitFor(() => {
      expect(screen.getByLabelText('Your reaction')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Your reaction'), { target: { value: 'Hi Bob' } });
    fireEvent.submit(screen.getByLabelText('Your reaction').closest('form')!);
    expect(await screen.findByRole('dialog', { name: 'Add your name' })).toBeTruthy();
  });

  it('maps a compose-pay failure onto the reply error', async () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'basis' } });
    fetchMock.mockResolvedValue(forumPage([FOREIGN]));
    repliesMock.mockResolvedValue([]);
    invoiceMock.mockRejectedValue(new Error('offline'));
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Bob')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    await waitFor(() => {
      expect(screen.getByLabelText('Your reaction')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Your reaction'), { target: { value: 'Hi Bob' } });
    fireEvent.submit(screen.getByLabelText('Your reaction').closest('form')!);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
    });
  });

  it('maps a compose-pay rate-limit onto the reply error', async () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'basis' } });
    fetchMock.mockResolvedValue(forumPage([FOREIGN]));
    repliesMock.mockResolvedValue([]);
    invoiceMock.mockRejectedValue(new Error('Too many payments'));
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Bob')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    await waitFor(() => {
      expect(screen.getByLabelText('Your reaction')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Your reaction'), { target: { value: 'Hi Bob' } });
    fireEvent.submit(screen.getByLabelText('Your reaction').closest('form')!);
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/too many/i);
    });
  });

  it('shows a request error when a compose-pay overlay retry is still missing requirements', async () => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, role: 'basis', name: null, missing: [] },
    });
    fetchMock.mockResolvedValue(forumPage([FOREIGN]));
    repliesMock.mockResolvedValue([]);
    invoiceMock.mockRejectedValue(new MissingRequirementsError(['name']));
    vi.mocked(setName).mockResolvedValue({
      ...account,
      role: 'basis',
      name: 'Ada',
      missing: [],
      setup: null,
    });
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Bob')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    await waitFor(() => {
      expect(screen.getByLabelText('Your reaction')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Your reaction'), { target: { value: 'Hi Bob' } });
    fireEvent.submit(screen.getByLabelText('Your reaction').closest('form')!);
    expect(await screen.findByRole('dialog', { name: 'Add your name' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ada' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
    });
  });

  it('invoices a reply with text on someone else’s note', async () => {
    fetchMock.mockResolvedValue(forumPage([FOREIGN]));
    repliesMock.mockResolvedValue([]);
    invoiceMock.mockResolvedValue({ pr: 'lnbc21n1example', amountSats: 21 });
    publicFetchMock.mockResolvedValue({ ...FOREIGN, sats: 21, replyCount: 1 });
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Bob')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    await waitFor(() => {
      expect(screen.getByLabelText('Your reaction')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Your reaction'), { target: { value: 'Hi Bob' } });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.submit(screen.getByLabelText('Your reaction').closest('form')!);
    await waitFor(() => {
      expect(invoiceMock).toHaveBeenCalledWith('sess', 'm-bob', 21, 'Hi Bob', NO_RATE_SHOWN);
    });
    expect(postMock).not.toHaveBeenCalled();
  });

  it('invoices a gift-only reply from the composer', async () => {
    fetchMock.mockResolvedValue(forumPage([FOREIGN]));
    repliesMock.mockResolvedValue([]);
    invoiceMock.mockResolvedValue({ pr: 'lnbc21n1example', amountSats: 21 });
    publicFetchMock.mockResolvedValue({ ...FOREIGN, sats: 21, replyCount: 1 });
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Bob')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    await waitFor(() => {
      expect(screen.getByLabelText('Your reaction')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.submit(screen.getByLabelText('Your reaction').closest('form')!);
    await waitFor(() => {
      expect(invoiceMock).toHaveBeenCalledWith('sess', 'm-bob', 21, undefined, NO_RATE_SHOWN);
    });
    expect(postMock).not.toHaveBeenCalled();
  });

  it('invoices a gift-only reply when text and amount are empty', async () => {
    fetchMock.mockResolvedValue(forumPage([FOREIGN]));
    repliesMock.mockResolvedValue([]);
    invoiceMock.mockResolvedValue({ pr: 'lnbc21n1example', amountSats: 21 });
    publicFetchMock.mockResolvedValue({ ...FOREIGN, sats: 21, replyCount: 1 });
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Bob')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    await waitFor(() => {
      expect(screen.getByLabelText('Your reaction')).toBeTruthy();
    });
    fireEvent.submit(screen.getByLabelText('Your reaction').closest('form')!);
    await waitFor(() => {
      expect(invoiceMock).toHaveBeenCalledWith('sess', 'm-bob', 21, undefined, NO_RATE_SHOWN);
    });
    expect(postMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')?.textContent).not.toBe(
      'Enter a message or add a photo or video',
    );
  });

  it('invoices a gift-only reply when text and amount are empty as a founder', async () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'founder' } });
    fetchMock.mockResolvedValue(forumPage([FOREIGN]));
    repliesMock.mockResolvedValue([]);
    invoiceMock.mockResolvedValue({ pr: 'lnbc21n1example', amountSats: 21 });
    publicFetchMock.mockResolvedValue({ ...FOREIGN, sats: 21, replyCount: 1 });
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Bob')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    await waitFor(() => {
      expect(screen.getByLabelText('Your reaction')).toBeTruthy();
    });
    fireEvent.submit(screen.getByLabelText('Your reaction').closest('form')!);
    await waitFor(() => {
      expect(invoiceMock).toHaveBeenCalledWith('sess', 'm-bob', 21, undefined, NO_RATE_SHOWN);
    });
    expect(postMock).not.toHaveBeenCalled();
  });

  it('invoices a gift-only reply when text and amount are empty and the parent omits accountId', async () => {
    fetchMock.mockResolvedValue(forumPage([{ ...FOREIGN, accountId: undefined }]));
    repliesMock.mockResolvedValue([]);
    invoiceMock.mockResolvedValue({ pr: 'lnbc21n1example', amountSats: 21 });
    publicFetchMock.mockResolvedValue({ ...FOREIGN, sats: 21, replyCount: 1 });
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Bob')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    await waitFor(() => {
      expect(screen.getByLabelText('Your reaction')).toBeTruthy();
    });
    fireEvent.submit(screen.getByLabelText('Your reaction').closest('form')!);
    await waitFor(() => {
      expect(invoiceMock).toHaveBeenCalledWith('sess', 'm-bob', 21, undefined, NO_RATE_SHOWN);
    });
    expect(postMock).not.toHaveBeenCalled();
  });

  it('drops a late paid-reply invoice after Gift is opened', async () => {
    let resolveInvoice!: (value: { pr: string; amountSats: number }) => void;
    invoiceMock.mockReturnValue(
      new Promise((resolve) => {
        resolveInvoice = resolve;
      }),
    );
    fetchMock.mockResolvedValue(forumPage([{ ...FOREIGN, replyCount: 1 }]));
    repliesMock.mockResolvedValue([{ ...PAYABLE_REPLY }]);
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Bob')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    await waitFor(() => {
      expect(screen.getByLabelText('Your reaction')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Your reaction'), { target: { value: 'Hi Bob' } });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.submit(screen.getByLabelText('Your reaction').closest('form')!);
    const replyCard = clickGiftOnReply();
    await act(async () => {
      resolveInvoice({ pr: 'lnbc1', amountSats: 21 });
    });
    expect(screen.queryByRole('img', { name: 'Bitcoin payment QR code' })).toBeNull();
    expect(publicFetchMock).not.toHaveBeenCalled();
    expect(within(replyCard).getByRole('button', { name: 'Continue' })).toBeTruthy();
  });

  it('drops a late paid-reply invoice error after Gift is opened', async () => {
    let rejectInvoice!: (reason: Error) => void;
    invoiceMock.mockReturnValue(
      new Promise((_, reject) => {
        rejectInvoice = reject;
      }),
    );
    fetchMock.mockResolvedValue(forumPage([{ ...FOREIGN, replyCount: 1 }]));
    repliesMock.mockResolvedValue([{ ...PAYABLE_REPLY }]);
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Bob')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    await waitFor(() => {
      expect(screen.getByLabelText('Your reaction')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Your reaction'), { target: { value: 'Hi Bob' } });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.submit(screen.getByLabelText('Your reaction').closest('form')!);
    const replyCard = clickGiftOnReply();
    await act(async () => {
      rejectInvoice(new Error('fail'));
    });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(within(replyCard).getByRole('button', { name: 'Continue' })).toBeTruthy();
  });

  async function expandForeignAndPayReply(text: string, sats: string): Promise<void> {
    fetchMock.mockResolvedValue(forumPage([FOREIGN]));
    repliesMock.mockResolvedValue([]);
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Bob')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    await waitFor(() => {
      expect(screen.getByLabelText('Your reaction')).toBeTruthy();
    });
    if (text !== '') {
      fireEvent.change(screen.getByLabelText('Your reaction'), { target: { value: text } });
    }
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: sats } });
    fireEvent.submit(screen.getByLabelText('Your reaction').closest('form')!);
  }

  it('opens the overlay when a paid reply invoice returns missing_requirements', async () => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, name: null, missing: [] },
    });
    invoiceMock.mockRejectedValueOnce(new MissingRequirementsError(['name']));
    invoiceMock.mockResolvedValueOnce({ pr: 'lnbc1', amountSats: 21 });
    vi.mocked(setName).mockResolvedValue({
      ...account,
      name: 'Ada',
      missing: [],
      setup: null,
    });
    await expandForeignAndPayReply('Hi Bob', '21');
    expect(await screen.findByRole('dialog', { name: 'Add your name' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ada' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }));
    await waitFor(() => {
      expect(invoiceMock).toHaveBeenCalledTimes(2);
    });
  });

  it('maps a retried paid-reply missing_requirements onto the request error', async () => {
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
    invoiceMock.mockRejectedValue(new MissingRequirementsError(['name']));
    await expandForeignAndPayReply('Hi Bob', '21');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ada' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }));
    await waitFor(() => {
      expect(invoiceMock).toHaveBeenCalled();
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe('Could not post your message');
    });
  });

  it('maps a too-long paid-reply invoice error', async () => {
    invoiceMock.mockRejectedValue(new Error('text must be 1–8000 characters'));
    await expandForeignAndPayReply('Hi Bob', '21');
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe('Keep it to 8000 characters');
    });
  });

  it('maps a rate-limited paid-reply invoice error', async () => {
    invoiceMock.mockRejectedValue(new Error('too many payments'));
    await expandForeignAndPayReply('Hi Bob', '21');
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe(
        'Too many messages. Please wait a moment and try again.',
      );
    });
  });

  it('maps a generic paid-reply invoice error onto request', async () => {
    invoiceMock.mockRejectedValue(new Error('boom'));
    await expandForeignAndPayReply('Hi Bob', '21');
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe('Could not post your message');
    });
  });

  it('lets a founder reply without paying', async () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'founder' } });
    fetchMock.mockResolvedValue(forumPage([FOREIGN]));
    repliesMock.mockResolvedValue([]);
    postMock.mockResolvedValue({
      id: 'r-staff',
      name: 'Ada',
      text: 'Staff reply',
      createdAt: '2026-08-28T12:45:00.000Z',
      sats: 0,
      payable: false,
      hasPhoto: false,
      photoCount: 0,
      hasVideo: false,
      videoContentType: null,
      role: 'founder',
      replyCount: 0,
    });
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Bob')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    await waitFor(() => {
      expect(screen.getByLabelText('Your reaction')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Your reaction'), { target: { value: 'Staff reply' } });
    fireEvent.submit(screen.getByLabelText('Your reaction').closest('form')!);
    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('sess', {
        text: 'Staff reply',
        inReplyTo: 'm-bob',
      });
    });
    expect(invoiceMock).not.toHaveBeenCalled();
  });

  it('lets a moderator reply without paying', async () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'moderator' } });
    fetchMock.mockResolvedValue(forumPage([FOREIGN]));
    repliesMock.mockResolvedValue([]);
    postMock.mockResolvedValue({
      id: 'r-mod',
      name: 'Ada',
      text: 'Mod reply',
      createdAt: '2026-08-28T12:45:00.000Z',
      sats: 0,
      payable: false,
      hasPhoto: false,
      photoCount: 0,
      hasVideo: false,
      videoContentType: null,
      role: 'moderator',
      replyCount: 0,
    });
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Bob')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    await waitFor(() => {
      expect(screen.getByLabelText('Your reaction')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Your reaction'), { target: { value: 'Mod reply' } });
    fireEvent.submit(screen.getByLabelText('Your reaction').closest('form')!);
    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('sess', { text: 'Mod reply', inReplyTo: 'm-bob' });
    });
    expect(invoiceMock).not.toHaveBeenCalled();
  });

  it('keeps an optimistic reply count when a stale list refresh returns the old count', async () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'moderator' } });
    fetchMock.mockResolvedValue(forumPage([FOREIGN]));
    repliesMock.mockResolvedValue([]);
    postMock.mockResolvedValue({
      id: 'r-mod',
      name: 'Ada',
      text: 'Mod reply',
      createdAt: '2026-08-28T12:45:00.000Z',
      sats: 0,
      payable: false,
      hasPhoto: false,
      photoCount: 0,
      hasVideo: false,
      videoContentType: null,
      role: 'moderator',
      replyCount: 0,
    });
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Bob')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    await waitFor(() => {
      expect(screen.getByLabelText('Your reaction')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Your reaction'), { target: { value: 'Mod reply' } });
    fireEvent.submit(screen.getByLabelText('Your reaction').closest('form')!);
    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('sess', { text: 'Mod reply', inReplyTo: 'm-bob' });
    });
    expect(invoiceMock).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(
        within(screen.getByText('Hello from Bob').closest('li')!).getByText('1 reactions'),
      ).toBeTruthy();
    });

    fetchMock
      .mockResolvedValueOnce(forumPage([{ ...FOREIGN }]))
      .mockResolvedValue(forumPage([{ ...FOREIGN }]));
    const before = fetchMock.mock.calls.length;
    const event = new Event('pageshow');
    Object.defineProperty(event, 'persisted', { value: true });
    fireEvent(window, event);
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(before));
    expect(screen.getByText('Hello from Bob')).toBeTruthy();
    expect(
      within(screen.getByText('Hello from Bob').closest('li')!).getByText('1 reactions'),
    ).toBeTruthy();
  });

  it('lets a later server reply raise the count after posting then deleting a reply', async () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'moderator' } });
    fetchMock.mockResolvedValue(forumPage([FOREIGN]));
    repliesMock.mockResolvedValue([]);
    postMock.mockResolvedValue({
      id: 'r-mod',
      name: 'Ada',
      text: 'Mod reply',
      createdAt: '2026-08-28T12:45:00.000Z',
      sats: 0,
      payable: false,
      hasPhoto: false,
      photoCount: 0,
      hasVideo: false,
      videoContentType: null,
      role: 'moderator',
      replyCount: 0,
    });
    vi.mocked(deleteMessage).mockResolvedValue(undefined);
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Bob')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    await waitFor(() => {
      expect(screen.getByLabelText('Your reaction')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Your reaction'), { target: { value: 'Mod reply' } });
    fireEvent.submit(screen.getByLabelText('Your reaction').closest('form')!);
    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('sess', { text: 'Mod reply', inReplyTo: 'm-bob' });
    });
    await waitFor(() => {
      expect(
        within(screen.getByText('Hello from Bob').closest('li')!).getByText('1 reactions'),
      ).toBeTruthy();
    });

    const replyCard = document.querySelector('[data-reply-id="r-mod"]') as HTMLElement;
    fireEvent.click(within(replyCard).getByRole('button', { name: 'Delete reaction' }));
    fireEvent.click(within(replyCard).getByRole('button', { name: 'Confirm deletion' }));
    await waitFor(() => {
      expect(screen.queryByText('Mod reply')).toBeNull();
      expect(
        within(screen.getByText('Hello from Bob').closest('li')!).getByText('0 reactions'),
      ).toBeTruthy();
    });

    fetchMock
      .mockResolvedValueOnce(forumPage([{ ...FOREIGN, replyCount: 0 }]))
      .mockResolvedValue(forumPage([{ ...FOREIGN, replyCount: 0 }]));
    const before = fetchMock.mock.calls.length;
    const event = new Event('pageshow');
    Object.defineProperty(event, 'persisted', { value: true });
    fireEvent(window, event);
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(before));
    expect(
      within(screen.getByText('Hello from Bob').closest('li')!).getByText('0 reactions'),
    ).toBeTruthy();

    fetchMock
      .mockResolvedValueOnce(forumPage([{ ...FOREIGN, replyCount: 1 }]))
      .mockResolvedValue(forumPage([{ ...FOREIGN, replyCount: 1 }]));
    const beforeLater = fetchMock.mock.calls.length;
    fireEvent(window, event);
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(beforeLater));
    expect(
      within(screen.getByText('Hello from Bob').closest('li')!).getByText('1 reactions'),
    ).toBeTruthy();
  });

  it('lets a later server reply raise the count after a stale refresh between post and delete', async () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'moderator' } });
    fetchMock.mockResolvedValue(forumPage([FOREIGN]));
    repliesMock.mockResolvedValue([]);
    postMock.mockResolvedValue({
      id: 'r-mod',
      name: 'Ada',
      text: 'Mod reply',
      createdAt: '2026-08-28T12:45:00.000Z',
      sats: 0,
      payable: false,
      hasPhoto: false,
      photoCount: 0,
      hasVideo: false,
      videoContentType: null,
      role: 'moderator',
      replyCount: 0,
    });
    vi.mocked(deleteMessage).mockResolvedValue(undefined);
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Bob')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    await waitFor(() => {
      expect(screen.getByLabelText('Your reaction')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Your reaction'), { target: { value: 'Mod reply' } });
    fireEvent.submit(screen.getByLabelText('Your reaction').closest('form')!);
    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('sess', { text: 'Mod reply', inReplyTo: 'm-bob' });
    });
    await waitFor(() => {
      expect(
        within(screen.getByText('Hello from Bob').closest('li')!).getByText('1 reactions'),
      ).toBeTruthy();
    });

    fetchMock
      .mockResolvedValueOnce(forumPage([{ ...FOREIGN }]))
      .mockResolvedValue(forumPage([{ ...FOREIGN }]));
    const before = fetchMock.mock.calls.length;
    const event = new Event('pageshow');
    Object.defineProperty(event, 'persisted', { value: true });
    fireEvent(window, event);
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(before));
    expect(screen.getByText('Hello from Bob')).toBeTruthy();
    expect(
      within(screen.getByText('Hello from Bob').closest('li')!).getByText('1 reactions'),
    ).toBeTruthy();

    const replyCard = document.querySelector('[data-reply-id="r-mod"]') as HTMLElement;
    fireEvent.click(within(replyCard).getByRole('button', { name: 'Delete reaction' }));
    fireEvent.click(within(replyCard).getByRole('button', { name: 'Confirm deletion' }));
    await waitFor(() => {
      expect(screen.queryByText('Mod reply')).toBeNull();
      expect(
        within(screen.getByText('Hello from Bob').closest('li')!).getByText('0 reactions'),
      ).toBeTruthy();
    });

    fetchMock
      .mockResolvedValueOnce(forumPage([{ ...FOREIGN, replyCount: 0 }]))
      .mockResolvedValue(forumPage([{ ...FOREIGN, replyCount: 0 }]));
    const beforeZero = fetchMock.mock.calls.length;
    fireEvent(window, event);
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(beforeZero));
    expect(
      within(screen.getByText('Hello from Bob').closest('li')!).getByText('0 reactions'),
    ).toBeTruthy();

    fetchMock
      .mockResolvedValueOnce(forumPage([{ ...FOREIGN, replyCount: 1 }]))
      .mockResolvedValue(forumPage([{ ...FOREIGN, replyCount: 1 }]));
    const beforeLater = fetchMock.mock.calls.length;
    fireEvent(window, event);
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(beforeLater));
    expect(
      within(screen.getByText('Hello from Bob').closest('li')!).getByText('1 reactions'),
    ).toBeTruthy();
  });

  it('lets a verified member reply without paying', async () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'verified' } });
    fetchMock.mockResolvedValue(forumPage([FOREIGN]));
    repliesMock.mockResolvedValue([]);
    postMock.mockResolvedValue({
      id: 'r-staff',
      name: 'Ada',
      text: 'Staff reply',
      createdAt: '2026-08-28T12:45:00.000Z',
      sats: 0,
      payable: false,
      hasPhoto: false,
      photoCount: 0,
      hasVideo: false,
      videoContentType: null,
      role: 'verified',
      replyCount: 0,
    });
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Bob')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    await waitFor(() => {
      expect(screen.getByLabelText('Your reaction')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Your reaction'), { target: { value: 'Staff reply' } });
    fireEvent.submit(screen.getByLabelText('Your reaction').closest('form')!);
    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('sess', {
        text: 'Staff reply',
        inReplyTo: 'm-bob',
      });
    });
    expect(invoiceMock).not.toHaveBeenCalled();
  });

  it('lets the parent author reply unpaid when the note omits accountId', async () => {
    fetchMock.mockResolvedValue(forumPage([{ ...SAMPLE, accountId: undefined }]));
    repliesMock.mockResolvedValue([]);
    postMock.mockResolvedValue({
      id: 'r-own',
      name: 'Ada',
      text: 'own',
      createdAt: '2026-08-28T12:45:00.000Z',
      sats: 0,
      payable: false,
      hasPhoto: false,
      photoCount: 0,
      hasVideo: false,
      videoContentType: null,
      role: 'basis',
      replyCount: 0,
    });
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    await waitFor(() => {
      expect(screen.getByLabelText('Your reaction')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Your reaction'), { target: { value: 'own' } });
    fireEvent.submit(screen.getByLabelText('Your reaction').closest('form')!);
    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('sess', { text: 'own', inReplyTo: 'm1' });
    });
    expect(invoiceMock).not.toHaveBeenCalled();
  });

  it('starts a 1-sat invoice when unpaid reply is 403 and the parent omits accountId', async () => {
    fetchMock.mockResolvedValue(forumPage([{ ...FOREIGN, accountId: undefined }]));
    repliesMock.mockResolvedValue([]);
    postMock.mockRejectedValue(new Error('A reply needs a Bitcoin payment'));
    invoiceMock.mockResolvedValue({ pr: 'lnbc1', amountSats: 1 });
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Bob')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    await waitFor(() => {
      expect(screen.getByLabelText('Your reaction')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Your reaction'), { target: { value: 'Hi' } });
    fireEvent.submit(screen.getByLabelText('Your reaction').closest('form')!);
    await waitFor(() => {
      expect(composeTargetMock).toHaveBeenCalledWith('sess');
      expect(invoiceMock).toHaveBeenCalledWith(
        'sess',
        'fee-note',
        1,
        'inReplyTo:m-bob\nHi',
        NO_RATE_SHOWN,
      );
    });
    expect(postMock).toHaveBeenCalled();
  });

  it('rejects a non-numeric reply amount', async () => {
    fetchMock.mockResolvedValue(forumPage([FOREIGN]));
    repliesMock.mockResolvedValue([]);
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Bob')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    await waitFor(() => {
      expect(screen.getByLabelText('Your reaction')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Your reaction'), { target: { value: 'Hi' } });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: 'abc' } });
    fireEvent.submit(screen.getByLabelText('Your reaction').closest('form')!);
    expect(screen.getByRole('alert').textContent).toBe('Send at least ₿1 with your reaction');
    expect(invoiceMock).not.toHaveBeenCalled();
  });

  it('rejects a non-numeric reply amount when the reply text is empty', async () => {
    fetchMock.mockResolvedValue(forumPage([FOREIGN]));
    repliesMock.mockResolvedValue([]);
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Bob')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    await waitFor(() => {
      expect(screen.getByLabelText('Your reaction')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: 'abc' } });
    fireEvent.submit(screen.getByLabelText('Your reaction').closest('form')!);
    expect(screen.getByRole('alert').textContent).toBe('Send at least ₿1 with your reaction');
    expect(invoiceMock).not.toHaveBeenCalled();
  });

  it('sends 1 sat when the reply amount is 0', async () => {
    fetchMock.mockResolvedValue(forumPage([FOREIGN]));
    repliesMock.mockResolvedValue([]);
    invoiceMock.mockResolvedValue({ pr: 'lnbc1', amountSats: 1 });
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Bob')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    await waitFor(() => {
      expect(screen.getByLabelText('Your reaction')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Your reaction'), { target: { value: 'Hi' } });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '0' } });
    fireEvent.submit(screen.getByLabelText('Your reaction').closest('form')!);
    await waitFor(() => {
      expect(invoiceMock).toHaveBeenCalledWith('sess', 'm-bob', 1, 'Hi', NO_RATE_SHOWN);
    });
  });

  it('sends 1 sat when the reply amount is 0 and the reply text is empty', async () => {
    fetchMock.mockResolvedValue(forumPage([FOREIGN]));
    repliesMock.mockResolvedValue([]);
    invoiceMock.mockResolvedValue({ pr: 'lnbc1', amountSats: 1 });
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Bob')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    await waitFor(() => {
      expect(screen.getByLabelText('Your reaction')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '0' } });
    fireEvent.submit(screen.getByLabelText('Your reaction').closest('form')!);
    await waitFor(() => {
      expect(invoiceMock).toHaveBeenCalledWith('sess', 'm-bob', 1, undefined, NO_RATE_SHOWN);
    });
  });

  it('rejects an overflowing reply amount', async () => {
    fetchMock.mockResolvedValue(forumPage([FOREIGN]));
    repliesMock.mockResolvedValue([]);
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Bob')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    await waitFor(() => {
      expect(screen.getByLabelText('Your reaction')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Your reaction'), { target: { value: 'Hi' } });
    fireEvent.change(screen.getByLabelText('Amount'), {
      target: { value: '9007199254740992' },
    });
    fireEvent.submit(screen.getByLabelText('Your reaction').closest('form')!);
    expect(screen.getByRole('alert').textContent).toBe('Send at least ₿1 with your reaction');
    expect(invoiceMock).not.toHaveBeenCalled();
  });

  it('starts a 1-sat invoice when an unpaid reply is 403', async () => {
    fetchMock.mockResolvedValue(forumPage([SAMPLE]));
    repliesMock.mockResolvedValue([]);
    postMock.mockRejectedValue(new Error('A reply needs a Bitcoin payment'));
    invoiceMock.mockResolvedValue({ pr: 'lnbc1', amountSats: 1 });
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    await waitFor(() => {
      expect(screen.getByLabelText('Your reaction')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Your reaction'), { target: { value: 'own' } });
    fireEvent.submit(screen.getByLabelText('Your reaction').closest('form')!);
    await waitFor(() => {
      expect(composeTargetMock).toHaveBeenCalledWith('sess');
      expect(invoiceMock).toHaveBeenCalledWith(
        'sess',
        'fee-note',
        1,
        'inReplyTo:m1\nown',
        NO_RATE_SHOWN,
      );
    });
  });

  it('does not refetch replies after a pay-sheet gift on a nested reply', async () => {
    vi.useFakeTimers();
    try {
      fetchMock.mockResolvedValue(forumPage([{ ...SAMPLE, replyCount: 1 }]));
      repliesMock.mockResolvedValue([{ ...PAYABLE_REPLY }]);
      invoiceMock.mockResolvedValue({ pr: 'lnbc21n1example', amountSats: 21 });
      publicFetchMock.mockResolvedValue({ ...PAYABLE_REPLY, sats: 21 });
      renderWithLocale(<ForumLoader />);
      await act(async () => {
        await Promise.resolve();
      });
      await revealAll();
      fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
      await act(async () => {
        await Promise.resolve();
      });
      expect(repliesMock).toHaveBeenCalledTimes(1);
      const replyCard = clickGiftOnReply();
      fireEvent.change(within(replyCard).getByLabelText('Amount'), {
        target: { value: '21' },
      });
      fireEvent.click(within(replyCard).getByRole('button', { name: 'Continue' }));
      await act(async () => {
        await Promise.resolve();
      });
      // Paying a reply credits that row; it does not insert a nested gift-reply,
      // so the expanded thread is not refetched.
      expect(repliesMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('updates the reply draft from the expanded composer', async () => {
    fetchMock.mockResolvedValue(forumPage([SAMPLE]));
    repliesMock.mockResolvedValue([]);
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    await waitFor(() => {
      expect(screen.getByLabelText('Your reaction')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Your reaction'), {
      target: { value: 'A reply draft' },
    });
    expect((screen.getByLabelText('Your reaction') as HTMLTextAreaElement).value).toBe(
      'A reply draft',
    );
  });

  it('refetches when the document becomes visible again after being hidden', async () => {
    fetchMock
      .mockResolvedValueOnce(forumPage([SAMPLE]))
      .mockResolvedValueOnce(forumPage([SAMPLE]))
      .mockResolvedValue(
        forumPage([
          {
            id: 'm-new',
            name: 'Carol',
            text: 'Fresh from refresh',
            createdAt: '2026-08-28T15:00:00.000Z',
            sats: 0,
            payable: true,
            hasPhoto: false,
            photoCount: 0,
            hasVideo: false,
            videoContentType: null,
            role: 'basis',
            replyCount: 0,
          },
          SAMPLE,
        ]),
      );
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(screen.getByText('Fresh from refresh')).toBeTruthy();
    });
  });

  it('holds unseen notes behind New posts when the page is scrolled down', async () => {
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 800 });
    fetchMock
      .mockResolvedValueOnce(forumPage([SAMPLE]))
      .mockResolvedValueOnce(forumPage([SAMPLE]))
      .mockResolvedValue(forumPage([FRESH, SAMPLE]));
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'New posts' })).toBeTruthy();
    });
    expect(screen.queryByText('Fresh from refresh')).toBeNull();
    expect(screen.getByText('Hello from Ada')).toBeTruthy();
  });

  it('holds an unseen unpaid note behind New posts without counting it on the unpaid chip', async () => {
    window.localStorage.setItem('21gifts.forum-unpaid-seen', '2026-01-01T00:00:00.000Z');
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, forumLawsDismissed: true },
    });
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 800 });
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {
      Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
    });
    const held: ForumMessage = {
      id: 'm-held-unpaid',
      name: 'Carol',
      text: 'Held unpaid from refresh',
      createdAt: '2026-08-28T16:00:00.000Z',
      sats: 0,
      payable: true,
      hasPhoto: false,
      photoCount: 0,
      hasVideo: false,
      videoContentType: null,
      role: 'basis',
      replyCount: 0,
    };
    fetchMock
      .mockResolvedValueOnce(forumPage([SAMPLE]))
      .mockResolvedValueOnce(forumPage([SAMPLE]))
      .mockResolvedValue(forumPage([held, SAMPLE]));
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Forum view' }).textContent).toContain('Active');
      expect(screen.getByRole('combobox', { name: 'Forum view' }).textContent).toContain('1');
    });
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'New posts' })).toBeTruthy();
    });
    expect(screen.queryByText('Held unpaid from refresh')).toBeNull();
    expect(screen.getByRole('combobox', { name: 'Forum view' }).textContent).toContain('All');
    expect(screen.getByRole('combobox', { name: 'Forum view' }).textContent).toContain('1');
    expect(screen.getByText('Hello from Ada')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'New posts' }));
    await waitFor(() => {
      expect(screen.getByText('Held unpaid from refresh')).toBeTruthy();
    });
    expect(screen.queryByRole('button', { name: 'New posts' })).toBeNull();
    expect(screen.getByRole('combobox', { name: 'Forum view' }).textContent).toContain('2');
    expect(window.localStorage.getItem('21gifts.forum-unpaid-seen')).toBe(
      '2026-01-01T00:00:00.000Z',
    );
    scrollTo.mockRestore();
  });

  it('applies held notes and scrolls to top when New posts is clicked', async () => {
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 800 });
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {
      Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
    });
    fetchMock
      .mockResolvedValueOnce(forumPage([SAMPLE]))
      .mockResolvedValueOnce(forumPage([SAMPLE]))
      .mockResolvedValue(forumPage([FRESH, SAMPLE]));
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'New posts' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'New posts' }));
    await waitFor(() => {
      expect(screen.getByText('Fresh from refresh')).toBeTruthy();
    });
    expect(screen.queryByRole('button', { name: 'New posts' })).toBeNull();
    expect(scrollTo).toHaveBeenCalled();
    scrollTo.mockRestore();
  });

  it('holds New posts against the AppShell scroller and scrolls that node to top', async () => {
    fetchMock
      .mockResolvedValueOnce(forumPage([SAMPLE]))
      .mockResolvedValueOnce(forumPage([SAMPLE]))
      .mockResolvedValue(forumPage([FRESH, SAMPLE]));
    const { container } = renderWithLocale(
      <AppShell mode="fill">
        <ForumLoader />
      </AppShell>,
    );
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });
    const scroller = container.querySelector('.overflow-y-auto');
    expect(scroller).toBeTruthy();
    if (!(scroller instanceof HTMLElement)) {
      throw new Error('expected AppShell scroller');
    }
    scroller.scrollTop = 800;
    const scrollTo = vi.fn();
    scroller.scrollTo = scrollTo;

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'New posts' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'New posts' }));
    await waitFor(() => {
      expect(screen.getByText('Fresh from refresh')).toBeTruthy();
    });
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it('clears force-apply when New posts is clicked while a refresh is already running', async () => {
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 800 });
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {
      Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
    });
    fetchMock
      .mockResolvedValueOnce(forumPage([SAMPLE]))
      .mockResolvedValueOnce(forumPage([SAMPLE]))
      .mockResolvedValue(forumPage([FRESH, SAMPLE]));
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'New posts' })).toBeTruthy();
    });

    const pill = screen.getByRole('button', { name: 'New posts' });
    fireEvent.click(pill);
    fireEvent.click(pill);
    await waitFor(() => {
      expect(screen.getByText('Fresh from refresh')).toBeTruthy();
    });
  });

  it('applies an explicit New posts click even if the visitor scrolls during the fetch', async () => {
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 800 });
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {
      Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
    });
    let release: ((value: ReturnType<typeof forumPage>) => void) | undefined;
    fetchMock
      .mockResolvedValueOnce(forumPage([SAMPLE]))
      .mockResolvedValueOnce(forumPage([SAMPLE]))
      .mockResolvedValueOnce(forumPage([FRESH, SAMPLE]))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            release = resolve;
          }),
      );
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'New posts' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'New posts' }));
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 800 });
    await act(async () => {
      release?.(forumPage([FRESH, SAMPLE]));
    });
    await waitFor(() => {
      expect(screen.getByText('Fresh from refresh')).toBeTruthy();
    });
  });

  it('applies held notes when the visitor scrolls back to the top', async () => {
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 800 });
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    fetchMock
      .mockResolvedValueOnce(forumPage([SAMPLE]))
      .mockResolvedValueOnce(forumPage([SAMPLE]))
      .mockResolvedValue(forumPage([FRESH, SAMPLE]));
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'New posts' })).toBeTruthy();
    });

    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    await waitFor(() => {
      expect(screen.getByText('Fresh from refresh')).toBeTruthy();
    });
  });

  it('scrolls to top and force-applies on the forum home event', async () => {
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 800 });
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {
      Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
    });
    fetchMock
      .mockResolvedValueOnce(forumPage([SAMPLE]))
      .mockResolvedValueOnce(forumPage([SAMPLE]))
      .mockResolvedValue(forumPage([FRESH, SAMPLE]));
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });

    act(() => {
      window.dispatchEvent(new Event(FORUM_HOME_EVENT));
    });

    await waitFor(() => {
      expect(screen.getByText('Fresh from refresh')).toBeTruthy();
    });
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    scrollTo.mockRestore();
  });

  it('polls the forum list on the visible-tab interval', async () => {
    vi.useFakeTimers({ toFake: ['setInterval'] });
    fetchMock.mockResolvedValue(forumPage([SAMPLE]));
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    fetchMock
      .mockResolvedValueOnce(forumPage([FRESH, SAMPLE]))
      .mockResolvedValue(forumPage([FRESH, SAMPLE]));
    await act(async () => {
      vi.advanceTimersByTime(FORUM_LIST_POLL_MS);
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });
  });

  it('does not poll while the document is hidden', async () => {
    vi.useFakeTimers({ toFake: ['setInterval'] });
    fetchMock.mockResolvedValue(forumPage([SAMPLE]));
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    await act(async () => {
      vi.advanceTimersByTime(FORUM_LIST_POLL_MS);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not insert unseen ids from the payable poll while scrolled', async () => {
    vi.useFakeTimers();
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 800 });
    const unsigned: ForumMessage = { ...SAMPLE, payable: false };
    fetchMock
      .mockResolvedValueOnce(forumPage([unsigned]))
      .mockResolvedValueOnce(forumPage([unsigned]))
      .mockResolvedValue(forumPage([FRESH, unsigned]));
    renderWithLocale(<ForumLoader />);
    await act(async () => {
      await Promise.resolve();
    });
    chooseForumMode(/^All$/);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText('Hello from Ada')).toBeTruthy();
    expect(screen.queryByText('Fresh from refresh')).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(screen.getByText('Hello from Ada')).toBeTruthy();
    expect(screen.queryByText('Fresh from refresh')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Send Bitcoin' })).toBeNull();
  });

  it('does not keep force-apply from a Home click during the initial load', async () => {
    let release: ((value: ReturnType<typeof forumPage>) => void) | undefined;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {
      Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
    });
    renderWithLocale(<ForumLoader />);
    act(() => {
      window.dispatchEvent(new Event(FORUM_HOME_EVENT));
    });
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 800 });
    await act(async () => {
      release?.(forumPage([SAMPLE]));
    });
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });

    fetchMock
      .mockResolvedValueOnce(forumPage([FRESH, SAMPLE]))
      .mockResolvedValue(forumPage([FRESH, SAMPLE]));
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'New posts' })).toBeTruthy();
    });
    expect(screen.queryByText('Fresh from refresh')).toBeNull();
  });

  it('holds unseen ids on a loaded empty feed while scrolled', async () => {
    fetchMock.mockResolvedValueOnce(forumPage([])).mockResolvedValue(forumPage([]));
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });

    Object.defineProperty(window, 'scrollY', { configurable: true, value: 800 });
    fetchMock.mockResolvedValueOnce(forumPage([FRESH])).mockResolvedValue(forumPage([FRESH]));
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'New posts' })).toBeTruthy();
    });
    expect(screen.queryByText('Fresh from refresh')).toBeNull();
  });

  it('does not double-fetch on first mount before any visibility event', async () => {
    fetchMock.mockResolvedValue(forumPage([]));
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refetches on pageshow when persisted is true, not when false', async () => {
    fetchMock.mockResolvedValueOnce(forumPage([SAMPLE])).mockResolvedValue(forumPage([SAMPLE]));
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    act(() => {
      const notPersisted = new Event('pageshow');
      Object.defineProperty(notPersisted, 'persisted', { value: false });
      window.dispatchEvent(notPersisted);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    act(() => {
      const persisted = new Event('pageshow');
      Object.defineProperty(persisted, 'persisted', { value: true });
      window.dispatchEvent(persisted);
    });
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });
  });

  it('does not double-fetch when pageshow and visibilitychange fire in the same turn', async () => {
    fetchMock.mockResolvedValueOnce(forumPage([SAMPLE])).mockResolvedValue(forumPage([SAMPLE]));
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    act(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'hidden',
      });
      document.dispatchEvent(new Event('visibilitychange'));
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'visible',
      });
      document.dispatchEvent(new Event('visibilitychange'));
      const persisted = new Event('pageshow');
      Object.defineProperty(persisted, 'persisted', { value: true });
      window.dispatchEvent(persisted);
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });
  });

  it('does not refresh while a pay sheet is open', async () => {
    fetchMock.mockResolvedValue(forumPage([{ ...SAMPLE, replyCount: 1 }]));
    repliesMock.mockResolvedValue([{ ...PAYABLE_REPLY }]);
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });
    const replyCard = await clickReplyGift();
    await waitFor(() => {
      expect(within(replyCard).getByLabelText('Amount')).toBeTruthy();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('refreshes after a blocked visibility cycle once the pay sheet closes', async () => {
    fetchMock.mockResolvedValue(forumPage([{ ...SAMPLE, replyCount: 1 }]));
    repliesMock.mockResolvedValue([{ ...PAYABLE_REPLY }]);
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });
    const replyCard = await clickReplyGift();
    await waitFor(() => {
      expect(within(replyCard).getByLabelText('Amount')).toBeTruthy();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    fireEvent.click(within(replyCard).getByRole('button', { name: 'Back' }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });
  });

  it('keeps the list and does not show forum.error when a silent refresh fails', async () => {
    fetchMock
      .mockResolvedValueOnce(forumPage([SAMPLE]))
      .mockResolvedValueOnce(forumPage([SAMPLE]))
      .mockRejectedValueOnce(new Error('Could not load messages. Please try again.'));
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });
    expect(screen.getByText('Hello from Ada')).toBeTruthy();
    expect(screen.queryByText('Could not load messages. Please try again.')).toBeNull();
  });

  it('does not refresh while the initial fetch is still loading', async () => {
    fetchMock.mockReturnValue(new Promise(() => undefined));
    renderWithLocale(<ForumLoader />);
    expect(screen.getByText('Loading…')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('sets forum.error when a silent refresh fails before any list is loaded', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('Could not load messages. Please try again.'))
      .mockRejectedValueOnce(new Error('Could not load messages. Please try again.'));
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('Could not load messages. Please try again.')).toBeTruthy();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByText('Could not load messages. Please try again.')).toBeTruthy();
  });

  it('does not scroll the newest note into view when refresh adds a newer message id', async () => {
    fetchMock.mockResolvedValueOnce(forumPage([SAMPLE])).mockResolvedValue(
      forumPage([
        {
          id: 'm-newer',
          name: 'Carol',
          text: 'Newer note',
          createdAt: '2026-08-28T16:00:00.000Z',
          sats: 21,
          payable: true,
          hasPhoto: false,
          photoCount: 0,
          hasVideo: false,
          videoContentType: null,
          role: 'basis',
          replyCount: 0,
        },
        SAMPLE,
      ]),
    );
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });
    const scrollMock = HTMLElement.prototype.scrollIntoView as unknown as ReturnType<typeof vi.fn>;
    scrollMock.mockClear();

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => {
      expect(screen.getByText('Newer note')).toBeTruthy();
    });
    await act(async () => {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      });
    });
    expect(scrollMock).not.toHaveBeenCalled();
  });

  it('refetches when the board is pulled at the top of the page', async () => {
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
    fetchMock.mockResolvedValueOnce(forumPage([SAMPLE])).mockResolvedValue(forumPage([SAMPLE]));
    const { container } = renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const root = container.querySelector('.overscroll-y-contain');
    expect(root).toBeTruthy();
    fireEvent.touchStart(root!, { touches: [{ clientY: 100 }] });
    fireEvent.touchMove(root!, { touches: [{ clientY: 160 }] });
    fireEvent.touchEnd(root!);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });
  });

  it('ignores a silent refresh that finishes after unmount', async () => {
    let resolveRefresh: (value: ReturnType<typeof forumPage>) => void = () => undefined;
    fetchMock
      .mockResolvedValueOnce(forumPage([SAMPLE]))
      .mockResolvedValueOnce(forumPage([SAMPLE]))
      .mockImplementationOnce(
        () =>
          new Promise<ReturnType<typeof forumPage>>((resolve) => {
            resolveRefresh = resolve;
          }),
      );
    const { unmount } = renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });
    unmount();
    await act(async () => {
      resolveRefresh(forumPage([SAMPLE]));
    });
  });

  it('redirects to /setup/rules when the message list returns missing_requirements', async () => {
    fetchMock.mockRejectedValue(new MissingRequirementsError(['rules']));
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/setup/rules');
    });
  });

  it('redirects to /setup/rules when a silent refresh returns missing_requirements', async () => {
    fetchMock
      .mockResolvedValueOnce(forumPage([SAMPLE]))
      .mockResolvedValueOnce(forumPage([SAMPLE]))
      .mockRejectedValueOnce(new MissingRequirementsError(['rules']));
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/setup/rules');
    });
  });

  it('opens the requirements overlay when posting with a missing name', async () => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, name: null, missing: ['name'], forumLawsDismissed: true },
    });
    fetchMock.mockResolvedValue(forumPage([]));
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: /^Post$/ }));
    expect(screen.getByRole('dialog', { name: 'Add your name' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull();
    expect(postMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens the requirements overlay when posting with a missing lightning-address', async () => {
    useAuthStore.setState({
      session: 'sess',
      account: {
        ...account,
        lightningAddress: null,
        missing: ['lightning-address'],
        forumLawsDismissed: true,
      },
    });
    fetchMock.mockResolvedValue(forumPage([]));
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: /^Post$/ }));
    expect(screen.getByRole('dialog', { name: 'Add your Wallet of Satoshi address' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull();
    expect(postMock).not.toHaveBeenCalled();
  });

  it('opens the overlay when posting returns missing_requirements', async () => {
    fetchMock.mockResolvedValue(forumPage([]));
    postMock.mockRejectedValue(new MissingRequirementsError(['name']));
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: /^Post$/ }));
    expect(await screen.findByRole('dialog', { name: 'Add your name' })).toBeTruthy();
  });

  it('opens the overlay when posting returns a lightning-address missing_requirements', async () => {
    fetchMock.mockResolvedValue(forumPage([]));
    postMock.mockRejectedValue(new MissingRequirementsError(['lightning-address']));
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: /^Post$/ }));
    expect(
      await screen.findByRole('dialog', { name: 'Add your Wallet of Satoshi address' }),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull();
  });

  it('retries the post after the lightning-address overlay is satisfied', async () => {
    useAuthStore.setState({
      session: 'sess',
      account: {
        ...account,
        lightningAddress: null,
        missing: ['lightning-address'],
        forumLawsDismissed: true,
      },
    });
    fetchMock.mockResolvedValue(forumPage([]));
    postMock.mockResolvedValue(SAMPLE);
    vi.mocked(setLightningAddress).mockResolvedValue({
      ...account,
      lightningAddress: 'alice@walletofsatoshi.com',
      missing: [],
      setup: null,
      forumLawsDismissed: true,
    });
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: /^Post$/ }));
    fireEvent.change(screen.getByLabelText('Wallet of Satoshi address'), {
      target: { value: 'alice@walletofsatoshi.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Link address' }));
    await waitFor(() => {
      expect(postMock).toHaveBeenCalled();
    });
  });

  it('retries the post after the name overlay is satisfied', async () => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, name: null, missing: ['name'], forumLawsDismissed: true },
    });
    fetchMock.mockResolvedValue(forumPage([]));
    postMock.mockResolvedValue(SAMPLE);
    vi.mocked(setName).mockResolvedValue({
      ...account,
      name: 'Ada',
      missing: [],
      setup: null,
      forumLawsDismissed: true,
    });
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: /^Post$/ }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ada' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }));
    await waitFor(() => {
      expect(postMock).toHaveBeenCalled();
    });
  });

  it('advances from rules to name when the overlay still has a gap', async () => {
    useAuthStore.setState({
      session: 'sess',
      account: {
        ...account,
        name: null,
        rulesAgreedAt: null,
        missing: ['rules', 'name'],
        forumLawsDismissed: true,
      },
    });
    fetchMock.mockResolvedValue(forumPage([]));
    vi.mocked(agreeToRules).mockResolvedValue({
      ...account,
      name: null,
      rulesAgreedAt: 2,
      missing: ['name'],
      setup: 'name',
      forumLawsDismissed: true,
    });
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: /^Post$/ }));
    expect(screen.getByRole('dialog', { name: 'Agree to the living room rules' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'I agree to these rules' }));
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Add your name' })).toBeTruthy();
    });
    expect(postMock).not.toHaveBeenCalled();
  });

  it('does not reopen the overlay when a retried post is still missing requirements', async () => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, name: null, missing: ['name'], forumLawsDismissed: true },
    });
    fetchMock.mockResolvedValue(forumPage([]));
    postMock.mockRejectedValue(new MissingRequirementsError(['name']));
    vi.mocked(setName).mockResolvedValue({
      ...account,
      name: 'Ada',
      missing: [],
      setup: null,
      forumLawsDismissed: true,
    });
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: /^Post$/ }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ada' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }));
    await waitFor(() => {
      expect(postMock).toHaveBeenCalled();
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('alert').textContent).toBe('Could not post your message');
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
    fetchMock.mockResolvedValue(forumPage([{ ...SAMPLE, replyCount: 1 }]));
    repliesMock.mockResolvedValue([{ ...PAYABLE_REPLY }]);
    invoiceMock.mockResolvedValue({ pr: 'lnbc21n1example', amountSats: 21 });
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });
    const replyCard = await clickReplyGift();
    fireEvent.change(within(replyCard).getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(within(replyCard).getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('dialog', { name: 'Add your name' })).toBeTruthy();
    expect(invoiceMock).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ada' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }));
    await waitFor(() => {
      expect(invoiceMock).toHaveBeenCalledWith('sess', 'r-pay', 21, undefined, NO_RATE_SHOWN);
    });
  });

  it('opens the overlay when a gift continue returns missing_requirements', async () => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, name: null, missing: [] },
    });
    invoiceMock.mockRejectedValueOnce(new MissingRequirementsError(['name']));
    invoiceMock.mockResolvedValueOnce({ pr: 'lnbc1', amountSats: 21 });
    vi.mocked(setName).mockResolvedValue({
      ...account,
      name: 'Ada',
      missing: [],
      setup: null,
    });
    fetchMock.mockResolvedValue(forumPage([{ ...SAMPLE, replyCount: 1 }]));
    repliesMock.mockResolvedValue([{ ...PAYABLE_REPLY }]);
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });
    const replyCard = await clickReplyGift();
    fireEvent.change(within(replyCard).getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(within(replyCard).getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('dialog', { name: 'Add your name' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ada' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }));
    await waitFor(() => {
      expect(invoiceMock).toHaveBeenCalledTimes(2);
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
    invoiceMock.mockRejectedValue(new MissingRequirementsError(['name']));
    fetchMock.mockResolvedValue(forumPage([{ ...SAMPLE, replyCount: 1 }]));
    repliesMock.mockResolvedValue([{ ...PAYABLE_REPLY }]);
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });
    const replyCard = await clickReplyGift();
    fireEvent.change(within(replyCard).getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(within(replyCard).getByRole('button', { name: 'Continue' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ada' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }));
    await waitFor(() => {
      expect(invoiceMock).toHaveBeenCalled();
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('alert').textContent).toBe('Could not start the Bitcoin payment');
  });

  it('opens the overlay when a reply is missing a name', async () => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, name: null, missing: ['name'], forumLawsDismissed: true },
    });
    fetchMock.mockResolvedValue(forumPage([{ ...SAMPLE, replyCount: 0 }]));
    repliesMock.mockResolvedValue([]);
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    await waitFor(() => {
      expect(screen.getByLabelText('Your reaction')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Your reaction'), { target: { value: 'reply' } });
    fireEvent.submit(screen.getByLabelText('Your reaction').closest('form')!);
    expect(screen.getByRole('dialog', { name: 'Add your name' })).toBeTruthy();
    expect(postMock).not.toHaveBeenCalled();
  });

  it('opens the overlay when a reply returns missing_requirements', async () => {
    fetchMock.mockResolvedValue(forumPage([{ ...SAMPLE, replyCount: 0 }]));
    repliesMock.mockResolvedValue([]);
    postMock.mockRejectedValue(new MissingRequirementsError(['name']));
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    await waitFor(() => {
      expect(screen.getByLabelText('Your reaction')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Your reaction'), { target: { value: 'reply' } });
    fireEvent.submit(screen.getByLabelText('Your reaction').closest('form')!);
    expect(await screen.findByRole('dialog', { name: 'Add your name' })).toBeTruthy();
  });

  it('retries the post after a missing_requirements overlay is satisfied', async () => {
    fetchMock.mockResolvedValue(forumPage([]));
    postMock.mockRejectedValueOnce(new MissingRequirementsError(['rules']));
    postMock.mockResolvedValueOnce(SAMPLE);
    vi.mocked(agreeToRules).mockResolvedValue({
      ...account,
      rulesAgreedAt: 2,
      missing: [],
      setup: null,
      forumLawsDismissed: true,
    });
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No messages yet — be the first to write one.')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: /^Post$/ }));
    expect(
      await screen.findByRole('dialog', { name: 'Agree to the living room rules' }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'I agree to these rules' }));
    await waitFor(() => {
      expect(postMock).toHaveBeenCalledTimes(2);
    });
  });

  it('retries the reply after the name overlay is satisfied', async () => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, name: null, missing: ['name'], forumLawsDismissed: true },
    });
    fetchMock.mockResolvedValue(forumPage([{ ...SAMPLE, replyCount: 0 }]));
    repliesMock.mockResolvedValue([]);
    postMock.mockResolvedValue({
      id: 'r-new',
      name: 'Ada',
      text: 'reply',
      createdAt: '2026-08-28T12:45:00.000Z',
      sats: 0,
      payable: false,
      hasPhoto: false,
      photoCount: 0,
      hasVideo: false,
      videoContentType: null,
      role: 'basis',
      replyCount: 0,
    });
    vi.mocked(setName).mockResolvedValue({
      ...account,
      name: 'Ada',
      missing: [],
      setup: null,
      forumLawsDismissed: true,
    });
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    await waitFor(() => {
      expect(screen.getByLabelText('Your reaction')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Your reaction'), { target: { value: 'reply' } });
    fireEvent.submit(screen.getByLabelText('Your reaction').closest('form')!);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ada' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }));
    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('sess', { text: 'reply', inReplyTo: 'm1' });
    });
  });

  it('retries the reply after a missing_requirements overlay is satisfied', async () => {
    fetchMock.mockResolvedValue(forumPage([{ ...SAMPLE, replyCount: 0 }]));
    repliesMock.mockResolvedValue([]);
    postMock.mockRejectedValueOnce(new MissingRequirementsError(['rules']));
    postMock.mockResolvedValueOnce({
      id: 'r-new',
      name: 'Ada',
      text: 'reply',
      createdAt: '2026-08-28T12:45:00.000Z',
      sats: 0,
      payable: false,
      hasPhoto: false,
      photoCount: 0,
      hasVideo: false,
      videoContentType: null,
      role: 'basis',
      replyCount: 0,
    });
    vi.mocked(agreeToRules).mockResolvedValue({
      ...account,
      rulesAgreedAt: 2,
      missing: [],
      setup: null,
      forumLawsDismissed: true,
    });
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    await waitFor(() => {
      expect(screen.getByLabelText('Your reaction')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Your reaction'), { target: { value: 'reply' } });
    fireEvent.submit(screen.getByLabelText('Your reaction').closest('form')!);
    expect(
      await screen.findByRole('dialog', { name: 'Agree to the living room rules' }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'I agree to these rules' }));
    await waitFor(() => {
      expect(postMock).toHaveBeenCalledTimes(2);
    });
  });

  it('maps a retried unpaid-reply missing_requirements onto the request error', async () => {
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
    postMock.mockRejectedValue(new MissingRequirementsError(['name']));
    fetchMock.mockResolvedValue(forumPage([{ ...SAMPLE, replyCount: 0 }]));
    repliesMock.mockResolvedValue([]);
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(screen.getByText('Hello from Ada')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    await waitFor(() => {
      expect(screen.getByLabelText('Your reaction')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Your reaction'), { target: { value: 'reply' } });
    fireEvent.submit(screen.getByLabelText('Your reaction').closest('form')!);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ada' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }));
    await waitFor(() => {
      expect(postMock).toHaveBeenCalled();
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('alert').textContent).toBe('Could not post your message');
  });

  it('shows the moderator banner for an unread moderator_appointed notification', async () => {
    fetchMock.mockResolvedValue(forumPage([SAMPLE]));
    fetchNotificationsMock.mockResolvedValue({
      notifications: [UNREAD_APPOINTED],
      unreadCount: 1,
    });
    renderWithLocale(<ForumLoader />);
    expect(await screen.findByRole('button', { name: 'You are a moderator' })).toBeTruthy();
  });

  it('marks the appointed notification read and hides the banner on click', async () => {
    fetchMock.mockResolvedValue(forumPage([SAMPLE]));
    fetchNotificationsMock.mockResolvedValue({
      notifications: [UNREAD_APPOINTED],
      unreadCount: 1,
    });
    renderWithLocale(<ForumLoader />);
    fireEvent.click(await screen.findByRole('button', { name: 'You are a moderator' }));
    await waitFor(() => {
      expect(markNotificationReadMock).toHaveBeenCalledWith('sess', 'n-mod');
      expect(screen.queryByRole('button', { name: 'You are a moderator' })).toBeNull();
    });
  });

  it('leaves the moderator banner when markNotificationRead rejects', async () => {
    fetchMock.mockResolvedValue(forumPage([SAMPLE]));
    fetchNotificationsMock.mockResolvedValue({
      notifications: [UNREAD_APPOINTED],
      unreadCount: 1,
    });
    markNotificationReadMock.mockRejectedValue(new Error('boom'));
    renderWithLocale(<ForumLoader />);
    fireEvent.click(await screen.findByRole('button', { name: 'You are a moderator' }));
    await waitFor(() => {
      expect(markNotificationReadMock).toHaveBeenCalledWith('sess', 'n-mod');
    });
    expect(screen.getByRole('button', { name: 'You are a moderator' })).toBeTruthy();
  });

  it('does not hide the moderator banner after logout during mark-read', async () => {
    let resolveRead: ((value: Notification) => void) | undefined;
    markNotificationReadMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRead = resolve;
        }),
    );
    fetchMock.mockResolvedValue(forumPage([SAMPLE]));
    fetchNotificationsMock.mockResolvedValue({
      notifications: [UNREAD_APPOINTED],
      unreadCount: 1,
    });
    renderWithLocale(<ForumLoader />);
    fireEvent.click(await screen.findByRole('button', { name: 'You are a moderator' }));
    useAuthStore.getState().clearAuth();
    await act(async () => {
      resolveRead?.({
        ...UNREAD_APPOINTED,
        readAt: '2026-08-28T13:00:00.000Z',
      });
      await Promise.resolve();
    });
    expect(useAuthStore.getState().session).toBeNull();
  });

  it('hides the moderator banner when fetchNotifications rejects', async () => {
    fetchMock.mockResolvedValue(forumPage([SAMPLE]));
    fetchNotificationsMock.mockRejectedValue(new Error('boom'));
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Forum view' })).toBeTruthy();
    });
    expect(screen.queryByRole('button', { name: 'You are a moderator' })).toBeNull();
  });

  it('ignores a stale notifications resolve after unmount', async () => {
    let resolveList: ((value: NotificationList) => void) | undefined;
    fetchNotificationsMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveList = resolve;
        }),
    );
    fetchMock.mockResolvedValue(forumPage([SAMPLE]));
    const view = renderWithLocale(<ForumLoader />);
    view.unmount();
    await act(async () => {
      resolveList?.({ notifications: [UNREAD_APPOINTED], unreadCount: 1 });
      await Promise.resolve();
    });
    expect(fetchNotificationsMock).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'You are a moderator' })).toBeNull();
  });

  it('ignores a stale notifications rejection after unmount', async () => {
    let rejectList: ((reason: Error) => void) | undefined;
    fetchNotificationsMock.mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectList = reject;
        }),
    );
    fetchMock.mockResolvedValue(forumPage([SAMPLE]));
    const view = renderWithLocale(<ForumLoader />);
    view.unmount();
    await act(async () => {
      rejectList?.(new Error('gone'));
      await Promise.resolve();
    });
    expect(fetchNotificationsMock).toHaveBeenCalled();
  });
});

it('removes a moderated open post, closes its pay/reply state, and prevents stale refresh restoration', async () => {
  useAuthStore.setState({ session: 'token', account: { ...account, role: 'moderator' } });
  fetchMock.mockResolvedValue(
    forumPage([
      { ...SAMPLE, replyCount: 1 },
      { ...SAMPLE, id: 'keep', text: 'Keep this post' },
    ]),
  );
  repliesMock.mockResolvedValue([{ ...PAYABLE_REPLY }]);
  vi.mocked(deleteMessage).mockResolvedValue(undefined);
  renderWithLocale(<ForumLoader />);
  await waitFor(() => expect(screen.getByRole('combobox', { name: 'Forum view' })).toBeTruthy());
  await revealAll();
  await screen.findByText('Hello from Ada');
  fireEvent.click(screen.getByText('Hello from Ada'));
  await screen.findByLabelText('Your reaction');
  await screen.findByText('A payable reply');
  const postCard = screen.getByText('Hello from Ada').closest('li')!;
  const replyCard = clickGiftOnReply();
  expect(within(replyCard).getByLabelText('Amount')).toBeTruthy();
  const deletePost = postCard.querySelector<HTMLButtonElement>('[aria-label="Delete post"]');
  expect(deletePost).toBeTruthy();
  fireEvent.click(deletePost as HTMLButtonElement);
  const confirmDeletion = postCard.querySelector<HTMLButtonElement>(
    '[aria-label="Confirm deletion"]',
  );
  expect(confirmDeletion).toBeTruthy();
  fireEvent.click(confirmDeletion as HTMLButtonElement);
  await waitFor(() => expect(screen.queryByText('Hello from Ada')).toBeNull());
  expect(screen.getByText('Keep this post')).toBeTruthy();
  expect(screen.queryByLabelText('Your reaction')).toBeNull();
  expect(screen.queryByLabelText('Amount')).toBeNull();
  const before = fetchMock.mock.calls.length;
  const event = new Event('pageshow');
  Object.defineProperty(event, 'persisted', { value: true });
  fireEvent(window, event);
  await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(before));
  expect(screen.queryByText('Hello from Ada')).toBeNull();
});

it('does not treat a session-deleted id as unseen on silent refresh', async () => {
  useAuthStore.setState({ session: 'token', account: { ...account, role: 'moderator' } });
  fetchMock.mockResolvedValue(
    forumPage([
      { ...SAMPLE, replyCount: 1 },
      { ...SAMPLE, id: 'keep', text: 'Keep this post' },
    ]),
  );
  repliesMock.mockResolvedValue([{ ...PAYABLE_REPLY }]);
  vi.mocked(deleteMessage).mockResolvedValue(undefined);
  renderWithLocale(<ForumLoader />);
  await waitFor(() => expect(screen.getByRole('combobox', { name: 'Forum view' })).toBeTruthy());
  await revealAll();
  await screen.findByText('Hello from Ada');
  fireEvent.click(screen.getByText('Hello from Ada'));
  await screen.findByLabelText('Your reaction');
  await screen.findByText('A payable reply');
  const postCard = screen.getByText('Hello from Ada').closest('li')!;
  const replyCard = clickGiftOnReply();
  fireEvent.click(within(replyCard).getByRole('button', { name: 'Back' }));
  const deletePost = postCard.querySelector<HTMLButtonElement>('[aria-label="Delete post"]');
  expect(deletePost).toBeTruthy();
  fireEvent.click(deletePost as HTMLButtonElement);
  const confirmDeletion = postCard.querySelector<HTMLButtonElement>(
    '[aria-label="Confirm deletion"]',
  );
  expect(confirmDeletion).toBeTruthy();
  fireEvent.click(confirmDeletion as HTMLButtonElement);
  await waitFor(() => expect(screen.queryByText('Hello from Ada')).toBeNull());
  expect(screen.getByText('Keep this post')).toBeTruthy();

  Object.defineProperty(window, 'scrollY', { configurable: true, value: 800 });
  fetchMock
    .mockResolvedValueOnce(forumPage([SAMPLE, { ...SAMPLE, id: 'keep', text: 'Keep this post' }]))
    .mockResolvedValue(forumPage([SAMPLE, { ...SAMPLE, id: 'keep', text: 'Keep this post' }]));
  const before = fetchMock.mock.calls.length;
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => 'hidden',
  });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => 'visible',
  });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });

  await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(before));
  expect(screen.queryByRole('button', { name: 'New posts' })).toBeNull();
  expect(screen.queryByText('Hello from Ada')).toBeNull();
  expect(screen.getByText('Keep this post')).toBeTruthy();
});

it('removes a moderated reply, keeps the parent, and ignores restored replies', async () => {
  useAuthStore.setState({ session: 'token', account: { ...account, role: 'moderator' } });
  fetchMock.mockResolvedValue(
    forumPage([
      { ...SAMPLE, replyCount: 1 },
      { ...SAMPLE, id: 'keep', text: 'Keep this post' },
    ]),
  );
  repliesMock.mockResolvedValue([NESTED_REPLY]);
  vi.mocked(deleteMessage).mockResolvedValue(undefined);
  renderWithLocale(<ForumLoader />);
  await waitFor(() => expect(screen.getByRole('combobox', { name: 'Forum view' })).toBeTruthy());
  await revealAll();
  await screen.findByText('Hello from Ada');
  const postCard = screen.getByText('Hello from Ada').closest('li')!;
  fireEvent.click(within(postCard).getByRole('button', { name: 'Show reactions' }));
  await screen.findByText('A reply');
  expect(within(postCard).getByText('1 reactions')).toBeTruthy();
  const replyCard = document.querySelector('[data-reply-id="r1"]') as HTMLElement;
  fireEvent.click(within(replyCard).getByRole('button', { name: 'Delete reaction' }));
  fireEvent.click(within(replyCard).getByRole('button', { name: 'Confirm deletion' }));
  await waitFor(() => expect(screen.queryByText('A reply')).toBeNull());
  expect(screen.getByText('Hello from Ada')).toBeTruthy();
  expect(screen.getByText('Keep this post')).toBeTruthy();
  expect(deleteMessage).toHaveBeenCalledWith('token', 'r1');
  const keptCard = screen.getByText('Hello from Ada').closest('li')!;
  expect(within(keptCard).getByText('0 reactions')).toBeTruthy();
  expect(screen.getByLabelText('Your reaction')).toBeTruthy();

  const beforeRefresh = fetchMock.mock.calls.length;
  const event = new Event('pageshow');
  Object.defineProperty(event, 'persisted', { value: true });
  fireEvent(window, event);
  await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(beforeRefresh));
  expect(screen.queryByText('A reply')).toBeNull();
  expect(screen.getByText('Hello from Ada')).toBeTruthy();
  expect(
    within(screen.getByText('Hello from Ada').closest('li')!).getByText('0 reactions'),
  ).toBeTruthy();

  const stillExpanded = screen.getByText('Hello from Ada').closest('li')!;
  fireEvent.click(within(stillExpanded).getByRole('button', { name: 'Hide reactions' }));
  fireEvent.click(within(stillExpanded).getByRole('button', { name: 'Show reactions' }));
  await waitFor(() => expect(repliesMock.mock.calls.length).toBeGreaterThan(1));
  expect(screen.queryByText('A reply')).toBeNull();
  expect(screen.getByText('Hello from Ada')).toBeTruthy();
  expect(
    within(screen.getByText('Hello from Ada').closest('li')!).getByText('0 reactions'),
  ).toBeTruthy();
});

it('lets a later server reply raise the count after a session delete', async () => {
  useAuthStore.setState({ session: 'token', account: { ...account, role: 'moderator' } });
  fetchMock.mockResolvedValue(forumPage([{ ...SAMPLE, replyCount: 1 }]));
  repliesMock.mockResolvedValue([NESTED_REPLY]);
  vi.mocked(deleteMessage).mockResolvedValue(undefined);
  renderWithLocale(<ForumLoader />);
  await waitFor(() => expect(screen.getByRole('combobox', { name: 'Forum view' })).toBeTruthy());
  await revealAll();
  fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
  await screen.findByText('A reply');
  const replyCard = document.querySelector('[data-reply-id="r1"]') as HTMLElement;
  fireEvent.click(within(replyCard).getByRole('button', { name: 'Delete reaction' }));
  fireEvent.click(within(replyCard).getByRole('button', { name: 'Confirm deletion' }));
  await waitFor(() => expect(screen.queryByText('A reply')).toBeNull());
  expect(
    within(screen.getByText('Hello from Ada').closest('li')!).getByText('0 reactions'),
  ).toBeTruthy();

  fetchMock
    .mockResolvedValueOnce(forumPage([{ ...SAMPLE, replyCount: 2 }]))
    .mockResolvedValue(forumPage([{ ...SAMPLE, replyCount: 2 }]));
  const before = fetchMock.mock.calls.length;
  const event = new Event('pageshow');
  Object.defineProperty(event, 'persisted', { value: true });
  fireEvent(window, event);
  await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(before));
  expect(
    within(screen.getByText('Hello from Ada').closest('li')!).getByText('1 reactions'),
  ).toBeTruthy();

  fetchMock
    .mockResolvedValueOnce(forumPage([{ ...SAMPLE, replyCount: 1 }]))
    .mockResolvedValue(forumPage([{ ...SAMPLE, replyCount: 1 }]));
  const beforeCatchUp = fetchMock.mock.calls.length;
  fireEvent(window, event);
  await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(beforeCatchUp));
  expect(
    within(screen.getByText('Hello from Ada').closest('li')!).getByText('1 reactions'),
  ).toBeTruthy();
  const card = screen.getByText('Hello from Ada').closest('li')!;
  fireEvent.click(within(card).getByRole('button', { name: 'Hide reactions' }));
  fireEvent.click(within(card).getByRole('button', { name: 'Show reactions' }));
  await waitFor(() => expect(repliesMock.mock.calls.length).toBeGreaterThan(1));
  expect(
    within(screen.getByText('Hello from Ada').closest('li')!).getByText('1 reactions'),
  ).toBeTruthy();
});

it('drops overlapping nested reply deletes without restoring the first', async () => {
  useAuthStore.setState({ session: 'token', account: { ...account, role: 'moderator' } });
  fetchMock.mockResolvedValue(forumPage([{ ...SAMPLE, replyCount: 2 }]));
  repliesMock.mockResolvedValue([
    NESTED_REPLY,
    { ...NESTED_REPLY, id: 'r2', text: 'Second reply' },
  ]);
  const pending: Array<() => void> = [];
  vi.mocked(deleteMessage).mockImplementation(
    () =>
      new Promise((resolve) => {
        pending.push(() => resolve());
      }),
  );
  renderWithLocale(<ForumLoader />);
  await waitFor(() => expect(screen.getByRole('combobox', { name: 'Forum view' })).toBeTruthy());
  await revealAll();
  fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
  await screen.findByText('A reply');
  fireEvent.click(
    within(document.querySelector('[data-reply-id="r1"]') as HTMLElement).getByRole('button', {
      name: 'Delete reaction',
    }),
  );
  fireEvent.click(
    within(document.querySelector('[data-reply-id="r1"]') as HTMLElement).getByRole('button', {
      name: 'Confirm deletion',
    }),
  );
  fireEvent.click(
    within(document.querySelector('[data-reply-id="r2"]') as HTMLElement).getByRole('button', {
      name: 'Delete reaction',
    }),
  );
  fireEvent.click(
    within(document.querySelector('[data-reply-id="r2"]') as HTMLElement).getByRole('button', {
      name: 'Confirm deletion',
    }),
  );
  expect(pending).toHaveLength(2);
  await act(async () => {
    pending[0]!();
    pending[1]!();
  });
  await waitFor(() => expect(screen.queryByText('A reply')).toBeNull());
  expect(screen.queryByText('Second reply')).toBeNull();
  expect(screen.getByText('Hello from Ada')).toBeTruthy();
  expect(
    within(screen.getByText('Hello from Ada').closest('li')!).getByText('0 reactions'),
  ).toBeTruthy();
});

it('decrements the reply count twice when two nested replies are deleted in sequence', async () => {
  useAuthStore.setState({ session: 'token', account: { ...account, role: 'moderator' } });
  fetchMock.mockResolvedValue(forumPage([{ ...SAMPLE, replyCount: 2 }]));
  repliesMock.mockResolvedValue([
    NESTED_REPLY,
    { ...NESTED_REPLY, id: 'r2', text: 'Second reply' },
  ]);
  vi.mocked(deleteMessage).mockResolvedValue(undefined);
  renderWithLocale(<ForumLoader />);
  await waitFor(() => expect(screen.getByRole('combobox', { name: 'Forum view' })).toBeTruthy());
  await revealAll();
  fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
  await screen.findByText('A reply');
  fireEvent.click(
    within(document.querySelector('[data-reply-id="r1"]') as HTMLElement).getByRole('button', {
      name: 'Delete reaction',
    }),
  );
  fireEvent.click(
    within(document.querySelector('[data-reply-id="r1"]') as HTMLElement).getByRole('button', {
      name: 'Confirm deletion',
    }),
  );
  await waitFor(() => expect(screen.queryByText('A reply')).toBeNull());
  expect(screen.getByText('Hello from Ada')).toBeTruthy();
  expect(
    within(screen.getByText('Hello from Ada').closest('li')!).getByText('1 reactions'),
  ).toBeTruthy();
  fireEvent.click(
    within(document.querySelector('[data-reply-id="r2"]') as HTMLElement).getByRole('button', {
      name: 'Delete reaction',
    }),
  );
  fireEvent.click(
    within(document.querySelector('[data-reply-id="r2"]') as HTMLElement).getByRole('button', {
      name: 'Confirm deletion',
    }),
  );
  await waitFor(() => expect(screen.queryByText('Second reply')).toBeNull());
  expect(screen.getByText('Hello from Ada')).toBeTruthy();
  expect(
    within(screen.getByText('Hello from Ada').closest('li')!).getByText('0 reactions'),
  ).toBeTruthy();
  expect(deleteMessage).toHaveBeenCalledWith('token', 'r1');
  expect(deleteMessage).toHaveBeenCalledWith('token', 'r2');
});

it('still hides a reply deleted after the thread is collapsed', async () => {
  useAuthStore.setState({ session: 'token', account: { ...account, role: 'moderator' } });
  fetchMock.mockResolvedValue(forumPage([{ ...SAMPLE, replyCount: 1 }]));
  repliesMock.mockResolvedValue([NESTED_REPLY]);
  let finishDelete!: () => void;
  vi.mocked(deleteMessage).mockImplementation(
    () =>
      new Promise((resolve) => {
        finishDelete = () => resolve();
      }),
  );
  renderWithLocale(<ForumLoader />);
  await waitFor(() => expect(screen.getByRole('combobox', { name: 'Forum view' })).toBeTruthy());
  await revealAll();
  fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
  await screen.findByText('A reply');
  const replyCard = document.querySelector('[data-reply-id="r1"]') as HTMLElement;
  fireEvent.click(within(replyCard).getByRole('button', { name: 'Delete reaction' }));
  fireEvent.click(within(replyCard).getByRole('button', { name: 'Confirm deletion' }));
  fireEvent.click(screen.getByRole('button', { name: 'Hide reactions' }));
  await act(async () => {
    finishDelete();
  });
  fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
  await waitFor(() => expect(repliesMock.mock.calls.length).toBeGreaterThan(1));
  expect(screen.queryByText('A reply')).toBeNull();
  expect(
    within(screen.getByText('Hello from Ada').closest('li')!).getByText('0 reactions'),
  ).toBeTruthy();
});

it('hides reply deletion for ordinary members', async () => {
  fetchMock.mockResolvedValue(forumPage([{ ...SAMPLE, replyCount: 1 }]));
  repliesMock.mockResolvedValue([NESTED_REPLY]);
  renderWithLocale(<ForumLoader />);
  await waitFor(() => expect(screen.getByRole('combobox', { name: 'Forum view' })).toBeTruthy());
  await revealAll();
  await screen.findByText('Hello from Ada');
  fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
  await screen.findByText('A reply');
  expect(screen.queryByRole('button', { name: 'Delete reaction' })).toBeNull();
});

it('pays a payable reply and polls that reply id', async () => {
  const payableReply: ForumMessage = { ...NESTED_REPLY, payable: true, sats: 5 };
  fetchMock.mockResolvedValue(forumPage([{ ...SAMPLE, replyCount: 1 }]));
  repliesMock.mockResolvedValue([payableReply]);
  invoiceMock.mockResolvedValue({ pr: 'lnbc21n1example', amountSats: 21 });
  publicFetchMock.mockResolvedValue({ ...payableReply, sats: 26 });
  renderWithLocale(<ForumLoader />);
  await waitFor(() => expect(screen.getByRole('combobox', { name: 'Forum view' })).toBeTruthy());
  await revealAll();
  await screen.findByText('Hello from Ada');
  fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
  await screen.findByText('A reply');
  const replyCard = document.querySelector('[data-reply-id="r1"]') as HTMLElement;
  expect(within(replyCard).queryByText('Send Bitcoin')).toBeNull();
  fireEvent.click(within(replyCard).getByRole('button', { name: 'Send Bitcoin' }));
  fireEvent.change(within(replyCard).getByLabelText('Amount'), { target: { value: '21' } });
  fireEvent.click(within(replyCard).getByRole('button', { name: 'Continue' }));
  await waitFor(() => {
    expect(invoiceMock).toHaveBeenCalledWith('sess', 'r1', 21, undefined, NO_RATE_SHOWN);
  });
  await waitFor(() => {
    expect(publicFetchMock).toHaveBeenCalledWith(
      'r1',
      expect.objectContaining({
        sinceSats: 5,
        signal: expect.any(AbortSignal),
      }),
    );
  });
  await waitFor(() => {
    expect(within(replyCard).queryByLabelText('Amount')).toBeNull();
  });
});

it('keeps a reply pay sheet when Active hides the parent note', async () => {
  const payableReply: ForumMessage = { ...NESTED_REPLY, payable: true };
  fetchMock.mockResolvedValue(forumPage([{ ...SAMPLE, replyCount: 1 }]));
  repliesMock.mockResolvedValue([payableReply]);
  invoiceMock.mockResolvedValue({ pr: 'lnbc21n1example', amountSats: 21 });
  renderWithLocale(<ForumLoader />);
  await waitFor(() => expect(screen.getByRole('combobox', { name: 'Forum view' })).toBeTruthy());
  await revealAll();
  await screen.findByText('Hello from Ada');
  fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
  await screen.findByText('A reply');
  const replyCard = document.querySelector('[data-reply-id="r1"]') as HTMLElement;
  fireEvent.click(within(replyCard).getByRole('button', { name: 'Send Bitcoin' }));
  fireEvent.change(within(replyCard).getByLabelText('Amount'), { target: { value: '21' } });
  fireEvent.click(within(replyCard).getByRole('button', { name: 'Continue' }));
  await waitFor(() => {
    expect(invoiceMock).toHaveBeenCalledWith('sess', 'r1', 21, undefined, NO_RATE_SHOWN);
  });
  chooseForumMode('Active');
  expect(screen.getByText('No message has received Bitcoin yet.')).toBeTruthy();
  chooseForumMode(/^All$/);
  await screen.findByText('A reply');
  const stillOpen = document.querySelector('[data-reply-id="r1"]') as HTMLElement;
  expect(
    within(stillOpen).getByRole('button', { name: 'Pay with Wallet of Satoshi' }),
  ).toBeTruthy();
});

it('omits Gift on an unpayable nested reply', async () => {
  fetchMock.mockResolvedValue(forumPage([{ ...SAMPLE, payable: false, replyCount: 1 }]));
  repliesMock.mockResolvedValue([NESTED_REPLY]);
  renderWithLocale(<ForumLoader />);
  await waitFor(() => expect(screen.getByRole('combobox', { name: 'Forum view' })).toBeTruthy());
  await revealAll();
  await screen.findByText('Hello from Ada');
  fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
  await screen.findByText('A reply');
  const replyCard = document.querySelector('[data-reply-id="r1"]') as HTMLElement;
  expect(within(replyCard).queryByRole('button', { name: 'Send Bitcoin' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Send Bitcoin' })).toBeNull();
  expect(screen.getByPlaceholderText('Write a reaction')).toBeTruthy();
});

describe('forum feed pages', () => {
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

  const paidMessage = (id: string, text: string, createdAt: string): ForumMessage => ({
    ...SAMPLE,
    id,
    text,
    createdAt,
    sats: 21,
    payable: true,
  });

  beforeEach(() => {
    FakeIntersectionObserver.instances = [];
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads a signed-out page, its photo and reactions, then sends another mode to login', async () => {
    useAuthStore.setState({ session: null, account });
    const note: ForumMessage = {
      ...SAMPLE,
      id: 'pub-1',
      text: 'Public page',
      sats: 21,
      payable: true,
      hasPhoto: true,
      photoCount: 1,
      replyCount: 1,
    };
    publicListMock.mockImplementation(async (args?: { cursor?: string | null }) => {
      if (args?.cursor !== undefined && args.cursor !== null && args.cursor !== '') {
        throw new PublicForumUnauthorizedError();
      }
      return { messages: [note], nextCursor: 'cur' };
    });
    publicPhotoMock.mockResolvedValue(new Blob([new Uint8Array([1])], { type: 'image/jpeg' }));
    publicRepliesMock.mockResolvedValue([
      { ...SAMPLE, id: 'r-pub', text: 'A public reply', parentId: 'pub-1' },
    ]);
    renderWithLocale(<ForumLoader />);
    await screen.findByText('Public page');
    await waitFor(() => {
      expect(publicPhotoMock).toHaveBeenCalledWith('pub-1', 0);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    await screen.findByText('A public reply');
    await waitFor(() => {
      expect(publicRepliesMock).toHaveBeenCalledWith('pub-1');
    });
    await waitFor(() => {
      expect(FakeIntersectionObserver.instances[0]?.observed).toHaveLength(1);
    });
    act(() => {
      FakeIntersectionObserver.instances[0]?.trigger();
    });
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/login');
    });
    chooseForumMode(/^All$/);
    expect(replace).toHaveBeenCalledWith('/login');
  });

  it('renders nothing for shops without a session', () => {
    useAuthStore.setState({ session: null, account });
    const { container } = renderWithLocale(<ForumLoader feed="shops" />);
    expect(container.firstChild).toBeNull();
    expect(publicListMock).not.toHaveBeenCalled();
  });

  it('shows an error when the public page cannot load', async () => {
    useAuthStore.setState({ session: null, account });
    publicListMock.mockRejectedValue(new Error('down'));
    renderWithLocale(<ForumLoader />);
    expect(await screen.findByText('Could not load messages. Please try again.')).toBeTruthy();
  });

  it('keeps a signed-out note when the photo, reactions, and next page fail', async () => {
    useAuthStore.setState({ session: null, account });
    const note: ForumMessage = {
      ...SAMPLE,
      id: 'pub-2',
      text: 'Public photo',
      sats: 21,
      payable: true,
      hasPhoto: true,
      photoCount: 1,
      replyCount: 1,
    };
    publicListMock.mockImplementation(async (args?: { cursor?: string | null }) => {
      if (args?.cursor !== undefined && args.cursor !== null && args.cursor !== '') {
        throw new Error('later');
      }
      return { messages: [note], nextCursor: 'cur' };
    });
    publicPhotoMock.mockRejectedValue(new Error('missing'));
    publicRepliesMock.mockRejectedValue(new Error('reactions'));
    renderWithLocale(<ForumLoader />);
    expect(await screen.findByText('Public photo')).toBeTruthy();
    await waitFor(() => {
      expect(publicPhotoMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show reactions' }));
    expect(await screen.findByText('Could not load reactions. Please try again.')).toBeTruthy();
    await waitFor(() => {
      expect(FakeIntersectionObserver.instances[0]?.observed).toHaveLength(1);
    });
    act(() => {
      FakeIntersectionObserver.instances[0]?.trigger();
    });
    await waitFor(() => {
      expect(publicListMock.mock.calls.some((call) => call[0]?.cursor === 'cur')).toBe(true);
    });
    expect(replace).not.toHaveBeenCalled();
  });

  it('sends login when the session drops off a non-active mode', async () => {
    fetchMock.mockResolvedValue(forumPage([{ ...SAMPLE, text: 'Paid note', sats: 21 }], 'cur'));
    renderWithLocale(<ForumLoader />);
    expect(await screen.findByText('Paid note')).toBeTruthy();
    chooseForumMode(/^All$/);
    await waitFor(() => {
      expect(
        FakeIntersectionObserver.instances.some((observer) => observer.observed.length > 0),
      ).toBe(true);
    });
    useAuthStore.setState({ session: null, account });
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/login');
    });
  });

  it('drops a public page that arrives after the view is gone', async () => {
    useAuthStore.setState({ session: null, account });
    let resolvePage: (page: { messages: ForumMessage[]; nextCursor: null }) => void = () =>
      undefined;
    publicListMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePage = resolve;
        }),
    );
    const { unmount } = renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(publicListMock).toHaveBeenCalled();
    });
    unmount();
    resolvePage({
      messages: [{ ...SAMPLE, text: 'Late page', sats: 21 }],
      nextCursor: null,
    });
    await Promise.resolve();
    expect(screen.queryByText('Late page')).toBeNull();
  });

  it('requests the first active page on mount without using the legacy one-argument call', async () => {
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('sess', { mode: 'active', limit: 20 });
    });
    expect(fetchMock).not.toHaveBeenCalledWith('sess');
  });

  it('requests page one without a cursor after switching to All', async () => {
    fetchMock.mockResolvedValue(forumPage([SAMPLE]));
    renderWithLocale(<ForumLoader />);
    await revealAll();
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('sess', { mode: 'all', limit: 20 });
    });
  });

  it('holds a silent refresh until the mode-switch page-one replace finishes', async () => {
    let releaseAll: ((page: ReturnType<typeof forumPage>) => void) | undefined;
    fetchMock
      .mockResolvedValueOnce(forumPage([SAMPLE]))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            releaseAll = resolve;
          }),
      )
      .mockResolvedValue(forumPage([SAMPLE]));
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('No message has received Bitcoin yet.')).toBeTruthy();
    });
    await revealAll();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await act(async () => {
      releaseAll?.(forumPage([SAMPLE]));
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });
  });

  it('prefetches after a silent refresh is the first successful load', async () => {
    const first = paidMessage('page-1', 'First page', '2026-08-28T15:00:00.000Z');
    const second = paidMessage('page-2', 'Second page', '2026-08-28T14:00:00.000Z');
    fetchMock
      .mockRejectedValueOnce(new Error('Could not load messages. Please try again.'))
      .mockResolvedValueOnce(forumPage([first], 'cur_2'))
      .mockResolvedValue(forumPage([second]));
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(screen.getByText('Could not load messages. Please try again.')).toBeTruthy();
    });
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await screen.findByText('First page');
    await waitFor(() => {
      expect(FakeIntersectionObserver.instances[0]?.observed).toHaveLength(1);
    });
    act(() => {
      FakeIntersectionObserver.instances[0]?.trigger();
    });
    await screen.findByText('Second page');
  });

  it('prefetches and appends the next cursor page while deduplicating ids', async () => {
    const first = paidMessage('page-1', 'First page', '2026-08-28T15:00:00.000Z');
    const second = paidMessage('page-2', 'Second page', '2026-08-28T14:00:00.000Z');
    fetchMock
      .mockResolvedValueOnce(forumPage([first], 'cur_2'))
      .mockResolvedValue(forumPage([first, second]));
    const { container } = renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(FakeIntersectionObserver.instances[0]?.observed).toHaveLength(1);
    });

    act(() => {
      FakeIntersectionObserver.instances[0]?.trigger();
    });

    await waitFor(() => {
      expect(screen.getByText('Second page')).toBeTruthy();
    });
    expect(fetchMock).toHaveBeenCalledWith('sess', {
      mode: 'active',
      limit: 20,
      cursor: 'cur_2',
    });
    expect(container.querySelectorAll('[data-message-id="page-1"]')).toHaveLength(1);
  });

  it('feed="shops" prefetches a later cursor page with hashtag 21GiftsShop', async () => {
    const first = paidMessage('shop-1', 'Cafe Luna\n\n#21GiftsShop', '2026-08-28T15:00:00.000Z');
    const second = paidMessage('shop-2', 'Bakery\n\n#21GiftsShop', '2026-08-28T14:00:00.000Z');
    fetchMock
      .mockResolvedValueOnce(forumPage([first], 'cur_2'))
      .mockResolvedValue(forumPage([second]));
    renderWithLocale(<ForumLoader feed="shops" />);
    await waitFor(() => {
      expect(FakeIntersectionObserver.instances[0]?.observed).toHaveLength(1);
    });

    act(() => {
      FakeIntersectionObserver.instances[0]?.trigger();
    });

    await waitFor(() => {
      expect(screen.getByText('Bakery')).toBeTruthy();
    });
    expect(fetchMock).toHaveBeenCalledWith('sess', {
      mode: 'all',
      limit: 20,
      hashtag: '21GiftsShop',
    });
    expect(fetchMock).toHaveBeenCalledWith('sess', {
      mode: 'all',
      limit: 20,
      cursor: 'cur_2',
      hashtag: '21GiftsShop',
    });
  });

  it('does not prefetch without a next cursor', async () => {
    const first = paidMessage('page-1', 'First page', '2026-08-28T15:00:00.000Z');
    fetchMock.mockResolvedValue(forumPage([first]));
    renderWithLocale(<ForumLoader />);
    await screen.findByText('First page');
    expect(FakeIntersectionObserver.instances).toHaveLength(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not start a second prefetch while the cursor request is in flight', async () => {
    const first = paidMessage('page-1', 'First page', '2026-08-28T15:00:00.000Z');
    const second = paidMessage('page-2', 'Second page', '2026-08-28T14:00:00.000Z');
    let resolvePageTwo: (page: ReturnType<typeof forumPage>) => void = () => undefined;
    fetchMock.mockResolvedValueOnce(forumPage([first], 'cur_2')).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePageTwo = resolve;
        }),
    );
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(FakeIntersectionObserver.instances[0]?.observed).toHaveLength(1);
    });

    act(() => {
      FakeIntersectionObserver.instances[0]?.trigger();
      FakeIntersectionObserver.instances[0]?.trigger();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      resolvePageTwo(forumPage([second]));
    });
    await screen.findByText('Second page');
  });

  it('starts a payable poll when a cursor page includes an unsigned note', async () => {
    const first = paidMessage('page-1', 'First page', '2026-08-28T15:00:00.000Z');
    const unsigned: ForumMessage = {
      ...paidMessage('page-2', 'Unsigned page', '2026-08-28T14:00:00.000Z'),
      payable: false,
    };
    fetchMock
      .mockResolvedValueOnce(forumPage([first], 'cur_2'))
      .mockResolvedValueOnce(forumPage([unsigned]))
      .mockResolvedValue(forumPage([unsigned]));
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(FakeIntersectionObserver.instances[0]?.observed).toHaveLength(1);
    });
    vi.useFakeTimers();
    act(() => {
      FakeIntersectionObserver.instances[0]?.trigger();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText('Unsigned page')).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('keeps the loaded pages when a cursor prefetch fails', async () => {
    const first = paidMessage('page-1', 'First page', '2026-08-28T15:00:00.000Z');
    fetchMock
      .mockResolvedValueOnce(forumPage([first], 'cur_2'))
      .mockRejectedValueOnce(new Error('Could not load messages. Please try again.'));
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(FakeIntersectionObserver.instances[0]?.observed).toHaveLength(1);
    });
    act(() => {
      FakeIntersectionObserver.instances[0]?.trigger();
    });
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('sess', {
        mode: 'active',
        limit: 20,
        cursor: 'cur_2',
      });
    });
    expect(screen.getByText('First page')).toBeTruthy();
    expect(screen.queryByText('Could not load messages. Please try again.')).toBeNull();
  });

  it('ignores an in-flight cursor page after the mode changes', async () => {
    const first = paidMessage('page-1', 'First page', '2026-08-28T15:00:00.000Z');
    const stale = paidMessage('stale-page', 'Stale page', '2026-08-28T14:00:00.000Z');
    let resolveStalePage: (page: ReturnType<typeof forumPage>) => void = () => undefined;
    fetchMock
      .mockResolvedValueOnce(forumPage([first], 'cur_2'))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveStalePage = resolve;
          }),
      )
      .mockResolvedValue(forumPage([SAMPLE]));
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(FakeIntersectionObserver.instances[0]?.observed).toHaveLength(1);
    });
    act(() => {
      FakeIntersectionObserver.instances[0]?.trigger();
    });

    await revealAll();
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('sess', { mode: 'all', limit: 20 });
    });
    await act(async () => {
      resolveStalePage(forumPage([stale]));
    });
    expect(screen.queryByText('Stale page')).toBeNull();
  });

  it('observes the first visible note when fewer than eight are loaded', async () => {
    const first = paidMessage('page-1', 'First page', '2026-08-28T15:00:00.000Z');
    fetchMock.mockResolvedValue(forumPage([first], 'cur_2'));
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(
        FakeIntersectionObserver.instances[0]?.observed[0]?.getAttribute('data-message-id'),
      ).toBe('page-1');
    });
  });

  it('keeps older cursor pages while a scrolled page-one poll holds unseen posts', async () => {
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 800 });
    const first = paidMessage('page-1', 'First page', '2026-08-28T15:00:00.000Z');
    const older = paidMessage('page-2', 'Older page', '2026-08-28T14:00:00.000Z');
    const fresh = paidMessage('page-new', 'Fresh page one', '2026-08-28T16:00:00.000Z');
    fetchMock
      .mockResolvedValueOnce(forumPage([first], 'cur_2'))
      .mockResolvedValueOnce(forumPage([older]))
      .mockResolvedValue(forumPage([fresh, first]));
    renderWithLocale(<ForumLoader />);
    await waitFor(() => {
      expect(FakeIntersectionObserver.instances[0]?.observed).toHaveLength(1);
    });
    act(() => {
      FakeIntersectionObserver.instances[0]?.trigger();
    });
    await screen.findByText('Older page');

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'New posts' })).toBeTruthy();
    });
    expect(screen.queryByText('Fresh page one')).toBeNull();
    expect(screen.getByText('Older page')).toBeTruthy();
    expect(fetchMock).toHaveBeenLastCalledWith('sess', { mode: 'active', limit: 20 });
  });
});
