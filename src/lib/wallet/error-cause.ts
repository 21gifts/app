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
 * One word or one escaped separator. A placeholder this module wrote
 * (`[token]`) is matched whole, so it ends a run; any other bracketed word is
 * read as letters. An escaped separator ({@link ESCAPED_SEPARATOR}) is matched
 * whole, so its letters (`%2c`, `\n`, `&nbsp;`) do not join the next word. A
 * word holds ASCII or fullwidth letters and may hold invisible format
 * characters ({@link INVISIBLE}); everything else separates two words.
 */
const LETTERS =
  /\[(?:addr|hex|q|token|words)\]|%[0-9A-Fa-f]{2}|\\[nrt]|&[a-z]+;|[A-Za-zＡ-Ｚａ-ｚ\u00AD\u200B-\u200D\u2060\uFEFF]+/g;

/** A URL-encoded character, a `\n` `\r` `\t` escape, or an HTML entity. */
const ESCAPED_SEPARATOR = /^(?:%[0-9A-Fa-f]{2}|\\[nrt]|&[a-z]+;)$/;

/** Invisible format characters (soft hyphen, zero-width space and joiners). */
const INVISIBLE = /[\u00AD\u200B-\u200D\u2060\uFEFF]/g;

/** Whether a word holds an invisible format character. */
const INVISIBLE_IN = /[\u00AD\u200B-\u200D\u2060\uFEFF]/;

/**
 * Whether a word is a recovery word once its invisible characters are removed
 * and its fullwidth letters are read as ASCII.
 *
 * @param word - A word of {@link LETTERS}.
 * @returns Whether it is one of {@link BIP39_WORDS}.
 */
function isRecoveryWord(word: string): boolean {
  return BIP39_WORDS.has(word.replace(INVISIBLE, '').normalize('NFKC').toLowerCase());
}

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

/** An address sign right after a quoted name: `@`, `＠`, `﹫`, or `%40`. */
const QUOTED_ADDRESS_AT = /^(?:[@＠﹫]|%40)\S*/i;

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
 * The end of a query part whose value follows in the next word, after a line
 * break or a space (`?apiKey=` or `&`).
 */
const QUERY_GOES_ON = /[=&]$/;

/**
 * Replaces every address whose quoted name may hold whitespace
 * (`"first last"@host`): the quotes, everything between them (an escaped
 * quote `\"` stays inside), the address sign ({@link QUOTED_ADDRESS_AT}),
 * and the rest of the word, by `[addr]`. The scan moves forward only and
 * goes on from the closing quote of a name that is not an address, so each
 * character is read at most twice.
 *
 * @param text - Error message.
 * @returns The message with quoted addresses replaced.
 */
function replaceQuotedAddresses(text: string): string {
  let out = '';
  let from = 0;
  let open = text.indexOf('"');
  while (open !== -1) {
    let close = open + 1;
    while (close < text.length && text.charAt(close) !== '"') {
      close += text.charAt(close) === '\\' ? 2 : 1;
    }
    if (close >= text.length) {
      break;
    }
    const at = QUOTED_ADDRESS_AT.exec(text.slice(close + 1));
    if (at === null) {
      open = close;
      continue;
    }
    out += `${text.slice(from, open)}[addr]`;
    from = close + 1 + at[0].length;
    open = text.indexOf('"', from);
  }
  return out + text.slice(from);
}

/**
 * Replaces whole words that hold an address or a query. A quoted address
 * ({@link replaceQuotedAddresses}) is replaced first, spaces and all. A word with an
 * `@` (also `＠`, `﹫`, or the URL-encoded `%40`) that is not a
 * {@link PACKAGE_SCOPE} (an e-mail or `name@host` address in any script, quoted
 * or not, or a URL with a user name and password) becomes `[addr]`. Otherwise a
 * word is cut at its first `?` or `#` (also the fullwidth `？` and `＃`, and the
 * URL-encoded `%3F` and `%23`), and the rest becomes `?[q]`, when a `/` comes
 * before it, an `=` after it, or at least {@link MIN_QUERY_LENGTH} characters
 * follow it; `what?` and `#1` stay. When such a query ends at its marker, or
 * with `=` or `&` ({@link QUERY_GOES_ON}), its value went on in the next word,
 * so that word becomes `[q]` as well, and so on. Each character is read once.
 *
 * @param text - Error message.
 * @returns The message with the addresses and queries replaced.
 */
