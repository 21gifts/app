import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SocialRecoveryScreen } from '@/components/SocialRecoveryScreen';
import { putRecoveryShare, RecoveryError } from '@/lib/api';
import type { Account } from '@/lib/api-types';
import { parseShareCode, type ShareCode } from '@/lib/recovery-share-code';
import { clearSessionPhrase, rememberSessionPhrase } from '@/lib/tab-phrase';
import { returnToView } from '@/lib/view-history';
import { ensureWalletConnected } from '@/lib/wallet/wallet-service';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const router = vi.hoisted(() => ({ back: vi.fn(), replace: vi.fn(), push: vi.fn() }));
const backResults = vi.hoisted(() => ({ list: [] as boolean[] }));

vi.mock('next/navigation', () => ({
  useRouter: (): typeof router => router,
}));
vi.mock('@/lib/view-history', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/view-history')>();
  return { ...actual, returnToView: vi.fn() };
});
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, putRecoveryShare: vi.fn() };
});
vi.mock('@/lib/wallet/wallet-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/wallet/wallet-service')>();
  return { ...actual, ensureWalletConnected: vi.fn() };
});
vi.mock('@/components/QrCode', () => ({
  QrCode: ({ value, label, logo }: { value: string; label: string; logo?: string }) => (
    <div role="img" aria-label={label} data-value={value} data-logo={logo ?? 'none'} />
  ),
}));
vi.mock('@/components/ProfileChromeLeft', () => ({
  ProfileChromeLeft: ({ onBackClick }: { onBackClick?: () => boolean }) => (
    <button
      type="button"
      onClick={() => {
        backResults.list.push(onBackClick?.() ?? false);
      }}
    >
      Back
    </button>
  ),
}));

/** Public BIP-39 test phrase: the open wallet's 12 words. */
const PHRASE = 'legal winner thank year wave sausage worth useful legal winner thank yellow';

/** The verified wallet key of the owner. */
const KEY = `02${'a'.repeat(64)}`;

/**
 * The signed-in owner.
 *
 * @param overrides - Fields to change.
 * @returns The account.
 */
function owner(overrides: Partial<Account> = {}): Account {
  return {
    id: 'acc_owner',
    linkingKey: null,
    role: 'basis',
    name: 'Ada',
    username: 'ada',
    location: null,
    lightningAddress: null,
    lightningAddressVerified: false,
    forumLawsDismissed: false,
    createdAt: 1_700_000_000,
    rulesAgreedAt: 1_700_000_001,
    viewKey: 'a'.repeat(64),
    aboutMe: null,
    aboutMeHasPhoto: false,
    setup: null,
    missing: [],
    walletRequired: true,
    passkeyCredentialId: 'cred-seed',
    sparkPubkey: KEY,
    sparkWalletVerified: true,
    socialRecoverySetUp: false,
    ...overrides,
  };
}

/**
 * The share code of the QR on screen, read back.
 *
 * @param name - Accessible name of the QR.
 * @returns The code's fields.
 */
function shownCode(name: string): ShareCode {
  const qr = screen.getByRole('img', { name });
  expect(qr.getAttribute('data-logo')).toBe('none');
  const parsed = parseShareCode(qr.getAttribute('data-value') ?? '');
  if (parsed === null) {
    throw new Error('not a share code');
  }
  return parsed;
}

/** Presses **Continue** and waits for person 1's code. */
async function toPerson1(): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  await screen.findByRole('heading', { level: 2, name: 'Person 1' });
}

beforeEach(() => {
  backResults.list = [];
  rememberSessionPhrase(PHRASE);
  useAuthStore.setState({ session: 'sess-owner', account: owner() });
  vi.mocked(ensureWalletConnected).mockReset().mockResolvedValue(KEY);
  vi.mocked(putRecoveryShare)
    .mockReset()
    .mockResolvedValue(owner({ socialRecoverySetUp: true }));
  vi.mocked(returnToView).mockReset();
});

afterEach(() => {
  cleanup();
  clearSessionPhrase();
  useAuthStore.setState({ session: null, account: null });
});

