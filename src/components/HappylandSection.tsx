import type { ReactElement } from 'react';
import type { Locale } from '@/lib/locale';
import { getCatalog } from '@/lib/messages';
import { happylandPhotos } from '@/lib/happyland';
import { HappylandPhoto } from './HappylandPhoto';

/**
 * Present Father Severin's Happyland photo essay in the visitor's language.
 * @param props - The locale selected for the marketing page.
 * @returns The accessible Happyland section with eight captioned photographs.
 */
export function HappylandSection({ locale }: { locale: Locale }): ReactElement {
  const messages = getCatalog(locale);
  return (
    <section
      id="happyland"
      aria-labelledby="happyland-title"
      className="scroll-mt-24 border-y border-paper/10 bg-paper/[0.035] px-5 py-20 sm:py-28"
    >
      <div className="mx-auto max-w-[1100px]">
        <p className="text-sm font-medium tracking-widest text-accent uppercase">
          {messages['happyland.kicker']}
        </p>
        <div className="mt-4 grid gap-6 md:grid-cols-[1.3fr_1fr] md:items-end md:gap-16">
          <h2
            id="happyland-title"
            className="text-3xl leading-tight font-semibold tracking-tight sm:text-5xl"
          >
            {messages['happyland.title']}
          </h2>
          <p className="text-lg leading-relaxed text-paper/75">{messages['happyland.intro']}</p>
        </div>
        <HappylandPhoto
          photo={happylandPhotos[0]}
          messages={messages}
          className="mx-auto mt-12 max-w-[900px]"
        />
        <article className="mt-20 grid items-center gap-8 md:grid-cols-[1.15fr_1fr] md:gap-16">
          <HappylandPhoto photo={happylandPhotos[1]} messages={messages} />
          <div>
            <p className="text-sm tracking-widest text-accent">01</p>
            <h3 className="mt-3 text-2xl font-semibold sm:text-3xl">
              {messages['happyland.dailyTitle']}
            </h3>
            <p className="mt-5 leading-relaxed text-paper/75">{messages['happyland.daily']}</p>
            <p className="mt-5 leading-relaxed text-paper/75">
              {messages['happyland.observation']}
            </p>
          </div>
        </article>
        <div className="mt-12 grid items-start gap-8 md:grid-cols-[0.85fr_1.15fr]">
          <HappylandPhoto photo={happylandPhotos[2]} messages={messages} className="md:pt-16" />
          <div className="space-y-8">
            <HappylandPhoto photo={happylandPhotos[3]} messages={messages} />
            <HappylandPhoto photo={happylandPhotos[4]} messages={messages} />
          </div>
        </div>
        <article className="mt-20">
          <div className="grid gap-6 md:grid-cols-[0.7fr_1.3fr] md:gap-16">
            <div>
              <p className="text-sm tracking-widest text-accent">02</p>
              <h3 className="mt-3 text-2xl font-semibold sm:text-3xl">
                {messages['happyland.povertyTitle']}
              </h3>
            </div>
            <div className="space-y-4 leading-relaxed text-paper/75">
              <p>{messages['happyland.poverty']}</p>
              <p>{messages['happyland.lanes']}</p>
            </div>
          </div>
          <div className="mt-10 grid items-start gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <HappylandPhoto photo={happylandPhotos[5]} messages={messages} />
            <HappylandPhoto photo={happylandPhotos[6]} messages={messages} className="lg:pt-12" />
            <HappylandPhoto
              photo={happylandPhotos[7]}
              messages={messages}
              className="sm:col-span-2 sm:mx-auto sm:w-1/2 lg:col-span-1 lg:w-full"
            />
          </div>
        </article>
      </div>
    </section>
  );
}
