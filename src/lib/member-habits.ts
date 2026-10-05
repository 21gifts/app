import { z } from 'zod';
import { deviceTimeZoneHeader } from '@/lib/api';

const LOAD_ERROR = 'Could not load the habit tracker. Please try again.';
const SAVE_ERROR = 'Could not save the habit tracker. Please try again.';

const memberHabitStatusSchema = z.enum(['achieved', 'partial', 'missed']);

const memberHabitCommentSchema = z.object({
  id: z.string(),
  habitId: z.string(),
  accountId: z.string(),
  name: z.string(),
  text: z.string(),
  week: z.string(),
  createdAt: z.number(),
});

const memberHabitPeriodSchema = z.object({
  period: z.string(),
  name: z.string(),
  description: z.string(),
  logged: z.boolean(),
  status: memberHabitStatusSchema.nullable(),
});

const memberHabitSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  ownerName: z.string(),
  role: z.string(),
  name: z.string(),
  description: z.string(),
  cadence: z.enum(['daily', 'weekly']),
  timeZone: z.string(),
  firstPeriod: z.string(),
  lastPeriod: z.string().nullable(),
  notes: z.string().optional(),
  periods: z.array(memberHabitPeriodSchema),
  comments: z.array(memberHabitCommentSchema),
});

const memberHabitListSchema = z.object({
  reviewWeek: z.object({
    start: z.string(),
    commentsOpen: z.boolean(),
  }),
  habits: z.array(memberHabitSchema),
});

/** Public habit-tracker payload from `GET /habits`. */
export type MemberHabitList = z.infer<typeof memberHabitListSchema>;

/**
 * Load the public habit tracker from same-origin `GET /habits`.
 *
 * Sends `Authorization: Bearer` only when `sessionToken` is a non-empty string.
 *
 * @param sessionToken - Signed-in bearer token, or `null` when signed out.
 * @returns The parsed habit list.
 * @throws Error `'Could not load the habit tracker. Please try again.'` when
 *   the response is not OK or the body fails the schema.
 */
export async function fetchMemberHabits(sessionToken: string | null): Promise<MemberHabitList> {
  const headers: Record<string, string> = {};
  if (sessionToken !== null && sessionToken !== '') {
    headers['Authorization'] = `Bearer ${sessionToken}`;
  }
  const response = await fetch('/habits', { headers });
  if (!response.ok) {
    throw new Error(LOAD_ERROR);
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error(LOAD_ERROR);
  }
  const parsed = memberHabitListSchema.safeParse(body);
  if (!parsed.success) {
    throw new Error(LOAD_ERROR);
  }
  return parsed.data;
}

/**
 * Post a habit-tracker action to same-origin `POST /habits`.
 *
 * Always sends `Authorization: Bearer` and `Content-Type: application/json`.
 * When `timeZone` is true, also spreads {@link deviceTimeZoneHeader}.
 *
 * @param sessionToken - Signed-in bearer token.
 * @param body - JSON action payload.
 * @param timeZone - Whether to send the device `Time-Zone` header.
 * @returns The JSON body when the response is OK.
 * @throws Error with the api `error` string when present, otherwise
 *   `'Could not save the habit tracker. Please try again.'`.
 */
export async function postMemberHabit(
  sessionToken: string,
  body: Record<string, unknown>,
  timeZone: boolean,
): Promise<unknown> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${sessionToken}`,
    'Content-Type': 'application/json',
  };
  if (timeZone) {
    Object.assign(headers, deviceTimeZoneHeader());
  }
  const response = await fetch('/habits', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (response.ok) {
    try {
      return await response.json();
    } catch {
      throw new Error(SAVE_ERROR);
    }
  }
  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    throw new Error(SAVE_ERROR);
  }
  if (
    parsed !== null &&
    typeof parsed === 'object' &&
    'error' in parsed &&
    typeof parsed.error === 'string'
  ) {
    throw new Error(parsed.error);
  }
  throw new Error(SAVE_ERROR);
}
