'use client';

import { X } from 'lucide-react';
import { useRef, useState, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { AmountEntry } from '@/components/AmountEntry';
import { ForumReplyPayPage } from '@/components/ForumReplyPayPage';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { useLatestRateDayState } from '@/hooks/useLatestRateDay';
import { Button, IconButton } from '@/components/ui';
import { parseAmountDraft } from '@/lib/stats-money';
import type { AmountUnit } from '@/lib/api-types';
import { isSmartphoneUserAgent } from '@/lib/wos-deep-link';

/**
 * Direct Lightning donation to a tracker comment's author; no forum post is created.
 *
 * @param id - Tracker comment id posted with the invoice request.
 * @param name - Recipient display name on the amount form.
 * @param session - Authenticated bearer token for POST `/habits/data`.
 * @param onClose - Closes the amount form or the invoice pay sheet.
 * @returns ReactElement
 */
export function HabitCommentDonation({
  id,
  name,
  session,
  onClose,
}: {
  id: string;
  name: string;
  session: string;
  onClose: () => void;
}): ReactElement {
  const { t } = useTranslations();
  const { fiat } = useFiatPreference();
  const { rateDay, settled } = useLatestRateDayState();
  const [draft, setDraft] = useState('');
  const [unit, setUnit] = useState<AmountUnit>('btc');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [invoice, setInvoice] = useState<{ pr: string; amountSats: number } | null>(null);
  const pending = useRef(false);
  const parsed = parseAmountDraft(unit, draft, rateDay, fiat);
  const showPaymentQr =
    typeof navigator !== 'undefined' && !isSmartphoneUserAgent(navigator.userAgent);
  async function submit(): Promise<void> {
    if (pending.current || parsed.kind !== 'sats' || parsed.sats < 1) return;
    pending.current = true;
    setBusy(true);
    setError(false);
    try {
      const response = await fetch('/habits/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session}` },
        body: JSON.stringify({ action: 'invoice', id, amountSats: parsed.sats }),
      });
      const value: unknown = await response.json();
      if (
        !response.ok ||
        value === null ||
        typeof value !== 'object' ||
        !('pr' in value) ||
        typeof value.pr !== 'string' ||
        value.pr === '' ||
        !('amountSats' in value) ||
        value.amountSats !== parsed.sats
      )
        throw new Error('Invoice unavailable');
      setInvoice({ pr: value.pr, amountSats: parsed.sats });
    } catch {
      setError(true);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return invoice !== null && settled ? (
    <ForumReplyPayPage
      preview={name}
      amountSats={invoice.amountSats}
      pr={invoice.pr}
      payWaiting={false}
      payBusy={false}
      showPaymentQr={showPaymentQr}
      rateDay={rateDay}
      onCancel={onClose}
    />
  ) : (
    <form
      className="space-y-3 rounded-lg border border-app-border p-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <p className="text-sm font-medium">
        {t('habit.donate')} · {name}
      </p>
      <AmountEntry
        id={`donation-${id}`}
        label={t('forum.payAmountLabel')}
        value={draft}
        onValueChange={setDraft}
        onUnitChange={setUnit}
        rateDay={rateDay}
        disabled={busy}
      />
      {error && (
        <p role="alert" className="text-sm text-app-danger">
          {t('forum.payErrorRequest')}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          disabled={!settled || busy || parsed.kind !== 'sats' || parsed.sats < 1}
        >
          {t('forum.payContinue')}
        </Button>
        <IconButton
          type="button"
          size="sm"
          variant="ghost"
          aria-label={t('forum.payClose')}
          disabled={busy}
          onClick={onClose}
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </IconButton>
      </div>
    </form>
  );
}
