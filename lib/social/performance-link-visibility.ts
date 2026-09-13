// Phase 4-20: "성과 확인" 관련 화면 링크를 언제 기본으로 눈에 띄게
// 보여줘도 되는지 판단하는 순수 함수. 게시 전이거나 성과 데이터가
// 없으면(performance_status가 not_measured이고 metrics 기록도 없음)
// "성과 확인"은 관련 화면 링크에서도 강조하지 않는다 — 그렇다고
// 링크 자체를 삭제하지는 않는다(호출부가 이 값을 보고 RelatedPostLinks에
// 포함할지 말지 결정한다).

import type { SocialPost } from "./social-platform-types";

export function shouldShowPerformanceLink(
  post: Pick<SocialPost, "manualPostStatus" | "latestMetricsRecordedAt" | "performanceStatus">
): boolean {
  if (post.manualPostStatus === "posted") return true;
  if (post.latestMetricsRecordedAt !== null) return true;
  return post.performanceStatus !== "not_measured";
}
