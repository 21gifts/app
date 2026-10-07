import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { useContext, useState, type ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AppShell,
  AppShellContext,
  AppShellFooter,
  AppShellHeader,
  AppShellTopLeft,
  useAppShellScroller,
} from '@/components/AppShell';
import { Card } from '@/components/ui/Card';
import { renderWithLocale } from '@/__tests__/render-with-locale';
import { useAuthStore } from '@/stores/auth-store';
import type { Account } from '@/lib/api-types';

vi.mock('next/navigation', () => ({
  useRouter: (): { replace: () => void } => ({ replace: () => undefined }),
}));

afterEach(cleanup);

/** Account that must set up its in-app wallet when the Breez key is set. */
const WALLET_SETUP_ACCOUNT = {
  id: 'acc',
  linkingKey: null,
  role: 'basis',
  name: 'Ada',
  username: 'ada',
  location: null,
  lightningAddress: null,
  lightningAddressVerified: false,
  forumLawsDismissed: false,
  createdAt: 1,
  rulesAgreedAt: 1,
  viewKey: 'a'.repeat(64),
  aboutMe: null,
  aboutMeHasPhoto: false,
  setup: null,
  missing: [],
  walletRequired: true,
  passkeyCredentialId: 'AQID',
  sparkPubkey: null,
  sparkWalletVerified: false,
} as Account;

/** Footer whose children are new JSX every parent render — used to catch slot update loops. */
function FlakyFooter(): ReactElement {
  const [n, setN] = useState(0);
  return (
    <AppShellFooter>
      <button type="button" onClick={() => setN(n + 1)}>
        {n}
      </button>
    </AppShellFooter>
  );
}

/** Reads {@link useAppShellScroller} so tests can cover both ancestor branches. */
function ScrollerProbe(): ReactElement {
  const scroller = useAppShellScroller();
  return (
    <span data-testid="scroller-probe">{scroller === null ? 'none' : scroller.className}</span>
  );
}

/** Shows the measured frame width, or `none` before the first positive measurement. */
function FrameWidthProbe(): ReactElement {
  const width = useContext(AppShellContext)?.frameWidth ?? null;
  return <span data-testid="frame-width">{width === null ? 'none' : String(width)}</span>;
}

