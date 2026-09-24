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
import {
  fetchTranslateAvailable,
  translateConversationMessage,
  translateNote,
} from '@/lib/note-translate';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/lib/note-translate', () => ({
  fetchTranslateAvailable: vi.fn(),
  translateConversationMessage: vi.fn(),
  translateNote: vi.fn(),
}));

const german = 'Kann mir jemand diese Woche ein paar Satoshi leihen?';
const NOTE_ID = '3a3a3a3a-3a3a-43a3-83a3-3a3a3a3a3a3a';
const CONVERSATION_ID = '4b4b4b4b-4b4b-44b4-84b4-4b4b4b4b4b4b';
const translated = 'Can anyone lend me a few satoshi this week?';

beforeEach(() => {
  vi.mocked(fetchTranslateAvailable).mockReset();
  vi.mocked(translateConversationMessage).mockReset();
  vi.mocked(translateNote).mockReset();
  vi.mocked(fetchTranslateAvailable).mockResolvedValue(true);
  useAuthStore.setState({ session: null, account: null, wrongAccount: false });
});

afterEach(cleanup);

describe('NoteTranslate', () => {
  it('renders nothing when translation is unavailable', async () => {
    vi.mocked(fetchTranslateAvailable).mockResolvedValue(false);
    const { container } = renderWithLocale(<NoteTranslate messageId={NOTE_ID} text={german} />);
    await waitFor(() => {
      expect(fetchTranslateAvailable).toHaveBeenCalledTimes(1);
    });
    await act(async () => undefined);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing for empty text even when translation is available', async () => {
    const { container } = renderWithLocale(<NoteTranslate messageId={NOTE_ID} text="" />);
    await waitFor(() => {
      expect(fetchTranslateAvailable).toHaveBeenCalledTimes(1);
    });
    await act(async () => undefined);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing for an English fixture in the English UI', async () => {
    const { container } = renderWithLocale(
      <NoteTranslate messageId={NOTE_ID} text="Thank you both — that helps." />,
    );
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
    const { unmount } = renderWithLocale(<NoteTranslate messageId={NOTE_ID} text={german} />);
    await waitFor(() => {
      expect(fetchTranslateAvailable).toHaveBeenCalledTimes(1);
    });
    unmount();
    await act(async () => {
      resolveAvailable?.(true);
    });
  });

  it('shows Translate for the German fixture', async () => {
    renderWithLocale(<NoteTranslate messageId={NOTE_ID} text={german} />);
    expect(
      (await screen.findByRole('button', { name: 'Translate' })).hasAttribute('disabled'),
    ).toBe(false);
    expect(screen.queryByText('Translate')).toBeNull();
  });

  it('disables Translate while a deferred request is loading', async () => {
    let resolveTranslation: ((text: string) => void) | undefined;
    vi.mocked(translateNote).mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveTranslation = resolve;
        }),
    );
    renderWithLocale(<NoteTranslate messageId={NOTE_ID} text={german} />);
    const button = await screen.findByRole('button', { name: 'Translate' });
    fireEvent.click(button);
    expect(button.hasAttribute('disabled')).toBe(true);
    expect(translateNote).toHaveBeenCalledWith(NOTE_ID, 'en', null);
    await act(async () => {
      resolveTranslation?.(translated);
    });
  });

  it('passes the session token to translateNote when signed in', async () => {
    useAuthStore.setState({ session: 'tok', account: null, wrongAccount: false });
    vi.mocked(translateNote).mockResolvedValue(translated);
    const onTranslated = vi.fn();
    renderWithLocale(
      <NoteTranslate messageId={NOTE_ID} text={german} onTranslated={onTranslated} />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Translate' }));
    expect(translateNote).toHaveBeenCalledWith(NOTE_ID, 'en', 'tok');
    expect(translateConversationMessage).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(onTranslated).toHaveBeenCalledWith(translated);
    });
  });

  it('uses the conversation source with a signed-in session and returns only its text', async () => {
    useAuthStore.setState({ session: 'tok', account: null, wrongAccount: false });
    vi.mocked(translateConversationMessage).mockResolvedValue({
      translatedText: translated,
      cached: true,
    });
    const onTranslated = vi.fn();
    renderWithLocale(
      <NoteTranslate
        messageId={NOTE_ID}
        text={german}
        source={{ kind: 'conversation', conversationId: CONVERSATION_ID }}
        onTranslated={onTranslated}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Translate' }));
    expect(translateConversationMessage).toHaveBeenCalledWith(
      CONVERSATION_ID,
      NOTE_ID,
      'en',
      'tok',
    );
    expect(translateNote).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(onTranslated).toHaveBeenCalledWith(translated);
    });
  });

  it('uses an empty conversation session when signed out', async () => {
    vi.mocked(translateConversationMessage).mockResolvedValue({
      translatedText: translated,
      cached: false,
    });
    renderWithLocale(
      <NoteTranslate
        messageId={NOTE_ID}
        text={german}
        source={{ kind: 'conversation', conversationId: CONVERSATION_ID }}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Translate' }));
    expect(translateConversationMessage).toHaveBeenCalledWith(CONVERSATION_ID, NOTE_ID, 'en', '');
  });

  it('shows the shared translation error for a failed conversation request', async () => {
    vi.mocked(translateConversationMessage).mockRejectedValue(new Error('offline'));
    renderWithLocale(
      <NoteTranslate
        messageId={NOTE_ID}
        text={german}
        source={{ kind: 'conversation', conversationId: CONVERSATION_ID }}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Translate' }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Could not translate this note. Please try again.',
    );
  });

  it('does not render the translated body', async () => {
    vi.mocked(translateNote).mockResolvedValue(translated);
    const onTranslated = vi.fn();
    renderWithLocale(
      <NoteTranslate
        messageId={NOTE_ID}
        text={german}
        showingTranslation
        onTranslated={onTranslated}
        onToggleShowing={() => undefined}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Translate' }));
    await waitFor(() => {
      expect(onTranslated).toHaveBeenCalledWith(translated);
    });
    expect(screen.queryByText(translated)).toBeNull();
    expect(screen.getByRole('button', { name: 'Show original' })).toBeTruthy();
  });

  it('drops stacked margin when placement is row', async () => {
    renderWithLocale(<NoteTranslate messageId={NOTE_ID} text={german} placement="row" />);
    const translate = await screen.findByRole('button', { name: 'Translate' });
    expect(translate.className.split(/\s+/)).not.toContain('mt-2');
  });

  it('puts the error on its own flex line when placement is row', async () => {
    vi.mocked(translateNote).mockRejectedValue(new Error('offline'));
    renderWithLocale(<NoteTranslate messageId={NOTE_ID} text={german} placement="row" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Translate' }));
    const classes = (await screen.findByRole('alert')).className.split(/\s+/);
    expect(classes).toContain('order-last');
    expect(classes).toContain('basis-full');
    expect(classes).toContain('w-full');
  });

  it('keeps onButton colour without stacked margin in a row', async () => {
    renderWithLocale(
      <NoteTranslate messageId={NOTE_ID} text={german} tone="onButton" placement="row" />,
    );
    const translate = await screen.findByRole('button', { name: 'Translate' });
    expect(translate.className).toContain('text-app-btn-fg');
    expect(translate.className.split(/\s+/)).not.toContain('mt-2');
  });

  it('uses button foreground classes when tone is onButton', async () => {
    renderWithLocale(<NoteTranslate messageId={NOTE_ID} tone="onButton" text={german} />);
    const translate = await screen.findByRole('button', { name: 'Translate' });
    expect(translate.className).toContain('text-app-btn-fg');
  });

  it('paints the error alert with button foreground when tone is onButton', async () => {
    vi.mocked(translateNote).mockRejectedValue(new Error('offline'));
    renderWithLocale(<NoteTranslate messageId={NOTE_ID} tone="onButton" text={german} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Translate' }));
    const classes = (await screen.findByRole('alert')).className.split(/\s+/);
    expect(classes).toContain('text-app-btn-fg');
    expect(classes).not.toContain('text-app-danger');
  });

  it('shows an error and retries successfully', async () => {
    vi.mocked(translateNote)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(translated);
    const onTranslated = vi.fn();
    renderWithLocale(
      <NoteTranslate messageId={NOTE_ID} text={german} onTranslated={onTranslated} />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Translate' }));

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Could not translate this note. Please try again.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Translate' }));
    await waitFor(() => {
      expect(onTranslated).toHaveBeenCalledWith(translated);
    });
    expect(translateNote).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('button', { name: 'Show translation' })).toBeTruthy();
  });

  it('clears a finished translation when the UI locale changes', async () => {
    vi.mocked(translateNote).mockResolvedValue(translated);
    function tree(locale: Locale): ReactElement {
      return (
        <LocaleProvider locale={locale} messages={getCatalog(locale)}>
          <NumberFormatProvider initial={DEFAULT_NUMBER_FORMAT}>
            <ThemeProvider>
              <NoteTranslate messageId={NOTE_ID} text={german} showingTranslation />
            </ThemeProvider>
          </NumberFormatProvider>
        </LocaleProvider>
      );
    }
    const { rerender } = render(tree('en'));
    fireEvent.click(await screen.findByRole('button', { name: 'Translate' }));
    expect(await screen.findByRole('button', { name: 'Show original' })).toBeTruthy();
    rerender(tree('es'));
    expect(screen.queryByRole('button', { name: 'Show original' })).toBeNull();
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
              <NoteTranslate messageId={NOTE_ID} text={german} />
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
    vi.mocked(translateNote).mockResolvedValue(translated);
    const { rerender } = renderWithLocale(
      <NoteTranslate messageId={NOTE_ID} text={german} showingTranslation />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Translate' }));
    expect(await screen.findByRole('button', { name: 'Show original' })).toBeTruthy();
    rerender(<NoteTranslate messageId={NOTE_ID} text={otherGerman} showingTranslation />);
    expect(screen.queryByRole('button', { name: 'Show original' })).toBeNull();
    expect(await screen.findByRole('button', { name: 'Translate' })).toBeTruthy();
  });

  it('clears a finished translation when the message id changes', async () => {
    const otherId = '4b4b4b4b-4b4b-44b4-84b4-4b4b4b4b4b4b';
    vi.mocked(translateNote).mockResolvedValue(translated);
    const { rerender } = renderWithLocale(
      <NoteTranslate messageId={NOTE_ID} text={german} showingTranslation />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Translate' }));
    expect(await screen.findByRole('button', { name: 'Show original' })).toBeTruthy();
    rerender(<NoteTranslate messageId={otherId} text={german} showingTranslation />);
    expect(screen.queryByRole('button', { name: 'Show original' })).toBeNull();
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
    const { rerender } = renderWithLocale(<NoteTranslate messageId={NOTE_ID} text={german} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Translate' }));
    rerender(<NoteTranslate messageId={NOTE_ID} text={otherGerman} />);
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
          <NoteTranslate messageId={NOTE_ID} text={german} />
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
