// /articles/[id]/blog의 wordpress_blog 카드 "WordPress 게시 준비" 섹션을
// 버튼 나열이 아니라 "단계형 workflow UI"로 보여주기 위한 순수 로직.
// 어떤 데이터도 변경하지 않고, 실제 action도 호출하지 않는다 — 이미 있는
// 상태값(post/summary)만 읽어 "지금 어느 단계인지"와 "다음에 뭘 눌러야
// 하는지"를 계산한다.

export interface WordPressBlogWorkflowInput {
  qualityStatus: string;
  approvalStatus: string;
  draftExists: boolean;
  seoTitle: string | null;
  metaDescription: string | null;
  targetKeyword: string | null;
  featuredImageAttached: boolean;
  featuredImageWaived: boolean;
  /** WordPress media id(featuredImage.wordpressMediaId)가 저장되어 있는지 여부 — 업로드/연결 추천 문구를 구분하는 데 쓴다. */
  featuredImageMediaIdPresent: boolean;
  /** post.platformPublishGuardStatus ("not_checked"/"ready"/"needs_revision"/"blocked"/"failed"). */
  publishGuardStatus: string;
  checklistPrepared: boolean;
  /** post.handoffStatus ("not_started"/"ready"/"completed"/"blocked"/"failed"). */
  handoffStatus: string;
  /** 체크리스트 항목 중 확인 필요(needs_review) 상태인 개수. 체크리스트를 아직 안 만들었으면 0. */
  checklistNeedsReviewCount?: number;
  /** "게시 후 URL 기록 필요"류 항목이 아직 completed가 아닌지(게시 URL이 기록되지 않음). */
  checklistUrlMissing?: boolean;
}

export interface WordPressBlogWorkflowStatusSummary {
  quality: "완료" | "필요" | "실패";
  approval: "승인됨" | "승인 필요";
  draft: "없음" | "생성됨";
  seo: "준비됨" | "누락";
  featuredImage: "연결됨" | "없음" | "이미지 없이 진행";
  publishGuard: "미확인" | "ready" | "경고" | "차단됨" | "실패";
  checklist: "미준비" | "준비됨" | "handoff 완료";
}

export interface WordPressBlogNextRecommendedAction {
  /** 예: "다음 단계: WordPress Draft 생성" */
  title: string;
  /** 예: "아직 WordPress Draft가 없습니다. 먼저 Draft를 생성하세요." */
  description: string;
  /** 어느 Step으로 사용자 시선을 유도할지(1~7). UI가 해당 step을 강조하는 데 쓸 수 있다. */
  step: number;
}

function hasSeoMetadata(input: WordPressBlogWorkflowInput): boolean {
  return Boolean(input.seoTitle && input.metaDescription && input.targetKeyword);
}

export function getWordPressBlogWorkflowStatusSummary(
  input: WordPressBlogWorkflowInput
): WordPressBlogWorkflowStatusSummary {
  const quality: WordPressBlogWorkflowStatusSummary["quality"] =
    input.qualityStatus === "ready" ? "완료" : input.qualityStatus === "needs_revision" || input.qualityStatus === "blocked" ? "실패" : "필요";

  const approval: WordPressBlogWorkflowStatusSummary["approval"] = input.approvalStatus === "approved" ? "승인됨" : "승인 필요";

  const draft: WordPressBlogWorkflowStatusSummary["draft"] = input.draftExists ? "생성됨" : "없음";

  const seo: WordPressBlogWorkflowStatusSummary["seo"] = hasSeoMetadata(input) ? "준비됨" : "누락";

  const featuredImage: WordPressBlogWorkflowStatusSummary["featuredImage"] = input.featuredImageAttached
    ? "연결됨"
    : input.featuredImageWaived
      ? "이미지 없이 진행"
      : "없음";

  const publishGuard: WordPressBlogWorkflowStatusSummary["publishGuard"] =
    input.publishGuardStatus === "ready"
      ? "ready"
      : input.publishGuardStatus === "needs_revision"
        ? "경고"
        : input.publishGuardStatus === "blocked"
          ? "차단됨"
          : input.publishGuardStatus === "failed"
            ? "실패"
            : "미확인";

  const checklist: WordPressBlogWorkflowStatusSummary["checklist"] =
    input.handoffStatus === "completed" ? "handoff 완료" : input.checklistPrepared ? "준비됨" : "미준비";

  return { quality, approval, draft, seo, featuredImage, publishGuard, checklist };
}

