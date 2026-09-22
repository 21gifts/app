import Image from 'next/image';
import type { ReactElement } from 'react';
import type { Locale } from '@/lib/locale';
import { getHappylandContent } from '@/lib/happyland';

export function HappylandSection({ locale }: { locale: Locale }): ReactElement {
  const content = getHappylandContent(locale);
  const stories = content.stories.filter(
    (story) => story.published !== false && story.title && story.body,
  );

  return (
    <section
      id="happyland"
      aria-labelledby="happyland-title"
      className="border-y border-paper/10 bg-paper/[0.035] px-5 py-20 sm:py-28"
    >
      <div className="mx-auto max-w-[1100px]">
        <p className="text-sm font-medium tracking-widest text-accent uppercase">
          {content.kicker}
        </p>
        <h2
          id="happyland-title"
          className="mt-4 max-w-3xl text-3xl leading-tight font-semibold tracking-tight sm:text-5xl"
        >
          {content.title}
        </h2>
        <p className="mt-6 max-w-3xl text-lg leading-relaxed text-paper/70">{content.intro}</p>

        <figure className="mt-12">
          <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl border border-paper/10 bg-gradient-to-br from-paper/10 via-paper/5 to-accent/10 sm:aspect-[21/9]">
            {content.heroSrc ? (
              <Image
                src={content.heroSrc}
                alt={content.heroAlt || content.title}
                fill
                sizes="(min-width: 1100px) 1100px, 100vw"
                className="object-cover"
              />
            ) : (
              <span className="text-sm font-medium tracking-widest text-paper/40 uppercase">
                {content.photoLabel}
              </span>
            )}
          </div>
          <figcaption className="mt-3 text-sm text-paper/50">{content.heroCaption}</figcaption>
        </figure>

        <div className="mt-16 space-y-16 sm:mt-24 sm:space-y-24">
          {stories.map((story, index) => (
            <article key={story.title} className="grid items-center gap-8 md:grid-cols-2 md:gap-14">
              <figure className={index % 2 === 1 ? 'md:order-2' : undefined}>
                <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl border border-paper/10 bg-gradient-to-br from-paper/10 via-paper/5 to-accent/10">
                  {story.imageSrc ? (
                    <Image
                      src={story.imageSrc}
                      alt={story.imageAlt || story.title}
                      fill
                      sizes="(min-width: 768px) 520px, 100vw"
                      className="object-cover"
                    />
                  ) : (
                    <span className="text-sm font-medium tracking-widest text-paper/40 uppercase">
                      {content.photoLabel}
                    </span>
                  )}
                </div>
                <figcaption className="mt-3 text-sm text-paper/50">{story.caption}</figcaption>
              </figure>
              <div>
                <span className="text-sm font-medium text-accent">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-3 text-2xl font-semibold sm:text-3xl">{story.title}</h3>
                <p className="mt-5 max-w-prose leading-relaxed text-paper/70">{story.body}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
