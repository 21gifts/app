import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FundingPausedCopy } from '@/components/FundingPausedCopy';
import { renderWithLocale } from '@/__tests__/render-with-locale';

afterEach(cleanup);

describe('FundingPausedCopy', () => {
  it('shows the paused sentence and the statistics link, not an apply control', () => {
    renderWithLocale(<FundingPausedCopy />);
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

  it('uses the German paused sentence', () => {
    renderWithLocale(<FundingPausedCopy />, 'de');
    expect(
      screen.getByText(
        'Bewerbungen sind zurzeit pausiert. Eine Bewerbung ist wieder möglich, wenn die Shop-Transaktionen gestiegen sind.',
      ),
    ).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'https://21.gifts/statistics' }).getAttribute('href'),
    ).toBe('https://21.gifts/statistics');
  });
});
