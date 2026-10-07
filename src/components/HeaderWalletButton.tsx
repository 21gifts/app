'use client';

import { Wallet } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { type ReactElement } from 'react';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { useTranslations } from '@/components/LocaleProvider';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { ButtonLink } from '@/components/ui';
import { useLatestRateDay } from '@/hooks/useLatestRateDay';
import { useWallet } from '@/hooks/useWallet';
import { formatBitcoin, formatFiatDisplay, satsToFiatAmount } from '@/lib/stats-money';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Signed-in header shortcut to `/wallet`, placed just left of the Menu
 * trigger by {@link SignedInChrome}. It only reads the wallet state that
 * {@link useWallet} selects from the wallet store: it never opens the wallet,
 * never asks for the passkey, and never connects. While the wallet is ready
 * with a balance it is a pill with the ₿ balance and, under it, the same
 * amount in the member's default fiat (left out only without a usable rate);
 * the lucide `Wallet` icon leads from `sm`. Locked, connecting, error, and
 * ready without a balance show the icon and the label **Wallet**. It renders
 * nothing before the account is hydrated, when the wallet is disabled (no
 * Breez key in this build, or an account that cannot hold the wallet), and on
 * `/wallet` itself. The link is `next/link`, so the unlocked wallet stays.
 *
 * @returns The wallet pill link, or `null` when hidden.
 */
export function HeaderWalletButton(): ReactElement | null {
  const { t } = useTranslations();
  const { numberFormat } = useNumberFormat();
  const { fiat } = useFiatPreference();
  const pathname = usePathname();
  const hydrated = useAuthStore((state) => state.account !== null);
  const { status, balanceSats } = useWallet();
  const shown = hydrated && status !== 'disabled' && pathname !== '/wallet';
  const balance = shown && status === 'ready' ? balanceSats : null;
  const rateDay = useLatestRateDay(balance !== null);

  if (!shown) {
    return null;
  }
  if (balance === null) {
    return (
      <ButtonLink
        href="/wallet"
        variant="secondary"
        size="chrome"
        icon={<Wallet aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />}
      >
        {t('wallet.title')}
      </ButtonLink>
    );
  }
  const bitcoinText = formatBitcoin(balance, numberFormat);
  const fiatAmount = satsToFiatAmount(balance, rateDay, fiat);
  return (
    <ButtonLink
      href="/wallet"
      variant="secondary"
      size="chrome"
      aria-label={t('wallet.headerBalance', { amount: bitcoinText })}
      icon={<Wallet aria-hidden="true" className="hidden h-3.5 w-3.5 shrink-0 sm:block" />}
    >
      <span className="flex flex-col items-end leading-tight tabular-nums lining-nums">
        <span className="text-[11px] font-semibold sm:text-sm">{bitcoinText}</span>
        {fiatAmount === null ? null : (
          <span className="text-[10px] font-normal text-app-muted sm:text-xs">
            {formatFiatDisplay(fiatAmount, fiat, numberFormat)}
          </span>
        )}
      </span>
    </ButtonLink>
  );
}
