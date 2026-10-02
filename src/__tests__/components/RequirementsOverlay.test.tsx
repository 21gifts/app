import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RequirementsOverlay } from '@/components/RequirementsOverlay';
import type { Account } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/lib/api', () => ({
  agreeToRules: vi.fn(),
  setName: vi.fn(),
  setUsername: vi.fn(),
  skipSetup: vi.fn(),
}));

import { agreeToRules, setName, setUsername } from '@/lib/api';

const account: Account = {
  id: 'acc_1',
  linkingKey: null,
  role: 'basis',
  name: null,
  location: null,
  lightningAddress: null,
  lightningAddressVerified: false,
  forumLawsDismissed: false,
  createdAt: 1,
  rulesAgreedAt: null,
  viewKey: 'a'.repeat(64),
  aboutMe: null,
  aboutMeHasPhoto: false,
  setup: null,
  missing: ['name', 'rules'],
};

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ session: 'sess', account });
});

afterEach(cleanup);

describe('RequirementsOverlay', () => {
  it('shows the name form without a Skip control', () => {
    renderWithLocale(
      <RequirementsOverlay requirement="name" onDismiss={vi.fn()} onSatisfied={vi.fn()} />,
    );
    const dialog = screen.getByRole('dialog', { name: 'Add your name' });
    expect(dialog.className).toContain('bg-app-overlay');
    expect(dialog.className).not.toContain('bg-black/40');
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull();
  });

  it('shows the username form without a Skip control', () => {
    renderWithLocale(
      <RequirementsOverlay requirement="username" onDismiss={vi.fn()} onSatisfied={vi.fn()} />,
    );
    expect(screen.getByRole('dialog', { name: 'Add your 21.gifts name' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull();
    expect(setUsername).not.toHaveBeenCalled();
  });

  it('explains the wallet step without a form, with only the Close control', () => {
    const onDismiss = vi.fn();
    const onSatisfied = vi.fn();
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, missing: ['lightning-address'] },
    });
    renderWithLocale(
      <RequirementsOverlay requirement="wallet" onDismiss={onDismiss} onSatisfied={onSatisfied} />,
    );
    const dialog = screen.getByRole('dialog', { name: 'Your wallet is not set up' });
    expect(screen.getByRole('heading', { name: 'Your wallet is not set up' })).toBeTruthy();
    expect(dialog.querySelector('p')?.textContent).toBe(
      'Gifts for your posts go to your own 21.gifts wallet, and it is not set up yet. Once it is set up, you can post.',
    );
    expect(dialog.querySelector('form')).toBeNull();
    expect(dialog.querySelector('input')).toBeNull();
    expect(
      screen.getAllByRole('button').map((button) => button.getAttribute('aria-label')),
    ).toEqual(['Close']);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onSatisfied).not.toHaveBeenCalled();
    expect(agreeToRules).not.toHaveBeenCalled();
    expect(setName).not.toHaveBeenCalled();
    expect(setUsername).not.toHaveBeenCalled();
  });

  it('agrees to rules and calls onSatisfied', async () => {
    const onSatisfied = vi.fn();
    vi.mocked(agreeToRules).mockResolvedValue({
      ...account,
      rulesAgreedAt: 2,
      setup: null,
      missing: ['name'],
    });
    renderWithLocale(
      <RequirementsOverlay requirement="rules" onDismiss={vi.fn()} onSatisfied={onSatisfied} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'I agree to these rules' }));
    await waitFor(() => {
      expect(onSatisfied).toHaveBeenCalled();
    });
    expect(useAuthStore.getState().account?.rulesAgreedAt).toBe(2);
  });

  it('dismisses without saving', () => {
    const onDismiss = vi.fn();
    renderWithLocale(
      <RequirementsOverlay requirement="rules" onDismiss={onDismiss} onSatisfied={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onDismiss).toHaveBeenCalled();
    expect(agreeToRules).not.toHaveBeenCalled();
  });

  it('does not agree when there is no session', () => {
    useAuthStore.setState({ session: null, account });
    renderWithLocale(
      <RequirementsOverlay requirement="rules" onDismiss={vi.fn()} onSatisfied={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'I agree to these rules' }));
    expect(agreeToRules).not.toHaveBeenCalled();
  });

  it('shows an error when agreeing fails', async () => {
    vi.mocked(agreeToRules).mockRejectedValue(new Error('fail'));
    renderWithLocale(
      <RequirementsOverlay requirement="rules" onDismiss={vi.fn()} onSatisfied={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'I agree to these rules' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe('Could not save your agreement');
  });

  it('ignores a second agree click while busy', async () => {
    const onSatisfied = vi.fn();
    let resolveAgree: ((value: Account) => void) | undefined;
    vi.mocked(agreeToRules).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAgree = resolve;
        }),
    );
    renderWithLocale(
      <RequirementsOverlay requirement="rules" onDismiss={vi.fn()} onSatisfied={onSatisfied} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'I agree to these rules' }));
    fireEvent.click(screen.getByRole('button', { name: 'I agree to these rules' }));
    expect(agreeToRules).toHaveBeenCalledTimes(1);
    resolveAgree?.({ ...account, rulesAgreedAt: 2, missing: ['name'] });
    await waitFor(() => {
      expect(onSatisfied).toHaveBeenCalled();
    });
  });

  it('does not update account when the session changes during agree', async () => {
    const onSatisfied = vi.fn();
    let resolveAgree: ((value: Account) => void) | undefined;
    vi.mocked(agreeToRules).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAgree = resolve;
        }),
    );
    renderWithLocale(
      <RequirementsOverlay requirement="rules" onDismiss={vi.fn()} onSatisfied={onSatisfied} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'I agree to these rules' }));
    useAuthStore.setState({ session: 'other', account });
    resolveAgree?.({ ...account, rulesAgreedAt: 2, missing: ['name'] });
    await waitFor(() => {
      expect(agreeToRules).toHaveBeenCalled();
    });
    expect(onSatisfied).not.toHaveBeenCalled();
    expect(useAuthStore.getState().account?.rulesAgreedAt).toBeNull();
  });

  it('does not update when the account is cleared during agree', async () => {
    const onSatisfied = vi.fn();
    let resolveAgree: ((value: Account) => void) | undefined;
    vi.mocked(agreeToRules).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAgree = resolve;
        }),
    );
    renderWithLocale(
      <RequirementsOverlay requirement="rules" onDismiss={vi.fn()} onSatisfied={onSatisfied} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'I agree to these rules' }));
    useAuthStore.setState({ session: 'sess', account: null });
    resolveAgree?.({ ...account, rulesAgreedAt: 2, missing: ['name'] });
    await waitFor(() => {
      expect(agreeToRules).toHaveBeenCalled();
    });
    expect(onSatisfied).not.toHaveBeenCalled();
  });
});
