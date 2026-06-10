// Harness Engineering Lite: 사람의 명시적 승인 없이 article의 status가
// reviewed/published로 전환되는 것을 막는다 (FR-9).
//
// contract-runner의 "approvalRequired" 규칙이 데이터 레벨 검사를 담당한다면,
// 이 모듈은 API/서비스 레이어에서 호출되는 명시적인 가드 역할을 한다.

export type ApprovableEntity = "article";

/**
 * 사람의 승인이 필요한 상태 전환 목록.
 * 새로운 엔티티/상태가 추가되면 여기에 등록한다.
 */
const APPROVAL_REQUIRED_TRANSITIONS: Record<ApprovableEntity, string[]> = {
  article: ["reviewed", "published"],
};

export interface ApprovalDecision {
  entityType: ApprovableEntity;
  entityId: string;
  fromStatus: string;
  toStatus: string;
  /** 사용자가 실제로 승인 액션을 수행했는지 여부 */
  approved: boolean;
  /** 승인한 사용자 식별자 (이메일 등) */
  approvedBy?: string;
}

export class ApprovalRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApprovalRequiredError";
  }
}

/**
 * 주어진 상태 전환이 사용자의 명시적 승인을 필요로 하는지 여부를 반환한다.
 */
export function requiresApproval(entityType: ApprovableEntity, toStatus: string): boolean {
  return APPROVAL_REQUIRED_TRANSITIONS[entityType].includes(toStatus);
}

/**
 * 상태 전환을 실행하기 전에 호출한다.
 * 승인이 필요한 전환인데 approved=false이면 ApprovalRequiredError를 던진다.
 *
 * 이 함수가 통과해야만 status 업데이트 쿼리를 실행한다.
 */
export function assertApproved(decision: ApprovalDecision): void {
  if (!requiresApproval(decision.entityType, decision.toStatus)) return;

  if (!decision.approved) {
    throw new ApprovalRequiredError(
      `${decision.entityType}(${decision.entityId})를 '${decision.fromStatus}' -> '${decision.toStatus}' 상태로 전환하려면 사용자 승인이 필요합니다.`
    );
  }

  if (!decision.approvedBy) {
    throw new ApprovalRequiredError(
      `${decision.entityType}(${decision.entityId}) 승인에는 승인자(approvedBy) 정보가 필요합니다.`
    );
  }
}
