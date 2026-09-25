import { cleanup, act, screen, waitFor } from '@testing-library/react';
import { StrictMode, useEffect, type ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountPreferenceSync } from '@/components/AccountPreferenceSync';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { renderWithLocale } from '@/__tests__/render-with-locale';
import { setAccountFiat, setAccountLocale } from '@/lib/api';
import type { Account } from '@/lib/api-types';
import { bumpFiatGeneration, bumpLocaleGeneration } from '@/lib/preference-generation';
import { useAuthStore } from '@/stores/auth-store';

const flag = vi.hoisted(() => ({ ready: true }));
const refresh = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/useHydrateSession', () => ({
  useHydrateSession: () => ({ ready: flag.ready }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock('@/lib/api', () => ({
  setAccountLocale: vi.fn(),
  setAccountFiat: vi.fn(),
}));

const mockSetAccountLocale = vi.mocked(setAccountLocale);
const mockSetAccountFiat = vi.mocked(setAccountFiat);

function account(
  id: string,
  preferences: { locale?: Account['locale']; fiat?: Account['fiat'] } = {},
): Account {
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
    ...preferences,
  } as Account;
}

function Probe(): ReactElement {
  const { fiat } = useFiatPreference();

  return <span data-testid="fiat">{fiat}</span>;
}

function LocaleGenerationBumper(): null {
  useEffect(() => {
    bumpLocaleGeneration();
  }, []);

  return null;
}

function FiatGenerationBumper(): null {
  useEffect(() => {
    bumpFiatGeneration();
  }, []);

  return null;
}

function LogoutOnEffect(): null {
  useEffect(() => {
    useAuthStore.getState().clearAuth();
  }, []);

  return null;
}

function FiatCookieWriter(props: { value: string }): null {
  const { value } = props;
  useEffect(() => {
    document.cookie = `fiat=${value}; Path=/`;
  }, [value]);

  return null;
}

function renderSync(
  currentAccount: Account | null,
  session: string | null = 's',
  afterSync: ReactElement | null = null,
): ReturnType<typeof renderWithLocale> {
  useAuthStore.setState({
    session,
    account: currentAccount,
    wrongAccount: false,
  });

  return renderWithLocale(
    <>
      <AccountPreferenceSync />
      {afterSync}
      <Probe />
    </>,
    'en',
    undefined,
    'USD',
  );
}

async function flushEffect(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

function cookie(name: string): string | undefined {
  const prefix = `${name}=`;
  return document.cookie
    .split('; ')
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length);
}

afterEach(() => {
  useAuthStore.setState({ session: null, account: null, wrongAccount: false });
  document.cookie = 'locale=; Path=/; Max-Age=0';
  document.cookie = 'fiat=; Path=/; Max-Age=0';
  mockSetAccountLocale.mockReset();
  mockSetAccountFiat.mockReset();
  refresh.mockReset();
  flag.ready = true;
  cleanup();
});

