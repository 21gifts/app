import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HeldSharesScreen } from '@/components/HeldSharesScreen';
import type { QrScannerProps } from '@/components/QrScanner';
import type { Account } from '@/lib/api-types';
import { HELD_SHARES_KEY_PREFIX } from '@/lib/recovery-holder-store';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const scanner = vi.hoisted(() => ({ props: null as QrScannerProps | null }));
const backResults = vi.hoisted(() => ({ list: [] as boolean[] }));

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

/** Two shares of one recovery set (identifier 2864). */
const SHARES = [
  'body lily academic acid acne violence volume package glen escape prospect wealthy gesture venture legal already activity raspy camera easel',
  'body lily academic agency domain sugar learn owner kitchen exhaust aircraft sled fused dragon froth argue traveler reunion library geology',
] as const;

/** A share of another set (official SLIP-39 vector 43). */
const OTHER_SET =
  'enemy favorite academic acid cowboy phrase havoc level response walnut budget painting inside trash adjust froth kitchen learn tidy punish';

const HOLDER = 'acc_holder';
const HOLDER_KEY = `${HELD_SHARES_KEY_PREFIX}${HOLDER}`;

const account: Account = {
  id: HOLDER,
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
 * A share payload.
 *
 * @param share - Share words.
 * @param owner - Owner account id.
 * @param username - Owner username.
 * @returns The payload text.
 */
function code(share: string, owner = 'acc_bob', username = 'bob'): string {
  return `21gifts-share:v1:${owner}:${username}:${share}`;
}

/** Keeps Bob's and Cara's shares under the holder (Cara's is newer). */
function seedTwo(): void {
  window.localStorage.setItem(
    HOLDER_KEY,
    JSON.stringify({
      v: 1,
      shares: [
        { code: code(SHARES[0]), storedAt: 1_767_268_800_000 },
        { code: code(OTHER_SET, 'acc_cara', 'cara'), storedAt: 1_767_355_200_000 },
      ],
    }),
  );
}

/**
 * Presses Keep a share and hands the camera a text.
 *
 * @param text - The scanned text.
 */
function scan(text: string): void {
  fireEvent.click(screen.getByRole('button', { name: 'Keep a share' }));
  act(() => {
    scanner.props?.onResult(text);
  });
}

beforeEach(() => {
  window.localStorage.clear();
  scanner.props = null;
  backResults.list = [];
  useAuthStore.setState({ session: 'sess', account });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.localStorage.clear();
  useAuthStore.setState({ session: null, account: null });
});

describe('HeldSharesScreen', () => {
  it('renders nothing before the account has loaded', () => {
    useAuthStore.setState({ account: null });
    const { container } = renderWithLocale(<HeldSharesScreen />);
    expect(container.innerHTML).toBe('');
  });

  it('shows the title, the intro, Keep a share, and the empty line', () => {
    renderWithLocale(<HeldSharesScreen />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Shares I keep for others' }).className,
    ).not.toContain('sr-only');
    expect(
      screen.getByText(
        'Someone chose you to help restore their account. Keep their share here. Show it only to them, in person, when they ask.',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Keep a share' }).className).toContain('w-full');
    expect(screen.getByText('You keep no shares for others yet.')).toBeTruthy();
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('lists each kept share, newest first, with icon-only show and delete', () => {
    seedTwo();
    renderWithLocale(<HeldSharesScreen />);
    const items = screen.getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      '@caraKept since Jan 2, 2026',
      '@bobKept since Jan 1, 2026',
    ]);
    const show = screen.getByRole('button', { name: 'Show code for @bob' });
    const remove = screen.getByRole('button', { name: 'Delete share of @bob' });
    expect(screen.queryByText('Show code for @bob')).toBeNull();
    expect(screen.queryByText('Delete share of @bob')).toBeNull();
    expect(
      within(items[1] as HTMLElement).getByRole('button', { name: 'Show code for @bob' }),
    ).toBe(show);
    expect(remove.querySelector('svg')?.getAttribute('class')).toContain('text-app-danger');
    expect(screen.queryByText('You keep no shares for others yet.')).toBeNull();
  });

  it('opens the camera layer with the share wording and keeps a scanned share', () => {
    renderWithLocale(<HeldSharesScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Keep a share' }));
    const layer = screen.getByRole('region', { name: 'Keep a share' });
    expect(layer.hasAttribute('data-port-fill')).toBe(true);
    expect(layer.className).toContain('absolute inset-0');
    expect(layer.className).toContain('bg-black');
    expect(screen.getByRole('heading', { level: 1 }).className).toContain('sr-only');
    expect(scanner.props?.copy).toEqual({
      hint: 'heldShares.scanHint',
      denied: 'heldShares.cameraDenied',
      unavailable: 'heldShares.cameraUnavailable',
    });
    act(() => {
      scanner.props?.onResult(code(SHARES[0]));
    });
    expect(screen.queryByRole('region', { name: 'Keep a share' })).toBeNull();
    expect(screen.getByRole('status').textContent).toBe('You now keep a share for @bob.');
    expect(screen.getByRole('status').className).toContain('text-app-success');
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(window.localStorage.getItem(HOLDER_KEY)).toContain(SHARES[0]);
  });

  it.each([
    ['not a share', 'lightning:lnbc1', 'This is not a Social Recovery code.'],
    [
      'the member’s own share',
      code(SHARES[0], HOLDER, 'hal'),
      'This is a share of your own account. Only other people can keep it.',
    ],
  ])('refuses %s with an alert', (_label, text, message) => {
    renderWithLocale(<HeldSharesScreen />);
    scan(text);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toBe(message);
    expect(alert.className).toContain('text-app-danger');
    expect(screen.getByText('You keep no shares for others yet.')).toBeTruthy();
  });

  it('refuses a second share of one setup and names its owner', () => {
    window.localStorage.setItem(
      `${HELD_SHARES_KEY_PREFIX}acc_other`,
      JSON.stringify({ v: 1, shares: [{ code: code(SHARES[1]), storedAt: 1 }] }),
    );
    renderWithLocale(<HeldSharesScreen />);
    scan(code(SHARES[0]));
    expect(screen.getByRole('alert').textContent).toBe(
      'This phone already keeps a share of this setup for @bob. One phone keeps only one share of a setup.',
    );
  });

  it('says so when this browser cannot keep shares', () => {
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    renderWithLocale(<HeldSharesScreen />);
    scan(code(SHARES[0]));
    expect(screen.getByRole('alert').textContent).toBe(
      'This browser cannot keep shares. Allow site data and try again.',
    );
  });

  it('shows a share’s code for its owner, and the arrow steps back to the list', () => {
    seedTwo();
    renderWithLocale(<HeldSharesScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Show code for @bob' }));
    expect(screen.getByRole('heading', { level: 1 }).className).toContain('sr-only');
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Share of @bob');
    expect(
      screen.getByText('Show this code only to @bob in person, so they can restore their account.'),
    ).toBeTruthy();
    const qr = screen.getByRole('img', { name: 'Share code' });
    expect(qr.querySelector('image')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Keep a share' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(backResults.list).toEqual([true]);
    expect(screen.getByRole('button', { name: 'Keep a share' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(backResults.list).toEqual([true, false]);
  });

  it('steps back from the camera to the list', () => {
    renderWithLocale(<HeldSharesScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Keep a share' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(backResults.list).toEqual([true]);
    expect(screen.getByRole('button', { name: 'Keep a share' })).toBeTruthy();
  });

  it('confirms before a delete, keeps the share on cancel, and deletes it on confirm', () => {
    seedTwo();
    renderWithLocale(<HeldSharesScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete share of @bob' }));
    const confirm = screen.getByRole('group', {
      name: 'Delete the share of @bob? Only do this when they ask.',
    });
    expect(screen.queryByRole('button', { name: 'Delete share of @bob' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Show code for @bob' })).toBeTruthy();
    fireEvent.click(within(confirm).getByRole('button', { name: 'Keep' }));
    expect(screen.queryByRole('group')).toBeNull();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Delete share of @bob' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      '@caraKept since Jan 2, 2026',
    ]);
    expect(window.localStorage.getItem(HOLDER_KEY)).not.toContain(SHARES[0]);
  });

  it('formats the day in the UI language', () => {
    seedTwo();
    renderWithLocale(<HeldSharesScreen />, 'de');
    expect(screen.getByText('Aufbewahrt seit 02.01.2026')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Code für @cara zeigen' })).toBeTruthy();
  });
});
