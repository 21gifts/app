import type { ReactElement } from 'react';
import Image from 'next/image';
import type { happylandPhotos } from '@/lib/happyland';
import type { Messages } from '@/lib/messages';

/**
 * Render a complete photograph with localized alternative text and caption.
 * @param props - Approved asset, active catalog and optional layout classes.
 * @returns A figure that preserves the photograph's original proportions.
 */
export function HappylandPhoto({
  photo,
  messages,
  className,
}: {
  photo: (typeof happylandPhotos)[number];
  messages: Messages;
  className?: string;
}): ReactElement {
  return (
    <figure className={className}>
      <Image
        loading="eager"
        unoptimized
        src={photo.src}
        alt={messages[photo.altKey]}
        width={photo.width}
        height={photo.height}
        sizes="(min-width: 1100px) 700px, (min-width: 768px) 50vw, 100vw"
        className="h-auto w-full rounded-xl"
      />
      <figcaption className="mt-3 text-sm leading-relaxed text-paper/65">
        {messages[photo.captionKey]}
      </figcaption>
    </figure>
  );
}
