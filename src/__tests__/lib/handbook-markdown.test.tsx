import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { renderWithLocale } from '@/__tests__/render-with-locale';
import { HandbookMarkdown, parseHandbookMarkdown } from '@/lib/handbook-markdown';

afterEach(cleanup);

describe('parseHandbookMarkdown', () => {
  it('returns no blocks for empty markdown', () => {
    expect(parseHandbookMarkdown('', 'readme')).toEqual([]);
    expect(parseHandbookMarkdown('\n\n', 'readme')).toEqual([]);
  });

  it('normalises CRLF and builds heading ids', () => {
    const blocks = parseHandbookMarkdown('# Hello World\r\n\r\n## Next\r\n', 'screens');
    expect(blocks[0]).toMatchObject({ type: 'heading', level: 1, id: 'screens-hello-world' });
    expect(blocks[1]).toMatchObject({ type: 'heading', level: 2, id: 'screens-next' });
  });

  it('disambiguates duplicate heading ids', () => {
    const blocks = parseHandbookMarkdown('### Variant: default\n### Variant: default\n', 'screens');
    expect(blocks[0]).toMatchObject({ type: 'heading', id: 'screens-variant-default' });
    expect(blocks[1]).toMatchObject({ type: 'heading', id: 'screens-variant-default-2' });
  });

  it('parses h3 and h4', () => {
    const blocks = parseHandbookMarkdown('### Three\n#### Four\n', 'x');
    expect(blocks[0]).toMatchObject({ type: 'heading', level: 3, id: 'x-three' });
    expect(blocks[1]).toMatchObject({ type: 'heading', level: 4, id: 'x-four' });
  });

  it('joins paragraph lines and flushes on a blank line', () => {
    const blocks = parseHandbookMarkdown('Hello\nworld.\n\nNext para\n', 'x');
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ type: 'paragraph' });
    expect(JSON.stringify(blocks[0])).toContain('Hello world.');
  });

  it('groups consecutive list items and closes before a paragraph', () => {
    const blocks = parseHandbookMarkdown('- one\n- two\nAfter\n', 'x');
    expect(blocks[0]?.type).toBe('list');
    expect(blocks[1]?.type).toBe('paragraph');
    if (blocks[0]?.type === 'list') {
      expect(blocks[0].items).toHaveLength(2);
    }
  });

  it('closes a trailing list at EOF', () => {
    const blocks = parseHandbookMarkdown('- only\n', 'x');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.type).toBe('list');
  });

  it('parses inline code and strong', () => {
    const blocks = parseHandbookMarkdown('Use `code` and **bold** text\n', 'x');
    expect(JSON.stringify(blocks)).toContain('"type":"code"');
    expect(JSON.stringify(blocks)).toContain('"type":"strong"');
  });

  it('rewrites relative markdown links to the target file id, not the source prefix', () => {
    const blocks = parseHandbookMarkdown(
      'See [screens](screens.md) and [frag](screens.md#Screen: /) and [here](#faq)\n',
      'readme',
    );
    const json = JSON.stringify(blocks);
    expect(json).toContain('/handbook/screens');
    expect(json).toContain('/handbook/screens#screens-screen');
    expect(json).toContain('#readme-faq');
    expect(json).not.toContain('#readme-screens');
    const emptyFrag = parseHandbookMarkdown('[x](screens.md#---)\n', 'readme');
    expect(JSON.stringify(emptyFrag)).toContain('"/handbook/screens"');
  });

  it('rewrites non-page relative markdown links to in-page hashes', () => {
    const blocks = parseHandbookMarkdown(
      '[a](intro.md) [b](intro.md#Foo Bar) [c](intro.md#---)\n',
      'readme',
    );
    const json = JSON.stringify(blocks);
    expect(json).toContain('"href":"#intro"');
    expect(json).toContain('"href":"#intro-foo-bar"');
  });

  it('keeps http(s) and absolute paths', () => {
    const blocks = parseHandbookMarkdown(
      '[a](https://21.gifts) [b](http://example.com) [c](/legal)\n',
      'x',
    );
    const json = JSON.stringify(blocks);
    expect(json).toContain('https://21.gifts');
    expect(json).toContain('http://example.com');
    expect(json).toContain('/legal');
  });

  it('maps images/ to /handbook-images and assets/ to a root path', () => {
    const blocks = parseHandbookMarkdown(
      '![login](images/login.png) ![og](./assets/og.png) ![nested](images/nested/donate.png)\n',
      'x',
    );
    const json = JSON.stringify(blocks);
    expect(json).toContain('/handbook-images/login.png');
    expect(json).toContain('/assets/og.png');
    expect(json).toContain('/handbook-images/donate.png');
  });

  it('drops traversal image hrefs and unknown links to plain text', () => {
    const blocks = parseHandbookMarkdown(
      '![](../secret.png) [up](../screens.md) [](javascript:alert(1)) [ok](#) ![keep](images/login.png)\n',
      'x',
    );
    const json = JSON.stringify(blocks);
    expect(json).not.toContain('../secret');
    expect(json).not.toContain('../screens');
    expect(json).not.toContain('javascript:');
    expect(json).toContain('#x');
    expect(json).toContain('"type":"text"');
    expect(json).toContain('up');
  });

  it('keeps jpeg gif svg webp image hrefs without dots-dots', () => {
    const blocks = parseHandbookMarkdown(
      '![a](images/a.jpeg) ![b](images/b.jpg) ![c](images/c.gif) ![d](images/d.svg) ![e](images/e.webp)\n',
      'x',
    );
    const json = JSON.stringify(blocks);
    expect(json).toContain('/handbook-images/a.jpeg');
    expect(json).toContain('/handbook-images/b.jpg');
    expect(json).toContain('/handbook-images/c.gif');
    expect(json).toContain('/handbook-images/d.svg');
    expect(json).toContain('/handbook-images/e.webp');
  });
});

