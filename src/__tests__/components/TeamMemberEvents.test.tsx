import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamMemberEvents } from '@/components/TeamMemberEvents';
import { useLatestRateDay } from '@/hooks/useLatestRateDay';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/lib/api', () => ({ fetchTeamMemberEvents: vi.fn() }));
vi.mock('@/hooks/useLatestRateDay', () => ({ useLatestRateDay: vi.fn() }));

import { fetchTeamMemberEvents } from '@/lib/api';

const eventsMock = vi.mocked(fetchTeamMemberEvents);
const AT = Date.parse('2026-10-01T12:00:00.000Z');

let observers: IntersectionObserverCallback[] = [];

class FakeObserver {
  public constructor(callback: IntersectionObserverCallback) {
    observers.push(callback);
  }
  public observe(): void {}
  public disconnect(): void {}
}

beforeEach(() => {
  vi.clearAllMocks();
  observers = [];
  vi.mocked(useLatestRateDay).mockReturnValue({
    sats: 100_000_000,
    usd: '60000.00',
    chf: '50000.00',
    eur: '55000.00',
    php: '3400000.00',
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('TeamMemberEvents', () => {
  it('lists events in plain words with path, props, and fiat beside sats', async () => {
    eventsMock.mockResolvedValue({
      events: [
        {
          name: 'payment_sent',
          at: AT,
          path: '/wallet',
          props: {
            amountSats: 2_100,
            paymentId: 'pay_1',
            ok: true,
            none: null,
            countSats: 'x',
            feeSats: -1,
            itemCount: 3,
            count: 1.5,
            id: 7,
            query: 'bread',
            term: 4,
          },
        },
        { name: 'screen_view', at: AT - 1, path: '', props: {} },
        { name: 'brand_new_event', at: AT - 2, path: null, props: {} },
      ],
      nextCursor: null,
    });
    renderWithLocale(<TeamMemberEvents session="sess" accountId="acc_1" />);
    expect(screen.getByText('Loading…')).toBeTruthy();
    const region = await screen.findByRole('region', { name: 'Activity' });
    await within(region).findByText('Sent a payment');
    expect(eventsMock).toHaveBeenCalledWith('sess', 'acc_1', null);
    expect(within(region).getByText('Opened a page')).toBeTruthy();
    expect(within(region).getByText('brand_new_event')).toBeTruthy();
    expect(within(region).getByText('/wallet')).toBeTruthy();
    const values = Array.from(region.querySelectorAll('dl div')).map((row) => [
      row.querySelector('dt')?.textContent,
      row.querySelector('dd')?.textContent,
    ]);
    expect(values[0]?.[0]).toBe('Amount');
    expect(values[0]?.[1]).toMatch(/^₿2'100 · /);
    expect(values.slice(1)).toEqual([
      ['Reference', 'pay_1'],
      ['Count', '3'],
      ['Reference', '7'],
      ['Search text', 'bread'],
    ]);
    for (const raw of ['amountSats', 'paymentId', 'ok', 'none', 'countSats', 'feeSats', 'true']) {
      expect(within(region).queryByText(raw)).toBeNull();
    }
  });

  it('says when there is no activity', async () => {
    eventsMock.mockResolvedValue({ events: [], nextCursor: null });
    renderWithLocale(<TeamMemberEvents session="sess" accountId="acc_1" />);
    await screen.findByText('No activity yet.');
  });

  it('shows the error and tries again', async () => {
    eventsMock
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValueOnce({ events: [], nextCursor: null });
    renderWithLocale(<TeamMemberEvents session="sess" accountId="acc_1" />);
    await screen.findByText('Could not load the activity. Please try again.');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByText('No activity yet.');
  });

  it('keeps the list when the next page fails', async () => {
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    eventsMock
      .mockResolvedValueOnce({
        events: [{ name: 'login', at: AT, props: {} }],
        nextCursor: 'c1',
      })
      .mockRejectedValueOnce(new Error('down'));
    renderWithLocale(<TeamMemberEvents session="sess" accountId="acc_1" />);
    await screen.findByText('Logged in');
    act(() => {
      observers[observers.length - 1]?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });
    await screen.findByText('Could not load the activity. Please try again.');
    expect(screen.getByText('Logged in')).toBeTruthy();
    expect(eventsMock).toHaveBeenLastCalledWith('sess', 'acc_1', 'c1');
  });

  it('shows the forbidden sentence on 403', async () => {
    eventsMock.mockResolvedValue(null);
    renderWithLocale(<TeamMemberEvents session="sess" accountId="acc_1" />);
    await screen.findByText('This page is for moderators.');
  });
});
