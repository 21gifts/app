'use client';

import { type FormEvent, type ReactElement, useEffect, useRef, useState } from 'react';
import { HomeWordmark } from '@/components/HomeWordmark';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useTranslations } from '@/components/LocaleProvider';
import { QrCode } from '@/components/QrCode';
import { Button, Card, Field, PageChrome } from '@/components/ui';
import { payLinkUsername } from '@/lib/pay-link';
import {
  isAndroidUserAgent,
  isSmartphoneUserAgent,
  walletOfSatoshiHref,
  walletOfSatoshiIntentHref,
} from '@/lib/wos-deep-link';

interface PayProfile {
  name: string;
  username: string;
  minSats: number;
  maxSats: number;
}

/**
 * Public LNURL payment form that creates one exact-amount BOLT11 invoice.
 *
 * @param props - Encoded LNURL from the `lightning` query parameter.
 * @returns Public payment chrome, validation state, and invoice QR when created.
 */
export function PayLinkScreen({ lightning }: { lightning: string }): ReactElement {
  const { t } = useTranslations();
  const [profile, setProfile] = useState<PayProfile | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [amount, setAmount] = useState('');
  const [formError, setFormError] = useState<'amount' | 'failed' | null>(null);
  const [posting, setPosting] = useState(false);
  const [invoice, setInvoice] = useState<string | null>(null);
  const postingRef = useRef(false);
  /* v8 ignore next 8 -- SSR has no navigator */
  const isSmartphone =
    typeof navigator !== 'undefined' ? isSmartphoneUserAgent(navigator.userAgent) : false;
  const android =
    typeof navigator !== 'undefined' ? isAndroidUserAgent(navigator.userAgent) : false;

  useEffect(() => {
    let active = true;
    setInvalid(false);
    setProfile(null);
    setInvoice(null);
    setFormError(null);
    setPosting(false);
    postingRef.current = false;
    const username = payLinkUsername(lightning, window.location.host);
    if (username === null) {
      setInvalid(true);
      return;
    }

    void fetch(`/pay/${encodeURIComponent(username)}`)
      .then(async (response) => {
        if (!active) {
          return;
        }
        if (!response.ok) {
          setInvalid(true);
          return;
        }
        setProfile((await response.json()) as PayProfile);
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setInvalid(true);
      });
    return () => {
      active = false;
    };
  }, [lightning]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    /* v8 ignore next 3 -- the form is not mounted until a profile exists */
    if (profile === null) {
      return;
    }
    if (postingRef.current || invoice !== null) {
      return;
    }
    if (!/^\d+$/.test(amount)) {
      setFormError('amount');
      return;
    }
    const amountSats = Number(amount);
    if (
      !Number.isSafeInteger(amountSats) ||
      amountSats < profile.minSats ||
      amountSats > profile.maxSats
    ) {
      setFormError('amount');
      return;
    }

    setFormError(null);
    postingRef.current = true;
    setPosting(true);
    try {
      const response = await fetch(`/pay/${encodeURIComponent(profile.username)}/invoice`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ amountSats }),
      });
      if (!response.ok) {
        setFormError('failed');
        return;
      }
      const result = (await response.json()) as { pr: string; amountSats: number };
      setInvoice(result.pr);
    } catch {
      setFormError('failed');
    } finally {
      postingRef.current = false;
      setPosting(false);
    }
  };

  return (
    <PageChrome topLeft={<HomeWordmark />} topRight={<LanguageSwitcher tone="light" />}>
      <Card maxWidth="xl" surface={false}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 64 64"
          aria-hidden="true"
          className="h-12 w-12 text-app-fg"
        >
          <g
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 32v24a2 2 0 0 0 2 2h36a2 2 0 0 0 2-2V32" />
            <rect x="8" y="23" width="48" height="9" rx="2" />
            <path d="M32 23C29 12 25 7 20 9c-8 3-4 14 12 14ZM32 23c3-11 7-16 12-14 8 3 4 14-12 14ZM32 23v9" />
            <g transform="translate(20 33)">
              <path d="M11.767 19.089c4.924.868 6.14-6.025 1.216-6.894m-1.216 6.894L5.86 18.047m5.908 1.042-.347 1.97m1.563-8.864c4.924.869 6.14-6.025 1.215-6.893m-1.215 6.893-3.94-.694m5.155-6.2L8.29 4.26m5.908 1.042.348-1.97M7.48 20.364l3.126-17.727" />
            </g>
          </g>
        </svg>

        {invalid ? (
          <p role="alert" className="text-sm text-app-danger">
            {t('pay.invalid')}
          </p>
        ) : null}

        {profile !== null ? (
          <>
            <h1 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
              {profile.name}
            </h1>
            <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
              <Field
                label={t('pay.amount')}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder={t('pay.amountPlaceholder')}
                value={amount}
                disabled={posting || invoice !== null}
                onChange={(event) => {
                  setAmount(event.target.value);
                }}
              />
              {invoice === null ? (
                <Button type="submit" className="w-full" disabled={posting}>
                  {t('pay.createInvoice')}
                </Button>
              ) : null}
            </form>

            {formError === 'amount' ? (
              <p role="alert" className="text-sm text-app-danger">
                {t('pay.amountInvalid')}
              </p>
            ) : null}
            {formError === 'failed' ? (
              <p role="alert" className="text-sm text-app-danger">
                {t('pay.failed')}
              </p>
            ) : null}

            {invoice !== null ? (
              <>
                {isSmartphone ? null : <QrCode value={invoice} label={t('pay.invoiceQr')} />}
                <Button
                  type="button"
                  aria-label={t('forum.payOpenWalletAria')}
                  icon={
                    <img
                      src="/wos-icon.png"
                      alt=""
                      width={20}
                      height={20}
                      aria-hidden="true"
                      className="h-5 w-5 rounded-md ring-1 ring-white/30"
                    />
                  }
                  onClick={() => {
                    window.location.href = android
                      ? walletOfSatoshiIntentHref(invoice)
                      : walletOfSatoshiHref(invoice);
                  }}
                >
                  {t('forum.payOpenWallet')}
                </Button>
              </>
            ) : null}
          </>
        ) : null}
      </Card>
    </PageChrome>
  );
}
