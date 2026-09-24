'use client';

import { type FormEvent, type ReactElement, useEffect, useRef, useState } from 'react';
import { HomeWordmark } from '@/components/HomeWordmark';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useTranslations } from '@/components/LocaleProvider';
import { QrCode } from '@/components/QrCode';
import { AmountEntry } from '@/components/AmountEntry';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { Button, Card, PageChrome } from '@/components/ui';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { useLatestRateDay } from '@/hooks/useLatestRateDay';
import type { AmountUnit } from '@/lib/api-types';
import { payLinkUsername } from '@/lib/pay-link';
import {
  formatBitcoin,
  formatFiatDisplay,
  parseAmountDraft,
  satsToFiatAmount,
  type FiatRateDay,
} from '@/lib/stats-money';
import {
  SHOP_STICKER_PICTOGRAM,
  SHOP_STICKER_PICTOGRAM_VIEW_BOX,
  type ShopStickerPictogramPart,
} from '@/lib/shop-sticker-pictogram';
import {
  isAndroidUserAgent,
  walletOfSatoshiHref,
  walletOfSatoshiIntentHref,
} from '@/lib/wos-deep-link';

function PayLinkAmount(props: {
  value: string;
  onValueChange: (value: string) => void;
  disabled: boolean;
  onUnitChange: (unit: AmountUnit) => void;
  onRate: (day: FiatRateDay | null) => void;
}): ReactElement {
  const { t } = useTranslations();
  const rateDay = useLatestRateDay();
  const { onRate } = props;
  useEffect(() => {
    onRate(rateDay);
  }, [onRate, rateDay]);
  return (
    <AmountEntry
      label={t('pay.amount')}
      placeholder={t('pay.amountPlaceholder')}
      value={props.value}
      disabled={props.disabled}
      rateDay={rateDay}
      onUnitChange={props.onUnitChange}
      onValueChange={props.onValueChange}
    />
  );
}

interface PayCharge {
  amountSats: number;
  expiresAt: string;
}

interface PayProfile {
  name: string;
  username: string;
  minSats: number;
  maxSats: number;
  charge: PayCharge | null;
}

/** Remaining time as m:ss. */
function formatLeft(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * An unexpired till amount, or `null` when the payload is not one.
 *
 * @param value - `charge` from `GET /pay/:username`, if present.
 * @param now - Clock in epoch milliseconds.
 * @returns The charge the page should show.
 */
function readCharge(value: unknown, now: number): PayCharge | null {
  if (value === null || typeof value !== 'object') {
    return null;
  }
  const amountSats = (value as { amountSats?: unknown }).amountSats;
  const expiresAt = (value as { expiresAt?: unknown }).expiresAt;
  if (typeof amountSats !== 'number' || !Number.isSafeInteger(amountSats) || amountSats < 1) {
    return null;
  }
  if (typeof expiresAt !== 'string') {
    return null;
  }
  const expiresMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiresMs) || expiresMs <= now) {
    return null;
  }
  return { amountSats, expiresAt };
}

/** Open Wallet of Satoshi on this invoice. */
function openWallet(invoice: string, android: boolean): void {
  window.location.href = android
    ? walletOfSatoshiIntentHref(invoice)
    : walletOfSatoshiHref(invoice);
}

/** Viewer's fiat for a till amount, or nothing when no gift-day rate is ready. */
function ChargeFiat(props: { amountSats: number }): ReactElement | null {
  const { fiat } = useFiatPreference();
  const { numberFormat } = useNumberFormat();
  const rateDay = useLatestRateDay();
  const amount = satsToFiatAmount(props.amountSats, rateDay, fiat);
  if (amount === null) {
    return null;
  }
  return (
    <p className="text-center text-sm text-app-subtle">
      {formatFiatDisplay(amount, fiat, numberFormat)}
    </p>
  );
}

/** Gift outline with a Bitcoin symbol, for a pay link that has no open till. */
function GiftGlyph(): ReactElement {
  return (
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
  );
}

function shopStroke(part: ShopStickerPictogramPart): {
  stroke?: string;
  strokeWidth?: number;
  strokeLinejoin?: 'round';
} {
  if (part.stroke === undefined) {
    return {};
  }
  if (part.stroke.roundJoin === true) {
    return {
      stroke: part.stroke.color,
      strokeWidth: part.stroke.width,
      strokeLinejoin: 'round',
    };
  }
  return { stroke: part.stroke.color, strokeWidth: part.stroke.width };
}

/** Shop-sticker storefront, shown while a till charge is open. */
function ShopStickerIcon(): ReactElement {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={SHOP_STICKER_PICTOGRAM_VIEW_BOX}
      aria-hidden="true"
      className="h-12 w-12"
    >
      {SHOP_STICKER_PICTOGRAM.map((part) => (
        <path key={part.d} d={part.d} fill={part.fill ?? 'none'} {...shopStroke(part)} />
      ))}
    </svg>
  );
}

/**
 * Public LNURL payment form that creates one exact-amount BOLT11 invoice.
 *
 * @param props - Encoded LNURL from the `lightning` query parameter.
 * @returns Public payment chrome, validation state, and invoice QR when created.
 */
