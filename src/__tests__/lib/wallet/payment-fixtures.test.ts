import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { WALLET_VISUAL_FIXTURE_SATS } from '@/hooks/useWallet';
import { WALLET_PAYMENT_FIXTURES } from '@/lib/wallet/payment-fixtures';
import { toWalletPayment } from '@/lib/wallet/wallet-sdk';

const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

function sha256Hex(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex');
}

/** 5-bit words to bytes, dropping the padding bits. */
function wordsToBytes(words: number[]): Buffer {
  let acc = 0;
  let bits = 0;
  const out: number[] = [];
  for (const word of words) {
    acc = (acc << 5) | word;
    bits += 5;
    while (bits >= 8) {
      bits -= 8;
      out.push((acc >> bits) & 0xff);
    }
  }
  return Buffer.from(out);
}

/**
 * Reads the amount and the tagged fields of a BOLT11 invoice (no signature check).
 *
 * @param invoice - `lnbc…` invoice.
 * @returns The amount in sats and the tagged fields by their letter.
 */
function decodeBolt11(invoice: string): { sats: number; tags: Map<string, Buffer> } {
  const split = invoice.lastIndexOf('1');
  const hrp = invoice.slice(0, split);
  const match = /^lnbc(\d+)([munp]?)$/.exec(hrp);
  if (match === null) {
    throw new Error(`unexpected prefix ${hrp}`);
  }
  const multiplier = { m: 1e-3, u: 1e-6, n: 1e-9, p: 1e-12, '': 1 }[match[2] as 'm'];
  const sats = Math.round(Number(match[1]) * multiplier * 1e8);
  const words = [...invoice.slice(split + 1)].map((char) => CHARSET.indexOf(char));
  // Timestamp (7 words) first; signature (104 words) and checksum (6 words) last.
  const body = words.slice(7, words.length - 104 - 6);
  const tags = new Map<string, Buffer>();
  for (let index = 0; index < body.length;) {
    const type = CHARSET.charAt(body[index] as number);
    const length = ((body[index + 1] as number) << 5) | (body[index + 2] as number);
    tags.set(type, wordsToBytes(body.slice(index + 3, index + 3 + length)));
    index += 3 + length;
  }
  return { sats, tags };
}

describe('WALLET_PAYMENT_FIXTURES', () => {
  const payments = WALLET_PAYMENT_FIXTURES;

  it('uses UUID ids, newest first, all distinct', () => {
    const ids = payments.map((payment) => payment.id);
    for (const id of ids) {
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    }
    expect(new Set(ids).size).toBe(ids.length);
    const times = payments.map((payment) => payment.timestamp);
    expect([...times].sort((a, b) => b - a)).toEqual(times);
  });

  it('nets to the visual balance: received minus sent and fees, failed excluded, pending sends deducted', () => {
    let net = 0;
    for (const payment of payments) {
      if (payment.status === 'failed') {
        continue;
      }
      const amount = Number(payment.amount);
      const fees = Number(payment.fees);
      net += payment.paymentType === 'receive' ? amount : -(amount + fees);
    }
    expect(net).toBe(WALLET_VISUAL_FIXTURE_SATS);
  });

  it('gives every Lightning payment an invoice whose amount and payment hash match, and a preimage that hashes to it', () => {
    const lightning = payments.filter((payment) => payment.details?.type === 'lightning');
    expect(lightning.length).toBeGreaterThan(0);
    for (const payment of lightning) {
      const details = payment.details as Extract<
        NonNullable<(typeof payments)[number]['details']>,
        { type: 'lightning' }
      >;
      const invoice = decodeBolt11(details.invoice);
      expect(invoice.sats).toBe(Number(payment.amount));
      expect(invoice.tags.get('p')?.toString('hex')).toBe(details.htlcDetails.paymentHash);
      if (details.htlcDetails.preimage !== undefined) {
        expect(sha256Hex(Buffer.from(details.htlcDetails.preimage, 'hex'))).toBe(
          details.htlcDetails.paymentHash,
        );
      }
      expect(details.destinationPubkey).toMatch(/^0[23][0-9a-f]{64}$/);
    }
  });

  it('commits the zap invoice to its zap request, a kind-9734 event for the same amount', () => {
    const zaps = payments.filter(
      (payment) =>
        payment.details?.type === 'lightning' &&
        payment.details.lnurlReceiveMetadata?.nostrZapRequest !== undefined,
    );
    expect(zaps).toHaveLength(1);
    for (const payment of zaps) {
      const details = payment.details as Extract<
        NonNullable<(typeof payments)[number]['details']>,
        { type: 'lightning' }
      >;
      const request = details.lnurlReceiveMetadata?.nostrZapRequest as string;
      const event = JSON.parse(request) as { kind: number; tags: string[][] };
      expect(event.kind).toBe(9734);
      expect(event.tags.find((tag) => tag[0] === 'amount')?.[1]).toBe(
        String(Number(payment.amount) * 1000),
      );
      expect(decodeBolt11(details.invoice).tags.get('h')?.toString('hex')).toBe(sha256Hex(request));
      expect(toWalletPayment(payment).info.zap?.content).toBe('Great photo!');
    }
  });

  it('covers every method and status the payment screen shows', () => {
    const mapped = payments.map(toWalletPayment);
    expect(new Set(mapped.map((payment) => payment.method))).toEqual(
      new Set(['lightning', 'spark', 'deposit', 'withdraw']),
    );
    expect(new Set(mapped.map((payment) => payment.status))).toEqual(
      new Set(['completed', 'pending', 'failed']),
    );
    expect(mapped.some((payment) => payment.info.lnAddress !== undefined)).toBe(true);
  });
});
