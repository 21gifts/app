import { describe, expect, it } from 'vitest';
import { resolveShopPhotoUrl } from '@/lib/shop-photo-url';

describe('resolveShopPhotoUrl', () => {
  it('resolves a relative path against the api base', () => {
    expect(resolveShopPhotoUrl('/messages/1/photo.jpg', 'https://api.21.gifts')).toBe(
      'https://api.21.gifts/messages/1/photo.jpg',
    );
    expect(resolveShopPhotoUrl('photos/a.jpg', 'https://api.21.gifts/v1//')).toBe(
      'https://api.21.gifts/v1/photos/a.jpg',
    );
  });

  it('keeps an absolute http or https URL', () => {
    expect(resolveShopPhotoUrl('https://cdn.example/a.jpg', 'https://api.21.gifts')).toBe(
      'https://cdn.example/a.jpg',
    );
    expect(resolveShopPhotoUrl('http://127.0.0.1:3001/a.jpg')).toBe('http://127.0.0.1:3001/a.jpg');
  });

  it('drops every other scheme', () => {
    expect(resolveShopPhotoUrl('javascript:alert(1)', 'https://api.21.gifts')).toBeNull();
    expect(resolveShopPhotoUrl('data:image/png;base64,AAAA')).toBeNull();
    expect(resolveShopPhotoUrl('ftp://example.com/a.jpg', 'https://api.21.gifts')).toBeNull();
  });

  it('drops a relative path without an api base and an unparsable base', () => {
    expect(resolveShopPhotoUrl('/messages/1/photo.jpg')).toBeNull();
    expect(resolveShopPhotoUrl('/messages/1/photo.jpg', 'not a url')).toBeNull();
  });
});
