'use client';

import { Gift, Loader2 } from 'lucide-react';
import { useRef, useState, type FormEvent, type ReactElement } from 'react';
import { QrCode } from '@/components/QrCode';
import { resolveLightningAddress } from '@/lib/api';
import { formatMsatAsSats, requestDonateInvoice, satsToMsat } from '@/lib/lnurl-pay';

/**
 * Guest donate surface: resolve a Lightning Address, fetch a LNURL-pay
 * invoice in the browser, and show a QR plus a wallet deep-link.
 *
 * @returns The donate card.
 */
export function DonateForm(): ReactElement {
  const [addressDraft, setAddressDraft] = useState('');
  const [amountDraft, setAmountDraft] = useState('');
  const [invoice, setInvoice] = useState<{ pr: string; address: string; sats: number } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generationRef = useRef(0);
  const busyRef = useRef(false);

  const onSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (busyRef.current) {
      return;
    }
    const address = addressDraft.trim();
    if (address === '') {
      setError('Enter a Lightning Address');
      return;
    }
    const rawAmount = amountDraft.trim();
    if (rawAmount === '' || !/^\d+$/.test(rawAmount)) {
      setError('Enter a whole number of sats greater than zero');
      return;
    }
    const sats = Number.parseInt(rawAmount, 10);
    if (sats <= 0 || !Number.isSafeInteger(sats)) {
      setError('Enter a whole number of sats greater than zero');
      return;
    }
    const amountMsat = satsToMsat(sats);

    const started = generationRef.current;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const resolved = await resolveLightningAddress(address);
      if (started !== generationRef.current) {
        return;
      }
      if (amountMsat < resolved.minSendable || amountMsat > resolved.maxSendable) {
        setError(
          `This address accepts ${formatMsatAsSats(resolved.minSendable)} – ${formatMsatAsSats(resolved.maxSendable)}.`,
        );
        return;
      }
      const pr = await requestDonateInvoice({
        callback: resolved.callback,
        amountMsat,
      });
      if (started !== generationRef.current) {
        return;
      }
      setInvoice({ pr, address: resolved.address, sats });
    } catch (caught) {
      if (started !== generationRef.current) {
        return;
      }
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      if (started === generationRef.current) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  };

  const onCancel = (): void => {
    generationRef.current += 1;
    busyRef.current = false;
    setInvoice(null);
    setError(null);
    setBusy(false);
  };

  if (invoice !== null) {
    const satLabel = invoice.sats === 1 ? '1 sat' : `${invoice.sats} sats`;
    return (
      <section className="flex w-full max-w-sm flex-col items-center gap-6 rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm">
        <p className="text-center text-sm text-neutral-600">
          Pay {satLabel} to {invoice.address}
        </p>
        <QrCode value={invoice.pr} label="Lightning invoice QR code" />
        <a
          href={`lightning:${invoice.pr}`}
          className="text-sm font-medium text-neutral-600 underline underline-offset-4 transition hover:text-neutral-900"
        >
          Open in wallet
        </a>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-2 rounded-full border border-neutral-300 px-5 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
        >
          Cancel
        </button>
      </section>
    );
  }

  return (
    <section className="flex w-full max-w-sm flex-col items-center gap-6 rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm">
      <Gift aria-hidden="true" className="h-8 w-8 text-neutral-400" />
      <h2 className="text-center text-lg font-medium text-neutral-900">Pay with Lightning</h2>
      <p className="text-center text-sm text-neutral-500">
        Pay a Lightning Address from your wallet. No account needed.
      </p>
      <form className="flex w-full flex-col gap-4" onSubmit={(event) => void onSubmit(event)}>
        <label className="flex flex-col gap-1 text-left text-sm text-neutral-700">
          Lightning Address
          <input
            type="email"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="you@walletofsatoshi.com"
            value={addressDraft}
            disabled={busy}
            onChange={(event) => {
              setAddressDraft(event.target.value);
            }}
            className="rounded-xl border border-neutral-300 px-3 py-2 text-neutral-900 outline-none focus:border-neutral-500"
          />
        </label>
        <label className="flex flex-col gap-1 text-left text-sm text-neutral-700">
          Amount (sats)
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="21"
            value={amountDraft}
            disabled={busy}
            onChange={(event) => {
              setAmountDraft(event.target.value);
            }}
            className="rounded-xl border border-neutral-300 px-3 py-2 text-neutral-900 outline-none focus:border-neutral-500"
          />
        </label>
        {error !== null ? (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-60"
        >
          {busy ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : null}
          Create invoice
        </button>
        {busy ? (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-neutral-300 px-5 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
          >
            Cancel
          </button>
        ) : null}
      </form>
    </section>
  );
}
