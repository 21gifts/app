import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { HandbookSectionHeading } from '@/components/HandbookSectionHeading';
import { renderWithLocale } from '@/__tests__/render-with-locale';

afterEach(cleanup);

describe('HandbookSectionHeading', () => {
  it('renders an h2 permalink and copy-link', () => {
    renderWithLocale(<HandbookSectionHeading level={2} id="chapter-setup" label="/setup" />);
    expect(screen.getByRole('heading', { level: 2, name: '/setup' })).toBeTruthy();
    expect(document.getElementById('chapter-setup')).toBeTruthy();
    expect(screen.getByRole('link', { name: '/setup' }).getAttribute('href')).toBe(
      '#chapter-setup',
    );
    expect(screen.getByRole('button', { name: 'Copy link to /setup' })).toBeTruthy();
  });

  it('renders an h3 permalink and copy-link', () => {
    renderWithLocale(
      <HandbookSectionHeading level={3} id="screen-setup-rules" label="/setup/rules" />,
    );
    expect(screen.getByRole('heading', { level: 3, name: '/setup/rules' })).toBeTruthy();
    expect(screen.getByRole('link', { name: '/setup/rules' }).getAttribute('href')).toBe(
      '#screen-setup-rules',
    );
  });
});
