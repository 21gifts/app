import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { useLayoutEffect, useRef, useState, type ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MentionTextarea, type MentionAccount } from '@/components/MentionTextarea';
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
  return placeCaret(value, value.length);
}

function placeCaret(value: string, caret: number): HTMLTextAreaElement {
  const box = screen.getByRole('textbox') as HTMLTextAreaElement;
  fireEvent.change(box, {
    target: { value, selectionStart: caret, selectionEnd: caret },
  });
  box.setSelectionRange(caret, caret);
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

  it('keeps a closed composer unwrapped until the list opens', async () => {
    search.mockResolvedValue(PEOPLE);
    useAuthStore.setState({ session: 'sess', account: null });
    const closed = 'h-12 min-w-0 flex-1 w-full block resize-none';
    function Field(): ReactElement {
      const [value, setValue] = useState('');
      return (
        <MentionTextarea
          value={value}
          onChange={setValue}
          ariaLabel="Your message"
          wrapperClassName="relative min-w-0 flex-1"
          className={closed}
        />
      );
    }
    renderWithLocale(<Field />);
    const idle = screen.getByRole('textbox');
    expect(idle.className).toBe(closed);
    expect(idle.parentElement?.classList.contains('contents')).toBe(true);
    expect(idle.parentElement?.classList.contains('relative')).toBe(false);
    typeInto('@');
    const open = await screen.findByRole('textbox');
    expect(open.className).toBe('block min-w-0 w-full h-12 resize-none');
    expect(open.parentElement?.classList.contains('relative')).toBe(true);
    expect(await screen.findByRole('listbox', { name: 'People' })).toBeTruthy();
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
    typeInto('@');
    expect(await screen.findByRole('listbox', { name: 'People' })).toBeTruthy();
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });
    typeInto('@ ');
    typeInto('@');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('keeps every dismissed @ closed until that character is gone', async () => {
    search.mockResolvedValue(PEOPLE);
    useAuthStore.setState({ session: 'sess', account: null });
    function Field(): ReactElement {
      const [value, setValue] = useState('@ one @');
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
    const box = placeCaret('@ one @', 1);
    expect(await screen.findByRole('listbox', { name: 'People' })).toBeTruthy();
    fireEvent.keyDown(box, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    placeCaret('@ one @', 7);
    expect(await screen.findByRole('listbox', { name: 'People' })).toBeTruthy();
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    placeCaret('@ one @', 1);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('opens a different @ that slides onto a dismissed index', async () => {
    search.mockResolvedValue(PEOPLE);
    useAuthStore.setState({ session: 'sess', account: null });
    function Field(): ReactElement {
      const [value, setValue] = useState('@a @');
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
    const box = placeCaret('@a @', 1);
    expect(await screen.findByRole('listbox', { name: 'People' })).toBeTruthy();
    fireEvent.keyDown(box, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    placeCaret('@', 0);
    placeCaret('@', 1);
    expect(await screen.findByRole('listbox', { name: 'People' })).toBeTruthy();
  });

  it('keeps a dismissed @ closed when earlier text shifts it', async () => {
    search.mockResolvedValue(PEOPLE);
    useAuthStore.setState({ session: 'sess', account: null });
    function Field(): ReactElement {
      const [value, setValue] = useState('hi @');
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
    const box = placeCaret('hi @', 4);
    expect(await screen.findByRole('listbox', { name: 'People' })).toBeTruthy();
    fireEvent.keyDown(box, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    placeCaret('xhi @', 1);
    placeCaret('xhi @', 5);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('dismisses an @ with Escape or Tab before the people list arrives', async () => {
    useAuthStore.setState({ session: 'sess', account: null });
    function Field(): ReactElement {
      const [value, setValue] = useState('');
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
    function deferPeople(): (rows: MentionAccount[]) => void {
      let settle: (rows: MentionAccount[]) => void = () => undefined;
      search.mockImplementation(
        () =>
          new Promise((resolve) => {
            settle = resolve;
          }),
      );
      return (rows) => {
        settle(rows);
      };
    }

    const resolveEscape = deferPeople();
    const escaped = renderWithLocale(<Field />);
    let box = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(fireEvent.keyDown(box, { key: 'Escape' })).toBe(true);
    box = typeInto('@');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(fireEvent.keyDown(box, { key: 'Escape' })).toBe(false);
    await act(async () => {
      resolveEscape(PEOPLE);
    });
    expect(screen.queryByRole('listbox')).toBeNull();
    escaped.unmount();

    const resolveTab = deferPeople();
    const tabbed = renderWithLocale(<Field />);
    box = typeInto('@');
    expect(fireEvent.keyDown(box, { key: 'Tab' })).toBe(true);
    await act(async () => {
      resolveTab(PEOPLE);
    });
    expect(screen.queryByRole('listbox')).toBeNull();
    tabbed.unmount();

    const resolveOpen = deferPeople();
    renderWithLocale(<Field />);
    typeInto('@');
    await act(async () => {
      resolveOpen(PEOPLE);
    });
    expect(await screen.findByRole('listbox', { name: 'People' })).toBeTruthy();
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

  it('measures again when the same number of people is replaced', async () => {
    let release: (rows: MentionAccount[]) => void = () => undefined;
    search.mockImplementation(async (_token: string, query: string) => {
      if (query === '') {
        return PEOPLE.slice(0, 2);
      }
      return new Promise<MentionAccount[]>((resolve) => {
        release = resolve;
      });
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
    const list = await screen.findByRole('listbox', { name: 'People' });
    const fieldBox = vi.spyOn(box, 'getBoundingClientRect');
    const listBox = vi.spyOn(list, 'getBoundingClientRect');
    fieldBox.mockReturnValue(boxRect(300, window.innerHeight - 80));
    listBox.mockReturnValue(listRect(40));
    typeInto('@a');
    expect(list.className).toContain('top-full');
    await waitFor(() => {
      expect(search).toHaveBeenCalledWith('sess', 'a');
    });
    listBox.mockReturnValue(listRect(200));
    release([
      { id: 'acc-long-1', username: 'alpha', name: 'Alpha' },
      { id: 'acc-long-2', username: 'alpine', name: 'Alpine' },
    ]);
    await waitFor(() => {
      expect(list.className).toContain('bottom-full');
    });
  });

  it('drops a stale server page in the same update as the next letter', async () => {
    search.mockImplementation(async (_token: string, query: string) => {
      if (query === '') {
        return PEOPLE;
      }
      if (query === 'a') {
        return [PEOPLE[2]!];
      }
      return PEOPLE.filter((row) => row.username.startsWith(query));
    });
    useAuthStore.setState({ session: 'sess', account: null });
    const sawStale = { current: false };
    const watching = { current: false };
    function Field(): ReactElement {
      const [value, setValue] = useState('@a');
      const root = useRef<HTMLDivElement>(null);
      useLayoutEffect(() => {
        if (!watching.current || root.current === null) {
          return;
        }
        if (root.current.querySelector('[role="option"][aria-label="@ashton"]') !== null) {
          sawStale.current = true;
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
    typeInto('@a');
    await waitFor(() => {
      expect(screen.getByRole('option', { name: '@ashton' })).toBeTruthy();
      expect(screen.queryByRole('option', { name: '@ada' })).toBeNull();
    });
    watching.current = true;
    typeInto('@ad');
    expect(sawStale.current).toBe(false);
    expect(screen.getByRole('option', { name: '@ada' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: '@ashton' })).toBeNull();
  });

  it('moves the caret when the inserted handle is already in the field', async () => {
    search.mockResolvedValue(PEOPLE);
    useAuthStore.setState({ session: 'sess', account: null });
    function Field(): ReactElement {
      const [value, setValue] = useState('hi @ada there');
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
    const box = screen.getByRole('textbox') as HTMLTextAreaElement;
    box.setSelectionRange(7, 7);
    fireEvent.select(box);
    fireEvent.mouseDown(await screen.findByRole('option', { name: '@ada' }));
    expect(box.selectionStart).toBe(8);
    expect(box.value).toBe('hi @ada there');
  });

  it('does not leave a second space when the token already has one', async () => {
    search.mockResolvedValue(PEOPLE);
    useAuthStore.setState({ session: 'sess', account: null });
    const onChange = vi.fn();
    renderWithLocale(
      <MentionTextarea
        value="hi @ad there"
        onChange={onChange}
        ariaLabel="Your message"
        wrapperClassName="relative"
        className="w-full"
      />,
    );
    const box = screen.getByRole('textbox') as HTMLTextAreaElement;
    box.setSelectionRange(6, 6);
    fireEvent.select(box);
    fireEvent.mouseDown(await screen.findByRole('option', { name: '@ada' }));
    expect(onChange).toHaveBeenCalledWith('hi @ada there');
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

  it('does not insert a handle that would pass the length limit', async () => {
    search.mockResolvedValue(PEOPLE);
    useAuthStore.setState({ session: 'sess', account: null });
    const onChange = vi.fn();
    renderWithLocale(
      <MentionTextarea
        value="@"
        onChange={onChange}
        maxLength={4}
        ariaLabel="Your message"
        wrapperClassName="relative"
        className="w-full"
      />,
    );
    const box = typeInto('@');
    expect(await screen.findByRole('option', { name: '@ada' })).toBeTruthy();
    onChange.mockClear();
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('listbox', { name: 'People' })).toBeTruthy();
    expect(box.value).toBe('@');
  });

  it('inserts a handle that fits the length limit exactly', async () => {
    search.mockResolvedValue(PEOPLE);
    useAuthStore.setState({ session: 'sess', account: null });
    const onChange = vi.fn();
    renderWithLocale(
      <MentionTextarea
        value="@"
        onChange={onChange}
        maxLength={'@ada '.length}
        ariaLabel="Your message"
        wrapperClassName="relative"
        className="w-full"
      />,
    );
    const box = typeInto('@');
    expect(await screen.findByRole('option', { name: '@ada' })).toBeTruthy();
    onChange.mockClear();
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('@ada ');
    expect(box.value).toBe('@');
  });

  it('leaves an in-progress composition to the input method', async () => {
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
    expect(await screen.findByRole('option', { name: '@ada' })).toBeTruthy();
    fireEvent.keyDown(box, { key: 'Enter', isComposing: true });
    expect(box.value).toBe('@');
    expect(screen.getByRole('listbox', { name: 'People' })).toBeTruthy();
    fireEvent.keyDown(box, { key: 'Enter', keyCode: 229 });
    expect(box.value).toBe('@');
    expect(screen.getByRole('listbox', { name: 'People' })).toBeTruthy();
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
