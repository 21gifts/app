import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CannotReceiveLabel } from '@/components/CannotReceiveLabel';
import { renderWithLocale } from '@/__tests__/render-with-locale';

afterEach(() => {
  cleanup();
});

describe('CannotReceiveLabel', () => {
  it('renders the catalog label as small muted text', () => {
    renderWithLocale(<CannotReceiveLabel />);
    const label = screen.getByText("Can't receive yet");
    expect(label.tagName).toBe('SPAN');
    expect(label.className).toContain('text-app-muted');
    expect(label.hasAttribute('data-cannot-receive')).toBe(true);
  });
});
