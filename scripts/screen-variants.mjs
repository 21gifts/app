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
    needle: "getByRole('button', { name: 'Log in' })",
  },
  {
    route: '/login',
    id: 'starting',
    image: 'login-starting.png',
    needle: 'Preparing your login',
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
    id: 'signed-in-named',
    image: 'login-signed-in-named.png',
    needle: "getByText('Ada')",
  },
  {
    route: '/login',
    id: 'signed-in-linked',
    image: 'login-signed-in-linked.png',
    needle: "getByRole('heading', { name: 'Welcome, Ada' })",
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
    route: '/stats',
    id: 'default',
    image: 'stats.png',
    needle: 'Total spend over time',
  },
  {
    route: '/stats',
    id: 'usd-scale',
    image: 'stats-usd-scale.png',
    needle: 'Spend by month in USD',
  },
  {
    route: '/stats',
    id: 'empty',
    image: 'stats-empty.png',
    needle: 'No gifts recorded yet.',
  },
  {
    route: '/stats',
    id: 'loading',
    image: 'stats-loading.png',
    needle: 'Loading…',
  },
  {
    route: '/stats',
    id: 'error',
    image: 'stats-error.png',
    needle: 'Try again',
  },
  {
    route: '/stats/[day]',
    id: 'default',
    image: 'stats-day.png',
    needle: 'alice',
  },
  {
    route: '/stats/[day]',
    id: 'empty',
    image: 'stats-day-empty.png',
    needle: 'No gifts recorded on this day.',
  },
  {
    route: '/stats/[day]',
    id: 'loading',
    image: 'stats-day-loading.png',
    needle: 'Loading…',
  },
  {
    route: '/stats/[day]',
    id: 'error',
    image: 'stats-day-error.png',
    needle: 'Try again',
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
    needle: "toHaveAttribute('data-copied', 'true')",
  },
  {
    route: '/404',
    id: 'default',
    image: 'not-found.png',
    needle: "getByRole('heading', { name: '404' })",
  },
];
