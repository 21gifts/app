#!/usr/bin/env node
/**
 * In-process 21.gifts api stub for Playwright. Speaks the public HTTP
 * protocol so Next.js same-origin proxies succeed. Not a Lightning node:
 * callbacks accept any signature. Pay-on-note uses POST /messages/:id/invoice.
 */
import http from 'node:http';
import { createHash, randomBytes } from 'node:crypto';

const PORT = 3001;
const HOST = '127.0.0.1';

/** @type {Map<string, object>} */
const byToken = new Map();
/** @type {Map<string, { type: 'register' | 'authenticate' | 'replace' | 'seed', account?: object, requestedName?: string, claimAccountId?: string, accountId?: string }>} */
const byPasskey = new Map();
/** @type {Map<string, object>} */
const byPasskeyCredential = new Map();
/** @type {Array<{ id: string, accountId?: string, name: string, text: string, createdAt: string, sats: number, payable: boolean, hasPhoto: boolean, role: string, deletedAt?: string, inReplyTo?: string, parent?: string }>} */
const forumMessages = [];
/** @type {Array<{ id: string, name: string, text: string, createdAt: string }>} */
const contactMessages = [];
/** @type {Array<{ id: string, kind: 'member_member' | 'member_platform' | 'member_damus', name: string, lastText: string, lastAt: string, lastFromMe: boolean, lastReadAt?: string, ownerId: string, messages: Array<{ id: string, name: string, text: string, createdAt: string, fromMe: boolean, giftFor?: string }> }>} */
const conversations = [];
/** @type {Map<string, Buffer>} */
const forumPhotos = new Map();
/** @type {Map<string, Buffer>} keyed `${messageId}:${index}` */
const conversationPhotos = new Map();
/** @type {Map<string, Buffer>} */
const aboutMePhotos = new Map();
/** @type {Map<string, { hash: string, text: string }>} keyed `${messageId}\0${target}` */
const messageTranslations = new Map();
/** accountId → wallet data reports received (`POST /me/wallet/report`). */
const walletReports = new Map();
/** accountId → interaction events received (`POST /me/events`). */
const interactionEvents = new Map();

/** Same order as `ROLE_ORDER` in `src/lib/roles.ts`: a named role means that role or higher. */
const ROLE_ORDER = ['basis', 'verified', 'moderator', 'initiator', 'founder'];

function roleAtLeast(role, min) {
  return ROLE_ORDER.indexOf(role) >= ROLE_ORDER.indexOf(min);
}

function hex(bytes) {
  return Buffer.from(bytes).toString('hex');
}

function b64url(bytes) {
  return Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/u, '');
}

/**
 * True when the thread has inbound mail newer than last-read.
 *
 * @param {{ lastReadAt?: string, messages: Array<{ createdAt: string, fromMe: boolean }> }} row
 */
function conversationUnread(row) {
  const lastReadAt = typeof row.lastReadAt === 'string' ? row.lastReadAt : null;
  return row.messages.some(
    (message) => message.fromMe !== true && (lastReadAt === null || message.createdAt > lastReadAt),
  );
}

/**
 * Public conversation list-row fields, including `unread`.
 *
 * @param {{ id: string, kind?: string, name: string, lastText: string, lastAt: string, lastFromMe?: boolean, lastReadAt?: string, messages: Array<{ createdAt: string, fromMe: boolean }> }} row
 */
function publicConversation(row) {
  return {
    id: row.id,
    kind: row.kind ?? 'member_member',
    name: row.name,
    lastText: row.lastText,
    lastAt: row.lastAt,
    lastFromMe: row.lastFromMe === true,
    lastSats: Number(row.lastSats ?? 0),
    unread: conversationUnread(row),
  };
}

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'authorization, content-type, user-agent',
    'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}

function bearer(req) {
  const header = req.headers.authorization;
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) {
    return null;
  }
  const token = header.slice('Bearer '.length).trim();
  return token === '' ? null : token;
}

function hasName(account) {
  return account.name !== null && String(account.name).trim() !== '';
}

function hasUsername(account) {
  return account.username !== null && String(account.username).trim() !== '';
}

/**
 * True when the member can receive gifts: their own in-app wallet is
 * verified. The api reports the gap as the `lightning-address` key.
 */
function canReceive(account) {
  return account.sparkWalletVerified === true;
}

function hasRules(account) {
  return account.rulesAgreedAt !== null;
}

/**
 * Derive a LUD-16 local-part from a display name (same charset as the api).
 *
 * @param {string} name
 * @returns {string | null}
 */
