'use client';

import type { ReactElement } from 'react';
import { Wordmark } from '@/components/ui/Wordmark';
import { FORUM_HOME_EVENT } from '@/lib/forum-feed';

/**
 * Welcome-page wordmark that asks the forum loader to return home in place.
 *
 * @returns A linked `21.gifts` wordmark that dispatches the forum home event.
 */
export function ForumHomeWordmark(): ReactElement {
  return (
    <Wordmark
      href="/welcome"
      onClick={(event) => {
        event.preventDefault();
        window.dispatchEvent(new Event(FORUM_HOME_EVENT));
      }}
    />
  );
}
