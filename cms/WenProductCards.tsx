import { contentType, type ContentProps } from '@optimizely/cms-sdk';
import { getPreviewUtils } from '@optimizely/cms-sdk/react/server';
import { BTN_DARK, SECTION_CARD, SplitHeading, linkHref, refSrc, type OptiLinkValue, type OptiRef } from './opti';

/** One product card (used inline by WenProductCards, not on its own). */
export const WenProductCardContentType = contentType({
  key: 'WenProductCard',
  baseType: '_component',
  displayName: '[WEN] Product Card',
  description: 'Image, eyebrow, title, description and button, used inside [WEN] Product Cards.',
  properties: {
    Image: { type: 'contentReference', allowedTypes: ['_image'], displayName: 'Image', sortOrder: 10 },
    Eyebrow: { type: 'string', displayName: 'Eyebrow', isLocalized: true, sortOrder: 20 },
    Title: { type: 'string', displayName: 'Title', isLocalized: true, sortOrder: 30 },
    Description: { type: 'string', displayName: 'Description', isLocalized: true, sortOrder: 40 },
    Cta: { type: 'link', displayName: 'Link (whole card) and button text', isLocalized: true, sortOrder: 50 },
  },
});

/** "Tools to get you growing again": split heading over a row of product cards. */
export const WenProductCardsContentType = contentType({
  key: 'WenProductCards',
  baseType: '_component',
  displayName: '[WEN] Product Cards',
  description: 'Two-line extruded heading over a row of linked product cards.',
  compositionBehaviors: ['sectionEnabled'],
  properties: {
    HeadingLine1: { type: 'string', displayName: 'Heading line 1', isLocalized: true, sortOrder: 10 },
    HeadingLine2: { type: 'string', displayName: 'Heading line 2 (extruded)', isLocalized: true, sortOrder: 20 },
    Cards: {
      type: 'array',
      displayName: 'Cards',
      sortOrder: 30,
      items: { type: 'component', contentType: WenProductCardContentType },
    },
  },
});

type Props = { content: ContentProps<typeof WenProductCardsContentType> };
type Card = {
  Image?: OptiRef;
  Eyebrow?: string | null;
  Title?: string | null;
  Description?: string | null;
  Cta?: OptiLinkValue;
};

export default function WenProductCards({ content }: Props) {
  const { pa } = getPreviewUtils(content);
  const block = (content as { __composition?: { key: string } }).__composition;
  const cards = (content.Cards ?? []) as Card[];

  return (
    <section {...pa(block)} className={`${SECTION_CARD} w-full bg-white px-2 pt-20 pb-8 lg:px-8 lg:pt-32`}>
      <div className="container mx-auto py-8">
        <SplitHeading
          line1={content.HeadingLine1}
          line2={content.HeadingLine2}
          className="text-center"
          attrs1={pa('HeadingLine1')}
          attrs2={pa('HeadingLine2')}
        />
      </div>
      <div {...pa('Cards')} className="container mx-auto flex flex-col gap-4 py-8 lg:flex-row">
        {cards.map((card, i) => {
          const src = refSrc(card.Image);
          return (
            <div key={i} className="flex flex-1 flex-col rounded-[16px] bg-[#eff6e9] lg:rounded-[24px]">
              <a
                href={linkHref(card.Cta)}
                target={card.Cta?.target ?? undefined}
                className="group flex h-full flex-col rounded-2xl p-2 md:rounded-3xl md:p-3"
              >
                <div className="relative aspect-[5/4] overflow-hidden rounded-xl md:rounded-2xl">
                  {src && (
                    <img
                      src={src}
                      alt={card.Title ? `${card.Title} product visual` : ''}
                      className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-5 px-3 py-6 md:gap-6 md:py-8">
                  <div className="flex flex-col gap-4">
                    {card.Eyebrow && <p className="text-sm leading-[1.35] font-medium text-[#08251a]">{card.Eyebrow}</p>}
                    {card.Title && (
                      <h3 className="font-[family-name:var(--font-display)] text-[29px] leading-[1.04] font-extrabold text-[#08251a] md:text-[36px]">
                        {card.Title}
                      </h3>
                    )}
                  </div>
                  {card.Description && (
                    <p className="text-sm leading-[1.3] text-[#08251a] md:text-2xl/tight">{card.Description}</p>
                  )}
                  {card.Cta?.text && (
                    <div className="mt-auto flex">
                      <span className={BTN_DARK}>{card.Cta.text}</span>
                    </div>
                  )}
                </div>
              </a>
            </div>
          );
        })}
      </div>
    </section>
  );
}
