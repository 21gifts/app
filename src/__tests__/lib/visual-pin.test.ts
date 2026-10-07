import { afterEach, describe, expect, it } from 'vitest';
import { visualPin } from '@/lib/visual-pin';

const ORIGINAL_E2E_NOW = process.env.NEXT_PUBLIC_E2E_NOW;

afterEach(() => {
  if (ORIGINAL_E2E_NOW === undefined) {
    delete process.env.NEXT_PUBLIC_E2E_NOW;
  } else {
    process.env.NEXT_PUBLIC_E2E_NOW = ORIGINAL_E2E_NOW;
  }
  window.history.replaceState({}, '', '/');
});

describe('visualPin', () => {
  it('reads the ?visual= pin in a Playwright build', () => {
    process.env.NEXT_PUBLIC_E2E_NOW = '2026-01-07T12:00:00.000Z';
    window.history.replaceState({}, '', '/welcome?visual=send-input');
    expect(visualPin()).toBe('send-input');
    window.history.replaceState({}, '', '/welcome');
    expect(visualPin()).toBeNull();
  });

  it('ignores the pin in a deployed build', () => {
    delete process.env.NEXT_PUBLIC_E2E_NOW;
    window.history.replaceState({}, '', '/welcome?visual=send-input');
    expect(visualPin()).toBeNull();
  });
});
