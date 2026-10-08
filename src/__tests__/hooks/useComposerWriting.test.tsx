import { act, cleanup, fireEvent, render, renderHook } from '@testing-library/react';
import { createRef, useRef, type ReactElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShellContext, type AppShellWriting } from '@/components/AppShell';
import { useComposerWriting, type ComposerWriting } from '@/hooks/useComposerWriting';

/** `matchMedia` answering a coarse pointer and reduced motion as given. */
function stubMedia(options: { coarse: boolean; reduced?: boolean }): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query.includes('pointer: coarse')
        ? options.coarse
        : query.includes('prefers-reduced-motion')
          ? options.reduced === true
          : false,
    })),
  );
}

function shell(setWriting: (writing: AppShellWriting) => void) {
  return function Shell({ children }: { children: ReactNode }): ReactElement {
    return (
      <AppShellContext.Provider value={{ setWriting } as never}>
        {children}
      </AppShellContext.Provider>
    );
  };
}

/** A composer form wired to the hook, inside a scrollport, with a field outside it. */
function Composer({
  enabled = true,
  active = true,
  onState,
}: {
  enabled?: boolean;
  active?: boolean;
  onState: (state: ComposerWriting) => void;
}): ReactElement {
  const formRef = useRef<HTMLFormElement>(null);
  const state = useComposerWriting(enabled, active, formRef);
  onState(state);
  return (
    <div data-scrollport>
      <form
        ref={formRef}
        onFocus={state.onComposerFocus}
        onBlur={state.onComposerBlur}
        onPointerDown={state.onComposerPointerDown}
      >
        <textarea aria-label="Your message" />
        <button type="button">Attach</button>
        <ul role="listbox">
          <li>
            <button type="button">@ada</button>
          </li>
        </ul>
        <span>Hint</span>
      </form>
      <input aria-label="Elsewhere" />
    </div>
  );
}

function renderComposer(
  props: { enabled?: boolean; active?: boolean } = {},
  setWriting: (writing: AppShellWriting) => void = vi.fn(),
) {
  const states: ComposerWriting[] = [];
  const Wrapper = shell(setWriting);
  const view = render(
    <Wrapper>
      <Composer {...props} onState={(state) => states.push(state)} />
    </Wrapper>,
  );
  const field = view.getByRole('textbox', { name: 'Your message' });
  return {
    ...view,
    field,
    latest: (): ComposerWriting => states.at(-1)!,
    Wrapper,
  };
}

