'use client';

import { Check, Loader2, Pencil, Trash2, X } from 'lucide-react';
import { useEffect, useState, type FormEvent, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { Button, Card, Field, IconButton } from '@/components/ui';
import {
  addDailyRosterRecipient,
  deleteDailyRosterRecipient,
  fetchDailyRoster,
  saveDailyRosterComment,
  saveDailyRosterPayments,
  updateDailyRosterRecipient,
} from '@/lib/api';
import type { DailyRoster } from '@/lib/api-types';
import type { MessageKey } from '@/lib/messages';
import type { NumberFormatStyle } from '@/lib/number-format';
import { canEditDailyPayoutRoster } from '@/lib/roles';
import { formatUsdDisplay } from '@/lib/stats-money';
import { useAuthStore } from '@/stores/auth-store';

const SAVE_ERROR_KEYS = [
  'funding.daily.invalidComment',
  'funding.daily.invalidSwitch',
  'funding.daily.invalidRow',
  'funding.daily.duplicate',
  'funding.daily.unknown',
  'funding.daily.saveError',
] as const satisfies readonly MessageKey[];

type SaveErrorKey = (typeof SAVE_ERROR_KEYS)[number];

/** Which stored value is open for editing. At most one. */
type Editing = { kind: 'comment' } | { kind: 'amount'; address: string };

/**
 * Wallet of Satoshi addresses render as `local@w...`. Any other string is unchanged.
 *
 * @param address - Lightning address as stored.
 * @returns The label shown in the roster.
 */
function displayAddress(address: string): string {
  const at = address.lastIndexOf('@');
  if (at < 0) {
    return address;
  }
  const local = address.slice(0, at);
  const domain = address.slice(at + 1);
  if (domain.toLowerCase() === 'walletofsatoshi.com') {
    return `${local}@w...`;
  }
  return address;
}

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

/**
 * Signed-in editor for the daily payout comment, switch, and recipient list.
 *
 * An initiator or founder loads `GET /funding/daily-roster` and may edit the
 * comment or a recipient amount (pencil opens, check saves, X cancels), turn
 * the payments switch, and add or delete a recipient.
 * Everyone else who is signed in sees the heading and a short refusal, and
 * this screen does not fetch. A load that rejects with
 * `funding.daily.forbidden` shows that same refusal. Renders nothing without
 * a session. The page chrome owns the back; this screen renders none.
 *
 * @returns The payments card, refusal copy, or `null` without a session.
 */
export function DailyPaymentsScreen(): ReactElement | null {
  const { t } = useTranslations();
  const { numberFormat } = useNumberFormat();
  const session = useAuthStore((state) => state.session);
  const account = useAuthStore((state) => state.account);
  const editor = canEditDailyPayoutRoster(account?.role);
  const [roster, setRoster] = useState<DailyRoster | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [comment, setComment] = useState('');
  const [editing, setEditing] = useState<Editing | null>(null);
  const [amountDraft, setAmountDraft] = useState('');
  const [addAddress, setAddAddress] = useState('');
  const [addUsd, setAddUsd] = useState('');
  const [pending, setPending] = useState(false);
  const [savingEditor, setSavingEditor] = useState(false);
  const [saveError, setSaveError] = useState<SaveErrorKey | null>(null);

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
        setComment(next.comment);
        setEditing(null);
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

  const heading = (
    <h1 className="text-center text-2xl font-semibold tracking-tight text-app-fg sm:text-3xl">
      {t('funding.daily.heading')}
    </h1>
  );

  if (!editor || forbidden) {
    return (
      <Card maxWidth="xl" surface={false}>
        {heading}
        <p className="text-center text-sm text-app-muted">{t('funding.daily.forbidden')}</p>
      </Card>
    );
  }

  async function runSave(task: () => Promise<DailyRoster>, closeEditor = false): Promise<void> {
    setPending(true);
    if (closeEditor) {
      setSavingEditor(true);
    }
    setSaveError(null);
    try {
      const next = await task();
      setRoster(next);
      setComment(next.comment);
      if (closeEditor) {
        setEditing(null);
      }
    } catch (err) {
      setSaveError(saveErrorKey(err));
    } finally {
      setPending(false);
      setSavingEditor(false);
    }
  }

  const saveIcon = savingEditor ? (
    <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
  ) : (
    <Check aria-hidden="true" className="h-4 w-4" />
  );

  const cancelEdit = (): void => {
    if (roster !== null) {
      setComment(roster.comment);
    }
    setEditing(null);
    setSaveError(null);
  };

  const onSaveComment = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void runSave(() => saveDailyRosterComment(session, comment), true);
  };

  const onSaveAmount = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (editing === null || editing.kind !== 'amount') {
      return;
    }
    const amountUsd = parseUsd(amountDraft);
    if (amountUsd === null) {
      setSaveError('funding.daily.invalidRow');
      return;
    }
    const address = editing.address;
    void runSave(() => updateDailyRosterRecipient(session, address, amountUsd), true);
  };

  const onAdd = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const amountUsd = parseUsd(addUsd);
    if (amountUsd === null) {
      setSaveError('funding.daily.invalidRow');
      return;
    }
    void runSave(async () => {
      const next = await addDailyRosterRecipient(session, addAddress, amountUsd);
      setAddAddress('');
      setAddUsd('');
      return next;
    });
  };

  let body: ReactElement;
  if (loadError) {
    body = (
      <>
        <p role="alert" className="text-center text-sm text-app-danger">
          {t('funding.daily.error')}
        </p>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setAttempt((n) => n + 1);
          }}
        >
          {t('moderate.retry')}
        </Button>
      </>
    );
  } else if (roster === null) {
    body = <p className="text-center text-sm text-app-muted">{t('moderate.loading')}</p>;
  } else {
    body = (
      <>
        <p className="text-center text-sm text-app-fg">
          {t('funding.daily.defaultNote', {
            amount: formatUsdDisplay(String(roster.defaultAmountUsd), numberFormat),
          })}
        </p>
        {saveError === null ? null : (
          <p role="alert" className="text-center text-sm text-app-danger">
            {t(saveError)}
          </p>
        )}
        {editing?.kind === 'comment' ? (
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
              onClick={cancelEdit}
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </IconButton>
          </form>
        ) : (
          <div className="flex w-full flex-col gap-1 text-left text-sm text-app-fg">
            <p>{t('funding.daily.commentLabel')}</p>
            <div className="flex items-start gap-2">
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
                  setEditing({ kind: 'comment' });
                  setSaveError(null);
                }}
              >
                <Pencil aria-hidden="true" className="h-4 w-4" />
              </IconButton>
            </div>
          </div>
        )}
        <h2 className="text-center text-sm font-semibold tracking-wide text-app-muted uppercase">
          {t('funding.daily.recipients')}
        </h2>
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
              void runSave(() => saveDailyRosterPayments(session, true));
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
              void runSave(() => saveDailyRosterPayments(session, false));
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
              const display = displayAddress(row.address);
              const rowEditing = editing?.kind === 'amount' && editing.address === row.address;
              return (
                <li
                  key={row.address}
                  className="flex w-full flex-col gap-3 rounded-2xl border border-app-border bg-app-card-muted px-4 py-3"
                >
                  <span className="truncate text-sm text-app-fg" title={row.address}>
                    {display}
                  </span>
                  {rowEditing ? (
                    <form className="flex w-full items-end gap-2" onSubmit={onSaveAmount}>
                      <Field
                        className="min-w-0 flex-1"
                        label={t('funding.daily.usd')}
                        id={`daily-usd-${row.address}`}
                        value={amountDraft}
                        inputMode="decimal"
                        disabled={pending}
                        aria-label={`${t('funding.daily.usd')} ${display}`}
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
                        onClick={cancelEdit}
                      >
                        <X aria-hidden="true" className="h-4 w-4" />
                      </IconButton>
                    </form>
                  ) : (
                    <div className="flex w-full items-center gap-2">
                      <p className="min-w-0 flex-1 text-sm text-app-fg">
                        {formatUsdDisplay(String(row.amountUsd), numberFormat)}
                      </p>
                      <IconButton
                        type="button"
                        variant="secondary"
                        size="md"
                        aria-label={`${t('funding.daily.edit')} ${display}`}
                        disabled={pending}
                        onClick={() => {
                          setAmountDraft(String(row.amountUsd));
                          setEditing({ kind: 'amount', address: row.address });
                          setSaveError(null);
                        }}
                      >
                        <Pencil aria-hidden="true" className="h-4 w-4" />
                      </IconButton>
                      <IconButton
                        type="button"
                        variant="secondary"
                        size="md"
                        aria-label={`${t('funding.daily.delete')} ${display}`}
                        disabled={pending}
                        onClick={() => {
                          void runSave(() => deleteDailyRosterRecipient(session, row.address));
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
              <span>{formatUsdTotal(roster, numberFormat)}</span>
            </li>
          </ul>
        )}
        <form className="flex w-full flex-col gap-3" onSubmit={onAdd}>
          <Field
            label={t('funding.daily.address')}
            value={addAddress}
            autoComplete="off"
            disabled={pending}
            onChange={(event) => {
              setAddAddress(event.target.value);
            }}
          />
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
    <Card maxWidth="xl" surface={false}>
      {heading}
      {body}
    </Card>
  );
}
