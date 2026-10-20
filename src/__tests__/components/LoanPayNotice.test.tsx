import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { LoanPayNotice } from '@/components/LoanPayNotice';
import { renderWithLocale } from '@/__tests__/render-with-locale';

afterEach(cleanup);

describe('LoanPayNotice', () => {
  it('says who is lent to and how many daily payments bring it back', () => {
    renderWithLocale(<LoanPayNotice name="Maria" days={30} full={false} />);
    const notice = screen.getByText(
      'You are lending to Maria. Once the loan is fully funded, you get it back in 30 daily payments.',
    );
    expect(notice.getAttribute('data-loan-notice')).toBe('lend');
  });

  it('says one payment for a one-day term', () => {
    renderWithLocale(<LoanPayNotice name="Maria" days={1} full={false} />);
    expect(
      screen.getByText(
        'You are lending to Maria. Once the loan is fully funded, you get it back in one payment.',
      ),
    ).toBeTruthy();
  });

  it('leaves the count out when the note has no term', () => {
    renderWithLocale(<LoanPayNotice name="Maria" days={undefined} full={false} />);
    expect(
      screen.getByText(
        'You are lending to Maria. Once the loan is fully funded, you get it back in daily payments.',
      ),
    ).toBeTruthy();
  });

  it('calls a payment on a full loan a gift', () => {
    renderWithLocale(<LoanPayNotice name="Maria" days={30} full />);
    const notice = screen.getByText(
      'This loan is already fully funded. What you send now is a gift to Maria.',
    );
    expect(notice.getAttribute('data-loan-notice')).toBe('full');
  });

  it('speaks German', () => {
    renderWithLocale(<LoanPayNotice name="Maria" days={30} full={false} />, 'de');
    expect(screen.getByText(/Sie leihen Maria Geld\./)).toBeTruthy();
  });
});
