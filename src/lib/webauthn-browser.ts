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
 * @throws TypeError when `excludeCredentials` is present but not an array, or a non-empty list has no valid `public-key` entries.
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
  if ('excludeCredentials' in options) {
    credentialDescriptorsFromJSON(options['excludeCredentials']);
  }
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
  const excludeCredentials = credentialDescriptorsFromJSON(options['excludeCredentials']);
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
  if (excludeCredentials !== undefined) {
    created.excludeCredentials = excludeCredentials;
  }
  return created;
}

/**
 * Build `PublicKeyCredentialRequestOptions` from api JSON.
 *
 * @param options - `PublicKeyCredentialRequestOptionsJSON` from the api.
 * @returns Options for `navigator.credentials.get`.
 * @throws TypeError when `allowCredentials` is present but not an array, or a non-empty list has no valid `public-key` entries.
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
  if ('allowCredentials' in options) {
    credentialDescriptorsFromJSON(options['allowCredentials']);
  }
  if (typeof parse === 'function') {
    return parse(options);
  }
  const challenge = options['challenge'];
  const rpId = options['rpId'];
  const timeout = options['timeout'];
  const userVerification = options['userVerification'];
  const allowCredentials = credentialDescriptorsFromJSON(options['allowCredentials']);
  const requested: PublicKeyCredentialRequestOptions = {
    challenge: Uint8Array.from(base64UrlToBytes(typeof challenge === 'string' ? challenge : '')),
    allowCredentials: allowCredentials ?? [],
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
 * Decode a WebAuthn JSON descriptor list (`id` as base64url) to bytes.
 *
 * @param raw - `allowCredentials` / `excludeCredentials` JSON, or absent.
 * @returns Descriptors, or `undefined` when the field is missing.
 * @throws TypeError when `raw` is present but not an array, or the list is non-empty but no item is a valid descriptor.
 */
function credentialDescriptorsFromJSON(raw: unknown): PublicKeyCredentialDescriptor[] | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (!Array.isArray(raw)) {
    throw new TypeError('WebAuthn credential descriptor list was not an array');
  }
  const descriptors: PublicKeyCredentialDescriptor[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null || !('id' in item) || !('type' in item)) {
      continue;
    }
    const id = (item as { id: unknown }).id;
    const type = (item as { type: unknown }).type;
    if (typeof id !== 'string' || type !== 'public-key') {
      continue;
    }
    let rawId: Uint8Array;
    try {
      rawId = base64UrlToBytes(id);
    } catch {
      continue;
    }
    if (rawId.byteLength === 0) {
      continue;
    }
    const descriptor: PublicKeyCredentialDescriptor = {
      type: 'public-key',
      id: Uint8Array.from(rawId),
    };
    const transports = (item as { transports?: unknown }).transports;
    if (Array.isArray(transports)) {
      descriptor.transports = transports.filter(
        (transport): transport is AuthenticatorTransport => typeof transport === 'string',
      );
    }
    descriptors.push(descriptor);
  }
  if (raw.length > 0 && descriptors.length === 0) {
    throw new TypeError('WebAuthn credential descriptor list had no valid entries');
  }
  return descriptors;
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
