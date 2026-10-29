import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OldWordsInput } from '@/components/OldWordsInput';
import type { QrScannerProps } from '@/components/QrScanner';
import { phraseFromShareCodes } from '@/lib/recovery-share-code';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const scanner = vi.hoisted(() => ({ props: null as QrScannerProps | null, mounts: 0 }));

vi.mock('@/components/QrScanner', async () => {
  const { useEffect } = await import('react');
  return {
    QrScanner: (props: QrScannerProps) => {
      scanner.props = props;
      useEffect(() => {
        scanner.mounts += 1;
      }, []);
      return <p>Camera stub</p>;
    },
  };
});
vi.mock('@/lib/recovery-share-code', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/recovery-share-code')>();
  return { ...actual, phraseFromShareCodes: vi.fn(actual.phraseFromShareCodes) };
});

/** Two shares of one recovery set (identifier 2864). */
const SHARES = [
  'body lily academic acid acne violence volume package glen escape prospect wealthy gesture venture legal already activity raspy camera easel',
  'body lily academic agency domain sugar learn owner kitchen exhaust aircraft sled fused dragon froth argue traveler reunion library geology',
] as const;

/** A share of another set (official SLIP-39 vector 43). */
const OTHER_SET =
  'enemy favorite academic acid cowboy phrase havoc level response walnut budget painting inside trash adjust froth kitchen learn tidy punish';

/**
 * A share payload of `@ada`.
 *
 * @param share - The share's words.
 * @param owner - Owner account id.
 * @returns The payload.
 */
function code(share: string, owner = 'acc_ada'): string {
  return `21gifts-share:v1:${owner}:ada:${share}`;
}

/** Public BIP-39 test phrase. */
const PHRASE = 'legal winner thank year wave sausage worth useful legal winner thank yellow';

/**
 * Reads one text with the stubbed scanner.
 *
 * @param text - The QR text.
 */
async function scan(text: string): Promise<void> {
  await act(async () => {
    scanner.props?.onResult(text);
  });
}

/** Presses **Scan code 2 of 2**, which starts the camera for the second code. */
function askSecond(): void {
  fireEvent.click(screen.getByRole('button', { name: 'Scan code 2 of 2' }));
}

beforeEach(() => {
  scanner.props = null;
  scanner.mounts = 0;
  vi.mocked(phraseFromShareCodes).mockClear();
});

afterEach(cleanup);

