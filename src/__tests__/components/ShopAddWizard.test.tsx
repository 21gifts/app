import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
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
  vi.unstubAllGlobals();
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

const COMPLETE_PLACE: ForumPlacePin = {
  lat: 47.3769,
  lng: 8.5417,
  label: "Kiki's Bakery",
  address: {
    street: 'Bahnhofstrasse',
    houseNumber: '12',
    postalCode: '8001',
    city: 'Zürich',
    country: 'CH',
  },
};

const SHOP_DESCRIPTION = 'Fresh bread every morning.';

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
    function Walk(): ReactElement {
      const [draft, setDraft] = useState('');
      return (
        <ShopAddWizard
          {...props({
            onPickFiles,
            onRemovePhoto,
            onClearPhoto,
            onDraftChange: (text) => {
              onDraftChange(text);
              setDraft(text);
            },
            onUsernameChange,
            onSubmit,
            onCancel,
            photoDrafts: [photo],
            videoDraft: video,
            draft,
            username: '@luna',
            place: COMPLETE_PLACE,
          })}
        />
      );
    }
    renderWizard(<Walk />);
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
    expect(screen.queryByText("Kiki's Bakery")).toBeNull();
    expect(screen.queryByRole('button', { name: 'Remove place' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', false);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Describe the shop in at least 20 more characters.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', true);
    fireEvent.change(screen.getByLabelText('Shop text'), { target: { value: SHOP_DESCRIPTION } });
    expect(onDraftChange).toHaveBeenCalledWith(SHOP_DESCRIPTION);
    expect(screen.queryByText('Describe the shop in at least 20 more characters.')).toBeNull();
    expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', false);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByLabelText('21.gifts username'), { target: { value: 'luna' } });
    expect(onUsernameChange).toHaveBeenCalledWith('luna');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('5 / 5 · Summary')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText("Kiki's Bakery")).toBeTruthy();
    expect(screen.getByText('Bahnhofstrasse 12, 8001 Zürich, Switzerland')).toBeTruthy();
    expect(screen.getByText(SHOP_DESCRIPTION)).toBeTruthy();
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

  it('keeps Next disabled until the place and description are complete', () => {
    renderWithLocale(
      <ShopAddWizard
        {...props({
          place: { lat: 1, lng: 2, label: '   ' },
        })}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add a shop' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('2 / 5 · Place')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', true);
    cleanup();
    renderWithLocale(
      <ShopAddWizard
        {...props({
          place: COMPLETE_PLACE,
          draft: 'Cafe',
        })}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add a shop' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('3 / 5 · Text')).toBeTruthy();
    expect(screen.getByText('Describe the shop in at least 16 more characters.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', true);
    cleanup();
    renderWithLocale(
      <ShopAddWizard
        {...props({
          place: COMPLETE_PLACE,
          draft: SHOP_DESCRIPTION,
          photoDrafts: [photo],
        })}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add a shop' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText("Kiki's Bakery")).toBeTruthy();
    expect(screen.getByText('Bahnhofstrasse 12, 8001 Zürich, Switzerland')).toBeTruthy();
    expect(screen.getByText(SHOP_DESCRIPTION)).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Post' })).toHaveProperty('disabled', false);
  });

  it('shows the map-unavailable reason on the closed place step', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ json: () => Promise.resolve({ key: null }) } as Response),
    );
    renderWizard(<ShopAddWizard {...props()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a shop' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    expect(
      await screen.findByText('The map is unavailable, so a shop place cannot be added.'),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.getByText('The map is unavailable, so a shop place cannot be added.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', true);
  });

  it('keeps Next disabled when the description is not longer than the shop name', () => {
    const longNamePlace: ForumPlacePin = {
      ...COMPLETE_PLACE,
      label: "Kiki's Bakery Extra Long Name",
    };
    function DraftHost(): ReactElement {
      const [draft, setDraft] = useState(SHOP_DESCRIPTION);
      return <ShopAddWizard {...props({ draft, onDraftChange: setDraft, place: longNamePlace })} />;
    }
    renderWizard(<DraftHost />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a shop' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('The description must be longer than the shop name.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', true);
    fireEvent.change(screen.getByLabelText('Shop text'), {
      target: { value: 'Fresh bread every morning here.' },
    });
    expect(screen.queryByText('The description must be longer than the shop name.')).toBeNull();
    expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', false);
  });

  it('shows coordinates on the summary when the pin has no name or address', () => {
    function SummaryHost(): ReactElement {
      const [place, setPlace] = useState<ForumPlacePin | null>(COMPLETE_PLACE);
      return (
        <>
          <button
            type="button"
            onClick={() => setPlace({ lat: 47.3769, lng: 8.5417, label: null })}
          >
            Drop pin name
          </button>
          <ShopAddWizard {...props({ place, onPlaceChange: setPlace, draft: SHOP_DESCRIPTION })} />
        </>
      );
    }
    renderWizard(<SummaryHost />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a shop' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText("Kiki's Bakery")).toBeTruthy();
    expect(screen.getByText('Bahnhofstrasse 12, 8001 Zürich, Switzerland')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Drop pin name' }));
    expect(screen.getByText('47.3769, 8.5417')).toBeTruthy();
    expect(screen.queryByText("Kiki's Bakery")).toBeNull();
    expect(screen.queryByText('Bahnhofstrasse 12, 8001 Zürich, Switzerland')).toBeNull();
    expect(screen.getByText("Add the shop's place and address.")).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Post' })).toHaveProperty('disabled', true);
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
          place: COMPLETE_PLACE,
          draft: SHOP_DESCRIPTION,
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
          place: COMPLETE_PLACE,
          draft: SHOP_DESCRIPTION,
        })}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Remove photo' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('2 / 5 · Place')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('button', { name: 'Post' })).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
    rerender(
      <ShopAddWizard
        {...props({
          mode: 'edit',
          resetToken: 1,
          keptMedia: [{ url: 'blob:still', kind: 'photo' }],
          place: COMPLETE_PLACE,
          draft: SHOP_DESCRIPTION,
        })}
      />,
    );
    expect(screen.getByText('1 / 5 · Photos')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Post' })).toBeNull();
  });

  it('lists people when the shop text starts with @', async () => {
    searchPeople.mockResolvedValue([{ id: 'acc-ada', username: 'ada', name: 'Ada Lovelace' }]);
    useAuthStore.setState({ session: 'sess', account: null });
    function DraftHost(): ReactElement {
      const [draft, setDraft] = useState('');
      return (
        <ShopAddWizard {...props({ draft, onDraftChange: setDraft, place: COMPLETE_PLACE })} />
      );
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

  it.each([
    ['tooMany' as const, 'You can add up to 10 photos'],
    ['tooLarge' as const, 'Keep photos under 1 MB and videos under 32 MB'],
    [
      'unsupported' as const,
      'Use a JPEG, PNG, or WebP photo, or an MP4, WebM, or MOV video',
    ],
  ])('shows %s photo feedback and its 10-photo count at the picker', (photoError, message) => {
    renderWizard(
      <ShopAddWizard
        {...props({ photoDrafts: [photo], photoError })}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add a shop' }));
    const picker = screen.getByRole('button', { name: 'Add a photo or video' });
    expect(screen.getByText('1 / 10')).toBeTruthy();
    expect(screen.getByText(message)).toBeTruthy();
    expect(picker.getAttribute('aria-describedby')).toBeTruthy();
    expect(picker.getAttribute('aria-invalid')).toBe('true');
  });

  it('shows the 1000-character description error for a prefilled edit', () => {
    renderWizard(
      <ShopAddWizard {...props({ draft: 'x'.repeat(1001), place: COMPLETE_PLACE })} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add a shop' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('The description is too long (max. 1000 characters).')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', true);
  });

  it('shows description controls and username format errors before Next', () => {
    function ValidationHost(): ReactElement {
      const [draft, setDraft] = useState('Fresh bread\u0001 every morning.');
      const [username, setUsername] = useState('_');
      return (
        <ShopAddWizard
          {...props({
            draft,
            onDraftChange: setDraft,
            place: COMPLETE_PLACE,
            username,
            onUsernameChange: setUsername,
          })}
        />
      );
    }
    renderWizard(<ValidationHost />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a shop' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    const description = screen.getByLabelText('Shop text');
    expect(description.getAttribute('maxlength')).toBe('1000');
    expect(description.getAttribute('aria-invalid')).toBe('true');
    expect(
      screen.getByText(
        'The description must not contain control characters other than line breaks.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('27 / 1000')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', true);
    fireEvent.change(description, { target: { value: SHOP_DESCRIPTION } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    const account = screen.getByLabelText('21.gifts username');
    expect(account.getAttribute('aria-invalid')).toBe('true');
    expect(
      screen.getByText(
        'Use 1–32 lowercase letters, digits, dots, hyphens, or underscores, starting with a letter or digit.',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', true);
  });

  it('checks a valid username exists before enabling Next', async () => {
    useAuthStore.setState({ session: 'sess', account: null });
    searchPeople.mockResolvedValue([{ id: 'acc-ada', username: 'ada', name: 'Ada' }]);
    function UsernameHost(): ReactElement {
      const [username, setUsername] = useState('missing');
      return (
        <ShopAddWizard
          {...props({
            draft: SHOP_DESCRIPTION,
            place: COMPLETE_PLACE,
            username,
            onUsernameChange: setUsername,
          })}
        />
      );
    }
    renderWizard(<UsernameHost />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a shop' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Checking that account…')).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByText('No account with that username.')).toBeTruthy();
    });
    expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', true);
    expect(searchPeople).toHaveBeenCalledWith('sess', 'missing');
    fireEvent.change(screen.getByLabelText('21.gifts username'), { target: { value: 'ada' } });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', false);
    });
    expect(searchPeople).toHaveBeenCalledWith('sess', 'ada');
  });

  it('keeps Next disabled when the username lookup fails', async () => {
    useAuthStore.setState({ session: 'sess', account: null });
    searchPeople.mockRejectedValue(new Error('offline'));
    renderWizard(
      <ShopAddWizard
        {...props({ draft: SHOP_DESCRIPTION, place: COMPLETE_PLACE, username: 'ada' })}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add a shop' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(
      await screen.findByText('The account could not be checked. Please try again.'),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', true);
  });

  it.each([
    ['shopName' as const, '2 / 5 · Place', 'Enter the shop name.'],
    [
      'shopDescription' as const,
      '3 / 5 · Text',
      'The description must be 20 to 1000 characters and longer than the shop name.',
    ],
    [
      'shopDescriptionControls' as const,
      '3 / 5 · Text',
      'The description must not contain control characters other than line breaks.',
    ],
    [
      'usernameInvalid' as const,
      '4 / 5 · 21.gifts user',
      'Use 1–32 lowercase letters, digits, dots, hyphens, or underscores, starting with a letter or digit.',
    ],
    [
      'usernameMissing' as const,
      '4 / 5 · 21.gifts user',
      'No account with that username.',
    ],
  ])('returns known %s server errors to their field', async (serverProblem, step, message) => {
    renderWizard(
      <ShopAddWizard
        {...props({
          draft: SHOP_DESCRIPTION,
          place: COMPLETE_PLACE,
          username: 'luna',
          serverProblem,
        })}
      />,
    );
    expect(await screen.findByText(step)).toBeTruthy();
    expect(screen.getAllByText(message).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', true);
  });
});
