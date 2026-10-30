import { wordlist } from '@scure/bip39/wordlists/english';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { startPasskeyAuthentication } from '@/lib/api';
import {
  MNEMONIC_ENTROPY_BITS,
  MNEMONIC_HKDF_INFO_UTF8,
  MNEMONIC_HKDF_SALT_UTF8,
  PRF_EVAL_FIRST_SALT_UTF8,
  classifyWebAuthnError,
  mnemonicFromPrfFirst,
  obtainPrfFirst,
  obtainPrfFirstFromGet,
  prfEvalFirstSalt,
  readPrfFirst,
  rememberCeremonyRpId,
} from '@/lib/prf-mnemonic';

vi.mock('@/lib/api', () => ({
  startPasskeyAuthentication: vi.fn(),
}));

// Existing wallets are derived from these inputs. A failure here means the
// change would give existing passkeys different words: do not update the test.
describe('pinned derivation inputs', () => {
  it('keeps the PRF salt text, HKDF salt and info, and entropy length', () => {
    expect(PRF_EVAL_FIRST_SALT_UTF8).toBe('21gifts-nostr-v1');
    expect(MNEMONIC_HKDF_SALT_UTF8).toBe('21gifts-seed-derivation');
    expect(MNEMONIC_HKDF_INFO_UTF8).toBe('mnemonic-v1');
    expect(MNEMONIC_ENTROPY_BITS).toBe(128);
  });

  it('keeps the PRF eval.first salt bytes', async () => {
    expect(Buffer.from(await prfEvalFirstSalt()).toString('hex')).toBe(
      '7e5cd823b03bfcf258c15de44a83ed49978ebf5de69548ed3f931110912653e7',
    );
  });

  it('derives the known 12 words from a fixed PRF output', async () => {
    const prf = Uint8Array.from({ length: 32 }, (_, i) => i);
    expect(await mnemonicFromPrfFirst(prf)).toBe(
      'access under chronic decline attitude industry sure uncle sauce secret minute frost',
    );
  });

  it('asks the authenticator under the ceremony relying-party id, not the page host', async () => {
    const get = vi.fn().mockResolvedValue({
      getClientExtensionResults: () => ({ prf: { results: { first: new Uint8Array(32) } } }),
    });
    vi.stubGlobal('navigator', { credentials: { get } });
    rememberCeremonyRpId({ rpId: 'rp.test' });
    await obtainPrfFirstFromGet(new Uint8Array([1]));
    await obtainPrfFirst(
      {
        rawId: new Uint8Array([2]).buffer,
        getClientExtensionResults: () => ({}),
      } as unknown as PublicKeyCredential,
      rememberCeremonyRpId({ rp: { id: 'rp.test', name: '21.gifts' } }),
    );
    expect(window.location.hostname).not.toBe('rp.test');
    for (const call of get.mock.calls) {
      expect((call[0] as CredentialRequestOptions).publicKey?.rpId).toBe('rp.test');
    }
    expect(get).toHaveBeenCalledTimes(2);
  });
});

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

describe('rememberCeremonyRpId', () => {
  it('reads rpId of assertion options', () => {
    expect(rememberCeremonyRpId({ rpId: 'a.test', rp: { id: 'b.test' } })).toBe('a.test');
  });

  it('reads rp.id of creation options', () => {
    expect(rememberCeremonyRpId({ rp: { id: 'b.test', name: 'n' } })).toBe('b.test');
  });

  it.each([
    [{}],
    [{ rpId: '' }],
    [{ rpId: 7 }],
    [{ rp: null }],
    [{ rp: 'b.test' }],
    [{ rp: { name: 'n' } }],
    [{ rp: { id: '' } }],
  ])('returns null for %j', (options) => {
    expect(rememberCeremonyRpId(options)).toBeNull();
  });
});

