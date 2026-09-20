import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ForumGoalBar } from '@/components/ForumGoalBar';
import { renderWithLocale } from '@/__tests__/render-with-locale';

afterEach(cleanup);

describe('ForumGoalBar', () => {
  it('renders nothing when goalSats is 0 or negative', () => {
    const { rerender } = renderWithLocale(<ForumGoalBar sats={21000} goalSats={0} />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByText('0%')).toBeNull();
    rerender(<ForumGoalBar sats={21000} goalSats={-1} />);
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('shows 0% with an empty track and no overflow fill', () => {
    const { container } = renderWithLocale(<ForumGoalBar sats={0} goalSats={21000} />);
    expect(screen.getByText('0%')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Goal progress 0 percent' })).toBeTruthy();
    expect(container.querySelector('[class*="fill-app-success"]')).toBeNull();
    expect(container.querySelector('[class*="fill-app-accent"]')).toBeNull();
    expect(screen.getByRole('img').querySelector('[style]')).toBeNull();
    expect(screen.getByRole('img').getAttribute('style')).toBeNull();
  });

  it('shows 100% with orange fill and no overflow fill', () => {
    const { container } = renderWithLocale(<ForumGoalBar sats={21000} goalSats={21000} />);
    expect(screen.getByText('100%')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Goal progress 100 percent' })).toBeTruthy();
    expect(container.querySelector('[class*="fill-app-accent"]')).not.toBeNull();
    expect(container.querySelector('[class*="fill-app-success"]')).toBeNull();
    expect(screen.getByRole('img').querySelector('[style]')).toBeNull();
  });

  it('shows 110% with overflow fill', () => {
    const { container } = renderWithLocale(<ForumGoalBar sats={23100} goalSats={21000} />);
    expect(screen.getByText('110%')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Goal progress 110 percent' })).toBeTruthy();
    expect(container.querySelector('[class*="fill-app-success"]')).not.toBeNull();
    expect(screen.getByRole('img').querySelector('[style]')).toBeNull();
  });

  it('shows an uncapped 250% label while painted overflow stays capped', () => {
    const { container } = renderWithLocale(<ForumGoalBar sats={52500} goalSats={21000} />);
    expect(screen.getByText('250%')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Goal progress 250 percent' })).toBeTruthy();
    const overflow = container.querySelector('[class*="fill-app-success"]');
    expect(overflow).not.toBeNull();
    expect(overflow?.getAttribute('width')).toBe('100');
    expect(screen.getByRole('img').querySelector('[style]')).toBeNull();
  });
});
