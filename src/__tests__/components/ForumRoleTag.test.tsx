import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ForumRoleHint, ForumRoleTag, forumTaggedRole } from '@/components/ForumRoleTag';
import { renderWithLocale } from '@/__tests__/render-with-locale';

afterEach(() => {
  cleanup();
});

describe('forumTaggedRole', () => {
  it('returns only the five tagged roles', () => {
    expect(forumTaggedRole('founder')).toBe('founder');
    expect(forumTaggedRole('moderator')).toBe('moderator');
    expect(forumTaggedRole('fond')).toBe('fond');
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

  it('hides Verified behind the Software Developer label', () => {
    const { container } = renderWithLocale(
      <ForumRoleTag
        role="verified"
        staffTag="software_developer"
        expanded={false}
        onToggle={vi.fn()}
      />,
    );
    expect(container.innerHTML).toBe('');
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

  it('returns nothing for Verified behind the Software Developer label', () => {
    const { container } = renderWithLocale(
      <ForumRoleHint role="verified" staffTag="software_developer" />,
    );
    expect(container.innerHTML).toBe('');
  });
});
