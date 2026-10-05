import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  goToPreviousView,
  markBackNavigation,
  previousViewPath,
  recordCurrentView,
  resetViewHistory,
} from '@/lib/view-history';

const HISTORY_KEY = '21gifts.viewHistory';
const BACK_KEY = '21gifts.viewHistoryBack';
const SLOT = '__giftsViewHistory';

type ViewSlot = { stack: string[]; cursor: number; base?: number };

function dropSlot(): void {
  delete (globalThis as { [SLOT]?: ViewSlot })[SLOT];
}

function readSlot(): ViewSlot | undefined {
  return (globalThis as { [SLOT]?: ViewSlot })[SLOT];
}

function stored(): ViewSlot | null {
  const value = sessionStorage.getItem(HISTORY_KEY);
  if (value === null) {
    return null;
  }
  return JSON.parse(value) as ViewSlot;
}

function setGiftsView(value: number | undefined): void {
  const state = { ...(window.history.state as Record<string, unknown> | null) };
  if (value === undefined) {
    delete state['giftsView'];
  } else {
    state['giftsView'] = value;
  }
  window.history.replaceState(state, '');
}

const originalHistoryLength = Object.getOwnPropertyDescriptor(window.history, 'length');

function setHistoryLength(length: number): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(window.history, 'length');
  Object.defineProperty(window.history, 'length', { configurable: true, value: length });
  return (): void => {
    if (descriptor) {
      Object.defineProperty(window.history, 'length', descriptor);
    }
  };
}

/** A new path grows `history.length` before it is recorded, as a real navigation does. */
function pushView(path: string): void {
  const slot = readSlot();
  if (slot && slot.stack[slot.cursor] !== path) {
    Object.defineProperty(window.history, 'length', {
      configurable: true,
      value: window.history.length + 1,
    });
  }
  recordCurrentView(path);
}

/** A URL-changing `replaceState` is a replace, not a short `history.length`. */
function replaceView(path: string): void {
  window.history.replaceState(window.history.state, '', path);
  recordCurrentView(path);
}

beforeEach(() => {
  resetViewHistory();
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  resetViewHistory();
  if (originalHistoryLength) {
    Object.defineProperty(window.history, 'length', originalHistoryLength);
  } else {
    Reflect.deleteProperty(window.history, 'length');
  }
});

describe('previousViewPath', () => {
  it('is null when this tab has no earlier view', () => {
    expect(previousViewPath()).toBeNull();
  });

  it('is null when the cursor is in range but the previous entry is missing', () => {
    pushView('/a');
    const slot = readSlot();
    if (slot === undefined) {
      throw new Error('missing slot');
    }
    slot.stack = [];
    slot.cursor = 1;
    expect(previousViewPath()).toBeNull();
  });
});

