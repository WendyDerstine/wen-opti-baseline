import { contentType, type ContentProps } from '@optimizely/cms-sdk';
import { getPreviewUtils } from '@optimizely/cms-sdk/react/server';
import { RichText as RichTextRenderer } from '@optimizely/cms-sdk/react/richText';
import { linkHref, refSrc, type OptiLinkValue, type OptiRef } from './opti';

/**
 * "Trust us on this": a rounded coloured panel inside the page margins, with an
 * illustration filling it and a centred heading, rich text and a text link on top.
 */
export const WenCalloutPanelContentType = contentType({
  key: 'WenCalloutPanel',
  baseType: '_component',
  displayName: '[WEN] Callout Panel',
  description: 'Rounded coloured panel with a background illustration and centred heading, text and link.',
  compositionBehaviors: ['sectionEnabled'],
  properties: {
    Color: {
      type: 'string',
      displayName: 'Panel colour',
      sortOrder: 5,
      enum: [
        { value: 'pink', displayName: 'Pink' },
        { value: 'blue', displayName: 'Light blue' },
        { value: 'green', displayName: 'Light green' },
      ],
    },
    BackgroundImage: {
      type: 'contentReference',
      allowedTypes: ['_image'],
      displayName: 'Background illustration',
      sortOrder: 10,
    },
    Heading: { type: 'string', displayName: 'Heading', isLocalized: true, sortOrder: 20 },
    Body: { type: 'richText', displayName: 'Text', isLocalized: true, sortOrder: 30 },
    Cta: { type: 'link', displayName: 'Link', isLocalized: true, sortOrder: 40 },
  },
});

type Props = { content: ContentProps<typeof WenCalloutPanelContentType> };

const COLORS: Record<string, string> = { pink: '#ff99b6', blue: '#91dbda', green: '#e4f0da' };

export default function WenCalloutPanel({ content }: Props) {
  const { pa } = getPreviewUtils(content);
  const block = (content as { __composition?: { key: string } }).__composition;
  const bg = refSrc(content.BackgroundImage as OptiRef);
  const cta = content.Cta as OptiLinkValue;
  const body = content.Body as { json?: unknown } | null | undefined;

  return (
    <section {...pa(block)} className="w-full bg-white px-2 pb-24 lg:px-8 lg:pb-32">
      <div className="container mx-auto">
        <div
          className="relative flex min-h-[640px] w-full flex-col overflow-hidden rounded-[16px] px-2 lg:aspect-[1376/929] lg:min-h-0 lg:rounded-[24px] lg:px-8"
          style={{ backgroundColor: COLORS[content.Color ?? 'pink'] ?? COLORS.pink }}
        >
          {bg && (
            <img
              {...pa('BackgroundImage')}
              src={bg}
              alt=""
              className="pointer-events-none absolute inset-0 size-full object-cover object-bottom"
            />
          )}
          <div className="relative z-10 mx-auto flex w-full max-w-xl flex-col items-center px-4 pt-12 pb-[45%] text-center lg:pt-32 lg:pb-0">
            {content.Heading && (
              <h2
                {...pa('Heading')}
                className="mb-8 font-[family-name:var(--font-display)] text-[44px] leading-[0.9] font-extrabold tracking-[-0.01em] text-[#08251a] md:text-[56px] lg:text-[64px]"
              >
                {content.Heading}
              </h2>
            )}
            {body?.json != null && (
              <div {...pa('Body')} className="prose max-w-none text-lg leading-snug text-[#08251a] prose-p:my-4 prose-strong:text-[#08251a]">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <RichTextRenderer content={body.json as any} />
              </div>
            )}
            {cta?.text && (
              <a
                {...pa('Cta')}
                href={linkHref(cta)}
                target={cta.target ?? undefined}
                className="mt-6 inline-flex h-10 items-center px-4 text-base font-medium text-[#08251a] hover:underline lg:h-14"
              >
                {cta.text}
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
