import type { Page } from '@playwright/test';

/** The one message wherever a passkey cannot hold a 21.gifts wallet (no PRF output). */
export const PRF_UNSUPPORTED_MESSAGE =
  'This phone or browser cannot hold a 21.gifts wallet. Please use an up-to-date phone or browser that supports passkeys.';

/** Register begin options for a new passkey whose authenticator has no PRF. */
export const NO_PRF_REGISTER_BEGIN = {
  challengeId: 'ch-reg',
  options: {
    challenge: 'aa',
    rp: { name: '21.gifts', id: 'localhost' },
    user: { id: 'aa', name: 'acc', displayName: 'acc' },
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
  },
};

/**
 * A browser whose passkeys work but give no PRF output: login finds no
 * passkey (`NotAllowedError`), create succeeds, and every answer lacks
 * `prf.results`.
 */
export async function installNoPrfWebAuthn(page: Page): Promise<void> {
  await page.addInitScript(() => {
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
    const rawId = new Uint8Array(16).fill(9).buffer;
    const credential = {
      id: 'CQkJCQkJCQkJCQkJCQkJCQ',
      rawId,
      type: 'public-key',
      getClientExtensionResults: () => ({}),
      response: {
        clientDataJSON: new Uint8Array([123]).buffer,
        attestationObject: new Uint8Array([2]).buffer,
        authenticatorData: new Uint8Array([3]).buffer,
        signature: new Uint8Array([4]).buffer,
        userHandle: null,
      },
    };
    let created = false;
    Object.defineProperty(navigator, 'credentials', {
      configurable: true,
      value: {
        create: async () => {
          created = true;
          return credential;
        },
        get: async () => {
          if (!created) {
            throw new DOMException('No credentials', 'NotAllowedError');
          }
          return credential;
        },
      },
    });
  });
}