describe('AccountPreferenceSync', () => {
  it('does nothing while session hydration is not ready', async () => {
    flag.ready = false;
    renderSync(account('acc_1', { locale: null, fiat: null }));

    await flushEffect();

    expect(mockSetAccountLocale).not.toHaveBeenCalled();
    expect(mockSetAccountFiat).not.toHaveBeenCalled();
  });

  it('does nothing without a session', async () => {
    renderSync(account('acc_2', { locale: null, fiat: null }), null);

    await flushEffect();

    expect(mockSetAccountLocale).not.toHaveBeenCalled();
    expect(mockSetAccountFiat).not.toHaveBeenCalled();
  });

  it('does nothing without an account', async () => {
    renderSync(null);

    await flushEffect();

    expect(mockSetAccountLocale).not.toHaveBeenCalled();
    expect(mockSetAccountFiat).not.toHaveBeenCalled();
  });

  it('does not post preferences when both account keys are absent', async () => {
    renderSync(account('acc_3'));

    await flushEffect();

    expect(mockSetAccountLocale).not.toHaveBeenCalled();
    expect(mockSetAccountFiat).not.toHaveBeenCalled();
  });

  it('hydrates a missing locale, stores it, writes its cookie, and refreshes', async () => {
    const updated = account('acc_4', { locale: 'de' });
    const cookieSetter = vi.spyOn(Document.prototype, 'cookie', 'set');
    mockSetAccountLocale.mockResolvedValue(updated);

    try {
      renderSync(account('acc_4', { locale: null }));

      await waitFor(() => {
        expect(mockSetAccountLocale).toHaveBeenCalledWith('s', 'en', true);
        expect(useAuthStore.getState().account?.locale).toBe('de');
        expect(cookie('locale')).toBe('de');
        expect(refresh).toHaveBeenCalledTimes(1);
      });

      expect(cookieSetter).toHaveBeenCalledWith(
        'locale=de; Path=/; Max-Age=31536000; SameSite=Lax',
      );
      expect(mockSetAccountLocale).toHaveBeenCalledTimes(1);
      expect(mockSetAccountFiat).not.toHaveBeenCalled();
    } finally {
      cookieSetter.mockRestore();
    }
  });

  it('does not refresh when the returned locale already matches the cookie', async () => {
    const updated = account('acc_5', { locale: 'de' });
    document.cookie = 'locale=de; Path=/';
    mockSetAccountLocale.mockResolvedValue(updated);

    renderSync(account('acc_5', { locale: null }));

    await waitFor(() => {
      expect(mockSetAccountLocale).toHaveBeenCalledTimes(1);
      expect(useAuthStore.getState().account?.locale).toBe('de');
    });

    expect(refresh).not.toHaveBeenCalled();
  });

  it('stores a response whose locale is null without writing a cookie', async () => {
    const updated = account('acc_6', { locale: null });
    mockSetAccountLocale.mockResolvedValue(updated);

    renderSync(account('acc_6', { locale: null }));

    await waitFor(() => {
      expect(mockSetAccountLocale).toHaveBeenCalledTimes(1);
    });
    expect(useAuthStore.getState().account?.locale).toBeNull();

    expect(cookie('locale')).toBeUndefined();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('adds Secure to the locale cookie on https', async () => {
    const updated = account('acc_7', { locale: 'de' });
    const cookieSetter = vi.spyOn(Document.prototype, 'cookie', 'set');
    mockSetAccountLocale.mockResolvedValue(updated);
    vi.stubGlobal('location', { protocol: 'https:' });

    try {
      renderSync(account('acc_7', { locale: null }));

      await waitFor(() => {
        expect(refresh).toHaveBeenCalledTimes(1);
      });

      expect(cookieSetter).toHaveBeenCalledWith(
        'locale=de; Path=/; Max-Age=31536000; SameSite=Lax; Secure',
      );
    } finally {
      cookieSetter.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it('copies a stored account locale into an empty cookie and refreshes', async () => {
    renderSync(account('acc_8', { locale: 'de' }));

    await waitFor(() => {
      expect(cookie('locale')).toBe('de');
      expect(refresh).toHaveBeenCalledTimes(1);
    });

    expect(mockSetAccountLocale).not.toHaveBeenCalled();
    expect(mockSetAccountFiat).not.toHaveBeenCalled();
  });

  it('leaves a matching stored locale cookie alone', async () => {
    document.cookie = 'locale=de; Path=/';
    renderSync(account('acc_9', { locale: 'de' }));

    await flushEffect();

    expect(mockSetAccountLocale).not.toHaveBeenCalled();
    expect(mockSetAccountFiat).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('does not copy a stored locale after its generation changes', async () => {
    renderSync(account('acc_10', { locale: 'de' }), 's', <LocaleGenerationBumper />);

    await flushEffect();

    expect(cookie('locale')).toBeUndefined();
    expect(refresh).not.toHaveBeenCalled();
    expect(mockSetAccountLocale).not.toHaveBeenCalled();
  });

  it('does not fill an empty locale after its generation changes', async () => {
    renderSync(account('acc_empty_locale', { locale: null }), 's', <LocaleGenerationBumper />);

    await flushEffect();

    expect(mockSetAccountLocale).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('does not fill an empty fiat after its generation changes', async () => {
    renderSync(
      account('acc_empty_fiat', { locale: 'en', fiat: null }),
      's',
      <FiatGenerationBumper />,
    );

    await flushEffect();

    expect(mockSetAccountFiat).not.toHaveBeenCalled();
  });

  it('syncs the same account again after logout', async () => {
    renderSync(account('acc_logout', { locale: 'de' }));
    await waitFor(() => {
      expect(cookie('locale')).toBe('de');
    });

    act(() => {
      useAuthStore.setState({ session: null, account: null, wrongAccount: false });
    });
    document.cookie = 'locale=; Path=/; Max-Age=0';
    refresh.mockClear();

    act(() => {
      useAuthStore.setState({
        session: 's',
        account: account('acc_logout', { locale: 'es' }),
        wrongAccount: false,
      });
    });

    await waitFor(() => {
      expect(cookie('locale')).toBe('es');
    });
  });

  it('ignores a stale locale response and stores the later fiat response', async () => {
    const localeResponse = account('acc_11', { locale: 'fil', fiat: null });
    const fiatResponse = account('acc_11', { locale: null, fiat: 'USD' });
    mockSetAccountLocale.mockImplementation(async () => {
      bumpLocaleGeneration();
      return localeResponse;
    });
    mockSetAccountFiat.mockResolvedValue(fiatResponse);

    renderSync(account('acc_11', { locale: null, fiat: null }));

    await waitFor(() => {
      expect(mockSetAccountFiat).toHaveBeenCalledWith('s', 'USD', true);
      expect(useAuthStore.getState().account?.fiat).toBe('USD');
      expect(useAuthStore.getState().account?.locale).toBeNull();
    });

    expect(cookie('locale')).toBeUndefined();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('hydrates fiat from the effective account locale', async () => {
    const updated = account('acc_12', { locale: 'de', fiat: 'CHF' });
    document.cookie = 'locale=de; Path=/';
    mockSetAccountFiat.mockResolvedValue(updated);

    renderSync(account('acc_12', { locale: 'de', fiat: null }));

    await waitFor(() => {
      expect(mockSetAccountFiat).toHaveBeenCalledWith('s', 'CHF', true);
      expect(screen.getByTestId('fiat').textContent).toBe('CHF');
      expect(cookie('fiat')).toBe('CHF');
    });

    expect(refresh).not.toHaveBeenCalled();
  });

  it('uses a supported fiat cookie instead of the locale default', async () => {
    const updated = account('acc_13', { locale: 'en', fiat: 'EUR' });
    document.cookie = 'locale=en; Path=/';
    mockSetAccountFiat.mockResolvedValue(updated);

    renderSync(
      account('acc_13', { locale: 'en', fiat: null }),
      's',
      <FiatCookieWriter value="EUR" />,
    );

    await waitFor(() => {
      expect(mockSetAccountFiat).toHaveBeenCalledWith('s', 'EUR', true);
    });
  });

  it('falls back from an unsupported fiat cookie to the locale default', async () => {
    const updated = account('acc_14', { locale: 'en', fiat: 'USD' });
    document.cookie = 'locale=en; Path=/';
    mockSetAccountFiat.mockResolvedValue(updated);

    renderSync(
      account('acc_14', { locale: 'en', fiat: null }),
      's',
      <FiatCookieWriter value="nope" />,
    );

    await waitFor(() => {
      expect(mockSetAccountFiat).toHaveBeenCalledWith('s', 'USD', true);
    });
  });

  it('ignores a stale fiat response', async () => {
    const initial = account('acc_15', { locale: 'en', fiat: null });
    const updated = account('acc_15', { locale: 'en', fiat: 'CHF' });
    document.cookie = 'locale=en; Path=/';
    mockSetAccountFiat.mockImplementation(async () => {
      bumpFiatGeneration();
      return updated;
    });

    renderSync(initial);

    await waitFor(() => {
      expect(mockSetAccountFiat).toHaveBeenCalledTimes(1);
    });
    await flushEffect();

    expect(useAuthStore.getState().account).toBe(initial);
    expect(cookie('fiat')).not.toBe('CHF');
    expect(screen.getByTestId('fiat').textContent).toBe('USD');
  });

  it('stores an equal fiat response without changing the fiat context', async () => {
    const updated = account('acc_16', { fiat: 'USD' });
    mockSetAccountFiat.mockResolvedValue(updated);

    renderSync(account('acc_16', { fiat: null }));

    await waitFor(() => {
      expect(useAuthStore.getState().account?.fiat).toBe('USD');
    });

    expect(screen.getByTestId('fiat').textContent).toBe('USD');
    expect(cookie('fiat')).toBe('USD');
  });

  it('stores a null fiat response without changing the fiat context', async () => {
    const updated = account('acc_17', { fiat: null });
    mockSetAccountFiat.mockResolvedValue(updated);

    renderSync(account('acc_17', { fiat: null }));

    await waitFor(() => {
      expect(mockSetAccountFiat).toHaveBeenCalledTimes(1);
    });

    expect(useAuthStore.getState().account?.fiat).toBeNull();
    expect(screen.getByTestId('fiat').textContent).toBe('USD');
    expect(cookie('fiat')).toBeUndefined();
  });

  it('copies a stored account fiat into context and its cookie', async () => {
    renderSync(account('acc_18', { fiat: 'PHP' }));

    await waitFor(() => {
      expect(screen.getByTestId('fiat').textContent).toBe('PHP');
      expect(cookie('fiat')).toBe('PHP');
    });

    expect(mockSetAccountLocale).not.toHaveBeenCalled();
    expect(mockSetAccountFiat).not.toHaveBeenCalled();
  });

  it('leaves context alone when the stored account fiat already has a cookie', async () => {
    renderSync(account('acc_19', { fiat: 'PHP' }), 's', <FiatCookieWriter value="PHP" />);

    await flushEffect();

    expect(mockSetAccountLocale).not.toHaveBeenCalled();
    expect(mockSetAccountFiat).not.toHaveBeenCalled();
    expect(screen.getByTestId('fiat').textContent).toBe('PHP');
  });

  it('swallows locale hydration failures', async () => {
    mockSetAccountLocale.mockRejectedValue(new Error('locale failed'));
    renderSync(account('acc_20', { locale: null }));

    await waitFor(() => {
      expect(mockSetAccountLocale).toHaveBeenCalledTimes(1);
    });
    await flushEffect();

    expect(cookie('locale')).toBeUndefined();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('swallows fiat hydration failures', async () => {
    mockSetAccountFiat.mockRejectedValue(new Error('fiat failed'));
    renderSync(account('acc_21', { fiat: null }));

    await waitFor(() => {
      expect(mockSetAccountFiat).toHaveBeenCalledTimes(1);
    });
    await flushEffect();

    expect(cookie('fiat')).toBeUndefined();
    expect(screen.getByTestId('fiat').textContent).toBe('USD');
  });

  it('syncs an account id only once across StrictMode and later renders', async () => {
    const initial = account('acc_22', { locale: null });
    const updated = account('acc_22', { locale: 'de' });
    mockSetAccountLocale.mockResolvedValue(updated);
    useAuthStore.setState({
      session: 's',
      account: initial,
      wrongAccount: false,
    });

    renderWithLocale(
      <StrictMode>
        <AccountPreferenceSync />
        <Probe />
      </StrictMode>,
      'en',
      undefined,
      'USD',
    );

    await waitFor(() => {
      expect(mockSetAccountLocale).toHaveBeenCalledTimes(1);
    });

    cleanup();
    useAuthStore.setState({ account: initial });
    renderSync(initial);
    await flushEffect();

    expect(mockSetAccountLocale).toHaveBeenCalledTimes(1);
  });

  it('does not fill an empty locale chosen before the account was ready', async () => {
    flag.ready = false;
    const view = renderSync(
      account('acc_early_locale', { locale: null }),
      's',
      <LocaleGenerationBumper />,
    );
    await flushEffect();
    expect(mockSetAccountLocale).not.toHaveBeenCalled();

    flag.ready = true;
    view.rerender(
      <>
        <AccountPreferenceSync />
        <LocaleGenerationBumper />
        <Probe />
      </>,
    );
    await flushEffect();

    expect(mockSetAccountLocale).not.toHaveBeenCalled();
  });

  it('does not fill an empty fiat chosen before the account was ready', async () => {
    flag.ready = false;
    const view = renderSync(
      account('acc_early_fiat', { locale: 'en', fiat: null }),
      's',
      <FiatGenerationBumper />,
    );
    await flushEffect();
    expect(mockSetAccountFiat).not.toHaveBeenCalled();

    flag.ready = true;
    view.rerender(
      <>
        <AccountPreferenceSync />
        <FiatGenerationBumper />
        <Probe />
      </>,
    );
    await flushEffect();

    expect(mockSetAccountFiat).not.toHaveBeenCalled();
  });

  it('fills an empty locale once the account is ready when nothing was chosen', async () => {
    flag.ready = false;
    const updated = account('acc_late', { locale: 'en' });
    mockSetAccountLocale.mockResolvedValue(updated);
    const view = renderSync(account('acc_late', { locale: null }));
    await flushEffect();
    expect(mockSetAccountLocale).not.toHaveBeenCalled();

    flag.ready = true;
    view.rerender(
      <>
        <AccountPreferenceSync />
        <Probe />
      </>,
    );

    await waitFor(() => {
      expect(mockSetAccountLocale).toHaveBeenCalledWith('s', 'en', true);
    });
  });

  it('keeps an explicit fiat when a late locale hydration returns', async () => {
    let releaseLocale: (value: Account) => void = () => {};
    mockSetAccountLocale.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseLocale = resolve;
        }),
    );

    renderSync(account('acc_cross', { locale: null, fiat: null }));
    await waitFor(() => {
      expect(mockSetAccountLocale).toHaveBeenCalledWith('s', 'en', true);
    });

    act(() => {
      bumpFiatGeneration();
      useAuthStore.getState().setAccount(account('acc_cross', { locale: null, fiat: 'PHP' }));
    });
    await act(async () => {
      releaseLocale(account('acc_cross', { locale: 'en', fiat: null }));
    });
    await flushEffect();

    expect(useAuthStore.getState().account?.locale).toBe('en');
    expect(useAuthStore.getState().account?.fiat).toBe('PHP');
    expect(mockSetAccountFiat).not.toHaveBeenCalled();
  });

  it('keeps an explicit locale when a late fiat hydration returns', async () => {
    let releaseFiat: (value: Account) => void = () => {};
    mockSetAccountFiat.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseFiat = resolve;
        }),
    );

    renderSync(account('acc_cross_fiat', { locale: 'de', fiat: null }));
    await waitFor(() => {
      expect(mockSetAccountFiat).toHaveBeenCalled();
    });

    act(() => {
      bumpLocaleGeneration();
      useAuthStore.getState().setAccount(account('acc_cross_fiat', { locale: 'es', fiat: null }));
    });
    await act(async () => {
      releaseFiat(account('acc_cross_fiat', { locale: 'de', fiat: 'CHF' }));
    });
    await flushEffect();

    expect(useAuthStore.getState().account?.locale).toBe('es');
    expect(useAuthStore.getState().account?.fiat).toBe('CHF');
  });

  it('drops a late preference when the signed-in account is gone', async () => {
    let releaseLocale: (value: Account) => void = () => {};
    mockSetAccountLocale.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseLocale = resolve;
        }),
    );

    renderSync(account('acc_gone', { locale: null, fiat: null }));
    await waitFor(() => {
      expect(mockSetAccountLocale).toHaveBeenCalled();
    });

    act(() => {
      bumpFiatGeneration();
      useAuthStore.setState({ session: 's', account: null, wrongAccount: false });
    });
    await act(async () => {
      releaseLocale(account('acc_gone', { locale: 'en', fiat: null }));
    });
    await flushEffect();

    expect(useAuthStore.getState().account).toBeNull();
  });

  it('drops a late preference when the account id changed', async () => {
    let releaseLocale: (value: Account) => void = () => {};
    mockSetAccountLocale.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseLocale = resolve;
        }),
    );

    renderSync(account('acc_old', { locale: null, fiat: null }));
    await waitFor(() => {
      expect(mockSetAccountLocale).toHaveBeenCalled();
    });

    const replacement = account('acc_new', { locale: 'es', fiat: 'EUR' });
    act(() => {
      bumpFiatGeneration();
      useAuthStore.getState().setAccount(replacement);
    });
    await act(async () => {
      releaseLocale(account('acc_old', { locale: 'en', fiat: null }));
    });
    await flushEffect();

    expect(useAuthStore.getState().account).toBe(replacement);
  });

  it('leaves the account untouched when the late field already matches', async () => {
    let releaseLocale: (value: Account) => void = () => {};
    mockSetAccountLocale.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseLocale = resolve;
        }),
    );

    renderSync(account('acc_same', { locale: null, fiat: null }));
    await waitFor(() => {
      expect(mockSetAccountLocale).toHaveBeenCalled();
    });

    const explicit = account('acc_same', { locale: 'en', fiat: 'PHP' });
    act(() => {
      bumpFiatGeneration();
      useAuthStore.getState().setAccount(explicit);
    });
    await act(async () => {
      releaseLocale(account('acc_same', { locale: 'en', fiat: null }));
    });
    await flushEffect();

    expect(useAuthStore.getState().account).toBe(explicit);
  });

  it('does not restore an account after logout while hydration is in flight', async () => {
    let releaseLocale: (value: Account) => void = () => {};
    mockSetAccountLocale.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseLocale = resolve;
        }),
    );

    renderSync(account('acc_out', { locale: null, fiat: null }));
    await waitFor(() => {
      expect(mockSetAccountLocale).toHaveBeenCalled();
    });

    act(() => {
      useAuthStore.getState().clearAuth();
    });
    await act(async () => {
      releaseLocale(account('acc_out', { locale: 'en', fiat: 'USD' }));
    });
    await flushEffect();

    expect(useAuthStore.getState().session).toBeNull();
    expect(useAuthStore.getState().account).toBeNull();
    expect(mockSetAccountFiat).not.toHaveBeenCalled();
    expect(cookie('locale')).toBeUndefined();
  });

  it('does not treat a choice made while signed out of the store as the baseline', async () => {
    renderSync(null, null);
    await flushEffect();

    act(() => {
      bumpLocaleGeneration();
      useAuthStore.setState({
        session: null,
        account: account('acc_base', { locale: null }),
        wrongAccount: false,
      });
    });
    await flushEffect();

    act(() => {
      useAuthStore.setState({
        session: 's',
        account: account('acc_base', { locale: null }),
        wrongAccount: false,
      });
    });
    await flushEffect();

    expect(mockSetAccountLocale).not.toHaveBeenCalled();
  });

  it('does not post fiat after logout during the locale cookie refresh', async () => {
    refresh.mockImplementation(() => {
      useAuthStore.getState().clearAuth();
    });

    renderSync(account('acc_mid', { locale: 'de', fiat: null }));

    await waitFor(() => {
      expect(refresh).toHaveBeenCalled();
    });
    await flushEffect();

    expect(mockSetAccountFiat).not.toHaveBeenCalled();
    expect(useAuthStore.getState().account).toBeNull();
  });

  it('does not apply a fiat response for a different account', async () => {
    mockSetAccountFiat.mockResolvedValue(account('acc_other_fiat', { locale: 'en', fiat: 'EUR' }));

    renderSync(account('acc_fiat_id', { locale: 'en', fiat: null }));

    await waitFor(() => {
      expect(mockSetAccountFiat).toHaveBeenCalled();
    });
    await flushEffect();

    expect(useAuthStore.getState().account?.id).toBe('acc_fiat_id');
    expect(useAuthStore.getState().account?.fiat).toBeNull();
    expect(cookie('fiat')).toBeUndefined();
  });

  it('does not post after logout before the first preference request', async () => {
    renderSync(account('acc_yield', { locale: null, fiat: null }), 's', <LogoutOnEffect />);
    await flushEffect();

    expect(mockSetAccountLocale).not.toHaveBeenCalled();
    expect(mockSetAccountFiat).not.toHaveBeenCalled();
    expect(useAuthStore.getState().account).toBeNull();
  });

  it('does not apply a locale response for a different account', async () => {
    mockSetAccountLocale.mockResolvedValue(account('acc_other_locale', { locale: 'de' }));

    renderSync(account('acc_loc_id', { locale: null }));

    await waitFor(() => {
      expect(mockSetAccountLocale).toHaveBeenCalled();
    });
    await flushEffect();

    expect(useAuthStore.getState().account?.id).toBe('acc_loc_id');
    expect(useAuthStore.getState().account?.locale).toBeNull();
    expect(cookie('locale')).toBeUndefined();
    expect(refresh).not.toHaveBeenCalled();
  });
});
