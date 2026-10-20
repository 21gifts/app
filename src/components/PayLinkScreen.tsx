'use client';

import { type FormEvent, type ReactElement, useCallback, useEffect, useRef, useState } from 'react';
import { HomeWordmark } from '@/components/HomeWordmark';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useTranslations } from '@/components/LocaleProvider';
import { QrCode } from '@/components/QrCode';
import { AmountEntry } from '@/components/AmountEntry';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { Button, Card, PageChrome } from '@/components/ui';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { useSpotRate } from '@/hooks/useSpotRate';
import type { AmountUnit } from '@/lib/api-types';
import { payLinkUsername } from '@/lib/pay-link';
import {
  formatBitcoin,
  formatFiatDisplay,
  parseAmountDraft,
  satsToFiatAmount,
  type FiatCode,
  type FiatRateDay,
} from '@/lib/stats-money';
import { formatDefinedGoalAmount } from '@/lib/forum-goal';
import {
  SHOP_STICKER_PICTOGRAM,
  SHOP_STICKER_PICTOGRAM_VIEW_BOX,
  type ShopStickerPictogramPart,
} from '@/lib/shop-sticker-pictogram';
import { isSmartphoneUserAgent, lightningHref, PAY_POLL_MS } from '@/lib/payment-link';
import {
  fetchShopInvoice,
  fetchShopPayLink,
  openShopPayment,
  type ShopPayRequest,
  type ShopPaymentStatus,
  waitShopPayment,
} from '@/lib/shop-payment';
import type { MessageKey } from '@/lib/messages';

