/**
 * Public authenticator facts for a renew report. No credential id,
 * attestation object, challenge, or PRF bytes.
 *
 * `authenticatorFlags` is the WebAuthn flags byte: UP 0x01, UV 0x04,
 * BE 0x08 (synced / backup-eligible), BS 0x10, AT 0x40, ED 0x80.
 */
export interface PasskeyRenewDebug {
  /** Browser attachment, or `null`. */
  authenticatorAttachment: 'platform' | 'cross-platform' | null;
  /** Sorted allowlisted transports, or `null`. */
  transports: string | null;
  /** 32 lowercase hex AAGUID, or `null`. */
  aaguid: string | null;
  /** `prf.enabled` when the browser reported it, or `null`. */
  prfEnabled: boolean | null;
  /** Whether PRF output was present. `null` when unknown. */
  prfPresent: boolean | null;
  /** Sorted allowlisted extension names, or `null`. */
  extensions: string | null;
  /** Flags byte 0–255, or `null` when authenticator data was missing. */
  authenticatorFlags: number | null;
  /** COSE public-key algorithm, or `null`. */
  publicKeyAlgorithm: number | null;
  /** `credProps.rk`, or `null`. */
  residentKey: boolean | null;
  /** hmac-secret (the PRF primitive) supported, or `null`. */
  hmacSecret: boolean | null;
  /** Allowlisted credProtect policy name, or `null`. */
  credProtect: string | null;
}

const TRANSPORTS = new Set(['ble', 'hybrid', 'internal', 'nfc', 'smart-card', 'usb']);
const EXTENSIONS = new Set([
  'credProps',
  'credProtect',
  'credentialProtectionPolicy',
  'hmacCreateSecret',
  'largeBlob',
  'minPinLength',
  'prf',
  'uvm',
]);
const CRED_PROTECT = new Set([
  'userVerificationOptional',
  'userVerificationOptionalWithCredentialIDList',
  'userVerificationRequired',
]);
const CRED_PROTECT_BY_CODE = [
  '',
  'userVerificationOptional',
  'userVerificationOptionalWithCredentialIDList',
  'userVerificationRequired',
] as const;
const CAPABILITY = /^[A-Za-z][A-Za-z0-9]{0,40}$/;
const MAX_CAPABILITIES = 24;

/**
 * Read safe facts from a created passkey. Missing methods and throws become
 * nulls. `prfPresent` argument wins when it is not null.
 *
 * @param credential - Browser credential, or `null` when create threw.
 * @param prfPresent - Known PRF result, or `null` to read the extension flag.
 * @returns Facts the renew report may store.
 */
export function passkeyRenewDebug(
  credential: PublicKeyCredential | null,
  prfPresent: boolean | null,
): PasskeyRenewDebug {
  const empty: PasskeyRenewDebug = {
    authenticatorAttachment: null,
    transports: null,
    aaguid: null,
    prfEnabled: null,
    prfPresent,
    extensions: null,
    authenticatorFlags: null,
    publicKeyAlgorithm: null,
    residentKey: null,
    hmacSecret: null,
    credProtect: null,
  };
  if (credential === null) {
    return empty;
  }
  const attachment = credential.authenticatorAttachment;
  empty.authenticatorAttachment =
    attachment === 'platform' || attachment === 'cross-platform' ? attachment : null;
  empty.transports = transportsOf(credential);
  const facts = authenticatorFacts(credential);
  empty.aaguid = facts.aaguid;
  empty.authenticatorFlags = facts.authenticatorFlags;
  empty.publicKeyAlgorithm = algorithmOf(credential);
  const extensions = extensionsOf(credential);
  empty.extensions = extensions.names;
  empty.prfEnabled = extensions.prfEnabled;
  empty.residentKey = extensions.residentKey;
  empty.hmacSecret = extensions.hmacSecret;
  empty.credProtect = extensions.credProtect;
  if (prfPresent === null) {
    empty.prfPresent = extensions.prfPresent;
  }
  return empty;
}

/** Debug facts with nulls removed, so exact optional report fields stay defined. */
type PresentDebug = {
  [K in keyof PasskeyRenewDebug]?: Exclude<PasskeyRenewDebug[K], null>;
};

/**
 * Drop null debug fields so a report without facts keeps the original body.
 * Zero and false are kept.
 *
 * @param debug - Facts from {@link passkeyRenewDebug}, or `null`.
 * @returns Only the fields that have a value.
 */
export function passkeyRenewDebugFields(debug: PasskeyRenewDebug | null): PresentDebug {
  if (debug === null) {
    return {};
  }
  const fields: PresentDebug = {};
  if (debug.authenticatorAttachment !== null) {
    fields.authenticatorAttachment = debug.authenticatorAttachment;
  }
  if (debug.transports !== null) {
    fields.transports = debug.transports;
  }
  if (debug.aaguid !== null) {
    fields.aaguid = debug.aaguid;
  }
  if (debug.prfEnabled !== null) {
    fields.prfEnabled = debug.prfEnabled;
  }
  if (debug.prfPresent !== null) {
    fields.prfPresent = debug.prfPresent;
  }
  if (debug.extensions !== null) {
    fields.extensions = debug.extensions;
  }
  if (debug.authenticatorFlags !== null) {
    fields.authenticatorFlags = debug.authenticatorFlags;
  }
  if (debug.publicKeyAlgorithm !== null) {
    fields.publicKeyAlgorithm = debug.publicKeyAlgorithm;
  }
  if (debug.residentKey !== null) {
    fields.residentKey = debug.residentKey;
  }
  if (debug.hmacSecret !== null) {
    fields.hmacSecret = debug.hmacSecret;
  }
  if (debug.credProtect !== null) {
    fields.credProtect = debug.credProtect;
  }
  return fields;
}

