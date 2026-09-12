import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TrustChainDiagram } from '@/components/TrustChainDiagram';
import type { TrustChain } from '@/lib/api-types';
import { renderWithLocale } from '@/__tests__/render-with-locale';

afterEach(cleanup);

const CHAIN: TrustChain = {
  nodes: [
    { id: 'f', name: 'Cyrill', role: 'founder' },
    { id: 'm', name: 'Severin', role: 'moderator' },
    { id: 'ada', name: 'Ada', role: 'verified' },
    { id: 'bob', name: null, role: 'verified' },
    { id: 'empty', name: '', role: 'verified' },
  ],
  edges: [
    { from: 'f', to: 'm', kind: 'moderator_appoint' },
    { from: 'm', to: 'ada', kind: 'verify' },
    { from: 'm', to: 'bob', kind: 'moderator_confirm' },
    { from: 'm', to: 'ghost', kind: 'verify' },
  ],
};

describe('TrustChainDiagram', () => {
  it('renders named nodes, unnamed fallback, test ids, member links, and edge labels', () => {
    renderWithLocale(<TrustChainDiagram chain={CHAIN} />);
    expect(screen.getByRole('img', { name: 'Trust Chain diagram' })).toBeTruthy();
    expect(screen.getByTestId('trust-node-f').getAttribute('href')).toBe('/members/f');
    expect(screen.getByTestId('trust-node-m').getAttribute('href')).toBe('/members/m');
    expect(screen.getByTestId('trust-node-ada').getAttribute('href')).toBe('/members/ada');
    expect(screen.getByTestId('trust-node-bob').getAttribute('href')).toBe('/members/bob');
    expect(screen.getByTestId('trust-node-empty').getAttribute('href')).toBe('/members/empty');
    expect(screen.getByRole('link', { name: /Cyrill/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Severin/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Ada/ })).toBeTruthy();
    expect(screen.getAllByRole('link', { name: /Unnamed/ })).toHaveLength(2);
    expect(screen.getByText('verified')).toBeTruthy();
    expect(screen.getByText('confirmed')).toBeTruthy();
    expect(screen.getByText('appointed')).toBeTruthy();
    expect(screen.queryByTestId('trust-node-ghost')).toBeNull();
  });
});
