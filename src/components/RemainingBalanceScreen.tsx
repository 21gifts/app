'use client';

import { Loader2 } from 'lucide-react';
import type { ReactElement } from 'react';
import { AppShellTopLeft } from '@/components/AppShell';
import { BusyLine } from '@/components/BusyLine';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { InlineConfirm } from '@/components/InlineConfirm';
import { useTranslations } from '@/components/LocaleProvider';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { OldWordsInput } from '@/components/OldWordsInput';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { Button, Card } from '@/components/ui';
import { useRemainingBalance } from '@/hooks/useRemainingBalance';
import { useSpotRate } from '@/hooks/useSpotRate';
import { formatBitcoin, formatFiatDisplay, satsToFiatAmount } from '@/lib/stats-money';
import { useAuthStore } from '@/stores/auth-store';

/** Centred muted body line. */
const BODY = 'text-center text-sm text-app-muted';

/** Centred alert line. */
const ALERT = 'text-center text-sm text-app-danger';

/**
 * `/settings/previous-wallets/[sparkPubkey]`, **Transfer remaining balance**:
 * the signed-in member moves what is left in a wallet the account used before
 * a social recovery to the current wallet ({@link useRemainingBalance}).
 * Nothing shows while the account's previous wallets are read. A wallet that
 * is not one of them says so in a muted line with nothing to press (the
 * top-left arrow leaves, as on a missing view); a failed read shows its alert
 * and **Try again**. Every other step keeps the title **Transfer remaining
 * balance**. The start explains that the wallet's two codes or its 12 words
 * open it and offers **Scan two codes** and **Type my 12 words**
 * ({@link OldWordsInput}; the camera fills the page, and codes of another
 * account are refused). While the wallet opens, **Opening the old wallet…**.
 * Words of another wallet, or a wallet that does not open, show their alert
 * and **Try again**. Then **In this wallet** with its synced balance in ₿ and
 * the member's fiat at the current spot: above 0 with **Transfer** (a spinner
 * while it moves; a failure shows its alert and **Try again**), at 0 with
 * **This wallet is empty. You can remove it from your account.**. After a
 * move, **Moved to your wallet.**. At 0 and after a move, **Remove previous
 * wallet** opens a confirm (check removes, X keeps; a spinner while it runs,
 * an alert when it failed), and the removal returns to `/settings`, as
 * **Done** does, without a second copy of it in the history. The one top-left
 * arrow steps from the camera or the words field back to the start, otherwise
 * it returns to the previous view. No key or address is shown.
 *
 * @param props - `sparkPubkey`: the previous wallet's identity key.
 * @returns The screen, or `null` before the account and the list have loaded.
 */
export function RemainingBalanceScreen({
  sparkPubkey,
}: {
  sparkPubkey: string;
}): ReactElement | null {
  const { t } = useTranslations();
  const { numberFormat } = useNumberFormat();
  const { fiat } = useFiatPreference();
  const account = useAuthStore((state) => state.account);
  const wallet = useRemainingBalance(sparkPubkey);
  const rateDay = useSpotRate(wallet.balanceSats !== null);
  if (account === null || wallet.step === 'checking') {
    return null;
  }
  const chrome = (
    <AppShellTopLeft>
      <ProfileChromeLeft onBackClick={wallet.back} />
    </AppShellTopLeft>
  );

  if (wallet.step === 'scan') {
    return (
      <>
        {chrome}
        <h1 className="sr-only">{t('remaining.title')}</h1>
        <OldWordsInput mode="scan" expectedOwnerAccountId={account.id} onWords={wallet.onWords} />
      </>
    );
  }

  const done = (
    <Button type="button" size="lg" onClick={wallet.leave}>
      {t('secure.done')}
    </Button>
  );
  const retry = (onClick: () => void): ReactElement => (
    <Button type="button" size="lg" onClick={onClick}>
      {t('login.retry')}
    </Button>
  );
  const removal =
    wallet.removal === 'idle' ? (
      <Button type="button" variant="secondary" size="lg" onClick={wallet.askRemove}>
        {t('previousWallets.remove')}
      </Button>
    ) : (
      <InlineConfirm
        label={t('previousWallets.removeConfirm')}
        confirmLabel={t('previousWallets.removeYes')}
        cancelLabel={t('previousWallets.removeNo')}
        onConfirm={wallet.confirmRemove}
        onCancel={wallet.cancelRemove}
        busy={wallet.removal === 'busy'}
        error={wallet.removal === 'error' ? t('previousWallets.removeError') : null}
      />
    );
  const sats = wallet.balanceSats ?? 0;
  const bitcoin = formatBitcoin(sats, numberFormat);
  const amount = satsToFiatAmount(sats, rateDay, fiat);
  const balance = (
    <div className="flex flex-col items-center gap-1">
      <p className="text-center text-xs tracking-widest text-app-subtle uppercase">
        {t('remaining.balance')}
      </p>
      <p className="text-center text-2xl font-semibold tracking-tight text-app-fg tabular-nums lining-nums">
        {amount === null
          ? bitcoin
          : `${bitcoin} · ${formatFiatDisplay(amount, fiat, numberFormat)}`}
      </p>
    </div>
  );

  let body: ReactElement;
  switch (wallet.step) {
    case 'loadError':
      body = (
        <>
          <p role="alert" className={ALERT}>
            {t('previousWallets.loadError')}
          </p>
          {retry(wallet.reload)}
        </>
      );
      break;
    case 'notFound':
      body = <p className={BODY}>{t('remaining.notFound')}</p>;
      break;
    case 'start':
      body = (
        <>
          <p className={BODY}>{t('remaining.intro')}</p>
          <Button type="button" size="lg" onClick={wallet.scan}>
            {t('recover.scan')}
          </Button>
          <Button type="button" variant="secondary" size="lg" onClick={wallet.type}>
            {t('recover.type')}
          </Button>
        </>
      );
      break;
    case 'type':
      body = <OldWordsInput mode="type" onWords={wallet.onWords} />;
      break;
    case 'opening':
      body = <BusyLine label={t('recover.opening')} />;
      break;
    case 'mismatch':
    case 'walletError':
      body = (
        <>
          <p role="alert" className={ALERT}>
            {t(wallet.step === 'mismatch' ? 'remaining.mismatch' : 'wallet.balanceError')}
          </p>
          {retry(wallet.retryOpen)}
        </>
      );
      break;
    case 'balance':
    case 'sending':
      body = wallet.removable ? (
        <>
          {balance}
          <p className={BODY}>{t('remaining.emptyBody')}</p>
          {removal}
          {done}
        </>
      ) : (
        <>
          {balance}
          <Button
            type="button"
            size="lg"
            disabled={wallet.step === 'sending'}
            onClick={wallet.transfer}
            {...(wallet.step === 'sending'
              ? { icon: <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> }
              : {})}
          >
            {t('recover.transfer')}
          </Button>
        </>
      );
      break;
    case 'error':
      body = (
        <>
          {balance}
          <p role="alert" className={ALERT}>
            {t('remaining.error')}
          </p>
          {retry(wallet.transfer)}
        </>
      );
      break;
    case 'done':
      body = (
        <>
          <p role="status" className="text-center text-sm font-medium text-app-success">
            {t('remaining.done')}
          </p>
          {removal}
          {done}
        </>
      );
      break;
  }

  return (
    <Card surface={false}>
      {chrome}
      <h1 className="text-center text-2xl font-semibold tracking-tight text-app-fg sm:text-3xl">
        {t('remaining.title')}
      </h1>
      {body}
    </Card>
  );
}
