import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button } from '@/components/ui/Button';
import { renderWithLocale } from '@/__tests__/render-with-locale';

afterEach(cleanup);

describe('Button', () => {
  it('renders primary by default with type=button', () => {
    renderWithLocale(<Button>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button.getAttribute('type')).toBe('button');
    expect(button.className).toContain('bg-app-btn');
  });

  it('applies the secondary variant and custom className', () => {
    renderWithLocale(
      <Button variant="secondary" className="extra">
        Cancel
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Cancel' });
    expect(button.className).toContain('border-app-border-strong');
    expect(button.className).toContain('extra');
  });

  it('forwards type=submit and click handlers', () => {
    const onClick = vi.fn();
    renderWithLocale(
      <Button type="submit" onClick={onClick}>
        Go
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Go' });
    expect(button.getAttribute('type')).toBe('submit');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders an optional leading icon', () => {
    renderWithLocale(
      <Button icon={<span data-testid="icon">*</span>}>Labeled</Button>,
    );
    expect(screen.getByTestId('icon')).toBeTruthy();
    expect(screen.getByRole('button', { name: '* Labeled' })).toBeTruthy();
  });

  it('treats an empty className like no className', () => {
    renderWithLocale(<Button className="">Plain</Button>);
    expect(screen.getByRole('button', { name: 'Plain' }).className).not.toContain('undefined');
  });
});
