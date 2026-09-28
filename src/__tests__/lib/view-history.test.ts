import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  goToPreviousView,
  previousViewPath,
  recordCurrentView,
  resetViewHistory,
} from '@/lib/view-history';

const HISTORY_KEY = '21gifts.viewHistory';
const SLOT = '__giftsViewHistory';

type ViewSlot = { stack: string[]; cursor: number };

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

function setHistoryLength(length: number): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(window.history, 'length');
  Object.defineProperty(window.history, 'length', { configurable: true, value: length });
  return (): void => {
    if (descriptor) {
      Object.defineProperty(window.history, 'length', descriptor);
    }
  };
}

beforeEach(() => {
  resetViewHistory();
  window.history.replaceState(null, '');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  resetViewHistory();
});

describe('previousViewPath', () => {
  it('is null when this tab has no earlier view', () => {
    expect(previousViewPath()).toBeNull();
  });

  it('is null when the cursor is in range but the previous entry is missing', () => {
    recordCurrentView('/a');
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
    recordCurrentView('/shops');
    recordCurrentView('/notifications');
    expect(previousViewPath()).toBe('/shops');
    expect(stored()).toEqual({ stack: ['/shops', '/notifications'], cursor: 1 });
  });

  it('pushes a third visit to /a instead of collapsing back', () => {
    recordCurrentView('/a');
    recordCurrentView('/b');
    setGiftsView(undefined);
    recordCurrentView('/a');
    expect(previousViewPath()).toBe('/b');
    expect(stored()?.stack).toEqual(['/a', '/b', '/a']);
  });

  it('restores a stamped earlier entry and drops the forward entry on the next push', () => {
    recordCurrentView('/a');
    recordCurrentView('/b');
    recordCurrentView('/c');
    setGiftsView(1);
    recordCurrentView('/b');
    expect(previousViewPath()).toBe('/a');
    expect(stored()?.stack).toEqual(['/a', '/b', '/c']);
    recordCurrentView('/d');
    expect(previousViewPath()).toBe('/b');
    expect(stored()?.stack).toEqual(['/a', '/b', '/d']);
    setGiftsView(0);
    recordCurrentView('/a');
    setGiftsView(2);
    recordCurrentView('/d');
    expect(previousViewPath()).toBe('/b');
    expect(stored()?.cursor).toBe(2);
  });

  it('does not grow a self-loop when the same path is recorded twice', () => {
    recordCurrentView('/shops');
    recordCurrentView('/shops');
    expect(previousViewPath()).toBeNull();
    expect(stored()?.stack).toEqual(['/shops']);
    recordCurrentView('/notifications');
    recordCurrentView('/notifications');
    expect(previousViewPath()).toBe('/shops');
    expect(stored()?.stack).toEqual(['/shops', '/notifications']);
  });

  it('stamps a repeated path when the history entry has no giftsView yet', () => {
    recordCurrentView('/shops');
    setGiftsView(undefined);
    recordCurrentView('/shops');
    expect(stored()?.stack).toEqual(['/shops']);
    expect((window.history.state as { giftsView?: unknown }).giftsView).toBe(0);
  });

  it('does not restamp when the current entry is already stamped', () => {
    recordCurrentView('/shops');
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
    recordCurrentView('/shops');
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
      recordCurrentView(path);
      expect(previousViewPath()).toBeNull();
      expect(stored()?.stack).toEqual(['/shops']);
    }
  });

  it('does not treat a non-integer, negative, or out-of-range giftsView as a stamp', () => {
    recordCurrentView('/a');
    recordCurrentView('/b');
    recordCurrentView('/c');
    setGiftsView(1.5);
    recordCurrentView('/b');
    expect(previousViewPath()).toBe('/c');
    resetViewHistory();
    window.history.replaceState(null, '');
    recordCurrentView('/a');
    recordCurrentView('/b');
    setGiftsView(-1);
    recordCurrentView('/a');
    expect(previousViewPath()).toBe('/b');
    resetViewHistory();
    window.history.replaceState(null, '');
    recordCurrentView('/a');
    recordCurrentView('/b');
    setGiftsView(9);
    recordCurrentView('/z');
    expect(previousViewPath()).toBe('/b');
    resetViewHistory();
    window.history.replaceState(null, '');
    recordCurrentView('/a');
    recordCurrentView('/b');
    recordCurrentView('/c');
    setGiftsView(0);
    recordCurrentView('/z');
    expect(stored()?.stack).toEqual(['/a', '/b', '/c', '/z']);
  });

  it('drops the oldest path after 51 pushes and does not treat stamp 0 as the original first path', () => {
    for (let index = 0; index < 51; index += 1) {
      recordCurrentView(`/p${index}`);
    }
    expect(stored()?.stack[0]).toBe('/p1');
    expect(stored()?.stack).toHaveLength(50);
    setGiftsView(0);
    recordCurrentView('/p0');
    expect(previousViewPath()).toBe('/p50');
    expect(stored()?.stack[0]).not.toBe('/p0');
    expect(stored()?.cursor).toBe(49);
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
    expect(readSlot()).toEqual({ stack: [], cursor: 0 });
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
    recordCurrentView('/shops');
    recordCurrentView('/notifications');
    expect(previousViewPath()).toBe('/shops');
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    recordCurrentView('/map');
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
  it('assigns /welcome and does not call history.back when the stack is empty', () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { assign });
    const restoreLength = setHistoryLength(5);
    const historyBack = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
    goToPreviousView();
    expect(assign).toHaveBeenCalledWith('/welcome');
    expect(historyBack).not.toHaveBeenCalled();
    restoreLength();
  });

  it('calls history.back when the previous view is stamped and history has more than one entry', () => {
    recordCurrentView('/shops');
    recordCurrentView('/notifications');
    setGiftsView(1);
    const assign = vi.fn();
    vi.stubGlobal('location', { assign });
    const restoreLength = setHistoryLength(2);
    const historyBack = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
    goToPreviousView();
    expect(historyBack).toHaveBeenCalledTimes(1);
    expect(assign).not.toHaveBeenCalled();
    restoreLength();
  });

  it('assigns the previous path when the stamp is missing', () => {
    recordCurrentView('/shops');
    recordCurrentView('/notifications');
    setGiftsView(undefined);
    const assign = vi.fn();
    vi.stubGlobal('location', { assign });
    const restoreLength = setHistoryLength(5);
    const historyBack = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
    goToPreviousView();
    expect(assign).toHaveBeenCalledWith('/shops');
    expect(historyBack).not.toHaveBeenCalled();
    restoreLength();
  });

  it('assigns the previous path when the stamp is 0', () => {
    recordCurrentView('/shops');
    recordCurrentView('/notifications');
    setGiftsView(0);
    const assign = vi.fn();
    vi.stubGlobal('location', { assign });
    const restoreLength = setHistoryLength(5);
    const historyBack = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
    goToPreviousView();
    expect(assign).toHaveBeenCalledWith('/shops');
    expect(historyBack).not.toHaveBeenCalled();
    restoreLength();
  });

  it('assigns the previous path when the stamp is set but history.length is 1', () => {
    recordCurrentView('/shops');
    recordCurrentView('/notifications');
    setGiftsView(1);
    const assign = vi.fn();
    vi.stubGlobal('location', { assign });
    const restoreLength = setHistoryLength(1);
    const historyBack = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
    goToPreviousView();
    expect(assign).toHaveBeenCalledWith('/shops');
    expect(historyBack).not.toHaveBeenCalled();
    restoreLength();
  });
});

describe('resetViewHistory', () => {
  it('clears the slot and the session key', () => {
    recordCurrentView('/shops');
    recordCurrentView('/notifications');
    resetViewHistory();
    expect(previousViewPath()).toBeNull();
    expect(sessionStorage.getItem(HISTORY_KEY)).toBeNull();
    expect(readSlot()).toBeUndefined();
  });
});
