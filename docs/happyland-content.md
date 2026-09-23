# Happyland section on the homepage

The section appears immediately after “How it works”. Its editorial content is in [`src/lib/happyland.ts`](../src/lib/happyland.ts), with separate entries for English, German, Spanish, and Filipino. There is no CMS for marketing pages; edits go through the normal reviewed GitHub pull request process.

To edit it:

1. Change `title`, `intro`, the story `title` and `body`, or the `caption` values for each language in `src/lib/happyland.ts`.
2. Add approved JPEG, PNG, or WebP photos in `public/happyland/`. Set `heroSrc` or a story's `imageSrc` to `/happyland/filename.webp`. Set `heroAlt` or `imageAlt` to a concise description of what the photo shows. Without a source, a neutral placeholder is shown.
3. Captions must describe the actual image after upload. Use photos only with the necessary rights and consent, especially for children.
4. The two stories about the local connection and donation impact are prepared but have `published: false` and empty bodies. Verify the partner, the role of 21.gifts, and the actual use of donations before writing these fields and switching each to `published: true`. Incomplete stories remain hidden.

Background for the published general text: [Save the Children Philippines](https://www.savethechildren.org.ph/our-work/our-stories/story/watch-when-its-hard-for-preschoolers-to-go-to-school/) and [OdoVita](https://www.odovita.org/about). These sources do not establish a 21.gifts partnership or a particular donation outcome.

## English photo essay

The English version now uses `src/lib/happyland-essay.ts` and `HappylandPhotoEssay.tsx`, based on Father Severin's edited Word document. Edit the English paragraphs and the eight photo entries there; each entry has a caption, alternative text and original dimensions. The layout preserves full image proportions, combining a lead image, a split text/image section, an asymmetric group and three portraits. German, Spanish and Filipino retain their earlier content until separately translated. Unfilled partnership and donation sections remain absent from the English presentation.

The English editorial Word document is included at [Happyland_English.docx](happyland/Happyland_English.docx). The food-stall caption is “Pagpag”, as requested by Father Severin. All eight photographs load directly to avoid delayed loading failures in the preview.