describe('SocialRecoveryScreen', () => {
  it('renders nothing before the account has loaded', () => {
    useAuthStore.setState({ account: null });
    const { container } = renderWithLocale(<SocialRecoveryScreen />);
    expect(container.innerHTML).toBe('');
  });

  it('explains the setup on the intro, without the renew note on a first setup', () => {
    renderWithLocale(<SocialRecoveryScreen />);
    expect(screen.getByRole('heading', { level: 1, name: 'Secure my account' })).toBeTruthy();
    expect(
      screen.getByText(
        'Choose two people you trust. Each of them gets one part of your 12 words as a code. Any two parts together restore your account on a new phone. 21.gifts keeps a third part as a backup.',
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'Both people together can take over your account and your wallet at once, without you. Only choose people you trust with that.',
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'Both need their own 21.gifts account. They keep their part in their app while signed in.',
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'You can also do this in a video call. Never show both codes in the same call, and do not record it.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/A new setup does not cancel/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('adds the renew note when the account already has a setup', () => {
    useAuthStore.setState({ account: owner({ socialRecoverySetUp: true }) });
    renderWithLocale(<SocialRecoveryScreen />);
    expect(
      screen.getByText(
        'A new setup does not cancel the parts you gave out before: any two old parts still restore your account. Ask people you no longer choose to delete their old part.',
      ),
    ).toBeTruthy();
  });

  it('shows the check in place of Continue, then person 1 and person 2 with their codes', async () => {
    renderWithLocale(<SocialRecoveryScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('status').textContent).toBe('Checking your wallet…');
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
    await screen.findByRole('heading', { level: 2, name: 'Person 1' });
    expect(screen.getByRole('heading', { level: 1, name: 'Secure my account' })).toBeTruthy();
    expect(
      screen.getByText(
        'Ask person 1 to open 21.gifts, choose “Shares I keep for others” in the settings, tap “Keep a share” and scan this code.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText('Person 2 must be someone other than person 1.')).toBeNull();
    const first = shownCode('Code for person 1');
    expect(first).toMatchObject({
      ownerAccountId: 'acc_owner',
      ownerUsername: 'ada',
      memberIndex: 0,
    });
    expect(screen.getByText('Their app refused the code?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start again with new codes' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Person 1 has scanned it' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Person 2' })).toBeTruthy();
    expect(screen.getByText('Person 2 must be someone other than person 1.')).toBeTruthy();
    expect(screen.queryByRole('img', { name: 'Code for person 1' })).toBeNull();
    const second = shownCode('Code for person 2');
    expect(second).toMatchObject({
      ownerAccountId: 'acc_owner',
      memberIndex: 1,
      identifier: first.identifier,
    });
    expect(screen.getByRole('button', { name: 'Person 2 has scanned it' })).toBeTruthy();
  });

  it('steps back from person 2 to person 1 to the intro with the one arrow, then leaves', async () => {
    renderWithLocale(<SocialRecoveryScreen />);
    await toPerson1();
    fireEvent.click(screen.getByRole('button', { name: 'Person 1 has scanned it' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Person 1' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(backResults.list).toEqual([true, true, false]);
    expect(screen.getAllByRole('button', { name: 'Back' })).toHaveLength(1);
  });

  it('starts again with new codes from the refused-code hint', async () => {
    renderWithLocale(<SocialRecoveryScreen />);
    await toPerson1();
    const before = shownCode('Code for person 1');
    fireEvent.click(screen.getByRole('button', { name: 'Start again with new codes' }));
    await waitFor(() => {
      expect(shownCode('Code for person 1').share).not.toBe(before.share);
    });
    expect(shownCode('Code for person 1').memberIndex).toBe(0);
    expect(ensureWalletConnected).toHaveBeenCalledTimes(1);
  });

  it('saves the 21.gifts backup after person 2, stores the account, and Done returns to /settings', async () => {
    renderWithLocale(<SocialRecoveryScreen />);
    await toPerson1();
    fireEvent.click(screen.getByRole('button', { name: 'Person 1 has scanned it' }));
    fireEvent.click(screen.getByRole('button', { name: 'Person 2 has scanned it' }));
    expect(screen.getByRole('status').textContent).toBe('Saving the 21.gifts backup…');
    expect(screen.queryByRole('img')).toBeNull();
    await screen.findByRole('heading', { level: 2, name: 'Your account is secured' });
    expect(
      screen.getByText(
        'Two people and 21.gifts now each hold one part. Any two parts restore your account.',
      ),
    ).toBeTruthy();
    const [session, body] = vi.mocked(putRecoveryShare).mock.calls[0]!;
    expect(session).toBe('sess-owner');
    expect(body.sparkPubkey).toBe(KEY);
    expect(body.share.split(' ')).toHaveLength(20);
    expect(useAuthStore.getState().account?.socialRecoverySetUp).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(returnToView).toHaveBeenCalledWith('/settings', router);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(backResults.list).toEqual([false]);
  });

  it('says the wallet could not be opened, and Try again checks again', async () => {
    vi.mocked(ensureWalletConnected).mockRejectedValueOnce(new Error('wallet-connect'));
    renderWithLocale(<SocialRecoveryScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Your wallet could not be opened.');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(backResults.list).toEqual([false]);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByRole('heading', { level: 2, name: 'Person 1' });
  });

  it('stops for words that do not open this account’s wallet, with no Try again', async () => {
    vi.mocked(ensureWalletConnected).mockResolvedValue(`03${'b'.repeat(64)}`);
    renderWithLocale(<SocialRecoveryScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'These 12 words do not open the wallet of this account. Setup stopped.',
    );
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('says the backup could not be saved, and Try again uploads it again', async () => {
    vi.mocked(putRecoveryShare).mockRejectedValueOnce(new RecoveryError('unavailable'));
    renderWithLocale(<SocialRecoveryScreen />);
    await toPerson1();
    fireEvent.click(screen.getByRole('button', { name: 'Person 1 has scanned it' }));
    fireEvent.click(screen.getByRole('button', { name: 'Person 2 has scanned it' }));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'The 21.gifts backup could not be saved.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByRole('heading', { level: 2, name: 'Your account is secured' });
    const calls = vi.mocked(putRecoveryShare).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[1]).toEqual(calls[0]);
  });

  it('says the wallet changed, and Try again returns to the intro', async () => {
    vi.mocked(putRecoveryShare).mockRejectedValueOnce(new RecoveryError('key_in_use'));
    renderWithLocale(<SocialRecoveryScreen />);
    await toPerson1();
    fireEvent.click(screen.getByRole('button', { name: 'Person 1 has scanned it' }));
    fireEvent.click(screen.getByRole('button', { name: 'Person 2 has scanned it' }));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Your wallet changed during setup. Start again.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
