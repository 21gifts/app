import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithLocale } from '@/__tests__/render-with-locale';
import { PayLinkScreen } from '@/components/PayLinkScreen';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('next/navigation', () => ({
  useRouter: (): { push: (href: string) => void } => ({ push: vi.fn() }),
}));

const ADA = 'LNURL1DP68GURN8GHJ7V339ENKJEN5WVHJUAM9D3KZ66MWDAMKUTMVDE6HYMRS9ASKGCGMXDMGQ';

const profile = {
  name: 'Ada Lovelace',
  username: 'ada',
  minSats: 1,
  maxSats: 100,
};

function mockFetch(handler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(handler));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('PayLinkScreen', () => {
  it('shows the invalid link without fetching', async () => {
    mockFetch(async () => {
      throw new Error('should not fetch');
    });
    renderWithLocale(<PayLinkScreen lightning="" />);
    expect((await screen.findByRole('alert')).textContent).toBe('This payment link is not valid.');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('shows the name and rejects an amount outside the window', async () => {
    mockFetch(async () => Response.json(profile));
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    expect(await screen.findByRole('heading', { name: 'Ada Lovelace' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Create invoice' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Enter a whole number.');
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create invoice' }));
    expect(screen.getByRole('alert').textContent).toBe('Enter a whole number.');
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '101' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create invoice' }));
    expect(screen.getByRole('alert').textContent).toBe('Enter a whole number.');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('shows the invoice QR after a successful mint', async () => {
    mockFetch(async (input, init) => {
      if (String(input).endsWith('/invoice')) {
        expect(init?.method).toBe('POST');
        expect(init?.body).toBe(JSON.stringify({ amountSats: 21 }));
        return Response.json({ pr: 'lnbc210n1paylink', amountSats: 21 });
      }
      return Response.json(profile);
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    await screen.findByRole('heading', { name: 'Ada Lovelace' });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create invoice' }));
    expect(await screen.findByRole('img', { name: 'Bitcoin invoice' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Pay' }).getAttribute('href')).toBe(
      'walletofsatoshi:lightning:LNBC210N1PAYLINK',
    );
    expect(screen.queryByRole('button', { name: 'Create invoice' })).toBeNull();
    expect((screen.getByLabelText('Amount') as HTMLInputElement).disabled).toBe(true);
  });

  it('keeps the form when the invoice request fails', async () => {
    mockFetch(async (input) => {
      if (String(input).endsWith('/invoice')) {
        return new Response('no', { status: 502 });
      }
      return Response.json(profile);
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    await screen.findByRole('heading', { name: 'Ada Lovelace' });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create invoice' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Could not create the invoice.');
    expect(
      (screen.getByRole('button', { name: 'Create invoice' }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it('treats a profile error and a thrown invoice request as failures', async () => {
    mockFetch(async () => new Response('missing', { status: 404 }));
    const { unmount } = renderWithLocale(<PayLinkScreen lightning={ADA} />);
    expect((await screen.findByRole('alert')).textContent).toBe('This payment link is not valid.');
    unmount();

    mockFetch(async (input) => {
      if (String(input).endsWith('/invoice')) {
        throw new Error('offline');
      }
      return Response.json(profile);
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    await screen.findByRole('heading', { name: 'Ada Lovelace' });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create invoice' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Could not create the invoice.');
  });

  it('ignores a profile response that arrives after unmount', async () => {
    let resolveGet: (response: Response) => void = () => undefined;
    mockFetch(
      () =>
        new Promise((resolve) => {
          resolveGet = resolve;
        }),
    );
    const { unmount } = renderWithLocale(<PayLinkScreen lightning={ADA} />);
    unmount();
    resolveGet(Response.json(profile));
    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });
  });

  it('ignores a profile failure that arrives after unmount', async () => {
    let rejectGet: (error: Error) => void = () => undefined;
    mockFetch(
      () =>
        new Promise((_resolve, reject) => {
          rejectGet = reject;
        }),
    );
    const { unmount } = renderWithLocale(<PayLinkScreen lightning={ADA} />);
    unmount();
    rejectGet(new Error('offline'));
    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });
  });

  it('treats a profile body that cannot be parsed as an invalid link', async () => {
    mockFetch(async () => new Response('not-json', { status: 200 }));
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    expect((await screen.findByRole('alert')).textContent).toBe('This payment link is not valid.');
  });
});
