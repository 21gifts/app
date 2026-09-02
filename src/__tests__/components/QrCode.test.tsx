import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { QrCode } from '@/components/QrCode';

afterEach(cleanup);

describe('QrCode', () => {
  it('renders an accessible QR image for the value', () => {
    render(<QrCode value="LNURL1TEST" label="Login QR code" />);
    expect(screen.getByRole('img', { name: 'Login QR code' })).toBeTruthy();
  });

  it('renders the QR as an SVG on the app-qr plate with black/white modules', () => {
    const { container } = render(<QrCode value="LNURL1TEST" label="Login QR code" />);
    const plate = screen.getByRole('img', { name: 'Login QR code' });
    expect(plate.className).toContain('bg-app-qr-bg');
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.innerHTML).toContain('#000000');
    expect(svg?.innerHTML).toContain('#ffffff');
  });

  it('uses a custom accessible name when given', () => {
    render(<QrCode value="lnbc1" label="Bitcoin payment QR code" />);
    expect(screen.getByRole('img', { name: 'Bitcoin payment QR code' })).toBeTruthy();
  });
});
