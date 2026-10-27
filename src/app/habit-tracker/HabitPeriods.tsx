'use client';

import { X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { Button, IconButton, SegmentedControl } from '@/components/ui';
import { Scrollport } from '@/components/ui/Scrollport';
import type { MemberHabitList } from '@/lib/member-habits';

type Habit = MemberHabitList['habits'][number];
type Status = 'achieved' | 'partial' | 'missed';

/** Props for the compact rating history. */
interface HabitPeriodsProps {
  habit: Habit;
  owns: boolean;
  review: boolean;
  reviewRequest?: number;
  error: boolean;
  onRetry: () => void;
  onLog: (id: string, period: string, status: Status) => Promise<void>;
}

/**
 * Shows the ten latest ratings and opens the complete history in the shared
 * scrollport. The history dialog keeps older ratings editable, traps focus
 * natively, and restores focus to its opener when dismissed. A catch-up link
 * opens the full history if a pending period is outside the ten-row preview.
 *
 * @param props - Habit, ownership, catch-up intent, and existing save handler.
 * @returns The compact list and optional scrollable history.
 */
export function HabitPeriods({
  habit,
  owns,
  review,
  reviewRequest = 0,
  error,
  onRetry,
  onLog,
}: HabitPeriodsProps): ReactElement {
  const { t } = useTranslations();
  const [historyOpen, setHistoryOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const periods = [...habit.periods].sort((a, b) => b.period.localeCompare(a.period));
  const olderPending = periods.slice(10).some((period) => !period.logged && period.status === null);
  useEffect(() => {
    if (review && owns && olderPending) setHistoryOpen(true);
  }, [review, reviewRequest, owns, olderPending]);
  useEffect(() => {
    const element = dialog.current;
    if (historyOpen && element !== null && !element.open) element.showModal();
    return () => {
      if (element?.open) element.close();
    };
  }, [historyOpen]);

  function closeHistory(): void {
    // Close while still mounted so the browser restores focus to the opener.
    dialog.current!.close();
    setHistoryOpen(false);
  }

  function rows(shown: Habit['periods']): ReactElement {
    return (
      <ul className="flex flex-col gap-2">
        {shown.map((period) => (
          <li key={period.period} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <time dateTime={period.period} className="text-xs text-app-subtle">
                {period.period}
              </time>
              {owns ? null : (
                <span className="text-sm text-app-fg">
                  {t(
                    period.status === 'achieved'
                      ? 'habit.achieved'
                      : period.status === 'partial'
                        ? 'habit.partial'
                        : period.status === 'missed'
                          ? 'habit.missed'
                          : 'habit.unrated',
                  )}
                </span>
              )}
            </div>
            {owns ? (
              <SegmentedControl<Status>
                tone="neutral"
                ariaLabel={t('habit.rate')}
                className="[&>button]:!flex [&>button]:!min-w-0 [&>button]:!items-center [&>button]:!justify-center [&>button]:!px-1.5 [&>button]:!text-center [&>button]:!text-xs [&>button]:!leading-tight sm:[&>button]:!px-3 sm:[&>button]:!text-sm sm:[&>button]:!leading-5"
                value={(period.status ?? 'unrated') as Status}
                options={[
                  { value: 'achieved', label: t('habit.achieved') },
                  { value: 'partial', label: t('habit.partial') },
                  { value: 'missed', label: t('habit.missed') },
                ]}
                onChange={(status) => {
                  void onLog(habit.id, period.period, status);
                }}
              />
            ) : null}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <>
      {rows(periods.slice(0, 10))}
      {periods.length > 10 ? (
        <Button type="button" variant="secondary" onClick={() => setHistoryOpen(true)}>
          {t('habit.allRatings')}
        </Button>
      ) : null}
      {historyOpen ? (
        <dialog
          ref={dialog}
          aria-label={`${habit.name}: ${t('habit.allRatings')}`}
          className="m-auto max-h-[calc(var(--app-height)-2rem)] w-[calc(100%-2rem)] max-w-xl rounded-3xl border border-app-border bg-app-card p-4 text-app-fg shadow-sm backdrop:bg-app-overlay"
          onCancel={(event) => {
            event.preventDefault();
            closeHistory();
          }}
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <h4 className="min-w-0 text-lg font-semibold break-words">{habit.name}</h4>
            <IconButton
              type="button"
              variant="ghost"
              aria-label={t('habit.closeHistory')}
              onClick={closeHistory}
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </IconButton>
          </div>
          <Scrollport className="max-h-[calc(var(--app-height)-9rem)]">
            {error ? (
              <div className="mb-3 flex flex-col gap-2">
                <p role="alert" className="text-sm text-app-danger">
                  {t('habit.error')}
                </p>
                <Button type="button" variant="secondary" onClick={onRetry}>
                  {t('habit.retry')}
                </Button>
              </div>
            ) : null}
            {rows(periods)}
          </Scrollport>
        </dialog>
      ) : null}
    </>
  );
}
