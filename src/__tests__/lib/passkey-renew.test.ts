import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchMe, finishPasskeySeed, postPasskeyRenewReport, startPasskeySeed } from '@/lib/api';
import { renewPasskey } from '@/lib/passkey-renew';
import { obtainPrfFirst } from '@/lib/prf-mnemonic';
import { clearSessionPhrase, peekSessionPhrase } from '@/lib/tab-phrase';
import { credentialToJSON } from '@/lib/webauthn-browser';
import { useAuthStore } from '@/stores/auth-store';
import type { Account } from '@/lib/api-types';

const ORIGINAL_BREEZ = process.env.NEXT_PUBLIC_BREEZ_API_KEY;

vi.mock('@/lib/api', () => ({
  startPasskeySeed: vi.fn(),
  finishPasskeySeed: vi.fn(),
  fetchMe: vi.fn(),
  postPasskeyRenewReport: vi.fn(),
}));

vi.mock('@/lib/prf-mnemonic', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/prf-mnemonic')>();
  return {
    ...actual,
    obtainPrfFirst: vi.fn(),
    prfEvalFirstSalt: vi.fn().mockResolvedValue(new Uint8Array(32).fill(1)),
  };
});

vi.mock('@/lib/webauthn-browser', () => ({
  creationOptionsFromJSON: vi.fn().mockReturnValue({ challenge: new ArrayBuffer(1) }),
  credentialToJSON: vi.fn().mockReturnValue({ id: 'cred' }),
}));

const account = {
  id: 'acc_1',
  linkingKey: null,
  role: 'basis',
  name: null,
  location: null,
  lightningAddress: null,
  lightningAddressVerified: false,
  forumLawsDismissed: false,
  createdAt: 1,
  rulesAgreedAt: null,
  viewKey: 'a'.repeat(64),
  aboutMe: null,
  aboutMeHasPhoto: false,
  setup: null,
  missing: [],
  walletRequired: false,
  passkeyCredentialId: null,
} as Account;

beforeEach(() => {
  clearSessionPhrase();
  delete process.env.NEXT_PUBLIC_BREEZ_API_KEY;
  useAuthStore.setState({ session: 'tok', account });
  vi.mocked(startPasskeySeed)
    .mockReset()
    .mockResolvedValue({
      challengeId: 'ch',
      options: { challenge: 'aa' },
    });
  vi.mocked(finishPasskeySeed)
    .mockReset()
    .mockResolvedValue({
      ...account,
      walletRequired: true,
      passkeyCredentialId: 'seed',
    });
  vi.mocked(fetchMe).mockReset().mockResolvedValue(account);
  vi.mocked(postPasskeyRenewReport).mockReset().mockResolvedValue(account);
  vi.mocked(obtainPrfFirst)
    .mockReset()
    .mockResolvedValue(new Uint8Array([7]));
  vi.stubGlobal('navigator', {
    ...navigator,
    credentials: {
      create: vi.fn().mockResolvedValue({ id: 'cred', type: 'public-key' }),
      get: vi.fn(),
    },
  });
  vi.stubGlobal('PublicKeyCredential', undefined);
});

afterEach(() => {
  clearSessionPhrase();
  if (ORIGINAL_BREEZ === undefined) {
    delete process.env.NEXT_PUBLIC_BREEZ_API_KEY;
  } else {
    process.env.NEXT_PUBLIC_BREEZ_API_KEY = ORIGINAL_BREEZ;
  }
  vi.unstubAllGlobals();
  useAuthStore.setState({ session: null, account: null });
});

