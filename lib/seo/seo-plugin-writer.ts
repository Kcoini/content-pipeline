// Phase 2-4: 실제 SEO plugin post meta write는 아직 구현하지 않는다 (safe stub).
//
// Yoast/Rank Math/AIOSEO의 SEO 필드는 사이트마다 REST API 노출 여부와 plugin
// 버전/설정이 달라, 이번 단계에서는 실제 write를 강제하지 않는다. 커스텀
// WordPress endpoint(또는 register_meta로 노출된 필드)를 확인한 뒤 구현할
// 수 있도록 인터페이스만 준비한다.

import { isSeoPluginWriteEnabled } from "./seo-plugin-config";
import type { SeoPluginPayload, SeoPluginProvider, SeoPluginWriteStatus } from "./seo-plugin-types";

export interface ApplySeoPluginMetadataResult {
  status: SeoPluginWriteStatus;
  errorMessage?: string;
}

/**
 * SEO plugin post meta를 WordPress에 실제로 적용한다.
 *
 * - provider가 "none"이면 skipped_provider_none을 반환한다 (write 대상 없음).
 * - SEO_PLUGIN_WRITE_ENABLED=false이거나 WORDPRESS_PUBLISH_ENABLED=true가 아니면
 *   skipped_dry_run을 반환한다 (실제 API를 호출하지 않는다).
 * - 그 외의 경우에도 실제 REST write는 아직 구현되지 않았으므로 failed를 반환한다
 *   (커스텀 endpoint 준비 후 이 함수 내부만 교체하면 된다).
 */
export async function applySeoPluginMetadata(
  postId: string,
  provider: SeoPluginProvider,
  payload: SeoPluginPayload
): Promise<ApplySeoPluginMetadataResult> {
  if (provider === "none") {
    return { status: "skipped_provider_none" };
  }

  const wordpressPublishEnabled = process.env.WORDPRESS_PUBLISH_ENABLED === "true";
  if (!isSeoPluginWriteEnabled() || !wordpressPublishEnabled) {
    return { status: "skipped_dry_run" };
  }

  // 실제 REST write는 이번 단계에서 구현하지 않는다. postId/payload는 커스텀
  // endpoint 구현 시 사용할 자리만 남겨둔다.
  void postId;
  void payload;

  return {
    status: "failed",
    errorMessage:
      "실제 SEO plugin metadata write는 아직 구현되지 않았습니다 (커스텀 WordPress endpoint가 필요합니다).",
  };
}
