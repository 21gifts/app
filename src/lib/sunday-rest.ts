/**
 * Whether `nowMs` falls on Sunday in an IANA zone.
 * Omit `timeZone` to use the runtime zone. Invalid zones return false.
 */
export function isLocalSunday(nowMs: number, timeZone?: string): boolean {
  try {
    const options: Intl.DateTimeFormatOptions = { weekday: 'short' };
    if (timeZone !== undefined) {
      options.timeZone = timeZone;
    }
    return new Intl.DateTimeFormat('en-US', options).format(nowMs) === 'Sun';
  } catch {
    return false;
  }
}

/** Hides public write fields before paint once `data-local-sunday="1"` is set. */
export const SUNDAY_WRITE_CSS =
  'html[data-local-sunday="1"] .sunday-write-field{display:none!important}html:not([data-local-sunday="1"]) .sunday-write-notice{display:none!important}';

/**
 * Sets `documentElement.dataset.localSunday` before paint.
 * Instant is sessionStorage `e2e-now`, else `meta[name=e2e-now]`, else the clock.
 * Weekday uses the device zone (no `timeZone` option).
 */
export const SUNDAY_BOOTSTRAP_SCRIPT =
  "(function(){try{var pinned=null;try{pinned=sessionStorage.getItem('e2e-now');}catch(s){pinned=null;}if(!pinned){var meta=document.querySelector('meta[name=\"e2e-now\"]');if(meta){pinned=meta.getAttribute('content');}}var now=pinned?new Date(pinned):new Date();var sunday=false;try{sunday=new Intl.DateTimeFormat('en-US',{weekday:'short'}).format(now)==='Sun';}catch(i){sunday=false;}document.documentElement.dataset.localSunday=sunday?'1':'0';}catch(e){try{document.documentElement.dataset.localSunday='0';}catch(e2){}}})();";
