import { describe, expect, it } from 'vitest';
import { FORUM_MESSAGE_MAX_LENGTH } from '@/lib/api-types';
import {
  HABIT_NAME_MAX_LENGTH,
  HABIT_TEXT_MAX_LENGTH,
  PLACE_LABEL_MAX_LENGTH,
  composerTextProblem,
  entryTextProblem,
  habitTextProblem,
  optionalTextProblem,
  placeLabelProblem,
  replyTextIsTooLong,
  shownEntryProblem,
} from '@/lib/entry-text';

describe('entryTextProblem', () => {
  it('returns empty, then too long, and accepts the limit', () => {
    expect(entryTextProblem('', 8)).toBe('empty');
    expect(entryTextProblem('   ', 8)).toBe('empty');
    expect(entryTextProblem('  hello  ', 5)).toBeNull();
    expect(entryTextProblem('hello!', 5)).toBe('tooLong');
  });
});

describe('optionalTextProblem', () => {
  it('allows blank text and rejects only the limit', () => {
    expect(optionalTextProblem('', 3)).toBeNull();
    expect(optionalTextProblem('   ', 3)).toBeNull();
    expect(optionalTextProblem('abc', 3)).toBeNull();
    expect(optionalTextProblem(' abcd ', 3)).toBe('tooLong');
  });
});

describe('composerTextProblem', () => {
  it('allows an empty message when media is attached and never allows over-length', () => {
    expect(composerTextProblem('', 4, false)).toBe('empty');
    expect(composerTextProblem('   ', 4, true)).toBeNull();
    expect(composerTextProblem('hello', 4, true)).toBe('tooLong');
    expect(composerTextProblem('hey', 4, false)).toBeNull();
  });
});

describe('replyTextIsTooLong', () => {
  it('counts the reply prefix only when this submit stores it', () => {
    const parentId = 'p';
    const overhead = `inReplyTo:${parentId}\n`.length;
    expect(replyTextIsTooLong('hello', null, false, true)).toBe(false);
    expect(replyTextIsTooLong('a'.repeat(FORUM_MESSAGE_MAX_LENGTH + 1), null, true, false)).toBe(
      true,
    );
    expect(
      replyTextIsTooLong(
        'a'.repeat(FORUM_MESSAGE_MAX_LENGTH - overhead + 1),
        parentId,
        false,
        true,
      ),
    ).toBe(true);
    expect(
      replyTextIsTooLong('a'.repeat(FORUM_MESSAGE_MAX_LENGTH - overhead + 1), parentId, true, true),
    ).toBe(false);
    expect(replyTextIsTooLong('a'.repeat(FORUM_MESSAGE_MAX_LENGTH), parentId, false, true)).toBe(
      true,
    );
    expect(replyTextIsTooLong('a'.repeat(FORUM_MESSAGE_MAX_LENGTH), parentId, false, false)).toBe(
      false,
    );
  });
});

describe('shownEntryProblem', () => {
  it('hides an untouched empty problem and shows every other problem at once', () => {
    expect(shownEntryProblem('empty', false)).toBeNull();
    expect(shownEntryProblem('empty', true)).toBe('empty');
    expect(shownEntryProblem('tooLong', false)).toBe('tooLong');
    expect(shownEntryProblem(null, true)).toBeNull();
  });
});

describe('placeLabelProblem', () => {
  it('allows a blank name, rejects 81 characters, and names a control in a shorter name', () => {
    expect(placeLabelProblem('')).toBeNull();
    expect(placeLabelProblem('  ')).toBeNull();
    expect(placeLabelProblem('a'.repeat(PLACE_LABEL_MAX_LENGTH))).toBeNull();
    expect(placeLabelProblem('a'.repeat(PLACE_LABEL_MAX_LENGTH + 1))).toBe('tooLong');
    expect(placeLabelProblem(`${'a'.repeat(PLACE_LABEL_MAX_LENGTH + 1)}\u007f`)).toBe('tooLong');
    expect(placeLabelProblem('Cafe\nLuna')).toBe('controls');
    expect(placeLabelProblem('Cafe\u007f')).toBe('controls');
  });
});

describe('habitTextProblem', () => {
  it('trims the name and comment, and counts description and notes raw', () => {
    expect(habitTextProblem('name', '  ')).toBe('empty');
    expect(habitTextProblem('name', 'a'.repeat(HABIT_NAME_MAX_LENGTH))).toBeNull();
    expect(habitTextProblem('name', 'a'.repeat(HABIT_NAME_MAX_LENGTH + 1))).toBe('tooLong');
    expect(habitTextProblem('name', '👍'.repeat(80))).toBeNull();
    expect(habitTextProblem('name', '👍'.repeat(81))).toBe('tooLong');
    expect(habitTextProblem('comment', '')).toBe('empty');
    expect(habitTextProblem('comment', 'a'.repeat(HABIT_TEXT_MAX_LENGTH))).toBeNull();
    expect(habitTextProblem('comment', ` ${'a'.repeat(HABIT_TEXT_MAX_LENGTH)} `)).toBeNull();
    expect(habitTextProblem('description', '')).toBeNull();
    expect(habitTextProblem('description', ' '.repeat(HABIT_TEXT_MAX_LENGTH))).toBeNull();
    expect(habitTextProblem('notes', ' '.repeat(HABIT_TEXT_MAX_LENGTH + 1))).toBe('tooLong');
    expect(habitTextProblem('description', '👍'.repeat(HABIT_TEXT_MAX_LENGTH))).toBeNull();
    expect(habitTextProblem('description', '👍'.repeat(HABIT_TEXT_MAX_LENGTH + 1))).toBe('tooLong');
  });
});
