'use client';

import { Check, Loader2, Pencil, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, type FormEvent, type ReactElement, type ReactNode } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { Button, Card, Field, IconButton } from '@/components/ui';
import {
  addDailyRosterModerator,
  addDailyRosterRecipient,
  deleteDailyRosterModerator,
  deleteDailyRosterRecipient,
  fetchDailyRoster,
  saveDailyRosterComment,
  saveDailyRosterModeratorPayments,
  saveDailyRosterPayments,
  updateDailyRosterModerator,
  updateDailyRosterRecipient,
} from '@/lib/api';
import type { DailyRoster } from '@/lib/api-types';
import { searchMentionAccounts } from '@/lib/mention-search';
import type { MessageKey } from '@/lib/messages';
import type { NumberFormatStyle } from '@/lib/number-format';
import { canEditDailyPayoutRoster } from '@/lib/roles';
import { formatUsdDisplay } from '@/lib/stats-money';
import { useAuthStore } from '@/stores/auth-store';

const SAVE_ERROR_KEYS = [
  'funding.daily.invalidComment',
  'funding.daily.invalidSwitch',
  'funding.daily.invalidRow',
  'funding.daily.invalidPerson',
  'funding.daily.duplicate',
  'funding.daily.unknown',
  'funding.daily.unknownPerson',
  'funding.daily.noLightning',
  'funding.daily.saveError',
] as const satisfies readonly MessageKey[];

type SaveErrorKey = (typeof SAVE_ERROR_KEYS)[number] | 'funding.daily.pickPerson';

type DailyPerson = { id: string; username: string; name: string };

const PERSON_QUERY = /^[a-z0-9][a-z0-9._-]{0,31}$/;

/**
 * Parse a typed USD amount. Numeric strings are not accepted by the api, so
 * this returns a real finite number greater than 0, or `null`.
 *
 * @param raw - Field text.
 * @returns The amount, or `null` when it must not be posted.
 */
function parseUsd(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(trimmed)) {
    return null;
  }
  const value = Number(trimmed);
  if (value <= 0) {
    return null;
  }
  return value;
}

/**
 * Username prefix after a leading `@`, or `null` when the field is not a mention.
 *
 * Empty string means the field is exactly `@` and the first suggestion page applies.
 * Any space, including a trailing one, is not a username and closes the list.
 *
 * @param draft - Current person field text.
 * @returns The lowercase prefix, `""`, or `null`.
 */
function mentionQuery(draft: string): string | null {
  if (draft === '@') {
    return '';
  }
  if (!draft.startsWith('@') || draft.includes(' ')) {
    return null;
  }
  const query = draft.slice(1).toLowerCase();
  if (!PERSON_QUERY.test(query)) {
    return null;
  }
  return query;
}

/**
 * Sum recipient USD amounts, rounded to cents for the Total row.
 *
 * @param roster - Loaded roster.
 * @param style - Visitor grouping style.
 * @returns Display text for the total, USD with two decimals.
 */
function formatUsdTotal(roster: DailyRoster, style: NumberFormatStyle): string {
  const sum = roster.recipients.reduce((acc, row) => acc + row.amountUsd, 0);
  const cents = Math.round(sum * 100) / 100;
  return formatUsdDisplay(String(cents), style);
}

/**
 * Sum moderator USD amounts, rounded to cents for the Total row.
 *
 * @param roster - Loaded roster.
 * @param style - Visitor grouping style.
 * @returns Display text for the moderator total, USD with two decimals.
 */
function formatUsdModeratorTotal(roster: DailyRoster, style: NumberFormatStyle): string {
  const sum = roster.moderators.reduce((acc, row) => acc + row.amountUsd, 0);
  const cents = Math.round(sum * 100) / 100;
  return formatUsdDisplay(String(cents), style);
}

/**
 * Map a save failure to a catalog key. Unknown failures use the generic save error.
 *
 * @param err - Rejection from a daily-roster POST.
 * @returns A `funding.daily.*` key.
 */
function saveErrorKey(err: unknown): SaveErrorKey {
  if (err instanceof Error) {
    for (const key of SAVE_ERROR_KEYS) {
      if (err.message === key) {
        return key;
      }
    }
  }
  return 'funding.daily.saveError';
}

/** Page alerts sit above the roster. Add-form alerts sit on that form. */
type SaveErrorPlace = 'page' | 'add';

