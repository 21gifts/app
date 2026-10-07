import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getE2eNow } from '@/lib/config';
import { visualPin } from '@/lib/visual-pin';

vi.mock('@/lib/config', () => ({ getE2eNow: vi.fn() }));

beforeEach(() => {
  window.history.replaceState({}, '', '/wallet');
  vi.mocked(getE2eNow).mockReset().mockReturnValue(null);
});

describe('visualPin', () => {
  it('reads the visual parameter in a Playwright build', () => {
    vi.mocked(getE2eNow).mockReturnValue('2026-01-07T12:00:00.000Z');
    window.history.replaceState({}, '', '/wallet?visual=balance-ready');
    expect(visualPin()).toBe('balance-ready');
  });

  it('returns null without a visual parameter', () => {
    vi.mocked(getE2eNow).mockReturnValue('2026-01-07T12:00:00.000Z');
    expect(visualPin()).toBeNull();
  });

  it('ignores visual parameters in a production build', () => {
    window.history.replaceState({}, '', '/wallet?visual=balance-ready');
    expect(visualPin()).toBeNull();
  });
});
