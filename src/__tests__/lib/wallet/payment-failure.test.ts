import type { ErrorEvent } from '@sentry/nextjs';
import { captureMessage } from '@sentry/nextjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LnurlRelayError, WalletRequiredError } from '@/lib/api';
import { logInteraction } from '@/lib/interaction-log';
import { sentryOptions } from '@/lib/sentry';
import {
  reportPaymentFailure,
  type PaymentFailure,
  type PayReason,
} from '@/lib/wallet/payment-failure';

vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn() }));
vi.mock('@/lib/interaction-log', () => ({ logInteraction: vi.fn() }));

const PHRASE =
  'abandon ability able about above absent absorb abstract absurd abuse access accident';
const INVOICE = 'lnbc2500u1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypq';
const ADDRESS = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq';
const SPARK = 'spark1pgss9qf0yp5y0sv5v8wtlm7mn0q7cfhjvcq5m4mq4dg9xr0p0c4mr7xmgaqh8a';
/** A well-known test WIF private key (never funded). */
const WIF = 'KwDiBf89QgGbjEhKnhXJuH7LrciVrZi3qYjgd9M7rFU73sVHnoWn';
/** The BIP-32 test vector 1 master extended private key. */
const XPRV =
  'xprv9s21ZrQH143K3QTDL4LXw2F7HEK3wJUD2nW2nRk4stbPy6cq3jPPqjiChkVvvNKmPGJxWUtg6LnF5kejMRNNU3TGtRBeJgk33yuGBxrMPHi';

/** A send that the SDK refused, with every field set. */
const SEND_FAILURE: PaymentFailure = {
  stage: 'send',
  reason: 'no_route',
  method: 'lightning',
  amountSats: 2_100,
  feeSats: 3,
  error: new Error('Spark error: no route found'),
};

