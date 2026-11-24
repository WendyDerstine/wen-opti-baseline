import { contentType, type ContentProps } from '@optimizely/cms-sdk';
import { getPreviewUtils } from '@optimizely/cms-sdk/react/server';
import { refSrc, type OptiRef } from './opti';

/** One feature row (used inline by WenFeatureRows, not on its own). */
export const WenFeatureRowContentType = contentType({
  key: 'WenFeatureRow',
  baseType: '_component',
  displayName: '[WEN] Feature Row',
  description: 'Eyebrow, title and text beside a wide image, used inside [WEN] Feature Rows.',
  properties: {
    Eyebrow: { type: 'string', displayName: 'Eyebrow', isLocalized: true, sortOrder: 10 },
    Title: { type: 'string', displayName: 'Title', isLocalized: true, sortOrder: 20 },
    Body: { type: 'string', displayName: 'Text', isLocalized: true, sortOrder: 30 },
    Image: { type: 'contentReference', allowedTypes: ['_image'], displayName: 'Image', sortOrder: 40 },
  },
});

/** "Create without the ceiling": white cards (text left, image right) stacked on a dark section. */
export const WenFeatureRowsContentType = contentType({
  key: 'WenFeatureRows',
  baseType: '_component',
  displayName: '[WEN] Feature Rows',
  description: 'Dark section with stacked white cards: text on the left, a wide image on the right.',
  compositionBehaviors: ['sectionEnabled'],
  properties: {
    Rows: {
      type: 'array',
      displayName: 'Rows',
      sortOrder: 10,
      items: { type: 'component', contentType: WenFeatureRowContentType },
    },
  },
});

type Props = { content: ContentProps<typeof WenFeatureRowsContentType> };
type Row = { Eyebrow?: string | null; Title?: string | null; Body?: string | null; Image?: OptiRef };

export default function WenFeatureRows({ content }: Props) {
  const { pa } = getPreviewUtils(content);
  const block = (content as { __composition?: { key: string } }).__composition;
  const rows = (content.Rows ?? []) as Row[];

  return (
    <section {...pa(block)} className="relative w-full bg-[#08251a] px-2 pt-4 pb-12 lg:px-8">
      <div {...pa('Rows')} className="container mx-auto flex flex-col gap-4 py-8">
        {rows.map((r, i) => {
          const src = refSrc(r.Image);
          return (
            <div key={i} className="flex flex-col rounded-2xl bg-white p-2 md:flex-row md:gap-4 md:rounded-3xl md:p-3">
              <div className="flex flex-col justify-center gap-5 px-3 py-6 md:w-[30%] md:shrink-0 md:gap-6 md:py-8 md:pl-6">
                {r.Eyebrow && <p className="text-sm leading-[1.35] font-medium text-[#08251a]">{r.Eyebrow}</p>}
                {r.Title && (
                  <h3 className="font-[family-name:var(--font-display)] text-[29px] leading-[1.15] font-extrabold text-[#08251a] md:text-[48px]">
                    {r.Title}
                  </h3>
                )}
                {r.Body && <p className="text-base leading-snug text-[#08251a] md:text-xl">{r.Body}</p>}
              </div>
              <div className="relative order-first aspect-video overflow-hidden rounded-xl md:order-last md:flex-1 md:rounded-2xl">
                {src && <img src={src} alt={r.Title ?? ''} className="absolute inset-0 size-full object-cover" />}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