function PayLinkAmount(props: {
  value: string;
  onValueChange: (value: string) => void;
  disabled: boolean;
  onUnitChange: (unit: AmountUnit) => void;
  rateDay: FiatRateDay | null;
}): ReactElement {
  const { t } = useTranslations();
  return (
    <AmountEntry
      label={t('pay.amount')}
      placeholder={t('pay.amountPlaceholder')}
      value={props.value}
      disabled={props.disabled}
      rateDay={props.rateDay}
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

/**
 * Outer width of the invoice QR plate: 232px modules, `p-4`, and a 1px border.
 * Pay uses this width so it lines up with the plate instead of the page column.
 */
const INVOICE_QR_PLATE_WIDTH = 'w-[16.625rem]';

/** Hand this invoice to the device's Bitcoin wallet app with a generic `lightning:` link. */
function openWallet(invoice: string): void {
  window.location.href = lightningHref(invoice);
}

/** Viewer's fiat for a till amount, or nothing when no spot rate is ready. */
function ChargeFiat(props: {
  amountSats: number;
  rateDay: FiatRateDay | null;
}): ReactElement | null {
  const { fiat } = useFiatPreference();
  const { numberFormat } = useNumberFormat();
  const amount = satsToFiatAmount(props.amountSats, props.rateDay, fiat);
  if (amount === null) {
    return null;
  }
  return (
    <p className="text-center text-sm text-app-subtle">
      {formatFiatDisplay(amount, fiat, numberFormat)}
    </p>
  );
}

/** Gift outline with a Bitcoin symbol, only when the pay link is not valid. */
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

/** Five minutes, the same lock as an open till. */
const PAYMENT_TTL_MS = 5 * 60 * 1000;

/**
 * Time until the pay link is read again for a quote.
 *
 * @param quoteExpiresAt - `quote.expiration` of the shown quote.
 * @returns The time left, or the poll pause once that time has passed.
 */
function refetchDelay(quoteExpiresAt: string): number {
  const left = Date.parse(quoteExpiresAt) - Date.now();
  return left > 0 ? left : PAY_POLL_MS;
}

/** A shop payment the page shows (`quote.payment` of the pay link). */
interface ShopPaymentView {
  /** Shop payment id. */
  id: string;
  /** Whole sats of the payment. */
  sats: number;
  /**
   * The fiat amount exactly as the payer typed it on this page, with its
   * currency; `null` for a till charge or an amount typed in bitcoin. The pay
   * link stores no fiat figure, so nothing else shows beside the bitcoin.
   */
  typedFiat: { amount: string; code: FiatCode } | null;
  /**
   * End of the payment's window: the charge's `expiresAt`, or the payer's
   * `expiresAt`; `null` when the opening answer had none (the quote's own
   * time left still shows).
   */
  windowEndsAt: string | null;
  /**
   * The newest pay request read for this payment; `null` while the pay link
   * could not be read yet after `POST /pay/:username/payment` opened it.
   */
  request: ShopPayRequest | null;
  /** Whether `request` is still the pay link's answer for this payment. */
  quoteLive: boolean;
  /** BOLT11 from the callback's Lightning detail, once read. */
  invoice: string | null;
  /** The Lightning detail could not be read. */
  invoiceFailed: boolean;
  /** Last `paymentStatus` from `GET /lnurlp/wait/:payment`. */
  paymentStatus: ShopPaymentStatus;
  /** `status` is no longer `Pending`: the payment is paid or closed and never changes again. */
  final: boolean;
}

/**
 * Catalog key of a shop payment's status line.
 *
 * @param status - Last `paymentStatus`.
 * @returns "waiting", "on its way", "paid", or "ended".
 */
function shopStatusKey(status: ShopPaymentStatus): MessageKey {
  if (status === 'accepted') {
    return 'pay.onItsWay';
  }
  if (status === 'paid') {
    return 'pos.paid';
  }
  if (status === 'open') {
    return 'pay.waiting';
  }
  return 'pay.ended';
}

/** Shop-sticker storefront, shown on a real pay link. */
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
 * Public LNURL payment page for one shop or member.
 *
 * @param props - Encoded LNURL from the `lightning` query parameter.
 * @returns Public payment chrome. A valid link shows the shop sticker, then the amount form or the active payment (locked sats, default fiat, and Pay). A shop payment of the pay link (an open till, or an entered amount through `POST /pay/:username/payment`) shows that payment's bitcoin amount (plus the fiat amount exactly as the payer typed it here, when it was typed in fiat; the pay link stores no fiat figure, so a till charge or an amount typed in bitcoin shows bitcoin only), its invoice, one line per stablecoin method and asset with the quote's time left, and its status; an open till's pay request whose sats differ from the charge (the till replaced it after the profile was read) loads the pay profile again once per payment instead of showing that pair, and shows the invoice error when it still differs; an entered amount whose pay request names another payment or other sats than the payer entered returns to the amount field and asks for the amount again; once that payment closed without being paid, the page returns to the amount form, or reads the pay link of a till that is still open again; when the wait route first answers that the api does not know the payment, the page reads the pay link once: the same payment for the same sats stays shown and its status is followed from the start, while anything else loads a till again or asks the payer for the amount again; otherwise the page mints with `POST /pay/:username/invoice`. Pay hands the invoice to the device's Bitcoin wallet app through a generic `lightning:` link. The invoice QR mounts only when one exists and the visitor is not a smartphone. An invalid link shows the gift glyph.
 */
export function PayLinkScreen({ lightning }: { lightning: string }): ReactElement {
  const { t } = useTranslations();
  const { fiat } = useFiatPreference();
  const { numberFormat } = useNumberFormat();
  const [unit, setUnit] = useState<AmountUnit>('btc');
  const [now, setNow] = useState(() => Date.now());
  const [profile, setProfile] = useState<PayProfile | null>(null);
  const rateDay = useSpotRate(profile !== null);
  const [invalid, setInvalid] = useState(false);
  const [amount, setAmount] = useState('');
  const [formError, setFormError] = useState<
    'amount' | 'rate' | 'failed' | 'start' | 'replaced' | null
  >(null);
  const [posting, setPosting] = useState(false);
  const [invoice, setInvoice] = useState<string | null>(null);
  const [mintedSats, setMintedSats] = useState<number | null>(null);
  const [mintedExpiresAt, setMintedExpiresAt] = useState<string | null>(null);
  const [showInvoiceQr, setShowInvoiceQr] = useState(false);
  const [mintNonce, setMintNonce] = useState(0);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [shop, setShop] = useState<ShopPaymentView | null>(null);
  const postingRef = useRef(false);
  const generationRef = useRef(0);
  /** Payment ids the page already started again for once, after the api did not know them. */
  const restartedRef = useRef(new Set<string>());
  /** Payment ids that closed without being paid; the page never shows them again. */
  const closedRef = useRef(new Set<string>());
  /**
   * Payment ids whose pay request named other sats than the till's charge, for which the page
   * already loaded the pay profile again once.
   */
  const amountReloadedRef = useRef(new Set<string>());
  /**
   * Per username, the end of the most recent `POST /pay/:username/payment` whose outcome stayed
   * unknown (`openShopPayment`), including a call still running when the page left it. Kept for
   * the lifetime of the page: switching to another pay link and back does not end it; only a
   * call that returns a payment does.
   */
  const shopAmbiguousAtRef = useRef(new Map<string, number>());
  /** Aborts the running **Continue** (its repeat and its wait) when the page leaves the pay link. */
  const submitAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setShowInvoiceQr(!isSmartphoneUserAgent(navigator.userAgent));
  }, []);

  useEffect(() => {
    let active = true;
    generationRef.current += 1;
    setInvalid(false);
    setProfile(null);
    setInvoice(null);
    setMintedSats(null);
    setMintedExpiresAt(null);
    setShop(null);
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
        // Same render as a reloaded charge: its first paint already counts from now.
        setNow(Date.now());
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
      // Leaving the pay link (another link, a reload, or unmount) stops a running Continue.
      submitAbortRef.current?.abort();
      submitAbortRef.current = null;
    };
  }, [lightning, reloadNonce]);

  const charge = profile?.charge ?? null;
  const remaining = charge === null ? 0 : Date.parse(charge.expiresAt) - now;
  const chargeLive = charge !== null && remaining > 0;
  const mintedRemaining = mintedExpiresAt === null ? 0 : Date.parse(mintedExpiresAt) - now;
  const mintedLive = invoice !== null && mintedExpiresAt !== null && mintedRemaining > 0;
  const shopId = shop?.id ?? null;
  const shopSats = shop?.sats ?? null;
  const quoteExpiresAt =
    shop !== null && shop.paymentStatus === 'open' && shop.quoteLive && shop.request !== null
      ? shop.request.quoteExpiresAt
      : null;
  // Only a waiting payment reads its pay link again: once it moved on, a plain or other
  // pay request no longer means that another payer replaced it.
  const awaitingRequest = shop !== null && shop.request === null && shop.paymentStatus === 'open';

  useEffect(() => {
    if (charge === null && mintedExpiresAt === null && shopId === null) {
      return;
    }
    // The clock last moved at mount: a payment opened minutes later counts from now.
    setNow(Date.now());
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      clearInterval(timer);
    };
  }, [charge, mintedExpiresAt, shopId]);

  useEffect(() => {
    if (charge !== null && !chargeLive) {
      setInvoice(null);
      setFormError(null);
      postingRef.current = false;
      setPosting(false);
    }
  }, [charge, chargeLive]);

  useEffect(() => {
    if (invoice === null || mintedExpiresAt === null || Date.parse(mintedExpiresAt) > now) {
      return;
    }
    setInvoice(null);
    setMintedSats(null);
    setMintedExpiresAt(null);
    setFormError(null);
    postingRef.current = false;
    setPosting(false);
  }, [invoice, mintedExpiresAt, now]);

  /**
   * Update the shown shop payment. A generation shows at most one shop payment
   * and every caller checks its generation first, so this is that payment.
   */
  const patchShop = useCallback((patch: Partial<ShopPaymentView>): void => {
    setShop((current) => {
      /* v8 ignore next 3 -- callers check the generation, and a new generation starts without a shop payment */
      if (current === null) {
        return null;
      }
      return { ...current, ...patch };
    });
  }, []);

  /** Read the shop payment's BOLT11 from the callback's Lightning detail. */
  const loadShopInvoice = useCallback(
    async (request: ShopPayRequest, generation: number): Promise<void> => {
      const pr = await fetchShopInvoice(request);
      if (generationRef.current !== generation) {
        return;
      }
      patchShop(pr === null ? { invoiceFailed: true } : { invoice: pr, invoiceFailed: false });
    },
    [patchShop],
  );

  /** Show a shop payment of the pay link and read its invoice; never mints. */
  const showShopPayment = useCallback(
    (
      id: string,
      sats: number,
      typedFiat: ShopPaymentView['typedFiat'],
      windowEndsAt: string | null,
      request: ShopPayRequest | null,
      generation: number,
    ): void => {
      // Same render as the payment: its first paint already counts from now.
      setNow(Date.now());
      setShop({
        id,
        sats,
        typedFiat,
        windowEndsAt,
        request,
        quoteLive: true,
        invoice: null,
        invoiceFailed: false,
        paymentStatus: 'open',
        final: false,
      });
      if (request !== null) {
        void loadShopInvoice(request, generation);
      }
    },
    [loadShopInvoice],
  );

  useEffect(() => {
    if (!chargeLive || profile === null || charge === null) {
      return;
    }
    // Each attempt starts from nothing: a later answer of an earlier attempt (pay link,
    // Lightning detail, or mint) is dropped, and only this attempt's one BOLT11 is shown.
    generationRef.current += 1;
    const generation = generationRef.current;
    setShop(null);
    setInvoice(null);
    setMintedSats(null);
    setMintedExpiresAt(null);
    let active = true;
    postingRef.current = true;
    setPosting(true);
    setFormError(null);
    void (async () => {
      try {
        const link = await fetchShopPayLink(profile.username);
        if (!active || generationRef.current !== generation) {
          return;
        }
        if (link.kind === 'payment' && closedRef.current.has(link.request.payment)) {
          // That payment closed unpaid and is never shown again; a pay request never mints.
          setFormError('failed');
          return;
        }
        if (link.kind === 'payment' && link.request.amountSats !== charge.amountSats) {
          // The till replaced its charge after the pay profile was read: never show the old sats
          // next to this payment's invoice. Load the profile again once per payment; when it still
          // disagrees, nothing is shown and Pay reads again.
          if (!amountReloadedRef.current.has(link.request.payment)) {
            amountReloadedRef.current.add(link.request.payment);
            setReloadNonce((nonce) => nonce + 1);
            return;
          }
          setFormError('failed');
          return;
        }
        if (link.kind === 'payment') {
          // The window is the charge's `expiresAt`: no answer the page reads carries the payment's
          // own window end, and the charge has no id to compare, so a charge the till replaced
          // with one for the same sats after the profile was read keeps the old time left.
          showShopPayment(
            link.request.payment,
            charge.amountSats,
            null,
            charge.expiresAt,
            link.request,
            generation,
          );
          return;
        }
        if (link.kind === 'error') {
          // A shop payment may exist; only the plain Lightning request mints. Pay reads again.
          setFormError('failed');
          return;
        }
        const response = await fetch(`/pay/${encodeURIComponent(profile.username)}/invoice`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ amountSats: charge.amountSats }),
        });
        const result = response.ok ? ((await response.json()) as { pr: string }) : null;
        if (!active || generationRef.current !== generation) {
          return;
        }
        if (result === null) {
          setFormError('failed');
          return;
        }
        setInvoice(result.pr);
      } catch {
        if (active && generationRef.current === generation) {
          setFormError('failed');
        }
      } finally {
        if (active && generationRef.current === generation) {
          postingRef.current = false;
          setPosting(false);
        }
      }
    })();
    return () => {
      active = false;
      if (generationRef.current === generation) {
        postingRef.current = false;
        setPosting(false);
      }
    };
  }, [charge, chargeLive, mintNonce, profile, showShopPayment]);

  useEffect(() => {
    if (shopId === null || !awaitingRequest || profile === null) {
      return;
    }
    const username = profile.username;
    const generation = generationRef.current;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const read = (): void => {
      void fetchShopPayLink(username).then((link) => {
        if (!active) {
          return;
        }
        if (link.kind !== 'payment') {
          // A failed read says nothing, and the plain request also answers once the payment was
          // accepted or its window passed: keep it, the status poll tells which, and a status
          // other than `open` ends these reads.
          timer = setTimeout(read, PAY_POLL_MS);
          return;
        }
        if (link.request.payment !== shopId || link.request.amountSats !== shopSats) {
          // Another payer's amount replaced this one, or the pay request names other sats than
          // the payer entered: back to the amount field.
          setShop(null);
          setFormError('replaced');
          return;
        }
        patchShop({ request: link.request, quoteLive: true });
        void loadShopInvoice(link.request, generation);
      });
    };
    timer = setTimeout(read, PAY_POLL_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [shopId, shopSats, awaitingRequest, profile, patchShop, loadShopInvoice]);

  useEffect(() => {
    if (shopId === null || quoteExpiresAt === null || profile === null) {
      return;
    }
    const username = profile.username;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const refetch = (): void => {
      void fetchShopPayLink(username).then((link) => {
        if (!active) {
          return;
        }
        if (link.kind === 'error') {
          // A failed read says nothing about the payment: keep it and read again. Its lines stay
          // hidden once the quote has run out, until a read returns a new quote.
          timer = setTimeout(refetch, PAY_POLL_MS);
          return;
        }
        if (link.kind === 'plain' || link.request.payment !== shopId) {
          patchShop({ quoteLive: false });
          return;
        }
        patchShop({ request: link.request, quoteLive: true });
        if (link.request.quoteExpiresAt === quoteExpiresAt) {
          // The same expiry does not re-arm this effect, so arm it here.
          timer = setTimeout(refetch, refetchDelay(quoteExpiresAt));
        }
      });
    };
    timer = setTimeout(refetch, refetchDelay(quoteExpiresAt));
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [shopId, quoteExpiresAt, profile, patchShop]);

  const payUsername = profile?.username ?? null;
  // A till's shop payment has a charge; a payer's entered amount has none.
  const tillPayment = charge !== null;

  useEffect(() => {
    if (shopId === null || shopSats === null || payUsername === null) {
      return;
    }
    const controller = new AbortController();
    const generation = generationRef.current;
    let pause: ReturnType<typeof setTimeout> | undefined;
    let wake: (() => void) | undefined;
    const stale = (): boolean => controller.signal.aborted || generationRef.current !== generation;
    void (async () => {
      let since: ShopPaymentStatus | null = null;
      for (;;) {
        const result = await waitShopPayment(shopId, since, controller.signal);
        if (stale()) {
          return;
        }
        if (result === 'missing' && !restartedRef.current.has(shopId)) {
          // The api does not know this payment: start again from the pay link, once, for a till
          // and for a payer's amount alike.
          const link = await fetchShopPayLink(payUsername);
          if (stale()) {
            return;
          }
          // A failed read says nothing: keep the payment, and the next `missing` reads again.
          if (link.kind !== 'error') {
            restartedRef.current.add(shopId);
            if (
              link.kind === 'payment' &&
              link.request.payment === shopId &&
              link.request.amountSats === shopSats
            ) {
              // The pay link still names this payment for these sats: show it from this pay
              // request and follow its status from the start.
              patchShop({ request: link.request, quoteLive: true });
              void loadShopInvoice(link.request, generation);
              since = null;
              continue;
            }
            if (tillPayment) {
              // Anything else: the till's flow starts again from its profile.
              setReloadNonce((nonce) => nonce + 1);
              return;
            }
            // Another payment, other sats, or the plain request: this payer's amount was replaced.
            generationRef.current += 1;
            setShop(null);
            setFormError('replaced');
            return;
          }
        }
        if (result !== null && result !== 'missing') {
          since = result.paymentStatus;
          const final = result.status !== 'Pending';
          patchShop({ paymentStatus: result.paymentStatus, final });
          if (final) {
            // Paid stays on screen; a closed payment leaves it (see the effect below).
            return;
          }
          // The api holds a read with `since` while the status is unchanged: ask again at once.
          continue;
        }
        // Only a failed or unreadable read, an unknown payment whose pay link could not be read,
        // or an unknown payment after the one restart, pauses.
        await new Promise<void>((resolve) => {
          wake = resolve;
          pause = setTimeout(resolve, PAY_POLL_MS);
        });
        if (stale()) {
          return;
        }
      }
    })();
    return () => {
      controller.abort();
      clearTimeout(pause);
      wake?.();
    };
  }, [shopId, shopSats, payUsername, tillPayment, patchShop, loadShopInvoice]);

  useEffect(() => {
    if (shop === null || !shop.final || shop.paymentStatus !== 'ended') {
      return;
    }
    // Closed unpaid, it never changes again: back to the page's flow, as an expired minted
    // invoice. A till still in its window reads its pay link again and stays payable by
    // Lightning; a till that ran out shows the amount form.
    closedRef.current.add(shop.id);
    generationRef.current += 1;
    setShop(null);
    setFormError(null);
    postingRef.current = false;
    setPosting(false);
    if (chargeLive) {
      setMintNonce((nonce) => nonce + 1);
    }
  }, [shop, chargeLive]);

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
    if (parsed.kind === 'no-rate') {
      setFormError('rate');
      return;
    }
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
    // The exact digits typed in fiat are the only fiat this payment ever shows.
    const typedFiat = unit === 'fiat' ? { amount: amount.trim(), code: fiat } : null;
    const username = profile.username;

    setFormError(null);
    postingRef.current = true;
    setPosting(true);
    const controller = new AbortController();
    submitAbortRef.current = controller;
    try {
      const opening = await openShopPayment(username, amountSats, {
        ambiguousAtMs: shopAmbiguousAtRef.current.get(username) ?? null,
        signal: controller.signal,
      });
      // Recorded before the outcome is dropped: a call the page left may still have opened one.
      if (opening.ambiguousAtMs === null) {
        shopAmbiguousAtRef.current.delete(username);
      } else {
        shopAmbiguousAtRef.current.set(username, opening.ambiguousAtMs);
      }
      const start = opening.start;
      if (start.kind === 'aborted' || generationRef.current !== generation) {
        return;
      }
      if (start.kind === 'charge') {
        setReloadNonce((nonce) => nonce + 1);
        return;
      }
      if (start.kind === 'failed') {
        setFormError('start');
        return;
      }
      if (start.kind === 'opened') {
        const link = await fetchShopPayLink(profile.username);
        if (generationRef.current !== generation) {
          return;
        }
        // Read right after opening, a plain request cannot be this payment accepted or its window
        // passed: something else ended it, so it counts as replaced like another payment's quote.
        // A pay request for other sats is not the amount this payer entered either: never show
        // the entered sats beside its invoice, and count it as replaced too.
        if (
          link.kind === 'plain' ||
          (link.kind === 'payment' &&
            (link.request.payment !== start.payment || link.request.amountSats !== amountSats))
        ) {
          setFormError('replaced');
          return;
        }
        // An unreadable pay link keeps the opened payment: it is read again, the status poll
        // tells whether it moved on, and Continue would replace the live payment.
        showShopPayment(
          start.payment,
          amountSats,
          typedFiat,
          start.expiresAt,
          link.kind === 'payment' ? link.request : null,
          generation,
        );
        return;
      }
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
      setMintedSats(result.amountSats);
      setNow(Date.now());
      setMintedExpiresAt(new Date(Date.now() + PAYMENT_TTL_MS).toISOString());
    } catch {
      if (generationRef.current === generation) {
        setFormError('failed');
      }
    } finally {
      if (submitAbortRef.current === controller) {
        submitAbortRef.current = null;
      }
      if (generationRef.current === generation) {
        postingRef.current = false;
        setPosting(false);
      }
    }
  };

  const activeSats = chargeLive && charge !== null ? charge.amountSats : mintedSats;
  const paymentActive = activeSats !== null && (chargeLive || invoice !== null);
  const shopWindowLeft =
    shop === null || shop.windowEndsAt === null ? 0 : Date.parse(shop.windowEndsAt) - now;
  // Only the status hides the invoice: a transfer made in time can still move the payment.
  const shopOpen = shop !== null && shop.paymentStatus === 'open';
  const quoteLeft = quoteExpiresAt === null ? 0 : Date.parse(quoteExpiresAt) - now;
  const shopLines =
    shop !== null && shopOpen && shop.request !== null && quoteLeft > 0 ? shop.request.lines : [];

  return (
    <PageChrome
      topLeft={<ProfileChromeLeft wordmark={<HomeWordmark />} />}
      topRight={<LanguageSwitcher tone="light" />}
    >
      <Card maxWidth="xl" surface={false}>
        {invalid ? <GiftGlyph /> : profile !== null ? <ShopStickerIcon /> : null}

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
            {shop !== null ? (
              <div className="flex w-full flex-col items-center gap-3">
                {shopOpen && shopWindowLeft > 0 ? (
                  <p className="text-center text-sm text-app-subtle">
                    {t('pay.timeLeft', { time: formatLeft(shopWindowLeft) })}
                  </p>
                ) : null}
                <p className="text-center text-2xl font-semibold tabular-nums lining-nums text-app-fg">
                  {formatBitcoin(shop.sats, numberFormat)}
                </p>
                {shop.typedFiat !== null ? (
                  <p className="text-center text-sm text-app-subtle">
                    {formatDefinedGoalAmount(
                      shop.typedFiat.amount,
                      shop.typedFiat.code,
                      numberFormat,
                    )}
                  </p>
                ) : null}
                <p role="status" className="text-center text-xs text-app-subtle">
                  {t(shopStatusKey(shop.paymentStatus))}
                </p>
                {shopOpen ? (
                  <>
                    {shop.invoiceFailed ? (
                      <p role="alert" className="text-center text-sm text-app-danger">
                        {t('pay.failed')}
                      </p>
                    ) : null}
                    <div className={`flex max-w-full flex-col gap-3 ${INVOICE_QR_PLATE_WIDTH}`}>
                      {shop.invoice !== null && showInvoiceQr ? (
                        <QrCode value={shop.invoice} label={t('pay.invoiceQr')} />
                      ) : null}
                      <Button
                        type="button"
                        className="w-full"
                        aria-label={t('forum.payOpenWalletAria')}
                        disabled={shop.invoice === null && !shop.invoiceFailed}
                        onClick={() => {
                          if (shop.invoice !== null) {
                            openWallet(shop.invoice);
                            return;
                          }
                          const request = shop.request;
                          /* v8 ignore next 3 -- a failed invoice read always had a pay request */
                          if (request === null) {
                            return;
                          }
                          patchShop({ invoiceFailed: false });
                          void loadShopInvoice(request, generationRef.current);
                        }}
                      >
                        {t('forum.payOpenWallet')}
                      </Button>
                      {shopLines.length > 0 ? (
                        <>
                          <ul className="flex w-full flex-col gap-1 text-sm">
                            {shopLines.map((line) => (
                              <li
                                key={`${line.method}-${line.asset}`}
                                className="flex justify-between gap-3"
                              >
                                <span className="text-app-subtle">{line.method}</span>
                                <span className="tabular-nums lining-nums text-app-fg">
                                  {`${line.amount} ${line.asset}`}
                                </span>
                              </li>
                            ))}
                          </ul>
                          <p className="text-center text-sm text-app-subtle">
                            {t('pay.timeLeft', { time: formatLeft(quoteLeft) })}
                          </p>
                          <p className="text-center text-sm text-app-subtle">
                            {t('pay.stablecoinScan')}
                          </p>
                        </>
                      ) : null}
                    </div>
                  </>
                ) : null}
              </div>
            ) : paymentActive && activeSats !== null ? (
              <div className="flex w-full flex-col items-center gap-3">
                {chargeLive && charge !== null ? (
                  <p className="text-center text-sm text-app-subtle">
                    {t('pay.timeLeft', { time: formatLeft(remaining) })}
                  </p>
                ) : mintedLive ? (
                  <p className="text-center text-sm text-app-subtle">
                    {t('pay.timeLeft', { time: formatLeft(mintedRemaining) })}
                  </p>
                ) : null}
                <p className="text-center text-2xl font-semibold tabular-nums lining-nums text-app-fg">
                  {formatBitcoin(activeSats, numberFormat)}
                </p>
                <ChargeFiat amountSats={activeSats} rateDay={rateDay} />
                {formError === 'failed' ? (
                  <p role="alert" className="text-center text-sm text-app-danger">
                    {t('pay.failed')}
                  </p>
                ) : null}
                <div className={`flex max-w-full flex-col gap-3 ${INVOICE_QR_PLATE_WIDTH}`}>
                  {invoice !== null && showInvoiceQr ? (
                    <QrCode value={invoice} label={t('pay.invoiceQr')} />
                  ) : null}
                  <Button
                    type="button"
                    className="w-full"
                    aria-label={t('forum.payOpenWalletAria')}
                    disabled={posting || (invoice === null && formError !== 'failed')}
                    onClick={() => {
                      if (invoice !== null) {
                        openWallet(invoice);
                        return;
                      }
                      setMintNonce((nonce) => nonce + 1);
                    }}
                  >
                    {t('forum.payOpenWallet')}
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
                <PayLinkAmount
                  value={amount}
                  disabled={posting}
                  onUnitChange={setUnit}
                  onValueChange={setAmount}
                  rateDay={rateDay}
                />
                <Button type="submit" className="w-full" disabled={posting}>
                  {t('forum.payContinue')}
                </Button>
                {formError === 'amount' ? (
                  <p role="alert" className="text-sm text-app-danger">
                    {t('pay.amountInvalid')}
                  </p>
                ) : null}
                {formError === 'rate' ? (
                  <p role="alert" className="text-sm text-app-danger">
                    {t('pos.noRate', { code: fiat })}
                  </p>
                ) : null}
                {formError === 'failed' ? (
                  <p role="alert" className="text-sm text-app-danger">
                    {t('pay.failed')}
                  </p>
                ) : null}
                {formError === 'start' ? (
                  <p role="alert" className="text-sm text-app-danger">
                    {t('pay.startFailed')}
                  </p>
                ) : null}
                {formError === 'replaced' ? (
                  <p role="alert" className="text-sm text-app-danger">
                    {t('pay.replaced')}
                  </p>
                ) : null}
              </form>
            )}
          </>
        ) : null}
      </Card>
    </PageChrome>
  );
}
