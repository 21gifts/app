import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ScrollSurfaceGuard } from '@/components/ScrollSurfaceGuard';

afterEach(() => {
  cleanup();
  document.body.querySelectorAll('[data-stray]').forEach((node) => {
    node.remove();
  });
});

describe('ScrollSurfaceGuard', () => {
  it('clips a scrolling element added after mount', async () => {
    render(<ScrollSurfaceGuard />);
    const stray = document.createElement('div');
    stray.dataset.stray = '1';
    stray.style.overflow = 'auto';
    document.body.appendChild(stray);
    const again = document.createElement('div');
    again.dataset.stray = '1';
    again.style.overflow = 'scroll';
    document.body.appendChild(again);
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        resolve();
      });
    });
    expect(stray.style.overflow).toBe('hidden');
    expect(again.style.overflow).toBe('hidden');
  });

  it('grows a textarea on input and stops watching after unmount', async () => {
    const { unmount } = render(<ScrollSurfaceGuard />);
    const field = document.createElement('textarea');
    field.dataset.stray = '1';
    field.value = 'a\nb\nc';
    document.body.appendChild(field);
    fireEvent.input(field);
    expect(field.style.overflow).toBe('hidden');
    expect(field.style.height).toBe(`${field.scrollHeight}px`);
    const ignored = document.createElement('div');
    ignored.dataset.stray = '1';
    document.body.appendChild(ignored);
    fireEvent.input(ignored);
    unmount();
    const late = document.createElement('div');
    late.dataset.stray = '1';
    late.style.overflow = 'auto';
    document.body.appendChild(late);
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        resolve();
      });
    });
    expect(late.style.overflow).toBe('auto');
  });
});
