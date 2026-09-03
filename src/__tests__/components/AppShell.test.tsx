import { cleanup, fireEvent, screen } from '@testing-library/react';
import { useState, type ReactElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { AppShell, AppShellFooter, AppShellHeader, AppShellTopLeft } from '@/components/AppShell';
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
    expect(main?.className).not.toContain('min-h-screen');
    expect(main?.className).not.toContain('h-svh');

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
    expect(inner?.className).toContain('min-h-full');
    expect(inner?.className).toContain('items-center');
    expect(inner?.className).toContain('justify-center');
  });

  it('flow has no overflow-hidden and no inner overflow-y-auto', () => {
    const { container } = renderWithLocale(
      <AppShell mode="flow">
        <p>Flow body</p>
      </AppShell>,
    );
    const main = container.querySelector('main');
    expect(main?.className).toContain('min-h-[var(--app-height)]');
    expect(main?.className).not.toContain('overflow-hidden');
    expect(main?.className).not.toContain('justify-center');
    expect(main?.querySelector('.overflow-y-auto')).toBeNull();
    const body = main?.querySelector('.pt-24');
    expect(body?.className).toContain('items-center');
    expect(screen.getByText('Flow body')).toBeTruthy();
  });

  it('renders chrome slots and omits null/undefined', () => {
    const { container, rerender } = renderWithLocale(
      <AppShell
        mode="fill"
        topLeft={<span data-testid="left">L</span>}
        topRight={<span data-testid="right">R</span>}
      >
        <p>Body</p>
      </AppShell>,
    );
    expect(screen.getByTestId('left')).toBeTruthy();
    expect(screen.getByTestId('right')).toBeTruthy();
    expect(container.querySelector('.left-5')?.className).toContain('gap-2');

    rerender(
      <AppShell mode="fill" topLeft={null} topRight={null}>
        <p>Body</p>
      </AppShell>,
    );
    expect(screen.queryByTestId('left')).toBeNull();
    expect(screen.queryByTestId('right')).toBeNull();
    expect(container.querySelector('.right-5')).toBeNull();
    const leftHost = container.querySelector('.left-5');
    expect(leftHost?.className).toContain('empty:hidden');
    expect(leftHost?.childNodes.length).toBe(0);
  });

  it('AppShellTopLeft from a child wins over the page topLeft prop', () => {
    renderWithLocale(
      <AppShell mode="fill" topLeft={<span data-testid="page-left">Page</span>}>
        <AppShellTopLeft>
          <span data-testid="child-left">Child</span>
        </AppShellTopLeft>
        <p>Body</p>
      </AppShell>,
    );
    expect(screen.getByTestId('child-left')).toBeTruthy();
    expect(screen.queryByTestId('page-left')).toBeNull();
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
});
