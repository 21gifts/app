#!/usr/bin/env node
/**
 * In-process 21.gifts api stub for Playwright. Speaks the public HTTP
 * protocol so Next.js same-origin proxies succeed. Not a Lightning node:
 * callbacks accept any signature. Pay-on-note uses POST /messages/:id/invoice.
 */
import http from 'node:http';
import { randomBytes } from 'node:crypto';

const PORT = 3001;
const HOST = '127.0.0.1';

/** @type {Map<string, object>} */
const byToken = new Map();
/** @type {Map<string, { type: 'register' | 'authenticate' }>} */
const byPasskey = new Map();
/** @type {Map<string, object>} */
const byPasskeyCredential = new Map();
/** @type {Array<{ id: string, name: string, text: string, createdAt: string, sats: number, payable: boolean, hasPhoto: boolean, role: string }>} */
const forumMessages = [];
/** @type {Array<{ id: string, name: string, text: string, createdAt: string }>} */
const contactMessages = [];
/** @type {Map<string, Buffer>} */
const forumPhotos = new Map();

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

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'authorization, content-type, user-agent',
    'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
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

function newAccount(linkingKey) {
  return {
    id: `acc_${hex(randomBytes(8))}`,
    linkingKey,
    role: 'basis',
    name: null,
    lightningAddress: null,
    lightningAddressVerified: false,
    forumLawsDismissed: false,
    createdAt: Date.now(),
    rulesAgreedAt: null,
    viewKey: hex(randomBytes(32)),
  };
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'authorization, content-type, user-agent',
      'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
    });
    res.end();
    return;
  }

  const url = new URL(req.url ?? '/', `http://${HOST}:${PORT}`);
  const pathName = url.pathname;
  const method = req.method ?? 'GET';

  if (method === 'GET' && pathName === '/healthz') {
    json(res, 200, { status: 'ok' });
    return;
  }

  if (method === 'GET' && pathName === '/messages') {
    const token = bearer(req);
    const account = token === null ? undefined : byToken.get(token);
    if (!account) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    json(res, 200, { messages: [...forumMessages] });
    return;
  }

  if (method === 'POST' && pathName === '/messages') {
    const token = bearer(req);
    const account = token === null ? undefined : byToken.get(token);
    if (!account) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    const name = typeof account.name === 'string' ? account.name.trim() : '';
    if (name === '') {
      json(res, 400, { error: 'Set a name before posting' });
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(await readBody(req));
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
    if ((text.length < 1 && !hasPhoto) || text.length > 500) {
      json(res, 400, {
        error: 'Text must be 1–500 characters or include a photo',
      });
      return;
    }
    const created = {
      id: `msg_${hex(randomBytes(8))}`,
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

  const invoiceMatch = pathName.match(/^\/messages\/([^/]+)\/invoice$/);
  if (method === 'POST' && invoiceMatch) {
    const token = bearer(req);
    const account = token === null ? undefined : byToken.get(token);
    if (!account) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    const row = forumMessages.find((message) => message.id === invoiceMatch[1]);
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
      parsed = JSON.parse(await readBody(req));
    } catch {
      json(res, 400, { error: 'Expected a JSON body with a positive "sats" integer' });
      return;
    }
    const sats = parsed?.sats;
    if (!Number.isInteger(sats) || sats < 1) {
      json(res, 400, { error: 'Expected a JSON body with a positive "sats" integer' });
      return;
    }
    json(res, 200, { pr: `lnbc${sats}n1test`, amountSats: sats });
    return;
  }

  if (method === 'POST' && pathName === '/contact') {
    const token = bearer(req);
    const account = token === null ? undefined : byToken.get(token);
    if (!account) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    const name = typeof account.name === 'string' ? account.name.trim() : '';
    if (name === '') {
      json(res, 400, { error: 'Set a name before posting' });
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(await readBody(req));
    } catch {
      json(res, 400, { error: 'Expected a JSON body with a "text" string' });
      return;
    }
    if (typeof parsed?.text !== 'string') {
      json(res, 400, { error: 'Expected a JSON body with a "text" string' });
      return;
    }
    const text = parsed.text.trim();
    if (text.length < 1 || text.length > 500) {
      json(res, 400, { error: 'Text must be 1–500 characters' });
      return;
    }
    const created = {
      id: `contact_${hex(randomBytes(8))}`,
      name,
      text,
      createdAt: new Date().toISOString(),
    };
    contactMessages.unshift(created);
    json(res, 200, created);
    return;
  }

  const photoMatch = pathName.match(/^\/messages\/([^/]+)\/photo$/);
  if (method === 'GET' && photoMatch) {
    const token = bearer(req);
    const account = token === null ? undefined : byToken.get(token);
    if (!account) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    const id = decodeURIComponent(photoMatch[1]);
    const bytes = forumPhotos.get(id);
    if (bytes === undefined) {
      json(res, 404, { error: 'Not found' });
      return;
    }
    res.writeHead(200, {
      'content-type': 'image/jpeg',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'authorization, content-type, user-agent',
      'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
    });
    res.end(bytes);
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
    json(res, 200, account);
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
    json(res, 200, {
      name: found.name,
      lightningAddress: found.lightningAddress,
      lightningAddressVerified: found.lightningAddressVerified,
      createdAt: found.createdAt,
    });
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
      parsed = JSON.parse(await readBody(req));
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

  if (method === 'POST' && pathName === '/me/lightning-address') {
    const token = bearer(req);
    const account = token === null ? undefined : byToken.get(token);
    if (!account) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(await readBody(req));
    } catch {
      json(res, 400, { error: 'Expected a JSON body with an "address" string' });
      return;
    }
    if (typeof parsed?.address !== 'string') {
      json(res, 400, { error: 'Expected a JSON body with an "address" string' });
      return;
    }
    const trimmed = parsed.address.trim();
    if (!/^[^@]+@[^@]+$/.test(trimmed) || trimmed.length > 255) {
      json(res, 400, { error: 'Not a valid Lightning Address (expected name@domain)' });
      return;
    }
    account.lightningAddress = trimmed;
    account.lightningAddressVerified = false;
    json(res, 200, account);
    return;
  }

  if (method === 'DELETE' && pathName === '/me/lightning-address') {
    const token = bearer(req);
    const account = token === null ? undefined : byToken.get(token);
    if (!account) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }
    account.lightningAddress = null;
    account.lightningAddressVerified = false;
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
        gifts: [
          {
            paidAt: '2026-06-01T12:00:00.000Z',
            amountSats: 500,
            amountBtc: '0.00000500',
            amountUsd: '0.48',
            recipient: 'alice',
          },
        ],
        fx: { quote: 'BTC-USD', dayBasis: 'utc', source: 'coinbase-exchange-daily-close' },
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
        gifts: [],
        fx: { quote: 'BTC-USD', dayBasis: 'utc', source: 'coinbase-exchange-daily-close' },
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
      giftCount: 0,
      recipientCount: 0,
      firstPaidAt: null,
      lastPaidAt: null,
      spendOverTime: [],
      byRecipient: [],
      byMonth: [],
      fx: { quote: 'BTC-USD', dayBasis: 'utc', source: 'coinbase-exchange-daily-close' },
    });
    return;
  }

  if (method === 'POST' && pathName === '/auth/passkey/register/begin') {
    const challengeId = hex(randomBytes(32));
    const userId = hex(randomBytes(16));
    byPasskey.set(challengeId, { type: 'register' });
    json(res, 200, {
      challengeId,
      options: {
        challenge: b64url(randomBytes(32)),
        rp: { id: 'localhost', name: '21.gifts' },
        user: { id: b64url(Buffer.from(userId, 'hex')), name: userId, displayName: '21.gifts' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
        authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
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
      parsed = JSON.parse(await readBody(req));
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
      account = newAccount(null);
      byPasskeyCredential.set(credId, account);
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

  if (method === 'GET' && pathName === '/lightning-address') {
    const raw = url.searchParams.get('address') ?? '';
    if (!/^[^@]+@[^@]+$/.test(raw)) {
      json(res, 400, { error: 'Not a valid Lightning Address (expected name@domain)' });
      return;
    }
    const address = raw.toLowerCase();
    const highMin = address.startsWith('highmin@');
    json(res, 200, {
      address,
      callback: 'https://ln.example.com/pay',
      minSendable: highMin ? 100_000 : 1000,
      maxSendable: 1_000_000_000,
    });
    return;
  }

  json(res, 404, { error: 'Not found' });
});

server.listen(PORT, HOST, () => {
  console.error(`e2e mock api listening on http://${HOST}:${PORT}`);
});
