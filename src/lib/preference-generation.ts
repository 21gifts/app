let localeGenerationValue = 0;
let fiatGenerationValue = 0;

/**
 * Marks a newer explicit language choice.
 *
 * @returns The new locale generation.
 */
export function bumpLocaleGeneration(): number {
  localeGenerationValue += 1;
  return localeGenerationValue;
}

/**
 * Returns the latest explicit language-choice generation.
 *
 * @returns The current locale generation.
 */
export function localeGeneration(): number {
  return localeGenerationValue;
}

/**
 * Marks a newer explicit currency choice.
 *
 * @returns The new fiat generation.
 */
export function bumpFiatGeneration(): number {
  fiatGenerationValue += 1;
  return fiatGenerationValue;
}

/**
 * Returns the latest explicit currency-choice generation.
 *
 * @returns The current fiat generation.
 */
export function fiatGeneration(): number {
  return fiatGenerationValue;
}
