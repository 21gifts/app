'use client';

import { Archive, Gift, Pencil, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import {
  ForumPaySheet,
  type ForumPayError,
  type ForumPayInvoice,
} from '@/components/ForumPaySheet';
import { useTranslations } from '@/components/LocaleProvider';
import { SundayWritingGate } from '@/components/SundayWritingGate';
import { Button, Card, Field, IconButton, SegmentedControl } from '@/components/ui';
import { useLatestRateDay } from '@/hooks/useLatestRateDay';
import type { Account, AmountUnit } from '@/lib/api-types';
import { fetchMemberHabits, postMemberHabit, type MemberHabitList } from '@/lib/member-habits';
import { roleAtLeast } from '@/lib/roles';
import { paySatsFromDraft, type FiatRateDay } from '@/lib/stats-money';
import { isSmartphoneUserAgent } from '@/lib/wos-deep-link';
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
 * Internal notes render only for the owner. Does not log invoices, addresses,
 * notes, or comment text.
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
  const [editByHabitId, setEditByHabitId] = useState<
    Record<string, { name: string; description: string; notes: string }>
  >({});
  const [commentByHabitId, setCommentByHabitId] = useState<Record<string, string>>({});
  const [payCommentId, setPayCommentId] = useState<string | null>(null);
  const [payDraft, setPayDraft] = useState('');
  const [payShownUnit, setPayShownUnit] = useState<AmountUnit>(account?.amountUnit ?? 'btc');
  const [payBusy, setPayBusy] = useState(false);
  const [payError, setPayError] = useState<ForumPayError>(null);
  const [payInvoice, setPayInvoice] = useState<ForumPayInvoice | null>(null);
  const [showPaymentQr, setShowPaymentQr] = useState(false);
  const payGeneration = useRef(0);
  const { fiat } = useFiatPreference();
  const signedIn = session !== null && session !== '';
  const rateDay = useLatestRateDay(signedIn);

  useEffect(() => {
    setShowPaymentQr(!isSmartphoneUserAgent(navigator.userAgent));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    void fetchMemberHabits(session).then(
      (next) => {
        if (cancelled) {
          return;
        }
        setData(next);
        setLoading(false);
      },
      () => {
        if (cancelled) {
          return;
        }
        setData(null);
        setLoading(false);
        setError(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [session, attempt]);

  async function refresh(): Promise<void> {
    try {
      const next = await fetchMemberHabits(session);
      setData(next);
      setEditByHabitId({});
      setEditingHabitId(null);
      setError(false);
    } catch {
      setError(true);
    }
  }

  async function submit(body: Record<string, unknown>, timeZone: boolean): Promise<boolean> {
    try {
      if (session === null || session === '') {
        throw new Error(SAVE_ERROR);
      }
      await postMemberHabit(session, body, timeZone);
      await refresh();
      return true;
    } catch {
      setError(true);
      return false;
    }
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
    setEditingHabitId(null);
    setEditByHabitId((current) => {
      const next = { ...current };
      delete next[habitId];
      return next;
    });
  }

  async function onLog(habit: MemberHabit, status: HabitStatus): Promise<void> {
    const current = habit.periods[habit.periods.length - 1];
    /* v8 ignore next 3 -- the log buttons render only when a period exists */
    if (current === undefined) {
      throw new Error(SAVE_ERROR);
    }
    await submit({ action: 'log', id: habit.id, period: current.period, status }, false);
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
    /* v8 ignore next 3 -- the sheet is not mounted without a session and comment, and Continue is disabled while busy */
    if (session === null || session === '' || payCommentId === null || payBusy) {
      return;
    }
    const sats = paySatsFromDraft(payDraft, payShownUnit, rateDay, fiat);
    if (sats === 'invalid') {
      setPayError('amount');
      return;
    }
    const commentId = payCommentId;
    const generation = payGeneration.current;
    setPayBusy(true);
    setPayError(null);
    void postMemberHabit(session, { action: 'invoice', commentId, amountSats: sats }, true)
      .then((body) => {
        if (generation !== payGeneration.current) {
          return;
        }
        setPayInvoice({ messageId: commentId, pr: lightningInvoicePr(body), amountSats: sats });
      })
      .catch((caught: unknown) => {
        if (generation !== payGeneration.current) {
          return;
        }
        /* v8 ignore next 4 -- postMemberHabit only throws Error */
        if (!(caught instanceof Error)) {
          setPayError('request');
          return;
        }
        if (/too many payments/i.test(caught.message)) {
          setPayError('rateLimit');
          return;
        }
        if (caught.message === 'No wallet') {
          setPayError('authorWallet');
          return;
        }
        setPayError('request');
      })
      .finally(() => {
        if (generation === payGeneration.current) {
          setPayBusy(false);
        }
      });
  }

  let body: ReactElement;
  if (loading) {
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
              const openPeriod =
                openHabit && habit.periods.length > 0
                  ? habit.periods[habit.periods.length - 1]
                  : undefined;
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
                      <div className="flex shrink-0 items-center gap-1">
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
                        <IconButton
                          type="button"
                          size="sm"
                          variant="ghost"
                          aria-label={t('habit.archive')}
                          onClick={() => {
                            if (!window.confirm(t('habit.archiveConfirm'))) {
                              return;
                            }
                            void submit({ action: 'archive', id: habit.id }, false);
                          }}
                        >
                          <Archive aria-hidden="true" className="h-4 w-4" />
                        </IconButton>
                      </div>
                    ) : null}
                  </div>
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
                      {habit.periods.map((period) => {
                        const isOpen =
                          openPeriod !== undefined && period.period === openPeriod.period;
                        return (
                          <li key={period.period} className="flex flex-col gap-2">
                            <div className="flex items-baseline justify-between gap-3">
                              <time dateTime={period.period} className="text-xs text-app-subtle">
                                {period.period}
                              </time>
                              {isOpen ? null : (
                                <span className="text-sm text-app-fg">
                                  {statusCopy(period.status, t)}
                                </span>
                              )}
                            </div>
                            {isOpen ? (
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
                                  void onLog(habit, status);
                                }}
                              />
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                  {editing ? (
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
                        <Button type="submit">{t('habit.save')}</Button>
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
                  <CommentsBlock
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
                    showPaymentQr={showPaymentQr}
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
                      if (!window.confirm(t('habit.deleteCommentConfirm'))) {
                        return;
                      }
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

function lightningInvoicePr(body: unknown): string {
  if (body === null || typeof body !== 'object' || !('pr' in body) || typeof body.pr !== 'string') {
    throw new Error(SAVE_ERROR);
  }
  return body.pr;
}

function CommentsBlock(props: {
  habit: MemberHabit;
  account: Account | null;
  session: string | null;
  commentText: string;
  payCommentId: string | null;
  payDraft: string;
  payBusy: boolean;
  payError: ForumPayError;
  payInvoice: ForumPayInvoice | null;
  rateDay: FiatRateDay | null;
  showPaymentQr: boolean;
  onPayOpen: (commentId: string) => void;
  onPayDraftChange: (value: string) => void;
  onPayUnitChange: (unit: AmountUnit) => void;
  onPaySubmit: () => void;
  onPayCancel: () => void;
  onCommentText: (value: string) => void;
  onPostComment: () => void;
  onDeleteComment: (commentId: string) => void;
}): ReactElement {
  const { t } = useTranslations();
  const {
    habit,
    account,
    session,
    commentText,
    payCommentId,
    payDraft,
    payBusy,
    payError,
    payInvoice,
    rateDay,
    showPaymentQr,
    onPayOpen,
    onPayDraftChange,
    onPayUnitChange,
    onPaySubmit,
    onPayCancel,
    onCommentText,
    onPostComment,
    onDeleteComment,
  } = props;
  const canDelete = account !== null && roleAtLeast(account.role, 'initiator');
  const canPay = session !== null && session !== '' && account !== null;

  return (
    <div className="flex flex-col gap-3 border-t border-app-border pt-3">
      <h4 className="text-sm font-semibold text-app-fg">{t('habit.comments')}</h4>
      <p className="text-sm text-app-muted">{t('habit.commentHint')}</p>
      {habit.comments.length === 0 ? (
        <p className="text-sm text-app-muted">{t('habit.noComments')}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {habit.comments.map((comment) => {
            const showGift = canPay && comment.accountId !== account.id;
            return (
              <li key={comment.id} className="flex flex-col gap-2 text-sm text-app-fg">
                <p>
                  <span className="font-medium">{comment.name}</span>
                  {': '}
                  <span>{comment.text}</span>
                </p>
                {canDelete || showGift ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {canDelete ? (
                      <SundayWritingGate>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            onDeleteComment(comment.id);
                          }}
                        >
                          {t('habit.deleteComment')}
                        </Button>
                      </SundayWritingGate>
                    ) : null}
                    {showGift ? (
                      <SundayWritingGate notice="zap">
                        <IconButton
                          type="button"
                          size="sm"
                          variant="ghost"
                          aria-label={t('forum.pay')}
                          disabled={payBusy}
                          onClick={() => {
                            onPayOpen(comment.id);
                          }}
                        >
                          <Gift aria-hidden="true" className="h-4 w-4 shrink-0" />
                        </IconButton>
                      </SundayWritingGate>
                    ) : null}
                  </div>
                ) : null}
                {showGift && payCommentId === comment.id ? (
                  <SundayWritingGate notice="zap">
                    <ForumPaySheet
                      messageId={comment.id}
                      payDraft={payDraft}
                      payBusy={payBusy}
                      payError={payError}
                      payInvoice={payInvoice}
                      payWaiting={false}
                      onPayDraftChange={onPayDraftChange}
                      onPayUnitChange={onPayUnitChange}
                      onPaySubmit={onPaySubmit}
                      onPayCancel={onPayCancel}
                      rateDay={rateDay}
                      showPaymentQr={showPaymentQr}
                      onInteract={() => undefined}
                    />
                  </SundayWritingGate>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {account !== null ? (
        <SundayWritingGate>
          <div className="flex flex-col gap-2">
            <Field
              id={`habit-${habit.id}-comment`}
              label={t('habit.writeComment')}
              multiline
              value={commentText}
              onChange={(event) => {
                onCommentText(event.target.value);
              }}
            />
            <Button type="button" onClick={onPostComment}>
              {t('habit.post')}
            </Button>
          </div>
        </SundayWritingGate>
      ) : null}
      {session === null ? (
        <Link
          href="/login"
          className="text-sm font-medium text-app-fg underline underline-offset-2"
        >
          {t('habit.login')}
        </Link>
      ) : null}
    </div>
  );
}
