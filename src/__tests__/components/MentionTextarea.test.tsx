import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { useState, type ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MentionTextarea } from '@/components/MentionTextarea';
import { searchMentionAccounts } from '@/lib/mention-search';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/lib/mention-search', () => ({
  searchMentionAccounts: vi.fn(),
}));

const search = vi.mocked(searchMentionAccounts);

const PEOPLE = [
  { id: 'acc-ada', username: 'ada', name: 'Ada Lovelace' },
  { id: 'acc-adam', username: 'adam', name: 'Adam' },
  { id: 'acc-ashton', username: 'ashton', name: 'ashton' },
];

function typeInto(value: string): HTMLTextAreaElement {
  const box = screen.getByRole('textbox') as HTMLTextAreaElement;
  fireEvent.change(box, {
    target: { value, selectionStart: value.length, selectionEnd: value.length },
  });
  box.setSelectionRange(value.length, value.length);
  fireEvent.select(box);
  return box;
}

describe('MentionTextarea', () => {
  afterEach(() => {
    cleanup();
    search.mockReset();
    useAuthStore.setState({ session: null, account: null });
  });

  it('does not fetch or list people without a session', () => {
    renderWithLocale(
      <MentionTextarea
        value=""
        onChange={() => undefined}
        ariaLabel="Your message"
        wrapperClassName="relative"
        className="w-full"
      />,
    );
    const box = typeInto('@');
    fireEvent.keyDown(box, { key: 'Enter' });
    fireEvent.click(box);
    expect(search).not.toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('does not fetch while disabled', () => {
    useAuthStore.setState({ session: 'sess', account: null });
    renderWithLocale(
      <MentionTextarea
        value=""
        onChange={() => undefined}
        disabled
        ariaLabel="Your message"
        wrapperClassName="relative"
        className="w-full"
      />,
    );
    expect(search).not.toHaveBeenCalled();
  });

  it('shows the first people as soon as @ is typed and inserts the chosen name', async () => {
    search.mockResolvedValue(PEOPLE);
    useAuthStore.setState({ session: 'sess', account: null });
    const onChange = vi.fn();
    const textareaRef = { current: null as HTMLTextAreaElement | null };
    renderWithLocale(
      <MentionTextarea
        value="@"
        onChange={onChange}
        ariaLabel="Your message"
        placeholder="Write"
        maxLength={8000}
        rows={2}
        textareaRef={textareaRef}
        wrapperClassName="relative"
        className="w-full"
      />,
    );
    await waitFor(() => {
      expect(search).toHaveBeenCalledWith('sess', '');
    });
    const box = typeInto('@');
    expect(await screen.findByRole('listbox', { name: 'People' })).toBeTruthy();
    expect(screen.getByRole('option', { name: '@ada' })).toBeTruthy();
    expect(screen.getByText('Ada Lovelace')).toBeTruthy();
    expect(screen.queryByText('ashton')).toBeNull();
    fireEvent.keyDown(box, { key: 'ArrowDown' });
    fireEvent.keyDown(box, { key: 'ArrowUp' });
    fireEvent.keyDown(box, { key: 'End' });
    fireEvent.keyDown(box, { key: 'Home' });
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('@ada ');
    expect(textareaRef.current).toBeInstanceOf(HTMLTextAreaElement);
  });

  it('filters to the typed prefix, then uses the server page', async () => {
    search.mockImplementation(async (_token: string, query: string) => {
      if (query === '') {
        return PEOPLE;
      }
      if (query === 'as') {
        return [PEOPLE[2]!];
      }
      return [];
    });
    useAuthStore.setState({ session: 'sess', account: null });
    const onChange = vi.fn();
    const view = (value: string) => (
      <MentionTextarea
        value={value}
        onChange={onChange}
        ariaLabel="Your message"
        wrapperClassName="relative"
        className="w-full"
      />
    );
    const { rerender } = renderWithLocale(view('@'));
    typeInto('@');
    expect(await screen.findByRole('option', { name: '@ada' })).toBeTruthy();
    rerender(view('@as'));
    typeInto('@as');
    expect(screen.getByRole('option', { name: '@ashton' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: '@ada' })).toBeNull();
    await waitFor(() => {
      expect(search).toHaveBeenCalledWith('sess', 'as');
    });
    fireEvent.mouseDown(screen.getByRole('option', { name: '@ashton' }));
    expect(onChange).toHaveBeenCalledWith('@ashton ');
  });

  it('closes on Escape, Tab, and a pointer outside, and hides a failed search', async () => {
    search.mockResolvedValue(PEOPLE);
    useAuthStore.setState({ session: 'sess', account: null });
    function Field(): ReactElement {
      const [value, setValue] = useState('@');
      return (
        <MentionTextarea
          value={value}
          onChange={setValue}
          ariaLabel="Your message"
          wrapperClassName="relative"
          className="w-full"
        />
      );
    }
    renderWithLocale(<Field />);
    const box = typeInto('@');
    expect(await screen.findByRole('listbox', { name: 'People' })).toBeTruthy();
    fireEvent.keyDown(box, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    typeInto('@a');
    expect(await screen.findByRole('listbox', { name: 'People' })).toBeTruthy();
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Tab' });
    expect(screen.queryByRole('listbox')).toBeNull();
    typeInto('@ad');
    expect(await screen.findByRole('listbox', { name: 'People' })).toBeTruthy();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('hides the list when the prefetch fails or the prefix matches nobody', async () => {
    search.mockRejectedValueOnce(new Error('down'));
    useAuthStore.setState({ session: 'sess', account: null });
    renderWithLocale(
      <MentionTextarea
        value="@"
        onChange={() => undefined}
        ariaLabel="Your message"
        wrapperClassName="relative"
        className="w-full"
      />,
    );
    typeInto('@');
    await waitFor(() => {
      expect(search).toHaveBeenCalled();
    });
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('places the caret after an inserted name and hides a failed prefix search', async () => {
    search.mockImplementation(async (_token: string, query: string) => {
      if (query === '') {
        return PEOPLE;
      }
      throw new Error('down');
    });
    useAuthStore.setState({ session: 'sess', account: null });
    function Field(): ReactElement {
      const [value, setValue] = useState('@');
      return (
        <MentionTextarea
          value={value}
          onChange={setValue}
          ariaLabel="Your message"
          wrapperClassName="relative"
          className="w-full"
        />
      );
    }
    renderWithLocale(<Field />);
    const box = typeInto('@');
    expect(await screen.findByRole('option', { name: '@ada' })).toBeTruthy();
    fireEvent.keyDown(box, { key: 'Enter' });
    await waitFor(() => {
      expect((screen.getByRole('textbox') as HTMLTextAreaElement).selectionStart).toBe(
        '@ada '.length,
      );
    });
    typeInto('@zzz');
    await waitFor(() => {
      expect(search).toHaveBeenCalledWith('sess', 'zzz');
    });
    await waitFor(() => {
      expect(screen.queryByRole('listbox')).toBeNull();
    });
  });

  it('does not suggest inside an address or a selection', async () => {
    search.mockResolvedValue(PEOPLE);
    useAuthStore.setState({ session: 'sess', account: null });
    renderWithLocale(
      <MentionTextarea
        value="name@ada"
        onChange={() => undefined}
        ariaLabel="Your message"
        wrapperClassName="relative"
        className="w-full"
      />,
    );
    await waitFor(() => {
      expect(search).toHaveBeenCalled();
    });
    const box = typeInto('name@ada');
    expect(screen.queryByRole('listbox')).toBeNull();
    box.setSelectionRange(0, 4);
    fireEvent.select(box);
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});
