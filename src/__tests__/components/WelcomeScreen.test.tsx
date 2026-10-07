import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { ChromeBackProvider } from '@/components/ViewHistoryRoot';
import { WelcomeScreen } from '@/components/WelcomeScreen';
import { useWallet, type UseWalletResult } from '@/hooks/useWallet';
import { useWalletSend, type UseWalletSendResult } from '@/hooks/useWalletSend';
import { FORUM_HOME_EVENT } from '@/lib/forum-feed';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/hooks/useWallet', () => ({ useWallet: vi.fn() }));
vi.mock('@/hooks/useWalletSend', () => ({ useWalletSend: vi.fn() }));
const askStep = vi.hoisted(() => ({ on: false }));
vi.mock('@/components/ForumLoader', async () => {
  const { useChromeBack } = await import('@/components/ViewHistoryRoot');
  const { useLayoutEffect, useState } = await import('react');
  /** Like an ask-wizard step: registers the Back it gets from its parent's render. */
  function AskStep({ onBack }: { onBack: () => void }): ReactNode {
    const { setOverride } = useChromeBack();
    useLayoutEffect(() => {
      if (askStep.on) {
        setOverride({ labelKey: 'forum.askBack', onClick: onBack });
      }
    }, [onBack, setOverride]);
    return <p>Forum stub</p>;
  }
  /** Re-renders on demand, so the ask step registers its Back again (a new callback). */
  function Forum(): ReactNode {
    const [renders, setRenders] = useState(0);
    return (
      <>
        <button
          type="button"
          onClick={() => {
            setRenders(renders + 1);
          }}
        >
          Forum re-render
        </button>
        <AskStep onBack={() => undefined} />
      </>
    );
  }
  return {
    ForumLoader: Forum,
  };
});
vi.mock('@/components/WalletPanelView', () => ({
  WalletPanelView: ({ panel }: { panel: string }) => <p>Panel {panel}</p>,
}));

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('next/navigation', () => ({
  useRouter: (): { push: (href: string) => void } => ({ push: vi.fn() }),
  usePathname: (): string => '/',
  useSearchParams: (): URLSearchParams => new URLSearchParams(),
}));

vi.mock('@/lib/api', () => ({
  fetchMessages: vi.fn().mockResolvedValue({ messages: [], nextCursor: null }),
  postMessage: vi.fn(),
  fetchMessagePhoto: vi.fn(),
  fetchReplies: vi.fn(),
  openConversation: vi.fn(),
  postMessageInvoice: vi.fn(),
  dismissForumLaws: vi.fn(),
  fetchGiftStats: vi.fn().mockResolvedValue({ spendOverTime: [] }),
  markNotificationsReadForMessage: vi.fn().mockResolvedValue({ ok: true, tags: [] }),
}));

function walletWith(status: UseWalletResult['status']): UseWalletResult {
  return { status, balanceSats: null, unlock: vi.fn(), retry: vi.fn(), prfUnsupported: false };
}

const SEND: UseWalletSendResult = {
  state: { step: 'input', error: null },
  busy: false,
  sending: false,
  text: '',
  setText: vi.fn(),
  comment: '',
  setComment: vi.fn(),
  submitInput: vi.fn(),
  submitAmount: vi.fn(),
  setSpeed: vi.fn(),
  confirm: vi.fn(),
  cancel: vi.fn(() => false),
  abandon: vi.fn(),
};

/** The welcome screen under the chrome back slot, as `/welcome` mounts it. */
function renderWelcome(): void {
  renderWithLocale(
    <ChromeBackProvider>
      <ProfileChromeLeft hideHistoryArrow />
      <WelcomeScreen />
    </ChromeBackProvider>,
  );
}

