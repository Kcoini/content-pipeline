// OPS-02B: 운영 health signal 요약 — 새 모니터링 시스템/DB 테이블을
// 만들지 않고, 이미 있는 pipeline_logs(lib/repositories/log-repository.ts)를
// 그대로 읽어 "지금 운영 상태가 괜찮은가"를 판단할 최소 집계를
// 계산한다. 대규모 monitoring SaaS 연동은 하지 않는다.
//
// 핵심 원칙(QA-01-FIX1에서 확립, OPS-02A/02B 전체에 적용):
// 실행 상태(success/failed)와 business 상태(ready/warning/blocked)는
// 서로 다른 축이다. 이 요약은 "실제 실행 실패"만 failure로 집계하고,
// fact-grounding 확인 필요/publish guard blocked 같은 정상적인 business
// 차단 상태는 절대 failure로 세지 않는다(섹션 14, 16).

import { getLogsByTypesAndRange, type LogEventType } from "@/lib/repositories/log-repository";

export interface HealthSummaryRange {
  since?: string;
  until?: string;
}

export interface OperationalHealthSummary {
  rangeSince: string | null;
  rangeUntil: string | null;
  /** job_run 생명주기 집계(job-progress-service.ts가 이미 pipeline_logs에 남기는 이벤트만 사용). */
  jobs: {
    completed: number;
    failed: number;
    partialSuccess: number;
    /** business 차단(사람 조치 필요) — failure로 세지 않는다. */
    blocked: number;
    stalled: number;
  };
  /** 실제 실행 실패로 분류하는 signal만 모은다(섹션 13 예시 기준). */
  failures: {
    generation: number;
    structuredOutputParse: number;
    wordpressDraft: number;
    other: number;
    total: number;
  };
  /**
   * business 차단 상태(실행 실패 아님) — 참고용으로만 따로 센다. 섹션
   * 14/16: "단순 blocked를 장애 alert로 보내지 않는다."
   */
  businessBlocked: {
    publishGuardBlocked: number;
    qualityGateBlocked: number;
    factGroundingConfirmationRequired: number;
  };
  /**
   * 알려진 한계: 이 프로젝트에는 article eval(lib/ai/eval-article.ts) 실행
   * 실패를 pipeline_logs에 남기는 전용 이벤트가 없다(evaluateArticleWithAi/
   * evaluateArticleModeWithAi는 실패 시 ArticleEvalResult.notes에만
   * "평가 실행 실패(evaluation_error): ..."를 담아 반환할 뿐, logEvent를
   * 호출하지 않는다 — OPS-02A에서 확인). 그래서 evaluationFailures는
   * 항상 0으로 계산 가능성이 있는 "미계측" 값이며, 실제 0건이라는 뜻이
   * 아니다 — 별도 필드로 명시해 혼동을 막는다.
   */
  evaluationFailuresNotInstrumented: true;
}

/** 실제 실행 실패로 취급하는 이벤트 목록(섹션 13). business-blocked 이벤트는 절대 포함하지 않는다. */
const GENERATION_FAILURE_EVENTS: readonly LogEventType[] = [
  "ai_generation_failed",
  "article_generation_failed",
  "social_post_generation_failed",
  "platform_generation_failed",
];

/**
 * 구조화 출력(JSON) 파싱 실패 전용 이벤트는 아직 없다(OPS-02A에서 확인 —
 * Threads malformed-escape 실패는 social_draft_generation_failed로
 * 뭉뚱그려 기록된다). 별도 이벤트가 생기기 전까지는 이 이벤트를
 * "구조화 출력 실패"의 근사치로 쓴다 — 정확한 사유 구분은 details_json을
 * 직접 열어봐야 한다(OPS-02A: full 응답은 로그에 남기지 않으므로 이
 * 요약만으로 정확한 원인까지는 알 수 없다).
 */
const STRUCTURED_OUTPUT_FAILURE_EVENTS: readonly LogEventType[] = ["social_draft_generation_failed"];

const WORDPRESS_DRAFT_FAILURE_EVENTS: readonly LogEventType[] = [
  "wordpress_publish_failed",
  "wordpress_actual_publish_failed",
  "article_wordpress_prepare_failed",
];

const OTHER_FAILURE_EVENTS: readonly LogEventType[] = [
  "social_approval_failed",
  "social_manual_posting_record_failed",
  "post_auto_fix_failed",
  "post_auto_recheck_failed",
  "job_run_failed",
  "job_step_failed",
];

/** business 차단(실행 실패 아님) 참고용 이벤트. */
const BUSINESS_BLOCKED_EVENTS: readonly LogEventType[] = [
  "social_platform_publish_guard_blocked",
  "wordpress_public_publish_blocked",
  "publish_quality_gate_blocked",
  "social_quality_gate_blocked",
];

const JOB_LIFECYCLE_EVENTS: readonly LogEventType[] = [
  "job_run_completed",
  "job_run_failed",
  "job_run_partial_success",
  "job_run_blocked",
  "job_run_stalled_detected",
];

function countByType(entries: { type: LogEventType }[], types: readonly LogEventType[]): number {
  const set = new Set<string>(types);
  return entries.filter((e) => set.has(e.type)).length;
}

/**
 * pipeline_logs를 조회해 운영 health 요약을 만든다. 기간을 지정하지
 * 않으면(둘 다 undefined) 최근 5000건(getLogsByTypesAndRange 기본
 * limit) 범위에서 계산한다.
 */
export async function buildOperationalHealthSummary(range: HealthSummaryRange = {}): Promise<OperationalHealthSummary> {
  const allTrackedEvents = Array.from(
    new Set<LogEventType>([
      ...JOB_LIFECYCLE_EVENTS,
      ...GENERATION_FAILURE_EVENTS,
      ...STRUCTURED_OUTPUT_FAILURE_EVENTS,
      ...WORDPRESS_DRAFT_FAILURE_EVENTS,
      ...OTHER_FAILURE_EVENTS,
      ...BUSINESS_BLOCKED_EVENTS,
    ])
  );

  const logs = await getLogsByTypesAndRange(allTrackedEvents, { since: range.since, until: range.until });

  const generation = countByType(logs, GENERATION_FAILURE_EVENTS);
  const structuredOutputParse = countByType(logs, STRUCTURED_OUTPUT_FAILURE_EVENTS);
  const wordpressDraft = countByType(logs, WORDPRESS_DRAFT_FAILURE_EVENTS);
  const other = countByType(logs, OTHER_FAILURE_EVENTS);

  return {
    rangeSince: range.since ?? null,
    rangeUntil: range.until ?? null,
    jobs: {
      completed: countByType(logs, ["job_run_completed"]),
      failed: countByType(logs, ["job_run_failed"]),
      partialSuccess: countByType(logs, ["job_run_partial_success"]),
      blocked: countByType(logs, ["job_run_blocked"]),
      stalled: countByType(logs, ["job_run_stalled_detected"]),
    },
    failures: {
      generation,
      structuredOutputParse,
      wordpressDraft,
      other,
      total: generation + structuredOutputParse + wordpressDraft + other,
    },
    businessBlocked: {
      publishGuardBlocked: countByType(logs, ["social_platform_publish_guard_blocked", "wordpress_public_publish_blocked"]),
      qualityGateBlocked: countByType(logs, ["publish_quality_gate_blocked", "social_quality_gate_blocked"]),
      factGroundingConfirmationRequired: 0, // fact_grounding은 quality gate checklist item일 뿐 전용 로그 이벤트가 없다(details_json을 직접 조회해야 정확하다) — 미계측임을 명시.
    },
    evaluationFailuresNotInstrumented: true,
  };
}
