import { describe, expect, it } from 'vitest';
import { isForumCardFullyVisible } from '@/lib/forum-card-visible';

const ROOT = {
  top: 0,
  bottom: 800,
  left: 0,
  right: 400,
  width: 400,
  height: 800,
};

describe('isForumCardFullyVisible', () => {
  it('is true when the card sits fully inside the root', () => {
    expect(
      isForumCardFullyVisible(
        { top: 100, bottom: 500, left: 16, right: 384, width: 368, height: 400 },
        ROOT,
      ),
    ).toBe(true);
  });

  it('is true when the card is 1px outside the root', () => {
    expect(
      isForumCardFullyVisible(
        { top: 100, bottom: 801, left: 16, right: 384, width: 368, height: 701 },
        ROOT,
      ),
    ).toBe(true);
  });

  it('is false when the card is 2px outside the root', () => {
    expect(
      isForumCardFullyVisible(
        { top: 100, bottom: 802, left: 16, right: 384, width: 368, height: 702 },
        ROOT,
      ),
    ).toBe(false);
  });

  it('is false when the card is taller than the root', () => {
    expect(
      isForumCardFullyVisible(
        { top: 0, bottom: 900, left: 16, right: 384, width: 368, height: 900 },
        ROOT,
      ),
    ).toBe(false);
  });

  it('is false when the card has zero height', () => {
    expect(
      isForumCardFullyVisible(
        { top: 100, bottom: 100, left: 16, right: 384, width: 368, height: 0 },
        ROOT,
      ),
    ).toBe(false);
  });

  it('is false when the card has zero width', () => {
    expect(
      isForumCardFullyVisible(
        { top: 100, bottom: 500, left: 16, right: 16, width: 0, height: 400 },
        ROOT,
      ),
    ).toBe(false);
  });

  it('is false when the card is 2px past the left edge', () => {
    expect(
      isForumCardFullyVisible(
        { top: 100, bottom: 500, left: -2, right: 384, width: 386, height: 400 },
        ROOT,
      ),
    ).toBe(false);
  });

  it('is false when the card is 2px past the right edge', () => {
    expect(
      isForumCardFullyVisible(
        { top: 100, bottom: 500, left: 16, right: 402, width: 386, height: 400 },
        ROOT,
      ),
    ).toBe(false);
  });

  it('is false when the card is clipped at the top', () => {
    expect(
      isForumCardFullyVisible(
        { top: -20, bottom: 400, left: 16, right: 384, width: 368, height: 420 },
        ROOT,
      ),
    ).toBe(false);
  });
});
