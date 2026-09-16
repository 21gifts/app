# 21.gifts visual design system

## How to use this document

This file is the **current inventory** of the shipped 21.gifts web UI plus the **binding** grammar for new work.

- New or migrated surfaces compose the parts named here. Do not invent a second look.
- Reviewers follow the control-grammar table here and in `CONTRIBUTING.md` **Icon controls**.
- Product behaviour, variants, and goldens live in `docs/handbook/screens.md` and `e2e/visual.spec.ts`. This file owns visual language.
- Brand copy source: the API concept document, section Brand. Visual source: live marketing at `/` plus the recipes in Screen recipes.
- Markdown in this public repo is the source of truth. Figma is not.
- Never name private repositories, internal hostnames, or infra internals.

## Principles

Closed set. Each principle is one sentence plus one implication in this codebase.

1. **One family.** The product is a single geometric grotesque, not a marketing face plus a system-ui app. _Implication:_ Outfit loads via `next/font/google` in `src/app/layout.tsx`; `body` uses `font-sans`; do not leave app pages on the Tailwind default stack.

2. **Two shells, one origin.** Marketing is always ink; app is themeable paper/ink. _Implication:_ routes under `src/app/(marketing)/` (and `/404` / `not-found.tsx`) use `bg-ink text-paper` with no `ThemeSwitcher`. All other pages use `app-*` tokens only.

3. **Orange is shell-split.** On the **marketing shell**, `#f7931a` is the primary filled CTA (header **Log in**, **Ask for help**, 404 **Back home**) plus kickers. On the **app shell**, it is gift-money fill only (charts, ₿ selected, donate **Open the forum**). _Implication:_ do not call marketing **Log in** a gift. App form primaries (`Button variant="primary"`) stay `bg-app-btn`. `Button variant="accent"` is the orange fill; marketing uses it as shell primary, the app uses it for gift-intent only.

4. **Tech is invisible.** Visitors are never asked about keys, relays, NOSTR, invoices, or sats-as-jargon. _Implication:_ UI says “Bitcoin”, “Wallet of Satoshi”, `formatBitcoin` (`₿1'500`; visitor may pick US `10,000.23` / German `23.000,33`). No `npub`, no “zap”, no “LNURL” on any screen.

5. **People first.** Receiver names and notes are the hero; chrome is quiet. _Implication:_ forum note body is `text-sm text-app-fg`; chrome labels are `text-app-muted`. When photo/story lands, it occupies the reserved profile slot, not a new layout.

6. **Wordmark is chrome, not a logo file.** The brand is the text `21.gifts`. _Implication:_ `Wordmark` in both shells; do not draw a mark unless it is the existing favicon “21” on ink.

7. **Primitives, not class soup.** New or migrated surfaces compose catalog parts. _Implication:_ reject raw `rounded-full bg-app-btn px-6 py-3` and raw `bg-neutral-900` outside `src/components/ui/`.

8. **Do not canonize defects.** Goldens document current pixels; this file is the system. _Implication:_ do not reintroduce double ₿, an empty-chart axis, orange **text** on paper, a QR on smartphone UA, or hard-coded Inter/gray SaaS.

## Brand

**Wordmark.** The string `21.gifts` in Outfit, weight 700, tracking `0`. Not an SVG logotype. The drawn asset is only the favicon/app-icon “21”.

| Context                | Size             | Weight | Color               | Element                                                                                                                       |
| ---------------------- | ---------------- | ------ | ------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Marketing header       | 17px / 1.06rem   | 700    | `paper` (`#ffffff`) | `HomeWordmark tone="dark"` (`/` unsigned, `/welcome` when a session is hydrated)                                              |
| Marketing footer       | 15px / 0.9375rem | 700    | `paper`             | `Wordmark tone="dark" size="footer"` as `<span>`                                                                              |
| App chrome (unsigned)  | 17px / 1.06rem   | 700    | `app-fg`            | `HomeWordmark` on `/login`, `/donate`, `/view/*`; `Wordmark` link `/` on unsigned `/rules` and `/messages/[id]`               |
| App chrome (signed-in) | 17px / 1.06rem   | 700    | `app-fg`            | `Wordmark` link `/welcome`, except `/setup/*` (`<span>` — `OnboardingGate` would bounce an incomplete account off `/welcome`) |

**Clear space.** Minimum 8px (`spacing-2`) on all sides of the glyph bounds. Do not place controls closer than 12px (`spacing-3`) to the wordmark.

**Do not.** Orange wordmark, outline wordmark, stacked “21” over “gifts”, a gift-box logo next to the wordmark in chrome. The combined gift-and-Bitcoin SVG on `/welcome` is a **page glyph**, not the brand mark.

**Favicon / apple-touch / OG (keep).**

- `public/favicon.svg` — 64×64, fill `#0A090C`, text `21` at 32px/700, fill `#f7931a`. This is the only drawn mark.
- `public/favicon.ico` — 48×48, same composition.
- `public/apple-touch-icon.png` / `icon-192.png` / `icon-512.png` — ink field, orange `21`, no rounded-squircle decoration beyond what iOS applies.
- `public/og.png` — ink, orange kicker `PEER-TO-PEER · BITCOIN · WALLET OF SATOSHI`, white `21.gifts`, subtitle, orange-outline pill. Keep.

## Color

Live tokens from `src/app/globals.css` `@theme` and `html.dark`.

**Sacred hexes (do not shift).**

| Name   | Hex       | Role                                                     |
| ------ | --------- | -------------------------------------------------------- |
| Ink    | `#0a090c` | Marketing canvas; app dark `app-bg`                      |
| Paper  | `#ffffff` | App light canvas; marketing type                         |
| Accent | `#f7931a` | Bitcoin orange — marketing primary + app gift-money fill |
| Given  | `#525252` | Profile “Given” series (neutral; not accent)             |

**Shell-stable tokens** (do not flip with `html.dark`; marketing uses these):

| Token    | Hex       | Tailwind                   |
| -------- | --------- | -------------------------- |
| `ink`    | `#0a090c` | `bg-ink`, `text-ink`       |
| `paper`  | `#ffffff` | `text-paper`, `bg-paper`   |
| `accent` | `#f7931a` | `bg-accent`, `text-accent` |

**App semantic tokens.**

| Token                | Light (`@theme`)     | Dark (`html.dark`)       | Use                                                      |
| -------------------- | -------------------- | ------------------------ | -------------------------------------------------------- |
| `app-bg`             | `#ffffff`            | `#0a090c`                | Page canvas                                              |
| `app-fg`             | `#171717`            | `#ffffff`                | Body, titles, primary type                               |
| `app-muted`          | `#525252`            | `#a3a3a3`                | Secondary sentences, leads                               |
| `app-subtle`         | `#737373`            | `#a3a3a3`                | Overlines, timestamps ≥ 12px                             |
| `app-border`         | `#e5e5e5`            | `rgb(255 255 255 / 0.2)` | Card edge, hairlines                                     |
| `app-border-strong`  | `#d4d4d4`            | `rgb(255 255 255 / 0.3)` | Fields, secondary buttons                                |
| `app-card`           | `#ffffff`            | `#121116`                | Raised panel                                             |
| `app-card-muted`     | `#fafafa`            | `#1a191e`                | Note cards, laws banner, composer well                   |
| `app-btn`            | `#171717`            | `#ffffff`                | Form primary fill                                        |
| `app-btn-fg`         | `#ffffff`            | `#0a090c`                | Form primary label                                       |
| `app-btn-hover`      | `#404040`            | `#e5e5e5`                | Form primary hover                                       |
| `app-hover`          | `#fafafa`            | `rgb(255 255 255 / 0.1)` | Row/ghost hover                                          |
| `app-accent`         | `#f7931a`            | `#f7931a`                | App gift-money fill + ₿ selected; not body text on paper |
| `app-accent-fg`      | `#0a090c`            | `#0a090c`                | Text on accent fill (always ink)                         |
| `app-focus`          | `#171717`            | `#ffffff`                | `:focus-visible` ring (2px)                              |
| `app-danger`         | `#b91c1c`            | `#f87171`                | Alert text/border                                        |
| `app-success`        | `#15803d`            | `#4ade80`                | Success copy (unused on current screens)                 |
| `app-overlay`        | `rgb(10 9 12 / 0.4)` | `rgb(10 9 12 / 0.6)`     | Modal / overlay scrim                                    |
| `app-chart-given`    | `#525252`            | `#a3a3a3`                | Given series                                             |
| `app-chart-received` | `#f7931a`            | `#f7931a`                | Received / spend series                                  |
| `app-notice`         | `#fff7ed`            | `#2a1f12`                | Invite/activation banner fill                            |
| `app-notice-fg`      | `#171717`            | `#ffffff`                | Notice body                                              |
| `app-qr-bg`          | `#ffffff`            | `#ffffff`                | QR plate — **always paper**                              |
| `app-qr-fg`          | `#000000`            | `#000000`                | QR modules — always black                                |

**Orange rule (closed, two shells).** Live marketing uses orange as the **dark-shell primary**. Pay-sheet **Pay** (`forum.payOpenWallet`, aria `forum.payOpenWalletAria` “Pay with Wallet of Satoshi”) is `bg-app-btn` (labeled sentence-length, not accent). App **Log in** stays `app-btn`.

**(A) Marketing shell** (`bg-ink`): orange is the primary filled CTA plus kickers.

| Orange                                                                                              | Not orange                                                |
| --------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Header **Log in**, hero **Ask for help**, 404 **Back home**, stats **Try again**                    | Hero **Send help** (outline `border-paper/20 text-paper`) |
| Kickers: `HOW IT WORKS`, `WHY THIS EXISTS`, `FAQ`, `TOTAL SPEND OVER TIME`, `BY PERSON`, `BY MONTH` | Nav links, footer links                                   |
| Stats chart paint (spend series)                                                                    | KPI tile chrome                                           |

This is not “Log in is a gift.” Ink pages have one filled accent, and it is Bitcoin orange.

**(B) App shell** (`app-*`): orange is **gift-money** only — fills and chart paint, never body/kicker **text** on paper (~2.3:1).

| Orange                                                               | Not orange                                                                                                                       |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `/donate` **Open the forum** (`ButtonLink` accent fill + `text-ink`) | Card **Log in**, **Try again**, **Continue**, **I agree**, **Activate**, forum **Post**, contact send, forum **Pay** (`app-btn`) |
| Charts: received series, ₿ selected in ₿ \| selected fiat            | Forum Active/No gifts yet/All/Most popular selected (`app-btn`)                                                                  |
|                                                                      | Menu, language, app body links (`text-app-fg underline`)                                                                         |
|                                                                      | **Rules kickers and ticks** — see (B′)                                                                                           |

**(B′) Living-room house chrome (closed exception, not a third job).** `RulesDocument` paints:

| Part                            | Token                                                                                                                                                     |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RULE n` / `THE TEST` overlines | **overline** `text-app-subtle` (same as `NAME`)                                                                                                           |
| Welcome-list `Check`            | `text-app-fg` (the check glyph is the encoding)                                                                                                           |
| Forbidden `X`                   | `text-app-danger`                                                                                                                                         |
| “THE TEST” left bar             | `border-l-2 border-app-accent` — decorative 2px stripe beside the overline. Not a contrast-dependent encoding (1.4.11 does not apply to pure decoration). |

Do **not** list `text-app-accent` on paper as an allowed AA fail. Orange fill always uses `text-ink`.

```mermaid
flowchart TD
  acc["#f7931a"]
  acc --> M[A: Marketing primary CTA + kicker + stats paint]
  acc --> G[B: App gift-money fill + donate Open the forum]
  acc --> H["B′: decorative THE TEST bar only"]
  acc -.-> X[Not: app form primary / Post / Pay (pay sheet) / filter / RULE n text / Welcome ticks]
