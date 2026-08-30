// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { THEME_BOOTSTRAP_SCRIPT, parseThemePreference, resolveTheme } from '@/lib/theme';

describe('parseThemePreference', () => {
  it('returns system when the value is missing', () => {
    expect(parseThemePreference(undefined)).toBe('system');
  });

  it('returns system when the value is invalid', () => {
    expect(parseThemePreference('')).toBe('system');
    expect(parseThemePreference('auto')).toBe('system');
    expect(parseThemePreference('DARK')).toBe('system');
  });

  it('accepts light and dark', () => {
    expect(parseThemePreference('light')).toBe('light');
    expect(parseThemePreference('dark')).toBe('dark');
  });
});

describe('resolveTheme', () => {
  it('forces light regardless of OS preference', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('light', false)).toBe('light');
  });

  it('forces dark regardless of OS preference', () => {
    expect(resolveTheme('dark', true)).toBe('dark');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('follows prefersDark when preference is system', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });
});

describe('THEME_BOOTSTRAP_SCRIPT', () => {
  it('is a non-empty IIFE string that reads the theme cookie and color scheme', () => {
    expect(THEME_BOOTSTRAP_SCRIPT.length).toBeGreaterThan(0);
    expect(THEME_BOOTSTRAP_SCRIPT.startsWith('(function(){')).toBe(true);
    expect(THEME_BOOTSTRAP_SCRIPT).toContain('theme=');
    expect(THEME_BOOTSTRAP_SCRIPT).toContain('prefers-color-scheme');
    expect(THEME_BOOTSTRAP_SCRIPT).toContain('classList');
    expect(THEME_BOOTSTRAP_SCRIPT).toContain('decodeURIComponent');
    expect(THEME_BOOTSTRAP_SCRIPT).toContain("catch(d){raw='';}");
  });
});
