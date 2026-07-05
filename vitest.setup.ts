/**
 * Test setup: install an in-memory `localStorage` on the jsdom `window`.
 *
 * The jsdom environment vitest uses here does not expose `window.localStorage`,
 * so the session-storage module has no backing store under test. This provides
 * a minimal, spec-shaped in-memory Storage on the browser-like environment
 * only; the SSR (node) environment has no `window` and keeps exercising the
 * module's server guard.
 */

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
