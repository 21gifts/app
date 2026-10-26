import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShopAccountSuggestions } from '@/components/ShopAccountSuggestions';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const rows = [
  { id: 'acc-luna', username: 'luna', name: 'Luna' },
  { id: 'acc-ada', username: 'ada', name: 'ada' },
];

function renderList(activeIndex: number, disabled: boolean, onPick = vi.fn()) {
  renderWithLocale(
    <ShopAccountSuggestions
      listId="people"
      rows={rows}
      activeIndex={activeIndex}
      disabled={disabled}
      className="list"
      optionId={(index) => `opt-${String(index)}`}
      onPick={onPick}
    />,
  );
  return onPick;
}

afterEach(() => {
  cleanup();
});

describe('ShopAccountSuggestions', () => {
  it('highlights one row and reports a pick without saving', () => {
    const onPick = renderList(0, false);
    const list = screen.getByRole('listbox', { name: 'People' });
    expect(list.id).toBe('people');
    expect(list.className).toContain('list');
    const luna = screen.getByRole('option', { name: '@luna' });
    const ada = screen.getByRole('option', { name: '@ada' });
    expect(luna.id).toBe('opt-0');
    expect(luna.getAttribute('aria-selected')).toBe('true');
    expect(luna.className.includes(' bg-app-hover')).toBe(true);
    expect(luna.textContent).toContain('Luna');
    expect(ada.getAttribute('aria-selected')).toBe('false');
    expect(ada.className.includes(' bg-app-hover')).toBe(false);
    expect(ada.textContent).toBe('@ada');
    fireEvent.mouseDown(luna);
    fireEvent.click(ada);
    expect(onPick).toHaveBeenNthCalledWith(1, 'luna');
    expect(onPick).toHaveBeenNthCalledWith(2, 'ada');
  });

  it('disables every row', () => {
    renderList(1, true);
    const ada = screen.getByRole('option', { name: '@ada' });
    expect(ada.getAttribute('aria-selected')).toBe('true');
    expect(ada.className.includes(' bg-app-hover')).toBe(true);
    expect(ada).toHaveProperty('disabled', true);
    expect(screen.getByRole('option', { name: '@luna' })).toHaveProperty('disabled', true);
  });
});
