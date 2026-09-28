import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { middleware } from '@/middleware';

describe('middleware', () => {
  it('sends /map to the shops map', () => {
    const response = middleware(new NextRequest('https://21.gifts/map'));
    expect(response.headers.get('location')).toBe('https://21.gifts/shops#map');
  });

  it('keeps a pin query on the shops map', () => {
    const response = middleware(new NextRequest('https://21.gifts/map?pin=m-pin'));
    expect(response.headers.get('location')).toBe('https://21.gifts/shops?pin=m-pin#map');
  });
});
