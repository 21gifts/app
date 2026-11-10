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

  it('shows Software Developer for a verified member with the staff tag', () => {
    renderWithLocale(
      <ForumRoleTag
        role="verified"
        staffTag="software_developer"
        expanded={false}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Software Developer' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Verified' })).toBeNull();
  });

  it('shows Software Developer for the live role', () => {
    renderWithLocale(
      <ForumRoleTag role="software_developer" expanded={false} onToggle={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'Software Developer' })).toBeTruthy();
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

  it('returns the Software Developer sentence for a verified member with the staff tag', () => {
    renderWithLocale(
      <ForumRoleHint role="verified" staffTag="software_developer" />,
    );
    expect(
      screen.getByText('This person builds 21.gifts and moderates the living room.'),
    ).toBeTruthy();
  });

  it('returns the Software Developer sentence for the live role', () => {
    renderWithLocale(<ForumRoleHint role="software_developer" />);
    expect(
      screen.getByText('This person builds 21.gifts and moderates the living room.'),
    ).toBeTruthy();
  });
});
