import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MenuScroll } from '@/app/(marketing)/MenuScroll';

afterEach(cleanup);

describe('MenuScroll', () => {
  it('renders rows without a scrollport when scrolling is unnecessary', () => {
    const { container } = render(<MenuScroll scrolling={false}>Option</MenuScroll>);
    expect(screen.getByText('Option')).toBeTruthy();
    expect(container.querySelector('[data-scrollport]')).toBeNull();
  });

  it('wraps rows in a scrollport when scrolling is needed', () => {
    const { container } = render(<MenuScroll scrolling>Option</MenuScroll>);
    const port = container.querySelector('[data-scrollport]');
    expect(port?.textContent).toBe('Option');
    expect(port?.className).toContain('flex-1');
  });
});
