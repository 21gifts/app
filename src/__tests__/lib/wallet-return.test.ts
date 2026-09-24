import { afterEach, describe, expect, it, vi } from 'vitest';
import { rememberWalletReturn, resetWalletReturn, walletBackHref } from '@/lib/wallet-return';

afterEach(() => {
  resetWalletReturn();
});

describe('walletBackHref', () => {
  it('is /welcome before any remember', () => {
    expect(walletBackHref()).toBe('/welcome');
  });
});

describe('rememberWalletReturn', () => {
  it('accepts a member profile path', () => {
    rememberWalletReturn('/members/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    expect(walletBackHref()).toBe('/members/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
  });

  it('accepts a query string', () => {
    rememberWalletReturn('/messages?c=abc');
    expect(walletBackHref()).toBe('/messages?c=abc');
  });

  it('accepts a query that URLSearchParams would emit', () => {
    rememberWalletReturn('/messages?q=a+b*c');
    expect(walletBackHref()).toBe('/messages?q=a+b*c');
  });

  it('accepts /wallets and /wallet-backup', () => {
    rememberWalletReturn('/wallets');
    expect(walletBackHref()).toBe('/wallets');
    rememberWalletReturn('/wallet-backup');
    expect(walletBackHref()).toBe('/wallet-backup');
  });

  it('accepts a 512-character safe path', () => {
    const path = `/${'a'.repeat(511)}`;
    rememberWalletReturn(path);
    expect(walletBackHref()).toBe(path);
  });

  it('does not clobber a previous path with Wallet itself', () => {
    const previous = '/members/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    rememberWalletReturn(previous);
    rememberWalletReturn('/wallet');
    expect(walletBackHref()).toBe(previous);
    rememberWalletReturn('/wallet?x=1');
    expect(walletBackHref()).toBe(previous);
    rememberWalletReturn('/wallet/phrase');
    expect(walletBackHref()).toBe(previous);
  });

  it('does not clobber a previous path with an unsafe candidate', () => {
    rememberWalletReturn('/profile');
    const unsafe = [
      'https://evil.example',
      '//evil',
      '/foo/../bar',
      '../x',
      '',
      `/${'a'.repeat(512)}`,
      '/a\\b',
      '/foo bar',
      '/foo#bar',
      '/foo!',
    ];
    for (const path of unsafe) {
      rememberWalletReturn(path);
      expect(walletBackHref()).toBe('/profile');
    }
  });

  it('replaces a previous accepted path', () => {
    rememberWalletReturn('/profile');
    rememberWalletReturn('/shops');
    expect(walletBackHref()).toBe('/shops');
  });
});

describe('resetWalletReturn', () => {
  it('returns /welcome after a remembered path', () => {
    rememberWalletReturn('/profile');
    resetWalletReturn();
    expect(walletBackHref()).toBe('/welcome');
    expect(sessionStorage.getItem('21gifts.walletReturn')).toBeNull();
  });
});

describe('tab storage', () => {
  const slot = '__giftsWalletReturn';

  function dropSlot(): void {
    delete (globalThis as { [slot]?: unknown })[slot];
  }

  it('keeps the path in sessionStorage when Wallet is rejected', () => {
    rememberWalletReturn('/shops');
    rememberWalletReturn('/wallet');
    expect(sessionStorage.getItem('21gifts.walletReturn')).toBe('/shops');
  });

  it('reads a stored path after the shared slot is gone', () => {
    sessionStorage.setItem('21gifts.walletReturn', '/map');
    dropSlot();
    expect(walletBackHref()).toBe('/map');
  });

  it('ignores an unsafe stored path', () => {
    sessionStorage.setItem('21gifts.walletReturn', 'https://evil.example');
    dropSlot();
    expect(walletBackHref()).toBe('/welcome');
  });

  it('ignores a sessionStorage getter that throws', () => {
    dropSlot();
    const storage = window.sessionStorage;
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      get() {
        throw new Error('denied');
      },
    });
    expect(walletBackHref()).toBe('/welcome');
    expect(() => rememberWalletReturn('/map')).not.toThrow();
    Object.defineProperty(window, 'sessionStorage', { configurable: true, value: storage });
    dropSlot();
  });

  it('ignores a storage read that throws', () => {
    dropSlot();
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(walletBackHref()).toBe('/welcome');
    getItem.mockRestore();
  });

  it('keeps the path in memory when storage writes throw', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    rememberWalletReturn('/pos');
    expect(walletBackHref()).toBe('/pos');
    setItem.mockRestore();
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(() => resetWalletReturn()).not.toThrow();
    removeItem.mockRestore();
  });
});
