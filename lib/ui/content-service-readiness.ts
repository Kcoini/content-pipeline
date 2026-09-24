// PRODUCT-01D: 일반 내부 사용자(INTERNAL_USER)가 "지금 이 서비스로 뭘 할
// 수 있는지"를 기술 지식 없이 확인할 수 있게 하는 presentation-only
// derived model. 새로운 판단 로직을 만들지 않는다 — 이미 있는
// `lib/ops/production-preflight.ts`의 `runProductionPreflight()`(env만
// 읽는 순수 함수, Supabase/Anthropic/WordPress에 실제 요청을 보내지
// 않음)를 그대로 재사용해서, 그 결과를 사용자 언어로만 다시 번역한다.
// raw preflight message/checkName/PreflightStatus는 이 파일 밖으로
// 나가지 않는다(Admin 화면에서는 기존 preflight 결과를 그대로 계속
// 쓴다 — 이 파일은 일반 사용자용 별도 뷰일 뿐, preflight를 대체하지
// 않는다).

import { runProductionPreflight, type PreflightCheck, type PreflightStatus } from "@/lib/ops/production-preflight";

/** 사용자에게 보여줄 3단계 상태. "unknown"은 "연결 안 됨"으로 추측하지 않기 위한 별도 값이다. */
export type ReadinessStatus = "available" | "needs_attention" | "unknown";

export interface ReadinessItem {
  /** 사용자에게 보여줄 항목 이름(예: "콘텐츠 생성"). raw preflight check 이름이 아니다. */
  label: string;
  status: ReadinessStatus;
  /** 상태에 대한 한국어 한 줄 설명. env var 이름/provider ID 등은 절대 포함하지 않는다. */
  message: string;
}

export interface ContentServiceReadiness {
  /** AI로 실제 콘텐츠를 생성할 수 있는지(mock 대체가 아니라 실제 생성 경로가 살아있는지). */
  canCreateContent: ReadinessItem;
  /** 참고자료(출처) 자동 검색 provider 사용 가능 여부. */
  sourceSearchAvailable: ReadinessItem;
  /** WordPress 연동(초안 저장) 사용 가능 여부. */
  wordpressAvailable: ReadinessItem;
  /**
   * 사람 승인이 항상 필요한지 — 이 값은 preflight에서 파생되지 않는다.
   * `lib/harness/approval-gate.ts`의 `assertApproved`가 코드 레벨에서
   * 항상 강제하는 구조적 사실이라 언제나 true다(설정으로 끌 수 없음 —
   * 섹션 16 "Safety Settings" 원칙과 동일한 이유로 toggle을 만들지
   * 않는다).
   */
  requiresHumanApproval: true;
}

function findCheck(checks: readonly PreflightCheck[], name: string): PreflightCheck | undefined {
  return checks.find((c) => c.name === name);
}

/** preflight의 pass/warning/fail을 "unknown으로 추측하지 않는다"는 원칙 아래 사용자 상태로 변환한다. */
function toReadinessStatus(status: PreflightStatus | undefined): ReadinessStatus {
  if (status === "pass") return "available";
  if (status === "warning" || status === "fail") return "needs_attention";
  return "unknown";
}

/**
 * 현재 서비스 준비 상태를 일반 사용자 언어로 계산한다. env var 이름,
 * provider ID, preflight raw message는 반환값에 포함하지 않는다.
 * Supabase 연결 여부(순수 인프라, 사용자가 판단할 개념이 아님)와
 * dangerous-flags(Admin 전용)는 의도적으로 제외한다.
 */
export function getContentServiceReadiness(): ContentServiceReadiness {
  const { checks } = runProductionPreflight();

  const anthropic = findCheck(checks, "Anthropic");
  const wordpress = findCheck(checks, "WordPress Draft");
  const search = findCheck(checks, "Search providers");

  const anthropicStatus = toReadinessStatus(anthropic?.status);
  const wordpressStatus = toReadinessStatus(wordpress?.status);
  const searchStatus = toReadinessStatus(search?.status);

  return {
    canCreateContent: {
      label: "콘텐츠 생성",
      status: anthropicStatus,
      message:
        anthropicStatus === "available"
          ? "사용 가능"
          : anthropicStatus === "needs_attention"
            ? "확인이 필요합니다. 관리자에게 문의해 주세요."
            : "상태를 확인할 수 없습니다.",
    },
    sourceSearchAvailable: {
      label: "자료 검색",
      status: searchStatus,
      message:
        searchStatus === "available"
          ? "사용 가능"
          : searchStatus === "needs_attention"
            ? "일부 자료 검색 기능이 제한될 수 있습니다."
            : "상태를 확인할 수 없습니다.",
    },
    wordpressAvailable: {
      label: "WordPress",
      status: wordpressStatus,
      message:
        wordpressStatus === "available"
          ? "연결됨"
          : wordpressStatus === "needs_attention"
            ? "WordPress 연결을 확인해 주세요."
            : "상태를 확인할 수 없습니다.",
    },
    requiresHumanApproval: true,
  };
}