function replaceAddressesAndQueries(text: string): string {
  let queryGoesOn = false;
  return replaceQuotedAddresses(text).replace(WORD, (word) => {
    if (queryGoesOn) {
      queryGoesOn = QUERY_GOES_ON.test(word);
      return '[q]';
    }
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
    if (!isQuery) {
      return word;
    }
    queryGoesOn = rest === '' || QUERY_GOES_ON.test(rest);
    return `${word.slice(0, query)}?[q]`;
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
 * Whether a run is a URL (`://`), a path (a leading `/`), or a host with a
 * path ({@link HOST_PATH}), which is judged per segment.
 *
 * @param core - A run without its trailing punctuation.
 * @returns `true` for a URL or a path.
 */
function isPath(core: string): boolean {
  return core.includes('://') || core.startsWith('/') || HOST_PATH.test(core);
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
    const replaced = isPath(core)
      ? core
          .split(/([/:])/)
          .map(keyPlaceholder)
          .join('')
      : keyPlaceholder(core);
    // A key that ends in `-` or `_` keeps its full length for the digit rule.
    const isLongKey =
      replaced === core && run.length >= MIN_TOKEN_LENGTH && /\d/.test(core) && !isPath(core);
    return isLongKey ? '[token]' : replaced + run.slice(end);
  });
}

/** Most letters a recovery word has. */
const MAX_WORD_LENGTH = Math.max(...wordlist.map((word) => word.length));

/**
 * Reads a word that holds invisible format characters and is not one recovery
 * word as a whole: its pieces between them. A piece joined with the pieces
 * right before it (together at most {@link MAX_WORD_LENGTH} letters) that
 * makes one recovery word (`ab\u200Bandon`) is that word; a piece that can no
 * longer be part of one is not. So each piece is read a bounded number of
 * times.
 *
 * @param word - A word of {@link LETTERS}.
 * @param index - Where the word starts in the message.
 * @param onWord - Called with the start and end of each recovery word.
 * @param onOther - Called for each piece that is not part of one.
 */
function visitPieces(
  word: string,
  index: number,
  onWord: (from: number, to: number) => void,
  onOther: () => void,
): void {
  let pending: Array<{ text: string; from: number }> = [];
  let at = index;
  for (const piece of word.split(INVISIBLE)) {
    const pieceTo = at + piece.length;
    if (piece !== '') {
      pending.push({ text: piece, from: at });
      let joined = pending.map((part) => part.text).join('');
      let wordFrom: number | null = null;
      let skipped = false;
      for (const part of pending) {
        if (isRecoveryWord(joined)) {
          wordFrom = part.from;
          break;
        }
        skipped = true;
        joined = joined.slice(part.text.length);
      }
      if (wordFrom !== null) {
        if (skipped) {
          onOther();
        }
        onWord(wordFrom, pieceTo);
        pending = [];
      } else {
        let length = pending.reduce((sum, part) => sum + part.text.length, 0);
        let dropped = 0;
        for (const part of pending) {
          if (length <= MAX_WORD_LENGTH) {
            break;
          }
          length -= part.text.length;
          dropped += 1;
          onOther();
        }
        pending = pending.slice(dropped);
      }
    }
    at = pieceTo + 1;
  }
  if (pending.length > 0) {
    onOther();
  }
}

/**
 * Replaces every run of {@link MIN_WORD_RUN} or more BIP-39 English words in
 * a row, in any letter case and with any separator between them, by
 * `[words]`. A word with invisible format characters is one recovery word
 * when it is one without them (`aban\u200Bdon`); otherwise its pieces between
 * them are read by {@link visitPieces}: neighbouring pieces that together make
 * a recovery word (`ab\u200Bandon`) are that word, and every other piece is a
 * word of its own (`abandon\u200Bability`).
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
  const addWord = (from: number, to: number): void => {
    if (count === 0) {
      start = from;
    }
    end = to;
    count += 1;
  };
  for (const match of text.matchAll(LETTERS)) {
    const word = match[0];
    if (ESCAPED_SEPARATOR.test(word)) {
      continue;
    }
    if (isRecoveryWord(word)) {
      addWord(match.index, match.index + word.length);
    } else if (INVISIBLE_IN.test(word)) {
      visitPieces(word, match.index, addWord, close);
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
