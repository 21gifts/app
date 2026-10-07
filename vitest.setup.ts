/**
 * Test setup: install an in-memory `localStorage` on the jsdom `window`, and
 * keep the interaction log off the network.
 *
 * The jsdom environment vitest uses here does not expose `window.localStorage`,
 * so the session-storage module has no backing store under test. This provides
 * a minimal, spec-shaped in-memory Storage on the browser-like environment
 * only; the SSR (node) environment has no `window` and keeps exercising the
 * module's server guard.
 */

import { vi } from 'vitest';

// The interaction log queues events in module state and sends them with
// `fetch`. Left real, a full queue in one test would post to `/me/events` and
// take a response another test stubbed. Tests that record events assert the
// `logInteraction` calls instead; `interaction-log.test.ts` unmocks it.
vi.mock('@/lib/interaction-log', () => ({
  INTERACTION_FLUSH_MS: 10_000,
  INTERACTION_BATCH_SIZE: 50,
  logInteraction: vi.fn(),
  flushInteractions: vi.fn(() => Promise.resolve()),
  startInteractionLog: vi.fn(() => () => undefined),
}));

/** Minimal in-memory implementation of the Web Storage API for tests. */
class MemoryStorage {
  #entries = new Map<string, string>();

  get length(): number {
    return this.#entries.size;
  }

  clear(): void {
    this.#entries.clear();
  }

  getItem(key: string): string | null {
    const value = this.#entries.get(key);
    return value === undefined ? null : value;
  }

  key(index: number): string | null {
    return Array.from(this.#entries.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.#entries.delete(key);
  }

  setItem(key: string, value: string): void {
    this.#entries.set(key, String(value));
  }
}

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    value: new MemoryStorage(),
    configurable: true,
  });
}
