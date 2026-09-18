// /articles/[id]/blog의 wordpress_blog 카드가 너무 길어서(글 내용/미리보기/
// 품질검사/승인/WordPress 반영/대표 이미지/체크리스트가 전부 세로로 이어져
// 있어서) 스크롤 부담이 큰 문제를 해결하기 위한 탭 구조 순수 로직. 어떤
// 데이터도 변경하지 않고, 실제 action도 호출하지 않는다.

export type WordPressBlogCardTab = "content" | "preview" | "quality" | "wordpress" | "image" | "checklist";

export interface WordPressBlogCardTabDefinition {
  key: WordPressBlogCardTab;
  label: string;
}

// Phase 4-16: 기본 탭을 "게시용 미리보기"(렌더링된 HTML)로 바꿨다 —
// 이전에는 "글 내용" 탭이 기본이었는데, 그 탭도 markdown 원문(##, **,
// <div class="summary-box"> 등)을 그대로 보여줘서 사용자가 raw 문법을
// 먼저 보게 되는 문제가 있었다. "content" 탭은 이제 "편집용 원문"으로
// 이름을 바꿔 markdown 원문을 확인/복사하고 싶을 때만 보는 보조 탭이다.
export const WORDPRESS_BLOG_CARD_TABS: WordPressBlogCardTabDefinition[] = [
  { key: "preview", label: "게시용 미리보기" },
  { key: "content", label: "편집용 원문" },
  { key: "quality", label: "품질·승인" },
  { key: "wordpress", label: "WordPress 반영" },
  { key: "image", label: "대표 이미지" },
  { key: "checklist", label: "체크리스트" },
];

const DEFAULT_TAB: WordPressBlogCardTab = "preview";

/** query param(`tab`) 값을 안전한 탭 key로 정규화한다. 모르는 값이면 기본 탭("content")으로 되돌린다. */
export function normalizeWordPressBlogCardTab(value: string | undefined | null): WordPressBlogCardTab {
  const found = WORDPRESS_BLOG_CARD_TABS.find((t) => t.key === value);
  return found ? found.key : DEFAULT_TAB;
}

/**
 * "다음 추천 작업"의 step(1~7, wordpress-blog-workflow-steps.ts 기준)을
 * 어느 탭으로 이동해야 처리할 수 있는지로 변환한다. Step 6(게시 가능 상태
 * 확인)/Step 7(체크리스트)은 모두 "체크리스트" 탭에 있다.
 */
export function getTabForWorkflowStep(step: number): WordPressBlogCardTab {
  if (step === 1 || step === 2) return "quality";
  if (step === 3 || step === 4) return "wordpress";
  if (step === 5) return "image";
  return "checklist"; // step 6, 7
}

export interface WordPressBlogCardTabBadges {
  quality: "완료" | "필요";
  wordpress: "완료" | "필요";
  image: "완료" | "확인 필요";
  checklist: "완료" | "필요" | "확인 필요";
}

export interface WordPressBlogCardTabBadgeInput {
  qualityStatus: "완료" | "필요" | "실패";
  approvalStatus: "승인됨" | "승인 필요";
  draftStatus: "없음" | "생성됨";
  seoStatus: "준비됨" | "누락";
  publishGuardStatus: "미확인" | "준비 완료" | "경고" | "차단됨" | "실패";
  featuredImageStatus: "연결됨" | "없음" | "이미지 없이 진행";
  checklistStatus: "미준비" | "준비됨" | "handoff 완료";
  checklistNeedsReviewCount: number;
}

/**
 * 각 탭 이름 옆에 붙일 상태 badge를 계산한다("글 내용"/"WordPress
 * 미리보기" 탭은 badge 없이 정보 제공용이라 여기 포함하지 않는다).
 */
export function getWordPressBlogCardTabBadges(input: WordPressBlogCardTabBadgeInput): WordPressBlogCardTabBadges {
  const quality: WordPressBlogCardTabBadges["quality"] =
    input.qualityStatus === "완료" && input.approvalStatus === "승인됨" ? "완료" : "필요";

  const wordpress: WordPressBlogCardTabBadges["wordpress"] =
    input.draftStatus === "생성됨" && input.seoStatus === "준비됨" && input.publishGuardStatus === "준비 완료" ? "완료" : "필요";

  const image: WordPressBlogCardTabBadges["image"] =
    input.featuredImageStatus === "연결됨" || input.featuredImageStatus === "이미지 없이 진행" ? "완료" : "확인 필요";

  const checklist: WordPressBlogCardTabBadges["checklist"] =
    input.checklistNeedsReviewCount > 0
      ? "확인 필요"
      : input.checklistStatus === "handoff 완료" || input.checklistStatus === "준비됨"
        ? "완료"
        : "필요";

  return { quality, wordpress, image, checklist };
}
