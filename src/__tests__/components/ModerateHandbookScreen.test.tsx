import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ModerateHandbookScreen } from '@/components/ModerateHandbookScreen';
import type { Account } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;

const account: Account = {
  id: 'acc_1',
  linkingKey: '02abcdef',
  role: 'moderator',
  name: 'Ada',
  location: null,
  lightningAddress: 'alice@walletofsatoshi.com',
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

beforeEach(() => {
  window.location.hash = '';
  HTMLElement.prototype.scrollIntoView = vi.fn();
  useAuthStore.setState({ session: 'sess', account });
});

afterEach(() => {
  cleanup();
  window.location.hash = '';
  HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
});

describe('ModerateHandbookScreen', () => {
  it('renders nothing when there is no session', () => {
    window.location.hash = '#login';
    useAuthStore.setState({ session: null, account });
    const { container } = renderWithLocale(<ModerateHandbookScreen />);
    expect(container.firstChild).toBeNull();
    expect(HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled();
  });

  it('shows forbidden copy for a basis account and no chapters', () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'basis' } });
    renderWithLocale(<ModerateHandbookScreen />);
    expect(screen.getByRole('heading', { name: 'Handbook' })).toBeTruthy();
    expect(screen.getByText('This page is for moderators.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Moderation' }).getAttribute('href')).toBe('/moderate');
    expect(screen.queryByRole('navigation', { name: 'Chapters' })).toBeNull();
    expect(screen.queryByRole('heading', { name: '21.gifts login' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Copy link to 21.gifts login' })).toBeNull();
  });

  it('shows forbidden copy for a verified account and no chapters', () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'verified' } });
    renderWithLocale(<ModerateHandbookScreen />);
    expect(screen.getByText('This page is for moderators.')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Verified' })).toBeNull();
  });

  it('shows forbidden copy when the account is missing', () => {
    useAuthStore.setState({ session: 'sess', account: null });
    renderWithLocale(<ModerateHandbookScreen />);
    expect(screen.getByText('This page is for moderators.')).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: 'Chapters' })).toBeNull();
  });

  it.each(['founder', 'moderator'] as const)(
    'shows TOC, chapters, permalinks, and copy-links for a %s',
    (role) => {
      useAuthStore.setState({ session: 'sess', account: { ...account, role } });
      renderWithLocale(<ModerateHandbookScreen />);
      expect(screen.getByRole('heading', { name: 'Handbook' })).toBeTruthy();
      expect(screen.queryByText('This page is for moderators.')).toBeNull();
      const toc = screen.getByRole('navigation', { name: 'Chapters' });
      expect(toc.querySelector('a[href="#login"]')?.textContent).toBe('21.gifts login');
      expect(toc.querySelector('a[href="#verified"]')?.textContent).toBe('Verified');
      expect(toc.querySelector('a[href="#funding"]')?.textContent).toBe('Official funding program');
      const loginHeading = screen.getByRole('heading', { name: '21.gifts login' });
      expect(loginHeading.getAttribute('id')).toBe('login');
      expect(loginHeading.querySelector('a')?.getAttribute('href')).toBe('#login');
      expect(screen.getByRole('heading', { name: 'Verified' }).getAttribute('id')).toBe('verified');
      expect(
        screen.getByRole('heading', { name: 'Official funding program' }).getAttribute('id'),
      ).toBe('funding');
      const copyLogin = screen.getByRole('button', { name: 'Copy link to 21.gifts login' });
      expect(copyLogin.className).toContain('hover:bg-app-hover');
      expect(copyLogin.className).not.toContain('hover:bg-paper/10');
      expect(screen.getByRole('button', { name: 'Copy link to Verified' })).toBeTruthy();
      expect(
        screen.getByRole('button', { name: 'Copy link to Official funding program' }),
      ).toBeTruthy();
      expect(
        screen.getByText(
          'Anyone may register and take part. Anyone may open an account and post. No permission is required.',
        ),
      ).toBeTruthy();
      expect(screen.getByText('Follow the 3 principles of 21.gifts')).toBeTruthy();
      expect(screen.getByText('Daily Bitcoin payments are mandatory')).toBeTruthy();
      expect(screen.getByText('Please keep a record of the daily payments')).toBeTruthy();
      expect(screen.getByText('New members are capped at 1 USD per day.')).toBeTruthy();
      expect(screen.getByText('Giving is a duty')).toBeTruthy();
      expect(screen.getByText('Direct, with no middleman')).toBeTruthy();
      expect(screen.getByText('Bitcoin is the most effective money')).toBeTruthy();
    },
  );

  it('scrolls into view on mount when the hash matches a chapter', () => {
    window.location.hash = '#verified';
    renderWithLocale(<ModerateHandbookScreen />);
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
  });

  it('does not scroll on mount when the hash is not a chapter', () => {
    window.location.hash = '#other';
    renderWithLocale(<ModerateHandbookScreen />);
    expect(HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled();
  });

  it('scrolls into view on hashchange when the hash matches a chapter', () => {
    renderWithLocale(<ModerateHandbookScreen />);
    const scrollMock = HTMLElement.prototype.scrollIntoView as unknown as ReturnType<typeof vi.fn>;
    scrollMock.mockClear();
    window.location.hash = '#funding';
    fireEvent(window, new Event('hashchange'));
    expect(scrollMock).toHaveBeenCalledWith({ block: 'start' });
  });

  it('does not scroll on hashchange when the hash is not a chapter', () => {
    renderWithLocale(<ModerateHandbookScreen />);
    const scrollMock = HTMLElement.prototype.scrollIntoView as unknown as ReturnType<typeof vi.fn>;
    scrollMock.mockClear();
    window.location.hash = '#nope';
    fireEvent(window, new Event('hashchange'));
    expect(scrollMock).not.toHaveBeenCalled();
  });
});
