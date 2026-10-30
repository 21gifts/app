import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SocialRecoveryPromptOverlay } from '@/components/SocialRecoveryPromptOverlay';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  push.mockClear();
});

describe('SocialRecoveryPromptOverlay', () => {
  it('shows the grant prompt as a modal dialog with the introduce anatomy', () => {
    renderWithLocale(<SocialRecoveryPromptOverlay onDismiss={vi.fn()} />);
    const dialog = screen.getByRole('dialog', { name: 'Social Recovery for your grant' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.className).toContain('fixed inset-0 z-50');
    expect(dialog.className).toContain('bg-app-overlay');
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(
      'Social Recovery for your grant',
    );
    expect(
      screen.getByText(
        'Grant payouts need Social Recovery. Choose two people who can help you restore your account if you lose your passkey.',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Secure my account' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Secure my account' })).toBeNull();
  });

  it('closes with the icon-only Close and stays on the page', () => {
    const onDismiss = vi.fn();
    renderWithLocale(<SocialRecoveryPromptOverlay onDismiss={onDismiss} />);
    const close = screen.getByRole('button', { name: 'Close' });
    expect(screen.queryByText('Close')).toBeNull();
    fireEvent.click(close);
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
  });

  it('closes and opens Secure my account client-side', () => {
    const onDismiss = vi.fn();
    renderWithLocale(<SocialRecoveryPromptOverlay onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: 'Secure my account' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith('/settings/social-recovery');
  });
});
