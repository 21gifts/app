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
    const { container } = renderWithLocale(<HandbookOutline chapters={[]} title="Contents" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders three nested link levels', () => {
    renderWithLocale(
      <HandbookOutline
        title="Contents"
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
    const welcomeLinks = screen.getAllByRole('link', { name: '/welcome' });
    expect(welcomeLinks[0]?.getAttribute('href')).toBe('#chapter-welcome');
    expect(welcomeLinks[1]?.getAttribute('href')).toBe('#screen-welcome');
    expect(screen.getByRole('link', { name: 'pay-qr' }).getAttribute('href')).toBe(
      '#welcome-pay-qr',
    );
  });
});
