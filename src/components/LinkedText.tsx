'use client';

import Link from 'next/link';
import { useState, type MouseEvent, type ReactElement, type ReactNode } from 'react';
import { ExternalLinkWarning } from '@/components/ExternalLinkWarning';
import { openInSystemBrowser } from '@/lib/in-app-browser';
import { splitNoteLinks } from '@/lib/note-links';

const DEFAULT_LINK_CLASS = 'font-medium underline underline-offset-2';

/** Props for {@link LinkedText}. */
export interface LinkedTextProps {
  /** Raw display body that may contain http(s) URLs. */
  text: string;
  /** Classes for the wrapping paragraph. */
  className: string;
  /** Extra classes on each link. Default: underline, inherit colour. */
  linkClassName?: string;
  /** Override origin for tests. Default: `window.location.origin` when present. */
  currentOrigin?: string;
  /** Nodes after the linked runs (Show more). */
  suffix?: ReactNode;
}

/**
 * Render a note body with clickable http(s) URLs.
 *
 * Internal 21.gifts URLs are in-app `Link`s. External URLs open
 * {@link ExternalLinkWarning} first.
 *
 * @param props - See {@link LinkedTextProps}.
 * @returns The paragraph plus an optional confirm overlay.
 */
export function LinkedText({ text, className, ...rest }: LinkedTextProps): ReactElement {
  const origin =
    rest.currentOrigin ??
    /* v8 ignore next -- SSR has no window; tests run in jsdom */
    (typeof window === 'undefined' ? undefined : window.location.origin);
  const linkClassName = rest.linkClassName ?? DEFAULT_LINK_CLASS;
  const segments = origin === undefined ? splitNoteLinks(text) : splitNoteLinks(text, origin);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const stopToggle = (event: MouseEvent): void => {
    event.stopPropagation();
  };

  const onExternalClick = (event: MouseEvent<HTMLAnchorElement>, href: string): void => {
    event.stopPropagation();
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    setPendingHref(href);
  };

  const openPending = (): void => {
    const href = pendingHref;
    setPendingHref(null);
    /* v8 ignore next 3 -- overlay only mounts when pendingHref is set */
    if (href === null) {
      return;
    }
    if (href.startsWith('https://')) {
      openInSystemBrowser(href);
      return;
    }
    /* v8 ignore next 3 -- jsdom always has window; SSR cannot confirm a click */
    if (typeof window !== 'undefined') {
      window.open(href, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <>
      <p className={className}>
        {segments.map((segment, index) => {
          if (segment.kind === 'text') {
            return <span key={`t-${String(index)}`}>{segment.value}</span>;
          }
          if (segment.internal) {
            return (
              <Link
                key={`u-${String(index)}`}
                href={segment.path}
                className={linkClassName}
                onClick={stopToggle}
              >
                {segment.value}
              </Link>
            );
          }
          return (
            <a
              key={`u-${String(index)}`}
              href={segment.href}
              rel="noopener noreferrer"
              className={linkClassName}
              onClick={(event) => {
                onExternalClick(event, segment.href);
              }}
            >
              {segment.value}
            </a>
          );
        })}
        {rest.suffix}
      </p>
      {pendingHref !== null ? (
        <ExternalLinkWarning
          url={pendingHref}
          onCancel={() => {
            setPendingHref(null);
          }}
          onConfirm={openPending}
        />
      ) : null}
    </>
  );
}
