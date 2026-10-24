import { describe, expect, it } from 'vitest';
import { API_FETCH_TIMEOUT_MS } from '@/lib/api-timeout';

describe('API_FETCH_TIMEOUT_MS', () => {
  it('is the shared 2.5-second window for server-side api reads', () => {
    expect(API_FETCH_TIMEOUT_MS).toBe(2500);
  });
});
