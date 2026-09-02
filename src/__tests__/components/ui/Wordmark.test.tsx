import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Wordmark } from '@/components/ui/Wordmark';
import { renderWithLocale } from '@/__tests__/render-with-locale';

afterEach(cleanup);

describe('Wordmark', () => {
  it('renders a link to the given href', () => {
    renderWithLocale(<Wordmark href="/welcome" />);
    const link = screen.getByRole('link', { name: '21.gifts' });
    expect(link.getAttribute('href')).toBe('/welcome');
    expect(link.className).toContain('text-app-fg');
    expect(link.className).toContain('text-[17px]');
  });

  it('renders a span when href is omitted or empty', () => {
    const { rerender } = renderWithLocale(<Wordmark />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('21.gifts').tagName).toBe('SPAN');

    rerender(<Wordmark href="" tone="dark" size="footer" className="x" />);
    const mark = screen.getByText('21.gifts');
    expect(mark.tagName).toBe('SPAN');
    expect(mark.className).toContain('text-paper');
    expect(mark.className).toContain('text-[15px]');
    expect(mark.className).toContain('x');
  });

  it('treats empty className as absent', () => {
    renderWithLocale(<Wordmark href="/" className="" />);
    expect(screen.getByRole('link', { name: '21.gifts' }).className).not.toContain('undefined');
  });
});
