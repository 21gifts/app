import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  passkeyRenewClientCapabilities,
  passkeyRenewDebug,
  passkeyRenewDebugFields,
} from '@/lib/passkey-renew-debug';

afterEach(() => {
  vi.unstubAllGlobals();
});

function credential(parts: Record<string, unknown>): PublicKeyCredential {
  return parts as unknown as PublicKeyCredential;
}

describe('passkeyRenewDebug', () => {
  it('reads public authenticator facts and drops PRF bytes', () => {
    const bytes = new Uint8Array(53);
    bytes[32] = 0x40;
    bytes[37] = 0xab;
    bytes[52] = 0xcd;
    const debug = passkeyRenewDebug(
      credential({
        authenticatorAttachment: 'cross-platform',
        response: {
          getTransports: () => ['usb', 'internal', 'cable'],
          getAuthenticatorData: () =>
            bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
          getPublicKeyAlgorithm: () => -7,
        },
        getClientExtensionResults: () => ({
          prf: { enabled: false, results: { first: new Uint8Array([1, 2, 3]) } },
          credProps: { rk: true },
          hmacCreateSecret: false,
          credProtect: 'userVerificationRequired',
          secret: { first: new Uint8Array([9]) },
        }),
      }),
      null,
    );
    expect(debug).toEqual({
      authenticatorAttachment: 'cross-platform',
      transports: 'internal,usb',
      aaguid: `ab${'00'.repeat(14)}cd`,
      prfEnabled: false,
      prfPresent: true,
      extensions: 'credProps,credProtect,hmacCreateSecret,prf',
      authenticatorFlags: 0x40,
      publicKeyAlgorithm: -7,
      residentKey: true,
      hmacSecret: false,
      credProtect: 'userVerificationRequired',
    });
    expect(JSON.stringify(debug)).not.toContain('"1,2,3"');
    expect(passkeyRenewDebugFields(debug)).toEqual(debug);
  });

  it('keeps an explicit missing PRF, a zero flags byte, and a numeric policy', () => {
    const bytes = new Uint8Array(33);
    bytes[32] = 0;
    const debug = passkeyRenewDebug(
      credential({
        authenticatorAttachment: 'platform',
        response: {
          getTransports: () => ['cable'],
          getAuthenticatorData: () => bytes,
          getPublicKeyAlgorithm: () => -65536,
        },
        getClientExtensionResults: () => ({
          prf: { enabled: true, results: { first: new Uint8Array([1]) } },
          credProps: { rk: false },
          hmacCreateSecret: { hmacCreateSecret: true },
          credProtect: 2,
        }),
      }),
      false,
    );
    expect(debug.prfPresent).toBe(false);
    expect(debug.prfEnabled).toBe(true);
    expect(debug.authenticatorFlags).toBe(0);
    expect(debug.aaguid).toBeNull();
    expect(debug.transports).toBeNull();
    expect(debug.publicKeyAlgorithm).toBe(-65536);
    expect(debug.residentKey).toBe(false);
    expect(debug.hmacSecret).toBe(true);
    expect(debug.credProtect).toBe('userVerificationOptionalWithCredentialIDList');
    expect(passkeyRenewDebugFields(debug).authenticatorFlags).toBe(0);
  });

  it('nulls missing methods, throws, and values that are not safe', () => {
    const thrown = passkeyRenewDebug(
      credential({
        authenticatorAttachment: 'usb',
        response: {
          getTransports: () => {
            throw new Error('hidden');
          },
          getAuthenticatorData: () => {
            throw new Error('hidden');
          },
          getPublicKeyAlgorithm: () => {
            throw new Error('hidden');
          },
        },
        getClientExtensionResults: () => {
          throw new Error('hidden');
        },
      }),
      null,
    );
    expect(thrown).toMatchObject({
      authenticatorAttachment: null,
      transports: null,
      aaguid: null,
      authenticatorFlags: null,
      publicKeyAlgorithm: null,
      extensions: null,
      prfPresent: null,
    });

    const short = new Uint8Array(32);
    const bare = passkeyRenewDebug(
      credential({
        response: {
          getTransports: () => [],
          getAuthenticatorData: () => short,
          getPublicKeyAlgorithm: () => 1.5,
        },
        getClientExtensionResults: () => ({
          prf: null,
          credProps: { rk: 'yes' },
          hmacCreateSecret: { hmacCreateSecret: 'yes' },
          credProtect: 0,
        }),
      }),
      null,
    );
    expect(bare.transports).toBeNull();
    expect(bare.authenticatorFlags).toBeNull();
    expect(bare.aaguid).toBeNull();
    expect(bare.publicKeyAlgorithm).toBeNull();
    expect(bare.residentKey).toBeNull();
    expect(bare.hmacSecret).toBeNull();
    expect(bare.credProtect).toBeNull();
    expect(bare.extensions).toBe('credProps,credProtect,hmacCreateSecret,prf');

    const attestedShort = new Uint8Array(40);
    attestedShort[32] = 0x40;
    const partial = passkeyRenewDebug(
      credential({
        response: {
          getAuthenticatorData: () => attestedShort,
          getPublicKeyAlgorithm: () => 70000,
        },
        getClientExtensionResults: () => ({
          prf: { enabled: 'no', results: null },
          credentialProtectionPolicy: 'userVerificationOptional',
          hmacCreateSecret: 'no',
          credProps: null,
        }),
      }),
      null,
    );
    expect(partial.aaguid).toBeNull();
    expect(partial.authenticatorFlags).toBe(0x40);
    expect(partial.publicKeyAlgorithm).toBeNull();
    expect(partial.prfEnabled).toBeNull();
    expect(partial.prfPresent).toBeNull();
    expect(partial.credProtect).toBe('userVerificationOptional');
    expect(partial.hmacSecret).toBeNull();
    expect(partial.residentKey).toBeNull();

    const odd = passkeyRenewDebug(
      credential({
        response: {
          getPublicKeyAlgorithm: () => -70000,
        },
        getClientExtensionResults: () => ({
          prf: { results: 1 },
          credProtect: 4,
          credProps: {},
        }),
      }),
      null,
    );
    expect(odd.publicKeyAlgorithm).toBeNull();
    expect(odd.prfPresent).toBeNull();
    expect(odd.credProtect).toBeNull();
    expect(odd.residentKey).toBeNull();

    const code = passkeyRenewDebug(
      credential({
        getClientExtensionResults: () => ({
          prf: { results: {} },
          credProtect: 1.5,
        }),
      }),
      null,
    );
    expect(code.prfPresent).toBe(false);
    expect(code.credProtect).toBeNull();

    const required = passkeyRenewDebug(
      credential({
        getClientExtensionResults: () => ({ credProtect: 3, prf: 'no' }),
      }),
      null,
    );
    expect(required.credProtect).toBe('userVerificationRequired');
    expect(required.prfEnabled).toBeNull();

    expect(passkeyRenewDebug(credential({}), null)).toMatchObject({
      transports: null,
      aaguid: null,
      publicKeyAlgorithm: null,
      extensions: null,
    });
    expect(
      passkeyRenewDebug(
        credential({
          response: {
            getTransports: 'usb',
            getAuthenticatorData: 'no',
            getPublicKeyAlgorithm: () => 'es256',
          },
          getClientExtensionResults: 'no',
        }),
        null,
      ),
    ).toMatchObject({
      transports: null,
      authenticatorFlags: null,
      publicKeyAlgorithm: null,
      extensions: null,
    });
    const unnamed = passkeyRenewDebug(
      credential({
        getClientExtensionResults: () => ({
          notAnExtension: true,
          prf: { results: { first: null } },
        }),
      }),
      null,
    );
    expect(unnamed.extensions).toBe('prf');
    expect(unnamed.prfPresent).toBe(false);
    expect(
      passkeyRenewDebug(
        credential({ getClientExtensionResults: () => ({ notAnExtension: true }) }),
        null,
      ).extensions,
    ).toBeNull();
    expect(passkeyRenewDebug(credential({ response: {} }), null).publicKeyAlgorithm).toBeNull();
    expect(passkeyRenewDebug(null, null)).toEqual({
      authenticatorAttachment: null,
      transports: null,
      aaguid: null,
      prfEnabled: null,
      prfPresent: null,
      extensions: null,
      authenticatorFlags: null,
      publicKeyAlgorithm: null,
      residentKey: null,
      hmacSecret: null,
      credProtect: null,
    });
    expect(passkeyRenewDebugFields(null)).toEqual({});
    expect(passkeyRenewDebugFields(passkeyRenewDebug(null, null))).toEqual({});
  });
});

