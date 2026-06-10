// Harness Engineering Lite: contracts/*.yaml과 lib/harness/contract-runner.ts가
// 공유하는 타입 정의

export type ContractRuleType =
  | "required"
  | "pattern"
  | "unique"
  | "count"
  | "equals"
  | "minLength"
  | "maxLength"
  | "approvalRequired";

export type ContractRuleAppliesTo = "create" | "update" | "transition";

export interface ContractRule {
  id: string;
  description?: string;
  type: ContractRuleType;
  /** required 규칙에서 사용: 검사할 필드 목록 */
  fields?: string[];
  /** pattern, equals, minLength, maxLength, approvalRequired 규칙에서 사용 */
  field?: string;
  /** pattern 규칙에서 사용: 정규식 문자열 */
  pattern?: string;
  /** equals, minLength, maxLength, approvalRequired 규칙에서 사용 */
  value?: string | number;
  /** count 규칙에서 사용 */
  min?: number;
  max?: number;
  /** count, unique 규칙에서 사용: context.collections의 키 */
  scope?: string;
  /** 이 규칙이 적용되는 시점 (create/update/transition) */
  appliesTo?: ContractRuleAppliesTo;
}

export interface Contract {
  name: string;
  version: number;
  target: string;
  description?: string;
  rules: ContractRule[];
}

export interface ContractViolation {
  ruleId: string;
  message: string;
}

export interface ContractResult {
  contractName: string;
  passed: boolean;
  violations: ContractViolation[];
}

/**
 * count, unique 규칙 평가에 필요한 컬렉션(예: 같은 주제의 출처 목록,
 * 기사가 인용한 출처 목록)을 전달하기 위한 컨텍스트
 */
export interface ContractContext {
  collections?: Record<string, Record<string, unknown>[]>;
  /** approvalRequired 규칙 평가에 사용 (true면 사용자가 이미 승인한 상태) */
  approved?: boolean;
  /** 규칙의 appliesTo와 비교할 현재 작업 종류 */
  operation?: ContractRuleAppliesTo;
}

/** 컬렉션(예: sources 목록) 내 개별 항목에 대한 위반 내역 */
export interface ItemContractViolations {
  index: number;
  item: Record<string, unknown>;
  violations: ContractViolation[];
}

/**
 * runContractForCollection의 결과.
 * - violations: 항목별 위반 + 컬렉션 단위 위반을 모두 합친 전체 목록
 * - itemViolations: 항목별 위반 상세 (어떤 출처가 어떤 규칙을 위반했는지 표시할 때 사용)
 */
export interface CollectionContractResult extends ContractResult {
  itemViolations: ItemContractViolations[];
}
