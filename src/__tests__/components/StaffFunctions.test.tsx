import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StaffFunctions } from '@/components/StaffFunctions';
import { renderWithLocale } from '@/__tests__/render-with-locale';

afterEach(cleanup);

describe('StaffFunctions', () => {
  it('keeps children out of the document while closed', () => {
    renderWithLocale(
      <StaffFunctions>
        <button type="button">Inner action</button>
      </StaffFunctions>,
    );
    expect(screen.queryByRole('button', { name: 'Inner action' })).toBeNull();
    const trigger = screen.getByRole('button', { name: 'Moderator functions' });
    expect(trigger).toBeTruthy();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('toggles children, stays open when a child is clicked, and closes on a second trigger click', () => {
    renderWithLocale(
      <StaffFunctions>
        <button type="button">Inner action</button>
      </StaffFunctions>,
    );
    const trigger = screen.getByRole('button', { name: 'Moderator functions' });
    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('button', { name: 'Inner action' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Inner action' }));
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('button', { name: 'Inner action' })).toBeTruthy();
    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('button', { name: 'Inner action' })).toBeNull();
  });

  it('stops click and keydown from reaching a parent', () => {
    const parentClick = vi.fn();
    const parentKey = vi.fn();
    renderWithLocale(
      <div onClick={parentClick} onKeyDown={parentKey}>
        <StaffFunctions>
          <button type="button">Inner action</button>
        </StaffFunctions>
      </div>,
    );
    fireEvent.click(screen.getByTestId('staff-functions'));
    fireEvent.keyDown(screen.getByTestId('staff-functions'), { key: 'Enter' });
    expect(parentClick).not.toHaveBeenCalled();
    expect(parentKey).not.toHaveBeenCalled();
  });

  it('uses the German accessible name', () => {
    renderWithLocale(
      <StaffFunctions>
        <button type="button">Inner action</button>
      </StaffFunctions>,
      'de',
    );
    expect(screen.getByRole('button', { name: 'Moderatorenfunktionen' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Moderator functions' })).toBeNull();
  });
});
