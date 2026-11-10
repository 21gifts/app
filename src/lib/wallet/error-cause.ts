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

/** Letters of one word; everything else separates two words. */
const LETTERS = /[A-Za-z]+/g;

/**
 * Value patterns after the recovery words, in order. Each match is replaced
 * as given. Earlier patterns take the larger shapes, so a later one never
 * leaves a readable part of a key behind.
 */
const REPLACEMENTS: ReadonlyArray<readonly [RegExp, string]> = [
  // Query string and fragment of an absolute URL (the path stays).
  [/(\b[a-z][a-z0-9+.-]*:\/\/[^\s?#"'<>]*)[?#][^\s"'<>]*/gi, '$1?[q]'],
  // E-mail and Lightning addresses, also without a top-level domain.
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*/g, '[addr]'],
  // JSON web tokens and other dotted three-part tokens.
  [/\beyJ[A-Za-z0-9_-]*(?:\.[A-Za-z0-9_-]*){1,2}/g, '[token]'],
  [/\b(?=[A-Za-z0-9_.-]*\d)[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}\b/g, '[token]'],
  // Invoices, offers, LNURL, Spark and base-chain addresses, extended keys.
  [
    /\b(?:lnbc|lntb|lnurl|lno1|lni1|spark1|sparkrt1|sp1|sprt1|spt1|bc1|tb1|bcrt1|[xtyzuv]p(?:rv|ub))[0-9A-Za-z]{10,}/gi,
    '[token]',
  ],
  // Keys, hashes, preimages, and ids: 16 or more hex digits.
  [/[0-9a-f]{16,}/gi, '[hex]'],
  // Any other base58, base64, or bech32 run of 20 or more characters with a digit.
  [/(?=[A-Za-z0-9+/=_-]*\d)[A-Za-z0-9+/=_-]{20,}/g, '[token]'],
];

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
  let out = text;
  for (const [from, to] of runs.reverse()) {
    out = `${out.slice(0, from)}[words]${out.slice(to)}`;
  }
  return out;
}

/**
 * Makes an error message safe to report. In this order it replaces every run
 * of three or more BIP-39 English words (any case, any separator) with
 * `[words]`; the query string and fragment of an absolute URL with `?[q]`;
 * e-mail and `name@host` addresses with `[addr]`; JSON web tokens and dotted
 * three-part tokens, invoices, offers, LNURL strings, Spark and base-chain
 * addresses, and extended keys (`xprv`, `xpub`, `tprv`, `tpub`, …) with
 * `[token]`; 16 or more hex digits with `[hex]`; and any other run of 20 or
 * more base58, base64, or bech32 characters that holds a digit with
 * `[token]`. Then it cuts the result to {@link ERROR_MESSAGE_MAX_LENGTH}
 * characters. Plain messages such as `Failed to fetch` stay readable.
 *
 * @param message - Error message as thrown.
 * @returns The message with every key-shaped part replaced, at most 200 characters.
 */
export function sanitizeErrorMessage(message: string): string {
  const replaced = REPLACEMENTS.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    replaceWordRuns(message),
  );
  return replaced.slice(0, ERROR_MESSAGE_MAX_LENGTH);
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
  if (typeof value === 'number' && Number.isInteger(value)) {
    return String(value);
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
 * reports its type. The code is the error's own `code` (a string identifier
 * or a whole number, as a `DOMException` has) or the SDK's error kind at the
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
