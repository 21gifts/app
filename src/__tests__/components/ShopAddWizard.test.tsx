import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { useState, type ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { ShopAddWizard, type ShopAddWizardProps } from '@/components/ShopAddWizard';
import { ChromeBackProvider } from '@/components/ViewHistoryRoot';
import type { ForumPlacePin } from '@/lib/api-types';
import type { ForumPhotoPayload } from '@/lib/forum-photo';
import type { ForumVideoPayload } from '@/lib/forum-video';
import { searchMentionAccounts } from '@/lib/mention-search';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/lib/mention-search', () => ({
  searchMentionAccounts: vi.fn(),
}));

const searchPeople = vi.mocked(searchMentionAccounts);

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

function renderWizard(ui: ReactElement) {
  return renderWithLocale(
    <ChromeBackProvider>
      <ProfileChromeLeft />
      {ui}
    </ChromeBackProvider>,
  );
}

afterEach(() => {
  cleanup();
  searchPeople.mockReset();
  useAuthStore.setState({ session: null, account: null });
});

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
    renderWizard(
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
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    expect(screen.queryByText('Add a photo or video')).toBeNull();
    expect(screen.queryByText('Remove video')).toBeNull();
    expect(screen.queryByText('Remove photo')).toBeNull();
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
    const summary = screen.getByText('5 / 5 · Summary').closest('form');
    expect(summary).toBeTruthy();
    expect(within(summary as HTMLElement).queryByRole('button', { name: 'Back' })).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Back' })).toHaveLength(1);
    expect(screen.queryByText('Back')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText('4 / 5 · 21.gifts user')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Next' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add a shop' })).toBeNull();
    expect(onCancel).not.toHaveBeenCalled();
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
    renderWizard(<Host initial={props({ place })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a shop' }));
    expect(screen.getByText('1 / 5 · Photos')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reset wizard' }));
    expect(screen.getByRole('button', { name: 'Add a shop' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add a shop' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mark posting' }));
    expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Back' })).toHaveProperty('disabled', true);
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
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
    expect(document.querySelector('video')?.getAttribute('src')).toBe('blob:clip');
    expect(document.querySelector('input[type="file"]')?.getAttribute('accept')).toBe(
      'image/jpeg,image/png,image/webp',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Remove photo' }));
    expect(onRemoveKept).toHaveBeenCalledWith(0);
    expect(document.querySelector('video')?.getAttribute('src')).toBe('blob:clip');
    expect(screen.queryByText('Cancel')).toBeNull();
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

  it('lists people when the shop text starts with @', async () => {
    searchPeople.mockResolvedValue([{ id: 'acc-ada', username: 'ada', name: 'Ada Lovelace' }]);
    useAuthStore.setState({ session: 'sess', account: null });
    function DraftHost(): ReactElement {
      const [draft, setDraft] = useState('');
      return <ShopAddWizard {...props({ draft, onDraftChange: setDraft })} />;
    }
    renderWizard(<DraftHost />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a shop' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    const box = screen.getByRole('textbox', { name: 'Shop text' }) as HTMLTextAreaElement;
    fireEvent.change(box, { target: { value: '@', selectionStart: 1, selectionEnd: 1 } });
    box.setSelectionRange(1, 1);
    fireEvent.select(box);
    expect(await screen.findByRole('listbox', { name: 'People' })).toBeTruthy();
    fireEvent.mouseDown(screen.getByRole('option', { name: '@ada' }));
    expect(box.value).toBe('@ada ');
    expect(screen.queryByRole('listbox', { name: 'People' })).toBeNull();
  });
});
