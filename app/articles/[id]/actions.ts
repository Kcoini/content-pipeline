"use server";

// 기사 검토/수정/승인 서버 액션 (Phase 1-5).
// articles.status를 reviewed로 전환하는 로직은 반드시 이 모듈(서버)에서만
// 실행한다. 클라이언트는 Supabase를 직접 호출하지 않는다.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  approveArticle,
  updateDraftArticle,
  ArticleNotEditableError,
  ArticleNotFoundError,
  EmptyContentError,
} from "@/lib/repositories/article-repository";
import { logEvent } from "@/lib/harness/logger";
import { publishArticleToWordPressDraft, runWordPressConnectionTest } from "@/lib/publish/publish-service";
import { generateWordPressMetadata, reviewWordPressMetadata } from "@/lib/publish/wordpress-metadata-service";
import { generateSeoPluginPayload, reviewSeoPluginMetadata } from "@/lib/seo/seo-plugin-metadata-service";
import { isSeoPluginProvider } from "@/lib/seo/seo-plugin-types";
import { prepareFeaturedImage, reviewFeaturedImage } from "@/lib/images/featured-image-preparation-service";
import {
  prepareWordPressMediaUpload,
  confirmWordPressMediaUploadDryRun,
} from "@/lib/publish/wordpress-media-preparation-service";
import { uploadFeaturedImageToWordPress } from "@/lib/publish/wordpress-media-upload-service";
import { attachFeaturedMediaToDraft } from "@/lib/publish/wordpress-featured-media-service";
import {
  writeSeoPluginMetadataToWordPress,
  writeRankMathSeoViaCustomEndpoint,
} from "@/lib/seo/seo-plugin-actual-write-service";
import { generateFeaturedImage, reviewGeneratedImage } from "@/lib/images/image-generation-service";

/** Phase 1-5: 사용자 계정/권한 시스템이 없으므로 임시 식별자를 사용한다. */
const APPROVED_BY = "local-user";

