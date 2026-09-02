import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppHeightSync } from '@/components/AppHeightSync';

const { useAppHeightMock } = vi.hoisted(() => ({
  useAppHeightMock: vi.fn(),
}));

vi.mock('@/lib/app-height', () => ({
  useAppHeight: (): void => {
    useAppHeightMock();
  },
}));

afterEach(() => {
  cleanup();
  useAppHeightMock.mockClear();
});

describe('AppHeightSync', () => {
  it('calls useAppHeight and renders nothing', () => {
    const { container } = render(<AppHeightSync />);
    expect(useAppHeightMock).toHaveBeenCalledTimes(1);
    expect(container.firstChild).toBeNull();
  });
});
