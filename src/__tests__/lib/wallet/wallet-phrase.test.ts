import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Account } from '@/lib/api-types';
import {
  canUnlockWallet,
  rememberPhraseFromPrf,
  unlockWalletPhrase,
} from '@/lib/wallet/wallet-phrase';
import { mnemonicFromPrfFirst, obtainPrfFirstFromGet } from '@/lib/prf-mnemonic';
import { clearSessionPhrase, peekSessionPhrase } from '@/lib/tab-phrase';
import { useAuthStore } from '@/stores/auth-store';

vi.mock('@/lib/prf-mnemonic', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/prf-mnemonic')>();
  return {
    ...actual,
    obtainPrfFirstFromGet: vi.fn(),
    mnemonicFromPrfFirst: vi.fn(actual.mnemonicFromPrfFirst),
  };
});

const ORIGINAL_BREEZ = process.env.NEXT_PUBLIC_BREEZ_API_KEY;
const CREDENTIAL_ID = 'cred';
const PRF = new Uint8Array(32).fill(7);

const baseAccount = {
  id: 'acc_1',
  linkingKey: null,
  role: 'basis' as const,
  name: null,
  location: null,
  lightningAddress: null,
  lightningAddressVerified: false,
  forumLawsDismissed: false,
  createdAt: 1,
  rulesAgreedAt: null,
  viewKey: 'a'.repeat(64),
  aboutMe: null,
  aboutMeHasPhoto: false,
  setup: null,
  missing: [],
  walletRequired: true,
  passkeyCredentialId: CREDENTIAL_ID,
} as Account;

beforeEach(async () => {
  clearSessionPhrase();
  useAuthStore.setState({ session: 'tok', account: baseAccount, wrongAccount: false });
  process.env.NEXT_PUBLIC_BREEZ_API_KEY = 'test-breez-api-key';
  vi.mocked(obtainPrfFirstFromGet).mockReset().mockResolvedValue(PRF);
  const actual = await vi.importActual<typeof import('@/lib/prf-mnemonic')>('@/lib/prf-mnemonic');
  vi.mocked(mnemonicFromPrfFirst).mockReset().mockImplementation(actual.mnemonicFromPrfFirst);
});

afterEach(() => {
  clearSessionPhrase();
  useAuthStore.setState({ session: null, account: null, wrongAccount: false });
  if (ORIGINAL_BREEZ === undefined) {
    delete process.env.NEXT_PUBLIC_BREEZ_API_KEY;
  } else {
    process.env.NEXT_PUBLIC_BREEZ_API_KEY = ORIGINAL_BREEZ;
  }
});

describe('canUnlockWallet', () => {
  it('is true only for walletRequired accounts with a non-empty credential id', () => {
    expect(canUnlockWallet(null)).toBe(false);
    expect(canUnlockWallet({ ...baseAccount, walletRequired: false })).toBe(false);
    expect(canUnlockWallet({ ...baseAccount, walletRequired: undefined })).toBe(false);
    expect(canUnlockWallet({ ...baseAccount, passkeyCredentialId: null })).toBe(false);
    expect(canUnlockWallet({ ...baseAccount, passkeyCredentialId: '' })).toBe(false);
    expect(canUnlockWallet({ ...baseAccount, passkeyCredentialId: undefined })).toBe(false);
    expect(canUnlockWallet(baseAccount)).toBe(true);
  });
});

