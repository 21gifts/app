import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HeldSharesScreen } from '@/components/HeldSharesScreen';
import type { QrCodeProps } from '@/components/QrCode';
import type { QrScannerProps } from '@/components/QrScanner';
import type { UseHeldSharesResult } from '@/hooks/useHeldShares';
import type { Account } from '@/lib/api-types';
import type { HeldShare } from '@/lib/held-shares';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const scanner = vi.hoisted(() => ({ props: null as QrScannerProps | null }));
const backResults = vi.hoisted(() => ({ list: [] as boolean[] }));
const hook = vi.hoisted(() => ({ result: null as UseHeldSharesResult | null }));

vi.mock('@/components/QrScanner', () => ({
  QrScanner: (props: QrScannerProps) => {
    scanner.props = props;
    return <p>Camera stub</p>;
  },
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
vi.mock('@/components/QrCode', () => ({
  QrCode: ({ value, label, logo }: QrCodeProps) => (
    <div role="img" aria-label={label} data-value={value} data-logo={logo ?? ''} />
  ),
}));
vi.mock('@/hooks/useHeldShares', () => ({
  useHeldShares: (): UseHeldSharesResult => hook.result as UseHeldSharesResult,
}));

/** A share of another set (identifier 7506). */
const OTHER_SET =
  'domain morning academic acid disease humidity peasant cleanup trend describe romp terminal should knit often alarm visitor tension universe peanut';

/**
 * A kept share.
 *
 * @param username - Owner username.
 * @returns The share.
 */
function share(username: string): HeldShare {
  return {
    boxId: `${username}`.padEnd(32, '0'),
    code: `21gifts-share:v1:acc_${username}:${username}:${OTHER_SET}`,
    ownerAccountId: `acc_${username}`,
    ownerUsername: username,
    identifier: 7506,
    memberIndex: 0,
  };
}

const BOB = share('bob');
const CARA = share('cara');

const account: Account = {
  id: 'acc_hal',
  linkingKey: null,
  role: 'basis',
  name: 'Hal',
  username: 'hal',
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
};

/**
 * Sets what the hook returns.
 *
 * @param state - Fields to change from a ready, empty list.
 * @returns The hook result.
 */
function held(state: Partial<UseHeldSharesResult> = {}): UseHeldSharesResult {
  const result: UseHeldSharesResult = {
    load: 'ready',
    unlocking: false,
    unlockError: null,
    shares: [],
    lockedCount: 0,
    saving: false,
    view: 'list',
    notice: null,
    confirmDelete: null,
    confirmDeleteLocked: false,
    unlock: vi.fn(),
    reload: vi.fn(),
    scan: vi.fn(),
    onScanResult: vi.fn(),
    showQr: vi.fn(),
    askDelete: vi.fn(),
    remove: vi.fn(),
    askDeleteLocked: vi.fn(),
    removeLocked: vi.fn(),
    cancel: vi.fn(),
    back: vi.fn(() => true),
    ...state,
  };
  hook.result = result;
  return result;
}

/** Renders the screen and returns the heading of the page. */
function render(): HTMLElement {
  renderWithLocale(<HeldSharesScreen />);
  return screen.getByRole('heading', { level: 1, name: 'Shares I keep for others' });
}

beforeEach(() => {
  scanner.props = null;
  backResults.list = [];
  useAuthStore.setState({ session: 'sess', account });
  held();
});

afterEach(() => {
  cleanup();
  useAuthStore.setState({ session: null, account: null });
});

describe('HeldSharesScreen', () => {
  it('renders nothing before the account has loaded', () => {
    useAuthStore.setState({ account: null });
    const { container } = renderWithLocale(<HeldSharesScreen />);
    expect(container.innerHTML).toBe('');
  });

  it('says the shares are being opened', () => {
    held({ load: 'opening' });
    render();
    expect(screen.getByRole('status').textContent).toBe('Opening your shares…');
    expect(
      screen.getByText(
        'Someone chose you to help restore their account. Keep their share here. Show it only to them, in person, when they ask.',
      ),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Keep a share' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Open my shares' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });

  it('asks for the passkey with Open my shares and shows a failed prompt in the recovery phrase wording', () => {
    const result = held({ load: 'unlock' });
    render();
    expect(screen.getByText('Confirm with your passkey to open the shares you keep.')).toBeTruthy();
    expect(
      screen.getByText(
        'Someone chose you to help restore their account. Keep their share here. Show it only to them, in person, when they ask.',
      ),
    ).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Keep a share' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open my shares' }));
    expect(result.unlock).toHaveBeenCalledTimes(1);
    expect(result.reload).not.toHaveBeenCalled();
    expect(result.scan).not.toHaveBeenCalled();
    cleanup();
    for (const [unlockError, text] of [
      [
        'prfUnsupported',
        'This phone or browser cannot hold a 21.gifts wallet. Please use an up-to-date phone or browser that supports passkeys.',
      ],
      ['timeout', 'The device prompt timed out before you finished. Try again.'],
      [
        'generic',
        'The recovery phrase could not be created or opened. Check this device and try again.',
      ],
    ] as const) {
      const failed = held({ load: 'unlock', unlockError });
      render();
      expect(screen.getByRole('alert').textContent).toBe(text);
      const retry = screen.getByRole('button', { name: 'Open my shares' }) as HTMLButtonElement;
      expect(retry.disabled).toBe(false);
      fireEvent.click(retry);
      expect(failed.unlock).toHaveBeenCalledTimes(1);
      cleanup();
    }
    held({ load: 'unlock', unlocking: true });
    render();
    expect(screen.getByText('Confirm with your passkey to open the shares you keep.')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    const busy = screen.getByRole('button', { name: 'Open my shares' }) as HTMLButtonElement;
    expect(busy.disabled).toBe(true);
    expect(busy.querySelector('svg')?.getAttribute('class')).toContain('animate-spin');
    cleanup();
    held({ load: 'unlock', unlockError: 'generic', unlocking: true });
    render();
    expect(screen.getByRole('alert').textContent).toBe(
      'The recovery phrase could not be created or opened. Check this device and try again.',
    );
    expect(screen.getByRole('alert').className).toContain('text-app-danger');
    const button = screen.getByRole('button', { name: 'Open my shares' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.querySelector('svg')?.getAttribute('class')).toContain('animate-spin');
  });

  it('shows the load error with Try again', () => {
    const result = held({ load: 'loadError' });
    render();
    expect(screen.getByRole('alert').textContent).toBe('Your shares could not be loaded.');
    expect(
      screen.getByText(
        'Someone chose you to help restore their account. Keep their share here. Show it only to them, in person, when they ask.',
      ),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Keep a share' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Open my shares' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(result.reload).toHaveBeenCalledTimes(1);
    expect(result.unlock).not.toHaveBeenCalled();
    expect(result.scan).not.toHaveBeenCalled();
  });

  it('shows the title, the intro, Keep a share, and the empty line', () => {
    const result = held();
    expect(render().className).not.toContain('sr-only');
    expect(
      screen.getByText(
        'Someone chose you to help restore their account. Keep their share here. Show it only to them, in person, when they ask.',
      ),
    ).toBeTruthy();
    const keep = screen.getByRole('button', { name: 'Keep a share' });
    expect(keep.className).toContain('w-full');
    fireEvent.click(keep);
    expect(result.scan).toHaveBeenCalled();
    expect(screen.getByText('You keep no shares for others yet.')).toBeTruthy();
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('lists each share by username with icon-only show and delete', () => {
    const result = held({ shares: [BOB, CARA] });
    render();
    const items = screen.getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual(['@bob', '@cara']);
    const show = screen.getByRole('button', { name: 'Show code for @bob' });
    const remove = screen.getByRole('button', { name: 'Delete share of @bob' });
    expect(screen.queryByText('Show code for @bob')).toBeNull();
    expect(
      within(items[0] as HTMLElement).getByRole('button', { name: 'Show code for @bob' }),
    ).toBe(show);
    expect(remove.querySelector('svg')?.getAttribute('class')).toContain('text-app-danger');
    expect(screen.queryByText('Delete share of @bob')).toBeNull();
    fireEvent.click(show);
    expect(result.showQr).toHaveBeenCalledWith(BOB);
    expect(result.askDelete).not.toHaveBeenCalled();
    fireEvent.click(remove);
    expect(result.askDelete).toHaveBeenCalledWith(BOB);
    expect(result.showQr).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Show code for @cara' }));
    expect(result.showQr).toHaveBeenLastCalledWith(CARA);
    fireEvent.click(screen.getByRole('button', { name: 'Delete share of @cara' }));
    expect(result.askDelete).toHaveBeenLastCalledWith(CARA);
    fireEvent.click(screen.getByRole('button', { name: 'Keep a share' }));
    expect(result.scan).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('You keep no shares for others yet.')).toBeNull();
  });

  it('confirms a delete in place of the trash icon', () => {
    const result = held({ shares: [BOB, CARA], confirmDelete: BOB.boxId });
    render();
    const confirm = screen.getByRole('group', {
      name: 'Delete the share of @bob? Only do this when they ask.',
    });
    expect(screen.queryByRole('button', { name: 'Delete share of @bob' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Show code for @bob' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete share of @cara' })).toBeTruthy();
    expect(screen.getAllByRole('group')).toHaveLength(1);
    fireEvent.click(within(confirm).getByRole('button', { name: 'Keep' }));
    expect(result.cancel).toHaveBeenCalledTimes(1);
    expect(result.remove).not.toHaveBeenCalled();
    fireEvent.click(within(confirm).getByRole('button', { name: 'Delete' }));
    expect(result.remove).toHaveBeenCalledTimes(1);
    expect(result.remove).toHaveBeenCalledWith(BOB);
    expect(result.cancel).toHaveBeenCalledTimes(1);
  });

  it('counts the boxes that do not open in one neutral row, with a confirmed delete', () => {
    const result = held({ lockedCount: 1 });
    render();
    expect(screen.queryByText('You keep no shares for others yet.')).toBeNull();
    const row = screen.getByRole('listitem');
    expect(row.textContent).toBe('1 kept share cannot be opened with your current 12 words.');
    expect(within(row).getByText(/cannot be opened/).className).toContain('text-app-muted');
    expect(screen.queryByText('Delete the shares that cannot be opened')).toBeNull();
    fireEvent.click(
      within(row).getByRole('button', { name: 'Delete the shares that cannot be opened' }),
    );
    expect(result.askDeleteLocked).toHaveBeenCalledTimes(1);
    expect(result.removeLocked).not.toHaveBeenCalled();
    cleanup();
    const confirming = held({ shares: [BOB], lockedCount: 3, confirmDeleteLocked: true });
    render();
    expect(
      screen.getByText('3 kept shares cannot be opened with your current 12 words.'),
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Delete the shares that cannot be opened' }),
    ).toBeNull();
    const confirm = screen.getByRole('group', {
      name: 'Delete the shares that cannot be opened?',
    });
    expect(screen.getByRole('button', { name: 'Delete share of @bob' })).toBeTruthy();
    expect(screen.getAllByRole('group')).toHaveLength(1);
    fireEvent.click(within(confirm).getByRole('button', { name: 'Keep' }));
    expect(confirming.cancel).toHaveBeenCalledTimes(1);
    expect(confirming.removeLocked).not.toHaveBeenCalled();
    fireEvent.click(within(confirm).getByRole('button', { name: 'Delete' }));
    expect(confirming.removeLocked).toHaveBeenCalledTimes(1);
    expect(confirming.cancel).toHaveBeenCalledTimes(1);
  });

  it('shows the saving line in place of Keep a share', () => {
    held({ saving: true });
    render();
    expect(screen.getByRole('status').textContent).toBe('Keeping the share…');
    expect(screen.queryByRole('button', { name: 'Keep a share' })).toBeNull();
  });

  it.each([
    ['stored', 'You now keep a share for @bob.'],
    ['invalid', 'This is not a Social Recovery code.'],
    ['own', 'This is a share of your own account. Only other people can keep it.'],
    [
      'duplicate',
      'This account already keeps a share of this setup for @bob. One person keeps only one share of a setup.',
    ],
    ['saveError', 'The share could not be kept. Try again.'],
    ['deleteError', 'The share could not be deleted. Try again.'],
  ] as const)('shows the %s notice', (kind, text) => {
    held({ notice: kind === 'invalid' ? { kind } : { kind, username: 'bob' } });
    render();
    const line = screen.getByRole(kind === 'stored' ? 'status' : 'alert');
    expect(line.textContent).toBe(text);
    expect(line.className).toContain(kind === 'stored' ? 'text-app-success' : 'text-app-danger');
  });

  it('fills the page with the camera layer and the share wording', () => {
    const result = held({ view: 'scan' });
    renderWithLocale(<HeldSharesScreen />);
    const layer = screen.getByRole('region', { name: 'Keep a share' });
    expect(layer.hasAttribute('data-port-fill')).toBe(true);
    expect(layer.className).toContain('absolute inset-0');
    expect(screen.getByRole('heading', { level: 1 }).className).toContain('sr-only');
    expect(scanner.props?.copy).toEqual({
      hint: 'heldShares.scanHint',
      denied: 'heldShares.cameraDenied',
      unavailable: 'heldShares.cameraUnavailable',
    });
    expect(scanner.props?.onResult).toBe(result.onScanResult);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(backResults.list).toEqual([true]);
    expect(result.back).toHaveBeenCalledTimes(1);
  });

  it('shows a share’s code for its owner', () => {
    held({ view: { qr: BOB } });
    renderWithLocale(<HeldSharesScreen />);
    expect(screen.getByRole('heading', { level: 1 }).className).toContain('sr-only');
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Share of @bob');
    expect(
      screen.getByText('Show this code only to @bob in person, so they can restore their account.'),
    ).toBeTruthy();
    const qr = screen.getByRole('img', { name: 'Share code' });
    expect(qr.getAttribute('data-value')).toBe(BOB.code);
    expect(qr.getAttribute('data-logo')).toBe('');
    expect(screen.queryByRole('button', { name: 'Keep a share' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(backResults.list).toEqual([true]);
    expect(hook.result?.back).toHaveBeenCalled();
  });

  it('uses the UI language', () => {
    held({ shares: [CARA] });
    renderWithLocale(<HeldSharesScreen />, 'de');
    expect(screen.getByRole('button', { name: 'Code für @cara zeigen' })).toBeTruthy();
  });
});
