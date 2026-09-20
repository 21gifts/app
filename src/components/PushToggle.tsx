'use client';

import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { SegmentedControl } from '@/components/ui';
import { postNotificationLevel } from '@/lib/api';
import { accountNotificationLevel, type NotificationLevel } from '@/lib/api-types';
import { disablePush, enablePush, isIosSafari, isStandaloneDisplay } from '@/lib/push';
import { useAuthStore } from '@/stores/auth-store';

type PushTogglePhase = 'checking' | 'unsupported' | 'ready';

type DevicePushValue = 'on' | 'off';

/**
 * Profile identity-card Notifications section: uppercase heading, a three-stage
 * `SegmentedControl` (All / Active / Mentions) whenever a session exists, and a
 * second On / Off `SegmentedControl` (`aria.push`) when Push/Service Worker APIs
 * are ready. The level control stays visible while Push APIs are inspected and
 * when they are missing (in-app list still uses the level). Renders nothing
 * without a session. On iPhone Safari outside standalone, also shows an install
 * hint under the device pill. A successful level POST merges
 * `notificationLevel` into the current store account and ignores the response
 * if the session no longer matches.
 *
 * @returns The notifications section, or `null` without a session.
 */
export function PushToggle(): ReactElement | null {
  const { t } = useTranslations();
  const session = useAuthStore((state) => state.session);
  const account = useAuthStore((state) => state.account);
  const setAccount = useAuthStore((state) => state.setAccount);
  const [phase, setPhase] = useState<PushTogglePhase>('checking');
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [levelBusy, setLevelBusy] = useState(false);
  const [showInstallHint, setShowInstallHint] = useState(false);
  const [errorKey, setErrorKey] = useState<'profile.push.unavailable' | null>(null);
  const [levelError, setLevelError] = useState(false);
  const selected: NotificationLevel = account === null ? 'all' : accountNotificationLevel(account);

  useEffect(() => {
    let cancelled = false;

    async function inspect(): Promise<void> {
      if (
        typeof navigator.serviceWorker === 'undefined' ||
        typeof window.PushManager === 'undefined'
      ) {
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

  const onDeviceChange = useCallback(
    async (next: DevicePushValue): Promise<void> => {
      /* v8 ignore next 3 -- the control is unmounted without a session */
      if (session === null || busy) {
        return;
      }
      if (next === 'on' && subscribed) {
        return;
      }
      if (next === 'off' && !subscribed) {
        return;
      }
      setBusy(true);
      setErrorKey(null);
      try {
        if (next === 'off') {
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
    },
    [busy, session, subscribed],
  );

  const onLevelChange = useCallback(
    async (next: NotificationLevel): Promise<void> => {
      if (levelBusy || next === selected) {
        return;
      }
      /* v8 ignore next 3 -- the control is unmounted without a session */
      if (session === null) {
        return;
      }
      setLevelBusy(true);
      setLevelError(false);
      try {
        const updated = await postNotificationLevel(session, next);
        if (useAuthStore.getState().session !== session) {
          return;
        }
        const current = useAuthStore.getState().account;
        if (current === null) {
          return;
        }
        setAccount({
          ...current,
          notificationLevel: updated.notificationLevel ?? next,
        });
      } catch {
        setLevelError(true);
      } finally {
        setLevelBusy(false);
      }
    },
    [levelBusy, selected, session, setAccount],
  );

  if (session === null) {
    return null;
  }

  const levelOptions = [
    { value: 'all' as const, label: t('profile.push.level.all') },
    { value: 'active' as const, label: t('profile.push.level.active') },
    { value: 'mentions' as const, label: t('profile.push.level.mentions') },
  ];
  const onLevelPress = (next: NotificationLevel): void => {
    void onLevelChange(next);
  };
  const onDevicePress = (next: DevicePushValue): void => {
    void onDeviceChange(next);
  };

  return (
    <div className="flex w-full flex-col items-stretch gap-3 border-t border-app-border pt-6">
      <p className="text-center text-xs tracking-widest text-app-subtle uppercase">
        {t('profile.push.heading')}
      </p>
      <SegmentedControl
        tone="neutral"
        value={selected}
        options={levelOptions}
        onChange={onLevelPress}
        ariaLabel={t('profile.push.level.label')}
      />
      <p className="text-sm text-app-muted">{t('profile.push.level.hint')}</p>
      {levelError ? (
        <p role="alert" className="text-center text-sm text-app-danger">
          {t('profile.push.level.error')}
        </p>
      ) : null}
      {phase === 'ready' ? (
        <SegmentedControl
          tone="neutral"
          value={subscribed ? 'on' : 'off'}
          options={[
            { value: 'on' as const, label: t('profile.push.on') },
            { value: 'off' as const, label: t('profile.push.off') },
          ]}
          onChange={onDevicePress}
          ariaLabel={t('aria.push')}
        />
      ) : null}
      {phase === 'ready' && showInstallHint ? (
        <p className="text-sm text-app-muted">{t('profile.push.installHint')}</p>
      ) : null}
      {phase === 'ready' && errorKey !== null ? (
        <p role="alert" className="text-center text-sm text-app-danger">
          {t(errorKey)}
        </p>
      ) : null}
    </div>
  );
}
