import { z } from 'zod';
import { usdAmountStringSchema } from '@/lib/api-types';
import { FIAT_CODES } from '@/lib/stats-money';

const LOAD_ERROR = 'Could not load open loans. Please try again.';

const openLoanIdentity = {
  messageId: z.string().min(1),
  accountId: z.string().min(1),
  /** Live account name. The api sends `''` when the account has none. */
  name: z.string(),
  overdue: z.boolean(),
};

const openBtcLoanSchema = z.object({
  ...openLoanIdentity,
  currency: z.literal('BTC'),
  /** Whole sats still outstanding. Not a fiat string. */
  outstanding: z.number().int().nonnegative(),
});

const openFiatLoanSchema = z.object({
  ...openLoanIdentity,
  currency: z.enum(FIAT_CODES),
  /** Two-decimal string in the loan currency, the same shape as other fiat amounts. */
  outstanding: usdAmountStringSchema,
});

const openLoansSchema = z.array(z.union([openBtcLoanSchema, openFiatLoanSchema]));

/** One open loan from `GET /loans/open`, in the api's field shapes. */
export type OpenLoan = z.infer<typeof openLoansSchema>[number];

/**
 * Load the public open-loan list from same-origin `GET /loans/open`.
 *
 * Sends no `Authorization` header. The body is a JSON array in api order.
 * Fiat `outstanding` is a two-decimal string in the loan currency. BTC
 * `outstanding` is a whole number of sats. A bad status, a non-JSON body, or
 * a body that fails that contract throws; nothing is coerced.
 *
 * @returns Parsed open loans, in the order the api returned.
 * @throws Error `'Could not load open loans. Please try again.'` when the
 *   request fails, the response is not OK, the body is not JSON, or the body
 *   fails the schema. A thrown fetch or a thrown JSON parse is the `cause`.
 */
export async function fetchOpenLoans(): Promise<OpenLoan[]> {
  let response: Response;
  try {
    response = await fetch('/loans/open');
  } catch (error: unknown) {
    throw new Error(LOAD_ERROR, { cause: error });
  }
  if (!response.ok) {
    throw new Error(LOAD_ERROR);
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch (error: unknown) {
    throw new Error(LOAD_ERROR, { cause: error });
  }
  const parsed = openLoansSchema.safeParse(body);
  if (!parsed.success) {
    throw new Error(LOAD_ERROR);
  }
  return parsed.data;
}