describe('OldWordsInput', () => {
  describe('scan', () => {
    it('fills the page with the camera and asks for code 1 of 2', () => {
      renderWithLocale(<OldWordsInput mode="scan" onWords={vi.fn()} />);
      const layer = screen.getByRole('region', { name: 'Scan two codes' });
      expect(layer.hasAttribute('data-port-fill')).toBe(true);
      expect(layer.className).toContain('absolute inset-0');
      expect(scanner.props?.copy).toEqual({
        hint: 'recover.scanHint',
        hintVars: { n: 1 },
        denied: 'recover.cameraDenied',
        unavailable: 'recover.cameraUnavailable',
      });
    });

    it('keeps the first code, keeps the camera off until code 2 is asked for, and rebuilds the words', async () => {
      const onWords = vi.fn();
      renderWithLocale(<OldWordsInput mode="scan" onWords={onWords} />);
      await scan(code(SHARES[0]));
      expect(screen.getByRole('status').textContent).toBe('Code 1 of 2 scanned (@ada).');
      expect(screen.queryByText('Camera stub')).toBeNull();
      expect(scanner.mounts).toBe(1);
      expect(screen.queryByRole('alert')).toBeNull();
      const button = screen.getByRole('button', { name: 'Scan code 2 of 2' });
      expect(button.className).toContain('min-h-12');
      askSecond();
      expect(scanner.mounts).toBe(2);
      expect(scanner.props?.copy?.hintVars).toEqual({ n: 2 });
      expect(screen.queryByRole('button', { name: 'Scan code 2 of 2' })).toBeNull();
      expect(screen.getByRole('status').textContent).toBe('Code 1 of 2 scanned (@ada).');
      await scan(code(SHARES[1]));
      await waitFor(() => {
        expect(onWords).toHaveBeenCalledTimes(1);
      });
      const [words, owner] = onWords.mock.calls[0] as [string, string];
      expect(words.split(' ')).toHaveLength(12);
      expect(owner).toBe('acc_ada');
    });

    it('hides the camera while the two codes are combined', async () => {
      let finish: (words: string) => void = () => undefined;
      vi.mocked(phraseFromShareCodes).mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      );
      const onWords = vi.fn();
      renderWithLocale(<OldWordsInput mode="scan" onWords={onWords} />);
      await scan(code(SHARES[0]));
      askSecond();
      await scan(code(SHARES[1]));
      expect(screen.queryByText('Camera stub')).toBeNull();
      await act(async () => {
        finish(PHRASE);
      });
      expect(onWords).toHaveBeenCalledWith(PHRASE, 'acc_ada');
    });

    it.each([
      ['a text that is not a share code', [], 'not a share', 'This is not a Social Recovery code.'],
      [
        'the same code twice',
        [code(SHARES[0])],
        code(SHARES[0]),
        "That was the same code twice. Scan the other person's code.",
      ],
      [
        'codes of different setups',
        [code(SHARES[0])],
        code(OTHER_SET),
        'These two codes do not belong together.',
      ],
    ])(
      '%s stops the camera with its alert, and Try again starts it again',
      async (_l, before, text, alert) => {
        const onWords = vi.fn();
        renderWithLocale(<OldWordsInput mode="scan" onWords={onWords} />);
        for (const first of before) {
          await scan(first);
          askSecond();
        }
        await scan(text);
        await waitFor(() => {
          expect(screen.getByRole('alert').textContent).toBe(alert);
        });
        expect(screen.queryByText('Camera stub')).toBeNull();
        const mounts = scanner.mounts;
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
        expect(screen.queryByRole('alert')).toBeNull();
        expect(scanner.mounts).toBe(mounts + 1);
        expect(scanner.props?.copy?.hintVars).toEqual({ n: before.length + 1 });
        expect(onWords).not.toHaveBeenCalled();
      },
    );

    it('a failure that is not a share error counts as codes that do not belong together', async () => {
      vi.mocked(phraseFromShareCodes).mockRejectedValueOnce(new Error('crypto'));
      renderWithLocale(<OldWordsInput mode="scan" onWords={vi.fn()} />);
      await scan(code(SHARES[0]));
      askSecond();
      await scan(code(SHARES[1]));
      await waitFor(() => {
        expect(screen.getByRole('alert').textContent).toBe(
          'These two codes do not belong together.',
        );
      });
    });

    it('refuses codes of another account than the signed-in one', async () => {
      renderWithLocale(
        <OldWordsInput mode="scan" onWords={vi.fn()} expectedOwnerAccountId="acc_bob" />,
      );
      await scan(code(SHARES[0]));
      expect(screen.getByRole('alert').textContent).toBe('These codes belong to another account.');
      expect(screen.queryByRole('status')).toBeNull();
    });

    it('accepts the codes of the expected account', async () => {
      const onWords = vi.fn();
      renderWithLocale(
        <OldWordsInput mode="scan" onWords={onWords} expectedOwnerAccountId="acc_ada" />,
      );
      await scan(code(SHARES[0]));
      askSecond();
      await scan(code(SHARES[1]));
      await waitFor(() => {
        expect(onWords).toHaveBeenCalled();
      });
    });

    it('does not hand over words after it closed', async () => {
      let finish: (words: string) => void = () => undefined;
      vi.mocked(phraseFromShareCodes).mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      );
      const onWords = vi.fn();
      const { unmount } = renderWithLocale(<OldWordsInput mode="scan" onWords={onWords} />);
      await scan(code(SHARES[0]));
      askSecond();
      await scan(code(SHARES[1]));
      unmount();
      await act(async () => {
        finish(PHRASE);
      });
      expect(onWords).not.toHaveBeenCalled();
    });
  });

  describe('type', () => {
    it('hands over 12 valid words, trimmed, lower-cased, and single-spaced', () => {
      const onWords = vi.fn();
      renderWithLocale(<OldWordsInput mode="type" onWords={onWords} />);
      const field = screen.getByLabelText('Your 12 words') as HTMLTextAreaElement;
      expect(field.tagName).toBe('TEXTAREA');
      expect(field.getAttribute('autocomplete')).toBe('off');
      expect(field.getAttribute('spellcheck')).toBe('false');
      expect(screen.getByText('Separate the words with spaces.').id).toBe(
        field.getAttribute('aria-describedby'),
      );
      fireEvent.change(field, {
        target: { value: `  ${PHRASE.toUpperCase().replace(/ /g, '   ')}\n` },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
      expect(onWords).toHaveBeenCalledWith(PHRASE, null);
    });

    it.each([
      [
        'a wrong checksum',
        'legal winner thank year wave sausage worth useful legal winner thank thank',
      ],
      ['too few words', 'legal winner thank year'],
      [
        'a valid phrase of 24 words',
        'legal winner thank year wave sausage worth useful legal winner thank year wave sausage worth useful legal winner thank year wave sausage worth title',
      ],
    ])('refuses %s until the words change', (_label, value) => {
      const onWords = vi.fn();
      renderWithLocale(<OldWordsInput mode="type" onWords={onWords} />);
      const field = screen.getByLabelText('Your 12 words');
      fireEvent.change(field, { target: { value } });
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
      expect(screen.getByRole('alert').textContent).toBe(
        'These are not 12 valid words. Check the spelling.',
      );
      expect(field.getAttribute('aria-invalid')).toBe('true');
      fireEvent.change(field, { target: { value: PHRASE } });
      expect(screen.queryByRole('alert')).toBeNull();
      expect(onWords).not.toHaveBeenCalled();
    });
  });
});
