import Image from 'next/image';
import type { ReactElement } from 'react';
import type { Locale } from '@/lib/locale';
import { getCatalog } from '@/lib/messages';

/**
 * Present the sourced Happyland account with photographs from the original site.
 * @param props - The locale selected for the marketing page.
 * @returns A place portrait, four photographs and three observations.
 */
export function HappylandSection({ locale }: { locale: Locale }): ReactElement {
  const messages = getCatalog(locale);
  const notes = [
    { number: '01', title: messages['happyland.dailyTitle'], body: messages['happyland.daily'] },
    {
      number: '02',
      title: messages['happyland.povertyTitle'],
      body: messages['happyland.poverty'],
    },
    { number: '03', title: messages['happyland.lanesTitle'], body: messages['happyland.lanes'] },
  ];
  const peoplePhotos = [
    {
      src: '/happyland/main-street.webp',
      alt: messages['happyland.streetAlt'],
      caption: messages['happyland.streetCaption'],
      position: 'object-center',
    },
    {
      src: '/happyland/home.webp',
      alt: messages['happyland.homeAlt'],
      caption: messages['happyland.homeCaption'],
      position: 'object-top',
    },
    {
      src: '/happyland/household.webp',
      alt: messages['happyland.householdAlt'],
      caption: messages['happyland.householdCaption'],
      position: 'object-top',
    },
  ] as const;

  return (
    <section
      id="happyland"
      aria-labelledby="happyland-title"
      className="scroll-mt-20 border-y border-paper/10 bg-[#151316] px-5 py-20 sm:py-24"
    >
      <div className="mx-auto max-w-[1100px]">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_0.9fr] lg:gap-20">
          <div>
            <p className="text-xs font-bold tracking-[0.2em] text-accent uppercase">
              {messages['happyland.kicker']}
            </p>
            <h2
              id="happyland-title"
              className="mt-5 max-w-2xl text-4xl leading-[1.08] font-semibold tracking-tight sm:text-6xl"
            >
              {messages['happyland.title']}
            </h2>
            <p className="mt-7 max-w-xl text-base leading-relaxed text-paper/75 sm:text-lg">
              {messages['happyland.intro']}
            </p>
          </div>
          <figure className="overflow-hidden rounded-[1.75rem] border border-paper/15 bg-[#241d19]">
            <Image
              src="/happyland/food-stall.webp"
              alt={messages['happyland.photoAlt']}
              loading="eager"
              width={1024}
              height={768}
              sizes="(min-width: 1024px) 500px, 100vw"
              className="block aspect-[4/3] w-full object-cover"
            />
            <figcaption className="px-5 py-4 text-sm leading-relaxed text-paper/75 sm:px-7">
              {messages['happyland.photoCaption']}
            </figcaption>
          </figure>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {peoplePhotos.map((photo) => (
            <figure
              key={photo.src}
              className="overflow-hidden rounded-2xl border border-paper/12 bg-paper/5"
            >
              <Image
                src={photo.src}
                alt={photo.alt}
                loading="eager"
                width={1024}
                height={768}
                sizes="(min-width: 768px) 33vw, 100vw"
                className={`block aspect-[4/3] w-full object-cover ${photo.position}`}
              />
              <figcaption className="px-5 py-4 text-sm leading-relaxed text-paper/70">
                {photo.caption}
              </figcaption>
            </figure>
          ))}
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {notes.map((note) => (
            <article
              key={note.number}
              className="rounded-2xl border border-paper/12 bg-paper/5 p-6 sm:p-7"
            >
              <span className="text-xs font-semibold tracking-[0.15em] text-accent">
                {note.number}
              </span>
              <h3 className="mt-5 text-xl font-semibold tracking-tight">{note.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-paper/70 sm:text-base">{note.body}</p>
            </article>
          ))}
        </div>
        <p className="mt-7 text-sm text-paper/50">{messages['happyland.source']}</p>
      </div>
    </section>
  );
}
