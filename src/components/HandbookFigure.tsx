'use client';

import { useEffect, useRef, useState, type ReactElement } from 'react';
import { HandbookCopyLink } from '@/components/HandbookCopyLink';
import { HandbookLightbox } from '@/components/HandbookLightbox';
import { useTranslations } from '@/components/LocaleProvider';

/** Props for {@link HandbookFigure}. */
export interface HandbookFigureProps {
  /** Stable DOM / hash id (without `#`). */
  id: string;
  /** Visible permalink label and copy-link aria name. */
  label: string;
  /** Short English description under the preview. */
  description: string;
  /** Preview / lightbox image URL. */
  src: string;
  /** Image alt text. */
  alt: string;
}

/**
 * Compact handbook image card: permalink + copy-link, ~220px preview that opens
 * {@link HandbookLightbox}, and a written description. Scrolls into view when
 * `location.hash` matches `#id`.
 *
 * @param props - See {@link HandbookFigureProps}.
 * @returns The figure card.
 */
export function HandbookFigure({
  id,
  label,
  description,
  src,
  alt,
}: HandbookFigureProps): ReactElement {
  const { t } = useTranslations();
  const [open, setOpen] = useState(false);
  const articleRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const scrollIfMatch = (): void => {
      if (window.location.hash === `#${id}`) {
        articleRef.current?.scrollIntoView({ block: 'start' });
      }
    };
    scrollIfMatch();
    window.addEventListener('hashchange', scrollIfMatch);
    return () => {
      window.removeEventListener('hashchange', scrollIfMatch);
    };
  }, [id]);

  const openLabel = t('handbook.openImage', { label });

  return (
    <article
      ref={articleRef}
      id={id}
      className="scroll-mt-24 target:outline target:outline-2 target:outline-offset-[-1px] target:outline-accent overflow-hidden rounded-lg border border-app-border bg-app-card"
    >
      <div className="flex flex-wrap items-baseline gap-2 px-3 pt-3">
        <a href={`#${id}`} className="font-semibold text-app-fg">
          {label}
        </a>
        <HandbookCopyLink targetId={id} label={label} />
      </div>
      <div className="flex justify-center px-3 py-3">
        <button
          type="button"
          aria-label={openLabel}
          className="rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          onClick={() => {
            setOpen(true);
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- static handbook baseline PNG */}
          <img
            src={src}
            alt={alt}
            className="h-auto max-w-[220px] rounded-md border border-app-border"
          />
        </button>
      </div>
      <p className="px-3 pb-3 text-sm text-app-muted">{description}</p>
      <HandbookLightbox
        open={open}
        src={src}
        alt={alt}
        onClose={() => {
          setOpen(false);
        }}
      />
    </article>
  );
}
