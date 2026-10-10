import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShopsCountryFilter } from '@/components/ShopsCountryFilter';
import { renderWithLocale } from '@/__tests__/render-with-locale';
import type { ForumPlaceRow } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';

vi.mock('@/lib/api', () => ({
  fetchPlaces: vi.fn(),
}));

import { fetchPlaces } from '@/lib/api';

const fetchPlacesMock = vi.mocked(fetchPlaces);

const PIN: ForumPlaceRow = {
  id: 'p1',
  name: 'Ada',
  createdAt: '2026-10-01T00:00:00.000Z',
  lat: 14.6,
  lng: 120.98,
  label: null,
  shop: true,
  countryCode: 'PH',
};

afterEach(() => {
  cleanup();
  fetchPlacesMock.mockReset();
  useAuthStore.setState({ session: null, account: null });
});

describe('ShopsCountryFilter', () => {
  it('renders nothing without a session', () => {
    const { container } = renderWithLocale(
      <ShopsCountryFilter value={null} onChange={() => undefined} />,
    );
    expect(container.textContent).toBe('');
    expect(fetchPlacesMock).not.toHaveBeenCalled();
  });

  it('lists All countries and each country with shops, by name, with the shop count', async () => {
    useAuthStore.setState({ session: 'tok' });
    fetchPlacesMock.mockResolvedValue([
      PIN,
      { ...PIN, id: 'p2' },
      { ...PIN, id: 'k1', countryCode: 'KE' },
    ]);
    const onChange = vi.fn();
    renderWithLocale(<ShopsCountryFilter value={null} onChange={onChange} />);
    const trigger = screen.getByRole('combobox', { name: 'Country' });
    expect(trigger.textContent).toBe('All countries');
    fireEvent.click(trigger);
    await waitFor(() => {
      expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
        'All countries',
        'Kenya (1)',
        'Philippines (2)',
      ]);
    });
    expect(fetchPlacesMock).toHaveBeenCalledWith('tok');
    fireEvent.click(screen.getByRole('option', { name: 'Philippines (2)' }));
    expect(onChange).toHaveBeenLastCalledWith('PH');
  });

  it('chooses All countries as null and names countries in the UI language', async () => {
    useAuthStore.setState({ session: 'tok' });
    fetchPlacesMock.mockResolvedValue([PIN]);
    const onChange = vi.fn();
    renderWithLocale(<ShopsCountryFilter value="PH" onChange={onChange} />, 'de');
    const trigger = screen.getByRole('combobox', { name: 'Land' });
    await waitFor(() => {
      expect(trigger.textContent).toBe('Philippinen (1)');
    });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('option', { name: 'Alle Länder' }));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('keeps the chosen country without a count while the pins load or fail', async () => {
    useAuthStore.setState({ session: 'tok' });
    fetchPlacesMock.mockRejectedValue(new Error('Could not load the map.'));
    renderWithLocale(<ShopsCountryFilter value="KE" onChange={() => undefined} />);
    const trigger = screen.getByRole('combobox', { name: 'Country' });
    expect(trigger.textContent).toBe('Kenya');
    await waitFor(() => {
      expect(fetchPlacesMock).toHaveBeenCalled();
    });
    expect(trigger.textContent).toBe('Kenya');
  });

  it('ignores pins that arrive after unmount', async () => {
    useAuthStore.setState({ session: 'tok' });
    let resolve: (rows: ForumPlaceRow[]) => void = () => undefined;
    fetchPlacesMock.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const view = renderWithLocale(<ShopsCountryFilter value={null} onChange={() => undefined} />);
    view.unmount();
    resolve([PIN]);
    await Promise.resolve();
    expect(fetchPlacesMock).toHaveBeenCalledOnce();
  });
});
