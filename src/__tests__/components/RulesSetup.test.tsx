import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RulesSetup } from '@/components/RulesSetup';
import { agreeToRules } from '@/lib/api';
import type { Account } from '@/lib/api-types';
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

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ session: 'sess', account: baseAccount });
});

afterEach(cleanup);

describe('RulesSetup', () => {
  it('renders nothing when there is no account', () => {
    useAuthStore.setState({ session: 'sess', account: null });
    const { container } = renderWithLocale(
      <RulesSetup>
        <p>rules-body</p>
      </RulesSetup>,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when the session token is absent', () => {
    useAuthStore.setState({ session: null, account: baseAccount });
    const { container } = renderWithLocale(
      <RulesSetup>
        <p>rules-body</p>
      </RulesSetup>,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows the prompt, children, and agree button', () => {
    renderWithLocale(
      <RulesSetup>
        <p>rules-body</p>
      </RulesSetup>,
    );
    expect(screen.getByRole('heading', { name: 'Living room rules' })).toBeTruthy();
    expect(
      screen.getByText(
        'Please read these living-room rules. You can continue only after you agree.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('rules-body')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'I agree to these rules' })).toBeTruthy();
  });

  it('posts agreement and merges only rulesAgreedAt into the store', async () => {
    vi.mocked(agreeToRules).mockResolvedValue({
      ...baseAccount,
      name: 'Stale',
      rulesAgreedAt: 1_700_000_001,
      viewKey: 'a'.repeat(64),
    });
    renderWithLocale(
      <RulesSetup>
        <p>rules-body</p>
      </RulesSetup>,
    );

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
    renderWithLocale(
      <RulesSetup>
        <p>rules-body</p>
      </RulesSetup>,
    );

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
    renderWithLocale(
      <RulesSetup>
        <p>rules-body</p>
      </RulesSetup>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'I agree to these rules' }));

    expect((await screen.findByRole('alert')).textContent).toBe('Could not save your agreement');
  });

  it('disables the button and shows a spinner while a request is in flight', async () => {
    let resolve!: (value: Account) => void;
    const pending = new Promise<Account>((r) => {
      resolve = r;
    });
    vi.mocked(agreeToRules).mockReturnValue(pending);
    renderWithLocale(
      <RulesSetup>
        <p>rules-body</p>
      </RulesSetup>,
    );

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
    renderWithLocale(
      <RulesSetup>
        <p>rules-body</p>
      </RulesSetup>,
    );

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
    renderWithLocale(
      <RulesSetup>
        <p>rules-body</p>
      </RulesSetup>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'I agree to these rules' }));

    act(() => {
      useAuthStore.setState({ session: 'sess', account: null });
    });

    await act(async () => {
      resolve({ ...baseAccount, rulesAgreedAt: 1_700_000_001 });
    });

    expect(useAuthStore.getState().account).toBeNull();
  });
});
