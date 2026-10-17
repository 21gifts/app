import type { ForumPlaceAddress, ForumPlacePin } from '@/lib/api-types';
import { countryDisplayName, ISO_COUNTRIES } from '@/lib/countries';
import type { MessageKey } from '@/lib/messages';

/** Hashtag name without `#`. */
export const SHOP_HASHTAG = '21GiftsShop';

/** `#21GiftsShop` token (case-insensitive; next char not `[A-Za-z0-9_]`). */
const SHOP_HASHTAG_TOKEN = /#21GiftsShop(?![A-Za-z0-9_])/i;

/** Global form of {@link SHOP_HASHTAG_TOKEN} for replacement. */
const SHOP_HASHTAG_TOKEN_GLOBAL = /#21GiftsShop(?![A-Za-z0-9_])/gi;

/** Minimum shop description length after the shop tag is stripped. */
export const SHOP_DESCRIPTION_MIN = 20;

/** Maximum shop description length after the shop tag is stripped. */
export const SHOP_DESCRIPTION_MAX = 1000;

/** First invalid address field on a shop pin. */
export type ShopAddressProblem = 'street' | 'houseNumber' | 'postalCode' | 'city' | 'country';

/** Exact API 400 bodies mapped to a shop form error. */
export type ShopApiProblem =
  'shopName' | 'shopNameAddress' | 'shopAddress' | 'shopDescription' | 'placeAddress';

/** Visitor-facing catalog key for each {@link ShopApiProblem} API 400 body. */
export const SHOP_API_MESSAGE: Record<ShopApiProblem, MessageKey> = {
  shopName: 'shops.problemName',
  shopNameAddress: 'shops.problemNameAddress',
  shopAddress: 'shops.problemAddress',
  shopDescription: 'shops.problemDescription',
  placeAddress: 'shops.problemAddressInvalid',
};

const HOUSE_NUMBER = /^[0-9][0-9A-Za-z/ .&–-]{0,31}$/;
const POSTAL_CH_LI = /^[0-9]{4}$/;
const POSTAL_OTHER = /^[A-Za-z0-9][A-Za-z0-9 -]{1,15}$/;
const CITY_LETTER = /\p{L}/u;

const SHOP_NAME_REQUIRED = 'Shop name is required';
const SHOP_NAME_CONTAINS_ADDRESS = 'Shop name must not contain the address';
const SHOP_ADDRESS_REQUIRED = 'Shop address is required';
const SHOP_DESCRIPTION_RANGE =
  'Shop description must be 20 to 1000 characters and longer than the shop name';
const PLACE_ADDRESS_INVALID = 'Place address is invalid';

/**
 * True when `text` contains a `#21GiftsShop` token (case-insensitive; next char not `[A-Za-z0-9_]`).
 *
 * @param text - Stored forum post body.
 * @returns Whether the body is a shop note.
 */
export function isShopNote(text: string): boolean {
  return SHOP_HASHTAG_TOKEN.test(text);
}

/**
 * Removes `#21GiftsShop` tokens from display text (case-insensitive).
 *
 * @param text - Stored forum post body.
 * @returns Text without shop hashtag tokens; leftover blank lines collapsed; trimmed.
 */
export function stripShopHashtag(text: string): string {
  return text
    .replace(SHOP_HASHTAG_TOKEN_GLOBAL, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Appends `#21GiftsShop` when `text` is not already a shop note.
 *
 * @param text - Composer or stored body.
 * @returns `text` unchanged when already a shop note; `#21GiftsShop` when blank; otherwise `text` plus `\n\n#21GiftsShop`.
 */
export function ensureShopHashtag(text: string): string {
  if (isShopNote(text)) {
    return text;
  }
  if (text.trim() === '') {
    return `#${SHOP_HASHTAG}`;
  }
  return `${text}\n\n#${SHOP_HASHTAG}`;
}

/**
 * Reject C0 controls and DEL.
 *
 * @param value - Candidate string (trimmed or raw).
 * @returns `true` when every character is allowed.
 */
function hasNoControls(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code < 32 || code === 127) {
      return false;
    }
  }
  return true;
}

function normalizeCountry(raw: string): string | null {
  const country = raw.trim().toUpperCase();
  if (!ISO_COUNTRIES.has(country)) {
    return null;
  }
  return country;
}

function normalizeStreet(raw: string): string | null {
  const street = raw.trim();
  if (street.length < 1 || street.length > 120 || !hasNoControls(street)) {
    return null;
  }
  return street;
}

function normalizeHouseNumber(raw: string): string | null {
  if (!hasNoControls(raw)) {
    return null;
  }
  const houseNumber = raw.trim();
  if (!HOUSE_NUMBER.test(houseNumber)) {
    return null;
  }
  return houseNumber;
}

function normalizePostalCode(raw: string, country: string): string | null {
  if (!hasNoControls(raw)) {
    return null;
  }
  const postalCode = raw.trim();
  const pattern = country === 'CH' || country === 'LI' ? POSTAL_CH_LI : POSTAL_OTHER;
  if (!pattern.test(postalCode)) {
    return null;
  }
  return postalCode;
}

function normalizeCity(raw: string): string | null {
  if (!hasNoControls(raw)) {
    return null;
  }
  const city = raw.trim();
  if (city.length < 1 || city.length > 80 || !CITY_LETTER.test(city)) {
    return null;
  }
  return city;
}

/**
 * First invalid address field, or null when the address matches the API rules.
 *
 * @param address - Structured address, or `null` when every field is empty.
 * @returns `'missing'` when `address` is null, the first bad field, or `null`.
 */
