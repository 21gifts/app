'use client';

import { Archive, Check, Pencil, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { HabitComments } from '@/app/habit-tracker/HabitComments';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import type { ForumPayError, ForumPayInvoice } from '@/components/ForumPaySheet';
import { InlineConfirm } from '@/components/InlineConfirm';
import { useTranslations } from '@/components/LocaleProvider';
import { Button, Card, Field, IconButton, SegmentedControl } from '@/components/ui';
import { useLatestRateDayState } from '@/hooks/useLatestRateDay';
import { messageInvoiceSchema, type AmountUnit } from '@/lib/api-types';
import { FORUM_GOAL_SATS_MAX } from '@/lib/forum-goal';
import { fetchMemberHabits, postMemberHabit, type MemberHabitList } from '@/lib/member-habits';
import { paySatsFromDraft } from '@/lib/stats-money';
import { useAuthStore } from '@/stores/auth-store';

type MemberHabit = MemberHabitList['habits'][number];
type HabitStatus = 'achieved' | 'partial' | 'missed';

type HabitGroup = {
  accountId: string;
  ownerName: string;
  habits: MemberHabit[];
};

const SAVE_ERROR = 'Could not save the habit tracker. Please try again.';

/**
 * Public habit tracker: every member's habits, comments, and owner actions.
 *
 * Loads from same-origin `GET /habits` and writes through `POST /habits`.
 * A failed reload keeps a list already on screen. The full-screen error is
 * only when nothing has loaded. Internal notes render only for the owner.
 * A session change closes an open edit, an archive confirmation, a comment
 * deletion confirm, and the new-habit draft and unsent comments before paint.
 * The same gift body is not posted again while that request is still waiting.
 * A confirmed add may be sent again. It is not reserved for the whole session.
 * A reload releases only actions that had already reached the server when
 * that reload started, and a request is ignored when the visit changed,
 * including when the same account comes back.
 * The archive confirmation stays open until a reload releases an archive
 * that had already reached the server when that reload started. It stays
 * open when that post fails or that reload fails.
 * Does not log invoices, addresses, notes, or comment text.
 *
 * @returns The habit-tracker body.
 */
export function MemberHabits(): ReactElement {
  const { t } = useTranslations();
  const session = useAuthStore((state) => state.session);
  const account = useAuthStore((state) => state.account);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [data, setData] = useState<MemberHabitList | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [addName, setAddName] = useState('');
  const [addDescription, setAddDescription] = useState('');
  const [addNotes, setAddNotes] = useState('');
  const [addCadence, setAddCadence] = useState<'daily' | 'weekly'>('daily');
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null);
  const [editByHabitId, setEditByHabitId] = useState<
    Record<string, { name: string; description: string; notes: string }>
  >({});
  const [commentByHabitId, setCommentByHabitId] = useState<Record<string, string>>({});
  const [draftSession, setDraftSession] = useState(session);
  const [payCommentId, setPayCommentId] = useState<string | null>(null);
  const [payDraft, setPayDraft] = useState('');
  const [payShownUnit, setPayShownUnit] = useState<AmountUnit>(account?.amountUnit ?? 'btc');
  const [payBusy, setPayBusy] = useState(false);
  const [payError, setPayError] = useState<ForumPayError>(null);
  const [payInvoice, setPayInvoice] = useState<ForumPayInvoice | null>(null);
  const payGeneration = useRef(0);
  const listGeneration = useRef(0);
  const listSettled = useRef(false);
  const listAlive = useRef(true);
  const postedKeys = useRef(new Set<string>());
  const postedForSession = useRef<string | null>(null);
  const sessionVisit = useRef(0);
  const inFlightKeys = useRef(new Set<string>());
  const { fiat } = useFiatPreference();
  const signedIn = session !== null && session !== '';
  const { rateDay, settled: rateSettled } = useLatestRateDayState(signedIn);

  useEffect(() => {
    listAlive.current = true;
    return () => {
      listAlive.current = false;
    };
  }, []);

  useEffect(() => {
    const generation = listGeneration.current + 1;
    listGeneration.current = generation;
    listSettled.current = false;
    // Try again keeps a successful post from being sent again. A new session may send it.
    // A request still waiting keeps its reservation across that clear.
    if (postedForSession.current !== session) {
      postedKeys.current.clear();
      postedForSession.current = session;
      payGeneration.current += 1;
      setPayCommentId(null);
      setPayDraft('');
      setPayBusy(false);
      setPayError(null);
      setPayInvoice(null);
      // The previous account's draft and archive confirm do not stay open.
      setEditingHabitId(null);
      setConfirmArchiveId(null);
      setEditByHabitId({});
      setAddName('');
      setAddDescription('');
      setAddNotes('');
      setAddCadence('daily');
      setCommentByHabitId({});
    }
    setLoading(true);
    setError(false);
    const confirmed = new Set(postedKeys.current);
    void fetchMemberHabits(session).then(
      (next) => {
        if (!listAlive.current || generation !== listGeneration.current) {
          return;
        }
        setData(next);
        setLoading(false);
        // Releases actions that had already reached the server when this load started.
        const released = releaseConfirmedPosts(postedKeys.current, confirmed);
        for (const id of released.closeIds) {
          cancelEdit(id);
        }
        for (const id of released.archiveIds) {
          clearArchiveConfirm(id);
        }
        listSettled.current = true;
      },
      () => {
        if (!listAlive.current || generation !== listGeneration.current) {
          return;
        }
        setLoading(false);
        setError(true);
        listSettled.current = true;
      },
    );
    return () => {
      if (listGeneration.current === generation) {
        listGeneration.current = generation + 1;
      }
    };
  }, [session, attempt]);

  // Cleared in this render, so the previous account is not painted.
  if (draftSession !== session) {
    setDraftSession(session);
    sessionVisit.current += 1;
    setAddName('');
    setAddDescription('');
    setAddNotes('');
    setAddCadence('daily');
    setCommentByHabitId({});
    setEditingHabitId(null);
    setEditByHabitId({});
    setConfirmArchiveId(null);
    payGeneration.current += 1;
    setPayCommentId(null);
    setPayDraft('');
    setPayBusy(false);
    setPayError(null);
    setPayInvoice(null);
  }

  async function refresh(): Promise<boolean> {
    // A session change or Try again owns this generation until it settles.
    if (!listSettled.current) {
      return false;
    }
    const actor = useAuthStore.getState().session;
    const generation = listGeneration.current + 1;
    listGeneration.current = generation;
    // Another save must not replace this reload while it is still loading.
    listSettled.current = false;
    const confirmed = new Set(postedKeys.current);
    try {
      const next = await fetchMemberHabits(actor);
      if (
        !listAlive.current ||
        generation !== listGeneration.current ||
        useAuthStore.getState().session !== actor
      ) {
        return false;
      }
      setData(next);
      setError(false);
      // A rating or a comment does not close an open edit. Try again does.
      // The archive confirmation closes only for an archive this load already saw.
      const released = releaseConfirmedPosts(postedKeys.current, confirmed);
      for (const id of released.archiveIds) {
        clearArchiveConfirm(id);
      }
      listSettled.current = true;
      return true;
    } catch {
      if (useAuthStore.getState().session !== actor) {
        return false;
      }
      if (!listAlive.current || generation !== listGeneration.current) {
        return false;
      }
      setError(true);
      listSettled.current = true;
      return false;
    }
  }

  async function submit(body: Record<string, unknown>, timeZone: boolean): Promise<boolean> {
    if (!listSettled.current) {
      return false;
    }
    const actor = session;
    const visit = sessionVisit.current;
    const key = JSON.stringify(body);
    // The request already waiting owns the reload. Do not start a second one.
    if (inFlightKeys.current.has(key)) {
      return false;
    }
    try {
      if (actor === null || actor === '') {
        throw new Error(SAVE_ERROR);
      }
      if (!postedKeys.current.has(key)) {
        // Reserved before the request returns, so a second submit cannot send it twice.
        inFlightKeys.current.add(key);
        try {
          await postMemberHabit(actor, body, timeZone);
        } finally {
          inFlightKeys.current.delete(key);
        }
        // A later visit owns the list, including when the same account comes back.
        if (requestVisitChanged(visit, actor)) {
          return false;
        }
        postedKeys.current.add(key);
      }
      const listed = await refresh();
      if (!listed) {
        return false;
      }
      const action = body['action'];
      const closeEdit = action === 'edit' || action === 'archive' ? body['id'] : undefined;
      if (typeof closeEdit === 'string') {
        cancelEdit(closeEdit);
      }
      return true;
    } catch {
      if (requestVisitChanged(visit, actor)) {
        return false;
      }
      setError(true);
      return false;
    }
  }

  function requestVisitChanged(visit: number, actor: string | null): boolean {
    return useAuthStore.getState().session !== actor || sessionVisit.current !== visit;
  }

  function startEdit(habit: MemberHabit): void {
    setEditingHabitId(habit.id);
    setEditByHabitId((current) => ({
      ...current,
      [habit.id]: {
        name: habit.name,
        description: habit.description,
        notes: habit.notes === undefined ? '' : habit.notes,
      },
    }));
  }

  function cancelEdit(habitId: string): void {
    setEditingHabitId((current) => (current === habitId ? null : current));
    setEditByHabitId((current) => {
      const next = { ...current };
      delete next[habitId];
      return next;
    });
  }

  function clearArchiveConfirm(habitId: string): void {
    setConfirmArchiveId((current) => (current === habitId ? null : current));
  }

  function archiveUnresolved(habitId: string): boolean {
    const key = JSON.stringify({ action: 'archive', id: habitId });
    return inFlightKeys.current.has(key) || postedKeys.current.has(key);
  }

  async function onLog(habitId: string, period: string, status: HabitStatus): Promise<void> {
    await submit({ action: 'log', id: habitId, period, status }, false);
  }

  function openPay(commentId: string): void {
    payGeneration.current += 1;
    setPayCommentId(commentId);
    setPayDraft('');
    setPayBusy(false);
    setPayError(null);
    setPayInvoice(null);
  }

  function closePay(): void {
    payGeneration.current += 1;
    setPayCommentId(null);
    setPayDraft('');
    setPayBusy(false);
    setPayError(null);
    setPayInvoice(null);
  }

  function onPaySubmit(): void {
    /* v8 ignore start -- the sheet is not mounted without a session and comment, and Continue is disabled while busy or while the rate has not settled */
    if (session === null || session === '' || payCommentId === null || payBusy || !rateSettled) {
      return;
    }
    /* v8 ignore stop */
    const sats = paySatsFromDraft(payDraft, payShownUnit, rateDay, fiat);
    if (sats === 'invalid' || sats > FORUM_GOAL_SATS_MAX) {
      setPayError('habitAmount');
      return;
    }
    const actor = session;
    const commentId = payCommentId;
    const generation = payGeneration.current;
    const key = JSON.stringify({ action: 'invoice', commentId, amountSats: sats });
    // Close resets the busy flag while this request is still waiting.
    if (inFlightKeys.current.has(key)) {
      return;
    }
    inFlightKeys.current.add(key);
    setPayBusy(true);
    setPayError(null);
    void postMemberHabit(actor, { action: 'invoice', commentId, amountSats: sats }, true)
      .then((body) => {
        if (useAuthStore.getState().session !== actor) {
          return;
        }
        if (generation !== payGeneration.current) {
          return;
        }
        setPayInvoice({
          messageId: commentId,
          pr: lightningInvoicePr(body, sats),
          amountSats: sats,
        });
      })
      .catch((caught: unknown) => {
        if (useAuthStore.getState().session !== actor) {
          return;
        }
        if (generation !== payGeneration.current) {
          return;
        }
        /* v8 ignore next 4 -- postMemberHabit only throws Error */
        if (!(caught instanceof Error)) {
          setPayError('request');
          return;
        }
        if (caught.message === t('habit.payErrorAmount')) {
          setPayError('habitAmount');
          return;
        }
        if (/too many payments/i.test(caught.message)) {
          setPayError('rateLimit');
          return;
        }
        if (/author's wallet cannot receive this Bitcoin payment/i.test(caught.message)) {
          setPayError('authorWallet');
          return;
        }
        setPayError('request');
      })
      .finally(() => {
        inFlightKeys.current.delete(key);
        if (useAuthStore.getState().session !== actor) {
          return;
        }
        if (generation === payGeneration.current) {
          setPayBusy(false);
        }
      });
  }

  let body: ReactElement;
  if (loading && data === null) {
    body = <p className="text-center text-sm text-app-muted">{t('habit.loading')}</p>;
  } else if (data === null) {
    body = (
      <div className="flex w-full flex-col items-center gap-3">
        <p role="alert" className="text-center text-sm text-app-danger">
          {t('habit.error')}
        </p>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setAttempt((current) => current + 1);
          }}
        >
          {t('habit.retry')}
        </Button>
      </div>
    );
  } else {
    body = (
      <div className="flex w-full flex-col gap-8">
        {error ? (
          <div className="flex w-full flex-col items-center gap-3">
            <p role="alert" className="text-center text-sm text-app-danger">
              {t('habit.error')}
            </p>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setAttempt((current) => current + 1);
              }}
            >
              {t('habit.retry')}
            </Button>
          </div>
        ) : null}
        {data.habits.length === 0 ? (
          <p className="text-center text-sm text-app-muted">{t('habit.empty')}</p>
        ) : null}
        {groupHabitsByAccount(data.habits).map((group) => (
          <section key={group.accountId} className="flex w-full flex-col gap-4">
            <h2 className="text-xl font-semibold text-app-fg">{group.ownerName}</h2>
            {group.habits.map((habit) => {
              const owns = account !== null && account.id === habit.accountId;
              const editing = editingHabitId === habit.id;
              const storedDraft = editByHabitId[habit.id];
              const draft = storedDraft ?? {
                name: habit.name,
                description: habit.description,
                notes: habit.notes === undefined ? '' : habit.notes,
              };
              const openHabit = owns && habit.lastPeriod === null;
              return (
                <article
                  key={habit.id}
                  className="flex w-full flex-col gap-3 rounded-2xl border border-app-border bg-app-card-muted px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-app-fg">{habit.name}</h3>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-app-border-strong px-2 py-0.5 text-xs font-medium text-app-muted">
                          {habit.cadence === 'daily'
                            ? t('habit.cadenceDaily')
                            : t('habit.cadenceWeekly')}
                        </span>
                        {habit.lastPeriod !== null ? (
                          <span className="rounded-full border border-app-border-strong px-2 py-0.5 text-xs font-medium text-app-muted">
                            {t('habit.archived')}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    {openHabit ? (
                      <div className="flex shrink-0 items-center gap-5">
                        {editing ? null : (
                          <IconButton
                            type="button"
                            size="sm"
                            variant="ghost"
                            aria-label={t('habit.edit')}
                            onClick={() => {
                              startEdit(habit);
                            }}
                          >
                            <Pencil aria-hidden="true" className="h-4 w-4" />
                          </IconButton>
                        )}
                        {confirmArchiveId === habit.id ? null : (
                          <IconButton
                            type="button"
                            size="sm"
                            variant="ghost"
                            aria-label={t('habit.archive')}
                            onClick={() => {
                              setConfirmArchiveId(habit.id);
                            }}
                          >
                            <Archive aria-hidden="true" className="h-4 w-4" />
                          </IconButton>
                        )}
                      </div>
                    ) : null}
                  </div>
                  {confirmArchiveId === habit.id && openHabit ? (
                    <InlineConfirm
                      label={t('habit.archiveConfirm')}
                      confirmLabel={t('habit.archiveConfirmAction')}
                      cancelLabel={t('habit.archiveCancel')}
                      onConfirm={() => {
                        void submit({ action: 'archive', id: habit.id }, false);
                      }}
                      onCancel={() => {
                        if (archiveUnresolved(habit.id)) {
                          return;
                        }
                        setConfirmArchiveId(null);
                      }}
                    />
                  ) : null}
                  {habit.description !== '' ? (
                    <p className="text-sm text-app-fg">{habit.description}</p>
                  ) : null}
                  {owns && habit.notes !== undefined && !editing ? (
                    <p className="text-sm text-app-fg">
                      <span className="text-app-muted">{t('habit.notes')}: </span>
                      <span>{habit.notes}</span>
                    </p>
                  ) : null}
                  {habit.periods.length > 0 ? (
                    <ul className="flex flex-col gap-2">
                      {habit.periods.map((period) => (
                        <li key={period.period} className="flex flex-col gap-2">
                          <div className="flex items-baseline justify-between gap-3">
                            <time dateTime={period.period} className="text-xs text-app-subtle">
                              {period.period}
                            </time>
                            {openHabit ? null : (
                              <span className="text-sm text-app-fg">
                                {statusCopy(period.status, t)}
                              </span>
                            )}
                          </div>
                          {openHabit ? (
                            <SegmentedControl<HabitStatus>
                              tone="neutral"
                              ariaLabel={t('habit.rate')}
                              className="[&>button]:!flex [&>button]:!min-w-0 [&>button]:!items-center [&>button]:!justify-center [&>button]:!px-1.5 [&>button]:!text-center [&>button]:!text-xs [&>button]:!leading-tight sm:[&>button]:!px-3 sm:[&>button]:!text-sm sm:[&>button]:!leading-5"
                              value={(period.status ?? 'unrated') as HabitStatus}
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
                  ) : null}
                  {editing && owns ? (
                    <form
                      className="flex flex-col gap-3"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void submit(
                          {
                            action: 'edit',
                            id: habit.id,
                            name: draft.name,
                            description: draft.description,
                            notes: draft.notes,
                          },
                          false,
                        );
                      }}
                    >
                      <Field
                        id={`habit-${habit.id}-name`}
                        label={t('habit.name')}
                        value={draft.name}
                        onChange={(event) => {
                          setEditByHabitId((current) => ({
                            ...current,
                            [habit.id]: { ...draft, name: event.target.value },
                          }));
                        }}
                      />
                      <Field
                        id={`habit-${habit.id}-description`}
                        label={t('habit.description')}
                        value={draft.description}
                        onChange={(event) => {
                          setEditByHabitId((current) => ({
                            ...current,
                            [habit.id]: { ...draft, description: event.target.value },
                          }));
                        }}
                      />
                      <Field
                        id={`habit-${habit.id}-notes`}
                        label={t('habit.notes')}
                        value={draft.notes}
                        onChange={(event) => {
                          setEditByHabitId((current) => ({
                            ...current,
                            [habit.id]: { ...draft, notes: event.target.value },
                          }));
                        }}
                      />
                      <div className="flex items-center gap-2">
                        <IconButton
                          type="submit"
                          variant="secondary"
                          size="md"
                          aria-label={t('habit.save')}
                        >
                          <Check aria-hidden="true" className="h-4 w-4" />
                        </IconButton>
                        <IconButton
                          type="button"
                          variant="secondary"
                          size="md"
                          aria-label={t('habit.cancel')}
                          onClick={() => {
                            cancelEdit(habit.id);
                          }}
                        >
                          <X aria-hidden="true" className="h-4 w-4" />
                        </IconButton>
                      </div>
                    </form>
                  ) : null}
                  <HabitComments
                    habit={habit}
                    account={account}
                    session={session}
                    commentText={commentByHabitId[habit.id] ?? ''}
                    payCommentId={payCommentId}
                    payDraft={payDraft}
                    payBusy={payBusy}
                    payError={payError}
                    payInvoice={payInvoice}
                    rateDay={rateDay}
                    ratePending={!rateSettled}
                    onPayOpen={openPay}
                    onPayDraftChange={(value) => {
                      setPayDraft(value);
                      setPayError(null);
                    }}
                    onPayUnitChange={setPayShownUnit}
                    onPaySubmit={onPaySubmit}
                    onPayCancel={closePay}
                    onCommentText={(value) => {
                      setCommentByHabitId((current) => ({ ...current, [habit.id]: value }));
                    }}
                    onPostComment={() => {
                      const text = commentByHabitId[habit.id] ?? '';
                      void submit({ action: 'comment', habitId: habit.id, text }, true).then(
                        (saved) => {
                          if (!saved) {
                            return;
                          }
                          setCommentByHabitId((current) => ({ ...current, [habit.id]: '' }));
                        },
                      );
                    }}
                    onDeleteComment={(commentId) => {
                      void submit({ action: 'deleteComment', id: commentId }, true);
                    }}
                  />
                </article>
              );
            })}
          </section>
        ))}
      </div>
    );
  }

  return (
    <Card maxWidth="xl" surface={false}>
      <h1 className="text-center text-2xl font-semibold tracking-tight text-app-fg sm:text-3xl">
        {t('nav.habitTracker')}
      </h1>
      <p className="text-center text-sm text-app-muted">{t('habit.schedule')}</p>
      {body}
      {session !== null ? (
        <form
          className="flex w-full flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void submit(
              {
                action: 'add',
                name: addName,
                description: addDescription,
                notes: addNotes,
                cadence: addCadence,
              },
              true,
            ).then((saved) => {
              if (!saved) {
                return;
              }
              setAddName('');
              setAddDescription('');
              setAddNotes('');
              setAddCadence('daily');
            });
          }}
        >
          <Field
            id="habit-add-name"
            label={t('habit.name')}
            value={addName}
            onChange={(event) => {
              setAddName(event.target.value);
            }}
          />
          <Field
            id="habit-add-description"
            label={t('habit.description')}
            value={addDescription}
            onChange={(event) => {
              setAddDescription(event.target.value);
            }}
          />
          <Field
            id="habit-add-notes"
            label={t('habit.notes')}
            value={addNotes}
            onChange={(event) => {
              setAddNotes(event.target.value);
            }}
          />
          <SegmentedControl
            tone="neutral"
            ariaLabel={t('habit.cadence')}
            value={addCadence}
            options={[
              { value: 'daily', label: t('habit.cadenceDaily') },
              { value: 'weekly', label: t('habit.cadenceWeekly') },
            ]}
            onChange={setAddCadence}
          />
          <Button type="submit">{t('habit.add')}</Button>
        </form>
      ) : null}
    </Card>
  );
}

