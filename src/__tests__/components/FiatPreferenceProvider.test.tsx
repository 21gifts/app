import { act, cleanup, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FiatPreferenceProvider, useFiatPreference } from '@/components/FiatPreferenceProvider';
import { FIAT_COOKIE } from '@/lib/stats-money';

afterEach(() => {
  cleanup();
  document.cookie = `${FIAT_COOKIE}=; Path=/; Max-Age=0`;
  vi.unstubAllGlobals();
});

function Probe(): ReactElement {
  const { fiat, setFiat } = useFiatPreference();
  return (
    <div>
      <span data-testid="code">{fiat}</span>
      <button type="button" onClick={() => setFiat('CHF')}>
        set-chf
      </button>
      <button type="button" onClick={() => setFiat('USD')}>
        set-usd
      </button>
    </div>
  );
}

describe('FiatPreferenceProvider', () => {
  it('exposes the initial code', () => {
    render(
      <FiatPreferenceProvider initial="EUR">
        <Probe />
      </FiatPreferenceProvider>,
    );
    expect(screen.getByTestId('code').textContent).toBe('EUR');
  });

  it('follows a new initial when the server locale default changes', () => {
    const { rerender } = render(
      <FiatPreferenceProvider initial="USD">
        <Probe />
      </FiatPreferenceProvider>,
    );
    expect(screen.getByTestId('code').textContent).toBe('USD');
    rerender(
      <FiatPreferenceProvider initial="CHF">
        <Probe />
      </FiatPreferenceProvider>,
    );
    expect(screen.getByTestId('code').textContent).toBe('CHF');
  });

  it('keeps a valid cookie when a later initial is stale', () => {
    document.cookie = `${FIAT_COOKIE}=CHF; Path=/`;
    const { rerender } = render(
      <FiatPreferenceProvider initial="USD">
        <Probe />
      </FiatPreferenceProvider>,
    );
    expect(screen.getByTestId('code').textContent).toBe('CHF');
    rerender(
      <FiatPreferenceProvider initial="EUR">
        <Probe />
      </FiatPreferenceProvider>,
    );
    expect(screen.getByTestId('code').textContent).toBe('CHF');
  });

  it('writes a CHF cookie with Path Max-Age SameSite Lax', () => {
    const cookieSet = vi.fn();
    const cookieDesc = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get: () => '',
      set: cookieSet,
    });
    vi.stubGlobal('location', { protocol: 'http:' });
    try {
      render(
        <FiatPreferenceProvider initial="USD">
          <Probe />
        </FiatPreferenceProvider>,
      );
      act(() => {
        screen.getByRole('button', { name: 'set-chf' }).click();
      });
      expect(cookieSet).toHaveBeenCalledWith(
        `${FIAT_COOKIE}=CHF; Path=/; Max-Age=31536000; SameSite=Lax`,
      );
      expect(screen.getByTestId('code').textContent).toBe('CHF');
    } finally {
      if (cookieDesc !== undefined) {
        Object.defineProperty(document, 'cookie', cookieDesc);
      }
    }
  });

  it('adds Secure to the cookie on https', () => {
    const cookieSet = vi.fn();
    const cookieDesc = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get: () => '',
      set: cookieSet,
    });
    vi.stubGlobal('location', { protocol: 'https:' });
    try {
      render(
        <FiatPreferenceProvider initial="USD">
          <Probe />
        </FiatPreferenceProvider>,
      );
      act(() => {
        screen.getByRole('button', { name: 'set-chf' }).click();
      });
      expect(cookieSet).toHaveBeenCalledWith(
        `${FIAT_COOKIE}=CHF; Path=/; Max-Age=31536000; SameSite=Lax; Secure`,
      );
    } finally {
      if (cookieDesc !== undefined) {
        Object.defineProperty(document, 'cookie', cookieDesc);
      }
    }
  });

  it('throws outside the provider', () => {
    expect(() => render(<Probe />)).toThrow(
      'useFiatPreference must be used within FiatPreferenceProvider',
    );
  });

  it('writes when in-memory code matches but the cookie is absent', () => {
    const cookieSet = vi.fn();
    const cookieDesc = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get: () => '',
      set: cookieSet,
    });
    vi.stubGlobal('location', { protocol: 'http:' });
    try {
      render(
        <FiatPreferenceProvider initial="USD">
          <Probe />
        </FiatPreferenceProvider>,
      );
      act(() => {
        screen.getByRole('button', { name: 'set-usd' }).click();
      });
      expect(cookieSet).toHaveBeenCalledWith(
        `${FIAT_COOKIE}=USD; Path=/; Max-Age=31536000; SameSite=Lax`,
      );
    } finally {
      if (cookieDesc !== undefined) {
        Object.defineProperty(document, 'cookie', cookieDesc);
      }
    }
  });

  it('does not rewrite when the cookie already matches the current code', () => {
    const cookieSet = vi.fn();
    const cookieDesc = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get: () => `${FIAT_COOKIE}=USD`,
      set: cookieSet,
    });
    try {
      render(
        <FiatPreferenceProvider initial="USD">
          <Probe />
        </FiatPreferenceProvider>,
      );
      act(() => {
        screen.getByRole('button', { name: 'set-usd' }).click();
      });
      expect(cookieSet).not.toHaveBeenCalled();
      expect(screen.getByTestId('code').textContent).toBe('USD');
    } finally {
      if (cookieDesc !== undefined) {
        Object.defineProperty(document, 'cookie', cookieDesc);
      }
    }
  });

  it('does not rewrite when the cookie already matches even if in-memory state is stale', () => {
    const cookieSet = vi.fn();
    const cookieDesc = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
    let cookieValue = '';
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get: () => cookieValue,
      set: cookieSet,
    });
    try {
      render(
        <FiatPreferenceProvider initial="USD">
          <Probe />
        </FiatPreferenceProvider>,
      );
      expect(screen.getByTestId('code').textContent).toBe('USD');
      cookieValue = `${FIAT_COOKIE}=CHF`;
      act(() => {
        screen.getByRole('button', { name: 'set-chf' }).click();
      });
      expect(cookieSet).not.toHaveBeenCalled();
      expect(screen.getByTestId('code').textContent).toBe('CHF');
    } finally {
      if (cookieDesc !== undefined) {
        Object.defineProperty(document, 'cookie', cookieDesc);
      }
    }
  });

  it('treats a malformed cookie as absent and still writes', () => {
    const cookieSet = vi.fn();
    const cookieDesc = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get: () => `${FIAT_COOKIE}=%E0%A4%A`,
      set: cookieSet,
    });
    vi.stubGlobal('location', { protocol: 'http:' });
    try {
      render(
        <FiatPreferenceProvider initial="USD">
          <Probe />
        </FiatPreferenceProvider>,
      );
      act(() => {
        screen.getByRole('button', { name: 'set-usd' }).click();
      });
      expect(cookieSet).toHaveBeenCalledWith(
        `${FIAT_COOKIE}=USD; Path=/; Max-Age=31536000; SameSite=Lax`,
      );
    } finally {
      if (cookieDesc !== undefined) {
        Object.defineProperty(document, 'cookie', cookieDesc);
      }
    }
  });
});
