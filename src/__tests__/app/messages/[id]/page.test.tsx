import { cleanup, screen } from '@testing-library/react';
import type { Metadata } from 'next';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PublicMessagePage, { generateMetadata } from '@/app/messages/[id]/page';
import type { ForumMessage } from '@/lib/api-types';
import { loadPublicMessageForOg, publicMessageOgMetadata } from '@/lib/public-message-og';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/components/PublicMessageLoader', () => ({
  PublicMessageLoader: ({ id }: { id: string }) => (
    <div data-testid="public-message-loader">{id}</div>
  ),
}));

vi.mock('@/components/LanguageSwitcher', () => ({
  LanguageSwitcher: ({ tone }: { tone?: string }) => (
    <div data-testid="language-switcher">{tone}</div>
  ),
}));

vi.mock('@/lib/public-message-og', () => ({
  loadPublicMessageForOg: vi.fn(),
  publicMessageOgMetadata: vi.fn(),
}));

const loadOg = vi.mocked(loadPublicMessageForOg);
const ogMeta = vi.mocked(publicMessageOgMetadata);

const MESSAGE_ID = '11111111-1111-4111-8111-111111111111';

const sample: ForumMessage = {
  id: MESSAGE_ID,
  name: 'Ada',
  text: 'Hello from Ada',
  createdAt: '2026-08-28T12:00:00.000Z',
  sats: 21,
  payable: false,
  hasPhoto: false,
  photoCount: 0,
  hasVideo: false,
  videoContentType: null,
  role: 'basis',
  replyCount: 0,
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('PublicMessagePage', () => {
  it('renders the language switcher and passes id to the loader', async () => {
    renderWithLocale(await PublicMessagePage({ params: Promise.resolve({ id: MESSAGE_ID }) }));
    expect(screen.getByTestId('language-switcher').textContent).toBe('light');
    expect(screen.getByTestId('public-message-loader').textContent).toBe(MESSAGE_ID);
  });
});

describe('generateMetadata', () => {
  it('maps a found note through publicMessageOgMetadata', async () => {
    const metadata: Metadata = { title: 'Ada' };
    loadOg.mockResolvedValue(sample);
    ogMeta.mockReturnValue(metadata);

    await expect(
      generateMetadata({ params: Promise.resolve({ id: MESSAGE_ID }) }),
    ).resolves.toEqual(metadata);
    expect(loadOg).toHaveBeenCalledWith(MESSAGE_ID);
    expect(ogMeta).toHaveBeenCalledWith(MESSAGE_ID, sample);
  });

  it('maps a missing note through publicMessageOgMetadata as null', async () => {
    loadOg.mockResolvedValue(null);
    ogMeta.mockReturnValue({});

    await expect(
      generateMetadata({ params: Promise.resolve({ id: MESSAGE_ID }) }),
    ).resolves.toEqual({});
    expect(loadOg).toHaveBeenCalledWith(MESSAGE_ID);
    expect(ogMeta).toHaveBeenCalledWith(MESSAGE_ID, null);
  });
});
