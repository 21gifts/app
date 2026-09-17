import { cleanup, fireEvent, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LinkedText } from '@/components/LinkedText';
import { openInSystemBrowser } from '@/lib/in-app-browser';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    onClick,
    ...rest
  }: {
    href: string;
    children: ReactNode;
    onClick?: (event: { stopPropagation: () => void }) => void;
    className?: string;
  }) => (
    <a href={href} onClick={onClick} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('@/lib/in-app-browser', () => ({
  openInSystemBrowser: vi.fn(),
}));

const openSystem = vi.mocked(openInSystemBrowser);

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  openSystem.mockReset();
});

describe('LinkedText', () => {
  it('renders plain text without a link', () => {
    renderWithLocale(<LinkedText text="just a note" className="text-sm" />);
    expect(screen.getByText('just a note')).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('renders an internal 21.gifts url as an in-app link', () => {
    renderWithLocale(<LinkedText text="see http://21.gifts/trust-chain" className="text-sm" />);
    const link = screen.getByRole('link', { name: 'http://21.gifts/trust-chain' });
    expect(link.getAttribute('href')).toBe('/trust-chain');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('does not emit a protocol-relative href for extra slashes on 21.gifts', () => {
    renderWithLocale(<LinkedText text="https://21.gifts//evil.com" className="text-sm" />);
    const link = screen.getByRole('link', { name: 'https://21.gifts//evil.com' });
    expect(link.getAttribute('href')).toBe('/evil.com');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens the warning for an external url and does not leave yet', () => {
    renderWithLocale(<LinkedText text="New:\nhttps://example.com/phish" className="text-sm" />);
    fireEvent.click(screen.getByRole('link', { name: 'https://example.com/phish' }));
    expect(screen.getByRole('dialog', { name: 'Open external link?' })).toBeTruthy();
    expect(openSystem).not.toHaveBeenCalled();
  });

  it('confirms an https external url through openInSystemBrowser', () => {
    renderWithLocale(<LinkedText text="https://example.com/phish" className="text-sm" />);
    fireEvent.click(screen.getByRole('link', { name: 'https://example.com/phish' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open link' }));
    expect(openSystem).toHaveBeenCalledWith('https://example.com/phish');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('confirms an http external url through window.open', () => {
    const open = vi.fn();
    vi.stubGlobal('open', open);
    renderWithLocale(<LinkedText text="http://example.com/phish" className="text-sm" />);
    fireEvent.click(screen.getByRole('link', { name: 'http://example.com/phish' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open link' }));
    expect(open).toHaveBeenCalledWith('http://example.com/phish', '_blank', 'noopener,noreferrer');
    expect(openSystem).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('close dismisses the warning without opening', () => {
    renderWithLocale(<LinkedText text="https://example.com/phish" className="text-sm" />);
    fireEvent.click(screen.getByRole('link', { name: 'https://example.com/phish' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(openSystem).not.toHaveBeenCalled();
  });

  it('stops propagation so a parent card does not toggle', () => {
    const parentClick = vi.fn();
    renderWithLocale(
      <div onClick={parentClick}>
        <LinkedText text="http://21.gifts/trust-chain" className="text-sm" />
      </div>,
    );
    fireEvent.click(screen.getByRole('link', { name: 'http://21.gifts/trust-chain' }));
    expect(parentClick).not.toHaveBeenCalled();
  });

  it('ignores non-primary clicks on an external url', () => {
    renderWithLocale(<LinkedText text="https://example.com/phish" className="text-sm" />);
    fireEvent.click(screen.getByRole('link', { name: 'https://example.com/phish' }), {
      button: 1,
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('uses currentOrigin and a custom link class', () => {
    renderWithLocale(
      <LinkedText
        text="http://localhost:3000/welcome"
        className="text-sm"
        linkClassName="underline"
        currentOrigin="http://localhost:3000"
      />,
    );
    const link = screen.getByRole('link', { name: 'http://localhost:3000/welcome' });
    expect(link.getAttribute('href')).toBe('/welcome');
    expect(link.className).toBe('underline');
  });
});