describe('obtainPrfFirst', () => {
  const get = vi.fn();

  function created(first?: Uint8Array): PublicKeyCredential {
    return {
      rawId: new Uint8Array([9]).buffer,
      getClientExtensionResults: () => (first ? { prf: { results: { first } } } : {}),
    } as unknown as PublicKeyCredential;
  }

  function asserted(first?: Uint8Array): PublicKeyCredential {
    return {
      getClientExtensionResults: () => (first ? { prf: { results: { first } } } : {}),
    } as unknown as PublicKeyCredential;
  }

  beforeEach(() => {
    get.mockReset();
    vi.stubGlobal('navigator', { credentials: { get } });
  });

  it('confirms create() PRF output with one get() and returns it', async () => {
    const first = new Uint8Array(32).fill(4);
    get.mockResolvedValue(asserted(first.slice()));
    const credential = created(first);
    const got = await obtainPrfFirst(credential, 'app.test');
    expect(Array.from(got!)).toEqual(Array.from(first));
    expect(get).toHaveBeenCalledTimes(1);
    const arg = get.mock.calls[0]?.[0] as CredentialRequestOptions;
    expect(arg.publicKey?.rpId).toBe('app.test');
    expect(arg.publicKey?.allowCredentials).toEqual([{ type: 'public-key', id: credential.rawId }]);
    expect(arg.publicKey?.userVerification).toBe('required');
    expect(Array.from(arg.publicKey?.extensions?.prf?.eval?.first as Uint8Array)).toEqual(
      Array.from(await prfEvalFirstSalt()),
    );
  });

  it('returns get() PRF output when create() had none', async () => {
    const first = new Uint8Array(32).fill(5);
    get.mockResolvedValue(asserted(first));
    expect(Array.from((await obtainPrfFirst(created(), 'app.test'))!)).toEqual(Array.from(first));
  });

  it('returns get() PRF output when create() gave empty bytes', async () => {
    const first = new Uint8Array(32).fill(6);
    get.mockResolvedValue(asserted(first));
    expect(Array.from((await obtainPrfFirst(created(new Uint8Array()), 'app.test'))!)).toEqual(
      Array.from(first),
    );
  });

  it('returns null when get() differs from create()', async () => {
    get.mockResolvedValue(asserted(new Uint8Array(32).fill(2)));
    expect(await obtainPrfFirst(created(new Uint8Array(32).fill(1)), 'app.test')).toBeNull();
  });

  it('returns null when get() is shorter than create()', async () => {
    get.mockResolvedValue(asserted(new Uint8Array(16).fill(1)));
    expect(await obtainPrfFirst(created(new Uint8Array(32).fill(1)), 'app.test')).toBeNull();
  });

  it('returns null when create() had PRF but get() has none', async () => {
    get.mockResolvedValue(asserted());
    expect(await obtainPrfFirst(created(new Uint8Array(32).fill(1)), 'app.test')).toBeNull();
  });

  it('returns null when get() yields no assertion', async () => {
    get.mockResolvedValue(null);
    expect(await obtainPrfFirst(created(), 'app.test')).toBeNull();
  });

  it('returns null when get() PRF first is empty', async () => {
    get.mockResolvedValue(asserted(new Uint8Array()));
    expect(await obtainPrfFirst(created(), 'app.test')).toBeNull();
  });

  it('returns null without a prompt when the options carried no relying-party id', async () => {
    expect(await obtainPrfFirst(created(new Uint8Array(32).fill(1)), null)).toBeNull();
    expect(get).not.toHaveBeenCalled();
  });
});

describe('obtainPrfFirstFromGet', () => {
  const credentialId = new Uint8Array([9, 8]);
  const get = vi.fn();

  beforeEach(() => {
    get.mockReset();
    vi.mocked(startPasskeyAuthentication).mockReset();
    vi.stubGlobal('navigator', { credentials: { get } });
    rememberCeremonyRpId({});
  });

  it('returns PRF bytes from get() bound to the current credential under the remembered id', async () => {
    const first = new Uint8Array(32).fill(2);
    get.mockResolvedValue({ getClientExtensionResults: () => ({ prf: { results: { first } } }) });
    rememberCeremonyRpId({ rpId: 'app.test' });
    expect(Array.from((await obtainPrfFirstFromGet(credentialId))!)).toEqual(Array.from(first));
    const arg = get.mock.calls[0]?.[0] as CredentialRequestOptions;
    expect(arg.publicKey?.rpId).toBe('app.test');
    expect(arg.publicKey?.userVerification).toBe('required');
    expect(Array.from(arg.publicKey?.allowCredentials?.[0]?.id as Uint8Array)).toEqual(
      Array.from(credentialId),
    );
    expect(startPasskeyAuthentication).not.toHaveBeenCalled();
  });

  it('reads the id from an authentication begin once when no ceremony ran in this tab', async () => {
    const first = new Uint8Array(32).fill(3);
    get.mockResolvedValue({ getClientExtensionResults: () => ({ prf: { results: { first } } }) });
    vi.mocked(startPasskeyAuthentication).mockResolvedValue({
      challengeId: 'c',
      options: { challenge: 'aa', rpId: 'app.test' },
    });
    await obtainPrfFirstFromGet(credentialId);
    await obtainPrfFirstFromGet(credentialId);
    expect(startPasskeyAuthentication).toHaveBeenCalledTimes(1);
    for (const call of get.mock.calls) {
      expect((call[0] as CredentialRequestOptions).publicKey?.rpId).toBe('app.test');
    }
  });

  it('returns null without a prompt when the begin carries no relying-party id', async () => {
    vi.mocked(startPasskeyAuthentication).mockResolvedValue({
      challengeId: 'c',
      options: { challenge: 'aa' },
    });
    expect(await obtainPrfFirstFromGet(credentialId)).toBeNull();
    expect(get).not.toHaveBeenCalled();
  });

  it('rejects when the begin fails', async () => {
    vi.mocked(startPasskeyAuthentication).mockRejectedValue(new Error('offline'));
    await expect(obtainPrfFirstFromGet(credentialId)).rejects.toThrow('offline');
    expect(get).not.toHaveBeenCalled();
  });

  it('returns null when the authenticator omits PRF', async () => {
    rememberCeremonyRpId({ rpId: 'app.test' });
    get.mockResolvedValue({ getClientExtensionResults: () => ({}) });
    expect(await obtainPrfFirstFromGet(credentialId)).toBeNull();
  });

  it('returns null when get yields no assertion', async () => {
    rememberCeremonyRpId({ rpId: 'app.test' });
    get.mockResolvedValue(null);
    expect(await obtainPrfFirstFromGet(credentialId)).toBeNull();
  });

  it('returns null when PRF first is empty', async () => {
    rememberCeremonyRpId({ rpId: 'app.test' });
    get.mockResolvedValue({
      getClientExtensionResults: () => ({ prf: { results: { first: new Uint8Array() } } }),
    });
    expect(await obtainPrfFirstFromGet(credentialId)).toBeNull();
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
