import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ForumPhotoGallery } from '@/components/ForumPhotoGallery';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const PHOTOS = [
  { index: 0, url: 'blob:g0' },
  { index: 1, url: 'blob:g1' },
];

describe('ForumPhotoGallery', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('returns null when there are no stills', () => {
    const { container } = renderWithLocale(<ForumPhotoGallery photos={[]} alt="Photo from Ada" />);
    expect(container.querySelector('img')).toBeNull();
  });

  it('stacks stills in the page and shows 1/n plus dots', () => {
    const { container } = renderWithLocale(
      <ForumPhotoGallery photos={PHOTOS} alt="Photo from Ada" className="mt-2" />,
    );
    const photos = screen.getAllByAltText('Photo from Ada');
    expect(photos).toHaveLength(2);
    expect(photos[0]?.getAttribute('data-photo-index')).toBe('0');
    expect(photos[1]?.getAttribute('data-photo-index')).toBe('1');
    expect(screen.getByText('1/2')).toBeTruthy();
    expect(container.querySelector('[class*="overflow-"]')).toBeNull();
    const still = (photos[0]?.className ?? '').split(/\s+/);
    expect(still).toEqual(
      expect.arrayContaining([
        'block',
        'h-auto',
        'max-h-80',
        'w-full',
        'shrink-0',
        'rounded-xl',
        'object-contain',
      ]),
    );
    expect(photos[0]?.parentElement?.className).toContain('flex-col');
    expect(screen.getByRole('button', { name: 'Photo 1 of 2' }).getAttribute('aria-current')).toBe(
      'true',
    );
    expect(
      screen.getByRole('button', { name: 'Photo 2 of 2' }).getAttribute('aria-current'),
    ).toBeNull();
    expect(screen.queryByText('Photo 1 of 2')).toBeNull();
    expect(screen.queryByText('Photo 2 of 2')).toBeNull();
  });

  it('moves the page scrollport to a still from a dot and stops the click', () => {
    const onPhotoClick = vi.fn();
    const scrollIntoView = vi.fn();
    renderWithLocale(
      <ForumPhotoGallery photos={PHOTOS} alt="Photo from Ada" onPhotoClick={onPhotoClick} />,
    );
    const photos = screen.getAllByAltText('Photo from Ada');
    Object.defineProperty(photos[1] as HTMLElement, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Photo 2 of 2' }));
    expect(onPhotoClick).toHaveBeenCalled();
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', behavior: 'smooth' });
    expect(screen.getByText('2/2')).toBeTruthy();
  });

  it('moves without smooth motion when reduced motion is preferred', () => {
    const scrollIntoView = vi.fn();
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({
          matches: query.includes('prefers-reduced-motion: reduce'),
          media: query,
          onchange: null,
          addListener: () => undefined,
          removeListener: () => undefined,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
          dispatchEvent: () => false,
        }) as MediaQueryList,
    );
    renderWithLocale(<ForumPhotoGallery photos={PHOTOS} alt="Photo from Ada" />);
    const photos = screen.getAllByAltText('Photo from Ada');
    Object.defineProperty(photos[1] as HTMLElement, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Photo 2 of 2' }));
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', behavior: 'auto' });
  });

  it('does not render dots for a single still', () => {
    renderWithLocale(
      <ForumPhotoGallery photos={[{ index: 0, url: 'blob:g0' }]} alt="Photo from Ada" />,
    );
    expect(screen.getByText('1/1')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Photo 1 of 1' })).toBeNull();
  });

  it('forwards a still click and omits extra class when className is empty', () => {
    const onPhotoClick = vi.fn();
    const { container } = renderWithLocale(
      <ForumPhotoGallery
        photos={PHOTOS}
        alt="Photo from Ada"
        className=""
        onPhotoClick={onPhotoClick}
      />,
    );
    expect(container.firstElementChild?.className).toBe('flex w-full flex-col');
    const photos = screen.getAllByAltText('Photo from Ada');
    fireEvent.click(photos[0] as HTMLElement);
    expect(onPhotoClick).toHaveBeenCalled();
  });
});
