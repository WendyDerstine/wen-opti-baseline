import { contentType, type ContentProps } from '@optimizely/cms-sdk';
import { getPreviewUtils } from '@optimizely/cms-sdk/react/server';
import { SECTION_CARD, linkHref, type OptiLinkValue } from './opti';

/** One feature (used inline by WenFeatureGrid, not on its own). */
export const WenFeatureGridItemContentType = contentType({
  key: 'WenFeatureGridItem',
  baseType: '_component',
  displayName: '[WEN] Feature Grid Item',
  description: 'Icon, title, text and an optional link, used inside [WEN] Feature Grid.',
  properties: {
    Icon: {
      type: 'string',
      displayName: 'Icon',
      description: 'Material Symbols icon name, e.g. rocket_launch, edit, check, build (fonts.google.com/icons).',
      sortOrder: 10,
    },
    Title: { type: 'string', displayName: 'Title', isLocalized: true, sortOrder: 20 },
    Body: { type: 'string', displayName: 'Text', isLocalized: true, sortOrder: 30 },
    Link: { type: 'link', displayName: 'Link (optional, shown after the text)', isLocalized: true, sortOrder: 40 },
  },
});

/** "Everything you need to bring your AI strategy to life.": heading and intro over a 3-column icon grid. */
export const WenFeatureGridContentType = contentType({
  key: 'WenFeatureGrid',
  baseType: '_component',
  displayName: '[WEN] Feature Grid',
  description: 'Left-aligned heading and intro over a three-column grid of icon features.',
  compositionBehaviors: ['sectionEnabled'],
  properties: {
    Heading: { type: 'string', displayName: 'Heading', isLocalized: true, sortOrder: 10 },
    Body: { type: 'string', displayName: 'Intro text', isLocalized: true, sortOrder: 20 },
    Items: {
      type: 'array',
      displayName: 'Features',
      sortOrder: 30,
      items: { type: 'component', contentType: WenFeatureGridItemContentType },
    },
  },
});

type Props = { content: ContentProps<typeof WenFeatureGridContentType> };
type Item = { Icon?: string | null; Title?: string | null; Body?: string | null; Link?: OptiLinkValue };

const ICON_FONT =
  'https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,1,0&display=block';

export default function WenFeatureGrid({ content }: Props) {
  const { pa } = getPreviewUtils(content);
  const block = (content as { __composition?: { key: string } }).__composition;
  const items = (content.Items ?? []) as Item[];

  return (
    <section {...pa(block)} className={`${SECTION_CARD} w-full bg-[#eff6e9] px-7 pt-20 pb-28 lg:pt-32 lg:pb-40`}>
      {/* React hoists this stylesheet into <head> once. */}
      <link rel="stylesheet" href={ICON_FONT} precedence="default" />
      <div className="container mx-auto">
        <div className="max-w-3xl lg:max-w-[58%]">
          {content.Heading && (
            <h2
              {...pa('Heading')}
              className="font-[family-name:var(--font-display)] text-[44px] leading-[0.9] font-extrabold tracking-[-0.01em] text-[#08251a] md:text-[56px] lg:text-[64px]"
            >
              {content.Heading}
            </h2>
          )}
          {content.Body && (
            <p {...pa('Body')} className="mt-8 text-lg leading-snug text-[#08251a] lg:max-w-[70%]">
              {content.Body}
            </p>
          )}
        </div>
        <div {...pa('Items')} className="mt-8 grid grid-cols-1 gap-x-8 gap-y-12 md:mt-12 md:grid-cols-2 lg:mt-8 lg:grid-cols-3">
          {items.map((it, i) => (
            <div key={i} className="flex flex-col gap-4">
              {it.Icon && (
                <span className="inline-flex size-10 items-center justify-center rounded-[8px] border border-[#08251a]/20 bg-[#91dbda] text-[#08251a]">
                  <span aria-hidden className="text-[22px] leading-none" style={{ fontFamily: '"Material Symbols Rounded"' }}>
                    {it.Icon}
                  </span>
                </span>
              )}
              {it.Title && (
                <h3 className="mb-2 font-[family-name:var(--font-display)] text-2xl leading-none font-extrabold text-[#08251a] lg:text-[30px]">
                  {it.Title}
                </h3>
              )}
              {it.Body && (
                <p className="text-lg leading-snug text-[#08251a]">
                  {it.Body}
                  {it.Link?.text && (
                    <>
                      {' '}
                      <a href={linkHref(it.Link)} className="font-medium underline underline-offset-2">
                        {it.Link.text}
                      </a>
                    </>
                  )}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
