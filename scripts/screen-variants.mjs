/**
 * Every distinct UI state of every public screen. Handbook, e2e:check, and
 * screenshot:check all read this list — adding a state without a variant here
 * is how coverage silently drops.
 *
 * `needle` must appear in e2e/*.spec.ts (the behavioral assertion for that state).
 * `image` is docs/handbook/images/<file> (copied to public/handbook-images/).
 */
export const SCREEN_VARIANTS = [
  {
    route: '/',
    id: 'default',
    image: 'root.png',
    needle: 'Direct human-to-human gifts',
  },
  {
    route: '/',
    id: 'mobile-nav',
    image: 'root-mobile-nav.png',
    needle: "getByRole('button', { name: 'Menu' })",
  },
  {
    route: '/legal',
    id: 'default',
    image: 'legal.png',
    needle: 'Legal Notice',
  },
  {
    route: '/login',
    id: 'idle',
    image: 'login.png',
    needle: 'Log in with Wallet of Satoshi',
  },
  {
    route: '/login',
    id: 'starting',
    image: 'login-starting.png',
    needle: 'Preparing your login',
  },
  {
    route: '/login',
    id: 'qr',
    image: 'login-qr.png',
    needle: 'Login QR code',
  },
  {
    route: '/login',
    id: 'qr-android',
    image: 'login-qr-android.png',
    needle: 'package=com.livingroomofsatoshi.wallet',
  },
  {
    route: '/login',
    id: 'expired',
    image: 'login-expired.png',
    needle: 'Login expired',
  },
  {
    route: '/login',
    id: 'error',
    image: 'login-error.png',
    needle: 'Something went wrong. Please try again.',
  },
  {
    route: '/login',
    id: 'signed-in',
    image: 'login-signed-in.png',
    needle: 'Signed in',
  },
  {
    route: '/login',
    id: 'signed-in-linked',
    image: 'login-signed-in-linked.png',
    needle: "getByRole('button', { name: 'Unlink' })",
  },
  {
    route: '/donate',
    id: 'form',
    image: 'donate.png',
    needle: 'Send a gift',
  },
  {
    route: '/donate',
    id: 'busy',
    image: 'donate-busy.png',
    needle: "getByRole('button', { name: 'Cancel' })",
  },
  {
    route: '/donate',
    id: 'validation-error',
    image: 'donate-validation-error.png',
    needle: 'Enter a Wallet of Satoshi address',
  },
  {
    route: '/donate',
    id: 'invoice',
    image: 'donate-invoice.png',
    needle: 'Pay 21 sats',
  },
  {
    route: '/donate',
    id: 'invoice-android',
    image: 'donate-invoice-android.png',
    needle: 'intent:lightning:LNBC21N1EXAMPLEINVOICE',
  },
  {
    route: '/handbook',
    id: 'default',
    image: 'handbook.png',
    needle: "getByRole('heading', { name: 'Handbook' })",
  },
  {
    route: '/handbook',
    id: 'copied',
    image: 'handbook-copied.png',
    needle: "toHaveText('Copied')",
  },
  {
    route: '/404',
    id: 'default',
    image: 'not-found.png',
    needle: "getByRole('heading', { name: '404' })",
  },
];
