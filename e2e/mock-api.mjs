#!/usr/bin/env node
/**
 * In-process 21.gifts api stub for Playwright. Speaks the public HTTP
 * protocol so Next.js same-origin proxies succeed. Not a Lightning node:
 * callbacks accept any signature, and LNURL-pay metadata points at a
 * dummy HTTPS callback that donate e2e intercepts in the browser.
 */
import http from 'node:http';
import { randomBytes } from 'node:crypto';

const PORT = 3001;
const HOST = '127.0.0.1';

/** @typedef {{ k1: string, pollToken: string, status: 'pending' | 'authenticated' | 'used', linkingKey: string | null, token: string | null, account: object | null }} Challenge */

/** @type {Map<string, Challenge>} */
const byK1 = new Map();
/** @type {Map<string, Challenge>} */
const byPoll = new Map();
/** @type {Map<string, object>} */
const byToken = new Map();
/** @type {Map<string, { type: 'register' | 'authenticate' }>} */
const byPasskey = new Map();

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
    'access-control-allow-headers': 'authorization, content-type, x-poll-token, user-agent',
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
    createdAt: Date.now(),
  };
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'authorization, content-type, x-poll-token, user-agent',
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

  if (method === 'GET' && pathName === '/auth/lnurl') {
    const k1 = hex(randomBytes(32));
    const pollToken = hex(randomBytes(32));
    const challenge = {
      k1,
      pollToken,
      status: 'pending',
      linkingKey: null,
      token: null,
      account: null,
    };
    byK1.set(k1, challenge);
    byPoll.set(pollToken, challenge);
    json(res, 200, {
      lnurl: 'lnurl1dp68gurn8ghj7example',
      k1,
      pollToken,
      expiresInSeconds: 90,
    });
    return;
  }

  if (method === 'GET' && pathName === '/auth/lnurl/callback') {
    const k1 = url.searchParams.get('k1');
    const sig = url.searchParams.get('sig');
    const key = url.searchParams.get('key');
    if (!k1 || !sig || !key) {
      json(res, 200, { status: 'ERROR', reason: 'Missing k1, sig, or key' });
      return;
    }
    const challenge = byK1.get(k1);
    if (!challenge || challenge.status !== 'pending') {
      json(res, 200, { status: 'ERROR', reason: 'Unknown k1' });
      return;
    }
    const account = newAccount(key);
    const token = hex(randomBytes(32));
    challenge.status = 'authenticated';
    challenge.linkingKey = key;
    challenge.token = token;
    challenge.account = account;
    byToken.set(token, account);
    json(res, 200, { status: 'OK' });
    return;
  }

  if (method === 'GET' && pathName === '/auth/session') {
    const pollToken = req.headers['x-poll-token'];
    if (typeof pollToken !== 'string' || pollToken === '') {
      json(res, 200, { status: 'expired' });
      return;
    }
    const challenge = byPoll.get(pollToken);
    if (!challenge) {
      json(res, 200, { status: 'expired' });
      return;
    }
    if (challenge.status === 'pending') {
      json(res, 200, { status: 'pending' });
      return;
    }
    if (challenge.status === 'used') {
      json(res, 200, { status: 'used' });
      return;
    }
    challenge.status = 'used';
    json(res, 200, {
      status: 'authenticated',
      token: challenge.token,
      account: challenge.account,
    });
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
    account.lightningAddress = parsed.address;
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

  if (method === 'GET' && pathName === '/gifts/stats') {
    json(res, 200, {
      totalSats: 0,
      giftCount: 0,
      recipientCount: 0,
      firstPaidAt: null,
      lastPaidAt: null,
      spendOverTime: [],
      byRecipient: [],
      byMonth: [],
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
    const pending = byPasskey.get(parsed.challengeId);
    if (!pending || pending.type !== expectedType) {
      json(res, 400, { error: 'Unknown or expired challenge' });
      return;
    }
    byPasskey.delete(parsed.challengeId);
    const account = newAccount(null);
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
