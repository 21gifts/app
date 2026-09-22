import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { QrCode } from '@/components/QrCode';

afterEach(cleanup);

describe('QrCode', () => {
  it('renders an accessible QR image for the value', () => {
    const { container } = render(<QrCode value="LNURL1TEST" label="Login QR code" />);
    expect(screen.getByRole('img', { name: 'Login QR code' })).toBeTruthy();
    expect(container.querySelector('svg image')).toBeNull();
  });

  it('renders the QR as an SVG on the app-qr plate with black/white modules', () => {
    const { container } = render(<QrCode value="LNURL1TEST" label="Login QR code" />);
    const plate = screen.getByRole('img', { name: 'Login QR code' });
    expect(plate.className).toContain('bg-app-qr-bg');
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.innerHTML).toContain('#000000');
    expect(svg?.innerHTML).toContain('#ffffff');
    expect(container.querySelector('svg image')).toBeNull();
  });

  it('uses a custom accessible name when given', () => {
    const { container } = render(<QrCode value="lnbc1" label="Bitcoin payment QR code" />);
    expect(screen.getByRole('img', { name: 'Bitcoin payment QR code' })).toBeTruthy();
    expect(container.querySelector('svg image')).toBeNull();
  });

  it('embeds the logo URL in the SVG when logo is set', () => {
    const { container } = render(
      <QrCode value="LNURL1TEST" label="Login QR code" logo="/apple-touch-icon.png" />,
    );
    const svg = container.querySelector('svg');
    expect(svg?.innerHTML).toContain('apple-touch-icon.png');
  });

  it('treats an empty logo as a plain QR', () => {
    const { container } = render(<QrCode value="LNURL1TEST" label="Login QR code" logo="" />);
    expect(container.querySelector('svg image')).toBeNull();
  });
});
