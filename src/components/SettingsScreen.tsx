'use client';

import { Check, Copy } from 'lucide-react';
import { AmountEntry } from '@/components/AmountEntry';
import Link from 'next/link';
import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { FiatPreferenceSwitcher } from '@/components/FiatPreferenceSwitcher';
import { LanguagePreferenceSwitcher } from '@/components/LanguagePreferenceSwitcher';
import { useTranslations } from '@/components/LocaleProvider';
import { LogoutButton } from '@/components/LogoutButton';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { NumberFormatSwitcher } from '@/components/NumberFormatSwitcher';
import { PushToggle } from '@/components/PushToggle';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { UsernameForm } from '@/components/UsernameForm';
import { Button, Card, IconButton, SegmentedControl } from '@/components/ui';
import { useCopied } from '@/hooks/useCopied';
import { useSpotRate } from '@/hooks/useSpotRate';
import { saveAmountUnit } from '@/lib/amount-unit';
import { accountHeartSats, type AmountUnit } from '@/lib/api-types';
import { getAppVersion } from '@/lib/config';
import { giftsLightningAddress } from '@/lib/gifts-address';
import { MAX_HEART_SATS, saveHeartSats } from '@/lib/heart-sats';
import type { MessageKey } from '@/lib/messages';
import { fiatDraftForSats, formatBitcoin, parseAmountDraft } from '@/lib/stats-money';
import { useAuthStore } from '@/stores/auth-store';

/** Links of the About & legal section, in the marketing footer's order. */
const ABOUT_LINKS: ReadonlyArray<{ href: string; label: MessageKey }> = [
  { href: '/handbook', label: 'nav.handbook' },
  { href: '/legal', label: 'nav.legal' },
  { href: '/terms', label: 'nav.terms' },
  { href: '/rules', label: 'nav.rules' },
  { href: '/contact', label: 'nav.contact' },
];

/**
 * One titled Settings section: an **h2** in the section ramp, then its rows.
 * A rule separates it from the section above; its first row drops its own rule.
 *
 * @param props - Element id, catalog heading, and rows.
 * @returns The section.
 */
function SettingsSection(props: {
  id: string;
  heading: string;
  children: ReactNode;
}): ReactElement {
  return (
    <section
      id={props.id}
      aria-labelledby={`${props.id}-heading`}
      className="flex w-full scroll-mt-4 flex-col items-stretch gap-4 border-t border-app-border pt-6 first-of-type:border-t-0 first-of-type:pt-0 [&>h2+*]:border-t-0 [&>h2+*]:pt-0"
    >
      <h2 id={`${props.id}-heading`} className="text-sm font-semibold text-app-muted">
        {props.heading}
      </h2>
      {props.children}
    </section>
  );
}

/**
 * The member's 21.gifts address with an icon-only Copy, or, while no
 * username is set, the username line and the username form.
 *
 * @returns The Your address row.
 */
function AddressRow(): ReactElement {
  const { t } = useTranslations();
  const username = useAuthStore((state) => state.account?.username ?? null);
  const { copied, copy } = useCopied();
  /* v8 ignore next -- this client screen always runs in a browser */
  const host = typeof window === 'undefined' ? '21.gifts' : window.location.hostname;
  const address = giftsLightningAddress(username, host);
  const label = t('profile.giftsHeading');
  return (
    <div
      id="address"
      className="flex w-full scroll-mt-4 flex-col items-stretch gap-3 border-t border-app-border pt-6"
    >
      <p className="text-center text-xs tracking-widest text-app-subtle uppercase">{label}</p>
      {address !== null ? (
        <div className="flex min-w-0 items-center justify-center gap-1">
          <span className="min-w-0 truncate font-mono text-sm text-app-fg">{address}</span>
          <IconButton
            type="button"
            size="sm"
            variant="ghost"
            aria-label={t('wallet.payment.copyValue', { label })}
            onClick={() => {
              void copy(address);
            }}
          >
            {copied ? (
              <Check aria-hidden="true" className="h-3.5 w-3.5 text-app-success" />
            ) : (
              <Copy aria-hidden="true" className="h-3.5 w-3.5" />
            )}
          </IconButton>
          <span className="sr-only" aria-live="polite">
            {copied ? t('wallet.payment.copied') : ''}
          </span>
        </div>
      ) : (
        <>
          <p className="text-center text-sm text-app-muted">{t('pos.needUsername')}</p>
          <UsernameForm variant="overlay" />
        </>
      )}
    </div>
  );
}

