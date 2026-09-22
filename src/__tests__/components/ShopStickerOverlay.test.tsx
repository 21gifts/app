import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShopStickerOverlay } from '@/components/ShopStickerOverlay';
import { renderWithLocale } from '@/__tests__/render-with-locale';
import { shopStickerBlob } from '@/lib/shop-sticker';

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
});

function renderOverlay(onClose = vi.fn()): ReturnType<typeof vi.fn> {
  renderWithLocale(<ShopStickerOverlay qrValue={QR} handle="carol@21.gifts" onClose={onClose} />);
  return onClose;
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
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('downloads the PDF by default under the member file name and frees the URL later', async () => {
    renderOverlay();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Download' }));
    });
    expect(shopStickerBlob).toHaveBeenCalledWith(QR, 'pdf');
    expect(clicked).toEqual([{ href: 'blob:sticker', download: '21gifts-shop-sticker-carol.pdf' }]);
    expect(document.querySelector('a[download]')).toBeNull();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:sticker');
  });

  it('downloads the chosen format', async () => {
    renderOverlay();
    fireEvent.click(screen.getByRole('button', { name: 'JPG' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Download' }));
    });
    expect(shopStickerBlob).toHaveBeenCalledWith(QR, 'jpg');
    expect(clicked[0]?.download).toBe('21gifts-shop-sticker-carol.jpg');
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
});
