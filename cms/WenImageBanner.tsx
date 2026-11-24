import { contentType, type ContentProps } from '@optimizely/cms-sdk';
import { getPreviewUtils } from '@optimizely/cms-sdk/react/server';
import { BTN_LIME, ExtrudedText, SECTION_CARD, linkHref, refSrc, type OptiLinkValue, type OptiRef } from './opti';

/**
 * "Slots straight into your existing stack": full-bleed background image, an
 * extruded headline at the top, text bottom-left and a lime button bottom-right.
 */
export const WenImageBannerContentType = contentType({
  key: 'WenImageBanner',
  baseType: '_component',
  displayName: '[WEN] Image Banner',
  description: 'Tall full-bleed image with an extruded headline, text bottom-left and a button bottom-right.',
  compositionBehaviors: ['sectionEnabled'],
  properties: {
    BackgroundImage: {
      type: 'contentReference',
      allowedTypes: ['_image'],
      displayName: 'Background image',
      sortOrder: 10,
    },
    Heading: { type: 'string', displayName: 'Heading (extruded)', isLocalized: true, sortOrder: 20 },
    Body: { type: 'string', displayName: 'Text', isLocalized: true, sortOrder: 30 },
    Cta: { type: 'link', displayName: 'Button', isLocalized: true, sortOrder: 40 },
  },
});

type Props = { content: ContentProps<typeof WenImageBannerContentType> };

export default function WenImageBanner({ content }: Props) {
  const { pa } = getPreviewUtils(content);
  const block = (content as { __composition?: { key: string } }).__composition;
  const bg = refSrc(content.BackgroundImage as OptiRef);
  const cta = content.Cta as OptiLinkValue;

  return (
    <section
      {...pa(block)}
      className={`${SECTION_CARD} flex min-h-[90vh] w-full flex-col overflow-hidden bg-[#91dbda] px-2 pt-4 pb-16 lg:px-8 lg:pt-8 lg:pb-32`}
    >
      {bg && (
        <img
          {...pa('BackgroundImage')}
          src={bg}
          alt=""
          className="pointer-events-none absolute inset-0 size-full object-cover object-center"
        />
      )}
      <div className="relative z-10 flex w-full grow flex-col justify-between">
        {content.Heading && (
          <h2
            {...pa('Heading')}
            className="mx-auto max-w-3xl pt-16 text-center font-[family-name:var(--font-display)] text-[40px] leading-none font-extrabold tracking-[-0.01em] md:text-[56px] lg:text-[64px]"
          >
            <ExtrudedText text={content.Heading} />
          </h2>
        )}
        <div className="mt-16 flex flex-col items-center gap-8 text-center md:flex-row md:items-end md:justify-between md:text-left">
          {content.Body && (
            <p
              {...pa('Body')}
              className="max-w-sm text-xl leading-snug font-semibold text-[#abff44]"
              style={{ WebkitTextStroke: '0.6px #08251a', paintOrder: 'stroke fill' }}
            >
              {content.Body}
            </p>
          )}
          {cta?.text && (
            <a {...pa('Cta')} href={linkHref(cta)} target={cta.target ?? undefined} className={BTN_LIME}>
              {cta.text}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
