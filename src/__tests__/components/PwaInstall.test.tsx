import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PwaInstall } from '@/components/PwaInstall';
import { isInAppBrowser } from '@/lib/in-app-browser';
import { shouldOfferIosInstall } from '@/lib/pwa-install';
import { isStandaloneDisplay } from '@/lib/push';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/lib/push', () => ({
  isStandaloneDisplay: vi.fn().mockReturnValue(false),
}));

vi.mock('@/lib/in-app-browser', () => ({
  isInAppBrowser: vi.fn().mockReturnValue(false),
}));

vi.mock('@/lib/pwa-install', () => ({
  shouldOfferIosInstall: vi.fn().mockReturnValue(false),
}));

beforeEach(() => {
  vi.mocked(shouldOfferIosInstall).mockReturnValue(false);
  vi.mocked(isStandaloneDisplay).mockReturnValue(false);
  vi.mocked(isInAppBrowser).mockReturnValue(false);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('PwaInstall', () => {
  it('renders nothing by default on desktop without an install event', async () => {
    renderWithLocale(<PwaInstall placement="header" />);
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Install app' })).toBeNull();
    });
  });

  it('shows the iOS sheet steps and closes on Close', async () => {
    vi.mocked(shouldOfferIosInstall).mockReturnValue(true);
    vi.mocked(isStandaloneDisplay).mockReturnValue(false);
    vi.mocked(isInAppBrowser).mockReturnValue(false);
    renderWithLocale(<PwaInstall placement="header" />);
    expect(await screen.findByRole('button', { name: 'Install app' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Install app' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Tap Share (square with the arrow).')).toBeTruthy();
    expect(screen.getByText('Tap Add to Home Screen.')).toBeTruthy();
    expect(screen.getByText('If you see Open as Web App, leave it on, then tap Add.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders nothing when already standalone', async () => {
    vi.mocked(shouldOfferIosInstall).mockReturnValue(true);
    vi.mocked(isStandaloneDisplay).mockReturnValue(true);
    vi.mocked(isInAppBrowser).mockReturnValue(false);
    renderWithLocale(<PwaInstall placement="hero" />);
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Install app' })).toBeNull();
    });
  });

  it('shows a control after beforeinstallprompt and calls prompt on click', async () => {
    const promptFn = vi.fn().mockResolvedValue(undefined);
    renderWithLocale(<PwaInstall placement="header" />);
    await act(async () => {
      const event = new Event('beforeinstallprompt', { cancelable: true });
      Object.defineProperty(event, 'prompt', { value: promptFn });
      window.dispatchEvent(event);
    });
    expect(await screen.findByRole('button', { name: 'Install app' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Install app' }));
    expect(promptFn).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Install app' })).toBeNull();
    });
  });

  it('calls onMenuAction when opening the iOS sheet from the menu and keeps the dialog mounted', async () => {
    vi.mocked(shouldOfferIosInstall).mockReturnValue(true);
    vi.mocked(isStandaloneDisplay).mockReturnValue(false);
    vi.mocked(isInAppBrowser).mockReturnValue(false);
    const onMenuAction = vi.fn();
    renderWithLocale(<PwaInstall placement="menu" onMenuAction={onMenuAction} />);
    expect(await screen.findByRole('button', { name: 'Install app' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Install app' }));
    expect(onMenuAction).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('renders the hero control with the default app tone', async () => {
    vi.mocked(shouldOfferIosInstall).mockReturnValue(true);
    vi.mocked(isStandaloneDisplay).mockReturnValue(false);
    vi.mocked(isInAppBrowser).mockReturnValue(false);
    renderWithLocale(<PwaInstall placement="hero" />);
    expect(await screen.findByRole('button', { name: 'Install app' })).toBeTruthy();
  });

  it('opens the dark hero iOS sheet, ignores overlay mousedown, and closes on Escape', async () => {
    vi.mocked(shouldOfferIosInstall).mockReturnValue(true);
    vi.mocked(isStandaloneDisplay).mockReturnValue(false);
    vi.mocked(isInAppBrowser).mockReturnValue(false);
    renderWithLocale(<PwaInstall tone="dark" placement="hero" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Install app' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeTruthy();
    const overlay = dialog.parentElement;
    expect(overlay).not.toBeNull();
    fireEvent.mouseDown(overlay as HTMLElement);
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('calls onMenuAction after a Chromium prompt from the menu and clears on appinstalled', async () => {
    const promptFn = vi.fn().mockResolvedValue(undefined);
    const onMenuAction = vi.fn();
    renderWithLocale(<PwaInstall placement="menu" onMenuAction={onMenuAction} />);
    await act(async () => {
      const event = new Event('beforeinstallprompt', { cancelable: true });
      Object.defineProperty(event, 'prompt', { value: promptFn });
      window.dispatchEvent(event);
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Install app' }));
    expect(promptFn).toHaveBeenCalledTimes(1);
    expect(onMenuAction).toHaveBeenCalledTimes(1);
    await act(async () => {
      window.dispatchEvent(new Event('appinstalled'));
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Install app' })).toBeNull();
    });
  });
});
