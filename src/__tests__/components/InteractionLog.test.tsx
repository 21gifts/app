import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InteractionLog } from '@/components/InteractionLog';
import { logInteraction, startInteractionLog } from '@/lib/interaction-log';
import { useAuthStore } from '@/stores/auth-store';

const nav = vi.hoisted(() => ({ pathname: '/welcome' }));

vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }));
vi.mock('@/lib/interaction-log', () => ({
  logInteraction: vi.fn(),
  startInteractionLog: vi.fn(),
}));

beforeEach(() => {
  nav.pathname = '/welcome';
  useAuthStore.setState({ session: 'sess' });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('InteractionLog', () => {
  it('starts the log once, renders nothing, and stops it on unmount', () => {
    const stop = vi.fn();
    vi.mocked(startInteractionLog).mockReturnValue(stop);
    const { container, unmount, rerender } = render(<InteractionLog />);
    rerender(<InteractionLog />);
    expect(startInteractionLog).toHaveBeenCalledTimes(1);
    expect(container.firstChild).toBeNull();
    unmount();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('records a screen view per path while signed in', () => {
    vi.mocked(startInteractionLog).mockReturnValue(() => undefined);
    const { rerender } = render(<InteractionLog />);
    expect(logInteraction).toHaveBeenCalledWith('screen_view');
    nav.pathname = '/wallet';
    rerender(<InteractionLog />);
    expect(vi.mocked(logInteraction).mock.calls).toEqual([['screen_view'], ['screen_view']]);
  });

  it('records nothing signed out, and the current view once signed in', () => {
    vi.mocked(startInteractionLog).mockReturnValue(() => undefined);
    useAuthStore.setState({ session: null });
    render(<InteractionLog />);
    expect(logInteraction).not.toHaveBeenCalled();
    act(() => {
      useAuthStore.setState({ session: 'sess' });
    });
    expect(logInteraction).toHaveBeenCalledWith('screen_view');
  });

  it('records the opened member profile', () => {
    vi.mocked(startInteractionLog).mockReturnValue(() => undefined);
    nav.pathname = '/members/acc-1';
    render(<InteractionLog />);
    expect(logInteraction).toHaveBeenCalledWith('profile_opened', { accountId: 'acc-1' });
  });
});
