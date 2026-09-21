import { entropyToMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';

/** UTF-8 input whose SHA-256 digest is the WebAuthn PRF eval.first salt. */
export const PRF_EVAL_FIRST_SALT_UTF8 = '21gifts-nostr-v1';

/** HKDF-SHA-256 salt for turning PRF output into BIP-39 entropy. */
export const MNEMONIC_HKDF_SALT_UTF8 = '21gifts-seed-derivation';

/** HKDF-SHA-256 info for mnemonic entropy. */
export const MNEMONIC_HKDF_INFO_UTF8 = 'mnemonic-v1';

/** BIP-39 entropy length in bits (12 English words). */
export const MNEMONIC_ENTROPY_BITS = 128;

function toUint8Array(data: BufferSource): Uint8Array {
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  throw new TypeError('expected BufferSource');
}

/**
 * SHA-256 of UTF-8 `21gifts-nostr-v1` — the PRF eval.first salt (same bytes as
 * the API `prfEvalFirstSalt`).
 *
 * @returns 32 salt bytes.
 */
export async function prfEvalFirstSalt(): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(PRF_EVAL_FIRST_SALT_UTF8),
  );
  return new Uint8Array(digest);
}

/**
 * Read `prf.results.first` from a WebAuthn credential's client extension results.
 * Returns `undefined` when the authenticator omitted PRF output.
 *
 * @param credential - Result of `create` or `get`.
 * @returns PRF first bytes, or `undefined`.
 * @throws TypeError when `prf.results.first` is present but not a BufferSource.
 */
export function readPrfFirst(credential: PublicKeyCredential): Uint8Array | undefined {
  const ext = credential.getClientExtensionResults() as {
    prf?: { results?: { first?: BufferSource } };
  };
  const first = ext.prf?.results?.first;
  if (first === undefined || first === null) {
    return undefined;
  }
  return toUint8Array(first);
}

/**
 * HKDF-SHA-256 (salt `21gifts-seed-derivation`, info `mnemonic-v1`, 128 bits)
 * over PRF eval.first, then BIP-39 English 12-word mnemonic.
 *
 * Never send the mnemonic or PRF bytes to the API. Never write them to disk.
 *
 * @param prfFirst - Authenticator `prf.results.first`.
 * @returns Twelve English BIP-39 words.
 */
export async function mnemonicFromPrfFirst(prfFirst: BufferSource): Promise<string> {
  const ikm = Uint8Array.from(toUint8Array(prfFirst));
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new TextEncoder().encode(MNEMONIC_HKDF_SALT_UTF8),
      info: new TextEncoder().encode(MNEMONIC_HKDF_INFO_UTF8),
    },
    key,
    MNEMONIC_ENTROPY_BITS,
  );
  return entropyToMnemonic(new Uint8Array(bits), wordlist);
}

/**
 * Prefer PRF output from `create()`. If missing, run `get()` with
 * `allowCredentials` of the new credential id and `prf.eval.first` = salt.
 * Returns `null` when the authenticator still has no PRF (caller must abort
 * before finish and throw `wallet.prfUnsupported`).
 *
 * @param credential - Result of `navigator.credentials.create`.
 * @returns PRF first bytes, or `null`.
 */
export async function obtainPrfFirst(credential: PublicKeyCredential): Promise<Uint8Array | null> {
  const fromCreate = readPrfFirst(credential);
  if (fromCreate && fromCreate.byteLength > 0) {
    return fromCreate;
  }
  const salt = await prfEvalFirstSalt();
  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rpId: window.location.hostname,
      allowCredentials: [{ type: 'public-key', id: credential.rawId }],
      userVerification: 'required',
      extensions: { prf: { eval: { first: Uint8Array.from(salt) } } },
    },
  })) as PublicKeyCredential | null;
  /* v8 ignore next 3 -- get() null when the authenticator aborts the fallback */
  if (!assertion) {
    return null;
  }
  const fromGet = readPrfFirst(assertion);
  /* v8 ignore next 3 -- empty PRF first is treated as missing */
  if (!fromGet || fromGet.byteLength === 0) {
    return null;
  }
  return fromGet;
}

/**
 * Authenticate with PRF eval.first to re-derive the recovery phrase.
 * Does not contact the API. Discoverable credentials are enough; no assertion
 * is forwarded.
 *
 * @returns PRF first bytes, or `null`.
 */
export async function obtainPrfFirstFromGet(): Promise<Uint8Array | null> {
  const salt = await prfEvalFirstSalt();
  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rpId: window.location.hostname,
      userVerification: 'required',
      extensions: { prf: { eval: { first: Uint8Array.from(salt) } } },
    },
  })) as PublicKeyCredential | null;
  /* v8 ignore next 3 -- get() null when the authenticator aborts */
  if (!assertion) {
    return null;
  }
  const first = readPrfFirst(assertion);
  /* v8 ignore next 3 -- empty PRF first is treated as missing */
  if (!first || first.byteLength === 0) {
    return null;
  }
  return first;
}

/**
 * Classify a WebAuthn failure: timeout shows Try again (no auto-retry);
 * user cancel returns to idle.
 *
 * @param err - Rejection from `create` / `get`.
 * @returns Discriminant for the wallet UI.
 */
export function classifyWebAuthnError(err: unknown): 'timeout' | 'cancel' | 'generic' {
  if (err && typeof err === 'object' && 'name' in err) {
    const name = String((err as { name: string }).name);
    if (name === 'TimeoutError' || name === 'AbortError') {
      return 'timeout';
    }
    if (name === 'NotAllowedError') {
      return 'cancel';
    }
  }
  const message = err instanceof Error ? err.message : String(err ?? '');
  if (/time\s*out/i.test(message)) {
    return 'timeout';
  }
  return 'generic';
}