function usernameFromName(name) {
  const slug = String(name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  if (slug === '' || slug === 'user') {
    return null;
  }
  return slug;
}

/**
 * True when another account already owns this handle.
 *
 * @param {string} username
 * @param {string} accountId
 * @returns {boolean}
 */
function usernameTaken(username, accountId) {
  const needle = username.trim().toLowerCase();
  for (const row of byToken.values()) {
    if (
      row.id !== accountId &&
      hasUsername(row) &&
      String(row.username).trim().toLowerCase() === needle
    ) {
      return true;
    }
  }
  return false;
}

/** Refresh `missing` from filled fields. */
function refreshMissing(account) {
  const missing = [];
  if (!hasName(account)) missing.push('name');
  if (!hasUsername(account)) missing.push('username');
  if (!canReceive(account)) missing.push('lightning-address');
  if (!hasRules(account)) missing.push('rules');
  account.missing = missing;
}

/**
 * Advance `setup` only when the current step is satisfied. There is no
 * address step: a member receives on their own in-app wallet, so the setup
 * runs name, username, rules. A member who cannot receive yet keeps the
 * `lightning-address` key in `missing`, which gates forum posts.
 *
 * @param {object} account
 */
function afterFieldWrite(account) {
  refreshMissing(account);
  const afterUsername = hasRules(account) ? null : 'rules';
  const afterName = hasUsername(account) ? afterUsername : 'username';
  if (account.setup === 'wallet' || account.setup === 'lightning-address') {
    account.setup = hasName(account) ? afterName : 'name';
  } else if (account.setup === 'name' && hasName(account)) {
    account.setup = afterName;
  } else if (account.setup === 'username' && hasUsername(account)) {
    account.setup = afterUsername;
  } else if (account.setup === 'rules' && hasRules(account)) {
    account.setup = null;
  }
}

function newAccount(linkingKey) {
  const account = {
    id: `acc_${hex(randomBytes(8))}`,
    linkingKey,
    role: 'basis',
    name: null,
    username: null,
    location: null,
    lightningAddress: null,
    lightningAddressVerified: false,
    forumLawsDismissed: false,
    createdAt: Date.now(),
    rulesAgreedAt: null,
    viewKey: hex(randomBytes(32)),
    aboutMe: null,
    aboutMeHasPhoto: false,
    setup: 'name',
    walletRequired: true,
    walletBackupSeenAt: null,
    missing: ['name', 'username', 'lightning-address', 'rules'],
  };
  return account;
}

/** Canned member profile UUID for e2e. */
const E2E_MEMBER_ID = '22222222-2222-4222-8222-222222222222';
const E2E_MEMBER_PROFILE = {
  id: E2E_MEMBER_ID,
  name: 'Carol',
  username: 'carol',
  location: 'Zug',
  role: 'verified',
  lightningAddress: null,
  createdAt: '2026-01-15T12:00:00.000Z',
  aboutMe: null,
  aboutMeHasPhoto: false,
  profileMessage: {
    id: '33333333-3333-4333-8333-333333333333',
    accountId: E2E_MEMBER_ID,
    name: 'Carol',
    text: 'Hello from my profile note.',
    createdAt: '2026-08-01T10:00:00.000Z',
    sats: 21,
    amountUsd: null,
    amountChf: null,
    amountEur: null,
    amountPhp: null,
    payable: true,
    hasPhoto: false,
    hasVideo: false,
    videoContentType: null,
    role: 'verified',
    replyCount: 0,
  },
  postCount: 2,
  replyCount: 1,
};

const E2E_MEMBER_POSTS = [
  {
    id: '44444444-4444-4444-8444-444444444444',
    accountId: E2E_MEMBER_ID,
    name: 'Carol',
    text: 'Second post from Carol.',
    createdAt: '2026-08-02T10:00:00.000Z',
    sats: 0,
    payable: true,
    hasPhoto: false,
    hasVideo: false,
    videoContentType: null,
    role: 'verified',
    replyCount: 0,
  },
  E2E_MEMBER_PROFILE.profileMessage,
];

const E2E_MEMBER_REPLIES = [
  {
    id: '66666666-6666-4666-8666-666666666666',
    accountId: E2E_MEMBER_ID,
    name: 'Carol',
    text: 'A reply from Carol.',
    createdAt: '2026-08-03T10:00:00.000Z',
    sats: 0,
    payable: false,
    hasPhoto: false,
    hasVideo: false,
    videoContentType: null,
    role: 'verified',
    replyCount: 0,
    parentId: '55555555-5555-4555-8555-555555555555',
  },
];

/**
 * Canned member whose About me was saved empty: the profile note has no text,
 * no photo, no video, and 0 sats, so the app's note schema cannot show it.
 */
const E2E_EMPTY_ABOUT_MEMBER_ID = '77777777-7777-4777-8777-777777777777';
const E2E_EMPTY_ABOUT_NOTE = {
  id: '88888888-8888-4888-8888-888888888888',
  accountId: E2E_EMPTY_ABOUT_MEMBER_ID,
  name: 'Dana',
  text: '',
  createdAt: '2026-10-05T09:00:00.000Z',
  sats: 0,
  amountUsd: null,
  amountChf: null,
  amountEur: null,
  amountPhp: null,
  payable: true,
  hasPhoto: false,
  hasVideo: false,
  videoContentType: null,
  role: 'basis',
  replyCount: 0,
};
const E2E_EMPTY_ABOUT_PROFILE = {
  id: E2E_EMPTY_ABOUT_MEMBER_ID,
  name: 'Dana',
  username: 'dana',
  location: null,
  role: 'basis',
  lightningAddress: null,
  createdAt: '2026-02-01T12:00:00.000Z',
  aboutMe: '',
  aboutMeHasPhoto: false,
  profileMessage: E2E_EMPTY_ABOUT_NOTE,
  postCount: 2,
  replyCount: 0,
};
const E2E_EMPTY_ABOUT_POSTS = [
  {
    id: '99999999-9999-4999-8999-999999999999',
    accountId: E2E_EMPTY_ABOUT_MEMBER_ID,
    name: 'Dana',
    text: 'A post from Dana.',
    createdAt: '2026-10-05T10:00:00.000Z',
    sats: 0,
    payable: true,
    hasPhoto: false,
    hasVideo: false,
    videoContentType: null,
    role: 'basis',
    replyCount: 0,
  },
  E2E_EMPTY_ABOUT_NOTE,
];

/** True when a forum POST needs name, username, rules, or lightning-address. */
function missingForumPostRequirements(account) {
  return (
    account.missing.includes('name') ||
    account.missing.includes('username') ||
    account.missing.includes('rules') ||
    account.missing.includes('lightning-address')
  );
}

/** True when a contact POST needs name, username, or rules (not lightning-address). */
function missingContactRequirements(account) {
  return (
    account.missing.includes('name') ||
    account.missing.includes('username') ||
    account.missing.includes('rules')
  );
}

/**
 * True when a list/read still needs rules agreement.
 * Skipped name alone must not 409 GET /messages after setup is complete.
 */
function missingListRequirements(account) {
  return account.missing.includes('rules');
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    req.resume();
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'authorization, content-type, user-agent',
      'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
    });
    res.end();
    return;
  }

  const rawBody = await readBody(req);
  const url = new URL(req.url ?? '/', `http://${HOST}:${PORT}`);
  const pathName = url.pathname;
  const method = req.method ?? 'GET';

  if (method === 'GET' && pathName === '/healthz') {
    json(res, 200, { status: 'ok' });
    return;
  }

  if (pathName === '/habits' && method === 'GET') {
    json(res, 200, {
      reviewWeek: { start: '2026-09-28' },
      habits: [
        {
          id: 'h-ada',
          accountId: 'acc-ada',
          ownerName: 'Ada',
          role: 'initiator',
          name: 'Walk',
          description: 'Outside',
          cadence: 'daily',
          timeZone: 'Asia/Manila',
          firstPeriod: '2026-10-01',
          lastPeriod: null,
          periods: [
            {
              period: '2026-10-04',
              name: 'Walk',
              description: 'Outside',
              logged: false,
              status: null,
            },
          ],
          comments: [
            {
              id: 'c-bea',
              habitId: 'h-ada',
              accountId: 'acc-bea',
              name: 'Bea',
              text: 'hello',
              week: '2026-09-28',
              createdAt: 1,
            },
          ],
        },
      ],
    });
    return;
  }

  if (pathName === '/habits' && method === 'POST') {
    if (bearer(req) === null) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    json(res, 200, { ok: true });
    return;
  }

  if (method === 'GET' && pathName === '/mentions') {
    if (bearer(req) === null) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    const q = (url.searchParams.get('q') ?? '').toLowerCase();
    const all = [
      { id: 'acc-ada', username: 'ada', name: 'Ada Lovelace' },
      { id: 'acc-adam', username: 'adam', name: 'Adam' },
      { id: 'acc-ben', username: 'ben', name: 'Ben' },
      { id: 'acc-ashton', username: 'ashton', name: 'Ashton' },
      { id: 'acc-astrid', username: 'astrid', name: 'Astrid' },
    ];
    const accounts =
      q === ''
        ? all.slice(0, 3)
        : q === 'zzz'
          ? []
          : all.filter((row) => row.username.startsWith(q));
    json(res, 200, { accounts });
    return;
  }

  const shortLinkMatch = pathName.match(/^\/links\/([0-9a-f]{8})$/i);
  if (method === 'GET' && shortLinkMatch) {
    const code = shortLinkMatch[1].toLowerCase();
    if (code === '77e0510d') {
      json(res, 200, { kind: 'message', id: '77e0510d-03a8-4063-8716-75d61178e7f1' });
      return;
    }
    if (code === 'd70c4763') {
      json(res, 200, { kind: 'member', id: 'd70c4763-3033-43da-817a-2c7de9938f27' });
      return;
    }
    json(res, 404, { error: 'not_found' });
    return;
  }

  if (method === 'GET' && pathName === '/translate') {
    json(res, 200, { available: true });
    return;
  }

  const translateNoteMatch = /^\/messages\/([^/]+)\/translate$/.exec(pathName);
  if (method === 'POST' && translateNoteMatch) {
    let parsed;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      json(res, 400, { error: 'Invalid body' });
      return;
    }
    const target = parsed?.target;
    if (target !== 'en' && target !== 'de' && target !== 'es' && target !== 'fil') {
      json(res, 400, { error: 'Invalid body' });
      return;
    }
    const messageId = decodeURIComponent(translateNoteMatch[1]);
    const note = forumMessages.find((row) => row.id === messageId);
    const source =
      typeof note?.text === 'string' && note.text.trim() !== ''
        ? note.text
        : messageId === 'm-de' || messageId === 'm-de-cache'
          ? 'Kann mir jemand diese Woche ein paar Satoshi leihen?'
          : '';
    if (source.trim() === '') {
      json(res, 404, { error: 'Not found' });
      return;
    }
    const hash = createHash('sha256').update(source, 'utf8').digest('hex');
    const key = `${messageId}\0${target}`;
    const hit = messageTranslations.get(key);
    if (hit !== undefined && hit.hash === hash) {
      json(res, 200, { translatedText: hit.text, cached: true });
      return;
    }
    let translated;
    if (source.includes('Kann mir jemand')) {
      translated = 'Can anyone lend me a few satoshi this week?';
    } else {
      translated = '[' + (target === 'fil' ? 'TL' : target.toUpperCase()) + '] ' + source;
    }
    messageTranslations.set(key, { hash, text: translated });
    json(res, 200, { translatedText: translated, cached: false });
    return;
  }

  const conversationTranslateMatch =
    /^\/conversations\/([^/]+)\/messages\/([^/]+)\/translate$/.exec(pathName);
  if (method === 'POST' && conversationTranslateMatch) {
    if (bearer(req) === null) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      json(res, 400, { error: 'Invalid body' });
      return;
    }
    const target = parsed?.target;
    if (target !== 'en' && target !== 'de' && target !== 'es' && target !== 'fil') {
      json(res, 400, { error: 'Invalid body' });
      return;
    }
    const messageId = decodeURIComponent(conversationTranslateMatch[2] ?? '');
    let source = '';
    for (const thread of conversations) {
      const message = thread.messages.find((row) => row.id === messageId);
      if (typeof message?.text === 'string' && message.text.trim() !== '') {
        source = message.text;
        break;
      }
    }
    if (source.trim() === '' && messageId === 'cm-de') {
      source = 'Kann mir jemand diese Woche ein paar Satoshi leihen?';
    }
    if (source.trim() === '') {
      json(res, 404, { error: 'Not found' });
      return;
    }
    const translated = source.includes('Kann mir jemand')
      ? 'Can anyone lend me a few satoshi this week?'
      : '[' + (target === 'fil' ? 'TL' : target.toUpperCase()) + '] ' + source;
    json(res, 200, { translatedText: translated, cached: false });
    return;
  }

  if (method === 'PATCH' && /^\/messages\/[^/]+\/place$/.test(pathName)) {
    const token = bearer(req);
    const account = token === null ? undefined : byToken.get(token);
    if (!account) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    if (!roleAtLeast(account.role, 'moderator')) {
      json(res, 403, { error: 'Forbidden' });
      return;
    }
    json(res, 200, { id: decodeURIComponent(pathName.split('/')[2] ?? ''), place: null });
    return;
  }

  if (method === 'PATCH' && /^\/messages\/[^/]+\/shop-account$/.test(pathName)) {
    const token = bearer(req);
    const account = token === null ? undefined : byToken.get(token);
    if (!account) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    if (!roleAtLeast(account.role, 'moderator')) {
      json(res, 403, { error: 'Forbidden' });
      return;
    }
    json(res, 200, {
      id: decodeURIComponent(pathName.split('/')[2] ?? ''),
      shopAccount: null,
    });
    return;
  }

  if (method === 'PATCH' && /^\/messages\/[^/]+\/text$/.test(pathName)) {
    const token = bearer(req);
    const account = token === null ? undefined : byToken.get(token);
    if (!account) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    if (!roleAtLeast(account.role, 'moderator')) {
      json(res, 403, { error: 'Forbidden' });
      return;
    }
    json(res, 200, { id: decodeURIComponent(pathName.split('/')[2] ?? ''), text: '' });
    return;
  }

  if (method === 'PATCH' && /^\/messages\/[^/]+\/photos$/.test(pathName)) {
    const token = bearer(req);
    const account = token === null ? undefined : byToken.get(token);
    if (!account) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    if (!roleAtLeast(account.role, 'moderator')) {
      json(res, 403, { error: 'Forbidden' });
      return;
    }
    json(res, 200, {
      id: decodeURIComponent(pathName.split('/')[2] ?? ''),
      hasPhoto: false,
      photoCount: 0,
    });
    return;
  }

  if (method === 'GET' && /^\/messages\/[^/]+\/edits$/.test(pathName)) {
    const token = bearer(req);
    const account = token === null ? undefined : byToken.get(token);
    if (!account) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    if (!roleAtLeast(account.role, 'moderator')) {
      json(res, 403, { error: 'Forbidden' });
      return;
    }
    json(res, 200, { edits: [] });
    return;
  }

  if (method === 'DELETE' && /^\/messages\/[^/]+$/.test(pathName)) {
    const token = bearer(req);
    const account = token === null ? undefined : byToken.get(token);
    if (!account) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    if (!roleAtLeast(account.role, 'moderator')) {
      json(res, 403, { error: 'Forbidden' });
      return;
    }
    const id = decodeURIComponent(pathName.slice('/messages/'.length));
    const row = forumMessages.find((message) => message.id === id);
    if (row === undefined) {
      json(res, 404, { error: 'Not found' });
      return;
    }
    const deletedAt = new Date().toISOString();
    const deletedBy = { id: account.id, name: account.name ?? null, role: account.role };
    row.deletedAt = deletedAt;
    row.deletedBy = deletedBy;
    for (const message of forumMessages) {
      if (message.inReplyTo === id || message.parent === id) {
        message.deletedAt = deletedAt;
        message.deletedBy = deletedBy;
      }
    }
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'authorization, content-type, user-agent',
      'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
    });
    res.end();
    return;
  }

  const COMPOSE_TARGET = {
    id: 'compose-fee',
    name: '21.gifts',
    text: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    sats: 0,
    payable: true,
    hasPhoto: false,
    role: 'basis',
  };

  if (method === 'GET' && pathName === '/messages/compose-target') {
    const token = bearer(req);
    const account = token === null ? undefined : byToken.get(token);
    if (!account) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    json(res, 200, {
      messageId: COMPOSE_TARGET.id,
      sats: COMPOSE_TARGET.sats,
      firstPostFree: false,
    });
    return;
  }

  if (method === 'GET' && pathName === '/messages') {
    const token = bearer(req);
    const account = token === null ? undefined : byToken.get(token);
    if (!account) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    if (missingListRequirements(account)) {
      json(res, 409, { error: 'missing_requirements', missing: account.missing });
      return;
    }
    const parsedLimit = parseInt(url.searchParams.get('limit') ?? '', 10);
    const limit = Number.isFinite(parsedLimit) ? parsedLimit : 200;
    const mode = url.searchParams.get('mode');
    const living = forumMessages.filter((message) => message.deletedAt === undefined);
    let filtered = living;
    if (mode === 'unpaid') {
      filtered = living.filter((message) => message.sats === 0);
    } else if (mode === 'active') {
      filtered = living.filter(
        (message) => message.sats > 0 || message.role === 'founder' || message.role === 'moderator',
      );
    } else if (mode === 'popular') {
      filtered = living.filter((message) => message.sats > 0);
    }
    const messages = filtered.slice(0, limit);
    json(res, 200, {
      messages,
      ...(filtered.length > limit ? { nextCursor: 'next' } : {}),
    });
    return;
  }

  if (method === 'POST' && pathName === '/messages') {
    const token = bearer(req);
    const account = token === null ? undefined : byToken.get(token);
    if (!account) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    if (missingForumPostRequirements(account)) {
      json(res, 409, { error: 'missing_requirements', missing: account.missing });
      return;
    }
    const name = typeof account.name === 'string' ? account.name.trim() : '';
    if (name === '') {
      json(res, 400, { error: 'Set a name before posting' });
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      json(res, 400, { error: 'Expected a JSON body with a "text" string' });
      return;
    }
    const hasPhoto =
      parsed?.photo !== undefined &&
      parsed?.photo !== null &&
      typeof parsed.photo.data === 'string' &&
      parsed.photo.data.length > 0;
    const rawText = typeof parsed?.text === 'string' ? parsed.text : hasPhoto ? '' : null;
    if (rawText === null) {
      json(res, 400, { error: 'Expected a JSON body with a "text" string' });
      return;
    }
    const text = rawText.trim();
    if ((text.length < 1 && !hasPhoto) || text.length > 8000) {
      json(res, 400, {
        error: 'Text must be 1–8000 characters or include a photo',
      });
      return;
    }
    const created = {
      id: `msg_${hex(randomBytes(8))}`,
      accountId: account.id,
      name,
      text,
      createdAt: new Date().toISOString(),
      sats: 0,
      payable: false,
      hasPhoto,
      role: account.role,
    };
    if (hasPhoto) {
      forumPhotos.set(created.id, Buffer.from(parsed.photo.data, 'base64'));
    }
    forumMessages.unshift(created);
    json(res, 200, created);
    return;
  }

  const repaymentMatch = pathName.match(/^\/messages\/([^/]+)\/repayment$/);
  if (repaymentMatch && method === 'POST') {
    const token = bearer(req);
    const account = token === null ? undefined : byToken.get(token);
    if (!account) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    json(res, 200, { pr: 'lnbc1', amountSats: 21 });
    return;
  }

  const invoiceMatch = pathName.match(/^\/messages\/([^/]+)\/invoice$/);
  if (method === 'POST' && invoiceMatch) {
    const token = bearer(req);
    const account = token === null ? undefined : byToken.get(token);
    if (!account) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    const row =
      forumMessages.find((message) => message.id === invoiceMatch[1]) ??
      (invoiceMatch[1] === COMPOSE_TARGET.id ? COMPOSE_TARGET : undefined);
    if (row === undefined) {
      json(res, 404, { error: 'Not found' });
      return;
    }
    if (row.payable !== true) {
      json(res, 400, { error: 'This note cannot be paid yet' });
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      json(res, 400, { error: 'Expected a JSON body with a positive "sats" integer' });
      return;
    }
    const sats = parsed?.sats;
    if (!Number.isInteger(sats) || sats < 1) {
      json(res, 400, { error: 'Expected a JSON body with a positive "sats" integer' });
      return;
    }
    // A heart is paid only through a fee-free Spark invoice.
    json(res, 200, {
      pr: `lnbc${sats}n1test`,
      amountSats: sats,
      ...(parsed?.heart === true ? { sparkInvoice: `sparkrt1heart${invoiceMatch[1]}` } : {}),
    });
    return;
  }

  // Public pay link of the shop `shop`: a pending charge of 7'000 sats, and a
  // Spark invoice only for exactly that amount.
  if (method === 'GET' && pathName === '/pay/shop') {
    json(res, 200, {
      name: 'Shop',
      username: 'shop',
      minSats: 7_000,
      maxSats: 7_000,
      charge: {
        id: 'pos-shop',
        amountSats: 7_000,
        status: 'pending',
        createdAt: new Date(Date.now() - 60_000).toISOString(),
        expiresAt: new Date(Date.now() + 240_000).toISOString(),
        paidAt: null,
      },
    });
    return;
  }
  if (method === 'POST' && pathName === '/pay/shop/invoice') {
    let parsed;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      parsed = null;
    }
    const amountSats = parsed?.amountSats;
    if (typeof amountSats !== 'number' || !Number.isSafeInteger(amountSats) || amountSats < 1) {
      json(res, 400, { error: 'Invalid amount' });
      return;
    }
    json(res, 200, {
      pr: 'lnbc70u1shopcharge',
      amountSats,
      sparkInvoice: amountSats === 7_000 ? 'sparkrt1shopcharge' : null,
    });
    return;
  }

  // Member `alice` without an open charge: a Spark invoice for any amount,
  // carrying the trimmed message, so the in-app wallet pays without a fee.
  if (method === 'POST' && pathName === '/pay/alice/invoice') {
    let parsed;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      parsed = null;
    }
    const amountSats = parsed?.amountSats;
    if (typeof amountSats !== 'number' || !Number.isSafeInteger(amountSats) || amountSats < 1) {
      json(res, 400, { error: 'Invalid amount' });
      return;
    }
    const comment = typeof parsed?.comment === 'string' ? parsed.comment.trim() : '';
    json(res, 200, {
      pr: `lnbc${amountSats}n1alice`,
      amountSats,
      sparkInvoice: `sparkrt1alice${amountSats}${comment === '' ? '' : `-${encodeURIComponent(comment)}`}`,
    });
    return;
  }

  if (method === 'POST' && (pathName === '/lnurl/pay-request' || pathName === '/lnurl/invoice')) {
    const token = bearer(req);
    if (token === null || !byToken.has(token)) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      parsed = null;
    }
    const target = typeof parsed?.target === 'string' ? parsed.target.trim() : '';
    // Fixed outside receivers: bob@example.com pays 1–100'000 sats with a 10-character comment.
    if (target === 'missing@example.com') {
      json(res, 404, { error: 'Address not found' });
      return;
    }
    if (target === 'down@example.com') {
      json(res, 502, { error: 'Address could not be reached' });
      return;
    }
    if (target !== 'bob@example.com') {
      json(res, 400, { error: 'Not a payable address' });
      return;
    }
    const payRequest = {
      target,
      minSendableMsat: 1_000,
      maxSendableMsat: 100_000_000,
      commentAllowed: 10,
      description: 'Pay bob',
      domain: 'example.com',
    };
    if (pathName === '/lnurl/pay-request') {
      json(res, 200, payRequest);
      return;
    }
    const amountMsat = parsed.amountMsat;
    if (
      !Number.isInteger(amountMsat) ||
      amountMsat < payRequest.minSendableMsat ||
      amountMsat > payRequest.maxSendableMsat
    ) {
      json(res, 400, { error: 'Amount out of range' });
      return;
    }
    if (typeof parsed.comment === 'string' && parsed.comment.length > payRequest.commentAllowed) {
      json(res, 400, { error: 'Comment too long' });
      return;
    }
    // BOLT11 pico (p) is 0.1 msat, so this invoice encodes exactly amountMsat.
    json(res, 200, { pr: `lnbc${amountMsat * 10}p1mockrelay` });
    return;
  }

  if (method === 'POST' && pathName === '/contact') {
    const token = bearer(req);
    const account = token === null ? undefined : byToken.get(token);
    if (!account) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    if (missingContactRequirements(account)) {
      json(res, 409, { error: 'missing_requirements', missing: account.missing });
      return;
    }
    const name = typeof account.name === 'string' ? account.name.trim() : '';
    let parsed;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      json(res, 400, { error: 'Expected a JSON body with a "text" string' });
      return;
    }
    if (typeof parsed?.text !== 'string') {
      json(res, 400, { error: 'Expected a JSON body with a "text" string' });
      return;
    }
    const text = parsed.text.trim();
    if (text.length < 1 || text.length > 8000) {
      json(res, 400, { error: 'Text must be 1–8000 characters' });
      return;
    }
    const created = {
      id: `contact_${hex(randomBytes(8))}`,
      name,
      text,
      createdAt: new Date().toISOString(),
    };
    contactMessages.unshift(created);
    let thread = conversations.find(
      (row) => row.ownerId === account.id && row.kind === 'member_platform',
    );
    if (thread === undefined) {
      thread = {
        id: `conv_${hex(randomBytes(8))}`,
        kind: 'member_platform',
        name: '21.gifts',
        lastText: text,
        lastAt: created.createdAt,
        lastFromMe: true,
        lastSats: 0,
        ownerId: account.id,
        messages: [],
      };
      conversations.unshift(thread);
    }
    thread.messages.push({
      id: created.id,
      name,
      text,
      createdAt: created.createdAt,
      fromMe: true,
      sats: 0,
    });
    thread.lastText = text;
    thread.lastAt = created.createdAt;
    thread.lastFromMe = true;
    json(res, 200, created);
    return;
  }

  if (method === 'GET' && pathName === '/notifications') {
    const token = bearer(req);
    if (token === null || !byToken.get(token)) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    json(res, 200, { notifications: [], unreadCount: 0 });
    return;
  }

  if (method === 'POST' && pathName === '/notifications/read-all') {
    const token = bearer(req);
    if (token === null || !byToken.get(token)) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    json(res, 200, { ok: true });
    return;
  }

  if (method === 'POST' && pathName === '/notifications/read-by-message') {
    const token = bearer(req);
    if (token === null || !byToken.get(token)) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    json(res, 200, { ok: true, tags: [] });
    return;
  }

  const notificationReadMatch = pathName.match(/^\/notifications\/([^/]+)\/read$/);
  if (method === 'POST' && notificationReadMatch) {
    const token = bearer(req);
    if (token === null || !byToken.get(token)) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    json(res, 404, { error: 'Not found' });
    return;
  }

  if (method === 'GET' && pathName === '/conversations') {
    const token = bearer(req);
    const account = token === null ? undefined : byToken.get(token);
    if (!account) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    const list = conversations
      .filter((row) => row.ownerId === account.id)
      .filter(
        (row) =>
          row.messages.some((message) => message.fromMe !== true) ||
          ((row.kind ?? 'member_member') === 'member_platform' && row.messages.length > 0),
      )
      .map(publicConversation);
    json(res, 200, {
      conversations: list,
      unreadCount: list.filter((row) => row.unread).length,
    });
    return;
  }

  if (method === 'POST' && pathName === '/conversations') {
    const token = bearer(req);
    const account = token === null ? undefined : byToken.get(token);
    if (!account) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      json(res, 400, { error: 'Expected a JSON body with a "forumMessageId" string' });
      return;
    }
    const forumMessageId = typeof parsed?.forumMessageId === 'string' ? parsed.forumMessageId : '';
    const note = forumMessages.find((message) => message.id === forumMessageId);
    if (note === undefined) {
      json(res, 404, { error: 'Not found' });
      return;
    }
    const ownName = typeof account.name === 'string' ? account.name.trim() : '';
    if (ownName !== '' && note.name === ownName) {
      json(res, 400, { error: 'Cannot message yourself' });
      return;
    }
    let thread = conversations.find((row) => row.ownerId === account.id && row.name === note.name);
    if (thread === undefined) {
      const now = new Date().toISOString();
      const kind =
        typeof note.accountId === 'string' && note.accountId !== ''
          ? 'member_member'
          : 'member_damus';
      thread = {
        id: `conv_${hex(randomBytes(8))}`,
        kind,
        name: note.name,
        lastText: '',
        lastAt: now,
        lastFromMe: false,
        lastSats: 0,
        ownerId: account.id,
        messages: [],
      };
      conversations.unshift(thread);
    }
    json(res, 200, publicConversation(thread));
    return;
  }
  const conversationReadMatch = pathName.match(/^\/conversations\/([^/]+)\/read$/);
  if (method === 'POST' && conversationReadMatch) {
    const token = bearer(req);
    const account = token === null ? undefined : byToken.get(token);
    if (!account) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    const id = decodeURIComponent(conversationReadMatch[1]);
    const thread = conversations.find((row) => row.id === id && row.ownerId === account.id);
    if (thread === undefined) {
      json(res, 404, { error: 'Not found' });
      return;
    }
    thread.lastReadAt = new Date().toISOString();
    json(res, 200, { ok: true });
    return;
  }

  const conversationInvoiceMatch = pathName.match(/^\/conversations\/([^/]+)\/invoice$/);
  if (conversationInvoiceMatch && method === 'POST') {
    const token = bearer(req);
    const account = token === null ? undefined : byToken.get(token);
    if (!account) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    const id = decodeURIComponent(conversationInvoiceMatch[1]);
    const thread = conversations.find((row) => row.id === id && row.ownerId === account.id);
    if (thread === undefined) {
      json(res, 404, { error: 'Not found' });
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      json(res, 400, { error: 'Expected a JSON body with a positive "sats" integer' });
      return;
    }
    const sats = Number(parsed?.sats);
    if (!Number.isInteger(sats) || sats < 1) {
      json(res, 400, { error: 'Expected a JSON body with a positive "sats" integer' });
      return;
    }
    const senderName = typeof account.name === 'string' ? account.name.trim() : '';
    const text = typeof parsed?.text === 'string' ? parsed.text.trim() : '';
    const created = {
      id: `cmsg_${hex(randomBytes(8))}`,
      name: senderName === '' ? 'You' : senderName,
      text,
      createdAt: new Date().toISOString(),
      fromMe: true,
      sats,
      amountUsd: null,
      amountChf: null,
      amountEur: null,
      amountPhp: null,
    };
    thread.messages.push(created);
    thread.lastText = text;
    thread.lastAt = created.createdAt;
    thread.lastFromMe = true;
    thread.lastSats = sats;
    json(res, 200, { pr: 'lnbc21n1test', amountSats: sats, messageId: created.id });
    return;
  }

  const conversationMatch = pathName.match(/^\/conversations\/([^/]+)$/);
  if (conversationMatch && (method === 'GET' || method === 'POST')) {
    const token = bearer(req);
    const account = token === null ? undefined : byToken.get(token);
    if (!account) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    const id = decodeURIComponent(conversationMatch[1]);
    const thread = conversations.find((row) => row.id === id && row.ownerId === account.id);
    if (thread === undefined) {
      json(res, 404, { error: 'Not found' });
      return;
    }
    if (method === 'GET') {
      const parsedLimit = Number(url.searchParams.get('limit'));
      const limit = Number.isInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : 20;
      const cursor = url.searchParams.get('cursor');
      const cursorIndex =
        cursor === null
          ? thread.messages.length
          : thread.messages.findIndex((message) => message.id === cursor);
      const endIndex = cursorIndex >= 0 ? cursorIndex : thread.messages.length;
      const startIndex = Math.max(0, endIndex - limit);
      const page = thread.messages.slice(startIndex, endIndex);
      json(res, 200, {
        messages: page.map((message) => {
          const sats = Number(message.sats ?? 0);
          return {
            id: message.id,
            name: message.name,
            text: message.text,
            createdAt: message.createdAt,
            fromMe: message.fromMe === true,
            sats,
            ...(sats > 0
              ? {
                  amountUsd: null,
                  amountChf: null,
                  amountEur: null,
                  amountPhp: null,
                }
              : {}),
            ...(typeof message.giftFor === 'string' && message.giftFor !== ''
              ? { giftFor: message.giftFor }
              : {}),
            ...(message.hasPhoto === true
              ? { hasPhoto: true, photoCount: Number(message.photoCount ?? 1) }
              : {}),
          };
        }),
        ...(page.length === limit && startIndex > 0 ? { nextCursor: page[0].id } : {}),
      });
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      json(res, 400, { error: 'Expected a JSON body with a "text" string' });
      return;
    }
    const senderName = typeof account.name === 'string' ? account.name.trim() : '';
    if (senderName === '') {
      json(res, 400, { error: 'Set a name before posting' });
      return;
    }
    const photoData =
      typeof parsed?.photo?.data === 'string' && parsed.photo.data.length > 0
        ? parsed.photo.data
        : null;
    const photosList = Array.isArray(parsed?.photos) ? parsed.photos : [];
    const photosHaveData = photosList.some(
      (item) =>
        item !== undefined &&
        item !== null &&
        typeof item.data === 'string' &&
        item.data.length > 0,
    );
    const hasPhoto = photoData !== null || (photosList.length > 0 && photosHaveData);
    const rawText = typeof parsed?.text === 'string' ? parsed.text : hasPhoto ? '' : null;
    if (rawText === null) {
      json(res, 400, { error: 'Expected a JSON body with a "text" string' });
      return;
    }
    const text = rawText.trim();
    if ((text.length < 1 && !hasPhoto) || text.length > 8000) {
      json(res, 400, { error: 'Text must be 1–8000 characters' });
      return;
    }
    const photoCount = photosList.length > 0 ? photosList.length : hasPhoto ? 1 : 0;
    const created = {
      id: `cmsg_${hex(randomBytes(8))}`,
      name: senderName,
      text,
      createdAt: new Date().toISOString(),
      fromMe: true,
      sats: 0,
      hasPhoto,
      photoCount,
    };
    if (photosList.length > 0) {
      photosList.forEach((item, index) => {
        if (
          item !== undefined &&
          item !== null &&
          typeof item.data === 'string' &&
          item.data.length > 0
        ) {
          conversationPhotos.set(`${created.id}:${index}`, Buffer.from(item.data, 'base64'));
        }
      });
    } else if (photoData !== null) {
      conversationPhotos.set(`${created.id}:0`, Buffer.from(photoData, 'base64'));
    }
    thread.messages.push(created);
    thread.lastText = text;
    thread.lastAt = created.createdAt;
    thread.lastFromMe = true;
    thread.lastSats = 0;
    json(res, 200, created);
    return;
  }

  const conversationPhotoFileMatch = pathName.match(
    /^\/conversations\/([^/]+)\/messages\/([^/]+)\/photo\/([1-9])\.jpg$/,
  );
  const conversationPhotoMatch = pathName.match(
    /^\/conversations\/([^/]+)\/messages\/([^/]+)\/photo$/,
  );
  if (
    method === 'GET' &&
    (conversationPhotoFileMatch !== null || conversationPhotoMatch !== null)
  ) {
    const token = bearer(req);
    const account = token === null ? undefined : byToken.get(token);
    if (!account) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    const groups =
      conversationPhotoFileMatch !== null ? conversationPhotoFileMatch : conversationPhotoMatch;
    const conversationId = decodeURIComponent(groups[1]);
    const messageId = decodeURIComponent(groups[2]);
    const index = conversationPhotoFileMatch !== null ? Number(conversationPhotoFileMatch[3]) : 0;
    const thread = conversations.find(
      (row) => row.id === conversationId && row.ownerId === account.id,
    );
    if (thread === undefined) {
      json(res, 404, { error: 'Not found' });
      return;
    }
    const tagged = thread.messages.find((message) => message.id === messageId);
    if (tagged === undefined) {
      json(res, 404, { error: 'Not found' });
      return;
    }
    const bytes = conversationPhotos.get(`${messageId}:${index}`);
    if (bytes === undefined) {
      json(res, 404, { error: 'Not found' });
      return;
    }
    res.writeHead(200, {
      'content-type': 'image/jpeg',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'authorization, content-type, user-agent',
      'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
    });
    res.end(bytes);
    return;
  }

  const photoMatch = pathName.match(/^\/messages\/([^/]+)\/photo$/);
  if (method === 'GET' && photoMatch) {
    const id = decodeURIComponent(photoMatch[1]);
    const tagged = forumMessages.find((message) => message.id === id);
    if (tagged !== undefined && tagged.deletedAt !== undefined) {
      json(res, 404, { error: 'Not found' });
      return;
    }
    const bytes = forumPhotos.get(id);
    if (bytes === undefined) {
      json(res, 404, { error: 'Not found' });
      return;
    }
    res.writeHead(200, {
      'content-type': 'image/jpeg',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'authorization, content-type, user-agent',
      'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
    });
    res.end(bytes);
    return;
  }

  if (method === 'GET' && pathName === '/messages/hidden') {
    const token = bearer(req);
    const account = token === null ? undefined : byToken.get(token);
    if (!account) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    if (!roleAtLeast(account.role, 'moderator')) {
      json(res, 403, { error: 'Forbidden' });
      return;
    }
    json(res, 200, {
      messages: forumMessages
        .filter((message) => message.deletedAt !== undefined)
        .map((message) => ({
          id: message.id,
          name: message.name,
          text: message.text,
          createdAt: message.createdAt,
          sats: message.sats,
          hasPhoto: message.hasPhoto,
          hasVideo: message.hasVideo ?? false,
          videoContentType: message.videoContentType ?? null,
          parentId: message.parent ?? message.inReplyTo ?? null,
          deletedAt: message.deletedAt,
          deletedBy: message.deletedBy,
        })),
    });
    return;
  }

  if (method === 'GET' && pathName === '/messages/places') {
    if (bearer(req) === null) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    json(res, 200, { places: [] });
    return;
  }

  if (method === 'GET' && pathName === '/messages/stats') {
    json(res, 200, {
      postCount: 6,
      postsOverTime: [
        { day: '2026-06-01', postCount: 2 },
        { day: '2026-06-02', postCount: 0 },
        { day: '2026-07-01', postCount: 4 },
      ],
    });
    return;
  }

  const publicMessageMatch = pathName.match(/^\/messages\/([^/]+)$/);
  if (method === 'GET' && publicMessageMatch) {
    const id = decodeURIComponent(publicMessageMatch[1]);
    if (id === COMPOSE_TARGET.id) {
      json(res, 200, COMPOSE_TARGET);
      return;
    }
    const row = forumMessages.find((message) => message.id === id);
    if (row === undefined || row.deletedAt !== undefined) {
      json(res, 404, { error: 'Not found' });
      return;
    }
    json(res, 200, row);
    return;
  }

  if (method === 'GET' && pathName === '/me') {
    const token = bearer(req);
    const account = token === null ? undefined : byToken.get(token);
    if (!account) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    json(res, 200, account);
    return;
  }

  if (pathName === '/pos' && (method === 'GET' || method === 'POST' || method === 'DELETE')) {
    const token = bearer(req);
    const account = token === null ? undefined : byToken.get(token);
    if (!account) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    if (method === 'DELETE') {
      json(res, 200, { charge: null });
      return;
    }
    if (method === 'POST') {
      json(res, 201, {
        charge: {
          id: 'pos-e2e',
          amountSats: 21,
          status: 'pending',
          createdAt: '2026-09-22T00:00:00.000Z',
          expiresAt: '2026-09-22T00:05:00.000Z',
        },
      });
      return;
    }
    json(res, 200, { charge: null, history: [] });
    return;
  }

  const EMPTY_ACTIVITY = {
    donatedSats: 0,
    receivedSats: 0,
    donatedOverTime: [],
    receivedOverTime: [],
    fx: {
      quote: 'BTC-USD',
      dayBasis: 'utc',
      source: 'coinbase-exchange-daily-close',
      quotes: [{ code: 'USD', pair: 'BTC-USD', source: 'coinbase-exchange-daily-close' }],
    },
  };

  if (method === 'GET' && pathName === '/me/activity') {
    const token = bearer(req);
    if (token === null || !byToken.has(token)) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    json(res, 200, EMPTY_ACTIVITY);
    return;
  }

  if (method === 'GET' && pathName === '/push/vapid-public') {
    const token = bearer(req);
    if (token === null || !byToken.has(token)) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    json(res, 200, { publicKey: `B${'A'.repeat(86)}` });
    return;
  }

  if (method === 'POST' && pathName === '/me/push-subscriptions') {
    const token = bearer(req);
    if (token === null || !byToken.has(token)) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      json(res, 400, { error: 'Invalid subscription' });
      return;
    }
    const endpoint = typeof parsed?.endpoint === 'string' ? parsed.endpoint : '';
    if (endpoint === '') {
      json(res, 400, { error: 'Invalid subscription' });
      return;
    }
    json(res, 200, { endpoint, createdAt: new Date().toISOString() });
    return;
  }

  if (method === 'DELETE' && pathName === '/me/push-subscriptions') {
    const token = bearer(req);
    if (token === null || !byToken.has(token)) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    json(res, 200, { ok: true });
    return;
  }

  if (method === 'POST' && pathName === '/me/rules-agreement') {
    const token = bearer(req);
    const account = token === null ? undefined : byToken.get(token);
    if (!account) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    if (account.rulesAgreedAt === null) {
      account.rulesAgreedAt = Date.now();
    }
    afterFieldWrite(account);
    json(res, 200, account);
    return;
  }

  if (method === 'POST' && pathName === '/me/setup/skip') {
    const token = bearer(req);
    const account = token === null ? undefined : byToken.get(token);
    if (!account) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      json(res, 400, { error: 'Expected a JSON body with a "step" string' });
      return;
    }
    if (parsed?.step !== 'name' && parsed?.step !== 'lightning-address') {
      json(res, 400, { error: 'Expected step name or lightning-address' });
      return;
    }
    if (account.setup === parsed.step) {
      if (parsed.step === 'name') {
        account.setup = 'username';
      } else {
        account.setup = 'rules';
      }
    }
    refreshMissing(account);
    json(res, 200, account);
    return;
  }

  const membersActivityMatch = pathName.match(/^\/members\/([^/]+)\/activity$/);
  if (method === 'GET' && membersActivityMatch) {
    const token = bearer(req);
    if (token === null || !byToken.has(token)) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    json(res, 200, EMPTY_ACTIVITY);
    return;
  }

  const memberPostsMatch = pathName.match(/^\/members\/([^/]+)\/posts$/);
  if (method === 'GET' && memberPostsMatch) {
    const token = bearer(req);
    const account = token === null ? undefined : byToken.get(token);
    if (!account) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    if (missingListRequirements(account)) {
      json(res, 409, { error: 'missing_requirements', missing: account.missing });
      return;
    }
    const id = decodeURIComponent(memberPostsMatch[1]);
    if (id === E2E_MEMBER_ID) {
      json(res, 200, { messages: E2E_MEMBER_POSTS });
      return;
    }
    if (id === E2E_EMPTY_ABOUT_MEMBER_ID) {
      json(res, 200, { messages: E2E_EMPTY_ABOUT_POSTS });
      return;
    }
    if (id === account.id) {
      json(res, 200, { messages: [] });
      return;
    }
    json(res, 404, { error: 'Not found' });
    return;
  }

  const memberRepliesMatch = pathName.match(/^\/members\/([^/]+)\/replies$/);
  if (method === 'GET' && memberRepliesMatch) {
    const token = bearer(req);
    const account = token === null ? undefined : byToken.get(token);
    if (!account) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    if (missingListRequirements(account)) {
      json(res, 409, { error: 'missing_requirements', missing: account.missing });
      return;
    }
    const id = decodeURIComponent(memberRepliesMatch[1]);
    if (id === E2E_MEMBER_ID) {
      json(res, 200, { messages: E2E_MEMBER_REPLIES });
      return;
    }
    if (id === account.id) {
      json(res, 200, { messages: [] });
      return;
    }
    json(res, 404, { error: 'Not found' });
    return;
  }

  const membersMatch = pathName.match(/^\/members\/([^/]+)$/);
  if (method === 'GET' && membersMatch) {
    const token = bearer(req);
    const account = token === null ? undefined : byToken.get(token);
    if (!account) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    if (missingListRequirements(account)) {
      json(res, 409, { error: 'missing_requirements', missing: account.missing });
      return;
    }
    const id = decodeURIComponent(membersMatch[1]);
    if (id === E2E_MEMBER_ID) {
      json(res, 200, E2E_MEMBER_PROFILE);
      return;
    }
    if (id === E2E_EMPTY_ABOUT_MEMBER_ID) {
      json(res, 200, E2E_EMPTY_ABOUT_PROFILE);
      return;
    }
    if (id === account.id) {
      json(res, 200, {
        id: account.id,
        name: account.name,
        username: account.username ?? null,
        location: account.location,
        role: account.role,
        lightningAddress: account.lightningAddress,
        createdAt: new Date(account.createdAt).toISOString(),
        aboutMe: account.aboutMe ?? null,
        aboutMeHasPhoto: account.aboutMeHasPhoto === true,
        profileMessage: null,
        postCount: 0,
        replyCount: 0,
      });
      return;
    }
    json(res, 404, { error: 'Not found' });
    return;
  }

  const viewActivityMatch = pathName.match(/^\/view\/([^/]+)\/activity$/);
  if (method === 'GET' && viewActivityMatch) {
    json(res, 200, EMPTY_ACTIVITY);
    return;
  }

  const viewAboutPhotoMatch = pathName.match(/^\/view\/([^/]+)\/about\/photo$/);
  if (method === 'GET' && viewAboutPhotoMatch) {
    const key = viewAboutPhotoMatch[1];
    let found;
    for (const account of byToken.values()) {
      if (account.viewKey === key) {
        found = account;
        break;
      }
    }
    const bytes = found === undefined ? undefined : aboutMePhotos.get(found.id);
    if (found === undefined || bytes === undefined) {
      json(res, 404, { error: 'Not found' });
      return;
    }
    res.writeHead(200, {
      'content-type': 'image/jpeg',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'authorization, content-type, user-agent',
      'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
    });
    res.end(bytes);
    return;
  }

  const viewMatch = pathName.match(/^\/view\/([^/]+)$/);
  if (method === 'GET' && viewMatch) {
    const key = viewMatch[1];
    let found;
    for (const account of byToken.values()) {
      if (account.viewKey === key) {
        found = account;
        break;
      }
    }
    if (!found) {
      json(res, 404, { error: 'Not found' });
      return;
    }
    let hasPasskey = false;
    for (const bound of byPasskeyCredential.values()) {
      if (bound === found) {
        hasPasskey = true;
        break;
      }
    }
    json(res, 200, {
      name: found.name,
      username: found.username ?? null,
      location: found.location,
      lightningAddress: found.lightningAddress,
      lightningAddressVerified: found.lightningAddressVerified,
      createdAt: found.createdAt,
      hasPasskey,
      aboutMe: found.aboutMe ?? null,
      aboutMeHasPhoto: found.aboutMeHasPhoto === true,
    });
    return;
  }

  if (method === 'PUT' && pathName === '/me/about') {
    const token = bearer(req);
    const account = token === null ? undefined : byToken.get(token);
    if (!account) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    if (!hasName(account)) {
      json(res, 409, { error: 'missing_requirements', missing: ['name'] });
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      json(res, 400, { error: 'Expected a JSON body with a "text" string' });
      return;
    }
    if (typeof parsed?.text !== 'string') {
      json(res, 400, { error: 'Expected a JSON body with a "text" string' });
      return;
    }
    if (Object.prototype.hasOwnProperty.call(parsed, 'photo')) {
      const photo = parsed.photo;
      const hasPhotoData =
        photo !== null &&
        typeof photo === 'object' &&
        typeof photo.data === 'string' &&
        photo.data.length > 0;
      if (photo !== null && !hasPhotoData) {
        json(res, 400, { error: 'Expected photo to be null or { data }' });
        return;
      }
    }
    const trimmed = parsed.text.trim();
    account.aboutMe = trimmed === '' ? null : trimmed;
    if (Object.prototype.hasOwnProperty.call(parsed, 'photo')) {
      if (parsed.photo === null) {
        aboutMePhotos.delete(account.id);
        account.aboutMeHasPhoto = false;
      } else {
        aboutMePhotos.set(account.id, Buffer.from(parsed.photo.data, 'base64'));
        account.aboutMeHasPhoto = true;
      }
    }
    json(res, 200, account);
    return;
  }

  if (
    (method === 'GET' || method === 'PUT') &&
    (pathName === '/pictures/me' || pathName === '/banners/me')
  ) {
    const token = bearer(req);
    const account = token === null ? undefined : byToken.get(token);
    if (!account) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    if (method === 'PUT') {
      res.writeHead(204, {
        'access-control-allow-origin': '*',
        'access-control-allow-headers': 'authorization, content-type, user-agent',
        'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
      });
      res.end();
      return;
    }
    json(res, 404, { error: 'Not found' });
    return;
  }

  if (method === 'GET' && pathName === '/me/about/photo') {
    const token = bearer(req);
    const account = token === null ? undefined : byToken.get(token);
    if (!account) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    const bytes = aboutMePhotos.get(account.id);
    if (bytes === undefined) {
      json(res, 404, { error: 'Not found' });
      return;
    }
    res.writeHead(200, {
      'content-type': 'image/jpeg',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'authorization, content-type, user-agent',
      'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
    });
    res.end(bytes);
    return;
  }

  if (method === 'POST' && pathName === '/me/name') {
    const token = bearer(req);
    const account = token === null ? undefined : byToken.get(token);
    if (!account) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      json(res, 400, { error: 'Expected a JSON body with a "name" string' });
      return;
    }
    if (typeof parsed?.name !== 'string') {
      json(res, 400, { error: 'Expected a JSON body with a "name" string' });
      return;
    }
    const trimmed = parsed.name.trim();
    if (trimmed.length < 1 || trimmed.length > 80) {
      json(res, 400, { error: 'Name must be 1–80 characters' });
      return;
    }
    account.name = trimmed;
    if (!hasUsername(account)) {
      let derived = usernameFromName(trimmed);
      // Shared mock process: the live API leaves username unset on collision
      // (setup stays `username`). Tests reuse display names like Ada, so a
      // free unique suffix keeps later accounts moving past this step.
      if (derived !== null && usernameTaken(derived, account.id)) {
        derived = `${derived}-${account.id.replace(/[^a-z0-9]/g, '').slice(0, 8)}`.slice(0, 32);
      }
      if (derived !== null && !usernameTaken(derived, account.id)) {
        account.username = derived;
      }
    }
    afterFieldWrite(account);
    json(res, 200, account);
    return;
  }

  if (method === 'POST' && pathName === '/me/username') {
    const token = bearer(req);
    const account = token === null ? undefined : byToken.get(token);
    if (!account) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      json(res, 400, { error: 'Expected a JSON body with a "username" string' });
      return;
    }
    if (typeof parsed?.username !== 'string') {
      json(res, 400, { error: 'Expected a JSON body with a "username" string' });
      return;
    }
    const username = parsed.username.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9._-]{0,31}$/.test(username) || username === '_') {
      json(res, 400, {
        error: 'Username must be 1–32 characters of a-z, 0-9, hyphen, underscore, or dot',
      });
      return;
    }
    if (usernameTaken(username, account.id)) {
      json(res, 409, { error: 'Username is already in use' });
      return;
    }
    account.username = username;
    afterFieldWrite(account);
    json(res, 200, account);
    return;
  }

  if (method === 'POST' && pathName === '/me/location') {
    const token = bearer(req);
    const account = token === null ? undefined : byToken.get(token);
    if (!account) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      json(res, 400, { error: 'Expected a JSON body with a "location" string' });
      return;
    }
    if (typeof parsed?.location !== 'string') {
      json(res, 400, { error: 'Expected a JSON body with a "location" string' });
      return;
    }
    const trimmed = parsed.location.trim();
    if (trimmed.length === 0) {
      account.location = null;
    } else if (trimmed.length > 80) {
      json(res, 400, { error: 'Location must be at most 80 characters' });
      return;
    } else {
      account.location = trimmed;
    }
    json(res, 200, account);
    return;
  }

  if (method === 'POST' && pathName === '/me/forum-laws-dismissed') {
    const token = bearer(req);
    const account = token === null ? undefined : byToken.get(token);
    if (!account) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    account.forumLawsDismissed = true;
    json(res, 200, account);
    return;
  }

  if (method === 'POST' && pathName === '/me/amount-unit') {
    const token = bearer(req);
    const account = token === null ? undefined : byToken.get(token);
    if (!account) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      json(res, 400, { error: 'Expected a JSON body with a unit of btc or fiat' });
      return;
    }
    if (parsed?.unit !== 'btc' && parsed?.unit !== 'fiat') {
      json(res, 400, { error: 'Expected a JSON body with a unit of btc or fiat' });
      return;
    }
    account.amountUnit = parsed.unit;
    json(res, 200, account);
    return;
  }

  if (method === 'POST' && (pathName === '/me/locale' || pathName === '/me/fiat')) {
    const token = bearer(req);
    const account = token === null ? undefined : byToken.get(token);
    if (!account) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      parsed = null;
    }
    const locales = ['en', 'de', 'es', 'fil'];
    const fiats = ['CHF', 'EUR', 'USD', 'PHP'];
    if (pathName === '/me/locale') {
      if (
        !locales.includes(parsed?.locale) ||
        (parsed.onlyIfUnset !== undefined && typeof parsed.onlyIfUnset !== 'boolean')
      ) {
        json(res, 400, { error: 'Expected a JSON body with a locale of en, de, es, or fil' });
        return;
      }
      if (parsed.onlyIfUnset !== true || account.locale == null) {
        account.locale = parsed.locale;
      }
    } else if (
      !fiats.includes(parsed?.fiat) ||
      (parsed.onlyIfUnset !== undefined && typeof parsed.onlyIfUnset !== 'boolean')
    ) {
      json(res, 400, { error: 'Expected a JSON body with a fiat of CHF, EUR, USD, or PHP' });
      return;
    } else if (parsed.onlyIfUnset !== true || account.fiat == null) {
      account.fiat = parsed.fiat;
    }
    json(res, 200, account);
    return;
  }

  if (method === 'POST' && pathName === '/me/notification-level') {
    const token = bearer(req);
    const account = token === null ? undefined : byToken.get(token);
    if (!account) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      json(res, 400, { error: 'Expected a JSON body with a level of all, active, or mentions' });
      return;
    }
    if (parsed?.level !== 'all' && parsed?.level !== 'active' && parsed?.level !== 'mentions') {
      json(res, 400, { error: 'Expected a JSON body with a level of all, active, or mentions' });
      return;
    }
    account.notificationLevel = parsed.level;
    json(res, 200, account);
    return;
  }

  if (method === 'POST' && pathName === '/me/heart-notifications') {
    const token = bearer(req);
    const account = token === null ? undefined : byToken.get(token);
    if (!account) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      json(res, 400, { error: 'Expected a JSON body with an enabled boolean' });
      return;
    }
    if (typeof parsed?.enabled !== 'boolean') {
      json(res, 400, { error: 'Expected a JSON body with an enabled boolean' });
      return;
    }
    account.notifyHearts = parsed.enabled;
    json(res, 200, account);
    return;
  }

  if (method === 'GET' && pathName === '/gifts') {
    const day = url.searchParams.get('day');
    if (day === '2026-06-01') {
      json(res, 200, {
        day: '2026-06-01',
        giftCount: 1,
        totalSats: 500,
        totalBtc: '0.00000500',
        totalUsd: '0.48',
        totalChf: '0.40',
        totalEur: '0.44',
        totalPhp: '27.00',
        gifts: [
          {
            paidAt: '2026-06-01T12:00:00.000Z',
            amountSats: 500,
            amountBtc: '0.00000500',
            amountUsd: '0.48',
            amountChf: '0.40',
            amountEur: '0.44',
            amountPhp: '27.00',
            recipient: 'alice',
          },
        ],
        fx: {
          quote: 'BTC-USD',
          dayBasis: 'utc',
          source: 'coinbase-exchange-daily-close',
          quotes: [
            { code: 'USD', pair: 'BTC-USD', source: 'coinbase-exchange-daily-close' },
            { code: 'CHF', pair: 'USD-CHF', source: 'ecb-daily' },
            { code: 'EUR', pair: 'USD-EUR', source: 'ecb-daily' },
            { code: 'PHP', pair: 'USD-PHP', source: 'ecb-daily' },
          ],
        },
      });
      return;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(day ?? '')) {
      json(res, 200, {
        day,
        giftCount: 0,
        totalSats: 0,
        totalBtc: '0.00000000',
        totalUsd: '0.00',
        totalChf: '0.00',
        totalEur: '0.00',
        totalPhp: '0.00',
        gifts: [],
        fx: {
          quote: 'BTC-USD',
          dayBasis: 'utc',
          source: 'coinbase-exchange-daily-close',
          quotes: [{ code: 'USD', pair: 'BTC-USD', source: 'coinbase-exchange-daily-close' }],
        },
      });
      return;
    }
    json(res, 400, { error: 'Expected a UTC day (YYYY-MM-DD)' });
    return;
  }

  if (method === 'GET' && pathName === '/gifts/stats') {
    json(res, 200, {
      totalSats: 0,
      totalBtc: '0.00000000',
      totalUsd: '0.00',
      totalChf: '0.00',
      totalEur: '0.00',
      totalPhp: '0.00',
      giftCount: 0,
      recipientCount: 0,
      firstPaidAt: null,
      lastPaidAt: null,
      spendOverTime: [],
      byRecipient: [],
      byMonth: [],
      fx: {
        quote: 'BTC-USD',
        dayBasis: 'utc',
        source: 'coinbase-exchange-daily-close',
        quotes: [{ code: 'USD', pair: 'BTC-USD', source: 'coinbase-exchange-daily-close' }],
      },
    });
    return;
  }

  if (method === 'GET' && pathName === '/fx/spot') {
    // No quote by default, the api's answer before its first price; specs that
    // need a rate answer this route themselves (e2e/fx-spot.ts).
    json(res, 200, { asOf: null, source: null, rates: {} });
    return;
  }

  if (method === 'GET' && pathName === '/shops/activity') {
    const endMs = Date.parse(`${new Date(Date.now()).toISOString().slice(0, 10)}T00:00:00.000Z`);
    const days = Array.from({ length: 30 }, (_, i) => ({
      day: new Date(endMs - (29 - i) * 86_400_000).toISOString().slice(0, 10),
      shopCount: 0,
    }));
    json(res, 200, { days });
    return;
  }

  if (method === 'POST' && pathName === '/e2e/wallet-verified') {
    const token = bearer(req);
    const account = token === null ? undefined : byToken.get(token);
    if (!account) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    account.sparkPubkey = `02${'ab'.repeat(32)}`;
    account.sparkWalletVerified = true;
    afterFieldWrite(account);
    json(res, 200, account);
    return;
  }

  if (method === 'GET' && pathName === '/funding/goal') {
    if (bearer(req) === null) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    const endMs = Date.parse(`${new Date(Date.now()).toISOString().slice(0, 10)}T00:00:00.000Z`);
    const days = Array.from({ length: 7 }, (_, i) => ({
      day: new Date(endMs - (6 - i) * 86_400_000).toISOString().slice(0, 10),
      shopCount: 0,
    }));
    json(res, 200, { days, qualifyingShops: 0 });
    return;
  }

  if (method === 'POST' && pathName === '/e2e/unclaimed-profile') {
    const account = newAccount(null);
    account.name = 'Ada';
    let username;
    do {
      username = `ada${hex(randomBytes(8))}`;
    } while (usernameTaken(username, ''));
    account.username = username;
    account.rulesAgreedAt = Date.now();
    account.forumLawsDismissed = true;
    afterFieldWrite(account);
    const token = hex(randomBytes(32));
    byToken.set(token, account);
    json(res, 200, { viewKey: account.viewKey, id: account.id, name: 'Ada' });
    return;
  }

  if (method === 'POST' && pathName === '/auth/passkey/register/begin') {
    const challengeId = hex(randomBytes(32));
    let parsed = null;
    if (rawBody.trim() !== '') {
      try {
        parsed = JSON.parse(rawBody);
      } catch {
        parsed = null;
      }
    }
    const body =
      parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;

    if (body !== null && 'viewKey' in body) {
      if (typeof body.viewKey !== 'string') {
        json(res, 400, {
          error: 'Expected a JSON body with an optional "viewKey" string',
        });
        return;
      }
      if (!/^[0-9a-f]{64}$/.test(body.viewKey)) {
        json(res, 404, { error: 'This profile could not be found.' });
        return;
      }
      let claimed;
      for (const row of byToken.values()) {
        if (row.viewKey === body.viewKey) {
          claimed = row;
          break;
        }
      }
      if (!claimed) {
        json(res, 404, { error: 'This profile could not be found.' });
        return;
      }
      if (typeof claimed.passkeyCredentialId === 'string' && claimed.passkeyCredentialId !== '') {
        json(res, 409, { error: 'This profile already has a passkey' });
        return;
      }
      byPasskey.set(challengeId, { type: 'register', claimAccountId: claimed.id });
      json(res, 200, {
        challengeId,
        options: {
          challenge: b64url(randomBytes(32)),
          rp: { id: 'localhost', name: '21.gifts' },
          user: {
            id: b64url(Buffer.from(claimed.id)),
            name: claimed.id,
            displayName: claimed.name || '21.gifts',
          },
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
          authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
          extensions: { prf: {} },
        },
      });
      return;
    }

    if (body !== null && 'name' in body) {
      if (typeof body.name !== 'string') {
        json(res, 400, {
          error: 'Expected a JSON body with an optional "name" string',
        });
        return;
      }
      const normalized = body.name.trim().toLowerCase();
      if (!/^[a-z0-9][a-z0-9._-]{0,31}$/.test(normalized)) {
        json(res, 400, {
          error: 'Username must be 1–32 characters of a-z, 0-9, hyphen, underscore, or dot',
        });
        return;
      }
      if (usernameTaken(normalized, '')) {
        json(res, 409, { error: 'Username is already in use' });
        return;
      }
      const accountId = `acc_${hex(randomBytes(8))}`;
      byPasskey.set(challengeId, { type: 'register', requestedName: normalized, accountId });
      json(res, 200, {
        challengeId,
        options: {
          challenge: b64url(randomBytes(32)),
          rp: { id: 'localhost', name: '21.gifts' },
          user: {
            id: b64url(Buffer.from(accountId)),
            name: normalized,
            displayName: normalized,
          },
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
          authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
          extensions: { prf: {} },
        },
      });
      return;
    }

    const accountId = `acc_${hex(randomBytes(8))}`;
    byPasskey.set(challengeId, { type: 'register', accountId });
    json(res, 200, {
      challengeId,
      options: {
        challenge: b64url(randomBytes(32)),
        rp: { id: 'localhost', name: '21.gifts' },
        user: {
          id: b64url(Buffer.from(accountId)),
          name: accountId,
          displayName: '21.gifts',
        },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
        authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
        extensions: { prf: {} },
      },
    });
    return;
  }

  if (method === 'POST' && pathName === '/auth/passkey/authenticate/begin') {
    const challengeId = hex(randomBytes(32));
    byPasskey.set(challengeId, { type: 'authenticate' });
    json(res, 200, {
      challengeId,
      options: {
        challenge: b64url(randomBytes(32)),
        rpId: 'localhost',
        userVerification: 'required',
      },
    });
    return;
  }

  if (
    method === 'POST' &&
    (pathName === '/auth/passkey/register/finish' ||
      pathName === '/auth/passkey/authenticate/finish')
  ) {
    const expectedType = pathName.includes('/register/') ? 'register' : 'authenticate';
    let parsed;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      json(res, 400, { error: 'Expected a JSON body with challengeId and credential' });
      return;
    }
    if (typeof parsed?.challengeId !== 'string' || parsed.credential === undefined) {
      json(res, 400, { error: 'Expected a JSON body with challengeId and credential' });
      return;
    }
    const origin = req.headers.origin;
    if (origin !== 'http://localhost:3000') {
      json(res, 400, { error: 'Invalid origin' });
      return;
    }
    const credential = parsed.credential;
    if (typeof credential !== 'object' || credential === null) {
      json(res, 400, { error: 'Invalid passkey' });
      return;
    }
    const credId = credential.id;
    const rawId = credential.rawId;
    if (
      typeof credId !== 'string' ||
      credId === '' ||
      credential.type !== 'public-key' ||
      typeof rawId !== 'string' ||
      rawId === ''
    ) {
      json(res, 400, { error: 'Unknown credential' });
      return;
    }
    const pending = byPasskey.get(parsed.challengeId);
    if (!pending || pending.type !== expectedType) {
      json(res, 400, { error: 'Unknown or expired challenge' });
      return;
    }
    byPasskey.delete(parsed.challengeId);
    let account;
    if (expectedType === 'register') {
      if (typeof pending.claimAccountId === 'string') {
        for (const row of byToken.values()) {
          if (row.id === pending.claimAccountId) {
            account = row;
            break;
          }
        }
        if (!account) {
          json(res, 404, { error: 'This profile could not be found.' });
          return;
        }
        account.passkeyCredentialId = credId;
        byPasskeyCredential.set(credId, account);
      } else if (typeof pending.requestedName === 'string') {
        if (usernameTaken(pending.requestedName, '')) {
          json(res, 409, { error: 'Username is already in use' });
          return;
        }
        account = newAccount(null);
        account.id = pending.accountId;
        account.name = pending.requestedName;
        account.username = pending.requestedName;
        account.passkeyCredentialId = credId;
        byPasskeyCredential.set(credId, account);
        afterFieldWrite(account);
      } else {
        account = newAccount(null);
        account.id = pending.accountId;
        account.passkeyCredentialId = credId;
        byPasskeyCredential.set(credId, account);
      }
    } else {
      account = byPasskeyCredential.get(credId);
      if (!account) {
        json(res, 400, { error: 'Unknown credential' });
        return;
      }
    }
    const token = hex(randomBytes(32));
    byToken.set(token, account);
    json(res, 200, { token, account });
    return;
  }

  if (method === 'PUT' && pathName === '/me/wallet') {
    const token = bearer(req);
    const account = token === null ? undefined : byToken.get(token);
    if (!account) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    if (account.sparkWalletVerified === true) {
      json(res, 409, { error: 'Wallet already verified' });
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      parsed = null;
    }
    if (
      typeof parsed?.sparkPubkey !== 'string' ||
      !/^0[23][0-9a-f]{64}$/.test(parsed.sparkPubkey)
    ) {
      json(res, 400, { error: 'Expected a JSON body with a "sparkPubkey" string' });
      return;
    }
    account.sparkPubkey = parsed.sparkPubkey;
    account.sparkWalletVerified = false;
    json(res, 200, account);
    return;
  }

  if (method === 'POST' && pathName === '/me/wallet/report') {
    const token = bearer(req);
    const account = token === null ? undefined : byToken.get(token);
    if (!account) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    let body;
    try {
      body = JSON.parse(rawBody);
    } catch {
      json(res, 400, { error: 'Invalid JSON' });
      return;
    }
    if (
      typeof body?.balanceSats !== 'number' ||
      body.balanceSats < 0 ||
      typeof body.syncedAt !== 'string' ||
      !Array.isArray(body.payments) ||
      body.payments.length > 200
    ) {
      json(res, 400, { error: 'Invalid report' });
      return;
    }
    const rows = walletReports.get(account.id) ?? [];
    rows.push(body);
    walletReports.set(account.id, rows);
    json(res, 200, {
      acknowledgedIds: body.payments
        .map((payment) => payment?.id)
        .filter((id) => typeof id === 'string'),
    });
    return;
  }

  if (method === 'POST' && pathName === '/me/events') {
    const token = bearer(req);
    const account = token === null ? undefined : byToken.get(token);
    if (!account) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    let body;
    try {
      body = JSON.parse(rawBody);
    } catch {
      json(res, 400, { error: 'Invalid JSON' });
      return;
    }
    if (!Array.isArray(body?.events) || body.events.length > 50) {
      json(res, 400, { error: 'Invalid events' });
      return;
    }
    const rows = interactionEvents.get(account.id) ?? [];
    rows.push(...body.events);
    interactionEvents.set(account.id, rows);
    res.writeHead(204);
    res.end();
    return;
  }

  if (method === 'GET' && (pathName === '/e2e/events' || pathName === '/e2e/wallet-reports')) {
    const token = bearer(req);
    const account = token === null ? undefined : byToken.get(token);
    if (!account) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    json(
      res,
      200,
      pathName === '/e2e/events'
        ? { events: interactionEvents.get(account.id) ?? [] }
        : { reports: walletReports.get(account.id) ?? [] },
    );
    return;
  }

  if (method === 'POST' && pathName === '/me/wallet-backup-seen') {
    const token = bearer(req);
    const account = token === null ? undefined : byToken.get(token);
    if (!account) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    afterFieldWrite(account);
    json(res, 200, account);
    return;
  }

  if (
    method === 'POST' &&
    (pathName === '/me/passkey-renew/report' || pathName === '/me/passkey-renew/ack')
  ) {
    const token = bearer(req);
    const account = token === null ? undefined : byToken.get(token);
    if (!account) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    const hasSeed =
      typeof account.passkeyCredentialId === 'string' && account.passkeyCredentialId !== '';
    if (pathName === '/me/passkey-renew/report') {
      let outcome = '';
      let errorName = '';
      try {
        const parsed = JSON.parse(rawBody);
        if (typeof parsed?.outcome === 'string') {
          outcome = parsed.outcome;
        }
        if (typeof parsed?.errorName === 'string') {
          errorName = parsed.errorName;
        }
      } catch {
        outcome = '';
      }
      if (!hasSeed && outcome === 'failed') {
        account.passkeyRenewFailed = true;
        account.passkeyRenewPrfUnsupported = errorName === 'prfUnsupported';
      }
    } else if (!hasSeed && account.passkeyRenewFailed === true) {
      account.passkeyRenewFailed = false;
      account.passkeyRenewPrfUnsupported = false;
      account.passkeyRenewClosed = true;
    }
    json(res, 200, account);
    return;
  }

  if (method === 'POST' && pathName === '/auth/passkey/replace/begin') {
    const token = bearer(req);
    const account = token === null ? undefined : byToken.get(token);
    if (!account) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    let currentId;
    for (const [id, owned] of byPasskeyCredential.entries()) {
      if (owned === account) {
        currentId = id;
        break;
      }
    }
    if (!currentId) {
      json(res, 400, { error: 'No passkey to replace' });
      return;
    }
    const challengeId = hex(randomBytes(32));
    const userId = hex(randomBytes(16));
    byPasskey.set(challengeId, { type: 'replace', account });
    json(res, 200, {
      challengeId,
      options: {
        challenge: b64url(randomBytes(32)),
        rp: { id: 'localhost', name: '21.gifts' },
        user: { id: b64url(Buffer.from(userId, 'hex')), name: userId, displayName: '21.gifts' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
        authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
        excludeCredentials: [{ type: 'public-key', id: currentId }],
        extensions: { prf: {} },
      },
    });
    return;
  }

  if (method === 'POST' && pathName === '/auth/passkey/replace/finish') {
    const token = bearer(req);
    const account = token === null ? undefined : byToken.get(token);
    if (!account) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      json(res, 400, { error: 'Expected a JSON body with challengeId and credential' });
      return;
    }
    const pending = byPasskey.get(parsed?.challengeId);
    if (!pending || pending.type !== 'replace' || pending.account !== account) {
      json(res, 400, { error: 'Unknown or expired challenge' });
      return;
    }
    byPasskey.delete(parsed.challengeId);
    const credId = parsed.credential?.id;
    if (typeof credId !== 'string' || credId === '') {
      json(res, 400, { error: 'Invalid passkey' });
      return;
    }
    for (const [id, owned] of byPasskeyCredential.entries()) {
      if (owned === account) {
        byPasskeyCredential.delete(id);
      }
    }
    byPasskeyCredential.set(credId, account);
    json(res, 200, { account });
    return;
  }

  if (method === 'POST' && pathName === '/auth/passkey/seed/begin') {
    const token = bearer(req);
    const account = token === null ? undefined : byToken.get(token);
    if (!account) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    if (typeof account.passkeyCredentialId === 'string' && account.passkeyCredentialId !== '') {
      json(res, 409, { error: 'This account already has a recovery phrase' });
      return;
    }
    const challengeId = hex(randomBytes(32));
    const userId = hex(randomBytes(16));
    byPasskey.set(challengeId, { type: 'seed', account });
    json(res, 200, {
      challengeId,
      options: {
        challenge: b64url(randomBytes(32)),
        rp: { id: 'localhost', name: '21.gifts' },
        user: { id: b64url(Buffer.from(userId, 'hex')), name: userId, displayName: '21.gifts' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
        authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
        extensions: { prf: {} },
      },
    });
    return;
  }

  if (method === 'POST' && pathName === '/auth/passkey/seed/finish') {
    const token = bearer(req);
    const account = token === null ? undefined : byToken.get(token);
    if (!account) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      json(res, 400, { error: 'Expected a JSON body with challengeId and credential' });
      return;
    }
    const pending = byPasskey.get(parsed?.challengeId);
    if (!pending || pending.type !== 'seed' || pending.account !== account) {
      json(res, 400, { error: 'Unknown or expired challenge' });
      return;
    }
    byPasskey.delete(parsed.challengeId);
    const credId = parsed.credential?.id;
    if (typeof credId !== 'string' || credId === '') {
      json(res, 400, { error: 'Invalid passkey' });
      return;
    }
    if (typeof account.passkeyCredentialId === 'string' && account.passkeyCredentialId !== '') {
      json(res, 409, { error: 'This account already has a recovery phrase' });
      return;
    }
    byPasskeyCredential.set(credId, account);
    account.passkeyCredentialId = credId;
    account.walletRequired = true;
    account.passkeyRenewClosed = false;
    json(res, 200, account);
    return;
  }

  if (method === 'GET' && pathName === '/trust-chain') {
    if (bearer(req) === null) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    json(res, 200, { nodes: [], edges: [] });
    return;
  }

  if (method === 'GET' && pathName === '/trust/proposals') {
    if (bearer(req) === null) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    json(res, 200, { proposals: [] });
    return;
  }

  if (
    method === 'POST' &&
    (pathName === '/trust/verify' ||
      pathName === '/trust/propose-moderator' ||
      pathName === '/trust/confirm-moderator' ||
      pathName === '/trust/reject-moderator' ||
      pathName === '/trust/appoint-moderator')
  ) {
    if (bearer(req) === null) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    json(res, 403, { error: 'Forbidden' });
    return;
  }

  if (method === 'POST' && pathName === '/funding/apply') {
    const token = bearer(req);
    const account = token === null ? undefined : byToken.get(token);
    if (!account) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    if (account.role === 'basis') {
      json(res, 403, { error: 'Forbidden' });
      return;
    }
    // Same allowlist as GRANT_APPLICATION_STILL_OPEN_USERNAMES. The api
    // refuses every other username while applications are paused.
    if (
      account.username !== 'joey-rosima' &&
      account.username !== 'vincent' &&
      account.username !== 'jewel-bacolbas'
    ) {
      json(res, 403, { error: 'Applications are paused' });
      return;
    }
    json(res, 200, {
      funding: { status: 'pending', trialUtcDate: null, admittedAt: null, reviewedByName: null },
    });
    return;
  }

  if (method === 'GET' && pathName === '/funding/payout-days') {
    const token = bearer(req);
    const account = token === null ? undefined : byToken.get(token);
    if (!account) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    if (!roleAtLeast(account.role, 'moderator')) {
      json(res, 403, { error: 'Forbidden' });
      return;
    }
    json(res, 200, {
      days: [
        '2026-09-20',
        '2026-09-21',
        '2026-09-22',
        '2026-09-23',
        '2026-09-24',
        '2026-09-25',
        '2026-09-26',
      ],
      rows: [],
    });
    return;
  }

  if (pathName === '/funding/daily-roster' || pathName.startsWith('/funding/daily-roster/')) {
    const token = bearer(req);
    const account = token === null ? undefined : byToken.get(token);
    if (!account) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    if (account.role !== 'initiator' && account.role !== 'founder') {
      json(res, 403, { error: 'Forbidden' });
      return;
    }
    const roster = {
      comment: '',
      paymentsEnabled: true,
      defaultAmountUsd: 1,
      recipients: [],
    };
    if (method === 'GET' && pathName === '/funding/daily-roster') {
      json(res, 200, roster);
      return;
    }
    if (method === 'POST') {
      json(res, 200, roster);
      return;
    }
    json(res, 404, { error: 'Not found' });
    return;
  }

  if (method === 'GET' && pathName === '/funding/applications') {
    const token = bearer(req);
    const account = token === null ? undefined : byToken.get(token);
    if (!account) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    if (!roleAtLeast(account.role, 'moderator')) {
      json(res, 403, { error: 'Forbidden' });
      return;
    }
    json(res, 200, { applications: [] });
    return;
  }

  const fundingApplicationMatch = pathName.match(/^\/funding\/applications\/([^/]+)$/);
  if (method === 'GET' && fundingApplicationMatch) {
    const token = bearer(req);
    const account = token === null ? undefined : byToken.get(token);
    if (!account) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    if (!roleAtLeast(account.role, 'moderator')) {
      json(res, 403, { error: 'Forbidden' });
      return;
    }
    json(res, 404, { error: 'Not found' });
    return;
  }

  if (
    method === 'POST' &&
    (pathName === '/funding/trial' ||
      pathName === '/funding/admit' ||
      pathName === '/funding/reject')
  ) {
    const token = bearer(req);
    const account = token === null ? undefined : byToken.get(token);
    if (!account) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    if (!roleAtLeast(account.role, 'moderator')) {
      json(res, 403, { error: 'Forbidden' });
      return;
    }
    const status = pathName.endsWith('/trial')
      ? 'trial'
      : pathName.endsWith('/admit')
        ? 'admitted'
        : 'rejected';
    json(res, 200, {
      id: 'x',
      name: null,
      role: 'verified',
      funding: {
        status,
        trialUtcDate: status === 'trial' ? '2026-09-20' : null,
        admittedAt: status === 'admitted' ? 1 : null,
        reviewedByName: null,
      },
    });
    return;
  }

  if (method === 'POST' && pathName === '/diagnostics') {
    res.writeHead(204);
    res.end();
    return;
  }

  json(res, 404, { error: 'Not found' });
});

server.listen(PORT, HOST, () => {
  console.error(`e2e mock api listening on http://${HOST}:${PORT}`);
});