beforeEach(() => {
  stubMedia({ coarse: true });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useComposerWriting', () => {
  it('does nothing on a fine pointer: no touch, no writing, the shell untouched', () => {
    stubMedia({ coarse: false });
    const setWriting = vi.fn();
    const { field, latest } = renderComposer({}, setWriting);
    fireEvent.focus(field);
    expect(latest().touch).toBe(false);
    expect(latest().writing).toBe(false);
    expect(setWriting).not.toHaveBeenCalled();
  });

  it('does nothing when not enabled, even on a touch device', () => {
    const matchMedia = vi.fn(() => ({ matches: true }));
    vi.stubGlobal('matchMedia', matchMedia);
    const setWriting = vi.fn();
    const { field, latest } = renderComposer({ enabled: false }, setWriting);
    fireEvent.focus(field);
    expect(latest().touch).toBe(false);
    expect(latest().writing).toBe(false);
    expect(setWriting).not.toHaveBeenCalled();
    expect(matchMedia).not.toHaveBeenCalled();
  });

  it('turns on when the text field takes the focus and off when the focus leaves the composer', () => {
    const setWriting = vi.fn();
    const { field, latest, getByRole } = renderComposer({}, setWriting);
    expect(latest().touch).toBe(true);
    expect(setWriting).toHaveBeenLastCalledWith('ready');

    fireEvent.focus(field);
    expect(latest().writing).toBe(true);
    expect(setWriting).toHaveBeenLastCalledWith('on');

    // Focus moving inside the composer keeps writing mode.
    const attach = getByRole('button', { name: 'Attach' });
    fireEvent.blur(field, { relatedTarget: attach });
    expect(latest().writing).toBe(true);

    fireEvent.blur(attach, { relatedTarget: getByRole('textbox', { name: 'Elsewhere' }) });
    expect(latest().writing).toBe(false);
    expect(setWriting).toHaveBeenLastCalledWith('ready');
  });

  it('turns on only for the text field, and off when nothing takes the focus', () => {
    const { field, latest, getByRole } = renderComposer();
    fireEvent.focus(getByRole('button', { name: 'Attach' }));
    expect(latest().writing).toBe(false);
    fireEvent.focus(field);
    expect(latest().writing).toBe(true);
    fireEvent.blur(field);
    expect(latest().writing).toBe(false);
  });

  it('ignores a text field outside the composer that bubbles through it', () => {
    const outer = createRef<HTMLFormElement>();
    const { result } = renderHook(() => useComposerWriting(true, true, outer), {
      wrapper: shell(vi.fn()),
    });
    const form = document.createElement('form');
    const stray = document.createElement('textarea');
    act(() => {
      result.current.onComposerFocus({
        target: stray,
        currentTarget: form,
      } as unknown as Parameters<ComposerWriting['onComposerFocus']>[0]);
    });
    expect(result.current.writing).toBe(false);
  });

  it('ends writing mode while the field is inactive and does not come back by itself', () => {
    const states: ComposerWriting[] = [];
    const Wrapper = shell(vi.fn());
    const view = render(
      <Wrapper>
        <Composer onState={(state) => states.push(state)} />
      </Wrapper>,
    );
    fireEvent.focus(view.getByRole('textbox', { name: 'Your message' }));
    expect(states.at(-1)!.writing).toBe(true);
    view.rerender(
      <Wrapper>
        <Composer active={false} onState={(state) => states.push(state)} />
      </Wrapper>,
    );
    expect(states.at(-1)!.writing).toBe(false);
    view.rerender(
      <Wrapper>
        <Composer onState={(state) => states.push(state)} />
      </Wrapper>,
    );
    expect(states.at(-1)!.writing).toBe(false);
  });

  it('starts writing mode for a field that was focused before the pointer was known', () => {
    function Early({ onState }: { onState: (state: ComposerWriting) => void }): ReactElement {
      const formRef = useRef<HTMLFormElement>(null);
      const state = useComposerWriting(true, true, formRef);
      onState(state);
      return (
        <form ref={formRef} onFocus={state.onComposerFocus}>
          {/* Focused by the browser at mount, before the pointer effect ran. */}
          <textarea aria-label="Early" autoFocus />
        </form>
      );
    }
    const states: ComposerWriting[] = [];
    const Wrapper = shell(vi.fn());
    render(
      <Wrapper>
        <Early onState={(state) => states.push(state)} />
      </Wrapper>,
    );
    expect(states.at(-1)!.writing).toBe(true);
  });

  it('leaves writing mode off when the focused field is outside the composer', () => {
    const outside = document.createElement('textarea');
    document.body.appendChild(outside);
    outside.focus();
    const { latest } = renderComposer();
    expect(latest().touch).toBe(true);
    expect(latest().writing).toBe(false);
    outside.remove();
  });

  it('sets the shell off on unmount', () => {
    const setWriting = vi.fn();
    const { unmount } = renderComposer({}, setWriting);
    expect(setWriting).toHaveBeenLastCalledWith('ready');
    unmount();
    expect(setWriting).toHaveBeenLastCalledWith('off');
  });

  it('works without an AppShell', () => {
    const ref = createRef<HTMLFormElement>();
    const { result } = renderHook(() => useComposerWriting(true, true, ref));
    expect(result.current.touch).toBe(true);
  });

  it('keeps the field focused on a press of a composer button while writing, not on a suggestion or text', () => {
    const { field, latest, getByRole, getByText } = renderComposer();
    const attach = getByRole('button', { name: 'Attach' });
    // Not writing yet: the press is left alone.
    expect(fireEvent.pointerDown(attach)).toBe(true);

    fireEvent.focus(field);
    expect(latest().writing).toBe(true);
    expect(fireEvent.pointerDown(attach)).toBe(false);
    expect(fireEvent.pointerDown(getByRole('button', { name: '@ada' }))).toBe(true);
    expect(fireEvent.pointerDown(getByText('Hint'))).toBe(true);
    expect(fireEvent.pointerDown(field)).toBe(true);
  });

  it('leaves a press alone when its target is no element or its button is outside the composer', () => {
    const { field, latest } = renderComposer();
    fireEvent.focus(field);
    const form = document.createElement('form');
    const outside = document.createElement('button');
    const preventDefault = vi.fn();
    latest().onComposerPointerDown({
      target: outside,
      currentTarget: form,
      preventDefault,
    } as unknown as Parameters<ComposerWriting['onComposerPointerDown']>[0]);
    latest().onComposerPointerDown({
      target: document,
      currentTarget: form,
      preventDefault,
    } as unknown as Parameters<ComposerWriting['onComposerPointerDown']>[0]);
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it('settles the composer just under the header after the 250 ms fold, smoothly', () => {
    vi.useFakeTimers();
    const { field, container } = renderComposer();
    const port = container.querySelector('[data-scrollport]') as HTMLElement;
    const form = container.querySelector('form') as HTMLFormElement;
    port.scrollTop = 40;
    port.getBoundingClientRect = () => ({ top: 60 }) as DOMRect;
    form.getBoundingClientRect = () => ({ top: 300 }) as DOMRect;
    const scrollTo = vi.fn();
    port.scrollTo = scrollTo as typeof port.scrollTo;

    fireEvent.focus(field);
    vi.advanceTimersByTime(249);
    expect(scrollTo).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(scrollTo).toHaveBeenCalledWith({ top: 40 + 300 - 60 - 8, behavior: 'smooth' });
  });

  it('settles at once and without a smooth scroll under reduced motion', () => {
    vi.useFakeTimers();
    stubMedia({ coarse: true, reduced: true });
    const { field, container } = renderComposer();
    const port = container.querySelector('[data-scrollport]') as HTMLElement;
    const scrollTo = vi.fn();
    port.scrollTo = scrollTo as typeof port.scrollTo;
    fireEvent.focus(field);
    vi.advanceTimersByTime(0);
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'auto' }));
  });

  it('cancels a pending settle when writing ends first', () => {
    vi.useFakeTimers();
    const { field, container } = renderComposer();
    const port = container.querySelector('[data-scrollport]') as HTMLElement;
    const scrollTo = vi.fn();
    port.scrollTo = scrollTo as typeof port.scrollTo;
    fireEvent.focus(field);
    fireEvent.blur(field);
    vi.advanceTimersByTime(500);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('settles nothing when the composer is gone or has no scrollport', () => {
    vi.useFakeTimers();
    const detached = { current: null as HTMLElement | null };
    const { result } = renderHook(() => useComposerWriting(true, true, detached), {
      wrapper: shell(vi.fn()),
    });
    const form = document.createElement('form');
    const field = document.createElement('textarea');
    form.appendChild(field);
    act(() => {
      result.current.onComposerFocus({
        target: field,
        currentTarget: form,
      } as unknown as Parameters<ComposerWriting['onComposerFocus']>[0]);
    });
    expect(result.current.writing).toBe(true);
    act(() => {
      vi.advanceTimersByTime(250);
    });
    detached.current = form;
    act(() => {
      result.current.onComposerBlur({
        relatedTarget: null,
        currentTarget: form,
      } as unknown as Parameters<ComposerWriting['onComposerBlur']>[0]);
    });
    act(() => {
      result.current.onComposerFocus({
        target: field,
        currentTarget: form,
      } as unknown as Parameters<ComposerWriting['onComposerFocus']>[0]);
    });
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(result.current.writing).toBe(true);
  });
});
