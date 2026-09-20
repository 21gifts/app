import { cleanup, fireEvent, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ForumNoteText } from '@/components/ForumNoteText';
import { renderWithLocale } from '@/__tests__/render-with-locale';

afterEach(cleanup);

describe('ForumNoteText', () => {
  it('renders nothing for empty text', () => {
    const { container } = renderWithLocale(<ForumNoteText text="" className="body" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders short text exactly without Show more', () => {
    const { container } = renderWithLocale(
      <ForumNoteText text="Hello from Ada" className="body" />,
    );
    expect(container.querySelector('p')?.textContent).toBe('Hello from Ada');
    expect(screen.getByText('Hello from Ada')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
  });

  it('autolinks an http url in short text', () => {
    renderWithLocale(<ForumNoteText text="see https://example.com/x" className="body" />);
    expect(screen.getByRole('link', { name: 'https://example.com/x' }).getAttribute('href')).toBe(
      'https://example.com/x',
    );
  });

  it('does not autolink a truncated url prefix', () => {
    const href = `https://example.com/${'a'.repeat(300)}`;
    renderWithLocale(<ForumNoteText text={href} className="body" />);
    expect(screen.queryByRole('link')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show more' }));
    expect(screen.getByRole('link', { name: href }).getAttribute('href')).toBe(href);
  });

  it('renders text at the preview limit without Show more', () => {
    const text = 'a'.repeat(280);
    const { container } = renderWithLocale(<ForumNoteText text={text} className="body" />);
    expect(container.querySelector('p')?.textContent).toBe(text);
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
  });

  it('collapses long text with an ellipsis and Show more', () => {
    const { container } = renderWithLocale(
      <ForumNoteText text={`${'a'.repeat(280)} TAILWORD`} className="body" />,
    );
    expect(screen.getByRole('button', { name: 'Show more' })).toBeTruthy();
    expect(screen.queryByText(/TAILWORD/)).toBeNull();
    expect(container.querySelector('p')?.textContent).toContain('…');
  });

  it('uses the German Show more label', () => {
    renderWithLocale(<ForumNoteText text={`${'a'.repeat(280)} TAILWORD`} className="body" />, 'de');
    expect(screen.getByRole('button', { name: 'Mehr anzeigen' })).toBeTruthy();
  });

  it('expands long text in place without Show less', () => {
    renderWithLocale(<ForumNoteText text={`${'a'.repeat(280)} TAILWORD`} className="body" />);
    fireEvent.click(screen.getByRole('button', { name: 'Show more' }));
    expect(screen.getByText(/TAILWORD/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Show less/i })).toBeNull();
  });

  it('renders a short url as plain text when plain', () => {
    renderWithLocale(<ForumNoteText plain text="see https://example.com/hello" className="body" />);
    expect(screen.getByText('see https://example.com/hello')).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('does not autolink a truncated url when plain, including after Show more', () => {
    const href = `https://example.com/${'a'.repeat(300)}`;
    renderWithLocale(<ForumNoteText plain text={href} className="body" />);
    expect(screen.queryByRole('link')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show more' }));
    expect(screen.getByText(href)).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('stops click and keydown events from reaching the parent', () => {
    const onClick = vi.fn();
    const onKeyDown = vi.fn();
    function Parent(): ReactElement {
      return (
        <div onClick={onClick} onKeyDown={onKeyDown}>
          <ForumNoteText text={`${'a'.repeat(280)} TAILWORD`} className="body" />
        </div>
      );
    }
    renderWithLocale(<Parent />);
    const button = screen.getByRole('button', { name: 'Show more' });
    fireEvent.keyDown(button, { key: ' ' });
    fireEvent.keyDown(button, { key: 'Enter' });
    expect(onKeyDown).not.toHaveBeenCalled();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
