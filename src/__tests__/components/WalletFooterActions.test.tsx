import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from '@/components/AppShell';
import { WalletFooterActions } from '@/components/WalletFooterActions';
import { renderWithLocale } from '@/__tests__/render-with-locale';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** Reduced motion or not, for the glide after the scroll stops. */
function stubMotion(reduce: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: reduce && query.includes('reduce'),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

/** The footer buttons in a shell whose page is 1000 px taller than its port. */
function renderInShell(): { port: HTMLElement; body: HTMLElement; unmount: () => void } {
  const view = renderWithLocale(
    <AppShell mode="fill">
      <p>Feed</p>
      <WalletFooterActions onReceive={vi.fn()} onSend={vi.fn()} />
    </AppShell>,
  );
  const port = view.container.querySelector('[data-scrollport]') as HTMLElement;
  Object.defineProperty(port, 'scrollHeight', { configurable: true, value: 1600 });
  Object.defineProperty(port, 'clientHeight', { configurable: true, value: 600 });
  const body = view.container.querySelector('[data-app-body]') as HTMLElement;
  return { port, body, unmount: view.unmount };
}

/** Moves the page to `top` and announces the scroll. */
function scrollTo(port: HTMLElement, top: number): void {
  port.scrollTop = top;
  fireEvent.scroll(port);
}

/** The collapse progress on the frame body ('' when unset). */
function collapse(body: HTMLElement): string {
  return body.style.getPropertyValue('--footer-collapse');
}

describe('WalletFooterActions', () => {
  it('shows Receive left of Send with inward and outward arrows, a soft fade, and calls the handlers', () => {
    const onReceive = vi.fn();
    const onSend = vi.fn();
    const { container } = renderWithLocale(
      <WalletFooterActions onReceive={onReceive} onSend={onSend} />,
    );
    const receive = screen.getByRole('button', { name: 'Receive' });
    const send = screen.getByRole('button', { name: 'Send' });
    expect(receive.compareDocumentPosition(send) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(receive.querySelector('svg')?.getAttribute('class')).toContain(
      'lucide-arrow-down-right',
    );
    expect(send.querySelector('svg')?.getAttribute('class')).toContain('lucide-arrow-up-right');
    expect(receive.querySelector('svg')?.getAttribute('class')).toContain('max-[359px]:hidden');
    expect(receive.className).toContain('max-[359px]:px-2');
    const fade = container.querySelector('[aria-hidden="true"].bottom-full') as HTMLElement;
    expect(fade.className).toContain('h-[18px]');
    expect(fade.className).toContain('backdrop-blur-[1.5px]');
    expect(fade.className).toContain('pointer-events-none');
    fireEvent.click(receive);
    fireEvent.click(send);
    expect(onReceive).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it('keeps Receive and Send enabled, also while the wallet opens', () => {
    renderWithLocale(<WalletFooterActions onReceive={vi.fn()} onSend={vi.fn()} />);
    expect((screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
    expect((screen.getByRole('button', { name: 'Receive' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('focuses the button of the view that just closed', () => {
    const view = renderWithLocale(
      <WalletFooterActions
        onReceive={vi.fn()}
        onSend={vi.fn()}

        focus="send"
      />,
    );
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Send' }));
    view.unmount();
    renderWithLocale(
      <WalletFooterActions
        onReceive={vi.fn()}
        onSend={vi.fn()}

        focus="receive"
      />,
    );
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Receive' }));
  });

  it('marks the button row and sizes everything from --footer-collapse, full when unset', () => {
    const { container } = renderWithLocale(
      <WalletFooterActions onReceive={vi.fn()} onSend={vi.fn()} />,
    );
    const row = container.querySelector('[data-footer-actions]') as HTMLElement;
    expect(row.className).toContain('pt-[calc(0.5rem-0.25rem*var(--footer-collapse,0))]');
    const receive = screen.getByRole('button', { name: 'Receive' });
    expect(receive.className).toContain('!min-h-[calc(3.5rem-1.25rem*var(--footer-collapse,0))]');
    expect(receive.className).toContain('!py-[calc(0.75rem-0.375rem*var(--footer-collapse,0))]');
    expect(receive.className).toContain(
      '!text-[length:calc(1rem-0.125rem*var(--footer-collapse,0))]',
    );
    expect(receive.className).toContain('group-data-[footer-snap]/body:ease-glide');
    expect(receive.querySelector('svg')?.getAttribute('class')).toContain(
      'h-[calc(1.25rem-0.25rem*var(--footer-collapse,0))]',
    );
  });

  it('follows the scroll distance down to slim and back up to full, always full near the top', () => {
    stubMotion(false);
    const { port, body } = renderInShell();
    expect(collapse(body)).toBe('');
    scrollTo(port, 100);
    expect(collapse(body)).toBe('1');
    scrollTo(port, 60);
    expect(collapse(body)).toBe('0.5');
    expect(body.hasAttribute('data-footer-snap')).toBe(false);
    scrollTo(port, 20);
    expect(collapse(body)).toBe('0');
    scrollTo(port, 60);
    expect(collapse(body)).toBe('0.5');
    scrollTo(port, 120);
    expect(collapse(body)).toBe('1');
    scrollTo(port, 200);
    expect(collapse(body)).toBe('1');
  });

  it('clamps an overscroll to the page, so a bounce past either end does not count', () => {
    stubMotion(false);
    const { port, body } = renderInShell();
    scrollTo(port, 1000);
    expect(collapse(body)).toBe('1');
    // iOS rubber band below the end, then back to the end: no movement up.
    scrollTo(port, 1080);
    scrollTo(port, 1000);
    expect(collapse(body)).toBe('1');
    // Above the top is the top.
    scrollTo(port, -40);
    expect(collapse(body)).toBe('0');
  });

  it('ignores the pull-back at the end of the page that the slimmer buttons cause', () => {
    stubMotion(false);
    const { port, body } = renderInShell();
    scrollTo(port, 1000);
    expect(collapse(body)).toBe('1');
    // The port grew by 28 px: the range is 972 and the browser clamped the position to it.
    Object.defineProperty(port, 'clientHeight', { configurable: true, value: 628 });
    scrollTo(port, 972);
    expect(collapse(body)).toBe('1');
    // A real move up from there still counts.
    scrollTo(port, 932);
    expect(collapse(body)).toBe('0.5');
    // A shorter range that leaves the position inside the page is a move like any other.
    Object.defineProperty(port, 'clientHeight', { configurable: true, value: 700 });
    scrollTo(port, 892);
    expect(collapse(body)).toBe('0');
  });

  it('glides to the nearer end once the scroll stops in between, and ends the glide on the next scroll', () => {
    vi.useFakeTimers();
    stubMotion(false);
    const { port, body } = renderInShell();
    scrollTo(port, 60);
    expect(collapse(body)).toBe('0.75');
    act(() => {
      vi.advanceTimersByTime(139);
    });
    expect(collapse(body)).toBe('0.75');
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(collapse(body)).toBe('1');
    expect(body.hasAttribute('data-footer-snap')).toBe(true);
    scrollTo(port, 20);
    expect(body.hasAttribute('data-footer-snap')).toBe(false);
    expect(collapse(body)).toBe('0');
    scrollTo(port, 50);
    expect(collapse(body)).toBe('0.375');
    act(() => {
      vi.advanceTimersByTime(140);
    });
    expect(collapse(body)).toBe('0');
    expect(body.hasAttribute('data-footer-snap')).toBe(true);
    // Already at an end: nothing to settle, and no glide.
    scrollTo(port, 30);
    expect(collapse(body)).toBe('0');
    act(() => {
      vi.advanceTimersByTime(140);
    });
    expect(collapse(body)).toBe('0');
    expect(body.hasAttribute('data-footer-snap')).toBe(false);
  });

  it('settles at once without the glide under reduced motion', () => {
    vi.useFakeTimers();
    stubMotion(true);
    const { port, body } = renderInShell();
    scrollTo(port, 40);
    expect(collapse(body)).toBe('0.5');
    act(() => {
      vi.advanceTimersByTime(140);
    });
    expect(collapse(body)).toBe('1');
    expect(body.hasAttribute('data-footer-snap')).toBe(false);
  });

  it('leaves no progress and no pending glide behind when it unmounts', () => {
    vi.useFakeTimers();
    stubMotion(false);
    const { port, body, unmount } = renderInShell();
    scrollTo(port, 100);
    act(() => {
      vi.advanceTimersByTime(140);
    });
    scrollTo(port, 70);
    unmount();
    expect(collapse(body)).toBe('');
    expect(body.hasAttribute('data-footer-snap')).toBe(false);
    act(() => {
      vi.advanceTimersByTime(140);
    });
    expect(collapse(body)).toBe('');
  });
});

/** The footer buttons in a shell with a fold switch, as the forum home renders them. */
function renderFoldable(folded: boolean): {
  port: HTMLElement;
  body: HTMLElement;
  footer: HTMLElement;
  rerender: (next: boolean) => void;
  unmount: () => void;
} {
  const tree = (next: boolean): React.JSX.Element => (
    <AppShell mode="fill">
      <p>Feed</p>
      <WalletFooterActions onReceive={vi.fn()} onSend={vi.fn()} folded={next} />
    </AppShell>
  );
  const view = renderWithLocale(tree(folded));
  const port = view.container.querySelector('[data-scrollport]') as HTMLElement;
  Object.defineProperty(port, 'scrollHeight', { configurable: true, value: 1600 });
  Object.defineProperty(port, 'clientHeight', { configurable: true, value: 600 });
  return {
    port,
    body: view.container.querySelector('[data-app-body]') as HTMLElement,
    footer: view.container.querySelector('footer') as HTMLElement,
    rerender: (next) => {
      view.rerender(tree(next));
    },
    unmount: view.unmount,
  };
}

describe('WalletFooterActions folded', () => {
  it('stays open by default and on /wallet: no fold marker, nothing clipped', () => {
    stubMotion(false);
    const { body } = renderInShell();
    expect(body.hasAttribute('data-footer-fold')).toBe(false);
    expect(body.hasAttribute('data-footer-folding')).toBe(false);
  });

  it('folds the row, its fade and the footer padding to nothing, and nothing in it can be pressed', () => {
    stubMotion(false);
    const { body, footer } = renderFoldable(true);
    expect(body.dataset['footerFold']).toBe('');
    // Folded from the first render: no glide.
    expect(body.hasAttribute('data-footer-folding')).toBe(false);
    const row = screen.getByRole('button', { name: 'Receive' }).closest('[data-footer-actions]')!
      .parentElement!.parentElement!;
    expect(row.className).toContain('grid grid-rows-[1fr]');
    expect(row.className).toContain('group-data-[footer-fold]/body:grid-rows-[0fr]');
    expect(row.className).toContain('group-data-[footer-fold]/body:opacity-0');
    expect(row.className).toContain('group-data-[footer-fold]/body:invisible');
    expect(row.className).toContain('group-data-[footer-fold]/body:pointer-events-none');
    expect(row.className).toContain(
      'group-data-[footer-folding]/body:transition-[grid-template-rows,opacity,visibility] group-data-[footer-folding]/body:duration-280 group-data-[footer-folding]/body:ease-glide',
    );
    const clip = row.firstElementChild as HTMLElement;
    expect(clip.className).toBe(
      'flex min-h-0 flex-col justify-end group-data-[footer-fold]/body:overflow-hidden group-data-[footer-folding]/body:overflow-hidden',
    );
    const fade = footer.querySelector('[aria-hidden="true"].bottom-full') as HTMLElement;
    expect(fade.className).toContain('group-data-[footer-fold]/body:opacity-0');
    expect(fade.className).toContain('group-data-[footer-folding]/body:transition-opacity');
    expect(footer.className).toContain('group-data-[footer-fold]/body:pb-0');
    expect(footer.className).toContain(
      'group-data-[footer-folding]/body:transition-[padding] group-data-[footer-folding]/body:duration-280 group-data-[footer-folding]/body:ease-glide',
    );
  });

  it('glides for 280 ms each way when the fold changes', () => {
    vi.useFakeTimers();
    stubMotion(false);
    const { body, rerender } = renderFoldable(false);
    expect(body.hasAttribute('data-footer-fold')).toBe(false);
    rerender(true);
    expect(body.dataset['footerFold']).toBe('');
    expect(body.dataset['footerFolding']).toBe('');
    act(() => {
      vi.advanceTimersByTime(279);
    });
    expect(body.dataset['footerFolding']).toBe('');
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(body.hasAttribute('data-footer-folding')).toBe(false);
    rerender(false);
    expect(body.hasAttribute('data-footer-fold')).toBe(false);
    expect(body.dataset['footerFolding']).toBe('');
    // Folding again half way restarts the glide from where it is.
    act(() => {
      vi.advanceTimersByTime(140);
    });
    rerender(true);
    expect(body.dataset['footerFolding']).toBe('');
    act(() => {
      vi.advanceTimersByTime(140);
    });
    expect(body.dataset['footerFolding']).toBe('');
    act(() => {
      vi.advanceTimersByTime(140);
    });
    expect(body.hasAttribute('data-footer-folding')).toBe(false);
  });

  it('folds and unfolds at once under reduced motion', () => {
    stubMotion(true);
    const { body, rerender } = renderFoldable(false);
    rerender(true);
    expect(body.dataset['footerFold']).toBe('');
    expect(body.hasAttribute('data-footer-folding')).toBe(false);
    rerender(false);
    expect(body.hasAttribute('data-footer-fold')).toBe(false);
    expect(body.hasAttribute('data-footer-folding')).toBe(false);
  });

  it('keeps following the scroll while folded and after it comes back', () => {
    stubMotion(false);
    const { port, body, rerender } = renderFoldable(false);
    scrollTo(port, 200);
    expect(collapse(body)).toBe('1');
    rerender(true);
    scrollTo(port, 120);
    expect(collapse(body)).toBe('0');
    rerender(false);
    scrollTo(port, 220);
    expect(collapse(body)).toBe('1');
  });

  it('leaves no fold marker and no pending glide behind when it unmounts', () => {
    vi.useFakeTimers();
    stubMotion(false);
    const { body, rerender, unmount } = renderFoldable(false);
    rerender(true);
    unmount();
    expect(body.hasAttribute('data-footer-fold')).toBe(false);
    expect(body.hasAttribute('data-footer-folding')).toBe(false);
    act(() => {
      vi.advanceTimersByTime(280);
    });
    expect(body.hasAttribute('data-footer-folding')).toBe(false);
  });

  it('only renders the switch outside a shell', () => {
    renderWithLocale(<WalletFooterActions onReceive={vi.fn()} onSend={vi.fn()} folded />);
    expect(screen.getByRole('button', { name: 'Receive' })).toBeTruthy();
  });
});
