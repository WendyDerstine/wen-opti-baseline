import { contentType, type ContentProps } from '@optimizely/cms-sdk';
import { getPreviewUtils } from '@optimizely/cms-sdk/react/server';
import { ArcText, BTN_LIME, linkHref, refSrc, type OptiLinkValue, type OptiRef } from './opti';

/**
 * optimizely.com home hero: full-bleed background photo, a centred extruded
 * headline at the top, intro text and a lime button bottom-left.
 */
export const WenHeroBannerContentType = contentType({
  key: 'WenHeroBanner',
  baseType: '_component',
  displayName: '[WEN] Hero Banner',
  description: 'Full-bleed background image with an extruded headline, intro text and a button.',
  compositionBehaviors: ['sectionEnabled'],
  properties: {
    BackgroundImage: {
      type: 'contentReference',
      allowedTypes: ['_image'],
      displayName: 'Background image',
      sortOrder: 10,
    },
    Heading: { type: 'string', displayName: 'Heading', isLocalized: true, sortOrder: 20 },
    Body: { type: 'string', displayName: 'Intro text', isLocalized: true, sortOrder: 30 },
    Cta: { type: 'link', displayName: 'Button', isLocalized: true, sortOrder: 40 },
    HeadingLevel: {
      type: 'string',
      displayName: 'Heading level',
      description: 'H1 for the page hero (default). H2 when this banner is used further down a page.',
      sortOrder: 50,
      enum: [
        { value: 'h1', displayName: 'H1 (page hero)' },
        { value: 'h2', displayName: 'H2 (section)' },
      ],
    },
  },
});

type Props = { content: ContentProps<typeof WenHeroBannerContentType> };

export default function WenHeroBanner({ content }: Props) {
  const { pa } = getPreviewUtils(content);
  const block = (content as { __composition?: { key: string } }).__composition;
  const bg = refSrc(content.BackgroundImage as OptiRef);
  const cta = content.Cta as OptiLinkValue;
  const Heading = content.HeadingLevel === 'h2' ? 'h2' : 'h1';

  return (
    <section
      {...pa(block)}
      className="relative flex min-h-[80vh] w-full flex-col overflow-hidden bg-[#08251a] px-4 pt-16 pb-24 md:px-8 lg:px-16 lg:pb-32"
    >
      {bg && (
        <img
          {...pa('BackgroundImage')}
          src={bg}
          alt=""
          className="pointer-events-none absolute inset-0 size-full object-cover object-center"
        />
      )}
      <div className="relative z-10 flex grow flex-col">
        {content.Heading && (
          <Heading {...pa('Heading')} className="mx-auto w-full max-w-[1000px] pt-2 pb-8">
            <span className="sr-only">{content.Heading}</span>
            <ArcText text={content.Heading} id={`wen-arc-${block?.key ?? Heading}`} />
          </Heading>
        )}
        <div className="mt-auto grid w-full grid-cols-1 lg:grid-cols-12">
          <div className="flex flex-col items-center gap-8 text-center lg:col-span-4 lg:items-start lg:text-left xl:col-span-3">
            {content.Body && (
              <p {...pa('Body')} className="text-2xl leading-tight font-medium text-[#abff44] lg:text-lg">
                {content.Body}
              </p>
            )}
            {cta?.text && (
              <a {...pa('Cta')} href={linkHref(cta)} target={cta.target ?? undefined} className={BTN_LIME}>
                {cta.text}
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
