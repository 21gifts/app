import { act, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PushOpenListener } from '@/components/PushOpenListener';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const navigation = vi.hoisted(() => ({
  push: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => navigation,
}));

function stubServiceWorker(): EventTarget {
  const worker = new EventTarget();
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: worker,
  });
  return worker;
}

function postMessage(worker: EventTarget, data: unknown): void {
  act(() => {
    worker.dispatchEvent(new MessageEvent('message', { data }));
  });
}

afterEach(() => {
  cleanup();
  navigation.push.mockReset();
});

describe('PushOpenListener', () => {
  it('renders nothing without a service worker and does not throw', () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: undefined,
    });
    expect(() => {
      const { container } = renderWithLocale(<PushOpenListener />);
      expect(container.firstChild).toBeNull();
    }).not.toThrow();
  });

  it('pushes a same-origin path from 21gifts-push-open', () => {
    const worker = stubServiceWorker();
    renderWithLocale(<PushOpenListener />);
    postMessage(worker, { type: '21gifts-push-open', url: '/messages/note-1' });
    expect(navigation.push).toHaveBeenCalledTimes(1);
    expect(navigation.push).toHaveBeenCalledWith('/messages/note-1');
  });

  it('pushes a path with search or hash', () => {
    const worker = stubServiceWorker();
    renderWithLocale(<PushOpenListener />);
    postMessage(worker, { type: '21gifts-push-open', url: '/messages?c=c-1' });
    postMessage(worker, { type: '21gifts-push-open', url: '/messages/note-1#reply' });
    expect(navigation.push).toHaveBeenCalledWith('/messages?c=c-1');
    expect(navigation.push).toHaveBeenCalledWith('/messages/note-1#reply');
    expect(navigation.push).toHaveBeenCalledTimes(2);
  });

  it('ignores messages that are not a same-origin in-app path', () => {
    const worker = stubServiceWorker();
    renderWithLocale(<PushOpenListener />);
    postMessage(worker, null);
    postMessage(worker, { type: 'other', url: '/messages/note-1' });
    postMessage(worker, { type: '21gifts-push-open', url: '//evil' });
    postMessage(worker, { type: '21gifts-push-open', url: 'https://example.com' });
    postMessage(worker, { type: '21gifts-push-open', url: '' });
    postMessage(worker, { type: '21gifts-push-open', url: '\\evil' });
    postMessage(worker, { type: '21gifts-push-open' });
    postMessage(worker, 'nope');
    postMessage(worker, {});
    postMessage(worker, { type: '21gifts-push-open', url: '/x://y' });
    postMessage(worker, { type: '21gifts-push-open', url: '/a\\b' });
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it('removes the listener on unmount', () => {
    const worker = stubServiceWorker();
    const { unmount } = renderWithLocale(<PushOpenListener />);
    unmount();
    postMessage(worker, { type: '21gifts-push-open', url: '/messages/note-1' });
    expect(navigation.push).not.toHaveBeenCalled();
  });
});
