'use client';

import { useCallback, useRef, useState, type ReactElement, type UIEvent } from 'react';
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
  /**
   * Civil capture times aligned with still index. Missing or null slots
   * draw no caption. Never falls back to another still.
   */
  takenAts?: ReadonlyArray<string | null>;
};

/**
 * Instant scroll when the visitor prefers reduced motion.
 *
 * @returns CSSOM `ScrollBehavior` for `Element.scrollTo`.
 */
function galleryScrollBehavior(): ScrollBehavior {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return 'auto';
  }
  return 'smooth';
}

/**
 * Horizontal stride of one snap slide including the scroller gap.
 *
 * @param scroller - Overflow row.
 * @returns Width plus gap, or `0` when layout is not ready.
 */
function slideStride(scroller: HTMLElement): number {
  const slide = scroller.firstElementChild;
  if (!(slide instanceof HTMLElement)) {
    return 0;
  }
  const gap = Number.parseFloat(getComputedStyle(scroller).gap) || 0;
  return slide.getBoundingClientRect().width + gap;
}

/**
 * Stored civil capture time with `T` shown as a space.
 *
 * @param value - API `photoTakenAt` string, or null/undefined.
 * @returns Display text, or `null` when the value is missing or not civil time.
 */
export function civilTakenLabel(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}([+-]\d{2}:\d{2})?$/.test(value)) {
    return null;
  }
  return value.replace('T', ' ');
}

/**
 * Horizontal snap gallery for a note with more than one still: earlier slides
 * are 88% wide so the next photo peeks; the last slide is full width so it can
 * sit flush at snap-start. A `current/total` chip sits on the visible still,
 * and dots jump to a still.
 *
 * @param props - See {@link ForumPhotoGalleryProps}.
 * @returns The gallery, or `null` when `photos` is empty.
 */
export function ForumPhotoGallery({
  photos,
  alt,
  className,
  onPhotoClick,
  takenAts,
}: ForumPhotoGalleryProps): ReactElement | null {
  const { t } = useTranslations();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const updateActive = useCallback(
    (scroller: HTMLElement) => {
      const stride = slideStride(scroller);
      if (stride <= 0) {
        return;
      }
      const next = Math.min(
        photos.length - 1,
        Math.max(0, Math.round(scroller.scrollLeft / stride)),
      );
      setActive(next);
    },
    [photos.length],
  );

  if (photos.length === 0) {
    return null;
  }

  const extra = className === undefined || className === '' ? '' : ` ${className}`;
  const activeStill = photos[Math.min(active, photos.length - 1)] as ForumPhotoGalleryItem;
  const takenLabel = civilTakenLabel(takenAts?.[activeStill.index]);

  return (
    <div className={`flex flex-col${extra}`} onClick={onPhotoClick} onKeyDown={onPhotoClick}>
      <div className="relative">
        <div
          ref={scrollerRef}
          className="flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain"
          onScroll={(event: UIEvent<HTMLDivElement>) => {
            updateActive(event.currentTarget);
          }}
        >
          {photos.map(({ index, url }, i) => (
            <div
              key={`${index}:${url}`}
              className={`shrink-0 snap-start ${i === photos.length - 1 ? 'w-full min-w-full' : 'w-[88%] min-w-[88%]'}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- blob/object URLs from message photo fetches */}
              <img
                src={url}
                alt={alt}
                className="max-h-80 w-full rounded-xl object-contain"
                data-photo-index={index}
              />
            </div>
          ))}
        </div>
        <div
          className="pointer-events-none absolute right-2 top-2 rounded-full bg-app-card-muted/90 px-2 py-0.5 text-xs font-medium tabular-nums lining-nums text-app-fg"
          aria-hidden="true"
        >
          {t('forum.galleryPosition', { current: active + 1, total: photos.length })}
        </div>
      </div>
      {takenLabel !== null ? (
        <p className="mt-1 text-xs text-app-muted">
          {t('forum.photoTakenAt', { time: takenLabel })}
        </p>
      ) : null}
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
                const scroller = scrollerRef.current;
                /* v8 ignore next 3 -- dots only render beside the scroller */
                if (scroller === null) {
                  return;
                }
                const stride = slideStride(scroller);
                const left = stride * i;
                if (typeof scroller.scrollTo === 'function') {
                  scroller.scrollTo({ left, behavior: galleryScrollBehavior() });
                } else {
                  scroller.scrollLeft = left;
                }
                setActive(i);
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
