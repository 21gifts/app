import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import RulesSetupPage from '@/app/setup/rules/page';
import { RULES_CHAPTER_IDS } from '@/lib/rules-chapters';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/components/RulesSetup', () => ({
  RulesSetup: ({ chapters }: { chapters: ReactNode[] }) => (
    <div data-testid="rules-setup">{chapters}</div>
  ),
}));

vi.mock('@/components/OnboardingGate', () => ({
  OnboardingGate: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('@/components/SignedInChrome', () => ({
  SignedInChrome: () => <div data-testid="signed-in-chrome" />,
}));

vi.mock('@/components/RulesDocument', () => ({
  RulesDocument: () => <div data-testid="rules-document" />,
}));

vi.mock('@/lib/request-locale', () => ({
  getRequestLocale: vi.fn(async () => 'en' as const),
}));

afterEach(cleanup);

describe('RulesSetupPage', () => {
  it('renders the rules setup card', async () => {
    renderWithLocale(await RulesSetupPage());
    expect(screen.getByTestId('rules-setup')).toBeTruthy();
    expect(screen.getByTestId('signed-in-chrome')).toBeTruthy();
    expect(screen.getAllByTestId('rules-document')).toHaveLength(RULES_CHAPTER_IDS.length);
  });
});
