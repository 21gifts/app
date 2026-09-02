import { isInAppBrowser } from '@/lib/in-app-browser';
import { isStandaloneDisplay } from '@/lib/push';

/**
 * iPhone/iPod browser whose UA contains Safari (stock Safari, CriOS, FxiOS, EdgiOS).
 */
function isIosHomeScreenBrowser(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPod/i.test(ua) && /Safari/i.test(ua);
}

/**
 * True when an iPhone/iPod Home Screen browser is not standalone and not in-app.
 *
 * @returns Whether the iOS Home Screen install sheet should be offered.
 */
export function shouldOfferIosInstall(): boolean {
  return isIosHomeScreenBrowser() && !isStandaloneDisplay() && !isInAppBrowser();
}
