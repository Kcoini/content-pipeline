// Phase 3-23-2: 대시보드 "현재 상태 / 다음 작업" 카드와 섹션 접힘 상태를
// workflowState 하나로부터 일관되게 계산하는 순수 함수 모음.
// DB/네트워크 접근 없음 — page.tsx 없이도 단위 테스트할 수 있게 분리했다.
//
// 이 파일이 계산한 값 외의 다른 기준(예: 예전 nextActionState)으로
// 대시보드 상태 문구/색상/CTA/섹션 펼침 여부를 판단하지 않는다 — 상태
// 판단 기준이 두 개로 나뉘면 서로 모순된 안내가 생길 수 있기 때문이다.

import type { DashboardWorkflowState } from "./source-display";

export interface WorkflowStateTone {
  /** "현재 상태 / 다음 작업" 카드의 테두리/배경 색상. */
  containerClassName: string;
  /** "현재 상태:" 줄 텍스트 색상. */
  headingClassName: string;
  /** "다음 작업:" 줄 텍스트 색상. */
  bodyClassName: string;
  /** 카드 제목 옆에 붙는 작은 배지 문구(예: "확인 필요"). */
  badgeLabel: string;
  badgeClassName: string;
}

/**
 * 5색 색상 체계로만 표현한다 — 회색(시작 전) / 파랑(진행중·다음 작업) /
 * 노랑(확인 필요) / 초록(완료·가능) / 빨강(차단·오류). 이 프로젝트에는
 * 아직 "차단/오류"에 대응하는 workflowState가 없어 빨강은 쓰지 않는다
 * (나중에 오류 상태가 추가되면 이 표에만 항목을 더하면 된다).
 */
const WORKFLOW_STATE_TONES: Record<DashboardWorkflowState, WorkflowStateTone> = {
  needs_theme: {
    containerClassName: "border-zinc-200 bg-zinc-50",
    headingClassName: "text-zinc-800",
    bodyClassName: "text-zinc-600",
    badgeLabel: "시작 전",
    badgeClassName: "bg-zinc-100 text-zinc-600",
  },
  needs_source: {
    containerClassName: "border-amber-200 bg-amber-50",
    headingClassName: "text-amber-900",
    bodyClassName: "text-amber-800",
    badgeLabel: "확인 필요",
    badgeClassName: "bg-amber-100 text-amber-700",
  },
  ready_to_generate: {
    containerClassName: "border-blue-200 bg-blue-50",
    headingClassName: "text-blue-900",
    bodyClassName: "text-blue-800",
    badgeLabel: "다음 작업",
    badgeClassName: "bg-blue-100 text-blue-700",
  },
  needs_platform_posts: {
    containerClassName: "border-blue-200 bg-blue-50",
    headingClassName: "text-blue-900",
    bodyClassName: "text-blue-800",
    badgeLabel: "다음 작업",
    badgeClassName: "bg-blue-100 text-blue-700",
  },
  needs_review: {
    containerClassName: "border-amber-200 bg-amber-50",
    headingClassName: "text-amber-900",
    bodyClassName: "text-amber-800",
    badgeLabel: "확인 필요",
    badgeClassName: "bg-amber-100 text-amber-700",
  },
  ready_for_publish_prep: {
    containerClassName: "border-green-200 bg-green-50",
    headingClassName: "text-green-900",
    bodyClassName: "text-green-800",
    badgeLabel: "게시 준비 가능",
    badgeClassName: "bg-green-100 text-green-700",
  },
};

export function getWorkflowStateTone(state: DashboardWorkflowState): WorkflowStateTone {
  return WORKFLOW_STATE_TONES[state];
}

export interface DashboardStatusSummaryContext {
  themeId?: string;
  articleId?: string;
  sourceCount: number;
  minSourceCount: number;
  pendingReviewCount: number;
  approvedCount: number;
}

export interface DashboardStatusSummary {
  headline: string;
  nextAction: string;
  primaryActionLabel: string;
  /** "#"로 시작하면 같은 화면 안의 앵커, 아니면 다른 페이지 경로. */
  primaryActionHref: string;
  secondaryActionLabel?: string;
  secondaryActionHref?: string;
}

/**
 * "현재 상태 / 다음 작업" 카드에 표시할 문구·버튼을 workflowState
 * 하나만으로 계산한다. 이 함수가 대시보드 상태 문구의 유일한 출처다.
 */
