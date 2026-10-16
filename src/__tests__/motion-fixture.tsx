import { act } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

/** Test state shared by the motion component tests; reset before each test. */
export const motionEnv: {
  /** Whether the fake `matchMedia` reports `prefers-reduced-motion: reduce`. */
  reducedMotion: boolean;
  /** Height the fake layout reports for every element. */
  layoutHeight: number;
  /** Every fake `ResizeObserver` made since the last reset. */
  observers: FakeResizeObserver[];
} = { reducedMotion: false, layoutHeight: 0, observers: [] };

/** `ResizeObserver` stand-in that reports once on `observe` and on {@link FakeResizeObserver.fire}. */
export class FakeResizeObserver {
  observed: Element[] = [];
  disconnected = false;

  constructor(readonly onResize: ResizeObserverCallback) {
    motionEnv.observers.push(this);
  }

  observe(target: Element): void {
    this.observed.push(target);
    this.onResize([], this as unknown as ResizeObserver);
  }

  disconnect(): void {
    this.disconnected = true;
  }

  unobserve(): void {}

  /** Report a size change, as the browser does after layout. */
  fire(): void {
    act(() => {
      this.onResize([], this as unknown as ResizeObserver);
    });
  }
}

/**
 * Registers the hooks of a motion test file: a fake `matchMedia` that reads
 * {@link motionEnv}, fake timers, and the real globals back after each test.
 */
export function installMotionHooks(): void {
  const originalMatchMedia = window.matchMedia;
  const originalResizeObserver = globalThis.ResizeObserver;
  beforeEach(() => {
    motionEnv.reducedMotion = false;
    motionEnv.observers = [];
    motionEnv.layoutHeight = 0;
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: (query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)' && motionEnv.reducedMotion,
        media: query,
      }),
    });
    vi.useFakeTimers({
      toFake: [
        'setTimeout',
        'clearTimeout',
        'requestAnimationFrame',
        'cancelAnimationFrame',
        'Date',
      ],
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: originalMatchMedia,
    });
    globalThis.ResizeObserver = originalResizeObserver;
    vi.restoreAllMocks();
  });
}

/** Installs the fake observer and a fake layout height ({@link motionEnv}). */
export function fakeLayout(): void {
  globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    () => ({ height: motionEnv.layoutHeight }) as DOMRect,
  );
}

/**
 * Fires the end of a CSS transition of `property` on `el`, as the browser does (it bubbles).
 *
 * @param el - Element whose transition ends.
 * @param property - Transitioned property.
 */
export function endTransition(el: Element, property: string): void {
  const event = new Event('transitionend', { bubbles: true });
  Object.defineProperty(event, 'propertyName', { value: property });
  act(() => {
    el.dispatchEvent(event);
  });
}

/**
 * Advances the fake timers inside `act`.
 *
 * @param ms - Time to advance, in ms.
 */
export function advance(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}