describe('renewPasskey', () => {
  it('returns the account and PRF bytes without a report', async () => {
    const result = await renewPasskey('tok');
    expect(result).toMatchObject({ outcome: 'ok', account: { passkeyCredentialId: 'seed' } });
    if (result.outcome === 'ok') {
      expect(result.prfFirst).toEqual(new Uint8Array([7]));
    }
    expect(postPasskeyRenewReport).not.toHaveBeenCalled();
  });

  it('does not report an HTTP seed failure and reloads the account', async () => {
    vi.mocked(startPasskeySeed).mockRejectedValueOnce(
      new Error('Failed to start passkey seed: 409'),
    );
    const result = await renewPasskey('tok');
    expect(postPasskeyRenewReport).not.toHaveBeenCalled();
    expect(fetchMe).toHaveBeenCalledWith('tok');
    expect(result).toEqual({ outcome: 'failed', kind: 'generic' });
  });

  it('returns stored when reload already has a seed', async () => {
    vi.mocked(finishPasskeySeed).mockRejectedValueOnce(
      new Error('Failed to finish passkey seed: 500'),
    );
    vi.mocked(fetchMe).mockResolvedValueOnce({ ...account, passkeyCredentialId: 'from-server' });
    const result = await renewPasskey('tok');
    expect(result).toMatchObject({
      outcome: 'stored',
      account: { passkeyCredentialId: 'from-server' },
    });
  });

  it('reports a begin network error and still fails when the report throws', async () => {
    vi.mocked(startPasskeySeed).mockRejectedValueOnce(new TypeError('offline'));
    vi.mocked(postPasskeyRenewReport).mockRejectedValueOnce(new Error('report down'));
    const result = await renewPasskey('tok');
    expect(postPasskeyRenewReport).toHaveBeenCalledWith(
      'tok',
      expect.objectContaining({ stage: 'begin', outcome: 'failed', errorName: 'TypeError' }),
    );
    expect(result).toEqual({ outcome: 'failed', kind: 'generic' });
  });

  it('reports cancel and does not fail the ceremony', async () => {
    const denied = Object.assign(new Error('nope'), { name: 'NotAllowedError', code: 0 });
    vi.mocked(navigator.credentials.create).mockRejectedValueOnce(denied);
    const result = await renewPasskey('tok');
    expect(result).toEqual({ outcome: 'cancelled' });
    expect(postPasskeyRenewReport).toHaveBeenCalledWith(
      'tok',
      expect.objectContaining({
        stage: 'ceremony',
        outcome: 'cancelled',
        errorName: 'NotAllowedError',
        errorCode: '0',
      }),
    );
  });

  it('returns cancelled when the browser returns no credential', async () => {
    vi.mocked(navigator.credentials.create).mockResolvedValueOnce(null);
    await expect(renewPasskey('tok')).resolves.toEqual({ outcome: 'cancelled' });
    expect(postPasskeyRenewReport).not.toHaveBeenCalled();
  });

  it('reports browser capabilities that are true', async () => {
    vi.stubGlobal('PublicKeyCredential', {
      getClientCapabilities: async () => ({
        prf: true,
        hybridTransport: true,
        conditionalGet: false,
      }),
    });
    const denied = Object.assign(new Error('nope'), { name: 'NotAllowedError' });
    vi.mocked(navigator.credentials.create).mockRejectedValueOnce(denied);
    await renewPasskey('tok');
    expect(postPasskeyRenewReport).toHaveBeenCalledWith(
      'tok',
      expect.objectContaining({ clientCapabilities: 'hybridTransport,prf' }),
    );
  });

  it('reports a missing PRF as prfUnsupported', async () => {
    vi.mocked(obtainPrfFirst).mockResolvedValueOnce(null);
    const result = await renewPasskey('tok');
    expect(result).toEqual({ outcome: 'failed', kind: 'prfUnsupported' });
    expect(postPasskeyRenewReport).toHaveBeenCalledWith(
      'tok',
      expect.objectContaining({
        errorName: 'prfUnsupported',
        message: 'wallet.prfUnsupported',
        prfPresent: false,
      }),
    );
  });

  it('cancels when the session changes before the ceremony', async () => {
    vi.mocked(startPasskeySeed).mockImplementation(async () => {
      useAuthStore.setState({ session: null, account: null });
      return { challengeId: 'ch', options: { challenge: 'aa' } };
    });
    await expect(renewPasskey('tok')).resolves.toEqual({ outcome: 'cancelled' });
  });

  it('cancels when the session changes after create', async () => {
    vi.mocked(navigator.credentials.create).mockImplementation(async () => {
      useAuthStore.setState({ session: 'other', account });
      return { id: 'cred', type: 'public-key' } as PublicKeyCredential;
    });
    await expect(renewPasskey('tok')).resolves.toEqual({ outcome: 'cancelled' });
  });

  it('reports a finish network error with a string code', async () => {
    const boom = Object.assign(new Error('socket'), { code: 'ECONNRESET' });
    vi.mocked(finishPasskeySeed).mockRejectedValueOnce(boom);
    const result = await renewPasskey('tok');
    expect(postPasskeyRenewReport).toHaveBeenCalledWith(
      'tok',
      expect.objectContaining({ stage: 'finish', outcome: 'failed', errorCode: 'ECONNRESET' }),
    );
    expect(result).toEqual({ outcome: 'failed', kind: 'generic' });
  });

  it('maps a timeout message and a non-Error throw', async () => {
    vi.mocked(startPasskeySeed).mockRejectedValueOnce('time out');
    const result = await renewPasskey('tok');
    expect(postPasskeyRenewReport).toHaveBeenCalledWith(
      'tok',
      expect.objectContaining({ errorName: 'Error', errorCode: null, message: 'time out' }),
    );
    expect(result).toEqual({ outcome: 'failed', kind: 'timeout' });
  });

  it('stays failed when reload throws', async () => {
    vi.mocked(startPasskeySeed).mockRejectedValueOnce(
      new Error('Failed to start passkey seed: 500'),
    );
    vi.mocked(fetchMe).mockRejectedValueOnce(new Error('down'));
    await expect(renewPasskey('tok')).resolves.toEqual({ outcome: 'failed', kind: 'generic' });
  });

  it('cancels when the session ends during reload', async () => {
    vi.mocked(startPasskeySeed).mockRejectedValueOnce(
      new Error('Failed to start passkey seed: 409'),
    );
    vi.mocked(fetchMe).mockImplementation(async () => {
      useAuthStore.setState({ session: null, account: null });
      return account;
    });
    await expect(renewPasskey('tok')).resolves.toEqual({ outcome: 'cancelled' });
  });

  it('cancels when the session ends after a successful finish', async () => {
    vi.mocked(finishPasskeySeed).mockImplementation(async () => {
      useAuthStore.setState({ session: null, account: null });
      return { ...account, passkeyCredentialId: 'seed' };
    });
    await expect(renewPasskey('tok')).resolves.toEqual({ outcome: 'cancelled' });
  });

  it('cancels when the session ends while the report is in flight', async () => {
    vi.mocked(startPasskeySeed).mockRejectedValueOnce(new TypeError('offline'));
    vi.mocked(postPasskeyRenewReport).mockImplementation(async () => {
      useAuthStore.setState({ session: null, account: null });
      return account;
    });
    await expect(renewPasskey('tok')).resolves.toEqual({ outcome: 'cancelled' });
  });

  it('does not report when the session ends while reading browser capabilities', async () => {
    vi.mocked(startPasskeySeed).mockRejectedValueOnce(new TypeError('offline'));
    vi.stubGlobal('PublicKeyCredential', {
      getClientCapabilities: vi.fn(async () => {
        useAuthStore.setState({ session: null, account: null });
        return { prf: true };
      }),
    });
    await expect(renewPasskey('tok')).resolves.toEqual({ outcome: 'cancelled' });
    expect(postPasskeyRenewReport).not.toHaveBeenCalled();
  });

  it('returns the open failure account after an HTTP seed error', async () => {
    const open = { ...account, passkeyRenewFailed: true };
    vi.mocked(startPasskeySeed).mockRejectedValueOnce(
      new Error('Failed to start passkey seed: 409'),
    );
    vi.mocked(fetchMe).mockResolvedValueOnce(open);
    const result = await renewPasskey('tok');
    expect(postPasskeyRenewReport).not.toHaveBeenCalled();
    expect(result).toEqual({ outcome: 'failed', kind: 'generic', account: open });
  });

  it('returns the open failure account from the report', async () => {
    const open = { ...account, passkeyRenewFailed: true };
    vi.mocked(postPasskeyRenewReport).mockResolvedValueOnce(open);
    vi.mocked(startPasskeySeed).mockRejectedValueOnce(new TypeError('offline'));
    const result = await renewPasskey('tok');
    expect(result).toEqual({ outcome: 'failed', kind: 'generic', account: open });
  });

  it('returns the open failure account from reload when the report throws', async () => {
    const open = { ...account, passkeyRenewFailed: true };
    vi.mocked(startPasskeySeed).mockRejectedValueOnce(new TypeError('offline'));
    vi.mocked(postPasskeyRenewReport).mockRejectedValueOnce(new Error('report down'));
    vi.mocked(fetchMe).mockResolvedValueOnce(open);
    const result = await renewPasskey('tok');
    expect(result).toEqual({ outcome: 'failed', kind: 'generic', account: open });
  });

  it('omits the account id when begin options are not an object', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.mocked(startPasskeySeed)
      .mockResolvedValueOnce({
        challengeId: 'ab'.repeat(32),
        options: null as unknown as Record<string, unknown>,
      })
      .mockResolvedValueOnce({
        challengeId: 'cd'.repeat(32),
        options: 'nope' as unknown as Record<string, unknown>,
      });
    await renewPasskey('tok');
    await renewPasskey('tok');
    const begins = fetchMock.mock.calls
      .map((call) => JSON.parse(String((call[1] as RequestInit).body)) as { event?: string })
      .filter((body) => body.event === 'client.passkey.seed.begin');
    expect(begins).toEqual([
      {
        event: 'client.passkey.seed.begin',
        stage: 'seed',
        challengeId: 'ab'.repeat(32),
      },
      {
        event: 'client.passkey.seed.begin',
        stage: 'seed',
        challengeId: 'cd'.repeat(32),
      },
    ]);
    fetchMock.mockRestore();
  });

  it('ignores a non-string error code and a null throw', async () => {
    vi.mocked(startPasskeySeed).mockRejectedValueOnce({ name: 'Boom', code: true });
    const coded = await renewPasskey('tok');
    expect(postPasskeyRenewReport).toHaveBeenCalledWith(
      'tok',
      expect.objectContaining({ errorName: 'Boom', errorCode: null, message: '[object Object]' }),
    );
    expect(coded).toEqual({ outcome: 'failed', kind: 'generic' });

    vi.mocked(postPasskeyRenewReport).mockClear();
    vi.mocked(startPasskeySeed).mockRejectedValueOnce(null);
    const empty = await renewPasskey('tok');
    expect(postPasskeyRenewReport).toHaveBeenCalledWith(
      'tok',
      expect.objectContaining({ errorName: 'Error', errorCode: null, message: '' }),
    );
    expect(empty).toEqual({ outcome: 'failed', kind: 'generic' });
  });

  it('cancels when the session ends after PRF bytes are missing', async () => {
    vi.mocked(obtainPrfFirst).mockImplementation(async () => {
      useAuthStore.setState({ session: null, account: null });
      return null;
    });
    await expect(renewPasskey('tok')).resolves.toEqual({ outcome: 'cancelled' });
    expect(postPasskeyRenewReport).not.toHaveBeenCalled();
  });

  it('remembers the phrase when the key is set and credential ids match', async () => {
    process.env.NEXT_PUBLIC_BREEZ_API_KEY = 'test-breez-api-key';
    const prfFirst = new Uint8Array(32).fill(7);
    vi.mocked(obtainPrfFirst).mockResolvedValueOnce(prfFirst);
    vi.mocked(finishPasskeySeed).mockResolvedValueOnce({
      ...account,
      walletRequired: true,
      passkeyCredentialId: 'cred',
    });
    const result = await renewPasskey('tok');
    expect(result).toMatchObject({
      outcome: 'ok',
      account: { passkeyCredentialId: 'cred' },
    });
    if (result.outcome === 'ok') {
      expect(result.prfFirst).toEqual(prfFirst);
    }
    expect(peekSessionPhrase()).not.toBeNull();
    expect(finishPasskeySeed).toHaveBeenCalledWith('tok', 'ch', { id: 'cred' });
    expect(credentialToJSON).toHaveBeenCalled();
  });

  it('remembers nothing when the key is unset', async () => {
    const prfFirst = new Uint8Array(32).fill(7);
    vi.mocked(obtainPrfFirst).mockResolvedValueOnce(prfFirst);
    vi.mocked(finishPasskeySeed).mockResolvedValueOnce({
      ...account,
      walletRequired: true,
      passkeyCredentialId: 'cred',
    });
    const result = await renewPasskey('tok');
    expect(result).toMatchObject({ outcome: 'ok', account: { passkeyCredentialId: 'cred' } });
    expect(peekSessionPhrase()).toBeNull();
    expect(finishPasskeySeed).toHaveBeenCalledWith('tok', 'ch', { id: 'cred' });
  });

  it('remembers nothing when the ceremony is cancelled', async () => {
    process.env.NEXT_PUBLIC_BREEZ_API_KEY = 'test-breez-api-key';
    const denied = Object.assign(new Error('nope'), { name: 'NotAllowedError' });
    vi.mocked(navigator.credentials.create).mockRejectedValueOnce(denied);
    await expect(renewPasskey('tok')).resolves.toEqual({ outcome: 'cancelled' });
    expect(peekSessionPhrase()).toBeNull();
  });

  it('remembers nothing when the ceremony fails', async () => {
    process.env.NEXT_PUBLIC_BREEZ_API_KEY = 'test-breez-api-key';
    vi.mocked(obtainPrfFirst).mockResolvedValueOnce(null);
    await expect(renewPasskey('tok')).resolves.toMatchObject({
      outcome: 'failed',
      kind: 'prfUnsupported',
    });
    expect(peekSessionPhrase()).toBeNull();
  });
});
