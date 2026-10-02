'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { Button } from '@/components/ui';
import { habitTrackerSchema, type HabitTrackerData } from '@/lib/habit-tracker';
import { useAuthStore } from '@/stores/auth-store';

const WEEK = 604800000;
function shiftWeek(week: string, direction: number): string {
  return new Date(Date.parse(`${week}T00:00:00Z`) + direction * WEEK).toISOString().slice(0, 10);
}

/** Weekly founder/initiator resolutions, read-only for visitors, with local comments. */
export function HabitTracker(): ReactElement {
  const { t, locale } = useTranslations();
  const session = useAuthStore((state) => state.session);
  const account = useAuthStore((state) => state.account);
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const [data, setData] = useState<HabitTrackerData | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [text, setText] = useState('');
  const [comment, setComment] = useState('');
  const mutation = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    void fetch(`/habits/data${selectedWeek === null ? '' : `?week=${selectedWeek}`}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Tracker unavailable');
        const payload = habitTrackerSchema.parse(await response.json());
        if (!controller.signal.aborted) setData(payload);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [selectedWeek, revision]);
  useEffect(() => {
    if (data === null || selectedWeek !== null) return;
    // Polling recovers missed timers after a background tab sleeps. The exact
    // boundary timer switches a visible current-week page at Manila midnight.
    const refresh = (): void => setRevision((value) => value + 1);
    const interval = setInterval(refresh, 60000);
    const boundary = setTimeout(refresh, Math.max(1000, data.week.nextAt - Date.now()));
    return () => {
      clearInterval(interval);
      clearTimeout(boundary);
    };
  }, [data, selectedWeek]);

  async function submit(body: Record<string, unknown>): Promise<void> {
    if (session === null || mutation.current) return;
    mutation.current = true;
    setBusy(true);
    setError(false);
    try {
      const response = await fetch('/habits/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session}` },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error('Save failed');
      if (body['action'] === 'add') setText('');
      if (body['action'] === 'comment') setComment('');
      setRevision((value) => value + 1);
    } catch {
      setError(true);
    } finally {
      mutation.current = false;
      setBusy(false);
    }
  }
  const current = data !== null && data.week.start === data.currentWeek;
  const canRate = data !== null && data.week.start >= shiftWeek(data.currentWeek, -1);
  const disabled = busy || loading;
  return (
    <section
      className="mx-auto w-full max-w-2xl space-y-6 pb-10 text-app-fg"
      aria-busy={busy || loading}
    >
      <header className="space-y-3 text-center">
        <h1 className="text-3xl font-semibold">Habit-Tracker</h1>
        <p className="text-sm text-app-muted">{t('habit.schedule')}</p>
      </header>
      {error && (
        <div role="alert" className="space-y-2 text-app-danger">
          <p>{t('habit.error')}</p>
          <Button
            variant="secondary"
            onClick={() => setRevision((value) => value + 1)}
            disabled={disabled}
          >
            {t('habit.retry')}
          </Button>
        </div>
      )}
      {loading && data === null && <p role="status">{t('habit.loading')}</p>}
      {data !== null && (
        <>
          <nav
            aria-label={t('habit.weeks')}
            className="grid grid-cols-2 items-center gap-3 sm:grid-cols-[auto_1fr_auto]"
          >
            <Button
              variant="secondary"
              disabled={disabled || data.week.start <= data.firstWeek}
              onClick={() => setSelectedWeek(shiftWeek(data.week.start, -1))}
            >
              {t('habit.previous')}
            </Button>
            <h2 className="order-first col-span-2 text-center font-semibold sm:order-none sm:col-span-1">
              {t('habit.week', { week: data.week.label })}
            </h2>
            <Button
              variant="secondary"
              disabled={disabled || current}
              onClick={() => {
                const next = shiftWeek(data.week.start, 1);
                setSelectedWeek(next === data.currentWeek ? null : next);
              }}
            >
              {t('habit.next')}
            </Button>
          </nav>
          {!current && (
            <Button variant="secondary" disabled={disabled} onClick={() => setSelectedWeek(null)}>
              {t('habit.current')}
            </Button>
          )}
          {(['founder', 'initiator'] as const).map((role) => (
            <section
              key={role}
              className="space-y-4 rounded-xl border border-app-border p-4 sm:p-6"
            >
              <h2 className="text-xl font-semibold">
                {t(role === 'founder' ? 'habit.founder' : 'habit.initiator')}
              </h2>
              {data.habits.filter((habit) => habit.role === role).length === 0 && (
                <p className="text-sm text-app-muted">{t('habit.empty')}</p>
              )}
              {data.habits
                .filter((habit) => habit.role === role)
                .map((habit) => {
                  const status = data.results.find((result) => result.habitId === habit.id)?.status;
                  const owner =
                    session !== null &&
                    account?.id === habit.accountId &&
                    (account.role === 'founder' || account.role === 'initiator');
                  return (
                    <fieldset
                      key={habit.id}
                      className="space-y-3 border-t border-app-border pt-4"
                      disabled={disabled || !owner || !canRate}
                    >
                      <legend className="max-w-full break-words pr-2 font-medium">
                        {habit.text}
                      </legend>
                      <p className="text-xs text-app-muted">
                        {habit.name}
                        {habit.lastWeek !== null ? ` · ${t('habit.archived')}` : ''}
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-2">
                        {(['achieved', 'partial', 'missed'] as const).map((value) => (
                          <label key={value} className="flex min-h-11 items-center gap-2 text-sm">
                            <input
                              type="radio"
                              name={`habit-${habit.id}`}
                              checked={status === value}
                              onChange={() =>
                                void submit({
                                  action: 'rate',
                                  id: habit.id,
                                  week: data.week.start,
                                  status: value,
                                })
                              }
                            />
                            {t(`habit.${value}`)}
                          </label>
                        ))}
                      </div>
                      {status === undefined && (
                        <p className="text-xs text-app-muted">{t('habit.unrated')}</p>
                      )}
                      {owner && current && habit.lastWeek === null && (
                        <Button
                          variant="secondary"
                          onClick={() => {
                            if (window.confirm(t('habit.deleteConfirm')))
                              void submit({ action: 'retire', id: habit.id });
                          }}
                        >
                          {t('habit.delete')}
                        </Button>
                      )}
                    </fieldset>
                  );
                })}
              {current && account?.role === role && session !== null && (
                <form
                  className="space-y-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void submit({ action: 'add', text });
                  }}
                >
                  <label className="block text-sm" htmlFor={`new-${role}`}>
                    {t('habit.new')}
                  </label>
                  <input
                    id={`new-${role}`}
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    maxLength={200}
                    required
                    disabled={disabled}
                    placeholder={t('habit.placeholder')}
                    className="min-h-11 w-full rounded-lg border border-app-border bg-app-bg px-3"
                  />
                  <Button type="submit" disabled={disabled || text.trim() === ''}>
                    {t('habit.add')}
                  </Button>
                </form>
              )}
            </section>
          ))}
          <section className="space-y-4 border-t border-app-border pt-6">
            <h2 className="text-xl font-semibold">{t('habit.comments')}</h2>
            <p className="text-sm text-app-muted">{t('habit.commentHint')}</p>
            {data.comments.length === 0 && (
              <p className="text-sm text-app-muted">{t('habit.noComments')}</p>
            )}
            {data.comments.map((post) => (
              <article key={post.id} className="space-y-2 rounded-lg border border-app-border p-4">
                <div className="flex flex-wrap justify-between gap-2 text-sm">
                  <strong>{post.name || t('habit.member')}</strong>
                  <time dateTime={new Date(post.createdAt).toISOString()}>
                    {new Date(post.createdAt).toLocaleString(locale, {
                      timeZone: 'Asia/Manila',
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </time>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm">{post.text}</p>
              </article>
            ))}
            {session === null ? (
              <Link href="/login" className="underline">
                {t('habit.login')}
              </Link>
            ) : (
              <form
                className="space-y-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submit({ action: 'comment', week: data.week.start, text: comment });
                }}
              >
                <label htmlFor="habit-comment" className="block text-sm">
                  {t('habit.writeComment')}
                </label>
                <textarea
                  id="habit-comment"
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  maxLength={2000}
                  rows={3}
                  required
                  disabled={disabled}
                  className="w-full rounded-lg border border-app-border bg-app-bg p-3"
                />
                <Button type="submit" disabled={disabled || comment.trim() === ''}>
                  {t('habit.post')}
                </Button>
              </form>
            )}
          </section>
        </>
      )}
    </section>
  );
}
