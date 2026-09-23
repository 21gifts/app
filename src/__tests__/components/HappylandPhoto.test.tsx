import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { HappylandPhoto } from '@/components/HappylandPhoto';
import { happylandPhotos } from '@/lib/happyland';
import { getCatalog } from '@/lib/messages';

afterEach(cleanup);

it('serves the original asset eagerly with intrinsic dimensions and a caption', () => {
  const photo = happylandPhotos[3];
  render(<HappylandPhoto photo={photo} messages={getCatalog('en')} className="mt-12" />);
  const image = screen.getByRole('img');
  expect(image.getAttribute('src')).toBe('/happyland/food-stall.webp');
  expect(image.getAttribute('width')).toBe('1024');
  expect(image.getAttribute('height')).toBe('768');
  expect(image.getAttribute('loading')).toBe('eager');
  expect(image.getAttribute('srcset')).toBeNull();
  expect(image.closest('figure')?.className).toBe('mt-12');
  expect(screen.getByText('Pagpag').tagName).toBe('FIGCAPTION');
});

it('supports photographs without extra layout classes', () => {
  render(<HappylandPhoto photo={happylandPhotos[1]} messages={getCatalog('de')} />);
  expect(screen.getByRole('img').closest('figure')?.getAttribute('class')).toBeNull();
});
