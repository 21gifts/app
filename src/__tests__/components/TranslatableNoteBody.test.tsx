import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocaleProvider } from '@/components/LocaleProvider';
import { TranslatableNoteBody } from '@/components/TranslatableNoteBody';
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
const NOTE_ID = '3a3a3a3a-3a3a-43a3-83a3-3a3a3a3a3a3a';
const translated = 'Can anyone lend me a few satoshi this week?';

beforeEach(() => {
  vi.mocked(fetchTranslateAvailable).mockReset();
  vi.mocked(translateNote).mockReset();
  vi.mocked(fetchTranslateAvailable).mockResolvedValue(true);
});

afterEach(cleanup);

describe('TranslatableNoteBody', () => {
  it('returns an empty container when text is empty', () => {
    const { container } = renderWithLocale(<TranslatableNoteBody messageId={NOTE_ID} text="" />);
    expect(container.firstChild).toBeNull();
  });

  it('applies formatTranslated only to the visible translation', async () => {
    vi.mocked(translateNote).mockResolvedValue(translated);
    renderWithLocale(
      <TranslatableNoteBody
        messageId={NOTE_ID}
        text={german}
        truncate={false}
        formatTranslated={(next) => next.replace('satoshi', 'sats')}
      />,
    );
    expect(await screen.findByText(german)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Translate' }));
    expect(await screen.findByText('Can anyone lend me a few sats this week?')).toBeTruthy();
    expect(screen.queryByText(translated)).toBeNull();
    expect(screen.queryByText(german)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show original' }));
    expect(screen.getByText(german)).toBeTruthy();
    expect(screen.queryByText('Can anyone lend me a few sats this week?')).toBeNull();
  });

  it('shows the translation as returned when formatTranslated is omitted', async () => {
    vi.mocked(translateNote).mockResolvedValue(translated);
    renderWithLocale(<TranslatableNoteBody messageId={NOTE_ID} text={german} truncate={false} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Translate' }));
    expect(await screen.findByText(translated)).toBeTruthy();
    expect(screen.queryByText(german)).toBeNull();
  });

  it('shows a successful translation and toggles original and translation', async () => {
    vi.mocked(translateNote).mockResolvedValue(translated);
    renderWithLocale(<TranslatableNoteBody messageId={NOTE_ID} text={german} truncate={false} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Translate' }));

    expect(await screen.findByText(translated)).toBeTruthy();
    expect(screen.queryByText(german)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show original' }));
    expect(screen.getByText(german)).toBeTruthy();
    expect(screen.queryByText(translated)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show translation' }));
    expect(screen.getByText(translated)).toBeTruthy();
    expect(screen.queryByText(german)).toBeNull();
  });

  it('replaces the original body while the translation is shown', async () => {
    vi.mocked(translateNote).mockResolvedValue(translated);
    renderWithLocale(<TranslatableNoteBody messageId={NOTE_ID} text={german} truncate={false} />);
    expect(await screen.findByText(german)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Translate' }));
    expect(await screen.findByText(translated)).toBeTruthy();
    expect(screen.queryByText(german)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show original' }));
    expect(screen.getByText(german)).toBeTruthy();
    expect(screen.queryByText(translated)).toBeNull();
  });

  it('autolinks a url in the translated body', async () => {
    vi.mocked(translateNote).mockResolvedValue('See https://example.com/hello');
    renderWithLocale(<TranslatableNoteBody messageId={NOTE_ID} text={german} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Translate' }));
    expect(await screen.findByRole('link', { name: 'https://example.com/hello' })).toBeTruthy();
  });

  it('renders the translated body as plain text when plain', async () => {
    vi.mocked(translateNote).mockResolvedValue('See https://example.com/hello');
    renderWithLocale(<TranslatableNoteBody messageId={NOTE_ID} plain text={german} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Translate' }));
    expect(await screen.findByText('See https://example.com/hello')).toBeTruthy();
    expect(screen.queryByRole('link', { name: /example\.com/ })).toBeNull();
  });

  it('uses button foreground classes when className is on-button', async () => {
    vi.mocked(translateNote).mockResolvedValue(translated);
    renderWithLocale(
      <TranslatableNoteBody
        messageId={NOTE_ID}
        text={german}
        className="whitespace-pre-wrap text-sm text-app-btn-fg"
      />,
    );
    const translate = await screen.findByRole('button', { name: 'Translate' });
    expect(translate.className).toContain('text-app-btn-fg');
    fireEvent.click(translate);
    const body = await screen.findByText(translated);
    expect(body.closest('p')?.className).toContain('text-app-btn-fg');
    expect(screen.getByRole('button', { name: 'Show original' }).className).toContain(
      'text-app-btn-fg',
    );
  });

  it('truncates a long translation behind Show more', async () => {
    const longTranslated = `${'a'.repeat(280)} TRANSTAIL`;
    vi.mocked(translateNote).mockResolvedValue(longTranslated);
    renderWithLocale(<TranslatableNoteBody messageId={NOTE_ID} text={german} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Translate' }));
    expect(await screen.findByRole('button', { name: 'Show more' })).toBeTruthy();
    expect(screen.queryByText(/TRANSTAIL/)).toBeNull();
    expect(translateNote).toHaveBeenCalledWith(NOTE_ID, 'en', null);
  });

  it('paints Show more with button foreground on a long on-button translation', async () => {
    const longTranslated = `${'a'.repeat(280)} TRANSTAIL`;
    vi.mocked(translateNote).mockResolvedValue(longTranslated);
    renderWithLocale(
      <TranslatableNoteBody
        messageId={NOTE_ID}
        text={german}
        className="whitespace-pre-wrap text-sm text-app-btn-fg"
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Translate' }));
    const more = await screen.findByRole('button', { name: 'Show more' });
    const classes = more.className.split(/\s+/);
    expect(classes).toContain('text-app-btn-fg');
    expect(classes).not.toContain('text-app-fg');
  });

  it('shows an error and retries successfully', async () => {
    vi.mocked(translateNote)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(translated);
    renderWithLocale(<TranslatableNoteBody messageId={NOTE_ID} text={german} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Translate' }));

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Could not translate this note. Please try again.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Translate' }));
    expect(await screen.findByText(translated)).toBeTruthy();
    expect(screen.queryByText(german)).toBeNull();
    expect(translateNote).toHaveBeenCalledTimes(2);
  });

  it('clears a finished translation when the UI locale changes', async () => {
    vi.mocked(translateNote).mockResolvedValue(translated);
    function tree(locale: Locale): ReactElement {
      return (
        <LocaleProvider locale={locale} messages={getCatalog(locale)}>
          <NumberFormatProvider initial={DEFAULT_NUMBER_FORMAT}>
            <ThemeProvider>
              <TranslatableNoteBody messageId={NOTE_ID} text={german} truncate={false} />
            </ThemeProvider>
          </NumberFormatProvider>
        </LocaleProvider>
      );
    }
    const { rerender } = render(tree('en'));
    fireEvent.click(await screen.findByRole('button', { name: 'Translate' }));
    expect(await screen.findByText(translated)).toBeTruthy();
    rerender(tree('es'));
    expect(screen.queryByText(translated)).toBeNull();
    expect(screen.getByText(german)).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'Traducir' })).toBeTruthy();
  });

  it('clears a finished translation when the note text changes', async () => {
    const otherGerman = 'Bitte hilf mir diese Woche mit ein paar Satoshi.';
    vi.mocked(translateNote).mockResolvedValue(translated);
    const { rerender } = renderWithLocale(
      <TranslatableNoteBody messageId={NOTE_ID} text={german} truncate={false} />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Translate' }));
    expect(await screen.findByText(translated)).toBeTruthy();
    rerender(<TranslatableNoteBody messageId={NOTE_ID} text={otherGerman} truncate={false} />);
    expect(screen.queryByText(translated)).toBeNull();
    expect(screen.getByText(otherGerman)).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'Translate' })).toBeTruthy();
  });

  it('clears a finished translation when the message id changes', async () => {
    const otherId = '4b4b4b4b-4b4b-44b4-84b4-4b4b4b4b4b4b';
    vi.mocked(translateNote).mockResolvedValue(translated);
    const { rerender } = renderWithLocale(
      <TranslatableNoteBody messageId={NOTE_ID} text={german} truncate={false} />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Translate' }));
    expect(await screen.findByText(translated)).toBeTruthy();
    rerender(<TranslatableNoteBody messageId={otherId} text={german} truncate={false} />);
    expect(screen.queryByText(translated)).toBeNull();
    expect(screen.getByText(german)).toBeTruthy();
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
    const { rerender } = renderWithLocale(
      <TranslatableNoteBody messageId={NOTE_ID} text={german} truncate={false} />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Translate' }));
    rerender(<TranslatableNoteBody messageId={NOTE_ID} text={otherGerman} truncate={false} />);
    await act(async () => {
      resolveTranslation?.('stale success');
    });
    expect(screen.queryByText('stale success')).toBeNull();
    expect(screen.getByText(otherGerman)).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'Translate' })).toBeTruthy();
  });
});
