import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AboutMeSection } from '@/components/AboutMeSection';
import { prepareForumPhoto } from '@/lib/forum-photo';
import { MissingRequirementsError } from '@/lib/missing-requirements';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/lib/forum-photo', () => ({
  prepareForumPhoto: vi.fn(),
}));

const prepareMock = vi.mocked(prepareForumPhoto);

/** jsdom's URL may omit createObjectURL / revokeObjectURL. */
function stubUrlObjectMethods(): void {
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: () => 'blob:about-me',
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    writable: true,
    value: () => undefined,
  });
}

function jpegFile(): File {
  return new File([new Uint8Array([0xff, 0xd8, 0xff])], 'shot.jpg', { type: 'image/jpeg' });
}

const PROFILE_URL = 'https://example.test/view/abc';

const originalClipboard = navigator.clipboard;
const originalExecCommand = document.execCommand;

/** Stub `navigator.clipboard.writeText`. */
function stubClipboard(writeText: () => Promise<void>): ReturnType<typeof vi.fn> {
  const fn = vi.fn(writeText);
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    writable: true,
    value: { writeText: fn },
  });
  return fn;
}

/** Stub `document.execCommand` for the hidden-textarea fallback. */
function stubExecCommand(impl: (commandId: string) => boolean): ReturnType<typeof vi.fn> {
  const fn = vi.fn(impl);
  Object.defineProperty(document, 'execCommand', {
    configurable: true,
    writable: true,
    value: fn,
  });
  return fn;
}

beforeEach(() => {
  vi.useRealTimers();
  prepareMock.mockReset();
  stubUrlObjectMethods();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  Object.assign(navigator, { clipboard: originalClipboard });
  Object.defineProperty(document, 'execCommand', {
    configurable: true,
    writable: true,
    value: originalExecCommand,
  });
});

