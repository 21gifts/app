import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithLocale } from '@/__tests__/render-with-locale';
import { NpubCopyButton } from '@/components/NpubCopyButton';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('NpubCopyButton', () => {
  it('copies the npub and restores the Copy label after the success flash', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    renderWithLocale(<NpubCopyButton npub="npub1example" />);
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(writeText).toHaveBeenCalledWith('npub1example');
    expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy();
    await act(async () => {
      vi.advanceTimersByTime(1200);
    });
    expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
  });
});
