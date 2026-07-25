// Phase 2-4: provider별 mapper 선택 진입점.

import type { SeoPluginMapperInput, SeoPluginPayload, SeoPluginProvider } from "../seo-plugin-types";
import { mapNonePayload } from "./none-mapper";
import { mapYoastPayload } from "./yoast-mapper";
import { mapRankMathPayload } from "./rank-math-mapper";
import { mapAioseoPayload } from "./aioseo-mapper";

export { mapNonePayload, mapYoastPayload, mapRankMathPayload, mapAioseoPayload };

/** provider에 맞는 mapper를 선택해 article metadata를 SEO plugin payload로 변환한다. */
export function mapSeoPluginPayload(
  provider: SeoPluginProvider,
  input: SeoPluginMapperInput
): SeoPluginPayload {
  switch (provider) {
    case "yoast":
      return mapYoastPayload(input);
    case "rank_math":
      return mapRankMathPayload(input);
    case "aioseo":
      return mapAioseoPayload(input);
    case "none":
    default:
      return mapNonePayload(input);
  }
}