describe('AboutMeSection', () => {
  it('shows the empty prompt and Write button in owner mode when aboutMe is null', () => {
    renderWithLocale(<AboutMeSection mode="owner" aboutMe={null} />);
    expect(screen.getByText('About me')).toBeTruthy();
    expect(screen.getByText('Tell others who you are.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Write your About me' })).toBeTruthy();
  });

  it('shows the filled text and pencil in owner mode', () => {
    renderWithLocale(<AboutMeSection mode="owner" aboutMe="I like gifts." />);
    expect(screen.getByText('I like gifts.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit About me' })).toBeTruthy();
    expect(screen.queryByText('Edit About me')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Write your About me' })).toBeNull();
  });

  it('treats whitespace-only aboutMe as unfilled in owner mode', () => {
    renderWithLocale(<AboutMeSection mode="owner" aboutMe="   " />);
    expect(screen.getByText('Tell others who you are.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Write your About me' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Edit About me' })).toBeNull();
  });

  it('treats aboutMe equal to the display name as unfilled ignoring case', () => {
    renderWithLocale(<AboutMeSection mode="owner" aboutMe="Ada" name="ada" />);
    expect(screen.getByText('Tell others who you are.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Write your About me' })).toBeTruthy();
    expect(screen.queryByText('Ada')).toBeNull();
  });

  it('shows a real bio as filled even when a name is set', () => {
    renderWithLocale(<AboutMeSection mode="owner" aboutMe="I like gifts." name="Ada" />);
    expect(screen.getByText('I like gifts.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit About me' })).toBeTruthy();
  });

  it('calls onSave with the draft when the owner saves', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderWithLocale(<AboutMeSection mode="owner" aboutMe={null} onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: 'Write your About me' }));
    fireEvent.change(screen.getByLabelText('About me'), { target: { value: 'Hello' } });
    expect(screen.queryByText('Save About me')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Save About me' }));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('Hello');
    });
  });

  it('disables save and shows a spinner while onSave is in flight', async () => {
    let resolveSave!: (value: void) => void;
    const onSave = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        }),
    );
    renderWithLocale(<AboutMeSection mode="owner" aboutMe={null} onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: 'Write your About me' }));
    fireEvent.change(screen.getByLabelText('About me'), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save About me' }));
    const button = screen.getByRole('button', { name: 'Save About me' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.querySelector('.animate-spin')).toBeTruthy();
    expect((screen.getByLabelText('About me') as HTMLTextAreaElement).disabled).toBe(true);
    await act(async () => {
      resolveSave();
    });
    await waitFor(() => {
      expect(screen.queryByLabelText('About me')).toBeNull();
    });
  });

  it('stays in edit mode when onSave is omitted', () => {
    renderWithLocale(<AboutMeSection mode="owner" aboutMe={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Write your About me' }));
    fireEvent.change(screen.getByLabelText('About me'), { target: { value: 'Draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save About me' }));
    expect(screen.getByRole('button', { name: 'Save About me' })).toBeTruthy();
    expect(screen.getByLabelText('About me')).toBeTruthy();
  });

  it('cancels an owner edit and restores the previous text', () => {
    renderWithLocale(<AboutMeSection mode="owner" aboutMe="Kept." />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit About me' }));
    fireEvent.change(screen.getByLabelText('About me'), { target: { value: 'Changed' } });
    expect(screen.queryByText('Cancel')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('Kept.')).toBeTruthy();
    expect(screen.queryByLabelText('About me')).toBeNull();
  });

  it('cancels an owner write from empty and restores the empty prompt', () => {
    renderWithLocale(<AboutMeSection mode="owner" aboutMe={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Write your About me' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('Tell others who you are.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Write your About me' })).toBeTruthy();
  });

  it('shows the save error when onSave rejects', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('fail'));
    renderWithLocale(<AboutMeSection mode="owner" aboutMe={null} onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: 'Write your About me' }));
    fireEvent.change(screen.getByLabelText('About me'), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save About me' }));
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe('Could not save. Please try again.');
    });
    expect(screen.getByRole('button', { name: 'Save About me' })).toBeTruthy();
  });

  it('shows filled text in public mode', () => {
    renderWithLocale(<AboutMeSection mode="public" aboutMe="Public bio." />);
    expect(screen.getByText('About me')).toBeTruthy();
    expect(screen.getByText('Public bio.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Write your About me' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit About me' })).toBeNull();
  });

  it('omits the section in public mode when aboutMe is null and there is no copy URL', () => {
    const { container } = renderWithLocale(<AboutMeSection mode="public" aboutMe={null} />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByText('About me')).toBeNull();
  });

  it('shows the copy button with profile.copyLink and no visible URL string', () => {
    renderWithLocale(<AboutMeSection mode="public" aboutMe={null} profileUrl={PROFILE_URL} />);
    expect(screen.getByRole('button', { name: 'Copy link to this profile' })).toBeTruthy();
    expect(screen.queryByText('Copy link to this profile')).toBeNull();
    expect(screen.queryByText(PROFILE_URL)).toBeNull();
    expect(screen.queryByText('About me')).toBeNull();
  });

  it('copies the profile URL through the clipboard API', async () => {
    const writeText = stubClipboard(() => Promise.resolve());
    renderWithLocale(<AboutMeSection mode="owner" aboutMe={null} profileUrl={PROFILE_URL} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy link to this profile' }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(PROFILE_URL);
    });
    expect(screen.queryByText(PROFILE_URL)).toBeNull();
  });

  it('falls back to execCommand when clipboard write fails', async () => {
    stubClipboard(() => Promise.reject(new Error('denied')));
    const exec = stubExecCommand(() => true);
    renderWithLocale(<AboutMeSection mode="public" aboutMe="Hi." profileUrl={PROFILE_URL} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy link to this profile' }));
    await waitFor(() => {
      expect(exec).toHaveBeenCalledWith('copy');
    });
  });

  it('stays idle when clipboard and fallback both fail', async () => {
    stubClipboard(() => Promise.reject(new Error('denied')));
    stubExecCommand(() => false);
    renderWithLocale(<AboutMeSection mode="public" aboutMe="Hi." profileUrl={PROFILE_URL} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy link to this profile' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Copy link to this profile' })).toBeTruthy();
    });
  });

  it('treats a throwing execCommand as a failed fallback', async () => {
    stubClipboard(() => Promise.reject(new Error('denied')));
    stubExecCommand(() => {
      throw new Error('no exec');
    });
    renderWithLocale(<AboutMeSection mode="public" aboutMe="Hi." profileUrl={PROFILE_URL} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy link to this profile' }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByRole('button', { name: 'Copy link to this profile' })).toBeTruthy();
  });

  it('ignores a clipboard write that resolves after unmount', async () => {
    let resolveWrite!: () => void;
    const writeText = stubClipboard(
      () =>
        new Promise<void>((resolve) => {
          resolveWrite = resolve;
        }),
    );
    const { unmount } = renderWithLocale(
      <AboutMeSection mode="owner" aboutMe={null} profileUrl={PROFILE_URL} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Copy link to this profile' }));
    expect(writeText).toHaveBeenCalled();
    unmount();
    resolveWrite();
    await act(async () => {
      await Promise.resolve();
    });
  });

  it('ignores a clipboard reject that settles after unmount', async () => {
    let rejectWrite!: (error: Error) => void;
    stubClipboard(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectWrite = reject;
        }),
    );
    const { unmount } = renderWithLocale(
      <AboutMeSection mode="owner" aboutMe={null} profileUrl={PROFILE_URL} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Copy link to this profile' }));
    unmount();
    rejectWrite(new Error('denied'));
    await act(async () => {
      await Promise.resolve();
    });
  });

  it('resets the copied flash after the timeout', async () => {
    vi.useFakeTimers();
    stubClipboard(() => Promise.resolve());
    renderWithLocale(<AboutMeSection mode="public" aboutMe="Hi." profileUrl={PROFILE_URL} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy link to this profile' }));
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Copy link to this profile' }));
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      vi.advanceTimersByTime(1200);
    });
    expect(screen.getByRole('button', { name: 'Copy link to this profile' })).toBeTruthy();
  });

  it('treats a photo-only owner note as filled and shows the loaded image', async () => {
    const loadPhoto = vi
      .fn()
      .mockResolvedValue(new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' }));
    renderWithLocale(<AboutMeSection mode="owner" aboutMe={null} hasPhoto loadPhoto={loadPhoto} />);
    expect(screen.getByText('About me')).toBeTruthy();
    expect(screen.queryByText('Tell others who you are.')).toBeNull();
    expect(screen.getByRole('button', { name: 'Edit About me' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Write your About me' })).toBeNull();
    await waitFor(() => {
      expect(screen.getByAltText('About me photo')).toBeTruthy();
    });
  });

  it('stays filled when loadPhoto rejects and does not show an image or save error', async () => {
    const loadPhoto = vi.fn().mockRejectedValue(new Error('fail'));
    renderWithLocale(<AboutMeSection mode="owner" aboutMe={null} hasPhoto loadPhoto={loadPhoto} />);
    expect(screen.getByText('About me')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit About me' })).toBeTruthy();
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByAltText('About me photo')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('treats hasPhoto without loadPhoto as filled and does not render an image', () => {
    renderWithLocale(<AboutMeSection mode="owner" aboutMe={null} hasPhoto />);
    expect(screen.getByText('About me')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit About me' })).toBeTruthy();
    expect(screen.queryByAltText('About me photo')).toBeNull();
  });

  it('shows the edit photo strip without a preview while stored bytes are still loading', () => {
    const loadPhoto = vi.fn().mockReturnValue(new Promise<Blob>(() => undefined));
    renderWithLocale(
      <AboutMeSection mode="owner" aboutMe="Kept." hasPhoto loadPhoto={loadPhoto} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit About me' }));
    expect(screen.getByRole('button', { name: 'Remove photo' })).toBeTruthy();
    expect(screen.queryByText('Remove photo')).toBeNull();
    expect(screen.queryByAltText('Selected photo')).toBeNull();
  });

  it('shows a public photo-only About me without edit controls', async () => {
    const loadPhoto = vi
      .fn()
      .mockResolvedValue(new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' }));
    renderWithLocale(
      <AboutMeSection mode="public" aboutMe={null} hasPhoto loadPhoto={loadPhoto} />,
    );
    expect(screen.getByText('About me')).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByAltText('About me photo')).toBeTruthy();
    });
    expect(screen.queryByRole('button', { name: 'Write your About me' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit About me' })).toBeNull();
  });

  it('calls onSave with null after the owner removes an existing photo', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const loadPhoto = vi
      .fn()
      .mockResolvedValue(new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' }));
    renderWithLocale(
      <AboutMeSection
        mode="owner"
        aboutMe="Kept."
        hasPhoto
        loadPhoto={loadPhoto}
        onSave={onSave}
      />,
    );
    await waitFor(() => {
      expect(screen.getByAltText('About me photo')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Edit About me' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove photo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save About me' }));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('Kept.', null);
    });
  });

  it('calls onSave with the prepared JPEG after the owner attaches a photo', async () => {
    prepareMock.mockResolvedValue({
      ok: true,
      photo: {
        contentType: 'image/jpeg',
        data: 'abc',
        previewUrl: 'data:image/jpeg;base64,abc',
      },
    });
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderWithLocale(<AboutMeSection mode="owner" aboutMe={null} onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: 'Write your About me' }));
    expect(screen.getByRole('button', { name: 'Add a photo' })).toBeTruthy();
    expect(screen.queryByText('Add a photo')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add a photo' }));
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input.accept).toBe('image/jpeg,image/png,image/webp');
    fireEvent.change(input, { target: { files: [jpegFile()] } });
    await waitFor(() => {
      expect(screen.getByAltText('Selected photo')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save About me' }));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(expect.any(String), {
        contentType: 'image/jpeg',
        data: 'abc',
      });
    });
    await waitFor(() => {
      expect(screen.getByAltText('About me photo')).toBeTruthy();
    });
  });

  it('disables save while prepareForumPhoto is in flight and then saves the JPEG', async () => {
    let resolvePrep!: (value: Awaited<ReturnType<typeof prepareForumPhoto>>) => void;
    prepareMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePrep = resolve;
        }),
    );
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderWithLocale(<AboutMeSection mode="owner" aboutMe={null} onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: 'Write your About me' }));
    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [jpegFile()] },
    });
    const save = screen.getByRole('button', { name: 'Save About me' }) as HTMLButtonElement;
    const attach = screen.getByRole('button', { name: 'Add a photo' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    expect(attach.disabled).toBe(true);
    await act(async () => {
      resolvePrep({
        ok: true,
        photo: {
          contentType: 'image/jpeg',
          data: 'abc',
          previewUrl: 'data:image/jpeg;base64,abc',
        },
      });
    });
    await waitFor(() => {
      expect(
        (screen.getByRole('button', { name: 'Save About me' }) as HTMLButtonElement).disabled,
      ).toBe(false);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save About me' }));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(expect.any(String), {
        contentType: 'image/jpeg',
        data: 'abc',
      });
    });
  });

  it('disables remove while a replacement photo is still preparing', async () => {
    prepareMock.mockImplementation(() => new Promise(() => undefined));
    const loadPhoto = vi
      .fn()
      .mockResolvedValue(new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' }));
    renderWithLocale(
      <AboutMeSection
        mode="owner"
        aboutMe="Kept."
        hasPhoto
        loadPhoto={loadPhoto}
        onSave={vi.fn()}
      />,
    );
    await waitFor(() => {
      expect(screen.getByAltText('About me photo')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Edit About me' }));
    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [jpegFile()] },
    });
    expect(
      (screen.getByRole('button', { name: 'Remove photo' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('ignores a stale prepare after a newer pick starts', async () => {
    let resolveFirst: ((value: Awaited<ReturnType<typeof prepareForumPhoto>>) => void) | undefined;
    prepareMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    );
    prepareMock.mockResolvedValueOnce({
      ok: true,
      photo: {
        contentType: 'image/jpeg',
        data: 'second',
        previewUrl: 'data:image/jpeg;base64,second',
      },
    });
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderWithLocale(<AboutMeSection mode="owner" aboutMe={null} onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: 'Write your About me' }));
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [jpegFile()] } });
    fireEvent.change(input, { target: { files: [jpegFile()] } });
    await waitFor(() => {
      expect((screen.getByAltText('Selected photo') as HTMLImageElement).src).toContain('second');
    });
    resolveFirst?.({
      ok: true,
      photo: {
        contentType: 'image/jpeg',
        data: 'first',
        previewUrl: 'data:image/jpeg;base64,first',
      },
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect((screen.getByAltText('Selected photo') as HTMLImageElement).src).toContain('second');
    fireEvent.click(screen.getByRole('button', { name: 'Save About me' }));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(expect.any(String), {
        contentType: 'image/jpeg',
        data: 'second',
      });
    });
  });

  it('ignores a stale prepare rejection after a newer pick starts', async () => {
    let rejectFirst: ((reason: Error) => void) | undefined;
    prepareMock.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectFirst = reject;
        }),
    );
    prepareMock.mockResolvedValueOnce({
      ok: true,
      photo: {
        contentType: 'image/jpeg',
        data: 'second',
        previewUrl: 'data:image/jpeg;base64,second',
      },
    });
    renderWithLocale(<AboutMeSection mode="owner" aboutMe={null} onSave={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Write your About me' }));
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [jpegFile()] } });
    fireEvent.change(input, { target: { files: [jpegFile()] } });
    await waitFor(() => {
      expect((screen.getByAltText('Selected photo') as HTMLImageElement).src).toContain('second');
    });
    rejectFirst?.(new Error('decode'));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByRole('alert')).toBeNull();
    expect((screen.getByAltText('Selected photo') as HTMLImageElement).src).toContain('second');
  });

  it('ignores a stale prepare after unmount', async () => {
    let resolvePrep: ((value: Awaited<ReturnType<typeof prepareForumPhoto>>) => void) | undefined;
    prepareMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePrep = resolve;
        }),
    );
    const { unmount } = renderWithLocale(
      <AboutMeSection mode="owner" aboutMe={null} onSave={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Write your About me' }));
    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [jpegFile()] },
    });
    unmount();
    resolvePrep?.({
      ok: true,
      photo: {
        contentType: 'image/jpeg',
        data: 'late',
        previewUrl: 'data:image/jpeg;base64,late',
      },
    });
    await act(async () => {
      await Promise.resolve();
    });
  });

  it('ignores a stale prepare after cancel', async () => {
    let resolvePrep: ((value: Awaited<ReturnType<typeof prepareForumPhoto>>) => void) | undefined;
    prepareMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePrep = resolve;
        }),
    );
    renderWithLocale(<AboutMeSection mode="owner" aboutMe={null} onSave={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Write your About me' }));
    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [jpegFile()] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    resolvePrep?.({
      ok: true,
      photo: {
        contentType: 'image/jpeg',
        data: 'late',
        previewUrl: 'data:image/jpeg;base64,late',
      },
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByAltText('Selected photo')).toBeNull();
    expect(screen.getByText('Tell others who you are.')).toBeTruthy();
  });

  it('alerts unsupported copy when prepareForumPhoto rejects the file', async () => {
    prepareMock.mockResolvedValue({ ok: false, error: 'unsupported' });
    renderWithLocale(<AboutMeSection mode="owner" aboutMe={null} onSave={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Write your About me' }));
    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [jpegFile()] },
    });
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe('Use a JPEG, PNG, or WebP photo');
    });
  });

  it('alerts too-large copy when prepareForumPhoto reports tooLarge', async () => {
    prepareMock.mockResolvedValue({ ok: false, error: 'tooLarge' });
    renderWithLocale(<AboutMeSection mode="owner" aboutMe={null} onSave={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Write your About me' }));
    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [jpegFile()] },
    });
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe('Keep photos under 1 MB');
    });
  });

  it('alerts unsupported copy when prepareForumPhoto throws', async () => {
    prepareMock.mockRejectedValue(new Error('decode'));
    renderWithLocale(<AboutMeSection mode="owner" aboutMe={null} onSave={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Write your About me' }));
    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [jpegFile()] },
    });
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe('Use a JPEG, PNG, or WebP photo');
    });
  });

  it('ignores an empty file change', () => {
    renderWithLocale(<AboutMeSection mode="owner" aboutMe={null} onSave={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Write your About me' }));
    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [] },
    });
    expect(prepareMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('ignores a loadPhoto resolve that settles after unmount', async () => {
    let resolveLoad!: (blob: Blob) => void;
    const loadPhoto = vi.fn(
      () =>
        new Promise<Blob>((resolve) => {
          resolveLoad = resolve;
        }),
    );
    const { unmount } = renderWithLocale(
      <AboutMeSection mode="owner" aboutMe={null} hasPhoto loadPhoto={loadPhoto} />,
    );
    unmount();
    resolveLoad(new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' }));
    await act(async () => {
      await Promise.resolve();
    });
  });

  it('ignores a loadPhoto reject that settles after unmount', async () => {
    let rejectLoad!: (error: Error) => void;
    const loadPhoto = vi.fn(
      () =>
        new Promise<Blob>((_resolve, reject) => {
          rejectLoad = reject;
        }),
    );
    const { unmount } = renderWithLocale(
      <AboutMeSection mode="owner" aboutMe={null} hasPhoto loadPhoto={loadPhoto} />,
    );
    unmount();
    rejectLoad(new Error('fail'));
    await act(async () => {
      await Promise.resolve();
    });
  });

  it('ignores a loadPhoto resolve after save removes the photo', async () => {
    let resolveLoad!: (blob: Blob) => void;
    const loadPhoto = vi.fn(
      () =>
        new Promise<Blob>((resolve) => {
          resolveLoad = resolve;
        }),
    );
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderWithLocale(
      <AboutMeSection mode="owner" aboutMe={null} hasPhoto loadPhoto={loadPhoto} onSave={onSave} />,
    );
    expect(screen.getByText('About me')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Edit About me' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove photo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save About me' }));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('', null);
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Save About me' })).toBeNull();
    });
    resolveLoad(new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByAltText('About me photo')).toBeNull();
  });

  it('stays in edit mode when onSave returns false', async () => {
    const onSave = vi.fn().mockResolvedValue(false);
    renderWithLocale(<AboutMeSection mode="owner" aboutMe={null} onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: 'Write your About me' }));
    fireEvent.change(screen.getByLabelText('About me'), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save About me' }));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('Hello');
    });
    expect(screen.getByRole('button', { name: 'Save About me' })).toBeTruthy();
  });

  it('cancels an attach and restores the previous empty prompt', async () => {
    prepareMock.mockResolvedValue({
      ok: true,
      photo: {
        contentType: 'image/jpeg',
        data: 'abc',
        previewUrl: 'data:image/jpeg;base64,abc',
      },
    });
    renderWithLocale(<AboutMeSection mode="owner" aboutMe={null} onSave={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Write your About me' }));
    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [jpegFile()] },
    });
    await waitFor(() => {
      expect(screen.getByAltText('Selected photo')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('Tell others who you are.')).toBeTruthy();
    expect(screen.queryByAltText('Selected photo')).toBeNull();
  });

  it('revokes the stored object URL on unmount', async () => {
    const revoke = vi.fn();
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revoke,
    });
    const loadPhoto = vi
      .fn()
      .mockResolvedValue(new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' }));
    const { unmount } = renderWithLocale(
      <AboutMeSection mode="owner" aboutMe={null} hasPhoto loadPhoto={loadPhoto} />,
    );
    await waitFor(() => {
      expect(screen.getByAltText('About me photo')).toBeTruthy();
    });
    unmount();
    expect(revoke).toHaveBeenCalled();
  });

  it('does not show a save error when onSave throws MissingRequirementsError without rules', async () => {
    const onSave = vi.fn().mockRejectedValue(new MissingRequirementsError(['name']));
    renderWithLocale(<AboutMeSection mode="owner" aboutMe={null} onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: 'Write your About me' }));
    fireEvent.change(screen.getByLabelText('About me'), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save About me' }));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalled();
    });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('button', { name: 'Save About me' })).toBeTruthy();
  });

  it('shows the save error when onSave throws MissingRequirementsError for rules', async () => {
    const onSave = vi.fn().mockRejectedValue(new MissingRequirementsError(['rules']));
    renderWithLocale(<AboutMeSection mode="owner" aboutMe={null} onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: 'Write your About me' }));
    fireEvent.change(screen.getByLabelText('About me'), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save About me' }));
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe('Could not save. Please try again.');
    });
  });
});
