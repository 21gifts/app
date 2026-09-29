/**
 * Blocking bootstrap JS (IIFE). Sets `--app-height` to the visible viewport
 * (`visualViewport.height`, else `innerHeight`) and writes viewport offset to
 * its own property, never into the height. A taller frame is a second scroll.
 * Injected before paint and skipped while pinch-zoomed.
 *
 * This module is imported from the server root layout and must not import
 * React hooks.
 */
// The visual viewport offset is written separately and is never part of the height.
export const APP_HEIGHT_BOOTSTRAP_SCRIPT =
  "(function(){function setAppHeight(){var vv=window.visualViewport;if(vv&&typeof vv.scale==='number'&&Math.abs(vv.scale-1)>0.01){return;}var h=vv?vv.height:window.innerHeight;var top=vv&&typeof vv.offsetTop==='number'?Math.round(vv.offsetTop):0;document.documentElement.style.setProperty('--app-height',Math.round(h)+'px');document.documentElement.style.setProperty('--app-offset-top',top+'px');}setAppHeight();})();";

/**
 * Pixel offset for `--app-offset-top`, or null to skip the write (pinch-zoom).
 *
 * @param visualViewport - `window.visualViewport` or a test stub; null/undefined is offset 0
 * @returns Rounded CSS-pixel offset, 0 when there is no viewport, or null when scale is present and not ≈ 1
 */
export function resolveAppOffsetTop(
  visualViewport: AppHeightViewport | null | undefined,
): number | null {
  if (
    visualViewport &&
    typeof visualViewport.scale === 'number' &&
    Math.abs(visualViewport.scale - 1) > 0.01
  ) {
    return null;
  }

  if (!visualViewport) return 0;
  return Math.round(visualViewport.offsetTop ?? 0);
}

/** Minimal visual-viewport fields used to resolve `--app-height`. */
export interface AppHeightViewport {
  readonly height: number;
  readonly offsetTop?: number;
  readonly scale?: number;
}

/**
 * Pixel height for `--app-height`, or null to skip the write (pinch-zoom).
 *
 * @param innerHeight - `window.innerHeight`
 * @param visualViewport - `window.visualViewport` or a test stub; null/undefined falls back to innerHeight
 * @returns Rounded visible CSS-pixel height, or null when scale is present and not ≈ 1
 */
export function resolveAppHeight(
  innerHeight: number,
  visualViewport: AppHeightViewport | null | undefined,
): number | null {
  if (
    visualViewport !== null &&
    visualViewport !== undefined &&
    typeof visualViewport.scale === 'number' &&
    Math.abs(visualViewport.scale - 1) > 0.01
  ) {
    return null;
  }
  if (visualViewport === null || visualViewport === undefined) {
    return Math.round(innerHeight);
  }
  return Math.round(visualViewport.height);
}
