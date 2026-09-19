// Phase QA-01-FIX1: platform publishing guard의 blocked 결과를
// 사용자에게 자연어로 보여주기 위한 순수 표시 ViewModel. 새 parallel
// status system을 만들지 않는다 — 이미 platform-publishing-guard-service.ts가
// 계산해 social_posts.platform_publish_guard_summary에 저장해 둔
// checklist를 다시 읽어 라벨만 자연어로 바꾼다. 기존 checklist item의
// key/label/message는 raw DB 필드명(quality_status 등)이 섞여 있어
// 그대로 노출하지 않고, key 기준의 별도 사전을 쓴다.

import type { PlatformPublishGuardChecklistItem } from "./social-platform-types";

export interface PublishGuardIssueViewModel {
  key: string;
  /** 사용자용 제목(무엇이 문제인지, raw 필드명 없이). */
  title: string;
  /** 어떻게 해결하는지에 대한 짧은 안내(있는 것만). */
  message?: string;
}

const ISSUE_COPY: Record<string, { title: string; message?: string }> = {
  platform_valid: { title: "지원하지 않는 게시 플랫폼입니다." },
  tone_style_valid: { title: "지원하지 않는 문체 설정입니다." },
  quality_status_ready: {
    title: "품질검사를 먼저 통과해야 합니다.",
    message: "자동 검토를 실행하고 문제를 해결한 뒤 다시 확인하세요.",
  },
  approval_status_approved: {
    title: "아직 승인되지 않았습니다.",
    message: "먼저 검토·승인을 완료하세요.",
  },
  export_status_ready_or_exported: {
    title: "수동 게시 준비 자료를 아직 만들지 않았습니다.",
    message: "수동 게시 준비 자료(export)를 먼저 만드세요.",
  },
  publish_status_ok: {
    title: "이미 게시가 차단되었거나 완료된 글입니다.",
  },
  content_present: { title: "게시할 본문이 없습니다." },
  export_payload_present: {
    title: "수동 게시 준비 자료가 비어 있습니다.",
    message: "수동 게시 준비 자료(export)를 먼저 만드세요.",
  },
  no_forbidden_patterns: { title: "금지된 표현이 포함되어 있습니다." },
  platform_specific_risk: { title: "이 플랫폼에서 위험 신호로 판단되는 표현이 있습니다." },
  platform_primary_field_present: { title: "이 플랫폼에 꼭 필요한 내용이 비어 있습니다." },
};

const DEFAULT_ISSUE_COPY = { title: "게시 전에 확인이 필요한 항목이 있습니다." };

/**
 * blocked 상태인 checklist 항목만 자연어 안내로 바꾼다. checklist가
 * 비어 있으면(guard를 아직 실행하지 않았으면) 빈 배열을 반환한다 —
 * raw key/필드명/원본 message는 반환값에 포함하지 않는다.
 */
export function describePublishGuardIssues(
  checklist: PlatformPublishGuardChecklistItem[] | undefined | null
): PublishGuardIssueViewModel[] {
  if (!Array.isArray(checklist)) return [];
  return checklist
    .filter((c) => c.status === "blocked")
    .map((c) => {
      const copy = ISSUE_COPY[c.key] ?? DEFAULT_ISSUE_COPY;
      return { key: c.key, title: copy.title, message: copy.message };
    });
}
