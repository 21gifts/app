import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FilterMenu, type MenuOption } from '@/app/(marketing)/FilterMenu';

const optionClass = 'min-h-11 min-w-11 border-0 bg-transparent p-0 text-left font-inherit';

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
    expect(button.textContent).toBe('All');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

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
    expect(button.textContent).toBe('All');
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
});
