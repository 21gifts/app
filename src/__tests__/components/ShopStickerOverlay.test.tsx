import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShopStickerOverlay } from '@/components/ShopStickerOverlay';
import { renderWithLocale } from '@/__tests__/render-with-locale';
import type { Locale } from '@/lib/locale';
import { buildShopStickerSvg, shopStickerBlob } from '@/lib/shop-sticker';

vi.mock('@/lib/shop-sticker', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/shop-sticker')>();
  return { ...actual, shopStickerBlob: vi.fn() };
});

const QR =
  'https://21.gifts/pl/?lightning=LNURL1DP68GURN8GHJ7V339ENKJEN5WVHJUAM9D3KZ66MWDAMKUTMVDE6HYMRS9A3KZUN0DS7CX370';

let clicked: { href: string; download: string }[];

beforeEach(() => {
  clicked = [];
  vi.useFakeTimers();
  // jsdom has no object URLs; define them so they can be spied on
  for (const name of ['createObjectURL', 'revokeObjectURL'] as const) {
    Object.defineProperty(URL, name, { configurable: true, writable: true, value: () => '' });
  }
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:sticker');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    clicked.push({ href: this.href, download: this.download });
  });
  vi.mocked(shopStickerBlob).mockResolvedValue(new Blob(['file']));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  window.history.pushState(null, '', '/');
});

function renderOverlay(onClose = vi.fn(), locale: Locale = 'en'): ReturnType<typeof vi.fn> {
  renderWithLocale(
    <ShopStickerOverlay qrValue={QR} handle="carol@21.gifts" onClose={onClose} />,
    locale,
  );
  return onClose;
}

function languageMenu(): HTMLElement {
  return screen.getByRole('combobox', { name: 'Second language' });
}

