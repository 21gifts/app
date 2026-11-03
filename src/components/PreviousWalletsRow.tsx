'use client';

import { useEffect, useRef, type ReactElement } from 'react';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { useTranslations } from '@/components/LocaleProvider';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { Button, ButtonLink } from '@/components/ui';
import { usePreviousWallets } from '@/hooks/usePreviousWallets';
import { useSpotRate } from '@/hooks/useSpotRate';
import { formatBitcoin, formatFiatDisplay, satsToFiatAmount } from '@/lib/stats-money';

/** The row's element id, also its `/settings#previous-wallets` anchor. */
const ROW_ID = 'previous-wallets';

/**
 * The previous wallets row of the settings Wallet section (id
 * `previous-wallets`), under the Social Recovery row: the wallets the account
 * used before a social recovery ({@link usePreviousWallets}). Nothing shows
 * while the list loads or when it is empty, so accounts without one see no
 * change. A failed read shows the overline, an alert, and **Try again**.
 * Otherwise each wallet is a card with the day it was replaced, its explorer
 * balance (**Balance unknown** for `null`, **Empty** for 0, else ₿ with the
 * current spot in the member's fiat beside it), and one **Transfer remaining
 * balance** link to `/settings/previous-wallets/<key>`. The explorer can lag,
 * so its value is information only: every wallet gets that link, and no
 * control here removes a wallet. The settings screen scrolls to its hash before
 * this row has loaded, so once the row first shows, it scrolls itself into view
 * when the address hash is `#previous-wallets`. No key or address is shown.
 *
 * @returns The row, or `null` while loading or without previous wallets.
 */
export function PreviousWalletsRow(): ReactElement | null {
  const { t, locale } = useTranslations();
  const { numberFormat } = useNumberFormat();
  const { fiat } = useFiatPreference();
  const { status, wallets, retry } = usePreviousWallets();
  const shown = status === 'error' || wallets.length > 0;
  const rateDay = useSpotRate(wallets.some((wallet) => (wallet.balanceSats ?? 0) > 0));
  const scrolled = useRef(false);

  useEffect(() => {
    if (!shown || scrolled.current) {
      return;
    }
    scrolled.current = true;
    if (window.location.hash === `#${ROW_ID}`) {
      document.getElementById(ROW_ID)?.scrollIntoView({ block: 'start' });
    }
  }, [shown]);

  if (!shown) {
    return null;
  }
  const balance = (sats: number | null): string => {
    if (sats === null) {
      return t('previousWallets.balanceUnknown');
    }
    if (sats === 0) {
      return t('previousWallets.empty');
    }
    const bitcoin = formatBitcoin(sats, numberFormat);
    const amount = satsToFiatAmount(sats, rateDay, fiat);
    return amount === null
      ? bitcoin
      : `${bitcoin} · ${formatFiatDisplay(amount, fiat, numberFormat)}`;
  };
  const day = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
  return (
    <div
      id={ROW_ID}
      className="flex w-full scroll-mt-4 flex-col items-stretch gap-3 border-t border-app-border pt-6"
    >
      <p className="text-center text-xs tracking-widest text-app-subtle uppercase">
        {t('previousWallets.heading')}
      </p>
      {status === 'error' ? (
        <>
          <p role="alert" className="text-center text-sm text-app-danger">
            {t('previousWallets.loadError')}
          </p>
          <Button type="button" variant="secondary" size="lg" onClick={retry}>
            {t('login.retry')}
          </Button>
        </>
      ) : (
        <ul className="flex w-full flex-col gap-3">
          {wallets.map((wallet) => (
            <li
              key={wallet.sparkPubkey}
              className="flex flex-col gap-2 rounded-lg border border-app-border p-3"
            >
              <p className="text-sm text-app-fg">
                {t('previousWallets.replaced', { date: day.format(new Date(wallet.replacedAt)) })}
              </p>
              <p className="text-sm text-app-muted tabular-nums lining-nums">
                {balance(wallet.balanceSats)}
              </p>
              <ButtonLink
                href={`/settings/previous-wallets/${encodeURIComponent(wallet.sparkPubkey)}`}
                variant="secondary"
                size="md"
              >
                {t('previousWallets.transfer')}
              </ButtonLink>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
