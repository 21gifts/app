import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** Loads a fresh module, so its once-per-document record starts empty. */
async function freshModule(): Promise<typeof import('@/lib/page-load')> {
  vi.resetModules();
  return import('@/lib/page-load');
}

/**
 * Makes the browser report `type` for this document's navigation entry.
 *
 * @param type - Reported type, or `null` for no entry.
 */
function navigationType(type: string | null): void {
  vi.spyOn(performance, 'getEntriesByType').mockReturnValue(
    type === null ? [] : ([{ type }] as unknown as PerformanceEntryList),
  );
}

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe('capturePageLoad', () => {
  it.each(['navigate', 'reload', 'back_forward', 'prerender'] as const)(
    'reports a %s load as the member’s without a marker',
    async (type) => {
      navigationType(type);
      const { capturePageLoad } = await freshModule();
      expect(capturePageLoad()).toEqual({ load: type, load_trigger: 'other' });
    },
  );

  it('reports unknown when the browser has no navigation entry or an unlisted type', async () => {
    navigationType(null);
    expect((await freshModule()).capturePageLoad().load).toBe('unknown');
    navigationType('some-new-type');
    expect((await freshModule()).capturePageLoad().load).toBe('unknown');
  });

  it('counts a navigate load that finds the marker as the app’s and removes the marker', async () => {
    navigationType('navigate');
    const { APP_NAVIGATION_KEY, capturePageLoad } = await freshModule();
    sessionStorage.setItem(APP_NAVIGATION_KEY, 'app');
    expect(capturePageLoad()).toEqual({ load: 'navigate', load_trigger: 'app' });
    expect(sessionStorage.getItem(APP_NAVIGATION_KEY)).toBeNull();
  });

  it('counts a reload that finds the marker as the member’s', async () => {
    navigationType('reload');
    const { APP_NAVIGATION_KEY, capturePageLoad } = await freshModule();
    sessionStorage.setItem(APP_NAVIGATION_KEY, 'app');
    expect(capturePageLoad()).toEqual({ load: 'reload', load_trigger: 'other' });
    expect(sessionStorage.getItem(APP_NAVIGATION_KEY)).toBeNull();
  });

  it('ignores any other value under the key', async () => {
    navigationType('navigate');
    const { APP_NAVIGATION_KEY, capturePageLoad } = await freshModule();
    sessionStorage.setItem(APP_NAVIGATION_KEY, 'something');
    expect(capturePageLoad().load_trigger).toBe('other');
  });

  it('reads the load once per document', async () => {
    navigationType('reload');
    const { APP_NAVIGATION_KEY, capturePageLoad, markAppNavigation } = await freshModule();
    const first = capturePageLoad();
    markAppNavigation();
    expect(capturePageLoad()).toBe(first);
    expect(sessionStorage.getItem(APP_NAVIGATION_KEY)).toBe('app');
  });

  it('counts unreadable storage as no marker', async () => {
    navigationType('navigate');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { capturePageLoad } = await freshModule();
    expect(capturePageLoad()).toEqual({ load: 'navigate', load_trigger: 'other' });
  });
});

describe('markAppNavigation and clearAppNavigation', () => {
  it('stores only the word app and removes it again', async () => {
    const { APP_NAVIGATION_KEY, clearAppNavigation, markAppNavigation } = await freshModule();
    markAppNavigation();
    expect(sessionStorage.getItem(APP_NAVIGATION_KEY)).toBe('app');
    expect(sessionStorage.length).toBe(1);
    clearAppNavigation();
    expect(sessionStorage.getItem(APP_NAVIGATION_KEY)).toBeNull();
  });

  it('does not throw when storage is blocked', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { clearAppNavigation, markAppNavigation } = await freshModule();
    expect(() => {
      markAppNavigation();
      clearAppNavigation();
    }).not.toThrow();
  });
});
