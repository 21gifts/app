import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FiatPicker } from '@/components/FiatPicker';

afterEach(cleanup);

describe('FiatPicker', () => {
  it('renders four fiat options and reports the pressed code', () => {
    const onChange = vi.fn();
    render(<FiatPicker value="USD" onChange={onChange} />);
    const group = screen.getByRole('group', { name: 'Fiat currency' });
    expect(group).toBeTruthy();
    expect(screen.getByRole('button', { name: 'CHF' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'EUR' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'USD' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'PHP' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'USD' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'CHF' }));
    expect(onChange).toHaveBeenCalledWith('CHF');
  });
});
