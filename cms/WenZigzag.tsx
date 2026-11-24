import { contentType, type ContentProps } from '@optimizely/cms-sdk';
import { getPreviewUtils } from '@optimizely/cms-sdk/react/server';
import { SECTION_CARD, SplitHeading, refSrc, type OptiRef } from './opti';

/** One zigzag row (used inline by WenZigzag, not on its own). */
export const WenZigzagRowContentType = contentType({
  key: 'WenZigzagRow',
  baseType: '_component',
  displayName: '[WEN] Zigzag Row',
  description: 'Square image beside a title and text card, used inside [WEN] Zigzag.',
  properties: {
    Image: { type: 'contentReference', allowedTypes: ['_image'], displayName: 'Image', sortOrder: 10 },
    Title: { type: 'string', displayName: 'Title', isLocalized: true, sortOrder: 20 },
    Body: { type: 'string', displayName: 'Text', isLocalized: true, sortOrder: 30 },
  },
});

/** "One platform. Three paths to growth.": split heading over staggered image + text rows. */
export const WenZigzagContentType = contentType({
  key: 'WenZigzag',
  baseType: '_component',
  displayName: '[WEN] Zigzag',
  description: 'Two-line extruded heading over staggered rows that alternate the image left and right.',
  compositionBehaviors: ['sectionEnabled'],
  properties: {
    HeadingLine1: { type: 'string', displayName: 'Heading line 1', isLocalized: true, sortOrder: 10 },
    HeadingLine2: { type: 'string', displayName: 'Heading line 2 (extruded)', isLocalized: true, sortOrder: 20 },
    Rows: {
      type: 'array',
      displayName: 'Rows',
      sortOrder: 30,
      items: { type: 'component', contentType: WenZigzagRowContentType },
    },
  },
});

type Props = { content: ContentProps<typeof WenZigzagContentType> };
type Row = { Image?: OptiRef; Title?: string | null; Body?: string | null };

export default function WenZigzag({ content }: Props) {
  const { pa } = getPreviewUtils(content);
  const block = (content as { __composition?: { key: string } }).__composition;
  const rows = (content.Rows ?? []) as Row[];

  return (
    <section {...pa(block)} className={`${SECTION_CARD} w-full bg-white px-2 pt-20 pb-28 lg:px-8 lg:pt-32 lg:pb-40`}>
      <div className="container mx-auto">
        <SplitHeading
          line1={content.HeadingLine1}
          line2={content.HeadingLine2}
          className="text-center"
          attrs1={pa('HeadingLine1')}
          attrs2={pa('HeadingLine2')}
        />
      </div>
      <div {...pa('Rows')} className="mt-16 flex flex-col gap-12 py-8 lg:gap-6">
        {rows.map((row, i) => {
          const src = refSrc(row.Image);
          // optimizely.com: 1st and 3rd rows put the text left / image right and sit further right.
          const even = i % 2 === 0;
          return (
            <article
              key={i}
              className={`mx-auto flex w-full max-w-full flex-col gap-4 px-7 lg:h-[448px] lg:max-w-7xl lg:items-center lg:gap-4 lg:px-0 ${
                even ? 'lg:flex-row-reverse lg:pr-[10.28%] lg:pl-[18.33%]' : 'lg:flex-row lg:pr-[18.33%] lg:pl-[10.28%]'
              }`}
            >
              <div className="relative aspect-square w-full overflow-hidden rounded-[16px] lg:h-full lg:w-auto lg:shrink-0">
                {src && <img src={src} alt={row.Title ?? ''} className="absolute inset-0 size-full object-cover" />}
              </div>
              <div className="flex flex-col gap-3 rounded-[16px] bg-[#eff6e9] px-8 py-10 text-[#08251a] lg:min-w-0 lg:flex-1 lg:justify-center">
                {row.Title && (
                  <h3 className="font-[family-name:var(--font-display)] text-2xl leading-[1.04] font-extrabold lg:text-[32px]">
                    {row.Title}
                  </h3>
                )}
                {row.Body && <p className="text-sm leading-[1.3] lg:text-2xl/tight">{row.Body}</p>}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
