import { wordlist } from '@scure/bip39/wordlists/english';
import { SENSITIVE_KEYS, SENSITIVE_KEY_PARTS } from '@/lib/sensitive-keys';

/** Longest error message a report keeps, after every replacement. */
export const ERROR_MESSAGE_MAX_LENGTH = 200;

/** Longest error name or code a report keeps. */
const IDENTIFIER_MAX_LENGTH = 64;

/** An error name or code: letters, digits, `_`, and `.` only. */
const IDENTIFIER = /^[A-Za-z0-9_.]+$/;

/** An error name: a class name ending in `Error` or `Exception` (`TypeError`, `DOMException`). */
const ERROR_NAME = /^(?:[A-Z][A-Za-z0-9]*)?(?:Error|Exception)$/;

/** An error's own code: a whole number or an upper-case constant (`ERR_CHUNK_LOAD`). */
const OWN_CODE = /^(?:\d{1,6}|[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*)$/;

/** The SDK's error kind: one to four lower-case words joined by `_` (`service_connectivity`). */
const SDK_KIND = /^[a-z]+(?:_[a-z]+){0,3}$/;

/** The 2048 BIP-39 English words, lower-case. */
const BIP39_WORDS: ReadonlySet<string> = new Set(wordlist);

/** Fewest recovery words in a row that are replaced. */
const MIN_WORD_RUN = 3;

/** Fewest letters a recovery word has. */
const MIN_WORD_LENGTH = Math.min(...wordlist.map((word) => word.length));

/** Most letters a recovery word has. */
const MAX_WORD_LENGTH = Math.max(...wordlist.map((word) => word.length));

/**
 * One word or one escaped separator. A placeholder this module wrote
 * (`[token]`) is matched whole, so it ends a run; any other bracketed word is
 * read as letters. An escaped separator ({@link ESCAPED_SEPARATOR}) is matched
 * whole, so its letters (`%2c`, `\n`, `&nbsp;`) do not join the next word. A
 * word holds ASCII or fullwidth letters and may hold invisible format
 * characters ({@link INVISIBLE}); everything else separates two words.
 */
const LETTERS =
  /\[(?:addr|hex|q|token|words)\]|%[0-9A-Fa-f]{2}|\\[nrt]|&[a-z]+;|[A-Za-zＡ-Ｚａ-ｚ\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180B-\u180F\u200B-\u200F\u202A-\u202E\u2060-\u206F\u3164\uFE00-\uFE0F\uFEFF\uFFA0\uFFF0-\uFFF8]+/g;

/**
 * First characters of an escaped separator of {@link LETTERS} (a URL-encoded
 * character, a `\n` `\r` `\t` escape, or an HTML entity); a word never starts
 * with one.
 */
const ESCAPE_START = '%\\&';

/**
 * Invisible characters: the default-ignorable code points of the Basic
 * Multilingual Plane (soft hyphen, zero-width spaces and joiners, direction
 * marks and controls, invisible operators, variation selectors, fillers).
 */
const INVISIBLE =
  /[\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180B-\u180F\u200B-\u200F\u202A-\u202E\u2060-\u206F\u3164\uFE00-\uFE0F\uFEFF\uFFA0\uFFF0-\uFFF8]/g;

/** Whether a word holds an invisible character ({@link INVISIBLE}). */
const INVISIBLE_IN =
  /[\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180B-\u180F\u200B-\u200F\u202A-\u202E\u2060-\u206F\u3164\uFE00-\uFE0F\uFEFF\uFFA0\uFFF0-\uFFF8]/;

/**
 * Whether a word is a recovery word once its invisible characters are removed
 * and its fullwidth letters are read as ASCII.
 *
 * @param word - A word of {@link LETTERS}.
 * @returns Whether it is one of {@link BIP39_WORDS}.
 */
function isRecoveryWord(word: string): boolean {
  return isPlainRecoveryWord(INVISIBLE_IN.test(word) ? word.replace(INVISIBLE, '') : word);
}

/** A word of ASCII letters only, which is a recovery word only as it is written. */
const ASCII_WORD = /^[A-Za-z]+$/;

/** Text with only ASCII characters. */
const ASCII = /^[\x00-\x7f]*$/;

/**
 * Whether text without invisible characters is a recovery word, in any case
 * and also in fullwidth letters. Text of a length no recovery word has is
 * rejected before any lookup, and only non-ASCII text is normalized.
 *
 * @param plain - Text without invisible format characters.
 * @returns Whether it is one of {@link BIP39_WORDS}.
 */
function isPlainRecoveryWord(plain: string): boolean {
  if (plain.length < MIN_WORD_LENGTH || plain.length > MAX_WORD_LENGTH) {
    return false;
  }
  return (
    BIP39_WORDS.has(plain.toLowerCase()) ||
    (!ASCII.test(plain) && BIP39_WORDS.has(plain.normalize('NFKC').toLowerCase()))
  );
}

/**
 * One run of characters a key, hash, token, or address can hold (letters,
 * digits, `+ / = _ . : -`), matched whole from its start, so each character
 * is read once. Only runs of {@link MIN_KEY_LENGTH} (9) or more characters
 * are matched; a shorter run never becomes a placeholder.
 */
const KEY_RUN = /(?<![A-Za-z0-9+/=_.:-])[A-Za-z0-9+/=_.:-]{9,}/g;

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

/**
 * Shortest run that can become a placeholder: a {@link KEY_PREFIX} of three
 * characters and six more. 16 hex digits and {@link MIN_TOKEN_LENGTH} are longer.
 */
const MIN_KEY_LENGTH = 9;

/** Shortest run with a digit that is a token. */
const MIN_TOKEN_LENGTH = 20;

/** Shortest run in mixed case without a digit that is a token. */
const MIN_MIXED_TOKEN_LENGTH = 40;

/** An address sign right after a quoted name: `@`, `＠`, `﹫`, or `%40`. */
const QUOTED_ADDRESS_AT = /^(?:[@＠﹫]|%40)\S*/i;

/** A character that can start an address sign or a query marker, also URL-encoded. */
const ADDRESS_OR_QUERY_SIGN = /[@＠﹫%?#？＃]/;

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
 * Label fragments that name a secret in an error message, besides the ones
 * the error reporter removes from every event ({@link SENSITIVE_KEY_PARTS}):
 * API and private keys, auth, sessions, user names, credentials, and
 * passwords (also `pwd`) or passkeys.
 */
const LABEL_PARTS: readonly string[] = [
  'key',
  'auth',
  'session',
  'user',
  'credential',
  'pass',
  'pwd',
];

/**
 * Separator after a label: an optional closing quote, then `=` or `:` with
 * any whitespace around it. It starts right after the label, never inside a
 * run of whitespace, so each run is read once. An `=` next to another `=` is
 * not one (`==`, the padding of a base64 key).
 */
const LABEL_SEPARATOR = /(?<![\s=])["']?\s*(?::|=(?!=))\s*/g;

/** Most whitespace-separated words a label is read by, back from its separator. */
const LABEL_MAX_WORDS = 3;

/**
 * A character of a label word: a letter or digit in any script, an invisible
 * format character ({@link INVISIBLE}), or a joiner: `_`, `.`, `/`, `-` and
 * the Unicode hyphens and dashes, or an apostrophe (`'`, `’`). A word may be
 * written in camel case (`prfOutput`) or joined (`prf_output`, `PRF/output`,
 * `PRF's`).
 */
const LABEL_WORD_CHAR =
  /[\p{L}\p{N}\p{Pd}_./'\u2019\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180B-\u180F\u200B-\u200F\u202A-\u202E\u2060-\u206F\u3164\uFE00-\uFE0F\uFEFF\uFFA0\uFFF0-\uFFF8]/u;

/** Everything of a label but its letters and digits, removed before it is compared. */
const LABEL_NOISE = /[^\p{L}\p{N}]/gu;

/** A value that is only a placeholder this module wrote. */
const PLACEHOLDER = /^\[(?:addr|hex|q|token|words)\]$/;

/** The next line break. */
const LINE_BREAK = /[\n\r\u2028\u2029]/g;

/** A line break. */
const LINE_BREAK_CHAR = /[\n\r\u2028\u2029]/;

/** Quotes; inside brackets a quoted string is skipped. */
const QUOTES = '"\'`';

/** Brackets that open a value, and the ones that close them, in the same order. */
const OPENERS = '([{<';
const CLOSERS = ')]}>';

/**
 * A typed-array or object name before its opening bracket, with or without a
 * length and with any whitespace around the length and before the bracket
 * (`Uint8Array(32) [`, `Uint8Array (32) [`, `Uint8Array [`, `Map(1) {`); the
 * bracket (`[`, `{`, or `<`) follows right after the match.
 */
const TYPED_NAME = /[A-Za-z_$][\w$]*\s*(?:\(\s{0,9}\d{0,9}\s{0,9}\)\s*)?(?=[[{<])/y;

/**
 * The words of the label that ends at `end`, read back over at most
 * {@link LABEL_MAX_WORDS} words of {@link LABEL_WORD_CHAR} with any
 * whitespace between them, and never before `floor`. The walk stops at any
 * other character, so it never crosses a separator (`:` `=`), a quote, or a
 * placeholder, and each character is walked by one label at most.
 *
 * @param text - Error message.
 * @param end - Where the label's separator starts.
 * @param floor - Where the text not yet written out starts.
 * @returns The words, last word last; empty when none ends at `end`.
 */
function labelWords(text: string, end: number, floor: number): string[] {
  const words: string[] = [];
  let at = end;
  while (at > floor && words.length < LABEL_MAX_WORDS) {
    const wordEnd = at;
    while (at > floor && LABEL_WORD_CHAR.test(text.charAt(at - 1))) {
      at -= 1;
    }
    if (at === wordEnd) {
      break;
    }
    words.unshift(text.slice(at, wordEnd));
    while (at > floor && /\s/.test(text.charAt(at - 1))) {
      at -= 1;
    }
  }
  return words;
}

/**
 * Whether a label names a secret: a word that is one of
 * {@link SENSITIVE_KEYS}, or its words joined without their separators,
 * invisible characters, and case (`PRF output`, `prf_output`, `prfOutput`,
 * and `PRF\toutput` all read `prfoutput`), hold one of
 * {@link SENSITIVE_KEY_PARTS} or {@link LABEL_PARTS}. Fullwidth letters are
 * read as ASCII.
 *
 * @param words - Words of the label before `=` or `:`.
 * @returns Whether its value is a secret.
 */
function isSecretLabel(words: readonly string[]): boolean {
  const read = words.map((word) => word.normalize('NFKC').toLowerCase());
  if (read.some((word) => SENSITIVE_KEYS.has(word.replace(INVISIBLE, '')))) {
    return true;
  }
  const joined = read.join('').replace(LABEL_NOISE, '');
  return (
    SENSITIVE_KEY_PARTS.some((part) => joined.includes(part)) ||
    LABEL_PARTS.some((part) => joined.includes(part))
  );
}

/**
 * Where each opening bracket of `text` closes: the matching closing bracket
 * of the same kind, over any number of lines; one that does not close is
 * left out. Inside brackets a quoted string on one line is skipped, so a bracket
 * in it neither opens nor closes, and after a quote that does not close on
 * its line no bracket closes on that line; a character after `\\` is skipped
 * too.
 * Each character is read a bounded number of times.
 *
 * @param text - Error message.
 * @returns For each bracket that closes, where it opened and where it closes.
 */
function closingBrackets(text: string): Map<number, number> {
  const closeAt = new Map<number, number>();
  const open: number[][] = OPENERS.split('').map(() => []);
  let depth = 0;
  // Until here the line holds a quote that does not close: no bracket closes on it.
  let openQuoteUntil = -1;
  for (let at = 0; at < text.length; at += 1) {
    const char = text.charAt(at);
    const quoted = at < openQuoteUntil;
    if (depth > 0 && !quoted && char === '\\') {
      at += 1;
      continue;
    }
    if (depth > 0 && !quoted && QUOTES.includes(char)) {
      const end = quoteEnd(text, at);
      if (end === -1) {
        openQuoteUntil = lineEnd(text, at);
      } else {
        at = end - 1;
      }
      continue;
    }
    const opens = OPENERS.indexOf(char);
    if (opens !== -1) {
      open[opens]?.push(at);
      depth += 1;
      continue;
    }
    if (quoted) {
      continue;
    }
    const opened = open[CLOSERS.indexOf(char)]?.pop();
    if (opened !== undefined) {
      closeAt.set(opened, at);
      depth -= 1;
    }
  }
  return closeAt;
}

/**
 * Where the quoted string that opens at `at` ends: right after its closing
 * quote on the same line (a quote after `\\` does not close it), or `-1`
 * when the line ends first.
 *
 * @param text - Error message.
 * @param at - Where the opening quote stands.
 * @returns The index after the closing quote, or `-1`.
 */
function quoteEnd(text: string, at: number): number {
  const quote = text.charAt(at);
  for (let next = at + 1; next < text.length; next += 1) {
    const char = text.charAt(next);
    if (char === quote) {
      return next + 1;
    }
    if (LINE_BREAK_CHAR.test(char)) {
      return -1;
    }
    if (char === '\\') {
      // An escaped line break still ends the line.
      if (LINE_BREAK_CHAR.test(text.charAt(next + 1))) {
        return -1;
      }
      next += 1;
    }
  }
  return -1;
}

/**
 * Where the line that holds `at` ends.
 *
 * @param text - Error message.
 * @param at - A position on the line.
 * @returns The index of the next line break, or the length of `text`.
 */
function lineEnd(text: string, at: number): number {
  LINE_BREAK.lastIndex = at;
  return LINE_BREAK.exec(text)?.index ?? text.length;
}

/**
 * Where the value of a secret label that starts at `at` ends: at the end of
 * its line, or, when it opens a bracket (also after a typed-array or object
 * name, {@link TYPED_NAME}) that closes on a later line, at the end of the
 * line where that bracket closes. A value thus always runs to the end of a
 * line, so a quote or bracket that closes early cannot leave part of it, and
 * a second pass reads the placeholder as the whole value.
 *
 * @param text - Error message.
 * @param at - Where the value starts.
 * @param closeAt - Returns {@link closingBrackets} of `text`, read once.
 * @returns The index after the value.
 */
function labelValueEnd(text: string, at: number, closeAt: () => Map<number, number>): number {
  let opener = -1;
  if (OPENERS.includes(text.charAt(at))) {
    opener = at;
  } else {
    TYPED_NAME.lastIndex = at;
    if (TYPED_NAME.exec(text) !== null) {
      opener = TYPED_NAME.lastIndex;
    }
  }
  const close = opener === -1 ? undefined : closeAt().get(opener);
  return lineEnd(text, close ?? at);
}

/**
 * Replaces the whole value after every label that names a secret
 * ({@link isSecretLabel}: `api_key=`, `token:`, `"secret": "…"`,
 * `password=`, `username=`, `PRF output:` and the like) by `[token]`, whatever
 * its characters are and however long it is ({@link labelValueEnd}). The
 * label stays readable. A value that is only a placeholder (`[addr]`, or the
 * `[token]` an earlier pass wrote) stays. Each character is read a bounded
 * number of times.
 *
 * @param text - Error message.
 * @returns The message with labelled secrets replaced.
 */
function replaceLabeledValues(text: string): string {
  let out = '';
  let from = 0;
  let brackets: Map<number, number> | null = null;
  const closeAt = (): Map<number, number> => {
    brackets ??= closingBrackets(text);
    return brackets;
  };
  LABEL_SEPARATOR.lastIndex = 0;
  for (
    let separator = LABEL_SEPARATOR.exec(text);
    separator !== null;
    separator = LABEL_SEPARATOR.exec(text)
  ) {
    const valueAt = separator.index + separator[0].length;
    if (valueAt >= text.length || !isSecretLabel(labelWords(text, separator.index, from))) {
      continue;
    }
    const valueEnd = labelValueEnd(text, valueAt, closeAt);
    if (PLACEHOLDER.test(text.slice(valueAt, valueEnd).trimEnd())) {
      continue;
    }
    out += `${text.slice(from, valueAt)}[token]`;
    from = valueEnd;
    LABEL_SEPARATOR.lastIndex = from;
  }
  return out + text.slice(from);
}

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
    if (!ADDRESS_OR_QUERY_SIGN.test(word)) {
      return word;
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
  if (part.length < MIN_KEY_LENGTH) {
    return part;
  }
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
    const path = isPath(core);
    const replaced = path
      ? core
          .split(/([/:])/)
          .map(keyPlaceholder)
          .join('')
      : keyPlaceholder(core);
    // A key that ends in `-` or `_` keeps its full length for the digit rule.
    const isLongKey =
      replaced === core && run.length >= MIN_TOKEN_LENGTH && /\d/.test(core) && !path;
    return isLongKey ? '[token]' : replaced + run.slice(end);
  });
}

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
  let pending: Array<{ length: number; from: number }> = [];
  let pendingText = '';
  let at = index;
  for (const piece of word.split(INVISIBLE)) {
    const pieceTo = at + piece.length;
    if (piece !== '') {
      pending.push({ length: piece.length, from: at });
      pendingText += piece;
      let offset = 0;
      let wordFrom: number | null = null;
      for (const part of pending) {
        const rest = pendingText.length - offset;
        if (rest < MIN_WORD_LENGTH) {
          break;
        }
        if (rest <= MAX_WORD_LENGTH && isPlainRecoveryWord(pendingText.slice(offset))) {
          wordFrom = part.from;
          break;
        }
        offset += part.length;
      }
      if (wordFrom !== null) {
        if (offset > 0) {
          onOther();
        }
        onWord(wordFrom, pieceTo);
        pending = [];
        pendingText = '';
      } else {
        let dropped = 0;
        for (const part of pending) {
          if (pendingText.length <= MAX_WORD_LENGTH) {
            break;
          }
          pendingText = pendingText.slice(part.length);
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
  LETTERS.lastIndex = 0;
  for (let match = LETTERS.exec(text); match !== null; match = LETTERS.exec(text)) {
    const word = match[0];
    const at = match.index;
    if (
      word.length >= MIN_WORD_LENGTH &&
      word.length <= MAX_WORD_LENGTH &&
      BIP39_WORDS.has(word.toLowerCase())
    ) {
      addWord(at, at + word.length);
    } else if (ASCII_WORD.test(word)) {
      close();
    } else if (ESCAPE_START.includes(word.charAt(0))) {
      continue;
    } else if (isRecoveryWord(word)) {
      addWord(at, at + word.length);
    } else if (INVISIBLE_IN.test(word)) {
      visitPieces(word, at, addWord, close);
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
 * characters follow) with `?[q]`; then the whole value after a label that
 * names a secret (`api_key=`, `token:`, `PRF output:`, in any spelling) with
 * `[token]` ({@link replaceLabeledValues}); then every run of key characters (letters,
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
  return cutToLength(
    replaceWordRuns(replaceKeys(replaceLabeledValues(replaceAddressesAndQueries(message)))),
  );
}

/**
 * The end of a cut word back to its last `( ) < > { } , ; ! * |` or quote:
 * none of these is part of a key, a word, or a placeholder.
 */
const CUT_AFTER = /[^\s()<>,;!*'"|{}]*$/;

/**
 * Cuts a sanitized message to {@link ERROR_MESSAGE_MAX_LENGTH} characters
 * without cutting a word: at the last whitespace before the limit, or, in a
 * single word longer than the limit, after its last `( ) < > { } , ; ! * |`
 * or quote ({@link CUT_AFTER}); a word with none of them is dropped. So no
 * placeholder is cut (`[hex`), and no cut word turns into a key or a recovery
 * word that a second pass would replace.
 *
 * @param text - Sanitized message.
 * @returns The message, at most {@link ERROR_MESSAGE_MAX_LENGTH} characters.
 */
function cutToLength(text: string): string {
  if (text.length <= ERROR_MESSAGE_MAX_LENGTH) {
    return text;
  }
  const head = text.slice(0, ERROR_MESSAGE_MAX_LENGTH + 1);
  const space = head.search(/\s\S*$/);
  const cut = space > 0 ? head.slice(0, space) : head.slice(0, -1).replace(CUT_AFTER, '');
  return cut.trimEnd();
}

/**
 * An error name or code that may be reported: only letters, digits, `_`, and
 * `.`, at most 64 characters, and nothing {@link sanitizeErrorMessage} would
 * replace (a hex key is made of the same characters).
 *
 * @param value - Candidate name or code.
 * @returns The value, or `null` when it may not be reported.
 */
function identifier(value: unknown, shape: RegExp): string | null {
  if (typeof value === 'number') {
    return identifier(String(value), shape);
  }
  if (
    typeof value !== 'string' ||
    value.length > IDENTIFIER_MAX_LENGTH ||
    !IDENTIFIER.test(value) ||
    !shape.test(value) ||
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
      identifier(name, ERROR_NAME) ??
      identifier((error as { constructor?: { name?: unknown } }).constructor?.name, ERROR_NAME) ??
      'unknown';
    const kind =
      typeof message === 'string'
        ? /^([A-Za-z][A-Za-z ]{0,40}?) error:/.exec(message)?.[1]
        : undefined;
    const errorCode =
      identifier(code, OWN_CODE) ?? identifier(kind?.toLowerCase().replace(/ /g, '_'), SDK_KIND);
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