beforeEach(() => {
  vi.mocked(captureMessage).mockClear();
  vi.mocked(logInteraction).mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('reportPaymentFailure', () => {
  it('sends one Payment failed issue per stage and reason, and the member event', () => {
    reportPaymentFailure(SEND_FAILURE, 'gift', { session: 'sess' });
    expect(captureMessage).toHaveBeenCalledTimes(1);
    expect(captureMessage).toHaveBeenCalledWith('Payment failed', {
      level: 'error',
      fingerprint: ['payment-failed', 'send', 'no_route'],
      tags: {
        pay_stage: 'send',
        pay_reason: 'no_route',
        pay_method: 'lightning',
        pay_flow: 'gift',
      },
      extra: {
        amountSats: 2_100,
        feeSats: 3,
        onchainFees: null,
        errorName: 'Error',
        errorCode: 'spark',
      },
    });
    expect(logInteraction).toHaveBeenCalledWith(
      'payment_failed',
      { stage: 'send', reason: 'no_route', method: 'lightning', flow: 'gift', amountSats: 2_100 },
      'sess',
    );
  });

  it('reports a failure without an error or amount with empty fields, and the on-chain fee quote', () => {
    const onchainFees = { fast: 2_840, medium: 1_420, slow: 710 };
    reportPaymentFailure(
      {
        stage: 'confirm',
        reason: 'expired',
        method: 'onchain',
        amountSats: null,
        feeSats: null,
        onchainFees,
      },
      'send',
    );
    expect(captureMessage).toHaveBeenCalledWith(
      'Payment failed',
      expect.objectContaining({
        extra: {
          amountSats: null,
          feeSats: null,
          onchainFees,
          errorName: null,
          errorCode: null,
        },
      }),
    );
    expect(logInteraction).toHaveBeenCalledWith(
      'payment_failed',
      { stage: 'confirm', reason: 'expired', method: 'onchain', flow: 'send', amountSats: null },
      undefined,
    );
  });

  it.each<[string, unknown, Record<string, unknown>]>([
    [
      'the api relay reason',
      new LnurlRelayError('unreachable'),
      { errorName: 'LnurlRelayError', errorCode: 'unreachable' },
    ],
    [
      'a multi-word SDK error kind',
      new Error('Chain service error: broadcast refused'),
      { errorName: 'Error', errorCode: 'chain_service' },
    ],
    [
      'a thrown string by its type only',
      'insufficientFunds',
      { errorName: 'string', errorCode: null },
    ],
    [
      'a byte array by its type only',
      new Uint8Array([7, 7, 7]),
      { errorName: 'object', errorCode: null },
    ],
    [
      'an object that only carries a reason by its type only',
      { reason: 'lnbc1secret' },
      { errorName: 'object', errorCode: null },
    ],
    [
      'an Error whose name is not an identifier as Error',
      Object.assign(new Error('x'), { name: 'pay lnbc1secret failed' }),
      { errorName: 'Error', errorCode: null },
    ],
    [
      'an Error whose name is an identifier outside the known classes as Error',
      Object.assign(new Error('x'), {
        name: 'KwDiBf89QgGbjEhKnhXJuH7LrciVrZi3qYjgd9M7rFU73sVHnoWn',
      }),
      { errorName: 'Error', errorCode: null },
    ],
    [
      'a built-in error class by its name',
      new TypeError('Failed to fetch'),
      { errorName: 'TypeError', errorCode: null },
    ],
    [
      'an app error class by its name',
      new WalletRequiredError(),
      { errorName: 'WalletRequiredError', errorCode: null },
    ],
    [
      'an Error whose message is not text without a code',
      Object.assign(new Error(), { message: Symbol('m') as unknown as string }),
      { errorName: 'Error', errorCode: null },
    ],
  ])('names %s', (_label, error, fields) => {
    reportPaymentFailure({ ...SEND_FAILURE, reason: 'sdk_error', error }, 'send');
    expect(captureMessage).toHaveBeenCalledWith(
      'Payment failed',
      expect.objectContaining({ extra: expect.objectContaining(fields) }),
    );
  });

  it.each<[string, () => unknown, string]>([
    ['an object without a prototype', () => Object.create(null) as object, 'object'],
    [
      'an Error whose name getter throws',
      () =>
        Object.defineProperty(new Error('x'), 'name', {
          get(): never {
            throw new Error('no name');
          },
        }),
      'Error',
    ],
    [
      'an Error whose message getter throws',
      () =>
        Object.defineProperty(new Error(), 'message', {
          get(): never {
            throw new Error('no message');
          },
        }),
      'Error',
    ],
  ])('keeps only the type of %s, and still reports', (_label, make, errorName) => {
    const unprintable = make();
    expect(() => {
      reportPaymentFailure({ ...SEND_FAILURE, reason: 'sdk_error', error: unprintable }, 'send');
    }).not.toThrow();
    expect(captureMessage).toHaveBeenCalledWith(
      'Payment failed',
      expect.objectContaining({
        extra: expect.objectContaining({ errorName, errorCode: null }),
      }),
    );
    expect(logInteraction).toHaveBeenCalledTimes(1);
  });

  it.each<PayReason>(['unlock', 'insufficient', 'below_minimum'])(
    'records %s as a member event only, never to error reporting',
    (reason) => {
      reportPaymentFailure({ ...SEND_FAILURE, stage: 'prepare', reason }, 'send', {
        session: 'sess',
      });
      expect(captureMessage).not.toHaveBeenCalled();
      expect(logInteraction).toHaveBeenCalledWith(
        'payment_failed',
        expect.objectContaining({ stage: 'prepare', reason }),
        'sess',
      );
    },
  );

  it('records a heart as a member event only: hearts keep their own report', () => {
    reportPaymentFailure(SEND_FAILURE, 'heart', { session: 'sess' });
    expect(captureMessage).not.toHaveBeenCalled();
    expect(logInteraction).toHaveBeenCalledWith(
      'payment_failed',
      expect.objectContaining({ reason: 'no_route', flow: 'heart' }),
      'sess',
    );
  });

  it('reports a timed-out send at once, and the member event only when it did not go out', async () => {
    let settle: (sent: boolean) => void = () => undefined;
    const sentLate = new Promise<boolean>((resolve) => {
      settle = resolve;
    });
    const timeout: PaymentFailure = { ...SEND_FAILURE, reason: 'timeout', error: undefined };
    reportPaymentFailure(timeout, 'inbox', { session: 'sess', sentLate });
    expect(captureMessage).toHaveBeenCalledWith(
      'Payment failed',
      expect.objectContaining({ fingerprint: ['payment-failed', 'send', 'timeout'] }),
    );
    expect(logInteraction).not.toHaveBeenCalled();
    settle(false);
    await vi.waitFor(() => {
      expect(logInteraction).toHaveBeenCalledWith(
        'payment_failed',
        expect.objectContaining({ reason: 'timeout', flow: 'inbox' }),
        'sess',
      );
    });
    expect(captureMessage).toHaveBeenCalledTimes(1);
  });

  it('reports a timed-out send that still went out as sent_late, with no member event', async () => {
    const timeout: PaymentFailure = { ...SEND_FAILURE, reason: 'timeout' };
    reportPaymentFailure(timeout, 'send', { sentLate: Promise.resolve(true) });
    await vi.waitFor(() => {
      expect(captureMessage).toHaveBeenCalledTimes(2);
    });
    expect(captureMessage).toHaveBeenLastCalledWith('Payment failed', {
      level: 'error',
      fingerprint: ['payment-failed', 'send', 'sent_late'],
      tags: {
        pay_stage: 'send',
        pay_reason: 'sent_late',
        pay_method: 'lightning',
        pay_flow: 'send',
      },
      extra: expect.objectContaining({ amountSats: 2_100 }),
    });
    expect(logInteraction).not.toHaveBeenCalled();
  });

  it('sends nothing more for a heart whose late send went out', async () => {
    const timeout: PaymentFailure = { ...SEND_FAILURE, reason: 'timeout' };
    const sentLate = Promise.resolve(true);
    reportPaymentFailure(timeout, 'heart', { sentLate });
    await sentLate;
    await Promise.resolve();
    expect(captureMessage).not.toHaveBeenCalled();
    expect(logInteraction).not.toHaveBeenCalled();
  });

  it('reports a timeout without a late send at once, event included', () => {
    reportPaymentFailure({ ...SEND_FAILURE, reason: 'timeout' }, 'send');
    expect(captureMessage).toHaveBeenCalledTimes(1);
    expect(logInteraction).toHaveBeenCalledWith(
      'payment_failed',
      expect.objectContaining({ reason: 'timeout' }),
      undefined,
    );
  });

  it.each<[string, unknown]>([
    ['a byte array', new Uint8Array([131, 7, 251, 64, 9, 200, 17, 3])],
    ['a WIF private key', new Error(`Generic error: bad key ${WIF}`)],
    ['an extended private key', new Error(`Signer error: ${XPRV}`)],
    [
      'an invoice, addresses, and a phrase',
      new Error(`Generic error: ${INVOICE} ${ADDRESS} ${SPARK} bob@example.com ${PHRASE}`),
    ],
    ['a thrown key string', WIF],
  ])('never puts %s into the report, before or after the scrubber', (_label, error) => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', 'https://publickey@errors.example/42');
    vi.stubEnv('NEXT_PUBLIC_APP_VERSION', '123');
    const options = sentryOptions('browser');
    if (options === null) {
      throw new Error('expected error reporting to be on');
    }
    reportPaymentFailure({ ...SEND_FAILURE, reason: 'sdk_error', error }, 'send', {
      session: 'sess',
    });
    const [message, hint] = vi.mocked(captureMessage).mock.calls[0] as unknown as [
      string,
      { extra: Record<string, unknown>; tags: Record<string, string> },
    ];
    expect(Object.keys(hint.extra).sort()).toEqual([
      'amountSats',
      'errorCode',
      'errorName',
      'feeSats',
      'onchainFees',
    ]);
    const event = options.beforeSend({
      type: undefined,
      message,
      extra: hint.extra,
      tags: hint.tags,
    } as ErrorEvent);
    for (const sent of [JSON.stringify(hint), JSON.stringify(event)]) {
      for (const secret of [
        WIF,
        XPRV,
        INVOICE,
        ADDRESS,
        SPARK,
        'bob@example.com',
        'abandon ability',
        'Generic error',
        '131',
        '251',
      ]) {
        expect(sent).not.toContain(secret);
      }
    }
    const props = vi.mocked(logInteraction).mock.calls[0]?.[1];
    expect(Object.values(props ?? {}).every((value) => typeof value !== 'object')).toBe(true);
    expect(JSON.stringify(props)).not.toContain(WIF);
  });
});
