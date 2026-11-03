'use client';

import { validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { Loader2 } from 'lucide-react';
import { useEffect, useId, useRef, useState, type FormEvent, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { QrScanner } from '@/components/QrScanner';
import { Button, Field } from '@/components/ui';
import type { MessageKey } from '@/lib/messages';
import { parseShareCode, phraseFromShareCodes, type ShareCode } from '@/lib/recovery-share-code';
import { Slip39Error } from '@/lib/slip39';

/** Props for {@link OldWordsInput}. */
export interface OldWordsInputProps {
  /** Scan two share codes, or type the 12 words. */
  mode: 'scan' | 'type';
  /**
   * Called once with the old 12 words: rebuilt from two codes (with the owner
   * they name) or typed (owner `null`).
   */
  onWords: (words: string, ownerAccountId: string | null) => void;
  /** Account the codes must belong to, when the member is signed in. */
  expectedOwnerAccountId?: string;
}

/**
 * Why a scanned code was refused: not a share code, the same code twice,
 * codes of different setups, or codes of another account.
 */
type ScanError = 'invalid' | 'same' | 'otherSet' | 'otherAccount';

/** Catalog key of each refusal. */
const SCAN_ERROR_COPY: Record<ScanError, MessageKey> = {
  invalid: 'shareCode.invalid',
  same: 'shareCode.same',
  otherSet: 'shareCode.otherSet',
  otherAccount: 'shareCode.otherAccount',
};

/** Words in a recovery phrase of the in-app wallet. */
const PHRASE_WORDS = 12;

/** Floating camera control: an `overlay` pill of at least 48px, as on the wallet Send camera. */
const FLOAT_CLASS = 'min-h-12 text-base';

/**
 * Reads the old 12 words of a wallet, for a social recovery (`/recover`) or a
 * previous wallet (`/settings/previous-wallets/[sparkPubkey]`), and keeps them
 * in component memory only.
 *
 * `scan` fills its positioned parent with the camera layer of the wallet Send
 * view (`data-port-fill`) and reads two share codes in turn, with the hint
 * **Scan code 1 of 2**, then **Scan code 2 of 2**. After the first code, the
 * line **Code 1 of 2 scanned** with the owner's username stays at the bottom,
 * and the camera stays off until the member presses **Scan code 2 of 2**, so
 * the first code, often still in front of the camera, is not read again as
 * the second. Two codes of one setup are combined into the 12 words. A refused
 * code (not a share code, the same code twice, codes of different setups, or
 * of an account other than `expectedOwnerAccountId`) stops the camera and
 * shows its alert with **Try again**, which starts the camera again, as the
 * wallet Send camera does, so the refused code is not read again at once.
 *
 * `type` is a field for the 12 words with a hint and **Continue**; the words
 * are trimmed, lower-cased, and single-spaced, and must be 12 valid BIP-39
 * words, otherwise **These are not 12 valid words. Check the spelling.**
 *
 * @param props - See {@link OldWordsInputProps}.
 * @returns The camera layer or the words form.
 */
export function OldWordsInput({
  mode,
  onWords,
  expectedOwnerAccountId,
}: OldWordsInputProps): ReactElement {
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  const deliver = (words: string, ownerAccountId: string | null): void => {
    if (live.current) {
      onWords(words, ownerAccountId);
    }
  };
  return mode === 'scan' ? (
    <ScanCodes onWords={deliver} expectedOwnerAccountId={expectedOwnerAccountId} />
  ) : (
    <TypeWords onWords={deliver} />
  );
}

/**
 * The camera layer that reads two share codes.
 *
 * @param props - Where the words go, and the account the codes must belong to.
 * @returns The camera layer.
 */
function ScanCodes({
  onWords,
  expectedOwnerAccountId,
}: {
  onWords: (words: string, ownerAccountId: string) => void;
  expectedOwnerAccountId: string | undefined;
}): ReactElement {
  const { t } = useTranslations();
  const [first, setFirst] = useState<ShareCode | null>(null);
  // The first code was read; the camera stays off until code 2 is asked for.
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<ScanError | null>(null);
  const [combining, setCombining] = useState(false);
  const [scanner, setScanner] = useState(0);

  const onResult = (text: string): void => {
    const code = parseShareCode(text);
    if (code === null) {
      setError('invalid');
      return;
    }
    if (expectedOwnerAccountId !== undefined && code.ownerAccountId !== expectedOwnerAccountId) {
      setError('otherAccount');
      return;
    }
    if (first === null) {
      setFirst(code);
      setPaused(true);
      return;
    }
    setCombining(true);
    phraseFromShareCodes(first, code).then(
      (words) => {
        onWords(words, code.ownerAccountId);
      },
      (caught: unknown) => {
        setCombining(false);
        setError(caught instanceof Slip39Error && caught.code === 'members' ? 'same' : 'otherSet');
      },
    );
  };

  return (
    <section
      aria-label={t('recover.scan')}
      data-port-fill=""
      className="absolute inset-0 overflow-hidden rounded-b-[calc(1.5rem-1px)] bg-black text-white"
    >
      {error === null && !combining && !paused ? (
        <QrScanner
          key={scanner}
          onResult={onResult}
          copy={{
            hint: 'recover.scanHint',
            hintVars: { n: first === null ? 1 : 2 },
            denied: 'recover.cameraDenied',
            unavailable: 'recover.cameraUnavailable',
          }}
        />
      ) : null}
      {paused ? (
        <div className="absolute inset-x-0 top-1/3 flex -translate-y-1/2 justify-center px-8">
          <Button
            variant="overlay"
            className={FLOAT_CLASS}
            onClick={() => {
              setPaused(false);
              setScanner((count) => count + 1);
            }}
          >
            {t('recover.scanHint', { n: 2 })}
          </Button>
        </div>
      ) : null}
      {combining ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 aria-hidden="true" className="h-10 w-10 animate-spin text-white" />
        </div>
      ) : null}
      {error === null ? null : (
        <div className="absolute inset-x-0 top-1/3 flex -translate-y-1/2 flex-col items-center gap-4 px-8">
          <p role="alert" className="text-center text-lg font-medium text-white">
            {t(SCAN_ERROR_COPY[error])}
          </p>
          <Button
            variant="overlay"
            className={FLOAT_CLASS}
            onClick={() => {
              setError(null);
              setScanner((count) => count + 1);
            }}
          >
            {t('login.retry')}
          </Button>
        </div>
      )}
      {first === null ? null : (
        <div className="absolute inset-x-0 bottom-6 flex justify-center px-4">
          <p
            role="status"
            className="rounded-2xl bg-black/55 px-4 py-2 text-center text-sm text-white backdrop-blur-md"
          >
            {t('recover.scanFirstDone', { username: first.ownerUsername })}
          </p>
        </div>
      )}
    </section>
  );
}

/**
 * The field for the 12 words.
 *
 * @param props - Where the words go.
 * @returns The form.
 */
function TypeWords({
  onWords,
}: {
  onWords: (words: string, ownerAccountId: null) => void;
}): ReactElement {
  const { t } = useTranslations();
  const hintId = useId();
  const [draft, setDraft] = useState('');
  const [invalid, setInvalid] = useState(false);

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const words = draft.trim().toLowerCase().split(/\s+/).join(' ');
    if (words.split(' ').length !== PHRASE_WORDS || !validateMnemonic(words, wordlist)) {
      setInvalid(true);
      return;
    }
    onWords(words, null);
  };

  return (
    <form className="flex w-full flex-col items-stretch gap-3" onSubmit={submit}>
      <Field
        multiline
        rows={3}
        label={t('recover.wordsLabel')}
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        value={draft}
        aria-describedby={hintId}
        aria-invalid={invalid}
        onChange={(event) => {
          setDraft(event.target.value);
          setInvalid(false);
        }}
      />
      <p id={hintId} className="text-sm text-app-muted">
        {t('recover.wordsHint')}
      </p>
      {invalid ? (
        <p role="alert" className="text-center text-sm text-app-danger">
          {t('recover.wordsInvalid')}
        </p>
      ) : null}
      <Button type="submit">{t('recover.wordsSubmit')}</Button>
    </form>
  );
}
