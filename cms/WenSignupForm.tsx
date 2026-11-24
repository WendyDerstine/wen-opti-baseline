import { contentType, type ContentProps } from '@optimizely/cms-sdk';
import { getPreviewUtils } from '@optimizely/cms-sdk/react/server';
import { BTN_LIME, SECTION_CARD, linkHref, refSrc, type OptiLinkValue, type OptiRef } from './opti';

/**
 * "Let's grow": mid fir card with an illustration on the left and a heading,
 * intro text and a get-started form on the right. The form sends visitors to
 * the button link (it does not post data anywhere).
 */
export const WenSignupFormContentType = contentType({
  key: 'WenSignupForm',
  baseType: '_component',
  displayName: '[WEN] Signup Form',
  description: 'Dark card: image left; heading, intro text and a get-started form right.',
  compositionBehaviors: ['sectionEnabled'],
  properties: {
    Image: { type: 'contentReference', allowedTypes: ['_image'], displayName: 'Image', sortOrder: 10 },
    Heading: { type: 'string', displayName: 'Heading', isLocalized: true, sortOrder: 20 },
    Body: { type: 'string', displayName: 'Intro text', isLocalized: true, sortOrder: 30 },
    Cta: {
      type: 'link',
      displayName: 'Submit button',
      description: 'Button text, and the page the form opens on submit.',
      isLocalized: true,
      sortOrder: 40,
    },
  },
});

type Props = { content: ContentProps<typeof WenSignupFormContentType> };

// Placeholders as rendered on optimizely.com.
const FIELDS: { name: string; type: string; placeholder: string; label: string }[] = [
  { name: 'firstName', type: 'text', placeholder: 'John', label: 'First name' },
  { name: 'lastName', type: 'text', placeholder: 'Doe', label: 'Last name' },
  { name: 'email', type: 'email', placeholder: 'john.doe@optimizely.com', label: 'Email' },
  { name: 'company', type: 'text', placeholder: 'Optimizely', label: 'Company' },
  { name: 'title', type: 'text', placeholder: 'Chief Executive Officer', label: 'Job title' },
  { name: 'phone', type: 'tel', placeholder: '+1 234 567 8901', label: 'Phone' },
];

const INPUT =
  'h-12 w-full rounded-[12px] border border-[#197050] bg-white px-4 text-sm text-[#08251a] placeholder:text-[#717863] focus:outline-2 focus:outline-[#91dbda]';

export default function WenSignupForm({ content }: Props) {
  const { pa } = getPreviewUtils(content);
  const block = (content as { __composition?: { key: string } }).__composition;
  const img = refSrc(content.Image as OptiRef);
  const cta = content.Cta as OptiLinkValue;

  return (
    <section {...pa(block)} className={`${SECTION_CARD} w-full bg-white px-2 pt-20 pb-10 lg:px-8 lg:pt-32 lg:pb-24`}>
      <div className="container mx-auto">
        <div className="flex flex-col gap-2 rounded-[16px] bg-[#0d3a29] text-white lg:flex-row lg:rounded-[24px]">
          <div className="flex flex-1 flex-col self-stretch rounded-[12px] p-2 lg:rounded-[16px] lg:p-4">
            {img && (
              <figure className="h-full overflow-hidden rounded-[12px] lg:rounded-[16px]">
                <img {...pa('Image')} src={img} alt="" className="size-full object-cover" />
              </figure>
            )}
          </div>
          <div className="flex flex-1 flex-col gap-2 p-6 lg:p-8">
            {content.Heading && (
              <h2
                {...pa('Heading')}
                className="font-[family-name:var(--font-display)] text-[48px] leading-[0.9] font-extrabold tracking-[-0.01em] text-white lg:text-[64px]"
              >
                {content.Heading}
              </h2>
            )}
            {content.Body && (
              <p {...pa('Body')} className="pb-6 text-lg text-white lg:pr-12 lg:pb-8">
                {content.Body}
              </p>
            )}
            <form action={linkHref(cta)} method="get" className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {FIELDS.map((f) => (
                <input key={f.name} name={f.name} type={f.type} placeholder={f.placeholder} aria-label={f.label} className={INPUT} />
              ))}
              <select name="country" aria-label="Country" defaultValue="" className={`${INPUT} md:col-span-2`}>
                <option value="" disabled>
                  Country
                </option>
                <option>United States</option>
                <option>United Kingdom</option>
                <option>Canada</option>
                <option>Germany</option>
                <option>Australia</option>
              </select>
              {cta?.text && (
                <div className="pt-4 md:col-span-2">
                  <button {...pa('Cta')} type="submit" className={BTN_LIME}>
                    {cta.text}
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
