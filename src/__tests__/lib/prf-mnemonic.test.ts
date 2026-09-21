import { wordlist } from '@scure/bip39/wordlists/english';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  classifyWebAuthnError,
  mnemonicFromPrfFirst,
  obtainPrfFirst,
  obtainPrfFirstFromGet,
  prfEvalFirstSalt,
  readPrfFirst,
} from '@/lib/prf-mnemonic';

describe('prfEvalFirstSalt', () => {
  it('is SHA-256 of UTF-8 21gifts-nostr-v1', async () => {
    const salt = await prfEvalFirstSalt();
    const expected = new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode('21gifts-nostr-v1')),
    );
    expect(Array.from(salt)).toEqual(Array.from(expected));
    expect(salt).toHaveLength(32);
  });
});

describe('mnemonicFromPrfFirst', () => {
  it('returns 12 English BIP-39 words', async () => {
    const prf = new Uint8Array(32).fill(7);
    const mnemonic = await mnemonicFromPrfFirst(prf);
    const words = mnemonic.split(' ');
    expect(words).toHaveLength(12);
    for (const word of words) {
      expect(wordlist.includes(word)).toBe(true);
    }
  });

  it('is deterministic for the same PRF bytes', async () => {
    const prf = new Uint8Array(32).fill(3);
    const a = await mnemonicFromPrfFirst(prf);
    const b = await mnemonicFromPrfFirst(prf.slice());
    expect(a).toBe(b);
  });

  it('accepts ArrayBuffer input', async () => {
    const prf = new Uint8Array(32).fill(9);
    const fromView = await mnemonicFromPrfFirst(prf);
    const fromBuffer = await mnemonicFromPrfFirst(prf.buffer);
    expect(fromView).toBe(fromBuffer);
  });
});

describe('readPrfFirst', () => {
  it('returns undefined when the extension is missing', () => {
    const credential = {
      getClientExtensionResults: () => ({}),
    } as unknown as PublicKeyCredential;
    expect(readPrfFirst(credential)).toBeUndefined();
  });

  it('copies prf.results.first', () => {
    const first = new Uint8Array([1, 2, 3, 4]);
    const credential = {
      getClientExtensionResults: () => ({ prf: { results: { first } } }),
    } as unknown as PublicKeyCredential;
    expect(Array.from(readPrfFirst(credential)!)).toEqual([1, 2, 3, 4]);
  });

  it('rejects a non-BufferSource first value', () => {
    const credential = {
      getClientExtensionResults: () => ({ prf: { results: { first: 7 } } }),
    } as unknown as PublicKeyCredential;
    expect(() => readPrfFirst(credential)).toThrow(TypeError);
  });
});

