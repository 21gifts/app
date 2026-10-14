import { useLayoutEffect } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AutoHeight,
  Collapse,
  EASE_MS,
  FOLD_MS,
  MOTION_SETTLE_EVENT,
  SWAP_FADE_MS,
  Swap,
} from '@/components/Motion';

let reducedMotion = false;
const originalMatchMedia = window.matchMedia;
const originalResizeObserver = globalThis.ResizeObserver;

/** Callbacks of every fake `ResizeObserver` made since the last reset, and their state. */
let observers: FakeResizeObserver[] = [];

class FakeResizeObserver {
  observed: Element[] = [];
  disconnected = false;

  constructor(readonly onResize: ResizeObserverCallback) {
    observers.push(this);
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

/** Height the fake layout reports for every element. */
let layoutHeight = 0;

beforeEach(() => {
  reducedMotion = false;
  observers = [];
  layoutHeight = 0;
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)' && reducedMotion,
      media: query,
    }),
  });
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'Date'],
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

/** Install the fake observer and a fake layout height. */
function fakeLayout(): void {
  globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    () => ({ height: layoutHeight }) as DOMRect,
  );
}

/** Fires the end of a CSS transition of `property` on `el`, as the browser does (it bubbles). */
function endTransition(el: Element, property: string): void {
  const event = new Event('transitionend', { bubbles: true });
  Object.defineProperty(event, 'propertyName', { value: property });
  act(() => {
    el.dispatchEvent(event);
  });
}

function fold(): HTMLElement {
  return document.querySelector('[data-collapse]') as HTMLElement;
}

function clip(): HTMLElement {
  return fold().firstElementChild as HTMLElement;
}

