import { contentType, type ContentProps } from '@optimizely/cms-sdk';
import { getPreviewUtils } from '@optimizely/cms-sdk/react/server';
import { BTN_LIME, SplitHeading, linkHref, refSrc, type OptiLinkValue, type OptiRef } from './opti';

/**
 * Product page hero (optimizely.com/products/ai): breadcrumb pills, a two-line
 * heading on the left (plain + extruded), intro text and a button on the right,
 * and a full-width video below.
 */
export const WenSplitHeroContentType = contentType({
  key: 'WenSplitHero',
  baseType: '_component',
  displayName: '[WEN] Split Hero',
  description: 'Breadcrumbs, two-line heading left, intro text and button right, video below.',
  compositionBehaviors: ['sectionEnabled'],
  properties: {
    Breadcrumbs: {
      type: 'array',
      displayName: 'Breadcrumbs',
      description: 'Shown as pills above the heading. The last one is the current page (no link needed).',
      sortOrder: 5,
      items: { type: 'link' },
    },
    HeadingLine1: { type: 'string', displayName: 'Heading line 1', isLocalized: true, sortOrder: 10 },
    HeadingLine2: { type: 'string', displayName: 'Heading line 2 (extruded)', isLocalized: true, sortOrder: 20 },
    Body: {
      type: 'string',
      displayName: 'Intro text',
      description: 'A line break starts a new paragraph.',
      isLocalized: true,
      sortOrder: 30,
    },
    Cta: { type: 'link', displayName: 'Button', isLocalized: true, sortOrder: 40 },
    Video: { type: 'contentReference', allowedTypes: ['_video'], displayName: 'Video', sortOrder: 50 },
  },
});

type Props = { content: ContentProps<typeof WenSplitHeroContentType> };

export default function WenSplitHero({ content }: Props) {
  const { pa } = getPreviewUtils(content);
  const block = (content as { __composition?: { key: string } }).__composition;
  const crumbs = (content.Breadcrumbs ?? []) as OptiLinkValue[];
  const cta = content.Cta as OptiLinkValue;
  const video = refSrc(content.Video as OptiRef);
  const paragraphs = (content.Body ?? '').split(/\n+/).map((p) => p.trim()).filter(Boolean);

  return (
    <section {...pa(block)} className="relative w-full bg-white px-7 pt-20">
      <div className="container mx-auto">
        {crumbs.length > 0 && (
          <nav {...pa('Breadcrumbs')} aria-label="Breadcrumb" className="mt-8 lg:mt-12">
            <ol className="flex flex-wrap items-center gap-1 text-[#08251a]">
              {crumbs.map((c, i) => {
                const last = i === crumbs.length - 1;
                const pill =
                  'inline-flex items-center justify-center rounded-[6px] border border-[#d8e4cb] bg-[#e4f0da] px-2.5 py-1 text-xs leading-[1.2] tracking-[0.3px] uppercase';
                return (
                  <li key={i} className="flex items-center gap-1">
                    {i > 0 && (
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                        <path d="m9 6 6 6-6 6" />
                      </svg>
                    )}
                    {last || !c?.url?.default ? (
                      <span aria-current={last ? 'page' : undefined} className={pill}>
                        {c?.text}
                      </span>
                    ) : (
                      <a href={linkHref(c)} className={pill}>
                        {c?.text}
                      </a>
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>
        )}
        <div className="mt-8 grid grid-cols-12 items-center gap-x-4 gap-y-8 lg:mt-12">
          <div className="col-span-full md:col-span-7">
            <SplitHeading
              line1={content.HeadingLine1}
              line2={content.HeadingLine2}
              className="text-left lg:text-[72px] xl:text-[80px]"
              attrs1={pa('HeadingLine1')}
              attrs2={pa('HeadingLine2')}
            />
          </div>
          <div className="col-span-10 md:col-span-4 md:col-start-9">
            <div {...pa('Body')} className="flex flex-col gap-3 text-lg leading-snug text-[#08251a]">
              {paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
            {cta?.text && (
              <a {...pa('Cta')} href={linkHref(cta)} target={cta.target ?? undefined} className={`mt-6 ${BTN_LIME}`}>
                {cta.text}
              </a>
            )}
          </div>
        </div>
        {video && (
          <figure {...pa('Video')} className="mt-12 lg:mt-16">
            <video src={video} autoPlay loop muted playsInline className="h-auto w-full rounded-[12px] lg:rounded-3xl" />
          </figure>
        )}
      </div>
    </section>
  );
}
