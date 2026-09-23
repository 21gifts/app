# Happyland section on the homepage

The photo essay follows “How it works” at `/#happyland`. It is based on Father Severin's edited Word document. The English editorial document is included at [Happyland_English.docx](happyland/Happyland_English.docx).

All visitor copy is maintained under `happyland.*` in `src/lib/messages.ts`, with complete English, German, Spanish and Filipino catalogs. Image sources and intrinsic dimensions live in `src/lib/happyland.ts`; the eight approved WebP assets live in `public/happyland/`. `HappylandSection` composes the essay and `HappylandPhoto` renders each semantic figure with localized alternative text and a visible caption.

To edit the essay, update the corresponding message keys in all four languages. For a replacement photo, update its asset, dimensions, alternative text and caption together. Keep captions specific to the actual photograph. The food-stall caption is **Pagpag** in all languages, as requested by Father Severin. Keep the eyewitness account attributed to him; this essay does not assert a partnership or a particular donation outcome.

The layout preserves the complete photographs, combining a lead image, a split text/image section, an asymmetric group and three portraits. It stacks on narrow screens. Photos are precompressed WebP files served directly and loaded eagerly so they also appear reliably in the embedded preview.

Changes follow the normal reviewed pull request process, including catalog, unit, behavioral and Linux visual checks. Review new Linux CI screenshots before updating the four desktop/mobile and light/dark baseline sets. Do not commit locally generated screenshots or generated handbook image copies.
