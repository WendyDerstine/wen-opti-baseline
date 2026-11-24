import { contentType, type ContentProps } from '@optimizely/cms-sdk';
import { getPreviewUtils } from '@optimizely/cms-sdk/react/server';
import { BTN_DARK, SECTION_CARD, linkHref, refSrc, type OptiLinkValue, type OptiRef } from './opti';

/**
 * "Yes, you can test here. And the rest!": centred heading, intro text and a
 * button over a continuously scrolling row of square illustrations.
 */
export const WenMediaMarqueeContentType = contentType({
  key: 'WenMediaMarquee',
  baseType: '_component',
  displayName: '[WEN] Media Marquee',
  description: 'Centred heading, intro text and button over a scrolling row of square images.',
  compositionBehaviors: ['sectionEnabled'],
  properties: {
    Heading: { type: 'string', displayName: 'Heading', isLocalized: true, sortOrder: 10 },
    Body: { type: 'string', displayName: 'Intro text', isLocalized: true, sortOrder: 20 },
    Cta: { type: 'link', displayName: 'Button', isLocalized: true, sortOrder: 30 },
    Images: {
      type: 'array',
      displayName: 'Images',
      sortOrder: 40,
      items: { type: 'contentReference', allowedTypes: ['_image'] },
    },
  },
});

type Props = { content: ContentProps<typeof WenMediaMarqueeContentType> };

export default function WenMediaMarquee({ content }: Props) {
  const { pa } = getPreviewUtils(content);
  const block = (content as { __composition?: { key: string } }).__composition;
  const cta = content.Cta as OptiLinkValue;
  const images = ((content.Images ?? []) as OptiRef[]).map(refSrc).filter((s): s is string => !!s);

  return (
    <section {...pa(block)} className={`${SECTION_CARD} w-full bg-[#eff6e9] pt-20 pb-28 lg:pt-32 lg:pb-40`}>
      <div className="container mx-auto flex flex-col items-center px-7 text-center lg:px-16">
        {content.Heading && (
          <h2
            {...pa('Heading')}
            className="max-w-3xl font-[family-name:var(--font-display)] text-[40px] leading-none font-extrabold tracking-[-0.01em] text-[#08251a] md:text-[56px] lg:text-[64px]"
          >
            {content.Heading}
          </h2>
        )}
        {content.Body && (
          <p {...pa('Body')} className="mt-8 max-w-xl text-lg leading-snug text-[#08251a]">
            {content.Body}
          </p>
        )}
        {cta?.text && (
          <a {...pa('Cta')} href={linkHref(cta)} target={cta.target ?? undefined} className={`mt-10 ${BTN_DARK}`}>
            {cta.text}
          </a>
        )}
      </div>
      <div {...pa('Images')} className="mt-16 w-full overflow-hidden">
        <div className="flex w-max animate-[wen-marquee_60s_linear_infinite] hover:[animation-play-state:paused]">
          {[...images, ...images].map((src, i) => (
            <div key={i} className="w-[min(330px,calc(100vw-32px))] shrink-0 pr-6">
              <div className="relative aspect-square overflow-hidden rounded-[24px]">
                <img src={src} alt="" className="absolute inset-0 size-full object-cover" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
