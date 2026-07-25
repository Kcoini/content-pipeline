// Phase 2-4: SEO plugin을 사용하지 않는 경우의 mapper.
// WordPress 기본 post title/excerpt/slug만 사용하고, plugin 전용 meta는 만들지 않는다.

import type { SeoPluginMapperInput, SeoPluginPayload } from "../seo-plugin-types";
import { buildBasePayload } from "./shared";

export function mapNonePayload(input: SeoPluginMapperInput): SeoPluginPayload {
  return {
    ...buildBasePayload(input),
    provider: "none",
    // SEO plugin이 없으므로 write 대상 post meta 후보 자체가 없다.
    rawPluginMeta: {},
  };
}
