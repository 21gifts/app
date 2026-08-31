import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { HandbookImageViewer } from '@/components/HandbookImageViewer';
import type { HandbookTopic } from '@/lib/handbook-topics';
import { renderWithLocale } from '@/__tests__/render-with-locale';

afterEach(cleanup);

const ALL: HandbookTopic = {
  id: 'welcome:default',
  label: '/welcome default',
  visual: 'screen-welcome',
  combos: ['desktop-light', 'desktop-dark', 'mobile-light', 'mobile-dark'],
};

const MOBILE_ONLY: HandbookTopic = {
  id: 'root:mobile-nav',
  label: '/ mobile-nav',
  visual: 'state-root-mobile-nav',
  combos: ['mobile-light', 'mobile-dark'],
};

const LIGHT_ONLY: HandbookTopic = {
  id: 'pay:qr',
  label: '/welcome pay-qr',
  visual: 'state-welcome-pay-qr',
  combos: ['desktop-light'],
};

describe('HandbookImageViewer', () => {
  it('renders nothing when there are no topics', () => {
    const { container } = renderWithLocale(<HandbookImageViewer topics={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('switches viewport and theme when both exist', () => {
    renderWithLocale(<HandbookImageViewer topics={[ALL, MOBILE_ONLY]} />);
    const img = screen.getByAltText('/welcome default') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('/handbook-images/screen-welcome-desktop-light.png');
    fireEvent.click(screen.getByRole('button', { name: 'Mobile' }));
    expect(img.getAttribute('src')).toBe('/handbook-images/screen-welcome-mobile-light.png');
    fireEvent.click(screen.getByRole('button', { name: 'Dark' }));
    expect(img.getAttribute('src')).toBe('/handbook-images/screen-welcome-mobile-dark.png');
    fireEvent.click(screen.getByRole('button', { name: 'Desktop' }));
    expect(img.getAttribute('src')).toBe('/handbook-images/screen-welcome-desktop-dark.png');
    fireEvent.click(screen.getByRole('button', { name: 'Light' }));
    expect(img.getAttribute('src')).toBe('/handbook-images/screen-welcome-desktop-light.png');
  });

  it('hides the theme switch when only one combo exists', () => {
    renderWithLocale(<HandbookImageViewer topics={[LIGHT_ONLY]} />);
    expect(screen.queryByRole('button', { name: 'Dark' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mobile' })).toBeNull();
  });

  it('hides the desktop switch when only mobile combos exist', () => {
    renderWithLocale(<HandbookImageViewer topics={[MOBILE_ONLY]} />);
    expect(screen.queryByRole('button', { name: 'Desktop' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Dark' })).toBeTruthy();
    expect((screen.getByAltText('/ mobile-nav') as HTMLImageElement).getAttribute('src')).toBe(
      '/handbook-images/state-root-mobile-nav-mobile-light.png',
    );
  });

  it('selects another topic and resets to its default combo', () => {
    renderWithLocale(<HandbookImageViewer topics={[ALL, MOBILE_ONLY]} />);
    fireEvent.change(screen.getByLabelText('Topic'), { target: { value: MOBILE_ONLY.id } });
    expect((screen.getByAltText('/ mobile-nav') as HTMLImageElement).getAttribute('src')).toBe(
      '/handbook-images/state-root-mobile-nav-mobile-light.png',
    );
  });
});
