// Phase 3-22: Automation Safety Review — pipeline_logs 로깅 보안 점검.
// 이 파일은 절대 매칭된 민감정보 원문을 반환하지 않는다. 어떤 로그에서
// 어떤 종류의 패턴이 발견되었는지(event_name, created_at, finding type,
// severity)만 반환한다.

import { listRecentPipelineLogsForAudit } from "@/lib/repositories/automation-safety-review-repository";
import type { AutomationSafetySeverity } from "./automation-safety-review-types";

export type LoggingSecurityFindingType =
  | "api_key"
  | "access_token"
  | "refresh_token"
  | "authorization_header"
  | "application_password"
  | "client_secret"
  | "suspicious_full_post_body"
  | "suspicious_full_caption"
  | "export_payload"
  | "dry_run_payload"
  | "handoff_payload";

export interface LoggingSecurityFinding {
  logId: string;
  eventName: string;
  createdAt: string;
  findingType: LoggingSecurityFindingType;
  severity: AutomationSafetySeverity;
}

/** 값 자체를 절대 반환하지 않고, "발견됐는지 여부"만 판단하는 패턴 목록. */
const SENSITIVE_PATTERNS: { findingType: LoggingSecurityFindingType; severity: AutomationSafetySeverity; regex: RegExp }[] = [
  { findingType: "api_key", severity: "critical", regex: /api[_-]?key/i },
  { findingType: "access_token", severity: "critical", regex: /access[_-]?token/i },
  { findingType: "refresh_token", severity: "critical", regex: /refresh[_-]?token/i },
  { findingType: "authorization_header", severity: "critical", regex: /\bauthorization\b|\bbearer\b/i },
  { findingType: "application_password", severity: "critical", regex: /application[_-]?password/i },
  { findingType: "client_secret", severity: "critical", regex: /client[_-]?secret/i },
  { findingType: "export_payload", severity: "medium", regex: /export_payload/i },
  { findingType: "dry_run_payload", severity: "medium", regex: /dry[_-]?run_payload/i },
  { findingType: "handoff_payload", severity: "medium", regex: /handoff_payload/i },
];

/** 지나치게 긴 문자열 값은 full post_body/caption을 통째로 저장했을 가능성이 있다고 본다. */
const SUSPICIOUS_FULL_TEXT_LENGTH = 500;

function collectStringValues(value: unknown, out: string[]): void {
  if (typeof value === "string") {
    out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStringValues(item, out);
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      // 키 이름 자체도 패턴 매칭 대상에 포함한다(예: { access_token: "..." }처럼
      // 값이 아닌 키에 민감정보 이름이 등장하는 경우를 놓치지 않기 위함).
      out.push(key);
      collectStringValues(v, out);
    }
  }
}

function detectFindingsInText(text: string): { findingType: LoggingSecurityFindingType; severity: AutomationSafetySeverity }[] {
  const found: { findingType: LoggingSecurityFindingType; severity: AutomationSafetySeverity }[] = [];

  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.regex.test(text)) {
      found.push({ findingType: pattern.findingType, severity: pattern.severity });
    }
  }

  if (text.length >= SUSPICIOUS_FULL_TEXT_LENGTH) {
    found.push({ findingType: "suspicious_full_post_body", severity: "medium" });
    found.push({ findingType: "suspicious_full_caption", severity: "medium" });
  }

  return found;
}

/**
 * 최근 pipeline_logs의 message/details_json에서 민감정보 패턴을 점검한다.
 * 매칭된 값 자체는 절대 결과에 포함하지 않는다.
 */
export async function auditRecentPipelineLogsForSensitiveData(limit?: number): Promise<LoggingSecurityFinding[]> {
  const logs = await listRecentPipelineLogsForAudit(limit);
  const findings: LoggingSecurityFinding[] = [];

  for (const log of logs) {
    const texts: string[] = [];
    collectStringValues(log.message, texts);
    collectStringValues(log.details, texts);

    const seenTypesForLog = new Set<LoggingSecurityFindingType>();

    for (const text of texts) {
      for (const detected of detectFindingsInText(text)) {
        if (seenTypesForLog.has(detected.findingType)) continue;
        seenTypesForLog.add(detected.findingType);
        findings.push({
          logId: log.id,
          eventName: log.type,
          createdAt: log.createdAt,
          findingType: detected.findingType,
          severity: detected.severity,
        });
      }
    }
  }

  return findings;
}
