import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MacChromiumAppPasskeyView } from '@/components/MacChromiumAppPasskeyView';
import { renderWithLocale } from '@/__tests__/render-with-locale';

afterEach(() => {
  cleanup();
});

describe('MacChromiumAppPasskeyView', () => {
  it('renders the English heading and body without buttons', () => {
    renderWithLocale(<MacChromiumAppPasskeyView />);
    expect(
      screen.getByRole('heading', { name: 'Passkeys do not work in the Chrome app' }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'The Mac passkey does not work in the installed Chrome app. Open 21.gifts in a Chrome tab, or add it to the Dock from Safari (File → Add to Dock).',
      ),
    ).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
