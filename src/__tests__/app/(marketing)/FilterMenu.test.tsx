import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FilterMenu, type MenuOption } from '@/app/(marketing)/FilterMenu';

const optionClass =
  'flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-inherit';

const options: readonly MenuOption[] = [
  { value: '', label: 'All', swatch: null },
  { value: 'Bitcoin', label: 'Bitcoin', swatch: null },
  { value: 'daily', label: 'Daily', swatch: 'shop-place-marker is-daily' },
];

function renderMenu(value: string, onChange = vi.fn()) {
  const onParent = vi.fn();
  render(
    <div onClick={onParent}>
      <FilterMenu
        label="Blockchain"
        value={value}
        allLabel="All"
        options={options}
        onChange={onChange}
      />
    </div>,
  );
  return { onChange, onParent };
}

function trigger(): HTMLElement {
  return screen.getByRole('combobox', { name: 'Blockchain' });
}

afterEach(cleanup);

describe('FilterMenu', () => {
  it('is closed for an empty value', () => {
    renderMenu('');
    const button = trigger();
    expect(button.getAttribute('role')).toBe('combobox');
    expect(button.getAttribute('type')).toBe('button');
    expect(button.getAttribute('aria-haspopup')).toBe('listbox');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.hasAttribute('aria-activedescendant')).toBe(false);
    expect(button.querySelector('[data-shop-value]')?.textContent).toBe('All');
    const label = within(button).getByText('Blockchain');
    expect(label.className).toContain('text-ink/60');
    const value = button.querySelector('[data-shop-value]');
    expect(value?.className.split(/\s+/)).toContain('truncate');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it.each(['', 'Bitcoin'])(
    'uses a two-row phone and one-row sm class contract for value "%s"',
    (selected) => {
      renderMenu(selected);
      const button = trigger();
      const label = within(button).getByText('Blockchain');
      const value = button.querySelector('[data-shop-value]');
      const chevron = button.querySelector('svg');
      expect(button.className.split(/\s+/)).toEqual(
        expect.arrayContaining([
          'grid',
          'grid-cols-[minmax(0,1fr)_auto]',
          'items-center',
          'min-h-11',
          'gap-x-1',
          'rounded-2xl',
          'px-3',
          'py-1.5',
          'sm:flex',
          'sm:h-11',
          'sm:gap-6',
          'sm:rounded-full',
          'sm:py-0',
          'sm:pl-4',
          'sm:pr-4',
        ]),
      );
      expect(label.className.split(/\s+/)).toEqual(
        expect.arrayContaining([
          'col-start-1',
          'row-start-1',
          'shrink-0',
          'text-left',
          'text-xs',
          'sm:text-sm',
        ]),
      );
      expect(value?.className.split(/\s+/)).toEqual(
        expect.arrayContaining([
          'col-start-1',
          'row-start-2',
          'truncate',
          'text-left',
          'text-sm',
          'font-semibold',
        ]),
      );
      expect(value?.parentElement?.className.split(/\s+/)).toEqual(
        expect.arrayContaining([
          'contents',
          'min-w-0',
          'items-center',
          'sm:ml-auto',
          'sm:flex',
          'sm:gap-2',
        ]),
      );
      expect(chevron?.getAttribute('class')?.split(/\s+/)).toEqual(
        expect.arrayContaining([
          'col-start-2',
          'row-span-2',
          'row-start-1',
          'h-3.5',
          'w-3.5',
          'shrink-0',
        ]),
      );
    },
  );

  it('opens on click and closes on the second click', () => {
    renderMenu('');
    const button = trigger();
    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('closes without moving focus when focus leaves the menu', () => {
    renderMenu('');
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    const button = trigger();
    act(() => button.focus());
    fireEvent.click(button);
    act(() => outside.focus());
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(outside);
    outside.remove();
  });

  it('keeps the list open when focus moves inside it or leaves the page', () => {
    renderMenu('');
    const button = trigger();
    act(() => button.focus());
    fireEvent.click(button);
    const option = screen.getByRole('option', { name: 'Bitcoin' });
    act(() => option.focus());
    expect(document.activeElement).toBe(option);
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.blur(option, { relatedTarget: null });
    expect(screen.getByRole('listbox')).toBeTruthy();
  });

  it('opens from ArrowDown on the selected option', () => {
    renderMenu('');
    const button = trigger();
    fireEvent.keyDown(button, { key: 'ArrowDown' });
    const listbox = screen.getByRole('listbox');
    const selected = within(listbox).getByRole('option', { selected: true });
    expect(button.getAttribute('aria-controls')).toBe(listbox.id);
    expect(selected.textContent).toBe('All');
    expect(button.getAttribute('aria-activedescendant')).toBe(selected.id);
    expect(button.getAttribute('role')).toBe('combobox');
    expect(button.getAttribute('aria-expanded')).toBe('true');
  });

  it('highlights Bitcoin when ArrowDown opens that value', () => {
    renderMenu('Bitcoin');
    const button = trigger();
    fireEvent.keyDown(button, { key: 'ArrowDown' });
    const listbox = screen.getByRole('listbox');
    const bitcoin = within(listbox).getByRole('option', { name: 'Bitcoin' });
    const all = within(listbox).getByRole('option', { name: 'All' });
    expect(bitcoin.textContent).toBe('Bitcoin');
    expect(bitcoin.getAttribute('aria-selected')).toBe('true');
    expect(button.getAttribute('aria-activedescendant')).toBe(bitcoin.id);
    expect(bitcoin.className).toContain('is-active');
    expect(all.getAttribute('aria-selected')).toBe('false');
    expect(all.className).not.toContain('is-active');
  });

  it('shows All and highlights the first option when the value is unknown', () => {
    renderMenu('nope');
    const button = trigger();
    expect(button.querySelector('[data-shop-value]')?.textContent).toBe('All');
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.keyDown(button, { key: 'ArrowDown' });
    const optionNodes = within(screen.getByRole('listbox')).getAllByRole('option');
    const first = optionNodes[0];
    if (first === undefined) throw new Error('missing first option');
    expect(button.getAttribute('aria-activedescendant')).toBe(first.id);
    expect(first.textContent).toBe('All');
    expect(first.className).toContain('is-active');
    expect(optionNodes.filter((option) => option.className.includes('is-active'))).toHaveLength(1);
  });

  it('moves one option on ArrowDown and stays on the last option', () => {
    renderMenu('');
    const button = trigger();
    fireEvent.click(button);
    const listbox = screen.getByRole('listbox');
    const all = within(listbox).getByRole('option', { name: 'All' });
    const bitcoin = within(listbox).getByRole('option', { name: 'Bitcoin' });
    const daily = within(listbox).getByRole('option', { name: 'Daily' });
    expect(button.getAttribute('aria-activedescendant')).toBe(all.id);
    fireEvent.keyDown(button, { key: 'ArrowRight' });
    fireEvent.keyDown(button, { key: 'ArrowLeft' });
    expect(button.getAttribute('aria-activedescendant')).toBe(all.id);
    fireEvent.keyDown(button, { key: 'ArrowDown' });
    expect(button.getAttribute('aria-activedescendant')).toBe(bitcoin.id);
    expect(bitcoin.className).toContain('is-active');
    expect(all.className).not.toContain('is-active');
    expect(daily.className).not.toContain('is-active');
    expect(all.getAttribute('aria-selected')).toBe('true');
    expect(bitcoin.getAttribute('aria-selected')).toBe('false');
    fireEvent.keyDown(button, { key: 'ArrowDown' });
    expect(button.getAttribute('aria-activedescendant')).toBe(daily.id);
    fireEvent.keyDown(button, { key: 'ArrowDown' });
    expect(button.getAttribute('aria-activedescendant')).toBe(daily.id);
    const highlighted = within(listbox)
      .getAllByRole('option')
      .filter((option) => option.className.includes('is-active'));
    expect(highlighted).toHaveLength(1);
    const active = highlighted[0];
    if (active === undefined) throw new Error('missing highlighted option');
    expect(button.getAttribute('aria-activedescendant')).toBe(active.id);
    expect(active).toBe(daily);
    expect(all.getAttribute('aria-selected')).toBe('true');
    expect(daily.getAttribute('aria-selected')).toBe('false');
  });

  it.each([
    [10, 2],
    [17, 3],
  ])('moves through a %i-option menu in %i columns', (count, columns) => {
    const choices: MenuOption[] = [{ value: '', label: 'All', swatch: null }];
    for (let index = 1; index < count; index += 1) {
      choices.push({ value: `v${index}`, label: `Option ${index}`, swatch: null });
    }
    render(
      <FilterMenu
        label="Blockchain"
        value="v1"
        allLabel="All"
        options={choices}
        onChange={vi.fn()}
      />,
    );
    const button = trigger();
    fireEvent.click(button);
    const list = screen.getByRole('listbox');
    expect(list.querySelector('.grid')?.className).toContain(`grid-cols-${columns}`);
    const nodes = within(list).getAllByRole('option');
    const expectActive = (index: number): void => {
      expect(button.getAttribute('aria-activedescendant')).toBe(nodes[index]?.id);
    };
    expectActive(1);
    fireEvent.keyDown(button, { key: 'ArrowLeft' });
    expectActive(1);
    fireEvent.keyDown(button, { key: 'ArrowRight' });
    expectActive(2);
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    expectActive(2 + columns);
    fireEvent.keyDown(list, { key: 'ArrowUp' });
    expectActive(2);
    fireEvent.keyDown(button, { key: 'ArrowLeft' });
    expectActive(1);
    for (let index = 1; index < columns; index += 1) {
      fireEvent.keyDown(button, { key: 'ArrowRight' });
    }
    fireEvent.keyDown(button, { key: 'ArrowRight' });
    expectActive(columns);
    fireEvent.keyDown(list, { key: 'End' });
    expectActive(count - 1);
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    expectActive(count - 1);
    fireEvent.keyDown(list, { key: 'Home' });
    expectActive(0);
    fireEvent.keyDown(button, { key: 'ArrowUp' });
    expectActive(0);
    fireEvent.keyDown(button, { key: 'ArrowRight' });
    expectActive(0);
    fireEvent.keyDown(button, { key: 'ArrowLeft' });
    expectActive(0);
    fireEvent.keyDown(button, { key: 'ArrowDown' });
    expectActive(1);
    fireEvent.keyDown(button, { key: 'ArrowUp' });
    expectActive(0);
    fireEvent.keyDown(button, { key: 'End' });
    fireEvent.keyDown(button, { key: 'ArrowUp' });
    expectActive(count - 1 - columns);
    fireEvent.keyDown(button, { key: 'ArrowRight' });
    fireEvent.keyDown(button, { key: 'ArrowDown' });
    expectActive(count - 1);
  });

  it('keeps ArrowUp on the first option and opens a closed menu on the current option', () => {
    renderMenu('Bitcoin');
    const button = trigger();
    fireEvent.keyDown(button, { key: 'ArrowDown' });
    const listbox = screen.getByRole('listbox');
    const all = within(listbox).getByRole('option', { name: 'All' });
    const bitcoin = within(listbox).getByRole('option', { name: 'Bitcoin' });
    expect(button.getAttribute('aria-activedescendant')).toBe(bitcoin.id);
    expect(bitcoin.className).toContain('is-active');
    fireEvent.keyDown(button, { key: 'ArrowUp' });
    expect(button.getAttribute('aria-activedescendant')).toBe(all.id);
    fireEvent.keyDown(button, { key: 'ArrowUp' });
    expect(button.getAttribute('aria-activedescendant')).toBe(all.id);
    expect(all.className).toContain('is-active');
    button.blur();
    expect(document.activeElement).not.toBe(button);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement).not.toBe(button);
    fireEvent.keyDown(button, { key: 'ArrowUp' });
    const opened = screen.getByRole('listbox');
    const current = within(opened).getByRole('option', { name: 'Bitcoin' });
    const first = within(opened).getByRole('option', { name: 'All' });
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(button.getAttribute('aria-activedescendant')).toBe(current.id);
    expect(current.getAttribute('aria-selected')).toBe('true');
    expect(current.className).toContain('is-active');
    expect(first.className).not.toContain('is-active');
    expect(button.getAttribute('aria-activedescendant')).not.toBe(first.id);
  });

  it('ignores Home and End while closed and jumps to the ends while open', () => {
    renderMenu('');
    const button = trigger();
    fireEvent.keyDown(button, { key: 'Home' });
    fireEvent.keyDown(button, { key: 'End' });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.keyDown(button, { key: 'ArrowDown' });
    fireEvent.keyDown(button, { key: 'ArrowDown' });
    const optionNodes = within(screen.getByRole('listbox')).getAllByRole('option');
    const first = optionNodes[0];
    const last = optionNodes[optionNodes.length - 1];
    if (first === undefined || last === undefined) throw new Error('missing option');
    expect(button.getAttribute('aria-activedescendant')).not.toBe(first.id);
    expect(button.getAttribute('aria-activedescendant')).not.toBe(last.id);
    fireEvent.keyDown(button, { key: 'Home' });
    expect(button.getAttribute('aria-activedescendant')).toBe(first.id);
    fireEvent.keyDown(button, { key: 'End' });
    expect(button.getAttribute('aria-activedescendant')).toBe(last.id);
  });

  it('opens with Enter and commits only a changed option', () => {
    const { onChange } = renderMenu('');
    const button = trigger();
    fireEvent.keyDown(button, { key: 'Enter' });
    expect(screen.getByRole('listbox')).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.keyDown(button, { key: 'Enter' });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement).toBe(button);
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.keyDown(button, { key: 'Enter' });
    fireEvent.keyDown(button, { key: 'ArrowDown' });
    fireEvent.keyDown(button, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('Bitcoin');
    expect(document.activeElement).toBe(button);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('opens with Space and commits only a changed option', () => {
    const { onChange } = renderMenu('');
    const button = trigger();
    fireEvent.keyDown(button, { key: ' ' });
    expect(screen.getByRole('listbox')).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.keyDown(button, { key: ' ' });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement).toBe(button);
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.keyDown(button, { key: ' ' });
    fireEvent.keyDown(button, { key: 'ArrowDown' });
    fireEvent.keyDown(button, { key: ' ' });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('Bitcoin');
    expect(document.activeElement).toBe(button);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('ignores a letter and closes from Escape on the trigger', () => {
    renderMenu('');
    const button = trigger();
    fireEvent.keyDown(button, { key: 'ArrowDown' });
    const active = button.getAttribute('aria-activedescendant');
    fireEvent.keyDown(button, { key: 'a' });
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('listbox')).toBeTruthy();
    expect(button.getAttribute('aria-activedescendant')).toBe(active);
    fireEvent.keyDown(button, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement).toBe(button);
    fireEvent.keyDown(button, { key: 'Escape' });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('selects an option with the pointer without notifying the parent click', () => {
    const { onChange, onParent } = renderMenu('');
    const button = trigger();
    fireEvent.keyDown(button, { key: 'ArrowDown' });
    fireEvent.mouseDown(within(screen.getByRole('listbox')).getByRole('option', { name: 'All' }));
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.keyDown(button, { key: 'ArrowDown' });
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'All' }));
    expect(onParent).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement).toBe(button);
    fireEvent.keyDown(button, { key: 'ArrowDown' });
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'Bitcoin' }));
    expect(onParent).not.toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('Bitcoin');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it('renders every option as a button with one active class and the daily swatch', () => {
    renderMenu('');
    fireEvent.keyDown(trigger(), { key: 'ArrowDown' });
    const optionNodes = within(screen.getByRole('listbox')).getAllByRole('option');
    const highlighted = optionNodes.filter((option) => option.className.includes('is-active'));
    expect(highlighted).toHaveLength(1);
    for (const option of optionNodes) {
      expect(option.className).toContain(optionClass);
      expect(option.getAttribute('type')).toBe('button');
      expect(option.getAttribute('role')).toBe('option');
      expect(option.getAttribute('tabindex')).toBe('-1');
    }
    const all = within(screen.getByRole('listbox')).getByRole('option', { name: 'All' });
    expect(all.querySelector('.shop-place-marker')).toBeNull();
    const daily = within(screen.getByRole('listbox')).getByRole('option', { name: 'Daily' });
    const swatch = daily.querySelector('span');
    if (!(swatch instanceof HTMLSpanElement)) throw new Error('missing swatch');
    expect(swatch.className).toBe('shop-place-marker is-daily');
    expect(swatch.getAttribute('aria-hidden')).toBe('true');
  });

  it('inverts a chosen pill and points the chevron up while open', () => {
    renderMenu('Bitcoin');
    const button = trigger();
    expect(button.className).toContain('bg-ink');
    expect(button.className).toContain('text-paper');
    expect(button.className).not.toContain('bg-paper');
    expect(button.querySelector('[data-shop-value]')?.textContent).toBe('Bitcoin');
    const chevron = button.querySelector('svg');
    if (chevron === null) throw new Error('missing chevron');
    expect(chevron.getAttribute('class')).not.toContain('rotate-180');
    fireEvent.click(button);
    expect(button.className).toContain('border-ink/35');
    expect(button.querySelector('svg')?.getAttribute('class')).toContain('rotate-180');
    const selected = within(screen.getByRole('listbox')).getByRole('option', { name: 'Bitcoin' });
    expect(selected.className).toContain('font-semibold');
    expect(selected.querySelector('svg')).toBeTruthy();
    const all = within(screen.getByRole('listbox')).getByRole('option', { name: 'All' });
    expect(all.querySelector('svg')).toBeNull();
    expect(screen.getByRole('listbox').querySelector('.border-t')).toBeTruthy();
  });

  it('uses the expected grid column classes for the tested option counts', () => {
    function labels(count: number): MenuOption[] {
      const rows: MenuOption[] = [{ value: '', label: 'All', swatch: null }];
      for (let index = 1; index < count; index += 1) {
        rows.push({ value: `v${index}`, label: `Option ${index}`, swatch: null });
      }
      return rows;
    }
    const { unmount } = render(
      <FilterMenu
        label="Blockchain"
        value=""
        allLabel="All"
        options={labels(8)}
        onChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('combobox', { name: 'Blockchain' }));
    expect(screen.getByRole('listbox').querySelector('.grid')?.className).toContain('grid-cols-1');
    unmount();

    for (const [count, columns] of [
      [9, 'grid-cols-2'],
      [17, 'grid-cols-3'],
      [25, 'grid-cols-4'],
      [33, 'grid-cols-5'],
      [41, 'grid-cols-6'],
      [49, 'grid-cols-7'],
      [57, 'grid-cols-8'],
    ] as const) {
      const view = render(
        <FilterMenu
          label="Blockchain"
          value=""
          allLabel="All"
          options={labels(count)}
          onChange={vi.fn()}
        />,
      );
      fireEvent.click(screen.getByRole('combobox', { name: 'Blockchain' }));
      expect(screen.getByRole('listbox').querySelector('.grid')?.className).toContain(columns);
      view.unmount();
    }
  });

  it('renders an empty list without a hairline and only All without one', () => {
    const { unmount } = render(
      <FilterMenu label="Blockchain" value="" allLabel="All" options={[]} onChange={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('combobox', { name: 'Blockchain' }));
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(screen.getByRole('listbox').querySelector('.border-t')).toBeNull();
    unmount();
    render(
      <FilterMenu
        label="Blockchain"
        value=""
        allLabel="All"
        options={[{ value: '', label: 'All', swatch: null }]}
        onChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('combobox', { name: 'Blockchain' }));
    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.getByRole('listbox').querySelector('.border-t')).toBeNull();
  });

  it('shows a blank value in the option grid when it is not the All row', () => {
    render(
      <FilterMenu
        label="Blockchain"
        value=""
        allLabel="All"
        options={[
          { value: '', label: 'All', swatch: null },
          { value: '', label: 'Blank', swatch: null },
        ]}
        onChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('combobox', { name: 'Blockchain' }));
    const grid = screen.getByRole('listbox').querySelector('.grid');
    expect(grid?.textContent).toBe('Blank');
    expect(grid?.querySelector('[data-value]')?.getAttribute('data-value')).toBe('');
  });

  it('flips the panel inward and upward when it would leave the window', () => {
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect');
    let mode: 'wide' | 'tall' = 'wide';
    rect.mockImplementation(function (this: HTMLElement) {
      const end = this.classList.contains('right-0');
      const above = this.classList.contains('bottom-full');
      const wide = mode === 'wide';
      const left = 20;
      const top = 20;
      const width = wide ? 200 : 20;
      const height = wide ? 20 : 200;
      const right = wide && !end ? window.innerWidth + 40 : left + width;
      const bottom = !wide && !above ? window.innerHeight + 40 : top + height;
      return {
        x: left,
        y: top,
        top,
        left,
        right,
        bottom,
        width,
        height,
        toJSON() {
          return {};
        },
      };
    });
    try {
      renderMenu('');
      fireEvent.click(trigger());
      const listbox = screen.getByRole('listbox');
      expect(listbox.className).toContain('absolute');
      expect(listbox.className).toContain('right-0');
      expect(listbox.className).toContain('top-full');
      expect(listbox.style.left).toBe('');
      mode = 'tall';
      fireEvent(window, new Event('scroll'));
      expect(screen.getByRole('listbox').className).toContain('right-0');
      expect(screen.getByRole('listbox').className).toContain('top-full');
      fireEvent(window, new Event('resize'));
      const flipped = screen.getByRole('listbox');
      expect(flipped.className).toContain('left-0');
      expect(flipped.className).toContain('bottom-full');
      expect(flipped.style.left).toBe('');
    } finally {
      rect.mockRestore();
    }
  });

  it('settles after one placement when the measured rect depends on the alignment class', () => {
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect');
    let measures = 0;
    rect.mockImplementation(function (this: HTMLElement) {
      if (this.getAttribute('role') === 'listbox') measures += 1;
      const end = this.classList.contains('right-0');
      const above = this.classList.contains('bottom-full');
      return {
        x: 0,
        y: 0,
        top: 20,
        left: 20,
        right: end ? 40 : window.innerWidth + 40,
        bottom: above ? 40 : window.innerHeight + 40,
        width: 200,
        height: 200,
        toJSON() {
          return {};
        },
      };
    });
    try {
      renderMenu('');
      fireEvent.click(trigger());
      expect(measures).toBe(2);
      const tokens = screen.getByRole('listbox').className.split(/\s+/);
      expect(tokens).toContain('right-0');
      expect(tokens).toContain('bottom-full');
      expect(tokens).not.toContain('left-0');
      expect(tokens).not.toContain('top-full');
    } finally {
      rect.mockRestore();
    }
  });

  it('pins the panel inside the window when flipping still overflows', () => {
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect');
    rect.mockReturnValue({
      x: 0,
      y: 0,
      top: -40,
      left: -40,
      right: window.innerWidth + 80,
      bottom: window.innerHeight + 80,
      width: window.innerWidth + 120,
      height: window.innerHeight + 120,
      toJSON() {
        return {};
      },
    });
    try {
      renderMenu('');
      fireEvent.click(trigger());
      const listbox = screen.getByRole('listbox');
      expect(listbox.className).toContain('fixed');
      expect(listbox.className).not.toContain('absolute');
      expect(listbox.classList.contains('min-w-[max(100%,14.5rem)]')).toBe(false);
      expect(listbox.style.left).toBe('8px');
      expect(listbox.style.top).toBe('8px');
      expect(listbox.style.width).toBe(`${window.innerWidth - 16}px`);
      expect(listbox.style.bottom).toBe('8px');
      expect(listbox.style.right).toBe('');
      expect(listbox.style.overflowY).toBe('');
      expect(listbox.querySelector('[data-scrollport]')).not.toBeNull();
      fireEvent(window, new Event('resize'));
      expect(listbox.style.left).toBe('8px');
    } finally {
      rect.mockRestore();
    }
  });

  it.each([
    { height: 240, bottom: '120px', scrolling: false },
    { height: 440, bottom: '8px', scrolling: true },
  ])(
    'uses the wrapped height $height after narrowing the panel to decide its bottom and scrollport',
    ({ height, bottom, scrolling }) => {
      const previousWidth = window.innerWidth;
      const previousHeight = window.innerHeight;
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 200 });
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: 400 });
      const measuredWidths: string[] = [];
      const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect');
      rect.mockImplementation(function (this: HTMLElement): DOMRect {
        const panel = this.getAttribute('role') === 'listbox';
        if (panel) measuredWidths.push(this.style.width);
        const narrowed =
          panel &&
          this.style.width === '184px' &&
          !this.classList.contains('min-w-[max(100%,14.5rem)]');
        if (narrowed) {
          expect(this.classList.contains('fixed')).toBe(true);
          expect(this.classList.contains('absolute')).toBe(false);
          expect(this.style.left).toBe('8px');
          expect(this.style.top).toBe('40px');
          expect(this.style.bottom).toBe('');
        }
        const width = panel ? (narrowed ? 184 : 320) : 100;
        const measuredHeight = panel ? (narrowed ? height : 120) : 44;
        return {
          x: 8,
          y: 40,
          top: 40,
          left: 8,
          right: 8 + width,
          bottom: 40 + measuredHeight,
          width,
          height: measuredHeight,
          toJSON() {
            return {};
          },
        };
      });
      try {
        render(
          <FilterMenu
            label="Name"
            value=""
            allLabel="All"
            options={[
              { value: '', label: 'All', swatch: null },
              { value: 'one', label: 'A shop with a long name that wraps', swatch: null },
              { value: 'two', label: 'Another shop with a long name that wraps', swatch: null },
            ]}
            onChange={vi.fn()}
          />,
        );
        fireEvent.click(screen.getByRole('combobox', { name: 'Name' }));
        const listbox = screen.getByRole('listbox');
        expect(listbox.style.width).toBe('184px');
        expect(listbox.style.top).toBe('40px');
        expect(listbox.style.bottom).toBe(bottom);
        expect(listbox.querySelector('[data-scrollport]') !== null).toBe(scrolling);
        expect(measuredWidths).toEqual(['', '', '184px']);
      } finally {
        rect.mockRestore();
        Object.defineProperty(window, 'innerWidth', { configurable: true, value: previousWidth });
        Object.defineProperty(window, 'innerHeight', { configurable: true, value: previousHeight });
      }
    },
  );

  it('reveals options above and below the pinned scrollport on keyboard movement', () => {
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect');
    rect.mockImplementation(function (this: HTMLElement): DOMRect {
      let top = -40;
      let height = window.innerHeight + 120;
      if (this.hasAttribute('data-scrollport')) {
        top = 100;
        height = 100;
      } else if (this.getAttribute('role') === 'option') {
        const port = this.closest('[data-scrollport]');
        const index = options.findIndex((option) => option.value === this.dataset['value']);
        top = 112 + index * 60 - (port instanceof HTMLElement ? port.scrollTop : 0);
        height = 44;
      }
      return {
        x: 0,
        y: top,
        top,
        left: -40,
        right: window.innerWidth + 80,
        bottom: top + height,
        width: window.innerWidth + 120,
        height,
        toJSON() {
          return {};
        },
      };
    });
    try {
      renderMenu('');
      fireEvent.click(trigger());
      const listbox = screen.getByRole('listbox');
      const port = listbox.querySelector('[data-scrollport]');
      if (!(port instanceof HTMLElement)) throw new Error('missing menu scrollport');
      expect(port.scrollTop).toBe(0);
      fireEvent.keyDown(trigger(), { key: 'End' });
      const options = within(listbox).getAllByRole('option');
      const last = options[options.length - 1];
      if (last === undefined) throw new Error('missing last option');
      expect(trigger().getAttribute('aria-activedescendant')).toBe(last.id);
      expect(port.scrollTop).toBeGreaterThan(0);
      expect(last.getBoundingClientRect().bottom).toBeLessThanOrEqual(
        port.getBoundingClientRect().bottom,
      );
      const afterEnd = port.scrollTop;
      fireEvent.keyDown(trigger(), { key: 'Home' });
      const first = options[0];
      if (first === undefined) throw new Error('missing first option');
      expect(trigger().getAttribute('aria-activedescendant')).toBe(first.id);
      expect(port.scrollTop).toBeLessThan(afterEnd);
      expect(first.getBoundingClientRect().top).toBeGreaterThanOrEqual(
        port.getBoundingClientRect().top,
      );
    } finally {
      rect.mockRestore();
    }
  });

  it('reveals the selected option each time a pinned scrolling menu opens', () => {
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect');
    rect.mockImplementation(function (this: HTMLElement): DOMRect {
      let top = -40;
      let height = window.innerHeight + 120;
      if (this.hasAttribute('data-scrollport')) {
        top = 100;
        height = 100;
      } else if (this.getAttribute('role') === 'option') {
        const port = this.closest('[data-scrollport]');
        const index = options.findIndex((option) => option.value === this.dataset['value']);
        top = 112 + index * 60 - (port instanceof HTMLElement ? port.scrollTop : 0);
        height = 44;
      }
      return {
        x: 0,
        y: top,
        top,
        left: -40,
        right: window.innerWidth + 80,
        bottom: top + height,
        width: window.innerWidth + 120,
        height,
        toJSON() {
          return {};
        },
      };
    });
    try {
      renderMenu('daily');
      for (let count = 0; count < 2; count += 1) {
        fireEvent.click(trigger());
        const listbox = screen.getByRole('listbox');
        const port = listbox.querySelector('[data-scrollport]');
        if (!(port instanceof HTMLElement)) throw new Error('missing menu scrollport');
        const selected = within(listbox).getByRole('option', { selected: true });
        expect(trigger().getAttribute('aria-activedescendant')).toBe(selected.id);
        expect(port.scrollTop).toBeGreaterThan(0);
        expect(selected.getBoundingClientRect().top).toBeGreaterThanOrEqual(
          port.getBoundingClientRect().top,
        );
        expect(selected.getBoundingClientRect().bottom).toBeLessThanOrEqual(
          port.getBoundingClientRect().bottom,
        );
        fireEvent.click(trigger());
      }
    } finally {
      rect.mockRestore();
    }
  });

  it('uses fewer columns when the window cannot fit eight-row columns', () => {
    const previous = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 200 });
    try {
      const rows: MenuOption[] = [{ value: '', label: 'All', swatch: null }];
      for (let index = 1; index < 57; index += 1) {
        rows.push({ value: `v${index}`, label: `Option ${index}`, swatch: null });
      }
      render(
        <FilterMenu label="Blockchain" value="" allLabel="All" options={rows} onChange={vi.fn()} />,
      );
      fireEvent.click(screen.getByRole('combobox', { name: 'Blockchain' }));
      expect(screen.getByRole('listbox').querySelector('.grid')?.className).toContain(
        'grid-cols-1',
      );
    } finally {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: previous });
    }
  });

  it('leaves the panel unpinned when the flipped rect sits inside the inset', () => {
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect');
    rect.mockReturnValue({
      x: 20,
      y: 20,
      top: 20,
      left: 20,
      right: 220,
      bottom: 80,
      width: 200,
      height: 60,
      toJSON() {
        return {};
      },
    });
    try {
      renderMenu('');
      fireEvent.click(trigger());
      const listbox = screen.getByRole('listbox');
      expect(listbox.className).toContain('absolute');
      expect(listbox.classList.contains('min-w-[max(100%,14.5rem)]')).toBe(true);
      expect(listbox.style.left).toBe('');
      expect(listbox.style.top).toBe('');
      expect(listbox.style.width).toBe('');
    } finally {
      rect.mockRestore();
    }
  });

  it.each([
    { event: 'scroll', edge: 'above' },
    { event: 'scroll', edge: 'below' },
    { event: 'resize', edge: 'above' },
    { event: 'resize', edge: 'below' },
  ])(
    'keeps a fitting panel on the pill when $event moves the pill $edge the window',
    ({ event, edge }) => {
      const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect');
      let pillOffscreen = false;
      rect.mockImplementation(() => {
        const top = pillOffscreen ? (edge === 'above' ? -61 : window.innerHeight) : 20;
        return {
          x: 20,
          y: top,
          top,
          left: 20,
          right: 220,
          bottom: top + 60,
          width: 200,
          height: 60,
          toJSON() {
            return {};
          },
        };
      });
      try {
        renderMenu('');
        fireEvent.click(trigger());
        const listbox = screen.getByRole('listbox');
        expect(listbox.className).toContain('absolute');
        expect(listbox.className).not.toContain('fixed');
        pillOffscreen = true;
        rect.mockClear();
        fireEvent(event === 'scroll' ? document : window, new Event(event));
        expect(rect.mock.contexts).toEqual([trigger()]);
        expect(screen.getByRole('listbox')).toBe(listbox);
        expect(listbox.className).toContain('absolute');
        expect(listbox.className).not.toContain('fixed');
        expect(listbox.style.left).toBe('');
        expect(listbox.style.top).toBe('');
      } finally {
        rect.mockRestore();
      }
    },
  );

  it.each(['scroll', 'resize'])(
    'closes a pinned panel on %s when the pill is below the window',
    (event) => {
      const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect');
      const width = 200;
      const parkedLeft = window.innerWidth - 100;
      rect.mockReturnValue({
        x: parkedLeft,
        y: 40,
        top: 40,
        left: parkedLeft,
        right: parkedLeft + width,
        bottom: 120,
        width,
        height: 80,
        toJSON() {
          return {};
        },
      });
      const focus = document.createElement('button');
      try {
        renderMenu('');
        fireEvent.click(trigger());
        const listbox = screen.getByRole('listbox');
        expect(listbox.className).toContain('fixed');
        const pinnedLeft = `${window.innerWidth - 8 - width}px`;
        expect(listbox.style.left).toBe(pinnedLeft);
        document.body.appendChild(focus);
        focus.focus();
        rect.mockReturnValue({
          x: 40,
          y: window.innerHeight + 20,
          top: window.innerHeight + 20,
          left: 40,
          right: 140,
          bottom: window.innerHeight + 80,
          width: 100,
          height: 60,
          toJSON() {
            return {};
          },
        });
        fireEvent(event === 'scroll' ? document : window, new Event(event));
        expect(screen.queryByRole('listbox')).toBeNull();
        expect(trigger().getAttribute('aria-expanded')).toBe('false');
        expect(document.activeElement).toBe(focus);
      } finally {
        focus.remove();
        rect.mockRestore();
      }
    },
  );

  it('moves a pinned panel when the visible pill moves and the panel still overflows', () => {
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect');
    let top = 40;
    rect.mockImplementation((): DOMRect => ({
      x: -40,
      y: top,
      top,
      left: -40,
      right: 160,
      bottom: top + 80,
      width: 200,
      height: 80,
      toJSON() {
        return {};
      },
    }));
    try {
      renderMenu('');
      fireEvent.click(trigger());
      const listbox = screen.getByRole('listbox');
      expect(listbox.className).toContain('fixed');
      expect(listbox.style.top).toBe('40px');
      top = 80;
      fireEvent(document, new Event('scroll'));
      expect(listbox.className).toContain('fixed');
      expect(listbox.style.top).toBe('80px');
    } finally {
      rect.mockRestore();
    }
  });

  it('returns a pinned panel to the pill when its new position fits', () => {
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect');
    const width = 200;
    const parkedLeft = window.innerWidth - 100;
    rect.mockReturnValue({
      x: parkedLeft,
      y: 40,
      top: 40,
      left: parkedLeft,
      right: parkedLeft + width,
      bottom: 120,
      width,
      height: 80,
      toJSON() {
        return {};
      },
    });
    try {
      renderMenu('');
      fireEvent.click(trigger());
      const listbox = screen.getByRole('listbox');
      expect(listbox.className).toContain('fixed');
      expect(listbox.style.left).toBe(`${window.innerWidth - 8 - width}px`);
      rect.mockReturnValue({
        x: 30,
        y: 40,
        top: 40,
        left: 30,
        right: 230,
        bottom: 120,
        width,
        height: 80,
        toJSON() {
          return {};
        },
      });
      fireEvent(document, new Event('scroll'));
      expect(listbox.className).toContain('absolute');
      expect(listbox.className).not.toContain('fixed');
      expect(listbox.style.left).toBe('');
    } finally {
      rect.mockRestore();
    }
  });

  it('leaves a pinned panel in place when the list itself scrolls', () => {
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect');
    const width = 200;
    const parkedLeft = window.innerWidth - 100;
    rect.mockReturnValue({
      x: parkedLeft,
      y: 40,
      top: 40,
      left: parkedLeft,
      right: parkedLeft + width,
      bottom: 120,
      width,
      height: 80,
      toJSON() {
        return {};
      },
    });
    try {
      renderMenu('');
      fireEvent.click(trigger());
      const listbox = screen.getByRole('listbox');
      const pinnedLeft = listbox.style.left;
      expect(listbox.className).toContain('fixed');
      rect.mockReturnValue({
        x: 30,
        y: 40,
        top: 40,
        left: 30,
        right: 230,
        bottom: 120,
        width,
        height: 80,
        toJSON() {
          return {};
        },
      });
      fireEvent(listbox, new Event('scroll'));
      expect(listbox.className).toContain('fixed');
      expect(listbox.style.left).toBe(pinnedLeft);
    } finally {
      rect.mockRestore();
    }
  });

  it('pulls a panel back from the right edge and from below the window', () => {
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect');
    const width = 200;
    const parkedLeft = window.innerWidth - 100;
    rect.mockReturnValue({
      x: parkedLeft,
      y: 40,
      top: 40,
      left: parkedLeft,
      right: parkedLeft + width,
      bottom: 120,
      width,
      height: 80,
      toJSON() {
        return {};
      },
    });
    try {
      renderMenu('');
      fireEvent.click(trigger());
      const listbox = screen.getByRole('listbox');
      expect(listbox.className).toContain('fixed');
      expect(listbox.querySelector('[data-scrollport]')).toBeNull();
      expect(listbox.style.left).toBe(`${window.innerWidth - 8 - width}px`);
      expect(listbox.style.top).toBe('40px');
      expect(listbox.style.width).toBe(`${width}px`);
      expect(listbox.style.right).toBe('');
      rect.mockImplementation(function (this: HTMLElement) {
        if (this.getAttribute('role') !== 'listbox') {
          return {
            x: 40,
            y: 40,
            top: 40,
            left: 40,
            right: 180,
            bottom: 80,
            width: 140,
            height: 40,
            toJSON() {
              return {};
            },
          };
        }
        return {
          x: 40,
          y: window.innerHeight + 20,
          top: window.innerHeight + 20,
          left: 40,
          right: 140,
          bottom: window.innerHeight + 80,
          width: 100,
          height: 60,
          toJSON() {
            return {};
          },
        };
      });
      fireEvent(window, new Event('resize'));
      expect(listbox.style.top).toBe('8px');
      expect(listbox.style.left).toBe('40px');
      expect(listbox.style.width).toBe('100px');
    } finally {
      rect.mockRestore();
    }
  });

  it('uses the full twelve columns when the window is too short for eight rows', () => {
    const previousWidth = window.innerWidth;
    const previousHeight = window.innerHeight;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 2000 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 80 });
    try {
      const rows: MenuOption[] = [{ value: '', label: 'All', swatch: null }];
      for (let index = 1; index < 57; index += 1) {
        rows.push({ value: `v${index}`, label: `Option ${index}`, swatch: null });
      }
      render(
        <FilterMenu label="Blockchain" value="" allLabel="All" options={rows} onChange={vi.fn()} />,
      );
      fireEvent.click(screen.getByRole('combobox', { name: 'Blockchain' }));
      const tokens =
        screen.getByRole('listbox').querySelector('.grid')?.className.split(/\s+/) ?? [];
      expect(tokens).toContain('grid-cols-12');
      expect(tokens).not.toContain('grid-cols-1');
    } finally {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: previousWidth });
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: previousHeight });
    }
  });

  it('closes when a non-element is the pointer target', () => {
    renderMenu('');
    fireEvent.click(trigger());
    fireEvent.mouseDown(document);
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});