/**
 * 지금 상태를 기준으로 "다음에 눌러야 할 버튼 하나"를 추천한다. 여러
 * 조건이 동시에 해당돼도 workflow 순서(품질→승인→Draft→SEO→대표
 * 이미지→게시 가능 확인→체크리스트)상 가장 앞선 것 하나만 반환한다.
 */
export function getWordPressBlogNextRecommendedAction(
  input: WordPressBlogWorkflowInput
): WordPressBlogNextRecommendedAction {
  if (input.qualityStatus !== "ready") {
    return {
      title: "다음 단계: 품질검사 실행",
      description: "아직 품질검사를 통과하지 못했습니다. 품질검사를 실행하세요.",
      step: 1,
    };
  }

  if (input.approvalStatus !== "approved") {
    return {
      title: "다음 단계: 승인 요청 또는 승인",
      description: "아직 승인되지 않았습니다. 승인 요청 후 승인하세요.",
      step: 2,
    };
  }

  if (!input.draftExists) {
    return {
      title: "다음 단계: WordPress Draft 생성",
      description: "아직 WordPress Draft가 없습니다. 먼저 Draft를 생성하세요.",
      step: 3,
    };
  }

  if (!hasSeoMetadata(input)) {
    return {
      title: "다음 단계: SEO Metadata 업데이트",
      description: "SEO metadata(seoTitle/metaDescription/targetKeyword)가 아직 준비되지 않았습니다.",
      step: 4,
    };
  }

  if (!input.featuredImageAttached && !input.featuredImageWaived) {
    if (input.featuredImageMediaIdPresent) {
      return {
        title: "다음 단계: 대표 이미지 연결",
        description: "WordPress media id는 저장되어 있지만 아직 연결되지 않았습니다. '대표 이미지 연결' 버튼을 누르세요.",
        step: 5,
      };
    }
    return {
      title: "다음 단계: 대표 이미지 업로드 또는 이미지 없이 진행",
      description: "대표 이미지가 아직 없습니다. 이미지를 업로드하거나 '대표 이미지 없이 진행'을 선택하세요.",
      step: 5,
    };
  }

  if (input.publishGuardStatus === "not_checked") {
    return {
      title: "다음 단계: 게시 가능 상태 확인",
      description: "아직 게시 가능 상태를 확인하지 않았습니다.",
      step: 6,
    };
  }

  if (!input.checklistPrepared) {
    return {
      title: "다음 단계: 게시 체크리스트 만들기",
      description: "모든 준비가 완료되었습니다. 게시 체크리스트를 만드세요.",
      step: 7,
    };
  }

  if ((input.checklistNeedsReviewCount ?? 0) > 0) {
    return {
      title: "다음 단계: 확인 필요 항목 검토",
      description:
        "체크리스트 중 사람이 직접 확인해야 하는 항목이 남아 있습니다. WordPress 관리자 화면에서 확인한 뒤 완료 표시를 하세요.",
      step: 7,
    };
  }

  if (input.checklistUrlMissing) {
    return {
      title: "다음 단계: 게시 URL 기록",
      description: "게시 후 URL이 아직 기록되지 않았습니다. 공개 게시 URL을 입력하세요.",
      step: 7,
    };
  }

  return {
    title: "다음 단계: 완료됨",
    description: "게시 체크리스트가 모두 완료되었습니다. 이제 성과 측정을 준비하세요.",
    step: 7,
  };
}
