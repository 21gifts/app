'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { useEffect, useState, type FormEvent, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
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
import { canEditDailyPayoutRoster } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth-store';

const SAVE_ERROR_KEYS = [
  'funding.daily.invalidComment',
  'funding.daily.invalidSwitch',
  'funding.daily.invalidRow',
  'funding.daily.duplicate',
  'funding.daily.unknown',
  'funding.daily.forbidden',
  'funding.daily.saveError',
] as const satisfies readonly MessageKey[];

type SaveErrorKey = (typeof SAVE_ERROR_KEYS)[number];

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
 * @returns Display text for the total.
 */
function formatUsdTotal(roster: DailyRoster): string {
  const sum = roster.recipients.reduce((acc, row) => acc + row.amountUsd, 0);
  return String(Math.round(sum * 100) / 100);
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
 * An initiator or founder loads `GET /funding/daily-roster` and may save the
 * comment, the payments switch, and add, update, or delete a recipient.
 * Everyone else who is signed in sees the heading and a short refusal, and
 * this screen does not fetch. A load that rejects with
 * `funding.daily.forbidden` shows that same refusal. Renders nothing without
 * a session. The page chrome owns the back; this screen renders none.
 *
 * @returns The payments card, refusal copy, or `null` without a session.
 */
export function DailyPaymentsScreen(): ReactElement | null {
  const { t } = useTranslations();
  const session = useAuthStore((state) => state.session);
  const account = useAuthStore((state) => state.account);
  const editor = canEditDailyPayoutRoster(account?.role);
  const [roster, setRoster] = useState<DailyRoster | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [comment, setComment] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [addAddress, setAddAddress] = useState('');
  const [addUsd, setAddUsd] = useState('');
  const [pending, setPending] = useState(false);
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
        setDrafts({});
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

  async function runSave(task: () => Promise<DailyRoster>): Promise<void> {
    setPending(true);
    setSaveError(null);
    try {
      const next = await task();
      setRoster(next);
      setComment(next.comment);
      setDrafts({});
    } catch (err) {
      setSaveError(saveErrorKey(err));
    } finally {
      setPending(false);
    }
  }

  const onSaveComment = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void runSave(() => saveDailyRosterComment(session, comment));
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
        {saveError === null ? null : (
          <p role="alert" className="text-center text-sm text-app-danger">
            {t(saveError)}
          </p>
        )}
        <form className="flex w-full flex-col gap-3" onSubmit={onSaveComment}>
          <Field
            multiline
            label={t('funding.daily.commentLabel')}
            value={comment}
            rows={3}
            disabled={pending}
            onChange={(event) => {
              setComment(event.target.value);
            }}
          />
          <Button type="submit" disabled={pending}>
            {t('funding.daily.save')}
          </Button>
        </form>
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
              const stored = drafts[row.address];
              const draft = stored === undefined ? String(row.amountUsd) : stored;
              return (
                <li
                  key={row.address}
                  className="flex w-full flex-col gap-3 rounded-2xl border border-app-border bg-app-card-muted px-4 py-3"
                >
                  <span className="truncate text-sm text-app-fg" title={row.address}>
                    {display}
                  </span>
                  <Field
                    label={t('funding.daily.usd')}
                    id={`daily-usd-${row.address}`}
                    value={draft}
                    inputMode="decimal"
                    disabled={pending}
                    aria-label={`${t('funding.daily.usd')} ${display}`}
                    onChange={(event) => {
                      const value = event.target.value;
                      setDrafts((current) => ({ ...current, [row.address]: value }));
                    }}
                  />
                  <div className="flex w-full flex-wrap gap-3">
                    <IconButton
                      type="button"
                      variant="secondary"
                      size="md"
                      aria-label={`${t('funding.daily.update')} ${display}`}
                      disabled={pending}
                      onClick={() => {
                        const amountUsd = parseUsd(draft);
                        if (amountUsd === null) {
                          setSaveError('funding.daily.invalidRow');
                          return;
                        }
                        void runSave(() =>
                          updateDailyRosterRecipient(session, row.address, amountUsd),
                        );
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
                </li>
              );
            })}
            <li className="flex w-full items-baseline justify-between gap-3 px-4 text-sm text-app-fg">
              <span>{t('funding.daily.total')}</span>
              <span>{formatUsdTotal(roster)}</span>
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
