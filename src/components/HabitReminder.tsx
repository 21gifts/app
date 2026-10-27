'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { Button } from '@/components/ui';
import { Scrollport } from '@/components/ui/Scrollport';
import { fetchMemberHabits, HABIT_REVIEW_EVENT } from '@/lib/member-habits';
import { nextOnboardingPath } from '@/lib/onboarding';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Offers to catch up on the signed-in member's unlogged habit periods after
 * login, a page load, or returning to the app. Navigation alone never prompts
 * again. Later lasts until the next app opening. Uses the API's ratable periods
 * rather than inventing a second daily/weekly deadline. Stale account requests
 * and load failures never show a reminder.
 *
 * @returns A dismissible reminder dialog, or nothing when no rating is pending.
 */
export function HabitReminder(): ReactElement | null {
  const { t } = useTranslations();
  const router = useRouter();
  const session = useAuthStore((state) => state.session);
  const account = useAuthStore((state) => state.account);
  const accountId = account?.id;
  const eligible =
    account !== null &&
    nextOnboardingPath(account) === '/welcome' &&
    (account.walletRequired !== false || account.passkeyRenewClosed === true);
  const [pendingFor, setPendingFor] = useState<{ session: string; accountId: string } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    setPendingFor(null);
    if (!eligible || !session || accountId === undefined) return;
    let generation = 0;
    let alive = true;
    let hidden = document.visibilityState === 'hidden';
    const check = (): void => {
      const request = ++generation;
      setPendingFor(null);
      void fetchMemberHabits(session).then(
        (data) => {
          if (!alive || request !== generation || document.visibilityState === 'hidden') return;
          if (
            data.habits.some(
              (habit) =>
                habit.accountId === accountId &&
                habit.lastPeriod === null &&
                habit.periods.some((period) => !period.logged && period.status === null),
            )
          ) {
            setPendingFor({ session, accountId });
          }
        },
        () => {
          // An optional reminder must not block opening the app when offline.
        },
      );
    };
    const visibilityChanged = (): void => {
      if (document.visibilityState === 'hidden') {
        hidden = true;
        generation += 1;
        setPendingFor(null);
      } else if (hidden) {
        hidden = false;
        check();
      }
    };
    const pageShown = (event: PageTransitionEvent): void => {
      if (event.persisted && document.visibilityState !== 'hidden') check();
    };
    if (!hidden) check();
    document.addEventListener('visibilitychange', visibilityChanged);
    window.addEventListener('pageshow', pageShown);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', visibilityChanged);
      window.removeEventListener('pageshow', pageShown);
    };
  }, [session, accountId, eligible]);

  const visible =
    eligible &&
    session !== null &&
    pendingFor?.session === session &&
    pendingFor.accountId === accountId;
  useEffect(() => {
    const element = dialog.current;
    if (visible && element !== null && !element.open) {
      element.showModal();
      element.querySelector<HTMLButtonElement>('[data-habit-reminder-later]')!.focus();
    }
    return () => {
      if (element?.open) element.close();
    };
  }, [visible]);

  function dismiss(): void {
    // Close while mounted so native dialog focus returns to the previous control.
    dialog.current!.close();
    setPendingFor(null);
  }

  if (!visible) return null;
  return (
    <dialog
      ref={dialog}
      aria-labelledby="habit-reminder-title"
      aria-describedby="habit-reminder-body"
      className="m-auto max-h-[calc(var(--app-height)-2rem)] w-[calc(100%-2rem)] max-w-sm rounded-3xl border border-app-border bg-app-card p-6 text-app-fg shadow-sm backdrop:bg-app-overlay"
      onCancel={(event) => {
        event.preventDefault();
        dismiss();
      }}
    >
      <Scrollport className="max-h-[calc(var(--app-height)-5rem)]">
        <div className="flex flex-col gap-4">
          <h2 id="habit-reminder-title" className="text-lg font-semibold">
            {t('habit.reminderTitle')}
          </h2>
          <p id="habit-reminder-body" className="text-sm text-app-muted">
            {t('habit.reminderBody')}
          </p>
          <Button
            type="button"
            onClick={() => {
              dismiss();
              window.dispatchEvent(new Event(HABIT_REVIEW_EVENT));
              router.push('/habit-tracker?review=1');
            }}
          >
            {t('habit.reminderNow')}
          </Button>
          <Button type="button" variant="secondary" data-habit-reminder-later onClick={dismiss}>
            {t('habit.reminderLater')}
          </Button>
        </div>
      </Scrollport>
    </dialog>
  );
}
