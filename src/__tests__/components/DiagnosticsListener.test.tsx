import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DiagnosticsListener } from '@/components/DiagnosticsListener';

/** jsdom has no PromiseRejectionEvent. The listener only reads `reason`. */
function rejection(reason: unknown): Event {
  const event = new Event('unhandledrejection');
  Object.defineProperty(event, 'reason', { value: reason });
  return event;
}

/** A real ErrorEvent makes jsdom report an uncaught exception after the test. */
function windowError(error: unknown): Event {
  const event = new Event('error');
  Object.defineProperty(event, 'error', { value: error });
  return event;
}

describe('DiagnosticsListener', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('reports window error and unhandled rejection, then stops after unmount', () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));
    const view = render(<DiagnosticsListener />);
    window.dispatchEvent(windowError(new TypeError('Boom')));
    window.dispatchEvent(rejection(new Error('Later')));
    const bodies = fetchMock.mock.calls.map((call) =>
      JSON.parse(String((call[1] as RequestInit).body)),
    );
    expect(bodies).toEqual([
      {
        event: 'client.unhandled',
        stage: 'unhandled',
        path: window.location.pathname,
        name: 'TypeError',
        message: 'Boom',
      },
      {
        event: 'client.unhandled',
        stage: 'unhandled',
        path: window.location.pathname,
        name: 'Error',
        message: 'Later',
      },
    ]);
    view.unmount();
    window.dispatchEvent(rejection(new Error('After')));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('omits a null reason and a reason whose fields are not strings', () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));
    render(<DiagnosticsListener />);
    window.dispatchEvent(rejection(null));
    window.dispatchEvent(rejection({ name: 1, message: false }));
    const bodies = fetchMock.mock.calls.map((call) =>
      JSON.parse(String((call[1] as RequestInit).body)),
    );
    expect(bodies).toEqual([
      { event: 'client.unhandled', stage: 'unhandled', path: window.location.pathname },
      { event: 'client.unhandled', stage: 'unhandled', path: window.location.pathname },
    ]);
  });

  it('omits a non-object rejection reason', () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));
    render(<DiagnosticsListener />);
    window.dispatchEvent(rejection('plain'));
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({
      event: 'client.unhandled',
      stage: 'unhandled',
      path: window.location.pathname,
    });
  });
});
