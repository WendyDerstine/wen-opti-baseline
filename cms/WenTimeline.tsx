import { contentType, type ContentProps } from '@optimizely/cms-sdk';
import { getPreviewUtils } from '@optimizely/cms-sdk/react/server';
import { BTN_DARK, SECTION_CARD, linkHref, refSrc, type OptiLinkValue, type OptiRef } from './opti';

/** One step (used inline by WenTimeline, not on its own). */
export const WenTimelineStepContentType = contentType({
  key: 'WenTimelineStep',
  baseType: '_component',
  displayName: '[WEN] Timeline Step',
  description: 'Image, title and text, used inside [WEN] Timeline.',
  properties: {
    Image: { type: 'contentReference', allowedTypes: ['_image'], displayName: 'Image', sortOrder: 10 },
    Title: { type: 'string', displayName: 'Title', isLocalized: true, sortOrder: 20 },
    Body: { type: 'string', displayName: 'Text', isLocalized: true, sortOrder: 30 },
  },
});

/** "So how does agent orchestration actually work?": centred intro, then steps alternating either side of a line. */
export const WenTimelineContentType = contentType({
  key: 'WenTimeline',
  baseType: '_component',
  displayName: '[WEN] Timeline',
  description: 'Centred heading, intro and button, then step cards alternating left and right of a vertical line.',
  compositionBehaviors: ['sectionEnabled'],
  properties: {
    Heading: { type: 'string', displayName: 'Heading', isLocalized: true, sortOrder: 10 },
    Body: { type: 'string', displayName: 'Intro text', isLocalized: true, sortOrder: 20 },
    Cta: { type: 'link', displayName: 'Button', isLocalized: true, sortOrder: 30 },
    Steps: {
      type: 'array',
      displayName: 'Steps',
      sortOrder: 40,
      items: { type: 'component', contentType: WenTimelineStepContentType },
    },
  },
});

type Props = { content: ContentProps<typeof WenTimelineContentType> };
type Step = { Image?: OptiRef; Title?: string | null; Body?: string | null };

function StepCard({ step }: { step: Step }) {
  const src = refSrc(step.Image);
  return (
    <div className="flex w-full max-w-md flex-col gap-6 rounded-[16px] bg-[#eff6e9] p-2 pb-8">
      <figure className="relative aspect-video overflow-hidden rounded-[12px]">
        {src && <img src={src} alt="" className="absolute inset-0 size-full object-cover" />}
      </figure>
      <div className="flex flex-col gap-4 px-2 md:px-4">
        {step.Title && (
          <h3 className="font-[family-name:var(--font-display)] text-2xl leading-tight font-extrabold text-[#08251a] lg:text-[32px]">
            {step.Title}
          </h3>
        )}
        {step.Body && <p className="text-base leading-snug text-[#08251a] lg:text-lg">{step.Body}</p>}
      </div>
    </div>
  );
}

export default function WenTimeline({ content }: Props) {
  const { pa } = getPreviewUtils(content);
  const block = (content as { __composition?: { key: string } }).__composition;
  const cta = content.Cta as OptiLinkValue;
  const steps = (content.Steps ?? []) as Step[];

  return (
    <section {...pa(block)} className={`${SECTION_CARD} w-full bg-white px-2 pt-20 pb-28 lg:px-8 lg:pt-32 lg:pb-40`}>
      <div className="container mx-auto">
        <div className="mx-auto mb-8 flex max-w-2xl flex-col items-center gap-8 py-8 text-center">
          {content.Heading && (
            <h2
              {...pa('Heading')}
              className="font-[family-name:var(--font-display)] text-[44px] leading-[0.9] font-extrabold tracking-[-0.01em] text-[#08251a] md:text-[56px] lg:text-[64px]"
            >
              {content.Heading}
            </h2>
          )}
          {content.Body && (
            <p {...pa('Body')} className="text-lg leading-snug text-[#08251a] lg:text-xl">
              {content.Body}
            </p>
          )}
          {cta?.text && (
            <a {...pa('Cta')} href={linkHref(cta)} target={cta.target ?? undefined} className={BTN_DARK}>
              {cta.text}
            </a>
          )}
        </div>
        <ol {...pa('Steps')} className="relative mx-auto flex max-w-5xl flex-col gap-10 lg:gap-0">
          {/* Vertical line: left edge on mobile, centre on desktop. */}
          <span aria-hidden className="absolute top-4 bottom-4 left-[11px] w-[3px] bg-[#d8e4cb] lg:left-1/2 lg:-translate-x-1/2" />
          {steps.map((s, i) => {
            const left = i % 2 === 0;
            return (
              <li key={i} className="relative grid grid-cols-[24px_1fr] items-center gap-x-4 lg:grid-cols-[1fr_96px_1fr] lg:gap-x-0">
                <div className={`hidden lg:flex lg:justify-end ${left ? '' : 'lg:invisible'}`}>{left && <StepCard step={s} />}</div>
                <div className="relative z-10 flex items-center justify-center">
                  <span
                    className={`size-4 rounded-full outline-[3px] outline-[#c3ceaf] ${i === 0 ? 'bg-[#abff44] outline-[#08251a]' : 'bg-[#d8e4cb]'}`}
                  />
                </div>
                <div className="lg:flex lg:justify-start">
                  <div className="lg:hidden">
                    <StepCard step={s} />
                  </div>
                  <div className="hidden lg:block lg:w-full">{!left && <StepCard step={s} />}</div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
