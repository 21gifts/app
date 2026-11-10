import { wordlist } from '@scure/bip39/wordlists/english';

/** Longest error message a report keeps, after every replacement. */
export const ERROR_MESSAGE_MAX_LENGTH = 200;

/** Longest error name or code a report keeps. */
const IDENTIFIER_MAX_LENGTH = 64;

/** An error name or code: letters, digits, `_`, and `.` only. */
const IDENTIFIER = /^[A-Za-z0-9_.]+$/;

/** The 2048 BIP-39 English words, lower-case. */
const BIP39_WORDS: ReadonlySet<string> = new Set(wordlist);

/** Fewest recovery words in a row that are replaced. */
const MIN_WORD_RUN = 3;

/**
 * Letters of one word; everything else separates two words. A placeholder
 * this module wrote (`[token]`) is matched whole, so it ends a run.
 */
const LETTERS = /\[[a-z]+\]|[A-Za-z]+/g;

/**
 * Key-shaped patterns, in order, after addresses and queries and before the
 * recovery words. Each match is replaced as given. Earlier patterns take the
 * larger shapes, so a later one never leaves a readable part of a key behind.
 */
const KEY_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  // JSON web tokens and other dotted three-part tokens.
  [/\beyJ[A-Za-z0-9_-]*(?:\.[A-Za-z0-9_-]*){1,2}/g, '[token]'],
  [
    /(?<![A-Za-z0-9_.-])(?=[A-Za-z0-9_.-]*\d)[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}\b/g,
    '[token]',
  ],
  // Invoices, offers, LNURL, Spark and base-chain addresses, extended keys.
  [
    /\b(?:lnbc|lntb|lnurl|lno1|lni1|spark1|sparkrt1|sp1|sprt1|spt1|bc1|tb1|bcrt1|[xtyzuv]p(?:rv|ub))[0-9A-Za-z]{10,}/gi,
    '[token]',
  ],
  // Keys, hashes, preimages, and ids: 16 or more hex digits.
  [/[0-9a-f]{16,}/gi, '[hex]'],
];

/**
 * Patterns for any other long token, after {@link KEY_PATTERNS} and the hex
 * groups.
 */
const TOKEN_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  // Any other base58, base64, or bech32 run of 20 or more characters with a
  // digit, or of 40 or more characters in mixed case without one. Each run is
  // tried from its start only, so a long message is read in linear time.
  [/(?<![A-Za-z0-9+/=_-])(?=[A-Za-z0-9+/=_-]*\d)[A-Za-z0-9+/=_-]{20,}/g, '[token]'],
  [
    /(?<![A-Za-z0-9+/=_-])(?=[A-Za-z0-9+/=_-]*[a-z])(?=[A-Za-z0-9+/=_-]*[A-Z])[A-Za-z0-9+/=_-]{40,}/g,
    '[token]',
  ],
];

/** Hex in groups joined by `:` or `-` (`ab:cd:…`, a UUID). */
const HEX_GROUPS = /(?<![0-9a-f])[0-9a-f]+(?:[:-][0-9a-f]+)+(?![0-9a-f])/gi;

/** Fewest hex digits of a group run that is replaced. */
const MIN_HEX_DIGITS = 16;

/** One word of a message: everything between two whitespace characters. */
const WORD = /\S+/g;

/** An `@` that is not the start of a package scope such as `/@breeztech`. */
const ADDRESS_AT = /[^/]@/;

/** Fewest characters after `?` or `#` that make a query without `/` or `=`. */
const MIN_QUERY_LENGTH = 4;

/**
 * Replaces whole words that hold an address or a query. A word with an `@`
 * after any character but `/` (an e-mail or `name@host` address in any
 * script, quoted or not, or a URL with a user name and password) becomes
 * `[addr]`. Otherwise a word is cut at its first `?` or `#`, and the rest
 * becomes `?[q]`, when a `/` comes before it, an `=` after it, or at least
 * {@link MIN_QUERY_LENGTH} characters follow it; `what?` and `#1` stay.
 * Each character is read once.
 *
 * @param text - Error message.
 * @returns The message with the addresses and queries replaced.
 */
