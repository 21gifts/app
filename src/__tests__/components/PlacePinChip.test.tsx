import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlacePinChip } from '@/components/PlacePinChip';
import { renderWithLocale } from '@/__tests__/render-with-locale';

afterEach(() => {
  cleanup();
  delete document.documentElement.dataset['localSunday'];
});

describe('PlacePinChip', () => {
  it('renders a labeled place in normal flow', () => {
    renderWithLocale(
      <PlacePinChip
        place={{ lat: 14.6, lng: 120.98, label: 'Happyland' }}
        onRemove={() => undefined}
      />,
    );
    const chip = screen.getByText('Happyland').parentElement;
    expect(chip?.className).toContain('flex w-full max-w-sm');
    expect(chip?.className).not.toContain('absolute');
    expect(screen.queryByText('Remove place')).toBeNull();
  });

  it('formats unnamed places as coordinates and removes the pin', () => {
    const onRemove = vi.fn();
    renderWithLocale(<PlacePinChip place={{ lat: 1, lng: 2, label: null }} onRemove={onRemove} />);
    expect(screen.getByText('1.00000, 2.00000')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Remove place' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('disables removal while the composer is posting', () => {
    renderWithLocale(
      <PlacePinChip
        place={{ lat: 14.6, lng: 120.98, label: 'Happyland' }}
        disabled
        onRemove={() => undefined}
      />,
    );
    expect(screen.getByRole('button', { name: 'Remove place' }).hasAttribute('disabled')).toBe(
      true,
    );
  });

  it('replaces the chip with the writing pause on the local Sunday', () => {
    document.documentElement.dataset['localSunday'] = '1';
    renderWithLocale(
      <PlacePinChip
        place={{ lat: 14.6, lng: 120.98, label: 'Happyland' }}
        onRemove={() => undefined}
      />,
    );
    expect(screen.queryByText('Happyland')).toBeNull();
    expect(screen.getByText('Writing is paused on Sunday.')).toBeTruthy();
  });
});
