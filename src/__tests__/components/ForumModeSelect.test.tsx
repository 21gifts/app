import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ForumModeSelect, type ForumModeSelectOption } from '@/components/ForumModeSelect';

afterEach(cleanup);

const OPTIONS: readonly ForumModeSelectOption<'active' | 'unpaid' | 'all' | 'popular'>[] = [
  { value: 'active', label: 'Active' },
  { value: 'unpaid', label: 'No gifts yet' },
  { value: 'all', label: 'All' },
  { value: 'popular', label: 'Most popular' },
];

function renderSelect(
  props: {
    value?: 'active' | 'unpaid' | 'all' | 'popular';
    options?: readonly ForumModeSelectOption<'active' | 'unpaid' | 'all' | 'popular'>[];
    onChange?: (value: 'active' | 'unpaid' | 'all' | 'popular') => void;
    ariaLabel?: string;
  } = {},
): ReturnType<typeof render> {
  return render(
    <ForumModeSelect
      value={props.value ?? 'active'}
      options={props.options ?? OPTIONS}
      onChange={props.onChange ?? (() => undefined)}
      ariaLabel={props.ariaLabel ?? 'Forum view'}
    />,
  );
}

describe('ForumModeSelect', () => {
  it('is closed by default with no listbox and the selected label on the trigger', () => {
    renderSelect();
    const trigger = screen.getByRole('combobox', { name: 'Forum view' });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.textContent).toContain('Active');
  });

  it('opens on click and closes when the trigger is clicked again', () => {
    renderSelect();
    const trigger = screen.getByRole('combobox', { name: 'Forum view' });
    fireEvent.click(trigger);
    expect(screen.getByRole('listbox')).toBeTruthy();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(trigger);
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('selecting a different option calls onChange, closes, and focuses the trigger', () => {
    const onChange = vi.fn();
    renderSelect({ onChange });
    const trigger = screen.getByRole('combobox', { name: 'Forum view' });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('option', { name: 'All' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('all');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('selecting the current value still calls onChange, then closes and focuses the trigger', () => {
    const onChange = vi.fn();
    renderSelect({ onChange, value: 'active' });
    const trigger = screen.getByRole('combobox', { name: 'Forum view' });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('option', { name: 'Active' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('active');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('Escape closes and focuses the trigger even when the keydown target is outside', () => {
    renderSelect();
    const trigger = screen.getByRole('combobox', { name: 'Forum view' });
    fireEvent.click(trigger);
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('Tab closes even when the keydown target is outside', () => {
    const onChange = vi.fn();
    renderSelect({ onChange });
    fireEvent.click(screen.getByRole('combobox', { name: 'Forum view' }));
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.keyDown(document.body, { key: 'Tab' });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('mousedown outside closes; mousedown inside the wrapper does not', () => {
    renderSelect();
    const trigger = screen.getByRole('combobox', { name: 'Forum view' });
    fireEvent.click(trigger);
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.mouseDown(trigger);
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('option mousedown preventDefault and the following click still selects', () => {
    const onChange = vi.fn();
    renderSelect({ onChange });
    const trigger = screen.getByRole('combobox', { name: 'Forum view' });
    fireEvent.click(trigger);
    const option = screen.getByRole('option', { name: 'Most popular' });
    expect(fireEvent.mouseDown(option)).toBe(false);
    fireEvent.click(option);
    expect(onChange).toHaveBeenCalledWith('popular');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('ArrowDown and ArrowUp wrap while open; Home and End jump; Enter selects', () => {
    const onChange = vi.fn();
    renderSelect({ onChange, value: 'active' });
    const trigger = screen.getByRole('combobox', { name: 'Forum view' });
    fireEvent.click(trigger);
    const listbox = screen.getByRole('listbox');
    fireEvent.keyDown(listbox, { key: 'End' });
    expect(listbox.getAttribute('aria-activedescendant')).toBe('forum-mode-option-popular');
    fireEvent.keyDown(listbox, { key: 'ArrowDown' });
    expect(listbox.getAttribute('aria-activedescendant')).toBe('forum-mode-option-active');
    fireEvent.keyDown(listbox, { key: 'ArrowUp' });
    expect(listbox.getAttribute('aria-activedescendant')).toBe('forum-mode-option-popular');
    fireEvent.keyDown(listbox, { key: 'Home' });
    expect(listbox.getAttribute('aria-activedescendant')).toBe('forum-mode-option-active');
    fireEvent.keyDown(listbox, { key: 'End' });
    fireEvent.keyDown(listbox, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('popular');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('Space on the highlighted option selects it, closes, and focuses the trigger', () => {
    const onChange = vi.fn();
    renderSelect({ onChange, value: 'active' });
    const trigger = screen.getByRole('combobox', { name: 'Forum view' });
    fireEvent.click(trigger);
    const listbox = screen.getByRole('listbox');
    fireEvent.keyDown(listbox, { key: 'End' });
    fireEvent.keyDown(listbox, { key: ' ' });
    expect(onChange).toHaveBeenCalledWith('popular');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('ArrowDown ArrowUp Home End Enter Space outside the wrapper do not change highlight or call onChange', () => {
    const onChange = vi.fn();
    renderSelect({ onChange, value: 'active' });
    fireEvent.click(screen.getByRole('combobox', { name: 'Forum view' }));
    const listbox = screen.getByRole('listbox');
    expect(listbox.getAttribute('aria-activedescendant')).toBe('forum-mode-option-active');
    fireEvent.keyDown(document.body, { key: 'ArrowDown' });
    fireEvent.keyDown(document.body, { key: 'ArrowUp' });
    fireEvent.keyDown(document.body, { key: 'Home' });
    fireEvent.keyDown(document.body, { key: 'End' });
    fireEvent.keyDown(document.body, { key: 'Enter' });
    fireEvent.keyDown(document.body, { key: ' ' });
    expect(listbox.getAttribute('aria-activedescendant')).toBe('forum-mode-option-active');
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('listbox')).toBeTruthy();
  });

  it('ArrowDown on the closed trigger opens and highlights the current value', () => {
    renderSelect({ value: 'all' });
    const trigger = screen.getByRole('combobox', { name: 'Forum view' });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(screen.getByRole('listbox')).toBeTruthy();
    expect(trigger.getAttribute('aria-activedescendant')).toBe('forum-mode-option-all');
    expect(screen.getByRole('listbox').getAttribute('aria-activedescendant')).toBe(
      'forum-mode-option-all',
    );
  });

  it('Enter on the closed trigger opens and highlights the current value', () => {
    renderSelect({ value: 'popular' });
    const trigger = screen.getByRole('combobox', { name: 'Forum view' });
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(screen.getByRole('listbox')).toBeTruthy();
    expect(trigger.getAttribute('aria-activedescendant')).toBe('forum-mode-option-popular');
  });

  it('Space on the closed trigger opens and highlights the current value', () => {
    renderSelect({ value: 'unpaid' });
    const trigger = screen.getByRole('combobox', { name: 'Forum view' });
    fireEvent.keyDown(trigger, { key: ' ' });
    expect(screen.getByRole('listbox')).toBeTruthy();
    expect(trigger.getAttribute('aria-activedescendant')).toBe('forum-mode-option-unpaid');
  });

  it('Tab on a closed trigger leaves the listbox absent', () => {
    renderSelect();
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Forum view' }), { key: 'Tab' });
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('ArrowDown on the open trigger keeps the listbox open', () => {
    renderSelect();
    const trigger = screen.getByRole('combobox', { name: 'Forum view' });
    fireEvent.click(trigger);
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(screen.getByRole('listbox')).toBeTruthy();
  });

  it('badge greater than 0 shows the count on the closed trigger and names the open option', () => {
    renderSelect({
      options: [
        { value: 'active', label: 'Active' },
        {
          value: 'unpaid',
          label: 'No gifts yet',
          badge: 3,
          badgeAriaLabel: 'No gifts yet, 3 new',
        },
        { value: 'all', label: 'All' },
        { value: 'popular', label: 'Most popular' },
      ],
    });
    const trigger = screen.getByRole('combobox', { name: 'Forum view' });
    expect(trigger.textContent).toContain('Active');
    expect(trigger.textContent).toContain('3');
    expect(screen.getByText('3').getAttribute('aria-hidden')).toBe('true');
    expect(screen.queryByRole('combobox', { name: 'No gifts yet, 3 new' })).toBeNull();
    fireEvent.click(trigger);
    const unpaid = screen.getByRole('option', { name: 'No gifts yet, 3 new' });
    expect(unpaid).toBeTruthy();
    expect(unpaid.getAttribute('aria-label')).toBe('No gifts yet, 3 new');
  });

  it('omits the chip at badge 0 and when badge is absent', () => {
    renderSelect({
      options: [
        { value: 'active', label: 'Active', badge: 0 },
        { value: 'unpaid', label: 'No gifts yet' },
        { value: 'all', label: 'All' },
        { value: 'popular', label: 'Most popular' },
      ],
    });
    const trigger = screen.getByRole('combobox', { name: 'Forum view' });
    expect(trigger.textContent).toBe('Active');
    fireEvent.click(trigger);
    const unpaid = screen.getByRole('option', { name: /^No gifts yet$/ });
    expect(unpaid.getAttribute('aria-label')).toBeNull();
    expect(unpaid.textContent).not.toContain('0');
    const active = screen.getByRole('option', { name: 'Active' });
    expect(active.getAttribute('aria-label')).toBeNull();
  });

  it('empty badgeAriaLabel with badge greater than 0 still shows the chip and uses the visible label', () => {
    renderSelect({
      options: [
        { value: 'active', label: 'Active' },
        { value: 'unpaid', label: 'No gifts yet', badge: 2, badgeAriaLabel: '' },
        { value: 'all', label: 'All' },
        { value: 'popular', label: 'Most popular' },
      ],
    });
    const trigger = screen.getByRole('combobox', { name: 'Forum view' });
    expect(trigger.textContent).toContain('2');
    fireEvent.click(trigger);
    const unpaid = screen.getByRole('option', { name: /^No gifts yet$/ });
    expect(unpaid.getAttribute('aria-label')).toBeNull();
    expect(unpaid.textContent).toContain('2');
  });

  it('missing badgeAriaLabel with badge greater than 0 still shows the chip and uses the visible label', () => {
    renderSelect({
      options: [
        { value: 'active', label: 'Active' },
        { value: 'unpaid', label: 'No gifts yet', badge: 4 },
        { value: 'all', label: 'All' },
        { value: 'popular', label: 'Most popular' },
      ],
    });
    expect(screen.getByRole('combobox', { name: 'Forum view' }).textContent).toContain('4');
    fireEvent.click(screen.getByRole('combobox', { name: 'Forum view' }));
    const unpaid = screen.getByRole('option', { name: /^No gifts yet$/ });
    expect(unpaid.getAttribute('aria-label')).toBeNull();
    expect(unpaid.textContent).toContain('4');
  });

  it('an option passed without a badge renders no chip', () => {
    renderSelect();
    fireEvent.click(screen.getByRole('combobox', { name: 'Forum view' }));
    expect(screen.getByRole('option', { name: 'Active' }).textContent).toBe('Active');
    expect(screen.getByRole('option', { name: 'All' }).textContent).toBe('All');
    expect(screen.getByRole('option', { name: 'Most popular' }).textContent).toBe('Most popular');
  });

  it('selected option has aria-selected true, font-medium, and a Check; an unselected option does not', () => {
    renderSelect({ value: 'all' });
    fireEvent.click(screen.getByRole('combobox', { name: 'Forum view' }));
    const selected = screen.getByRole('option', { name: 'All' });
    const unselected = screen.getByRole('option', { name: 'Active' });
    expect(selected.getAttribute('aria-selected')).toBe('true');
    expect(selected.className).toContain('font-medium');
    expect(selected.querySelector('svg')).toBeTruthy();
    expect(unselected.getAttribute('aria-selected')).toBe('false');
    expect(unselected.className).not.toContain('font-medium');
    expect(unselected.querySelector('svg')).toBeNull();
  });

  it('option ids are forum-mode-option-${value} and the listbox id is forum-mode-listbox', () => {
    renderSelect();
    fireEvent.click(screen.getByRole('combobox', { name: 'Forum view' }));
    expect(screen.getByRole('listbox').getAttribute('id')).toBe('forum-mode-listbox');
    expect(screen.getByRole('option', { name: 'Active' }).getAttribute('id')).toBe(
      'forum-mode-option-active',
    );
    expect(screen.getByRole('option', { name: /^No gifts yet$/ }).getAttribute('id')).toBe(
      'forum-mode-option-unpaid',
    );
    expect(screen.getByRole('option', { name: 'All' }).getAttribute('id')).toBe(
      'forum-mode-option-all',
    );
    expect(screen.getByRole('option', { name: 'Most popular' }).getAttribute('id')).toBe(
      'forum-mode-option-popular',
    );
  });

  it('unmount while open runs effect cleanup', () => {
    const { unmount } = renderSelect();
    fireEvent.click(screen.getByRole('combobox', { name: 'Forum view' }));
    expect(screen.getByRole('listbox')).toBeTruthy();
    unmount();
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.mouseDown(document.body);
  });
});
