// Phase 2-4: All in One SEO(AIOSEO)용 metadata payload mapper.
//
// 주의: 실제 AIOSEO write는 이번 단계에서 구현하지 않는다. AIOSEO는 버전과
// 설정에 따라 저장 구조(post meta vs 전용 테이블)가 다를 수 있으므로, 이번
// 단계에서는 mapping payload 준비만 한다.

import type { SeoPluginMapperInput, SeoPluginPayload } from "../seo-plugin-types";
import { buildBasePayload } from "./shared";

export function mapAioseoPayload(input: SeoPluginMapperInput): SeoPluginPayload {
  return {
    ...buildBasePayload(input),
    provider: "aioseo",
    rawPluginMeta: {
      _aioseo_title: input.seoTitle,
      _aioseo_description: input.metaDescription,
      _aioseo_keywords: [input.targetKeyword, ...input.secondaryKeywords].filter(Boolean).join(", "),
    },
    writeMode: "prepared_only",
  };
}
