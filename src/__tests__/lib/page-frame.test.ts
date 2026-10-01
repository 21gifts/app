import { afterEach, describe, expect, it } from 'vitest';
import { fitBoxInFrame, pageFrameProblems } from '@/lib/page-frame';

const restorers: Array<() => void> = [];

function stubOwn(target: object, key: string, value: unknown): void {
  const existing = Object.getOwnPropertyDescriptor(target, key);
  Object.defineProperty(target, key, { configurable: true, value });
  restorers.push(() => {
    if (existing === undefined) {
      delete (target as Record<string, unknown>)[key];
    } else {
      Object.defineProperty(target, key, existing);
    }
  });
}

function rectAt(left: number, right: number, width: number, height: number): DOMRect {
  return {
    x: left,
    y: 0,
    left,
    right,
    width,
    height,
    top: 0,
    bottom: height,
    toJSON: () => ({ left, right, width, height }),
  } as DOMRect;
}

function stubRect(el: Element, left: number, right: number, width: number, height: number): void {
  el.getBoundingClientRect = () => rectAt(left, right, width, height);
}

function preparePageFrame(scrollWidth: number, clientWidth: number): void {
  stubOwn(window, 'innerWidth', 375);
  stubOwn(window, 'innerHeight', 800);
  stubOwn(document.documentElement, 'scrollWidth', scrollWidth);
  stubOwn(document.documentElement, 'clientWidth', clientWidth);
}

function stubBox(
  el: Element,
  box: { left: number; right: number; top: number; bottom: number },
): void {
  const width = box.right - box.left;
  const height = box.bottom - box.top;
  el.getBoundingClientRect = () =>
    ({
      x: box.left,
      y: box.top,
      width,
      height,
      toJSON: () => box,
      ...box,
    }) as DOMRect;
}

const FIT_FRAME = {
  frameLeft: 24,
  frameRight: 351,
  frameTop: 0,
  frameBottom: 800,
  anchorLeft: 56,
  anchorTop: 60,
  anchorBottom: 100,
  gap: 8,
  inset: 16,
  viewportHeight: 800,
};

afterEach(() => {
  while (restorers.length > 0) {
    const restore = restorers.pop();
    if (restore !== undefined) {
      restore();
    }
  }
  document.body.replaceChildren();
});

describe('fitBoxInFrame', () => {
  it('keeps the preferred width when it fits beside the anchor', () => {
    expect(
      fitBoxInFrame({
        ...FIT_FRAME,
        preferredWidth: 256,
      }),
    ).toEqual({ left: 56, width: 256, maxHeight: 676, top: 108, bottom: null });
  });

  it('shrinks to the room between the insets', () => {
    expect(
      fitBoxInFrame({
        ...FIT_FRAME,
        preferredWidth: 384,
      }),
    ).toEqual({ left: 40, width: 295, maxHeight: 676, top: 108, bottom: null });
  });

  it('shifts left when the anchor would cross the right edge', () => {
    expect(
      fitBoxInFrame({
        ...FIT_FRAME,
        anchorLeft: 300,
        preferredWidth: 256,
      }),
    ).toEqual({ left: 79, width: 256, maxHeight: 676, top: 108, bottom: null });
  });

  it('shifts right when the anchor is left of the inset', () => {
    expect(
      fitBoxInFrame({
        ...FIT_FRAME,
        anchorLeft: 0,
        preferredWidth: 256,
      }),
    ).toEqual({ left: 40, width: 256, maxHeight: 676, top: 108, bottom: null });
  });

  it('returns null when the frame has no width', () => {
    expect(
      fitBoxInFrame({
        frameLeft: 0,
        frameRight: 0,
        frameTop: 0,
        frameBottom: 800,
        anchorLeft: 56,
        anchorTop: 60,
        anchorBottom: 100,
        gap: 8,
        preferredWidth: 256,
        inset: 16,
        viewportHeight: 800,
      }),
    ).toBeNull();
  });

  it('returns null when the preferred width is zero', () => {
    expect(
      fitBoxInFrame({
        ...FIT_FRAME,
        preferredWidth: 0,
      }),
    ).toBeNull();
  });

  it('returns null when the frame equals the insets', () => {
    expect(
      fitBoxInFrame({
        frameLeft: 10,
        frameRight: 42,
        frameTop: 0,
        frameBottom: 800,
        anchorLeft: 56,
        anchorTop: 60,
        anchorBottom: 100,
        gap: 8,
        preferredWidth: 256,
        inset: 16,
        viewportHeight: 800,
      }),
    ).toBeNull();
  });

  it('returns null when the preferred width is negative', () => {
    expect(
      fitBoxInFrame({
        ...FIT_FRAME,
        preferredWidth: -1,
      }),
    ).toBeNull();
  });

  it('opens upward when the anchor is low in the frame', () => {
    expect(
      fitBoxInFrame({
        ...FIT_FRAME,
        anchorTop: 660,
        anchorBottom: 700,
        preferredWidth: 256,
      }),
    ).toEqual({ left: 56, width: 256, maxHeight: 636, top: null, bottom: 148 });
  });

  it('opens upward when below meets the minimum but above has more room', () => {
    expect(
      fitBoxInFrame({
        ...FIT_FRAME,
        anchorTop: 456,
        anchorBottom: 496,
        preferredWidth: 256,
      }),
    ).toEqual({ left: 56, width: 256, maxHeight: 432, top: null, bottom: 352 });
  });

  it('fills the frame when both sides are under 280', () => {
    expect(
      fitBoxInFrame({
        ...FIT_FRAME,
        frameBottom: 200,
        anchorTop: 90,
        anchorBottom: 110,
        preferredWidth: 256,
      }),
    ).toEqual({ left: 56, width: 256, maxHeight: 168, top: 16, bottom: null });
  });

  it('returns null when the frame has no height', () => {
    expect(
      fitBoxInFrame({
        ...FIT_FRAME,
        frameBottom: 32,
        preferredWidth: 256,
      }),
    ).toBeNull();
  });
});

