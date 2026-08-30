/**
 * Every distinct UI state of every public screen. Handbook, e2e:check, and
 * screenshot:check all read this list — adding a state without a variant here
 * is how coverage silently drops.
 *
 * `needle` must appear in e2e/*.spec.ts (the behavioral assertion for that state).
 * `image` is the handbook filename (URL `/handbook-images/<file>`), filled from
 * the desktop-light baseline (or the first combo listed on the variant).
 * `visual` is the Playwright screenshot arg. Each variant is captured in every
 * {@link BASELINE_COMBOS} entry unless `combos` restricts it:
 *   e2e/visual.spec.ts-snapshots/${visual}-${combo.id}-linux.png
 * `combos` is optional; omit it for all four desktop/mobile × light/dark shots.
 */

/** One required visual baseline combo: viewport × theme. */
export const BASELINE_COMBOS = [
  { id: 'desktop-light', viewport: 'desktop', theme: 'light' },
  { id: 'desktop-dark', viewport: 'desktop', theme: 'dark' },
  { id: 'mobile-light', viewport: 'mobile', theme: 'light' },
  { id: 'mobile-dark', viewport: 'mobile', theme: 'dark' },
];

/** Combo used for handbook Markdown images. */
export const HANDBOOK_COMBO_ID = 'desktop-light';

/**
 * Combo ids a variant must have PNG baselines for.
 *
 * @param variant - Screen variant row.
 * @returns Combo ids.
 */
export function variantComboIds(variant) {
  if (Array.isArray(variant.combos) && variant.combos.length > 0) {
    return variant.combos;
  }
  return BASELINE_COMBOS.map((combo) => combo.id);
}

/**
 * Playwright snapshot stem for a visual arg and combo (`-linux.png` is added by Playwright).
 *
 * @param visual - Variant `visual` or `function-${name}`.
 * @param comboId - Combo id.
 * @returns Snapshot arg Playwright stores as `${stem}-linux.png`.
 */
export function comboSnapshotStem(visual, comboId) {
  return `${visual}-${comboId}`;
}

