import { describe, expect, it } from 'vitest';
import { iosInstalledVersion, iosPasskeyBlock } from '@/lib/ios-passkey';

describe('iosPasskeyBlock', () => {
  it('returns null for a non-iOS browser', () => {
    expect(iosPasskeyBlock('Mozilla/5.0 (Linux; Android 14)')).toBeNull();
    expect(iosPasskeyBlock('')).toBeNull();
  });

  it('returns null when the iOS version token is missing', () => {
    expect(iosPasskeyBlock('Mozilla/5.0 (iPhone; CPU iPhone like Mac OS X)')).toBeNull();
  });

  it('reports an iPhone below iOS 18, including a version without a patch', () => {
    expect(iosPasskeyBlock('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X)')).toEqual({
      installed: '17.5.1',
      required: '18',
    });
    expect(iosPasskeyBlock('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)')).toEqual({
      installed: '17.5',
      required: '18',
    });
  });

  it('clips an iOS patch longer than eight digits', () => {
    expect(
      iosPasskeyBlock(`Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_${'1'.repeat(40)} like Mac OS X)`),
    ).toEqual({
      installed: '17.5.' + '1'.repeat(8),
      required: '18',
    });
  });

  it('reports an old iPad and iPod the same way', () => {
    expect(iosPasskeyBlock('Mozilla/5.0 (iPad; CPU OS 16_1_2 like Mac OS X)')).toEqual({
      installed: '16.1.2',
      required: '18',
    });
    expect(iosPasskeyBlock('Mozilla/5.0 (iPod touch; CPU iPhone OS 15_0 like Mac OS X)')).toEqual({
      installed: '15.0',
      required: '18',
    });
  });

  it('returns null on iOS 18 and newer', () => {
    expect(iosPasskeyBlock('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')).toBeNull();
    expect(iosPasskeyBlock('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0_1 like Mac OS X)')).toBeNull();
  });
});

describe('iosInstalledVersion', () => {
  it('returns null when the user agent is not a string', () => {
    expect(iosInstalledVersion(undefined as unknown as string)).toBeNull();
  });

  it('returns the installed version for iOS 18 and iOS 17.5.1', () => {
    expect(iosInstalledVersion('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')).toBe(
      '18.0',
    );
    expect(iosInstalledVersion('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X)')).toBe(
      '17.5.1',
    );
  });
});
