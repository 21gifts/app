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
  | 'search'
  | 'shop_opened'
  | 'profile_opened'
  | 'login'
  | 'logout'
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

/** How long one events request may take before it is aborted and counts as failed. */
export const INTERACTION_REQUEST_TIMEOUT_MS = 10_000;

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

/**
 * Largest request body one batch may have. Every request is sent with
 * `keepalive`, whose body the browser caps at 64 KiB.
 */
const MAX_BATCH_BYTES = 60_000;

/** Measures request bodies in UTF-8 bytes, as the browser counts them. */
const encoder = new TextEncoder();

/** Events waiting to be sent. */
const queue: InteractionEvent[] = [];

/** Session the queued events belong to. */
let queueSession: string | null = null;

/** The flush that is sending, with its session (`done` is `false` when a batch failed), or `null`. */
let flushRun: { session: string; done: Promise<boolean> } | null = null;

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
 * @returns Resolves once the api accepted the batch.
 * @throws Error on a non-2xx status or a network failure.
 */
async function postEvents(session: string, events: InteractionEvent[]): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, INTERACTION_REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch('/me/events', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ events }),
      keepalive: true,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
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
 * kept: anonymous visits are not recorded. Events queued under another
 * session are dropped first. A full batch is sent at once. Never throws: an
 * event that cannot be built is dropped.
 *
 * @param name - What happened.
 * @param props - Ids, amounts, counts, or a search term; never a secret.
 * @param actionSession - Session the recorded action ran under, for an event
 *   recorded after an await. When given and no longer the current session
 *   (`null` included), the event is dropped, so it is never queued for
 *   another member. Omitted, the current session is used.
 */
export function logInteraction(
  name: InteractionName,
  props: InteractionProps = {},
  actionSession?: string | null,
): void {
  const session = useAuthStore.getState().session;
  if (session === null || (actionSession !== undefined && actionSession !== session)) {
    return;
  }
  if (session !== queueSession) {
    // Events of another member are never sent with this session.
    queue.length = 0;
    queueSession = session;
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
 * Takes the next batch off the queue: at most {@link INTERACTION_BATCH_SIZE}
 * events and at most {@link MAX_BATCH_BYTES} UTF-8 bytes of JSON, and always
 * at least one.
 *
 * @returns The batch.
 */
function nextBatch(): InteractionEvent[] {
  let count = 0;
  let bytes = 0;
  for (const event of queue) {
    bytes += encoder.encode(JSON.stringify(event)).length + 1;
    if (count === INTERACTION_BATCH_SIZE || (count > 0 && bytes > MAX_BATCH_BYTES)) {
      break;
    }
    count += 1;
  }
  return queue.splice(0, count);
}

/**
 * Sends the queued events in batches of at most {@link INTERACTION_BATCH_SIZE}
 * and {@link MAX_BATCH_BYTES}, each with `keepalive`, so a request still in
 * flight when the page closes is delivered. Events go out only with the
 * session they were recorded under: without a session, or with another one,
 * the queue is dropped. A request that has not answered after
 * {@link INTERACTION_REQUEST_TIMEOUT_MS} is aborted. A failed batch goes back
 * to the front of the queue and the next flush tries again. One flush per
 * session runs at a time; a flush of an earlier session does not hold a new
 * session's queue back. Never rejects.
 *
 * @returns Resolves when the queue is empty, a batch failed, the session
 *   changed, or another flush of this session is running.
 */
export async function flushInteractions(): Promise<void> {
  await flush();
}

/**
 * Starts one flush unless one is running (see {@link flushInteractions}).
 *
 * @returns `false` when a batch of this flush failed, otherwise `true`.
 */
function flush(): Promise<boolean> {
  const session = useAuthStore.getState().session;
  if (session === null || session !== queueSession) {
    queue.length = 0;
    return Promise.resolve(true);
  }
  if (flushRun !== null && flushRun.session === session) {
    return Promise.resolve(true);
  }
  // A flush of an earlier session still waiting on its request does not hold
  // this session's queue back; that flush stops after its batch.
  const run = {
    session,
    done: sendQueue(session).finally(() => {
      if (flushRun === run) {
        flushRun = null;
      }
    }),
  };
  flushRun = run;
  return run.done;
}

/**
 * Sends the queue in batches while it still belongs to `session`.
 *
 * @param session - Session the queued events were recorded under.
 * @returns `false` when a batch failed, otherwise `true` (the queue is empty or the session changed).
 */
async function sendQueue(session: string): Promise<boolean> {
  while (queue.length > 0 && queueSession === session) {
    const batch = nextBatch();
    try {
      await postEvents(session, batch);
    } catch {
      if (queueSession === session) {
        queue.unshift(...batch);
        dropOldest();
      }
      return false;
    }
  }
  return true;
}

/** How long {@link logLogout} waits before it sends a failed batch again. */
export const LOGOUT_RETRY_MS = 500;

/**
 * Records `logout` and sends the queue with the session that is ending, so
 * the caller can clear the session afterwards. Waits for a flush already
 * running, then sends what it left; a failed batch is sent again every
 * {@link LOGOUT_RETRY_MS} until it is accepted or the session is no longer
 * the current one (the caller bounds the wait and then clears it). Without a
 * session nothing is recorded or sent. Never rejects.
 *
 * @returns Resolves when the queue is sent or the session ended.
 */
export async function logLogout(): Promise<void> {
  const session = useAuthStore.getState().session;
  logInteraction('logout');
  while (session !== null && useAuthStore.getState().session === session) {
    const running = flushRun?.session === session ? flushRun.done : null;
    const sent = await (running ?? flush());
    if (running !== null) {
      continue;
    }
    if (sent) {
      return;
    }
    await new Promise<void>((resolve) => {
      setTimeout(resolve, LOGOUT_RETRY_MS);
    });
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
    void flushInteractions();
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