describe('HandbookMarkdown', () => {
  it('renders headings, a list, a link, code, strong, and an image figure', () => {
    renderWithLocale(
      <HandbookMarkdown
        markdown={
          '# Title\n\n## Sub\n\n### H3\n\n#### H4\n\n- item\n\nSee `x` and **y** and [z](/legal)\n\n![login](images/login.png)\n'
        }
        idPrefix="screens"
      />,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Title' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Sub' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 3, name: 'H3' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 4, name: 'H4' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy link to Title' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy link to Sub' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy link to H3' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy link to H4' })).toBeTruthy();
    expect(screen.getByText('item')).toBeTruthy();
    expect(screen.getByText('x')).toBeTruthy();
    expect(screen.getByText('y')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'z' }).getAttribute('href')).toBe('/legal');
    expect(screen.getByAltText('login').getAttribute('src')).toBe('/handbook-images/login.png');
    expect(document.getElementById('screens-image-login')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy link to login' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open login at full size' })).toBeTruthy();
    expect(screen.queryByText('Open login at full size')).toBeNull();
  });

  it('keeps mixed text+image paragraphs as a normal paragraph', () => {
    renderWithLocale(
      <HandbookMarkdown markdown={'Before ![shot](images/x.png) after\n'} idPrefix="x" />,
    );
    expect(screen.getByText(/Before/)).toBeTruthy();
    expect(screen.getByAltText('shot').getAttribute('src')).toBe('/handbook-images/x.png');
    expect(document.getElementById('x-image-shot')).toBeNull();
  });

  it('uses link text and image alt as the copy-link label', () => {
    renderWithLocale(
      <HandbookMarkdown markdown={'# [Go](/legal) ![shot](images/x.png)\n'} idPrefix="x" />,
    );
    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy link to Go shot' })).toBeTruthy();
  });
});
