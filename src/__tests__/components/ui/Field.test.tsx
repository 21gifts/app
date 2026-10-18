import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Field } from '@/components/ui/Field';
import { renderWithLocale } from '@/__tests__/render-with-locale';

afterEach(cleanup);

describe('Field', () => {
  it('renders a single-line input with an id derived from the label', () => {
    renderWithLocale(<Field label="Your name" />);
    const input = screen.getByLabelText('Your name');
    expect(input.tagName).toBe('INPUT');
    expect(input.id).toBe('field-your-name');
    expect(input.className).toContain('min-h-11');
    expect(input.className).toContain('bg-app-card');
    expect(input.className).toContain('placeholder:text-app-subtle');
    expect(input.className).toContain('focus-visible:border-app-fg');
    expect(input.className).toContain('text-base');
    expect(input.className).not.toContain('text-sm');
  });

  it('uses an explicit id when provided', () => {
    renderWithLocale(<Field label="Email" id="email-field" />);
    expect(screen.getByLabelText('Email').id).toBe('email-field');
  });

  it('renders a multiline textarea when multiline is true', () => {
    const onChange = vi.fn();
    renderWithLocale(<Field label="Message" multiline value="hi" onChange={onChange} />);
    const control = screen.getByLabelText('Message');
    expect(control.tagName).toBe('TEXTAREA');
    fireEvent.change(control, { target: { value: 'hello' } });
    expect(onChange).toHaveBeenCalled();
  });

  it('links hint and error copy and marks an invalid input', () => {
    renderWithLocale(
      <Field
        label="Postal code"
        id="postal"
        hint="Use the local format."
        error="Use 4 digits."
        aria-describedby="outside-help"
      />,
    );
    const input = screen.getByLabelText('Postal code');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('outside-help postal-hint postal-error');
    expect(screen.getByText('Use the local format.').id).toBe('postal-hint');
    expect(screen.getByText('Use 4 digits.').id).toBe('postal-error');
    expect(screen.getByText('Use 4 digits.').className).toContain('text-app-danger');
  });

  it('links validation copy on a multiline field', () => {
    renderWithLocale(<Field label="Message" multiline error="Too long." />);
    expect(screen.getByLabelText('Message').getAttribute('aria-describedby')).toBe(
      'field-message-error',
    );
  });

  it('applies className on the label wrapper and ignores empty className', () => {
    const { rerender } = renderWithLocale(<Field label="Tagged" className="wrap" />);
    expect(screen.getByText('Tagged').parentElement?.className).toContain('wrap');

    rerender(<Field label="Plain" className="" />);
    expect(screen.getByText('Plain').parentElement?.className).not.toContain('undefined');
  });
});
