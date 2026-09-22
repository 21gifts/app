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

  it('peeks the next still and shows 1/n plus dots', () => {
    renderWithLocale(<ForumPhotoGallery photos={PHOTOS} alt="Photo from Ada" className="mt-2" />);
    const photos = screen.getAllByAltText('Photo from Ada');
    expect(photos).toHaveLength(2);
    expect(photos[0]?.getAttribute('data-photo-index')).toBe('0');
    expect(photos[1]?.getAttribute('data-photo-index')).toBe('1');
    expect(screen.getByText('1/2')).toBeTruthy();
    const scroller = photos[0]?.parentElement?.parentElement;
    expect(scroller?.contains(photos[1] ?? null)).toBe(true);
    const scrollerTokens = (scroller?.className ?? '').split(/\s+/);
    expect(scrollerTokens).toEqual(
      expect.arrayContaining([
        'flex',
        'snap-x',
        'snap-mandatory',
        'gap-3',
        'overflow-x-auto',
        'overscroll-x-contain',
      ]),
    );
    expect(scrollerTokens).not.toContain('flex-col');
    const firstSlide = (photos[0]?.parentElement?.className ?? '').split(/\s+/);
    const lastSlide = (photos[1]?.parentElement?.className ?? '').split(/\s+/);
    expect(firstSlide).toEqual(
      expect.arrayContaining(['w-[88%]', 'min-w-[88%]', 'shrink-0', 'snap-start']),
    );
    expect(lastSlide).toEqual(
      expect.arrayContaining(['w-full', 'min-w-full', 'shrink-0', 'snap-start']),
    );
    expect(screen.getByRole('button', { name: 'Photo 1 of 2' }).getAttribute('aria-current')).toBe(
      'true',
    );
    expect(
      screen.getByRole('button', { name: 'Photo 2 of 2' }).getAttribute('aria-current'),
    ).toBeNull();
    expect(screen.queryByText('Photo 1 of 2')).toBeNull();
    expect(screen.queryByText('Photo 2 of 2')).toBeNull();
  });

  it('updates the chip when the scroller moves', () => {
    renderWithLocale(<ForumPhotoGallery photos={PHOTOS} alt="Photo from Ada" />);
    const photos = screen.getAllByAltText('Photo from Ada');
    const scroller = photos[0]?.parentElement?.parentElement;
    const slide = photos[0]?.parentElement;
    expect(scroller).toBeTruthy();
    expect(slide).toBeTruthy();
    vi.spyOn(slide as HTMLElement, 'getBoundingClientRect').mockReturnValue({
      width: 200,
      height: 0,
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
      x: 0,
      y: 0,
      toJSON: () => undefined,
    });
    Object.defineProperty(scroller as HTMLElement, 'scrollLeft', {
      configurable: true,
      value: 200,
    });
    fireEvent.scroll(scroller as HTMLElement);
    expect(screen.getByText('2/2')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Photo 2 of 2' }).getAttribute('aria-current')).toBe(
      'true',
    );
  });

  it('ignores scroll when layout has no stride', () => {
    renderWithLocale(<ForumPhotoGallery photos={PHOTOS} alt="Photo from Ada" />);
    const photos = screen.getAllByAltText('Photo from Ada');
    const scroller = photos[0]?.parentElement?.parentElement;
    fireEvent.scroll(scroller as HTMLElement);
    expect(screen.getByText('1/2')).toBeTruthy();
  });

  it('ignores scroll when the scroller has no slides', () => {
    renderWithLocale(<ForumPhotoGallery photos={PHOTOS} alt="Photo from Ada" />);
    const photos = screen.getAllByAltText('Photo from Ada');
    const scroller = photos[0]?.parentElement?.parentElement as HTMLElement;
    scroller.replaceChildren();
    fireEvent.scroll(scroller);
    expect(screen.getByText('1/2')).toBeTruthy();
  });

  it('jumps to a still from a dot and stops the click', () => {
    const onPhotoClick = vi.fn();
    const scrollTo = vi.fn();
    renderWithLocale(
      <ForumPhotoGallery photos={PHOTOS} alt="Photo from Ada" onPhotoClick={onPhotoClick} />,
    );
    const photos = screen.getAllByAltText('Photo from Ada');
    const scroller = photos[0]?.parentElement?.parentElement as HTMLElement;
    const slide = photos[0]?.parentElement as HTMLElement;
    Object.defineProperty(scroller, 'scrollTo', { configurable: true, value: scrollTo });
    vi.spyOn(slide, 'getBoundingClientRect').mockReturnValue({
      width: 200,
      height: 0,
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
      x: 0,
      y: 0,
      toJSON: () => undefined,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Photo 2 of 2' }));
    expect(onPhotoClick).toHaveBeenCalled();
    expect(scrollTo).toHaveBeenCalledWith({ left: 200, behavior: 'smooth' });
    expect(screen.getByText('2/2')).toBeTruthy();
  });

  it('scrolls without smooth motion when reduced motion is preferred', () => {
    const scrollTo = vi.fn();
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
    const scroller = photos[0]?.parentElement?.parentElement as HTMLElement;
    const slide = photos[0]?.parentElement as HTMLElement;
    Object.defineProperty(scroller, 'scrollTo', { configurable: true, value: scrollTo });
    vi.spyOn(slide, 'getBoundingClientRect').mockReturnValue({
      width: 200,
      height: 0,
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
      x: 0,
      y: 0,
      toJSON: () => undefined,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Photo 2 of 2' }));
    expect(scrollTo).toHaveBeenCalledWith({ left: 200, behavior: 'auto' });
  });

  it('does not render dots for a single still', () => {
    renderWithLocale(
      <ForumPhotoGallery photos={[{ index: 0, url: 'blob:g0' }]} alt="Photo from Ada" />,
    );
    expect(screen.getByText('1/1')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Photo 1 of 1' })).toBeNull();
  });

  it('forwards a scroller click and omits extra class when className is empty', () => {
    const onPhotoClick = vi.fn();
    const { container } = renderWithLocale(
      <ForumPhotoGallery
        photos={PHOTOS}
        alt="Photo from Ada"
        className=""
        onPhotoClick={onPhotoClick}
      />,
    );
    expect(container.firstElementChild?.className).toBe('flex flex-col');
    const photos = screen.getAllByAltText('Photo from Ada');
    fireEvent.click(photos[0] as HTMLElement);
    expect(onPhotoClick).toHaveBeenCalled();
  });
});
