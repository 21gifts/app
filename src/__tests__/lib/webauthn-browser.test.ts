import { describe, expect, it, vi } from 'vitest';
import {
  base64UrlToBytes,
  bytesToBase64Url,
  creationOptionsFromJSON,
  credentialToJSON,
  requestOptionsFromJSON,
} from '@/lib/webauthn-browser';

describe('base64url', () => {
  it('round-trips bytes', () => {
    const bytes = new Uint8Array([1, 2, 3, 250]);
    expect(base64UrlToBytes(bytesToBase64Url(bytes))).toEqual(bytes);
  });

  it('accepts unpadded input', () => {
    expect(base64UrlToBytes('AQID').length).toBeGreaterThan(0);
  });
});

describe('creationOptionsFromJSON', () => {
  it('converts challenge and user id from base64url', () => {
    const options = creationOptionsFromJSON({
      challenge: bytesToBase64Url(new Uint8Array([9, 8, 7])),
      rp: { id: 'localhost', name: '21.gifts' },
      user: {
        id: bytesToBase64Url(new Uint8Array([1, 2])),
        name: 'n',
        displayName: 'd',
      },
      timeout: 60_000,
      attestation: 'none',
      authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
    });
    expect(new Uint8Array(options.challenge as ArrayBuffer)).toEqual(new Uint8Array([9, 8, 7]));
    expect(options.rp.name).toBe('21.gifts');
    expect(options.timeout).toBe(60_000);
    expect(options.attestation).toBe('none');
    expect(options.authenticatorSelection?.residentKey).toBe('required');
    expect(options.pubKeyCredParams).toEqual([{ type: 'public-key', alg: -7 }]);
  });

  it('keeps an explicit pubKeyCredParams list', () => {
    const params = [{ type: 'public-key' as const, alg: -257 }];
    const options = creationOptionsFromJSON({
      challenge: bytesToBase64Url(new Uint8Array([9, 8, 7])),
      rp: { id: 'localhost', name: '21.gifts' },
      user: {
        id: bytesToBase64Url(new Uint8Array([1, 2])),
        name: 'n',
        displayName: 'd',
      },
      pubKeyCredParams: params,
    });
    expect(options.pubKeyCredParams).toEqual(params);
  });

  it('omits optional creation fields when absent', () => {
    const options = creationOptionsFromJSON({
      challenge: 1,
      rp: { name: '21.gifts' },
      user: { id: bytesToBase64Url(new Uint8Array([1])), name: 'n', displayName: 'd' },
    });
    expect(options.timeout).toBeUndefined();
    expect(options.attestation).toBeUndefined();
  });

  it('maps excludeCredentials from base64url ids', () => {
    const options = creationOptionsFromJSON({
      challenge: bytesToBase64Url(new Uint8Array([9, 8, 7])),
      rp: { id: 'localhost', name: '21.gifts' },
      user: {
        id: bytesToBase64Url(new Uint8Array([1, 2])),
        name: 'n',
        displayName: 'd',
      },
      excludeCredentials: [
        {
          type: 'public-key',
          id: bytesToBase64Url(new Uint8Array([9])),
          transports: ['internal', 1],
        },
        { type: 'public-key' },
        { type: 'public-key', id: 1 },
        null,
      ],
    });
    expect(options.excludeCredentials).toHaveLength(1);
    expect(new Uint8Array(options.excludeCredentials?.[0]?.id as ArrayBuffer)).toEqual(
      new Uint8Array([9]),
    );
    expect(options.excludeCredentials?.[0]?.transports).toEqual(['internal']);
  });

  it('throws when excludeCredentials is non-empty but every item is invalid', () => {
    expect(() =>
      creationOptionsFromJSON({
        challenge: bytesToBase64Url(new Uint8Array([9, 8, 7])),
        rp: { id: 'localhost', name: '21.gifts' },
        user: {
          id: bytesToBase64Url(new Uint8Array([1, 2])),
          name: 'n',
          displayName: 'd',
        },
        excludeCredentials: [{ type: 'public-key', id: 1 }],
      }),
    ).toThrow(TypeError);
  });

  it('uses native parseCreationOptionsFromJSON when present', () => {
    const parsed = { challenge: new Uint8Array([1]).buffer } as PublicKeyCredentialCreationOptions;
    const parse = vi.fn().mockReturnValue(parsed);
    vi.stubGlobal('PublicKeyCredential', { parseCreationOptionsFromJSON: parse });
    const json = { challenge: 'AA' };
    expect(creationOptionsFromJSON(json)).toBe(parsed);
    expect(parse).toHaveBeenCalledWith(json);
    vi.unstubAllGlobals();
  });
});

