/**
 * Whether `nowMs` falls on Sunday in an IANA zone.
 * Omit `timeZone` to use the runtime zone. Invalid zones return false.
 *
 * @param nowMs - Epoch milliseconds.
 * @param timeZone - IANA zone. Omitted means the runtime zone.
 * @returns True on Sunday in that zone. False for an invalid zone.
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

/**
 * Sets `documentElement.dataset.localSunday` before paint.
 * Instant is sessionStorage `e2e-now`, else `meta[name=e2e-now]`, else the clock.
 * Weekday uses the device zone (no `timeZone` option).
 */
export const SUNDAY_BOOTSTRAP_SCRIPT =
  "(function(){function nowMs(){var pinned=null;try{pinned=sessionStorage.getItem('e2e-now');}catch(s){pinned=null;}if(!pinned){var meta=document.querySelector('meta[name=\"e2e-now\"]');if(meta){pinned=meta.getAttribute('content');}}return pinned?new Date(pinned):new Date();}function apply(){try{var now=nowMs();var sunday=false;try{sunday=new Intl.DateTimeFormat('en-US',{weekday:'short'}).format(now)==='Sun';}catch(i){sunday=false;}document.documentElement.dataset.localSunday=sunday?'1':'0';}catch(e){try{document.documentElement.dataset.localSunday='0';}catch(e2){}}}function arm(){var now=nowMs();var next=new Date(now.getTime());next.setHours(24,0,0,0);var delay=next.getTime()-now.getTime();if(!(delay>0))delay=1000;setTimeout(function(){apply();arm();},delay);}apply();document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')apply();});arm();})();";
