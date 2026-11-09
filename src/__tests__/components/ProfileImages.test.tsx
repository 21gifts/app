import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ProfileImages } from '@/components/ProfileImages';
import { renderWithLocale } from '@/__tests__/render-with-locale';

afterEach(() => {
  cleanup();
});

describe('ProfileImages', () => {
  it('offers add buttons when neither stored picture loads', async () => {
    renderWithLocale(
      <ProfileImages
        imageEpoch={0}
        loadPicture={() => Promise.reject(new Error('none'))}
        loadBanner={() => Promise.reject(new Error('none'))}
        onSavePicture={() => Promise.resolve()}
        onSaveBanner={() => Promise.resolve()}
      />,
    );
    expect(await screen.findByRole('button', { name: 'Add a profile photo' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add a wide image' })).toBeTruthy();
  });
});
