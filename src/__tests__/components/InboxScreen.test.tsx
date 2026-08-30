import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InboxScreen } from '@/components/InboxScreen';
import type { Conversation, ConversationMessage } from '@/lib/api-types';
import { renderWithLocale } from '@/__tests__/render-with-locale';

afterEach(cleanup);

const THREAD: Conversation = {
  id: 'conv-1',
  name: '21.gifts',
  lastText: 'Hello team',
  lastAt: '2026-08-28T12:00:00.000Z',
};

const MESSAGE: ConversationMessage = {
  id: 'm1',
  name: 'Ada',
  text: 'Hello team',
  createdAt: '2026-08-28T12:00:00.000Z',
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
      />,
    );
    expect(screen.getByRole('heading', { name: 'Messages' })).toBeTruthy();
    expect(screen.getByText('Loading…')).toBeTruthy();
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
      />,
    );
    expect(screen.getByText('Could not load messages. Please try again.')).toBeTruthy();
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
      />,
    );
    expect(screen.getByText('No private messages yet.')).toBeTruthy();
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
      />,
    );
    expect(screen.getByRole('list', { name: 'Conversations' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /21\.gifts/ }));
    expect(onOpen).toHaveBeenCalledWith('conv-1');
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
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /21\.gifts/ }));
    expect(onOpen).toHaveBeenCalledWith('conv-1');
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
      />,
    );
    expect(screen.getByRole('heading', { name: '21.gifts' })).toBeTruthy();
    expect(screen.getByText('Hello team')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe('Enter a message');
    fireEvent.click(screen.getByRole('button', { name: 'All conversations' }));
    expect(onBack).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Next' } });
    expect(onDraftChange).toHaveBeenCalledWith('Next');
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
      />,
    );
    expect(screen.getByRole('alert').textContent).toBe('Keep it to 500 characters');
    expect((screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement).disabled).toBe(true);
    rerender(
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
      />,
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
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetryMessages).toHaveBeenCalledTimes(1);
  });
});
