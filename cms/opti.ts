// Shared helpers for the [WEN] optimizely.com blocks (WenHeroBanner, WenLogoStrip, ...).
// Kept as `.ts` (not `.tsx`) so the `./cms/**/*.tsx` push glob does not scan it:
// it defines no content type. JSX is written with createElement for that reason.

import { createElement, type ReactNode } from 'react';

/** Graph shape of a `contentReference` property: `{ key, url }`. */
export type OptiRef = {
  key?: string | null;
  url?: { default?: string | null; base?: string | null; graph?: string | null } | null;
} | null | undefined;

/** Graph shape of a `link` property. */
export type OptiLinkValue = {
  text?: string | null;
  title?: string | null;
  target?: string | null;
  url?: { default?: string | null; base?: string | null } | null;
} | null | undefined;

/** Absolute URL for an image/video reference (Graph returns a relative `default` plus a `base`). */
export function refSrc(ref: OptiRef): string | undefined {
  const d = ref?.url?.default ?? undefined;
  if (!d) return undefined;
  if (/^https?:\/\//i.test(d)) return d;
  const base = (ref?.url?.base ?? '').replace(/\/$/, '');
  return base ? `${base}${d.startsWith('/') ? d : `/${d}`}` : d;
}

/** Usable href from a `link` property (falls back to '#'). */
export function linkHref(link: OptiLinkValue): string {
  return link?.url?.default ?? '#';
}

/** optimizely.com colour tokens (from the live site's CSS custom properties). */
export const OPTI = {
  darkFir: '#08251a',
  midFir: '#0d3a29',
  lfGreen: '#abff44',
  lfGreen100: '#d5ffa2',
  neutral2: '#eff6e9', // --color-tertiary-2
  neutral3: '#e4f0da', // --color-primary-3
  neutral4: '#d8e4cb', // --color-tertiary-4
  ltBlue: '#91dbda',
  // Extruded headline layers, front (1) to back (5).
  extrusion: ['#abff44', '#3ab533', '#40a142', '#2e8c45', '#227d47'],
};

/** Lime pill button, as on optimizely.com ("Let's grow"). */
export const BTN_LIME =
  'inline-flex h-10 items-center justify-center gap-3 rounded-[12px] border border-[#d5ffa2] bg-[#abff44] px-4 text-sm font-medium tracking-[0.32px] text-[#08251a] transition-all hover:translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[-2px_2px_0_0_#d5ffa2] lg:h-14 lg:rounded-[20px] lg:px-6 lg:text-lg';

/** Dark fir pill button (product cards, "Take me to the platform"). */
export const BTN_DARK =
  'inline-flex h-10 items-center justify-center gap-3 rounded-[12px] border border-[#08251a] bg-[#08251a] px-4 text-sm font-medium tracking-[0.32px] text-[#eff6e9] transition-all hover:translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[-2px_2px_0_0_#197050] lg:h-14 lg:rounded-[20px] lg:px-6 lg:text-lg';

/** Section shell: optimizely.com stacks sections as rounded "cards" that overlap the one above. */
export const SECTION_CARD = 'relative -mt-6 rounded-t-[24px] lg:-mt-10 lg:rounded-t-[40px]';

/**
 * The optimizely.com extruded headline: five stacked copies of the text, each
 * offset up and to the right, outlined in Dark Fir, lime on top. The front copy
 * is the only one exposed to assistive tech.
 */
export function ExtrudedText({ text, className }: { text: string; className?: string }): ReactNode {
  const layers = [4, 3, 2, 1, 0]; // back to front
  return createElement(
    'span',
    { className: `relative inline-block ${className ?? ''}` },
    ...layers.map((i, idx) =>
      createElement(
        'span',
        {
          key: i,
          'aria-hidden': idx < layers.length - 1 ? true : undefined,
          className: `${idx === 0 ? 'relative' : 'absolute inset-0'} inline-block whitespace-pre-wrap select-none`,
          style: {
            WebkitTextStroke: `0.025em ${OPTI.darkFir}`,
            paintOrder: 'stroke fill',
            color: OPTI.extrusion[i],
            zIndex: 10 + idx,
            transform: idx === 0 ? undefined : `translate(${(0.0635 * idx).toFixed(3)}em, ${(-0.0635 * idx).toFixed(3)}em)`,
          },
        },
        text,
      ),
    ),
  );
}

/**
 * optimizely.com section heading: an optional plain first line and an extruded
 * second line ("Tools to get you" / "growing again"). `dark` sets the plain line
 * colour for dark sections.
 */
export function SplitHeading({
  line1,
  line2,
  dark = false,
  className = '',
  attrs1 = {},
  attrs2 = {},
}: {
  line1?: string | null;
  line2?: string | null;
  dark?: boolean;
  className?: string;
  attrs1?: Record<string, unknown>;
  attrs2?: Record<string, unknown>;
}): ReactNode {
  return createElement(
    'h2',
    {
      className: `w-full font-[family-name:var(--font-display)] text-[48px] leading-[0.95] font-extrabold tracking-[-0.01em] md:text-[64px] lg:text-[96px] ${className}`,
    },
    line1
      ? createElement('span', { ...attrs1, className: `block ${dark ? 'text-white' : 'text-[#08251a]'}` }, line1)
      : null,
    line2
      ? createElement('span', { ...attrs2, className: 'block pt-[0.15em]' }, createElement(ExtrudedText, { text: line2 }))
      : null,
  );
}

/**
 * Arched version of the extruded headline (the optimizely.com hero): the same five
 * stacked, offset, outlined copies, set on a curve with SVG text-on-path. The SVG is
 * hidden from assistive tech; pair it with a visually hidden copy of the text.
 */
export function ArcText({ text, id }: { text: string; id: string }): ReactNode {
  const FS = 120; // font size in viewBox units
  const layers = [4, 3, 2, 1, 0]; // back to front
  return createElement(
    'svg',
    { viewBox: '0 40 1400 360', className: 'h-auto w-full overflow-visible', 'aria-hidden': true, focusable: false },
    createElement('defs', null, createElement('path', { id, d: 'M 70 330 Q 700 40 1330 330', fill: 'none' })),
    ...layers.map((i, idx) =>
      createElement(
        'text',
        {
          key: i,
          fill: OPTI.extrusion[i],
          stroke: OPTI.darkFir,
          strokeWidth: FS * 0.05,
          strokeLinejoin: 'round',
          paintOrder: 'stroke',
          fontSize: FS,
          fontWeight: 800,
          style: { fontFamily: 'var(--font-display), sans-serif' },
          transform: idx === 0 ? undefined : `translate(${(FS * 0.0635 * idx).toFixed(2)} ${(-FS * 0.0635 * idx).toFixed(2)})`,
        },
        createElement('textPath', { href: `#${id}`, startOffset: '50%', textAnchor: 'middle' }, text),
      ),
    ),
  );
}