describe('ShopStickerOverlay', () => {
  it('shows the title, lead, SVG preview, format choice, and labeled Download', () => {
    renderOverlay();
    const dialog = screen.getByRole('dialog', { name: 'Shop sticker' });
    expect(dialog.className).toContain('bg-app-overlay');
    expect(screen.getByRole('heading', { name: 'Shop sticker' })).toBeTruthy();
    expect(
      screen.getByText('Print it for a shop window. The QR code pays carol@21.gifts.'),
    ).toBeTruthy();
    const preview = screen.getByRole('img', { name: 'Shop sticker preview for carol@21.gifts' });
    expect(preview.getAttribute('src')?.startsWith('data:image/svg+xml;charset=utf-8,%3Csvg')).toBe(
      true,
    );
    const group = screen.getByRole('group', { name: 'File format' });
    for (const label of ['PDF', 'PNG', 'JPG', 'SVG']) {
      expect(group.textContent).toContain(label);
    }
    expect(screen.getByRole('button', { name: 'Download' })).toBeTruthy();
    const language = screen.getByRole('combobox', { name: 'Second language' });
    expect(language.textContent).toContain('None (English only)');
    const src = preview.getAttribute('src') ?? '';
    expect(decodeURIComponent(src.slice(src.indexOf(',') + 1))).toBe(
      buildShopStickerSvg(QR, 'english'),
    );
    expect(language.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('downloads the PDF by default under the member file name and frees the URL later', async () => {
    renderOverlay();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Download' }));
    });
    expect(shopStickerBlob).toHaveBeenCalledWith(QR, 'pdf', 'english');
    expect(clicked).toEqual([
      { href: 'blob:sticker', download: '21gifts-shop-sticker-carol-english.pdf' },
    ]);
    expect(document.querySelector('a[download]')).toBeNull();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:sticker');
  });

  it('previews and downloads the Kikamba sticker when the page lang is Kikamba', async () => {
    window.history.pushState(null, '', '/?lang=Kikamba');
    renderOverlay();
    const preview = screen.getByRole('img', { name: 'Shop sticker preview for carol@21.gifts' });
    const src = preview.getAttribute('src') ?? '';
    expect(decodeURIComponent(src.slice(src.indexOf(',') + 1))).toBe(
      buildShopStickerSvg(QR, 'kikamba'),
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Download' }));
    });
    expect(clicked).toEqual([
      { href: 'blob:sticker', download: '21gifts-shop-sticker-carol-kikamba.pdf' },
    ]);
    expect(screen.getByRole('combobox', { name: 'Second language' }).textContent).toContain(
      'Kikamba',
    );
    expect(window.location.search).toBe('?lang=Kikamba');
  });

  it('downloads the chosen format', async () => {
    renderOverlay();
    fireEvent.click(screen.getByRole('button', { name: 'JPG' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Download' }));
    });
    expect(shopStickerBlob).toHaveBeenCalledWith(QR, 'jpg', 'english');
    expect(clicked[0]?.download).toBe('21gifts-shop-sticker-carol-english.jpg');
  });

  it('shows an alert when the file cannot be made, and clears it on the next try', async () => {
    vi.mocked(shopStickerBlob).mockRejectedValueOnce(new Error('canvas'));
    renderOverlay();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Download' }));
    });
    expect(screen.getByRole('alert').textContent).toBe(
      'Could not create the file. Please try again.',
    );
    expect(screen.getByRole('button', { name: 'Download' }).hasAttribute('disabled')).toBe(false);
    expect(clicked).toHaveLength(0);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Download' }));
    });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(clicked).toHaveLength(1);
  });

  it('disables Download while the file is being made', async () => {
    let resolve: (blob: Blob) => void = () => undefined;
    vi.mocked(shopStickerBlob).mockReturnValueOnce(
      new Promise<Blob>((r) => {
        resolve = r;
      }),
    );
    renderOverlay();
    fireEvent.click(screen.getByRole('button', { name: 'Download' }));
    expect(screen.getByRole('button', { name: 'Download' }).hasAttribute('disabled')).toBe(true);
    await act(async () => {
      resolve(new Blob(['file']));
    });
    expect(screen.getByRole('button', { name: 'Download' }).hasAttribute('disabled')).toBe(false);
  });

  it('closes from the icon-only Close control and from Escape, not from other keys', () => {
    const onClose = renderOverlay();
    expect(screen.queryByText('Close')).toBeNull();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Enter' });
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('moves focus into the dialog and closes on Escape pressed anywhere, until unmounted', () => {
    const onClose = vi.fn();
    const { unmount } = renderWithLocale(
      <ShopStickerOverlay qrValue={QR} handle="carol@21.gifts" onClose={onClose} />,
    );
    expect(document.activeElement).toBe(screen.getByRole('dialog'));
    fireEvent.keyDown(document.body, { key: 'Tab' });
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('gives focus back to the element that opened it', () => {
    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();
    const { unmount } = renderWithLocale(
      <ShopStickerOverlay qrValue={QR} handle="carol@21.gifts" onClose={vi.fn()} />,
    );
    expect(document.activeElement).toBe(screen.getByRole('dialog'));
    unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it('leaves Escape from inside the dialog to the dialog, even when the document listener sees it', () => {
    const add = vi.spyOn(document, 'addEventListener');
    const onClose = renderOverlay();
    const listener = add.mock.calls.find(([type]) => type === 'keydown')?.[1] as (
      event: KeyboardEvent,
    ) => void;
    listener({
      key: 'Escape',
      target: screen.getByRole('button', { name: 'Download' }),
    } as unknown as KeyboardEvent);
    expect(onClose).not.toHaveBeenCalled();
    listener({ key: 'Escape', target: document.body } as unknown as KeyboardEvent);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps focus on the format choice across re-renders', () => {
    renderOverlay();
    const jpg = screen.getByRole('button', { name: 'JPG' });
    jpg.focus();
    fireEvent.click(jpg);
    expect(document.activeElement).toBe(jpg);
  });

  it('stops clicks and keys on the dialog from bubbling', () => {
    const parentClick = vi.fn();
    const parentKey = vi.fn();
    renderWithLocale(
      <div onClick={parentClick} onKeyDown={parentKey}>
        <ShopStickerOverlay qrValue={QR} handle="carol@21.gifts" onClose={vi.fn()} />
      </div>,
    );
    fireEvent.click(screen.getByRole('dialog'));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'a' });
    expect(parentClick).not.toHaveBeenCalled();
    expect(parentKey).not.toHaveBeenCalled();
  });

  it('opens from the keyboard while closed and ignores any other key', () => {
    renderOverlay();
    const menu = languageMenu();
    fireEvent.keyDown(menu, { key: 'a' });
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.keyDown(menu, { key: 'Enter' });
    expect(screen.getByRole('listbox', { name: 'Second language' })).toBeTruthy();
    fireEvent.click(menu);
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.keyDown(menu, { key: ' ' });
    expect(screen.getByRole('listbox', { name: 'Second language' })).toBeTruthy();
    fireEvent.click(menu);
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(screen.getByRole('listbox', { name: 'Second language' })).toBeTruthy();
  });

  it('lists the six languages, keeps the URL, and downloads the chosen sticker', async () => {
    renderOverlay();
    const menu = languageMenu();
    fireEvent.click(menu);
    const list = screen.getByRole('listbox', { name: 'Second language' });
    for (const name of [
      'None (English only)',
      'Spanish',
      'German',
      'French',
      'Filipino',
      'Kikamba',
    ]) {
      expect(list.textContent).toContain(name);
    }
    expect(
      screen.getByRole('option', { name: 'None (English only)' }).getAttribute('aria-selected'),
    ).toBe('true');
    fireEvent.click(screen.getByRole('option', { name: 'None (English only)' }));
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(window.location.search).toBe('');

    const chosen: {
      name: string;
      lang: 'spanish' | 'german' | 'french' | 'filipino' | 'kikamba';
      file: string;
    }[] = [
      { name: 'Spanish', lang: 'spanish', file: '21gifts-shop-sticker-carol-spanish.pdf' },
      { name: 'German', lang: 'german', file: '21gifts-shop-sticker-carol-german.pdf' },
      { name: 'French', lang: 'french', file: '21gifts-shop-sticker-carol-french.pdf' },
      { name: 'Filipino', lang: 'filipino', file: '21gifts-shop-sticker-carol.pdf' },
      { name: 'Kikamba', lang: 'kikamba', file: '21gifts-shop-sticker-carol-kikamba.pdf' },
    ];
    for (const item of chosen) {
      fireEvent.click(languageMenu());
      const option = screen.getByRole('option', { name: item.name });
      // Pressing the row must not dismiss the list before the click selects it.
      fireEvent.mouseDown(option);
      expect(screen.getByRole('listbox', { name: 'Second language' })).toBeTruthy();
      fireEvent.click(option);
      const preview = screen.getByRole('img', { name: 'Shop sticker preview for carol@21.gifts' });
      const src = preview.getAttribute('src') ?? '';
      expect(decodeURIComponent(src.slice(src.indexOf(',') + 1))).toBe(
        buildShopStickerSvg(QR, item.lang),
      );
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Download' }));
      });
      expect(clicked.at(-1)?.download).toBe(item.file);
      expect(window.location.search).toBe('');
    }
  });

  it('moves the highlight with the keyboard and commits it with Enter or Space', () => {
    renderOverlay();
    const menu = languageMenu();
    fireEvent.click(menu);
    expect(menu.getAttribute('aria-activedescendant')).toBe('shop-sticker-lang-english');
    fireEvent.keyDown(menu, { key: 'a' });
    expect(screen.getByRole('listbox')).toBeTruthy();
    expect(menu.getAttribute('aria-activedescendant')).toBe('shop-sticker-lang-english');
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(menu.getAttribute('aria-activedescendant')).toBe('shop-sticker-lang-spanish');
    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    expect(menu.getAttribute('aria-activedescendant')).toBe('shop-sticker-lang-english');
    fireEvent.keyDown(menu, { key: 'End' });
    expect(menu.getAttribute('aria-activedescendant')).toBe('shop-sticker-lang-kikamba');
    fireEvent.keyDown(menu, { key: 'Home' });
    expect(menu.getAttribute('aria-activedescendant')).toBe('shop-sticker-lang-english');
    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    expect(menu.getAttribute('aria-activedescendant')).toBe('shop-sticker-lang-kikamba');
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(menu.getAttribute('aria-activedescendant')).toBe('shop-sticker-lang-english');
    fireEvent.mouseEnter(screen.getByRole('option', { name: 'Spanish' }));
    expect(menu.getAttribute('aria-activedescendant')).toBe('shop-sticker-lang-spanish');
    fireEvent.keyDown(menu, { key: 'Enter' });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(languageMenu().textContent).toContain('Spanish');
    fireEvent.click(languageMenu());
    fireEvent.mouseEnter(screen.getByRole('option', { name: 'German' }));
    fireEvent.keyDown(languageMenu(), { key: ' ' });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(languageMenu().textContent).toContain('German');
  });

  it('closes the language list on Tab, an outside press, or Escape without closing the dialog', () => {
    const onClose = renderOverlay();
    const menu = languageMenu();
    fireEvent.click(menu);
    fireEvent.mouseDown(menu);
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.keyDown(menu, { key: 'Tab' });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(menu);
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Download' }));
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.click(menu);
    fireEvent.keyDown(menu, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Shop sticker' })).toBeTruthy();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('lets a later menu choice replace the language the URL selected', () => {
    window.history.pushState(null, '', '/?lang=Kikamba');
    renderOverlay();
    fireEvent.click(languageMenu());
    fireEvent.click(screen.getByRole('option', { name: 'French' }));
    const preview = screen.getByRole('img', { name: 'Shop sticker preview for carol@21.gifts' });
    const src = preview.getAttribute('src') ?? '';
    expect(decodeURIComponent(src.slice(src.indexOf(',') + 1))).toBe(
      buildShopStickerSvg(QR, 'french'),
    );
    expect(window.location.search).toBe('?lang=Kikamba');
  });

  it('selects the settings language when the page has no lang query', async () => {
    renderOverlay(vi.fn(), 'de');
    expect(screen.getByRole('combobox', { name: 'Zweitsprache' }).textContent).toContain('Deutsch');
    const preview = screen.getByRole('img', {
      name: 'Vorschau des Shop-Stickers für carol@21.gifts',
    });
    const src = preview.getAttribute('src') ?? '';
    expect(decodeURIComponent(src.slice(src.indexOf(',') + 1))).toBe(
      buildShopStickerSvg(QR, 'german'),
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Herunterladen' }));
    });
    expect(shopStickerBlob).toHaveBeenCalledWith(QR, 'pdf', 'german');
    expect(clicked[0]?.download).toBe('21gifts-shop-sticker-carol-german.pdf');

    cleanup();
    clicked.length = 0;
    renderOverlay(vi.fn(), 'es');
    expect(screen.getByRole('combobox', { name: 'Segundo idioma' }).textContent).toContain(
      'Español',
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Descargar' }));
    });
    expect(clicked.at(-1)?.download).toBe('21gifts-shop-sticker-carol-spanish.pdf');

    cleanup();
    clicked.length = 0;
    renderOverlay(vi.fn(), 'fil');
    expect(screen.getByRole('combobox', { name: 'Ikalawang wika' }).textContent).toContain(
      'Filipino',
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'I-download' }));
    });
    expect(clicked.at(-1)?.download).toBe('21gifts-shop-sticker-carol.pdf');
  });

  it('lets a known lang query override the settings language', () => {
    window.history.pushState(null, '', '/?lang=Kikamba');
    renderOverlay(vi.fn(), 'de');
    expect(screen.getByRole('combobox', { name: 'Zweitsprache' }).textContent).toContain('Kikamba');
    const preview = screen.getByRole('img', {
      name: 'Vorschau des Shop-Stickers für carol@21.gifts',
    });
    const src = preview.getAttribute('src') ?? '';
    expect(decodeURIComponent(src.slice(src.indexOf(',') + 1))).toBe(
      buildShopStickerSvg(QR, 'kikamba'),
    );
    window.history.pushState(null, '', '/?lang=Swahili');
    cleanup();
    renderOverlay();
    expect(screen.getByRole('combobox', { name: 'Second language' }).textContent).toContain(
      'None (English only)',
    );
    window.history.pushState(null, '', '/?lang=fil');
    cleanup();
    renderOverlay(vi.fn(), 'de');
    expect(screen.getByRole('combobox', { name: 'Zweitsprache' }).textContent).toContain(
      'Philippinisch',
    );
  });
});
