import { z } from 'zod';

/** Runtime-validated public weekly tracker response. */
export const habitTrackerSchema = z.object({
  week: z.object({ start: z.string(), label: z.string(), nextAt: z.number() }),
  currentWeek: z.string(),
  firstWeek: z.string(),
  habits: z.array(
    z.object({
      id: z.string(),
      accountId: z.string(),
      role: z.enum(['founder', 'initiator']),
      name: z.string(),
      text: z.string(),
      firstWeek: z.string(),
      lastWeek: z.string().nullable(),
    }),
  ),
  results: z.array(
    z.object({
      habitId: z.string(),
      week: z.string(),
      status: z.enum(['achieved', 'partial', 'missed']),
    }),
  ),
  comments: z.array(
    z.object({
      id: z.string(),
      accountId: z.string(),
      name: z.string(),
      text: z.string(),
      week: z.string(),
      createdAt: z.number(),
    }),
  ),
});
/** Validated tracker payload. */
export type HabitTrackerData = z.infer<typeof habitTrackerSchema>;
