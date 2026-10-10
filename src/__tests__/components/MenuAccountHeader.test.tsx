import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MenuAccountHeader } from '@/components/MenuAccountHeader';
import { useSpotRate } from '@/hooks/useSpotRate';
import { useMyLoans } from '@/hooks/useMyLoans';
import { useWallet, type UseWalletResult } from '@/hooks/useWallet';
import { fetchAccountActivity, fetchMember, fetchProfilePhoto } from '@/lib/api';
import type { Account, AccountActivity, MemberProfile } from '@/lib/api-types';
import type { FiatRateDay } from '@/lib/stats-money';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    onClick,
    className,
  }: {
    href: string;
    children: ReactNode;
    onClick?: () => void;
    className?: string;
  }) => (
    <a
      href={href}
      className={className}
      onClick={(event) => {
        event.preventDefault();
        onClick?.();
      }}
    >
      {children}
    </a>
  ),
}));

vi.mock('@/hooks/useWallet', () => ({ useWallet: vi.fn() }));
vi.mock('@/hooks/useSpotRate', () => ({ useSpotRate: vi.fn() }));
vi.mock('@/hooks/useMyLoans', () => ({ useMyLoans: vi.fn() }));
vi.mock('@/lib/api', () => ({
  fetchAccountActivity: vi.fn(),
  fetchMember: vi.fn(),
  fetchProfilePhoto: vi.fn(),
}));

const RATE_DAY: FiatRateDay = {
  sats: 100_000_000,
  usd: '100000.00',
  chf: '80000.00',
  eur: '90000.00',
  php: '5600000.00',
};

const ACTIVITY = {
  donatedSats: 2_100,
  receivedSats: 21_000,
  donatedOverTime: [],
  receivedOverTime: [],
} as unknown as AccountActivity;

const MEMBER = { postCount: 7 } as MemberProfile;

let sessionCount = 0;

/** A fresh session, so the per-session cache of an earlier test never applies. */
function signIn(account: Partial<Account> = {}): string {
  sessionCount += 1;
  const session = `sess-${sessionCount}`;
  useAuthStore.setState({
    session,
    account: { id: 'acc_1', name: 'Ada', username: 'ada', ...account } as Account,
  });
  return session;
}

function walletWith(
  status: UseWalletResult['status'],
  balanceSats: number | null = null,
): UseWalletResult {
  return { status, balanceSats, retry: vi.fn(), setupFailed: false };
}

/** Lets the settled fetches reach the component. */
async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function statRow(): HTMLElement {
  return document.querySelector('dl') as HTMLElement;
}

