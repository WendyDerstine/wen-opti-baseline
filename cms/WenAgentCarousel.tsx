import { contentType, type ContentProps } from '@optimizely/cms-sdk';
import { getPreviewUtils } from '@optimizely/cms-sdk/react/server';
import { BTN_DARK, SECTION_CARD, linkHref, refSrc, type OptiLinkValue, type OptiRef } from './opti';
import { StoryScroller } from './storyScroller';

/** One agent card (used inline by WenAgentCarousel, not on its own). */
export const WenAgentCardContentType = contentType({
  key: 'WenAgentCard',
  baseType: '_component',
  displayName: '[WEN] Agent Card',
  description: 'Agent image, name, short description and link, used inside [WEN] Agent Carousel.',
  properties: {
    Title: { type: 'string', displayName: 'Agent name', isLocalized: true, sortOrder: 10 },
    Description: { type: 'string', displayName: 'Description (optional)', isLocalized: true, sortOrder: 20 },
    Image: {
      type: 'contentReference',
      allowedTypes: ['_image'],
      displayName: 'Image (optional; a pink-to-blue gradient shows when empty)',
      sortOrder: 30,
    },
    Link: { type: 'link', displayName: 'Link', isLocalized: true, sortOrder: 40 },
  },
});

/** "Meet the agents": centred header, then a one-at-a-time card carousel floating over a looping orb video. */
export const WenAgentCarouselContentType = contentType({
  key: 'WenAgentCarousel',
  baseType: '_component',
  displayName: '[WEN] Agent Carousel',
  description: 'Centred heading, intro and button, then a card carousel with arrows over a background video.',
  compositionBehaviors: ['sectionEnabled'],
  properties: {
    Heading: { type: 'string', displayName: 'Heading', isLocalized: true, sortOrder: 10 },
    Body: { type: 'string', displayName: 'Intro text', isLocalized: true, sortOrder: 20 },
    Cta: { type: 'link', displayName: 'Button', isLocalized: true, sortOrder: 30 },
    BackgroundVideo: {
      type: 'contentReference',
      allowedTypes: ['_video'],
      displayName: 'Background video',
      sortOrder: 40,
    },
    Agents: {
      type: 'array',
      displayName: 'Agents',
      sortOrder: 50,
      items: { type: 'component', contentType: WenAgentCardContentType },
    },
  },
});

type Props = { content: ContentProps<typeof WenAgentCarouselContentType> };
type Agent = { Title?: string | null; Description?: string | null; Image?: OptiRef; Link?: OptiLinkValue };

export default function WenAgentCarousel({ content }: Props) {
  const { pa } = getPreviewUtils(content);
  const block = (content as { __composition?: { key: string } }).__composition;
  const cta = content.Cta as OptiLinkValue;
  const video = refSrc(content.BackgroundVideo as OptiRef);
  const agents = (content.Agents ?? []) as Agent[];

  return (
    <section {...pa(block)} className={`${SECTION_CARD} w-full overflow-x-clip bg-[#eff6e9]`}>
      <div className="flex flex-col items-center gap-16 px-4 pt-20 md:gap-20 md:pt-32">
        <header className="flex w-full max-w-[679px] flex-col items-center gap-6 px-4 text-center">
          {content.Heading && (
            <h2
              {...pa('Heading')}
              className="font-[family-name:var(--font-display)] text-[36px] leading-none font-extrabold text-[#08251a] md:text-[64px]"
            >
              {content.Heading}
            </h2>
          )}
          {content.Body && (
            <p {...pa('Body')} className="text-base text-[#08251a] md:text-lg">
              {content.Body}
            </p>
          )}
          {cta?.text && (
            <a {...pa('Cta')} href={linkHref(cta)} target={cta.target ?? undefined} className={BTN_DARK}>
              {cta.text}
            </a>
          )}
        </header>
        <div className="relative min-h-[600px] w-full md:min-h-[700px]">
          {video && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center overflow-hidden select-none">
              <video
                {...pa('BackgroundVideo')}
                src={video}
                autoPlay
                loop
                muted
                playsInline
                className="block h-auto w-[1372px] max-w-none shrink-0"
              />
            </div>
          )}
          <div {...pa('Agents')} className="relative z-10 pt-8 pb-32 md:pt-16 md:pb-44">
            <StoryScroller layout="single">
              {agents.map((a, i) => {
                const img = refSrc(a.Image);
                return (
                  <div key={i} data-story-card className="w-full shrink-0 snap-center">
                    <a href={linkHref(a.Link)} className="group block h-full rounded-[16px] md:rounded-[24px]">
                      <div className="h-full overflow-clip rounded-[16px] border border-white bg-white/70 px-2 pt-2 pb-8 backdrop-blur-[15px] transition-all duration-200 group-hover:translate-x-1 group-hover:-translate-y-1 md:rounded-[24px] md:p-4">
                        <div className="flex h-full flex-col items-start gap-6 md:flex-row md:items-center md:gap-10">
                          <div className="w-full shrink-0 md:w-auto">
                            {img ? (
                              <img
                                src={img}
                                alt=""
                                className="aspect-[4/3] w-full rounded-[12px] object-cover md:h-[324px] md:w-[432px]"
                              />
                            ) : (
                              <div
                                aria-hidden
                                className="aspect-[4/3] w-full rounded-[12px] bg-gradient-to-br from-[#ff99b6] to-[#91dbda] md:h-[324px] md:w-[432px]"
                              />
                            )}
                          </div>
                          <div className="flex w-full grow flex-col items-start justify-center gap-5 px-5 md:gap-6 md:px-0 md:pr-8">
                            {a.Title && (
                              <h3 className="font-[family-name:var(--font-display)] text-2xl leading-[1.04] font-extrabold text-[#08251a] md:text-[40px]">
                                {a.Title}
                              </h3>
                            )}
                            {a.Description && <p className="text-sm leading-[1.3] text-[#08251a] md:text-2xl/tight">{a.Description}</p>}
                          </div>
                        </div>
                      </div>
                    </a>
                  </div>
                );
              })}
            </StoryScroller>
          </div>
        </div>
      </div>
    </section>
  );
}
