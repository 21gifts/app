/** Ordered living-room rules chapter ids (onboarding and public document). */
export const RULES_CHAPTER_IDS = [
  'lead',
  'law1',
  'law2',
  'law3',
  'wanted',
  'allowed',
  'ratherNot',
  'forbidden',
  'house',
] as const;

/** One chapter in {@link RULES_CHAPTER_IDS}. */
export type RulesChapterId = (typeof RULES_CHAPTER_IDS)[number];
