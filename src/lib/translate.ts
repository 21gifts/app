import type { MessageKey, Messages } from '@/lib/messages';

function branchEnd(template: string, start: number): number {
  let index = start;
  while (index < template.length) {
    if (template[index] === '{') {
      const placeholder = template.slice(index).match(/^\{[A-Za-z_][A-Za-z0-9_]*\}/);
      if (placeholder !== null) {
        index += placeholder[0].length;
        continue;
      }
    }
    if (template[index] === '}') return index;
    index += 1;
  }
  return -1;
}

function expandPlurals(template: string, count: number): string {
  let result = template;
  let searchFrom = 0;
  while (true) {
    const start = result.indexOf('{count, plural,', searchFrom);
    if (start < 0) return result;
    const header = result.slice(start).match(/^\{count,\s*plural,\s*one\s*\{/);
    if (header === null) {
      searchFrom = start + 1;
      continue;
    }
    const oneStart = start + header[0].length;
    const oneEnd = branchEnd(result, oneStart);
    if (oneEnd < 0) return result;
    const otherHeader = result.slice(oneEnd + 1).match(/^\s*other\s*\{/);
    if (otherHeader === null) return result;
    const otherStart = oneEnd + 1 + otherHeader[0].length;
    const otherEnd = branchEnd(result, otherStart);
    if (otherEnd < 0 || result[otherEnd + 1] !== '}') return result;

    const branch =
      count === 1 ? result.slice(oneStart, oneEnd) : result.slice(otherStart, otherEnd);
    const replacement = branch.replaceAll('#', String(count));
    result = result.slice(0, start) + replacement + result.slice(otherEnd + 2);
    searchFrom = start + replacement.length;
  }
}

/**
 * Look up `key` in `catalog`, expand a `{count, plural, one {…} other {…}}` branch, then replace `{name}` from `vars`.
 *
 * @param catalog - Message catalog for one locale.
 * @param key - Catalog key to resolve.
 * @param vars - Placeholder values. `count` selects `one` when it is 1 and `other` otherwise. `#` inside the chosen branch becomes that count. Other `{name}` tokens come from `vars`.
 * @returns The interpolated string. A broken plural header is left in place.
 * @throws If the key is missing, a `{count, plural` header has no finite `count`, or a `{name}` has no `vars[name]`.
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

  let expanded = template;
  if (template.includes('{count, plural')) {
    if (vars === undefined || !Object.prototype.hasOwnProperty.call(vars, 'count')) {
      throw new Error(`Missing placeholder {count} for key ${key}`);
    }
    const count = Number(vars['count']);
    if (!Number.isFinite(count)) {
      throw new Error(`Missing placeholder {count} for key ${key}`);
    }
    expanded = expandPlurals(template, count);
  }

  return expanded.replace(
    /\{([A-Za-z_][A-Za-z0-9_]*)\}/g,
    (match, name: string, offset: number) => {
      const before = expanded.slice(0, offset);
      // A broken plural header leaves `one {A}` / `other {B}`, which is the
      // branch brace, not a `{name}` placeholder.
      if (
        /\{count,\s*plural,\s*one\s*$/.test(before) ||
        /\{count,\s*plural,\s*one\s*\{[^{}]*\}\s*other\s*$/.test(before)
      ) {
        return match;
      }
      if (vars === undefined || !Object.prototype.hasOwnProperty.call(vars, name)) {
        throw new Error(`Missing placeholder {${name}} for key ${key}`);
      }
      const value = vars[name];
      if (value === undefined) {
        throw new Error(`Missing placeholder {${name}} for key ${key}`);
      }
      return String(value);
    },
  );
}
