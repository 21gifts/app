/**
 * Minimal WebAuthn JSON helpers. No external library: the app talks to
 * `navigator.credentials` directly (CONCEPT). JSON from the api uses base64url
 * for binary fields, which the WebAuthn Level 3 `*FromJSON` / `toJSON` methods
 * accept when present; otherwise we convert by hand.
 */

/**
 * Decode a base64url string to bytes.
 *
 * @param value - Base64url (no padding required).
 * @returns The decoded bytes.
 */
export function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  const binary = atob(`${padded}${pad}`);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Encode bytes as base64url without padding.
 *
 * @param bytes - Raw bytes.
 * @returns Base64url string.
 */
export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
}

/**
 * Build `PublicKeyCredentialCreationOptions` from api JSON.
 *
 * @param options - `PublicKeyCredentialCreationOptionsJSON` from the api.
 * @returns Options for `navigator.credentials.create`.
 */
export function creationOptionsFromJSON(
  options: Record<string, unknown>,
): PublicKeyCredentialCreationOptions {
  const parse = (
    globalThis.PublicKeyCredential as unknown as
      | {
          parseCreationOptionsFromJSON?: (
            json: Record<string, unknown>,
          ) => PublicKeyCredentialCreationOptions;
        }
      | undefined
  )?.parseCreationOptionsFromJSON;
  if (typeof parse === 'function') {
    return parse(options);
  }
  const challenge = options['challenge'];
  const rp = options['rp'] as { name: string; id?: string };
  const user = options['user'] as { id: string; name: string; displayName: string };
  const pubKeyCredParams = options['pubKeyCredParams'] as
    PublicKeyCredentialParameters[] | undefined;
  const authenticatorSelection = options['authenticatorSelection'] as
    AuthenticatorSelectionCriteria | undefined;
  const timeout = options['timeout'];
  const attestation = options['attestation'];
  const created: PublicKeyCredentialCreationOptions = {
    challenge: Uint8Array.from(base64UrlToBytes(typeof challenge === 'string' ? challenge : '')),
    rp,
    user: {
      id: Uint8Array.from(base64UrlToBytes(user.id)),
      name: user.name,
      displayName: user.displayName,
    },
    pubKeyCredParams: pubKeyCredParams ?? [{ type: 'public-key', alg: -7 }],
  };
  if (authenticatorSelection !== undefined) {
    created.authenticatorSelection = authenticatorSelection;
  }
  if (typeof timeout === 'number') {
    created.timeout = timeout;
  }
  if (typeof attestation === 'string') {
    created.attestation = attestation as AttestationConveyancePreference;
  }
  return created;
}

/**
 * Build `PublicKeyCredentialRequestOptions` from api JSON.
 *
 * @param options - `PublicKeyCredentialRequestOptionsJSON` from the api.
 * @returns Options for `navigator.credentials.get`.
 */
export function requestOptionsFromJSON(
  options: Record<string, unknown>,
): PublicKeyCredentialRequestOptions {
  const parse = (
    globalThis.PublicKeyCredential as unknown as
      | {
          parseRequestOptionsFromJSON?: (
            json: Record<string, unknown>,
          ) => PublicKeyCredentialRequestOptions;
        }
      | undefined
  )?.parseRequestOptionsFromJSON;
  if (typeof parse === 'function') {
    return parse(options);
  }
  const challenge = options['challenge'];
  const rpId = options['rpId'];
  const timeout = options['timeout'];
  const userVerification = options['userVerification'];
  const requested: PublicKeyCredentialRequestOptions = {
    challenge: Uint8Array.from(base64UrlToBytes(typeof challenge === 'string' ? challenge : '')),
    allowCredentials: [],
  };
  if (typeof rpId === 'string') {
    requested.rpId = rpId;
  }
  if (typeof timeout === 'number') {
    requested.timeout = timeout;
  }
  if (typeof userVerification === 'string') {
    requested.userVerification = userVerification as UserVerificationRequirement;
  }
  return requested;
}

/**
 * Serialise a `PublicKeyCredential` to the JSON the api expects.
 *
 * @param credential - Result of `create` or `get`.
 * @returns JSON matching WebAuthn Level 3 `toJSON()`.
 */
export function credentialToJSON(credential: PublicKeyCredential): Record<string, unknown> {
  const native = credential as PublicKeyCredential & { toJSON?: () => Record<string, unknown> };
  if (typeof native.toJSON === 'function') {
    return native.toJSON();
  }
  const response = credential.response;
  const base: Record<string, unknown> = {
    id: credential.id,
    rawId: bytesToBase64Url(new Uint8Array(credential.rawId)),
    type: credential.type,
    clientExtensionResults: credential.getClientExtensionResults(),
  };
  if ('attestationObject' in response) {
    const attestation = response as AuthenticatorAttestationResponse;
    base['response'] = {
      clientDataJSON: bytesToBase64Url(new Uint8Array(attestation.clientDataJSON)),
      attestationObject: bytesToBase64Url(new Uint8Array(attestation.attestationObject)),
    };
  } else if ('authenticatorData' in response) {
    const assertion = response as AuthenticatorAssertionResponse;
    base['response'] = {
      clientDataJSON: bytesToBase64Url(new Uint8Array(assertion.clientDataJSON)),
      authenticatorData: bytesToBase64Url(new Uint8Array(assertion.authenticatorData)),
      signature: bytesToBase64Url(new Uint8Array(assertion.signature)),
      userHandle:
        assertion.userHandle === null
          ? null
          : bytesToBase64Url(new Uint8Array(assertion.userHandle)),
    };
  }
  return base;
}
