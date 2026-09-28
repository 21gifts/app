import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('public/sw.js', 'utf8');

describe('service worker Sunday push', () => {
  it('drops a public push on the device Sunday and still shows a private message', () => {
    const guard = source.indexOf("payload.type !== 'conversation'");
    const show = source.indexOf('showNotification');
    expect(source).toContain('function isDeviceSunday()');
    expect(source).toContain("weekday: 'short'");
    expect(guard).toBeGreaterThan(-1);
    expect(show).toBeGreaterThan(guard);
  });
});
