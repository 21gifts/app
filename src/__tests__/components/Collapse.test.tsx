import { useLayoutEffect } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Collapse } from '@/components/Collapse';
import { MOTION_EASE_MS, MOTION_FOLD_MS, MOTION_SETTLE_EVENT } from '@/lib/motion';
import { advance, endTransition, motionEnv, installMotionHooks } from '@/__tests__/motion-fixture';

installMotionHooks();

function fold(): HTMLElement {
  return document.querySelector('[data-collapse]') as HTMLElement;
}

function clip(): HTMLElement {
  return fold().firstElementChild as HTMLElement;
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
    advance(MOTION_FOLD_MS - 1);
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
    const marks = new MutationObserver(() => undefined);
    marks.observe(fold(), { attributeFilter: ['data-collapse'], attributeOldValue: true });
    advance(MOTION_FOLD_MS);
    // The box was still `opening` when the event reached the document.
    expect(seen).toEqual(['opening']);
    expect(fold().getAttribute('data-collapse')).toBe('open');
    // It turned `open` right after the event, in the same task, before React rendered the settled
    // state (which writes `open` once more).
    expect(marks.takeRecords().map((record) => record.oldValue)).toEqual(['opening', 'open']);
    marks.disconnect();
    document.removeEventListener(MOTION_SETTLE_EVENT, onSettle);
  });

  it('shows the open end in the same commit with reduced motion', () => {
    motionEnv.reducedMotion = true;
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
    advance(MOTION_FOLD_MS - 1);
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
    advance(MOTION_EASE_MS / 2);
    view.rerender(
      <Collapse show>
        <p>Second</p>
      </Collapse>,
    );
    expect(screen.getByText('Second')).toBeTruthy();
    advance(MOTION_FOLD_MS);
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
    advance(MOTION_FOLD_MS);
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
    motionEnv.reducedMotion = true;
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
    advance(MOTION_FOLD_MS);
    expect(screen.queryByText('Body')).toBeNull();
  });
});
