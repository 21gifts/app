'use client';

import { Check, Copy } from 'lucide-react';
import Link from 'next/link';
import { useEffect, type ReactElement, type ReactNode } from 'react';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { FiatPreferenceSwitcher } from '@/components/FiatPreferenceSwitcher';
import { LanguagePreferenceSwitcher } from '@/components/LanguagePreferenceSwitcher';
import { useTranslations } from '@/components/LocaleProvider';
import { LogoutButton } from '@/components/LogoutButton';
import { NumberFormatSwitcher } from '@/components/NumberFormatSwitcher';
import { PreviousWalletsRow } from '@/components/PreviousWalletsRow';
import { PushToggle } from '@/components/PushToggle';
import { SocialRecoveryRow } from '@/components/SocialRecoveryRow';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { UsernameForm } from '@/components/UsernameForm';
import { ButtonLink, Card, IconButton, SegmentedControl } from '@/components/ui';
import { useCopied } from '@/hooks/useCopied';
import { saveAmountUnit } from '@/lib/amount-unit';
import type { AmountUnit } from '@/lib/api-types';
import { getAppVersion } from '@/lib/config';
import { giftsLightningAddress } from '@/lib/gifts-address';
import type { MessageKey } from '@/lib/messages';
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
 * Signed-in settings page: the member's preferences and account actions, in
 * five sections. **Wallet**: the recovery phrase on `/wallet/phrase`
 * (**Recovery phrase** when the account has a `passkeyCredentialId`,
 * otherwise the add hint and **Add recovery phrase**), the Social Recovery
 * row ({@link SocialRecoveryRow}: its status, **Secure my account**, and
 * **Shares I keep for others**), the previous wallets after a social recovery
 * ({@link PreviousWalletsRow}, only when there are some or their read failed),
 * the 21.gifts address with Copy (or the username form while no username is
 * set), and the default amount unit. **Display**: language, theme, fiat
 * currency, and number format. **Notifications**: {@link PushToggle}.
 * **Account**: {@link LogoutButton}. **About & legal**: the handbook, legal,
 * terms, rules, and contact links and the app version. Each section and the
 * recovery, Social Recovery, and address rows carry an id; a `#id` in the
 * address scrolls that part into view once it renders. The previous wallets
 * row loads later and scrolls itself into view for `#previous-wallets`.
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
  const credentialId = account.passkeyCredentialId;
  const hasPhrase = typeof credentialId === 'string' && credentialId !== '';
  return (
    <Card surface={false}>
      <h1 className="text-center text-2xl font-semibold tracking-tight text-app-fg sm:text-3xl">
        {t('settings.heading')}
      </h1>
      <SettingsSection id="wallet" heading={t('wallet.title')}>
        <div id="recovery" className="flex w-full scroll-mt-4 flex-col items-center gap-3">
          {hasPhrase ? (
            <ButtonLink href="/wallet/phrase" variant="secondary" size="lg">
              {t('settings.recoveryPhrase')}
            </ButtonLink>
          ) : (
            <>
              <p className="text-center text-sm text-app-muted">{t('wallet.addPhraseHint')}</p>
              <ButtonLink href="/wallet/phrase" size="lg">
                {t('wallet.addPhrase')}
              </ButtonLink>
            </>
          )}
        </div>
        <SocialRecoveryRow />
        <PreviousWalletsRow />
        <AddressRow />
        <DefaultAmountRow />
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
