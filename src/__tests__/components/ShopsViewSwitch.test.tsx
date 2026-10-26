import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShopsViewSwitch } from '@/components/ShopsViewSwitch';
import { renderWithLocale } from '@/__tests__/render-with-locale';

afterEach(cleanup);

describe('ShopsViewSwitch', () => {
  it('marks the selected view and reports a click', () => {
    const onChange = vi.fn();
    renderWithLocale(<ShopsViewSwitch value="list" onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'List', pressed: true })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Map' }));
    expect(onChange).toHaveBeenCalledWith('map');
    fireEvent.click(screen.getByRole('button', { name: 'Table' }));
    expect(onChange).toHaveBeenCalledWith('table');
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    expect(onChange).toHaveBeenCalledWith('post');
  });
});
