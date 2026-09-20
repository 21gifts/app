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
    const track = group.parentElement;
    expect(track).not.toBeNull();
    expect(track?.className).toContain('rounded-full');
    expect(track?.className).toContain('bg-app-card-muted');
    expect(track?.className).not.toContain('overflow-hidden');
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
    const track = group.parentElement;
    expect(track).not.toBeNull();
    expect(track?.className).toContain('border-app-border');
    expect(track?.className).not.toContain('border-paper/20');
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

  it('keeps an unbadged option as a text-node label without aria-label', () => {
    renderWithLocale(
      <SegmentedControl
        value="active"
        options={NEUTRAL_OPTIONS}
        onChange={() => undefined}
        ariaLabel="Forum view"
        tone="neutral"
      />,
    );
    const active = screen.getByRole('button', { name: /^Active$/ });
    expect(active.hasAttribute('aria-label')).toBe(false);
    expect(active.childElementCount).toBe(0);
  });

  it('exposes a positive badge as an aria-hidden chip and uses badgeAriaLabel', () => {
    renderWithLocale(
      <SegmentedControl
        value="active"
        options={[
          { value: 'active' as const, label: 'Active' },
          {
            value: 'unpaid' as const,
            label: 'No gifts yet',
            badge: 3,
            badgeAriaLabel: 'No gifts yet, 3 new',
          },
        ]}
        onChange={() => undefined}
        ariaLabel="Forum view"
        tone="neutral"
      />,
    );
    const unpaid = screen.getByRole('button', { name: 'No gifts yet, 3 new' });
    expect(unpaid.getAttribute('aria-label')).toBe('No gifts yet, 3 new');
    const chip = screen.getByText('3');
    expect(chip.tagName).toBe('SPAN');
    expect(chip.getAttribute('aria-hidden')).toBe('true');
    expect(unpaid.contains(chip)).toBe(true);
  });

  it('treats badge 0 like no badge', () => {
    renderWithLocale(
      <SegmentedControl
        value="active"
        options={[
          { value: 'active' as const, label: 'Active', badge: 0 },
          { value: 'all' as const, label: 'All' },
        ]}
        onChange={() => undefined}
        ariaLabel="Forum view"
        tone="neutral"
      />,
    );
    const active = screen.getByRole('button', { name: /^Active$/ });
    expect(active.hasAttribute('aria-label')).toBe(false);
    expect(active.childElementCount).toBe(0);
    expect(screen.queryByText('0')).toBeNull();
  });

  it('covers a gift-tone option with a positive badge', () => {
    renderWithLocale(
      <SegmentedControl
        value="sat"
        options={[
          { value: 'sat' as const, label: '₿', badge: 2, badgeAriaLabel: '2 new' },
          { value: 'usd' as const, label: 'USD' },
        ]}
        onChange={() => undefined}
        ariaLabel="Chart scale"
        tone="gift"
      />,
    );
    const sat = screen.getByRole('button', { name: '2 new' });
    expect(sat.getAttribute('aria-label')).toBe('2 new');
    const chip = screen.getByText('2');
    expect(chip.tagName).toBe('SPAN');
    expect(chip.getAttribute('aria-hidden')).toBe('true');
    expect(sat.contains(chip)).toBe(true);
  });

  it('keeps the visible label as the accessible name when badgeAriaLabel is empty', () => {
    renderWithLocale(
      <SegmentedControl
        value="active"
        options={[
          { value: 'active' as const, label: 'Active' },
          { value: 'unpaid' as const, label: 'No gifts yet', badge: 3, badgeAriaLabel: '' },
        ]}
        onChange={() => undefined}
        ariaLabel="Forum view"
        tone="neutral"
      />,
    );
    const unpaid = screen.getByRole('button', { name: /^No gifts yet$/ });
    expect(unpaid.hasAttribute('aria-label')).toBe(false);
    expect(screen.getByText('3').getAttribute('aria-hidden')).toBe('true');
  });

  it('renders a trailing control outside the group on the neutral pill', () => {
    renderWithLocale(
      <SegmentedControl
        value="active"
        options={NEUTRAL_OPTIONS}
        onChange={() => undefined}
        ariaLabel="Forum view"
        tone="neutral"
        className="extra"
        trailing={<button type="button">Bell</button>}
      />,
    );
    const group = screen.getByRole('group', { name: 'Forum view' });
    const trailing = screen.getByRole('button', { name: 'Bell' });
    expect(trailing).toBeTruthy();
    expect(group.contains(trailing)).toBe(false);
    const track = group.parentElement;
    expect(track).not.toBeNull();
    expect(track?.className).toContain('rounded-full');
    expect(track?.className).toContain('overflow-hidden');
    expect(track?.className).toContain('extra');
    expect(track?.contains(trailing)).toBe(true);
    let ancestor: HTMLElement | null = trailing;
    let foundRounded = false;
    let foundOverflow = false;
    while (ancestor !== null) {
      if (ancestor.className.includes('rounded-full')) {
        foundRounded = true;
      }
      if (ancestor.className.includes('overflow-hidden')) {
        foundOverflow = true;
      }
      ancestor = ancestor.parentElement;
    }
    expect(foundRounded).toBe(true);
    expect(foundOverflow).toBe(true);
    const separator = Array.from(track?.children ?? []).find(
      (el) => el.tagName === 'SPAN' && el.getAttribute('aria-hidden') === 'true',
    );
    expect(separator).toBeTruthy();
    expect(separator?.className).toContain('w-px');
    expect(separator?.className).toContain('bg-app-border');
  });

  it('ignores trailing on gift tone', () => {
    renderWithLocale(
      <SegmentedControl
        value="sat"
        options={GIFT_OPTIONS}
        onChange={() => undefined}
        ariaLabel="Chart scale"
        tone="gift"
        trailing={<button type="button">Bell</button>}
      />,
    );
    expect(screen.getByRole('group', { name: 'Chart scale' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Bell' })).toBeNull();
  });
});
