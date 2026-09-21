import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocaleProvider } from '@/components/LocaleProvider';
import { NoteTranslate } from '@/components/NoteTranslate';
import { NumberFormatProvider } from '@/components/NumberFormatProvider';
import { ThemeProvider } from '@/components/ThemeProvider';
import type { Locale } from '@/lib/locale';
import { getCatalog } from '@/lib/messages';
import { DEFAULT_NUMBER_FORMAT } from '@/lib/number-format';
import { fetchTranslateAvailable, translateNote } from '@/lib/note-translate';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/lib/note-translate', () => ({
  fetchTranslateAvailable: vi.fn(),
  translateNote: vi.fn(),
}));

const german = 'Kann mir jemand diese Woche ein paar Satoshi leihen?';

beforeEach(() => {
  vi.mocked(fetchTranslateAvailable).mockReset();
  vi.mocked(translateNote).mockReset();
  vi.mocked(fetchTranslateAvailable).mockResolvedValue(true);
});

afterEach(cleanup);

describe('NoteTranslate', () => {
  it('renders nothing when translation is unavailable', async () => {
    vi.mocked(fetchTranslateAvailable).mockResolvedValue(false);
    const { container } = renderWithLocale(<NoteTranslate text={german} />);
    await waitFor(() => {
      expect(fetchTranslateAvailable).toHaveBeenCalledTimes(1);
    });
    await act(async () => undefined);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing for empty text even when translation is available', async () => {
    const { container } = renderWithLocale(<NoteTranslate text="" />);
    await waitFor(() => {
      expect(fetchTranslateAvailable).toHaveBeenCalledTimes(1);
    });
    await act(async () => undefined);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing for an English fixture in the English UI', async () => {
    const { container } = renderWithLocale(<NoteTranslate text="Thank you both — that helps." />);
    await waitFor(() => {
      expect(fetchTranslateAvailable).toHaveBeenCalledTimes(1);
    });
    await act(async () => undefined);
    expect(container.firstChild).toBeNull();
  });

  it('ignores availability resolution after unmount', async () => {
    let resolveAvailable: ((available: boolean) => void) | undefined;
    vi.mocked(fetchTranslateAvailable).mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          resolveAvailable = resolve;
        }),
    );
    const { unmount } = renderWithLocale(<NoteTranslate text={german} />);
    await waitFor(() => {
      expect(fetchTranslateAvailable).toHaveBeenCalledTimes(1);
    });
    unmount();
    await act(async () => {
      resolveAvailable?.(true);
    });
  });

  it('shows Translate for the German fixture', async () => {
    renderWithLocale(<NoteTranslate text={german} />);
    expect(
      (await screen.findByRole('button', { name: 'Translate' })).hasAttribute('disabled'),
    ).toBe(false);
  });

  it('disables Translate while a deferred request is loading', async () => {
    let resolveTranslation: ((text: string) => void) | undefined;
    vi.mocked(translateNote).mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveTranslation = resolve;
        }),
    );
    renderWithLocale(<NoteTranslate text={german} />);
    const button = await screen.findByRole('button', { name: 'Translate' });
    fireEvent.click(button);
    expect(button.hasAttribute('disabled')).toBe(true);
    expect(translateNote).toHaveBeenCalledWith(german, 'en');
    await act(async () => {
      resolveTranslation?.('Can anyone lend me a few satoshi this week?');
    });
  });

  it('shows a successful translation and toggles original and translation', async () => {
    vi.mocked(translateNote).mockResolvedValue('Can anyone lend me a few satoshi this week?');
    renderWithLocale(<NoteTranslate text={german} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Translate' }));

    expect(await screen.findByText('Can anyone lend me a few satoshi this week?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Show original' }));
    expect(screen.queryByText('Can anyone lend me a few satoshi this week?')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show translation' }));
    expect(screen.getByText('Can anyone lend me a few satoshi this week?')).toBeTruthy();
  });

  it('autolinks a url in the translated body', async () => {
    vi.mocked(translateNote).mockResolvedValue('See https://example.com/hello');
    renderWithLocale(<NoteTranslate text={german} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Translate' }));
    expect(await screen.findByRole('link', { name: 'https://example.com/hello' })).toBeTruthy();
  });

  it('renders the translated body as plain text when plain', async () => {
    vi.mocked(translateNote).mockResolvedValue('See https://example.com/hello');
    renderWithLocale(<NoteTranslate plain text={german} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Translate' }));
    expect(await screen.findByText('See https://example.com/hello')).toBeTruthy();
    expect(screen.queryByRole('link', { name: /example\.com/ })).toBeNull();
  });

  it('uses button foreground classes when tone is onButton', async () => {
    vi.mocked(translateNote).mockResolvedValue('Can anyone lend me a few satoshi this week?');
    renderWithLocale(<NoteTranslate tone="onButton" text={german} />);
    const translate = await screen.findByRole('button', { name: 'Translate' });
    expect(translate.className).toContain('text-app-btn-fg');
    fireEvent.click(translate);
    const body = await screen.findByText('Can anyone lend me a few satoshi this week?');
    expect(body.closest('p')?.className).toContain('text-app-btn-fg');
    expect(screen.getByRole('button', { name: 'Show original' }).className).toContain(
      'text-app-btn-fg',
    );
  });

  it('truncates a long translation behind Show more', async () => {
    const translated = `${'a'.repeat(280)} TRANSTAIL`;
    vi.mocked(translateNote).mockResolvedValue(translated);
    renderWithLocale(<NoteTranslate text={german} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Translate' }));
    expect(await screen.findByRole('button', { name: 'Show more' })).toBeTruthy();
    expect(screen.queryByText(/TRANSTAIL/)).toBeNull();
    expect(translateNote).toHaveBeenCalledWith(german, 'en');
  });

  it('paints Show more with button foreground on a long onButton translation', async () => {
    const translated = `${'a'.repeat(280)} TRANSTAIL`;
    vi.mocked(translateNote).mockResolvedValue(translated);
    renderWithLocale(<NoteTranslate tone="onButton" text={german} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Translate' }));
    const more = await screen.findByRole('button', { name: 'Show more' });
    const classes = more.className.split(/\s+/);
    expect(classes).toContain('text-app-btn-fg');
    expect(classes).not.toContain('text-app-fg');
  });

  it('paints the error alert with button foreground when tone is onButton', async () => {
    vi.mocked(translateNote).mockRejectedValue(new Error('offline'));
    renderWithLocale(<NoteTranslate tone="onButton" text={german} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Translate' }));
    const classes = (await screen.findByRole('alert')).className.split(/\s+/);
    expect(classes).toContain('text-app-btn-fg');
    expect(classes).not.toContain('text-app-danger');
  });

  it('shows an error and retries successfully', async () => {
    vi.mocked(translateNote)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce('Can anyone lend me a few satoshi this week?');
    renderWithLocale(<NoteTranslate text={german} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Translate' }));

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Could not translate this note. Please try again.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Translate' }));
    expect(await screen.findByText('Can anyone lend me a few satoshi this week?')).toBeTruthy();
    expect(translateNote).toHaveBeenCalledTimes(2);
  });

  it('clears a finished translation when the UI locale changes', async () => {
    vi.mocked(translateNote).mockResolvedValue('Can anyone lend me a few satoshi this week?');
    function tree(locale: Locale): ReactElement {
      return (
        <LocaleProvider locale={locale} messages={getCatalog(locale)}>
          <NumberFormatProvider initial={DEFAULT_NUMBER_FORMAT}>
            <ThemeProvider>
              <NoteTranslate text={german} />
            </ThemeProvider>
          </NumberFormatProvider>
        </LocaleProvider>
      );
    }
    const { rerender } = render(tree('en'));
    fireEvent.click(await screen.findByRole('button', { name: 'Translate' }));
    expect(await screen.findByText('Can anyone lend me a few satoshi this week?')).toBeTruthy();
    rerender(tree('es'));
    expect(screen.queryByText('Can anyone lend me a few satoshi this week?')).toBeNull();
    expect(await screen.findByRole('button', { name: 'Traducir' })).toBeTruthy();
  });

  it('ignores in-flight success and failure after the UI locale changes', async () => {
    let resolveTranslation: ((text: string) => void) | undefined;
    let rejectTranslation: ((error: Error) => void) | undefined;
    vi.mocked(translateNote)
      .mockImplementationOnce(
        () =>
          new Promise<string>((resolve) => {
            resolveTranslation = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<string>((_resolve, reject) => {
            rejectTranslation = reject;
          }),
      );
    function tree(locale: Locale): ReactElement {
      return (
        <LocaleProvider locale={locale} messages={getCatalog(locale)}>
          <NumberFormatProvider initial={DEFAULT_NUMBER_FORMAT}>
            <ThemeProvider>
              <NoteTranslate text={german} />
            </ThemeProvider>
          </NumberFormatProvider>
        </LocaleProvider>
      );
    }
    const { rerender } = render(tree('en'));
    fireEvent.click(await screen.findByRole('button', { name: 'Translate' }));
    rerender(tree('es'));
    await act(async () => {
      resolveTranslation?.('stale success');
    });
    expect(screen.queryByText('stale success')).toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: 'Traducir' }));
    rerender(tree('en'));
    await act(async () => {
      rejectTranslation?.(new Error('stale failure'));
    });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(await screen.findByRole('button', { name: 'Translate' })).toBeTruthy();
  });

  it('clears a finished translation when the note text changes', async () => {
    const otherGerman = 'Bitte hilf mir diese Woche mit ein paar Satoshi.';
    vi.mocked(translateNote).mockResolvedValue('Can anyone lend me a few satoshi this week?');
    const { rerender } = renderWithLocale(<NoteTranslate text={german} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Translate' }));
    expect(await screen.findByText('Can anyone lend me a few satoshi this week?')).toBeTruthy();
    rerender(<NoteTranslate text={otherGerman} />);
    expect(screen.queryByText('Can anyone lend me a few satoshi this week?')).toBeNull();
    expect(await screen.findByRole('button', { name: 'Translate' })).toBeTruthy();
  });

  it('ignores in-flight success after the note text changes', async () => {
    const otherGerman = 'Bitte hilf mir diese Woche mit ein paar Satoshi.';
    let resolveTranslation: ((text: string) => void) | undefined;
    vi.mocked(translateNote).mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          resolveTranslation = resolve;
        }),
    );
    const { rerender } = renderWithLocale(<NoteTranslate text={german} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Translate' }));
    rerender(<NoteTranslate text={otherGerman} />);
    await act(async () => {
      resolveTranslation?.('stale success');
    });
    expect(screen.queryByText('stale success')).toBeNull();
    expect(await screen.findByRole('button', { name: 'Translate' })).toBeTruthy();
  });

  it('stops click and keydown events at its wrapper', async () => {
    const onClick = vi.fn();
    const onKeyDown = vi.fn();
    function Parent(): ReactElement {
      return (
        <div onClick={onClick} onKeyDown={onKeyDown}>
          <NoteTranslate text={german} />
        </div>
      );
    }
    renderWithLocale(<Parent />);
    const button = await screen.findByRole('button', { name: 'Translate' });
    const wrapper = button.parentElement;
    expect(wrapper).not.toBeNull();
    if (wrapper === null) {
      return;
    }
    fireEvent.click(wrapper);
    fireEvent.keyDown(wrapper, { key: 'Enter' });
    expect(onClick).not.toHaveBeenCalled();
    expect(onKeyDown).not.toHaveBeenCalled();
  });
});