/**
 * Bitcoin / fiat choice stored as `account.amountUnit`, the unit every amount
 * field starts in. Saves through {@link saveAmountUnit}, the same save the
 * `AmountEntry` switch uses.
 *
 * @returns The Default amount row.
 */
function DefaultAmountRow(): ReactElement {
  const { t } = useTranslations();
  const { fiat } = useFiatPreference();
  const session = useAuthStore((state) => state.session);
  const account = useAuthStore((state) => state.account);
  const unit: AmountUnit = account?.amountUnit ?? 'btc';
  return (
    <div className="flex w-full flex-col items-stretch gap-3 border-t border-app-border pt-6">
      <p className="text-center text-xs tracking-widest text-app-subtle uppercase">
        {t('settings.defaultAmount')}
      </p>
      <SegmentedControl
        tone="neutral"
        value={unit}
        options={[
          { value: 'btc' as const, label: '₿' },
          { value: 'fiat' as const, label: fiat },
        ]}
        onChange={(next) => {
          /* v8 ignore next 3 -- the screen renders only with a session and an account */
          if (session === null || account === null || next === unit) {
            return;
          }
          void saveAmountUnit(session, account, next);
        }}
        ariaLabel={t('settings.defaultAmount')}
      />
      <p className="text-center text-xs text-app-muted">{t('settings.defaultAmountHint')}</p>
    </div>
  );
}

/**
 * Whole sats every heart click sends, stored as `account.heartSats`.
 *
 * The field is the app's {@link AmountEntry}: the account's ₿ / fiat switch,
 * the other unit under the value, and **No exchange rate yet** when that
 * fiat has no rate. The submitted value is always whole sats. Empty, zero,
 * a non-integer, and a value above {@link MAX_HEART_SATS} stay local and
 * show a short error; a valid value saves through {@link saveHeartSats} and
 * shows the stored confirmation.
 *
 * @returns The Heart amount row.
 */
function HeartAmountRow(): ReactElement {
  const { t } = useTranslations();
  const { fiat } = useFiatPreference();
  const { numberFormat } = useNumberFormat();
  const session = useAuthStore((state) => state.session);
  const account = useAuthStore((state) => state.account);
  const savedSats = accountHeartSats(account);
  const [draft, setDraft] = useState(String(savedSats));
  // Start in bitcoin so the stored whole-sats draft is never read as fiat before
  // a rate can convert it. AmountEntry then follows the account unit and calls
  // `onUnitChange` after the conversion succeeds.
  const [shownUnit, setShownUnit] = useState<AmountUnit>('btc');
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState(false);
  const [saved, setSaved] = useState(false);
  const rateDay = useSpotRate(account !== null);
  const parsed = parseAmountDraft(shownUnit, draft, rateDay, fiat);
  // Invalid drafts fall back to 0, which is outside the allowed range.
  const nextSats = parsed.kind === 'sats' ? parsed.sats : 0;
  const valid = nextSats >= 1 && nextSats <= MAX_HEART_SATS;
  const error = touched && !valid ? t('settings.heartAmountError') : null;

  const syncedSats = useRef(savedSats);
  useEffect(() => {
    if (syncedSats.current === savedSats) {
      return;
    }
    syncedSats.current = savedSats;
    const fiatDraft = shownUnit === 'btc' ? null : fiatDraftForSats(savedSats, rateDay, fiat);
    /* v8 ignore next -- fiat mode keeps a usable rate, so the whole-sat fallback is defensive */
    setDraft(fiatDraft ?? String(savedSats));
  }, [fiat, rateDay, savedSats, shownUnit]);

  const submit = async (): Promise<void> => {
    /* v8 ignore next 3 -- the screen renders this row only with a session and an account */
    if (session === null || account === null) {
      return;
    }
    setBusy(true);
    setServerError(false);
    setSaved(false);
    const ok = await saveHeartSats(session, account, nextSats);
    if (ok) {
      setSaved(true);
    } else {
      setServerError(true);
    }
    setBusy(false);
  };

  return (
    <div className="flex w-full flex-col items-stretch gap-3 border-t border-app-border pt-6">
      <p className="text-center text-xs tracking-widest text-app-subtle uppercase">
        {t('settings.heartAmount')}
      </p>
      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <AmountEntry
          id="heart-sats"
          layout="composer"
          label={t('settings.heartAmount')}
          value={draft}
          valueUnit={shownUnit}
          disabled={busy}
          rateDay={rateDay}
          onValueChange={(next) => {
            setDraft(next);
            setSaved(false);
            setTouched(true);
            setServerError(false);
          }}
          onUnitChange={setShownUnit}
          {...(error === null ? {} : { error })}
        />
        <p className="text-center text-xs text-app-muted">{t('settings.heartAmountHint')}</p>
        {serverError ? (
          <p role="alert" className="text-center text-sm text-app-danger">
            {t('settings.heartAmountSaveError')}
          </p>
        ) : null}
        <Button type="submit" size="lg" disabled={busy || !valid}>
          {t('name.save')}
        </Button>
      </form>
      <p role="status" className="min-h-5 text-center text-sm text-app-success">
        {saved
          ? t('settings.heartAmountSaved', { amount: formatBitcoin(savedSats, numberFormat) })
          : ''}
      </p>
    </div>
  );
}

