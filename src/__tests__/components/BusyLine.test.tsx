import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { BusyLine } from '@/components/BusyLine';

afterEach(cleanup);

describe('BusyLine', () => {
  it('is a status line with a hidden spinner and the sentence', () => {
    render(<BusyLine label="Saving…" />);
    const line = screen.getByRole('status');
    expect(line.textContent).toBe('Saving…');
    const spinner = line.querySelector('svg');
    expect(spinner?.getAttribute('aria-hidden')).toBe('true');
    expect(spinner?.getAttribute('class')).toContain('animate-spin');
  });
});
