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
 * this module wrote (`[token]`) is matched whole, so it ends a run; any other
 * bracketed word is read as letters.
 */
const LETTERS = /\[(?:addr|hex|q|token|words)\]|[A-Za-z]+/g;

/**
 * One run of characters a key, hash, token, or address can hold (letters,
 * digits, `+ / = _ . : -`), matched whole from its start, so each character
 * is read once.
 */
const KEY_RUN = /(?<![A-Za-z0-9+/=_.:-])[A-Za-z0-9+/=_.:-]+/g;

/** Separators removed before a run is searched for hex. */
const RUN_SEPARATORS = /[+/=_.:-]/g;

/** 16 hex digits in a row. */
const HEX_16 = /[0-9a-f]{16}/i;

/** Punctuation that may end a run, such as a sentence stop; it stays. */
const TRAILING_PUNCTUATION = '.:_-';

/** Invoices, offers, LNURL, Spark and base-chain addresses, extended keys. */
const KEY_PREFIX =
  /(?:^|[^A-Za-z0-9])(?:lnbc|lntb|lnurl|lno1|lni1|spark1|sparkrt1|sp1|sprt1|spt1|bc1|tb1|bcrt1|[xtyzuv]p(?:rv|ub))[-_.]?[0-9a-z]{6,}/i;

/**
 * A run that starts with a host name, ending in a letters-only top-level
 * domain, and a path (`api.example.com/…`).
 */
const HOST_PATH = /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}\//i;

/** Shortest run with a digit that is a token. */
const MIN_TOKEN_LENGTH = 20;

/** Shortest run in mixed case without a digit that is a token. */
const MIN_MIXED_TOKEN_LENGTH = 40;

/**
 * An address whose quoted name holds whitespace (`"first last"@host`): the
 * quotes, everything between them, the `@` (or `＠`, `﹫`, `%40`), and the
 * rest of the word. An escaped quote (`\"`) stays inside the name. A quote
 * is read up to the next unescaped quote only, so each part of a message is
 * read at most twice.
 */
const QUOTED_ADDRESS = /"(?:[^"\\]|\\.)*"(?:[@＠﹫]|%40)\S*/gi;

