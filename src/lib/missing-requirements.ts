/** Requirement keys the api may list as still missing for a post. */
export type MissingRequirement = 'name' | 'username' | 'lightning-address' | 'rules';

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

const REQUIREMENT_SET = new Set<string>(['name', 'username', 'lightning-address', 'rules']);

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
 * Next overlay field to collect before a forum post: rules, then name, then
 * username, then lightning-address.
 *
 * @param missing - Account or 409 missing list (`wallet` is ignored; it is
 *   not a posting overlay field).
 * @returns `'rules'`, `'name'`, `'username'`, `'lightning-address'`, or `null` when posting may proceed.
 */
export function nextPostRequirement(
  missing: readonly string[],
): 'rules' | 'name' | 'username' | 'lightning-address' | null {
  if (missing.includes('rules')) {
    return 'rules';
  }
  if (missing.includes('name')) {
    return 'name';
  }
  if (missing.includes('username')) {
    return 'username';
  }
  if (missing.includes('lightning-address')) {
    return 'lightning-address';
  }
  return null;
}

/**
 * Next overlay field to collect before a contact send: rules, then name,
 * then username. Lightning-address gaps do not open an overlay for contact.
 *
 * @param missing - Account or 409 missing list.
 * @returns `'rules'`, `'name'`, `'username'`, or `null` when the send may proceed.
 */
export function nextContactRequirement(
  missing: readonly string[],
): 'rules' | 'name' | 'username' | null {
  if (missing.includes('rules')) {
    return 'rules';
  }
  if (missing.includes('name')) {
    return 'name';
  }
  if (missing.includes('username')) {
    return 'username';
  }
  return null;
}