describe('AppShell', () => {
  it('shows Renew passkey when the signed-in account has no seed', () => {
    useAuthStore.setState({
      session: 'tok',
      account: {
        id: 'acc',
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
        missing: [],
        walletRequired: false,
      } as Account,
    });
    renderWithLocale(
      <AppShell mode="fill">
        <p>Body</p>
      </AppShell>,
    );
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
    useAuthStore.setState({ session: null, account: null });
  });

  it('does not render a blocking dialog for an account that needs wallet setup', () => {
    const original = process.env.NEXT_PUBLIC_BREEZ_API_KEY;
    process.env.NEXT_PUBLIC_BREEZ_API_KEY = 'test-key';
    try {
      useAuthStore.setState({ session: 'tok', account: WALLET_SETUP_ACCOUNT });
      renderWithLocale(
        <AppShell mode="fill">
          <p>Body</p>
        </AppShell>,
      );
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(screen.getByText('Body')).toBeTruthy();
    } finally {
      if (original === undefined) {
        delete process.env.NEXT_PUBLIC_BREEZ_API_KEY;
      } else {
        process.env.NEXT_PUBLIC_BREEZ_API_KEY = original;
      }
      useAuthStore.setState({ session: null, account: null });
    }
  });

  it('fill renders footer as a sibling of the inner scroller', () => {
    const { container } = renderWithLocale(
      <AppShell mode="fill">
        <AppShellHeader>
          <h1>Title</h1>
        </AppShellHeader>
        <p>Body</p>
        <AppShellFooter>
          <button type="button">Continue</button>
        </AppShellFooter>
      </AppShell>,
    );
    const main = container.querySelector('main');
    expect(main?.className).toContain('h-[var(--app-height)]');
    expect(main?.className).not.toContain('overflow-hidden');
    expect(main?.className).toContain('px-3 max-[359px]:px-2 py-2');
    expect(main?.className).not.toContain('min-h-screen');
    expect(main?.className).not.toContain('h-svh');

    const frame = main?.querySelector(':scope > section');
    expect(frame?.className).toContain('rounded-3xl');
    expect(frame?.className).not.toContain('overflow-hidden');
    expect(main?.querySelectorAll(':scope > section').length).toBe(1);

    const header = main?.querySelector('header');
    const scroller = header?.nextElementSibling;
    const footer = main?.querySelector('footer');
    expect(header).toBeTruthy();
    expect(scroller?.className).toContain('flex-1');
    expect(scroller?.hasAttribute('data-scrollport')).toBe(true);
    expect(scroller?.className).toContain('min-h-0');
    expect(footer).toBeTruthy();
    expect(footer?.previousElementSibling).toBe(scroller);
    expect(footer?.className).toContain('px-5 pb-5');
    expect(header?.className).toContain('px-5');
    expect(main?.querySelector('[data-app-chrome]')?.className).toContain(
      'px-5 pt-4 pb-1 max-[359px]:px-3',
    );
    expect(main?.querySelector('[data-menu-sheet-host]')?.className).toBe('px-5');
    expect(main?.querySelector('[data-scroll-page]')?.className).toContain('px-5 py-4');
    expect(scroller?.contains(footer as Node)).toBe(false);
    expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Title' })).toBeTruthy();
    expect(screen.getByText('Body')).toBeTruthy();
  });

  it('fill align=center centers an inner wrapper, not the scroller or main', () => {
    const { container } = renderWithLocale(
      <AppShell mode="fill" align="center">
        <p>Card</p>
      </AppShell>,
    );
    const main = container.querySelector('main');
    expect(main?.className).not.toContain('justify-center');
    expect(main?.className).not.toContain('items-center');
    const frame = main?.querySelector(':scope > section');
    expect(frame?.className).toContain('basis-0');
    expect(frame?.className).toContain('self-stretch');
    expect(frame?.className).toContain('grow');
    expect(frame?.className).toContain('shrink');
    expect(frame?.className.split(/\s+/)).not.toContain('flex-1');
    const scroller = main?.querySelector('[data-scrollport]');
    expect(scroller?.className).not.toContain('items-center');
    expect(scroller?.className).not.toContain('justify-center');
    const inner = scroller?.querySelector('[data-scroll-page]');
    expect(inner?.className).toContain('flex');
    expect(inner?.className).toContain('flex-col');
    expect(inner?.className).toContain('min-h-full');
    expect(inner?.className).toContain('items-center');
    expect(inner?.className.split(/\s+/)).toContain('shell-safe-center');
    expect(inner?.className.split(/\s+/)).not.toContain('justify-center');
    expect(inner?.className).not.toContain('pt-24');
  });

  it('fill and flow share locked-height inner-scroller geometry', () => {
    for (const mode of ['fill', 'flow'] as const) {
      const { container, unmount } = renderWithLocale(
        <AppShell
          mode={mode}
          topLeft={<span data-testid={`${mode}-left`}>L</span>}
          topRight={<span data-testid={`${mode}-right`}>R</span>}
        >
          <p>{mode} body</p>
        </AppShell>,
      );
      const main = container.querySelector('main');
      expect(main?.className).toContain('h-[var(--app-height)]');
      expect(main?.className).not.toContain('overflow-hidden');
      expect(main?.className).toContain('py-2');
      expect(main?.className).not.toContain('justify-center');
      const frame = main?.querySelector(':scope > section');
      expect(frame?.className).toContain('rounded-3xl');
      expect(main?.querySelectorAll(':scope > section').length).toBe(1);
      const chrome = main?.querySelector('[data-app-chrome]');
      expect(chrome?.contains(screen.getByTestId(`${mode}-left`))).toBe(true);
      expect(chrome?.contains(screen.getByTestId(`${mode}-right`))).toBe(true);
      expect(main?.querySelector('[data-scrollport]')?.hasAttribute('data-scrollport')).toBe(true);
      expect(main?.innerHTML).not.toContain('pt-24');
      expect(screen.getByText(`${mode} body`)).toBeTruthy();
      unmount();
    }
  });

  it('renders chrome slots inside the frame header and omits null/undefined', () => {
    const { container, rerender } = renderWithLocale(
      <AppShell
        mode="fill"
        topLeft={<span data-testid="left">L</span>}
        topRight={<span data-testid="right">R</span>}
      >
        <p>Body</p>
      </AppShell>,
    );
    const chrome = container.querySelector('[data-app-chrome]');
    expect(chrome?.contains(screen.getByTestId('left'))).toBe(true);
    expect(chrome?.contains(screen.getByTestId('right'))).toBe(true);
    expect(chrome?.firstElementChild?.className).toContain('empty:hidden');
    expect(chrome?.lastElementChild?.className).toContain('empty:hidden');
    expect(chrome?.lastElementChild?.className).toContain('ml-auto');

    rerender(
      <AppShell mode="fill" topLeft={null} topRight={null}>
        <p>Body</p>
      </AppShell>,
    );
    expect(screen.queryByTestId('left')).toBeNull();
    expect(screen.queryByTestId('right')).toBeNull();
    const emptyChrome = container.querySelector('[data-app-chrome]');
    expect(emptyChrome?.firstElementChild?.className).toContain('empty:hidden');
    expect(emptyChrome?.firstElementChild?.childNodes.length).toBe(0);
    expect(emptyChrome?.lastElementChild?.className).toContain('empty:hidden');
    expect(emptyChrome?.lastElementChild?.className).toContain('ml-auto');
    expect(emptyChrome?.lastElementChild?.childNodes.length).toBe(0);
  });

  it('AppShellTopLeft from a child wins over the page topLeft prop', () => {
    const { container } = renderWithLocale(
      <AppShell mode="fill" topLeft={<span data-testid="page-left">Page</span>}>
        <AppShellTopLeft>
          <span data-testid="child-left">Child</span>
        </AppShellTopLeft>
        <p>Body</p>
      </AppShell>,
    );
    expect(screen.getByTestId('child-left')).toBeTruthy();
    expect(screen.queryByTestId('page-left')).toBeNull();
    const chrome = container.querySelector('[data-app-chrome]');
    expect(chrome?.contains(screen.getByTestId('child-left'))).toBe(true);
  });

  it('AppShellTopLeft portals into the chrome row, not a Card', () => {
    const { container } = renderWithLocale(
      <AppShell mode="fill" align="center" topLeft={<span data-testid="page-left">Page</span>}>
        <AppShellTopLeft>
          <span data-testid="child-left">Child</span>
        </AppShellTopLeft>
        <Card>
          <p>Body</p>
        </Card>
      </AppShell>,
    );
    const chrome = container.querySelector('[data-app-chrome]');
    const card = screen.getByText('Body').closest('section');
    expect(screen.getByTestId('child-left')).toBeTruthy();
    expect(screen.queryByTestId('page-left')).toBeNull();
    expect(chrome?.contains(screen.getByTestId('child-left'))).toBe(true);
    expect(card?.contains(screen.getByTestId('child-left'))).toBe(false);
  });

  it('appends className and treats empty className as absent', () => {
    const { container, rerender } = renderWithLocale(
      <AppShell mode="flow" className="extra">
        <p>A</p>
      </AppShell>,
    );
    expect(container.querySelector('main')?.className).toContain('extra');

    rerender(
      <AppShell mode="flow" className="">
        <p>B</p>
      </AppShell>,
    );
    expect(container.querySelector('main')?.className).not.toContain('undefined');
  });

  it('slot helpers render inline without an AppShell ancestor', () => {
    renderWithLocale(
      <>
        <AppShellHeader>
          <h1>Inline header</h1>
        </AppShellHeader>
        <AppShellFooter>
          <button type="button">Inline footer</button>
        </AppShellFooter>
        <AppShellTopLeft>
          <span>Inline left</span>
        </AppShellTopLeft>
      </>,
    );
    expect(screen.getByRole('heading', { name: 'Inline header' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Inline footer' })).toBeTruthy();
    expect(screen.getByText('Inline left')).toBeTruthy();
  });

  it('keeps an empty footer host when no AppShellFooter registers', () => {
    const { container } = renderWithLocale(
      <AppShell mode="fill">
        <p>Only body</p>
      </AppShell>,
    );
    const footer = container.querySelector('footer');
    expect(footer).toBeTruthy();
    expect(footer?.className).toContain('empty:hidden');
    expect(footer?.childNodes.length).toBe(0);
  });

  it('does not infinite-loop when footer children are new JSX each render', () => {
    renderWithLocale(
      <AppShell mode="fill">
        <p>Body</p>
        <FlakyFooter />
      </AppShell>,
    );
    const button = screen.getByRole('button');
    for (let i = 0; i < 8; i += 1) {
      fireEvent.click(button);
    }
    expect(screen.getByRole('button').textContent).toBe('8');
  });

  it('useAppShellScroller returns the scrollport inside AppShell', () => {
    renderWithLocale(
      <AppShell mode="fill">
        <ScrollerProbe />
      </AppShell>,
    );
    expect(screen.getByTestId('scroller-probe').textContent).toContain('flex-1');
  });

  it('useAppShellScroller returns null outside AppShell', () => {
    renderWithLocale(<ScrollerProbe />);
    expect(screen.getByTestId('scroller-probe').textContent).toBe('none');
  });

  it('Card never hosts chrome; the frame header does', () => {
    const { container } = renderWithLocale(
      <AppShell
        mode="fill"
        align="center"
        topLeft={<span data-testid="left">L</span>}
        topRight={<span data-testid="right">R</span>}
      >
        <Card>
          <p>Body</p>
        </Card>
      </AppShell>,
    );
    const main = container.querySelector('main');
    const chrome = main?.querySelector('[data-app-chrome]');
    const card = screen.getByText('Body').closest('section');
    expect(chrome?.contains(screen.getByTestId('left'))).toBe(true);
    expect(chrome?.contains(screen.getByTestId('right'))).toBe(true);
    expect(card?.contains(screen.getByTestId('left'))).toBe(false);
    expect(card?.contains(screen.getByTestId('right'))).toBe(false);
    const scroller = main?.querySelector('[data-scrollport]');
    expect(scroller?.firstElementChild?.className).not.toContain('pt-24');
    expect(scroller?.className).not.toContain('justify-center');
    expect(main?.className).not.toContain('justify-center');
  });

  it('does not infinite-loop when a Card wraps a flaky footer', () => {
    renderWithLocale(
      <AppShell
        mode="fill"
        align="center"
        topLeft={<span data-testid="left">L</span>}
        topRight={<span data-testid="right">R</span>}
      >
        <Card>
          <p>Body</p>
          <FlakyFooter />
        </Card>
      </AppShell>,
    );
    const button = screen.getByRole('button');
    for (let i = 0; i < 8; i += 1) {
      fireEvent.click(button);
    }
    expect(screen.getByRole('button').textContent).toBe('8');
  });

  it('publishes frame width from the content box, including a zero and a missing box', () => {
    const callbacks: ResizeObserverCallback[] = [];
    class FakeResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        callbacks.push(callback);
      }

      observe(): void {}

      unobserve(): void {}

      disconnect(): void {}
    }
    const previous = globalThis.ResizeObserver;
    globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
    const widthDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get: () => 640,
    });
    try {
      renderWithLocale(
        <AppShell mode="fill">
          <FrameWidthProbe />
        </AppShell>,
      );
      expect(screen.getByTestId('frame-width').textContent).toBe('640');
      const callback = callbacks.at(-1);
      const frame = document.querySelector('[data-app-frame]');
      if (callback === undefined || !(frame instanceof Element)) {
        throw new Error('missing frame observer');
      }
      const entry = (width: number | undefined, box: unknown): ResizeObserverEntry =>
        ({
          target: frame,
          contentBoxSize: box,
          contentRect: { width: width ?? 320 },
        }) as ResizeObserverEntry;
      act(() => {
        callback([entry(10, [{ inlineSize: 400 }])], {} as ResizeObserver);
      });
      expect(screen.getByTestId('frame-width').textContent).toBe('400');
      act(() => {
        callback([entry(11, { inlineSize: 700 })], {} as ResizeObserver);
      });
      expect(screen.getByTestId('frame-width').textContent).toBe('700');
      act(() => {
        callback([entry(320, undefined)], {} as ResizeObserver);
      });
      expect(screen.getByTestId('frame-width').textContent).toBe('320');
      act(() => {
        callback([entry(50, [{ inlineSize: 0 }])], {} as ResizeObserver);
      });
      expect(screen.getByTestId('frame-width').textContent).toBe('none');
      act(() => {
        callback([], {} as ResizeObserver);
      });
      expect(screen.getByTestId('frame-width').textContent).toBe('none');
    } finally {
      globalThis.ResizeObserver = previous;
      if (widthDescriptor === undefined) {
        delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
      } else {
        Object.defineProperty(HTMLElement.prototype, 'clientWidth', widthDescriptor);
      }
    }
  });
});
