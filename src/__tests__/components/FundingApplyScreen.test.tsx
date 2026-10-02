import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FundingApplyScreen } from '@/components/FundingApplyScreen';
import { renderWithLocale } from '@/__tests__/render-with-locale';

afterEach(cleanup);

describe('FundingApplyScreen', () => {
  it('shows the paused heading, sentence, and statistics link', () => {
    renderWithLocale(<FundingApplyScreen />);
    expect(screen.getByRole('heading', { name: '21 gifts grant', level: 1 })).toBeTruthy();
    expect(
      screen.getByText(
        'Applications are currently paused. You can apply again when shop transactions have increased.',
      ),
    ).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'https://21.gifts/statistics' }).getAttribute('href'),
    ).toBe('https://21.gifts/statistics');
    expect(screen.queryByRole('link', { name: 'Apply for the 21 gifts grant' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Apply for the 21 gifts grant' })).toBeNull();
  });
});
