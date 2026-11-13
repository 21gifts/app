import { afterEach, describe, expect, it, vi } from 'vitest';
import { keepTabInside } from '@/lib/modal-focus';

function tab(shiftKey = false): KeyboardEvent {
  return new KeyboardEvent('keydown', { key: 'Tab', shiftKey, cancelable: true });
}

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('keepTabInside', () => {
  it('wraps Tab and Shift+Tab between the first and last controls', () => {
    const panel = document.createElement('div');
    panel.tabIndex = -1;
    const first = document.createElement('button');
    const middle = document.createElement('input');
    const last = document.createElement('a');
    last.href = '/next';
    panel.append(first, middle, last);
    document.body.append(panel);

    last.focus();
    const forward = tab();
    keepTabInside(forward, panel);
    expect(forward.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);

    first.focus();
    const backward = tab(true);
    keepTabInside(backward, panel);
    expect(backward.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(last);

    panel.focus();
    const fromPanel = tab(true);
    keepTabInside(fromPanel, panel);
    expect(fromPanel.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(last);

    middle.focus();
    const within = tab();
    keepTabInside(within, panel);
    expect(within.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(middle);
  });

  it('moves focus from outside the panel to its first control', () => {
    const outside = document.createElement('button');
    const panel = document.createElement('div');
    const first = document.createElement('input');
    panel.append(first, document.createElement('button'));
    document.body.append(outside, panel);
    outside.focus();

    const event = tab(true);
    keepTabInside(event, panel);

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);
  });

  it('skips disabled controls and controls inside an inert subtree', () => {
    const panel = document.createElement('div');
    const disabled = document.createElement('button');
    disabled.disabled = true;
    const inert = document.createElement('div');
    inert.setAttribute('inert', '');
    const hidden = document.createElement('input');
    inert.append(hidden);
    const first = document.createElement('textarea');
    const last = document.createElement('select');
    panel.append(disabled, inert, first, last);
    document.body.append(panel);

    last.focus();
    const event = tab();
    keepTabInside(event, panel);

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);
  });

  it('keeps focus on the panel when it has no focusable controls', () => {
    const panel = document.createElement('div');
    panel.tabIndex = -1;
    panel.append(document.createElement('span'));
    document.body.append(panel);
    const focus = vi.spyOn(panel, 'focus');

    const event = tab();
    keepTabInside(event, panel);

    expect(event.defaultPrevented).toBe(true);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(document.activeElement).toBe(panel);
  });
});