describe('rememberPhraseFromPrf', () => {
  it('returns false and remembers nothing when the key is unset', async () => {
    delete process.env.NEXT_PUBLIC_BREEZ_API_KEY;
    await expect(
      rememberPhraseFromPrf({
        prfFirst: PRF,
        credentialId: CREDENTIAL_ID,
        account: baseAccount,
        sessionToken: 'tok',
      }),
    ).resolves.toBe(false);
    expect(peekSessionPhrase()).toBeNull();
  });

  it('returns false when PRF is missing', async () => {
    await expect(
      rememberPhraseFromPrf({
        prfFirst: null,
        credentialId: CREDENTIAL_ID,
        account: baseAccount,
        sessionToken: 'tok',
      }),
    ).resolves.toBe(false);
    await expect(
      rememberPhraseFromPrf({
        prfFirst: undefined,
        credentialId: CREDENTIAL_ID,
        account: baseAccount,
        sessionToken: 'tok',
      }),
    ).resolves.toBe(false);
    expect(peekSessionPhrase()).toBeNull();
  });

  it('returns false when PRF is empty', async () => {
    await expect(
      rememberPhraseFromPrf({
        prfFirst: new Uint8Array(0),
        credentialId: CREDENTIAL_ID,
        account: baseAccount,
        sessionToken: 'tok',
      }),
    ).resolves.toBe(false);
    expect(peekSessionPhrase()).toBeNull();
  });

  it('returns false when the account is not walletRequired', async () => {
    await expect(
      rememberPhraseFromPrf({
        prfFirst: PRF,
        credentialId: CREDENTIAL_ID,
        account: { ...baseAccount, walletRequired: false },
        sessionToken: 'tok',
      }),
    ).resolves.toBe(false);
    expect(peekSessionPhrase()).toBeNull();
  });

  it('returns false when the credential id is missing', async () => {
    await expect(
      rememberPhraseFromPrf({
        prfFirst: PRF,
        credentialId: CREDENTIAL_ID,
        account: { ...baseAccount, passkeyCredentialId: null },
        sessionToken: 'tok',
      }),
    ).resolves.toBe(false);
    expect(peekSessionPhrase()).toBeNull();
  });

  it('returns false on credential mismatch', async () => {
    await expect(
      rememberPhraseFromPrf({
        prfFirst: PRF,
        credentialId: 'other',
        account: baseAccount,
        sessionToken: 'tok',
      }),
    ).resolves.toBe(false);
    expect(peekSessionPhrase()).toBeNull();
  });

  it('returns false when derivation rejects', async () => {
    vi.mocked(mnemonicFromPrfFirst).mockRejectedValueOnce(new Error('derive failed'));
    await expect(
      rememberPhraseFromPrf({
        prfFirst: PRF,
        credentialId: CREDENTIAL_ID,
        account: baseAccount,
        sessionToken: 'tok',
      }),
    ).resolves.toBe(false);
    expect(peekSessionPhrase()).toBeNull();
  });

  it('returns false when the session changes during derivation', async () => {
    vi.mocked(mnemonicFromPrfFirst).mockImplementationOnce(async () => {
      useAuthStore.setState({ session: 'other', account: baseAccount });
      return 'abandon ability able about above absent absorb abstract absurd abuse access accident';
    });
    await expect(
      rememberPhraseFromPrf({
        prfFirst: PRF,
        credentialId: CREDENTIAL_ID,
        account: baseAccount,
        sessionToken: 'tok',
      }),
    ).resolves.toBe(false);
    expect(peekSessionPhrase()).toBeNull();
  });

  it('remembers the phrase mnemonicFromPrfFirst produces', async () => {
    const expected = await mnemonicFromPrfFirst(Uint8Array.from(PRF));
    await expect(
      rememberPhraseFromPrf({
        prfFirst: PRF,
        credentialId: CREDENTIAL_ID,
        account: baseAccount,
        sessionToken: 'tok',
      }),
    ).resolves.toBe(true);
    expect(peekSessionPhrase()).toBe(expected);
  });

  it('returns false when rememberSessionPhrase throws', async () => {
    const spy = vi.spyOn(await import('@/lib/tab-phrase'), 'rememberSessionPhrase');
    spy.mockImplementationOnce(() => {
      throw new Error('store failed');
    });
    await expect(
      rememberPhraseFromPrf({
        prfFirst: PRF,
        credentialId: CREDENTIAL_ID,
        account: baseAccount,
        sessionToken: 'tok',
      }),
    ).resolves.toBe(false);
    spy.mockRestore();
  });
});

describe('unlockWalletPhrase', () => {
  it('fails without a session', async () => {
    useAuthStore.setState({ session: null, account: baseAccount });
    await expect(unlockWalletPhrase()).resolves.toBe('failed');
  });

  it('fails for an ineligible account', async () => {
    useAuthStore.setState({
      session: 'tok',
      account: { ...baseAccount, walletRequired: false },
    });
    await expect(unlockWalletPhrase()).resolves.toBe('failed');
  });

  it('fails when PRF is null', async () => {
    vi.mocked(obtainPrfFirstFromGet).mockResolvedValueOnce(null);
    await expect(unlockWalletPhrase()).resolves.toBe('failed');
    expect(peekSessionPhrase()).toBeNull();
  });

  it('unlocks when PRF is present', async () => {
    const expected = await mnemonicFromPrfFirst(Uint8Array.from(PRF));
    await expect(unlockWalletPhrase()).resolves.toBe('unlocked');
    expect(peekSessionPhrase()).toBe(expected);
  });

  it('returns cancelled on NotAllowedError', async () => {
    vi.mocked(obtainPrfFirstFromGet).mockRejectedValueOnce(
      Object.assign(new Error('denied'), { name: 'NotAllowedError' }),
    );
    await expect(unlockWalletPhrase()).resolves.toBe('cancelled');
  });

  it('returns failed on other errors', async () => {
    vi.mocked(obtainPrfFirstFromGet).mockRejectedValueOnce(new Error('boom'));
    await expect(unlockWalletPhrase()).resolves.toBe('failed');
  });
});
