import { afterEach, describe, expect, it, vi } from 'vitest';
import { projectDonateAddress } from '@/lib/project-donate';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('projectDonateAddress', () => {
  it('is the platform account address on the requested host', () => {
    vi.stubEnv('NEXT_PUBLIC_PLATFORM_USERNAME', '21gifts');
    expect(projectDonateAddress('21.gifts')).toBe('21gifts@21.gifts');
    expect(projectDonateAddress('dev.21.gifts')).toBe('21gifts@dev.21.gifts');
  });

  it('falls back to 21.gifts on a local host', () => {
    vi.stubEnv('NEXT_PUBLIC_PLATFORM_USERNAME', '21gifts');
    expect(projectDonateAddress('localhost')).toBe('21gifts@21.gifts');
  });

  it('is null when the platform username is unset', () => {
    vi.stubEnv('NEXT_PUBLIC_PLATFORM_USERNAME', undefined);
    expect(projectDonateAddress('21.gifts')).toBeNull();
  });

  it('is null when the platform username is blank', () => {
    vi.stubEnv('NEXT_PUBLIC_PLATFORM_USERNAME', '  ');
    expect(projectDonateAddress('21.gifts')).toBeNull();
  });
});
