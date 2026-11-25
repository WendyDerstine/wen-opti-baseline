import { contentType, type ContentProps } from '@optimizely/cms-sdk';
import { getPreviewUtils } from '@optimizely/cms-sdk/react/server';
import { RichText as RichTextRenderer } from '@optimizely/cms-sdk/react/richText';
import { SECTION_CARD } from './opti';

/** One question (used inline by WenFaq, not on its own). */
export const WenFaqItemContentType = contentType({
  key: 'WenFaqItem',
  baseType: '_component',
  displayName: '[WEN] FAQ Item',
  description: 'A question and its rich-text answer, used inside [WEN] FAQ.',
  properties: {
    Question: { type: 'string', displayName: 'Question', isLocalized: true, sortOrder: 10 },
    Answer: { type: 'richText', displayName: 'Answer', isLocalized: true, sortOrder: 20 },
  },
});

/** "Questions you might have": centred heading over an accordion of questions. */
export const WenFaqContentType = contentType({
  key: 'WenFaq',
  baseType: '_component',
  displayName: '[WEN] FAQ',
  description: 'Centred heading over an expandable list of questions and answers.',
  compositionBehaviors: ['sectionEnabled'],
  properties: {
    Heading: { type: 'string', displayName: 'Heading', isLocalized: true, sortOrder: 10 },
    ItemStyle: {
      type: 'string',
      displayName: 'Question style',
      sortOrder: 15,
      enum: [
        { value: 'filled', displayName: 'Green boxes (default)' },
        { value: 'plain', displayName: 'Plain (no box)' },
      ],
    },
    Items: {
      type: 'array',
      displayName: 'Questions',
      sortOrder: 20,
      items: { type: 'component', contentType: WenFaqItemContentType },
    },
  },
});

type Props = { content: ContentProps<typeof WenFaqContentType> };
type Item = { Question?: string | null; Answer?: { json?: unknown } | null };

export default function WenFaq({ content }: Props) {
  const { pa } = getPreviewUtils(content);
  const block = (content as { __composition?: { key: string } }).__composition;
  const items = (content.Items ?? []) as Item[];

  return (
    <section {...pa(block)} className={`${SECTION_CARD} w-full bg-white px-2 pt-20 pb-28 lg:pt-32 lg:pb-40`}>
      <div className="container mx-auto">
        {content.Heading && (
          <h2
            {...pa('Heading')}
            className="mb-4 text-center font-[family-name:var(--font-display)] text-[44px] leading-[0.9] font-extrabold tracking-[-0.01em] text-[#08251a] md:mb-8 md:text-[56px] lg:mb-28 lg:text-[64px]"
          >
            {content.Heading}
          </h2>
        )}
        <div {...pa('Items')} className="mx-auto flex max-w-4xl flex-col gap-4">
          {items.map((it, i) => (
            <details key={i} className={`group overflow-clip rounded-2xl ${content.ItemStyle === 'plain' ? 'bg-white' : 'bg-[#eff6e9]'}`}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-8 px-8 py-6 text-base leading-tight font-medium text-[#08251a] md:text-xl [&::-webkit-details-marker]:hidden">
                <h3 className="font-sans">{it.Question}</h3>
                <svg
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden
                  className="shrink-0 transition-transform duration-300 group-open:rotate-180"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </summary>
              {it.Answer?.json != null && (
                <div className="prose max-w-none px-8 pb-8 text-base leading-tight text-[#08251a] prose-a:text-[#08251a] prose-strong:text-[#08251a] md:text-lg">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <RichTextRenderer content={it.Answer.json as any} />
                </div>
              )}
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
