import { FORUM_MESSAGE_MAX_LENGTH } from '@/lib/api-types';

/**
 * Shared entry checks for visitor forms.
 *
 * Forum and contact text use UTF-16 length after trim, the same count as the
 * message API. Habit text uses Unicode code points, the same count as
 * PostgreSQL `char_length`. A place label uses UTF-16 length after trim and
 * rejects controls with the same API sentence as an over-long name.
 */

/** Living-room place name limit, matching the place API. */
export const PLACE_LABEL_MAX_LENGTH = 80;

/** Habit name limit, matching `char_length(name) BETWEEN 1 AND 80`. */
export const HABIT_NAME_MAX_LENGTH = 80;

/** Habit description, notes, and comment limit. */
export const HABIT_TEXT_MAX_LENGTH = 2000;

/** Exact api rejection for a habit name. */
export const HABIT_NAME_API_MESSAGE = 'Invalid name';

/** Exact api rejection for a habit description. */
export const HABIT_DESCRIPTION_API_MESSAGE = 'Invalid description';

/** Exact api rejection for habit notes. */
export const HABIT_NOTES_API_MESSAGE = 'Invalid notes';

/** Exact api rejection for a habit comment. */
export const HABIT_COMMENT_API_MESSAGE = 'Invalid comment';

/** Exact api rejection for a place label that is too long or has a control. */
export const PLACE_LABEL_API_MESSAGE = 'Place label must be at most 80 characters';

/** Problem on a required text field. */
export type RequiredTextProblem = 'empty' | 'tooLong';

/**
 * Unicode code points, the same count as PostgreSQL `char_length`.
 *
 * @param value - Text already prepared the way the api prepares it.
 * @returns The number of code points.
 */
function codePointLength(value: string): number {
  return [...value].length;
}

/**
 * Required text problem, in message-API order: trim, then empty, then length.
 *
 * @param raw - Typed text. Inner spaces stay.
 * @param max - Maximum UTF-16 length after trim.
 * @returns `'empty'` when blank after trim, `'tooLong'` over `max`, otherwise `null`.
 */
export function entryTextProblem(raw: string, max: number): RequiredTextProblem | null {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return 'empty';
  }
  if (trimmed.length > max) {
    return 'tooLong';
  }
  return null;
}

/**
 * Optional text problem. Blank after trim is valid.
 *
 * @param raw - Typed text. Inner spaces stay.
 * @param max - Maximum UTF-16 length after trim.
 * @returns `'tooLong'` over `max`, otherwise `null`.
 */
export function optionalTextProblem(raw: string, max: number): 'tooLong' | null {
  const trimmed = raw.trim();
  if (trimmed.length > max) {
    return 'tooLong';
  }
  return null;
}

/**
 * Composer text. A photo or video makes a blank message valid. Over-length never is.
 *
 * @param raw - Typed message.
 * @param max - Maximum UTF-16 length after trim.
 * @param hasMedia - True when a photo or video is attached.
 * @returns `'tooLong'` over `max`, `'empty'` when blank without media, otherwise `null`.
 */
export function composerTextProblem(
  raw: string,
  max: number,
  hasMedia: boolean,
): RequiredTextProblem | null {
  const trimmed = raw.trim();
  if (trimmed.length > max) {
    return 'tooLong';
  }
  if (trimmed === '' && !hasMedia) {
    return 'empty';
  }
  return null;
}

/**
 * Which problem to show. Empty waits for blur or submit. Any other problem shows at once.
 *
 * @param problem - Current problem, or `null` when the draft is acceptable.
 * @param touched - True after blur or submit.
 * @returns The problem to render, or `null` while an untouched field is empty.
 */
export function shownEntryProblem<T extends string>(problem: T | null, touched: boolean): T | null {
  if (problem === null) {
    return null;
  }
  if (problem === 'empty') {
    return touched ? problem : null;
  }
  return problem;
}

/**
 * True when a reply is over 8000 characters.
 * The `inReplyTo:` line is counted only when this submit stores it.
 * An explicit amount, and an exempt viewer, are checked on the typed text only.
 *
 * @param draft - Reply text.
 * @param parentId - Note the reply answers, or `null` when there is none.
 * @param exempt - True when this viewer may reply without the payment prefix.
 * @param countPrefix - True when this submit stores the `inReplyTo:` line.
 * @returns Whether the reply is too long.
 */
export function replyTextIsTooLong(
  draft: string,
  parentId: string | null,
  exempt: boolean,
  countPrefix: boolean,
): boolean {
  const trimmed = draft.trim();
  const overhead =
    parentId === null || exempt || !countPrefix ? 0 : `inReplyTo:${parentId}\n`.length;
  return trimmed.length + overhead > FORUM_MESSAGE_MAX_LENGTH;
}

/**
 * True when `value` contains a C0 control or DEL.
 *
 * @param value - Already trimmed text.
 * @returns Whether a rejected control is present.
 */
function hasControl(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code < 32 || code === 127) {
      return true;
    }
  }
  return false;
}

/**
 * Living-room place name. Empty is a valid clear. Length and controls share one API sentence.
 *
 * @param raw - Typed place name.
 * @returns `'tooLong'` over 80 characters or when a control is present, otherwise `null`.
 */
export function placeLabelProblem(raw: string): 'tooLong' | null {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return null;
  }
  if (optionalTextProblem(trimmed, PLACE_LABEL_MAX_LENGTH) === 'tooLong' || hasControl(trimmed)) {
    return 'tooLong';
  }
  return null;
}

/**
 * Habit field problem, matching the member-habit route.
 *
 * Name and comment are trimmed, then measured in code points. Description and
 * notes are not trimmed: the api counts the raw text.
 *
 * @param kind - Which habit field.
 * @param raw - Typed text.
 * @returns `'empty'` when a required field is blank, `'tooLong'` over the limit, otherwise `null`.
 */
export function habitTextProblem(
  kind: 'name' | 'description' | 'notes' | 'comment',
  raw: string,
): RequiredTextProblem | null {
  if (kind === 'description' || kind === 'notes') {
    if (codePointLength(raw) > HABIT_TEXT_MAX_LENGTH) {
      return 'tooLong';
    }
    return null;
  }
  const trimmed = raw.trim();
  const length = codePointLength(trimmed);
  if (length < 1) {
    return 'empty';
  }
  const max = kind === 'name' ? HABIT_NAME_MAX_LENGTH : HABIT_TEXT_MAX_LENGTH;
  if (length > max) {
    return 'tooLong';
  }
  return null;
}
