import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ForumBoard } from '@/components/ForumBoard';
import type { ForumMessage } from '@/lib/api-types';
import { formatForumTime } from '@/lib/forum-time';
import { renderWithLocale } from '@/__tests__/render-with-locale';

afterEach(cleanup);

const SAMPLE: ForumMessage = {
  id: 'm1',
  name: 'Ada',
  text: 'Hello from Ada',
  createdAt: '2026-08-28T12:00:00.000Z',
};

const MULTILINE: ForumMessage = {
  id: 'm2',
  name: 'Bob',
  text: 'Line one\nLine two',
  createdAt: '2026-08-28T13:00:00.000Z',
};

describe('ForumBoard', () => {
  it('shows the heading, composer, and Post button', () => {
    renderWithLocale(
      <ForumBoard
        messages={[]}
        error={null}
        loading={false}
        posting={false}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        onRetry={() => undefined}
        formError={null}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Messages' })).toBeTruthy();
    expect(screen.getByLabelText('Your message')).toBeTruthy();
    expect(screen.getByPlaceholderText('Write a message')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Post' })).toBeTruthy();
  });

  it('shows loading copy when loading and messages are null', () => {
    renderWithLocale(
      <ForumBoard
        messages={null}
        error={null}
        loading={true}
        posting={false}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        onRetry={() => undefined}
        formError={null}
      />,
    );
    expect(screen.getByText('Loading…')).toBeTruthy();
  });

  it('shows a fallback loading line when nothing is loaded yet', () => {
    renderWithLocale(
      <ForumBoard
        messages={null}
        error={null}
        loading={false}
        posting={false}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        onRetry={() => undefined}
        formError={null}
      />,
    );
    expect(screen.getByText('Loading…')).toBeTruthy();
  });

  it('shows an error and retries', () => {
    const onRetry = vi.fn();
    renderWithLocale(
      <ForumBoard
        messages={null}
        error="Could not load messages. Please try again."
        loading={false}
        posting={false}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        onRetry={onRetry}
        formError={null}
      />,
    );
    expect(screen.getByText('Could not load messages. Please try again.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows the empty copy', () => {
    renderWithLocale(
      <ForumBoard
        messages={[]}
        error={null}
        loading={false}
        posting={false}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        onRetry={() => undefined}
        formError={null}
      />,
    );
    expect(screen.getByText('No messages yet. Be the first to write.')).toBeTruthy();
  });

  it('lists messages with name, formatted time, and pre-wrapped text', () => {
    renderWithLocale(
      <ForumBoard
        messages={[SAMPLE, MULTILINE]}
        error={null}
        loading={false}
        posting={false}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        onRetry={() => undefined}
        formError={null}
      />,
    );
    const list = screen.getByRole('list', { name: 'Messages' });
    expect(list).toBeTruthy();
    expect(screen.getByText('Ada')).toBeTruthy();
    expect(screen.getByText('Hello from Ada')).toBeTruthy();
    expect(screen.getByText(formatForumTime(SAMPLE.createdAt, 'en'))).toBeTruthy();
    const preWrap = screen.getByText(
      (content) => content.includes('Line one') && content.includes('Line two'),
    );
    expect(preWrap.className).toContain('whitespace-pre-wrap');
  });

  it('shows formError empty alert', () => {
    renderWithLocale(
      <ForumBoard
        messages={[]}
        error={null}
        loading={false}
        posting={false}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        onRetry={() => undefined}
        formError="empty"
      />,
    );
    expect(screen.getByRole('alert').textContent).toBe('Enter a message');
  });

  it('shows formError request alert', () => {
    renderWithLocale(
      <ForumBoard
        messages={[]}
        error={null}
        loading={false}
        posting={false}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        onRetry={() => undefined}
        formError="request"
      />,
    );
    expect(screen.getByRole('alert').textContent).toBe('Could not post your message');
  });

  it('disables submit and shows a spinner while posting', () => {
    renderWithLocale(
      <ForumBoard
        messages={[]}
        error={null}
        loading={false}
        posting={true}
        draft="Hi"
        onDraftChange={() => undefined}
        onPost={() => undefined}
        onRetry={() => undefined}
        formError={null}
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
        error={null}
        loading={false}
        posting={false}
        draft=""
        onDraftChange={onDraftChange}
        onPost={onPost}
        onRetry={() => undefined}
        formError={null}
      />,
    );
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Hi' } });
    expect(onDraftChange).toHaveBeenCalledWith('Hi');
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    expect(onPost).toHaveBeenCalledTimes(1);
  });
});
