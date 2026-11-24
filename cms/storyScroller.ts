'use client';

// Client-side scroller with prev/next arrows for [WEN] Story Carousel.
// Kept as `.ts` (not `.tsx`) so the `./cms/**/*.tsx` push glob does not scan it.

import { createElement, type MouseEvent, type ReactNode } from 'react';

function Arrow({ dir }: { dir: 'prev' | 'next' }) {
  // Find this carousel's track from the clicked button (no ref needed).
  const onClick = (e: MouseEvent<HTMLButtonElement>) => {
    const track = e.currentTarget.closest('[data-story-root]')?.querySelector<HTMLElement>('[data-story-track]');
    if (!track) return;
    const card = track.querySelector<HTMLElement>('[data-story-card]');
    const width = card ? card.offsetWidth + 24 : track.clientWidth * 0.8;
    track.scrollBy({ left: (dir === 'next' ? 1 : -1) * width, behavior: 'smooth' });
  };
  return createElement(
    'button',
    {
      type: 'button',
      onClick,
      'aria-label': dir === 'prev' ? 'Previous story' : 'Next story',
      className:
        'flex size-10 items-center justify-center rounded-full border border-[#d5ffa2] bg-[#abff44] text-[#08251a] transition-all hover:translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[-2px_2px_0_0_#d5ffa2]',
    },
    createElement(
      'svg',
      { viewBox: '0 0 24 24', width: 20, height: 20, fill: 'none', stroke: 'currentColor', strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
      createElement('path', { d: dir === 'prev' ? 'M19 12H5m6-6-6 6 6 6' : 'M5 12h14m-6-6 6 6-6 6' }),
    ),
  );
}

export function StoryScroller({ children }: { children: ReactNode }) {
  return createElement(
    'div',
    { 'data-story-root': '', className: 'flex flex-col items-center gap-10' },
    createElement(
      'div',
      {
        'data-story-track': '',
        className:
          'flex w-full snap-x snap-mandatory gap-6 overflow-x-auto scroll-smooth px-4 py-2 [scrollbar-width:none] lg:px-[max(1rem,calc((100vw-892px)/2))] [&::-webkit-scrollbar]:hidden',
      },
      children,
    ),
    createElement('div', { className: 'flex gap-3' }, createElement(Arrow, { dir: 'prev' }), createElement(Arrow, { dir: 'next' })),
  );
}
