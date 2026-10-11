import { afterEach, describe, expect, it, vi } from 'vitest';
import { MOVE_FUNDS_EVENT, requestMoveFunds, takeMoveFundsRequest } from '@/lib/move-funds';

afterEach(() => {
  vi.restoreAllMocks();
  takeMoveFundsRequest();
  sessionStorage.clear();
});

describe('move-funds request', () => {
  it('remembers a request for the tab, tells open screens, and is taken once', () => {
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

  it('takes a request stored by an earlier document of this tab', () => {
    sessionStorage.setItem('21gifts.moveFunds', 'link');
    expect(takeMoveFundsRequest()).toBe('link');
    expect(sessionStorage.getItem('21gifts.moveFunds')).toBeNull();
    sessionStorage.setItem('21gifts.moveFunds', 'something');
    expect(takeMoveFundsRequest()).toBeNull();
  });

  it('keeps the request in memory when the storage throws', () => {
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
});
