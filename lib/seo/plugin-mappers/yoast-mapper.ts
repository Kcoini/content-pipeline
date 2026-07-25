// Phase 2-4: Yoast SEO용 metadata payload mapper.
//
// 주의: 실제 Yoast REST write는 이번 단계에서 구현하지 않는다. Yoast는 REST 응답에
// yoast_head/yoast_head_json을 제공할 수 있지만, 외부에서 title/description을
// "쓰는" 방식은 사이트 설정과 meta field 노출 여부(register_meta, REST API 노출)에
// 따라 다르다. 따라서 여기서는 잠재적 post meta key 후보만 rawPluginMeta에 저장하고,
// 실제 write는 커스텀 endpoint 또는 meta field 노출을 확인한 뒤 구현한다.

import type { SeoPluginMapperInput, SeoPluginPayload } from "../seo-plugin-types";
import { buildBasePayload } from "./shared";

export function mapYoastPayload(input: SeoPluginMapperInput): SeoPluginPayload {
  return {
    ...buildBasePayload(input),
    provider: "yoast",
    rawPluginMeta: {
      _yoast_wpseo_title: input.seoTitle,
      _yoast_wpseo_metadesc: input.metaDescription,
      _yoast_wpseo_focuskw: input.targetKeyword ?? "",
    },
    writeMode: "prepared_only",
  };
}
