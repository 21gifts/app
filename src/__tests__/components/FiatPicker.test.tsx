import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FiatPicker } from '@/components/FiatPicker';

afterEach(cleanup);

describe('FiatPicker', () => {
  it('renders four fiat options and reports the pressed code', () => {
    const onChange = vi.fn();
    render(<FiatPicker value="USD" onChange={onChange} ariaLabel="Fiat currency" />);
    const group = screen.getByRole('group', { name: 'Fiat currency' });
    expect(group).toBeTruthy();
    expect(group.className).toContain('border-paper/20');
    expect(screen.getByRole('button', { name: 'CHF' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'EUR' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'USD' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'PHP' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'USD' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'CHF' }));
    expect(onChange).toHaveBeenCalledWith('CHF');
  });

  it('uses the app shell and a custom aria label when passed', () => {
    render(
      <FiatPicker value="EUR" onChange={() => undefined} shell="app" ariaLabel="Profile fiat" />,
    );
    const group = screen.getByRole('group', { name: 'Profile fiat' });
    expect(group.className).toContain('border-app-border');
    expect(group.className).not.toContain('border-paper/20');
    expect(screen.getByRole('button', { name: 'EUR' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('uses a rounded-full track and app-btn selected when tone is neutral', () => {
    render(
      <FiatPicker
        value="USD"
        onChange={() => undefined}
        shell="app"
        tone="neutral"
        ariaLabel="Profile fiat"
      />,
    );
    const group = screen.getByRole('group', { name: 'Profile fiat' });
    expect(group.className).toContain('rounded-full');
    const usd = screen.getByRole('button', { name: 'USD' });
    expect(usd.className).toContain('bg-app-btn');
    expect(usd.className).not.toContain('bg-app-accent');
    expect(usd.className).not.toContain('bg-accent');
  });
});
