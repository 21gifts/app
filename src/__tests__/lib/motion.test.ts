import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MOTION_EASE_MS,
  MOTION_FOLD_MS,
  MOTION_SETTLE_EVENT,
  afterTransition,
  announceSettle,
  prefersReducedMotion,
} from '@/lib/motion';

const originalMatchMedia = window.matchMedia;

function setMatchMedia(value: unknown): void {
  Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value });
}

function transitionEnd(property: string): Event {
  const event = new Event('transitionend', { bubbles: true });
  Object.defineProperty(event, 'propertyName', { value: property });
  return event;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});

afterEach(() => {
  vi.useRealTimers();
  setMatchMedia(originalMatchMedia);
});

describe('motion', () => {
  it('settles a move after the ease and a short slack', () => {
    expect(MOTION_FOLD_MS).toBeGreaterThan(MOTION_EASE_MS);
  });

  it('announces a settle that bubbles', () => {
    const parent = document.createElement('div');
    const box = document.createElement('div');
    parent.append(box);
    const onSettle = vi.fn();
    parent.addEventListener(MOTION_SETTLE_EVENT, onSettle);
    announceSettle(box);
    expect(onSettle).toHaveBeenCalledTimes(1);
    expect((onSettle.mock.calls[0]?.[0] as Event).target).toBe(box);
  });

  it('settles on its own transition end once, not on one of its content or another property', () => {
    const box = document.createElement('div');
    const child = document.createElement('div');
    box.append(child);
    const done = vi.fn();
    afterTransition(box, 'height', MOTION_FOLD_MS, done);
    child.dispatchEvent(transitionEnd('height'));
    box.dispatchEvent(transitionEnd('opacity'));
    expect(done).not.toHaveBeenCalled();
    box.dispatchEvent(transitionEnd('height'));
    expect(done).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(MOTION_FOLD_MS);
    box.dispatchEvent(transitionEnd('height'));
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('settles on the fallback timer when no transition ends, and not again after', () => {
    const box = document.createElement('div');
    const done = vi.fn();
    afterTransition(box, 'height', MOTION_FOLD_MS, done);
    vi.advanceTimersByTime(MOTION_FOLD_MS - 1);
    expect(done).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(done).toHaveBeenCalledTimes(1);
    box.dispatchEvent(transitionEnd('height'));
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('never settles once stopped', () => {
    const box = document.createElement('div');
    const done = vi.fn();
    const stop = afterTransition(box, 'height', MOTION_FOLD_MS, done);
    stop();
    box.dispatchEvent(transitionEnd('height'));
    vi.advanceTimersByTime(MOTION_FOLD_MS);
    expect(done).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('reads prefers-reduced-motion, and is false without matchMedia', () => {
    setMatchMedia((query: string) => ({ matches: query === '(prefers-reduced-motion: reduce)' }));
    expect(prefersReducedMotion()).toBe(true);
    setMatchMedia(() => ({ matches: false }));
    expect(prefersReducedMotion()).toBe(false);
    setMatchMedia(undefined);
    expect(prefersReducedMotion()).toBe(false);
  });
});
