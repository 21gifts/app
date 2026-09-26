'use client';

import { useRef, useState, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { IconButton } from '@/components/ui';

/** One loaded still in {@link ForumPhotoGallery}. */
export type ForumPhotoGalleryItem = {
  /** Original still index (`data-photo-index`). */
  index: number;
  /** Object/blob URL. */
  url: string;
};

/** Props for {@link ForumPhotoGallery}. */
export type ForumPhotoGalleryProps = {
  /** Loaded stills in display order. */
  photos: ReadonlyArray<ForumPhotoGalleryItem>;
  /** Shared `<img>` alt. */
  alt: string;
  /** Extra classes on the outer wrap (ForumBoard passes `mt-2`). */
  className?: string;
  /** Stop card expand/collapse when tapping or keying the gallery. */
  onPhotoClick?: (event: { stopPropagation(): void }) => void;
};

/**
 * Scroll behavior for moving a still into the page scrollport.
 *
 * @returns CSSOM `ScrollBehavior` for `Element.scrollIntoView`.
 */
function galleryScrollBehavior(): ScrollBehavior {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return 'auto';
  }
  return 'smooth';
}

/**
 * Stills stacked in the page scrollport. No nested scroller. Dots move that
 * one scrollport to the still. A `current/total` chip sits on the stack.
 *
 * @param props - See {@link ForumPhotoGalleryProps}.
 * @returns The gallery, or `null` when `photos` is empty.
 */
export function ForumPhotoGallery({
  photos,
  alt,
  className,
  onPhotoClick,
}: ForumPhotoGalleryProps): ReactElement | null {
  const { t } = useTranslations();
  const stillRefs = useRef<Array<HTMLImageElement | null>>([]);
  const [active, setActive] = useState(0);

  if (photos.length === 0) {
    return null;
  }

  const extra = className === undefined || className === '' ? '' : ` ${className}`;

  return (
    <div className={`flex w-full flex-col${extra}`} onClick={onPhotoClick} onKeyDown={onPhotoClick}>
      <div className="relative flex w-full flex-col gap-3">
        {photos.map(({ index, url }, i) => (
          // eslint-disable-next-line @next/next/no-img-element -- blob/object URLs from message photo fetches
          <img
            key={`${index}:${url}`}
            ref={(node) => {
              stillRefs.current[i] = node;
            }}
            src={url}
            alt={alt}
            className="block h-auto max-h-80 w-full shrink-0 rounded-xl object-contain"
            data-photo-index={index}
          />
        ))}
        <div
          className="pointer-events-none absolute right-2 top-2 rounded-full bg-app-card-muted/90 px-2 py-0.5 text-xs font-medium tabular-nums lining-nums text-app-fg"
          aria-hidden="true"
        >
          {t('forum.galleryPosition', { current: active + 1, total: photos.length })}
        </div>
      </div>
      {photos.length > 1 ? (
        <div className="mt-2 flex justify-center gap-5">
          {photos.map((photo, i) => (
            <IconButton
              key={photo.index}
              size="sm"
              variant="ghost"
              aria-label={t('forum.galleryDot', { current: i + 1, total: photos.length })}
              aria-current={i === active ? true : undefined}
              onClick={() => {
                setActive(i);
                stillRefs.current[i]?.scrollIntoView({
                  block: 'nearest',
                  behavior: galleryScrollBehavior(),
                });
              }}
            >
              <span
                aria-hidden="true"
                className={`block h-1.5 rounded-full ${i === active ? 'w-4 bg-app-fg' : 'w-1.5 bg-app-muted'}`}
              />
            </IconButton>
          ))}
        </div>
      ) : null}
    </div>
  );
}
