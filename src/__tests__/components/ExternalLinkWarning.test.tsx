import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExternalLinkWarning } from '@/components/ExternalLinkWarning';
import { renderWithLocale } from '@/__tests__/render-with-locale';

afterEach(cleanup);

describe('ExternalLinkWarning', () => {
  it('renders the title, body, url, and labeled Open link', () => {
    renderWithLocale(
      <ExternalLinkWarning
        url="https://example.com/phish"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    const dialog = screen.getByRole('dialog', { name: 'Open external link?' });
    expect(dialog).toBeTruthy();
    expect(dialog.className).toContain('bg-app-overlay');
    expect(dialog.className).not.toContain('bg-black/40');
    expect(screen.getByRole('heading', { name: 'Open external link?' })).toBeTruthy();
    expect(
      screen.getByText('This address is not 21.gifts. Open it only if you trust it.'),
    ).toBeTruthy();
    expect(screen.getByText('https://example.com/phish')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open link' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Open link' })).toBeNull();
  });

  it('calls onConfirm from Open link', () => {
    const onConfirm = vi.fn();
    renderWithLocale(
      <ExternalLinkWarning
        url="https://example.com/phish"
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open link' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel from the icon-only Close control', () => {
    const onCancel = vi.fn();
    renderWithLocale(
      <ExternalLinkWarning
        url="https://example.com/phish"
        onCancel={onCancel}
        onConfirm={vi.fn()}
      />,
    );
    const close = screen.getByRole('button', { name: 'Close' });
    expect(screen.queryByText('Close')).toBeNull();
    fireEvent.click(close);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('stops clicks on the dialog from bubbling', () => {
    const parentClick = vi.fn();
    renderWithLocale(
      <div onClick={parentClick}>
        <ExternalLinkWarning
          url="https://example.com/phish"
          onCancel={vi.fn()}
          onConfirm={vi.fn()}
        />
      </div>,
    );
    fireEvent.click(screen.getByRole('dialog', { name: 'Open external link?' }));
    expect(parentClick).not.toHaveBeenCalled();
  });

  it('stops keydown on the dialog so a parent card does not toggle', () => {
    const parentKey = vi.fn();
    renderWithLocale(
      <div onKeyDown={parentKey}>
        <ExternalLinkWarning
          url="https://example.com/phish"
          onCancel={vi.fn()}
          onConfirm={vi.fn()}
        />
      </div>,
    );
    fireEvent.keyDown(screen.getByRole('button', { name: 'Open link' }), { key: 'Enter' });
    expect(parentKey).not.toHaveBeenCalled();
  });
});
