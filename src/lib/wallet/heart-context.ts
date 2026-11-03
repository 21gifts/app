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

/**
 * Looks up the forum posts attached to the signed-in member's heart payments.
 * Invalid responses and failed requests are treated as no matches.
 *
 * @param sessionToken - Current member session.
 * @param hashes - Spark payment hashes to look up.
 * @returns Valid heart rows from the response, or an empty array on failure.
 */
export async function fetchHeartPosts(
  sessionToken: string,
  hashes: readonly string[],
): Promise<HeartPost[]> {
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
      return [];
    }
    const body: unknown = await response.json();
    if (
      typeof body !== 'object' ||
      body === null ||
      !Array.isArray((body as { hearts?: unknown }).hearts)
    ) {
      return [];
    }
    return (body as { hearts: unknown[] }).hearts.filter(isHeartPost);
  } catch {
    return [];
  }
}
