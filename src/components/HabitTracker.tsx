'use client';

import { Gift, Pencil, Plus, Save, Send, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { HabitCommentDonation } from '@/components/HabitCommentDonation';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { Button, Field, IconButton } from '@/components/ui';
import { habitTrackerSchema, type HabitTrackerData } from '@/lib/habit-tracker';
import { roleAtLeast } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth-store';

const WEEK = 604800000;
function shiftWeek(week: string, direction: number): string {
  return new Date(Date.parse(`${week}T00:00:00Z`) + direction * WEEK).toISOString().slice(0, 10);
}

/**
 * Weekly founder/initiator resolutions, read-only for visitors, with local comments.
 *
 * @returns The tracker board.
 */
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
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [donationId, setDonationId] = useState<string | null>(null);
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
    if (data === null || data.week.start !== data.currentWeek) return;
    // Polling recovers missed timers after a background tab sleeps. The exact
    // boundary timer switches a visible current-week page at Monday 08:00 in Manila.
    const refresh = (): void => setRevision((value) => value + 1);
    const interval = setInterval(refresh, 60000);
    const now = Date.now();
    const nextBoundary = Math.min(
      ...[data.week.nextAt, data.commentsAllowedAt, data.commentsCloseAt].filter(
        (time): time is number => time !== undefined && time > now,
      ),
    );
    const boundary = setTimeout(
      refresh,
      Number.isFinite(nextBoundary) ? Math.max(1000, nextBoundary - now) : 60000,
    );
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
      if (body['action'] === 'edit') setEditing(null);
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
  const canRate = data !== null && data.week.start <= data.currentWeek;
  const disabled = busy || loading;
  return (
    <section
      className="mx-auto w-full max-w-2xl space-y-6 pb-10 text-app-fg"
      aria-busy={busy || loading}
    >
      <header className="space-y-3 text-center">
        <h1 className="text-3xl font-semibold">{t('nav.habitTracker')}</h1>
        {current && <p className="text-sm text-app-muted">{t('habit.schedule')}</p>}
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
              {data.habits.filter((habit) =>
                role === 'founder'
                  ? habit.role === 'founder'
                  : habit.role === 'initiator' || habit.role === 'moderator',
              ).length === 0 && <p className="text-sm text-app-muted">{t('habit.empty')}</p>}
              {data.habits
                .filter((habit) =>
                  role === 'founder'
                    ? habit.role === 'founder'
                    : habit.role === 'initiator' || habit.role === 'moderator',
                )
                .map((habit) => {
                  const status = data.results.find((result) => result.habitId === habit.id)?.status;
                  const owner =
                    session !== null &&
                    account?.id === habit.accountId &&
                    roleAtLeast(account?.role, 'initiator');
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
                              className="peer sr-only"
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
                            <span
                              aria-hidden="true"
                              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-app-muted peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 ${
                                status === value
                                  ? value === 'achieved'
                                    ? 'border-green-600'
                                    : value === 'partial'
                                      ? 'border-orange-500'
                                      : 'border-red-600'
                                  : ''
                              }`}
                            >
                              {status === value && (
                                <span
                                  className={`h-2.5 w-2.5 rounded-full ${value === 'achieved' ? 'bg-green-600' : value === 'partial' ? 'bg-orange-500' : 'bg-red-600'}`}
                                />
                              )}
                            </span>
                            {t(`habit.${value}`)}
                            <span aria-hidden="true">
                              {value === 'achieved' ? '🙂' : value === 'partial' ? '😐' : '🙁'}
                            </span>
                          </label>
                        ))}
                      </div>
                      {status === undefined && (
                        <p className="text-xs text-app-muted">{t('habit.unrated')}</p>
                      )}
                      {owner && current && editing === habit.id && (
                        <form
                          className="space-y-2"
                          onSubmit={(event) => {
                            event.preventDefault();
                            void submit({ action: 'edit', id: habit.id, text: editText });
                          }}
                        >
                          <Field
                            label={t('habit.edit')}
                            id={`edit-${habit.id}`}
                            value={editText}
                            onChange={(event) => setEditText(event.target.value)}
                            maxLength={200}
                            required
                          />
                          <div className="flex gap-5">
                            <IconButton
                              type="submit"
                              aria-label={t('habit.save')}
                              disabled={disabled || editText.trim() === ''}
                            >
                              <Save aria-hidden="true" className="h-4 w-4" />
                            </IconButton>
                            <IconButton
                              size="sm"
                              variant="ghost"
                              aria-label={t('forum.payClose')}
                              onClick={() => setEditing(null)}
                            >
                              <X aria-hidden="true" className="h-4 w-4" />
                            </IconButton>
                          </div>
                        </form>
                      )}
                      {owner && current && editing !== habit.id && (
                        <IconButton
                          size="sm"
                          variant="ghost"
                          aria-label={t('habit.edit')}
                          onClick={() => {
                            setEditing(habit.id);
                            setEditText(habit.text);
                          }}
                        >
                          <Pencil aria-hidden="true" className="h-4 w-4" />
                        </IconButton>
                      )}
                      {owner && current && habit.lastWeek === null && (
                        <IconButton
                          size="sm"
                          variant="ghost"
                          aria-label={t('habit.delete')}
                          onClick={() => {
                            if (window.confirm(t('habit.deleteConfirm')))
                              void submit({ action: 'retire', id: habit.id });
                          }}
                        >
                          <Trash2 aria-hidden="true" className="h-4 w-4" />
                        </IconButton>
                      )}
                    </fieldset>
                  );
                })}
              {current &&
                session !== null &&
                (role === 'founder'
                  ? roleAtLeast(account?.role, 'founder')
                  : roleAtLeast(account?.role, 'initiator') &&
                    !roleAtLeast(account?.role, 'founder')) && (
                  <form
                    className="space-y-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void submit({ action: 'add', text });
                    }}
                  >
                    <Field
                      label={t('habit.new')}
                      id={`new-${role}`}
                      value={text}
                      onChange={(event) => setText(event.target.value)}
                      maxLength={200}
                      required
                      disabled={disabled}
                      placeholder={t('habit.placeholder')}
                    />
                    <IconButton
                      type="submit"
                      aria-label={t('habit.add')}
                      disabled={disabled || text.trim() === ''}
                    >
                      <Plus aria-hidden="true" className="h-4 w-4" />
                    </IconButton>
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
                <div className="flex flex-wrap items-center gap-5">
                  {session !== null &&
                    post.accountId !== account?.id &&
                    post.canReceiveDonation && (
                      <IconButton
                        size="sm"
                        variant="ghost"
                        aria-label={t('forum.pay')}
                        onClick={() => setDonationId(donationId === post.id ? null : post.id)}
                      >
                        <Gift aria-hidden="true" className="h-4 w-4" />
                      </IconButton>
                    )}
                  {!post.canReceiveDonation && (
                    <p className="text-xs text-app-muted">{t('habit.noWallet')}</p>
                  )}
                  {session !== null && roleAtLeast(account?.role, 'initiator') && (
                    <IconButton
                      size="sm"
                      variant="ghost"
                      aria-label={t('habit.deleteComment')}
                      disabled={disabled}
                      onClick={() => {
                        if (window.confirm(t('habit.deleteCommentConfirm')))
                          void submit({ action: 'deleteComment', id: post.id });
                      }}
                    >
                      <Trash2 aria-hidden="true" className="h-4 w-4" />
                    </IconButton>
                  )}
                </div>
                {donationId === post.id && session !== null && (
                  <HabitCommentDonation
                    key={`${post.id}/${session}`}
                    id={post.id}
                    name={post.name || t('habit.member')}
                    session={session}
                    onClose={() => setDonationId(null)}
                  />
                )}
              </article>
            ))}
            {!current || data.commentsAllowed === false ? (
              <p role="status" className="text-sm text-app-muted">
                {t(current ? 'habit.commentsClosed' : 'habit.commentsArchived')}
              </p>
            ) : session === null ? (
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
                <Field
                  multiline
                  label={t('habit.writeComment')}
                  id="habit-comment"
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  maxLength={2000}
                  rows={3}
                  required
                  disabled={disabled}
                />
                <IconButton
                  type="submit"
                  aria-label={t('habit.post')}
                  disabled={disabled || comment.trim() === ''}
                >
                  <Send aria-hidden="true" className="h-4 w-4" />
                </IconButton>
              </form>
            )}
          </section>
        </>
      )}
    </section>
  );
}
