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
    expect(main?.className).toContain('h-[var(--app-height)]');
    expect(main?.className).toContain('overflow-hidden');
    expect(main?.className).not.toContain('justify-center');
    expect(screen.getByText('Body')).toBeTruthy();
    const chrome = main?.querySelector('[data-app-chrome]');
    expect(chrome).toBeTruthy();
    expect(chrome?.lastElementChild?.className).toContain('empty:hidden');
    expect(chrome?.lastElementChild?.className).toContain('ml-auto');
    expect(chrome?.lastElementChild?.childNodes.length).toBe(0);
  });

  it('renders topRight in the frame chrome row', () => {
    const { container } = renderWithLocale(
      <PageChrome topRight={<span data-testid="slot">TR</span>}>
        <p>Body</p>
      </PageChrome>,
    );
    const chrome = container.querySelector('[data-app-chrome]');
    expect(chrome?.contains(screen.getByTestId('slot'))).toBe(true);
    expect(chrome?.lastElementChild?.className).toContain('ml-auto');
  });

  it('renders topLeft in the frame chrome row', () => {
    const { container } = renderWithLocale(
      <PageChrome topLeft={<span data-testid="brand">21.gifts</span>}>
        <p>Body</p>
      </PageChrome>,
    );
    const chrome = container.querySelector('[data-app-chrome]');
    expect(chrome?.contains(screen.getByTestId('brand'))).toBe(true);
    expect(chrome?.firstElementChild?.className).toContain('flex');
    expect(chrome?.firstElementChild?.className).toContain('gap-2');
  });

  it('appends non-viewport className extras', () => {
    const { container } = renderWithLocale(
      <PageChrome className="justify-start">
        <p>Body</p>
      </PageChrome>,
    );
    const main = container.querySelector('main');
    expect(main?.className).toContain('justify-start');
    expect(main?.className).toContain('h-[var(--app-height)]');
    expect(main?.className).toContain('overflow-hidden');
    expect(main?.className).not.toContain('justify-center');
  });

  it('omits the topLeft slot when topLeft is null', () => {
    const { container } = renderWithLocale(
      <PageChrome topLeft={null}>
        <p>Body</p>
      </PageChrome>,
    );
    const leftHost = container.querySelector('[data-app-chrome]')?.firstElementChild;
    expect(leftHost?.className).toContain('empty:hidden');
    expect(leftHost?.childNodes.length).toBe(0);
  });

  it('omits the topRight slot when topRight is null', () => {
    const { container } = renderWithLocale(
      <PageChrome topRight={null}>
        <p>Body</p>
      </PageChrome>,
    );
    const rightHost = container.querySelector('[data-app-chrome]')?.lastElementChild;
    expect(rightHost?.className).toContain('empty:hidden');
    expect(rightHost?.className).toContain('ml-auto');
    expect(rightHost?.childNodes.length).toBe(0);
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
