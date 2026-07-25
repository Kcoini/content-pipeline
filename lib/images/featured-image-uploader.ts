// Phase 2-5: 실제 이미지 생성 및 WordPress media upload는 아직 구현하지 않는다 (safe stub).
//
// featured_image_wordpress_media_id가 이미 저장되어 있으면(향후 업로드 기능이
// 구현된 뒤) 그 값을 그대로 사용할 수 있도록 구조만 준비한다. 지금은 이 값이
// 항상 null이므로 매번 undefined를 반환한다.

import type { Article } from "@/lib/types/domain";

/** article에 이미 저장된 WordPress media id가 있으면 반환한다 (없으면 undefined). */
export function resolveExistingFeaturedMediaId(article: Article): number | undefined {
  return article.featuredImageWordpressMediaId ?? undefined;
}
