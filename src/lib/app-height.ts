/**
 * Blocking bootstrap JS (IIFE). Sets `--app-height` to
 * `max(visualViewport.height, innerHeight)` (fallback `innerHeight`).
 * Injected as a raw head script before paint. First paint is unfocused,
 * so this matches the unfocused resolver. Skips the write when
 * `visualViewport.scale` is present and not ≈ 1.
 *
 * This module is imported from the server root layout and must not import
 * React hooks.
 */
export const APP_HEIGHT_BOOTSTRAP_SCRIPT =
  "(function(){function setAppHeight(){var vv=window.visualViewport;if(vv&&typeof vv.scale==='number'&&Math.abs(vv.scale-1)>0.01){return;}var h=vv?Math.max(vv.height,window.innerHeight):window.innerHeight;document.documentElement.style.setProperty('--app-height',Math.round(h)+'px');}setAppHeight();})();";

/** Minimal visual-viewport fields used to resolve `--app-height`. */
export interface AppHeightViewport {
  readonly height: number;
  readonly scale?: number;
}

/**
 * Pixel height for `--app-height`, or null to skip the write (pinch-zoom).
 *
 * @param innerHeight - `window.innerHeight`
 * @param visualViewport - `window.visualViewport` or a test stub; null/undefined falls back to innerHeight
 * @param textFieldFocused - true when the active element is a text field (keyboard likely open)
 * @returns Rounded CSS-pixel height, or null when scale is present and not ≈ 1
 */
export function resolveAppHeight(
  innerHeight: number,
  visualViewport: AppHeightViewport | null | undefined,
  textFieldFocused: boolean,
): number | null {
  if (
    visualViewport !== null &&
    visualViewport !== undefined &&
    typeof visualViewport.scale === 'number' &&
    Math.abs(visualViewport.scale - 1) > 0.01
  ) {
    return null;
  }
  const vvH =
    visualViewport === null || visualViewport === undefined ? innerHeight : visualViewport.height;
  if (textFieldFocused) {
    return Math.round(vvH);
  }
  return Math.round(Math.max(vvH, innerHeight));
}
