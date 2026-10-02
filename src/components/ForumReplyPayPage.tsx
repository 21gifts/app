'use client';

import { X } from 'lucide-react';
import { type ReactElement } from 'react';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { useTranslations } from '@/components/LocaleProvider';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { preferredFiatSuffix } from '@/components/PreferredFiatSuffix';
import { WalletPay } from '@/components/WalletPay';
import { IconButton } from '@/components/ui';
import { formatBitcoin, type FiatRateDay } from '@/lib/stats-money';

/**
 * In-place paid-reaction pay page that replaces the reply composer.
 *
 * Close stays on this view. It is not the top-left back arrow. The preview paragraph is left-inset (`pl-12`) so its glyphs clear that control, including the icon button's hit slop.
 *
 * The pay slot pays from the member's in-app wallet (`sparkInvoice` when the
 * api issued one, otherwise `pr`). It shows no invoice QR.
 *
 * @param props - Preview, invoice, waiting flag, and cancel handler.
 * @returns The pay page element.
 */
export function ForumReplyPayPage({
  preview,
  amountSats,
  pr,
  sparkInvoice,
  payWaiting,
  rateDay,
  onCancel,
}: {
  preview: string;
  amountSats: number;
  pr: string;
  sparkInvoice?: string | null | undefined;
  payWaiting: boolean;
  rateDay: FiatRateDay | null;
  onCancel: () => void;
}): ReactElement {
  const { t } = useTranslations();
  const { numberFormat } = useNumberFormat();
  const { fiat } = useFiatPreference();
  return (
    <div
      data-reply-pay-page=""
      data-pay-sheet=""
      className="relative mt-3 flex flex-col items-center gap-3 rounded-xl border border-app-border bg-app-card p-4"
    >
      <div className="absolute left-2 top-2">
        <IconButton
          type="button"
          size="sm"
          variant="ghost"
          aria-label={t('forum.payClose')}
          onClick={onCancel}
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </IconButton>
      </div>
      {preview.trim() !== '' ? (
        <p className="w-full whitespace-pre-wrap pl-12 text-left text-base text-app-fg">
          {preview}
        </p>
      ) : null}
      <p className="px-10 text-center text-sm text-app-muted">
        {t('forum.payConfirm', {
          amount: formatBitcoin(amountSats, numberFormat),
        })}
        {preferredFiatSuffix(amountSats, rateDay, fiat, numberFormat)}
      </p>
      <WalletPay sparkInvoice={sparkInvoice} pr={pr} amountSats={amountSats} rateDay={rateDay} />
      {payWaiting ? (
        <p className="text-center text-xs text-app-muted">{t('forum.payWaiting')}</p>
      ) : null}
    </div>
  );
}
