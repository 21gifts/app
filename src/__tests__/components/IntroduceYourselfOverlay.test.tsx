import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IntroduceYourselfOverlay } from '@/components/IntroduceYourselfOverlay';
import { renderWithLocale } from '@/__tests__/render-with-locale';

afterEach(cleanup);

describe('IntroduceYourselfOverlay', () => {
  it('renders the title and CTA', () => {
    renderWithLocale(<IntroduceYourselfOverlay onDismiss={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: 'Introduce yourself' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Introduce yourself' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Write an introduction' }).getAttribute('href')).toBe(
      '/welcome',
    );
  });

  it('calls onDismiss when Close is clicked', () => {
    const onDismiss = vi.fn();
    renderWithLocale(<IntroduceYourselfOverlay onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onDismiss).toHaveBeenCalled();
  });
});
