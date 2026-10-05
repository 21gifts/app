/**
 * Whether `nowMs` falls from Sunday 00:00 through Monday before 08:00 in a zone.
 * Omit `timeZone` to use the runtime zone. Invalid zones return false.
 *
 * @param nowMs - Epoch milliseconds.
 * @param timeZone - IANA zone. Omitted means the runtime zone.
 * @returns True during the local rest interval. False for an invalid zone.
 */
export function isLocalSunday(nowMs: number, timeZone?: string): boolean {
  try {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      hour: 'numeric',
      hourCycle: 'h23',
    };
    if (timeZone !== undefined) {
      options.timeZone = timeZone;
    }
    const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(nowMs);
    const values = new Map(parts.map((part) => [part.type, part.value]));
    const weekday = values.get('weekday');
    const hour = Number(values.get('hour'));
    return weekday === 'Sun' || (weekday === 'Mon' && hour < 8);
  } catch {
    return false;
  }
}

/**
 * Sets `documentElement.dataset.localSunday` before paint.
 * Instant is sessionStorage `e2e-now`, else `meta[name=e2e-now]`, else the clock.
 * Rest ends at Monday 08:00 in the device zone; open tabs update at that boundary.
 */
export const SUNDAY_BOOTSTRAP_SCRIPT =
  "(function(){function nowMs(){var pinned=null;try{pinned=sessionStorage.getItem('e2e-now');}catch(s){pinned=null;}if(!pinned){var meta=document.querySelector('meta[name=\"e2e-now\"]');if(meta){pinned=meta.getAttribute('content');}}return pinned?new Date(pinned):new Date();}function apply(){try{var now=nowMs();var sunday=false;try{var parts=new Intl.DateTimeFormat('en-US',{weekday:'short',hour:'numeric',hourCycle:'h23'}).formatToParts(now);var weekday=parts.find(function(p){return p.type==='weekday';}).value;var hour=Number(parts.find(function(p){return p.type==='hour';}).value);sunday=weekday==='Sun'||(weekday==='Mon'&&hour<8);}catch(i){sunday=false;}document.documentElement.dataset.localSunday=sunday?'1':'0';}catch(e){try{document.documentElement.dataset.localSunday='0';}catch(e2){}}}function arm(){var now=nowMs();var next=new Date(now.getTime());next.setHours(now.getDay()===1&&now.getHours()<8?8:24,0,0,0);var delay=next.getTime()-now.getTime();if(!(delay>0))delay=1000;setTimeout(function(){apply();arm();},delay);}apply();document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')apply();});document.addEventListener('DOMContentLoaded',apply);arm();})();";
