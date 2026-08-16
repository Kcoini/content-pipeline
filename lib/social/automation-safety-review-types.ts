// Phase 3-22: Automation Safety Review — 읽기 전용 안전 점검 타입 정의.
// 이 파일이 정의하는 모든 타입은 이미 존재하는 feature flag/social_posts/
// pipeline_logs 상태를 점검(audit)한 결과를 표현하기 위한 것이며,
// 어떤 필드도 데이터를 변경하는 데 쓰이지 않는다. 민감정보(API key,
// access token 등)의 값 자체는 이 타입 어디에도 담기지 않는다 —
// 이름/개수/상태만 담는다.

export type AutomationSafetyStatus = "not_checked" | "safe" | "warning" | "blocked" | "failed";

export type AutomationSafetySeverity = "info" | "low" | "medium" | "high" | "critical";

export type AutomationSafetyCategory =
  | "feature_flags"
  | "approval_gates"
  | "publish_guards"
  | "api_publish"
  | "logging_security"
  | "content_safety"
  | "data_integrity"
  | "rollback"
  | "manual_workflow"
  | "environment";

/** 체크리스트에 미리 정의된 점검 항목 하나(정적 데이터, DB 조회 없음). */
export interface AutomationSafetyReviewChecklistItem {
  id: string;
  category: AutomationSafetyCategory;
  label: string;
  description: string;
}

/** 실제 점검 결과 발견 사항 하나. matchedValue 등 민감정보 원문은 절대 담지 않는다. */
export interface AutomationSafetyFinding {
  id: string;
  category: AutomationSafetyCategory;
  severity: AutomationSafetySeverity;
  message: string;
  /** 참고용 대상 id 목록(예: social_post id, log id) — 값 자체가 아니라 식별자만. */
  sampleIds?: string[];
  /** 참고용 개수(예: 위험 항목 몇 건) — 원문/전체 목록은 담지 않는다. */
  count?: number;
}

export interface AutomationSafetyRecommendation {
  id: string;
  category: AutomationSafetyCategory;
  message: string;
  severity: AutomationSafetySeverity;
}

/** 카테고리 하나의 점검 결과 요약. */
export interface AutomationSafetyCategoryResult {
  category: AutomationSafetyCategory;
  status: AutomationSafetyStatus;
  findings: AutomationSafetyFinding[];
}

/** runAutomationSafetyReview()가 반환하는 전체 결과. */
export interface AutomationSafetyReviewResult {
  status: AutomationSafetyStatus;
  summary: string;
  checklist: AutomationSafetyReviewChecklistItem[];
  categoryResults: AutomationSafetyCategoryResult[];
  findings: AutomationSafetyFinding[];
  recommendations: AutomationSafetyRecommendation[];
  blockers: AutomationSafetyFinding[];
  warnings: AutomationSafetyFinding[];
  checkedAt: string;
}
