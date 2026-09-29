import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { useLayoutEffect, useRef, useState, type ReactElement } from 'react';
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

function boxRect(top: number, bottom: number): DOMRect {
  return {
    top,
    bottom,
    height: bottom - top,
    left: 0,
    right: 200,
    width: 200,
    x: 0,
    y: top,
    toJSON() {
      return {};
    },
  };
}

function listRect(height: number): DOMRect {
  return boxRect(0, height);
}

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
    expect(screen.getByRole('listbox', { name: 'People' }).className).toContain('top-full');
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
    expect(screen.queryByRole('listbox')).toBeNull();
    typeInto('hi @');
    expect(await screen.findByRole('listbox', { name: 'People' })).toBeTruthy();
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Tab' });
    expect(screen.queryByRole('listbox')).toBeNull();
    typeInto('hi @a');
    expect(screen.queryByRole('listbox')).toBeNull();
    typeInto('see @');
    expect(await screen.findByRole('listbox', { name: 'People' })).toBeTruthy();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('listbox')).toBeNull();
    typeInto('see @a');
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

  it('gives each open field its own list id', async () => {
    search.mockResolvedValue(PEOPLE);
    useAuthStore.setState({ session: 'sess', account: null });
    renderWithLocale(
      <>
        <MentionTextarea
          value="@"
          onChange={() => undefined}
          ariaLabel="Your message"
          wrapperClassName="relative"
          className="w-full"
        />
        <MentionTextarea
          value="@"
          onChange={() => undefined}
          ariaLabel="Your reaction"
          wrapperClassName="relative"
          className="w-full"
        />
      </>,
    );
    const boxes = screen.getAllByRole('textbox');
    for (const box of boxes) {
      fireEvent.change(box, { target: { value: '@', selectionStart: 1, selectionEnd: 1 } });
      fireEvent.select(box);
    }
    const lists = await screen.findAllByRole('listbox', { name: 'People' });
    expect(lists).toHaveLength(2);
    expect(lists[0]?.id).not.toBe(lists[1]?.id);
    expect(lists[0]?.id).not.toBe('');
  });

  it('opens the list above the field only when that list would not fit below', async () => {
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
    const list = await screen.findByRole('listbox', { name: 'People' });
    expect(list.className).toContain('top-full');
    const fieldBox = vi.spyOn(box, 'getBoundingClientRect');
    const listBox = vi.spyOn(list, 'getBoundingClientRect');
    // Two hundred pixels remain under the field, and this short list still fits there.
    fieldBox.mockReturnValue(boxRect(200, window.innerHeight - 200));
    listBox.mockReturnValue(listRect(40));
    typeInto('@a');
    expect((await screen.findByRole('listbox', { name: 'People' })).className).toContain(
      'top-full',
    );
    fieldBox.mockReturnValue(boxRect(window.innerHeight - 48, window.innerHeight - 8));
    listBox.mockReturnValue(listRect(120));
    typeInto('@ad');
    expect((await screen.findByRole('listbox', { name: 'People' })).className).toContain(
      'bottom-full',
    );
    fieldBox.mockReturnValue(boxRect(4, window.innerHeight - 8));
    typeInto('@ada');
    expect((await screen.findByRole('listbox', { name: 'People' })).className).toContain(
      'top-full',
    );
  });

  it('closes the list in the same update that inserts a name', async () => {
    search.mockResolvedValue(PEOPLE);
    useAuthStore.setState({ session: 'sess', account: null });
    const watching = { current: false };
    const openDuringInsert = { current: false };
    function Field(): ReactElement {
      const [value, setValue] = useState('@');
      const root = useRef<HTMLDivElement>(null);
      useLayoutEffect(() => {
        if (!watching.current || root.current === null) {
          return;
        }
        if (root.current.querySelector('[role="listbox"]') !== null) {
          openDuringInsert.current = true;
        }
      });
      return (
        <div ref={root}>
          <MentionTextarea
            value={value}
            onChange={setValue}
            ariaLabel="Your message"
            wrapperClassName="relative"
            className="w-full"
          />
        </div>
      );
    }
    renderWithLocale(<Field />);
    const box = typeInto('@');
    expect(await screen.findByRole('option', { name: '@ada' })).toBeTruthy();
    watching.current = true;
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(openDuringInsert.current).toBe(false);
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('@ada ');
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).selectionStart).toBe(
      '@ada '.length,
    );
    expect(screen.queryByRole('listbox')).toBeNull();
    typeInto('@');
    expect(await screen.findByRole('listbox', { name: 'People' })).toBeTruthy();
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