describe('recordCurrentView', () => {
  it('records shops then notifications so the previous path is shops', () => {
    pushView('/shops');
    pushView('/notifications');
    expect(previousViewPath()).toBe('/shops');
    expect(stored()).toEqual({ stack: ['/shops', '/notifications'], cursor: 1 });
  });

  it('pushes a third visit to /a instead of collapsing back', () => {
    pushView('/a');
    pushView('/b');
    setGiftsView(undefined);
    pushView('/a');
    expect(previousViewPath()).toBe('/b');
    expect(stored()?.stack).toEqual(['/a', '/b', '/a']);
  });

  it('restores a stamped earlier entry and drops the forward entry on the next push', () => {
    pushView('/a');
    pushView('/b');
    pushView('/c');
    setGiftsView(1);
    pushView('/b');
    expect(previousViewPath()).toBe('/a');
    expect(stored()?.stack).toEqual(['/a', '/b', '/c']);
    pushView('/d');
    expect(previousViewPath()).toBe('/b');
    expect(stored()?.stack).toEqual(['/a', '/b', '/d']);
    setGiftsView(0);
    pushView('/a');
    setGiftsView(2);
    pushView('/d');
    expect(previousViewPath()).toBe('/b');
    expect(stored()?.cursor).toBe(2);
  });

  it('does not grow a self-loop when the same path is recorded twice', () => {
    pushView('/shops');
    pushView('/shops');
    expect(previousViewPath()).toBeNull();
    expect(stored()?.stack).toEqual(['/shops']);
    pushView('/notifications');
    pushView('/notifications');
    expect(previousViewPath()).toBe('/shops');
    expect(stored()?.stack).toEqual(['/shops', '/notifications']);
  });

  it('keeps the oldest view when a full stack replace arrives after a provisional push', () => {
    for (let index = 0; index < 50; index += 1) {
      pushView(`/p${index}`);
    }
    expect(stored()?.stack[0]).toBe('/p0');
    recordCurrentView('/extra', false);
    expect(stored()?.stack).toHaveLength(51);
    expect(stored()?.stack[0]).toBe('/p0');
    window.history.replaceState(window.history.state, '', '/extra');
    recordCurrentView('/extra');
    expect(stored()?.stack).toHaveLength(50);
    expect(stored()?.stack[0]).toBe('/p0');
    expect(stored()?.stack[49]).toBe('/extra');
    expect(stored()?.base).toBeUndefined();
  });

  it('drops the oldest view when a full stack push is committed', () => {
    for (let index = 0; index < 50; index += 1) {
      pushView(`/p${index}`);
    }
    recordCurrentView('/extra', false);
    window.history.pushState(null, '', '/extra');
    recordCurrentView('/extra');
    expect(stored()?.stack).toHaveLength(50);
    expect(stored()?.stack[0]).toBe('/p1');
    expect(stored()?.stack[49]).toBe('/extra');
    expect(stored()?.base).toBe(1);
  });

  it('collapses a provisional push when the router then replaces', () => {
    pushView('/shops');
    recordCurrentView('/login', false);
    expect(previousViewPath()).toBe('/shops');
    window.history.replaceState(window.history.state, '', '/login');
    recordCurrentView('/login');
    expect(stored()?.stack).toEqual(['/login']);
    expect(previousViewPath()).toBeNull();
  });

  it('keeps the previous view when the router then pushes', () => {
    pushView('/shops');
    recordCurrentView('/notifications', false);
    window.history.pushState(null, '', '/notifications');
    recordCurrentView('/notifications');
    expect(stored()?.stack).toEqual(['/shops', '/notifications']);
    expect(previousViewPath()).toBe('/shops');
  });

  it('does not stamp the history entry being left when stampHistory is false', () => {
    pushView('/shops');
    expect((window.history.state as { giftsView?: unknown }).giftsView).toBe(0);
    recordCurrentView('/notifications', false);
    expect((window.history.state as { giftsView?: unknown }).giftsView).toBe(0);
    expect(previousViewPath()).toBe('/shops');
    recordCurrentView('/notifications');
    expect((window.history.state as { giftsView?: unknown }).giftsView).toBe(1);
  });

  it('drops a stored stack that contains an unsafe path', () => {
    sessionStorage.setItem(
      HISTORY_KEY,
      JSON.stringify({ stack: ['/shops', '//evil.example'], cursor: 1 }),
    );
    dropSlot();
    expect(previousViewPath()).toBeNull();
    expect(readSlot()).toBeUndefined();
    resetViewHistory();
  });

  it('stamps a repeated path when the history entry has no giftsView yet', () => {
    pushView('/shops');
    setGiftsView(undefined);
    pushView('/shops');
    expect(stored()?.stack).toEqual(['/shops']);
    expect((window.history.state as { giftsView?: unknown }).giftsView).toBe(0);
  });

  it('does not restamp when the current entry is already stamped', () => {
    pushView('/shops');
    const slot = readSlot();
    if (slot === undefined) {
      throw new Error('missing slot');
    }
    let reads = 0;
    slot.stack = new Proxy(['/shops'], {
      get(target, prop, receiver) {
        if (prop === '0') {
          reads += 1;
          return reads === 1 ? '/other' : '/shops';
        }
        return Reflect.get(target, prop, receiver);
      },
    }) as string[];
    setGiftsView(0);
    const replaceState = vi.spyOn(window.history, 'replaceState');
    recordCurrentView('/shops');
    expect(replaceState).not.toHaveBeenCalled();
    expect(previousViewPath()).toBeNull();
    expect(stored()?.stack).toEqual(['/shops']);
  });

  it('ignores unsafe paths', () => {
    pushView('/shops');
    const unsafe = [
      '//evil',
      '/../x',
      'https://x',
      '/foo bar',
      `/${'a'.repeat(512)}`,
      '/a\\b',
      '',
      '/foo#bar',
      '/foo!',
    ];
    for (const path of unsafe) {
      pushView(path);
      expect(previousViewPath()).toBeNull();
      expect(stored()?.stack).toEqual(['/shops']);
    }
  });

  it('does not treat a non-integer, negative, or out-of-range giftsView as a stamp', () => {
    pushView('/a');
    pushView('/b');
    pushView('/c');
    setGiftsView(1.5);
    pushView('/b');
    expect(previousViewPath()).toBe('/c');
    resetViewHistory();
    window.history.replaceState(null, '');
    pushView('/a');
    pushView('/b');
    setGiftsView(-1);
    pushView('/a');
    expect(previousViewPath()).toBe('/b');
    resetViewHistory();
    window.history.replaceState(null, '');
    pushView('/a');
    pushView('/b');
    setGiftsView(9);
    pushView('/z');
    expect(previousViewPath()).toBe('/b');
    resetViewHistory();
    window.history.replaceState(null, '');
    pushView('/a');
    pushView('/b');
    pushView('/c');
    setGiftsView(0);
    pushView('/z');
    expect(stored()?.stack).toEqual(['/a', '/b', '/c', '/z']);
  });

  it('drops the oldest path after 51 pushes and does not treat stamp 0 as the original first path', () => {
    for (let index = 0; index < 51; index += 1) {
      pushView(`/p${index}`);
    }
    expect(stored()?.stack[0]).toBe('/p1');
    expect(stored()?.stack).toHaveLength(50);
    setGiftsView(0);
    pushView('/p0');
    expect(previousViewPath()).toBe('/p50');
    expect(stored()?.stack[0]).not.toBe('/p0');
    expect(stored()?.cursor).toBe(49);
  });

  it('restores a capped entry from its absolute stamp', () => {
    for (let index = 0; index < 51; index += 1) {
      pushView(`/p${index}`);
    }
    setGiftsView(49);
    dropSlot();
    recordCurrentView('/p49');
    expect(stored()?.cursor).toBe(48);
    expect(previousViewPath()).toBe('/p48');
    expect(stored()?.stack[48]).toBe('/p49');
  });

  it('replaces the open view when the router replaceState changes the url', () => {
    recordCurrentView('/gated');
    replaceView('/login');
    expect(previousViewPath()).toBeNull();
    expect(stored()).toEqual({ stack: ['/login'], cursor: 0 });
  });

  it('keeps the earlier view when a later screen is replaced', () => {
    pushView('/shops');
    pushView('/moderate');
    replaceView('/login');
    expect(previousViewPath()).toBe('/shops');
    expect(stored()).toEqual({ stack: ['/shops', '/login'], cursor: 1 });
  });

  it('pushes the first path of a new document, then replaces a screen that does not grow history', () => {
    pushView('/shops');
    pushView('/moderate');
    const saved = sessionStorage.getItem(HISTORY_KEY);
    if (saved === null) {
      throw new Error('missing history');
    }
    resetViewHistory();
    sessionStorage.setItem(HISTORY_KEY, saved);
    dropSlot();
    recordCurrentView('/notifications');
    expect(stored()).toEqual({ stack: ['/shops', '/moderate', '/notifications'], cursor: 2 });
    expect(previousViewPath()).toBe('/moderate');
    replaceView('/login');
    expect(stored()).toEqual({ stack: ['/shops', '/moderate', '/login'], cursor: 2 });
    expect(previousViewPath()).toBe('/moderate');
  });

  it('drops forward entries when the current screen is replaced', () => {
    pushView('/a');
    pushView('/b');
    pushView('/c');
    setGiftsView(1);
    recordCurrentView('/b');
    replaceView('/login');
    expect(previousViewPath()).toBe('/a');
    expect(stored()).toEqual({ stack: ['/a', '/login'], cursor: 1 });
  });

  it('pushes the next view when history.length stays put after browser back', () => {
    pushView('/welcome');
    pushView('/shops');
    pushView('/notifications');
    setGiftsView(1);
    recordCurrentView('/shops');
    const length = window.history.length;
    window.history.pushState(window.history.state, '', '/map');
    Object.defineProperty(window.history, 'length', { configurable: true, value: length });
    recordCurrentView('/map');
    expect(previousViewPath()).toBe('/shops');
    expect(stored()).toEqual({ stack: ['/welcome', '/shops', '/map'], cursor: 2 });
  });
});

