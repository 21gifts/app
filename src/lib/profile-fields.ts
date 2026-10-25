/**
 * Exact api rejection when a display name is outside 1–80 characters.
 */
export const DISPLAY_NAME_LENGTH_MESSAGE = 'Name must be 1–80 characters';

/**
 * Exact api rejection when a username is outside the charset or length.
 */
export const USERNAME_FORMAT_MESSAGE =
  'Username must be 1–32 characters of a-z, 0-9, hyphen, underscore, or dot';

/**
 * Exact api rejection when a username is already taken.
 */
export const USERNAME_TAKEN_MESSAGE = 'Username is already in use';

/**
 * Exact api rejection when a location is longer than 80 characters.
 */
export const LOCATION_LENGTH_MESSAGE = 'Location must be at most 80 characters';

/**
 * Exact api rejection when About me is longer than 8000 characters.
 */
export const ABOUT_ME_LENGTH_MESSAGE = 'About me must be at most 8000 characters';

/**
 * Exact api rejection when a Lightning Address is not `name@domain`.
 */
export const LIGHTNING_ADDRESS_FORMAT_MESSAGE =
  'Not a valid Lightning Address (expected name@domain)';

/**
 * Exact api rejection when a Lightning Address does not resolve.
 */
export const LIGHTNING_ADDRESS_UNRESOLVED_MESSAGE = 'Lightning Address could not be resolved';

/**
 * Exact api rejection when a Lightning Address is already taken.
 */
export const LIGHTNING_ADDRESS_TAKEN_MESSAGE = 'Lightning Address is already in use';

/**
 * Visitor copy produced from {@link LIGHTNING_ADDRESS_FORMAT_MESSAGE} before the form sees it.
 */
export const LIGHTNING_ADDRESS_FORMAT_REWRITTEN = 'Enter an address like you@walletofsatoshi.com';

/**
 * Visitor copy produced from {@link LIGHTNING_ADDRESS_UNRESOLVED_MESSAGE} before the form sees it.
 */
export const LIGHTNING_ADDRESS_UNRESOLVED_REWRITTEN =
  'That Wallet of Satoshi address could not be found';

/**
 * Visitor copy produced from {@link LIGHTNING_ADDRESS_TAKEN_MESSAGE} before the form sees it.
 */
export const LIGHTNING_ADDRESS_TAKEN_REWRITTEN = 'Wallet of Satoshi address is already in use';

const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{0,31}$/;
const LIGHTNING_ADDRESS_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/**
 * True when `value` contains a C0 control or DEL. Line breaks stay allowed
 * only for About me, matching the forum-text rule.
 *
 * @param value - Already trimmed text.
 * @param allowLineBreaks - When true, LF and CR are not controls.
 * @returns Whether a rejected control is present.
 */
function hasRejectedControl(value: string, allowLineBreaks: boolean): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code === 127) {
      return true;
    }
    if (code < 32) {
      if (allowLineBreaks && (code === 10 || code === 13)) {
        continue;
      }
      return true;
    }
  }
  return false;
}

/**
 * Username problem, mirroring the api after trim and lowercase.
 *
 * A leading `@` is not removed. Only the shop account field strips one.
 *
 * @param raw - Typed username.
 * @returns `'empty'` after a blank trim, `'format'` when the handle is longer
 * than 32 characters, only `_`, or outside `^[a-z0-9][a-z0-9._-]{0,31}$`,
 * otherwise `null`.
 */
export function usernameProblem(raw: string): 'empty' | 'format' | null {
  const username = raw.trim().toLowerCase();
  if (username === '') {
    return 'empty';
  }
  if (username.length > 32 || username === '_' || !USERNAME_PATTERN.test(username)) {
    return 'format';
  }
  return null;
}

/**
 * Display-name problem, in api order: trim, then empty, then length, then controls.
 *
 * @param raw - Typed display name. Inner spaces stay.
 * @returns `'empty'` when blank after trim, `'long'` over 80 characters,
 * `'controls'` for a character below 32 or DEL, otherwise `null`.
 */
export function displayNameProblem(raw: string): 'empty' | 'long' | 'controls' | null {
  const name = raw.trim();
  if (name === '') {
    return 'empty';
  }
  if (name.length > 80) {
    return 'long';
  }
  if (hasRejectedControl(name, false)) {
    return 'controls';
  }
  return null;
}

/**
 * Location problem. Blank after trim is a valid clear, unlike the display name.
 *
 * @param raw - Typed location. Inner spaces stay.
 * @returns `'long'` over 80 characters, `'controls'` for a character below 32
 * or DEL, otherwise `null`.
 */
export function locationProblem(raw: string): 'long' | 'controls' | null {
  const location = raw.trim();
  if (location === '') {
    return null;
  }
  if (location.length > 80) {
    return 'long';
  }
  if (hasRejectedControl(location, false)) {
    return 'controls';
  }
  return null;
}

/**
 * Lightning Address problem. Length is checked before the shape.
 *
 * @param raw - Typed Wallet of Satoshi address.
 * @returns `'empty'` when blank after trim, `'long'` over 255 characters,
 * `'format'` outside `name@domain.tld`, otherwise `null`.
 */
export function lightningAddressProblem(raw: string): 'empty' | 'long' | 'format' | null {
  const address = raw.trim();
  if (address === '') {
    return 'empty';
  }
  if (address.length > 255) {
    return 'long';
  }
  if (!LIGHTNING_ADDRESS_PATTERN.test(address)) {
    return 'format';
  }
  return null;
}

/**
 * About me text problem, in the same order as forum text: trim, then length, then controls.
 *
 * @param raw - Typed About me note. Inner spaces and line breaks stay.
 * @returns `null` when blank after trim, `'long'` over 8000 characters,
 * `'controls'` for a control other than LF or CR, or for DEL, otherwise `null`.
 */
export function aboutMeTextProblem(raw: string): 'long' | 'controls' | null {
  const text = raw.trim();
  if (text === '') {
    return null;
  }
  if (text.length > 8000) {
    return 'long';
  }
  if (hasRejectedControl(text, true)) {
    return 'controls';
  }
  return null;
}
