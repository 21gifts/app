import { describe, expect, it } from 'vitest';
import { Button, Card, Field, IconButton, PageChrome } from '@/components/ui';

describe('ui barrel', () => {
  it('re-exports the primitives', () => {
    expect(Button).toBeTypeOf('function');
    expect(Card).toBeTypeOf('function');
    expect(Field).toBeTypeOf('function');
    expect(IconButton).toBeTypeOf('function');
    expect(PageChrome).toBeTypeOf('function');
  });
});
