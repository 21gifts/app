import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ReplyHeartSenders } from '@/components/ReplyHeartSenders';
import type { HeartSender } from '@/lib/api-types';
import type { FiatRateDay } from '@/lib/stats-money';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const RATE: FiatRateDay = {
  sats: 100_000_000,
  usd: '100000.00',
  chf: '80000.00',
  eur: '90000.00',
  php: '5600000.00',
};

const hearts: HeartSender[] = [
  {
    accountId: 'acc_grace',
    name: 'Grace',
    username: 'grace',
    role: 'moderator',
    sats: 21,
    createdAt: '2026-08-28T12:02:00.000Z',
    amountUsd: '5.00',
    amountChf: null,
    amountEur: null,
    amountPhp: null,
  },
  {
    accountId: 'acc_deleted',
    name: '',
    sats: 1000,
    createdAt: '2026-08-28T12:01:00.000Z',
    amountUsd: null,
    amountChf: null,
    amountEur: null,
    amountPhp: null,
  },
];

afterEach(() => {
  cleanup();
});

describe('ReplyHeartSenders', () => {
  it('renders the heading count and the rows newest first with exact sats and times', () => {
    renderWithLocale(<ReplyHeartSenders hearts={hearts} rateDay={RATE} fiat="USD" />);
    expect(screen.getByRole('heading', { name: 'Hearts (2)' })).toBeTruthy();
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain('Grace');
    expect(rows[0]?.textContent).toContain('₿21');
    expect(rows[0]?.textContent).toContain('$5.00');
    expect(rows[0]?.querySelector('time')?.getAttribute('dateTime')).toBe(hearts[0]?.createdAt);
    expect(rows[1]?.textContent).toContain('Deleted account');
    expect(rows[1]?.textContent).toContain("₿1'000");
    expect(screen.getByRole('link', { name: 'Grace' }).getAttribute('href')).toBe(
      '/members/acc_grace',
    );
    expect(screen.queryByRole('link', { name: 'Deleted account' })).toBeNull();
  });

  it('shows the frozen string for the viewer fiat before the spot', () => {
    renderWithLocale(
      <ReplyHeartSenders hearts={hearts} rateDay={RATE} fiat="CHF" />,
      'de',
      'ch',
      'CHF',
    );
    const rows = screen.getAllByRole('listitem');
    expect(rows[0]?.textContent).toContain('CHF 0.02');
  });

  it('falls back to the current spot when the frozen string is null', () => {
    renderWithLocale(<ReplyHeartSenders hearts={hearts} rateDay={RATE} fiat="USD" />);
    const rows = screen.getAllByRole('listitem');
    expect(rows[1]?.textContent).toContain('$1.00');
  });

  it('shows the role pill and its hint', () => {
    renderWithLocale(<ReplyHeartSenders hearts={hearts} rateDay={null} fiat="USD" />);
    const role = screen.getByRole('button', { name: 'Moderator' });
    fireEvent.click(role);
    expect(role.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('status').textContent).toBe(
      'This person helps keep the living room in order.',
    );
  });

  it('keeps a missing role open state silent after another row was opened', () => {
    renderWithLocale(<ReplyHeartSenders hearts={hearts} rateDay={null} fiat="USD" />);
    fireEvent.click(screen.getByRole('button', { name: 'Moderator' }));
    fireEvent.click(screen.getByRole('button', { name: 'Moderator' }));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('skips the role pill when a sender has no live role', () => {
    renderWithLocale(
      <ReplyHeartSenders
        hearts={[{ ...hearts[0]!, role: undefined, amountUsd: null }]}
        rateDay={RATE}
        fiat="USD"
      />,
    );
    expect(screen.getByRole('link', { name: 'Grace' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Moderator' })).toBeNull();
    expect(screen.getAllByRole('listitem')[0]?.textContent).toContain('$0.02');
  });

  it('shows bitcoin alone when there is no frozen string and no spot rate', () => {
    renderWithLocale(<ReplyHeartSenders hearts={hearts} rateDay={null} fiat="EUR" />);
    expect(screen.getAllByRole('listitem')[0]?.textContent).toBe(
      'GraceModerator₿21Aug 28, 2026, 2:02 PM',
    );
  });

  it('renders nothing when there are no hearts', () => {
    const { container } = renderWithLocale(
      <ReplyHeartSenders hearts={[]} rateDay={RATE} fiat="USD" />,
    );
    expect(container.innerHTML).toBe('');
  });
});
