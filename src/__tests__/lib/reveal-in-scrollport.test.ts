import { describe, expect, it } from 'vitest';
import { revealInScrollport } from '@/lib/reveal-in-scrollport';

function rect(top: number, height: number): DOMRect {
  return {
    top,
    bottom: top + height,
    left: 0,
    right: 0,
    width: 0,
    height,
    x: 0,
    y: top,
    toJSON: () => ({}),
  };
}

describe('revealInScrollport', () => {
  it('aligns a target taller than the scroller to the bottom margin', () => {
    const scroller = document.createElement('div');
    const target = document.createElement('textarea');
    scroller.getBoundingClientRect = () => rect(0, 100);
    target.getBoundingClientRect = () => rect(0, 90);
    revealInScrollport(scroller, target);
    expect(scroller.scrollTop).toBe(2);
  });

  it('scrolls a bottom overflow up into the margin', () => {
    const scroller = document.createElement('div');
    const target = document.createElement('input');
    scroller.getBoundingClientRect = () => rect(0, 100);
    target.getBoundingClientRect = () => rect(80, 40);
    revealInScrollport(scroller, target);
    expect(scroller.scrollTop).toBe(32);
  });

  it('scrolls a top overflow down into the margin', () => {
    const scroller = document.createElement('div');
    const target = document.createElement('select');
    scroller.scrollTop = 100;
    scroller.getBoundingClientRect = () => rect(0, 100);
    target.getBoundingClientRect = () => rect(-20, 30);
    revealInScrollport(scroller, target);
    expect(scroller.scrollTop).toBe(68);
  });

  it('leaves a target that already fits', () => {
    const scroller = document.createElement('div');
    const target = document.createElement('input');
    scroller.scrollTop = 4;
    scroller.getBoundingClientRect = () => rect(0, 100);
    target.getBoundingClientRect = () => rect(20, 40);
    revealInScrollport(scroller, target);
    expect(scroller.scrollTop).toBe(4);
  });
});
