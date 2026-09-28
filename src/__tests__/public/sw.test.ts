import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('public/sw.js', 'utf8');

describe('service worker Sunday push', () => {
  it('drops a public push on the device Sunday and still shows a private message', () => {
    const guard = source.indexOf("payload.type !== 'conversation'");
    const show = source.indexOf('showNotification');
    expect(source).toContain('function isDeviceSunday()');
    expect(source).toContain("weekday: 'short'");
    expect(source).toContain("tag: 'sunday-quiet'");
    expect(guard).toBeGreaterThan(-1);
    expect(show).toBeGreaterThan(guard);
  });
});

describe('service worker notification click', () => {
  it('posts 21gifts-push-open before navigate', () => {
    expect(source).toContain('21gifts-push-open');
    expect(source).toContain('postMessage');
    const click = source.indexOf("addEventListener('notificationclick'");
    expect(click).toBeGreaterThan(-1);
    expect(source).toContain(".open('21gifts-push-open')");
    expect(source).toContain('client.focused === true');
    expect(source).toContain('focused.then(deliver, deliver)');
    const remembered = source.indexOf('rememberPushOpen(path)', click);
    const focus = source.indexOf('client.focus()', click);
    const post = source.indexOf('client.postMessage', click);
    const nav = source.indexOf('client.navigate', click);
    expect(remembered).toBeGreaterThan(click);
    expect(focus).toBeGreaterThan(remembered);
    expect(post).toBeGreaterThan(focus);
    expect(nav).toBeGreaterThan(post);
  });
});
