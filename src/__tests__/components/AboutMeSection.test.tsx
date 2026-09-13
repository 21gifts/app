import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AboutMeSection } from '@/components/AboutMeSection';
import { renderWithLocale } from '@/__tests__/render-with-locale';

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
    fireEvent.click(screen.getByRole('button', { name: 'Save About me' }));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('Hello');
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
});
