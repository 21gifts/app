/** The forum post attached to one heart payment. */
export interface HeartPost {
  /** Lowercase Spark payment hash. */
  paymentHash: string;
  /** Forum message the heart was sent on. */
  messageId: string;
  /** Current display name of the post author. */
  authorName: string;
  /** Current post text. */
  text: string;
  /** Whether the post has been deleted. */
  deleted: boolean;
}

/** The credit note and repayment day behind one loan repayment payment. */
export interface RepaymentContext {
  /** Lowercase Spark payment hash. */
  paymentHash: string;
  /** Credit note the repayment belongs to. */
  messageId: string;
  /** Zero-based day of the loan term this repayment covers. */
  dayIndex: number;
  /** Length of the loan term in days, or `null` when the note has none. */
  termDays: number | null;
  /** `borrower` when the signed-in member paid it, `giver` when the member is being repaid. */
  role: 'borrower' | 'giver';
  /** Current display name of the credit note author (the borrower); may be empty. */
  authorName: string;
  /** Current credit note text, clipped; may be empty. */
  text: string;
  /** Whether the credit note has been deleted. */
  deleted: boolean;
}

/** What the wallet hearts lookup found for a set of payment hashes. */
export interface HeartLookup {
  /** Heart payments and the posts they were sent on. */
  hearts: HeartPost[];
  /** Loan repayments and their credit notes. */
  repayments: RepaymentContext[];
}

const PAYMENT_HASH = /^[0-9a-f]{64}$/;

function isHeartPost(value: unknown): value is HeartPost {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const row = value as Record<string, unknown>;
  const paymentHash = row['paymentHash'];
  const messageId = row['messageId'];
  const authorName = row['authorName'];
  const text = row['text'];
  const deleted = row['deleted'];
  return (
    typeof paymentHash === 'string' &&
    PAYMENT_HASH.test(paymentHash) &&
    typeof messageId === 'string' &&
    messageId.length > 0 &&
    typeof authorName === 'string' &&
    typeof text === 'string' &&
    typeof deleted === 'boolean'
  );
}

function isRepaymentContext(value: unknown): value is RepaymentContext {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const row = value as Record<string, unknown>;
  const paymentHash = row['paymentHash'];
  const messageId = row['messageId'];
  const dayIndex = row['dayIndex'];
  const termDays = row['termDays'];
  const role = row['role'];
  const authorName = row['authorName'];
  const text = row['text'];
  const deleted = row['deleted'];
  return (
    typeof paymentHash === 'string' &&
    PAYMENT_HASH.test(paymentHash) &&
    typeof messageId === 'string' &&
    messageId.length > 0 &&
    typeof dayIndex === 'number' &&
    Number.isInteger(dayIndex) &&
    dayIndex >= 0 &&
    (termDays === null ||
      (typeof termDays === 'number' && Number.isInteger(termDays) && termDays >= 1)) &&
    (role === 'borrower' || role === 'giver') &&
    typeof authorName === 'string' &&
    typeof text === 'string' &&
    typeof deleted === 'boolean'
  );
}

function noMatches(): HeartLookup {
  return { hearts: [], repayments: [] };
}

/**
 * Looks up the forum posts attached to the signed-in member's heart payments
 * and the credit notes behind their loan repayments. Invalid responses and
 * failed requests are treated as no matches. A missing or malformed
 * `repayments` key (an api from before repayments) is no repayments.
 *
 * @param sessionToken - Current member session.
 * @param hashes - Spark payment hashes to look up.
 * @returns Valid heart and repayment rows from the response, both empty on failure.
 */
export async function fetchHeartPosts(
  sessionToken: string,
  hashes: readonly string[],
): Promise<HeartLookup> {
  try {
    const response = await fetch('/me/wallet/hearts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ hashes: hashes.map((hash) => hash.toLowerCase()) }),
    });
    if (!response.ok) {
      return noMatches();
    }
    const body: unknown = await response.json();
    if (typeof body !== 'object' || body === null) {
      return noMatches();
    }
    const { hearts, repayments } = body as { hearts?: unknown; repayments?: unknown };
    return {
      hearts: Array.isArray(hearts) ? hearts.filter(isHeartPost) : [],
      repayments: Array.isArray(repayments) ? repayments.filter(isRepaymentContext) : [],
    };
  } catch {
    return noMatches();
  }
}
