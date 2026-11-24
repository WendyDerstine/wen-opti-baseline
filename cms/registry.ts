import {
  config,
  initContentTypeRegistry,
  initDisplayTemplateRegistry,
  BlankExperienceContentType,
  BlankSectionContentType,
} from '@optimizely/cms-sdk';
import { initReactComponentRegistry } from '@optimizely/cms-sdk/react/server';
import { requireEnv } from '@/lib/env';

import BlankExperience from './BlankExperience';
import BlankSection from './BlankSection';
import Page, { PageContentType } from './Page';
import RichText, { RichTextContentType } from './RichText';
// [WEN] optimizely.com home page blocks
import WenHeroBanner, { WenHeroBannerContentType } from './WenHeroBanner';
import WenLogoStrip, { WenLogoStripContentType, WenLogoItemContentType } from './WenLogoStrip';
import WenProductCards, { WenProductCardsContentType, WenProductCardContentType } from './WenProductCards';
import WenVideoFeature, { WenVideoFeatureContentType } from './WenVideoFeature';
import WenMediaMarquee, { WenMediaMarqueeContentType } from './WenMediaMarquee';
import WenZigzag, { WenZigzagContentType, WenZigzagRowContentType } from './WenZigzag';
import WenStoryCarousel, { WenStoryCarouselContentType, WenStoryCardContentType } from './WenStoryCarousel';
import WenImageBanner, { WenImageBannerContentType } from './WenImageBanner';
import WenSignupForm, { WenSignupFormContentType } from './WenSignupForm';

/**
 * Single configuration + registration point for the Optimizely SDK.
 * Imported for side effects by app/layout.tsx.
 *
 * Named registry.ts (not .tsx) so the optimizely.config.mjs `./cms/**\/*.tsx`
 * glob does not pick it up during `opti-cli config push` — only the files that
 * define content types should be scanned.
 *
 * To add a new content type:
 *   1. Define it in a cms/<Name>.tsx file (export the contentType() + a default
 *      React component, plus any display template).
 *   2. Import it here and register it in the three calls below:
 *        - initContentTypeRegistry      → the contentType() definition
 *        - initDisplayTemplateRegistry  → any display template(s)
 *        - initReactComponentRegistry   → map the content type key → component
 *   3. Run `npm run config:push` to push the type(s) to the CMS.
 */
const env = requireEnv();

config({
  apiKey: env.OPTIMIZELY_GRAPH_SINGLE_KEY,
  graphUrl: env.OPTIMIZELY_GRAPH_GATEWAY,
});

/**
 * The content types this app defines and pushes to the CMS. Exported so other
 * surfaces (e.g. the /admin inspector) can read the same source of truth that's
 * registered with the SDK below.
 */
export const registeredContentTypes = [
  // SDK-native types the CMS can send (e.g. during preview).
  BlankExperienceContentType,
  BlankSectionContentType,
  PageContentType,
  // Blocks
  RichTextContentType,
  // [WEN] optimizely.com home page blocks (sections) and their inline item types
  WenHeroBannerContentType,
  WenLogoStripContentType,
  WenLogoItemContentType,
  WenProductCardsContentType,
  WenProductCardContentType,
  WenVideoFeatureContentType,
  WenMediaMarqueeContentType,
  WenZigzagContentType,
  WenZigzagRowContentType,
  WenStoryCarouselContentType,
  WenStoryCardContentType,
  WenImageBannerContentType,
  WenSignupFormContentType,
];

initContentTypeRegistry(registeredContentTypes);

initDisplayTemplateRegistry([]);

initReactComponentRegistry({
  resolver: {
    BlankExperience,
    BlankSection,
    Page,
    // Blocks (resolver key === content-type key)
    RichTextBlock: RichText,
    WenHeroBanner,
    WenLogoStrip,
    WenProductCards,
    WenVideoFeature,
    WenMediaMarquee,
    WenZigzag,
    WenStoryCarousel,
    WenImageBanner,
    WenSignupForm,
  },
});
