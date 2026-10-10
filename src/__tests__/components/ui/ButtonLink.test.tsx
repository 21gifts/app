import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { renderWithLocale } from '@/__tests__/render-with-locale';

afterEach(cleanup);

describe('ButtonLink', () => {
  it('renders a primary app link by default', () => {
    renderWithLocale(<ButtonLink href="/welcome">Open the forum</ButtonLink>);
    const link = screen.getByRole('link', { name: 'Open the forum' });
    expect(link.getAttribute('href')).toBe('/welcome');
    expect(link.className).toContain('bg-app-btn');
  });

  it('applies accent, secondary, dark tone, size, and className', () => {
    const { rerender } = renderWithLocale(
      <ButtonLink href="/login" variant="accent" size="sm">
        Ask
      </ButtonLink>,
    );
    expect(screen.getByRole('link', { name: 'Ask' }).className).toContain('bg-app-accent');
    expect(screen.getByRole('link', { name: 'Ask' }).className).toContain('min-h-11');

    rerender(
      <ButtonLink href="/donate" variant="secondary" tone="dark" size="lg" className="x">
        Send
      </ButtonLink>,
    );
    const send = screen.getByRole('link', { name: 'Send' });
    expect(send.className).toContain('border-paper/20');
    expect(send.className).toContain('w-full');
    expect(send.className).toContain('x');
  });

  it('renders a leading icon and treats empty className as absent', () => {
    renderWithLocale(
      <ButtonLink href="/" icon={<span data-testid="icon">*</span>} className="">
        Home
      </ButtonLink>,
    );
    expect(screen.getByTestId('icon')).toBeTruthy();
    expect(screen.getByRole('link', { name: '* Home' }).className).not.toContain('undefined');
  });

  it('uses paper fill for dark primary', () => {
    renderWithLocale(
      <ButtonLink href="/" variant="primary" tone="dark">
        Back
      </ButtonLink>,
    );
    expect(screen.getByRole('link', { name: 'Back' }).className).toContain('bg-paper');
  });

  it('renders a native anchor for wallet protocol hrefs', () => {
    renderWithLocale(
      <ButtonLink href="lightning:lnurl1" aria-label="Pay with a Lightning wallet">
        Pay
      </ButtonLink>,
    );
    const link = screen.getByRole('link', { name: 'Pay with a Lightning wallet' });
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toBe('lightning:lnurl1');
  });

  it('treats hash hrefs as internal links', () => {
    renderWithLocale(<ButtonLink href="#rules">Rules</ButtonLink>);
    expect(screen.getByRole('link', { name: 'Rules' }).getAttribute('href')).toBe('#rules');
  });

  it('renders a native anchor for https and protocol-relative hrefs', () => {
    const { rerender } = renderWithLocale(
      <ButtonLink href="https://21.gifts">Open 21.gifts</ButtonLink>,
    );
    expect(screen.getByRole('link', { name: 'Open 21.gifts' }).tagName).toBe('A');

    rerender(<ButtonLink href="//example.com/pay">Protocol relative</ButtonLink>);
    const relative = screen.getByRole('link', { name: 'Protocol relative' });
    expect(relative.tagName).toBe('A');
    expect(relative.getAttribute('href')).toBe('//example.com/pay');
  });

  it('uses accent fill on the dark shell', () => {
    renderWithLocale(
      <ButtonLink href="/login" variant="accent" tone="dark">
        Log in
      </ButtonLink>,
    );
    expect(screen.getByRole('link', { name: 'Log in' }).className).toContain('bg-accent');
  });

  it('uses the compact chrome size with 12px text on phones', () => {
    renderWithLocale(
      <ButtonLink href="/wallet" variant="secondary" size="chrome">
        Wallet
      </ButtonLink>,
    );
    const className = screen.getByRole('link', { name: 'Wallet' }).className;
    expect(className).toContain('min-h-11 gap-1 px-1.5 py-1 text-xs sm:gap-1.5 sm:px-3 sm:text-sm');
    expect(className).not.toContain('gap-2');
  });

  it('passes onClick to internal and external links', () => {
    const clicked = vi.fn();
    const { rerender } = renderWithLocale(
      <ButtonLink href="/loans/repay" onClick={clicked}>
        Send
      </ButtonLink>,
    );
    fireEvent.click(screen.getByRole('link', { name: 'Send' }));
    expect(clicked).toHaveBeenCalledTimes(1);
    rerender(
      <ButtonLink href="https://21.gifts" onClick={clicked}>
        Website
      </ButtonLink>,
    );
    const website = screen.getByRole('link', { name: 'Website' });
    website.addEventListener('click', (event) => event.preventDefault());
    fireEvent.click(website);
    expect(clicked).toHaveBeenCalledTimes(2);
  });
});
