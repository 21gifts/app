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

/** Page size enforced by the API's `GET /forum/mentions` suggestion search. */
export const MENTION_SUGGEST_PAGE = 20;

/** Address field on a shop pin. */
export type ShopAddressField = 'street' | 'houseNumber' | 'postalCode' | 'city' | 'country';

/** First invalid address field on a shop pin. */
export type ShopAddressProblem = ShopAddressField;

/** Concrete API-mirrored rule broken by one address field. */
export type ShopAddressFieldProblem =
  | 'required'
  | 'length'
  | 'controls'
  | 'format'
  | 'formatChLi'
  | 'formatOther'
  | 'letter'
  | 'characters'
  | 'invalid';

/** All invalid address fields, so the form can report each one in place. */
export type ShopAddressProblems = Partial<Record<ShopAddressField, ShopAddressFieldProblem>>;

/**
 * Shop form errors: exact API 400 bodies, plus `shopNameControls` and
 * `shopDescriptionControls`, which only the client pre-fee guard sets (the API
 * reports them as the label-length and text-range errors).
 */
export type ShopApiProblem =
  | 'shopName'
  | 'shopNameAddress'
  | 'shopNameLong'
  | 'shopNameControls'
  | 'shopAddress'
  | 'shopDescription'
  | 'shopDescriptionControls'
  | 'placeAddress'
  | 'usernameInvalid'
  | 'usernameMissing';

/** Visitor-facing catalog key for each {@link ShopApiProblem}, from the API or the pre-fee guard. */
export const SHOP_API_MESSAGE: Record<ShopApiProblem, MessageKey> = {
  shopName: 'shops.problemName',
  shopNameAddress: 'shops.problemNameAddress',
  shopNameLong: 'shops.problemNameLong',
  shopNameControls: 'shops.problemNameControls',
  shopAddress: 'shops.problemAddress',
  shopDescription: 'shops.problemDescription',
  shopDescriptionControls: 'shops.problemDescriptionControls',
  placeAddress: 'shops.problemAddressInvalid',
  usernameInvalid: 'login.nameInvalid',
  usernameMissing: 'shops.problemUsernameMissing',
};

/**
 * Whether an unknown value is a mapped shop API problem.
 *
 * @param error - Value to narrow.
 * @returns Whether `error` is a {@link ShopApiProblem} key.
 */
export function isShopApiProblem(error: unknown): error is ShopApiProblem {
  return typeof error === 'string' && Object.hasOwn(SHOP_API_MESSAGE, error);
}

/**
 * Editable field that owns a mapped shop API problem.
 *
 * @param problem - Mapped shop API problem.
 * @returns The place, text, or username field that can correct it.
 */
export function shopProblemField(problem: ShopApiProblem): 'place' | 'text' | 'username' {
  if (problem === 'shopDescription' || problem === 'shopDescriptionControls') {
    return 'text';
  }
  if (problem === 'usernameInvalid' || problem === 'usernameMissing') {
    return 'username';
  }
  return 'place';
}

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
const PLACE_LABEL_LONG = 'Place label must be at most 80 characters';
const USERNAME_INVALID = 'Username is not valid';
const USERNAME_MISSING = 'No account with that username';
const TEXT_RANGE = new Set([
  'Text must be 1–8000 characters',
  'Text must be 1–8000 characters or include a photo',
  'Text must be 1–8000 characters or include a photo or video',
]);
const MEDIA_FORMAT_OR_SIZE = new Set([
  'Photo must be a JPEG, PNG, or WebP under 1 MiB',
  'Video must be an MP4, WebM, or MOV under 32 MiB',
  'Poster must be a JPEG, PNG, or WebP under 1 MiB',
]);

/**
 * Map an exact API media rejection to the existing composer pick reason.
 *
 * @param message - `Error.message` from a forum post or shop-photo update.
 * @returns The matching pick reason, or `null` when the text is not a known media rejection.
 */
export function apiMediaProblem(message: string): 'tooMany' | 'formatOrSize' | null {
  if (message === 'At most 10 photos') {
    return 'tooMany';
  }
  return MEDIA_FORMAT_OR_SIZE.has(message) ? 'formatOrSize' : null;
}

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
 * @param value - Trimmed candidate string.
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