/**
 * Browser capability names that are strictly true. Objects, false, and
 * odd keys are dropped. This is about the browser, not the passkey.
 *
 * @returns Sorted comma-separated names, or `null`.
 */
export async function passkeyRenewClientCapabilities(): Promise<string | null> {
  const creds = globalThis.PublicKeyCredential as
    { getClientCapabilities?: () => Promise<unknown> } | undefined;
  if (creds === undefined || typeof creds.getClientCapabilities !== 'function') {
    return null;
  }
  try {
    const caps = await creds.getClientCapabilities();
    if (caps === null || typeof caps !== 'object') {
      return null;
    }
    const kept = new Set<string>();
    for (const [key, value] of Object.entries(caps)) {
      if (value === true && CAPABILITY.test(key)) {
        kept.add(key);
      }
    }
    if (kept.size === 0) {
      return null;
    }
    return [...kept].sort().slice(0, MAX_CAPABILITIES).join(',');
  } catch {
    return null;
  }
}

function transportsOf(credential: PublicKeyCredential): string | null {
  const response = credential.response;
  if (
    response === undefined ||
    !('getTransports' in response) ||
    typeof response.getTransports !== 'function'
  ) {
    return null;
  }
  try {
    const raw = response.getTransports();
    const kept = new Set<string>();
    for (const token of raw) {
      if (TRANSPORTS.has(token)) {
        kept.add(token);
      }
    }
    return kept.size === 0 ? null : [...kept].sort().join(',');
  } catch {
    return null;
  }
}

function authenticatorFacts(credential: PublicKeyCredential): {
  aaguid: string | null;
  authenticatorFlags: number | null;
} {
  const response = credential.response;
  if (
    response === undefined ||
    !('getAuthenticatorData' in response) ||
    typeof response.getAuthenticatorData !== 'function'
  ) {
    return { aaguid: null, authenticatorFlags: null };
  }
  try {
    const bytes = new Uint8Array(response.getAuthenticatorData());
    const flags = bytes[32];
    if (flags === undefined) {
      return { aaguid: null, authenticatorFlags: null };
    }
    return { authenticatorFlags: flags, aaguid: aaguidFrom(bytes, flags) };
  } catch {
    return { aaguid: null, authenticatorFlags: null };
  }
}

function aaguidFrom(bytes: Uint8Array, flags: number): string | null {
  if ((flags & 0x40) === 0 || bytes.length < 53) {
    return null;
  }
  return Array.from(bytes.subarray(37, 53), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function algorithmOf(credential: PublicKeyCredential): number | null {
  const response = credential.response;
  if (
    response === undefined ||
    !('getPublicKeyAlgorithm' in response) ||
    typeof response.getPublicKeyAlgorithm !== 'function'
  ) {
    return null;
  }
  try {
    const alg = response.getPublicKeyAlgorithm();
    if (typeof alg !== 'number' || !Number.isInteger(alg) || alg < -65536 || alg > 65535) {
      return null;
    }
    return alg;
  } catch {
    return null;
  }
}

function extensionsOf(credential: PublicKeyCredential): {
  names: string | null;
  prfEnabled: boolean | null;
  prfPresent: boolean | null;
  residentKey: boolean | null;
  hmacSecret: boolean | null;
  credProtect: string | null;
} {
  const empty = {
    names: null,
    prfEnabled: null,
    prfPresent: null,
    residentKey: null,
    hmacSecret: null,
    credProtect: null,
  };
  if (typeof credential.getClientExtensionResults !== 'function') {
    return empty;
  }
  try {
    const results = credential.getClientExtensionResults() as Record<string, unknown>;
    const names = Object.keys(results)
      .filter((name) => EXTENSIONS.has(name))
      .sort();
    const prf = results['prf'];
    let prfEnabled: boolean | null = null;
    let prfPresent: boolean | null = null;
    if (prf !== null && typeof prf === 'object') {
      if ('enabled' in prf && typeof prf.enabled === 'boolean') {
        prfEnabled = prf.enabled;
      }
      if ('results' in prf && prf.results !== null && typeof prf.results === 'object') {
        const first = (prf.results as Record<string, unknown>)['first'];
        prfPresent = first !== undefined && first !== null;
      }
    }
    const protect = results['credProtect'] ?? results['credentialProtectionPolicy'];
    return {
      names: names.length === 0 ? null : names.join(','),
      prfEnabled,
      prfPresent,
      residentKey: residentKeyOf(results['credProps']),
      hmacSecret: hmacSecretOf(results['hmacCreateSecret']),
      credProtect: credProtectOf(protect),
    };
  } catch {
    return empty;
  }
}

function residentKeyOf(value: unknown): boolean | null {
  if (value !== null && typeof value === 'object' && 'rk' in value) {
    const rk = value.rk;
    return typeof rk === 'boolean' ? rk : null;
  }
  return null;
}

function hmacSecretOf(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }
  if (value !== null && typeof value === 'object' && 'hmacCreateSecret' in value) {
    const inner = value.hmacCreateSecret;
    return typeof inner === 'boolean' ? inner : null;
  }
  return null;
}

function credProtectOf(value: unknown): string | null {
  if (typeof value === 'number' && Number.isInteger(value)) {
    const mapped = CRED_PROTECT_BY_CODE[value];
    return mapped === undefined || mapped === '' ? null : mapped;
  }
  if (typeof value === 'string' && CRED_PROTECT.has(value)) {
    return value;
  }
  return null;
}
