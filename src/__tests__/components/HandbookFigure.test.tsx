import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HandbookFigure } from '@/components/HandbookFigure';
import { renderWithLocale } from '@/__tests__/render-with-locale';

afterEach(() => {
  cleanup();
  window.location.hash = '';
});

describe('HandbookFigure', () => {
  it('renders label, description, preview, and copy-link without a visible open string', () => {
    renderWithLocale(
      <HandbookFigure
        id="root-default"
        label="/ default"
        description="Desktop wide layout."
        src="/handbook-images/screen-root-desktop-light.png"
        alt="/ default"
      />,
    );
    const article = document.getElementById('root-default');
    expect(article).toBeTruthy();
    expect(screen.getByRole('link', { name: '/ default' }).getAttribute('href')).toBe(
      '#root-default',
    );
    expect(screen.getByText('Desktop wide layout.')).toBeTruthy();
    expect(screen.getByAltText('/ default')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy link to / default' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open / default at full size' })).toBeTruthy();
    expect(screen.queryByText('Open / default at full size')).toBeNull();
  });

  it('opens the lightbox from the preview and closes it', () => {
    renderWithLocale(
      <HandbookFigure
        id="welcome-pay-qr"
        label="/welcome pay-qr"
        description="Pay QR sheet."
        src="/handbook-images/state-welcome-pay-qr-desktop-light.png"
        alt="/welcome pay-qr"
      />,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open /welcome pay-qr at full size' }));
    expect(screen.getByRole('dialog', { name: '/welcome pay-qr' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close image' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('scrolls into view on mount when the hash matches', () => {
    const scrollIntoView = vi.fn();
    window.location.hash = '#root-default';
    const original = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    try {
      renderWithLocale(
        <HandbookFigure
          id="root-default"
          label="/ default"
          description="Desc"
          src="/handbook-images/x.png"
          alt="/ default"
        />,
      );
      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
    } finally {
      HTMLElement.prototype.scrollIntoView = original;
    }
  });

  it('scrolls into view on hashchange when the hash matches', () => {
    const scrollIntoView = vi.fn();
    const original = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    try {
      renderWithLocale(
        <HandbookFigure
          id="root-default"
          label="/ default"
          description="Desc"
          src="/handbook-images/x.png"
          alt="/ default"
        />,
      );
      scrollIntoView.mockClear();
      window.location.hash = '#root-default';
      fireEvent(window, new Event('hashchange'));
      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
    } finally {
      HTMLElement.prototype.scrollIntoView = original;
    }
  });

  it('calls onOpen instead of opening a local lightbox', () => {
    const onOpen = vi.fn();
    renderWithLocale(
      <HandbookFigure
        id="root-default"
        label="/ default"
        description="Desc"
        src="/handbook-images/x.png"
        alt="/ default"
        onOpen={onOpen}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open / default at full size' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('does not scroll when the hash targets another id', () => {
    const scrollIntoView = vi.fn();
    window.location.hash = '#other';
    const original = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    try {
      renderWithLocale(
        <HandbookFigure
          id="root-default"
          label="/ default"
          description="Desc"
          src="/handbook-images/x.png"
          alt="/ default"
        />,
      );
      expect(scrollIntoView).not.toHaveBeenCalled();
    } finally {
      HTMLElement.prototype.scrollIntoView = original;
    }
  });
});
