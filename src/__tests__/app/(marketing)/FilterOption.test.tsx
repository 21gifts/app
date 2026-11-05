import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FilterOption } from '@/app/(marketing)/FilterOption';

afterEach(cleanup);

describe('FilterOption', () => {
  it('shows an active selected option with its swatch and stops click propagation', () => {
    const onChoose = vi.fn();
    const onParent = vi.fn();
    render(
      <div onClick={onParent}>
        <FilterOption
          option={{ value: 'daily', label: 'Daily', swatch: 'daily-swatch' }}
          index={1}
          activeIndex={1}
          value="daily"
          optionDomId={(index) => `option-${index}`}
          onChoose={onChoose}
        />
      </div>,
    );
    const option = screen.getByRole('option', { name: 'Daily', selected: true });
    expect(option.id).toBe('option-1');
    expect(option.className).toContain('is-active');
    expect(option.className).toContain('font-semibold');
    expect(option.querySelector('.daily-swatch')?.getAttribute('aria-hidden')).toBe('true');
    expect(option.querySelector('svg')).toBeTruthy();
    fireEvent.click(option);
    expect(onChoose).toHaveBeenCalledOnce();
    expect(onChoose.mock.calls[0]?.[1]).toBe('daily');
    expect(onParent).not.toHaveBeenCalled();
  });

  it('renders an inactive unselected option without a swatch or check', () => {
    render(
      <FilterOption
        option={{ value: 'btc', label: 'Bitcoin', swatch: null }}
        index={1}
        activeIndex={0}
        value=""
        optionDomId={(index) => `option-${index}`}
        onChoose={vi.fn()}
      />,
    );
    const option = screen.getByRole('option', { name: 'Bitcoin', selected: false });
    expect(option.className).toContain('hover:bg-home-why');
    expect(option.className).not.toContain('font-semibold');
    expect(option.querySelector('svg')).toBeNull();
    expect(option.querySelectorAll('span')).toHaveLength(1);
  });

  it('keeps a selected option emphasized when another option is active', () => {
    render(
      <FilterOption
        option={{ value: 'btc', label: 'Bitcoin', swatch: null }}
        index={1}
        activeIndex={0}
        value="btc"
        optionDomId={(index) => `option-${index}`}
        onChoose={vi.fn()}
      />,
    );
    const option = screen.getByRole('option', { selected: true });
    expect(option.className).toContain('hover:bg-home-why');
    expect(option.className).toContain('font-semibold');
  });

  it('does not emphasize an active option unless it is selected', () => {
    render(
      <FilterOption
        option={{ value: 'btc', label: 'Bitcoin', swatch: null }}
        index={1}
        activeIndex={1}
        value=""
        optionDomId={(index) => `option-${index}`}
        onChoose={vi.fn()}
      />,
    );
    const option = screen.getByRole('option', { selected: false });
    expect(option.className).toContain('is-active');
    expect(option.className).not.toContain('font-semibold');
  });
});
