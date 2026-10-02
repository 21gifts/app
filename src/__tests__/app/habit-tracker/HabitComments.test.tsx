import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HabitComments } from '@/app/habit-tracker/HabitComments';
import type { Account } from '@/lib/api-types';
import type { MemberHabitList } from '@/lib/member-habits';
import { renderWithLocale } from '@/__tests__/render-with-locale';

type Habit = MemberHabitList['habits'][number];

const owner: Account = {
  id: 'acc-owner',
  linkingKey: '02abcdef',
  role: 'initiator',
  name: 'Ada',
  location: null,
  lightningAddress: 'alice@walletofsatoshi.com',
  lightningAddressVerified: true,
  forumLawsDismissed: true,
  createdAt: 1,
  rulesAgreedAt: 1_700_000_001,
  viewKey: 'a'.repeat(64),
  aboutMe: null,
  aboutMeHasPhoto: false,
  setup: null,
  missing: [],
};

function habit(comments: Habit['comments']): Habit {
  return {
    id: 'h1',
    accountId: 'acc-owner',
    ownerName: 'Ada',
    role: 'initiator',
    name: 'Walk',
    description: 'Outside',
    cadence: 'daily',
    timeZone: 'Europe/Zurich',
    firstPeriod: '2026-10-01',
    lastPeriod: null,
    periods: [],
    comments,
  };
}

const otherComment = {
  id: 'c-other',
  habitId: 'h1',
  accountId: 'acc-other',
  name: 'Bea',
  text: 'hello',
  week: '2026-09-28',
  createdAt: 2,
};

function renderComments(
  overrides: Partial<Parameters<typeof HabitComments>[0]> = {},
): ReturnType<typeof renderWithLocale> {
  return renderWithLocale(
    <HabitComments
      habit={habit([])}
      account={owner}
      session="token"
      commentText=""
      payCommentId={null}
      payDraft=""
      payBusy={false}
      payError={null}
      payInvoice={null}
      rateDay={null}
      ratePending={false}
      onPayOpen={vi.fn()}
      onPayDraftChange={vi.fn()}
      onPayUnitChange={vi.fn()}
      onPaySubmit={vi.fn()}
      onPayCancel={vi.fn()}
      onCommentText={vi.fn()}
      onPostComment={vi.fn()}
      onDeleteComment={vi.fn()}
      {...overrides}
    />,
  );
}

afterEach(() => {
  cleanup();
});

describe('HabitComments', () => {
  it('hides the composer and offers no second sign-in link when signed out', () => {
    renderComments({ account: null, session: null });
    expect(screen.getByText('No comments yet.')).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Post' })).toBeNull();
  });

  it('posts a comment for the owner and does not offer a gift on their own comment', () => {
    const onPostComment = vi.fn();
    const onCommentText = vi.fn();
    renderComments({
      onPostComment,
      onCommentText,
      habit: habit([
        {
          id: 'c-own',
          habitId: 'h1',
          accountId: 'acc-owner',
          name: 'Ada',
          text: 'mine',
          week: '2026-09-28',
          createdAt: 1,
        },
      ]),
    });
    expect(screen.queryByRole('button', { name: 'Send Bitcoin' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    expect(onPostComment).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText('Write a comment'), { target: { value: 'next' } });
    expect(onCommentText).toHaveBeenCalledWith('next');
  });

  it('confirms deletion, and opens the gift sheet only for someone else', () => {
    const onDeleteComment = vi.fn();
    const onPayOpen = vi.fn();
    const onPaySubmit = vi.fn();
    renderComments({
      onDeleteComment,
      onPayOpen,
      onPaySubmit,
      ratePending: true,
      payCommentId: 'c-other',
      habit: habit([otherComment]),
    });
    fireEvent.click(screen.getByRole('button', { name: 'Delete comment' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel deletion' }));
    expect(onDeleteComment).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Delete comment' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm deletion' }));
    expect(onDeleteComment).toHaveBeenCalledWith('c-other');
    fireEvent.click(screen.getByRole('button', { name: 'Send Bitcoin' }));
    expect(onPayOpen).toHaveBeenCalledWith('c-other');
    expect(screen.getByRole('button', { name: 'Continue' }).hasAttribute('disabled')).toBe(true);
    expect(onPaySubmit).not.toHaveBeenCalled();
  });
});
