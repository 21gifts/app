import { describe, expect, it } from 'vitest';
import { isMainnetBitcoinAddress } from '@/lib/bitcoin-address';

describe('isMainnetBitcoinAddress', () => {
  it.each([
    'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
    'bc1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3qccfmv3',
    'bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr',
    '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2',
    '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy',
  ])('accepts %s', (address) => {
    expect(isMainnetBitcoinAddress(address)).toBe(true);
  });

  it.each([
    '',
    'hello',
    'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
    'BC1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7KV8F3T4',
    'bc1pw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
    'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4b',
    ' bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
    'bitcoin:bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
    '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN0',
    'mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn',
  ])('rejects %j', (value) => {
    expect(isMainnetBitcoinAddress(value)).toBe(false);
  });
});