/**
 * Signed-in settings page: the member's preferences and account actions, in
 * five sections. **Wallet**:
 * the 21.gifts address with Copy (or the username form while no username is
 * set), the default amount unit, and the heart amount. **Display**: language, theme, fiat
 * currency, and number format. **Notifications**: {@link PushToggle}.
 * **Account**: {@link LogoutButton}. **About & legal**: the handbook, legal,
 * terms, rules, and contact links and the app version. Each section and the
 * address row carry an id; a `#id` in the address scrolls that part into view
 * once it renders. Securing the account lives on `/security`.
 * Renders nothing without a session or before the account has loaded.
 *
 * @returns The settings card, or `null` without a session or account.
 */
export function SettingsScreen(): ReactElement | null {
  const { t } = useTranslations();
  const session = useAuthStore((state) => state.session);
  const account = useAuthStore((state) => state.account);
  const ready = session !== null && account !== null;

  useEffect(() => {
    if (!ready) {
      return;
    }
    // The section ids are plain words, so the raw hash is the id; a stray `%` cannot throw.
    const id = window.location.hash.slice(1);
    if (id === '') {
      return;
    }
    document.getElementById(id)?.scrollIntoView({ block: 'start' });
  }, [ready]);

  if (!ready) {
    return null;
  }
  return (
    <Card surface={false}>
      <h1 className="text-center text-2xl font-semibold tracking-tight text-app-fg sm:text-3xl">
        {t('settings.heading')}
      </h1>
      <SettingsSection id="wallet" heading={t('wallet.title')}>
        <AddressRow />
        <DefaultAmountRow />
        <HeartAmountRow />
      </SettingsSection>
      <SettingsSection id="display" heading={t('settings.display')}>
        <LanguagePreferenceSwitcher />
        <ThemeSwitcher />
        <FiatPreferenceSwitcher />
        <NumberFormatSwitcher />
      </SettingsSection>
      <SettingsSection id="notifications" heading={t('profile.push.heading')}>
        <PushToggle />
      </SettingsSection>
      <SettingsSection id="account" heading={t('settings.account')}>
        <LogoutButton />
      </SettingsSection>
      <SettingsSection id="about" heading={t('settings.about')}>
        <nav aria-labelledby="about-heading" className="flex flex-col">
          {ABOUT_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-medium text-app-fg no-underline transition hover:bg-app-hover"
            >
              {t(link.label)}
            </Link>
          ))}
        </nav>
        <p className="px-3 text-xs text-app-muted tabular-nums lining-nums">
          {t('app.version', { version: getAppVersion() })}
        </p>
      </SettingsSection>
    </Card>
  );
}
