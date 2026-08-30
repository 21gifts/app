import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RulesSetup } from '@/components/RulesSetup';
import { agreeToRules } from '@/lib/api';
import type { Account } from '@/lib/api-types';
import { RULES_CHAPTER_IDS } from '@/lib/rules-chapters';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/lib/api', () => ({
  agreeToRules: vi.fn(),
}));

const baseAccount: Account = {
  id: 'acc_1',
  linkingKey: '02abcdef',
  role: 'basis',
  name: 'Ada',
  lightningAddress: 'alice@walletofsatoshi.com',
  lightningAddressVerified: false,
  forumLawsDismissed: false,
  createdAt: 1_700_000_000,
  rulesAgreedAt: null,
  viewKey: 'a'.repeat(64),
};

const oneChapter = [<p key="body">rules-body</p>];

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ session: 'sess', account: baseAccount });
});

afterEach(cleanup);

describe('RulesSetup', () => {
  it('renders nothing when there is no account', () => {
    useAuthStore.setState({ session: 'sess', account: null });
    const { container } = renderWithLocale(<RulesSetup chapters={oneChapter} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when the session token is absent', () => {
    useAuthStore.setState({ session: null, account: baseAccount });
    const { container } = renderWithLocale(<RulesSetup chapters={oneChapter} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when chapters is empty', () => {
    const { container } = renderWithLocale(<RulesSetup chapters={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows Continue on intermediate chapters and I agree only on the last', () => {
    renderWithLocale(
      <RulesSetup chapters={[<p key="first">chapter-one</p>, <p key="second">chapter-two</p>]} />,
    );
    expect(screen.getByRole('heading', { name: 'Living room rules' })).toBeTruthy();
    expect(screen.getByText('Please read this chapter.')).toBeTruthy();
    expect(screen.getByText('1 of 2')).toBeTruthy();
    expect(screen.getByText('chapter-one')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'I agree to these rules' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(
      screen.getByText('Please read this chapter. You can continue once you agree to the rules.'),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'I agree to these rules' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
  });

  it('advances chapters without posting until the last agree', () => {
    renderWithLocale(
      <RulesSetup chapters={[<p key="first">chapter-one</p>, <p key="second">chapter-two</p>]} />,
    );
    expect(screen.getByText('chapter-one')).toBeTruthy();
    expect(screen.queryByText('chapter-two')).toBeNull();
    expect(screen.getByText('1 of 2')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(agreeToRules).not.toHaveBeenCalled();
    expect(screen.queryByText('chapter-one')).toBeNull();
    expect(screen.getByText('chapter-two')).toBeTruthy();
    expect(screen.getByText('2 of 2')).toBeTruthy();
  });

  it('posts agreement only on the last chapter', async () => {
    vi.mocked(agreeToRules).mockResolvedValue({
      ...baseAccount,
      rulesAgreedAt: 1_700_000_001,
      viewKey: 'a'.repeat(64),
    });
    renderWithLocale(
      <RulesSetup
        chapters={RULES_CHAPTER_IDS.map((id) => (
          <p key={id}>{id}</p>
        ))}
      />,
    );

    for (let i = 0; i < RULES_CHAPTER_IDS.length - 1; i += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
      expect(agreeToRules).not.toHaveBeenCalled();
    }
    fireEvent.click(screen.getByRole('button', { name: 'I agree to these rules' }));

    await waitFor(() => {
      expect(agreeToRules).toHaveBeenCalledTimes(1);
      expect(agreeToRules).toHaveBeenCalledWith('sess');
    });
  });

  it('shows an icon-only back control after the first chapter', () => {
    renderWithLocale(
      <RulesSetup chapters={[<p key="first">chapter-one</p>, <p key="second">chapter-two</p>]} />,
    );
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    const back = screen.getByRole('button', { name: 'Back' });
    expect(back).toBeTruthy();
    expect(screen.queryByText('Back')).toBeNull();

    fireEvent.click(back);
    expect(agreeToRules).not.toHaveBeenCalled();
    expect(screen.getByText('chapter-one')).toBeTruthy();
    expect(screen.queryByText('chapter-two')).toBeNull();
  });

  it('does not skip a chapter when agree is clicked twice in one tick', () => {
    renderWithLocale(
      <RulesSetup
        chapters={[
          <p key="first">chapter-one</p>,
          <p key="second">chapter-two</p>,
          <p key="third">chapter-three</p>,
        ]}
      />,
    );
    const next = screen.getByRole('button', { name: 'Continue' });
    act(() => {
      next.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      next.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(screen.getByText('chapter-two')).toBeTruthy();
    expect(screen.queryByText('chapter-three')).toBeNull();
    expect(agreeToRules).not.toHaveBeenCalled();
  });

  it('does not leave the first chapter when back is clicked twice in one tick', () => {
    renderWithLocale(
      <RulesSetup chapters={[<p key="first">chapter-one</p>, <p key="second">chapter-two</p>]} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    const back = screen.getByRole('button', { name: 'Back' });
    act(() => {
      back.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      back.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(screen.getByText('chapter-one')).toBeTruthy();
    expect(screen.queryByText('chapter-two')).toBeNull();
  });

  it('ignores the second click of a double-click on continue after paint', () => {
    renderWithLocale(
      <RulesSetup
        chapters={[
          <p key="first">chapter-one</p>,
          <p key="second">chapter-two</p>,
          <p key="third">chapter-three</p>,
        ]}
      />,
    );
    const next = screen.getByRole('button', { name: 'Continue' });
    fireEvent.click(next, { detail: 1 });
    expect(screen.getByText('chapter-two')).toBeTruthy();
    fireEvent.click(next, { detail: 2 });
    expect(screen.getByText('chapter-two')).toBeTruthy();
    expect(screen.queryByText('chapter-three')).toBeNull();
  });

  it('ignores the second click of a double-click on back after paint', () => {
    renderWithLocale(
      <RulesSetup
        chapters={[
          <p key="first">chapter-one</p>,
          <p key="second">chapter-two</p>,
          <p key="third">chapter-three</p>,
        ]}
      />,
    );
    const next = screen.getByRole('button', { name: 'Continue' });
    fireEvent.click(next, { detail: 1 });
    fireEvent.click(next, { detail: 1 });
    expect(screen.getByText('chapter-three')).toBeTruthy();
    const back = screen.getByRole('button', { name: 'Back' });
    fireEvent.click(back, { detail: 1 });
    expect(screen.getByText('chapter-two')).toBeTruthy();
    fireEvent.click(back, { detail: 2 });
    expect(screen.getByText('chapter-two')).toBeTruthy();
    expect(screen.queryByText('chapter-one')).toBeNull();
  });

  it('posts agreement and merges only rulesAgreedAt into the store', async () => {
    vi.mocked(agreeToRules).mockResolvedValue({
      ...baseAccount,
      name: 'Stale',
      rulesAgreedAt: 1_700_000_001,
      viewKey: 'a'.repeat(64),
    });
    renderWithLocale(<RulesSetup chapters={oneChapter} />);

    fireEvent.click(screen.getByRole('button', { name: 'I agree to these rules' }));

    await waitFor(() => {
      expect(agreeToRules).toHaveBeenCalledWith('sess');
      expect(useAuthStore.getState().account).toEqual({
        ...baseAccount,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
      });
    });
  });

  it('keeps a concurrently saved name when the agreement response is stale', async () => {
    let resolve!: (value: Account) => void;
    const pending = new Promise<Account>((r) => {
      resolve = r;
    });
    vi.mocked(agreeToRules).mockReturnValue(pending);
    renderWithLocale(<RulesSetup chapters={oneChapter} />);

    fireEvent.click(screen.getByRole('button', { name: 'I agree to these rules' }));

    act(() => {
      useAuthStore.setState({
        session: 'sess',
        account: { ...baseAccount, name: 'Bob' },
      });
    });

    await act(async () => {
      resolve({ ...baseAccount, name: 'Ada', rulesAgreedAt: 1_700_000_001 });
    });

    expect(useAuthStore.getState().account).toEqual({
      ...baseAccount,
      name: 'Bob',
      rulesAgreedAt: 1_700_000_001,
      viewKey: 'a'.repeat(64),
    });
  });

  it('shows the request error when agreement fails', async () => {
    vi.mocked(agreeToRules).mockRejectedValue(new Error('nope'));
    renderWithLocale(<RulesSetup chapters={oneChapter} />);

    fireEvent.click(screen.getByRole('button', { name: 'I agree to these rules' }));

    expect((await screen.findByRole('alert')).textContent).toBe('Could not save your agreement');
  });

  it('disables the button and shows a spinner while a request is in flight', async () => {
    let resolve!: (value: Account) => void;
    const pending = new Promise<Account>((r) => {
      resolve = r;
    });
    vi.mocked(agreeToRules).mockReturnValue(pending);
    renderWithLocale(<RulesSetup chapters={oneChapter} />);

    fireEvent.click(screen.getByRole('button', { name: 'I agree to these rules' }));

    const button = screen.getByRole('button', {
      name: 'I agree to these rules',
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    await act(async () => {
      resolve({ ...baseAccount, rulesAgreedAt: 1_700_000_001 });
    });

    expect(useAuthStore.getState().account?.rulesAgreedAt).toBe(1_700_000_001);
  });

  it('drops the result when the session changed mid-flight', async () => {
    let resolve!: (value: Account) => void;
    const pending = new Promise<Account>((r) => {
      resolve = r;
    });
    vi.mocked(agreeToRules).mockReturnValue(pending);
    renderWithLocale(<RulesSetup chapters={oneChapter} />);

    fireEvent.click(screen.getByRole('button', { name: 'I agree to these rules' }));

    act(() => {
      useAuthStore.setState({ session: 'other', account: baseAccount });
    });

    await act(async () => {
      resolve({ ...baseAccount, rulesAgreedAt: 1_700_000_001 });
    });

    expect(useAuthStore.getState().account?.rulesAgreedAt).toBeNull();
  });

  it('drops the result when the account was cleared mid-flight', async () => {
    let resolve!: (value: Account) => void;
    const pending = new Promise<Account>((r) => {
      resolve = r;
    });
    vi.mocked(agreeToRules).mockReturnValue(pending);
    renderWithLocale(<RulesSetup chapters={oneChapter} />);

    fireEvent.click(screen.getByRole('button', { name: 'I agree to these rules' }));

    act(() => {
      useAuthStore.setState({ session: 'sess', account: null });
    });

    await act(async () => {
      resolve({ ...baseAccount, rulesAgreedAt: 1_700_000_001 });
    });

    expect(useAuthStore.getState().account).toBeNull();
  });

  it('posts agreement only once when the last chapter is clicked twice in one tick', async () => {
    vi.mocked(agreeToRules).mockResolvedValue({
      ...baseAccount,
      rulesAgreedAt: 1_700_000_001,
    });
    renderWithLocale(<RulesSetup chapters={oneChapter} />);
    const agree = screen.getByRole('button', { name: 'I agree to these rules' });
    act(() => {
      agree.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      agree.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await waitFor(() => {
      expect(agreeToRules).toHaveBeenCalledTimes(1);
    });
  });

  it('disables back while the last-chapter request is in flight', async () => {
    let resolve!: (value: Account) => void;
    const pending = new Promise<Account>((r) => {
      resolve = r;
    });
    vi.mocked(agreeToRules).mockReturnValue(pending);
    renderWithLocale(
      <RulesSetup chapters={[<p key="first">chapter-one</p>, <p key="second">chapter-two</p>]} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    const back = screen.getByRole('button', { name: 'Back' }) as HTMLButtonElement;
    fireEvent.click(screen.getByRole('button', { name: 'I agree to these rules' }));
    expect(back.disabled).toBe(true);
    fireEvent.click(back);
    expect(screen.getByText('chapter-two')).toBeTruthy();
    await act(async () => {
      resolve({ ...baseAccount, rulesAgreedAt: 1_700_000_001 });
    });
  });
});