describe('pageFrameProblems', () => {
  it('returns nothing for an empty body when the document widths match', () => {
    preparePageFrame(375, 375);
    expect(pageFrameProblems()).toEqual([]);
  });

  it('does not report document scroll when scrollWidth equals clientWidth plus one', () => {
    preparePageFrame(376, 375);
    expect(pageFrameProblems()).not.toContain('document scrolls sideways');
  });

  it('reports document scroll when scrollWidth is greater than clientWidth plus one', () => {
    preparePageFrame(377, 375);
    expect(pageFrameProblems()).toContain('document scrolls sideways');
  });

  it('reports an active page scroller that is wider than its box', () => {
    preparePageFrame(375, 375);
    const port = document.createElement('div');
    port.setAttribute('data-scrollport', '');
    port.setAttribute('data-scroll-active', '');
    stubOwn(port, 'scrollWidth', 400);
    stubOwn(port, 'clientWidth', 375);
    stubRect(port, 10, 100, 90, 20);
    document.body.appendChild(port);
    expect(pageFrameProblems()).toContain('page scrolls sideways');
  });

  it('does not report an active page scroller at the plus-one tolerance', () => {
    preparePageFrame(375, 375);
    const port = document.createElement('div');
    port.setAttribute('data-scrollport', '');
    port.setAttribute('data-scroll-active', '');
    stubOwn(port, 'scrollWidth', 376);
    stubOwn(port, 'clientWidth', 375);
    stubRect(port, 10, 100, 90, 20);
    document.body.appendChild(port);
    expect(pageFrameProblems()).not.toContain('page scrolls sideways');
  });

  it('ignores a locked port with a huge scrollWidth', () => {
    preparePageFrame(375, 375);
    const port = document.createElement('div');
    port.setAttribute('data-scrollport', '');
    port.setAttribute('data-scroll-locked', '');
    stubOwn(port, 'scrollWidth', 9000);
    stubOwn(port, 'clientWidth', 10);
    stubRect(port, 10, 100, 90, 20);
    document.body.appendChild(port);
    expect(pageFrameProblems()).toEqual([]);
    expect(pageFrameProblems()).not.toContain('page scrolls sideways');
  });

  it('reports a box that crosses the right edge', () => {
    preparePageFrame(375, 375);
    const panel = document.createElement('div');
    panel.className = 'place-panel';
    stubRect(panel, 0, 400, 400, 20);
    document.body.appendChild(panel);
    expect(pageFrameProblems()).toEqual(['sticks out: div.place-panel left=0 right=400']);
  });

  it('skips a child inside a sideways row whose own box stays inside', () => {
    preparePageFrame(375, 375);
    const row = document.createElement('div');
    row.setAttribute('data-scroll-x', '');
    stubRect(row, 10, 100, 90, 20);
    const slide = document.createElement('div');
    stubRect(slide, 0, 900, 900, 20);
    row.appendChild(slide);
    document.body.appendChild(row);
    expect(pageFrameProblems()).toEqual([]);
  });

  it('reports a fixed child of a sideways row that sticks out the top', () => {
    preparePageFrame(375, 375);
    const row = document.createElement('div');
    row.setAttribute('data-scroll-x', '');
    stubRect(row, 10, 100, 90, 20);
    const slide = document.createElement('div');
    slide.style.position = 'fixed';
    stubBox(slide, { left: 10, right: 30, top: -2, bottom: 20 });
    row.appendChild(slide);
    document.body.appendChild(row);
    expect(pageFrameProblems()).toEqual(['sticks out: div top=-2 bottom=20']);
  });

  it('reports the sideways row when the row itself sticks out', () => {
    preparePageFrame(375, 375);
    const row = document.createElement('div');
    row.setAttribute('data-scroll-x', '');
    stubRect(row, 0, 400, 400, 20);
    document.body.appendChild(row);
    const problems = pageFrameProblems();
    expect(
      problems.some((line) => line.startsWith('sticks out:') && line.includes('right=400')),
    ).toBe(true);
  });

  it('skips a zero-width box that would otherwise stick out', () => {
    preparePageFrame(375, 375);
    const el = document.createElement('div');
    stubRect(el, 0, 900, 0, 20);
    document.body.appendChild(el);
    expect(pageFrameProblems()).toEqual([]);
  });

  it('skips a zero-height box that would otherwise stick out', () => {
    preparePageFrame(375, 375);
    const el = document.createElement('div');
    stubRect(el, 0, 900, 20, 0);
    document.body.appendChild(el);
    expect(pageFrameProblems()).toEqual([]);
  });

  it('treats left equal to -1 as inside', () => {
    preparePageFrame(375, 375);
    const el = document.createElement('div');
    stubRect(el, -1, 20, 21, 20);
    document.body.appendChild(el);
    expect(pageFrameProblems()).toEqual([]);
  });

  it('reports left equal to -2', () => {
    preparePageFrame(375, 375);
    const el = document.createElement('div');
    stubRect(el, -2, 20, 22, 20);
    document.body.appendChild(el);
    const problems = pageFrameProblems();
    expect(problems.some((line) => line.includes('left=-2'))).toBe(true);
  });

  it('treats right equal to innerWidth plus one as inside', () => {
    preparePageFrame(375, 375);
    const el = document.createElement('div');
    stubRect(el, 10, 376, 366, 20);
    document.body.appendChild(el);
    expect(pageFrameProblems()).toEqual([]);
  });

  it('keeps five stick-out lines and a more count', () => {
    preparePageFrame(375, 375);
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f']) {
      const el = document.createElement('div');
      el.id = id;
      stubRect(el, 0, 400, 400, 20);
      document.body.appendChild(el);
    }
    const problems = pageFrameProblems();
    expect(problems).toEqual([
      'sticks out: div#a left=0 right=400',
      'sticks out: div#b left=0 right=400',
      'sticks out: div#c left=0 right=400',
      'sticks out: div#d left=0 right=400',
      'sticks out: div#e left=0 right=400',
      '1 more boxes stick out',
    ]);
    expect(problems.filter((line) => line.startsWith('sticks out:'))).toHaveLength(5);
    expect(problems).toHaveLength(6);
  });

  it('labels an id without classes', () => {
    preparePageFrame(375, 375);
    const el = document.createElement('div');
    el.id = 'pin';
    stubRect(el, 0, 400, 400, 20);
    document.body.appendChild(el);
    expect(pageFrameProblems()[0]).toMatch(/^sticks out: div#pin /);
  });

  it('uses only the first three class tokens', () => {
    preparePageFrame(375, 375);
    const el = document.createElement('div');
    el.className = 'a b c d';
    stubRect(el, 0, 400, 400, 20);
    document.body.appendChild(el);
    expect(pageFrameProblems()).toEqual(['sticks out: div.a.b.c left=0 right=400']);
  });

  it('labels an empty class as the tag only', () => {
    preparePageFrame(375, 375);
    const el = document.createElement('div');
    el.className = '';
    stubRect(el, 0, 400, 400, 20);
    document.body.appendChild(el);
    expect(pageFrameProblems()).toEqual(['sticks out: div left=0 right=400']);
  });

  it('does not throw when an SVG className is not a string', () => {
    preparePageFrame(375, 375);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    stubRect(svg, 0, 400, 400, 20);
    document.body.appendChild(svg);
    expect(() => pageFrameProblems()).not.toThrow();
    const problems = pageFrameProblems();
    expect(problems.some((line) => line.startsWith('sticks out: svg'))).toBe(true);
  });

  it('reports document scroll, page scroll, then a sticking box', () => {
    preparePageFrame(400, 375);
    const port = document.createElement('div');
    port.setAttribute('data-scrollport', '');
    port.setAttribute('data-scroll-active', '');
    stubOwn(port, 'scrollWidth', 500);
    stubOwn(port, 'clientWidth', 375);
    stubRect(port, 10, 100, 90, 20);
    document.body.appendChild(port);
    const panel = document.createElement('div');
    panel.className = 'place-panel';
    stubRect(panel, 0, 400, 400, 20);
    document.body.appendChild(panel);
    expect(pageFrameProblems()).toEqual([
      'document scrolls sideways',
      'page scrolls sideways',
      'sticks out: div.place-panel left=0 right=400',
    ]);
  });

  it('labels an element that is neither HTML nor SVG as the tag only', () => {
    preparePageFrame(375, 375);
    const node = document.createElementNS('http://www.w3.org/1998/Math/MathML', 'math');
    expect(!(node instanceof HTMLElement) && !(node instanceof SVGElement)).toBe(true);
    stubRect(node, 0, 400, 400, 20);
    document.body.appendChild(node);
    expect(pageFrameProblems()).toEqual(['sticks out: math left=0 right=400']);
  });

  it('treats bottom equal to innerHeight plus one as inside', () => {
    preparePageFrame(375, 375);
    const el = document.createElement('div');
    stubBox(el, { left: 10, right: 30, top: 0, bottom: 801 });
    document.body.appendChild(el);
    expect(pageFrameProblems()).toEqual([]);
  });

  it('reports bottom equal to innerHeight plus two', () => {
    preparePageFrame(375, 375);
    const el = document.createElement('div');
    el.id = 'low';
    stubBox(el, { left: 10, right: 30, top: 0, bottom: 802 });
    document.body.appendChild(el);
    expect(pageFrameProblems()).toEqual(['sticks out: div#low top=0 bottom=802']);
  });

  it('treats top equal to -1 as inside', () => {
    preparePageFrame(375, 375);
    const el = document.createElement('div');
    stubBox(el, { left: 10, right: 30, top: -1, bottom: 20 });
    document.body.appendChild(el);
    expect(pageFrameProblems()).toEqual([]);
  });

  it('reports top equal to -2', () => {
    preparePageFrame(375, 375);
    const el = document.createElement('div');
    el.id = 'high';
    stubBox(el, { left: 10, right: 30, top: -2, bottom: 20 });
    document.body.appendChild(el);
    expect(pageFrameProblems()).toEqual(['sticks out: div#high top=-2 bottom=20']);
  });

  it('skips in-flow content inside a scrollport that extends past the window', () => {
    preparePageFrame(375, 375);
    const port = document.createElement('div');
    port.setAttribute('data-scrollport', '');
    const child = document.createElement('div');
    stubBox(child, { left: 10, right: 30, top: 0, bottom: 900 });
    port.appendChild(child);
    document.body.appendChild(port);
    expect(pageFrameProblems()).toEqual([]);
  });

  it('reports a fixed box inside a scrollport that extends past the window', () => {
    preparePageFrame(375, 375);
    const port = document.createElement('div');
    port.setAttribute('data-scrollport', '');
    const child = document.createElement('div');
    child.style.position = 'fixed';
    stubBox(child, { left: 10, right: 30, top: 0, bottom: 900 });
    port.appendChild(child);
    document.body.appendChild(port);
    expect(pageFrameProblems()).toEqual(['sticks out: div top=0 bottom=900']);
  });

  it('reports a tall body child that extends past the window', () => {
    preparePageFrame(375, 375);
    const el = document.createElement('div');
    stubBox(el, { left: 10, right: 30, top: 0, bottom: 900 });
    document.body.appendChild(el);
    expect(pageFrameProblems()).toEqual(['sticks out: div top=0 bottom=900']);
  });

  it('caps mixed horizontal and vertical stick-out lines together', () => {
    preparePageFrame(375, 375);
    for (const id of ['a', 'b', 'c']) {
      const el = document.createElement('div');
      el.id = id;
      stubBox(el, { left: -2, right: 400, top: -2, bottom: 900 });
      document.body.appendChild(el);
    }
    expect(pageFrameProblems()).toEqual([
      'sticks out: div#a left=-2 right=400',
      'sticks out: div#a top=-2 bottom=900',
      'sticks out: div#b left=-2 right=400',
      'sticks out: div#b top=-2 bottom=900',
      'sticks out: div#c left=-2 right=400',
      '1 more boxes stick out',
    ]);
  });
});
