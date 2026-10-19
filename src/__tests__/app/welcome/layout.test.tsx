import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import WelcomeLayout, { metadata } from '@/app/welcome/layout';

afterEach(cleanup);

describe('WelcomeLayout', () => {
  it('keeps the living room out of the search index', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it('renders children unchanged', () => {
    render(<WelcomeLayout>living room</WelcomeLayout>);
    expect(screen.getByText('living room')).toBeTruthy();
  });
});