describe('obtainPrfFirst', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', {
      credentials: {
        get: vi.fn(),
      },
    });
  });

  it('returns create() PRF output without calling get()', async () => {
    const first = new Uint8Array(32).fill(4);
    const credential = {
      rawId: new Uint8Array([9]).buffer,
      getClientExtensionResults: () => ({ prf: { results: { first } } }),
    } as unknown as PublicKeyCredential;
    const got = await obtainPrfFirst(credential);
    expect(Array.from(got!)).toEqual(Array.from(first));
    expect(navigator.credentials.get).not.toHaveBeenCalled();
  });

  it('falls back to get() with allowCredentials and eval.first salt', async () => {
    const first = new Uint8Array(32).fill(5);
    const credential = {
      rawId: new Uint8Array([11]).buffer,
      getClientExtensionResults: () => ({}),
    } as unknown as PublicKeyCredential;
    vi.mocked(navigator.credentials.get).mockResolvedValue({
      getClientExtensionResults: () => ({ prf: { results: { first } } }),
    } as unknown as PublicKeyCredential);
    const got = await obtainPrfFirst(credential);
    expect(Array.from(got!)).toEqual(Array.from(first));
    expect(navigator.credentials.get).toHaveBeenCalledTimes(1);
    const arg = vi.mocked(navigator.credentials.get).mock.calls[0]?.[0] as CredentialRequestOptions;
    expect(arg.publicKey?.allowCredentials?.[0]?.id).toBe(credential.rawId);
    expect(arg.publicKey?.extensions).toHaveProperty('prf');
  });

  it('returns null when get() yields no assertion', async () => {
    const credential = {
      rawId: new Uint8Array([1]).buffer,
      getClientExtensionResults: () => ({}),
    } as unknown as PublicKeyCredential;
    vi.mocked(navigator.credentials.get).mockResolvedValue(null);
    expect(await obtainPrfFirst(credential)).toBeNull();
  });

  it('returns null when get() PRF first is empty', async () => {
    const credential = {
      rawId: new Uint8Array([1]).buffer,
      getClientExtensionResults: () => ({}),
    } as unknown as PublicKeyCredential;
    vi.mocked(navigator.credentials.get).mockResolvedValue({
      getClientExtensionResults: () => ({ prf: { results: { first: new Uint8Array() } } }),
    } as unknown as PublicKeyCredential);
    expect(await obtainPrfFirst(credential)).toBeNull();
  });

  it('returns null when get() still has no PRF', async () => {
    const credential = {
      rawId: new Uint8Array([1]).buffer,
      getClientExtensionResults: () => ({}),
    } as unknown as PublicKeyCredential;
    vi.mocked(navigator.credentials.get).mockResolvedValue({
      getClientExtensionResults: () => ({}),
    } as unknown as PublicKeyCredential);
    expect(await obtainPrfFirst(credential)).toBeNull();
  });
});

describe('obtainPrfFirstFromGet', () => {
  it('returns null when the authenticator omits PRF', async () => {
    vi.stubGlobal('navigator', {
      credentials: { get: vi.fn().mockResolvedValue({ getClientExtensionResults: () => ({}) }) },
    });
    expect(await obtainPrfFirstFromGet()).toBeNull();
  });
});

describe('obtainPrfFirstFromGet', () => {
  it('returns PRF bytes from get()', async () => {
    const first = new Uint8Array(32).fill(2);
    vi.stubGlobal('navigator', {
      credentials: {
        get: vi.fn().mockResolvedValue({
          getClientExtensionResults: () => ({ prf: { results: { first } } }),
        }),
      },
    });
    expect(Array.from((await obtainPrfFirstFromGet())!)).toEqual(Array.from(first));
  });

  it('returns null when get yields no assertion', async () => {
    vi.stubGlobal('navigator', {
      credentials: { get: vi.fn().mockResolvedValue(null) },
    });
    expect(await obtainPrfFirstFromGet()).toBeNull();
  });

  it('returns null when PRF first is empty', async () => {
    vi.stubGlobal('navigator', {
      credentials: {
        get: vi.fn().mockResolvedValue({
          getClientExtensionResults: () => ({ prf: { results: { first: new Uint8Array() } } }),
        }),
      },
    });
    expect(await obtainPrfFirstFromGet()).toBeNull();
  });
});

describe('classifyWebAuthnError', () => {
  it('maps TimeoutError to timeout', () => {
    expect(classifyWebAuthnError(Object.assign(new Error('t'), { name: 'TimeoutError' }))).toBe(
      'timeout',
    );
  });

  it('maps a timeout message to timeout', () => {
    expect(classifyWebAuthnError(new Error('operation timeout'))).toBe('timeout');
  });

  it('maps unknown values to generic', () => {
    expect(classifyWebAuthnError('nope')).toBe('generic');
  });

  it('maps AbortError to timeout', () => {
    expect(classifyWebAuthnError(Object.assign(new Error('a'), { name: 'AbortError' }))).toBe(
      'timeout',
    );
  });

  it('maps null and undefined to generic', () => {
    expect(classifyWebAuthnError(null)).toBe('generic');
    expect(classifyWebAuthnError(undefined)).toBe('generic');
  });

  it('maps NotAllowedError to cancel', () => {
    expect(
      classifyWebAuthnError(Object.assign(new Error('denied'), { name: 'NotAllowedError' })),
    ).toBe('cancel');
  });
});
