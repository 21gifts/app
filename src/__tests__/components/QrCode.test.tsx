import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { QrCode } from '@/components/QrCode';

afterEach(cleanup);

describe('QrCode', () => {
  it('renders an accessible QR image for the value', () => {
    render(<QrCode value="LNURL1TEST" />);
    expect(screen.getByRole('img', { name: 'Lightning login QR code' })).toBeTruthy();
  });

  it('renders the QR as an SVG', () => {
    const { container } = render(<QrCode value="LNURL1TEST" />);
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('uses a custom accessible name when given', () => {
    render(<QrCode value="lnbc1" label="Lightning invoice QR code" />);
    expect(screen.getByRole('img', { name: 'Lightning invoice QR code' })).toBeTruthy();
  });
});
