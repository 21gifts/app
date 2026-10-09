# Search visibility: 21.gifts

## Product facts to keep consistent

People write a reaction with an amount under a post in the living room, and the Bitcoin goes to the post author's own wallet address. A visitor must sign in to read the living room. 21.gifts does not hold these donations or take a share; wallet or network fees may still apply. The Happyland story does not establish that anyone pictured receives a donation through the site.

## Local changes

- Home, About, Donate, and Rules have a stable URL per language, with a canonical and reciprocal hreflang links. Title, description, and the social preview are the same English sentences on every language URL (CONTRIBUTING, i18n catalogs). Stats, Legal, and Handbook have distinct English previews. The original unprefixed URLs still work and point canonically to the negotiated language URL. The `locale` cookie is set when the browser opens a language URL as a page, so login, stats, handbook, and legal continue in that language; prefetches and in-app navigations do not set it.
- The sitemap lists all sixteen canonical language pages plus the English-only `/stats`, `/legal`, and `/handbook` pages. Each localized entry includes reciprocal `hreflang` links and an `x-default` link to the corresponding legacy URL. Login and the signed-in welcome page are `noindex`.
- One English 1200×630 preview is used on every URL. It shows the wallet-to-wallet path and says only that 21.gifts takes no share. The earlier “No fees” claim was too broad.
- The eight visible FAQ answers are already rendered in the HTML. They give direct answers on account access, fees, the recipient, and how Bitcoin is used. We did not add FAQ rich-result markup: Google restricts that presentation mainly to authoritative government and health sites.

## Search and advertising follow-up

The four public language URLs now have reciprocal `hreflang` links and sitemap entries. Search Console data is still needed to prioritize queries, markets, pages, and measured outcomes; this local build does not prove indexing or ranking.

The localized `/{locale}/donate` page is the public donation entry for paid search: it explains that sign-in and a reaction with an amount under a post precede a payment. No advertising campaign, tracking tag, or budget is configured here. Before any Google Ads launch, choose a target country and check whether the Bitcoin-related ad and advertiser certification rules apply. The current legal page says the site does not run advertising or track visitors; that statement must remain true until the operating practice changes.

Google's AI search guidance calls for indexable, useful text and consistency between visible content and structured data. It does not require an AI-specific schema or `llms.txt`. The existing Organization and WebSite structured data remains; answers are written for visitors first.

## References

- [Google Search: AI features and your website](https://developers.google.com/search/docs/appearance/ai-features)
- [Google Search: Managing multilingual sites](https://developers.google.com/search/docs/advanced/crawling/managing-multi-regional-sites)
- [Google Search: FAQ rich result change](https://developers.google.com/search/blog/2023/08/howto-faq-changes)
- [Google Ads: Landing page](https://support.google.com/google-ads/answer/14086)
- [Google Ads: Cryptocurrencies and related products](https://support.google.com/adspolicy/answer/14009787)
