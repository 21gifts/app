'use client';

import { Bell } from 'lucide-react';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { disablePush, enablePush, isIosSafari, isStandaloneDisplay } from '@/lib/push';
import { useAuthStore } from '@/stores/auth-store';

type PushTogglePhase = 'checking' | 'unsupported' | 'ready';

/**
 * Icon-only Bell control on the signed-in profile card to enable or disable
 * Web Push. Renders nothing without a session or when Push/Service Worker APIs
 * are missing. On iPhone Safari outside standalone, also shows an install hint.
 *
 * @returns The bell button (and optional iOS hint), or `null`.
 */
export function PushToggle(): ReactElement | null {
  const { t } = useTranslations();
  const session = useAuthStore((state) => state.session);
  const [phase, setPhase] = useState<PushTogglePhase>('checking');
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showInstallHint, setShowInstallHint] = useState(false);
  const [errorKey, setErrorKey] = useState<'profile.push.unavailable' | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function inspect(): Promise<void> {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        if (!cancelled) {
          setPhase('unsupported');
        }
        return;
      }
      const iosHint = isIosSafari() && !isStandaloneDisplay();
      try {
        const registration = await navigator.serviceWorker.getRegistration('/');
        const subscription =
          registration === undefined ? null : await registration.pushManager.getSubscription();
        if (!cancelled) {
          setShowInstallHint(iosHint);
          setSubscribed(subscription !== null);
          setPhase('ready');
        }
      } catch {
        if (!cancelled) {
          setShowInstallHint(iosHint);
          setSubscribed(false);
          setPhase('ready');
        }
      }
    }

    void inspect();
    return () => {
      cancelled = true;
    };
  }, []);

  const onToggle = useCallback(async (): Promise<void> => {
    if (session === null || busy) {
      return;
    }
    setBusy(true);
    setErrorKey(null);
    try {
      if (subscribed) {
        await disablePush(session);
        setSubscribed(false);
      } else {
        await enablePush(session);
        setSubscribed(true);
      }
    } catch {
      setErrorKey('profile.push.unavailable');
    } finally {
      setBusy(false);
    }
  }, [busy, session, subscribed]);

  if (session === null) {
    return null;
  }
  if (phase === 'checking' || phase === 'unsupported') {
    return null;
  }

  const ariaName = subscribed ? t('profile.push.disable') : t('profile.push.enable');

  return (
    <div className="flex w-full flex-col items-stretch gap-2">
      {showInstallHint ? (
        <p className="text-sm text-neutral-500">{t('profile.push.installHint')}</p>
      ) : null}
      {errorKey !== null ? <p className="text-sm text-neutral-500">{t(errorKey)}</p> : null}
      <div className="flex w-full justify-end">
        <button
          type="button"
          onClick={() => {
            void onToggle();
          }}
          disabled={busy}
          aria-label={ariaName}
          title={ariaName}
          aria-pressed={subscribed}
          className="inline-flex items-center shrink-0 rounded px-1.5 py-0.5 text-xs leading-none text-neutral-400 transition hover:text-neutral-900 disabled:opacity-50"
        >
          <Bell aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