describe('requestOptionsFromJSON', () => {
  it('converts a challenge and rpId', () => {
    const options = requestOptionsFromJSON({
      challenge: bytesToBase64Url(new Uint8Array([4, 5])),
      rpId: 'localhost',
      userVerification: 'required',
      timeout: 30_000,
    });
    expect(new Uint8Array(options.challenge as ArrayBuffer)).toEqual(new Uint8Array([4, 5]));
    expect(options.rpId).toBe('localhost');
    expect(options.userVerification).toBe('required');
    expect(options.allowCredentials).toEqual([]);
  });

  it('maps allowCredentials from base64url ids', () => {
    const options = requestOptionsFromJSON({
      challenge: bytesToBase64Url(new Uint8Array([4, 5])),
      allowCredentials: [{ type: 'public-key', id: bytesToBase64Url(new Uint8Array([7, 8])) }],
    });
    expect(options.allowCredentials).toHaveLength(1);
    expect(new Uint8Array(options.allowCredentials?.[0]?.id as ArrayBuffer)).toEqual(
      new Uint8Array([7, 8]),
    );
  });

  it('throws when allowCredentials is non-empty but every item is invalid', () => {
    expect(() =>
      requestOptionsFromJSON({
        challenge: bytesToBase64Url(new Uint8Array([4, 5])),
        allowCredentials: [{ type: 'public-key', id: 1 }],
      }),
    ).toThrow(TypeError);
  });

  it('omits optional request fields when absent', () => {
    const options = requestOptionsFromJSON({ challenge: 1 });
    expect(options.rpId).toBeUndefined();
    expect(options.timeout).toBeUndefined();
    expect(options.userVerification).toBeUndefined();
  });

  it('uses native parseRequestOptionsFromJSON when present', () => {
    const parsed = { challenge: new Uint8Array([1]).buffer } as PublicKeyCredentialRequestOptions;
    const parse = vi.fn().mockReturnValue(parsed);
    vi.stubGlobal('PublicKeyCredential', { parseRequestOptionsFromJSON: parse });
    const json = { challenge: 'AA' };
    expect(requestOptionsFromJSON(json)).toBe(parsed);
    vi.unstubAllGlobals();
  });
});

describe('credentialToJSON', () => {
  it('uses native toJSON when present', () => {
    const json = { id: 'x' };
    const cred = {
      toJSON: () => json,
    } as unknown as PublicKeyCredential;
    expect(credentialToJSON(cred)).toBe(json);
  });

  it('serialises an attestation response', () => {
    const cred = {
      id: 'cred',
      rawId: new Uint8Array([1]).buffer,
      type: 'public-key',
      getClientExtensionResults: () => ({}),
      response: {
        clientDataJSON: new Uint8Array([2]).buffer,
        attestationObject: new Uint8Array([3]).buffer,
      },
    } as unknown as PublicKeyCredential;
    const json = credentialToJSON(cred);
    expect(json['id']).toBe('cred');
    expect((json['response'] as { attestationObject: string }).attestationObject).toBe(
      bytesToBase64Url(new Uint8Array([3])),
    );
  });

  it('serialises an assertion response including a null userHandle', () => {
    const cred = {
      id: 'cred',
      rawId: new Uint8Array([1]).buffer,
      type: 'public-key',
      getClientExtensionResults: () => ({}),
      response: {
        clientDataJSON: new Uint8Array([2]).buffer,
        authenticatorData: new Uint8Array([3]).buffer,
        signature: new Uint8Array([4]).buffer,
        userHandle: null,
      },
    } as unknown as PublicKeyCredential;
    const json = credentialToJSON(cred);
    expect((json['response'] as { userHandle: null }).userHandle).toBeNull();
  });

  it('serialises an assertion userHandle when present', () => {
    const cred = {
      id: 'cred',
      rawId: new Uint8Array([1]).buffer,
      type: 'public-key',
      getClientExtensionResults: () => ({}),
      response: {
        clientDataJSON: new Uint8Array([2]).buffer,
        authenticatorData: new Uint8Array([3]).buffer,
        signature: new Uint8Array([4]).buffer,
        userHandle: new Uint8Array([5]).buffer,
      },
    } as unknown as PublicKeyCredential;
    const json = credentialToJSON(cred);
    expect((json['response'] as { userHandle: string }).userHandle).toBe(
      bytesToBase64Url(new Uint8Array([5])),
    );
  });
});
