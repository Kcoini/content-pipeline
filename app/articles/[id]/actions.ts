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
import { publishArticleToWordPressDraft } from "@/lib/publish/publish-service";

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
