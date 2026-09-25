import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FiatPreferenceSwitcher } from '@/components/FiatPreferenceSwitcher';
import { setAccountFiat } from '@/lib/api';
import type { Account } from '@/lib/api-types';
import { bumpFiatGeneration, fiatGeneration } from '@/lib/preference-generation';
import { clearSession, saveSession } from '@/lib/session-storage';
import { FIAT_COOKIE } from '@/lib/stats-money';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/lib/api', () => ({ setAccountFiat: vi.fn() }));

function account(id: string, fiat: 'USD' | 'CHF'): Account {
  return {
    id,
    linkingKey: 'k',
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
    setup: 'name',
    missing: ['name'],
    fiat,
  } as Account;
}

afterEach(() => {
  cleanup();
  clearSession();
  document.cookie = `${FIAT_COOKIE}=; Path=/; Max-Age=0`;
});

describe('FiatPreferenceSwitcher', () => {
  it('does nothing when the pressed fiat is already selected', () => {
    vi.mocked(setAccountFiat).mockReset();
    saveSession('tok');
    renderWithLocale(<FiatPreferenceSwitcher />, 'en', 'ch', 'USD');
    fireEvent.click(screen.getByRole('button', { name: 'USD' }));
    expect(setAccountFiat).not.toHaveBeenCalled();
    expect(document.cookie).not.toContain(`${FIAT_COOKIE}=USD`);
  });

  it('offers CHF EUR USD PHP and writes the pressed code', () => {
    renderWithLocale(<FiatPreferenceSwitcher />, 'en', 'ch', 'USD');
    expect(screen.getByRole('group', { name: 'Fiat currency' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'USD' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'CHF' }));
    expect(screen.getByRole('button', { name: 'CHF' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('uses the profile settings section chrome, not a chrome pill', () => {
    const { container } = renderWithLocale(<FiatPreferenceSwitcher />, 'en', 'ch', 'USD');
    const section = container.firstElementChild;
    expect(section?.className).toContain('border-t');
    expect(section?.className).toContain('border-app-border');
    expect(screen.getByText('Fiat currency').className).toContain('uppercase');
    expect(screen.getByRole('group', { name: 'Fiat currency' }).className).toContain(
      'rounded-full',
    );
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('selected option uses app-btn, not orange', () => {
    renderWithLocale(<FiatPreferenceSwitcher />, 'en', 'ch', 'USD');
    const usd = screen.getByRole('button', { name: 'USD' });
    expect(usd.className).toContain('bg-app-btn');
    expect(usd.className).not.toContain('bg-app-accent');
    expect(usd.className).not.toContain('bg-accent');
  });

  it('waits for the signed-in account fiat update before pressing and persisting CHF', async () => {
    vi.mocked(setAccountFiat).mockReset();
    const original = account('fiat_preference_original', 'USD');
    const updated = account('fiat_preference_original', 'CHF');
    useAuthStore.setState({ account: original });
    saveSession('tok');
    let resolveRequest!: (value: Account) => void;
    const request = new Promise<Account>((resolve) => {
      resolveRequest = resolve;
    });
    vi.mocked(setAccountFiat).mockReturnValue(request);
    const generation = fiatGeneration();

    renderWithLocale(<FiatPreferenceSwitcher />, 'en', 'ch', 'USD');
    fireEvent.click(screen.getByRole('button', { name: 'CHF' }));

    expect(setAccountFiat).toHaveBeenCalledWith('tok', 'CHF', false);
    expect(fiatGeneration()).toBe(generation + 1);
    expect(screen.getByRole('button', { name: 'CHF' }).getAttribute('aria-pressed')).toBe('false');
    expect(document.cookie).not.toContain(`${FIAT_COOKIE}=CHF`);

    await act(async () => {
      resolveRequest(updated);
      await request;
    });

    expect(document.cookie).toContain(`${FIAT_COOKIE}=CHF`);
    expect(screen.getByRole('button', { name: 'CHF' }).getAttribute('aria-pressed')).toBe('true');
    expect(useAuthStore.getState().account?.fiat).toBe('CHF');
    expect(useAuthStore.getState().account?.id).toBe(original.id);
  });

  it('keeps signed-in fiat state unchanged when the account update rejects', async () => {
    vi.mocked(setAccountFiat).mockReset();
    const original = account('fiat_preference_reject', 'USD');
    useAuthStore.setState({ account: original });
    saveSession('tok');
    vi.mocked(setAccountFiat).mockRejectedValue(new Error('failed'));

    renderWithLocale(<FiatPreferenceSwitcher />, 'en', 'ch', 'USD');
    fireEvent.click(screen.getByRole('button', { name: 'CHF' }));

    await waitFor(() => {
      expect(setAccountFiat).toHaveBeenCalledWith('tok', 'CHF', false);
    });
    expect(document.cookie).not.toContain(`${FIAT_COOKIE}=CHF`);
    expect(screen.getByRole('button', { name: 'CHF' }).getAttribute('aria-pressed')).toBe('false');
    expect(useAuthStore.getState().account).toBe(original);
  });

  it('discards a signed-in fiat response after a newer fiat generation', async () => {
    vi.mocked(setAccountFiat).mockReset();
    const original = account('fiat_preference_stale', 'USD');
    const updated = account('fiat_preference_stale_updated', 'CHF');
    useAuthStore.setState({ account: original });
    saveSession('tok');
    const request = Promise.resolve(updated);
    vi.mocked(setAccountFiat).mockImplementation(() => {
      bumpFiatGeneration();
      return request;
    });

    renderWithLocale(<FiatPreferenceSwitcher />, 'en', 'ch', 'USD');
    fireEvent.click(screen.getByRole('button', { name: 'CHF' }));
    await act(async () => {
      await request;
    });

    expect(document.cookie).not.toContain(`${FIAT_COOKIE}=CHF`);
    expect(screen.getByRole('button', { name: 'CHF' }).getAttribute('aria-pressed')).toBe('false');
    expect(useAuthStore.getState().account).toBe(original);
  });

  it('does not apply a fiat response for a different account', async () => {
    vi.mocked(setAccountFiat).mockReset();
    const original = account('fiat_preference_keep', 'USD');
    useAuthStore.setState({ account: original });
    saveSession('tok');
    vi.mocked(setAccountFiat).mockResolvedValue(account('fiat_preference_other', 'CHF'));

    renderWithLocale(<FiatPreferenceSwitcher />, 'en', 'ch', 'USD');
    fireEvent.click(screen.getByRole('button', { name: 'CHF' }));

    await waitFor(() => {
      expect(setAccountFiat).toHaveBeenCalledWith('tok', 'CHF', false);
    });
    expect(useAuthStore.getState().account).toBe(original);
    expect(document.cookie).not.toContain(`${FIAT_COOKIE}=CHF`);
  });
});