/** The first query or fragment marker of a word, also URL-encoded. */
const QUERY_MARKER = /[?#？＃]|%3F|%23/i;

/** One word of a message: everything between two whitespace characters. */
const WORD = /\S+/g;

/**
 * A package scope in a path, such as `/@breeztech/`: `/@`, a scope name
 * without dots, and `/`. Every other `@` makes a word an address.
 */
const PACKAGE_SCOPE = /\/@[a-z0-9~-][a-z0-9_~-]*\//gi;

/** Fewest characters after `?` or `#` that make a query without `/` or `=`. */
const MIN_QUERY_LENGTH = 4;

/**
 * Replaces whole words that hold an address or a query. A quoted address
 * ({@link QUOTED_ADDRESS}) is replaced first, spaces and all. A word with an
 * `@` (also `＠`, `﹫`, or the URL-encoded `%40`) that is not a
 * {@link PACKAGE_SCOPE} (an e-mail or `name@host` address in any script, quoted
 * or not, or a URL with a user name and password) becomes `[addr]`. Otherwise a
 * word is cut at its first `?` or `#` (also the fullwidth `？` and `＃`, and the
 * URL-encoded `%3F` and `%23`), and the rest becomes `?[q]`, when a `/` comes
 * before it, an `=` after it, or at least {@link MIN_QUERY_LENGTH} characters
 * follow it; `what?` and `#1` stay. Each character is read once.
 *
 * @param text - Error message.
 * @returns The message with the addresses and queries replaced.
 */
function replaceAddressesAndQueries(text: string): string {
  return text.replace(QUOTED_ADDRESS, '[addr]').replace(WORD, (word) => {
    if (/[@＠﹫]|%40/i.test(word.replace(PACKAGE_SCOPE, '/'))) {
      return '[addr]';
    }
    const marker = QUERY_MARKER.exec(word);
    if (marker === null) {
      return word;
    }
    const query = marker.index;
    const rest = word.slice(query + marker[0].length);
    const isQuery =
      word.slice(0, query).includes('/') || rest.includes('=') || rest.length >= MIN_QUERY_LENGTH;
    return isQuery ? `${word.slice(0, query)}?[q]` : word;
  });
}

/**
 * What one run, or one segment of a URL or path, becomes: `[hex]` when it
 * holds 16 hex digits in a row once its separators are removed; `[token]`
 * when it holds a {@link KEY_PREFIX}, a JSON web token (`eyJ`), at least
 * {@link MIN_TOKEN_LENGTH} characters with a digit, or at least
 * {@link MIN_MIXED_TOKEN_LENGTH} in mixed case; otherwise itself.
 *
 * @param part - A run or a segment.
 * @returns The part, or its placeholder.
 */
function keyPlaceholder(part: string): string {
  if (HEX_16.test(part.replace(RUN_SEPARATORS, ''))) {
    return '[hex]';
  }
  const isToken =
    KEY_PREFIX.test(part) ||
    (part.includes('eyJ') && part.length >= MIN_TOKEN_LENGTH) ||
    (part.length >= MIN_TOKEN_LENGTH && /\d/.test(part)) ||
    (part.length >= MIN_MIXED_TOKEN_LENGTH && /[a-z]/.test(part) && /[A-Z]/.test(part));
  return isToken ? '[token]' : part;
}

/**
 * Replaces every key-shaped {@link KEY_RUN} as a whole, so no head or tail of
 * a key that `.`, `_`, `-`, `:`, or `/` splits stays readable. Trailing
 * punctuation (a sentence stop) is kept. A URL (`://`), a path (a leading
 * `/`), or a host with a path ({@link HOST_PATH}) is judged per segment
 * between `/` and `:`, so its host and path stay readable while a key in it
 * does not.
 *
 * @param text - Error message.
 * @returns The message with the keys replaced.
 */
function replaceKeys(text: string): string {
  return text.replace(KEY_RUN, (run) => {
    let end = run.length;
    while (end > 0 && TRAILING_PUNCTUATION.includes(run.charAt(end - 1))) {
      end -= 1;
    }
    const core = run.slice(0, end);
    const replaced =
      core.includes('://') || core.startsWith('/') || HOST_PATH.test(core)
        ? core
            .split(/([/:])/)
            .map(keyPlaceholder)
            .join('')
        : keyPlaceholder(core);
    return replaced + run.slice(end);
  });
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
 * Makes an error message safe to report. In this order it replaces a quoted
 * address with spaces (`"first last"@host`, also with `%40`) and every word
 * that holds an address (any `@`, `＠`, `﹫`, or `%40` but a package scope such
 * as `/@breeztech/`: e-mail and `name@host` addresses in any script, a URL with
 * a user name) with `[addr]`; the query string and fragment of a URL or path (a
 * word cut at its first `?` or `#`, fullwidth `？` or `＃`, or URL-encoded `%3F`
 * or `%23`, when a `/` comes before it, an `=` after it, or at least four
 * characters follow) with `?[q]`; then every run of key characters (letters,
 * digits, `+ / = _ . : -`) as a whole, or each segment of a URL or path: one
 * that holds 16 hex digits in a row once its separators are removed with
 * `[hex]`, and one that starts with an invoice, address, or extended-key prefix
 * (`lnbc`, `lntb`, `lnurl`, `lno1`, `lni1`, `spark1`, `sp1`, `bc1`, `tb1`,
 * `xprv`, `xpub`, `tprv`, `tpub`, …), holds a JSON web token (`eyJ`), has 20 or
 * more characters with a digit, or 40 or more in mixed case with `[token]`, so
 * no head or tail of a key that a separator splits stays; and last every run of
 * three or more BIP-39 English words (any case, any separator) with `[words]`,
 * so a word run never cuts a key short. Then it cuts the result to
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
