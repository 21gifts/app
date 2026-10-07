/**
 * BIP-173 bech32 encoding of a cleartext URL with HRP `lnurl`.
 *
 * Not bech32m. The result is returned uppercase for an Open CryptoPay
 * `lightning` query parameter.
 */

const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const GENERATOR = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];

function polymod(values: number[]): number {
  let chk = 1;
  for (const value of values) {
    const b = chk >>> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ value;
    for (const [i, gen] of GENERATOR.entries()) {
      chk ^= (b >>> i) & 1 ? gen : 0;
    }
  }
  return chk;
}

function hrpExpand(hrp: string): number[] {
  const ret: number[] = [];
  for (let i = 0; i < hrp.length; i += 1) {
    ret.push(hrp.charCodeAt(i) >>> 5);
  }
  ret.push(0);
  for (let i = 0; i < hrp.length; i += 1) {
    ret.push(hrp.charCodeAt(i) & 31);
  }
  return ret;
}

function convert8to5(data: Uint8Array): number[] {
  const ret: number[] = [];
  let acc = 0;
  let bits = 0;
  for (const value of data) {
    acc = (acc << 8) | value;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      ret.push((acc >>> bits) & 31);
    }
  }
  if (bits) {
    ret.push((acc << (5 - bits)) & 31);
  }
  return ret;
}

/**
 * Decode a BIP-173 `lnurl` value into its cleartext URL.
 *
 * @param value - Bech32 LNURL in either uniform casing.
 * @returns The decoded URL, or `null` when the value is invalid.
 */
export function decodeLnurl(value: string): string | null {
  try {
    if (value === '') {
      return null;
    }
    if (value !== value.toLowerCase() && value !== value.toUpperCase()) {
      return null;
    }

    const normalized = value.toLowerCase();
    if ([...normalized].some((char) => char.charCodeAt(0) < 33 || char.charCodeAt(0) > 126)) {
      return null;
    }

    const separator = normalized.lastIndexOf('1');
    if (separator < 1 || separator + 7 > normalized.length) {
      return null;
    }
    const hrp = normalized.slice(0, separator);
    if (hrp !== 'lnurl') {
      return null;
    }

    const values: number[] = [];
    for (const char of normalized.slice(separator + 1)) {
      const index = CHARSET.indexOf(char);
      if (index === -1) {
        return null;
      }
      values.push(index);
    }
    if (polymod([...hrpExpand(hrp), ...values]) !== 1) {
      return null;
    }

    const data = values.slice(0, -6);
    if (data.length === 0) {
      return null;
    }

    const bytes: number[] = [];
    let acc = 0;
    let bits = 0;
    for (const word of data) {
      acc = (acc << 5) | word;
      bits += 5;
      while (bits >= 8) {
        bits -= 8;
        bytes.push((acc >>> bits) & 0xff);
      }
    }
    // encodeLnurl never emits a checksum that still has leftover 5-bit padding
    // or bytes that are not UTF-8. Both rejects stay for hostile input.
    /* v8 ignore next 8 */
    if (bits >= 5 || ((acc << (8 - bits)) & 0xff) !== 0) {
      return null;
    }

    return new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes));
  } catch {
    return null;
  }
}

/**
 * BIP-173 bech32 (not bech32m) of `url` with HRP `lnurl`, returned UPPERCASE.
 *
 * @param url - Cleartext URL.
 * @returns Uppercase `LNURL1…`.
 */
export function encodeLnurl(url: string): string {
  const hrp = 'lnurl';
  const data = convert8to5(new TextEncoder().encode(url));
  const mod = polymod([...hrpExpand(hrp), ...data, 0, 0, 0, 0, 0, 0]) ^ 1;
  const combined = [...data];
  for (let i = 0; i < 6; i += 1) {
    combined.push((mod >>> (5 * (5 - i))) & 31);
  }
  let encoded = `${hrp}1`;
  for (const d of combined) {
    encoded += CHARSET.charAt(d);
  }
  return encoded.toUpperCase();
}