export function getDashboardStatusSummary(
  state: DashboardWorkflowState,
  ctx: DashboardStatusSummaryContext
): DashboardStatusSummary {
  switch (state) {
    case "needs_theme":
      return {
        headline: "아직 선택된 테마가 없습니다.",
        nextAction: "테마를 생성하거나 목록에서 선택하세요.",
        primaryActionLabel: "테마 생성/선택하기",
        primaryActionHref: "#theme-list",
      };
    case "needs_source":
      return {
        headline:
          ctx.sourceCount === 0
            ? "아직 출처가 없습니다."
            : `출처가 ${ctx.sourceCount}개 등록되어 있지만 아직 부족합니다.`,
        nextAction: `기사 작성에 사용할 출처를 추가하세요 (${Math.max(ctx.minSourceCount - ctx.sourceCount, 0)}개 더 필요).`,
        primaryActionLabel: "출처 추가하기",
        primaryActionHref: "#source-url-input",
        secondaryActionLabel: "관련 기사 URL 수집",
        secondaryActionHref: ctx.themeId ? `/themes/${ctx.themeId}` : undefined,
      };
    case "ready_to_generate":
      return {
        headline: `출처가 준비되었습니다 (${ctx.sourceCount}개).`,
        nextAction: "WordPress 블로그, 네이버 블로그, 네이버 카페 글을 생성하려면 먼저 마스터 원고를 만드세요.",
        primaryActionLabel: "마스터 원고 만들기",
        primaryActionHref: "#generate-draft",
      };
    case "needs_platform_posts":
      return {
        headline: "마스터 원고가 준비되었습니다.",
        nextAction: "WordPress 블로그, 네이버 블로그, 네이버 카페 글을 생성하세요.",
        primaryActionLabel: "선택한 플랫폼 글 생성",
        primaryActionHref: "#platform-generation",
        secondaryActionLabel: "마스터 원고 보기",
        secondaryActionHref: ctx.articleId ? `/articles/${ctx.articleId}` : undefined,
      };
    case "needs_review":
      return {
        headline: `생성된 글이 있습니다 (검토 대기 ${ctx.pendingReviewCount}개).`,
        nextAction: "글 내용을 검토하세요.",
        primaryActionLabel: "검토할 글 보기",
        primaryActionHref: ctx.articleId ? `/articles/${ctx.articleId}/social` : "#platform-generation",
      };
    case "ready_for_publish_prep":
      return {
        headline: `승인된 글이 있습니다 (${ctx.approvedCount}개).`,
        nextAction: "WordPress Draft 반영 또는 수동 export를 진행하세요.",
        primaryActionLabel: "게시 준비하기",
        primaryActionHref: ctx.articleId ? `/articles/${ctx.articleId}/blog` : "#platform-generation",
        secondaryActionLabel: "플랫폼 글 관리",
        secondaryActionHref: ctx.articleId ? `/articles/${ctx.articleId}/social` : undefined,
      };
  }
}

export interface DashboardSectionExpansion {
  /** "+ 출처 추가" 폼을 기본으로 펼칠지. */
  sourceAddExpanded: boolean;
  /** "출처 기반 원고 생성/재생성" 폼을 기본으로 펼칠지. */
  draftGenerationExpanded: boolean;
  /** "플랫폼별 글 생성"의 대량 선택 폼(고급)을 기본으로 펼칠지. */
  platformGenerationExpanded: boolean;
}

/**
 * 현재 workflowState가 다루는 단계의 조작용 폼만 기본으로 펼치고, 이미
 * 지난 단계의 폼은 접어서 요약만 보여준다. 폼 자체는 삭제하지 않고
 * `<details open={...}>`로만 감싼다("기존 기능은 삭제하지 않는다" 원칙).
 *
 * Phase 3-23-4: "출처 목록"은 어떤 단계에서도 기본으로 전체를 펼치지
 * 않기로 했다(개수/최근 1~2개만 보여주고 "전체 출처 보기" 토글로
 * 펼친다) — 그래서 이 표에서 `sourceListExpanded`를 제거했다. 그 판단은
 * page.tsx에서 상수로 고정한다(항상 접힘).
 */
export function getDashboardSectionExpansion(state: DashboardWorkflowState): DashboardSectionExpansion {
  switch (state) {
    case "needs_theme":
      return { sourceAddExpanded: false, draftGenerationExpanded: false, platformGenerationExpanded: false };
    case "needs_source":
      return { sourceAddExpanded: true, draftGenerationExpanded: false, platformGenerationExpanded: false };
    case "ready_to_generate":
      return { sourceAddExpanded: false, draftGenerationExpanded: true, platformGenerationExpanded: false };
    case "needs_platform_posts":
      return { sourceAddExpanded: false, draftGenerationExpanded: false, platformGenerationExpanded: true };
    case "needs_review":
      return { sourceAddExpanded: false, draftGenerationExpanded: false, platformGenerationExpanded: false };
    case "ready_for_publish_prep":
      return { sourceAddExpanded: false, draftGenerationExpanded: false, platformGenerationExpanded: false };
  }
}

/**
 * Phase 3-23-4: "현재 단계"에 해당하는 관리 영역이 무엇인지를 하나의
 * 이름으로 반환한다. page.tsx는 이 값과 일치하는 블록만 상단에 크게
 * 펼쳐서 보여주고, 나머지는 "이전 단계 보기" accordion 안으로 옮긴다.
 * `ready_for_publish_prep`/`needs_theme`는 세 관리 영역(출처/원고/플랫폼)
 * 중 어느 것도 "현재 단계"가 아니므로 `null`을 반환한다(게시 준비
 * 단계는 별도의 "게시 준비" 섹션이 현재 단계 역할을 한다).
 */
export type DashboardCurrentStepArea = "source" | "draft" | "platform" | null;

export function getDashboardCurrentStepArea(state: DashboardWorkflowState): DashboardCurrentStepArea {
  switch (state) {
    case "needs_source":
      return "source";
    case "ready_to_generate":
      return "draft";
    case "needs_platform_posts":
    case "needs_review":
      return "platform";
    case "needs_theme":
    case "ready_for_publish_prep":
      return null;
  }
}

export interface ThemeStageCounts {
  articleCount: number;
  socialPostCount: number;
  approvedSocialPostCount: number;
}

/**
 * Phase 3-23-3: 왼쪽 테마 목록에서 동일 제목 테마도 구분할 수 있도록
 * 진행 단계를 짧은 한글 라벨로 요약한다("생성 전"/"원고 생성됨"/
 * "검토 대기"/"승인 N").
 */
export function describeThemeStageLabel(counts: ThemeStageCounts): string {
  if (counts.approvedSocialPostCount > 0) return `승인 ${counts.approvedSocialPostCount}`;
  if (counts.socialPostCount > 0) return "검토 대기";
  if (counts.articleCount > 0) return "원고 생성됨";
  return "생성 전";
}
