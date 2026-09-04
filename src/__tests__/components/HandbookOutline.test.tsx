import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { HandbookOutline } from '@/components/HandbookOutline';
import { renderWithLocale } from '@/__tests__/render-with-locale';
import { HANDBOOK_COMBOS, type HandbookTopic } from '@/lib/handbook-topics';

afterEach(cleanup);

const topic: HandbookTopic = {
  id: '/welcome:pay-qr',
  label: '/welcome pay-qr',
  description: 'Pay QR',
  visual: 'state-welcome-pay-qr',
  combos: [...HANDBOOK_COMBOS],
};

describe('HandbookOutline', () => {
  it('renders nothing when there are no chapters', () => {
    const { container } = renderWithLocale(<HandbookOutline chapters={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders three nested link levels', () => {
    renderWithLocale(
      <HandbookOutline
        chapters={[
          {
            id: 'chapter-welcome',
            label: '/welcome',
            screens: [
              {
                id: 'screen-welcome',
                path: '/welcome',
                label: '/welcome',
                topics: [{ topic, id: 'welcome-pay-qr', label: 'pay-qr' }],
              },
            ],
          },
        ]}
      />,
    );
    expect(screen.getByRole('navigation', { name: 'Contents' })).toBeTruthy();
    expect(screen.getByRole('link', { name: '/welcome' }).getAttribute('href')).toBe(
      '#chapter-welcome',
    );
    const screenLinks = screen.getAllByRole('link', { name: '/welcome' });
    expect(screenLinks[1]?.getAttribute('href')).toBe('#screen-welcome');
    expect(screen.getByRole('link', { name: 'pay-qr' }).getAttribute('href')).toBe(
      '#welcome-pay-qr',
    );
  });
});