beforeEach(() => {
  vi.mocked(useWallet).mockReturnValue(walletWith('disabled'));
  vi.mocked(useWalletSend).mockReturnValue(SEND);
  useAuthStore.setState({
    session: 'tok',
    account: {
      id: 'acc_1',
      linkingKey: null,
      role: 'basis',
      name: 'Ada',
      location: null,
      lightningAddress: null,
      lightningAddressVerified: false,
      forumLawsDismissed: false,
      createdAt: 1,
      rulesAgreedAt: 1_700_000_001,
      viewKey: 'a'.repeat(64),
      aboutMe: null,
      aboutMeHasPhoto: false,
      setup: null,
      missing: [],
    },
  });
});

afterEach(() => {
  cleanup();
});

describe('WelcomeScreen', () => {
  it('shows a welcome without name or address forms', async () => {
    renderWithLocale(<WelcomeScreen />);
    expect(screen.getByRole('heading', { name: 'Welcome, Ada' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /send a gift/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /unlink/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /save name/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /log out/i })).toBeNull();
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Welcome, Ada' })).toBeTruthy();
    });
  });

  it('still renders a welcome heading when the store has no name', () => {
    useAuthStore.setState({
      session: 'tok',
      account: {
        id: 'acc_1',
        linkingKey: null,
        role: 'basis',
        name: null,
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        aboutMeHasPhoto: false,
        setup: null,
        missing: [],
      },
    });
    renderWithLocale(<WelcomeScreen />);
    expect(screen.getByRole('heading', { name: /Welcome/ })).toBeTruthy();
  });
});

describe('WelcomeScreen wallet', () => {
  it('shows no Receive or Send without a configured wallet or when signed out', () => {
    renderWelcome();
    expect(screen.queryByRole('button', { name: 'Receive' })).toBeNull();
    cleanup();
    vi.mocked(useWallet).mockReturnValue(walletWith('ready'));
    useAuthStore.setState({ session: null, account: null });
    renderWelcome();
    expect(screen.queryByRole('button', { name: 'Receive' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  });

  it('opens Receive over the hidden feed with the top-left Back, and Back returns to the feed', () => {
    vi.mocked(useWallet).mockReturnValue(walletWith('ready'));
    renderWelcome();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Receive' }));
    expect(screen.getByText('Panel receive')).toBeTruthy();
    expect(
      screen.getByRole('heading', { name: 'Welcome, Ada', hidden: true }).closest('.hidden'),
    ).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Receive' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.queryByText('Panel receive')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Welcome, Ada' }).closest('.hidden')).toBeNull();
    expect(screen.getByRole('button', { name: 'Receive' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  });

  it('opens Send while ready, and the forum home event closes it', () => {
    vi.mocked(useWallet).mockReturnValue(walletWith('ready'));
    renderWelcome();
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(screen.getByText('Panel send')).toBeTruthy();
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    act(() => {
      window.dispatchEvent(new Event(FORUM_HOME_EVENT));
    });
    expect(screen.queryByText('Panel send')).toBeNull();
    expect(screen.getByRole('button', { name: 'Send' })).toBeTruthy();
  });

  it('disables Send while the wallet connects', () => {
    vi.mocked(useWallet).mockReturnValue(walletWith('connecting'));
    renderWelcome();
    expect((screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('WelcomeScreen with an ask step', () => {
  afterEach(() => {
    askStep.on = false;
  });

  it('does not re-render the forum when an ask step sets the top-left Back, also with a wallet view open', () => {
    askStep.on = true;
    vi.mocked(useWallet).mockReturnValue(walletWith('ready'));
    renderWelcome();
    expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Receive' }));
    expect(screen.getByText('Panel receive')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.queryByText('Panel receive')).toBeNull();
    expect(screen.getByText('Forum stub')).toBeTruthy();
  });

  it('keeps the wallet view Back on top when the hidden ask step registers again', () => {
    askStep.on = true;
    vi.mocked(useWallet).mockReturnValue(walletWith('ready'));
    renderWelcome();
    fireEvent.click(screen.getByRole('button', { name: 'Receive' }));
    fireEvent.click(screen.getByRole('button', { name: 'Forum re-render' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.queryByText('Panel receive')).toBeNull();
  });
});
