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
 * is ready and offers **Reload**, a full page load, because only that loads the
 * new build. Nobody is signed in on these surfaces, so the reload loses no
 * wallet held in the tab.
 *
 * @param props - `kind`: which refusal to show.
 * @returns The notice.
 */
export function LoginBlockedNotice({ kind }: { kind: 'closed' | 'outdated' }): ReactElement {
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
      <Button
        type="button"
        onClick={() => {
          window.location.reload();
        }}
      >
        {t('login.reload')}
      </Button>
    </>
  );
}
