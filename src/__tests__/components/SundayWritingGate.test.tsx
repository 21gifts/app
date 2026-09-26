import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SundayWritingGate } from '@/components/SundayWritingGate';
import { deviceTimeZoneHeader } from '@/lib/api';
import { renderWithLocale } from '@/__tests__/render-with-locale';

afterEach(() => {
  cleanup();
  delete document.documentElement.dataset['localSunday'];
});

describe('SundayWritingGate', () => {
  it('keeps the field when it is not Sunday', () => {
    document.documentElement.dataset['localSunday'] = '0';
    renderWithLocale(
      <SundayWritingGate>
        <textarea aria-label="Your message" />
      </SundayWritingGate>,
    );
    expect(screen.getByLabelText('Your message')).toBeTruthy();
    expect(screen.queryByText('Writing is paused on Sunday.')).toBeNull();
  });

  it('replaces the field with the Sunday sentence', () => {
    document.documentElement.dataset['localSunday'] = '1';
    renderWithLocale(
      <SundayWritingGate>
        <textarea aria-label="Your message" />
      </SundayWritingGate>,
    );
    expect(screen.getByText('Writing is paused on Sunday.')).toBeTruthy();
    cleanup();
    renderWithLocale(
      <SundayWritingGate notice="zap">
        <button type="button">Send Bitcoin</button>
      </SundayWritingGate>,
    );
    expect(screen.getByText('Zapping is paused on Sunday.')).toBeTruthy();
    expect(document.querySelector('[data-sunday-writing="paused"]')).not.toBeNull();
  });
});

describe('deviceTimeZoneHeader', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends the device zone in the browser', () => {
    expect(deviceTimeZoneHeader()).toEqual({
      'Time-Zone': Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  });

  it('omits a blank zone', () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
      locale: 'en-US',
      calendar: 'gregory',
      numberingSystem: 'latn',
      timeZone: '   ',
    });
    expect(deviceTimeZoneHeader()).toEqual({});
  });

  it('omits the header when Intl throws', () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
      throw new Error('no intl');
    });
    expect(deviceTimeZoneHeader()).toEqual({});
  });
});
