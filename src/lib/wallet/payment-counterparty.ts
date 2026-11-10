/** Identifiers for a payment counterparty lookup. */
export interface PaymentCounterpartyRequest {
  /** SDK payment id. */
  id: string;
  /** Incoming or outgoing payment. */
  direction: 'in' | 'out';
}

/** A counterparty returned for a payment. */
export interface PaymentCounterparty {
  /** SDK payment id. */
  id: string;
  /** Counterparty's account id. */
  accountId: string;
  /** Counterparty's username. */
  username: string;
}

/**
 * Whether a payment request starts with a Spark address or invoice prefix.
 *
 * @param value - Payment request to inspect.
 * @returns True for a Spark prefix.
 */
export function isSparkPaymentRequest(value: string): boolean {
  return /^(?:spark(?:rt)?|sp|sprt|spt)1/i.test(value);
}

function isPaymentCounterparty(value: unknown): value is PaymentCounterparty {
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
 * Resolve payment counterparties; invalid responses and failures yield no matches.
 *
 * @param sessionToken - Current member session.
 * @param payments - Payment identifiers to resolve.
 * @returns Valid counterparty rows, or an empty array.
 */
export async function fetchPaymentCounterparties(
  sessionToken: string,
  payments: readonly PaymentCounterpartyRequest[],
): Promise<PaymentCounterparty[]> {
  try {
    const response = await fetch('/me/wallet/counterparties', {
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
      !Array.isArray((body as { counterparties?: unknown }).counterparties)
    ) {
      return [];
    }
    return (body as { counterparties: unknown[] }).counterparties.filter(isPaymentCounterparty);
  } catch {
    return [];
  }
}