beforeEach(() => {
  vi.mocked(useWallet).mockReturnValue(walletWith('disabled'));
  vi.mocked(useSpotRate).mockReturnValue(RATE_DAY);
  vi.mocked(useMyLoans).mockReturnValue({ loans: null, reload: vi.fn() });
  vi.mocked(fetchAccountActivity).mockReset().mockResolvedValue(ACTIVITY);
  vi.mocked(fetchMember).mockReset().mockResolvedValue(MEMBER);
  vi.mocked(fetchProfilePhoto).mockReset().mockRejectedValue(new Error('none'));
  Object.assign(URL, {
    createObjectURL: vi.fn(() => 'blob:photo'),
    revokeObjectURL: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  useAuthStore.setState({ session: null, account: null });
});

describe('MenuAccountHeader', () => {
  it('shows a payable loan row and closes the Menu from Send', () => {
    const onNavigate = vi.fn();
    signIn();
    vi.mocked(useMyLoans).mockReturnValue({
      loans: {
        sundayRest: false,
        loans: [
          {
            due: {
              payableSats: 1_000,
              payablePeople: 1,
              waitingSats: 0,
              waitingPeople: 0,
              behindDays: 2,
              payableAmount: null,
              waitingAmount: null,
              lastPayment: false,
            },
            fundedAt: '2026-10-01',
            goalSats: 10_000,
            sats: 10_000,
            next: null,
          } as never,
        ],
      },
      reload: vi.fn(),
    });
    renderWithLocale(<MenuAccountHeader onNavigate={onNavigate} tight={false} open />);
    expect(screen.getByText("You're behind on your loan")).toBeTruthy();
    expect(screen.getByText("₿1'000").textContent).toBe("₿1'000 · $1.00");
    const send = screen.getByRole('link', { name: 'Send' });
    expect(send.getAttribute('href')).toBe('/loans/repay');
    fireEvent.click(send);
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it('shows the ordinary due label and foreground amount without a spot rate', () => {
    signIn();
    vi.mocked(useSpotRate).mockReturnValue(null);
    vi.mocked(useMyLoans).mockReturnValue({
      loans: {
        sundayRest: false,
        loans: [
          {
            due: {
              payableSats: 1_000,
              payablePeople: 1,
              waitingSats: 0,
              waitingPeople: 0,
              behindDays: 0,
              payableAmount: null,
              waitingAmount: null,
              lastPayment: false,
            },
            fundedAt: '2026-10-01',
            goalSats: 10_000,
            sats: 10_000,
            next: null,
          } as never,
        ],
      },
      reload: vi.fn(),
    });
    renderWithLocale(<MenuAccountHeader onNavigate={vi.fn()} tight={false} open />);
    expect(screen.getByText('Loan repayment due today').className).toContain('text-app-muted');
    expect(screen.getByText("₿1'000").className).toContain('text-app-fg');
    expect(screen.getByText("₿1'000").textContent).toBe("₿1'000");
  });

  it('renders nothing when signed out', () => {
    const { container } = renderWithLocale(
      <MenuAccountHeader onNavigate={vi.fn()} tight={false} open />,
    );
    expect(container.innerHTML).toBe('');
    expect(fetchAccountActivity).not.toHaveBeenCalled();
  });

  it.each([
    ['the stored session is still being checked', null],
    ['the session has no account yet', 'sess-x'],
  ] as const)(
    'holds its final size with skeletons while %s, and the account replaces them in place',
    (_case, session) => {
      localStorage.setItem('21gifts.session', 'sess-stored');
      useAuthStore.setState({ session, account: null });
      const { container } = renderWithLocale(
        <MenuAccountHeader onNavigate={vi.fn()} tight={false} open />,
      );
      const card = container.firstElementChild as HTMLElement;
      const avatar = card.querySelector('.rounded-full') as HTMLElement;
      expect(avatar.className).toContain('h-10 w-10');
      expect(avatar.className).toContain('animate-pulse');
      expect(avatar.textContent).toBe('');
      const identityLines = (): (string | undefined)[] =>
        Array.from(card.querySelectorAll('.flex-1.flex-col > span')).map(
          (line) => line.className.match(/\bh-[\d.]+\b/)?.[0],
        );
      const pending = identityLines();
      expect(pending).toEqual(['h-5', 'h-4']);
      expect(card.querySelectorAll('.flex-1.flex-col .animate-pulse')).toHaveLength(2);
      expect(statRow().querySelectorAll('.animate-pulse')).toHaveLength(5);
      expect(screen.queryByText(/^@/)).toBeNull();
      expect(screen.queryByRole('link')).toBeNull();
      expect(fetchAccountActivity).not.toHaveBeenCalled();
      act(() => {
        signIn();
      });
      expect(screen.getByText('Ada')).toBeTruthy();
      expect(screen.getByText('@ada')).toBeTruthy();
      expect(identityLines()).toEqual(pending);
      expect(screen.getByRole('link', { name: 'Open your profile Ada @ada' })).toBeTruthy();
      expect(card.querySelectorAll('.flex-1.flex-col .animate-pulse')).toHaveLength(0);
    },
  );

  it('drops the pending card when the stored session is rejected while the Menu is open', () => {
    localStorage.setItem('21gifts.session', 'sess-stored');
    const { container } = renderWithLocale(
      <MenuAccountHeader onNavigate={vi.fn()} tight={false} open />,
    );
    expect(statRow().querySelectorAll('.animate-pulse')).toHaveLength(5);
    act(() => {
      useAuthStore.getState().clearAuth();
    });
    expect(container.innerHTML).toBe('');
  });

  it('holds its space in the compact Menu too, and stays closed while the Menu is', () => {
    localStorage.setItem('21gifts.session', 'sess-stored');
    const view = renderWithLocale(<MenuAccountHeader onNavigate={vi.fn()} tight open={false} />);
    expect(view.container.innerHTML).toBe('');
    view.rerender(<MenuAccountHeader onNavigate={vi.fn()} tight open />);
    const card = view.container.firstElementChild as HTMLElement;
    expect(card.className).toContain('mt-2');
    expect(statRow().querySelectorAll('.animate-pulse')).toHaveLength(5);
  });

  it('shows the initial, name, and @username, and skeletons that become values without changing height', async () => {
    const session = signIn();
    renderWithLocale(<MenuAccountHeader onNavigate={vi.fn()} tight={false} open />);
    expect(screen.getByText('Ada')).toBeTruthy();
    expect(screen.getByText('@ada')).toBeTruthy();
    expect(screen.getByText('A').getAttribute('aria-hidden')).toBe('true');
    const loadingLines = Array.from(statRow().querySelectorAll('dd > span')).map(
      (line) => line.className.match(/\bh-[\d.]+\b/)?.[0],
    );
    expect(statRow().querySelectorAll('.animate-pulse')).toHaveLength(5);
    await settle();
    expect(fetchAccountActivity).toHaveBeenCalledWith(session);
    expect(fetchMember).toHaveBeenCalledWith(session, 'acc_1');
    expect(statRow().querySelectorAll('.animate-pulse')).toHaveLength(0);
    const loadedLines = Array.from(statRow().querySelectorAll('dd > span')).map(
      (line) => line.className.match(/\bh-[\d.]+\b/)?.[0],
    );
    expect(loadedLines).toEqual(loadingLines);
    const cells = statRow().querySelectorAll(':scope > div');
    expect(within(cells[0] as HTMLElement).getByText('Received')).toBeTruthy();
    expect(within(cells[0] as HTMLElement).getByText("₿21'000")).toBeTruthy();
    expect(within(cells[0] as HTMLElement).getByText('$21.00')).toBeTruthy();
    expect(within(cells[1] as HTMLElement).getByText('Given')).toBeTruthy();
    expect(within(cells[1] as HTMLElement).getByText("₿2'100")).toBeTruthy();
    expect(within(cells[1] as HTMLElement).getByText('$2.10')).toBeTruthy();
    expect(within(cells[2] as HTMLElement).getByText('Posts')).toBeTruthy();
    expect(within(cells[2] as HTMLElement).getByText('7')).toBeTruthy();
  });

  it('reuses the loaded stats on the next mount in the same session', async () => {
    signIn();
    const first = renderWithLocale(<MenuAccountHeader onNavigate={vi.fn()} tight={false} open />);
    await settle();
    first.unmount();
    renderWithLocale(<MenuAccountHeader onNavigate={vi.fn()} tight={false} open />);
    expect(statRow().querySelectorAll('.animate-pulse')).toHaveLength(0);
    expect(screen.getByText('7')).toBeTruthy();
    expect(fetchAccountActivity).toHaveBeenCalledTimes(1);
  });

  it('shares one load between two mounts at once', async () => {
    signIn();
    renderWithLocale(
      <>
        <MenuAccountHeader onNavigate={vi.fn()} tight={false} open />
        <MenuAccountHeader onNavigate={vi.fn()} tight open />
      </>,
    );
    await settle();
    expect(fetchAccountActivity).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText('7')).toHaveLength(2);
  });

  it('shows a dash for values that could not be read, without fiat, and tries again on the next mount', async () => {
    signIn();
    vi.mocked(fetchAccountActivity).mockRejectedValue(new Error('down'));
    vi.mocked(fetchMember).mockResolvedValue(null);
    const first = renderWithLocale(<MenuAccountHeader onNavigate={vi.fn()} tight={false} open />);
    await settle();
    expect(within(statRow()).getAllByText('–')).toHaveLength(3);
    expect(within(statRow()).queryByText(/\$/)).toBeNull();
    first.unmount();
    vi.mocked(fetchAccountActivity).mockResolvedValue(ACTIVITY);
    vi.mocked(fetchMember).mockRejectedValue(new Error('down'));
    const second = renderWithLocale(<MenuAccountHeader onNavigate={vi.fn()} tight={false} open />);
    await settle();
    expect(fetchAccountActivity).toHaveBeenCalledTimes(2);
    expect(screen.getByText("₿21'000")).toBeTruthy();
    second.unmount();
    renderWithLocale(<MenuAccountHeader onNavigate={vi.fn()} tight={false} open />);
    await settle();
    expect(fetchAccountActivity).toHaveBeenCalledTimes(3);
  });

  it('drops a load that settles after unmount', async () => {
    signIn();
    let finish: (value: AccountActivity) => void = () => undefined;
    vi.mocked(fetchAccountActivity).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const view = renderWithLocale(<MenuAccountHeader onNavigate={vi.fn()} tight={false} open />);
    view.unmount();
    finish(ACTIVITY);
    await settle();
    expect(screen.queryByText('7')).toBeNull();
  });

  it('shows the profile photo, and replaces the cached one when a new session loads', async () => {
    signIn();
    vi.mocked(fetchProfilePhoto).mockResolvedValue(new Blob(['x'], { type: 'image/jpeg' }));
    const first = renderWithLocale(<MenuAccountHeader onNavigate={vi.fn()} tight={false} open />);
    await settle();
    const profile = screen.getByRole('link', { name: 'Open your profile Ada @ada' });
    const photo = profile.querySelector('img') as HTMLImageElement;
    expect(photo.getAttribute('src')).toBe('blob:photo');
    expect(photo.getAttribute('alt')).toBe('');
    first.unmount();
    signIn();
    renderWithLocale(<MenuAccountHeader onNavigate={vi.fn()} tight={false} open />);
    await settle();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:photo');
  });

  it('ignores a photo answer that is not an image and falls back to the username initial', async () => {
    signIn({ name: '  ' });
    vi.mocked(fetchProfilePhoto).mockResolvedValue(new Blob(['x'], { type: 'text/html' }));
    renderWithLocale(<MenuAccountHeader onNavigate={vi.fn()} tight={false} open />);
    await settle();
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('A')).toBeTruthy();
    expect(screen.getByText('@ada')).toBeTruthy();
  });

  it('shows an empty initial without name or username', () => {
    signIn({ name: null, username: null });
    const { container } = renderWithLocale(
      <MenuAccountHeader onNavigate={vi.fn()} tight={false} open />,
    );
    expect(container.querySelector('span[aria-hidden="true"].rounded-full')?.textContent).toBe('');
    expect(screen.queryByText(/^@/)).toBeNull();
  });

  it('makes the photo or initial, name, and @username one link to /profile that closes the Menu', () => {
    signIn();
    const onNavigate = vi.fn();
    renderWithLocale(<MenuAccountHeader onNavigate={onNavigate} tight={false} open />);
    const profile = screen.getByRole('link', { name: 'Open your profile Ada @ada' });
    expect(profile.getAttribute('href')).toBe('/profile');
    expect(profile.className).toContain('min-h-11');
    expect(within(profile).getByText('A').getAttribute('aria-hidden')).toBe('true');
    expect(within(profile).getByText('Ada')).toBeTruthy();
    expect(within(profile).getByText('@ada')).toBeTruthy();
    expect(statRow().closest('a')).toBeNull();
    fireEvent.click(within(profile).getByText('@ada'));
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it('keeps the profile link and the balance link apart', async () => {
    signIn();
    vi.mocked(useWallet).mockReturnValue(walletWith('ready', 21_000));
    const onNavigate = vi.fn();
    renderWithLocale(<MenuAccountHeader onNavigate={onNavigate} tight={false} open />);
    await settle();
    const profile = screen.getByRole('link', { name: 'Open your profile Ada @ada' });
    const balance = screen.getByRole('link', { name: "Balance ₿21'000 $21.00" });
    expect(profile.contains(balance)).toBe(false);
    expect(balance.contains(profile)).toBe(false);
    fireEvent.click(balance);
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it('shows the ready balance with fiat as a link to /wallet that closes the Menu', async () => {
    signIn();
    vi.mocked(useWallet).mockReturnValue(walletWith('ready', 21_000));
    const onNavigate = vi.fn();
    renderWithLocale(<MenuAccountHeader onNavigate={onNavigate} tight={false} open />);
    await settle();
    const link = screen.getByRole('link', { name: "Balance ₿21'000 $21.00" });
    expect(link.getAttribute('href')).toBe('/wallet');
    expect(within(link).getByText("₿21'000")).toBeTruthy();
    expect(within(link).getByText('$21.00')).toBeTruthy();
    fireEvent.click(link);
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it('keeps the balance fiat line empty without a usable rate', async () => {
    signIn();
    vi.mocked(useSpotRate).mockReturnValue(null);
    vi.mocked(useWallet).mockReturnValue(walletWith('ready', 21_000));
    renderWithLocale(<MenuAccountHeader onNavigate={vi.fn()} tight={false} open />);
    await settle();
    expect(screen.queryByText(/\$/)).toBeNull();
  });

  it.each([
    ['connecting', null],
    ['ready', null],
  ] as const)(
    'shows a balance skeleton while the wallet is %s without a balance',
    (status, balance) => {
      signIn();
      vi.mocked(useWallet).mockReturnValue(walletWith(status, balance));
      renderWithLocale(<MenuAccountHeader onNavigate={vi.fn()} tight={false} open />);
      const pending = screen.getByRole('status', { name: 'Opening your wallet…' });
      expect(pending.querySelectorAll('.animate-pulse')).toHaveLength(2);
    },
  );

  it.each(['error', 'disabled'] as const)('shows no balance while the wallet is %s', (status) => {
    signIn();
    vi.mocked(useWallet).mockReturnValue(walletWith(status));
    renderWithLocale(<MenuAccountHeader onNavigate={vi.fn()} tight={false} open />);
    expect(screen.getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
      '/profile',
    ]);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('adds top spacing in the compact Menu', () => {
    signIn();
    const { container } = renderWithLocale(<MenuAccountHeader onNavigate={vi.fn()} tight open />);
    expect((container.firstElementChild as HTMLElement).className).toContain('mt-2');
  });

  it('loads while the Menu is closed but renders nothing until it opens', async () => {
    signIn();
    const view = renderWithLocale(
      <MenuAccountHeader onNavigate={vi.fn()} tight={false} open={false} />,
    );
    expect(view.container.innerHTML).toBe('');
    await settle();
    expect(fetchAccountActivity).toHaveBeenCalledTimes(1);
    view.rerender(<MenuAccountHeader onNavigate={vi.fn()} tight={false} open />);
    expect(screen.getByText('7')).toBeTruthy();
  });

  it('creates no photo URL when the stats read failed', async () => {
    signIn();
    vi.mocked(fetchProfilePhoto).mockResolvedValue(new Blob(['x'], { type: 'image/jpeg' }));
    vi.mocked(fetchMember).mockRejectedValue(new Error('down'));
    renderWithLocale(<MenuAccountHeader onNavigate={vi.fn()} tight={false} open />);
    await settle();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('keeps the newer session when an older load settles last', async () => {
    let finishOld: (value: AccountActivity) => void = () => undefined;
    vi.mocked(fetchAccountActivity).mockReturnValueOnce(
      new Promise((resolve) => {
        finishOld = resolve;
      }),
    );
    vi.mocked(fetchProfilePhoto).mockResolvedValue(new Blob(['x'], { type: 'image/jpeg' }));
    signIn();
    const old = renderWithLocale(<MenuAccountHeader onNavigate={vi.fn()} tight={false} open />);
    old.unmount();
    signIn();
    renderWithLocale(<MenuAccountHeader onNavigate={vi.fn()} tight={false} open />);
    await settle();
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    finishOld(ACTIVITY);
    await settle();
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    expect(document.querySelector('img')?.getAttribute('src')).toBe('blob:photo');
  });

  it('keeps nothing from a load that settles after sign-out, and drops the cache when the session changes', async () => {
    let finish: (value: AccountActivity) => void = () => undefined;
    vi.mocked(fetchAccountActivity).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    vi.mocked(fetchProfilePhoto).mockResolvedValue(new Blob(['x'], { type: 'image/jpeg' }));
    signIn();
    const view = renderWithLocale(<MenuAccountHeader onNavigate={vi.fn()} tight={false} open />);
    act(() => {
      useAuthStore.setState({ session: null, account: null });
    });
    finish(ACTIVITY);
    await settle();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    view.unmount();

    signIn();
    const second = renderWithLocale(<MenuAccountHeader onNavigate={vi.fn()} tight={false} open />);
    await settle();
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    act(() => {
      useAuthStore.setState({ session: null, account: null });
    });
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:photo');
    second.unmount();
  });

  it('drops the cache when the session ends while no header is mounted', async () => {
    vi.mocked(fetchProfilePhoto).mockResolvedValue(new Blob(['x'], { type: 'image/jpeg' }));
    signIn();
    const view = renderWithLocale(<MenuAccountHeader onNavigate={vi.fn()} tight={false} open />);
    await settle();
    view.unmount();
    useAuthStore.setState({ session: null, account: null });
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:photo');
  });
});
