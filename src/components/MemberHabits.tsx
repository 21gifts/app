'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { SundayWritingGate } from '@/components/SundayWritingGate';
import { Button, Card, Field } from '@/components/ui';
import type { Account } from '@/lib/api-types';
import { fetchMemberHabits, postMemberHabit, type MemberHabitList } from '@/lib/member-habits';
import { roleAtLeast } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth-store';

type MemberHabit = MemberHabitList['habits'][number];
type MemberHabitComment = MemberHabit['comments'][number];
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
  const [editByHabitId, setEditByHabitId] = useState<
    Record<string, { name: string; description: string; notes: string }>
  >({});
  const [commentByHabitId, setCommentByHabitId] = useState<Record<string, string>>({});
  const [amountByCommentId, setAmountByCommentId] = useState<Record<string, string>>({});
  const [invoiceByCommentId, setInvoiceByCommentId] = useState<Record<string, string>>({});
  const [invoiceErrorByCommentId, setInvoiceErrorByCommentId] = useState<Record<string, string>>(
    {},
  );
  const [donateOpenByCommentId, setDonateOpenByCommentId] = useState<Record<string, boolean>>({});

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

  async function onLog(habit: MemberHabit, status: HabitStatus): Promise<void> {
    const current = habit.periods[habit.periods.length - 1];
    /* v8 ignore next 3 -- the log buttons render only when a period exists */
    if (current === undefined) {
      throw new Error(SAVE_ERROR);
    }
    await submit({ action: 'log', id: habit.id, period: current.period, status }, false);
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
              const storedDraft = editByHabitId[habit.id];
              const draft = storedDraft ?? {
                name: habit.name,
                description: habit.description,
                notes: habit.notes === undefined ? '' : habit.notes,
              };
              return (
                <article
                  key={habit.id}
                  className="flex w-full flex-col gap-3 rounded-3xl border border-app-border-strong bg-app-card-muted p-4"
                >
                  <h3 className="text-lg font-semibold text-app-fg">{habit.name}</h3>
                  {habit.description !== '' ? (
                    <p className="text-sm text-app-fg">{habit.description}</p>
                  ) : null}
                  <p className="text-sm text-app-muted">
                    {habit.cadence === 'daily' ? t('habit.cadenceDaily') : t('habit.cadenceWeekly')}
                  </p>
                  {habit.lastPeriod !== null ? (
                    <p className="text-sm text-app-muted">{t('habit.archived')}</p>
                  ) : null}
                  {owns && habit.notes !== undefined ? (
                    <p className="text-sm text-app-fg">
                      {t('habit.notes')}: {habit.notes}
                    </p>
                  ) : null}
                  <ul className="flex flex-col gap-1">
                    {habit.periods.map((period) => (
                      <li key={period.period} className="text-sm text-app-fg">
                        {period.period} {statusCopy(period.status, t)}
                      </li>
                    ))}
                  </ul>
                  {owns && habit.lastPeriod === null && habit.periods.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          void onLog(habit, 'achieved');
                        }}
                      >
                        {t('habit.achieved')}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          void onLog(habit, 'partial');
                        }}
                      >
                        {t('habit.partial')}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          void onLog(habit, 'missed');
                        }}
                      >
                        {t('habit.missed')}
                      </Button>
                    </div>
                  ) : null}
                  {owns && habit.lastPeriod === null ? (
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
                      <Button type="submit">{t('habit.save')}</Button>
                    </form>
                  ) : null}
                  {owns && habit.lastPeriod === null ? (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        if (!window.confirm(t('habit.archiveConfirm'))) {
                          return;
                        }
                        void submit({ action: 'archive', id: habit.id }, false);
                      }}
                    >
                      {t('habit.archive')}
                    </Button>
                  ) : null}
                  <CommentsBlock
                    habit={habit}
                    account={account}
                    session={session}
                    commentText={commentByHabitId[habit.id] ?? ''}
                    amountByCommentId={amountByCommentId}
                    invoiceByCommentId={invoiceByCommentId}
                    invoiceErrorByCommentId={invoiceErrorByCommentId}
                    donateOpenByCommentId={donateOpenByCommentId}
                    onToggleDonate={(commentId) => {
                      setDonateOpenByCommentId((current) => ({
                        ...current,
                        [commentId]: current[commentId] !== true,
                      }));
                    }}
                    onCommentText={(value) => {
                      setCommentByHabitId((current) => ({ ...current, [habit.id]: value }));
                    }}
                    onAmount={(commentId, value) => {
                      setAmountByCommentId((current) => ({ ...current, [commentId]: value }));
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
                    onInvoice={(comment) => {
                      void requestInvoice({
                        comment,
                        session,
                        amountByCommentId,
                        setInvoiceByCommentId,
                        setInvoiceErrorByCommentId,
                        t,
                        refresh,
                      });
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
          <fieldset className="flex flex-col gap-2 text-sm text-app-fg">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="habit-cadence"
                value="daily"
                checked={addCadence === 'daily'}
                onChange={() => {
                  setAddCadence('daily');
                }}
              />
              {t('habit.cadenceDaily')}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="habit-cadence"
                value="weekly"
                checked={addCadence === 'weekly'}
                onChange={() => {
                  setAddCadence('weekly');
                }}
              />
              {t('habit.cadenceWeekly')}
            </label>
          </fieldset>
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

function parseAmountSats(raw: string): number {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(SAVE_ERROR);
  }
  const amountSats = Number.parseInt(trimmed, 10);
  if (!Number.isSafeInteger(amountSats)) {
    throw new Error(SAVE_ERROR);
  }
  return amountSats;
}

async function requestInvoice(args: {
  comment: MemberHabitComment;
  session: string | null;
  amountByCommentId: Record<string, string>;
  setInvoiceByCommentId: (
    update: (current: Record<string, string>) => Record<string, string>,
  ) => void;
  setInvoiceErrorByCommentId: (
    update: (current: Record<string, string>) => Record<string, string>,
  ) => void;
  t: (key: 'habit.noWallet') => string;
  refresh: () => Promise<void>;
}): Promise<void> {
  const {
    comment,
    session,
    amountByCommentId,
    setInvoiceByCommentId,
    setInvoiceErrorByCommentId,
    t,
    refresh,
  } = args;
  const raw = amountByCommentId[comment.id] ?? '';
  try {
    if (session === null || session === '') {
      throw new Error(SAVE_ERROR);
    }
    const amountSats = parseAmountSats(raw);
    const body = await postMemberHabit(
      session,
      { action: 'invoice', commentId: comment.id, amountSats },
      false,
    );
    const pr = lightningInvoicePr(body);
    setInvoiceByCommentId((current) => ({ ...current, [comment.id]: pr }));
    setInvoiceErrorByCommentId((current) => {
      const next = { ...current };
      delete next[comment.id];
      return next;
    });
    await refresh();
  } catch (caught: unknown) {
    /* v8 ignore next 3 -- postMemberHabit and parseAmountSats only throw Error */
    if (!(caught instanceof Error)) {
      throw caught;
    }
    const message = caught.message === 'No wallet' ? t('habit.noWallet') : caught.message;
    setInvoiceErrorByCommentId((current) => ({ ...current, [comment.id]: message }));
  }
}

function CommentsBlock(props: {
  habit: MemberHabit;
  account: Account | null;
  session: string | null;
  commentText: string;
  amountByCommentId: Record<string, string>;
  invoiceByCommentId: Record<string, string>;
  invoiceErrorByCommentId: Record<string, string>;
  donateOpenByCommentId: Record<string, boolean>;
  onToggleDonate: (commentId: string) => void;
  onCommentText: (value: string) => void;
  onAmount: (commentId: string, value: string) => void;
  onPostComment: () => void;
  onDeleteComment: (commentId: string) => void;
  onInvoice: (comment: MemberHabitComment) => void;
}): ReactElement {
  const { t } = useTranslations();
  const {
    habit,
    account,
    session,
    commentText,
    amountByCommentId,
    invoiceByCommentId,
    invoiceErrorByCommentId,
    donateOpenByCommentId,
    onToggleDonate,
    onCommentText,
    onAmount,
    onPostComment,
    onDeleteComment,
    onInvoice,
  } = props;
  const canDelete = account !== null && roleAtLeast(account.role, 'initiator');

  return (
    <div className="flex flex-col gap-3">
      <h4 className="text-sm font-semibold text-app-fg">{t('habit.comments')}</h4>
      <p className="text-sm text-app-muted">{t('habit.commentHint')}</p>
      {habit.comments.length === 0 ? (
        <p className="text-sm text-app-muted">{t('habit.noComments')}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {habit.comments.map((comment) => {
            const invoice = invoiceByCommentId[comment.id];
            const invoiceError = invoiceErrorByCommentId[comment.id];
            const amount = amountByCommentId[comment.id] ?? '';
            const showDonate = account !== null && comment.accountId !== account.id;
            const donateOpen = donateOpenByCommentId[comment.id] === true;
            return (
              <li key={comment.id} className="flex flex-col gap-2 text-sm text-app-fg">
                <p>
                  {comment.name}: {comment.text}
                </p>
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
                {showDonate ? (
                  <div className="flex flex-col gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        onToggleDonate(comment.id);
                      }}
                    >
                      {t('habit.donate')}
                    </Button>
                    {donateOpen ? (
                      <>
                        <Field
                          id={`habit-amount-${comment.id}`}
                          label={t('habit.amount')}
                          type="number"
                          inputMode="numeric"
                          value={amount}
                          onChange={(event) => {
                            onAmount(comment.id, event.target.value);
                          }}
                        />
                        <Button
                          type="button"
                          onClick={() => {
                            onInvoice(comment);
                          }}
                        >
                          {t('habit.invoice')}
                        </Button>
                        {invoice === undefined ? null : (
                          <Field
                            id={`habit-invoice-${comment.id}`}
                            label={t('habit.invoice')}
                            value={invoice}
                            readOnly
                          />
                        )}
                        {invoiceError === undefined ? null : (
                          <p role="alert" className="text-sm text-app-danger">
                            {invoiceError}
                          </p>
                        )}
                      </>
                    ) : null}
                  </div>
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
