import { cleanup, fireEvent, screen } from '@testing-library/react';
import type { MouseEventHandler, ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ForumHomeWordmark } from '@/components/ForumHomeWordmark';
import { FORUM_HOME_EVENT } from '@/lib/forum-feed';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    onClick,
    ...rest
  }: {
    href: string;
    children: ReactNode;
    onClick?: MouseEventHandler<HTMLAnchorElement>;
    [key: string]: unknown;
  }) => (
    <a href={href} onClick={onClick} {...rest}>
      {children}
    </a>
  ),
}));

afterEach(cleanup);

describe('ForumHomeWordmark', () => {
  it('prevents navigation and dispatches the forum home event', () => {
    const listener = vi.fn();
    window.addEventListener(FORUM_HOME_EVENT, listener);
    renderWithLocale(<ForumHomeWordmark />);

    const clickCompleted = fireEvent.click(screen.getByRole('link', { name: '21.gifts' }));

    expect(clickCompleted).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(FORUM_HOME_EVENT, listener);
  });
});
