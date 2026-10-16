import { describe, expect, it } from 'vitest';
import type { ForumPlaceAddress } from '@/lib/api-types';
import {
  ensureShopHashtag,
  formatPlacePinText,
  formatShopAddressLine,
  isShopNote,
  SHOP_DESCRIPTION_MAX,
  SHOP_DESCRIPTION_MIN,
  shopAddressProblem,
  shopApiProblem,
  shopDescriptionProblem,
  shopDescriptionRemaining,
  shopNameProblem,
  shopPlaceComplete,
  stripShopHashtag,
} from '@/lib/forum-shop';

const ADDRESS: ForumPlaceAddress = {
  street: 'Bahnhofstrasse',
  houseNumber: '12',
  postalCode: '8001',
  city: 'Zürich',
  country: 'CH',
};

describe('forum-shop', () => {
  describe('isShopNote', () => {
    it('is true for #21GiftsShop in any case and with surrounding text', () => {
      expect(isShopNote('#21GiftsShop')).toBe(true);
      expect(isShopNote('#21giftsshop')).toBe(true);
      expect(isShopNote('Hello\n\n#21GiftsShop')).toBe(true);
      expect(isShopNote('x #21GiftsShop!')).toBe(true);
    });

    it('is false for empty text, prefixes, longer tags, and the site URL', () => {
      expect(isShopNote('')).toBe(false);
      expect(isShopNote('#21gifts')).toBe(false);
      expect(isShopNote('#21GiftsShopping')).toBe(false);
      expect(isShopNote('https://21.gifts')).toBe(false);
    });
  });

  describe('stripShopHashtag', () => {
    it('returns empty when only the hashtag is present', () => {
      expect(stripShopHashtag('#21GiftsShop')).toBe('');
    });

    it('removes a trailing shop hashtag and leftover blank lines', () => {
      expect(stripShopHashtag('Cafe Luna\n\n#21GiftsShop')).toBe('Cafe Luna');
    });

    it('does not collapse unrelated double spaces in the body', () => {
      expect(stripShopHashtag('Open  daily\n\n#21GiftsShop')).toBe('Open  daily');
    });
  });

  describe('ensureShopHashtag', () => {
    it('appends the shop hashtag to untagged text', () => {
      expect(ensureShopHashtag('Cafe Luna')).toBe('Cafe Luna\n\n#21GiftsShop');
    });

    it('does not duplicate when the hashtag is already present', () => {
      expect(ensureShopHashtag('Cafe Luna\n\n#21GiftsShop')).toBe('Cafe Luna\n\n#21GiftsShop');
    });

    it('returns only the hashtag for empty text', () => {
      expect(ensureShopHashtag('')).toBe('#21GiftsShop');
    });

    it('appends the hashtag even when the body is 8000 characters', () => {
      expect(ensureShopHashtag('a'.repeat(8000)).length).toBeGreaterThan(8000);
    });
  });

  describe('shopAddressProblem', () => {
    it('returns missing when the address is null', () => {
      expect(shopAddressProblem(null)).toBe('missing');
    });

    it('returns the first invalid field in street, house, postal, city, country order', () => {
      expect(shopAddressProblem({ ...ADDRESS, street: '' })).toBe('street');
      expect(shopAddressProblem({ ...ADDRESS, street: 'x'.repeat(121) })).toBe('street');
      expect(shopAddressProblem({ ...ADDRESS, street: 'Main\u0001St' })).toBe('street');
      expect(shopAddressProblem({ ...ADDRESS, houseNumber: '12\n' })).toBe('houseNumber');
      expect(shopAddressProblem({ ...ADDRESS, houseNumber: 'A12' })).toBe('houseNumber');
      expect(shopAddressProblem({ ...ADDRESS, postalCode: '800' })).toBe('postalCode');
      expect(shopAddressProblem({ ...ADDRESS, postalCode: '8001\u007f' })).toBe('postalCode');
      expect(shopAddressProblem({ ...ADDRESS, city: '' })).toBe('city');
      expect(shopAddressProblem({ ...ADDRESS, city: '1234' })).toBe('city');
      expect(shopAddressProblem({ ...ADDRESS, city: 'x'.repeat(81) })).toBe('city');
      expect(shopAddressProblem({ ...ADDRESS, city: 'Zürich\u0001' })).toBe('city');
      expect(shopAddressProblem({ ...ADDRESS, country: 'xx' })).toBe('country');
      expect(shopAddressProblem({ ...ADDRESS, country: 'CH ' })).toBe(null);
    });

    it('uses four-digit postal codes for CH and LI and a wider pattern elsewhere', () => {
      expect(shopAddressProblem({ ...ADDRESS, country: 'LI', postalCode: '9490' })).toBe(null);
      expect(shopAddressProblem({ ...ADDRESS, country: 'LI', postalCode: '949' })).toBe(
        'postalCode',
      );
      expect(
        shopAddressProblem({
          ...ADDRESS,
          country: 'US',
          postalCode: '10001',
          city: 'New York',
        }),
      ).toBe(null);
      expect(
        shopAddressProblem({
          ...ADDRESS,
          country: 'US',
          postalCode: 'A',
          city: 'New York',
        }),
      ).toBe('postalCode');
    });

    it('accepts a complete OpenCryptoPay address', () => {
      expect(shopAddressProblem(ADDRESS)).toBe(null);
      expect(shopAddressProblem({ ...ADDRESS, houseNumber: '12a/1 – 2' })).toBe(null);
    });
  });

  describe('shopNameProblem', () => {
    it('returns name when the label is blank', () => {
      expect(shopNameProblem(null, ADDRESS)).toBe('name');
      expect(shopNameProblem('   ', ADDRESS)).toBe('name');
    });

    it('skips the address check when the address is still missing', () => {
      expect(shopNameProblem("Kiki's Bakery", null)).toBe(null);
    });

    it('returns nameAddress when the name embeds the street or postal code as a word', () => {
      expect(shopNameProblem('Bahnhofstrasse Bakery', ADDRESS)).toBe('nameAddress');
      expect(shopNameProblem('Cafe 8001', ADDRESS)).toBe('nameAddress');
      expect(shopNameProblem("Kiki's Bakery", ADDRESS)).toBe(null);
      expect(shopNameProblem('Bahnhofstrassenfest', ADDRESS)).toBe(null);
    });

    it('treats an empty street token as no match', () => {
      expect(shopNameProblem("Kiki's Bakery", { ...ADDRESS, street: '' })).toBe(null);
    });

    it('trims street and postal-code tokens before matching', () => {
      expect(
        shopNameProblem('Bahnhofstrasse Bakery', { ...ADDRESS, street: 'Bahnhofstrasse ' }),
      ).toBe('nameAddress');
      expect(shopNameProblem('Bahnhofstrasse Bakery', ADDRESS)).toBe('nameAddress');
      expect(shopNameProblem('Bakery 8001', { ...ADDRESS, postalCode: ' 8001 ' })).toBe(
        'nameAddress',
      );
      expect(shopNameProblem("Kiki's Bakery", { ...ADDRESS, street: '   ' })).toBe(null);
    });
  });

  describe('shopDescriptionProblem', () => {
    it('returns short, long, or notLonger, and folds CRLF before stripping the tag', () => {
      expect(shopDescriptionProblem('short', "Kiki's Bakery")).toBe('short');
      expect(shopDescriptionProblem('x'.repeat(SHOP_DESCRIPTION_MAX + 1), 'Kiki')).toBe('long');
      expect(shopDescriptionProblem("Kiki's Bakery extra!", "Kiki's Bakery extra!")).toBe(
        'notLonger',
      );
      expect(shopDescriptionProblem("kiki's bakery extra!", "Kiki's Bakery extra!")).toBe(
        'notLonger',
      );
      expect(shopDescriptionProblem('Fresh bread every morning.', "Kiki's Bakery")).toBe(null);
      expect(
        shopDescriptionProblem('Fresh bread every morning.\r\n\r\n#21GiftsShop', "Kiki's Bakery"),
      ).toBe(null);
      expect(shopDescriptionProblem('Fresh bread every morning.', null)).toBe(null);
      expect(SHOP_DESCRIPTION_MIN).toBe(20);
    });
  });

  describe('shopDescriptionRemaining', () => {
    it('counts characters still needed after the shop tag is stripped', () => {
      expect(shopDescriptionRemaining('')).toBe(20);
      expect(shopDescriptionRemaining('Fresh bread every morning.')).toBe(0);
      expect(shopDescriptionRemaining('Cafe Luna\n\n#21GiftsShop')).toBe(11);
    });
  });

  describe('formatShopAddressLine', () => {
    it('joins street, house, postal, city, and the localized country name', () => {
      expect(formatShopAddressLine(ADDRESS, 'en')).toBe(
        'Bahnhofstrasse 12, 8001 Zürich, Switzerland',
      );
    });
  });

  describe('formatPlacePinText', () => {
    it('shows name and address, address alone, a name, or coordinates', () => {
      expect(
        formatPlacePinText(
          { lat: 47.3769, lng: 8.5417, label: "Kiki's Bakery", address: ADDRESS },
          'en',
        ),
      ).toBe("Kiki's Bakery · Bahnhofstrasse 12, 8001 Zürich, Switzerland");
      expect(
        formatPlacePinText({ lat: 47.3769, lng: 8.5417, label: null, address: ADDRESS }, 'en'),
      ).toBe('Bahnhofstrasse 12, 8001 Zürich, Switzerland');
      expect(formatPlacePinText({ lat: 14.6, lng: 120.98, label: 'Happyland' }, 'en')).toBe(
        'Happyland',
      );
      expect(formatPlacePinText({ lat: 1, lng: 2, label: null }, 'en')).toBe('1.00000, 2.00000');
      expect(formatPlacePinText({ lat: 1, lng: 2, label: '   ' }, 'en')).toBe('1.00000, 2.00000');
    });
  });

  describe('shopPlaceComplete', () => {
    it('is true only when the name and structured address both pass', () => {
      expect(shopPlaceComplete(null)).toBe(false);
      expect(shopPlaceComplete({ lat: 1, lng: 2, label: "Kiki's Bakery" })).toBe(false);
      expect(shopPlaceComplete({ lat: 1, lng: 2, label: null, address: ADDRESS })).toBe(false);
      expect(
        shopPlaceComplete({
          lat: 47.3769,
          lng: 8.5417,
          label: 'Bahnhofstrasse Bakery',
          address: ADDRESS,
        }),
      ).toBe(false);
      expect(
        shopPlaceComplete({
          lat: 47.3769,
          lng: 8.5417,
          label: "Kiki's Bakery",
          address: ADDRESS,
        }),
      ).toBe(true);
    });
  });

  describe('shopApiProblem', () => {
    it('maps exact API 400 bodies and ignores other text', () => {
      expect(shopApiProblem('Shop name is required')).toBe('shopName');
      expect(shopApiProblem('Shop name must not contain the address')).toBe('shopNameAddress');
      expect(shopApiProblem('Shop address is required')).toBe('shopAddress');
      expect(
        shopApiProblem(
          'Shop description must be 20 to 1000 characters and longer than the shop name',
        ),
      ).toBe('shopDescription');
      expect(shopApiProblem('Place address is invalid')).toBe('placeAddress');
      expect(shopApiProblem('Could not post your message')).toBe(null);
    });
  });
});