function advance(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe('Collapse', () => {
  it('shows content of the first render open, without a move or a clip', () => {
    render(
      <Collapse show className="pt-2">
        <p>Body</p>
      </Collapse>,
    );
    expect(screen.getByText('Body')).toBeTruthy();
    expect(fold().getAttribute('data-collapse')).toBe('open');
    expect(fold().className).toContain('grid-rows-[1fr] opacity-100');
    expect(fold().className).toContain('grid-cols-[minmax(0,1fr)]');
    expect(fold().hasAttribute('inert')).toBe(false);
    expect(clip().className).toBe('min-h-0');
    expect(screen.getByText('Body').parentElement?.className).toBe('flow-root pt-2');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('renders nothing while closed from the start', () => {
    const { container } = render(
      <Collapse show={false}>
        <p>Body</p>
      </Collapse>,
    );
    expect(container.innerHTML).toBe('');
  });

  it('mounts closed in the same commit, lays that out, then eases open and clips only while moving', () => {
    const laidOut: string[] = [];
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      laidOut.push(`${String(this.getAttribute('data-collapse'))} ${this.className}`);
      return 0;
    });
    const view = render(
      <Collapse show={false}>
        <p>Body</p>
      </Collapse>,
    );
    view.rerender(
      <Collapse show>
        <p>Body</p>
      </Collapse>,
    );
    // The closed box was laid out before it opened, so the browser eases the change.
    expect(laidOut).toHaveLength(1);
    expect(laidOut[0]).toContain('closed');
    expect(laidOut[0]).toContain('grid-rows-[0fr] opacity-0');
    expect(screen.getByText('Body')).toBeTruthy();
    expect(fold().getAttribute('data-collapse')).toBe('opening');
    expect(fold().className).toContain('grid-rows-[1fr] opacity-100');
    expect(clip().className).toBe('min-h-0 overflow-hidden');
    advance(FOLD_MS - 1);
    expect(fold().getAttribute('data-collapse')).toBe('opening');
    advance(1);
    expect(fold().getAttribute('data-collapse')).toBe('open');
    expect(clip().className).toBe('min-h-0');
  });

  it('settles when its own row transition ends, not on a transition of its content or of another property', () => {
    const view = render(
      <Collapse show={false}>
        <p>Body</p>
      </Collapse>,
    );
    view.rerender(
      <Collapse show>
        <p>Body</p>
      </Collapse>,
    );
    endTransition(screen.getByText('Body'), 'grid-template-rows');
    endTransition(fold(), 'opacity');
    expect(fold().getAttribute('data-collapse')).toBe('opening');
    endTransition(fold(), 'grid-template-rows');
    expect(fold().getAttribute('data-collapse')).toBe('open');
    expect(vi.getTimerCount()).toBe(0);
    view.rerender(
      <Collapse show={false}>
        <p>Body</p>
      </Collapse>,
    );
    expect(screen.getByText('Body')).toBeTruthy();
    endTransition(fold(), 'grid-template-rows');
    expect(screen.queryByText('Body')).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('announces that it has settled open before it reports itself open', () => {
    const seen: string[] = [];
    const onSettle = (event: Event): void => {
      seen.push(String((event.target as HTMLElement).getAttribute('data-collapse')));
    };
    document.addEventListener(MOTION_SETTLE_EVENT, onSettle);
    const view = render(
      <Collapse show={false}>
        <p>Body</p>
      </Collapse>,
    );
    view.rerender(
      <Collapse show>
        <p>Body</p>
      </Collapse>,
    );
    expect(seen).toEqual([]);
    advance(FOLD_MS);
    // The box was still `opening` when the event reached the document.
    expect(seen).toEqual(['opening']);
    expect(fold().getAttribute('data-collapse')).toBe('open');
    document.removeEventListener(MOTION_SETTLE_EVENT, onSettle);
  });

  it('shows the open end in the same commit with reduced motion', () => {
    reducedMotion = true;
    const commits: string[] = [];
    function Probe(): null {
      // Runs in the same layout phase as the parent's code that measures.
      useLayoutEffect(() => {
        commits.push(
          String(document.querySelector('[data-collapse]')?.getAttribute('data-collapse')),
        );
      });
      return null;
    }
    const view = render(
      <>
        <Collapse show={false}>
          <p>Body</p>
        </Collapse>
        <Probe />
      </>,
    );
    view.rerender(
      <>
        <Collapse show>
          <p>Body</p>
        </Collapse>
        <Probe />
      </>,
    );
    expect(commits[1]).toBe('open');
  });

  it('keeps the last content, inert, until it has folded away', () => {
    const view = render(
      <Collapse show>
        <p>Last error</p>
      </Collapse>,
    );
    view.rerender(<Collapse show={false}>{null}</Collapse>);
    expect(screen.getByText('Last error')).toBeTruthy();
    expect(fold().getAttribute('data-collapse')).toBe('closed');
    expect(fold().hasAttribute('inert')).toBe(true);
    expect(clip().className).toBe('min-h-0 overflow-hidden');
    advance(FOLD_MS - 1);
    expect(screen.getByText('Last error')).toBeTruthy();
    advance(1);
    expect(screen.queryByText('Last error')).toBeNull();
    expect(document.querySelector('[data-collapse]')).toBeNull();
  });

  it('opens again with the new content when shown while folding', () => {
    const view = render(
      <Collapse show>
        <p>First</p>
      </Collapse>,
    );
    view.rerender(
      <Collapse show={false}>
        <p>Gone</p>
      </Collapse>,
    );
    expect(screen.getByText('First')).toBeTruthy();
    advance(EASE_MS / 2);
    view.rerender(
      <Collapse show>
        <p>Second</p>
      </Collapse>,
    );
    expect(screen.getByText('Second')).toBeTruthy();
    advance(FOLD_MS);
    expect(screen.getByText('Second')).toBeTruthy();
    expect(fold().getAttribute('data-collapse')).toBe('open');
    expect(clip().className).toBe('min-h-0');
  });

  it('closes at once with instant, and drops a fold in progress when instant turns on', () => {
    const view = render(
      <Collapse show instant>
        <p>Body</p>
      </Collapse>,
    );
    view.rerender(
      <Collapse show={false} instant>
        <p>Body</p>
      </Collapse>,
    );
    expect(screen.queryByText('Body')).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    view.rerender(
      <Collapse show instant={false}>
        <p>Again</p>
      </Collapse>,
    );
    expect(fold().getAttribute('data-collapse')).toBe('opening');
    advance(FOLD_MS);
    view.rerender(
      <Collapse show={false} instant={false}>
        <p>Again</p>
      </Collapse>,
    );
    expect(screen.getByText('Again')).toBeTruthy();
    view.rerender(
      <Collapse show={false} instant>
        <p>Again</p>
      </Collapse>,
    );
    expect(screen.queryByText('Again')).toBeNull();
    // The dropped fold does not come back when instant turns off again.
    view.rerender(
      <Collapse show={false} instant={false}>
        <p>Again</p>
      </Collapse>,
    );
    expect(document.querySelector('[data-collapse]')).toBeNull();
  });

  it('drops its frames and timers when unmounted while opening', () => {
    const view = render(
      <Collapse show={false}>
        <p>Body</p>
      </Collapse>,
    );
    view.rerender(
      <Collapse show>
        <p>Body</p>
      </Collapse>,
    );
    advance(16);
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('opens and closes at once with reduced motion', () => {
    reducedMotion = true;
    const view = render(
      <Collapse show={false}>
        <p>Body</p>
      </Collapse>,
    );
    view.rerender(
      <Collapse show>
        <p>Body</p>
      </Collapse>,
    );
    expect(fold().getAttribute('data-collapse')).toBe('open');
    expect(clip().className).toBe('min-h-0');
    expect(vi.getTimerCount()).toBe(0);
    view.rerender(
      <Collapse show={false}>
        <p>Body</p>
      </Collapse>,
    );
    expect(screen.queryByText('Body')).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('moves with the timers when the browser has no matchMedia', () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: undefined,
    });
    const view = render(
      <Collapse show>
        <p>Body</p>
      </Collapse>,
    );
    view.rerender(
      <Collapse show={false}>
        <p>Body</p>
      </Collapse>,
    );
    expect(screen.getByText('Body')).toBeTruthy();
    advance(FOLD_MS);
    expect(screen.queryByText('Body')).toBeNull();
  });
});

describe('AutoHeight', () => {
  it('keeps its natural height without ResizeObserver', () => {
    Reflect.deleteProperty(globalThis, 'ResizeObserver');
    render(
      <AutoHeight>
        <p>Body</p>
      </AutoHeight>,
    );
    const inner = screen.getByText('Body').parentElement as HTMLElement;
    const box = inner.parentElement as HTMLElement;
    expect(inner.className).toBe('flow-root');
    expect(box.style.height).toBe('');
    expect(box.className).not.toContain('overflow-hidden');
  });

  it('writes the content height, glides to a new one while clipping, and stops clipping after the glide', () => {
    fakeLayout();
    layoutHeight = 40.5;
    const view = render(
      <AutoHeight className="gap-2">
        <p>Body</p>
      </AutoHeight>,
    );
    const inner = screen.getByText('Body').parentElement as HTMLElement;
    const box = inner.parentElement as HTMLElement;
    const observer = observers[0] as FakeResizeObserver;
    expect(observer.observed).toEqual([inner]);
    expect(inner.className).toBe('flow-root gap-2');
    expect(box.style.height).toBe('40.5px');
    expect(box.className).toContain('transition-[height] duration-280 ease-glide');
    expect(box.className).not.toContain('overflow-hidden');

    observer.fire();
    expect(box.className).not.toContain('overflow-hidden');

    layoutHeight = 90;
    observer.fire();
    expect(box.style.height).toBe('90px');
    expect(box.className).toContain('overflow-hidden');
    advance(EASE_MS);
    layoutHeight = 120;
    observer.fire();
    advance(FOLD_MS - 1);
    expect(box.className).toContain('overflow-hidden');
    advance(1);
    expect(box.className).not.toContain('overflow-hidden');

    view.unmount();
    expect(observer.disconnected).toBe(true);
    expect(box.style.height).toBe('');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('announces the end of its glide before it stops clipping', () => {
    fakeLayout();
    layoutHeight = 40;
    render(
      <AutoHeight>
        <p>Body</p>
      </AutoHeight>,
    );
    const box = screen.getByText('Body').parentElement?.parentElement as HTMLElement;
    const seen: boolean[] = [];
    const onSettle = (event: Event): void => {
      seen.push((event.target as HTMLElement).hasAttribute('data-gliding'));
    };
    document.addEventListener(MOTION_SETTLE_EVENT, onSettle);
    layoutHeight = 90;
    (observers[0] as FakeResizeObserver).fire();
    endTransition(box, 'height');
    expect(seen).toEqual([true]);
    expect(box.hasAttribute('data-gliding')).toBe(false);
    document.removeEventListener(MOTION_SETTLE_EVENT, onSettle);
  });

  it('stops clipping when its height transition ends', () => {
    fakeLayout();
    layoutHeight = 40;
    render(
      <AutoHeight>
        <p>Body</p>
      </AutoHeight>,
    );
    const box = screen.getByText('Body').parentElement?.parentElement as HTMLElement;
    layoutHeight = 90;
    (observers[0] as FakeResizeObserver).fire();
    expect(box.hasAttribute('data-gliding')).toBe(true);
    endTransition(box, 'height');
    expect(box.hasAttribute('data-gliding')).toBe(false);
    expect(box.className).not.toContain('overflow-hidden');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('follows a gliding box inside it at once instead of gliding behind it', () => {
    fakeLayout();
    layoutHeight = 40;
    render(
      <AutoHeight className="outer">
        <AutoHeight className="inner">
          <p>Body</p>
        </AutoHeight>
      </AutoHeight>,
    );
    const innerBox = screen.getByText('Body').parentElement?.parentElement as HTMLElement;
    const outerBox = innerBox.parentElement?.parentElement as HTMLElement;
    expect(outerBox.className).toContain('data-[follow]:transition-none');
    // Effects run inside out, so the inner observer is the first one, as in the browser.
    const [innerObserver, outerObserver] = observers as [FakeResizeObserver, FakeResizeObserver];
    layoutHeight = 90;
    innerObserver.fire();
    expect(innerBox.hasAttribute('data-gliding')).toBe(true);
    expect(innerBox.hasAttribute('data-follow')).toBe(false);
    outerObserver.fire();
    expect(outerBox.hasAttribute('data-follow')).toBe(true);
    expect(outerBox.hasAttribute('data-gliding')).toBe(false);
    expect(outerBox.className).not.toContain('overflow-hidden');
    expect(outerBox.style.height).toBe('90px');
    advance(FOLD_MS);
    expect(innerBox.hasAttribute('data-gliding')).toBe(false);
    layoutHeight = 120;
    outerObserver.fire();
    expect(outerBox.hasAttribute('data-follow')).toBe(false);
    expect(outerBox.hasAttribute('data-gliding')).toBe(true);
    expect(outerBox.className).toContain('overflow-hidden');
  });

  it('follows the height without clipping or waiting with reduced motion', () => {
    reducedMotion = true;
    fakeLayout();
    layoutHeight = 40;
    render(
      <AutoHeight>
        <p>Body</p>
      </AutoHeight>,
    );
    const box = screen.getByText('Body').parentElement?.parentElement as HTMLElement;
    layoutHeight = 90;
    (observers[0] as FakeResizeObserver).fire();
    expect(box.style.height).toBe('90px');
    expect(box.className).not.toContain('overflow-hidden');
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('Swap', () => {
  function view(): HTMLElement {
    return document.querySelector('[data-swap]') as HTMLElement;
  }

  it('renders changes inside the same view right away', () => {
    const swap = render(
      <Swap viewKey="form" className="flex flex-col gap-3">
        <p>One</p>
      </Swap>,
    );
    expect(view().className).toContain('opacity-100');
    expect(view().className).toContain('flex flex-col gap-3');
    swap.rerender(
      <Swap viewKey="form" className="flex flex-col gap-3">
        <p>Two</p>
      </Swap>,
    );
    expect(screen.getByText('Two')).toBeTruthy();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('fades the old view out in place, then shows the new view', () => {
    const swap = render(
      <Swap viewKey="form">
        <p>Form</p>
      </Swap>,
    );
    expect(view().className).toBe(
      'transition-opacity duration-180 ease-glide motion-reduce:transition-none opacity-100',
    );
    swap.rerender(
      <Swap viewKey="pay">
        <p>Pay</p>
      </Swap>,
    );
    expect(screen.getByText('Form')).toBeTruthy();
    expect(screen.queryByText('Pay')).toBeNull();
    expect(view().className).toContain('opacity-0');
    expect(view().hasAttribute('inert')).toBe(true);
    expect(view().getAttribute('data-swap')).toBe('form');
    advance(SWAP_FADE_MS - 1);
    expect(screen.getByText('Form')).toBeTruthy();
    advance(1);
    expect(screen.queryByText('Form')).toBeNull();
    expect(screen.getByText('Pay')).toBeTruthy();
    expect(view().className).toContain('opacity-100');
    expect(view().hasAttribute('inert')).toBe(false);
    expect(view().getAttribute('data-swap')).toBe('pay');
  });

  it('swaps as soon as the fade out ends', () => {
    const swap = render(
      <Swap viewKey="form">
        <p>Form</p>
      </Swap>,
    );
    swap.rerender(
      <Swap viewKey="pay">
        <p>Pay</p>
      </Swap>,
    );
    endTransition(view(), 'opacity');
    expect(screen.getByText('Pay')).toBeTruthy();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('shows the current view again when its key comes back during the fade', () => {
    const swap = render(
      <Swap viewKey="form">
        <p>Form</p>
      </Swap>,
    );
    swap.rerender(
      <Swap viewKey="pay">
        <p>Pay</p>
      </Swap>,
    );
    advance(SWAP_FADE_MS / 2);
    swap.rerender(
      <Swap viewKey="form">
        <p>Form again</p>
      </Swap>,
    );
    expect(screen.getByText('Form again')).toBeTruthy();
    expect(view().className).toContain('opacity-100');
    expect(view().hasAttribute('inert')).toBe(false);
    advance(SWAP_FADE_MS);
    expect(screen.getByText('Form again')).toBeTruthy();
    expect(screen.queryByText('Pay')).toBeNull();
  });

  it('lands on the last key when the key changes twice during the fade', () => {
    const swap = render(
      <Swap viewKey="a">
        <p>A</p>
      </Swap>,
    );
    swap.rerender(
      <Swap viewKey="b">
        <p>B</p>
      </Swap>,
    );
    advance(SWAP_FADE_MS / 2);
    swap.rerender(
      <Swap viewKey="c">
        <p>C</p>
      </Swap>,
    );
    expect(screen.getByText('A')).toBeTruthy();
    advance(SWAP_FADE_MS);
    expect(screen.getByText('C')).toBeTruthy();
    expect(screen.queryByText('B')).toBeNull();
  });

  it('shows the new view at once with reduced motion', () => {
    reducedMotion = true;
    const swap = render(
      <Swap viewKey="form">
        <p>Form</p>
      </Swap>,
    );
    swap.rerender(
      <Swap viewKey="pay">
        <p>Pay</p>
      </Swap>,
    );
    expect(screen.getByText('Pay')).toBeTruthy();
    expect(screen.queryByText('Form')).toBeNull();
    expect(view().className).toContain('opacity-100');
    expect(view().hasAttribute('inert')).toBe(false);
    expect(view().getAttribute('data-swap')).toBe('pay');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('drops its timer when unmounted during the fade', () => {
    const swap = render(
      <Swap viewKey="form">
        <p>Form</p>
      </Swap>,
    );
    swap.rerender(
      <Swap viewKey="pay">
        <p>Pay</p>
      </Swap>,
    );
    swap.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
