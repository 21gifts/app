import { render, screen, act, cleanup } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { SundayRestGate } from '@/components/SundayRestGate';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
describe('SundayRestGate', () => {
  const props = {
    title: 'Christus ist auferstanden!',
    message: 'Besucht ihn in der heiligen Messe.',
    schedule: 'Manila',
  };
  it('does not mount application children on Sunday', () => {
    const child = vi.fn(() => <button>Work</button>);
    const Child = child;
    render(
      <SundayRestGate {...props} serverNow={Date.parse('2026-09-27T00:00:00Z')}>
        <Child />
      </SundayRestGate>,
    );
    expect(screen.getByRole('heading').textContent).toBe(props.title);
    expect(child).not.toHaveBeenCalled();
  });
  it('unmounts an open application at the Sunday boundary using the server clock', () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'performance'] });
    render(
      <SundayRestGate {...props} serverNow={Date.parse('2026-09-26T15:59:59Z')}>
        <button>Work</button>
      </SundayRestGate>,
    );
    expect(screen.getByRole('button')).toBeTruthy();
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByRole('heading')).toBeTruthy();
    act(() => vi.advanceTimersByTime(86400000));
    expect(screen.getByRole('button')).toBeTruthy();
  });
});
