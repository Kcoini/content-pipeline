// Phase 2-4: Rank Math SEO용 metadata payload mapper.
//
// 주의: 실제 Rank Math write는 이번 단계에서 구현하지 않는다. Rank Math의
// metadata 저장 방식은 사이트/플러그인 설정에 따라 post meta 또는 전용 저장
// 방식이 다를 수 있다. 따라서 잠재적 key 후보만 rawPluginMeta에 저장하고,
// 실제 write는 나중에 확인 후 구현한다.

import type { SeoPluginMapperInput, SeoPluginPayload } from "../seo-plugin-types";
import { buildBasePayload } from "./shared";

export function mapRankMathPayload(input: SeoPluginMapperInput): SeoPluginPayload {
  return {
    ...buildBasePayload(input),
    provider: "rank_math",
    rawPluginMeta: {
      rank_math_title: input.seoTitle,
      rank_math_description: input.metaDescription,
      rank_math_focus_keyword: input.targetKeyword ?? "",
    },
    writeMode: "prepared_only",
  };
}
