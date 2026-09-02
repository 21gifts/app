import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IconButton } from '@/components/ui/IconButton';
import { renderWithLocale } from '@/__tests__/render-with-locale';

afterEach(cleanup);

describe('IconButton', () => {
  it('requires aria-label and defaults to secondary md type=button', () => {
    renderWithLocale(
      <IconButton aria-label="Copy">
        <span aria-hidden="true">C</span>
      </IconButton>,
    );
    const button = screen.getByRole('button', { name: 'Copy' });
    expect(button.getAttribute('type')).toBe('button');
    expect(button.className).toContain('h-11');
    expect(button.className).toContain('border-app-border-strong');
  });

  it('applies primary and ghost variants plus size classes', () => {
    const { rerender } = renderWithLocale(
      <IconButton aria-label="Primary" variant="primary" size="sm">
        <span>P</span>
      </IconButton>,
    );
    expect(screen.getByRole('button', { name: 'Primary' }).className).toContain('bg-app-btn');
    expect(screen.getByRole('button', { name: 'Primary' }).className).toContain('h-6');
    expect(screen.getByRole('button', { name: 'Primary' }).className).toContain(
      "before:content-['']",
    );
    expect(screen.getByRole('button', { name: 'Primary' }).className).toContain(
      'before:-inset-2.5',
    );

    rerender(
      <IconButton aria-label="Ghost" variant="ghost" size="lg" className="x">
        <span>G</span>
      </IconButton>,
    );
    const ghost = screen.getByRole('button', { name: 'Ghost' });
    expect(ghost.className).toContain('text-app-muted');
    expect(ghost.className).toContain('h-12');
    expect(ghost.className).toContain('x');
  });

  it('forwards type and click', () => {
    const onClick = vi.fn();
    renderWithLocale(
      <IconButton aria-label="Submit" type="submit" onClick={onClick}>
        <span>S</span>
      </IconButton>,
    );
    const button = screen.getByRole('button', { name: 'Submit' });
    expect(button.getAttribute('type')).toBe('submit');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('treats an empty className like no className', () => {
    renderWithLocale(
      <IconButton aria-label="Empty" className="">
        <span>E</span>
      </IconButton>,
    );
    expect(screen.getByRole('button', { name: 'Empty' }).className).not.toContain('undefined');
  });
});