describe('stored memory', () => {
  it('ignores bad JSON and a non-object payload', () => {
    sessionStorage.setItem(HISTORY_KEY, '{');
    dropSlot();
    expect(previousViewPath()).toBeNull();
    resetViewHistory();
    for (const payload of ['null', '"hello"', '1', 'true', '[]']) {
      sessionStorage.setItem(HISTORY_KEY, payload);
      dropSlot();
      expect(previousViewPath()).toBeNull();
      resetViewHistory();
    }
  });

  it('ignores a payload that is not a stack', () => {
    const bad = [
      '{"stack":"/a","cursor":0}',
      '{"stack":["/a"],"cursor":"0"}',
      '{"stack":["/a"],"cursor":1.5}',
      '{"stack":["/a"],"cursor":-1}',
      '{"stack":["/a"],"cursor":2}',
      '{"stack":["/a",1],"cursor":1}',
    ];
    for (const payload of bad) {
      sessionStorage.setItem(HISTORY_KEY, payload);
      dropSlot();
      expect(previousViewPath()).toBeNull();
      resetViewHistory();
    }
  });

  it('keeps an empty stack when the stored cursor is unusable and filters non-strings', () => {
    sessionStorage.setItem(HISTORY_KEY, '{"stack":[],"cursor":3}');
    dropSlot();
    expect(previousViewPath()).toBeNull();
    expect(readSlot()).toEqual({
      stack: [],
      cursor: 0,
      base: 0,
      historyLength: window.history.length,
      anchored: false,
    });
    resetViewHistory();
    sessionStorage.setItem(HISTORY_KEY, '{"stack":[1,"/ok"],"cursor":0}');
    dropSlot();
    expect(previousViewPath()).toBeNull();
    expect(readSlot()?.stack).toEqual(['/ok']);
  });

  it('keeps the slot when sessionStorage getItem or setItem throws', () => {
    dropSlot();
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(previousViewPath()).toBeNull();
    getItem.mockRestore();
    pushView('/shops');
    pushView('/notifications');
    expect(previousViewPath()).toBe('/shops');
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    pushView('/map');
    expect(previousViewPath()).toBe('/notifications');
    setItem.mockRestore();
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('denied');
    });
    resetViewHistory();
    expect(readSlot()).toBeUndefined();
    removeItem.mockRestore();
    resetViewHistory();
  });
});

