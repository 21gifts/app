import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CameraPhotoButton } from '@/components/CameraPhotoButton';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function cameraInput(): HTMLInputElement {
  return document.querySelector('input[type="file"]') as HTMLInputElement;
}

describe('CameraPhotoButton', () => {
  it('is an icon-only button named by its label', () => {
    render(<CameraPhotoButton label="Take a photo" onChange={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Take a photo' });
    expect(button.getAttribute('title')).toBe('Take a photo');
    expect(button.className).toContain('h-11 w-11');
    expect(button.querySelector('svg')?.getAttribute('class')).toContain('h-4 w-4');
    expect(screen.queryByText('Take a photo')).toBeNull();
  });

  it('backs the button with a hidden back-camera photo input by default', () => {
    render(<CameraPhotoButton label="Take a photo" onChange={vi.fn()} />);
    const input = cameraInput();
    expect(input.getAttribute('accept')).toBe('image/*');
    expect(input.getAttribute('capture')).toBe('environment');
    expect(input.hasAttribute('multiple')).toBe(false);
    expect(input.hasAttribute('name')).toBe(false);
    expect(input.className).toBe('hidden');
  });

  it('asks for the front camera and names the input when told to', () => {
    render(
      <CameraPhotoButton
        label="Take a profile photo"
        facing="user"
        name="profile-photo-camera"
        onChange={vi.fn()}
      />,
    );
    const input = cameraInput();
    expect(input.getAttribute('capture')).toBe('user');
    expect(input.getAttribute('name')).toBe('profile-photo-camera');
  });

  it('paints the large size beside a large gallery button', () => {
    render(<CameraPhotoButton label="Take a photo" size="lg" onChange={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Take a photo' });
    expect(button.className).toContain('h-12 w-12');
    expect(button.querySelector('svg')?.getAttribute('class')).toContain('h-5 w-5');
  });

  it('opens its own input on press and hands the change to the shared handler', () => {
    const onChange = vi.fn();
    render(<CameraPhotoButton label="Take a photo" onChange={onChange} />);
    const input = cameraInput();
    const click = vi.spyOn(input, 'click');
    fireEvent.click(screen.getByRole('button', { name: 'Take a photo' }));
    expect(click).toHaveBeenCalledTimes(1);

    const photo = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'image.jpg', {
      type: 'image/jpeg',
    });
    fireEvent.change(input, { target: { files: [photo] } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0].target).toBe(input);
  });

  it('disables the button and its input together', () => {
    render(<CameraPhotoButton label="Take a photo" disabled onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Take a photo' }).hasAttribute('disabled')).toBe(
      true,
    );
    expect(cameraInput().disabled).toBe(true);
  });
});
