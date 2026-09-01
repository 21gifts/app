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

  it('applies className on the label wrapper and ignores empty className', () => {
    const { rerender } = renderWithLocale(<Field label="Tagged" className="wrap" />);
    expect(screen.getByText('Tagged').className).toContain('wrap');

    rerender(<Field label="Plain" className="" />);
    expect(screen.getByText('Plain').className).not.toContain('undefined');
  });
});
