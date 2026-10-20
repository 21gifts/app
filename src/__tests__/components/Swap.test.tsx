import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Swap } from '@/components/Swap';
import { MOTION_SWAP_FADE_MS } from '@/lib/motion';
import { advance, endTransition, motionEnv, installMotionHooks } from '@/__tests__/motion-fixture';

/** How the box looked each time {@link Swap} started waiting for its fade-out to end. */
const waitsStarted = vi.hoisted((): string[] => []);
/** Elements whose computed style was read, in order. */
const styleReads = vi.hoisted((): Element[] => []);

vi.mock('@/lib/motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/motion')>();
  return {
    ...actual,
    afterTransition: (...args: Parameters<typeof actual.afterTransition>): (() => void) => {
      const [el] = args;
      waitsStarted.push(
        `${el.className}${el.hasAttribute('inert') ? ' inert' : ''}${styleReads.includes(el) ? ' style-read' : ''}`,
      );
      return actual.afterTransition(...args);
    },
  };
});

installMotionHooks();

beforeEach(() => {
  waitsStarted.length = 0;
  styleReads.length = 0;
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
    advance(MOTION_SWAP_FADE_MS - 1);
    expect(screen.getByText('Form')).toBeTruthy();
    advance(1);
    expect(screen.queryByText('Form')).toBeNull();
    expect(screen.getByText('Pay')).toBeTruthy();
    expect(view().className).toContain('opacity-100');
    expect(view().hasAttribute('inert')).toBe(false);
    expect(view().getAttribute('data-swap')).toBe('pay');
  });

  it('starts waiting for the fade-out only once the old view is drawn faded and inert', () => {
    const readStyle = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((el, pseudo) => {
      styleReads.push(el);
      return readStyle(el, pseudo);
    });
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
    // A wait that began before the box turned opacity-0 would also end on a fade-in still running.
    expect(waitsStarted).toHaveLength(1);
    expect(waitsStarted[0]).toContain('opacity-0');
    expect(waitsStarted[0]).toContain('inert');
    expect(waitsStarted[0]).not.toContain('opacity-100');
    // The style was applied before the wait began, so a running fade-in is cancelled, not ended.
    expect(waitsStarted[0]).toContain('style-read');
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
    advance(MOTION_SWAP_FADE_MS / 2);
    swap.rerender(
      <Swap viewKey="form">
        <p>Form again</p>
      </Swap>,
    );
    expect(screen.getByText('Form again')).toBeTruthy();
    expect(view().className).toContain('opacity-100');
    expect(view().hasAttribute('inert')).toBe(false);
    advance(MOTION_SWAP_FADE_MS);
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
    advance(MOTION_SWAP_FADE_MS / 2);
    swap.rerender(
      <Swap viewKey="c">
        <p>C</p>
      </Swap>,
    );
    expect(screen.getByText('A')).toBeTruthy();
    advance(MOTION_SWAP_FADE_MS);
    expect(screen.getByText('C')).toBeTruthy();
    expect(screen.queryByText('B')).toBeNull();
  });

  it('shows the new view at once with reduced motion', () => {
    motionEnv.reducedMotion = true;
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
