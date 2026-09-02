import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RequirementsOverlay } from '@/components/RequirementsOverlay';
import { agreeToRules } from '@/lib/api';
import type { Account } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/lib/api', () => ({
  agreeToRules: vi.fn(),
  setName: vi.fn(),
  skipSetup: vi.fn(),
}));

const account: Account = {
  id: 'acc_1',
  linkingKey: null,
  role: 'basis',
  name: null,
  lightningAddress: 'alice@walletofsatoshi.com',
  lightningAddressVerified: false,
  forumLawsDismissed: false,
  createdAt: 1,
  rulesAgreedAt: null,
  viewKey: 'a'.repeat(64),
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
    expect(screen.getByRole('dialog', { name: 'Add your name' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull();
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
