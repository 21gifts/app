import type { Locale } from '@/lib/locale';

/** Detected note language: a UI locale, other/unknown, or null when too short. */
export type NoteLanguage = Locale | 'other';

const STOPWORDS: Record<Locale, ReadonlySet<string>> = {
  en: new Set([
    'the',
    'and',
    'is',
    'of',
    'to',
    'that',
    'you',
    'for',
    'it',
    'on',
    'with',
    'this',
    'are',
    'was',
    'be',
    'have',
    'from',
    'or',
    'your',
    'at',
    'we',
    'can',
    'will',
    'but',
    'they',
    'both',
    'does',
    'anyone',
    'my',
    'thank',
    'again',
    'note',
  ]),
  de: new Set([
    'der',
    'die',
    'das',
    'und',
    'ist',
    'ein',
    'eine',
    'nicht',
    'ich',
    'du',
    'sie',
    'wir',
    'den',
    'dem',
    'des',
    'auf',
    'mit',
    'für',
    'von',
    'zu',
    'im',
    'auch',
    'als',
    'an',
    'es',
    'nach',
    'bei',
    'oder',
    'wie',
    'noch',
    'nur',
    'wenn',
    'diese',
    'mir',
    'jemand',
    'woche',
    'kann',
  ]),
  es: new Set([
    'el',
    'la',
    'los',
    'las',
    'de',
    'que',
    'y',
    'en',
    'un',
    'una',
    'es',
    'por',
    'con',
    'para',
    'no',
    'se',
    'del',
    'al',
    'lo',
    'como',
    'más',
    'pero',
    'su',
    'le',
    'si',
    'alguien',
    'tiene',
    'esta',
    'semana',
  ]),
  fil: new Set([
    'ang',
    'ng',
    'sa',
    'mga',
    'ay',
    'at',
    'na',
    'ko',
    'mo',
    'siya',
    'hindi',
    'ito',
    'para',
    'may',
    'kung',
    'dahil',
    'po',
    'ako',
    'ikaw',
    'kayo',
    'ba',
    'ngayong',
    'linggo',
  ]),
};

const DETECTABLE_LOCALES: readonly Locale[] = ['en', 'de', 'es', 'fil'];

/**
 * Detect the language of forum note text.
 *
 * @param text - Raw note body.
 * @returns `en`/`de`/`es`/`fil` when a UI locale wins, `other` when the
 * text is long enough but not those four, or `null` when empty or too short.
 * @throws Does not throw.
 */
export function detectNoteLanguage(text: string): NoteLanguage | null {
  const remaining = text
    .replace(/https?:\/\/\S+/giu, '')
    .replace(/\blnbc[a-z0-9]+\b/giu, '')
    .trim();

  if (remaining.length < 12) {
    return null;
  }

  const tokens = remaining
    .toLowerCase()
    .split(/[^a-zäöüßàáâãéêíóôúüñ]+/iu)
    .filter((token) => token !== '');
  const scores: Record<Locale, number> = { en: 0, de: 0, es: 0, fil: 0 };

  for (const token of tokens) {
    for (const locale of DETECTABLE_LOCALES) {
      if (STOPWORDS[locale].has(token)) {
        scores[locale] += 1;
      }
    }
  }

  if (/[äöüß]/iu.test(remaining)) {
    scores.de += 2;
  }
  if (/[ñ¿¡]/u.test(remaining)) {
    scores.es += 2;
  }

  const topScore = Math.max(...DETECTABLE_LOCALES.map((locale) => scores[locale]));
  if (topScore === 0) {
    return 'other';
  }

  const winners = DETECTABLE_LOCALES.filter((locale) => scores[locale] === topScore);
  /* v8 ignore next -- a one-item winners array always has index zero */
  return winners.length === 1 ? (winners[0] ?? 'other') : 'other';
}

/**
 * Whether to offer Translate for this text in this UI locale.
 *
 * @param text - Raw note body.
 * @param locale - Active UI locale.
 * @returns False when detection is null or equals `locale`; true for
 * `other` or a different UI locale.
 * @throws Does not throw.
 */
export function shouldOfferNoteTranslate(text: string, locale: Locale): boolean {
  const detected = detectNoteLanguage(text);
  return detected !== null && detected !== locale;
}
