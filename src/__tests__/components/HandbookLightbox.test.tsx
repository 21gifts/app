import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HandbookLightbox } from '@/components/HandbookLightbox';
import { renderWithLocale } from '@/__tests__/render-with-locale';

afterEach(cleanup);

describe('HandbookLightbox', () => {
  it('renders nothing when closed', () => {
    const { container } = renderWithLocale(
      <HandbookLightbox open={false} src="/handbook-images/x.png" alt="Shot" onClose={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows the dialog image and focuses the close control when open', () => {
    renderWithLocale(
      <HandbookLightbox open src="/handbook-images/x.png" alt="Shot" onClose={vi.fn()} />,
    );
    expect(screen.getByRole('dialog', { name: 'Shot' })).toBeTruthy();
    const img = screen.getByAltText('Shot') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('/handbook-images/x.png');
    const close = screen.getByRole('button', { name: 'Close image' });
    expect(close).toBeTruthy();
    expect(document.activeElement).toBe(close);
    expect(screen.queryByText('Close image')).toBeNull();
  });

  it('closes via the X button', () => {
    const onClose = vi.fn();
    renderWithLocale(
      <HandbookLightbox open src="/handbook-images/x.png" alt="Shot" onClose={onClose} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close image' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes via backdrop click and ignores panel clicks', () => {
    const onClose = vi.fn();
    renderWithLocale(
      <HandbookLightbox open src="/handbook-images/x.png" alt="Shot" onClose={onClose} />,
    );
    fireEvent.click(screen.getByAltText('Shot'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape and ignores other keys', () => {
    const onClose = vi.fn();
    renderWithLocale(
      <HandbookLightbox open src="/handbook-images/x.png" alt="Shot" onClose={onClose} />,
    );
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows previous and next controls when gallery callbacks are set', () => {
    const onPrevious = vi.fn();
    const onNext = vi.fn();
    renderWithLocale(
      <HandbookLightbox
        open
        src="/handbook-images/x.png"
        alt="Shot"
        onClose={vi.fn()}
        onPrevious={onPrevious}
        onNext={onNext}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Previous screen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next screen' }));
    expect(onPrevious).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Previous screen')).toBeNull();
    expect(screen.queryByText('Next screen')).toBeNull();
  });

  it('removes the Escape listener when closed', () => {
    const onClose = vi.fn();
    const { unmount } = renderWithLocale(
      <HandbookLightbox open src="/handbook-images/x.png" alt="Shot" onClose={onClose} />,
    );
    unmount();
    renderWithLocale(
      <HandbookLightbox open={false} src="/handbook-images/x.png" alt="Shot" onClose={onClose} />,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });
});
