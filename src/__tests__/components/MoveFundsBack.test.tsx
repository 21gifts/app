import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MoveFundsBack } from '@/components/MoveFundsBack';
import { useChromeBack, type ChromeBackOverride } from '@/components/ViewHistoryRoot';

vi.mock('@/components/ViewHistoryRoot', () => ({ useChromeBack: vi.fn() }));

let override: ChromeBackOverride | null = null;
const setOverride = vi.fn((next: ChromeBackOverride | null) => {
  override = next;
});

beforeEach(() => {
  override = null;
  setOverride.mockClear();
  vi.mocked(useChromeBack).mockReturnValue({ override: null, stepBack: null, setOverride });
});

afterEach(() => {
  cleanup();
});

describe('MoveFundsBack', () => {
  it('registers the arrow over the page as nav.back, renders nothing, and removes it on unmount', () => {
    const onBack = vi.fn();
    const { container, unmount } = render(<MoveFundsBack onBack={onBack} />);
    expect(container.firstChild).toBeNull();
    expect(override).toMatchObject({ labelKey: 'nav.back', over: true });
    override?.onClick();
    expect(onBack).toHaveBeenCalledTimes(1);
    unmount();
    expect(override).toBeNull();
  });

  it('calls the latest step back without registering again', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<MoveFundsBack onBack={first} />);
    rerender(<MoveFundsBack onBack={second} />);
    expect(setOverride).toHaveBeenCalledTimes(1);
    override?.onClick();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
