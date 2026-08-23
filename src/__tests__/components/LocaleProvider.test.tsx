import { cleanup, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { LocaleProvider, useTranslations } from '@/components/LocaleProvider';
import { getCatalog } from '@/lib/messages';

afterEach(cleanup);

function Probe(): ReactElement {
  const { locale, t } = useTranslations();
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="label">{t('language.label')}</span>
      <span data-testid="pay">{t('donate.pay', { amount: '1 sat', address: 'a@b.c' })}</span>
    </div>
  );
}

describe('LocaleProvider', () => {
  it('supplies locale and translate to descendants', () => {
    render(
      <LocaleProvider locale="de" messages={getCatalog('de')}>
        <Probe />
      </LocaleProvider>,
    );
    expect(screen.getByTestId('locale').textContent).toBe('de');
    expect(screen.getByTestId('label').textContent).toBe('Sprache');
    expect(screen.getByTestId('pay').textContent).toBe('1 sat an a@b.c zahlen');
  });
});

describe('useTranslations', () => {
  it('throws outside LocaleProvider', () => {
    expect(() => render(<Probe />)).toThrow(/useTranslations must be used within LocaleProvider/);
  });
});
