import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { HandbookIntro } from '@/components/HandbookIntro';
import { renderWithLocale } from '@/__tests__/render-with-locale';

afterEach(cleanup);

describe('HandbookIntro', () => {
  it('renders the English heading and api handbook link', () => {
    renderWithLocale(<HandbookIntro>nav</HandbookIntro>);
    expect(screen.getByRole('heading', { name: 'Handbook' })).toBeTruthy();
    expect(screen.getByRole('link', { name: '21gifts/api' }).getAttribute('href')).toBe(
      'https://github.com/21gifts/api/tree/develop/docs/handbook',
    );
  });

  it('renders the German heading when locale is de', () => {
    renderWithLocale(<HandbookIntro>nav</HandbookIntro>, 'de');
    expect(screen.getByRole('heading', { name: 'Handbuch' })).toBeTruthy();
  });

  it('localizes the section nav aria-label', () => {
    renderWithLocale(<HandbookIntro>nav</HandbookIntro>, 'de');
    expect(screen.getByRole('navigation', { name: 'Handbuchabschnitte' })).toBeTruthy();
  });
});
