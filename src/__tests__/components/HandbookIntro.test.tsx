import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { HandbookIntro } from '@/components/HandbookIntro';

const en = {
  title: 'Handbook',
  introBefore: 'before',
  introAfter: '.',
  navAria: 'Handbook sections',
};
const de = {
  title: 'Handbuch',
  introBefore: 'before',
  introAfter: '.',
  navAria: 'Handbuchabschnitte',
};

afterEach(cleanup);

describe('HandbookIntro', () => {
  it('renders the English heading and api handbook link', () => {
    render(
      <HandbookIntro {...en} headingAction={null}>
        nav
      </HandbookIntro>,
    );
    expect(screen.getByRole('heading', { name: 'Handbook' })).toBeTruthy();
    expect(screen.getByRole('link', { name: '21gifts/api' }).getAttribute('href')).toBe(
      'https://github.com/21gifts/api/tree/develop/docs/handbook',
    );
  });

  it('renders the German heading when locale is de', () => {
    render(
      <HandbookIntro {...de} headingAction={null}>
        nav
      </HandbookIntro>,
    );
    expect(screen.getByRole('heading', { name: 'Handbuch' })).toBeTruthy();
  });

  it('localizes the section nav aria-label', () => {
    render(
      <HandbookIntro {...de} headingAction={null}>
        nav
      </HandbookIntro>,
    );
    expect(screen.getByRole('navigation', { name: 'Handbuchabschnitte' })).toBeTruthy();
  });
});
