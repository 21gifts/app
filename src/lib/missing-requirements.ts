/** Requirement keys the api may list as still missing for a post. */
export type MissingRequirement = 'name' | 'lightning-address' | 'rules';

/**
 * Api 409 `missing_requirements` rejection for forum or contact posts.
 */
export class MissingRequirementsError extends Error {
  readonly missing: MissingRequirement[];

  /**
   * @param missing - Requirement keys from the api body.
   */
  constructor(missing: MissingRequirement[]) {
    super('missing_requirements');
    this.name = 'MissingRequirementsError';
    this.missing = missing;
  }
}

const REQUIREMENT_SET = new Set<string>(['name', 'lightning-address', 'rules']);

/**
 * Parses a 409 `missing_requirements` body into {@link MissingRequirementsError}.
 *
 * @param body - Parsed JSON body, or unknown.
 * @returns The error when the body matches, otherwise `null`.
 */
export function parseMissingRequirements(body: unknown): MissingRequirementsError | null {
  if (body === null || typeof body !== 'object') {
    return null;
  }
  const record = body as { error?: unknown; missing?: unknown };
  if (record.error !== 'missing_requirements') {
    return null;
  }
  if (!Array.isArray(record.missing)) {
    return null;
  }
  const missing: MissingRequirement[] = [];
  for (const item of record.missing) {
    if (typeof item !== 'string' || !REQUIREMENT_SET.has(item)) {
      return null;
    }
    missing.push(item as MissingRequirement);
  }
  return new MissingRequirementsError(missing);
}

/**
 * Next overlay field to collect before a post: rules before name.
 * Lightning-address-only gaps do not open an overlay.
 *
 * @param missing - Account or 409 missing list.
 * @returns `'rules'`, `'name'`, or `null` when posting may proceed.
 */
export function nextPostRequirement(
  missing: readonly MissingRequirement[],
): 'rules' | 'name' | null {
  if (missing.includes('rules')) {
    return 'rules';
  }
  if (missing.includes('name')) {
    return 'name';
  }
  return null;
}
