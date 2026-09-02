import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { renderWithLocale } from '@/__tests__/render-with-locale';

afterEach(cleanup);

const GIFT_OPTIONS = [
  { value: 'sat' as const, label: '₿' },
  { value: 'usd' as const, label: 'USD' },
];

const NEUTRAL_OPTIONS = [
  { value: 'active' as const, label: 'Active' },
  { value: 'all' as const, label: 'All' },
  { value: 'popular' as const, label: 'Most popular' },
];

describe('SegmentedControl', () => {
  it('renders gift app tone with selected accent and unselected muted', () => {
    renderWithLocale(
      <SegmentedControl
        value="sat"
        options={GIFT_OPTIONS}
        onChange={() => undefined}
        ariaLabel="Chart scale"
        tone="gift"
      />,
    );
    const group = screen.getByRole('group', { name: 'Chart scale' });
    expect(group.className).toContain('border-app-border');
    const sat = screen.getByRole('button', { name: '₿' });
    const usd = screen.getByRole('button', { name: 'USD' });
    expect(sat.getAttribute('aria-pressed')).toBe('true');
    expect(usd.getAttribute('aria-pressed')).toBe('false');
    expect(sat.className).toContain('bg-app-accent');
    expect(sat.className).toContain('min-h-11');
    expect(usd.className).toContain('text-app-muted');
  });

  it('renders gift dark shell with accent selected and paper unselected', () => {
    renderWithLocale(
      <SegmentedControl
        value="usd"
        options={GIFT_OPTIONS}
        onChange={() => undefined}
        ariaLabel="Over time scale"
        tone="gift"
        shell="dark"
      />,
    );
    const group = screen.getByRole('group', { name: 'Over time scale' });
    expect(group.className).toContain('border-paper/20');
    const usd = screen.getByRole('button', { name: 'USD' });
    const sat = screen.getByRole('button', { name: '₿' });
    expect(usd.className).toContain('bg-accent');
    expect(usd.className).toContain('text-ink');
    expect(sat.className).toContain('text-paper/70');
  });

  it('renders neutral tone with app-btn selected', () => {
    renderWithLocale(
      <SegmentedControl
        value="active"
        options={NEUTRAL_OPTIONS}
        onChange={() => undefined}
        ariaLabel="Forum view"
        tone="neutral"
      />,
    );
    const group = screen.getByRole('group', { name: 'Forum view' });
    expect(group.className).toContain('rounded-full');
    expect(group.className).toContain('bg-app-card-muted');
    expect(screen.getByRole('button', { name: 'Active' }).className).toContain('bg-app-btn');
    expect(screen.getByRole('button', { name: 'All' }).className).toContain('text-app-muted');
  });

  it('ignores shell for neutral tone', () => {
    renderWithLocale(
      <SegmentedControl
        value="all"
        options={NEUTRAL_OPTIONS}
        onChange={() => undefined}
        ariaLabel="Forum view"
        tone="neutral"
        shell="dark"
      />,
    );
    const group = screen.getByRole('group', { name: 'Forum view' });
    expect(group.className).toContain('border-app-border');
    expect(group.className).not.toContain('border-paper/20');
    expect(screen.getByRole('button', { name: 'All' }).className).toContain('bg-app-btn');
  });

  it('calls onChange with the pressed option value', () => {
    const onChange = vi.fn();
    renderWithLocale(
      <SegmentedControl
        value="sat"
        options={GIFT_OPTIONS}
        onChange={onChange}
        ariaLabel="Chart scale"
        tone="gift"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'USD' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('usd');
  });

  it('appends a custom className on the track', () => {
    renderWithLocale(
      <SegmentedControl
        value="sat"
        options={GIFT_OPTIONS}
        onChange={() => undefined}
        ariaLabel="Chart scale"
        tone="gift"
        className="extra"
      />,
    );
    expect(screen.getByRole('group', { name: 'Chart scale' }).className).toContain('extra');
  });

  it('treats an empty className like no className', () => {
    renderWithLocale(
      <SegmentedControl
        value="sat"
        options={GIFT_OPTIONS}
        onChange={() => undefined}
        ariaLabel="Chart scale"
        tone="gift"
        className=""
      />,
    );
    expect(screen.getByRole('group', { name: 'Chart scale' }).className).not.toContain('undefined');
  });
});
