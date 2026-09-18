import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocaleProvider } from '@/components/LocaleProvider';
import { ThemeProvider } from '@/components/ThemeProvider';
import { InboxScreen } from '@/components/InboxScreen';
import type { Conversation, ConversationMessage } from '@/lib/api-types';
import { getCatalog } from '@/lib/messages';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const push = vi.fn();
const originalUserAgent = navigator.userAgent;
const locationStub = { href: 'http://localhost/' };

vi.mock('next/navigation', () => ({
  useRouter: (): { push: typeof push; replace: typeof push } => ({ push, replace: push }),
}));

beforeEach(() => {
  push.mockClear();
  locationStub.href = 'http://localhost/';
  vi.stubGlobal('location', locationStub);
});

afterEach(() => {
  cleanup();
  Object.defineProperty(navigator, 'userAgent', {
    configurable: true,
    value: originalUserAgent,
  });
});

const THREAD: Conversation = {
  id: 'conv-1',
  kind: 'member_platform',
  name: '21.gifts',
  lastText: 'Hello team',
  lastAt: '2026-08-28T12:00:00.000Z',
  lastFromMe: false,
  lastSats: 0,
  unread: false,
};

const DIRECT: Conversation = {
  id: 'conv-2',
  kind: 'member_member',
  name: 'Bob',
  lastText: 'Later',
  lastAt: '2026-08-28T13:00:00.000Z',
  lastFromMe: false,
  lastSats: 0,
  unread: false,
};

const DAMUS: Conversation = {
  id: 'conv-3',
  kind: 'member_damus',
  name: 'npub1abc…xyz',
  lastText: 'Hi',
  lastAt: '2026-08-28T14:00:00.000Z',
  lastFromMe: false,
  lastSats: 0,
  unread: false,
};

const MODERATORS: Conversation = {
  id: 'conv-mods',
  kind: 'moderator_group',
  name: 'Staff room',
  lastText: 'Hello mods',
  lastAt: '2026-08-28T15:00:00.000Z',
  lastFromMe: false,
  lastSats: 0,
  unread: false,
};

const THREE: Conversation[] = [THREAD, DIRECT, DAMUS];

const MESSAGE: ConversationMessage = {
  id: 'm1',
  name: 'Ada',
  text: 'Hello team',
  createdAt: '2026-08-28T12:00:00.000Z',
  fromMe: false,
  sats: 0,
};

