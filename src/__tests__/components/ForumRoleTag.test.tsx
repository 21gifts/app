import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ForumRoleHint, ForumRoleTag, forumTaggedRole } from '@/components/ForumRoleTag';
import { renderWithLocale } from '@/__tests__/render-with-locale';

afterEach(() => {
  cleanup();
});

describe('forumTaggedRole', () => {
  it('returns only the six tagged roles', () => {
    expect(forumTaggedRole('founder')).toBe('founder');
    expect(forumTaggedRole('moderator')).toBe('moderator');
    expect(forumTaggedRole('fond')).toBe('fond');
    expect(forumTaggedRole('software_developer')).toBe('software_developer');
    expect(forumTaggedRole('initiator')).toBe('initiator');
    expect(forumTaggedRole('verified')).toBe('verified');
    expect(forumTaggedRole('basis')).toBeNull();
    expect(forumTaggedRole('unknown')).toBeNull();
  });
});

describe('ForumRoleTag', () => {
  it('draws a tagged pill and reports the open state on toggle', () => {
    const onToggle = vi.fn();
    renderWithLocale(<ForumRoleTag role="founder" expanded={false} onToggle={onToggle} />);
    const pill = screen.getByRole('button', { name: 'Founder' });
    expect(pill.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(pill);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('draws nothing for basis or a missing role', () => {
    const { container } = renderWithLocale(
      <ForumRoleTag role="basis" expanded={false} onToggle={vi.fn()} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('draws the Fond pill', () => {
    renderWithLocale(<ForumRoleTag role="fond" expanded={false} onToggle={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Fond' })).toBeTruthy();
  });

  it('shows one Software Developer pill and no Verified pill', () => {
    renderWithLocale(
      <ForumRoleTag role="software_developer" expanded={false} onToggle={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'Software Developer' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Verified' })).toBeNull();
  });
});

describe('ForumRoleHint', () => {
  it('returns the explanation for a tagged role', () => {
    renderWithLocale(<ForumRoleHint role="initiator" />);
    expect(screen.getByText('This person was named an initiator.')).toBeTruthy();
  });

  it('returns nothing for an untagged role', () => {
    const { container } = renderWithLocale(<ForumRoleHint role="basis" />);
    expect(container.innerHTML).toBe('');
  });

  it('returns the Fond explanation', () => {
    renderWithLocale(<ForumRoleHint role="fond" />);
    expect(
      screen.getByText('This account pays the daily gifts from the 21.gifts fund.'),
    ).toBeTruthy();
  });

  it('returns the Software Developer sentence', () => {
    renderWithLocale(<ForumRoleHint role="software_developer" />);
    expect(
      screen.getByText('This person builds 21.gifts and moderates the living room.'),
    ).toBeTruthy();
  });
});
