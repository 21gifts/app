import { afterEach, describe, expect, it } from 'vitest';
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
  });
});
