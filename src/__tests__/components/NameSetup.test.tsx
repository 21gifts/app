import { cleanup, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NameSetup } from '@/components/NameSetup';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/lib/api', () => ({
  setName: vi.fn(),
  setLightningAddress: vi.fn(),
  unlinkLightningAddress: vi.fn(),
}));

beforeEach(() => {
  useAuthStore.setState({
    session: 'tok',
    account: {
      id: 'acc_1',
      linkingKey: null,
      role: 'basis',
      name: null,
      lightningAddress: null,
      lightningAddressVerified: false,
      forumLawsDismissed: false,
      createdAt: 1,
    },
  });
});

afterEach(() => {
  cleanup();
});

describe('NameSetup', () => {
  it('asks for a name and not a Wallet of Satoshi address', () => {
    renderWithLocale(<NameSetup />);
    expect(screen.getByRole('heading', { name: 'Your name' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /continue/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /link address/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /log out/i })).toBeNull();
  });
});
