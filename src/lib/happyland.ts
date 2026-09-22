import type { Locale } from '@/lib/locale';

/** Editorial content for the Happyland landing section. Add approved photos to
 * public/happyland and set imageSrc to their /happyland/... path. Empty imageSrc
 * renders the neutral photo placeholder. Keep unpublished claims hidden until
 * the local partner and use of donations have been verified. */
type Story = {
  title: string;
  body: string;
  caption: string;
  imageSrc?: string;
  imageAlt?: string;
  published?: boolean;
};
type Content = {
  kicker: string;
  title: string;
  intro: string;
  photoLabel: string;
  heroCaption: string;
  heroSrc?: string;
  heroAlt?: string;
  stories: Story[];
};

const content: Record<Locale, Content> = {
  de: {
    kicker: 'Ein Ort, viele Geschichten',
    title: 'Happyland – ein Einblick in das Leben in Manila',
    intro:
      'Happyland liegt in Tondo, Manila. Hier gestalten Familien ihren Alltag unter schwierigen Bedingungen. Wir möchten den Menschen und ihrem Umfeld mit Respekt begegnen und genauer hinschauen.',
    photoLabel: 'Foto folgt',
    heroCaption: 'Ein Blick auf Happyland – Foto und Bildunterschrift können hier ergänzt werden.',
    stories: [
      {
        title: 'Alltag und Recycling',
        body: 'Für manche Familien ist das Sammeln und Sortieren wiederverwertbarer Materialien eine Einnahmequelle. Abfälle im Wohnumfeld machen den Alltag zugleich schwerer.',
        caption: 'Einblick in den Alltag – Foto und konkrete Bildunterschrift folgen.',
      },
      {
        title: 'Aufwachsen und Lernen',
        body: 'Kinder wachsen mitten in diesem Umfeld auf. Der Weg zu früher Bildung und regelmäßigem Lernen kann für Familien eine Herausforderung sein.',
        caption: 'Aufwachsen in Tondo – Foto und konkrete Bildunterschrift folgen.',
      },
      { title: '21.gifts vor Ort', body: '', caption: '', published: false },
      { title: 'Was deine Spende bewirkt', body: '', caption: '', published: false },
    ],
  },
  en: {
    kicker: 'A place, many stories',
    title: 'Happyland – a glimpse of life in Manila',
    intro:
      'Happyland is in Tondo, Manila. Families shape their daily lives here under difficult conditions. We want to look more closely and portray the people and their surroundings with respect.',
    photoLabel: 'Photo coming soon',
    heroCaption: 'A view of Happyland – add a photo and a specific caption here.',
    stories: [
      {
        title: 'Daily life and recycling',
        body: 'For some families, collecting and sorting recyclable materials provides income. Waste in the surrounding area also makes daily life harder.',
        caption: 'Daily life – add a photo and a specific caption here.',
      },
      {
        title: 'Growing up and learning',
        body: 'Children grow up in this environment. Access to early education and regular learning can be challenging for families.',
        caption: 'Growing up in Tondo – add a photo and a specific caption here.',
      },
      { title: '21.gifts on the ground', body: '', caption: '', published: false },
      { title: 'What your gift makes possible', body: '', caption: '', published: false },
    ],
  },
  es: {
    kicker: 'Un lugar, muchas historias',
    title: 'Happyland: una mirada a la vida en Manila',
    intro:
      'Happyland está en Tondo, Manila. Las familias viven aquí en condiciones difíciles. Queremos conocer mejor a las personas y su entorno y mostrarlos con respeto.',
    photoLabel: 'Foto próximamente',
    heroCaption: 'Una vista de Happyland: añade aquí una foto y un pie de foto específico.',
    stories: [
      {
        title: 'Vida cotidiana y reciclaje',
        body: 'Para algunas familias, recoger y clasificar materiales reciclables es una fuente de ingresos. Los residuos del entorno también complican la vida diaria.',
        caption: 'Vida cotidiana: añade aquí una foto y un pie de foto específico.',
      },
      {
        title: 'Crecer y aprender',
        body: 'Los niños crecen en este entorno. El acceso a la educación temprana y al aprendizaje regular puede ser difícil para las familias.',
        caption: 'Crecer en Tondo: añade aquí una foto y un pie de foto específico.',
      },
      { title: '21.gifts en el barrio', body: '', caption: '', published: false },
      { title: 'Qué hace posible tu donación', body: '', caption: '', published: false },
    ],
  },
  fil: {
    kicker: 'Isang lugar, maraming kuwento',
    title: 'Happyland – silip sa buhay sa Maynila',
    intro:
      'Ang Happyland ay nasa Tondo, Maynila. Hinaharap ng mga pamilya rito ang mahihirap na kalagayan araw-araw. Nais naming kilalanin at ilarawan nang may paggalang ang mga tao at ang kanilang paligid.',
    photoLabel: 'Larawan ay idadagdag',
    heroCaption: 'Tanawin ng Happyland – magdagdag dito ng larawan at tiyak na caption.',
    stories: [
      {
        title: 'Araw-araw at pagre-recycle',
        body: 'Para sa ilang pamilya, pinagkukunan ng kita ang pangongolekta at pagbubukod ng mga materyal na maaaring i-recycle. Pinahihirap din ng basura sa paligid ang pang-araw-araw na buhay.',
        caption: 'Araw-araw na buhay – magdagdag dito ng larawan at tiyak na caption.',
      },
      {
        title: 'Paglaki at pag-aaral',
        body: 'Lumalaki ang mga bata sa ganitong kapaligiran. Maaaring maging hamon sa mga pamilya ang pagpasok sa maagang edukasyon at tuloy-tuloy na pag-aaral.',
        caption: 'Paglaki sa Tondo – magdagdag dito ng larawan at tiyak na caption.',
      },
      { title: '21.gifts sa lugar', body: '', caption: '', published: false },
      { title: 'Naidudulot ng iyong regalo', body: '', caption: '', published: false },
    ],
  },
};

export function getHappylandContent(locale: Locale): Content {
  return content[locale];
}
