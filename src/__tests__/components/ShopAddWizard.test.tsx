import { cleanup, fireEvent, screen } from '@testing-library/react';
import { useState, type ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShopAddWizard, type ShopAddWizardProps } from '@/components/ShopAddWizard';
import type { ForumPlacePin } from '@/lib/api-types';
import type { ForumPhotoPayload } from '@/lib/forum-photo';
import type { ForumVideoPayload } from '@/lib/forum-video';
import { renderWithLocale } from '@/__tests__/render-with-locale';

afterEach(cleanup);

const photo: ForumPhotoPayload = {
  contentType: 'image/jpeg',
  data: 'aaa',
  previewUrl: 'data:image/jpeg;base64,aaa',
};

const video: ForumVideoPayload = {
  file: new File(['v'], 'clip.mp4', { type: 'video/mp4' }),
  poster: new Blob(['p'], { type: 'image/jpeg' }),
  previewUrl: 'blob:video',
};

function props(overrides: Partial<ShopAddWizardProps> = {}): ShopAddWizardProps {
  return {
    posting: false,
    draft: '',
    onDraftChange: () => undefined,
    photoDrafts: [],
    videoDraft: null,
    onPickFiles: () => undefined,
    onRemovePhoto: () => undefined,
    onClearPhoto: () => undefined,
    place: null,
    onPlaceChange: () => undefined,
    username: '',
    onUsernameChange: () => undefined,
    onSubmit: () => undefined,
    onCancel: () => undefined,
    resetToken: 0,
    maxLength: 8000,
    ...overrides,
  };
}

function Host({ initial }: { initial: ShopAddWizardProps }): ReactElement {
  const [token, setToken] = useState(initial.resetToken);
  const [posting, setPosting] = useState(initial.posting);
  return (
    <>
      <button type="button" onClick={() => setToken((value) => value + 1)}>
        Reset wizard
      </button>
      <button type="button" onClick={() => setPosting(true)}>
        Mark posting
      </button>
      <ShopAddWizard {...initial} resetToken={token} posting={posting} />
    </>
  );
}

describe('ShopAddWizard', () => {
  it('walks photos, place, text, username, and summary', () => {
    const onPickFiles = vi.fn();
    const onRemovePhoto = vi.fn();
    const onClearPhoto = vi.fn();
    const onDraftChange = vi.fn();
    const onUsernameChange = vi.fn();
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    renderWithLocale(
      <ShopAddWizard
        {...props({
          onPickFiles,
          onRemovePhoto,
          onClearPhoto,
          onDraftChange,
          onUsernameChange,
          onSubmit,
          onCancel,
          photoDrafts: [photo],
          videoDraft: video,
          draft: 'Cafe',
          username: '@luna',
          place: { lat: 14.5, lng: 120.9, label: 'Stall' },
        })}
      />,
    );
    expect(screen.queryByLabelText('Shop text')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add a shop' }));
    expect(screen.getByText('1 / 5 · Photos')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add a photo or video' }));
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: null } });
    fireEvent.change(input, { target: { files: [] } });
    const file = new File(['a'], 'a.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(onPickFiles).toHaveBeenCalledTimes(1);
    expect(onPickFiles).toHaveBeenCalledWith([file]);
    fireEvent.click(screen.getByRole('button', { name: 'Remove video' }));
    expect(onClearPhoto).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Remove photo' }));
    expect(onRemovePhoto).toHaveBeenCalledWith(0);
    fireEvent.submit(screen.getByText('1 / 5 · Photos').closest('form')!);
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('2 / 5 · Place')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add a place' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByLabelText('Shop text'), { target: { value: 'Cafe Luna' } });
    expect(onDraftChange).toHaveBeenCalledWith('Cafe Luna');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByLabelText('21.gifts username'), { target: { value: 'luna' } });
    expect(onUsernameChange).toHaveBeenCalledWith('luna');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('5 / 5 · Summary')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('Stall')).toBeTruthy();
    expect(screen.getByText('Cafe')).toBeTruthy();
    expect(screen.getByText('@luna')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText('4 / 5 · 21.gifts user')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Add a shop' })).toBeTruthy();
  });

  it('summarises an empty shop and a pin without a name', () => {
    renderWithLocale(
      <ShopAddWizard
        {...props({
          place: { lat: 1, lng: 2, label: '   ' },
        })}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add a shop' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getAllByText('None').length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText('1, 2')).toBeTruthy();
    cleanup();
    renderWithLocale(
      <ShopAddWizard
        {...props({
          place: { lat: 3, lng: 4, label: null },
          photoDrafts: [photo],
        })}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add a shop' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('3, 4')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
  });

  it('closes after a successful send and disables controls while posting', () => {
    const place: ForumPlacePin = { lat: 1, lng: 2, label: null };
    renderWithLocale(<Host initial={props({ place })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a shop' }));
    expect(screen.getByText('1 / 5 · Photos')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reset wizard' }));
    expect(screen.getByRole('button', { name: 'Add a shop' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add a shop' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mark posting' }));
    expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveProperty('disabled', true);
  });

  it('edits an existing shop and keeps a video preview', () => {
    const onCancel = vi.fn();
    const onRemoveKept = vi.fn();
    const { rerender } = renderWithLocale(
      <ShopAddWizard
        {...props({
          mode: 'edit',
          submitLabel: 'Save changes',
          imagesOnly: true,
          keptMedia: [
            { url: 'blob:still', kind: 'photo' },
            { url: 'blob:clip', kind: 'video' },
          ],
          onRemoveKept,
          onCancel,
        })}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Add a shop' })).toBeNull();
    expect(screen.getByText('1 / 5 · Photos')).toBeTruthy();
    expect(document.querySelector('input[type="file"]')?.getAttribute('accept')).toBe(
      'image/jpeg,image/png,image/webp',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Remove photo' }));
    expect(onRemoveKept).toHaveBeenCalledWith(0);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(screen.getByText('1 / 5 · Photos')).toBeTruthy();
    rerender(
      <ShopAddWizard
        {...props({
          mode: 'edit',
          keptMedia: [{ url: 'blob:still', kind: 'photo' }],
        })}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Remove photo' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('button', { name: 'Post' })).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
  });
});
