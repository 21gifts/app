'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import { ExternalLinkWarning } from '@/components/ExternalLinkWarning';
import { useTranslations } from '@/components/LocaleProvider';
import { openInSystemBrowser } from '@/lib/in-app-browser';
import { splitNoteLinks } from '@/lib/note-links';

const USERNAME_CHAR = /[A-Za-z0-9._-]/;

/** One `@username` the signed-in payload resolved to a member. */
export interface TextMention {
  username: string;
  accountId: string;
}

function MentionButton({ accountId, text }: { accountId: string; text: string }): ReactElement {
  const router = useRouter();
  const { t } = useTranslations();
  return (
    <button
      type="button"
      aria-label={t('forum.authorProfile')}
      className="text-sm font-medium text-app-fg underline underline-offset-2"
      onClick={(event) => {
        event.stopPropagation();
        router.push(`/members/${accountId}`);
      }}
    >
      {text}
    </button>
  );
}

function mentionNodes(value: string, mentions: readonly TextMention[]): ReactNode {
  const byName = new Map(mentions.map((mention) => [mention.username.toLowerCase(), mention.accountId]));
  const nodes: ReactNode[] = [];
  let buf = '';
  let index = 0;
  const flush = (): void => {
    if (buf === '') {
      return;
    }
    nodes.push(<span key={`t-${String(index)}`}>{buf}</span>);
    buf = '';
    index += 1;
  };
  let i = 0;
  while (i < value.length) {
    const prev = i === 0 ? '' : value.charAt(i - 1);
    if (value.charAt(i) === '@' && (i === 0 || !USERNAME_CHAR.test(prev))) {
      let end = i + 1;
      while (end < value.length && USERNAME_CHAR.test(value.charAt(end))) {
        end += 1;
      }
      const token = value.slice(i + 1, end);
      const accountId = token === '' ? undefined : byName.get(token.toLowerCase());
      if (accountId !== undefined) {
        flush();
        nodes.push(<MentionButton key={`m-${String(i)}`} accountId={accountId} text={value.slice(i, end)} />);
        i = end;
        continue;
      }
    }
    buf += value.charAt(i);
    i += 1;
  }
  flush();
  return nodes;
}

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
  /** When true, render `text` as one span with no autolinks. */
  plain?: boolean;
  /** Member marks to link. Omitted when the author name is not a member button. */
  mentions?: readonly TextMention[];
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
export function LinkedText({
  text,
  className,
  plain = false,
  mentions,
  ...rest
}: LinkedTextProps): ReactElement {
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const linked = mentions !== undefined && mentions.length > 0;

  if (plain) {
    return (
      <p className={className}>
        {linked ? mentionNodes(text, mentions) : <span>{text}</span>}
        {rest.suffix}
      </p>
    );
  }

  const origin =
    rest.currentOrigin ??
    /* v8 ignore next -- SSR has no window; tests run in jsdom */
    (typeof window === 'undefined' ? undefined : window.location.origin);
  const linkClassName = rest.linkClassName ?? DEFAULT_LINK_CLASS;
  const segments = origin === undefined ? splitNoteLinks(text) : splitNoteLinks(text, origin);

  const stopToggle = (event: { stopPropagation: () => void }): void => {
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

  const onExternalKeyDown = (event: KeyboardEvent<HTMLAnchorElement>, href: string): void => {
    event.stopPropagation();
    if (event.key !== 'Enter' && event.key !== ' ') {
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
            return linked ? (
              <span key={`t-${String(index)}`}>{mentionNodes(segment.value, mentions)}</span>
            ) : (
              <span key={`t-${String(index)}`}>{segment.value}</span>
            );
          }
          if (segment.internal) {
            return (
              <Link
                key={`u-${String(index)}`}
                href={segment.path}
                className={linkClassName}
                onClick={stopToggle}
                onKeyDown={stopToggle}
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
              onKeyDown={(event) => {
                onExternalKeyDown(event, segment.href);
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
