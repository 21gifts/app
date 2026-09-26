'use client';

import { useSyncExternalStore, type ReactElement, type ReactNode } from 'react';
import { useTranslations } from '@/components/LocaleProvider';

function subscribe(onStoreChange: () => void): () => void {
  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-local-sunday'],
  });
  return () => {
    observer.disconnect();
  };
}

function localSundaySnapshot(): boolean {
  return document.documentElement.dataset['localSunday'] === '1';
}

/** Device-local Sunday, false during server render and until the head script runs. */
export function useLocalSunday(): boolean {
  return useSyncExternalStore(subscribe, localSundaySnapshot, () => false);
}

/**
 * Public write slot. On the device's local Sunday the field is removed and a
 * sentence is shown instead. The head script sets the flag before paint.
 */
export function SundayWritingGate({
  children,
  notice = 'write',
}: {
  children: ReactNode;
  /** `zap` replaces a forum gift control. `write` replaces a public composer. */
  notice?: 'write' | 'zap';
}): ReactElement {
  const { t } = useTranslations();
  const sunday = useLocalSunday();
  if (!sunday) {
    return <div className="sunday-write-field">{children}</div>;
  }
  return (
    <>
      <p
        className="sunday-write-notice text-sm leading-relaxed text-app-muted"
        data-sunday-writing="paused"
      >
        {t(notice === 'zap' ? 'sunday.zappingPaused' : 'sunday.writingPaused')}
      </p>
      <div className="sunday-write-field">{children}</div>
    </>
  );
}