function toUserMessage(error: unknown): string {
  if (
    error instanceof ArticleNotFoundError ||
    error instanceof ArticleNotEditableError ||
    error instanceof EmptyContentError
  ) {
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return "알 수 없는 오류가 발생했습니다.";
}

/** draft 상태 기사의 title/content를 수정한다. */
export async function updateArticleAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const title = String(formData.get("title") ?? "");
  const content = String(formData.get("content") ?? "");

  try {
    const article = await updateDraftArticle({ articleId, title, content });

    await logEvent({
      type: "article_updated",
      status: "success",
      message: `기사(${article.id})를 수정했습니다.`,
      themeId: article.themeId,
      articleId: article.id,
      targetType: "article",
      targetId: article.id,
    });
  } catch (error) {
    const message = toUserMessage(error);

    await logEvent({
      type: "article_updated",
      status: "failed",
      message,
      articleId,
      targetType: "article",
      targetId: articleId,
    });

    redirect(`/articles/${articleId}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(`/articles/${articleId}`);
  revalidatePath("/articles");
  redirect(`/articles/${articleId}`);
}

/**
 * reviewed 상태의 기사를 WordPress에 draft post로 생성한다 (Phase 2-2).
 * WORDPRESS_PUBLISH_ENABLED=false이면 dry-run으로 처리되며, 실제 WordPress API는
 * 호출되지 않는다. 오류가 발생해도 Runtime Error로 터뜨리지 않고 사용자 메시지로
 * 반환하기 위해 publish-service의 결과(성공/실패 여부 포함)를 그대로 query param에 담는다.
 */
export async function publishToWordPressDraftAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");

  let message: string;
  let isError: boolean;

  try {
    const result = await publishArticleToWordPressDraft(articleId);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidatePath(`/articles/${articleId}`);

  const query = isError
    ? `error=${encodeURIComponent(message)}`
    : `publishMessage=${encodeURIComponent(message)}`;
  redirect(`/articles/${articleId}?${query}`);
}

/**
 * WordPress 실제 연결을 테스트한다 (Phase 2-8). 특정 기사와 무관한 사이트 단위
 * 점검이지만, article 상세 페이지에서 결과를 확인할 수 있도록 이 화면으로
 * 돌아온다. Application Password/Authorization header는 절대 반환/표시하지 않는다.
 */
export async function testWordPressConnectionAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");

  let message: string;
  let isError: boolean;

  try {
    const result = await runWordPressConnectionTest();
    isError = !result.connected;
    if (result.connected) {
      message = `WordPress 연결 성공 (${result.username ?? "알 수 없음"}${result.displayName ? `, ${result.displayName}` : ""})`;
    } else {
      const causes = result.likelyCauses && result.likelyCauses.length > 0 ? ` — 원인 후보: ${result.likelyCauses.join(" / ")}` : "";
      message = `${result.errorMessage ?? "WordPress 연결에 실패했습니다."}${causes}`;
    }
    if (result.warnings && result.warnings.length > 0) {
      message = `${message} (${result.warnings.join(" ")})`;
    }
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidatePath(`/articles/${articleId}`);

  const query = isError
    ? `error=${encodeURIComponent(message)}`
    : `publishMessage=${encodeURIComponent(message)}`;
  redirect(`/articles/${articleId}?${query}`);
}

/**
 * article_mode/키워드/제목/본문 기반 규칙으로 WordPress metadata(카테고리/태그/SEO)를
 * 생성한다 (Phase 2-3). reviewed 여부와 무관하게 항상 호출 가능하다. 실제 WordPress
 * API를 호출하지 않으므로 WORDPRESS_PUBLISH_ENABLED 값과 무관하게 동작한다.
 */
export async function generateWordPressMetadataAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");

  let message: string;
  let isError: boolean;

  try {
    const result = await generateWordPressMetadata(articleId);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidatePath(`/articles/${articleId}`);

  const query = isError
    ? `error=${encodeURIComponent(message)}`
    : `publishMessage=${encodeURIComponent(message)}`;
  redirect(`/articles/${articleId}?${query}`);
}

/** WordPress metadata를 사람이 검토 완료했음을 표시한다 (wp_metadata_status='reviewed'). */
export async function reviewWordPressMetadataAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");

  let message: string;
  let isError: boolean;

  try {
    const result = await reviewWordPressMetadata(articleId);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidatePath(`/articles/${articleId}`);

  const query = isError
    ? `error=${encodeURIComponent(message)}`
    : `publishMessage=${encodeURIComponent(message)}`;
  redirect(`/articles/${articleId}?${query}`);
}

/**
 * article_mode/키워드/제목/본문 기반 규칙으로 SEO plugin(none/yoast/rank_math/aioseo)
 * metadata payload를 생성한다 (Phase 2-4). reviewed 여부와 무관하게 항상 호출 가능하다.
 * 실제 plugin write는 하지 않으므로 SEO_PLUGIN_WRITE_ENABLED 값과 무관하게 동작한다.
 */
export async function generateSeoPluginMetadataAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const providerRaw = formData.get("provider");
  const providerOverride = isSeoPluginProvider(providerRaw) ? providerRaw : undefined;

  let message: string;
  let isError: boolean;

  try {
    const result = await generateSeoPluginPayload(articleId, providerOverride);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidatePath(`/articles/${articleId}`);

  const query = isError
    ? `error=${encodeURIComponent(message)}`
    : `publishMessage=${encodeURIComponent(message)}`;
  redirect(`/articles/${articleId}?${query}`);
}

/** SEO plugin metadata를 사람이 검토 완료했음을 표시한다 (seo_plugin_metadata_status='reviewed'). */
export async function reviewSeoPluginMetadataAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");

  let message: string;
  let isError: boolean;

  try {
    const result = await reviewSeoPluginMetadata(articleId);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidatePath(`/articles/${articleId}`);

  const query = isError
    ? `error=${encodeURIComponent(message)}`
    : `publishMessage=${encodeURIComponent(message)}`;
  redirect(`/articles/${articleId}?${query}`);
}

/**
 * article_mode/제목/키워드 기반 규칙으로 대표 이미지(featured image) 준비 정보
 * (prompt/alt text/caption/style)를 생성한다 (Phase 2-5). reviewed 여부와
 * 무관하게 항상 호출 가능하다. 실제 이미지 생성 API나 WordPress media upload는
 * 호출하지 않는다.
 */
export async function prepareFeaturedImageAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");

  let message: string;
  let isError: boolean;

  try {
    const result = await prepareFeaturedImage(articleId);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidatePath(`/articles/${articleId}`);

  const query = isError
    ? `error=${encodeURIComponent(message)}`
    : `publishMessage=${encodeURIComponent(message)}`;
  redirect(`/articles/${articleId}?${query}`);
}

/** 대표 이미지 준비 정보를 사람이 검토 완료했음을 표시한다 (featured_image_status='reviewed'). */
export async function reviewFeaturedImageAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");

  let message: string;
  let isError: boolean;

  try {
    const result = await reviewFeaturedImage(articleId);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidatePath(`/articles/${articleId}`);

  const query = isError
    ? `error=${encodeURIComponent(message)}`
    : `publishMessage=${encodeURIComponent(message)}`;
  redirect(`/articles/${articleId}?${query}`);
}

/**
 * Phase 2-5에서 준비한 featured image metadata(prompt/alt text/caption/style)를
 * 바탕으로 WordPress media upload payload를 준비한다 (Phase 2-6). 실제 이미지
 * 생성이나 WordPress media upload는 하지 않는다.
 */
export async function prepareWordPressMediaUploadAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");

  let message: string;
  let isError: boolean;

  try {
    const result = await prepareWordPressMediaUpload(articleId);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidatePath(`/articles/${articleId}`);

  const query = isError
    ? `error=${encodeURIComponent(message)}`
    : `publishMessage=${encodeURIComponent(message)}`;
  redirect(`/articles/${articleId}?${query}`);
}

/**
 * 준비된 WordPress media upload payload로 dry-run 확인을 수행한다 (Phase 2-6).
 * WORDPRESS_MEDIA_UPLOAD_ENABLED=false이면 실제 업로드를 시도하지 않는다.
 */
export async function confirmWordPressMediaUploadDryRunAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");

  let message: string;
  let isError: boolean;

  try {
    const result = await confirmWordPressMediaUploadDryRun(articleId);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidatePath(`/articles/${articleId}`);

  const query = isError
    ? `error=${encodeURIComponent(message)}`
    : `publishMessage=${encodeURIComponent(message)}`;
  redirect(`/articles/${articleId}?${query}`);
}

/**
 * 실제 WordPress Media Library에 featured image를 업로드한다 (Phase 2-10).
 * WORDPRESS_MEDIA_UPLOAD_ENABLED=false이면 실제 업로드를 시도하지 않고 skipped로
 * 처리한다. Application Password/Authorization header는 절대 반환/표시하지 않는다.
 */
export async function uploadFeaturedImageToWordPressAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");

  let message: string;
  let isError: boolean;

  try {
    const result = await uploadFeaturedImageToWordPress(articleId);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidatePath(`/articles/${articleId}`);

  const query = isError
    ? `error=${encodeURIComponent(message)}`
    : `publishMessage=${encodeURIComponent(message)}`;
  redirect(`/articles/${articleId}?${query}`);
}

/**
 * WordPress 이미지 업로드 상태를 다시 확인한다 (Phase 2-10). 별도의 API 호출
 * 없이 현재 페이지를 새로고침해 최신 업로드 상태(article 테이블)를 보여준다.
 */
export async function checkWordPressMediaUploadStatusAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");

  revalidatePath(`/articles/${articleId}`);
  redirect(`/articles/${articleId}`);
}

/**
 * 업로드된 WordPress media id를 기존 WordPress draft post의 featured_media로
 * 연결한다 (Phase 2-11). media id가 없거나 기존 draft가 없으면 안전하게
 * 실패 메시지를 반환한다. 공개 게시는 수행하지 않으며 post status는 항상
 * draft로 유지된다.
 */
export async function attachFeaturedMediaToDraftAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");

  let message: string;
  let isError: boolean;

  try {
    const result = await attachFeaturedMediaToDraft(articleId);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidatePath(`/articles/${articleId}`);

  const query = isError
    ? `error=${encodeURIComponent(message)}`
    : `publishMessage=${encodeURIComponent(message)}`;
  redirect(`/articles/${articleId}?${query}`);
}

/**
 * WordPress featured_media 연결 상태를 다시 확인한다 (Phase 2-11). 별도의 API
 * 호출 없이 현재 페이지를 새로고침해 최신 상태(article 테이블)를 보여준다.
 */
export async function checkWordPressFeaturedMediaAttachStatusAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");

  revalidatePath(`/articles/${articleId}`);
  redirect(`/articles/${articleId}`);
}

/**
 * SEO plugin metadata를 실제 WordPress draft post에 반영하는 테스트를 한다
 * (Phase 2-12). SEO_PLUGIN_PROVIDER=none이거나 SEO_PLUGIN_WRITE_ENABLED=false
 * 이면 실제 API를 호출하지 않고 안전하게 skip한다. 공개 게시는 수행하지
 * 않으며 post status는 항상 draft로 유지된다.
 */
export async function writeSeoPluginMetadataToWordPressAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");

  let message: string;
  let isError: boolean;

  try {
    const result = await writeSeoPluginMetadataToWordPress(articleId);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidatePath(`/articles/${articleId}`);

  const query = isError
    ? `error=${encodeURIComponent(message)}`
    : `publishMessage=${encodeURIComponent(message)}`;
  redirect(`/articles/${articleId}?${query}`);
}

/**
 * SEO plugin 실제 write 반영 상태를 다시 확인한다 (Phase 2-12). 별도의 API
 * 호출 없이 현재 페이지를 새로고침해 최신 상태(article 테이블)를 보여준다.
 */
export async function checkSeoPluginActualWriteStatusAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");

  revalidatePath(`/articles/${articleId}`);
  redirect(`/articles/${articleId}`);
}

/**
 * Rank Math SEO metadata를 WordPress custom REST endpoint(ai-pipeline/v1/
 * seo-meta)를 통해 update_post_meta로 직접 반영한다 (Phase 2-13). provider가
 * rank_math가 아니거나 custom endpoint가 비활성화되어 있거나 WordPress
 * draft post가 없으면 실제 API를 호출하지 않고 안전하게 skip한다. 실패해도
 * 표준 REST 방식으로 fallback하지 않는다.
 */
export async function writeRankMathSeoViaCustomEndpointAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");

  let message: string;
  let isError: boolean;

  try {
    const result = await writeRankMathSeoViaCustomEndpoint(articleId);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidatePath(`/articles/${articleId}`);

  const query = isError
    ? `error=${encodeURIComponent(message)}`
    : `publishMessage=${encodeURIComponent(message)}`;
  redirect(`/articles/${articleId}?${query}`);
}

/**
 * Phase 2-5에서 준비한 featured image prompt/alt text/caption/style을 바탕으로
 * 실제 또는 mock 이미지를 생성한다 (Phase 2-7). provider가 실패해도 Runtime
 * Error로 터지지 않고 사용자 메시지로 반환된다.
 */
export async function generateFeaturedImageAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");

  let message: string;
  let isError: boolean;

  try {
    const result = await generateFeaturedImage(articleId);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidatePath(`/articles/${articleId}`);

  const query = isError
    ? `error=${encodeURIComponent(message)}`
    : `publishMessage=${encodeURIComponent(message)}`;
  redirect(`/articles/${articleId}?${query}`);
}

/** 생성된 이미지를 사람이 검토 완료했음을 표시한다 (generated_image_status='reviewed'). */
export async function reviewGeneratedImageAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");

  let message: string;
  let isError: boolean;

  try {
    const result = await reviewGeneratedImage(articleId);
    message = result.message;
    isError = !result.success;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidatePath(`/articles/${articleId}`);

  const query = isError
    ? `error=${encodeURIComponent(message)}`
    : `publishMessage=${encodeURIComponent(message)}`;
  redirect(`/articles/${articleId}?${query}`);
}

/** draft 상태 기사를 사용자 승인을 거쳐 reviewed로 전환한다 (FR-9). */
export async function approveArticleAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");

  try {
    const article = await approveArticle({ articleId, approvedBy: APPROVED_BY });

    await logEvent({
      type: "article_approved",
      status: "success",
      message: `기사(${article.id})를 승인했습니다 (status: ${article.status}).`,
      themeId: article.themeId,
      articleId: article.id,
      targetType: "article",
      targetId: article.id,
    });
  } catch (error) {
    const message = toUserMessage(error);

    await logEvent({
      type: "article_approved",
      status: "failed",
      message,
      articleId,
      targetType: "article",
      targetId: articleId,
    });

    redirect(`/articles/${articleId}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(`/articles/${articleId}`);
  revalidatePath("/articles");
  redirect(`/articles/${articleId}`);
}
