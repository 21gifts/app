import { describe, expect, it } from 'vitest';
import { resolveShopPhotoUrl, sameOriginShopPhotoPath } from '@/lib/shop-photo-url';

describe('resolveShopPhotoUrl', () => {
  it('resolves a relative path against the api base', () => {
    expect(resolveShopPhotoUrl('/messages/1/photo.jpg', 'https://api.21.gifts')).toBe(
      'https://api.21.gifts/messages/1/photo.jpg',
    );
    expect(resolveShopPhotoUrl('photos/a.jpg', 'https://api.21.gifts/v1//')).toBe(
      'https://api.21.gifts/v1/photos/a.jpg',
    );
  });

  it('keeps the api base path for a root-relative path', () => {
    expect(resolveShopPhotoUrl('/messages/1/photo.jpg', 'https://api.21.gifts/v1')).toBe(
      'https://api.21.gifts/v1/messages/1/photo.jpg',
    );
    expect(resolveShopPhotoUrl('/messages/1/photo.jpg', 'https://api.21.gifts/v1/')).toBe(
      'https://api.21.gifts/v1/messages/1/photo.jpg',
    );
  });

  it('treats a protocol-relative URL as a host, not as a path', () => {
    expect(resolveShopPhotoUrl('//evil.host/x', 'https://api.21.gifts/v1')).toBe(
      'https://evil.host/x',
    );
    expect(resolveShopPhotoUrl('//evil.host/x')).toBeNull();
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

describe('sameOriginShopPhotoPath', () => {
  const ID = '11111111-1111-4111-8111-111111111111';

  it('maps the api cover photo of a shop note to the app proxy, whatever its extension', () => {
    for (const path of [
      `/messages/${ID}/photo`,
      `/messages/${ID}/photo.jpg`,
      `/messages/${ID}/photo.png`,
      `/messages/${ID}/photo.webp`,
    ]) {
      expect(sameOriginShopPhotoPath(path)).toBe(`/messages/${ID}/photo.jpg`);
    }
    expect(sameOriginShopPhotoPath(`/messages/${ID.toUpperCase()}/photo.JPEG`)).toBe(
      `/messages/${ID}/photo.jpg`,
    );
  });

  it('maps an extra still to the indexed app proxy', () => {
    expect(sameOriginShopPhotoPath(`/messages/${ID}/photo/2.webp`)).toBe(
      `/messages/${ID}/photo/2.jpg`,
    );
  });

  it('maps a photo URL under the api base to the app proxy', () => {
    expect(
      sameOriginShopPhotoPath(
        `https://api.21.gifts/messages/${ID}/photo.png`,
        'https://api.21.gifts/',
      ),
    ).toBe(`/messages/${ID}/photo.jpg`);
    expect(
      sameOriginShopPhotoPath(`https://x.test/v1/messages/${ID}/photo/3.jpg`, 'https://x.test/v1'),
    ).toBe(`/messages/${ID}/photo/3.jpg`);
  });

  it('keeps a photo URL on another host, or on the api host without a base, for the api resolver', () => {
    const api = `https://api.21.gifts/messages/${ID}/photo.jpg`;
    expect(sameOriginShopPhotoPath(api)).toBeNull();
    expect(sameOriginShopPhotoPath(api, 'https://api.21.gifts.evil.example')).toBeNull();
    expect(
      sameOriginShopPhotoPath(
        `https://cdn.example/messages/${ID}/photo.jpg`,
        'https://api.21.gifts',
      ),
    ).toBeNull();
  });

  it('leaves every other value to the api resolver', () => {
    for (const value of [
      '/messages/1/photo.jpg',
      `/messages/${ID}/photo/0.jpg`,
      `/messages/${ID}/photo.gif`,
      `/messages/${ID}/photo/1.jpg/x`,
      `//evil.example/messages/${ID}/photo.jpg`,
    ]) {
      expect(sameOriginShopPhotoPath(value)).toBeNull();
    }
  });
});
