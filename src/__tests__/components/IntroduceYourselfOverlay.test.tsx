import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IntroduceYourselfOverlay } from '@/components/IntroduceYourselfOverlay';
import {
  FORUM_COMPOSE_EVENT,
  consumePendingForumCompose,
  consumeSkipIntroduceOverlay,
} from '@/lib/forum-feed';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const push = vi.fn();
const navigation = vi.hoisted(() => ({ pathname: '/welcome' }));

vi.mock('next/navigation', () => ({
  useRouter: (): { push: typeof push } => ({ push }),
  usePathname: (): string => navigation.pathname,
}));

beforeEach(() => {
  navigation.pathname = '/welcome';
  push.mockClear();
});

afterEach(() => {
  cleanup();
  consumePendingForumCompose();
  consumeSkipIntroduceOverlay();
});

describe('IntroduceYourselfOverlay', () => {
  it('renders the title and CTA', () => {
    renderWithLocale(<IntroduceYourselfOverlay onDismiss={vi.fn()} />);
    const dialog = screen.getByRole('dialog', { name: 'Introduce yourself' });
    expect(dialog).toBeTruthy();
    expect(dialog.className).toContain('bg-app-overlay');
    expect(dialog.className).not.toContain('bg-black/40');
    expect(screen.getByRole('heading', { name: 'Introduce yourself' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Write an introduction' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Write an introduction' })).toBeNull();
  });

  it('dismisses and requests compose without navigating when already on /welcome', () => {
    const onDismiss = vi.fn();
    const listener = vi.fn();
    window.addEventListener(FORUM_COMPOSE_EVENT, listener);
    renderWithLocale(<IntroduceYourselfOverlay onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: 'Write an introduction' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
    window.removeEventListener(FORUM_COMPOSE_EVENT, listener);
  });

  it('dismisses, requests compose, and pushes /welcome from another path', () => {
    navigation.pathname = '/profile';
    const onDismiss = vi.fn();
    const listener = vi.fn();
    window.addEventListener(FORUM_COMPOSE_EVENT, listener);
    renderWithLocale(<IntroduceYourselfOverlay onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: 'Write an introduction' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith('/welcome');
    window.removeEventListener(FORUM_COMPOSE_EVENT, listener);
  });

  it('calls onDismiss when Close is clicked', () => {
    const onDismiss = vi.fn();
    const listener = vi.fn();
    window.addEventListener(FORUM_COMPOSE_EVENT, listener);
    renderWithLocale(<IntroduceYourselfOverlay onDismiss={onDismiss} />);
    const close = screen.getByRole('button', { name: 'Close' });
    expect(screen.queryByText('Close')).toBeNull();
    fireEvent.click(close);
    expect(onDismiss).toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    window.removeEventListener(FORUM_COMPOSE_EVENT, listener);
  });
});
