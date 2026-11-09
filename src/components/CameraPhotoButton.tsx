'use client';

import { Camera } from 'lucide-react';
import { useRef, type ChangeEvent, type ReactElement } from 'react';
import { IconButton } from '@/components/ui';

/** Which phone camera {@link CameraPhotoButton} asks for. */
export type CameraFacing = 'environment' | 'user';

/** Props for {@link CameraPhotoButton}. */
export interface CameraPhotoButtonProps {
  /** Accessible name and tooltip of the icon button (a catalog string). */
  label: string;
  /** `environment` (back camera) or `user` (front camera). Default `environment`. */
  facing?: CameraFacing;
  /** Painted size of the icon button; match the gallery button beside it. Default `md`. */
  size?: 'md' | 'lg';
  /** Disables the button and its file input. */
  disabled?: boolean;
  /** Optional `name` on the hidden file input. */
  name?: string;
  /**
   * The change handler of the gallery input beside this button, so a camera
   * photo runs through the same checks, resize, and limits.
   */
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

/**
 * Camera icon button with its own hidden photo input.
 *
 * The input is `accept="image/*"` with `capture`, so a phone opens its camera
 * instead of the photo picker. A desktop browser ignores `capture` and opens
 * its file dialog. One photo per press; video stays on the gallery button.
 *
 * @param props - Label, camera, size, disabled state, and the shared change handler.
 * @returns The camera button followed by its hidden input.
 */
export function CameraPhotoButton({
  label,
  facing = 'environment',
  size = 'md',
  disabled = false,
  name,
  onChange,
}: CameraPhotoButtonProps): ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <IconButton
        type="button"
        size={size}
        variant="secondary"
        aria-label={label}
        title={label}
        disabled={disabled}
        onClick={() => {
          inputRef.current?.click();
        }}
      >
        <Camera
          aria-hidden="true"
          className={size === 'lg' ? 'block h-5 w-5 shrink-0' : 'block h-4 w-4 shrink-0'}
        />
      </IconButton>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture={facing}
        className="hidden"
        disabled={disabled}
        onChange={onChange}
        {...(name === undefined ? {} : { name })}
      />
    </>
  );
}
