import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Scrollport } from '@/components/ui/Scrollport';

afterEach(cleanup);

describe('Scrollport', () => {
  it('locks an ancestor scrollport and unlocks it on unmount', () => {
    const { rerender, unmount } = render(
      <Scrollport>
        <p>Page</p>
      </Scrollport>,
    );
    const page = document.querySelector('[data-scrollport]');
    expect(page?.hasAttribute('data-scroll-locked')).toBe(false);

    rerender(
      <Scrollport>
        <p>Page</p>
        <Scrollport>
          <p>Dialog</p>
        </Scrollport>
      </Scrollport>,
    );
    const ports = document.querySelectorAll('[data-scrollport]');
    expect(ports).toHaveLength(2);
    expect(ports[0]?.hasAttribute('data-scroll-locked')).toBe(true);
    expect(ports[1]?.hasAttribute('data-scroll-locked')).toBe(false);

    rerender(
      <Scrollport>
        <p>Page</p>
      </Scrollport>,
    );
    expect(document.querySelector('[data-scrollport]')?.hasAttribute('data-scroll-locked')).toBe(
      false,
    );
    unmount();
  });

  it('does not lock a sibling scrollport', () => {
    render(
      <div>
        <Scrollport>
          <p>One</p>
        </Scrollport>
        <Scrollport>
          <p>Two</p>
        </Scrollport>
      </div>,
    );
    for (const port of document.querySelectorAll('[data-scrollport]')) {
      expect(port.hasAttribute('data-scroll-locked')).toBe(false);
    }
  });
});
