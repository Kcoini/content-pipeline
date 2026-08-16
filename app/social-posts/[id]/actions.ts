"use server";

// Phase 3-21: Platform API Publishing Preparation.
// /social-posts/[id] 페이지 전용 서버 액션. 이 파일의 어떤 함수도
// 실제 외부 플랫폼 API를 호출하지 않는다 — readiness/eligibility를
// 계산하고 social_posts 요약 컬럼 몇 개만 갱신할 뿐이다.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { preparePlatformApiPublishing } from "@/lib/social/platform-api-publishing-preparation-service";

const PREPARED_BY = "local-user";

/** social_post 하나의 API 게시 준비 상태(readiness/eligibility/dry-run)를 다시 계산해 저장한다. 실제 게시는 수행하지 않는다. */
export async function preparePlatformApiPublishingAction(formData: FormData): Promise<void> {
  const socialPostId = String(formData.get("socialPostId") ?? "");

  let message: string;
  let isError: boolean;

  try {
    const result = await preparePlatformApiPublishing(socialPostId, PREPARED_BY);
    message =
      result.blockers.length > 0
        ? `API 게시 준비 상태: ${result.readiness.status} (blocker ${result.blockers.length}개)`
        : `API 게시 준비 상태: ${result.readiness.status}`;
    isError = result.blockers.length > 0;
  } catch (error) {
    message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    isError = true;
  }

  revalidatePath(`/social-posts/${socialPostId}`);

  const query = isError ? `error=${encodeURIComponent(message)}` : `publishMessage=${encodeURIComponent(message)}`;
  redirect(`/social-posts/${socialPostId}?${query}`);
}