function replaceAddressesAndQueries(text: string): string {
  return text.replace(WORD, (word) => {
    if (ADDRESS_AT.test(word)) {
      return '[addr]';
    }
    const query = word.search(/[?#]/);
    if (query === -1) {
      return word;
    }
    const rest = word.slice(query + 1);
    const isQuery =
      word.slice(0, query).includes('/') || rest.includes('=') || rest.length >= MIN_QUERY_LENGTH;
    return isQuery ? `${word.slice(0, query)}?[q]` : word;
  });
}

/**
 * Applies each pattern in order.
 *
 * @param text - Error message.
 * @param patterns - Patterns and their replacements.
 * @returns The message with every match replaced.
 */
function applyPatterns(text: string, patterns: ReadonlyArray<readonly [RegExp, string]>): string {
  return patterns.reduce((out, [pattern, replacement]) => out.replace(pattern, replacement), text);
}

/**
 * Replaces every key-shaped part: {@link KEY_PATTERNS}, then hex groups of at
 * least {@link MIN_HEX_DIGITS} digits (also when a separator follows the last
 * group), then {@link TOKEN_PATTERNS}.
 *
 * @param text - Error message.
 * @returns The message with the keys replaced.
 */
function replaceKeys(text: string): string {
  const grouped = applyPatterns(text, KEY_PATTERNS).replace(HEX_GROUPS, (group) =>
    group.replace(/[:-]/g, '').length >= MIN_HEX_DIGITS ? '[hex]' : group,
  );
  return applyPatterns(grouped, TOKEN_PATTERNS);
}

/**
 * Replaces every run of {@link MIN_WORD_RUN} or more BIP-39 English words in
 * a row, in any letter case and with any separator between them, by
 * `[words]`.
 *
 * @param text - Error message.
 * @returns The message with the runs replaced.
 */
function replaceWordRuns(text: string): string {
  const runs: Array<[number, number]> = [];
  let start = -1;
  let end = -1;
  let count = 0;
  const close = (): void => {
    if (count >= MIN_WORD_RUN) {
      runs.push([start, end]);
    }
    count = 0;
  };
  for (const match of text.matchAll(LETTERS)) {
    if (BIP39_WORDS.has(match[0].toLowerCase())) {
      if (count === 0) {
        start = match.index;
      }
      end = match.index + match[0].length;
      count += 1;
    } else {
      close();
    }
  }
  close();
  const parts: string[] = [];
  let last = 0;
  for (const [from, to] of runs) {
    parts.push(text.slice(last, from), '[words]');
    last = to;
  }
  parts.push(text.slice(last));
  return parts.join('');
}

/**
 * Makes an error message safe to report. In this order it replaces every
 * word that holds an address (an `@` after any character but `/`: e-mail and
 * `name@host` addresses in any script, a URL with a user name) with
 * `[addr]`; the query string and fragment of a URL or path (a word cut at
 * its first `?` or `#` when a `/` comes before it, an `=` after it, or at
 * least four characters follow) with `?[q]`; JSON web tokens and dotted
 * three-part tokens, invoices, offers, LNURL strings, Spark and base-chain
 * addresses, and extended keys (`xprv`, `xpub`, `tprv`, `tpub`, …) with
 * `[token]`; 16 or more hex digits, also in groups joined by `:` or `-`, with
 * `[hex]`; any other run of 20 or more base58, base64, or bech32 characters
 * that holds a digit, or of 40 or more in mixed case without one, with
 * `[token]`; and last every run of three or
 * more BIP-39 English words (any case, any separator) with `[words]`, so a
 * word run never cuts a key short. Then it cuts the result to
 * {@link ERROR_MESSAGE_MAX_LENGTH} characters. Plain messages such as
 * `Failed to fetch` stay readable.
 *
 * @param message - Error message as thrown.
 * @returns The message with every key-shaped part replaced, at most 200 characters.
 */
export function sanitizeErrorMessage(message: string): string {
  return replaceWordRuns(replaceKeys(replaceAddressesAndQueries(message))).slice(
    0,
    ERROR_MESSAGE_MAX_LENGTH,
  );
}

/**
 * An error name or code that may be reported: only letters, digits, `_`, and
 * `.`, at most 64 characters, and nothing {@link sanitizeErrorMessage} would
 * replace (a hex key is made of the same characters).
 *
 * @param value - Candidate name or code.
 * @returns The value, or `null` when it may not be reported.
 */
function identifier(value: unknown): string | null {
  if (typeof value === 'number') {
    return identifier(String(value));
  }
  if (
    typeof value !== 'string' ||
    value.length > IDENTIFIER_MAX_LENGTH ||
    !IDENTIFIER.test(value) ||
    sanitizeErrorMessage(value) !== value
  ) {
    return null;
  }
  return value;
}

/** What a report may say about a thrown value. */
export interface ErrorCause {
  /**
   * Error name (`TypeError`, `RuntimeError`, …), the type of a thrown value
   * that is not an object (`string`), or `unknown`.
   */
  errorName: string;
  /** The error's own `code`, or the SDK's error kind at the start of its message; `null` when neither. */
  errorCode: string | null;
  /** The message through {@link sanitizeErrorMessage}, or `null` when there is none. */
  errorMessage: string | null;
}

/**
 * Name, code, and sanitized message of a thrown value, never the value
 * itself. The name is the error's `name` (or its constructor's name) when it
 * is a short identifier, otherwise `unknown`; a thrown string or number
 * reports its type. The code is the error's own `code` (a string identifier,
 * or a number such as a `DOMException`'s, held to the same characters) or the
 * SDK's error kind at the
 * start of its message (`Network error: …` → `network`). The message, or a
 * thrown string, goes through {@link sanitizeErrorMessage}. A value that
 * cannot be read (a throwing getter) reports `unknown` and nothing else.
 *
 * @param error - What was thrown, or rejected with.
 * @returns The cause; fields that cannot be reported are `null`.
 */
export function errorCause(error: unknown): ErrorCause {
  if (typeof error === 'string') {
    return { errorName: 'string', errorCode: null, errorMessage: sanitizeErrorMessage(error) };
  }
  if (typeof error !== 'object' || error === null) {
    return {
      errorName: error === null || error === undefined ? 'unknown' : typeof error,
      errorCode: null,
      errorMessage: null,
    };
  }
  try {
    const { name, message, code } = error as { name?: unknown; message?: unknown; code?: unknown };
    const errorName =
      identifier(name) ??
      identifier((error as { constructor?: { name?: unknown } }).constructor?.name) ??
      'unknown';
    const kind =
      typeof message === 'string'
        ? /^([A-Za-z][A-Za-z ]{0,40}?) error:/.exec(message)?.[1]
        : undefined;
    const errorCode = identifier(code) ?? identifier(kind?.toLowerCase().replace(/ /g, '_'));
    return {
      errorName,
      errorCode,
      errorMessage: typeof message === 'string' ? sanitizeErrorMessage(message) : null,
    };
  } catch {
    // An unreadable rejection never breaks the report.
    return { errorName: 'unknown', errorCode: null, errorMessage: null };
  }
}
