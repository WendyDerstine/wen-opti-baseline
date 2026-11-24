import { contentType, type ContentProps } from '@optimizely/cms-sdk';
import { getPreviewUtils } from '@optimizely/cms-sdk/react/server';
import { BTN_DARK, SECTION_CARD, linkHref, type OptiLinkValue } from './opti';

/** One text card (used inline by WenTextCards, not on its own). */
export const WenTextCardContentType = contentType({
  key: 'WenTextCard',
  baseType: '_component',
  displayName: '[WEN] Text Card',
  description: 'Title and text, used inside [WEN] Text Cards.',
  properties: {
    Title: { type: 'string', displayName: 'Title', isLocalized: true, sortOrder: 10 },
    Body: { type: 'string', displayName: 'Text', isLocalized: true, sortOrder: 20 },
  },
});

/** "AI built for marketing": centred heading, intro and button over a row of text-only cards. */
export const WenTextCardsContentType = contentType({
  key: 'WenTextCards',
  baseType: '_component',
  displayName: '[WEN] Text Cards',
  description: 'Centred heading, intro text and button over a row of text-only cards.',
  compositionBehaviors: ['sectionEnabled'],
  properties: {
    Heading: { type: 'string', displayName: 'Heading', isLocalized: true, sortOrder: 10 },
    Body: { type: 'string', displayName: 'Intro text', isLocalized: true, sortOrder: 20 },
    Cta: { type: 'link', displayName: 'Button', isLocalized: true, sortOrder: 30 },
    Cards: {
      type: 'array',
      displayName: 'Cards',
      sortOrder: 40,
      items: { type: 'component', contentType: WenTextCardContentType },
    },
  },
});

type Props = { content: ContentProps<typeof WenTextCardsContentType> };
type Card = { Title?: string | null; Body?: string | null };

export default function WenTextCards({ content }: Props) {
  const { pa } = getPreviewUtils(content);
  const block = (content as { __composition?: { key: string } }).__composition;
  const cta = content.Cta as OptiLinkValue;
  const cards = (content.Cards ?? []) as Card[];

  return (
    <section {...pa(block)} className={`${SECTION_CARD} w-full bg-white px-2 pt-20 pb-28 lg:px-8 lg:pt-32 lg:pb-40`}>
      <div className="container mx-auto">
        <div className="mx-auto flex max-w-xl flex-col items-center py-8 text-center">
          {content.Heading && (
            <h2
              {...pa('Heading')}
              className="font-[family-name:var(--font-display)] text-[44px] leading-[0.9] font-extrabold tracking-[-0.01em] text-[#08251a] md:text-[56px] lg:text-[64px]"
            >
              {content.Heading}
            </h2>
          )}
          {content.Body && (
            <p {...pa('Body')} className="mt-8 text-lg leading-snug text-[#08251a]">
              {content.Body}
            </p>
          )}
          {cta?.text && (
            <a {...pa('Cta')} href={linkHref(cta)} target={cta.target ?? undefined} className={`mt-8 ${BTN_DARK}`}>
              {cta.text}
            </a>
          )}
        </div>
        <div {...pa('Cards')} className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3 lg:mt-16">
          {cards.map((c, i) => (
            <div key={i} className="flex flex-col gap-5 rounded-2xl bg-[#eff6e9] px-5 py-8 md:rounded-3xl md:px-6 md:py-10">
              {c.Title && (
                <h3 className="font-[family-name:var(--font-display)] text-[29px] leading-[1.15] font-extrabold text-[#08251a] md:text-[36px]">
                  {c.Title}
                </h3>
              )}
              {c.Body && <p className="text-base leading-snug text-[#08251a] md:text-xl">{c.Body}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
