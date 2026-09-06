"use server";

// /articles 목록 페이지 전용 server action. 기사 검토/수정/승인 등 다른
// action들은 app/articles/[id]/actions.ts에 있다 — 이 파일은 목록 화면의
// "삭제"(보관 처리) 버튼만 다룬다.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { logEvent } from "@/lib/harness/logger";
import { getArticleById, archiveArticle, getArticleRelatedCounts } from "@/lib/repositories/article-repository";

/**
 * 기사 목록에서 "삭제" 버튼을 누르면 실행된다. hard delete가 아니라
 * soft delete(archived_at = now())만 수행한다 — articles→social_posts는
 * on delete cascade로 연결되어 있어(db/schema.sql) 실제 삭제는 연쇄적으로
 * 위험하기 때문이다. 연결된 social post(wordpress_blog/naver_blog 등)는
 * DB에 그대로 남고(목록에서만 숨겨지지 않음 — social post 자체는 각자
 * archived_at으로 별도 관리한다), 이미 WordPress에 생성된 Draft/Post도
 * 전혀 건드리지 않는다. 확인 모달은 화면(ConfirmSubmitButton)에서
 * 처리하므로 여기서는 실행만 담당한다.
 */
export async function archiveArticleAction(formData: FormData): Promise<void> {
  const articleId = String(formData.get("articleId") ?? "");
  const article = await getArticleById(articleId);

  if (!article) {
    redirect(`/articles?deleteError=${encodeURIComponent("기사를 찾을 수 없습니다.")}`);
  }

  if (article.archivedAt) {
    await logEvent({
      type: "article_delete_blocked",
      status: "failed",
      message: `기사(${articleId})는 이미 삭제(보관 처리)되어 있습니다.`,
      details: { articleId },
      articleId,
      targetType: "article",
      targetId: articleId,
    });
    redirect(`/articles?deleteError=${encodeURIComponent("이미 삭제된 기사입니다.")}`);
  }

  const relatedCounts = await getArticleRelatedCounts(articleId);
  await archiveArticle(articleId);

  await logEvent({
    type: "article_archived",
    status: "success",
    message: `기사가 삭제(보관 처리)되었습니다: ${article.title}`,
    details: { articleId, relatedCounts },
    themeId: article.themeId,
    articleId,
    targetType: "article",
    targetId: articleId,
  });

  revalidatePath("/articles");
  redirect(`/articles?deleteMessage=${encodeURIComponent(`기사를 삭제했습니다: ${article.title}`)}`);
}