describe('InboxScreen', () => {
  it('shows loading copy', () => {
    renderWithLocale(
      <InboxScreen
        conversations={null}
        error={false}
        loading={true}
        onRetry={() => undefined}
        openId={null}
        onOpen={() => undefined}
        messages={null}
        messagesLoading={false}
        messagesError={false}
        onRetryMessages={() => undefined}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        posting={false}
        formError={null}
        showFilter={false}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Messages' })).toBeTruthy();
    expect(screen.getByText('Loading…')).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Conversation type' })).toBeNull();
  });

  it('shows an error and retries', () => {
    const onRetry = vi.fn();
    renderWithLocale(
      <InboxScreen
        conversations={null}
        error={true}
        loading={false}
        onRetry={onRetry}
        openId={null}
        onOpen={() => undefined}
        messages={null}
        messagesLoading={false}
        messagesError={false}
        onRetryMessages={() => undefined}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        posting={false}
        formError={null}
        showFilter={false}
      />,
    );
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toBe('Could not load messages. Please try again.');
    expect(alert.className).toContain('text-app-danger');
    expect(screen.queryByRole('group', { name: 'Conversation type' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows empty copy', () => {
    renderWithLocale(
      <InboxScreen
        conversations={[]}
        error={false}
        loading={false}
        onRetry={() => undefined}
        openId={null}
        onOpen={() => undefined}
        messages={null}
        messagesLoading={false}
        messagesError={false}
        onRetryMessages={() => undefined}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        posting={false}
        formError={null}
        showFilter={false}
      />,
    );
    expect(screen.getByText('No private messages yet.')).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Conversation type' })).toBeNull();
    expect(screen.queryByRole('list', { name: 'Conversations' })).toBeNull();
  });

  it('shows empty copy with origin filters for staff', () => {
    renderWithLocale(
      <InboxScreen
        conversations={[]}
        error={false}
        loading={false}
        onRetry={() => undefined}
        openId={null}
        onOpen={() => undefined}
        messages={null}
        messagesLoading={false}
        messagesError={false}
        onRetryMessages={() => undefined}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        posting={false}
        formError={null}
        showFilter={true}
      />,
    );
    expect(screen.getByText('No private messages yet.')).toBeTruthy();
    const emptyGroup = screen.getByRole('group', { name: 'Conversation type' });
    expect(emptyGroup).toBeTruthy();
    expect(
      within(emptyGroup).getByRole('button', { name: 'Direct' }).getAttribute('aria-pressed'),
    ).toBe('true');
    expect(screen.queryByRole('list', { name: 'Conversations' })).toBeNull();
    fireEvent.click(within(emptyGroup).getByRole('button', { name: 'Contact' }));
    expect(screen.getByText('No contact messages yet.')).toBeTruthy();
    fireEvent.click(within(emptyGroup).getByRole('button', { name: 'Damus' }));
    expect(screen.getByText('No Damus messages yet.')).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Conversation type' })).toBeTruthy();
  });

  it('lists threads and opens one', () => {
    const onOpen = vi.fn();
    renderWithLocale(
      <InboxScreen
        conversations={[THREAD]}
        error={false}
        loading={false}
        onRetry={() => undefined}
        openId={null}
        onOpen={onOpen}
        messages={null}
        messagesLoading={false}
        messagesError={false}
        onRetryMessages={() => undefined}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        posting={false}
        formError={null}
        showFilter={false}
      />,
    );
    expect(screen.queryByRole('group', { name: 'Conversation type' })).toBeNull();
    expect(screen.getByRole('list', { name: 'Conversations' })).toBeTruthy();
    const inboundPreview = screen.getByText('Hello team', { exact: true });
    expect(inboundPreview).toBeTruthy();
    expect(inboundPreview.className).not.toContain('bg-app-btn');
    expect(screen.queryByText('You: Hello team')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /21\.gifts/ }));
    expect(onOpen).toHaveBeenCalledWith('conv-1');
  });

  it('lists all inbound origins without a chooser', () => {
    const onOpen = vi.fn();
    renderWithLocale(
      <InboxScreen
        conversations={THREE}
        error={false}
        loading={false}
        onRetry={() => undefined}
        openId={null}
        onOpen={onOpen}
        messages={null}
        messagesLoading={false}
        messagesError={false}
        onRetryMessages={() => undefined}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        posting={false}
        formError={null}
        showFilter={false}
      />,
    );
    expect(screen.queryByRole('group', { name: 'Conversation type' })).toBeNull();
    const list = screen.getByRole('list', { name: 'Conversations' });
    expect(list.textContent).toContain('Bob');
    expect(list.textContent).toContain('21.gifts');
    expect(list.textContent).toContain('npub');
    const bobRow = screen.getByRole('button', { name: /Bob/ });
    expect(bobRow.textContent).toContain('Direct');
    const giftsRow = screen.getByRole('button', { name: /21\.gifts/ });
    expect(giftsRow.textContent).toContain('Contact');
    const npubRow = screen.getByRole('button', { name: /npub1abc/ });
    expect(npubRow.textContent).toContain('Damus');
    fireEvent.click(bobRow);
    expect(onOpen).toHaveBeenCalledWith('conv-2');
  });

  it('defaults to Direct and lists only member_member rows', () => {
    const onOpen = vi.fn();
    renderWithLocale(
      <InboxScreen
        conversations={THREE}
        error={false}
        loading={false}
        onRetry={() => undefined}
        openId={null}
        onOpen={onOpen}
        messages={null}
        messagesLoading={false}
        messagesError={false}
        onRetryMessages={() => undefined}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        posting={false}
        formError={null}
        showFilter={true}
      />,
    );
    const group = screen.getByRole('group', { name: 'Conversation type' });
    expect(group).toBeTruthy();
    expect(within(group).getByRole('button', { name: 'Direct' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    const list = screen.getByRole('list', { name: 'Conversations' });
    expect(list.textContent).toContain('Bob');
    expect(list.textContent).not.toContain('21.gifts');
    expect(list.textContent).not.toContain('npub');
    const bobRow = screen.getByRole('button', { name: /Bob/ });
    expect(bobRow.textContent).toContain('Direct');
    expect(bobRow.textContent).not.toContain('Contact');
    expect(bobRow.textContent).not.toContain('Damus');
    fireEvent.click(bobRow);
    expect(onOpen).toHaveBeenCalledWith('conv-2');
  });

  it('lists Contact rows after clicking Contact', () => {
    renderWithLocale(
      <InboxScreen
        conversations={THREE}
        error={false}
        loading={false}
        onRetry={() => undefined}
        openId={null}
        onOpen={() => undefined}
        messages={null}
        messagesLoading={false}
        messagesError={false}
        onRetryMessages={() => undefined}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        posting={false}
        formError={null}
        showFilter={true}
      />,
    );
    const group = screen.getByRole('group', { name: 'Conversation type' });
    fireEvent.click(within(group).getByRole('button', { name: 'Contact' }));
    expect(
      within(group).getByRole('button', { name: 'Contact' }).getAttribute('aria-pressed'),
    ).toBe('true');
    const list = screen.getByRole('list', { name: 'Conversations' });
    expect(list.textContent).toContain('21.gifts');
    expect(list.textContent).not.toContain('Bob');
    const giftsRow = screen.getByRole('button', { name: /21\.gifts/ });
    expect(giftsRow.textContent).toContain('Contact');
    expect(giftsRow.textContent).not.toContain('Direct');
    expect(giftsRow.textContent).not.toContain('Damus');
  });

  it('lists Damus rows after clicking Damus', () => {
    renderWithLocale(
      <InboxScreen
        conversations={THREE}
        error={false}
        loading={false}
        onRetry={() => undefined}
        openId={null}
        onOpen={() => undefined}
        messages={null}
        messagesLoading={false}
        messagesError={false}
        onRetryMessages={() => undefined}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        posting={false}
        formError={null}
        showFilter={true}
      />,
    );
    const group = screen.getByRole('group', { name: 'Conversation type' });
    fireEvent.click(within(group).getByRole('button', { name: 'Damus' }));
    expect(within(group).getByRole('button', { name: 'Damus' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    const list = screen.getByRole('list', { name: 'Conversations' });
    expect(list.textContent).toContain('npub');
    expect(list.textContent).not.toContain('Bob');
    const npubRow = screen.getByRole('button', { name: /npub1abc/ });
    expect(npubRow.textContent).toContain('Damus');
    expect(npubRow.textContent).not.toContain('Contact');
    expect(npubRow.textContent).not.toContain('Direct');
  });

  it('never lists a moderator_group row on Direct', () => {
    renderWithLocale(
      <InboxScreen
        conversations={[DIRECT, DAMUS, THREAD, MODERATORS]}
        error={false}
        loading={false}
        onRetry={() => undefined}
        openId={null}
        onOpen={() => undefined}
        messages={null}
        messagesLoading={false}
        messagesError={false}
        onRetryMessages={() => undefined}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        posting={false}
        formError={null}
        showFilter={true}
      />,
    );
    const group = screen.getByRole('group', { name: 'Conversation type' });
    expect(within(group).getByRole('button', { name: 'Direct' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    const list = screen.getByRole('list', { name: 'Conversations' });
    const rows = within(list).getAllByRole('button');
    expect(screen.queryByText('Staff room')).toBeNull();
    expect(screen.queryByText('Hello mods')).toBeNull();
    expect(rows[0]?.textContent).toContain('Bob');
    expect(rows[0]?.textContent).toContain('Later');
    expect(rows[0]?.textContent).not.toContain('Hello mods');
  });

  it('uses the inbox heading when openId is not in the conversation list', () => {
    renderWithLocale(
      <InboxScreen
        conversations={[THREAD]}
        error={false}
        loading={false}
        onRetry={() => undefined}
        openId="missing"
        onOpen={() => undefined}
        messages={null}
        messagesLoading={false}
        messagesError={false}
        onRetryMessages={() => undefined}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        posting={false}
        formError={null}
        showFilter={false}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Messages' })).toBeTruthy();
    expect(screen.queryByText('Contact')).toBeNull();
    expect(screen.queryByRole('group', { name: 'Conversation type' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'All conversations' })).toBeNull();
    expect(screen.queryByText('All conversations')).toBeNull();
    expect(screen.queryByRole('list', { name: 'Conversations' })).toBeNull();
  });

  it('lists a thread with empty lastText', () => {
    const onOpen = vi.fn();
    renderWithLocale(
      <InboxScreen
        conversations={[{ ...THREAD, lastText: '' }]}
        error={false}
        loading={false}
        onRetry={() => undefined}
        openId={null}
        onOpen={onOpen}
        messages={null}
        messagesLoading={false}
        messagesError={false}
        onRetryMessages={() => undefined}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        posting={false}
        formError={null}
        showFilter={false}
      />,
    );
    expect(screen.queryByRole('group', { name: 'Conversation type' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /21\.gifts/ }));
    expect(onOpen).toHaveBeenCalledWith('conv-1');
    expect(screen.getByRole('button', { name: /21\.gifts/ }).textContent).toContain('Contact');
  });

  it('lists a thread with empty lastText for staff after Contact', () => {
    const onOpen = vi.fn();
    renderWithLocale(
      <InboxScreen
        conversations={[{ ...THREAD, lastText: '' }]}
        error={false}
        loading={false}
        onRetry={() => undefined}
        openId={null}
        onOpen={onOpen}
        messages={null}
        messagesLoading={false}
        messagesError={false}
        onRetryMessages={() => undefined}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        posting={false}
        formError={null}
        showFilter={true}
      />,
    );
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Conversation type' })).getByRole('button', {
        name: 'Contact',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: /21\.gifts/ }));
    expect(onOpen).toHaveBeenCalledWith('conv-1');
    expect(screen.getByRole('button', { name: /21\.gifts/ }).textContent).toContain('Contact');
  });

  it('prefixes lastText with You: when lastFromMe is true', () => {
    renderWithLocale(
      <InboxScreen
        conversations={[{ ...THREAD, lastFromMe: true }]}
        error={false}
        loading={false}
        onRetry={() => undefined}
        openId={null}
        onOpen={() => undefined}
        messages={null}
        messagesLoading={false}
        messagesError={false}
        onRetryMessages={() => undefined}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        posting={false}
        formError={null}
        showFilter={false}
      />,
    );
    expect(screen.queryByRole('group', { name: 'Conversation type' })).toBeNull();
    const row = screen.getByRole('button', { name: /21\.gifts/ });
    expect(row.textContent).toContain('21.gifts');
    const sentPreview = screen.getByText('You: Hello team');
    expect(sentPreview).toBeTruthy();
    expect(sentPreview.className).toContain('bg-app-btn');
    expect(screen.queryByText('Hello team', { exact: true })).toBeNull();
  });

  it('prefixes lastText with You: for staff after Contact', () => {
    renderWithLocale(
      <InboxScreen
        conversations={[{ ...THREAD, lastFromMe: true }]}
        error={false}
        loading={false}
        onRetry={() => undefined}
        openId={null}
        onOpen={() => undefined}
        messages={null}
        messagesLoading={false}
        messagesError={false}
        onRetryMessages={() => undefined}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        posting={false}
        formError={null}
        showFilter={true}
      />,
    );
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Conversation type' })).getByRole('button', {
        name: 'Contact',
      }),
    );
    const row = screen.getByRole('button', { name: /21\.gifts/ });
    expect(row.textContent).toContain('21.gifts');
    const sentPreview = screen.getByText('You: Hello team');
    expect(sentPreview).toBeTruthy();
    expect(sentPreview.className).toContain('bg-app-btn');
    expect(screen.queryByText('Hello team', { exact: true })).toBeNull();
  });

  it('hides the preview when lastText is empty even if lastFromMe is true', () => {
    renderWithLocale(
      <InboxScreen
        conversations={[{ ...THREAD, lastText: '', lastFromMe: true }]}
        error={false}
        loading={false}
        onRetry={() => undefined}
        openId={null}
        onOpen={() => undefined}
        messages={null}
        messagesLoading={false}
        messagesError={false}
        onRetryMessages={() => undefined}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        posting={false}
        formError={null}
        showFilter={false}
      />,
    );
    expect(screen.queryByRole('group', { name: 'Conversation type' })).toBeNull();
    const row = screen.getByRole('button', { name: /21\.gifts/ });
    expect(row.querySelector('.line-clamp-2')).toBeNull();
    expect(screen.queryByText('You:')).toBeNull();
  });

  it('shows an open thread, composer errors, and posts', () => {
    const onPost = vi.fn();
    const onDraftChange = vi.fn();
    const onRetryMessages = vi.fn();
    renderWithLocale(
      <InboxScreen
        conversations={[THREAD]}
        error={false}
        loading={false}
        onRetry={() => undefined}
        openId="conv-1"
        onOpen={() => undefined}
        messages={[MESSAGE]}
        messagesLoading={false}
        messagesError={false}
        onRetryMessages={onRetryMessages}
        draft="Hi"
        onDraftChange={onDraftChange}
        onPost={onPost}
        posting={false}
        formError="empty"
        showFilter={false}
      />,
    );
    expect(screen.getByRole('heading', { name: '21.gifts' })).toBeTruthy();
    expect(screen.getByText('Contact')).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Conversation type' })).toBeNull();
    expect(screen.getByText('Ada')).toBeTruthy();
    expect(screen.getByText('Hello team')).toBeTruthy();
    const incoming = screen.getByRole('listitem');
    expect(incoming.getAttribute('data-from-me')).toBe('false');
    expect(incoming.className).toContain('bg-app-card-muted');
    expect(incoming.className).not.toContain('bg-app-btn');
    expect(incoming.className).not.toContain('self-end');
    expect(screen.getByRole('alert').textContent).toBe('Enter a message');
    expect(screen.queryByRole('button', { name: 'All conversations' })).toBeNull();
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Next' } });
    expect(onDraftChange).toHaveBeenCalledWith('Next');
    expect(screen.queryByText('Send')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(onPost).toHaveBeenCalledTimes(1);
  });

  it('shows tooLong and request alerts and a posting spinner', () => {
    const { rerender } = renderWithLocale(
      <InboxScreen
        conversations={[THREAD]}
        error={false}
        loading={false}
        onRetry={() => undefined}
        openId="conv-1"
        onOpen={() => undefined}
        messages={[]}
        messagesLoading={false}
        messagesError={false}
        onRetryMessages={() => undefined}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        posting={true}
        formError="tooLong"
        showFilter={false}
      />,
    );
    expect(screen.getByRole('alert').textContent).toBe('Keep it to 500 characters');
    expect(screen.queryByRole('button', { name: 'All conversations' })).toBeNull();
    expect(screen.queryByText('Send')).toBeNull();
    expect((screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement).disabled).toBe(true);
    rerender(
      <LocaleProvider locale="en" messages={getCatalog('en')}>
        <ThemeProvider>
          <InboxScreen
            conversations={[THREAD]}
            error={false}
            loading={false}
            onRetry={() => undefined}
            openId="conv-1"
            onOpen={() => undefined}
            messages={null}
            messagesLoading={true}
            messagesError={false}
            onRetryMessages={() => undefined}
            draft=""
            onDraftChange={() => undefined}
            onPost={() => undefined}
            posting={false}
            formError="request"
            showFilter={false}
          />
        </ThemeProvider>
      </LocaleProvider>,
    );
    expect(screen.getByText('Loading…')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'All conversations' })).toBeNull();
    expect(screen.getByRole('alert').textContent).toBe('Could not send your message');
  });

  it('retries a failed thread fetch', () => {
    const onRetryMessages = vi.fn();
    renderWithLocale(
      <InboxScreen
        conversations={[THREAD]}
        error={false}
        loading={false}
        onRetry={() => undefined}
        openId="conv-1"
        onOpen={() => undefined}
        messages={null}
        messagesLoading={false}
        messagesError={true}
        onRetryMessages={onRetryMessages}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        posting={false}
        formError={null}
        showFilter={false}
      />,
    );
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toBe('Could not load messages. Please try again.');
    expect(alert.className).toContain('text-app-danger');
    expect(screen.queryByRole('button', { name: 'All conversations' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetryMessages).toHaveBeenCalledTimes(1);
  });

  it('renders fromMe messages as You on the sent side', () => {
    renderWithLocale(
      <InboxScreen
        conversations={[THREAD]}
        error={false}
        loading={false}
        onRetry={() => undefined}
        openId="conv-1"
        onOpen={() => undefined}
        messages={[{ ...MESSAGE, fromMe: true }]}
        messagesLoading={false}
        messagesError={false}
        onRetryMessages={() => undefined}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        posting={false}
        formError={null}
        showFilter={false}
      />,
    );
    expect(screen.getByText('You')).toBeTruthy();
    expect(screen.queryByText('Ada')).toBeNull();
    expect(screen.queryByRole('button', { name: 'All conversations' })).toBeNull();
    const bubble = screen.getByRole('listitem');
    expect(bubble.getAttribute('data-from-me')).toBe('true');
    expect(bubble.className).toContain('self-end');
    expect(bubble.className).toContain('bg-app-btn');
    expect(bubble.className).not.toContain('bg-app-card-muted');
  });

  it('links the open-thread heading name with accountId to the member profile', () => {
    renderWithLocale(
      <InboxScreen
        conversations={[{ ...DIRECT, accountId: 'acc_bob' }]}
        error={false}
        loading={false}
        onRetry={() => undefined}
        openId="conv-2"
        onOpen={() => undefined}
        messages={[MESSAGE]}
        messagesLoading={false}
        messagesError={false}
        onRetryMessages={() => undefined}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        posting={false}
        formError={null}
        showFilter={false}
      />,
    );
    const heading = screen.getByRole('heading', { name: 'Bob' });
    expect(heading).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'All conversations' })).toBeNull();
    fireEvent.click(within(heading).getByRole('button', { name: 'View profile' }));
    expect(push).toHaveBeenCalledWith('/members/acc_bob');
  });

  it('links incoming message author names with accountId to the member profile', () => {
    renderWithLocale(
      <InboxScreen
        conversations={[THREAD]}
        error={false}
        loading={false}
        onRetry={() => undefined}
        openId="conv-1"
        onOpen={() => undefined}
        messages={[{ ...MESSAGE, accountId: 'acc_ada' }]}
        messagesLoading={false}
        messagesError={false}
        onRetryMessages={() => undefined}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        posting={false}
        formError={null}
        showFilter={false}
      />,
    );
    expect(screen.queryByRole('button', { name: 'All conversations' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'View profile' }));
    expect(push).toHaveBeenCalledWith('/members/acc_ada');
  });

  it('links heading then incoming author when both have accountId', () => {
    renderWithLocale(
      <InboxScreen
        conversations={[{ ...DIRECT, accountId: 'acc_bob' }]}
        error={false}
        loading={false}
        onRetry={() => undefined}
        openId="conv-2"
        onOpen={() => undefined}
        messages={[{ ...MESSAGE, accountId: 'acc_ada' }]}
        messagesLoading={false}
        messagesError={false}
        onRetryMessages={() => undefined}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        posting={false}
        formError={null}
        showFilter={false}
      />,
    );
    expect(screen.queryByRole('button', { name: 'All conversations' })).toBeNull();
    const buttons = screen.getAllByRole('button', { name: 'View profile' });
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[0]!);
    expect(push).toHaveBeenCalledWith('/members/acc_bob');
    fireEvent.click(buttons[1]!);
    expect(push).toHaveBeenCalledWith('/members/acc_ada');
  });

  it('keeps fromMe names as You without a profile button', () => {
    renderWithLocale(
      <InboxScreen
        conversations={[THREAD]}
        error={false}
        loading={false}
        onRetry={() => undefined}
        openId="conv-1"
        onOpen={() => undefined}
        messages={[{ ...MESSAGE, fromMe: true, accountId: 'acc_me' }]}
        messagesLoading={false}
        messagesError={false}
        onRetryMessages={() => undefined}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        posting={false}
        formError={null}
        showFilter={false}
      />,
    );
    expect(screen.getByText('You')).toBeTruthy();
    expect(screen.queryByText('Ada')).toBeNull();
    expect(screen.queryByRole('button', { name: 'View profile' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'All conversations' })).toBeNull();
  });

  it('keeps names as plain text when accountId is missing', () => {
    renderWithLocale(
      <InboxScreen
        conversations={[THREAD]}
        error={false}
        loading={false}
        onRetry={() => undefined}
        openId="conv-1"
        onOpen={() => undefined}
        messages={[MESSAGE]}
        messagesLoading={false}
        messagesError={false}
        onRetryMessages={() => undefined}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        posting={false}
        formError={null}
        showFilter={false}
      />,
    );
    expect(screen.queryByRole('button', { name: 'View profile' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'All conversations' })).toBeNull();
    expect(screen.getByRole('heading', { name: '21.gifts' })).toBeTruthy();
    expect(screen.getByText('Ada')).toBeTruthy();
  });

  it('keeps names as plain text when accountId is empty', () => {
    renderWithLocale(
      <InboxScreen
        conversations={[{ ...DIRECT, accountId: '' }]}
        error={false}
        loading={false}
        onRetry={() => undefined}
        openId="conv-2"
        onOpen={() => undefined}
        messages={[{ ...MESSAGE, accountId: '' }]}
        messagesLoading={false}
        messagesError={false}
        onRetryMessages={() => undefined}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        posting={false}
        formError={null}
        showFilter={false}
      />,
    );
    expect(screen.queryByRole('button', { name: 'View profile' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'All conversations' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Bob' })).toBeTruthy();
    expect(screen.getByText('Ada')).toBeTruthy();
  });

  it('keeps Damus headings as plain text', () => {
    renderWithLocale(
      <InboxScreen
        conversations={[DAMUS]}
        error={false}
        loading={false}
        onRetry={() => undefined}
        openId="conv-3"
        onOpen={() => undefined}
        messages={[MESSAGE]}
        messagesLoading={false}
        messagesError={false}
        onRetryMessages={() => undefined}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        posting={false}
        formError={null}
        showFilter={false}
      />,
    );
    expect(screen.getByRole('heading', { name: 'npub1abc…xyz' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'View profile' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'All conversations' })).toBeNull();
  });

  it('renders a gift-only bubble and amount under text+sats', () => {
    renderWithLocale(
      <InboxScreen
        conversations={[DIRECT]}
        error={false}
        loading={false}
        onRetry={() => undefined}
        openId="conv-2"
        onOpen={() => undefined}
        messages={[
          { ...MESSAGE, id: 'g1', text: '', sats: 21, fromMe: true },
          { ...MESSAGE, id: 'g0', text: '', sats: 21, fromMe: false },
          { ...MESSAGE, id: 'g2', text: 'Hi', sats: 21, fromMe: false },
        ]}
        messagesLoading={false}
        messagesError={false}
        onRetryMessages={() => undefined}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        posting={false}
        formError={null}
        showFilter={false}
      />,
    );
    expect(screen.getAllByText('send ₿21')).toHaveLength(2);
    expect(screen.getByText('₿21')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '7' } });
  });

  it('shows a gift-only last-sats list preview', () => {
    renderWithLocale(
      <InboxScreen
        conversations={[{ ...DIRECT, lastText: '', lastSats: 21, lastFromMe: true }]}
        error={false}
        loading={false}
        onRetry={() => undefined}
        openId={null}
        onOpen={() => undefined}
        messages={null}
        messagesLoading={false}
        messagesError={false}
        onRetryMessages={() => undefined}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        posting={false}
        formError={null}
        showFilter={false}
      />,
    );
    expect(screen.getByText('₿21')).toBeTruthy();
  });

  it('styles an unread inbound row with a semibold name and foreground lastText', () => {
    renderWithLocale(
      <InboxScreen
        conversations={[{ ...THREAD, unread: true }]}
        error={false}
        loading={false}
        onRetry={() => undefined}
        openId={null}
        onOpen={() => undefined}
        messages={null}
        messagesLoading={false}
        messagesError={false}
        onRetryMessages={() => undefined}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        posting={false}
        formError={null}
        showFilter={false}
      />,
    );
    const row = screen.getByRole('button', { name: '21.gifts, Unread' });
    expect(row.getAttribute('aria-label')).toBe('21.gifts, Unread');
    expect(within(row).getByText('21.gifts').className).toContain('font-semibold');
    const lastText = screen.getByText('Hello team', { exact: true });
    expect(lastText.className).toContain('text-app-fg');
    expect(lastText.className).not.toContain('text-app-muted');
    expect(row.querySelector('.tabular-nums')).toBeNull();
    expect(within(row).queryByText('Unread')).toBeNull();
  });

  it('keeps a read inbound row medium and muted without an unread aria-label', () => {
    renderWithLocale(
      <InboxScreen
        conversations={[THREAD]}
        error={false}
        loading={false}
        onRetry={() => undefined}
        openId={null}
        onOpen={() => undefined}
        messages={null}
        messagesLoading={false}
        messagesError={false}
        onRetryMessages={() => undefined}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        posting={false}
        formError={null}
        showFilter={false}
      />,
    );
    expect(screen.queryByRole('button', { name: '21.gifts, Unread' })).toBeNull();
    const row = screen.getByRole('button', { name: /21\.gifts/ });
    expect(row.getAttribute('aria-label')).toBeNull();
    expect(within(row).getByText('21.gifts').className).toContain('font-medium');
    expect(within(row).getByText('21.gifts').className).not.toContain('font-semibold');
    const lastText = screen.getByText('Hello team', { exact: true });
    expect(lastText.className).toContain('text-app-muted');
    expect(lastText.className).not.toContain('text-app-fg');
    expect(row.querySelector('.tabular-nums')).toBeNull();
  });

  it('opens Wallet of Satoshi from the smartphone pay sheet', () => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    });
    const onPayCancel = vi.fn();
    renderWithLocale(
      <InboxScreen
        conversations={[DIRECT]}
        error={false}
        loading={false}
        onRetry={() => undefined}
        openId="conv-2"
        onOpen={() => undefined}
        messages={[MESSAGE]}
        messagesLoading={false}
        messagesError={false}
        onRetryMessages={() => undefined}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        posting={false}
        formError={null}
        showFilter={false}
        invoice={{ pr: 'lnbc21n1test', amountSats: 21 }}
        onPayCancel={onPayCancel}
        payWaiting={true}
      />,
    );
    expect(screen.getByText('Waiting for payment…')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Pay with Wallet of Satoshi' }));
    expect(locationStub.href.toLowerCase()).toContain('lnbc21n1test');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onPayCancel).toHaveBeenCalledTimes(1);
  });

  it('shows the desktop invoice QR', async () => {
    renderWithLocale(
      <InboxScreen
        conversations={[DIRECT]}
        error={false}
        loading={false}
        onRetry={() => undefined}
        openId="conv-2"
        onOpen={() => undefined}
        messages={[MESSAGE]}
        messagesLoading={false}
        messagesError={false}
        onRetryMessages={() => undefined}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        posting={false}
        formError={null}
        showFilter={false}
        invoice={{ pr: 'lnbc21n1test', amountSats: 21 }}
      />,
    );
    expect(await screen.findByRole('img', { name: 'Bitcoin payment QR code' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  });
});