export function PayLinkScreen({ lightning }: { lightning: string }): ReactElement {
  const { t } = useTranslations();
  const { fiat } = useFiatPreference();
  const { numberFormat } = useNumberFormat();
  const [unit, setUnit] = useState<AmountUnit>('btc');
  const [now, setNow] = useState(() => Date.now());
  const [rateDay, setRateDay] = useState<FiatRateDay | null>(null);
  const [profile, setProfile] = useState<PayProfile | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [amount, setAmount] = useState('');
  const [formError, setFormError] = useState<'amount' | 'failed' | null>(null);
  const [posting, setPosting] = useState(false);
  const [invoice, setInvoice] = useState<string | null>(null);
  const [mintNonce, setMintNonce] = useState(0);
  const postingRef = useRef(false);
  const generationRef = useRef(0);
  /* v8 ignore next 2 -- SSR has no navigator */
  const android =
    typeof navigator !== 'undefined' ? isAndroidUserAgent(navigator.userAgent) : false;

  useEffect(() => {
    let active = true;
    generationRef.current += 1;
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
        if (!response.ok) {
          if (!active) {
            return;
          }
          setInvalid(true);
          return;
        }
        const body = (await response.json()) as PayProfile & { charge?: unknown };
        if (!active) {
          return;
        }
        setProfile({
          name: body.name,
          username: body.username,
          minSats: body.minSats,
          maxSats: body.maxSats,
          charge: readCharge(body.charge, Date.now()),
        });
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

  const charge = profile?.charge ?? null;
  const remaining = charge === null ? 0 : Date.parse(charge.expiresAt) - now;
  const chargeLive = charge !== null && remaining > 0;

  useEffect(() => {
    if (charge === null) {
      return;
    }
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      clearInterval(timer);
    };
  }, [charge]);

  useEffect(() => {
    if (charge !== null && !chargeLive) {
      setInvoice(null);
      setFormError(null);
      postingRef.current = false;
      setPosting(false);
    }
  }, [charge, chargeLive]);

  useEffect(() => {
    if (!chargeLive || profile === null || charge === null) {
      return;
    }
    const generation = generationRef.current;
    let active = true;
    postingRef.current = true;
    setPosting(true);
    setFormError(null);
    void fetch(`/pay/${encodeURIComponent(profile.username)}/invoice`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ amountSats: charge.amountSats }),
    })
      .then(async (response) => {
        const result = response.ok ? ((await response.json()) as { pr: string }) : null;
        if (!active || generationRef.current !== generation) {
          return;
        }
        if (result === null) {
          setFormError('failed');
          return;
        }
        setInvoice(result.pr);
      })
      .catch(() => {
        if (active && generationRef.current === generation) {
          setFormError('failed');
        }
      })
      .finally(() => {
        if (active && generationRef.current === generation) {
          postingRef.current = false;
          setPosting(false);
        }
      });
    return () => {
      active = false;
      if (generationRef.current === generation) {
        postingRef.current = false;
        setPosting(false);
      }
    };
  }, [charge, chargeLive, mintNonce, profile]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    /* v8 ignore next 3 -- the form is not mounted until a profile exists */
    if (profile === null) {
      return;
    }
    if (postingRef.current || invoice !== null) {
      return;
    }
    const generation = generationRef.current;
    const parsed = parseAmountDraft(unit, amount, rateDay, fiat);
    if (
      parsed.kind !== 'sats' ||
      !Number.isSafeInteger(parsed.sats) ||
      parsed.sats < profile.minSats ||
      parsed.sats > profile.maxSats
    ) {
      setFormError('amount');
      return;
    }
    const amountSats = parsed.sats;

    setFormError(null);
    postingRef.current = true;
    setPosting(true);
    try {
      const response = await fetch(`/pay/${encodeURIComponent(profile.username)}/invoice`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ amountSats }),
      });
      if (generationRef.current !== generation) {
        return;
      }
      if (!response.ok) {
        setFormError('failed');
        return;
      }
      const result = (await response.json()) as { pr: string; amountSats: number };
      if (generationRef.current !== generation) {
        return;
      }
      setInvoice(result.pr);
    } catch {
      if (generationRef.current === generation) {
        setFormError('failed');
      }
    } finally {
      if (generationRef.current === generation) {
        postingRef.current = false;
        setPosting(false);
      }
    }
  };

  return (
    <PageChrome topLeft={<HomeWordmark />} topRight={<LanguageSwitcher tone="light" />}>
      <Card maxWidth="xl" surface={false}>
        {chargeLive ? <ShopStickerIcon /> : <GiftGlyph />}

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
            {chargeLive && charge !== null ? (
              <div className="flex w-full flex-col gap-3">
                <p className="text-center text-sm text-app-subtle">
                  {t('pay.timeLeft', { time: formatLeft(remaining) })}
                </p>
                <p className="text-center text-2xl font-semibold tabular-nums lining-nums text-app-fg">
                  {formatBitcoin(charge.amountSats, numberFormat)}
                </p>
                <ChargeFiat amountSats={charge.amountSats} />
                {formError === 'failed' ? (
                  <p role="alert" className="text-center text-sm text-app-danger">
                    {t('pay.failed')}
                  </p>
                ) : null}
                {invoice !== null ? (
                  <div className="flex w-full justify-center">
                    <QrCode value={invoice} label={t('pay.invoiceQr')} />
                  </div>
                ) : null}
                <Button
                  type="button"
                  className="w-full"
                  aria-label={t('forum.payOpenWalletAria')}
                  disabled={posting || (invoice === null && formError !== 'failed')}
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
                    if (invoice !== null) {
                      openWallet(invoice, android);
                      return;
                    }
                    setMintNonce((nonce) => nonce + 1);
                  }}
                >
                  {t('forum.payOpenWallet')}
                </Button>
              </div>
            ) : (
              <>
                <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
                  <PayLinkAmount
                    value={amount}
                    disabled={posting || invoice !== null}
                    onUnitChange={setUnit}
                    onValueChange={setAmount}
                    onRate={setRateDay}
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
                    <QrCode value={invoice} label={t('pay.invoiceQr')} />
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
                        openWallet(invoice, android);
                      }}
                    >
                      {t('forum.payOpenWallet')}
                    </Button>
                  </>
                ) : null}
              </>
            )}
          </>
        ) : null}
      </Card>
    </PageChrome>
  );
}
