'use client';

import { Clock, RefreshCw } from 'lucide-react';
import type { ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { Button } from '@/components/ui';

/**
 * Why the api refused to create a session: operators closed logins for an
 * update (`closed`), or this tab still runs an older app build (`outdated`).
 *
 * `closed` is a calm status line and offers nothing to press: nothing retries
 * on its own, and the visitor comes back later. `outdated` says a new version
 * is ready and, in the login card and the profile claim, offers **Reload**, a
 * full page load, because only that loads the new build. Nobody is signed in
 * on these surfaces, so the reload loses no wallet held in the tab. Without
 * `reload` (the signed-out recovery on `/recover`, which is not one of the
 * surfaces that may reload the document) it is the status line only.
 *
 * @param props - `kind`: which refusal to show; `reload`: whether `outdated`
 *   offers **Reload** (default `true`).
 * @returns The notice.
 */
export function LoginBlockedNotice({
  kind,
  reload = true,
}: {
  kind: 'closed' | 'outdated';
  reload?: boolean;
}): ReactElement {
  const { t } = useTranslations();
  if (kind === 'closed') {
    return (
      <>
        <Clock aria-hidden="true" className="h-8 w-8 text-app-subtle" />
        <p role="status" className="max-w-sm text-center text-sm text-app-muted">
          {t('login.closed')}
        </p>
      </>
    );
  }
  return (
    <>
      <RefreshCw aria-hidden="true" className="h-8 w-8 text-app-subtle" />
      <p role="status" className="max-w-sm text-center text-sm font-medium text-app-fg">
        {t('login.outdated')}
      </p>
      {reload ? (
        <Button
          type="button"
          onClick={() => {
            window.location.reload();
          }}
        >
          {t('login.reload')}
        </Button>
      ) : null}
    </>
  );
}
