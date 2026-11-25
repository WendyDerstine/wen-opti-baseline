import { contentType, type ContentProps } from '@optimizely/cms-sdk';
import { getPreviewUtils } from '@optimizely/cms-sdk/react/server';
import { BTN_DARK, ExtrudedText, linkHref, refSrc, type OptiLinkValue, type OptiRef } from './opti';
import { StoryScroller } from './storyScroller';

/** One customer story card (used inline by WenStoryCarousel, not on its own). */
export const WenStoryCardContentType = contentType({
  key: 'WenStoryCard',
  baseType: '_component',
  displayName: '[WEN] Story Card',
  description: 'Customer logo, headline stat, attribution and photo, used inside [WEN] Story Carousel.',
  properties: {
    Logo: { type: 'contentReference', allowedTypes: ['_image'], displayName: 'Customer logo', sortOrder: 10 },
    CustomerName: { type: 'string', displayName: 'Customer name (logo alt text)', sortOrder: 20 },
    Stat: { type: 'string', displayName: 'Headline stat', isLocalized: true, sortOrder: 30 },
    Attribution: {
      type: 'string',
      displayName: 'Attribution',
      description: 'Name and title. A line break starts a new line.',
      isLocalized: true,
      sortOrder: 40,
    },
    Image: { type: 'contentReference', allowedTypes: ['_image'], displayName: 'Photo', sortOrder: 50 },
    Link: { type: 'link', displayName: 'Story link', isLocalized: true, sortOrder: 60 },
  },
});

/** "Stories of success": heading over a horizontally scrolling row of story cards with arrows. */
export const WenStoryCarouselContentType = contentType({
  key: 'WenStoryCarousel',
  baseType: '_component',
  displayName: '[WEN] Story Carousel',
  description: 'Large heading over a scrolling carousel of customer story cards with arrow controls.',
  compositionBehaviors: ['sectionEnabled'],
  properties: {
    Heading: { type: 'string', displayName: 'Heading', isLocalized: true, sortOrder: 10 },
    HeadingLine2: { type: 'string', displayName: 'Heading line 2 (extruded, optional)', isLocalized: true, sortOrder: 12 },
    HeadingLine3: { type: 'string', displayName: 'Heading line 3 (optional)', isLocalized: true, sortOrder: 14 },
    Body: { type: 'string', displayName: 'Intro text (optional)', isLocalized: true, sortOrder: 16 },
    Cta: { type: 'link', displayName: 'Button (optional)', isLocalized: true, sortOrder: 18 },
    Stories: {
      type: 'array',
      displayName: 'Stories',
      sortOrder: 20,
      items: { type: 'component', contentType: WenStoryCardContentType },
    },
  },
});

type Props = { content: ContentProps<typeof WenStoryCarouselContentType> };
type Story = {
  Logo?: OptiRef;
  CustomerName?: string | null;
  Stat?: string | null;
  Attribution?: string | null;
  Image?: OptiRef;
  Link?: OptiLinkValue;
};

export default function WenStoryCarousel({ content }: Props) {
  const { pa } = getPreviewUtils(content);
  const block = (content as { __composition?: { key: string } }).__composition;
  const stories = (content.Stories ?? []) as Story[];
  const cta = content.Cta as OptiLinkValue;
  const intro = Boolean(content.HeadingLine2 || content.HeadingLine3 || content.Body || cta?.text);

  return (
    <section {...pa(block)} className="relative w-full bg-white pt-20 pb-28 lg:pt-32 lg:pb-40">
      {(content.Heading || content.HeadingLine2 || content.HeadingLine3) && (
        <h2
          className={`container mx-auto px-4 text-center font-[family-name:var(--font-display)] text-[56px] leading-[0.9] font-extrabold tracking-[-0.01em] text-[#08251a] md:text-[64px] lg:text-[96px] ${
            intro ? 'mb-6' : 'mb-12'
          }`}
        >
          {content.Heading && (
            <span {...pa('Heading')} className="block">
              {content.Heading}
            </span>
          )}
          {content.HeadingLine2 && (
            <span {...pa('HeadingLine2')} className="block pt-[0.1em] lg:text-[112px]">
              <ExtrudedText text={content.HeadingLine2} />
            </span>
          )}
          {content.HeadingLine3 && (
            <span {...pa('HeadingLine3')} className="block">
              {content.HeadingLine3}
            </span>
          )}
        </h2>
      )}
      {(content.Body || cta?.text) && (
        <div className="mx-auto mb-12 flex max-w-2xl flex-col items-center gap-8 px-4 text-center lg:mb-16">
          {content.Body && (
            <p {...pa('Body')} className="text-lg leading-snug text-[#08251a]">
              {content.Body}
            </p>
          )}
          {cta?.text && (
            <a {...pa('Cta')} href={linkHref(cta)} target={cta.target ?? undefined} className={BTN_DARK}>
              {cta.text}
            </a>
          )}
        </div>
      )}
      <div {...pa('Stories')}>
        <StoryScroller>
          {stories.map((s, i) => {
            const logo = refSrc(s.Logo);
            const photo = refSrc(s.Image);
            // Cards link only when a URL is set; otherwise they render as plain cards.
            const Card = s.Link?.url?.default ? 'a' : 'div';
            return (
              <div key={i} data-story-card className="w-[min(892px,calc(100vw-32px))] shrink-0 snap-center">
                <Card
                  {...(Card === 'a' ? { href: linkHref(s.Link) } : {})}
                  className="group flex h-full rounded-[16px] bg-[#d8e4cb] p-px md:rounded-[26px]"
                >
                  <div
                    className={`h-full w-full overflow-clip rounded-[15px] transition-all duration-200 md:rounded-[25px] ${
                      Card === 'a' ? 'group-hover:translate-x-1 group-hover:-translate-y-1' : ''
                    }`}
                  >
                    <div className="flex h-full flex-col gap-2 rounded-[12px] bg-[#eff6e9] p-1 md:flex-row md:items-stretch md:gap-1.5 md:rounded-[20px] md:p-2">
                      <div className="order-last flex flex-col gap-12 px-4 pt-2 pb-4 md:order-first md:flex-1 md:justify-between md:gap-8 md:p-6 md:pr-10">
                        {logo && (
                          <img src={logo} alt={s.CustomerName ?? ''} className="h-10 w-32 self-start object-contain object-left brightness-0" />
                        )}
                        <div className="flex flex-1 flex-col justify-center">
                          {s.Stat && (
                            <h3 className="line-clamp-4 pb-1 font-[family-name:var(--font-display)] text-2xl leading-[1.1] font-extrabold text-[#08251a] md:text-[48px]">
                              {s.Stat}
                            </h3>
                          )}
                        </div>
                        <div className="text-xs leading-[1.35] whitespace-pre-line text-[#08251a] md:text-sm md:leading-[1.3]">
                          {s.Attribution ?? ''}
                        </div>
                      </div>
                      <div className="order-first md:order-last md:w-1/2 md:shrink-0">
                        <div className="relative flex aspect-[8/7] items-center justify-center overflow-hidden rounded-xl md:size-full md:rounded-2xl">
                          {photo && <img src={photo} alt={s.CustomerName ?? ''} className="absolute inset-0 size-full object-cover" />}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            );
          })}
        </StoryScroller>
      </div>
    </section>
  );
}
