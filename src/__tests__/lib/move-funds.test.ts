import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Module = typeof import('@/lib/move-funds');

/** A fresh module, as a new document of this tab would load it. */
async function load(): Promise<Module> {
  return import('@/lib/move-funds');
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe('move-funds request', () => {
  it('remembers a request for the tab, tells open screens, and is taken once', async () => {
    const { MOVE_FUNDS_EVENT, requestMoveFunds, takeMoveFundsRequest } = await load();
    const heard = vi.fn();
    window.addEventListener(MOVE_FUNDS_EVENT, heard);
    expect(takeMoveFundsRequest()).toBeNull();
    requestMoveFunds('receive');
    expect(heard).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem('21gifts.moveFunds')).toBe('receive');
    expect(takeMoveFundsRequest()).toBe('receive');
    expect(takeMoveFundsRequest()).toBeNull();
    window.removeEventListener(MOVE_FUNDS_EVENT, heard);
  });

  it('takes a request stored by an earlier document of this tab', async () => {
    const { takeMoveFundsRequest } = await load();
    sessionStorage.setItem('21gifts.moveFunds', 'link');
    expect(takeMoveFundsRequest()).toBe('link');
    expect(sessionStorage.getItem('21gifts.moveFunds')).toBeNull();
    sessionStorage.setItem('21gifts.moveFunds', 'something');
    expect(takeMoveFundsRequest()).toBeNull();
  });

  it('keeps the request in memory when the storage throws', async () => {
    const { requestMoveFunds, takeMoveFundsRequest } = await load();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    requestMoveFunds('link');
    expect(takeMoveFundsRequest()).toBe('link');
    expect(takeMoveFundsRequest()).toBeNull();
  });

  it('keeps a read request when it cannot be removed, and takes it only once in this document', async () => {
    const { requestMoveFunds, takeMoveFundsRequest } = await load();
    sessionStorage.setItem('21gifts.moveFunds', 'link');
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(takeMoveFundsRequest()).toBe('link');
    expect(takeMoveFundsRequest()).toBeNull();
    requestMoveFunds('receive');
    expect(takeMoveFundsRequest()).toBe('receive');
  });
});
