import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/AppShell';
import type { ForumWriter } from '@/components/ForumBoard';
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
const askStep = vi.hoisted(() => ({ on: false, inWriter: false, back: vi.fn() }));
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
  /** Like an ask-wizard step inside the writer: mounts with it and registers its own Back. */
  function WriterAskStep(): ReactNode {
    const { setOverride } = useChromeBack();
    useLayoutEffect(() => {
      setOverride({ labelKey: 'forum.askBack', onClick: askStep.back });
      return () => {
        setOverride(null);
      };
    }, [setOverride]);
    return <p>Writer ask step</p>;
  }
  /**
   * Re-renders on demand, so the ask step registers its Back again (a new callback).
   * Shows a stand-in writer while `writer.open`, with a field and a successful post.
   */
  function Forum({ writer }: { writer?: ForumWriter }): ReactNode {
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
        <button type="button" onClick={() => writer?.onOpen()}>
          Stub compose request
        </button>
        <button type="button" onClick={() => writer?.onClose()}>
          Stub late post
        </button>
        {writer?.open === true ? (
          <div data-testid="writer">
            <textarea aria-label="Writer field" />
            {askStep.inWriter ? <WriterAskStep /> : null}
            <button type="button" onClick={writer.onClose}>
              Stub posted
            </button>
          </div>
        ) : null}
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
  fetchFxSpot: vi
    .fn()
    .mockResolvedValue({ asOf: '2026-10-07T00:00:00.000Z', source: 'test', rates: {} }),
  markNotificationsReadForMessage: vi.fn().mockResolvedValue({ ok: true, tags: [] }),
}));

function walletWith(status: UseWalletResult['status']): UseWalletResult {
  return { status, balanceSats: null, retry: vi.fn(), setupFailed: false };
}

