import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/lib/api', () => ({
  fetchExternalAuthorProfile: vi.fn(),
}));

import { fetchExternalAuthorProfile } from '@/lib/api';
import { ExternalAuthorSheet } from '@/components/ExternalAuthorSheet';

const fetchProfile = vi.mocked(fetchExternalAuthorProfile);

const HINT =
  'Wrote from another app, not from a 21.gifts account. Shown here because this person sent bitcoin to a post.';

afterEach(() => {
  cleanup();
});

describe('ExternalAuthorSheet', () => {
  it('shows the fallback name until the profile loads, then the profile fields', async () => {
    let resolveProfile!: (value: Awaited<ReturnType<typeof fetchProfile>>) => void;
    fetchProfile.mockReturnValue(
      new Promise((resolve) => {
        resolveProfile = resolve;
      }),
    );
    renderWithLocale(
      <ExternalAuthorSheet messageId="m1" fallbackName="Ada" onClose={() => undefined} />,
    );
    expect(screen.getByRole('heading', { name: 'Ada' })).toBeTruthy();
    expect(screen.getByText(HINT)).toBeTruthy();
    expect(screen.queryByText('Verified Nostr address')).toBeNull();
    expect(screen.queryByText('Payment address on their profile')).toBeNull();
    expect(screen.queryByText('Nostr key')).toBeNull();
    resolveProfile({
      name: 'Robin',
      npub: 'npub1example',
      nip05: 'ada@nostr.example',
      lud16: 'pay@ln.example',
    });
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Robin' })).toBeTruthy();
    });
    expect(screen.queryByRole('heading', { name: 'Ada' })).toBeNull();
    expect(screen.getByText('External')).toBeTruthy();
    expect(screen.getByText('Verified Nostr address')).toBeTruthy();
    expect(screen.getByText('Payment address on their profile')).toBeTruthy();
    expect(screen.getByText('Nostr key')).toBeTruthy();
    expect(screen.getByText('ada@nostr.example')).toBeTruthy();
    expect(screen.getByText('pay@ln.example')).toBeTruthy();
    expect(screen.getByText('npub1example')).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
    expect(document.querySelector('img')).toBeNull();
  });

  it('hides the payment address when lud16 matches nip05 case-insensitively', async () => {
    fetchProfile.mockResolvedValue({
      name: 'Robin',
      npub: 'npub1example',
      nip05: 'ada@nostr.example',
      lud16: 'Ada@Nostr.example',
    });
    renderWithLocale(
      <ExternalAuthorSheet messageId="m1" fallbackName="Ada" onClose={() => undefined} />,
    );
    await waitFor(() => {
      expect(screen.getByText('Verified Nostr address')).toBeTruthy();
    });
    expect(screen.getByText('ada@nostr.example')).toBeTruthy();
    expect(screen.getByText('Nostr key')).toBeTruthy();
    expect(screen.getByText('npub1example')).toBeTruthy();
    expect(screen.queryByText('Payment address on their profile')).toBeNull();
  });

  it('keeps the fallback name and hint when the fetch returns null', async () => {
    fetchProfile.mockResolvedValue(null);
    renderWithLocale(
      <ExternalAuthorSheet messageId="m1" fallbackName="Ada" onClose={() => undefined} />,
    );
    await waitFor(() => {
      expect(fetchProfile).toHaveBeenCalledWith('m1');
    });
    expect(screen.getByRole('heading', { name: 'Ada' })).toBeTruthy();
    expect(screen.getByText(HINT)).toBeTruthy();
    expect(screen.queryByText('Verified Nostr address')).toBeNull();
    expect(screen.queryByText('Payment address on their profile')).toBeNull();
    expect(screen.queryByText('Nostr key')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('copies the npub and changes the Copy label to Copied', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    fetchProfile.mockResolvedValue({
      name: 'Robin',
      npub: 'npub1example',
    });
    renderWithLocale(
      <ExternalAuthorSheet messageId="m1" fallbackName="Ada" onClose={() => undefined} />,
    );
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('npub1example');
      expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy();
    });
  });

  it('stops a click and a key on the dialog from closing it', () => {
    fetchProfile.mockResolvedValue(null);
    const onClose = vi.fn();
    renderWithLocale(<ExternalAuthorSheet messageId="m1" fallbackName="Ada" onClose={onClose} />);
    const dialog = screen.getByRole('dialog', { name: 'Ada' });
    fireEvent.click(dialog);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Ada' })).toBeTruthy();
  });

  it('copies through the textarea fallback when the clipboard rejects', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const exec = vi.fn<(commandId: string) => boolean>().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      writable: true,
      value: exec,
    });
    fetchProfile.mockResolvedValue({
      name: 'Robin',
      npub: 'npub1example',
    });
    renderWithLocale(
      <ExternalAuthorSheet messageId="m1" fallbackName="Ada" onClose={() => undefined} />,
    );
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(() => {
      expect(exec).toHaveBeenCalledWith('copy');
      expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy();
    });
  });

  it('keeps Copy when the textarea fallback throws', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const exec = vi.fn<(commandId: string) => boolean>().mockImplementation(() => {
      throw new Error('copy failed');
    });
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      writable: true,
      value: exec,
    });
    fetchProfile.mockResolvedValue({
      name: 'Robin',
      npub: 'npub1example',
    });
    renderWithLocale(
      <ExternalAuthorSheet messageId="m1" fallbackName="Ada" onClose={() => undefined} />,
    );
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(() => {
      expect(exec).toHaveBeenCalledWith('copy');
    });
    expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Copied' })).toBeNull();
  });

  it('ignores a profile that arrives after the sheet unmounts', async () => {
    let resolveProfile!: (value: Awaited<ReturnType<typeof fetchProfile>>) => void;
    const pending = new Promise<Awaited<ReturnType<typeof fetchProfile>>>((resolve) => {
      resolveProfile = resolve;
    });
    fetchProfile.mockReturnValue(pending);
    const view = renderWithLocale(
      <ExternalAuthorSheet messageId="m1" fallbackName="Ada" onClose={() => undefined} />,
    );
    view.unmount();
    await act(async () => {
      resolveProfile({ name: 'Robin', npub: 'npub1example' });
      await pending;
    });
    expect(screen.queryByRole('heading', { name: 'Robin' })).toBeNull();
  });
});
