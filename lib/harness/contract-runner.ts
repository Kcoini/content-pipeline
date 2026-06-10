// Reins Engineering: contracts/*.yaml에 정의된 규칙을 실제 데이터에 대해 검사한다.
// 계약을 통과하지 못하면 파이프라인은 즉시 중단되어야 하며, 우회해서는 안 된다.
//
// NOTE(Phase 1): 현재는 이미 파싱된 Contract 객체를 입력으로 받는다.
// YAML 파일을 직접 읽어 Contract로 변환하는 loadContract()는
// js-yaml 의존성 추가 후 구현한다 (docs/phase-1-plan.md 참고).

import type {
  Contract,
  ContractContext,
  ContractResult,
  ContractRule,
  ContractViolation,
} from "./types";

export function runContract(
  contract: Contract,
  target: Record<string, unknown>,
  context: ContractContext = {}
): ContractResult {
  const violations: ContractViolation[] = [];

  for (const rule of contract.rules) {
    if (rule.appliesTo && context.operation && rule.appliesTo !== context.operation) {
      continue;
    }

    const violation = checkRule(rule, target, context);
    if (violation) {
      violations.push(violation);
    }
  }

  return {
    contractName: contract.name,
    passed: violations.length === 0,
    violations,
  };
}

function checkRule(
  rule: ContractRule,
  target: Record<string, unknown>,
  context: ContractContext
): ContractViolation | null {
  switch (rule.type) {
    case "required":
      return checkRequired(rule, target);
    case "pattern":
      return checkPattern(rule, target);
    case "equals":
      return checkEquals(rule, target);
    case "minLength":
      return checkMinLength(rule, target);
    case "maxLength":
      return checkMaxLength(rule, target);
    case "count":
      return checkCount(rule, context);
    case "unique":
      return checkUnique(rule, context);
    case "approvalRequired":
      return checkApprovalRequired(rule, target, context);
    default:
      return null;
  }
}

function checkRequired(
  rule: ContractRule,
  target: Record<string, unknown>
): ContractViolation | null {
  const missing = (rule.fields ?? []).filter((field) => {
    const value = target[field];
    return value === undefined || value === null || value === "";
  });

  if (missing.length === 0) return null;
  return {
    ruleId: rule.id,
    message: `필수 필드 누락: ${missing.join(", ")}`,
  };
}

function checkPattern(
  rule: ContractRule,
  target: Record<string, unknown>
): ContractViolation | null {
  if (!rule.field || !rule.pattern) return null;

  const value = String(target[rule.field] ?? "");
  if (new RegExp(rule.pattern).test(value)) return null;

  return {
    ruleId: rule.id,
    message: `${rule.field} 값이 패턴(${rule.pattern})과 일치하지 않습니다: ${value}`,
  };
}

function checkEquals(
  rule: ContractRule,
  target: Record<string, unknown>
): ContractViolation | null {
  if (!rule.field || rule.value === undefined) return null;
  if (target[rule.field] === rule.value) return null;

  return {
    ruleId: rule.id,
    message: `${rule.field} 값은 '${rule.value}'여야 합니다 (현재: ${String(
      target[rule.field]
    )})`,
  };
}

function checkMinLength(
  rule: ContractRule,
  target: Record<string, unknown>
): ContractViolation | null {
  if (!rule.field || rule.value === undefined) return null;

  const value = String(target[rule.field] ?? "");
  const min = Number(rule.value);
  if (value.length >= min) return null;

  return {
    ruleId: rule.id,
    message: `${rule.field}은(는) 최소 ${min}자 이상이어야 합니다 (현재: ${value.length}자)`,
  };
}

function checkMaxLength(
  rule: ContractRule,
  target: Record<string, unknown>
): ContractViolation | null {
  if (!rule.field || rule.value === undefined) return null;

  const value = String(target[rule.field] ?? "");
  const max = Number(rule.value);
  if (value.length <= max) return null;

  return {
    ruleId: rule.id,
    message: `${rule.field}은(는) 최대 ${max}자를 초과할 수 없습니다 (현재: ${value.length}자)`,
  };
}

function checkCount(
  rule: ContractRule,
  context: ContractContext
): ContractViolation | null {
  if (!rule.scope) return null;

  const collection = context.collections?.[rule.scope] ?? [];
  const count = collection.length;

  if (rule.min !== undefined && count < rule.min) {
    return {
      ruleId: rule.id,
      message: `${rule.scope}의 항목 수가 최소 ${rule.min}개 이상이어야 합니다 (현재: ${count}개)`,
    };
  }

  if (rule.max !== undefined && count > rule.max) {
    return {
      ruleId: rule.id,
      message: `${rule.scope}의 항목 수가 최대 ${rule.max}개를 초과할 수 없습니다 (현재: ${count}개)`,
    };
  }

  return null;
}

function checkUnique(
  rule: ContractRule,
  context: ContractContext
): ContractViolation | null {
  if (!rule.field || !rule.scope) return null;

  const collection = context.collections?.[rule.scope] ?? [];
  const values = collection.map((item) => item[rule.field as string]);
  const duplicates = values.filter((value, index) => values.indexOf(value) !== index);

  if (duplicates.length === 0) return null;

  return {
    ruleId: rule.id,
    message: `${rule.scope} 내 ${rule.field} 값이 중복되었습니다: ${[
      ...new Set(duplicates.map(String)),
    ].join(", ")}`,
  };
}

function checkApprovalRequired(
  rule: ContractRule,
  target: Record<string, unknown>,
  context: ContractContext
): ContractViolation | null {
  if (!rule.field || rule.value === undefined) return null;

  // 전환하려는 값이 승인이 필요한 값이 아니면 통과
  if (target[rule.field] !== rule.value) return null;

  if (context.approved) return null;

  return {
    ruleId: rule.id,
    message: `${rule.field}을(를) '${rule.value}'(으)로 전환하려면 사용자 승인이 필요합니다.`,
  };
}
