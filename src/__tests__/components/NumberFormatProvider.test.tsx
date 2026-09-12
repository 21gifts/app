import { act, cleanup, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NumberFormatProvider, useNumberFormat } from '@/components/NumberFormatProvider';
import { NUMBER_FORMAT_COOKIE } from '@/lib/number-format';

afterEach(() => {
  cleanup();
  document.cookie = `${NUMBER_FORMAT_COOKIE}=; Path=/; Max-Age=0`;
  vi.unstubAllGlobals();
});

function Probe(): ReactElement {
  const { numberFormat, setNumberFormat } = useNumberFormat();
  return (
    <div>
      <span data-testid="style">{numberFormat}</span>
      <button type="button" onClick={() => setNumberFormat('ch')}>
        set-ch
      </button>
      <button type="button" onClick={() => setNumberFormat('us')}>
        set-us
      </button>
      <button type="button" onClick={() => setNumberFormat('de')}>
        set-de
      </button>
    </div>
  );
}

describe('NumberFormatProvider', () => {
  it('exposes the initial style', () => {
    render(
      <NumberFormatProvider initial="us">
        <Probe />
      </NumberFormatProvider>,
    );
    expect(screen.getByTestId('style').textContent).toBe('us');
  });

  it('writes a us cookie with Path Max-Age SameSite Lax', () => {
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
        <NumberFormatProvider initial="ch">
          <Probe />
        </NumberFormatProvider>,
      );
      act(() => {
        screen.getByRole('button', { name: 'set-us' }).click();
      });
      expect(cookieSet).toHaveBeenCalledWith(
        `${NUMBER_FORMAT_COOKIE}=us; Path=/; Max-Age=31536000; SameSite=Lax`,
      );
      expect(screen.getByTestId('style').textContent).toBe('us');
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
        <NumberFormatProvider initial="ch">
          <Probe />
        </NumberFormatProvider>,
      );
      act(() => {
        screen.getByRole('button', { name: 'set-de' }).click();
      });
      expect(cookieSet).toHaveBeenCalledWith(
        `${NUMBER_FORMAT_COOKIE}=de; Path=/; Max-Age=31536000; SameSite=Lax; Secure`,
      );
    } finally {
      if (cookieDesc !== undefined) {
        Object.defineProperty(document, 'cookie', cookieDesc);
      }
    }
  });

  it('writes ch when the cookie is absent and the visitor selects ch', () => {
    const cookieSet = vi.fn();
    const cookieDesc = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get: () => '',
      set: cookieSet,
    });
    try {
      render(
        <NumberFormatProvider initial="ch">
          <Probe />
        </NumberFormatProvider>,
      );
      act(() => {
        screen.getByRole('button', { name: 'set-ch' }).click();
      });
      expect(cookieSet).toHaveBeenCalledWith(
        `${NUMBER_FORMAT_COOKIE}=ch; Path=/; Max-Age=31536000; SameSite=Lax`,
      );
    } finally {
      if (cookieDesc !== undefined) {
        Object.defineProperty(document, 'cookie', cookieDesc);
      }
    }
  });

  it('rewrites when in-memory style matches but the cookie does not', () => {
    const cookieSet = vi.fn();
    const cookieDesc = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get: () => `${NUMBER_FORMAT_COOKIE}=us`,
      set: cookieSet,
    });
    vi.stubGlobal('location', { protocol: 'http:' });
    try {
      render(
        <NumberFormatProvider initial="ch">
          <Probe />
        </NumberFormatProvider>,
      );
      act(() => {
        screen.getByRole('button', { name: 'set-ch' }).click();
      });
      expect(cookieSet).toHaveBeenCalledWith(
        `${NUMBER_FORMAT_COOKIE}=ch; Path=/; Max-Age=31536000; SameSite=Lax`,
      );
      expect(screen.getByTestId('style').textContent).toBe('ch');
    } finally {
      if (cookieDesc !== undefined) {
        Object.defineProperty(document, 'cookie', cookieDesc);
      }
    }
  });

  it('does not rewrite when the cookie already matches the current style', () => {
    const cookieSet = vi.fn();
    const cookieDesc = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get: () => `${NUMBER_FORMAT_COOKIE}=ch`,
      set: cookieSet,
    });
    try {
      render(
        <NumberFormatProvider initial="ch">
          <Probe />
        </NumberFormatProvider>,
      );
      act(() => {
        screen.getByRole('button', { name: 'set-ch' }).click();
      });
      expect(cookieSet).not.toHaveBeenCalled();
      expect(screen.getByTestId('style').textContent).toBe('ch');
    } finally {
      if (cookieDesc !== undefined) {
        Object.defineProperty(document, 'cookie', cookieDesc);
      }
    }
  });

  it('treats a malformed percent cookie as absent and writes ch', () => {
    const cookieSet = vi.fn();
    const cookieDesc = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get: () => `${NUMBER_FORMAT_COOKIE}=%`,
      set: cookieSet,
    });
    try {
      render(
        <NumberFormatProvider initial="ch">
          <Probe />
        </NumberFormatProvider>,
      );
      act(() => {
        screen.getByRole('button', { name: 'set-ch' }).click();
      });
      expect(cookieSet).toHaveBeenCalledWith(
        `${NUMBER_FORMAT_COOKIE}=ch; Path=/; Max-Age=31536000; SameSite=Lax`,
      );
    } finally {
      if (cookieDesc !== undefined) {
        Object.defineProperty(document, 'cookie', cookieDesc);
      }
    }
  });

  it('treats an invalid cookie as absent and writes ch', () => {
    const cookieSet = vi.fn();
    const cookieDesc = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get: () => `${NUMBER_FORMAT_COOKIE}=xx`,
      set: cookieSet,
    });
    try {
      render(
        <NumberFormatProvider initial="ch">
          <Probe />
        </NumberFormatProvider>,
      );
      act(() => {
        screen.getByRole('button', { name: 'set-ch' }).click();
      });
      expect(cookieSet).toHaveBeenCalledWith(
        `${NUMBER_FORMAT_COOKIE}=ch; Path=/; Max-Age=31536000; SameSite=Lax`,
      );
    } finally {
      if (cookieDesc !== undefined) {
        Object.defineProperty(document, 'cookie', cookieDesc);
      }
    }
  });
});

describe('useNumberFormat', () => {
  it('throws outside NumberFormatProvider', () => {
    expect(() => render(<Probe />)).toThrow(
      /useNumberFormat must be used within NumberFormatProvider/,
    );
  });
});
