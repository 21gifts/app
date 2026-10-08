# Screens

Every variant below is captured in all four Linux Chromium combos (desktop/mobile × light/dark). Markdown images are the desktop-light shot. The other combo PNGs are visual-test baselines only.

**Signed-in header.** Signed in means the wallet's recovery phrase is in this tab's memory, except for accounts that cannot hold a wallet. After reload, in a new tab, or after reopening the app, a valid stored session without that phrase counts as signed out. The central `OnboardingGate` keeps the visitor on the requested path and shows the ordinary login card in place of every signed-in screen; **Log in** refreshes the session and derives the phrase with that passkey prompt, asking for the seed passkey only when another passkey signed in. No-PRF and other failures appear above **Log in**; cancellation leaves the login card alone. While the login card shows, the signed-in Menu is absent, as for any signed-out visitor, and, for a held-back session, **Log out** sits under the card. Guest-allowed `/welcome` and `/statistics` show their signed-out view instead. One-time wallet setup is not part of this gate and may continue in the background. Every signed-in screen with the Menu (`SignedInChrome`) shows one **Menu** top-right; there is no separate wallet button in the header. Open, the Menu starts with the account header (`MenuAccountHeader`): the profile photo or the name's initial, the name and `@username`, and in the top-right corner the wallet balance small (₿, with the default fiat under it; a link to `/wallet`; two skeleton bars while the wallet opens; nothing while it has failed or is not available), then a row **Received** / **Given** (each ₿ with the default fiat under it) / **Posts**. That row keeps its height from the first frame: skeleton bars until the numbers arrive, `–` for a value that could not be read. Opened right after a page load, while the stored session is still being checked, the header already has its final size: a skeleton circle for the photo and skeleton bars for the name and `@username`, so **Home** and the rows under it do not move when the account arrives. Photo and numbers start loading when the header chrome mounts, not when the Menu opens, and are kept for the session, so they are usually there on the first open. A divider follows, then **Home** and **Balance** (`/wallet`) as the first two rows. On a phone the open Menu is a sheet that ends above the page footer (Receive / Send or a page button) and scrolls by itself, so its last row (the version line) is reachable while the page behind stays put. The page frame uses a tighter inset (`px-3 py-2`, `px-2` below 360px) and the frame rows `px-5`, so the header fits at 320px.

**Role hierarchy.** Ranks are basis 0, verified 1, moderator 2, initiator 2, founder 3. Initiator is rank 2, equal to moderator. A named minimum means that rank or any higher rank, and an equal rank meets it. The app checks this with `roleAtLeast` (`src/lib/roles.ts`); an equality test on the viewer's role is a defect. Do not write "moderator or initiator" or „Moderator oder Initiator“; permission checks name the minimum rank only.

## Screen: /

- **URL:** `/` — public marketing landing (no auth gate).
- **What the user sees:** Dark 21.gifts header with one top-left arrow (previous in-app view, or `/welcome` when this tab has none) beside the wordmark (`/` when unsigned, `/welcome` when a session is hydrated; the wordmark is not that arrow) and a language switcher, headline about peer-to-peer Bitcoin gifts, How it works (login, wallet setup, and the `you@21.gifts` address) / Happyland (Father Severin’s account, eight captioned photographs in all four languages; food-stall caption **Pagpag**) / Why / Donate to this project (the platform account's own 21.gifts address, `<platform username>@<host>`, to run 21.gifts itself, distinct from `/donate`; shown only when the build names the platform account) / FAQ, CTAs **Ask for help** (`/login`) and **Send help** (`/donate`). **Install app** appears in the header and after Send help only for iPhone Safari/Chrome/Firefox/Edge (not standalone, not in-app) or when Chromium fires `beforeinstallprompt`; idle visual snapshots stay without it because the control renders `null` until after mount detection.
- **Actions:** Read the pitch, change language, open login, open Send help, optionally install the app (Chromium prompt or iPhone three-step Share sheet), jump to in-page sections, open About, open Stats, open Legal & Privacy, open Terms of Use, open the Handbook.
- **Calls:** `Home` (`src/app/(marketing)/page.tsx`) inside `MarketingLayout`, `LanguageSwitcher`, `PwaInstall`, `HappylandSection`, `HappylandPhoto`.

### Variant: default

Desktop/wide layout (from 1024px): section nav is visible in the header (How it works, Happyland, Why, FAQ, About, Stats, Handbook, Log in). Happyland links to `/#happyland`, including from other marketing pages, and leaves space below the sticky header for the section heading. No hamburger.

![21.gifts home](images/root.png)

### Variant: mobile-nav

Captured at desktop and mobile. Below 1024px the header shows the Menu button; open it to reveal the same links stacked, with Happyland immediately after How it works. Tapping Happyland closes the menu and scrolls to the existing photo essay. On desktop this is the landing without the hamburger.

![21.gifts home mobile nav](images/root-mobile-nav.png)

### Variant: language-open

Open the language switcher in the marketing header. Custom listbox (rounded panel, endonym rows with a check on the current locale) — not OS chrome.

![21.gifts home language](images/root-language.png)

## Screen: /legal

- **URL:** `/legal` — imprint and privacy. `/legal.html` permanently redirects here.
- **What the user sees:** Dark 21.gifts header with one top-left arrow (previous in-app view, or `/welcome` when this tab has none) beside the wordmark (`/` when unsigned, `/welcome` when a session is hydrated; the wordmark is not that arrow) and a language switcher, Legal Notice (Switzerland; a line that using 21.gifts is governed by the **Terms of Use**, linked to `/terms`) and Privacy Policy (the website runs no advertising and loads no analytics scripts; `locale` only after a language choice or to mirror the account language; `fiat` only as CHF/EUR/USD/PHP after a currency choice or to mirror the account currency; choosing `numberFormat` writes its cookie and absent means Swiss `10'000.23`; choosing light/dark writes `theme` and System removes it; a logged-in session token is stored in `localStorage`; Cloudflare TLS; login on this origin; **Wallet and payment data**: 21.gifts sees the balance and the complete transaction history of the in-app wallet, and the paragraph links **Wallet and data** to `/terms#wallet-and-data` for how that data is used, who in the team may see it, and what may be published). There is **no published email**; contact is in-app only via `/contact` after login. Legal body copy stays English.
- **Actions:** Change language. Signed-out choices remain cookie-only and do not write an account. Read the legal body. Open **Open the app** (`/contact`). Open **Terms of Use** (`/terms`) or **Wallet and data** (`/terms#wallet-and-data`). Header **Log in** goes to `/login`.
- **Calls:** `LegalPage` inside `MarketingLayout`, `LanguageSwitcher`.

### Variant: default

The only state: imprint plus privacy, marketing chrome.

![21.gifts legal](images/legal.png)

## Screen: /terms

- **Purpose:** Public Terms of Use of 21.gifts.
- **URL:** `/terms` — public marketing page (no auth gate). Linked from `/legal`, the marketing footer, and the last chapter of `/setup/rules`.
- **What the user sees:** Dark 21.gifts header with one top-left arrow (previous in-app view, or `/welcome` when this tab has none) beside the wordmark (`/` when unsigned, `/welcome` when a session is hydrated; the wordmark is not that arrow) and a language switcher, heading **Terms of Use**, the muted line **Last updated: 6 October 2026**, the section heading **Wallet and data** (anchor `#wallet-and-data`), and five numbered clauses, each opening with a short bold heading: **Self-custody**, **Access to wallet data**, **Analysis of spending**, **Access by the team**, **Public assessments**. All copy comes from the catalog in the visitor's locale (German, English, Spanish, or Filipino).
- **Actions:** Change language. Read the clauses. Header **Log in** goes to `/login`.
- **Calls:** `TermsPage` inside `MarketingLayout`, `LanguageSwitcher`.

### Variant: default

The only state: title, last-updated date, the **Wallet and data** heading, and the five numbered clauses, marketing chrome.

![21.gifts terms of use](images/terms.png)

## Screen: /about

- **Purpose:** Public foundation of the house — three convictions and Matthew 10:8.
- **URL:** `/about` — public marketing page (no auth gate).
- **What the user sees:** Dark 21.gifts header with one top-left arrow (previous in-app view, or `/welcome` when this tab has none) beside the wordmark (`/` when unsigned, `/welcome` when a session is hydrated; the wordmark is not that arrow) and a language switcher, kicker **About**, heading **Three convictions**, a short lead, the Matthew 10:8 verse, then three numbered convictions (Giving is a duty with 1 John 3:18; Direct, with no middleman; Bitcoin is the most effective money) and **Open the living room** (`/welcome`). Visitor copy comes from the catalog.
- **Actions:** Change language. Read the convictions. Open **Open the living room** (`/welcome`). Header **Log in** goes to `/login`.
- **Calls:** `AboutPage` inside `MarketingLayout`, `LanguageSwitcher`, `ButtonLink`.

### Variant: default

The only state: three convictions, verse, and forum CTA, marketing chrome.

![21.gifts about](images/about.png)

## Screen: /stats/[day]

- **URL:** `/stats/YYYY-MM-DD` — public list of outbound gifts that UTC day. Invalid dates 404.
- **What the user sees:** Dark 21.gifts header with one top-left arrow (previous in-app view, or `/welcome` when this tab has none) beside the wordmark (`/` when unsigned, `/welcome` when a session is hydrated; the wordmark is not that arrow), an **All stats** link to `/stats` (not a second back control), heading **Gifts on {day}**, a **UTC day** date input, then either the gift table (Time, Recipient, ₿, selected fiat code) with a FiatPicker **only when unsigned**, empty copy **No gifts recorded on this day.**, **Loading…**, or **Try again**. Signed-in visitors still see preferred-fiat amounts and cannot change the code here. Summary `{n} gift(s) · ₿ · formatFiatDisplay(total, preferred fiat, numberFormat)`. Stats body copy stays English.
- **Actions:** Pick another UTC day in the date input (navigates to `/stats/{next}`). When unsigned, pick CHF | EUR | USD | PHP on FiatPicker (writes cookie `fiat`). Open **All stats**. Change language. Number format is a signed-in `/profile` settings row next to theme, not Menu chrome, and not on this public header. Header **Log in** goes to `/login`.
- **Calls:** `GiftDayPage`, `DayLoader`, `GiftDayTable`, `FiatPicker`, `fetchGiftDay` (`GET /gifts?day=`).
- **Auth:** None.

### Variant: default

Loaded day with at least one gift row (recipient **alice**).

![21.gifts gifts on a day](images/stats-day.png)

### Variant: empty

No gifts that UTC day. Copy **No gifts recorded on this day.**

![21.gifts empty day](images/stats-day-empty.png)

### Variant: loading

Waiting on `GET /gifts`. Copy **Loading…**

![21.gifts day loading](images/stats-day-loading.png)

### Variant: error

Fetch failed. Button **Try again**.

![21.gifts day error](images/stats-day-error.png)

## Screen: /stats

- **URL:** `/stats` — public gift totals and a posts total (no auth gate).
- **What the user sees:** Dark 21.gifts header with one top-left arrow (previous in-app view, or `/welcome` when this tab has none) beside the wordmark (`/` when unsigned, `/welcome` when a session is hydrated; the wordmark is not that arrow) and a language switcher, heading **Gifts**. When post stats load, a **Posts** total sits above the gift cards: living notes and replies counted together, hidden notes excluded, with a bar on each UTC day that has posts and a gap where a day has none. A failed post fetch omits that block and still shows the gift diagrams. Four KPI cards (total spent as BIP-177 **₿** plus the selected fiat, gifts, people, period), a FiatPicker (CHF | EUR | USD | PHP) above the cards **only when unsigned**, then diagrams: **Total spend over time** (one cumulative chart; days with spend are markers on the series, not a wrapping date list), **By person** and **By month**. Each diagram has a `SegmentedControl tone="gift" shell="dark"` ₿ | selected fiat control that defaults to ₿; over time switches the series, person and month rescale bar size while labels stay both units. Signed-in visitors still display and scale with the preferred code and cannot change it here. Empty database copy: **No gifts recorded yet.** Stats body copy stays English.
- **Actions:** Change language. Read the posts total and the gift charts. Open a spend day (`/stats/{YYYY-MM-DD}`) from **Total spend over time** by clicking a day with spend. When unsigned, pick CHF | EUR | USD | PHP on FiatPicker (writes cookie `fiat`). Switch **Total spend over time** / **By person** / **By month** between ₿ and the selected fiat. Header **Stats** stays on this page; **Log in** goes to `/login`.
- **Calls:** `StatsPage`, `StatsLoader`, `StatsDashboard`, `FiatPicker`, `fetchGiftStats` (same-origin `GET /gifts/stats`), `fetchPostStats` (same-origin `GET /messages/stats`), `LanguageSwitcher`.

### Variant: default

Loaded stats. **Posts** shows notes and replies as one total, with a bar on days that have posts and a gap on days that have none. One cumulative over-time chart is visible. Scale defaults to ₿.

![21.gifts stats](images/stats.png)

### Variant: usd-scale

Inverted ranking fixture (June tall in ₿ / short in USD, July the reverse). **Posts** stays the same notes-and-replies total. Scale switched to USD on **Total spend over time**, **By person**, and **By month**.

![21.gifts stats USD scale](images/stats-usd-scale.png)

### Variant: empty

Zero gifts and zero posts. **Posts** shows 0 with no bars. KPI zeros and **No gifts recorded yet.**

![21.gifts stats empty](images/stats-empty.png)

### Variant: loading

Waiting on `GET /gifts/stats`. Copy **Loading…**

![21.gifts stats loading](images/stats-loading.png)

### Variant: error

Fetch failed. Copy **Could not load gift stats. Please try again.** and **Try again**.

![21.gifts stats error](images/stats-error.png)

## Screen: /trust-chain

- **URL:** `/trust-chain` — signed-in Trust Chain. Same onboarding gate as `/welcome` (`OnboardingGate screen="welcome"`). JSON is `/trust/graph` (Next.js forbids `route.ts` beside this page). Any logged-in completed account may view (not staff-only).
- **What the user sees:** Chrome is the page-frame header (`ProfileChromeLeft` (the arrow returns to the previous in-app view, or `/welcome` when this tab has none; wordmark → `/welcome`), and Menu, inside the rounded sheet). Fill `AppShell` (`align="start"`). Open **Menu** (see **Signed-in header**) for **Home**, **Balance** (`/wallet`), **Shops**, **Point of sale**, Profile, **Grants**, **Settings**, **Living room rules**, **Habit-Tracker**, **Trust Chain**, **Statistics**, **Notifications**, **Messages**, **Contact**, optional **Install app**, and **Log out**. Heading **Trust Chain**, a short lead that says to click a person to load everyone linked to them and drag a person to move them, then a chain that starts with the founder. Clicking a person loads one hop of stored links (never the whole thousand-person graph at once). One next person sits to the right; several people hanging off one person (everyone a moderator verified) stack top to bottom. Dragging a person moves that block; already-placed people keep their spot when a hop arrives. Below the diagram, four short explanations: **Verified**, **Moderator**, **Initiator**, and **Founder** (an initiator is named directly, with no proposal step; catalog `trustChain.explainInitiator`). Empty copy: **No one is on the Trust Chain yet.** Loading copy: **Loading…**. Error copy plus **Try again**.
- **Actions:** Click a person to load who they met or appointed. Drag a person to rearrange. Modifier-click a person to open the member card (`/members/{id}`). The top-left arrow returns to the previous in-app view in this tab, or `/welcome` when this tab has none. One arrow. The wordmark is not that control. Open **Menu** (see **Signed-in header**) for **Home**, **Balance** (`/wallet`), **Shops**, **Point of sale**, Profile, **Grants**, **Settings**, **Living room rules**, **Habit-Tracker**, **Trust Chain**, **Statistics**, **Notifications**, **Messages**, **Contact**, optional **Install app**, or **Log out**.
- **Calls:** `AppShell`, `ProfileChromeLeft`, `TrustChainPage`, `TrustChainLoader`, `TrustChainScreen`, `TrustChainDiagram`, `layoutTrustChain`, `mergeTrustChain`, `fetchTrustChain` (same-origin `GET /trust/graph` and `GET /trust/graph?around=`), `SignedInChrome`, `OnboardingGate`.
- **Auth:** Bearer session; `OnboardingGate screen="welcome"`.

### Variant: default

Founder seed **Cyrill** only. Lead tells the visitor to click a person to load everyone linked to them.

![21.gifts Trust Chain](images/trust-chain.png)

### Variant: expanded

Click **Cyrill**, then **Severin**. The chain grows left to right: Cyrill appointed Severin, who verified Ada and Bob.

![21.gifts Trust Chain expanded](images/trust-chain-expanded.png)

### Variant: empty

Zero nodes. Copy **No one is on the Trust Chain yet.**

![21.gifts Trust Chain empty](images/trust-chain-empty.png)

### Variant: loading

Waiting on `GET /trust/graph`. Copy **Loading…**

![21.gifts Trust Chain loading](images/trust-chain-loading.png)

### Variant: error

Fetch failed. Copy **Could not load the Trust Chain. Please try again.** and **Try again**.

![21.gifts Trust Chain error](images/trust-chain-error.png)

### Variant: hop-error

Founder seed is on screen. Clicking that person fails the hop fetch. The diagram stays; the same error copy and **Try again** sit above it. Retry re-fetches that hop without re-fetching founder seeds; the banner stays gone only if the hop succeeds.

![21.gifts Trust Chain hop error](images/trust-chain-hop-error.png)

## Screen: /wallet

- **URL:** `/wallet` — signed-in wallet home, with a **Send** view and a **Receive** view on the same page. The recovery phrase is a separate page. When the in-app wallet is enabled by configuration and the account can produce a phrase (`walletRequired` with a `passkeyCredentialId`), the balance block sits in the centre of the home view.
- **What the user sees:** Fill `AppShell` with profile chrome left and **Menu** right. The wallet is already open here. Open **Menu** (see **Signed-in header**) for **Home**, **Balance**, **Shops**, **Point of sale**, Profile, **Grants**, **Settings**, **Living room rules**, **Habit-Tracker**, **Trust Chain**, **Statistics**, **Notifications**, **Messages**, **Contact**, optional **Install app**, and **Log out**. The heading **Wallet** is for screen readers only. **Home:** with the wallet configured for an eligible account, the balance region **Balance** sits large in the centre with connecting, ready, and error states only. Connecting shows the pending line; ready shows the Bitcoin balance as a large figure with the default fiat in small type under it once a usable rate is loaded (without a usable rate, only the Bitcoin figure); error shows a sentence and **Try again**. A visitor whose stored session has no phrase in this tab sees the login card in place of this entire page on the same `/wallet` path, so no wallet heading, balance, history, or footer actions show until login opens the wallet. One-time setup is separate and runs in the background; until verification finishes the balance stays connecting. If all quiet setup retries fail, the balance instead shows the alert **Your wallet could not be set up yet.** with a secondary **Try again** button; **Receive** and **Send** stay in place and enabled. A reload, a new tab, or reopening the app clears the tab-only phrase and brings back the in-place login card. Moving inside the app does not: the top-left arrow, the **Menu**, and in-app links open the next view client-side in the same document, so the wallet stays open and a payment does not ask for the passkey again. Without configuration there is no balance region. While the wallet is ready, a **Payments** card under the balance lists payments newest first (received or sent, Bitcoin with the default fiat, date, and the payer's note when there is one); the next page loads when the end of the list is in view, checked again after every completed load, and the list reloads after every wallet sync. Fixed at the bottom of the screen are two large, equal buttons side by side, **Receive** on the left and **Send** on the right. Nothing sits under them: the recovery phrase is reached from **Settings** in the Menu (`/settings`). **Receive** and **Send** are always enabled, also right after login while the wallet still opens: only a step that needs the open wallet waits for it. **Receive view:** the label **Receive**, the Open CryptoPay QR of the member's 21.gifts address, the address itself, a **Copy** button that says **Copied** for two seconds after a copy, and **Set an amount** to `/pos`. Without a username it says **Set a username first.** with a link to `/profile`. While the one-time setup has not registered the address yet, a spinner and **Opening your wallet…** stand where the QR and address go, and the address appears on its own once it is registered; a setup that gave up shows **Your wallet could not be set up yet.** with a secondary **Try again** there instead. **Send view:** region **Send Bitcoin** opens with the camera already live (rear camera preferred), filling the whole page area under the header row edge to edge, down to the bottom of the page frame (the picture is cropped to fill). A white square with bold corners in the middle shows where to hold the code; it is only a guide, and the whole picture is read. The line **Point the camera at a Bitcoin QR code** sits in large white type over the top of the picture. Two dark translucent buttons float over the lower part of the camera: **Paste** and **Enter manually** (side by side, or stacked on a narrow phone). **Paste** reads the clipboard (iOS shows its own small **Paste** bubble first) and sends that text on exactly as a scanned code; when the browser refuses, a short alert says **Pasting was not allowed. Use Enter manually instead.**, and an empty clipboard says **The clipboard is empty.**; either disappears after a few seconds while the camera keeps running. **Enter manually** opens a sheet from the bottom over the camera with a Close (`X`) top-left, the **Payment request or address** field (focused, so the keyboard opens), and **Continue**; Close or the top-left arrow returns to the camera. The first QR code the camera reads goes into the field exactly as if it had been typed, and **Continue** runs on it. While the text is read a spinner turns in the middle and both floating buttons wait. A blocked camera shows **Camera access was blocked. Allow it in your browser settings, or paste the payment request.** in large white type on the black area; a device without a camera, or a page that cannot use one, shows **No camera found. Paste the payment request instead.** there. **Paste** and **Enter manually** keep working in both cases. Text that cannot be used always ends in one plain alert, never in silence: over the camera in large white type with **Try again** (which clears it and starts the camera again), or under the field while the sheet is open. That includes an unexpected error while reading it (**This could not be read. Please try again.**) and, for an account that has no wallet it can use here, **Your 21.gifts wallet is not available here, so this cannot be paid.** once a step needs the wallet. The camera, **Paste**, and **Enter manually** never wait for the wallet. A Lightning address or LNURL on another host and a 21.gifts shop's open charge are read without the wallet. A text the wallet itself has to read (a payment request, a Spark address or request, a base-chain address, or an address on this app's own host) keeps the text while the wallet still opens: the camera stays off, a spinner turns in the middle with **Opening your wallet…** under it, both floating buttons wait, and the text is read on its own once the wallet is open. When the wallet could not be opened, **Your wallet could not be opened. Please try again.** shows there instead, with **Try again**, which opens the wallet again (or runs its one-time setup again) and then goes on with the same text. The camera runs only while the input step shows no alert, nothing is being read, and the sheet is closed; it stops on a scan, on a paste, on **Continue**, on the next step, on Back, and when the view closes, and it starts again when the input step comes back without an alert. **Copy** pressed again while it says **Copied** shows **Copied** for another two seconds. A request or address without an amount then asks for an amount (the amount field with the ₿ / fiat switch and **Continue**); a Lightning address or LNURL receiver also shows its bounds and, when it takes one, an optional message within its limit. A receiver that takes exactly one amount, such as a shop's point-of-sale QR while a charge is open, skips the amount step and goes straight to the confirm step for that amount, without a message. For a 21.gifts shop on this app's own host (its address, its LNURL, or its `/pl/?lightning=` link), the page first asks `GET /pay/<name>` for an open charge and `POST /pay/<name>/invoice` for its Spark invoice; with one, the confirm step shows **To <name>@<host>**, the charge amount, and **Fee ₿0**, and **Send** pays that Spark invoice. Without an open charge or a Spark invoice, or when that payment cannot be prepared, the text is read as before. For a 21.gifts member on this app's own host without an open charge (also when the charge closed while it was asked), the amount and optional message are entered as for any address; **Continue** then asks `POST /pay/<name>/invoice` for a Spark invoice of exactly that amount, and with one the confirm step shows **To <name>@<host>**, the amount, and **Fee ₿0**, and **Send** pays that Spark invoice. Without a Spark invoice, or when it cannot be prepared, the member is paid over Lightning as before, with the fee the wallet quotes. The confirm step has no box and no Close: the amount sits large in the centre, like the home balance, with the default fiat in small type under it once a usable rate is loaded; under it **To …** in small type (cut short when it is long) and **Fee ₿…** in small type, with the default fiat only when the fee is above ₿0. Fixed at the bottom of the screen are one large, full-width **Send** and under it a small **Cancel** text button. The amount step never waits for the wallet. When a payment is ready to be confirmed while the wallet still opens, the confirm step already shows the large amount and **To …**, with a spinner and **Opening your wallet…** where the fee goes and **Send** disabled; once the wallet is open the fee is read and the step shows it with **Send** enabled, without a tap. When the wallet could not be opened, **Your wallet could not be opened. Please try again.** with a secondary **Try again** stands there instead. **Cancel** works throughout. When the wallet closes and opens again while a confirm step shows, that step reads its fee again the same way. For an LNURL that points at an address (`https://<host>/.well-known/lnurlp/<name>`, pasted, scanned, or inside a `/pl/?lightning=` link), **To …** names `<name>@<host>`, as for a pasted Lightning address; another LNURL names its domain. After sending: a large green check, **Sent ₿…** as the large figure with the default fiat in small type under it, **To …** in small type, and at the bottom one large, full-width **Done**, which returns home. A base-chain Bitcoin address, pasted, scanned, or in a `bitcoin:` URI that offers no Lightning or Spark payment, asks for an amount (a URI amount is used at once); an amount below the smallest the wallet sends to that address reopens the amount step with **Enter an amount of at least ₿… · $….** Its confirm step keeps the large amount and **To …** (the address cut short), then **Fee ₿…** and **Total ₿…** in larger type with the default fiat, then the **Speed** rows **Fast**, **Medium** (chosen first), and **Slow**, each with its fee in Bitcoin and the default fiat on one line; a speed the balance does not cover is greyed out and says **Balance too low**, and the slow speed is chosen first when the medium one is not covered. Under the rows a muted line says that this network fee is much higher than the fee of other payments. **Send** sends with the chosen speed, and the payment then shows in **Payments** as sent, marked **Pending** until the network confirms it. When the fee offer ran out before **Send**, nothing is sent: the confirm step comes back with a new fee and the alert **The fee offer expired, so nothing was sent. Check the new fee and press Send again.** Text that is not a payment request, a payment request this wallet cannot pay yet, a receiver whose server this browser cannot reach, a failed send, and too little balance each show one plain alert. A Lightning address or LNURL on another host is read through the 21.gifts api instead of this browser (`POST /lnurl/pay-request`, then `POST /lnurl/invoice` for the chosen amount); the wallet then pays the returned invoice, and the steps look the same. An address the api cannot pay, an address its server does not know, and a server that did not answer the api each show one plain alert; a message longer than the receiver accepts shows an alert in the amount step. Addresses on this app's own host and Spark targets are read by the wallet as before. The Send view stays on screen while a send is in flight, while its Sent line shows, and while an input alert is up. A Send or Receive view never closes because the wallet is not ready. This page never shows the 12 words, a recovery error, a keypad, or an open charge.
- **Actions:** **Send** opens the Send view (and the camera); **Receive** opens the Receive view. Tapping the ready balance swaps which of Bitcoin and fiat is the large figure; it does nothing without a usable rate. Login opening is handled by the in-place login card before this screen appears. **Try again** retries connection after a normal wallet error. The setup note's **Try again** reloads when wallet initialisation requires it, otherwise starts the background setup again. **Try again** on the **Payments** card loads the list again. **Copy** puts the 21.gifts address on the clipboard. **Set an amount** opens `/pos`. Open **Menu** (Home, Balance, Shops, Point of sale, Profile, Grants, …). Show a QR code to the camera, press **Paste**, or press **Enter manually**, type a payment request or address, and **Continue**; enter an amount and **Continue**; **Send**; **Done**. The amount step's Close (`X`, **Cancel**) and the confirm step's **Cancel** close that step, back to the field (also a confirm step reached without an amount step), except while a confirm send is in flight, when **Cancel** is disabled and the confirm step stays. Back, in the Send view, first closes the manual-entry sheet, then an open send step (while a confirm send is in flight, or while the text is read, it does nothing); on the input step it clears the field and its alert and returns home, also while a text waits for the wallet, which it then drops. In the Receive view, Back returns home. On home, the top-left arrow returns to the previous in-app view in this tab, or `/welcome` when this tab has none. One arrow. The wordmark is not that control.
- **Calls:** `AppShell`, `AppShellFooter`, `WalletScreenView` (registers `ProfileChromeLeft` through `AppShellTopLeft`; that Back is the one on screen, not the page `WalletChromeLeft`), `SignedInChrome`, `OnboardingGate`, `WalletScreen`, `useWallet`, `WalletBalance`, `useSpotRate`, `WalletHistory`, `useWalletHistory`, `WalletSetupNote`, `useWalletSetup`, `useWalletPhrase`, `useWalletSend`, `useWalletPanel`, `WalletFooterActions`, `WalletPanelView`, `WalletReceive`, `WalletSend`, `QrScanner`, `parseWalletInput`, `payFromWallet`, `AmountEntry`, `lnurlRelayTarget`, `ownShop`, `fetchShopChargeInvoice`, `fetchMemberSparkInvoice`, `postLnurlPayRequest`, `postLnurlInvoice`, `QrCode`, `giftsLightningAddress`, `openCryptoPayQrValue`.

### Variant: default

Existing member with the wallet not configured (Playwright builds). The home view has no balance region; **Receive** and **Send** are both enabled at the bottom under the soft fade, Receive on the left, with nothing under them.

![21.gifts wallet home](images/wallet.png)

### Variant: balance-locked

Pinned fixture (`?visual=balance-locked`, Playwright builds only), not a live wallet. The ordinary `/login` card appears in place of the wallet while the path stays `/wallet`: heading **Log in with your device**, primary **Log in**, the new-account line, and **Open a new account**. The wallet heading, balance, payment history, **Receive** / **Send** footer, and the signed-in **Menu** are absent; **Log out** sits under the card for this held-back session. The pin represents a valid stored session whose tab does not hold the recovery phrase; in a live browser, login opens the wallet and then reveals the page.

![21.gifts wallet balance locked](images/wallet-balance-locked.png)

### Variant: balance-locked-prf-unsupported

Pinned fixture (`?visual=balance-locked-prf-unsupported`, Playwright builds only), not a live wallet. The same in-place login card stays on `/wallet`, with the alert **This phone or browser cannot hold a 21.gifts wallet. Please use an up-to-date phone or browser that supports passkeys.** (`wallet.prfUnsupported`) above **Log in**. No wallet content is mounted. In live use this follows a wallet-opening passkey response without PRF output; the session is held back again.

![21.gifts wallet balance locked prf unsupported](images/wallet-balance-locked-prf-unsupported.png)

### Variant: balance-locked-error

Pinned fixture (`?visual=balance-locked-error`, Playwright builds only), not a live wallet. The same in-place login card stays on `/wallet`, with **Something went wrong. Please try again.** (`login.error`) above **Log in**. No wallet content is mounted. In live use another wallet-opening failure holds the session back again; cancelling the passkey prompt instead returns to the login card without an alert.

![21.gifts wallet balance locked error](images/wallet-balance-locked-error.png)

### Variant: balance-connecting

Pinned fixture (`?visual=balance-connecting`, Playwright builds only), not a live wallet. Region **Balance** shows the pending line **Opening your wallet…**.

![21.gifts wallet balance connecting](images/wallet-balance-connecting.png)

### Variant: balance-ready

Pinned fixture (`?visual=balance-ready`, Playwright builds only), not a live wallet. The home view: region **Balance** shows the ready fixture `₿21'000` as the large figure with the default fiat (`$21.00`) in small type under it; **Send** and **Receive** are both enabled at the bottom.

![21.gifts wallet balance ready](images/wallet-balance-ready.png)

### Variant: balance-ready-no-rate

The same ready fixture while no usable rate is loaded (the rate request failed): only the large `₿21'000`, no fiat line, and nothing to tap.

![21.gifts wallet balance ready no rate](images/wallet-balance-ready-no-rate.png)

### Variant: balance-fiat

The same ready fixture after a tap on the balance: `$21.00` is the large figure and `₿21'000` is in small type under it. Another tap swaps them back.

![21.gifts wallet balance fiat](images/wallet-balance-fiat.png)

### Variant: receive

The Receive view after **Receive** on the ready fixture: the label **Receive**, the Open CryptoPay QR, the address `ada@21.gifts`, **Copy**, and **Set an amount**. No balance and no **Send** / **Receive** buttons.

![21.gifts wallet receive](images/wallet-receive.png)

### Variant: receive-copied

The Receive view right after **Copy**: the button shows a check mark and **Copied**. After two seconds it says **Copy** again.

![21.gifts wallet receive copied](images/wallet-receive-copied.png)

### Variant: receive-no-username

The Receive view for an account without a username: no QR, no address, and no **Copy**; **Set a username first.** links to `/profile`, above **Set an amount**.

![21.gifts wallet receive no username](images/wallet-receive-no-username.png)

### Variant: receive-opening

The Receive view opened while the one-time wallet setup has not registered the address yet (pin `?visual=setup-pending`, then **Receive**; Playwright builds only): the label **Receive**, a spinner and **Opening your wallet…** where the QR, the address, and **Copy** go, and **Set an amount** under it. The address appears on its own once it is registered.

![21.gifts wallet receive while the wallet opens](images/wallet-receive-opening.png)

### Variant: receive-setup-failed

The Receive view after the background setup gave up (pin `?visual=balance-setup-failed`, then **Receive**; Playwright builds only): the label **Receive**, then **Your wallet could not be set up yet.** with a secondary **Try again** where the QR and address go, and **Set an amount** under it.

![21.gifts wallet receive after the setup gave up](images/wallet-receive-setup-failed.png)

### Variant: balance-error

Pinned fixture (`?visual=balance-error`, Playwright builds only), not a live wallet. Region **Balance** shows the open-failed sentence and labeled **Try again**.

![21.gifts wallet balance error](images/wallet-balance-error.png)

### Variant: setup-failed

Pinned fixture (`?visual=balance-setup-failed`, Playwright builds only), not a live wallet. The account still needs wallet verification after the background setup exhausted its quiet retries. Region **Balance** shows the alert **Your wallet could not be set up yet.** (`walletSetup.error`) followed by a secondary **Try again** button under it. The note does not cover or block the page; **Receive** and **Send** stay at the bottom, enabled.

![21.gifts wallet setup failed](images/wallet-setup-failed.png)

### Variant: setup-pending

Pinned fixture (`?visual=setup-pending`, Playwright builds only), not a live wallet. The background setup is still due: region **Balance** shows **Opening your wallet…**, and **Receive** and **Send** stay at the bottom, both enabled; a step that needs the open wallet waits for it inside the view. No dialog.

![21.gifts wallet setup pending](images/wallet-setup-pending.png)

### Variant: history-empty

Pinned fixture (`?visual=history-empty`, Playwright builds only). Ready balance, then the **Payments** card with **No payments yet.**, above **Send** and **Receive**.

![21.gifts wallet history empty](images/wallet-history-empty.png)

### Variant: history-rows

Pinned fixture (`?visual=history-rows`, Playwright builds only; ten synthetic payments that net to the ₿21'000 balance). **Payments** lists them newest first, each row a link with a chevron to its payment screen: **Gift on your post** `+₿2'100` with **Great photo!**, **Gift to @alice** `−₿5'000`, **Coffee & croissant** `+₿12'500`, **bob@example.com** `−₿10'000` with **Thanks for dinner**, **Received** `+₿21'000` with **Happy birthday!**, **Sticker pack #42** marked **Pending**, **Hardware wallet** struck through and marked **Failed**, **On-chain deposit**, **On-chain withdrawal**, and **Posting fee** `−₿1`. Each row shows its date and time and the default fiat. The shot is scrolled to the end of the list, so **Receive** and **Send** are slim (36 px); the other `/wallet` home shots, at the top, show them full size.
![21.gifts wallet history rows](images/wallet-history-rows.png)

### Variant: history-error

Pinned fixture (`?visual=history-error`, Playwright builds only). **Payments** shows **Your payments could not be loaded. Please try again.** and **Try again**.

![21.gifts wallet history error](images/wallet-history-error.png)

### Variant: send-input

Pinned fixture (`?visual=send-input`, Playwright builds only), not a live wallet, after **Send**. Region **Send Bitcoin** is the full-size live camera (a stubbed black stream, since the test browser has no camera) from the header row to the bottom of the page frame, with the white viewfinder square, **Point the camera at a Bitcoin QR code** in large type over the top of the picture, and the floating **Paste** and **Enter manually** buttons over its lower part. The send variants below are this Send view too: the amount and confirm steps after **Send**, the alerts, the Sent line, and the sending confirm step without it, because those keep the Send view on screen.

![21.gifts wallet send input](images/wallet-send-input.png)

### Variant: send-manual

The Send view after **Enter manually**: the sheet over the bottom of the camera area with the Close (`X`) top-left, `bob@example.com` typed into the **Payment request or address** field, and **Continue** enabled. The camera is off behind the sheet.

![21.gifts wallet send manual entry](images/wallet-send-manual.png)

### Variant: send-manual-alert

The manual-entry sheet with an alert (pin `?visual=send-invalid`, then **Enter manually**): **This is not a Bitcoin payment request or address.** in the danger colour under the field instead of over the camera; the other input alerts take the same place.

![21.gifts wallet send manual alert](images/wallet-send-manual-alert.png)

### Variant: send-manual-busy

The manual-entry sheet while the typed text is read (pin `?visual=send-input-busy`, then **Enter manually**, **bob@example.com** and **Continue**): the field and **Continue** wait, and **Continue** shows a spinner.

![21.gifts wallet send manual busy](images/wallet-send-manual-busy.png)

### Variant: send-paste-denied

The Send view after **Paste** when the browser refuses the clipboard: the small alert **Pasting was not allowed. Use Enter manually instead.** above the floating buttons, over the camera, which keeps running.

![21.gifts wallet send paste denied](images/wallet-send-paste-denied.png)

### Variant: send-paste-empty

The Send view after **Paste** with an empty clipboard: the small alert **The clipboard is empty.** above the floating buttons, over the camera, which keeps running.

![21.gifts wallet send paste empty](images/wallet-send-paste-empty.png)

### Variant: send-camera-denied

The Send view when the camera is blocked: **Camera access was blocked. Allow it in your browser settings, or paste the payment request.** in large white type on the black camera area, with **Paste** and **Enter manually** still floating at the bottom.

![21.gifts wallet send camera denied](images/wallet-send-camera-denied.png)

### Variant: send-camera-unavailable

The Send view on a device without a camera: **No camera found. Paste the payment request instead.** in large white type on the black camera area, with **Paste** and **Enter manually** still floating at the bottom.

![21.gifts wallet send camera unavailable](images/wallet-send-camera-unavailable.png)

### Variant: send-amount

Pinned fixture (`?visual=send-amount`, Playwright builds only). A receiver that asks for an amount: **To bob@example.com**, the amount field with the ₿ / fiat switch, **Between ₿1 · $0.00 and ₿1'000'000 · $1'000.00** (each bound with the default fiat), **Message (optional)**, **Continue**, and the step Close (`X`, **Cancel**).

![21.gifts wallet send amount](images/wallet-send-amount.png)

### Variant: send-amount-fiat

Same pinned amount step for a member whose amount unit is fiat: the switch is on **USD**, **2.10** is typed, and **₿2'100** shows under the field. The bounds line stays the same.

![21.gifts wallet send amount fiat](images/wallet-send-amount-fiat.png)

### Variant: send-confirm

Pinned fixture (`?visual=send-confirm`, Playwright builds only). The large **₿2'100** with **$2.10** under it, **To bob@example.com**, and **Fee ₿0** without fiat. At the bottom the large, full-width **Send** and the **Cancel** text button. No box and no Close.

![21.gifts wallet send confirm](images/wallet-send-confirm.png)

### Variant: send-sent

Pinned fixture (`?visual=send-sent`, Playwright builds only). The green check, the large **Sent ₿2'100** with **$2.10** under it, **To bob@example.com**, and the large, full-width **Done** at the bottom.

![21.gifts wallet send sent](images/wallet-send-sent.png)

### Variant: send-amount-onchain

Pinned fixture (`?visual=send-amount-onchain`, Playwright builds only). The amount step for a base-chain Bitcoin address: **To bc1qar0srr…wf5mdq**, the amount field with the ₿ / fiat switch, no bounds line and no message field, and **Continue**, in the box with Close (`X`).

![21.gifts wallet send amount onchain](images/wallet-send-amount-onchain.png)

### Variant: send-amount-onchain-min

Pinned fixture (`?visual=send-amount-onchain-min`, Playwright builds only). The same amount step after the wallet refused an amount below its minimum for this address: the alert **Enter an amount of at least ₿294 · $0.29.** under the field.

![21.gifts wallet send amount onchain min](images/wallet-send-amount-onchain-min.png)

### Variant: send-confirm-onchain

Pinned fixture (`?visual=send-confirm-onchain`, Playwright builds only). The large **₿50'000** with **$50.00** under it and **To bc1qar0srr…wf5mdq**. Under it **Fee ₿1'420 · $1.42** and **Total ₿51'420 · $51.42** in larger type, then the **Speed** rows **Fast** (₿2'840 · $2.84), **Medium** (₿1'420 · $1.42, pressed) and **Slow** (₿710 · $0.71), and the muted line that the network fee is much higher than the fee of other payments. At the bottom the large, full-width **Send** and the **Cancel** text button.

![21.gifts wallet send confirm onchain](images/wallet-send-confirm-onchain.png)

### Variant: send-confirm-onchain-fast

Pinned fixture (`?visual=send-confirm-onchain-fast`, Playwright builds only). The same confirm step after pressing **Fast**: that row is pressed, and **Fee ₿2'840 · $2.84** and **Total ₿52'840 · $52.84**.

![21.gifts wallet send confirm onchain fast](images/wallet-send-confirm-onchain-fast.png)

### Variant: send-confirm-onchain-slow

Pinned fixture (`?visual=send-confirm-onchain-slow`, Playwright builds only). The same confirm step after pressing **Slow**: that row is pressed, and **Fee ₿710 · $0.71** and **Total ₿50'710 · $50.71**.

![21.gifts wallet send confirm onchain slow](images/wallet-send-confirm-onchain-slow.png)

### Variant: send-confirm-onchain-low

Pinned fixture (`?visual=send-confirm-onchain-low`, Playwright builds only). The confirm step when the balance covers at most a ₿2'000 fee: **Fast** is disabled and says **Balance too low**; **Medium** stays pressed.

![21.gifts wallet send confirm onchain low](images/wallet-send-confirm-onchain-low.png)

### Variant: send-confirm-onchain-renewed

Pinned fixture (`?visual=send-confirm-onchain-renewed`, Playwright builds only). The confirm step after **Send** found the fee offer expired: nothing was sent, the wallet asked for a new fee, and the alert **The fee offer expired, so nothing was sent. Check the new fee and press Send again.** stands above the **Speed** rows.

![21.gifts wallet send confirm onchain renewed](images/wallet-send-confirm-onchain-renewed.png)

### Variant: send-confirm-onchain-renewing

Pinned fixture (`?visual=send-confirm-onchain-renewing`, Playwright builds only). The confirm step after **Send** found the fee offer expired, while the wallet asks for a new one: nothing was sent, the speed rows and **Send** (with its spinner) are disabled, and **Cancel** stays usable.

![21.gifts wallet send confirm onchain renewing](images/wallet-send-confirm-onchain-renewing.png)

### Variant: send-confirm-onchain-sending

Pinned fixture (`?visual=send-confirm-onchain-sending`, Playwright builds only). The confirm step after **Send**: the speed rows, **Send** with its spinner, and **Cancel** are disabled until the wallet answers.

![21.gifts wallet send confirm onchain sending](images/wallet-send-confirm-onchain-sending.png)

### Variant: send-error

Pinned fixture (`?visual=send-error`, Playwright builds only). After a receiver whose server this browser cannot reach: the plain alert **The receiver could not be reached from this browser. Please try again later.** over the black camera area, with **Try again** under it.

![21.gifts wallet send error](images/wallet-send-error.png)

### Variant: send-unsupported

Pinned fixture (`?visual=send-unsupported`, Playwright builds only). After a payment request the wallet recognises but cannot pay (for example a token invoice): the alert **This payment request cannot be paid from your wallet yet.** over the black camera area, with **Try again** under it.

![21.gifts wallet send unsupported](images/wallet-send-unsupported.png)

### Variant: send-invalid

Pinned fixture (`?visual=send-invalid`, Playwright builds only). After text that is not a payment request or address: the alert **This is not a Bitcoin payment request or address.** over the black camera area, with **Try again** under it.

![21.gifts wallet send invalid](images/wallet-send-invalid.png)

### Variant: send-failed

Pinned fixture (`?visual=send-failed`, Playwright builds only). After a prepare or send that failed or timed out: the alert **The payment could not be sent. Check your balance before you try again.** over the black camera area, with **Try again** under it.

![21.gifts wallet send failed](images/wallet-send-failed.png)

### Variant: send-insufficient

Pinned fixture (`?visual=send-insufficient`, Playwright builds only). After a payment the balance does not cover: the alert **Your wallet does not have enough Bitcoin for this payment.** over the black camera area, with **Try again** under it.

![21.gifts wallet send insufficient](images/wallet-send-insufficient.png)

### Variant: send-amount-error

Pinned fixture (`?visual=send-amount-error`, Playwright builds only). The amount step for a Lightning address after **Continue** with an amount outside the receiver's bounds: the alert **Enter an amount between ₿1 · $0.00 and ₿1'000'000 · $1'000.00.**

![21.gifts wallet send amount error](images/wallet-send-amount-error.png)

### Variant: send-amount-request

Pinned fixture (`?visual=send-amount-request`, Playwright builds only). The amount step for an address without an amount and without receiver bounds: **To sp1qexample…a9f2**, the amount field and **Continue**; no bounds line and no message field.

![21.gifts wallet send amount request](images/wallet-send-amount-request.png)

### Variant: send-amount-no-comment

Pinned fixture (`?visual=send-amount-no-comment`, Playwright builds only). The amount step for a Lightning address whose receiver takes no comment: **To bob@example.com**, the amount field, the bounds line, and **Continue**; no message field.

![21.gifts wallet send amount no comment](images/wallet-send-amount-no-comment.png)

### Variant: send-amount-min

Pinned fixture (`?visual=send-amount-min`, Playwright builds only). The same amount step after **Continue** with no usable amount: the alert **Enter an amount of at least ₿1 · $0.00.**

![21.gifts wallet send amount min](images/wallet-send-amount-min.png)

### Variant: send-confirm-sending

Pinned fixture (`?visual=send-confirm-sending`, Playwright builds only). The confirm step while the send runs: the large **Send** is disabled with a spinner, and **Cancel** is disabled; Back keeps this step.

![21.gifts wallet send confirm sending](images/wallet-send-confirm-sending.png)

### Variant: send-confirm-fixed

Pinned fixture (`?visual=send-confirm-fixed`, Playwright builds only). The confirm step reached straight from a shop's point-of-sale QR while a charge is open: the large **₿7'000** with **$7.00** under it, **To shop@21.gifts** (read from the QR's `/pl/?lightning=` link), and **Fee ₿3** with the default fiat; at the bottom the large **Send** and **Cancel**. This is the Lightning payment of that charge, used when the api issues no Spark invoice for it; the fee is the Lightning fee. No amount field and no message; **Cancel** returns to the input step.

![21.gifts wallet send confirm fixed amount](images/wallet-send-confirm-fixed.png)

### Variant: send-confirm-shop

Pinned fixture (`?visual=send-confirm-shop`, Playwright builds only). The confirm step of the same point-of-sale QR when the api issued a Spark invoice for the open charge: the large **₿7'000** with **$7.00** under it, **To shop@21.gifts**, and **Fee ₿0** without fiat; at the bottom the large **Send** and **Cancel**. The in-app wallet pays the shop's charge without a fee. No amount field and no message; **Cancel** returns to the input step.

![21.gifts wallet send confirm shop charge](images/wallet-send-confirm-shop.png)

### Variant: send-confirm-member

Pinned fixture (`?visual=send-confirm-member`, Playwright builds only). The confirm step after **Continue** for a 21.gifts member on this host without an open charge, when the api issued a Spark invoice for the amount entered: the large **₿2'100** with **$2.10** under it, **To alice@21.gifts**, and **Fee ₿0** without fiat; at the bottom the large **Send** and **Cancel**. The in-app wallet pays the member without a fee. **Cancel** returns to the input step.

![21.gifts wallet send confirm member](images/wallet-send-confirm-member.png)

### Variant: send-input-busy

Pinned fixture (`?visual=send-input-busy`, Playwright builds only). The input step while the pasted text is read: `bob@example.com` in the disabled **Payment request or address** field and **Continue** disabled with a spinner.

![21.gifts wallet send input busy](images/wallet-send-input-busy.png)

### Variant: send-amount-busy

Pinned fixture (`?visual=send-amount-busy`, Playwright builds only). The amount step while the payment is prepared: **To bob@example.com**, `2100` in the disabled amount field with $2.10 under it, and **Continue** disabled with a spinner.

![21.gifts wallet send amount busy](images/wallet-send-amount-busy.png)

### Variant: send-not-payable

Pinned fixture (`?visual=send-not-payable`, Playwright builds only). After a Lightning address or LNURL on another host that the api does not read as payable (malformed, not https, not a pay request, or on this app's own host): the alert **This address cannot receive a payment.** over the black camera area, with **Try again** under it.

![21.gifts wallet send not payable](images/wallet-send-not-payable.png)

### Variant: send-not-found

Pinned fixture (`?visual=send-not-found`, Playwright builds only). After a Lightning address on another host whose server does not know it: the alert **This address was not found.** over the black camera area, with **Try again** under it.

![21.gifts wallet send not found](images/wallet-send-not-found.png)

### Variant: send-relay-unreachable

Pinned fixture (`?visual=send-relay-unreachable`, Playwright builds only). After a Lightning address or LNURL on another host whose server did not answer the api: the alert **The receiver's server did not answer. Please try again later.** over the black camera area, with **Try again** under it. `send-error` is the same slot when this browser could not reach the receiver itself.

![21.gifts wallet send relay unreachable](images/wallet-send-relay-unreachable.png)

### Variant: send-unreadable

Pinned fixture (`?visual=send-unreadable`, Playwright builds only). After reading the text ended in an unexpected error: the alert **This could not be read. Please try again.** over the black camera area, with **Try again** under it.

![21.gifts wallet send unreadable](images/wallet-send-unreadable.png)

### Variant: send-unavailable

Pinned fixture (`?visual=send-unavailable`, Playwright builds only). A step needed the wallet for an account that has no wallet it can use here: the alert **Your 21.gifts wallet is not available here, so this cannot be paid.** over the black camera area, with **Try again** under it.

![21.gifts wallet send unavailable](images/wallet-send-unavailable.png)

### Variant: send-input-opening

Pinned fixture (`?visual=send-input-opening`, Playwright builds only). A scanned, pasted, or typed text that the wallet itself has to read, while the wallet still opens: the camera is off, a white spinner turns in the middle of the black camera area with **Opening your wallet…** under it, and **Paste** and **Enter manually** wait. The text is kept and read on its own once the wallet is open.

![21.gifts wallet send input while the wallet opens](images/wallet-send-input-opening.png)

### Variant: send-input-wallet-error

Pinned fixture (`?visual=send-input-wallet-error`, Playwright builds only). The same waiting text after the wallet could not be opened: **Your wallet could not be opened. Please try again.** over the black camera area, with **Try again** under it, which opens the wallet again and keeps the text.

![21.gifts wallet send input after the wallet could not be opened](images/wallet-send-input-wallet-error.png)

### Variant: send-confirm-opening

Pinned fixture (`?visual=send-confirm-opening`, Playwright builds only). The confirm step before its fee is known, while the wallet still opens: the large **₿2'100** with **$2.10** under it, **To bob@example.com**, then a spinner and **Opening your wallet…** where the fee goes; at the bottom **Send** is disabled and **Cancel** works. The fee and an enabled **Send** follow on their own once the wallet is open.

![21.gifts wallet send confirm while the wallet opens](images/wallet-send-confirm-opening.png)

### Variant: send-confirm-wallet-error

Pinned fixture (`?visual=send-confirm-wallet-error`, Playwright builds only). The same confirm step after the wallet could not be opened: the large amount, **To bob@example.com**, then **Your wallet could not be opened. Please try again.** with a secondary **Try again** where the fee goes; **Send** stays disabled and **Cancel** works.

![21.gifts wallet send confirm after the wallet could not be opened](images/wallet-send-confirm-wallet-error.png)

### Variant: send-comment-long

Pinned fixture (`?visual=send-comment-long`, Playwright builds only). The amount step for a Lightning address on another host (**To bob@example.com**, its bounds, **Message (optional)**) after the receiver refused the message as too long: the alert **This message is too long for the receiver.** above **Continue**.

![21.gifts wallet send comment long](images/wallet-send-comment-long.png)

## Screen: /wallet/payment

- **URL:** `/wallet/payment?id=<payment id>` — one payment of the signed-in member's wallet, opened from a row of the **Payments** list on `/wallet`.
- **What the user sees:** The same frame as `/wallet`: one top-left arrow (the previous in-app view, the list when opened from it, or `/welcome` when this tab has none) and the wordmark, **Menu** top-right. The heading **Payment** is for screen readers only. At the top, centred: a round badge with the direction arrow, the title (a gift on your post, the paid Lightning address, the description, the on-chain direction, or Received / Sent), the amount large with **+** or **−** (a failed payment struck through and muted), the default fiat under it, and a status pill: **Completed** in green, **Pending** in the notice colour, **Failed** in red. A pending send adds **Still on its way. The amount stays reserved until it arrives or comes back.**; a failed send adds **Nothing left your wallet.** A message that came with the payment (the payer's note, the zap message, or the comment sent to a Lightning address) follows in a soft box. A bordered list shows **Date**, **Type**, **To** (the paid Lightning address), **Description** (only when it is not already the title), **Amount**, **Fee** (**Free** at ₿0; left out for a fee-less receive and for a failed payment), **Total** (a send with a fee), and **Arrived on-chain** (a deposit whose claim fee was deducted); each Bitcoin figure there also shows the default fiat. Under **Details**, the technical values are shortened in the middle, each with a Copy icon: **Transaction** and **Output**, **Payment request**, **Payment hash**, **Proof of payment**, and **Payment ID**. An on-chain payment adds **View on mempool.space**, which first asks **Open external link?**. Nothing shows while the payment or the rate is still loading; when the rate read finds no usable rate, the Bitcoin amounts show without a fiat line. The screen reads the payment again after each wallet sync, so a pending payment updates in place. A missing or unknown id shows **This payment could not be found.**
- **Actions:** Copy a technical value; open the transaction on mempool.space after the warning; go back to the previous in-app view (the list when opened from it) with the top-left arrow; open **Menu** (see **Signed-in header**).
- **Calls:** `AppShell`, `WalletChromeLeft`, `SignedInChrome`, `OnboardingGate`, `WalletPaymentDetails`, `useWalletPayment`, `getWalletPayment`, `paymentTitle`, `paymentMessage`, `ExternalLinkWarning`, `openInSystemBrowser`, `useSpotRateState`.

### Variant: default

Pinned fixture (`?visual=history-rows` with the zap's id, Playwright builds only). A received zap: **Gift on your post**, **+₿2'100** with **$2.10**, **Completed**, the message **Great photo!**, **Type** Instant payment, **Amount**, no fee row, and under **Details** the payment request, payment hash, proof of payment, and the payment id.

![21.gifts wallet payment zap](images/wallet-payment.png)

### Variant: address-send

A payment to the Lightning address **bob@example.com** with the comment **Thanks for dinner**: **−₿10'000**, **To** bob@example.com, **Fee** ₿3, **Total** ₿10'003 (each with fiat).

![21.gifts wallet payment Lightning-address send](images/wallet-payment-address-send.png)

### Variant: spark-send

A wallet transfer of **₿5'000** with the description **Gift to @alice**: **Type** Wallet transfer, **Fee** Free, and no **Total** row.

![21.gifts wallet payment wallet transfer](images/wallet-payment-spark-send.png)

### Variant: pending

A Lightning send still in flight (**Sticker pack #42**): the **Pending** pill with **Still on its way. The amount stays reserved until it arrives or comes back.**, its fee and total, and no proof of payment yet.

![21.gifts wallet payment pending](images/wallet-payment-pending.png)

### Variant: failed

A failed Lightning send (**Hardware wallet**): the amount struck through, the **Failed** pill with **Nothing left your wallet.**, and no fee or total.

![21.gifts wallet payment failed](images/wallet-payment-failed.png)

### Variant: deposit

An on-chain deposit: **On-chain deposit**, **Fee** ₿254, **Arrived on-chain** ₿44'000, the **Transaction** and **Output** among the details, and **View on mempool.space**.

![21.gifts wallet payment deposit](images/wallet-payment-deposit.png)

### Variant: withdraw

An on-chain withdrawal: **On-chain withdrawal**, **−₿40'000**, **Fee** ₿1'840, **Total** ₿41'840, the **Transaction**, and **View on mempool.space**.

![21.gifts wallet payment withdrawal](images/wallet-payment-withdraw.png)

### Variant: missing

An id the wallet does not know: only **This payment could not be found.**

![21.gifts wallet payment not found](images/wallet-payment-missing.png)

### Variant: load-error

The wallet is open but reading the payment failed (Playwright pin `?visual=history-error`): **This payment could not be loaded. Please try again.** in the danger colour, and **Try again**.

![21.gifts wallet payment load error](images/wallet-payment-load-error.png)

### Variant: copied

The deposit after **Copy** on **Payment ID**: that row's icon turns into a green check for two seconds (and a screen reader hears **Copied**).

![21.gifts wallet payment copied](images/wallet-payment-copied.png)

### Variant: external-link

The deposit after **View on mempool.space**: the **Open external link?** dialog over the screen, with **Open link** and **Close**; only **Open link** leaves 21.gifts.

![21.gifts wallet payment external link](images/wallet-payment-external-link.png)

### Variant: loading

The screen while the rate is still on its way (the payment itself is known): only the frame and the top-left arrow, no amount yet. Once the read has finished without a usable rate, the ₿ figures show without their fiat line.

![21.gifts wallet payment loading](images/wallet-payment-loading.png)

### Variant: locked

Opened directly (a reload or a new tab) without the wallet phrase in this tab (pin `?visual=balance-locked`, Playwright builds only): the ordinary login card appears in place of the payment, with **Log in**. Once login opens the wallet, the payment loads.

![21.gifts wallet payment locked](images/wallet-payment-locked.png)

### Variant: connecting

The same while the wallet is opening (pin `?visual=balance-connecting`): the spinner and **Opening your wallet…**.

![21.gifts wallet payment connecting](images/wallet-payment-connecting.png)

### Variant: error

The same when the wallet could not be opened (pin `?visual=balance-error`): **Your wallet could not be opened. Please try again.** and **Try again**.

![21.gifts wallet payment error](images/wallet-payment-error.png)

### Variant: prf-unsupported

The same on a phone or browser that cannot hold the wallet (pin `?visual=balance-locked-prf-unsupported`): the ordinary login card stays in place of the payment, with the no-PRF alert above **Log in**.

![21.gifts wallet payment no PRF](images/wallet-payment-prf-unsupported.png)

### Variant: locked-error

The same when opening the wallet failed for another reason (pin `?visual=balance-locked-error`): the login card stays in place of the payment, with **Something went wrong. Please try again.** (`login.error`) above **Log in**.

![21.gifts wallet payment login error](images/wallet-payment-locked-error.png)

### Variant: setup-failed

The same when the background wallet setup gave up (pin `?visual=balance-setup-failed`): the balance shows **Your wallet could not be set up yet.** (`walletSetup.error`) with a secondary **Try again** under it.

![21.gifts wallet payment setup failed](images/wallet-payment-setup-failed.png)

## Screen: /wallet/phrase

- **URL:** `/wallet/phrase` — recovery phrase only. No receive QR.
- **What the user sees:** The usual signed-in header (see **Signed-in header**): profile chrome left and **Menu** right. Heading **Wallet**. No address, no QR, and no **Set an amount**. Missing or empty `passkeyCredentialId`: the hint and **Add recovery phrase**, which runs the ceremony on this page. Set id and no words yet: **Show recovery phrase** shows the words of the open wallet from tab memory without a passkey prompt. A wallet-backed account whose wallet is not open in this tab sees the login card (`WalletLoginCard`) in place of the screen. Only where the login gate does not apply (a build without the wallet) and the phrase is not in tab memory does it run PRF get of that id, without `credentials.create` and without seed/begin, and that one prompt also keeps the phrase in tab memory. The 12 words and the only-backup line replace that button. There is no confirmation and no **Continue**. An error is `role="alert"` plus a reason, a hint, and **Try again**.
- **Actions:** **Add recovery phrase** calls seed/begin and seed/finish and does not replace the login passkey. `walletBackupSeenAt` is not read and not posted. **Show recovery phrase** is the only way to see an existing phrase, reached from **Recovery phrase** on `/settings`. **Try again** clears the error. Back hides the 12 words and keeps the wallet open, then the top-left arrow returns to the previous in-app view in this tab, or `/welcome` when this tab has none, without a page load. One arrow. The wordmark is not that control.
- **Calls:** `AppShell`, `WalletScreenView` `surface="phrase"`, `WalletPhraseScreen`, `WalletPhrasePage`, `useWalletPhrase`, `OnboardingGate`.

### Variant: default

No phrase yet. **Add recovery phrase** on its own page. No receive QR.

![21.gifts wallet phrase add](images/wallet-phrase-add.png)

### Variant: reveal

The passkey can already show a phrase. **Show recovery phrase** is the only control. No receive QR.

![21.gifts wallet phrase reveal](images/wallet-phrase-reveal.png)

### Variant: phrase

Pinned fixture (`?visual=phrase`, Playwright builds only): 12-word grid from a fixture mnemonic (not live PRF). A production build ignores the pin and never shows these words. No receive QR.

![21.gifts wallet phrase](images/wallet-phrase.png)

### Variant: error

Pinned fixture (`?visual=error`, Playwright builds only). Generic failure. Alert **The recovery phrase could not be created or opened. Check this device and try again.** plus hint **If this keeps happening, try another browser or the device you already used to sign in.** and labeled **Try again**. No receive QR.

![21.gifts wallet error](images/wallet-error.png)

### Variant: timeout

Pinned fixture (`?visual=timeout`, Playwright builds only). Device prompt timed out. Alert **The device prompt timed out before you finished. Try again.** plus the same muted hint and labeled **Try again**. No receive QR.

![21.gifts wallet timeout](images/wallet-timeout.png)

### Variant: prf-unsupported

Pinned fixture (`?visual=prf-unsupported`, Playwright builds only). The passkey gave no PRF output while adding or showing the phrase. Alert **This phone or browser cannot hold a 21.gifts wallet. Please use an up-to-date phone or browser that supports passkeys.** (`wallet.prfUnsupported`) plus hint **If this keeps happening, try another browser or the device you already used to sign in.** and labeled **Try again**. No receive QR.

![21.gifts wallet prf unsupported](images/wallet-prf-unsupported.png)

## Screen: /settings

- **URL:** `/settings` — signed-in settings, opened from **Settings** in the Menu. Requires a name, a username, and the living-room rules agreement, like `/profile`.
- **What the user sees:** Fill `AppShell` with profile chrome left and **Menu** right. Open **Menu** (see **Signed-in header**) for **Home**, **Balance** (`/wallet`), **Shops**, **Point of sale**, Profile, **Grants**, **Settings**, **Living room rules**, **Trust Chain**, **Statistics**, **Notifications**, **Messages**, **Contact**, optional **Install app**, and **Log out**. Heading **Settings**, then a **Wallet** section. When the account has a recovery passkey (`passkeyCredentialId` set), the section holds one button, **Recovery phrase**. When `passkeyCredentialId` is missing or empty, it shows the hint that the phrase is created on this device and the existing login passkey stays, followed by **Add recovery phrase**.
- **Actions:** **Recovery phrase** and **Add recovery phrase** open `/wallet/phrase` without a page load; the words and the passkey ceremony happen there, not on this page. The top-left arrow on `/wallet/phrase` then returns here. The top-left arrow on `/settings` returns to the previous in-app view in this tab, or `/welcome` when this tab has none. One arrow. The wordmark is not that control.
- **Calls:** `AppShell`, `SettingsPage`, `SettingsScreen`, `OnboardingGate`, `ProfileChromeLeft`, `SignedInChrome`.

### Variant: default

Account with a recovery passkey. The **Wallet** section shows **Recovery phrase**.

![21.gifts settings](images/settings.png)

### Variant: activate

Existing member without a recovery phrase yet. The **Wallet** section shows the add hint and **Add recovery phrase**.

![21.gifts settings add recovery phrase](images/settings-activate.png)

### Variant: menu-header-account-loading

**Menu** opened right after the page loads, while the stored session is still being checked: the account header already has its final size, with a grey skeleton circle in place of the photo, two skeleton bars for the name and `@username`, and skeleton bars under **Received**, **Given**, and **Posts**. **Home** and every row below sit where they stay once the account and the numbers arrive, so nothing moves.

![21.gifts settings menu with the account header loading](images/settings-menu-header-account-loading.png)

## Screen: /login

- **URL:** `/login` — login only.
- **What the user sees:** Chrome is the page-frame header (`ProfileChromeLeft` with `HomeWordmark` and the light language switcher inside the rounded sheet; the arrow returns to the previous in-app view, or `/welcome` when this tab has none; wordmark `/` when unsigned, `/welcome` when a session is hydrated — not the marketing header). Idle **Log in**, then the muted line **New to 21.gifts?** and **Open a new account**, which opens the name form straight away without a passkey prompt. After **Log in**, if the browser reports `NotAllowedError`, heading **Do you already have an account?** with **Log in with existing account** and **Open a new account**. **Open a new account** opens the name form. No passkey and no account until a valid name is submitted and the create ceremony is finished. In Telegram or another in-app browser, an escape card (**Open this page in your browser**) with **Open in browser** and **Copy link** instead of **Log in** and **Open a new account**. Generic error is **Something went wrong. Please try again.** A new account whose passkey gives no PRF output says **This phone or browser cannot hold a 21.gifts wallet. Please use an up-to-date phone or browser that supports passkeys.** instead, and no account is created. A leftover session whose GET `/me` is the wrong-account 403 shows **You signed in with the wrong account. Please try again with the correct account.** Both errors are terminal until **Try again**. On idle, choice, unknown, error, and wrong-account, when the phone reports iOS below 18, the card shows a muted line with the installed version and that sign-in needs at least iOS 18. A new account that cannot finish uses that sentence as the alert and does not create an account. When the phone reports Android below 9, those same five variants show a muted line with the installed version and that sign-in needs at least Android 9, and a new account that cannot finish uses that sentence as the alert and does not create an account. Desktop pictures of those five variants omit the muted line. Phone pictures of those five include it, because those baselines use an iPhone user agent below iOS 18. Those phone pictures are the iPhone baselines, not Android, and the Android alert is variant android-version. The name, name-invalid, and name-taken pictures do not show that muted line. After success the visitor goes to `/setup/name`, `/setup/username`, `/setup/rules`, or `/welcome`. The recovery phrase is not part of that path.
- **Actions:** Change language. Log in with an existing passkey. Open a new account from the idle card. After `NotAllowedError`, choose an existing account or open a new one. In an in-app browser: open the page in the system browser or copy the link. After **Log in** the screen stays on `/login` until the wallet is open, then moves on as before; meanwhile, and while a stored session is held back, `OnboardingGate` shows `WalletLoginCard` (the same card, with any no-PRF or error alert, and **Log out** for a held-back session).
- **Calls:** `AppShell`, `ProfileChromeLeft`, `HomeWordmark`, `LoginCard`, `OnboardingGate`, `usePasskeyLogin`, `useAuthStore`, `LanguageSwitcher`, `isInAppBrowser`, `iosPasskeyBlock`, `androidPasskeyBlock`, `openInSystemBrowser`.

### Variant: idle

Logged out. Heading **Log in with your device**, primary **Log in**, the muted line **New to 21.gifts?** (`login.newHere`), and secondary **Open a new account** (`login.create`). **Open a new account** opens the name form (variant name) without a passkey prompt; no passkey and no account exist until a valid name is submitted and the create ceremony is finished. On iOS below 18 a muted line under the heading names the installed version and the iOS 18 minimum. Desktop pictures omit that line. Phone pictures include it. Android below 9 shows the same kind of muted line in the product, while these pictures stay the iPhone baselines.

![21.gifts login idle](images/login.png)

### Variant: starting

Transient after a login click, before the ceremony finishes: spinner and **Preparing your login…**.

![21.gifts login starting](images/login-starting.png)

### Variant: error

Login begin or finish failed. Copy **Something went wrong. Please try again.** (`login.error`) and **Try again**. Phone pictures also show the muted installed-iOS line. An old-iOS register that cannot finish is variant ios-version, not this picture. No account is created there.

![21.gifts login error](images/login-error.png)

### Variant: prf-unsupported

**Open a new account** on a phone or browser whose new passkey gives no PRF output. The account is not created. Alert **This phone or browser cannot hold a 21.gifts wallet. Please use an up-to-date phone or browser that supports passkeys.** (`wallet.prfUnsupported`) instead of the generic error, then **Try again**. A dismissed prompt or a failed request keeps its own state and copy. On iOS below 18 the old-iOS sentence (variant ios-version) takes precedence, so the phone pictures of this variant use an iPhone on iOS 18.

![21.gifts login prf unsupported](images/login-prf-unsupported.png)

### Variant: ios-version

**Open a new account** opens the name form even on iOS below 18. After a valid name is submitted and the create ceremony is dismissed, the alert is exactly **iOS 17.5.1 is installed. Sign-in needs at least iOS 18.** Button **Try again**. The muted status line is then not also shown. No account is created.

![21.gifts login ios version](images/login-ios-version.png)

### Variant: android-version

**Open a new account** opens the name form even on Android below 9. After a valid name is submitted and the create ceremony is dismissed, the alert is exactly **Android 8.1.0 is installed. Sign-in needs at least Android 9.** Button **Try again**. The muted status line is then not also shown. No account is created.

![21.gifts login android version](images/login-android-version.png)

### Variant: wrong-account

GET `/me` 403 with the api wrong-account copy, or passkey finish with that same string. Alert **You signed in with the wrong account. Please try again with the correct account.** (`login.wrongAccount`) and **Try again**. Phone pictures also show the muted installed-iOS line. The leftover session is cleared so the visitor is not left signed in. **Try again** starts authenticate-first login.

![21.gifts login wrong-account](images/login-wrong-account.png)

### Variant: unknown

Passkey authenticate finish 400 `{ "error": "Unknown credential" }`. Heading **This passkey is not an account** (`login.unknownHeading`), muted sentence **This phone offered a passkey that 21.gifts does not recognize. Open a new account. If the phone offers that same passkey again, delete the saved 21.gifts passkey in your password settings, then try again.** (`login.unknownBody`), primary **Open a new account** and secondary **Try again**. **Open a new account** opens the name form. It does not start create immediately. Phone pictures also show the installed-iOS line. **Try again** starts authenticate-first login and does not create an account. Dismissing the create ceremony returns to the name form, not to this card. Dismissing the Try again login prompt stays on this card and does not open the account-choice card.

![21.gifts login unknown](images/login-unknown.png)

### Variant: choice

After **Log in**, the browser reports `NotAllowedError` (no discoverable passkey, or the visitor dismissed the picker). Heading **Do you already have an account?** with labeled **Log in with existing account** and **Open a new account**. Creating an account starts only after the name form, not on the choice click. **Open a new account** opens the name form. Phone pictures also show the muted installed-iOS line. On iOS below 18 the name form still opens, and submitting a valid name does not complete create; the card then shows the version sentence as the alert.

![21.gifts login choice](images/login-choice.png)

### Variant: name

Heading **Choose your name**. This name is saved in the passkey. It is also your account name and your 21.gifts username. Use 1–32 characters: letters, digits, hyphen, underscore, or dot. It is stored in lowercase. Label **Name**, Button **Continue**. The muted iOS or Android line is not shown.

![21.gifts login name](images/login-name.png)

### Variant: name-invalid

Pressing Continue with an empty name, or a name that after trim and lowercase does not match `/^[a-z0-9][a-z0-9._-]{0,31}$/` (a lone underscore and a leading dot are rejected), stays on this form. Alert: Use 1–32 characters: a-z, 0-9, hyphen, underscore, or dot. (`login.nameInvalid`). The passkey dialog does not open. The muted iOS or Android line is not shown.

![21.gifts login name invalid](images/login-name-invalid.png)

### Variant: name-taken

A valid name whose username is already in use stays on this form. Alert: That username is already in use. (`login.nameTaken`). When registration begin reports that, the passkey dialog does not open. When registration finish reports the same text after the dialog, this form shows the same alert. The muted iOS or Android line is not shown.

![21.gifts login name taken](images/login-name-taken.png)

### Variant: in-app

Telegram or another in-app WebView detected. Heading **Open this page in your browser**; no **Log in** or **Open a new account** button; **Open in browser** and **Copy link** instead.

![21.gifts login in-app](images/login-in-app.png)

### Variant: language-open

Open the light language switcher top-right. Custom listbox with endonym rows (English / Deutsch / Español / Filipino) — not a native OS select.

![21.gifts login language](images/login-language.png)

## Screen: /donate

- **URL:** `/donate` — public, no auth gate.
- **What the user sees:** Chrome is the page-frame header (`ProfileChromeLeft` with `HomeWordmark` and the light language switcher inside the rounded sheet; the arrow returns to the previous in-app view, or `/welcome` when this tab has none; wordmark `/` when unsigned, `/welcome` when a session is hydrated — not marketing header). Heading **Send help**, short lead about opening **Show reactions** then sending Bitcoin on a payable reaction, CTA **Open the forum** (`/welcome`). No address/amount form. No QR.
- **Actions:** Change language. Open the forum. Unsigned visitors hitting `/welcome` are sent to `/login` by OnboardingGate.
- **Calls:** `AppShell`, `ProfileChromeLeft`, `HomeWordmark`, `DonatePage`, `ButtonLink`, `LanguageSwitcher`.

### Variant: default

Heading **Send help**, explainer lead, **Open the forum**.

![21.gifts donate](images/donate.png)

## Screen: /pl

- **URL:** `/pl?lightning=LNURL…` — public, no auth gate. `/pl` without a usable link stays on this page and does not 404.
- **What the user sees:** Chrome is the page-frame header (`ProfileChromeLeft` with `HomeWordmark` and the light language switcher inside the rounded sheet; the arrow returns to the previous in-app view, or `/welcome` when this tab has none). The shop sticker's storefront sits above the person's name, which is the only heading. With no open payment, under it an **Amount** field and **Continue**. The field has the ₿ / fiat switch, and the other unit sits under it. With no account the switch starts at ₿ and is not stored. There is no **Pay** and no invoice QR. When a payment is active, either because `GET /pay/:username` returned an unexpired `charge` or because **Continue** minted an invoice, that amount field and **Continue** are gone. The page shows the same active payment: five minutes left, the sat amount, the viewer's default fiat beside it, and **Pay**. **Pay** is the width of the invoice QR plate (232px plus its padding and border), centered, not the width of the page. **Pay** hands the invoice to the visitor's own Bitcoin wallet app with a generic `lightning:` link; no particular wallet is named. The fiat code is the profile cookie when set, otherwise the language default. Desktop shows the Bitcoin invoice QR only while that payment is active. A smartphone (`isSmartphoneUserAgent`, not viewport) never shows it. A bad link shows the gift glyph and **This payment link is not valid.** and no form.
- **Actions:** With no open payment, type a whole number and press **Continue** (`forum.payContinue`). An empty or non-whole amount shows **Enter a whole number.** and keeps the form. Success leaves that form and shows the active payment: the locked sat amount, the viewer's default fiat beside it, and **Pay** (`forum.payOpenWallet`, aria **Pay with a Bitcoin wallet app**), which sets `location.href` to `lightning:` plus the invoice (`lightningHref`), so the device opens whichever Bitcoin wallet app handles that link. An open till mints that exact amount with no amount step. Desktop shows the Bitcoin invoice QR. A smartphone does not. A failed mint on an open till keeps the charge and shows **Could not create the invoice.**; **Pay** tries the mint again. A failed **Continue** keeps the amount form and shows the same sentence. Change language from the header.
- **Calls:** `PayLinkPage`, `PayLinkScreen`, `PageChrome`, `ProfileChromeLeft`, `HomeWordmark`, `LanguageSwitcher`, `payLinkUsername`, `GET /pay/[username]`, `POST /pay/[username]/invoice`.

### Variant: default

Scanned pay link with no open payment (`charge` null or absent). The shop sticker, the person's name, the amount field, and **Continue**. No countdown, no **Pay**, and no invoice QR.

![21.gifts pay link](images/pl.png)

### Variant: invoice

After **Continue**, the same active payment as an open till: the shop sticker, five minutes left, the locked sat amount, the viewer's default fiat beside it, and **Pay**. No amount field. Desktop shows the Bitcoin invoice QR. A smartphone shows the countdown and **Pay**, not the QR.

![21.gifts pay link invoice](images/pl-invoice.png)

### Variant: amount-invalid

**Continue** with an empty or non-whole amount shows **Enter a whole number.** The form stays. No **Pay**.

![21.gifts pay link amount invalid](images/pl-amount-invalid.png)

### Variant: invalid

The gift glyph and **This payment link is not valid.** No amount field.

![21.gifts pay link invalid](images/pl-invalid.png)

### Variant: failed

The form stays, and **Could not create the invoice.** is shown under it.

![21.gifts pay link failed](images/pl-failed.png)

### Variant: charge

The open till: the shop sticker's storefront above the name, then time left, the sat amount, the viewer's default fiat beside it, and **Pay**. Desktop also shows the Bitcoin invoice QR. A smartphone does not. No gift glyph and no amount field.

![21.gifts pay link charge](images/pl-charge.png)

### Variant: charge-failed

Open till, mint failed. The shop sticker, time left, the sat amount, the viewer's default fiat beside it, **Could not create the invoice.**, and **Pay**. No invoice QR. **Pay** tries the mint again.

![21.gifts pay link charge failed](images/pl-charge-failed.png)

## Screen: /setup/name

- **URL:** `/setup/name` — when `account.setup === 'name'`.
- **What the user sees:** Chrome is the page-frame header (one top-left arrow that returns to the previous in-app view, or `/welcome` when this tab has none, a non-link wordmark, and Menu inside the rounded sheet). Open **Menu** (see **Signed-in header**) for **Home**, **Balance** (`/wallet`), **Shops**, **Point of sale**, Profile, **Grants**, **Settings**, **Living room rules**, **Habit-Tracker**, **Trust Chain**, **Statistics**, **Notifications**, **Messages**, **Contact**, optional **Install app**, and **Log out**. Heading **Your name**, name form with **Continue** and labeled **Skip**. No address form.
- **Actions:** Enter a name and **Continue**, or **Skip** (`POST /me/setup/skip`); open **Menu** (see **Signed-in header**) for **Home**, **Balance** (`/wallet`), **Shops**, **Point of sale**, Profile, **Grants**, **Settings**, **Living room rules**, **Habit-Tracker**, **Trust Chain**, **Statistics**, **Notifications**, **Messages**, **Contact**, optional **Install app**, or **Log out**. After save or skip, the visitor is sent to the next `account.setup` path (usually `/setup/username`).
- **Calls:** `AppShell`, `ProfileChromeLeft`, `Wordmark`, `NameSetup`, `NameForm`, `SignedInChrome`, `OnboardingGate`, `skipSetup`.

### Variant: default

Signed in, no name yet. **Your name** and the name field at the top, **Continue** and labeled **Skip** pinned at the bottom of the screen. One **Menu** top-right (see **Signed-in header**); open the Menu for **Home**, **Balance**, **Shops**, **Point of sale**, Profile, **Grants**, **Settings**, **Living room rules**, **Habit-Tracker**, **Trust Chain**, **Statistics**, **Notifications**, **Messages**, **Contact**, optional **Install app**, and **Log out**.
![21.gifts name setup](images/setup-name.png)

## Screen: /setup/username

- **URL:** `/setup/username` — after the display name (`account.setup === 'username'`). Cannot skip.
- **What the user sees:** Chrome is the page-frame header (one top-left arrow that returns to the previous in-app view, or `/welcome` when this tab has none, a non-link wordmark, and Menu inside the rounded sheet). Open **Menu** (see **Signed-in header**) for **Home**, **Balance** (`/wallet`), **Shops**, **Point of sale**, Profile, **Grants**, **Settings**, **Living room rules**, **Habit-Tracker**, **Trust Chain**, **Statistics**, **Notifications**, **Messages**, **Contact**, optional **Install app**, and **Log out**. Heading **Your 21.gifts name**, hint that Bitcoin is sent to `you@21.gifts` and goes straight into the member's own wallet in this app, username field, **Continue**. No Skip.
- **Actions:** Enter a LUD-16 handle and **Continue** (`POST /me/username`). Once the account's in-app wallet is verified the username is fixed: field and **Continue** are disabled with a line that says why. Taken or invalid handles stay on this screen. After save, the visitor is sent to the next `account.setup` path (usually `/setup/rules`). There is no address step: background wallet setup registers the member's in-app wallet.
- **Calls:** `AppShell`, `ProfileChromeLeft`, `Wordmark`, `UsernameSetup`, `UsernameForm`, `SignedInChrome`, `OnboardingGate`, `setUsername`.

### Variant: default

Signed in with a display name (or a skipped name) and no username. **Your 21.gifts name**, the username field, and **Continue**. One **Menu** top-right.
![21.gifts username setup](images/setup-username.png)

### Variant: username-frozen

Account whose in-app wallet is verified (`sparkWalletVerified`). The hint under the heading is left out, the field shows the current username and is disabled, **Continue** is disabled, and one line reads **Your username can no longer be changed because your wallet address uses it.**

![21.gifts username frozen](images/setup-username-frozen.png)

## Screen: /setup/rules

- **URL:** `/setup/rules` — when living-room rules are not yet agreed (`account.setup === 'rules'`). Name and username may already be done; username cannot be skipped; rules cannot be skipped.
- **What the user sees:** Chrome is the page-frame header (wordmark is a non-link span, plus Menu). Chapter 0 shows one arrow that returns to the previous in-app view in this tab, or `/welcome` when this tab has none. Later chapters replace it with the previous-chapter arrow. One arrow. Open **Menu** (see **Signed-in header**) for **Home**, **Balance** (`/wallet`), **Shops**, **Point of sale**, Profile, **Grants**, **Settings**, **Living room rules**, **Habit-Tracker**, **Trust Chain**, **Statistics**, **Notifications**, **Messages**, **Contact**, optional **Install app**, and **Log out**. Heading **Living room rules**, prompt to read this chapter, progress (`1 of 9` on the first chapter), one rules chapter at a time (lead first) without the public Contact link, and a full-width **Continue** button. The last chapter shows **I agree to these rules** instead of **Continue**, and above it the line **By continuing you accept the Terms of Use.** whose **Terms of Use** links to `/terms`. There is no checkbox and no extra step.
- **Actions:** Read the current chapter and **Continue** to advance. Chapter 0's arrow returns to the previous in-app view in this tab, or `/welcome` when this tab has none. Later chapters use that same arrow for the previous chapter. One arrow. The wordmark is not that control. Changing chapter (Continue or Back) scrolls the fill inner scroller back to the top. The last **I agree to these rules** POSTs agreement, then the visitor is sent to `/welcome`. On the last chapter **Terms of Use** opens `/terms` client-side; its arrow returns here and reopens that last chapter (a reload starts at the first chapter again). Open **Menu** (see **Signed-in header**) for **Home**, **Balance** (`/wallet`), **Shops**, **Point of sale**, Profile, **Grants**, **Settings**, **Living room rules**, **Habit-Tracker**, **Trust Chain**, **Statistics**, **Notifications**, **Messages**, **Contact**, optional **Install app**, or **Log out**.
- **Calls:** `AppShell`, `Wordmark`, `RulesSetup`, `RulesDocument`, `SignedInChrome`, `OnboardingGate`, `agreeToRules` (`POST /me/rules-agreement`) on the last chapter only.

### Variant: default

Signed in with a name and username and `rulesAgreedAt` still null. First chapter (lead paragraph plus the accent-bordered **The test** callout) and **Continue** visible.

![21.gifts rules setup](images/setup-rules.png)

### Variant: law1

After one Continue: rule card with kicker **Rule 1**, heading **Only free donations**, body, and **The test** callout. Icon-only back is visible.

![21.gifts rules setup law 1](images/setup-rules-law1.png)

### Variant: law2

Rule card **Rule 2** / **Donors come first** with body and **The test** callout.

![21.gifts rules setup law 2](images/setup-rules-law2.png)

### Variant: law3

Rule card **Rule 3** / **Contact stays in the app** with body (no test callout).

![21.gifts rules setup law 3](images/setup-rules-law3.png)

### Variant: wanted

Heading **Welcome**, muted lead, and the welcome list (app-fg check glyphs, not accent).

![21.gifts rules setup wanted](images/setup-rules-wanted.png)

### Variant: allowed

Heading **Allowed**, muted lead, and the allowed list (muted check glyphs).

![21.gifts rules setup allowed](images/setup-rules-allowed.png)

### Variant: ratherNot

Heading **Better not**, muted lead, and the better-not list (minus glyphs).

![21.gifts rules setup rather not](images/setup-rules-rather-not.png)

### Variant: forbidden

Heading **Forbidden**, muted lead, and the three forbidden groups (red cross glyphs).

![21.gifts rules setup forbidden](images/setup-rules-forbidden.png)

### Variant: house

Last chapter: muted **Our house** block (body plus emphasised closing paragraph), the line **By continuing you accept the Terms of Use.** with **Terms of Use** linked to `/terms`, and **I agree to these rules**. That click POSTs agreement.

![21.gifts rules setup house](images/setup-rules-house.png)

### Variant: error

Last-chapter POST failed. Alert **Could not save your agreement**. The Terms of Use line stays above the button.

![21.gifts rules setup error](images/setup-rules-error.png)

### Variant: busy

Last-chapter POST in flight. Agree disabled with a spinner; **Our house** still visible.

![21.gifts rules setup busy](images/setup-rules-busy.png)

## Screen: /welcome

- **URL:** `/welcome` — when `account.setup` is null (name may be saved or skipped; username is required; living-room rules agreement is required). New passkey accounts reach this after name, username, and rules. Their sign-up prompt already placed the recovery phrase in tab memory, so wallet setup can finish in the background during onboarding or here; the phrase itself is never shown on that path.
- **What the user sees:** Chrome is the page-frame header. The forum home shows no top-left arrow, whatever this tab's view history holds; only the wordmark sits top-left. An ask step uses that same slot. The Menu's **Home** clears this tab's in-app view history and opens `/welcome` client-side (the open wallet stays open), so the first screen opened from here has an arrow back to `/welcome`, as on a fresh tab. The browser's own back button is not affected. The wordmark is not that control. Menu sits inside the rounded sheet. Content scrolls inside the frame. A signed-in member has no composer on the page: a round **+** (**Write a post**, 56 px, primary colours, a shadow) floats at the bottom right of the frame, 24 px from the edge and 23 px above **Receive** / **Send** (near the frame's bottom edge without them). Tapping it opens the writer right under the header row, from the header row's bottom edge to the frame's (frame background, rounded bottom corners), with the text field focused so the keyboard comes up within the tap: a centred title **Send a post** (or **Ask for money** while Ask is chosen), the **Send a post** / **Ask for money** pill, then the composer as before (text field, photo, place, send; the Ask wizard on **Ask for money**; the posting-fee pay slot; errors). It covers the feed and **Receive** / **Send**, scrolls inside itself when taller, and moves with the frame when the keyboard shifts the page. The top-left arrow closes it (after stepping back through any Ask step inside); there is no close or cancel button. A successful post closes it by itself and the post appears on the feed; the feed then shows its top with the new note (a posting fee that completes after the writer was closed changes neither the scroll nor the focus). Closed with the arrow, an unsent draft stays for the next opening and the feed comes back where it was. **Receive** and **Send** follow the scroll: about 80 px of scrolling down slims them from 56 px to 36 px (slightly smaller text, smaller icons, less padding), about 80 px up brings them back, with no animation while the finger moves; when the scroll stops half way they glide (320 ms) to the nearer size, and within 24 px of the top they are always full. The **+** moves with them. With reduced motion they settle without the glide. The same buttons on `/wallet` behave the same way. Open **Menu** (see **Signed-in header**) for **Home**, **Balance**, **Shops**, **Point of sale**, Profile, **Grants**, **Settings**, **Living room rules**, **Habit-Tracker**, **Trust Chain**, **Statistics**, **Notifications**, **Messages**, **Contact**, optional **Install app**, and **Log out**, then a quiet **Version {version}** line (`app.version`). Gift icon with an integrated Bitcoin symbol, **Welcome, {name}** when the account has a name, or **Welcome** with no session and no empty "Welcome, ". Wallet setup may still be finishing in the background for a new account, but it never covers this non-money screen and no failure note appears here. A signed-out visit, including a held-back stored session on this guest-allowed screen, keeps the wordmark, shows **Log in**, and does not show the member menu. Each note still shows its bitcoin amount. The active list loads without Authorization. Another forum mode, or a later page that returns 401, opens `/login`. No composer, reaction form, pay, or delete while signed out. **Show reactions** still loads public replies. A resolved `@username` opens that member only when a session exists; without a session the mark stays text. An author name with a non-empty `accountId` is the profile button even without a session. dismissible living-room laws hint box with an X when not yet dismissed on the account (two laws plus links to **Living room rules** `/rules` and **Contact** `/contact`; after dismiss the box is gone and the flag persists on the account), then a `ForumModeSelect` dropdown (**Active** / **No gifts yet** / **All** / **Most popular**), default **Active**, not a four-way SegmentedControl and not a two-column grid. First paint is one page of 20 notes for the selected mode; further cursor pages prefetch near the end of the visible list. Page-one polling does not replace older loaded pages. **No gifts yet** shows a count chip on the closed control for loaded zero-sat notes created after the last time that filter was opened; omitted when the count is 0 or the filter is selected. Default is **Active** (paid notes (`sats` > 0) plus unpaid moderator notes; a top-level ask with `goalSats` > 0 and zero sats is not included, newest-first feed: newest at the top). **All** shows every note newest-first. **Most popular** ranks paid notes by sats (highest first). Below the selector: clickable author name when `accountId` is set (opens `/members/:id`), including without a session; without `accountId` the name stays text, optional Founder / Moderator / Initiator / Verified pill when the api `role` is one of those four (`basis` has no pill), a `#Shop` link to `/shops` on top-level shop notes (raw `#21GiftsShop` hidden); a moderator also sees **Edit shop note** on each of those notes and can open the same five steps as on `/shops`, timestamp, optional inline photo then caption text below the photo, a link to `/shops?pin=<id>#map` (the label, or coordinates when the label is null) on a top-level note that has a place, optional inline `<video>` playback for notes with video (player follows the clip aspect — portrait stays portrait; the player has its own fullscreen button, including a narrow portrait clip); note and reply bodies longer than 560 characters (twice the 280-character preview) show a 280-character collapsed preview, an ellipsis, and inline **Show more** (`forum.showMore`), expanding in place with no Show less, while permalink `/messages/[id]` stays full text. Cards also show ₿ amount always, plus optional preferred-fiat `·` from the amount stored when the payment was made (a stored string as-is; a null or missing field uses the spot rate) (no FiatPicker), replyCount text, React (`forum.react`, lucide Reply) on every top-level note, copy-link control (**Copy link to this note** → origin `/l/<8 hex>` (first group of that note id); nested replies get their own copy control, **Copy link to this reply** → origin `/l/<8 hex>` (first group of that reply id)), and expand/collapse on the card body (**Show reactions** / **Hide reactions**; the footer ₿ amount and the reaction-count text also expand; React expands a collapsed card and does not collapse an expanded one; Gift on a payable reply / role / copy / delete / Translate / Heart do not; the card body remains the unique **Show reactions** / **Hide reactions** name). Expanded cards show the replies list (Gift on a payable reply, copy, and moderator trash are also on nested replies) plus an in-card reply composer (**Write a reaction** and an **Amount** field with the ₿ / fiat switch and the other unit under it; the last choice is `account.amountUnit`; empty reply text and an empty amount invoices 21 sats (pay-sheet default); a reply with text and an empty amount is unpaid for a verified member, otherwise 1 sat to 21.gifts on the composer slot (`payHost: composer`); extra gifts stay on the card (`payHost: card`); an amount of 0 is billed as 1 sat); reply authors show the same Founder / Moderator / Initiator / Verified pills (`basis` has none). Pay control / Send Bitcoin only on a payable reply (open **Show reactions**, then Gift on that reply — never on the post); composer in the writer (opened with **+**): **Send a post** / **Ask for money** pill, then Post-path **Add a photo or video** (ImagePlus) and **Add a place** (MapPin) left of the textarea, **Post** (Send icon) to the right (Ask path is `ForumAskWizard`), optional photo draft preview with **Remove photo** (X icon), and optional video draft preview with **Remove video** (X icon) — icon-only action controls, catalog `aria-label`s, no visible button text. In the writer on a touch device (phone or tablet) the Post composer has its phone shape: the text field on top at full width, and one row below it with **Add a photo or video** and **Add a place** on the left and **Post** on the right. Top-level notes with `goalSats` show `ForumGoalBar`: **Ask**, then the defined fiat amount only when the ask was defined in fiat, then `formatBitcoin(goalSats)`, then the visitor's default fiat unless the ask was defined in that same fiat. That visitor figure is the stored snapshot when the string is present, otherwise the spot rate. A legacy ask is bitcoin plus that same visitor figure. Then orange 0–100, green overflow, uncapped percent. A missing name, username, or rules agreement opens `RequirementsOverlay` (no Skip) before a post or reply retries; when the api lists `lightning-address` (the member cannot receive yet), or answers a gift, paid reply, posting fee, or today's repayment invoice with `code` `wallet_required`, the same dialog explains that gifts and posts need the member's own 21.gifts wallet. No always-visible refresh control; there is no visible refresh chrome — while refreshing or pull-armed only a visually hidden (`sr-only`) `role="status"` (`forum.refreshing`) is mounted, and idle markup has no status node. When the visitor is scrolled down and a silent refresh found new ids, a labeled **New posts** pill appears over the feed; it is absent from idle screenshots. When an unread `moderator_appointed` notification exists, a labeled **You are a moderator** pill uses the same chrome (sticky under the frame header); if both pills show, appointment stays at `top-2` and **New posts** moves to `top-14`. Clicking the appointment pill marks that row read and stays on `/welcome`; it is omitted when the flag is falsy and absent from idle screenshots. While the tab is visible the list also silent-refetches every 30 seconds (`FORUM_LIST_POLL_MS`); hidden tabs do not poll. Clicking a role pill toggles a short explanation under that card header. Paying a payable reply opens a sheet with a Close (`X`) control, not Back, and the in-app wallet pay slot. No invoice QR and no button to another wallet app, on any device. No name or address form. No guest donate CTA. Signed-in chrome shows `IntroduceYourselfOverlay` on this screen, and on no other, when `setup` is null and `hasPosted` is false. **Translate** (Languages icon) sits in the footer icon row with react / copy; **Show original** / **Show translation** stay the same Languages icon, with no visible text. Offered when the note language differs from the UI locale. Heart (lucide Heart, `forum.heart` “Send ₿1”) is icon-only in that same footer row after Translate and before React or Gift; it shows on a note or reply that is not deleted, not the viewer's own, and whose author can receive (`payable`), including a signed-out card, and never on the external author profile; a signed-out or read-only tap does nothing; a payable tap vibrates and shows the filled heart before payment; `+1` appears only after the payment succeeds. The invoice card pays from the member's in-app wallet only (the `sparkInvoice` when the api issued one, otherwise the payment request). The wallet is open whenever the member is signed in; otherwise the central gate shows the login card in place of this screen. While the wallet connects, prepares amount and fee, or finishes one-time setup in the background, the slot shows **Checking your wallet…**. A prepared payment shows **Send**; the posting fee of a new post or reply instead says **Pay {amount} and post**, without a fiat suffix, here, on the signed-in public note, and on a member profile. Only a quoted fee above ₿0 adds a **Fee {amount}** row with the default fiat above that button. Every payment waits for that explicit tap, including a zero-fee payment. After paying it says **Paying from your wallet…** and the existing long-poll closes the sheet on confirmation. A send that fails or times out is not retried: the sheet keeps waiting for 60 seconds, then shows a neutral not-confirmed-yet sentence; a sheet still open 60 seconds after a successful send shows the same sentence. Too little balance shows an alert, then **Still missing: {amount}** in ₿ and fiat (absent only while the balance is unknown), then the member's own 21.gifts address and QR to add Bitcoin (without a username, only the address and QR are left out). While this shows, the slot reads the synced balance every 4 s; once the balance covers the amount and known fee, it prepares again and stops at **Send** (with the fee row only when the quoted fee is above ₿0), never paying without that tap. The same applies to today's repayment and the posting fee in the composer. Without a configured wallet, or for an account that cannot hold one, the card says **Your 21.gifts wallet is not available here, so this cannot be paid.**; a failed connection or prepare shows **Your wallet could not prepare this payment. Please try again.** with **Try again**. If background setup exhausts its retries, this money surface instead shows the alert **Your wallet could not be set up yet.** with a secondary **Try again** button; it never appears elsewhere on the forum.
- **Actions:** Dismiss the living-room laws hint (permanent), tap **+** to open the writer and close it with the top-left arrow, post a text and/or photo or video message from the writer, attach/remove a photo, a video, or a place draft, expand a note to load replies and post a reply, open an author profile at `/members/:id`, open a `#Shop` tag to `/shops`, edit a shop note when the session is a moderator, copy a note link or a reply's own link to origin `/l/<8 hex>` (first group of that note or reply id), click a role pill for its explanation, pay a payable reply in-app, switch the forum view (Active / No gifts yet / All / Most popular), pull down from the top to refresh the forum list, click **You are a moderator** to mark that appointment read and hide the pill, click **New posts** or the wordmark / Menu **Home** (already on `/welcome`) to scroll to top and apply new notes (Menu **Home** also clears the in-app view history), open Menu **Home** on any other screen to clear the in-app view history and return here, leave the forum in view for 30 seconds so a visible-tab poll can pick up new ids, return to the web app to refresh the list when it becomes visible again, complete a `RequirementsOverlay` for a missing name, username, or rules agreement (a missing wallet is explained there, not filled in), open the rules or contact pages, retry a failed load; open **Menu** (see **Signed-in header**) for **Home**, **Balance**, **Shops**, **Point of sale**, Profile, **Grants**, **Settings**, **Living room rules**, **Habit-Tracker**, **Trust Chain**, **Statistics**, **Notifications**, **Messages**, **Contact**, optional **Install app**, or **Log out**, then a quiet **Version {version}** line (`app.version`); dismiss `IntroduceYourselfOverlay` for this mount (Close) or **Write an introduction** (dismisses, opens the writer and focuses its text field via `requestForumCompose` / `FORUM_COMPOSE_EVENT`).
- **Calls:** `PageChrome`, `AppShell`, `ProfileChromeLeft`, `ForumHomeWordmark`, `WelcomeScreen`, `ForumLoader`, `ForumBoard`, `AppShellOverlay`, `WalletFooterActions`, `useAppHeight`, `ShopNoteEditControl`, `ForumModeSelect`, `ForumAskWizard`, `ForumGoalBar`, `parseForumAskAmount`, `RequirementsOverlay`, `SegmentedControl`, `SignedInChrome`, `IntroduceYourselfOverlay`, `OnboardingGate`, `prepareForumPhoto`, `prepareForumVideo`, `fetchMessagePhoto`, `forumVideoSrc`, `fetchReplies`, `visibleForumMessages`, `hasUnseenForumPosts`, `unpaidNewCount`, `useSpotRate`, `fetchFxSpot`, `spotRateDay`, `satsToFiatAmount`, `fetchNotifications`, `markNotificationRead`, `WalletPay`, `useWalletPay`, the wallet payment primitive.

### Variant: default

Gift icon with an integrated Bitcoin symbol, **Welcome, Ada**, without the living-room laws hint (`forumLawsDismissed`), **Active** selected. Paid notes newest-first (Ada ₿5 then Carol ₿21); Bob's unpaid note is not visible. No composer on the page: the **+** (**Write a post**) floats at the bottom right; the writer holds **Send a post** / **Ask for money** and the composer. React (`forum.react`) on every top-level note. Posts do not show Send Bitcoin; Gift appears on a payable reply after **Show reactions**. Heart (`forum.heart` “Send ₿1”) sits after Translate and before React or Gift on a note or reply that is not deleted, not the viewer's own, and whose author can receive (`payable`), including a signed-out card, and never on the external author profile; a signed-out or read-only tap does nothing; a payable tap vibrates and shows the filled heart before payment; `+1` appears only after the payment succeeds. Founder / Moderator / Initiator / Verified pills beside the name when `role` is one of those four; `basis` has no pill (Carol is `verified`, Ada is `moderator`; Bob is `basis` and hidden on Active). One **Menu** top-right (see **Signed-in header**); open the Menu for **Home**, **Balance**, **Shops**, **Point of sale**, Profile, **Grants**, **Settings**, **Living room rules**, **Habit-Tracker**, **Trust Chain**, **Statistics**, **Notifications**, **Messages**, **Contact**, optional **Install app**, and **Log out**.

![21.gifts welcome](images/welcome.png)

### Variant: wallet-buttons

Signed in with the wallet open (Playwright pin `?visual=balance-ready`, honoured only in a Playwright build): the forum home as in the default shot, plus **Receive** (left, arrow pointing in) and **Send** (right, arrow pointing out) at full size, fixed at the bottom of the screen under a soft fade, with the **+** (**Write a post**) 23 px above **Send**.

![21.gifts welcome with Receive and Send](images/welcome-wallet-buttons.png)

### Variant: wallet-buttons-slim

The same page scrolled down by more than 80 px: **Receive** and **Send** are slim (36 px tall, slightly smaller text and icons, less padding around them), and the **+** has moved down with them, still 23 px above **Send**.

![21.gifts welcome with slim Receive and Send](images/welcome-wallet-buttons-slim.png)

### Variant: wallet-setup-pending

Signed in while the background wallet setup is still due (Playwright pin `?visual=setup-pending`): **Receive** and **Send** are both enabled at the bottom of the forum home; a step that needs the open wallet waits for it inside the view. No dialog.

![21.gifts welcome while wallet setup is pending](images/welcome-wallet-setup-pending.png)

### Variant: wallet-receive

After **Receive**: the wallet's Receive view over the forum home (label **Receive**, the address QR, **ada@21.gifts**, **Copy**, **Set an amount**), with the top-left arrow and without the feed or the bottom buttons.

![21.gifts welcome receive view](images/welcome-wallet-receive.png)

### Variant: wallet-receive-opening

The `/wallet` variant `receive-opening` over the forum home (pin `?visual=setup-pending`, then **Receive**; Playwright builds only): the same Receive view as on `/wallet`, with the top-left arrow, without the feed or the bottom buttons.

![21.gifts welcome wallet receive while the wallet opens](images/welcome-wallet-receive-opening.png)

### Variant: wallet-receive-setup-failed

The `/wallet` variant `receive-setup-failed` over the forum home (pin `?visual=balance-setup-failed`, then **Receive**; Playwright builds only): the same Receive view as on `/wallet`, with the top-left arrow, without the feed or the bottom buttons.

![21.gifts welcome wallet receive after the setup gave up](images/welcome-wallet-receive-setup-failed.png)

### Variant: wallet-send-camera

After **Send** (pin `?visual=send-input`, which opens the Send view on its own): the full-size camera over the forum home (a stubbed black stream in the test browser) with the viewfinder, **Point the camera at a Bitcoin QR code** over the top of the picture, and **Paste** and **Enter manually** floating over its lower part; the top-left arrow closes it.

![21.gifts welcome send camera](images/welcome-wallet-send-camera.png)

### Variant: wallet-send-camera-denied

The same Send view when the camera is blocked: **Camera access was blocked. Allow it in your browser settings, or paste the payment request.** in white on the black camera area, with **Paste** and **Enter manually** still at the bottom.

![21.gifts welcome send camera denied](images/welcome-wallet-send-camera-denied.png)

### Variant: wallet-send-manual

The Send view after **Enter manually**: the sheet over the bottom of the camera area with the Close (`X`), `bob@example.com` typed into **Payment request or address**, and **Continue**.

![21.gifts welcome send manual entry](images/welcome-wallet-send-manual.png)

### Variant: wallet-send-manual-alert

The `/wallet` variant `send-manual-alert` over the forum home: the manual-entry sheet with the input alert under the field.

![21.gifts welcome wallet send manual alert](images/welcome-wallet-send-manual-alert.png)

### Variant: wallet-send-manual-busy

The `/wallet` variant `send-manual-busy` over the forum home: the manual-entry sheet while the typed text is read.

![21.gifts welcome wallet send manual busy](images/welcome-wallet-send-manual-busy.png)

### Variant: wallet-send-paste-denied

The `/wallet` variant `send-paste-denied` in the Send view a `?visual=send-input` pin opens over the forum home: the same view and step as on `/wallet`, with the top-left arrow, without the feed or the bottom buttons.

![21.gifts welcome wallet send paste denied](images/welcome-wallet-send-paste-denied.png)

### Variant: wallet-send-paste-empty

The `/wallet` variant `send-paste-empty` in the Send view a `?visual=send-input` pin opens over the forum home: the same view and step as on `/wallet`, with the top-left arrow, without the feed or the bottom buttons.

![21.gifts welcome wallet send paste empty](images/welcome-wallet-send-paste-empty.png)

### Variant: wallet-send-camera-unavailable

The `/wallet` variant `send-camera-unavailable` in the Send view a `?visual=send-input` pin opens over the forum home: the same view and step as on `/wallet`, with the top-left arrow, without the feed or the bottom buttons.

![21.gifts welcome wallet send camera unavailable](images/welcome-wallet-send-camera-unavailable.png)

### Variant: wallet-send-amount

The `/wallet` variant `send-amount` in the Send view the `?visual=send-amount` pin opens over the forum home (Playwright builds only): the same view and step as on `/wallet`, with the top-left arrow, without the feed or the bottom buttons.

![21.gifts welcome wallet send amount](images/welcome-wallet-send-amount.png)

### Variant: wallet-send-amount-fiat

The `/wallet` variant `send-amount-fiat` in the Send view the `?visual=send-amount-fiat` pin opens over the forum home (Playwright builds only): the same view and step as on `/wallet`, with the top-left arrow, without the feed or the bottom buttons.

![21.gifts welcome wallet send amount fiat](images/welcome-wallet-send-amount-fiat.png)

### Variant: wallet-send-confirm

The `/wallet` variant `send-confirm` in the Send view the `?visual=send-confirm` pin opens over the forum home (Playwright builds only): the same view and step as on `/wallet`, with the top-left arrow, without the feed or the bottom buttons.

![21.gifts welcome wallet send confirm](images/welcome-wallet-send-confirm.png)

### Variant: wallet-send-sent

The `/wallet` variant `send-sent` in the Send view the `?visual=send-sent` pin opens over the forum home (Playwright builds only): the same view and step as on `/wallet`, with the top-left arrow, without the feed or the bottom buttons.

![21.gifts welcome wallet send sent](images/welcome-wallet-send-sent.png)

### Variant: wallet-send-unsupported

The `/wallet` variant `send-unsupported` in the Send view the `?visual=send-unsupported` pin opens over the forum home (Playwright builds only): the same view and step as on `/wallet`, with the top-left arrow, without the feed or the bottom buttons.

![21.gifts welcome wallet send unsupported](images/welcome-wallet-send-unsupported.png)

### Variant: wallet-send-unreadable

The `/wallet` variant `send-unreadable` in the Send view the `?visual=send-unreadable` pin opens over the forum home (Playwright builds only): the same view and step as on `/wallet`, with the top-left arrow, without the feed or the bottom buttons.

![21.gifts welcome wallet send unreadable](images/welcome-wallet-send-unreadable.png)

### Variant: wallet-send-input-opening

The `/wallet` variant `send-input-opening` in the Send view the `?visual=send-input-opening` pin opens over the forum home (Playwright builds only): the same view and step as on `/wallet`, with the top-left arrow, without the feed or the bottom buttons.

![21.gifts welcome wallet send input while the wallet opens](images/welcome-wallet-send-input-opening.png)

### Variant: wallet-send-input-wallet-error

The `/wallet` variant `send-input-wallet-error` in the Send view the `?visual=send-input-wallet-error` pin opens over the forum home (Playwright builds only): the same view and step as on `/wallet`, with the top-left arrow, without the feed or the bottom buttons.

![21.gifts welcome wallet send input after the wallet could not be opened](images/welcome-wallet-send-input-wallet-error.png)

### Variant: wallet-send-confirm-opening

The `/wallet` variant `send-confirm-opening` in the Send view the `?visual=send-confirm-opening` pin opens over the forum home (Playwright builds only): the same view and step as on `/wallet`, with the top-left arrow, without the feed or the bottom buttons.

![21.gifts welcome wallet send confirm while the wallet opens](images/welcome-wallet-send-confirm-opening.png)

### Variant: wallet-send-confirm-wallet-error

The `/wallet` variant `send-confirm-wallet-error` in the Send view the `?visual=send-confirm-wallet-error` pin opens over the forum home (Playwright builds only): the same view and step as on `/wallet`, with the top-left arrow, without the feed or the bottom buttons.

![21.gifts welcome wallet send confirm after the wallet could not be opened](images/welcome-wallet-send-confirm-wallet-error.png)

### Variant: wallet-send-invalid

The `/wallet` variant `send-invalid` in the Send view the `?visual=send-invalid` pin opens over the forum home (Playwright builds only): the same view and step as on `/wallet`, with the top-left arrow, without the feed or the bottom buttons.

![21.gifts welcome wallet send invalid](images/welcome-wallet-send-invalid.png)

### Variant: wallet-send-failed

The `/wallet` variant `send-failed` in the Send view the `?visual=send-failed` pin opens over the forum home (Playwright builds only): the same view and step as on `/wallet`, with the top-left arrow, without the feed or the bottom buttons.

![21.gifts welcome wallet send failed](images/welcome-wallet-send-failed.png)

### Variant: wallet-send-insufficient

The `/wallet` variant `send-insufficient` in the Send view the `?visual=send-insufficient` pin opens over the forum home (Playwright builds only): the same view and step as on `/wallet`, with the top-left arrow, without the feed or the bottom buttons.

![21.gifts welcome wallet send insufficient](images/welcome-wallet-send-insufficient.png)

### Variant: wallet-send-amount-error

The `/wallet` variant `send-amount-error` in the Send view the `?visual=send-amount-error` pin opens over the forum home (Playwright builds only): the same view and step as on `/wallet`, with the top-left arrow, without the feed or the bottom buttons.

![21.gifts welcome wallet send amount error](images/welcome-wallet-send-amount-error.png)

### Variant: wallet-send-amount-request

The `/wallet` variant `send-amount-request` in the Send view the `?visual=send-amount-request` pin opens over the forum home (Playwright builds only): the same view and step as on `/wallet`, with the top-left arrow, without the feed or the bottom buttons.

![21.gifts welcome wallet send amount request](images/welcome-wallet-send-amount-request.png)

### Variant: wallet-send-amount-no-comment

The `/wallet` variant `send-amount-no-comment` in the Send view the `?visual=send-amount-no-comment` pin opens over the forum home (Playwright builds only): the same view and step as on `/wallet`, with the top-left arrow, without the feed or the bottom buttons.

![21.gifts welcome wallet send amount no comment](images/welcome-wallet-send-amount-no-comment.png)

### Variant: wallet-send-amount-min

The `/wallet` variant `send-amount-min` in the Send view the `?visual=send-amount-min` pin opens over the forum home (Playwright builds only): the same view and step as on `/wallet`, with the top-left arrow, without the feed or the bottom buttons.

![21.gifts welcome wallet send amount min](images/welcome-wallet-send-amount-min.png)

### Variant: wallet-send-confirm-sending

The `/wallet` variant `send-confirm-sending` in the Send view the `?visual=send-confirm-sending` pin opens over the forum home (Playwright builds only): the same view and step as on `/wallet`, with the top-left arrow, without the feed or the bottom buttons.

![21.gifts welcome wallet send confirm sending](images/welcome-wallet-send-confirm-sending.png)

### Variant: wallet-send-confirm-fixed

The `/wallet` variant `send-confirm-fixed` in the Send view the `?visual=send-confirm-fixed` pin opens over the forum home (Playwright builds only): the same view and step as on `/wallet`, with the top-left arrow, without the feed or the bottom buttons.

![21.gifts welcome wallet send confirm fixed](images/welcome-wallet-send-confirm-fixed.png)

### Variant: wallet-send-confirm-shop

The `/wallet` variant `send-confirm-shop` in the Send view the `?visual=send-confirm-shop` pin opens over the forum home (Playwright builds only): the same view and step as on `/wallet`, with the top-left arrow, without the feed or the bottom buttons.

![21.gifts welcome wallet send confirm shop](images/welcome-wallet-send-confirm-shop.png)

### Variant: wallet-send-confirm-member

The `/wallet` variant `send-confirm-member` in the Send view the `?visual=send-confirm-member` pin opens over the forum home (Playwright builds only): the same view and step as on `/wallet`, with the top-left arrow, without the feed or the bottom buttons.

![21.gifts welcome wallet send confirm member](images/welcome-wallet-send-confirm-member.png)

### Variant: wallet-send-amount-onchain

The `/wallet` variant `send-amount-onchain` in the Send view the `?visual=send-amount-onchain` pin opens over the forum home (Playwright builds only): the same view and step as on `/wallet`, with the top-left arrow, without the feed or the bottom buttons.

![21.gifts welcome wallet send amount onchain](images/welcome-wallet-send-amount-onchain.png)

### Variant: wallet-send-amount-onchain-min

The `/wallet` variant `send-amount-onchain-min` in the Send view the `?visual=send-amount-onchain-min` pin opens over the forum home (Playwright builds only): the same view and step as on `/wallet`, with the top-left arrow, without the feed or the bottom buttons.

![21.gifts welcome wallet send amount onchain min](images/welcome-wallet-send-amount-onchain-min.png)

### Variant: wallet-send-confirm-onchain

The `/wallet` variant `send-confirm-onchain` in the Send view the `?visual=send-confirm-onchain` pin opens over the forum home (Playwright builds only): the same view and step as on `/wallet`, with the top-left arrow, without the feed or the bottom buttons.

![21.gifts welcome wallet send confirm onchain](images/welcome-wallet-send-confirm-onchain.png)

### Variant: wallet-send-confirm-onchain-fast

The `/wallet` variant `send-confirm-onchain-fast` in the Send view the `?visual=send-confirm-onchain-fast` pin opens over the forum home (Playwright builds only): the same view and step as on `/wallet`, with the top-left arrow, without the feed or the bottom buttons.

![21.gifts welcome wallet send confirm onchain fast](images/welcome-wallet-send-confirm-onchain-fast.png)

### Variant: wallet-send-confirm-onchain-slow

The `/wallet` variant `send-confirm-onchain-slow` in the Send view the `?visual=send-confirm-onchain-slow` pin opens over the forum home (Playwright builds only): the same view and step as on `/wallet`, with the top-left arrow, without the feed or the bottom buttons.

![21.gifts welcome wallet send confirm onchain slow](images/welcome-wallet-send-confirm-onchain-slow.png)

### Variant: wallet-send-confirm-onchain-low

The `/wallet` variant `send-confirm-onchain-low` in the Send view the `?visual=send-confirm-onchain-low` pin opens over the forum home (Playwright builds only): the same view and step as on `/wallet`, with the top-left arrow, without the feed or the bottom buttons.

![21.gifts welcome wallet send confirm onchain low](images/welcome-wallet-send-confirm-onchain-low.png)

### Variant: wallet-send-confirm-onchain-renewed

The `/wallet` variant `send-confirm-onchain-renewed` in the Send view the `?visual=send-confirm-onchain-renewed` pin opens over the forum home (Playwright builds only): the same view and step as on `/wallet`, with the top-left arrow, without the feed or the bottom buttons.

![21.gifts welcome wallet send confirm onchain renewed](images/welcome-wallet-send-confirm-onchain-renewed.png)

### Variant: wallet-send-confirm-onchain-renewing

The `/wallet` variant `send-confirm-onchain-renewing` in the Send view the `?visual=send-confirm-onchain-renewing` pin opens over the forum home (Playwright builds only): the same view and step as on `/wallet`, with the top-left arrow, without the feed or the bottom buttons.

![21.gifts welcome wallet send confirm onchain renewing](images/welcome-wallet-send-confirm-onchain-renewing.png)

### Variant: wallet-send-confirm-onchain-sending

The `/wallet` variant `send-confirm-onchain-sending` in the Send view the `?visual=send-confirm-onchain-sending` pin opens over the forum home (Playwright builds only): the same view and step as on `/wallet`, with the top-left arrow, without the feed or the bottom buttons.

![21.gifts welcome wallet send confirm onchain sending](images/welcome-wallet-send-confirm-onchain-sending.png)

### Variant: wallet-send-input-busy

The `/wallet` variant `send-input-busy` in the Send view the `?visual=send-input-busy` pin opens over the forum home (Playwright builds only): the same view and step as on `/wallet`, with the top-left arrow, without the feed or the bottom buttons.

![21.gifts welcome wallet send input busy](images/welcome-wallet-send-input-busy.png)

### Variant: wallet-send-amount-busy

The `/wallet` variant `send-amount-busy` in the Send view the `?visual=send-amount-busy` pin opens over the forum home (Playwright builds only): the same view and step as on `/wallet`, with the top-left arrow, without the feed or the bottom buttons.

![21.gifts welcome wallet send amount busy](images/welcome-wallet-send-amount-busy.png)

### Variant: wallet-send-error

The `/wallet` variant `send-error` in the Send view the `?visual=send-error` pin opens over the forum home (Playwright builds only): the same view and step as on `/wallet`, with the top-left arrow, without the feed or the bottom buttons.

![21.gifts welcome wallet send error](images/welcome-wallet-send-error.png)

### Variant: wallet-send-not-payable

The `/wallet` variant `send-not-payable` in the Send view the `?visual=send-not-payable` pin opens over the forum home (Playwright builds only): the same view and step as on `/wallet`, with the top-left arrow, without the feed or the bottom buttons.

![21.gifts welcome wallet send not payable](images/welcome-wallet-send-not-payable.png)

### Variant: wallet-send-not-found

The `/wallet` variant `send-not-found` in the Send view the `?visual=send-not-found` pin opens over the forum home (Playwright builds only): the same view and step as on `/wallet`, with the top-left arrow, without the feed or the bottom buttons.

![21.gifts welcome wallet send not found](images/welcome-wallet-send-not-found.png)

### Variant: wallet-send-relay-unreachable

The `/wallet` variant `send-relay-unreachable` in the Send view the `?visual=send-relay-unreachable` pin opens over the forum home (Playwright builds only): the same view and step as on `/wallet`, with the top-left arrow, without the feed or the bottom buttons.

![21.gifts welcome wallet send relay unreachable](images/welcome-wallet-send-relay-unreachable.png)

### Variant: wallet-send-comment-long

The `/wallet` variant `send-comment-long` in the Send view the `?visual=send-comment-long` pin opens over the forum home (Playwright builds only): the same view and step as on `/wallet`, with the top-left arrow, without the feed or the bottom buttons.

![21.gifts welcome wallet send comment long](images/welcome-wallet-send-comment-long.png)

### Variant: wallet-receive-copied

The `/wallet` variant `receive-copied` after **Receive** over the forum home (pin `?visual=balance-ready`): the same view and step as on `/wallet`, with the top-left arrow, without the feed or the bottom buttons.

![21.gifts welcome wallet receive copied](images/welcome-wallet-receive-copied.png)

### Variant: home-from-menu

Signed in. The member opened **Shops** from the Menu (its arrow returns to `/welcome`), then chose Menu **Home**. The forum home shows the wordmark top-left and no arrow. The in-app view history now holds only `/welcome`, so the next screen's arrow returns here. The rest is the default welcome.

![21.gifts welcome after Menu Home](images/welcome-home-from-menu.png)

### Variant: daily-payout-stopped

Signed in, no grant application. The notice title is **Daily payout stopped**, then **Applications are currently paused. You can apply again when shop transactions have increased.**, then the link `https://21.gifts/statistics`. No apply control. The living room underneath is the default welcome.

![21.gifts welcome daily payout stopped](images/welcome-daily-payout-stopped.png)

### Variant: daily-payout-stopped-apply

Username joey-rosima, of any role, sees the Apply link under Daily payout stopped, not the paused sentence. That link is not the apply walk.

![21.gifts welcome daily payout stopped apply](images/welcome-daily-payout-stopped-apply.png)

### Variant: renew

Signed in, no seed yet. The dialog explains that the device will ask for a passkey and that nothing changes until the member confirms. **Continue** is the only action. There is no close control.

![21.gifts welcome renew](images/welcome-renew.png)

### Variant: renew-passkey

Pinned fixture (`?visual=renew-passkey`, Playwright builds only). After **Continue**. The dialog says the device is showing the passkey prompt. The member confirms that prompt on the device. There is no second button.

![21.gifts welcome renew passkey](images/welcome-renew-passkey.png)

### Variant: renew-ok

Pinned fixture (`?visual=renew-ok`, Playwright builds only). The passkey was renewed. The dialog says it worked. **OK** closes it and the living room is usable.

![21.gifts welcome renew ok](images/welcome-renew-ok.png)

### Variant: renew-failed

The renewal did not work. **OK** confirms that and closes the dialog. The renew does not start again. The account still has no seed.

![21.gifts welcome renew failed](images/welcome-renew-failed.png)

### Variant: renew-failed-prf-unsupported

The renewal did not work because the passkey gave no PRF output. The dialog says **This phone or browser cannot hold a 21.gifts wallet. Please use an up-to-date phone or browser that supports passkeys.** (`wallet.prfUnsupported`). **OK** confirms that and closes the dialog. The renew does not start again. The account still has no seed.

![21.gifts welcome renew failed prf unsupported](images/welcome-renew-failed-prf-unsupported.png)

### Variant: sunday

Device-local Sunday, with the writer opened from **+**. The composer is gone from the writer. The sentence **Writing is paused on Sunday.** stands in its place. Notes stay readable.

![21.gifts welcome sunday](images/welcome-sunday.png)

### Variant: signed-out

No session. Heading **Welcome**, wordmark, **Log in**, no member menu. Each note still shows its bitcoin amount. The active list is the public page. An author name with `accountId` is the profile button. No composer.

![21.gifts welcome signed out](images/welcome-signed-out.png)

### Variant: mention

A post whose author is the member button contains `@ada`, and that mark is the same member button.

![21.gifts welcome mention](images/welcome-mention.png)

### Variant: mention-suggest

The post composer contains `@` and the People list is open, with `@ada` and `@adam`.

![21.gifts welcome mention suggestions](images/welcome-mention-suggest.png)

### Variant: mention-suggest-reply

A note is expanded, its reaction field contains `@`, and the People list is open.

![21.gifts welcome reply mention suggestions](images/welcome-mention-suggest-reply.png)

### Variant: mention-suggest-ask

Ask for money is on the text step, the message contains `@`, and the People list is open.

![21.gifts welcome ask mention suggestions](images/welcome-mention-suggest-ask.png)

### Variant: mention-inserted

Choosing `@ada` from that open list writes `@ada ` into the post composer and closes the list.

![21.gifts welcome mention inserted](images/welcome-mention-inserted.png)

### Variant: mention-inserted-reply

Choosing `@ada` from that open list writes `@ada ` into the reaction field and closes the list.

![21.gifts welcome reply mention inserted](images/welcome-mention-inserted-reply.png)

### Variant: mention-inserted-ask

Choosing `@ada` from that open list writes `@ada ` into the ask message and closes the list.

![21.gifts welcome ask mention inserted](images/welcome-mention-inserted-ask.png)

### Variant: laws

First visit: the dismissible living-room laws hint box is visible (two laws plus links to **Living room rules** and **Contact**). Idle screenshots after dismiss omit it.

![21.gifts welcome laws](images/welcome-laws.png)

### Variant: first-post-free

A member below verified who has never posted a top-level note (their About me note does not count) sees **Your first post is free.** (`forum.firstPostFree`) in muted text under the message composer in the writer, below Post. Post then creates the note directly, with no invoice and no pay sheet, and shows it as after a paid post: the feed switches to All and the composer clears. If the api no longer allows the free post (for example another first post got there first), the same Post opens the normal 1-sat posting fee instead. Verified members never see the line; they already post without a fee.

![21.gifts welcome first post free](images/welcome-first-post-free.png)

### Variant: moderation

A moderator sees an icon-only Delete post control in the note footer icon row with copy; confirming wraps to the next line. Other roles do not see it. The server independently checks the live role.

![21.gifts moderation](images/welcome-moderation.png)

### Variant: delete-confirm

Delete post opens an inline confirmation: Delete this post and its reactions from 21.gifts? Confirm deletion (check) and Cancel deletion (X) are icon-only controls. Cancel sends no request.

![21.gifts delete-confirm](images/welcome-delete-confirm.png)

### Variant: deleting

While DELETE is pending, confirmation and cancellation are disabled and a spinner replaces the check. Successful deletion removes the post; stale refresh payloads cannot restore it in this session.

![21.gifts deleting](images/welcome-deleting.png)

### Variant: delete-error

A failed deletion keeps the post and confirmation visible with an error and retry. Already missing posts (404) are removed from the local view.

![21.gifts delete-error](images/welcome-delete-error.png)

### Variant: reply-moderation

A moderator who expands a note sees an icon-only Delete reaction control on each nested reply. Ordinary members do not. Parent still has Delete post.
![21.gifts reply-moderation](images/welcome-reply-moderation.png)

### Variant: reply-delete-confirm

Delete reaction opens inline confirmation: Delete this reaction from 21.gifts? Confirm deletion (check) and Cancel deletion (X) are icon-only. Cancel sends no request. The parent post stays.

![21.gifts reply-delete-confirm](images/welcome-reply-delete-confirm.png)

### Variant: reply-deleting

While DELETE of the reply is pending, confirmation and cancellation on that reply are disabled and a spinner replaces the check.

![21.gifts reply-deleting](images/welcome-reply-deleting.png)

### Variant: reply-delete-error

A failed reply deletion keeps the reply and confirmation visible with `Could not delete the reaction. Please try again.` and retry.

![21.gifts reply-delete-error](images/welcome-reply-delete-error.png)

### Variant: all

Click **All** — Bob's unpaid note (`Does anyone have spare sats this week?`) is visible with Ada and Carol; list order newest-first (Ada, Carol, Bob).

![21.gifts welcome all](images/welcome-all.png)

### Variant: goal-50

On **All**: top-level Ada note with `sats: 10500` and `goalSats: 21000`. The ask is defined in bitcoin, so the bar shows **Ask ₿21'000 · $21.00** and the note amount **₿10'500 · $10.50** (viewer USD from the spot rate). Progress bar at **50%** (orange half-fill). A **Donation** tag sits beside the name. Pressing it explains that a donation is not paid back. The bar does not repeat that sentence. Composer **Send a post** / **Ask for money** pill visible. Gift still not on the post.

![21.gifts welcome goal 50](images/welcome-goal-50.png)

### Variant: goal-100

On **All**: top-level Ada note with `sats: 21000` and `goalSats: 21000`. The ask is defined in bitcoin, so the bar shows **Ask ₿21'000 · $21.00** and the note amount is the same pair. Full orange track, label **100%**, no green overflow.

![21.gifts welcome goal 100](images/welcome-goal-100.png)

### Variant: goal-110

On **All**: top-level Ada note with `sats: 23100` and `goalSats: 21000`. The ask is defined in bitcoin, so `ForumGoalBar` names **Ask ₿21'000 · $21.00** (the viewer's USD from the spot rate; this fixture stores no snapshot). The note amount is **₿23'100 · $23.10**. Full orange track plus green overflow (10% of track width past the right edge), label **110%**.

![21.gifts welcome goal 110](images/welcome-goal-110.png)

### Variant: goal-fiat

On **All**: a top-level English note defined as **$1.50**, with frozen **₿1'000** and no second dollar amount, because the viewer's currency is the definition currency. Label **0%**. The note matches the UI language, so the card does not offer Translate. The received amount is **₿0 · $0.00**.

![21.gifts welcome goal fiat](images/welcome-goal-fiat.png)

### Variant: goal-php

On **All**: a top-level English note defined as **₱200.00**, with frozen **₿1'000**. The viewer's default fiat is USD, not pesos, so the bar also shows the dollar amount stored for that viewer, **$1.50**. Label **0%**. The note matches the UI language, so the card does not offer Translate. The received amount is **₿0 · $0.00**.

![21.gifts welcome goal php](images/welcome-goal-php.png)

### Variant: goal-credit

On **All**: top-level Ada note with `sats: 10500`, `goalSats: 21000`, `goalRepayable: true`, and `goalTermDays: 30`. The ask is defined in bitcoin, so the bar shows **Ask ₿21'000 · $21.00** and the note amount **₿10'500 · $10.50**. A **Loan** tag beside the name explains the credit when pressed. Under the ask: **To repay per day: ₿700 · $0.70 per day for 30 days.** Progress bar at **50%**. The list of givers stays behind **Who gave and who is paid back**. Composer **Send a post** / **Ask for money** pill visible.

![21.gifts welcome goal credit](images/welcome-goal-credit.png)

### Variant: goal-credit-open

Same note as **goal-credit**, after **Who gave and who is paid back** is pressed. **Given** lists Bea @bea at ₿20. **Paid back** shows a chart from 27 Sep 2026 to 28 Sep 2026: a bar for each day's amount and a line for the debt, then each share is one bitcoin payment, 27 Sep 2026 with Bea's ₿10 **Due**, and 28 Sep 2026 with Bea's ₿10 **Scheduled**.

![21.gifts welcome goal credit open](images/welcome-goal-credit-open.png)

### Variant: loan-tag-open

Same note as **goal-credit**, after **Loan** is pressed. A line under the name says a loan is paid back and each giver gets back what they gave.

![21.gifts welcome loan tag open](images/welcome-loan-tag-open.png)

### Variant: donation-tag-open

On **All**: a top-level Ada note with `sats: 10500` and `goalSats: 21000`, after **Donation** is pressed. A line under the name says a donation is a gift and is not paid back.

![21.gifts welcome donation tag open](images/welcome-donation-tag-open.png)

### Variant: repay-today

On **All**: Ada's own filled credit (`accountId` matches the signed-in account, `sats` equals `goalSats`). **Pay today's repayment** is visible. The plan stays closed.

![21.gifts welcome repay today](images/welcome-repay-today.png)

### Variant: repay-today-error

Same funded credit note as **repay-today**, after **Pay today's repayment** is pressed. The POST failed, and the alert **The author's wallet cannot receive this Bitcoin payment** is visible. There is no invoice QR.

![21.gifts welcome repay today error](images/welcome-repay-today-error.png)

### Variant: repay-today-invoice

Same note as **repay-today**, after **Pay today's repayment** is pressed. The invoice card is open with the in-app wallet pay slot; in this build the wallet is not configured, so it says **Your 21.gifts wallet is not available here, so this cannot be paid.** No invoice QR. The amount form is not shown.

![21.gifts welcome repay today invoice](images/welcome-repay-today-invoice.png)

### Variant: repay-wallet-pay-preparing

Pinned fixture (`?visual=wallet-pay-preparing`, Playwright builds only, repayment invoice with a `sparkInvoice`). After **Pay today's repayment**, the repayment card (**Pay ₿700**) shows the in-app wallet slot, with no invoice QR: a spinner and **Checking your wallet…**.

![21.gifts welcome repay wallet pay preparing](images/welcome-repay-wallet-pay-preparing.png)

### Variant: repay-wallet-pay-confirm

Pinned fixture (`?visual=wallet-pay-confirm`, Playwright builds only, repayment invoice with a `sparkInvoice`). After **Pay today's repayment**, the repayment card (**Pay ₿700**) shows the in-app wallet slot, with no invoice QR: **Send**, and no fee row for the quoted fee of ₿0.

![21.gifts welcome repay wallet pay confirm](images/welcome-repay-wallet-pay-confirm.png)

### Variant: repay-wallet-pay-paying

Pinned fixture (`?visual=wallet-pay-paying`, Playwright builds only, repayment invoice with a `sparkInvoice`). After **Pay today's repayment**, the repayment card (**Pay ₿700**) shows the in-app wallet slot, with no invoice QR: a spinner and **Paying from your wallet…**.

![21.gifts welcome repay wallet pay paying](images/welcome-repay-wallet-pay-paying.png)

### Variant: repay-wallet-pay-insufficient

Pinned fixture (`?visual=wallet-pay-insufficient`, Playwright builds only, repayment invoice with a `sparkInvoice`). After **Pay today's repayment**, the repayment card (**Pay ₿700**) shows the in-app wallet slot, with no invoice QR: the alert that the wallet lacks Bitcoin, then **Still missing:** with the amount plus the known fee minus the balance in ₿ and fiat (the pin shows the full amount), then the member's own 21.gifts address and its Open CryptoPay QR.

![21.gifts welcome repay wallet pay insufficient](images/welcome-repay-wallet-pay-insufficient.png)

### Variant: repay-wallet-pay-unconfirmed

Pinned fixture (`?visual=wallet-pay-unconfirmed`, Playwright builds only, repayment invoice with a `sparkInvoice`). After **Pay today's repayment**, the repayment card (**Pay ₿700**) shows the in-app wallet slot, with no invoice QR: the neutral not-confirmed-yet sentence.

![21.gifts welcome repay wallet pay unconfirmed](images/welcome-repay-wallet-pay-unconfirmed.png)

### Variant: ask-credit-amount

Credit, step **1 of 9**. **Ask for money** is selected. **Credit** is pressed under **One-time** / **Daily** (**One-time** pressed). The heading is **How much?** **21000** is typed in bitcoin, with the preferred-fiat counterpart under the field. **Continue** is enabled. There is no checkbox and no **Post** on this step. Choosing **Donation** leaves this path and returns to the four-step ask.

![21.gifts welcome ask credit amount](images/welcome-ask-credit-amount.png)

### Variant: ask-credit-amount-fiat

Credit, step **1 of 9**, with the amount switch on **USD**. **Credit** and **One-time** are pressed. **1000** was typed in bitcoin, then the switch moved to fiat, so the field shows **1.00** and **₿1'000** under it. **Continue** is enabled.

![21.gifts welcome ask credit amount fiat](images/welcome-ask-credit-amount-fiat.png)

### Variant: ask-credit-amount-daily

Credit, step **1 of 9**, with **Daily** pressed and **Credit** pressed. **21000** is typed in bitcoin. **Continue** is enabled. One-time / Daily is still not stored.

![21.gifts welcome ask credit amount daily](images/welcome-ask-credit-amount-daily.png)

### Variant: ask-credit-empty

Credit, step **1 of 9**, before an amount is typed. **Credit** and **One-time** are pressed. The ask field is empty and **Continue** is disabled. The counter reads **1 of 9**, not 1 of 4.

![21.gifts welcome ask credit empty](images/welcome-ask-credit-empty.png)

### Variant: ask-credit-empty-daily

Credit, step **1 of 9**, with **Daily** and **Credit** pressed and the ask field still empty. **Continue** is disabled. The counter reads **1 of 9**. One-time / Daily is still not stored.

![21.gifts welcome ask credit empty daily](images/welcome-ask-credit-empty-daily.png)

### Variant: ask-credit-error-ask

Credit, step **1 of 9**, with **0** typed in bitcoin. **Credit** and **One-time** are pressed. **Continue** stays disabled. The counter reads **1 of 9**.

![21.gifts welcome ask credit error ask](images/welcome-ask-credit-error-ask.png)

### Variant: ask-credit-error-ask-daily

Credit, step **1 of 9**, with **Daily** and **Credit** pressed and **0** typed. **Continue** stays disabled. The counter reads **1 of 9**.

![21.gifts welcome ask credit error ask daily](images/welcome-ask-credit-error-ask-daily.png)

### Variant: ask-credit-currency-btc

Credit, step **2 of 9**. Heading **How the amount is fixed**. The screen says: **This credit is fixed in bitcoin. Payments stay in bitcoin, with no conversion.** Then: **A rising bitcoin price can hurt you significantly, because you bear the full price movement.** The button is **Continue**. There is no checkbox.

![21.gifts welcome ask credit currency btc](images/welcome-ask-credit-currency-btc.png)

### Variant: ask-credit-currency-fiat

Credit, step **2 of 9**, after the amount switch is **USD** and **1000** is typed. Heading **How the amount is fixed**. The screen says: **This credit is fixed in US dollars. Payments are bitcoin and stay bitcoin. Each payment is only priced in US dollars at the rate when it is made. Nothing is exchanged.** Then: **You receive the amount in bitcoin. If the bitcoin price falls before you spend it on what you planned, you bear the full price risk.** The button is **Continue**. Swiss francs, euros, and Philippine pesos use the same sentences with that currency name. There is no checkbox.

![21.gifts welcome ask credit currency fiat](images/welcome-ask-credit-currency-fiat.png)

### Variant: ask-credit-term

Credit, step **3 of 9**. Heading **How long is the credit repaid?** The choices are **30 days** (pressed), **1 year**, **2 years**, and **Custom**. **Continue** is enabled. There is no checkbox.

![21.gifts welcome ask credit term](images/welcome-ask-credit-term.png)

### Variant: ask-credit-term-custom

Credit, step **3 of 9**, with **Custom** pressed. Heading **How long is the credit repaid?** A field **Number of days** shows **45**, so **Continue** is enabled. **Continue** stays disabled while that field is empty or not a whole number from 1 to 3650.

![21.gifts welcome ask credit term custom](images/welcome-ask-credit-term-custom.png)

### Variant: ask-credit-plan-btc

Credit, step **4 of 9**, for **21000** bitcoin over **30 days**. Heading **How repayment works**. The screen says: **Repayment is due every day. It starts the day after the credit has been paid in full. If it takes 10 days for the credit to be given, repayment starts on day 11.** Then: **To repay per day: ₿700 · $0.70 per day for 30 days.** A chart draws each day as a bar and the debt as a line from day 1 down to the last day. The button is **Continue**. Any remainder that does not divide evenly is added to the last day. There is no checkbox.

![21.gifts welcome ask credit plan btc](images/welcome-ask-credit-plan-btc.png)

### Variant: ask-credit-plan-fiat

Credit, step **4 of 9**, for **1000** US dollars over **30 days**. Same heading and the same daily rule. The daily line is **To repay per day: $33.33 per day for 29 days, then $33.43 on the last day.** The same chart shows the daily bars and the debt falling from day 1 to the last day. The button is **Continue**.

![21.gifts welcome ask credit plan fiat](images/welcome-ask-credit-plan-fiat.png)

### Variant: ask-credit-confirm-want

Credit, step **5 of 9**, bitcoin. Heading **Take this credit**. The screen repeats every condition: **Amount owed: ₿21'000 · $21.00.** The bitcoin definition and the rising-price warning. **Repayment term: 30 days.** The daily rule with the day-11 example. **To repay per day: ₿700 · $0.70 per day for 30 days.** The chart is repeated. The button **I want to take this credit.** is the confirmation. There is no checkbox.

![21.gifts welcome ask credit confirm want](images/welcome-ask-credit-confirm-want.png)

### Variant: ask-credit-confirm-want-fiat

Credit, step **5 of 9**, US dollars. Heading **Take this credit**. The screen repeats every condition: **Amount owed: $1'000.00.** The sentence that payments stay bitcoin and are only priced in US dollars at the rate of each payment, and that nothing is exchanged. The sentence that the author receives the amount in bitcoin and bears the full price risk if the price falls before they spend it. **Repayment term: 30 days.** The daily rule and **To repay per day: $33.33 per day for 29 days, then $33.43 on the last day.** The chart is repeated. The button **I want to take this credit.** is the confirmation. There is no checkbox.

![21.gifts welcome ask credit confirm want fiat](images/welcome-ask-credit-confirm-want-fiat.png)

### Variant: ask-credit-confirm-can-btc

Credit, step **6 of 9**, bitcoin. Heading **Can you repay it?** The sentence is **I can repay the amount owed on this plan: ₿700 · $0.70 per day for 30 days.** The button **I can repay this.** is the confirmation. There is no checkbox.

![21.gifts welcome ask credit confirm can btc](images/welcome-ask-credit-confirm-can-btc.png)

### Variant: ask-credit-confirm-can-fiat

Credit, step **6 of 9**, US dollars. Heading **Can you repay it?** The sentence is **I can repay the amount owed on this plan: $33.33 per day for 29 days, then $33.43 on the last day.** The button **I can repay this.** is the confirmation. There is no checkbox.

![21.gifts welcome ask credit confirm can fiat](images/welcome-ask-credit-confirm-can-fiat.png)

### Variant: ask-credit-photos

Credit, step **7 of 9**. Heading **Add photos**. The One-time / Daily and Donation / Credit pills are not on this step. A photo is optional. **Continue** goes to the message. The counter reads **7 of 9**.

![21.gifts welcome ask credit photos](images/welcome-ask-credit-photos.png)

### Variant: ask-credit-text

Credit, step **8 of 9**. Heading **Write a message**. The message can be empty; **Continue** still opens the preview. **Post** on the next step stays disabled until there is text, a photo, or a video. The counter reads **8 of 9**.

![21.gifts welcome ask credit text](images/welcome-ask-credit-text.png)

### Variant: ask-credit-preview

Credit, step **9 of 9**, bitcoin, after the message **Need help with a train ticket**. Heading **Preview**. **One-time** and **Credit** are pressed. The card shows the author, the message, and the goal bar at **0%**: **Ask ₿21'000 · $21.00**, a **Loan** tag, and **To repay per day: ₿700 · $0.70 per day for 30 days.** **Post** is the only submit. It sends `goalRepayable: true` and `goalTermDays: 30` with the ask amount. The counter reads **9 of 9**.

![21.gifts welcome ask credit preview](images/welcome-ask-credit-preview.png)

### Variant: ask-credit-preview-loan-open

Same preview as **ask-credit-preview**, after the **Loan** tag is pressed. Its explanation is visible (`role="status"`).

![21.gifts welcome ask credit preview loan open](images/welcome-ask-credit-preview-loan-open.png)

### Variant: ask-credit-preview-daily

Credit, step **9 of 9**, with **Daily** and **Credit** pressed, after the same bitcoin ask and message. The preview shows a **Loan** tag and the daily bitcoin plan with the visitor's fiat. **Post** is the only submit. One-time / Daily is not stored.

![21.gifts welcome ask credit preview daily](images/welcome-ask-credit-preview-daily.png)

### Variant: ask-credit-preview-fiat

Credit, step **9 of 9**, after a **1000** US-dollar ask and the same message. **Credit** is pressed. The preview shows a **Loan** tag, the dollar amount, and the daily dollar plan (**$33.33** for 29 days, then **$33.43** on the last day). **Post** is the only submit. The counter reads **9 of 9**.

![21.gifts welcome ask credit preview fiat](images/welcome-ask-credit-preview-fiat.png)

### Variant: ask-credit-posting

Credit, step **9 of 9**, while **Post** is in flight. The preview still shows the bitcoin credit (a **Loan** tag, **₿700 · $0.70 per day for 30 days**). **Post** is disabled and a spinner replaces the label. The counter reads **9 of 9**.

![21.gifts welcome ask credit posting](images/welcome-ask-credit-posting.png)

### Variant: ask-credit-posting-daily

Credit, step **9 of 9**, with **Daily** pressed, while **Post** is in flight. The goal bar still shows the repayment plan. **Post** is disabled. One-time / Daily is not stored. The counter reads **9 of 9**.

![21.gifts welcome ask credit posting daily](images/welcome-ask-credit-posting-daily.png)

### Variant: ask-credit-error-request

Credit, step **9 of 9**, after **Post** fails. The preview stays, with **Could not post your message** under it. **Credit** stays pressed. The counter reads **9 of 9**.

![21.gifts welcome ask credit error request](images/welcome-ask-credit-error-request.png)

### Variant: ask-credit-error-request-daily

Credit, step **9 of 9**, with **Daily** pressed, after **Post** fails. The same error stays on the credit preview. **Daily** and **Credit** stay pressed. The counter reads **9 of 9**.

![21.gifts welcome ask credit error request daily](images/welcome-ask-credit-error-request-daily.png)

### Variant: ask-amount

**Ask for money** selected. Step 1 of 4: **How much?** with the **One-time** / **Daily** pill above the amount (**One-time** pressed), a **Donation** / **Credit** pill under it (**Donation** pressed by default), and **1000** typed in bitcoin so the preferred-fiat counterpart (**$1.00**) shows under the field. Continue is enabled. No Post submit on this step. Only **Credit** is posted as `goalRepayable` true.

![21.gifts welcome ask amount](images/welcome-ask-amount.png)

### Variant: ask-amount-fiat

**Ask for money** selected. Step 1 of 4 with **One-time** pressed and the amount switch on **USD**. **1000** was typed in bitcoin, then the switch moved to fiat, so the field shows **1.00** and **₿1'000** under it. Continue is enabled.

![21.gifts welcome ask amount fiat](images/welcome-ask-amount-fiat.png)

### Variant: ask-daily

**Ask for money** selected. Step 1 of 4 with **Daily** pressed on the pill above the amount and **1000** typed in bitcoin so **$1.00** shows under the field. Continue is enabled.

![21.gifts welcome ask daily](images/welcome-ask-daily.png)

### Variant: ask-empty

**Ask for money** just opened. Step 1 of 4, **One-time** pressed, amount empty, **Continue** disabled. No bitcoin line yet.

![21.gifts welcome ask empty](images/welcome-ask-empty.png)

### Variant: ask-empty-daily

**Ask for money** just opened. Step 1 of 4, **Daily** pressed, amount empty, **Continue** disabled.

![21.gifts welcome ask empty daily](images/welcome-ask-empty-daily.png)

### Variant: ask-photos

Ask step 2 of 4: **Add photos** with attach and Continue. Photos are optional.

![21.gifts welcome ask photos](images/welcome-ask-photos.png)

### Variant: ask-one-photo

Ask step 2 of 4 with one selected photo and **Remove photo**. **Continue** stays enabled.

![21.gifts welcome ask one photo](images/welcome-ask-one-photo.png)

### Variant: ask-several-photos

Ask step 2 of 4 with two selected photos. Each has **Remove photo**.

![21.gifts welcome ask several photos](images/welcome-ask-several-photos.png)

### Variant: ask-video

Ask step 2 of 4 with a selected video and **Remove video**.

![21.gifts welcome ask video](images/welcome-ask-video.png)

### Variant: ask-preparing

Ask step 2 of 4 while the photo is still preparing. No thumbnail yet. **Continue** stays disabled.

![21.gifts welcome ask preparing](images/welcome-ask-preparing.png)

### Variant: ask-unsupported

Ask step 2 of 4 after a file that is not a JPEG, PNG, WebP, MP4, WebM, or MOV. The error sits under the step. No thumbnail.

![21.gifts welcome ask unsupported](images/welcome-ask-unsupported.png)

### Variant: ask-too-large

Ask step 2 of 4 after a photo over 1 MB. The error sits under the step. No thumbnail.

![21.gifts welcome ask too large](images/welcome-ask-too-large.png)

### Variant: ask-too-many

Ask step 2 of 4 after more than 10 photos. The first ten thumbnails stay, and **You can add up to 10 photos** sits under them.

![21.gifts welcome ask too many](images/welcome-ask-too-many.png)

### Variant: ask-text

Ask step 3 of 4: **Write a message** textarea and Continue.

![21.gifts welcome ask text](images/welcome-ask-text.png)

### Variant: ask-text-filled

Ask step 3 of 4 with **Need help with a train ticket** typed in the message field. **Continue** stays enabled.

![21.gifts welcome ask text filled](images/welcome-ask-text-filled.png)

### Variant: ask-preview

Ask step 4 of 4: the **One-time** / **Daily** pill (**One-time** pressed), the **Donation** / **Credit** pill under it (**Donation** pressed by default), then a preview card with photo, caption, a **Donation** tag, `ForumGoalBar` at 0 collected versus **₿1'000** (fiat **$1.00**), labeled **Post**. This is the only Ask submit. The step label **4 of 4** sits on the right of the **Preview** heading. Only **Credit** is posted as `goalRepayable` true.

![21.gifts welcome ask preview](images/welcome-ask-preview.png)

### Variant: ask-preview-donation-open

Same preview as **ask-preview**, after the **Donation** tag on the card is pressed. Its explanation is visible (`role="status"`).

![21.gifts welcome ask preview donation open](images/welcome-ask-preview-donation-open.png)

### Variant: ask-preview-fiat

Ask step 4 of 4 after the amount was defined in USD. The preview shows **$1.00 · ₿1'000**, not bitcoin first. **Post** is the only submit.

![21.gifts welcome ask preview fiat](images/welcome-ask-preview-fiat.png)

### Variant: ask-preview-daily

Ask step 4 of 4 with **Daily** pressed, the same photo, caption, and goal bar as the one-time preview.

![21.gifts welcome ask preview daily](images/welcome-ask-preview-daily.png)

### Variant: ask-preview-text

Ask step 4 of 4, **One-time** pressed, caption only. No photo. **Post** is enabled.

![21.gifts welcome ask preview text](images/welcome-ask-preview-text.png)

### Variant: ask-preview-text-daily

Ask step 4 of 4, **Daily** pressed, caption only.

![21.gifts welcome ask preview text daily](images/welcome-ask-preview-text-daily.png)

### Variant: ask-preview-one-photo

Ask step 4 of 4, **One-time** pressed, one photo and no caption. **Post** is enabled.

![21.gifts welcome ask preview one photo](images/welcome-ask-preview-one-photo.png)

### Variant: ask-preview-one-photo-daily

Ask step 4 of 4, **Daily** pressed, one photo and no caption.

![21.gifts welcome ask preview one photo daily](images/welcome-ask-preview-one-photo-daily.png)

### Variant: ask-preview-several

Ask step 4 of 4, **One-time** pressed, two photos and no caption.

![21.gifts welcome ask preview several](images/welcome-ask-preview-several.png)

### Variant: ask-preview-several-daily

Ask step 4 of 4, **Daily** pressed, two photos and no caption.

![21.gifts welcome ask preview several daily](images/welcome-ask-preview-several-daily.png)

### Variant: ask-preview-several-text

Ask step 4 of 4, **One-time** pressed, two photos and the caption **Need help with a train ticket**.

![21.gifts welcome ask preview several text](images/welcome-ask-preview-several-text.png)

### Variant: ask-preview-several-text-daily

Ask step 4 of 4, **Daily** pressed, two photos and the caption.

![21.gifts welcome ask preview several text daily](images/welcome-ask-preview-several-text-daily.png)

### Variant: ask-preview-video

Ask step 4 of 4, **One-time** pressed, a video and no caption.

![21.gifts welcome ask preview video](images/welcome-ask-preview-video.png)

### Variant: ask-preview-video-daily

Ask step 4 of 4, **Daily** pressed, a video and no caption.

![21.gifts welcome ask preview video daily](images/welcome-ask-preview-video-daily.png)

### Variant: ask-preview-video-text

Ask step 4 of 4, **One-time** pressed, a video and the caption **Need help with a train ticket**.

![21.gifts welcome ask preview video text](images/welcome-ask-preview-video-text.png)

### Variant: ask-preview-video-text-daily

Ask step 4 of 4, **Daily** pressed, a video and the caption.

![21.gifts welcome ask preview video text daily](images/welcome-ask-preview-video-text-daily.png)

### Variant: ask-posting

Ask step 4 of 4, **One-time** pressed, while **Post** is in flight. The button stays disabled.

![21.gifts welcome ask posting](images/welcome-ask-posting.png)

### Variant: ask-posting-daily

Ask step 4 of 4, **Daily** pressed, while **Post** is in flight.

![21.gifts welcome ask posting daily](images/welcome-ask-posting-daily.png)

### Variant: ask-error-request

Ask step 4 of 4, **One-time** pressed, after the post fails. **Could not post your message** sits under the preview.

![21.gifts welcome ask error request](images/welcome-ask-error-request.png)

### Variant: ask-error-request-daily

Ask step 4 of 4, **Daily** pressed, after the post fails.

![21.gifts welcome ask error request daily](images/welcome-ask-error-request-daily.png)

### Variant: ask-open

**All**, not Active. Dana's zero-sat **Ask for money** is defined in bitcoin, so the bar shows **₿1'000 · $1.00** (viewer USD from the spot rate; this fixture stores no snapshot), photo + caption, `ForumGoalBar` at 0%. A zero-sat ask is absent from Active, so this shot opens **All**.

![21.gifts welcome ask open](images/welcome-ask-open.png)

### Variant: filter-open

The forum view dropdown is open on the default Active feed. **Active** is checked. **No gifts yet**, **All**, and **Most popular** are listed under it. The list stays open.

![21.gifts welcome filter open](images/welcome-filter-open.png)

### Variant: unpaid

Click **No gifts yet** (German: **Noch ohne Geschenk**) — only loaded notes with exactly zero sats appear. Bob is visible; paid Ada and Carol are hidden. This includes notes without a receiving wallet. The four filters are a dropdown; Active is shown closed; open it and choose **No gifts yet**. Active remains the default.

![21.gifts welcome without gifts](images/welcome-unpaid.png)

### Variant: unpaid-new-count

Active is shown closed; last-visit stamp older than Bob's unpaid note; the count chip `1` sits on that closed control.

![21.gifts welcome unpaid new count](images/welcome-unpaid-new-count.png)

### Variant: empty-unpaid

No zero-sat notes remain in the loaded list. **Every loaded message has already received Bitcoin.** appears; the filters and the **+** remain available. An entirely empty forum still uses the general empty state.

![21.gifts welcome no remaining zero-sat notes](images/welcome-empty-unpaid.png)

### Variant: popular

Click **Most popular** — paid notes ordered by sats (Carol ₿21, then Ada ₿5). Unpaid Bob is hidden.

![21.gifts welcome popular](images/welcome-popular.png)

### Variant: empty-paid

Copy **No message has received Bitcoin yet.** Active selected, unpaid notes hidden, the **+** visible (no composer on the page).

![21.gifts welcome empty paid](images/welcome-empty-paid.png)

### Variant: empty

Empty copy **No messages yet — be the first to write one.** plus the **+** (no composer on the page; the **Send a post** / **Ask for money** pill, attach, textarea and Post are in the writer).

![21.gifts welcome empty](images/welcome-empty.png)

### Variant: loading

Loading copy **Loading…** while the messages fetch is in flight.

![21.gifts welcome loading](images/welcome-loading.png)

### Variant: error

Load error **Could not load messages. Please try again.** plus **Try again**. Shown only when the page itself cannot be read (a failed request or an invalid envelope). One note that cannot be shown, such as an empty About me note, is left out of the list and does not cause this error in any mode.

![21.gifts welcome error](images/welcome-error.png)

### Variant: validation-error

Click **Post** with an empty composer and no photo or video → **Enter a message or add a photo or video**. The composer caps at 8000 characters (same as `POST /forum/messages`); over-length drafts show **Keep it to 8000 characters** and are not sent.

![21.gifts welcome validation error](images/welcome-validation-error.png)

### Variant: error-ask

**Ask for money**, with **One-time** pressed on the pill above the amount, type **0**: **Continue** stays disabled (the field is numeric; 0 is not a whole-sat ask).

![21.gifts welcome ask error](images/welcome-error-ask.png)

### Variant: error-ask-daily

**Ask for money**, with **Daily** pressed on the pill above the amount, type **0**: **Continue** stays disabled.

![21.gifts welcome ask daily error](images/welcome-error-ask-daily.png)

### Variant: expanded

On **All**, click **Show reactions** on a note — the note's ₿ amount and the reaction-count text also expand — card expands (`aria-expanded`), replies list loads via `fetchReplies`, and the in-card reply composer shows **Write a reaction** plus an **Amount** sats field. Gift-only replies render as **send ₿…** plus the same optional preferred-fiat `·` as notes (a stored string as-is, the spot rate when that stored field is null or missing); a reply with text and a gift shows both. Reply authors show the same Founder / Moderator / Initiator / Verified pills as notes (`basis` has none); clicking a pill toggles the same short explanation. Empty reply text and an empty amount invoices 21 sats (pay-sheet default) and opens the pay sheet; a reply with text and an empty amount is unpaid for a verified member, otherwise 1 sat to 21.gifts; an amount of 0 is billed as 1 sat.

![21.gifts welcome expanded](images/welcome-expanded.png)

### Variant: expanded-gifts

On **All**, expand Ada's note. The thread shows a gift-only reply (**send ₿21**) and a text reply with the gift amount under the body. The in-card composer still has **Write a reaction** and **Amount**.

![21.gifts welcome expanded gifts](images/welcome-expanded-gifts.png)

### Variant: expanded-received

On **All**, expand Ada's note. Cyrill's reply **You got it right.** shows two lines under a left rule: **sent ₿21'000 · $18.14** and **received ₿100 · $0.09**. The note footer is **₿21'000 · $18.14**, the same gift as the sent line, not a second payment. The later **₿100** is not added to either figure.

![21.gifts welcome expanded received](images/welcome-expanded-received.png)

### Variant: expanded-donated

Expand Ada's note. Cyrill's reply has no text. It shows **send ₿21'000 · $18.14** and no received line. The note footer is **₿21'000 · $18.14**, the same gift, not a second payment. Nothing on this reply is added into ₿21'100.

![21.gifts welcome expanded donated](images/welcome-expanded-donated.png)

### Variant: expanded-text

Expand Ada's note. Cyrill's reply is the sentence **You got it right.** It sent nothing and received nothing, so no amount line sits under the sentence. The note footer is **₿0**, because this reply did not add a gift. Ada stays on the feed because she is a moderator.

![21.gifts welcome expanded text](images/welcome-expanded-text.png)

### Variant: expanded-received-only

Expand Ada's note. Cyrill's reply **You got it right.** sent nothing. Under the sentence is only **received ₿100 · $0.09**. That 100 is not the note total. The note footer stays **₿0**.

![21.gifts welcome expanded received only](images/welcome-expanded-received-only.png)

### Variant: expanded-external

On **All**, expand Ada's note. The thread shows two replies from **Robin**, who has no 21.gifts account: a gift-only reply (**send ₿69**) and a text reply containing `https://example.com/hello`. Each author line shows an **External** button next to the name (same slot as a role pill); clicking it opens a short hint that the person wrote from another app, not from a 21.gifts account, and is shown because they sent bitcoin to a post. The name itself is a **View profile** button that opens `/messages/<id>/author`. This shot stays on the thread. The URL is visible as plain text — not a clickable link, no autolink, no quoted-note embed.

![21.gifts welcome expanded external](images/welcome-expanded-external.png)

### Variant: reaction-draft

On **Active**, expand Bob's note. Ada, a basis member, has typed **21** in **Amount** (the line under it shows **$0.02**) and **This is my answer** in **Your reaction**. Bob's note and the existing **21.gifts** reply stay on screen. **Post** is still enabled.

![21.gifts welcome reaction draft](images/welcome-reaction-draft.png)

### Variant: reaction-submitting

Same draft, with the payment request still in flight. The reply **Post** control is disabled and shows its spinner. The typed sentence and **21** stay in the fields.

![21.gifts welcome reaction submitting](images/welcome-reaction-submitting.png)

### Variant: reaction-pay

The invoice has been minted. The pay page stands where the reply field was. The note stays in the window. The page previews **This is my answer**. The reply field is gone.

![21.gifts welcome reaction pay](images/welcome-reaction-pay.png)

### Variant: reaction-pay-sheet

The same page, scrolled so **Close** (`X`), **Pay ₿21**, the in-app wallet pay slot (here **Your 21.gifts wallet is not available here, so this cannot be paid.**), and **Waiting for payment…** are in the window. No invoice QR on any device. The preview is on that page. Close stays on this view and is not the top-left back arrow.

![21.gifts welcome reaction pay sheet](images/welcome-reaction-pay-sheet.png)

### Variant: reaction-wallet-pay-preparing

Pinned fixture (`?visual=wallet-pay-preparing`, Playwright builds only, invoice with a `sparkInvoice`). The paid-reaction pay page shows the in-app wallet slot, with no invoice QR: a spinner and **Checking your wallet…**.

![21.gifts welcome reaction wallet pay preparing](images/welcome-reaction-wallet-pay-preparing.png)

### Variant: reaction-wallet-pay-confirm

Pinned fixture (`?visual=wallet-pay-confirm`, Playwright builds only, invoice with a `sparkInvoice`). The paid-reaction pay page shows the in-app wallet slot, with no invoice QR: **Send**, and no fee row for the quoted fee of ₿0.

![21.gifts welcome reaction wallet pay confirm](images/welcome-reaction-wallet-pay-confirm.png)

### Variant: reaction-wallet-pay-paying

Pinned fixture (`?visual=wallet-pay-paying`, Playwright builds only, invoice with a `sparkInvoice`). The paid-reaction pay page shows the in-app wallet slot, with no invoice QR: a spinner and **Paying from your wallet…**, with **Waiting for payment…** under it.

![21.gifts welcome reaction wallet pay paying](images/welcome-reaction-wallet-pay-paying.png)

### Variant: reaction-wallet-pay-insufficient

Pinned fixture (`?visual=wallet-pay-insufficient`, Playwright builds only, invoice with a `sparkInvoice`). The paid-reaction pay page shows the in-app wallet slot, with no invoice QR: the alert that the wallet lacks Bitcoin, then **Still missing:** with the amount plus the known fee minus the balance in ₿ and fiat (the pin shows the full amount), then the member's own 21.gifts address and its Open CryptoPay QR.

![21.gifts welcome reaction wallet pay insufficient](images/welcome-reaction-wallet-pay-insufficient.png)

### Variant: reaction-wallet-pay-unconfirmed

Pinned fixture (`?visual=wallet-pay-unconfirmed`, Playwright builds only, invoice with a `sparkInvoice`). The paid-reaction pay page shows the in-app wallet slot, with no invoice QR: the neutral not-confirmed-yet sentence.

![21.gifts welcome reaction wallet pay unconfirmed](images/welcome-reaction-wallet-pay-unconfirmed.png)

### Variant: reaction-pay-kept

The same page. The sentence is a preview, not a disabled **Your reaction** field, and there is no **Amount** field.

![21.gifts welcome reaction pay kept](images/welcome-reaction-pay-kept.png)

### Variant: reaction-error

The payment request failed. The alert says **Could not post your message**. The typed sentence is still in the field, and no pay sheet is open.

![21.gifts welcome reaction error](images/welcome-reaction-error.png)

### Variant: reaction-deleted

The payment request failed because the note was deleted. The alert says **This note was deleted.**, the typed sentence is still in the field, and no pay sheet is open.

![21.gifts welcome reaction deleted](images/welcome-reaction-deleted.png)

### Variant: reaction-rate-limit

The payment request was rate-limited. The alert says **Too many messages. Please wait a moment and try again.** The typed sentence is still in the field.

![21.gifts welcome reaction rate limit](images/welcome-reaction-rate-limit.png)

### Variant: reaction-author-wallet

The payment request failed because Bob's wallet cannot receive it (the api answers with `code` `cannot_receive`). The alert says **The author's wallet cannot receive this Bitcoin payment**. The typed sentence is still in the field, and no pay sheet is open.

![21.gifts welcome reaction author wallet](images/welcome-reaction-author-wallet.png)

### Variant: reaction-paid

The payment was detected. Ada's reply **This is my answer** is in the thread, and the composer is empty again.

![21.gifts welcome reaction paid](images/welcome-reaction-paid.png)

### Variant: quoted-note

Signed-in founder Cyrill, living-room laws dismissed, Active. Only Riana Rosello's paid 21-sat verified note is in the list; the card is expanded. Cyrill's reply shows `just for information:` and a nested technical-note post (photo, caption starting **A Quick Technical Note**, Founder pill, ₿43). The raw `https://21.gifts/messages/d8cd22dd-d5c4-46a8-82ed-38b4d2f551ec` URL is not visible.

![21.gifts welcome quoted note](images/welcome-quoted-note.png)

### Variant: copy

Click **Copy link to this note** — control sets `data-copied` after writing `origin /l/<8 hex>` (first group of that note id) to the clipboard.

![21.gifts welcome copy](images/welcome-copy.png)

### Variant: reply-copy

Signed-in `/welcome` on the default filter; expand Ada's note to show its reply.

- **Trigger:** Click **Copy link to this reply** on a nested reply.
- **Result:** The control sets `data-copied` on that reply's own button after writing the reply's own `origin /l/<8 hex>` (first group of that reply id) permalink to the clipboard — the note's own copy button is unaffected.
- **Scope:** Every reply row has this control regardless of whether Gift or moderator delete are also visible on that row.

![21.gifts welcome reply copy](images/welcome-reply-copy.png)

### Variant: translate

Signed-in `/welcome` with one paid German note. **Translate** is visible in the footer icon row with react / copy. English notes on other fixtures still hide it.

![21.gifts welcome translate](images/welcome-translate.png)

### Variant: translate-loading

Same German note after clicking **Translate** while POST `/translate` hangs. The control is busy (`aria-busy`) with a spinner.

![21.gifts welcome translate loading](images/welcome-translate-loading.png)

### Variant: translate-done

Same German note after a successful translation. Translated body plus **Show original**; the German original is not shown.

![21.gifts welcome translate done](images/welcome-translate-done.png)

### Variant: translate-hidden

After **Show original**: translated body hidden, the Languages icon is named **Show translation** and has no visible text.

![21.gifts welcome translate hidden](images/welcome-translate-hidden.png)

### Variant: translate-error

Same German note after POST /translate fails. Alert **Could not translate this note. Please try again.** and the Translate control remains.

![21.gifts welcome translate error](images/welcome-translate-error.png)

### Variant: heart-needs-balance

Same signed-in German note after stubbing POST /messages/*/invoice to 400 `wallet_required` and clicking Send ₿1. Copy **A Bitcoin balance is required for this.**

![21.gifts welcome heart needs balance](images/welcome-heart-needs-balance.png)

### Variant: heart-paid

Same signed-in German note after opening `?visual=heart-paid` and clicking Send ₿1. The paid mark **+1** is visible.

![21.gifts welcome heart paid](images/welcome-heart-paid.png)

### Variant: heart-unavailable

Same signed-in German note after stubbing POST /messages/*/invoice to 503 `HEART_UNAVAILABLE` and clicking Send ₿1. Nothing is sent; the heart stays empty. Copy **Hearts are not available right now.**

![21.gifts welcome heart unavailable](images/welcome-heart-unavailable.png)

### Variant: heart-pending

Same signed-in German note after opening `?visual=heart-pending` and clicking Send ₿1: the send timed out and its outcome is not known yet. The heart stays filled, no **+1**, and another tap on this note does not pay. Copy **Your last heart is still on its way. Try again in a moment.**

![21.gifts welcome heart pending](images/welcome-heart-pending.png)

### Variant: note-truncated

Signed-in `/welcome` with one paid note whose body is longer than 560 characters. Collapsed 280-character preview, ellipsis, and **Show more** are visible; the distinctive tail is hidden.

![21.gifts welcome note truncated](images/welcome-note-truncated.png)

### Variant: note-whole

Signed-in `/welcome` with one paid note longer than the 280-character preview and at most 560 characters. The whole body is visible, including the distinctive tail. **Show more** is absent.

![21.gifts welcome note whole](images/welcome-note-whole.png)

### Variant: note-video-paused

Signed-in /welcome with one note whose text is **A clip** and whose picture is a video. The play button and the fullscreen button sit on that picture. The picture is centered.

![21.gifts welcome note video paused](images/welcome-note-video-paused.png)

### Variant: note-video-playing

Same note after **Play**. The play button is gone. The fullscreen button stays on the picture.

![21.gifts welcome note video playing](images/welcome-note-video-playing.png)

### Variant: translate-long-loading

Signed-in `/welcome` with one paid German note longer than 560 characters. After clicking **Translate** while POST `/translate` hangs, the original body is fully visible, including its tail, **Show more** is gone, and the control is busy.

![21.gifts welcome translate long loading](images/welcome-translate-long-loading.png)

### Variant: translate-long-done

Same long German note after a successful translation. The translated body is fully visible, including its tail. **Show more** is absent. The Languages icon is named **Show original**.

![21.gifts welcome translate long done](images/welcome-translate-long-done.png)

### Variant: new-posts

Visitor is scrolled down the forum list. A silent refresh found a newer note id. Labeled **New posts** pill is visible; the new note text is not yet in the list.

![21.gifts welcome new posts](images/welcome-new-posts.png)

### Variant: moderator-appointed

Signed-in member with an unread `moderator_appointed` notification. Labeled **You are a moderator** pill is visible under the frame header. Idle screenshots omit the pill. When **New posts** is also shown, this pill stays at `top-2` and **New posts** moves to `top-14` (not a separate variant).

![21.gifts welcome moderator appointed](images/welcome-moderator-appointed.png)

### Variant: photo

On **All** (unpaid photo-only notes are hidden on Active): photo-only forum row from Ada with inline image (**Photo from Ada**), and the **+** that opens the writer (no composer on the page).

![21.gifts welcome photo](images/welcome-photo.png)

### Variant: photos

On **All**: photo-only forum row from Ada with two stills (**Photo from Ada** twice, `photoCount: 2`) in `ForumPhotoGallery` (horizontal snap row, `data-scroll-x`, 88% peek, `1/2` chip, dots), and the **+** that opens the writer (no composer on the page).

![21.gifts welcome photos](images/welcome-photos.png)

### Variant: photo-and-text

After a successful post of caption **Hello with this photo.** plus a JPEG: the row shows **Photo from Ada**, then that text below the photo; the successful post closed the writer and cleared its draft, and the **+** is back.

![21.gifts welcome photo and text](images/welcome-photo-and-text.png)

### Variant: photos-and-text

On **All**: forum row from Ada with two stills (**Photo from Ada**) in `ForumPhotoGallery` (horizontal snap row, `data-scroll-x`, 88% peek, `1/2` chip, dots) and caption **Hello with these photos.** below the photos; the successful post closed the writer, and the **+** is back.

![21.gifts welcome photos and text](images/welcome-photos-and-text.png)

### Variant: composer-text

Typed caption **Caption before attaching a photo.** in the composer; no preview yet; attach + Post idle.

![21.gifts welcome composer text](images/welcome-composer-text.png)

### Variant: keyboard-viewport

Signed-in `/welcome` with the writer open and its text field focused while `visualViewport.height` is 60% of `innerHeight` and `offsetTop` is 15% (iPhone Safari software-keyboard geometry). The AppShell frame matches that visible height. It does not stay at `innerHeight`, so the page does not scroll under the frame. The writer ends at the frame's bottom edge, so it shrinks with the frame.

![21.gifts welcome keyboard viewport](images/welcome-keyboard-viewport.png)

### Variant: writer

Signed-in `/welcome` on a touch device after a tap on the **+**: the writer under the header row with the centred title **Send a post**, the **Send a post** / **Ask for money** pill, and the Post composer in its phone shape, the text field **Write a message** on top at full width and focused, and below it **Add a photo or video** and **Add a place** on the left and **Post** on the right. The feed and **Receive** / **Send** are covered; the top-left arrow closes the writer.

![21.gifts welcome writer](images/welcome-writer.png)

### Variant: writer-ask

The writer after a tap on **Ask for money**: the title reads **Ask for money**, and the first Ask step (**How much?**) replaces the Post composer.

![21.gifts welcome writer on Ask for money](images/welcome-writer-ask.png)

### Variant: writer-validation-error

The writer after a tap on **Post** with an empty text field: **Enter a message or add a photo or video** shows under the composer, and the writer stays open.

![21.gifts welcome writer with the empty-post error](images/welcome-writer-validation-error.png)

### Variant: writer-place-open

The writer after a tap on **Add a place**: the place panel opens under the composer (in the test build without a map key it says **The map is not available.**).

![21.gifts welcome writer with the place panel open](images/welcome-writer-place-open.png)

### Variant: composer-photo

JPEG preview (**Selected photo**) and **Remove photo**; textarea empty.

![21.gifts welcome composer photo](images/welcome-composer-photo.png)

### Variant: place

One unpaid note on **All** with a place. The card shows a MapPin link **Happyland** to `/shops?pin=m-place#map`.

![21.gifts welcome place](images/welcome-place.png)

### Variant: place-coords

One unpaid note on **All** whose place has no label. The card shows a MapPin link **14.60000, 120.98000** to `/shops?pin=m-place#map`. The same link is what a member profile and your own profile show on a top-level note.

![21.gifts welcome place coordinates](images/welcome-place-coords.png)

### Variant: composer-place

**Add a place** is open and the map key is empty, so the panel says **The map is not available.**

![21.gifts welcome composer place](images/welcome-composer-place.png)

### Variant: composer-place-map

**Add a place** is open with a map key. The map frame is visible and **Use this place** is not, because the map has not been clicked yet.

![21.gifts welcome composer place map](images/welcome-composer-place-map.png)

### Variant: composer-place-confirm

**Add a place** is open with a map. A click has set a pin, **Place name** is **Stall**, and **Use this place** is still visible. The pin is not confirmed yet.

![21.gifts welcome composer place confirm](images/welcome-composer-place-confirm.png)

### Variant: composer-place-set

A confirmed pin **Stall** sits under **Add a place** as a preview with **Remove place**. The panel is closed.

![21.gifts welcome composer place set](images/welcome-composer-place-set.png)

### Variant: composer-place-pending

**Add a place** is open, the key has arrived, and the map script has not loaded. The place name field is visible. **Use this place** is not, and the frame is still empty. A failed script or a rejected key uses the same **The map is not available.** panel as `composer-place`.

![21.gifts welcome composer place pending](images/welcome-composer-place-pending.png)

### Variant: composer-place-unlabeled

**Add a place** is open with a map. A click has set a pin and the place name is still empty. **Use this place** is visible.

![21.gifts welcome composer place unlabeled](images/welcome-composer-place-unlabeled.png)

### Variant: composer-place-set-coords

A confirmed pin with no name sits under **Add a place** as **14.50000, 120.90000** with **Remove place**. The panel is closed.

![21.gifts welcome composer place set coordinates](images/welcome-composer-place-set-coords.png)

### Variant: composer-photos

Two JPEG previews (**Selected photo**) and per-index **Remove photo**; textarea empty.

![21.gifts welcome composer photos](images/welcome-composer-photos.png)

### Variant: composer-photo-and-text

Preview plus caption **Caption with selected photo.**, ready to Post.

![21.gifts welcome composer photo and text](images/welcome-composer-photo-and-text.png)

### Variant: composer-photos-and-text

Two JPEG previews plus caption **Caption with selected photos.**, ready to Post.

![21.gifts welcome composer photos and text](images/welcome-composer-photos-and-text.png)

### Variant: composer-video

MP4 preview in the composer and **Remove video**; textarea empty.

![21.gifts welcome composer video](images/welcome-composer-video.png)

### Variant: composer-video-and-text

Video preview plus caption **Caption with selected video.**, ready to Post.

![21.gifts welcome composer video and text](images/welcome-composer-video-and-text.png)

### Variant: composer-text-after-remove

After **Remove photo**, caption **Caption kept after removing photo.** remains; preview gone.

![21.gifts welcome composer text after remove](images/welcome-composer-text-after-remove.png)

### Variant: preparing-photo

Attach in flight (Post disabled + spinner, no preview yet). Native file picker is OS chrome and is not a variant.

![21.gifts welcome preparing photo](images/welcome-preparing-photo.png)

### Variant: preparing-photo-and-text

Same spinner, caption **Caption while the photo is preparing.** already in the textarea.

![21.gifts welcome preparing photo and text](images/welcome-preparing-photo-and-text.png)

### Variant: posting-photo-and-text

Post in flight: spinner on **Post**, composer disabled, preview and caption **Caption while the post is in flight.** still shown.

![21.gifts welcome posting photo and text](images/welcome-posting-photo-and-text.png)

### Variant: photo-loading

Forum row for Ada with caption **Caption waiting for the photo to load.** and `hasPhoto`, image bytes not yet loaded so no `<img>`. A failed photo fetch looks the same (text-only row) — not a separate variant.

![21.gifts welcome photo loading](images/welcome-photo-loading.png)

### Variant: error-unsupported

Attach a GIF → **Use a JPEG, PNG, or WebP photo, or an MP4, WebM, or MOV video**.

![21.gifts welcome error unsupported](images/welcome-error-unsupported.png)

### Variant: error-unsupported-with-text

Same alert with caption **Caption with an unsupported photo.** still in the composer.

![21.gifts welcome error unsupported with text](images/welcome-error-unsupported-with-text.png)

### Variant: error-too-large

Encoded JPEG over 1 MB → **Keep photos under 1 MB and videos under 32 MB**.

![21.gifts welcome error too large](images/welcome-error-too-large.png)

### Variant: error-too-many

Eleven files → **You can add up to 10 photos**.

![21.gifts welcome error too many](images/welcome-error-too-many.png)

### Variant: error-too-large-with-text

Same alert with caption **Caption with a photo that is too large.** still in the composer.

![21.gifts welcome error too large with text](images/welcome-error-too-large-with-text.png)

### Variant: error-too-many-with-text

Same 11-file tooMany alert with caption **Caption with too many photos.** still in the composer.

![21.gifts welcome error too many with text](images/welcome-error-too-many-with-text.png)

### Variant: error-request-photo-and-text

POST fails after caption+JPEG → **Could not post your message**; preview and caption remain.

![21.gifts welcome error request photo and text](images/welcome-error-request-photo-and-text.png)

### Variant: menu-open

Open **Menu** top-right → Menu starts with the account header (photo or initial, name, @username, balance, Received / Given / Posts), then Home, Balance, Shops, Point of sale, Profile, Grants, Settings, Living room rules, Habit-Tracker, Trust Chain, Statistics, Notifications, Messages, Contact, optional Install, Log out, then a quiet **Version {version}** line (`app.version`)). Profile is one line (User + Profile; no given or received amounts). Notifications shows an unread count on the right only when `unreadCount` > 0 (Ada’s default shot is 0, so no count). Messages shows a count on the right only when inbox unread > 0; Ada’s default shots are 0 so no number. Ada’s default welcome-menu shot shows Profile with no amounts. Living room rules and Contact each have an icon, optional **Install app** when an install offer exists, Log out, then a quiet **Version {version}** line (`app.version`). Language, theme, and number format live on `/profile`, not in this Menu. The Profile link’s accessible name is Profile. Other accessible names are unchanged. No English / Deutsch / Español / Filipino option rows. No native language select.
![21.gifts welcome menu](images/welcome-menu.png)

### Variant: menu-lifted

Open **Menu** on a wide frame whose window is too short for the ordinary dropdown but still tall enough for the compact menu once it moves up. The panel is a fixed 18rem overlay. Its top stays inside the window, it does not scroll, and **Habit-Tracker** and **Log out** stay on screen. This is not the narrow sheet.

![21.gifts welcome menu lifted](images/welcome-menu-lifted.png)

### Variant: menu-tall-sheet

Open **Menu** on a wide frame shorter than the compact menu even with its top on the window. The wide menu uses the same full-width sheet as a narrow frame. The page underneath is hidden. The sheet scrolls inside its own border, as on a phone, so the lower rows come into view while the page behind stays put.

![21.gifts welcome menu tall sheet](images/welcome-menu-tall-sheet.png)

### Variant: menu-header-loading

The same open Menu while the account header's numbers are still on their way: **Received**, **Given**, and **Posts** keep their labels, and each value line shows a grey skeleton bar of the same height as the number that replaces it, so nothing moves when the numbers arrive. The photo slot shows the initial meanwhile.

![21.gifts welcome menu header loading](images/welcome-menu-header-loading.png)

### Variant: menu-header-balance

The open Menu with the wallet open (pin `?visual=balance-ready`): the account header shows the balance **₿21'000** with its fiat small in the top-right corner, a link to `/wallet`.

![21.gifts welcome menu header balance](images/welcome-menu-header-balance.png)

### Variant: menu-header-no-rate

The open Menu with the wallet open (pin `?visual=balance-ready`) while the spot rate cannot be read: the balance **₿21'000** and the **Received** and **Given** totals show only the Bitcoin figure, without a fiat line.

![21.gifts welcome menu header without a rate](images/welcome-menu-header-no-rate.png)

### Variant: menu-header-connecting

The open Menu while the wallet opens (pin `?visual=balance-connecting`): two skeleton bars hold the balance corner (`role="status"`, **Opening your wallet…**).

![21.gifts welcome menu header connecting](images/welcome-menu-header-connecting.png)

### Variant: menu-header-failed

The open Menu when the totals and the post count could not be read: **Received**, **Given**, and **Posts** each show `–`, at the same height as a number.

![21.gifts welcome menu header failed](images/welcome-menu-header-failed.png)

### Variant: menu-header-photo

The open Menu for a member with a profile photo: the round photo replaces the initial at the start of the account header.

![21.gifts welcome menu header photo](images/welcome-menu-header-photo.png)

### Variant: menu-sheet-end

The open Menu scrolled to its end. On a phone the Menu is a sheet that stops above the bottom of the page frame and scrolls inside its own border, so the last rows (**Log out** and the **Version {version}** line) come into view while the page behind stays put; on a desktop the panel is short enough to show whole.

![21.gifts welcome menu sheet end](images/welcome-menu-sheet-end.png)

### Variant: menu-unread

Open **Menu** with `unreadCount` 3 stubbed on `GET /forum/notifications` → Notifications shows **3** on the right (`nav.notificationsUnread`, accessible name Notifications, 3 unread). Messages shows a count on the right only when inbox unread > 0; Ada’s default inbox unread is 0 so no number. Other Menu rows match `menu-open`. The installed PWA home-screen badge is the sum of notification unread, inbox unread, and staff-room unread (0 or 1). The Menu still splits the counts (Notifications vs Messages vs Moderation).

![21.gifts welcome menu unread](images/welcome-menu-unread.png)

### Variant: menu-inbox-unread

Open **Menu** with two unread inbox rows stubbed on `GET /conversations` → Messages shows **2** on the right (`nav.inboxUnread`, accessible name Messages, 2 unread). Notifications stay at count 0. Other Menu rows match `menu-open`.

![21.gifts welcome menu inbox unread](images/welcome-menu-inbox-unread.png)

### Variant: menu-moderation-unread

Staff (moderator) Open **Menu** with `GET /conversations/moderator-group` stubbed unread true → Moderation shows **1** on the right (`nav.moderateUnread`, accessible name Moderation, 1 unread). Notifications and Messages stay at count 0. **Statistics** is already on the member menu (no unread count, immediately after Trust Chain). The only staff extra versus `menu-open` is **Moderation**.

![21.gifts welcome menu moderation unread](images/welcome-menu-moderation-unread.png)

### Variant: menu-staff

Staff (moderator) in a standalone display, so **Install app** is absent. Open **Menu**. Rows: **Home**, **Balance**, **Shops**, **Point of sale**, **Profile**, **Grants**, **Settings**, **Living room rules**, **Habit-Tracker**, **Trust Chain**, **Statistics**, **Moderation** with no unread count, **Notifications**, **Messages**, **Contact**, **Log out**, then **Version dev**.

![21.gifts welcome menu staff](images/welcome-menu-staff.png)

### Variant: pay-composer

Empty forum, basis account posts **Hello gifts**. The 1-sat compose invoice stays on the composer (`payHost` `'composer'`), not on a listed note. The invoice card shows the in-app wallet pay slot (here **Your 21.gifts wallet is not available here, so this cannot be paid.**, because this build has no wallet configured) on every device, with no invoice QR. The empty-feed copy stays visible.

![21.gifts welcome pay composer](images/welcome-pay-composer.png)

### Variant: composer-wallet-pay-preparing

Pinned fixture (`?visual=wallet-pay-preparing`, Playwright builds only, posting-fee invoice with a `sparkInvoice`). After **Post** on a new note, the composer pay slot (**Pay ₿1**) shows the in-app wallet slot, with no invoice QR: a spinner and **Checking your wallet…**.

![21.gifts welcome composer wallet pay preparing](images/welcome-composer-wallet-pay-preparing.png)

### Variant: composer-wallet-pay-confirm

Pinned fixture (`?visual=wallet-pay-confirm`, Playwright builds only, posting-fee invoice with a `sparkInvoice`). After **Post** on a new note, the composer pay slot (**Pay ₿1**) shows the in-app wallet slot, with no invoice QR: **Pay ₿1 and post**, without a fiat suffix and with no fee row for the quoted fee of ₿0 (the posting fee of a new post or reply pays and posts in one tap; other pay sheets keep **Send**).

![21.gifts welcome composer wallet pay confirm](images/welcome-composer-wallet-pay-confirm.png)

### Variant: composer-wallet-pay-paying

Pinned fixture (`?visual=wallet-pay-paying`, Playwright builds only, posting-fee invoice with a `sparkInvoice`). After **Post** on a new note, the composer pay slot (**Pay ₿1**) shows the in-app wallet slot, with no invoice QR: a spinner and **Paying from your wallet…**.

![21.gifts welcome composer wallet pay paying](images/welcome-composer-wallet-pay-paying.png)

### Variant: composer-wallet-pay-insufficient

Pinned fixture (`?visual=wallet-pay-insufficient`, Playwright builds only, posting-fee invoice with a `sparkInvoice`). After **Post** on a new note, the composer pay slot (**Pay ₿1**) shows the in-app wallet slot, with no invoice QR: the alert that the wallet lacks Bitcoin, then **Still missing:** with the amount plus the known fee minus the balance in ₿ and fiat (the pin shows the full amount), then the member's own 21.gifts address and its Open CryptoPay QR.

![21.gifts welcome composer wallet pay insufficient](images/welcome-composer-wallet-pay-insufficient.png)

### Variant: composer-wallet-pay-unconfirmed

Pinned fixture (`?visual=wallet-pay-unconfirmed`, Playwright builds only, posting-fee invoice with a `sparkInvoice`). After **Post** on a new note, the composer pay slot (**Pay ₿1**) shows the in-app wallet slot, with no invoice QR: the neutral not-confirmed-yet sentence.

![21.gifts welcome composer wallet pay unconfirmed](images/welcome-composer-wallet-pay-unconfirmed.png)

### Variant: pay-amount

Payable reply after **Show reactions**, Gift opened, amount filled, not submitted. Amount CTA is **Continue** (`forum.payContinue`) on every user-agent. Live equivalent in the preferred fiat (no picker). No error and no pay slot yet. The post itself does not show Send Bitcoin.

![21.gifts welcome pay amount](images/welcome-pay-amount.png)

### Variant: wallet-pay-unavailable

Payable reply, Gift amount submitted, live (no pin). This build has no wallet configured, so the invoice card shows the amount with the default fiat, a Close (`X`) control, not Back, the sentence **Your 21.gifts wallet is not available here, so this cannot be paid.**, and **Waiting for payment…**. No invoice QR and no button to another wallet app, on desktop and on a smartphone alike.

![21.gifts welcome wallet pay unavailable](images/welcome-wallet-pay-unavailable.png)

### Variant: wallet-pay-preparing

Pinned fixture (`?visual=wallet-pay-preparing`, Playwright builds only). The wallet connects, setup finishes, or the slot reads the fee: spinner and **Checking your wallet…**.

![21.gifts welcome wallet pay preparing](images/welcome-wallet-pay-preparing.png)

### Variant: wallet-pay-confirm

Pinned fixture (`?visual=wallet-pay-confirm`, Playwright builds only). **Send**, with no fee row for the quoted fee of ₿0 (a fee above ₿0 shows **Fee {amount}** with the default fiat above **Send**). No invoice QR and no button to another wallet app.

![21.gifts welcome wallet pay confirm](images/welcome-wallet-pay-confirm.png)

### Variant: wallet-pay-paying

Pinned fixture (`?visual=wallet-pay-paying`, Playwright builds only). Spinner and **Paying from your wallet…**, with **Waiting for payment…** under it while the existing long-poll waits.

![21.gifts welcome wallet pay paying](images/welcome-wallet-pay-paying.png)

### Variant: wallet-pay-insufficient

Pinned fixture (`?visual=wallet-pay-insufficient`, Playwright builds only). Alert **Your wallet does not have enough Bitcoin for this payment.**, then **Still missing:** with the amount plus the known fee minus the balance in ₿ and fiat (the pin shows the full amount), then the member's own 21.gifts address and its Open CryptoPay QR to add Bitcoin (shown on a smartphone too, like the `/wallet` QR). While this view shows, the slot reads the synced balance every 4 s, also when the wallet reports no payment; once the balance covers amount and the known fee, the address and QR go at once and the slot prepares again and stops at **Send** (`wallet-pay-confirm`). It never pays without that tap.

![21.gifts welcome wallet pay insufficient](images/welcome-wallet-pay-insufficient.png)

### Variant: wallet-pay-failed

Pinned fixture (`?visual=wallet-pay-failed`, Playwright builds only). The wallet could not connect or could not prepare this payment: alert **Your wallet could not prepare this payment. Please try again.** and a secondary **Try again**, which reconnects or prepares again. No invoice QR and no button to another wallet app.

![21.gifts welcome wallet pay failed](images/welcome-wallet-pay-failed.png)

### Variant: wallet-pay-setup-failed

Pinned fixture (`?visual=wallet-pay-setup-failed`, Playwright builds only). The account still needs wallet verification and its background setup exhausted all quiet retries. In the forum pay sheet, the pay slot shows the alert **Your wallet could not be set up yet.** (`walletSetup.error`) followed by a secondary **Try again** button under it. The sheet stays open; there is no invoice QR, button to another wallet app, or page-covering setup UI.

![21.gifts welcome wallet pay setup failed](images/welcome-wallet-pay-setup-failed.png)

### Variant: wallet-pay-unconfirmed

Pinned fixture (`?visual=wallet-pay-unconfirmed`, Playwright builds only). 60 seconds after a send (failed, timed out, or sent) without a confirmation that closed the sheet: the neutral sentence **This payment is not confirmed yet. Check your balance again later.** No alert and no retry.

![21.gifts welcome wallet pay unconfirmed](images/welcome-wallet-pay-unconfirmed.png)

### Variant: pay-author-wallet

Payable reply, Gift amount submitted, but the author's wallet cannot mint a zap invoice. The pay sheet stays on the amount form and shows **The author's wallet cannot receive this Bitcoin payment**. Amount CTA is **Continue** (`forum.payContinue`) on every user-agent. No invoice card and no pay slot.

![21.gifts welcome pay author wallet](images/welcome-pay-author-wallet.png)

### Variant: pay-deleted

Payable reply, Gift amount submitted, but the note was deleted. The pay sheet stays on the amount form and shows **This note was deleted.**, with no invoice card and no pay slot.

![21.gifts welcome pay deleted](images/welcome-pay-deleted.png)

### Variant: role-hint

Carol's **Verified** tag clicked; the explanation under that card header is visible (**A moderator has met this person in real life and confirmed they are real.**). Bob stays without a pill; Ada still shows **Moderator**.

![21.gifts welcome role hint](images/welcome-role-hint.png)

### Variant: overlay-wallet

Named member with living-room rules agreed whose wallet is not set up (the api lists `lightning-address` as missing). Composer filled, **Post** clicked. `RequirementsOverlay` dialog **Your wallet is not set up** with the sentence **Gifts and posts need your own 21.gifts wallet, and it is not set up yet. Open your wallet to set it up.** and the labeled link **Open your wallet** to `/wallet`. No form and no **Skip**. Close (X) is present.

![21.gifts welcome overlay wallet](images/welcome-overlay-wallet.png)

### Variant: overlay-username

Named member with living-room rules agreed and no username. Composer filled, **Post** clicked. `RequirementsOverlay` dialog **Add your 21.gifts name** with `UsernameForm variant=overlay`. No **Skip**. Close (X) is present.

![21.gifts welcome overlay username](images/welcome-overlay-username.png)

### Variant: overlay-introduce

Named member with living-room rules agreed and `hasPosted` false. After login on `/welcome` (the only screen that shows it), `IntroduceYourselfOverlay` dialog **Introduce yourself** with body copy and **Write an introduction**. Close (X) is icon-only.

- **Actions:** Close dismisses this mount only. **Write an introduction** (`Button` `type="button"` `size="lg"`) dismisses the overlay, opens the writer and focuses its text field (`requestForumCompose` / `FORUM_COMPOSE_EVENT`). It stays on `/welcome`; the dialog never opens on `/wallet`, the point of sale, the profile, messages, or the setup flow.

![21.gifts welcome overlay introduce](images/welcome-overlay-introduce.png)

### Variant: overlay-external-link

Named member with living-room rules dismissed and a paid forum note whose body is `New:` plus `https://example.com/phish`. Clicking that URL opens `ExternalLinkWarning` dialog **Open external link?** with the catalog body, the destination URL as `break-all` text, labeled **Open link**, and icon-only Close. Internal 21.gifts URLs on the same board do not open this overlay.

- **Actions:** Close dismisses without opening. **Open link** (`Button` `type="button"` `size="lg"`) confirms and hands the https URL to `openInSystemBrowser`.

![21.gifts welcome overlay external link](images/welcome-overlay-external-link.png)

### Variant: shop-tag

Ada's paid note includes `#21GiftsShop`. The card shows a `#Shop` pill linking to `/shops` and the visible body hides the raw hashtag. Other welcome chrome matches default.

![21.gifts welcome shop-tag](images/welcome-shop-tag.png)

### Variant: shop-edit

A moderator session. One top-level shop note **Cafe Luna**. The footer shows **Edit shop note** after copy. The editor is closed.

![21.gifts welcome shop edit](images/welcome-shop-edit.png)

### Variant: shop-edit-open

A moderator clicked **Edit shop note** on Cafe Luna. Step **1 / 5 · Photos** is open and **History** says there are no edits yet. The photo step dismisses with an icon-only Close (X). Its accessible name is Cancel. There is no visible Cancel word.

![21.gifts welcome shop edit open](images/welcome-shop-edit-open.png)

### Variant: shop-edit-place

The same moderator pressed **Next**. Step **2 / 5 · Place** is open. **History** still says there are no edits yet. The photo step's Close (X) is gone. The top-left arrow returns to the photo step.

![21.gifts welcome shop edit place](images/welcome-shop-edit-place.png)

### Variant: shop-edit-text

**Next** again. Step **3 / 5 · Text** is open. The shop text is already filled.

![21.gifts welcome shop edit text](images/welcome-shop-edit-text.png)

### Variant: shop-edit-user

**Next** again. Step **4 / 5 · 21.gifts user** is open. The username is empty. **History** still says there are no edits yet.

![21.gifts welcome shop edit user](images/welcome-shop-edit-user.png)

### Variant: shop-edit-summary

**Next** again. Step **5 / 5 · Summary** is open. The card lists Photos **None**, Place **None**, Text **Cafe Luna**, and 21.gifts user **None**.

![21.gifts welcome shop edit summary](images/welcome-shop-edit-summary.png)

## Screen: /shops

- **URL:** `/shops` — signed-in shop listings. Same onboarding gate as `/welcome` (`OnboardingGate screen="welcome"`). There is no `route.ts` beside this page.
- **What the user sees:** Flow `AppShell` (`align="start"`) with one top-left arrow (`ProfileChromeLeft`; previous in-app view, or `/welcome` when this tab has none) and wordmark → `/welcome` top-left and one **Menu** top-right (see **Signed-in header**); open the Menu for **Home**, **Balance**, **Shops**, **Point of sale**, Profile, **Grants**, **Settings**, **Living room rules**, **Habit-Tracker**, **Trust Chain**, **Statistics**, **Notifications**, **Messages**, **Contact**, optional **Install app**, and **Log out**. Heading **Shops**, lead **Add a shop with photos, a place, text, and an optional 21.gifts user. It appears here and in the forum with a #Shop tag.** Under the lead a closed **Country** select (the same full-width select as the forum view filter) shows **All countries**; its list adds every country that has a shop, named in the UI language with its shop count, such as **Philippines (3)**, sorted by name. The country of a shop is the country its pin lies in, which the api reads from the coordinates, never from the place text; a shop without a pin, or with a pin in the open sea, appears only under **All countries**. Choosing a country shows only that country's shops on every option: **Post** and **Table** load only those shops, and **Map** keeps only those shops' pins and fits the map to them. The choice is in the address (`/shops?country=PH`), so the link can be shared and browser Back and Forward return to the previous choice; a code that names no country shows **All countries**. When the chosen country has no shop left, each option shows its usual empty copy. After a shop is added, or a moderator saves a shop or its pin, the counts reload, and a filtered option reloads its shops, so a new or moved pin lands under the country it now lies in. Under the select a pill offers **Post**, **Map**, and **Table**. **Post** is selected and is the list below. `/shops#map` opens **Map** and `/shops#table` opens **Table**. `/shops#post`, no hash, or an unknown hash opens **Post**. Choosing an option writes that hash; **Post** clears it. **Map** is the place list, without a second Map heading. An old `/map` address opens this option and keeps `?pin=`. With a map key, several pins and no matching `?pin=` frame every pin. One pin, or a matching `?pin=`, stays centered on that pin. **Table** has columns **Name**, **Place**, and **Operator**. A place opens **Map** on this page with that pin selected (`/shops?pin=<id>#map`), under **All countries** so the pin is always on the map (Back returns to the filtered view), and an operator opens that member, both without a page load. Browser Back returns to the **Post** or **Table** view the place was opened from. **Show more** loads the next page. A page with no shop rows still shows **Show more** when another page exists, and does not say there are no shops. If the next page fails, the rows stay and **Try again** reloads it. **Map** can also be empty, loading, or in error, using the place-map copy, still without a second Map heading. There is no Active / No gifts yet / All / Most popular control. On **Post**, a closed **Add a shop** button sits under the pill. It opens five steps: photos, place, text, an optional 21.gifts user, then a summary whose **Post** sends the note. The text step lists people as soon as `@` is typed. There is no **Ask for money** pill. A moderator also sees **Edit shop note** on each shop card, and on a shop pin in **Map** and beside the name in **Table**. The list is every top-level note from `GET /messages?hashtag=21GiftsShop&mode=all` (app proxy `/forum/messages`), newest first, including notes with zero sats. The composer does not show the hashtag; submit appends `#21GiftsShop`. The living-room laws hint is absent. Shop cards show a `#Shop` pill (link `/shops`) and hide the raw token. A moderator footer has **Add an account** beside **Add a place**. A saved account is an `@username` link to `/members/{id}` under the text. When that page is empty, empty copy **No shops yet — add the first one.** immediately. Loading copy: **Loading…**. Error copy plus **Try again**. Every pay sheet on this screen (a gift, a paid reaction, or a paid reply) follows the same in-app wallet rule as the forum pay sheet on `/welcome`: it pays from the in-app wallet only (the `sparkInvoice`, otherwise the `pr`); without a usable wallet it shows the unavailable or failed state, never an invoice QR or a link to another wallet app.
- **Actions:** Post a shop (text and/or photo or video) and attach or remove an optional place. Expand a note, open Menu including **Shops**. The top-left arrow returns to the previous in-app view in this tab, or `/welcome` when this tab has none. From the place step of **Add a shop** or **Edit shop note**, that same arrow returns to the previous step and is disabled while the note is sending. The form has no **Back** button. One arrow. The wordmark is not that control.
- **Calls:** `AppShell`, `ProfileChromeLeft`, `SignedInChrome`, `OnboardingGate`, `ShopsScreen`, `ShopsCountryFilter`, `ForumModeSelect`, `ShopsViewSwitch`, `ForumLoader`, `ForumBoard`, `PlacesMapScreen`, `ShopTable`, `WalletPay`, `useWalletPay`, the wallet payment primitive.

### Variant: default

Heading **Shops**, lead, the closed **Country** select on **All countries**, the **Post** / **Map** / **Table** pill with **Post** selected, **Add a shop** (no living-room composer), one shop note **Cafe Luna** with a `#Shop` pill. A zero-sat shop would still be listed. Laws hint absent. Raw `#21GiftsShop` is not visible.

![21.gifts shops](images/shops.png)

### Variant: heart-needs-balance

Shop post feed with **Cafe Luna** after stubbing POST /messages/*/invoice to 400 `wallet_required` and clicking Send ₿1. Copy **A Bitcoin balance is required for this.**

![21.gifts shops heart needs balance](images/shops-heart-needs-balance.png)

### Variant: heart-paid

Same Cafe Luna post after opening `?visual=heart-paid` and clicking Send ₿1. The paid mark **+1** is visible.

![21.gifts shops heart paid](images/shops-heart-paid.png)

### Variant: heart-unavailable

Same Cafe Luna post after stubbing POST /messages/*/invoice to 503 `HEART_UNAVAILABLE` and clicking Send ₿1. Nothing is sent; the heart stays empty. Copy **Hearts are not available right now.**

![21.gifts shops heart unavailable](images/shops-heart-unavailable.png)

### Variant: heart-pending

Same Cafe Luna post after opening `?visual=heart-pending` and clicking Send ₿1: the send timed out and its outcome is not known yet. The heart stays filled, no **+1**, and another tap on this note does not pay. Copy **Your last heart is still on its way. Try again in a moment.**

![21.gifts shops heart pending](images/shops-heart-pending.png)

### Variant: mention-suggest

**Add a shop** is open on **3 / 5 · Text**. **Shop text** contains `@` and the People list is open, with `@ada`.

![21.gifts shops mention suggestions](images/shops-mention-suggest.png)

### Variant: mention-suggest-reply

A shop note is expanded, its reaction field contains `@`, and the People list is open. **Add a shop** stays closed.

![21.gifts shops reply mention suggestions](images/shops-mention-suggest-reply.png)

### Variant: mention-inserted

Choosing `@ada` from that open list writes `@ada ` into **Shop text** and closes the list.

![21.gifts shops mention inserted](images/shops-mention-inserted.png)

### Variant: mention-inserted-reply

Choosing `@ada` from that open list writes `@ada ` into the reaction field and closes the list.

![21.gifts shops reply mention inserted](images/shops-mention-inserted-reply.png)

### Variant: sunday

Device-local Sunday. The **Post** / **Map** / **Table** pill stays. **Add a shop** is gone. **Writing is paused on Sunday.** The note **Cafe Luna** stays.

![21.gifts shops sunday](images/shops-sunday.png)

### Variant: country-open

The closed **Country** select was pressed and its list is open over the **Post** / **Map** / **Table** pill: **All countries** with a check, then **Kenya (1)** and **Philippines (1)**, sorted by name, each with its shop count. **Post** stays selected.

![21.gifts shops country list open](images/shops-country-open.png)

### Variant: country

**Philippines (1)** was chosen from the **Country** list while **Table** was selected. The select shows **Philippines (1)** and the address is `/shops?country=PH#table`. The table lists only the shop in the Philippines, **Sari-sari Manila**; the shop in Kenya is gone.

![21.gifts shops filtered by country](images/shops-country.png)

### Variant: country-empty

A shared link chose a country without shops (`/shops?country=CH#table`). The select shows **Switzerland (0)** and its list also offers **Kenya (1)** and **Philippines (1)**. **Table** shows the usual empty copy **No shops yet — add the first one.**

![21.gifts shops country without shops](images/shops-country-empty.png)

### Variant: country-loading

`/shops?country=PH#table` while the pins for the counts are still loading (or could not be loaded). The select shows **Philippines** without a count; the table already lists only **Sari-sari Manila**.

![21.gifts shops country before the counts load](images/shops-country-loading.png)

### Variant: country-post

`/shops?country=PH` on **Post**. The select shows **Philippines (1)**. The post list shows only the shop in the Philippines, **Sari-sari Manila**; the shop in Kenya is gone. **Add a shop** stays.

![21.gifts shops posts filtered by country](images/shops-country-post.png)

### Variant: country-map

`/shops?country=PH#map` on **Map**. The select shows **Philippines (1)**. The place list keeps only **Ada · Manila**; the pin in Nairobi is gone. No map key, so the frame stays empty.

![21.gifts shops map filtered by country](images/shops-country-map.png)

### Variant: map

The **Map** option is selected. The post composer is gone. The place list is visible without a second **Map** heading. No map key, so the frame stays empty.

![21.gifts shops map](images/shops-map.png)

### Variant: map-staff

A moderator session. **Map** is selected. The pin is a shop, so **Edit shop note** sits beside **Ada · Happyland**. No map key, so the frame stays empty. No second **Map** heading.

![21.gifts shops map staff](images/shops-map-staff.png)

### Variant: map-edit-open

A moderator clicked **Edit shop note** beside **Ada · Happyland**. Step **1 / 5 · Photos** is open. **History** says there are no edits yet. The photo step dismisses with an icon-only Close (X). Its accessible name is Cancel. There is no visible Cancel word. **Map** stays selected. No map key, so the frame stays empty. No second **Map** heading.

![21.gifts shops map edit open](images/shops-map-edit-open.png)

### Variant: map-edit-place

The same moderator pressed **Next**. Step **2 / 5 · Place** is open on the map. **History** still says there are no edits yet. The photo step's Close (X) is gone. **Map** stays selected. No map key, so the frame stays empty. No second **Map** heading.

![21.gifts shops map edit place](images/shops-map-edit-place.png)

### Variant: map-edit-text

**Next** again. Step **3 / 5 · Text** is open. **Map** stays selected. No second **Map** heading.

![21.gifts shops map edit text](images/shops-map-edit-text.png)

### Variant: map-edit-user

**Next** again. Step **4 / 5 · 21.gifts user** is open. The username is empty. **History** still says there are no edits yet. **Map** stays selected. No second **Map** heading.

![21.gifts shops map edit user](images/shops-map-edit-user.png)

### Variant: map-edit-summary

**Next** again. Step **5 / 5 · Summary** is open. The card lists Photos **None**, Place **None**, Text **Cafe Luna**, and 21.gifts user **None**. **Map** stays selected. No second **Map** heading.

![21.gifts shops map edit summary](images/shops-map-edit-summary.png)

### Variant: map-edit-load-failed

A moderator clicked **Edit shop note** beside **Ada · Happyland**. The note did not load. The alert **Could not load this shop note** is visible. The editor is not open. **Map** stays selected. No second **Map** heading.

![21.gifts shops map edit load failed](images/shops-map-edit-load-failed.png)

### Variant: map-with-key

**Map** is selected and a map key is set. The stub map surface is in the frame, still without a second **Map** heading. The place list stays.

![21.gifts shops map with key](images/shops-map-with-key.png)

### Variant: map-pin

`/shops?pin=m-pin#map`. **Map** is selected. The row **Ada · Happyland** is semibold. No map key, so the frame stays empty. No second **Map** heading.

![21.gifts shops map pin](images/shops-map-pin.png)

### Variant: map-pin-with-key

`/shops?pin=m-pin#map` with a map key. **Map** is selected. The stub map surface is in the frame. **Ada · Happyland** is semibold. No second **Map** heading.

![21.gifts shops map pin with key](images/shops-map-pin-with-key.png)

### Variant: map-coords

**Map** is selected. One pin with no label and no map key. The row reads **Ada · 14.60000, 120.98000** and is not semibold. The frame stays empty. No second **Map** heading.

![21.gifts shops map coordinates](images/shops-map-coords.png)

### Variant: map-coords-pin

`/shops?pin=m-pin#map`. **Map** is selected. The coordinate row **Ada · 14.60000, 120.98000** is semibold. No map key, so the frame stays empty. No second **Map** heading.

![21.gifts shops map coordinates pin](images/shops-map-coords-pin.png)

### Variant: map-coords-with-key

**Map** is selected and a map key is set. The pin has no label. The frame shows the stub map surface. The row reads **Ada · 14.60000, 120.98000** and is not semibold. No second **Map** heading.

![21.gifts shops map coordinates with key](images/shops-map-coords-with-key.png)

### Variant: map-coords-pin-with-key

`/shops?pin=m-pin#map` with a map key and no label. **Map** is selected. The frame shows the stub map surface. The coordinate row is semibold. No second **Map** heading.

![21.gifts shops map coordinates pin with key](images/shops-map-coords-pin-with-key.png)

### Variant: table

The **Table** option is selected. Headers **Name**, **Place**, and **Operator**. One row **Cafe Luna**, place **Happyland**, operator **@luna**.

![21.gifts shops table](images/shops-table.png)

### Variant: table-staff

A moderator session. **Table** is selected. **Edit shop note** sits beside the name **Cafe Luna**. Place **Happyland** and operator **@luna** stay.

![21.gifts shops table staff](images/shops-table-staff.png)

### Variant: table-edit-open

A moderator clicked **Edit shop note** beside **Cafe Luna**. Step **1 / 5 · Photos** is open in the table. **History** says there are no edits yet. The photo step dismisses with an icon-only Close (X). Its accessible name is Cancel. There is no visible Cancel word. Place **Happyland** and operator **@luna** stay.

![21.gifts shops table edit open](images/shops-table-edit-open.png)

### Variant: table-edit-place

The same moderator pressed **Next**. Step **2 / 5 · Place** is open in the table. **History** still says there are no edits yet. The photo step's Close (X) is gone. Place **Happyland** and operator **@luna** stay.

![21.gifts shops table edit place](images/shops-table-edit-place.png)

### Variant: table-edit-text

**Next** again. Step **3 / 5 · Text** is open. **History** still says there are no edits yet. Place **Happyland** and operator **@luna** stay.

![21.gifts shops table edit text](images/shops-table-edit-text.png)

### Variant: table-edit-user

**Next** again. Step **4 / 5 · 21.gifts user** is open. The username field already shows luna. **History** still says there are no edits yet. Place **Happyland** and operator **@luna** stay.

![21.gifts shops table edit user](images/shops-table-edit-user.png)

### Variant: table-edit-summary

**Next** again. Step **5 / 5 · Summary** is open. **Save changes** is the button on the card. Place **Happyland** and operator **@luna** stay.

![21.gifts shops table edit summary](images/shops-table-edit-summary.png)

### Variant: add-photos

**Add a shop** is open on step **1 / 5 · Photos**. **Next** is the only button. The shop list is empty.

![21.gifts shops add photos](images/shops-add-photos.png)

### Variant: add-place

**Add a shop** is open on step **2 / 5 · Place**. **Add a place** is closed. **Next** is the only button on the card. The shop list is empty.

![21.gifts shops add place](images/shops-add-place.png)

### Variant: add-text

**Add a shop** is open on step **3 / 5 · Text**. Place was skipped. **Next** is the only button on the card.

![21.gifts shops add text](images/shops-add-text.png)

### Variant: add-user

**Add a shop** is open on step **4 / 5 · 21.gifts user**. The username is empty. **Next** is the only button on the card.

![21.gifts shops add user](images/shops-add-user.png)

### Variant: add-summary

**Add a shop** is open on step **5 / 5 · Summary**. Photos, place, text, and the user were skipped. **Post** is the only button on the card.

![21.gifts shops add summary](images/shops-add-summary.png)

### Variant: table-more

**Table** is selected. The same row is shown, and **Show more** is under the table. The composer is gone.

![21.gifts shops table more](images/shops-table-more.png)

### Variant: table-next

**Show more** has loaded the next page. **Cafe Luna** stays, **Other stall** is added, and **Show more** is gone.

![21.gifts shops table next](images/shops-table-next.png)

### Variant: table-more-error

The next page failed. **Cafe Luna** stays. The forum error and **Try again** sit under the table, and **Show more** is still there.

![21.gifts shops table more error](images/shops-table-more-error.png)

### Variant: table-more-empty

**Table** is selected. The page has no shop rows, but another page exists. **Show more** is shown. The empty sentence is not.

![21.gifts shops table more empty](images/shops-table-more-empty.png)

### Variant: table-empty

**Table** is selected and there are no shop notes. Empty copy **No shops yet — add the first one.** The composer is gone.

![21.gifts shops table empty](images/shops-table-empty.png)

### Variant: table-loading

**Table** is selected and the page has not arrived. **Loading…** The composer is gone.

![21.gifts shops table loading](images/shops-table-loading.png)

### Variant: table-error

**Table** is selected and the first page failed. **Could not load messages. Please try again.** and **Try again**. The composer is gone.

![21.gifts shops table error](images/shops-table-error.png)

### Variant: map-empty

**Map** is selected and there are no places. **No places yet.** No second **Map** heading. The composer is gone.

![21.gifts shops map empty](images/shops-map-empty.png)

### Variant: map-loading

**Map** is selected and places have not arrived. **Loading…** No second **Map** heading.

![21.gifts shops map loading](images/shops-map-loading.png)

### Variant: map-error

**Map** is selected and places failed. **Could not load places. Please try again.** and **Try again**. No second **Map** heading.

![21.gifts shops map error](images/shops-map-error.png)

### Variant: empty

Empty copy **No shops yet — add the first one.** Composer still present.

![21.gifts shops empty](images/shops-empty.png)

### Variant: loading

**Loading…**

![21.gifts shops loading](images/shops-loading.png)

### Variant: error

**Could not load messages. Please try again.** and **Try again**.

![21.gifts shops error](images/shops-error.png)

### Variant: place

One shop note with a place. The card shows a MapPin link **Happyland** to `/shops?pin=m-place#map`. The raw `#21GiftsShop` token stays hidden.

![21.gifts shops place](images/shops-place.png)

### Variant: place-coords

One shop note whose place has no label. The card shows a MapPin link **14.60000, 120.98000** to `/shops?pin=m-place#map`. The raw `#21GiftsShop` token stays hidden.

![21.gifts shops place coordinates](images/shops-place-coords.png)

### Variant: composer-place

**Add a shop**, then **Next**, opens step **2 / 5 · Place**. **Add a place** is open on an empty shop list and the map key is empty, so the panel says **The map is not available.** The shop list is still empty.

![21.gifts shops composer place](images/shops-composer-place.png)

### Variant: composer-place-map

**Add a place** is open on an empty shop list with a map key. The map frame is visible and **Use this place** is not, because the map has not been clicked yet.

![21.gifts shops composer place map](images/shops-composer-place-map.png)

### Variant: composer-place-confirm

**Add a place** is open with a map. A click has set a pin, **Place name** is **Stall**, and **Use this place** is still visible. The pin is not confirmed yet.

![21.gifts shops composer place confirm](images/shops-composer-place-confirm.png)

### Variant: composer-place-set

A pin named **Stall** was confirmed, then **Add a place** closed. That name is not shown. **Remove place** appears only after the pin is opened again. **Next** stays available. The shop list is still empty.

![21.gifts shops composer place set](images/shops-composer-place-set.png)

### Variant: composer-place-pending

**Add a place** is open on an empty shop list, the key has arrived, and the map script has not loaded. The place name field is visible. **Use this place** is not, and the frame is still empty. A failed script or a rejected key uses the same **The map is not available.** panel as `composer-place`.

![21.gifts shops composer place pending](images/shops-composer-place-pending.png)

### Variant: composer-place-unlabeled

**Add a place** is open with a map. A click has set a pin and the place name is still empty. **Use this place** is visible. The shop list is still empty.

![21.gifts shops composer place unlabeled](images/shops-composer-place-unlabeled.png)

### Variant: composer-place-set-coords

A pin with no name was confirmed, then **Add a place** closed. **14.50000, 120.90000** is not shown. **Remove place** appears only after the pin is opened again. **Next** stays available. The shop list is still empty.

![21.gifts shops composer place set coordinates](images/shops-composer-place-set-coords.png)

### Variant: staff-place

A moderator session. One Cafe Luna shop note with no pin. **Edit shop note** is on the note. The note footer shows **Add a place** and **Add an account**. The map panel is closed. The account panel is closed.

![21.gifts shops staff place](images/shops-staff-place.png)

### Variant: edit-open

A moderator clicked **Edit shop note** on Cafe Luna. Step **1 / 5 · Photos** is open. The photo step dismisses with an icon-only Close (X). Its accessible name is Cancel. There is no visible Cancel word. **Next** is labeled. **History** is under the card.

![21.gifts shops edit open](images/shops-edit-open.png)

### Variant: edit-place

The same moderator pressed **Next**. Step **2 / 5 · Place** is open. The photo step's Close (X) is gone. The top-left arrow returns to the photo step.

![21.gifts shops edit place](images/shops-edit-place.png)

### Variant: edit-text

**Next** again. Step **3 / 5 · Text** is open. The shop text is already filled.

![21.gifts shops edit text](images/shops-edit-text.png)

### Variant: edit-user

**Next** again. Step **4 / 5 · 21.gifts user** is open. The username is empty. **History** still says there are no edits yet.

![21.gifts shops edit user](images/shops-edit-user.png)

### Variant: edit-summary

**Next** again. Step **5 / 5 · Summary** is open. **Save changes** is the button on the card. **History** is under the card.

![21.gifts shops edit summary](images/shops-edit-summary.png)

### Variant: edit-save-error

A moderator opened **Edit shop note** on Cafe Luna, changed the text, and **Save changes** failed. The editor stays open. The alert **Could not save this shop note** is visible.

![21.gifts shops edit save error](images/shops-edit-save-error.png)

### Variant: edit-history-error

A moderator opened **Edit shop note** on Cafe Luna. The history request failed. The alert **Could not load the history** is visible. The photo step stays open and still dismisses with an icon-only Close (X). Its accessible name is Cancel. There is no visible Cancel word.

![21.gifts shops edit history error](images/shops-edit-history-error.png)

### Variant: staff-place-unavailable

A moderator session. **Add a place** on the Cafe Luna note is open and the map key is missing. The panel says **The map is not available.** There is no map frame and no **Use this place**.

![21.gifts shops staff place unavailable](images/shops-staff-place-unavailable.png)

### Variant: staff-place-set

A moderator session. The Cafe Luna note has place **Happyland**. The card shows the MapPin link **Happyland** plus footer **Edit place** and **Add an account**. The map panel is closed. The account panel is closed.

![21.gifts shops staff place set](images/shops-staff-place-set.png)

### Variant: staff-place-edit

A moderator session. The Cafe Luna note has place **Happyland**. **Edit place** is open. The map frame is visible and **Remove place** is visible. The pin is not changed yet.

![21.gifts shops staff place edit](images/shops-staff-place-edit.png)

### Variant: staff-place-edit-error

A moderator session. **Edit place** is open on the Cafe Luna note, the map is visible, and **Remove place** was pressed. The save failed, so the alert **The place could not be saved. Please try again.** is visible. **Remove place** and **Use this place** stay.

![21.gifts shops staff place edit error](images/shops-staff-place-edit-error.png)

### Variant: staff-place-edit-unavailable

A moderator session. The Cafe Luna note has place **Happyland**. **Edit place** is open and the map key is missing. The panel says **The map is not available.** and shows **Remove place**. There is no map frame and no **Use this place**.

![21.gifts shops staff place edit unavailable](images/shops-staff-place-edit-unavailable.png)

### Variant: staff-place-edit-unavailable-error

A moderator session. **Edit place** is open without a map key, and **Remove place** was pressed. The save failed, so the alert **The place could not be saved. Please try again.** is visible and **Remove place** stays.

![21.gifts shops staff place edit unavailable error](images/shops-staff-place-edit-unavailable-error.png)

### Variant: staff-place-map

A moderator session. **Add a place** on the Cafe Luna note is open with a map key. The map frame is visible and **Use this place** is not, because the map has not been clicked yet.

![21.gifts shops staff place map](images/shops-staff-place-map.png)

### Variant: staff-place-confirm

A moderator session. **Add a place** on the Cafe Luna note is open with a map. A click has set a pin, **Place name** is **Happyland**, and **Use this place** is still visible. The pin is not saved yet.

![21.gifts shops staff place confirm](images/shops-staff-place-confirm.png)

### Variant: staff-place-unlabeled

A moderator session. **Add a place** on the Cafe Luna note is open with a map. A click has set a pin and the place name is still empty. **Use this place** is visible.

![21.gifts shops staff place unlabeled](images/shops-staff-place-unlabeled.png)

### Variant: staff-place-set-coords

A moderator session. The Cafe Luna note has a saved pin with no name. The card shows the coordinate link **14.50000, 120.90000** and footer **Edit place** and **Add an account**. The map panel is closed. The account panel is closed.

![21.gifts shops staff place set coordinates](images/shops-staff-place-set-coords.png)

### Variant: staff-place-error

A moderator session. **Add a place** on the Cafe Luna note is open. A pin and name are set and **Use this place** was pressed. The save failed, so the alert **The place could not be saved. Please try again.** is visible and **Use this place** stays.

![21.gifts shops staff place error](images/shops-staff-place-error.png)

### Variant: staff-account

A moderator session. One Cafe Luna shop note. **Add an account** is open. The username field is `@`. The People list shows `@ada` Ada Lovelace and `@adam` Adam. **Save account** is visible. There is no alert.

![21.gifts shops staff account](images/shops-staff-account.png)

### Variant: staff-account-chosen

A moderator session. One Cafe Luna shop note. **Add an account** is open. Choosing `@ada` from the People list writes `@ada` into the username field and keeps the list on that prefix. **Save account** is visible. There is no alert.

![21.gifts shops staff account chosen](images/shops-staff-account-chosen.png)

### Variant: staff-account-set

A moderator session. The Cafe Luna note includes `shopAccount: { id: 'acc-luna', username: 'luna', name: 'Luna' }`. The card shows the `@luna` link to `/members/acc-luna` and footer **Edit account**. The account panel is closed.

![21.gifts shops staff account set](images/shops-staff-account-set.png)

### Variant: staff-account-error

A moderator session. **Add an account** is open on the Cafe Luna note. Username **missing** was saved. The save returned 404, so the alert **No account with that username.** is visible. **Save account** stays.

![21.gifts shops staff account error](images/shops-staff-account-error.png)

## Screen: /rules

- **URL:** `/rules` — public living-room rules. App chrome (semantic tokens; not the dark marketing shell). No auth gate to view; chrome depends on hydrated session.
- **What the user sees:** Chrome is the page-frame header (wordmark + menu/language inside the rounded sheet). Page heading **Living room rules**, then the lead paragraph with the accent-bordered **The test** callout, three rule cards (kicker **Rule n**, title, body, and a **The test** callout on rules 1 and 2), the Welcome / Allowed / Better not / Forbidden lists as bordered cards with check / minus / cross glyphs (Forbidden has three subheads), the muted **Our house** closing block, and one CTA **Contact 21.gifts** (`/contact`). There is no second back in the document. Unsigned (no session): one top-left arrow that returns to the previous in-app view in this tab, or `/welcome` when this tab has none, wordmark → `/` (the wordmark is not that control), LanguageSwitcher. Hydrated session: `ProfileChromeLeft` (the same arrow; wordmark → `/welcome`) + `SignedInChrome` (Menu with the account header, then **Home** and **Balance**). `IntroduceYourselfOverlay` never opens here; only `/welcome` shows it.
- **Actions:** Change language (unsigned), or open **Menu** (signed-in). The top-left arrow returns to the previous in-app view in this tab, or `/welcome` when this tab has none. One arrow. Read the rules. Open contact. There is no second forum CTA.
- **Calls:** `RulesPageChrome`, `PageChrome`, `AppShell`, `Wordmark`, `ProfileChromeLeft`, `SignedInChrome`, `RulesPage`, `RulesDocument`, `LanguageSwitcher`.
- **Auth:** None required to view; chrome depends on hydrated session.

### Variant: default

Full rules body with rule card **Only free donations** visible.

![21.gifts living room rules](images/rules.png)

### Variant: signed-in

Hydrated Ada session: one top-left arrow (previous in-app view, or `/welcome` when this tab has none) + wordmark → `/welcome`. The wordmark is not that control. **Menu** top-right (account header, then **Home** and **Balance**). Rule card **Only free donations** still visible.

![21.gifts living room rules signed in](images/rules-signed-in.png)

## Screen: /habit-tracker

- **URL:** `/habit-tracker` — public habit tracker. Every member's habits, periods, and comments. Signed-out visitors can read it. `OnboardingGate screen="welcome"` with `allowGuest`. HTML `/habit-tracker` is the page, not a GET proxy (Next.js forbids `route.ts` beside this page). JSON is `GET /habits` and `POST /habits`.
- **What the user sees:** Chrome is the page-frame header (`ProfileChromeLeft` and either **Log in** or Menu, inside the rounded sheet). The page is a server component; `HabitTrackerTopRight` is the client boundary for that corner. Fill `AppShell` (`align="center"`). Heading **Habit-Tracker**. The schedule line says each habit is daily or weekly in the time zone chosen when it was created, a week can be rated from Monday 08:00 in that zone. People are grouped under their `ownerName`. Each habit is the same note card as a living-room note: name, a Daily or Weekly chip, an Archived chip when it has a last period, the public description when one is set, and one row per period (the date, then Achieved, Partially achieved, Not achieved, or Not rated yet). Comments are public and are not forum posts. Internal notes render only for the owner (`Internal notes:` plus the text). A signed-out visitor uses the header **Log in** and gets no second sign-in link, no add form, no rating pill, and no **Send Bitcoin**. A session sees an add form (Name, Description, Internal notes, a Daily | Weekly pill, **Add habit**). On each of their open habits every returned period is that same pill (Achieved, Partially achieved, Not achieved; nothing pressed when that period is not rated yet). A saved rating leaves that choice pressed. An archived habit keeps those period rows, its comments, and **Send Bitcoin** on someone else's comment, and shows the Archived chip, with no rating pill, Edit, or Archive. **Edit** opens Name, Description, and Internal notes. **Save** and **Cancel** are icons; their accessible names are Save and Cancel, and the word Save is not visible. **Archive** opens the same inline confirm as deleting a note: the sentence, then a check named Confirm archive and an X named Cancel archive. A signed-in account sees **Write a comment** and **Post** on each habit. On the device's local Sunday those controls and **Delete comment** are removed and **Writing is paused on Sunday.** stands in their place. Add, the rating pill, Edit, and Archive stay on Sunday. **Send Bitcoin** (the same Gift control as a forum reply) is on someone else's comment and opens the same amount sheet. On Sunday that gift shows **Zapping is paused on Sunday.** Menu row **Habit-Tracker** (`nav.habitTracker`, lucide `ListChecks`, `/habit-tracker`) sits immediately after **Living room rules** for every signed-in account.
- **Actions:** Read the list. Sign in. Add a habit. Edit name, description, and internal notes. Rate any returned period on an open habit Achieved, Partially achieved, or Not achieved. An archived habit stays read-only for rating, edit, and archive, and keeps its comments and gift. Archive after confirm. A failed save keeps the list and shows **Could not load or save the tracker. Please try again.** with **Try again** above it. A failed edit keeps that form open under the alert. A failed archive keeps the confirmation open under the alert. A failed add keeps the entered form under the alert. A failed comment keeps that draft under the alert. Saving a new habit, saving an edit, posting a comment, and confirming a comment deletion each leave their own result. An initiator sees **Delete comment** before that confirm. **Try again** reloads and does not send that same action again. A different session may send it. **Try again**, and a later load after the session changes, keep that list when the next `GET /habits` also fails. The full-screen error is only when nothing has loaded. Add, comment, delete, and the invoice send `Time-Zone`. Edit, log, and archive do not. Post a comment. Delete a comment when the account is at least initiator, after the same inline confirm. The check is named Confirm deletion and the X is named Cancel deletion. On the device's local Sunday comment, delete, and the gift are paused. Add, rating, Edit, and Archive are not. Open **Send Bitcoin**, enter an amount, press **Continue**, and pay from the same invoice card as a forum reply. **Continue** stays disabled until the spot rate read has settled. **Continue** stays disabled and shows a spinner while the invoice request is in flight. A settled request with no usable rate still allows **Continue**, and the fiat line stays absent. An amount that is not a whole number of sats from 1 through 10,000,000 shows `Expected a JSON body with an integer "amountSats"` and does not open the invoice. A payment that cannot be started shows **Could not start the Bitcoin payment**. Too many payments shows **Too many payments. Please wait a moment and try again.** A wallet that cannot receive the payment shows **The author's wallet cannot receive this Bitcoin payment**. The top-left arrow returns to the previous in-app view in this tab, or `/welcome` when this tab has none. One arrow. The wordmark is not that control.
- **Calls:** `AppShell`, `ProfileChromeLeft`, `HabitTrackerTopRight`, `HabitTrackerPage`, `MemberHabits`, `HabitComments`, `ForumPaySheet`, `useSpotRateState`, `SundayWritingGate`, `SignedInChrome`, `OnboardingGate`, `fetchMemberHabits`, `postMemberHabit`.
- **Auth:** No bearer required to read the page or `GET /habits`. `POST /habits` needs a bearer. `OnboardingGate screen="welcome"` with `allowGuest`. The page does not pay an invoice.

### Variant: default

Signed-out list. Heading **Habit-Tracker**, Ada's habit **Walk** with description **Outside**. The header **Log in** is the only sign-in control. No rating buttons and no **Send Bitcoin**.

![21.gifts habit tracker](images/habit-tracker.png)

### Variant: empty

Signed-out page with **No habits yet.** The schedule line names the daily or weekly cadence and Monday 08:00. It does not name a comment window.

![21.gifts habit tracker empty](images/habit-tracker-empty.png)

### Variant: loading

Signed-out page. **Loading…** while `GET /habits` is in flight.

![21.gifts habit tracker loading](images/habit-tracker-loading.png)

### Variant: error

Signed-out page. **Could not load or save the tracker. Please try again.** and **Try again**.

![21.gifts habit tracker error](images/habit-tracker-error.png)

### Variant: signed-in

Ada's session. **Menu** is top-right. Her habit shows **Internal notes:** and **secret**, the rating pill **Achieved**, and **Add habit**. Bea's comment shows **Send Bitcoin**.

![21.gifts habit tracker signed in](images/habit-tracker-signed-in.png)

### Variant: menu-open

Ada's session. **Menu** is open on this page. **Habit-Tracker** is in the menu. The closed signed-in page does not cover this.

![21.gifts habit tracker menu open](images/habit-tracker-menu-open.png)

### Variant: add-weekly

Ada's session. **Weekly** is selected on the new-habit cadence. The signed-in page shows **Daily** selected and does not cover this.

![21.gifts habit tracker add weekly](images/habit-tracker-add-weekly.png)

### Variant: rated-achieved

Ada's session. She pressed **Achieved** on her open habit and the tracker returned that status. **Achieved** is pressed. The signed-in page shows the period not rated yet and does not cover this.

![21.gifts habit tracker rated achieved](images/habit-tracker-rated-achieved.png)

### Variant: rated-partial

Ada's session. She pressed **Partially achieved** on her open habit and the tracker returned that status. **Partially achieved** is pressed. The achieved rating does not cover this.

![21.gifts habit tracker rated partial](images/habit-tracker-rated-partial.png)

### Variant: rated-missed

Ada's session. She pressed **Not achieved** on her open habit and the tracker returned that status. **Not achieved** is pressed. The other ratings do not cover this.

![21.gifts habit tracker rated missed](images/habit-tracker-rated-missed.png)

### Variant: donate

Ada's session on someone else's comment. **Send Bitcoin** is open. **Amount** and **Continue** are visible.

![21.gifts habit tracker donate](images/habit-tracker-donate.png)

### Variant: donate-rate-pending

Ada's session on someone else's comment. **Send Bitcoin** is open while the spot rate is still loading. The sheet is scrolled so **Continue** is on screen and stays disabled, and no fiat line is shown.

![21.gifts habit tracker donate rate pending](images/habit-tracker-donate-rate-pending.png)

### Variant: donate-fiat

Ada's session on someone else's comment. **Send Bitcoin** is open and the amount switch is on **USD**. The field shows the fiat figure, and the bitcoin equivalent sits under it.

![21.gifts habit tracker donate fiat](images/habit-tracker-donate-fiat.png)

### Variant: donate-invoice

Ada's session after **Continue** on someone else's comment. The card shows **Pay ₿21** and the in-app wallet pay slot; in this build the wallet is not configured, so it says **Your 21.gifts wallet is not available here, so this cannot be paid.** No invoice QR. The raw invoice is not shown.

![21.gifts habit tracker donate invoice](images/habit-tracker-donate-invoice.png)

### Variant: donate-habit-amount

Ada's session. **Send Bitcoin** is open. **Continue** was pressed with an amount that is not a whole number of sats from 1 through 10,000,000. The sheet shows **Expected a JSON body with an integer "amountSats"**.

![21.gifts habit tracker donate habit amount](images/habit-tracker-donate-habit-amount.png)

### Variant: donate-request

Ada's session. **Send Bitcoin** is open. **Continue** was pressed and the payment could not be started. The sheet shows **Could not start the Bitcoin payment**.

![21.gifts habit tracker donate request](images/habit-tracker-donate-request.png)

### Variant: donate-request-pending

Ada's session. **Send Bitcoin** is open. **Continue** was pressed and the payment request has not finished. **Continue** stays disabled and shows a spinner. The failed-request sheet does not cover this.

![21.gifts habit tracker donate request pending](images/habit-tracker-donate-request-pending.png)

### Variant: donate-rate-limit

Ada's session. **Send Bitcoin** is open. **Continue** was pressed and the payment was refused for too many payments. The sheet shows **Too many payments. Please wait a moment and try again.**

![21.gifts habit tracker donate rate limit](images/habit-tracker-donate-rate-limit.png)

### Variant: donate-author-wallet

Ada's session. **Send Bitcoin** is open. **Continue** was pressed and the author's wallet cannot receive the payment. The sheet shows **The author's wallet cannot receive this Bitcoin payment**.

![21.gifts habit tracker donate author wallet](images/habit-tracker-donate-author-wallet.png)

### Variant: sunday

Ada's session on the device's local Sunday. **Add habit**, **Edit**, **Archive**, and the rating pill stay. **Write a comment**, **Post**, and **Delete comment** are gone, and **Writing is paused on Sunday.** stands in their place. **Send Bitcoin** is gone, and **Zapping is paused on Sunday.** stands in its place.

![21.gifts habit tracker sunday](images/habit-tracker-sunday.png)

### Variant: editing

Ada's session after **Edit** on her open habit. Name, Description, and Internal notes are open. **Save** and **Cancel** are icons. The word Save is not visible.

![21.gifts habit tracker editing](images/habit-tracker-editing.png)

### Variant: archive-confirm

Ada's session after **Archive** on her open habit. The card shows **Archive this habit? Its history stays visible.** with icon buttons named Confirm archive and Cancel archive. The words are not on the buttons.

![21.gifts habit tracker archive confirm](images/habit-tracker-archive-confirm.png)

### Variant: delete-comment

Ada's session, at least an initiator, before **Delete comment** is pressed. The trash control named Delete comment is on someone else's comment. The confirmation is not open.

![21.gifts habit tracker delete comment](images/habit-tracker-delete-comment.png)

### Variant: delete-comment-confirm

Ada's session, at least an initiator, after **Delete comment** on someone else's comment. The card shows **Delete this comment from the Habit-Tracker?** with icon buttons named Confirm deletion and Cancel deletion.

![21.gifts habit tracker delete comment confirm](images/habit-tracker-delete-comment-confirm.png)

### Variant: delete-comment-error

Ada's session, at least an initiator. **Confirm deletion** was pressed and the save failed. The alert **Could not load or save the tracker. Please try again.** and **Try again** sit above the list. The confirmation is closed, the comment is still there, and **Delete comment** is visible again. The edit form and the archive confirmation are not open.

![21.gifts habit tracker delete comment error](images/habit-tracker-delete-comment-error.png)

### Variant: archived

Ada's session after **Confirm archive**. The habit shows the **Archived** chip, the period row (including **Not rated yet**), the comment, and **Send Bitcoin**. The rating pill, **Edit**, and **Archive** are gone.

![21.gifts habit tracker archived](images/habit-tracker-archived.png)

### Variant: save-error

Ada's session. A rating failed while the list was already loaded. The alert **Could not load or save the tracker. Please try again.** and **Try again** sit above the habit list, which stays visible. The edit form and the archive confirmation are not open. This is not the signed-out load failure.

![21.gifts habit tracker save error](images/habit-tracker-save-error.png)

### Variant: edit-save-error

Ada's session. **Edit** is open and **Save** failed. The same alert and **Try again** sit above the list. Name, Description, Internal notes, **Save**, and **Cancel** stay open. The archive confirmation is not open.

![21.gifts habit tracker edit save error](images/habit-tracker-edit-save-error.png)

### Variant: archive-confirm-error

Ada's session. **Confirm archive** was pressed and the save failed. The same alert and **Try again** sit above the list. **Archive this habit? Its history stays visible.** stays, with Confirm archive and Cancel archive. The edit form is not open.

![21.gifts habit tracker archive confirm error](images/habit-tracker-archive-confirm-error.png)

### Variant: add-error

Ada's session. **Add habit** was pressed with Name **Stretch** and the save failed. No habit was stored. The alert **Could not load or save the tracker. Please try again.** and **Try again** stay above **No habits yet.** The Name field still shows **Stretch**. The edit form and the archive confirmation are not open.

![21.gifts habit tracker add error](images/habit-tracker-add-error.png)

### Variant: comment-error

Ada's session. **Post** was pressed with the draft **still here** and the save failed. The same alert and **Try again** stay. **Write a comment** still shows **still here**. The edit form and the archive confirmation are not open.

![21.gifts habit tracker comment error](images/habit-tracker-comment-error.png)

### Variant: add-saved

Ada's session after **Add habit** saved **Stretch**. That habit is on the list and the add form Name field is empty.

![21.gifts habit tracker add saved](images/habit-tracker-add-saved.png)

### Variant: edit-saved

Ada's session after **Save** on an open edit. The habit name is **Stretch**. The edit form is closed.

![21.gifts habit tracker edit saved](images/habit-tracker-edit-saved.png)

### Variant: comment-posted

Ada's session after **Post**. The new comment **kept this** is on the habit.

![21.gifts habit tracker comment posted](images/habit-tracker-comment-posted.png)

### Variant: comment-deleted

Ada's session, at least an initiator, after **Confirm deletion**. The comment is gone and the card says **No comments yet.**

![21.gifts habit tracker comment deleted](images/habit-tracker-comment-deleted.png)

## Screen: /contact

- **URL:** `/contact` — signed-in in-app contact (the only way to reach 21.gifts). Same onboarding gate as `/welcome` (`account.setup` null; name may be skipped; username and living-room rules agreement required).
- **What the user sees:** Fill `AppShell` with one top-left arrow (`ProfileChromeLeft`; previous in-app view, or `/welcome` when this tab has none) and wordmark → `/welcome` top-left and one **Menu** top-right (see **Signed-in header**); open the Menu for **Home**, **Balance**, **Shops**, **Point of sale**, Profile, **Grants**, **Settings**, **Living room rules**, **Habit-Tracker**, **Trust Chain**, **Statistics**, **Notifications**, **Messages**, **Contact**, optional **Install app**, and **Log out**. Heading **Contact**, lead **Write to 21.gifts here — there is no email address. This is the only way to reach us.**, link to **Living room rules**, composer textarea with an icon-only **Send** control (`contact.send` catalog `aria-label`, no visible Send text). A missing name, username, or rules agreement opens `RequirementsOverlay` (no Skip) before the send retries. A wallet is not required for contact. A successful send opens the official 21.gifts thread in `/messages`. `IntroduceYourselfOverlay` never opens here; only `/welcome` shows it.
- **Actions:** Send a message, complete a `RequirementsOverlay` for a missing name, username, or rules agreement, open the rules; the top-left arrow returns to the previous in-app view in this tab, or `/welcome` when this tab has none; open **Menu** (see **Signed-in header**) for **Home**, **Balance** (`/wallet`), **Shops**, **Point of sale**, Profile, **Grants**, **Settings**, **Living room rules**, **Habit-Tracker**, **Trust Chain**, **Statistics**, **Notifications**, **Messages**, **Contact**, optional **Install app**, or **Log out**.
- **Calls:** `AppShell`, `ProfileChromeLeft`, `ContactPage`, `ContactLoader`, `ContactScreen`, `RequirementsOverlay`, `SignedInChrome`, `OnboardingGate`, `postContact` (`POST /contact/submit`), `fetchConversations`.
- **Auth:** Bearer session; `OnboardingGate screen="welcome"`.

### Variant: default

Idle composer with lead and rules link.

![21.gifts contact](images/contact.png)

### Variant: validation-error

Click **Send** with an empty composer → **Enter a message**.

![21.gifts contact validation error](images/contact-validation-error.png)

### Variant: success

After a successful send the app navigates to `/messages?c=` and shows the official **21.gifts** thread (the message body, not a dead-end thank-you sentence). Composer with ImagePlus attach visible. The message and send share one row; the amount sits under the message.

![21.gifts contact success](images/contact-success.png)

## Screen: /members/[accountId]

- **Purpose:** Signed-in member identity card (chart, About me inside the card — not a forum post, name, location, public `username@21.gifts`, role pill, copy-profile-link, and clickable post/reply counts from `postCount` / `replyCount`) with on-demand activity feeds below the card. A successful empty series and in-flight activity show `profile.chartEmpty` (**No gifts yet.**); a thrown activity load shows `profile.chartError` (**Could not load gifts.**); the chart never says **Loading…** and has no retry control. Location is read-only. Own profiles use this route too (forum author names navigate here, not `/profile`). When the viewer is a moderator and the subject is someone else, staff Trust Chain actions (Verify, Propose, Confirm, or Appoint) and the already-on-chain link sit behind the closed **Moderator functions** disclosure, not always visible. About me is not a `ForumBoard` post; **Translate** (Languages icon) sits on the About me text when `profileMessage.id` is set, and in the footer icon row with react / copy on feed notes and replies via `TranslatableNoteBody` (`controlSlotId`), which portals `NoteTranslate`, when the language differs from the UI locale. Heart (lucide Heart, `forum.heart` “Send ₿1”) is icon-only in that same footer row after Translate and before React or Gift; it shows on a note or reply that is not deleted, not the viewer's own, and whose author can receive (`payable`), including a signed-out card, and never on the external author profile; a signed-out or read-only tap does nothing; a payable tap vibrates and shows the filled heart before payment; `+1` appears only after the payment succeeds. The in-card reply composer includes an **Amount** sats field; empty text and an empty amount invoices 21 sats; a reply with text and an empty amount is unpaid for a verified member, otherwise 1 sat to 21.gifts on the composer slot (`payHost: composer`, `payMessageId` = compose-target note); extra gifts and Gift-open stay on the card (`payHost: card`); an amount of 0 is billed as 1 sat. Visible inline photos on the posts feed and replies feed (the stacked activity list) load via `fetchMessagePhoto` blob URLs, same as the home forum top-level cards. Top-level posts with a positive `goalSats` show `ForumGoalBar` (orange through 100%, in-flow green overflow, uncapped percent), same as `/welcome`. Blob URLs may also be fetched for expanded thread replies, but ForumBoard does not paint photos on nested replies. A missing name or rules agreement on a reply opens `RequirementsOverlay` (no Skip); a missing wallet is explained in the same dialog. `IntroduceYourselfOverlay` never opens here; only `/welcome` shows it. When a username is set, a centered `QrCode` (label `profile.giftsQr`) under the address encodes `openCryptoPayQrValue` (`https://<domain>/pl/?lightning=` plus the uppercase LNURL of `https://<domain>/.well-known/lnurlp/<local>`), including on a smartphone. A missing username shows no QR. Under that QR a labeled **Shop sticker** button (`profile.shopSticker`, `Button size="sm" variant="secondary"`) opens `ShopStickerOverlay`: a preview of a printable shop-window sticker carrying the same `openCryptoPayQrValue`, and a download as PDF (vector, 134.4 mm), PNG or JPG (3000 px), or SVG. The files are made in the browser (`shopStickerBlob`); nothing is sent to the api. Every pay sheet on this screen (a gift, a paid reaction, or a paid reply) follows the same in-app wallet rule as the forum pay sheet on `/welcome`: it pays from the in-app wallet only (the `sparkInvoice`, otherwise the `pr`); without a usable wallet it shows the unavailable or failed state, never an invoice QR or a link to another wallet app.
- **Inputs:** Bearer session; `accountId` UUID; `GET /forum/members/:id` for the profile and activity counts; `GET /forum/members/:id/activity` even before the member's wallet is verified; `GET /fx/spot` (via `useSpotRate`) for the spot rate when a feed amount or ask has no stored string for the visitor's currency, and for unsent previews (a stored string is shown as-is; no FiatPicker on the chart or the feed — member profiles are always signed-in); on-demand `GET /forum/members/:id/posts` or `GET /forum/members/:id/replies` for the selected feed.
- **Actions:** Open **Menu** (see **Signed-in header**) for **Home**, **Balance** (`/wallet`), **Shops**, **Point of sale**, Profile, **Grants**, **Settings**, **Living room rules**, **Habit-Tracker**, **Trust Chain**, **Statistics**, **Notifications**, **Messages**, **Contact**, optional **Install app**, or **Log out**, then a quiet **Version {version}** line (`app.version`); the top-left arrow returns to the previous in-app view in this tab, or `/welcome` when this tab has none; expand role hint; copy the profile link (`profile.copyLink` **Copy link to this profile** → origin `/l/` plus the first 8 hex chars of the account id); Message on the card when another member has a `profileMessage`; translate a foreign-language About me text when `profileMessage.id` is set, and a foreign-language feed note or reply (**Translate**, Languages icon, / Show original / Show translation); click **1 post** or **N posts** (`profile.postCount`) or **1 reaction** or **N reactions** (`profile.replyCount`) to open that `ForumBoard` feed below the card, or click the pressed count again to collapse it. Posts show React and do not show Send Bitcoin; a payable reply card in the replies feed shows Gift. Expanding a reply with a `parentId` navigates to `/messages/{parentId}`. Verified members may post unpaid replies; below verified a text reply invoices 1 sat to 21.gifts on the composer slot (`payHost: composer`, `payMessageId` = compose-target note); extra gifts and Gift-open stay on the card (`payHost: card`). When a listed feed is shorter than its count, a muted `profile.activityLatest` truncation line shows the displayed and total counts. Inline photos load via `fetchMessagePhoto` blob URLs, same as the forum. Complete a `RequirementsOverlay` for a missing name or rules agreement before a reply. Staff viewing another member can Verify, Propose, Confirm, or Appoint after opening the closed **Moderator functions** disclosure; already-on-chain is a link behind the same disclosure. When a username is set, press **Shop sticker**, pick PDF, PNG, JPG, or SVG, and **Download** the file `21gifts-shop-sticker-<username>.<format>`; a failure shows an alert and the next try clears it. The identity card has no edit. A moderator sees **Edit shop note** on a shop post in the posts feed.
- **Used by:** Route `/members/[accountId]` (`MemberProfilePage` / `MemberProfileLoader` / `MemberProfileScreen`).
- **Auth:** Bearer; `OnboardingGate screen="profile"`.

### Variant: default

Member identity card with About me inside the card when `aboutMe` is set; read-only location; Message on the card when another member has a `profileMessage`. Not a forum post. A successful empty series and in-flight activity show `profile.chartEmpty` (**No gifts yet.**); a thrown activity load shows `profile.chartError` (**Could not load gifts.**); the chart never says **Loading…** and has no retry control.

![21.gifts member profile](images/members.png)

### Variant: posts-open

Identity card with counts; posts button pressed; post card 'Second post from Carol.' in the feed.

![21.gifts member posts open](images/members-posts-open.png)

### Variant: mention-suggest-reply

Posts are open, Carol's note is expanded, its reaction field contains `@`, and the People list is open.

![21.gifts member reply mention suggestions](images/members-mention-suggest-reply.png)

### Variant: mention-inserted-reply

Choosing `@ada` from that open list writes `@ada ` into the reaction field and closes the list.

![21.gifts member reply mention inserted](images/members-mention-inserted-reply.png)

### Variant: posts-open-photo

Identity card; posts pressed; profile note hidden; the listed post has `hasPhoto` and shows the inline photo (`Photo from Carol`) above the text, same ForumBoard paint as `/welcome` `photo`.

![21.gifts member posts open with photo](images/members-posts-open-photo.png)

### Variant: posts-open-goal-110

Identity card; posts pressed; profile note hidden; the listed post has `sats: 23100` and `goalSats: 21000`. The ask is defined in bitcoin, so `ForumGoalBar` names **Ask ₿21'000 · $21.00** and the note amount is **₿23'100 · $23.10** (viewer USD from the spot rate). Full orange plus in-flow green overflow and label **110%**, same as `/welcome` `goal-110`.

![21.gifts member posts open with 110 percent goal](images/members-posts-open-goal-110.png)

### Variant: posts-open-goal-fiat

Identity card; posts pressed; the listed English post is defined as **$1.50** with frozen **₿1'000** and label **0%**. No second dollar amount. The note matches the UI language, so the card does not offer Translate. The received amount is **₿0 · $0.00**.

![21.gifts member posts open with fiat goal](images/members-posts-open-goal-fiat.png)

### Variant: posts-open-goal-credit

Identity card; posts pressed; the listed post has `sats: 10500`, `goalSats: 21000`, `goalRepayable: true`, and `goalTermDays: 30`. The ask is defined in bitcoin, so the bar shows **Ask ₿21'000 · $21.00**, the note amount **₿10'500 · $10.50**, a **Loan** tag and **To repay per day: ₿700 · $0.70 per day for 30 days.** Label **50%**. The post offers **Who gave and who is paid back**.

![21.gifts member posts open with credit goal](images/members-posts-open-goal-credit.png)

### Variant: posts-open-loan-tag-open

Same post as **posts-open-goal-credit**, after **Loan** is pressed. A line under the name says a loan is paid back.

![21.gifts member posts loan tag open](images/members-posts-open-loan-tag-open.png)

### Variant: posts-open-donation-tag-open

Same post as **posts-open-goal-110**, after **Donation** is pressed. A line under the name says a donation is a gift and is not paid back.

![21.gifts member posts donation tag open](images/members-posts-open-donation-tag-open.png)

### Variant: posts-open-goal-credit-open

Same member, after **Who gave and who is paid back** is pressed on a filled credit. **Given** lists Bea. **Paid back** shows the chart and Bea's share **Due**.

![21.gifts member posts credit ledger open](images/members-posts-open-goal-credit-open.png)

### Variant: posts-open-repay-today

Identity card of the signed-in member; posts pressed; the listed post is her own filled credit (`accountId` matches the signed-in account, `sats` equals `goalSats`). **Pay today's repayment** is visible. The plan stays closed.

![21.gifts member posts repay today](images/members-posts-open-repay-today.png)

### Variant: posts-open-repay-today-error

Same funded credit note as **posts-open-repay-today**, after **Pay today's repayment** is pressed. The POST failed, and the alert **The author's wallet cannot receive this Bitcoin payment** is visible. There is no invoice QR.

![21.gifts member posts repay today error](images/members-posts-open-repay-today-error.png)

### Variant: posts-open-repay-today-invoice

Same note as **posts-open-repay-today**, after **Pay today's repayment** is pressed. The invoice card is open with the in-app wallet pay slot; in this build the wallet is not configured, so it says **Your 21.gifts wallet is not available here, so this cannot be paid.** No invoice QR. The amount form is not shown.

![21.gifts member posts repay today invoice](images/members-posts-open-repay-today-invoice.png)

### Variant: posts-open-photos

Identity card; posts pressed; profile note hidden; the listed post has `hasPhoto` and `photoCount: 2` and shows two stills (`Photo from Carol`) in `ForumPhotoGallery` (horizontal snap row, `data-scroll-x`, 88% peek, `1/2` chip, dots) above the text, same ForumBoard paint as `/welcome` `photos`.

![21.gifts member posts open with photos](images/members-posts-open-photos.png)

### Variant: replies-open

Identity card; replies pressed; no pinned profile-note card; reply card 'A reply from Carol.'

![21.gifts member replies open](images/members-replies-open.png)

### Variant: posts-loading

Identity card; posts count pressed; feed shows Loading…; no pinned profile-note card.

![21.gifts member posts loading](images/members-posts-loading.png)

### Variant: replies-loading

Identity card; replies count pressed; feed shows Loading…; no pinned profile-note card.

![21.gifts member replies loading](images/members-replies-loading.png)

### Variant: posts-error

Identity card; posts count pressed; feed error `Could not load messages. Please try again.` and Try again; no pinned profile-note card. Shown only when the list itself cannot be read; one note that cannot be shown (an empty About me note) is left out and the other posts render.

![21.gifts member posts error](images/members-posts-error.png)

### Variant: replies-error

Identity card; replies count pressed; feed error and Try again; no pinned profile-note card.

![21.gifts member replies error](images/members-replies-error.png)

### Variant: posts-truncated

Identity card; posts count 3 pressed; one listed post; muted `Showing the latest 1 of 3.`; no pinned profile-note card.

![21.gifts member posts truncated](images/members-posts-truncated.png)

### Variant: replies-truncated

Identity card; replies count 3 pressed; one listed reply; muted `Showing the latest 1 of 3.`; no pinned profile-note card.

![21.gifts member replies truncated](images/members-replies-truncated.png)

### Variant: note-null

Member identity card only (`profileMessage: null`, `aboutMe` null); copy-profile-link still on the card; no About me heading; no forum card. A member who saved an empty About me looks the same: a profile note with no text, no media, and 0 sats reads as no note, so the profile does not fail to load.

![21.gifts member profile without note](images/members-note-null.png)

### Variant: missing

Malformed or unknown id → **This profile could not be found.**

![21.gifts member profile missing](images/members-missing.png)

### Variant: error

Failed fetch → error copy and **Try again**.

![21.gifts member profile error](images/members-error.png)

### Variant: own

Signed-in visitor viewing their own `/members/:id` card.

![21.gifts member profile own](images/members-own.png)

### Variant: overlay-wallet

Named visitor with living-room rules agreed whose wallet is not set up (the api lists `lightning-address` as missing). Posts feed open, listed note expanded, reply filled with the **Amount** field visible, **Post** clicked. `RequirementsOverlay` dialog **Your wallet is not set up** with the sentence that gifts and posts need the member's own 21.gifts wallet and the labeled link **Open your wallet** to `/wallet`. No form and no **Skip**. Close (X) is present.

![21.gifts member overlay wallet](images/members-overlay-wallet.png)

### Variant: overlay-username

Named visitor with living-room rules agreed and no username. Posts feed open, listed note expanded, reply filled with the **Amount** field visible, **Post** clicked. `RequirementsOverlay` dialog **Add your 21.gifts name** with `UsernameForm variant=overlay`. No **Skip**. Close (X) is present.

![21.gifts member overlay username](images/members-overlay-username.png)

### Variant: translate

Signed-in `/members/:id` with a German post in the posts feed. **Translate** is visible in the footer icon row with react / copy.

![21.gifts member translate](images/members-translate.png)

### Variant: translate-loading

Same German post after clicking **Translate** while POST `/translate` hangs. The control is busy (`aria-busy`) with a spinner.

![21.gifts member translate loading](images/members-translate-loading.png)

### Variant: translate-done

Same German post after a successful translation. Translated body plus **Show original**; the German original is not shown.

![21.gifts member translate done](images/members-translate-done.png)

### Variant: translate-hidden

After **Show original**: translated body hidden, the Languages icon is named **Show translation** and has no visible text.

![21.gifts member translate hidden](images/members-translate-hidden.png)

### Variant: translate-error

Same German post after POST /translate fails. Alert **Could not translate this note. Please try again.** and the Translate control remains.

![21.gifts member translate error](images/members-translate-error.png)

### Variant: heart-needs-balance

Same German post in the posts feed after stubbing POST /messages/*/invoice to 400 `wallet_required` and clicking Send ₿1. Copy **A Bitcoin balance is required for this.**

![21.gifts member heart needs balance](images/members-heart-needs-balance.png)

### Variant: heart-paid

Same German post after opening `?visual=heart-paid` and clicking Send ₿1. The paid mark **+1** is visible.

![21.gifts member heart paid](images/members-heart-paid.png)

### Variant: heart-unavailable

Same German post after stubbing POST /messages/*/invoice to 503 `HEART_UNAVAILABLE` and clicking Send ₿1. Nothing is sent; the heart stays empty. Copy **Hearts are not available right now.**

![21.gifts member heart unavailable](images/members-heart-unavailable.png)

### Variant: heart-pending

Same German post after opening `?visual=heart-pending` and clicking Send ₿1: the send timed out and its outcome is not known yet. The heart stays filled, no **+1**, and another tap on this note does not pay. Copy **Your last heart is still on its way. Try again in a moment.**

![21.gifts member heart pending](images/members-heart-pending.png)

### Variant: about-translate

Signed-in `/members/:id` with a German About me. **Translate** is visible under the About me body.

![21.gifts member about translate](images/members-about-translate.png)

### Variant: about-translate-loading

Same German About me after clicking **Translate** while POST `/translate` hangs. The control is busy (`aria-busy`) with a spinner.

![21.gifts member about translate loading](images/members-about-translate-loading.png)

### Variant: about-translate-done

Same German About me after a successful translation. Translated body plus **Show original**; the German original is not shown.

![21.gifts member about translate done](images/members-about-translate-done.png)

### Variant: about-translate-hidden

After **Show original**: translated body hidden, the Languages icon is named **Show translation** and has no visible text.

![21.gifts member about translate hidden](images/members-about-translate-hidden.png)

### Variant: about-translate-error

Same German About me after POST /translate fails. Alert **Could not translate this note. Please try again.** and the Translate control remains.

![21.gifts member about translate error](images/members-about-translate-error.png)

### Variant: staff-verify

Signed-in **moderator** viewing another member who is **basis**. Staff card with the closed **Moderator functions** disclosure, a `details` / `summary` row (`data-testid="state-members-staff-verify"`); Verify is not visible until it is opened. The pressed result is **staff-verify-open**.

![21.gifts member staff verify](images/members-staff-verify.png)

### Variant: staff-verify-open

Same moderator and basis member after pressing **Moderator functions**. The disclosure is expanded and **Verify** is visible. Viewport capture after scrolling **Verify** into view: the member card scrolls inside the page frame, and a full-page stitch leaves **Verify** below the fold. The closed shot does not cover this result.

![21.gifts member staff verify open](images/members-staff-verify-open.png)

### Variant: sunday

Device-local Sunday. **Moderator functions** is open. **Verify** is gone. **Writing is paused on Sunday.**

![21.gifts member sunday](images/members-accountId-sunday.png)

### Variant: funding-reviewed

Member identity card with a **Verified** role pill and, beside it, one icon-only funding-program button when `fundingReviewedAt` is a number. The accessible name is **Takes part in the 21.gifts funding program since {date}**, or the same sentence with **reviewed by {name}** when the API sends `fundingReviewedByName`. The member card and the own profile name the person who admitted them when the API sends that name. The sentence is not visible until the icon is pressed. The resting shot does not cover the press.

![21.gifts member funding reviewed](images/members-funding-reviewed.png)

### Variant: funding-program-open

Same card after pressing the funding-program icon. One status line **Takes part in the 21.gifts funding program since {date}**. No second line.

![21.gifts member funding program open](images/members-funding-program-open.png)

### Variant: sticker-open

Desktop member card after pressing **Shop sticker** under the Open CryptoPay QR: `ShopStickerOverlay` (scrim `bg-app-overlay`, `Card maxWidth="xl"`, icon-only **Close**) with the title **Shop sticker**, the lead **Print it for a shop window. The QR code pays {handle}.**, a closed **Second language** menu showing **None (English only)**, a preview of the printable sticker for this member (orange band with the Bitcoin mark and the English scan text only, no second-language headline, sari-sari shop with the 21.gifts sign, the member's QR with the orange Open CryptoPay mark), the **File format** choice PDF | PNG | JPG | SVG (PDF selected), and a labeled **Download**. Escape also closes. Mobile combos (iPhone UA) open the same dialog as desktop. The closed card does not cover this result. These shots use the English UI. Without a known `lang`, the sticker is English only.

![21.gifts member shop sticker open](images/members-sticker-open.png)

### Variant: sticker-kikamba

`/members/[accountId]?lang=Kikamba` opens `ShopStickerOverlay` immediately. The preview is the English/Kikamba sticker (Kikamba instead of TINATANGGAP DITO / Filipino scan text). Same chrome: **Second language** showing **Kikamba** above the preview, PDF selected, **Download** below it. Mobile combos match desktop. Needle `state-members-sticker-kikamba`.

![21.gifts shop sticker Kikamba](images/members-sticker-kikamba.png)

### Variant: sticker-lang

Same overlay after opening **Second language**. The list opens downward over the preview. Options, top to bottom: **None (English only)** (selected), **Spanish**, **German**, **French**, **Filipino**, **Kikamba**. The dialog stays open. Mobile combos match desktop. Needle `state-members-sticker-lang`. These shots use the English UI.

![21.gifts shop sticker language menu](images/members-sticker-lang.png)

### Variant: sticker-busy

Same overlay while **Download** is making the file (here PNG, whose canvas encode is still running): **Download** is disabled until `shopStickerBlob` settles; the preview, the format choice and **Close** stay usable. Mobile combos open the same overlay as desktop.

![21.gifts member shop sticker busy](images/members-sticker-busy.png)

### Variant: sticker-failed

Same overlay after **Download** failed (here PNG with a browser that cannot encode the canvas): `role="alert"` **Could not create the file. Please try again.** above **Download**; the next try clears it. Mobile combos open the same overlay as desktop.

![21.gifts member shop sticker failed](images/members-sticker-failed.png)

### Variant: shop-edit

A moderator viewing another member. The posts feed is open and holds one shop post **Cafe Luna**. The footer shows **Edit shop note**. The editor is closed. The identity card has no edit.

![21.gifts member shop edit](images/members-shop-edit.png)

### Variant: shop-edit-open

The same moderator clicked **Edit shop note**. Step **1 / 5 · Photos** is open. **History** says there are no edits yet. The photo step dismisses with an icon-only Close (X). Its accessible name is Cancel. There is no visible Cancel word. The closed pencil does not cover this result.

![21.gifts member shop edit open](images/members-shop-edit-open.png)

### Variant: shop-edit-place

The same moderator pressed **Next**. Step **2 / 5 · Place** is open. **History** still says there are no edits yet. The photo step's Close (X) is gone. The closed pencil does not cover this result.

![21.gifts member shop edit place](images/members-shop-edit-place.png)

### Variant: shop-edit-text

**Next** again. Step **3 / 5 · Text** is open.

![21.gifts member shop edit text](images/members-shop-edit-text.png)

### Variant: shop-edit-user

**Next** again. Step **4 / 5 · 21.gifts user** is open. The username is empty.

![21.gifts member shop edit user](images/members-shop-edit-user.png)

### Variant: shop-edit-summary

**Next** again. Step **5 / 5 · Summary** is open. The card lists Photos **None**, Place **None**, Text **Cafe Luna**, and 21.gifts user **None**.

![21.gifts member shop edit summary](images/members-shop-edit-summary.png)

## Screen: /pos

- **Purpose:** Signed-in point of sale. With no charge, this page is only the Open CryptoPay QR and **Set an amount**. The keypad is `/pos/amount`. Confirming there returns here. The button is then **Cancel**, with the countdown and the amount in bitcoin and fiat. The saved unit is `account.amountUnit`. What is charged is still whole sats. For five minutes `GET /.well-known/lnurlp/:username` pins min and max to that amount. A payer who scans the QR with the in-app wallet (`/wallet`, **Send**) goes straight to confirming that amount, with this member's address as the recipient; there is no amount to type. A payer whose 21.gifts in-app wallet scans the QR (or pastes this address) pays the charge with a Spark invoice the api issues for it, without a fee; any other wallet pays over Lightning. While the charge is open, and for one minute after it ran out, the page asks `GET /pos/charge` every three seconds (a payment the api confirms just after the end still counts); once the api has seen the payment, the charge is `paid` and the page shows **Paid ✓**, the amount in bitcoin and fiat, and **New payment**, without **Cancel**. The api keeps showing a paid charge for one minute. Cancel or expiry clears the pin. The page keeps the open charge and Cancel until the server returns none. The member's own wallet receives the payment. Under the QR and the charge, **History** lists past charges, newest first: **Paid ✓** with the time it was paid, **Expired**, or **Cancelled**, the amount in bitcoin and fiat, and the date and time the charge was created. The list comes with every till answer, so it changes when the open charge is paid, cancelled, or runs out. Without past charges it says **No payments yet.** The api returns at most its newest 20 charges, and the list shows those. A missing username links to `/profile`; with a username but no verified wallet (`sparkWalletVerified`), `pos.needWallet` links to `/wallet` while setup remains pending. While setup is due, the address and QR are hidden because the address is not registered yet. If background setup has exhausted its retries, the inline `walletSetup.error` note and **Try again** replace that link, and the address and QR remain hidden. The api answers a charge with 400 and `code` `wallet_required` when the wallet is not set up, or `cannot_receive` when it cannot receive; the page shows the `pos.needWallet` alert or **Your wallet cannot receive this payment right now. Please try again later.**
- **Layout:** `AppShell` fill with profile chrome. `Card` `surface={false}`: heading, centered truncated address, Open CryptoPay QR, content-width **Set an amount** when no charge is open, otherwise the open charge (countdown, including 0:00, bitcoin, default fiat when a spot rate exists, and **Cancel**), or the paid charge (**Paid ✓**, bitcoin, default fiat when a spot rate exists, and **New payment**). Below, once the till has loaded, a top border and the **History** section (`PosHistory`): small uppercase heading, then muted rounded rows (status left, bitcoin · fiat right, creation date and time under them), or one centered sentence when empty. No keypad on this page. While wallet verification is pending, the `pos.needWallet` link occupies the message area; after background setup gives up, the setup note with its **Try again** button occupies it instead.
- **Actions:** **Set an amount** and **New payment** open `/pos/amount`. **Cancel** clears the charge. Menu row `pos.nav`.
- **Auth:** Bearer session via `OnboardingGate screen="profile"`.
- **Used by:** Route `/pos`.

### Variant: default

Signed-in Ada with a username and a verified wallet, no open charge and no past charge. Heading **Point of sale**, address `alice@21.gifts`, Open CryptoPay QR, **Set an amount**, and **History** with **No payments yet.** No keypad. Desktop, iPad, and smartphone all show the QR.

![21.gifts point of sale](images/pos.png)

### Variant: open

Signed-in Ada with a pending charge of ₿21 and 5:00 left. Countdown, the sat amount, the default fiat under it, and **Cancel** stay up. The amount form is gone. The open charge is not in **History**, which says **No payments yet.** Desktop, iPad, and smartphone all show the Open CryptoPay QR.

![21.gifts point of sale open](images/pos-open.png)

### Variant: paid

Signed-in Ada whose charge of ₿21 the api has marked paid. **Paid ✓** in green, the sat amount, the default fiat under it, and **New payment** (to `/pos/amount`). No countdown, no **Cancel**, and no **Set an amount**. **History** lists that charge as **Paid ✓ 12:00 PM** with ₿21 and its fiat. Desktop, iPad, and smartphone all show the Open CryptoPay QR.

![21.gifts point of sale paid](images/pos-paid.png)

### Variant: history

Signed-in Ada with no open charge and three past charges, scrolled to **History**: **Paid ✓ 12:00 PM** in green with ₿2’100 and $2.10, then **Expired** with ₿500, then **Cancelled** with ₿42, each with the date and time it was created, newest first. **Set an amount** stays above.

![21.gifts point of sale history](images/pos-history.png)

### Variant: loading

The till request has not returned. Heading **Point of sale**, the address, and the spinner. No **Set an amount** yet.

![21.gifts point of sale loading](images/pos-loading.png)

### Variant: error

The till request failed. Alert **Point of sale is unavailable.**

![21.gifts point of sale error](images/pos-error.png)

### Variant: cancel-failed

Open charge of ₿21 with 5:00 left and the default fiat under the sat amount. **Cancel** fails. The charge and **Cancel** stay. Alert **Point of sale is unavailable.**

![21.gifts point of sale cancel failed](images/pos-cancel-failed.png)

### Variant: refresh-failed

The open charge has already run out (0:00). The sat amount and the default fiat stay. Refreshing it fails. **Cancel** stays. Alert **Point of sale is unavailable.**

![21.gifts point of sale refresh failed](images/pos-refresh-failed.png)

### Variant: need-username

Setup is finished and the username is empty. Link **Set a username first.** No address and no amount form. Under it, **History** with **No payments yet.**

![21.gifts point of sale need username](images/pos-need-username.png)

### Variant: need-wallet

Username set, wallet not verified (`sparkWalletVerified` is not true) in a build or an account body where the background setup does not apply (as in this fixture), so the address and QR still show. Link **Set up your wallet first.** to `/wallet`. No amount form. Under it, **History** with **No payments yet.**

![21.gifts point of sale need wallet](images/pos-need-wallet.png)

### Variant: setup-pending

Pinned fixture (`?visual=setup-pending`, Playwright builds only): the background wallet setup is still due. The till hides the unregistered address and QR and shows **Set up your wallet first.** to `/wallet`. No amount form. Under it, **History** with **No payments yet.**

![21.gifts point of sale setup pending](images/pos-setup-pending.png)

### Variant: setup-failed

Pinned fixture (`?visual=pos-setup-failed`, Playwright builds only). The username is set, the wallet is not verified, and background setup exhausted all quiet retries. The till hides the unregistered address and QR, then shows the alert **Your wallet could not be set up yet.** (`walletSetup.error`) followed by a secondary **Try again** button under it in place of the pending-wallet link. No amount form. Under it, **History** with **No payments yet.**

![21.gifts point of sale setup failed](images/pos-setup-failed.png)

## Screen: /pos/amount

- **Purpose:** Choose the sat amount for the till. No QR, no address, and no other till action. Confirming creates the charge and returns to `/pos`, which then shows **Cancel**, the countdown, and the amount in bitcoin and fiat.
- **Layout:** `AppShell` fill. The top-left arrow returns to the previous in-app view in this tab, or `/welcome` when this tab has none. One arrow. The wordmark is not that control. It does not jump to `/pos`. `Card` `surface={false}`: heading **Amount**. While the till request is out, a spinner and no keypad. If that request fails, the alert, **Try again**, and no keypad. Otherwise the keypad and **Create payment**. Bitcoin has no decimal key. Fiat shows the number-format decimal (dot for Swiss and US, comma for German; no cookie means Swiss) and keeps two fraction digits. A member who cannot charge, or who already has an open charge, is sent back to `/pos`. A charge that is already paid does not send the member back.
- **Actions:** **Create payment**. The fiat on the switch uses the current spot rate (`GET /fx/spot` through `useSpotRate`); without a price for that fiat it is disabled and the amount is typed in ₿. A fiat amount that still cannot be converted shows **This amount cannot be converted to bitcoin. Enter it in ₿.** instead of **Enter a whole number.** A charge the api answers with `code` `wallet_required` shows the `pos.needWallet` alert, one with `cannot_receive` shows **Your wallet cannot receive this payment right now. Please try again later.**; the keypad stays. The top-left arrow returns to the previous in-app view in this tab, or `/welcome` when this tab has none.
- **Auth:** Bearer session via `OnboardingGate screen="profile"`.
- **Used by:** Route `/pos/amount`.

### Variant: default

Signed-in Ada, no open charge. Heading **Amount**, the unit switch, the keypad, and **Create payment**. The heading is the only **Amount**. No QR.

![21.gifts point of sale amount](images/pos-amount.png)

### Variant: loading

The till request has not returned. Heading **Amount** and the spinner. No keypad and no QR.

![21.gifts point of sale amount loading](images/pos-amount-loading.png)

### Variant: error

The till request failed. Heading **Amount**. Alert **Point of sale is unavailable.** **Try again** loads the till once more. No keypad and no QR.

![21.gifts point of sale amount error](images/pos-amount-error.png)

### Variant: bad-amount

**Create payment** while the amount is still empty. Alert **Enter a whole number.** The keypad stays and has no decimal key. No QR.

![21.gifts point of sale bad amount](images/pos-bad-amount.png)

### Variant: fiat

Signed-in Ada with CHF and fiat entry. `GET /fx/spot` prices 1 BTC at CHF 80'000. **CHF** is pressed and the keypad shows a decimal key. `68` shows **₿85'000** under the amount: the sats **Create payment** will charge at the current spot rate.

![21.gifts point of sale amount in CHF](images/pos-amount-fiat.png)

### Variant: fiat-no-rate

Signed-in Ada with CHF and fiat entry, but `GET /fx/spot` has no CHF price. **CHF** is shown disabled and **₿** is pressed, so there is no decimal key. `68` shows **No exchange rate yet** under the amount. **Create payment** charges ₿68. A fiat amount cannot be typed, so it never reaches **Enter a whole number.**

![21.gifts point of sale amount without a CHF rate](images/pos-amount-fiat-no-rate.png)

### Variant: cannot-convert

Signed-in Ada in CHF with a spot rate. **Create payment** with `9999999999999` CHF: that is more sats than a whole number can hold, so the amount cannot be converted. Alert **This amount cannot be converted to bitcoin. Enter it in ₿.** No charge is sent. The keypad stays. No QR.

![21.gifts point of sale amount that cannot be converted](images/pos-cannot-convert.png)

### Variant: create-outside

**Create payment** with `21`. The till answers that the amount is outside the wallet. Alert **Amount is outside the wallet range.** The keypad stays. No QR.

![21.gifts point of sale create outside](images/pos-create-outside.png)

### Variant: create-already

**Create payment** with `21`. The till answers that a payment is already open. Alert **A payment is already open.** The keypad stays. No QR.

![21.gifts point of sale create already](images/pos-create-already.png)

### Variant: create-failed

**Create payment** with `21`. The till does not answer. Alert **Point of sale is unavailable.** The keypad stays. No QR.

![21.gifts point of sale create failed](images/pos-create-failed.png)

### Variant: create-wallet-required

**Create payment** with `21`. The till answers 400 with `code` `wallet_required` (the member's wallet is not set up). The `pos.needWallet` alert appears. The keypad stays. No QR.

![21.gifts point of sale create wallet required](images/pos-create-wallet-required.png)

### Variant: create-cannot-receive

**Create payment** with `21`. The till answers 400 with `code` `cannot_receive`. Alert **Your wallet cannot receive this payment right now. Please try again later.** The keypad stays. No QR.

![21.gifts point of sale create cannot receive](images/pos-create-cannot-receive.png)

## Screen: /profile

- **Purpose:** Signed-in profile after onboarding: compact dual-line Given/Received activity chart (no chart FiatPicker; populated ₿ | selected fiat `SegmentedControl tone="gift"`) inside the identity card, a resting header when a profile photo or wide image is stored (round photo and wide image are different pictures, and neither is the About me photo; a missing wide image or profile photo is the button **Add a wide image** or **Add a profile photo**), About me inside the same card (not a forum post; Languages **Translate** on the filled read-only text when `aboutMessageId` is set; owner empty prompt + **Write your About me** when `aboutMe` is null and `aboutMeHasPhoto` is false; filled text and/or photo otherwise, with attach, preview, and remove in the editor), copy-profile-link on the card, edit name and location (Ort), then the same public facts a visitor sees on `/members/:id` (role pill, funding-program icon, `username@21.gifts`, pay QR, Shop sticker, Posts/Reactions counts, and the activity feed; no Message button and no staff actions), then Notifications pills (All / Active / Mentions `SegmentedControl tone="neutral"`), Hearts On / Off under that level (`account.notifyHearts ?? true`), and, when Push APIs are ready, a second This device On / Off `SegmentedControl tone="neutral"` (incoming pushes always show an OS banner, including when a 21.gifts tab is focused), choose language (uppercase kicker, one-row `SegmentedControl tone="neutral"` same as Theme, endonyms English / Deutsch / Español / Filipino), then appearance (System / Light / Dark), then preferred fiat (`FiatPreferenceSwitcher`, the only signed-in FiatPicker, same pill chrome as Theme, not the compact orange gift picker), then number format (`NumberFormatSwitcher`, uppercase kicker, `SegmentedControl tone="neutral"`, samples `10'000.23` / `10,000.23` / `23.000,33`) as the last identity-card settings row. Chrome is the page-frame header (icon-only back + wordmark + Menu inside the rounded sheet). Menu starts with the account header, then **Home** and **Balance**; the Profile row shows no given or received amounts. `IntroduceYourselfOverlay` never opens here; only `/welcome` shows it. Every pay sheet on this screen (a gift, a paid reaction, or a paid reply) follows the same in-app wallet rule as the forum pay sheet on `/welcome`: it pays from the in-app wallet only (the `sparkInvoice`, otherwise the `pr`); without a usable wallet it shows the unavailable or failed state, never an invoice QR or a link to another wallet app.
- **Inputs:** Session account (name + location + `viewKey` + `aboutMe` + `aboutMeHasPhoto` + living-room rules agreement + optional `notificationLevel` + optional `notifyHearts`) via `OnboardingGate` / `useAuthStore`; Given + Received from `GET /me/activity` via `useAccountTotals` / `fetchAccountActivity`. Fetch even before the wallet is verified; refetch when `sparkWalletVerified` turns true. About me save is `PUT /me/about` (`putAboutMe`). The profile photo is `GET`/`PUT` `/pictures/me`. The wide image is `GET`/`PUT` `/banners/me`. Neither slot is filled from the About me photo. Location save is `POST /me/location` (`setLocation`). Notification level save is `POST /me/notification-level` (`postNotificationLevel`). Heart-notification save is `POST /me/heart-notifications` (`postHeartNotifications`).
- **Actions:** Open **Menu** (see **Signed-in header**) for **Home**, **Balance** (`/wallet`), **Shops**, **Point of sale**, Profile (current), **Grants**, **Settings**, **Living room rules**, **Habit-Tracker**, **Trust Chain**, **Statistics**, **Notifications**, **Messages**, **Contact**, optional **Install app**, or **Log out** (best-effort Web Push unsubscribe while the session is still valid), then a quiet **Version {version}** line (`app.version`); the top-left arrow returns to the previous in-app view in this tab, or `/welcome` when this tab has none; write or edit About me, and from that editor attach or remove each of the three pictures (About me photo, profile photo, and wide image); copy the profile link (`profile.copyLink` **Copy link to this profile** → origin `/view/<viewKey>`, URL/key not shown); save name; save or clear location; choose All / Active / Mentions on the Notifications `SegmentedControl tone="neutral"`, choose On / Off on Hearts (`profile.heartNotify.label`), and when Push APIs are ready choose On / Off on a second This device `SegmentedControl tone="neutral"` (`aria.push`); choose language on the Language settings row after notifications (`LanguagePreferenceSwitcher`, uppercase kicker, one-row `SegmentedControl tone="neutral"` same as Theme, endonyms English / Deutsch / Español / Filipino); choose System / Light / Dark (`ThemeSwitcher`, `SegmentedControl tone="neutral"`); choose preferred fiat on the Fiat currency settings row (`FiatPreferenceSwitcher`, same pill chrome as Theme, not the compact orange gift picker — the only signed-in control that writes the `fiat` cookie); choose number format on the last identity-card settings row (`NumberFormatSwitcher`, uppercase kicker, `SegmentedControl tone="neutral"`, samples `10'000.23` / `10,000.23` / `23.000,33`); when the series has data, toggle the activity chart between ₿ and the selected fiat. On iPhone Safari outside standalone, a short install hint (`profile.push.installHint`) appears under the This device pill.
- **Used by:** Route `/profile` (`ProfilePage`).

### Variant: default

Above the heading, **Add a wide image** and **Add a profile photo** when those pictures are not stored. Heading **Profile**, then inside the single `max-w-sm` identity card: no chart FiatPicker. When the series is empty, `profile.chartEmpty` (`role="status"`, **No gifts yet.**) with no axis/SVG / no ₿|fiat scale; otherwise a compact Given/Received chart (legend left, ₿ | selected fiat `SegmentedControl tone="gift"` right; no chart title heading); About me with empty prompt **Tell others who you are.** and **Write your About me** when `aboutMe` is null (not a forum post); icon-only **Copy link to this profile**; name, location (**Location** / **Ort**, unset shows **Not set**), then the public member facts (role pill when the role is verified or above, funding-program icon when `fundingReviewedAt` is a number (pressing it reveals that one sentence), `username@21.gifts`, pay QR and **Shop sticker** when a username is set, including on a smartphone, and **Posts** / **Reactions** count buttons that open the same activity feed as `/members/:id`), then a Notifications section with a three-stage All / Active / Mentions `SegmentedControl tone="neutral"`, Hearts On / Off under that level, and, when Push APIs are ready, a second This device On / Off `SegmentedControl tone="neutral"` (selected fill `bg-app-btn`; On / Off visible text), then a Language settings row (uppercase kicker and one-row `SegmentedControl tone="neutral"` same as Theme, English / Deutsch / Español / Filipino), then a Theme settings row (uppercase kicker and `SegmentedControl tone="neutral"` System / Light / Dark), then a Fiat currency settings row (`FiatPreferenceSwitcher`, the only FiatPicker on the card, same pill chrome as Theme, not the compact orange gift picker; CHF|EUR|USD|PHP), then a Number format settings row (uppercase kicker and `SegmentedControl tone="neutral"` samples `10'000.23` / `10,000.23` / `23.000,33`); no **View key** heading and no visible URL/key text. No second panel below the card. Icon-only back and wordmark in the page-frame header (the arrow returns to the previous in-app view in this tab, or `/welcome` when this tab has none); one **Menu** in that same header row (account header, then **Home** and **Balance**; log out, then a quiet **Version {version}** line (`app.version`); the Profile row shows no given or received amounts). Chart never swaps to **Loading…**. A failed activity load is `profile.chartError`.
![21.gifts profile](images/profile.png)

### Variant: sunday

Device-local Sunday. The name, the empty About me sentence, the address, and the add-picture buttons stay. The pencils and **Write your About me** are gone. **Writing is paused on Sunday.**

![21.gifts profile sunday](images/profile-sunday.png)

### Variant: sticker-open

**Shop sticker** is open (`ShopStickerOverlay`, preview for `alice@21.gifts`) on desktop and mobile (smartphone UA). The closed **Second language** menu shows **None (English only)** above the preview, and the preview is the English-only sticker. File format and **Download** sit below the preview. Needle `state-profile-sticker-open`. These shots use the English UI. Without a known `lang`, the sticker is English only.

![21.gifts profile shop sticker](images/profile-sticker-open.png)

### Variant: sticker-kikamba

`/profile?lang=Kikamba` opens `ShopStickerOverlay` immediately. The preview is the English/Kikamba sticker (Kikamba instead of TINATANGGAP DITO / Filipino scan text). Same chrome: **Second language** showing **Kikamba** above the preview, PDF selected, **Download** below it. Mobile combos match desktop. Needle `state-profile-sticker-kikamba`.

![21.gifts shop sticker Kikamba](images/profile-sticker-kikamba.png)

### Variant: sticker-lang

Same overlay after opening **Second language**. The list opens downward over the preview. Options, top to bottom: **None (English only)** (selected), **Spanish**, **German**, **French**, **Filipino**, **Kikamba**. The dialog stays open. Mobile combos match desktop. Needle `state-profile-sticker-lang`. These shots use the English UI.

![21.gifts profile shop sticker language menu](images/profile-sticker-lang.png)

### Variant: funding-program-press

The funding-program icon is pressed and the participation sentence is visible. Needle `state-profile-funding-program-press`.

![21.gifts profile funding program](images/profile-funding-program-press.png)

### Variant: posts-open

**14 posts** is pressed and the feed shows **Second post from Ada.** Needle `Second post from Ada.`

![21.gifts profile posts](images/profile-posts-open.png)

### Variant: mention-suggest-reply

Posts are open, Ada's note is expanded, its reaction field contains `@`, and the People list is open.

![21.gifts profile reply mention suggestions](images/profile-mention-suggest-reply.png)

### Variant: mention-inserted-reply

Choosing `@ada` from that open list writes `@ada ` into the reaction field and closes the list.

![21.gifts profile reply mention inserted](images/profile-mention-inserted-reply.png)

### Variant: replies-open

**1 reaction** is pressed and the feed shows **A reply from Ada.** Needle `A reply from Ada.`

![21.gifts profile reactions](images/profile-replies-open.png)

### Variant: fiat

Viewport after scrolling the identity-card **Fiat currency** row into view (CHF | EUR | USD | PHP). Default capture is full-page on the AppShell inner scroller; this variant is viewport-only after `scrollIntoViewIfNeeded`.

![21.gifts profile fiat](images/profile-fiat.png)

### Variant: receive

Filtered receive series with three UTC days (including a zero-gap day) and received total ₿1'500. Chart shows day ticks such as **2026-06-01**; Given stays flat at zero with a visible legend.

![21.gifts profile receive](images/profile-receive.png)

### Variant: usd-scale

Same receive stub as **receive**, with the fiat scale selected and USD pressed (`Given and received in USD`).

![21.gifts profile USD scale](images/profile-usd-scale.png)

### Variant: single-day

One receive day (₿21 on **2026-06-01**). Chart draws a horizontal single-point line.

![21.gifts profile single day](images/profile-single-day.png)

### Variant: large-usd

Two-day series with cumulative USD **1425.00**, scale switched to USD so the axis shows **$1'425** (Swiss default grouping).

![21.gifts profile large USD](images/profile-large-usd.png)

### Variant: given-received

Both series non-zero: received ₿1,500 over three UTC days and given ₿2,100 on **2026-06-02**. Chart shows Given and Received together. Needle `state-profile-given-received`.

![21.gifts profile given and received](images/profile-given-received.png)

### Variant: about-filled

Owner card with a real bio not equal to the display name. Seed GET /me with `name: 'Ada'`, `aboutMe: 'I build on Bitcoin'`, setup complete. Shows filled About me text plus the icon-only pencil (`Edit About me`), not the empty CTA (`Tell others who you are.` / **Write your About me**).

![21.gifts profile About me filled](images/profile-about-filled.png)

### Variant: translate

Signed-in `/profile` with a German About me and a non-empty `aboutMessageId`. **Translate** is visible under the About me body.

![21.gifts profile about translate](images/profile-about-translate.png)

### Variant: translate-loading

Same German About me after clicking **Translate** while POST `/translate` hangs. The control is busy (`aria-busy`) with a spinner.

![21.gifts profile about translate loading](images/profile-about-translate-loading.png)

### Variant: translate-done

Same German About me after a successful translation. Translated body plus **Show original**; the German original is not shown.

![21.gifts profile about translate done](images/profile-about-translate-done.png)

### Variant: translate-hidden

After **Show original**: translated body hidden, the Languages icon is named **Show translation** and has no visible text.

![21.gifts profile about translate hidden](images/profile-about-translate-hidden.png)

### Variant: translate-error

Same German About me after POST /translate fails. Alert **Could not translate this note. Please try again.** and the Translate control remains.

![21.gifts profile about translate error](images/profile-about-translate-error.png)

### Variant: about-photo

Owner card with bio and photo. Seed GET /me with `aboutMe: 'I build on Bitcoin'`, `aboutMeHasPhoto: true`. Stub GET `/me/about/photo` 200 JPEG. Shows the stored image (`About me photo`, the whole picture, `object-contain`, `max-h-80`, not a cover crop), the bio text, and the icon-only pencil (`Edit About me`), not the empty CTA. No stored profile photo and no stored wide image, so the header shows **Add a wide image** and **Add a profile photo**.

![21.gifts profile About me photo](images/profile-about-photo.png)

### Variant: images

Owner card with three different pictures at once. Stub GET `/pictures/me` with a square portrait, GET `/banners/me` with a wide scene, and GET `/me/about/photo` with a third photograph. The wide image is the card header, the profile photo is the round picture on its lower edge, and the About me photo stays under the bio. Seed `aboutMe: 'I build on Bitcoin'` and `aboutMeHasPhoto: true`. All three images are inside the viewport.

![21.gifts profile images](images/profile-images.png)

### Variant: photo-only

Round profile photo only. Stub GET `/pictures/me` with the square portrait. No wide image, so **Add a wide image** sits above the round photo. Needle `state-profile-photo-only`.

![21.gifts profile photo only](images/profile-photo-only.png)

### Variant: banner-only

Wide image only. Stub GET `/banners/me` with the wide scene. No profile photo, so **Add a profile photo** sits under the banner. Needle `state-profile-banner-only`.

![21.gifts profile banner only](images/profile-banner-only.png)

### Variant: banner-not-wide

Choosing a square portrait for the wide image opens the 5:2 cropper (**Drag the photo to choose the wide image**, labeled **Use this crop**, X with accessible name **Cancel crop**). **Add a wide image** is hidden. **Add a profile photo** stays. Needle `state-profile-banner-not-wide`.

![21.gifts profile banner not wide](images/profile-banner-not-wide.png)

### Variant: banner-crop-saving

The wide-image cropper stays open while PUT `/banners/me` has not answered. **Use this crop** is disabled and shows a spinner. **Add a wide image** stays hidden. **Add a profile photo** stays, disabled, without a spinner. Needle `state-profile-banner-crop-saving`.

![21.gifts profile banner crop saving](images/profile-banner-crop-saving.png)

### Variant: banner-crop-save-error

PUT `/banners/me` answers 500 after **Use this crop**. Alert **Could not save. Please try again.** The cropper stays open (**Drag the photo to choose the wide image**, **Use this crop**, X with accessible name **Cancel crop**). Needle `state-profile-banner-crop-save-error`.

![21.gifts profile banner crop save error](images/profile-banner-crop-save-error.png)

### Variant: banner-crop-too-large

**Use this crop** encodes a JPEG over 1 MB. Alert **Keep photos under 1 MB**. The cropper stays open. Needle `state-profile-banner-crop-too-large`.

![21.gifts profile banner crop too large](images/profile-banner-crop-too-large.png)

### Variant: picture-unsupported

Choosing a file that is not a JPEG, PNG, or WebP for the profile photo. Alert **Use a JPEG, PNG, or WebP photo**. Both add buttons stay. Needle `state-profile-picture-unsupported`.

![21.gifts profile picture unsupported](images/profile-picture-unsupported.png)

### Variant: picture-too-large

Choosing a photo whose encoded JPEG is over 1 MB. Alert **Keep photos under 1 MB**. Both add buttons stay. Needle `state-profile-picture-too-large`.

![21.gifts profile picture too large](images/profile-picture-too-large.png)

### Variant: picture-save-error

PUT `/pictures/me` answers 500 after a JPEG is chosen. Alert **Could not save. Please try again.** The profile-photo button stays. Needle `state-profile-picture-save-error`.

![21.gifts profile picture save error](images/profile-picture-save-error.png)

### Variant: picture-saving

The profile-photo button is disabled and shows a spinner while PUT `/pictures/me` has not answered. Needle `state-profile-picture-saving`.

![21.gifts profile picture saving](images/profile-picture-saving.png)

### Variant: images-editing

Owner editor opened from variant **images**. The same three stubs are loaded (square portrait, wide scene, About me photo) and the seed is `aboutMe: 'I build on Bitcoin'` with `aboutMeHasPhoto: true`. **Edit About me** opens the textarea. The editor shows the round profile photo beside **Remove profile photo**, the wide image beside **Remove wide image**, and the About me photo beside **Remove photo**. The three icon-only attaches remain: **Add a photo** (`profile.about.attach`), **Add a profile photo** (`profile.about.portrait`), and **Add a wide image** (`profile.about.banner`). Needle `Remove profile photo`.

![21.gifts profile images editing](images/profile-images-editing.png)

### Variant: about-editing

Owner in the About me textarea editor. From the empty CTA, click **Write your About me** (empty→Write is enough). Needle: `getByRole('textbox', { name: 'About me' })` / **Save About me** icon button. Save/cancel are icon-only IconButtons (`getByRole` + catalog text is not visible). textarea uses `text-base`. The empty editor still shows three icon-only attaches: **Add a photo** (`profile.about.attach`), **Add a profile photo** (`profile.about.portrait`), and **Add a wide image** (`profile.about.banner`). No picture is stored yet, so **Remove profile photo**, **Remove wide image**, and **Remove photo** are absent.

![21.gifts profile About me editing](images/profile-about-editing.png)

### Variant: about-banner-crop

About me editor with the wide-image cropper inside it. From the empty CTA, **Write your About me**, then a square portrait on the editor wide-image input. The cropper sits under the textarea (**Drag the photo to choose the wide image**, **Use this crop**, X with accessible name **Cancel crop**). The header **Add a wide image** stays, because that crop belongs to the header. Needle `state-profile-about-banner-crop`.

![21.gifts profile About me banner crop](images/profile-about-banner-crop.png)

### Variant: about-banner-crop-saving

Same editor cropper while PUT `/banners/me` has not answered. **Use this crop** is disabled and shows a spinner. **Save About me** is disabled and is not the spinning control. Needle `state-profile-about-banner-crop-saving`.

![21.gifts profile About me banner crop saving](images/profile-about-banner-crop-saving.png)

### Variant: about-banner-crop-save-error

Same editor cropper after PUT `/banners/me` answers 500. Alert **Could not save. Please try again.** The cropper stays open. Needle `state-profile-about-banner-crop-save-error`.

![21.gifts profile About me banner crop save error](images/profile-about-banner-crop-save-error.png)

### Variant: about-banner-crop-too-large

Same editor cropper after **Use this crop** encodes a JPEG over 1 MB. Alert **Keep photos under 1 MB**. The cropper stays open. Needle `state-profile-about-banner-crop-too-large`.

![21.gifts profile About me banner crop too large](images/profile-about-banner-crop-too-large.png)

### Variant: about-save-error

Owner editor with `role="alert"` save error after stubbing PUT /me/about to 500, opening the editor from empty, and clicking Save. Copy **Could not save. Please try again.**

![21.gifts profile About me save error](images/profile-about-save-error.png)

### Variant: notification-level-error

Notifications section with `role="alert"` save error after stubbing POST /me/notification-level to 500 and clicking Active. Copy **Could not save notification level.**

![21.gifts profile notification level error](images/profile-notification-level-error.png)

### Variant: heart-notify-error

Notifications section with `role="alert"` save error after stubbing POST /me/heart-notifications to 500 and clicking Off inside Hearts. Copy **Could not save the heart setting.**

![21.gifts profile heart notify error](images/profile-heart-notify-error.png)

### Variant: push-enable-error

Notifications section with `role="alert"` after clicking On on the This device pill when Web Push is present but enable fails. Copy **Notifications are not available in this browser.**

![21.gifts profile push enable error](images/profile-push-enable-error.png)

## Screen: /grants

- **Purpose:** Signed-in grants page. `GrantsScreen` shows `FundingStatusCard`. The only title is the page `h1` **21 gifts grant**. A signed-in account also sees a secondary large **Goals** link to `/grants/goals`, under the grant card and above the staff queue. A missing account shows no link. An initiator or founder also sees two secondary large links, **Daily payment text** to `/grants/payments/comment` and **Daily payment amounts** to `/grants/payments/amounts`. Those links do not load the roster. A moderator does not see them. An account at least moderator (`roleAtLeast(role, 'moderator')`), including an initiator and a founder, with at least one open application sees a secondary large **Open application (1)** link when the count is one and **Open applications (N)** otherwise (`funding.applications.openCount`) to `/grants/applications`. When none are open, the sentence **No open applications.** is plain text, not a link. While the count is loading, the sentence is **Loading…**. When the load fails, the error sentence and **Try again** are shown, not the applications link. The profile no longer shows this card.
- **Inputs:** Session account via `OnboardingGate screen="profile"` / `useAuthStore`.
- **Actions:** Read verification or grant status. A basis account reads that it is not verified yet and does not open Apply. A verified account with status pending, trial, or admitted reads that copy, for every username. A verified account with status none or rejected named `joey-rosima`, `vincent`, or `jewel-bacolbas` opens Apply. Every other verified account with status none or rejected reads the paused sentence and the statistics link. Signed-in accounts open **Goals** (`/grants/goals`). An initiator or founder opens **Daily payment text** or **Daily payment amounts**. An account at least moderator, including an initiator and a founder, opens **Open application (1)** or **Open applications (N)** only when N is at least 1. **Try again** repeats the load after an error.
- **Used by:** Route `/grants` (`GrantsPage`).

### Variant: default

Verified owner with `funding.status` **none**. Page `h1` **21 gifts grant**, the paused sentence **Applications are currently paused. You can apply again when shop transactions have increased.**, the link `https://21.gifts/statistics`, and **Goals**. No About link and no Apply button. Public paused screenshots are unchanged because those fixtures are not `joey-rosima`, `vincent`, or `jewel-bacolbas`.

![21.gifts grants](images/grants.png)

### Variant: funding-apply

Verified username joey-rosima with status none or rejected sees Apply for the 21 gifts grant instead of the paused sentence.

![21.gifts grants funding apply](images/grants-funding-apply.png)

### Variant: funding-not-verified

Basis owner. Grant section on `/grants`. Copy **You are not verified yet.** plus how in-person verification works. No apply button.

![21.gifts profile funding not verified](images/profile-funding-not-verified.png)

### Variant: funding-pending

Verified owner with `funding.status` **pending**. Copy **Your application is open. A moderator will review your posts.**

![21.gifts profile funding pending](images/profile-funding-pending.png)

### Variant: funding-trial

Verified owner with `funding.status` **trial**. Copy **You are on a one-day trial. Review repeats tomorrow.**

![21.gifts profile funding trial](images/profile-funding-trial.png)

### Variant: funding-admitted

Verified owner with `funding.status` **admitted**. Copy **You are admitted to daily 21.gifts grant payouts.** plus **Takes part in the 21.gifts funding program since {date}**. When `reviewedByName` is set, that sentence names the reviewer. Trial, pending, and rejected do not show a name. The funding-program icon on the public facts is closed here. The pressed result is **funding-program-open**.
![21.gifts profile funding admitted](images/profile-funding-admitted.png)

### Variant: funding-program-open

Admitted owner on `/grants`. The participation sentence **Takes part in the 21.gifts funding program since {date}** is visible on the grant card. Viewport capture after scrolling that line into view.

![21.gifts profile funding program open](images/profile-funding-program-open.png)

### Variant: open-applications

Moderator on `/grants` with two open grant applications. The grant card is shown, and **Open applications (2)** links to `/grants/applications`. When the list is empty this control is the sentence **No open applications.** and not a link; that state is **no-applications**. Needle `state-grants-open-applications`.

![21.gifts grants open applications](images/grants-open-applications.png)

### Variant: no-applications

Moderator on `/grants` when no grant application is open. The sentence **No open applications.** is plain text, not a button or link. Needle `state-grants-no-applications`.

![21.gifts grants no applications](images/grants-no-applications.png)

### Variant: applications-loading

Moderator on `/grants` while open applications are still loading. Copy **Loading…** is plain text, not a link. Needle `state-grants-applications-loading`.

![21.gifts grants applications loading](images/grants-applications-loading.png)

### Variant: applications-error

Moderator on `/grants` when the open-application load fails. Copy **Could not load open applications. Please try again.** and button **Try again**. Not a link to the queue. Needle `state-grants-applications-error`.

![21.gifts grants applications error](images/grants-applications-error.png)

### Variant: daily-payments

Founder on `/grants` sees a secondary **Goals** link, secondary **Daily payment text** and **Daily payment amounts** links, plus **Open applications (2)**. Needle `Daily payment text`.

![21.gifts grants daily payments](images/grants-daily-payments.png)

## Screen: /grants/goals

- **Purpose:** Signed-in grant goal. States that the program continues at 10 active shops, that a shop is active with at least one transaction on 5 of the last 7 days, and what a transaction is. Shows how many shops meet that rule and a 7-day shop chart. The chart is not the public statistics series.
- **Inputs:** Session via `OnboardingGate screen="profile"` / `useAuthStore`. `GET /funding/goal` when a session exists.
- **Actions:** Read the goal, the transaction definition, the qualifying count, and the chart. **Try again** repeats the load after an error. The top-left arrow returns to the previous in-app view in this tab, or `/welcome` when this tab has none. One arrow. The wordmark is not that control.
- **Used by:** Route `/grants/goals` (`GrantGoalsPage`). The **Goals** link on `/grants` opens it.

### Variant: default

Signed-in page with the goal loaded. Heading **Goals**. Copy **The grant program continues when we reach 10 active shops.** A shop is active on 5 of the last 7 days. The transaction sentence names https://21.gifts/pos. The count and **Shops per UTC day** chart are shown. The lighter bar is today, still open.

![21.gifts grant goals](images/grants-goals.png)

### Variant: loading

Signed-in page while `GET /funding/goal` has not returned. Heading, the 10-shop sentence, the 5-of-the-last-7 sentence, and the transaction sentence stay. The measurement says **Loading…**. No chart. Needle `state-grants-goals-loading`.

![21.gifts grant goals loading](images/grants-goals-loading.png)

### Variant: error

Signed-in page when `GET /funding/goal` fails. Heading and the three sentences stay. Copy **Could not load the shop goal. Please try again.** and button **Try again**. No chart. Needle `state-grants-goals-error`.

![21.gifts grant goals error](images/grants-goals-error.png)

## Screen: /grants/payments/comment

- **Purpose:** Signed-in editor for the daily payout comment only. An initiator or founder loads `GET /funding/daily-roster`. Everyone else who is signed in sees the heading plus **You cannot change daily payments.** and this page does not fetch. The comment is text until the pencil opens it. An empty comment shows **Not set**. This page has no default-amount sentence, no payments switch, no recipients, and no Add. There is no `route.ts` beside this page; JSON lives under `/funding/daily-roster`. Amounts are `/grants/payments/amounts`.
- **Inputs:** Session account via `OnboardingGate screen="welcome"` / `useAuthStore`. Roster from `GET /funding/daily-roster` for an initiator or founder.
- **Actions:** The comment is text until the pencil (**Edit comment**) opens it. The check (**Save**) stores it and the X (**Cancel**) restores the stored comment. Neither word is shown. A save in flight replaces the check with a spinner. **Try again** repeats a failed load. The top-left arrow returns to the previous in-app view in this tab, or `/welcome` when this tab has none. One arrow. The wordmark is not that control.
- **Used by:** Route `/grants/payments/comment` (`DailyPaymentCommentPage`). The **Daily payment text** link on `/grants` is shown only to an initiator or founder.

### Variant: default

Founder with a stored comment. Heading **Daily payment text**. Comment **Daily gift** is text, with the pencil **Edit comment** on the same line, to the right of the text. No recipients and no payments switch. Needle `Edit comment`.

![21.gifts daily payment text](images/grants-payments-comment.png)

### Variant: empty

Founder with an empty comment. The muted sentence is **Not set**, and the pencil **Edit comment** stays on that line. Needle `Not set`.

![21.gifts daily payment text empty](images/grants-payments-comment-empty.png)

### Variant: loading

Founder waiting on `GET /funding/daily-roster`. Heading **Daily payment text**. Copy **Loading…**. Needle `state-grants-payments-comment-loading`.

![21.gifts daily payment text loading](images/grants-payments-comment-loading.png)

### Variant: error

Founder when the roster load fails. Copy **Could not load daily payments. Please try again.** and button **Try again**. Needle `Could not load daily payments. Please try again.`

![21.gifts daily payment text error](images/grants-payments-comment-error.png)

### Variant: forbidden

Moderator on the direct URL. Heading **Daily payment text** and **You cannot change daily payments.** No roster request. Needle `You cannot change daily payments.`

![21.gifts daily payment text forbidden](images/grants-payments-comment-forbidden.png)

### Variant: invalid

Founder opens the comment with the pencil and presses the check. Spend rejects it. The field stays open. Alert **The comment is not valid.** Needle `The comment is not valid.`

![21.gifts daily payment text invalid](images/grants-payments-comment-invalid.png)

### Variant: save-error

Founder opens the comment and presses the check. The roster call fails for any other reason, including `Forbidden`. The field stays open. Alert **Could not save. Please try again.** Needle `Could not save. Please try again.`

![21.gifts daily payment text save error](images/grants-payments-comment-save-error.png)

### Variant: pending

Founder opened the comment with the pencil and pressed the check. The roster call has not returned. The check (accessible name **Save**) shows a spinner and is disabled, as is **Cancel**. There is no **Add** on this page and no alert. Needle `state-grants-payments-comment-pending`.

![21.gifts daily payment text pending](images/grants-payments-comment-pending.png)

### Variant: editing

Founder presses the pencil **Edit comment**. The stored comment **Daily gift** is in the open field **Comment**. The check (**Save**) is enabled. **Cancel** is enabled. There is no alert, no spinner, and no **Edit comment** pencil. Needle `getByRole('textbox', { name: 'Comment' })`.

![21.gifts daily payment text editing](images/grants-payments-comment-editing.png)

## Screen: /grants/payments/amounts

- **Purpose:** Signed-in editor for daily payout amounts only. An initiator or founder loads `GET /funding/daily-roster`. Everyone else who is signed in sees the heading plus **You cannot change daily payments.** and this page does not fetch. Under the heading, the loaded editor says everyone in the grant program receives the roster `defaultAmountUsd` by default, formatted with `formatUsdDisplay`, and that the page is only for entering a different amount by hand. Someone who should receive the default does not need to be listed. The figure is not written into the catalog. Recipient amounts are the USD figure spend stores (`amountUsd`), typed in `Field`, not `AmountEntry`. The total is that USD sum via `formatUsdDisplay` (visitor grouping, two decimals). The comment is not on this page. There is no `route.ts` beside this page; JSON lives under `/funding/daily-roster`.
- **Inputs:** Session account via `OnboardingGate screen="welcome"` / `useAuthStore`. Roster from `GET /funding/daily-roster` for an initiator or founder.
- **Actions:** Turn payments **On** or **Off**. **Add** a recipient. A recipient row shows the formatted amount, a pencil (**Edit** plus the shown address), and a trash (**Delete** plus the shown address) on one line. The pencil opens the amount field; the check saves and the X cancels. **Try again** repeats a failed load. The top-left arrow returns to the previous in-app view in this tab, or `/welcome` when this tab has none. One arrow. The wordmark is not that control.
- **Used by:** Route `/grants/payments/amounts` (`DailyPaymentAmountsPage`). The **Daily payment amounts** link on `/grants` is shown only to an initiator or founder.

### Variant: default

Founder with a loaded roster that includes a Wallet of Satoshi address. Heading **Daily payment amounts**. The note begins **Everyone in the grant program receives $1.00 by default.** That address renders as `ada@w...`. Its amount is text, with pencil and trash. Payments **On** is pressed. The total is the USD sum, for this roster `$1.30`. The comment is not shown. Needle `Everyone in the grant program receives`.

![21.gifts daily payment amounts](images/grants-payments-amounts.png)

### Variant: empty

Founder with an empty recipient list. The note begins **Everyone in the grant program receives $1.00 by default.** Sentence **No recipients**. The add form stays. Needle `No recipients`.

![21.gifts daily payment amounts empty](images/grants-payments-amounts-empty.png)

### Variant: loading

Founder waiting on `GET /funding/daily-roster`. Heading **Daily payment amounts**. Copy **Loading…**. Needle `state-grants-payments-amounts-loading`.

![21.gifts daily payment amounts loading](images/grants-payments-amounts-loading.png)

### Variant: error

Founder when the roster load fails. Copy **Could not load daily payments. Please try again.** and button **Try again**. Needle `Could not load daily payments. Please try again.`

![21.gifts daily payment amounts error](images/grants-payments-amounts-error.png)

### Variant: forbidden

Moderator on the direct URL. Heading **Daily payment amounts** and **You cannot change daily payments.** No roster request. Needle `You cannot change daily payments.`

![21.gifts daily payment amounts forbidden](images/grants-payments-amounts-forbidden.png)

### Variant: invalid

Founder, add amount 0, alert **The address or the amount is not valid.** The shown amount, pencil, and trash share one line. The pencil's accessible name is **Edit** plus the shown address. The trash is **Delete** plus that address. Needle `The address or the amount is not valid.`

![21.gifts daily payment amounts invalid](images/grants-payments-amounts-invalid.png)

### Variant: off

Founder with payments switched off. **Off** is pressed and **On** is not. Needle `state-grants-payments-amounts-off`.

![21.gifts daily payment amounts off](images/grants-payments-amounts-off.png)

### Variant: invalid-switch

Founder turns payments off and spend rejects the switch. Alert **The payments switch is not valid.** **On** stays pressed. Needle `The payments switch is not valid.`

![21.gifts daily payment amounts invalid switch](images/grants-payments-amounts-invalid-switch.png)

### Variant: duplicate

Founder adds an address spend already lists. Alert **That address is already listed.** Needle `That address is already listed.`

![21.gifts daily payment amounts duplicate](images/grants-payments-amounts-duplicate.png)

### Variant: unknown

Founder opens a row with the pencil and presses the check. Spend does not list that address. The field stays open. Alert **That recipient is not on the list.** Needle `That recipient is not on the list.`

![21.gifts daily payment amounts unknown](images/grants-payments-amounts-unknown.png)

### Variant: save-error

Founder opens a row and presses the check. The amount update fails for any other reason, including `Forbidden`. The field stays open. Alert **Could not save. Please try again.** Needle `Could not save. Please try again.`

![21.gifts daily payment amounts save error](images/grants-payments-amounts-save-error.png)

### Variant: pending

Founder opened a row with the pencil and pressed the check. The amount update has not returned. The check (accessible name **Save**) shows a spinner and is disabled, as are **Cancel**, **On**, **Off**, **Add**, and the other row buttons. There is no alert. Needle `state-grants-payments-amounts-pending`.

![21.gifts daily payment amounts pending](images/grants-payments-amounts-pending.png)

### Variant: editing

Founder presses the row pencil **Edit ada@w...**. The amount field **USD ada@w...** is open and enabled. The check (**Save**) is enabled. **Cancel** is enabled. There is no alert and no spinner. Needle `state-grants-payments-amounts-editing`.

![21.gifts daily payment amounts editing](images/grants-payments-amounts-editing.png)

## Screen: /profile/apply

- **Purpose:** Permanent redirect to `/grants/apply`. That page shows the pause sentence and `https://21.gifts/statistics` for a verified account with status `none` or `rejected` whose username is not `joey-rosima`, `vincent`, or `jewel-bacolbas`. A verified account with one of those names and status `none` or `rejected` sees the apply walk. Pending, trial, and admitted keep their copy for every verified username. A basis account named joey-rosima, vincent, or jewel-bacolbas sees **You are not verified yet.** and does not post. Any other basis account whose status is not pending, trial, or admitted sees the pause card. A basis account with one of those statuses sees **You are not verified yet.** and does not post. This path renders no grant UI of its own.
- **Inputs:** None. The browser lands on `/grants/apply`.
- **Actions:** `redirect('/grants/apply')`.
- **Used by:** Old links to `/profile/apply`.

### Variant: redirect

Opening `/profile/apply` lands on the paused applications screen. Public paused screenshots are unchanged because those fixtures are not `joey-rosima`, `vincent`, or `jewel-bacolbas`.

![21.gifts apply](images/profile-apply.png)

## Screen: /grants/apply

- **Purpose:** Signed-in applications screen. While applications are paused, a verified account with status `none` or `rejected` whose username is not `joey-rosima`, `vincent`, or `jewel-bacolbas` sees the pause sentence and the link `https://21.gifts/statistics`, with no About-me steps, no questions, and no POST. Pending, trial, and admitted keep their copy for every verified username. A verified account with one of those three names and status `none` or `rejected` sees the apply walk. A basis account named joey-rosima, vincent, or jewel-bacolbas sees **You are not verified yet.** and does not post. Any other basis account whose status is not pending, trial, or admitted sees the pause card. A basis account with one of those statuses sees **You are not verified yet.** and does not post. The apply walk stays in the code. While the switch is on it is shown only for a verified account named `joey-rosima`, `vincent`, or `jewel-bacolbas` with status `none` or `rejected`. When the switch is off, a verified account with status `none` or `rejected` sees it. Pending, trial, and admitted stay status copy. A basis account on that card sees **You are not verified yet.**
- **Inputs:** Account username and funding status from the auth store. Public paused fixtures do not fetch posts and do not POST apply.
- **Actions:** Read the paused sentence and open `https://21.gifts/statistics`, unless the signed-in username is `joey-rosima`, `vincent`, or `jewel-bacolbas`, or the funding status is pending, trial, or admitted. A verified account with one of those names and status `none` or `rejected` fills the apply walk. Pending, trial, and admitted read their status. A basis account named joey-rosima, vincent, or jewel-bacolbas reads **You are not verified yet.** and does not post. Any other basis account whose status is not pending, trial, or admitted reads the pause card. A basis account with one of those statuses reads **You are not verified yet.** and does not post. The top-left arrow returns to the previous in-app view or `/welcome`. No second arrow. The wordmark is not that control.
- **Used by:** Route `/grants/apply` (`FundingApplyPage`).

### Variant: default

Verified member, funding none. Heading **21 gifts grant**. The paused sentence. Link `https://21.gifts/statistics`. No Apply control. Public paused screenshots are unchanged because those fixtures are not `joey-rosima`, `vincent`, or `jewel-bacolbas`.

![21.gifts apply](images/profile-apply.png)

### Variant: about

Verified username joey-rosima with status none or rejected sees the first apply step, First, write a short About me so people can get to know you.

![21.gifts apply about](images/grants-apply-about.png)

### Variant: sunday

On Sunday the About-me step shows Writing is paused on Sunday and hides Save.

![21.gifts apply sunday](images/grants-apply-sunday.png)

### Variant: photo

After a real About me, the next step asks for a photo.

![21.gifts apply photo](images/profile-apply-photo.png)

### Variant: location

After About me and a photo, the next step asks for the place you live.

![21.gifts apply location](images/profile-apply-location.png)

### Variant: question

Filled profile asks whether the posts match the core principles of 21.gifts.

![21.gifts apply question](images/grants-apply-question.png)

### Variant: truth

After Yes, the walk asks whether the posts correspond to the truth.

![21.gifts apply truth](images/grants-apply-truth.png)

### Variant: translate

A German living-room post on the walk offers Translate.

![21.gifts apply translate](images/profile-apply-translate.png)

### Variant: translate-loading

Translate is busy and stays on the walk.

![21.gifts apply translate loading](images/profile-apply-translate-loading.png)

### Variant: translate-done

The walk shows the English note and Show original.

![21.gifts apply translate done](images/profile-apply-translate-done.png)

### Variant: translate-hidden

Show original returns the German note and offers Show translation.

![21.gifts apply translate hidden](images/profile-apply-translate-hidden.png)

### Variant: translate-error

A failed translate shows Could not translate this note. Please try again.

![21.gifts apply translate error](images/profile-apply-translate-error.png)

### Variant: forbidden

A basis account named joey-rosima, vincent, or jewel-bacolbas sees **You are not verified yet.** Any other basis account whose status is not pending, trial, or admitted sees the pause card. A basis account with one of those statuses sees **You are not verified yet.**

![21.gifts apply forbidden](images/profile-apply-forbidden.png)

### Variant: pending

An open application says a moderator will review the posts.

![21.gifts apply pending](images/profile-apply-pending.png)

### Variant: trial

A one-day trial says review repeats tomorrow.

![21.gifts apply trial](images/profile-apply-trial.png)

### Variant: admitted

An admitted member sees the daily 21.gifts grant payout sentence.

![21.gifts apply admitted](images/profile-apply-admitted.png)

### Variant: empty-posts

A filled profile with no living-room posts says No living-room posts.

![21.gifts apply empty posts](images/profile-apply-empty-posts.png)

### Variant: loading

Posts have not loaded yet, so the walk shows Loading….

![21.gifts apply loading](images/profile-apply-loading.png)

### Variant: error

A failed post load says Could not load this application. Please try again.

![21.gifts apply error](images/profile-apply-error.png)

### Variant: applying

Both Yes answers are in flight and the Yes button is disabled.

![21.gifts apply applying](images/profile-apply-applying.png)

### Variant: apply-failed

A failed POST says Could not submit your application. Please try again.

![21.gifts apply failed](images/profile-apply-apply-failed.png)

### Variant: unmet

No on the first question says When your posts match, you can apply again.

![21.gifts apply unmet](images/profile-apply-unmet.png)

## Screen: /messages

- **URL:** `/messages` — signed-in private-message inbox. Same onboarding gate as `/welcome`. Public notes stay at `/messages/[id]`.
- **What the user sees:** Fill `AppShell` (`align="center"`) with `MessagesChromeLeft` + wordmark → `/welcome` top-left and one **Menu** top-right (see **Signed-in header**); open the Menu for **Home**, **Balance**, **Shops**, **Point of sale**, Profile, **Grants**, **Settings**, **Living room rules**, **Habit-Tracker**, **Trust Chain**, **Statistics**, **Notifications**, **Messages**, **Contact**, optional **Install app**, and **Log out**. The top-left arrow returns to the previous in-app view in this tab, or `/welcome` when this tab has none. One arrow. The wordmark is not that control. Wordmark → `/welcome`. A thread opened from the list returns to the list; it does not always go to `/messages`. Heading **Messages**. Members see the unfiltered inbound list (all origins) with no `SegmentedControl`. Moderators see **Direct** | **Contact** | **Damus** (default **Direct**, one row) and a list of that origin only. Origin labels on rows stay for everyone. A `moderator_group` row is never listed; the closed staff room lives on `/moderate/group`. Member empty copy is **No private messages yet.** without the control; staff empty stays per-filter (**No private messages yet.** / **No contact messages yet.** / **No Damus messages yet.**) with the control visible. **Loading…** and **Try again** hide the control. Unread inbound rows are semibold with `text-app-fg` last text and a tabular-nums lining-nums unread-message count right of the name before the time when the derived count is greater than zero (`inbox.threadUnread` accessible name `{name}, {count} unread`; no visible word Unread); read inbound last text is a muted left preview; outbound last text is a filled right chip (`You: {text}`); gift-only last messages show the formatted amount. Open a thread (`?c=`) for the newest 20 messages, oldest-first within the page and a 8000-character composer plus an amount field with the ₿ / fiat switch and the other unit under it (no filter) with ImagePlus attach (JPEG/PNG/WebP max 10, photo-only send, stills in bubbles; the list has no attach): incoming bubbles are full-width muted note cards, sent bubbles are filled `app-btn` on the right labelled **You**. A pasted `https://21.gifts/messages/<uuid>` in a bubble unfurls as a nested quoted-note card (`ForumQuotedBody` / `fetchPublicMessage`). The bubble remainder uses conversation translate; nested forum quotes stay forum notes. The conversation list does not offer Translate. Older pages prepend near the oldest bubble. The open thread starts scrolled to the bottom (newest + composer) and stays there while the scroller is within 80px of the bottom, including when older pages prepend and when stills on the loaded page finish. Scrolling up unsticks; further prepends keep the same messages in view. A new newest message re-sticks. An open pay sheet is included in that bottom pin. Returning via the top-left arrow scrolls the conversation list to the top once when that previous view is the list. Opening a thread POSTs `/conversations/:id/read` and refreshes the home-screen badge. The open-thread heading is only the counterpart name + origin caption (no in-card back); the origin label sits under it, not inside the h1. `IntroduceYourselfOverlay` never opens here; only `/welcome` shows it. Every settled sats amount in an open thread also shows the preferred-fiat suffix stored when the payment was made (a stored string as-is; the spot rate when that field is null or missing). Unpaid invoice previews still use the current spot rate. A message whose `giftFor` points at another message renders as a footer inside that message instead of as a separate row. An open thread shows new messages without a reload, about every 5 seconds while the tab is visible, and once when the tab becomes visible again. A hidden tab does not poll. The inbox pay sheet pays from the member's in-app wallet only, like the forum pay sheet on `/welcome` (the `sparkInvoice` when the api issued one, otherwise the payment request); without a usable wallet it says so, and it shows no invoice QR and no button to another wallet app on any device.
- **Actions:** Open a thread, send a reply, attach JPEG/PNG/WebP stills on an open thread, return via the top-left arrow (when the previous view is the list, the list starts at the top), or to the forum when this tab has no earlier view. Open the counterpart (and incoming author) name to `/members/:id` when `accountId` is present. Open **Menu** (see **Signed-in header**) for **Home**, **Balance** (`/wallet`), **Shops**, **Point of sale**, Profile, **Grants**, **Settings**, **Living room rules**, **Habit-Tracker**, **Trust Chain**, **Statistics**, **Notifications**, **Messages**, **Contact**, optional **Install app**, or **Log out**. Member-profile Message and `/contact` send land here. Leave an open thread visible so new messages appear without a reload.
- **Calls:** `AppShell`, `MessagesChromeLeft`, `ProfileChromeLeft`, `MessagesPage`, `InboxLoader`, `InboxScreen`, `ForumQuotedBody`, `SignedInChrome`, `OnboardingGate`, `fetchConversations`, `fetchConversation`, `fetchModeratorGroup` (`roleAtLeast(role, 'moderator')`, unlisted `?c=` only), `fetchConversationMessagePhoto`, `fetchPublicMessage`, `postConversationMessage`, `prepareForumPhoto`, `postConversationInvoice`, `markConversationRead`, `refreshUnreadAppBadge`, `WalletPay`, `useWalletPay`, `payFromWallet`.
- **Auth:** Bearer session; `OnboardingGate screen="welcome"`.

### Variant: default

Member list. No chooser. All inbound origins: **Bob**, official **21.gifts**, and **npub1abc…xyz**.

![21.gifts inbox](images/messages.png)

### Variant: unread

Member list with an unread Direct row **Bob** (`unread: true`, `unreadMessageCount: 2`; `inbox.threadUnread`, accessible name **Bob, 2 unread**): semibold name, visible **2** with tabular-nums lining-nums, and `text-app-fg` last text. No visible word Unread. Other rows remain read/muted.

![21.gifts inbox unread](images/messages-unread.png)

### Variant: translate

Signed-in `/messages` list with one German conversation preview. The list does not offer Translate.

![21.gifts inbox, German preview](images/messages-translate.png)

### Variant: contact

Staff (moderator). Contact selected. List shows official **21.gifts**. Chooser present. No pinned Staff room / Moderators row.

![21.gifts inbox contact](images/messages-contact.png)

### Variant: damus

Staff (moderator). Damus selected. List shows **npub1abc…xyz**. Chooser present. No pinned Staff room / Moderators row.

![21.gifts inbox damus](images/messages-damus.png)

### Variant: sent-preview

Member. No chooser. Loaded list whose last text is the viewer's own send (**Bob**, `Hello team`). Preview **You: Hello team** as a compact filled chip on the right of the muted row, not muted body text.

![21.gifts inbox sent preview](images/messages-sent-preview.png)

### Variant: empty

Member. No threads. Copy **No private messages yet.** Chooser absent.

![21.gifts inbox empty](images/messages-empty.png)

### Variant: loading

Waiting on `GET /conversations`. Copy **Loading…** Chooser absent.

![21.gifts inbox loading](images/messages-loading.png)

### Variant: error

List fetch failed. Button **Try again**. Chooser absent.

![21.gifts inbox error](images/messages-error.png)

### Variant: thread

Open official thread. Heading **21.gifts** (a profile control when the api sent `accountId`), origin **Contact** under the heading, inbound **Hello team** as a full-width muted note card and a sent filled `app-btn` bubble on the right labelled **You**, composer visible: ImagePlus, the message, and send on one row; the **Amount** field (₿ | fiat, other unit under it) on the next row. Chooser absent.

![21.gifts inbox thread](images/messages-thread.png)

### Variant: thread-translate

Open thread with a German incoming message. **Translate** is visible under the body.

![21.gifts inbox thread translate](images/messages-thread-translate.png)

### Variant: thread-translate-loading

Same German incoming message after clicking **Translate** while the conversation translate POST hangs. The control is busy (`aria-busy`) with a spinner.

![21.gifts inbox thread translate loading](images/messages-thread-translate-loading.png)

### Variant: thread-translate-done

Same German incoming message after a successful translation. Translated body plus **Show original**; the German original is not shown.

![21.gifts inbox thread translate done](images/messages-thread-translate-done.png)

### Variant: thread-translate-hidden

After **Show original**: translated body hidden, the Languages icon is named **Show translation** and has no visible text.

![21.gifts inbox thread translate hidden](images/messages-thread-translate-hidden.png)

### Variant: thread-translate-error

Same German incoming message after the conversation translate POST fails. Alert **Could not translate this note. Please try again.** and the Translate control remains.

![21.gifts inbox thread translate error](images/messages-thread-translate-error.png)

### Variant: sent-sats

Member list. One conversation (**Bob**), gift-only last preview **₿21** (empty lastText, lastFromMe, lastSats 21). Chooser absent.

![21.gifts inbox sent sats](images/messages-sent-sats.png)

### Variant: thread-gift

Open official thread. fromMe gift-only bubble **send ₿21**. Composer still visible: ImagePlus on the message row, **Amount** on the row under the message. Chooser absent.

![21.gifts inbox thread gift](images/messages-thread-gift.png)

### Variant: thread-text-sats

Open thread. Inbound **Hi** with amount **₿21** under the body. Composer visible: ImagePlus on the message row, **Amount** on the row under the message.

![21.gifts inbox thread text sats](images/messages-thread-text-sats.png)

### Variant: thread-pay-sheet

Open thread, Amount **21** submitted. Pay sheet open with the in-app wallet pay slot; this build has no wallet configured, so it says **Your 21.gifts wallet is not available here, so this cannot be paid.** Close (`X`) dismisses the sheet and stays on this thread. It is not the top-left back arrow. The composer amount row is hidden; the sheet states that amount once, as the sat amount plus the default fiat from the current spot rate. Composer behind the sheet includes ImagePlus attach. Captured at desktop and mobile (same variant, four combos), identical on both: no invoice QR on any device. **Waiting for payment…** is acceptable while the pay poll hangs.

![21.gifts inbox thread pay sheet](images/messages-thread-pay-sheet.png)

### Variant: thread-wallet-pay-preparing

Pinned fixture (`?visual=wallet-pay-preparing`, Playwright builds only, invoice with a `sparkInvoice`). The inbox pay sheet shows the in-app wallet slot, with no invoice QR: a spinner and **Checking your wallet…**.

![21.gifts inbox thread wallet pay preparing](images/messages-thread-wallet-pay-preparing.png)

### Variant: thread-wallet-pay-confirm

Pinned fixture (`?visual=wallet-pay-confirm`, Playwright builds only, invoice with a `sparkInvoice`). The inbox pay sheet shows the in-app wallet slot, with no invoice QR: **Send**, and no fee row for the quoted fee of ₿0.

![21.gifts inbox thread wallet pay confirm](images/messages-thread-wallet-pay-confirm.png)

### Variant: thread-wallet-pay-paying

Pinned fixture (`?visual=wallet-pay-paying`, Playwright builds only, invoice with a `sparkInvoice`). The inbox pay sheet shows the in-app wallet slot, with no invoice QR: a spinner and **Paying from your wallet…**, with **Waiting for payment…** under it.

![21.gifts inbox thread wallet pay paying](images/messages-thread-wallet-pay-paying.png)

### Variant: thread-wallet-pay-insufficient

Pinned fixture (`?visual=wallet-pay-insufficient`, Playwright builds only, invoice with a `sparkInvoice`). The inbox pay sheet shows the in-app wallet slot, with no invoice QR: the alert that the wallet lacks Bitcoin, then **Still missing:** with the amount plus the known fee minus the balance in ₿ and fiat (the pin shows the full amount), then the member's own 21.gifts address and its Open CryptoPay QR.

![21.gifts inbox thread wallet pay insufficient](images/messages-thread-wallet-pay-insufficient.png)

### Variant: thread-wallet-pay-unconfirmed

Pinned fixture (`?visual=wallet-pay-unconfirmed`, Playwright builds only, invoice with a `sparkInvoice`). The inbox pay sheet shows the in-app wallet slot, with no invoice QR: the neutral not-confirmed-yet sentence.

![21.gifts inbox thread wallet pay unconfirmed](images/messages-thread-wallet-pay-unconfirmed.png)

### Variant: thread-wallet-required

Open thread, Amount **21** submitted, and the api answers the invoice with 400 and `code` `wallet_required` because the member's own wallet is not set up. No pay sheet opens; under the composer the wallet-required alert link leads to `/wallet`.

![21.gifts inbox thread wallet required](images/messages-thread-wallet-required.png)

### Variant: thread-quoted-note

Open Direct thread. Incoming bubble text includes a public forum note URL; the nested quoted-note card shows **A Quick Technical Note** and hides the raw `https://21.gifts/messages/<uuid>` URL.

![21.gifts inbox thread quoted note](images/messages-thread-quoted-note.png)

### Variant: thread-composer-photo

Open Direct thread. One JPEG selected in the composer; **Remove photo** visible; textarea empty. Amount field still visible.

![21.gifts inbox thread composer photo](images/messages-thread-composer-photo.png)

### Variant: thread-composer-photos

Open Direct thread. Two JPEGs selected in the composer; two **Selected photo** thumbs. Amount field still visible.

![21.gifts inbox thread composer photos](images/messages-thread-composer-photos.png)

### Variant: thread-photo

Open Direct thread. Incoming bubble is a still with no text. Image alt **Photo from Bob**. Composer with attach visible.

![21.gifts inbox thread photo](images/messages-thread-photo.png)

### Variant: thread-preparing-photo

Open Direct thread. JPEG attach in flight; **Send** disabled; no **Selected photo** yet. Amount field visible.

![21.gifts inbox thread preparing photo](images/messages-thread-preparing-photo.png)

### Variant: thread-error-unsupported

Open Direct thread. Attach a GIF → **Use a JPEG, PNG, or WebP photo**. No **Selected photo**.

![21.gifts inbox thread error unsupported](images/messages-thread-error-unsupported.png)

### Variant: thread-error-too-large

Open Direct thread. Encoded JPEG over 1 MB → **Keep photos under 1 MB**.

![21.gifts inbox thread error too large](images/messages-thread-error-too-large.png)

### Variant: thread-error-too-many

Open Direct thread. Eleven files → **You can add up to 10 photos**.

![21.gifts inbox thread error too many](images/messages-thread-error-too-many.png)

### Variant: thread-mention-suggest

Open thread. The message field contains `@` and the People list is open. Choosing a person does not notify them.

![21.gifts inbox thread mention suggestions](images/messages-thread-mention-suggest.png)

### Variant: thread-mention-inserted

Open thread. Choosing `@ada` from that list writes `@ada ` into the message field and closes the list.

![21.gifts inbox thread mention inserted](images/messages-thread-mention-inserted.png)

### Variant: thread-mention

Open thread. The incoming message **Hello @ada** stores a profile mark. **View profile** on that name opens the member. It does not notify them.

![21.gifts inbox thread mention](images/messages-thread-mention.png)

## Screen: /notifications

- **URL:** `/notifications` — signed-in notifications for living-room posts, replies, payments, moderator appointment, and moderator proposal. A heart row opens `/messages/{parentId}` and is marked read, the same as a zap. Same onboarding gate as `/welcome`. Public notes stay at `/messages/[id]`. JSON is `/forum/notifications` (Next.js forbids `route.ts` beside this page).
- **What the user sees:** Chrome is the page-frame header (`ProfileChromeLeft` (the arrow returns to the previous in-app view, or `/welcome` when this tab has none; wordmark → `/welcome`), and Menu, inside the rounded sheet). Fill `AppShell` (`align="center"`). Open **Menu** (see **Signed-in header**) for **Home**, **Balance** (`/wallet`), **Shops**, **Point of sale**, Profile, **Grants**, **Settings**, **Living room rules**, **Habit-Tracker**, **Trust Chain**, **Statistics**, **Notifications**, **Messages**, **Contact**, optional **Install app**, and **Log out**. Heading **Notifications**, a list of posts, replies, payments, hearts, moderator appointment, and moderator proposal (actor `{name} posted` / `{name} replied` / `{name} sent bitcoin` / `{name} sent you a heart` / `{name} proposed a moderator`, or **You are a moderator** without `{name}`; post or reply text or **Photo** / **Photo reaction**; zap amount as stored; appointment or proposal with empty text has no body line; time), empty copy **No notifications yet.**, **Loading…**, or **Try again**. Unread rows are semibold; read rows muted. No composer and no filter. `IntroduceYourselfOverlay` never opens here; only `/welcome` shows it. Visiting this screen / mark-all-read treats notification unread as 0; the badge becomes remaining inbox unread plus remaining staff-room unread (0 or 1). Visiting this screen does not clear staff-room unread.
- **Actions:** Click a `moderator_proposal` row to open `/moderate/proposals` (does **not** mark that notification read). Click a `moderator_appointed` row to open `/welcome` (mark that notification read). Click a `forum_reply` or `forum_mention` row to open `/messages/{replyId}`, and a `forum_post`, `zap`, or `heart` row to open `/messages/{parentId}` (mark that notification read; ids are URI-encoded). The top-left arrow returns to the previous in-app view in this tab, or `/welcome` when this tab has none. One arrow. The wordmark is not that control. Open **Menu** (see **Signed-in header**) for **Home**, **Balance** (`/wallet`), **Shops**, **Point of sale**, Profile, **Grants**, **Settings**, **Living room rules**, **Habit-Tracker**, **Trust Chain**, **Statistics**, **Notifications**, **Messages**, **Contact**, optional **Install app**, or **Log out**. Visiting this screen / mark-all-read treats notification unread as 0; the badge becomes remaining inbox unread plus remaining staff-room unread (0 or 1). Visiting this screen does not clear staff-room unread.
- **Calls:** `AppShell`, `ProfileChromeLeft`, `NotificationsPage`, `NotificationsLoader`, `NotificationsScreen`, `SignedInChrome`, `OnboardingGate`, `fetchNotifications`, `fetchConversations`, `fetchModeratorGroup`, `markNotificationRead`, `markAllNotificationsRead`.
- **Auth:** Bearer session; `OnboardingGate screen="welcome"`.

### Variant: default

Loaded list with at least one unread forum reply (actor **Bob**, copy **Bob replied**).

![21.gifts notifications](images/notifications.png)

### Variant: empty

No notifications. Copy **No notifications yet.**

![21.gifts notifications empty](images/notifications-empty.png)

### Variant: loading

Waiting on `GET /forum/notifications`. Copy **Loading…**

![21.gifts notifications loading](images/notifications-loading.png)

### Variant: error

List fetch failed. Button **Try again**. Copy **Could not load notifications. Please try again.**

![21.gifts notifications error](images/notifications-error.png)

### Variant: moderator-proposal

Unread `moderator_proposal` row (actor **Bob**, copy **Bob proposed a moderator**).

![21.gifts notifications moderator proposal](images/notifications-moderator-proposal.png)

## Screen: /statistics

- **URL:** `/statistics` — people-count and shop-activity charts for every visitor, signed-in or not. `OnboardingGate screen="welcome"` with `allowGuest`. A signed-out visitor is not sent to `/login`. Incomplete signed-in setup still is. HTML `/statistics` is the chart page, not a GET proxy (Next.js forbids `route.ts` beside this page). JSON is `GET /gifts/stats`. Not a second moderation hub. No daily funding goal on this page.
- **What the user sees:** Chrome is the page-frame header (`ProfileChromeLeft` (the arrow returns to the previous in-app view, or `/welcome` when this tab has none; wordmark → `/welcome`), and either **Log in** or Menu, inside the rounded sheet). Fill `AppShell` (`align="center"`). Heading **Statistics**. Signed-out top-right is **Log in**, not Menu. Only an active session whose wallet is open shows Menu; a held-back stored session counts as signed out here and shows **Log in**. Both see the **People paid** panel: yesterday's person count, the measurement paragraph, and the **People by UTC day** chart (lighter bar is today, no goal line). Both also see an **Active shops** panel under it: one explainer and the **Shops by UTC day** chart. The shop chart has no goal line and no link. The people panel is always open. No **Tap to close**. No Goal, percent, progress bar, or goal line. No Hidden notes, Open proposals, Moderators chat group, or Handbook controls. When `roleAtLeast(role, 'moderator')` and yesterday's person count is a number, a closed **Moderator functions** disclosure (`StaffFunctions`, catalog `staff.functions`) sits between the people chart and the shop panel; opening it shows **Show payout per person** (`moderate.payouts.link`) to `/moderate/payouts`. Basis and verified never see **Moderator functions**. A signed-out visitor never sees **Moderator functions**. Menu row **Statistics** (`nav.statistics`, lucide `BarChart3`, `/statistics`) for a signed-in account, immediately after Trust Chain. Menu row **Moderation** stays staff-only immediately after Statistics.
- **Actions:** The top-left arrow returns to the previous in-app view in this tab, or `/welcome` when this tab has none. One arrow. The wordmark is not that control. Signed-out visitors open **Log in**. A session opens **Menu**. No note list on this page. The shop chart has no drill-down. Staff may open **Moderator functions** then **Show payout per person**.
- **Calls:** `AppShell`, `ProfileChromeLeft`, `StatisticsPage`, `StatisticsScreen`, `PeopleCountChart`, `ShopActivityChart`, `StaffFunctions`, `SignedInChrome`, `OnboardingGate`, `fetchGiftStats`, `fetchShopActivity`.
- **Auth:** No bearer required to read the page. Fetch `GET /gifts/stats` and `GET /shops/activity` with or without a session. `OnboardingGate screen="welcome"` with `allowGuest`. Each request fails on its own. Closed **Moderator functions** only when `roleAtLeast(role, 'moderator')` and yesterday's count is a number.

### Variant: default

Staff (moderator) page with heading **Statistics**, the **People paid** panel always open (yesterday count, measurement paragraph, 30-UTC-day chart). Closed **Moderator functions** sits between the people chart and the shop chart; **Show payout per person** is not visible yet. The shop chart sits under that disclosure (**Shops by UTC day**). The people panel is not a toggle.

![21.gifts statistics](images/statistics.png)

### Variant: loading

Staff (moderator) page. Both panels show **Loading…** while their own request is in flight: the people panel (group **People paid**) for `GET /gifts/stats`, and the shop panel (group **Active shops**) for `GET /shops/activity`. One panel can finish while the other is still loading. **Moderator functions** is not shown.

![21.gifts statistics loading](images/statistics-loading.png)

### Variant: error

Staff (moderator) page. The people panel shows **Could not load payouts. Please try again.** and **Try again**. The shop panel under it still shows **Shops by UTC day**. The two panels fail independently. **Moderator functions** is not shown.

![21.gifts statistics error](images/statistics-error.png)

### Variant: member

A basis account sees both charts and both explainers. No **Moderator functions**. No **This page is for moderators.**

![21.gifts statistics member](images/statistics-member.png)

### Variant: signed-out

No session. Top-right is **Log in** instead of Menu. Both charts. No **Moderator functions**.

![21.gifts statistics signed out](images/statistics-signed-out.png)

### Variant: staff-open

A founder clicks **Moderator functions**, then **Show payout per person** is visible.

![21.gifts statistics staff open](images/statistics-staff-open.png)

### Variant: shop-error

Staff (moderator) page. The people chart stays up (**People by UTC day**). Closed **Moderator functions** sits between the people chart and the shop panel; **Show payout per person** is not visible yet. The shop panel under it shows **Could not load shop activity. Please try again.** and **Try again**.

![21.gifts statistics shop error](images/statistics-shop-error.png)

### Variant: both-error

Staff (moderator) page. The people panel shows **Could not load payouts. Please try again.** and the shop panel shows **Could not load shop activity. Please try again.** **Moderator functions** is not shown.

![21.gifts statistics both error](images/statistics-both-error.png)

## Screen: /moderate

- **URL:** `/moderate` — signed-in moderation hub for moderators. Same onboarding gate as `/welcome` (`OnboardingGate screen="welcome"`). HTML `/moderate` is the hub, not a GET proxy; this page does not fetch hidden notes, proposals, applications, or gift stats. The Open proposals count comes from `useUnreadCount` (`GET /trust/proposals`); the queue itself is `/moderate/proposals`. JSON for hidden notes lives under `/forum/messages/hidden`; JSON for open proposals lives under `/trust/proposals`; JSON for grant applications lives under `/funding/applications` (Next.js forbids `route.ts` beside this page).
- **What the user sees:** Chrome is the page-frame header (`ProfileChromeLeft` (the arrow returns to the previous in-app view, or `/welcome` when this tab has none; wordmark → `/welcome`), and Menu, inside the rounded sheet). Fill `AppShell` (`align="center"`). Heading **Moderation**. Staff (moderator) see a labeled **Goals** `ButtonLink` (`variant="secondary"` `size="lg"`) to `/grants/goals` (first tool), a labeled **Hidden notes** `ButtonLink` (`variant="secondary"` `size="lg"`) to `/moderate/hidden`, a labeled **Open proposals** `ButtonLink` (`variant="secondary"` `size="lg"`) to `/moderate/proposals` that shows a count when `proposalCount` > 0 (`moderate.proposals.unread`, accessible name like Open proposals, 1 unread), **Moderators chat group** `ButtonLink` → `/moderate/group`, **Handbook** `ButtonLink` → `/moderate/handbook`, and **Show payout per person** `ButtonLink` → `/moderate/payouts` (last tool). Hub **Moderators chat group** ButtonLink shows a count when staff-room unread (`moderationUnreadCount - proposalCount`) is greater than zero (`moderate.groupUnread`, accessible name like Moderators chat group, 1 unread); href stays `/moderate/group`. Non-staff signed-in visitors see the heading plus **This page is for moderators.** and no tools list. Menu row **Statistics** sits before Moderation. Menu row **Moderation** (`nav.moderate`, lucide `Shield`, `/moderate`) only when `roleAtLeast(role, 'moderator')`, after **Statistics**. Staff Menu row **Moderation** shows a count when staff-room unread plus open-proposal count is greater than zero (`nav.moderateUnread`, accessible name like Moderation, 1 unread); href stays `/moderate`. Menu has no Open proposals row.
- **Actions:** Open **Goals** to `/grants/goals`. Open **Hidden notes** to `/moderate/hidden`. Open **Open proposals** to `/moderate/proposals`. Moderators also open **Moderators chat group** to `/moderate/group`. Open **Handbook** to `/moderate/handbook`. Open **Show payout per person** to `/moderate/payouts`. The top-left arrow returns to the previous in-app view in this tab, or `/welcome` when this tab has none. One arrow. The wordmark is not that control. Open **Menu**. No list fetch and no un-hide control on this page. Hub does not fetch proposals, applications, or gift stats itself (Open proposals count comes from `useUnreadCount`).
- **Calls:** `AppShell`, `ProfileChromeLeft`, `ModeratePage`, `ModerateScreen`, `SignedInChrome`, `OnboardingGate`, `useUnreadCount`.
- **Auth:** Bearer session; `OnboardingGate screen="welcome"`. Hub tools only when `roleAtLeast(role, 'moderator')`; others see forbidden copy and do not fetch. This page does not call `GET /gifts/stats`.

### Variant: default

Staff (moderator) hub with heading **Moderation**, labeled **Goals** control → `/grants/goals`, labeled **Hidden notes** control → `/moderate/hidden`, labeled **Open proposals** control → `/moderate/proposals`, **Moderators chat group** control → `/moderate/group`, **Handbook** control → `/moderate/handbook`, and **Show payout per person** → `/moderate/payouts`. No goal widget.

![21.gifts moderation](images/moderate.png)

### Variant: group-unread

Staff hub with an unread Moderators chat group. **Moderators chat group** control shows **1** and accessible name **Moderators chat group, 1 unread** (`moderate.groupUnread`). Goals, Hidden notes, Open proposals, Handbook, and Show payout per person unchanged.

![21.gifts moderation group unread](images/moderate-group-unread.png)

### Variant: proposals-unread

Staff hub with one open proposal. **Open proposals** control shows **1** and accessible name **Open proposals, 1 unread** (`moderate.proposals.unread`). Goals, Hidden notes, Moderators chat group, Handbook, and Show payout per person unchanged.

![21.gifts moderation proposals unread](images/moderate-proposals-unread.png)

### Variant: forbidden

Signed-in basis account. Copy **This page is for moderators.** No tools list.

![21.gifts moderation forbidden](images/moderate-forbidden.png)

## Screen: /moderate/payouts

- **URL:** `/moderate/payouts` — signed-in staff table of daily-grant payouts per person. Same onboarding gate as `/moderate` (`OnboardingGate screen="welcome"`). HTML `/moderate/payouts` is the table, not a GET proxy. JSON is `GET /funding/payout-days`. Hub is `/moderate`.
- **What the user sees:** Fill `AppShell` (`align="center"`) with one top-left arrow (`ProfileChromeLeft`) that returns to the previous in-app view in this tab, or `/welcome` when this tab has none, plus wordmark → `/welcome`. The wordmark is not that control. One **Menu** sits top-right. No in-card back. Heading **Payout per person**. Staff see the lead (seven UTC days, today on the right, moderator stipends excluded), a legend (**Not entitled**, **Entitled, not collected**, **Payout received**, **Welcome gift**), then a table: **Name** plus seven day columns, oldest on the left and today on the right (the last header also says **today**). Cells are color blocks: black not entitled, white entitled but not collected, green payout received, amber for a welcome gift alone, and a split green/amber cell when both were received. A name with an account id links to `/members/{id}`. Empty copy **Nobody was entitled in these seven days.** Loading… or error plus **Try again**. Non-staff see the heading plus **This page is for moderators.** and no table.
- **Actions:** The top-left arrow returns to the previous in-app view in this tab, or `/welcome` when this tab has none. One arrow. The wordmark is not that control (wordmark → `/welcome`). Open a member when the row has an account id. **Try again** after a load error. Open **Menu**.
- **Calls:** `PayoutsPage`, `FundingPayoutsScreen`, `fetchFundingPayoutDays`.
- **Auth:** Bearer session; `OnboardingGate screen="welcome"`. The table fetches only when `roleAtLeast(role, 'moderator')`.

### Variant: default

Staff table with one person, Ada: amber for a welcome gift alone, white for entitled but not collected, a split green/amber cell when both were received, and black for the remaining days. Today is the rightmost column.

![21.gifts payout per person](images/moderate-payouts.png)

### Variant: empty

Staff page when nobody was entitled. Sentence **Nobody was entitled in these seven days.** No table.

![21.gifts payout per person empty](images/moderate-payouts-empty.png)

### Variant: forbidden

Signed-in basis account. Copy **This page is for moderators.** No table.

![21.gifts payout per person forbidden](images/moderate-payouts-forbidden.png)

### Variant: loading

Staff page while the table is loading. Copy **Loading…**.

![21.gifts payout per person loading](images/moderate-payouts-loading.png)

### Variant: error

Staff page when the load fails. Copy **Could not load the payout table. Please try again.** and button **Try again**.

![21.gifts payout per person error](images/moderate-payouts-error.png)

## Screen: /moderate/hidden

- **URL:** `/moderate/hidden` — signed-in hidden-notes list for moderators. Same onboarding gate as `/welcome` (`OnboardingGate screen="welcome"`). HTML `/moderate/hidden` is the hidden-notes page, not a GET proxy. JSON is `/forum/messages/hidden` (Next.js forbids `route.ts` beside this page).
- **What the user sees:** Fill `AppShell` (`align="center"`) with one top-left arrow (`ProfileChromeLeft`) that returns to the previous in-app view in this tab, or `/welcome` when this tab has none, plus wordmark → `/welcome`. The wordmark is not that control. One **Menu** sits top-right. No in-card back. Heading **Hidden notes**. Staff (moderator) see the lead copy about a soft hide (the note and its untagged direct replies leave the living room; not a hard delete), then the hidden-note list newest-hidden first (author, a non-interactive **External** badge next to the name when the row has a `via` value, text with Languages **Translate** outside the name link, **Hidden by {name}** / **Unnamed**, created and hidden times), empty copy **No hidden notes.**, **Loading…**, or **Try again**. Non-staff signed-in visitors see the heading plus **This page is for moderators.** and no list. No un-hide control. No hidden photo/video fetch.
- **Actions:** The top-left arrow returns to the previous in-app view in this tab, or `/welcome` when this tab has none. One arrow. The wordmark is not that control (wordmark → `/welcome`). The row stays the link to the note. When `accountId` is set, the name beside that link is the member button. External rows stay text. Tap the rest of the row to open `/messages/:id`. **Translate** (Languages icon) sits under the note text when it differs from the UI locale (staff permalink shows the note plus who hid it and when). Open **Menu**. Staff **Try again** on list error. No un-hide control on this page.

- **Calls:** `AppShell`, `ProfileChromeLeft`, `HiddenNotesPage`, `HiddenNotesScreen`, `SignedInChrome`, `OnboardingGate`, `listHiddenMessages`.
- **Auth:** Bearer session; `OnboardingGate screen="welcome"`. List only when `roleAtLeast(role, 'moderator')`; others see forbidden copy and do not fetch.

### Variant: default

Staff (moderator) loaded list with at least one hidden note (author **Bob**, text **Hidden note**, **Hidden by Ada**).

![21.gifts hidden notes](images/moderate-hidden.png)

### Variant: translate

Staff `/moderate/hidden` with one German hidden note. **Translate** is visible under the body.

![21.gifts hidden notes translate](images/hidden-translate.png)

### Variant: translate-loading

Same German hidden note after clicking **Translate** while POST `/translate` hangs. The control is busy (`aria-busy`) with a spinner.

![21.gifts hidden notes translate loading](images/hidden-translate-loading.png)

### Variant: translate-done

Same German hidden note after a successful translation. Translated body plus **Show original**; the German original is not shown.

![21.gifts hidden notes translate done](images/hidden-translate-done.png)

### Variant: translate-hidden

After **Show original**: translated body hidden, the Languages icon is named **Show translation** and has no visible text.

![21.gifts hidden notes translate hidden](images/hidden-translate-hidden.png)

### Variant: translate-error

Same German hidden note after POST /translate fails. Alert **Could not translate this note. Please try again.** and the Translate control remains.

![21.gifts hidden notes translate error](images/hidden-translate-error.png)

### Variant: external

Staff (moderator) loaded list with one hidden note written without a 21.gifts account (author **Robin**, text **Hidden external note**, the non-interactive **External** badge next to the name, **Hidden by Ada**).

![21.gifts hidden notes external](images/moderate-hidden-external.png)

### Variant: forbidden

Signed-in basis account. Copy **This page is for moderators.** No list.

![21.gifts hidden notes forbidden](images/moderate-hidden-forbidden.png)

### Variant: empty

Staff (moderator) loaded list with zero hidden notes. Copy **No hidden notes.**

![21.gifts hidden notes empty](images/moderate-hidden-empty.png)

### Variant: loading

Staff (moderator) waiting on `GET /forum/messages/hidden`. Copy **Loading…**

![21.gifts hidden notes loading](images/moderate-hidden-loading.png)

### Variant: error

Staff (moderator) list fetch failed. Button **Try again**.

![21.gifts hidden notes error](images/moderate-hidden-error.png)

## Screen: /moderate/proposals

- **URL:** `/moderate/proposals` — signed-in staff confirm/reject queue. Same onboarding gate as `/moderate`. JSON is `/trust/proposals`. Hub is `/moderate`.
- **What the user sees:** Fill `AppShell` (`align="center"`) with one top-left arrow (`ProfileChromeLeft`) that returns to the previous in-app view in this tab, or `/welcome` when this tab has none, plus wordmark → `/welcome`. The wordmark is not that control. One **Menu** sits top-right. No in-card back. Heading **Open proposals**. Staff rows: subject name (link `/members/{id}`), **Proposed by {name}**, time, **Reject** on every open row, **Confirm as moderator** only when not self-proposed, or **Waiting for another moderator to confirm.** plus **Reject** when self-proposed. Empty / Loading… / error+Try again. Failed confirm or reject: **Could not update this member. Please try again.** Non-staff: heading + forbidden copy, no list. Menu: **Moderation** only (no Open proposals row).
- **Actions:** The top-left arrow returns to the previous in-app view in this tab, or `/welcome` when this tab has none. One arrow. The wordmark is not that control (wordmark → `/welcome`). Staff confirm, reject, or Try again. Busy disables Confirm and Reject. Open Menu.
- **Calls:** `AppShell`, `ProfileChromeLeft`, `ProposalsPage`, `ProposalsScreen`, `SignedInChrome`, `OnboardingGate`, `fetchTrustProposals`, `postTrustConfirm`, `postTrustReject`.
- **Auth:** Bearer; list only when `roleAtLeast(role, 'moderator')`.

### Variant: default

Staff (moderator) loaded queue with at least one open proposal (subject **Rose**, **Proposed by Bob**, **Confirm as moderator**, **Reject**).

![21.gifts open proposals](images/moderate-proposals.png)

### Variant: sunday

Device-local Sunday. **Rose** stays. **Confirm as moderator** and **Reject** are gone. **Writing is paused on Sunday.**

![21.gifts open proposals sunday](images/moderate-proposals-sunday.png)

### Variant: forbidden

Signed-in basis account. Copy **This page is for moderators.** No list.

![21.gifts open proposals forbidden](images/moderate-proposals-forbidden.png)

### Variant: empty

Staff (moderator) loaded list with zero open proposals. Copy **No open proposals.**

![21.gifts open proposals empty](images/moderate-proposals-empty.png)

### Variant: loading

Staff (moderator) waiting on `GET /trust/proposals`. Copy **Loading…**

![21.gifts open proposals loading](images/moderate-proposals-loading.png)

### Variant: error

Staff (moderator) list fetch failed. Copy **Could not load open proposals. Please try again.** Button **Try again**.

![21.gifts open proposals error](images/moderate-proposals-error.png)

### Variant: waiting-confirm

Staff (moderator) row they proposed themselves. Copy **Waiting for another moderator to confirm.** No Confirm button. **Reject** visible.

![21.gifts open proposals waiting confirm](images/moderate-proposals-waiting-confirm.png)

### Variant: confirm-error

Staff (moderator) Confirm as moderator failed. Copy **Could not update this member. Please try again.**

![21.gifts open proposals confirm error](images/moderate-proposals-confirm-error.png)

### Variant: reject-error

Staff (moderator) Reject failed. Copy **Could not update this member. Please try again.** Confirm still visible (someone else proposed).

![21.gifts open proposals reject error](images/moderate-proposals-reject-error.png)

### Variant: reject-error-self

Staff (moderator) Reject failed on a row they proposed themselves. Copy **Waiting for another moderator to confirm.** and **Could not update this member. Please try again.** No Confirm button. **Reject** visible.

![21.gifts open proposals reject error self](images/moderate-proposals-reject-error-self.png)

### Variant: confirming

Staff (moderator) Confirm as moderator POST in flight. Confirm and Reject disabled; spinner on Confirm; proposal row still visible.

![21.gifts open proposals confirming](images/moderate-proposals-confirming.png)

### Variant: rejecting

Staff (moderator) Reject POST in flight. Confirm and Reject disabled; spinner on Reject; proposal row still visible.

![21.gifts open proposals rejecting](images/moderate-proposals-rejecting.png)

### Variant: rejecting-self

Staff (moderator) Reject POST in flight on a row they proposed themselves. Copy **Waiting for another moderator to confirm.** No Confirm button. Reject disabled with spinner; proposal row still visible.

![21.gifts open proposals rejecting self](images/moderate-proposals-rejecting-self.png)

## Screen: /moderate/applications

- **Purpose:** Permanent redirect to `/grants/applications`. This path renders no queue UI.
- **Inputs:** None. The browser lands on `/grants/applications`.
- **Actions:** `redirect('/grants/applications')`.
- **Used by:** Old links to `/moderate/applications`.

### Variant: redirect

Opening `/moderate/applications` lands on the grants application queue.

![21.gifts open applications](images/moderate-applications.png)

## Screen: /moderate/applications/[accountId]

- **Purpose:** Permanent redirect to `/grants/applications/[accountId]`. This path renders no review UI.
- **Inputs:** `accountId` from the path. The browser lands on `/grants/applications/{accountId}`.
- **Actions:** `redirect` to that grants review path.
- **Used by:** Old links to `/moderate/applications/[accountId]`.

### Variant: redirect

Opening `/moderate/applications/[accountId]` lands on the grants review.

![21.gifts grant application](images/moderate-applications-accountId.png)

## Screen: /grants/applications

- **URL:** `/grants/applications` — signed-in staff grant-application queue. Same onboarding gate as `/moderate`. JSON is `/funding/applications`. Hub is `/grants`.
- **What the user sees:** Fill `AppShell` (`align="center"`) with one top-left arrow (`ProfileChromeLeft`) that returns to the previous in-app view in this tab, or `/welcome` when this tab has none, plus wordmark → `/welcome`. The wordmark is not that control. One **Menu** sits top-right. No in-card back. Heading **Open applications**. Staff rows: applicant name (link `/grants/applications/{id}`), applied time. Empty / Loading… / error+Try again. Non-staff: heading + forbidden copy, no list. Menu includes **Grants**.
- **Actions:** The top-left arrow returns to the previous in-app view in this tab, or `/welcome` when this tab has none. One arrow. The wordmark is not that control (wordmark → `/welcome`). Open an applicant to `/grants/applications/{id}`. Staff **Try again** on list error. Open Menu.
- **Calls:** `AppShell`, `ProfileChromeLeft`, `FundingApplicationsPage`, `FundingApplicationsScreen`, `SignedInChrome`, `OnboardingGate`, `fetchFundingApplications`.
- **Auth:** Bearer; list only for founder|moderator.

### Variant: default

Staff (founder) loaded queue with at least one open application (subject **Rose**).

![21.gifts open applications](images/moderate-applications.png)

### Variant: forbidden

Signed-in basis account. Copy **This page is for moderators.** No list.

![21.gifts open applications forbidden](images/moderate-applications-forbidden.png)

### Variant: empty

Staff (founder) loaded list with zero open applications. Copy **No open applications.**

![21.gifts open applications empty](images/moderate-applications-empty.png)

### Variant: loading

Staff (founder) waiting on `GET /funding/applications`. Copy **Loading…**

![21.gifts open applications loading](images/moderate-applications-loading.png)

### Variant: error

Staff (founder) list fetch failed. Copy **Could not load open applications. Please try again.** Button **Try again**.

![21.gifts open applications error](images/moderate-applications-error.png)

## Screen: /grants/applications/[accountId]

- **URL:** `/grants/applications/[accountId]` — signed-in staff grant-application review. Same onboarding gate as `/moderate`. JSON is `/funding/applications/:accountId`.
- **What the user sees:** Fill `AppShell` (`align="center"`) with one top-left arrow (`ProfileChromeLeft`) that returns to the previous in-app view in this tab, or `/welcome` when this tab has none, plus wordmark → `/welcome`. The wordmark is not that control. One **Menu** sits top-right. No in-card back. Heading **Grant application**. Staff see the applicant name, then two questions and the living-room posts (Languages **Translate** on the post text; the applicant name stays plain; each post keeps its own time). The first question asks whether the profile posts match the core principles and links to `/about`. **Yes** opens the truth question. **Yes** there admits. **No** on either question rejects, while the grant is open. There is no separate application time. Empty posts / Loading… / error+Try again. Failed decision: **Could not update this member. Please try again.** Non-staff: heading + forbidden copy, no fetch.
- **Actions:** The top-left arrow returns to the previous in-app view in this tab, or `/welcome` when this tab has none. One arrow. The wordmark is not that control (wordmark → `/welcome`). Staff **Yes** on the truth question posts admit; **No** posts reject. Try again. Open Menu.
- **Calls:** `AppShell`, `ProfileChromeLeft`, `FundingApplicationDetailPage`, `FundingApplicationDetailScreen`, `SignedInChrome`, `OnboardingGate`, `fetchFundingApplication`, `postFundingAdmit`, `postFundingReject`.
- **Auth:** Bearer; review only for founder|moderator.

### Variant: default

Staff (founder) loaded application for **Rose**. Question **Do their profile posts match the core principles of 21.gifts?** **Yes** / **No**. No application time under the name. The post keeps its own time.

![21.gifts grant application](images/moderate-applications-accountId.png)

### Variant: sunday

Device-local Sunday. The application stays readable. **Yes** and **No** are gone. **Writing is paused on Sunday.**

![21.gifts grant application sunday](images/grants-applications-accountId-sunday.png)

### Variant: truth

**Yes** on the principles question. Copy **Do these posts, to your knowledge, correspond to the truth?** The About link is gone. **Yes** admits. **No** rejects.

![21.gifts grant application truth](images/grants-applications-accountId-truth.png)

### Variant: translate

Staff `/grants/applications/:accountId` with a German reviewed post. **Translate** is visible under the body.

![21.gifts grant application translate](images/applications-detail-translate.png)

### Variant: translate-loading

Same German post after clicking **Translate** while POST `/translate` hangs. The control is busy (`aria-busy`) with a spinner.

![21.gifts grant application translate loading](images/applications-detail-translate-loading.png)

### Variant: translate-done

Same German post after a successful translation. Translated body plus **Show original**; the German original is not shown.

![21.gifts grant application translate done](images/applications-detail-translate-done.png)

### Variant: translate-hidden

After **Show original**: translated body hidden, the Languages icon is named **Show translation** and has no visible text.

![21.gifts grant application translate hidden](images/applications-detail-translate-hidden.png)

### Variant: translate-error

Same German post after POST /translate fails. Alert **Could not translate this note. Please try again.** and the Translate control remains.

![21.gifts grant application translate error](images/applications-detail-translate-error.png)

### Variant: forbidden

Signed-in basis account. Copy **This page is for moderators.** No fetch.

![21.gifts grant application forbidden](images/moderate-applications-accountId-forbidden.png)

### Variant: empty

Staff (founder) loaded application for **Rose** with zero living-room posts. Copy **No living-room posts.** The principles question and **Yes** / **No** are still visible.

![21.gifts grant application empty](images/moderate-applications-accountId-empty.png)

### Variant: loading

Staff (founder) waiting on `GET /funding/applications/:accountId`. Copy **Loading…**

![21.gifts grant application loading](images/moderate-applications-accountId-loading.png)

### Variant: error

Staff (founder) detail fetch failed. Copy **Could not load this application. Please try again.** Button **Try again**.

![21.gifts grant application error](images/moderate-applications-accountId-error.png)

### Variant: decide-failed

Staff (founder) Reject POST failed after **No**. Copy **Could not update this member. Please try again.**

![21.gifts grant application decide failed](images/moderate-applications-accountId-decide-failed.png)

### Variant: deciding

Staff (founder) Reject POST in flight. **No** disabled with a spinner; application still visible.

![21.gifts grant application deciding](images/moderate-applications-accountId-deciding.png)

## Screen: /moderate/group

- **URL:** `/moderate/group` — signed-in closed moderator group thread. Same onboarding gate as `/welcome` (`OnboardingGate screen="welcome"`). HTML `/moderate/group` is the group page, not a GET proxy. JSON is `/conversations/moderator-group` (Next.js forbids `route.ts` beside this page).
- **What the user sees:** Fill `AppShell` (`align="center"`) with one top-left arrow (`ProfileChromeLeft`) that returns to the previous in-app view in this tab, or `/welcome` when this tab has none, plus wordmark → `/welcome`. The wordmark is not that control. One **Menu** sits top-right. No in-card back. Heading **Moderators chat group**. Moderators fetch the singleton group then the newest 20-message page and reuse `InboxScreen` (no origin filter; no in-card back). The loaded heading is the catalog label **Moderators chat group** (never the api row name); the composer has **Add a photo** (JPEG/PNG/WebP, up to 10) and no **Amount** field (no gifts). A pasted `https://21.gifts/messages/<uuid>` unfurls as a nested quoted-note card. The bubble remainder uses conversation translate; nested forum quotes stay forum notes. There is no conversation list. The loaded staff-room thread starts scrolled to the bottom (newest + composer) and stays there while the scroller is within 80px of the bottom, including when older pages prepend and when stills on the loaded page finish. Scrolling up unsticks; further prepends keep the same messages in view. A new newest message re-sticks. Older pages prepend near the oldest bubble. After a successful group+thread load, opening the room POSTs `/conversations/:id/read` (same as opening an inbox thread), bumps the badge epoch, and refreshes the home-screen badge with staff-room unread 0. Other signed-in visitors see heading **Moderators chat group** plus **This room is for moderators.** and do not fetch. Loading **Loading…**. Error **Try again**. Empty thread: composer visible, no messages. A thread message that another message's `giftFor` points at shows that gift attached under it as a compact `role="note"` line (name, ₿ amount, preferred-fiat suffix, time) instead of as its own bubble. Every sats amount in the thread (gift-only, text+sats, and the nested line) shows the same preferred-fiat suffix the forum already shows, (a stored string as-is; the spot rate when that field is null or missing). The open room shows new messages without a reload, about every 5 seconds while the tab is visible, and once when the tab becomes visible again. A hidden tab does not poll.
- **Actions:** The top-left arrow returns to the previous in-app view in this tab, or `/welcome` when this tab has none. One arrow. The wordmark is not that control (wordmark → `/welcome`). Open **Menu**. Moderators attach photos, send a reply (text and/or photos), and **Try again** on fetch error. After a successful group+thread load, opening the room POSTs `/conversations/:id/read` (same as opening an inbox thread), bumps the badge epoch, and refreshes the home-screen badge with staff-room unread 0. Leave the room open so new messages appear without a reload.
- **Calls:** `AppShell`, `ProfileChromeLeft`, `ModeratorGroupPage`, `ModeratorGroupScreen`, `InboxScreen`, `ForumQuotedBody`, `SignedInChrome`, `OnboardingGate`, `fetchModeratorGroup`, the newest 20-message page via `fetchConversation`, `fetchConversationMessagePhoto`, `fetchPublicMessage`, `postConversationMessage`, `prepareForumPhoto`, `markConversationRead`, `refreshUnreadAppBadge`.
- **Auth:** Bearer session; `OnboardingGate screen="welcome"`. Thread only when `roleAtLeast(role, 'moderator')`; others see forbidden copy and do not fetch.

### Variant: default

Moderator. Loaded group thread with message **Hello mods**. Composer visible. No origin filter.

![21.gifts moderator group](images/moderate-group.png)

### Variant: sunday

Device-local Sunday. The moderator thread is not loaded and the composer is gone. The sentence **The moderator chat is paused on Sunday.** stands in their place.

![21.gifts moderator group sunday](images/moderate-group-sunday.png)

### Variant: stipend

Moderator. Loaded group thread with **Rose Otero**'s message **Great work today, moderators!**
and the paid stipend as a footer line inside that bubble (not a separate bubble): **21.gifts**,
the ₿ amount plus preferred-fiat suffix, and the payment time. Composer visible.

![21.gifts moderator group stipend](images/moderate-group-stipend.png)

### Variant: forbidden

Signed-in non-staff visitor (verified or basis). Heading **Moderators chat group**. Copy **This room is for moderators.** No thread fetch.

![21.gifts moderator group forbidden](images/moderate-group-forbidden.png)

### Variant: empty

Moderator. Group exists, zero messages. Composer **Your message** visible.

![21.gifts moderator group empty](images/moderate-group-empty.png)

### Variant: loading

Moderator waiting on `GET /conversations/moderator-group`. Copy **Loading…**

![21.gifts moderator group loading](images/moderate-group-loading.png)

### Variant: error

Moderator fetch failed. Button **Try again**.

![21.gifts moderator group error](images/moderate-group-error.png)

### Variant: composer-photo

Moderator. Empty thread. One JPEG selected in the composer; **Remove photo** visible; textarea empty.

![21.gifts moderator group composer photo](images/moderate-group-composer-photo.png)

### Variant: composer-photos

Moderator. Empty thread. Two JPEGs selected in the composer; two **Selected photo** thumbs.

![21.gifts moderator group composer photos](images/moderate-group-composer-photos.png)

### Variant: quoted-note

Moderator. Loaded group thread whose body is a public forum note URL. Nested quoted-note card shows **A Quick Technical Note**; the raw URL is hidden.

![21.gifts moderator group quoted note](images/moderate-group-quoted-note.png)

### Variant: photo

Moderator. Loaded group thread with one attached still and no text. Image alt **Photo from Ada**.

![21.gifts moderator group photo](images/moderate-group-photo.png)

### Variant: preparing-photo

Moderator. Empty thread. JPEG attach in flight; **Send** disabled; no **Selected photo** yet.

![21.gifts moderator group preparing photo](images/moderate-group-preparing-photo.png)

### Variant: error-unsupported

Moderator. Empty thread. Attach a GIF → **Use a JPEG, PNG, or WebP photo**. No **Selected photo**.

![21.gifts moderator group error unsupported](images/moderate-group-error-unsupported.png)

### Variant: error-too-large

Moderator. Empty thread. Encoded JPEG over 1 MB → **Keep photos under 1 MB**.

![21.gifts moderator group error too large](images/moderate-group-error-too-large.png)

### Variant: error-too-many

Moderator. Empty thread. Eleven files → **You can add up to 10 photos**.

![21.gifts moderator group error too many](images/moderate-group-error-too-many.png)

### Variant: mention-suggest

Moderator. Loaded group thread. The message field contains `@` and the People list is open. Choosing a person does not notify them.

![21.gifts moderator group mention suggestions](images/moderate-group-mention-suggest.png)

### Variant: mention-inserted

Moderator. Choosing `@ada` from that list writes `@ada ` into the message field and closes the list.

![21.gifts moderator group mention inserted](images/moderate-group-mention-inserted.png)

### Variant: mention

Moderator. The incoming message **Hello @ada** stores a profile mark. **View profile** on that name opens the member. It does not notify them.

![21.gifts moderator group mention](images/moderate-group-mention.png)

### Variant: translate

Moderator. One incoming German message. **Translate** is visible. The German text stays.

![21.gifts moderator group translate](images/moderate-group-translate.png)

### Variant: translate-loading

Moderator. **Translate** was pressed and the request has not returned. The button is busy.

![21.gifts moderator group translate loading](images/moderate-group-translate-loading.png)

### Variant: translate-done

Moderator. The message shows the English translation and **Show original**.

![21.gifts moderator group translate done](images/moderate-group-translate-done.png)

### Variant: translate-hidden

Moderator. **Show original** was pressed. The German text is back, with **Show translation**.

![21.gifts moderator group translate hidden](images/moderate-group-translate-hidden.png)

### Variant: translate-error

Moderator. Translation failed. The alert says the note could not be translated, and **Translate** is still there.

![21.gifts moderator group translate error](images/moderate-group-translate-error.png)

## Screen: /moderate/handbook

- **URL:** `/moderate/handbook` — signed-in staff handbook of how 21.gifts works. Same onboarding gate as `/welcome` (`OnboardingGate screen="welcome"`). HTML `/moderate/handbook` is the handbook page, not a GET proxy. Hub is `/moderate`.
- **What the user sees:** Fill `AppShell` (`align="center"`) with one top-left arrow (`ProfileChromeLeft`) that returns to the previous in-app view in this tab, or `/welcome` when this tab has none, plus wordmark → `/welcome`. The wordmark is not that control. One **Menu** sits top-right. No in-card back. Heading **Handbook**. Staff (moderator) see TOC **Chapters** and three chapters **21.gifts login** (`#login`), **Verified** (`#verified`), and **Official funding program** (`#funding`). Each chapter heading is a permalink with a copy-link control (`handbook.copyLink`). Non-staff signed-in visitors see the heading plus **This page is for moderators.** and no chapters. No fetch.
- **Actions:** The top-left arrow returns to the previous in-app view in this tab, or `/welcome` when this tab has none. One arrow. The wordmark is not that control (wordmark → `/welcome`). Open a chapter permalink (`#login`, `#verified`, `#funding`) or copy its absolute URL. Open **Menu**. No fetch.
- **Calls:** `AppShell`, `ProfileChromeLeft`, `ModerateHandbookPage`, `ModerateHandbookScreen`, `SignedInChrome`, `OnboardingGate`, `HandbookCopyLink`.
- **Auth:** Bearer session; `OnboardingGate screen="welcome"`. Chapters only when `roleAtLeast(role, 'moderator')`; others see forbidden copy.

### Variant: default

Staff (moderator) handbook with heading **Handbook**, TOC **Chapters**, and chapters **21.gifts login**, **Verified**, **Official funding program**, each with a copy-link control.

![21.gifts moderation handbook](images/moderate-handbook.png)

### Variant: forbidden

Signed-in basis account. Copy **This page is for moderators.** No chapters.

![21.gifts moderation handbook forbidden](images/moderate-handbook-forbidden.png)

## Screen: /messages/[id]

- **Purpose:** Public HTML thread by forum message UUID. Unsigned visitors see a read-only thread. A top-level note with a positive `goalSats` shows `ForumGoalBar` (orange through 100%, green overflow; not on replies). Signed-in (hydrated session and account): same per-note actions as `/welcome` (React on the root note, copy link on the root note and on every reply, Gift on a payable nested reply, expand/replies + reply composer, staff delete, **Edit shop note** on a top-level shop note when the viewer is a moderator, author link when `accountId`). On the signed-in thread only, Heart (lucide Heart, `forum.heart` “Send ₿1”) is icon-only in the card footer after Translate and before React or Gift; it shows on a note or reply that is not deleted, not the viewer's own, and whose author can receive (`payable`), including a signed-out card, and never on the external author profile; a read-only tap does nothing; a payable tap vibrates and shows the filled heart before payment; `+1` appears only after the payment succeeds. A founder or moderator opening a soft-hidden note (root or highlighted reply) sees the note plus `forum.hiddenNotice` (who hid it and when) instead of `view.missing`; React/Gift/Delete/reply composer are omitted on that card. A compose-fee reply invoices 1 sat to 21.gifts on the composer slot (`payHost: composer`, `payMessageId` = compose-target note) even though the top-level composer is hidden; extra gifts and Gift-open stay on the card (`payHost: card`). Still no `OnboardingGate`, no top-level composer, no envelope, no FiatPicker, no feed filters. Auto-expand when signed in. Fill `AppShell` (`align="center"`) via `PublicMessageChrome`. No auth gate to view; chrome depends on hydrated session. Unsigned (no session): `ProfileChromeLeft` with wordmark → `/` and one arrow to the previous in-app view, or `/welcome` when this tab has none, plus light LanguageSwitcher. Hydrated session: `ProfileChromeLeft` (the same arrow; wordmark → `/welcome`) + `SignedInChrome` (Menu with the account header, then **Home** and **Balance**). Amounts are `formatBitcoin` plus optional preferred-fiat `·` `formatFiatDisplay` of the amount stored when the payment was made (a stored string as-is; a null or missing field uses the spot rate). A posted goal bar uses the frozen snapshot when that string exists, otherwise the spot rate. The pay sheet and an unpaid invoice preview still use the spot rate. Signed-in: **Translate** (Languages icon) sits in the footer icon row with react / copy. Unsigned `PublicThreadCard` stacks Translate under the body (no footer row). **Show original** / **Show translation** stay the same Languages icon, with no visible text. Offered when the note language differs from the UI locale. Every pay sheet on this screen (a gift, a paid reaction, or a paid reply) follows the same in-app wallet rule as the forum pay sheet on `/welcome`: it pays from the in-app wallet only (the `sparkInvoice`, otherwise the `pr`); without a usable wallet it shows the unavailable or failed state, never an invoice QR or a link to another wallet app.
- **Inputs:** Dynamic route `id` (UUID). After hydrate: any session loads `GET /forum/messages/:id` (`fetchForumMessage`) and Bearer replies (a hidden note is still 404 for a non-moderator). No session uses `GET /public-messages/:id` and public replies. A `via === 'nostr'` name links to `/messages/[id]/author`; any other unsigned name stays text. A session shows the member link for a 21.gifts author (`accountId` wins over `via`) on the note, a reaction, a quote name (the rest of the quote still opens the note), and the same on hidden notes and the pin list. A signed-in name with no account and `via === 'nostr'` opens `/messages/[id]/author`. The public note video has its own fullscreen button, including a narrow portrait clip. If the opened note has `parentId`, a second GET loads that parent, then its replies. Opening a reply UUID shows the parent post and all live replies; opening a parent UUID shows that post and all live replies. Opening a hidden reply UUID as staff still shows the parent, live replies, AND the opened hidden reply (merged if Bearer replies omit it). Both URLs stay valid (no redirect). Signed-in also auto-expands via Bearer `GET /forum/messages/:id/replies`. Optional photo via `fetchPublicMessagePhoto` or signed-in `fetchMessagePhoto` (via `PublicMessageThread`) → blob URL. Invalid UUID → missing without a fetch. A replies 404 after a successful parent GET is an error, not empty. Server `generateMetadata` loads api `GET /messages/:id` (via `loadPublicMessageForOg`) and sets Open Graph / Twitter tags. Unsigned/non-staff hidden ids stay `view.missing`.
- **Actions:** Change language (unsigned), or open **Menu** (signed-in). The top-left arrow returns to the previous in-app view in this tab, or `/welcome` when this tab has none. One arrow. The wordmark is not that control. Unsigned **Log in** → `/login` (`login.submit`) below the thread. Signed-in visitors have no second back link below the thread, plus the per-note actions above (React on the root note, copy link on the root note and on every reply, Gift on a payable nested reply, expand/replies + reply composer, staff delete, **Edit shop note** on a top-level shop note when the viewer is a moderator, author link when `accountId`). A compose-fee reply invoices 1 sat to 21.gifts on the composer slot (`payHost: composer`); extra gifts stay on the card (`payHost: card`). On fetch error, **Try again**. States reuse `view.missing` / `view.error`+retry / `forum.loading`.

- **Used by:** Route `/messages/[id]` (`PublicMessagePage`). Shared links copied from the forum board.
- **Calls:** `PublicMessagePage`, `PublicMessageChrome`, `PublicMessageLoader`, `PublicThreadCard`, `PublicMessageThread`, `ForumGoalBar`, `forumGoalPercent`, `ForumQuotedBody`, `NoteTranslate`, `LanguageSwitcher`, `WalletPay`, `useWalletPay`, the wallet payment primitive.

### Variant: default

Valid known UUID. Thread may be parent-only when replies are empty. Card with author name, timestamp, text (`Hello from Ada`), sats via `formatBitcoin` plus optional preferred-fiat `·` `formatFiatDisplay` of the amount stored when the payment was made (otherwise the spot rate; no ` · —` when that rate is unusable), optional photo or clip-aspect `<video>`. Auth CTA below the card.

![21.gifts public message](images/messages-id.png)

### Variant: mention-suggest

Signed in. The root note is expanded, the reaction field contains `@`, and the People list is open.

![21.gifts public message mention suggestions](images/messages-id-mention-suggest.png)

### Variant: mention-inserted

Choosing `@ada` from that open list writes `@ada ` into the reaction field and closes the list.

![21.gifts public message mention inserted](images/messages-id-mention-inserted.png)

### Variant: place

Unsigned permalink of Ada's note **Hello from Ada** with a place. The card shows a MapPin link **Happyland** to `/shops?pin=<id>#map`.

![21.gifts public message place](images/messages-id-place.png)

### Variant: place-coords

Unsigned permalink of the same note with no place label. The MapPin link reads **14.60000, 120.98000**.

![21.gifts public message place coordinates](images/messages-id-place-coords.png)

### Variant: goal-110

Unsigned permalink of a top-level Ada note with `sats: 23100` and `goalSats: 21000`. The ask is defined in bitcoin, so `ForumGoalBar` names **Ask ₿21'000 · $21.00** and the note amount is **₿23'100 · $23.10** (viewer USD from the spot rate). Full orange track plus green overflow (10% of track width past the right edge), label **110%**. Auth CTA below the card. No composer Ask.

![21.gifts public message goal 110](images/messages-id-goal-110.png)

### Variant: goal-fiat

Unsigned permalink of an English note defined as **$1.50** with frozen **₿1'000** and label **0%**. No second dollar amount. The note matches the UI language, so the card does not offer Translate. The received amount is **₿0 · $0.00**. No composer Ask.

![21.gifts public message fiat goal](images/messages-id-goal-fiat.png)

### Variant: goal-credit

Unsigned permalink of a top-level Ada note with `sats: 10500`, `goalSats: 21000`, `goalRepayable: true`, and `goalTermDays: 30`. The ask is defined in bitcoin, so the bar shows **Ask ₿21'000 · $21.00**, the note amount **₿10'500 · $10.50**, a **Loan** tag and **To repay per day: ₿700 · $0.70 per day for 30 days.** Label **50%**. No composer Ask.

![21.gifts public message credit goal](images/messages-id-goal-credit.png)

### Variant: loan-tag-open

Same unsigned credit, after **Loan** is pressed. A line under the name says a loan is paid back.

![21.gifts public message loan tag open](images/messages-id-loan-tag-open.png)

### Variant: donation-tag-open

Same unsigned note as **goal-110**, after **Donation** is pressed. A line under the name says a donation is a gift and is not paid back.

![21.gifts public message donation tag open](images/messages-id-donation-tag-open.png)

### Variant: credit-ledger

Unsigned permalink of a filled credit. Under the ask, **Given** lists Bea @bea at ₿20 and Cara @cara at ₿1. **Paid back** shows a chart from 27 Sep 2026 to 28 Sep 2026, bars for each day's amount and a line from the whole debt down to zero, then each share is one bitcoin payment, 27 Sep 2026 UTC with Bea's ₿10 **Due**, and 28 Sep 2026 UTC with Bea's ₿10 and Cara's ₿1 **Scheduled**.

![21.gifts public message credit ledger](images/messages-id-credit-ledger.png)

### Variant: photos

Unsigned permalink. Ada note with `photoCount` 2 and empty text. `ForumPhotoGallery` is a horizontal snap row (`data-scroll-x`, 88% peek) with a `1/2` chip and dots.

![21.gifts public message photos](images/messages-id-photos.png)

### Variant: note-video-paused

Unsigned permalink of Ada's note **A clip**. The picture is a video. The play button and the fullscreen button sit on that picture. The picture is centered.

![21.gifts public message note video paused](images/messages-id-note-video-paused.png)

### Variant: note-video-playing

Same public note after **Play**. The play button is gone. The fullscreen button stays on the picture.

![21.gifts public message note video playing](images/messages-id-note-video-playing.png)

### Variant: signed-in

Hydrated Ada session: one top-left arrow (previous in-app view, or `/welcome` when this tab has none) + wordmark → `/welcome`. The wordmark is not that control. **Menu** top-right (account header, then **Home** and **Balance**). Thread card **Hello from Ada**, React, copy link, and **Write a reaction** (auto-expanded). No heart, because this note's author cannot receive (`payable` false). Posts do not show Gift or an envelope.

![21.gifts public message signed in](images/messages-id-signed-in.png)

### Variant: shop-edit

A moderator session on a top-level shop note **Cafe Luna**. The footer shows **Edit shop note**. The editor is closed.

![21.gifts public message shop edit](images/messages-id-shop-edit.png)

### Variant: shop-edit-open

The same moderator clicked **Edit shop note**. Step **1 / 5 · Photos** is open. **History** says there are no edits yet. The photo step dismisses with an icon-only Close (X). Its accessible name is Cancel. There is no visible Cancel word. The closed pencil does not cover this result.

![21.gifts public message shop edit open](images/messages-id-shop-edit-open.png)

### Variant: shop-edit-place

The same moderator pressed **Next**. Step **2 / 5 · Place** is open. **History** still says there are no edits yet. The photo step's Close (X) is gone. The closed pencil does not cover this result.

![21.gifts public message shop edit place](images/messages-id-shop-edit-place.png)

### Variant: shop-edit-text

**Next** again. Step **3 / 5 · Text** is open. **History** still says there are no edits yet.

![21.gifts public message shop edit text](images/messages-id-shop-edit-text.png)

### Variant: shop-edit-user

**Next** again. Step **4 / 5 · 21.gifts user** is open. The username is empty. **History** still says there are no edits yet.

![21.gifts public message shop edit user](images/messages-id-shop-edit-user.png)

### Variant: shop-edit-summary

**Next** again. Step **5 / 5 · Summary** is open. **Save changes** is the button on the card. **History** still says there are no edits yet.

![21.gifts public message shop edit summary](images/messages-id-shop-edit-summary.png)

### Variant: sunday

Device-local Sunday. **Hello from Ada** stays. **Write a reaction** is gone. **Writing is paused on Sunday.**

![21.gifts public message sunday](images/messages-id-sunday.png)

### Variant: hidden

Hydrated founder or moderator session on a soft-hidden note. Thread shows the original body plus **This note was hidden by {name} on {time}.** React, Gift, delete, and the reply composer are omitted.

![21.gifts public message hidden](images/messages-id-hidden.png)

### Variant: missing

Unknown or malformed id. Copy **This profile could not be found.**

![21.gifts public message missing](images/messages-id-missing.png)

### Variant: loading

Waiting on the public message fetch. Copy **Loading…**

![21.gifts public message loading](images/messages-id-loading.png)

### Variant: error

Public message fetch failed. Copy **Could not load this profile. Please try again.** and **Try again**.

![21.gifts public message error](images/messages-id-error.png)

### Variant: translate

Public German note. Body is the German fixture; **Translate** is visible.

![21.gifts public message translate](images/messages-id-translate.png)

### Variant: translate-loading

After clicking **Translate** while POST `/translate` hangs. The control is busy.

![21.gifts public message translate loading](images/messages-id-translate-loading.png)

### Variant: translate-done

After successful translation: **Show original**; the German original is not shown.

![21.gifts public message translate done](images/messages-id-translate-done.png)

### Variant: translate-hidden

After **Show original**: the Languages icon is named **Show translation** and has no visible text.

![21.gifts public message translate hidden](images/messages-id-translate-hidden.png)

### Variant: translate-error

After POST /translate 502: **Could not translate this note. Please try again.**

![21.gifts public message translate error](images/messages-id-translate-error.png)

### Variant: heart-needs-balance

Same signed-in public thread after stubbing POST /messages/*/invoice to 400 `wallet_required` and clicking Send ₿1. Copy **A Bitcoin balance is required for this.**

![21.gifts public message heart needs balance](images/messages-id-heart-needs-balance.png)

### Variant: heart-paid

Same signed-in public thread after opening `?visual=heart-paid` and clicking Send ₿1. The paid mark **+1** is visible.

![21.gifts public message heart paid](images/messages-id-heart-paid.png)

### Variant: heart-unavailable

Same signed-in public thread after stubbing POST /messages/*/invoice to 503 `HEART_UNAVAILABLE` and clicking Send ₿1. Nothing is sent; the heart stays empty. Copy **Hearts are not available right now.**

![21.gifts public message heart unavailable](images/messages-id-heart-unavailable.png)

### Variant: heart-pending

Same signed-in public thread after opening `?visual=heart-pending` and clicking Send ₿1: the send timed out and its outcome is not known yet. The heart stays filled, no **+1**, and another tap on this note does not pay. Copy **Your last heart is still on its way. Try again in a moment.**

![21.gifts public message heart pending](images/messages-id-heart-pending.png)

### Variant: thread

Parent Ada “Hello from Ada” plus gift reply Pater Severin (empty text, sats 3000) showing `formatBitcoin` (`₿3'000`). Opened on the parent UUID.

![21.gifts public message thread](images/messages-id-thread.png)

### Variant: external-reply

Unsigned permalink card (`PublicThreadCard`). Parent Ada “Hello from Ada” plus two replies from **Robin**, who has no 21.gifts account: a gift-only reply (`₿69`) and a text reply containing `https://example.com/hello`. Each name is a **View profile** control to `/messages/<id>/author`. This shot stays on the thread. **External** stays a non-interactive span next to the name (same slot as a role pill; not a button, no hint). The URL is visible as plain text — not a clickable link, no autolink, no quoted-note embed.

![21.gifts public message external reply](images/messages-id-external-reply.png)

### Variant: quoted-note

Public permalink of Riana Rosello's note. Cyrill's reply shows `just for information:` plus the same nested technical-note post (photo, caption, Founder, ₿43). Raw URL not visible.

![21.gifts public message quoted note](images/messages-id-quoted-note.png)

### Variant: reply

Same thread opened on the reply UUID. Parent + gift; permalink target ring (`data-permalink-target="true"`, `ring-1 ring-app-fg`) on the gift reply.

![21.gifts public message reply](images/messages-id-reply.png)

### Variant: reply-received

Unsigned permalink of Cyrill's reply **You got it right.** The parent **Hello from Ada** shows **₿21'000 · $18.14**. The reply shows **sent ₿21'000 · $18.14** and **received ₿100 · $0.09** on two lines under a left rule. Nothing on the page is **₿21'100**.

![21.gifts public message reply received](images/messages-id-reply-received.png)

## Screen: /messages/[id]/author

- **Purpose:** External author profile card for a forum note whose author has no 21.gifts account. Not a member page and not a dialog. Heading is `profile.title` (**Profile** / **Profil** / **Perfil** / **Profile**), not the person's name. Name section always: heading `name.heading`, truncated name, **External** span (not a button). Optional checked Nostr address (`forum.externalProfileNip05`) when published. Payment address (`forum.externalProfileLud16`) only when it differs ignoring case. Nostr key (`forum.externalProfileNpub`) with the centered secondary IconButton copy control when a profile has loaded; addresses and the key are `break-all`, the name truncates. No photo, pay, outbound link, location, chart, about, message, hint paragraph, or close control. Count buttons appear when both `postCount` and `replyCount` are numbers; the feed is read-only under the card (no pay, no composer, no react); a post opens `/messages/{id}`; a reply opens `/messages/{parentId}`; a shorter list shows `profile.activityLatest`; loading uses `forum.loading`; failure uses `forum.error` and `view.retry`. If either count is absent, no buttons. Loading and a null fetch show the title, the fallback name (or Unnamed), and the External span, and omit the address sections. Body is `ExternalAuthorProfile` inside `PublicMessageChrome`.
- **Inputs:** Dynamic route `id` (forum message id, not validated as a UUID) and optional `name` query (`string` or first array entry, trimmed; blank becomes `''`). Profile from `GET /public-messages/:id/external-profile` (`fetchExternalAuthorProfile`). Posts from `GET /public-messages/:id/external-posts` and replies from `GET /public-messages/:id/external-replies`, no Bearer.
- **Actions:** The top-left arrow is the existing `ProfileChromeLeft` control (previous in-app view, or `/welcome` when this tab has none). Unsigned chrome is wordmark href `/` plus `LanguageSwitcher`. Signed-in chrome is `ProfileChromeLeft` plus `SignedInChrome`. Copy the npub (icon-only **Copy** → **Copied**). Open and close the count buttons; those clicks GET `/public-messages/:id/external-posts` or `/public-messages/:id/external-replies`. No pay, no outbound link, no close control.
- **Used by:** Route `/messages/[id]/author` (`ExternalAuthorPage`). `ForumBoard`, `QuotedForumNote`, and `PublicMessageLoader` name controls.
- **Auth:** None required to view; chrome depends on hydrated session. No `OnboardingGate`. Not a `/members` page.

### Variant: default

Signed-out loaded card. Heading **Profile**, name **Robin**, **External**, **Verified Nostr address** `robin@nostr.example`, **Payment address on their profile** `pay@ln.example`, **Nostr key** `npub1example`, icon-only **Copy**. No photo, pay, outbound link, hint paragraph, or close control. Closed buttons are **1 post** and **1 reaction**; the feed is closed.

![21.gifts external author profile](images/messages-id-author.png)

### Variant: signed-in

Same loaded card with the **Menu** control. Heading **Profile**, **Robin**, **External**, `robin@nostr.example`, `pay@ln.example`, `npub1example`, icon-only **Copy**. Closed buttons are **1 post** and **1 reaction**; the feed is closed.

![21.gifts external author profile signed in](images/messages-id-author-signed-in.png)

### Variant: loading

Title **Profile**, name **Robin**, **External**, and no address yet because the profile request has not returned.

![21.gifts external author profile loading](images/messages-id-author-loading.png)

### Variant: posts-open

Pressed **1 post** button with the note text `Robin wrote a note` under the card. The feed is read-only.

![21.gifts external author posts open](images/messages-id-author-posts-open.png)

### Variant: replies-open

Pressed **1 reaction** button with the note text `Robin wrote a reaction` under the card. The feed is read-only.

![21.gifts external author replies open](images/messages-id-author-replies-open.png)

### Variant: posts-loading

Pressed **1 post**. The feed under the card shows Loading…. No note text yet.

![21.gifts external author posts loading](images/messages-id-author-posts-loading.png)

### Variant: replies-loading

Pressed **1 reaction**. The feed under the card shows Loading…. No note text yet.

![21.gifts external author replies loading](images/messages-id-author-replies-loading.png)

### Variant: posts-error

Pressed **1 post**. The feed shows `Could not load messages. Please try again.` and **Try again**.

![21.gifts external author posts error](images/messages-id-author-posts-error.png)

### Variant: replies-error

Pressed **1 reaction**. The feed shows `Could not load messages. Please try again.` and **Try again**.

![21.gifts external author replies error](images/messages-id-author-replies-error.png)

### Variant: posts-truncated

Pressed **2 posts**. One note, `Robin wrote a note`, and the muted line `Showing the latest 1 of 2.`

![21.gifts external author posts truncated](images/messages-id-author-posts-truncated.png)

### Variant: replies-truncated

Pressed **2 reactions**. One note, `Robin wrote a reaction`, and the muted line `Showing the latest 1 of 2.`

![21.gifts external author replies truncated](images/messages-id-author-replies-truncated.png)

### Variant: copied

Pressed **Copy**. The icon is the check and the accessible name is **Copied**. The key is still `npub1example`.

![21.gifts external author profile copied](images/messages-id-author-copied.png)

### Variant: posts-empty

Pressed **0 posts**. The feed shows `No messages yet — be the first to write one.` The **0 reactions** button stays closed.

![21.gifts external author posts empty](images/messages-id-author-posts-empty.png)

### Variant: replies-empty

Pressed **0 reactions**. The feed shows `No messages yet — be the first to write one.` The **0 posts** button stays closed.

![21.gifts external author replies empty](images/messages-id-author-replies-empty.png)

### Variant: posts-external

Pressed **1 post**, then **External** on that note. The hint is `Wrote from another app, not from a 21.gifts account. Shown here because this person sent bitcoin to a post.`

![21.gifts external author posts external](images/messages-id-author-posts-external.png)

### Variant: replies-external

Pressed **1 reaction**, then **External** on that note. The same hint is open. **1 post** stays closed.

![21.gifts external author replies external](images/messages-id-author-replies-external.png)

### Variant: posts-translate

Pressed **1 post**. The note is German and **Translate** is visible.

![21.gifts external author posts translate](images/messages-id-author-posts-translate.png)

### Variant: posts-translate-loading

Pressed **Translate** while the request hangs. The control is busy.

![21.gifts external author posts translate loading](images/messages-id-author-posts-translate-loading.png)

### Variant: posts-translate-done

After a successful translation. The control is **Show original** and the German original is not shown.

![21.gifts external author posts translate done](images/messages-id-author-posts-translate-done.png)

### Variant: posts-translate-hidden

After **Show original**. The Languages icon is named **Show translation**.

![21.gifts external author posts translate hidden](images/messages-id-author-posts-translate-hidden.png)

### Variant: posts-translate-error

After a failed translation. The feed shows `Could not translate this note. Please try again.`

![21.gifts external author posts translate error](images/messages-id-author-posts-translate-error.png)

### Variant: replies-translate

Pressed **1 reaction**. The note is German and **Translate** is visible. **1 post** stays closed.

![21.gifts external author replies translate](images/messages-id-author-replies-translate.png)

### Variant: replies-translate-loading

Pressed **Translate** on that reaction while the request hangs. The control is busy.

![21.gifts external author replies translate loading](images/messages-id-author-replies-translate-loading.png)

### Variant: replies-translate-done

After a successful translation of that reaction. The control is **Show original**.

![21.gifts external author replies translate done](images/messages-id-author-replies-translate-done.png)

### Variant: replies-translate-hidden

After **Show original** on that reaction. The Languages icon is named **Show translation**.

![21.gifts external author replies translate hidden](images/messages-id-author-replies-translate-hidden.png)

### Variant: replies-translate-error

After a failed translation of that reaction. The feed shows `Could not translate this note. Please try again.`

![21.gifts external author replies translate error](images/messages-id-author-replies-translate-error.png)

## Screen: /view/[viewKey]

- **Purpose:** Public read-only copy of the signed-in profile card (heading Profile, AccountActivityChart Given/Received with FiatPicker only while `useHydrateSession().ready && session === null`, CHF|EUR|USD|PHP, `shell="app"`; unsigned empty = picker + `profile.chartEmpty` with no SVG / no ₿|fiat scale; signed-in empty = `profile.chartEmpty` alone; a failed activity load is `profile.chartError`; populated ₿ | selected fiat; About me inside the identity card — not a forum post; Languages **Translate** when `aboutMessageId` is set; with the photo when `aboutMeHasPhoto` — name + location + public `username@21.gifts` (`view.noGiftsAddress` when unset)) without edit/Message/back/menu/logout. Copy-profile-link on the card. Capability URL `/view/<64-hex>`; key/URL not shown as visible text. No `OnboardingGate` on this route. When a username is set, a centered `QrCode` (label `profile.giftsQr`) under the address encodes `openCryptoPayQrValue` (`https://<domain>/pl/?lightning=` plus the uppercase LNURL of `https://<domain>/.well-known/lnurlp/<local>`), including on a smartphone. A missing username shows no QR.
- **Inputs:** Dynamic route `viewKey` (must be 64 lowercase hex). Profile from same-origin `GET /view-key/:viewKey` (`fetchViewProfile`); Given + Received from `GET /view-key/:viewKey/activity` (`fetchViewActivity`). Fetch even when the profile has no wallet yet; activity failure keeps the card and the chart shows `profile.chartError`. Identity still `GET /view-key/:viewKey`.
- **Actions:** The top-left arrow returns to the previous in-app view, or `/welcome` when this tab has none. Change language (`HomeWordmark` beside that arrow: `/` when unsigned, `/welcome` when a session is hydrated; light language switcher top-right). Copy the profile link on the card (`profile.copyLink` **Copy link to this profile** → the current view URL). On profile fetch error, **Try again**. Unsigned empty series shows FiatPicker + `profile.chartEmpty`; signed-in empty is `profile.chartEmpty` alone. A failed activity load is `profile.chartError`. A filled series can switch scale between ₿ and the selected fiat. When unsigned, pick CHF|EUR|USD|PHP on the chart FiatPicker. When the card is ready and `hasPasskey` is false in a real browser: yellow banner under the card via `ViewProfileClaim` with **Action required, the account must be activated** and **Activate** — including when another 21.gifts account is already signed in. **Activate** clears that session (if any) then starts `register(viewKey)`. In Telegram or another in-app browser, the shared escape card (**Open this page in your browser**, **Open in browser**, **Copy link**) appears on mount instead of the banner. Hidden when the profile already has a passkey. After a successful claim → `/setup/rules`. No edit/Message/back/menu/logout on the card. After **Log in instead** on an already-claimed profile, a spinner shows while that login runs, and a failed or unknown attempt keeps the claim alert and **Try again**, also over a held-back session. Once the login succeeds it opens the wallet: the shared login card (`WalletLoginCard`) stands in place until it is open, and stays with its no-PRF or error alert while that session is held back.
- **Used by:** Route `/view/[viewKey]` (`ViewProfilePage`).

### Variant: default

Valid known key. Heading **Profile**, FiatPicker only while unsigned; empty series shows FiatPicker + `profile.chartEmpty` when unsigned (**No gifts yet.**, no legend/SVG / no ₿|fiat scale; never **Loading…** on the chart) and `profile.chartEmpty` alone when signed in (a failed activity load is `profile.chartError`), About me inside the card when `aboutMe` is a string (not a forum post), icon-only **Copy link to this profile**, name, location, and 21.gifts address, yellow **Action required, the account must be activated** / **Activate** banner under the card when unclaimed (even if signed in), no visible view-key URL/text. The card has no back control; the page header has the one top-left arrow.

![21.gifts public view profile](images/view-viewKey.png)

### Variant: about-filled

Valid known key with a filled About me (`aboutMe` is a real bio, not a name-copy). Same read-only card as default plus the About me heading and body text. Copy-profile-link remains. No edit.

![21.gifts public view about filled](images/view-about-filled.png)

### Variant: translate

Public `/view/:viewKey` with a German About me and a non-empty `aboutMessageId`. **Translate** is visible under the About me body.

![21.gifts public view about translate](images/view-about-translate.png)

### Variant: translate-loading

Same German About me after clicking **Translate** while POST `/translate` hangs. The control is busy (`aria-busy`) with a spinner.

![21.gifts public view about translate loading](images/view-about-translate-loading.png)

### Variant: translate-done

Same German About me after a successful translation. Translated body plus **Show original**; the German original is not shown.

![21.gifts public view about translate done](images/view-about-translate-done.png)

### Variant: translate-hidden

After **Show original**: translated body hidden, the Languages icon is named **Show translation** and has no visible text.

![21.gifts public view about translate hidden](images/view-about-translate-hidden.png)

### Variant: translate-error

Same German About me after POST /translate fails. Alert **Could not translate this note. Please try again.** and the Translate control remains.

![21.gifts public view about translate error](images/view-about-translate-error.png)

### Variant: about-photo

Valid known key with About me text and photo (`aboutMe: 'I build on Bitcoin'`, `aboutMeHasPhoto: true`). Same read-only card as default plus the About me heading, bio, and photo (`About me photo`, the whole picture, `object-contain`, `max-h-80`, not a cover crop). Copy-profile-link remains. No edit.

![21.gifts public view about photo](images/view-about-photo.png)

### Variant: missing

Unknown or malformed key. Copy **This profile could not be found.**

![21.gifts public view missing](images/view-missing.png)

### Variant: loading

Waiting on the profile fetch. Copy **Loading…**

![21.gifts public view loading](images/view-loading.png)

### Variant: error

Profile fetch failed. Copy **Could not load this profile. Please try again.** and **Try again**.

![21.gifts public view error](images/view-error.png)

### Variant: claimed

Valid known key whose profile already has a passkey (`hasPasskey: true`). Same read-only card as default, no yellow activation banner, no **Activate** button.

![21.gifts public view claimed](images/view-claimed.png)

### Variant: claim-prf-unsupported

Unclaimed profile after **Activate** on a phone or browser whose new passkey gives no PRF output. Under the card, the alert **This phone or browser cannot hold a 21.gifts wallet. Please use an up-to-date phone or browser that supports passkeys.** (`wallet.prfUnsupported`) instead of **Could not set up a passkey. Please try again.**, then **Try again**. The profile stays unclaimed. On iOS below 18 the old-iOS sentence takes precedence, so the phone pictures of this variant use an iPhone on iOS 18.

![21.gifts public view claim prf unsupported](images/view-claim-prf-unsupported.png)

### Variant: in-app

Telegram or another in-app WebView detected on an unclaimed profile. Escape card under the profile (**Open this page in your browser**, **Open in browser**, **Copy link**); no yellow **Activate** banner.

![21.gifts public view in-app](images/view-in-app.png)

## Screen: /handbook

- **URL:** `/handbook` — public app handbook hub (no auth gate). Header **Handbook** stays here.
- **What the user sees:** Localized heading **Handbook** and intro chrome, one top-left arrow (previous in-app view, or `/welcome` when this tab has none) beside the wordmark in the marketing header (wordmark `/` when unsigned, `/welcome` when a session is hydrated; the wordmark is not that arrow) and a language switcher, intro with a link to the api handbook on GitHub (`21gifts/api`), nav links to **Screens**, **Functions**, and **Endpoints**, plus a short lead for each part. Does not dump those three markdown files. After tapping the link icon on the Handbook heading, that button shows the check icon and `data-copied`.
- **Actions:** Change language, open a part, copy the hub heading URL, follow the api handbook link.
- **Calls:** `HandbookPage`, `HandbookIntro`, `HandbookCopyLink`, `LanguageSwitcher`.
- **Screenshots:** none. Documentation page, not a product screen.

## Screen: /handbook/screens

- **URL:** `/handbook/screens` — public screens handbook (no auth gate).
- **What the user sees:** Heading **Screens**, a three-level table of contents (chapter = first path segment, screen, variant), and nested compact cards (`HandbookFigure` via `HandbookImageViewer`) under global **Desktop** / **Mobile** and **Light** / **Dark** switches. Switches appear only when those baselines exist somewhere in the catalog. Each card has a ~220px preview, a written description of what the picture shows, a permalink label, and a copy-link. Clicking the preview opens the same PNG at full size in `HandbookLightbox` (close via X, backdrop, or Escape). The lightbox chevron shows the previous image (`handbook.previousImage`, “Previous screen”) and is not the page-back arrow. Topics that lack the selected combo are omitted. No topic picker. Marketing header has one top-left arrow (previous in-app view, or `/welcome` when this tab has none) beside the wordmark (`/` when unsigned, `/welcome` when a session is hydrated; the wordmark is not that arrow).
- **Actions:** Jump via the contents nav, switch viewport/theme when available (applies to every card), open a preview at full size, step through every visible variant with Left/Right arrows or lightbox chevrons, copy a chapter/screen/card deep link, follow a hash deep link, return to the hub.
- **Calls:** `HandbookScreensPage`, `HandbookImageViewer`, `HandbookOutline`, `HandbookSectionHeading`, `HandbookFigure`, `HandbookLightbox`, `HandbookIntro`, `HandbookCopyLink`, `buildHandbookOutline`, `nextOutlineIndex`, `topicAnchor`, `parseScreenVariantDescriptions`, `screenVariantDescription`, `loadHandbookDocuments`.
- **Screenshots:** none. This page _shows_ product-screen goldens; it is not itself a golden.

## Screen: /handbook/functions

- **URL:** `/handbook/functions` — public functions handbook (no auth gate).
- **What the user sees:** Heading **Functions** and the functions markdown (`## Function: name`) only. No image switches. Marketing header has one top-left arrow (previous in-app view, or `/welcome` when this tab has none) beside the wordmark (`/` when unsigned, `/welcome` when a session is hydrated; the wordmark is not that arrow).
- **Actions:** Read the markdown, return to the hub.
- **Calls:** `HandbookFunctionsPage`, `HandbookMarkdown`, `loadHandbookDocuments`.
- **Screenshots:** none.

## Screen: /handbook/endpoints

- **URL:** `/handbook/endpoints` — public endpoints handbook (no auth gate).
- **What the user sees:** Heading **Endpoints** and the endpoints markdown only. No image switches. Marketing header has one top-left arrow (previous in-app view, or `/welcome` when this tab has none) beside the wordmark (`/` when unsigned, `/welcome` when a session is hydrated; the wordmark is not that arrow).
- **Actions:** Read the markdown, return to the hub.
- **Calls:** `HandbookEndpointsPage`, `HandbookMarkdown`, `loadHandbookDocuments`.
- **Screenshots:** none.

## Screen: /404

- **URL:** any unknown path (App Router `not-found.tsx`). There is no `page.tsx` for `/404`; Playwright uses `page.goto('/404')` which hits this screen.
- **What the user sees:** Marketing chrome with one top-left arrow (previous in-app view, or `/welcome` when this tab has none) beside the wordmark (`/` when unsigned, `/welcome` when a session is hydrated) and a language switcher, heading **404**, **This page does not exist.** There is no second back button.
- **Actions:** Change language, go home, or use header/footer links.
- **Calls:** `NotFound`, `MarketingHeader`, `MarketingFooter`, `LanguageSwitcher`.

### Variant: default

The only state.

![21.gifts not found](images/not-found.png)