export const SCREEN_VARIANTS = [
  {
    route: '/',
    id: 'default',
    image: 'root.png',
    visual: 'screen-root',
    needle: 'Direct human-to-human gifts',
  },
  {
    route: '/',
    id: 'mobile-nav',
    image: 'root-mobile-nav.png',
    visual: 'state-root-mobile-nav',
    needle: "getByRole('button', { name: 'Menu' })",
    combos: ['mobile-light', 'mobile-dark'],
  },
  {
    route: '/',
    id: 'language-open',
    image: 'root-language.png',
    visual: 'state-root-language',
    needle: "getByRole('option', { name: 'Español' })",
  },
  {
    route: '/legal',
    id: 'default',
    image: 'legal.png',
    visual: 'screen-legal',
    needle: 'Legal Notice',
  },
  {
    route: '/login',
    id: 'idle',
    image: 'login.png',
    visual: 'screen-login',
    needle: "getByRole('button', { name: 'Log in' })",
  },
  {
    route: '/login',
    id: 'starting',
    image: 'login-starting.png',
    visual: 'state-login-starting',
    needle: 'Preparing your login',
  },
  {
    route: '/login',
    id: 'error',
    image: 'login-error.png',
    visual: 'state-login-error',
    needle: 'Something went wrong. Please try again.',
  },
  {
    route: '/login',
    id: 'in-app',
    image: 'login-in-app.png',
    visual: 'state-login-in-app',
    needle: 'Open this page in your browser',
  },
  {
    route: '/login',
    id: 'language-open',
    image: 'login-language.png',
    visual: 'state-login-language',
    needle: "getByRole('option', { name: 'Deutsch' })",
  },
  {
    route: '/login',
    id: 'theme-open',
    image: 'login-theme.png',
    visual: 'state-login-theme',
    needle: "getByRole('option', { name: 'Dark' })",
  },
  {
    route: '/donate',
    id: 'default',
    image: 'donate.png',
    visual: 'screen-donate',
    needle: 'Open the forum',
  },
  {
    route: '/setup/name',
    id: 'default',
    image: 'setup-name.png',
    visual: 'screen-setup-name',
    needle: "getByRole('heading', { name: 'Your name' })",
  },
  {
    route: '/setup/address',
    id: 'default',
    image: 'setup-address.png',
    visual: 'screen-setup-address',
    needle: "getByRole('heading', { name: 'Your Wallet of Satoshi address' })",
  },
  {
    route: '/setup/rules',
    id: 'default',
    image: 'setup-rules.png',
    visual: 'screen-setup-rules',
    needle: 'You are a guest in a living room',
  },
  {
    route: '/setup/rules',
    id: 'law1',
    image: 'setup-rules-law1.png',
    visual: 'state-setup-rules-law1',
    needle: "getByRole('heading', { name: 'Only free donations' })",
  },
  {
    route: '/setup/rules',
    id: 'law2',
    image: 'setup-rules-law2.png',
    visual: 'state-setup-rules-law2',
    needle: "getByRole('heading', { name: 'Donors come first' })",
  },
  {
    route: '/setup/rules',
    id: 'law3',
    image: 'setup-rules-law3.png',
    visual: 'state-setup-rules-law3',
    needle: "getByRole('heading', { name: 'Contact stays in the app' })",
  },
  {
    route: '/setup/rules',
    id: 'wanted',
    image: 'setup-rules-wanted.png',
    visual: 'state-setup-rules-wanted',
    needle: "getByRole('heading', { name: 'Welcome' })",
  },
  {
    route: '/setup/rules',
    id: 'allowed',
    image: 'setup-rules-allowed.png',
    visual: 'state-setup-rules-allowed',
    needle: "getByRole('heading', { name: 'Allowed' })",
  },
  {
    route: '/setup/rules',
    id: 'ratherNot',
    image: 'setup-rules-rather-not.png',
    visual: 'state-setup-rules-ratherNot',
    needle: "getByRole('heading', { name: 'Better not' })",
  },
  {
    route: '/setup/rules',
    id: 'forbidden',
    image: 'setup-rules-forbidden.png',
    visual: 'state-setup-rules-forbidden',
    needle: "getByRole('heading', { name: 'Forbidden', exact: true })",
  },
  {
    route: '/setup/rules',
    id: 'house',
    image: 'setup-rules-house.png',
    visual: 'state-setup-rules-house',
    needle: "getByRole('heading', { name: 'Our house' })",
  },
  {
    route: '/setup/rules',
    id: 'error',
    image: 'setup-rules-error.png',
    visual: 'state-setup-rules-error',
    needle: 'Could not save your agreement',
  },
  {
    route: '/setup/rules',
    id: 'busy',
    image: 'setup-rules-busy.png',
    visual: 'state-setup-rules-busy',
    needle: "getByRole('button', { name: 'I agree to these rules' })).toBeDisabled()",
  },
  {
    route: '/welcome',
    id: 'default',
    image: 'welcome.png',
    visual: 'screen-welcome',
    needle: 'Send Bitcoin',
  },
  {
    route: '/welcome',
    id: 'all',
    image: 'welcome-all.png',
    visual: 'state-welcome-all',
    needle: 'Does anyone have spare sats this week?',
  },
  {
    route: '/welcome',
    id: 'popular',
    image: 'welcome-popular.png',
    visual: 'state-welcome-popular',
    needle: 'Most popular',
  },
  {
    route: '/welcome',
    id: 'empty-paid',
    image: 'welcome-empty-paid.png',
    visual: 'state-welcome-empty-paid',
    needle: 'No message has received Bitcoin yet.',
  },
  {
    route: '/welcome',
    id: 'empty',
    image: 'welcome-empty.png',
    visual: 'state-welcome-empty',
    needle: 'No messages yet — be the first to write one.',
  },
  {
    route: '/welcome',
    id: 'loading',
    image: 'welcome-loading.png',
    visual: 'state-welcome-loading',
    needle: 'Loading…',
  },
  {
    route: '/welcome',
    id: 'error',
    image: 'welcome-error.png',
    visual: 'state-welcome-error',
    needle: 'Could not load messages. Please try again.',
  },
  {
    route: '/welcome',
    id: 'validation-error',
    image: 'welcome-validation-error.png',
    visual: 'state-welcome-validation-error',
    needle: 'Enter a message or add a photo or video',
  },
  {
    route: '/welcome',
    id: 'photo',
    image: 'welcome-photo.png',
    visual: 'state-welcome-photo',
    needle: 'Photo from Ada',
  },
  {
    route: '/welcome',
    id: 'photo-and-text',
    image: 'welcome-photo-and-text.png',
    visual: 'state-welcome-photo-and-text',
    needle: 'Hello with this photo.',
  },
  {
    route: '/welcome',
    id: 'composer-text',
    image: 'welcome-composer-text.png',
    visual: 'state-welcome-composer-text',
    needle: 'Caption before attaching a photo.',
  },
  {
    route: '/welcome',
    id: 'composer-photo',
    image: 'welcome-composer-photo.png',
    visual: 'state-welcome-composer-photo',
    needle: 'welcome composer-photo',
  },
  {
    route: '/welcome',
    id: 'composer-photo-and-text',
    image: 'welcome-composer-photo-and-text.png',
    visual: 'state-welcome-composer-photo-and-text',
    needle: 'Caption with selected photo.',
  },
  {
    route: '/welcome',
    id: 'composer-video',
    image: 'welcome-composer-video.png',
    visual: 'state-welcome-composer-video',
    needle: 'welcome composer-video',
  },
  {
    route: '/welcome',
    id: 'composer-video-and-text',
    image: 'welcome-composer-video-and-text.png',
    visual: 'state-welcome-composer-video-and-text',
    needle: 'Caption with selected video.',
  },
  {
    route: '/welcome',
    id: 'composer-text-after-remove',
    image: 'welcome-composer-text-after-remove.png',
    visual: 'state-welcome-composer-text-after-remove',
    needle: 'Caption kept after removing photo.',
  },
  {
    route: '/welcome',
    id: 'preparing-photo',
    image: 'welcome-preparing-photo.png',
    visual: 'state-welcome-preparing-photo',
    needle: 'welcome preparing-photo',
  },
  {
    route: '/welcome',
    id: 'preparing-photo-and-text',
    image: 'welcome-preparing-photo-and-text.png',
    visual: 'state-welcome-preparing-photo-and-text',
    needle: 'Caption while the photo is preparing.',
  },
  {
    route: '/welcome',
    id: 'posting-photo-and-text',
    image: 'welcome-posting-photo-and-text.png',
    visual: 'state-welcome-posting-photo-and-text',
    needle: 'Caption while the post is in flight.',
  },
  {
    route: '/welcome',
    id: 'photo-loading',
    image: 'welcome-photo-loading.png',
    visual: 'state-welcome-photo-loading',
    needle: 'Caption waiting for the photo to load.',
  },
  {
    route: '/welcome',
    id: 'error-unsupported',
    image: 'welcome-error-unsupported.png',
    visual: 'state-welcome-error-unsupported',
    needle: 'Use a JPEG, PNG, or WebP photo, or an MP4, WebM, or MOV video',
  },
  {
    route: '/welcome',
    id: 'error-unsupported-with-text',
    image: 'welcome-error-unsupported-with-text.png',
    visual: 'state-welcome-error-unsupported-with-text',
    needle: 'Caption with an unsupported photo.',
  },
  {
    route: '/welcome',
    id: 'error-too-large',
    image: 'welcome-error-too-large.png',
    visual: 'state-welcome-error-too-large',
    needle: 'Keep photos under 1 MB and videos under 32 MB',
  },
  {
    route: '/welcome',
    id: 'error-too-large-with-text',
    image: 'welcome-error-too-large-with-text.png',
    visual: 'state-welcome-error-too-large-with-text',
    needle: 'Caption with a photo that is too large.',
  },
  {
    route: '/welcome',
    id: 'error-request-photo-and-text',
    image: 'welcome-error-request-photo-and-text.png',
    visual: 'state-welcome-error-request-photo-and-text',
    needle: 'Could not post your message',
  },
  {
    route: '/welcome',
    id: 'menu-open',
    image: 'welcome-menu.png',
    visual: 'state-welcome-menu',
    needle: "getByRole('link', { name: /Profile/",
  },
  {
    route: '/welcome',
    id: 'menu-language-open',
    image: 'welcome-menu-language.png',
    visual: 'state-welcome-menu-language',
    needle: "getByRole('option', { name: 'Deutsch' })",
  },
  {
    route: '/welcome',
    id: 'menu-theme-open',
    image: 'welcome-menu-theme.png',
    visual: 'state-welcome-menu-theme',
    needle: "getByRole('option', { name: 'Dark' })",
  },
  {
    route: '/welcome',
    id: 'pay-qr',
    image: 'welcome-pay-qr.png',
    visual: 'state-welcome-pay-qr',
    needle: 'Bitcoin payment QR code',
    combos: ['desktop-light', 'desktop-dark'],
  },
  {
    route: '/welcome',
    id: 'pay-smartphone',
    image: 'welcome-pay-smartphone.png',
    visual: 'state-welcome-pay-smartphone',
    needle: 'iPhone pay sheet has no QR',
    combos: ['mobile-light', 'mobile-dark'],
  },
  {
    route: '/welcome',
    id: 'pay-author-wallet',
    image: 'welcome-pay-author-wallet.png',
    visual: 'state-welcome-pay-author-wallet',
    needle: "The author's wallet cannot receive this Bitcoin payment",
  },
  {
    route: '/welcome',
    id: 'role-hint',
    image: 'welcome-role-hint.png',
    visual: 'state-welcome-role-hint',
    needle: 'A moderator has met this person in real life and confirmed they are real.',
  },
  {
    route: '/rules',
    id: 'default',
    image: 'rules.png',
    visual: 'screen-rules',
    needle: 'Only free donations',
  },
  {
    route: '/contact',
    id: 'default',
    image: 'contact.png',
    visual: 'screen-contact',
    needle: 'Write to 21.gifts here — there is no email address. This is the only way to reach us.',
  },
  {
    route: '/contact',
    id: 'validation-error',
    image: 'contact-validation-error.png',
    visual: 'state-contact-validation-error',
    needle: 'Enter a message',
  },
  {
    route: '/contact',
    id: 'success',
    image: 'contact-success.png',
    visual: 'state-contact-success',
    needle: 'Received — thank you. We read every message here in the app.',
  },
  {
    route: '/profile',
    id: 'default',
    image: 'profile.png',
    visual: 'screen-profile',
    needle: "getByRole('heading', { name: 'Profile' })",
  },
  {
    route: '/profile',
    id: 'receive',
    image: 'profile-receive.png',
    visual: 'state-profile-receive',
    needle: '2026-06-01',
  },
  {
    route: '/profile',
    id: 'usd-scale',
    image: 'profile-usd-scale.png',
    visual: 'state-profile-usd-scale',
    needle: "getByLabel('Given and received in USD')",
  },
  {
    route: '/profile',
    id: 'single-day',
    image: 'profile-single-day.png',
    visual: 'state-profile-single-day',
    needle: '2026-06-01',
  },
  {
    route: '/profile',
    id: 'large-usd',
    image: 'profile-large-usd.png',
    visual: 'state-profile-large-usd',
    needle: '$1,425',
  },
  {
    route: '/view/[viewKey]',
    id: 'default',
    image: 'view-viewKey.png',
    visual: 'screen-view-viewKey',
    needle: "getByRole('heading', { name: 'Profile' })",
  },
  {
    route: '/view/[viewKey]',
    id: 'missing',
    image: 'view-missing.png',
    visual: 'state-view-missing',
    needle: 'This profile could not be found.',
  },
  {
    route: '/view/[viewKey]',
    id: 'loading',
    image: 'view-loading.png',
    visual: 'state-view-loading',
    needle: 'Loading…',
  },
  {
    route: '/view/[viewKey]',
    id: 'error',
    image: 'view-error.png',
    visual: 'state-view-error',
    needle: 'Try again',
  },
  {
    route: '/view/[viewKey]',
    id: 'claimed',
    image: 'view-claimed.png',
    visual: 'state-view-claimed',
    needle: 'hasPasskey: true',
  },
  {
    route: '/view/[viewKey]',
    id: 'in-app',
    image: 'view-in-app.png',
    visual: 'state-view-in-app',
    needle: 'Open this page in your browser',
  },
  {
    route: '/stats',
    id: 'default',
    image: 'stats.png',
    visual: 'screen-stats',
    needle: 'Total spend over time',
  },
  {
    route: '/stats',
    id: 'usd-scale',
    image: 'stats-usd-scale.png',
    visual: 'state-stats-usd-scale',
    needle: 'Spend by month in USD',
  },
  {
    route: '/stats',
    id: 'empty',
    image: 'stats-empty.png',
    visual: 'state-stats-empty',
    needle: 'No gifts recorded yet.',
  },
  {
    route: '/stats',
    id: 'loading',
    image: 'stats-loading.png',
    visual: 'state-stats-loading',
    needle: 'Loading…',
  },
  {
    route: '/stats',
    id: 'error',
    image: 'stats-error.png',
    visual: 'state-stats-error',
    needle: 'Try again',
  },
  {
    route: '/stats/[day]',
    id: 'default',
    image: 'stats-day.png',
    visual: 'screen-stats-day',
    needle: 'alice',
  },
  {
    route: '/stats/[day]',
    id: 'empty',
    image: 'stats-day-empty.png',
    visual: 'state-stats-day-empty',
    needle: 'No gifts recorded on this day.',
  },
  {
    route: '/stats/[day]',
    id: 'loading',
    image: 'stats-day-loading.png',
    visual: 'state-stats-day-loading',
    needle: 'Loading…',
  },
  {
    route: '/stats/[day]',
    id: 'error',
    image: 'stats-day-error.png',
    visual: 'state-stats-day-error',
    needle: 'Try again',
  },
  {
    route: '/handbook',
    id: 'default',
    image: 'handbook.png',
    visual: 'screen-handbook',
    needle: "getByRole('heading', { name: 'Handbook' })",
  },
  {
    route: '/handbook',
    id: 'copied',
    image: 'handbook-copied.png',
    visual: 'state-handbook-copied',
    needle: "toHaveAttribute('data-copied', 'true')",
  },
  {
    route: '/404',
    id: 'default',
    image: 'not-found.png',
    visual: 'screen-404',
    needle: "getByRole('heading', { name: '404' })",
  },
  {
    route: '/messages/[id]',
    id: 'default',
    image: 'messages-id.png',
    visual: 'screen-messages-id',
    needle: 'Hello from Ada',
  },
  {
    route: '/messages/[id]',
    id: 'missing',
    image: 'messages-id-missing.png',
    visual: 'state-messages-id-missing',
    needle: 'This profile could not be found.',
  },
  {
    route: '/messages/[id]',
    id: 'loading',
    image: 'messages-id-loading.png',
    visual: 'state-messages-id-loading',
    needle: 'Loading…',
  },
  {
    route: '/messages/[id]',
    id: 'error',
    image: 'messages-id-error.png',
    visual: 'state-messages-id-error',
    needle: 'Try again',
  },
  {
    route: '/welcome',
    id: 'expanded',
    image: 'welcome-expanded.png',
    visual: 'state-welcome-expanded',
    needle: 'Write a reply',
  },
  {
    route: '/welcome',
    id: 'copy',
    image: 'welcome-copy.png',
    visual: 'state-welcome-copy',
    needle: 'Copy link to this note',
  },
];
