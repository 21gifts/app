import { afterEach, describe, expect, it } from 'vitest';
import { bindScrollport, releaseScrollport, syncScrollSurfaces } from '@/lib/scroll-surface';

function port(id: string): HTMLDivElement {
  const el = document.createElement('div');
  el.id = id;
  el.setAttribute('data-scrollport', '');
  document.body.appendChild(el);
  return el;
}

afterEach(() => {
  for (const el of [...document.querySelectorAll('[data-scrollport]')]) {
    releaseScrollport(el as HTMLElement);
  }
  document.body.replaceChildren();
});

describe('scroll surface', () => {
  it('binds once, locks every other port, and restores the previous one', () => {
    const first = port('first');
    const second = port('second');
    bindScrollport(first);
    bindScrollport(first);
    expect(first.hasAttribute('data-scroll-locked')).toBe(false);
    bindScrollport(second);
    expect(first.hasAttribute('data-scroll-locked')).toBe(true);
    expect(second.hasAttribute('data-scroll-locked')).toBe(false);
    releaseScrollport(second);
    expect(first.hasAttribute('data-scroll-locked')).toBe(false);
    expect(second.hasAttribute('data-scroll-locked')).toBe(true);
  });

  it('does not clip the active scrollport', () => {
    const first = port('first');
    first.style.overflow = 'auto';
    bindScrollport(first);
    expect(first.hasAttribute('data-scroll-locked')).toBe(false);
    expect(first.style.overflow).toBe('auto');
  });

  it('ignores a release of an element that was never bound', () => {
    const first = port('first');
    const stranger = document.createElement('div');
    bindScrollport(first);
    releaseScrollport(stranger);
    expect(first.hasAttribute('data-scroll-locked')).toBe(false);
  });

  it('clips a stray scrolling element and grows a textarea', () => {
    const stray = document.createElement('div');
    stray.style.overflow = 'scroll';
    document.body.appendChild(stray);
    const field = document.createElement('textarea');
    document.body.appendChild(field);
    const input = document.createElement('input');
    input.style.overflow = 'auto';
    document.body.appendChild(input);
    const select = document.createElement('select');
    const option = document.createElement('option');
    select.appendChild(option);
    document.body.appendChild(select);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('data-scrollport', '');
    svg.style.overflow = 'auto';
    document.body.appendChild(svg);
    const plain = document.createElement('div');
    document.body.appendChild(plain);
    syncScrollSurfaces();
    expect(stray.style.overflow).toBe('clip');
    expect(field.style.overflow).toBe('clip');
    expect(field.style.height).toBe('');
    const wide = document.createElement('textarea');
    wide.value = 'one long line';
    document.body.appendChild(wide);
    Object.defineProperty(wide, 'clientHeight', { configurable: true, value: 20 });
    Object.defineProperty(wide, 'scrollHeight', { configurable: true, value: 70 });
    syncScrollSurfaces();
    expect(wide.style.height).toBe('70px');
    Object.defineProperty(wide, 'clientHeight', { configurable: true, value: 70 });
    Object.defineProperty(wide, 'scrollHeight', { configurable: true, value: 70 });
    syncScrollSurfaces();
    expect(wide.style.height).toBe('70px');
    field.value = 'one\ntwo\nthree';
    Object.defineProperty(field, 'clientHeight', { configurable: true, value: 20 });
    Object.defineProperty(field, 'scrollHeight', { configurable: true, value: 80 });
    syncScrollSurfaces();
    expect(field.style.height).toBe('80px');
    field.value = '';
    Object.defineProperty(field, 'scrollHeight', { configurable: true, value: 20 });
    syncScrollSurfaces();
    expect(field.style.height).toBe('');
    expect(input.style.overflow).toBe('auto');
    expect(svg.style.overflow).toBe('clip');
    expect(plain.style.overflow).toBe('');
  });

  it('clips horizontal scrolling as well', () => {
    const stray = document.createElement('div');
    stray.style.overflowX = 'overlay';
    document.body.appendChild(stray);
    syncScrollSurfaces();
    expect(stray.style.overflow).toBe('clip');
  });
});
