import type { ReactElement } from 'react';
import Image from 'next/image';
import { happylandEssay as essay } from '@/lib/happyland-essay';

function Photo({
  index,
  className = '',
}: {
  index: number;
  className?: string;
}): ReactElement | null {
  const photo = essay.photos[index];
  if (!photo) return null;
  return (
    <figure className={className}>
      <Image
        loading="eager"
        unoptimized
        src={photo.src}
        alt={photo.alt}
        width={photo.width}
        height={photo.height}
        sizes="(min-width: 1100px) 700px, (min-width: 768px) 50vw, 100vw"
        className="h-auto w-full rounded-xl"
      />
      <figcaption className="mt-3 text-sm leading-relaxed text-paper/65">
        {photo.caption}
      </figcaption>
    </figure>
  );
}

/** English photo essay based on Father Severin's edited Word document. */
export function HappylandPhotoEssay(): ReactElement {
  return (
    <section
      id="happyland"
      aria-labelledby="happyland-title"
      className="border-y border-paper/10 bg-paper/[0.035] px-5 py-20 sm:py-28"
    >
      <div className="mx-auto max-w-[1100px]">
        <p className="text-sm font-medium tracking-widest text-accent uppercase">Tondo · Manila</p>
        <div className="mt-4 grid gap-6 md:grid-cols-[1.3fr_1fr] md:items-end md:gap-16">
          <h2
            id="happyland-title"
            className="text-3xl leading-tight font-semibold tracking-tight sm:text-5xl"
          >
            {essay.title}
          </h2>
          <p className="text-lg leading-relaxed text-paper/75">{essay.intro}</p>
        </div>
        <Photo index={0} className="mx-auto mt-12 max-w-[900px]" />
        <article className="mt-20 grid items-center gap-8 md:grid-cols-[1.15fr_1fr] md:gap-16">
          <Photo index={1} />
          <div>
            <p className="text-sm tracking-widest text-accent">01</p>
            <h3 className="mt-3 text-2xl font-semibold sm:text-3xl">
              Daily life, waste and recycling
            </h3>
            <p className="mt-5 leading-relaxed text-paper/75">{essay.daily}</p>
            <p className="mt-5 leading-relaxed text-paper/75">{essay.observation}</p>
          </div>
        </article>
        <div className="mt-12 grid items-start gap-8 md:grid-cols-[0.85fr_1.15fr]">
          <Photo index={2} className="md:pt-16" />
          <div className="space-y-8">
            <Photo index={3} />
            <Photo index={4} />
          </div>
        </div>
        <article className="mt-20">
          <div className="grid gap-6 md:grid-cols-[0.7fr_1.3fr] md:gap-16">
            <div>
              <p className="text-sm tracking-widest text-accent">02</p>
              <h3 className="mt-3 text-2xl font-semibold sm:text-3xl">Living with poverty</h3>
            </div>
            <div className="space-y-4 leading-relaxed text-paper/75">
              <p>{essay.poverty}</p>
              <p>{essay.lanes}</p>
            </div>
          </div>
          <div className="mt-10 grid items-start gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <Photo index={5} />
            <Photo index={6} className="lg:pt-12" />
            <Photo
              index={7}
              className="sm:col-span-2 sm:mx-auto sm:w-1/2 lg:col-span-1 lg:w-full"
            />
          </div>
        </article>
      </div>
    </section>
  );
}
