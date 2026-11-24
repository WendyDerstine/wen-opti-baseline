import { contentType, type ContentProps } from '@optimizely/cms-sdk';
import { getPreviewUtils } from '@optimizely/cms-sdk/react/server';
import { SplitHeading, linkHref, refSrc, type OptiLinkValue, type OptiRef } from './opti';

/**
 * "AI to make you unstoppable": dark fir section with a centred split heading,
 * intro text, an iridescent outline button and a looping video below.
 */
export const WenVideoFeatureContentType = contentType({
  key: 'WenVideoFeature',
  baseType: '_component',
  displayName: '[WEN] Video Feature',
  description: 'Dark section: two-line extruded heading, intro text, outline button and a looping video.',
  compositionBehaviors: ['sectionEnabled'],
  properties: {
    HeadingLine1: { type: 'string', displayName: 'Heading line 1', isLocalized: true, sortOrder: 10 },
    HeadingLine2: { type: 'string', displayName: 'Heading line 2 (extruded)', isLocalized: true, sortOrder: 20 },
    Body: { type: 'string', displayName: 'Intro text', isLocalized: true, sortOrder: 30 },
    Cta: { type: 'link', displayName: 'Button', isLocalized: true, sortOrder: 40 },
    Video: { type: 'contentReference', allowedTypes: ['_video'], displayName: 'Video', sortOrder: 50 },
    JoinAbove: {
      type: 'boolean',
      displayName: 'Join the section above',
      description: 'Removes the top gap and rounded corners so this section continues a dark section above it.',
      sortOrder: 60,
    },
  },
});

type Props = { content: ContentProps<typeof WenVideoFeatureContentType> };

export default function WenVideoFeature({ content }: Props) {
  const { pa } = getPreviewUtils(content);
  const block = (content as { __composition?: { key: string } }).__composition;
  const cta = content.Cta as OptiLinkValue;
  const video = refSrc(content.Video as OptiRef);

  return (
    <section
      {...pa(block)}
      className={`relative w-full bg-[#08251a] px-2 text-white lg:px-8 ${
        content.JoinAbove
          ? 'pt-12 pb-32 lg:pb-40'
          : 'mt-24 rounded-t-[24px] pt-20 pb-32 lg:mt-32 lg:rounded-t-[40px] lg:pt-32 lg:pb-40'
      }`}
    >
      <div className="container mx-auto">
        <div className="mx-auto flex max-w-3xl flex-col items-center py-8 text-center">
          <SplitHeading
            dark
            line1={content.HeadingLine1}
            line2={content.HeadingLine2}
            className="text-center"
            attrs1={pa('HeadingLine1')}
            attrs2={pa('HeadingLine2')}
          />
          {content.Body && (
            <p {...pa('Body')} className="mt-8 max-w-xl text-lg leading-snug text-white">
              {content.Body}
            </p>
          )}
          {cta?.text && (
            <span className="mt-10 inline-flex rounded-[16px] bg-[linear-gradient(110deg,#91dbda,#abff44,#ff99b6,#91dbda)] p-0.5 lg:rounded-[22px]">
              <a
                {...pa('Cta')}
                href={linkHref(cta)}
                target={cta.target ?? undefined}
                className="inline-flex h-10 items-center justify-center rounded-[12px] bg-[#08251a] px-4 text-sm font-medium tracking-[0.32px] text-[#eff6e9] transition-all hover:translate-x-0.5 hover:-translate-y-0.5 lg:h-14 lg:rounded-[20px] lg:px-6 lg:text-lg"
              >
                {cta.text}
              </a>
            </span>
          )}
        </div>
        {video && (
          <figure {...pa('Video')} className="mt-24 lg:mt-12">
            <video src={video} autoPlay loop muted playsInline className="h-auto w-full rounded-[16px] lg:rounded-3xl" />
          </figure>
        )}
      </div>
    </section>
  );
}
