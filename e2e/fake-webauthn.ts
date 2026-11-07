import type { Page } from '@playwright/test';

/**
 * Replaces `navigator.credentials` with a passkey that always succeeds and
 * returns PRF output, so begin → passkey prompt → finish runs without a real
 * authenticator.
 *
 * @param page - The page to install the stub on before it loads.
 * @param alreadyRegistered - When true, `get` returns an assertion right away;
 *   otherwise only after `create` ran once.
 * @returns Resolves when the init script is installed.
 */
export async function installFakeWebAuthn(page: Page, alreadyRegistered = false): Promise<void> {
  await page.addInitScript((registeredStart: boolean) => {
    const pk = globalThis.PublicKeyCredential as unknown as {
      parseCreationOptionsFromJSON?: unknown;
      parseRequestOptionsFromJSON?: unknown;
    };
    if (typeof pk === 'function' || (typeof pk === 'object' && pk !== null)) {
      Object.defineProperty(pk, 'parseCreationOptionsFromJSON', {
        value: undefined,
        configurable: true,
      });
      Object.defineProperty(pk, 'parseRequestOptionsFromJSON', {
        value: undefined,
        configurable: true,
      });
    }
    const rawId = crypto.getRandomValues(new Uint8Array(16)).buffer;
    const idBytes = new Uint8Array(rawId);
    let binary = '';
    for (const byte of idBytes) {
      binary += String.fromCharCode(byte);
    }
    const id = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
    const attestation = {
      id,
      rawId,
      type: 'public-key',
      getClientExtensionResults: () => ({
        prf: { results: { first: new Uint8Array(32).fill(7) } },
      }),
      response: {
        clientDataJSON: new Uint8Array([123]).buffer,
        attestationObject: new Uint8Array([2]).buffer,
      },
    };
    const assertion = {
      ...attestation,
      response: {
        clientDataJSON: new Uint8Array([123]).buffer,
        authenticatorData: new Uint8Array([3]).buffer,
        signature: new Uint8Array([4]).buffer,
        userHandle: null,
      },
    };
    const isBytes = (value: unknown): boolean =>
      value instanceof ArrayBuffer || ArrayBuffer.isView(value);
    let registered = registeredStart;
    Object.defineProperty(navigator, 'credentials', {
      configurable: true,
      value: {
        create: async (options?: CredentialCreationOptions) => {
          const publicKey = options?.publicKey;
          if (!publicKey || !isBytes(publicKey.challenge) || !isBytes(publicKey.user?.id)) {
            throw new Error('invalid creation options');
          }
          registered = true;
          return attestation;
        },
        get: async (options?: CredentialRequestOptions) => {
          const publicKey = options?.publicKey;
          if (!publicKey || !isBytes(publicKey.challenge)) {
            throw new Error('invalid request options');
          }
          if (!registered) {
            throw new DOMException('No credentials', 'NotAllowedError');
          }
          return assertion;
        },
      },
    });
  }, alreadyRegistered);
}
