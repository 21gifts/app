// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  bumpFiatGeneration,
  bumpLocaleGeneration,
  fiatGeneration,
  localeGeneration,
} from '@/lib/preference-generation';

describe('preference generations', () => {
  it('starts locale at zero and returns each increment', () => {
    expect(localeGeneration()).toBe(0);
    expect(bumpLocaleGeneration()).toBe(1);
    expect(localeGeneration()).toBe(1);
    expect(bumpLocaleGeneration()).toBe(2);
  });

  it('starts fiat at zero and returns each increment', () => {
    expect(fiatGeneration()).toBe(0);
    expect(bumpFiatGeneration()).toBe(1);
    expect(fiatGeneration()).toBe(1);
    expect(bumpFiatGeneration()).toBe(2);
  });
});
