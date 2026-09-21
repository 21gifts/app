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
 * Copy `options.extensions` onto parsed WebAuthn options and decode a
 * base64url `prf.eval.first` string to bytes for `create()` / `get()`.
 *
 * Native parse already copies extensions; this still decodes a string
 * `prf.eval.first` afterwards. Manual fallback must copy extensions too.
 *
 * @param result - Native parse output or the manual fallback object.
 * @param options - Original api JSON (may include `extensions`).
 * @returns The same `result`, with extensions applied when present.
 */
function applyClientExtensions<T extends { extensions?: AuthenticationExtensionsClientInputs }>(
  result: T,
  options: Record<string, unknown>,
): T {
  const raw = options['extensions'];
  if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
    result.extensions = {
      ...(result.extensions ?? {}),
      ...(raw as AuthenticationExtensionsClientInputs),
    };
  }
  const extensions = result.extensions as
    (AuthenticationExtensionsClientInputs & { prf?: { eval?: { first?: unknown } } }) | undefined;
  const first = extensions?.prf?.eval?.first;
  /* v8 ignore next 12 -- jsdom native parse already yields bytes; string first is only the JSON fallback */
  if (typeof first === 'string') {
    const current = extensions ?? {};
    result.extensions = {
      ...current,
      prf: {
        ...(current.prf ?? {}),
        eval: {
          ...((current.prf as { eval?: object } | undefined)?.eval ?? {}),
          first: Uint8Array.from(base64UrlToBytes(first)),
        },
      },
    };
  }
  return result;
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
    return applyClientExtensions(parse(options), options);
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
  return applyClientExtensions(created, options);
}

type RequestOptionsWithHints = PublicKeyCredentialRequestOptions & {
  hints?: ReadonlyArray<'security-key' | 'client-device' | 'hybrid'>;
};

/**
 * Omit empty `allowCredentials` and set platform hints when discoverable.
 *
 * @param requested - Options from native parse or the manual fallback.
 * @returns The same object, with empty allowCredentials removed and hints set when discoverable.
 */
function finalizeDiscoverableRequestOptions(
  requested: PublicKeyCredentialRequestOptions,
): RequestOptionsWithHints {
  const result = requested as RequestOptionsWithHints;
  if (!Array.isArray(result.allowCredentials) || result.allowCredentials.length === 0) {
    delete result.allowCredentials;
    result.hints = ['client-device'];
  }
  return result;
}

/**
 * Build `PublicKeyCredentialRequestOptions` from api JSON.
 *
 * Omits empty `allowCredentials` (discoverable credentials) and sets
 * `hints: ['client-device']` when discoverable.
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
  const json: Record<string, unknown> = { ...options };
  const allowCredentialsJson = json['allowCredentials'];
  if (Array.isArray(allowCredentialsJson) && allowCredentialsJson.length === 0) {
    delete json['allowCredentials'];
  }
  if ('allowCredentials' in json) {
    credentialDescriptorsFromJSON(json['allowCredentials']);
  }
  if (typeof parse === 'function') {
    return applyClientExtensions(finalizeDiscoverableRequestOptions(parse(json)), json);
  }
  const challenge = json['challenge'];
  const rpId = json['rpId'];
  const timeout = json['timeout'];
  const userVerification = json['userVerification'];
  const allowCredentials = credentialDescriptorsFromJSON(json['allowCredentials']);
  const requested: RequestOptionsWithHints = {
    challenge: Uint8Array.from(base64UrlToBytes(typeof challenge === 'string' ? challenge : '')),
  };
  if (allowCredentials !== undefined && allowCredentials.length > 0) {
    requested.allowCredentials = allowCredentials;
  }
  if (typeof rpId === 'string') {
    requested.rpId = rpId;
  }
  if (typeof timeout === 'number') {
    requested.timeout = timeout;
  }
  if (typeof userVerification === 'string') {
    requested.userVerification = userVerification as UserVerificationRequirement;
  }
  return applyClientExtensions(finalizeDiscoverableRequestOptions(requested), json);
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
 * Drop `prf` from client extension results so finish JSON never carries
 * PRF bytes.
 *
 * @param json - Serialized credential.
 * @returns The same object without `clientExtensionResults.prf`.
 */
function withoutPrfResults(json: Record<string, unknown>): Record<string, unknown> {
  const ext = json['clientExtensionResults'];
  if (ext === null || typeof ext !== 'object' || Array.isArray(ext)) {
    return json;
  }
  const next = { ...(ext as Record<string, unknown>) };
  delete next['prf'];
  return { ...json, clientExtensionResults: next };
}

/**
 * Serialise a `PublicKeyCredential` to the JSON the api expects.
 * Omits PRF output — mnemonic derivation stays in the tab.
 *
 * @param credential - Result of `create` or `get`.
 * @returns JSON matching WebAuthn Level 3 `toJSON()`, without `prf` results.
 */
export function credentialToJSON(credential: PublicKeyCredential): Record<string, unknown> {
  const native = credential as PublicKeyCredential & { toJSON?: () => Record<string, unknown> };
  if (typeof native.toJSON === 'function') {
    return withoutPrfResults(native.toJSON());
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
  return withoutPrfResults(base);
}
