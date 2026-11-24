import { contentType, type ContentProps } from '@optimizely/cms-sdk';
import { getPreviewUtils } from '@optimizely/cms-sdk/react/server';
import { ExtrudedText } from './opti';

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

  return (
    <section {...pa(block)} className="relative w-full bg-white px-2 pt-20 pb-28 lg:px-8 lg:pt-32 lg:pb-40">
      <div className="container mx-auto">
        {content.Heading && (
          <h2
            {...pa('Heading')}
            className="py-8 text-center font-[family-name:var(--font-display)] text-[40px] leading-[0.9] font-extrabold tracking-[-0.01em] text-[#08251a] md:text-[56px] lg:text-[64px]"
          >
            {content.Heading}
          </h2>
        )}
        <div {...pa('Stats')} className="flex flex-col gap-4 py-2 lg:mt-8 lg:flex-row">
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
