import { afterEach, describe, expect, it } from 'vitest';
import { useWalletStore } from '@/stores/wallet-store';

const ORIGINAL_BREEZ = process.env.NEXT_PUBLIC_BREEZ_API_KEY;
const IDENTITY = `02${'a'.repeat(64)}`;

afterEach(() => {
  if (ORIGINAL_BREEZ === undefined) {
    delete process.env.NEXT_PUBLIC_BREEZ_API_KEY;
  } else {
    process.env.NEXT_PUBLIC_BREEZ_API_KEY = ORIGINAL_BREEZ;
  }
  useWalletStore.getState().reset();
  useWalletStore.getState().setSetupFailedSession(null);
});

describe('useWalletStore', () => {
  it('rests as disabled when the Breez API key is unset', () => {
    delete process.env.NEXT_PUBLIC_BREEZ_API_KEY;
    useWalletStore.getState().reset();
    const state = useWalletStore.getState();
    expect(state.status).toBe('disabled');
    expect(state.balanceSats).toBeNull();
    expect(state.identityPubkey).toBeNull();
  });

  it('rests as locked when the Breez API key is set', () => {
    process.env.NEXT_PUBLIC_BREEZ_API_KEY = 'test-breez-api-key';
    useWalletStore.getState().reset();
    expect(useWalletStore.getState().status).toBe('locked');
  });

  it('setConnecting clears balance fields', () => {
    process.env.NEXT_PUBLIC_BREEZ_API_KEY = 'test-breez-api-key';
    useWalletStore.getState().reset();
    useWalletStore.getState().setReady(21_000, IDENTITY);
    useWalletStore.getState().setConnecting();
    const state = useWalletStore.getState();
    expect(state.status).toBe('connecting');
    expect(state.balanceSats).toBeNull();
    expect(state.identityPubkey).toBeNull();
  });

  it('setReady records balance and identity', () => {
    process.env.NEXT_PUBLIC_BREEZ_API_KEY = 'test-breez-api-key';
    useWalletStore.getState().reset();
    useWalletStore.getState().setReady(21_000, IDENTITY);
    const state = useWalletStore.getState();
    expect(state.status).toBe('ready');
    expect(state.balanceSats).toBe(21_000);
    expect(state.identityPubkey).toBe(IDENTITY);
  });

  it('setReady advances syncCount on every call and reset keeps it', () => {
    process.env.NEXT_PUBLIC_BREEZ_API_KEY = 'test-breez-api-key';
    useWalletStore.getState().reset();
    const before = useWalletStore.getState().syncCount;
    useWalletStore.getState().setReady(21_000, IDENTITY);
    useWalletStore.getState().setReady(21_000, IDENTITY);
    expect(useWalletStore.getState().syncCount).toBe(before + 2);
    useWalletStore.getState().reset();
    expect(useWalletStore.getState().syncCount).toBe(before + 2);
  });

  it('setError clears balance fields', () => {
    process.env.NEXT_PUBLIC_BREEZ_API_KEY = 'test-breez-api-key';
    useWalletStore.getState().reset();
    useWalletStore.getState().setReady(21_000, IDENTITY);
    useWalletStore.getState().setError();
    const state = useWalletStore.getState();
    expect(state.status).toBe('error');
    expect(state.balanceSats).toBeNull();
    expect(state.identityPubkey).toBeNull();
  });

  it('reset returns to the resting status for the current key', () => {
    process.env.NEXT_PUBLIC_BREEZ_API_KEY = 'test-breez-api-key';
    useWalletStore.getState().setReady(21_000, IDENTITY);
    useWalletStore.getState().reset();
    expect(useWalletStore.getState().status).toBe('locked');
    delete process.env.NEXT_PUBLIC_BREEZ_API_KEY;
    useWalletStore.getState().reset();
    expect(useWalletStore.getState().status).toBe('disabled');
  });

  it('records and clears the session whose setup failed', () => {
    useWalletStore.getState().setSetupFailedSession('session-1');
    expect(useWalletStore.getState().setupFailedSession).toBe('session-1');
    useWalletStore.getState().reset();
    expect(useWalletStore.getState().setupFailedSession).toBe('session-1');
    useWalletStore.getState().setSetupFailedSession(null);
    expect(useWalletStore.getState().setupFailedSession).toBeNull();
  });
});
