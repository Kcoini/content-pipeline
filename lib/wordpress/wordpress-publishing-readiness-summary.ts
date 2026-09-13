// Phase 4-7: WordPress 게시 준비 화면(원본 article → WordPress Draft
// 전송)의 여러 상태(연결/승인/대표 이미지/SEO)를 "지금 뭘 하면 되는지"
// 한 줄로 요약한다. 새 DB 컬럼/저장 없음 — 항상 기존 article 필드로부터
// 순수 함수로 계산한다. WordPress Media Upload/Connection Test 기능
// 자체는 그대로 유지되고, 이 요약은 화면 최상단에 보여줄 카드용이다.

import type { WordPressMediaUploadStatus } from "@/lib/types/domain";
import type { SeoWriteSummaryStatus } from "@/lib/seo/seo-plugin-status-summary";

export type WordPressReadinessPrimaryAction = "needs_review" | "prepare_image" | "create_draft" | "view_draft";

export interface WordPressPublishingReadinessInput {
  isReviewed: boolean;
  /** WordPress draft가 이미 성공적으로 생성된 적이 있는지. */
  hasWordPressDraft: boolean;
  featuredImageUploadStatus: WordPressMediaUploadStatus;
  /** media id가 이미 지정되어 있는지(업로드 없이 기존 media 사용 포함). */
  hasArticleFeaturedImage: boolean;
  /** "대표 이미지 없이 진행"을 사용자가 선택했는지. */
  featuredImageWaived: boolean;
  seoStatus: SeoWriteSummaryStatus;
}

export interface WordPressPublishingReadinessSummary {
  /** 연결이 실제로 확인된 적 있는지(WordPress draft 생성 이력 기준 — 별도 저장 없이 추정). */
  connectionLabel: string;
  draftReadyLabel: string;
  seoLabel: string;
  imageLabel: string;
  /** 자동 public publish는 하지 않는다는 사실을 항상 보여준다(고정 문구). */
  publishLabel: string;
  nextActionLabel: string;
  primaryAction: WordPressReadinessPrimaryAction;
  primaryActionLabel: string;
}

const SEO_STATUS_SHORT_LABEL: Record<SeoWriteSummaryStatus, string> = {
  not_ready: "준비 필요",
  ready_to_write: "반영 필요",
  written_unconfirmed: "확인 필요",
  confirmed: "반영됨",
  error: "오류",
};

const PRIMARY_ACTION_LABEL: Record<WordPressReadinessPrimaryAction, string> = {
  needs_review: "기사 승인하러 가기",
  prepare_image: "대표 이미지 업로드",
  create_draft: "WordPress Draft 반영",
  view_draft: "WordPress Draft 보기",
};

export function summarizeWordPressPublishingReadiness(
  input: WordPressPublishingReadinessInput
): WordPressPublishingReadinessSummary {
  const imageReady =
    input.hasArticleFeaturedImage || input.featuredImageUploadStatus === "uploaded" || input.featuredImageWaived;

  const imageLabel = input.featuredImageWaived
    ? "이미지 없이 진행"
    : input.hasArticleFeaturedImage || input.featuredImageUploadStatus === "uploaded"
      ? "준비됨"
      : input.featuredImageUploadStatus === "failed"
        ? "실패"
        : "준비 안 됨";

  // 연결 성공 이력이 있으면(=WordPress draft를 만든 적 있으면) "연결됨"으로
  // 안내한다. 별도 저장소 없이 기존 필드만으로 추정하는 값이라 확정적인
  // "실시간 연결 상태"는 아니다 — 정확한 확인은 접힘 영역의 [연결 상태
  // 확인] 버튼으로 한다.
  const connectionLabel = input.hasWordPressDraft ? "연결됨" : "확인 필요";

  const base = {
    connectionLabel,
    seoLabel: SEO_STATUS_SHORT_LABEL[input.seoStatus],
    imageLabel,
    publishLabel: "자동 실행 안 함",
  };

  if (!input.isReviewed) {
    return {
      ...base,
      draftReadyLabel: "승인 필요",
      nextActionLabel: "기사를 먼저 승인(reviewed)하세요.",
      primaryAction: "needs_review",
      primaryActionLabel: PRIMARY_ACTION_LABEL.needs_review,
    };
  }

  if (input.hasWordPressDraft) {
    return {
      ...base,
      draftReadyLabel: "생성됨",
      nextActionLabel: "WordPress 관리자 화면에서 최종 확인하세요.",
      primaryAction: "view_draft",
      primaryActionLabel: PRIMARY_ACTION_LABEL.view_draft,
    };
  }

  if (!imageReady) {
    return {
      ...base,
      draftReadyLabel: "가능",
      nextActionLabel: "대표 이미지를 업로드하거나 이미지 없이 진행할 수 있습니다.",
      primaryAction: "prepare_image",
      primaryActionLabel: PRIMARY_ACTION_LABEL.prepare_image,
    };
  }

  return {
    ...base,
    draftReadyLabel: "가능",
    nextActionLabel: "WordPress Draft에 반영하세요.",
    primaryAction: "create_draft",
    primaryActionLabel: PRIMARY_ACTION_LABEL.create_draft,
  };
}
