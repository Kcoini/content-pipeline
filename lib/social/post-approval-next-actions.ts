// Phase 4-29: 최종 승인(approval_status === "approved") 이후 "다음 작업"을
// 플랫폼별로 계산하는 순수 함수. 이 함수는 어떤 데이터도 바꾸지 않고
// 어떤 action도 호출하지 않는다 — DB 조회가 필요한 값(WordPress Draft
// 존재 여부, API 연동 설정 여부 등)은 호출부가 미리 계산해서 넘긴다.
//
// 배경: 승인 완료 카드가 "이미 승인된 글입니다. 아래에서 다음 작업을
// 진행하세요."라는 문구만 보여주고, 실제로 눌러야 할 버튼이 없거나
// (news_article/opinion_column처럼 이 함수가 없던 플랫폼) 있어도 왜
// 그 버튼인지 알기 어려웠다. 이 함수는 플랫폼·상태별로 "지금 눌러야
// 할 버튼 1개(primaryAction) + 보조 버튼들(secondaryActions) + 안내
// 문장(message)"을 항상 반환한다 — 절대 빈 배열을 반환하지 않는다
// ([본문 복사]는 모든 플랫폼에서 항상 실제로 동작하므로 fallback으로도
// 안전하다).
//
// 실제 API 게시(네이버 카페/X/Threads/Instagram에 진짜로 올리기)는
// 아직 구현되어 있지 않다(dry-run만 지원, PLATFORM_API_PUBLISHING_ENABLED
// 참고) — 그래서 이 함수는 "게시하기" 같은, 지금 눌러도 아무 일도
// 일어나지 않는 라벨을 반환하지 않는다. 대신 실제로 존재하는 화면
// (API 게시 준비 상태 확인)으로 안내한다.

import type { SocialPlatform } from "./social-platform-types";

export type PostApprovalNextActionType =
  | "copy_body"
  | "view_detail"
  | "view_wordpress_draft"
  | "create_wordpress_draft"
  | "check_wordpress_publish_readiness"
  | "prepare_manual_export"
  | "check_api_readiness";

export interface PostApprovalNextAction {
  label: string;
  actionType: PostApprovalNextActionType;
}

export interface PostApprovalNextActionsInput {
  platform: SocialPlatform;
  /** wordpress_blog에만 의미 있다 — WordPress Draft(post_id)가 이미 생성되어 있는지. */
  wordpressDraftExists?: boolean;
  /** wordpress_blog에만 의미 있다 — publishGuardStatus === "ready"(대표 이미지/체크리스트/SEO 등 나머지 게시 준비가 끝났는지). */
  wordpressPublishGuardReady?: boolean;
  /** naver_cafe/x/threads/instagram에만 의미 있다 — checkPlatformApiReadiness(platform).configured. */
  apiConfigured?: boolean;
}

export interface PostApprovalNextActionsResult {
  primaryAction: PostApprovalNextAction;
  secondaryActions: PostApprovalNextAction[];
  message: string;
}

const COPY_BODY: PostApprovalNextAction = { label: "본문 복사", actionType: "copy_body" };
const VIEW_DETAIL: PostApprovalNextAction = { label: "상세 보기", actionType: "view_detail" };

/**
 * "승인 완료" 이후 플랫폼별 다음 작업을 계산한다. 어느 분기로 가든
 * primaryAction은 항상 실제로 지금 실행할 수 있는 작업이고,
 * secondaryActions에는 항상 최소 [본문 복사]/[상세 보기]가 포함된다 —
 * 승인 완료 상태에서 버튼이 하나도 없는 화면이 생기지 않는다.
 */
export function getPostApprovalNextActions(input: PostApprovalNextActionsInput): PostApprovalNextActionsResult {
  switch (input.platform) {
    case "wordpress_blog": {
      if (!input.wordpressDraftExists) {
        return {
          primaryAction: { label: "WordPress Draft 만들기", actionType: "create_wordpress_draft" },
          secondaryActions: [COPY_BODY, VIEW_DETAIL],
          message: "승인 완료. WordPress Draft를 만들 수 있습니다.",
        };
      }
      if (!input.wordpressPublishGuardReady) {
        return {
          primaryAction: { label: "게시 준비 확인", actionType: "check_wordpress_publish_readiness" },
          secondaryActions: [COPY_BODY, VIEW_DETAIL],
          message: "승인 완료. WordPress Draft는 이미 있지만, 게시 전에 확인할 항목(대표 이미지/체크리스트 등)이 더 있습니다.",
        };
      }
      return {
        primaryAction: { label: "WordPress Draft 보기", actionType: "view_wordpress_draft" },
        secondaryActions: [COPY_BODY, VIEW_DETAIL],
        message: "승인 완료. WordPress Draft를 확인할 수 있습니다.",
      };
    }

    case "naver_blog":
    case "news_article":
    case "opinion_column":
      return {
        primaryAction: COPY_BODY,
        secondaryActions: [{ label: "수동 export 준비", actionType: "prepare_manual_export" }, VIEW_DETAIL],
        message: "승인 완료. 본문을 복사해 수동으로 게시하거나, 수동 export를 준비할 수 있습니다.",
      };

    case "naver_cafe":
    case "x":
    case "threads":
    case "instagram":
      if (input.apiConfigured) {
        return {
          primaryAction: COPY_BODY,
          secondaryActions: [{ label: "API 게시 준비 확인", actionType: "check_api_readiness" }, VIEW_DETAIL],
          message: "승인 완료. API 연동이 설정되어 있습니다 — 게시 준비 상태를 확인하거나 본문을 복사할 수 있습니다.",
        };
      }
      return {
        primaryAction: COPY_BODY,
        secondaryActions: [VIEW_DETAIL],
        message: "승인 완료. 아직 API 연동이 설정되어 있지 않아 본문을 복사해 수동으로 게시하세요.",
      };

    default:
      // 알 수 없는 platform이 생기더라도 [본문 복사]는 항상 안전한 fallback이다.
      return {
        primaryAction: COPY_BODY,
        secondaryActions: [VIEW_DETAIL],
        message: "승인 완료. 본문을 복사할 수 있습니다.",
      };
  }
}