export function shopAddressProblem(
  address: ForumPlaceAddress | null,
): ShopAddressProblem | 'missing' | null {
  if (address === null) {
    return 'missing';
  }
  if (normalizeStreet(address.street) === null) {
    return 'street';
  }
  if (normalizeHouseNumber(address.houseNumber) === null) {
    return 'houseNumber';
  }
  const country = normalizeCountry(address.country);
  if (normalizePostalCode(address.postalCode, country ?? '') === null) {
    return 'postalCode';
  }
  if (normalizeCity(address.city) === null) {
    return 'city';
  }
  if (country === null) {
    return 'country';
  }
  return null;
}

/**
 * Escape a string so it is safe inside a `RegExp` constructor.
 *
 * @param value - Literal token.
 * @returns Escaped pattern.
 */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Whether `name` contains `token` as a standalone word.
 *
 * @param name - Shop name (pin label).
 * @param token - Street or postal code.
 * @returns `true` when the token appears as a whole word.
 */
function containsStandaloneToken(name: string, token: string): boolean {
  const trimmed = token.trim();
  if (trimmed === '') {
    return false;
  }
  const escaped = escapeRegex(trimmed);
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'iu');
  return pattern.test(name);
}

/**
 * Name problem of a shop pin, or null when the name is complete.
 *
 * @param label - Pin label (shop name).
 * @param address - Structured address, or `null` when unset.
 * @returns `'name'` when blank, `'nameAddress'` when it embeds the street or
 * postal code as a whole word, or `null`.
 */
export function shopNameProblem(
  label: string | null,
  address: ForumPlaceAddress | null,
): 'name' | 'nameAddress' | null {
  if (label === null || label.trim() === '') {
    return 'name';
  }
  if (address === null) {
    return null;
  }
  if (
    containsStandaloneToken(label, address.street) ||
    containsStandaloneToken(label, address.postalCode)
  ) {
    return 'nameAddress';
  }
  return null;
}

/**
 * Description problem of a shop note, or null when it is complete.
 *
 * Uses {@link stripShopHashtag} after CRLF is folded to LF. The description
 * must be 20–1000 characters and strictly longer than the pin label.
 *
 * @param text - Composer or stored note text.
 * @param label - Pin label, or `null` when the note has none.
 * @returns `'short'` | `'long'` | `'notLonger'` | `null`.
 */
export function shopDescriptionProblem(
  text: string,
  label: string | null,
): 'short' | 'long' | 'notLonger' | null {
  const lf = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const description = stripShopHashtag(lf);
  const name = label === null ? '' : label;
  if (description.length < SHOP_DESCRIPTION_MIN) {
    return 'short';
  }
  if (description.length > SHOP_DESCRIPTION_MAX) {
    return 'long';
  }
  if (description.length <= name.length || description.toLowerCase() === name.toLowerCase()) {
    return 'notLonger';
  }
  return null;
}

/**
 * Remaining characters needed to reach {@link SHOP_DESCRIPTION_MIN}.
 *
 * @param text - Composer or stored note text.
 * @returns Non-negative count.
 */
export function shopDescriptionRemaining(text: string): number {
  const lf = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const description = stripShopHashtag(lf);
  return Math.max(0, SHOP_DESCRIPTION_MIN - description.length);
}

/**
 * Address line shown on shop pins: street, house, postal, city, country name.
 *
 * @param address - Complete structured address.
 * @param locale - UI locale for the country display name.
 * @returns One line.
 */
export function formatShopAddressLine(address: ForumPlaceAddress, locale: string): string {
  return `${address.street} ${address.houseNumber}, ${address.postalCode} ${address.city}, ${countryDisplayName(address.country, locale)}`;
}

/**
 * Visible text for a forum pin: name and address line, or coordinates.
 *
 * @param place - Stored pin.
 * @param locale - UI locale for the country display name.
 * @returns Link or table cell text.
 */
export function formatPlacePinText(place: ForumPlacePin, locale: string): string {
  const coords = `${place.lat.toFixed(5)}, ${place.lng.toFixed(5)}`;
  const name =
    typeof place.label === 'string' && place.label.trim() !== '' ? place.label.trim() : null;
  const address = place.address;
  if (address !== undefined && address !== null) {
    const line = formatShopAddressLine(address, locale);
    return name === null ? line : `${name} · ${line}`;
  }
  return name ?? coords;
}

/**
 * Whether a shop pin has a valid name and structured address.
 *
 * @param place - Composer pin, or `null` when unset.
 * @returns `true` when both name and address pass the API rules.
 */
export function shopPlaceComplete(place: ForumPlacePin | null): boolean {
  if (place === null) {
    return false;
  }
  const address = place.address ?? null;
  return (
    shopNameProblem(place.label ?? null, address) === null && shopAddressProblem(address) === null
  );
}

/**
 * Map an exact API 400 body to a shop form error, or null.
 *
 * @param message - `Error.message` from `postMessage` / `setMessagePlace`.
 * @returns The matching problem, or `null` when the text is not a shop 400.
 */
export function shopApiProblem(message: string): ShopApiProblem | null {
  if (message === SHOP_NAME_REQUIRED) {
    return 'shopName';
  }
  if (message === SHOP_NAME_CONTAINS_ADDRESS) {
    return 'shopNameAddress';
  }
  if (message === SHOP_ADDRESS_REQUIRED) {
    return 'shopAddress';
  }
  if (message === SHOP_DESCRIPTION_RANGE) {
    return 'shopDescription';
  }
  if (message === PLACE_ADDRESS_INVALID) {
    return 'placeAddress';
  }
  return null;
}
