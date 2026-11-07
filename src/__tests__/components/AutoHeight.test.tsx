import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AutoHeight } from '@/components/AutoHeight';
import { MOTION_EASE_MS, MOTION_FOLD_MS, MOTION_SETTLE_EVENT } from '@/lib/motion';
import {
  FakeResizeObserver,
  advance,
  endTransition,
  fakeLayout,
  motionEnv,
  installMotionHooks,
} from '@/__tests__/motion-fixture';

installMotionHooks();

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
    motionEnv.layoutHeight = 40.5;
    const view = render(
      <AutoHeight className="gap-2">
        <p>Body</p>
      </AutoHeight>,
    );
    const inner = screen.getByText('Body').parentElement as HTMLElement;
    const box = inner.parentElement as HTMLElement;
    const observer = motionEnv.observers[0] as FakeResizeObserver;
    expect(observer.observed).toEqual([inner]);
    expect(inner.className).toBe('flow-root gap-2');
    expect(box.style.height).toBe('40.5px');
    expect(box.className).toContain('transition-[height] duration-280 ease-glide');
    expect(box.className).not.toContain('overflow-hidden');

    observer.fire();
    expect(box.className).not.toContain('overflow-hidden');

    motionEnv.layoutHeight = 90;
    observer.fire();
    expect(box.style.height).toBe('90px');
    expect(box.className).toContain('overflow-hidden');
    advance(MOTION_EASE_MS);
    motionEnv.layoutHeight = 120;
    observer.fire();
    advance(MOTION_FOLD_MS - 1);
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
    motionEnv.layoutHeight = 40;
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
    motionEnv.layoutHeight = 90;
    (motionEnv.observers[0] as FakeResizeObserver).fire();
    endTransition(box, 'height');
    expect(seen).toEqual([true]);
    expect(box.hasAttribute('data-gliding')).toBe(false);
    document.removeEventListener(MOTION_SETTLE_EVENT, onSettle);
  });

  it('stops clipping when its height transition ends', () => {
    fakeLayout();
    motionEnv.layoutHeight = 40;
    render(
      <AutoHeight>
        <p>Body</p>
      </AutoHeight>,
    );
    const box = screen.getByText('Body').parentElement?.parentElement as HTMLElement;
    motionEnv.layoutHeight = 90;
    (motionEnv.observers[0] as FakeResizeObserver).fire();
    expect(box.hasAttribute('data-gliding')).toBe(true);
    endTransition(box, 'height');
    expect(box.hasAttribute('data-gliding')).toBe(false);
    expect(box.className).not.toContain('overflow-hidden');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('follows a gliding box inside it at once instead of gliding behind it', () => {
    fakeLayout();
    motionEnv.layoutHeight = 40;
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
    const [innerObserver, outerObserver] = motionEnv.observers as [
      FakeResizeObserver,
      FakeResizeObserver,
    ];
    motionEnv.layoutHeight = 90;
    innerObserver.fire();
    expect(innerBox.hasAttribute('data-gliding')).toBe(true);
    expect(innerBox.hasAttribute('data-follow')).toBe(false);
    outerObserver.fire();
    expect(outerBox.hasAttribute('data-follow')).toBe(true);
    expect(outerBox.hasAttribute('data-gliding')).toBe(false);
    expect(outerBox.className).not.toContain('overflow-hidden');
    expect(outerBox.style.height).toBe('90px');
    advance(MOTION_FOLD_MS);
    expect(innerBox.hasAttribute('data-gliding')).toBe(false);
    motionEnv.layoutHeight = 120;
    outerObserver.fire();
    expect(outerBox.hasAttribute('data-follow')).toBe(false);
    expect(outerBox.hasAttribute('data-gliding')).toBe(true);
    expect(outerBox.className).toContain('overflow-hidden');
  });

  it('follows the height without clipping or waiting with reduced motion', () => {
    motionEnv.reducedMotion = true;
    fakeLayout();
    motionEnv.layoutHeight = 40;
    render(
      <AutoHeight>
        <p>Body</p>
      </AutoHeight>,
    );
    const box = screen.getByText('Body').parentElement?.parentElement as HTMLElement;
    motionEnv.layoutHeight = 90;
    (motionEnv.observers[0] as FakeResizeObserver).fire();
    expect(box.style.height).toBe('90px');
    expect(box.className).not.toContain('overflow-hidden');
    expect(vi.getTimerCount()).toBe(0);
  });
});
