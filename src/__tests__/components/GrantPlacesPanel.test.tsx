import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GrantPlacesPanel } from '@/components/GrantPlacesPanel';
import type { GrantPlaces } from '@/lib/api-types';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/lib/api', () => ({
  fetchGrantPlaces: vi.fn(),
}));

import { fetchGrantPlaces } from '@/lib/api';

const fetchMock = vi.mocked(fetchGrantPlaces);

const OPEN: GrantPlaces = {
  round: 1,
  startsAt: '2026-10-16T00:00:00.000Z',
  places: 10,
  admitted: 3,
  placesLeft: 7,
  nextGoalShops: 20,
};

beforeEach(() => {
  fetchMock.mockReset();
});

afterEach(cleanup);

describe('GrantPlacesPanel', () => {
  it('shows free places, admissions, open applications, and the next goal', async () => {
    fetchMock.mockResolvedValue(OPEN);
    renderWithLocale(<GrantPlacesPanel />);
    expect(screen.getByRole('group', { name: 'Grant places' })).toBeTruthy();
    expect(screen.getByText('Loading…')).toBeTruthy();
    expect(await screen.findByText('Round 1: 7 of 10 places are free.')).toBeTruthy();
    expect(screen.getByText('Moderators have admitted 3 people in this round.')).toBeTruthy();
    expect(
      screen.getByText(
        'Applications are open to every verified member. Moderators admit up to 10 people in this round.',
      ),
    ).toBeTruthy();
    expect(
      screen.getByText('When 20 shops are active, the grant program opens for more people.'),
    ).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith();
  });

  it('uses the singular for one free place and one admission', async () => {
    fetchMock.mockResolvedValue({ ...OPEN, admitted: 1, placesLeft: 1, places: 2 });
    renderWithLocale(<GrantPlacesPanel />);
    expect(await screen.findByText('Round 1: 1 of 2 places is free.')).toBeTruthy();
    expect(screen.getByText('Moderators have admitted 1 person in this round.')).toBeTruthy();
  });

  it('says the round is full and applications stay open when no place is left', async () => {
    fetchMock.mockResolvedValue({ ...OPEN, admitted: 10, placesLeft: 0 });
    renderWithLocale(<GrantPlacesPanel />);
    expect(await screen.findByText('Round 1: 0 of 10 places are free.')).toBeTruthy();
    expect(
      screen.getByText('All 10 places of this round are taken. Applications stay open.'),
    ).toBeTruthy();
  });

  it('shows an error and retries', async () => {
    fetchMock.mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce(OPEN);
    renderWithLocale(<GrantPlacesPanel />);
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Could not load the grant places. Please try again.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(screen.getByText('Round 1: 7 of 10 places are free.')).toBeTruthy();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('ignores a late success or failure after unmount', async () => {
    let resolve: ((value: GrantPlaces) => void) | undefined;
    let reject: ((reason: unknown) => void) | undefined;
    fetchMock
      .mockImplementationOnce(
        () =>
          new Promise<GrantPlaces>((done) => {
            resolve = done;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<GrantPlaces>((_done, fail) => {
            reject = fail;
          }),
      );
    renderWithLocale(<GrantPlacesPanel />).unmount();
    renderWithLocale(<GrantPlacesPanel />).unmount();
    await act(async () => {
      resolve?.(OPEN);
      reject?.(new Error('late'));
      await Promise.resolve();
    });
    expect(screen.queryByRole('group', { name: 'Grant places' })).toBeNull();
  });
});
