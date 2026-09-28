import { afterEach, describe, expect, it, vi } from 'vitest';
import { reportDiagnostic } from '@/lib/diagnostics';

describe('reportDiagnostic', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('posts cleaned JSON and omits a message that contains a slash', () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));
    reportDiagnostic({
      event: 'client.passkey.register.finish',
      message: 'has/slash',
      name: 'TypeError',
      challengeId: 'ab'.repeat(32),
      accountId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      stage: 'register',
      status: 400,
      path: '/login',
      prfPresent: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/diagnostics');
    expect(init.method).toBe('POST');
    expect(init.keepalive).toBe(true);
    expect(init.headers).toEqual({ 'content-type': 'application/json' });
    expect(JSON.parse(String(init.body))).toEqual({
      event: 'client.passkey.register.finish',
      name: 'TypeError',
      challengeId: 'ab'.repeat(32),
      accountId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      stage: 'register',
      status: 400,
      path: '/login',
      prfPresent: false,
    });
  });

  it('sends nothing for an event outside the allowlist', () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    reportDiagnostic({ event: 'passkey.boom', message: 'safe' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('drops unsafe scalars and still sends the event', () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));
    reportDiagnostic({
      event: 'client.passkey.register.begin',
      name: 'Not Allowed',
      message: 'x'.repeat(121),
      challengeId: 'ch',
      accountId: 'not-a-uuid',
      status: 99,
      path: `/x/${'a'.repeat(32)}`,
    });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({ event: 'client.passkey.register.begin' });
  });

  it('keeps a safe message and drops a bad stage, status, and path', () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));
    reportDiagnostic({
      event: 'client.passkey.register.ceremony',
      message: 'Passkey creation returned no credential',
      stage: 'nope' as 'register',
      status: 600,
      path: '/login?x=1',
    });
    reportDiagnostic({
      event: 'client.unhandled',
      status: 100.5,
      path: '/ok',
    });
    const bodies = fetchMock.mock.calls.map((call) =>
      JSON.parse(String((call[1] as RequestInit).body)),
    );
    expect(bodies).toEqual([
      {
        event: 'client.passkey.register.ceremony',
        message: 'Passkey creation returned no credential',
      },
      { event: 'client.unhandled', path: '/ok' },
    ]);
  });

  it('does not throw when fetch rejects', () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    expect(() => {
      reportDiagnostic({ event: 'client.unhandled', stage: 'unhandled' });
    }).not.toThrow();
  });
});
