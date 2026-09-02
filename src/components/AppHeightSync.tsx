'use client';

import type { ReactElement } from 'react';
import { useAppHeight } from '@/lib/app-height';

/**
 * Client mount that keeps `--app-height` synced after hydration.
 *
 * @returns `null` (side-effect only).
 */
export function AppHeightSync(): ReactElement | null {
  useAppHeight();
  return null;
}
