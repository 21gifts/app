import type { MessageKey, Messages } from '@/lib/messages';

/**
 * Look up `key` in `catalog` and replace `{name}` from `vars`.
 *
 * @param catalog - Message catalog for one locale.
 * @param key - Catalog key to resolve.
 * @param vars - Placeholder values for `{name}` tokens in the template.
 * @returns The interpolated string.
 * @throws If the key is missing or a `{name}` has no `vars[name]`.
 */
export function translate(
  catalog: Messages,
  key: MessageKey,
  vars?: Record<string, string | number>,
): string {
  const template = catalog[key];
  if (template === undefined) {
    throw new Error(`Missing message key: ${key}`);
  }

  return template.replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_match, name: string) => {
    if (vars === undefined || !Object.prototype.hasOwnProperty.call(vars, name)) {
      throw new Error(`Missing placeholder {${name}} for key ${key}`);
    }
    const value = vars[name];
    if (value === undefined) {
      throw new Error(`Missing placeholder {${name}} for key ${key}`);
    }
    return String(value);
  });
}
