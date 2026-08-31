import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Card } from '@/components/ui/Card';
import { renderWithLocale } from '@/__tests__/render-with-locale';

afterEach(cleanup);

describe('Card', () => {
  it('defaults to max-w-sm', () => {
    renderWithLocale(<Card>Body</Card>);
    const section = screen.getByText('Body').closest('section');
    expect(section?.className).toContain('max-w-sm');
    expect(section?.className).toContain('bg-app-card');
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
});
