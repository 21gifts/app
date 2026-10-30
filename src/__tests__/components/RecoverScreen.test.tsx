import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RecoverScreen } from '@/components/RecoverScreen';
import type { OldWordsInputProps } from '@/components/OldWordsInput';
import { useRecoveryFlow, type UseRecoveryFlowResult } from '@/hooks/useRecoveryFlow';
import { returnToView } from '@/lib/view-history';
import type { RecoveryView } from '@/stores/recovery-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const router = { back: vi.fn(), push: vi.fn(), replace: vi.fn() };
const input = vi.hoisted(() => ({ props: null as OldWordsInputProps | null }));
const backResults = vi.hoisted(() => ({ list: [] as boolean[] }));

vi.mock('next/navigation', () => ({
  useRouter: (): typeof router => router,
}));
vi.mock('@/lib/view-history', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/view-history')>()),
  returnToView: vi.fn(),
}));
vi.mock('@/hooks/useRecoveryFlow', () => ({ useRecoveryFlow: vi.fn() }));
vi.mock('@/components/OldWordsInput', () => ({
  OldWordsInput: (props: OldWordsInputProps) => {
    input.props = props;
    return <p>Words input {props.mode}</p>;
  },
}));
vi.mock('@/components/HomeWordmark', () => ({
  HomeWordmark: () => <span>21.gifts</span>,
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

/** Nothing of the move done. */
const NONE = { account: false, address: false, signedIn: false, balance: false };

let flow: UseRecoveryFlowResult;

/**
 * Renders the screen on a view.
 *
 * @param view - The view.
 */
function show(view: RecoveryView): void {
  flow = {
    view,
    scan: vi.fn(),
    type: vi.fn(),
    onWords: vi.fn(),
    retry: vi.fn(),
    resume: vi.fn(),
    createPasskey: vi.fn(),
    transfer: vi.fn(),
    balanceLater: vi.fn(),
    startOver: vi.fn(),
    back: vi.fn(() => true),
  };
  vi.mocked(useRecoveryFlow).mockReturnValue(flow);
  renderWithLocale(<RecoverScreen />);
}

/** The found view of `@ada`. */
function found(
  patch: Partial<Extract<RecoveryView, { step: 'found' }>> = {},
): Extract<RecoveryView, { step: 'found' }> {
  return { step: 'found', username: 'ada', restart: false, error: null, busy: false, ...patch };
}

/** The transfer view. */
function moving(
  patch: Partial<Extract<RecoveryView, { step: 'transfer' }>> = {},
): Extract<RecoveryView, { step: 'transfer' }> {
  return { step: 'transfer', done: NONE, busy: false, waiting: false, error: null, ...patch };
}

beforeEach(() => {
  vi.clearAllMocks();
  input.props = null;
  backResults.list = [];
});

afterEach(cleanup);

describe('RecoverScreen', () => {
  it('starts with the title, what to have ready, and the two ways in', () => {
    show({ step: 'start' });
    expect(screen.getByRole('heading', { level: 1, name: 'Recover your account' })).toBeTruthy();
    expect(
      screen.getByText(
        'Meet the two people who keep your shares, or have your old 12 words ready.',
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Scan two codes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Type my 12 words' }));
    expect(flow.scan).toHaveBeenCalled();
    expect(flow.type).toHaveBeenCalled();
  });

  it('the arrow steps through the recovery flow', () => {
    show({ step: 'type' });
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(flow.back).toHaveBeenCalled();
    expect(backResults.list).toEqual([true]);
  });

  it('scans with the camera layer and a hidden title', () => {
    show({ step: 'scan' });
    expect(screen.getByRole('heading', { level: 1, name: 'Recover your account' }).className).toBe(
      'sr-only',
    );
    expect(screen.getByText('Words input scan')).toBeTruthy();
    expect(input.props?.onWords).toBe(flow.onWords);
    expect(input.props?.expectedOwnerAccountId).toBeUndefined();
  });

  it('types the words under the title', () => {
    show({ step: 'type' });
    expect(screen.getByText('Words input type')).toBeTruthy();
    expect(input.props?.onWords).toBe(flow.onWords);
  });

  it.each([
    [false, 'Opening the old wallet…'],
    [true, 'Checking the account. This can take a few minutes.'],
  ])('opening (waiting %s) says %s', (waiting, text) => {
    show({ step: 'opening', waiting });
    expect(screen.getByRole('status').textContent).toBe(text);
  });

  it('closed logins show the login card notice with Try again and Start over', () => {
    show({ step: 'blocked', kind: 'closed' });
    expect(screen.getByRole('status').textContent).toBe(
      '21.gifts is updating. Please try again a little later.',
    );
    expect(screen.queryByRole('button', { name: 'Reload' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(flow.resume).toHaveBeenCalledTimes(1);
    expect(flow.retry).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Start over' }));
    expect(flow.startOver).toHaveBeenCalledTimes(1);
  });

  it('an outdated build shows the new-version notice without Reload and nothing else to press', () => {
    show({ step: 'blocked', kind: 'outdated' });
    expect(screen.getByRole('status').textContent).toBe('A new version is ready');
    expect(screen.queryByRole('button', { name: 'Reload' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Start over' })).toBeNull();
  });

  it.each([
    ['not_found', 'These words do not belong to a 21.gifts account with a connected wallet.'],
    ['operator', 'This account cannot be recovered here. Contact 21.gifts.'],
    ['otherAccount', 'These codes belong to another account.'],
    ['noWallet', 'Recovery is not available in this version of the app.'],
  ] as const)('refused %s says so and offers Start over', (reason, text) => {
    show({ step: 'refused', reason });
    expect(screen.getByRole('alert').textContent).toBe(text);
    expect(screen.queryByRole('button', { name: 'Log in' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Start over' }));
    expect(flow.startOver).toHaveBeenCalled();
  });

  it('an account already recovered offers Log in, which returns to the login', () => {
    show({ step: 'refused', reason: 'done' });
    expect(screen.getByRole('alert').textContent).toBe(
      'This account was already recovered. Log in with your new passkey.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(flow.startOver).toHaveBeenCalled();
    expect(returnToView).toHaveBeenCalledWith('/login', router);
  });

  it.each([
    ['unavailable', 'The address service is not reachable right now. Try again in a minute.'],
    ['wallet', 'Your wallet could not be opened. Please try again.'],
  ] as const)('retry %s offers Try again and Start over', (reason, text) => {
    show({ step: 'retry', reason });
    expect(screen.getByRole('alert').textContent).toBe(text);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start over' }));
    expect(flow.retry).toHaveBeenCalled();
    expect(flow.startOver).toHaveBeenCalled();
  });

  it('found names the account and creates the new passkey', () => {
    show(found());
    expect(screen.getByRole('heading', { level: 2, name: 'Account @ada found.' })).toBeTruthy();
    expect(
      screen.getByText('Create a new passkey on this phone. It gets its own new 12 words.'),
    ).toBeTruthy();
    expect(screen.queryByText(/did not go through/)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    const button = screen.getByRole('button', { name: 'Create new passkey' }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    expect(flow.createPasskey).toHaveBeenCalled();
  });

  it('a busy passkey prompt disables the button', () => {
    show(found({ busy: true }));
    const button = screen.getByRole('button', { name: 'Create new passkey' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.querySelector('.animate-spin')).not.toBeNull();
  });

  it('a restart asks for the new passkey again', () => {
    show(found({ restart: true }));
    expect(
      screen.getByText('The move did not go through. Create the new passkey again.'),
    ).toBeTruthy();
  });

  it.each([
    ['cancelled', 'Could not set up a passkey. Please try again.'],
    ['timeout', 'The device prompt timed out before you finished. Try again.'],
    [
      'prf',
      'This phone or browser cannot hold a 21.gifts wallet. Please use an up-to-date phone or browser that supports passkeys.',
    ],
    ['wallet', 'Your wallet could not be opened. Please try again.'],
  ] as const)('found error %s says %s', (error, text) => {
    show(found({ error }));
    expect(screen.getByRole('alert').textContent).toBe(text);
  });

  it('transfer lists the three parts with a check for each part done', () => {
    show(moving({ done: { ...NONE, account: true } }));
    expect(screen.getByRole('heading', { level: 2, name: 'Move to this phone' })).toBeTruthy();
    const rows = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(rows.map((row) => row.textContent)).toEqual(['Account', '21.gifts address', 'Balance']);
    expect(within(rows[0]!).getByRole('img', { name: 'done' })).toBeTruthy();
    expect(within(rows[1]!).queryByRole('img')).toBeNull();
    expect(screen.queryByText('done')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Start over' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Transfer' }));
    expect(flow.transfer).toHaveBeenCalled();
  });

  it('a busy press that waits for the move shows the note and a disabled button', () => {
    show(moving({ busy: true, waiting: true, done: { ...NONE, account: true, address: true } }));
    expect(screen.getByRole('status').textContent).toBe(
      'Confirming the move. This can take a few minutes.',
    );
    const button = screen.getByRole('button', { name: 'Transfer' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.querySelector('.animate-spin')).not.toBeNull();
  });

  it('a generic error offers Start over, not Move the balance later', () => {
    show(moving({ error: 'generic' }));
    expect(screen.getByRole('alert').textContent).toBe(
      'Not everything was moved yet. Tap Transfer again to continue.',
    );
    expect(screen.queryByRole('button', { name: 'Move the balance later' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Start over' }));
    expect(flow.startOver).toHaveBeenCalled();
  });

  it('a balance error offers Move the balance later, not Start over', () => {
    show(
      moving({ error: 'balance', done: { ...NONE, account: true, address: true, signedIn: true } }),
    );
    expect(screen.getByRole('alert').textContent).toBe('The balance could not be moved yet.');
    expect(screen.queryByRole('button', { name: 'Start over' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Move the balance later' }));
    expect(flow.balanceLater).toHaveBeenCalled();
  });

  it.each([false, true])(
    'done (balance missing %s) links to the new words and the setup',
    (missing) => {
      show({ step: 'done', balanceMissing: missing });
      expect(screen.getByRole('heading', { level: 2, name: 'Your account is back' })).toBeTruthy();
      expect(
        screen.getByText(
          'Set up Social Recovery again for the new words. Old shares now only open the previous wallet.',
        ),
      ).toBeTruthy();
      expect(screen.queryByText(/Some balance stayed/) !== null).toBe(missing);
      expect(screen.getByRole('link', { name: 'Show new 12 words' }).getAttribute('href')).toBe(
        '/wallet/phrase',
      );
      expect(screen.getByRole('link', { name: 'Secure my account' }).getAttribute('href')).toBe(
        '/settings/social-recovery',
      );
    },
  );
});
