import { contentType, type ContentProps } from '@optimizely/cms-sdk';
import { getPreviewUtils } from '@optimizely/cms-sdk/react/server';
import { SECTION_CARD, refSrc, type OptiRef } from './opti';

/** One brand in the logo strip (used inline by WenLogoStrip, not on its own). */
export const WenLogoItemContentType = contentType({
  key: 'WenLogoItem',
  baseType: '_component',
  displayName: '[WEN] Logo Item',
  description: 'A brand logo and name, used inside the [WEN] Logo Strip.',
  properties: {
    Name: { type: 'string', displayName: 'Brand name', sortOrder: 10 },
    Logo: { type: 'contentReference', allowedTypes: ['_image'], displayName: 'Logo', sortOrder: 20 },
  },
});

/** "Trusted by 10,000+ brands": an eyebrow line over a scrolling row of logo pills. */
export const WenLogoStripContentType = contentType({
  key: 'WenLogoStrip',
  baseType: '_component',
  displayName: '[WEN] Logo Strip',
  description: 'Eyebrow text over a continuously scrolling row of brand logo pills.',
  compositionBehaviors: ['sectionEnabled'],
  properties: {
    Eyebrow: { type: 'string', displayName: 'Eyebrow', isLocalized: true, sortOrder: 10 },
    Logos: {
      type: 'array',
      displayName: 'Logos',
      sortOrder: 20,
      items: { type: 'component', contentType: WenLogoItemContentType },
    },
  },
});

type Props = { content: ContentProps<typeof WenLogoStripContentType> };
type Logo = { Name?: string | null; Logo?: OptiRef };

function LogoPill({ item }: { item: Logo }) {
  const src = refSrc(item.Logo);
  return (
    <div className="shrink-0 pr-4">
      <div className="inline-block rounded-[12px] bg-[#d8e4cb] p-px">
        <div className="rounded-[11px] bg-[#eff6e9]">
          <div className="flex flex-row items-center gap-5 py-1 pr-10 pl-1">
            <div className="flex size-16 shrink-0 items-center justify-center rounded-[8px] bg-[#e4f0da]">
              {src && <img src={src} alt={item.Name ?? ''} className="max-h-10 max-w-12 object-contain brightness-0" />}
            </div>
            <span className="text-xs leading-[1.3] text-[#08251a]">{item.Name}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WenLogoStrip({ content }: Props) {
  const { pa } = getPreviewUtils(content);
  const block = (content as { __composition?: { key: string } }).__composition;
  const logos = (content.Logos ?? []) as Logo[];

  return (
    <section {...pa(block)} className={`${SECTION_CARD} w-full bg-white pt-8 pb-8 lg:pt-12`}>
      {content.Eyebrow && (
        <p {...pa('Eyebrow')} className="py-8 text-center text-base font-medium text-[#08251a]">
          {content.Eyebrow}
        </p>
      )}
      <div {...pa('Logos')} className="w-full overflow-hidden py-4">
        {/* Two copies of the row so the marquee loops seamlessly. */}
        <div className="flex w-max animate-[wen-marquee_80s_linear_infinite] hover:[animation-play-state:paused]">
          {[...logos, ...logos].map((item, i) => (
            <LogoPill key={i} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
}