function hasNoForumControls(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if ((code < 32 && code !== 10 && code !== 13) || code === 127) {
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
  const houseNumber = raw.trim();
  if (!hasNoControls(houseNumber) || !HOUSE_NUMBER.test(houseNumber)) {
    return null;
  }
  return houseNumber;
}

function normalizePostalCode(raw: string, country: string): string | null {
  const postalCode = raw.trim();
  const pattern = country === 'CH' || country === 'LI' ? POSTAL_CH_LI : POSTAL_OTHER;
  if (!hasNoControls(postalCode) || !pattern.test(postalCode)) {
    return null;
  }
  return postalCode;
}

function normalizeCity(raw: string): string | null {
  const city = raw.trim();
  if (city.length < 1 || city.length > 80 || !hasNoControls(city) || !CITY_LETTER.test(city)) {
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
 * Every invalid address field and the concrete API-mirrored rule it breaks.
 *
 * @param address - Structured address, or `null` when every field is empty.
 * @returns A sparse result keyed by each invalid field.
 */
export function shopAddressProblems(address: ForumPlaceAddress | null): ShopAddressProblems {
  const problems: ShopAddressProblems = {};
  const value = address ?? { street: '', houseNumber: '', postalCode: '', city: '', country: '' };
  const street = value.street.trim();
  if (street === '') problems.street = 'required';
  else if (street.length > 120) problems.street = 'length';
  else if (!hasNoControls(street)) problems.street = 'controls';

  const houseNumber = value.houseNumber.trim();
  if (houseNumber === '') problems.houseNumber = 'required';
  else if (!hasNoControls(houseNumber)) problems.houseNumber = 'controls';
  else if (!/^[0-9]/.test(houseNumber)) problems.houseNumber = 'format';
  else if (houseNumber.length > 32) problems.houseNumber = 'length';
  else if (!HOUSE_NUMBER.test(houseNumber)) problems.houseNumber = 'characters';

  const country = normalizeCountry(value.country);
  const postalCode = value.postalCode.trim();
  if (postalCode === '') problems.postalCode = 'required';
  else if (!hasNoControls(postalCode)) problems.postalCode = 'controls';
  else if ((country === 'CH' || country === 'LI') && !POSTAL_CH_LI.test(postalCode)) {
    problems.postalCode = 'formatChLi';
  } else if (country !== 'CH' && country !== 'LI' && !POSTAL_OTHER.test(postalCode)) {
    problems.postalCode = 'formatOther';
  }

  const city = value.city.trim();
  if (city === '') problems.city = 'required';
  else if (city.length > 80) problems.city = 'length';
  else if (!hasNoControls(city)) problems.city = 'controls';
  else if (!CITY_LETTER.test(city)) problems.city = 'letter';

  if (value.country.trim() === '') problems.country = 'required';
  else if (country === null) problems.country = 'invalid';
  return problems;
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
  const pattern = new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'iu');
  return pattern.test(name);
}

/**
 * Name problem of a shop pin, or null when the name is complete.
 *
 * @param label - Pin label (shop name); `null` or `undefined` when unset.
 * @param address - Structured address; `null` or `undefined` when unset.
 * @returns A required, length, control-character, or embedded-address problem;
 * otherwise `null`.
 */
export function shopNameProblem(
  label: string | null | undefined,
  address: ForumPlaceAddress | null | undefined,
): 'name' | 'nameAddress' | 'nameLong' | 'nameControls' | null {
  if (label === null || label === undefined || label.trim() === '') {
    return 'name';
  }
  if (label.trim().length > 80) {
    return 'nameLong';
  }
  if (!hasNoControls(label.trim())) {
    return 'nameControls';
  }
  if (address === null || address === undefined) {
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
 * Shop text as the description rule measures it.
 *
 * @param text - Composer or stored note text.
 * @returns The text with CRLF and lone CR folded to LF, then passed through
 * {@link stripShopHashtag}.
 */
export function shopDescriptionText(text: string): string {
  return stripShopHashtag(text.replace(/\r\n/g, '\n').replace(/\r/g, '\n'));
}

/**
 * Description problem of a shop note, or null when it is complete.
 *
 * Measures {@link shopDescriptionText}. The description
 * must be 20–1000 characters and strictly longer than the pin label. Control
 * characters are checked on the trimmed text, like the API.
 *
 * @param text - Composer or stored note text.
 * @param label - Pin label, or `null` / `undefined` when the note has none.
 * @returns A length, relative-length, or control-character problem; otherwise `null`.
 */
export function shopDescriptionProblem(
  text: string,
  label: string | null | undefined,
): 'short' | 'long' | 'notLonger' | 'controls' | null {
  const lf = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const description = shopDescriptionText(text);
  const name = label ?? '';
  // The API trims before it checks, so a pasted edge tab is fine.
  if (!hasNoForumControls(lf.trim())) {
    return 'controls';
  }
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
 * Optional shop-account username format problem, mirroring the API regex.
 *
 * @param raw - Optional username with or without one leading `@`.
 * @returns `'format'` when non-empty input is invalid, otherwise `null`. A bare
 * `@` counts as empty, like in the API.
 */
export function shopUsernameProblem(raw: string): 'format' | null {
  const username = raw.trim().replace(/^@/, '').trim().toLowerCase();
  if (username === '') {
    return null;
  }
  return /^[a-z0-9][a-z0-9._-]{0,31}$/.test(username) ? null : 'format';
}

/**
 * Whether a mention-suggestion page proves that a username exists or is missing.
 *
 * A full page without the exact username is inconclusive because the API also
 * matches display names and username segments, orders by username, and caps the
 * response at {@link MENTION_SUGGEST_PAGE} rows.
 *
 * @param rows - One `GET /forum/mentions` suggestion page.
 * @param handle - Username to compare case-insensitively, with or without `@`.
 * @returns `found`, `missing`, or `unknown` for a full page without an exact match.
 */
export function usernameLookupVerdict(
  rows: readonly { username: string }[],
  handle: string,
): 'found' | 'missing' | 'unknown' {
  const normalized = handle.replace(/^@/, '').toLowerCase();
  if (rows.some((row) => row.username.toLowerCase() === normalized)) {
    return 'found';
  }
  return rows.length >= MENTION_SUGGEST_PAGE ? 'unknown' : 'missing';
}

/**
 * Remaining characters needed to reach {@link SHOP_DESCRIPTION_MIN}.
 *
 * @param text - Composer or stored note text.
 * @returns Non-negative count.
 */
export function shopDescriptionRemaining(text: string): number {
  const description = shopDescriptionText(text);
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
  return `${address.street} ${address.houseNumber}, ${address.postalCode} ${address.city}, ${countryDisplayName(
    address.country,
    locale,
  )}`;
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
 * @returns `true` when both name and address pass the API rules (narrows to a pin).
 */
export function shopPlaceComplete(place: ForumPlacePin | null): place is ForumPlacePin {
  if (place === null) {
    return false;
  }
  const address = place.address ?? null;
  return shopNameProblem(place.label, address) === null && shopAddressProblem(address) === null;
}

/**
 * Map an exact API 400 body to a shop form error, or null.
 *
 * @param message - `Error.message` from `postMessage` / `setMessagePlace`.
 * @param shop - Whether the failing request belongs to a shop post or place.
 * @returns The matching problem, or `null` when the text is not a shop 400.
 */
export function shopApiProblem(message: string, shop: boolean): ShopApiProblem | null {
  if (message === SHOP_NAME_REQUIRED) {
    return 'shopName';
  }
  if (message === SHOP_NAME_CONTAINS_ADDRESS) {
    return 'shopNameAddress';
  }
  if (shop && message === PLACE_LABEL_LONG) {
    return 'shopNameLong';
  }
  if (message === SHOP_ADDRESS_REQUIRED) {
    return 'shopAddress';
  }
  if (message === SHOP_DESCRIPTION_RANGE) {
    return 'shopDescription';
  }
  if (shop && TEXT_RANGE.has(message)) {
    return 'shopDescription';
  }
  if (message === PLACE_ADDRESS_INVALID) {
    return 'placeAddress';
  }
  if (message === USERNAME_INVALID) {
    return 'usernameInvalid';
  }
  if (message === USERNAME_MISSING) {
    return 'usernameMissing';
  }
  return null;
}
