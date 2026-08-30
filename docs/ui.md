# UI inventory

Closed set of shells, tokens, and controls for the 21.gifts app. New UI composes
these pieces. Do not invent a second visual system.

## Shells

### Marketing (always dark)

Routes under `src/app/(marketing)/` (`/`, `/legal`, `/stats`, `/handbook`, …)
use `MarketingLayout`: hardcoded `#0a090c` background, white text, accent
`#f7931a`. No ThemeSwitcher. Header/footer stay dark regardless of the
visitor’s system preference.

### App (themeable)

Signed-in and account surfaces (`/login`, `/welcome`, `/profile`, `/messages`,
`/setup/*`, `/contact`, `/rules`, `/view/*`, …) use semantic `app-*` tokens from
`src/app/globals.css` and may show ThemeSwitcher (system / light / dark). Prefer
`bg-app-*` / `text-app-*` / `border-app-*` — never raw `bg-neutral-900` or
`dark:bg-[#0a090c]` dual-writes outside primitives.

## Colors (`app-*`)

Defined in `@theme` and overridden under `html.dark`:

| Token | Light | Dark |
| --- | --- | --- |
| `app-bg` | `#ffffff` | `#0a090c` |
| `app-fg` | `#171717` | `#ffffff` |
| `app-muted` | `#737373` | `#a3a3a3` |
| `app-subtle` | `#a3a3a3` | `#737373` |
| `app-border` | `#e5e5e5` | white/20 |
| `app-border-strong` | `#d4d4d4` | white/30 |
| `app-card` | `#ffffff` | `#121116` |
| `app-card-muted` | `#fafafa` | `#1a191e` |
| `app-btn` / `app-btn-fg` | dark on light | light on dark |
| `app-btn-hover` | `#404040` | `#e5e5e5` |
| `app-hover` | `#fafafa` | white/10 |
| `app-accent` | `#f7931a` | `#f7931a` |

QR plates stay light (`bg-white`) in both themes. Destructive alerts use
`text-red-600` with `role="alert"`.

## Chrome

- **PageChrome** — full-height app page shell (`relative flex min-h-screen …`),
  optional top-right slot (SignedInChrome / LanguageSwitcher / ThemeSwitcher).
- **Card** — primary content panel (`rounded-3xl border border-app-border
  bg-app-card p-8 shadow-sm`).
- Marketing header/footer stay in their dedicated components (dark shell).

## Money

Visitor amounts use `formatBitcoin` from `src/lib/stats-money.ts` (BIP 177):
leading `₿`, locale-grouped integer, no fraction, no extra `₿` beside the
string. JSON field names (`sats`, `totalSats`, …) and the product phrase
“Wallet of Satoshi” stay unchanged. Do not prepend a second bitcoin glyph to
`formatBitcoin` output.

## Controls

| Primitive | Use when |
| --- | --- |
| **Button** | Labeled action (Log in, Continue, Send, Retry). Optional leading icon. Primary = filled `bg-app-btn`; secondary = bordered. |
| **IconButton** | Icon-only control with a required accessible name (attach, send icon, dismiss, copy, pay, menu row icons). |
| **Field** | Labeled text input or textarea with shared border/focus tokens. |

Do not sprinkle `rounded-full bg-app-btn px-6 py-3` outside these primitives on
new or migrated surfaces.

## Out of inventory

Unevennesses to **fix** when touching a screen — do not document them as
canon:

- Double login title (page `h1` plus card `h2`) — keep a single title.
- Forum header stacks that repeat the same label.
- Double bitcoin glyph (`₿21 ₿`) next to amounts.