```

**QR plates.** Always `bg-app-qr-bg` (`#ffffff`) + `border-app-border`. Dark theme does **not** invert the QR. Module color `app-qr-fg` (`#000000`). Quiet zone: `p-4` on a 232px module grid (`QR_SIZE = 232`). No QR on smartphone UA (`isSmartphoneUserAgent`, not viewport).

**Contrast (WCAG 2.2 AA)** against current tokens.

| Pair                                     | Ratio (approx.) | AA body (4.5:1) | Notes                                                                                                        |
| ---------------------------------------- | --------------- | --------------- | ------------------------------------------------------------------------------------------------------------ |
| `app-fg` `#171717` on `app-bg` `#ffffff` | ~16:1           | Pass AAA        |                                                                                                              |
| `app-fg` `#ffffff` on `app-bg` `#0a090c` | ~19:1           | Pass AAA        |                                                                                                              |
| Light muted `#525252` on white           | ~7.0:1          | Pass AAA        |                                                                                                              |
| Light subtle `#737373` on white          | ~4.7:1          | Pass AA         | Overlines, timestamps ≥ 12px                                                                                 |
| Dark muted `#a3a3a3` on ink              | ~7.9:1          | Pass            |                                                                                                              |
| Dark subtle `#a3a3a3` on ink             | ~7.9:1          | Pass            |                                                                                                              |
| `paper/60` on ink (marketing lead)       | ~7.4:1          | Pass            | Keep                                                                                                         |
| Accent `#f7931a` on ink                  | ~8.6:1          | Pass            | Kickers, orange type on marketing                                                                            |
| Accent on paper                          | ~2.3:1          | **Fail**        | Never orange _text_ on light paper. Orange is fill + `text-ink`, chart paint, or the decorative THE TEST bar |
| `text-ink` on accent fill                | ~8.6:1          | Pass            | Accent buttons                                                                                               |
| Given `#525252` on white                 | ~7.0:1          | Pass            | Legend + series                                                                                              |

Destructive alerts: `role="alert"` + `text-app-danger`. Do not use `text-red-600` on new surfaces.

## Typography

