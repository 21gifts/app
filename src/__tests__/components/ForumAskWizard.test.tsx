import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ForumAskWizard } from '@/components/ForumAskWizard';
import { FORUM_MESSAGE_MAX_LENGTH } from '@/lib/api-types';
import { renderWithLocale } from '@/__tests__/render-with-locale';

afterEach(cleanup);

const idle = {
  askDraft: '',
  onAskDraftChange: (): void => undefined,
  draft: '',
  onDraftChange: (): void => undefined,
  posting: false,
  photoDrafts: [] as { previewUrl: string; data: string; contentType: 'image/jpeg' }[],
  videoDraft: null,
  onPickFiles: (): void => undefined,
  onRemovePhoto: (): void => undefined,
  onClearPhoto: (): void => undefined,
  authorName: 'Ada',
  onPost: (): void => undefined,
};

describe('ForumAskWizard', () => {
  it('keeps Continue disabled until a whole-sat ask is entered', () => {
    const onStepChange = vi.fn();
    const { rerender } = renderWithLocale(
      <ForumAskWizard step={1} onStepChange={onStepChange} {...idle} />,
    );
    expect(screen.getByRole('button', { name: 'Continue' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('heading', { name: 'How much?' })).toBeTruthy();
    expect(screen.getByText('1 of 4')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onStepChange).not.toHaveBeenCalled();
    rerender(<ForumAskWizard step={1} onStepChange={onStepChange} {...idle} askDraft="21000" />);
    expect(screen.getByLabelText('Ask')).toHaveProperty('value', '21000');
    expect(screen.getByRole('group', { name: 'Bitcoin or fiat' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onStepChange).toHaveBeenCalledWith(2);
  });

  it('edits the amount and the message', () => {
    const onAskDraftChange = vi.fn();
    const onDraftChange = vi.fn();
    const { rerender } = renderWithLocale(
      <ForumAskWizard
        step={1}
        onStepChange={() => undefined}
        {...idle}
        onAskDraftChange={onAskDraftChange}
      />,
    );
    fireEvent.change(screen.getByLabelText('Ask'), { target: { value: '21' } });
    expect(onAskDraftChange).toHaveBeenCalledWith('21');
    rerender(
      <ForumAskWizard
        step={3}
        onStepChange={() => undefined}
        {...idle}
        onDraftChange={onDraftChange}
      />,
    );
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Hi' } });
    expect(onDraftChange).toHaveBeenCalledWith('Hi');
  });

  it('continues from photos to step 3 without a photo', () => {
    const onStepChange = vi.fn();
    renderWithLocale(<ForumAskWizard step={2} onStepChange={onStepChange} {...idle} />);
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onStepChange).toHaveBeenCalledWith(3);
  });

  it('previews a fiat definition on the last step', () => {
    renderWithLocale(
      <ForumAskWizard
        step={4}
        onStepChange={() => undefined}
        {...idle}
        draft="Hi"
        askDraft="1"
        askDraftUnit="fiat"
        rateDay={{
          sats: 100_000_000,
          usd: '100000.00',
          chf: '80000.00',
          eur: '90000.00',
          php: '5600000.00',
        }}
      />,
    );
    expect(screen.getByText('$1.00')).toBeTruthy();
    expect(screen.getByText("₿1'000")).toBeTruthy();
  });

  it('posts only from the preview', () => {
    const onPost = vi.fn();
    renderWithLocale(
      <ForumAskWizard
        step={4}
        onStepChange={() => undefined}
        {...idle}
        askDraft="21000"
        draft="Hello"
        onPost={onPost}
      />,
    );
    expect(screen.getByText('0%')).toBeTruthy();
    expect(screen.getByText('Post')).toBeTruthy();
    expect((screen.getByRole('button', { name: /^Post$/ }) as HTMLButtonElement).disabled).toBe(
      false,
    );
    fireEvent.click(screen.getByRole('button', { name: /^Post$/ }));
    expect(onPost).toHaveBeenCalledTimes(1);
  });

  it('goes back from step 2', () => {
    const onStepChange = vi.fn();
    renderWithLocale(<ForumAskWizard step={2} onStepChange={onStepChange} {...idle} />);
    expect(screen.queryByText('Back')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onStepChange).toHaveBeenCalledWith(1);
  });

  it('continues from photos and text', () => {
    const onStepChange = vi.fn();
    const { rerender } = renderWithLocale(
      <ForumAskWizard step={2} onStepChange={onStepChange} {...idle} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onStepChange).toHaveBeenCalledWith(3);
    rerender(<ForumAskWizard step={3} onStepChange={onStepChange} {...idle} />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onStepChange).toHaveBeenCalledWith(4);
  });

  it('disables preview Post without text or media', () => {
    renderWithLocale(<ForumAskWizard step={4} onStepChange={() => undefined} {...idle} />);
    expect((screen.getByRole('button', { name: /^Post$/ }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('caps the text step at composerMaxLength', () => {
    renderWithLocale(
      <ForumAskWizard
        step={3}
        onStepChange={() => undefined}
        {...idle}
        composerMaxLength={FORUM_MESSAGE_MAX_LENGTH - 14}
      />,
    );
    expect(screen.getByLabelText('Your message').getAttribute('maxLength')).toBe(
      String(FORUM_MESSAGE_MAX_LENGTH - 14),
    );
  });

  it('picks files and previews one photo, many photos, and video', () => {
    const onPickFiles = vi.fn();
    const onRemovePhoto = vi.fn();
    const onClearPhoto = vi.fn();
    const file = new File([new Uint8Array([1])], 'a.jpg', { type: 'image/jpeg' });
    const photo = { previewUrl: 'blob:one', data: 'abc', contentType: 'image/jpeg' as const };
    const { rerender } = renderWithLocale(
      <ForumAskWizard
        step={2}
        onStepChange={() => undefined}
        {...idle}
        onPickFiles={onPickFiles}
        onRemovePhoto={onRemovePhoto}
        onClearPhoto={onClearPhoto}
      />,
    );
    expect(screen.queryByText('Add a photo or video')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add a photo or video' }));
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    expect(onPickFiles).toHaveBeenCalledTimes(1);
    fireEvent.change(input, { target: { files: [] } });
    rerender(
      <ForumAskWizard
        step={2}
        onStepChange={() => undefined}
        {...idle}
        photoDrafts={[photo]}
        onRemovePhoto={onRemovePhoto}
      />,
    );
    expect(screen.queryByText('Remove photo')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Remove photo' }));
    expect(onRemovePhoto).toHaveBeenCalledWith(0);
    rerender(
      <ForumAskWizard
        step={2}
        onStepChange={() => undefined}
        {...idle}
        photoDrafts={[photo, { ...photo, previewUrl: 'blob:two' }]}
        onRemovePhoto={onRemovePhoto}
      />,
    );
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove photo' })[1]!);
    expect(onRemovePhoto).toHaveBeenCalledWith(1);
    rerender(
      <ForumAskWizard
        step={2}
        onStepChange={() => undefined}
        {...idle}
        videoDraft={{
          file: new File([new Uint8Array([1])], 'c.mp4', { type: 'video/mp4' }),
          poster: new Blob(),
          previewUrl: 'blob:video',
        }}
        onClearPhoto={onClearPhoto}
      />,
    );
    expect(screen.queryByText('Remove video')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Remove video' }));
    expect(onClearPhoto).toHaveBeenCalled();
  });

  it('previews photos on step 4', () => {
    const photo = { previewUrl: 'blob:one', data: 'abc', contentType: 'image/jpeg' as const };
    const { rerender } = renderWithLocale(
      <ForumAskWizard
        step={4}
        onStepChange={() => undefined}
        {...idle}
        askDraft="21000"
        photoDrafts={[photo]}
      />,
    );
    expect(screen.getByAltText('Selected photo')).toBeTruthy();
    rerender(
      <ForumAskWizard
        step={4}
        onStepChange={() => undefined}
        {...idle}
        askDraft="21000"
        photoDrafts={[photo, { ...photo, previewUrl: 'blob:two' }]}
      />,
    );
    expect(screen.getAllByAltText('Selected photo')).toHaveLength(2);
    rerender(
      <ForumAskWizard
        step={4}
        onStepChange={() => undefined}
        {...idle}
        askDraft="21000"
        videoDraft={{
          file: new File([new Uint8Array([1])], 'c.mp4', { type: 'video/mp4' }),
          poster: new Blob(),
          previewUrl: 'blob:video',
        }}
        posting
      />,
    );
    expect(document.querySelector('video')).toBeTruthy();
    rerender(
      <ForumAskWizard
        step={4}
        onStepChange={() => undefined}
        {...idle}
        askDraft=""
        draft="Hello"
      />,
    );
    expect(screen.queryByText('0%')).toBeNull();
  });

  it('starts step 1 with a One-time / Daily pill', () => {
    const onAskCadenceChange = vi.fn();
    renderWithLocale(
      <ForumAskWizard
        step={1}
        onStepChange={() => undefined}
        {...idle}
        onAskCadenceChange={onAskCadenceChange}
      />,
    );
    expect(screen.getByRole('group', { name: 'One-time or daily' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'One-time' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(screen.getByRole('button', { name: 'Daily' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Daily' }));
    expect(onAskCadenceChange).toHaveBeenCalledWith('daily');
  });

  it('presses Daily when askCadence is daily', () => {
    const { rerender } = renderWithLocale(
      <ForumAskWizard step={1} onStepChange={() => undefined} {...idle} />,
    );
    rerender(
      <ForumAskWizard step={1} onStepChange={() => undefined} {...idle} askCadence="daily" />,
    );
    expect(screen.getByRole('button', { name: 'Daily' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'One-time' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
    fireEvent.click(screen.getByRole('button', { name: 'One-time' }));
  });

  it('hides the cadence pill on the photo and text steps', () => {
    const onStepChange = vi.fn();
    const { rerender } = renderWithLocale(
      <ForumAskWizard step={2} onStepChange={onStepChange} {...idle} />,
    );
    expect(screen.queryByRole('button', { name: 'One-time' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Daily' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Donation' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Credit' })).toBeNull();
    rerender(<ForumAskWizard step={3} onStepChange={onStepChange} {...idle} />);
    expect(screen.queryByRole('button', { name: 'One-time' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Donation' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onStepChange).toHaveBeenCalledWith(4);
  });

  it('shows the cadence pill again on the preview', () => {
    const onAskCadenceChange = vi.fn();
    renderWithLocale(
      <ForumAskWizard
        step={4}
        onStepChange={() => undefined}
        {...idle}
        askDraft="1000"
        draft="Need help"
        onAskCadenceChange={onAskCadenceChange}
        askCadence="daily"
      />,
    );
    expect(screen.getByRole('button', { name: 'Daily' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'One-time' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
    fireEvent.click(screen.getByRole('button', { name: 'One-time' }));
    expect(onAskCadenceChange).toHaveBeenCalledWith('once');
  });

  it('starts with Donation pressed and shows To be repaid when Credit is selected', () => {
    const onAskObligationChange = vi.fn();
    const { rerender } = renderWithLocale(
      <ForumAskWizard
        step={1}
        onStepChange={() => undefined}
        {...idle}
        onAskObligationChange={onAskObligationChange}
      />,
    );
    expect(screen.getByRole('group', { name: 'Donation or credit' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Donation' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(screen.getByRole('button', { name: 'Credit' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Credit' }));
    expect(onAskObligationChange).toHaveBeenCalledWith('credit');
    rerender(
      <ForumAskWizard
        step={4}
        onStepChange={() => undefined}
        {...idle}
        askDraft="1000"
        draft="Need help"
        askObligation="credit"
      />,
    );
    expect(screen.getByText('To be repaid.')).toBeTruthy();
  });

  it('does not show To be repaid on a donation preview', () => {
    renderWithLocale(
      <ForumAskWizard
        step={4}
        onStepChange={() => undefined}
        {...idle}
        askDraft="1000"
        draft="Need help"
      />,
    );
    expect(screen.getByRole('button', { name: 'Donation' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(screen.queryByText('To be repaid.')).toBeNull();
  });

  it('clicks Credit on step 1 without an obligation callback', () => {
    renderWithLocale(<ForumAskWizard step={1} onStepChange={() => undefined} {...idle} />);
    expect(screen.getByRole('heading', { name: 'How much?' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Credit' }));
  });
});
