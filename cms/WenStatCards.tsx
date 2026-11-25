import { contentType, type ContentProps } from '@optimizely/cms-sdk';
import { getPreviewUtils } from '@optimizely/cms-sdk/react/server';
import { ExtrudedText, SECTION_CARD, refSrc, type OptiRef } from './opti';

/** One stat (used inline by WenStatCards, not on its own). */
export const WenStatItemContentType = contentType({
  key: 'WenStatItem',
  baseType: '_component',
  displayName: '[WEN] Stat Item',
  description: 'A big extruded number and a label, used inside [WEN] Stat Cards.',
  properties: {
    Value: { type: 'string', displayName: 'Value (e.g. 25%)', isLocalized: true, sortOrder: 10 },
    Label: { type: 'string', displayName: 'Label', isLocalized: true, sortOrder: 20 },
  },
});

/** "Save time, boost everything else": heading over a row of stat cards. */
export const WenStatCardsContentType = contentType({
  key: 'WenStatCards',
  baseType: '_component',
  displayName: '[WEN] Stat Cards',
  description: 'Centred heading over a row of cards with big extruded numbers.',
  compositionBehaviors: ['sectionEnabled'],
  properties: {
    Heading: { type: 'string', displayName: 'Heading', isLocalized: true, sortOrder: 10 },
    Body: { type: 'string', displayName: 'Intro text (optional)', isLocalized: true, sortOrder: 15 },
    BackgroundImage: {
      type: 'contentReference',
      allowedTypes: ['_image'],
      displayName: 'Background image (optional)',
      description: 'Full-bleed photo behind the section. Heading and text turn white.',
      sortOrder: 18,
    },
    Stats: {
      type: 'array',
      displayName: 'Stats',
      sortOrder: 20,
      items: { type: 'component', contentType: WenStatItemContentType },
    },
  },
});

type Props = { content: ContentProps<typeof WenStatCardsContentType> };
type Stat = { Value?: string | null; Label?: string | null };

export default function WenStatCards({ content }: Props) {
  const { pa } = getPreviewUtils(content);
  const block = (content as { __composition?: { key: string } }).__composition;
  const stats = (content.Stats ?? []) as Stat[];
  const bg = refSrc(content.BackgroundImage as OptiRef);

  return (
    <section
      {...pa(block)}
      className={`relative w-full px-2 pt-20 pb-28 lg:px-8 lg:pt-32 lg:pb-40 ${bg ? `${SECTION_CARD} overflow-hidden bg-[#08251a]` : 'bg-white'}`}
    >
      {bg && (
        <img
          {...pa('BackgroundImage')}
          src={bg}
          alt=""
          className="pointer-events-none absolute inset-0 size-full object-cover object-center"
        />
      )}
      <div className="relative z-10 container mx-auto">
        {content.Heading && (
          <h2
            {...pa('Heading')}
            className={`mx-auto py-8 text-center font-[family-name:var(--font-display)] font-extrabold tracking-[-0.01em] ${
              bg
                ? 'max-w-4xl text-[44px] leading-none text-white md:text-[64px] lg:text-[80px]'
                : 'text-[40px] leading-[0.9] text-[#08251a] md:text-[56px] lg:text-[64px]'
            }`}
          >
            {content.Heading}
          </h2>
        )}
        {content.Body && (
          <p
            {...pa('Body')}
            className={`mx-auto max-w-2xl px-6 text-center text-lg leading-snug lg:px-12 ${bg ? 'text-white' : 'text-[#08251a]'}`}
          >
            {content.Body}
          </p>
        )}
        <div {...pa('Stats')} className={`flex flex-col gap-4 py-2 lg:flex-row ${bg ? 'mt-8 lg:mt-20' : 'lg:mt-8'}`}>
          {stats.map((s, i) => (
            <div key={i} className="flex flex-1 flex-col items-start rounded-3xl bg-[#eff6e9] px-5 py-6 md:p-8">
              {s.Value && (
                <span className="pt-4 pr-4 font-[family-name:var(--font-display)] text-[56px] leading-none font-extrabold tracking-[-0.01em] md:text-[80px]">
                  <ExtrudedText text={s.Value} />
                </span>
              )}
              {s.Label && <p className="mt-6 text-base leading-tight font-medium text-[#08251a] md:text-xl">{s.Label}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