**Family (one).** [Outfit](https://fonts.google.com/specimen/Outfit), SIL Open Font License 1.1. Geometric grotesque. Outfit on Google Fonts is a **variable** face (`wght` 100–900).

`next/font/google` treats a **weight array as the non-variable API**. An array can fail `next build`. Use the variable range string.

```tsx
// src/app/layout.tsx
import { Outfit } from 'next/font/google';

const outfit = Outfit({
  subsets: ['latin'],
  weight: 'variable',
  display: 'block', // avoid FOUT in visual goldens; swap is allowed only with fonts.ready in shotScreen
  variable: '--font-outfit',
});

export default async function RootLayout({ children }: { children: ReactNode }): Promise<ReactElement> {
  const locale = await getRequestLocale();
  return (
    <html lang={locale} suppressHydrationWarning className={outfit.variable}>
      …
      <body className="font-sans bg-app-bg text-app-fg antialiased">
```

`className={outfit.variable}` **must** sit on `<html>` so `--font-outfit` exists. Without it, `@theme` interpolation is a no-op and pages stay on system-ui.

```css
@theme {
  --font-sans: var(--font-outfit), ui-sans-serif, system-ui, sans-serif;
}
```

`next/font/google` downloads at **`next build`**, then self-hosts at runtime. CI and the image-build stage must reach `fonts.google.com` (or the Next font endpoint). If that is blocked, vendor the files and switch to `next/font/local`. Do not fetch Google Fonts from the browser at runtime.

If anyone uses `display: 'swap'`, `shotScreen` **must** `await page.evaluate(() => document.fonts.ready)` before `toHaveScreenshot`, or Linux goldens flake on FOUT.

**Forbidden as the brand face:** Inter, Roboto, Arial, Open Sans, system-ui. `system-ui` / `ui-sans-serif` are **fallback only**. Do not add a display serif. Do not add IBM Plex / Geist / another second family.

**Ramp.** 16px root. Use these classes (write the utilities on the JSX as CONTRIBUTING requires).

| Token          | px      | rem          | Weight | Line-height            | Letter-spacing              | Max measure                                        | Tailwind recipe                                                   | Use                                                                                                                                                                      |
| -------------- | ------- | ------------ | ------ | ---------------------- | --------------------------- | -------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **display**    | 36 / 60 | 2.25 / 3.75  | 600    | 1.15 (`leading-tight`) | -0.025em (`tracking-tight`) | 20em                                               | `text-4xl sm:text-6xl font-semibold leading-tight tracking-tight` | Marketing H1 (`/`, `/stats` “Gifts”, `/stats/[day]`, `/trust-chain`). 404 “404” stays `text-5xl` = 48px / 600                                                            |
| **h1**         | 24 / 30 | 1.5 / 1.875  | 600    | 1.25                   | -0.025em                    | 22em                                               | `text-2xl sm:text-3xl font-semibold tracking-tight text-center`   | App page title **inside a card or setup column**: welcome, profile, contact, inbox, notifications, setup. **Not login** (see **card-title**)                             |
| **card-title** | 18      | 1.125        | 500    | 1.3                    | 0                           | 22em                                               | `text-lg font-medium text-center text-app-fg`                     | Login card heading (`LoginCard` `login.heading`). Keep this smaller step so the card is an action, not a billboard                                                       |
| **h1-lg**      | 30 / 36 | 1.875 / 2.25 | 600    | 1.2                    | -0.025em                    | 22em                                               | `text-3xl sm:text-4xl font-semibold tracking-tight text-center`   | `/donate`, `/rules` (document titles on a full page, not inside a card)                                                                                                  |
| **display-sm** | 36 / 48 | 2.25 / 3     | 600    | 1.15 (`leading-tight`) | -0.025em (`tracking-tight`) | 22em                                               | `text-4xl sm:text-5xl font-semibold leading-tight tracking-tight` | `/about` H1 (reading-width marketing page; not the home 60px display)                                                                                                    |
| **h2-lg**      | 24      | 1.5          | 600    | 1.3                    | 0                           | 28em                                               | `text-2xl font-semibold`                                          | `/about` conviction titles                                                                                                                                               |
| **h2**         | 20      | 1.25         | 600    | 1.3                    | 0                           | 28em                                               | `text-xl font-semibold`                                           | Marketing step titles, legal Imprint H2, handbook H2. `/legal` Privacy Policy is an h2 at `text-3xl` so the page keeps one outline h1 (Legal Notice)                     |
| **h3**         | 18      | 1.125        | 600    | 1.35                   | 0                           | 28em                                               | `text-lg font-semibold`                                           | Marketing why-grid titles, legal H3. `/legal` Overview is an h3 at `text-xl font-semibold` as the first subsection under Privacy Policy                                  |
| **kicker**     | 14      | 0.875        | 500    | 1.3                    | 0.1em (`tracking-widest`)   | —                                                  | `text-sm font-medium tracking-widest uppercase text-accent`       | **Marketing shell only:** `HOW IT WORKS`, stats `TOTAL SPEND OVER TIME`. Not `/rules`                                                                                    |
| **overline**   | 12      | 0.75         | 500    | 1.3                    | 0.1em                       | —                                                  | `text-xs font-medium tracking-widest uppercase text-app-subtle`   | `NAME`, `WALLET OF SATOSHI ADDRESS`, `THE TEST`, `RULE n` (app; **not** `text-accent`)                                                                                   |
| **body**       | 16      | 1            | 400    | 1.5                    | 0                           | 36em (`max-w-2xl` ~42rem for marketing lead is OK) | `text-base leading-normal`                                        | App body. Marketing lead is **body-lg**. Form control text (inputs/textareas) uses body / `text-base` because iOS auto-zooms below 16px. **body-sm** keeps field labels. |
| **body-lg**    | 18      | 1.125        | 400    | 1.5                    | 0                           | 36em                                               | `text-lg text-paper/60` (marketing) or `text-lg text-app-muted`   | Hero lead, stats subtitle                                                                                                                                                |
| **body-sm**    | 14      | 0.875        | 400    | 1.45                   | 0                           | 36em                                               | `text-sm`                                                         | Forum note body, card sentences, field labels, button labels, FAQ answers                                                                                                |
| **caption**    | 12      | 0.75         | 400    | 1.4                    | 0                           | —                                                  | `text-xs text-app-subtle`                                         | Forum timestamp, pay “Waiting for payment…”                                                                                                                              |
| **numeric**    | inherit | inherit      | 600    | 1.2                    | 0                           | —                                                  | `font-semibold tabular-nums lining-nums`                          | `formatBitcoin`, USD, KPI values, chart ticks                                                                                                                            |
| **code**       | 14      | 0.875        | 400    | 1.4                    | 0                           | —                                                  | `font-mono text-sm`                                               | `you@walletofsatoshi.com` on marketing; Lightning Address _value_ on profile uses `font-mono text-sm`                                                                    |

**One title per page.** The document outline has one `h1` (or `card-title` used as the sole heading). Card must not repeat a page title. `LoginPage` has no outer “Log in to 21.gifts”; the only heading is `LoginCard` `login.heading` at **card-title**. Do not add the outer title back. Welcome has no Forum heading; the only `h1` is “Welcome, {name}”.

**`formatBitcoin`.** `src/lib/stats-money.ts`: leading U+20BF `₿`, style-grouped via `NumberFormatStyle`, no space, no fraction. Default Swiss `₿1'500`. JSON stays `sats` / `totalSats`. Render in a `span` with `tabular-nums lining-nums`. Do not replace U+20BF with lucide `Bitcoin`. Do not put a second ₿ beside the string. Product phrase **Wallet of Satoshi** unchanged (catalog exception / proper name).

Fiat: `formatFiatDisplay` → `$1.43` / `CHF 1'425.00` / `EUR 1.30` / `PHP 80.00` (null → em dash; Swiss grouping default). USD wrapper `formatUsdDisplay` still used for the stats KPI when USD is selected. Axis ticks: stats and profile fiat ticks use `formatFiatTick` (USD selected may still call `formatUsdTick` as a wrapper; `$0`, `$1.43`, `$1'425`). Visitor styles `us` / `de` change grouping, not the currency. Toggle anatomy in §10.

**Link type.** Marketing inline links: `text-accent underline underline-offset-2`. App inline links (rules, contact): `text-app-fg underline underline-offset-2 font-medium`. Do not make app body links orange (fails on paper; also not a gift CTA).

## Space, radius, elevation, motion

**Spacing scale** (4px base = Tailwind default). Use only these on new surfaces:

| Token   | px        | Tailwind                 | Typical                                                        |
| ------- | --------- | ------------------------ | -------------------------------------------------------------- |
| 1       | 4         | `p-1` `gap-1`            | Badge padding-y                                                |
| 1.5     | 6         | `gap-1.5`                | Icon+label in Menu                                             |
| 2       | 8         | `p-2` `gap-2`            | IconButton inner, composer gap                                 |
| 3       | 12        | `p-3` `gap-3`            | Pay sheet padding, field stack                                 |
| 4       | 16        | `p-4` `top-4` `gap-4`    | Note card `px-4 py-3` (y=12), chrome top                       |
| 5       | 20        | `px-5` `right-5` `gap-5` | Marketing horizontal, chrome right, clustered `sm` IconButtons |
| 6       | 24        | `px-6` `gap-6` `p-6`     | App page padding, card gap                                     |
| 8       | 32        | `p-8` `gap-8`            | Card padding                                                   |
| 10      | 40        | `gap-10` `py-10`         | PageChrome gap, footer py                                      |
| 12      | 48        | `mt-12` `gap-12`         | Section rhythm, stats `space-y-12`                             |
| 16      | 64        | `pt-16`                  | Stats top                                                      |
| 20      | 80        | `py-20`                  | Marketing section py                                           |
| 24      | 96        | `py-24`                  | Legal/handbook top                                             |
| 28 / 36 | 112 / 144 | `pt-28 sm:pt-36`         | Marketing hero                                                 |

App page padding is `px-6` (24px), not `px-5`. Marketing content padding is `px-5` (20px). Do not mix.

**Radius.**

| Token     | px   | Tailwind                    | Use                                                                      |
| --------- | ---- | --------------------------- | ------------------------------------------------------------------------ |
| `pill`    | 9999 | `rounded-full`              | Buttons, switcher triggers, segmented thumbs, header Log in, badges      |
| `card`    | 24   | `rounded-3xl`               | `Card`, profile/login/welcome panels                                     |
| `note`    | 16   | `rounded-2xl`               | Forum notes, laws banner, fields, onboarding inputs, KPI tiles, QR plate |
| `panel`   | 12   | `rounded-xl`                | Menu, listbox, pay-sheet inner, photo preview, role hint                 |
| `control` | 8    | `rounded-lg`                | Menu rows                                                                |
| `chart`   | 6    | `rounded-md` / SVG `rx={6}` | ₿\|USD track, person bars `rx={6}`                                       |
| `none`    | 0    | —                           | Marketing month bars (square)                                            |

**Elevation.**

| Level   | Recipe                               | Use                                                                                       |
| ------- | ------------------------------------ | ----------------------------------------------------------------------------------------- |
| 0       | border only                          | Marketing KPI tiles (`border-paper/10`), forum notes                                      |
| 1       | `border border-app-border shadow-sm` | `Card`                                                                                    |
| 2       | `border border-app-border shadow-lg` | Menu, language listbox                                                                    |
| Overlay | `bg-app-overlay`                     | `HandbookLightbox`, `PwaInstall`, `IntroduceYourselfOverlay`, `RequirementsOverlay` scrim |

Do not add drop shadows on marketing. Do not use colored shadows.

**Motion.**

| Event                | Duration                     | Easing                | Notes                                                      |
| -------------------- | ---------------------------- | --------------------- | ---------------------------------------------------------- |
| Color hover          | 150ms                        | `ease` (`transition`) | Buttons, rows, pills                                       |
| Menu / listbox mount | instant (conditional render) | —                     | No fade required                                           |
| Theme switch         | instant                      | —                     | Class toggle on `html`; do not animate `color` on `<body>` |
| Pay sheet open       | instant                      | —                     | Insert in-card; no slide                                   |
| Spinner              | 1000ms linear infinite       | `animate-spin`        | `Loader2`                                                  |
| Copy check flash     | 1200ms then revert           | —                     | `ForumBoard` `COPY_RESET_MS`                               |

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

This global `*` hammer is WCAG 2.3.3-compliant and **does freeze** `Loader2` and the 1200ms copy-check flash (they become static). That is acceptable. Forum `scrollIntoView({ behavior: 'auto' })` is already correct and does **not** depend on this CSS. Do not introduce `behavior: 'smooth'` without a reduced-motion guard.

**Hit targets.** WCAG 2.2 AA 2.5.8 is **24×24px**. 44×44 is 2.5.5 AAA.

| Size           | Layout / paint              | Hit target           | Glyph |
| -------------- | --------------------------- | -------------------- | ----- |
| `sm`           | `h-6 w-6` + `::before` slop | 44×44 via `::before` | 16px  |
| `md` (default) | `h-11 w-11` (44px painted)  | 44×44                | 20px  |
| `lg`           | `h-12 w-12` (48px painted)  | 48×48                | 20px  |

`sm` class (`::before` without `content` does not generate a box):

```
relative isolate inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full leading-none
before:absolute before:content-[''] before:block before:-inset-2.5 before:min-h-11 before:min-w-11 before:rounded-full
```

The painted control stays `h-6 w-6`. The lucide node sits in `relative z-10`. Do **not** paint `sm` as `h-11`.

**Clustered `sm` must not overlap.** `-inset-2.5` is 10px slop per side → 44px hit. Any row of two or more `sm` IconButtons uses `gap-5` (20px): 24px paint + 20px gap = 44px center-to-center, hits **touch, do not overlap**. Isolated `sm` (laws dismiss, pay-sheet back) keep their absolute position.

## Two shells

**Marketing** — `src/app/(marketing)/layout.tsx` + `/404` (`src/app/not-found.tsx`, which duplicates the shell because it sits outside the group).

- Canvas: `min-h-[var(--app-height)] bg-ink text-paper [color-scheme:dark]`.
- No `ThemeSwitcher`. Cookie theme must not lighten `/`, `/about`, `/legal`, `/stats`, `/trust-chain`, `/handbook`, `/404`.
- Header + footer always mounted.

**App** — every other `page.tsx`. Tokens only. `ThemeProvider` + `THEME_BOOTSTRAP_SCRIPT` in the root layout (`html.dark`, cookie `theme`). Unsigned app: Wordmark or `HomeWordmark` + LanguageSwitcher. Signed-in: `ProfileChromeLeft` or Wordmark + `SignedInChrome` Menu. ThemeSwitcher and LanguagePreferenceSwitcher are Profile identity-card settings rows, not chrome.

```mermaid
flowchart TB
  subgraph mkt [Marketing — always dark]
    R["/"]
    L["/legal"]
    A["/about"]
    S["/stats"]
    SD["/stats/day"]
    TC["/trust-chain"]
    H["/handbook/*"]
    F["/404"]
  end
  subgraph app [App — ThemeProvider]
    LI["/login"]
    DO["/donate"]
    SN["/setup/name"]
    SA["/setup/address"]
    SR["/setup/rules"]
    W["/welcome"]
    P["/profile"]
    MEM["/members/accountId"]
    N["/notifications"]
    MO["/moderate"]
    MOH["/moderate/hidden"]
    C["/contact"]
    RU["/rules"]
    IN["/messages"]
    MID["/messages/id"]
    V["/view/viewKey"]
  end
  root[Root layout: locale + theme bootstrap + Outfit]
  root --> mkt
  root --> app
```

`/rules` is **app shell** (themeable, no marketing header) even though it is public. Footer links from marketing _into_ `/rules`.

`/donate` is app shell (themeable, unsigned chrome).

## Layout and chrome

| Measure            | Value                                       | Use                                                            |
| ------------------ | ------------------------------------------- | -------------------------------------------------------------- |
| Marketing max      | `max-w-[1100px]`                            | Home, stats, handbook, 404 content, footer inner               |
| Legal max          | `max-w-3xl` (48rem)                         | `/legal` and `/about` reading column                           |
| App card `sm`      | `max-w-sm` (24rem)                          | Login, profile, view, member identity, onboarding name/address |
| App card `md`      | `max-w-md` (28rem)                          | Donate inner, public note                                      |
| App card `xl`      | `max-w-xl` (36rem)                          | Welcome/forum, contact, inbox, notifications, moderation       |
| Rules document     | `max-w-3xl`                                 | `/rules`, `/setup/rules`                                       |
| App page pad       | `px-6`                                      | `AppShell` / flow `PageChrome`                                 |
| Marketing pad      | `px-5`                                      | Header, sections, footer                                       |
| Vertical app shell | `AppShell` fill/flow + `--app-height`       | Centered cards and long documents                              |
| Onboarding column  | fill `AppShell` + `AppShellFooter` CTA slot | `/setup/name`, `/setup/address`, `/setup/rules`                |
| Marketing hero     | `pt-28 pb-20 sm:pt-36`                      | `/`                                                            |
| Marketing section  | `py-20`                                     | how / why / project / faq                                      |
| Stats / handbook   | `pt-16 pb-24` / `py-24`                     |                                                                |

**Mobile vs desktop.** Marketing nav hides below `md`, hamburger `md:hidden`. App cards are single-column at all breakpoints. Forum `Card maxWidth="xl"` is the widest app panel. Playwright viewports: desktop and mobile combos already in `scripts/screen-variants.mjs` (`BASELINE_COMBOS`). Do not add a third breakpoint.

**Safe area / visualViewport.** `AppShell` plus `--app-height` from `visualViewport` (bootstrap script + `useAppHeight` / `AppHeightSync`) is the height source. `--app-height` follows `visualViewport.height` only when scale is 1 (keyboard / browser chrome). Do not follow a pinch-zoom visual viewport. `html { touch-action: manipulation }` disables double-tap-zoom; pinch-zoom stays. Do not add `env(safe-area-inset-*)` here.

**`AppShell` slots.** `AppShell` owns the app `<main>`: optional absolute `topLeft` / `topRight`, `fill` (locked height + header/scroll/footer) or `flow` (min-height + document scroll). `PageChrome` is the flow-mode wrapper; prefer `AppShell` on new routes.

```
[ topLeft: Wordmark | Back+Wordmark ]     [ topRight: Menu | Language ]
[                         children                                      ]
```

Absolute chrome stays `top-4` / `left-5` / `right-5` (16px / 20px). `fill` + `align="center"` centers short cards inside the inner scroller (never `justify-center` on `<main>`). Onboarding CTAs register via `AppShellFooter` (and headings via `AppShellHeader`) instead of stretching the form column. Child `AppShellTopLeft` registration wins over the page `topLeft` prop.

| Slot       | Unsigned app (`/login`, `/donate`, `/rules` without session, `/messages/[id]`, `/view/*`)                                                                       | Signed-in app                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `topLeft`  | `HomeWordmark` on `/login`, `/donate`, `/view/*` (`/` unsigned, `/welcome` when hydrated). `Wordmark` → `/` on unsigned `/rules` and unsigned `/messages/[id]`. | `Wordmark` → `/welcome`, except `/setup/*` (span, not a link). On `/profile`, `/members/[accountId]`, `/notifications`, `/moderate`, `/moderate/hidden`, `/contact`, `/messages`, signed-in `/rules`, and signed-in `/messages/[id]`: `ProfileChromeLeft` (back **then** wordmark). `/setup/rules`: page does **not** pass `topLeft`; `RulesSetup` portals Wordmark span + optional back via `AppShellTopLeft` |
| `topRight` | `LanguageSwitcher tone="light"`                                                                                                                                 | `SignedInChrome` (Menu; no ThemeSwitcher, no LanguageSwitcher)                                                                                                                                                                                                                                                                                                                                                 |

**`ProfileChromeLeft`.** Link `h-11 w-11` lucide `ArrowLeft` to `/welcome` + `Wordmark href="/welcome"`.

**Signed-in Menu** (`SignedInChrome`). Labeled Menu trigger (lucide `Menu` 14px + catalog `aria.menu`). Rows icon+label, in this order:

| Row                  | Icon                          | Href / control                                                                      |
| -------------------- | ----------------------------- | ----------------------------------------------------------------------------------- |
| Home                 | `Home`                        | `/welcome`                                                                          |
| Profile              | `User`                        | `/profile` — given/received `formatBitcoin` amounts only when that side is non-zero |
| Living room rules    | `ScrollText`                  | `/rules`                                                                            |
| Trust Chain          | `Share2`                      | `/trust-chain`                                                                      |
| Moderation           | `Shield`                      | `/moderate` — founder or moderator only                                             |
| Notifications        | `Bell`                        | `/notifications` — unread count `ml-auto` only when greater than zero               |
| Messages             | `Inbox`                       | `/messages`                                                                         |
| Contact              | `MessageCircle`               | `/contact`                                                                          |
| optional Install app | `PwaInstall placement="menu"` | labeled row                                                                         |
| Log out              | `LogoutButton`                | labeled                                                                             |
| Version              | —                             | quiet `text-xs text-app-muted` `app.version` after Log out; not a control           |

Trigger: `inline-flex min-h-11 items-center gap-1.5 px-2 text-sm text-app-muted`. Panel: `min-w-[18rem] rounded-xl border border-app-border bg-app-card p-2 shadow-lg`. Rows: `flex min-h-11 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium`. Escape and outside-click close the panel.

**Marketing header** stays dedicated (`MarketingHeader`): sticky, `bg-ink/85 backdrop-blur-xl`, `border-b border-paper/10`, `px-5 py-3.5`. Do not reuse `PageChrome` on marketing.

```mermaid
flowchart LR
  subgraph marketingShell [Marketing shell — always ink]
    MH[MarketingHeader: HomeWordmark + nav incl. Trust Chain + orange Log in + Language]
    MC[Page]
    MF[MarketingFooter: Wordmark + links + verse + GitHub]
  end
  subgraph appShell [App shell — themeable]
    PL[AppShell.topLeft: Wordmark]
    PR[AppShell.topRight: Menu or Language]
    BODY[Card / onboarding column / document]
  end
  MH --> MC --> MF
  PL --- BODY --- PR
```

## Iconography

**Set.** `lucide-react` only. No second icon pack. Drawn exceptions: favicon “21”, `public/wos-icon.png` (Wallet of Satoshi, 20×20 PNG in the pay CTA), the welcome gift-and-Bitcoin SVG, and handbook images.

**Stroke.** Default lucide 2px. At 16px glyph use stroke 2; at 20–24px use stroke 1.75 if the glyph looks heavy on goldens after Outfit — otherwise leave default. Do not mix fills.

**Sizes (glyph, not hit target).**

| Glyph | px  | Tailwind      | Use                                                 |
| ----- | --- | ------------- | --------------------------------------------------- |
| 14    | 14  | `h-3.5 w-3.5` | Menu row icons, ₿\|USD is text not icon             |
| 16    | 16  | `h-4 w-4`     | Button leading icon, Field-adjacent, pay-sheet back |
| 20    | 20  | `h-5 w-5`     | IconButton md/lg default, profile back              |
| 32    | 32  | `h-8 w-8`     | Login fingerprint / error / spinner                 |
| 48    | 48  | `h-12 w-12`   | Welcome gift-and-Bitcoin SVG                        |

**Decorative vs control.** Decorative: `aria-hidden="true"` (gift-and-Bitcoin SVG on welcome, Fingerprint on login, AlertTriangle on error, legend swatches). Control: `IconButton` with required `aria-label` from the catalog. Indicators (given/received arrows in Menu): `aria-label` on the wrapping `span`, not a button.

**Welcome gift-and-Bitcoin glyph.** Combined gift outline and Bitcoin symbol, `h-12 w-12 text-app-fg`, `aria-hidden`. It is the forum’s page glyph, not the brand mark. Do not color it orange. Do not duplicate it in chrome.

**Pay control glyph.** Lucide **`Gift`**, not `Bitcoin`. Accessible name stays catalog `forum.pay` = **“Send Bitcoin”**. Do **not** retune that string to “Pay” (`e2e/visual.spec.ts` uses `getByRole('button', { name: 'Send Bitcoin' })`). The `/welcome` heading uses a 48px decorative gift-and-Bitcoin SVG; the in-card pay control remains a 16px `Gift`.

## Photography

Profile photo and story are a **reserved slot**, not a shipped feature. Do not ship UI that pretends they exist. Do not spec HTTP. When they land, they occupy this slot so the screen does not invent a look:

| Part         | Spec                                                                                                                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Avatar       | 96×96px (`h-24 w-24`), circle (`rounded-full`), `object-cover`, 1:1 crop, above the profile `h1` or immediately under it, centered                                                                           |
| Aspect       | 1:1 only for the profile portrait. Forum message photos stay `max-h-80 w-full rounded-xl object-contain`                                                                                                     |
| Fallback     | Two-letter initials from `name` (first grapheme of first two words, else first two), Outfit 600 24px, on `bg-app-card-muted text-app-fg`. If no name: lucide `Gift` 32px `text-app-muted` in the same circle |
| Story        | `body-sm text-app-muted`, centered, under the name row, max 4 lines (`line-clamp-4`) on the card; full text on a future expanded view — not designed here                                                    |
| Forum photos | Already specified in `ForumBoard`; not the profile portrait                                                                                                                                                  |

Do not use a colored placeholder, a camera badge, or a progress ring.

## Money

**Visitor amounts.** Always `formatBitcoin(sats, numberFormat)` from `src/lib/stats-money.ts`. Leading `₿` (U+20BF), `NumberFormatStyle` grouping (`ch` / `us` / `de`), no fraction, no extra ₿. Class: `tabular-nums lining-nums`. JSON fields remain `sats` / `totalSats`.

**Pay control is not a second ₿.** Note footer:

```
[ ₿21 ]  [ Gift IconButton aria-label=Send Bitcoin ] [ Copy ] [ PM ]  [ N reactions ]
```

- Amount: ₿ via `formatBitcoin`, then `·` plus `formatFiatDisplay` of `satsToFiatAmount` when the conversion is non-null — **not a button**. Otherwise ₿-only, no ` · —`.
- Pay: `IconButton` `variant="ghost"` `size="sm"` (24px painted glyph, 44px hit slop — §10), lucide `Gift` 16px, `aria-label={t('forum.pay')}` (**Send Bitcoin**, frozen). Disabled while `payBusy`.
- Do not put the amount inside the pay control.
- Do not change `forum.pay` copy.

Pay sheet amount step shows a live fiat line in the preferred fiat (no picker; after mint the line uses the invoice amount). Pay sheet confirm sentence (`forum.payConfirm`) is one `formatBitcoin` plus optional `·` `formatFiatDisplay` when the conversion is non-null. Amount-step CTA: iOS phone (`isSmartphoneUserAgent` and not `isAndroidUserAgent`) **Pay** (`forum.payNow`; DE **Bezahlen**) mints the invoice and keeps the amount form (no `location.assign`); Android phone (`isSmartphoneUserAgent`) stays **Continue** (`forum.payContinue`) and after mint remains on the amount form with the wallet `Button` (Intent href; no QR, no invoice card); desktop and iPad stay **Continue** (`forum.payContinue`) and after mint show the invoice card with QR. Wallet CTA is a **Pay** `Button` (`variant="primary"` `size="md"` `tone="app"`; visible `forum.payOpenWallet`, aria `forum.payOpenWalletAria` “Pay with Wallet of Satoshi” — sentence-length, **not** accent) that sets `window.location.href` to the WoS href (not a custom-scheme `<a>` / `ButtonLink`). Smartphone: no QR (`isSmartphoneUserAgent`, not viewport). Desktop: QR + that Button.

**Fiat.** Cookie `fiat` (otherwise locale default). Switchers: Profile settings (`FiatPreferenceSwitcher`), every `AccountActivityChart` (Profile, `/members/[accountId]`, `/view/[viewKey]`), `/stats`, and `/stats/[day]`. Forum notes, nested replies, and the pay sheet **display** that code only (no picker). Stats KPI shows ₿ on the first line and the selected fiat on the second via `formatFiatDisplay` (USD uses `formatUsdDisplay`). Populated profile chart is ₿ | selected FiatCode.

**₿ \| selected-fiat segmented control** — shipped as `SegmentedControl` (see catalog). Stats charts: ₿ and the preferred FiatCode. Profile: ₿ and the preferred FiatCode (same as stats charts, app shell).

| Part       | Spec                                                                                                                                                                                                                  |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Track      | Gift app: `inline-flex overflow-hidden rounded-md border border-app-border text-xs`. Gift dark: `border-paper/20`.                                                                                                    |
| Segment    | `min-h-11 min-w-11 px-2 py-1` on mobile **and** desktop                                                                                                                                                               |
| Selected   | Gift app: `bg-app-accent text-app-accent-fg`. Gift dark: `bg-accent text-ink`                                                                                                                                         |
| Unselected | Gift app: `text-app-muted`. Gift dark: `text-paper/70`                                                                                                                                                                |
| Labels     | Stats charts: `₿` and the preferred FiatCode (CHF/EUR/USD/PHP). Profile: `₿` and the preferred FiatCode (CHF/EUR/USD/PHP), group `profile.chartScale`. `aria-pressed` on each. Group `role="group"` with catalog name |

Forum Active/No gifts yet/All/Most popular uses the **same primitive** with `tone="neutral"` so selected is `bg-app-btn` not orange. Profile uses `tone="gift"` (app shell). Stats uses `tone="gift" shell="dark"`.

**Empty profile chart.** If both series empty/all-zero sats: FiatPicker plus `profile.chartEmpty` `role="status"`; **no SVG / no ₿|fiat scale**. Legend without data is noise.

## Control grammar

The labeled vs icon-only table is the **binding** rule. Reviewers follow this table and `CONTRIBUTING.md` **Icon controls**, not “everything new is an icon”.

| Labeled (`Button` / `ButtonLink` / inline `Link`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Icon-only (`IconButton`, required `aria-label`)                                                                                                                                                                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Consent (**I agree to these rules**), **Continue**, **Skip** (onboarding name/address only), **Log in**, **Log out**, **Try again**, **Activate**, pay-sheet **Pay** (`forum.payOpenWallet` / aria `forum.payOpenWalletAria` “Pay with Wallet of Satoshi”; a `Button` that sets `location.href`, not a `ButtonLink`), sentence-length empty-state CTA (**Write your About me**), sentence-length links (**Open the forum**, **Open the app** (inline `text-accent` `Link` on `/legal`, not `ButtonLink`), **Back home**, **Ask for help**, **Send help**), marketing-shell primary (**Log in** pill, 404 **Back home**), donate **Open the forum** | Actions **inside** a card: edit, delete, attach, send/post (forum + contact + inbox composers), copy, dismiss, **pay** (Gift icon, `aria-label` = `forum.pay` “Send Bitcoin”), push bell, profile/rules-setup/inbox back, Menu **row** icons (the Menu _trigger_ stays labeled) |

**Skip** (onboarding name/address only) is a labeled `Button` in the same column as **Continue**. There is no Skip on `/setup/rules` or on `RequirementsOverlay`.

**Notifications** list rows are full-row links/buttons with visible text (not icon-only).

Content translation under a note or reply body is a labeled underline text control (`forum.translate` / show original / show translation), not an `IconButton` in the footer icon row.

**Member profile** has no edit. Back is icon-only like profile (`ProfileChromeLeft`).

**Menu trigger** stays labeled (icon + “Menu”). It is page chrome. Do not convert **Log out**, **Continue**, **Skip**, **Activate**, **Try again**.

Founder/moderator **Trash2** on notes and nested replies is icon-only with inline confirm (`DeletePostControl`).

**Button size scale (one).**

| Size           | Padding                | Type     | Min height        | Use                                                                                      |
| -------------- | ---------------------- | -------- | ----------------- | ---------------------------------------------------------------------------------------- |
| `sm`           | `px-4 py-2`            | 14px/500 | 44px (`min-h-11`) | Compact labeled (marketing header **Log in** stays `px-4 py-2` but must still be ≥ 44px) |
| `md` (default) | `px-6 py-3`            | 14px/500 | 44px              | Login, Try again, secondary                                                              |
| `lg`           | `px-6 py-3` + `w-full` | 14px/500 | 44px              | Onboarding Continue / I agree (full width in the column)                                 |

Do not add a 36px button. Marketing header Log in visual may stay slightly smaller in width but not in height.

## Component catalog

Every primitive: anatomy, tokens, states, React API. New or migrated surfaces compose these. Raw duplicate class strings are rejected.

Shared focus: `:focus-visible { outline: 2px solid var(--color-app-focus); outline-offset: 2px }` in `globals.css`. **No `outline-none` on controls** (Field, composer, switchers, buttons).

Disabled: `opacity-50` + `cursor-not-allowed`.

Loading: leading `Loader2` `h-4 w-4 animate-spin` (labeled) or replacing the glyph (icon). Control stays disabled.

### `AppShell` / `PageChrome`

**Anatomy.** `AppShell` owns the app `<main>`: optional absolute `topLeft` / `topRight`, `fill` (locked height + header/scroll/footer) or `flow` (min-height + document scroll). `PageChrome` is the flow-mode wrapper; prefer `AppShell` on new routes.

**Tokens.** `h-[var(--app-height)]` (`fill`) or `min-h-[var(--app-height)]` (`flow`), `px-6`, `bg` inherited from `body`. Never Tailwind viewport-height utilities on app routes.

**API.**

```tsx
export interface AppShellProps {
  children: ReactNode;
  mode: 'fill' | 'flow';
  topLeft?: ReactNode;
  topRight?: ReactNode;
  className?: string;
  align?: 'start' | 'center'; // fill only
}

export interface PageChromeProps {
  children: ReactNode;
  topRight?: ReactNode;
  topLeft?: ReactNode;
  className?: string;
}
```

Slot registrars: `AppShellHeader`, `AppShellFooter`, `AppShellTopLeft` (child registration wins over page `topLeft`).

### `Wordmark`

**Anatomy.** Text `21.gifts` as `Link` when `href` is set, otherwise a `<span>`.

**Tokens.** Header `text-[17px] font-bold no-underline`; footer `text-[15px] font-bold no-underline`. Color: `text-paper` (`tone="dark"`) or `text-app-fg` (`tone="app"`).

**API.**

```tsx
export function Wordmark(props: {
  href?: string; // omit → <span>, not a link
  tone?: 'app' | 'dark'; // app = app-fg; dark = paper on ink
  size?: 'header' | 'footer'; // header 17px (default); footer 15px
}): ReactElement;
```

`HomeWordmark` is the session-aware wrapper (`/` until hydrate, `/welcome` when `ready && session !== null`). Do not over-type primitive `href` as `'/' | '/welcome'` — unsigned `/rules` still uses `/`, and the footer is not a link.

### `Card`

**Anatomy.** `<section>` panel: children in a column, centered, `gap-6`, `p-8`, `rounded-3xl`, `border border-app-border bg-app-card shadow-sm`, `w-full` + max width.

**API.** `maxWidth?: 'sm' | 'md' | 'xl'` default `sm`. `className?`.

**States.** None. Nested notes use `app-card-muted`, not a second `Card`.

**Do not** put page chrome inside `Card`.

### `Button` (labeled)

**Anatomy.** `inline-flex items-center justify-center gap-2 rounded-full font-medium text-sm`. Optional leading `icon` (decorative). Optional `tone?: 'app' | 'dark'` (default `app`).

**Variants (app tone).**

| Variant     | Default                                                   | Hover              | Disabled   | Use                                                               |
| ----------- | --------------------------------------------------------- | ------------------ | ---------- | ----------------------------------------------------------------- |
| `primary`   | `bg-app-btn text-app-btn-fg`                              | `bg-app-btn-hover` | opacity 50 | Log in, Continue, Try again, I agree, Activate, pay-sheet **Pay** |
| `secondary` | `border border-app-border-strong bg-app-card text-app-fg` | `bg-app-hover`     | opacity 50 | Retry on forum, inbox, notifications                              |
| `accent`    | `bg-app-accent text-app-accent-fg`                        | `opacity-90`       | opacity 50 | App donate **Open the forum**; gift-intent fills                  |

**Dark tone.** Secondary `border border-paper/20 text-paper hover:bg-paper/10`; primary `bg-paper text-ink`; accent `bg-accent text-ink`. Used by `PwaInstall` header/hero (and iOS sheet Close) on marketing ink.

**States:** default, hover, `:focus-visible` (ring), active (color only — no `scale`), disabled, loading (`icon={<Loader2 className="h-4 w-4 animate-spin" />}` + disabled).

**API.** `variant?: 'primary' | 'secondary' | 'accent'`; `size?: 'sm' | 'md' | 'lg'` (default `md`; `lg` adds `w-full`); `tone?: 'app' | 'dark'`; optional `icon`.

### `ButtonLink`

Same visual variants/sizes as `Button`, rendered as `next/link` `Link` (or `<a>` for external). Used by marketing CTAs, 404, donate **Open the forum**. Optional `icon`. Optional `aria-label`. Legal **Open the app** is an inline `text-accent` link, not `ButtonLink`. Pay-sheet **Pay** is a `Button`, not `ButtonLink`.

| `tone`          | `variant="secondary"`                                         | `variant="accent"` / `primary`                            |
| --------------- | ------------------------------------------------------------- | --------------------------------------------------------- |
| `app` (default) | `border-app-border-strong bg-app-card text-app-fg`            | accent = `bg-app-accent text-ink`; primary = `bg-app-btn` |
| `dark`          | `border-paper/20 bg-transparent text-paper hover:bg-paper/10` | accent fill unchanged (`text-ink` on orange)              |

Hero **Send help**: `ButtonLink href="/donate" variant="secondary" tone="dark"`. Header **Log in** / **Ask for help** / 404 **Back home**: `variant="accent"`.

### `IconButton`

**Anatomy.** Round control, glyph only, required `aria-label`.

**Variants:** `primary` (`bg-app-btn text-app-btn-fg`), `secondary` (border), `ghost` (`text-app-muted hover:bg-app-hover hover:text-app-fg`). Default `secondary`.

**Tone:** `app` (default) or `dark` (marketing ink). Ghost + `dark` is `text-paper/40 hover:bg-paper/10 hover:text-paper` with `focus-visible:outline-paper`. Handbook copy-link uses this; do not layer `hover:bg-app-hover` on ink.

**Sizes:** `sm` `h-6` + 44px slop; `md` `h-11 w-11`; `lg` `h-12 w-12`. Default `md`.

**States:** default, hover, focus-visible, active, disabled (`disabled:cursor-not-allowed disabled:opacity-50`), loading (spinner replaces glyph).

Glyph: `aria-hidden` on the lucide node.

### Overlay

**Anatomy.** Full-viewport scrim `fixed inset-0 z-50 flex items-center justify-center bg-app-overlay p-4`. Panel is catalog `Card maxWidth="sm"` (`rounded-3xl border border-app-border bg-app-card p-8 shadow-sm`, `gap-6`). Close is `IconButton` ghost. `role="dialog"` `aria-modal="true"`.

**Introduce yourself.** Title, body, labeled `Button` CTA **Write an introduction**. The CTA dismisses the overlay, focuses the welcome composer (`FORUM_COMPOSE_EVENT` / `requestForumCompose`), and `router.push('/welcome')` only when the path is not already `/welcome`. Close dismisses this mount. No Skip.

**Requirements.** Name, Lightning Address, or living-room rules before a pending post retries. Close dismisses without posting. No Skip.

**States.** Open / dismissed (parent).

### `Field`

**Anatomy.** `<label className="flex flex-col gap-1 text-left text-sm text-app-fg">` + control.

**Control class.**

```
w-full min-h-11 rounded-2xl border border-app-border-strong bg-app-card
px-4 py-2 text-base text-app-fg placeholder:text-app-subtle
transition focus-visible:border-app-fg disabled:opacity-50
```

16px (`text-base`) so iOS Safari does not auto-zoom on focus. No `outline-none`. The global `:focus-visible` ring is the keyboard encoding. No `error` prop; screens keep external `role="alert"` siblings.

Textarea: add `min-h-11 resize-none`. Composer textareas that sit beside an IconButton may omit the visible label and use `aria-label` only — that is a **composer**, not `Field`. Prefer `Field` when a label is visible (pay amount).

**API.** `FieldProps` input/textarea union (`multiline?: false` / `multiline: true`).

### `SegmentedControl`

Two tones. Gift also takes `shell?: 'app' | 'dark'` (default `app`; ignored for `neutral`).

```tsx
export function SegmentedControl<T extends string>(props: {
  value: T;
  options: readonly {
    value: T;
    label: string;
    badge?: number;
    badgeAriaLabel?: string;
  }[];
  onChange: (value: T) => void;
  ariaLabel: string;
  tone: 'gift' | 'neutral';
  shell?: 'app' | 'dark';
  className?: string;
}): ReactElement;
```

Chip: an `aria-hidden` span with `ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-app-btn px-1.5 text-xs font-semibold leading-5 text-app-btn-fg`. Omitted when `badge` is missing or ≤ 0. The option button gets `aria-label` only when `badge` > 0 and `badgeAriaLabel` is non-empty.

| Tone + shell    | Track                                                                     | Selected                                  | Unselected       | Use                                                                                                                                                                                |
| --------------- | ------------------------------------------------------------------------- | ----------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gift` + `app`  | `inline-flex overflow-hidden rounded-md border border-app-border text-xs` | `bg-app-accent text-app-accent-fg`        | `text-app-muted` | Profile ₿ \| selected FiatCode                                                                                                                                                     |
| `gift` + `dark` | `inline-flex overflow-hidden rounded-md border border-paper/20 text-xs`   | `bg-accent text-ink`                      | `text-paper/70`  | Stats ₿ \| selected FiatCode                                                                                                                                                       |
| `neutral`       | `flex w-full rounded-full border border-app-border bg-app-card-muted p-1` | `bg-app-btn text-app-btn-fg rounded-full` | `text-app-muted` | Forum Active / No gifts yet / All / Most popular (`className="!grid grid-cols-2 !rounded-2xl"`); staff inbox Direct / Contact / Damus (three pills, one row, no extra `className`) |

Forum Active / No gifts yet / All / Most popular ships with `className="!grid grid-cols-2 !rounded-2xl"` (two-column grid, not the rounded-full flex pill). Staff inbox (founder/moderator) uses the default one-row flex track (three pills, not a 2×2 grid). Members do not mount it.

Gift options: `min-h-11 min-w-11 px-2 py-1`. Each option: `type="button"` `aria-pressed`.

### LanguageSwitcher

**Standalone trigger (unsigned chrome, marketing language):**

```
inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm min-h-11
```

- Dark tone: `border-paper/20 text-paper hover:bg-paper/10`
- Light tone: `border-app-border-strong text-app-fg hover:bg-app-hover`

Glyph 14px (`h-3.5`) + label + `ChevronDown` 14px. `role="combobox"` + listbox.

**Panel:** `absolute right-0 z-50 mt-2 min-w-[12rem] rounded-xl border p-2 shadow-lg` — dark: `border-paper/10 bg-ink`; light: `border-app-border bg-app-card`.

**Option row:** `flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm min-h-11`. Selected: `font-medium` + `Check` 16px. Dark selected check: `text-accent`. App selected check: `text-app-fg` (not orange — choosing Deutsch is not a gift).

#### ThemeSwitcher profile settings section

ThemeSwitcher is **app + Profile only**. Anatomy = PushToggle section: uppercase kicker (`theme.label`), then `SegmentedControl tone="neutral"` with System / Light / Dark. Not a labeled chrome pill. Not a Menu disclosure. Marketing never mounts it. Unsigned visitors follow the cookie if one exists, otherwise the OS.

#### LanguagePreferenceSwitcher profile settings section

LanguagePreferenceSwitcher is **app + Profile only**. Anatomy = PushToggle section: uppercase kicker (`language.label`), then `SegmentedControl tone="neutral"` (default one-row `rounded-full`, same as ThemeSwitcher) with endonyms English / Deutsch / Español / Filipino. Not chrome. Not a Menu disclosure. Marketing never mounts it. Public / unsigned pages keep `LanguageSwitcher` (Globe pill + popover).

#### FiatPreferenceSwitcher profile settings section

FiatPreferenceSwitcher is **app + Profile settings**. Anatomy = PushToggle section: uppercase kicker (`profile.fiatCurrency`), then `FiatPicker` `shell="app"` `tone="neutral"` with CHF | EUR | USD | PHP (selected `bg-app-btn`, not orange). Writes the `fiat` cookie. Stats, the day view, and every `AccountActivityChart` (Profile, member, public view) also mount `FiatPicker` against the same cookie but keep `tone="gift"` (compact orange). Not a Menu disclosure. Forum and the pay sheet display the code only.

#### NumberFormatSwitcher profile settings section

NumberFormatSwitcher is **app + Profile only**. Anatomy = PushToggle section: uppercase kicker (`numberFormat.label`), then `SegmentedControl tone="neutral"` with sample labels `10'000.23` / `10,000.23` / `23.000,33`. Not a Hash pill. Not a Menu disclosure. Marketing never mounts it. Unsigned visitors keep the Swiss default unless a cookie exists.

### Signed-in Menu

See Layout and chrome. Trigger stays labeled. Profile row amounts only when non-zero. Notifications unread count only when greater than zero. Menu has no language, theme, or number format.

### Banner (living-room laws)

**Anatomy.** `relative rounded-2xl border border-app-border bg-app-card-muted px-4 py-3 pr-10`. Dismiss `IconButton` ghost `sm` `absolute right-2 top-2`. Body: two `text-sm text-app-fg` centered sentences + nav links `text-sm font-medium underline underline-offset-2`.

**States.** Visible / dismissed (parent). No error state.

Do not use orange. This is law, not a gift CTA.

### Note card (forum message)

**Anatomy.** `<li className="rounded-2xl border border-app-border bg-app-card-muted px-4 py-3">`.

1. Row: `name` (`text-sm font-medium`) + optional **Badge** + `time` (`text-xs text-app-subtle`).
2. Optional role hint `text-xs text-app-muted`.
3. Optional photo/video (`rounded-xl`, `max-h-80`).
4. Body `text-sm text-app-fg whitespace-pre-wrap`.
5. Footer: `flex flex-wrap items-center gap-5` + amount + IconButtons (pay, copy, PM, delete when present) + reply count `ml-auto text-xs text-app-subtle`. Confirming delete uses `order-last basis-full w-full` so the bordered confirm group wraps to the next line.

Expand: header, media, body text, and `NoteTranslate` sit in a `role="button"` (click to expand replies). The action row (amount, Gift pay, copy, PM, delete, reply count) is a sibling after that control, still inside the `li`. Inner controls `stopPropagation`. Focus ring on the expandable region.

Inbox thread rows use **Inbox thread bubbles**, not this full-width forum chrome.

**Forum moderation.** Founder/moderator `DeletePostControl`: icon-only `Trash2` `IconButton` ghost `sm` with inline confirm (Check / X IconButtons + `forum.deleteConfirm` copy). Nested replies use the same `DeletePostControl` with `kind="reply"` (`forum.deleteReply` / `forum.deleteReplyConfirm`). Nested reply action row is `mt-2 flex flex-wrap items-start gap-5` only when PM and trash are both visible; a single control stays `mt-2`. Not a labeled button.

### Inbox thread bubbles

Inbox direction is unmistakable without a Sent folder and without orange. Incoming is a full-width muted note card; sent is a content-sized filled `app-btn` bubble on the right. Do not use `bg-app-accent` here: sending a message is not a gift CTA. Inbox does not reuse the forum footer (amount, Gift pay, copy, PM, expand).

**Incoming (`fromMe === false`).** Full-width muted note card (same chrome as the forum note card body): `rounded-2xl border border-app-border bg-app-card-muted px-4 py-3`. Inner: name `text-sm font-medium text-app-fg`, time `text-xs text-app-subtle`, body `mt-2 whitespace-pre-wrap text-sm text-app-fg`.

**Sent (`fromMe === true`).** Filled form-primary, right, content-sized: `self-end w-fit max-w-[85%] rounded-2xl rounded-br-md bg-app-btn px-4 py-3 text-app-btn-fg`. No border, no muted fill. Inner: name `text-sm font-medium text-app-btn-fg`, time `text-xs text-app-btn-fg/70`, body `mt-2 whitespace-pre-wrap text-sm text-app-btn-fg`. Label `inbox.you`.

**List outbound last-text.** Compact sent chip on the right of the (still muted) conversation row, same fill: `self-end w-fit max-w-full line-clamp-2 rounded-2xl rounded-br-md bg-app-btn px-3 py-1.5 text-sm text-app-btn-fg`. Copy stays `inbox.sentPreview`. Inbound last text stays `line-clamp-2 text-sm text-app-muted`. Empty `lastText` omits the preview.

### Composer

**Anatomy.** Top-level forum note: `flex items-center gap-2`. Forum reply: `flex items-end gap-2` with a labeled Amount `Field` (`forum.replyAmountLabel`) before Post. Contact/inbox: `items-end`.

- Attach: `IconButton` lg secondary, lucide `ImagePlus`, `aria-label` attach. Forum note composer only.
- Textarea: `min-h-11 flex-1 resize-none rounded-2xl border border-app-border-strong px-4 py-2.5 text-base`. 16px so iOS Safari does not auto-zoom on focus. `aria-label` from catalog. `maxLength` from API constants.
- Amount (forum reply only): `Field` `forum.replyAmountLabel`, `inputMode="numeric"`, `w-24`. Empty or `0` invoices 1 sat for non-exempt visitors.
- Send/Post: `IconButton` lg primary, lucide `Send`. Loading: `Loader2`.
- Preview row: `rounded-2xl border bg-app-card-muted p-3` + 80×80 thumb + remove `IconButton`.

**States.** Default, disabled (`posting`), validation `role="alert"` under the row (`text-sm text-app-danger`).

### Pay sheet

**Amount step.** Inner `rounded-xl border bg-app-card p-3`. Back `IconButton`. `Field` amount. Live fiat line for the draft or default 21 sats when the conversion is non-null (preferred fiat from Profile; no picker). Alerts. `Button` primary:

- iPhone / iPod (`isSmartphoneUserAgent` and not `isAndroidUserAgent`): **Pay** (`forum.payNow`; DE **Bezahlen**). One tap mints the invoice and keeps this form. It does not `window.location.assign`. After mint the amount field is disabled and the CTA becomes the wallet `Button` that sets `window.location.href` to `walletofsatoshi:` (no QR, no second invoice card).
- Android phone (`isSmartphoneUserAgent` and `isAndroidUserAgent`): **Continue** (`forum.payContinue`). After mint, same amount form and wallet `Button`; `location.href` is the Android Intent URL.
- Desktop / iPad (`!isSmartphoneUserAgent`): **Continue** (`forum.payContinue`). Click only requests the invoice, then the invoice card.

**Invoice step (desktop / iPad only).** Centered column, back, confirm sentence with one `formatBitcoin` and optional `·` plus `formatFiatDisplay` when the conversion is non-null, then:

- Desktop (`!isSmartphoneUserAgent`): `QrCode` 232px on white plate (`border-app-border`) + **Pay** `Button` `variant="primary"` `size="md"` `tone="app"` with `wos-icon.png` 20×20 (`rounded-md ring-1 ring-white/30`) as `icon` (visible `forum.payOpenWallet`, aria `forum.payOpenWalletAria` “Pay with Wallet of Satoshi”). Click sets `window.location.href` to the WoS href (not a custom-scheme `<a>`).
- Smartphone: stays on the amount form. Wallet `Button` only (`walletofsatoshi:` / Android intent). **No QR.** Detection is UA, not viewport.

Waiting: `text-xs text-app-muted`. Author-wallet error: `role="alert"` `text-app-danger`.

Do not restyle QR for dark mode.

### Badge (Verified, Moderator, Founder)

**Anatomy.** `rounded-full border border-app-border-strong px-2 py-0.5 text-xs font-medium text-app-muted`. Button when the hint is togglable (`aria-expanded`). Basis role: **no badge**.

**Do not** color-code roles (no green verified, no orange founder). Type + optional hint is the encoding. Hint copy already in catalogs (`forum.role.*Hint`).

### Chart

**Stats (marketing, ink).** KPI tiles: `rounded-2xl border border-paper/10 p-5`. dt `text-sm text-paper/60`, dd `text-2xl font-semibold tabular-nums`. Charts: stroke/fill `accent`, grid `paper/8`, ticks `paper/50` 12px Outfit. Person bars `rx={6}` height 12. Month bars square fill accent. Empty: copy “No gifts recorded yet.” — **no empty SVG axis**. Loading: `text-paper/60` “Loading…”. Error: copy + `ButtonLink`/`Button` accent **Try again**.

**Profile activity.** FiatPicker always (empty included). Legend Given (`app-chart-given`) + Received (`app-chart-received`) with 10px swatches + text (color is **not** the only encoding — labels exist). Populated: ₿|{FiatCode} `SegmentedControl tone="gift"`. SVG height 110 viewBox 400×110, ticks 9px `app-muted`. Empty: FiatPicker plus `profile.chartEmpty` `role="status"`, no SVG.

### Alert / error

```
<p role="alert" className="text-center text-sm text-app-danger">
```

Load and request failures next to labeled **Try again** use this grammar (`login.error`, `forum.error`, `forum.repliesError`, `inbox.error`, `notifications.error`, `view.error`). Login error also uses decorative `AlertTriangle` `h-8 w-8 text-app-subtle` above the sentence, then `Button` **Try again**. Validation alerts already use the same `role="alert"` + `text-app-danger`. Missing (`view.missing`) stays muted, not danger. Do not use color alone — the sentence is required.

### Marketing header / footer / CTA pair

**Header.** Sticky `z-50 flex items-center justify-between border-b border-paper/10 bg-ink/85 px-5 py-3.5 backdrop-blur-xl`. Left: `HomeWordmark tone="dark"`. Right: `nav` (how, why, faq, about, stats, Trust Chain, handbook) `text-sm text-paper/80 gap-6` + `ButtonLink variant="accent" size="sm"` **Log in** + `PwaInstall tone="dark" placement="header"` + `LanguageSwitcher tone="dark"` + hamburger (`flex min-h-11 min-w-11 flex-col items-center justify-center gap-1.5 md:hidden`, three `h-0.5 w-5` bars, `aria-label` menu, `aria-expanded`).

Mobile open nav: `absolute top-full inset-x-0 flex flex-col border-b border-paper/10 bg-ink px-5 py-4`. Log in pill is inside the nav on mobile.

**Footer.** `border-t border-paper/10 px-5 py-10`. Inner `mx-auto flex max-w-[1100px] flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between`; the nav wraps (`flex flex-wrap gap-4`). Wordmark footer size, not a link. Nav `text-sm text-paper/70 gap-4` (how, why, faq, about, Trust Chain, handbook, legal, rules). GitHub `text-sm text-paper/70`. Below the row: centered italic `text-sm text-paper/50` verse plus uppercase `text-xs tracking-widest text-accent` reference (`footer.verse` / `footer.verseRef`).

**Hero CTA pair.** `flex flex-wrap gap-4 mt-10`. Primary `ButtonLink href="/login" variant="accent"` **Ask for help**. Secondary `ButtonLink href="/donate" variant="secondary" tone="dark"` **Send help**. Then `PwaInstall tone="dark" placement="hero"`.

**Signed-in menu Install.** `PwaInstall placement="menu"` stays the labeled row — app shell, not dark Button.

### Empty states

| Surface                     | Copy pattern                          | Control                   |
| --------------------------- | ------------------------------------- | ------------------------- |
| Forum no messages           | muted `text-sm` catalog `forum.empty` | Composer still shown      |
| Forum no paid               | `forum.emptyPaid`                     | Mode switcher still shown |
| Forum no gifts yet / unpaid | `forum.emptyUnpaid`                   | Mode switcher still shown |
| Inbox none (member)         | `inbox.empty`                         | None                      |
| Inbox none (staff Direct)   | `inbox.empty`                         | Filter still shown        |
| Inbox none (staff Contact)  | `inbox.empty.contact`                 | Filter still shown        |
| Inbox none (staff Damus)    | `inbox.empty.damus`                   | Filter still shown        |
| Notifications none          | `notifications.empty`                 | None                      |
| Stats none                  | “No gifts recorded yet.”              | None                      |
| Profile chart none          | `profile.chartEmpty`                  | None                      |
| View / member missing       | `view.missing`                        | None                      |
| 404                         | `notFound.body`                       | Accent **Back home**      |

Do not illustrate empty states with extra glyphs except the welcome gift-and-Bitcoin SVG which is always present.

### Focus ring

Global. 2px `app-focus`, offset 2px. On ink, ring is paper; on paper, ring is `#171717`. Do not use orange rings (fails 3:1 on white — WCAG 1.4.11).

### Notifications list

**Anatomy.** `Card maxWidth="xl"` + **h1** `notifications.heading` at the **h1** ramp. List of posts, replies, and payments as full-width buttons (`w-full` `rounded-2xl border border-app-border bg-app-card-muted px-4 py-3`): actor title (`{name} posted` / `{name} replied` / `{name} sent bitcoin`) + time. Unread: semibold `text-app-fg`. Read: actor `font-medium`, body `text-app-muted`. Time: `text-xs text-app-subtle`. Photo-only post body: `notifications.photoPost` (**Photo**). Photo-only reply body: `notifications.photoOnly` (**Photo reaction**). Zap body is the stored amount. Empty: `notifications.empty`. Loading: `notifications.loading`. Error: `role="alert"` `text-app-danger` + labeled **Try again** (`Button` secondary). Click row → `/messages/{parentId}`. No composer.

### Member identity card

**Anatomy.** Identity panel `max-w-sm` card chrome (`rounded-3xl border border-app-border bg-app-card p-8 shadow-sm`): **h1** `profile.title` at the **h1** ramp, then chart, About me (not a forum post; copy-profile-link lives inside `AboutMeSection`), optional Message, name, location (read-only; `location.unset` when empty), Lightning Address, optional role pill. Activity **Posts** / **Reactions** are labeled `Button size="sm"` toggles (`type="button"` `aria-pressed`; pressed = `variant="primary"`, otherwise `variant="secondary"`). They are not the 2-col forum `SegmentedControl` (that requires always-one-selected). Labeled staff Trust Chain actions (`MemberTrustActions`: Verify / Propose / Confirm / Appoint) when the viewer is staff and the subject is someone else. Failed staff writes use `role="alert"` + `text-app-danger`. On-demand post/reply `ForumBoard` feeds below the card. No edit. `RequirementsOverlay` without Skip when a reply is missing a requirement.

## Screen recipes

Composition is top-to-bottom. Source of visual composition: the `page.tsx` plus the screen component. Source of variants: `docs/handbook/screens.md` (name the states; do not duplicate every screenshot). **Do not reintroduce** Gift-as-₿, empty-chart axis, missing Wordmark, orange **text** on paper, labeled Contact Send, or claim `bg-neutral-900`.

### `/` — marketing home

`MarketingHeader` → hero (`display` H1 two lines, `body-lg` lead, CTA pair **Ask for help** / **Send help** / `PwaInstall`) → `#how` (kicker, h2, lead, 3 numbered steps) → `#why` (kicker, h2, 2×2 h3+body) → `#project` (kicker, h2, lead, Lightning Address as `text-accent` code link) → `#faq` (kicker, h2, `details/summary` `border-b border-paper/10 py-4`) → `MarketingFooter`.

Handbook states: live marketing home.

### `/about`

`MarketingHeader` → `main` → first section `px-5 pt-28 pb-12 sm:pt-36` `max-w-3xl` (accent kicker, H1 `text-4xl sm:text-5xl font-semibold leading-tight tracking-tight` — reading width, not the home display 60px, `body-lg` lead, `blockquote border-l-2 border-accent` italic verse + uppercase accent reference) → second section `max-w-3xl px-5 py-16` (three `article`s, each accent number + h2 + `text-paper/60` body; first article also a second paragraph and a verse blockquote; then `ButtonLink href="/welcome" variant="accent" tone="dark"` **Open the living room**) → `MarketingFooter`. Visitor copy is catalogized; English `title`/`description` metadata is the documented exception. No second typeface, no cross. No separate “origin” section — the convictions carry it.

### `/legal`

`MarketingHeader` → `main max-w-3xl px-5 py-24` → H1 Legal Notice, H2 Imprint (`text-xl font-semibold`), body, accent **Open the app** → H2 Privacy Policy (`text-3xl font-semibold`), H3 Overview (`text-xl font-semibold`)… → footer. English legal body is a catalog exception. Inline links `text-accent underline underline-offset-2`.

### `/stats`

Header → `main max-w-[1100px] px-5 pt-16 pb-24` → display/h1 “Gifts” (`text-4xl sm:text-6xl font-semibold leading-tight tracking-tight`) → body-lg subtitle → `StatsDashboard` (KPI grid, then charts or empty). `SegmentedControl tone="gift" shell="dark"`. Numeric figures.

Handbook states: loading, empty, error + **Try again**, populated charts.

### `/trust-chain`

Marketing shell, always ink. `MarketingHeader` → display/h1 Trust Chain (`text-4xl sm:text-6xl font-semibold leading-tight tracking-tight`), lead, then `TrustChainLoader` / `TrustChainScreen` / `TrustChainDiagram`. First paint is founder seeds; a click loads one hop; several people hanging off one person stack top to bottom; drag moves a person. Empty / loading / error + **Try again**; hop-error keeps the diagram. Modifier-click opens `/members/{id}`.

Handbook states: default, expanded, empty, loading, error, hop-error.

### `/stats/[day]`

Back link `text-accent underline underline-offset-2` “All stats” → display “Gifts on YYYY-MM-DD” (`text-4xl sm:text-6xl font-semibold leading-tight tracking-tight`) → subtitle → `DayLoader` / `GiftDayTable`. Invalid day: `notFound()` (404 shell).

### `/handbook` (+ screens / functions / endpoints)

Marketing shell, `max-w-[1100px] px-5 py-24`, `HandbookIntro`, accent section links. Screens page: three-level contents (chapter / screen / variant), compact cards with ~220px thumbs, description, permalink/copy-link, and click-to-lightbox full size. Handbook markdown is English (catalog exception). No Playwright goldens of these documentation pages. `/handbook/screens` shows product-screen goldens and is not itself a golden.

### `/login`

Fill `AppShell` `align="center"`; `topLeft={<HomeWordmark />}` `topRight={<LanguageSwitcher tone="light" />}`. `OnboardingGate screen="login"` → `LoginCard` (`Fingerprint` 32px subtle, **one** heading `login.heading` at **card-title**, `Button` primary md with Fingerprint icon **Log in**).

Starting: `Loader2` + `login.preparing`. Error: `AlertTriangle` + alert + **Try again**. In-app: `InAppBrowserView`.

**Do not reintroduce** an outer “Log in to 21.gifts” title.

### `/donate`

Fill `AppShell` `align="center"`; `HomeWordmark` + LanguageSwitcher. Inner `max-w-md` column: **h1-lg** `donate.pageTitle` (**Send help**), muted lead, `ButtonLink variant="accent"` **Open the forum** to `/welcome`. Keep orange (gift-intent).

### `/setup/name`

Fill `AppShell` `align="start"`; `topLeft={<Wordmark />}` (span) `topRight={<SignedInChrome />}`. `OnboardingGate screen="name"` → `NameSetup`: `AppShellHeader` **h1** “Your name” → `NameForm onboarding` (prompt, `Field`, alert, **Continue** and labeled **Skip** in `AppShellFooter`).

### `/setup/address`

Same column. Wordmark span + Menu. **h1** “Your Wallet of Satoshi address”. Hello line muted when a name exists. `LightningAddressForm onboarding` (**Continue** and labeled **Skip**). Placeholder `you@walletofsatoshi.com` stays (product token).

### `/setup/rules`

Fill `AppShell` `align="start"` with **`topRight={<SignedInChrome />}` only** — the page does not pass `topLeft`. `OnboardingGate screen="rules"` → `RulesSetup` portals `AppShellTopLeft`: Wordmark **span** + optional back `IconButton` (when chapter index > 0). `AppShellHeader`: **h1** Living room rules, prompt, progress `1 of 9`. Chapter body (`RulesDocument` slice). Alert. `Button` primary lg **Continue** or **I agree to these rules**. No Skip. B′: overlines `text-app-subtle`; Welcome `Check` `text-app-fg`; THE TEST `border-l-2 border-app-accent`.

### `/welcome` (forum)

`PageChrome` `topLeft={<Wordmark href="/welcome" />}` `topRight={<SignedInChrome />}`. `OnboardingGate screen="welcome"` → `Card max-w-xl` → decorative gift-and-Bitcoin SVG 48px → **one** `h1` “Welcome, {name}” → `ForumLoader` / `ForumBoard`:

- No Forum heading. **Do not reintroduce** one.
- Laws `Banner`.
- `SegmentedControl tone="neutral"` `className="!grid grid-cols-2 !rounded-2xl"` — two-column: Active / No gifts yet, then All / Most popular. The unpaid segment may show a numeric chip; omitted at 0 and when unpaid is selected.
- Composer.
- Note cards / empty / loading / error (`middle`): amount `formatBitcoin` plus optional `·` `formatFiatDisplay` when the conversion is non-null + Gift pay (`forum.pay` = “Send Bitcoin”). Load error is `role="alert"` `text-app-danger` + labeled **Try again**. Footer `gap-5`. Founder/moderator: icon-only Trash2 + inline confirm.
- `IntroduceYourselfOverlay` (scrim `bg-app-overlay`, Card panel, IconButton close, labeled `Button` CTA) when setup is complete and the member has not posted.
- `RequirementsOverlay` (same overlay chrome, no Skip) when a post is missing a name, Lightning Address, or rules agreement.

Author names with `accountId` open `/members/[accountId]`.

### `/profile`

Fill `AppShell` `align="center"`; `topLeft={<ProfileChromeLeft />}` `topRight={<SignedInChrome />}`. `OnboardingGate screen="profile"` → `Card sm` → **h1** Profile → `AccountActivityChart` always includes FiatPicker; empty = picker + `profile.chartEmpty`, no SVG; populated ₿ | selected fiat `tone="gift"` → About me (`AboutMeSection` owner: empty prompt + **Write your About me**, or filled text + pencil; copy-profile-link on the card — never a forum post) → Name overline + value + edit `IconButton` → Location overline + value or `location.unset` + edit/clear `IconButton` (pencil / check / X / trash) → Address overline + mono value + edit/delete → `PushToggle` (overline + On/Off value + `IconButton`; secondary outline BellOff off, primary filled Bell on — fill vs outline so color is not the only encoding) → `LanguagePreferenceSwitcher` (overline + `SegmentedControl tone="neutral"` English / Deutsch / Español / Filipino, one-row `rounded-full` like Theme) → `ThemeSwitcher` (overline + `SegmentedControl tone="neutral"` System / Light / Dark) → `FiatPreferenceSwitcher` (overline + `FiatPicker` `tone="neutral"` CHF|EUR|USD|PHP) → `NumberFormatSwitcher` last (overline + `SegmentedControl tone="neutral"` with samples `10'000.23` / `10,000.23` / `23.000,33`). Given/Received labels stay.

### `/members/[accountId]`

Fill `AppShell` `align="center"`; `topLeft={<ProfileChromeLeft />}` `topRight={<SignedInChrome />}`. `OnboardingGate screen="profile"` → `MemberProfileLoader` → identity card (**h1** `profile.title`, chart, About me inside the card — not a forum post; copy-profile-link inside About me — optional Message, name, location (read-only; `location.unset` when empty), Lightning Address, optional role pill, activity **Posts** / **Reactions** as labeled `Button sm` toggles, labeled staff Verify / Propose / Confirm / Appoint via `MemberTrustActions` when the viewer is staff and the subject is someone else) + on-demand post/reply feeds. Own profiles use this route too (forum author names navigate here, not `/profile`). No edit. Back is icon-only like profile. Feed posts/replies keep **Translate** via `NoteTranslate`. `RequirementsOverlay` (scrim `bg-app-overlay`, Card panel, IconButton close, no Skip) when a reply is missing a requirement.

Handbook states: default (About me when set), `note-null`, missing (`view.missing`), error + labeled **Try again**, own, `overlay-address` (posts feed open, listed note expanded, Amount filled, Post → `RequirementsOverlay` **Add your Wallet of Satoshi address**, no Skip), `staff-verify`, `translate*` (German post in the posts feed). Overlay-address is reachable from a posts-feed reply; About me is not a replyable forum note.

### `/notifications`

Fill `AppShell` `align="center"`; `topLeft={<ProfileChromeLeft />}` `topRight={<SignedInChrome />}`. `OnboardingGate screen="welcome"` → `NotificationsLoader` → `NotificationsScreen`: **h1** **Notifications** (`h1` ramp), list of posts, replies, and payments (`{name} posted` / `{name} replied` / `{name} sent bitcoin`, post text or `notifications.photoPost` (**Photo**), reply text or `notifications.photoOnly` (**Photo reaction**), zap amount as stored, time). Unread semibold / read muted. Empty `notifications.empty`. Loading. Error + labeled **Try again**. Click row → `/messages/{parentId}`. No composer.

Handbook states: default list, empty, loading, error.

### `/moderate`

Fill `AppShell` `align="center"`; `topLeft={<ProfileChromeLeft />}` `topRight={<SignedInChrome />}`. `OnboardingGate screen="welcome"` → `Card xl` → **h1** **Moderation** (`h1` ramp) → hub lead (`moderate.hubLead` **Tools for founders and moderators.**). Staff (founder or moderator) see one category row **Hidden notes** → `/moderate/hidden` (hide-tool lead on the row). Non-staff signed-in visitors see the heading plus forbidden copy and no tools list. Menu row **Moderation** (`nav.moderate`, lucide `Shield`, `/moderate`) only for founder|moderator, after Trust Chain. Does not fetch the hidden list. No un-hide control.

Handbook states: default hub, forbidden.

### `/moderate/hidden`

Fill `AppShell` `align="center"`; `topLeft={<ProfileChromeLeft />}` `topRight={<SignedInChrome />}`. `OnboardingGate screen="welcome"` → `Card xl` → in-card icon back to `/moderate` → **h1** **Hidden notes** (`h1` ramp) → lead (soft hide of the note and its untagged direct replies; not a hard delete). Staff (founder or moderator) list newest-hidden first (author, text, **Hidden by {name}** / **Unnamed**, created and hidden times). Empty `moderate.empty`. Loading. Error + labeled **Try again**. Non-staff signed-in visitors see the heading plus forbidden copy and no list. No un-hide control. No hidden photo/video fetch.

Handbook states: default list, forbidden, empty, loading, error.

### `/contact`

Fill `AppShell` `align="center"`; `ProfileChromeLeft` + `SignedInChrome`. `OnboardingGate screen="welcome"` → `Card xl` → **h1** Contact → lead → rules link (`text-app-fg underline`) → Composer (textarea + `IconButton` Send). Alerts. Success navigates to inbox.

### `/rules`

App shell via `RulesPageChrome`. Unsigned: Wordmark href `/` + LanguageSwitcher. Signed-in: `ProfileChromeLeft` + `SignedInChrome`. **h1-lg** Living room rules. `RulesDocument` (rule cards, Welcome/Allowed/Better not/Forbidden lists with check/x, house card, CTA pair **Contact 21.gifts** primary + **Back to the forum** secondary). B′ overlines and ticks as in Color.

### `/messages`

Fill `AppShell` `align="center"`; `ProfileChromeLeft` + `SignedInChrome`. `OnboardingGate screen="welcome"` → `Card xl` `InboxScreen`: **h1** + inbound list with origin captions on rows. The Direct / Contact / Damus filter is founder/moderator only (`SegmentedControl tone="neutral"`, three pills, one row, not the forum 2×2 grid; default Direct; selected `bg-app-btn`). Members see every inbound conversation, no chooser. Staff list is that origin only. Inbound last text muted; last outbound text a filled sent chip. Open thread: in-card back `IconButton` + counterpart name as heading + origin caption + **Inbox thread bubbles** (incoming full-width muted note card, sent filled `app-btn` right) + composer icon send (no filter on the open thread). Member empty is `inbox.empty` with no control; staff empty is per-filter catalog copy with the control still visible. Loading / error / open thread hide the control. In-card back is **All conversations**; page chrome back goes to welcome.

### `/messages/[id]` — public note

App shell via `PublicMessageChrome`. Unsigned: Wordmark href `/` + LanguageSwitcher `tone="light"`. Signed-in: `ProfileChromeLeft` + `SignedInChrome`. `PublicMessageLoader`: public note card (`Card md`), photo/video `rounded-xl`, amount `formatBitcoin` as text plus optional preferred-fiat `·` `formatFiatDisplay` when the conversion is non-null (cookie, otherwise locale default), no pay, no composer, no copy, no FiatPicker. Hydrated: **Log in** or **Back to the forum** as `text-app-fg underline underline-offset-2`. Loading / missing / error (`role="alert"` `text-app-danger`) + **Try again**.

### `/view/[viewKey]`

Fill `AppShell` `align="center"`; `HomeWordmark` + LanguageSwitcher. `ViewProfileLoader` → identity card (chart, About me, icon-only copy-profile-link, name, location, address; no edit/Message; location uses `location.unset` when empty). Below: `ViewProfileClaim`.

- Unclaimed: `bg-app-notice` banner + labeled **Activate**.
- Loading: `Loader2` `text-app-subtle`.
- Already claimed: muted sentence + fingerprint `IconButton` primary.
- Error: alert + `Button` **Try again**.
- In-app: `InAppBrowserView` in a Card.

`referrer: 'no-referrer'` metadata stays (privacy). Do not put the view key in visible chrome.

### `/404`

Marketing shell (duplicated in `not-found.tsx`). `text-5xl font-semibold` “404”, `text-paper/60` body, `ButtonLink variant="accent" tone="dark"` **Back home**.

## Voice

Short, warm, direct. People helping people. English examples (catalogs translate). Visitor copy lives in catalog keys (`src/lib/messages.ts`). Four locales: `en`, `de`, `es`, `fil`. No fifth locale.

| Do                                      | Don’t                                                 |
| --------------------------------------- | ----------------------------------------------------- |
| Ask for help / Send help                | “Start disrupting philanthropy” / “On-ramp to giving” |
| Direct human-to-human gifts in Bitcoin  | “The needy”, “beneficiaries”, “unbanked”              |
| Log in with your device                 | “Authenticate with your passkey credential”           |
| Wallet of Satoshi address               | “LUD-16”, “LNURL-pay endpoint”                        |
| Something went wrong. Please try again. | “Request failed with 500”                             |
| You are a guest in a living room…       | “Community guidelines / ToS summary”                  |
| Open the forum                          | “Go to messenger surface”                             |
| `₿1'500`                                | “1500 sats” as the visitor-facing string              |

Never on any screen: keys, relays, NOSTR, npub, nsec, zap (except engineers’ handbook), invoice jargon. Push copy stays English `{ title, body }` as the API already sends.

## Accessibility

WCAG 2.2 AA.

- **Contrast 1.4.3.** See Color. No orange text on paper. Light subtle `#737373` on white is AA. Dark subtle `#a3a3a3` on ink passes.
- **Target 2.5.8.** Labeled buttons and `IconButton` `md`/`lg` ≥ 44×44 **painted**. In-card `sm` stays 24px paint with `::before` slop (`content-['']` + `-inset-2.5`). Clustered `sm` rows use `gap-5` so 44px hits touch and do not overlap.
- **Non-text 1.4.11.** Focus ring 2px `app-focus`, offset 2px. Do not use orange rings.
- **Reduced motion 2.3.3.** Global CSS in `globals.css`. Keep `scrollIntoView` auto; no theme fade.
- **Focus order:** unsigned chrome is Wordmark then switchers. Signed-in `ProfileChromeLeft` is back **then** wordmark, then main title → fields → primary action → Menu. Menu open: focus stays on trigger; Escape closes.
- **`aria-label`:** required on every `IconButton`; catalog key, all four locales. Decorative glyphs `aria-hidden`.
- **Color not the only encoding:** profile Given/Received have text labels; forum payable is a Gift button plus amount, not color; errors have text; role badges have text + optional hint; push On/Off + filled vs outline bell.
- **QR:** `role="img"` + catalog label (`QrCode`). Not mounted on smartphone UA.
- **Expandable notes:** `aria-expanded`. Keyboard Enter/Space.
- **Language listbox:** combobox/listbox.

## Visual regression

Four Playwright combos: `desktop-light`, `desktop-dark`, `mobile-light`, `mobile-dark`. Goldens under `e2e/visual.spec.ts-snapshots/`. Filenames `${visual}-${combo}-linux.png`. `maxDiffPixelRatio` 0. Handbook doc pages are not shot.

Do not regenerate goldens on a developer machine. Regen is CI / Linux Playwright. `screenshot:check`, `handbook:check`, Function e2e.

Marketing light/dark goldens are identical (always ink) — accepted.

`scripts/check-screenshots.mjs` and handbook images remain the operator-facing proof. Do not add a second screenshot stack.

## Closed decisions

1. **One family: Outfit** (SIL OFL) via `next/font/google`, `weight: 'variable'`, `className={outfit.variable}` on `<html>`. Figtree or Instrument Sans remain an implementer escape hatch only if goldens fail the family test — one grotesque family, not Inter, tabular lining figures still apply.
2. **Two shells remain.** Marketing always-dark, no ThemeSwitcher. App keeps `ThemeProvider` / cookie / `html.dark`. Light theme stays.
3. **Orange is shell-split.** Marketing: primary filled CTA + kickers + stats paint. App: gift-money **fill** only. Never orange text on paper. THE TEST bar is the only decorative orange on `/rules`.
4. **Wordmark is text chrome** `21.gifts`, not an SVG logotype. Signed-in links to `/welcome` except `/setup/*` (span); marketing, login, donate, and view follow it via `HomeWordmark`.
5. **Control grammar wins.** Labeled for consent/continue/skip/login/logout/retry/activate/sentence-length/marketing primary/donate Open the forum. Icon-only inside cards. Notifications rows are labeled full-row controls. Member profile has no edit.
6. **Pay control is lucide Gift, not ₿.** Amount is `formatBitcoin` plus optional `·` `formatFiatDisplay` when the conversion is non-null, otherwise ₿-only (no ` · —`). Accessible name stays **Send Bitcoin** (`forum.pay`).
7. **QR plates stay white** in both themes, `border-app-border`. No QR on smartphone UA.
8. **Empty profile chart is copy plus FiatPicker**, not an axis; no SVG / no ₿|fiat scale. `profile.chartEmpty` `role="status"`.
9. **Four locales stay** (`en` `de` `es` `fil`). No fifth locale. Brand-voice examples in English.
10. **Markdown in-repo is the source of truth.** Figma is not required.
11. **Photo/story is a reserved 96×96 circle + story clamp**, not a shipped feature.
12. **No rebrand.** Live marketing is the product face: ink, Outfit, `#f7931a`, wordmark `21.gifts`. Do not kill light theme. Do not regenerate goldens on a developer machine.

## File map

| Concern            | File                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------ |
| Canonical system   | `docs/ui.md` (this document, English, public-repo safe)                              |
| Tokens             | `src/app/globals.css` `@theme` + `html.dark`                                         |
| Font               | `src/app/layout.tsx` `next/font/google` Outfit                                       |
| Primitives         | `src/components/ui/*`                                                                |
| Control grammar    | this file + `CONTRIBUTING.md` **Icon controls**                                      |
| Handbook screens   | `docs/handbook/screens.md`                                                           |
| Variants / goldens | `scripts/screen-variants.mjs`, `e2e/visual.spec.ts`, `e2e/visual.spec.ts-snapshots/` |

**Public-repo hygiene.** In-repo docs never name private repositories, internal hostnames, or infra internals. Say “the API concept document (Brand)” without a private path. CONTRIBUTING already links the public API repo; that link may stay. Mermaid is fine. Keep numbers.
