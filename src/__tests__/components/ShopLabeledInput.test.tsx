import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShopLabeledInput } from '@/components/ShopLabeledInput';
import { renderWithLocale } from '@/__tests__/render-with-locale';

afterEach(() => {
  cleanup();
});

describe('ShopLabeledInput', () => {
  it('associates the label with the input and passes native props', () => {
    const onChange = vi.fn();
    renderWithLocale(
      <ShopLabeledInput
        label="Street"
        id="field-test-street"
        autoComplete="off"
        value="Bahnhofstrasse"
        onChange={onChange}
      />,
    );
    const input = screen.getByLabelText('Street', { exact: true });
    expect(input.tagName).toBe('INPUT');
    expect(input.id).toBe('field-test-street');
    expect(input).toHaveProperty('value', 'Bahnhofstrasse');
    expect(input.getAttribute('autocomplete')).toBe('off');
    expect(input.parentElement?.tagName).toBe('DIV');
    const label = screen.getByText('Street', { selector: 'label', exact: true });
    expect((label as HTMLLabelElement).htmlFor).toBe(input.id);
    fireEvent.change(input, { target: { value: 'Limmatquai' } });
    expect(onChange).toHaveBeenCalled();
  });

  it('forwards disabled onto the input', () => {
    renderWithLocale(
      <ShopLabeledInput
        label="City"
        id="field-test-city"
        value="Zürich"
        disabled
        onChange={() => undefined}
      />,
    );
    expect(screen.getByLabelText('City', { exact: true }).hasAttribute('disabled')).toBe(true);
  });

  it('links its hint and error to the invalid input', () => {
    renderWithLocale(
      <ShopLabeledInput
        label="House number"
        id="house"
        hint="For example 12a."
        error="Starts with a digit."
      />,
    );
    const input = screen.getByLabelText('House number');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('house-hint house-error');
    expect(screen.getByText('For example 12a.').id).toBe('house-hint');
    expect(screen.getByText('Starts with a digit.').id).toBe('house-error');
  });
});