describe('goToPreviousView', () => {
  it('pushes /welcome and does not call history.back when the stack is empty', () => {
    const push = vi.fn();
    const assign = vi.fn();
    vi.stubGlobal('location', { assign });
    const restoreLength = setHistoryLength(5);
    const historyBack = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
    goToPreviousView(push);
    expect(push).toHaveBeenCalledWith('/welcome');
    expect(assign).not.toHaveBeenCalled();
    expect(historyBack).not.toHaveBeenCalled();
    restoreLength();
  });

  it('pushes the previous path and does not call history.back when the entry is stamped', () => {
    pushView('/shops');
    pushView('/notifications');
    setGiftsView(1);
    const push = vi.fn();
    const restoreLength = setHistoryLength(2);
    const historyBack = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
    goToPreviousView(push);
    goToPreviousView(push);
    expect(push).toHaveBeenNthCalledWith(1, '/shops');
    expect(push).toHaveBeenNthCalledWith(2, '/shops');
    expect(historyBack).not.toHaveBeenCalled();
    restoreLength();
  });

  it('pushes the previous path when the stamp is missing', () => {
    pushView('/shops');
    pushView('/notifications');
    setGiftsView(undefined);
    const push = vi.fn();
    goToPreviousView(push);
    expect(push).toHaveBeenCalledWith('/shops');
  });

  it('pushes the previous path when the stamp is 0', () => {
    pushView('/shops');
    pushView('/notifications');
    setGiftsView(0);
    const push = vi.fn();
    goToPreviousView(push);
    expect(push).toHaveBeenCalledWith('/shops');
  });

  it('pushes the previous path when the stamp is set but history.length is 1', () => {
    pushView('/shops');
    pushView('/notifications');
    setGiftsView(1);
    const push = vi.fn();
    const restoreLength = setHistoryLength(1);
    goToPreviousView(push);
    expect(push).toHaveBeenCalledWith('/shops');
    restoreLength();
  });

  it('pushes /welcome when a replaced cold open has no earlier view', () => {
    recordCurrentView('/gated');
    replaceView('/login');
    const push = vi.fn();
    goToPreviousView(push);
    expect(push).toHaveBeenCalledWith('/welcome');
  });

  it('steps the cursor back when the client-side navigation records the pushed path', () => {
    pushView('/welcome');
    pushView('/shops');
    pushView('/notifications');
    const push = vi.fn((href: string) => {
      window.history.pushState(window.history.state, '', href);
    });
    goToPreviousView(push);
    expect(push).toHaveBeenCalledWith('/shops');
    expect(stored()).toEqual({ stack: ['/welcome', '/shops', '/notifications'], cursor: 2 });
    recordCurrentView('/shops', false);
    expect(stored()).toEqual({ stack: ['/welcome', '/shops'], cursor: 1 });
    recordCurrentView('/shops');
    expect(stored()).toEqual({ stack: ['/welcome', '/shops'], cursor: 1 });
    expect(previousViewPath()).toBe('/welcome');
    goToPreviousView(push);
    recordCurrentView('/welcome');
    expect(stored()).toEqual({ stack: ['/welcome'], cursor: 0 });
    expect(previousViewPath()).toBeNull();
    expect(sessionStorage.getItem(BACK_KEY)).toBeNull();
  });

  it('keeps the target while the view it leaves records again', () => {
    pushView('/shops');
    pushView('/notifications');
    goToPreviousView(vi.fn());
    recordCurrentView('/notifications', false);
    recordCurrentView('/notifications');
    expect(sessionStorage.getItem(BACK_KEY)).toBe('/shops');
    recordCurrentView('/shops');
    expect(stored()).toEqual({ stack: ['/shops'], cursor: 0 });
  });

  it('steps the cursor back when the router falls back to a document load', () => {
    pushView('/welcome');
    pushView('/shops');
    pushView('/notifications');
    goToPreviousView(vi.fn());
    dropSlot();
    recordCurrentView('/shops');
    expect(stored()).toEqual({ stack: ['/welcome', '/shops'], cursor: 1 });
    expect(previousViewPath()).toBe('/welcome');
  });

  it('does not step back when a forward visit reopens the previous path', () => {
    pushView('/shops');
    pushView('/notifications');
    window.history.pushState(window.history.state, '', '/shops');
    recordCurrentView('/shops');
    expect(stored()?.stack).toEqual(['/shops', '/notifications', '/shops']);
    expect(previousViewPath()).toBe('/notifications');
  });

  it('drops a stale arrow marker when another view records first', () => {
    pushView('/shops');
    pushView('/notifications');
    goToPreviousView(vi.fn());
    recordCurrentView('/map');
    expect(stored()?.stack).toEqual(['/shops', '/notifications', '/map']);
    expect(sessionStorage.getItem(BACK_KEY)).toBeNull();
    recordCurrentView('/shops');
    expect(stored()?.stack).toEqual(['/shops', '/notifications', '/map', '/shops']);
    dropSlot();
    recordCurrentView('/shops');
    expect(stored()?.stack).toEqual(['/shops', '/notifications', '/map', '/shops']);
  });

  it('still pushes and steps back when the arrow marker cannot be stored', () => {
    pushView('/shops');
    pushView('/notifications');
    const push = vi.fn();
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    goToPreviousView(push);
    expect(push).toHaveBeenCalledWith('/shops');
    recordCurrentView('/shops');
    setItem.mockRestore();
    expect(previousViewPath()).toBeNull();
  });

  it('pushes when the arrow marker does not match the previous entry', () => {
    pushView('/shops');
    pushView('/notifications');
    sessionStorage.setItem(BACK_KEY, '/map');
    dropSlot();
    recordCurrentView('/map');
    expect(stored()?.stack).toEqual(['/shops', '/notifications', '/map']);
    expect(previousViewPath()).toBe('/notifications');
  });

  it('pushes when the marked path is not the previous entry of an anchored stack', () => {
    pushView('/shops');
    pushView('/notifications');
    markBackNavigation('/map');
    recordCurrentView('/map');
    expect(stored()?.stack).toEqual(['/shops', '/notifications', '/map']);
  });

  it('opens the forum as the only view when the arrow had no earlier view', () => {
    recordCurrentView('/gated');
    replaceView('/login');
    goToPreviousView(vi.fn());
    recordCurrentView('/welcome');
    expect(stored()).toEqual({ stack: ['/welcome'], cursor: 0 });
    expect(previousViewPath()).toBeNull();
  });

  it('opens the forum as the only view after a document load', () => {
    recordCurrentView('/gated');
    replaceView('/login');
    goToPreviousView(vi.fn());
    dropSlot();
    recordCurrentView('/welcome');
    expect(stored()).toEqual({ stack: ['/welcome'], cursor: 0 });
    expect(previousViewPath()).toBeNull();
  });

  it('keeps recording when the arrow marker cannot be read', () => {
    pushView('/shops');
    sessionStorage.setItem(BACK_KEY, '/shops');
    dropSlot();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    recordCurrentView('/notifications');
    expect(previousViewPath()).toBeNull();
    expect(readSlot()?.stack).toEqual(['/notifications']);
  });

  it('forgets a pending target on reset', () => {
    pushView('/shops');
    pushView('/notifications');
    goToPreviousView(vi.fn());
    resetViewHistory();
    expect(sessionStorage.getItem(BACK_KEY)).toBeNull();
    pushView('/notifications');
    pushView('/shops');
    expect(stored()?.stack).toEqual(['/notifications', '/shops']);
  });
});

describe('markBackNavigation', () => {
  it('marks the path so its arrival steps back instead of pushing', () => {
    pushView('/shops');
    pushView('/notifications');
    markBackNavigation('/shops');
    expect(sessionStorage.getItem(BACK_KEY)).toBe('/shops');
    recordCurrentView('/shops');
    expect(stored()).toEqual({ stack: ['/shops'], cursor: 0 });
    expect(sessionStorage.getItem(BACK_KEY)).toBeNull();
  });
});

describe('resetViewHistory', () => {
  it('clears the slot and the session key', () => {
    pushView('/shops');
    pushView('/notifications');
    resetViewHistory();
    expect(previousViewPath()).toBeNull();
    expect(sessionStorage.getItem(HISTORY_KEY)).toBeNull();
    expect(readSlot()).toBeUndefined();
  });
});
