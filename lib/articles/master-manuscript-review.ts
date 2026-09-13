// Phase 4-8: 마스터 원고 자체의 자동 검토. `lib/articles/master-manuscript-builder.ts`가
// 만든 `MASTER_MANUSCRIPT_AUTO_REVIEW_CRITERIA`(사람이 읽는 문장 목록)를
// 실제로 통과/실패로 계산해 "준비 완료/확인 필요/재생성 권장/출처 부족"
// 같은 사용자 친화적 상태로 요약한다. 이 검토는 어디까지나 마스터
// 원고(편집 자료) 자체의 구조적 완성도를 보는 것이며, 플랫폼별 글
// (social_posts)의 자동 검토(`lib/social/social-quality-gate.ts`)나
// 사람의 최종 승인을 절대 대체하지 않는다.

import type { MasterManuscript } from "./master-manuscript-types";

/** 마스터 원고 생성 최소 출처 수(다른 곳의 MIN_SOURCE_COUNT와 동일한 기준). */
const MIN_SOURCE_COUNT_FOR_MASTER_MANUSCRIPT = 3;

export type MasterManuscriptReviewStatus =
  | "not_created"
  | "insufficient_sources"
  | "regenerate_recommended"
  | "needs_check"
  | "ready";

const STATUS_LABEL: Record<MasterManuscriptReviewStatus, string> = {
  not_created: "아직 없음",
  insufficient_sources: "출처 부족",
  regenerate_recommended: "재생성 권장",
  needs_check: "확인 필요",
  ready: "마스터 원고 준비 완료 · 플랫폼 변환 가능",
};

export interface MasterManuscriptReviewChecklistItem {
  key: string;
  label: string;
  pass: boolean;
}

export interface MasterManuscriptReviewResult {
  status: MasterManuscriptReviewStatus;
  statusLabel: string;
  checklist: MasterManuscriptReviewChecklistItem[];
  /** 통과하지 못한 항목의 라벨만 모은 목록(화면에 "확인 필요" 사유로 보여줄 때 사용). */
  failedItemLabels: string[];
}

function checklistItem(key: string, label: string, pass: boolean): MasterManuscriptReviewChecklistItem {
  return { key, label, pass };
}

/**
 * 마스터 원고의 구조적 완성도를 점검한다. `master`가 아직 없으면(원고를
 * 만들지 않은 상태) `not_created`를 반환하고 checklist는 비운다.
 */
export function reviewMasterManuscript(master: MasterManuscript | null | undefined): MasterManuscriptReviewResult {
  if (!master) {
    return { status: "not_created", statusLabel: STATUS_LABEL.not_created, checklist: [], failedItemLabels: [] };
  }

  const hasSourceSummaries = master.sourceSummaries.length > 0;
  const hasVerifiedFacts = master.verifiedFacts.length > 0;
  const allFactsHaveSourceId = master.verifiedFacts.every((f) => f.sourceIds.length > 0);
  const hasFactInterpretationSplit = master.factInterpretationSplit.length > 0;
  const hasEvidenceMap = master.evidenceMap.length > 0;
  const hasVerificationNeeded = master.verificationNeeded.length > 0;
  const hasProhibitedOrCareful =
    master.prohibitedOrCarefulExpressions.prohibited.length > 0 ||
    master.prohibitedOrCarefulExpressions.careful.length > 0;
  const hasPlatformBriefs = Object.keys(master.platformBriefs).length > 0;
  const hasLongFormSupport = Boolean(master.longFormSupport);
  const hasOptimizationSupport = Boolean(master.optimizationSupport);
  // 출처 없는 수치 단정: factType이 "number"인데 sourceIds가 비어 있으면 위반.
  const noUnsourcedNumberClaim = master.verifiedFacts.every((f) => f.factType !== "number" || f.sourceIds.length > 0);
  // 확인 필요 사항이 확인된 사실 문장 그대로 섞여 들어가지 않았는가(원문 그대로 중복 여부만 기계적으로 확인).
  const verifiedFactTexts = new Set(master.verifiedFacts.map((f) => f.fact));
  const verificationNeededNotLeakedIntoFacts = !master.verificationNeeded.some((v) => verifiedFactTexts.has(v));

  const checklist: MasterManuscriptReviewChecklistItem[] = [
    checklistItem("has_source_summaries", "출처별 요약이 있는가", hasSourceSummaries),
    checklistItem("has_verified_facts", "확인된 사실이 있는가", hasVerifiedFacts),
    checklistItem("facts_have_source_id", "각 사실에 sourceId가 있는가", allFactsHaveSourceId),
    checklistItem("has_fact_interpretation_split", "사실과 해석이 분리되어 있는가", hasFactInterpretationSplit),
    checklistItem("has_evidence_map", "evidenceMap이 있는가", hasEvidenceMap),
    checklistItem("has_verification_needed", "확인 필요 사항이 있는가", hasVerificationNeeded),
    checklistItem("has_prohibited_or_careful", "금지/주의 표현이 있는가", hasProhibitedOrCareful),
    checklistItem("has_platform_briefs", "플랫폼별 brief가 있는가", hasPlatformBriefs),
    checklistItem("has_long_form_support", "장문 글 설계도가 있는가", hasLongFormSupport),
    checklistItem("has_optimization_support", "SEO/AEO/GEO/AGENT 재료가 있는가", hasOptimizationSupport),
    checklistItem("no_unsourced_number_claim", "출처 없는 수치 단정이 없는가", noUnsourcedNumberClaim),
    checklistItem(
      "verification_needed_not_leaked",
      "확인 필요 사항이 사실로 잘못 처리되지 않았는가",
      verificationNeededNotLeakedIntoFacts
    ),
  ];

  const failedItemLabels = checklist.filter((c) => !c.pass).map((c) => c.label);

  // "재생성 권장" 대상 hard fail — 마스터 원고의 핵심 신뢰성 규칙을
  // 어긴 경우(출처 연결 누락, 확인 필요 사항 혼입, 수치 단정)만 재생성을
  // 권한다. 나머지(구조 일부 누락)는 "확인 필요" 수준으로만 안내한다.
  const hardFailKeys = new Set(["facts_have_source_id", "no_unsourced_number_claim", "verification_needed_not_leaked"]);
  const hasHardFail = checklist.some((c) => hardFailKeys.has(c.key) && !c.pass);

  let status: MasterManuscriptReviewStatus;
  if (master.sourceSummaries.length < MIN_SOURCE_COUNT_FOR_MASTER_MANUSCRIPT) {
    status = "insufficient_sources";
  } else if (hasHardFail) {
    status = "regenerate_recommended";
  } else if (!hasVerifiedFacts || !hasEvidenceMap) {
    status = "needs_check";
  } else {
    status = "ready";
  }

  return { status, statusLabel: STATUS_LABEL[status], checklist, failedItemLabels };
}
