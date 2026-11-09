/** Identifiers for a payment sender lookup. */
export interface PaymentSenderRequest {
  /** SDK payment id. */
  id: string;
  /** Payment request, if available. */
  invoice: string | null;
  /** Payment hash, if available. */
  paymentHash: string | null;
}

/** A sender returned for a payment. */
export interface PaymentSender {
  /** SDK payment id. */
  id: string;
  /** Sender's account id. */
  accountId: string;
  /** Sender's username. */
  username: string;
}

function isPaymentSender(value: unknown): value is PaymentSender {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const row = value as Record<string, unknown>;
  return (
    typeof row['id'] === 'string' &&
    row['id'].length > 0 &&
    typeof row['accountId'] === 'string' &&
    row['accountId'].trim().length > 0 &&
    typeof row['username'] === 'string' &&
    row['username'].trim().length > 0
  );
}

/**
 * Resolve payment senders; invalid responses and failures yield no matches.
 *
 * @param sessionToken - Current member session.
 * @param payments - Payment identifiers to resolve.
 * @returns Valid sender rows, or an empty array.
 */
export async function fetchPaymentSenders(
  sessionToken: string,
  payments: readonly PaymentSenderRequest[],
): Promise<PaymentSender[]> {
  try {
    const response = await fetch('/me/wallet/senders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ payments }),
    });
    if (!response.ok) {
      return [];
    }
    const body: unknown = await response.json();
    if (
      typeof body !== 'object' ||
      body === null ||
      !Array.isArray((body as { senders?: unknown }).senders)
    ) {
      return [];
    }
    return (body as { senders: unknown[] }).senders.filter(isPaymentSender);
  } catch {
    return [];
  }
}
