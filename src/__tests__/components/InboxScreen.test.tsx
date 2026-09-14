import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocaleProvider } from '@/components/LocaleProvider';
import { ThemeProvider } from '@/components/ThemeProvider';
import { InboxScreen } from '@/components/InboxScreen';
import type { Conversation, ConversationMessage } from '@/lib/api-types';
import { getCatalog } from '@/lib/messages';
import { renderWithLocale } from '@/__tests__/render-with-locale';

afterEach(cleanup);

const THREAD: Conversation = {
  id: 'conv-1',
  kind: 'member_platform',
  name: '21.gifts',
  lastText: 'Hello team',
  lastAt: '2026-08-28T12:00:00.000Z',
  lastFromMe: false,
};

const DIRECT: Conversation = {
  id: 'conv-2',
  kind: 'member_member',
  name: 'Bob',
  lastText: 'Later',
  lastAt: '2026-08-28T13:00:00.000Z',
  lastFromMe: false,
};

const DAMUS: Conversation = {
  id: 'conv-3',
  kind: 'member_damus',
  name: 'npub1abc…xyz',
  lastText: 'Hi',
  lastAt: '2026-08-28T14:00:00.000Z',
  lastFromMe: false,
};

const THREE: Conversation[] = [THREAD, DIRECT, DAMUS];

const MESSAGE: ConversationMessage = {
  id: 'm1',
  name: 'Ada',
  text: 'Hello team',
  createdAt: '2026-08-28T12:00:00.000Z',
  fromMe: false,
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
        onBack={() => undefined}
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
        onBack={() => undefined}
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
        onBack={() => undefined}
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
        onBack={() => undefined}
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
        onBack={() => undefined}
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
        onBack={() => undefined}
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
        onBack={() => undefined}
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
        onBack={() => undefined}
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
        onBack={() => undefined}
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

  it('uses the inbox heading when openId is not in the conversation list', () => {
    renderWithLocale(
      <InboxScreen
        conversations={[THREAD]}
        error={false}
        loading={false}
        onRetry={() => undefined}
        openId="missing"
        onOpen={() => undefined}
        onBack={() => undefined}
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
    expect(screen.getByRole('button', { name: 'All conversations' })).toBeTruthy();
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
        onBack={() => undefined}
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
        onBack={() => undefined}
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
        onBack={() => undefined}
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
        onBack={() => undefined}
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
        onBack={() => undefined}
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
    const onBack = vi.fn();
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
        onBack={onBack}
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
    fireEvent.click(screen.getByRole('button', { name: 'All conversations' }));
    expect(onBack).toHaveBeenCalledTimes(1);
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
        onBack={() => undefined}
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
            onBack={() => undefined}
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
        onBack={() => undefined}
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
        onBack={() => undefined}
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
    const bubble = screen.getByRole('listitem');
    expect(bubble.getAttribute('data-from-me')).toBe('true');
    expect(bubble.className).toContain('self-end');
    expect(bubble.className).toContain('bg-app-btn');
    expect(bubble.className).not.toContain('bg-app-card-muted');
  });
});
