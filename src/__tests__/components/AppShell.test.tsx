import { cleanup, fireEvent, screen } from '@testing-library/react';
import { useState, type ReactElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  AppShell,
  AppShellFooter,
  AppShellHeader,
  AppShellTopLeft,
  useAppShellScroller,
} from '@/components/AppShell';
import { Card } from '@/components/ui/Card';
import { renderWithLocale } from '@/__tests__/render-with-locale';

afterEach(cleanup);

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

describe('AppShell', () => {
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
    expect(main?.className).toContain('overflow-hidden');
    expect(main?.className).toContain('py-4');
    expect(main?.className).not.toContain('min-h-screen');
    expect(main?.className).not.toContain('h-svh');

    const frame = main?.querySelector(':scope > section');
    expect(frame?.className).toContain('rounded-3xl');
    expect(main?.querySelectorAll(':scope > section').length).toBe(1);

    const header = main?.querySelector('header');
    const scroller = header?.nextElementSibling;
    const footer = main?.querySelector('footer');
    expect(header).toBeTruthy();
    expect(scroller?.className).toContain('flex-1');
    expect(scroller?.className).toContain('overflow-y-auto');
    expect(scroller?.className).toContain('min-h-0');
    expect(footer).toBeTruthy();
    expect(footer?.previousElementSibling).toBe(scroller);
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
    const scroller = main?.querySelector('.overflow-y-auto');
    expect(scroller?.className).not.toContain('items-center');
    expect(scroller?.className).not.toContain('justify-center');
    const inner = scroller?.firstElementChild;
    expect(inner?.className).toContain('flex');
    expect(inner?.className).toContain('flex-col');
    expect(inner?.className).toContain('min-h-full');
    expect(inner?.className).toContain('items-center');
    expect(inner?.className).toContain('justify-center');
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
      expect(main?.className).toContain('overflow-hidden');
      expect(main?.className).toContain('py-4');
      expect(main?.className).not.toContain('justify-center');
      const frame = main?.querySelector(':scope > section');
      expect(frame?.className).toContain('rounded-3xl');
      expect(main?.querySelectorAll(':scope > section').length).toBe(1);
      const chrome = main?.querySelector('[data-app-chrome]');
      expect(chrome?.contains(screen.getByTestId(`${mode}-left`))).toBe(true);
      expect(chrome?.contains(screen.getByTestId(`${mode}-right`))).toBe(true);
      expect(main?.querySelector('.overflow-y-auto')?.className).toContain('overflow-y-auto');
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

  it('useAppShellScroller returns the overflow-y-auto node inside AppShell', () => {
    renderWithLocale(
      <AppShell mode="fill">
        <ScrollerProbe />
      </AppShell>,
    );
    expect(screen.getByTestId('scroller-probe').textContent).toContain('overflow-y-auto');
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
    const scroller = main?.querySelector('.overflow-y-auto');
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
});
