import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AppShell } from '@/components/AppShell';
import { Card } from '@/components/ui/Card';
import { renderWithLocale } from '@/__tests__/render-with-locale';

afterEach(cleanup);

describe('Card', () => {
  it('defaults to max-w-sm', () => {
    renderWithLocale(<Card>Body</Card>);
    const section = screen.getByText('Body').closest('section');
    expect(section?.className).toContain('max-w-sm');
    expect(section?.className).toContain('bg-app-card');
    expect(section?.className).toContain('rounded-3xl');
  });

  it('surface={false} omits panel classes and keeps width plus flex', () => {
    renderWithLocale(<Card surface={false}>Bare</Card>);
    const section = screen.getByText('Bare').closest('section');
    expect(section?.className).toContain('max-w-sm');
    expect(section?.className).toContain('flex');
    expect(section?.className).not.toContain('bg-app-card');
    expect(section?.className).not.toContain('rounded-3xl');
    expect(section?.className).not.toContain('shadow-sm');
    expect(section?.className).not.toContain('p-8');
  });

  it('applies md and xl maxWidth plus className', () => {
    const { rerender } = renderWithLocale(
      <Card maxWidth="md" className="extra">
        Mid
      </Card>,
    );
    expect(screen.getByText('Mid').closest('section')?.className).toContain('max-w-md');
    expect(screen.getByText('Mid').closest('section')?.className).toContain('extra');

    rerender(<Card maxWidth="xl">Wide</Card>);
    expect(screen.getByText('Wide').closest('section')?.className).toContain('max-w-xl');
  });

  it('treats an empty className like no className', () => {
    renderWithLocale(<Card className="">Plain</Card>);
    expect(screen.getByText('Plain').closest('section')?.className).not.toContain('undefined');
  });

  it('without AppShell renders only children, no chrome header', () => {
    renderWithLocale(<Card>Body</Card>);
    const section = screen.getByText('Body').closest('section');
    expect(section?.querySelector('.justify-between')).toBeNull();
    expect(section?.textContent).toBe('Body');
  });

  it('never renders a chrome header; AppShell hosts wordmark and menu', () => {
    const { container } = renderWithLocale(
      <AppShell
        mode="fill"
        align="center"
        topLeft={<span data-testid="left">L</span>}
        topRight={<span data-testid="right">R</span>}
      >
        <Card>Body</Card>
      </AppShell>,
    );
    const card = screen.getByText('Body').closest('section');
    expect(card?.querySelector('.justify-between')).toBeNull();
    expect(card?.contains(screen.getByTestId('left'))).toBe(false);
    expect(card?.contains(screen.getByTestId('right'))).toBe(false);
    const chrome = container.querySelector('[data-app-chrome]');
    expect(chrome?.contains(screen.getByTestId('left'))).toBe(true);
    expect(chrome?.contains(screen.getByTestId('right'))).toBe(true);
  });
});
