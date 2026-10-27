'use client';

import { Archive, Check, ChevronDown, Pencil, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { useSearchParams } from 'next/navigation';
import { HabitPeriods } from '@/app/habit-tracker/HabitPeriods';
import { HabitComments } from '@/app/habit-tracker/HabitComments';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import type { ForumPayError, ForumPayInvoice } from '@/components/ForumPaySheet';
import { InlineConfirm } from '@/components/InlineConfirm';
import { useTranslations } from '@/components/LocaleProvider';
import { Button, Card, Field, IconButton, SegmentedControl } from '@/components/ui';
import { useLatestRateDayState } from '@/hooks/useLatestRateDay';
import { messageInvoiceSchema, type AmountUnit } from '@/lib/api-types';
import {
  HABIT_COMMENT_API_MESSAGE,
  HABIT_DESCRIPTION_API_MESSAGE,
  HABIT_NAME_API_MESSAGE,
  HABIT_NOTES_API_MESSAGE,
  habitTextProblem,
  shownEntryProblem,
  type RequiredTextProblem,
} from '@/lib/entry-text';
import { FORUM_GOAL_SATS_MAX } from '@/lib/forum-goal';
import {
  fetchMemberHabits,
  postMemberHabit,
  HABIT_REVIEW_EVENT,
  type MemberHabitList,
} from '@/lib/member-habits';
import {
  payDraftProblem,
  paySatsFromDraft,
  shownDraftPayError,
  shownPaySheetError,
} from '@/lib/stats-money';
import { isSmartphoneUserAgent } from '@/lib/wos-deep-link';
import type { MessageKey } from '@/lib/messages';
import { useAuthStore } from '@/stores/auth-store';

type MemberHabit = MemberHabitList['habits'][number];
type HabitStatus = 'achieved' | 'partial' | 'missed';

type HabitGroup = {
  accountId: string;
  ownerName: string;
  role: string;
  habits: MemberHabit[];
};

const SAVE_ERROR = 'Could not save the habit tracker. Please try again.';

type HabitFieldKind = 'name' | 'description' | 'notes' | 'comment';

function habitFieldCopy(
  t: (key: MessageKey) => string,
  kind: HabitFieldKind,
  problem: RequiredTextProblem,
): string {
  if (problem === 'empty') {
    return kind === 'comment' ? t('habit.commentEmpty') : t('habit.nameEmpty');
  }
  if (kind === 'name') {
    return t('habit.nameTooLong');
  }
  if (kind === 'comment') {
    return t('habit.commentTooLong');
  }
  return t('habit.textTooLong');
}

function habitRejectedCopy(t: (key: MessageKey) => string, kind: HabitFieldKind): string {
  if (kind === 'comment') {
    return t('habit.commentRejected');
  }
  if (kind === 'name') {
    return t('habit.nameRejected');
  }
  if (kind === 'description') {
    return t('habit.descriptionRejected');
  }
  return t('habit.notesRejected');
}

function habitFieldError(
  t: (key: MessageKey) => string,
  kind: HabitFieldKind,
  raw: string,
  touched: boolean,
  apiHere: boolean,
): string | undefined {
  const shown = shownEntryProblem(habitTextProblem(kind, raw), touched || apiHere);
  if (shown !== null) {
    return habitFieldCopy(t, kind, shown);
  }
  if (!apiHere) {
    return undefined;
  }
  return habitRejectedCopy(t, kind);
}

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
 * An API rejection of a name, description, or notes the form already accepted
 * sits under that field and does not claim a length the text does not break.
 * A comment post does that only for `Invalid comment`. Any other comment
 * rejection stays the tracker alert.
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
  const searchParams = useSearchParams();
  const review = searchParams.get('review') === '1';
  const accountId = useAuthStore((state) => state.account?.id);
  const [reviewRequest, setReviewRequest] = useState(0);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
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
  const [addNameTouched, setAddNameTouched] = useState(false);
  const [editNameTouched, setEditNameTouched] = useState<Record<string, boolean>>({});
  const [commentTouchedById, setCommentTouchedById] = useState<Record<string, boolean>>({});
  const [habitApi, setHabitApi] = useState<{
    where: 'add' | 'edit' | 'comment';
    id?: string;
    field: HabitFieldKind;
  } | null>(null);
  const [payInvoice, setPayInvoice] = useState<ForumPayInvoice | null>(null);
  const [showPaymentQr, setShowPaymentQr] = useState(false);
  const payGeneration = useRef(0);
  const listGeneration = useRef(0);
  const listSettled = useRef(false);
  const listAlive = useRef(true);
  const postedKeys = useRef(new Set<string>());
  const postedForSession = useRef<string | null>(null);
  const sessionVisit = useRef(0);
  const inFlightKeys = useRef(new Set<string>());
  // Bumped when an edit is cancelled, so a late answer cannot mark the next open draft.
  const editGeneration = useRef<Record<string, number>>({});
  const liveDrafts = useRef({
    addName: '',
    addDescription: '',
    addNotes: '',
    editByHabitId: {} as Record<string, { name: string; description: string; notes: string }>,
    commentByHabitId: {} as Record<string, string>,
  });
  liveDrafts.current = {
    addName,
    addDescription,
    addNotes,
    editByHabitId,
    commentByHabitId,
  };
  const { fiat } = useFiatPreference();
  const signedIn = session !== null && session !== '';
  const { rateDay, settled: rateSettled } = useLatestRateDayState(signedIn);

  useEffect(() => {
    setShowPaymentQr(!isSmartphoneUserAgent(navigator.userAgent));
  }, []);

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
      setAddNameTouched(false);
      setEditNameTouched({});
      setCommentTouchedById({});
      setHabitApi(null);
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

  useEffect(() => {
    const openReview = (): void => {
      if (accountId === undefined) return;
      setExpanded((current) => ({ ...current, [accountId]: true }));
      setReviewRequest((current) => current + 1);
    };
    if (review) openReview();
    const refreshReview = (): void => {
      openReview();
      // The reminder may have found periods that arrived while this view stayed mounted.
      setAttempt((current) => current + 1);
    };
    window.addEventListener(HABIT_REVIEW_EVENT, refreshReview);
    return () => window.removeEventListener(HABIT_REVIEW_EVENT, refreshReview);
  }, [review, accountId]);

  // Cleared in this render, so the previous account is not painted.
  if (draftSession !== session) {
    setDraftSession(session);
    setExpanded({});
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
    setAddNameTouched(false);
    setEditNameTouched({});
    setCommentTouchedById({});
    setHabitApi(null);
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
    const editId = body['action'] === 'edit' && typeof body['id'] === 'string' ? body['id'] : null;
    const editGen = editId === null ? 0 : (editGeneration.current[editId] ?? 0);
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
    } catch (err) {
      if (requestVisitChanged(visit, actor)) {
        return false;
      }
      const message = err instanceof Error ? err.message : '';
      const field: HabitFieldKind | null =
        message === HABIT_NAME_API_MESSAGE
          ? 'name'
          : message === HABIT_DESCRIPTION_API_MESSAGE
            ? 'description'
            : message === HABIT_NOTES_API_MESSAGE
              ? 'notes'
              : message === HABIT_COMMENT_API_MESSAGE
                ? 'comment'
                : null;
      const action = body['action'];
      const drafts = liveDrafts.current;
      if (field !== null && action === 'add') {
        const shown =
          field === 'description'
            ? drafts.addDescription
            : field === 'notes'
              ? drafts.addNotes
              : drafts.addName;
        // The answer belongs to the draft that was sent. A newer value stays clean.
        if (body[field] !== shown) {
          return false;
        }
        setHabitApi({ where: 'add', field });
        setError(false);
        return false;
      }
      if (field !== null && action === 'edit' && typeof body['id'] === 'string') {
        if ((editGeneration.current[body['id']] ?? 0) !== editGen) {
          return false;
        }
        const draft = drafts.editByHabitId[body['id']];
        /* v8 ignore next 3 -- cancel bumps the generation before it drops the draft, and a session change returns earlier */
        if (draft === undefined) {
          return false;
        }
        const shown =
          field === 'description'
            ? draft.description
            : field === 'notes'
              ? draft.notes
              : draft.name;
        if (body[field] !== shown) {
          return false;
        }
        setHabitApi({ where: 'edit', id: body['id'], field });
        setError(false);
        return false;
      }
      if (action === 'comment' && field === 'comment' && typeof body['habitId'] === 'string') {
        if (drafts.commentByHabitId[body['habitId']] !== body['text']) {
          return false;
        }
        setHabitApi({ where: 'comment', id: body['habitId'], field: 'comment' });
        setError(false);
        return false;
      }
      setHabitApi(null);
      setError(true);
      return false;
    }
  }

  function requestVisitChanged(visit: number, actor: string | null): boolean {
    return useAuthStore.getState().session !== actor || sessionVisit.current !== visit;
  }

  function clearEditRejection(habitId: string): void {
    setHabitApi((current) =>
      current?.where === 'edit' && current.id === habitId ? null : current,
    );
    setEditNameTouched((current) => {
      if (current[habitId] !== true) {
        return current;
      }
      const next = { ...current };
      delete next[habitId];
      return next;
    });
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
    clearEditRejection(habit.id);
  }

  function cancelEdit(habitId: string): void {
    editGeneration.current[habitId] = (editGeneration.current[habitId] ?? 0) + 1;
    setEditingHabitId((current) => (current === habitId ? null : current));
    setEditByHabitId((current) => {
      const next = { ...current };
      delete next[habitId];
      return next;
    });
    clearEditRejection(habitId);
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
    /* v8 ignore start -- the sheet is not mounted without a session and comment, and Continue is disabled while busy */
    if (session === null || session === '' || payCommentId === null || payBusy) {
      return;
    }
    /* v8 ignore stop */
    /* v8 ignore next 3 -- the pay sheet returns before this handler while its error is loading */
    if (payError === 'loading' && !rateSettled) {
      return;
    }
    const payProblem = payDraftProblem(payShownUnit, payDraft, rateDay, fiat, rateSettled);
    if (payProblem === 'quiet') {
      setPayError('loading');
      return;
    }
    if (payProblem === 'no-rate') {
      setPayError('noRate');
      return;
    }
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

  const livePayProblem = payDraftProblem(payShownUnit, payDraft, rateDay, fiat, rateSettled);
  const livePaySats = paySatsFromDraft(payDraft, payShownUnit, rateDay, fiat);
  const habitPayProblem =
    livePayProblem === 'invalid' ||
    (typeof livePaySats === 'number' && livePaySats > FORUM_GOAL_SATS_MAX)
      ? 'invalid'
      : livePayProblem;
  // The api uses the same code as a bad draft. A draft the form already
  // accepted keeps that message until the amount changes.
  const shownHabitPayError =
    payError === 'loading'
      ? shownPaySheetError(payError, habitPayProblem, 'habitAmount', 'noRate', rateSettled)
      : habitPayProblem === null && payError === 'habitAmount'
        ? payError
        : shownDraftPayError(payError, habitPayProblem, 'habitAmount', 'noRate');

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
        {groupHabitsByAccount(data.habits, account?.id).map((group) => (
          <section key={group.accountId} className="flex w-full flex-col gap-4">
            <h2 className="text-xl font-semibold text-app-fg">
              <button
                type="button"
                aria-expanded={expanded[group.accountId] === true}
                aria-controls={`habit-group-${group.accountId}`}
                className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-app-border px-4 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-focus"
                onClick={() =>
                  setExpanded((current) => ({
                    ...current,
                    [group.accountId]: !current[group.accountId],
                  }))
                }
              >
                <span className="min-w-0 break-words">{group.ownerName}</span>
                <ChevronDown
                  aria-hidden="true"
                  className={`h-5 w-5 shrink-0 ${expanded[group.accountId] ? 'rotate-180' : ''}`}
                />
              </button>
            </h2>
            <div
              id={`habit-group-${group.accountId}`}
              hidden={!expanded[group.accountId]}
              className="flex flex-col gap-4"
            >
              {group.habits.map((habit) => {
                const owns = account !== null && account.id === habit.accountId;
                const editing = editingHabitId === habit.id;
                const storedDraft = editByHabitId[habit.id];
                const draft = storedDraft ?? {
                  name: habit.name,
                  description: habit.description,
                  notes: habit.notes === undefined ? '' : habit.notes,
                };
                const editApi = habitApi?.where === 'edit' && habitApi.id === habit.id;
                const editNameError = habitFieldError(
                  t,
                  'name',
                  draft.name,
                  editNameTouched[habit.id] === true,
                  editApi && habitApi?.field === 'name',
                );
                const editDescriptionError = habitFieldError(
                  t,
                  'description',
                  draft.description,
                  false,
                  editApi && habitApi?.field === 'description',
                );
                const editNotesError = habitFieldError(
                  t,
                  'notes',
                  draft.notes,
                  false,
                  editApi && habitApi?.field === 'notes',
                );
                const commentText = commentByHabitId[habit.id] ?? '';
                const commentError = habitFieldError(
                  t,
                  'comment',
                  commentText,
                  commentTouchedById[habit.id] === true,
                  habitApi?.where === 'comment' && habitApi.id === habit.id,
                );
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
                      <HabitPeriods
                        key={`${session ?? 'guest'}:${accountId ?? 'guest'}`}
                        habit={habit}
                        owns={openHabit}
                        review={
                          review &&
                          expanded[group.accountId] === true &&
                          habit.id ===
                            data.habits.find(
                              (item) =>
                                item.accountId === account?.id &&
                                item.lastPeriod === null &&
                                item.periods.some(
                                  (period) => !period.logged && period.status === null,
                                ),
                            )?.id
                        }
                        reviewRequest={reviewRequest}
                        error={error}
                        onRetry={() => setAttempt((current) => current + 1)}
                        onLog={onLog}
                      />
                    ) : null}
                    {editing && owns ? (
                      <form
                        className="flex flex-col gap-3"
                        onSubmit={(event) => {
                          event.preventDefault();
                          setEditNameTouched((current) => ({ ...current, [habit.id]: true }));
                          if (
                            habitTextProblem('name', draft.name) !== null ||
                            habitTextProblem('description', draft.description) !== null ||
                            habitTextProblem('notes', draft.notes) !== null
                          ) {
                            return;
                          }
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
                          {...(editNameError === undefined
                            ? {}
                            : { error: editNameError, errorAnnounce: true })}
                          onBlur={() => {
                            setEditNameTouched((current) => ({ ...current, [habit.id]: true }));
                          }}
                          onChange={(event) => {
                            setEditByHabitId((current) => ({
                              ...current,
                              [habit.id]: { ...draft, name: event.target.value },
                            }));
                            if (
                              habitApi?.where === 'edit' &&
                              habitApi.id === habit.id &&
                              habitApi.field === 'name'
                            ) {
                              setHabitApi(null);
                            }
                          }}
                        />
                        <Field
                          id={`habit-${habit.id}-description`}
                          label={t('habit.description')}
                          value={draft.description}
                          {...(editDescriptionError === undefined
                            ? {}
                            : { error: editDescriptionError, errorAnnounce: true })}
                          onChange={(event) => {
                            setEditByHabitId((current) => ({
                              ...current,
                              [habit.id]: { ...draft, description: event.target.value },
                            }));
                            if (
                              habitApi?.where === 'edit' &&
                              habitApi.id === habit.id &&
                              habitApi.field === 'description'
                            ) {
                              setHabitApi(null);
                            }
                          }}
                        />
                        <Field
                          id={`habit-${habit.id}-notes`}
                          label={t('habit.notes')}
                          value={draft.notes}
                          {...(editNotesError === undefined
                            ? {}
                            : { error: editNotesError, errorAnnounce: true })}
                          onChange={(event) => {
                            setEditByHabitId((current) => ({
                              ...current,
                              [habit.id]: { ...draft, notes: event.target.value },
                            }));
                            if (
                              habitApi?.where === 'edit' &&
                              habitApi.id === habit.id &&
                              habitApi.field === 'notes'
                            ) {
                              setHabitApi(null);
                            }
                          }}
                        />
                        <div className="flex items-center gap-2">
                          <IconButton
                            type="submit"
                            variant="secondary"
                            size="md"
                            aria-label={t('habit.save')}
                            disabled={
                              editNameError !== undefined ||
                              editDescriptionError !== undefined ||
                              editNotesError !== undefined
                            }
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
                      commentText={commentText}
                      payCommentId={payCommentId}
                      payDraft={payDraft}
                      payBusy={payBusy}
                      payError={shownHabitPayError}
                      payInvoice={payInvoice}
                      rateDay={rateDay}
                      showPaymentQr={showPaymentQr}
                      onPayOpen={openPay}
                      onPayDraftChange={(value) => {
                        setPayDraft(value);
                        setPayError((current) =>
                          current === 'habitAmount' || current === 'noRate' ? null : current,
                        );
                      }}
                      onPayUnitChange={setPayShownUnit}
                      onPaySubmit={onPaySubmit}
                      onPayCancel={closePay}
                      onCommentText={(value) => {
                        setCommentByHabitId((current) => ({ ...current, [habit.id]: value }));
                        if (habitApi?.where === 'comment' && habitApi.id === habit.id) {
                          setHabitApi(null);
                        }
                      }}
                      onCommentBlur={() => {
                        setCommentTouchedById((current) => ({ ...current, [habit.id]: true }));
                      }}
                      {...(commentError === undefined ? {} : { commentError })}
                      commentBlocked={commentError !== undefined}
                      onPostComment={() => {
                        const text = commentByHabitId[habit.id] ?? '';
                        setCommentTouchedById((current) => ({ ...current, [habit.id]: true }));
                        if (habitTextProblem('comment', text) !== null) {
                          return;
                        }
                        void submit({ action: 'comment', habitId: habit.id, text }, true).then(
                          (saved) => {
                            if (!saved) {
                              return;
                            }
                            setCommentByHabitId((current) => ({ ...current, [habit.id]: '' }));
                            setCommentTouchedById((current) => ({ ...current, [habit.id]: false }));
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
            </div>
          </section>
        ))}
      </div>
    );
  }

  const addNameError = habitFieldError(
    t,
    'name',
    addName,
    addNameTouched,
    habitApi?.where === 'add' && habitApi.field === 'name',
  );
  const addDescriptionError = habitFieldError(
    t,
    'description',
    addDescription,
    false,
    habitApi?.where === 'add' && habitApi.field === 'description',
  );
  const addNotesError = habitFieldError(
    t,
    'notes',
    addNotes,
    false,
    habitApi?.where === 'add' && habitApi.field === 'notes',
  );
  return (
    <Card maxWidth="xl" surface={false}>
      <h1 className="text-center text-2xl font-semibold tracking-tight text-app-fg sm:text-3xl">
        {t('nav.habitTracker')}
      </h1>
      <p className="text-center text-sm text-app-muted">{t('habit.schedule')}</p>
      {body}
      {session !== null ? (
        <details data-habit-create className="w-full">
          <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium text-app-fg">
            {t('habit.add')}
          </summary>
          <form
            className="flex w-full flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              setAddNameTouched(true);
              if (
                habitTextProblem('name', addName) !== null ||
                habitTextProblem('description', addDescription) !== null ||
                habitTextProblem('notes', addNotes) !== null
              ) {
                return;
              }
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
                setAddNameTouched(false);
                setHabitApi(null);
              });
            }}
          >
            <Field
              id="habit-add-name"
              label={t('habit.name')}
              value={addName}
              {...(addNameError === undefined ? {} : { error: addNameError, errorAnnounce: true })}
              onBlur={() => {
                setAddNameTouched(true);
              }}
              onChange={(event) => {
                setAddName(event.target.value);
                if (habitApi?.where === 'add' && habitApi.field === 'name') {
                  setHabitApi(null);
                }
              }}
            />
            <Field
              id="habit-add-description"
              label={t('habit.description')}
              value={addDescription}
              {...(addDescriptionError === undefined
                ? {}
                : { error: addDescriptionError, errorAnnounce: true })}
              onChange={(event) => {
                setAddDescription(event.target.value);
                if (habitApi?.where === 'add' && habitApi.field === 'description') {
                  setHabitApi(null);
                }
              }}
            />
            <Field
              id="habit-add-notes"
              label={t('habit.notes')}
              value={addNotes}
              {...(addNotesError === undefined
                ? {}
                : { error: addNotesError, errorAnnounce: true })}
              onChange={(event) => {
                setAddNotes(event.target.value);
                if (habitApi?.where === 'add' && habitApi.field === 'notes') {
                  setHabitApi(null);
                }
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
            <Button
              type="submit"
              disabled={
                addNameError !== undefined ||
                addDescriptionError !== undefined ||
                addNotesError !== undefined
              }
            >
              {t('habit.add')}
            </Button>
          </form>
        </details>
      ) : null}
    </Card>
  );
}

function groupHabitsByAccount(habits: MemberHabit[], viewerId: string | undefined): HabitGroup[] {
  const groups: HabitGroup[] = [];
  const indexByAccountId = new Map<string, number>();
  for (const habit of habits) {
    const index = indexByAccountId.get(habit.accountId);
    if (index === undefined) {
      indexByAccountId.set(habit.accountId, groups.length);
      groups.push({
        accountId: habit.accountId,
        ownerName: habit.ownerName,
        role: habit.role,
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
  function priority(group: HabitGroup): number {
    if (group.accountId === viewerId) return 0;
    if (group.role === 'founder') return 1;
    if (group.role === 'initiator') return 2;
    if (group.role === 'moderator') return 3;
    return 4;
  }
  return groups.sort(
    (a, b) =>
      priority(a) - priority(b) ||
      a.ownerName.localeCompare(b.ownerName) ||
      a.accountId.localeCompare(b.accountId),
  );
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