describe('passkeyRenewClientCapabilities', () => {
  it('returns null when the browser cannot list capabilities', async () => {
    vi.stubGlobal('PublicKeyCredential', undefined);
    await expect(passkeyRenewClientCapabilities()).resolves.toBeNull();
    vi.stubGlobal('PublicKeyCredential', {});
    await expect(passkeyRenewClientCapabilities()).resolves.toBeNull();
    vi.stubGlobal('PublicKeyCredential', {
      getClientCapabilities: () => {
        throw new Error('hidden');
      },
    });
    await expect(passkeyRenewClientCapabilities()).resolves.toBeNull();
    vi.stubGlobal('PublicKeyCredential', {
      getClientCapabilities: async () => null,
    });
    await expect(passkeyRenewClientCapabilities()).resolves.toBeNull();
    vi.stubGlobal('PublicKeyCredential', {
      getClientCapabilities: async () => 'prf',
    });
    await expect(passkeyRenewClientCapabilities()).resolves.toBeNull();
    vi.stubGlobal('PublicKeyCredential', {
      getClientCapabilities: async () => ({ prf: false, 'bad key': true }),
    });
    await expect(passkeyRenewClientCapabilities()).resolves.toBeNull();
  });

  it('keeps true capability names, sorted, and caps the list', async () => {
    vi.stubGlobal('PublicKeyCredential', {
      getClientCapabilities: async () => ({
        prf: true,
        hybridTransport: true,
        conditionalGet: false,
        'bad key': true,
        nested: { a: 1 },
      }),
    });
    await expect(passkeyRenewClientCapabilities()).resolves.toBe('hybridTransport,prf');
    const many: Record<string, boolean> = {};
    for (let i = 0; i < 25; i += 1) {
      many[`c${String(i).padStart(2, '0')}`] = true;
    }
    vi.stubGlobal('PublicKeyCredential', {
      getClientCapabilities: async () => many,
    });
    const capped = await passkeyRenewClientCapabilities();
    expect(capped?.split(',')).toHaveLength(24);
    expect(capped?.endsWith(',c23')).toBe(true);
    expect(capped?.includes('c24')).toBe(false);
  });
});
