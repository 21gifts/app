import { describe, expect, it } from 'vitest';
import type { ForumPlaceAddress } from '@/lib/api-types';
import {
  apiMediaProblem,
  ensureShopHashtag,
  formatPlacePinText,
  formatShopAddressLine,
  isShopApiProblem,
  isShopNote,
  SHOP_API_MESSAGE,
  SHOP_DESCRIPTION_MAX,
  SHOP_DESCRIPTION_MIN,
  shopAddressProblem,
  shopAddressProblems,
  shopApiProblem,
  shopDescriptionProblem,
  shopDescriptionRemaining,
  shopDescriptionText,
  shopNameProblem,
  shopPlaceComplete,
  shopProblemField,
  shopUsernameProblem,
  stripShopHashtag,
  type ShopApiProblem,
} from '@/lib/forum-shop';
import { getCatalog } from '@/lib/messages';
import { translate } from '@/lib/translate';

const ADDRESS: ForumPlaceAddress = {
  street: 'Bahnhofstrasse',
  houseNumber: '12',
  postalCode: '8001',
  city: 'Zürich',
  country: 'CH',
};

describe('forum-shop', () => {
  describe('apiMediaProblem', () => {
    it('maps every exact API media rejection and ignores unknown text', () => {
      expect(apiMediaProblem('At most 10 photos')).toBe('tooMany');
      expect(apiMediaProblem('Photo must be a JPEG, PNG, or WebP under 1 MiB')).toBe(
        'formatOrSize',
      );
      expect(apiMediaProblem('Video must be an MP4, WebM, or MOV under 32 MiB')).toBe(
        'formatOrSize',
      );
      expect(apiMediaProblem('Poster must be a JPEG, PNG, or WebP under 1 MiB')).toBe(
        'formatOrSize',
      );
      expect(apiMediaProblem('Could not post your message')).toBeNull();
    });
  });

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
      expect(shopAddressProblem({ ...ADDRESS, houseNumber: '12\n34' })).toBe('houseNumber');
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

    it('accepts edge tabs after trimming and rejects inner tabs in every text field', () => {
      expect(
        shopAddressProblem({
          ...ADDRESS,
          street: '\tBahnhofstrasse\t',
          houseNumber: '\t12\t',
          postalCode: '\t8001\t',
          city: '\tZürich\t',
        }),
      ).toBe(null);
      expect(shopAddressProblem({ ...ADDRESS, street: 'Bahnhof\tstrasse' })).toBe('street');
      expect(shopAddressProblem({ ...ADDRESS, houseNumber: '1\t2' })).toBe('houseNumber');
      expect(shopAddressProblem({ ...ADDRESS, postalCode: '80\t01' })).toBe('postalCode');
      expect(shopAddressProblem({ ...ADDRESS, city: 'Zü\trich' })).toBe('city');
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

  describe('shopAddressProblems', () => {
    it('returns every field problem with the concrete rule', () => {
      expect(shopAddressProblems(null)).toEqual({
        street: 'required',
        houseNumber: 'required',
        postalCode: 'required',
        city: 'required',
        country: 'required',
      });
      expect(
        shopAddressProblems({
          street: 'x'.repeat(121),
          houseNumber: 'A12',
          postalCode: '800',
          city: '1234',
          country: 'CH',
        }),
      ).toEqual({
        street: 'length',
        houseNumber: 'format',
        postalCode: 'formatChLi',
        city: 'letter',
      });
      expect(shopAddressProblems(ADDRESS)).toEqual({});
    });

    it('distinguishes controls, lengths, foreign postal format, and invalid country', () => {
      expect(
        shopAddressProblems({
          street: 'Main\u0001',
          houseNumber: '12\u007f',
          postalCode: 'A',
          city: 'x'.repeat(81),
          country: 'XX',
        }),
      ).toEqual({
        street: 'controls',
        houseNumber: 'controls',
        postalCode: 'formatOther',
        city: 'length',
        country: 'invalid',
      });
      expect(shopAddressProblems({ ...ADDRESS, postalCode: '80\u0001' })).toEqual({
        postalCode: 'controls',
      });
      expect(shopAddressProblems({ ...ADDRESS, city: 'Bern\u0001' })).toEqual({
        city: 'controls',
      });
      expect(shopAddressProblems({ ...ADDRESS, houseNumber: `1${'a'.repeat(32)}` })).toEqual({
        houseNumber: 'length',
      });
      expect(shopAddressProblems({ ...ADDRESS, houseNumber: '12#' })).toEqual({
        houseNumber: 'characters',
      });
      expect(shopAddressProblems({ ...ADDRESS, houseNumber: '12ä' })).toEqual({
        houseNumber: 'characters',
      });
    });

    it('checks control characters after trimming every address draft', () => {
      expect(
        shopAddressProblems({
          ...ADDRESS,
          street: '\tBahnhofstrasse\t',
          houseNumber: '\t12\t',
          postalCode: '\t8001\t',
          city: '\tZürich\t',
        }),
      ).toEqual({});
      expect(
        shopAddressProblems({
          ...ADDRESS,
          street: 'Bahnhof\tstrasse',
          houseNumber: '1\t2',
          postalCode: '80\t01',
          city: 'Zü\trich',
        }),
      ).toEqual({
        street: 'controls',
        houseNumber: 'controls',
        postalCode: 'controls',
        city: 'controls',
      });
    });
  });

  describe('shopNameProblem', () => {
    it('treats an unset label as missing and an unset address as not checked', () => {
      expect(shopNameProblem(undefined, undefined)).toBe('name');
      expect(shopNameProblem('Kiki', undefined)).toBeNull();
    });

    it('returns name when the label is blank', () => {
      expect(shopNameProblem(null, ADDRESS)).toBe('name');
      expect(shopNameProblem('   ', ADDRESS)).toBe('name');
    });

    it('skips the address check when the address is still missing', () => {
      expect(shopNameProblem("Kiki's Bakery", null)).toBe(null);
    });

    it('returns nameAddress when the name embeds the street or postal code as a word', () => {
      expect(shopNameProblem('Bahnhofstrasse Bakery', ADDRESS)).toBe('nameAddress');
      expect(shopNameProblem('Cafe Bahnhofstrasse', ADDRESS)).toBe('nameAddress');
      expect(shopNameProblem('xBahnhofstrasse Bakery', ADDRESS)).toBe(null);
      expect(shopNameProblem('Cafe 8001', ADDRESS)).toBe('nameAddress');
      expect(shopNameProblem("Kiki's Bakery", ADDRESS)).toBe(null);
      expect(shopNameProblem('Bahnhofstrassenfest', ADDRESS)).toBe(null);
    });

    it('treats an empty street token as no match', () => {
      expect(shopNameProblem("Kiki's Bakery", { ...ADDRESS, street: '' })).toBe(null);
    });

    it('rejects names over 80 characters and control characters', () => {
      expect(shopNameProblem('x'.repeat(81), ADDRESS)).toBe('nameLong');
      expect(shopNameProblem('Cafe\u0001', ADDRESS)).toBe('nameControls');
    });

    it('checks shop-name controls after trimming', () => {
      expect(shopNameProblem("\tKiki's Bakery\t", ADDRESS)).toBe(null);
      expect(shopNameProblem("Kiki's\tBakery", ADDRESS)).toBe('nameControls');
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
      expect(shopDescriptionProblem('Fresh bread\u0001 every morning.', null)).toBe('controls');
      expect(shopDescriptionProblem('\tFresh bread every morning.', null)).toBe(null);
      expect(shopDescriptionProblem('Fresh bread\n every morning.', null)).toBe(null);
      expect(shopDescriptionProblem('Fresh bread every morning.\t', null)).toBe(null);
      expect(shopDescriptionProblem('Fresh bread\u0001 every morning.', null)).toBe('controls');
      expect(SHOP_DESCRIPTION_MIN).toBe(20);
    });
  });

  describe('shopUsernameProblem', () => {
    it('accepts optional API usernames and rejects invalid starts or lengths', () => {
      expect(shopUsernameProblem('')).toBe(null);
      expect(shopUsernameProblem('@alice_21')).toBe(null);
      expect(shopUsernameProblem('@Ada')).toBe(null);
      expect(shopUsernameProblem('@')).toBe(null);
      expect(shopUsernameProblem(' @ ')).toBe(null);
      expect(shopUsernameProblem('@ ada')).toBe(null);
      expect(shopUsernameProblem('_')).toBe('format');
      expect(shopUsernameProblem('A User')).toBe('format');
      expect(shopUsernameProblem(`a${'x'.repeat(32)}`)).toBe('format');
    });
  });

  describe('shopDescriptionText', () => {
    it('folds line breaks before it strips the shop tag', () => {
      expect(shopDescriptionText('Fresh bread\r\nevery morning.\r\n\r\n#21GiftsShop')).toBe(
        'Fresh bread\nevery morning.',
      );
      expect(shopDescriptionText('Fresh\rbread')).toBe('Fresh\nbread');
      expect(shopDescriptionText('Fresh #21GiftsShop bread #21GiftsShop')).toBe('Fresh  bread');
      expect(shopDescriptionText('Fresh\r\n\r\n\r\n\r\nbread')).toBe('Fresh\n\nbread');
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
      expect(shopApiProblem('Shop name is required', false)).toBe('shopName');
      expect(shopApiProblem('Shop name must not contain the address', false)).toBe(
        'shopNameAddress',
      );
      expect(shopApiProblem('Shop address is required', false)).toBe('shopAddress');
      expect(
        shopApiProblem(
          'Shop description must be 20 to 1000 characters and longer than the shop name',
          false,
        ),
      ).toBe('shopDescription');
      expect(shopApiProblem('Place address is invalid', false)).toBe('placeAddress');
      expect(shopApiProblem('Username is not valid', false)).toBe('usernameInvalid');
      expect(shopApiProblem('No account with that username', false)).toBe('usernameMissing');
      expect(shopApiProblem('A shop note needs a shop account', false)).toBe('usernameRequired');
      expect(shopApiProblem('Could not post your message', false)).toBe(null);
    });

    it('maps generic text and label errors only for shops', () => {
      expect(shopApiProblem('Text must be 1–8000 characters', true)).toBe('shopDescription');
      expect(shopApiProblem('Text must be 1–8000 characters', false)).toBe(null);
      expect(shopApiProblem('Text must be 1–8000 characters or include a photo', true)).toBe(
        'shopDescription',
      );
      expect(shopApiProblem('Text must be 1–8000 characters or include a photo', false)).toBe(null);
      expect(
        shopApiProblem('Text must be 1–8000 characters or include a photo or video', true),
      ).toBe('shopDescription');
      expect(
        shopApiProblem('Text must be 1–8000 characters or include a photo or video', false),
      ).toBe(null);
      expect(shopApiProblem('Place label must be at most 80 characters', true)).toBe(
        'shopNameLong',
      );
      expect(shopApiProblem('Place label must be at most 80 characters', false)).toBe(null);
    });
  });

  describe('isShopApiProblem', () => {
    it('narrows mapped problem keys and rejects other values', () => {
      expect(isShopApiProblem('shopDescription')).toBe(true);
      expect(isShopApiProblem('shopElsewhere')).toBe(false);
      expect(isShopApiProblem('toString')).toBe(false);
      expect(isShopApiProblem(null)).toBe(false);
      expect(isShopApiProblem({ error: 'shopDescription' })).toBe(false);
    });
  });

  describe('shopProblemField', () => {
    it('maps every shop problem to the field that can correct it', () => {
      expect(shopProblemField('shopName')).toBe('place');
      expect(shopProblemField('shopNameAddress')).toBe('place');
      expect(shopProblemField('shopNameLong')).toBe('place');
      expect(shopProblemField('shopNameControls')).toBe('place');
      expect(shopProblemField('shopAddress')).toBe('place');
      expect(shopProblemField('placeAddress')).toBe('place');
      expect(shopProblemField('shopDescription')).toBe('text');
      expect(shopProblemField('shopDescriptionControls')).toBe('text');
      expect(shopProblemField('usernameInvalid')).toBe('username');
      expect(shopProblemField('usernameMissing')).toBe('username');
      expect(shopProblemField('usernameRequired')).toBe('username');
    });
  });

  describe('SHOP_API_MESSAGE', () => {
    it('maps each problem to an existing message key', () => {
      const catalog = getCatalog('en');
      const problems: ShopApiProblem[] = [
        'shopName',
        'shopNameAddress',
        'shopNameControls',
        'shopNameLong',
        'shopAddress',
        'shopDescription',
        'shopDescriptionControls',
        'placeAddress',
        'usernameInvalid',
        'usernameMissing',
        'usernameRequired',
      ];
      expect(Object.keys(SHOP_API_MESSAGE).sort()).toEqual([...problems].sort());
      for (const problem of problems) {
        expect(translate(catalog, SHOP_API_MESSAGE[problem]).trim().length).toBeGreaterThan(0);
      }
    });
  });
});
