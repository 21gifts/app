/** Keys whose value is always removed, compared lower-case and exactly. */
export const SENSITIVE_KEYS: ReadonlySet<string> = new Set(['pr', 'words', '21gifts.session']);

/** Key fragments whose value is always removed, compared lower-case. */
export const SENSITIVE_KEY_PARTS: readonly string[] = [
  'mnemonic',
  'phrase',
  'seed',
  'share',
  'slip39',
  'prf',
  'token',
  'secret',
  'invoice',
  'password',
  'authorization',
  'cookie',
  'query',
  'fragment',
];
