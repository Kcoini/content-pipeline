// Phase 2-4: plugin mapper 공통 필드 계산.
// provider와 무관하게 동일한 seoTitle/metaDescription/OG/Twitter/canonical/
// schemaType 값을 사용하고, provider별 mapper는 rawPluginMeta만 다르게 채운다.

import type { SeoPluginMapperInput, SeoPluginPayload } from "../seo-plugin-types";

export function buildBasePayload(
  input: SeoPluginMapperInput
): Omit<SeoPluginPayload, "provider" | "rawPluginMeta" | "writeMode"> {
  return {
    seoTitle: input.seoTitle,
    metaDescription: input.metaDescription,
    focusKeyword: input.targetKeyword,
    secondaryKeywords: input.secondaryKeywords,
    canonicalUrl: input.canonicalUrl,
    ogTitle: input.seoTitle,
    ogDescription: input.metaDescription,
    twitterTitle: input.seoTitle,
    twitterDescription: input.metaDescription,
    schemaType: input.schemaType,
  };
}
