import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from '@/components/AppShell';
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
  shopNpub: null,
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
    const { container } = renderWithLocale(<ShopsCountryFilter value={null} onChange={onChange} />);
    const trigger = screen.getByRole('combobox', { name: 'Country' });
    expect(container.contains(trigger)).toBe(true);
    expect(trigger.closest('[data-top-left-extra]')).toBeNull();
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

  it('renders the combobox into the AppShell top-left-extra host', async () => {
    useAuthStore.setState({ session: 'tok' });
    fetchPlacesMock.mockResolvedValue([PIN]);
    const { container } = renderWithLocale(
      <AppShell mode="fill">
        <ShopsCountryFilter value="PH" onChange={() => undefined} />
      </AppShell>,
    );
    const trigger = screen.getByRole('combobox', { name: 'Country' });
    await waitFor(() => {
      expect(trigger.textContent).toBe('Philippines (1)');
    });
    const host = container.querySelector('[data-top-left-extra]');
    const page = container.querySelector('[data-scroll-page]');
    expect(host?.contains(trigger)).toBe(true);
    expect(page?.contains(trigger)).toBe(false);
  });

  it('places the open AppShell chip listbox in a fixed body portal and remeasures it', async () => {
    useAuthStore.setState({ session: 'tok' });
    fetchPlacesMock.mockResolvedValue([PIN]);
    const viewportDescriptor = Object.getOwnPropertyDescriptor(window, 'visualViewport');
    const viewport = Object.assign(new EventTarget(), {
      offsetTop: 10,
      height: 700,
    }) as unknown as VisualViewport;
    const addViewportListener = vi.spyOn(viewport, 'addEventListener');
    const removeViewportListener = vi.spyOn(viewport, 'removeEventListener');
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: viewport,
    });
    let opensAbove = false;
    const rectSpy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function getBoundingClientRect(this: HTMLElement): DOMRect {
        if (this.hasAttribute('data-app-frame')) {
          return new DOMRect(100, 20, 800, 700);
        }
        return opensAbove ? new DOMRect(220, 650, 180, 44) : new DOMRect(220, 70, 180, 44);
      });
    try {
      renderWithLocale(
        <AppShell mode="fill">
          <ShopsCountryFilter value="PH" onChange={() => undefined} />
        </AppShell>,
      );
      const trigger = screen.getByRole('combobox', { name: 'Country' });
      await waitFor(() => {
        expect(trigger.textContent).toBe('Philippines (1)');
      });
      fireEvent.click(trigger);
      const listbox = screen.getByRole('listbox');
      const overlay = listbox.parentElement;
      expect(overlay?.parentElement).toBe(document.body);
      expect(overlay?.className).toContain('fixed');
      expect(overlay?.style.left).toBe('220px');
      expect(overlay?.style.width).toBe('320px');
      expect(overlay?.style.top).toBe('122px');
      expect(overlay?.style.maxHeight).toBe('');
      expect(addViewportListener).toHaveBeenCalledWith('resize', expect.any(Function));
      expect(addViewportListener).toHaveBeenCalledWith('scroll', expect.any(Function));

      fireEvent.resize(window);
      fireEvent.scroll(document);
      act(() => {
        viewport.dispatchEvent(new Event('resize'));
        viewport.dispatchEvent(new Event('scroll'));
      });
      fireEvent.keyDown(listbox, { key: 'ArrowDown' });
      expect(fireEvent.mouseDown(screen.getByRole('option', { name: 'All countries' }))).toBe(
        false,
      );
      expect(screen.getByRole('listbox')).toBeTruthy();

      opensAbove = true;
      fireEvent.scroll(document);
      await waitFor(() => {
        const lifted = screen.getByRole('listbox').parentElement;
        expect(lifted?.style.bottom).toBe('126px');
        expect(lifted?.style.top).toBe('36px');
      });

      fireEvent.click(trigger);
      expect(screen.queryByRole('listbox')).toBeNull();
      expect(removeViewportListener).toHaveBeenCalledWith('resize', expect.any(Function));
      expect(removeViewportListener).toHaveBeenCalledWith('scroll', expect.any(Function));
    } finally {
      rectSpy.mockRestore();
      if (viewportDescriptor === undefined) {
        delete (window as { visualViewport?: VisualViewport }).visualViewport;
      } else {
        Object.defineProperty(window, 'visualViewport', viewportDescriptor);
      }
    }
  });

  it('keeps the absolute AppShell fallback when the frame is too narrow', async () => {
    useAuthStore.setState({ session: 'tok' });
    fetchPlacesMock.mockResolvedValue([PIN]);
    const rectSpy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function getBoundingClientRect(this: HTMLElement): DOMRect {
        return this.hasAttribute('data-app-frame')
          ? new DOMRect(100, 20, 20, 20)
          : new DOMRect(110, 30, 10, 44);
      });
    try {
      renderWithLocale(
        <AppShell mode="fill">
          <ShopsCountryFilter value="PH" onChange={() => undefined} />
        </AppShell>,
      );
      const trigger = screen.getByRole('combobox', { name: 'Country' });
      await waitFor(() => {
        expect(trigger.textContent).toBe('Philippines (1)');
      });
      fireEvent.click(trigger);
      const listbox = screen.getByRole('listbox');
      expect(listbox.className).toContain('absolute');
      expect(listbox.className).toContain('w-80');
      expect(listbox.closest('.fixed')).toBeNull();
      expect(listbox.hasAttribute('style')).toBe(false);
    } finally {
      rectSpy.mockRestore();
    }
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
