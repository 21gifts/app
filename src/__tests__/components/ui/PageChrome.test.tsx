import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PageChrome } from '@/components/ui/PageChrome';
import { renderWithLocale } from '@/__tests__/render-with-locale';

afterEach(cleanup);

describe('PageChrome', () => {
  it('renders children inside a full-height main without topRight', () => {
    const { container } = renderWithLocale(
      <PageChrome>
        <p>Body</p>
      </PageChrome>,
    );
    const main = container.querySelector('main');
    expect(main?.className).toContain('min-h-screen');
    expect(screen.getByText('Body')).toBeTruthy();
    expect(main?.querySelector('.absolute')).toBeNull();
  });

  it('renders topRight in the absolute slot', () => {
    renderWithLocale(
      <PageChrome topRight={<span data-testid="slot">TR</span>}>
        <p>Body</p>
      </PageChrome>,
    );
    expect(screen.getByTestId('slot')).toBeTruthy();
  });

  it('omits the topRight slot when topRight is null', () => {
    const { container } = renderWithLocale(
      <PageChrome topRight={null}>
        <p>Body</p>
      </PageChrome>,
    );
    expect(container.querySelector('main')?.querySelector('.absolute')).toBeNull();
  });

  it('appends className and treats empty className as absent', () => {
    const { container, rerender } = renderWithLocale(
      <PageChrome className="extra">
        <p>A</p>
      </PageChrome>,
    );
    expect(container.querySelector('main')?.className).toContain('extra');

    rerender(
      <PageChrome className="">
        <p>B</p>
      </PageChrome>,
    );
    expect(container.querySelector('main')?.className).not.toContain('undefined');
  });
});
