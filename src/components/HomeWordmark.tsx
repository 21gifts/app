'use client';

import type { MouseEventHandler, ReactElement } from 'react';
import { Wordmark, type WordmarkSize, type WordmarkTone } from '@/components/ui/Wordmark';
import { useHydrateSession } from '@/hooks/useHydrateSession';
import { useAuthStore } from '@/stores/auth-store';

/** Props for {@link HomeWordmark}. */
export interface HomeWordmarkProps {
  /** App foreground or paper-on-ink. Default `app`. */
  tone?: WordmarkTone;
  /** Header 17px or footer 15px. Default `header`. */
  size?: WordmarkSize;
  /** Extra classes. */
  className?: string;
  /** Link click handler. */
  onClick?: MouseEventHandler<HTMLAnchorElement>;
}

/**
 * Session-aware wordmark: `/welcome` when signed in, `/` otherwise.
 *
 * @param props - See {@link HomeWordmarkProps}.
 * @returns The linked `21.gifts` wordmark.
 */
export function HomeWordmark(props: HomeWordmarkProps): ReactElement {
  const { ready } = useHydrateSession();
  const session = useAuthStore((state) => state.session);
  const href = ready && session !== null ? '/welcome' : '/';
  return (
    <Wordmark
      href={href}
      {...(props.tone !== undefined ? { tone: props.tone } : {})}
      {...(props.size !== undefined ? { size: props.size } : {})}
      {...(props.className !== undefined ? { className: props.className } : {})}
      {...(props.onClick !== undefined ? { onClick: props.onClick } : {})}
    />
  );
}
