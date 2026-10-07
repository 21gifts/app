import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InlineConfirm } from '@/components/InlineConfirm';
import { renderWithLocale } from '@/__tests__/render-with-locale';

afterEach(() => {
  cleanup();
});

describe('InlineConfirm', () => {
  it('asks, then confirms or cancels', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    renderWithLocale(
      <InlineConfirm
        label="Archive this habit? Its history stays visible."
        confirmLabel="Confirm archive"
        cancelLabel="Cancel archive"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    const group = screen.getByRole('group', {
      name: 'Archive this habit? Its history stays visible.',
    });
    expect(group).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm archive' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel archive' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('disables both actions and shows the failure while busy', () => {
    renderWithLocale(
      <InlineConfirm
        label="Delete this comment from the Habit-Tracker?"
        confirmLabel="Confirm deletion"
        cancelLabel="Cancel deletion"
        busy
        error="Could not delete the comment. Please try again."
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByRole('alert').textContent).toBe(
      'Could not delete the comment. Please try again.',
    );
    expect(screen.getByRole('button', { name: 'Confirm deletion' }).hasAttribute('disabled')).toBe(
      true,
    );
    expect(screen.getByRole('button', { name: 'Cancel deletion' }).hasAttribute('disabled')).toBe(
      true,
    );
  });
});