const SEND: UseWalletSendResult = {
  state: { step: 'input', error: null },
  busy: false,
  walletWait: null,
  retryWallet: vi.fn(),
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

describe('WelcomeScreen writer', () => {
  afterEach(() => {
    askStep.inWriter = false;
    askStep.back.mockClear();
  });

  it('shows no + while signed out', () => {
    useAuthStore.setState({ session: null, account: null });
    renderWelcome();
    expect(screen.queryByRole('button', { name: 'Write a post' })).toBeNull();
  });

  it('floats an icon-only + at the bottom right, above Receive / Send when they are there', () => {
    renderWelcome();
    const plus = screen.getByRole('button', { name: 'Write a post' });
    expect(plus.textContent).toBe('');
    expect(plus.className).toContain('h-14 w-14');
    expect(plus.className).toContain('bg-app-btn text-app-btn-fg');
    expect(plus.className).toContain('absolute right-[11px] bottom-6 z-30 shadow-lg');
    expect(plus.className).toContain(
      'group-has-[[data-footer-actions]]/body:bottom-[calc(4.75rem+23px-1.75rem*var(--footer-collapse,0))]',
    );
    expect(plus.className).toContain('group-data-[footer-snap]/body:ease-glide');
    expect(plus.querySelector('svg')?.getAttribute('class')).toContain('lucide-plus');
  });

  it('opens the writer on +, hides the +, and the top-left Back closes it with the focus taken out', () => {
    renderWelcome();
    expect(screen.queryByTestId('writer')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Write a post' }));
    expect(screen.getByTestId('writer')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Write a post' })).toBeNull();
    const field = screen.getByRole('textbox', { name: 'Writer field' });
    field.focus();
    expect(document.activeElement).toBe(field);
    const blur = vi.fn();
    field.addEventListener('blur', blur);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(blur).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('writer')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Write a post' })).toBeTruthy();
  });

  it('closes after a successful post, on the forum home event, and opens on a compose request', () => {
    renderWelcome();
    fireEvent.click(screen.getByRole('button', { name: 'Stub compose request' }));
    expect(screen.getByTestId('writer')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Stub posted' }));
    expect(screen.queryByTestId('writer')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Write a post' }));
    act(() => {
      window.dispatchEvent(new Event(FORUM_HOME_EVENT));
    });
    expect(screen.queryByTestId('writer')).toBeNull();
  });

  it('steps back through an Ask step inside the writer before the arrow closes it', () => {
    askStep.inWriter = true;
    renderWelcome();
    fireEvent.click(screen.getByRole('button', { name: 'Write a post' }));
    expect(screen.getByText('Writer ask step')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(askStep.back).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('writer')).toBeTruthy();
  });

  it('hides the + while a wallet view is open', () => {
    vi.mocked(useWallet).mockReturnValue(walletWith('ready'));
    renderWelcome();
    expect(screen.getByRole('button', { name: 'Write a post' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Receive' }));
    expect(screen.queryByRole('button', { name: 'Write a post' })).toBeNull();
  });

  it('brings the feed back at the scroll position it had when the writer opened', () => {
    const view = renderWithLocale(
      <ChromeBackProvider>
        <AppShell mode="fill" topLeft={<ProfileChromeLeft hideHistoryArrow />}>
          <WelcomeScreen />
        </AppShell>
      </ChromeBackProvider>,
    );
    const port = view.container.querySelector('[data-scrollport]') as HTMLElement;
    port.scrollTop = 240;
    fireEvent.click(screen.getByRole('button', { name: 'Write a post' }));
    port.scrollTop = 0;
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(port.scrollTop).toBe(240);
    // Closing again without a new opening leaves the page where it is.
    port.scrollTop = 30;
    act(() => {
      window.dispatchEvent(new Event(FORUM_HOME_EVENT));
    });
    expect(port.scrollTop).toBe(30);
  });

  it('shows the top of the feed after a post, and leaves Home its own scroll to the top', () => {
    const view = renderWithLocale(
      <ChromeBackProvider>
        <AppShell mode="fill" topLeft={<ProfileChromeLeft hideHistoryArrow />}>
          <WelcomeScreen />
        </AppShell>
      </ChromeBackProvider>,
    );
    const port = view.container.querySelector('[data-scrollport]') as HTMLElement;
    port.scrollTop = 240;
    fireEvent.click(screen.getByRole('button', { name: 'Write a post' }));
    fireEvent.click(screen.getByRole('button', { name: 'Stub posted' }));
    expect(screen.queryByTestId('writer')).toBeNull();
    expect(port.scrollTop).toBe(0);
    port.scrollTop = 240;
    fireEvent.click(screen.getByRole('button', { name: 'Write a post' }));
    port.scrollTop = 12;
    act(() => {
      window.dispatchEvent(new Event(FORUM_HOME_EVENT));
    });
    expect(screen.queryByTestId('writer')).toBeNull();
    expect(port.scrollTop).toBe(12);
  });

  it('leaves the page and its focus alone when a post completes after the writer closed', () => {
    const view = renderWithLocale(
      <ChromeBackProvider>
        <AppShell mode="fill" topLeft={<ProfileChromeLeft hideHistoryArrow />}>
          <WelcomeScreen />
        </AppShell>
      </ChromeBackProvider>,
    );
    const port = view.container.querySelector('[data-scrollport]') as HTMLElement;
    port.scrollTop = 300;
    fireEvent.click(screen.getByRole('button', { name: 'Write a post' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.queryByTestId('writer')).toBeNull();
    expect(port.scrollTop).toBe(300);
    port.scrollTop = 140;
    const field = screen.getByRole('button', { name: 'Forum re-render' });
    field.focus();
    // ForumLoader's pay poll calls onClose once the note exists, also with the writer closed.
    fireEvent.click(screen.getByRole('button', { name: 'Stub late post' }));
    expect(port.scrollTop).toBe(140);
    expect(document.activeElement).toBe(field);
    expect(screen.queryByTestId('writer')).toBeNull();
  });

  it('posts from a writer opened outside a shell without moving anything', () => {
    renderWelcome();
    fireEvent.click(screen.getByRole('button', { name: 'Write a post' }));
    fireEvent.click(screen.getByRole('button', { name: 'Stub posted' }));
    expect(screen.queryByTestId('writer')).toBeNull();
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

  it('keeps Send enabled and opens it while the wallet connects', () => {
    vi.mocked(useWallet).mockReturnValue(walletWith('connecting'));
    renderWelcome();
    const send = screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement;
    expect(send.disabled).toBe(false);
    expect((screen.getByRole('button', { name: 'Receive' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
    fireEvent.click(send);
    expect(screen.getByText('Panel send')).toBeTruthy();
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
