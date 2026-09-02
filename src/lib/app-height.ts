/**
 * Blocking bootstrap JS (IIFE). Sets `--app-height` from `visualViewport.height`
 * (fallback `innerHeight`). Injected as a raw head script before paint.
 *
 * This module is imported from the server root layout and must not import
 * React hooks.
 */
export const APP_HEIGHT_BOOTSTRAP_SCRIPT =
  "(function(){function setAppHeight(){var h=window.visualViewport?window.visualViewport.height:window.innerHeight;document.documentElement.style.setProperty('--app-height',Math.round(h)+'px');}setAppHeight();})();";
