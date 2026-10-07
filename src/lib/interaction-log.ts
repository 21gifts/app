import { useAuthStore } from '@/stores/auth-store';

/** Names of the interactions the app records for the signed-in member. */
export type InteractionName =
  | 'screen_view'
  | 'post_created'
  | 'reply_created'
  | 'gift_sent'
  | 'payment_sent'
  | 'payment_received_seen'
  | 'pos_charge_created'
  | 'pos_charge_paid_seen'
  | 'wallet_unlocked'
  | 'wallet_locked'
  | 'search'
  | 'shop_opened'
  | 'profile_opened'
  | 'login'
  | 'signup_completed';

/** Values an interaction may carry: ids, amounts, counts, and search terms. */
export type InteractionProps = Record<string, string | number | boolean | null>;

/** One interaction event as `POST /me/events` takes it. */
interface InteractionEvent {
  /** Event name. */
  name: InteractionName;
  /** When it happened, ISO 8601. */
  at: string;
  /** Path of the view it happened on, without query or fragment. */
  path: string;
  /** Small flat object of ids, amounts, and counts. */
  props: InteractionProps;
}

/** How often queued events are sent while the app is open. */
export const INTERACTION_FLUSH_MS = 10_000;

/** Most events one request carries. */
export const INTERACTION_BATCH_SIZE = 50;

/** Most events kept while the api cannot be reached; the oldest are dropped first. */
const MAX_QUEUED = 500;

/** Most props one event keeps. */
const MAX_PROPS = 12;

/** Longest string value one prop keeps. */
const MAX_PROP_LENGTH = 200;

/** A prop key: a short identifier. */
const PROP_KEY = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;

/** Key fragments whose prop is never kept, compared lower-case. */
const SECRET_KEY_PARTS = [
  'mnemonic',
  'phrase',
  'seed',
  'prf',
  'preimage',
  'secret',
  'token',
  'password',
  'privkey',
  'private',
  'session',
];

/** String values that look like a secret are never kept. */
const SECRET_VALUES: readonly RegExp[] = [
  // 12 or more BIP-39-shaped words in a row.
  /\b[a-z]{3,8}(?:[\s,"']+[a-z]{3,8}){11,}\b/i,
  // Keys, hashes, and preimages: 64 or more hex digits.
  /[0-9a-f]{64,}/i,
  // Bearer tokens.
  /\bBearer\s/i,
];

/** Path prefixes whose next segment is an access key and is replaced. */
const KEYED_PATHS = ['/view/', '/view-key/'];

/** Events waiting to be sent. */
const queue: InteractionEvent[] = [];

/** True while a flush is sending. */
let flushing = false;

/**
 * Props reduced to short flat values. A key that is not an identifier or that
 * names a secret, a value that is not a string, finite number, boolean, or
 * `null`, and a string that is too long or looks like a secret are left out.
 *
 * @param props - Props as the caller gave them.
 * @returns The kept props.
 */
function cleanProps(props: InteractionProps): InteractionProps {
  const kept: InteractionProps = {};
  let count = 0;
  for (const [key, value] of Object.entries(props)) {
    if (count >= MAX_PROPS) {
      break;
    }
    const lower = key.toLowerCase();
    if (!PROP_KEY.test(key) || SECRET_KEY_PARTS.some((part) => lower.includes(part))) {
      continue;
    }
    if (typeof value === 'number' && !Number.isFinite(value)) {
      continue;
    }
    if (
      typeof value === 'string' &&
      (value.length > MAX_PROP_LENGTH || SECRET_VALUES.some((pattern) => pattern.test(value)))
    ) {
      continue;
    }
    kept[key] = value;
    count += 1;
  }
  return kept;
}

/**
 * Path of the current view without query or fragment. The access key in a
 * public profile path is replaced.
 *
 * @returns The path.
 */
function currentPath(): string {
  const path = window.location.pathname;
  for (const prefix of KEYED_PATHS) {
    if (path.startsWith(prefix)) {
      const rest = path.slice(prefix.length);
      const slash = rest.indexOf('/');
      return `${prefix}[key]${slash === -1 ? '' : rest.slice(slash)}`;
    }
  }
  return path;
}

/**
 * Sends one batch of events of the signed-in member.
 *
 * @param session - Bearer session.
 * @param events - At most {@link INTERACTION_BATCH_SIZE} events.
 * @param keepalive - Set while the page is hidden or closing, so the request outlives it.
 * @returns Resolves once the api accepted the batch.
 * @throws Error on a non-2xx status or a network failure.
 */
async function postEvents(
  session: string,
  events: InteractionEvent[],
  keepalive: boolean,
): Promise<void> {
  const response = await fetch('/me/events', {
    method: 'POST',
    headers: { Authorization: `Bearer ${session}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ events }),
    keepalive,
  });
  if (!response.ok) {
    throw new Error(`Could not send events: ${String(response.status)}`);
  }
}

/**
 * Drops the oldest events beyond {@link MAX_QUEUED}.
 */
function dropOldest(): void {
  if (queue.length > MAX_QUEUED) {
    queue.splice(0, queue.length - MAX_QUEUED);
  }
}

/**
 * Queues one interaction of the signed-in member. Without a session nothing is
 * kept: anonymous visits are not recorded. A full batch is sent at once. Never
 * throws: an event that cannot be built is dropped.
 *
 * @param name - What happened.
 * @param props - Ids, amounts, counts, or a search term; never a secret.
 */
export function logInteraction(name: InteractionName, props: InteractionProps = {}): void {
  if (useAuthStore.getState().session === null) {
    return;
  }
  let event: InteractionEvent;
  try {
    event = { name, at: new Date().toISOString(), path: currentPath(), props: cleanProps(props) };
  } catch {
    // Recording never breaks the action it records.
    return;
  }
  queue.push(event);
  dropOldest();
  if (queue.length >= INTERACTION_BATCH_SIZE) {
    void flushInteractions();
  }
}

/**
 * Sends the queued events in batches of {@link INTERACTION_BATCH_SIZE}. Without
 * a session the queue is dropped. A failed batch goes back to the front of
 * the queue and the next flush tries again. Never rejects.
 *
 * @param keepalive - Set while the page is hidden or closing.
 * @returns Resolves when the queue is empty, a batch failed, or another flush is running.
 */
export async function flushInteractions(keepalive = false): Promise<void> {
  if (flushing) {
    return;
  }
  const session = useAuthStore.getState().session;
  if (session === null) {
    queue.length = 0;
    return;
  }
  flushing = true;
  try {
    while (queue.length > 0) {
      const batch = queue.splice(0, INTERACTION_BATCH_SIZE);
      try {
        await postEvents(session, batch, keepalive);
      } catch {
        queue.unshift(...batch);
        dropOldest();
        return;
      }
    }
  } finally {
    flushing = false;
  }
}

/**
 * Starts sending queued events every {@link INTERACTION_FLUSH_MS} and when the
 * page is hidden or closed.
 *
 * @returns Stops the timer and removes the listeners.
 */
export function startInteractionLog(): () => void {
  const timer = setInterval(() => {
    void flushInteractions();
  }, INTERACTION_FLUSH_MS);
  const onHide = (): void => {
    void flushInteractions(true);
  };
  const onVisibility = (): void => {
    if (document.visibilityState === 'hidden') {
      onHide();
    }
  };
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', onHide);
  return () => {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', onHide);
  };
}