function groupHabitsByAccount(habits: MemberHabit[]): HabitGroup[] {
  const groups: HabitGroup[] = [];
  const indexByAccountId = new Map<string, number>();
  for (const habit of habits) {
    const index = indexByAccountId.get(habit.accountId);
    if (index === undefined) {
      indexByAccountId.set(habit.accountId, groups.length);
      groups.push({
        accountId: habit.accountId,
        ownerName: habit.ownerName,
        habits: [habit],
      });
      continue;
    }
    const group = groups[index];
    /* v8 ignore next 3 -- the index is written when the group is pushed */
    if (group === undefined) {
      throw new Error('Habit group is missing.');
    }
    group.habits.push(habit);
  }
  return groups;
}

function statusCopy(
  status: HabitStatus | null,
  t: (key: 'habit.achieved' | 'habit.partial' | 'habit.missed' | 'habit.unrated') => string,
): string {
  if (status === 'achieved') {
    return t('habit.achieved');
  }
  if (status === 'partial') {
    return t('habit.partial');
  }
  if (status === 'missed') {
    return t('habit.missed');
  }
  return t('habit.unrated');
}

/** Drops actions that had already reached the server when this load started. Edit and archive ids close. An add does not. */
function releaseConfirmedPosts(
  keys: Set<string>,
  confirmed: Set<string>,
): { closeIds: string[]; archiveIds: string[] } {
  const closeIds: string[] = [];
  const archiveIds: string[] = [];
  for (const stored of [...keys]) {
    if (!confirmed.has(stored)) {
      continue;
    }
    const parsed = JSON.parse(stored) as { action?: unknown; id?: unknown };
    if (parsed.action !== 'add') {
      const closeEdit =
        parsed.action === 'edit' || parsed.action === 'archive' ? parsed.id : undefined;
      if (typeof closeEdit === 'string') {
        closeIds.push(closeEdit);
        if (parsed.action === 'archive') {
          archiveIds.push(closeEdit);
        }
      }
    }
    keys.delete(stored);
  }
  return { closeIds, archiveIds };
}

function lightningInvoicePr(body: unknown, amountSats: number): string {
  const parsed = messageInvoiceSchema.safeParse(body);
  const inRange =
    Number.isInteger(amountSats) && amountSats >= 1 && amountSats <= FORUM_GOAL_SATS_MAX;
  if (!parsed.success || !inRange || parsed.data.amountSats !== amountSats) {
    throw new Error('Could not start the Bitcoin payment');
  }
  return parsed.data.pr;
}
