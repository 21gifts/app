import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MessageKindTags, noteKinds } from '@/components/MessageKindTags';
import { renderWithLocale } from '@/__tests__/render-with-locale';

afterEach(() => {
  cleanup();
});

describe('noteKinds', () => {
  it('marks a repayable ask as a loan and keeps a shop hashtag', () => {
    expect(
      noteKinds({ parentId: null, text: 'train #21GiftsShop', goalSats: 21, goalRepayable: true }),
    ).toEqual(['loan', 'shop']);
  });

  it('marks any other ask as a donation and ignores a reply', () => {
    expect(noteKinds({ text: 'help', goalSats: 21 })).toEqual(['donation']);
    expect(noteKinds({ parentId: 'parent', text: 'help #21GiftsShop', goalSats: 21 })).toEqual([]);
    expect(noteKinds({ text: 'plain' })).toEqual([]);
  });
});

describe('MessageKindTags', () => {
  it('explains a loan and hides that explanation on the next press', () => {
    renderWithLocale(
      <MessageKindTags kinds={['loan']}>
        <span>Ada</span>
      </MessageKindTags>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Loan' }));
    expect(screen.getByRole('status').textContent).toMatch(/paid back/i);
    fireEvent.click(screen.getByRole('button', { name: 'Loan' }));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('keeps the shop tag as a link to the shop list', () => {
    renderWithLocale(
      <MessageKindTags kinds={['shop']}>
        <span>Ada</span>
      </MessageKindTags>,
    );
    expect(screen.getByRole('link', { name: '#Shop' }).getAttribute('href')).toBe('/shops');
  });
});
