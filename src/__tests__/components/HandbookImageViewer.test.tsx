import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { HandbookImageViewer } from '@/components/HandbookImageViewer';
import type { HandbookTopic } from '@/lib/handbook-topics';
import { renderWithLocale } from '@/__tests__/render-with-locale';

afterEach(cleanup);

const ALL: HandbookTopic = {
  id: 'welcome:default',
  label: '/welcome default',
  description: 'Welcome default description.',
  visual: 'screen-welcome',
  combos: ['desktop-light', 'desktop-dark', 'mobile-light', 'mobile-dark'],
};

const MOBILE_ONLY: HandbookTopic = {
  id: 'root:mobile-nav',
  label: '/ mobile-nav',
  description: 'Mobile nav description.',
  visual: 'state-root-mobile-nav',
  combos: ['mobile-light', 'mobile-dark'],
};

const LIGHT_ONLY: HandbookTopic = {
  id: 'pay:qr',
  label: '/welcome pay-qr',
  description: 'Pay QR description.',
  visual: 'state-welcome-pay-qr',
  combos: ['desktop-light'],
};

const DARK_ONLY: HandbookTopic = {
  id: 'pay:qr-dark',
  label: '/welcome pay-qr-dark',
  description: 'Pay QR dark description.',
  visual: 'state-welcome-pay-qr',
  combos: ['desktop-dark'],
};

const BOTH_VIEWPORTS_LIGHT_ONLY: HandbookTopic = {
  id: 'welcome:light-viewports',
  label: '/welcome light-viewports',
  description: 'Light viewports description.',
  visual: 'screen-welcome',
  combos: ['desktop-light', 'mobile-light'],
};

