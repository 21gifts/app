import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { HabitCommentDonation } from '@/components/HabitCommentDonation';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const rateState = vi.hoisted(() => ({
  rateDay: null as null,
  settled: true,
}));
const phone = vi.hoisted(() => ({ current: false }));

vi.mock('@/hooks/useLatestRateDay', () => ({
  useLatestRateDayState: () => ({ rateDay: rateState.rateDay, settled: rateState.settled }),
}));
vi.mock('@/lib/wos-deep-link', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/wos-deep-link')>();
  return {
    ...actual,
    isSmartphoneUserAgent: () => phone.current,
  };
});

beforeEach(() => {
  rateState.rateDay = null;
  rateState.settled = true;
  phone.current = false;
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderDonation(): void {
  renderWithLocale(
    <HabitCommentDonation id="comment-1" name="Recipient" session="token" onClose={() => {}} />,
  );
}
it('requests an invoice for the selected comment with the entered amount and bearer', async () => {
  const fetcher = vi.fn(
    async () => new Response(JSON.stringify({ pr: 'test-invoice', amountSats: 100 })),
  );
  vi.stubGlobal('fetch', fetcher);
  renderWithLocale(
    <HabitCommentDonation id="comment-1" name="Recipient" session="token" onClose={() => {}} />,
  );
  const input = screen.getByRole('textbox');
  fireEvent.change(input, { target: { value: '100' } });
  fireEvent.click(screen.getByRole('button', { name: 'Donate Bitcoin' }));
  expect(await screen.findByRole('button', { name: 'Pay with Wallet of Satoshi' })).toBeTruthy();
  expect(fetcher).toHaveBeenCalledWith(
    '/habits/data',
    expect.objectContaining({
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
      body: JSON.stringify({ action: 'invoice', id: 'comment-1', amountSats: 100 }),
    }),
  );
});
it('keeps the amount editable after a failed request', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('{}', { status: 502 })),
  );
  const close = vi.fn();
  renderWithLocale(
    <HabitCommentDonation id="comment-1" name="Recipient" session="token" onClose={close} />,
  );
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '100' } });
  fireEvent.click(screen.getByRole('button', { name: 'Donate Bitcoin' }));
  await screen.findByRole('alert');
  await waitFor(() =>
    expect(
      (screen.getByRole('button', { name: 'Donate Bitcoin' }) as HTMLButtonElement).disabled,
    ).toBe(false),
  );
  expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('100');
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(close).toHaveBeenCalled();
});

it('rejects invalid amounts and suppresses a duplicate invoice request', async () => {
  let resolve!: (r: Response) => void;
  const fetcher = vi.fn(
    () =>
      new Promise<Response>((done) => {
        resolve = done;
      }),
  );
  vi.stubGlobal('fetch', fetcher);
  renderWithLocale(
    <HabitCommentDonation id="c" name="Recipient" session="token" onClose={() => {}} />,
  );
  const input = screen.getByRole('textbox');
  const form = input.closest('form')!;
  fireEvent.submit(form);
  expect(fetcher).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: '0' } });
  fireEvent.submit(form);
  expect(fetcher).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: '100' } });
  fireEvent.submit(form);
  fireEvent.submit(form);
  expect(fetcher).toHaveBeenCalledTimes(1);
  resolve(new Response(JSON.stringify({ pr: 'invoice', amountSats: 100 })));
  await screen.findByRole('button', { name: 'Pay with Wallet of Satoshi' });
});

it('keeps the submit disabled and shows no invoice before the rate settles', () => {
  rateState.settled = false;
  renderDonation();
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '100' } });
  expect(
    (screen.getByRole('button', { name: 'Donate Bitcoin' }) as HTMLButtonElement).disabled,
  ).toBe(true);
  expect(screen.queryByRole('button', { name: 'Pay with Wallet of Satoshi' })).toBeNull();
  expect(screen.queryByRole('img', { name: 'Bitcoin payment QR code' })).toBeNull();
});

it('shows the invoice when the rate settled without a usable day', async () => {
  rateState.settled = true;
  rateState.rateDay = null;
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ pr: 'test-invoice', amountSats: 100 }))),
  );
  renderDonation();
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '100' } });
  fireEvent.click(screen.getByRole('button', { name: 'Donate Bitcoin' }));
  expect(await screen.findByRole('button', { name: 'Pay with Wallet of Satoshi' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Donate Bitcoin' })).toBeNull();
});

it('omits the payment QR on a smartphone user agent', async () => {
  phone.current = true;
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ pr: 'test-invoice', amountSats: 100 }))),
  );
  renderDonation();
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '100' } });
  fireEvent.click(screen.getByRole('button', { name: 'Donate Bitcoin' }));
  expect(await screen.findByRole('button', { name: 'Pay with Wallet of Satoshi' })).toBeTruthy();
  expect(screen.queryByRole('img', { name: 'Bitcoin payment QR code' })).toBeNull();
});

it('shows the payment QR on a desktop user agent', async () => {
  phone.current = false;
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ pr: 'test-invoice', amountSats: 100 }))),
  );
  renderDonation();
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '100' } });
  fireEvent.click(screen.getByRole('button', { name: 'Donate Bitcoin' }));
  expect(await screen.findByRole('img', { name: 'Bitcoin payment QR code' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
});
