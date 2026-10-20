import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MoveFundsLink } from '@/components/MoveFundsLink';
import { requestMoveFunds } from '@/lib/move-funds';

const params = vi.hoisted(() => ({ value: new URLSearchParams() }));

vi.mock('next/navigation', () => ({ useSearchParams: () => params.value }));
vi.mock('@/lib/move-funds', () => ({ requestMoveFunds: vi.fn() }));

beforeEach(() => {
  vi.mocked(requestMoveFunds).mockReset();
});

afterEach(cleanup);

describe('MoveFundsLink', () => {
  it('asks for the flow when the page has ?move=1', () => {
    params.value = new URLSearchParams('move=1');
    const { container } = render(<MoveFundsLink />);
    expect(container.firstChild).toBeNull();
    expect(requestMoveFunds).toHaveBeenCalledTimes(1);
    expect(requestMoveFunds).toHaveBeenCalledWith('link');
  });

  it('does nothing without it or with another value', () => {
    params.value = new URLSearchParams('move=0');
    render(<MoveFundsLink />);
    params.value = new URLSearchParams('');
    render(<MoveFundsLink />);
    expect(requestMoveFunds).not.toHaveBeenCalled();
  });
});