describe('HandbookImageViewer', () => {
  it('renders nothing when there are no topics', () => {
    const { container } = renderWithLocale(<HandbookImageViewer topics={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when every topic has empty combos', () => {
    const EMPTY: HandbookTopic = {
      id: 'empty',
      label: 'Empty',
      description: 'Empty topic.',
      visual: 'function-Empty',
      combos: [],
    };
    const { container } = renderWithLocale(<HandbookImageViewer topics={[EMPTY]} />);
    expect(container.firstChild).toBeNull();
  });

  it('grids only topics that have the selected combo; omits missing combos', () => {
    renderWithLocale(<HandbookImageViewer topics={[ALL, MOBILE_ONLY]} />);
    expect(screen.queryByLabelText('Topic')).toBeNull();
    expect(screen.getByRole('navigation', { name: 'Contents' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'welcome' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 3, name: 'welcome' })).toBeTruthy();
    expect(screen.getByAltText('/welcome default')).toBeTruthy();
    expect(screen.getByText('Welcome default description.')).toBeTruthy();
    expect(screen.queryByAltText('/ mobile-nav')).toBeNull();
    expect(screen.getByRole('button', { name: 'Desktop' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mobile' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Light' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Dark' })).toBeTruthy();
    expect(screen.queryByText('Desktop')).toBeNull();
    expect(screen.queryByText('Mobile')).toBeNull();
    expect(screen.queryByText('Light')).toBeNull();
    expect(screen.queryByText('Dark')).toBeNull();

    const allImg = screen.getByAltText('/welcome default') as HTMLImageElement;
    expect(allImg.getAttribute('src')).toBe('/handbook-images/screen-welcome-desktop-light.png');
    expect(document.getElementById('welcome-default')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Mobile' }));
    expect(screen.getByAltText('/welcome default')).toBeTruthy();
    expect(screen.getByAltText('/ mobile-nav')).toBeTruthy();
    expect(screen.getByText('Mobile nav description.')).toBeTruthy();
    expect((screen.getByAltText('/welcome default') as HTMLImageElement).getAttribute('src')).toBe(
      '/handbook-images/screen-welcome-mobile-light.png',
    );
    expect((screen.getByAltText('/ mobile-nav') as HTMLImageElement).getAttribute('src')).toBe(
      '/handbook-images/state-root-mobile-nav-mobile-light.png',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Dark' }));
    expect((screen.getByAltText('/welcome default') as HTMLImageElement).getAttribute('src')).toBe(
      '/handbook-images/screen-welcome-mobile-dark.png',
    );
    expect((screen.getByAltText('/ mobile-nav') as HTMLImageElement).getAttribute('src')).toBe(
      '/handbook-images/state-root-mobile-nav-mobile-dark.png',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Desktop' }));
    expect(screen.getByAltText('/welcome default')).toBeTruthy();
    expect(screen.queryByAltText('/ mobile-nav')).toBeNull();
    expect((screen.getByAltText('/welcome default') as HTMLImageElement).getAttribute('src')).toBe(
      '/handbook-images/screen-welcome-desktop-dark.png',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Light' }));
    expect((screen.getByAltText('/welcome default') as HTMLImageElement).getAttribute('src')).toBe(
      '/handbook-images/screen-welcome-desktop-light.png',
    );
    expect(screen.queryByAltText('/ mobile-nav')).toBeNull();
  });

  it('initializes Desktop/Light from the catalog union and omits mobile-only rows while Desktop is selected', () => {
    renderWithLocale(<HandbookImageViewer topics={[MOBILE_ONLY, ALL]} />);
    expect(screen.getByAltText('/welcome default')).toBeTruthy();
    expect(screen.queryByAltText('/ mobile-nav')).toBeNull();
    expect((screen.getByAltText('/welcome default') as HTMLImageElement).getAttribute('src')).toBe(
      '/handbook-images/screen-welcome-desktop-light.png',
    );
    expect(screen.getByRole('button', { name: 'Desktop' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mobile' })).toBeTruthy();
  });

  it('hides Dark and Mobile when only desktop-light exists', () => {
    renderWithLocale(<HandbookImageViewer topics={[LIGHT_ONLY]} />);
    expect(screen.queryByRole('button', { name: 'Dark' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mobile' })).toBeNull();
    expect((screen.getByAltText('/welcome pay-qr') as HTMLImageElement).getAttribute('src')).toBe(
      '/handbook-images/state-welcome-pay-qr-desktop-light.png',
    );
  });

  it('hides Light/Dark and Desktop/Mobile when only desktop-dark exists', () => {
    renderWithLocale(<HandbookImageViewer topics={[DARK_ONLY]} />);
    expect(screen.queryByRole('button', { name: 'Desktop' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mobile' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Light' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Dark' })).toBeNull();
    expect(
      (screen.getByAltText('/welcome pay-qr-dark') as HTMLImageElement).getAttribute('src'),
    ).toBe('/handbook-images/state-welcome-pay-qr-desktop-dark.png');
  });

  it('hides Desktop when only mobile combos exist', () => {
    renderWithLocale(<HandbookImageViewer topics={[MOBILE_ONLY]} />);
    expect(screen.queryByRole('button', { name: 'Desktop' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Dark' })).toBeTruthy();
    expect((screen.getByAltText('/ mobile-nav') as HTMLImageElement).getAttribute('src')).toBe(
      '/handbook-images/state-root-mobile-nav-mobile-light.png',
    );
  });

  it('shows Desktop and Mobile but hides Dark when only light combos exist for both viewports', () => {
    renderWithLocale(<HandbookImageViewer topics={[BOTH_VIEWPORTS_LIGHT_ONLY]} />);
    expect(screen.getByRole('button', { name: 'Desktop' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mobile' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Dark' })).toBeNull();

    const img = screen.getByAltText('/welcome light-viewports') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('/handbook-images/screen-welcome-desktop-light.png');

    fireEvent.click(screen.getByRole('button', { name: 'Mobile' }));
    expect(img.getAttribute('src')).toBe('/handbook-images/screen-welcome-mobile-light.png');
  });

  it('steps through visible slides with Left and Right arrows', () => {
    renderWithLocale(<HandbookImageViewer topics={[ALL, LIGHT_ONLY]} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(screen.getByRole('dialog', { name: '/welcome default' })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(screen.getByRole('dialog', { name: '/welcome pay-qr' })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(screen.getByRole('dialog', { name: '/welcome default' })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'ArrowLeft' });
    expect(screen.getByRole('dialog', { name: '/welcome pay-qr' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close image' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.keyDown(document, { key: 'ArrowLeft' });
    expect(screen.getByRole('dialog', { name: '/welcome pay-qr' })).toBeTruthy();
  });

  it('opens the shared lightbox from a card preview and steps with chevrons', () => {
    renderWithLocale(<HandbookImageViewer topics={[ALL, LIGHT_ONLY]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open /welcome default at full size' }));
    expect(screen.getByRole('dialog', { name: '/welcome default' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next screen' }));
    expect(screen.getByRole('dialog', { name: '/welcome pay-qr' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Previous screen' }));
    expect(screen.getByRole('dialog', { name: '/welcome default' })).toBeTruthy();
  });

  it('ignores arrows while typing in a field', () => {
    renderWithLocale(<HandbookImageViewer topics={[ALL, LIGHT_ONLY]} />);
    const field = document.createElement('input');
    document.body.appendChild(field);
    fireEvent.keyDown(field, { key: 'ArrowRight' });
    expect(screen.queryByRole('dialog')).toBeNull();
    field.remove();
    fireEvent.keyDown(document, { key: 'ArrowRight', ctrlKey: true });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('skips topics with empty combos while gridding the rest', () => {
    const EMPTY: HandbookTopic = {
      id: 'empty',
      label: 'Empty',
      description: 'Empty topic.',
      visual: 'function-Empty',
      combos: [],
    };
    renderWithLocale(<HandbookImageViewer topics={[EMPTY, ALL]} />);
    expect(screen.queryByAltText('Empty')).toBeNull();
    expect(screen.getByAltText('/welcome default')).toBeTruthy();
  });
});
