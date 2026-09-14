/**
 * Blocking bootstrap JS (IIFE). Sets `--app-height` from `visualViewport.height`
 * (fallback `innerHeight`). Injected as a raw head script before paint.
 * Skips the write when `visualViewport.scale` is present and not ≈ 1.
 *
 * This module is imported from the server root layout and must not import
 * React hooks.
 */
export const APP_HEIGHT_BOOTSTRAP_SCRIPT =
  "(function(){function setAppHeight(){var vv=window.visualViewport;if(vv&&typeof vv.scale==='number'&&Math.abs(vv.scale-1)>0.01){return;}var h=vv?vv.height:window.innerHeight;document.documentElement.style.setProperty('--app-height',Math.round(h)+'px');}setAppHeight();})();";
