'use client';

import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { SegmentedControl, type SegmentedControlOption } from '@/components/ui';
import { postHeartNotifications, postNotificationLevel } from '@/lib/api';
import { accountNotificationLevel, type NotificationLevel } from '@/lib/api-types';
import type { MessageKey } from '@/lib/messages';
import { disablePush, enablePush, isIosSafari, isStandaloneDisplay } from '@/lib/push';
import { useAuthStore } from '@/stores/auth-store';

type PushTogglePhase = 'checking' | 'unsupported' | 'ready';

type DevicePushValue = 'on' | 'off';

/**
 * Living-room options for the stored level.
 *
 * All, Only to me, then Only with a gift only when `level` is already
 * `active`, then Off. The value posted is the selected option.
 *
 * @param level - Stored notification level, including a missing field as `all`.
 * @param t - Catalog lookup.
 * @returns The pill options in display order.
 */
function roomOptions(
  level: NotificationLevel,
  t: (key: MessageKey, vars?: Record<string, string | number>) => string,
): SegmentedControlOption<NotificationLevel>[] {
  const options: SegmentedControlOption<NotificationLevel>[] = [
    { value: 'all', label: t('profile.notify.room.all') },
    { value: 'mentions', label: t('profile.notify.room.mine') },
  ];
  if (level === 'active') {
    options.push({ value: 'active', label: t('profile.notify.room.gifted') });
  }
  options.push({ value: 'none', label: t('profile.notify.room.off') });
  return options;
}

/**
 * Settings Notifications sections. Uppercase heading
 * `profile.notify.heading`, then Hearts On/Off and one compact Living room
 * pill on the same line as its label. Stored `active` adds Only with a gift;
 * choosing another option posts that level and the extra option disappears.
 * A second bordered section, `profile.device.heading`, shows Notifications
 * On/Off when Push APIs are ready. That row's visible label and aria-label
 * are `profile.device.label`, not `aria.push`. Renders nothing without a
 * session. On iPhone Safari outside standalone, an install hint sits under
 * the device row. A successful level POST merges `notificationLevel`; a
 * successful heart POST merges `notifyHearts`. A response after the session
 * changed is ignored.
 *
 * @returns The notification sections, or `null` without a session.
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
  const [heartBusy, setHeartBusy] = useState(false);
  const [showInstallHint, setShowInstallHint] = useState(false);
  const [errorKey, setErrorKey] = useState<'profile.push.unavailable' | null>(null);
  const [levelError, setLevelError] = useState(false);
  const [heartError, setHeartError] = useState(false);
  const selected: NotificationLevel = account === null ? 'all' : accountNotificationLevel(account);
  const heartsEnabled = account?.notifyHearts ?? true;

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
        // disablePush unsubscribes locally even when the api DELETE rejects.
        if (next === 'off') {
          setSubscribed(false);
        }
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

  const onHeartNotifyChange = useCallback(
    async (next: DevicePushValue): Promise<void> => {
      const enabled = next === 'on';
      if (heartBusy || enabled === heartsEnabled) {
        return;
      }
      /* v8 ignore next 3 -- the control is unmounted without a session */
      if (session === null) {
        return;
      }
      setHeartBusy(true);
      setHeartError(false);
      try {
        const updated = await postHeartNotifications(session, enabled);
        if (useAuthStore.getState().session !== session) {
          return;
        }
        const current = useAuthStore.getState().account;
        if (current === null) {
          return;
        }
        setAccount({
          ...current,
          notifyHearts: updated.notifyHearts === undefined ? enabled : updated.notifyHearts,
        });
      } catch {
        setHeartError(true);
      } finally {
        setHeartBusy(false);
      }
    },
    [heartBusy, heartsEnabled, session, setAccount],
  );

  if (session === null) {
    return null;
  }

  const onDevicePress = (next: DevicePushValue): void => {
    void onDeviceChange(next);
  };
  const onRoomPress = (next: NotificationLevel): void => {
    void onLevelChange(next);
  };
  const onOff = [
    { value: 'on' as const, label: t('profile.push.on') },
    { value: 'off' as const, label: t('profile.push.off') },
  ];
  const sectionClass = 'flex w-full flex-col items-stretch gap-3 border-t border-app-border pt-6';

  return (
    <>
      <div className={sectionClass}>
        <p className="text-center text-xs tracking-widest text-app-subtle uppercase">
          {t('profile.notify.heading')}
        </p>
        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0 text-sm text-app-fg">{t('profile.heartNotify.label')}</span>
          <SegmentedControl
            tone="neutral"
            fullWidth={false}
            value={heartsEnabled ? 'on' : 'off'}
            options={onOff}
            onChange={(next) => {
              void onHeartNotifyChange(next);
            }}
            ariaLabel={t('profile.heartNotify.label')}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0 text-sm text-app-fg">{t('profile.notify.room')}</span>
          <SegmentedControl
            tone="neutral"
            fullWidth={false}
            value={selected}
            options={roomOptions(selected, t)}
            onChange={onRoomPress}
            ariaLabel={t('profile.notify.room')}
          />
        </div>
        {levelError ? (
          <p role="alert" className="text-center text-sm text-app-danger">
            {t('profile.push.level.error')}
          </p>
        ) : null}
        {heartError ? (
          <p role="alert" className="text-center text-sm text-app-danger">
            {t('profile.heartNotify.error')}
          </p>
        ) : null}
      </div>
      {phase === 'ready' ? (
        <div className={sectionClass}>
          <p className="text-center text-xs tracking-widest text-app-subtle uppercase">
            {t('profile.device.heading')}
          </p>
          <div className="flex items-center justify-between gap-3">
            <span className="min-w-0 text-sm text-app-fg">{t('profile.device.label')}</span>
            <SegmentedControl
              tone="neutral"
              fullWidth={false}
              value={subscribed ? 'on' : 'off'}
              options={onOff}
              onChange={onDevicePress}
              ariaLabel={t('profile.device.label')}
            />
          </div>
          {showInstallHint ? (
            <p className="text-sm text-app-muted">{t('profile.push.installHint')}</p>
          ) : null}
          {errorKey !== null ? (
            <p role="alert" className="text-center text-sm text-app-danger">
              {t(errorKey)}
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
