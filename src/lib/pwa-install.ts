import { isInAppBrowser } from '@/lib/in-app-browser';
import { isIosSafari, isStandaloneDisplay } from '@/lib/push';

/**
 * True when iPhone/iPod Safari is not standalone and not an in-app browser.
 *
 * @returns Whether the iOS Home Screen install sheet should be offered.
 */
export function shouldOfferIosInstall(): boolean {
  return isIosSafari() && !isStandaloneDisplay() && !isInAppBrowser();
}
