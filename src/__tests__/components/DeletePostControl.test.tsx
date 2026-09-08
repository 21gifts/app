import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeletePostControl } from '@/components/DeletePostControl';
import { deleteMessage } from '@/lib/api';
import type { Account } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/lib/api', () => ({ deleteMessage: vi.fn() }));
const account: Account = {
  id: 'acc_1',
  linkingKey: '02abcdef',
  role: 'basis',
  name: 'Ada',
  lightningAddress: 'alice@walletofsatoshi.com',
  lightningAddressVerified: false,
  forumLawsDismissed: false,
  createdAt: 1_700_000_000,
  rulesAgreedAt: 1_700_000_001,
  viewKey: 'a'.repeat(64),
  setup: null,
  missing: [],
};

afterEach(() => {
  cleanup();
  useAuthStore.getState().clearAuth();
  vi.clearAllMocks();
});

describe('DeletePostControl', () => {
  it.each(['basis', 'verified'] as const)('hides deletion for %s', (role) => {
    useAuthStore.setState({ session: 'token', account: { ...account, role } });
    renderWithLocale(<DeletePostControl messageId="post" onDeleted={vi.fn()} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
  it('hides without a session or account', () => {
    useAuthStore.setState({ session: null, account: { ...account, role: 'founder' } });
    const view = renderWithLocale(<DeletePostControl messageId="post" onDeleted={vi.fn()} />);
    expect(screen.queryByRole('button')).toBeNull();
    act(() => useAuthStore.setState({ session: 'token', account: null }));
    view.rerender(<DeletePostControl messageId="post" onDeleted={vi.fn()} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
  it.each(['founder', 'moderator'] as const)('confirms and deletes as %s', async (role) => {
    useAuthStore.setState({ session: 'token', account: { ...account, role } });
    vi.mocked(deleteMessage).mockResolvedValue(undefined);
    const onDeleted = vi.fn();
    const parentClick = vi.fn();
    const parentKey = vi.fn();
    renderWithLocale(
      <div onClick={parentClick} onKeyDown={parentKey}>
        <DeletePostControl messageId="post" onDeleted={onDeleted} />
      </div>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete post' }));
    expect(deleteMessage).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Confirm deletion' }), { key: 'Enter' });
    expect(parentClick).not.toHaveBeenCalled();
    expect(parentKey).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm deletion' }));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith('post'));
    expect(deleteMessage).toHaveBeenCalledWith('token', 'post');
  });
  it('cancels without deleting and supports German labels', () => {
    useAuthStore.setState({ session: 'token', account: { ...account, role: 'moderator' } });
    renderWithLocale(<DeletePostControl messageId="post" onDeleted={vi.fn()} />, 'de');
    fireEvent.click(screen.getByRole('button', { name: 'Beitrag löschen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Löschen abbrechen' }));
    expect(screen.getByRole('button', { name: 'Beitrag löschen' })).toBeTruthy();
    expect(deleteMessage).not.toHaveBeenCalled();
  });
  it('disables pending controls and preserves the post on failure for retry', async () => {
    useAuthStore.setState({ session: 'token', account: { ...account, role: 'moderator' } });
    let reject!: (reason: Error) => void;
    vi.mocked(deleteMessage).mockImplementationOnce(
      () =>
        new Promise<void>((_, no) => {
          reject = no;
        }),
    );
    const onDeleted = vi.fn();
    renderWithLocale(<DeletePostControl messageId="post" onDeleted={onDeleted} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete post' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm deletion' }));
    expect(screen.getByRole('button', { name: 'Confirm deletion' }).hasAttribute('disabled')).toBe(
      true,
    );
    expect(screen.getByRole('button', { name: 'Cancel deletion' }).hasAttribute('disabled')).toBe(
      true,
    );
    await act(async () => reject(new Error('denied')));
    expect(screen.getByRole('alert').textContent).toContain('Could not delete');
    expect(onDeleted).not.toHaveBeenCalled();
    vi.mocked(deleteMessage).mockResolvedValue(undefined);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm deletion' }));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith('post'));
  });
});
