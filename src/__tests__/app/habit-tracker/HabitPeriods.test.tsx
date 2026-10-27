import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HabitPeriods } from '@/app/habit-tracker/HabitPeriods';
import { renderWithLocale } from '@/__tests__/render-with-locale';
import type { MemberHabitList } from '@/lib/member-habits';

function habit(count: number): MemberHabitList['habits'][number] {
  return {
    id: 'h1',
    accountId: 'owner',
    ownerName: 'Ada',
    role: 'basis',
    name: 'Walk',
    description: '',
    cadence: 'daily',
    timeZone: 'Asia/Manila',
    firstPeriod: '2026-10-01',
    lastPeriod: null,
    comments: [],
    periods: Array.from({ length: count }, (_, i) => ({
      period: `2026-10-${String(i + 1).padStart(2, '0')}`,
      name: 'Walk',
      description: '',
      logged: i !== 0,
      status: i === 0 ? null : 'achieved',
    })),
  };
}
const onLog = vi.fn(async () => {});
const onRetry = vi.fn();
let closedWhileMounted = false;
beforeEach(() => {
  vi.clearAllMocks();
  closedWhileMounted = false;
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    closedWhileMounted = this.isConnected;
    this.removeAttribute('open');
  };
});
afterEach(cleanup);
describe('HabitPeriods', () => {
  it.each([0, 10])('shows %i rows without a history control', (count) => {
    renderWithLocale(
      <HabitPeriods
        habit={habit(count)}
        owns={false}
        review={false}
        onLog={onLog}
        error={false}
        onRetry={onRetry}
      />,
    );
    expect(screen.queryAllByRole('listitem')).toHaveLength(count);
    expect(screen.queryByRole('button', { name: 'All ratings' })).toBeNull();
  });
  it('limits the preview to ten latest ratings and keeps all older ones reachable and editable', () => {
    renderWithLocale(
      <HabitPeriods
        habit={habit(12)}
        owns
        review={false}
        onLog={onLog}
        error={false}
        onRetry={onRetry}
      />,
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(10);
    expect(screen.queryByText('2026-10-01')).toBeNull();
    expect(screen.getAllByRole('listitem')[0]?.textContent).toContain('2026-10-12');
    fireEvent.click(screen.getByRole('button', { name: 'All ratings' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getAllByRole('listitem')).toHaveLength(12);
    const row = within(dialog).getByText('2026-10-01').closest('li') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: 'Achieved' }));
    expect(onLog).toHaveBeenCalledWith('h1', '2026-10-01', 'achieved');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close rating history' }));
    expect(closedWhileMounted).toBe(true);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getAllByRole('listitem')).toHaveLength(10);
  });
  it('opens older pending entries for catch-up, shows failures in the dialog, and allows Escape', () => {
    renderWithLocale(
      <HabitPeriods habit={habit(11)} owns review onLog={onLog} error onRetry={onRetry} />,
    );
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('alert')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
    fireEvent(dialog, new Event('cancel'));
    expect(closedWhileMounted).toBe(true);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('shows public and archived ratings as read-only', () => {
    const data = habit(4);
    data.periods[1]!.status = 'partial';
    data.periods[2]!.status = 'missed';
    renderWithLocale(
      <HabitPeriods
        habit={data}
        owns={false}
        review
        onLog={onLog}
        error={false}
        onRetry={onRetry}
      />,
    );
    expect(screen.getByText('Partially achieved')).toBeTruthy();
    expect(screen.getByText('Not achieved')).toBeTruthy();
    expect(screen.getByText('Not rated yet')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
