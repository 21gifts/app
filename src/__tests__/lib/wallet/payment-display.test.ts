import { afterEach, describe, expect, it } from 'vitest';
import {
  paymentHref,
  paymentLookupHash,
  paymentMessage,
  paymentTitle,
} from '@/lib/wallet/payment-display';
import type { WalletPayment } from '@/lib/wallet/wallet-sdk';

const ORIGINAL_E2E_NOW = process.env.NEXT_PUBLIC_E2E_NOW;

function payment(overrides: Partial<WalletPayment>): WalletPayment {
  return {
    id: 'p',
    direction: 'received',
    amountSats: 1,
    feesSats: 0,
    timestamp: 0,
    status: 'completed',
    method: 'lightning',
    senderComment: null,
    info: {},
    ...overrides,
  };
}

const ZAP = { senderPubkey: 'ab', content: 'Great photo!', noteId: null };

afterEach(() => {
  if (ORIGINAL_E2E_NOW === undefined) {
    delete process.env.NEXT_PUBLIC_E2E_NOW;
  } else {
    process.env.NEXT_PUBLIC_E2E_NOW = ORIGINAL_E2E_NOW;
  }
  window.history.replaceState({}, '', '/');
});

describe('paymentTitle', () => {
  it('prefers a zap, then the paid address, then the description', () => {
    expect(
      paymentTitle(payment({ info: { zap: ZAP, lnAddress: 'bob@x', description: 'd' } })),
    ).toEqual({ key: 'wallet.payment.giftOnPost' });
    expect(paymentTitle(payment({ info: { lnAddress: 'bob@x', description: 'd' } }))).toEqual({
      text: 'bob@x',
    });
    expect(paymentTitle(payment({ info: { description: 'Coffee' } }))).toEqual({ text: 'Coffee' });
  });

  it('names a gift or shop memo, with a zap still first', () => {
    expect(paymentTitle(payment({ direction: 'sent', info: { purpose: 'gift' } }))).toEqual({
      key: 'wallet.payment.gift',
    });
    expect(paymentTitle(payment({ direction: 'received', info: { purpose: 'gift' } }))).toEqual({
      key: 'wallet.payment.giftOnPost',
    });
    expect(paymentTitle(payment({ info: { purpose: 'shop' } }))).toEqual({
      key: 'wallet.payment.shop',
    });
    expect(paymentTitle(payment({ info: { zap: ZAP, purpose: 'gift' } }))).toEqual({
      key: 'wallet.payment.giftOnPost',
    });
    expect(paymentTitle(payment({ info: { description: 'Coffee' } }))).toEqual({ text: 'Coffee' });
  });

  it('names an on-chain payment by its direction, else Received or Sent', () => {
    expect(paymentTitle(payment({ method: 'deposit' }))).toEqual({
      key: 'wallet.payment.method.deposit',
    });
    expect(paymentTitle(payment({ method: 'withdraw', direction: 'sent' }))).toEqual({
      key: 'wallet.payment.method.withdraw',
    });
    expect(paymentTitle(payment({}))).toEqual({ key: 'wallet.received' });
    expect(paymentTitle(payment({ direction: 'sent' }))).toEqual({ key: 'wallet.sent' });
  });
});

describe('paymentMessage', () => {
  it('prefers the payer note, then the zap message, then the address comment', () => {
    expect(
      paymentMessage(payment({ senderComment: 'Hi', info: { zap: ZAP, lnurlComment: 'c' } })),
    ).toBe('Hi');
    expect(paymentMessage(payment({ info: { zap: ZAP, lnurlComment: 'c' } }))).toBe('Great photo!');
    expect(
      paymentMessage(payment({ info: { zap: { ...ZAP, content: '' }, lnurlComment: 'c' } })),
    ).toBe('c');
    expect(paymentMessage(payment({}))).toBeNull();
  });

  it('treats a loan repayment marker as no message, in any case', () => {
    const marker = 'repay:12:22222222-2222-4222-8222-222222222222';
    expect(paymentMessage(payment({ info: { zap: { ...ZAP, content: marker } } }))).toBeNull();
    expect(
      paymentMessage(payment({ info: { zap: { ...ZAP, content: marker.toUpperCase() } } })),
    ).toBeNull();
    expect(
      paymentMessage(payment({ info: { zap: { ...ZAP, content: marker }, lnurlComment: 'c' } })),
    ).toBeNull();
  });

  it('keeps zap text that only resembles the marker', () => {
    for (const content of [
      'repay:x:22222222-2222-4222-8222-222222222222',
      'repay:1:2222',
      'repay:1:22222222-2222-4222-8222-222222222222 thanks',
      'Thanks! repay:1:22222222-2222-4222-8222-222222222222',
    ]) {
      expect(paymentMessage(payment({ info: { zap: { ...ZAP, content } } }))).toBe(content);
    }
  });
});

describe('paymentTitle for a repayment without its lookup', () => {
  it('keeps the gift titles; the repayment title comes from the lookup only', () => {
    const marker = { ...ZAP, content: 'repay:0:22222222-2222-4222-8222-222222222222' };
    expect(paymentTitle(payment({ info: { zap: marker } }))).toEqual({
      key: 'wallet.payment.giftOnPost',
    });
    expect(paymentTitle(payment({ direction: 'sent', info: { purpose: 'gift' } }))).toEqual({
      key: 'wallet.payment.gift',
    });
  });
});

describe('paymentLookupHash', () => {
  const HASH = 'A'.repeat(64);

  it('looks up a settled gift or memo-less payment by its lowercase hash', () => {
    expect(paymentLookupHash(payment({ info: { purpose: 'gift', paymentHash: HASH } }))).toBe(
      'a'.repeat(64),
    );
    expect(paymentLookupHash(payment({ status: 'failed', info: { paymentHash: HASH } }))).toBe(
      'a'.repeat(64),
    );
  });

  it('skips a pending payment, a shop payment, and a payment without a hash', () => {
    expect(paymentLookupHash(payment({ status: 'pending', info: { paymentHash: HASH } }))).toBe(
      null,
    );
    expect(paymentLookupHash(payment({ info: { purpose: 'shop', paymentHash: HASH } }))).toBe(null);
    expect(paymentLookupHash(payment({ info: { purpose: 'gift' } }))).toBeNull();
  });
});

describe('paymentHref', () => {
  it('encodes the id', () => {
    expect(paymentHref('a b')).toBe('/wallet/payment?id=a%20b');
  });

  it('keeps the rows pin in a Playwright build only', () => {
    window.history.replaceState({}, '', '/wallet?visual=history-rows');
    expect(paymentHref('x')).toBe('/wallet/payment?id=x');
    process.env.NEXT_PUBLIC_E2E_NOW = '2026-01-07T12:00:00.000Z';
    expect(paymentHref('x')).toBe('/wallet/payment?id=x&visual=history-rows');
    window.history.replaceState({}, '', '/wallet?visual=history-empty');
    expect(paymentHref('x')).toBe('/wallet/payment?id=x');
  });
});