type RosterLoad = {
  session: string;
  editor: boolean;
  roster: DailyRoster | null;
  loadError: boolean;
  forbidden: boolean;
  pending: boolean;
  savingEditor: boolean;
  saveError: SaveErrorKey | null;
  saveErrorPlace: SaveErrorPlace;
  setSaveError: (error: SaveErrorKey | null, place?: SaveErrorPlace) => void;
  attempt: number;
  retry: () => void;
  runSave: (
    task: () => Promise<DailyRoster>,
    closeEditor?: boolean,
    place?: SaveErrorPlace,
  ) => Promise<boolean>;
};

/**
 * Load the daily roster for an initiator or founder. Everyone else is refused
 * without a fetch. A missing session is `null` so the page renders nothing.
 *
 * @returns The load, or `null` without a session.
 */
function useDailyRoster(): RosterLoad | null {
  const session = useAuthStore((state) => state.session);
  const account = useAuthStore((state) => state.account);
  const editor = canEditDailyPayoutRoster(account?.role);
  const [roster, setRoster] = useState<DailyRoster | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState(false);
  const [savingEditor, setSavingEditor] = useState(false);
  const [saveError, setSaveErrorState] = useState<SaveErrorKey | null>(null);
  const [saveErrorPlace, setSaveErrorPlace] = useState<SaveErrorPlace>('page');
  const setSaveError = (error: SaveErrorKey | null, place: SaveErrorPlace = 'page'): void => {
    setSaveErrorState(error);
    setSaveErrorPlace(place);
  };

  useEffect(() => {
    if (session === null || !editor) {
      return;
    }
    let cancelled = false;
    setLoadError(false);
    setForbidden(false);
    void (async () => {
      try {
        const next = await fetchDailyRoster(session);
        if (cancelled) {
          return;
        }
        setRoster(next);
      } catch (err) {
        if (cancelled) {
          return;
        }
        setRoster(null);
        if (err instanceof Error && err.message === 'funding.daily.forbidden') {
          setForbidden(true);
          return;
        }
        setLoadError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, editor, attempt]);

  if (session === null) {
    return null;
  }

  const runSave = async (
    task: () => Promise<DailyRoster>,
    closeEditor = false,
    place: SaveErrorPlace = 'page',
  ): Promise<boolean> => {
    setPending(true);
    if (closeEditor) {
      setSavingEditor(true);
    }
    setSaveError(null);
    let saved = false;
    try {
      const next = await task();
      setRoster(next);
      saved = true;
    } catch (err) {
      setSaveError(saveErrorKey(err), place);
    } finally {
      setPending(false);
      setSavingEditor(false);
    }
    // A return inside try and catch leaves this finally branch uncovered.
    return saved;
  };

  return {
    session,
    editor,
    roster,
    loadError,
    forbidden,
    pending,
    savingEditor,
    saveError,
    saveErrorPlace,
    setSaveError,
    attempt,
    retry: () => {
      setAttempt((n) => n + 1);
    },
    runSave,
  };
}

/**
 * Shared card for one daily-payments subpage: heading, refusal, load failure,
 * or the loaded editor.
 *
 * @returns The card. The caller has already returned `null` without a session.
 */
function DailyRosterCard({
  title,
  blocked,
  loadError,
  loading,
  onRetry,
  children,
}: {
  title: string;
  blocked: boolean;
  loadError: boolean;
  loading: boolean;
  onRetry: () => void;
  children: ReactNode;
}): ReactElement {
  const { t } = useTranslations();
  const heading = (
    <h1 className="text-center text-2xl font-semibold tracking-tight text-app-fg sm:text-3xl">
      {title}
    </h1>
  );
  let body: ReactNode;
  if (blocked) {
    body = <p className="text-center text-sm text-app-muted">{t('funding.daily.forbidden')}</p>;
  } else if (loadError) {
    body = (
      <>
        <p role="alert" className="text-center text-sm text-app-danger">
          {t('funding.daily.error')}
        </p>
        <Button type="button" variant="secondary" onClick={onRetry}>
          {t('moderate.retry')}
        </Button>
      </>
    );
  } else if (loading) {
    body = <p className="text-center text-sm text-app-muted">{t('moderate.loading')}</p>;
  } else {
    body = children;
  }
  return (
    <Card maxWidth="xl" surface={false}>
      {heading}
      {body}
    </Card>
  );
}

/**
 * Signed-in editor for the daily payout comment only.
 *
 * An initiator or founder loads `GET /funding/daily-roster` and may edit the
 * comment (pencil opens, check saves, X cancels). Amounts, the payments
 * switch, and the recipient list are not on this page. Everyone else who is
 * signed in sees the heading and a short refusal, and this screen does not
 * fetch. Renders nothing without a session. The page chrome owns the back.
 *
 * @returns The comment card, refusal copy, or `null` without a session.
 */
export function DailyPaymentCommentScreen(): ReactElement | null {
  const { t } = useTranslations();
  const load = useDailyRoster();
  const [comment, setComment] = useState('');
  const [editing, setEditing] = useState(false);
  const attempt = load === null ? 0 : load.attempt;

  useEffect(() => {
    setEditing(false);
  }, [attempt]);

  if (load === null) {
    return null;
  }

  const { session, editor, roster, loadError, forbidden, pending, savingEditor, saveError } = load;
  const saveIcon = savingEditor ? (
    <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
  ) : (
    <Check aria-hidden="true" className="h-4 w-4" />
  );

  const onSaveComment = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void load
      .runSave(() => saveDailyRosterComment(session, comment), true)
      .then((saved) => {
        if (saved) {
          setEditing(false);
        }
      });
  };

  let editorBody: ReactNode = null;
  if (roster !== null && editor && !forbidden) {
    editorBody = (
      <>
        {saveError === null ? null : (
          <p role="alert" className="text-center text-sm text-app-danger">
            {t(saveError)}
          </p>
        )}
        {editing ? (
          <form className="flex w-full items-end gap-2" onSubmit={onSaveComment}>
            <Field
              className="min-w-0 flex-1"
              multiline
              label={t('funding.daily.commentLabel')}
              value={comment}
              rows={3}
              disabled={pending}
              onChange={(event) => {
                setComment(event.target.value);
              }}
            />
            <IconButton
              type="submit"
              variant="primary"
              size="md"
              aria-label={t('funding.daily.save')}
              disabled={pending}
            >
              {saveIcon}
            </IconButton>
            <IconButton
              type="button"
              variant="secondary"
              size="md"
              aria-label={t('funding.daily.cancel')}
              disabled={pending}
              onClick={() => {
                setEditing(false);
                load.setSaveError(null);
              }}
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </IconButton>
          </form>
        ) : (
          <div className="flex w-full items-start gap-2 text-left">
            <p
              className={
                roster.comment.trim() === ''
                  ? 'min-w-0 flex-1 whitespace-pre-wrap text-sm text-app-muted'
                  : 'min-w-0 flex-1 whitespace-pre-wrap text-sm text-app-fg'
              }
            >
              {roster.comment.trim() === '' ? t('funding.daily.commentEmpty') : roster.comment}
            </p>
            <IconButton
              type="button"
              variant="secondary"
              size="md"
              aria-label={t('funding.daily.editComment')}
              disabled={pending}
              onClick={() => {
                setComment(roster.comment);
                setEditing(true);
                load.setSaveError(null);
              }}
            >
              <Pencil aria-hidden="true" className="h-4 w-4" />
            </IconButton>
          </div>
        )}
      </>
    );
  }

  return (
    <DailyRosterCard
      title={t('funding.daily.commentHeading')}
      blocked={!editor || forbidden}
      loadError={loadError}
      loading={roster === null}
      onRetry={load.retry}
    >
      {editorBody}
    </DailyRosterCard>
  );
}

/**
 * Signed-in editor for daily payout amounts only.
 *
 * An initiator or founder loads `GET /funding/daily-roster` and may turn the
 * payments switch and add, update, or delete a recipient. The comment is not
 * on this page. A row pencil opens the amount (`Field`, not `AmountEntry`);
 * the check saves and the X cancels. Everyone else who is signed in sees the
 * heading and a short refusal, and this screen does not fetch. Renders nothing
 * without a session. The page chrome owns the back.
 *
 * @returns The amounts card, refusal copy, or `null` without a session.
 */
export function DailyPaymentAmountsScreen(): ReactElement | null {
  const { t } = useTranslations();
  const { numberFormat } = useNumberFormat();
  const load = useDailyRoster();
  const [editingAddress, setEditingAddress] = useState<string | null>(null);
  const [amountDraft, setAmountDraft] = useState('');
  const [addQuery, setAddQuery] = useState('');
  const [addPerson, setAddPerson] = useState<DailyPerson | null>(null);
  const [seed, setSeed] = useState<readonly DailyPerson[]>([]);
  const [remote, setRemote] = useState<{
    query: string;
    rows: readonly DailyPerson[];
  } | null>(null);
  const [addUsd, setAddUsd] = useState('');
  const attempt = load === null ? 0 : load.attempt;
  const sessionToken = load === null ? null : load.session;
  const query = sessionToken === null ? null : mentionQuery(addQuery);

  useEffect(() => {
    setEditingAddress(null);
  }, [attempt]);

  useEffect(() => {
    if (sessionToken === null || query === null) {
      setSeed([]);
      setRemote(null);
      return;
    }
    const current = sessionToken;
    const requested = query;
    let cancelled = false;
    if (requested !== '') {
      setRemote(null);
    }
    void searchMentionAccounts(current, requested)
      .then((rows) => {
        if (cancelled) {
          return;
        }
        if (requested === '') {
          setSeed(rows);
          return;
        }
        setRemote({ query: requested, rows });
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        if (requested === '') {
          setSeed([]);
          return;
        }
        setRemote({ query: requested, rows: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [query, sessionToken]);

  if (load === null) {
    return null;
  }

  const {
    session,
    editor,
    roster,
    loadError,
    forbidden,
    pending,
    savingEditor,
    saveError,
    saveErrorPlace,
  } = load;
  const saveIcon = savingEditor ? (
    <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
  ) : (
    <Check aria-hidden="true" className="h-4 w-4" />
  );
  const shown =
    query === null
      ? []
      : query === ''
        ? seed
        : remote !== null && remote.query === query
          ? remote.rows
          : seed.filter((row) => row.username.toLowerCase().startsWith(query));

  const onSaveAmount = (event: FormEvent<HTMLFormElement>, address: string): void => {
    event.preventDefault();
    const amountUsd = parseUsd(amountDraft);
    if (amountUsd === null) {
      load.setSaveError('funding.daily.invalidRow');
      return;
    }
    void load
      .runSave(() => updateDailyRosterRecipient(session, address, amountUsd), true)
      .then((saved) => {
        if (saved) {
          setEditingAddress(null);
        }
      });
  };

  const onAdd = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const amountUsd = parseUsd(addUsd);
    if (amountUsd === null) {
      load.setSaveError('funding.daily.invalidRow', 'add');
      return;
    }
    if (addPerson === null) {
      load.setSaveError('funding.daily.pickPerson', 'add');
      return;
    }
    const accountId = addPerson.id;
    void load.runSave(
      async () => {
        const next = await addDailyRosterRecipient(session, accountId, amountUsd);
        setAddPerson(null);
        setAddQuery('');
        setAddUsd('');
        return next;
      },
      false,
      'add',
    );
  };

  let editorBody: ReactNode = null;
  if (roster !== null && editor && !forbidden) {
    editorBody = (
      <>
        <p className="text-center text-sm text-app-fg">
          {t('funding.daily.defaultNote', {
            amount: formatUsdDisplay(String(roster.defaultAmountUsd), numberFormat),
          })}
        </p>
        {saveError === null || saveErrorPlace === 'add' ? null : (
          <p role="alert" className="text-center text-sm text-app-danger">
            {t(saveError)}
          </p>
        )}
        <p className="text-center text-xs font-medium tracking-widest uppercase text-app-subtle">
          {t('funding.daily.recipients')}
        </p>
        <div
          role="group"
          aria-label={t('funding.daily.payments')}
          className="flex w-full flex-wrap items-center justify-center gap-3"
        >
          <span className="text-sm text-app-fg">{t('funding.daily.payments')}</span>
          <Button
            type="button"
            variant={roster.paymentsEnabled ? 'primary' : 'secondary'}
            aria-pressed={roster.paymentsEnabled}
            disabled={pending}
            onClick={() => {
              void load.runSave(() => saveDailyRosterPayments(session, true));
            }}
          >
            {t('funding.daily.on')}
          </Button>
          <Button
            type="button"
            variant={roster.paymentsEnabled ? 'secondary' : 'primary'}
            aria-pressed={!roster.paymentsEnabled}
            disabled={pending}
            onClick={() => {
              void load.runSave(() => saveDailyRosterPayments(session, false));
            }}
          >
            {t('funding.daily.off')}
          </Button>
        </div>
        {roster.recipients.length === 0 ? (
          <p className="text-center text-sm text-app-muted">{t('funding.daily.empty')}</p>
        ) : (
          <ul aria-label={t('funding.daily.recipients')} className="flex w-full flex-col gap-3">
            {roster.recipients.map((row) => {
              const label = row.name !== null && row.name !== '' ? row.name : t('moderate.unnamed');
              const rowEditing = editingAddress === row.address;
              return (
                <li
                  key={row.address}
                  className="flex w-full flex-col gap-3 rounded-2xl border border-app-border bg-app-card-muted px-4 py-3"
                >
                  {row.accountId !== null ? (
                    <Link
                      href={`/members/${row.accountId}`}
                      className="block truncate text-sm font-medium text-app-fg underline underline-offset-2"
                    >
                      {label}
                    </Link>
                  ) : (
                    <span className="block truncate text-sm text-app-fg">{label}</span>
                  )}
                  {rowEditing ? (
                    <form
                      className="flex w-full items-end gap-2"
                      onSubmit={(event) => {
                        onSaveAmount(event, row.address);
                      }}
                    >
                      <Field
                        className="min-w-0 flex-1"
                        label={t('funding.daily.usd')}
                        id={`daily-usd-${row.address}`}
                        value={amountDraft}
                        inputMode="decimal"
                        disabled={pending}
                        aria-label={`${t('funding.daily.usd')} ${label}`}
                        onChange={(event) => {
                          setAmountDraft(event.target.value);
                        }}
                      />
                      <IconButton
                        type="submit"
                        variant="primary"
                        size="md"
                        aria-label={t('funding.daily.save')}
                        disabled={pending}
                      >
                        {saveIcon}
                      </IconButton>
                      <IconButton
                        type="button"
                        variant="secondary"
                        size="md"
                        aria-label={t('funding.daily.cancel')}
                        disabled={pending}
                        onClick={() => {
                          setEditingAddress(null);
                          load.setSaveError(null);
                        }}
                      >
                        <X aria-hidden="true" className="h-4 w-4" />
                      </IconButton>
                    </form>
                  ) : (
                    <div className="flex w-full items-center gap-2">
                      <p className="min-w-0 flex-1 text-sm font-semibold tabular-nums lining-nums text-app-fg">
                        {formatUsdDisplay(String(row.amountUsd), numberFormat)}
                      </p>
                      <IconButton
                        type="button"
                        variant="secondary"
                        size="md"
                        aria-label={`${t('funding.daily.edit')} ${label}`}
                        disabled={pending}
                        onClick={() => {
                          setAmountDraft(String(row.amountUsd));
                          setEditingAddress(row.address);
                          load.setSaveError(null);
                        }}
                      >
                        <Pencil aria-hidden="true" className="h-4 w-4" />
                      </IconButton>
                      <IconButton
                        type="button"
                        variant="secondary"
                        size="md"
                        aria-label={`${t('funding.daily.delete')} ${label}`}
                        disabled={pending}
                        onClick={() => {
                          void load.runSave(() => deleteDailyRosterRecipient(session, row.address));
                        }}
                      >
                        <Trash2 aria-hidden="true" className="h-4 w-4" />
                      </IconButton>
                    </div>
                  )}
                </li>
              );
            })}
            <li className="flex w-full items-baseline justify-between gap-3 px-4 text-sm text-app-fg">
              <span>{t('funding.daily.total')}</span>
              <span className="font-semibold tabular-nums lining-nums">
                {formatUsdTotal(roster, numberFormat)}
              </span>
            </li>
          </ul>
        )}
        <form className="flex w-full flex-col gap-3" onSubmit={onAdd}>
          {saveError === null || saveErrorPlace !== 'add' ? null : (
            <p role="alert" className="text-center text-sm text-app-danger">
              {t(saveError)}
            </p>
          )}
          <Field
            label={t('funding.daily.person')}
            id="daily-person-add"
            value={addQuery}
            autoComplete="off"
            disabled={pending}
            aria-autocomplete="list"
            aria-controls="daily-person-add-list"
            aria-expanded={shown.length > 0}
            onChange={(event) => {
              const next = event.target.value;
              setAddQuery(next);
              if (
                addPerson !== null &&
                next.trim().toLowerCase() !== `@${addPerson.username.toLowerCase()}`
              ) {
                setAddPerson(null);
              }
            }}
          />
          <ul
            id="daily-person-add-list"
            role="listbox"
            aria-label={t('forum.mentionSuggest')}
            className={
              shown.length === 0
                ? 'hidden'
                : 'flex w-full flex-col rounded-xl border border-app-border bg-app-card p-2'
            }
          >
            {shown.map((account) => (
              <li key={account.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-label={`@${account.username}`}
                  aria-selected={
                    addQuery.trim().toLowerCase() === `@${account.username.toLowerCase()}`
                  }
                  disabled={pending}
                  className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-app-fg hover:bg-app-hover"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    setAddPerson(account);
                    setAddQuery(`@${account.username}`);
                  }}
                  onClick={() => {
                    setAddPerson(account);
                    setAddQuery(`@${account.username}`);
                  }}
                >
                  <span className="font-medium">@{account.username}</span>
                  {account.name !== account.username ? (
                    <span className="text-app-muted">{account.name}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
          <Field
            label={t('funding.daily.usd')}
            id="daily-usd-add"
            value={addUsd}
            inputMode="decimal"
            disabled={pending}
            onChange={(event) => {
              setAddUsd(event.target.value);
            }}
          />
          <Button type="submit" disabled={pending}>
            {t('funding.daily.add')}
          </Button>
        </form>
      </>
    );
  }

  return (
    <DailyRosterCard
      title={t('funding.daily.amountsHeading')}
      blocked={!editor || forbidden}
      loadError={loadError}
      loading={roster === null}
      onRetry={load.retry}
    >
      {editorBody}
    </DailyRosterCard>
  );
}

/**
 * Signed-in editor for moderator stipend amounts only.
 *
 * An initiator or founder loads `GET /funding/daily-roster` and may turn the
 * moderator payments switch and add, update, or delete a moderator. The
 * comment, the recipient list, and the daily payments switch are not on this
 * page. A row pencil opens the amount (`Field`, not `AmountEntry`); the check
 * saves and the X cancels. Everyone else who is signed in sees the heading
 * and a short refusal, and this screen does not fetch. Renders nothing
 * without a session. The page chrome owns the back.
 *
 * @returns The moderator card, refusal copy, or `null` without a session.
 */
export function DailyPaymentModeratorsScreen(): ReactElement | null {
  const { t } = useTranslations();
  const { numberFormat } = useNumberFormat();
  const load = useDailyRoster();
  const [editingAddress, setEditingAddress] = useState<string | null>(null);
  const [amountDraft, setAmountDraft] = useState('');
  const [addQuery, setAddQuery] = useState('');
  const [addPerson, setAddPerson] = useState<DailyPerson | null>(null);
  const [seed, setSeed] = useState<readonly DailyPerson[]>([]);
  const [remote, setRemote] = useState<{
    query: string;
    rows: readonly DailyPerson[];
  } | null>(null);
  const [addUsd, setAddUsd] = useState('');
  const attempt = load === null ? 0 : load.attempt;
  const sessionToken = load === null ? null : load.session;
  const query = sessionToken === null ? null : mentionQuery(addQuery);

  useEffect(() => {
    setEditingAddress(null);
  }, [attempt]);

  useEffect(() => {
    if (sessionToken === null || query === null) {
      setSeed([]);
      setRemote(null);
      return;
    }
    const current = sessionToken;
    const requested = query;
    let cancelled = false;
    if (requested !== '') {
      setRemote(null);
    }
    void searchMentionAccounts(current, requested)
      .then((rows) => {
        if (cancelled) {
          return;
        }
        if (requested === '') {
          setSeed(rows);
          return;
        }
        setRemote({ query: requested, rows });
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        if (requested === '') {
          setSeed([]);
          return;
        }
        setRemote({ query: requested, rows: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [query, sessionToken]);

  if (load === null) {
    return null;
  }

  const {
    session,
    editor,
    roster,
    loadError,
    forbidden,
    pending,
    savingEditor,
    saveError,
    saveErrorPlace,
  } = load;
  const saveIcon = savingEditor ? (
    <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
  ) : (
    <Check aria-hidden="true" className="h-4 w-4" />
  );
  const shown =
    query === null
      ? []
      : query === ''
        ? seed
        : remote !== null && remote.query === query
          ? remote.rows
          : seed.filter((row) => row.username.toLowerCase().startsWith(query));

  const onSaveAmount = (event: FormEvent<HTMLFormElement>, address: string): void => {
    event.preventDefault();
    const amountUsd = parseUsd(amountDraft);
    if (amountUsd === null) {
      load.setSaveError('funding.daily.invalidRow');
      return;
    }
    void load
      .runSave(() => updateDailyRosterModerator(session, address, amountUsd), true)
      .then((saved) => {
        if (saved) {
          setEditingAddress(null);
        }
      });
  };

  const onAdd = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const amountUsd = parseUsd(addUsd);
    if (amountUsd === null) {
      load.setSaveError('funding.daily.invalidRow', 'add');
      return;
    }
    if (addPerson === null) {
      load.setSaveError('funding.daily.pickPerson', 'add');
      return;
    }
    const accountId = addPerson.id;
    void load.runSave(
      async () => {
        const next = await addDailyRosterModerator(session, accountId, amountUsd);
        setAddPerson(null);
        setAddQuery('');
        setAddUsd('');
        return next;
      },
      false,
      'add',
    );
  };

  let editorBody: ReactNode = null;
  if (roster !== null && editor && !forbidden) {
    editorBody = (
      <>
        {saveError === null || saveErrorPlace === 'add' ? null : (
          <p role="alert" className="text-center text-sm text-app-danger">
            {t(saveError)}
          </p>
        )}
        <p className="text-center text-xs font-medium tracking-widest uppercase text-app-subtle">
          {t('funding.daily.moderators')}
        </p>
        <div
          role="group"
          aria-label={t('funding.daily.payments')}
          className="flex w-full flex-wrap items-center justify-center gap-3"
        >
          <span className="text-sm text-app-fg">{t('funding.daily.payments')}</span>
          <Button
            type="button"
            variant={roster.moderatorPaymentsEnabled ? 'primary' : 'secondary'}
            aria-pressed={roster.moderatorPaymentsEnabled}
            disabled={pending}
            onClick={() => {
              void load.runSave(() => saveDailyRosterModeratorPayments(session, true));
            }}
          >
            {t('funding.daily.on')}
          </Button>
          <Button
            type="button"
            variant={roster.moderatorPaymentsEnabled ? 'secondary' : 'primary'}
            aria-pressed={!roster.moderatorPaymentsEnabled}
            disabled={pending}
            onClick={() => {
              void load.runSave(() => saveDailyRosterModeratorPayments(session, false));
            }}
          >
            {t('funding.daily.off')}
          </Button>
        </div>
        {roster.moderators.length === 0 ? (
          <p className="text-center text-sm text-app-muted">{t('funding.daily.moderatorsEmpty')}</p>
        ) : (
          <ul aria-label={t('funding.daily.moderators')} className="flex w-full flex-col gap-3">
            {roster.moderators.map((row) => {
              const label = row.name !== null && row.name !== '' ? row.name : t('moderate.unnamed');
              const rowEditing = editingAddress === row.address;
              return (
                <li
                  key={row.address}
                  className="flex w-full flex-col gap-3 rounded-2xl border border-app-border bg-app-card-muted px-4 py-3"
                >
                  {row.accountId !== null ? (
                    <Link
                      href={`/members/${row.accountId}`}
                      className="block truncate text-sm font-medium text-app-fg underline underline-offset-2"
                    >
                      {label}
                    </Link>
                  ) : (
                    <span className="block truncate text-sm text-app-fg">{label}</span>
                  )}
                  {rowEditing ? (
                    <form
                      className="flex w-full items-end gap-2"
                      onSubmit={(event) => {
                        onSaveAmount(event, row.address);
                      }}
                    >
                      <Field
                        className="min-w-0 flex-1"
                        label={t('funding.daily.usd')}
                        id={`moderator-usd-${row.address}`}
                        value={amountDraft}
                        inputMode="decimal"
                        disabled={pending}
                        aria-label={`${t('funding.daily.usd')} ${label}`}
                        onChange={(event) => {
                          setAmountDraft(event.target.value);
                        }}
                      />
                      <IconButton
                        type="submit"
                        variant="primary"
                        size="md"
                        aria-label={t('funding.daily.save')}
                        disabled={pending}
                      >
                        {saveIcon}
                      </IconButton>
                      <IconButton
                        type="button"
                        variant="secondary"
                        size="md"
                        aria-label={t('funding.daily.cancel')}
                        disabled={pending}
                        onClick={() => {
                          setEditingAddress(null);
                          load.setSaveError(null);
                        }}
                      >
                        <X aria-hidden="true" className="h-4 w-4" />
                      </IconButton>
                    </form>
                  ) : (
                    <div className="flex w-full items-center gap-2">
                      <p className="min-w-0 flex-1 text-sm font-semibold tabular-nums lining-nums text-app-fg">
                        {formatUsdDisplay(String(row.amountUsd), numberFormat)}
                      </p>
                      <IconButton
                        type="button"
                        variant="secondary"
                        size="md"
                        aria-label={`${t('funding.daily.edit')} ${label}`}
                        disabled={pending}
                        onClick={() => {
                          setAmountDraft(String(row.amountUsd));
                          setEditingAddress(row.address);
                          load.setSaveError(null);
                        }}
                      >
                        <Pencil aria-hidden="true" className="h-4 w-4" />
                      </IconButton>
                      <IconButton
                        type="button"
                        variant="secondary"
                        size="md"
                        aria-label={`${t('funding.daily.delete')} ${label}`}
                        disabled={pending}
                        onClick={() => {
                          void load.runSave(() => deleteDailyRosterModerator(session, row.address));
                        }}
                      >
                        <Trash2 aria-hidden="true" className="h-4 w-4" />
                      </IconButton>
                    </div>
                  )}
                </li>
              );
            })}
            <li className="flex w-full items-baseline justify-between gap-3 px-4 text-sm text-app-fg">
              <span>{t('funding.daily.total')}</span>
              <span className="font-semibold tabular-nums lining-nums">
                {formatUsdModeratorTotal(roster, numberFormat)}
              </span>
            </li>
          </ul>
        )}
        <form className="flex w-full flex-col gap-3" onSubmit={onAdd}>
          {saveError === null || saveErrorPlace !== 'add' ? null : (
            <p role="alert" className="text-center text-sm text-app-danger">
              {t(saveError)}
            </p>
          )}
          <Field
            label={t('funding.daily.person')}
            id="moderator-person-add"
            value={addQuery}
            autoComplete="off"
            disabled={pending}
            aria-autocomplete="list"
            aria-controls="moderator-person-add-list"
            aria-expanded={shown.length > 0}
            onChange={(event) => {
              const next = event.target.value;
              setAddQuery(next);
              if (
                addPerson !== null &&
                next.trim().toLowerCase() !== `@${addPerson.username.toLowerCase()}`
              ) {
                setAddPerson(null);
              }
            }}
          />
          <ul
            id="moderator-person-add-list"
            role="listbox"
            aria-label={t('forum.mentionSuggest')}
            className={
              shown.length === 0
                ? 'hidden'
                : 'flex w-full flex-col rounded-xl border border-app-border bg-app-card p-2'
            }
          >
            {shown.map((account) => (
              <li key={account.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-label={`@${account.username}`}
                  aria-selected={
                    addQuery.trim().toLowerCase() === `@${account.username.toLowerCase()}`
                  }
                  disabled={pending}
                  className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-app-fg hover:bg-app-hover"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    setAddPerson(account);
                    setAddQuery(`@${account.username}`);
                  }}
                  onClick={() => {
                    setAddPerson(account);
                    setAddQuery(`@${account.username}`);
                  }}
                >
                  <span className="font-medium">@{account.username}</span>
                  {account.name !== account.username ? (
                    <span className="text-app-muted">{account.name}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
          <Field
            label={t('funding.daily.usd')}
            id="moderator-usd-add"
            value={addUsd}
            inputMode="decimal"
            disabled={pending}
            onChange={(event) => {
              setAddUsd(event.target.value);
            }}
          />
          <Button type="submit" disabled={pending}>
            {t('funding.daily.add')}
          </Button>
        </form>
      </>
    );
  }

  return (
    <DailyRosterCard
      title={t('funding.daily.moderatorsHeading')}
      blocked={!editor || forbidden}
      loadError={loadError}
      loading={roster === null}
      onRetry={load.retry}
    >
      {editorBody}
    </DailyRosterCard>
  );
}
