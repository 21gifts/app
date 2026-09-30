import { describe, expect, it } from 'vitest';
import { androidInstalledVersion, androidPasskeyBlock } from '@/lib/android-passkey';

describe('androidPasskeyBlock', () => {
  it('returns null for a non-Android browser', () => {
    expect(androidPasskeyBlock('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBeNull();
    expect(androidPasskeyBlock('')).toBeNull();
  });

  it('returns null when the Android version token is missing', () => {
    expect(androidPasskeyBlock('Mozilla/5.0 (Linux; Android; Pixel)')).toBeNull();
  });

  it('reports Android 8 with only a major version', () => {
    expect(androidPasskeyBlock('Mozilla/5.0 (Linux; Android 8; Pixel)')).toEqual({
      installed: '8',
      required: '9',
    });
  });

  it('reports Android 8.1 without a patch', () => {
    expect(androidPasskeyBlock('Mozilla/5.0 (Linux; Android 8.1; Pixel)')).toEqual({
      installed: '8.1',
      required: '9',
    });
  });

  it('reports Android 8.1.0 with a patch', () => {
    expect(androidPasskeyBlock('Mozilla/5.0 (Linux; Android 8.1.0; Pixel)')).toEqual({
      installed: '8.1.0',
      required: '9',
    });
  });

  it('returns null on Android 9, 10, and 14', () => {
    expect(androidPasskeyBlock('Mozilla/5.0 (Linux; Android 9; Pixel)')).toBeNull();
    expect(androidPasskeyBlock('Mozilla/5.0 (Linux; Android 10; Pixel)')).toBeNull();
    expect(androidPasskeyBlock('Mozilla/5.0 (Linux; Android 14; Pixel)')).toBeNull();
  });

  it('returns null for an iPhone user agent', () => {
    expect(
      androidPasskeyBlock('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X)'),
    ).toBeNull();
  });

  it('returns null when the user agent is not a string', () => {
    expect(androidPasskeyBlock(undefined as unknown as string)).toBeNull();
    expect(androidInstalledVersion(undefined as unknown as string)).toBeNull();
  });
});
