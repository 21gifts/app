import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { useState, type ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { ShopAddWizard, type ShopAddWizardProps } from '@/components/ShopAddWizard';
import { ChromeBackProvider } from '@/components/ViewHistoryRoot';
import type { ForumPlacePin } from '@/lib/api-types';
import type { ForumPhotoPayload } from '@/lib/forum-photo';
import type { ShopApiProblem } from '@/lib/forum-shop';
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
  delete (window as { google?: unknown }).google;
  delete (window as { gm_authFailure?: unknown }).gm_authFailure;
  useAuthStore.setState({ session: null, account: null });
});

function jsonResponse(body: unknown): Response {
  return { json: () => Promise.resolve(body) } as Response;
}

function stubMaps(): Map<string, (event?: unknown) => void> {
  const listeners = new Map<string, (event?: unknown) => void>();
  const map = {
    setCenter: vi.fn(),
    addListener: (event: string, handler: (event?: unknown) => void) => {
      listeners.set(event, handler);
    },
  };
  (window as { google?: unknown }).google = {
    maps: {
      Map: vi.fn(() => map),
      Marker: vi.fn(() => ({
        setPosition: () => undefined,
        getPosition: () => ({ lat: () => 47.3769, lng: () => 8.5417 }),
        addListener: () => undefined,
      })),
      event: { trigger: vi.fn() },
    },
  };
  vi.stubGlobal('navigator', { geolocation: undefined });
  return listeners;
}

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

  it('focuses the shop text after an edit save is rejected for its text', async () => {
    function RejectedEdit(): ReactElement {
      const [serverProblem, setServerProblem] = useState<ShopApiProblem | null>(null);
      return (
        <ShopAddWizard
          {...props({
            mode: 'edit',
            submitLabel: 'Save changes',
            draft: SHOP_DESCRIPTION,
            place: COMPLETE_PLACE,
            serverProblem,
            onSubmit: () => setServerProblem('shopDescription'),
          })}
        />
      );
    }

    renderWizard(<RejectedEdit />);
    for (let step = 1; step < 5; step += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    }
    const submit = screen.getByRole('button', { name: 'Save changes' });
    submit.focus();
    fireEvent.click(submit);
    const text = await screen.findByRole('textbox', { name: 'Shop text' });
    await waitFor(() => {
      expect(document.activeElement).toBe(text);
    });
  });

  it('focuses the username after a post is rejected for its account', async () => {
    function RejectedPost(): ReactElement {
      const [serverProblem, setServerProblem] = useState<ShopApiProblem | null>(null);
      return (
        <ShopAddWizard
          {...props({
            draft: SHOP_DESCRIPTION,
            place: COMPLETE_PLACE,
            username: 'luna',
            serverProblem,
            onSubmit: () => setServerProblem('usernameMissing'),
          })}
        />
      );
    }

    renderWizard(<RejectedPost />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a shop' }));
    for (let step = 1; step < 5; step += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    }
    const submit = screen.getByRole('button', { name: 'Post' });
    submit.focus();
    fireEvent.click(submit);
    const username = await screen.findByLabelText('21.gifts username');
    await waitFor(() => {
      expect(document.activeElement).toBe(username);
    });
  });

  it('focuses the photo button after the API rejects submitted media', async () => {
    function RejectedMedia(): ReactElement {
      const [photoError, setPhotoError] = useState<'tooLarge' | null>(null);
      return (
        <ShopAddWizard
          {...props({
            draft: SHOP_DESCRIPTION,
            place: COMPLETE_PLACE,
            photoError,
            onSubmit: () => setPhotoError('tooLarge'),
          })}
        />
      );
    }

    renderWizard(<RejectedMedia />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a shop' }));
    for (let step = 1; step < 5; step += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    }
    const submit = screen.getByRole('button', { name: 'Post' });
    submit.focus();
    fireEvent.click(submit);
    const addPhoto = await screen.findByRole('button', { name: 'Add a photo or video' });
    await waitFor(() => {
      expect(document.activeElement).toBe(addPhoto);
    });
  });

  it('checks the shop name against a valid shop text while typing in the place dialog', async () => {
    stubMaps();
    renderWizard(
      <ShopAddWizard
        {...props({ mode: 'edit', draft: SHOP_DESCRIPTION, place: COMPLETE_PLACE })}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    fireEvent.change(await screen.findByLabelText('Shop name'), {
      target: { value: "Kiki's Bakery and Coffee House Zurich" },
    });
    expect(
      screen.getByText(
        'The shop name must be shorter than the shop text. Shorten the name or edit the shop text first.',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Use this place' })).toHaveProperty('disabled', true);
  });

  it('keeps Next off on the photos step while a rejected photo is still attached', () => {
    const view = renderWizard(
      <ShopAddWizard {...props({ mode: 'edit', photoError: 'formatOrSize' })} />,
    );
    expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('alert').textContent).toContain(
      'Remove or replace the rejected file to continue.',
    );
    view.unmount();
    renderWizard(<ShopAddWizard {...props({ mode: 'edit', photoError: 'tooMany' })} />);
    expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', false);
  });

  it('shows no summary problem while a send clears the draft', () => {
    function PayingHost(): ReactElement {
      const [paying, setPaying] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setPaying(true)}>
            Open fee sheet
          </button>
          <ShopAddWizard
            {...props({
              draft: paying ? '' : SHOP_DESCRIPTION,
              place: COMPLETE_PLACE,
              posting: paying,
            })}
          />
        </>
      );
    }

    renderWizard(<PayingHost />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a shop' }));
    for (let step = 1; step < 5; step += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    }
    expect(screen.getByText('5 / 5 · Summary')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Open fee sheet' }));
    expect(screen.queryByText(/more characters/)).toBeNull();
  });

  it('does not move focus to a field after a normal step change', () => {
    function SameStepProblem(): ReactElement {
      const [serverProblem, setServerProblem] = useState<ShopApiProblem | null>(null);
      return (
        <>
          <button type="button" onClick={() => setServerProblem('shopDescription')}>
            Report text problem
          </button>
          <ShopAddWizard
            {...props({ draft: SHOP_DESCRIPTION, place: COMPLETE_PLACE, serverProblem })}
          />
        </>
      );
    }

    renderWizard(<SameStepProblem />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a shop' }));
    const photoNext = screen.getByRole('button', { name: 'Next' });
    photoNext.focus();
    fireEvent.click(photoNext);
    const placeNext = screen.getByRole('button', { name: 'Next' });
    placeNext.focus();
    fireEvent.click(placeNext);
    expect(screen.getByText('3 / 5 · Text')).toBeTruthy();
    expect(document.activeElement).not.toBe(screen.getByRole('textbox', { name: 'Shop text' }));
    const back = screen.getByRole('button', { name: 'Back' });
    back.focus();
    fireEvent.click(back);
    expect(screen.getByText('2 / 5 · Place')).toBeTruthy();
    expect(document.activeElement).not.toBe(screen.getByRole('button', { name: 'Add a place' }));
    const next = screen.getByRole('button', { name: 'Next' });
    next.focus();
    fireEvent.click(next);
    expect(screen.getByText('3 / 5 · Text')).toBeTruthy();
    expect(document.activeElement).not.toBe(screen.getByRole('textbox', { name: 'Shop text' }));
    const report = screen.getByRole('button', { name: 'Report text problem' });
    report.focus();
    fireEvent.click(report);
    expect(document.activeElement).toBe(report);
  });

  it('uses unique feedback and account ids when two editors are open', () => {
    const editor = props({
      mode: 'edit',
      draft: SHOP_DESCRIPTION,
      place: COMPLETE_PLACE,
      onCancel: () => undefined,
    });
    renderWizard(
      <>
        <ShopAddWizard {...editor} />
        <ShopAddWizard {...editor} />
      </>,
    );
    for (let step = 0; step < 2; step += 1) {
      fireEvent.click(screen.getAllByRole('button', { name: 'Next' })[0]!);
      fireEvent.click(screen.getAllByRole('button', { name: 'Next' }).at(-1)!);
    }
    const descriptions = screen.getAllByRole('textbox', { name: 'Shop text' });
    const feedbackIds = descriptions.map((field) => field.getAttribute('aria-describedby'));
    expect(feedbackIds[0]).toBeTruthy();
    expect(feedbackIds[0]).not.toBe(feedbackIds[1]);

    fireEvent.click(screen.getAllByRole('button', { name: 'Next' })[0]!);
    fireEvent.click(screen.getAllByRole('button', { name: 'Next' }).at(-1)!);
    const usernames = screen.getAllByLabelText('21.gifts username');
    expect(usernames[0]!.id).toBeTruthy();
    expect(usernames[0]!.id).not.toBe(usernames[1]!.id);
    expect(usernames[0]!.getAttribute('aria-describedby')).toBe(`${usernames[0]!.id}-hint`);
    expect(usernames[1]!.getAttribute('aria-describedby')).toBe(`${usernames[1]!.id}-hint`);
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
    expect(
      screen.getByText('The map is unavailable, so a shop place cannot be added.'),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', true);
  });

  it('keeps the map-unavailable reason after Back and Next', async () => {
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
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(
      screen.getByText('The map is unavailable, so a shop place cannot be added.'),
    ).toBeTruthy();
    expect(screen.queryByText("Add the shop's place and address.")).toBeNull();
  });

  it('replaces the unavailable reason after a later map load', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ key: null }));
    vi.stubGlobal('fetch', fetchMock);
    renderWizard(<ShopAddWizard {...props()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a shop' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    expect(
      await screen.findByText('The map is unavailable, so a shop place cannot be added.'),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    fetchMock.mockResolvedValue(jsonResponse({ key: 'browser-key' }));
    const listeners = stubMaps();
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    await waitFor(() => {
      expect(listeners.has('click')).toBe(true);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(
      screen.queryByText('The map is unavailable, so a shop place cannot be added.'),
    ).toBeNull();
    expect(screen.getByText("Add the shop's place and address.")).toBeTruthy();
  });

  it('shows the map-unavailable reason when the place disappears on the summary', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ json: () => Promise.resolve({ key: null }) } as Response),
    );
    function SummaryHost(): ReactElement {
      const [place, setPlace] = useState<ForumPlacePin | null>(COMPLETE_PLACE);
      return (
        <>
          <button type="button" onClick={() => setPlace(null)}>
            Drop summary place
          </button>
          <ShopAddWizard
            {...props({
              place,
              onPlaceChange: setPlace,
              draft: SHOP_DESCRIPTION,
            })}
          />
        </>
      );
    }
    renderWizard(<SummaryHost />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a shop' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    expect(await screen.findAllByText('The map is not available.')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('5 / 5 · Summary')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Drop summary place' }));
    expect(
      screen.getByText('The map is unavailable, so a shop place cannot be added.'),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Post' })).toHaveProperty('disabled', true);
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
    expect(screen.getByText('The shop text must be longer than the shop name.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', true);
    fireEvent.change(screen.getByLabelText('Shop text'), {
      target: { value: 'Fresh bread every morning here.' },
    });
    expect(screen.queryByText('The shop text must be longer than the shop name.')).toBeNull();
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

  it('shows a pending username check when the account changes on the summary', async () => {
    useAuthStore.setState({ session: 'sess', account: null });
    searchPeople.mockImplementation(() => new Promise<never>(() => undefined));
    function SummaryHost(): ReactElement {
      const [username, setUsername] = useState('');
      return (
        <>
          <button type="button" onClick={() => setUsername('luna')}>
            Set summary username
          </button>
          <ShopAddWizard
            {...props({
              place: COMPLETE_PLACE,
              draft: SHOP_DESCRIPTION,
              username,
              onUsernameChange: setUsername,
            })}
          />
        </>
      );
    }
    renderWizard(<SummaryHost />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a shop' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Set summary username' }));
    expect(await screen.findByText('Checking that account…')).toBeTruthy();
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
      'formatOrSize' as const,
      'Use a JPEG, PNG, or WebP photo under 1 MB, or an MP4, WebM, or MOV video under 32 MB. Remove or replace the rejected file to continue.',
    ],
    ['unsupported' as const, 'Use a JPEG, PNG, or WebP photo, or an MP4, WebM, or MOV video'],
  ])('shows %s photo feedback and its 10-photo count at the picker', (photoError, message) => {
    renderWizard(<ShopAddWizard {...props({ photoDrafts: [photo], photoError })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a shop' }));
    const picker = screen.getByRole('button', { name: 'Add a photo or video' });
    expect(screen.getByText('1 / 10')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe(message);
    expect(picker.getAttribute('aria-describedby')).toBeTruthy();
    expect(picker.getAttribute('aria-invalid')).toBeNull();
    const input = document.querySelector('input[type="file"]');
    expect(input?.getAttribute('aria-invalid')).toBe('true');
    expect(input?.getAttribute('aria-describedby')).toBe(picker.getAttribute('aria-describedby'));
  });

  it('shows the photo-only format-or-size feedback in an image-only editor', () => {
    renderWizard(<ShopAddWizard {...props({ imagesOnly: true, photoError: 'formatOrSize' })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a shop' }));
    expect(screen.getByRole('alert').textContent).toBe(
      'Use a JPEG, PNG, or WebP photo under 1 MB. Remove or replace the rejected file to continue.',
    );
  });

  it('returns a create wizard to photos when the submitted post reports a media error', () => {
    function MediaErrorHost(): ReactElement {
      const [photoError, setPhotoError] = useState<'tooLarge' | null>(null);
      return (
        <>
          <button type="button" onClick={() => setPhotoError('tooLarge')}>
            Reject submitted media
          </button>
          <ShopAddWizard
            {...props({
              draft: SHOP_DESCRIPTION,
              place: COMPLETE_PLACE,
              photoError,
            })}
          />
        </>
      );
    }

    renderWizard(<MediaErrorHost />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a shop' }));
    for (let step = 1; step < 5; step += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    }
    expect(screen.getByText('5 / 5 · Summary')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Reject submitted media' }));

    expect(screen.getByText('1 / 5 · Photos')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe(
      'Keep photos under 1 MB and videos under 32 MB',
    );
  });

  it('counts the description without an existing shop tag at the 1000-character limit', () => {
    const { rerender } = renderWizard(
      <ShopAddWizard
        {...props({ draft: `${'x'.repeat(1000)}\n\n#21GiftsShop`, place: COMPLETE_PLACE })}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add a shop' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByLabelText('Shop text').getAttribute('maxlength')).toBe('8000');
    expect(screen.getByText('1000 / 1000')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', false);

    rerender(
      <ChromeBackProvider>
        <ProfileChromeLeft />
        <ShopAddWizard
          {...props({ draft: `${'x'.repeat(1001)}\n\n#21GiftsShop`, place: COMPLETE_PLACE })}
        />
      </ChromeBackProvider>,
    );
    expect(
      screen.getByText('The shop text is too long. Shorten it to at most 1000 characters.'),
    ).toBeTruthy();
    expect(screen.getByText('1001 / 1000')).toBeTruthy();
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
    expect(description.getAttribute('maxlength')).toBe('8000');
    expect(description.getAttribute('aria-invalid')).toBe('true');
    expect(
      screen.getByText('The shop text must not contain control characters other than line breaks.'),
    ).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('27 / 1000')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', true);
    fireEvent.change(description, { target: { value: SHOP_DESCRIPTION } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    const account = screen.getByLabelText('21.gifts username');
    expect(account.getAttribute('aria-invalid')).toBe('true');
    expect(
      screen.getByText(
        'Use 1–32 characters: a-z, 0-9, hyphen, underscore, or dot, starting with a letter or digit.',
      ),
    ).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
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
      expect(
        screen.getByText(
          'No account with that username. Check the spelling of the 21.gifts username.',
        ),
      ).toBeTruthy();
    });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', true);
    expect(searchPeople).toHaveBeenCalledWith('sess', 'missing');
    fireEvent.change(screen.getByLabelText('21.gifts username'), { target: { value: 'ada' } });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', false);
    });
    expect(searchPeople).toHaveBeenCalledWith('sess', 'ada');
  });

  it('trims again after a leading at-sign before checking the username', async () => {
    useAuthStore.setState({ session: 'sess', account: null });
    searchPeople.mockResolvedValue([{ id: 'acc-ada', username: 'ada', name: 'Ada' }]);
    renderWizard(
      <ShopAddWizard
        {...props({ draft: SHOP_DESCRIPTION, place: COMPLETE_PLACE, username: '@ ada' })}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add a shop' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', false);
    });
    expect(searchPeople).toHaveBeenCalledWith('sess', 'ada');
  });

  it('allows Next when a full suggestion page has no exact username', async () => {
    useAuthStore.setState({ session: 'sess', account: null });
    searchPeople.mockResolvedValue(
      Array.from({ length: 20 }, (_, index) => ({
        id: `acc-${String(index)}`,
        username: `other-${String(index)}`,
        name: `Other ${String(index)}`,
      })),
    );
    renderWizard(
      <ShopAddWizard
        {...props({ draft: SHOP_DESCRIPTION, place: COMPLETE_PLACE, username: 'luna' })}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add a shop' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', false);
    });
    expect(
      screen.queryByText(
        'No account with that username. Check the spelling of the 21.gifts username.',
      ),
    ).toBeNull();
  });

  it('allows Next without a message when the username lookup fails', async () => {
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
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', false);
    });
    expect(screen.queryByText('The account could not be checked. Please try again.')).toBeNull();
  });

  it.each([
    ['shopName' as const, '2 / 5 · Place', 'Enter the shop name.'],
    [
      'shopNameControls' as const,
      '2 / 5 · Place',
      'The shop name must not contain control characters.',
    ],
    [
      'shopDescription' as const,
      '3 / 5 · Text',
      'The shop text must be 20 to 1000 characters and longer than the shop name.',
    ],
    [
      'shopDescriptionControls' as const,
      '3 / 5 · Text',
      'The shop text must not contain control characters other than line breaks.',
    ],
    [
      'usernameInvalid' as const,
      '4 / 5 · 21.gifts user',
      'Use 1–32 characters: a-z, 0-9, hyphen, underscore, or dot, starting with a letter or digit.',
    ],
    [
      'usernameMissing' as const,
      '4 / 5 · 21.gifts user',
      'No account with that username. Check the spelling of the 21.gifts username.',
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
    if (serverProblem === 'shopName' || serverProblem === 'shopNameControls') {
      // The place dialog reopens and announces it at the name field; the wizard
      // line behind the dialog repeats it as plain text for after the dialog closes.
      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByRole('alert').textContent).toBe(message);
      expect(screen.getAllByText(message)).toHaveLength(2);
    } else {
      expect(screen.getByText(message)).toBeTruthy();
      const alert = screen.getByRole('alert');
      expect(alert.textContent).toBe(message);
      if (serverProblem === 'usernameInvalid' || serverProblem === 'usernameMissing') {
        const username = screen.getByLabelText('21.gifts username');
        expect(alert.tagName).toBe('SPAN');
        expect(alert.id).toBe(`${username.id}-error`);
        expect(username.getAttribute('aria-describedby')).toContain(alert.id);
      }
    }
    expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', true);
  });

  it('auto-opens each server place problem only once', async () => {
    function ServerProblemHost(): ReactElement {
      const [serverProblem, setServerProblem] = useState<ShopApiProblem | null>('shopName');
      return (
        <>
          <button type="button" onClick={() => setServerProblem('shopNameAddress')}>
            Report another place problem
          </button>
          <button type="button" onClick={() => setServerProblem(null)}>
            Clear the place problem
          </button>
          <ShopAddWizard
            {...props({
              draft: SHOP_DESCRIPTION,
              place: COMPLETE_PLACE,
              serverProblem,
            })}
          />
        </>
      );
    }

    renderWizard(<ServerProblemHost />);
    const firstDialog = await screen.findByRole('dialog');
    expect(within(firstDialog).getByRole('alert').textContent).toBe('Enter the shop name.');
    fireEvent.click(within(firstDialog).getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText('1 / 5 · Photos')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('2 / 5 · Place')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('Enter the shop name.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Report another place problem' }));
    const nextDialog = await screen.findByRole('dialog');
    expect(within(nextDialog).getByRole('alert').textContent).toBe(
      'The shop name must not contain the street or the postal code.',
    );

    // The same problem after a cleared one is a new rejection and opens again.
    fireEvent.click(within(nextDialog).getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear the place problem' }));
    fireEvent.click(screen.getByRole('button', { name: 'Report another place problem' }));
    expect(await screen.findByRole('dialog')).toBeTruthy();
  });
});
